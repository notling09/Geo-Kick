import { t, tf, type TKey } from '../i18n';
import type { FormationId, Position, Rarity, Tactic } from './types';

/**
 * Label-Records mit Gettern: dieses Modul wird beim App-Start VOR dem Setzen
 * der Sprache geladen, deshalb dürfen die Texte erst beim Zugriff übersetzt
 * werden – die Aufrufstellen (z. B. TACTIC_LABEL[tactic]) bleiben unverändert.
 */
function lazyLabels<K extends string>(keys: Record<K, TKey>): Record<K, string> {
  const out = {} as Record<K, string>;
  (Object.keys(keys) as K[]).forEach((k) => {
    Object.defineProperty(out, k, { get: () => t(keys[k]), enumerable: true });
  });
  return out;
}

/**
 * Balancing-Eckwerte gemäß Konzeptdokument Kapitel 8.
 * Startwerte – zur Feinjustierung nach ersten Tests an einer Stelle gebündelt.
 */
export const BALANCING = {
  /** Mindest-Verweildauer für eine Belohnung (ms) */
  minSessionMs: 5 * 60 * 1000,
  /** Verweildauer für volle Belohnung (ms) */
  fullSessionMs: 15 * 60 * 1000,
  /** Coins bei Mindestdauer */
  minCoins: 50,
  /** Coins bei voller Dauer (dazwischen linear) */
  maxCoins: 150,
  /** Genau 1 Pack pro abgeschlossener Session */
  packsPerSession: 1,
  /** Cooldown pro Platz (nach Nutzertests schrittweise auf 30 Min gesenkt) */
  spotCooldownMs: 30 * 60 * 1000,
  /** Default-Check-in-Radius um einen Platz (m); V5: 100, ein Feld ist groß */
  defaultSpotRadius: 100,
  /** 1 simuliertes Ligaspiel alle 5 Min (nach Nutzertests von 24 h -> 10 -> 5) */
  matchIntervalMs: 5 * 60 * 1000,
  /** Spieler pro Pack */
  playersPerPack: 3,
  /**
   * Level-ups sind seit V3 durch das Rating gedeckelt (Maximum 99 Overall,
   * MAX_PLAYER_OVERALL) statt durch ein festes Levellimit.
   */
  maxPlayerLevel: 99,
  /** Maximale Klubgröße; darüber muss verkauft werden */
  maxSquadSize: 30,
} as const;

/**
 * Session-Objectives: kleine Fußball-Aufgaben gegen Langeweile am Platz.
 * Pro Session: 2 Skill-Aufgaben (Ehrensystem) + 1 Fitness-Aufgabe, die der
 * Bewegungssensor automatisch verifiziert (höherer Bonus).
 */
export function skillObjectives(): string[] {
  const keys: TKey[] = [
    'obj1', 'obj2', 'obj3', 'obj4', 'obj5', 'obj6', 'obj7', 'obj8', 'obj9', 'obj10',
    'obj11', 'obj12', 'obj13', 'obj14', 'obj15', 'obj16', 'obj17', 'obj18', 'obj19', 'obj20',
  ];
  return keys.map((k) => t(k));
}

export interface FitnessObjective {
  text: string;
  /** activeMs = Bewegungsminuten, sprints = erkannte Sprint-Bursts */
  kind: 'activeMs' | 'sprints';
  target: number;
}

/** Sensorgeprüfte Fitness-Aufgaben (Accelerometer, App im Vordergrund) */
export function fitnessObjectives(): FitnessObjective[] {
  return [
    { text: tf('objFitMove', { min: 3 }), kind: 'activeMs', target: 3 * 60 * 1000 },
    { text: tf('objFitMove', { min: 5 }), kind: 'activeMs', target: 5 * 60 * 1000 },
    { text: tf('objFitMove', { min: 8 }), kind: 'activeMs', target: 8 * 60 * 1000 },
    { text: tf('objFitSprint', { n: 3 }), kind: 'sprints', target: 3 },
    { text: tf('objFitSprint', { n: 5 }), kind: 'sprints', target: 5 },
    { text: tf('objFitSprint', { n: 8 }), kind: 'sprints', target: 8 },
  ];
}

