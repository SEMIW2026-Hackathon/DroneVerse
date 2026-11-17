import type { FastifyInstance } from 'fastify';
import { fieldInputSchema, fieldUpdateSchema, type Field } from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { requireAuth } from './authGuard.js';

const COLUMNS = `fields.id, fields.farm_id as "farmId", fields.name, fields.crop,
                 fields.area_ha as "areaHa", ST_AsGeoJSON(fields.boundary)::json as boundary`;

// Area is computed by PostGIS on the geography (spheroid) type, in hectares.
const SQM_PER_HA = 10000;

function isInvalidGeometry(err: unknown): boolean {
  // 23514 = check_violation (ST_IsValid failed, e.g. a self-intersecting ring)
  return (err as { code?: string }).code === '23514';
}
const INVALID = { error: 'Boundary is not a valid polygon (does it cross itself?)' };

export async function fieldRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get<{ Params: { farmId: string } }>('/farms/:farmId/fields', async (req, reply) => {
    const pool = getPool();
    const farm = await pool.query('select 1 from farms where id = $1 and owner_id = $2', [
      req.params.farmId,
      req.user!.id,
    ]);
    if (!farm.rowCount) return reply.code(404).send({ error: 'Farm not found' });

    const { rows } = await pool.query<Field>(
      `select ${COLUMNS} from fields where farm_id = $1 order by created_at`,
      [req.params.farmId],
    );
    return { fields: rows };
  });

  app.post<{ Params: { farmId: string } }>('/farms/:farmId/fields', async (req, reply) => {
    const input = fieldInputSchema.parse(req.body);
    try {
      const { rows } = await getPool().query<Field>(
        `with g as (select ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) as geom)
         insert into fields (farm_id, name, crop, boundary, area_ha)
         select f.id, $2, $3, g.geom, ST_Area(g.geom::geography) / ${SQM_PER_HA}
           from farms f, g where f.id = $1 and f.owner_id = $5
         returning ${COLUMNS}`,
        [req.params.farmId, input.name, input.crop, JSON.stringify(input.boundary), req.user!.id],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Farm not found' });
      return reply.code(201).send({ field: rows[0] });
    } catch (err) {
      if (isInvalidGeometry(err)) return reply.code(400).send(INVALID);
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>('/fields/:id', async (req, reply) => {
    const input = fieldUpdateSchema.parse(req.body);
    const boundary = input.boundary ? JSON.stringify(input.boundary) : null;
    try {
      const { rows } = await getPool().query<Field>(
        `with g as (select case when $4::text is null then null
                           else ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) end as geom)
         update fields set
           name = coalesce($2, fields.name),
           crop = coalesce($3, fields.crop),
           boundary = coalesce(g.geom, fields.boundary),
           area_ha = case when g.geom is null then fields.area_ha
                          else ST_Area(g.geom::geography) / ${SQM_PER_HA} end,
           updated_at = now()
         from g
         where fields.id = $1
           and fields.farm_id in (select id from farms where owner_id = $5)
         returning ${COLUMNS}`,
        [req.params.id, input.name ?? null, input.crop ?? null, boundary, req.user!.id],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Field not found' });
      return { field: rows[0] };
    } catch (err) {
      if (isInvalidGeometry(err)) return reply.code(400).send(INVALID);
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>('/fields/:id', async (req, reply) => {
    const { rowCount } = await getPool().query(
      `delete from fields where id = $1
         and farm_id in (select id from farms where owner_id = $2)`,
      [req.params.id, req.user!.id],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Field not found' });
    return reply.code(204).send();
  });
}
