import type { LatLon } from "./traffic/types";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Running distance in metres at each vertex of a [lon, lat] line. */
export function cumulativeDistances(coords: [number, number][]): number[] {
  const out: number[] = [];
  let total = 0;
  let prev: [number, number] | undefined;
  for (const point of coords) {
    if (prev) total += haversineM({ lat: prev[1], lon: prev[0] }, { lat: point[1], lon: point[0] });
    out.push(total);
    prev = point;
  }
  return out;
}

/** Bounding box around Great Britain; the app only plans drives to one club in Kent. */
export function isInGreatBritain(p: LatLon): boolean {
  return p.lat >= 49.8 && p.lat <= 60.9 && p.lon >= -8.7 && p.lon <= 1.9;
}

/** Rounds to ~100 m so nearby starts share cached results. */
export function originKey(p: LatLon): string {
  return `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
}