/** Coin-Bonus je abgehakter Skill-Aufgabe (Ehrensystem) */
export const OBJECTIVE_BONUS_COINS = 10;
/** Coin-Bonus für die sensorverifizierte Fitness-Aufgabe */
export const FITNESS_BONUS_COINS = 20;
/** Skill-Aufgaben pro Session (dazu kommt 1 Fitness-Aufgabe) */
export const SKILL_OBJECTIVES_PER_SESSION = 2;

/**
 * Entdecker-Features (V4): Platz-Pass, tägliche Serie, Heimplatz und der
 * besondere Platz des Tages.
 */
export const DISCOVERY = {
  /** Bonus-Coins für die erste belohnte Session an einem neuen Platz */
  firstVisitBonusCoins: 50,
  /** Abzeichen-Stufen: so viele verschiedene Plätze besucht */
  passportBadges: [5, 10, 25, 50],
  /** Ab so vielen belohnten Besuchen wird ein Platz zum Heimplatz */
  homeMinVisits: 3,
  /** Kleiner Bonus für Sessions am eigenen Heimplatz */
  homeBonusCoins: 10,
  /** Alle so viele Besuche steigt das Heimplatz-Level um 1 */
  homeVisitsPerLevel: 3,
  /** Tägliche Serie: +so viele Coins pro Serientag … */
  streakBonusPerDay: 5,
  /** … gedeckelt bei diesem Bonus (Tag 10+) */
  streakBonusMax: 50,
  /** Session-Coins am besonderen Platz des Tages zählen doppelt */
  specialDoubleFactor: 2,
} as const;

/** Platz-Kämpfe (V4): Gegner-Team an jedem Platz, 1 Versuch pro Platz und Tag */
export const PITCH_BATTLE = {
  /** Normale Gegner: Stärke relativ zur eigenen Elf (Spanne je Platz+Tag) */
  normalStrengthRange: [0.85, 1.1] as [number, number],
  /** Boss des Tages: deutlich stärker als die eigene Elf */
  bossStrengthFactor: 1.35,
  /**
   * Kein Remis: nach 90 Minuten geht es ins Elfmeterschießen (Best-of-5,
   * dann Sudden Death). Sieg = 1 Session-Pack (Boss: Coins UND Punkte in
   * bossWinReward-Höhe), Niederlage = nichts.
   */
  bossWinReward: 150,
  /** Elfmeter: Chance zu treffen (Torwart rät 1 von 5 Ecken → 80 %) */
  penaltyTargets: 5,
} as const;

/**
 * Eier (V4): brüten durch echte Bewegung aus (GPS-Strecke, solange die App
 * offen ist). Längere Strecke = bessere Quoten. Die ???-Karte fällt bewusst
 * nie aus Eiern – sie bleibt exklusiv in Packs.
 */
export interface EggType {
  id: string;
  label: string;
  km: number;
  /** Wie oft dieser Ei-Typ vergeben wird (Gewicht) */
  weight: number;
  odds: Array<{ rarity: Rarity; weight: number }>;
}

export const EGG_TYPES: EggType[] = [
  {
    id: 'egg-1',
    get label() { return t('egg1'); },
    km: 1,
    weight: 60,
    // V7: Eier deutlich aufgewertet – 1 km garantiert mind. Silber
    odds: [
      { rarity: 'bronze', weight: 28 },
      { rarity: 'silber', weight: 46 },
      { rarity: 'gold', weight: 22 },
      { rarity: 'legendaer', weight: 4 },
    ],
  },
  {
    id: 'egg-3',
    get label() { return t('egg3'); },
    km: 3,
    weight: 30,
    // V7: 3 km enthält nie mehr Bronze (Nutzerwunsch)
    odds: [
      { rarity: 'silber', weight: 42 },
      { rarity: 'gold', weight: 45 },
      { rarity: 'legendaer', weight: 13 },
    ],
  },
  {
    id: 'egg-5',
    get label() { return t('egg5'); },
    km: 5,
    weight: 10,
    // V7: 5 km ist Top – nur noch Gold oder Legendär
    odds: [
      { rarity: 'gold', weight: 62 },
      { rarity: 'legendaer', weight: 38 },
    ],
  },
];

