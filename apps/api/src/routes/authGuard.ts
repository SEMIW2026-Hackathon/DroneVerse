import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { hashToken } from '../domain/sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    sessionToken?: string;
  }
}

/** preHandler: requires a valid `Authorization: Bearer <token>` header. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return reply.code(401).send({ error: 'Not signed in' });

  const { rows } = await getPool().query<User>(
    `select u.id, u.email, u.name, u.role
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  const user = rows[0];
  if (!user) return reply.code(401).send({ error: 'Session expired' });

  req.user = user;
  req.sessionToken = token;
}
