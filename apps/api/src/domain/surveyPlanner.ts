import type { LonLat, PlanConfig, Polygon, SurveyParams, Waypoint } from '@droneverse/shared';
import { distanceXY, makeProjection, type XY } from './geo.js';

export class PlanError extends Error {}

type Camera = PlanConfig['camera'];

/** Ground area one photo covers at a given altitude. */
export function footprintM(altitudeM: number, camera: Camera) {
  const widthM = 2 * altitudeM * Math.tan((camera.hFovDeg / 2) * (Math.PI / 180));
  return { widthM, heightM: widthM * camera.aspect };
}

/** Distance between flight lines, from side overlap. */
export function lineSpacingM(params: SurveyParams, camera: Camera): number {
  return footprintM(params.altitudeM, camera).widthM * (1 - params.sideOverlapPct / 100);
}

/** Distance between photos along a line, from front overlap. */
export function photoSpacingM(params: SurveyParams, camera: Camera): number {
  return footprintM(params.altitudeM, camera).heightM * (1 - params.frontOverlapPct / 100);
}

/** Ground sample distance in cm per pixel. */
export function gsdCmPerPx(params: SurveyParams, camera: Camera, cameraMP: number): number {
  const widthPx = Math.sqrt((cameraMP * 1e6) / camera.aspect);
  return (footprintM(params.altitudeM, camera).widthM * 100) / widthPx;
}

export interface SurveyField {
  id: string;
  /** Only used in messages. */
  name?: string;
  boundary: Polygon;
}

export interface FieldRoute {
  fieldId: string;
  sweepAngleDeg: number;
  lineCount: number;
  segmentCount: number;
  /** Length flown along survey lines only (no turns or transits), in metres. */
  surveyLengthM: number;
}

export interface SurveyPlan {
  home: LonLat;
  waypoints: Waypoint[];
  fields: FieldRoute[];
  surveyLengthM: number;
  segmentCount: number;
}

interface Line {
  y: number;
  segments: [number, number][];
}

const rotate = (p: XY, angleDeg: number): XY => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};

/**
 * Horizontal scan lines across the rings, in the rotated frame. Lines are spaced
 * `spacing` apart and centred so both edges of the field are covered. Even-odd
 * pairing of crossings gives one segment per stretch inside the field, so concave
 * shapes get several segments on a line instead of one that cuts across the notch.
 */
function scanLines(rings: XY[][], spacing: number, maxLines: number): Line[] {
  const ys = rings.flat().map((p) => p.y);
  const yMin = Math.min(...ys);
  const height = Math.max(...ys) - yMin;
  const count = Math.max(1, Math.ceil(height / spacing - 1e-9));
  if (count > maxLines) throw new PlanError('Flight line spacing is too small for this field');
  const offset = (height - (count - 1) * spacing) / 2;

  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    const y = yMin + offset + i * spacing;
    const xs: number[] = [];
    for (const ring of rings) {
      for (let k = 0; k < ring.length - 1; k++) {
        const a = ring[k]!;
        const b = ring[k + 1]!;
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
        }
      }
    }
    xs.sort((p, q) => p - q);
    const segments: [number, number][] = [];
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1]! - xs[k]! > 1e-6) segments.push([xs[k]!, xs[k + 1]!]);
    }
    if (segments.length) lines.push({ y, segments });
  }
  return lines;
}

/** Boustrophedon ("lawnmower") order: alternate direction on each line. */
function routeFromLines(lines: Line[], reverseLines: boolean, firstAscending: boolean): XY[] {
  const ordered = reverseLines ? [...lines].reverse() : lines;
  const points: XY[] = [];
  ordered.forEach((line, i) => {
    const ascending = i % 2 === 0 ? firstAscending : !firstAscending;
    const segs = ascending ? line.segments : [...line.segments].reverse();
    for (const [x1, x2] of segs) {
      points.push(ascending ? { x: x1, y: line.y } : { x: x2, y: line.y });
      points.push(ascending ? { x: x2, y: line.y } : { x: x1, y: line.y });
    }
  });
  return points;
}