/** Anti-Cheat-Parameter (Kapitel 6) */
export const ANTI_CHEAT = {
  /** Check-out muss innerhalb Radius × Faktor erfolgen (GPS-Toleranz) */
  checkoutRadiusFactor: 1.5,
  /**
   * Bewegungssensor: bestraft wird nur bei ausreichend Messzeit UND
   * praktisch null Bewegung (Handy lag die ganze Zeit regungslos).
   */
  motionMinSampledMs: 2 * 60 * 1000,
  motionMinMovedMs: 20 * 1000,
} as const;

/** Verkaufswert je Seltenheit (auch für automatisch verkaufte Duplikate) */
export const SELL_VALUE: Record<Rarity, number> = {
  bronze: 25,
  silber: 50,
  gold: 100,
  legendaer: 200,
  /** Die ???-Karte ist einmalig und unverkäuflich */
  geheim: 0,
};

export type PackTypeId = 'session' | 'standard' | 'rare' | 'ultimate';

export interface PackType {
  id: PackTypeId;
  label: string;
  /** Shop-Preis in Coins; null = nicht kaufbar (Session-Belohnung) */
  price: number | null;
  /** Ziehungs-Gewichte je Seltenheit; Quoten steigen von Session → Ultimate */
  odds: Array<{ rarity: Rarity; weight: number }>;
  /**
   * Bonus nach den 3 Spielern (V3): [min, max]. Der ausgewürfelte Betrag
   * wird DOPPELT gutgeschrieben – einmal als Coins, einmal als
   * Level-up-Punkte in gleicher Höhe.
   */
  bonus: [number, number];
  /**
   * Nur runde Stufen sind ziehbar (min, min+step, … max), höhere Beträge
   * sind seltener als niedrige.
   */
  bonusStep: number;
}

/**
 * Pack-Typen: Session-Pack mit den Doc-Quoten (Kapitel 8.1: 60/28/10/2),
 * Shop-Packs mit steigenden Quoten und Preisen (Coin-Senke, Loop Schritt 5).
 * V3: '???'-Quote (geheim) geht zulasten der Bronze-Quote; die Karte ist
 * nur ein einziges Mal ziehbar – danach greifen wieder die normalen Quoten.
 */
export const PACK_TYPES: Record<PackTypeId, PackType> = {
  session: {
    id: 'session',
    get label() { return t('packSession'); },
    price: null,
    odds: [
      { rarity: 'bronze', weight: 59.5 },
      { rarity: 'silber', weight: 28 },
      { rarity: 'gold', weight: 10 },
      { rarity: 'legendaer', weight: 2 },
      { rarity: 'geheim', weight: 0.5 },
    ],
    bonus: [10, 25],
    bonusStep: 5,
  },
  standard: {
    id: 'standard',
    get label() { return t('packStandard'); },
    price: 250,
    odds: [
      { rarity: 'bronze', weight: 49 },
      { rarity: 'silber', weight: 32 },
      { rarity: 'gold', weight: 14 },
      { rarity: 'legendaer', weight: 4 },
      { rarity: 'geheim', weight: 1 },
    ],
    bonus: [25, 100],
    bonusStep: 25,
  },
  rare: {
    id: 'rare',
    get label() { return t('packRare'); },
    price: 500,
    odds: [
      { rarity: 'bronze', weight: 28 },
      { rarity: 'silber', weight: 40 },
      { rarity: 'gold', weight: 22 },
      { rarity: 'legendaer', weight: 8 },
      { rarity: 'geheim', weight: 2 },
    ],
    bonus: [100, 200],
    bonusStep: 25,
  },
  ultimate: {
    id: 'ultimate',
    get label() { return t('packUltimate'); },
    price: 1000,
    odds: [
      { rarity: 'bronze', weight: 5 },
      { rarity: 'silber', weight: 40 },
      { rarity: 'gold', weight: 35 },
      { rarity: 'legendaer', weight: 15 },
      { rarity: 'geheim', weight: 5 },
    ],
    bonus: [200, 500],
    bonusStep: 25,
  },
};

export const SHOP_PACK_IDS: PackTypeId[] = ['standard', 'rare', 'ultimate'];

