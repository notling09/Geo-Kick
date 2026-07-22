import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Trophäenschrank (V7): Die gesammelten Titel einer Karriere. Bewusst in einem
 * eigenen Meta-Key ('trophyCabinet'), der beim "Neue Karriere starten" NICHT
 * gelöscht wird – die Trophäen bleiben dauerhaft über alle Karrieren erhalten.
 */

export interface TrophyCabinet {
  /** Liga-Meistertitel je Division (Division -> Anzahl) */
  leagueTitles: Record<number, number>;
  /** Champions-League-Titel */
  clTitles: number;
  /** Vollendete Karrieren (Liga + Champions League in derselben Saison) */
  doubles: number;
}

const EMPTY: TrophyCabinet = { leagueTitles: {}, clTitles: 0, doubles: 0 };

export async function loadTrophies(): Promise<TrophyCabinet> {
  const raw = await metaRepo.getMeta('trophyCabinet');
  if (!raw) return { ...EMPTY, leagueTitles: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<TrophyCabinet>;
    return {
      leagueTitles: parsed.leagueTitles ?? {},
      clTitles: parsed.clTitles ?? 0,
      doubles: parsed.doubles ?? 0,
    };
  } catch {
    return { ...EMPTY, leagueTitles: {} };
  }
}

async function save(cabinet: TrophyCabinet): Promise<void> {
  await metaRepo.setMeta('trophyCabinet', JSON.stringify(cabinet));
}

/** Liga-Meistertitel einer Division gutschreiben. */
export async function addLeagueTitle(division: number): Promise<void> {
  const c = await loadTrophies();
  c.leagueTitles[division] = (c.leagueTitles[division] ?? 0) + 1;
  await save(c);
}

/** Champions-League-Titel gutschreiben. */
export async function addClTitle(): Promise<void> {
  const c = await loadTrophies();
  c.clTitles += 1;
  await save(c);
}

/** Vollendete Karriere (Doppel) gutschreiben. */
export async function addDouble(): Promise<void> {
  const c = await loadTrophies();
  c.doubles += 1;
  await save(c);
}

/** Gesamtzahl aller Trophäen (für die Profil-Anzeige). */
export function totalTrophies(c: TrophyCabinet): number {
  const league = Object.values(c.leagueTitles).reduce((a, b) => a + b, 0);
  return league + c.clTitles + c.doubles;
}
