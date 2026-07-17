import { t, tf, type TKey } from '../i18n';
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
 * kleinen Zufalls-Faktor. Offensive Taktik erhöht die Chancenhäufigkeit
 * deutlich, senkt aber die eigene Abwehrstärke (und umgekehrt).
 *
 * V5: Die Simulation läuft in ZWEI Halbzeiten. Nutzer-Spiele pausieren zur
 * Halbzeit – Auswechslungen und ein Taktikwechsel wirken sich dann wirklich
 * auf die zweite Hälfte aus (simulateFirstHalf → Pause → simulateSecondHalf
 * mit aktualisierten Teams). simulateMatch bleibt der Ein-Schritt-Weg für
 * NPC-Spiele.
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

/** Man of the Match (V4): bester Spieler mit Note bis 10 und Kurzbegründung. */
export interface MatchMotm {
  name: string;
  team: 'home' | 'away';
  teamName: string;
  /** Note auf eine Dezimalstelle, maximal 10 */
  rating: number;
  /** z. B. "2 goals, 1 assist" oder "5 saves, clean sheet" */
  summary: string;
}

export interface SimResult {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: MatchStats;
  motm: MatchMotm;
}

/** Zwischenstand zur Halbzeit (V5): alles, was die 2. Hälfte fortführt. */
export interface HalfTimeState {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: MatchStats;
  /** Gelbe Karten je "seite:spieler" (zweite Gelbe = Rot) */
  yellow: Array<[string, number]>;
  /** Stärke-Faktoren aus roten Karten (1 = vollzählig) */
  homeStrengthFactor: number;
  awayStrengthFactor: number;
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

// Ticker-Texte: Übersetzungs-Schlüssel, erst beim Ziehen aufgelöst (i18n)
const CHANCE_TEXTS: TKey[] = ['simChance1', 'simChance2', 'simChance3', 'simChance4', 'simChance5'];
const GOAL_TEXTS: TKey[] = ['simGoal1', 'simGoal2', 'simGoal3', 'simGoal4', 'simGoal5'];
const CORNER_TEXTS: TKey[] = ['simCorner1', 'simCorner2'];
const FOUL_TEXTS: TKey[] = ['simFoul1', 'simFoul2'];

function pickText(keys: readonly TKey[]): string {
  return t(keys[Math.floor(Math.random() * keys.length)]);
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
  return {
    goals: 0, xg: 0, shots: 0, possession: 50, corners: 0, fouls: 0,
    yellows: 0, reds: 0, saves: 0,
  };
}

/** Torwart-Name eines Teams (Kader: erster TW; sonst fiktiver Name). */
function keeperName(team: SimTeam): string {
  const keeper = team.roster?.find((p) => p.position === 'TW');
  return keeper?.name ?? pickPlayerName(team);
}

/**
 * Man of the Match (V4): Torschützen/Vorbereiter sammeln Punkte auf eine
 * Basisnote von 6,5; Torhüter kommen über Paraden und Zu-null-Spiele in
 * Frage ("verteidigt"). Die beste Note gewinnt.
 */
function computeMotm(
  home: SimTeam,
  away: SimTeam,
  events: MatchEvent[],
  stats: MatchStats,
  homeGoals: number,
  awayGoals: number,
): MatchMotm {
  const winner: 'home' | 'away' | null =
    homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : null;
  const teamBonus = (team: 'home' | 'away') =>
    winner === null ? 0.1 : winner === team ? 0.4 : -0.2;

  interface Candidate extends MatchMotm {}
  const candidates: Candidate[] = [];

  // Feldspieler: Tore + Assists aus den Ticker-Events
  const contributions = new Map<string, { team: 'home' | 'away'; goals: number; assists: number }>();
  const bump = (team: 'home' | 'away', name: string, kind: 'goals' | 'assists') => {
    const key = `${team}:${name}`;
    const entry = contributions.get(key) ?? { team, goals: 0, assists: 0 };
    entry[kind]++;
    contributions.set(key, entry);
  };
  events.forEach((e) => {
    if (e.type !== 'tor' || !e.team) return;
    if (e.player) bump(e.team, e.player, 'goals');
    if (e.assist) bump(e.team, e.assist, 'assists');
  });
  contributions.forEach((c, key) => {
    const name = key.slice(key.indexOf(':') + 1);
    const rating = Math.min(10, 6.5 + c.goals * 1.2 + c.assists * 0.6 + teamBonus(c.team));
    const parts: string[] = [];
    if (c.goals > 0) parts.push(tf(c.goals > 1 ? 'motmGoalsPl' : 'motmGoals', { n: c.goals }));
    if (c.assists > 0) parts.push(tf(c.assists > 1 ? 'motmAssistsPl' : 'motmAssists', { n: c.assists }));
    candidates.push({
      name,
      team: c.team,
      teamName: c.team === 'home' ? home.name : away.name,
      rating,
      summary: parts.join(', '),
    });
  });

  // Torhüter: Paraden + Zu-null zählen als "verteidigt"
  (['home', 'away'] as const).forEach((side) => {
    const conceded = side === 'home' ? awayGoals : homeGoals;
    const saves = stats[side].saves;
    if (conceded === 0 || saves >= 4) {
      const parts: string[] = [];
      if (saves > 0) parts.push(tf(saves > 1 ? 'motmSavesPl' : 'motmSaves', { n: saves }));
      if (conceded === 0) parts.push(t('motmCleanSheet'));
      candidates.push({
        name: keeperName(side === 'home' ? home : away),
        team: side,
        teamName: side === 'home' ? home.name : away.name,
        rating: Math.min(10, 6.5 + saves * 0.35 + (conceded === 0 ? 0.8 : 0) + teamBonus(side)),
        summary: parts.join(', ') || t('motmSolid'),
      });
    }
  });

  // Fallback (praktisch nie): solider Torwart des Teams mit weniger Gegentoren
  if (candidates.length === 0) {
    const side: 'home' | 'away' = awayGoals <= homeGoals ? 'away' : 'home';
    candidates.push({
      name: keeperName(side === 'home' ? home : away),
      team: side,
      teamName: side === 'home' ? home.name : away.name,
      rating: 6.8,
      summary: t('motmKept'),
    });
  }

  const best = candidates.sort((a, b) => b.rating - a.rating)[0];
  return { ...best, rating: Math.round(best.rating * 10) / 10 };
}

/** Veränderlicher Spielzustand während der Minuten-Schleife. */
interface SimContext {
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
  stats: MatchStats;
  yellowBook: Map<string, number>;
  homeStrength: number;
  awayStrength: number;
}

/** Elfmeter im laufenden Spiel (V5): selten, aber spürbar. */
const PENALTY_PER_MINUTE = 0.005; // ~0,45 Elfmeter pro Spiel
const PENALTY_GOAL_PROB = 0.8;

/**
 * Elfmeter ausführen (mutiert ctx): Tor oder Parade samt Ticker-Event.
 * Wird sowohl automatisch (NPC-Spiele) als auch nach der interaktiven
 * Eingabe des Nutzers benutzt.
 */
function executePenalty(
  ctx: SimContext,
  home: SimTeam,
  away: SimTeam,
  side: 'home' | 'away',
  minute: number,
  scored: boolean,
  shooter: string,
  keeper: string,
): void {
  const atk = side === 'home' ? home : away;
  const def = side === 'home' ? away : home;
  const defSide: 'home' | 'away' = side === 'home' ? 'away' : 'home';
  ctx.stats[side].shots++;
  ctx.stats[side].xg += 0.79; // übliche Elfmeter-Torwahrscheinlichkeit
  if (scored) {
    if (side === 'home') ctx.homeGoals++;
    else ctx.awayGoals++;
    ctx.stats[side].goals++;
    ctx.events.push({
      minute,
      type: 'tor',
      team: side,
      player: shooter,
      text: tf('simPenaltyGoal', { shooter, club: atk.name, score: `${ctx.homeGoals}:${ctx.awayGoals}` }),
    });
  } else {
    ctx.stats[defSide].saves++;
    ctx.events.push({
      minute,
      type: 'parade',
      team: defSide,
      player: keeper,
      text: tf('simPenaltySaved', { keeper, club: def.name, shooter }),
    });
  }
}

/** Anstehender Elfmeter, wenn die Live-Simulation pausiert (V5). */
export interface PenaltyPause {
  side: 'home' | 'away';
  minute: number;
  shooter: string;
  keeper: string;
}

/** Die Minuten-Schleife für einen Spielabschnitt (mutiert ctx). */
function simulateRange(
  ctx: SimContext,
  home: SimTeam,
  away: SimTeam,
  from: number,
  to: number,
  pauseOnPenalty = false,
): { penalty?: PenaltyPause } {
  const homeChanceRate = tacticChanceRate(home.tactic);
  const awayChanceRate = tacticChanceRate(away.tactic);

  for (let minute = from; minute <= to; minute++) {
    // Elfmeter (V5): Pfiff, dann pausieren (Nutzer schießt/hält selbst)
    // oder automatisch ausführen (NPC-Spiele)
    if (Math.random() < PENALTY_PER_MINUTE) {
      const side = pickWeighted<'home' | 'away'>([
        { value: 'home', weight: ctx.homeStrength },
        { value: 'away', weight: ctx.awayStrength },
      ]);
      const atk = side === 'home' ? home : away;
      const def = side === 'home' ? away : home;
      ctx.events.push({
        minute,
        type: 'elfmeter',
        team: side,
        text: tf('simPenaltyAwarded', { club: atk.name }),
      });
      const shooter = pickPlayerName(atk, SCORER_WEIGHTS);
      const keeper = keeperName(def);
      if (pauseOnPenalty) {
        return { penalty: { side, minute, shooter, keeper } };
      }
      executePenalty(ctx, home, away, side, minute, Math.random() < PENALTY_GOAL_PROB, shooter, keeper);
      continue;
    }

    const roll = Math.random();
    if (roll < homeChanceRate + awayChanceRate) {
      // Wer hat die Chance? Gewichtet nach (taktik-modifizierter) Chancenrate und Stärke
      const attackerSide = pickWeighted<'home' | 'away'>([
        { value: 'home', weight: homeChanceRate * ctx.homeStrength },
        { value: 'away', weight: awayChanceRate * ctx.awayStrength },
      ]);
      const atk = attackerSide === 'home' ? home : away;
      const atkStr = attackerSide === 'home' ? ctx.homeStrength : ctx.awayStrength;
      const defStr = attackerSide === 'home' ? ctx.awayStrength : ctx.homeStrength;
      const atkStats = ctx.stats[attackerSide];

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
        if (attackerSide === 'home') ctx.homeGoals++;
        else ctx.awayGoals++;
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
        ctx.events.push({
          minute,
          type: 'tor',
          team: attackerSide,
          player: scorer,
          assist,
          text:
            tf('simGoal', {
              scorer,
              club: atk.name,
              flavor: pickText(GOAL_TEXTS),
              score: `${ctx.homeGoals}:${ctx.awayGoals}`,
            }) + (assist ? tf('simAssist', { name: assist }) : ''),
        });
      } else {
        // Kein Tor: in ~65 % der Fälle hält der gegnerische Torwart (V4: Saves)
        if (Math.random() < 0.65) {
          ctx.stats[attackerSide === 'home' ? 'away' : 'home'].saves++;
        }
        const player = pickPlayerName(atk, SCORER_WEIGHTS);
        ctx.events.push({
          minute,
          type: 'chance',
          team: attackerSide,
          text: tf('simChanceLine', { player, club: atk.name, flavor: pickText(CHANCE_TEXTS) }),
        });
      }
    } else if (roll < homeChanceRate + awayChanceRate + MATCH_SIM.cornerPerMinute) {
      const side = Math.random() < ctx.homeStrength / (ctx.homeStrength + ctx.awayStrength) ? 'home' : 'away';
      ctx.stats[side].corners++;
      ctx.events.push({
        minute,
        type: 'ecke',
        team: side,
        text: tf('simCornerLine', { club: side === 'home' ? home.name : away.name, flavor: pickText(CORNER_TEXTS) }),
      });
    } else if (roll < homeChanceRate + awayChanceRate + MATCH_SIM.cornerPerMinute + MATCH_SIM.foulPerMinute) {
      const side = Math.random() < 0.5 ? 'home' : 'away';
      const team = side === 'home' ? home : away;
      const offender = pickPlayerName(team);
      ctx.stats[side].fouls++;
      ctx.events.push({
        minute,
        type: 'foul',
        team: side,
        text: tf('simFoulLine', { player: offender, club: team.name, flavor: pickText(FOUL_TEXTS) }),
      });

      // Karten: gelb, zweite gelbe oder glatt rot (Kapitel-8-Feinjustierung V2)
      const cardRoll = Math.random();
      const bookKey = `${side}:${offender}`;
      if (cardRoll < MATCH_SIM.straightRedPerFoul) {
        ctx.stats[side].reds++;
        ctx.events.push({
          minute,
          type: 'rot',
          team: side,
          player: offender,
          text: tf('simRed', { player: offender, club: team.name }),
        });
        if (side === 'home') ctx.homeStrength *= MATCH_SIM.redCardPenalty;
        else ctx.awayStrength *= MATCH_SIM.redCardPenalty;
      } else if (cardRoll < MATCH_SIM.straightRedPerFoul + MATCH_SIM.yellowPerFoul) {
        const yellows = (ctx.yellowBook.get(bookKey) ?? 0) + 1;
        ctx.yellowBook.set(bookKey, yellows);
        if (yellows >= 2) {
          ctx.stats[side].reds++;
          ctx.events.push({
            minute,
            type: 'rot',
            team: side,
            player: offender,
            text: tf('simSecondYellow', { player: offender, club: team.name }),
          });
          if (side === 'home') ctx.homeStrength *= MATCH_SIM.redCardPenalty;
          else ctx.awayStrength *= MATCH_SIM.redCardPenalty;
        } else {
          ctx.stats[side].yellows++;
          ctx.events.push({
            minute,
            type: 'gelb',
            team: side,
            player: offender,
            text: tf('simYellow', { player: offender, club: team.name }),
          });
        }
      }
    }
  }
  return {};
}

