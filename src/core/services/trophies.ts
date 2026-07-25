import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Trophäenschrank (V7): Die gesammelten Titel einer Karriere. Bewusst in einem
 * eigenen Meta-Key ('trophyCabinet'), der beim "Neue Karriere starten" NICHT
 * gelöscht wird – die Trophäen bleiben dauerhaft über alle Karrieren erhalten.
 */

export interface TrophyCabinet {
  /** Liga-Meistertitel je Division (Division -> Anzahl) */
  leagueTitles: Record<number, number>;
  /** Vize-Meister / Aufstieg als Zweiter je Division (Division -> Anzahl) */
  runnerUps: Record<number, number>;
  /** Champions-League: Platz 1 / 2 / 3 (V7.4) */
  clTitles: number;
  clRunnerUps: number;
  clThird: number;
  /** Nationaler Pokal: Platz 1 / 2 / 3 (V7.4) */
  cupTitles: number;
  cupRunnerUps: number;
  cupThird: number;
  /** Vollendete Karrieren (Liga + Champions League in derselben Saison) */
  doubles: number;
}

/** Platzierung in einem Turnier (1 = Sieger, 2 = Finale verloren, 3 = Spiel um Platz 3 gewonnen). */
export type TournamentPlace = 1 | 2 | 3;

const EMPTY: TrophyCabinet = {
  leagueTitles: {}, runnerUps: {},
  clTitles: 0, clRunnerUps: 0, clThird: 0,
  cupTitles: 0, cupRunnerUps: 0, cupThird: 0,
  doubles: 0,
};

export async function loadTrophies(): Promise<TrophyCabinet> {
  const raw = await metaRepo.getMeta('trophyCabinet');
  if (!raw) return { ...EMPTY, leagueTitles: {}, runnerUps: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<TrophyCabinet>;
    return {
      leagueTitles: parsed.leagueTitles ?? {},
      runnerUps: parsed.runnerUps ?? {},
      clTitles: parsed.clTitles ?? 0,
      clRunnerUps: parsed.clRunnerUps ?? 0,
      clThird: parsed.clThird ?? 0,
      cupTitles: parsed.cupTitles ?? 0,
      cupRunnerUps: parsed.cupRunnerUps ?? 0,
      cupThird: parsed.cupThird ?? 0,
      doubles: parsed.doubles ?? 0,
    };
  } catch {
    return { ...EMPTY, leagueTitles: {}, runnerUps: {} };
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

/** Vize-Meister (Platz 2, Aufstieg) einer Division gutschreiben. */
export async function addRunnerUp(division: number): Promise<void> {
  const c = await loadTrophies();
  c.runnerUps[division] = (c.runnerUps[division] ?? 0) + 1;
  await save(c);
}

/** Champions-League-Titel gutschreiben (Platz 1). */
export async function addClTitle(): Promise<void> {
  await addTournamentPlace('cl', 1);
}

/**
 * Turnier-Platzierung in den Schrank (V7.4): CL oder Pokal, Platz 1/2/3.
 * Platz 1 = Sieger, 2 = Finale verloren, 3 = Spiel um Platz 3 gewonnen.
 */
export async function addTournamentPlace(kind: 'cl' | 'cup', place: TournamentPlace): Promise<void> {
  const c = await loadTrophies();
  if (kind === 'cl') {
    if (place === 1) c.clTitles += 1;
    else if (place === 2) c.clRunnerUps += 1;
    else c.clThird += 1;
  } else {
    if (place === 1) c.cupTitles += 1;
    else if (place === 2) c.cupRunnerUps += 1;
    else c.cupThird += 1;
  }
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
  const runner = Object.values(c.runnerUps).reduce((a, b) => a + b, 0);
  return (
    league + runner +
    c.clTitles + c.clRunnerUps + c.clThird +
    c.cupTitles + c.cupRunnerUps + c.cupThird +
    c.doubles
  );
}
