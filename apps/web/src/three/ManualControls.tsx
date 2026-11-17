import { useEffect, useRef, useState } from 'react';
import {
  isTypingTarget,
  clearManualInput,
  MANUAL_INPUT_TIMEOUT_MS,
  rampInput,
  readManualKeys,
  type ManualInput,
} from './manualMapping';

interface Props {
  enabled: boolean;
  disabledReason?: string;
  onEnable: () => void;
  onControl: (control: ManualInput) => void;
  onStop: () => void;
}

const neutral: ManualInput = { forward: 0, right: 0, vertical: 0, yawRate: 0, durationMs: MANUAL_INPUT_TIMEOUT_MS };

export function ManualControls({ enabled, disabledReason, onEnable, onControl, onStop }: Props) {
  const keys = useRef(new Set<string>());
  const joystick = useRef<HTMLDivElement>(null);
  const joystickInput = useRef({ forward: 0, right: 0, vertical: 0, yawRate: 0 });
  const output = useRef({ forward: 0, right: 0, vertical: 0, yawRate: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const down = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (!isTypingTarget(event.target)) keys.current.delete(event.key.toLowerCase());
    };
    const clear = () => {
      clearManualInput(keys.current, joystickInput.current);
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      const keysInput = readManualKeys(keys.current);
      const target = {
        ...keysInput,
        forward: keysInput.forward || joystickInput.current.forward,
        right: keysInput.right || joystickInput.current.right,
        vertical: keysInput.vertical || joystickInput.current.vertical,
        yawRate: keysInput.yawRate || joystickInput.current.yawRate,
      };
      const next = {
        forward: rampInput(output.current.forward, target.forward, 50),
        right: rampInput(output.current.right, target.right, 50),
        vertical: rampInput(output.current.vertical, target.vertical, 50),
        yawRate: rampInput(output.current.yawRate, target.yawRate, 50),
      };
      output.current = next;
      onControl({
        ...next,
        durationMs: MANUAL_INPUT_TIMEOUT_MS,
      });
    }, 1000 / 20);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      window.clearInterval(timer);
      clear();
      output.current = { forward: 0, right: 0, vertical: 0, yawRate: 0 };
      onControl(neutral);
    };
  }, [enabled, onControl]);

  function updateJoystick(clientX: number, clientY: number) {
    const bounds = joystick.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = (clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    const y = (clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
    const length = Math.max(1, Math.hypot(x, y));
    joystickInput.current = {
      forward: Math.max(-1, Math.min(1, -y / length)),
      right: Math.max(-1, Math.min(1, x / length)),
      vertical: 0,
      yawRate: 0,
    };
  }

  return (
    <div className={`rounded-2xl bg-slate-950/80 p-3 text-white shadow-lg backdrop-blur ${enabled ? '' : 'opacity-70'}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Fly myself</div>
      <button
        type="button"
        disabled={enabled || disabledReason !== 'Take manual control first'}
        onClick={onEnable}
        className="mb-2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enabled ? 'Manual mode active' : 'Take manual control'}
      </button>
      <button
        type="button"
        disabled={!enabled}
        onClick={onStop}
        className="mb-2 ml-2 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Stop / hover
      </button>
      <div
        ref={joystick}
        onPointerDown={(event) => {
          if (!enabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          updateJoystick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => dragging && updateJoystick(event.clientX, event.clientY)}
        onPointerUp={() => {
          setDragging(false);
          joystickInput.current = { forward: 0, right: 0, vertical: 0, yawRate: 0 };
        }}
        onPointerCancel={() => {
          setDragging(false);
          joystickInput.current = { forward: 0, right: 0, vertical: 0, yawRate: 0 };
        }}
        className="grid h-24 w-24 touch-none place-items-center rounded-full border border-white/30 bg-white/10"
        aria-label="Manual flight joystick"
        aria-disabled={!enabled}
      >
        <span className="h-9 w-9 rounded-full bg-emerald-400/90 shadow" />
      </div>
      <p className="mt-2 text-[10px] text-slate-300">{disabledReason ?? 'WASD / arrows · Q/E yaw · R/F altitude'}</p>
    </div>
  );
}

export type { ManualInput };
