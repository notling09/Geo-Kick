import * as Location from 'expo-location';
import { create } from 'zustand';
import { BALANCING } from '../core/domain/constants';
import type { Session, Spot } from '../core/domain/types';
import { calculateReward } from '../core/engine/rewards';
import { distanceMeters } from '../core/services/geo';
import { fetchNearbyPitches } from '../core/services/overpass';
import * as sessionRepo from '../core/db/repositories/sessionRepo';
import * as spotRepo from '../core/db/repositories/spotRepo';
import { useGameStore } from './gameStore';

/**
 * Check-in/Check-out mit Anti-Cheat (Kapitel 6):
 * Geofencing, Mock-Location-Erkennung, Mindest-Verweildauer, Cooldown.
 */

export type CheckInResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'permission' | 'mocked' | 'too_far' | 'cooldown' | 'active_session' | 'no_location';
      detail?: string;
    };

export type CheckOutResult =
  | { ok: true; coins: number; packGranted: boolean; durationMinutes: number }
  | { ok: false; reason: 'too_short' | 'no_session'; durationMinutes?: number };

interface SessionState {
  spots: Spot[];
  activeSession: Session | null;
  osmLoading: boolean;
  osmError: string | null;

  hydrate: () => Promise<void>;
  refreshOsmSpots: (latitude: number, longitude: number) => Promise<number>;
  addUserSpot: (name: string, latitude: number, longitude: number) => Promise<void>;
  checkIn: (spot: Spot) => Promise<CheckInResult>;
  checkOut: () => Promise<CheckOutResult>;
}

async function getVerifiedPosition(): Promise<
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: 'permission' | 'mocked' | 'no_location' }
> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, reason: 'permission' };
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    // Anti-Cheat: von Android als simuliert markierte Positionen blockieren
    if (pos.mocked) return { ok: false, reason: 'mocked' };
    return { ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { ok: false, reason: 'no_location' };
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  spots: [],
  activeSession: null,
  osmLoading: false,
  osmError: null,

  hydrate: async () => {
    set({
      spots: await spotRepo.getSpots(),
      activeSession: await sessionRepo.getActiveSession(),
    });
  },

  refreshOsmSpots: async (latitude, longitude) => {
    set({ osmLoading: true, osmError: null });
    try {
      const fetched = await fetchNearbyPitches(latitude, longitude);
      await spotRepo.upsertOsmSpots(fetched);
      set({ spots: await spotRepo.getSpots(), osmLoading: false });
      return fetched.length;
    } catch (e) {
      set({
        osmLoading: false,
        osmError: 'Plätze konnten nicht geladen werden (offline?). Gecachte Plätze werden angezeigt.',
      });
      return 0;
    }
  },

  addUserSpot: async (name, latitude, longitude) => {
    await spotRepo.addUserSpot({
      id: `user-${Date.now()}`,
      name: name.trim() || 'Eigener Platz',
      latitude,
      longitude,
      radius: BALANCING.defaultSpotRadius,
      source: 'user',
    });
    set({ spots: await spotRepo.getSpots() });
  },

  checkIn: async (spot) => {
    if (get().activeSession) return { ok: false, reason: 'active_session' };
    if (spot.cooldownUntil > Date.now()) {
      const mins = Math.ceil((spot.cooldownUntil - Date.now()) / 60000);
      return { ok: false, reason: 'cooldown', detail: `${mins} Min.` };
    }
    const pos = await getVerifiedPosition();
    if (!pos.ok) return { ok: false, reason: pos.reason };
    // Geofencing: Position muss im Platz-Radius liegen
    const dist = distanceMeters(pos.latitude, pos.longitude, spot.latitude, spot.longitude);
    if (dist > spot.radius) {
      return { ok: false, reason: 'too_far', detail: `${Math.round(dist)} m entfernt` };
    }
    const id = await sessionRepo.startSession(spot.id, Date.now());
    set({
      activeSession: {
        id,
        spotId: spot.id,
        startTime: Date.now(),
        endTime: null,
        coins: 0,
        packGranted: false,
      },
    });
    return { ok: true };
  },

  checkOut: async () => {
    const session = get().activeSession;
    if (!session) return { ok: false, reason: 'no_session' };
    const now = Date.now();
    const duration = now - session.startTime;
    const reward = calculateReward(duration);
    const durationMinutes = Math.floor(duration / 60000);

    await sessionRepo.finishSession(session.id, now, reward.coins, reward.pack);
    set({ activeSession: null });

    if (reward.coins === 0) {
      return { ok: false, reason: 'too_short', durationMinutes };
    }

    // Cooldown erst nach belohnter Session starten (Kapitel 6.1)
    await spotRepo.setSpotCooldown(session.spotId, now + BALANCING.spotCooldownMs);
    const game = useGameStore.getState();
    await game.addCoins(reward.coins);
    if (reward.pack) await game.grantPack('session');
    set({ spots: await spotRepo.getSpots() });

    return { ok: true, coins: reward.coins, packGranted: reward.pack, durationMinutes };
  },
}));
