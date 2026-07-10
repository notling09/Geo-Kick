import { BALANCING, PACK_TYPES, type PackType } from '../domain/constants';
import type { PoolPlayer, Rarity } from '../domain/types';
import { pick, pickWeighted, randInt } from './random';

/**
 * Pack-Ziehung (Kapitel 3.2 / 8.1): pro Spieler im Pack wird zuerst die
 * Seltenheit gewürfelt (Quoten je Pack-Typ), dann eine zufällige Identität
 * dieser Seltenheit aus dem Pool gezogen. Duplikate werden beim Öffnen
 * automatisch zu Coins (SELL_VALUE).
 *
 * V3: Die Seltenheit '???' (geheim) ist nur ein einziges Mal überhaupt
 * ziehbar. Fällt sie, ersetzt sie einen der Slots (mystery = true) – die
 * Identität entsteht erst beim Aufdecken (Nutzer benennt den 99er selbst).
 * Ist sie nicht (mehr) verfügbar, wird der Slot ohne geheim neu gewürfelt.
 */

export interface PackDraw {
  players: PoolPlayer[];
  /** true = einer der Slots ist die einmalige ???-Karte */
  mystery: boolean;
}

export function drawPackContent(
  pool: PoolPlayer[],
  packType: PackType = PACK_TYPES.session,
  mysteryAvailable = false,
): PackDraw {
  const drawable = pool.filter(
    (p) => !p.isFiller && !p.isStarterChoice && p.rarity !== 'geheim',
  );
  const byRarity = new Map<Rarity, PoolPlayer[]>();
  drawable.forEach((p) => {
    const list = byRarity.get(p.rarity) ?? [];
    list.push(p);
    byRarity.set(p.rarity, list);
  });

  const normalOdds = packType.odds
    .filter((o) => o.rarity !== 'geheim')
    .map((o) => ({ value: o.rarity, weight: o.weight }));

  const players: PoolPlayer[] = [];
  let mystery = false;
  for (let i = 0; i < BALANCING.playersPerPack; i++) {
    let rarity = pickWeighted(
      packType.odds.map((o) => ({ value: o.rarity, weight: o.weight })),
    );
    if (rarity === 'geheim') {
      if (mysteryAvailable && !mystery) {
        mystery = true;
        continue;
      }
      rarity = pickWeighted(normalOdds);
    }
    const candidates = byRarity.get(rarity) ?? drawable;
    players.push(pick(candidates));
  }
  return { players, mystery };
}

/**
 * Bonus nach den 3 Spielern (V3): ein Betrag aus der Pack-Spanne, der
 * doppelt gutgeschrieben wird (Coins UND Level-up-Punkte in gleicher Höhe).
 */
export function rollPackBonus(packType: PackType): number {
  return randInt(packType.bonus[0], packType.bonus[1]);
}

/** Pack-Typ aus dem gespeicherten source-Feld ableiten. */
export function packTypeFromSource(source: string): PackType {
  if (source.startsWith('shop-')) {
    const id = source.slice('shop-'.length) as keyof typeof PACK_TYPES;
    return PACK_TYPES[id] ?? PACK_TYPES.standard;
  }
  return PACK_TYPES.session;
}
