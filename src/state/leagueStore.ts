import { create } from 'zustand';
import { BALANCING, LEAGUE, USER_CLUB_ID } from '../core/domain/constants';
import type { Match, NpcClub, StandingRow, Tactic } from '../core/domain/types';
import { computeStandings, resolveSeason } from '../core/engine/league';
import { simulateMatch, type SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import * as leagueRepo from '../core/db/repositories/leagueRepo';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { clubList, createSeason, loadLeagueData, seasonFinished } from '../core/services/seasonService';
import { useGameStore } from './gameStore';
import { pick } from '../core/engine/random';

/**
 * Liga-Zustand: Spielplan, Tabelle, Spieltakt (1 Spiel / 24 h) und
 * Saisonwechsel mit Auf-/Abstieg (Kapitel 3.4).
 */

export interface PlayedUserMatch {
  match: Match;
  homeName: string;
  awayName: string;
  homeCrest: string;
  awayCrest: string;
  userIsHome: boolean;
}

interface LeagueStateStore {
  season: number;
  round: number;
  nextMatchAt: number;
  npcs: NpcClub[];
  matches: Match[];
  standings: StandingRow[];
  /** Meldung nach Saisonende (Aufstieg/Abstieg), bis sie quittiert wird */
  seasonMessage: string | null;
  /** Zuletzt gespieltes Nutzer-Match für die Live-Ansicht */
  lastPlayedMatch: PlayedUserMatch | null;

  hydrate: () => Promise<void>;
  matchReady: () => boolean;
  msUntilNextMatch: () => number;
  /** Simuliert den kompletten Spieltag und persistiert ihn; Live-Ansicht spielt danach ab. */
  playUserMatchday: (tactic: Tactic) => Promise<PlayedUserMatch | null>;
  acknowledgeSeasonMessage: () => Promise<void>;
  clubName: (clubId: string) => string;
  clubCrest: (clubId: string) => string;
}

function recomputeStandings(
  matches: Match[],
  npcs: NpcClub[],
): StandingRow[] {
  const club = useGameStore.getState().club;
  return computeStandings(
    matches,
    clubList(npcs, club?.name ?? 'Mein Klub', club?.crest ?? '⚽'),
  );
}

export const useLeagueStore = create<LeagueStateStore>((set, get) => ({
  season: 1,
  round: 1,
  nextMatchAt: 0,
  npcs: [],
  matches: [],
  standings: [],
  seasonMessage: null,
  lastPlayedMatch: null,

  hydrate: async () => {
    const data = await loadLeagueData();
    const seasonMessage = await metaRepo.getMeta('seasonMessage');
    set({
      season: data.season,
      round: data.round,
      nextMatchAt: data.nextMatchAt,
      npcs: data.npcs,
      matches: data.matches,
      standings: recomputeStandings(data.matches, data.npcs),
      seasonMessage: seasonMessage || null,
    });
  },

  matchReady: () => {
    const { round, nextMatchAt } = get();
    return !seasonFinished(round) && Date.now() >= nextMatchAt;
  },

  msUntilNextMatch: () => Math.max(0, get().nextMatchAt - Date.now()),

  playUserMatchday: async (tactic) => {
    const { round, season, npcs, matches } = get();
    if (!get().matchReady()) return null;

    const game = useGameStore.getState();
    const club = game.club;
    if (!club) return null;
    await game.setTactic(tactic);

    const npcById = new Map(npcs.map((n) => [String(n.id), n]));
    const nameOf = (id: string) => (id === USER_CLUB_ID ? club.name : npcById.get(id)?.name ?? '?');
    const crestOf = (id: string) => (id === USER_CLUB_ID ? club.crest : npcById.get(id)?.crest ?? '❓');

    const userStrength = teamStrength(game.lineupPlayers(), club.formation);
    const npcTactics: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

    const simTeamFor = (clubId: string, teamTactic: Tactic): SimTeam => ({
      name: nameOf(clubId),
      strength: clubId === USER_CLUB_ID ? userStrength : npcById.get(clubId)?.strength ?? 400,
      tactic: teamTactic,
    });

    // Alle Spiele der Runde simulieren und speichern (Nutzer-Match zuerst gemerkt)
    const roundMatches = matches.filter((m) => m.round === round && !m.played);
    let userMatch: Match | null = null;
    for (const m of roundMatches) {
      const isUserMatch = m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID;
      const homeTactic = m.homeId === USER_CLUB_ID ? tactic : pick(npcTactics);
      const awayTactic = m.awayId === USER_CLUB_ID ? tactic : pick(npcTactics);
      const result = simulateMatch(simTeamFor(m.homeId, homeTactic), simTeamFor(m.awayId, awayTactic));
      await leagueRepo.saveMatchResult(m.id, result.homeGoals, result.awayGoals, result.events);
      if (isUserMatch) {
        userMatch = { ...m, homeGoals: result.homeGoals, awayGoals: result.awayGoals, played: true, events: result.events };
      }
    }

    // Spieltakt fortschreiben (Kapitel 8: 1 Spiel pro 24 h)
    const newRound = round + 1;
    await metaRepo.setMeta('round', String(newRound));
    await metaRepo.setMeta('nextMatchAt', String(Date.now() + BALANCING.matchIntervalMs));

    let updatedMatches = await leagueRepo.getMatches(season);
    let updatedNpcs = npcs;
    let updatedSeason = season;
    let updatedRound = newRound;

    // Saisonende: Auf-/Abstieg auflösen und neue Saison anlegen
    if (seasonFinished(newRound)) {
      const finalStandings = recomputeStandings(updatedMatches, npcs);
      const outcome = resolveSeason(finalStandings, club.division);
      let message = `Saison ${season} beendet – Platz ${outcome.finalRank}.`;
      if (outcome.promoted) message += ` Aufstieg in Division ${outcome.newDivision}! 🎉`;
      else if (outcome.relegated) message += ` Abstieg in Division ${outcome.newDivision}.`;
      else message += ` Du bleibst in Division ${club.division}.`;
      await metaRepo.setMeta('seasonMessage', message);
      await metaRepo.setMeta('division', String(outcome.newDivision));

      updatedSeason = season + 1;
      await createSeason(updatedSeason, outcome.newDivision);
      updatedMatches = await leagueRepo.getMatches(updatedSeason);
      updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);
      updatedRound = 1;

      useGameStore.setState((s) => ({
        club: s.club ? { ...s.club, division: outcome.newDivision } : s.club,
      }));
      set({ seasonMessage: message });
    }

    const played: PlayedUserMatch | null = userMatch
      ? {
          match: userMatch,
          homeName: nameOf(userMatch.homeId),
          awayName: nameOf(userMatch.awayId),
          homeCrest: crestOf(userMatch.homeId),
          awayCrest: crestOf(userMatch.awayId),
          userIsHome: userMatch.homeId === USER_CLUB_ID,
        }
      : null;

    set({
      season: updatedSeason,
      round: updatedRound,
      nextMatchAt: await metaRepo.getMetaNumber('nextMatchAt', 0),
      matches: updatedMatches,
      npcs: updatedNpcs,
      standings: recomputeStandings(updatedMatches, updatedNpcs),
      lastPlayedMatch: played,
    });
    return played;
  },

  acknowledgeSeasonMessage: async () => {
    await metaRepo.setMeta('seasonMessage', '');
    set({ seasonMessage: null });
  },

  clubName: (clubId) => {
    if (clubId === USER_CLUB_ID) return useGameStore.getState().club?.name ?? 'Mein Klub';
    return get().npcs.find((n) => String(n.id) === clubId)?.name ?? '?';
  },

  clubCrest: (clubId) => {
    if (clubId === USER_CLUB_ID) return useGameStore.getState().club?.crest ?? '⚽';
    return get().npcs.find((n) => String(n.id) === clubId)?.crest ?? '❓';
  },
}));

export { LEAGUE };
