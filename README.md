# Droneverse 🚁🌾

> An end-to-end drone system for farmers: plan a flight, launch a real drone, scan the crops, and get plain-language answers about what is wrong, where, and what to do about it.

Droneverse has three parts that work together:

1. **Drones** (hardware): off-the-shelf or custom agricultural multirotors running open autopilot software (PX4 / ArduPilot) with a camera payload.
2. **Droneverse Platform** (this repo, a web app plus backend): where the farmer manages farms and fields, plans missions, watches flights live, and reads the results.
3. **Droneverse Analysis** (a service): turns the images the drone captures into crop-health maps, issue detection and recommended actions.

**This file is the build brief for Claude Code.** Read it fully before writing code. Work phase by phase (Section 8). After each phase, run it, check the acceptance criteria and commit.

---

## 1. Problem statement

Farmers lose a large share of yield to problems they find too late.

- **Late detection.** Pests, disease, water stress and nutrient deficiency show up in the crop canopy before they are visible from the ground. By the time a farmer sees them, the damage has spread.
- **Fields are too big to walk.** Scouting on foot covers a fraction of a field and misses corners, so decisions are based on a few samples.
- **Blanket treatment wastes money.** Without knowing exactly where the problem is, farmers spray or irrigate the whole field. That costs inputs, labor and money, and harms the soil and water.
- **Drones exist but are hard to use.** Commercial agricultural drones are expensive, and the software is built for pilots and agronomists, not farmers. The output is maps and indices that most people can't act on.
- **No end-to-end flow.** Flying, image processing and decision-making are usually separate tools from separate vendors.

## 2. Solution

Droneverse gives the farmer one loop, **Plan → Fly → Scan → Diagnose → Act**, in one product.

| Step | What the farmer does | What the system does |
|------|----------------------|----------------------|
| **Plan** | Draws or imports field boundaries on a map and picks a drone | Generates an optimized survey path (altitude, image overlap, speed), estimates battery use and flight time, flags risks (wind, no-fly zones, low battery) |
| **Fly** | Runs the pre-flight check and taps *Launch* | Uploads the mission to the drone, monitors telemetry live, enforces geofence and return-to-home rules |
| **Scan** | Watches progress on the live map or 3D view, or takes over manually | Triggers the camera along the path, tracks coverage per field, flags issues as they are found |
| **Diagnose** | Opens the results | Builds a vegetation-health map, finds problem zones, classifies them (pest, disease, water stress, nutrient) with a confidence level |
| **Act** | Follows the recommendations | Gives a plain-language action per zone, and exports prescription maps for targeted spraying or irrigation, optionally flown by a spray drone |

**Value to the farmer:** earlier detection, treatment only where needed (less spend, less chemical), less time walking fields, and a history that shows what worked.

**Users:** smallholder and commercial farmers, farm managers, agronomists and extension officers, and drone service operators who serve many farms.

---

## 3. What the concept video showed (UI to carry over)

The prototype's screens become parts of the real product:

| Prototype screen | Becomes |
|------------------|---------|
| **Choose your drone** (Sparrow S4, Kestrel H6, Condor X8, with flight time / speed / camera MP chips) | **Fleet and drone assignment** step in mission setup. Specs come from the real fleet registry. |
| **Pre-flight check** (battery, propellers, GPS) | **Live pre-flight check** driven by real telemetry from the drone. Launch is blocked until it passes. |
| **Takeoff, auto-pilot, Fly myself, Land now** | Real mission controls sent to the drone through the bridge. |
| **3D farm view with Follow / Camera / Map** | **Live flight view**, a 3D digital twin of the farm with the real drone's position streamed in. Also reused for mission preview and replay. |
| **Crop scanning HUD** (field progress, three issue counters, battery, height, speed, GPS) | **Live mission HUD**, driven by real telemetry and real findings. |

---

## 4. System architecture

```
┌──────────────┐   WebSocket + REST    ┌─────────────────┐   MAVLink    ┌──────────────┐
│  Web app     │◄─────────────────────►│  API + Gateway  │◄────────────►│ Drone Bridge │◄──► Drone
│  (React)     │                       │  (Node/Fastify) │  (WebSocket) │ (per site)   │    (PX4/ArduPilot)
└──────┬───────┘                       └───────┬─────────┘              └──────────────┘
       │ map, 3D, HUD                          │ jobs, images, results
       │                                       ▼
       │                              ┌─────────────────┐   ┌────────────┐
       └─────────────────────────────►│ Analysis service│   │ Postgres + │
                                      │ (Python/FastAPI)│   │ object     │
                                      │ NDVI, detection │   │ storage    │
                                      └─────────────────┘   └────────────┘
```

