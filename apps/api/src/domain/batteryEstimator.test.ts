import { describe, expect, it } from 'vitest';
import { PLAN_CONFIG, type PlanConfig } from '@droneverse/shared';
import { estimateBattery } from './batteryEstimator.js';
import { makeProjection } from './geo.js';
import { ORIGIN } from './testing.js';

// Strip out the fiddly constants so the expected numbers are easy to check by hand.
const CFG: PlanConfig = {
  ...PLAN_CONFIG,
  battery: {
    reservePct: 25,
    takeoffLandingMin: 0,
    climbRateMps: 3,
    climbDrainFactor: 1,
    windDrainPerKmh: 0,
    transitSpeedFraction: 0.8,
  },
};

const proj = makeProjection(ORIGIN);
const at = (x: number, y: number) => ({ ...proj.toLonLat({ x, y }), altM: 60 });

// Home at the start of a 1000 m east-west leg.
const home = proj.toLonLat({ x: 0, y: 0 });
const route = [at(0, 0), at(1000, 0)];

function estimate(
  maxFlightMin: number,
  extra: Partial<Parameters<typeof estimateBattery>[0]> = {},
) {
  return estimateBattery({
    route,
    home,
    speedKmh: 36, // 10 m/s
    altitudeM: 60,
    drone: { maxFlightMin, topSpeedKmh: 50 },
    windKmh: 0,
    cfg: CFG,
    ...extra,
  });
}

describe('estimateBattery', () => {
  // climb 60 m / 3 m/s = 20 s; survey 1000 m / 10 m/s = 100 s; return 1000 m / (40 km/h) = 90 s
  // total 210 s = 3.5 min
  it('adds climb, survey and return-home time', () => {
    const e = estimate(35);
    expect(e.surveyM).toBeCloseTo(1000, 0);
    expect(e.returnM).toBeCloseTo(1000, 0);
    expect(e.flightTimeMin).toBeCloseTo(3.5, 2);
  });

  it('scales battery use from the drone’s rated flight time', () => {
    expect(estimate(35).batteryUsedPct).toBeCloseTo(10, 1); // 3.5 of 35 min
    expect(estimate(7).batteryUsedPct).toBeCloseTo(50, 1);
  });

  it('counts the trip out to the field and the trip home', () => {
    const far = estimate(35, { home: proj.toLonLat({ x: 0, y: 2000 }) });
    expect(far.outboundM).toBeCloseTo(2000, 0);
    expect(far.returnM).toBeCloseTo(Math.hypot(1000, 2000), 0);
    expect(far.batteryUsedPct).toBeGreaterThan(estimate(35).batteryUsedPct);
  });

  it('is fine when there is plenty of battery', () => {
    const e = estimate(35);
    expect(e.exceedsEndurance).toBe(false);
    expect(e.breachesReserve).toBe(false);
    expect(e.batteryRemainingPct).toBeCloseTo(90, 1);
  });

  it('flags a breach of the reserve while still within endurance', () => {
    const e = estimate(4.5); // 3.5 / 4.5 = 77.8% used, only 22% left
    expect(e.batteryUsedPct).toBeGreaterThan(75);
    expect(e.batteryUsedPct).toBeLessThan(100);
    expect(e.breachesReserve).toBe(true);
    expect(e.exceedsEndurance).toBe(false);
    expect(e.reservePct).toBe(25);
  });

  it('flags a mission longer than the drone can fly', () => {
    const e = estimate(3); // needs 3.5 min of a 3 min battery
    expect(e.exceedsEndurance).toBe(true);
    expect(e.breachesReserve).toBe(true);
    expect(e.batteryRemainingPct).toBeLessThan(0);
  });

  it('drains faster in wind', () => {
    const windy = { ...CFG, battery: { ...CFG.battery, windDrainPerKmh: 0.01 } };
    const calm = estimate(35, { cfg: windy, windKmh: 0 }).batteryUsedPct;
    const gale = estimate(35, { cfg: windy, windKmh: 20 }).batteryUsedPct;
    expect(gale / calm).toBeCloseTo(1.2, 3);
  });

  it('charges extra for takeoff/landing and for climbing', () => {
    const real = {
      ...CFG,
      battery: { ...CFG.battery, takeoffLandingMin: 1.5, climbDrainFactor: 2 },
    };
    const e = estimate(35, { cfg: real });
    expect(e.flightTimeMin).toBeCloseTo(5, 2);
    expect(e.batteryUsedPct).toBeGreaterThan((5 / 35) * 100); // climb counted double
  });

  it('returns an empty estimate for an empty route', () => {
    const e = estimate(35, { route: [] });
    expect(e.batteryUsedPct).toBe(0);
    expect(e.breachesReserve).toBe(false);
  });
});
