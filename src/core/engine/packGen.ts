import { BALANCING, PACK_ODDS } from '../domain/constants';
import type { PoolPlayer, Rarity } from '../domain/types';
import { pick, pickWeighted } from './random';

/**
 * Pack-Ziehung (Kapitel 3.2 / 8.1): pro Spieler im Pack wird zuerst die
 * Seltenheit gewürfelt (60/28/10/2), dann eine zufällige Identität dieser
 * Seltenheit aus dem Pool gezogen. Duplikate sind gewollt (Training).
 */
export function drawPackContent(pool: PoolPlayer[]): PoolPlayer[] {
  const drawable = pool.filter((p) => !p.isFiller && !p.isStarterChoice);
  const byRarity = new Map<Rarity, PoolPlayer[]>();
  drawable.forEach((p) => {
    const list = byRarity.get(p.rarity) ?? [];
    list.push(p);
    byRarity.set(p.rarity, list);
  });

  const result: PoolPlayer[] = [];
  for (let i = 0; i < BALANCING.playersPerPack; i++) {
    const rarity = pickWeighted(PACK_ODDS.map((o) => ({ value: o.rarity, weight: o.weight })));
    const candidates = byRarity.get(rarity) ?? drawable;
    result.push(pick(candidates));
  }
  return result;
}
