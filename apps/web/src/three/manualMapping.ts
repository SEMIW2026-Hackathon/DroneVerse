export interface ManualInput {
  forward: number;
  right: number;
  vertical: number;
  yawRate: number;
  durationMs: number;
}

export const MANUAL_INPUT_TIMEOUT_MS = 300;
export const MANUAL_INPUT_RAMP_MS = 200;

export function rampInput(current: number, target: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return current;
  const amount = Math.min(1, elapsedMs / MANUAL_INPUT_RAMP_MS);
  return current + (target - current) * amount;
}

export function clearManualInput(keys: Set<string>, joystick: { forward: number; right: number; vertical: number; yawRate: number }) {
  keys.clear();
  joystick.forward = 0;
  joystick.right = 0;
  joystick.vertical = 0;
  joystick.yawRate = 0;
}

export function readManualKeys(keys: ReadonlySet<string>): Omit<ManualInput, 'durationMs'> {
  return {
    forward: Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')),
    right: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
    vertical: Number(keys.has('r')) - Number(keys.has('f')),
    yawRate: Number(keys.has('e')) - Number(keys.has('q')),
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { isContentEditable?: boolean; tagName?: string };
  return Boolean(
    element.isContentEditable ||
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.tagName === 'SELECT',
  );
}
