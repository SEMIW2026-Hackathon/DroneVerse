import { describe, expect, it } from 'vitest';
import type { Field } from '@droneverse/shared';
import { getHelipadPosition, pointInRing, projectFields } from './coordinates';

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

describe('farm scene coordinates', () => {
  it('projects real polygon coordinates into a bounded local layout', () => {
    const layout = projectFields([field]);
    expect(layout.fields[0]?.rings[0]).toHaveLength(5);
    expect(layout.maxX - layout.minX).toBeLessThanOrEqual(60);
    expect(layout.maxZ - layout.minZ).toBeLessThanOrEqual(60);
  });

  it('detects crop points inside the field boundary', () => {
    const layout = projectFields([field]);
    const ring = layout.fields[0]!.rings[0]!;
    expect(pointInRing({ x: (layout.minX + layout.maxX) / 2, z: (layout.minZ + layout.maxZ) / 2 }, ring)).toBe(true);
  });

  it('places the helipad beside, not inside, the field bounds', () => {
    const layout = projectFields([field]);
    const helipad = getHelipadPosition(layout);
    expect(helipad.x).toBeLessThan(layout.minX);
    expect(helipad.z).toBe((layout.minZ + layout.maxZ) / 2);
  });
});
