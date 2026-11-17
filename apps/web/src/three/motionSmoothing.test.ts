import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { predictMotion } from './motionSmoothing';

describe('motion smoothing', () => {
  it('predicts continuously from the latest position and velocity', () => {
    const sample = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(4, 0, 0),
      heading: 0,
      yawRate: 20,
      atMs: 1_000,
    };
    const a = predictMotion(sample, 1_050);
    const b = predictMotion(sample, 1_060);
    expect(a.position.x).toBeCloseTo(0.2);
    expect(b.position.x - a.position.x).toBeCloseTo(0.04);
    expect(b.heading - a.heading).toBeCloseTo(0.2);
  });

  it('caps prediction age so delayed telemetry cannot cause a jump', () => {
    const result = predictMotion({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(100, 0, 0),
      heading: 0,
      yawRate: 0,
      atMs: 0,
    }, 10_000);
    expect(result.position.x).toBeCloseTo(30);
  });
});
