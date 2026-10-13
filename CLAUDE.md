# Crease Chase

A single-file, mobile-first 3D cricket **batting** game played against an AI bowler. No ads, no multiplayer, no backend.
It started as an original game inspired by the *style* of mobile cricket games; all names, art, teams and text are original.
Keep it that way: never copy another game's characters, logos, screens or branding.

## How the owner likes to work
- Before implementing anything non-trivial, compare 2-3 approaches, weigh them, and recommend one. Don't just build the first idea.
- If a requested approach looks wrong, say so and explain the better option before building.
- Verify time-sensitive or product facts (library versions, platform/API behaviour, pricing) instead of answering from memory, and cite sources.
- Owner is an experienced Java backend developer: skip beginner explanations, be direct.
- Batting feel matters more than graphics.

## Commands
```bash
npm ci                           # once (exact pinned devDeps from package-lock.json); then: npx playwright install chromium
npm run build                    # src/ -> dist/crease-chase.html (single self-contained file; game + three bundled by esbuild)
npm run test:balance             # bots play ~20k balls per row (footwork bots 100k) against src/logic.js; exits 1 if balance drifts
npm run test:smoke               # builds, plays each planet in headless Chromium, fails on page errors
npm test                         # both
npm run model:batter             # Blender (headless) + glTF Transform -> src/models/batter.glb (commit the .glb)
```
Open `dist/crease-chase.html` directly in a browser to play. `#test` in the URL exposes `window.__t` for tests.
Live at https://amitgadhekar.github.io/crease-chase/ (public repo, free GitHub Pages). Every push to `main` runs
`.github/workflows/pages.yml`: `npm ci`, balance test, build, deploy `dist/crease-chase.html` as `index.html`. A failing balance
test blocks the deploy. `dist/` is not committed.
Run `npm run test:balance` after any change to physics, timing windows, shot resolution, fielding, footwork or planet values.
Its footwork checks: "reads length" must beat the stationary bot by 5-25% runs/wicket; "always charges" and "always across" must not beat it.
Run `npm run test:smoke` after any change to rendering, flow or input, and look at `tests/screenshots/`.

## Layout
```
src/index.html            HTML shell + overlays (menu, intro, pause, end). @include markers are filled by build.mjs
src/styles.css            UI styles. Theme tokens on :root with dark-mode overrides
src/logic.js              PURE game logic, no DOM: physics, planets, delivery, shot resolution, fielding, AI brain
src/game/01-core.js ...   UI/game code. All files are concatenated IN FILENAME ORDER into ONE entry module (shared scope,
src/game/09-menu-boot.js  `import * as THREE from 'three'` on top). Keep the numeric prefixes; order matters for top-level consts
build.mjs                 Inlines CSS, logic.js and SFX into the HTML; bundles the game entry with esbuild (tree-shaken,
                          minified IIFE, target es2020/safari15) and inlines it. logic.js stays a plain script (balance test)
tests/balance.mjs         Balance simulator over src/logic.js (runs in node:vm)
tests/smoke.mjs           Playwright smoke test over dist/
src/models/*.glb          Skinned models, embedded as base64 (MODEL_DATA) by build.mjs; generated, but committed
tools/blender/            Model scripts run headless in Blender: rig.py (skeleton contract), sdf.py (shapes, meshing),
                          batter.py (the batter). tools/model.mjs runs Blender, then gltf-transform prune/dedup/quantize
```
Game modules: 01 core state, settings, sizing, camera + projection, planet application · 02 audio (WebAudio, recorded clips) ·
03 HUD/banner · 04 match flow + ball state machine + scoring · 05 input (pointer/keys, footwork joystick) · 06 sky drawing, particles,
2D overlays (aim arrow, radar, timing bar, info text), firework simulation · 07-arena stadium geometry (stands, sightscreens,
floodlights, boards, rope), instanced crowd, glow points (fireworks, floodlight halos) · 07-canvas procedural canvas textures
(ground, grass detail/normal, pitch, ads, wood, ball, seats, glow) · 07-geometry raw shape builders (`GB`, people parts) and
`geo`/`fillGeo` (-> BufferGeometry) · 07-people fielder/bowler species per planet (`SPECIES`, `spBuild`) · 07-render3d three scene (lights, environment, shadows, materials, people, bat, stumps,
ball), batter pose, view state, adaptive quality · 07-skin skinned batter (loads the GLB, drives its bones from the pose) ·
08 camera follow + main loop · 08b replay (recording, playback, replay cameras) · 09 menu wiring + boot.

