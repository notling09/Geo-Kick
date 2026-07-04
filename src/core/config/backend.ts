/**
 * Supabase-Zugangsdaten für die Friendlies-Funktion (Konto, Freunde,
 * Freundschaftsspiele). Der anon-Key ist absichtlich öffentlich – die
 * Sicherheit kommt von den Row-Level-Security-Regeln in der Datenbank.
 *
 * Leere Werte = Cloud-Funktionen deaktiviert, die App läuft rein lokal.
 * Werte stehen im Supabase-Dashboard unter Project Settings → API.
 */
export const SUPABASE_URL = 'https://wkcyqtzhvkxqfyudkmmn.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrY3lxdHpodmt4cWZ5dWRrbW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzk5MTksImV4cCI6MjA5ODc1NTkxOX0.P_b1sHiTqoIGCu_4kpEzdH_31hv6ruYqTDkrrljiuz8';

export function backendConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
