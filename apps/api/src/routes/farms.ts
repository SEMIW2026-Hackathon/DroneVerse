import type { FastifyInstance } from 'fastify';
import { farmInputSchema, type Farm } from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { requireAuth } from './authGuard.js';

const COLUMNS = 'id, owner_id as "ownerId", name';

export async function farmRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/farms', async (req) => {
    const { rows } = await getPool().query<Farm & { fieldCount: number }>(
      `select f.id, f.owner_id as "ownerId", f.name,
              (select count(*)::int from fields where farm_id = f.id) as "fieldCount"
         from farms f where f.owner_id = $1 order by f.created_at`,
      [req.user!.id],
    );
    return { farms: rows };
  });

  app.post('/farms', async (req, reply) => {
    const input = farmInputSchema.parse(req.body);
    const { rows } = await getPool().query<Farm>(
      `insert into farms (owner_id, name) values ($1, $2) returning ${COLUMNS}`,
      [req.user!.id, input.name],
    );
    return reply.code(201).send({ farm: rows[0] });
  });

  app.patch<{ Params: { id: string } }>('/farms/:id', async (req, reply) => {
    const input = farmInputSchema.parse(req.body);
    const { rows } = await getPool().query<Farm>(
      `update farms set name = $1 where id = $2 and owner_id = $3 returning ${COLUMNS}`,
      [input.name, req.params.id, req.user!.id],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Farm not found' });
    return { farm: rows[0] };
  });

  app.delete<{ Params: { id: string } }>('/farms/:id', async (req, reply) => {
    const { rowCount } = await getPool().query(
      'delete from farms where id = $1 and owner_id = $2',
      [req.params.id, req.user!.id],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Farm not found' });
    return reply.code(204).send();
  });
}
