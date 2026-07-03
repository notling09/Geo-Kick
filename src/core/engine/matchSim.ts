import { MATCH_SIM } from '../domain/constants';
import type { MatchEvent, Position, Tactic } from '../domain/types';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { pick, pickWeighted } from './random';

/**
 * Minuten-für-Minute-Simulation (Kapitel 3.4 / 8.2).
 *
 * Pro Spielminute wird geprüft, ob ein Ereignis stattfindet (Basis 8 % für
 * eine Chance). Bei einer Chance entscheidet das Stärkeverhältnis beider
 * Teams über ein Tor: P(Tor) = Stärke A ÷ (Stärke A + Stärke B), mit einem
 * kleinen Zufalls-Faktor. Offensive Taktik erhöht die Chancenhäufigkeit,
 * senkt aber die eigene Abwehrstärke leicht (und umgekehrt).
 */

export interface SimTeam {
  name: string;
  /** Gesamtstärke: Summe der positionsgewichteten Overalls der Aufstellung */
  strength: number;
  tactic: Tactic;
  /**
   * Aufgestellte Spieler für namentliche Ticker-Events (Torschütze usw.).
   * NPC-Teams ohne Kader bekommen zufällige fiktive Namen.
   */
  roster?: Array<{ name: string; position: Position }>;
}

export interface SimResult {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

function tacticAttack(strength: number, tactic: Tactic): number {
  if (tactic === 'offensiv') return strength * (1 + MATCH_SIM.tacticModifier);
  if (tactic === 'defensiv') return strength * (1 - MATCH_SIM.tacticModifier);
  return strength;
}

function tacticDefense(strength: number, tactic: Tactic): number {
  if (tactic === 'offensiv') return strength * (1 - MATCH_SIM.tacticModifier);
  if (tactic === 'defensiv') return strength * (1 + MATCH_SIM.tacticModifier);
  return strength;
}

function tacticChanceRate(tactic: Tactic): number {
  const base = MATCH_SIM.chancePerMinute / 2; // pro Team die halbe Basisrate
  if (tactic === 'offensiv') return base * (1 + MATCH_SIM.tacticChanceModifier);
  if (tactic === 'defensiv') return base * (1 - MATCH_SIM.tacticChanceModifier);
  return base;
}

const CHANCE_TEXTS = [
  'fires just past the post - big chance!',
  'strikes from distance, the keeper tips it over the bar.',
  'leads the counter-attack, but the final pass is overhit.',
  'heads the cross inches over the crossbar.',
  'is through one-on-one but the keeper stands tall.',
];

const GOAL_TEXTS = [
  'with a dry finish into the far corner!',
  'rises highest and heads it in - unstoppable!',
  'finishes a dream combination ice-cold!',
  'sees his deflected shot beat the keeper!',
  'caps off a textbook counter-attack!',
];

const CORNER_TEXTS = ['Corner kick - the delivery is cleared.', 'Corner from the left, the keeper claims it safely.'];
const FOUL_TEXTS = [
  'goes in hard in midfield - free kick.',
  'stops the attack with a tactical foul, the referee has a word.',
];

function pickText(texts: readonly string[]): string {
  return texts[Math.floor(Math.random() * texts.length)];
}

/** Positions-Gewichte: wer erzielt Tore/hat Chancen (Stürmer am ehesten). */
const SCORER_WEIGHTS: Record<Position, number> = { ST: 5, MF: 3, ABW: 1.2, TW: 0.1 };

function pickPlayerName(team: SimTeam, weights?: Record<Position, number>): string {
  if (team.roster && team.roster.length > 0) {
    if (!weights) return pick(team.roster).name;
    return pickWeighted(
      team.roster.map((p) => ({ value: p.name, weight: weights[p.position] ?? 1 })),
    );
  }
  // NPC ohne Kader: fiktiver Name (Kapitel 9: frei erfundene Namen)
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export function simulateMatch(home: SimTeam, away: SimTeam): SimResult {
  const events: MatchEvent[] = [];
  let homeGoals = 0;
  let awayGoals = 0;

  events.push({ minute: 1, type: 'anpfiff', text: 'Kick-off! The match is under way.' });

  const homeChanceRate = tacticChanceRate(home.tactic);
  const awayChanceRate = tacticChanceRate(away.tactic);

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 46) {
      events.push({
        minute: 45,
        type: 'halbzeit',
        text: `Half-time. The score is ${homeGoals}:${awayGoals}.`,
      });
    }

    const roll = Math.random();
    if (roll < homeChanceRate + awayChanceRate) {
      // Wer hat die Chance? Gewichtet nach (taktik-modifizierter) Chancenrate und Stärke
      const attackerSide = pickWeighted<'home' | 'away'>([
        { value: 'home', weight: homeChanceRate * home.strength },
        { value: 'away', weight: awayChanceRate * away.strength },
      ]);
      const atk = attackerSide === 'home' ? home : away;
      const def = attackerSide === 'home' ? away : home;

      const atkStrength = tacticAttack(atk.strength, atk.tactic);
      const defStrength = tacticDefense(def.strength, def.tactic);
      const noise = (Math.random() * 2 - 1) * MATCH_SIM.goalNoise;
      // Konversionsfaktor drückt den Schnitt von ~3,8 auf ~2,9 Tore/Spiel
      // (Feinjustierung nach ersten Tests, Kapitel 8)
      const goalProb =
        (atkStrength / (atkStrength + defStrength) + noise) * MATCH_SIM.goalConversion;

      if (Math.random() < goalProb) {
        if (attackerSide === 'home') homeGoals++;
        else awayGoals++;
        const scorer = pickPlayerName(atk, SCORER_WEIGHTS);
        events.push({
          minute,
          type: 'tor',
          team: attackerSide,
          text: `GOAL! ${scorer} (${atk.name}) ${pickText(GOAL_TEXTS)} ${homeGoals}:${awayGoals}`,
        });
      } else {
        const player = pickPlayerName(atk, SCORER_WEIGHTS);
        events.push({
          minute,
          type: 'chance',
          team: attackerSide,
          text: `${player} (${atk.name}) ${pickText(CHANCE_TEXTS)}`,
        });
      }
    } else if (roll < homeChanceRate + awayChanceRate + MATCH_SIM.cornerPerMinute) {
      const side = Math.random() < home.strength / (home.strength + away.strength) ? 'home' : 'away';
      events.push({ minute, type: 'ecke', team: side, text: `${side === 'home' ? home.name : away.name}: ${pickText(CORNER_TEXTS)}` });
    } else if (roll < homeChanceRate + awayChanceRate + MATCH_SIM.cornerPerMinute + MATCH_SIM.foulPerMinute) {
      const side = Math.random() < 0.5 ? 'home' : 'away';
      const team = side === 'home' ? home : away;
      events.push({
        minute,
        type: 'foul',
        team: side,
        text: `${pickPlayerName(team)} (${team.name}) ${pickText(FOUL_TEXTS)}`,
      });
    }
  }

  events.push({
    minute: 90,
    type: 'abpfiff',
    text: `Full-time! Final score ${homeGoals}:${awayGoals}.`,
  });

  return { homeGoals, awayGoals, events };
}
