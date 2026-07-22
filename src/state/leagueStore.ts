import { create } from 'zustand';
import { BALANCING, LEAGUE, LEAGUE_REWARDS, USER_CLUB_ID } from '../core/domain/constants';
import { userHasClMatch } from '../core/engine/cl';
import { tf } from '../core/i18n';
import type { Match, MatchStats, NpcClub, OwnedPlayer, StandingRow, Tactic } from '../core/domain/types';
import { computeStandings, generateNpcRoster, resolveSeason } from '../core/engine/league';
import { simulateMatch, type MatchMotm, type SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import * as leagueRepo from '../core/db/repositories/leagueRepo';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { clubList, createSeason, loadLeagueData, seasonFinished } from '../core/services/seasonService';
import { addDouble, addLeagueTitle } from '../core/services/trophies';
import { useGameStore } from './gameStore';
import { runUserMatch, type MatchPause } from './matchFlow';
import { pick } from '../core/engine/random';

/**
 * Liga-Zustand: Spielplan, Tabelle, Spieltakt (1 Spiel / 30 Min) und
 * Saisonwechsel mit Auf-/Abstieg (Kapitel 3.4).
 *
 * V5: Das Nutzer-Spiel läuft in zwei Hälften – zur Halbzeit pausiert der
 * Ticker, Auswechslungen und ein Taktikwechsel wirken auf die 2. Hälfte.
 * Persistiert wird erst nach dem Abpfiff (stirbt die App in der Pause,
 * kann der Spieltag neu angepfiffen werden).
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
  /** V5: die Live-Simulation pausiert gerade (Halbzeit oder Elfmeter) */
  pause?: MatchPause;
}

/** Saison-Statistik der eigenen Spieler (V4): für den "Spieler der Saison". */
export interface SeasonPlayerStat {
  goals: number;
  assists: number;
  ratingSum: number;
  matches: number;
}

/** Daten für die Saison-Rückblick-Show (V5): Tabelle, Auf-/Abstieg, Bester. */
export interface SeasonReviewData {
  season: number;
  oldDivision: number;
  newDivision: number;
  finalRank: number;
  promoted: boolean;
  relegated: boolean;
  /** Saisonprämie in Coins (0 = kein Podium) */
  prize: number;
  standings: StandingRow[];
  best: { name: string; goals: number; assists: number; avg: number; matches: number } | null;
  squadStats: Record<string, SeasonPlayerStat>;
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
  /** Meldung nach Saisonende (Alt-Spielstände; V5 nutzt seasonReview) */
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
  /** Steht die Saison-Rückblick-Show noch aus? (V5) */
  seasonReview: SeasonReviewData | null;

  /**
   * Spiel-Slot in Division 1 (V7): 0..20. Jeder 3. Slot ist ein Champions-
   * League-Spiel (14 Liga + 7 CL = 21 Spiele). In Division 2-4 ungenutzt.
   */
  div1Slot: number;
  /** Karriere vollendet (V7): Liga + CL in derselben Saison gewonnen. */
  careerComplete: boolean;

