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
