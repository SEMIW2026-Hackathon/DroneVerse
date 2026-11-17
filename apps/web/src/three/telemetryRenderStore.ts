import type { Telemetry } from '@droneverse/shared';

export interface RenderTelemetry {
  position: Telemetry['position'];
  velocity: Telemetry['velocity'];
  headingDeg: number;
  mode: Telemetry['mode'];
  speedKmh: number;
  batteryPct: number;
  t: number;
}

interface Sample {
  telemetry: Telemetry;
  arrivalMs: number;
}

const samples: Sample[] = [];
let clockOffsetMs: number | null = null;
let averageIntervalMs = 150;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const angleLerp = (a: number, b: number, amount: number) => {
  const delta = ((b - a + 540) % 360) - 180;
  return a + delta * amount;
};

export function pushRenderTelemetry(telemetry: Telemetry, arrivalMs = performance.now()): void {
  const previous = samples[samples.length - 1]?.telemetry;
  if (previous) {
    const interval = telemetry.t - previous.t;
    if (interval > 0 && interval < 2_000) averageIntervalMs = averageIntervalMs * 0.9 + interval * 0.1;
  }
  const offset = arrivalMs - telemetry.t;
  clockOffsetMs = clockOffsetMs === null ? offset : Math.min(clockOffsetMs, offset);
  samples.push({ telemetry, arrivalMs });
  if (samples.length > 10) samples.shift();
}

export function renderDelayMs(): number {
  return clamp(averageIntervalMs * 2, 200, 350);
}

export function getRenderTelemetry(nowMs = performance.now()): RenderTelemetry | null {
  const first = samples[0]?.telemetry;
  if (!first || clockOffsetMs === null) return null;
  const renderTime = nowMs - clockOffsetMs - renderDelayMs();
  let before = samples[0]!;
  let after = samples[samples.length - 1]!;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index]!.telemetry.t >= renderTime) {
      before = samples[index - 1]!;
      after = samples[index]!;
      break;
    }
  }
  const a = before.telemetry;
  const b = after.telemetry;
  if (a.t === b.t || renderTime <= a.t) return toRenderTelemetry(a);
  if (renderTime > b.t) {
    const age = Math.min(100, Math.max(0, renderTime - b.t)) / 1000;
    return extrapolate(b, age);
  }
  const amount = (renderTime - a.t) / (b.t - a.t);
  return {
    position: {
      lat: lerp(a.position.lat, b.position.lat, amount),
      lon: lerp(a.position.lon, b.position.lon, amount),
      altM: lerp(a.position.altM, b.position.altM, amount),
    },
    velocity: {
      eastMps: lerp(a.velocity.eastMps, b.velocity.eastMps, amount),
      northMps: lerp(a.velocity.northMps, b.velocity.northMps, amount),
      upMps: lerp(a.velocity.upMps, b.velocity.upMps, amount),
      yawRateDegPerSec: lerp(a.velocity.yawRateDegPerSec, b.velocity.yawRateDegPerSec, amount),
    },
    headingDeg: angleLerp(a.headingDeg, b.headingDeg, amount),
    mode: amount < 0.5 ? a.mode : b.mode,
    speedKmh: lerp(a.speedKmh, b.speedKmh, amount),
    batteryPct: lerp(a.batteryPct, b.batteryPct, amount),
    t: renderTime,
  };
}

function toRenderTelemetry(telemetry: Telemetry): RenderTelemetry {
  return { ...telemetry, t: telemetry.t };
}

function extrapolate(telemetry: Telemetry, ageS: number): RenderTelemetry {
  return {
    ...toRenderTelemetry(telemetry),
    position: {
      lat: telemetry.position.lat + (telemetry.velocity.northMps * ageS) / 110_540,
      lon: telemetry.position.lon + telemetry.velocity.eastMps * ageS / (111_320 * Math.cos(telemetry.position.lat * Math.PI / 180)),
      altM: Math.max(0, telemetry.position.altM + telemetry.velocity.upMps * ageS),
    },
    headingDeg: telemetry.headingDeg + telemetry.velocity.yawRateDegPerSec * ageS,
  };
}

export function getRenderBufferStats() {
  return { depth: samples.length, averageIntervalMs, delayMs: renderDelayMs() };
}

export function resetRenderTelemetry(): void {
  samples.length = 0;
  clockOffsetMs = null;
  averageIntervalMs = 150;
}