/** Erste Halbzeit simulieren (V5): endet mit dem Halbzeit-Zwischenstand. */
export function simulateFirstHalf(home: SimTeam, away: SimTeam): HalfTimeState {
  const ctx: SimContext = {
    events: [],
    homeGoals: 0,
    awayGoals: 0,
    stats: { home: emptyStats(), away: emptyStats() },
    yellowBook: new Map(),
    homeStrength: home.strength,
    awayStrength: away.strength,
  };
  ctx.events.push({ minute: 1, type: 'anpfiff', text: t('simKickoff') });
  simulateRange(ctx, home, away, 1, 45);
  ctx.events.push({
    minute: 45,
    type: 'halbzeit',
    text: tf('simHalftime', { score: `${ctx.homeGoals}:${ctx.awayGoals}` }),
  });
  return {
    homeGoals: ctx.homeGoals,
    awayGoals: ctx.awayGoals,
    events: ctx.events,
    stats: ctx.stats,
    yellow: [...ctx.yellowBook.entries()],
    homeStrengthFactor: ctx.homeStrength / home.strength,
    awayStrengthFactor: ctx.awayStrength / away.strength,
  };
}

/**
 * Zweite Halbzeit simulieren (V5): home/away dürfen sich gegenüber der
 * ersten Hälfte unterscheiden (Auswechslungen → neue Stärke/Kader, neue
 * Taktik). Rote-Karten-Malusse aus Hälfte 1 wirken weiter.
 */
