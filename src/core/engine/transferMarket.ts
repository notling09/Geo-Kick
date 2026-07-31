import { PACK_TYPES } from '../domain/constants';
import type { PoolPlayer, Rarity } from '../domain/types';
import { dayOrdinal } from './pitchBattle';

/**
 * Tages-Transfermarkt (V7.4): die KI-Börse. Jeden Tag stehen 6 zufällige
 * Spieler zum Kauf bereit – mit den Quoten von zwei Standard-Packs, also
 * komplett zufällig zwischen Bronze und Legendär. Die Auswahl ist pro Tag
 * DETERMINISTISCH (gleicher Seed = gleiche 6 Spieler), erst am nächsten Tag
 * (lokale Mitternacht) rotiert sie. So sieht jeder Aufruf am selben Tag exakt
 * dieselben Spieler, ohne dass wir die Liste speichern müssen.
 */

export const MARKET_SIZE = 6;

/** Deterministischer PRNG (mulberry32): gleicher Seed → gleiche Zahlenfolge. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Heutiger Markt-Seed (lokale Tagesnummer). Wechselt um Mitternacht. */
export function marketSeed(date = new Date()): number {
  return dayOrdinal(date);
}

/** Wahrscheinlichkeit, dass ein Markt einen Blitzdeal enthält (V7.7). */
const BLITZDEAL_CHANCE = 0.2;
/** Mögliche Rabattstufen für einen Blitzdeal (25–50 %). */
const BLITZDEAL_STEPS = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

/**
 * Blitzdeals für einen Markt-Seed (V7.7): mit ~20 % Chance sind 1–2 der 6
 * Spieler rabattiert (25–50 %). Deterministisch aus dem Seed (unabhängig von
 * der Spieler-Ziehung), also stabil pro Tag bzw. pro Token-Reroll.
 * Rückgabe: Slot-Index → Rabatt-Anteil (0…1).
 */
export function marketDeals(seed: number): Record<number, number> {
  const rng = mulberry32(Math.imul(seed + 7, 2246822519));
  const deals: Record<number, number> = {};
  if (rng() >= BLITZDEAL_CHANCE) return deals;
  const count = rng() < 0.5 ? 1 : 2;
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let idx = Math.floor(rng() * MARKET_SIZE);
    let guard = 0;
    while (used.has(idx) && guard++ < 12) idx = Math.floor(rng() * MARKET_SIZE);
    used.add(idx);
    deals[idx] = BLITZDEAL_STEPS[Math.floor(rng() * BLITZDEAL_STEPS.length)];
  }
  return deals;
}

/** Hat der Markt zu diesem Seed einen Blitzdeal? */
export function hasBlitzdeal(seed: number): boolean {
  return Object.keys(marketDeals(seed)).length > 0;
}

/**
 * Die 6 Markt-Spieler für einen Seed erzeugen. Pro Slot wird zuerst die
 * Seltenheit gewürfelt (Standard-Pack-Quoten), dann eine Identität dieser
 * Seltenheit aus dem Pool gezogen. Alles über den seed-gesteuerten PRNG,
 * damit das Ergebnis pro Tag stabil ist.
 */
export function generateMarket(pool: PoolPlayer[], seed: number): PoolPlayer[] {
  const drawable = pool.filter(
    // V7.5: Starter-Kapitäne dürfen auch im Markt auftauchen (Sammlung komplettierbar)
    (p) => !p.isFiller && p.rarity !== 'geheim',
  );
  if (drawable.length === 0) return [];

  const byRarity = new Map<Rarity, PoolPlayer[]>();
  drawable.forEach((p) => {
    const list = byRarity.get(p.rarity) ?? [];
    list.push(p);
    byRarity.set(p.rarity, list);
  });

  const odds = PACK_TYPES.standard.odds
    .filter((o) => o.rarity !== 'geheim')
    .map((o) => ({ value: o.rarity, weight: o.weight }));
  const total = odds.reduce((s, o) => s + o.weight, 0);

  // Seed etwas streuen, damit aufeinanderfolgende Tage klar verschiedene
  // Startzustände haben (kleine Seeds liegen sonst dicht beieinander).
  const rng = mulberry32(Math.imul(seed + 1, 2654435761));

  const result: PoolPlayer[] = [];
  for (let i = 0; i < MARKET_SIZE; i++) {
    let roll = rng() * total;
    let rarity: Rarity = odds[odds.length - 1].value;
    for (const o of odds) {
      roll -= o.weight;
      if (roll <= 0) {
        rarity = o.value;
        break;
      }
    }
    const candidates = byRarity.get(rarity) ?? drawable;
    // Stabile Reihenfolge (nach Name), dann seed-gesteuert einen wählen
    const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));
    result.push(sorted[Math.floor(rng() * sorted.length)]);
  }
  return result;
}
