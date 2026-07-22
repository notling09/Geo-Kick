import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Sammelalbum / Dex (V7.2): merkt sich dauerhaft (Karriere-übergreifend),
 * welche Spieler man schon einmal besessen hat – auch nach Verkauf oder
 * Karriere-Neustart. Angezeigt werden im Profil nur Gold- und Legendär-Spieler.
 *
 * Wichtig: gemerkt wird der NAME, nicht die Pool-Id – der Pool wird beim
 * Karriere-Neustart neu angelegt (neue Ids), die kuratierten Gold/Legendär-
 * Namen bleiben aber stabil. Der Meta-Key 'dexSeen' steht in der Reset-Keep-Liste.
 */

export async function loadDexSeen(): Promise<Set<string>> {
  const raw = await metaRepo.getMeta('dexSeen');
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Spieler-Namen als „schon besessen" markieren. */
export async function markSeen(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const seen = await loadDexSeen();
  let changed = false;
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      changed = true;
    }
  }
  if (changed) await metaRepo.setMeta('dexSeen', JSON.stringify([...seen]));
}
