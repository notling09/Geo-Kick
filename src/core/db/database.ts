import * as SQLite from 'expo-sqlite';

/**
 * Lokale SQLite-Datenbank (Kapitel 5.2): Version 1 läuft komplett offline.
 * Die Repositories in ./repositories kapseln alle Zugriffe, damit später
 * bei Bedarf ein Backend hinter derselben Schnittstelle ergänzt werden kann.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  // Promise statt Instanz merken: parallele Erst-Aufrufe beim App-Start
  // öffnen sonst zwei Verbindungen und migrieren doppelt
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('geokick.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Transaktionen serialisieren (V6.3): expo-sqlite sperrt die Verbindung bei
 * withTransactionAsync NICHT – überlappen sich zwei Transaktionen (z. B.
 * OSM-Platz-Import und Liga-Simulation), wirft die zweite "cannot start a
 * transaction within a transaction" und die Buttons wirken bis zum Neustart
 * tot. Diese Warteschlange lässt immer nur eine Transaktion gleichzeitig zu.
 */
let txQueue: Promise<unknown> = Promise.resolve();

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = txQueue.then(fn, fn);
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const SCHEMA_VERSION = 2;

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  // V2: NPC-Klubs bekommen persistente Kader (für Torschützenlisten)
  if (current === 1) {
    await database.execAsync(`
      ALTER TABLE npc_clubs ADD COLUMN rosterJson TEXT NOT NULL DEFAULT '[]';
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
    return;
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      rarity TEXT NOT NULL,
      tempo INTEGER NOT NULL,
      technik INTEGER NOT NULL,
      abschluss INTEGER NOT NULL,
      verteidigung INTEGER NOT NULL,
      kondition INTEGER NOT NULL,
      isStarterChoice INTEGER NOT NULL DEFAULT 0,
      isFiller INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poolId INTEGER NOT NULL REFERENCES player_pool(id),
      level INTEGER NOT NULL DEFAULT 1,
      acquiredAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lineup (
      slot INTEGER PRIMARY KEY,
      playerId INTEGER REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS spots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      source TEXT NOT NULL,
      cooldownUntil INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotId TEXT NOT NULL REFERENCES spots(id),
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      coins INTEGER NOT NULL DEFAULT 0,
      packGranted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt INTEGER NOT NULL,
      openedAt INTEGER,
      source TEXT NOT NULL,
      contentJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS npc_clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      crest TEXT NOT NULL,
      strength INTEGER NOT NULL,
      division INTEGER NOT NULL,
      season INTEGER NOT NULL,
      rosterJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season INTEGER NOT NULL,
      division INTEGER NOT NULL,
      round INTEGER NOT NULL,
      homeId TEXT NOT NULL,
      awayId TEXT NOT NULL,
      homeGoals INTEGER NOT NULL DEFAULT 0,
      awayGoals INTEGER NOT NULL DEFAULT 0,
      played INTEGER NOT NULL DEFAULT 0,
      eventsJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_matches_season_round ON matches(season, round);
    CREATE INDEX IF NOT EXISTS idx_players_pool ON players(poolId);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

/** Nur für Entwicklungszwecke: kompletter Reset. */
export async function resetDatabase(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    DELETE FROM meta; DELETE FROM player_pool; DELETE FROM players;
    DELETE FROM lineup; DELETE FROM spots; DELETE FROM sessions;
    DELETE FROM packs; DELETE FROM npc_clubs; DELETE FROM matches;
  `);
}