/** Basis-Overall-Spannen je Seltenheit (vor Level-Boni; V3-Rework) */
export const RARITY_OVERALL_RANGE: Record<Rarity, [number, number]> = {
  bronze: [35, 59],
  silber: [60, 74],
  gold: [75, 85],
  legendaer: [86, 90],
  geheim: [99, 99],
};

/** Die drei wählbaren Starter haben exakt dieses Overall */
export const STARTER_OVERALL = 80;

/** Härtere Obergrenze für Level-ups: kein Spieler kommt über 99 Overall */
export const MAX_PLAYER_OVERALL = 99;

/**
 * Level-up-Kosten in Punkten, gestaffelt nach dem AKTUELLEN (effektiven)
 * Rating des Spielers – nicht nach seiner Karten-Seltenheit. Ein Bronze-
 * Spieler, der sich per Level-ups in den Silber-Bereich hochgearbeitet hat,
 * zahlt ab dann Silber-Preise; ab 90 wird es mit 250 nochmal teurer.
 */
export const LEVEL_UP_COST_BRACKETS: Array<{ maxOverall: number; cost: number }> = [
  { maxOverall: 59, cost: 25 },
  { maxOverall: 74, cost: 50 },
  { maxOverall: 85, cost: 100 },
  { maxOverall: 89, cost: 200 },
  { maxOverall: 98, cost: 250 },
];

/** Punktekosten für den nächsten Level-up; null = Maximum (99) erreicht. */
export function levelUpCost(currentOverall: number): number | null {
  for (const bracket of LEVEL_UP_COST_BRACKETS) {
    if (currentOverall <= bracket.maxOverall) return bracket.cost;
  }
  return null;
}

export const RARITY_LABEL: Record<Rarity, string> = lazyLabels<Rarity>({
  bronze: 'rarityBronze',
  silber: 'raritySilber',
  gold: 'rarityGold',
  legendaer: 'rarityLegendaer',
  geheim: 'rarityGeheim',
});

export const RARITY_COLOR: Record<Rarity, string> = {
  bronze: '#B0743B',
  silber: '#9BA6B2',
  gold: '#E8B923',
  legendaer: '#8E44AD',
  geheim: '#000000',
};

export const POSITION_LABEL: Record<Position, string> = lazyLabels<Position>({
  TW: 'posTW',
  ABW: 'posABW',
  MF: 'posMF',
  ST: 'posST',
});

/** Short position tags for compact UI (stored enum values stay unchanged). */
export const POSITION_SHORT: Record<Position, string> = lazyLabels<Position>({
  TW: 'posShortTW',
  ABW: 'posShortABW',
  MF: 'posShortMF',
  ST: 'posShortST',
});

/** Slot-Belegung je Formation: Reihenfolge = Slot-Index 0..10 */
export const FORMATIONS: Record<FormationId, Position[]> = {
  '4-4-2': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'MF', 'ST', 'ST'],
  '4-3-3': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'ST', 'ST', 'ST'],
  '4-2-4': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'ST', 'ST', 'ST', 'ST'],
};

export const FORMATION_IDS: FormationId[] = ['4-4-2', '4-3-3', '4-2-4'];

export const TACTIC_LABEL: Record<Tactic, string> = lazyLabels<Tactic>({
  offensiv: 'tacticOffensiv',
  ausgewogen: 'tacticAusgewogen',
  defensiv: 'tacticDefensiv',
});

/** Match-Simulation (Kapitel 8.2) */
export const MATCH_SIM = {
  /** Basiswahrscheinlichkeit pro Minute für eine Chance */
  chancePerMinute: 0.08,
  /** Flavor-Events pro Minute */
  cornerPerMinute: 0.06,
  foulPerMinute: 0.05,
  /** Zufalls-Faktor auf die Tor-Wahrscheinlichkeit (±) */
  goalNoise: 0.1,
  /**
   * Konversionsfaktor auf die Tor-Wahrscheinlichkeit pro Chance.
   * Die reine Doku-Formel A/(A+B) ergibt ~3,8 Tore/Spiel; mit 0,75
   * landen wir bei realistischeren ~2,9 (Feinjustierung, Kapitel 8/10).
   */
  goalConversion: 0.75,
  /**
   * Offensive Taktik: eigener Angriff +15 %, eigene Abwehr −15 % (defensiv
   * umgekehrt). V5 verstärkt, damit die Wahl spürbar ist.
   */
  tacticModifier: 0.15,
  /** Offensive Taktik erhöht die eigene Chancenhäufigkeit um diesen Anteil (V5: 50 %) */
  tacticChanceModifier: 0.5,
  /** Anteil der Fouls, die eine gelbe Karte geben */
  yellowPerFoul: 0.35,
  /** Anteil der Fouls, die eine glatte rote Karte geben */
  straightRedPerFoul: 0.04,
  /** Stärke-Malus nach roter Karte (Restspielzeit in Unterzahl) */
  redCardPenalty: 0.88,
} as const;

