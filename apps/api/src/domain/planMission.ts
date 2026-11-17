import type {
  DroneSpec,
  LonLat,
  PlanConfig,
  PlanResult,
  Polygon,
  SurveyParams,
} from '@droneverse/shared';
import { polygonAreaHa } from '@droneverse/shared';
import { estimateBattery } from './batteryEstimator.js';
import { runRiskChecks } from './riskChecks.js';
import {
  PlanError,
  footprintM,
  gsdCmPerPx,
  lineSpacingM,
  photoSpacingM,
  planSurvey,
  type SurveyField,
} from './surveyPlanner.js';

export interface PlanInput {
  fields: SurveyField[];
  drone: Pick<DroneSpec, 'name' | 'maxFlightMin' | 'topSpeedKmh' | 'cameraMP'>;
  params: SurveyParams;
  windKmh: number;
  home?: LonLat;
  noFlyZones?: Polygon[];
  cfg: PlanConfig;
}

/** Path + time/battery estimate + risk checks for a survey mission. Pure function. */
export function planMission(input: PlanInput): PlanResult {
  const { fields, drone, params, windKmh, cfg } = input;

  // Refuse absurdly large fields up front. They are almost always a boundary drawn while
  // the map was zoomed far out, and would give a meaningless (or failed) plan.
  const areas = fields.map((f) => polygonAreaHa(f.boundary));
  fields.forEach((f, i) => {
    if (areas[i]! > cfg.limits.maxFieldHa) {
      const name = f.name ? `"${f.name}"` : 'This field';
      const size = Math.round(areas[i]!).toLocaleString('en-US');
      const limit = cfg.limits.maxFieldHa.toLocaleString('en-US');
      throw new PlanError(
        `${name} is ${size} ha, over the ${limit} ha planning limit. Check its boundary: it ` +
          'may have been drawn while the map was zoomed too far out. Delete the field and redraw it closer.',
      );
    }
  });

  const survey = planSurvey(fields, params, cfg, input.home);
  const estimate = estimateBattery({
    route: survey.waypoints,
    home: survey.home,
    speedKmh: params.speedKmh,
    altitudeM: params.altitudeM,
    drone,
    windKmh,
    cfg,
  });

  const photoSpacing = photoSpacingM(params, cfg.camera);
  const risks = runRiskChecks({
    params,
    drone,
    estimate,
    waypoints: survey.waypoints,
    home: survey.home,
    windKmh,
    photoSpacingM: photoSpacing,
    noFlyZones: input.noFlyZones,
    cfg,
  });

  return {
    home: survey.home,
    waypoints: survey.waypoints,
    fields: survey.fields.map(({ fieldId, sweepAngleDeg, lineCount }) => ({
      fieldId,
      sweepAngleDeg,
      lineCount,
    })),
    stats: {
      areaHa: areas.reduce((sum, a) => sum + a, 0),
      waypointCount: survey.waypoints.length,
      totalDistanceM: estimate.totalM,
      surveyDistanceM: estimate.surveyM,
      returnDistanceM: estimate.returnM,
      flightTimeMin: estimate.flightTimeMin,
      batteryUsedPct: estimate.batteryUsedPct,
      batteryRemainingPct: estimate.batteryRemainingPct,
      reservePct: estimate.reservePct,
      photoCount: Math.ceil(survey.surveyLengthM / photoSpacing) + survey.segmentCount,
      lineSpacingM: lineSpacingM(params, cfg.camera),
      photoSpacingM: photoSpacing,
      footprintWidthM: footprintM(params.altitudeM, cfg.camera).widthM,
      gsdCmPerPx: gsdCmPerPx(params, cfg.camera, drone.cameraMP),
    },
    risks,
    canLaunch: !risks.some((r) => r.severity === 'critical'),
  };
}
