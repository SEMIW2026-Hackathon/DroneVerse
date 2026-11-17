import { describe, expect, it } from 'vitest';
import { FLIGHT_CONFIG, PLAN_CONFIG, haversineM, shouldReturnHome } from '@droneverse/shared';
import { HOME, makeMission, makeRig, OTHER_MISSION_ID, settle } from '../testing.js';

const TERMINAL = ['landed', 'aborted'];
const finished = (r: ReturnType<typeof makeRig>) => () => TERMINAL.includes(r.phase() ?? '');

/** Launch with the usual confirmation and fly until the survey is under way. */
async function airborne(r: ReturnType<typeof makeRig>) {
  await r.ready();
  expect((await r.launch()).ok).toBe(true);
  expect(await r.until(() => r.phase() === 'scanning', 60)).toBe(true);
}

async function manual(r: ReturnType<typeof makeRig>) {
  expect((await r.send({ type: 'manualMode' })).ok).toBe(true);
}

describe('manual flight safety limits', () => {
  it('refuses manual input when the battery reserve requires RTH', async () => {
    const r = makeRig();
    await airborne(r);
    await manual(r);
    await r.sim({ action: 'setBattery', pct: 20 });
    const result = await r.send({
      type: 'manualControl',
      forward: 1,
      right: 0,
      vertical: 0,
      yawRate: 0,
      durationMs: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/battery reserve/);
  });

  it('refuses manual input beyond the geofence', async () => {
    const r = makeRig({
      plan: { ...PLAN_CONFIG, risk: { ...PLAN_CONFIG.risk, maxDistanceFromHomeM: 2 } },
    });
    await airborne(r);
    await manual(r);
    expect(
      (await r.send({ type: 'manualControl', forward: 1, right: 0, vertical: 0, yawRate: 0, durationMs: 100 })).ok,
    ).toBe(true);
    await r.advance(0.2);
    const result = await r.send({
      type: 'manualControl',
      forward: 1,
      right: 0,
      vertical: 0,
      yawRate: 0,
      durationMs: 300,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/geofence/);
  });

  it('refuses manual input above the altitude ceiling', async () => {
    const r = makeRig({
      plan: { ...PLAN_CONFIG, limits: { ...PLAN_CONFIG.limits, maxAltitudeM: 50 } },
    });
    await airborne(r);
    await manual(r);
    const result = await r.send({
      type: 'manualControl',
      forward: 0,
      right: 0,
      vertical: 1,
      yawRate: 0,
      durationMs: 200,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/altitude ceiling/);
  });

  it('refuses setpoints before manual mode is entered', async () => {
    const r = makeRig();
    await airborne(r);
    const result = await r.send({
      type: 'manualControl',
      forward: 1,
      right: 0,
      vertical: 0,
      yawRate: 0,
      durationMs: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/manual control first/);
  });
});

describe('pre-flight gate', () => {
  it('refuses arm, takeoff and startMission with no launch confirmation', async () => {
    const r = makeRig();
    await r.ready();
    for (const type of ['arm', 'takeoff', 'startMission'] as const) {
      const res = await r.send({ type });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not been confirmed/);
    }
    expect(r.driver.telemetry().mode).toBe('disarmed');
    expect(r.phase()).toBe('preflight');
  });

  it('refuses to confirm a launch when any check fails, naming the failure', async () => {
    const r = makeRig();
    await r.ready();
    await r.sim({ action: 'motorFault', index: 2, fault: true });
    const res = await r.launch();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Motors and propellers: Fault on motor 3/);
    expect(res.preflight?.passed).toBe(false);
    expect(r.driver.telemetry().mode).toBe('disarmed');
    expect(r.phase()).toBe('preflight');
    // and arm is still impossible afterwards
    expect((await r.send({ type: 'arm' })).ok).toBe(false);
  });

  it.each([
    ['battery', { action: 'setBattery', pct: 50 } as const, /Battery/],
    ['GPS', { action: 'gpsLoss', on: true } as const, /GPS lock/],
    ['link', { action: 'linkDegraded', on: true } as const, /Radio link/],
    ['motor', { action: 'motorFault', index: 0, fault: true } as const, /Motors/],
  ])('a failing %s check blocks the launch', async (_name, control, pattern) => {
    const r = makeRig();
    await r.ready();
    await r.sim(control);
    const res = await r.launch();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(pattern);
    expect(r.driver.telemetry().mode).toBe('disarmed');
  });

  it('needs a mission uploaded', async () => {
    const r = makeRig();
    r.driver.step(0.1);
    const res = await r.launch();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/only possible during pre-flight/);
  });

  it('needs live data: stale telemetry blocks the launch', async () => {
    const r = makeRig();
    await r.ready();
    r.skipClock(FLIGHT_CONFIG.preflight.maxTelemetryAgeMs + 500); // drone goes quiet
    const res = await r.launch();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Live data from the drone/);
  });

  it('needs the battery the plan asks for, not just the general minimum', async () => {
    const r = makeRig();
    await r.ready(makeMission({ requiredBatteryPct: 99 }));
    await r.sim({ action: 'setBattery', pct: 90 });
    const res = await r.launch();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/need 99%/);
  });

  describe('verify at the moment of confirmation, never trust an earlier pass', () => {
    it('an earlier passing check does not carry over once something changes', async () => {
      const r = makeRig();
      await r.ready();
      const earlier = await r.send({ type: 'verifyPreflight' });
      expect(earlier.preflight?.passed).toBe(true);

      await r.sim({ action: 'setBattery', pct: 50 }); // changes after that pass
      const res = await r.launch();
      expect(res.ok).toBe(false);
      expect(res.preflight?.checks.find((c) => c.id === 'battery')?.passed).toBe(false);
      expect(r.driver.telemetry().mode).toBe('disarmed');
    });

    it('the confirmation result carries the checks as they stood at that moment', async () => {
      const r = makeRig();
      await r.ready();
      const res = await r.launch();
      expect(res.ok).toBe(true);
      expect(res.preflight?.passed).toBe(true);
      expect(res.preflight?.checks).toHaveLength(6);
    });

    it('every launch step re-checks before it runs (manual steps)', async () => {
      const r = makeRig();
      await r.ready();
      expect((await r.launch({ autoSequence: false })).ok).toBe(true);
      await r.sim({ action: 'gpsLoss', on: true }); // changes after the confirmation
      const res = await r.send({ type: 'arm' });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/GPS lock/);
      expect(r.driver.telemetry().mode).toBe('disarmed');
    });
  });

  describe('explicit user action', () => {
    it('a simulated drone cannot be launched without acknowledging it is simulated', async () => {
      const r = makeRig();
      await r.ready();
      const res = await r.launch({ acknowledgedSimulated: false });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/simulated/);
      expect(r.driver.telemetry().mode).toBe('disarmed');
    });

    it('the confirmation expires', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch({ autoSequence: false });
      r.skipClock((FLIGHT_CONFIG.launch.authorizationTtlS + 1) * 1000);
      r.driver.step(0.1); // fresh telemetry, so only the expiry can refuse
      const res = await r.send({ type: 'arm' });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/expired/);
    });

    it('a user cannot arm by hand while the launch sequence is already running', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await settle();
      const res = await r.send({ type: 'arm' });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/already running/);
    });

    it('manual mode: arm, takeoff and start are each separate, gated commands', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch({ autoSequence: false });
      expect((await r.send({ type: 'takeoff' })).ok).toBe(false); // not armed yet
      expect((await r.send({ type: 'arm' })).ok).toBe(true);
      expect(r.phase()).toBe('takeoff');
      expect((await r.send({ type: 'takeoff' })).ok).toBe(true);
      expect((await r.send({ type: 'startMission' })).error).toMatch(/takeoff to complete/);
      await r.until(() => r.driver.telemetry().position.altM >= 49.9, 30);
      expect((await r.send({ type: 'startMission' })).ok).toBe(true);
      expect(r.phase()).toBe('scanning');
    });
  });
});

