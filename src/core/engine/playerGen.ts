import { POSITION_WEIGHTS, RARITY_OVERALL_RANGE } from '../domain/constants';
import type { Attributes, PoolPlayer, Position, Rarity } from '../domain/types';
import { FIRST_NAMES, GOLD_PLAYERS, LAST_NAMES, LEGENDARY_PLAYERS, STARTER_WINGERS } from './names';
import { pick, randInt, shuffle } from './random';

/**
 * Erzeugt den einmaligen Pool fiktiver Spieler-Identitäten.
 * Packs ziehen aus diesem Pool, dadurch sind Duplikate möglich
 * (Duplikate → Training, Kapitel 3.3).
 */

const POOL_SIZE: Record<Rarity, number> = {
  bronze: 44,
  silber: 32,
  gold: 20,
  legendaer: 10,
};

const POSITIONS: Position[] = ['TW', 'ABW', 'MF', 'ST'];

/** Verteilt Attribute so, dass der positionsgewichtete Overall im Zielbereich liegt. */
function rollAttributes(position: Position, targetOverall: number): Attributes {
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

export function effectiveOverall(pool: PoolPlayer, level: number): number {
  return overallOf(effectiveAttributes(pool, level), pool.position);
}

type NewPoolPlayer = Omit<PoolPlayer, 'id'>;

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

  // Die drei wählbaren Starter-Captains: starke (Gold-)Angreifer
  STARTER_WINGERS.forEach((starter) => {
    usedNames.add(starter.name);
    players.push({
      name: starter.name,
      position: 'ST',
      rarity: 'gold',
      isStarterChoice: true,
      isFiller: false,
      ...rollAttributes('ST', randInt(78, 84)),
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
