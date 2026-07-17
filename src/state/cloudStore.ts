import { create } from 'zustand';
import { backendConfigured } from '../core/config/backend';
import {
  generateFriendCode, getSupabase, type CloudSquadPlayer,
} from '../core/services/cloud';
import { effectiveAttributes } from '../core/engine/playerGen';
import { teamStrength } from '../core/engine/strength';
import { useGameStore } from './gameStore';

/**
 * Cloud-Zustand (Friendlies Stufe 1+2): anonymer Login, eigener Klub-Datensatz
 * mit Freundes-Code, automatischer Kader-Sync bei Änderungen.
 * Alles fire-and-forget – Fehler blockieren nie das lokale Spiel.
 */

export type CloudStatus = 'disabled' | 'connecting' | 'online' | 'error';

interface CloudState {
  status: CloudStatus;
  friendCode: string | null;
  lastSyncAt: number | null;

  /** Nach App-Start (onboarded) aufrufen; verbindet + startet Auto-Sync. */
  init: () => Promise<void>;
  /** Eigenen Klub-Schnappschuss hochladen (debounced über subscribe). */
  syncClub: () => Promise<void>;
}

function buildSquadSnapshot(): { squad: CloudSquadPlayer[]; strength: number; formation: string } {
  const game = useGameStore.getState();
  const lineup = game.lineupPlayers();
  const formation = game.club?.formation ?? '4-4-2';
  const squad: CloudSquadPlayer[] = lineup
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      name: p.pool.name,
      position: p.pool.position,
      rarity: p.pool.rarity,
      level: p.level,
      ...effectiveAttributes(p.pool, p.level),
    }));
  return { squad, strength: teamStrength(lineup, formation), formation };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSnapshotJson = '';

export const useCloudStore = create<CloudState>((set, get) => ({
  status: backendConfigured() ? 'connecting' : 'disabled',
  friendCode: null,
  lastSyncAt: null,

  init: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: 'disabled' });
      return;
    }
    set({ status: 'connecting' });
    try {
      // Anonym anmelden (Session wird in SQLite persistiert)
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        sessionData = (await supabase.auth.getSession()).data;
      }
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('no user after sign-in');

      // Eigenen Klub-Datensatz sicherstellen (mit einmaligem Friend-Code)
      const { data: existing } = await supabase
        .from('clubs')
        .select('friend_code')
        .eq('id', userId)
        .maybeSingle();

      let friendCode = existing?.friend_code as string | undefined;
      if (!friendCode) {
        const game = useGameStore.getState();
        const snapshot = buildSquadSnapshot();
        // Bei Code-Kollision (unique) bis zu 5x neu würfeln
        for (let attempt = 0; attempt < 5 && !friendCode; attempt++) {
          const candidate = generateFriendCode();
          const { error } = await supabase.from('clubs').insert({
            id: userId,
            friend_code: candidate,
            club_name: game.club?.name ?? 'My Club',
            crest: game.club?.crest ?? 'crest-0',
            division: game.club?.division ?? 4,
            strength: snapshot.strength,
            formation: snapshot.formation,
            squad: snapshot.squad,
          });
          if (!error) friendCode = candidate;
          else if (!String(error.message).includes('duplicate')) throw error;
        }
        if (!friendCode) throw new Error('could not allocate friend code');
      }

      set({ status: 'online', friendCode });
      await get().syncClub();

      // Online-Friendlies (V6): auf Live-Einladungen von Freunden lauschen
      const { useOnlineStore } = await import('./onlineStore');
      void useOnlineStore.getState().init();

      // Online-Status (V6.3): Presence direkt beim Start melden, damit
      // Freunde sehen, dass die App offen ist
      const { useFriendsStore } = await import('./friendsStore');
      void useFriendsStore.getState().ensurePresence();

      // Auto-Sync: bei Kader-/Klub-Änderungen (debounced) hochladen
      useGameStore.subscribe(() => {
        if (get().status !== 'online') return;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          void get().syncClub();
        }, 4000);
      });
    } catch (e) {
      console.warn('[cloud] init failed:', String(e));
      set({ status: 'error' });
    }
  },

  syncClub: async () => {
    const supabase = getSupabase();
    if (!supabase || get().status !== 'online') return;
    try {
      const game = useGameStore.getState();
      const snapshot = buildSquadSnapshot();
      const payload = {
        club_name: game.club?.name ?? 'My Club',
        crest: game.club?.crest ?? 'crest-0',
        division: game.club?.division ?? 4,
        strength: snapshot.strength,
        formation: snapshot.formation,
        squad: snapshot.squad,
        updated_at: new Date().toISOString(),
      };
      // Nur hochladen, wenn sich wirklich etwas geändert hat
      const json = JSON.stringify(payload);
      if (json === lastSnapshotJson) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      const { error } = await supabase.from('clubs').update(payload).eq('id', userId);
      if (error) throw error;
      lastSnapshotJson = json;
      set({ lastSyncAt: Date.now() });
    } catch (e) {
      console.warn('[cloud] sync failed:', String(e));
    }
  },
}));
