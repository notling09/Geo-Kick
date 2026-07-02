import { LEAGUE, USER_CLUB_ID } from '../domain/constants';
import type { Match, NpcClub, StandingRow } from '../domain/types';
import { NPC_CLUB_PLACES, NPC_CLUB_PREFIXES, NPC_CRESTS } from './names';
import { pick, randInt, shuffle } from './random';

/** Erzeugt 7 NPC-Klubs für die angegebene Division (Kapitel 3.4). */
export function generateNpcClubs(division: number, season: number): Array<Omit<NpcClub, 'id'>> {
  const [minS, maxS] = LEAGUE.npcStrengthByDivision[division];
  const usedNames = new Set<string>();
  const clubs: Array<Omit<NpcClub, 'id'>> = [];
  while (clubs.length < LEAGUE.clubsPerDivision - 1) {
    const name = `${pick(NPC_CLUB_PREFIXES)} ${pick(NPC_CLUB_PLACES)}`.replace('- ', ' ');
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    clubs.push({
      name,
      crest: pick(NPC_CRESTS),
      strength: randInt(minS, maxS),
      division,
      season,
    });
  }
  return clubs;
}

/**
 * Doppelrunden-Spielplan (Rundenturnier per Circle-Methode) für 8 Klubs:
 * 14 Spieltage à 4 Spiele. clubIds: 'user' + NPC-Ids als Strings.
 */
export function generateSchedule(
  clubIds: string[],
  season: number,
  division: number,
): Array<Omit<Match, 'id'>> {
  const ids = shuffle(clubIds);
  const n = ids.length;
  const rounds = n - 1;
  const matches: Array<Omit<Match, 'id'>> = [];

  const rotating = ids.slice(1);
  for (let round = 0; round < rounds; round++) {
    const pairings: Array<[string, string]> = [];
    const lineup = [ids[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      // Heimrecht abwechseln, damit es fair bleibt
      pairings.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    pairings.forEach(([homeId, awayId]) => {
      matches.push({
        season,
        division,
        round: round + 1,
        homeId,
        awayId,
        homeGoals: 0,
        awayGoals: 0,
        played: false,
        events: [],
      });
      // Rückrunde mit getauschtem Heimrecht
      matches.push({
        season,
        division,
        round: round + 1 + rounds,
        homeId: awayId,
        awayId: homeId,
        homeGoals: 0,
        awayGoals: 0,
        played: false,
        events: [],
      });
    });
    rotating.push(rotating.shift() as string);
  }
  return matches;
}

/** Tabelle aus gespielten Matches berechnen (3/1/0 Punkte). */
export function computeStandings(
  matches: Match[],
  clubs: Array<{ clubId: string; name: string; crest: string }>,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  clubs.forEach((c) =>
    rows.set(c.clubId, {
      clubId: c.clubId,
      name: c.name,
      crest: c.crest,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    }),
  );

  matches
    .filter((m) => m.played)
    .forEach((m) => {
      const home = rows.get(m.homeId);
      const away = rows.get(m.awayId);
      if (!home || !away) return;
      home.played++;
      away.played++;
      home.goalsFor += m.homeGoals;
      home.goalsAgainst += m.awayGoals;
      away.goalsFor += m.awayGoals;
      away.goalsAgainst += m.homeGoals;
      if (m.homeGoals > m.awayGoals) {
        home.won++;
        away.lost++;
        home.points += 3;
      } else if (m.homeGoals < m.awayGoals) {
        away.won++;
        home.lost++;
        away.points += 3;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    });

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );
}

export interface SeasonOutcome {
  /** Neue Division des Nutzers nach Auf-/Abstieg */
  newDivision: number;
  promoted: boolean;
  relegated: boolean;
  finalRank: number;
}

/** Saisonabschluss: Top 2 steigen auf (bis Div. 1), letzte 2 steigen ab (bis Div. 4). */
export function resolveSeason(standings: StandingRow[], currentDivision: number): SeasonOutcome {
  const rank = standings.findIndex((r) => r.clubId === USER_CLUB_ID) + 1;
  let newDivision = currentDivision;
  let promoted = false;
  let relegated = false;
  if (rank <= LEAGUE.promotionSpots && currentDivision > 1) {
    newDivision = currentDivision - 1;
    promoted = true;
  } else if (rank > LEAGUE.clubsPerDivision - LEAGUE.relegationSpots && currentDivision < LEAGUE.divisions) {
    newDivision = currentDivision + 1;
    relegated = true;
  }
  return { newDivision, promoted, relegated, finalRank: rank };
}
