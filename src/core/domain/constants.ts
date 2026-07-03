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
  /** Cooldown pro Platz (Mitte der Spanne 4–6 h) */
  spotCooldownMs: 5 * 60 * 60 * 1000,
  /** Default-Check-in-Radius um einen Platz (m) */
  defaultSpotRadius: 75,
  /** 1 simuliertes Ligaspiel pro 24 h */
  matchIntervalMs: 24 * 60 * 60 * 1000,
  /** Preis eines Packs im Shop (Coin-Senke, Game Loop Schritt 5) */
  packShopPrice: 500,
  /** Spieler pro Pack */
  playersPerPack: 3,
  /** Maximales Trainingslevel */
  maxPlayerLevel: 10,
} as const;

/** Pack-Wahrscheinlichkeiten (Kapitel 8.1) */
export const PACK_ODDS: Array<{ rarity: Rarity; weight: number }> = [
  { rarity: 'bronze', weight: 60 },
  { rarity: 'silber', weight: 28 },
  { rarity: 'gold', weight: 10 },
  { rarity: 'legendaer', weight: 2 },
];

/** Basis-Overall-Spannen je Seltenheit (vor Level-Boni) */
export const RARITY_OVERALL_RANGE: Record<Rarity, [number, number]> = {
  bronze: [45, 58],
  silber: [59, 72],
  gold: [73, 86],
  legendaer: [87, 96],
};

export const RARITY_LABEL: Record<Rarity, string> = {
  bronze: 'Bronze',
  silber: 'Silver',
  gold: 'Gold',
  legendaer: 'Legendary',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  bronze: '#B0743B',
  silber: '#9BA6B2',
  gold: '#E8B923',
  legendaer: '#8E44AD',
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
  '3-5-2': ['TW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'MF', 'MF', 'ST', 'ST'],
};

export const FORMATION_IDS: FormationId[] = ['4-4-2', '4-3-3', '3-5-2'];

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
  /** Offensive Taktik: eigener Angriff +10 %, eigene Abwehr −10 % (defensiv umgekehrt) */
  tacticModifier: 0.1,
  /** Offensive Taktik erhöht die eigene Chancenhäufigkeit um diesen Anteil */
  tacticChanceModifier: 0.25,
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
