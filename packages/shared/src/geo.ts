import type { LonLat } from './planning.js';

export interface XY {
  x: number;
  y: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Flat local projection (metres east/north of an origin). Accurate to well under 1%
 * across the few kilometres a single mission covers.
 */
export function makeProjection(origin: LonLat) {
  const k = Math.cos(rad(origin.lat));
  return {
    toXY: (p: LonLat): XY => ({
      x: rad(p.lon - origin.lon) * EARTH_RADIUS_M * k,
      y: rad(p.lat - origin.lat) * EARTH_RADIUS_M,
    }),
    toLonLat: (q: XY): LonLat => ({
      lon: origin.lon + deg(q.x / (EARTH_RADIUS_M * k)),
      lat: origin.lat + deg(q.y / EARTH_RADIUS_M),
    }),
  };
}

export type Projection = ReturnType<typeof makeProjection>;

/** Great-circle distance in metres. */
export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceXY(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Even-odd point-in-polygon over any number of rings (holes included). */
export function pointInRings(p: XY, rings: XY[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!;
      const b = ring[j]!;
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
  }
  return inside;
}
