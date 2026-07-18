import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Position, Tactic } from '../core/domain/types';
import type { SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import { getSupabase, type CloudClub } from '../core/services/cloud';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useCloudStore } from './cloudStore';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';
import { runUserMatch } from './matchFlow';

/**
 * Friendlies (Stufe 3+4, V6.3 mit Anfrage-Modell): Eine friendships-Zeile
 * A -> B heißt "A hat B geaddet". Erst wenn BEIDE Richtungen existieren,
 * sind zwei Klubs Freunde und können gegeneinander spielen. Einseitige
 * Zeilen erscheinen beim Empfänger als Anfrage (Annehmen/Ablehnen).
 * Dazu Online-Status per Realtime-Presence (Kanal gk-online).
 */

export interface FriendlyRecord {
  w: number;
  d: number;
  l: number;
}

export type AddFriendResult = 'ok' | 'not_found' | 'own_code' | 'already_added' | 'offline';

interface FriendsState {
  /** Gegenseitige Freundschaften – nur gegen diese kann gespielt werden */
  friends: CloudClub[];
  /** Haben mich geaddet, ich sie noch nicht (offene Anfragen an mich) */
  incoming: CloudClub[];
  /** Von mir geaddet, Gegenseite fehlt noch (gesendete Anfragen) */
  outgoing: CloudClub[];
  /** Gerade online (App offen) laut Presence-Kanal */
  onlineIds: string[];
  records: Record<string, FriendlyRecord>;
  loading: boolean;

  /** Freunde/Anfragen + aktuelle Kader vom Server laden. */
  loadFriends: () => Promise<void>;
  /** Eigenen Online-Status senden + Status der Freunde beobachten. */
  ensurePresence: () => Promise<void>;
  addFriend: (code: string) => Promise<AddFriendResult>;
  /** Eingehende Anfrage annehmen (Gegenzeile anlegen → Freunde). */
  acceptRequest: (friendId: string) => Promise<void>;
  /** Eingehende Anfrage ablehnen (Zeile des Anfragenden löschen). */
  declineRequest: (friendId: string) => Promise<void>;
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

let presenceChannel: RealtimeChannel | null = null;

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incoming: [],
  outgoing: [],
  onlineIds: [],
  records: {},
  loading: false,

  loadFriends: async () => {
    const supabase = getSupabase();
    if (!supabase || useCloudStore.getState().status !== 'online') return;
    set({ loading: true });
    try {
      const userId = await currentUserId();
      if (!userId) return;
      void get().ensurePresence();
      // Beide Richtungen holen: meine Adds + Zeilen, die auf mich zeigen
      const { data: rows, error: fErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (fErr) throw fErr;
      const mine = new Set(
        (rows ?? []).filter((r) => r.user_id === userId).map((r) => r.friend_id as string),
      );
      const theirs = new Set(
        (rows ?? []).filter((r) => r.friend_id === userId).map((r) => r.user_id as string),
      );
      const mutualIds = [...mine].filter((id) => theirs.has(id));
      const outgoingIds = [...mine].filter((id) => !theirs.has(id));
      const incomingIds = [...theirs].filter((id) => !mine.has(id));

      const allIds = [...new Set([...mutualIds, ...outgoingIds, ...incomingIds])];
      let clubs: CloudClub[] = [];
      if (allIds.length > 0) {
        const { data, error: cErr } = await supabase.from('clubs').select('*').in('id', allIds);
        if (cErr) throw cErr;
        clubs = (data ?? []) as CloudClub[];
      }
      const byId = new Map(clubs.map((c) => [c.id, c]));
      const pickClubs = (ids: string[]) =>
        ids
          .map((id) => byId.get(id))
          .filter((c): c is CloudClub => c !== undefined)
          .sort((a, b) => a.club_name.localeCompare(b.club_name));

      set({
        friends: pickClubs(mutualIds),
        incoming: pickClubs(incomingIds),
        outgoing: pickClubs(outgoingIds),
        records: await loadRecords(),
      });
    } catch (e) {
      console.warn('[friends] load failed:', String(e));
    } finally {
      set({ loading: false });
    }
  },

  ensurePresence: async () => {
    const supabase = getSupabase();
    if (!supabase || presenceChannel) return;
    const userId = await currentUserId();
    if (!userId) return;
    // Ein gemeinsamer Presence-Kanal: wer die App offen hat, ist "online"
    const channel = supabase.channel('gk-online', {
      config: { presence: { key: userId } },
    });
    presenceChannel = channel;
    channel.on('presence', { event: 'sync' }, () => {
      set({ onlineIds: Object.keys(channel.presenceState()) });
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() });
    });
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
      const known = [...get().friends, ...get().outgoing];
      if (known.some((f) => f.id === club.id)) return 'already_added';

      const userId = await currentUserId();
      if (!userId) return 'offline';
      // Anfrage senden – hat der andere mich schon geaddet, sind wir
      // damit direkt Freunde (beide Richtungen vorhanden)
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

  acceptRequest: async (friendId) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: friendId });
      if (error && !String(error.message).includes('duplicate')) throw error;
      await get().loadFriends();
    } catch (e) {
      console.warn('[friends] accept failed:', String(e));
    }
  },

  declineRequest: async (friendId) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const userId = await currentUserId();
      if (!userId) return;
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId);
      set({ incoming: get().incoming.filter((f) => f.id !== friendId) });
    } catch (e) {
      console.warn('[friends] decline failed:', String(e));
    }
  },

  removeFriend: async (friendId) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const userId = await currentUserId();
      if (!userId) return;
      // Beide Richtungen löschen: auch aus der Liste des anderen verschwinden
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId);
      set({
        friends: get().friends.filter((f) => f.id !== friendId),
        outgoing: get().outgoing.filter((f) => f.id !== friendId),
      });
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
    const baseMatch = {
      id: 0,
      season: 0,
      division: 0,
      round: 0,
      homeId: 'user',
      awayId: friendId,
    };
    const buildUserTeam = async (t: Tactic): Promise<SimTeam> => {
      const g = useGameStore.getState();
      await g.setTactic(t);
      const lineupNow = g.lineupPlayers();
      return {
        name: club.name,
        strength: teamStrength(lineupNow, g.club?.formation ?? club.formation),
        tactic: t,
        roster: lineupNow
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => ({ name: p.pool.name, position: p.pool.position })),
        captainName: g.players.find((p) => p.id === g.captainPlayerId)?.pool.name,
      };
    };

    // Live-Spiel (V5): pausiert bei Elfmetern und zur Halbzeit
    await runUserMatch({
      userIsHome: true,
      opponent: friendTeam,
      initialTactic: club.tactic,
      buildUserTeam,
      publish: (st, pause) =>
        useLeagueStore.setState({
          lastPlayedMatch: {
            match: {
              ...baseMatch,
              homeGoals: st.homeGoals,
              awayGoals: st.awayGoals,
              played: false,
              events: st.events,
            },
            homeName: club.name,
            awayName: friend.club_name,
            homeCrest: club.crest,
            awayCrest: friend.crest,
            userIsHome: true,
            pause,
          },
        }),
      finalize: async (result) => {
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
          },
        });
      },
    });

    return useLeagueStore.getState().lastPlayedMatch;
  },
}));