export function simulateSecondHalf(home: SimTeam, away: SimTeam, half: HalfTimeState): SimResult {
  const ctx: SimContext = {
    events: half.events,
    homeGoals: half.homeGoals,
    awayGoals: half.awayGoals,
    stats: half.stats,
    yellowBook: new Map(half.yellow),
    homeStrength: home.strength * half.homeStrengthFactor,
    awayStrength: away.strength * half.awayStrengthFactor,
  };
  simulateRange(ctx, home, away, 46, 90);

  ctx.events.push({
    minute: 90,
    type: 'abpfiff',
    text: tf('simFulltime', { score: `${ctx.homeGoals}:${ctx.awayGoals}` }),
  });

  // Ballbesitz aus dem Stärkeverhältnis (plus etwas Rauschen), 30–70 %
  const possHome = Math.round(
    Math.min(70, Math.max(30, 50 + ((home.strength - away.strength) / (home.strength + away.strength)) * 60 + (Math.random() * 8 - 4))),
  );
  ctx.stats.home.possession = possHome;
  ctx.stats.away.possession = 100 - possHome;
  ctx.stats.home.xg = Math.round(ctx.stats.home.xg * 10) / 10;
  ctx.stats.away.xg = Math.round(ctx.stats.away.xg * 10) / 10;

  const motm = computeMotm(home, away, ctx.events, ctx.stats, ctx.homeGoals, ctx.awayGoals);
  return {
    homeGoals: ctx.homeGoals,
    awayGoals: ctx.awayGoals,
    events: ctx.events,
    stats: ctx.stats,
    motm,
  };
}

