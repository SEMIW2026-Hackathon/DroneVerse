import { describe, expect, it } from 'vitest';
import { PLAN_CONFIG } from '@droneverse/shared';
import { planMission } from './planMission.js';
import { PlanError } from './surveyPlanner.js';
import { rectM } from './testing.js';

const drone = { name: 'Sparrow S4', maxFlightMin: 28, topSpeedKmh: 54, cameraMP: 20 };
const params = {
  altitudeM: PLAN_CONFIG.defaults.altitudeM,
  frontOverlapPct: PLAN_CONFIG.defaults.frontOverlapPct,
  sideOverlapPct: PLAN_CONFIG.defaults.sideOverlapPct,
  speedKmh: PLAN_CONFIG.defaults.speedKmh,
};

const plan = (sizeM: number, over = {}) =>
  planMission({
    fields: [{ id: 'f', boundary: rectM(0, 0, sizeM, sizeM) }],
    drone,
    params,
    windKmh: 0,
    cfg: PLAN_CONFIG,
    ...over,
  });

describe('planMission', () => {
  it('approves a small field', () => {
    const r = plan(150);
    expect(r.canLaunch).toBe(true);
    expect(r.risks.map((x) => x.severity)).not.toContain('critical');
    expect(r.stats.batteryRemainingPct).toBeGreaterThan(PLAN_CONFIG.battery.reservePct);
    expect(r.stats.areaHa).toBeCloseTo(2.25, 1);
    expect(r.stats.photoCount).toBeGreaterThan(0);
  });

  it('blocks a field too big for the drone’s endurance', () => {
    const r = plan(2500); // ~625 ha
    expect(r.canLaunch).toBe(false);
    expect(r.risks.some((x) => x.code === 'battery-endurance' && x.severity === 'critical')).toBe(
      true,
    );
    expect(r.stats.batteryUsedPct).toBeGreaterThan(100);
  });

  it('blocks a field that fits the battery but not the 25% reserve', () => {
    let found = false;
    for (let size = 100; size <= 2000 && !found; size += 25) {
      const r = plan(size);
      const used = r.stats.batteryUsedPct;
      if (used > 100 - PLAN_CONFIG.battery.reservePct && used <= 100) {
        found = true;
        expect(r.canLaunch).toBe(false);
        expect(r.risks.some((x) => x.code === 'battery-reserve')).toBe(true);
        expect(r.risks.some((x) => x.code === 'battery-endurance')).toBe(false);
      }
    }
    expect(found).toBe(true);
  });

  it('needs more battery for bigger fields', () => {
    expect(plan(300).stats.batteryUsedPct).toBeGreaterThan(plan(150).stats.batteryUsedPct);
  });

  it('a longer-endurance drone can fly what a short one cannot', () => {
    const big = { ...drone, name: 'Condor X8', maxFlightMin: 50 };
    expect(plan(600).canLaunch).toBe(false);
    expect(plan(600, { drone: big }).stats.batteryUsedPct).toBeLessThan(
      plan(600).stats.batteryUsedPct,
    );
  });

  it('wind costs battery and can block the flight', () => {
    expect(plan(150, { windKmh: 25 }).stats.batteryUsedPct).toBeGreaterThan(
      plan(150).stats.batteryUsedPct,
    );
    expect(plan(150, { windKmh: 40 }).canLaunch).toBe(false);
  });

  it('plans several irregular fields together', () => {
    const r = planMission({
      fields: [
        { id: 'a', boundary: rectM(0, 0, 120, 80) },
        { id: 'b', boundary: rectM(250, 0, 100, 100) },
      ],
      drone,
      params,
      windKmh: 0,
      cfg: PLAN_CONFIG,
    });
    expect(r.fields).toHaveLength(2);
    expect(r.stats.areaHa).toBeCloseTo(0.96 + 1.0, 1);
  });
});

describe('planMission: unrealistically large fields', () => {
  // The "north wheat" boundary that was actually drawn: roughly 148 km x 107 km.
  const northWheat = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [37.333975042, 3.85373731],
        [38.365421771, 4.123625156],
        [38.669783101, 3.161772892],
        [37.333975042, 3.85373731],
      ],
    ],
  };
  const run = (fields: { id: string; name?: string; boundary: typeof northWheat }[]) =>
    planMission({ fields, drone, params, windKmh: 0, cfg: PLAN_CONFIG });

  it('refuses it, naming the field and its size', () => {
    expect(() => run([{ id: 'nw', name: 'north wheat', boundary: northWheat }])).toThrow(
      /"north wheat" is 6\d\d,\d{3} ha, over the 5,000 ha planning limit/,
    );
  });

  it('refuses it as a PlanError so the API answers 400', () => {
    expect(() => run([{ id: 'nw', boundary: northWheat }])).toThrow(PlanError);
  });

  it('refuses the whole plan if any one selected field is too large', () => {
    expect(() =>
      run([
        { id: 'ok', boundary: rectM(0, 0, 100, 100) },
        { id: 'nw', boundary: northWheat },
      ]),
    ).toThrow(PlanError);
  });

  it('accepts a big but plausible field just under the limit', () => {
    // 7 km x 7 km = 4,900 ha: allowed through (it will fail the battery check instead)
    const r = run([{ id: 'big', boundary: rectM(0, 0, 7000, 7000) }]);
    expect(r.stats.areaHa).toBeGreaterThan(4800);
    expect(r.canLaunch).toBe(false);
    expect(r.risks.some((x) => x.code === 'battery-endurance')).toBe(true);
  });

  it('refuses one just over the limit', () => {
    expect(() => run([{ id: 'big', boundary: rectM(0, 0, 7200, 7200) }])).toThrow(/5,000 ha/);
  });
});
