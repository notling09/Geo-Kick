import type { PackTypeId } from '../domain/constants';
import * as metaRepo from '../db/repositories/metaRepo';
import { dayOrdinal } from '../engine/pitchBattle';

/**
 * Saisonpass (V7.7): ein wöchentlicher Pass (Level 1–20, 100 Punkte/Level).
 * Punkte kommen aus Tages-Missionen UND passiv aus dem Spielen (Siege,
 * Champion, Check-in, Pitch-Siege …). Jede Woche (Sonntag→Montag 00:00 lokal)
 * wird alles neu: Level zurück auf 1, neue Belohnungen, täglich neue Missionen.
 * Belohnungen holt man wie bei FIFA per Antippen ab.
 *
 * Alles liegt in der Meta-Tabelle, keine eigene DB-Tabelle nötig.
 */

export const PASS_MAX_LEVEL = 20;
export const POINTS_PER_LEVEL = 100;

export type MissionType =
  | 'win' | 'goal' | 'cleanSheet' | 'checkin' | 'pitchWin' | 'boss' | 'openPack'
  | 'marketBuy' | 'captainGoal' | 'clWin' | 'rivalWin' | 'egg' | 'onlineWin' | 'chemFull';

export type Difficulty = 'easy' | 'med' | 'hard';
const DIFF_POINTS: Record<Difficulty, number> = { easy: 25, med: 50, hard: 75 };

interface MissionDef { id: string; type: MissionType; goal: number; diff: Difficulty; }

/** Großer Pool an Missionen; täglich werden 5 davon gezogen. */
const MISSION_POOL: MissionDef[] = [
  { id: 'win1', type: 'win', goal: 1, diff: 'easy' },
  { id: 'checkin1', type: 'checkin', goal: 1, diff: 'easy' },
  { id: 'pitch1', type: 'pitchWin', goal: 1, diff: 'easy' },
  { id: 'pack1', type: 'openPack', goal: 1, diff: 'easy' },
  { id: 'capgoal1', type: 'captainGoal', goal: 1, diff: 'easy' },
  { id: 'goal1', type: 'goal', goal: 1, diff: 'easy' },
  { id: 'win2', type: 'win', goal: 2, diff: 'med' },
  { id: 'goal3', type: 'goal', goal: 3, diff: 'med' },
  { id: 'clean1', type: 'cleanSheet', goal: 1, diff: 'med' },
  { id: 'market1', type: 'marketBuy', goal: 1, diff: 'med' },
  { id: 'clwin1', type: 'clWin', goal: 1, diff: 'med' },
  { id: 'egg1', type: 'egg', goal: 1, diff: 'med' },
  { id: 'online1', type: 'onlineWin', goal: 1, diff: 'med' },
  { id: 'win3', type: 'win', goal: 3, diff: 'hard' },
  { id: 'goal5', type: 'goal', goal: 5, diff: 'hard' },
  { id: 'rival1', type: 'rivalWin', goal: 1, diff: 'hard' },
  { id: 'boss1', type: 'boss', goal: 1, diff: 'hard' },
  { id: 'chem1', type: 'chemFull', goal: 1, diff: 'hard' },
  { id: 'pitch2', type: 'pitchWin', goal: 2, diff: 'hard' },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wochen-Nummer (an Montag ausgerichtet; Tag 4 = erster Montag ab Epoch). */
export function weekId(day = dayOrdinal()): number {
  return Math.floor((day - 4) / 7);
}

/** Tage bis zum nächsten Montag (Reset). */
export function daysUntilReset(day = dayOrdinal()): number {
  const into = ((day - 4) % 7 + 7) % 7;
  return 7 - into;
}

/** Die 5 Tages-Missionen (deterministisch aus der Tagesnummer). */
export function dailyMissions(day = dayOrdinal()): MissionDef[] {
  const rng = mulberry32(Math.imul(day + 1, 2654435761));
  const arr = [...MISSION_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 5);
}

export function missionPoints(diff: Difficulty): number {
  return DIFF_POINTS[diff];
}

/** Bei Wochenwechsel Punkte/Belohnungen zurücksetzen. */
async function ensureWeek(): Promise<void> {
  const w = weekId();
  const stored = await metaRepo.getMetaNumber('passWeek', -999999);
  if (stored !== w) {
    await metaRepo.setMeta('passWeek', String(w));
    await metaRepo.setMeta('passPoints', '0');
    await metaRepo.setMeta('passClaimed', '[]');
  }
}

export async function addPassPoints(n: number): Promise<void> {
  if (n <= 0) return;
  await ensureWeek();
  const p = (await metaRepo.getMetaNumber('passPoints', 0)) + n;
  await metaRepo.setMeta('passPoints', String(p));
}

/**
 * Fortschritt einer Tages-Mission melden. Erhöht alle heutigen aktiven
 * Missionen des passenden Typs; wird eine fertig, gibt es einmalig Punkte.
 */
export async function reportMissionEvent(type: MissionType, amount = 1): Promise<void> {
  if (amount <= 0) return;
  const day = dayOrdinal();
  const active = dailyMissions(day).filter((m) => m.type === type);
  if (active.length === 0) return;
  const progKey = `passMProg:${day}`;
  const doneKey = `passMDone:${day}`;
  let prog: Record<string, number> = {};
  let done: string[] = [];
  try { prog = JSON.parse((await metaRepo.getMeta(progKey)) || '{}'); } catch { prog = {}; }
  try { done = JSON.parse((await metaRepo.getMeta(doneKey)) || '[]'); } catch { done = []; }
  let points = 0;
  for (const m of active) {
    if (done.includes(m.id)) continue;
    prog[m.id] = (prog[m.id] ?? 0) + amount;
    if (prog[m.id] >= m.goal) { done.push(m.id); points += DIFF_POINTS[m.diff]; }
  }
  await metaRepo.setMeta(progKey, JSON.stringify(prog));
  await metaRepo.setMeta(doneKey, JSON.stringify(done));
  if (points > 0) await addPassPoints(points);
}

// ---- Belohnungen -----------------------------------------------------------

export type PassReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'points'; amount: number }
  | { kind: 'pack'; pack: PackTypeId; count: number }
  | { kind: 'tokens'; amount: number }
  | { kind: 'player' };

