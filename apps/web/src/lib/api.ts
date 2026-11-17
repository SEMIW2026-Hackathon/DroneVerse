import type {
  AuthResponse,
  Farm,
  Field,
  FieldInput,
  FieldUpdate,
  LoginInput,
  RegisterInput,
  User,
  DroneSpec,
  PlanRequest,
  PlanResult,
  UploadedMission,
} from '@droneverse/shared';
import { API_BASE } from './config';

const TOKEN_KEY = 'droneverse.token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStorage.get();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 on login/register just means wrong credentials; elsewhere the session is gone.
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(data.error ?? 'Request failed', res.status);
  }
  return data as T;
}

export type FarmSummary = Farm & { fieldCount: number };

export const api = {
  register: (input: RegisterInput) => request<AuthResponse>('POST', '/auth/register', input),
  login: (input: LoginInput) => request<AuthResponse>('POST', '/auth/login', input),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  listFarms: () => request<{ farms: FarmSummary[] }>('GET', '/farms'),
  createFarm: (name: string) => request<{ farm: Farm }>('POST', '/farms', { name }),
  renameFarm: (id: string, name: string) =>
    request<{ farm: Farm }>('PATCH', `/farms/${id}`, { name }),
  deleteFarm: (id: string) => request<void>('DELETE', `/farms/${id}`),

  listFields: (farmId: string) => request<{ fields: Field[] }>('GET', `/farms/${farmId}/fields`),
  createField: (farmId: string, input: FieldInput) =>
    request<{ field: Field }>('POST', `/farms/${farmId}/fields`, input),
  updateField: (id: string, input: FieldUpdate) =>
    request<{ field: Field }>('PATCH', `/fields/${id}`, input),
  deleteField: (id: string) => request<void>('DELETE', `/fields/${id}`),

  listDrones: () => request<{ drones: DroneSpec[] }>('GET', '/drones'),
  planMission: (input: PlanRequest) => request<PlanResult>('POST', '/missions/plan', input),
  getMission: (id: string) => request<{ mission: UploadedMission }>('GET', `/missions/${id}`),
};
