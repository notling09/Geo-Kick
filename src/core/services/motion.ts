import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Bewegungssensor-Anti-Cheat (Kapitel 6.2): Während einer aktiven Session
 * misst der Beschleunigungssensor, ob sich das Gerät überhaupt bewegt.
 * Ein Handy, das die komplette Session regungslos auf dem Tisch liegt,
 * bekommt keine Belohnung.
 *
 * Grenzen (bewusst, MVP): Sensor-Events kommen nur, solange die App im
 * Vordergrund läuft. Deshalb wird nur bestraft, wenn genug Messzeit
 * zusammenkam UND dabei praktisch keine Bewegung stattfand – wer die App
 * während des Kickens zulässt, wird nie fälschlich bestraft.
 */

const SAMPLE_INTERVAL_MS = 500;
/** Abweichung der Gesamtbeschleunigung von 1 g, ab der ein Sample als "bewegt" gilt */
const MOVEMENT_THRESHOLD_G = 0.06;

const META_MOVED = 'sessionMovedMs';
const META_SAMPLED = 'sessionSampledMs';

let subscription: EventSubscription | null = null;
let movedMs = 0;
let sampledMs = 0;
let lastPersist = 0;

function onSample({ x, y, z }: AccelerometerMeasurement): void {
  // Betrag der Beschleunigung in g; in Ruhe ~1 (Erdanziehung)
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  sampledMs += SAMPLE_INTERVAL_MS;
  if (Math.abs(magnitude - 1) > MOVEMENT_THRESHOLD_G) {
    movedMs += SAMPLE_INTERVAL_MS;
  }
  // Zwischenstände sichern, damit App-Neustarts die Messung nicht verlieren
  if (Date.now() - lastPersist > 10000) {
    lastPersist = Date.now();
    void metaRepo.setMeta(META_MOVED, String(movedMs));
    void metaRepo.setMeta(META_SAMPLED, String(sampledMs));
  }
}

/** Beim Check-in aufrufen: Zähler zurücksetzen und Messung starten. */
export async function startMotionTracking(reset: boolean): Promise<void> {
  if (reset) {
    movedMs = 0;
    sampledMs = 0;
    await metaRepo.setMeta(META_MOVED, '0');
    await metaRepo.setMeta(META_SAMPLED, '0');
  } else {
    // App-Neustart während laufender Session: gespeicherte Werte übernehmen
    movedMs = await metaRepo.getMetaNumber(META_MOVED, 0);
    sampledMs = await metaRepo.getMetaNumber(META_SAMPLED, 0);
  }
  if (subscription) return;
  const available = await Accelerometer.isAvailableAsync().catch(() => false);
  if (!available) return; // kein Sensor -> Anti-Cheat-Stufe entfällt
  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
  subscription = Accelerometer.addListener(onSample);
}

export interface MotionSummary {
  movedMs: number;
  sampledMs: number;
}

/** Beim Check-out aufrufen: Messung stoppen und Ergebnis liefern. */
export async function stopMotionTracking(): Promise<MotionSummary> {
  subscription?.remove();
  subscription = null;
  const summary = { movedMs, sampledMs };
  await metaRepo.setMeta(META_MOVED, '0');
  await metaRepo.setMeta(META_SAMPLED, '0');
  movedMs = 0;
  sampledMs = 0;
  return summary;
}
