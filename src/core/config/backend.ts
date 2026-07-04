/**
 * Supabase-Zugangsdaten für die Friendlies-Funktion (Konto, Freunde,
 * Freundschaftsspiele). Der anon-Key ist absichtlich öffentlich – die
 * Sicherheit kommt von den Row-Level-Security-Regeln in der Datenbank.
 *
 * Leere Werte = Cloud-Funktionen deaktiviert, die App läuft rein lokal.
 * Werte stehen im Supabase-Dashboard unter Project Settings → API.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export function backendConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
