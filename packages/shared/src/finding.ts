import { z } from 'zod';
import { polygonSchema } from './farm.js';

export const issueKindSchema = z.enum(['pest', 'water-stress', 'disease', 'nutrient']);
export type IssueKind = z.infer<typeof issueKindSchema>;

export const severitySchema = z.enum(['low', 'medium', 'high']);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  id: z.string(),
  flightId: z.string(),
  fieldId: z.string(),
  kind: issueKindSchema,
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  geometry: polygonSchema,
  areaM2: z.number().nonnegative(),
  diagnosis: z.string(), // plain language
  action: z.string(), // what to do next
});
export type Finding = z.infer<typeof findingSchema>;

export type Recommendation = Pick<Finding, 'id' | 'kind' | 'severity' | 'action'>;
