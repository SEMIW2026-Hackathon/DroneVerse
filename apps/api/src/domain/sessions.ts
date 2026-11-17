import { createHash, randomBytes } from 'node:crypto';

/** Session lifetime. */
export const SESSION_DAYS = 30;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only the hash of a session token is stored in the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
