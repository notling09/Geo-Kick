import { create } from 'zustand';
import { BALANCING, LEAGUE, LEAGUE_REWARDS, USER_CLUB_ID } from '../core/domain/constants';
import { groupStandings, userHasClMatch, KO_STAGES, type ClStage } from '../core/engine/cl';
import { tf } from '../core/i18n';
import type { Match, MatchStats, NpcClub, OwnedPlayer, StandingRow, Tactic } from '../core/domain/types';
import { computeStandings, generateNpcRoster, resolveSeason } from '../core/engine/league';
import { simulateMatch, type MatchMotm, type SimTeam } from '../core/engine/matchSim';
import { teamStrength } from '../core/engine/strength';
import * as leagueRepo from '../core/db/repositories/leagueRepo';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { clubList, createSeason, loadLeagueData, seasonFinished } from '../core/services/seasonService';
import { addDouble, addLeagueTitle, addRunnerUp } from '../core/services/trophies';
import { averageForm, formFactor, loadForm, updateFormAfterMatch } from '../core/services/form';
import { useGameStore } from './gameStore';
import { runUserMatch, takeAggravatedInjuries, type MatchPause } from './matchFlow';
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
  /** Turnier-Weg dieser Saison (V7.4): Gruppenplatz + erreichte Runde. */
  cup: CupJourney | null;
}

/**
 * Endstand der Liga-Saison, festgeschrieben direkt nach dem letzten Ligaspiel
 * (V7.4-Fix). Der Rückblick nach dem Turnierfinale nutzt GENAU diese Werte,
 * damit dort nie ein anderer Platz steht als in der Tabelle nach dem Spiel.
 */
interface LeagueFinal {
  season: number;
  standings: StandingRow[];
  finalRank: number;
  newDivision: number;
  promoted: boolean;
  relegated: boolean;
  prize: number;
}

/** Zusammenfassung des Turnier-Wegs (Champions League / Pokal) für den Rückblick. */
export interface CupJourney {
  /** 'cl' oder 'cup' – für den Titeltext im Rückblick */
  kind: 'cl' | 'cup';
  /** Platz in der Gruppenphase (1–4) */
  groupRank: number;
  /** Weiteste erreichte Runde */
  reachedStage: ClStage | 'champion';
}

/** Ein Spieler ist für genau dieses (Saison, Runde)-Paar gesperrt. */
export interface Suspension {
  playerId: number;
  playerName: string;
  /** V7.4: 'league' sperrt nur das nächste Ligaspiel, 'tournament' nur das
   *  nächste Turnierspiel. Alt-Spielstände ohne Feld gelten als 'league'. */
  kind?: 'league' | 'tournament';
  season: number;
  round: number;
}

/** Verletzung (V7.4): der Spieler fehlt `matchesLeft` Spiele – Liga UND Turnier. */
export interface Injury {
  playerId: number;
  playerName: string;
  matchesLeft: number;
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
  /** Verletzte eigene Spieler (V7.4): fehlen Liga UND Turnier für n Spiele */
  injuries: Injury[];
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
  /** Rivalen-Klub dieser Saison (V7.2): zufälliger NPC, in der Tabelle markiert. */
  rivalClubId: string | null;
  /** Läuft in dieser Saison ein Turnier (CL oder Pokal)? Taktet den Slot (V7.2). */
  hasTournament: boolean;

