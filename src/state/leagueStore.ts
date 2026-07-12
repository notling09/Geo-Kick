import { create } from 'zustand';
import { BALANCING, LEAGUE, LEAGUE_REWARDS, USER_CLUB_ID } from '../core/domain/constants';
import type { Match, MatchStats, NpcClub, StandingRow, Tactic } from '../core/domain/types';
import { computeStandings, generateNpcRoster, resolveSeason } from '../core/engine/league';
import { simulateMatch, type MatchMotm, type SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import * as leagueRepo from '../core/db/repositories/leagueRepo';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { clubList, createSeason, loadLeagueData, seasonFinished } from '../core/services/seasonService';
import { useGameStore } from './gameStore';
import { pick } from '../core/engine/random';

/**
 * Liga-Zustand: Spielplan, Tabelle, Spieltakt (1 Spiel / 30 Min) und
 * Saisonwechsel mit Auf-/Abstieg (Kapitel 3.4).
 */

export interface PlayedUserMatch {
  match: Match;
  homeName: string;
  awayName: string;
  homeCrest: string;
  awayCrest: string;
  userIsHome: boolean;
  /** Endstatistik der Simulation (xG, Schüsse, Ballbesitz, Karten, …) */
  stats?: MatchStats;
  /** Liga-Coins für dieses Spiel (V2), inkl. Aufschlüsselung für die Anzeige */
  coinReward?: { total: number; breakdown: string[] };
  /** Man of the Match (V4): Note bis 10 + Kurzbegründung */
  motm?: MatchMotm;
}

/** Saison-Statistik der eigenen Spieler (V4): für den "Spieler der Saison". */
interface SeasonPlayerStat {
  goals: number;
  assists: number;
  ratingSum: number;
  matches: number;
}

/** Ein Spieler ist für genau dieses (Saison, Runde)-Paar gesperrt. */
export interface Suspension {
  playerId: number;
  playerName: string;
  season: number;
  round: number;
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
  /** Gesperrte eigene Spieler (rote Karte → nächstes Ligaspiel aussetzen) */
  suspensions: Suspension[];
  /** Meister-Feier nach Platz 1 am Saisonende (Pokal-Animation) */
  championCelebration: { clubName: string; division: number; captainPlayerId: number | null } | null;
  /**
   * Feier wartet hier, bis der Live-Ticker durchgelaufen ist: das Ergebnis
   * steht zwar sofort fest, gezeigt (und gehört) wird der Pokal aber erst
   * nach dem Spiel (revealCelebration beim Verlassen der Live-Ansicht).
   */
  pendingCelebration: LeagueStateStore['championCelebration'];

  hydrate: () => Promise<void>;
  acknowledgeCelebration: () => void;
  revealCelebration: () => void;
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
    clubList(npcs, club?.name ?? 'My Club', club?.crest ?? 'crest-0'),
  );
}

