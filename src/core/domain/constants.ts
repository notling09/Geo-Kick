import type { FormationId, Position, Rarity, Tactic } from './types';

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
  /** Cooldown pro Platz (nach Nutzertests schrittweise auf 45 Min gesenkt) */
  spotCooldownMs: 45 * 60 * 1000,
  /** Default-Check-in-Radius um einen Platz (m) */
  defaultSpotRadius: 75,
  /** 1 simuliertes Ligaspiel alle 15 Min (nach Nutzertests von 24 h gesenkt) */
  matchIntervalMs: 15 * 60 * 1000,
  /** Spieler pro Pack */
  playersPerPack: 3,
  /** Maximales Trainingslevel */
  maxPlayerLevel: 10,
  /** Maximale Klubgröße; darüber muss verkauft werden */
  maxSquadSize: 30,
} as const;

/**
 * Session-Objectives: kleine Fußball-Aufgaben gegen Langeweile am Platz.
 * Pro Session: 2 Skill-Aufgaben (Ehrensystem) + 1 Fitness-Aufgabe, die der
 * Bewegungssensor automatisch verifiziert (höherer Bonus).
 */
export const SKILL_OBJECTIVES: string[] = [
  'Score a goal with your weak foot',
  'Hit the crossbar from the penalty spot',
  'Do 20 keepy-uppies without dropping the ball',
  'Nutmeg someone (or pass through two cones)',
  'Score a volley',
  'Hit the post from 20 meters',
  'Play 10 one-touch passes against a wall or partner',
  'Dribble through 4 obstacles without losing the ball',
  'Score from outside the box',
  'Save three shots as the keeper',
  'Score a header',
  'Sprint from box to box 5 times',
  'Juggle foot - knee - head without dropping',
  'Score directly from a corner kick',
  'Chip the keeper (or the empty goal) from the edge of the box',
  'Try a rainbow flick',
  'Score with your first touch after a pass',
  'Win a 1-on-1 duel',
  'Curl a free kick around an imaginary wall',
  'Keep possession for 30 seconds against a defender',
];

export interface FitnessObjective {
  text: string;
  /** activeMs = Bewegungsminuten, sprints = erkannte Sprint-Bursts */
  kind: 'activeMs' | 'sprints';
  target: number;
}

/** Sensorgeprüfte Fitness-Aufgaben (Accelerometer, App im Vordergrund) */
export const FITNESS_OBJECTIVES: FitnessObjective[] = [
  { text: 'Be in motion for at least 3 minutes', kind: 'activeMs', target: 3 * 60 * 1000 },
  { text: 'Be in motion for at least 5 minutes', kind: 'activeMs', target: 5 * 60 * 1000 },
  { text: 'Be in motion for at least 8 minutes', kind: 'activeMs', target: 8 * 60 * 1000 },
  { text: 'Do 3 sprint bursts', kind: 'sprints', target: 3 },
  { text: 'Do 5 sprint bursts', kind: 'sprints', target: 5 },
  { text: 'Do 8 sprint bursts', kind: 'sprints', target: 8 },
];

/** Coin-Bonus je abgehakter Skill-Aufgabe (Ehrensystem) */
export const OBJECTIVE_BONUS_COINS = 10;
/** Coin-Bonus für die sensorverifizierte Fitness-Aufgabe */
export const FITNESS_BONUS_COINS = 20;
/** Skill-Aufgaben pro Session (dazu kommt 1 Fitness-Aufgabe) */
export const SKILL_OBJECTIVES_PER_SESSION = 2;

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
    label: 'Session pack',
    price: null,
    odds: [
      { rarity: 'bronze', weight: 59.5 },
      { rarity: 'silber', weight: 28 },
      { rarity: 'gold', weight: 10 },
      { rarity: 'legendaer', weight: 2 },
      { rarity: 'geheim', weight: 0.5 },
    ],
  },
  standard: {
    id: 'standard',
    label: 'Standard pack',
    price: 250,
    odds: [
      { rarity: 'bronze', weight: 49 },
      { rarity: 'silber', weight: 32 },
      { rarity: 'gold', weight: 14 },
      { rarity: 'legendaer', weight: 4 },
      { rarity: 'geheim', weight: 1 },
    ],
  },
  rare: {
    id: 'rare',
    label: 'Rare pack',
    price: 500,
    odds: [
      { rarity: 'bronze', weight: 28 },
      { rarity: 'silber', weight: 40 },
      { rarity: 'gold', weight: 22 },
      { rarity: 'legendaer', weight: 8 },
      { rarity: 'geheim', weight: 2 },
    ],
  },
  ultimate: {
    id: 'ultimate',
    label: 'Ultimate pack',
    price: 1000,
    odds: [
      { rarity: 'bronze', weight: 5 },
      { rarity: 'silber', weight: 40 },
      { rarity: 'gold', weight: 35 },
      { rarity: 'legendaer', weight: 15 },
      { rarity: 'geheim', weight: 5 },
    ],
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

export const RARITY_LABEL: Record<Rarity, string> = {
  bronze: 'Bronze',
  silber: 'Silver',
  gold: 'Gold',
  legendaer: 'Legendary',
  geheim: '???',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  bronze: '#B0743B',
  silber: '#9BA6B2',
  gold: '#E8B923',
  legendaer: '#8E44AD',
  geheim: '#000000',
};

export const POSITION_LABEL: Record<Position, string> = {
  TW: 'Goalkeeper',
  ABW: 'Defence',
  MF: 'Midfield',
  ST: 'Attack',
};

/** Short position tags for compact UI (stored enum values stay unchanged). */
export const POSITION_SHORT: Record<Position, string> = {
  TW: 'GK',
  ABW: 'DEF',
  MF: 'MID',
  ST: 'ATT',
};

/** Slot-Belegung je Formation: Reihenfolge = Slot-Index 0..10 */
export const FORMATIONS: Record<FormationId, Position[]> = {
  '4-4-2': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'MF', 'ST', 'ST'],
  '4-3-3': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'ST', 'ST', 'ST'],
  '5-3-2': ['TW', 'ABW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'ST', 'ST'],
};

export const FORMATION_IDS: FormationId[] = ['4-4-2', '4-3-3', '5-3-2'];

export const TACTIC_LABEL: Record<Tactic, string> = {
  offensiv: 'Offensive',
  ausgewogen: 'Balanced',
  defensiv: 'Defensive',
};

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
  /** Offensive Taktik: eigener Angriff +10 %, eigene Abwehr −10 % (defensiv umgekehrt) */
  tacticModifier: 0.1,
  /** Offensive Taktik erhöht die eigene Chancenhäufigkeit um diesen Anteil */
  tacticChanceModifier: 0.25,
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
