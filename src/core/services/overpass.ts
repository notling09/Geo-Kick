import { BALANCING } from '../domain/constants';
import type { Spot } from '../domain/types';

/**
 * Lädt Fußball-/Bolzplätze aus OpenStreetMap über die Overpass-API
 * (Kapitel 3.1: "aus offenen Kartendaten, z. B. OpenStreetMap").
 * Ergebnisse werden in SQLite gecacht, damit die App offline nutzbar bleibt.
 * Attribution: © OpenStreetMap-Mitwirkende (ODbL), siehe Profil-Screen.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 5000;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchNearbyPitches(
  latitude: number,
  longitude: number,
): Promise<Array<Omit<Spot, 'cooldownUntil'>>> {
  const query = `
    [out:json][timeout:20];
    (
      nwr["leisure"="pitch"]["sport"="soccer"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
      nwr["leisure"="pitch"]["sport"="multi"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
    );
    out center 60;
  `;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass-Fehler: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { elements?: OverpassElement[] };
  const spots: Array<Omit<Spot, 'cooldownUntil'>> = [];
  (json.elements ?? []).forEach((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) return;
    spots.push({
      id: `osm-${el.type}-${el.id}`,
      name: el.tags?.name ?? 'Fußballplatz',
      latitude: lat,
      longitude: lon,
      radius: BALANCING.defaultSpotRadius,
      source: 'osm',
    });
  });
  return spots;
}
