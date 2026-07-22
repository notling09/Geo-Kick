import { create } from 'zustand';
import { CHAMPIONS_LEAGUE, USER_CLUB_ID } from '../core/domain/constants';
import type { Tactic } from '../core/domain/types';
import type { SimTeam } from '../core/engine/matchSim';
import {
  advanceCl, applyUserClResult, clWinReward, createClState, nextUserClMatch,
  type ClMatch, type ClStage, type ClState,
} from '../core/engine/cl';
import { generateNpcRoster } from '../core/engine/league';
import { teamStrength } from '../core/engine/strength';
import { tf } from '../core/i18n';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';
import { runUserMatch } from './matchFlow';
import { addClTitle } from '../core/services/trophies';

/**
 * Champions League (V7): hält den Turnierzustand für die aktuelle Division-1-
 * Saison. Der leagueStore taktet über den div1Slot, WANN ein CL-Spiel dran ist;
 * dieser Store führt es aus (live gegen den nächsten Gegner) bzw. simuliert die
 * Runde, wenn der Nutzer bereits ausgeschieden ist.
 */

interface ClStore {
  state: ClState | null;

  hydrate: (season: number) => Promise<void>;
  /** CL für die Saison sicherstellen (in Division 1 anlegen). */
  ensureSeason: (season: number) => Promise<void>;
  /** Bei Div-Wechsel/Karriere-Reset: CL verwerfen. */
  clear: () => Promise<void>;
  /** Das nächste CL-Spiel des Nutzers live spielen. */
  playUserClMatch: (tactic: Tactic) => Promise<PlayedUserMatch | null>;
  /** Nutzer ausgeschieden: die nächste CL-Runde simulieren (nur Anzeige). */
  simulateNextRound: () => Promise<void>;
}

async function persist(state: ClState | null): Promise<void> {
  await metaRepo.setMeta('clState', state ? JSON.stringify(state) : '');
}

function userTeamFactory(): (t: Tactic) => Promise<SimTeam> {
  return async (t) => {
    const g = useGameStore.getState();
    await g.setTactic(t);
    const lineupNow = g.lineupPlayers();
    return {
      name: g.club?.name ?? 'My Club',
      strength: teamStrength(lineupNow, g.club?.formation ?? '4-4-2'),
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
    set({ state });
  },

  ensureSeason: async (season) => {
    const game = useGameStore.getState();
    if ((game.club?.division ?? 4) !== 1) {
      set({ state: null });
      await persist(null);
      return;
    }
    if (get().state && get().state?.season === season) return;
    const strength = teamStrength(game.lineupPlayers(), game.club?.formation ?? '4-4-2');
    const state = createClState(season, {
      strength,
      name: game.club?.name ?? 'My Club',
      crest: game.club?.crest ?? 'crest-0',
    });
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

    const userIsHome = fixture.homeId === USER_CLUB_ID;
    const oppId = userIsHome ? fixture.awayId : fixture.homeId;
    const oppTeamData = state.teams[oppId];
    // Steigende Schwierigkeit: Gegnerstärke je Runde skaliert (Nutzerwunsch)
    const factor = CHAMPIONS_LEAGUE.difficulty[fixture.stage] ?? 1;
    const oppTeam: SimTeam = {
      name: oppTeamData.name,
      strength: Math.round(oppTeamData.strength * factor),
      tactic: 'ausgewogen',
      roster: generateNpcRoster(),
    };

    const baseMatch = {
      id: 0,
      season: state.season,
      division: 1,
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
      initialTactic: club.tactic,
      buildUserTeam: userTeamFactory(),
      publish: (st, pause) =>
        useLeagueStore.setState({
          lastPlayedMatch: {
            match: { ...baseMatch, homeGoals: st.homeGoals, awayGoals: st.awayGoals, played: false, events: st.events },
            homeName, awayName, homeCrest, awayCrest, userIsHome, pause,
          },
        }),
      finalize: async (result) => {
        const g2 = useGameStore.getState();
        const userGoals = userIsHome ? result.homeGoals : result.awayGoals;
        const oppGoals = userIsHome ? result.awayGoals : result.homeGoals;
        // K.o.-Spiele dürfen nicht remis enden: der Nutzer bekommt bei
        // Gleichstand einen knappen Zufalls-Ausgang (fair, aber spannend)
        let hg = result.homeGoals;
        let ag = result.awayGoals;
        if (fixture.stage !== 'group' && hg === ag) {
          if (Math.random() < 0.5) (userIsHome ? (hg++) : (ag++));
          else (userIsHome ? (ag++) : (hg++));
        }
        const finalUserGoals = userIsHome ? hg : ag;
        const finalOppGoals = userIsHome ? ag : hg;
        const won = finalUserGoals > finalOppGoals;

        // CL-Coins nur bei Sieg (steigend je Runde)
        const breakdown: string[] = [];
        let coins = 0;
        if (won) {
          coins = clWinReward(fixture.stage);
          if (coins > 0) {
            await g2.addCoins(coins);
            breakdown.push(tf('clRewardWin', { n: coins }));
          }
        }

        // Ergebnis in den Turnierbaum eintragen und vorantreiben
        applyUserClResult(state, hg, ag);
        await persist(state);
        set({ state: { ...state } });

        // CL-Titel + Meister-Animation, wenn der Nutzer die CL gewinnt
        if (state.champion === USER_CLUB_ID) {
          await addClTitle();
          useLeagueStore.setState({
            pendingCelebration: {
              clubName: club.name,
              division: 0, // 0 = Champions League (eigener Titeltext)
              captainPlayerId: g2.captainPlayerId,
            },
          });
        }

        useLeagueStore.setState({
          lastPlayedMatch: {
            match: { ...baseMatch, homeGoals: hg, awayGoals: ag, played: true, events: result.events },
            homeName, awayName, homeCrest, awayCrest, userIsHome,
            stats: result.stats,
            coinReward: { total: coins, breakdown },
            motm: result.motm,
          },
        });

        // Slot weiterschalten + ggf. Div-1-Saison abschließen
        await useLeagueStore.getState().advanceDiv1Slot();
      },
    });

    return useLeagueStore.getState().lastPlayedMatch;
  },

  simulateNextRound: async () => {
    const state = get().state;
    if (!state) return;
    // Der Nutzer ist raus: die nächste CL-Runde komplett simulieren
    advanceCl(state);
    await persist(state);
    set({ state: { ...state } });
    await useLeagueStore.getState().advanceDiv1Slot();
  },
}));

/** Runden-Label (für Bracket-Anzeige). */
export function clStageLabel(stage: ClStage): string {
  return stage;
}

export type { ClMatch };
