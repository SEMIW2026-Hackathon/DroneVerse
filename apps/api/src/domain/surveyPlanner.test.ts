import { describe, expect, it } from 'vitest';
import { polygonAreaM2 } from '@droneverse/shared';
import { makeProjection, pointInRings, type XY } from './geo.js';
import {
  footprintM,
  gsdCmPerPx,
  lineSpacingM,
  photoSpacingM,
  planSurvey,
  PlanError,
} from './surveyPlanner.js';
import { ORIGIN, polyM, rectM, ROUND_CFG, ROUND_PARAMS, toMetres } from './testing.js';

const params0 = { ...ROUND_PARAMS, sweepAngleDeg: 0 };
const length = (pts: XY[]) =>
  pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y), 0);

describe('camera geometry', () => {
  it('derives footprint and spacings from altitude and overlap', () => {
    expect(footprintM(50, ROUND_CFG.camera).widthM).toBeCloseTo(100, 6);
    expect(lineSpacingM(ROUND_PARAMS, ROUND_CFG.camera)).toBeCloseTo(30, 6);
    expect(photoSpacingM(ROUND_PARAMS, ROUND_CFG.camera)).toBeCloseTo(15, 6); // 75 m * (1 - 0.8)
  });

  it('computes ground sample distance from camera megapixels', () => {
    // 12 MP at 4:3 = 4000 x 3000 px; 100 m across 4000 px = 2.5 cm/px
    expect(gsdCmPerPx(ROUND_PARAMS, ROUND_CFG.camera, 12)).toBeCloseTo(2.5, 6);
  });
});

describe('planSurvey: rectangle', () => {
  // 200 m east-west by 90 m north-south, lines 30 m apart => 3 lines at y = 15, 45, 75
  const field = { id: 'f1', boundary: rectM(0, 0, 200, 90) };
  const plan = planSurvey([field], params0, ROUND_CFG, ORIGIN);
  const pts = toMetres(plan.waypoints);

  it('makes the expected number of lines, two waypoints each', () => {
    expect(plan.fields[0]!.lineCount).toBe(3);
    expect(plan.waypoints).toHaveLength(6);
  });

  it('spaces lines evenly and centres them so both edges are covered', () => {
    const ys = [pts[0]!.y, pts[2]!.y, pts[4]!.y].sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(15, 0);
    expect(ys[1]).toBeCloseTo(45, 0);
    expect(ys[2]).toBeCloseTo(75, 0);
  });

  it('runs each line edge to edge and alternates direction', () => {
    for (let i = 0; i < 6; i += 2) {
      expect(Math.abs(pts[i + 1]!.x - pts[i]!.x)).toBeCloseTo(200, 0);
    }
    const dir = [0, 2, 4].map((i) => Math.sign(pts[i + 1]!.x - pts[i]!.x));
    expect(dir[1]).toBe(-dir[0]!);
    expect(dir[2]).toBe(dir[0]);
  });

  it('flies the requested altitude', () => {
    expect(plan.waypoints.every((w) => w.altM === 50)).toBe(true);
  });

  it('survey length matches line count x line length', () => {
    expect(plan.surveyLengthM).toBeCloseTo(600, 0);
  });
});

describe('planSurvey: irregular polygons', () => {
  // U shape: 120 x 100 m with a 40 x 60 m notch cut from the top.
  const uShape = polyM([
    [0, 0],
    [120, 0],
    [120, 100],
    [80, 100],
    [80, 40],
    [40, 40],
    [40, 100],
    [0, 100],
  ]);
  const rings = (poly: typeof uShape): XY[][] => {
    const proj = makeProjection(ORIGIN);
    return poly.coordinates.map((r) => r.map(([lon, lat]) => proj.toXY({ lon: lon!, lat: lat! })));
  };

  it('splits lines at a concave notch instead of cutting across it', () => {
    const plan = planSurvey([{ id: 'u', boundary: uShape }], params0, ROUND_CFG, ORIGIN);
    // lines at y = 5, 35 (full width, 1 segment) and 65, 95 (two segments each)
    expect(plan.fields[0]!.lineCount).toBe(4);
    expect(plan.segmentCount).toBe(6);
    expect(plan.surveyLengthM).toBeCloseTo(120 + 120 + 80 + 80, 0);
  });

  it('keeps every survey segment inside the field', () => {
    const plan = planSurvey([{ id: 'u', boundary: uShape }], params0, ROUND_CFG, ORIGIN);
    const pts = toMetres(plan.waypoints);
    const r = rings(uShape);
    for (let i = 0; i < pts.length; i += 2) {
      const mid = { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 };
      expect(pointInRings(mid, r)).toBe(true);
    }
  });

  it('covers an irregular pentagon: survey length x spacing is close to its area', () => {
    const pentagon = polyM([
      [0, 0],
      [320, 30],
      [380, 220],
      [170, 340],
      [-30, 200],
    ]);
    const plan = planSurvey(
      [{ id: 'p', boundary: pentagon }],
      { ...ROUND_PARAMS },
      ROUND_CFG,
      ORIGIN,
    );
    const area = polygonAreaM2(pentagon);
    expect((plan.surveyLengthM * 30) / area).toBeGreaterThan(0.9);
    expect((plan.surveyLengthM * 30) / area).toBeLessThan(1.15);
    // all waypoints sit on or just inside the boundary
    const r = rings(pentagon);
    const pts = toMetres(plan.waypoints);
    for (let i = 0; i < pts.length; i += 2) {
      const mid = { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 };
      expect(pointInRings(mid, r)).toBe(true);
    }
  });

  it('handles a triangle', () => {
    const tri = polyM([
      [0, 0],
      [200, 0],
      [0, 120],
    ]);
    const plan = planSurvey([{ id: 't', boundary: tri }], params0, ROUND_CFG, ORIGIN);
    expect(plan.waypoints.length).toBeGreaterThanOrEqual(8);
    // line lengths shrink toward the apex
    const pts = toMetres(plan.waypoints);
    const lens = [];
    for (let i = 0; i < pts.length; i += 2) lens.push(Math.abs(pts[i + 1]!.x - pts[i]!.x));
    expect(Math.max(...lens)).toBeGreaterThan(Math.min(...lens));
  });

  it('is deterministic', () => {
    const run = () => planSurvey([{ id: 'u', boundary: uShape }], ROUND_PARAMS, ROUND_CFG);
    expect(run()).toEqual(run());
  });
});

