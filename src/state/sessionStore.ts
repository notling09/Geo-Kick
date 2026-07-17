import * as Location from 'expo-location';
import { create } from 'zustand';
import {
  ANTI_CHEAT, BALANCING, DISCOVERY, FITNESS_BONUS_COINS, fitnessObjectives,
  OBJECTIVE_BONUS_COINS, skillObjectives, SKILL_OBJECTIVES_PER_SESSION,
} from '../core/domain/constants';
import type { Session, Spot } from '../core/domain/types';
import { t } from '../core/i18n';
import { dayKey } from '../core/engine/pitchBattle';
import { shuffle } from '../core/engine/random';
import { calculateReward } from '../core/engine/rewards';
import { distanceMeters } from '../core/services/geo';
import { startMotionTracking, stopMotionTracking } from '../core/services/motion';
import { fetchNearbyPitches } from '../core/services/overpass';
import * as metaRepo from '../core/db/repositories/metaRepo';
import * as sessionRepo from '../core/db/repositories/sessionRepo';
import * as spotRepo from '../core/db/repositories/spotRepo';
import { useEggStore } from './eggStore';
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
  | {
      ok: true;
      coins: number;
      /** darin enthaltener Bonus aus abgehakten Session-Aufgaben */
      objectiveBonus: number;
      packGranted: boolean;
      durationMinutes: number;
      /** V4: Erstbesuch-Bonus (Platz-Pass), 0 wenn Platz schon bekannt */
      firstVisitBonus: number;
      /** V4: Bonus am eigenen Heimplatz */
      homeBonus: number;
      /** V4: aktuelle tägliche Serie + Bonus (0, wenn heute schon gezählt) */
      streak: number;
      streakBonus: number;
      /** V4: Session am besonderen Platz des Tages → Basis-Coins verdoppelt */
      doubled: boolean;
      /** V4: Label des neu erhaltenen Eis (null = schon eins aktiv) */
      eggLabel: string | null;
    }
  | {
      ok: false;
      reason: 'too_short' | 'no_session' | 'mocked' | 'left_pitch' | 'no_movement';
      durationMinutes?: number;
    };

export interface SessionObjective {
  text: string;
  done: boolean;
  /** skill = Ehrensystem (abhakbar), sonst sensorverifizierte Fitness-Aufgabe */
  kind: 'skill' | 'activeMs' | 'sprints';
  /** Zielwert der Fitness-Aufgabe (ms bzw. Sprint-Anzahl) */
  target: number;
  bonus: number;
}

interface SessionState {
  spots: Spot[];
  activeSession: Session | null;
  /** 3 zufällige Mini-Aufgaben der laufenden Session (Ehrensystem) */
  objectives: SessionObjective[];
  osmLoading: boolean;
  osmError: string | null;
  /** V4: Platz mit den meisten Besuchen ('' = noch keiner qualifiziert) */
  homeSpotId: string;

  hydrate: () => Promise<void>;
  toggleObjective: (index: number) => Promise<void>;
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

async function loadObjectives(): Promise<SessionObjective[]> {
  const raw = await metaRepo.getMeta('sessionObjectives');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<SessionObjective>>;
    // Ältere Spielstände kennen kind/target/bonus noch nicht
    return parsed.map((o) => ({
      text: o.text ?? '',
      done: o.done ?? false,
      kind: o.kind ?? 'skill',
      target: o.target ?? 0,
      bonus: o.bonus ?? OBJECTIVE_BONUS_COINS,
    }));
  } catch {
    return [];
  }
}

/**
 * Heimplatz (V4) neu bestimmen: der Platz mit den meisten Besuchen (ab
 * DISCOVERY.homeMinVisits); bei Gleichstand der zuletzt besuchte.
 */
