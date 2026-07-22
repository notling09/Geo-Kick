import { MAX_PLAYER_OVERALL, POSITION_WEIGHTS, RARITY_OVERALL_RANGE, STARTER_OVERALL } from '../domain/constants';
import type { Attributes, PoolPlayer, Position, Rarity } from '../domain/types';
import { FIRST_NAMES, GOLD_PLAYERS, LAST_NAMES, LEGENDARY_PLAYERS, STARTER_WINGERS } from './names';
import { pick, randInt, shuffle } from './random';

/**
 * Erzeugt den einmaligen Pool fiktiver Spieler-Identitäten.
 * Packs ziehen aus diesem Pool, dadurch sind Duplikate möglich
 * (Duplikate → Training, Kapitel 3.3).
 */

/** Zielgrößen des Pools (2026-07-04 verdoppelt, weniger Duplikate). */
export const POOL_SIZE: Record<Rarity, number> = {
  bronze: 88,
  silber: 64,
  gold: GOLD_PLAYERS.length,
  legendaer: LEGENDARY_PLAYERS.length,
  // Die ???-Identität entsteht erst beim einmaligen Zug (Nutzer benennt sie)
  geheim: 0,
};

const POSITIONS: Position[] = ['TW', 'ABW', 'MF', 'ST'];

/** Verteilt Attribute so, dass der positionsgewichtete Overall im Zielbereich liegt. */
export function rollAttributes(position: Position, targetOverall: number): Attributes {
  const attrs: Attributes = {
    tempo: 0,
    technik: 0,
    abschluss: 0,
    verteidigung: 0,
    kondition: 0,
  };
  const weights = POSITION_WEIGHTS[position];
  // Start: alle Attribute um den Zielwert streuen, Kern-Attribute etwas höher
  (Object.keys(attrs) as Array<keyof Attributes>).forEach((key) => {
    const emphasis = weights[key] >= 0.3 ? 6 : weights[key] <= 0.1 ? -8 : 0;
    attrs[key] = clamp(targetOverall + emphasis + randInt(-7, 7), 20, 99);
  });
  // Feinkorrektur, damit der Overall den Zielwert trifft
  const diff = targetOverall - overallOf(attrs, position);
  (Object.keys(attrs) as Array<keyof Attributes>).forEach((key) => {
    attrs[key] = clamp(Math.round(attrs[key] + diff), 20, 99);
  });
  return attrs;
}