/** Komplettes Spiel in einem Schritt (NPC-Spiele ohne Halbzeit-Pause). */
export function simulateMatch(home: SimTeam, away: SimTeam): SimResult {
  return simulateSecondHalf(home, away, simulateFirstHalf(home, away));
}

/* ------------------------------------------------------------------ */
/* Live-Spiel des Nutzers (V5): pausiert bei Elfmetern und zur Halbzeit */
/* ------------------------------------------------------------------ */

/** Fortsetzbarer Live-Zustand zwischen zwei Pausen. */
export interface LiveMatchState {
  minute: number;
  half: 1 | 2;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: MatchStats;
  yellow: Array<[string, number]>;
  homeStrengthFactor: number;
  awayStrengthFactor: number;
}

export type LiveOutcome =
  | { kind: 'penalty'; penalty: PenaltyPause }
  | { kind: 'halftime' }
  | { kind: 'fulltime'; result: SimResult };

function liveCtx(home: SimTeam, away: SimTeam, state: LiveMatchState): SimContext {
  return {
    events: state.events,
    homeGoals: state.homeGoals,
    awayGoals: state.awayGoals,
    stats: state.stats,
    yellowBook: new Map(state.yellow),
    homeStrength: home.strength * state.homeStrengthFactor,
    awayStrength: away.strength * state.awayStrengthFactor,
  };
}

