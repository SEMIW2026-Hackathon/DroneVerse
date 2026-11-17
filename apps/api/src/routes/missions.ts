import type { FastifyInstance } from 'fastify';
import {
  PLAN_CONFIG,
  planRequestSchema,
  uploadedMissionSchema,
  type Polygon,
} from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { planMission } from '../domain/planMission.js';
import { PlanError } from '../domain/surveyPlanner.js';
import { loadDrone } from './drones.js';
import { requireAuth } from './authGuard.js';

export async function missionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** Generate a survey path, time/battery estimate and risk checks. Nothing is saved. */
  app.post('/missions/plan', async (req, reply) => {
    const input = planRequestSchema.parse(req.body);
    const fieldIds = [...new Set(input.fieldIds)];

    // Only fields on farms the signed-in user owns.
    const { rows } = await getPool().query<{ id: string; name: string; boundary: Polygon }>(
      `select f.id, f.name, ST_AsGeoJSON(f.boundary)::json as boundary
         from fields f join farms fa on fa.id = f.farm_id
        where f.id = any($1::uuid[]) and fa.owner_id = $2`,
      [fieldIds, req.user!.id],
    );
    if (rows.length !== fieldIds.length) return reply.code(404).send({ error: 'Field not found' });

    const drone = await loadDrone(input.droneId);
    if (!drone) return reply.code(404).send({ error: 'Drone not found' });

    // Keep the caller's field order so results are stable.
    const byId = new Map(rows.map((r) => [r.id, r]));
    try {
      const result = planMission({
        fields: fieldIds.map((id) => byId.get(id)!),
        drone,
        params: input.params,
        windKmh: input.windKmh,
        home: input.home,
        cfg: PLAN_CONFIG,
      });
      const { rows: saved } = await getPool().query<{ id: string }>(
        `insert into missions
          (owner_id, drone_id, drone, waypoints, speed_kmh, altitude_m, home, wind_kmh, required_battery_pct)
         values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8, $9)
         returning id`,
        [
          req.user!.id,
          drone.id,
          JSON.stringify(drone),
          JSON.stringify(result.waypoints),
          input.params.speedKmh,
          input.params.altitudeM,
          JSON.stringify(result.home),
          input.windKmh,
          Math.min(100, result.stats.batteryUsedPct + result.stats.reservePct),
        ],
      );
      return { ...result, missionId: saved[0]!.id };
    } catch (err) {
      if (err instanceof PlanError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.get('/missions/:missionId', async (req, reply) => {
    const { missionId } = req.params as { missionId: string };
    const { rows } = await getPool().query<{
      id: string;
      drone: unknown;
      waypoints: unknown;
      speed_kmh: number;
      altitude_m: number;
      home: unknown;
      wind_kmh: number;
      required_battery_pct: number;
    }>(
      `select id, drone, waypoints, speed_kmh, altitude_m, home, wind_kmh, required_battery_pct
         from missions where id = $1 and owner_id = $2`,
      [missionId, req.user!.id],
    );
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: 'Mission not found' });
    const mission = uploadedMissionSchema.parse({
      missionId: row.id,
      drone: row.drone,
      waypoints: row.waypoints,
      speedKmh: row.speed_kmh,
      altitudeM: row.altitude_m,
      home: row.home,
      windKmh: row.wind_kmh,
      requiredBatteryPct: row.required_battery_pct,
    });
    return { mission };
  });
}