function pathLength(points: XY[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceXY(points[i - 1]!, points[i]!);
  return total;
}

interface Candidate {
  points: XY[];
  angleDeg: number;
  lines: Line[];
  cost: number;
}

/** Best route for one field: tries every sweep angle and start corner, keeps the shortest. */
function planField(
  rings: XY[][],
  entry: XY,
  spacing: number,
  fixedAngle: number | undefined,
  cfg: PlanConfig,
): Candidate {
  const angles =
    fixedAngle !== undefined
      ? [fixedAngle]
      : Array.from(
          { length: Math.ceil(180 / cfg.survey.angleStepDeg) },
          (_, i) => i * cfg.survey.angleStepDeg,
        );

  let best: Candidate | undefined;
  for (const angle of angles) {
    const rotated = rings.map((ring) => ring.map((p) => rotate(p, -angle)));
    const lines = scanLines(rotated, spacing, cfg.survey.maxLines);
    if (!lines.length) continue;
    for (const reverseLines of [false, true]) {
      for (const firstAscending of [true, false]) {
        const points = routeFromLines(lines, reverseLines, firstAscending).map((p) =>
          rotate(p, angle),
        );
        const cost = distanceXY(entry, points[0]!) + pathLength(points);
        if (!best || cost < best.cost - 1e-9) best = { points, angleDeg: angle, lines, cost };
      }
    }
  }
  if (!best) throw new PlanError('Could not fit any flight lines inside this field');
  return best;
}

/**
 * Plan a lawnmower survey over one or more fields. Fields are visited nearest-first
 * starting from `home`; within each field the sweep angle and start corner are chosen
 * to keep the route short. Deterministic: same input, same output.
 */
export function planSurvey(
  fields: SurveyField[],
  params: SurveyParams,
  cfg: PlanConfig,
  homeOverride?: LonLat,
): SurveyPlan {
  if (!fields.length) throw new PlanError('Pick at least one field');

  const allVertices = fields.flatMap((f) => f.boundary.coordinates.flat());
  const origin: LonLat = {
    lon: allVertices.reduce((s, p) => s + p[0], 0) / allVertices.length,
    lat: allVertices.reduce((s, p) => s + p[1], 0) / allVertices.length,
  };
  const proj = makeProjection(origin);

  const first = fields[0]!.boundary.coordinates[0]![0]!;
  const home: LonLat = homeOverride ?? { lon: first[0], lat: first[1] };

  const spacing = lineSpacingM(params, cfg.camera);
  if (spacing < 0.5) throw new PlanError('Flight line spacing is too small');

  const prepared = fields.map((f) => {
    const rings = f.boundary.coordinates.map((ring) =>
      ring.map(([lon, lat]) => proj.toXY({ lon: lon!, lat: lat! })),
    );
    const outer = rings[0]!;
    const centroid = {
      x: outer.reduce((s, p) => s + p.x, 0) / outer.length,
      y: outer.reduce((s, p) => s + p.y, 0) / outer.length,
    };
    return { id: f.id, rings, centroid };
  });

  const waypoints: Waypoint[] = [];
  const routes: FieldRoute[] = [];
  let position = proj.toXY(home);
  let surveyLengthM = 0;
  let segmentCount = 0;

  const remaining = [...prepared];
  while (remaining.length) {
    let nearest = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (
        distanceXY(position, remaining[i]!.centroid) <
        distanceXY(position, remaining[nearest]!.centroid)
      ) {
        nearest = i;
      }
    }
    const field = remaining.splice(nearest, 1)[0]!;
    const plan = planField(field.rings, position, spacing, params.sweepAngleDeg, cfg);

    for (const p of plan.points) {
      const { lon, lat } = proj.toLonLat(p);
      waypoints.push({ lon, lat, altM: params.altitudeM });
    }
    // Every consecutive pair of points is one segment's two ends: (0,1), (2,3), ...
    let fieldSurvey = 0;
    for (let i = 0; i + 1 < plan.points.length; i += 2) {
      fieldSurvey += distanceXY(plan.points[i]!, plan.points[i + 1]!);
    }
    surveyLengthM += fieldSurvey;
    segmentCount += plan.points.length / 2;
    routes.push({
      fieldId: field.id,
      sweepAngleDeg: plan.angleDeg,
      lineCount: plan.lines.length,
      segmentCount: plan.points.length / 2,
      surveyLengthM: fieldSurvey,
    });
    position = plan.points[plan.points.length - 1]!;
  }

  return { home, waypoints, fields: routes, surveyLengthM, segmentCount };
}
