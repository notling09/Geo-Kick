import { create } from 'zustand';
import {
  BALANCING, BUY_VALUE, FORMATIONS, MAX_PLAYER_OVERALL, PACK_TYPES, RARITY_OVERALL_RANGE,
  SELL_VALUE, STARTER_OVERALL, USER_CLUB_ID, levelUpCost, type PackTypeId,
} from '../core/domain/constants';
import type {
  Club, FormationId, OwnedPlayer, Pack, PoolPlayer, Position, Rarity, Tactic,
} from '../core/domain/types';
import {
  POOL_SIZE, createCuratedPoolPlayer, createMysteryPoolPlayer, effectiveOverall,
  generateFillerSquad, generatePlayerPool, generateRandomPoolPlayers, overallOf,
  rollAttributes, rollAttributesExact, type NewPoolPlayer,
} from '../core/engine/playerGen';
import { GOLD_PLAYERS, LEGENDARY_PLAYERS, STAR_OVERALL, STAR_POSITIONS, STARTER_WINGERS } from '../core/engine/names';
import { eligiblePositions, slotChemState } from '../core/engine/chemistry';
import { drawPackContent, packTypeFromSource, rollPackBonus, rollTokens } from '../core/engine/packGen';
import { generateMarket, marketDeals, marketSeed } from '../core/engine/transferMarket';
import * as metaRepo from '../core/db/repositories/metaRepo';
import * as playerRepo from '../core/db/repositories/playerRepo';
import * as packRepo from '../core/db/repositories/packRepo';
import { createSeason } from '../core/services/seasonService';
import { markSeen, migrateDexGoldNamesV74 } from '../core/services/dex';
import { setSoundMuted } from '../core/services/sound';
import { addPassPoints, reportMissionEvent } from '../core/services/pass';

/**
 * Globaler Spielzustand (Kader, Coins, Klub) – Zustand-Store über der
 * Repository-Schicht. Alle Mutationen persistieren sofort in SQLite.
 */

interface GameState {
  initialized: boolean;
  onboarded: boolean;
  club: Club | null;
  players: OwnedPlayer[];
  /** 11 Slots gemäß Formation; Wert = playerId oder null */
  lineup: Array<number | null>;
  packs: Pack[];
  pool: PoolPlayer[];
  /** Kapitän (V2): bringt Coin-Boni bei Toren/Assists in Ligaspielen */
  captainPlayerId: number | null;
  /** Level-up-Punkte (V3): aus Duplikaten und Pack-Boni, frei ausgebbar */
  levelPoints: number;
  /** Transfermarkt (V7.4): die 6 Spieler des Tages (KI-Börse) */
  market: PoolPlayer[];
  /** Markt-Slots, die heute schon gekauft wurden (Index in `market`) */
  marketBought: number[];
  /** Seed/Tag des aktuellen Marktes – wechselt um Mitternacht */
  marketDay: number;
  /** Transfermarkt-Token (V7.7): 1 Token = Markt sofort neu würfeln */
  marketTokens: number;
  /** Blitzdeals des aktuellen Marktes (V7.7): Slot-Index → Rabatt-Anteil */
  marketDealMap: Record<number, number>;

  init: () => Promise<void>;
  completeOnboarding: (clubName: string, crest: string, starterPoolId: number) => Promise<void>;
  setFormation: (formation: FormationId) => Promise<void>;
  setTactic: (tactic: Tactic) => Promise<void>;
  setLineupSlot: (slot: number, playerId: number | null) => Promise<void>;
  /** Komplette Aufstellung setzen (V5: Halbzeit-Wechsel gelten nur im Spiel) */
  restoreLineup: (lineup: Array<number | null>) => Promise<void>;
  autoLineup: (excludeIds?: Set<number>) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addLevelPoints: (amount: number) => Promise<void>;
  grantPack: (source: Pack['source']) => Promise<void>;
  openPack: (packId: number) => Promise<PackOpenResult>;
  buyPack: (typeId: PackTypeId) => Promise<boolean>;
  sellDrawnPlayer: (poolPlayer: PoolPlayer) => Promise<void>;
  takeDuplicatePoints: (poolPlayer: PoolPlayer) => Promise<number>;
  levelUpPlayer: (ownedId: number) => Promise<'ok' | 'max' | 'points'>;
  keepDrawnPlayer: (poolPlayer: PoolPlayer, sellOwnedId: number) => Promise<boolean>;
  sellPlayer: (ownedId: number, as?: 'coins' | 'points') => Promise<boolean>;
  setCaptain: (playerId: number) => Promise<void>;
  /** Captain automatisch neu setzen, wenn er nicht mehr in der Startelf ist (V7.4). */
  reassignCaptain: () => Promise<void>;
  claimMysteryPlayer: (name: string) => Promise<PoolPlayer | null>;
  /** Einzelnen gezogenen Spieler aufnehmen (Ei-Ausbrüten, V4) */
  receivePlayer: (poolPlayer: PoolPlayer) => Promise<PackEntry>;
  lineupPlayers: () => Array<OwnedPlayer | null>;
  /** Transfermarkt des Tages neu laden (bei Fokus / Tageswechsel), V7.4 */
  refreshMarket: () => Promise<void>;
  /** Markt-Spieler an Index kaufen (Coins → Kader), V7.4 */
  buyMarketPlayer: (index: number) => Promise<MarketBuyResult>;
  /** Markt mit 1 Token sofort neu würfeln (echte neue Spieler), V7.7 */
  rerollMarket: () => Promise<boolean>;
  /** Transfermarkt-Token gutschreiben (aus Packs/Saisonpass), V7.7 */
  addMarketTokens: (n: number) => Promise<void>;
}

