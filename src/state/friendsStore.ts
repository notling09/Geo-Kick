import { create } from 'zustand';
import type { Position } from '../core/domain/types';
import { simulateFirstHalf, simulateSecondHalf, type SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import { getSupabase, type CloudClub } from '../core/services/cloud';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useCloudStore } from './cloudStore';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';
import { setHalftimeResume } from './matchFlow';

/**
 * Friendlies (Stufe 3+4): Freunde per Code hinzufügen und gegen ihren
 * zuletzt synchronisierten Kader spielen. Freundschaftsspiele geben keine
 * Coins/Packs – nur Ehre und eine lokale Siegbilanz pro Freund.
 */

export interface FriendlyRecord {
  w: number;
  d: number;
  l: number;
}

export type AddFriendResult = 'ok' | 'not_found' | 'own_code' | 'already_added' | 'offline';

interface FriendsState {
  friends: CloudClub[];
  records: Record<string, FriendlyRecord>;
  loading: boolean;

  /** Freundesliste + aktuelle Kader vom Server laden. */
  loadFriends: () => Promise<void>;
  addFriend: (code: string) => Promise<AddFriendResult>;
  removeFriend: (friendId: string) => Promise<void>;
  /**
   * Freundschaftsspiel gegen den aktuellsten Kader des Freundes simulieren.
   * Ergebnis landet als lastPlayedMatch im leagueStore (Live-Ticker-Replay).
   */
  playFriendly: (friendId: string) => Promise<PlayedUserMatch | null>;
}

async function loadRecords(): Promise<Record<string, FriendlyRecord>> {
  const raw = await metaRepo.getMeta('friendlyRecords');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, FriendlyRecord>;
  } catch {
    return {};
  }
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  records: {},
  loading: false,

  loadFriends: async () => {
    const supabase = getSupabase();
    if (!supabase || useCloudStore.getState().status !== 'online') return;
    set({ loading: true });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      // Freundschaften holen, dann die zugehörigen Klubs (inkl. Kader)
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);
      if (fErr) throw fErr;
      const ids = (friendships ?? []).map((f) => f.friend_id as string);
      let friends: CloudClub[] = [];
      if (ids.length > 0) {
        const { data: clubs, error: cErr } = await supabase
          .from('clubs')
          .select('*')
          .in('id', ids);
        if (cErr) throw cErr;
        friends = (clubs ?? []) as CloudClub[];
        friends.sort((a, b) => a.club_name.localeCompare(b.club_name));
      }
      set({ friends, records: await loadRecords() });
    } catch (e) {
      console.warn('[friends] load failed:', String(e));
    } finally {
      set({ loading: false });
    }
  },

  addFriend: async (code) => {
    const supabase = getSupabase();
    if (!supabase || useCloudStore.getState().status !== 'online') return 'offline';
    const normalized = code.trim().toUpperCase();
    if (normalized === useCloudStore.getState().friendCode) return 'own_code';
    try {
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('friend_code', normalized)
        .maybeSingle();
      if (!club) return 'not_found';
      if (get().friends.some((f) => f.id === club.id)) return 'already_added';

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return 'offline';
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: club.id });
      if (error && !String(error.message).includes('duplicate')) throw error;
      await get().loadFriends();
      return 'ok';
    } catch (e) {
      console.warn('[friends] add failed:', String(e));
      return 'offline';
    }
  },

  removeFriend: async (friendId) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);
      set({ friends: get().friends.filter((f) => f.id !== friendId) });
    } catch (e) {
      console.warn('[friends] remove failed:', String(e));
    }
  },

  playFriendly: async (friendId) => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const game = useGameStore.getState();
    const club = game.club;
    if (!club) return null;

    // Frischesten Kader des Freundes holen (er kann sich gerade geändert haben)
    let friend = get().friends.find((f) => f.id === friendId) ?? null;
    try {
      const { data } = await supabase.from('clubs').select('*').eq('id', friendId).maybeSingle();
      if (data) friend = data as CloudClub;
    } catch {
      // Netzfehler: mit dem zuletzt geladenen Stand spielen
    }
    if (!friend) return null;

    const lineup = game.lineupPlayers();
    const friendRoster = (friend.squad ?? []).map((p) => ({
      name: p.name,
      position: p.position as Position,
    }));
    const friendTeam: SimTeam = {
      name: friend.club_name,
      strength: friend.strength > 0 ? friend.strength : 400,
      tactic: 'ausgewogen',
      roster: friendRoster.length > 0 ? friendRoster : undefined,
    };
    const userTeam: SimTeam = {
      name: club.name,
      strength: teamStrength(lineup, club.formation),
      tactic: club.tactic,
      roster: lineup
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({ name: p.pool.name, position: p.pool.position })),
    };

    // V5: erst die 1. Halbzeit – zur Pause sind Wechsel/Taktikwechsel möglich
    const half = simulateFirstHalf(userTeam, friendTeam);
    const baseMatch = {
      id: 0,
      season: 0,
      division: 0,
      round: 0,
      homeId: 'user',
      awayId: friendId,
    };
    const provisional: PlayedUserMatch = {
      match: {
        ...baseMatch,
        homeGoals: half.homeGoals,
        awayGoals: half.awayGoals,
        played: false,
        events: half.events,
      },
      homeName: club.name,
      awayName: friend.club_name,
      homeCrest: club.crest,
      awayCrest: friend.crest,
      userIsHome: true,
      halftimePending: true,
    };
    useLeagueStore.setState({ lastPlayedMatch: provisional });

    setHalftimeResume(async (secondHalfTactic) => {
      const g2 = useGameStore.getState();
      await g2.setTactic(secondHalfTactic);
      const lineup2 = g2.lineupPlayers();
      const userTeam2: SimTeam = {
        name: club.name,
        strength: teamStrength(lineup2, g2.club?.formation ?? club.formation),
        tactic: secondHalfTactic,
        roster: lineup2
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => ({ name: p.pool.name, position: p.pool.position })),
      };
      const result = simulateSecondHalf(userTeam2, friendTeam, half);

      // Lokale Siegbilanz fortschreiben (kein Coin-/Pack-Reward: Ehrensache)
      const records = { ...get().records };
      const rec = records[friendId] ?? { w: 0, d: 0, l: 0 };
      if (result.homeGoals > result.awayGoals) rec.w++;
      else if (result.homeGoals < result.awayGoals) rec.l++;
      else rec.d++;
      records[friendId] = rec;
      await metaRepo.setMeta('friendlyRecords', JSON.stringify(records));
      set({ records });

      useLeagueStore.setState({
        lastPlayedMatch: {
          match: {
            ...baseMatch,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            played: true,
            events: result.events,
          },
          homeName: club.name,
          awayName: friend.club_name,
          homeCrest: club.crest,
          awayCrest: friend.crest,
          userIsHome: true,
          stats: result.stats,
          motm: result.motm,
          halftimePending: false,
        },
      });
    });

    return provisional;
  },
}));
