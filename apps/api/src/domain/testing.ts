// Shared fixtures for domain unit tests. Not imported by production code.
import { PLAN_CONFIG, type LonLat, type PlanConfig, type Polygon } from '@droneverse/shared';
import { makeProjection } from './geo.js';

export const ORIGIN: LonLat = { lon: 36.8, lat: -1.3 };

/** Polygon from [east, north] metre offsets from ORIGIN. */
export function polyM(points: [number, number][], origin: LonLat = ORIGIN): Polygon {
  const proj = makeProjection(origin);
  const ring = points.map(([x, y]) => {
    const { lon, lat } = proj.toLonLat({ x, y });
    return [lon, lat] as [number, number];
  });
  return { type: 'Polygon', coordinates: [[...ring, ring[0]!]] };
}

export const rectM = (x: number, y: number, w: number, h: number) =>
  polyM([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);

/** Waypoints back in metres from ORIGIN. */
export function toMetres(points: { lon: number; lat: number }[], origin: LonLat = ORIGIN) {
  const proj = makeProjection(origin);
  return points.map((p) => proj.toXY(p));
}

/**
 * Camera with a 90 degree field of view, so at 50 m altitude one photo is exactly
 * 100 m wide: 70% side overlap gives 30 m line spacing, 80% front overlap gives 15 m
 * photo spacing. Round numbers keep the expected values easy to check by hand.
 */
export const ROUND_CFG: PlanConfig = {
  ...PLAN_CONFIG,
  camera: { hFovDeg: 90, aspect: 0.75 },
};

export const ROUND_PARAMS = {
  altitudeM: 50,
  sideOverlapPct: 70,
  frontOverlapPct: 80,
  speedKmh: 20,
} as const;