**Key design rule: a hardware abstraction layer.** The platform never talks to a specific drone. It talks to a `DroneDriver` interface, with these implementations:

- `SimDriver`: a built-in software drone. Used for development, demos, farmer training and CI tests. **Not the product, a tool.**
- `MavlinkDriver`: real drones running PX4 or ArduPilot (first real target). Develop against **PX4 SITL** (software-in-the-loop) before touching hardware.
- `VendorDriver` (later): other vendor SDKs.

**Why a bridge process:** browsers can't speak MAVLink over serial/UDP. The Drone Bridge runs near the drone (on a laptop, ground-station computer or companion computer), speaks MAVLink to the drone, and relays telemetry and commands to the API over a secure WebSocket.

**Safety by design (non-negotiable):**
- Geofence and altitude ceiling are enforced **on the drone's autopilot**, not just in the UI.
- Return-to-home on low battery, lost link or user command.
- A physical/RC override always exists. The software must never remove the pilot's ability to take control.
- Pre-flight check must pass before arming. Every command is logged.
- Spraying and any payload release require an explicit extra confirmation.
- Show a reminder that the operator must follow local aviation regulations and any required permissions.

---

## 5. Tech stack

| Layer | Choice |
|-------|--------|
| Monorepo | **pnpm workspaces** (+ Turborepo optional) |
| Web app | **Vite + React 18 + TypeScript (strict)**, Tailwind CSS, framer-motion, lucide-react, react-router |
| Maps | **MapLibre GL JS** (field drawing, mission paths, heatmap layers) |
| 3D | **three.js** via **@react-three/fiber** + **drei** (digital twin / live flight view) |
| State | **Zustand** (+ TanStack Query for server data) |
| API / gateway | **Node + Fastify + TypeScript**, WebSocket for live telemetry |
| Database | **PostgreSQL + PostGIS** (fields are geometry), Prisma or Drizzle |
| File storage | S3-compatible (MinIO locally) for drone images and results |
| Drone bridge | **Node + TypeScript** using a MAVLink library (`node-mavlink`) |
| Analysis | **Python + FastAPI**, numpy, rasterio, OpenCV (ML models added later) |
| Simulation | **PX4 SITL + Gazebo** (optional, for dev), built-in `SimDriver` for quick tests |
| Auth | Email + password first; roles: owner, manager, operator, viewer |
| Tests | Vitest (TS), pytest (Python), Playwright (a couple of end-to-end flows) |
| Dev env | **Docker Compose** (postgres, minio, api, analysis) |

Design: friendly, clean and mobile-first (many farmers will use phones in the field), with a desktop layout for planning. Rounded cards, pill chips, a floating glass HUD, and a low-poly 3D farm like the prototype. Offline tolerance matters: the field often has weak connectivity.

---

## 6. Folder structure