/** Ergebnis eines Markt-Kaufs. */
export type MarketBuyResult = 'ok' | 'no_coins' | 'full' | 'already' | 'error';

/** Ergebnis eines Pack-Zugs pro gezogenem Spieler. */
export interface PackEntry {
  pool: PoolPlayer;
  /**
   * added = aufgenommen · duplicate = Wahl Training/Verkauf offen ·
   * pending = Kader voll (behalten oder verkaufen) ·
   * mystery = die einmalige ???-Karte (Nutzer benennt den 99er beim Aufdecken)
   */
  outcome: 'added' | 'duplicate' | 'pending' | 'mystery';
  coins?: number;
}

/** Ergebnis einer Pack-Öffnung: die 3 Züge + Bonus (Coins UND Punkte, V3). */
export interface PackOpenResult {
  entries: PackEntry[];
  /** Wird doppelt gutgeschrieben: +bonus Coins und +bonus Level-up-Punkte */
  bonus: number;
  /** Transfermarkt-Token aus diesem Pack (0–3), Anzeige nach dem Bonus (V7.7) */
  tokens: number;
}

/** Anzeige-Platzhalter für die ???-Karte, bis der Nutzer sie benannt hat. */
export const MYSTERY_PLACEHOLDER: PoolPlayer = {
  id: -1,
  name: '???',
  position: 'ST',
  rarity: 'geheim',
  tempo: 99, technik: 99, abschluss: 99, verteidigung: 99, kondition: 99,
  isStarterChoice: false,
  isFiller: false,
};

/** V7.6: alte Formations-Namen auf die neuen abbilden (4-4-2→4-2-2-2, 3-4-3→3-5-2). */
const FORMATION_MIGRATION: Record<string, FormationId> = {
  '4-4-2': '4-2-2-2',
  '3-4-3': '3-5-2',
};

async function loadClub(): Promise<Club> {
  const stored = (await metaRepo.getMeta('formation')) ?? '4-2-2-2';
  const migrated = FORMATION_MIGRATION[stored] ?? stored;
  const formation: FormationId =
    migrated in FORMATIONS ? (migrated as FormationId) : '4-2-2-2';
  return {
    name: (await metaRepo.getMeta('clubName')) ?? 'My Club',
    crest: (await metaRepo.getMeta('crest')) ?? 'crest-0',
    division: await metaRepo.getMetaNumber('division', 4),
    coins: await metaRepo.getMetaNumber('coins', 0),
    formation,
    tactic: ((await metaRepo.getMeta('tactic')) ?? 'ausgewogen') as Tactic,
  };
}

/**
 * Migration: Pool bestehender Spielstände auf die aktuellen Zielgrößen
 * auffüllen (2026-07-04 verdoppelt). Kuratierte Gold/Legendär-Stars werden
 * namentlich ergänzt, Bronze/Silber mit frischen Fantasienamen aufgefüllt.
 */
async function topUpPool(): Promise<void> {
  const pool = await playerRepo.getPool();
  const names = new Set(pool.map((p) => p.name));
  const toInsert: NewPoolPlayer[] = [];

  ([
    ['gold', GOLD_PLAYERS],
    ['legendaer', LEGENDARY_PLAYERS],
  ] as const).forEach(([rarity, curated]) => {
    curated.forEach((entry) => {
      if (!names.has(entry.name)) {
        toInsert.push(createCuratedPoolPlayer(rarity, entry));
        names.add(entry.name);
      }
    });
  });

  (['bronze', 'silber'] as const).forEach((rarity) => {
    const existing = pool.filter(
      (p) => p.rarity === rarity && !p.isFiller && !p.isStarterChoice,
    ).length;
    const missing = POOL_SIZE[rarity] - existing;
    if (missing > 0) {
      toInsert.push(...generateRandomPoolPlayers(rarity, missing, names));
    }
  });

  if (toInsert.length > 0) {
    await playerRepo.insertPoolPlayers(toInsert);
  }
}

/**
 * V3-Migration: alle Pool-Spieler auf die neuen Rating-Spannen umrechnen
 * (Bronze 35-59, Silber 60-74, Gold 75-85, Legendär 86-90). Die relative
 * Qualität innerhalb der Seltenheit bleibt erhalten (linear skaliert);
 * Starter bekommen exakt 80. Füllspieler (38-46) passen bereits.
 */
