import type { FastifyInstance } from 'fastify';
import { DRONE_ACCENT_COLORS, type DroneSpec } from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { requireAuth } from './authGuard.js';

const COLUMNS = `id, name, tagline, type, rotors,
  max_flight_min as "maxFlightMin", top_speed_kmh as "topSpeedKmh", camera_mp as "cameraMP",
  sensor, payload_l as "payloadL", driver, specs_are_placeholder as "specsArePlaceholder"`;

type DroneRow = Omit<DroneSpec, 'payloadL' | 'accentColor'> & { payloadL: number | null };

/** Null in the database means "no payload"; the shared type uses an absent key. */
export function toDroneSpec({ payloadL, ...rest }: DroneRow): DroneSpec {
  const accentColor = DRONE_ACCENT_COLORS[rest.id] ?? '#059669';
  return payloadL === null ? { ...rest, accentColor } : { ...rest, payloadL, accentColor };
}

export async function loadDrone(id: string): Promise<DroneSpec | undefined> {
  const { rows } = await getPool().query<DroneRow>(`select ${COLUMNS} from drones where id = $1`, [
    id,
  ]);
  return rows[0] && toDroneSpec(rows[0]);
}

export async function droneRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/drones', async () => {
    const { rows } = await getPool().query<DroneRow>(
      `select ${COLUMNS} from drones order by sort_order`,
    );
    return { drones: rows.map(toDroneSpec) };
  });
}
