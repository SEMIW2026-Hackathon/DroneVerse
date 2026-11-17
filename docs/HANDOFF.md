# Droneverse: Handoff and Progress Log

Read `README.md` first (full product brief, architecture, phases). This file says **where we are** and **what to do next**. Update it at the end of every task (see "Progress log" at the bottom).

## Environment
- Windows, VS Code, PowerShell, pnpm monorepo (`apps/web`, `apps/api`, `apps/bridge`, `apps/analysis`, `packages/shared`).
- Database: hosted Supabase PostgreSQL with PostGIS 3.3 enabled. Connection string is in `.env` as `DATABASE_URL`. **Never print, log, commit or paste `.env` contents.**
- Docker is NOT installed. Do not try to run Docker.
- The team has a GitHub organization repo. Work on branches, commit small.

## Status by phase
| Phase | Status | Notes |
|-------|--------|-------|
| 0 Scaffold | Done | Monorepo, folder structure, CLAUDE.md |
| 1 Farms and fields | Done | Sign-in, farm CRUD, MapLibre field drawing, PostGIS storage, area calc |
| 2 Fleet and mission planner | Done, with fixes | Three placeholder drones, planner, survey path, battery/risk checks. A fix round covered an absurd field-area value (659,612 ha), drone card layout and path preview. Verify these are really fixed. |
| 3 Bridge, drivers, live telemetry | **PARTIAL, work stopped mid-phase** | See below |
| 4 to 8 | Not started | |

## Phase 3: what is believed done (VERIFY, do not trust blindly)
The previous assistant ran out of credits partway through. Last known state:
- `DroneDriver` interface and `SimDriver` exist in `apps/bridge`.
- A flight controller exists (`src/flight/FlightController.ts`) with a test file of about 650 lines. 55 tests were reported passing on the first run.
- Covered by those tests: pre-flight gate, launch confirmation, launch sequence, return-to-home, Abort, battery watchdog, command log.
- About 24 files were changed in the working tree and may be **uncommitted**.
- **Danger:** the assistant was in the middle of *deliberately breaking* the pre-flight gate and battery watchdog to prove the tests catch failures. It is unknown whether the deliberate breakage was reverted. Check for it first.

## Phase 3: what is likely NOT done
- WebSocket pipeline bridge to API to web, telemetry at about 5 to 10 Hz
- Live pre-flight screen in the web app driven by telemetry
- Launch UI: Launch button, confirmation dialog, abort and return-to-home controls
- `MavlinkDriver` stub that throws "not implemented"
- A single command that starts web, API and bridge together
- "Simulated" labeling in the UI for everything from `SimDriver`

## Decisions already made
**Launch sequence:** one confirmation, then an auto-sequence of arm, takeoff and start mission. Conditions:
1. The confirm dialog re-verifies every pre-flight check at the moment of confirmation, not an earlier pass.
2. If any check changes during the sequence, abort and show the reason.
3. Return-to-home and Abort are always one tap away, including during the sequence.
4. The dialog clearly states when the drone is simulated.
5. Keep steps separable, because spray or payload release will need its own separate confirmation later.

## Non-negotiable safety rules
- Never bypass the `DroneDriver` interface.
- Arm and takeoff must be impossible unless the pre-flight check has passed AND the user took an explicit action. Every command is logged with a timestamp.
- Safety logic (gate, battery reserve, return-to-home, state machine) needs unit tests before UI work.
- Anything from `SimDriver` must be visibly labeled "Simulated".
- If a change touches hardware or safety behavior and anything is ambiguous, stop and ask the human.

## First task for the new assistant: AUDIT, change nothing yet
1. Run `git status` and `git diff --stat`. List modified and untracked files.
2. Run `pnpm install`, `pnpm test`, `pnpm lint` and `pnpm build`. Report results.
3. Review the pre-flight gate and battery watchdog code and their tests for any sign of leftover deliberate breakage (disabled checks, inverted conditions, commented-out guards, always-true gates, skipped or weakened tests). Report findings. Fix only clear leftovers, and say exactly what you changed.
4. Compare the repo against the Phase 3 lists above and write the real status into the progress log.
5. Stop and report. Do not start new features until the human approves.

## Remaining work, in order (one item at a time, tests first for safety logic)
1. MavlinkDriver stub that throws "not implemented"
2. WebSocket telemetry pipeline (bridge to API to web)
3. Live pre-flight screen driven by telemetry, with Launch disabled until all checks pass
4. Launch confirmation dialog and sequence UI, with Abort and Return-to-home controls
5. "Simulated" labels throughout
6. One command to run web, API and bridge together
7. Manual test checklist for the human (below), then commit

## Manual test checklist (human)
- Plan a mission on a small field, open pre-flight, and confirm Launch stays disabled until all checks pass.
- Launch and watch telemetry update live.
- Start with low battery and confirm return-to-home triggers.
- Press Return-to-home mid-flight and confirm it obeys.
- Stop the bridge and confirm a lost-link alert appears, not a frozen screen.
- Confirm every command appears in the log.

## Progress log (append newest at the bottom; one entry per task)
Format: date, who (human or assistant), what changed, tests run, what is next.

- 2026-11-17, handoff written. Phase 3 partial. Audit task pending.