const OLD_OVERALL_RANGE: Record<Rarity, [number, number]> = {
  bronze: [45, 58],
  silber: [59, 72],
  gold: [73, 86],
  legendaer: [87, 96],
  geheim: [99, 99],
};

/**
 * V7.6-Migration: bestehende Bronze/Silber/Füllspieler von den alten 4
 * Positionen auf die neuen 6 bringen. ABW → CB oder AV (je Id), ST → ST oder
 * Flügel (~1/3), MF/TW bleiben. Kuratierte Stars bekommen ihre Position schon
 * über syncCuratedRarity, werden hier also übersprungen. Läuft einmal (Flag).
 */
async function migratePositionsV76(): Promise<void> {
  if ((await metaRepo.getMeta('positionsV76')) === '1') return;
  const pool = await playerRepo.getPool();
  for (const p of pool) {
    if (STAR_POSITIONS[p.name] || p.isStarterChoice) continue;
    const old = p.position as string;
    let next: Position | null = null;
    if (old === 'ABW') next = p.id % 2 === 0 ? 'CB' : 'FB';
    else if (old === 'ST') next = p.id % 3 === 0 ? 'FL' : 'ST';
    if (next && next !== p.position) await playerRepo.updatePoolPosition(p.id, next);
  }
  await metaRepo.setMeta('positionsV76', '1');
}

/**
 * V7.5-Migration: alle Stars (Gold UND Legendary) auf ihr festes, realitäts-
 * nahes Rating bringen (STAR_OVERALL). Läuft einmal (eigener Meta-Flag, damit
 * es auch bei Nutzern greift, die die V7.4-Ratings schon hatten). Nur das
 * Basis-Rating (Attribute) wird neu gesetzt – Level-ups bleiben erhalten.
 */
async function migrateCuratedRatingsV75(): Promise<void> {
  if ((await metaRepo.getMeta('curatedRatingsV75')) === '1') return;
  const pool = await playerRepo.getPool();
  for (const p of pool) {
    const target = STAR_OVERALL[p.name];
    if (target === undefined) continue;
    if (overallOf(p, p.position) === target) continue;
    await playerRepo.updatePoolAttributes(p.id, rollAttributes(p.position, target));
  }
  await metaRepo.setMeta('curatedRatingsV75', '1');
}

async function migrateRatingsV3(): Promise<void> {
  if ((await metaRepo.getMeta('ratingsV3')) === '1') return;
  const pool = await playerRepo.getPool();
  for (const p of pool) {
    if (p.isFiller || p.rarity === 'geheim') continue;
    let attrs;
    if (p.isStarterChoice) {
      attrs = rollAttributesExact(p.position, STARTER_OVERALL);
    } else {
      const [oldMin, oldMax] = OLD_OVERALL_RANGE[p.rarity];
      const [newMin, newMax] = RARITY_OVERALL_RANGE[p.rarity];
      const t = Math.min(1, Math.max(0, (overallOf(p, p.position) - oldMin) / (oldMax - oldMin)));
      attrs = rollAttributes(p.position, Math.round(newMin + t * (newMax - newMin)));
    }
    await playerRepo.updatePoolAttributes(p.id, attrs);
  }
  await metaRepo.setMeta('ratingsV3', '1');
}

function lineupArray(map: Map<number, number>): Array<number | null> {
  return Array.from({ length: 11 }, (_, slot) => map.get(slot) ?? null);
}

/**
 * Optimale Zuordnung (Ungarische Methode / Kuhn-Munkres, O(n³)) auf einer
 * quadratischen Kostenmatrix. Liefert je Zeile die zugeordnete Spalte mit
 * minimalen Gesamtkosten. Klassische e-maxx-Implementierung (1-indiziert).
 */
function hungarianAssign(cost: number[][]): number[] {
  const n = cost.length;
  const INF = Infinity;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0); // p[j] = der Spalte j zugeordnete Zeile
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const rowToCol = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) rowToCol[p[j] - 1] = j - 1;
  }
  return rowToCol;
}

/**
 * Beste verfügbare Elf automatisch auf die Formations-Slots verteilen (V7.8).
 * Bewertet jedes (Slot, Spieler)-Paar mit Overall × Positions-Faktor (Rot −20 %,
 * Grün/Gelb voll) plus kleinem Grün-Bonus für Feldspieler und findet dann die
 * OPTIMALE Zuordnung (nicht mehr gierig). Dadurch werden Ausweich-Fehler
 * vermieden: ein 99er-Feldspieler (z. B. die ???-Karte, die überall grün ist)
 * landet nicht mehr im Tor, wenn er im Feld mehr Gesamtstärke bringt – die
 * ungarische Methode berücksichtigt die Opportunitätskosten aller Slots.
 */