  hydrate: () => Promise<void>;
  acknowledgeCelebration: () => void;
  revealCelebration: () => void;
  matchReady: () => boolean;
  msUntilNextMatch: () => number;
  /** Ist das nächste Saison-Spiel ein CL-Spiel? (nur Division 1, V7) */
  nextIsCl: () => boolean;
  /** Slot in Division 1 weiterschalten + ggf. Saison abschließen (V7). */
  advanceDiv1Slot: () => Promise<void>;
  /** Saison abschließen: Auf-/Abstieg, Rückblick, neue Saison + CL (V7). */
  concludeSeason: () => Promise<void>;
  /**
   * Spieltag anpfeifen: NPC-Spiele komplett, das eigene Spiel nur bis zur
   * Halbzeit (V5). Die 2. Hälfte startet der Live-Ticker über matchFlow.
   */
  playUserMatchday: (tactic: Tactic) => Promise<PlayedUserMatch | null>;
  acknowledgeSeasonMessage: () => Promise<void>;
  finishSeasonReview: () => Promise<void>;
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

async function loadSeasonReview(): Promise<SeasonReviewData | null> {
  const raw = await metaRepo.getMeta('seasonReview');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SeasonReviewData;
  } catch {
    return null;
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
  seasonReview: null,
  div1Slot: 0,
  careerComplete: false,

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
    const div1Slot = await metaRepo.getMetaNumber('div1Slot', 0);
    set({
      season: data.season,
      round: data.round,
      nextMatchAt,
      npcs: data.npcs,
      matches: data.matches,
      standings: recomputeStandings(data.matches, data.npcs),
      seasonMessage: seasonMessage || null,
      suspensions: await loadSuspensions(),
      seasonReview: await loadSeasonReview(),
      div1Slot,
      careerComplete: (await metaRepo.getMeta('careerComplete')) === '1',
    });
    // Champions League der aktuellen Saison laden/anlegen (nur Division 1, V7).
    // Neu anlegen nur am Saisonanfang: bestehende Div-1-Spielstände (vor V7)
    // spielen ihre laufende Saison CL-los zu Ende, ab der nächsten gibt es die CL.
    const { useClStore } = await import('./clStore');
    await useClStore.getState().hydrate(data.season);
    if (
      (useGameStore.getState().club?.division ?? 4) === 1 &&
      data.round === 1 &&
      div1Slot === 0
    ) {
      await useClStore.getState().ensureSeason(data.season);
    }
  },

  nextIsCl: () => {
    const division = useGameStore.getState().club?.division ?? 4;
    return division === 1 && get().div1Slot % 3 === 2;
  },

  matchReady: () => {
    const { round, nextMatchAt } = get();
    return !seasonFinished(round) && Date.now() >= nextMatchAt;
  },

  msUntilNextMatch: () => Math.max(0, get().nextMatchAt - Date.now()),

  advanceDiv1Slot: async () => {
    const nextSlot = get().div1Slot + 1;
    await metaRepo.setMeta('div1Slot', String(nextSlot));
    set({ div1Slot: nextSlot });

    // Alle 21 Slots gespielt → Division-1-Saison abschließen (V7)
    if (nextSlot >= 21) {
      await get().concludeSeason();
      return;
    }
    // Timer nur setzen, wenn das nächste ein NUTZER-Spiel ist. An CL-Slots
    // ohne eigenes Spiel (Nutzer ausgeschieden) soll es sofort weitergehen.
    const { useClStore } = await import('./clStore');
    const clState = useClStore.getState().state;
    const nextCl = get().nextIsCl();
    const userPlaysNext = nextCl ? (clState ? userHasClMatch(clState) : false) : true;
    if (userPlaysNext) {
      const at = Date.now() + BALANCING.matchIntervalMs;
      await metaRepo.setMeta('nextMatchAt', String(at));
      set({ nextMatchAt: at });
    } else {
      set({ nextMatchAt: Date.now() });
    }
  },

