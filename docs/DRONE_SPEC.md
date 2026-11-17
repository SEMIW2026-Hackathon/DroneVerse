# Drone and scene visual spec (match the concept video)

Source: the Droneverse concept video (frames saved in `docs/reference/`). **These images are the visual target.** When anything below conflicts with the images, the images win. The video is low resolution, so small details are marked "inferred".

## 1. The drone model (Condor X8 is the reference)

**Body**
- A rounded, glossy **dome shell** on top, with a small lighter circular badge or button at the very top. **Condor X8: yellow. Sparrow S4: white** (confirmed by the team). Kestrel H6 looks darker with orange details in the picker frame, so confirm its shell color with the human.
- A **dark charcoal underbody** beneath the shell, slightly wider than the dome, with a small dark **camera gimbal pod** hanging under the front.
- Proportions: body is compact, arms are long and thin relative to the body.

**Arms and motors**
- **Slim dark arms radiating evenly** from the body: 8 for Condor X8, 6 for Kestrel H6, 4 for Sparrow S4. Arms sit slightly below the shell's rim and are nearly horizontal.
- Each arm ends in a **dark cylindrical motor housing with a colored accent ring** (blue on Condor X8; orange on Kestrel H6; Sparrow accent to be chosen, see "Open questions").
- Each motor has a **propeller on top**: two or three thin blades, with a faint white translucent halo when spinning.

**Landing gear**
- **Two curved skid legs** hanging below the body, dark with small accent-colored (blue) feet. They stay down at all times.

**Lights (inferred)**
- Small **glowing nav lights** at the motors: green at the rear, red toward the front, plus a soft **warm yellow glow** near the rear motors when flying. Lights glow, they don't need real light casting.

