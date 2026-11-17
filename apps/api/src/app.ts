import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import { ZodError } from 'zod';
import { authRoutes } from './routes/auth.js';
import { droneRoutes } from './routes/drones.js';
import { farmRoutes } from './routes/farms.js';
import { fieldRoutes } from './routes/fields.js';
import { missionRoutes } from './routes/missions.js';
import { TelemetryRelay } from './ws/TelemetryRelay.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const relay = new TelemetryRelay();
  const websocketServer = new WebSocketServer({ noServer: true });

  app.server.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== '/ws/bridge' && path !== '/ws/telemetry') {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      if (path === '/ws/bridge') {
        relay.attachBridge(client);
        client.on('message', (data) => relay.receiveBridge(client, data.toString()));
        client.on('close', () => relay.disconnectBridge(client));
        return;
      }

      relay.addBrowser(client);
      client.on('message', (data) => relay.receiveBrowser(client, data.toString()));
      client.on('close', () => relay.removeBrowser(client));
    });
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => websocketServer.close(() => resolve()));
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'Invalid input',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (err.statusCode && err.statusCode < 500) return reply.send(err);
    // Not err.message: database errors can contain the host name.
    req.log.error({ code: (err as { code?: string }).code }, 'request failed');
    return reply.code(500).send({ error: 'Something went wrong' });
  });

  // Reject malformed ids before they reach the database.
  app.addHook('preValidation', async (req, reply) => {
    const params = req.params as Record<string, string> | undefined;
    for (const [key, value] of Object.entries(params ?? {})) {
      if (/(^|[a-z])id$/i.test(key) && !UUID.test(value)) {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  });

  app.get('/health', async () => ({ status: 'ok', service: 'droneverse-api' }));
  app.register(authRoutes);
  app.register(farmRoutes);
  app.register(fieldRoutes);
  app.register(droneRoutes);
  app.register(missionRoutes);

  return app;
}
