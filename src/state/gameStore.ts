import { create } from 'zustand';
import { BALANCING, FORMATIONS, USER_CLUB_ID } from '../core/domain/constants';
import type {
  Club, FormationId, OwnedPlayer, Pack, PoolPlayer, Tactic,
} from '../core/domain/types';
import { generateFillerSquad, generatePlayerPool, effectiveOverall } from '../core/engine/playerGen';
import { drawPackContent } from '../core/engine/packGen';
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
  openPack: (packId: number) => Promise<PoolPlayer[]>;
  buyPack: () => Promise<boolean>;
  trainPlayer: (targetId: number, duplicateId: number) => Promise<boolean>;
  lineupPlayers: () => Array<OwnedPlayer | null>;
}

async function loadClub(): Promise<Club> {
  return {
    name: (await metaRepo.getMeta('clubName')) ?? 'Mein Klub',
    crest: (await metaRepo.getMeta('crest')) ?? '⚽',
    division: await metaRepo.getMetaNumber('division', 4),
    coins: await metaRepo.getMetaNumber('coins', 0),
    formation: ((await metaRepo.getMeta('formation')) ?? '4-4-2') as FormationId,
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
    await metaRepo.setMeta('formation', formation);
    const { players } = get();
    const lineup = buildAutoLineup(players, formation);
    await playerRepo.replaceLineup(lineup.map((id, slot) => [slot, id]));
    set((s) => ({ club: s.club ? { ...s.club, formation } : s.club, lineup }));
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
    const { pool } = get();
    const drawn = drawPackContent(pool);
    await packRepo.markPackOpened(packId, drawn.map((p) => p.id));
    for (const p of drawn) {
      await playerRepo.addOwnedPlayer(p.id);
    }
    set({
      packs: await packRepo.getPacks(),
      players: await playerRepo.getOwnedPlayers(),
    });
    return drawn;
  },

  buyPack: async () => {
    const club = get().club;
    if (!club || club.coins < BALANCING.packShopPrice) return false;
    await get().addCoins(-BALANCING.packShopPrice);
    await get().grantPack('shop');
    return true;
  },

  trainPlayer: async (targetId, duplicateId) => {
    const { players, lineup } = get();
    const target = players.find((p) => p.id === targetId);
    const duplicate = players.find((p) => p.id === duplicateId);
    if (!target || !duplicate) return false;
    if (target.poolId !== duplicate.poolId) return false;
    if (target.level >= BALANCING.maxPlayerLevel) return false;

    await playerRepo.setPlayerLevel(targetId, target.level + 1);
    await playerRepo.deleteOwnedPlayer(duplicateId);
    const updatedLineup = lineup.map((id) => (id === duplicateId ? null : id));
    set({
      players: await playerRepo.getOwnedPlayers(),
      lineup: updatedLineup,
    });
    return true;
  },

  lineupPlayers: () => {
    const { players, lineup } = get();
    return lineup.map((id) => players.find((p) => p.id === id) ?? null);
  },
}));

export { USER_CLUB_ID };
