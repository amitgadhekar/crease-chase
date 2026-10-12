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
npm install                      # once; then: npx playwright install chromium
npm run build                    # src/ -> dist/crease-chase.html (single self-contained file)
npm run test:balance             # bot plays ~20k balls per row against src/logic.js; exits 1 if balance drifts
npm run test:smoke               # builds, plays each planet in headless Chromium, fails on page errors
npm test                         # both
```
Open `dist/crease-chase.html` directly in a browser to play. `#test` in the URL exposes `window.__t` for tests.
Live at https://amitgadhekar.github.io/crease-chase/ (public repo, free GitHub Pages). Every push to `main` runs
`.github/workflows/pages.yml`: balance test, build, deploy `dist/crease-chase.html` as `index.html`. A failing balance
test blocks the deploy. `dist/` is not committed.
Run `npm run test:balance` after any change to physics, timing windows, shot resolution, fielding or planet values.
Run `npm run test:smoke` after any change to rendering, flow or input, and look at `tests/screenshots/`.

## Layout
```
src/index.html            HTML shell + overlays (menu, intro, pause, end). @include markers are filled by build.mjs
src/styles.css            UI styles. Theme tokens on :root with dark-mode overrides
src/logic.js              PURE game logic, no DOM: physics, planets, delivery, shot resolution, fielding, AI brain
src/engine.js             Tiny WebGL engine (E3) + unit geometry builders (GB). No dependencies
src/game/01-core.js ...   UI/game code. All files are concatenated IN FILENAME ORDER into ONE closure (IIFE) by
src/game/09-menu-boot.js  build.mjs, so they share scope. Keep the numeric prefixes; order matters for top-level consts
build.mjs                 Bundler (no npm deps)
tests/balance.mjs         Balance simulator over src/logic.js (runs in node:vm)
tests/smoke.mjs           Playwright smoke test over dist/
```
Game modules: 01 core state, settings, sizing, camera + projection, planet application · 02 audio (WebAudio, recorded clips) ·
03 HUD/banner · 04 match flow + ball state machine + scoring · 05 input (pointer/keys) · 06 sky drawing, particles,
2D overlays (aim arrow, radar, timing bar, info text) · 07 3D scene (stadium, pitch, people, bat, stumps, ball) ·
08 camera follow + main loop · 09 menu wiring + boot.

## Core model (read before touching physics or rendering)
- **World coords (metres):** batter's stumps at z=0, bowler's stumps at z=20.12, +z toward the bowler, +y up,
  **+x = off side** (screen right from the default camera; right-handed batter). Batter stands at z=BATS_Z (1.05),
  ideal contact at z=CONTACT_Z (1.8). Shot angles are degrees in the ground plane: 0 = straight back past the bowler,
  +90 = square off side, -90 = square leg side.
- **Camera:** `cam` = position + yaw, looking horizontally (no pitch). `proj()` in 01-core is the single source of truth:
  screen = (CX + xc*F/zc, HZ - yc*F/zc). The WebGL view/projection matrices in 07 (`viewProj`) are built to match it
  exactly (off-centre horizon at HZ), so 2D overlays drawn with `proj()` line up with the 3D scene. If you change one, change both.
  Field of view is changed only by setting `F` (reset to `baseF`, like `HZ`/`baseHZ`), so both stay in sync.
- **Rendering layers:** `#sky` 2D canvas (gradient, stars, sun/moons with yaw shift, Jupiter bands, Venus clouds, Saturn rings)
  → `#gl` WebGL canvas (transparent clear) → `#scene` 2D overlay canvas, which also receives all pointer input.
  In 3D, flat ground layers (ground disk, rope, rings, pitch, creases, blob shadows, pitch marker) are drawn first with
  depth test OFF in painter's order; then stadium, stumps, people, bat, ball with depth test ON. Culling is disabled.
- **Time:** game clock `clock` only advances when not paused. Input timestamps are converted with `gameTimeAt()` so
  pausing never desyncs timing.
- **Ball state machine** (`S.phase`): `break` (new over banner) → `ready` (countdown, settings.gap seconds) → `runup`
  → `flight` → `result` → back to `ready`, or `break` at an over boundary. Swings resolve at `tc = release time + SWING_DELAY`.
  Stump checks and swing resolution are processed in chronological order within a frame (see `flightUpdate`).
  A chase win goes to `celebrate` (~6 s, tap/key skips): bat raise, then `celCam` flies out to a wide orbit (camera raised,
  `HZ` moved up, `F` zoomed out; framing derived from the stand radius) with fireworks (`FW` in 06, max 600 sparks).
  `endMatch` does the records/end-screen bookkeeping once; `showEnd` shows the end screen.
- **Timing:** windows in `EARLY`/`LATE` (late is tighter: the ball is past you), scaled by difficulty `win`.
  Early timing pulls the shot to the leg side, late pushes it to the off side (`dir = aim + dt*300`).
- **Shot quality:** `q = timing quality * (0.35 + 0.65 * shotFit)`. `shotFit` compares ball length/line with the chosen
  shot's preferred length/line (`SHOTS`). Poor fit can turn into an edge or top edge even with perfect timing.
