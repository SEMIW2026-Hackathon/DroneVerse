import { describe, expect, it } from 'vitest';
import { clearManualInput, isTypingTarget, rampInput, readManualKeys } from './manualMapping';

describe('manual input mapping', () => {
  it('maps keyboard controls to velocity and yaw setpoints', () => {
    expect(readManualKeys(new Set(['w', 'd', 'e', 'r']))).toEqual({
      forward: 1,
      right: 1,
      vertical: 1,
      yawRate: 1,
    });

    expect(readManualKeys(new Set(['arrowdown', 'arrowleft', 'q', 'f']))).toEqual({
      forward: -1,
      right: -1,
      vertical: -1,
      yawRate: -1,
    });

  });

  it('ramps a tap and clears held input safely', () => {
    expect(rampInput(0, 1, 50)).toBeCloseTo(0.25);
    const keys = new Set(['w', 'q']);
    const joystick = { forward: 1, right: 0.5, vertical: 0, yawRate: 0 };
    clearManualInput(keys, joystick);
    expect(keys.size).toBe(0);
    expect(joystick).toEqual({ forward: 0, right: 0, vertical: 0, yawRate: 0 });
  });

  it('does not treat form controls as flight input targets', () => {
    const input = Object.assign(new EventTarget(), { tagName: 'INPUT' });
    const div = Object.assign(new EventTarget(), { isContentEditable: true });
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(div)).toBe(true);
    expect(isTypingTarget(Object.assign(new EventTarget(), { tagName: 'DIV' }))).toBe(false);
  });
});
