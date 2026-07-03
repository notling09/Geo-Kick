import { BALANCING, PACK_TYPES, type PackType } from '../domain/constants';
import type { PoolPlayer, Rarity } from '../domain/types';
import { pick, pickWeighted } from './random';

/**
 * Pack-Ziehung (Kapitel 3.2 / 8.1): pro Spieler im Pack wird zuerst die
 * Seltenheit gewürfelt (Quoten je Pack-Typ), dann eine zufällige Identität
 * dieser Seltenheit aus dem Pool gezogen. Duplikate werden beim Öffnen
 * automatisch zu Coins (SELL_VALUE).
 */
export function drawPackContent(
  pool: PoolPlayer[],
  packType: PackType = PACK_TYPES.session,
): PoolPlayer[] {
  const drawable = pool.filter((p) => !p.isFiller && !p.isStarterChoice);
  const byRarity = new Map<Rarity, PoolPlayer[]>();
  drawable.forEach((p) => {
    const list = byRarity.get(p.rarity) ?? [];
    list.push(p);
    byRarity.set(p.rarity, list);
  });

  const result: PoolPlayer[] = [];
  for (let i = 0; i < BALANCING.playersPerPack; i++) {
    const rarity = pickWeighted(
      packType.odds.map((o) => ({ value: o.rarity, weight: o.weight })),
    );
    const candidates = byRarity.get(rarity) ?? drawable;
    result.push(pick(candidates));
  }
  return result;
}

/** Pack-Typ aus dem gespeicherten source-Feld ableiten. */
export function packTypeFromSource(source: string): PackType {
  if (source.startsWith('shop-')) {
    const id = source.slice('shop-'.length) as keyof typeof PACK_TYPES;
    return PACK_TYPES[id] ?? PACK_TYPES.standard;
  }
  return PACK_TYPES.session;
}
