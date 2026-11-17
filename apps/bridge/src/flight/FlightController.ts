import { randomUUID } from 'node:crypto';
import {
  FLIGHT_CONFIG,
  PLAN_CONFIG,
  describeFailures,
  evaluatePreflight,
  haversineM,
  makeProjection,
  initialMissionState,
  isTerminalPhase,
  shouldReturnHome,
  transition,
  type BridgeCommand,
  type CommandLogEntry,
  type CommandResult,
  type ConfirmationKind,
  type FlightConfig,
  type FlightEvent,
  type MissionEvent,
  type MissionState,
  type PlanConfig,
  type PreflightResult,
  type Telemetry,
  type UploadedMission,
} from '@droneverse/shared';
import type { DriverEvent, DroneDriver } from '../drivers/DroneDriver.js';

type Source = CommandLogEntry['source'];

/**
 * One step of the launch sequence. A step can demand its own extra confirmation
 * (`confirmation`), which pauses the sequence until the user gives it. Spray or
 * payload release will be added as a step with `confirmation: 'payload'`.
 */
export interface SequenceStep {
  command: 'arm' | 'takeoff' | 'startMission';
  /** Wait for this driver event before moving on to the next step. */
  waitFor?: 'takeoffComplete';
  confirmation?: ConfirmationKind;
}

export const DEFAULT_LAUNCH_STEPS: readonly SequenceStep[] = [
  { command: 'arm' },
  { command: 'takeoff', waitFor: 'takeoffComplete' },
  { command: 'startMission' },
];

export interface FlightControllerOptions {
  driver: DroneDriver;
  now?: () => number;
  emit: (event: FlightEvent) => void;
  flight?: FlightConfig;
  plan?: PlanConfig;
  steps?: readonly SequenceStep[];
  newId?: () => string;
}

interface Authorization {
  expiresAt: number;
  confirmed: Set<ConfirmationKind>;
}

interface Sequence {
  index: number;
  waiting: 'event' | 'confirmation' | null;
  stepStartedAt: number;
  busy: boolean;
}

const message = (err: unknown) => (err instanceof Error ? err.message : 'Command failed');

/**
 * Everything that can make a drone do something goes through here, and nothing else
 * talks to the driver:
 *
 *  - arm / takeoff / startMission need (1) a launch confirmation from the user,
 *    (2) a pre-flight check that passes at that very moment, and (3) a legal phase;
 *  - the launch sequence re-checks before every step and on every telemetry tick,
 *    and stops (disarming on the ground, or flying home in the air) if anything changes;
 *  - return-to-home, land and abort are never blocked by the gate;
 *  - the battery watchdog sends the drone home when it reaches reserve + return energy;
 *  - every command, accepted or refused, is logged with a timestamp.
 */
export class FlightController {
  readonly log: CommandLogEntry[] = [];

  private readonly driver: DroneDriver;
  private readonly now: () => number;
  private readonly emit: (event: FlightEvent) => void;
  private readonly flight: FlightConfig;
  private readonly plan: PlanConfig;
  private readonly steps: readonly SequenceStep[];
  private readonly newId: () => string;

  private mission: UploadedMission | null = null;
  private state: MissionState | null = null;
  private lastTelemetry: Telemetry | null = null;
  private lastTelemetryAt = 0;
  private authorization: Authorization | null = null;
  private sequence: Sequence | null = null;
  private takeoffComplete = false;
  private autoPending = false;

  constructor(opts: FlightControllerOptions) {
    this.driver = opts.driver;
    this.now = opts.now ?? Date.now;
    this.emit = opts.emit;
    this.flight = opts.flight ?? FLIGHT_CONFIG;
    this.plan = opts.plan ?? PLAN_CONFIG;
    this.steps = opts.steps ?? DEFAULT_LAUNCH_STEPS;
    this.newId = opts.newId ?? randomUUID;
    opts.driver.onTelemetry((t) => this.onTelemetry(t));
    opts.driver.onEvent((e) => this.onDriverEvent(e));
  }

  /** The mission the bridge is holding, for the API to recover after a restart. */
  currentMission(): { missionId: string; phase: MissionState['phase'] } | null {
    return this.mission && this.state
      ? { missionId: this.mission.missionId, phase: this.state.phase }
      : null;
  }

