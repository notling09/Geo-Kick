import {
  applyNpcHalftimeSubs, applyPenaltyResult, beginLiveMatch, continueLiveMatch,
  type LiveMatchState, type LiveOutcome, type SimResult, type SimTeam,
} from '../core/engine/matchSim';
import type { Tactic } from '../core/domain/types';

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

/** Ein Nutzer-Spiel starten und bis zum Abpfiff durch alle Pausen führen. */
export async function runUserMatch(hooks: UserMatchHooks): Promise<void> {
  halftimeFn = null;
  penaltyFn = null;
  let userTeam = await hooks.buildUserTeam(hooks.initialTactic);
  const home = () => (hooks.userIsHome ? userTeam : hooks.opponent);
  const away = () => (hooks.userIsHome ? hooks.opponent : userTeam);

  const begin = beginLiveMatch(home(), away());
  let state = begin.state;

  const handle = async (outcome: LiveOutcome): Promise<void> => {
    if (outcome.kind === 'fulltime') {
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
              ? `Substitution (${userTeam.name}): ${inName} ON for ${outName}.`
              : inName
                ? `Substitution (${userTeam.name}): ${inName} comes ON.`
                : `Substitution (${userTeam.name}): ${outName} goes OFF.`,
          });
        }
        const oppSide: 'home' | 'away' = hooks.userIsHome ? 'away' : 'home';
        applyNpcHalftimeSubs(hooks.opponent).forEach((s) => {
          state.events.push({
            minute: 45,
            type: 'wechsel',
            team: oppSide,
            text: `Substitution (${hooks.opponent.name}): ${s.into} ON for ${s.out}.`,
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
