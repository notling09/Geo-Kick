import type { Session } from '../../domain/types';
import { getDb } from '../database';

interface SessionRow {
  id: number;
  spotId: string;
  startTime: number;
  endTime: number | null;
  coins: number;
  packGranted: number;
}

function toSession(row: SessionRow): Session {
  return { ...row, packGranted: row.packGranted === 1 };
}

export async function getActiveSession(): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM sessions WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1',
  );
  return row ? toSession(row) : null;
}

/**
 * Verwaiste offene Sessions schließen (entstehen z. B. durch App-Kill oder
 * Dev-Reload während einer aktiven Session). Sie werden ohne Belohnung
 * beendet (endTime = startTime), damit nie mehr als eine Session aktiv ist.
 */
export async function voidOrphanOpenSessions(keepId?: number): Promise<void> {
  const db = await getDb();
  if (keepId !== undefined) {
    await db.runAsync(
      'UPDATE sessions SET endTime = startTime WHERE endTime IS NULL AND id != ?',
      keepId,
    );
  } else {
    await db.runAsync('UPDATE sessions SET endTime = startTime WHERE endTime IS NULL');
  }
}

export async function startSession(spotId: string, startTime: number): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO sessions (spotId, startTime) VALUES (?, ?)',
    spotId,
    startTime,
  );
  return res.lastInsertRowId;
}

export async function finishSession(
  sessionId: number,
  endTime: number,
  coins: number,
  packGranted: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE sessions SET endTime = ?, coins = ?, packGranted = ? WHERE id = ?',
    endTime, coins, packGranted ? 1 : 0, sessionId,
  );
}

/** Anzahl belohnter Sessions an einem Platz (für Erstbesuch-Bonus/Heimplatz). */
export async function countRewardedSessionsAt(spotId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sessions WHERE spotId = ? AND endTime IS NOT NULL AND endTime > startTime AND coins > 0',
    spotId,
  );
  return row?.n ?? 0;
}

export interface VisitedSpot {
  spotId: string;
  name: string;
  visits: number;
  lastVisit: number;
  totalMinutes: number;
}

/** Übersicht besuchter Plätze (Kapitel 3.5), zuletzt besuchte zuerst. */
export async function getVisitedSpots(): Promise<VisitedSpot[]> {
  const db = await getDb();
  return db.getAllAsync<VisitedSpot>(
    `SELECT s.spotId AS spotId, sp.name AS name, COUNT(*) AS visits,
            MAX(s.endTime) AS lastVisit,
            CAST(ROUND(SUM(s.endTime - s.startTime) / 60000.0) AS INTEGER) AS totalMinutes
     FROM sessions s JOIN spots sp ON sp.id = s.spotId
     WHERE s.endTime IS NOT NULL AND s.endTime > s.startTime
     GROUP BY s.spotId
     ORDER BY lastVisit DESC`,
  );
}

export interface SessionStats {
  totalSessions: number;
  totalCoins: number;
  distinctSpots: number;
  totalMinutes: number;
}

export async function getSessionStats(): Promise<SessionStats> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    totalSessions: number;
    totalCoins: number;
    distinctSpots: number;
    totalMs: number;
  }>(
    `SELECT COUNT(*) AS totalSessions,
            COALESCE(SUM(coins), 0) AS totalCoins,
            COUNT(DISTINCT spotId) AS distinctSpots,
            COALESCE(SUM(endTime - startTime), 0) AS totalMs
     FROM sessions WHERE endTime IS NOT NULL AND endTime > startTime`,
  );
  return {
    totalSessions: row?.totalSessions ?? 0,
    totalCoins: row?.totalCoins ?? 0,
    distinctSpots: row?.distinctSpots ?? 0,
    totalMinutes: Math.round((row?.totalMs ?? 0) / 60000),
  };
}
