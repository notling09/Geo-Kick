import * as Location from 'expo-location';
import { distanceMeters } from './geo';

/**
 * Strecken-Messung für das Ei-Ausbrüten (V4): solange die App offen ist,
 * wird die zurückgelegte GPS-Strecke aufsummiert (kein Hintergrund-Tracking,
 * kein Server). Unplausible Sprünge werden verworfen:
 *  - schlechte GPS-Genauigkeit (> 60 m)
 *  - Segmente schneller als ~25 km/h (Auto/Bahn/GPS-Sprung)
 *  - Einzelsegmente über 300 m (Teleport)
 */

const MAX_ACCURACY_M = 60;
const MAX_SPEED_KMH = 25;
const MAX_SEGMENT_M = 300;

let subscription: Location.LocationSubscription | null = null;
let last: { lat: number; lon: number; time: number } | null = null;

export async function startEggTracking(onMeters: (meters: number) => void): Promise<void> {
  if (subscription) return;
  // Nur starten, wenn die Berechtigung schon erteilt wurde (die Karte fragt
  // sie ohnehin ab) – hier nie einen eigenen Dialog auslösen.
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return;
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 25,
    },
    (pos) => {
      if (pos.mocked) return;
      if ((pos.coords.accuracy ?? 999) > MAX_ACCURACY_M) return;
      const current = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        time: pos.timestamp,
      };
      if (last) {
        const meters = distanceMeters(last.lat, last.lon, current.lat, current.lon);
        const seconds = Math.max(1, (current.time - last.time) / 1000);
        const kmh = (meters / seconds) * 3.6;
        if (meters > 0 && meters <= MAX_SEGMENT_M && kmh <= MAX_SPEED_KMH) {
          onMeters(meters);
        }
      }
      last = current;
    },
  );
}

export function stopEggTracking(): void {
  subscription?.remove();
  subscription = null;
  last = null;
}
