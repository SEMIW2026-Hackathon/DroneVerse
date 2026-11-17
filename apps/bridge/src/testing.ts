// Fixtures for bridge unit tests. Not imported by production code.
import {
  makeProjection,
  type BridgeCommand,
  type FlightConfig,
  type FlightEvent,
  type LonLat,
  type UploadedMission,
} from '@droneverse/shared';
import { SimDriver } from './drivers/SimDriver.js';
import { FlightController, type SequenceStep } from './flight/FlightController.js';

export const HOME: LonLat = { lon: 36.8, lat: -1.3 };
export const MISSION_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_MISSION_ID = '22222222-2222-4222-8222-222222222222';

/** A small survey: 100 m north of the pad, then a 300 x 50 m lawnmower at 50 m altitude. */
export function makeMission(over: Partial<UploadedMission> = {}): UploadedMission {
  const proj = makeProjection(HOME);
  const metres: [number, number][] = [
    [0, 100],
    [300, 100],
    [300, 150],
    [0, 150],
  ];
  return {
    missionId: MISSION_ID,
    drone: { id: 'sparrow-s4', name: 'Sparrow S4', rotors: 4, maxFlightMin: 28, topSpeedKmh: 54 },
    waypoints: metres.map(([x, y]) => ({ ...proj.toLonLat({ x, y }), altM: 50 })),
    speedKmh: 36, // 10 m/s
    altitudeM: 50,
    home: HOME,
    windKmh: 0,
    requiredBatteryPct: 60,
    ...over,
  };
}

export const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

interface RigOptions {
  steps?: readonly SequenceStep[];
  flight?: FlightConfig;
}

/** A controller wired to a simulator with a fake clock, stepped by hand. */
export function makeRig(options: RigOptions = {}) {
  let nowMs = 1_700_000_000_000;
  const events: FlightEvent[] = [];
  let n = 0;
  const driver = new SimDriver({ now: () => nowMs, flight: options.flight });
  const controller = new FlightController({
    driver,
    now: () => nowMs,
    emit: (e) => events.push(e),
    newId: () => `cmd-${++n}`,
    steps: options.steps,
    flight: options.flight,
  });

  /** Advance the simulation, letting async work finish after each step. */
  async function advance(seconds: number, dt = 0.1) {
    const count = Math.round(seconds / dt);
    for (let i = 0; i < count; i++) {
      nowMs += dt * 1000;
      driver.step(dt);
      await settle();
    }
  }

  /** Advance until `done()` or the time limit; returns whether it finished. */
  async function until(done: () => boolean, maxSeconds = 400, dt = 0.1) {
    for (let t = 0; t < maxSeconds && !done(); t += dt) await advance(dt, dt);
    return done();
  }

  const send = (command: BridgeCommand) => controller.handle(command);
  const phase = () => controller.currentMission()?.phase;
  const phases = () =>
    events.flatMap((e) => (e.type === 'phase' ? [e.phase] : []));
  const sequence = () => events.flatMap((e) => (e.type === 'sequence' ? [e] : []));
  const alerts = () => events.flatMap((e) => (e.type === 'alert' ? [e] : []));
  const lastPhase = () =>
    [...events].reverse().find((e) => e.type === 'phase') as
      | Extract<FlightEvent, { type: 'phase' }>
      | undefined;
  const logSummary = () =>
    controller.log.map((l) => `${l.source}:${l.command}:${l.ok ? 'ok' : 'refused'}`);

  /** Upload the standard mission and let the first telemetry arrive. */
  async function ready(mission = makeMission()) {
    driver.step(0.1);
    const r = await send({ type: 'uploadMission', mission });
    await advance(0.5);
    return r;
  }

  const launch = (over: { acknowledgedSimulated?: boolean; autoSequence?: boolean } = {}) =>
    send({
      type: 'confirmLaunch',
      acknowledgedSimulated: true,
      areaClear: true,
      autoSequence: true,
      ...over,
    });

  const sim = (control: Parameters<NonNullable<typeof driver.sim>['apply']>[0]) =>
    send({ type: 'simControl', control });

  return {
    driver,
    controller,
    events,
    advance,
    until,
    send,
    phase,
    phases,
    sequence,
    alerts,
    lastPhase,
    logSummary,
    ready,
    launch,
    sim,
    skipClock: (ms: number) => void (nowMs += ms),
    nowMs: () => nowMs,
  };
}