**Material feel:** soft, toy-like, flat-shaded with gentle gloss. No harsh realism, no textures. Colors: warm yellow (#F2B400 area), charcoal, accent blue or orange.

## 2. Drone motion

Match these behaviours from the video:

1. **Rotor spin-up before liftoff.** Status text reads "Spinning up 8 rotors" (use the real rotor count). Rotors accelerate from stopped to full speed over about 1.5 to 2 seconds BEFORE the drone leaves the pad. At rest the blades are visible as thin shapes. At speed they become a **motion-blurred translucent disc**.
2. **Takeoff:** a smooth vertical climb with ease-in and ease-out, with a tiny wobble. The HUD height counts up (video shows 4 m, then 17 m).
3. **Pitch into travel:** in flight the body **tilts nose-down** by a few degrees in proportion to speed, and **rolls (banks) slightly when turning**. Use smoothing (lerp or damped spring), never snap.
4. **Hover bob:** a very gentle vertical bob (about 1 to 2 cm of apparent motion, slow) plus tiny random sway, so it never looks frozen.
5. **Heading:** the drone rotates smoothly to face its direction of travel.
6. **Scanning pass:** while scanning, the drone holds a steady altitude, moves in straight lines, and slows slightly at line ends and turns.
7. **Landing:** descends slowly, rotors spin down over about 1.5 seconds after touchdown, and the scan beam is off.
8. **Rotor spin is driven by the real state** (armed, mission, disarmed), not just decoration.

## 3. Camera behaviours

- **Follow** (default): trails behind and slightly above the drone, with gentle smoothing and a slight sway, and drag-to-look-around plus pinch/scroll zoom. The video shows hints "Drag to look around, pinch to zoom".
- **Camera** (drone's own view): a first-person view looking **down at the crop** with a gimbal tilt (the video shows "TILT -32°"). Overlay: thin **corner brackets** at the screen corners, a small **crosshair** reticle, and a label such as "THERMAL + MULTISPECTRAL" (show the real sensor type of the selected drone, for example "RGB" for Sparrow). Nothing of the drone body should appear in this view, and the camera must never clip inside the model.
- **Map:** top-down view of the farm.
- **Pedestal (drone picker):** the drone sits on a **white round platform** with soft shadow, slowly turntable-rotating, with a slight tilt so the body and arms are visible.
- **Pre-flight and takeoff:** the drone sits on a **dark round helipad with a yellow ring, a white "H" and yellow dashes**.

## 4. Scene style

- **Look:** soft low-poly "toy farm" with rounded, friendly shapes. Blue sky gradient, a sun, **soft white clouds**, **distant rolling hills** on the horizon.
- **Trees:** two kinds, **round canopies on brown trunks** and **conifers**. Clustered along edges, not scattered randomly.
- **Fields:** **rectangular crop patches with visible row stripes**, in varied greens and yellow-greens so fields read as different crops. Wheat reads as fine yellow-green rows, not cones or trees.
- **Dirt path** crossing between fields, a **small blue pond**, and a **windsock on a pole** (orange and white) near the helipad.
- **Problem patches:** soft **red/brown circular discolored patches** on the crop (used for the issue badges). They appear on the field and are what the scanner finds.
- **Scan beam:** a **translucent teal cone** from the drone down to the crop, with the scanned strip tinted teal.
- **HUD (match the video):** rounded white floating cards. A top mission card with title, subtitle and % progress segmented per field. View toggles (Follow, Camera, Map) and a speed pill (1x). Zoom +/- on the right. A bottom sheet with Auto-pilot / Fly myself / Land now and stats: battery, height, speed, GPS, plus three small colored issue counters.

## 5. Build approach (read this before coding)

Two paths. Pick one and say which:
- **A. Procedural (primitives in react-three-fiber).** Rounded dome from a sphere or lathe geometry, arms from cylinders or boxes, motors from cylinders, skids from tube geometry, blades from thin boxes, halo discs from transparent circles. It can get close to the video and keeps the "no downloads" rule in the README. Quality depends on care with proportions, colors and motion.
- **B. A real modeled asset (.glb).** To match the video *exactly*, the drone really needs to be modeled in a 3D tool (Blender) and loaded with `useGLTF`. This changes the README rule "no external model downloads", so record it in `docs/decisions.md`. If the team has a 3D artist, this is the best route.

Start with A. Ask the human for B only if A cannot reach the look after two honest attempts.

## 6. Acceptance checklist (compare against `docs/reference/` images, side by side)
- [ ] Yellow dome, dark underbody, slim arms, accent motor rings, skids, correct rotor count per drone
- [ ] Rotors spin up before takeoff and blur at speed; spin down after landing
- [ ] Nose-down pitch in flight and bank in turns, smoothly
- [ ] Gentle hover bob; never perfectly static
- [ ] Follow, Camera and Map views all work, and the camera never clips into the drone
- [ ] Camera view shows brackets, crosshair and sensor label
- [ ] Wheat and other crops read as rows, not trees
- [ ] Pedestal, helipad, windsock, pond, path, clouds and hills are present
- [ ] Runs at 60 fps on desktop, 30+ on a phone
- [ ] HUD says "No signal" (not "Live") when telemetry is lost

## Open questions for the human
- Sparrow S4 is WHITE. What accent color for its motor rings? (Suggest green or teal unless told otherwise.)
- Kestrel H6: confirm shell color (looks dark with orange accents in the video).
- Path A (procedural), or path B (a ready-made or modeled .glb)? If B, see "Using a .glb model" below.

## Using a .glb model (path B details)
- Format: **.glb** (binary glTF), saved in `apps/web/public/models/`. Load with `useGLTF` from `@react-three/drei`, and `useGLTF.preload` the file.
- **Rotors must be separate named meshes** (for example `rotor_1`, `rotor_2`) so they can spin and blur. A model with rotors fused into the body can't do the spin-up motion.
- **Rotor count differs per drone** (4, 6, 8). Plan one model per drone, or one base body with arms and rotors added in code.
- **Colors come from code.** Find materials by name and override color and accent per drone (Sparrow white, Condor yellow with blue accent, Kestrel dark with orange accent), so a downloaded model can be restyled to match the video.
- **Budget:** under about 2 MB per model, low polygon count, compressed with Draco or meshopt (gltf-transform). Test on a phone.
- **Licenses:** use only models that are CC0 or CC-BY (keep attribution in `docs/CREDITS.md`). **Avoid "non-commercial" (NC) licenses**, because this is a product.
- Record the decision in `docs/decisions.md`, since it changes the README rule "no external model downloads".