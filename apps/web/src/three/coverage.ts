import type { FarmLayout, Point2, ProjectedField } from './coordinates';
import { pointInRing } from './coordinates';

export interface FieldCoverage {
  fieldId: string;
  percent: number;
}

function samples(field: ProjectedField, spacing: number): Point2[] {
  const points: Point2[] = [];
  for (let x = field.minX; x <= field.maxX; x += spacing) {
    for (let z = field.minZ; z <= field.maxZ; z += spacing) {
      if (pointInRing({ x, z }, field.rings[0] ?? [])) points.push({ x, z });
    }
  }
  return points;
}

export function calculateCoverage(
  layout: FarmLayout,
  visited: Point2[],
  scanRadiusM: number,
): FieldCoverage[] {
  return layout.fields.map((field) => {
    const points = samples(field, Math.max(2, scanRadiusM));
    if (!points.length) return { fieldId: field.field.id, percent: 0 };
    const covered = points.filter((point) =>
      visited.some((sample) => Math.hypot(sample.x - point.x, sample.z - point.z) <= scanRadiusM),
    ).length;
    return { fieldId: field.field.id, percent: Math.round((covered / points.length) * 100) };
  });
}
