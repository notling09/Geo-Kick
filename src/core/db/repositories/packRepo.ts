import type { Pack } from '../../domain/types';
import { getDb } from '../database';

interface PackRow {
  id: number;
  createdAt: number;
  openedAt: number | null;
  source: string;
  contentJson: string;
}

function toPack(row: PackRow): Pack {
  return {
    id: row.id,
    createdAt: row.createdAt,
    openedAt: row.openedAt,
    source: row.source as Pack['source'],
    content: JSON.parse(row.contentJson) as number[],
  };
}

export async function getPacks(): Promise<Pack[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PackRow>('SELECT * FROM packs ORDER BY createdAt DESC');
  return rows.map(toPack);
}

export async function addPack(source: Pack['source']): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO packs (createdAt, source) VALUES (?, ?)',
    Date.now(),
    source,
  );
  return res.lastInsertRowId;
}

export async function markPackOpened(packId: number, poolIds: number[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE packs SET openedAt = ?, contentJson = ? WHERE id = ?',
    Date.now(),
    JSON.stringify(poolIds),
    packId,
  );
}