describe('planSurvey: sweep angle', () => {
  it('picks a direction along a rotated, elongated field', () => {
    // 400 x 60 m strip rotated 40 degrees
    const a = (40 * Math.PI) / 180;
    const rot = ([x, y]: [number, number]): [number, number] => [
      x * Math.cos(a) - y * Math.sin(a),
      x * Math.sin(a) + y * Math.cos(a),
    ];
    const strip = polyM(
      (
        [
          [0, 0],
          [400, 0],
          [400, 60],
          [0, 60],
        ] as [number, number][]
      ).map(rot),
    );
    const field = [{ id: 's', boundary: strip }];

    const auto = planSurvey(field, ROUND_PARAMS, ROUND_CFG, ORIGIN);
    const fixed = planSurvey(field, params0, ROUND_CFG, ORIGIN);

    expect(auto.fields[0]!.sweepAngleDeg).toBeGreaterThanOrEqual(35);
    expect(auto.fields[0]!.sweepAngleDeg).toBeLessThanOrEqual(45);
    expect(auto.fields[0]!.lineCount).toBeLessThan(fixed.fields[0]!.lineCount);
    expect(length(toMetres(auto.waypoints))).toBeLessThan(length(toMetres(fixed.waypoints)));
  });

  it('honours an explicit sweep angle', () => {
    const plan = planSurvey(
      [{ id: 'f', boundary: rectM(0, 0, 200, 90) }],
      { ...ROUND_PARAMS, sweepAngleDeg: 90 },
      ROUND_CFG,
      ORIGIN,
    );
    expect(plan.fields[0]!.sweepAngleDeg).toBe(90);
    const pts = toMetres(plan.waypoints);
    // north-south lines: each line has constant x
    expect(pts[0]!.x).toBeCloseTo(pts[1]!.x, 0);
  });
});

describe('planSurvey: several fields and bad input', () => {
  const A = { id: 'A', boundary: rectM(0, 0, 100, 60) };
  const B = { id: 'B', boundary: rectM(600, 0, 100, 60) };

  it('visits the nearest field first', () => {
    const nearA = planSurvey([B, A], ROUND_PARAMS, ROUND_CFG, { ...ORIGIN });
    expect(nearA.fields.map((f) => f.fieldId)).toEqual(['A', 'B']);

    const proj = makeProjection(ORIGIN);
    const nearB = planSurvey([A, B], ROUND_PARAMS, ROUND_CFG, proj.toLonLat({ x: 700, y: 0 }));
    expect(nearB.fields.map((f) => f.fieldId)).toEqual(['B', 'A']);
  });

  it('defaults home to a corner of the first field', () => {
    const plan = planSurvey([A], ROUND_PARAMS, ROUND_CFG);
    expect(plan.home.lon).toBeCloseTo(A.boundary.coordinates[0]![0]![0], 9);
  });

  it('rejects flight line spacing that is too small', () => {
    expect(() =>
      planSurvey(
        [A],
        { altitudeM: 1, sideOverlapPct: 95, frontOverlapPct: 80, speedKmh: 10 },
        ROUND_CFG,
      ),
    ).toThrow(PlanError);
  });

  it('rejects an empty field list', () => {
    expect(() => planSurvey([], ROUND_PARAMS, ROUND_CFG)).toThrow(PlanError);
  });
});
