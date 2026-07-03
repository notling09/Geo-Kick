import { create } from 'zustand';
import {
  BALANCING, FORMATIONS, PACK_TYPES, SELL_VALUE, USER_CLUB_ID, type PackTypeId,
} from '../core/domain/constants';
import type {
  Club, FormationId, OwnedPlayer, Pack, PoolPlayer, Tactic,
} from '../core/domain/types';
import { generateFillerSquad, generatePlayerPool, effectiveOverall } from '../core/engine/playerGen';
import { GOLD_PLAYERS, LEGENDARY_PLAYERS, STARTER_WINGERS } from '../core/engine/names';
import { drawPackContent, packTypeFromSource } from '../core/engine/packGen';
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

  init: () => Promise<void>;
  completeOnboarding: (clubName: string, crest: string, starterPoolId: number) => Promise<void>;
  setFormation: (formation: FormationId) => Promise<void>;
  setTactic: (tactic: Tactic) => Promise<void>;
  setLineupSlot: (slot: number, playerId: number | null) => Promise<void>;
  autoLineup: () => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  grantPack: (source: Pack['source']) => Promise<void>;
  openPack: (packId: number) => Promise<PackEntry[]>;
  buyPack: (typeId: PackTypeId) => Promise<boolean>;
  sellDrawnPlayer: (poolPlayer: PoolPlayer) => Promise<void>;
  keepDrawnPlayer: (poolPlayer: PoolPlayer, sellOwnedId: number) => Promise<boolean>;
  sellPlayer: (ownedId: number) => Promise<boolean>;
  lineupPlayers: () => Array<OwnedPlayer | null>;
}

/** Ergebnis eines Pack-Zugs pro gezogenem Spieler. */
export interface PackEntry {
  pool: PoolPlayer;
  /** added = aufgenommen, duplicate = automatisch verkauft, pending = Kader voll */
  outcome: 'added' | 'duplicate' | 'pending';
  coins?: number;
}

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

  init: async () => {
    // Spieler-Pool einmalig erzeugen (fiktive Identitäten, Kapitel 8/9)
    const seeded = await metaRepo.getMeta('poolSeeded');
    if (!seeded) {
      await playerRepo.insertPoolPlayers(generatePlayerPool());
      await metaRepo.setMeta('poolSeeded', '1');
    } else {
      // Bestehende Installationen: Starter-Namen an die aktuelle Liste angleichen
      await playerRepo.syncStarterNames(STARTER_WINGERS.map((s) => s.name));
      // … und Gold/Legendär auf die kuratierten Star-Identitäten migrieren
      await playerRepo.syncCuratedRarity('gold', GOLD_PLAYERS);
      await playerRepo.syncCuratedRarity('legendaer', LEGENDARY_PLAYERS);
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
      set({
        initialized: true,
        onboarded,
        club,
        players,
        lineup: lineupArray(lineupMap),
        packs,
        pool,
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

  grantPack: async (source) => {
    await packRepo.addPack(source);
    set({ packs: await packRepo.getPacks() });
  },

  openPack: async (packId) => {
    const { pool, packs } = get();
    const pack = packs.find((p) => p.id === packId);
    const packType = packTypeFromSource(pack?.source ?? 'session');
    const drawn = drawPackContent(pool, packType);
    await packRepo.markPackOpened(packId, drawn.map((p) => p.id));

    // Duplikate werden automatisch verkauft, neue Spieler bis zum Kader-Limit
    // aufgenommen; darüber hinaus entscheidet der Nutzer (pending).
    const entries: PackEntry[] = [];
    let coinsGained = 0;
    for (const p of drawn) {
      const players = await playerRepo.getOwnedPlayers();
      const isDuplicate =
        players.some((o) => o.poolId === p.id) || entries.some((e) => e.pool.id === p.id);
      if (isDuplicate) {
        coinsGained += SELL_VALUE[p.rarity];
        entries.push({ pool: p, outcome: 'duplicate', coins: SELL_VALUE[p.rarity] });
      } else if (players.length < BALANCING.maxSquadSize) {
        await playerRepo.addOwnedPlayer(p.id);
        entries.push({ pool: p, outcome: 'added' });
      } else {
        entries.push({ pool: p, outcome: 'pending' });
      }
    }
    if (coinsGained > 0) await get().addCoins(coinsGained);
    set({
      packs: await packRepo.getPacks(),
      players: await playerRepo.getOwnedPlayers(),
    });
    return entries;
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
    const { players, lineup } = get();
    const victim = players.find((p) => p.id === sellOwnedId);
    if (!victim || lineup.includes(sellOwnedId)) return false;
    await playerRepo.deleteOwnedPlayer(sellOwnedId);
    await get().addCoins(SELL_VALUE[victim.pool.rarity]);
    await playerRepo.addOwnedPlayer(poolPlayer.id);
    set({ players: await playerRepo.getOwnedPlayers() });
    return true;
  },

  /** Eigenen Spieler verkaufen (nicht möglich, solange er aufgestellt ist). */
  sellPlayer: async (ownedId) => {
    const { players, lineup } = get();
    const player = players.find((p) => p.id === ownedId);
    if (!player || lineup.includes(ownedId)) return false;
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
