# Drone build recipe (procedural, three.js / react-three-fiber)

Read `docs/DRONE_SPEC.md` and the images in `docs/reference/` first. This file says HOW to assemble the Kestrel H6 (6 rotors) and Condor X8 (8 rotors). The Sparrow S4 uses the downloaded .glb and is already in place.

## Why this exists
The first attempt produced a sphere with separate floating propeller crosses: no arms, no motors, no skids. Every part must be attached to a parent, so the whole drone moves, tilts and banks as one object.

## Structure (one `<group>` per drone, everything is a child)
```
Drone (group)                      <- position, heading, pitch, roll, hover bob applied here
├─ Body
│  ├─ Shell: dome (hemisphere), glossy, shellColor
│  ├─ ShellBadge: small flat disc on top, lighter
│  ├─ Underbody: short cylinder, dark charcoal, slightly wider than the dome
│  └─ GimbalPod: dark sphere under the front, with a tiny lens disc
├─ Arms[n]                        <- n = 6 or 8, evenly spaced, rotated around Y
│  ├─ ArmBar: slim dark box from the body outward
│  ├─ Motor: dark cylinder at the arm tip
│  ├─ AccentRing: thin torus around the top of the motor, accentColor
│  ├─ NavLight: tiny emissive sphere (green on rear arms, red on front arms)
│  └─ Rotor (group, spins on its own axis)
│     ├─ Hub: small cylinder
│     ├─ Blade x2: thin flat boxes
│     └─ BlurDisc: transparent flat circle, opacity rises with spin speed
└─ Skids x2: curved tubes under the body, with small accentColor feet
```

## Proportions (units are relative to body radius R = 1)
- Shell: hemisphere radius 1.0, squashed to height about 0.55
- Shell badge: radius 0.22, sits on the top
- Underbody: radius 0.95, height 0.35, directly below the shell
- Gimbal pod: radius 0.25, at about (0, -0.55, +0.6), i.e. below the front
- Arm length (body center to motor center): 2.4 for both drones
- Arm bar: cross-section about 0.1 x 0.1, nearly horizontal, sitting just below the shell rim
- Motor: radius 0.2, height 0.3, centered on the arm end
- Accent ring: radius 0.2, tube thickness 0.03, around the motor top
- Rotor: sits 0.2 above the motor top, blade length 0.9 (radius about 0.45), width 0.12, thickness 0.02
- Blur disc: radius equal to the blade length, opacity 0 at rest up to about 0.25 at full speed
- Skids: two tubes along the Z axis at x = ±0.55, curved down to y = -1.0, with a small foot at the bottom of each end
- Arms are spaced by 360 / n degrees. Offset the first arm so that no arm points straight along the nose axis (so the front has a gap for the gimbal).

## Colors (put them in a config file, not inline)
| Drone | Shell | Accent | Notes |
|-------|-------|--------|-------|
| Condor X8 | yellow (about #F2B400) | blue (about #2F6FED) | matches the video |
| Kestrel H6 | dark charcoal (about #2B2F36) | orange (about #F28C28) | from the picker frame in the video |
| Sparrow S4 | white (from the .glb) | to be chosen | already built |
Arms, motors, underbody and skids are dark charcoal on all drones.

## Scale between drones
Use one config (for example `DRONE_SCALE`) so the size order is visible: Sparrow smallest, Kestrel medium, Condor largest. The Sparrow .glb is about 0.7 units wide, so scale the procedural drones so that Kestrel is about 1.0 and Condor about 1.4 of that. Frame the camera so all three look sensible at the same default distance.

## Motion hooks (details in DRONE_SPEC.md section 2)
- `rotorSpeed` (0 to 1) comes from flight state (disarmed = 0, armed = idle spin, flying = full). Spin-up takes about 1.5 to 2 seconds. Alternate rotor directions (clockwise, counter-clockwise).
- Blur disc opacity follows rotorSpeed.
- Pitch (nose-down with speed), roll (bank when turning) and hover bob are applied on the root Drone group with smoothing.

## Done when (verify with screenshots, not just "it compiles")
- [ ] From Follow view at three angles (front, side, top-down), every propeller sits on a motor, every motor on an arm, every arm on the body. Nothing floats.
- [ ] Kestrel shows 6 arms and Condor 8, evenly spaced, and the Condor is yellow with blue accents.
- [ ] Skids and gimbal pod are visible from the side.
- [ ] Rotors stay still when disarmed, spin up on arm, and blur at speed.
- [ ] The three drones are visibly different sizes, in the order Sparrow, Kestrel, Condor.
- [ ] The whole drone tilts as one object when it pitches or banks.
- [ ] Side-by-side check against `docs/reference/ref-1`, `ref-2` and `ref-3`. List honestly where it still differs.