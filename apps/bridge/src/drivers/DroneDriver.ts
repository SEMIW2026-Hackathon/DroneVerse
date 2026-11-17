import type { SimControl, Telemetry, UploadedMission } from '@droneverse/shared';

/** Things that happen on the drone that the flight controller needs to react to. */
export type DriverEvent =
  | { type: 'takeoffComplete' }
  | { type: 'missionComplete' }
  | { type: 'touchdown' }
  | { type: 'batteryDepleted' };

/** Extra controls that only a simulator has. Real drivers do not define `sim`. */
export interface SimControls {
  apply(control: SimControl): void;
}

/**
 * The only way anything in the platform talks to a drone. The FlightController owns
 * the safety rules (pre-flight gate, confirmation, state machine); a driver just
 * carries out low-level requests and reports telemetry. No route, component or
 * command handler may reach a specific drone any other way.
 */
export interface DroneDriver {
  readonly kind: 'sim' | 'mavlink';
  /** True when no real aircraft is involved. The UI must label this "Simulated". */
  readonly simulated: boolean;
  /** Present only on simulators. */
  readonly sim?: SimControls;

  info(): { droneName: string; rotors: number };

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Latest telemetry snapshot. */
  telemetry(): Telemetry;
  onTelemetry(listener: (t: Telemetry) => void): () => void;
  onEvent(listener: (e: DriverEvent) => void): () => void;

  uploadMission(mission: UploadedMission): Promise<void>;
  arm(): Promise<void>;
  disarm(): Promise<void>;
  takeoff(altM: number): Promise<void>;
  startMission(): Promise<void>;
  returnToHome(): Promise<void>;
  land(): Promise<void>;
}