function buildAutoLineup(
  players: OwnedPlayer[],
  formation: FormationId,
  excludeIds?: Set<number>,
): Array<number | null> {
  const slots = FORMATIONS[formation];
  // Gesperrte/verletzte Spieler werden nie automatisch aufgestellt (V7)
  const pool = excludeIds && excludeIds.size > 0
    ? players.filter((p) => !excludeIds.has(p.id))
    : players;
  const result: Array<number | null> = new Array(11).fill(null);
  const m = pool.length;
  if (m === 0) return result;

  const value = (slot: number, p: OwnedPlayer): number => {
    const ov = effectiveOverall(p.pool, p.level);
    const state = slotChemState(slots[slot], p.pool);
    const factor = state === 'red' ? 0.8 : 1;
    // Grün-Bonus nur für Feldspieler (der Torwart-Slot zählt nicht zur Chemie).
    const bonus = state === 'green' && slots[slot] !== 'TW' ? 0.5 : 0;
    return ov * factor + bonus;
  };

  // Quadratische Kostenmatrix: 11 echte Slots + Dummy-Slots (Wert 0) gegen alle
  // Spieler + Dummy-Spieler. Kosten = BIG − Wert (Minimierung = Maximierung).
  const k = Math.max(11, m);
  const BIG = 1_000_000;
  const cost: number[][] = [];
  for (let i = 0; i < k; i++) {
    const row = new Array<number>(k);
    for (let j = 0; j < k; j++) {
      const val = i < 11 && j < m ? value(i, pool[j]) : 0;
      row[j] = BIG - val;
    }
    cost.push(row);
  }
  const rowToCol = hungarianAssign(cost);
  for (let slot = 0; slot < 11; slot++) {
    const j = rowToCol[slot];
    if (j >= 0 && j < m) result[slot] = pool[j].id;
  }
  return result;
}

/**
 * „Sanftes" Umsortieren beim Formationswechsel (V7.7): die GLEICHE Elf wird nur
 * positionsgerecht auf die neuen Slots verteilt (passende Position zuerst, dann
 * Lücken). Kein Stärke-Optimieren – das macht nur der Beste-Elf-Button.
 */
function remapLineup(currentXI: OwnedPlayer[], formation: FormationId): Array<number | null> {
  const slots = FORMATIONS[formation];
  const by = [...currentXI].sort(
    (a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level),
  );
  const used = new Set<number>();
  const result: Array<number | null> = new Array(11).fill(null);
  slots.forEach((pos, slot) => {
    const c = by.find((p) => !used.has(p.id) && eligiblePositions(p.pool).includes(pos));
    if (c) { result[slot] = c.id; used.add(c.id); }
  });
  slots.forEach((_pos, slot) => {
    if (result[slot] !== null) return;
    const c = by.find((p) => !used.has(p.id));
    if (c) { result[slot] = c.id; used.add(c.id); }
  });
  return result;
}

/**
 * Captain sicherstellen (V7.4): Ist der aktuelle Captain nicht (mehr) in der
 * Startelf – z. B. nach einer roten Karte herausgenommen oder ausgewechselt –,
 * wird der Spieler mit dem HÖCHSTEN Overall aus der Elf automatisch Captain.
 * So gibt es immer einen Captain auf dem Feld (wichtig für Elfmeter/Boni).
 */
function pickCaptainFor(
  players: OwnedPlayer[],
  lineup: Array<number | null>,
  current: number | null,
): number | null {
  const ids = lineup.filter((id): id is number => id !== null);
  if (current !== null && ids.includes(current)) return current;
  const inXi = players.filter((p) => ids.includes(p.id));
  if (inXi.length === 0) return current;
  return [...inXi].sort(
    (a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level),
  )[0].id;
}

