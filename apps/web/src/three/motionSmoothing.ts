import * as THREE from 'three';

export interface MotionSample {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  yawRate: number;
  atMs: number;
}

export interface RenderMotion {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  mode: string;
  speedKmh: number;
  altitudeM: number;
}

export function predictMotion(sample: MotionSample, nowMs: number, maxPredictionS = 0.3) {
  const ageS = Math.max(0, Math.min(maxPredictionS, (nowMs - sample.atMs) / 1000));
  return {
    position: sample.position.clone().addScaledVector(sample.velocity, ageS),
    heading: sample.heading + sample.yawRate * ageS,
  };
}

export function dampVector(current: THREE.Vector3, target: THREE.Vector3, lambda: number, delta: number) {
  current.lerp(target, 1 - Math.exp(-lambda * delta));
}
