import { z } from 'zod';

export const droneSpecSchema = z.object({
  id: z.string(),
  name: z.string(), // "Condor X8"
  tagline: z.string(), // "Big farms"
  type: z.enum(['survey', 'spray']),
  rotors: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  maxFlightMin: z.number().positive(),
  topSpeedKmh: z.number().positive(),
  cameraMP: z.number().positive(),
  sensor: z.enum(['rgb', 'multispectral']),
  payloadL: z.number().positive().optional(), // spray tank, if any
  driver: z.enum(['sim', 'mavlink']),
});
export type DroneSpec = z.infer<typeof droneSpecSchema>;

export const droneModeSchema = z.enum([
  'disarmed',
  'armed',
  'takeoff',
  'mission',
  'manual',
  'rth',
  'landing',
]);
export type DroneMode = z.infer<typeof droneModeSchema>;

export const telemetrySchema = z.object({
  droneId: z.string(),
  t: z.number(),
  position: z.object({ lat: z.number(), lon: z.number(), altM: z.number() }),
  headingDeg: z.number(),
  speedKmh: z.number(),
  batteryPct: z.number().min(0).max(100),
  gpsSats: z.number().int().nonnegative(),
  linkQuality: z.number().min(0).max(100),
  mode: droneModeSchema,
});
export type Telemetry = z.infer<typeof telemetrySchema>;

// Commands sent to a drone, always through the DroneDriver interface (Phase 3).
export const droneCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('arm') }),
  z.object({ type: z.literal('takeoff'), altM: z.number().positive() }),
  z.object({ type: z.literal('startMission') }),
  z.object({ type: z.literal('rth') }),
  z.object({ type: z.literal('land') }),
]);
export type DroneCommand = z.infer<typeof droneCommandSchema>;