export const useGameStore = create<GameState>((set, get) => ({
  initialized: false,
  onboarded: false,
  club: null,
  players: [],
  lineup: new Array(11).fill(null),
  packs: [],
  pool: [],
  captainPlayerId: null,
  levelPoints: 0,
  market: [],
  marketBought: [],
  marketDay: 0,
  marketTokens: 0,
  marketDealMap: {},

  init: async () => {
    // Spieler-Pool einmalig erzeugen (fiktive Identitäten, Kapitel 8/9)
    const seeded = await metaRepo.getMeta('poolSeeded');
    if (!seeded) {
      await playerRepo.insertPoolPlayers(generatePlayerPool());
      await metaRepo.setMeta('poolSeeded', '1');
      // Frisch geseedet = bereits auf den V3-Spannen und mit festen Star-Ratings
      await metaRepo.setMeta('ratingsV3', '1');
      await metaRepo.setMeta('curatedRatingsV75', '1');
      await metaRepo.setMeta('positionsV76', '1');
    } else {
      // Bestehende Installationen: Starter-Namen an die aktuelle Liste angleichen
      await playerRepo.syncStarterNames(STARTER_WINGERS.map((s) => s.name));
      // … und Gold/Legendär auf die kuratierten Star-Identitäten migrieren
      await playerRepo.syncCuratedRarity('gold', GOLD_PLAYERS);
      await playerRepo.syncCuratedRarity('legendaer', LEGENDARY_PLAYERS);
      // Sammelalbum: alten Gold-Namen den „besessen"-Haken auf den neuen 2026-
      // Namen an gleicher Position übertragen (V7.4)
      await migrateDexGoldNamesV74();
      // Pool auf die aktuellen Zielgrößen auffüllen (Verdopplung)
      await topUpPool();
      // V7.6: bestehende Bronze/Silber/Füllspieler auf die 6 Positionen bringen
      // (vor allem, was auf p.position rechnet – die alte 'ABW' gibt es nicht mehr)
      await migratePositionsV76();
      // V3: neue Rating-Spannen auf den Bestand anwenden
      await migrateRatingsV3();
      // V7.5: alle Stars (Gold + Legendary) auf ihr festes Rating bringen
      await migrateCuratedRatingsV75();
    }
    // Sound-Stummschaltung aus dem Spielstand übernehmen (V7.4)
    setSoundMuted((await metaRepo.getMeta('soundMuted')) === '1');
    const onboarded = (await metaRepo.getMeta('onboarded')) === '1';
    const pool = await playerRepo.getPool();
    if (onboarded) {
      const [club, players, lineupMap, packs] = await Promise.all([
        loadClub(),
        playerRepo.getOwnedPlayers(),
        playerRepo.getLineup(),
        packRepo.getPacks(),
      ]);
      // Sammelalbum: aktuelle Kaderspieler als besessen merken (Migration + laufend)
      await markSeen(players.map((p) => p.pool.name));
      // Captain laden; Migration: alte Spielstände bekommen den gewählten
      // Starter (bzw. den stärksten Spieler) als Standard-Captain
      let captainPlayerId = await metaRepo.getMetaNumber('captainPlayerId', 0);
      if (!players.some((p) => p.id === captainPlayerId)) {
        const starter = players.find((p) => p.pool.isStarterChoice);
        const fallback =
          starter ??
          [...players].sort(
            (a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level),
          )[0];
        captainPlayerId = fallback?.id ?? 0;
        if (captainPlayerId) await metaRepo.setMeta('captainPlayerId', String(captainPlayerId));
      }
      set({
        initialized: true,
        onboarded,
        club,
        players,
        lineup: lineupArray(lineupMap),
        packs,
        pool,
        captainPlayerId: captainPlayerId || null,
        levelPoints: await metaRepo.getMetaNumber('levelPoints', 0),
        marketTokens: await metaRepo.getMetaNumber('marketTokens', 0),
      });
      // Transfermarkt des Tages bereitstellen (V7.4)
      await get().refreshMarket();
    } else {
      set({ initialized: true, onboarded: false, pool });
    }
  },

  completeOnboarding: async (clubName, crest, starterPoolId) => {
    // Füllspieler + gewählter Starter in den Kader (Kapitel 2.2)
    const fillers = generateFillerSquad();
    await playerRepo.insertPoolPlayers(fillers);
    const pool = await playerRepo.getPool();
    const fillerIds = pool.filter((p) => p.isFiller).map((p) => p.id);
    for (const poolId of fillerIds) {
      await playerRepo.addOwnedPlayer(poolId);
    }
    await playerRepo.addOwnedPlayer(starterPoolId);

    await metaRepo.setMeta('clubName', clubName);
    await metaRepo.setMeta('crest', crest);
    await metaRepo.setMeta('division', '4');
    await metaRepo.setMeta('coins', '0');
    await metaRepo.setMeta('formation', '4-2-2-2');
    await metaRepo.setMeta('tactic', 'ausgewogen');

    const players = await playerRepo.getOwnedPlayers();
    const lineup = buildAutoLineup(players, '4-2-2-2');
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));

    // Der gewählte Starter ist der erste Captain (V2). Wichtig: auch sofort
    // in den Store schreiben, nicht nur in die Meta – sonst hat der Klub bis
    // zum nächsten App-Start keinen Captain (V4-Fix)
    const captain = players.find((p) => p.poolId === starterPoolId);
    if (captain) await metaRepo.setMeta('captainPlayerId', String(captain.id));

    // Erste Saison in Division 4 anlegen
    await createSeason(1, 4);
    await metaRepo.setMeta('onboarded', '1');

    set({
      onboarded: true,
      club: await loadClub(),
      players,
      lineup,
      packs: await packRepo.getPacks(),
      pool,
      captainPlayerId: captain?.id ?? null,
    });
  },

  setFormation: async (formation) => {
    // Formationswechsel behält die aktuelle Elf: dieselben Spieler werden nur
    // auf die neuen Slots verteilt (Positions-Treffer zuerst). Tauschen macht
    // der Nutzer selbst bzw. über den Best-XI-Button.
    await metaRepo.setMeta('formation', formation);
    const { players, lineup } = get();
    const currentXI = lineup
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is OwnedPlayer => p !== undefined);
    const remapped = remapLineup(currentXI, formation);
    await playerRepo.replaceLineup(remapped.map((id, slot) => [slot, id]));
    set((s) => ({ club: s.club ? { ...s.club, formation } : s.club, lineup: remapped }));
  },

  setTactic: async (tactic) => {
    await metaRepo.setMeta('tactic', tactic);
    set((s) => ({ club: s.club ? { ...s.club, tactic } : s.club }));
  },

  setLineupSlot: async (slot, playerId) => {
    const lineup = [...get().lineup];
    // Stand der Spieler schon im Feld → echter TAUSCH (V7.7-Fix): der bisherige
    // Spieler auf `slot` wandert auf dessen alten Platz, statt zu verschwinden.
    if (playerId !== null) {
      const existing = lineup.indexOf(playerId);
      if (existing >= 0 && existing !== slot) {
        const displaced = lineup[slot];
        lineup[existing] = displaced;
        await playerRepo.setLineupSlot(existing, displaced);
      }
    }
    lineup[slot] = playerId;
    await playerRepo.setLineupSlot(slot, playerId);
    set({ lineup });
    await get().reassignCaptain();
  },

  restoreLineup: async (lineup) => {
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));
    set({ lineup: [...lineup] });
    await get().reassignCaptain();
  },

  autoLineup: async (excludeIds) => {
    const { players, club } = get();
    const lineup = buildAutoLineup(players, club?.formation ?? '4-2-2-2', excludeIds);
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));
    set({ lineup });
    await get().reassignCaptain();
  },

  /** Captain automatisch auf den bestbewerteten Spieler der Elf setzen, wenn nötig. */
  reassignCaptain: async () => {
    const { players, lineup, captainPlayerId } = get();
    const next = pickCaptainFor(players, lineup, captainPlayerId);
    if (next !== captainPlayerId) {
      if (next !== null) await metaRepo.setMeta('captainPlayerId', String(next));
      set({ captainPlayerId: next });
    }
  },

  addCoins: async (amount) => {
    const club = get().club;
    if (!club) return;
    const coins = Math.max(0, club.coins + amount);
    await metaRepo.setMeta('coins', String(coins));
    set({ club: { ...club, coins } });
  },

  addLevelPoints: async (amount) => {
    const levelPoints = Math.max(0, get().levelPoints + amount);
    await metaRepo.setMeta('levelPoints', String(levelPoints));
    set({ levelPoints });
  },

  grantPack: async (source) => {
    await packRepo.addPack(source);
    set({ packs: await packRepo.getPacks() });
  },

  openPack: async (packId) => {
    const { pool, packs } = get();
    const pack = packs.find((p) => p.id === packId);
    const packType = packTypeFromSource(pack?.source ?? 'session');
    // Die ???-Karte ist nur ein einziges Mal überhaupt ziehbar
    const mysteryAvailable = (await metaRepo.getMeta('mysteryClaimed')) !== '1';
    const drawn = drawPackContent(pool, packType, mysteryAvailable);
    await packRepo.markPackOpened(packId, drawn.players.map((p) => p.id));

    // Duplikate: Nutzer wählt Training oder Verkauf (duplicate). Neue Spieler
    // kommen bis zum Kader-Limit in den Klub; darüber entscheidet der Nutzer
    // zwischen Verkaufen und Behalten (pending).
    const entries: PackEntry[] = [];
    for (const p of drawn.players) {
      const players = await playerRepo.getOwnedPlayers();
      const isDuplicate =
        players.some((o) => o.poolId === p.id) || entries.some((e) => e.pool.id === p.id);
      if (isDuplicate) {
        entries.push({ pool: p, outcome: 'duplicate', coins: SELL_VALUE[p.rarity] });
      } else if (players.length < BALANCING.maxSquadSize) {
        await playerRepo.addOwnedPlayer(p.id);
        entries.push({ pool: p, outcome: 'added' });
      } else {
        entries.push({ pool: p, outcome: 'pending' });
      }
    }
    // Die ???-Karte kommt immer als letzter (bester) Zug dazu; benannt und
    // aufgenommen wird sie erst beim Aufdecken (claimMysteryPlayer).
    if (drawn.mystery) {
      entries.push({ pool: MYSTERY_PLACEHOLDER, outcome: 'mystery' });
    }
    // Pack-Bonus (V3): ein Betrag aus der Pack-Spanne, doppelt gutgeschrieben
    // (Coins UND Level-up-Punkte); angezeigt wird er nach dem letzten Spieler.
    const bonus = rollPackBonus(packType);
    await get().addCoins(bonus);
    await get().addLevelPoints(bonus);
    // Transfermarkt-Token aus dem Pack (V7.7): 0–3, je nach Pack-Typ
    const tokens = rollTokens(packType);
    if (tokens > 0) await get().addMarketTokens(tokens);
    // Saisonpass (V7.7): Pack geöffnet
    await addPassPoints(10);
    await reportMissionEvent('openPack');
    // Sammelalbum: alle gezogenen Spieler als „besessen" merken (V7.2)
    await markSeen(entries.map((e) => e.pool.name));
    set({
      packs: await packRepo.getPacks(),
      players: await playerRepo.getOwnedPlayers(),
    });
    return { entries, bonus, tokens };
  },

  /**
   * Die aufgedeckte ???-Karte benennen und aufnehmen (V3): 99er-Spieler mit
   * Wunschname und -position. Kommt IMMER in den Klub – auch über das
   * Kader-Limit hinaus, damit die einmalige Karte nie verloren geht.
   */
  claimMysteryPlayer: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    // Die ???-Karte hat keine feste Position (sie spielt überall) – intern
    // speichern wir nur einen Platzhalter, die Chemie überschreibt ihn (V7.7).
    const poolId = await playerRepo.insertPoolPlayerReturningId(
      createMysteryPoolPlayer(trimmed, 'MF'),
    );
    await playerRepo.addOwnedPlayer(poolId);
    await metaRepo.setMeta('mysteryClaimed', '1');
    const [pool, players] = await Promise.all([
      playerRepo.getPool(),
      playerRepo.getOwnedPlayers(),
    ]);
    set({ pool, players });
    return pool.find((p) => p.id === poolId) ?? null;
  },

  /**
   * Duplikat in Level-up-Punkte umwandeln (V3): gleicher Wert wie beim
   * Verkauf, aber als frei ausgebbare Punkte. Liefert die Punktzahl.
   */
  takeDuplicatePoints: async (poolPlayer) => {
    const points = SELL_VALUE[poolPlayer.rarity];
    await get().addLevelPoints(points);
    return points;
  },

  /**
   * Level-up-Punkte für einen beliebigen eigenen Spieler ausgeben (V3):
   * Kosten steigen mit dem aktuellen Rating (25/50/100/200, ab 90: 250);
   * Obergrenze ist 99 Overall.
   */
  levelUpPlayer: async (ownedId) => {
    const { players, levelPoints } = get();
    const owned = players.find((p) => p.id === ownedId);
    if (!owned) return 'max';
    const overall = effectiveOverall(owned.pool, owned.level);
    const cost = overall >= MAX_PLAYER_OVERALL ? null : levelUpCost(overall);
    if (cost === null || owned.level >= BALANCING.maxPlayerLevel) return 'max';
    if (levelPoints < cost) return 'points';
    await playerRepo.setPlayerLevel(owned.id, owned.level + 1);
    await get().addLevelPoints(-cost);
    await addPassPoints(10); // Saisonpass: Spieler-Upgrade (V7.7)
    set({ players: await playerRepo.getOwnedPlayers() });
    return 'ok';
  },

  buyPack: async (typeId) => {
    const club = get().club;
    const packType = PACK_TYPES[typeId];
    if (!club || packType.price === null || club.coins < packType.price) return false;
    await get().addCoins(-packType.price);
    await get().grantPack(`shop-${typeId}`);
    return true;
  },

  /** Gezogenen Spieler ohne Platz verkaufen (Kader-Limit erreicht). */
  sellDrawnPlayer: async (poolPlayer) => {
    await get().addCoins(SELL_VALUE[poolPlayer.rarity]);
  },

  /**
   * Gezogenen Spieler behalten: dafür einen eigenen (nicht aufgestellten)
   * Spieler verkaufen und den neuen aufnehmen.
   */
  keepDrawnPlayer: async (poolPlayer, sellOwnedId) => {
    const { players, lineup, captainPlayerId } = get();
    const victim = players.find((p) => p.id === sellOwnedId);
    if (!victim || lineup.includes(sellOwnedId) || sellOwnedId === captainPlayerId) return false;
    if (victim.pool.rarity === 'geheim') return false;
    await playerRepo.deleteOwnedPlayer(sellOwnedId);
    await get().addCoins(SELL_VALUE[victim.pool.rarity]);
    await playerRepo.addOwnedPlayer(poolPlayer.id);
    set({ players: await playerRepo.getOwnedPlayers() });
    return true;
  },

  setCaptain: async (playerId) => {
    if (!get().players.some((p) => p.id === playerId)) return;
    await metaRepo.setMeta('captainPlayerId', String(playerId));
    set({ captainPlayerId: playerId });
  },

  /**
   * Einzelnen Spieler aufnehmen (V4, Ei-Ausbrüten): gleiche Regeln wie beim
   * Pack – Duplikat = Wahl Punkte/Verkauf, Kader voll = behalten/verkaufen.
   */
  receivePlayer: async (poolPlayer) => {
    await markSeen([poolPlayer.name]);
    const players = await playerRepo.getOwnedPlayers();
    let entry: PackEntry;
    if (players.some((o) => o.poolId === poolPlayer.id)) {
      entry = { pool: poolPlayer, outcome: 'duplicate', coins: SELL_VALUE[poolPlayer.rarity] };
    } else if (players.length < BALANCING.maxSquadSize) {
      await playerRepo.addOwnedPlayer(poolPlayer.id);
      entry = { pool: poolPlayer, outcome: 'added' };
    } else {
      entry = { pool: poolPlayer, outcome: 'pending' };
    }
    set({ players: await playerRepo.getOwnedPlayers() });
    return entry;
  },

  /**
   * Eigenen Spieler verkaufen (nicht möglich: aufgestellt, Captain oder
   * ???-Karte). V7: Der Erlös geht wahlweise als Coins ODER als Level-up-
   * Punkte in gleicher Höhe (Standard: Coins).
   */
  sellPlayer: async (ownedId, as = 'coins') => {
    const { players, lineup, captainPlayerId } = get();
    const player = players.find((p) => p.id === ownedId);
    if (!player || lineup.includes(ownedId) || ownedId === captainPlayerId) return false;
    if (player.pool.rarity === 'geheim') return false;
    await playerRepo.deleteOwnedPlayer(ownedId);
    const value = SELL_VALUE[player.pool.rarity];
    if (as === 'points') await get().addLevelPoints(value);
    else await get().addCoins(value);
    set({ players: await playerRepo.getOwnedPlayers() });
    return true;
  },

  lineupPlayers: () => {
    const { players, lineup } = get();
    return lineup.map((id) => players.find((p) => p.id === id) ?? null);
  },

  /**
   * Transfermarkt laden (V7.4/V7.7). Gespeichert wird {day, seed, bought}: der
   * Tagesmarkt hat seed = Tagesnummer; nach einem Token-Reroll steht dort ein
   * Zufalls-Seed für denselben Tag. Bei Tageswechsel gibt es einen frischen
   * Tagesmarkt (bought zurückgesetzt).
   */
  refreshMarket: async () => {
    const pool = get().pool;
    if (pool.length === 0) return;
    const today = marketSeed();
    let seed = today;
    let bought: number[] = [];
    try {
      const stored = JSON.parse((await metaRepo.getMeta('market')) || 'null') as
        | { day: number; seed: number; bought: number[] }
        | null;
      if (stored && stored.day === today) {
        seed = stored.seed;
        bought = stored.bought ?? [];
      } else {
        await metaRepo.setMeta('market', JSON.stringify({ day: today, seed: today, bought: [] }));
      }
    } catch {
      seed = today;
    }
    set({
      market: generateMarket(pool, seed), marketDay: today, marketBought: bought,
      marketDealMap: marketDeals(seed),
    });
  },

  /**
   * Einen Markt-Spieler kaufen: Kaufpreis (BUY_VALUE) von den Coins abziehen
   * und den Spieler in den Kader aufnehmen. Der Slot gilt danach als gekauft.
   * Kader-Limit und Coins werden geprüft.
   */
  buyMarketPlayer: async (index) => {
    const { market, marketBought, club, players } = get();
    const poolPlayer = market[index];
    if (!poolPlayer || poolPlayer.rarity === 'geheim') return 'error';
    if (marketBought.includes(index)) return 'already';
    if (players.length >= BALANCING.maxSquadSize) return 'full';
    // Blitzdeal-Rabatt auf diesen Slot anwenden (V7.7)
    const discount = get().marketDealMap[index] ?? 0;
    const price = Math.round(BUY_VALUE[poolPlayer.rarity] * (1 - discount));
    if (!club || club.coins < price) return 'no_coins';
    await get().addCoins(-price);
    await playerRepo.addOwnedPlayer(poolPlayer.id);
    await markSeen([poolPlayer.name]);
    // Saisonpass (V7.7): Marktspieler gekauft
    await addPassPoints(15);
    await reportMissionEvent('marketBuy');
    const bought = [...marketBought, index];
    const today = marketSeed();
    let seed = today;
    try {
      const stored = JSON.parse((await metaRepo.getMeta('market')) || 'null') as
        | { seed: number } | null;
      if (stored?.seed !== undefined) seed = stored.seed;
    } catch { /* Tagesmarkt */ }
    await metaRepo.setMeta('market', JSON.stringify({ day: today, seed, bought }));
    set({ marketBought: bought, players: await playerRepo.getOwnedPlayers() });
    return 'ok';
  },

  /** Markt mit 1 Token sofort neu würfeln: echte neue Zufallsspieler (V7.7). */
  rerollMarket: async () => {
    const pool = get().pool;
    if (get().marketTokens < 1 || pool.length === 0) return false;
    await get().addMarketTokens(-1);
    const today = marketSeed();
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    await metaRepo.setMeta('market', JSON.stringify({ day: today, seed, bought: [] }));
    set({
      market: generateMarket(pool, seed), marketDay: today, marketBought: [],
      marketDealMap: marketDeals(seed),
    });
    return true;
  },

  addMarketTokens: async (n) => {
    const marketTokens = Math.max(0, get().marketTokens + n);
    await metaRepo.setMeta('marketTokens', String(marketTokens));
    set({ marketTokens });
  },
}));

export { USER_CLUB_ID };
