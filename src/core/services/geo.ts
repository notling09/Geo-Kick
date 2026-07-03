/** Geo-Helfer für Check-in-Prüfungen. */

/**
 * Kreis um einen Punkt als GeoJSON-Polygon (für den Check-in-Radius auf der
 * MapLibre-Karte; dort gibt es keine metrische Kreis-Primitive).
 */
export function circlePolygon(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: Array<[number, number]> = [];
  const latRad = (latitude * Math.PI) / 180;
  const dLat = radiusMeters / 111320;
  const dLon = radiusMeters / (111320 * Math.cos(latRad));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([longitude + dLon * Math.cos(angle), latitude + dLat * Math.sin(angle)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

/** Distanz zweier Koordinaten in Metern (Haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
