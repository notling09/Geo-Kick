import { CHAMPIONS_LEAGUE, USER_CLUB_ID } from '../domain/constants';
import type { StandingRow } from '../domain/types';
import { CL_TEAM_NAMES } from './names';
import { simulateMatch, type SimTeam } from './matchSim';
import { generateNpcRoster } from './league';
import { pick, randInt, shuffle } from './random';

/**
 * Champions League (V7): eigenständiges Turnier neben der Liga (nur Division 1).
 *  1. Gruppenphase: der Nutzer + 3 Gegner, jeder gegen jeden (3 Spiele für den
 *     Nutzer). Top 2 der Gruppe kommen weiter.
 *  2. K.o.-Phase mit 16 Teams: Achtel-, Viertel-, Halbfinale, Finale (Einzel-
 *     spiele). Der Nutzer spielt seine Partie live, alle anderen werden
 *     simuliert – so läuft das Turnier bis zum Sieger, auch wenn der Nutzer
 *     früh ausscheidet.
 *
 * Persistiert als JSON (clState) im leagueStore/meta; kein Server, keine
 * neue Tabelle.
 */

export type ClStage = 'group' | 'r16' | 'qf' | 'sf' | 'final';
export const KO_STAGES: Exclude<ClStage, 'group'>[] = ['r16', 'qf', 'sf', 'final'];

export interface ClTeam {
  id: string; // USER_CLUB_ID | 'cl-0' … 'cl-18'
  name: string;
  crest: string;
  strength: number;
}

export interface ClMatch {
  stage: ClStage;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  played: boolean;
}

export interface ClState {
  /** Liga-Saison, in der diese CL läuft */
  season: number;
  teams: Record<string, ClTeam>;
  /** Die 4 Gruppen-Teams (inkl. Nutzer) */
  groupIds: string[];
  groupMatches: ClMatch[];
  ko: { r16: ClMatch[]; qf: ClMatch[]; sf: ClMatch[]; final: ClMatch[] };
  /** Wo steht der Nutzer gerade? */
  userStage: ClStage | 'out' | 'champion';
  /** Team-Id des CL-Siegers, sobald das Turnier durch ist */
  champion: string | null;
}

function clRoster(): SimTeam['roster'] {
  return generateNpcRoster();
}

/** Neue CL-Saison anlegen: 20 Teams, 4er-Gruppe mit dem Nutzer, 6 Gruppenspiele. */
export function createClState(
  season: number,
  user: { strength: number; name: string; crest: string },
): ClState {
  const [minS, maxS] = CHAMPIONS_LEAGUE.strengthRange;
  const names = shuffle(CL_TEAM_NAMES).slice(0, 19);
  const teams: Record<string, ClTeam> = {
    [USER_CLUB_ID]: { id: USER_CLUB_ID, name: user.name, crest: user.crest, strength: user.strength },
  };
  names.forEach((name, i) => {
    teams[`cl-${i}`] = {
      id: `cl-${i}`,
      name,
      crest: `crest-${randInt(0, 9)}`,
      strength: randInt(minS, maxS),
    };
  });

  // Gruppe: Nutzer + 3 zufällige CL-Teams
  const others = shuffle(Object.keys(teams).filter((id) => id !== USER_CLUB_ID));
  const groupIds = [USER_CLUB_ID, ...others.slice(0, CHAMPIONS_LEAGUE.groupSize - 1)];

  // 6 Gruppenspiele (jeder gegen jeden), Reihenfolge: erst die Nutzer-Spiele
  const groupMatches: ClMatch[] = [];
  const npc = groupIds.filter((id) => id !== USER_CLUB_ID);
  npc.forEach((oppId) => {
    groupMatches.push(mkMatch('group', USER_CLUB_ID, oppId));
  });
  for (let i = 0; i < npc.length; i++) {
    for (let j = i + 1; j < npc.length; j++) {
      groupMatches.push(mkMatch('group', npc[i], npc[j]));
    }
  }

  return {
    season,
    teams,
    groupIds,
    groupMatches,
    ko: { r16: [], qf: [], sf: [], final: [] },
    userStage: 'group',
    champion: null,
  };
}

function mkMatch(stage: ClStage, homeId: string, awayId: string): ClMatch {
  return { stage, homeId, awayId, homeGoals: 0, awayGoals: 0, played: false };
}

function toSim(team: ClTeam): SimTeam {
  return { name: team.name, strength: team.strength, tactic: 'ausgewogen', roster: clRoster() };
}

/** Ein CL-Spiel simulieren und Tore eintragen (kein Ticker – nur Ergebnis). */
function simulate(state: ClState, m: ClMatch): void {
  const r = simulateMatch(toSim(state.teams[m.homeId]), toSim(state.teams[m.awayId]));
  // Kein Remis im K.o.: bei Gleichstand entscheidet ein knapper Zufalls-Ausgang
  let hg = r.homeGoals;
  let ag = r.awayGoals;
  if (m.stage !== 'group' && hg === ag) {
    if (Math.random() < 0.5) hg++;
    else ag++;
  }
  m.homeGoals = hg;
  m.awayGoals = ag;
  m.played = true;
}

/** Tabelle der 4er-Gruppe. */
export function groupStandings(state: ClState): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  state.groupIds.forEach((id) => {
    const tm = state.teams[id];
    rows.set(id, {
      clubId: id, name: tm.name, crest: tm.crest,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    });
  });
  state.groupMatches.filter((m) => m.played).forEach((m) => {
    const h = rows.get(m.homeId);
    const a = rows.get(m.awayId);
    if (!h || !a) return;
    h.played++; a.played++;
    h.goalsFor += m.homeGoals; h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals; a.goalsAgainst += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { h.won++; a.lost++; h.points += 3; }
    else if (m.homeGoals < m.awayGoals) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  });
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );
}