```
droneverse/
├── README.md
├── CLAUDE.md                       # copy of Section 10 so the CLI always loads the rules
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── docker-compose.yml              # postgres+postgis, minio, api, analysis
├── .env.example
├── docs/
│   ├── architecture.md
│   ├── decisions.md                # Claude logs ambiguous choices here
│   ├── safety.md                   # safety rules + pre-flight spec
│   └── hardware.md                 # supported drones, wiring, bridge setup
│
├── packages/
│   └── shared/                     # types + zod schemas used by every app
│       └── src/
│           ├── drone.ts            # DroneSpec, Telemetry, DroneCommand
│           ├── farm.ts             # Farm, Field (GeoJSON polygon)
│           ├── mission.ts          # Mission, Waypoint, MissionPhase, SurveyParams
│           ├── finding.ts          # Finding, IssueKind, Severity, Recommendation
│           └── index.ts
│
├── apps/
│   ├── web/                        # the React platform
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/                # routes, layout shell, auth guard
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── farms/          # farm list, field drawing, field detail
│   │       │   ├── fleet/          # drone registry + "Choose your drone" cards
│   │       │   ├── mission-planner/# survey settings, path preview, risk + battery estimate
│   │       │   ├── preflight/      # live checklist driven by telemetry
│   │       │   ├── live-flight/    # 3D twin, map view, HUD, controls, view toggles
│   │       │   ├── results/        # health map, findings list, finding detail
│   │       │   ├── actions/        # recommendations, prescription maps, spray missions
│   │       │   ├── reports/        # per-flight and seasonal reports, export
│   │       │   └── settings/       # language, units, alerts
│   │       ├── three/              # World, Farm, CropField, Drone (parametric), ScanBeam, CameraRig
│   │       ├── map/                # MapLibre helpers, layers (fields, path, heatmap)
│   │       ├── components/ui/      # Button, Card, Chip, ProgressBar, Sheet, Toggle
│   │       ├── lib/                # api client, ws client, formatters, i18n
│   │       ├── store/              # useMissionStore, useTelemetryStore, useFarmStore
│   │       └── tests/
│   │
│   ├── api/                        # Fastify backend
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/             # auth, farms, fields, drones, missions, flights, findings, reports
│   │       ├── ws/                 # telemetry gateway (browser <-> bridge fan-out)
│   │       ├── domain/
│   │       │   ├── surveyPlanner.ts    # boundary -> lawnmower waypoints (overlap, altitude, speed)
│   │       │   ├── batteryEstimator.ts
│   │       │   ├── riskChecks.ts       # wind, geofence, battery reserve, no-fly
│   │       │   └── missionStateMachine.ts
│   │       ├── db/                 # schema, migrations, queries
│   │       ├── storage/            # image upload + signed URLs
│   │       └── jobs/               # queue: send images to analysis, store results
│   │
│   ├── bridge/                     # Drone Bridge (runs near the drone)
│   │   └── src/
│   │       ├── index.ts            # connects to drone + API
│   │       ├── drivers/
│   │       │   ├── DroneDriver.ts      # the interface
│   │       │   ├── SimDriver.ts        # software drone for dev/demo/tests
│   │       │   └── MavlinkDriver.ts    # PX4/ArduPilot over UDP/serial
│   │       ├── mission/            # upload mission, arm, takeoff, RTH, land
│   │       ├── safety/             # geofence + failsafe config pushed to autopilot
│   │       ├── camera/             # trigger + collect images, tag with GPS
│   │       └── tests/
│   │
│   └── analysis/                   # Python service
│       ├── pyproject.toml
│       └── app/
│           ├── main.py             # FastAPI
│           ├── ingest.py           # image set -> orthomosaic/tiles (stitching later)
│           ├── indices.py          # NDVI / VARI / etc. per pixel
│           ├── zones.py            # find problem zones from index map
│           ├── classify.py         # issue classification (rules first, ML later)
│           ├── recommend.py        # finding -> plain-language action
│           └── tests/
│
├── sim/                            # PX4 SITL + Gazebo launch scripts and notes
└── scripts/                        # dev helpers: seed data, fake image sets, demo flight
```

---

## 7. Core data model (create these first in `packages/shared`)

```ts
export interface DroneSpec {
  id: string;
  name: string;              // "Condor X8"
  tagline: string;           // "Big farms"
  type: 'survey' | 'spray';
  rotors: 4 | 6 | 8;
  maxFlightMin: number;
  topSpeedKmh: number;
  cameraMP: number;
  sensor: 'rgb' | 'multispectral';
  payloadL?: number;         // spray tank, if any
  driver: 'sim' | 'mavlink';
}

export interface Telemetry {
  droneId: string; t: number;
  position: { lat: number; lon: number; altM: number };
  headingDeg: number; speedKmh: number;
  batteryPct: number; gpsSats: number; linkQuality: number;
  mode: 'disarmed' | 'armed' | 'takeoff' | 'mission' | 'manual' | 'rth' | 'landing';
}

export interface Field {
  id: string; farmId: string; name: string;   // "North Wheat"
  crop: string; areaHa: number;
  boundary: GeoJSON.Polygon;
}

export type IssueKind = 'pest' | 'water-stress' | 'disease' | 'nutrient';
export type Severity = 'low' | 'medium' | 'high';

export interface Finding {
  id: string; flightId: string; fieldId: string;
  kind: IssueKind; severity: Severity; confidence: number; // 0-1
  geometry: GeoJSON.Polygon; areaM2: number;
  diagnosis: string;      // plain language
  action: string;         // what to do next
}

export type MissionPhase =
  'draft' | 'planned' | 'preflight' | 'takeoff' | 'scanning' | 'returning' | 'landed' | 'processing' | 'complete' | 'aborted';
```

The three HUD badges from the prototype map to `pest`, `disease` and `water-stress` (plus `nutrient` in the full system). Confirm the colors in the design tokens.

---

## 8. Build phases (in order)

### Phase 0: Monorepo scaffold
Set up pnpm workspaces, the folder structure above, TypeScript configs, ESLint/Prettier, `docker-compose.yml` (Postgres+PostGIS, MinIO), `.env.example` and `CLAUDE.md`.
**Done when:** `pnpm install`, `pnpm dev` (web + api), `pnpm test` and `pnpm build` all run clean, and `docker compose up` starts the database.

### Phase 1: Farms and fields
Auth (basic), farm CRUD, and a MapLibre map where the user draws a field boundary, names it and sets a crop. Store as PostGIS geometry; compute area.
**Done when:** a user can sign in, create a farm with 3 fields, and see them on the map after a reload.

