import { FLIGHT_CONFIG, type FlightConfig } from './flightConfig.js';
import type { Telemetry } from './drone.js';

export type PreflightCheckId = 'telemetry' | 'battery' | 'motors' | 'gps' | 'link' | 'mission';

export interface PreflightCheck {
  id: PreflightCheckId;
  label: string;
  passed: boolean;
  /** Plain-language result, e.g. "92% (need 87%)". */
  detail: string;
}

export interface PreflightResult {
  /** True only when every single check passed. */
  passed: boolean;
  checks: PreflightCheck[];
}

export interface PreflightInput {
  /** Latest telemetry, or null when none has arrived. */
  telemetry: Telemetry | null;
  /** How old that telemetry is, measured on the receiver's own clock. */
  telemetryAgeMs: number;
  /** The loaded mission, or null when none is uploaded. */
  mission: { requiredBatteryPct: number } | null;
  config?: FlightConfig['preflight'];
}

/**
 * The pre-flight gate. Pure and deterministic: the web app runs it to show the
 * checklist, and the bridge runs the same code as the authoritative gate before
 * arming, before every launch step, and on every telemetry tick during launch.
 */
export function evaluatePreflight(input: PreflightInput): PreflightResult {
  const cfg = input.config ?? FLIGHT_CONFIG.preflight;
  const { telemetry: t, mission } = input;
  const checks: PreflightCheck[] = [];

  const fresh = t !== null && input.telemetryAgeMs <= cfg.maxTelemetryAgeMs;
  checks.push({
    id: 'telemetry',
    label: 'Live data from the drone',
    passed: fresh,
    detail: t === null ? 'No data received' : fresh ? 'Receiving' : 'Data is stale',
  });

  // Everything below needs fresh telemetry; without it these checks fail.
  const data = fresh ? t : null;
  const none = 'No data';

  const need = Math.min(
    100,
    Math.ceil(Math.max(cfg.minBatteryPct, mission?.requiredBatteryPct ?? 0)),
  );
  checks.push({
    id: 'battery',
    label: 'Battery',
    passed: data !== null && data.batteryPct >= need,
    detail: data ? `${Math.floor(data.batteryPct)}% (need ${need}%)` : none,
  });

  const bad = data ? data.motorsOk.flatMap((ok, i) => (ok ? [] : [i + 1])) : [];
  checks.push({
    id: 'motors',
    label: 'Motors and propellers',
    passed: data !== null && data.motorsOk.length > 0 && bad.length === 0,
    detail: !data
      ? none
      : data.motorsOk.length === 0
        ? 'No motor data'
        : bad.length === 0
          ? `All ${data.motorsOk.length} OK`
          : `Fault on motor ${bad.join(', ')}`,
  });

  checks.push({
    id: 'gps',
    label: 'GPS lock',
    passed: data !== null && data.gpsSats >= cfg.minGpsSats,
    detail: data ? `${data.gpsSats} satellites (need ${cfg.minGpsSats})` : none,
  });

  checks.push({
    id: 'link',
    label: 'Radio link',
    passed: data !== null && data.linkQuality >= cfg.minLinkQuality,
    detail: data ? `${Math.round(data.linkQuality)}% (need ${cfg.minLinkQuality}%)` : none,
  });

  checks.push({
    id: 'mission',
    label: 'Mission loaded',
    passed: mission !== null,
    detail: mission ? 'Uploaded to the drone' : 'No mission uploaded',
  });

  return { passed: checks.every((c) => c.passed), checks };
}

/** Failing checks as one readable sentence, for logs and error messages. */
export function describeFailures(result: PreflightResult): string {
  return result.checks
    .filter((c) => !c.passed)
    .map((c) => `${c.label}: ${c.detail}`)
    .join('; ');
}