## Core model (read before touching physics or rendering)
- **World coords (metres):** batter's stumps at z=0, bowler's stumps at z=20.12, +z toward the bowler, +y up,
  **+x = off side** (screen right from the default camera; right-handed batter). Batter stands at z=BATS_Z (1.05),
  ideal contact at z=CONTACT_Z (1.8). Shot angles are degrees in the ground plane: 0 = straight back past the bowler,
  +90 = square off side, -90 = square leg side.
- **Camera:** `cam` = position + yaw, looking horizontally (no pitch). `proj()` in 01-core is the single source of truth:
  screen = (CX + xc*F/zc, HZ - yc*F/zc). `syncCamera()` in 07 builds the three PerspectiveCamera to match it exactly: fov from F,
  `setViewOffset` puts the principal point at (CX, HZ), so 2D overlays drawn with `proj()` line up with the 3D scene. If you
  change one, change both; the smoke test asserts they agree within 0.5 px (`__t.cam3()`).
  Field of view is changed only by setting `F` (reset to `baseF`, like `HZ`/`baseHZ`), so both stay in sync.
- **Rendering layers:** `#sky` 2D canvas (gradient, stars, sun/moons with yaw shift, Jupiter bands, Venus clouds, Saturn rings)
  → `#gl` three WebGLRenderer (WebGL2, transparent clear) → `#scene` 2D overlay canvas, which also receives all pointer input.
- **Three scene graph** (07-render3d): `buildScene` creates every mesh once at boot (12 fielder rigs + bowler, batter rig,
  stumps, ball, ground layers, stadium meshes, crowd, glow points); `build3D` refreshes it per planet in place (canvas textures
  redrawn, stadium geometry refilled by `arenaGeo`, crowd re-seated, colours, lights, environment, fog); `render3D(V)` only sets matrices (`matrixAutoUpdate` off; `mB`/`mL`/`mT` write
  `mesh.matrix`), visibility and fog distance. Don't create three objects per frame. Everything sits in `T3.world`, mirrored
  in x, because game coordinates are left-handed. Flat ground layers (ground disk, ring, pitch with its painted creases and
  wear, fielder blob shadows, pitch marker) use `flat()`: no depth test, CustomBlending (keeps them in three's opaque list),
  painter's order by negative `renderOrder`; stadium, rope, crowd, stumps, people, bat and ball are depth-tested after them.
  All materials are DoubleSide; `fillGeo` rewinds triangles to match their normals (and loads vertex colours).
- **Look:** `colourSetup()`: colour management on, sRGB output, ACES Filmic tone mapping (exposure per planet). Colours given
  as arrays are sRGB (`col()`); canvas textures are sRGB except data maps (grass detail/normal). three mixes fog after tone
  mapping in output space, so a fog colour equal to `VIS.sky[1]` meets the 2D sky seamlessly. Surfaces are
  MeshStandardMaterial; players use `kit()` (adds a sky-coloured view rim, `RIM`, so they read against the grass). Light = one
  DirectionalLight (the sun) + image-based light: `envBuild` renders a sky dome (zenith, horizon, a band of stands, grass,
  brighter toward the sun) through PMREM once per planet; no hemisphere light. `LOOK3D` per planet: sun colour, intensity,
  azimuth, elevation (azimuths are on the off side behind the batter, so the batting view and the side-on replay both see a
  lit batter), env intensity, exposure, shadow strength/softness, rim, floodlight glow, fog. Lightning (`flash`) boosts the
  env. The outfield multiplies a tiled detail texture into the ground canvas (`DET`) and adds a tiled normal map.
- **Shadows:** PCFShadowMap (three r18x removed PCFSoft; PCF takes 5 hardware-filtered Vogel-disk taps, softness =
  `shadow.radius`). `fitShadow` fits the sun's orthographic frustum every frame to the ground the camera sees (screen-bottom
  ground point to 46 m, 60 m in replays, the whole ground in the celebration), in light space, so batting view, chase,
  replays and celebration all work (casters project onto their own shadows, so covering the visible ground covers them).
  Casters: people, stumps, ball. Receivers: ground layers, people, stumps. Fielders outside the frustum (`inShadow`) keep a
  soft blob. The light and its target live in the mirrored `T3.world`, so their x is negated.
