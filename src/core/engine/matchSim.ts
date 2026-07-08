import { MATCH_SIM } from '../domain/constants';
import type { MatchEvent, MatchStats, Position, Tactic, TeamStats } from '../domain/types';
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
  stats: MatchStats;
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
/** Positions-Gewichte für Vorlagen (Mittelfeld am ehesten). */
const ASSIST_WEIGHTS: Record<Position, number> = { ST: 2.5, MF: 5, ABW: 1.5, TW: 0.2 };

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

function emptyStats(): TeamStats {
  return { goals: 0, xg: 0, shots: 0, possession: 50, corners: 0, fouls: 0, yellows: 0, reds: 0 };
}

export function simulateMatch(home: SimTeam, away: SimTeam): SimResult {
  const events: MatchEvent[] = [];
  let homeGoals = 0;
  let awayGoals = 0;
  const stats: MatchStats = { home: emptyStats(), away: emptyStats() };
  // Effektive Stärken sind veränderlich: rote Karte = Unterzahl-Malus
  let homeStrength = home.strength;
  let awayStrength = away.strength;
  // Gelbe Karten je Spieler (zweite Gelbe = Rot)
  const yellowBook = new Map<string, number>();

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
        { value: 'home', weight: homeChanceRate * homeStrength },
        { value: 'away', weight: awayChanceRate * awayStrength },
      ]);
      const atk = attackerSide === 'home' ? home : away;
      const atkStr = attackerSide === 'home' ? homeStrength : awayStrength;
      const defStr = attackerSide === 'home' ? awayStrength : homeStrength;
      const atkStats = stats[attackerSide];

      const atkStrength = tacticAttack(atkStr, atk.tactic);
      const defStrength = tacticDefense(defStr, attackerSide === 'home' ? away.tactic : home.tactic);
      const noise = (Math.random() * 2 - 1) * MATCH_SIM.goalNoise;
      // Konversionsfaktor drückt den Schnitt von ~3,8 auf ~2,9 Tore/Spiel
      // (Feinjustierung nach ersten Tests, Kapitel 8)
      const goalProb =
        (atkStrength / (atkStrength + defStrength) + noise) * MATCH_SIM.goalConversion;

      // Jede Chance ist ein Torschuss; xG = Summe der Tor-Wahrscheinlichkeiten
      atkStats.shots++;
      atkStats.xg += Math.max(0.02, Math.min(goalProb, 0.95));

      if (Math.random() < goalProb) {
        if (attackerSide === 'home') homeGoals++;
        else awayGoals++;
        atkStats.goals++;
        const scorer = pickPlayerName(atk, SCORER_WEIGHTS);
        // ~70 % der Tore mit Vorlage – Vorlagengeber ≠ Torschütze
        let assist: string | undefined;
        if (Math.random() < 0.7) {
          for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = pickPlayerName(atk, ASSIST_WEIGHTS);
            if (candidate !== scorer) {
              assist = candidate;
              break;
            }
          }
        }
        events.push({
          minute,
          type: 'tor',
          team: attackerSide,
          player: scorer,
          assist,
          text:
            `GOAL! ${scorer} (${atk.name}) ${pickText(GOAL_TEXTS)} ${homeGoals}:${awayGoals}` +
            (assist ? ` (assist: ${assist})` : ''),
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
      const side = Math.random() < homeStrength / (homeStrength + awayStrength) ? 'home' : 'away';
      stats[side].corners++;
      events.push({ minute, type: 'ecke', team: side, text: `${side === 'home' ? home.name : away.name}: ${pickText(CORNER_TEXTS)}` });
    } else if (roll < homeChanceRate + awayChanceRate + MATCH_SIM.cornerPerMinute + MATCH_SIM.foulPerMinute) {
      const side = Math.random() < 0.5 ? 'home' : 'away';
      const team = side === 'home' ? home : away;
      const offender = pickPlayerName(team);
      stats[side].fouls++;
      events.push({
        minute,
        type: 'foul',
        team: side,
        text: `${offender} (${team.name}) ${pickText(FOUL_TEXTS)}`,
      });

      // Karten: gelb, zweite gelbe oder glatt rot (Kapitel-8-Feinjustierung V2)
      const cardRoll = Math.random();
      const bookKey = `${side}:${offender}`;
      if (cardRoll < MATCH_SIM.straightRedPerFoul) {
        stats[side].reds++;
        events.push({
          minute,
          type: 'rot',
          team: side,
          player: offender,
          text: `RED CARD! ${offender} (${team.name}) is sent off for a reckless challenge!`,
        });
        if (side === 'home') homeStrength *= MATCH_SIM.redCardPenalty;
        else awayStrength *= MATCH_SIM.redCardPenalty;
      } else if (cardRoll < MATCH_SIM.straightRedPerFoul + MATCH_SIM.yellowPerFoul) {
        const yellows = (yellowBook.get(bookKey) ?? 0) + 1;
        yellowBook.set(bookKey, yellows);
        if (yellows >= 2) {
          stats[side].reds++;
          events.push({
            minute,
            type: 'rot',
            team: side,
            player: offender,
            text: `Second yellow - RED CARD! ${offender} (${team.name}) has to go off!`,
          });
          if (side === 'home') homeStrength *= MATCH_SIM.redCardPenalty;
          else awayStrength *= MATCH_SIM.redCardPenalty;
        } else {
          stats[side].yellows++;
          events.push({
            minute,
            type: 'gelb',
            team: side,
            player: offender,
            text: `Yellow card for ${offender} (${team.name}).`,
          });
        }
      }
    }
  }

  events.push({
    minute: 90,
    type: 'abpfiff',
    text: `Full-time! Final score ${homeGoals}:${awayGoals}.`,
  });

  // Ballbesitz aus dem Stärkeverhältnis (plus etwas Rauschen), 30–70 %
  const possHome = Math.round(
    Math.min(70, Math.max(30, 50 + ((home.strength - away.strength) / (home.strength + away.strength)) * 60 + (Math.random() * 8 - 4))),
  );
  stats.home.possession = possHome;
  stats.away.possession = 100 - possHome;
  stats.home.xg = Math.round(stats.home.xg * 10) / 10;
  stats.away.xg = Math.round(stats.away.xg * 10) / 10;

  return { homeGoals, awayGoals, events, stats };
}
