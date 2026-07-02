import { FORMATIONS } from '../domain/constants';
import type { FormationId, OwnedPlayer } from '../domain/types';
import { effectiveOverall } from './playerGen';

/**
 * Team-Gesamtstärke = Summe der positionsgewichteten Overalls der
 * aufgestellten Spieler (Kapitel 8.2). Spieler auf fremder Position
 * zählen nur mit 80 % ihres Overalls.
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
    const onPosition = player.pool.position === slots[slot];
    total += onPosition ? overall : overall * 0.8;
  });
  return Math.round(total);
}