describe('launch sequence', () => {
  it('runs arm -> takeoff -> start mission, then flies, returns and lands', async () => {
    const r = makeRig();
    await r.ready();
    expect((await r.launch()).ok).toBe(true);
    expect(await r.until(finished(r), 400)).toBe(true);

    expect(r.phases()).toEqual(['planned', 'preflight', 'takeoff', 'scanning', 'returning', 'landed']);
    expect(r.logSummary()).toEqual([
      'user:uploadMission:ok',
      'user:confirmLaunch:ok',
      'sequence:arm:ok',
      'sequence:takeoff:ok',
      'sequence:startMission:ok',
      'auto:returnToHome:ok',
    ]);
    expect(r.sequence().map((e) => e.status)).toContain('completed');
    const t = r.driver.telemetry();
    expect(t.mode).toBe('disarmed');
    expect(t.position.altM).toBe(0);
    expect(t.batteryPct).toBeGreaterThan(PLAN_CONFIG.battery.reservePct);
    expect(r.lastPhase()?.abortReason).toBeNull();
  });

  it('does nothing until takeoff has finished before starting the mission', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    await r.advance(5); // mid-climb
    expect(r.phase()).toBe('takeoff');
    expect(r.logSummary()).not.toContain('sequence:startMission:ok');
    expect(r.sequence().at(-1)).toMatchObject({ status: 'running', step: 'takeoff' });
  });

  describe('if any check changes during the sequence, it stops and says why', () => {
    it('on the ground, right after arming: disarms and returns to pre-flight', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await settle();
      expect(r.driver.telemetry().mode).toBe('takeoff'); // armed, not yet lifted off
      expect(r.driver.telemetry().position.altM).toBe(0);

      await r.sim({ action: 'motorFault', index: 2, fault: true });
      await settle();

      expect(r.driver.telemetry().mode).toBe('disarmed');
      expect(r.phase()).toBe('preflight'); // nothing flew, so it can be fixed and retried
      const stopped = r.sequence().find((e) => e.status === 'aborted');
      expect(stopped?.reason).toMatch(/A pre-flight check changed: Motors and propellers: Fault on motor 3/);
      expect(r.alerts().some((a) => a.code === 'launch-stopped' && a.severity === 'critical')).toBe(true);
      expect(r.logSummary()).toContain('auto:disarm:ok');
      expect(r.sequence().map((e) => e.status)).not.toContain('completed');
    });

    it('in the air: flies home, and the mission ends as aborted with the reason', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await r.advance(5);
      expect(r.driver.telemetry().position.altM).toBeGreaterThan(5);

      await r.sim({ action: 'gpsLoss', on: true });
      await settle();
      expect(r.phase()).toBe('returning');
      expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toMatch(/GPS lock/);

      expect(await r.until(finished(r), 200)).toBe(true);
      expect(r.phase()).toBe('aborted');
      expect(r.lastPhase()?.abortReason).toMatch(/^launch-stopped: .*GPS lock/);
      expect(r.logSummary()).not.toContain('sequence:startMission:ok');
      expect(r.driver.telemetry().position.altM).toBe(0);
    });

    it.each([
      ['link', { action: 'linkDegraded', on: true } as const, /Radio link/],
      ['battery', { action: 'setBattery', pct: 40 } as const, /Battery/],
    ])('a change in %s stops it too', async (_n, control, reason) => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await r.advance(2);
      await r.sim(control);
      await settle();
      expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toMatch(reason);
      expect(r.phase()).toBe('returning');
    });

    it('stops if the drone stops sending data', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await settle();
      r.skipClock(FLIGHT_CONFIG.preflight.maxTelemetryAgeMs + 500); // silence, no new telemetry
      r.controller.tick();
      await settle();
      expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toMatch(/Live data/);
      expect(r.phase()).toBe('preflight');
    });

    it('stops if takeoff never completes', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch();
      await settle();
      // keep telemetry flowing but make the clock jump past the step timeout
      r.skipClock(FLIGHT_CONFIG.launch.stepTimeoutS * 1000 + 1000);
      r.driver.step(0.1);
      await settle();
      expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toMatch(/Takeoff did not finish/);
    });

    it('a step refused by the gate stops the sequence', async () => {
      const r = makeRig();
      await r.ready();
      await r.launch({ autoSequence: false });
      // motor fault after the confirmation, then start a sequence-like arm by hand
      await r.sim({ action: 'motorFault', index: 0, fault: true });
      expect((await r.send({ type: 'arm' })).ok).toBe(false);
      expect(r.phase()).toBe('preflight');
    });
  });

  describe('each step can need its own confirmation (for spray / payload later)', () => {
    const steps = [
      { command: 'arm' },
      { command: 'takeoff', waitFor: 'takeoffComplete' },
      { command: 'startMission', confirmation: 'payload' },
    ] as const;

    it('pauses before that step and does not continue without it', async () => {
      const r = makeRig({ steps });
      await r.ready();
      await r.launch();
      await r.advance(30); // takeoff done
      expect(r.sequence().at(-1)).toMatchObject({ status: 'awaiting-confirmation', step: 'startMission' });
      expect(r.phase()).toBe('takeoff');
      expect(r.driver.telemetry().mode).toBe('takeoff'); // hovering, mission not started
      expect(r.logSummary()).not.toContain('sequence:startMission:ok');
    });

    it('carries on once that separate confirmation is given', async () => {
      const r = makeRig({ steps });
      await r.ready();
      await r.launch();
      await r.advance(30);
      expect((await r.send({ type: 'confirm', kind: 'payload' })).ok).toBe(true);
      await r.advance(1);
      expect(r.phase()).toBe('scanning');
      expect(r.sequence().map((e) => e.status)).toContain('completed');
    });

    it('the launch confirmation does not stand in for the payload one', async () => {
      const r = makeRig({ steps });
      await r.ready();
      await r.launch();
      await r.advance(60);
      expect(r.phase()).toBe('takeoff');
    });

    it('a check failing while paused in the air still stops the launch and flies home', async () => {
      const r = makeRig({ steps });
      await r.ready();
      await r.launch();
      await r.advance(30);
      await r.sim({ action: 'motorFault', index: 1, fault: true });
      await settle();
      expect(r.phase()).toBe('returning');
      expect(await r.until(finished(r), 200)).toBe(true);
      expect(r.phase()).toBe('aborted');
    });

    it('cannot confirm when there is no launch under way', async () => {
      const r = makeRig({ steps });
      await r.ready();
      expect((await r.send({ type: 'confirm', kind: 'payload' })).ok).toBe(false);
    });
  });
});