  /** Check the gate right now, using the freshest telemetry. */
  preflight(): PreflightResult {
    return evaluatePreflight({
      telemetry: this.lastTelemetry,
      telemetryAgeMs: this.lastTelemetry ? this.now() - this.lastTelemetryAt : Infinity,
      mission: this.mission ? { requiredBatteryPct: this.mission.requiredBatteryPct } : null,
      config: this.flight.preflight,
    });
  }

  /** Handle one command. Always resolves; failures come back as `ok: false`. */
  async handle(command: BridgeCommand, source: Source = 'user'): Promise<CommandResult> {
    let result: CommandResult;
    try {
      result = await this.dispatch(command, source);
    } catch (err) {
      result = { ok: false, error: message(err) };
    }
    this.record(command, source, result);
    return result;
  }

  /** Called regularly (and on every telemetry packet) so a silent drone is noticed. */
  tick(): void {
    this.superviseSequence();
    this.superviseBattery();
  }

  // ---------------- dispatch ----------------

  private async dispatch(command: BridgeCommand, source: Source): Promise<CommandResult> {
    switch (command.type) {
      case 'uploadMission':
        return this.upload(command.mission);
      case 'verifyPreflight':
        return { ok: true, preflight: this.preflight() };
      case 'confirmLaunch':
        return this.confirmLaunch(command.acknowledgedSimulated, command.autoSequence);
      case 'confirm':
        return this.confirmKind(command.kind);
      case 'arm':
      case 'takeoff':
      case 'startMission':
        return this.gated(command.type, source);
      case 'returnToHome':
        return this.returnHome('user-rth');
      case 'land':
        return this.landNow();
      case 'abort':
        return this.abort();
      case 'manualMode':
        return this.enterManualMode();
      case 'simControl':
        if (!this.driver.sim)
          return { ok: false, error: 'Simulator controls need a simulated drone' };
        this.driver.sim.apply(command.control);
        return { ok: true };
      case 'manualControl':
        return this.manualControl(command);
    }
  }

  // ---------------- mission upload ----------------

  private async upload(mission: UploadedMission): Promise<CommandResult> {
    if (this.mission?.missionId === mission.missionId) return { ok: true }; // already loaded
    if (this.state && !isTerminalPhase(this.state.phase)) {
      return { ok: false, error: 'The drone is busy with another mission' };
    }
    await this.driver.uploadMission(mission);
    this.mission = mission;
    this.state = initialMissionState();
    this.authorization = null;
    this.sequence = null;
    this.takeoffComplete = false;
    this.autoPending = false;
    this.emitPhase();
    return this.apply({ type: 'missionUploaded' });
  }

  // ---------------- explicit confirmation and the launch sequence ----------------

  private confirmLaunch(acknowledgedSimulated: boolean, autoSequence: boolean): CommandResult {
    if (!this.state || this.state.phase !== 'preflight') {
      return { ok: false, error: 'Launch is only possible during pre-flight' };
    }
    if (this.driver.simulated && !acknowledgedSimulated) {
      return { ok: false, error: 'Confirm that you understand this drone is simulated' };
    }
    // Checked again here, right now: an earlier pass counts for nothing.
    const preflight = this.preflight();
    if (!preflight.passed) {
      return {
        ok: false,
        error: `Pre-flight check failed: ${describeFailures(preflight)}`,
        preflight,
      };
    }
    this.authorization = {
      expiresAt: this.now() + this.flight.launch.authorizationTtlS * 1000,
      confirmed: new Set<ConfirmationKind>(['launch']),
    };
    if (autoSequence) {
      this.sequence = { index: 0, waiting: null, stepStartedAt: this.now(), busy: false };
      this.emit({ type: 'sequence', status: 'running', at: this.now() });
      void this.advance();
    }
    return { ok: true, preflight };
  }

  private confirmKind(kind: ConfirmationKind): CommandResult {
    if (!this.authorization) return { ok: false, error: 'There is no launch to confirm' };
    this.authorization.confirmed.add(kind);
    if (this.sequence?.waiting === 'confirmation') void this.advance();
    return { ok: true };
  }

