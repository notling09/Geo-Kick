import { create } from 'zustand';
import { USER_CLUB_ID } from '../core/domain/constants';
import type { Tactic } from '../core/domain/types';
import type { SimTeam } from '../core/engine/matchSim';
import {
  applyUserClResult, clWinReward, createClState, createCupState, KO_STAGES, nextUserClMatch,
  simulateNextClRound, tournamentConfig,
  type ClMatch, type ClStage, type ClState,
} from '../core/engine/cl';
import { generateNpcRoster } from '../core/engine/league';
import { teamStrength } from '../core/engine/strength';
import { tf } from '../core/i18n';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';
import { runUserMatch } from './matchFlow';
import { addTournamentPlace } from '../core/services/trophies';
import { addPassPoints, reportMissionEvent } from '../core/services/pass';
import type { ShootoutSetup } from './battleStore';

/**
 * Champions League (V7): hält den Turnierzustand für die aktuelle Division-1-
 * Saison. Der leagueStore taktet über den div1Slot, WANN ein CL-Spiel dran ist;
 * dieser Store führt es aus (live gegen den nächsten Gegner) bzw. simuliert die
 * Runde, wenn der Nutzer bereits ausgeschieden ist.
 */

/** Gerade simulierte Turnierrunde für die Schnell-Wiedergabe (V7.3). */
export interface TournamentPlayback {
  stage: ClStage;
  matches: ClMatch[];
}

interface ClStore {
  state: ClState | null;
  /** Anstehendes K.o.-Elfmeterschießen (V7.3), falls ein KO-Spiel remis endet. */
  pendingShootout: ShootoutSetup | null;
  /** Zuletzt simulierte Runde (Nutzer ausgeschieden) für die Schnell-Wiedergabe. */
  lastPlayback: TournamentPlayback | null;

  hydrate: (season: number) => Promise<void>;
  /** CL für die Saison sicherstellen (in Division 1 anlegen). */
  ensureSeason: (season: number) => Promise<void>;
  /** Bei Div-Wechsel/Karriere-Reset: CL verwerfen. */
  clear: () => Promise<void>;
  /** Das nächste CL-Spiel des Nutzers live spielen. */
  playUserClMatch: (tactic: Tactic) => Promise<PlayedUserMatch | null>;
  /** Nutzer ausgeschieden: die nächste CL-Runde simulieren (nur Anzeige). */
  simulateNextRound: () => Promise<void>;
  /** Elfmeterschießen auswerten: Sieger kommt weiter, Belohnungstext zurück. */
  resolveClShootout: (won: boolean) => Promise<string | null>;
  /** Elfmeterschießen ohne Ende verlassen: zufällig entscheiden, damit es weitergeht. */
  abandonClShootout: () => void;
}

async function persist(state: ClState | null): Promise<void> {
  await metaRepo.setMeta('clState', state ? JSON.stringify(state) : '');
}

/**
 * Abschluss eines K.o.-Spiels nach dem Elfmeterschießen (V7.3). In-Memory, weil
 * es die 90-Minuten-Daten (Events/Stats) des laufenden Spiels enthält.
 */
let pendingClFinish: ((userWon: boolean) => Promise<string | null>) | null = null;

function userTeamFactory(suspendedIds: Set<number>): (t: Tactic) => Promise<SimTeam> {
  return async (t) => {
    const g = useGameStore.getState();
    await g.setTactic(t);
    // Turnier-gesperrte Spieler (rote Karte) zählen weder zur Stärke noch zum
    // Ticker-Kader (V7.4) – wie bei den Ligaspielen.
    const lineupNow = g.lineupPlayers().map((p) => (p && suspendedIds.has(p.id) ? null : p));
    return {
      name: g.club?.name ?? 'My Club',
      strength: teamStrength(lineupNow, g.club?.formation ?? '4-2-2-2'),
      tactic: t,
      roster: lineupNow
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({ name: p.pool.name, position: p.pool.position })),
      captainName: g.players.find((p) => p.id === g.captainPlayerId)?.pool.name,
    };
  };
}

