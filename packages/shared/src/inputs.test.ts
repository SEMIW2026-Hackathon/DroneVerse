import { describe, expect, it } from 'vitest';
import { fieldInputSchema } from './inputs.js';

const base = { name: 'North Wheat', crop: 'Wheat' };

describe('fieldInputSchema', () => {
  it('accepts a closed triangle', () => {
    const r = fieldInputSchema.safeParse({
      ...base,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [36, -1],
            [36.01, -1],
            [36, -0.99],
            [36, -1],
          ],
        ],
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unclosed ring', () => {
    const r = fieldInputSchema.safeParse({
      ...base,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [36, -1],
            [36.01, -1],
            [36, -0.99],
            [36.5, -0.5],
          ],
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    const r = fieldInputSchema.safeParse({
      ...base,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [200, -1],
            [36.01, -1],
            [36, -0.99],
            [200, -1],
          ],
        ],
      },
    });
    expect(r.success).toBe(false);
  });
});
