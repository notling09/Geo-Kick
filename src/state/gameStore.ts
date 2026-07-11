import { create } from 'zustand';
import {
  BALANCING, FORMATIONS, MAX_PLAYER_OVERALL, PACK_TYPES, RARITY_OVERALL_RANGE, SELL_VALUE,
  STARTER_OVERALL, USER_CLUB_ID, levelUpCost, type PackTypeId,
} from '../core/domain/constants';
import type {
  Club, FormationId, OwnedPlayer, Pack, PoolPlayer, Position, Rarity, Tactic,
} from '../core/domain/types';
import {
  POOL_SIZE, createCuratedPoolPlayer, createMysteryPoolPlayer, effectiveOverall,
  generateFillerSquad, generatePlayerPool, generateRandomPoolPlayers, overallOf,
  rollAttributes, rollAttributesExact, type NewPoolPlayer,
} from '../core/engine/playerGen';
import { GOLD_PLAYERS, LEGENDARY_PLAYERS, STARTER_WINGERS } from '../core/engine/names';
import { drawPackContent, packTypeFromSource, rollPackBonus } from '../core/engine/packGen';
import * as metaRepo from '../core/db/repositories/metaRepo';
import * as playerRepo from '../core/db/repositories/playerRepo';
import * as packRepo from '../core/db/repositories/packRepo';
import { createSeason } from '../core/services/seasonService';

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

  init: () => Promise<void>;
  completeOnboarding: (clubName: string, crest: string, starterPoolId: number) => Promise<void>;
  setFormation: (formation: FormationId) => Promise<void>;
  setTactic: (tactic: Tactic) => Promise<void>;
  setLineupSlot: (slot: number, playerId: number | null) => Promise<void>;
  autoLineup: () => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addLevelPoints: (amount: number) => Promise<void>;
  grantPack: (source: Pack['source']) => Promise<void>;
  openPack: (packId: number) => Promise<PackOpenResult>;
  buyPack: (typeId: PackTypeId) => Promise<boolean>;
  sellDrawnPlayer: (poolPlayer: PoolPlayer) => Promise<void>;
  takeDuplicatePoints: (poolPlayer: PoolPlayer) => Promise<number>;
  levelUpPlayer: (ownedId: number) => Promise<'ok' | 'max' | 'points'>;
  keepDrawnPlayer: (poolPlayer: PoolPlayer, sellOwnedId: number) => Promise<boolean>;
  sellPlayer: (ownedId: number) => Promise<boolean>;
  setCaptain: (playerId: number) => Promise<void>;
  claimMysteryPlayer: (name: string, position: Position) => Promise<PoolPlayer | null>;
  /** Einzelnen gezogenen Spieler aufnehmen (Ei-Ausbrüten, V4) */
  receivePlayer: (poolPlayer: PoolPlayer) => Promise<PackEntry>;
  lineupPlayers: () => Array<OwnedPlayer | null>;
}

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

