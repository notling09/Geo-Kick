import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, backendConfigured } from '../config/backend';
import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Supabase-Anbindung für die Friendlies-Funktion. Die Auth-Session wird in
 * unserer SQLite (meta-Tabelle) persistiert, damit kein zusätzliches
 * natives Storage-Modul nötig ist. Alle Funktionen sind fehler-tolerant:
 * ohne Konfiguration oder Netz bleibt die App voll spielbar.
 */

const AUTH_STORAGE_PREFIX = 'sb-auth:';

// Supabase erwartet ein (async) Key-Value-Storage-Interface
const sqliteAuthStorage = {
  getItem: async (key: string): Promise<string | null> =>
    metaRepo.getMeta(AUTH_STORAGE_PREFIX + key),
  setItem: async (key: string, value: string): Promise<void> =>
    metaRepo.setMeta(AUTH_STORAGE_PREFIX + key, value),
  removeItem: async (key: string): Promise<void> =>
    metaRepo.setMeta(AUTH_STORAGE_PREFIX + key, ''),
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!backendConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sqliteAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** 6-stelliger Freundes-Code (ohne leicht verwechselbare Zeichen). */
export function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Kader-Schnappschuss, wie er in der clubs-Tabelle liegt (squad jsonb). */
export interface CloudSquadPlayer {
  name: string;
  position: string;
  rarity: string;
  level: number;
  tempo: number;
  technik: number;
  abschluss: number;
  verteidigung: number;
  kondition: number;
}

export interface CloudClub {
  id: string;
  friend_code: string;
  club_name: string;
  crest: string;
  division: number;
  strength: number;
  formation: string;
  squad: CloudSquadPlayer[];
  updated_at: string;
}

/** Ein Eintrag der weltweiten Bestenliste (V7). */
export interface LeaderboardEntry {
  id: string;
  clubName: string;
  crest: string;
  division: number;
  strength: number;
  bestPlayer: string | null;
  bestOverall: number;
}

/**
 * Weltweite Bestenliste (V7): die stärksten Klubs aller Spieler, absteigend
 * nach Team-Stärke. Der squad-Schnappschuss enthält bereits die effektiven
 * Attribute, daraus ergibt sich der beste Spieler je Klub. Kein neues
 * DB-Recht nötig – clubs sind ohnehin öffentlich lesbar (clubs_read_all).
 */
export async function fetchLeaderboard(
  overall: (p: CloudSquadPlayer) => number,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const query = supabase
    .from('clubs')
    .select('id, club_name, crest, division, strength, squad')
    .gt('strength', 0)
    .order('strength', { ascending: false })
    .limit(limit);
  // Timeout: hängt die Verbindung (z. B. pausiertes Supabase-Projekt), darf die
  // Bestenliste NICHT ewig laden – nach 8 s brechen wir sauber ab (V7.9).
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 8000),
  );
  const { data, error } = await Promise.race([query, timeout]);
  if (error || !data) return [];
  // Defensiv (V7.9.1): ein einziger fehlerhafter Klub-Datensatz (z. B. ein alt
  // synchronisierter Kader) darf NICHT die ganze Bestenliste zum Absturz
  // bringen. Jeder Klub wird einzeln abgesichert; kippt einer, wird er
  // uebersprungen statt alles zu verwerfen.
  const out: LeaderboardEntry[] = [];
  for (const c of data) {
    try {
      const squad = Array.isArray(c.squad) ? (c.squad as CloudSquadPlayer[]) : [];
      let bestPlayer: string | null = null;
      let bestOverall = 0;
      for (const p of squad) {
        let ovr = 0;
        try { ovr = overall(p); } catch { ovr = 0; }
        if (ovr > bestOverall) {
          bestOverall = ovr;
          bestPlayer = p.name;
        }
      }
      out.push({
        id: c.id as string,
        clubName: c.club_name as string,
        crest: c.crest as string,
        division: c.division as number,
        strength: c.strength as number,
        bestPlayer,
        bestOverall,
      });
    } catch {
      /* fehlerhaften Klub-Datensatz ueberspringen */
    }
  }
  return out;
}
