import { z } from 'zod';

export const missionPhaseSchema = z.enum([
  'draft',
  'planned',
  'preflight',
  'takeoff',
  'scanning',
  'returning',
  'landed',
  'processing',
  'complete',
  'aborted',
]);
export type MissionPhase = z.infer<typeof missionPhaseSchema>;

export const waypointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  altM: z.number(),
});
export type Waypoint = z.infer<typeof waypointSchema>;

export const surveyParamsSchema = z.object({
  altitudeM: z.number().min(1).max(500),
  frontOverlapPct: z.number().min(0).max(95),
  sideOverlapPct: z.number().min(0).max(95),
  speedKmh: z.number().min(1).max(200),
  /** Sweep direction in degrees (0 = east-west lines). Omit to let the planner choose. */
  sweepAngleDeg: z.number().min(0).max(179).optional(),
});
export type SurveyParams = z.infer<typeof surveyParamsSchema>;

export const missionSchema = z.object({
  id: z.string(),
  fieldIds: z.array(z.string()).min(1),
  droneId: z.string(),
  phase: missionPhaseSchema,
  params: surveyParamsSchema,
  waypoints: z.array(waypointSchema),
});
export type Mission = z.infer<typeof missionSchema>;
