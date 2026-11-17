import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { rotorLayout, type RotorCount } from '../../lib/droneShape';
import { DroneIllustration } from './DroneIllustration';

const COUNTS: RotorCount[] = [4, 6, 8];

describe('drone illustration', () => {
  it.each(COUNTS)('draws exactly %i rotors', (n) => {
    const svg = renderToStaticMarkup(<DroneIllustration rotors={n} />);
    expect(svg.match(/data-rotor/g)).toHaveLength(n);
    expect(svg).toContain(`${n}-rotor drone`);
  });

  it.each(COUNTS)('keeps %i rotors inside the box and clear of each other', (n) => {
    const rotors = rotorLayout(n);
    for (const r of rotors) {
      expect(r.x - r.r).toBeGreaterThan(0);
      expect(r.x + r.r).toBeLessThan(100);
      expect(r.y - r.r).toBeGreaterThan(0);
      expect(r.y + r.r).toBeLessThan(100);
    }
    for (let i = 0; i < rotors.length; i++) {
      for (let j = i + 1; j < rotors.length; j++) {
        const d = Math.hypot(rotors[i]!.x - rotors[j]!.x, rotors[i]!.y - rotors[j]!.y);
        expect(d).toBeGreaterThan(rotors[i]!.r + rotors[j]!.r);
      }
    }
  });
});