/** Belohnung für ein Level (wöchentlich zufällig für 5/10/15, fix bei 20). */
export function rewardForLevel(level: number, wid = weekId()): PassReward | null {
  if (level <= 0) return null;
  if (level === 20) return { kind: 'pack', pack: 'ultimate', count: 1 };
  const rng = mulberry32(Math.imul(wid * 100 + level + 7, 40503) >>> 0);
  if (level === 5 || level === 10 || level === 15) {
    const opts: PassReward[] = [
      { kind: 'pack', pack: 'rare', count: 1 },
      { kind: 'pack', pack: 'standard', count: 1 },
      { kind: 'pack', pack: 'session', count: 3 },
      { kind: 'pack', pack: 'standard', count: 2 },
      { kind: 'tokens', amount: 2 },
      { kind: 'tokens', amount: 3 },
      { kind: 'player' },
    ];
    return opts[Math.floor(rng() * opts.length)];
  }
  // kleine Level: Coins ODER Punkte, steigend
  const amount = level <= 4 ? 10 : level <= 9 ? 20 : level <= 14 ? 30 : (rng() < 0.5 ? 40 : 50);
  return rng() < 0.5 ? { kind: 'coins', amount } : { kind: 'points', amount };
}

export interface PassMissionView {
  id: string; type: MissionType; goal: number; progress: number; done: boolean; points: number;
}
export interface PassRewardView { level: number; reward: PassReward | null; reached: boolean; claimed: boolean; }
export interface PassSnapshot {
  level: number;
  points: number;
  pointsInLevel: number;
  missions: PassMissionView[];
  rewards: PassRewardView[];
  daysLeft: number;
}

/** Level aus Punkten (V7.7: Start bei Level 0, 100 Punkte = 1 Level). */
export function levelForPoints(points: number): number {
  return Math.min(PASS_MAX_LEVEL, Math.floor(points / POINTS_PER_LEVEL));
}

export async function passSnapshot(): Promise<PassSnapshot> {
  await ensureWeek();
  const points = await metaRepo.getMetaNumber('passPoints', 0);
  const level = levelForPoints(points);
  const day = dayOrdinal();
  const progKey = `passMProg:${day}`;
  const doneKey = `passMDone:${day}`;
  let prog: Record<string, number> = {};
  let done: string[] = [];
  try { prog = JSON.parse((await metaRepo.getMeta(progKey)) || '{}'); } catch { prog = {}; }
  try { done = JSON.parse((await metaRepo.getMeta(doneKey)) || '[]'); } catch { done = []; }
  const missions: PassMissionView[] = dailyMissions(day).map((m) => ({
    id: m.id, type: m.type, goal: m.goal,
    progress: Math.min(prog[m.id] ?? 0, m.goal),
    done: done.includes(m.id),
    points: DIFF_POINTS[m.diff],
  }));
  let claimed: number[] = [];
  try { claimed = JSON.parse((await metaRepo.getMeta('passClaimed')) || '[]'); } catch { claimed = []; }
  const wid = weekId();
  const rewards: PassRewardView[] = [];
  for (let l = 1; l <= PASS_MAX_LEVEL; l++) {
    rewards.push({ level: l, reward: rewardForLevel(l, wid), reached: level >= l, claimed: claimed.includes(l) });
  }
  return {
    level, points, pointsInLevel: Math.min(points - level * POINTS_PER_LEVEL, POINTS_PER_LEVEL),
    missions, rewards, daysLeft: daysUntilReset(day),
  };
}

/** Level als abgeholt markieren (Belohnung wird im Store vergeben). */
export async function markClaimed(level: number): Promise<void> {
  let claimed: number[] = [];
  try { claimed = JSON.parse((await metaRepo.getMeta('passClaimed')) || '[]'); } catch { claimed = []; }
  if (!claimed.includes(level)) {
    claimed.push(level);
    await metaRepo.setMeta('passClaimed', JSON.stringify(claimed));
  }
}
