import type { DroneSpec } from './drone.js';
import { FLIGHT_CONFIG, type FlightConfig } from './flightConfig.js';
import { PLAN_CONFIG, type PlanConfig } from './planConfig.js';

export interface RthInput {
  batteryPct: number;
  altM: number;
  /** Straight-line distance from the drone to its launch pad. */
  distanceToHomeM: number;
  drone: Pick<DroneSpec, 'maxFlightMin' | 'topSpeedKmh'>;
  windKmh: number;
  battery?: PlanConfig['battery'];
  rth?: FlightConfig['rth'];
}

export interface RthDecision {
  /** True when the drone must turn back now. */
  returnNow: boolean;
  /** Battery needed just to get home and land, before the reserve and margin. */
  returnEnergyPct: number;
  /** Battery level at or below which the drone returns: reserve + energy x margin. */
  thresholdPct: number;
}

/** Percent of a full battery used flying home at transit speed and descending to the pad. */
export function returnEnergyPct(input: RthInput): number {
  const b = input.battery ?? PLAN_CONFIG.battery;
  const r = input.rth ?? FLIGHT_CONFIG.rth;
  const transitMps = (input.drone.topSpeedKmh * b.transitSpeedFraction) / 3.6;
  const minutes =
    input.distanceToHomeM / transitMps / 60 + Math.max(0, input.altM) / r.descentRateMps / 60;
  const pctPerMin = (100 / input.drone.maxFlightMin) * (1 + b.windDrainPerKmh * input.windKmh);
  return minutes * pctPerMin;
}

/**
 * Auto return-to-home rule: go home once the battery is down to the safety reserve
 * plus what the trip back will cost (with a margin for wind and estimation error).
 */
export function shouldReturnHome(input: RthInput): RthDecision {
  const b = input.battery ?? PLAN_CONFIG.battery;
  const r = input.rth ?? FLIGHT_CONFIG.rth;
  const energy = returnEnergyPct(input);
  const thresholdPct = b.reservePct + energy * r.marginFactor;
  return { returnNow: input.batteryPct <= thresholdPct, returnEnergyPct: energy, thresholdPct };
}
