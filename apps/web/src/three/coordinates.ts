import type { Field } from '@droneverse/shared';
import { FARM_SCENE_CONFIG } from './sceneConfig';

export interface Point2 {
  x: number;
  z: number;
}

export interface ProjectedField {
  field: Field;
  rings: Point2[][];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FarmLayout {
  fields: ProjectedField[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  projectPosition: (lon: number, lat: number) => Point2;
}

function project([lon = 0, lat = 0]: number[], centerLon: number, centerLat: number): Point2 {
  const metersPerDegreeLon = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  return {
    x: (lon - centerLon) * metersPerDegreeLon,
    z: -(lat - centerLat) * 110_540,
  };
}

function extent(points: Point2[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  };
}

/** Projects real lon/lat field polygons into a compact local scene in metres. */
export function projectFields(fields: Field[]): FarmLayout {
  const positions: [number, number][] = fields.flatMap(
    (field) =>
      (field.boundary.coordinates[0] ?? []).map(([lon = 0, lat = 0]) => [lon, lat] as [number, number]),
  );
  if (!positions.length) {
    return {
      fields: [],
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      projectPosition: () => ({ x: 0, z: 0 }),
    };
  }

  const centerLon = positions.reduce((sum, [lon]) => sum + lon, 0) / positions.length;
  const centerLat = positions.reduce((sum, [, lat]) => sum + lat, 0) / positions.length;
  const projected = fields.map((field) => field.boundary.coordinates.map((ring) =>
    ring.map((position) => project(position, centerLon, centerLat)),
  ));
  const allPoints = projected.flat(2);
  const raw = extent(allPoints);
  const rawExtent = Math.max(raw.maxX - raw.minX, raw.maxZ - raw.minZ, 1);
  const scale = Math.min(1, FARM_SCENE_CONFIG.maxExtent / rawExtent);
  const scaled = projected.map((rings, index) => {
    const points = rings.flat();
    const fieldExtent = extent(points);
    return {
      field: fields[index]!,
      rings: rings.map((ring) =>
        ring.map(({ x, z }) => ({ x: x * scale, z: z * scale })),
      ),
      minX: fieldExtent.minX * scale,
      maxX: fieldExtent.maxX * scale,
      minZ: fieldExtent.minZ * scale,
      maxZ: fieldExtent.maxZ * scale,
    };
  });
  const scaledPoints = scaled.flatMap((field) => field.rings.flat());
  const bounds = extent(scaledPoints);
  return {
    fields: scaled,
    ...bounds,
    projectPosition: (lon, lat) => {
      const point = project([lon, lat], centerLon, centerLat);
      return { x: point.x * scale, z: point.z * scale };
    },
  };
}

export function pointInRing(point: Point2, ring: Point2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const intersects =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function getHelipadPosition(layout: FarmLayout): Point2 {
  return layout.fields.length
    ? { x: layout.minX - FARM_SCENE_CONFIG.helipadRadius - 4, z: (layout.minZ + layout.maxZ) / 2 }
    : { x: 0, z: 0 };
}
