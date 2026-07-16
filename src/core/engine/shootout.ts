/**
 * Elfmeterschießen-Regeln (V4/V6): Best-of-5, danach Sudden Death.
 * Team A schießt zuerst. Entscheidung fällt, sobald ein Team uneinholbar
 * führt; im Sudden Death nur nach kompletten Paaren.
 */

export interface ShootoutKick {
  side: 'A' | 'B';
  scored: boolean;
}

export function shootoutWinner(kicks: ShootoutKick[]): 'A' | 'B' | null {
  const a = kicks.filter((k) => k.side === 'A');
  const b = kicks.filter((k) => k.side === 'B');
  const ag = a.filter((k) => k.scored).length;
  const bg = b.filter((k) => k.scored).length;
  if (a.length <= 5 && b.length <= 5) {
    const remA = 5 - a.length;
    const remB = 5 - b.length;
    if (ag > bg + remB) return 'A';
    if (bg > ag + remA) return 'B';
    if (remA === 0 && remB === 0 && ag !== bg) return ag > bg ? 'A' : 'B';
    return null;
  }
  if (a.length === b.length && ag !== bg) return ag > bg ? 'A' : 'B';
  return null;
}
