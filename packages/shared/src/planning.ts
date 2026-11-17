import { z } from 'zod';
import { surveyParamsSchema } from './mission.js';

export const lonLatSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type LonLat = z.infer<typeof lonLatSchema>;

export const planRequestSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1).max(20),
  droneId: z.string().min(1).max(64),
  params: surveyParamsSchema,
  /** Expected wind, entered by the operator (no weather feed yet). */
  windKmh: z.number().min(0).max(200).default(0),
  /** Launch / return point. Defaults to a corner of the first field. */
  home: lonLatSchema.optional(),
});
export type PlanRequest = z.input<typeof planRequestSchema>;

export type RiskSeverity = 'critical' | 'warning' | 'info';

export type RiskCode =
  | 'battery-endurance'
  | 'battery-reserve'
  | 'wind-too-high'
  | 'wind-high'
  | 'altitude-too-high'
  | 'altitude-low'
  | 'speed-over-drone-limit'
  | 'speed-too-fast-for-overlap'
  | 'no-fly-zone'
  | 'far-from-home'
  | 'too-many-waypoints'
  | 'regulations';

export interface RiskFlag {
  code: RiskCode;
  severity: RiskSeverity;
  message: string;
}

export interface PlanStats {
  areaHa: number;
  waypointCount: number;
  /** Distance flown in total, including the trip out and back. */
  totalDistanceM: number;
  surveyDistanceM: number;
  returnDistanceM: number;
  flightTimeMin: number;
  batteryUsedPct: number;
  batteryRemainingPct: number;
  reservePct: number;
  photoCount: number;
  lineSpacingM: number;
  photoSpacingM: number;
  footprintWidthM: number;
  /** Ground sample distance: centimetres of ground per pixel. */
  gsdCmPerPx: number;
}

export interface PlanResult {
  missionId?: string;
  home: LonLat;
  waypoints: { lat: number; lon: number; altM: number }[];
  fields: { fieldId: string; sweepAngleDeg: number; lineCount: number }[];
  stats: PlanStats;
  risks: RiskFlag[];
  /** False when any critical risk is present. */
  canLaunch: boolean;
}
