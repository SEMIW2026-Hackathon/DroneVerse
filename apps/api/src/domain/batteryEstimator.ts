import type { DroneSpec, LonLat, PlanConfig, Waypoint } from '@droneverse/shared';
import { haversineM } from './geo.js';

export interface BatteryEstimate {
  outboundM: number;
  surveyM: number;
  returnM: number;
  totalM: number;
  flightTimeMin: number;
  /** Percent of a full battery the whole mission uses, including the trip home. */
  batteryUsedPct: number;
  /** What is left when the drone lands. Negative means it would run out. */
  batteryRemainingPct: number;
  reservePct: number;
  /** The mission needs more than 100% of the battery. */
  exceedsEndurance: boolean;
  /** The mission would land with less than the reserve left. */
  breachesReserve: boolean;
}

interface Args {
  route: Waypoint[];
  home: LonLat;
  speedKmh: number;
  altitudeM: number;
  drone: Pick<DroneSpec, 'maxFlightMin' | 'topSpeedKmh'>;
  windKmh: number;
  cfg: PlanConfig;
}

const kmhToMps = (kmh: number) => kmh / 3.6;

/**
 * Time and battery for: take off at home, climb, fly to the first waypoint, fly the
 * survey route, and come back home. Battery drain is a straight-line model scaled
 * from the drone's rated flight time, with extra drain for wind and for climbing.
 * The reserve (default 25%) must still be left on landing.
 */
export function estimateBattery({
  route,
  home,
  speedKmh,
  altitudeM,
  drone,
  windKmh,
  cfg,
}: Args): BatteryEstimate {
  const b = cfg.battery;
  const reservePct = b.reservePct;

  if (!route.length) {
    return {
      outboundM: 0,
      surveyM: 0,
      returnM: 0,
      totalM: 0,
      flightTimeMin: 0,
      batteryUsedPct: 0,
      batteryRemainingPct: 100,
      reservePct,
      exceedsEndurance: false,
      breachesReserve: false,
    };
  }

  const outboundM = haversineM(home, route[0]!);
  const returnM = haversineM(route[route.length - 1]!, home);
  let surveyM = 0;
  for (let i = 1; i < route.length; i++) surveyM += haversineM(route[i - 1]!, route[i]!);

  const transitMps = kmhToMps(drone.topSpeedKmh * b.transitSpeedFraction);
  const surveyMps = kmhToMps(speedKmh);
  const climbMin = altitudeM / b.climbRateMps / 60;
  const cruiseMin = (outboundM + returnM) / transitMps / 60 + surveyM / surveyMps / 60;
  const flightTimeMin = b.takeoffLandingMin + climbMin + cruiseMin;

  // Climbing counts extra toward drain.
  const drainMinutes = flightTimeMin + climbMin * (b.climbDrainFactor - 1);
  const pctPerMin = (100 / drone.maxFlightMin) * (1 + b.windDrainPerKmh * windKmh);
  const batteryUsedPct = drainMinutes * pctPerMin;

  return {
    outboundM,
    surveyM,
    returnM,
    totalM: outboundM + surveyM + returnM,
    flightTimeMin,
    batteryUsedPct,
    batteryRemainingPct: 100 - batteryUsedPct,
    reservePct,
    exceedsEndurance: batteryUsedPct > 100,
    breachesReserve: batteryUsedPct > 100 - reservePct,
  };
}
