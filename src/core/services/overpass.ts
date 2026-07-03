import { BALANCING } from '../domain/constants';
import type { Spot } from '../domain/types';

/**
 * Lädt Fußball-/Bolzplätze aus OpenStreetMap über die Overpass-API
 * (Kapitel 3.1: "aus offenen Kartendaten, z. B. OpenStreetMap").
 * Ergebnisse werden in SQLite gecacht, damit die App offline nutzbar bleibt.
 * Attribution: © OpenStreetMap-Mitwirkende (ODbL), siehe Profil-Screen.
 */

/** Mehrere Overpass-Instanzen als Fallback – einzelne Server sind oft ausgelastet (429/504). */
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const SEARCH_RADIUS_M = 5000;
const FETCH_TIMEOUT_MS = 15000;

async function postWithTimeout(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

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
  const body = `data=${encodeURIComponent(query)}`;
  let json: { elements?: OverpassElement[] } | null = null;
  let lastError: unknown = null;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await postWithTimeout(url, body);
      if (!res.ok) {
        lastError = new Error(`Overpass HTTP ${res.status} (${url})`);
        continue;
      }
      json = (await res.json()) as { elements?: OverpassElement[] };
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!json) {
    throw lastError ?? new Error('Overpass unreachable');
  }
  const spots: Array<Omit<Spot, 'cooldownUntil'>> = [];
  (json.elements ?? []).forEach((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) return;
    spots.push({
      id: `osm-${el.type}-${el.id}`,
      name: el.tags?.name ?? 'Football pitch',
      latitude: lat,
      longitude: lon,
      radius: BALANCING.defaultSpotRadius,
      source: 'osm',
    });
  });
  return spots;
}
