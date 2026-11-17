import type { FastifyInstance } from 'fastify';
import {
  loginInputSchema,
  registerInputSchema,
  type AuthResponse,
  type User,
} from '@droneverse/shared';
import { getPool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../domain/password.js';
import { hashToken, newSessionToken, SESSION_DAYS } from '../domain/sessions.js';
import { requireAuth } from './authGuard.js';

// Verified against when the email is unknown, so login timing doesn't reveal which emails exist.
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password');

async function startSession(userId: string): Promise<string> {
  const token = newSessionToken();
  await getPool().query(
    `insert into sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [userId, hashToken(token), SESSION_DAYS],
  );
  return token;
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const input = registerInputSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    try {
      const { rows } = await getPool().query<User>(
        `insert into users (email, password_hash, name) values ($1, $2, $3)
         returning id, email, name, role`,
        [input.email, passwordHash, input.name],
      );
      const user = rows[0]!;
      const body: AuthResponse = { token: await startSession(user.id), user };
      return reply.code(201).send(body);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'An account with that email already exists' });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (req, reply) => {
    const input = loginInputSchema.parse(req.body);
    const { rows } = await getPool().query<User & { password_hash: string }>(
      'select id, email, name, role, password_hash from users where email = $1',
      [input.email],
    );
    const row = rows[0];
    const ok = await verifyPassword(
      input.password,
      row?.password_hash ?? (await DUMMY_HASH_PROMISE),
    );
    if (!row || !ok) return reply.code(401).send({ error: 'Wrong email or password' });

    const { password_hash: _omit, ...user } = row;
    const body: AuthResponse = { token: await startSession(user.id), user };
    return body;
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    await getPool().query('delete from sessions where token_hash = $1', [
      hashToken(req.sessionToken!),
    ]);
    return reply.code(204).send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (req) => ({ user: req.user }));
}
