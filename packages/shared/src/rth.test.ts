import { describe, expect, it } from 'vitest';
import { FLIGHT_CONFIG } from './flightConfig.js';
import { PLAN_CONFIG } from './planConfig.js';
import { returnEnergyPct, shouldReturnHome, type RthInput } from './rth.js';

// Round numbers: 50 km/h top speed x 0.8 = 40 km/h transit = 11.11 m/s; 30 min of flight.
const base: RthInput = {
  batteryPct: 60,
  altM: 60,
  distanceToHomeM: 1000,
  drone: { maxFlightMin: 30, topSpeedKmh: 50 },
  windKmh: 0,
};

const reserve = PLAN_CONFIG.battery.reservePct;
const margin = FLIGHT_CONFIG.rth.marginFactor;

describe('return-to-home energy', () => {
  it('is the cost of flying back plus descending, as a share of the battery', () => {
    // 1000 m / 11.11 m/s = 90 s; 60 m / 2 m/s = 30 s; 120 s = 2 min; 2 / 30 min = 6.667%
    expect(returnEnergyPct(base)).toBeCloseTo(6.667, 2);
  });

  it('grows with distance', () => {
    expect(returnEnergyPct({ ...base, distanceToHomeM: 3000 })).toBeGreaterThan(
      returnEnergyPct(base),
    );
  });

  it('is only the descent when directly above the pad', () => {
    expect(returnEnergyPct({ ...base, distanceToHomeM: 0 })).toBeCloseTo((30 / 60 / 30) * 100, 3);
  });

  it('is zero on the ground at the pad', () => {
    expect(returnEnergyPct({ ...base, distanceToHomeM: 0, altM: 0 })).toBe(0);
  });

  it('costs more in wind', () => {
    const calm = returnEnergyPct(base);
    const windy = returnEnergyPct({ ...base, windKmh: 20 });
    expect(windy / calm).toBeCloseTo(1 + PLAN_CONFIG.battery.windDrainPerKmh * 20, 6);
  });

  it('costs more for a drone with a shorter flight time', () => {
    expect(returnEnergyPct({ ...base, drone: { maxFlightMin: 15, topSpeedKmh: 50 } })).toBeCloseTo(
      returnEnergyPct(base) * 2,
      6,
    );
  });
});

describe('auto return-to-home rule', () => {
  it('threshold is the reserve plus the return energy with the safety margin', () => {
    const d = shouldReturnHome(base);
    expect(d.thresholdPct).toBeCloseTo(reserve + returnEnergyPct(base) * margin, 6);
    expect(d.thresholdPct).toBeGreaterThan(reserve);
  });

  it('does not trigger with plenty of battery', () => {
    expect(shouldReturnHome({ ...base, batteryPct: 80 }).returnNow).toBe(false);
  });

  it('triggers once the battery reaches the threshold, and not a hair before', () => {
    const { thresholdPct } = shouldReturnHome(base);
    expect(shouldReturnHome({ ...base, batteryPct: thresholdPct + 0.01 }).returnNow).toBe(false);
    expect(shouldReturnHome({ ...base, batteryPct: thresholdPct }).returnNow).toBe(true);
    expect(shouldReturnHome({ ...base, batteryPct: thresholdPct - 0.01 }).returnNow).toBe(true);
  });

  it('triggers above the bare reserve when the drone is far from the pad', () => {
    const far = { ...base, distanceToHomeM: 4000, batteryPct: reserve + 5 };
    expect(shouldReturnHome(far).returnNow).toBe(true);
    // the same battery is fine when right next to the pad
    expect(shouldReturnHome({ ...far, distanceToHomeM: 0, altM: 0 }).returnNow).toBe(false);
  });

  it('turns back earlier the farther away it is', () => {
    const near = shouldReturnHome({ ...base, distanceToHomeM: 200 }).thresholdPct;
    const far = shouldReturnHome({ ...base, distanceToHomeM: 3000 }).thresholdPct;
    expect(far).toBeGreaterThan(near);
  });

  it('turns back earlier in wind', () => {
    expect(shouldReturnHome({ ...base, windKmh: 30 }).thresholdPct).toBeGreaterThan(
      shouldReturnHome(base).thresholdPct,
    );
  });

  it('always triggers at or below the plain reserve, wherever the drone is', () => {
    expect(
      shouldReturnHome({ ...base, distanceToHomeM: 0, altM: 0, batteryPct: reserve }).returnNow,
    ).toBe(true);
  });

  it('a larger margin makes it return sooner', () => {
    const tight = shouldReturnHome({ ...base, rth: { ...FLIGHT_CONFIG.rth, marginFactor: 1 } });
    const loose = shouldReturnHome({ ...base, rth: { ...FLIGHT_CONFIG.rth, marginFactor: 2 } });
    expect(loose.thresholdPct).toBeGreaterThan(tight.thresholdPct);
  });

  it('reserve comes from the shared config, not a number in this file', () => {
    const custom = { ...PLAN_CONFIG.battery, reservePct: 40 };
    expect(shouldReturnHome({ ...base, battery: custom }).thresholdPct).toBeGreaterThan(40);
  });
});
