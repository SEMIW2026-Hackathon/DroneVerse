import { describe, expect, it } from 'vitest';
import { PLAN_CONFIG } from '@droneverse/shared';
import type { BatteryEstimate } from './batteryEstimator.js';
import { makeProjection } from './geo.js';
import { runRiskChecks } from './riskChecks.js';
import { ORIGIN, rectM } from './testing.js';

const proj = makeProjection(ORIGIN);
const wp = (x: number, y: number) => ({ ...proj.toLonLat({ x, y }), altM: 60 });

const OK_ESTIMATE: BatteryEstimate = {
  outboundM: 0,
  surveyM: 1000,
  returnM: 500,
  totalM: 1500,
  flightTimeMin: 6,
  batteryUsedPct: 25,
  batteryRemainingPct: 75,
  reservePct: 25,
  exceedsEndurance: false,
  breachesReserve: false,
};

const base = {
  params: { altitudeM: 60, frontOverlapPct: 75, sideOverlapPct: 65, speedKmh: 20 },
  drone: { name: 'Sparrow S4', maxFlightMin: 28, topSpeedKmh: 54 },
  estimate: OK_ESTIMATE,
  waypoints: [wp(0, 0), wp(200, 0)],
  home: proj.toLonLat({ x: 0, y: 0 }),
  windKmh: 5,
  photoSpacingM: 20, // 20 m / 2 s = 36 km/h max
  cfg: PLAN_CONFIG,
};

const codes = (flags: { code: string }[]) => flags.map((f) => f.code);

describe('runRiskChecks', () => {
  it('raises nothing but the regulations reminder for a safe mission', () => {
    const flags = runRiskChecks(base);
    expect(codes(flags)).toEqual(['regulations']);
    expect(flags[0]!.severity).toBe('info');
  });

  describe('battery', () => {
    it('blocks a mission that exceeds the drone’s endurance', () => {
      const flags = runRiskChecks({
        ...base,
        estimate: {
          ...OK_ESTIMATE,
          flightTimeMin: 40,
          batteryUsedPct: 143,
          batteryRemainingPct: -43,
          exceedsEndurance: true,
          breachesReserve: true,
        },
      });
      const f = flags.find((x) => x.code === 'battery-endurance');
      expect(f?.severity).toBe('critical');
      expect(f?.message).toContain('Sparrow S4');
      expect(f?.message).toContain('28 min');
    });

    it('blocks a mission that would land below the reserve', () => {
      const flags = runRiskChecks({
        ...base,
        estimate: {
          ...OK_ESTIMATE,
          batteryUsedPct: 82,
          batteryRemainingPct: 18,
          breachesReserve: true,
        },
      });
      const f = flags.find((x) => x.code === 'battery-reserve');
      expect(f?.severity).toBe('critical');
      expect(f?.message).toContain('18%');
      expect(f?.message).toContain('25%');
      expect(codes(flags)).not.toContain('battery-endurance');
    });

    it('reports only the endurance problem when both apply', () => {
      const flags = runRiskChecks({
        ...base,
        estimate: { ...OK_ESTIMATE, exceedsEndurance: true, breachesReserve: true },
      });
      expect(codes(flags).filter((c) => c.startsWith('battery'))).toEqual(['battery-endurance']);
    });

    it('does not warn when the reserve is exactly kept', () => {
      const flags = runRiskChecks({
        ...base,
        estimate: {
          ...OK_ESTIMATE,
          batteryUsedPct: 75,
          batteryRemainingPct: 25,
          breachesReserve: false,
        },
      });
      expect(codes(flags)).not.toContain('battery-reserve');
    });
  });

  describe('wind', () => {
    it('warns when strong', () => {
      const f = runRiskChecks({ ...base, windKmh: 25 }).find((x) => x.code === 'wind-high');
      expect(f?.severity).toBe('warning');
    });
    it('blocks above the limit', () => {
      const f = runRiskChecks({ ...base, windKmh: 35 }).find((x) => x.code === 'wind-too-high');
      expect(f?.severity).toBe('critical');
    });
  });

  describe('altitude and speed', () => {
    it('blocks above the altitude ceiling', () => {
      const flags = runRiskChecks({ ...base, params: { ...base.params, altitudeM: 130 } });
      expect(flags.find((x) => x.code === 'altitude-too-high')?.severity).toBe('critical');
    });
    it('warns when very low', () => {
      const flags = runRiskChecks({ ...base, params: { ...base.params, altitudeM: 5 } });
      expect(flags.find((x) => x.code === 'altitude-low')?.severity).toBe('warning');
    });
    it('blocks a speed above the drone’s top speed', () => {
      const flags = runRiskChecks({ ...base, params: { ...base.params, speedKmh: 60 } });
      expect(flags.find((x) => x.code === 'speed-over-drone-limit')?.severity).toBe('critical');
    });
    it('warns when the camera cannot keep up with the overlap', () => {
      const flags = runRiskChecks({ ...base, params: { ...base.params, speedKmh: 45 } });
      const f = flags.find((x) => x.code === 'speed-too-fast-for-overlap');
      expect(f?.severity).toBe('warning');
      expect(f?.message).toContain('36 km/h');
    });
  });

  describe('location', () => {
    it('blocks a route inside a no-fly zone', () => {
      const zone = rectM(150, -50, 100, 100); // contains the waypoint at (200, 0)
      const flags = runRiskChecks({ ...base, noFlyZones: [zone] });
      expect(flags.find((x) => x.code === 'no-fly-zone')?.severity).toBe('critical');
    });
    it('ignores a no-fly zone the route does not touch', () => {
      const zone = rectM(5000, 5000, 100, 100);
      expect(codes(runRiskChecks({ ...base, noFlyZones: [zone] }))).not.toContain('no-fly-zone');
    });
    it('warns when the route goes far from the launch point', () => {
      const flags = runRiskChecks({ ...base, waypoints: [wp(0, 0), wp(1500, 0)] });
      expect(flags.find((x) => x.code === 'far-from-home')?.severity).toBe('warning');
    });
    it('warns about too many waypoints', () => {
      const many = Array.from({ length: 501 }, () => wp(10, 10));
      const flags = runRiskChecks({ ...base, waypoints: many });
      expect(codes(flags)).toContain('too-many-waypoints');
    });
  });

  it('lists critical risks first', () => {
    const flags = runRiskChecks({
      ...base,
      windKmh: 25,
      estimate: { ...OK_ESTIMATE, exceedsEndurance: true },
    });
    expect(flags.map((f) => f.severity)).toEqual(['critical', 'warning', 'info']);
  });
});
