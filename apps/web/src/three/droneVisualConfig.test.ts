import { describe, expect, it } from 'vitest';
import { getDroneVisualConfig } from './droneVisualConfig';

describe('procedural drone visual config', () => {
  it('uses the specified Kestrel and Condor colors', () => {
    expect(getDroneVisualConfig({ id: 'kestrel-h6', accentColor: '#ffffff' })).toMatchObject({
      shell: '#2b2f36',
      accent: '#f28c28',
    });
    expect(getDroneVisualConfig({ id: 'condor-x8', accentColor: '#ffffff' })).toMatchObject({
      shell: '#f2b400',
      accent: '#2f6fed',
    });
  });

  it('keeps Sparrow smallest, Kestrel medium, and Condor largest', () => {
    const sparrow = getDroneVisualConfig({ id: 'sparrow-s4', accentColor: '#ffffff' }).scale;
    const kestrel = getDroneVisualConfig({ id: 'kestrel-h6', accentColor: '#ffffff' }).scale;
    const condor = getDroneVisualConfig({ id: 'condor-x8', accentColor: '#ffffff' }).scale;
    expect(sparrow).toBeLessThan(kestrel);
    expect(kestrel).toBeLessThan(condor);
  });
});
