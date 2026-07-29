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

/**
 * Die 6 Markt-Spieler für einen Seed erzeugen. Pro Slot wird zuerst die
 * Seltenheit gewürfelt (Standard-Pack-Quoten), dann eine Identität dieser
 * Seltenheit aus dem Pool gezogen. Alles über den seed-gesteuerten PRNG,
 * damit das Ergebnis pro Tag stabil ist.
 */
export function generateMarket(pool: PoolPlayer[], seed: number): PoolPlayer[] {
  const drawable = pool.filter(
    (p) => !p.isFiller && !p.isStarterChoice && p.rarity !== 'geheim',
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
