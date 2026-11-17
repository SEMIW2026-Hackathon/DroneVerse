import { z } from 'zod';

/** The phases the bridge's state machine moves through (see missionStateMachine.ts). */
export const flightPhaseSchema = z.enum([
  'planned',
  'preflight',
  'takeoff',
  'scanning',
  'returning',
  'landed',
  'aborted',
]);
