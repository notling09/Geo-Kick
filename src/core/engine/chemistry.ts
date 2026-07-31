import { FORMATIONS } from '../domain/constants';
import type { FormationId, OwnedPlayer, PoolPlayer, Position } from '../domain/types';
import { STAR_POSITIONS } from './names';

/**
 * Team-Chemie (V7.6). Ein Spieler passt auf einen Slot in drei Stufen:
 *  - 🟢 grün: die Slot-Position ist seine Haupt- oder Nebenposition → volle
 *    Chemie, keine Einbuße.
 *  - 🟡 gelb: die Slot-Position liegt „daneben" (eine Position auf der Kette
 *    CB–FB–MF–FL–ST) → keine Einbuße, aber auch keine Chemie.
 *  - 🔴 rot: passt gar nicht (zwei oder mehr daneben, oder Feldspieler im Tor
 *    bzw. Torwart im Feld) → der Spieler verliert Stärke.
 * Der Torwart-Slot zählt nur mit einem echten Torwart als grün.
 */

export type ChemState = 'green' | 'yellow' | 'red';

/** Malusfaktor für einen Spieler auf einem 🔴-Slot (V7.6). */
export const OUT_OF_POSITION_FACTOR = 0.8;

/** Chemie-Bonus je passendem Feldspieler (max +5 % bei allen 10). */
const CHEM_PER_PLAYER = 0.005;

/** „Eine Position daneben" – für die Gelb-Wertung. TW ist isoliert. */
const ADJACENT: Record<Position, Position[]> = {
  TW: [],
  CB: ['FB'],
  FB: ['CB', 'MF'],
  MF: ['FB', 'FL'],
  FL: ['MF', 'ST'],
  ST: ['FL'],
};

/** Alle Positionen, auf denen ein Spieler volle Chemie bekommt (Haupt + Neben). */
export function eligiblePositions(player: Pick<PoolPlayer, 'name' | 'position'>): Position[] {
  return STAR_POSITIONS[player.name] ?? [player.position];
}

/** Chemie-Zustand eines Spielers auf einer bestimmten Slot-Position. */
export function slotChemState(
  slotPos: Position,
  player: Pick<PoolPlayer, 'name' | 'position'>,
): ChemState {
  const eligible = eligiblePositions(player);
  if (eligible.includes(slotPos)) return 'green';
  // Gelb entsteht NUR über die Hauptposition (eligible[0]). Nebenpositionen
  // geben grün auf genau ihrer Position, aber keine Gelb-Nachbarschaft
  // (Klarstellung): Bernardo (MF-Haupt, FL-Neben) ist bei ST rot, nicht gelb.
  if (ADJACENT[slotPos].includes(eligible[0])) return 'yellow';
  return 'red';
}

/**
 * Chemie einer Aufstellung: Anzahl grüner Feldspieler (Torwart-Slot zählt nicht
 * mit) und der daraus resultierende Stärke-Faktor (1.0 … 1.05).
 */
export function teamChemistry(
  lineup: Array<OwnedPlayer | null>,
  formation: FormationId,
): { greenOutfield: number; factor: number } {
  const slots = FORMATIONS[formation];
  let green = 0;
  lineup.forEach((player, slot) => {
    if (!player) return;
    const slotPos = slots[slot];
    if (slotPos === 'TW') return; // nur die 10 Feldspieler zählen
    if (slotChemState(slotPos, player.pool) === 'green') green += 1;
  });
  return { greenOutfield: green, factor: 1 + green * CHEM_PER_PLAYER };
}
