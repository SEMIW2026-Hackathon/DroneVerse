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

## Phase 2

- **Planning code lives in `apps/api/src/domain/`** as pure functions (`surveyPlanner`, `batteryEstimator`, `riskChecks`, `planMission`), exposed as `POST /missions/plan`. The web app calls it with a "Generate plan" button rather than recomputing on every slider move, since each call also does database lookups. Nothing is saved yet; saving a mission arrives with Phase 3, when it has to be launched.
- **All tunables are in `packages/shared/src/planConfig.ts`** (reserve 25%, takeoff/landing time, climb and wind drain, camera field of view, wind and altitude limits, slider defaults). Values marked PLACEHOLDER there are guesses.
- **Drone registry is a `drones` table** (migration 002), global rather than per user, seeded with Sparrow S4, Kestrel H6 and Condor X8. Every spec is flagged `specs_are_placeholder` and the UI shows "Placeholder specs, not measured".
- **One camera model for all drones** (74 degree horizontal field of view, 4:3 sensor). The drone's megapixels only change the ground sample distance. Per-drone optics can be added once real cameras are chosen.
- **Path planning:** lines run in one direction across the field, alternating each line (lawnmower). For each field it tries every sweep angle in 5 degree steps and every start corner and keeps the shortest route. Concave fields get several segments on a line instead of one that crosses the gap. The drone still flies straight between segments, so on a concave field a transit leg can briefly leave the field boundary; the autopilot geofence (Phase 3 to 5) is what enforces the real limit.
- **Multiple fields:** visited nearest-first from the launch point, one flight on one battery. Splitting a big job into several batteries is not planned yet; the planner tells the user to shrink the area instead.
- **Battery model:** `rated minutes of flight -> percent per minute`, plus extra drain for wind and climbing. The trip out, survey and trip home are all counted, and the 25% reserve must be left on landing.
- **Both an endurance overrun and a reserve breach are "critical"** (block launch), because a mission that dips into the reserve would trigger return-to-home before finishing. Only one of the two is reported when both apply.
- **Wind is typed in by the operator** (no weather feed yet). No-fly zones are supported by the risk checks but nothing supplies zone data yet, so that check never fires in the app.
- **Launch point:** defaults to the first corner of the first field; the user can set it on the map. Return distance is measured to it.
- **Basemap, auth and DB decisions from Phase 1 still apply.**

## Phase 2 fixes

- **Field area was correct.** The "north wheat" boundary is a triangle about 148 km x 107 km (PostGIS 659,612 ha, TypeScript 662,746 ha, flat-earth check 662,654 ha), drawn while the map was at its default zoomed-out view. The planner now refuses any field over `limits.maxFieldHa` (5,000 ha, in `planConfig.ts`) with a message naming the field, and the planner screen greys such fields out. The drawing screen warns live when a shape passes the limit but still lets it be saved: a real 6,000 ha ranch is plausible, even though it can't be planned for flight.
- **Map overlays were not rendering at all** (field outlines, the shape being drawn, the flight path). MapLibre 6 runs GeoJSON sources in a separate worker file, and Vite does not carry that file along, so the worker 404'd with "Worker failed to load". `map/layers.ts` now points MapLibre at the worker with `setWorkerUrl(...?url)`. Checked in a real browser in both `pnpm dev` and the production build. This affected Phase 1 drawing as well.
- **Plan runs automatically** (500 ms after the last change) once a field and a drone are selected, and the map zooms to the selected fields. The previous plan stays on screen, dimmed, while a new one loads.
- **Drone cards** stack one per row in the sidebar (`layout="list"`); the rotor count is now a chip and the name truncates instead of overflowing. Each card has an SVG with the right number of rotors (layout numbers in `lib/droneShape.ts`, tested).
