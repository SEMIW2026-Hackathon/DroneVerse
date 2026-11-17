import type { DroneSpec } from '@droneverse/shared';

export const DRONE_VISUAL_CONFIG = {
  'sparrow-s4': {
    scale: 0.9,
    shell: '#f8fafc',
    accent: '#14b8a6',
  },
  'kestrel-h6': {
    scale: 1.1,
    shell: '#2b2f36',
    accent: '#f28c28',
  },
  'condor-x8': {
    scale: 1.4,
    shell: '#f2b400',
    accent: '#2f6fed',
  },
} as const;

export type ProceduralDroneConfig = (typeof DRONE_VISUAL_CONFIG)['kestrel-h6'];

export function getDroneVisualConfig(spec: Pick<DroneSpec, 'id' | 'accentColor'>) {
  const configured = DRONE_VISUAL_CONFIG[spec.id as keyof typeof DRONE_VISUAL_CONFIG];
  if (configured) return configured;
  return {
    scale: 0.6,
    shell: '#2b2f36',
    accent: spec.accentColor,
  };
}