  concludeSeason: async () => {
    const { season, npcs } = get();
    const g2 = useGameStore.getState();
    const club = g2.club;
    if (!club) return;

    let seasonStats: Record<string, SeasonPlayerStat> = {};
    try {
      seasonStats = JSON.parse((await metaRepo.getMeta('seasonSquadStats')) || '{}');
    } catch {
      seasonStats = {};
    }

    const finalStandings = recomputeStandings(get().matches, npcs);
    const outcome = resolveSeason(finalStandings, club.division);

    const [firstPrize, secondPrize] = LEAGUE_REWARDS.seasonByDivision[club.division];
    let prize = 0;
    if (outcome.finalRank === 1) {
      prize = firstPrize;
      await g2.addCoins(prize);
      await addLeagueTitle(club.division);
      // Liga-Meister-Animation nur setzen, wenn nicht gerade eine CL-Feier
      // aussteht (beim Doppel wurde die CL-Feier soeben gesetzt, V7)
      if (!get().pendingCelebration) {
        set({
          pendingCelebration: {
            clubName: club.name,
            division: club.division,
            captainPlayerId: g2.captainPlayerId,
          },
        });
      }
    } else if (outcome.finalRank === 2) {
      prize = secondPrize;
      await g2.addCoins(prize);
    }

    // Karriere-Ende (V7): Liga-Meister in Division 1 UND CL-Sieger in
    // derselben Saison → alles erreicht, das Spiel ist durchgespielt.
    const { useClStore } = await import('./clStore');
    const clSt = useClStore.getState().state;
    let careerComplete = get().careerComplete;
    if (club.division === 1 && outcome.finalRank === 1 && clSt?.champion === USER_CLUB_ID) {
      await addDouble();
      await metaRepo.setMeta('careerComplete', '1');
      careerComplete = true;
    }

    const bestEntry = Object.entries(seasonStats)
      .filter(([, s]) => s.matches > 0)
      .sort(([, a], [, b]) => b.ratingSum / b.matches - a.ratingSum / a.matches || b.goals - a.goals)[0];
    const best = bestEntry
      ? {
          name: bestEntry[0],
          goals: bestEntry[1].goals,
          assists: bestEntry[1].assists,
          avg: Math.round((bestEntry[1].ratingSum / bestEntry[1].matches) * 10) / 10,
          matches: bestEntry[1].matches,
        }
      : null;

    const review: SeasonReviewData = {
      season,
      oldDivision: club.division,
      newDivision: outcome.newDivision,
      finalRank: outcome.finalRank,
      promoted: outcome.promoted,
      relegated: outcome.relegated,
      prize,
      standings: finalStandings,
      best,
      squadStats: seasonStats,
    };
    await metaRepo.setMeta('seasonReview', JSON.stringify(review));
    await metaRepo.setMeta('seasonSquadStats', '{}');
    await metaRepo.setMeta('division', String(outcome.newDivision));
    const bestDivision = await metaRepo.getMetaNumber('bestDivision', 4);
    if (outcome.newDivision < bestDivision) {
      await metaRepo.setMeta('bestDivision', String(outcome.newDivision));
    }

    const updatedSeason = season + 1;
    await createSeason(updatedSeason, outcome.newDivision);
    await metaRepo.setMeta('div1Slot', '0');
    const updatedMatches = await leagueRepo.getMatches(updatedSeason);
    const updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);

    useGameStore.setState((s) => ({
      club: s.club ? { ...s.club, division: outcome.newDivision } : s.club,
    }));

    // Champions League der neuen Saison anlegen (nur wenn Division 1, V7)
    if (outcome.newDivision === 1) await useClStore.getState().ensureSeason(updatedSeason);
    else await useClStore.getState().clear();

