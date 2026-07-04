import * as Location from 'expo-location';
import { create } from 'zustand';
import { ANTI_CHEAT, BALANCING } from '../core/domain/constants';
import type { Session, Spot } from '../core/domain/types';
import { calculateReward } from '../core/engine/rewards';
import { distanceMeters } from '../core/services/geo';
import { startMotionTracking, stopMotionTracking } from '../core/services/motion';
import { fetchNearbyPitches } from '../core/services/overpass';
import * as metaRepo from '../core/db/repositories/metaRepo';
import * as sessionRepo from '../core/db/repositories/sessionRepo';
import * as spotRepo from '../core/db/repositories/spotRepo';
import { useGameStore } from './gameStore';

/**
 * Check-in/Check-out mit Anti-Cheat (Kapitel 6):
 * Geofencing (Check-in UND Check-out), Mock-Location-Erkennung,
 * Mindest-Verweildauer, Cooldown, Bewegungssensor (Kapitel 6.2).
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
  | {
      ok: false;
      reason: 'too_short' | 'no_session' | 'mocked' | 'left_pitch' | 'no_movement';
      durationMinutes?: number;
    };

interface SessionState {
  spots: Spot[];
  activeSession: Session | null;
  osmLoading: boolean;
  osmError: string | null;

  hydrate: () => Promise<void>;
  /** Liefert Anzahl geladener Plätze, -1 wenn wegen Drosselung übersprungen. */
  refreshOsmSpots: (
    latitude: number,
    longitude: number,
    options?: { force?: boolean },
  ) => Promise<number>;
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
    const activeSession = await sessionRepo.getActiveSession();
    // Alle anderen offenen Sessions sind verwaist (App-Kill/Reload) → schließen
    await sessionRepo.voidOrphanOpenSessions(activeSession?.id);
    // Läuft noch eine Session, Bewegungsmessung mit gespeicherten Werten fortsetzen
    if (activeSession) await startMotionTracking(false);
    set({
      spots: await spotRepo.getSpots(),
      activeSession,
    });
  },

  refreshOsmSpots: async (latitude, longitude, options) => {
    // Auto-Refresh drosseln: Overpass-Server sind gratis und rate-limitiert.
    // Nach Erfolg 15 Min Pause, nach Fehlschlag 2 Min (sonst 429-Spirale).
    // Manuelle Refreshes (force) gehen immer durch.
    if (!options?.force) {
      const lastSuccess = await metaRepo.getMetaNumber('lastOsmFetchAt', 0);
      const lastAttempt = await metaRepo.getMetaNumber('lastOsmAttemptAt', 0);
      const now = Date.now();
      if (now - lastSuccess < 15 * 60 * 1000 || now - lastAttempt < 2 * 60 * 1000) {
        return -1;
      }
    }
    await metaRepo.setMeta('lastOsmAttemptAt', String(Date.now()));
    set({ osmLoading: true, osmError: null });
    try {
      const fetched = await fetchNearbyPitches(latitude, longitude);
      await spotRepo.upsertOsmSpots(fetched);
      await metaRepo.setMeta('lastOsmFetchAt', String(Date.now()));
      set({ spots: await spotRepo.getSpots(), osmLoading: false });
      return fetched.length;
    } catch (e) {
      set({
        osmLoading: false,
        osmError:
          'Could not load pitches from OpenStreetMap right now. Tap the refresh button to retry, or add a pitch yourself by long-pressing the map.',
      });
      return 0;
    }
  },

  addUserSpot: async (name, latitude, longitude) => {
    await spotRepo.addUserSpot({
      id: `user-${Date.now()}`,
      name: name.trim() || 'My pitch',
      latitude,
      longitude,
      radius: BALANCING.defaultSpotRadius,
      source: 'user',
    });
    set({ spots: await spotRepo.getSpots() });
  },

  checkIn: async (spot) => {
    if (get().activeSession) return { ok: false, reason: 'active_session' };
    // Sicherheitsnetz: keine verwaisten offenen Sessions in der DB lassen
    await sessionRepo.voidOrphanOpenSessions();
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
    // Bewegungssensor-Messung für diese Session starten (Kapitel 6.2)
    await startMotionTracking(true);
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
    const motion = await stopMotionTracking();

    // Session in jedem Fall schließen – aber die Belohnung gibt es nur,
    // wenn alle Anti-Cheat-Prüfungen bestehen.
    const closeWithoutReward = async (): Promise<void> => {
      await sessionRepo.finishSession(session.id, now, 0, false);
      await sessionRepo.voidOrphanOpenSessions();
      set({ activeSession: null });
    };

    if (reward.coins === 0) {
      await closeWithoutReward();
      return { ok: false, reason: 'too_short', durationMinutes };
    }

    // Geofencing auch beim Check-out: Position muss noch am Platz sein
    const spot = get().spots.find((s) => s.id === session.spotId);
    const pos = await getVerifiedPosition();
    if (!pos.ok && pos.reason === 'mocked') {
      await closeWithoutReward();
      return { ok: false, reason: 'mocked', durationMinutes };
    }
    if (pos.ok && spot) {
      const dist = distanceMeters(pos.latitude, pos.longitude, spot.latitude, spot.longitude);
      if (dist > spot.radius * ANTI_CHEAT.checkoutRadiusFactor) {
        await closeWithoutReward();
        return { ok: false, reason: 'left_pitch', durationMinutes };
      }
    }
    // (kein GPS-Fix / keine Berechtigung: nicht bestrafen – Check-in war ja gültig)

    // Bewegungssensor (Kapitel 6.2): nur bestrafen, wenn genug Messzeit
    // vorliegt und sich das Gerät dabei praktisch nie bewegt hat
    if (
      motion.sampledMs >= ANTI_CHEAT.motionMinSampledMs &&
      motion.movedMs < ANTI_CHEAT.motionMinMovedMs
    ) {
      await closeWithoutReward();
      return { ok: false, reason: 'no_movement', durationMinutes };
    }

    await sessionRepo.finishSession(session.id, now, reward.coins, reward.pack);
    await sessionRepo.voidOrphanOpenSessions();
    set({ activeSession: null });

    // Cooldown erst nach belohnter Session starten (Kapitel 6.1)
    await spotRepo.setSpotCooldown(session.spotId, now + BALANCING.spotCooldownMs);
    const game = useGameStore.getState();
    await game.addCoins(reward.coins);
    if (reward.pack) await game.grantPack('session');
    set({ spots: await spotRepo.getSpots() });

    return { ok: true, coins: reward.coins, packGranted: reward.pack, durationMinutes };
  },
}));
