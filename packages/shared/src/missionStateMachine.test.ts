import { describe, expect, it } from 'vitest';
import {
  initialMissionState,
  isTerminalPhase,
  transition,
  type FlightPhase,
  type MissionEvent,
  type MissionState,
} from './missionStateMachine.js';

/** Apply events in order, expecting each to succeed. */
function run(events: MissionEvent[], from: MissionState = initialMissionState()): MissionState {
  return events.reduce((state, event) => {
    const r = transition(state, event);
    if (!r.ok) throw new Error(`${event.type} failed: ${r.error}`);
    return r.state;
  }, from);
}

const at = (phase: FlightPhase, extra: Partial<MissionState> = {}): MissionState => ({
  ...initialMissionState(),
  phase,
  ...extra,
});

const ALL_EVENTS: MissionEvent[] = [
  { type: 'missionUploaded' },
  { type: 'armed' },
  { type: 'disarmed' },
  { type: 'airborne' },
  { type: 'missionComplete' },
  { type: 'returnHome', reason: 'r' },
  { type: 'landNow', reason: 'r' },
  { type: 'touchdown' },
  { type: 'abortOnGround', reason: 'r' },
  { type: 'cancel', reason: 'r' },
  { type: 'abortRequested', reason: 'r' },
];

/** Which events each phase accepts. */
const ALLOWED: Record<FlightPhase, MissionEvent['type'][]> = {
  planned: ['missionUploaded', 'cancel'],
  preflight: ['armed', 'cancel'],
  takeoff: ['disarmed', 'airborne', 'returnHome', 'landNow', 'abortOnGround'],
  scanning: ['missionComplete', 'returnHome', 'landNow'],
  returning: ['touchdown', 'landNow', 'abortRequested'],
  landed: [],
  aborted: [],
};

describe('mission state machine', () => {
  it('starts as planned with no abort reason', () => {
    expect(initialMissionState()).toEqual({
      phase: 'planned',
      abortReason: null,
      landInPlace: false,
    });
  });

  describe('normal mission', () => {
    it('goes planned -> preflight -> takeoff -> scanning -> returning -> landed', () => {
      const phases: FlightPhase[] = [];
      let state = initialMissionState();
      for (const e of [
        { type: 'missionUploaded' },
        { type: 'armed' },
        { type: 'airborne' },
        { type: 'missionComplete' },
        { type: 'touchdown' },
      ] as MissionEvent[]) {
        state = run([e], state);
        phases.push(state.phase);
      }
      expect(phases).toEqual(['preflight', 'takeoff', 'scanning', 'returning', 'landed']);
      expect(state.abortReason).toBeNull();
    });
  });

  describe('every phase accepts exactly the events it should', () => {
    for (const phase of Object.keys(ALLOWED) as FlightPhase[]) {
      for (const event of ALL_EVENTS) {
        const allowed = ALLOWED[phase].includes(event.type);
        it(`${phase} + ${event.type} is ${allowed ? 'accepted' : 'rejected'}`, () => {
          expect(transition(at(phase), event).ok).toBe(allowed);
        });
      }
    }
  });

  it('rejects skipping steps', () => {
    expect(transition(at('planned'), { type: 'armed' }).ok).toBe(false);
    expect(transition(at('preflight'), { type: 'airborne' }).ok).toBe(false);
    expect(transition(at('preflight'), { type: 'missionComplete' }).ok).toBe(false);
  });

  it('gives a readable error and does not change the state', () => {
    const state = at('planned');
    const r = transition(state, { type: 'armed' });
    expect(r).toEqual({ ok: false, error: 'Cannot armed while the mission is planned' });
    expect(state.phase).toBe('planned');
  });

  it('does not mutate the state it is given', () => {
    const state = at('scanning');
    const frozen = JSON.stringify(state);
    transition(state, { type: 'returnHome', reason: 'x' });
    expect(JSON.stringify(state)).toBe(frozen);
  });

  describe('final phases', () => {
    it('landed and aborted are final', () => {
      expect(isTerminalPhase('landed')).toBe(true);
      expect(isTerminalPhase('aborted')).toBe(true);
      for (const p of ['planned', 'preflight', 'takeoff', 'scanning', 'returning'] as const) {
        expect(isTerminalPhase(p)).toBe(false);
      }
    });
  });

  describe('ending early', () => {
    it('an early return home finishes as aborted, keeping the first reason', () => {
      const s = run([
        { type: 'missionUploaded' },
        { type: 'armed' },
        { type: 'airborne' },
        { type: 'returnHome', reason: 'low-battery' },
        { type: 'abortRequested', reason: 'user-abort' },
        { type: 'touchdown' },
      ]);
      expect(s.phase).toBe('aborted');
      expect(s.abortReason).toBe('low-battery');
    });

    it('a user abort while scanning (return home first) ends aborted', () => {
      const s = run(
        [{ type: 'returnHome', reason: 'user-abort' }, { type: 'touchdown' }],
        at('scanning'),
      );
      expect(s).toMatchObject({ phase: 'aborted', abortReason: 'user-abort' });
    });

    it('landing in place ends aborted and is flagged', () => {
      const s = run([{ type: 'landNow', reason: 'user-land' }], at('scanning'));
      expect(s).toMatchObject({ phase: 'returning', landInPlace: true, abortReason: 'user-land' });
      expect(run([{ type: 'touchdown' }], s).phase).toBe('aborted');
    });

    it('landing in place can interrupt a return home already under way', () => {
      const s = run(
        [{ type: 'landNow', reason: 'user-land' }],
        at('returning', { abortReason: null }),
      );
      expect(s.landInPlace).toBe(true);
      expect(s.abortReason).toBe('user-land');
    });

    it('an automatic return after finishing the survey is not an abort', () => {
      const s = run([{ type: 'missionComplete' }, { type: 'touchdown' }], at('scanning'));
      expect(s).toMatchObject({ phase: 'landed', abortReason: null });
    });

    it('aborting before arming is final immediately', () => {
      expect(run([{ type: 'cancel', reason: 'user-abort' }], at('preflight'))).toMatchObject({
        phase: 'aborted',
        abortReason: 'user-abort',
      });
      expect(run([{ type: 'cancel', reason: 'user-abort' }], at('planned')).phase).toBe('aborted');
    });

    it('aborting while armed on the ground is final immediately', () => {
      expect(run([{ type: 'abortOnGround', reason: 'user-abort' }], at('takeoff'))).toMatchObject({
        phase: 'aborted',
        abortReason: 'user-abort',
      });
    });

    it('a failed launch that is disarmed on the ground returns to pre-flight, not aborted', () => {
      expect(run([{ type: 'disarmed' }], at('takeoff')).phase).toBe('preflight');
    });
  });

  describe('nothing leaves a final phase', () => {
    for (const phase of ['landed', 'aborted'] as const) {
      it(`${phase} rejects every event`, () => {
        for (const e of ALL_EVENTS) expect(transition(at(phase), e).ok).toBe(false);
      });
    }
  });
});
