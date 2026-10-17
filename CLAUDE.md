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
npm run test:balance             # bots play ~20k balls per row (footwork bots 100k) + T20 full matches and first innings, 300 per row (T20_N=) + every scenario (SCEN_N=300) against src/logic.js; exits 1 if balance drifts
npm run test:smoke               # builds, plays each planet, a T20 (bowled balls with forced inputs, resume mid-over, Simulate rest, two chase overs with resume), forced fielding plays (edge to the cordon, ring dive, deep catch, a dive in a replay, keeper in the bowling view), throws back (ring, a diving stop's landing in the countdown, deep, on the winning ball (cleared), in the bowling view a forced direct hit at the bowler's end and a deep stop or fetch to the keeper with Bowl off until both walk back, landscape), catch replays (deep, cordon, caught and bowled if one comes up, the last wicket before the end screen, a ring catch in the bowling view, landscape), the other replay kinds (`replay2`: bowled, LBW, a shout not given, a shave, stumped, drops close and deep, a rope save, a hands-on chance and a six's leap, the last wicket bowled, bowled in the bowling view, LBW in landscape), three scenarios, a landscape pass (844x390) and the characters' gates (`chars`, below) in headless Chromium, fails on page errors
npm test                         # both
npm run model:batter             # Blender (headless) + glTF Transform -> src/models/batter.glb (commit the .glb)
npm run model:fielder            # the same for src/models/fielder.glb (the fielding sides' shared body, keeper kit, Earth head and cap)
npm run lab                      # character lab: builds dist/lab.html, plays tests/charlab/sequences.json on every planet and kit,
                                 # shoots cameras.json, gates thresholds.json -> tests/charlab/out/<run>/ (~17 min; -- --quick: Earth,
                                 # -- --gates: no shots, exit 1 on a red gate; -- --seq a,b / --species x / --diff A B / --baseline run)
npm run test:motion              # node checks of src/game/07-motion.js (springs, gait, anchors, IK, hands2) in node:vm
```
Open `dist/crease-chase.html` directly in a browser to play. `#test` in the URL exposes `window.__t` for tests, `window.__r`
(render and skinning: `info` draw calls/triangles, `tier`/`setTier`, `skin()`, `skinErr()`, `contact()`, `body(i)`, `rig(i)`,
`drive()`) and `window.__lab` (07b-lab, the character lab: `on` (a lab clock behind performance.now, the GL render stubbed except
`render`), `seed`, `start`, `step(dt)` at 120 Hz, `ball`/`swing`/`backlift`/`foot`/`duck`, `arm` a forced play, camera lock `look`/
`game` (one guard line at the top of `updateCam`), `kits`, dumps `joints`/`caps`/`verts`/`frame({caps,verts})`/`anchors`/`drive`).
`#test&nomodel` leaves the GLBs unloaded (the procedural fallbacks).
Live at https://amitgadhekar.github.io/crease-chase/ (public repo, free GitHub Pages). Every push to `main` runs
`.github/workflows/pages.yml`: `npm ci`, balance test, build, deploy `dist/crease-chase.html` as `index.html`. A failing balance
test blocks the deploy. `dist/` is not committed.
Run `npm run test:balance` after any change to physics, timing windows, shot resolution, fielding, footwork or planet values.
Its replay checks (`hlRates`, std / human / bowling rows): near misses (shave + shout) <= 0.5 replays per over, the new kinds 0.01-1.2,
all replays 0.5-3.6 per over.
Its footwork checks: "reads length" must beat the stationary bot by 5-25% runs/wicket; "always charges" and "always across" must not beat it.
Its T20 checks (full matches: a bowling bot bowls the player's attack at the AI batters, then the batting bot chases as the XI with
tiers and strike rotation, no Hold): standard bots win easy >=75%, medium 40-60%, hard <=25% on Earth and 35-65% on medium on every
planet; first-innings totals never fall from easy to hard on any planet (Earth medium 140-200); "always loft" wins fewer chases on
medium and hard (pooled targets); on easy and medium the death outscores the middle overs tier for tier; accurate bowling concedes
<=90% of careless bowling; "always yorker", "always bouncer" and "same spot" each concede more than the standard bowling bot on
medium and hard; a random legal field concedes more per ball than the captain's plan (same deliveries); zero illegal fields, bowler
picks, consecutive overs or quota breaches (plus captain and field fuzzing, the player's attack and random legal picks included).
Its Test checks: a seeded fingerprint of the short-format and T20 rows is unchanged (`FP`; update only on purpose); swing, reverse,
turn and bounce follow ball age and day; each scenario's bot win rate within its `band`; farming beats not farming in last pairs and
careful beats slogging in survive scenarios; no bouncer-limit, Law 28.4 or consecutive-over breaches.
Its fielding checks: the same balls fielded at each level score less and are caught more from easy to hard; keeper/close and deep
chances in reach taken within bands; rope catches happen; well-timed ground shots keep >=95% of their pre-v2 runs; no impossible
fielding event. The whole test takes ~95 s (the fielding model doubled it from ~54 s).
Run `npm run test:smoke` after any change to rendering, flow or input, and look at `tests/screenshots/`.
While iterating, run only the area you touched: `SMOKE_ONLY=field,throw npm run test:smoke` (sections: `node tests/smoke.mjs --list`;
each starts from the hub and passes alone; `SMOKE_PLANETS=earth,mars` limits the per-planet loop). The full unfiltered run
(what CI does) is required once before a push. New checks go inside the matching `if(on('section'))` guard in tests/smoke.mjs.
Its `chars` section plays five Earth sequences through the character lab's runner on a page of its own (stance, cover drive, a
diving stop, a cordon catch, a stop and throw) and asserts the lab's gates (tests/charlab/metrics.mjs + thresholds.json) for each
subject; gates still red at the 2026-10-17 wrap-up are listed in its `KNOWN` (with their round-3 finding) and fail only if they get
worse (more than 1.2x their excess + 5 mm). Remove an entry when its finding is fixed. `fieldPlay`'s hands-on-the-ball check uses the
lab's `handsBall` (12 cm). Run `npm run lab` (or `-- --quick`) after any change to a character's model or motion, and read the
sheets in `tests/charlab/out/<run>/sheets/` against docs/art-style.md; rules, gates and contracts are in docs/characters.md.

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
tests/smoke.mjs           Playwright smoke test over dist/ (SMOKE_DIST=dist/other.html for another build)
tests/charlab.mjs         Character lab (Playwright over dist/lab.html, LAB_DIST=): tests/charlab/{sequences,cameras,thresholds,
                          baseline}.json, metrics.mjs (pure, node-testable), runner.js (in-page sequence runner); out/ gitignored