  hydrate: () => Promise<void>;
  acknowledgeCelebration: () => void;
  revealCelebration: () => void;
  matchReady: () => boolean;
  msUntilNextMatch: () => number;
  /** Ist das nächste Saison-Spiel ein CL-Spiel? (nur Division 1, V7) */
  nextIsCl: () => boolean;
  /** Gesperrte Spieler-Ids für das NÄCHSTE Spiel (Liga- bzw. Turnier-Sperren, V7.4). */
  suspendedForNextMatch: () => Set<number>;
  /** Nach einem Turnierspiel (V7.4): abgesessene Turnier-Sperren entfernen und
   *  neue rote Karten als Turnier-Sperre fürs nächste Turnierspiel eintragen. */
  updateTournamentSuspensions: (
    newly: Array<{ playerId: number; playerName: string }>,
  ) => Promise<void>;
  /** Nach JEDEM Spiel (V7.4): laufende Verletzungen um 1 runterzählen und neue
   *  Verletzungen dieses Spiels aufnehmen (gilt für Liga und Turnier). */
  processMatchInjuries: (
    newly: Array<{ playerId: number; playerName: string; matches: number }>,
  ) => Promise<void>;
  /** Slot in Division 1 weiterschalten + ggf. Saison abschließen (V7). */
  advanceDiv1Slot: () => Promise<void>;
  /** Nach dem letzten Ligaspiel (V7.4): Liga-Titel + Meister-Animation sofort,
   *  der Rückblick kommt erst nach dem Turnierfinale. */
  concludeLeaguePhase: () => Promise<void>;
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

async function loadInjuries(): Promise<Injury[]> {
  const raw = await metaRepo.getMeta('injuries');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Injury[];
  } catch {
    return [];
  }
}

/** Rivalen-Klub der Saison laden bzw. zufällig wählen (V7.2). */
async function loadRival(season: number): Promise<string | null> {
  try {
    const r = JSON.parse((await metaRepo.getMeta('rival')) || 'null') as
      | { season: number; clubId: string }
      | null;
    return r && r.season === season ? r.clubId : null;
  } catch {
    return null;
  }
}

async function chooseRival(season: number, npcs: NpcClub[]): Promise<string | null> {
  if (npcs.length === 0) return null;
  const clubId = String(pick(npcs).id);
  await metaRepo.setMeta('rival', JSON.stringify({ season, clubId }));
  return clubId;
}