async function recomputeHomeSpot(): Promise<string> {
  const visited = await sessionRepo.getVisitedSpots();
  const top = visited
    .filter((v) => v.visits >= DISCOVERY.homeMinVisits)
    .sort((a, b) => b.visits - a.visits || b.lastVisit - a.lastVisit)[0];
  const homeSpotId = top?.spotId ?? '';
  await metaRepo.setMeta('homeSpotId', homeSpotId);
  return homeSpotId;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  spots: [],
  activeSession: null,
  objectives: [],
  osmLoading: false,
  osmError: null,
  homeSpotId: '',

  hydrate: async () => {
    // V5-Migration: Check-in-Radius aller gespeicherten Plätze auf 100 m anheben
    if ((await metaRepo.getMeta('radius100')) !== '1') {
      await spotRepo.raiseMinRadius(BALANCING.defaultSpotRadius);
      await metaRepo.setMeta('radius100', '1');
    }
    const activeSession = await sessionRepo.getActiveSession();
    // Alle anderen offenen Sessions sind verwaist (App-Kill/Reload) → schließen
    await sessionRepo.voidOrphanOpenSessions(activeSession?.id);
    // Läuft noch eine Session, Bewegungsmessung mit gespeicherten Werten fortsetzen
    if (activeSession) await startMotionTracking(false);
    set({
      spots: await spotRepo.getSpots(),
      activeSession,
      objectives: activeSession ? await loadObjectives() : [],
      homeSpotId: (await metaRepo.getMeta('homeSpotId')) ?? '',
    });
  },

  toggleObjective: async (index) => {
    const objectives = get().objectives.map((o, i) =>
      // Fitness-Aufgaben werden vom Sensor bewertet, nicht per Hand
      i === index && o.kind === 'skill' ? { ...o, done: !o.done } : o,
    );
    await metaRepo.setMeta('sessionObjectives', JSON.stringify(objectives));
    set({ objectives });
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
        osmError: t('mapOsmError'),
      });
      return 0;
    }
  },

  addUserSpot: async (name, latitude, longitude) => {
    await spotRepo.addUserSpot({
      id: `user-${Date.now()}`,
      name: name.trim() || t('mapMyPitch'),
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
      return { ok: false, reason: 'cooldown', detail: `${mins} min` };
    }
    const pos = await getVerifiedPosition();
    if (!pos.ok) return { ok: false, reason: pos.reason };
    // Geofencing: Position muss im Platz-Radius liegen
    const dist = distanceMeters(pos.latitude, pos.longitude, spot.latitude, spot.longitude);
    if (dist > spot.radius) {
      return { ok: false, reason: 'too_far', detail: `${Math.round(dist)} m` };
    }
    const id = await sessionRepo.startSession(spot.id, Date.now());
    // Bewegungssensor-Messung für diese Session starten (Kapitel 6.2)
    await startMotionTracking(true);
    // 2 Skill-Aufgaben (Ehrensystem) + 1 sensorverifizierte Fitness-Aufgabe
    const fitness = shuffle(fitnessObjectives())[0];
    const objectives: SessionObjective[] = [
      ...shuffle(skillObjectives())
        .slice(0, SKILL_OBJECTIVES_PER_SESSION)
        .map((text) => ({
          text,
          done: false,
          kind: 'skill' as const,
          target: 0,
          bonus: OBJECTIVE_BONUS_COINS,
        })),
      {
        text: fitness.text,
        done: false,
        kind: fitness.kind,
        target: fitness.target,
        bonus: FITNESS_BONUS_COINS,
      },
    ];
    await metaRepo.setMeta('sessionObjectives', JSON.stringify(objectives));
    set({
      activeSession: {
        id,
        spotId: spot.id,
        startTime: Date.now(),
        endTime: null,
        coins: 0,
        packGranted: false,
      },
      objectives,
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
      await metaRepo.setMeta('sessionObjectives', '');
      set({ activeSession: null, objectives: [] });
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

    // Bonus: abgehakte Skill-Aufgaben (Ehrensystem) + Fitness-Aufgabe,
    // die der Bewegungssensor automatisch bewertet
    const objectiveBonus = get().objectives.reduce((sum, o) => {
      if (o.kind === 'skill') return o.done ? sum + o.bonus : sum;
      const achieved =
        o.kind === 'activeMs' ? motion.movedMs >= o.target : motion.sprints >= o.target;
      return achieved ? sum + o.bonus : sum;
    }, 0);

    // V4/V5: Session am Gold-Platz des Tages → Basis-Coins verdoppelt.
    // Der Gold-Platz wird von der Karte im Umkreis bestimmt und gespeichert.
    let doubled = false;
    try {
      const stored = JSON.parse((await metaRepo.getMeta('specialSpot')) || 'null') as
        | { day: string; spotId: string }
        | null;
      doubled = !!stored && stored.day === dayKey() && stored.spotId === session.spotId;
    } catch {
      doubled = false;
    }
    const baseCoins = reward.coins * (doubled ? DISCOVERY.specialDoubleFactor : 1);

    // V4 Platz-Pass: erste belohnte Session an einem neuen Platz
    const priorVisits = await sessionRepo.countRewardedSessionsAt(session.spotId);
    const firstVisitBonus = priorVisits === 0 ? DISCOVERY.firstVisitBonusCoins : 0;

    // V4 Heimplatz: kleiner Bonus für Sessions am eigenen Heimstadion
    const homeBonus =
      get().homeSpotId !== '' && get().homeSpotId === session.spotId
        ? DISCOVERY.homeBonusCoins
        : 0;

    // V4 Tägliche Serie: die erste belohnte Session des Tages zählt
    const today = dayKey();
    const lastDay = await metaRepo.getMeta('streakDay');
    let streak = await metaRepo.getMetaNumber('streakCount', 0);
    let streakBonus = 0;
    if (lastDay !== today) {
      const yesterday = dayKey(new Date(Date.now() - 86400000));
      streak = lastDay === yesterday ? streak + 1 : 1;
      await metaRepo.setMeta('streakDay', today);
      await metaRepo.setMeta('streakCount', String(streak));
      const best = await metaRepo.getMetaNumber('bestStreak', 0);
      if (streak > best) await metaRepo.setMeta('bestStreak', String(streak));
      streakBonus = Math.min(streak * DISCOVERY.streakBonusPerDay, DISCOVERY.streakBonusMax);
    }

    const totalCoins = baseCoins + objectiveBonus + firstVisitBonus + homeBonus + streakBonus;

    await sessionRepo.finishSession(session.id, now, totalCoins, reward.pack);
    await sessionRepo.voidOrphanOpenSessions();
    await metaRepo.setMeta('sessionObjectives', '');
    set({ activeSession: null, objectives: [] });

    // Cooldown erst nach belohnter Session starten (Kapitel 6.1)
    await spotRepo.setSpotCooldown(session.spotId, now + BALANCING.spotCooldownMs);
    const game = useGameStore.getState();
    await game.addCoins(totalCoins);
    if (reward.pack) await game.grantPack('session');

    // V4: Heimplatz neu bestimmen und ggf. ein neues Ei vergeben (max. 3)
    const homeSpotId = await recomputeHomeSpot();
    const eggType = await useEggStore.getState().grantEgg();
    set({ spots: await spotRepo.getSpots(), homeSpotId });

    return {
      ok: true,
      coins: totalCoins,
      objectiveBonus,
      packGranted: reward.pack,
      durationMinutes,
      firstVisitBonus,
      homeBonus,
      streak,
      streakBonus,
      doubled,
      eggLabel: eggType?.label ?? null,
    };
  },
}));
