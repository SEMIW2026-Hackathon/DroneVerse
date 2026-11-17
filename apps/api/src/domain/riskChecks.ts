import type {
  DroneSpec,
  LonLat,
  PlanConfig,
  Polygon,
  RiskFlag,
  SurveyParams,
  Waypoint,
} from '@droneverse/shared';
import type { BatteryEstimate } from './batteryEstimator.js';
import { haversineM, pointInRings } from './geo.js';

interface Args {
  params: SurveyParams;
  drone: Pick<DroneSpec, 'name' | 'maxFlightMin' | 'topSpeedKmh'>;
  estimate: BatteryEstimate;
  waypoints: Waypoint[];
  home: LonLat;
  windKmh: number;
  photoSpacingM: number;
  noFlyZones?: Polygon[];
  cfg: PlanConfig;
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function inAnyZone(p: LonLat, zones: Polygon[]): boolean {
  return zones.some((z) =>
    pointInRings(
      { x: p.lon, y: p.lat },
      z.coordinates.map((ring) => ring.map(([lon, lat]) => ({ x: lon!, y: lat! }))),
    ),
  );
}

/**
 * Pre-flight planning checks. Anything `critical` blocks launch; `warning` should be
 * read before flying. Messages are written for the farmer, not the pilot.
 */
export function runRiskChecks(a: Args): RiskFlag[] {
  const { params, drone, estimate, waypoints, home, windKmh, cfg } = a;
  const r = cfg.risk;
  const flags: RiskFlag[] = [];

  if (estimate.exceedsEndurance) {
    flags.push({
      code: 'battery-endurance',
      severity: 'critical',
      message:
        `This mission needs about ${round(estimate.flightTimeMin)} min of flying, more than the ` +
        `${drone.name} can do on one battery (${drone.maxFlightMin} min). Pick fewer fields, ` +
        `fly higher, reduce overlap, or choose a longer-endurance drone.`,
    });
  } else if (estimate.breachesReserve) {
    flags.push({
      code: 'battery-reserve',
      severity: 'critical',
      message:
        `The battery would be down to ${round(estimate.batteryRemainingPct)}% on landing, below ` +
        `the ${estimate.reservePct}% safety reserve. The drone would have to return early and ` +
        `leave part of the field unscanned. Shrink the area, fly higher or pick a bigger drone.`,
    });
  }

  if (windKmh > r.windMaxKmh) {
    flags.push({
      code: 'wind-too-high',
      severity: 'critical',
      message: `Wind of ${round(windKmh)} km/h is above the ${r.windMaxKmh} km/h limit. Do not fly.`,
    });
  } else if (windKmh >= r.windWarnKmh) {
    flags.push({
      code: 'wind-high',
      severity: 'warning',
      message: `Wind of ${round(windKmh)} km/h is strong. Battery drains faster and the drone may drift.`,
    });
  }

  if (params.altitudeM > cfg.limits.maxAltitudeM) {
    flags.push({
      code: 'altitude-too-high',
      severity: 'critical',
      message: `${params.altitudeM} m is above the ${cfg.limits.maxAltitudeM} m altitude ceiling.`,
    });
  } else if (params.altitudeM < cfg.limits.minAltitudeM) {
    flags.push({
      code: 'altitude-low',
      severity: 'warning',
      message: `${params.altitudeM} m is very low. Watch for trees, poles and uneven ground.`,
    });
  }

  if (params.speedKmh > drone.topSpeedKmh) {
    flags.push({
      code: 'speed-over-drone-limit',
      severity: 'critical',
      message: `${params.speedKmh} km/h is faster than the ${drone.name}'s top speed (${drone.topSpeedKmh} km/h).`,
    });
  }
  const maxSpeedKmh = (a.photoSpacingM / r.minPhotoIntervalS) * 3.6;
  if (params.speedKmh > maxSpeedKmh) {
    flags.push({
      code: 'speed-too-fast-for-overlap',
      severity: 'warning',
      message:
        `At ${params.speedKmh} km/h the camera cannot take a photo every ${round(a.photoSpacingM, 1)} m, ` +
        `so photos will overlap less than planned. Slow down to about ${round(maxSpeedKmh)} km/h or less.`,
    });
  }

  if (a.noFlyZones?.length) {
    if (inAnyZone(home, a.noFlyZones) || waypoints.some((w) => inAnyZone(w, a.noFlyZones!))) {
      flags.push({
        code: 'no-fly-zone',
        severity: 'critical',
        message: 'Part of this route is inside a no-fly zone.',
      });
    }
  }

  const farthestM = Math.max(0, ...waypoints.map((w) => haversineM(home, w)));
  if (farthestM > r.maxDistanceFromHomeM) {
    flags.push({
      code: 'far-from-home',
      severity: 'warning',
      message:
        `The route goes ${round(farthestM)} m from the launch point. You may lose sight of the ` +
        `drone beyond ${r.maxDistanceFromHomeM} m. Move the launch point closer.`,
    });
  }

  if (waypoints.length > r.maxWaypoints) {
    flags.push({
      code: 'too-many-waypoints',
      severity: 'warning',
      message: `${waypoints.length} waypoints is more than many autopilots accept (${r.maxWaypoints}). Split the mission.`,
    });
  }

  flags.push({
    code: 'regulations',
    severity: 'info',
    message:
      'You are responsible for following local aviation rules and having any required permission to fly here.',
  });

  return flags.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
}
