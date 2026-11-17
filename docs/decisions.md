# Decisions

Ambiguous choices made while building, newest last.

## Phase 0

- **Nested git repo.** `Droneverse/` sits inside the user's Desktop, which is itself a git repo (branch `master`, mostly untracked files). Created a separate repo in `Droneverse/` (branch `main`) so phase commits stay clean.
- **No Turborepo.** The brief marks it optional; `pnpm -r` is enough for now.
- **Docker Compose has only postgres + minio in Phase 0.** The brief lists api and analysis too, but they have no Dockerfiles yet. Add them when those services need to run in containers.
- **Dependencies for later phases are not installed yet** (maplibre-gl, three, zustand, prisma/drizzle, node-mavlink, etc.). Each is added in the phase that uses it, with a reason.
- **`packages/shared` builds to `dist/` with tsc** (NodeNext ESM), and apps consume the built output. `pnpm dev` builds it first.
- **Analysis tests run through `scripts/py.mjs`**, which uses `apps/analysis/.venv` if present, so `pnpm test` covers Python too.
- **Docker is not installed on the dev machine used for Phase 0**, so `docker compose up` was not run there. The compose file was written but not exercised.

## Phase 1

- **Database: hosted Supabase, no Docker.** `DATABASE_URL` in the repo-root `.env` is used by the API. `docker-compose.yml` stays for people who want a local DB; the `db:up`/`db:down` scripts were removed. Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only, so networks without IPv6 must use the **Session pooler** connection string instead.
- **TLS to the database uses `rejectUnauthorized: false`** for non-localhost hosts, because Supabase's certificate chain isn't in Node's default trust store. The connection is encrypted but the server isn't verified. Tighten later by pinning Supabase's CA.
- **Raw SQL with `pg`, no ORM.** Four tables and a few queries; the brief allows Prisma or Drizzle but that is more tooling than this needs. Migrations are plain `.sql` files run by `pnpm db:migrate`.
- **Auth: opaque session tokens, not JWT.** Random 32-byte token sent as `Authorization: Bearer`; only its SHA-256 is stored, 30-day expiry, deleted on logout. Passwords use scrypt from `node:crypto` (no extra dependency). The token is kept in `localStorage`, which is exposed to XSS; revisit with httpOnly cookies when deploying web and API on one origin.
- **No rate limiting on login yet.** Add in Phase 8 hardening.
- **Roles:** column exists (`owner` default) but only ownership is enforced. Every farm/field query is scoped to the signed-in owner. Manager/operator/viewer sharing comes in Phase 8.
- **Row level security is enabled with no policies** on all tables so Supabase's public REST API cannot read them. The API connects as the database owner and bypasses RLS.
- **Area:** authoritative value is computed by PostGIS (`ST_Area(geography)/10000`) on insert/update and stored in `area_ha`. `packages/shared/src/area.ts` computes the same thing in TypeScript (sphere, not spheroid) for the live preview while drawing; they agree within ~1%.
- **Drawing is hand-written** (click to add corners, Finish/Undo/Cancel) instead of adding a draw plugin. Self-intersecting shapes are rejected by the database (`ST_IsValid` check) with a 400.
- **TanStack Query not added;** a Zustand store is enough for two screens.
- **Basemaps:** OpenStreetMap tiles and Esri World Imagery (satellite, default). Both are fine for development; check each provider's terms or switch to a paid tile source before production.
- **Database tests are opt-in** (`RUN_DB_TESTS=1`) because they hit the real database. They create a temporary user and delete it afterwards.