function saveCtx(ctx: SimContext, home: SimTeam, away: SimTeam, state: LiveMatchState, minute: number): void {
  state.minute = minute;
  state.homeGoals = ctx.homeGoals;
  state.awayGoals = ctx.awayGoals;
  state.yellow = [...ctx.yellowBook.entries()];
  state.homeStrengthFactor = ctx.homeStrength / home.strength;
  state.awayStrengthFactor = ctx.awayStrength / away.strength;
}

export function beginLiveMatch(home: SimTeam, away: SimTeam): { state: LiveMatchState; outcome: LiveOutcome } {
  const state: LiveMatchState = {
    minute: 0,
    half: 1,
    homeGoals: 0,
    awayGoals: 0,
    events: [{ minute: 1, type: 'anpfiff', text: t('simKickoff') }],
    stats: { home: emptyStats(), away: emptyStats() },
    yellow: [],
    homeStrengthFactor: 1,
    awayStrengthFactor: 1,
  };
  return { state, outcome: continueLiveMatch(home, away, state) };
}

/** Bis zur nächsten Pause simulieren (Elfmeter, Halbzeit oder Abpfiff). */
export function continueLiveMatch(home: SimTeam, away: SimTeam, state: LiveMatchState): LiveOutcome {
  const ctx = liveCtx(home, away, state);
  const to = state.half === 1 ? 45 : 90;
  const from = Math.max(state.minute + 1, state.half === 2 ? 46 : 1);
  const r = simulateRange(ctx, home, away, from, to, true);
  if (r.penalty) {
    saveCtx(ctx, home, away, state, r.penalty.minute);
    return { kind: 'penalty', penalty: r.penalty };
  }
  if (state.half === 1) {
    ctx.events.push({
      minute: 45,
      type: 'halbzeit',
      text: tf('simHalftime', { score: `${ctx.homeGoals}:${ctx.awayGoals}` }),
    });
    saveCtx(ctx, home, away, state, 45);
    state.half = 2;
    return { kind: 'halftime' };
  }
  ctx.events.push({
    minute: 90,
    type: 'abpfiff',
    text: tf('simFulltime', { score: `${ctx.homeGoals}:${ctx.awayGoals}` }),
  });
  const possHome = Math.round(
    Math.min(70, Math.max(30, 50 + ((home.strength - away.strength) / (home.strength + away.strength)) * 60 + (Math.random() * 8 - 4))),
  );
  ctx.stats.home.possession = possHome;
  ctx.stats.away.possession = 100 - possHome;
  ctx.stats.home.xg = Math.round(ctx.stats.home.xg * 10) / 10;
  ctx.stats.away.xg = Math.round(ctx.stats.away.xg * 10) / 10;
  saveCtx(ctx, home, away, state, 90);
  const motm = computeMotm(home, away, ctx.events, ctx.stats, ctx.homeGoals, ctx.awayGoals);
  return {
    kind: 'fulltime',
    result: {
      homeGoals: ctx.homeGoals,
      awayGoals: ctx.awayGoals,
      events: ctx.events,
      stats: ctx.stats,
      motm,
    },
  };
}