describe('return to home and abort are always available', () => {
  it('return home is accepted even when every pre-flight check is failing', async () => {
    const r = makeRig();
    await airborne(r);
    await r.sim({ action: 'motorFault', index: 0, fault: true });
    await r.sim({ action: 'gpsLoss', on: true });
    await r.sim({ action: 'linkDegraded', on: true });
    r.skipClock(5000); // and the data is stale
    const res = await r.send({ type: 'returnToHome' });
    expect(res.ok).toBe(true);
    expect(r.phase()).toBe('returning');
    expect(r.driver.telemetry().mode).toBe('rth');
  });

  it('abort and land are also never blocked by the gate', async () => {
    const r = makeRig();
    await airborne(r);
    await r.sim({ action: 'gpsLoss', on: true });
    expect((await r.send({ type: 'land' })).ok).toBe(true);
    expect(r.driver.telemetry().mode).toBe('landing');
    expect((await r.send({ type: 'abort' })).ok).toBe(true);
  });

  it('return home during the launch sequence, in the air: cancels the sequence', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    await r.advance(5);
    const res = await r.send({ type: 'returnToHome' });
    expect(res.ok).toBe(true);
    expect(r.phase()).toBe('returning');
    expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toBe('Return home requested');
    await r.advance(40);
    expect(r.logSummary()).not.toContain('sequence:startMission:ok'); // the sequence did not carry on
    expect(await r.until(finished(r), 200)).toBe(true);
    expect(r.phase()).toBe('aborted');
    expect(r.lastPhase()?.abortReason).toBe('user-rth');
  });

  it('return home during the launch sequence, still on the ground: disarms', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    await settle();
    expect(r.driver.telemetry().mode).toBe('takeoff');
    expect((await r.send({ type: 'returnToHome' })).ok).toBe(true);
    expect(r.driver.telemetry().mode).toBe('disarmed');
    expect(r.phase()).toBe('preflight');
  });

  it('return home before anything is armed is harmless', async () => {
    const r = makeRig();
    await r.ready();
    expect((await r.send({ type: 'returnToHome' })).ok).toBe(true);
    expect(r.phase()).toBe('preflight');
  });

  it('abort in pre-flight ends the mission immediately', async () => {
    const r = makeRig();
    await r.ready();
    expect((await r.send({ type: 'abort' })).ok).toBe(true);
    expect(r.phase()).toBe('aborted');
    expect(r.lastPhase()?.abortReason).toBe('user-abort');
    expect((await r.launch()).ok).toBe(false);
  });

  it('abort while armed on the ground disarms and ends the mission', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    await settle();
    expect((await r.send({ type: 'abort' })).ok).toBe(true);
    expect(r.driver.telemetry().mode).toBe('disarmed');
    expect(r.phase()).toBe('aborted');
    expect(r.sequence().find((e) => e.status === 'aborted')?.reason).toBe('Mission aborted');
  });

  it('abort in the air brings the drone home first, then ends as aborted', async () => {
    const r = makeRig();
    await airborne(r);
    expect((await r.send({ type: 'abort' })).ok).toBe(true);
    expect(r.driver.telemetry().mode).toBe('rth');
    expect(await r.until(finished(r), 300)).toBe(true);
    expect(r.phase()).toBe('aborted');
    expect(r.lastPhase()?.abortReason).toBe('user-abort');
    expect(haversineM(r.driver.telemetry().position, HOME)).toBeLessThan(3);
  });

  it('land now lands in place and ends as aborted; it is refused on the ground', async () => {
    const r = makeRig();
    await r.ready();
    expect((await r.send({ type: 'land' })).error).toMatch(/already on the ground/);
    await airborne(r);
    const here = r.driver.telemetry().position;
    expect((await r.send({ type: 'land' })).ok).toBe(true);
    expect(r.lastPhase()?.landInPlace).toBe(true);
    expect(await r.until(finished(r), 100)).toBe(true);
    expect(r.phase()).toBe('aborted');
    expect(r.lastPhase()?.abortReason).toBe('user-land');
    expect(haversineM(r.driver.telemetry().position, here)).toBeLessThan(1);
  });

  it('they report an error when there is nothing to act on', async () => {
    const r = makeRig();
    expect((await r.send({ type: 'returnToHome' })).ok).toBe(false);
    expect((await r.send({ type: 'abort' })).ok).toBe(false);
  });
});

