# Architecture

See `README.md` Section 4 for the diagram. Summary:

- `apps/web` (React) talks REST + WebSocket to `apps/api` (Fastify).
- `apps/api` talks to the Drone Bridge over WebSocket and to `apps/analysis` (FastAPI) for image jobs.
- `apps/bridge` runs near the drone and speaks to it only through the `DroneDriver` interface (`SimDriver`, `MavlinkDriver`).
- Data: Postgres + PostGIS, object storage (MinIO locally).
- `packages/shared` holds types and zod schemas used by every TypeScript app.
