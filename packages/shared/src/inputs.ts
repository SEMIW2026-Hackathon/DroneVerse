import { z } from 'zod';
import { polygonSchema } from './farm.js';

export const farmInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type FarmInput = z.infer<typeof farmInputSchema>;

/** A boundary drawn by a user: closed ring, valid lon/lat, at least 3 distinct corners. */
export const boundarySchema = polygonSchema.superRefine((poly, ctx) => {
  for (const ring of poly.coordinates) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      ctx.addIssue({ code: 'custom', message: 'Polygon ring must be closed' });
      return;
    }
    if (ring.some(([lon, lat]) => Math.abs(lon) > 180 || Math.abs(lat) > 90)) {
      ctx.addIssue({ code: 'custom', message: 'Coordinates must be valid longitude/latitude' });
      return;
    }
    const distinct = new Set(ring.map(([lon, lat]) => `${lon},${lat}`));
    if (distinct.size < 3) {
      ctx.addIssue({ code: 'custom', message: 'Polygon needs at least 3 distinct corners' });
      return;
    }
  }
});

export const fieldInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  crop: z.string().trim().min(1).max(60),
  boundary: boundarySchema,
});
export type FieldInput = z.infer<typeof fieldInputSchema>;

export const fieldUpdateSchema = fieldInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Nothing to update',
  });
export type FieldUpdate = z.infer<typeof fieldUpdateSchema>;
