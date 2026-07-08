import type { Match, MatchEvent, NpcClub } from '../../domain/types';
import { getDb } from '../database';

interface NpcRow {
  id: number;
  name: string;
  crest: string;
  strength: number;
  division: number;
  season: number;
  rosterJson: string;
}

function toNpcClub(row: NpcRow): NpcClub {
  let roster: NpcClub['roster'] = [];
  try {
    roster = JSON.parse(row.rosterJson) as NpcClub['roster'];
  } catch {
    roster = [];
  }
  return { ...row, roster };
}

export async function getNpcClubs(season: number): Promise<NpcClub[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<NpcRow>('SELECT * FROM npc_clubs WHERE season = ?', season);
  return rows.map(toNpcClub);
}

export async function insertNpcClubs(clubs: Array<Omit<NpcClub, 'id'>>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const c of clubs) {
      await db.runAsync(
        'INSERT INTO npc_clubs (name, crest, strength, division, season, rosterJson) VALUES (?, ?, ?, ?, ?, ?)',
        c.name, c.crest, c.strength, c.division, c.season, JSON.stringify(c.roster),
      );
    }
  });
}

/** Nachträglich einen Kader setzen (Migration bestehender NPC-Klubs). */
export async function setNpcRoster(id: number, roster: NpcClub['roster']): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE npc_clubs SET rosterJson = ? WHERE id = ?', JSON.stringify(roster), id);
}

interface MatchRow {
  id: number;
  season: number;
  division: number;
  round: number;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  played: number;
  eventsJson: string;
}

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    season: row.season,
    division: row.division,
    round: row.round,
    homeId: row.homeId,
    awayId: row.awayId,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    played: row.played === 1,
    events: JSON.parse(row.eventsJson) as MatchEvent[],
  };
}

export async function getMatches(season: number): Promise<Match[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MatchRow>(
    'SELECT * FROM matches WHERE season = ? ORDER BY round, id',
    season,
  );
  return rows.map(toMatch);
}

export async function insertMatches(matches: Array<Omit<Match, 'id'>>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const m of matches) {
      await db.runAsync(
        `INSERT INTO matches (season, division, round, homeId, awayId, homeGoals, awayGoals, played, eventsJson)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, '[]')`,
        m.season, m.division, m.round, m.homeId, m.awayId,
      );
    }
  });
}

/** Anzahl gewonnener Nutzer-Spiele über alle Saisons (für Erfolge). */
export async function countUserWins(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ wins: number }>(
    `SELECT COUNT(*) AS wins FROM matches
     WHERE played = 1 AND (
       (homeId = 'user' AND homeGoals > awayGoals) OR
       (awayId = 'user' AND awayGoals > homeGoals)
     )`,
  );
  return row?.wins ?? 0;
}

export async function saveMatchResult(
  matchId: number,
  homeGoals: number,
  awayGoals: number,
  events: MatchEvent[],
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE matches SET homeGoals = ?, awayGoals = ?, played = 1, eventsJson = ? WHERE id = ?',
    homeGoals, awayGoals, JSON.stringify(events), matchId,
  );
}