async function loadClub(): Promise<Club> {
  // Gespeicherte Formation validieren (z. B. entferntes 3-5-2 aus alten Ständen)
  const storedFormation = (await metaRepo.getMeta('formation')) ?? '4-4-2';
  const formation: FormationId =
    storedFormation in FORMATIONS ? (storedFormation as FormationId) : '4-4-2';
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

/** Beste verfügbare Spieler automatisch auf die Formations-Slots verteilen. */
function buildAutoLineup(
  players: OwnedPlayer[],
  formation: FormationId,
): Array<number | null> {
  const slots = FORMATIONS[formation];
  const used = new Set<number>();
  const byOverall = [...players].sort(
    (a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level),
  );
  const result: Array<number | null> = new Array(11).fill(null);
  // Erst passende Positionen besetzen …
  slots.forEach((pos, slot) => {
    const candidate = byOverall.find((p) => !used.has(p.id) && p.pool.position === pos);
    if (candidate) {
      result[slot] = candidate.id;
      used.add(candidate.id);
    }
  });
  // … dann Lücken mit den besten Restspielern füllen
  slots.forEach((_pos, slot) => {
    if (result[slot] !== null) return;
    const candidate = byOverall.find((p) => !used.has(p.id));
    if (candidate) {
      result[slot] = candidate.id;
      used.add(candidate.id);
    }
  });
  return result;
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

  init: async () => {
    // Spieler-Pool einmalig erzeugen (fiktive Identitäten, Kapitel 8/9)
    const seeded = await metaRepo.getMeta('poolSeeded');
    if (!seeded) {
      await playerRepo.insertPoolPlayers(generatePlayerPool());
      await metaRepo.setMeta('poolSeeded', '1');
      // Frisch geseedet = bereits auf den V3-Spannen
      await metaRepo.setMeta('ratingsV3', '1');
    } else {
      // Bestehende Installationen: Starter-Namen an die aktuelle Liste angleichen
      await playerRepo.syncStarterNames(STARTER_WINGERS.map((s) => s.name));
      // … und Gold/Legendär auf die kuratierten Star-Identitäten migrieren
      await playerRepo.syncCuratedRarity('gold', GOLD_PLAYERS);
      await playerRepo.syncCuratedRarity('legendaer', LEGENDARY_PLAYERS);
      // Pool auf die aktuellen Zielgrößen auffüllen (Verdopplung)
      await topUpPool();
      // V3: neue Rating-Spannen auf den Bestand anwenden
      await migrateRatingsV3();
    }
    const onboarded = (await metaRepo.getMeta('onboarded')) === '1';
    const pool = await playerRepo.getPool();
    if (onboarded) {
      const [club, players, lineupMap, packs] = await Promise.all([
        loadClub(),
        playerRepo.getOwnedPlayers(),
        playerRepo.getLineup(),
        packRepo.getPacks(),
      ]);
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
      });
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
    await metaRepo.setMeta('formation', '4-4-2');
    await metaRepo.setMeta('tactic', 'ausgewogen');

    const players = await playerRepo.getOwnedPlayers();
    const lineup = buildAutoLineup(players, '4-4-2');
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));

    // Der gewählte Starter ist der erste Captain (V2)
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
    const remapped = buildAutoLineup(currentXI, formation);
    await playerRepo.replaceLineup(remapped.map((id, slot) => [slot, id]));
    set((s) => ({ club: s.club ? { ...s.club, formation } : s.club, lineup: remapped }));
  },

  setTactic: async (tactic) => {
    await metaRepo.setMeta('tactic', tactic);
    set((s) => ({ club: s.club ? { ...s.club, tactic } : s.club }));
  },

  setLineupSlot: async (slot, playerId) => {
    const lineup = [...get().lineup];
    // Spieler darf nur einmal aufgestellt sein: alten Slot freiräumen
    if (playerId !== null) {
      const existing = lineup.indexOf(playerId);
      if (existing >= 0 && existing !== slot) {
        lineup[existing] = null;
        await playerRepo.setLineupSlot(existing, null);
      }
    }
    lineup[slot] = playerId;
    await playerRepo.setLineupSlot(slot, playerId);
    set({ lineup });
  },

  autoLineup: async () => {
    const { players, club } = get();
    const lineup = buildAutoLineup(players, club?.formation ?? '4-4-2');
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));
    set({ lineup });
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
    set({
      packs: await packRepo.getPacks(),
      players: await playerRepo.getOwnedPlayers(),
    });
    return { entries, bonus };
  },

  /**
   * Die aufgedeckte ???-Karte benennen und aufnehmen (V3): 99er-Spieler mit
   * Wunschname und -position. Kommt IMMER in den Klub – auch über das
   * Kader-Limit hinaus, damit die einmalige Karte nie verloren geht.
   */
  claimMysteryPlayer: async (name, position) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const poolId = await playerRepo.insertPoolPlayerReturningId(
      createMysteryPoolPlayer(trimmed, position),
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

  /** Eigenen Spieler verkaufen (nicht möglich: aufgestellt, Captain oder ???-Karte). */
  sellPlayer: async (ownedId) => {
    const { players, lineup, captainPlayerId } = get();
    const player = players.find((p) => p.id === ownedId);
    if (!player || lineup.includes(ownedId) || ownedId === captainPlayerId) return false;
    if (player.pool.rarity === 'geheim') return false;
    await playerRepo.deleteOwnedPlayer(ownedId);
    await get().addCoins(SELL_VALUE[player.pool.rarity]);
    set({ players: await playerRepo.getOwnedPlayers() });
    return true;
  },

  lineupPlayers: () => {
    const { players, lineup } = get();
    return lineup.map((id) => players.find((p) => p.id === id) ?? null);
  },
}));

export { USER_CLUB_ID };