### Phase 2: Fleet and mission planner
Drone registry with the three drones from the prototype as seed data (placeholder specs). "Choose your drone" cards. Mission planner: pick field(s), drone, altitude, overlap, speed; generate the lawnmower path (`surveyPlanner.ts`), estimate flight time and battery (`batteryEstimator.ts`), run `riskChecks.ts`, and preview the path on the map.
**Done when:** planner output is correct for rectangles and irregular polygons (unit tests), and warns when the mission exceeds the drone's endurance or the reserve limit.

### Phase 3: Bridge, drivers and live telemetry (simulated first)
Build `DroneDriver`, `SimDriver`, the bridge ↔ API ↔ web WebSocket pipeline, and the **live pre-flight check** (battery, propellers/motors status, GPS lock, link). Mission upload, arm, takeoff, RTH, land commands.
**Done when:** a full mission runs end to end on `SimDriver`: pre-flight → launch → fly the path → land, with live telemetry updating the web UI at ~5-10 Hz.

### Phase 4: Live flight view
Build the 3D digital twin and the map view from the prototype: Follow / Camera / Map toggle, HUD (battery, height, speed, GPS), coverage progress per field, Fly myself (manual joystick/keys) and Land now. Telemetry drives the 3D drone; the field geometry builds the 3D farm.
**Done when:** the live view stays smooth (60 fps desktop, 30+ fps phone) and matches the map view, and a lost-link or low-battery event shows a clear alert and triggers return-to-home.

### Phase 5: Real drone connection (MAVLink)
Implement `MavlinkDriver`. Develop and test against **PX4 SITL** first. Push geofence, altitude ceiling and failsafes to the autopilot. Then test on real hardware, **tethered or with a safety pilot and RC override**, in an open area, in small steps.
**Done when:** the same mission from Phase 3 runs on PX4 SITL with no UI changes, and `docs/hardware.md` documents the setup for the first real drone.

### Phase 6: Imagery pipeline and analysis
Bridge collects GPS-tagged images; API stores them in object storage and queues a job; the analysis service computes vegetation indices, finds problem zones, classifies them (rules first), and returns `Finding`s with plain-language diagnosis and actions. Start with **fake image sets** in `scripts/` so the pipeline is testable without flying.
**Done when:** uploading an image set produces a health heatmap layer on the map and a findings list, and the live HUD counters match the final findings.

### Phase 7: Results, actions and reports
Results screen (health map, findings, detail sheet), recommendations, flight history, and a per-flight PDF/printable report. **Prescription maps** (export zones for targeted treatment). Spray-drone missions (only on explicit confirmation, with safety checks).
**Done when:** a farmer can go from a finished flight to a prioritized action list in under a minute.

### Phase 8: Production hardening
Offline-tolerant UI, retry queues, roles and permissions, audit log of every drone command, i18n (English first, then Swahili and Hindi), alerts (SMS / WhatsApp / push), deployment guide, monitoring.

---

## 9. Rules for the simulation and analysis

- **The simulator is for dev, demos and training**, never presented as real results. Anything from `SimDriver` or fake image sets must be visibly labeled "Simulated" in the UI.
- Battery estimates must include a reserve (default 25%) and the return distance. Auto-RTH triggers before reserve is breached.
- Vegetation indices from an RGB camera (VARI etc.) are approximate. State the sensor used and the confidence on every finding. Never show a diagnosis as certain; show confidence and suggest a field check for low-confidence zones.
- Findings are deterministic for a given image set (same input, same output) so they are testable.

---

## 10. Instructions for Claude Code (also copy into `CLAUDE.md`)

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

### Kick-off prompt to paste into the CLI
> Read README.md fully. Start at Phase 0: scaffold the monorepo exactly as described, create the folder structure, add CLAUDE.md from Section 10, get install/dev/test/build passing and the database starting under Docker Compose. Then stop and summarize what you did before starting Phase 1.

---

## 11. Open questions for the team (answer these early, they shape Phases 3 to 5)

- Which **drone hardware and autopilot** are we building on (PX4, ArduPilot, a commercial frame)? This decides the first `MavlinkDriver` target.
- **Camera payload:** RGB only, or multispectral? This decides how accurate the crop-health analysis can be.
- Is the first product **survey only**, or **survey + spray**?
- **Connectivity** at the farm: where does the bridge run (laptop, phone, companion computer on the drone), and what is the internet like?
- Which **crops and regions** come first? That drives the issue library and recommendations.
- Which **aviation rules and permissions** apply where you'll fly, and who is the licensed operator?
