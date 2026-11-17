import { z } from 'zod';
import { telemetrySchema } from './drone.js';
import { lonLatSchema } from './planning.js';
import { waypointSchema } from './mission.js';
import { flightPhaseSchema } from './flightPhase.js';

// ---------- Commands ----------

/** What the drone needs to fly one saved mission. */
export const uploadedMissionSchema = z.object({
  missionId: z.string().uuid(),
  drone: z.object({
    id: z.string(),
    name: z.string(),
    rotors: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    maxFlightMin: z.number().positive(),
    topSpeedKmh: z.number().positive(),
  }),
  waypoints: z.array(waypointSchema).min(1).max(2000),
  speedKmh: z.number().positive(),
  altitudeM: z.number().positive(),
  home: lonLatSchema,
  windKmh: z.number().min(0),
  /** Battery that must be on board to start: planned use plus the safety reserve. */
  requiredBatteryPct: z.number().min(0).max(100),
});
export type UploadedMission = z.infer<typeof uploadedMissionSchema>;

/** Extra confirmations a step can demand (spray / payload release will use 'payload'). */
export const confirmationKindSchema = z.enum(['launch', 'payload']);
export type ConfirmationKind = z.infer<typeof confirmationKindSchema>;

/** Simulator-only controls. Rejected unless the driver is a simulator. */
export const simControlSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('motorFault'),
    index: z.number().int().min(0).max(7),
    fault: z.boolean(),
  }),
  z.object({ action: z.literal('gpsLoss'), on: z.boolean() }),
  z.object({ action: z.literal('linkDegraded'), on: z.boolean() }),
  z.object({ action: z.literal('setBattery'), pct: z.number().min(0).max(100) }),
]);
export type SimControl = z.infer<typeof simControlSchema>;

const arm = z.object({ type: z.literal('arm') });
const takeoff = z.object({ type: z.literal('takeoff') });
const startMission = z.object({ type: z.literal('startMission') });
const returnToHome = z.object({ type: z.literal('returnToHome') });
const land = z.object({ type: z.literal('land') });
const abort = z.object({ type: z.literal('abort') });
const verifyPreflight = z.object({ type: z.literal('verifyPreflight') });
const confirm = z.object({ type: z.literal('confirm'), kind: confirmationKindSchema });
const simControl = z.object({ type: z.literal('simControl'), control: simControlSchema });
const confirmLaunch = z.object({
  type: z.literal('confirmLaunch'),
  /** Must be true when the drone is simulated: the user has been told it is. */
  acknowledgedSimulated: z.boolean(),
  /** The user confirms the area is clear and they will follow local rules. */
  areaClear: z.literal(true),
  /** Run arm -> takeoff -> start mission automatically. False leaves each step to a command. */
  autoSequence: z.boolean().default(true),
});

const shared = [
  verifyPreflight,
  confirmLaunch,
  confirm,
  arm,
  takeoff,
  startMission,
  returnToHome,
  land,
  abort,
  simControl,
] as const;

/** Commands the browser may send. The API fills in the mission payload for uploads. */
export const clientCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uploadMission') }),
  ...shared,
]);
export type ClientCommand = z.infer<typeof clientCommandSchema>;

/** Commands the API sends to the bridge. */
export const bridgeCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uploadMission'), mission: uploadedMissionSchema }),
  ...shared,
]);
export type BridgeCommand = z.infer<typeof bridgeCommandSchema>;
export type CommandType = BridgeCommand['type'];

/** Safety commands: never blocked by the pre-flight gate or a confirmation. */
export const SAFETY_COMMANDS: readonly CommandType[] = ['returnToHome', 'land', 'abort'];

// ---------- Results and events ----------

export const preflightResultSchema = z.object({
  passed: z.boolean(),
  checks: z.array(
    z.object({
      id: z.enum(['telemetry', 'battery', 'motors', 'gps', 'link', 'mission']),
      label: z.string(),
      passed: z.boolean(),
      detail: z.string(),
    }),
  ),
});

export const commandResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  /** The pre-flight check as it was evaluated at the moment of the command. */
  preflight: preflightResultSchema.optional(),
});
export type CommandResult = z.infer<typeof commandResultSchema>;

export const commandLogEntrySchema = z.object({
  id: z.string(),
  /** Milliseconds since the epoch, taken when the command was handled. */
  at: z.number(),
  iso: z.string(),
  command: z.string(),
  source: z.enum(['user', 'sequence', 'auto']),
  ok: z.boolean(),
  error: z.string().optional(),
});
export type CommandLogEntry = z.infer<typeof commandLogEntrySchema>;

export const flightEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('phase'),
    missionId: z.string(),
    phase: flightPhaseSchema,
    abortReason: z.string().nullable(),
    landInPlace: z.boolean(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('sequence'),
    status: z.enum(['running', 'awaiting-confirmation', 'completed', 'aborted']),
    step: z.string().optional(),
    /** Why a sequence stopped, shown to the user. */
    reason: z.string().optional(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('alert'),
    severity: z.enum(['info', 'warning', 'critical']),
    code: z.string(),
    message: z.string(),
    at: z.number(),
  }),
  z.object({ type: z.literal('commandLog'), entry: commandLogEntrySchema }),
]);
export type FlightEvent = z.infer<typeof flightEventSchema>;

// ---------- Messages on the wire ----------

export const bridgeInfoSchema = z.object({
  droneName: z.string(),
  simulated: z.boolean(),
  rotors: z.number().int(),
});
export type BridgeInfo = z.infer<typeof bridgeInfoSchema>;

/** bridge -> API */
export const bridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    info: bridgeInfoSchema,
    /** The mission the bridge is already holding, so the API can recover after a restart. */
    mission: z.object({ missionId: z.string(), phase: flightPhaseSchema }).nullable(),
  }),
  z.object({ type: z.literal('telemetry'), telemetry: telemetrySchema }),
  z.object({ type: z.literal('event'), event: flightEventSchema }),
  z.object({ type: z.literal('ack'), requestId: z.string(), result: commandResultSchema }),
]);
export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;

/** API -> bridge */
export const toBridgeMessageSchema = z.object({
  type: z.literal('command'),
  requestId: z.string(),
  command: bridgeCommandSchema,
});
export type ToBridgeMessage = z.infer<typeof toBridgeMessageSchema>;

/** browser -> API */
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth'), token: z.string().min(1) }),
  z.object({
    type: z.literal('command'),
    requestId: z.string().min(1).max(64),
    missionId: z.string().uuid(),
    command: clientCommandSchema,
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** API -> browser */
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('authed') }),
  z.object({ type: z.literal('auth-failed') }),
  z.object({
    type: z.literal('bridge'),
    online: z.boolean(),
    info: bridgeInfoSchema.nullable(),
    /** Another user's mission has the drone. */
    busy: z.boolean(),
  }),
  z.object({ type: z.literal('telemetry'), telemetry: telemetrySchema }),
  z.object({ type: z.literal('event'), event: flightEventSchema }),
  z.object({ type: z.literal('ack'), requestId: z.string(), result: commandResultSchema }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
