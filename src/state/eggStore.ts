import { create } from 'zustand';
import { EGG_TYPES, type EggType } from '../core/domain/constants';
import { drawEggPlayer } from '../core/engine/packGen';
import { pickWeighted } from '../core/engine/random';
import { startEggTracking, stopEggTracking } from '../core/services/eggTracker';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore, type PackEntry } from './gameStore';

/**
 * Eier (V4): Nach einer belohnten Session bekommt man ein Ei (wenn keins
 * aktiv ist). Es brütet durch echte Bewegung aus – die GPS-Strecke zählt,
 * solange die App offen ist. Beim Ausbrüten schlüpft ein Spieler mit den
 * Quoten des Ei-Typs (2/5/10 km).
 */

export interface ActiveEgg {
  typeId: string;
  targetMeters: number;
  progressMeters: number;
}

interface EggState {
  egg: ActiveEgg | null;

  hydrate: () => Promise<void>;
  /** Nach belohnter Session: Ei vergeben, falls keins aktiv (true = neues Ei). */
  grantEggIfNone: () => Promise<EggType | null>;
  /** Ausbrüten, wenn die Strecke voll ist; liefert den geschlüpften Spieler. */
  hatchEgg: () => Promise<PackEntry | null>;
  /** Tracking nachstarten (z. B. sobald die GPS-Berechtigung erteilt wurde). */
  ensureTracking: () => Promise<void>;
  eggType: () => EggType | null;
  ready: () => boolean;
}

async function persistEgg(egg: ActiveEgg | null): Promise<void> {
  await metaRepo.setMeta('activeEgg', egg ? JSON.stringify(egg) : '');
}

/** Fortschritt gesammelt in den Store schreiben (Meta nur alle ~50 m). */
let unsavedMeters = 0;

function onMeters(meters: number): void {
  const state = useEggStore.getState();
  const egg = state.egg;
  if (!egg || egg.progressMeters >= egg.targetMeters) return;
  const updated = {
    ...egg,
    progressMeters: Math.min(egg.targetMeters, egg.progressMeters + meters),
  };
  useEggStore.setState({ egg: updated });
  unsavedMeters += meters;
  if (unsavedMeters >= 50 || updated.progressMeters >= updated.targetMeters) {
    unsavedMeters = 0;
    void persistEgg(updated);
  }
}

export const useEggStore = create<EggState>((set, get) => ({
  egg: null,

  hydrate: async () => {
    const raw = await metaRepo.getMeta('activeEgg');
    let egg: ActiveEgg | null = null;
    if (raw) {
      try {
        egg = JSON.parse(raw) as ActiveEgg;
      } catch {
        egg = null;
      }
    }
    set({ egg });
    if (egg && egg.progressMeters < egg.targetMeters) {
      await startEggTracking(onMeters);
    }
  },

  grantEggIfNone: async () => {
    if (get().egg) return null;
    const type = pickWeighted(EGG_TYPES.map((t) => ({ value: t, weight: t.weight })));
    const egg: ActiveEgg = {
      typeId: type.id,
      targetMeters: type.km * 1000,
      progressMeters: 0,
    };
    await persistEgg(egg);
    set({ egg });
    await startEggTracking(onMeters);
    return type;
  },

  hatchEgg: async () => {
    const egg = get().egg;
    const type = get().eggType();
    if (!egg || !type || egg.progressMeters < egg.targetMeters) return null;
    const pool = useGameStore.getState().pool;
    if (pool.length === 0) return null;
    const drawn = drawEggPlayer(pool, type);
    const entry = await useGameStore.getState().receivePlayer(drawn);
    await persistEgg(null);
    set({ egg: null });
    stopEggTracking();
    return entry;
  },

  ensureTracking: async () => {
    const egg = get().egg;
    if (egg && egg.progressMeters < egg.targetMeters) {
      await startEggTracking(onMeters);
    }
  },

  eggType: () => {
    const egg = get().egg;
    return egg ? EGG_TYPES.find((t) => t.id === egg.typeId) ?? null : null;
  },

  ready: () => {
    const egg = get().egg;
    return !!egg && egg.progressMeters >= egg.targetMeters;
  },
}));