describe('automatic return-to-home on low battery', () => {
  it('turns the drone around when the battery reaches reserve + the trip back', async () => {
    const r = makeRig();
    await airborne(r);
    await r.advance(20);
    const t = r.driver.telemetry();
    const d = shouldReturnHome({
      batteryPct: t.batteryPct,
      altM: t.position.altM,
      distanceToHomeM: haversineM(t.position, HOME),
      drone: makeMission().drone,
      windKmh: 0,
    });
    expect(d.thresholdPct).toBeGreaterThan(PLAN_CONFIG.battery.reservePct);

    await r.sim({ action: 'setBattery', pct: d.thresholdPct + 2 });
    await r.advance(0.5);
    expect(r.phase()).toBe('scanning'); // still above the line

    await r.sim({ action: 'setBattery', pct: d.thresholdPct - 1 });
    await r.advance(0.5);
    expect(r.phase()).toBe('returning');
    expect(r.driver.telemetry().mode).toBe('rth');
    expect(r.lastPhase()?.abortReason).toBe('low-battery');
    expect(r.logSummary()).toContain('auto:returnToHome:ok');
    const alert = r.alerts().find((a) => a.code === 'low-battery-rth');
    expect(alert?.severity).toBe('warning');
    expect(alert?.message).toMatch(/Returning home automatically/);
  });

  it('can trigger while the battery is still well above the bare reserve', async () => {
    const r = makeRig();
    await airborne(r);
    await r.advance(25);
    const above = PLAN_CONFIG.battery.reservePct + 2.5;
    await r.sim({ action: 'setBattery', pct: above });
    await r.advance(0.5);
    expect(r.phase()).toBe('returning');
  });

  it('triggers once only', async () => {
    const r = makeRig();
    await airborne(r);
    await r.advance(10);
    await r.sim({ action: 'setBattery', pct: 20 });
    await r.advance(20);
    expect(r.logSummary().filter((l) => l === 'auto:returnToHome:ok')).toHaveLength(1);
    expect(r.alerts().filter((a) => a.code === 'low-battery-rth')).toHaveLength(1);
  });

  it('ends the mission as aborted, and the drone still lands with the reserve intact', async () => {
    // a short-endurance drone cannot finish the survey: the watchdog has to cut it short
    const r = makeRig();
    const drone = { id: 'short', name: 'Short', rotors: 4 as const, maxFlightMin: 3, topSpeedKmh: 54 };
    await r.ready(makeMission({ drone, requiredBatteryPct: 0 }));
    await r.sim({ action: 'setBattery', pct: 100 });
    expect((await r.launch()).ok).toBe(true);
    expect(await r.until(finished(r), 400)).toBe(true);
    expect(r.phase()).toBe('aborted');
    expect(r.lastPhase()?.abortReason).toBe('low-battery');
    expect(r.alerts().some((a) => a.code === 'battery-depleted')).toBe(false);
    expect(r.driver.telemetry().batteryPct).toBeGreaterThanOrEqual(PLAN_CONFIG.battery.reservePct);
    expect(r.driver.telemetry().position.altM).toBe(0);
  });

  it('does not trigger while sitting on the ground', async () => {
    const r = makeRig();
    await r.ready();
    await r.sim({ action: 'setBattery', pct: 5 });
    await r.advance(2);
    expect(r.phase()).toBe('preflight');
    expect(r.logSummary()).not.toContain('auto:returnToHome:ok');
  });

  it('does not interfere with a normal survey that has plenty of battery', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    expect(await r.until(finished(r), 400)).toBe(true);
    expect(r.phase()).toBe('landed');
    expect(r.alerts().some((a) => a.code === 'low-battery-rth')).toBe(false);
  });
});