  /** Run launch steps one by one. Each is a normal, gated, logged command. */
  private async advance(): Promise<void> {
    const seq = this.sequence;
    if (!seq || seq.busy) return;
    seq.busy = true;
    try {
      while (this.sequence === seq) {
        const step = this.steps[seq.index];
        if (!step) {
          this.sequence = null;
          this.authorization = null;
          this.emit({ type: 'sequence', status: 'completed', at: this.now() });
          return;
        }
        if (step.confirmation && !this.authorization?.confirmed.has(step.confirmation)) {
          seq.waiting = 'confirmation';
          this.emit({
            type: 'sequence',
            status: 'awaiting-confirmation',
            step: step.command,
            reason: `Waiting for your ${step.confirmation} confirmation`,
            at: this.now(),
          });
          return;
        }
        seq.waiting = null;
        seq.stepStartedAt = this.now();
        this.emit({ type: 'sequence', status: 'running', step: step.command, at: this.now() });

        const result = await this.handle({ type: step.command }, 'sequence');
        if (this.sequence !== seq) return; // stopped while that step ran
        if (!result.ok) {
          this.stopSequence(`${step.command} refused: ${result.error}`);
          return;
        }
        if (step.waitFor === 'takeoffComplete' && !this.takeoffComplete) {
          seq.waiting = 'event';
          return;
        }
        seq.index++;
      }
    } finally {
      seq.busy = false;
    }
  }

  /** Gate for the three commands that start a flight. */
  private async gated(
    type: 'arm' | 'takeoff' | 'startMission',
    source: Source,
  ): Promise<CommandResult> {
    const auth = this.authorization;
    if (!auth || this.now() > auth.expiresAt) {
      return { ok: false, error: 'Launch has not been confirmed, or the confirmation expired' };
    }

    if (source === 'user' && this.sequence) {
      return { ok: false, error: 'A launch sequence is already running' };
    }
    const preflight = this.preflight();
    if (!preflight.passed) {
      return {
        ok: false,
        error: `Pre-flight check failed: ${describeFailures(preflight)}`,
        preflight,
      };
    }
    if (!this.state || !this.mission) return { ok: false, error: 'No mission loaded' };

    switch (type) {
      case 'arm': {
        const legal = transition(this.state, { type: 'armed' });
        if (!legal.ok) return { ok: false, error: legal.error };
        await this.driver.arm();
        this.takeoffComplete = false;
        return this.apply({ type: 'armed' });
      }
      case 'takeoff': {
        if (this.state.phase !== 'takeoff') return { ok: false, error: 'Arm the drone first' };
        await this.driver.takeoff(this.mission.altitudeM);
        return { ok: true };
      }
      case 'startMission': {
        if (this.state.phase !== 'takeoff' || !this.takeoffComplete) {
          return { ok: false, error: 'Wait for takeoff to complete' };
        }
        await this.driver.startMission();
        return this.apply({ type: 'airborne' });
      }
    }
  }

  private async manualControl(
    command: Extract<BridgeCommand, { type: 'manualControl' }>,
  ): Promise<CommandResult> {
    if (!this.mission || !this.lastTelemetry || !this.airborne()) {
      return { ok: false, error: 'Take off first: manual flight requires an airborne mission' };
    }
    const telemetry = this.lastTelemetry;
    const distanceToHomeM = haversineM(telemetry.position, this.mission.home);
    const rth = shouldReturnHome({
      batteryPct: telemetry.batteryPct,
      altM: telemetry.position.altM,
      distanceToHomeM,
      drone: this.mission.drone,
      windKmh: this.mission.windKmh,
    });
    if (rth.returnNow) {
      return { ok: false, error: 'Manual flight refused: battery reserve requires return-to-home' };
    }
    if (telemetry.mode !== 'manual') {
      return { ok: false, error: 'Take manual control first' };
    }
    const durationS = command.durationMs / 1000;
    const projection = makeProjection(this.mission.home);
    const current = projection.toXY(telemetry.position);
    const horizontalSpeed = Math.min(
      this.flight.manual.speedMps,
      (this.mission.drone.topSpeedKmh / 3.6) * 0.5,
    );
    const next = {
      x: current.x + command.right * horizontalSpeed * durationS,
      y: current.y + command.forward * horizontalSpeed * durationS,
    };
    if (Math.hypot(next.x, next.y) > this.plan.risk.maxDistanceFromHomeM) {
      return { ok: false, error: 'Manual flight refused: geofence boundary reached' };
    }
    const nextAltitude =
      telemetry.position.altM + command.vertical * this.flight.manual.verticalSpeedMps * durationS;
    if (nextAltitude > this.plan.limits.maxAltitudeM) {
      return { ok: false, error: 'Manual flight refused: altitude ceiling reached' };
    }
    if (nextAltitude < this.flight.launch.groundAltM) {
      return { ok: false, error: 'Manual flight refused: minimum altitude reached' };
    }
    await this.driver.manualControl(command);
    return { ok: true };
  }