/**
 * Liga-Coin-Belohnungen (V2): pro Runde Sieg 10 / Remis 5 / Niederlage 0,
 * Captain-Boni (Tor +3, Assist +2) auch bei Niederlage; Saisonprämien
 * steigen mit der Division (Div 4 → Div 1).
 */
export const LEAGUE_REWARDS = {
  win: 10,
  draw: 5,
  captainGoal: 3,
  captainAssist: 2,
  /** [Platz-1-Prämie, Platz-2-Prämie] je Division (V3: Platz 2 gestaffelt 50/75/100/125) */
  seasonByDivision: {
    4: [100, 50],
    3: [150, 75],
    2: [200, 100],
    1: [250, 125],
  } as Record<number, [number, number]>,
} as const;

/** Liga-Aufbau */
export const LEAGUE = {
  divisions: 4,
  clubsPerDivision: 8, // Nutzer + 7 NPC-Klubs
  /** Doppelrunde: (n-1)*2 Spieltage */
  roundsPerSeason: 14,
  promotionSpots: 2,
  relegationSpots: 2,
  /** NPC-Gesamtstärke je Division [min, max] */
  npcStrengthByDivision: {
    4: [420, 540],
    3: [540, 660],
    2: [660, 780],
    1: [780, 920],
  } as Record<number, [number, number]>,
} as const;

/**
 * Champions League (V7): nur in Division 1. Läuft parallel zur Liga –
 * jedes 3. Spiel der Saison ist ein CL-Spiel (14 Liga + 7 CL = 21 Slots).
 * 4er-Gruppe (Top 2 weiter), dann Achtel-, Viertel-, Halbfinale, Finale.
 */
export const CHAMPIONS_LEAGUE = {
  /** Nutzer + 3 Gegner in der Gruppe */
  groupSize: 4,
  /** Wie viele der Gruppe weiterkommen */
  advancePerGroup: 2,
  /** Teams im Achtelfinale */
  koTeams: 16,
  /** Basis-Stärke der CL-Teams (über Div-1-Niveau) */
  strengthRange: [820, 1010] as [number, number],
  /** Coins pro Sieg je Runde (steigend) */
  winReward: { group: 10, r16: 20, qf: 40, sf: 80, final: 150 } as Record<string, number>,
  /** Gegner-Schwierigkeit für den Nutzer je Runde (Stärke-Faktor, steigend) */
  difficulty: { group: 0.98, r16: 1.06, qf: 1.14, sf: 1.22, final: 1.32 } as Record<string, number>,
} as const;

/** Wappen-Vorlagen-IDs (Kapitel 3.5); Rendering: src/ui/Crest.tsx */
export const CREST_IDS = Array.from({ length: 10 }, (_, i) => `crest-${i}`);

export const USER_CLUB_ID = 'user';

/** Attribut-Gewichtung je Position für den Overall-Wert */
export const POSITION_WEIGHTS: Record<Position, { tempo: number; technik: number; abschluss: number; verteidigung: number; kondition: number }> = {
  TW: { tempo: 0.1, technik: 0.15, abschluss: 0.05, verteidigung: 0.55, kondition: 0.15 },
  ABW: { tempo: 0.2, technik: 0.1, abschluss: 0.05, verteidigung: 0.45, kondition: 0.2 },
  MF: { tempo: 0.2, technik: 0.3, abschluss: 0.15, verteidigung: 0.15, kondition: 0.2 },
  ST: { tempo: 0.25, technik: 0.2, abschluss: 0.4, verteidigung: 0.05, kondition: 0.1 },
};