async function loadSuspensions(): Promise<Suspension[]> {
  const raw = await metaRepo.getMeta('suspensions');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Suspension[];
  } catch {
    return [];
  }
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
  suspensions: [],
  championCelebration: null,
  pendingCelebration: null,

  acknowledgeCelebration: () => set({ championCelebration: null }),

  revealCelebration: () =>
    set((s) =>
      s.pendingCelebration
        ? { championCelebration: s.pendingCelebration, pendingCelebration: null }
        : {},
    ),

  hydrate: async () => {
    const data = await loadLeagueData();
    const seasonMessage = await metaRepo.getMeta('seasonMessage');
    // Migration: falls ein alter Spielstand noch einen längeren Takt (24 h)
    // gespeichert hat, auf das aktuelle Intervall abklemmen
    let nextMatchAt = data.nextMatchAt;
    const maxNext = Date.now() + BALANCING.matchIntervalMs;
    if (nextMatchAt > maxNext) {
      nextMatchAt = maxNext;
      await metaRepo.setMeta('nextMatchAt', String(nextMatchAt));
    }
    set({
      season: data.season,
      round: data.round,
      nextMatchAt,
      npcs: data.npcs,
      matches: data.matches,
      standings: recomputeStandings(data.matches, data.npcs),
      seasonMessage: seasonMessage || null,
      suspensions: await loadSuspensions(),
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
    const crestOf = (id: string) => (id === USER_CLUB_ID ? club.crest : npcById.get(id)?.crest ?? 'crest-0');

    // Gesperrte Spieler (rote Karte letzte Runde) spielen dieses Mal nicht mit:
    // sie zählen weder zur Teamstärke noch zum Ticker-Kader
    const activeSuspensions = get().suspensions.filter(
      (s) => s.season === season && s.round === round,
    );
    const suspendedIds = new Set(activeSuspensions.map((s) => s.playerId));
    const lineupPlayers = game
      .lineupPlayers()
      .map((p) => (p && suspendedIds.has(p.id) ? null : p));
    const userStrength = teamStrength(lineupPlayers, club.formation);
    // Aufgestellte Spieler für namentliche Ticker-Events (Torschütze usw.)
    const userRoster = lineupPlayers
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ name: p.pool.name, position: p.pool.position }));
    const npcTactics: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

    // NPC-Kader sicherstellen (Migration: vor V2 angelegte Klubs haben keinen)
    for (const npc of npcs) {
      if (!npc.roster || npc.roster.length === 0) {
        npc.roster = generateNpcRoster();
        await leagueRepo.setNpcRoster(npc.id, npc.roster);
      }
    }

    const simTeamFor = (clubId: string, teamTactic: Tactic): SimTeam => ({
      name: nameOf(clubId),
      strength: clubId === USER_CLUB_ID ? userStrength : npcById.get(clubId)?.strength ?? 400,
      tactic: teamTactic,
      roster: clubId === USER_CLUB_ID ? userRoster : npcById.get(clubId)?.roster,
    });

    // Alle Spiele der Runde simulieren und speichern (Nutzer-Match zuerst gemerkt)
    const roundMatches = matches.filter((m) => m.round === round && !m.played);
    let userMatch: Match | null = null;
    let userStats: MatchStats | undefined;
    let userMotm: MatchMotm | undefined;
    for (const m of roundMatches) {
      const isUserMatch = m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID;
      const homeTactic = m.homeId === USER_CLUB_ID ? tactic : pick(npcTactics);
      const awayTactic = m.awayId === USER_CLUB_ID ? tactic : pick(npcTactics);
      const result = simulateMatch(simTeamFor(m.homeId, homeTactic), simTeamFor(m.awayId, awayTactic));
      await leagueRepo.saveMatchResult(m.id, result.homeGoals, result.awayGoals, result.events);
      if (isUserMatch) {
        userMatch = { ...m, homeGoals: result.homeGoals, awayGoals: result.awayGoals, played: true, events: result.events };
        userStats = result.stats;
        userMotm = result.motm;
      }
    }

    // Saison-Statistik der eigenen Elf fortschreiben (V4): Tore, Assists und
    // eine Spielnote je Einsatz – Grundlage für den "Spieler der Saison"
    if (userMatch) {
      const userSide = userMatch.homeId === USER_CLUB_ID ? 'home' : 'away';
      const userGoalsFor = userSide === 'home' ? userMatch.homeGoals : userMatch.awayGoals;
      const userGoalsAgainst = userSide === 'home' ? userMatch.awayGoals : userMatch.homeGoals;
      const resultBonus =
        userGoalsFor > userGoalsAgainst ? 0.4 : userGoalsFor === userGoalsAgainst ? 0.1 : -0.3;
      let seasonStats: Record<string, SeasonPlayerStat> = {};
      try {
        seasonStats = JSON.parse((await metaRepo.getMeta('seasonSquadStats')) || '{}');
      } catch {
        seasonStats = {};
      }
      const xi = lineupPlayers.filter((p): p is NonNullable<typeof p> => p !== null);
      for (const p of xi) {
        const name = p.pool.name;
        const goals = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.player === name,
        ).length;
        const assists = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.assist === name,
        ).length;
        const cleanSheetBonus =
          userGoalsAgainst === 0 && (p.pool.position === 'TW' || p.pool.position === 'ABW')
            ? 0.6
            : 0;
        const rating = Math.min(
          10,
          Math.max(4, 6.5 + goals * 1.2 + assists * 0.6 + resultBonus + cleanSheetBonus),
        );
        const entry = seasonStats[name] ?? { goals: 0, assists: 0, ratingSum: 0, matches: 0 };
        entry.goals += goals;
        entry.assists += assists;
        entry.ratingSum += rating;
        entry.matches += 1;
        seasonStats[name] = entry;
      }
      await metaRepo.setMeta('seasonSquadStats', JSON.stringify(seasonStats));
    }

    // Liga-Coins (V2): Sieg/Remis plus Captain-Boni – auch bei Niederlage
    let coinReward: PlayedUserMatch['coinReward'];
    if (userMatch) {
      const userIsHome = userMatch.homeId === USER_CLUB_ID;
      const userSide = userIsHome ? 'home' : 'away';
      const userGoals = userIsHome ? userMatch.homeGoals : userMatch.awayGoals;
      const oppGoals = userIsHome ? userMatch.awayGoals : userMatch.homeGoals;
      const breakdown: string[] = [];
      let total = 0;
      if (userGoals > oppGoals) {
        total += LEAGUE_REWARDS.win;
        breakdown.push(`Win +${LEAGUE_REWARDS.win}`);
      } else if (userGoals === oppGoals) {
        total += LEAGUE_REWARDS.draw;
        breakdown.push(`Draw +${LEAGUE_REWARDS.draw}`);
      }
      const captain = game.players.find((p) => p.id === game.captainPlayerId);
      if (captain) {
        const captainGoals = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.player === captain.pool.name,
        ).length;
        const captainAssists = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.assist === captain.pool.name,
        ).length;
        if (captainGoals > 0) {
          total += captainGoals * LEAGUE_REWARDS.captainGoal;
          breakdown.push(`Captain goal x${captainGoals} +${captainGoals * LEAGUE_REWARDS.captainGoal}`);
        }
        if (captainAssists > 0) {
          total += captainAssists * LEAGUE_REWARDS.captainAssist;
          breakdown.push(`Captain assist x${captainAssists} +${captainAssists * LEAGUE_REWARDS.captainAssist}`);
        }
      }
      if (total > 0) await game.addCoins(total);
      coinReward = { total, breakdown };
    }

    // Rote Karten eigener Spieler: Sperre für das nächste Ligaspiel;
    // abgelaufene Sperren gleichzeitig aufräumen
    const nextSuspRound = round + 1 > LEAGUE.roundsPerSeason ? 1 : round + 1;
    const nextSuspSeason = round + 1 > LEAGUE.roundsPerSeason ? season + 1 : season;
    const newSuspensions: Suspension[] = [];
    if (userMatch) {
      const userSide = userMatch.homeId === USER_CLUB_ID ? 'home' : 'away';
      userMatch.events
        .filter((e) => e.type === 'rot' && e.team === userSide && e.player)
        .forEach((e) => {
          const owned = game.players.find((p) => p.pool.name === e.player);
          if (owned && !newSuspensions.some((s) => s.playerId === owned.id)) {
            newSuspensions.push({
              playerId: owned.id,
              playerName: owned.pool.name,
              season: nextSuspSeason,
              round: nextSuspRound,
            });
          }
        });
    }
    const keptSuspensions = get().suspensions.filter(
      (s) => s.season > season || (s.season === season && s.round > round),
    );
    const suspensions = [...keptSuspensions, ...newSuspensions];
    await metaRepo.setMeta('suspensions', JSON.stringify(suspensions));

    // Spieltakt fortschreiben (siehe BALANCING.matchIntervalMs)
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
      let message = `Season ${season} finished - you placed ${outcome.finalRank}.`;
      if (outcome.promoted) message += ` Promoted to Division ${outcome.newDivision}!`;
      else if (outcome.relegated) message += ` Relegated to Division ${outcome.newDivision}.`;
      else message += ` You stay in Division ${club.division}.`;

      // Saisonprämie (V2): Platz 1/2, gestaffelt nach Division
      const [firstPrize, secondPrize] = LEAGUE_REWARDS.seasonByDivision[club.division];
      if (outcome.finalRank === 1) {
        await game.addCoins(firstPrize);
        message += ` Season prize: ${firstPrize} coins!`;
        // Meister: Pokal-Animation mit dem Captain – aber erst NACH dem
        // Live-Ticker zeigen (revealCelebration in der Live-Ansicht)
        set({
          pendingCelebration: {
            clubName: club.name,
            division: club.division,
            captainPlayerId: game.captainPlayerId,
          },
        });
      } else if (outcome.finalRank === 2) {
        await game.addCoins(secondPrize);
        message += ` Season prize: ${secondPrize} coins!`;
      }

      // Spieler der Saison (V4): bester Notenschnitt über die Saison,
      // bei Gleichstand entscheiden die Tore
      try {
        const seasonStats = JSON.parse(
          (await metaRepo.getMeta('seasonSquadStats')) || '{}',
        ) as Record<string, SeasonPlayerStat>;
        const best = Object.entries(seasonStats)
          .filter(([, s]) => s.matches > 0)
          .sort(
            ([, a], [, b]) =>
              b.ratingSum / b.matches - a.ratingSum / a.matches || b.goals - a.goals,
          )[0];
        if (best) {
          const [name, s] = best;
          const avg = (s.ratingSum / s.matches).toFixed(1);
          message += ` Player of the season: ${name} - ${s.goals} goal${s.goals === 1 ? '' : 's'}, ${s.assists} assist${s.assists === 1 ? '' : 's'}, average rating ${avg}/10 over ${s.matches} matches.`;
        }
      } catch {
        // kaputte Statistik: einfach ohne Spieler der Saison weitermachen
      }
      await metaRepo.setMeta('seasonSquadStats', '{}');

      await metaRepo.setMeta('seasonMessage', message);
      await metaRepo.setMeta('division', String(outcome.newDivision));
      // Beste erreichte Division für Erfolge festhalten
      const bestDivision = await metaRepo.getMetaNumber('bestDivision', 4);
      if (outcome.newDivision < bestDivision) {
        await metaRepo.setMeta('bestDivision', String(outcome.newDivision));
      }

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
          stats: userStats,
          coinReward,
          motm: userMotm,
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
      suspensions,
    });
    return played;
  },

  acknowledgeSeasonMessage: async () => {
    await metaRepo.setMeta('seasonMessage', '');
    set({ seasonMessage: null });
  },

  clubName: (clubId) => {
    if (clubId === USER_CLUB_ID) return useGameStore.getState().club?.name ?? 'My Club';
    return get().npcs.find((n) => String(n.id) === clubId)?.name ?? '?';
  },

  clubCrest: (clubId) => {
    if (clubId === USER_CLUB_ID) return useGameStore.getState().club?.crest ?? 'crest-0';
    return get().npcs.find((n) => String(n.id) === clubId)?.crest ?? 'crest-0';
  },
}));

export { LEAGUE };
