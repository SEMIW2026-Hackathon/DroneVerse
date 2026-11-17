import { PLAN_CONFIG, type PlanRequest } from '@droneverse/shared';
import type { LngLat } from '../../map/layers';

export interface PlanForm {
  fieldIds: string[];
  droneId: string | null;
  altitudeM: number;
  frontOverlapPct: number;
  sideOverlapPct: number;
  speedKmh: number;
  windKmh: number;
  /** Launch / return point. Null lets the planner pick a corner of the first field. */
  home: LngLat | null;
}

export const DEFAULT_FORM: PlanForm = {
  fieldIds: [],
  droneId: null,
  ...PLAN_CONFIG.defaults,
  home: null,
};

/** Slider ranges. */
export const RANGES = {
  altitudeM: {
    min: PLAN_CONFIG.limits.minAltitudeM,
    max: PLAN_CONFIG.limits.maxAltitudeM,
    step: 5,
  },
  frontOverlapPct: { min: 50, max: 90, step: 5 },
  sideOverlapPct: { min: 40, max: 85, step: 5 },
  speedKmh: { min: 5, max: 60, step: 1 },
  windKmh: { min: 0, max: PLAN_CONFIG.limits.maxWindInputKmh, step: 1 },
} as const;

export function toRequest(form: PlanForm): PlanRequest | null {
  if (!form.droneId || form.fieldIds.length === 0) return null;
  return {
    fieldIds: form.fieldIds,
    droneId: form.droneId,
    params: {
      altitudeM: form.altitudeM,
      frontOverlapPct: form.frontOverlapPct,
      sideOverlapPct: form.sideOverlapPct,
      speedKmh: form.speedKmh,
    },
    windKmh: form.windKmh,
    home: form.home ? { lon: form.home[0], lat: form.home[1] } : undefined,
  };
}