export const useClStore = create<ClStore>((set, get) => ({
  state: null,
  pendingShootout: null,
  lastPlayback: null,

  hydrate: async (season) => {
    const raw = await metaRepo.getMeta('clState');
    let state: ClState | null = null;
    if (raw) {
      try {
        state = JSON.parse(raw) as ClState;
      } catch {
        state = null;
      }
    }
    // Nur die CL der aktuellen Saison ist gültig
    if (state && state.season !== season) state = null;
    // Migration (V7.3): alte Turnier-Teams ohne festen Kader nachrüsten, damit
    // die restlichen Spiele der Saison konsistente Torschützen-Namen liefern.
    if (state) {
      let changed = false;
      for (const id of Object.keys(state.teams)) {
        if (!state.teams[id].roster) {
          state.teams[id].roster = generateNpcRoster();
          changed = true;
        }
      }
      if (changed) await persist(state);
    }
    set({ state });
  },

  ensureSeason: async (season) => {
    const game = useGameStore.getState();
    if (get().state && get().state?.season === season) return;
    const division = game.club?.division ?? 4;
    const strength = teamStrength(game.lineupPlayers(), game.club?.formation ?? '4-2-2-2');
    const user = {
      strength,
      name: game.club?.name ?? 'My Club',
      crest: game.club?.crest ?? 'crest-0',
    };
    // Division 1: Champions League. Division 2–4: Nationaler Pokal (V7.2).
    const state = division === 1 ? createClState(season, user) : createCupState(season, user);
    await persist(state);
    set({ state });
  },

  clear: async () => {
    set({ state: null });
    await persist(null);
  },

  playUserClMatch: async (tactic) => {
    const state = get().state;
    if (!state) return null;
    const fixture = nextUserClMatch(state);
    if (!fixture) return null;

    const game = useGameStore.getState();
    const club = game.club;
    if (!club) return null;

    // Turnier-gesperrte Spieler (rote Karte im letzten Turnierspiel) fehlen (V7.4)
    const suspendedIds = useLeagueStore.getState().suspendedForNextMatch();

    const cfg = tournamentConfig(state.kind);
    const isCup = state.kind === 'cup';
    const userIsHome = fixture.homeId === USER_CLUB_ID;
    const oppId = userIsHome ? fixture.awayId : fixture.homeId;
    const oppTeamData = state.teams[oppId];
    // Steigende Schwierigkeit: Gegnerstärke je Runde skaliert (Nutzerwunsch)
    const factor = cfg.difficulty[fixture.stage] ?? 1;
    const oppTeam: SimTeam = {
      name: oppTeamData.name,
      strength: Math.round(oppTeamData.strength * factor),
      tactic: 'ausgewogen',
      roster: oppTeamData.roster ?? generateNpcRoster(),
    };

    const baseMatch = {
      id: 0,
      season: state.season,
      division: club.division,
      round: 0,
      homeId: fixture.homeId === USER_CLUB_ID ? USER_CLUB_ID : 'cl',
      awayId: fixture.awayId === USER_CLUB_ID ? USER_CLUB_ID : 'cl',
    };
    const homeName = userIsHome ? club.name : oppTeamData.name;
    const awayName = userIsHome ? oppTeamData.name : club.name;
    const homeCrest = userIsHome ? club.crest : oppTeamData.crest;
    const awayCrest = userIsHome ? oppTeamData.crest : club.crest;

    await runUserMatch({
      userIsHome,
      opponent: oppTeam,
      // V7.4-Fix: die im Liga-Tab GEWÄHLTE Taktik verwenden – vorher wurde
      // stattdessen der (evtl. veraltete) club.tactic genommen, wodurch die
      // Auswahl ignoriert wurde und die Halbzeit einen falschen Wert zeigte.
      initialTactic: tactic,
      buildUserTeam: userTeamFactory(suspendedIds),
      publish: (st, pause) =>
        useLeagueStore.setState({
          lastPlayedMatch: {
            match: { ...baseMatch, homeGoals: st.homeGoals, awayGoals: st.awayGoals, played: false, events: st.events },
            homeName, awayName, homeCrest, awayCrest, userIsHome, pause,
          },
        }),
      finalize: async (result) => {
        // Turnier-Spiel abschließen: Coins berechnen, Ergebnis in den Baum
        // eintragen, Feier/Anzeige setzen, Slot weiterschalten. hg/ag sind das
        // ENDGÜLTIGE Ergebnis (nach evtl. Elfmeterschießen). Gibt einen
        // Belohnungstext zurück (für die Elfmeter-Anzeige).
        const finishClResult = async (
          hg: number,
          ag: number,
          viaShootout: boolean,
        ): Promise<string | null> => {
          const g2 = useGameStore.getState();
          const finalUserGoals = userIsHome ? hg : ag;
          const finalOppGoals = userIsHome ? ag : hg;
          const won = finalUserGoals > finalOppGoals;
          const draw = finalUserGoals === finalOppGoals;

          // Coins: Sieg (steigend je Runde), Gruppen-Remis, plus Captain-Boni.
          // Captain-Boni zählen nur die Tore aus den 90 Minuten (result.events).
          const breakdown: string[] = [];
          let coins = 0;
          if (won) {
            const w = clWinReward(state, fixture.stage);
            coins += w;
            breakdown.push(tf(isCup ? 'cupRewardWin' : 'clRewardWin', { n: w }));
          } else if (draw) {
            coins += cfg.drawReward;
            breakdown.push(tf('rewardDraw', { n: cfg.drawReward }));
          }
          const captain = g2.players.find((p) => p.id === g2.captainPlayerId);
          if (captain) {
            const side = userIsHome ? 'home' : 'away';
            const cg = result.events.filter(
              (e) => e.type === 'tor' && e.team === side && e.player === captain.pool.name,
            ).length;
            const ca = result.events.filter(
              (e) => e.type === 'tor' && e.team === side && e.assist === captain.pool.name,
            ).length;
            const goalV = cfg.captainGoal[fixture.stage] ?? 0;
            const assistV = cfg.captainAssist[fixture.stage] ?? 0;
            if (cg > 0) {
              coins += cg * goalV;
              breakdown.push(tf('rewardCaptainGoal', { c: cg, n: cg * goalV }));
            }
            if (ca > 0) {
              coins += ca * assistV;
              breakdown.push(tf('rewardCaptainAssist', { c: ca, n: ca * assistV }));
            }
          }
          if (coins > 0) await g2.addCoins(coins);

          // Saisonpass (V7.7): Turnierspiel zählt auch für Punkte + Missionen
          if (won) {
            await addPassPoints(15);
            await reportMissionEvent('win');
            await reportMissionEvent('clWin');
          }
          {
            const side = userIsHome ? 'home' : 'away';
            const ug = result.events.filter((e) => e.type === 'tor' && e.team === side).length;
            if (ug > 0) await reportMissionEvent('goal', ug);
            if (won && finalOppGoals === 0) await reportMissionEvent('cleanSheet');
            if (captain) {
              const cg = result.events.filter(
                (e) => e.type === 'tor' && e.team === side && e.player === captain.pool.name,
              ).length;
              const ca = result.events.filter(
                (e) => e.type === 'tor' && e.team === side && e.assist === captain.pool.name,
              ).length;
              if (cg > 0) { await addPassPoints(cg * 5); await reportMissionEvent('captainGoal', cg); }
              if (ca > 0) await addPassPoints(ca * 5);
              if (result.motm && result.motm.name === captain.pool.name) await addPassPoints(10);
            }
          }

          // Saison-Statistik (V7.4): auch Turnierspiele zählen für den Spieler
          // der Saison – dieselbe Notenlogik wie in der Liga, Startelf des Spiels.
          try {
            const seasonStats: Record<
              string,
              { goals: number; assists: number; ratingSum: number; matches: number }
            > = JSON.parse((await metaRepo.getMeta('seasonSquadStats')) || '{}');
            const side = userIsHome ? 'home' : 'away';
            const resultBonus = won ? 0.4 : draw ? 0.1 : -0.3;
            const oppScored = userIsHome ? ag : hg;
            for (const p of g2.lineupPlayers()) {
              if (!p) continue;
              const name = p.pool.name;
              const goals = result.events.filter(
                (e) => e.type === 'tor' && e.team === side && e.player === name,
              ).length;
              const assists = result.events.filter(
                (e) => e.type === 'tor' && e.team === side && e.assist === name,
              ).length;
              const cleanSheetBonus =
                oppScored === 0 && (p.pool.position === 'TW' || p.pool.position === 'CB' || p.pool.position === 'FB') ? 0.6 : 0;
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
          } catch {
            // Statistik ist optional – ein Fehler hier darf das Spiel nicht stören
          }

          // Ergebnis (samt Events für die Torschützen-Tabelle) in den Baum
          applyUserClResult(state, hg, ag, result.events);
          await persist(state);
          set({ state: { ...state } });

          // Turnier-Platzierung in den Trophäenschrank (V7.4): Sieger (Platz 1),
          // Finalist (Platz 2, Finale verloren) oder Bronze (Platz 3, Spiel um
          // Platz 3 gewonnen) – für CL UND Pokal. Die Meister-Animation kommt
          // NUR bei Platz 1 (division 0 = CL, -1 = Pokal, eigene Texte).
          const kind = isCup ? 'cup' : 'cl';
          if (state.champion === USER_CLUB_ID) {
            await addTournamentPlace(kind, 1);
            await addPassPoints(100); // Saisonpass: Turnier gewonnen (V7.9)
            useLeagueStore.setState({
              pendingCelebration: {
                clubName: club.name,
                division: isCup ? -1 : 0,
                captainPlayerId: g2.captainPlayerId,
              },
            });
          } else if (fixture.isThird) {
            if (won) await addTournamentPlace(kind, 3);
          } else if (fixture.stage === 'final') {
            await addTournamentPlace(kind, 2);
          }

          // Turnier-Sperren aktualisieren (V7.4): abgesessene raus, neue rote
          // Karten dieses Spiels als Sperre fürs nächste Turnierspiel rein.
          const side = userIsHome ? 'home' : 'away';
          const redCarded: Array<{ playerId: number; playerName: string }> = [];
          result.events
            .filter((e) => e.type === 'rot' && e.team === side && e.player)
            .forEach((e) => {
              const owned = g2.players.find((p) => p.pool.name === e.player);
              if (owned && !redCarded.some((r) => r.playerId === owned.id)) {
                redCarded.push({ playerId: owned.id, playerName: owned.pool.name });
              }
            });
          await useLeagueStore.getState().updateTournamentSuspensions(redCarded);

          // Verletzungen dieses Turnierspiels (V7.4): laufende runterzählen + neue
          const newInjuries = result.events
            .filter((e) => e.type === 'verletzung' && e.team === side && e.player)
            .map((e) => g2.players.find((p) => p.pool.name === e.player))
            .filter((p): p is NonNullable<typeof p> => !!p)
            .map((p) => ({
              playerId: p.id,
              playerName: p.pool.name,
              matches: 1 + Math.floor(Math.random() * 3),
            }));
          await useLeagueStore.getState().processMatchInjuries(newInjuries);

          useLeagueStore.setState({
            lastPlayedMatch: {
              match: { ...baseMatch, homeGoals: hg, awayGoals: ag, played: true, events: result.events },
              homeName, awayName, homeCrest, awayCrest, userIsHome,
              stats: result.stats,
              coinReward: { total: coins, breakdown },
              motm: result.motm,
            },
          });

          // Slot weiterschalten + ggf. Saison abschließen
          await useLeagueStore.getState().advanceDiv1Slot();
          return won ? (viaShootout ? tf(isCup ? 'cupRewardWin' : 'clRewardWin', { n: clWinReward(state, fixture.stage) }) : null) : null;
        };

        const hg0 = result.homeGoals;
        const ag0 = result.awayGoals;
        const isKoTie = fixture.stage !== 'group' && hg0 === ag0;

        if (isKoTie) {
          // K.o. und nach 90 Min remis → Elfmeterschießen (V7.3). Die 90-Minuten-
          // Anzeige bleibt stehen; erst nach dem Schießen wird abgeschlossen.
          const g2 = useGameStore.getState();
          const userShooters = g2
            .lineupPlayers()
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .sort((a, b) => b.pool.abschluss - a.pool.abschluss)
            .map((p) => p.pool.name);
          const oppShooters = (oppTeamData.roster ?? []).map((r) => r.name);
          pendingClFinish = async (userWon) => {
            // Der Sieger bekommt +1 Tor im Baum, damit winners() korrekt weiterkommt
            let hg = hg0;
            let ag = ag0;
            if (userWon) userIsHome ? hg++ : ag++;
            else userIsHome ? ag++ : hg++;
            return finishClResult(hg, ag, true);
          };
          set({
            pendingShootout: {
              isBoss: false,
              opponentName: oppTeamData.name,
              userShooters: userShooters.length > 0 ? userShooters : ['Your player'],
              oppShooters: oppShooters.length > 0 ? oppShooters : ['Opponent'],
            },
          });
          // Endstand-Anzeige (90 Min), Ergebnis wird erst nach dem Schießen gesetzt
          useLeagueStore.setState({
            lastPlayedMatch: {
              match: { ...baseMatch, homeGoals: hg0, awayGoals: ag0, played: true, events: result.events },
              homeName, awayName, homeCrest, awayCrest, userIsHome,
              stats: result.stats,
              motm: result.motm,
            },
          });
          return;
        }

        await finishClResult(hg0, ag0, false);
      },
    });

    return useLeagueStore.getState().lastPlayedMatch;
  },

  simulateNextRound: async () => {
    const state = get().state;
    if (!state) return;
    // Welche K.o.-Runde wird gleich gespielt? (für die Schnell-Wiedergabe, V7.3)
    let playStage: ClStage | null = null;
    for (const stage of KO_STAGES) {
      if (state.ko[stage].length === 0) break;
      if (state.ko[stage].some((m) => !m.played)) {
        playStage = stage;
        break;
      }
    }
    // Der Nutzer ist raus: nur die nächste offene CL-Runde simulieren
    simulateNextClRound(state);
    // Im Finale das Spiel um Platz 3 mitzeigen (V7.4)
    const playbackMatches =
      playStage && state.ko[playStage].length > 0
        ? [
            ...state.ko[playStage].map((m) => ({ ...m })),
            ...(playStage === 'final' && state.thirdPlace ? [{ ...state.thirdPlace }] : []),
          ]
        : [];
    const lastPlayback: TournamentPlayback | null =
      playStage && playbackMatches.length > 0 ? { stage: playStage, matches: playbackMatches } : null;
    await persist(state);
    set({ state: { ...state }, lastPlayback });
    await useLeagueStore.getState().advanceDiv1Slot();
  },

  resolveClShootout: async (won) => {
    const finish = pendingClFinish;
    pendingClFinish = null;
    set({ pendingShootout: null });
    if (!finish) return null;
    return finish(won);
  },

  abandonClShootout: () => {
    // Ohne Ende verlassen: zufällig entscheiden, damit das Turnier weiterläuft
    const finish = pendingClFinish;
    pendingClFinish = null;
    set({ pendingShootout: null });
    if (finish) void finish(Math.random() < 0.5);
  },
}));

/** Runden-Label (für Bracket-Anzeige). */
export function clStageLabel(stage: ClStage): string {
  return stage;
}

export type { ClMatch };