/** Wie rollAttributes, trifft den Ziel-Overall aber garantiert exakt (Starter = 80). */
export function rollAttributesExact(position: Position, targetOverall: number): Attributes {
  for (let i = 0; i < 50; i++) {
    const attrs = rollAttributes(position, targetOverall);
    if (overallOf(attrs, position) === targetOverall) return attrs;
  }
  // Fallback (praktisch nie): alle Attribute exakt auf den Zielwert
  return {
    tempo: targetOverall, technik: targetOverall, abschluss: targetOverall,
    verteidigung: targetOverall, kondition: targetOverall,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function overallOf(attrs: Attributes, position: Position): number {
  const w = POSITION_WEIGHTS[position];
  return Math.round(
    attrs.tempo * w.tempo +
      attrs.technik * w.technik +
      attrs.abschluss * w.abschluss +
      attrs.verteidigung * w.verteidigung +
      attrs.kondition * w.kondition,
  );
}

/** Effektive Attribute inkl. Trainingslevel (+1 auf alles pro Level über 1, Cap 99). */
export function effectiveAttributes(pool: PoolPlayer, level: number): Attributes {
  const bonus = level - 1;
  return {
    tempo: clamp(pool.tempo + bonus, 1, 99),
    technik: clamp(pool.technik + bonus, 1, 99),
    abschluss: clamp(pool.abschluss + bonus, 1, 99),
    verteidigung: clamp(pool.verteidigung + bonus, 1, 99),
    kondition: clamp(pool.kondition + bonus, 1, 99),
  };
}

/**
 * Effektives Overall (V7-Fix): linear – Level 1 = Basis-Rating, jedes weitere
 * Level +1, gedeckelt bei 99. Früher wurde das Overall aus den (bei 99
 * gedeckelten) Attributen gemittelt; dadurch blieb es bei hohen Werten trotz
 * teurer Level-ups oft auf demselben Wert stehen (z. B. hing bei 93 fest).
 */
export function effectiveOverall(pool: PoolPlayer, level: number): number {
  const base = overallOf(pool, pool.position);
  return Math.min(MAX_PLAYER_OVERALL, base + Math.max(0, level - 1));
}

export type NewPoolPlayer = Omit<PoolPlayer, 'id'>;

/** Kuratierten Star (Gold/Legendär) als Pool-Eintrag erzeugen (für Migrationen). */
export function createCuratedPoolPlayer(
  rarity: Rarity,
  entry: { name: string; position: Position },
): NewPoolPlayer {
  const [min, max] = RARITY_OVERALL_RANGE[rarity];
  return {
    name: entry.name,
    position: entry.position,
    rarity,
    isStarterChoice: false,
    isFiller: false,
    ...rollAttributes(entry.position, randInt(min, max)),
  };
}

/**
 * Die einmalige ???-Karte: 99 auf allen Attributen, Name und Position
 * bestimmt der Nutzer beim Aufdecken selbst (V3).
 */
export function createMysteryPoolPlayer(name: string, position: Position): NewPoolPlayer {
  return {
    name,
    position,
    rarity: 'geheim',
    isStarterChoice: false,
    isFiller: false,
    tempo: 99, technik: 99, abschluss: 99, verteidigung: 99, kondition: 99,
  };
}

/** Zufällige Fantasie-Spieler nachgenerieren (für Pool-Vergrößerungen). */
export function generateRandomPoolPlayers(
  rarity: Rarity,
  count: number,
  existingNames: Set<string>,
): NewPoolPlayer[] {
  const [min, max] = RARITY_OVERALL_RANGE[rarity];
  const players: NewPoolPlayer[] = [];
  for (let i = 0; i < count; i++) {
    let name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    for (let tries = 0; existingNames.has(name) && tries < 200; tries++) {
      name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    }
    existingNames.add(name);
    const position = POSITIONS[randInt(0, POSITIONS.length - 1)];
    players.push({
      name,
      position,
      rarity,
      isStarterChoice: false,
      isFiller: false,
      ...rollAttributes(position, randInt(min, max)),
    });
  }
  return players;
}

export function generatePlayerPool(): NewPoolPlayer[] {
  const players: NewPoolPlayer[] = [];
  const usedNames = new Set<string>();

  const uniqueName = (): string => {
    for (let i = 0; i < 200; i++) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    // Fallback: nummerierter Name, praktisch nie nötig
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${usedNames.size}`;
    usedNames.add(name);
    return name;
  };

  // Bronze/Silber: zufällige Fantasienamen; Gold/Legendär: kuratierte,
  // erkennbare Stars mit klar abgewandelten Namen (Nutzerwunsch)
  const curated: Partial<Record<Rarity, Array<{ name: string; position: Position }>>> = {
    gold: GOLD_PLAYERS,
    legendaer: LEGENDARY_PLAYERS,
  };

  (Object.keys(POOL_SIZE) as Rarity[]).forEach((rarity) => {
    const [min, max] = RARITY_OVERALL_RANGE[rarity];
    const curatedList = curated[rarity];
    if (curatedList) {
      curatedList.forEach(({ name, position }) => {
        usedNames.add(name);
        players.push({
          name,
          position,
          rarity,
          isStarterChoice: false,
          isFiller: false,
          ...rollAttributes(position, randInt(min, max)),
        });
      });
      return;
    }
    // Positionen gleichmäßig durchmischen, damit jede Seltenheit alle Positionen abdeckt
    const positions = shuffle(
      Array.from({ length: POOL_SIZE[rarity] }, (_, i) => POSITIONS[i % POSITIONS.length]),
    );
    positions.forEach((position) => {
      const target = randInt(min, max);
      players.push({
        name: uniqueName(),
        position,
        rarity,
        isStarterChoice: false,
        isFiller: false,
        ...rollAttributes(position, target),
      });
    });
  });

  // Die drei wählbaren Starter-Captains: Gold-Angreifer mit exakt 80 Overall (V3)
  STARTER_WINGERS.forEach((starter) => {
    usedNames.add(starter.name);
    players.push({
      name: starter.name,
      position: 'ST',
      rarity: 'gold',
      isStarterChoice: true,
      isFiller: false,
      ...rollAttributesExact('ST', STARTER_OVERALL),
    });
  });

  return players;
}

/** Sehr schwache, komplett fiktive Füllspieler für den Start-Kader (Kapitel 2.2). */
export function generateFillerSquad(): NewPoolPlayer[] {
  const layout: Position[] = [
    'TW', 'TW',
    'ABW', 'ABW', 'ABW', 'ABW', 'ABW',
    'MF', 'MF', 'MF', 'MF',
    'ST', 'ST', 'ST', 'ST',
  ];
  const usedNames = new Set<string>();
  return layout.map((position) => {
    let name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    while (usedNames.has(name)) name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    usedNames.add(name);
    return {
      name,
      position,
      rarity: 'bronze' as Rarity,
      isStarterChoice: false,
      isFiller: true,
      ...rollAttributes(position, randInt(38, 46)),
    };
  });
}
