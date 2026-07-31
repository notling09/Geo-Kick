import { create } from 'zustand';
import { pick } from '../core/engine/random';
import {
  markClaimed, passSnapshot, rewardForLevel, weekId,
  type PassReward, type PassSnapshot,
} from '../core/services/pass';
import { useGameStore } from './gameStore';

/**
 * Saisonpass-UI-Zustand (V7.7): hält den aktuellen Snapshot und holt
 * Belohnungen ab (Belohnung wird über den gameStore gutgeschrieben).
 */

interface PassStore {
  snapshot: PassSnapshot | null;
  refresh: () => Promise<void>;
  /** Belohnung eines erreichten, noch nicht abgeholten Levels holen. */
  claim: (level: number) => Promise<PassReward | null>;
}

async function grantReward(reward: PassReward): Promise<void> {
  const g = useGameStore.getState();
  switch (reward.kind) {
    case 'coins':
      await g.addCoins(reward.amount);
      break;
    case 'points':
      await g.addLevelPoints(reward.amount);
      break;
    case 'tokens':
      await g.addMarketTokens(reward.amount);
      break;
    case 'pack':
      for (let i = 0; i < reward.count; i++) await g.grantPack(`shop-${reward.pack}`);
      break;
    case 'player': {
      // Ein sehr guter Spieler: zufällig aus Legendär/Gold des Pools.
      const rarity = Math.random() < 0.5 ? 'legendaer' : 'gold';
      const candidates = g.pool.filter(
        (p) => p.rarity === rarity && !p.isStarterChoice,
      );
      if (candidates.length > 0) await g.receivePlayer(pick(candidates));
      break;
    }
  }
}

export const usePassStore = create<PassStore>((set, get) => ({
  snapshot: null,

  refresh: async () => {
    set({ snapshot: await passSnapshot() });
  },

  claim: async (level) => {
    const snap = get().snapshot ?? (await passSnapshot());
    const row = snap.rewards.find((r) => r.level === level);
    if (!row || !row.reached || row.claimed || !row.reward) return null;
    const reward = rewardForLevel(level, weekId());
    if (!reward) return null;
    await grantReward(reward);
    await markClaimed(level);
    await get().refresh();
    return reward;
  },
}));