tests/motion.mjs          node checks of 07-motion.js
src/models/*.glb          Skinned models (batter, fielder), embedded as base64 (MODEL_DATA) by build.mjs; generated, but committed
tools/blender/            Model scripts run headless in Blender: rig.py (skeleton contract), sdf.py (shapes, meshing), body.py
                          (shared body and atlas bake), batter.py, fielder.py. tools/model.mjs runs Blender, then gltf-transform
                          prune/dedup/quantize (KHR_mesh_quantization), WebP textures and a byte report
```
`BUILD_OUT=dist/<name>.html node build.mjs` builds to another file (parallel work, the lab).
Game modules: 01 core state, settings, sizing, camera + projection, planet application · 02 audio (WebAudio, recorded clips) ·
03 HUD/banner · 04 match flow + ball state machine + scoring · 04b T20 (over setup, mid-over swaps, save/resume, scorecard) · 04d T20
first innings (over picker, delivery chips, marker, release meter, AI batter, innings break, Simulate rest) · 04c
Scenarios (list, briefing, Test overs and balls, strike, Hold, sessions, stars, HUD) · 05 input (pointer/keys, footwork joystick) · 06 sky drawing, particles,
2D overlays (aim arrow, radar, timing bar, info text), firework simulation · 07-arena stadium geometry (stands, sightscreens,
floodlights, boards, rope), instanced crowd, glow points (fireworks, floodlight halos) · 07-canvas procedural canvas textures
(ground, grass detail/normal, pitch, ads, wood, ball, seats, glow) · 07-geometry raw shape builders (`GB`, people parts) and
`geo`/`fillGeo` (-> BufferGeometry) · 07-motion pure motion toolkit (`MO`: springs, slerp, arcs, gait, anchors, IK, hands2) ·
07-people species per planet (heads, skin, feature: `SPECIES`, `BODY`, `REGIONS`, the people atlas `spPaint`) · 07-render3d three scene (lights, environment, shadows, materials, people, bat, stumps,
ball), batter pose and motion, people joints and motion, bowler, view state, adaptive quality · 07-skin skinned batter and
fielders (loads the GLBs, writes their bones from the joints) · 07b-lab character lab hooks (`#test` only, `window.__lab`) ·
08 camera follow (incl. the menu camera `menuCam`) + main loop · 08b replay (recording, playback, replay cameras) · 09 menu (hub, sheets,
planet preview) + boot.

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
  Between balls the camera rests at `HOME` (`updateCam` returns to it): behind the batter, or in the T20 first innings (`M.bowl`)
  the bowling view, set by `resize()` -> `bowlLens`: end-on from behind the bowler's arm (`BOWL_CAM` z 34.1, 6 m up, yaw 180, so
  screen right is the leg side), with `F`/`HZ` solved so the batter's feet and a 12 m length land at fixed screen fractions
  (portrait .55/.8 of H, landscape .42/.82 of h; the horizon may sit above the screen). `unprojGround` is `proj`'s inverse on the
  ground (the marker drag). Chase camera, replays and fielders' shadows (60 m) work from it unchanged.
  While the menu is up (`MENU.on`, set by `showScreen`), `menuCam` (08) shows the whole ground from outside the stands:
  celebration-style framing (stands' back edge `RT`, camera at 1.45·RT, 0.62·RT high, `F`/`HZ` from W and H, centred higher in
  portrait), sweeping ±25° (up to 3°/s, fixed with reduced motion) along the off side, the sunlit side, 30° clear of the
  floodlight towers (a full orbit passes right by them and they fill the foreground); `wideCam()` counts it (fog pushed out, surround land, whole-ground shadow frustum). Leaving the menu,
  `newMatch`/`scenBrief` call `updateCam(0)`, which puts the batting camera and `baseF`/`baseHZ` back; `resize()` re-runs it.
- **Landscape** (`LAND` in `resize()`, the same `(orientation: landscape)` query as the CSS): the batting view uses a longer
  lens, `F = 1.55*h`, `HZ = 0.235*h` with `h = H - SAFE.b` (portrait: `F = min(2.4W, 1.15H)`, `HZ = 0.31H`), so the bowler's
  release to the stumps' base fills the short view above the timing bar; only a sliver of sky is left. `followF` (the portrait
  formula) is the lens for the chase camera (`F` eases to it) and the spider-cam; side-on replay and celebration derive their
  framing from W and H already. Layout: scene full-bleed (the root drops its bottom padding), HUD as a grid in the top
  corners (score + T20/Scenarios slab in a left column, target + pause top right, radar under the target via `radarTop`),
  stick/Loft/Hold in the bottom corners, timing bar bottom centre with Early/Late beside it, hint above it, aim label top
  centre. Phones (`max-height: 520px`) get a 224 px left column with the T20/Scenarios rows stacked. Edge UI adds
  `--sa-l/r/b` (env safe-area insets); `#safe` carries them as padding so `resize()` reads them into `SAFE` for the canvas
  overlays. Cards with a body (`.card.split`: briefing, result, pause with the T20 scorecard) become two columns: board
  (+ buttons) left, `.cbody` scrolling right; `.cbody` is `display:contents` in portrait, so portrait is unchanged. The menu hub
  puts the title top left and Continue + the four mode cards in rows along the bottom; its sheets become a right-hand side
  panel (the stadium preview stays visible on the left). `resize()` runs from a ResizeObserver on `#scene`.
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
- **Adaptive quality** (no UI): `qTick` measures the average frame time over 90 frames after 1.2 s of play (only with a match
  running and unpaused, so the menu camera and its 30 fps frames never count); above 22 ms it
  steps down one tier and measures again, otherwise it locks for the session. Tiers (`QT`): 0 shadow map 2048, full crowd
  (15000 desktop / 9000 phone), DPR cap 2.5 · 1 shadow map 1024 · 2 crowd halved · 3 GL canvas DPR cap 1.5 (`glSize`; the
  2D canvases keep theirs). iOS Low Power Mode (30 fps cap) also reads as slow and drops tiers, which saves battery anyway.
  `#test` exposes `window.__r` (`info`, `tier`, `setTier`).
- **Time:** game clock `clock` only advances when not paused. Input timestamps are converted with `gameTimeAt()` so
  pausing never desyncs timing.
- **Ball state machine** (`S.phase`): `break` (new over banner) → `ready` (countdown, `BALL_GAP` = 2 s) → `runup`
  → `flight` → `result` → (`replay` of the ball's highlight `S.hl`, see View state and replays; when the match/innings just ended
  only a wicket's, its `nx` then the end screen, innings break or scenario result; `rpThen(rpWant(end), nx)`) → back to `ready`, or `break`
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
- **Batter animation** (07-render3d + 07-motion, visual only): full-body procedural pose (`PN` = 29 numbers: feet, hips, spine,
  shoulders, hands, bat, head, blade face azimuth `qFC`, back-knee kneel `qKN`, top-hand offset `qTX/qTY/qTZ`), knees/elbows by
  2-bone IK with pole hysteresis (`MO.ikS`, per rig). `poseTick` blends from the pose on screen with `mixPose` (channels lerp, the bat
  direction slerps through the swing plane, the hands travel on an arc about the shoulders, never through the body, a foot that
  moves lifts first); `swingTiming` makes the swing C1 through a bit-exact impact (follow and finish timed from the downswing's
  speed); the result's re-aim fades in over the 60 ms after impact. Per-family backlifts with the lunge/back-and-across step in the
  backlift (`capStep` keeps a step the backlift did not take within .2 m), a baseline backlift for keyboard/AI swings, idle life and
  a trigger press in the stance, the head tracking ball/bowler/shot, the drawn hip on `bpos` by impact, a two-stage relax then walk
  back between balls, flinch recovery, the celebration on the game clock with pivoting feet (`MO.anchors`). Per-shot keys: `SH3`
  (one per `SHOTS` entry), `SW3` sweeps, `UP` duck/sway/hit; block and leave.
  The impact pose must land exactly at release + `SWING_DELAY`: the player's timing is anchored to it visually.
  Contact: `aimSwing` picks `sw.cp` (ball at tc, clamped to the shot's reach; else where the path passes nearest the bat), bend limits per shot family (`FAM`, `shapeFor`: drives/blocks upright, pulls/cuts flat), `bend` puts the blade point for the kind (`BK`) on it with the face (`qFC`, `faceFor`: between the ball and the shot direction) toward it (misses clear over the whole swing; it may slide the ball along the blade, `x[9]`, at a higher cost than moving the hands; low balls get a second start), `ballNow` time-warps the last `SWING_DELAY` to reach it, `recContact` records that frame for replays.
  Non-striker (`nsPose`/`nsTick`): `MO.gait` walk/backpedal/sidestep from his track position, the bat in the bottom hand, the free
  arm swinging; his pose is recorded per frame.
- **Skinned batter** (07-skin, tools/blender): batter.glb (~314 KB, 11.2k tris: body 6.2k, helmet 1.5k, shoes, gloves with
  fingers and thumb, pads with knee roll, straps and wing), one 1024² WebP atlas (position bake + AO + painted detail: face,
  placket, number, seams, belt, pad ribs, glove bars, sole, helmet vents; alpha = the material's tint mask) on smart-projected UVs,
  9 materials replaced by name with `kit()` ones (roughness and rim per art-style section 1). Proportions per docs/art-style.md
  section 2 (shared body code in tools/blender/body.py). Helmet and shoes rigid on a bone, gloves skinned to hand + forearm twist,
  pads to shin + thigh. **Skeleton contract (rig v2)** = `tools/blender/rig.py`: the 19 bones of v1 (`HUMAN` lengths = the pose's:
  thigh/shin .43, upper arm .31, forearm .30 to the grip, shoulders ±.19, spine+chest .5, neck .17; rest A-pose in game coordinates,
  L = front side) plus 4 twist bones `uarm_tw_L/R`, `farm_tw_L/R` (children of the upper arm/forearm, heads at their midpoints),
  parent-first; each bone stores rest `aim`/`ref` vectors (glTF extras -> `bone.userData`); <= 4 influences. `batJoints(p)` turns a
  pose into the joint struct `J` (the one interface for every person). `skinVecs(J)` gives aim/ref from the pose (limb line + IK
  pole for elbows/knees, toe for shins, the elbow taken from the pose's own IK; hands turned so the glove's grip channel lies on the
  bat axis; twist refs spread the hand's twist along the forearm and the elbow plane along the upper arm; lengths from `J.L`), and
  `skinDrive(rec,J,scale,gw)` writes every bone's **world matrix** (head at the joint, rotation mapping rest aim/ref onto the
  pose's; bones have `matrixAutoUpdate`/`matrixWorldAutoUpdate` off), so a limb the pose stretches still ends at the hand and ankle
  and nothing depends on Blender's bone axes (`__r.skinErr()` 0). The bat stays procedural (`batsman3D`), so contact targeting is
  untouched. Grip (`batJoints`, H = bat anchor): left glove at H+`HAND_AT`[0] .095·d (top of the handle, which starts at `HTOP`), right at .18 touching it ~4 cm above the blade; correctly handed gloves, top hand's back to the bowler, bottom palm behind the handle (`GA`/`GRIP_A`, `GF`), elbow poles toward the glove's forearm (`J.wa`). If the GLB fails to load, the procedural batter (`BG`) stays (`__r.skin()` says why).
  The non-striker is a SkeletonUtils clone (`SKN.b2`) driven with his group's world matrix. Regenerate with `npm run model:batter`
  (Blender 5.2 at /Applications or `BLENDER=`, sandbox off; a `-- --render DIR --poses poses.json` run renders turntables and game
  poses; `__r.drive()` / the lab's `poses.json` dump poses).
- **People models** (07-skin, 07-render3d): fielders, bowler and keeper are SkinnedMeshes on fielder.glb (~216 KB, 7.6k tris: one
  athletic body at the rig.py lengths, collared short-sleeve shirt, cream trousers, shoes, cupped hands with a thumb, the Earth head
  with a face and the cap; keeper gauntlets and pads; one 512² WebP detail atlas in `REGIONS`). At load each mesh is put into bind
  space and merged per species into ONE geometry (body + shoes + head: the GLB Earth head and cap, or the species' head with
  head-bone weights), so a person is one draw call; the keeper's gauntlets + pads one more (`wk`), his helmet up to spin (a clone of
  the batter GLB's, Earth only) another; Saturn's ring stays a rigid part. Each rig: 23 cloned bones and its own Skeleton,
  `skinDrive` from `personJoints`' J, frustum-culled by a bounding sphere at the hip; fielders beyond `SHADOW_D` (28 m) cast no
  shadow and keep a blob. ONE people material (`peopleMat`) over three 512² canvases painted per species and kit (`spPaint`, 07-people:
  colour with the GLB detail atlas multiplied in on the CPU, alpha = tint mask for trim and eye white; emissive; roughness G + rim
  share R), so a kit change is a repaint (`kitApply`/`setKits` per innings). `personJoints(x,z,face,o,id,dj,ik)` builds J for
  everyone (index 0 his left; `wr`=`hd` the wrist; two-handed plays by `MO.hands2`: hands side by side across the ball's line, palms
  to it, fingers up above the chest and cupped below, shoulders and head turned to it). The fallback (`#test&nomodel`, or the GLB
  failing) is the 13-part procedural rig (`personRig`, `placeParts` from J): tapered capsules per fixed bone length (`capG`, `mL`).
  Fielding actions (`o.act`): 1 run, 2 take or stop (stoops, and squats below 0.75 m; `playGeo` puts him in line behind the ball), 3
  dive (roll `diveTh`), 4 leap, 5 slide, 6 keeper squat/gather, 7 throw (`o.e` 0 overarm, 1 underarm, 2 looping). `GB.surf`/`GB.join`
  in 07-geometry build smooth parametric shapes; materials come from `kit()`.
- **Species** (07-people): one shared body (`BODY` = rig.py lengths, 1.82 m) and kit for every planet; a species is a head, a skin
  colour/pattern and one signature feature (docs/art-style.md section 5: Earth humans and the team cap, Selenites' glowing crest,
  Scorchlings' fin, Cloudwaders' gill fronds, Rustkin antennae, Gravitons' amber eyes, Ringlings' ring, Tidefolk fins). Heads are
  authored in the head frame (origin the head centre, x his right, y up, z forward) over a shared neck cover, within .26 x .30 m.
  `SPECIES[planet]` keeps the per-planet gait physics only (`st` stride, `lf` lift, `fq` cadence, `fl` low-gravity float, delivery
  bound `jp`). `vis.kit` per planet: shirt, cream trousers, `trim`, `cap` (section 4 contrast). `spApply(key,kit)` swaps heads and
  repaints; in the T20 first innings both batters wear the planet team's kit and the fielders are Earth humans (`setKits`). In the
  win celebration fielders stand dejected (`V.dej`, three variants by index; not recorded, replays end before it).
- **Bowler** (07-render3d `bowlerState`, persistent `BW`, never a jump): a steady run-up from his mark (`BWP`: pace 31 m, spin
  25.5 m), then a keyed window around the release (`BKP` pace, `BKS` spin; times in s from the release, `kf` over `bt`): pace = gather
  with both hands on the ball, bound off the left foot, back-foot contact side-on (hips and shoulders turned, front arm high), front
  arm pulled down over a braced front leg, hips opening before the shoulders, the bowling hand through the logic's release point at
  `bt` 0, follow-through across to the off side and decelerating strides; spin = a short approach, the back foot pivoting, the front
  arm leading, a slower arm. Then a jog back to the mark (still in the result). The ball is drawn in his hand through the run-up. A
  caught-and-bowled or a throw to him hands his slot over from `BW` without a jump. `V.bt/bv/bh` (recorded) replace the old
  `arm/brn`.
- **Audio** (02): recorded MP3 clips in `src/sfx/` (filename = role, e.g. `fw-launch.mp3` -> `SFX_DATA.fwLaunch`), embedded as base64 by
  `build.mjs` (`@include-sfx` in src/index.html) and decoded once on AudioContext creation; sounds requested before decoding are skipped.
  `play(name,{vol,rate,delay,lp})` -> master gain + compressor. Bat kind (mid/edge/top/block) is picked from the result label (`bat`, `edge`, `mishit`, `block`).
  Crowd bed loops via `loopStart/loopEnd`. Only thunder is still synthesized. Clip sources/licences are listed in README.md.
- **AI bowler brain:** per length/line stats of runs and wickets conceded (`mem`, persisted in localStorage `cc_mem`,
  capped at 40 samples). Weights favour what has cost it least; medium and hard (`k>0.3`) avoid repeating a length 3 times; pressure
  situations add yorkers/bouncers; slower balls by difficulty. `brainInsight` produces the "Bowler's plan" text.
  Footwork tendency: `M.foot` is a moving average of `S.bpos` per ball (`footTrend`), passed as `ctx.foot`; `footPlan` turns
  it into charge/back/across weights that scale lengths and lines (`FOOT_LEN`, `FOOT_LINE`: shorter and wider vs chargers,
  fuller vs back-foot players, straighter and yorkers vs moving across), and the plan text then names it (`FOOT_NOTE`).
- **Field AI:** each over, moves up to N ring fielders deep into the sectors where the batter scored most (`fieldFor`).
- **Fielding** (logic.js; skill `FS` per difficulty, the T20 first innings always at medium): every fielder makes a timed attempt
  at the ball on the path the game draws (`res.path`, `hitPos`). `fsk` sets skill by position: keeper at his `KEEP` stance (back
  to pace, up to spin), close catchers one step, ring, deep; reaction, sprint (`runD`), dive, jump, hands, judging time for a ball
  in the air. `airChance` samples a flight every 0.05 s (take, running catch, leap, dive; a rope catch inside the rope in its last
  0.25 s, x0.85); `groundPlay` every metre of a ground line (earliest clean pick-up, else best dive, a slide near the rope), tried
  in time order: a failed dive lets it run on, a fumble costs a run. Edges fly fine on a real trajectory (the keeper-slip gap is
  real; lofted edges leave at 0.7x speed and loop up), then run on from the landing or off the hands; skiers hang up for anyone.
  Each result carries `res.fplay` (contract above `ev`), plus show-only events that use no randomness: dives and leaps that miss
  by a little, earlier dives beaten by the ball, the fetch, the chase to the rope, the rider under a six. `DIFF.catchMul` only
  scales the lofted-mishit chance. Balance: the same balls fielded at each level (runs fall, catches rise), close and deep chances
  taken, rope catches, runs per well-timed ground shot (>=95% of before), and `fplayBad` (no event beyond run + reach, hands on
  the ball for catch/drop/stop/fumble) over random balls on every planet, level, field and tier.
  Game side (`fieldTick`, 08): `doSwing` moves the events onto the drawn path (it starts at the blade's `sw.cp`, the logic's at
  `footAt(...).c`) into `S.fplay`/`S.fev` (per fielder, times after `S.f0` = contact). Each event: run from where he is to a
  launch point on the logic's run profile (`FS`, `runP`), then the dive (launch `t1-(0.12+e/6)`, lie, up by 1.1 s), leap (0.35 s
  either side of t1), slide (from t1-0.45) or take lands the hands at t1; a caught/stopped/fetched ball then stays in the hands
  (`V.ball`). The keeper is drawn at `KEEP[M.bowlerType]` (`resetFielders`), squats in the run-up, rises at the pitch (pace) or
  release (spin), shuffles up to 1 m and gathers what passes the bat (`keepTick`; `ballNow` carries the ball to his gloves where he
  is drawn). He is hidden only in the home batting view (`batView()`, with a ball in his gloves: `V.bk`); the bowler's slot carries
  caught-and-bowled. Ring and deep fielders walk in 1.5 m in the last second of the run-up.
  Motion (people parts of 07-render3d, 08 `fieldTick`/`keepTick`/`throwTick`/`walkTo`): everyone stands and moves on planted feet:
  `feetStep` hands the feet between `MO.gait` (moving; fed a spring-smoothed velocity, cycle capped at 2.6 m) and `MO.anchors`
  (standing: pivot steps on a turn, the split-step at the release via `PS.split`); a planted foot out of reach pivots on its toes;
  the crouch, run amount, idle variant and the head's look are springs per rig (`mkPIk`), so a recorded flag never pops. Positions
  are continuous: fielders walk in over the last second of the run-up, then walk/backpedal home from the result on; the keeper
  sidesteps to the line and walks back; `resetFielders` keeps every man where he is and only starts a man at his spot when it moved
  more than 12 m (keeper 6 m: a stance change under the over break).
  Throws back (08, show only: no logic, runs or outs; `TR` = `prng`): `planThrow` (end of `doSwing`) takes the last stop, fetch
  (`isFetch`) or fumble of a ball not out and not a boundary, not the keeper's or the bowler's (his throw to the keeper would go
  through the batter); the end by what the camera shows: the bowler in the home batting view (the keeper is hidden there), the
  keeper under the cordon camera and by geometry under the chase camera (the keeper only if his take falls in the result phase,
  else the bowler), bowling by geometry (the bowler if he is nearer than 0.75x the keeper's distance, else the keeper);
  kind by distance (under 14 m standing: underarm 11 m/s; under 42 m: flat 28 m/s; else a one-bounce 32 m/s or a loop 21 m/s,
  70/30), each segment's vy from its time, so only the arc changes by planet. `S.thr` (times after `S.f0`): `tg` ready (stop +0.3,
  fetch +0.35, dive/slide +1.15, fumble: a walk to the ball first), wind-up `wu`, release `tr` (waits for the receiver), arrival
  `ta`. The receiver (by role: keeper `kp` at 5.5 m/s from his stance or last play, or bowler `bw` at 4 m/s from 0.6 s) goes to his
  stumps, takes it in front of them, gloves over the bails (`at`); batting, the bowler does so only if he can then walk back to his
  mark before the next run-up, else he takes it on his way back there (no direct hit). Throws run on into the next ball's countdown
  (`ready`, `break`, `pick`); the result phase does not grow for them. `resetFielders` keeps the thrower (with his play: `o.es`,
  `ev`, `g`; a thrower who has let go and whose place moved goes there) and the receiver where they are; `thrBall` draws the shot's
  path (`o.h`) once `S.hit` is cleared. After the take both walk back (`walkTo`: 4.5/5 m/s x `ENV.run`, up to 7 m/s if they would
  be back after a 2 s countdown); each is let go at his place (`o.td`/`o.rd`, never in `result`, where a play would take him back)
  and then `S.thr` ends (`fieldTick`). Batting, a throw is planned only if taken 0.3 s before the next run-up (a loop falls back to
  a bounce; a keeper's take must fall in the result phase, while the cordon or chase camera still shows him); a walk still on at the
  run-up is cut by `recStart`. Bowling, Bowl (and Space/Enter) is off until the throw ends (`bowlUI`, `bowlPress`), so everyone is
  at his place for the run-up. `S.thr` is also cleared by `recStart`, `rpStart`, the celebration, `showEnd`, `inningsBreak`,
  `scenBrief`, `newMatch` and `quitToMenu`. Direct
  hit (10% of flat/underarm throws up to 30 m, at the stumps): on to the stumps, bails off (`V.st`, or `V.st2` at the far end)
  until the receiver's gloves have been over them (take + 0.6 s), receiver takes the deflection; no text. `throwTick` drives
  thrower (act 7, blended over 0.25 s from the play's pose) and receiver before plays and `keepTick`; `thrBall`/`thrView` put the ball in `V`; `thrSnd` plays the take and the hit. The radar's
  shot line stops when the throw takes the ball (`drawRadar`).
- **AI innings:** short formats: simulated instantly (`simulateAI`), scaled by each planet's `ai` multiplier. T20: played ball by
  ball by the AI batters against the player's bowling (below).
- **T20 chase** (4th `LENGTHS` entry, `M.t20`, its own menu mode `t20` started by `startT20`; design and rejected options in docs/t20-mode.md). Pure logic in logic.js, flow in 04b:
  - `makeAttack`: 5 named bowlers per planet from `ARCH` archetypes (always a death specialist and a spinner); each carries a
    profile (`pace` x DIFF range or spin `v`, swing, `turn`/`dir`, `wrong`, `slow`, `acc`, `wide`, `len` bias) that `makeDelivery` reads.
  - Per over (`t20Over`): `captainPick` (max 4, never consecutive, phase roles, expensive bowlers rested, `canFinish` keeps the
    quotas feasible) -> `planPick` (a `TPL` template = field + delivery mix; by phase, archetype, rate needed, wickets, footwork,
    per-bowler `mem` keys `b<i>:...`) -> `adjust` (at most 2 fielders deep into hot `zoneAdd` sectors, decaying per ball).
    After a mid-over boundary the captain may swap one more (`M.note`, shown at the next ball). Everything passes `fieldOk`
    (ICC clause 28: 2 out in overs 1-6, else 5; leg side <=5; <=2 behind square on the leg side; circle 27.43 x BOUNDARY/65).
  - `M.st` (`newT20`/`t20Record`): runs, balls, wickets, per-bowler figures, fall of wickets, runs per over, per-match `mem`
    (T20 never writes `cc_mem`). Pressure is `t20Pressure` (death overs, or the rate running ahead of par). `M.bowlerType`/`spinDir`
    follow the bowler's archetype, so the existing bowler visuals apply.
  - Strike (owner, 2026-10-14: "you bat both"): the player bats the `XI` (the Series lineup, A-E tiers) as whoever is on strike;
    `M.st.bat`/`s`/`ns` have `newTest`'s shapes, and `batRecord`/`swapStrike` (shared with `testRecord`) swap on odd runs and at the
    over, the new batter taking strike after a wicket. As in Scenarios: the striker's tier (`scBat()` = `{tier,t20:1}`: windows,
    power, edges, fends, hook risk in `evalSwing` and `aimSwing`, but no sweeps and no body hits in `beaten`), Hold (`commit` ->
    `S.hold` -> `holdEnd` -> `recordBall`) and the non-striker (`nsTick`). Tests only: sweeps, duck/`bodyHit`, conditions, the radar's
    square-root scale. The captain has no tail-ender plans in T20.
  - Target = the first innings (player bowling, below) + 1. Option B (owner) still holds: totals rise with difficulty.
  - Save/resume: `t20Save` writes `cc_t20` after every ball and after each over is picked. `v:3` (v1/v2 are not offered): `inn`,
    the AI attack (names + archetypes; the player's is rebuilt, seeded), `i1` (the first innings with its over's bowler, plan and
    field), `optK`/`mkB` (remembered deliveries and markers), over chips; in the chase also its `st`, zones, foot trend, bowler,
    plan and field. Innings 1: `i1.bi >= 0` resumes the over under way, else the picker; a finished innings resumes at the break
    card. Chase: `overNo*6 > balls` means the saved over is under way (resume continues it), else a new over is picked. The hub's Continue banner (`#resumeT20`) resumes it; quitting keeps it (that is what resume is for), match end or restart clears it, a new T20 overwrites it.
  - HUD: a full-width `#t20Slab` (phase chip, required vs current rate, the batters as in `#scenSlab` (`batCard`), bowler figures O-M-R-W and overs left, pace marker vs the
    straight line to the target, i.e. half by over 10). Over-break banner: bowler change + field line (`fieldLine`). Radar: inner
    circle, gold rings on fielders outside it (all modes). Pause: `t20Card` scorecard (batting with how out, yet to bat, bowling,
    fall of wickets, runs per over).
  - Close catchers (slip, gully, short leg, silly point) are drawn; from the portrait batting camera they are out of frame, and
    in landscape silly point/short leg stand clear of the batter and the ball's line, so none were moved.
- **T20 first innings: the player bowls** (owner, 2026-10-14; every T20 is a full match; design, numbers, sources and rejected
  options in docs/t20-mode.md). Pure logic in logic.js (step 1); game side in 04d (step 2).
  - Sides: `myAttack(pk)` = the XI's 7-11 with archetypes seeded per planet (`makeAttack` rules), each with `opts` (`bowlOpts`,
    max 5 from `OPTS`: stock/out/in-swinger, yorker, bouncer, slower ball, cutter; spin stock, flighted, quicker, wrong'un, arm
    ball). `aiXI(pk,attack)` = six planet-named batters + the AI attack, tiers as `XI`. State `newInn1(mine,xi,diff,pk)`: `newT20`'s
    shapes (no target; `bw` = the player's figures) plus `bi`/`pid`/`field`, `bm` (the batters' read of the attack), `Z`, `foot`, `ll`.
  - Per over: `legalBowlers(st,o)` (quota, not the last bowler, `canFinish`), `planIds(bw,pp)` (the bowler type's legal templates),
    `inn1Suggest` (captainPick + planPick, preselected), `inn1Set(st,bi,pid)` (field = the template). Per ball: option, marker
    `{x,z}` (pitch point; `optSpot` suggests one, `spotFor` aims a line) and release `rel` -1..1 on the meter (`bowlWindow`: good
    half-width .16/.11/.075 x acc/0.85; null = no tap) -> `bowlDelivery` (shares `launch` with `makeDelivery`; early fuller,
    late shorter, as in real bowling; errors scale with ((zr-z)/(zr-5.4))^2; very bad = wide, full toss or long hop; above 1.85 m at the popping
    crease = wide) -> `aiBat(st,b,field)` (a `sw` as the player's, or `{leave,bp}`) -> resolve with `evalSwing(...,BOWL_D,...)`
    /`beaten` (`aiResult`) -> `inn1Record` (t20Record + learning; true at the over's end, `st.bi=-1`). `simRest` plays it out.
  - Medium physics (`BOWL_D`) for the player's deliveries and the AI's shots on every level: difficulty is the meter and the
    batter (`AIB`: timing spread, pace read, misreads, footwork); planet `t20` scales the AI timing spread (measured, ~50% medium
    matches on each planet). The batters learn the attack (`st.bm`): a repeated length is easier to time, step to and aim.
  - Flow (04d, `M.bowl` true, `M.inn` 1): `startT20` (04b) -> `inn1Enter` (M.st = M.i1 = `newInn1`, M.attack = M.mine, kits) ->
    intro card ("You bowl first", their XI, your attack) -> per over `newOver` -> `bowlOver`: phase `pick`, the picker `#overPick`
    (your 5 with figures and overs left, illegal ones disabled with the reason; `planIds` templates; `inn1Suggest` preselected; the
    chosen plan previews on the ground and radar; Simulate rest) -> `inn1Set` + save -> `bowlOverGo` (banner, wind) -> per ball
    `nextBall` -> `bowlReady` (phase `ready` waits, `readyDur` Infinity) -> Bowl -> `runup` (1.6 s pace, 1.3 s spin) ->
    `releaseBall` -> `bowlRelease` (`bowlDelivery` with the chip's option, `M.mk` and the tapped `rel`, then `aiBat`) -> flight ->
    `commit` -> `bowlRecord` (`inn1Record`, chips, save) -> `afterResult` -> `bowlAfter` (a replay: wickets, chances, saves, near misses; fours and sixes one per over; next ball or
    over, or at 10 wickets/120 balls `inningsBreak`: `inn2Enter`, save, the break card with top scorers and your bowling, "Chase
    N") -> the chase as below against `M.aiAtk`, target = total + 1. `physD()` = `BOWL_D` while bowling for `evalSwing`,
    `aimSwing` windows and fielder speed. No Hold while bowling (the AI's strike rotates by the rules).
  - Controls: delivery chips `#optChips` (the bowler's `opts`; the choice per bowler `M.optK`; a chip moves the marker to its
    `optSpot`), the marker `M.mk` (per bowler `M.mkB`; dragged anywhere, offset so the finger never covers it, a tap on the ground
    puts it there, clamped x -1.2..1.4, z 0.3..11.5; drawn with `proj` plus its length name), Bowl `#bowlBtn` (starts the run-up,
    then reads Release). The meter (`S.meter`) sweeps -1..1 over the last `METER_T` = 1 s of the run-up, so it ends as the ball
    leaves the hand; a tap on Release, the canvas or Space sets `rel` from the event's own timestamp (`gameTimeAt(perfOf(e))`);
    taps before the sweep are ignored, no tap = `rel` null. Feedback (`relText`): Perfect/Good release, "Early: fuller", "Late:
    shorter", way off = wide/full toss/long hop. Keys: 1-5 chips, arrows/WASD move the marker, Space/Enter Bowl and release.
    Loft, Hold, the stick and the slingshot are off (`ctlUI`); `drawTimingBar` is skipped; the radar turns round (batter up).
  - AI batter: `aiTick` (08 `update`, before `flightUpdate`) sets `S.swing`/`S.bat` at `tc - SWING_DELAY` exactly as the
    slingshot's `release` does (backlift from release, leave = no swing), so `doSwing`, pads, pose, `aimSwing`/`bend`, `ballNow`,
    `recContact` and replays need no AI branch; `footUpdate` walks `S.bpos` to `sw.bp` at the stick's speeds until the ball pitches.
  - Kits per innings (`setKits`, 07-render3d; `kitBatter`, 07-skin): bowling, the fielders and bowler are Earth humans
    (`spApply('earth', KIT.you)`) and both batters wear the planet team's kit (shirt, its trousers as trim, a darkened shirt
    helmet; materials shared by the SkeletonUtils clone); otherwise as before. `newMatch` and `quitToMenu` reset it. The
    procedural fallback batter keeps KIT.you.
  - HUD (`bowlHUD`): `#t20Slab` with phase chip, plan name, the AI batters (`batCard`), your bowler's figures and overs left; run
    rate and projection in `#targetSlab`; `#tBar` hidden. Pause: `t20Card(st,attack)` of innings 1 plus Simulate rest (`#simBtn`,
    a second tap confirms); in the chase the same card with `inn1Line` on top. End text names their total.
- **Scenarios** (Tests; `settings.mode` `scen`, `M.sc` = the scenario, `M.st` = `newTest`; design, numbers and departures in
  docs/scenarios-mode.md). Pure logic in logic.js (step 1: `SCEN`, `TIER`, `testBall`/`testRecord`, `scenEnd`/`scenStars`/`stageNext`),
  flow in 04c:
  - The Scenarios card's sheet holds the list (resume tile on top; the hub's Continue banner `#contScen` resumes too): the Series (5 Tests x 3, each unlocked by a star on the one
    before) and the Classics (all open). A tile opens the briefing (`#brief`: situation, objective, stars, conditions, pair).
    Stars (best per scenario id) are saved in `cc_scen` = `{stars:{id:n}}`.
  - Save/resume: one slot `cc_scensave` (`scenSave`/`scenSaved`/`resumeScen`), written after every recorded ball and after each over
    is picked (`scenOver`); the scenario object as played, `M.st` minus `sc`/`A` (rebuilt, `testAttack` is seeded), maidens, over
    runs, chips. `st.bi>=0` resumes mid-over (`beginPlay(true)`), else a new over. A drawn session saves the next session unplayed;
    the result card clears it; quitting keeps it (an open Hold is recorded as not held first, T20 too). "Resume" tile tops the list.
  - Per over `scenOver` runs `testBall` (captain, spell, stock plan, field) for the first ball; per ball `scenNext` takes the
    next `testBall` (tail plans change the field ball by ball: `M.note`). Swings and pads use the striker's tier
    (`scBat()` -> `evalSwing`/`beaten`), so sweeps, fends, bat-pad catches, body hits and ducks apply; a missed sweep moves the
    pads (`S.padBp` = `sweepBp`). A short ball at the body that was not ducked stops there (`bodyHit`, like a pad hit).
  - Hold: after a ground shot with an odd run, `S.hold` and `#holdBtn` (left of Loft) last 0.6 s of game time; the ball is
    recorded (`testRecord`, `applyHold` if tapped) when it is tapped or the window closes, or at the latest in `afterResult`.
  - Duck: the stick pulled back after a short (S/B) ball pitches sets `b.duck` (the time); already holding it back at the pitch
    counts as footwork instead (`b.noDuck`), so a duck needs pulling back after the pitch. After a duck the swing is ignored.
  - End: `scenEnd` after each ball. A drawn session of a staged chase goes to the interstitial (the briefing card, "Lunch"/"Tea")
    and the next session starts from `stageNext`; otherwise the result card (`#end` with `#eStars`, Next/Retry/Back). An objective
    met (including survive draws) gets the celebration.
  - HUD `#scenSlab`: objective line, conditions chip, partner card (strike marker, tier badge, runs and balls), bowler figures
    O-M-R-W (maidens counted in 04c) and the field plan. Radar: square-root radial scale and no circle, so close catchers show.
  - Non-striker (07): the skinned batter cloned with SkeletonUtils (`SKN.b2`) on a second `batterRig` (`G.ns`, its own bat),
    posed in its own frame (`nsPose`, facing +z) and placed at the bowler's end on the side away from the bowler, turned to
    face the striker. Backs up in the run-up (`nsTick`), walks back between balls. Both batters share the kit, so a strike change
    shows only in the HUD. `V.ns` and `V.bx` (bowler x: the release side, so around the wicket is drawn) are recorded.
    Cost: ~30 draw calls (172 vs 142 between balls) and ~26k triangles, Tests and T20.
  - Poses (07): `SW3` sweep and reverse sweep (impact, follow-through, lofted, and `l`: the crouch onto the back knee while a
    sweep is being aimed), family `FAM.sweep` (flat bat, contact window in front of the front pad); `qKN` kneel turns the back
    knee's IK pole down and forward; `UP.duck` (ball at the body), `UP.sway` (outside it), `UP.hit` (flinch for 0.7 s).
    `shotOf` = `shotForBall` in Tests, else `shotFor`, for poses, contact targeting and the aim label.
- **Main menu** (`#menu`, 09): a hub over the live stadium (title, Continue banners for the T20 and scenario saves, mode cards:
  Quick match = mode `chase` with `settings.len` 0-2, T20 = mode `t20` via `startT20` in 04b, Scenarios, Nets; Settings and How
  to play icon buttons) and sheets: one mode sheet (`#sheet`, set up per mode by `openSheet`: planets, bowler, overs or
  wickets, Play; or the scenario list) plus `#setSheet` and `#howSheet`. Bottom sheets in portrait; the hub fades out while one
  is open (`.sheet-on`, hub `inert`), so the stadium shows. Picking a planet calls `preview` -> `applyPlanet` (rebuilds the
  stadium; the 3D layers fade in over it), and `applyPlanet` skips the planet already shown, so Play does not rebuild it. While
  paused (menu and overlay screens) `frame` draws at 30 fps; rAF stops on a hidden page. `quitToMenu` returns to the hub, or to
  the Scenarios sheet from a scenario (result, pause or briefing). Old settings with `len` 3 migrate to mode `t20`.
- **Records:** `records[diff][format]`, format `short` (1-5 overs and nets) or `t20`; old flat records migrate to `short` at load.
- **Planets** (`PLANETS` in logic.js): physics (`g`, `air`, `swing`, `spin`, `bounce`, `pace`, `boundary`, `wind`, `ai`)
  plus `vis` for the look. `setPlanet` derives `ENV.carry`, `ENV.acc` (ground deceleration), `ENV.run` (fielder speed).
  Wind is rolled per over and drifts lofted shots. 3D lighting and fog per planet live in `LOOK3D` (07-render3d.js).
  If you change planet physics, re-run the balance test and update that planet's `ai` multiplier to the measured
  "scoring vs Earth" ratio (the test checks they stay within 0.8-1.25 of each other), and its T20 `t20` (AI batter timing spread
  x) until its medium full match is ~50%.
- **Chase camera:** on fours and sixes the camera follows the ball (`updateCam`), and the banner and score reveal are
  deferred until the ball crosses the rope (`S.deferred`). The batter is hidden while the chase camera is active. It also runs
  for lofted balls of 30 m+ or with a deep fielder's attempt (outcome deferred to the catch or landing), and for a dive, leap or
  slide the batting camera can't see that gets a hand to the ball (not near misses: the follow-through stays on most balls).
  **Cordon camera** (`S.cord`, batting only): when the keeper or a close catcher (<18 m) catches, drops, dives or leaps, 0.12 s
  after contact a cut to a long lens from behind the bowler's stumps on the catch or drop (else the first such play; 9 m of ground
  across the longer screen side), outcome deferred to its t1, until the next ball. `batView()` (keeper hidden) holds until either
  camera's `t0`. A deferred holdable ball opens its 0.6 s Hold window when the outcome is shown; the catch groan/drop gasp plays at
  contact + `path.T` whenever the outcome is shown. Boundary paths are kept consistent with the rope on the drawn path (`doSwing`:
  a six lands >= 1 m over it, a one-bounce four 0.5 m inside).
- **View state and replays:** `render3D`/`draw` read the ball, batter pose, bowler, fielders and stumps only from a view object `V`. `liveView()` (07) builds it from
  live state each frame (it also runs `poseTick`/`bowlerState`, which are stateful, once per frame). From `runup` to the end of
  `result`, `recFrame` (08b) copies `V` into one preallocated Float32Array (245 floats/frame, max 600 frames, ~575 KB, current
  delivery only). In the `replay` phase `rpView()` rebuilds `V` from the buffer, blending the two nearest frames. **Any new
  per-frame render state must be added to `V` in `liveView`, to the frame layout in `recFrame`/`rpView`, and read from `V` in
  render code**, or replays will show live state instead. Replay is not re-simulation (randomness is unseeded).
  Frame layout (08b header): t, ball xyz, bowler z/arm/run/running, stumps age/bails, bowler `bt`/`bv`/`bh` (`RP0` = 13), the
  batter's pose[`PN` 29], then per fielder 14 floats (`RFF`): x, z, sin/cos face, run, flags, action, its time `ap`, hands' target,
  stretch, heading `vx`/`vz`; then crowd cheer, bowler x, non-striker on/x/backing-up distance and his pose[`PN`], last the far
  stumps' hit age (`V.st2`). `V.bk` (ball in the keeper's gloves, hidden with him in the batting view by `render3D`) is not recorded: the
  ball itself always is.
  Director (08b, docs/replays.md): `commit` stores `S.hl = highlightOf(res,b,field,c)` (logic.js, pure: `{kind, ev, t, rel}`, most
  significant first: wickets `bowled` (played on too) `lbw` `stumped` `caught`; chances `drop`, `chance` (a dive or leap in the air
  with a hand on it); `save` (stopped within 10 m of the rope, would have reached it); `leap` (a six over the rider's leap), `six`,
  `four`; near misses `shout` (pad, would hit, not out: pitched outside leg or outside the line) and `shave` (left or beaten within
  `SHAVE` 8 cm of off stump or over the bails)). `rpWant(end)`: batting every highlight (a boundary only with the chase camera); the
  T20 first innings, the AI's fours and sixes one replay per over (`M.rpOver`); `end` only a wicket. `rpStart(h,nx)` builds the plan
  `RP` (`kind`, `cls`, anchor `tc` = contact, or the event without one: never `S.hitStart`, stale then; `tk` the event; `s1`; slow
  `sa..sb` at `slo`; `end`; sounds in `ev`; LBW `hold`) and `rpUpdate`/`rpCam` read only it.
  Cameras (`rpCam`): side-on from the off side in slow motion (0.6x easing to 0.35x near `tc`) until `s1` (0.4 s after contact),
  then by class. `field`: a spider-cam trailing the ball (closer and lower for low balls, backs off and rises for high ones so the
  stands stay in frame) at 1x, until 0.3 s after it crosses the rope (boundaries), with a glow ring on the ball (`rpGlow`); a save or
  the six's leap eases to 0.45x in tk -0.35..+0.25 and ends tk + 0.7. Catch classes (`RP.ct` = the catch, drop or chance event, class
  by `M.field[e.i]`): `close`
  (keeper or within 18 m) cuts at contact + 0.06 s to `cordCam` (the live cordon framing, shared with `updateCam`, 3.2 m across the shorter side; a
  catch within 4 m of the batter on the off side or straight (x > -1), `RP.sq`, square on from the off side instead, as the
  batter hides it from the cordon camera; short leg keeps the cordon camera, as he would hide it from the off side; otherwise
  the camera 2.2 m wider than live, clear of the batter) at
  0.35x until tk + 0.25; `cab` (bowler's slot) at + 0.12 s to an end-on long lens from behind the striker on the off side (5 m span), 0.4x;
  `field` (ring, deep, rope) keeps the side-on shot and the spider-cam (its path stops at the catch, so it settles behind the
  catcher), easing to 0.5x in tk -0.2..+0.1. Ends tk + 0.8 s (a field catch + 0.5 s; a drop or chance that goes on to the rope at
  the rope + 0.3; a catch's result phase lasts at least t1 + 0.8 s so it is recorded); the catch sound (a drop: gloves and a gasp)
  plays at tk. No contact: `stumps` (bowled, LBW, shout, shave) cuts at the pitch to an end-on long lens from 3.4 m up behind the
  bowler's arm, on the side away from him (`RP.bx`, clear of him and the non-striker), 2.8 m across the shorter side, the whole
  flight at 0.45x; `crease` (stumped) to a low camera square on from the off side, in front of the popping crease (clear of silly
  point). LBW and shout hold 0.6 s at the pad while `rpLbw` (06) draws the path on to the stumps (`ballPos` past the pad), the
  wicket outline, rings at the pitch, the pad and the stumps (amber = the reason it is not out) and the verdict.
  Exact frames: `recContact` at contact and at the highlight's play (`S.f0 + t`); `flightUpdate` records the pad, the stumps and
  the keeper's take (`tEnd`) as they happen. Bowled or played on: the ball goes on to the stumps and deflects off them (`ballNow`,
  show only, recorded); played on's bails wait for it (`S.stumps.t0` in the future, `V.st` from then).
  Tap/key/Skip skips after 0.3 s. A throw planned on a replayed ball is cleared by `rpStart`; the next ball's `resetFielders`
  puts everyone back.
  The batter is shown in replays (the live chase camera hides it).

## Constraints to keep
- Output must stay ONE self-contained HTML file: inline CSS/JS, works offline, nothing loaded from a CDN at runtime
  (Google Fonts are optional with fallbacks). It is hosted on GitHub Pages and can also be published as a claude.ai artifact, whose CSP only allows scripts from
  cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, cdn.tailwindcss.com, code.jquery.com and styles from fonts.googleapis.com.
  Build-time npm deps (three, esbuild, playwright, @gltf-transform/cli for the model pipeline) are devDependencies pinned to exact versions that were at least two weeks
  old when added; the lock file resolves from registry.npmjs.org. three r163+ needs WebGL2 (iOS 15+).
- localStorage keys are prefixed `cc_` (settings, mem, records, t20, scen, scensave); every access is wrapped in try/catch.
- Mobile first, portrait primary, landscape supported (see Landscape above): safe-area insets on every edge (left/right/bottom
  in landscape), `touch-action:none` on the input canvas, 44px+ touch targets. Portrait must not change when landscape does:
  landscape rules live only in the `(orientation: landscape)` media blocks and `LAND` branches.
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
  base64; the build is ~1.4 MB). No meshopt/Draco: WebAssembly may be blocked by the artifact CSP. Quadriflow remeshing was tried and refused
  the mesh; decimation with its symmetry option folded faces along the mirror plane, so it runs without it.
- Grip: hands slid down the handle with the bat fixed to H (contact unchanged); poses' hand points moved 4-8 cm (stance
  also 3 cm lower) so the longer reach keeps a bent arm. Correctly handed gloves with the natural grip put the forearms
  ~150° round from the old elbow poles (wrist bend ~90°); mirrored gloves (the earlier fix) were rejected as wrong hands, so
  the elbow pole follows the glove instead (rms wrist bend ~15°, elbows bow forward in the stance).
- Batter polish: the hand twist follows the blade face, not the forearm (a forearm-driven twist lets the bat spin inside
  the gloves when the face rolls). The forearm-to-handle angle in the poses ranges 2-93 deg, so no rigid glove fits: the
  palm is blended hand -> forearm and the cuff is open so the arm goes in without a seam. Pad flap skinned to
  the thigh, chosen over a shorter pad (loses the knee-to-thigh cover) or a rigid bevel (still pokes out in lunges). Blender's
  weighted decimation is very nonlinear: weights <= 0.5 and factor 0.04, else the zone takes all the triangles.
- Glow: additive glow sprites (fireworks, floodlight halos) instead of UnrealBloomPass. Bloom needs an EffectComposer: a
  full-res HalfFloat target (~24 MB at 1170x2532, ~4x with MSAA, else the scene loses antialiasing), fog then mixes in linear
  space before tone mapping so it no longer matches the 2D sky, and its cost is fill rate, which headless swiftshader (CPU,
  vertex-bound here) cannot show: tried at full res, frame time was within noise there. Sprites cost one draw call each set.
- Landscape: a responsive layout of the same game (CSS media queries + `LAND` in `resize()`) over an orientation lock (iPhone Safari
  can't lock orientation from a web page: `screen.orientation.lock()` needs fullscreen, which iPhone gives only to video) or a separate landscape UI (two UIs to
  keep in step). The batting view gets its own lens; follow cameras keep the portrait one so high balls stay in frame.
- Pause between balls: `ready` phase with a countdown, fixed at 2 s (`BALL_GAP`; the time-between-balls option was removed by owner decision), plus longer run-ups.
- Footwork control: a bottom-left joystick (velocity, own pointer) over swipe gestures or dragging the batter, because the
  right thumb is already busy with the slingshot and swipes would collide with it. Arrows/WASD on desktop.
- Footwork payoff: a timing-window and shot-fit `gain` from leaving the good-length zone. Shot fit alone (1:1 effective
  length, also tried 2-3x) gave a length-reading bot under 3%, because drives tolerate length; with `gain` it gets ~+15%.
- T20 targets: option B (owner), never falling with difficulty, over the original 70/50/30% win-rate calibration (which made
  hard targets lower than easy ones). Since 2026-10-14 the target is the first innings the player bowls; the simulated target
  (`DIFF.t20`, `AI_T20`, planet target multipliers) was removed.
- T20 player bowling (owner, 2026-10-14): replaces the simulated chase target; marker + release meter over swipe bowling or a
  marker without a meter; "Simulate rest" over bowling all 20 or only a star bowler's 4; no toss. Per-planet `t20` now scales
  the AI batter's timing, because its scoring follows planet physics less than the batting bot's (it reads swing and lofts by
  carry), so medium matches ran 25-80% without it.
- Fielding v2 (owner, 2026-10-14: "they don't even try"): one time-based model for every fielder against the drawn path, over
  retuning the old reach formulas (ground stops were superhuman but invisible, rope catches could never fire, edges were a flat
  probability). The same balls score 2.28 / 2.04 / 1.82 runs per ball fielded at easy / medium / hard. Against the old model:
  T20 chase -5/-6% runs on medium/hard; short formats easy +4%, medium level on runs (its gain is catches: 24 balls/out), hard
  -5%, because well-timed ground shots now score more on every level (owner: gaps must pay). Not retuned further: it would reopen
  the T20 ~50% medium calibration and the Test bands. Lofted edges leave
  at 0.7x: at full speed they cleared the cordon (caught 22% vs 39% before) and always-lofting beat the standard bot on hard. To
  keep T20 medium near 50% the AI batter's medium timing spread went 64 -> 68 ms (medium targets ~10% lower), and four Test targets
  moved to their old win rates (s2b 85 -> 78, s3a 130 -> 120, s3c 190 -> 165, c1 20 -> 18); bands unchanged.
- Fielding visuals: the logic's `fplay` events drive the existing 13-mesh rigs (a whole-body turn about the hip plus IK hands), no
  new meshes or animation clips. The keeper is drawn but hidden in the home batting view (up to spin he would block the batter,
  back to pace he is behind the camera); a cordon camera cut shows edges instead, and the chase camera follows dives the batting
  camera can't see (most ring fielders are off screen in portrait), which trades some views of the follow-through for seeing them try.
  Limited (review) to plays that get a hand to the ball and to close catches, drops, dives and leaps: off-screen near misses and
  plain stops by the keeper or close fielders stay in the batting view (cut rate on ground shots down by about a fifth).
- Throws back (owner, 2026-10-15): visual only, no run-outs (running between the wickets stays out of scope), so the balance test
  and its fingerprint are unchanged. With no batters running, the end is chosen by what the camera shows and by geometry rather
  than by a runner to beat. Throws run into the next ball's countdown (owner, over keeping every take in the result phase, which
  threw after ~1 in 5 stops, and over a longer pause between balls): the field reset keeps the thrower and receiver, bails go back
  at the take, the batting take must beat the fixed countdown (the bowler takes it on his way back to his mark when walking back
  from his stumps would not fit), and bowling Bowl waits until both are back. Batting, a long throw that would land after the
  next run-up is skipped (probe, Earth medium: 51 of 59 batting stops, dives and fumbles thrown, 8 long ones skipped; deep
  fetches mostly skip). A thrower far from his place (a deep chase) may still be walking at the run-up and is put back then
  (1.5 m+ in ~1 in 6 throws). Bowling, every stop is thrown and Bowl comes on a median 2.5 s
  (p90 4 s) into the countdown.
  Direct hits are shown with bails and sound only: any "Out"-like text would read as a run-out that the game doesn't have.
- Catch replays (owner, 2026-10-15): every caught wicket, the last one too (before the end screen, innings break or scenario
  result; fours and sixes there still go straight on, a winning hit to the celebration). Three camera classes by where the catch
  is taken, from recorded frames only; the ball in the keeper's gloves is always recorded (`V.bk` hides it live) so a quick catch
  standing up doesn't blink out in slow motion.
- Replays v2 (owner, 2026-10-15; plan, measured rates and as built in docs/replays.md): a pure highlight detector in logic.js and one
  replay director in 08b over special cases in `rpStart`; every four and six keeps its replay (no per-over budget batting); bowling,
  the AI's fours and sixes share one per over, wickets and chances always; near misses in v1 (8 cm rule: at most 0.18 per over measured, under
  the owner's 0.5 limit, so no tighter threshold); LBW gets a projection hold in a generic look; no new setting. Not replayed:
  near-miss dives, plain stops, throws and direct hits (no run-outs in the game).
- T20 strike (owner, 2026-10-14): you bat both, the XI in order with tiers, Hold and the non-striker, over "always on strike"
  (v1): it adds keep-the-strike planning (Hold at the death), at the cost of balls the tail faces.
  Targets were re-calibrated (`DIFF.t20`), and Moon/Mercury/Mars `t20` re-measured (their top order bats longer than Earth's).
- T20 save after the over is picked too, not only after balls: otherwise a resume at an over boundary re-picks a different bowler.
- LBW added with footwork, pads from the trigger-step feet. The always-swinging bot rarely misses, so its LBW share is ~4%;
  human-like play (90 ms timing spread, 15% leaves) gives ~15-20% of dismissals, close to real cricket.
- Scenarios (owner): a third mode with a Series and Classics and stars, both batters played by the player with tiers and a Hold
  button, sweeps from the existing aim and the duck from the stick (no new shot buttons), fictional text only. Details in docs/scenarios-mode.md.
- Non-striker: a SkeletonUtils clone of the skinned batter, not a second GLB (no size cost) or the procedural fallback (style clash).
- Main menu (owner, 2026-10-14): a hub over the live stadium (a slowly sweeping camera, mode cards, a sheet per mode, planets previewed
  live) over a hub on a static background (no venue preview, and a second look to keep in step with the game) and over polishing
  the single long form card (still one scrolling form, every mode's options mixed). The live background costs a wide render at 30 fps.
- T20 bowling, step 2: release direction early = fuller, late = shorter (real bowling and the cited guide; step 1 had it reversed).
  Camera end-on behind the bowler's arm with a solved lens (batter and marker range the same size on any screen) over the batting
  camera turned round (the batter tiny, the near pitch under the HUD). Run-up started by Bowl, not a countdown (the player sets
  up the ball first); the meter sweep ends at the release so the bowling animation never waits for the tap. A chip always moves
  the marker to its suggested spot (predictable), dragging fine-tunes it; the marker is dragged with an offset rather than
  under the finger. The AI batter feeds the same swing structures at the swing's own time rather than a separate AI path, so
  pose, contact and replays stay one code path. Kits swapped per innings, not per frame.
- Kneeling sweeps need a pose parameter (`qKN`) for the back knee's IK pole: the pole follows the toe, which points back when
  kneeling. The crouch starts in the backlift while a sweep is aimed, so the 75 ms downswing doesn't drop the batter in one jump.

- Characters upgrade (owner, 2026-10-15; docs/characters.md, docs/art-style.md): production characters over polishing the
  procedural parts; three review rounds (owner cap, 2026-10-16), then stop and list what is left. Not production ready at the end:
  the bowler, throw, dive and catch findings of round 3 are open (docs/characters.md, As built).
- Twist bones + world-matrix skinning (rig v2): 4 arm twist bones spread the hand's twist along the forearm and the elbow plane along
  the upper arm, so wrists and elbows no longer candy-wrap; `skinDrive` writes each bone's world matrix from the joints instead of
  local quaternions down the chain (v1's `skin3D`), so the skeleton lands exactly on the pose's joints (skinErr 0) whatever the
  pose stretches, and clones (non-striker, 13 people) take a group matrix.
- One shared fielder body + a canvas atlas: every team is the same athletic body (fielder.glb) in real kit, painted per species
  and kit on three 512² canvases with the GLB's baked detail multiplied in on the CPU (`spPaint`), one material for everyone. Over
  per-species bodies (13 meshes per person, bone lengths from 1.4 to 2.2 m that read as toys) and over a shader-side tint
  (`onBeforeCompile`, as first planned): the CPU paint needs no shader patch, and a kit change is a repaint (it also fixed the Earth
  sleeve colour baked from one kit). Head merged into the body geometry: one draw call per person (keeper +1, helmet +1, Saturn's
  ring +1); batting view 161 -> 103 calls, bowling 110 -> 63, with the non-striker 211 -> 95, celebration 356 -> 115.
- Species = head, skin and one feature (owner, 2026-10-15): the alien is in the face, the athlete in the body; species bone
  lengths were removed, per-planet gait physics kept.
- WebP textures (EXT_texture_webp, quality ~82) for the GLB atlases: a 1024² batter atlas in 46 KB, the fielder's 512² in 15 KB;
  no KTX2/Draco/meshopt (they need WebAssembly, which the artifact CSP may block). Meshes use KHR_mesh_quantization (positions 14
  bit, normals 8, texcoords 12, weights 8). Build 1.57 MB -> 2.22 MB (cap 2.5 MB).
- Character lab and its gates: a deterministic in-page harness (`__lab`: lab clock, seeded random, camera lock) plus an in-page
  runner and pure metrics, so every model or motion change is measured (slip, ground, hands, penetration, pole flips, teleports,
  facing, hands on the ball, impact exactness, contact, skin error, bat speed through impact, draw calls, triangles, build size, GLB
  contracts) and seen (labelled contact sheets on 8 planets, 2 kits, 1.6/4/10 m and the game cameras) before a critic reviews it.
  Gates only ratchet tighter; changes so far: teleports are breaks in the motion (distance from the velocity's prediction), hands
  have their own limit (.25 m/frame) and the bowler's hands are gated against the ball's release speed; jumps under a game camera
  cut are allowed; triangles count the scene without the crowd (it has its own budget). Permanent subset: the smoke test's `chars`.
## Known gaps / backlog (ranked as discussed)
1. Bowling outside T20 (done in T20, 2026-10-14): the short formats still chase a simulated total. Unverified on a phone: the
   meter's 1 s sweep and window widths, marker drag precision, the bowling camera's framing on real screens.
2. Career: ladder of AI teams, coins from wins, batter upgrades (timing window, power).
3. Achievements (e.g. 3 sixes in an over, chase 20+ in the last over, 10 perfect-timing shots).
4. Original collectible characters/kits as part of career.
5. Unverified on real iPhone hardware: frame rate. With one draw call per skinned person (2026-10-17, the lab's worst frame per
   view, shadow pass included): batting view 103 calls, side-on replay 82, bowling view 63 (95 with the non-striker), chase 51,
   cordon 57, celebration orbit 115; T20 bowling view at a keeper's gather 87 calls / 132k triangles. Triangles without the crowd
   at most ~133k (the celebration); the crowd adds 55k-400k by view (its `QT` tiers). Skinning 14 people with 23 bones each is
   vertex work the adaptive tiers don't reduce; if slow on a phone: drop far fielders' skinning to the rigid fallback.
6. Characters (docs/characters.md, As built: open findings): the bowler's bound pops 9-20 cm and his planted foot slides ~2 m/s;
   the spin approach leans 45 deg; front-foot contact is a T; spin and pace releases look alike; the throw has no crow-hop; dives
   face-plant; catches end 15-30 cm short of the ball; residual fielder skating; the keeper's give puts the gauntlets on the helmet.
- Wicket rates per planet are not guarded (only runs are): with real edge trajectories, Jupiter's gravity drops edges short of
  the cordon (about half the catches; easy short-format chases rarely lose a wicket), while Venus, Saturn and Neptune catch more.
  T20 per-planet win rates stay in band. If it matters: a per-planet cordon depth in `fieldFor`/`tplField`.
- Sun/moons/stars are screen-space with a yaw shift; Saturn's rings don't rotate with the chase camera.
