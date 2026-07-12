import { create } from 'zustand';
import { EGG_TYPES, type EggType } from '../core/domain/constants';
import { drawEggPlayer } from '../core/engine/packGen';
import { pickWeighted } from '../core/engine/random';
import { startEggTracking, stopEggTracking } from '../core/services/eggTracker';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore, type PackEntry } from './gameStore';

/**
 * Eier (V4): Nach einer belohnten Session bekommt man ein Ei – bis zu
 * MAX_EGGS gleichzeitig. Alle aktiven Eier brüten parallel durch dieselbe
 * echte Bewegung aus (GPS-Strecke, solange die App offen ist). Beim
 * Ausbrüten schlüpft je Ei ein Spieler mit den Quoten des Ei-Typs (1/3/5 km).
 */

export const MAX_EGGS = 3;

export interface ActiveEgg {
  typeId: string;
  targetMeters: number;
  progressMeters: number;
}

interface EggState {
  eggs: ActiveEgg[];

  hydrate: () => Promise<void>;
  /** Nach belohnter Session: Ei vergeben, falls Platz ist (max. 3). */
  grantEgg: () => Promise<EggType | null>;
  /** Ei ausbrüten, wenn seine Strecke voll ist; liefert den Spieler. */
  hatchEgg: (index: number) => Promise<PackEntry | null>;
  /** Tracking nachstarten (z. B. sobald die GPS-Berechtigung erteilt wurde). */
  ensureTracking: () => Promise<void>;
  eggTypeAt: (index: number) => EggType | null;
}

async function persistEggs(eggs: ActiveEgg[]): Promise<void> {
  await metaRepo.setMeta('activeEggs', JSON.stringify(eggs));
}

function hasUnfinished(eggs: ActiveEgg[]): boolean {
  return eggs.some((e) => e.progressMeters < e.targetMeters);
}

/** Fortschritt gesammelt schreiben (Meta nur alle ~50 m). */
let unsavedMeters = 0;

function onMeters(meters: number): void {
  const { eggs } = useEggStore.getState();
  if (!hasUnfinished(eggs)) return;
  // Dieselbe Strecke zählt für ALLE aktiven Eier gleichzeitig
  const updated = eggs.map((egg) =>
    egg.progressMeters >= egg.targetMeters
      ? egg
      : { ...egg, progressMeters: Math.min(egg.targetMeters, egg.progressMeters + meters) },
  );
  useEggStore.setState({ eggs: updated });
  unsavedMeters += meters;
  if (unsavedMeters >= 50 || !hasUnfinished(updated)) {
    unsavedMeters = 0;
    void persistEggs(updated);
  }
}

export const useEggStore = create<EggState>((set, get) => ({
  eggs: [],

  hydrate: async () => {
    let eggs: ActiveEgg[] = [];
    const raw = await metaRepo.getMeta('activeEggs');
    if (raw) {
      try {
        eggs = JSON.parse(raw) as ActiveEgg[];
      } catch {
        eggs = [];
      }
    } else {
      // Migration: früher gab es genau ein Ei (meta 'activeEgg')
      const legacy = await metaRepo.getMeta('activeEgg');
      if (legacy) {
        try {
          eggs = [JSON.parse(legacy) as ActiveEgg];
        } catch {
          eggs = [];
        }
        await metaRepo.setMeta('activeEgg', '');
      }
    }
    // Ei-Typen validieren (Distanzen 1/3/5 km): Unbekanntes verwerfen,
    // Ziele an die aktuelle km-Zahl angleichen
    eggs = eggs
      .filter((egg) => EGG_TYPES.some((t) => t.id === egg.typeId))
      .slice(0, MAX_EGGS)
      .map((egg) => {
        const type = EGG_TYPES.find((t) => t.id === egg.typeId)!;
        return egg.targetMeters === type.km * 1000
          ? egg
          : { ...egg, targetMeters: type.km * 1000 };
      });
    await persistEggs(eggs);
    set({ eggs });
    if (hasUnfinished(eggs)) await startEggTracking(onMeters);
  },

  grantEgg: async () => {
    const eggs = get().eggs;
    if (eggs.length >= MAX_EGGS) return null;
    const type = pickWeighted(EGG_TYPES.map((t) => ({ value: t, weight: t.weight })));
    const updated = [
      ...eggs,
      { typeId: type.id, targetMeters: type.km * 1000, progressMeters: 0 },
    ];
    await persistEggs(updated);
    set({ eggs: updated });
    await startEggTracking(onMeters);
    return type;
  },

  hatchEgg: async (index) => {
    const eggs = get().eggs;
    const egg = eggs[index];
    const type = get().eggTypeAt(index);
    if (!egg || !type || egg.progressMeters < egg.targetMeters) return null;
    const pool = useGameStore.getState().pool;
    if (pool.length === 0) return null;
    const drawn = drawEggPlayer(pool, type);
    const entry = await useGameStore.getState().receivePlayer(drawn);
    const updated = eggs.filter((_, i) => i !== index);
    await persistEggs(updated);
    set({ eggs: updated });
    if (!hasUnfinished(updated)) stopEggTracking();
    return entry;
  },

  ensureTracking: async () => {
    if (hasUnfinished(get().eggs)) {
      await startEggTracking(onMeters);
    }
  },

  eggTypeAt: (index) => {
    const egg = get().eggs[index];
    return egg ? EGG_TYPES.find((t) => t.id === egg.typeId) ?? null : null;
  },
}));