  private async enterManualMode(): Promise<CommandResult> {
    if (!this.mission || !this.lastTelemetry || !this.airborne()) {
      return { ok: false, error: 'Take off first: manual flight requires an airborne mission' };
    }
    if (this.lastTelemetry.mode === 'manual') return { ok: true };
    if (this.lastTelemetry.mode !== 'mission') {
      return { ok: false, error: 'Manual control is only available during the mission' };
    }
    await this.driver.enterManualMode();
    return { ok: true };
  }

  // ---------------- safety commands: never gated, never need confirmation ----------------

  private airborne(): boolean {
    return (this.lastTelemetry?.position.altM ?? 0) > this.flight.launch.groundAltM;
  }

  /** Drop the launch confirmation, and tell the UI if a sequence was running. */
  private cancelSequence(reason: string) {
    const wasRunning = this.sequence !== null;
    this.sequence = null;
    this.authorization = null;
    if (wasRunning) this.emit({ type: 'sequence', status: 'aborted', reason, at: this.now() });
  }

  private async returnHome(reason: string): Promise<CommandResult> {
    if (!this.state || isTerminalPhase(this.state.phase))
      return { ok: false, error: 'No active mission' };
    this.cancelSequence('Return home requested');
    const phase = this.state.phase;
    if (!this.airborne()) {
      // On the ground: nothing to fly. Stop any launch in progress and disarm.
      if (phase === 'takeoff') {
        await this.driver.disarm();
        return this.apply({ type: 'disarmed' });
      }
      return { ok: true };
    }
    if (phase === 'returning') return { ok: true }; // already on the way
    await this.driver.returnToHome();
    return this.apply({ type: 'returnHome', reason });
  }

  private async landNow(): Promise<CommandResult> {
    if (!this.state || isTerminalPhase(this.state.phase))
      return { ok: false, error: 'No active mission' };
    if (!this.airborne()) return { ok: false, error: 'The drone is already on the ground' };
    this.cancelSequence('Landing requested');
    await this.driver.land();
    return this.apply({ type: 'landNow', reason: 'user-land' });
  }

  private async abort(): Promise<CommandResult> {
    if (!this.state || isTerminalPhase(this.state.phase))
      return { ok: false, error: 'Nothing to abort' };
    this.cancelSequence('Mission aborted');
    const { phase } = this.state;
    if (phase === 'planned' || phase === 'preflight') {
      return this.apply({ type: 'cancel', reason: 'user-abort' });
    }
    if (phase === 'returning') return this.apply({ type: 'abortRequested', reason: 'user-abort' });
    if (!this.airborne()) {
      await this.driver.disarm();
      return this.apply({ type: 'abortOnGround', reason: 'user-abort' });
    }
    await this.driver.returnToHome(); // an abort in the air brings the drone home
    return this.apply({ type: 'returnHome', reason: 'user-abort' });
  }

  // ---------------- watching the flight ----------------

  private onTelemetry(t: Telemetry) {
    this.lastTelemetry = t;
    this.lastTelemetryAt = this.now();
    this.tick();
  }

  /** While launching, every pre-flight check must keep passing. */
  private superviseSequence() {
    const seq = this.sequence;
    if (!seq) return;
    const preflight = this.preflight();
    if (!preflight.passed) {
      this.stopSequence(`A pre-flight check changed: ${describeFailures(preflight)}`);
      return;
    }
    const timeoutMs = this.flight.launch.stepTimeoutS * 1000;
    if (seq.waiting === 'event' && this.now() - seq.stepStartedAt > timeoutMs) {
      this.stopSequence('Takeoff did not finish in time');
    }
  }

