import { LEAGUE, USER_CLUB_ID } from '../domain/constants';
import type { Match, NpcClub, StandingRow } from '../domain/types';
import { generateNpcClubs, generateSchedule } from '../engine/league';
import * as leagueRepo from '../db/repositories/leagueRepo';
import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Saison-Verwaltung: legt NPC-Klubs und den Doppelrunden-Spielplan
 * für die aktuelle Division des Nutzers an.
 */
export async function createSeason(season: number, division: number): Promise<void> {
  await leagueRepo.insertNpcClubs(generateNpcClubs(division, season));
  const npcs = await leagueRepo.getNpcClubs(season);
  const clubIds = [USER_CLUB_ID, ...npcs.map((n) => String(n.id))];
  await leagueRepo.insertMatches(generateSchedule(clubIds, season, division));
  await metaRepo.setMeta('season', String(season));
  await metaRepo.setMeta('round', '1');
  await metaRepo.setMeta('nextMatchAt', String(Date.now()));
}

export interface LeagueData {
  season: number;
  round: number;
  nextMatchAt: number;
  npcs: NpcClub[];
  matches: Match[];
}

export async function loadLeagueData(): Promise<LeagueData> {
  const season = await metaRepo.getMetaNumber('season', 1);
  const round = await metaRepo.getMetaNumber('round', 1);
  const nextMatchAt = await metaRepo.getMetaNumber('nextMatchAt', 0);
  const npcs = await leagueRepo.getNpcClubs(season);
  const matches = await leagueRepo.getMatches(season);
  return { season, round, nextMatchAt, npcs, matches };
}

export function clubList(
  npcs: NpcClub[],
  userName: string,
  userCrest: string,
): Array<{ clubId: string; name: string; crest: string }> {
  return [
    { clubId: USER_CLUB_ID, name: userName, crest: userCrest },
    ...npcs.map((n) => ({ clubId: String(n.id), name: n.name, crest: n.crest })),
  ];
}

export function seasonFinished(round: number): boolean {
  return round > LEAGUE.roundsPerSeason;
}

export function userRank(standings: StandingRow[]): number {
  return standings.findIndex((r) => r.clubId === USER_CLUB_ID) + 1;
}
