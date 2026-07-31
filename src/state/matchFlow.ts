import {
  applyNpcHalftimeSubs, applyPenaltyResult, beginLiveMatch, continueLiveMatch,
  type LiveMatchState, type LiveOutcome, type SimResult, type SimTeam,
} from '../core/engine/matchSim';
import type { Tactic } from '../core/domain/types';
import { tf } from '../core/i18n';
import { useGameStore } from './gameStore';

/**
 * Live-Spielsteuerung (V5): Nutzer-Spiele (Liga, Platz-Kampf, Friendly)
 * laufen als fortsetzbare Simulation, die an zwei Stellen pausiert:
 *  - Elfmeter: der Nutzer schießt bzw. hält selbst (Minispiel im Ticker)
 *  - Halbzeit: Auswechslungen + Taktikwechsel wirken auf die 2. Hälfte
 *
 * Der jeweilige Store liefert Hooks (Teams bauen, Zwischenstand
 * veröffentlichen, Endergebnis finalisieren); der Live-Ticker ruft
 * resumeSecondHalf / resolveLivePenalty auf.
 *
 * Bewusst nur im Speicher: stirbt die App mitten im Spiel, wurde noch
 * nichts Endgültiges gespeichert und das Spiel kann neu angepfiffen werden.
 */

export type MatchPause =
  | { type: 'halftime' }
  | { type: 'penalty'; side: 'home' | 'away'; minute: number; shooter: string; keeper: string };

export interface UserMatchHooks {
  userIsHome: boolean;
  /** Fester Gegner (Kader wird bei NPC-Wechseln mutiert) */
  opponent: SimTeam;
  /** Nutzer-Team aus der AKTUELLEN Aufstellung bauen (auch nach Wechseln) */
  buildUserTeam: (tactic: Tactic) => Promise<SimTeam>;
  initialTactic: Tactic;
  /** Zwischenstand in den Live-Ticker schreiben (lastPlayedMatch) */
  publish: (state: LiveMatchState, pause: MatchPause) => void;
  /** Abpfiff: speichern, Belohnungen, Folgezustand */
  finalize: (result: SimResult) => Promise<void>;
}

let halftimeFn: ((tactic: Tactic) => Promise<void>) | null = null;
let penaltyFn: ((scored: boolean) => Promise<void>) | null = null;
let restoreLineupFn: (() => Promise<void>) | null = null;
let restoreTacticFn: (() => Promise<void>) | null = null;

/**
 * Verletzungs-Verschärfung (V7.5): Spieler, die sich in der 1. Halbzeit
 * verletzt haben und trotz Rückfrage NICHT ausgewechselt wurden. Ihre
 * Verletzung dauert am Ende 1–3 Spiele länger (processMatchInjuries wertet das
 * aus und leert die Liste). Nur im Speicher, pro Spiel.
 */
let aggravatedInjuries: string[] = [];

/** Namen der nicht-ausgewechselten Verletzten für dieses Spiel merken. */
export function markAggravatedInjuries(names: string[]): void {
  aggravatedInjuries = [...new Set([...aggravatedInjuries, ...names])];
}

/** Verschärfte Verletzungen abholen UND zurücksetzen (nach dem Spiel). */
export function takeAggravatedInjuries(): string[] {
  const list = aggravatedInjuries;
  aggravatedInjuries = [];
  return list;
}

/** Neutraler Standard, auf den die Taktik nach jedem Spiel zurückfällt (V7.4). */
const DEFAULT_TACTIC: Tactic = 'ausgewogen';

export async function resumeSecondHalf(tactic: Tactic): Promise<void> {
  const fn = halftimeFn;
  halftimeFn = null;
  if (fn) await fn(tactic);
}

export async function resolveLivePenalty(scored: boolean): Promise<void> {
  const fn = penaltyFn;
  penaltyFn = null;
  if (fn) await fn(scored);
}

/**
 * Externe Pausen-Handler registrieren (V6, Online-Spiele): der Online-Store
 * routet Resume/Elfmeter über das Netz statt in die lokale Simulation.
 */
export function registerPauseHandlers(handlers: {
  halftime?: (tactic: Tactic) => Promise<void>;
  penalty?: (scored: boolean) => Promise<void>;
}): void {
  if (handlers.halftime) halftimeFn = handlers.halftime;
  if (handlers.penalty) penaltyFn = handlers.penalty;
}

/**
 * Laufendes lokales Spiel abbrechen (z. B. Ticker in einer Pause verlassen):
 * Handler verwerfen und die Vor-Spiel-Aufstellung wiederherstellen.
 */