- **Stadium** (07-arena, `arenaGeo`): a revolved step profile (front wall, lower tier, LED fascia, upper tier cantilevered
  2.5 m over the lower one when standsH>=10.5, back wall, roof canopy over the back rows, rows under it shaded); its back edge stays at
  (BOUNDARY+7+1.15*standsH, standsH) because fireworks launch there and `renderSky` clips the sky there. Seat-back strips
  (seat texture), framed off-white sightscreens on legs at both ends (R+4.2), four floodlight towers (emissive panels + glow halos), LED boards at R+3 with
  gaps at the sightscreens, a tube rope at R. Static parts share one vertex-coloured mesh.
- **Crowd:** one 44-triangle spectator, an InstancedMesh per 30° sector (three culls sectors out of view), shirt colour via
  instanceColor, skin via `aSkin` on the head vertices. Seats are filled most-wanted first (the end behind the bowler is
  weighted 5x), so a lower count keeps that end full. Idle bob and cheering jumps run in the vertex shader (`CRWD.u`);
  `V.cheer` (recorded for replays) rises when a boundary's ball crosses the rope and in the celebration, stronger near the
  camera. Shirts are muted with team-colour clusters (`KIT.you` / AI kit), and fade toward the fog colour with distance. Decorative randomness uses `prng`, never `Math.random` (the game's RNG).
- **Glow:** fireworks and floodlight halos are additive `THREE.Points` with a radial glow texture (`addBlend`: colour adds,
  alpha is kept, so over the transparent sky the premultiplied canvas composites them as light), not tone mapped, no fog.
  `fw3D` fills the points from `FW` (06) each frame: rocket head + trail, spark + two trailing points.
- **Adaptive quality** (no UI): `qTick` measures the average frame time over 90 frames after 1.2 s of play; above 22 ms it
  steps down one tier and measures again, otherwise it locks for the session. Tiers (`QT`): 0 shadow map 2048, full crowd
  (15000 desktop / 9000 phone), DPR cap 2.5 · 1 shadow map 1024 · 2 crowd halved · 3 GL canvas DPR cap 1.5 (`glSize`; the
  2D canvases keep theirs). iOS Low Power Mode (30 fps cap) also reads as slow and drops tiers, which saves battery anyway.
  `#test` exposes `window.__r` (`info`, `tier`, `setTier`).
- **Time:** game clock `clock` only advances when not paused. Input timestamps are converted with `gameTimeAt()` so
  pausing never desyncs timing.
- **Ball state machine** (`S.phase`): `break` (new over banner) → `ready` (countdown, `BALL_GAP` = 2 s) → `runup`
  → `flight` → `result` → (`replay` after a four or six, unless the match/innings just ended) → back to `ready`, or `break`
  at an over boundary. Swings resolve at `tc = release time + SWING_DELAY`.
  Stump checks and swing resolution are processed in chronological order within a frame (see `flightUpdate`).
  A chase win goes to `celebrate` (~6 s, tap/key skips): bat raise, then `celCam` flies out to a wide orbit (camera raised,
  `HZ` moved up, `F` zoomed out; framing derived from the stand radius) with fireworks (`FW` in 06, max 600 sparks).
  `endMatch` does the records/end-screen bookkeeping once; `showEnd` shows the end screen.
- **Timing:** windows in `EARLY`/`LATE` (late is tighter: the ball is past you), scaled by difficulty `win`.
  Early timing pulls the shot to the leg side, late pushes it to the off side (`dir = aim + dt*300`).
- **Shot quality:** `q = timing quality * (0.35 + 0.65 * shotFit)`. `shotFit` compares ball length/line with the chosen
  shot's preferred length/line (`SHOTS`). Poor fit can turn into an edge or top edge even with perfect timing.
- **Batting input:** pull back like a slingshot (only mode). Drag length = power.
  Ground shot by default; the **Loft** button lofts the next shot only and resets every ball (deliberate, so lofting
  can't stay on by accident). Tap = block, no touch = leave.
- **Footwork:** `S.bpos={x,z}` = batter offset from guard in metres (+z down the pitch, +x across to off; z -0.5..1.8,
  x ±0.6). Replays record it per frame: keep the name and shape. Driven by the `#stick` joystick (bottom-left, own pointer
  id so the other thumb bats on `#scene` at the same time) or arrows/WASD, velocity control 2.5 m/s forward, 2 back/across
  (`footUpdate`, 05). Free in `runup` and in `flight` until the ball pitches or a swing is released; walks back to guard in
  `ready`/`break` and is zeroed at run-up start. Drawn as a chassé gait (`feetTick`, 07) on top of the pose.
- **Moved contact point:** `footAt(b,bp)` in logic.js is the single source: `t` (ideal contact time at CONTACT_Z+bp.z),
  contact `c`, `xc` (line relative to the batter), `full` (length met), `gain`, `awk`. `b.tIdeal` is the stationary value
  only; anything that judges or shows timing uses `footAt`. `evalSwing` reads `sw.bp` (set in `doSwing`). Reach is checked
  on `xc` (`REACH_LEG` -0.65: balls behind the legs can't be hit). `gain`: good length is the zone of uncertainty, so footwork
  that takes the ball out of it (or goes back to a short ball) widens the timing windows ×(1+0.35·gain) and adds 0.25·gain to
  shot fit; footwork into it costs. Charging a short ball meets it on the rise (`awk` cuts shot fit).
- **Pads, LBW, stumped:** `legsAt` places both pads from the trigger-step feet (`FOOT` = the BP.fw/bk/tr feet in 07; change
  both together) plus `bp`; `padHit` = first leg the ball reaches. `padResult` applies the LBW law (not pitched outside leg;
  impact in line, or outside off only with no shot offered; would hit the stumps = `b.onStumps`), else "Hit on the pad" and
  the ball drops. In `flightUpdate` the pad event replaces the stumps check and waits for a pending swing (late swings can
  still connect). More bowled when moving to leg, more LBW when moving across, emerge from this geometry. `stumpedResult`
  at the keeper (tEnd): beaten or left with the back foot (0.8+bp.z) past the popping crease (1.22); 0.88 vs spin (keeper
  up), 0.3 vs pace; bails only. The balance bots use the same functions via `beaten()`.
- **Batter animation** (07, visual only): full-body procedural pose (25-number arrays: feet, hips, spine, shoulders,
  hands, bat, head, blade face azimuth `qFC`), knees/elbows by 2-bone IK. `poseTick` blends from the pose on screen: trigger step from delivery
  length during flight, per-shot impact/follow-through (`SH3`, one per `SHOTS` entry), block, leave, celebrate.
  The impact pose must land exactly at release + `SWING_DELAY`: the player's timing is anchored to it visually.
  Contact: `aimSwing` picks `sw.cp` (ball at tc, clamped to the shot's reach; else where the path passes nearest the bat), bend limits per shot family (`FAM`, `shapeFor`: drives/blocks upright, pulls/cuts flat), `bend` puts the blade point for the kind (`BK`) on it with the face (`qFC`, `faceFor`: between the ball and the shot direction) toward it (misses clear over the whole swing), `ballNow` time-warps the last `SWING_DELAY` to reach it, `recContact` records that frame for replays.
- **Skinned batter** (07-skin, tools/blender): one smooth skinned body (skin, shirt, collar/cuff trim, trousers; 4
  material groups, ~5.2k tris) plus rigid kit parented to bones (helmet + grille, pads, gloves, shoes; ~4.7k tris), 19 bones,
  ~180 KB GLB, ambient occlusion baked into vertex colours. `batJoints(p)` (07-render3d) turns a pose into joints; both
  the procedural parts and the skeleton use it. **Skeleton contract** = `tools/blender/rig.py` (`HUMAN` lengths = the
  pose's: thigh/shin .43, upper arm .31, forearm .30 to the grip, shoulders ±.19, spine+chest .5, neck .17; rest A-pose in
  game coordinates, L = front side). Each bone stores rest `aim`/`ref` vectors (glTF extras -> `bone.userData`);
  `skinVecs` gives the same two vectors from the pose (limb line + IK pole for elbows/knees, toe for shins, bat for hands,
  half twists for spine and neck, clavicles follow 15% of the arm swing), and `skin3D` sets `bone.quaternion` to map one
  onto the other (no AnimationMixer). Only the pelvis, hands and feet get positions: hands/feet are pinned to the pose's
  hand points and ankles (a leg stretched past its reach stops short otherwise). The bat stays procedural (`batsman3D`),
  so contact targeting is untouched. If the GLB fails to load, the procedural batter below stays (`__r.skin()` says why).
  Materials are replaced by name with `kit()` ones (KIT colours, vertex colours on). Species can reuse the rig with their
  own `HUMAN`-style lengths. Regenerate with `npm run model:batter` (Blender 5.2 at /Applications or `BLENDER=`; a
  `-- --render DIR --poses poses.json` run renders turntables and game poses; `__r.drive()` dumps a pose).
- **People models** (07): limbs are tapered capsules built once per fixed bone length (`capG`, `mL`), so joints blend
  without gaps; changing a bone length means rebuilding its geometry. Batter parts in `BG` (fallback); fielders/bowler are lower poly,
  13 meshes each (`personRig`/`batterRig` create them, `person3D`/`batsman3D` pose them). `GB.surf`/`GB.join`
  in 07-geometry build smooth parametric shapes; materials come from `kit()` (roughness per surface: glossy helmet, metal grille, wood-grain blade).
- **Species** (07-people): fielders and bowler are a species per planet (Earth humans, Selenites, Scorchlings, Cloudwaders,
  Rustkin, Gravitons, Ringlings, Tidefolk); the batter stays human. `SPECIES[planet]` sets bone lengths and radii (1.4 m to
  2.2 m tall), torso scale, gait (`st` stride, `lf` lift, `fq` cadence, `fl` low-gravity float), delivery bound `jp`, legwear,
  and head/hand/foot builders. `spBuild` builds a species' parts once (cached), `spApply` swaps geometry and maps on the 13
  rigs per planet. `person3D` places legs and arms by IK with the species' own lengths (`limb`), so nothing stretches; the hip
  drops to keep feet on the ground. Skin, eyes and glow share one material: a 128 px atlas (pattern for limbs and head, four
  swatches for features) as colour, emissive and roughness maps, so features cost no draw calls. Budget: 13 meshes per person
  (thighs, shins, feet, torso, sleeves, forearm+hand, head with features, one extra: cap or Saturn's ring), 12 without the
  extra. The torso texture paints trousers below the waist. The bowler's arm angle at release is fitted per species so the
  hand meets the ball's release point (0.03-0.5 m; tallest species are furthest off for spin; `BZR` places the delivery stride). In the win celebration fielders
  stand dejected (`V.dej`, three variants by index; not recorded, replays end before it).
- **Audio** (02): recorded MP3 clips in `src/sfx/` (filename = role, e.g. `fw-launch.mp3` -> `SFX_DATA.fwLaunch`), embedded as base64 by
  `build.mjs` (`@include-sfx` in src/index.html) and decoded once on AudioContext creation; sounds requested before decoding are skipped.
  `play(name,{vol,rate,delay,lp})` -> master gain + compressor. Bat kind (mid/edge/top/block) is picked from the result label (`bat`, `edge`, `mishit`, `block`).
  Crowd bed loops via `loopStart/loopEnd`. Only thunder is still synthesized. Clip sources/licences are listed in README.md.
- **AI bowler brain:** per length/line stats of runs and wickets conceded (`mem`, persisted in localStorage `cc_mem`,
  capped at 40 samples). Weights favour what has cost it least; hard mode avoids repeating a length 3 times; pressure
  situations add yorkers/bouncers; slower balls by difficulty. `brainInsight` produces the "Bowler's plan" text.
  Footwork tendency: `M.foot` is a moving average of `S.bpos` per ball (`footTrend`), passed as `ctx.foot`; `footPlan` turns
  it into charge/back/across weights that scale lengths and lines (`FOOT_LEN`, `FOOT_LINE`: shorter and wider vs chargers,
  fuller vs back-foot players, straighter and yorkers vs moving across), and the plan text then names it (`FOOT_NOTE`).
- **Field AI:** each over, moves up to N ring fielders deep into the sectors where the batter scored most (`fieldFor`).
- **AI innings:** simulated instantly (`simulateAI`), scaled by each planet's `ai` multiplier.
- **Planets** (`PLANETS` in logic.js): physics (`g`, `air`, `swing`, `spin`, `bounce`, `pace`, `boundary`, `wind`, `ai`)
  plus `vis` for the look. `setPlanet` derives `ENV.carry`, `ENV.acc` (ground deceleration), `ENV.run` (fielder speed).
  Wind is rolled per over and drifts lofted shots. 3D lighting and fog per planet live in `LOOK3D` (07-render3d.js).
  If you change planet physics, re-run the balance test and update that planet's `ai` multiplier to the measured
  "scoring vs Earth" ratio (the test checks they stay within 0.8-1.25 of each other).
- **Chase camera:** on fours and sixes the camera follows the ball (`updateCam`), and the banner and score reveal are
  deferred until the ball crosses the rope (`S.deferred`). The batter is hidden while the chase camera is active.
- **View state and replays:** `render3D`/`draw` read the ball, batter pose, bowler, fielders and stumps only from a view object `V`. `liveView()` (07) builds it from
  live state each frame (it also runs `poseTick`/`bowlerState`, which are stateful, once per frame). From `runup` to the end of
  `result`, `recFrame` (08b) copies `V` into one preallocated Float32Array (107 floats/frame, max 600 frames, ~250 KB, current
  delivery only). In the `replay` phase `rpView()` rebuilds `V` from the buffer, blending the two nearest frames. **Any new
  per-frame render state must be added to `V` in `liveView`, to the frame layout in `recFrame`/`rpView`, and read from `V` in
  render code**, or replays will show live state instead. Replay is not re-simulation (randomness is unseeded).
  Cameras (`rpCam`): side-on from the off side in slow motion (0.6x easing to 0.35x near contact) until 0.4 s after contact,
  then a spider-cam trailing the ball (closer and lower for low balls, backs off and rises for high ones so the stands stay in frame) at 1x until 0.3 s after it crosses the rope, with a glow ring on the ball (`rpGlow`). Tap/key/Skip skips after 0.3 s.
  The batter is shown in replays (the live chase camera hides it).

## Constraints to keep
- Output must stay ONE self-contained HTML file: inline CSS/JS, works offline, nothing loaded from a CDN at runtime
  (Google Fonts are optional with fallbacks). It is hosted on GitHub Pages and can also be published as a claude.ai artifact, whose CSP only allows scripts from
  cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, cdn.tailwindcss.com, code.jquery.com and styles from fonts.googleapis.com.
  Build-time npm deps (three, esbuild, playwright, @gltf-transform/cli for the model pipeline) are devDependencies pinned to exact versions that were at least two weeks
  old when added; the lock file resolves from registry.npmjs.org. three r163+ needs WebGL2 (iOS 15+).
- localStorage keys are prefixed `cc_` (settings, mem, records); every access is wrapped in try/catch.
- Mobile first: portrait iPhone, safe-area insets, `touch-action:none` on the input canvas, 44px+ touch targets.
- Keep `src/logic.js` free of DOM access so the balance test can run it in Node.

## Decision log
- Batting control: compared one-tap timing, single swipe, and drag-to-aim/release-to-swing. Chose release-to-swing
  (aim and timing are separate skills; finger-up timing is precise on phones). Then switched to slingshot aiming at the
  owner's request (finger stays low, doesn't cover the ball); "point the way" was removed by owner decision.
- Loft: button applying to one ball only, rather than drag length or a sticky toggle.
- Venues are planets, not cities, by owner request. Physics differences are real, not cosmetic.
- 3D: started on a custom ~100-line WebGL engine (CDN unreachable, single offline file). Moved to Three.js for the visual
  upgrades (shadows, PBR lighting, 3D crowd, bloom), bundled by esbuild so the file stays offline and self-contained
  (+~530 KB). Phase 1 was a parity port (same look, overlays aligned); engine.js removed. Babylon.js and PlayCanvas were
  rejected for size. Phase 2: sRGB/ACES, PBR + PMREM sky light, view-fitted shadow map, procedural textures, tiered stands,
  3D crowd, 3D fireworks (+~30 KB, the build is ~1.0 MB).
- Fielders/bowler as procedural alien species per planet on the existing rig, over downloaded CC0 models: a Mars trial
  showed a style clash with the batter, no bowling action and +350 KB.
- Batter: a smooth skinned model scripted in Blender (signed-distance shapes -> surface nets -> voxel remesh ->
  decimate, automatic weights), rigged to our own skeleton so the procedural pose drives it and the bat/contact code is
  unchanged. Loaded with three's GLTFLoader rather than a custom loader for robustness (+~79 KB code; model +~238 KB as
  base64; the build is ~1.35 MB). No meshopt/Draco: WebAssembly may be blocked by the artifact CSP. Quadriflow remeshing was tried and refused
  the mesh; decimation with its symmetry option folded faces along the mirror plane, so it runs without it.
- Glow: additive glow sprites (fireworks, floodlight halos) instead of UnrealBloomPass. Bloom needs an EffectComposer: a
  full-res HalfFloat target (~24 MB at 1170x2532, ~4x with MSAA, else the scene loses antialiasing), fog then mixes in linear
  space before tone mapping so it no longer matches the 2D sky, and its cost is fill rate, which headless swiftshader (CPU,
  vertex-bound here) cannot show: tried at full res, frame time was within noise there. Sprites cost one draw call each set.
- Pause between balls: `ready` phase with a countdown, fixed at 2 s (`BALL_GAP`; the time-between-balls option was removed by owner decision), plus longer run-ups.
- Footwork control: a bottom-left joystick (velocity, own pointer) over swipe gestures or dragging the batter, because the
  right thumb is already busy with the slingshot and swipes would collide with it. Arrows/WASD on desktop.
- Footwork payoff: a timing-window and shot-fit `gain` from leaving the good-length zone. Shot fit alone (1:1 effective
  length, also tried 2-3x) gave a length-reading bot under 3%, because drives tolerate length; with `gain` it gets ~+15%.
- LBW added with footwork, pads from the trigger-step feet. The always-swinging bot rarely misses, so its LBW share is ~4%;
  human-like play (90 ms timing spread, 15% leaves) gives ~15-20% of dismissals, close to real cricket.

## Known gaps / backlog (ranked as discussed)
1. Bowling: let the player bowl (line, length, pace, variations) to an AI batter, so a match is two real innings.
2. Career: ladder of AI teams, coins from wins, batter upgrades (timing window, power).
3. Achievements (e.g. 3 sixes in an over, chase 20+ in the last over, 10 perfect-timing shots).
4. Original collectible characters/kits as part of career.
5. Unverified on real iPhone hardware: frame rate (~145 draw calls/frame between balls including the shadow pass, measured
   with the skinned batter at 14 meshes, was 22; ~250 in the celebration orbit; ~160k triangles, mostly crowd). The adaptive tiers react to it; if still slow: merge person parts into
   one mesh per person (halves draw calls, also in the shadow pass), drop fielders from the shadow pass in the celebration.
- No wicket-keeper is drawn (it would block the batter from this camera); the keeper still exists in fielding logic,
  and stumpings just knock the bails off.
- Sun/moons/stars are screen-space with a yaw shift; Saturn's rings don't rotate with the chase camera.
