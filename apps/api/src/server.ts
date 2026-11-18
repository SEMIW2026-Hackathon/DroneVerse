import './env.js';
import { buildApp } from './app.js';

const host = process.env.API_HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
const app = buildApp();

try {
  await app.listen({ host, port });
  console.log(`[api] OK: listening on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
