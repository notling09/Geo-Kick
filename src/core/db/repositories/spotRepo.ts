import type { Spot } from '../../domain/types';
import { getDb } from '../database';

interface SpotRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  source: string;
  cooldownUntil: number;
}

function toSpot(row: SpotRow): Spot {
  return { ...row, source: row.source as Spot['source'] };
}

export async function getSpots(): Promise<Spot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpotRow>('SELECT * FROM spots');
  return rows.map(toSpot);
}

/** Migration (V5): gespeicherte Plätze auf den neuen Mindestradius anheben. */
export async function raiseMinRadius(minRadius: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE spots SET radius = ? WHERE radius < ?', minRadius, minRadius);
}

/** OSM-Spots einfügen/aktualisieren, ohne den Cooldown zu überschreiben. */
export async function upsertOsmSpots(
  spots: Array<Omit<Spot, 'cooldownUntil'>>,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const s of spots) {
      await db.runAsync(
        `INSERT INTO spots (id, name, latitude, longitude, radius, source, cooldownUntil)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, latitude = excluded.latitude,
           longitude = excluded.longitude, radius = excluded.radius`,
        s.id, s.name, s.latitude, s.longitude, s.radius, s.source,
      );
    }
  });
}

export async function addUserSpot(spot: Omit<Spot, 'cooldownUntil'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO spots (id, name, latitude, longitude, radius, source, cooldownUntil) VALUES (?, ?, ?, ?, ?, ?, 0)',
    spot.id, spot.name, spot.latitude, spot.longitude, spot.radius, spot.source,
  );
}

export async function setSpotCooldown(spotId: string, until: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE spots SET cooldownUntil = ? WHERE id = ?', until, spotId);
}
