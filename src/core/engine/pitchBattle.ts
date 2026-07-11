import { PITCH_BATTLE } from '../domain/constants';
import { NPC_CLUB_PLACES, NPC_CLUB_PREFIXES, NPC_CLUB_SUFFIXES } from './names';

/**
 * Platz-Kämpfe (V4): An jedem Platz wartet ein fiktives Gegner-Team, das man
 * nur vor Ort herausfordern kann. Name und Stärke sind deterministisch aus
 * der Platz-Id (und dem Tag) abgeleitet – kein Server nötig, aber für alle
 * Besuche desselben Platzes stabil. Einmal am Tag ist ein Platz der
 * "besondere Platz": dort wartet ein deutlich stärkeres Boss-Team mit
 * großer Belohnung, und Sessions dort zählen doppelt.
 */

/** Einfacher, stabiler String-Hash (FNV-1a, 32 Bit, immer positiv). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Lokaler Tages-Schlüssel (YYYY-MM-DD) für alles, was täglich wechselt. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Der besondere Platz des Tages: höchster Hash aus Platz-Id + Tag. */
export function specialSpotIdForDay(spotIds: string[], day: string): string | null {
  let best: string | null = null;
  let bestHash = -1;
  for (const id of spotIds) {
    const h = hashString(`${id}|${day}`);
    if (h > bestHash) {
      bestHash = h;
      best = id;
    }
  }
  return best;
}

export interface PitchOpponent {
  name: string;
  strength: number;
  isBoss: boolean;
}

/**
 * Das Gegner-Team eines Platzes: Name fest je Platz, Stärke relativ zur
 * aktuellen Team-Stärke des Nutzers (Faktor je Platz+Tag, damit es mal
 * leichter und mal schwerer ist). Der Boss ist deutlich stärker.
 */
export function pitchOpponent(
  spotId: string,
  day: string,
  userStrength: number,
  isBoss: boolean,
): PitchOpponent {
  const nameHash = hashString(spotId);
  const prefix = NPC_CLUB_PREFIXES[nameHash % NPC_CLUB_PREFIXES.length];
  const place = NPC_CLUB_PLACES[Math.floor(nameHash / 7) % NPC_CLUB_PLACES.length];
  const suffix = NPC_CLUB_SUFFIXES[Math.floor(nameHash / 91) % NPC_CLUB_SUFFIXES.length];
  // Zwei Bausteine reichen für einen glaubwürdigen Namen
  const name = nameHash % 2 === 0 ? `${prefix} ${place}` : `${place} ${suffix}`;

  const base = Math.max(userStrength, 300);
  let factor: number;
  if (isBoss) {
    factor = PITCH_BATTLE.bossStrengthFactor;
  } else {
    const [min, max] = PITCH_BATTLE.normalStrengthRange;
    const t = (hashString(`${spotId}|${day}|str`) % 1000) / 1000;
    factor = min + t * (max - min);
  }
  return { name, strength: Math.round(base * factor), isBoss };
}