describe('mission upload', () => {
  it('moves planned -> pre-flight', async () => {
    const r = makeRig();
    expect((await r.ready()).ok).toBe(true);
    expect(r.phases()).toEqual(['planned', 'preflight']);
    expect(r.controller.currentMission()).toEqual({ missionId: makeMission().missionId, phase: 'preflight' });
  });

  it('is idempotent for the same mission', async () => {
    const r = makeRig();
    await r.ready();
    expect((await r.send({ type: 'uploadMission', mission: makeMission() })).ok).toBe(true);
    expect(r.phases()).toEqual(['planned', 'preflight']);
  });

  it('refuses a different mission while one is active', async () => {
    const r = makeRig();
    await r.ready();
    const res = await r.send({
      type: 'uploadMission',
      mission: makeMission({ missionId: OTHER_MISSION_ID }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/busy/);
  });

  it('accepts a new mission once the last one has finished', async () => {
    const r = makeRig();
    await r.ready();
    await r.send({ type: 'abort' });
    const res = await r.send({
      type: 'uploadMission',
      mission: makeMission({ missionId: OTHER_MISSION_ID }),
    });
    expect(res.ok).toBe(true);
    expect(r.phase()).toBe('preflight');
    expect(r.controller.currentMission()?.missionId).toBe(OTHER_MISSION_ID);
  });
});

describe('simulator controls', () => {
  it('are refused when the drone is not a simulator', async () => {
    const r = makeRig();
    await r.ready();
    const real = new Proxy(r.driver, { get: (t, p) => (p === 'sim' ? undefined : Reflect.get(t, p, t)) });
    const { FlightController } = await import('./FlightController.js');
    const c = new FlightController({ driver: real, emit: () => {} });
    const res = await c.handle({
      type: 'simControl',
      control: { action: 'gpsLoss', on: true },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/simulated drone/);
  });
});

describe('command log', () => {
  it('records every command, accepted or refused, with a timestamp', async () => {
    const r = makeRig();
    await r.ready();
    const t0 = r.nowMs();
    await r.send({ type: 'arm' }); // refused: no confirmation
    r.skipClock(250);
    await r.send({ type: 'verifyPreflight' });
    r.skipClock(250);
    await r.launch({ acknowledgedSimulated: false }); // refused

    const log = r.controller.log;
    expect(log.map((l) => `${l.command}:${l.ok}`)).toEqual([
      'uploadMission:true',
      'arm:false',
      'verifyPreflight:true',
      'confirmLaunch:false',
    ]);
    const last3 = log.slice(1);
    expect(last3.map((l) => l.at)).toEqual([t0, t0 + 250, t0 + 500]);
    for (const l of log) {
      expect(l.iso).toBe(new Date(l.at).toISOString());
      expect(l.source).toBe('user');
    }
    expect(log[1]!.error).toMatch(/not been confirmed/);
    expect(new Set(log.map((l) => l.id)).size).toBe(log.length);
  });

  it('marks who issued each command: user, launch sequence or automatic', async () => {
    const r = makeRig();
    await r.ready();
    await r.launch();
    await r.until(finished(r), 400);
    const sources = new Map(r.controller.log.map((l) => [l.command, l.source]));
    expect(sources.get('confirmLaunch')).toBe('user');
    expect(sources.get('arm')).toBe('sequence');
    expect(sources.get('takeoff')).toBe('sequence');
    expect(sources.get('startMission')).toBe('sequence');
    expect(sources.get('returnToHome')).toBe('auto');
  });

  it('publishes each entry as an event for the API and the screen', async () => {
    const r = makeRig();
    await r.ready();
    await r.send({ type: 'abort' });
    const entries = r.events.flatMap((e) => (e.type === 'commandLog' ? [e.entry.command] : []));
    expect(entries).toEqual(['uploadMission', 'abort']);
  });

  it('keeps only the most recent entries', async () => {
    const flight = { ...FLIGHT_CONFIG, command: { ...FLIGHT_CONFIG.command, logSize: 3 } };
    const r = makeRig({ flight });
    await r.ready();
    for (let i = 0; i < 5; i++) await r.send({ type: 'verifyPreflight' });
    expect(r.controller.log).toHaveLength(3);
    expect(r.controller.log.every((l) => l.command === 'verifyPreflight')).toBe(true);
  });
});
