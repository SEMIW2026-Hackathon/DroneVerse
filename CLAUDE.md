# Droneverse: rules for Claude Code

Read `README.md` for the full brief (problem, architecture, phases). These rules apply to every session.

1. Work **one phase at a time**. Don't start the next until the current "Done when" is met.
2. Before each phase, state a short plan (files to create/edit). After each phase, run build, tests and lint, fix failures, then commit: `git commit -m "phase N: <summary>"`.
3. Put shared types in `packages/shared` and validate external input with zod.
4. **Never bypass the `DroneDriver` interface.** No component or route may talk to a specific drone directly.
5. **Safety code gets tests.** Geofence, battery reserve, RTH logic and the pre-flight gate need unit tests before merging.
6. Do not add real-hardware commands (arm, takeoff, spray) that can run without the pre-flight gate and an explicit user action.
7. Keep tunable numbers (drone specs, reserve %, drain constants, colors) in config or data files, not inline.
8. Keep components under ~200 lines. Pure logic goes in `domain/`, `simulation/` or `lib/`, not in React components.
9. Never add a dependency without saying why. Never commit secrets; use `.env`.
10. If something is ambiguous, choose the simplest option, record it in `docs/decisions.md`, and continue. If it affects safety or hardware, **stop and ask**.

## Commands

- `pnpm install` — install all workspaces
- `pnpm dev` — web (Vite) + api (Fastify)
- `pnpm test` / `pnpm build` / `pnpm lint` / `pnpm typecheck`
- `docker compose up -d postgres minio` — database and object storage
- Analysis service (Python): see `apps/analysis/pyproject.toml`
