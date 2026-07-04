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
