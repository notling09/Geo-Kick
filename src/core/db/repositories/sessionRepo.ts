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
     FROM sessions WHERE endTime IS NOT NULL`,
  );
  return {
    totalSessions: row?.totalSessions ?? 0,
    totalCoins: row?.totalCoins ?? 0,
    distinctSpots: row?.distinctSpots ?? 0,
    totalMinutes: Math.round((row?.totalMs ?? 0) / 60000),
  };
}