  /**
   * Stop a launch and make the drone safe. On the ground: disarm and go back to
   * pre-flight. In the air: fly home, and the mission ends as aborted.
   */
  private stopSequence(reason: string) {
    if (!this.sequence) return;
    this.cancelSequence(reason);
    this.emit({
      type: 'alert',
      severity: 'critical',
      code: 'launch-stopped',
      message: `Launch stopped: ${reason}`,
      at: this.now(),
    });
    if (!this.state) return;
    const { phase } = this.state;
    if (phase === 'takeoff' && !this.airborne()) {
      void this.auto('disarm', async () => {
        await this.driver.disarm();
        return this.apply({ type: 'disarmed' });
      });
    } else if (phase === 'takeoff' || phase === 'scanning') {
      void this.auto('returnToHome', async () => {
        await this.driver.returnToHome();
        return this.apply({ type: 'returnHome', reason: `launch-stopped: ${reason}` });
      });
    }
  }

  /** Battery watchdog: return home at reserve + the energy needed to get there. */
  private superviseBattery() {
    const t = this.lastTelemetry;
    if (!t || !this.state || !this.mission || this.autoPending) return;
    if (this.state.phase !== 'takeoff' && this.state.phase !== 'scanning') return;
    if (!this.airborne()) return;
    const decision = shouldReturnHome({
      batteryPct: t.batteryPct,
      altM: t.position.altM,
      distanceToHomeM: haversineM(t.position, this.mission.home),
      drone: this.mission.drone,
      windKmh: this.mission.windKmh,
      battery: this.plan.battery,
      rth: this.flight.rth,
    });
    if (!decision.returnNow) return;
    this.cancelSequence('Battery is low');
    this.emit({
      type: 'alert',
      severity: 'warning',
      code: 'low-battery-rth',
      message:
        `Battery is ${Math.round(t.batteryPct)}%, at the ${Math.round(decision.thresholdPct)}% needed to ` +
        'get home safely. Returning home automatically.',
      at: this.now(),
    });
    void this.auto('returnToHome', async () => {
      await this.driver.returnToHome();
      return this.apply({ type: 'returnHome', reason: 'low-battery' });
    });
  }

  private onDriverEvent(e: DriverEvent) {
    switch (e.type) {
      case 'takeoffComplete':
        this.takeoffComplete = true;
        if (this.sequence?.waiting === 'event') {
          this.sequence.index++;
          this.sequence.waiting = null;
          void this.advance();
        }
        break;
      case 'missionComplete':
        if (this.state?.phase !== 'scanning') break;
        this.emit({
          type: 'alert',
          severity: 'info',
          code: 'mission-complete',
          message: 'Survey complete. Returning home.',
          at: this.now(),
        });
        void this.auto('returnToHome', async () => {
          await this.driver.returnToHome();
          return this.apply({ type: 'missionComplete' });
        });
        break;
      case 'touchdown':
        this.sequence = null;
        this.authorization = null;
        if (this.state?.phase === 'returning') this.apply({ type: 'touchdown' });
        break;
      case 'batteryDepleted':
        this.emit({
          type: 'alert',
          severity: 'critical',
          code: 'battery-depleted',
          message: 'Battery is empty. Landing where the drone is.',
          at: this.now(),
        });
        break;
    }
  }

  /** Run a controller-initiated action and log it as an automatic command. */
  private async auto(name: string, action: () => Promise<CommandResult>) {
    this.autoPending = true;
    let result: CommandResult;
    try {
      result = await action();
    } catch (err) {
      result = { ok: false, error: message(err) };
    }
    this.autoPending = false;
    this.pushLog(name, 'auto', result);
  }

  // ---------------- state and logging ----------------

  private apply(event: MissionEvent): CommandResult {
    if (!this.state) return { ok: false, error: 'No mission loaded' };
    const next = transition(this.state, event);
    if (!next.ok) return { ok: false, error: next.error };
    this.state = next.state;
    this.emitPhase();
    return { ok: true };
  }

  private emitPhase() {
    if (!this.state || !this.mission) return;
    this.emit({
      type: 'phase',
      missionId: this.mission.missionId,
      phase: this.state.phase,
      abortReason: this.state.abortReason,
      landInPlace: this.state.landInPlace,
      at: this.now(),
    });
  }

  private record(command: BridgeCommand, source: Source, result: CommandResult) {
    this.pushLog(command.type, source, result);
  }

  private pushLog(command: string, source: Source, result: CommandResult) {
    const at = this.now();
    const entry: CommandLogEntry = {
      id: this.newId(),
      at,
      iso: new Date(at).toISOString(),
      command,
      source,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    };
    this.log.push(entry);
    if (this.log.length > this.flight.command.logSize) this.log.shift();
    this.emit({ type: 'commandLog', entry });
  }
}
