import { create } from 'zustand';
import type { Field, FieldInput } from '@droneverse/shared';
import { api, type FarmSummary } from '../lib/api';

interface FarmState {
  farms: FarmSummary[];
  fields: Field[];
  loadFarms: () => Promise<void>;
  createFarm: (name: string) => Promise<void>;
  deleteFarm: (id: string) => Promise<void>;
  loadFields: (farmId: string) => Promise<void>;
  addField: (farmId: string, input: FieldInput) => Promise<Field>;
  removeField: (id: string) => Promise<void>;
}

export const useFarmStore = create<FarmState>((set, get) => ({
  farms: [],
  fields: [],

  loadFarms: async () => set({ farms: (await api.listFarms()).farms }),

  createFarm: async (name) => {
    await api.createFarm(name);
    await get().loadFarms();
  },

  deleteFarm: async (id) => {
    await api.deleteFarm(id);
    set({ farms: get().farms.filter((f) => f.id !== id) });
  },

  loadFields: async (farmId) => {
    set({ fields: [] });
    set({ fields: (await api.listFields(farmId)).fields });
  },

  addField: async (farmId, input) => {
    const { field } = await api.createField(farmId, input);
    set({ fields: [...get().fields, field] });
    return field;
  },

  removeField: async (id) => {
    await api.deleteField(id);
    set({ fields: get().fields.filter((f) => f.id !== id) });
  },
}));
