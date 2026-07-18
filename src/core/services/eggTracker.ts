import * as Location from 'expo-location';
import { distanceMeters } from './geo';

/**
 * Strecken-Messung für das Ei-Ausbrüten (V4): solange die App offen ist,
 * wird die zurückgelegte GPS-Strecke aufsummiert (kein Hintergrund-Tracking,
 * kein Server). V6.4: Auto/Bahn zählen ausdrücklich mit (Nutzerwunsch,
 * wie bei vergleichbaren Geo-Spielen) – verworfen werden nur noch:
 *  - schlechte GPS-Genauigkeit (> 60 m)
 *  - Teleport-Sprünge (Einzelsegment über 1 km, ~360 km/h bei 10-s-Takt)
 *  - simulierte Positionen (Mock-GPS)
 */

const MAX_ACCURACY_M = 60;
const MAX_SEGMENT_M = 1000;

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
        if (meters > 0 && meters <= MAX_SEGMENT_M) {
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