export async function abandonLiveMatch(): Promise<void> {
  halftimeFn = null;
  penaltyFn = null;
  aggravatedInjuries = [];
  const restore = restoreLineupFn;
  restoreLineupFn = null;
  const restoreTactic = restoreTacticFn;
  restoreTacticFn = null;
  if (restore) await restore();
  if (restoreTactic) await restoreTactic();
}

/** Ein Nutzer-Spiel starten und bis zum Abpfiff durch alle Pausen führen. */
export async function runUserMatch(hooks: UserMatchHooks): Promise<void> {
  halftimeFn = null;
  penaltyFn = null;
  aggravatedInjuries = [];
  // Aufstellung sichern (V5-Fix): Halbzeit-Wechsel gelten nur für DIESES
  // Spiel – nach dem Abpfiff (oder Abbruch) kommt die Elf von vorher zurück
  const lineupSnapshot = [...useGameStore.getState().lineup];
  const restoreLineup = async () => {
    const g = useGameStore.getState();
    if (lineupSnapshot.some((id, slot) => g.lineup[slot] !== id)) {
      await g.restoreLineup(lineupSnapshot);
    }
  };
  restoreLineupFn = restoreLineup;
  // Taktik zurücksetzen (V7.4-Fix): die während des Spiels (Kickoff/Halbzeit)
  // gesetzte Taktik gilt nur für DIESES Spiel. Nach dem Abpfiff/Abbruch fällt
  // der persistente club.tactic auf den neutralen Standard zurück, damit der
  // Vor-Spiel-Selektor nie versehentlich auf offensiv/defensiv steht.
  const restoreTactic = async () => {
    const g = useGameStore.getState();
    if (g.club && g.club.tactic !== DEFAULT_TACTIC) await g.setTactic(DEFAULT_TACTIC);
  };
  restoreTacticFn = restoreTactic;
  let userTeam = await hooks.buildUserTeam(hooks.initialTactic);
  const home = () => (hooks.userIsHome ? userTeam : hooks.opponent);
  const away = () => (hooks.userIsHome ? hooks.opponent : userTeam);

  const begin = beginLiveMatch(home(), away());
  let state = begin.state;

  const handle = async (outcome: LiveOutcome): Promise<void> => {
    if (outcome.kind === 'fulltime') {
      restoreLineupFn = null;
      restoreTacticFn = null;
      await restoreLineup();
      await restoreTactic();
      await hooks.finalize(outcome.result);
      return;
    }
    if (outcome.kind === 'halftime') {
      hooks.publish(state, { type: 'halftime' });
      halftimeFn = async (tactic) => {
        // Wechsel-Events (V5): eigene Wechsel aus dem Kader-Diff, dazu
        // 0-2 NPC-Wechsel des Gegners – alle bei Minute 45 im Ticker
        const before = (userTeam.roster ?? []).map((r) => r.name);
        userTeam = await hooks.buildUserTeam(tactic);
        const after = (userTeam.roster ?? []).map((r) => r.name);
        const userSide: 'home' | 'away' = hooks.userIsHome ? 'home' : 'away';
        const outs = before.filter((n) => !after.includes(n));
        const ins = after.filter((n) => !before.includes(n));
        for (let i = 0; i < Math.max(outs.length, ins.length); i++) {
          const inName = ins[i];
          const outName = outs[i];
          state.events.push({
            minute: 45,
            type: 'wechsel',
            team: userSide,
            text: inName && outName
              ? tf('simSubBoth', { club: userTeam.name, inName, outName })
              : inName
                ? tf('simSubIn', { club: userTeam.name, inName })
                : tf('simSubOut', { club: userTeam.name, outName }),
          });
        }
        const oppSide: 'home' | 'away' = hooks.userIsHome ? 'away' : 'home';
        applyNpcHalftimeSubs(hooks.opponent).forEach((s) => {
          state.events.push({
            minute: 45,
            type: 'wechsel',
            team: oppSide,
            text: tf('simSubBoth', { club: hooks.opponent.name, inName: s.into, outName: s.out }),
          });
        });
        await handle(continueLiveMatch(home(), away(), state));
      };
      return;
    }
    // Elfmeter: Ticker zeigt die Pause, Nutzer schießt/hält im Minispiel
    hooks.publish(state, { type: 'penalty', ...outcome.penalty });
    penaltyFn = async (scored) => {
      applyPenaltyResult(home(), away(), state, outcome.penalty, scored);
      await handle(continueLiveMatch(home(), away(), state));
    };
  };

  await handle(begin.outcome);
}
