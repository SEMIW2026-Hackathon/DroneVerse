import type { FastifyInstance } from 'fastify';
import { PLAN_CONFIG, planRequestSchema, type Polygon } from '@droneverse/shared';
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
    const { rows } = await getPool().query<{ id: string; boundary: Polygon }>(
      `select f.id, ST_AsGeoJSON(f.boundary)::json as boundary
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
      return planMission({
        fields: fieldIds.map((id) => byId.get(id)!),
        drone,
        params: input.params,
        windKmh: input.windKmh,
        home: input.home,
        cfg: PLAN_CONFIG,
      });
    } catch (err) {
      if (err instanceof PlanError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });
}
