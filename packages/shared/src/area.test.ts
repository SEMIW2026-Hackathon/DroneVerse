import { describe, expect, it } from 'vitest';
import { polygonAreaHa, polygonAreaM2 } from './area.js';

/** Axis-aligned lon/lat rectangle as a closed GeoJSON polygon. */
function rect(lon: number, lat: number, dLon: number, dLat: number) {
  return {
    coordinates: [
      [
        [lon, lat],
        [lon + dLon, lat],
        [lon + dLon, lat + dLat],
        [lon, lat + dLat],
        [lon, lat],
      ],
    ],
  };
}

describe('polygonAreaM2', () => {
  it('computes ~1 km x 1 km at the equator as ~100 ha', () => {
    const deg = 1000 / 111_195; // 1 km in degrees on a sphere
    expect(polygonAreaHa(rect(36.8, 0, deg, deg))).toBeCloseTo(100, 0);
  });

  it('shrinks with latitude (a 0.01 deg square at 60N is about half of one at the equator)', () => {
    const equator = polygonAreaM2(rect(0, 0, 0.01, 0.01));
    const sixty = polygonAreaM2(rect(0, 60, 0.01, 0.01));
    expect(sixty / equator).toBeCloseTo(0.5, 2);
  });

  it('is the same regardless of winding direction', () => {
    const cw = rect(10, 10, 0.01, 0.01);
    const ccw = { coordinates: [[...(cw.coordinates[0] as number[][])].reverse()] };
    expect(polygonAreaM2(ccw)).toBeCloseTo(polygonAreaM2(cw), 6);
  });

  it('subtracts holes', () => {
    const outer = rect(0, 0, 0.02, 0.02).coordinates[0]!;
    const hole = rect(0.005, 0.005, 0.01, 0.01).coordinates[0]!;
    const full = polygonAreaM2({ coordinates: [outer] });
    const withHole = polygonAreaM2({ coordinates: [outer, hole] });
    expect(withHole).toBeCloseTo(full * 0.75, -1);
  });

  it('computes an irregular (triangular) field', () => {
    // Right triangle with ~1 km legs near the equator is half of 100 ha.
    const d = 1000 / 111_195;
    const tri = {
      coordinates: [
        [
          [0, 0],
          [d, 0],
          [0, d],
          [0, 0],
        ],
      ],
    };
    expect(polygonAreaHa(tri)).toBeCloseTo(50, 0);
  });

  it('returns 0 for an empty polygon', () => {
    expect(polygonAreaM2({ coordinates: [] })).toBe(0);
  });
});
