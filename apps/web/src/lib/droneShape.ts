// Layout numbers for the top-down drone illustration (viewBox 0 0 100 100).

export type RotorCount = 4 | 6 | 8;

interface Shape {
  /** Distance from the body centre to each rotor centre. */
  armLength: number;
  rotorRadius: number;
  /** Angle of the first arm in degrees, measured clockwise from "up". */
  startDeg: number;
}

// Rotor size shrinks as the count grows so neighbouring rotors never overlap
// and everything stays inside the 100 x 100 box.
const SHAPES: Record<RotorCount, Shape> = {
  4: { armLength: 34, rotorRadius: 13, startDeg: 45 },
  6: { armLength: 34, rotorRadius: 10, startDeg: 0 },
  8: { armLength: 36, rotorRadius: 8.5, startDeg: 22.5 },
};

export const DRONE_CENTER = 50;

export interface RotorPosition {
  x: number;
  y: number;
  r: number;
}

export function rotorLayout(rotors: RotorCount): RotorPosition[] {
  const { armLength, rotorRadius, startDeg } = SHAPES[rotors];
  return Array.from({ length: rotors }, (_, i) => {
    const angle = ((startDeg + (360 / rotors) * i) * Math.PI) / 180;
    return {
      x: DRONE_CENTER + armLength * Math.sin(angle),
      y: DRONE_CENTER - armLength * Math.cos(angle),
      r: rotorRadius,
    };
  });
}
