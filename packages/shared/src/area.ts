import type { z } from 'zod';
import type { polygonSchema } from './farm.js';

type Polygon = z.infer<typeof polygonSchema>;

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6_371_008.8;
const SQM_PER_HA = 10_000;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Signed area of one ring on a sphere (Chamberlain & Duquette), in square metres.
 * Expects a closed ring of [lon, lat] positions.
 */
function ringAreaM2(ring: ReadonlyArray<readonly number[]>): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i] as [number, number];
    const [lon2, lat2] = ring[i + 1] as [number, number];
    sum += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Area of a GeoJSON polygon (outer ring minus holes) in square metres. */
export function polygonAreaM2(polygon: Pick<Polygon, 'coordinates'>): number {
  const [outer, ...holes] = polygon.coordinates;
  if (!outer) return 0;
  const holesArea = holes.reduce((acc, ring) => acc + ringAreaM2(ring), 0);
  return Math.max(0, ringAreaM2(outer) - holesArea);
}

/** Area of a GeoJSON polygon in hectares. */
export function polygonAreaHa(polygon: Pick<Polygon, 'coordinates'>): number {
  return polygonAreaM2(polygon) / SQM_PER_HA;
}