    set({
      season: updatedSeason,
      round: 1,
      div1Slot: 0,
      matches: updatedMatches,
      npcs: updatedNpcs,
      standings: recomputeStandings(updatedMatches, updatedNpcs),
      seasonReview: review,
      careerComplete,
    });
  },

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
    const startingLineup = game
      .lineupPlayers()
      .map((p) => (p && suspendedIds.has(p.id) ? null : p));
    const userStrength = teamStrength(startingLineup, club.formation);
    // Aufgestellte Spieler für namentliche Ticker-Events (Torschütze usw.)
    const userRoster = startingLineup
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

    // NPC-Spiele der Runde sofort komplett simulieren und speichern
    const roundMatches = matches.filter((m) => m.round === round && !m.played);
    let userFixture: Match | null = null;
    for (const m of roundMatches) {
      if (m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID) {
        userFixture = m;
        continue;
      }
      const result = simulateMatch(
        simTeamFor(m.homeId, pick(npcTactics)),
        simTeamFor(m.awayId, pick(npcTactics)),
      );
      await leagueRepo.saveMatchResult(m.id, result.homeGoals, result.awayGoals, result.events);
    }
    if (!userFixture) return null;
    const fixture = userFixture;
    const userIsHome = fixture.homeId === USER_CLUB_ID;

    // Live-Spiel (V5): Simulation pausiert bei Elfmetern und zur Halbzeit;
    // Wechsel und Taktik wirken auf die 2. Hälfte (matchFlow.runUserMatch)
    const opponent = simTeamFor(userIsHome ? fixture.awayId : fixture.homeId, pick(npcTactics));
    // Für die Saisonnoten: Startelf UND Eingewechselte
    const participants = new Map<number, NonNullable<ReturnType<typeof game.lineupPlayers>[number]>>();
    const buildUserTeam = async (t: Tactic): Promise<SimTeam> => {
      const g = useGameStore.getState();
      await g.setTactic(t);
      const lineupNow = g
        .lineupPlayers()
        .map((p) => (p && suspendedIds.has(p.id) ? null : p));
      const xi = lineupNow.filter((p): p is NonNullable<typeof p> => p !== null);
      xi.forEach((p) => participants.set(p.id, p));
      return {
        name: club.name,
        strength: teamStrength(lineupNow, g.club?.formation ?? club.formation),
        tactic: t,
        roster: xi.map((p) => ({ name: p.pool.name, position: p.pool.position })),
        captainName: g.players.find((p) => p.id === g.captainPlayerId)?.pool.name,
      };
    };

    await runUserMatch({
      userIsHome,
      opponent,
      initialTactic: tactic,
      buildUserTeam,
      publish: (st, pause) =>
        set({
          lastPlayedMatch: {
            match: {
              ...fixture,
              homeGoals: st.homeGoals,
              awayGoals: st.awayGoals,
              played: false,
              events: st.events,
            },
            homeName: nameOf(fixture.homeId),
            awayName: nameOf(fixture.awayId),
            homeCrest: crestOf(fixture.homeId),
            awayCrest: crestOf(fixture.awayId),
            userIsHome,
            pause,
          },
        }),
      finalize: async (result) => {
      const g2 = useGameStore.getState();
      await leagueRepo.saveMatchResult(fixture.id, result.homeGoals, result.awayGoals, result.events);
      const userMatch: Match = {
        ...fixture,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        played: true,
        events: result.events,
      };
      const userSide: 'home' | 'away' = userIsHome ? 'home' : 'away';
      const userGoals = userIsHome ? userMatch.homeGoals : userMatch.awayGoals;
      const oppGoals = userIsHome ? userMatch.awayGoals : userMatch.homeGoals;

      // Saison-Statistik (V4/V5): Startelf UND Eingewechselte (participants
      // wird in buildUserTeam gefüllt) bekommen eine Spielnote –
      // Grundlage für den "Spieler der Saison"
      const resultBonus = userGoals > oppGoals ? 0.4 : userGoals === oppGoals ? 0.1 : -0.3;
      let seasonStats: Record<string, SeasonPlayerStat> = {};
      try {
        seasonStats = JSON.parse((await metaRepo.getMeta('seasonSquadStats')) || '{}');
      } catch {
        seasonStats = {};
      }
      for (const p of participants.values()) {
        const name = p.pool.name;
        const goals = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.player === name,
        ).length;
        const assists = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.assist === name,
        ).length;
        const cleanSheetBonus =
          oppGoals === 0 && (p.pool.position === 'TW' || p.pool.position === 'ABW') ? 0.6 : 0;
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

      // Liga-Coins (V2): Sieg/Remis plus Captain-Boni – auch bei Niederlage
      const breakdown: string[] = [];
      let total = 0;
      if (userGoals > oppGoals) {
        total += LEAGUE_REWARDS.win;
        breakdown.push(tf('rewardWin', { n: LEAGUE_REWARDS.win }));
      } else if (userGoals === oppGoals) {
        total += LEAGUE_REWARDS.draw;
        breakdown.push(tf('rewardDraw', { n: LEAGUE_REWARDS.draw }));
      }
      const captain = g2.players.find((p) => p.id === g2.captainPlayerId);
      if (captain) {
        const captainGoals = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.player === captain.pool.name,
        ).length;
        const captainAssists = userMatch.events.filter(
          (e) => e.type === 'tor' && e.team === userSide && e.assist === captain.pool.name,
        ).length;
        if (captainGoals > 0) {
          total += captainGoals * LEAGUE_REWARDS.captainGoal;
          breakdown.push(tf('rewardCaptainGoal', { c: captainGoals, n: captainGoals * LEAGUE_REWARDS.captainGoal }));
        }
        if (captainAssists > 0) {
          total += captainAssists * LEAGUE_REWARDS.captainAssist;
          breakdown.push(tf('rewardCaptainAssist', { c: captainAssists, n: captainAssists * LEAGUE_REWARDS.captainAssist }));
        }
      }
      if (total > 0) await g2.addCoins(total);
      const coinReward = { total, breakdown };

      // Rote Karten eigener Spieler: Sperre für das nächste Ligaspiel;
      // abgelaufene Sperren gleichzeitig aufräumen
      const nextSuspRound = round + 1 > LEAGUE.roundsPerSeason ? 1 : round + 1;
      const nextSuspSeason = round + 1 > LEAGUE.roundsPerSeason ? season + 1 : season;
      const newSuspensions: Suspension[] = [];
      userMatch.events
        .filter((e) => e.type === 'rot' && e.team === userSide && e.player)
        .forEach((e) => {
          const owned = g2.players.find((p) => p.pool.name === e.player);
          if (owned && !newSuspensions.some((s) => s.playerId === owned.id)) {
            newSuspensions.push({
              playerId: owned.id,
              playerName: owned.pool.name,
              season: nextSuspSeason,
              round: nextSuspRound,
            });
          }
        });
      const keptSuspensions = get().suspensions.filter(
        (s) => s.season > season || (s.season === season && s.round > round),
      );
      const suspensions = [...keptSuspensions, ...newSuspensions];
      await metaRepo.setMeta('suspensions', JSON.stringify(suspensions));

      // Spieltakt fortschreiben (siehe BALANCING.matchIntervalMs)
      const newRound = round + 1;
      await metaRepo.setMeta('round', String(newRound));
      // Div-1-Saison mit CL taktet über div1Slot; ein bestehender Div-1-
      // Spielstand ohne CL endet normal nach Runde 14 (Migration, V7)
      const { useClStore: clStoreMod } = await import('./clStore');
      const hasCl = clStoreMod.getState().state !== null;
      const isDiv1 = club.division === 1 && hasCl;
      // In Division 1 taktet advanceDiv1Slot den Timer (CL verschachtelt);
      // sonst wie bisher direkt hier
      if (!isDiv1) {
        await metaRepo.setMeta('nextMatchAt', String(Date.now() + BALANCING.matchIntervalMs));
      }

      const updatedMatches = await leagueRepo.getMatches(season);

      const played: PlayedUserMatch = {
        match: userMatch,
        homeName: nameOf(userMatch.homeId),
        awayName: nameOf(userMatch.awayId),
        homeCrest: crestOf(userMatch.homeId),
        awayCrest: crestOf(userMatch.awayId),
        userIsHome,
        stats: result.stats,
        coinReward,
        motm: result.motm,
      };

      // Ergebnis der gespielten Runde in den State
      set({
        round: newRound,
        matches: updatedMatches,
        standings: recomputeStandings(updatedMatches, npcs),
        lastPlayedMatch: played,
        suspensions,
        nextMatchAt: isDiv1
          ? get().nextMatchAt
          : Date.now() + BALANCING.matchIntervalMs,
      });

      // Saisonabschluss: In Division 1 erst wenn alle 21 Slots durch sind
      // (advanceDiv1Slot); in Division 2-4 direkt nach Runde 14.
      if (isDiv1) {
        await get().advanceDiv1Slot();
      } else if (seasonFinished(newRound)) {
        await get().concludeSeason();
      }
      },
    });

    return get().lastPlayedMatch;
  },

  acknowledgeSeasonMessage: async () => {
    await metaRepo.setMeta('seasonMessage', '');
    set({ seasonMessage: null });
  },

  finishSeasonReview: async () => {
    await metaRepo.setMeta('seasonReview', '');
    set({ seasonReview: null });
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
