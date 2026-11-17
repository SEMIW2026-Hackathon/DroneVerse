import { create } from 'zustand';
import type { DroneSpec } from '@droneverse/shared';
import { api } from '../lib/api';

interface FleetState {
  drones: DroneSpec[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  drones: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ drones: (await api.listDrones()).drones, loaded: true });
  },
}));
