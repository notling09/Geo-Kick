import * as metaRepo from '../db/repositories/metaRepo';
import { GOLD_PLAYERS } from '../engine/names';

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

/**
 * Die zweite Hälfte der Gold-Liste (Positionen 40-80) wurde in V7.4 von den
 * 2020er-Stars auf aktuelle 2026er-Namen umgestellt. Der Pool selbst wird
 * beim Start per syncCuratedRarity POSITIONSGENAU umbenannt (Id bleibt), damit
 * Kader-Spieler automatisch den neuen Namen tragen. Das Sammelalbum merkt sich
 * aber NAMEN – deshalb hier die alten Namen an derselben Position, um im Dex den
 * „schon besessen"-Haken vom alten auf den neuen Namen zu übertragen.
 */
const OLD_GOLD_NAMES_V72_TAIL: string[] = [
  'Mohamed Salano', 'Sadio Manne', 'Karim Benzemo', 'Luis Suarest', 'Sergio Aguerro',
  'Gareth Balo', 'Eden Hazardo', 'Darwin Nunes', 'Cody Gakpoo', 'Memphis Depai',
  'Richarleson', 'Gabriel Jesuz', 'Paul Pogban', 'Ngolo Kanto', 'Sergio Busketz',
  'Casimiro Alvez', 'Joshua Kimmen', 'Leon Goretzko', 'Marco Reuss', 'Thomas Mullen',
  'Serge Gnabri', 'Leroy Sano', 'Raheem Sterlin', 'Jack Grealesh', 'Bukayo Sako',
  'Mason Mounto', 'Raphael Varano', 'David Alabo', 'Joao Cancelio', 'Reece Jamez',
  'Andrew Robertsen', 'Jules Koundo', 'Presnel Kimpembo', 'Dani Alvez', 'Marcelo Vieri',
  'Ben Chilwer', 'Marc ter Stegan', 'Wojciech Szczesni', 'Yann Sommen', 'Kepa Arizabal',
  'Gregor Kobelo',
];

/**
 * Einmal-Migration (V7.4): überträgt im Sammelalbum den „besessen"-Status von
 * den alten Gold-Namen auf die neuen an gleicher Listenposition. Idempotent
 * (Meta-Flag), tut nichts, wenn schon migriert oder kein alter Name gemerkt.
 */
export async function migrateDexGoldNamesV74(): Promise<void> {
  if ((await metaRepo.getMeta('dexGoldV74')) === '1') return;
  const seen = await loadDexSeen();
  const newTail = GOLD_PLAYERS.slice(GOLD_PLAYERS.length - OLD_GOLD_NAMES_V72_TAIL.length);
  let changed = false;
  OLD_GOLD_NAMES_V72_TAIL.forEach((oldName, i) => {
    const newName = newTail[i]?.name;
    if (newName && oldName !== newName && seen.has(oldName)) {
      seen.delete(oldName);
      seen.add(newName);
      changed = true;
    }
  });
  if (changed) await metaRepo.setMeta('dexSeen', JSON.stringify([...seen]));
  await metaRepo.setMeta('dexGoldV74', '1');
}
