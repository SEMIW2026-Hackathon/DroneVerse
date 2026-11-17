/**
 * Tunable numbers for mission planning. Nothing in the planner hard-codes these.
 * Values marked PLACEHOLDER are reasonable guesses, to be replaced with measured
 * numbers for the real drones (see docs/hardware.md).
 */
export interface PlanConfig {
  limits: {
    minAltitudeM: number;
    /** Many regions cap drone altitude at 120 m; check local rules. */
    maxAltitudeM: number;
    maxWindInputKmh: number;
    /** The planner refuses fields larger than this; it is almost always a drawing mistake. */
    maxFieldHa: number;
  };
  camera: {
    /** Horizontal field of view. PLACEHOLDER. */
    hFovDeg: number;
    /** Sensor height / width. Photos are taken with the long side across the flight line. */
    aspect: number;
  };
  survey: {
    /** Sweep angles tried when auto-choosing a direction. */
    angleStepDeg: number;
    /** Guard against absurd inputs (tiny spacing over a huge field). */
    maxLines: number;
  };
  battery: {
    /** Battery that must still be left when the drone lands. */
    reservePct: number;
    /** Fixed time for arming, takeoff and landing. PLACEHOLDER. */
    takeoffLandingMin: number;
    climbRateMps: number;
    /** Climbing drains faster than cruising. PLACEHOLDER. */
    climbDrainFactor: number;
    /** Extra drain per km/h of wind. PLACEHOLDER. */
    windDrainPerKmh: number;
    /** Transit legs fly at this fraction of the drone's top speed. */
    transitSpeedFraction: number;
  };
  risk: {
    windWarnKmh: number;
    windMaxKmh: number;
    /** The camera cannot shoot faster than this. PLACEHOLDER. */
    minPhotoIntervalS: number;
    /** Beyond this the pilot may lose sight of the drone. */
    maxDistanceFromHomeM: number;
    maxWaypoints: number;
  };
  defaults: {
    altitudeM: number;
    frontOverlapPct: number;
    sideOverlapPct: number;
    speedKmh: number;
    windKmh: number;
  };
}

export const PLAN_CONFIG: PlanConfig = {
  limits: { minAltitudeM: 10, maxAltitudeM: 120, maxWindInputKmh: 80, maxFieldHa: 5000 },
  camera: { hFovDeg: 74, aspect: 3 / 4 },
  survey: { angleStepDeg: 5, maxLines: 2000 },
  battery: {
    reservePct: 25,
    takeoffLandingMin: 1.5,
    climbRateMps: 3,
    climbDrainFactor: 1.3,
    windDrainPerKmh: 0.01,
    transitSpeedFraction: 0.8,
  },
  risk: {
    windWarnKmh: 20,
    windMaxKmh: 30,
    minPhotoIntervalS: 2,
    maxDistanceFromHomeM: 1000,
    maxWaypoints: 500,
  },
  defaults: {
    altitudeM: 60,
    frontOverlapPct: 75,
    sideOverlapPct: 65,
    speedKmh: 25,
    windKmh: 0,
  },
};