/** Interaktiven Elfmeter anwenden (Ergebnis kommt vom Nutzer-Minispiel). */
export function applyPenaltyResult(
  home: SimTeam,
  away: SimTeam,
  state: LiveMatchState,
  penalty: PenaltyPause,
  scored: boolean,
): void {
  const ctx = liveCtx(home, away, state);
  executePenalty(ctx, home, away, penalty.side, penalty.minute, scored, penalty.shooter, penalty.keeper);
  saveCtx(ctx, home, away, state, penalty.minute);
}

/**
 * NPC-Auswechslungen zur Halbzeit (V5): 0-2 frische fiktive Spieler ersetzen
 * Kader-Einträge (mutiert den Kader, damit Torschützen konsistent bleiben).
 */
export function applyNpcHalftimeSubs(team: SimTeam): Array<{ out: string; into: string }> {
  if (!team.roster || team.roster.length === 0 || Math.random() > 0.6) return [];
  const count = Math.random() < 0.35 ? 2 : 1;
  const subs: Array<{ out: string; into: string }> = [];
  const candidates = team.roster.filter((p) => p.position !== 'TW');
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const out = candidates.splice(idx, 1)[0];
    const into = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const rosterIdx = team.roster.findIndex((p) => p.name === out.name);
    if (rosterIdx >= 0) {
      team.roster[rosterIdx] = { name: into, position: out.position };
      subs.push({ out: out.name, into });
    }
  }
  return subs;
}
