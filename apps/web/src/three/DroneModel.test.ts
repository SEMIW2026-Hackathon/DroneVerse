import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DroneSpec } from '@droneverse/shared';
import { rotorPositions } from './DroneModel';
import { SPARROW_ROTOR_CENTERS } from './sparrowGeometry';

const spec = (rotors: DroneSpec['rotors']): DroneSpec => ({
  id: `drone-${rotors}`,
  name: `Drone ${rotors}`,
  tagline: 'Test',
  accentColor: '#14b8a6',
  type: 'survey',
  rotors,
  maxFlightMin: 30,
  topSpeedKmh: 50,
  cameraMP: 20,
  sensor: 'rgb',
  driver: 'sim',
  specsArePlaceholder: true,
});

describe('parametric drone model', () => {
  it('uses the selected DroneSpec rotor count', () => {
    expect(rotorPositions(spec(4).rotors)).toHaveLength(4);
    expect(rotorPositions(spec(8).rotors)).toHaveLength(8);
  });

  it('uses four fixed Sparrow rotor centers from the inspected asset', () => {
    expect(SPARROW_ROTOR_CENTERS).toHaveLength(4);
    expect(SPARROW_ROTOR_CENTERS.map((center) => center.x)).toEqual([-0.249, 0.249, -0.249, 0.249]);
    expect(SPARROW_ROTOR_CENTERS.map((center) => center.z)).toEqual([-0.132, -0.132, 0.132, 0.132]);
  });

  it('keeps the optimized Sparrow asset below the 1 MB budget without textures', () => {
    const asset = readFileSync(new URL('../../public/models/sparrow.glb', import.meta.url));
    const jsonLength = asset.readUInt32LE(12);
    const json = JSON.parse(asset.subarray(20, 20 + jsonLength).toString('utf8').trim());
    expect(asset.byteLength).toBeLessThan(1_000_000);
    expect(json.images).toBeUndefined();
    expect(json.textures).toBeUndefined();
  });
});
