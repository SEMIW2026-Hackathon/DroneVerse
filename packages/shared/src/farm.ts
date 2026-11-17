import { z } from 'zod';

const position = z.tuple([z.number(), z.number()]).rest(z.number());

export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(position).min(4)).min(1),
});

export const farmSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string().min(1),
});
export type Farm = z.infer<typeof farmSchema>;

export const fieldSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string().min(1), // "North Wheat"
  crop: z.string(),
  areaHa: z.number().nonnegative(),
  boundary: polygonSchema,
});
export type Field = z.infer<typeof fieldSchema>;
