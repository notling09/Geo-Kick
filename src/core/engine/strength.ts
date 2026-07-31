import { FORMATIONS } from '../domain/constants';
import type { FormationId, OwnedPlayer } from '../domain/types';
import { effectiveOverall } from './playerGen';
import { OUT_OF_POSITION_FACTOR, slotChemState, teamChemistry } from './chemistry';

/**
 * Team-Gesamtstärke = Summe der Overalls der aufgestellten Spieler, plus
 * Team-Chemie (V7.6):
 *  - Spieler auf einem 🔴-Slot (Position passt gar nicht) zählen nur mit 80 %.
 *  - 🟢 und 🟡 zählen voll; 🟢 gibt zusätzlich Chemie (bis +5 % aufs Team).
 */
export function teamStrength(
  lineup: Array<OwnedPlayer | null>,
  formation: FormationId,
): number {
  const slots = FORMATIONS[formation];
  let total = 0;
  lineup.forEach((player, slot) => {
    if (!player) return;
    const overall = effectiveOverall(player.pool, player.level);
    const state = slotChemState(slots[slot], player.pool);
    total += state === 'red' ? overall * OUT_OF_POSITION_FACTOR : overall;
  });
  const { factor } = teamChemistry(lineup, formation);
  return Math.round(total * factor);
}
