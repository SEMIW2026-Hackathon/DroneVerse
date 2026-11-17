import type { z } from 'zod';
import type { flightPhaseSchema } from './flightPhase.js';

/**
 * Flight phases of one mission on the bridge:
 *
 *   planned -> preflight -> takeoff -> scanning -> returning -> landed
 *                                                          \-> aborted
 *
 * `takeoff` covers arming through reaching altitude. A mission that ends early
 * (user return-to-home, low battery, a check failing in the air, landing in place)
 * keeps flying home and finishes as `aborted`, with the reason recorded; only a
 * completed survey finishes as `landed`. `landed` and `aborted` are final.
 */
export type FlightPhase = z.infer<typeof flightPhaseSchema>;

export interface MissionState {
  phase: FlightPhase;
  /** Why the mission is ending early; null for a normal run. */
  abortReason: string | null;
  /** True when the drone is landing where it is instead of flying home. */
  landInPlace: boolean;
}

export type MissionEvent =
  | { type: 'missionUploaded' }
  | { type: 'armed' }
  /** Disarmed again on the ground after a failed launch; back to pre-flight. */
  | { type: 'disarmed' }
  | { type: 'airborne' }
  | { type: 'missionComplete' }
  | { type: 'returnHome'; reason: string }
  | { type: 'landNow'; reason: string }
  | { type: 'touchdown' }
  | { type: 'abortOnGround'; reason: string }
  /** Cancel before the drone has armed. */
  | { type: 'cancel'; reason: string }
  /** Mark a mission that is already returning as aborted. */
  | { type: 'abortRequested'; reason: string };

export type TransitionResult = { ok: true; state: MissionState } | { ok: false; error: string };

export const initialMissionState = (): MissionState => ({
  phase: 'planned',
  abortReason: null,
  landInPlace: false,
});

export const isTerminalPhase = (p: FlightPhase) => p === 'landed' || p === 'aborted';

const bad = (state: MissionState, event: MissionEvent): TransitionResult => ({
  ok: false,
  error: `Cannot ${event.type} while the mission is ${state.phase}`,
});

/** Pure transition function: returns the new state or an error, never throws. */
export function transition(state: MissionState, event: MissionEvent): TransitionResult {
  const { phase } = state;
  const to = (patch: Partial<MissionState>): TransitionResult => ({
    ok: true,
    state: { ...state, ...patch },
  });
  const airborne = phase === 'takeoff' || phase === 'scanning';

  switch (event.type) {
    case 'missionUploaded':
      return phase === 'planned' ? to({ phase: 'preflight' }) : bad(state, event);
    case 'armed':
      return phase === 'preflight' ? to({ phase: 'takeoff' }) : bad(state, event);
    case 'disarmed':
      return phase === 'takeoff' ? to({ phase: 'preflight' }) : bad(state, event);
    case 'airborne':
      return phase === 'takeoff' ? to({ phase: 'scanning' }) : bad(state, event);
    case 'missionComplete':
      return phase === 'scanning' ? to({ phase: 'returning' }) : bad(state, event);
    case 'returnHome':
      return airborne
        ? to({ phase: 'returning', abortReason: state.abortReason ?? event.reason })
        : bad(state, event);
    case 'landNow':
      return airborne || phase === 'returning'
        ? to({
            phase: 'returning',
            abortReason: state.abortReason ?? event.reason,
            landInPlace: true,
          })
        : bad(state, event);
    case 'touchdown':
      return phase === 'returning'
        ? to({ phase: state.abortReason ? 'aborted' : 'landed' })
        : bad(state, event);
    case 'abortOnGround':
      return phase === 'takeoff'
        ? to({ phase: 'aborted', abortReason: event.reason })
        : bad(state, event);
    case 'cancel':
      return phase === 'planned' || phase === 'preflight'
        ? to({ phase: 'aborted', abortReason: event.reason })
        : bad(state, event);
    case 'abortRequested':
      return phase === 'returning'
        ? to({ abortReason: state.abortReason ?? event.reason })
        : bad(state, event);
  }
}