/** Festgeschriebenen Liga-Endstand laden (V7.4-Fix). */
async function loadLeagueFinal(): Promise<LeagueFinal | null> {
  try {
    return JSON.parse((await metaRepo.getMeta('leagueFinal')) || 'null') as LeagueFinal | null;
  } catch {
    return null;
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
  injuries: [],
  championCelebration: null,
  pendingCelebration: null,
  seasonReview: null,
  div1Slot: 0,
  careerComplete: false,
  rivalClubId: null,
  hasTournament: false,

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
    // Rivale dieser Saison (V7.2): laden oder zufällig wählen
    let rivalClubId = await loadRival(data.season);
    if (!rivalClubId && data.npcs.length > 0) {
      rivalClubId = await chooseRival(data.season, data.npcs);
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
      injuries: await loadInjuries(),
      seasonReview: await loadSeasonReview(),
      div1Slot,
      careerComplete: (await metaRepo.getMeta('careerComplete')) === '1',
      rivalClubId,
    });
    // Turnier der aktuellen Saison laden/anlegen: Champions League in Division 1,
    // Nationaler Pokal in Division 2–4 (V7.2). Neu anlegen nur am Saisonanfang;
    // bestehende Spielstände beenden ihre laufende Saison turnierlos, ab der
    // nächsten gibt es das Turnier (migrationssicher, wie schon bei der CL, V7).
    const { useClStore } = await import('./clStore');
    await useClStore.getState().hydrate(data.season);
    if (data.round === 1 && div1Slot === 0) {
      await useClStore.getState().ensureSeason(data.season);
    }
    set({ hasTournament: useClStore.getState().state !== null });
  },

  nextIsCl: () => {
    // In jeder Division mit aktivem Turnier ist jeder 3. Slot ein Turnierspiel.
    return get().hasTournament && get().div1Slot % 3 === 2;
  },

  suspendedForNextMatch: () => {
    // Turnierspiel als nächstes → nur Turnier-Sperren; sonst nur Liga-Sperren
    // der aktuellen Runde. So gilt eine rote Karte NUR im jeweiligen Wettbewerb.
    // Verletzungen gelten IMMER (Liga UND Turnier), V7.4.
    const { suspensions, injuries, season, round } = get();
    const isTournament = get().nextIsCl();
    const ids = suspensions
      .filter((s) =>
        isTournament
          ? s.kind === 'tournament' && s.season === season
          : s.kind !== 'tournament' && s.season === season && s.round === round,
      )
      .map((s) => s.playerId);
    injuries.filter((i) => i.matchesLeft > 0).forEach((i) => ids.push(i.playerId));
    return new Set(ids);
  },

  updateTournamentSuspensions: async (newly) => {
    const { suspensions, season } = get();
    // Alte Turnier-Sperren dieser Saison sind abgesessen → entfernen
    const kept = suspensions.filter((s) => !(s.kind === 'tournament' && s.season === season));
    const added: Suspension[] = newly.map((n) => ({
      playerId: n.playerId,
      playerName: n.playerName,
      kind: 'tournament',
      season,
      round: 0,
    }));
    const next = [...kept, ...added];
    await metaRepo.setMeta('suspensions', JSON.stringify(next));
    set({ suspensions: next });
  },

  processMatchInjuries: async (newly) => {
    // Laufende Verletzungen zählen für DIESES gerade gespielte Spiel eins runter
    // (die betroffenen Spieler haben es ausgesetzt). Danach die neuen
    // Verletzungen dieses Spiels aufnehmen (sie beginnen erst beim nächsten Spiel).
    const ticked = get()
      .injuries.map((i) => ({ ...i, matchesLeft: i.matchesLeft - 1 }))
      .filter((i) => i.matchesLeft > 0);
    // V7.5: Spieler, die trotz Verletzung in der 1. Halbzeit NICHT ausgewechselt
    // wurden, fehlen 1–3 Spiele LÄNGER.
    const aggravated = takeAggravatedInjuries();
    const added: Injury[] = [];
    newly.forEach((n) => {
      if (!ticked.some((i) => i.playerId === n.playerId) && !added.some((i) => i.playerId === n.playerId)) {
        const extra = aggravated.includes(n.playerName) ? 1 + Math.floor(Math.random() * 3) : 0;
        added.push({ playerId: n.playerId, playerName: n.playerName, matchesLeft: n.matches + extra });
      }
    });
    const next = [...ticked, ...added];
    await metaRepo.setMeta('injuries', JSON.stringify(next));
    set({ injuries: next });
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

  concludeLeaguePhase: async () => {
    // Nach dem letzten Ligaspiel (V7.4): Liga-Titel + Prämie + Meister-Animation
    // sofort. Der Saison-Rückblick kommt erst nach dem Turnierfinale.
    const { season, npcs } = get();
    const g2 = useGameStore.getState();
    const club = g2.club;
    if (!club) return;
    // Nur einmal pro Saison
    if ((await loadLeagueFinal())?.season === season) return;

    const finalStandings = recomputeStandings(get().matches, npcs);
    const outcome = resolveSeason(finalStandings, club.division);
    const [firstPrize, secondPrize] = LEAGUE_REWARDS.seasonByDivision[club.division];
    let prize = 0;
    if (outcome.finalRank === 1) {
      prize = firstPrize;
      await g2.addCoins(prize);
      await addLeagueTitle(club.division);
      set({
        pendingCelebration: {
          clubName: club.name,
          division: club.division,
          captainPlayerId: g2.captainPlayerId,
        },
      });
    } else if (outcome.finalRank === 2) {
      prize = secondPrize;
      await g2.addCoins(prize);
      await addRunnerUp(club.division);
    }
    // Endstand festschreiben: der Rückblick nach dem Turnierfinale nutzt GENAU
    // diese Tabelle und diesen Platz – nie eine neu gerechnete (V7.4-Fix).
    const leagueFinal: LeagueFinal = {
      season,
      standings: finalStandings,
      finalRank: outcome.finalRank,
      newDivision: outcome.newDivision,
      promoted: outcome.promoted,
      relegated: outcome.relegated,
      prize,
    };
    await metaRepo.setMeta('leagueFinal', JSON.stringify(leagueFinal));
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

    // Endstand: bei Turnier-Saisons wurde er direkt nach dem letzten Ligaspiel
    // festgeschrieben – genau den benutzen, damit der Rückblick nie einen
    // anderen Platz zeigt als die Tabelle nach dem Spiel (V7.4-Fix).
    const loaded = await loadLeagueFinal();
    const sealed = loaded && loaded.season === season ? loaded : null;
    const finalStandings = sealed ? sealed.standings : recomputeStandings(get().matches, npcs);
    const outcome = sealed
      ? {
          finalRank: sealed.finalRank,
          newDivision: sealed.newDivision,
          promoted: sealed.promoted,
          relegated: sealed.relegated,
        }
      : resolveSeason(finalStandings, club.division);

    const [firstPrize, secondPrize] = LEAGUE_REWARDS.seasonByDivision[club.division];
    // Liga-Titel/Prämie/Feier wurden bei Turnier-Saisons schon nach dem letzten
    // Ligaspiel vergeben (concludeLeaguePhase). Dann hier nicht erneut, aber die
    // Prämie für den Rückblick übernehmen.
    let prize = 0;
    if (sealed) {
      prize = sealed.prize;
    } else if (outcome.finalRank === 1) {
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
      // Vize-Meister/Aufstieg als Zweiter in den Trophäenschrank (V7)
      await addRunnerUp(club.division);
    }

    // Karriere-Ende (V7): Liga-Meister in Division 1 UND CL-Sieger in
    // derselben Saison → alles erreicht, das Spiel ist durchgespielt.
    const { useClStore } = await import('./clStore');
    const clSt = useClStore.getState().state;

    // Turnier-Weg für den Rückblick erfassen, BEVOR das Turnier verworfen wird
    let cup: CupJourney | null = null;
    if (clSt) {
      const table = groupStandings(clSt);
      const groupRank = table.findIndex((r) => r.clubId === USER_CLUB_ID) + 1;
      let reachedStage: ClStage | 'champion' = 'group';
      if (clSt.champion === USER_CLUB_ID) {
        reachedStage = 'champion';
      } else {
        for (const stage of KO_STAGES) {
          if (clSt.ko[stage].some((m) => m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID)) {
            reachedStage = stage;
          }
        }
      }
      cup = { kind: clSt.kind === 'cup' ? 'cup' : 'cl', groupRank: groupRank || 0, reachedStage };
    }
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
      cup,
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
    let updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);

    // Team-Kontinuität über die Saisons (V7.4). Die alten NPCs dieser Saison
    // stehen in `npcs`; finalStandings nennt die Klub-Ids.
    const oldById = new Map(npcs.map((n) => [String(n.id), n]));
    const promoSpots = club.division > 1 ? LEAGUE.promotionSpots : 0;
    const relSpots = club.division < LEAGUE.divisions ? LEAGUE.relegationSpots : 0;

    if (!outcome.promoted && !outcome.relegated) {
      // Nutzer bleibt: die NPC-Teams aus dem sicheren Mittelfeld (nicht auf-,
      // nicht abgestiegen) bleiben mit Name/Wappen/Stärke/Kader identisch.
      const safeMiddle = finalStandings
        .slice(promoSpots, LEAGUE.clubsPerDivision - relSpots)
        .filter((r) => r.clubId !== USER_CLUB_ID)
        .map((r) => oldById.get(r.clubId))
        .filter((n): n is NpcClub => !!n);
      for (let i = 0; i < safeMiddle.length && i < updatedNpcs.length; i++) {
        const s = safeMiddle[i];
        await leagueRepo.carryOverNpcClub(updatedNpcs[i].id, {
          name: s.name, crest: s.crest, strength: s.strength, roster: s.roster,
        });
      }
      updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);
    } else if (outcome.promoted) {
      // Mit-Aufsteiger (V7.2): das andere Top-2-Team kommt mit hoch – Name+Wappen,
      // Stärke bleibt auf dem Niveau der neuen (höheren) Division.
      const otherPromoted = finalStandings
        .slice(0, LEAGUE.promotionSpots)
        .find((r) => r.clubId !== USER_CLUB_ID);
      if (otherPromoted && updatedNpcs.length > 0) {
        await leagueRepo.renameNpcClub(updatedNpcs[0].id, otherPromoted.name, otherPromoted.crest);
        updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);
      }
    } else if (outcome.relegated) {
      // Mit-Absteiger (V7.4): das andere Abstiegsteam kommt mit runter.
      const otherRelegated = finalStandings
        .slice(LEAGUE.clubsPerDivision - LEAGUE.relegationSpots)
        .find((r) => r.clubId !== USER_CLUB_ID);
      if (otherRelegated && updatedNpcs.length > 0) {
        await leagueRepo.renameNpcClub(updatedNpcs[0].id, otherRelegated.name, otherRelegated.crest);
        updatedNpcs = await leagueRepo.getNpcClubs(updatedSeason);
      }
    }
    const updatedMatches = await leagueRepo.getMatches(updatedSeason);

    useGameStore.setState((s) => ({
      club: s.club ? { ...s.club, division: outcome.newDivision } : s.club,
    }));

    // Turnier der neuen Saison anlegen: CL in Division 1, Pokal in Division 2–4
    // (V7.2). ensureSeason legt anhand der Division das passende Turnier an.
    await useClStore.getState().clear();
    await useClStore.getState().ensureSeason(updatedSeason);
    const hasTournament = useClStore.getState().state !== null;

    // Rivale bleibt derselbe Verein, solange er noch in der Division ist (per
    // Name erkannt, da die Ids je Saison neu sind). Sonst neuer Rivale (V7.4).
    const oldRivalName = get().rivalClubId ? oldById.get(String(get().rivalClubId))?.name : undefined;
    const stillHere = oldRivalName ? updatedNpcs.find((n) => n.name === oldRivalName) : undefined;
    let newRival: string | null;
    if (stillHere) {
      newRival = String(stillHere.id);
      await metaRepo.setMeta('rival', JSON.stringify({ season: updatedSeason, clubId: newRival }));
    } else {
      newRival = await chooseRival(updatedSeason, updatedNpcs);
    }

    // Neue Saison = frischer Anfang: Sperren und Verletzungen zählen nicht mehr
    // (Ausnahme aus dem Nutzerwunsch, V7.4).
    await metaRepo.setMeta('suspensions', '[]');
    await metaRepo.setMeta('injuries', '[]');

    set({
      season: updatedSeason,
      round: 1,
      div1Slot: 0,
      matches: updatedMatches,
      npcs: updatedNpcs,
      standings: recomputeStandings(updatedMatches, updatedNpcs),
      seasonReview: review,
      careerComplete,
      rivalClubId: newRival,
      hasTournament,
      suspensions: [],
      injuries: [],
    });
  },

  playUserMatchday: async (tactic) => {
    const { round, season, npcs, matches } = get();
    if (!get().matchReady()) return null;

    const game = useGameStore.getState();
    const club = game.club;
    if (!club) return null;
    // Kein setTactic hier (V7.4): die Taktik gilt nur für DIESES Spiel und wird
    // über initialTactic/buildUserTeam gesetzt, nach dem Abpfiff wieder auf den
    // neutralen Standard zurückgesetzt (runUserMatch). So bleibt der persistente
    // club.tactic sauber und der Vor-Spiel-Selektor startet immer auf Ausgewogen.

    const npcById = new Map(npcs.map((n) => [String(n.id), n]));
    const nameOf = (id: string) => (id === USER_CLUB_ID ? club.name : npcById.get(id)?.name ?? '?');
    const crestOf = (id: string) => (id === USER_CLUB_ID ? club.crest : npcById.get(id)?.crest ?? 'crest-0');

    // Gesperrte/verletzte Spieler spielen dieses Mal nicht mit: sie zählen weder
    // zur Teamstärke noch zum Ticker-Kader. suspendedForNextMatch() liefert für
    // ein Ligaspiel die Liga-Sperren dieser Runde PLUS alle Verletzten (V7.4).
    const suspendedIds = get().suspendedForNextMatch();
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
    // Spielerform (V7.2): die Durchschnittsform der Elf wirkt ±4 % auf die Stärke
    const form = await loadForm();
    const buildUserTeam = async (t: Tactic): Promise<SimTeam> => {
      const g = useGameStore.getState();
      await g.setTactic(t);
      const lineupNow = g
        .lineupPlayers()
        .map((p) => (p && suspendedIds.has(p.id) ? null : p));
      const xi = lineupNow.filter((p): p is NonNullable<typeof p> => p !== null);
      xi.forEach((p) => participants.set(p.id, p));
      const names = xi.map((p) => p.pool.name);
      const strength = Math.round(
        teamStrength(lineupNow, g.club?.formation ?? club.formation) *
          formFactor(averageForm(form, names)),
      );
      return {
        name: club.name,
        strength,
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
      // Rivalen-System (V7.2): Sieg gegen den Saison-Rivalen bringt Extra-Coins,
      // eine Niederlage drueckt zusaetzlich auf die Spielerform
      const opponentId = userIsHome ? fixture.awayId : fixture.homeId;
      const isRival =
        get().rivalClubId != null && String(opponentId) === String(get().rivalClubId);
      if (isRival && userGoals > oppGoals) {
        // V7.4: Sieg gegen den Rivalen VERDOPPELT die Coins dieses Spiels (×2)
        // – statt eines festen Bonus. Verdoppelt wird der bis hier erspielte
        // Betrag (Sieg + Captain-Boni), also z. B. aus 10 werden 20.
        const rivalBonus = total;
        total += rivalBonus;
        breakdown.push(tf('rewardRivalWin', { n: rivalBonus }));
      }
      if (total > 0) await g2.addCoins(total);
      const coinReward = { total, breakdown };

      // Spielerform nach dem Spiel fortschreiben (V7.2)
      const formResult: 'win' | 'draw' | 'loss' =
        userGoals > oppGoals ? 'win' : userGoals < oppGoals ? 'loss' : 'draw';
      const lineupNames = [...participants.values()].map((p) => p.pool.name);
      const benchNames = g2.players
        .filter((p) => !participants.has(p.id))
        .map((p) => p.pool.name);
      await updateFormAfterMatch({
        events: userMatch.events,
        userSide,
        lineupNames,
        benchNames,
        result: formResult,
        extraMalus: isRival && formResult === 'loss' ? 6 : 0,
      });

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
              kind: 'league',
              season: nextSuspSeason,
              round: nextSuspRound,
            });
          }
        });
      // Nur die abgelaufenen LIGA-Sperren aufräumen; Turnier-Sperren der
      // aktuellen/künftigen Saison bleiben unberührt (sie werden nach dem
      // Turnierspiel abgebaut, V7.4).
      const keptSuspensions = get().suspensions.filter((s) =>
        s.kind === 'tournament'
          ? s.season >= season
          : s.season > season || (s.season === season && s.round > round),
      );
      const suspensions = [...keptSuspensions, ...newSuspensions];
      await metaRepo.setMeta('suspensions', JSON.stringify(suspensions));

      // Verletzungen (V7.4): laufende um 1 runterzählen und neue dieses Spiels
      // aufnehmen (fehlen Liga UND Turnier für 1–3 Spiele).
      const newInjuries = userMatch.events
        .filter((e) => e.type === 'verletzung' && e.team === userSide && e.player)
        .map((e) => g2.players.find((p) => p.pool.name === e.player))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
          playerId: p.id,
          playerName: p.pool.name,
          matches: 1 + Math.floor(Math.random() * 3),
        }));
      await get().processMatchInjuries(newInjuries);

      // Spieltakt fortschreiben (siehe BALANCING.matchIntervalMs)
      const newRound = round + 1;
      await metaRepo.setMeta('round', String(newRound));
      // Saison mit Turnier (CL oder Pokal) taktet über div1Slot; ein Spielstand
      // ohne Turnier endet normal nach Runde 14 (Migration, V7/V7.2)
      const { useClStore: clStoreMod } = await import('./clStore');
      const hasTournament = clStoreMod.getState().state !== null;
      // Mit Turnier taktet advanceDiv1Slot den Timer (verschachtelt); sonst hier
      if (!hasTournament) {
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
        nextMatchAt: hasTournament
          ? get().nextMatchAt
          : Date.now() + BALANCING.matchIntervalMs,
      });

      // Saisonabschluss: mit Turnier erst wenn alle 21 Slots durch sind
      // (advanceDiv1Slot); ohne Turnier direkt nach Runde 14.
      if (hasTournament) {
        // War das das letzte Ligaspiel? Dann Liga-Titel + Meister-Animation
        // jetzt (V7.4), der Rückblick kommt erst nach dem Turnierfinale.
        if (seasonFinished(newRound)) await get().concludeLeaguePhase();
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
