# Instructions for AI assistants working on Droneverse

Droneverse is a drone system for farmers: a web platform (plan, fly, scan, diagnose, act), a drone bridge, and an analysis service.

## Before doing anything
1. Read `README.md` (product brief, architecture, phases, rules).
2. Read `docs/HANDOFF.md` (current status, decisions, next steps, progress log).
3. Work on ONE task at a time. State a short plan (files to create or edit) before writing code.

## Rules
- Never print, log, commit or paste the contents of `.env`. Never put secrets in code, docs or chat.
- Docker is not installed. Do not run Docker commands.
- Never bypass the `DroneDriver` interface. No component or route talks to a specific drone directly.
- Safety logic (pre-flight gate, battery reserve, return-to-home, mission state machine) needs unit tests BEFORE UI work.
- Arm and takeoff are impossible unless the pre-flight check passed and the user took an explicit action. Log every command with a timestamp.
- Anything from `SimDriver` or fake data must be visibly labeled "Simulated" in the UI.
- Put shared types in `packages/shared`; validate external input with zod. Keep tunable numbers in config or data files, not inline.
- Keep components under about 200 lines. Pure logic goes in `domain/`, `simulation/` or `lib/`, not in React components.
- Do not add a dependency without saying why.
- If something is ambiguous, choose the simplest option and record it in `docs/decisions.md`. If it touches safety or hardware, STOP and ask the human.

## After every task
1. Run `pnpm test`, `pnpm lint` and `pnpm build`. Fix failures.
2. Append an entry to the "Progress log" in `docs/HANDOFF.md`: date, what changed, tests run, what is next.
3. Update the status table in `docs/HANDOFF.md` if a phase item changed.
4. Suggest a commit message in the form `phase N: <summary>`. Do not push unless asked.