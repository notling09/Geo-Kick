import type { Tactic } from '../core/domain/types';

/**
 * Halbzeit-Mechanik (V5): Nutzer-Spiele werden in zwei Hälften simuliert.
 * Der Store, der ein Spiel startet (Liga, Platz-Kampf, Friendly), hinterlegt
 * hier die Fortsetzung; der Live-Ticker ruft sie nach der Halbzeit-Pause mit
 * der (ggf. geänderten) Taktik auf. Auswechslungen laufen über die normale
 * Aufstellung – die Fortsetzung liest die aktuelle Elf neu ein.
 *
 * Bewusst nur im Speicher: stirbt die App in der Halbzeit, wurde noch nichts
 * Endgültiges gespeichert und das Spiel kann neu angepfiffen werden.
 */

let resumeFn: ((tactic: Tactic) => Promise<void>) | null = null;

export function setHalftimeResume(fn: (tactic: Tactic) => Promise<void>): void {
  resumeFn = fn;
}

export async function resumeSecondHalf(tactic: Tactic): Promise<void> {
  const fn = resumeFn;
  resumeFn = null;
  if (fn) await fn(tactic);
}
