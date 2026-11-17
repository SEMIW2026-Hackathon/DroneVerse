import { describe, expect, it } from 'vitest';
import type { Field } from '@droneverse/shared';
import { projectFields } from './coordinates';
import { calculateCoverage } from './coverage';

const field: Field = {
  id: 'field-1',
  farmId: 'farm-1',
  name: 'North',
  crop: 'maize',
  areaHa: 1,
  boundary: {
    type: 'Polygon',
    coordinates: [[[36.8, -1.3], [36.801, -1.3], [36.801, -1.299], [36.8, -1.299], [36.8, -1.3]]],
  },
};

describe('scan coverage', () => {
  it('increases as visited samples cover the projected field', () => {
    const layout = projectFields([field]);
    const empty = calculateCoverage(layout, [], 5)[0]!.percent;
    const full = calculateCoverage(
      layout,
      layout.fields[0]!.rings[0]!.map(({ x, z }) => ({ x, z })),
      20,
    )[0]!.percent;
    expect(empty).toBe(0);
    expect(full).toBeGreaterThan(empty);
  });
});
