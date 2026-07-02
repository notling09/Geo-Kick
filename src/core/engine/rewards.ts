import { BALANCING } from '../domain/constants';

/**
 * Belohnungsberechnung für eine abgeschlossene Session (Kapitel 3.2 / 8):
 * ab 5 Minuten Mindestbelohnung, linear steigend bis zur vollen Belohnung
 * bei 15 Minuten, plus genau 1 Pack.
 */
export interface SessionReward {
  coins: number;
  pack: boolean;
}

export function calculateReward(durationMs: number): SessionReward {
  if (durationMs < BALANCING.minSessionMs) {
    return { coins: 0, pack: false };
  }
  const span = BALANCING.fullSessionMs - BALANCING.minSessionMs;
  const progress = Math.min(1, (durationMs - BALANCING.minSessionMs) / span);
  const coins = Math.round(
    BALANCING.minCoins + progress * (BALANCING.maxCoins - BALANCING.minCoins),
  );
  return { coins, pack: true };
}

/** Verbleibende Zeit bis zur Mindestbelohnung (ms), 0 wenn erreicht. */
export function timeUntilReward(startTime: number, now: number): number {
  return Math.max(0, BALANCING.minSessionMs - (now - startTime));
}
