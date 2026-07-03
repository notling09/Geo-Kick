import type { OwnedPlayer, PoolPlayer } from '../../domain/types';
import { getDb } from '../database';

interface PoolRow {
  id: number;
  name: string;
  position: string;
  rarity: string;
  tempo: number;
  technik: number;
  abschluss: number;
  verteidigung: number;
  kondition: number;
  isStarterChoice: number;
  isFiller: number;
}

function toPoolPlayer(row: PoolRow): PoolPlayer {
  return {
    id: row.id,
    name: row.name,
    position: row.position as PoolPlayer['position'],
    rarity: row.rarity as PoolPlayer['rarity'],
    tempo: row.tempo,
    technik: row.technik,
    abschluss: row.abschluss,
    verteidigung: row.verteidigung,
    kondition: row.kondition,
    isStarterChoice: row.isStarterChoice === 1,
    isFiller: row.isFiller === 1,
  };
}

export async function insertPoolPlayers(players: Array<Omit<PoolPlayer, 'id'>>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const p of players) {
      await db.runAsync(
        `INSERT INTO player_pool
           (name, position, rarity, tempo, technik, abschluss, verteidigung, kondition, isStarterChoice, isFiller)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.name, p.position, p.rarity, p.tempo, p.technik, p.abschluss,
        p.verteidigung, p.kondition, p.isStarterChoice ? 1 : 0, p.isFiller ? 1 : 0,
      );
    }
  });
}

export async function getPool(): Promise<PoolPlayer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PoolRow>('SELECT * FROM player_pool');
  return rows.map(toPoolPlayer);
}

/**
 * Gleicht die Namen der drei Starter-Identitäten an die aktuelle Liste an
 * (für Installationen, deren Pool vor einer Namensänderung geseedet wurde).
 */
export async function syncStarterNames(names: string[]): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM player_pool WHERE isStarterChoice = 1 ORDER BY id',
  );
  for (let i = 0; i < rows.length && i < names.length; i++) {
    if (rows[i].name !== names[i]) {
      await db.runAsync('UPDATE player_pool SET name = ? WHERE id = ?', names[i], rows[i].id);
    }
  }
}

export async function getStarterChoices(): Promise<PoolPlayer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PoolRow>(
    'SELECT * FROM player_pool WHERE isStarterChoice = 1',
  );
  return rows.map(toPoolPlayer);
}

interface OwnedRow extends PoolRow {
  ownedId: number;
  poolId: number;
  level: number;
  acquiredAt: number;
}

function toOwned(row: OwnedRow): OwnedPlayer {
  return {
    id: row.ownedId,
    poolId: row.poolId,
    level: row.level,
    acquiredAt: row.acquiredAt,
    pool: toPoolPlayer({ ...row, id: row.poolId }),
  };
}

export async function getOwnedPlayers(): Promise<OwnedPlayer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OwnedRow>(
    `SELECT p.id AS ownedId, p.poolId, p.level, p.acquiredAt,
            pp.id, pp.name, pp.position, pp.rarity, pp.tempo, pp.technik,
            pp.abschluss, pp.verteidigung, pp.kondition, pp.isStarterChoice, pp.isFiller
     FROM players p JOIN player_pool pp ON pp.id = p.poolId`,
  );
  return rows.map(toOwned);
}

export async function addOwnedPlayer(poolId: number): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO players (poolId, level, acquiredAt) VALUES (?, 1, ?)',
    poolId,
    Date.now(),
  );
  return res.lastInsertRowId;
}

export async function setPlayerLevel(playerId: number, level: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE players SET level = ? WHERE id = ?', level, playerId);
}

export async function deleteOwnedPlayer(playerId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM lineup WHERE playerId = ?', playerId);
  await db.runAsync('DELETE FROM players WHERE id = ?', playerId);
}

/** Aufstellung: Slot-Index → playerId (11 Slots). */
export async function getLineup(): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ slot: number; playerId: number | null }>(
    'SELECT slot, playerId FROM lineup',
  );
  const map = new Map<number, number>();
  rows.forEach((r) => {
    if (r.playerId !== null) map.set(r.slot, r.playerId);
  });
  return map;
}

export async function setLineupSlot(slot: number, playerId: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO lineup (slot, playerId) VALUES (?, ?) ON CONFLICT(slot) DO UPDATE SET playerId = excluded.playerId',
    slot,
    playerId,
  );
}

export async function replaceLineup(entries: Array<[number, number | null]>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM lineup');
    for (const [slot, playerId] of entries) {
      await db.runAsync('INSERT INTO lineup (slot, playerId) VALUES (?, ?)', slot, playerId);
    }
  });
}