/** Das nächste ungespielte Nutzer-Spiel (Gruppe oder K.o.), falls vorhanden. */
export function nextUserClMatch(state: ClState): ClMatch | null {
  const involvesUser = (m: ClMatch) => m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID;
  const open = state.groupMatches.find((m) => involvesUser(m) && !m.played);
  if (open) return open;
  for (const stage of KO_STAGES) {
    const koOpen = state.ko[stage].find((m) => involvesUser(m) && !m.played);
    if (koOpen) return koOpen;
  }
  return null;
}

/** Baut die Achtelfinal-Paarungen: die 2 Gruppen-Überlebenden + 14 gesetzte Teams. */
function buildR16(state: ClState): void {
  const table = groupStandings(state);
  const advancing = table.slice(0, CHAMPIONS_LEAGUE.advancePerGroup).map((r) => r.clubId);
  const groupSet = new Set(state.groupIds);
  const seeded = Object.keys(state.teams).filter((id) => !groupSet.has(id));
  const koTeams = shuffle([...advancing, ...shuffle(seeded).slice(0, CHAMPIONS_LEAGUE.koTeams - advancing.length)]);
  state.ko.r16 = pairUp('r16', koTeams);
  state.userStage = advancing.includes(USER_CLUB_ID) ? 'r16' : 'out';
}

/** Paart eine Team-Liste zu Einzelspielen. */
function pairUp(stage: ClStage, ids: string[]): ClMatch[] {
  const matches: ClMatch[] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    matches.push(mkMatch(stage, ids[i], ids[i + 1]));
  }
  return matches;
}

/** Sieger einer Runde (played-Spiele) in Reihenfolge. */
function winners(matches: ClMatch[]): string[] {
  return matches.map((m) => (m.homeGoals >= m.awayGoals ? m.homeId : m.awayId));
}

/**
 * Nach einem eingetragenen Ergebnis den Turnierbaum vorantreiben: NPC-Spiele
 * der aktuellen Runde simulieren, dann – wenn die Runde komplett ist – die
 * nächste erzeugen und den Nutzer-Status aktualisieren. Läuft bis zum
 * nächsten offenen Nutzer-Spiel oder bis zum Champion.
 */
export function advanceCl(state: ClState): void {
  const involvesUser = (m: ClMatch) => m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID;
  const userAlive = state.userStage !== 'out' && state.userStage !== 'champion';

  // Gruppenphase
  if (state.ko.r16.length === 0) {
    // NPC-Gruppenspiele simulieren, sobald der Nutzer seine 3 gespielt hat
    const userGroupOpen = state.groupMatches.some((m) => involvesUser(m) && !m.played);
    if (userGroupOpen) return; // erst spielt der Nutzer weiter
    state.groupMatches.filter((m) => !m.played).forEach((m) => simulate(state, m));
    buildR16(state);
  }

  // K.o.-Runden
  for (let s = 0; s < KO_STAGES.length; s++) {
    const stage = KO_STAGES[s];
    const round = state.ko[stage];
    if (round.length === 0) break;

    // Nutzer lebt noch und hat in dieser Runde ein offenes Spiel → warten
    const userOpenHere = round.some((m) => involvesUser(m) && !m.played);
    if (userOpenHere && userAlive) return;

    // Alle anderen (bzw. bei ausgeschiedenem Nutzer: alle) Spiele simulieren
    round.filter((m) => !m.played).forEach((m) => simulate(state, m));

    // Ist der Nutzer in dieser Runde ausgeschieden?
    if (userAlive) {
      const userMatch = round.find(involvesUser);
      if (userMatch) {
        const userWon =
          (userMatch.homeId === USER_CLUB_ID && userMatch.homeGoals >= userMatch.awayGoals) ||
          (userMatch.awayId === USER_CLUB_ID && userMatch.awayGoals >= userMatch.homeGoals);
        if (!userWon) state.userStage = 'out';
      }
    }

    // Nächste Runde erzeugen (oder Champion küren)
    const advancing = winners(round);
    if (stage === 'final') {
      state.champion = advancing[0] ?? null;
      if (state.champion === USER_CLUB_ID) state.userStage = 'champion';
      return;
    }
    const nextStage = KO_STAGES[s + 1];
    if (state.ko[nextStage].length === 0) {
      state.ko[nextStage] = pairUp(nextStage, shuffle(advancing));
      // userStage auf die nächste Runde heben, falls der Nutzer weiter ist
      if (state.userStage !== 'out' && advancing.includes(USER_CLUB_ID)) {
        state.userStage = nextStage;
      }
    }
  }
}

/** Nutzer-Ergebnis in die CL eintragen und den Baum vorantreiben. */
export function applyUserClResult(state: ClState, homeGoals: number, awayGoals: number): void {
  const m = nextUserClMatch(state);
  if (!m) return;
  m.homeGoals = homeGoals;
  m.awayGoals = awayGoals;
  m.played = true;
  advanceCl(state);
}

/** Ist der Nutzer gerade dran (nächstes CL-Spiel für ihn offen)? */
export function userHasClMatch(state: ClState): boolean {
  return nextUserClMatch(state) !== null;
}

/** Belohnung (Coins) für einen Nutzer-Sieg in der gegebenen Runde. */
export function clWinReward(stage: ClStage): number {
  return CHAMPIONS_LEAGUE.winReward[stage] ?? 0;
}