- **Batting input:** pull back like a slingshot (default) or point the way (setting). Drag length = power.
  Ground shot by default; the **Loft** button lofts the next shot only and resets every ball (deliberate, so lofting
  can't stay on by accident). Tap = block, no touch = leave.
- **Batter animation** (07, visual only): full-body procedural pose (24-number arrays: feet, hips, spine, shoulders,
  hands, bat, head), knees/elbows by 2-bone IK. `poseTick` blends from the pose on screen: trigger step from delivery
  length during flight, per-shot impact/follow-through (`SH3`, one per `SHOTS` entry), block, leave, celebrate.
  The impact pose must land exactly at release + `SWING_DELAY`: the player's timing is anchored to it visually.
- **People models** (07): limbs are tapered capsules built once per fixed bone length (`capG`, `mL`), so joints blend
  without gaps; changing a bone length means rebuilding its geometry. Batter parts in `BG`, fielders/bowler in `PG`
  (lower poly, 13 draws each). `GB.surf`/`GB.join` in engine.js build smooth parametric shapes; `o.spec` adds an
  optional shine/rim light per draw (batter gear only).
- **Audio** (02): recorded MP3 clips in `src/sfx/` (filename = role, e.g. `fw-launch.mp3` -> `SFX_DATA.fwLaunch`), embedded as base64 by
  `build.mjs` (`@include-sfx` in src/index.html) and decoded once on AudioContext creation; sounds requested before decoding are skipped.
  `play(name,{vol,rate,delay,lp})` -> master gain + compressor. Bat kind (mid/edge/top/block) is picked from the result label.
  Crowd bed loops via `loopStart/loopEnd`. Only thunder is still synthesized. Clip sources/licences are listed in README.md.
- **AI bowler brain:** per length/line stats of runs and wickets conceded (`mem`, persisted in localStorage `cc_mem`,
  capped at 40 samples). Weights favour what has cost it least; hard mode avoids repeating a length 3 times; pressure
  situations add yorkers/bouncers; slower balls by difficulty. `brainInsight` produces the "Bowler's plan" text.
- **Field AI:** each over, moves up to N ring fielders deep into the sectors where the batter scored most (`fieldFor`).
- **AI innings:** simulated instantly (`simulateAI`), scaled by each planet's `ai` multiplier. Super over uses `SUPER_AI` weights.
- **Planets** (`PLANETS` in logic.js): physics (`g`, `air`, `swing`, `spin`, `bounce`, `pace`, `boundary`, `wind`, `ai`)
  plus `vis` for the look. `setPlanet` derives `ENV.carry`, `ENV.acc` (ground deceleration), `ENV.run` (fielder speed).
  Wind is rolled per over and drifts lofted shots. 3D lighting and fog per planet live in `LOOK3D` (07-render3d.js).
  If you change planet physics, re-run the balance test and update that planet's `ai` multiplier to the measured
  "scoring vs Earth" ratio (the test checks they stay within 0.8-1.25 of each other).
- **Chase camera:** on fours and sixes the camera follows the ball (`updateCam`), and the banner and score reveal are
  deferred until the ball crosses the rope (`S.deferred`). The batter is hidden while the chase camera is active.

## Constraints to keep
- Output must stay ONE self-contained HTML file: inline CSS/JS, no build-time npm deps, works offline
  (Google Fonts are optional with fallbacks). It is hosted on GitHub Pages and can also be published as a claude.ai artifact, whose CSP only allows scripts from
  cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, cdn.tailwindcss.com, code.jquery.com and styles from fonts.googleapis.com.
  The custom WebGL engine exists so the game needs no CDN and stays fully testable offline; prefer extending it over
  adding Three.js. If a library is ever needed, pin an exact version that is at least two weeks old.
- localStorage keys are prefixed `cc_` (settings, mem, records); every access is wrapped in try/catch.
- Mobile first: portrait iPhone, safe-area insets, `touch-action:none` on the input canvas, 44px+ touch targets.
- Keep `src/logic.js` free of DOM access so the balance test can run it in Node.

## Decision log
- Batting control: compared one-tap timing, single swipe, and drag-to-aim/release-to-swing. Chose release-to-swing
  (aim and timing are separate skills; finger-up timing is precise on phones). Then switched to slingshot aiming at the
  owner's request (finger stays low, doesn't cover the ball); kept "point the way" as a setting.
- Loft: button applying to one ball only, rather than drag length or a sticky toggle.
- Venues are planets, not cities, by owner request. Physics differences are real, not cosmetic.
- 3D: custom ~100-line WebGL engine instead of Three.js, because the CDN couldn't be reached for testing and the
  single file must work offline. Three.js would make real shadow maps easier if ever needed.
- Pause between balls: `ready` phase with a countdown, configurable (1 / 2 / 3.5 s), plus longer run-ups.

## Known gaps / backlog (ranked as discussed)
1. Bowling: let the player bowl (line, length, pace, variations) to an AI batter, so a match is two real innings.
2. Career: ladder of AI teams, coins from wins, batter upgrades (timing window, power).
3. Achievements (e.g. 3 sixes in an over, chase 20+ in the last over, 10 perfect-timing shots).
4. Original collectible characters/kits as part of career.
5. Unverified on real iPhone hardware: frame rate (~190 draw calls/frame, plus up to 600 2D firework sparks in the celebration). If slow: merge person parts into one
   mesh per person, reduce sphere/cylinder segments, cap devicePixelRatio lower.
- No wicket-keeper is drawn (it would block the batter from this camera); the keeper still exists in fielding logic.
- Sun/moons/stars are screen-space with a yaw shift; Saturn's rings don't rotate with the chase camera.
