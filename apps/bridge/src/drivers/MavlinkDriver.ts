import type { Telemetry, UploadedMission } from '@droneverse/shared';
import type { DriverEvent, DroneDriver } from './DroneDriver.js';

const notImplemented = (): never => {
  throw new Error('MavlinkDriver: not implemented');
};

/** Placeholder for real PX4 / ArduPilot drones (Phase 5). Every method throws. */
export class MavlinkDriver implements DroneDriver {
  readonly kind = 'mavlink' as const;
  readonly simulated = false;
  info(): { droneName: string; rotors: number } {
    return notImplemented();
  }
  connect(): Promise<void> {
    return notImplemented();
  }
  disconnect(): Promise<void> {
    return notImplemented();
  }
  telemetry(): Telemetry {
    return notImplemented();
  }
  onTelemetry(_listener: (t: Telemetry) => void): () => void {
    return notImplemented();
  }
  onEvent(_listener: (e: DriverEvent) => void): () => void {
    return notImplemented();
  }
  uploadMission(_mission: UploadedMission): Promise<void> {
    return notImplemented();
  }
  arm(): Promise<void> {
    return notImplemented();
  }
  disarm(): Promise<void> {
    return notImplemented();
  }
  takeoff(_altM: number): Promise<void> {
    return notImplemented();
  }
  startMission(): Promise<void> {
    return notImplemented();
  }
  returnToHome(): Promise<void> {
    return notImplemented();
  }
  land(): Promise<void> {
    return notImplemented();
  }
  enterManualMode(): Promise<void> {
    return notImplemented();
  }
  manualControl(_control: {
    forward: number;
    right: number;
    vertical: number;
    yawRate: number;
    durationMs: number;
  }): Promise<void> {
    return notImplemented();
  }
}
