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
```
Game modules: 01 core state, settings, sizing, camera + projection, planet application · 02 audio (WebAudio, recorded clips) ·
03 HUD/banner · 04 match flow + ball state machine + scoring · 05 input (pointer/keys, footwork joystick) · 06 sky drawing, particles,
2D overlays (aim arrow, radar, timing bar, info text) · 07-geometry raw shape builders (`GB`, people parts) and `geo`/`fillGeo`
(-> BufferGeometry) · 07-render3d three scene (stadium, pitch, people, bat, stumps, ball), batter pose, view state ·
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
  stumps, ball, ground layers); `build3D` refreshes it per planet in place (canvas textures redrawn, rope/ring/stand geometry
  refilled, colours, lights, fog); `render3D(V)` only sets matrices (`matrixAutoUpdate` off; `mB`/`mL`/`mT` write
  `mesh.matrix`), visibility and fog distance. Don't create three objects per frame. Everything sits in `T3.world`, mirrored
  in x, because game coordinates are left-handed. Flat ground layers (ground disk, rope, rings, pitch, creases, blob shadows,
  pitch marker) use `flat()`: no depth test, CustomBlending (keeps them in three's opaque list), painter's order by negative
  `renderOrder`; stadium, stumps, people, bat and ball are depth-tested after them. All materials are DoubleSide; `fillGeo`
  rewinds triangles to match their normals. Lambert + HemisphereLight + DirectionalLight (intensity PI) reproduce the old
  shader; `specMat` adds its shine/rim term. Colour management lives in `colourSetup()`: off, linear output and linear fog
  for parity with the old engine (Phase 2 switches to sRGB/tone mapping there).
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
- **People models** (07): limbs are tapered capsules built once per fixed bone length (`capG`, `mL`), so joints blend
  without gaps; changing a bone length means rebuilding its geometry. Batter parts in `BG`, fielders/bowler in `PG`
  (lower poly, 13 meshes each; `personRig`/`batterRig` create them, `person3D`/`batsman3D` pose them). `GB.surf`/`GB.join`
  in 07-geometry build smooth parametric shapes; `specMat` adds the shine/rim light (batter gear only).
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
  Build-time npm deps (three, esbuild, playwright) are devDependencies pinned to exact versions that were at least two weeks
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
  rejected for size.
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
5. Unverified on real iPhone hardware: frame rate (~85 draw calls/frame in a normal ball after three's frustum culling, up to ~190, plus up to 600 2D firework sparks in the celebration). If slow: merge person parts into one
   mesh per person, reduce sphere/cylinder segments, cap devicePixelRatio lower.
- No wicket-keeper is drawn (it would block the batter from this camera); the keeper still exists in fielding logic,
  and stumpings just knock the bails off.
- Sun/moons/stars are screen-space with a yaw shift; Saturn's rings don't rotate with the chase camera.
