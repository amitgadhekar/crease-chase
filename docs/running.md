# Running between the wickets (plan)

Status: design approved by the owner (2026-10-17, answers below). Being built.

## Owner decision (2026-10-17)

G1 = **automatic runs with visible running.** The game keeps deciding the runs exactly as now (logic.js outcomes unchanged,
balance fingerprint `FP` 96fcd588 unchanged). Both batters visibly run, cross for 1-3 runs and turn for the next run. No run-outs
and no new controls. Original IP only. Batting feel comes first: the time between balls must not drag.

### Owner answers (2026-10-17)
1. Timing: **C**, the logic's own pace, the running overlapping the countdown, the result phase growing only by what is still
   missing (cap +3.0 s; about +0.8 s per over).
2. Quick match: **yes**, add a non-striker and running (Nets stays without).
3. Calls: **recorded voice calls** ("Yes", "No", "Wait", "Two"...), original or CC0/Pixabay clips listed in README; the owner picks
   them on a listening page as with the other sounds; gestures and head turns as well.
4. Throws: **to the danger end**, with the keeper drawn in the batting view from contact for keeper's-end throws; direct hits only
   when every batter has been home for >= 0.5 s.

## Decisions (proposed by this plan; the owner's answers will override them)

- **Timing:** runs are shown at the logic's own pace. A run is completed **3.0 / 5.4 / 8.0 s after contact** for 1 / 2 / 3 runs:
  these are `runsFor`'s thresholds, which award a run only when the ball comes back no earlier than that. The running overlaps the
  rest of the result phase and the 2 s countdown. The result phase grows only by what is still missing, **capped at +3.0 s per
  ball**. Measured: 0 s for singles, +1.3 s median for twos, +2.7 s median for threes, **+0.7-0.9 s per over** on average.
  Bowling, there is no fixed extension: Bowl waits until the batters are home, as it already waits for a throw.
- **Modes:** running in Quick match, T20 (both innings) and Scenarios. **Quick match gets a non-striker.** One player bats both
  batters there, nothing is tracked per batter, and the two models are identical, so crossing is purely visual. **Nets: no
  running and no non-striker**, as in real net practice.
- **Strike and ends:** no logic change. Whoever finishes at the striker's end (z=0) is the striker. That always matches
  `batRecord`/`swapStrike`, because both swap on odd runs and neither swaps on boundaries or wides. The camera never changes ends
  (the game's convention since day one, at the over break too). The two rigs swap which figure they draw only after the
  recording has ended, so a replay never shows a jump.
- **Throws:** the throw goes to the **danger end**, where the striker finishes his last run (bowler's end after an odd number of
  runs, keeper's end after an even number). The release waits until the ball arrives **>= 0.3 s after that batter's bat is
  grounded**. A **direct hit** is allowed only when every batter has been home for >= 0.5 s. Otherwise the throw is a plain
  take.
- **Animation:** procedural, on the existing tools: `MO.gait` jog and sprint, the non-striker's one-handed bat carry, plus three
  keyed moments: the start, the bat slide at the crease and the turn. Calls are gestures and head turns, with no voice in v1.
  Replays need no new recorded floats, only the rule above about when the rigs swap. On a four or six the batters ease up within a
  few strides and walk back behind the replay.

## 1. Timing

### Today, measured

Measured over src/logic.js in node:vm (a throwaway script with the balance test's bot pattern), Earth, 40,000 deliveries a row.
`dur` uses `doSwing`'s formula. Rows: "std" is the balance bot (45 ms spread, 30% lofted). "human" has a 65 ms spread, 22%
lofted and 10% blocks. "ring" is the short-format field and "T20" is the T20 templates.

| | running balls / 100 | 1s / 2s / 3s per 100 |
|---|---|---|
| std medium, ring | 13.7 | 7.4 / 2.5 / 3.8 |
| human medium, ring | 16.6 | 10.0 / 3.7 / 2.9 |
| human medium, T20 | 20.1 | 11.3 / 6.8 / 2.0 |
| human hard, T20 | 17.5 | 10.4 / 5.5 / 1.6 |

| `resultDur` today (s) | p10 | p50 | p90 | max | ball picked up (stop/fetch `t1`, median) |
|---|---|---|---|---|---|
| 1 run | 2.3-2.8 | 3.0 | 3.4-3.9 | 4.5 | 1.2-2.0 |
| 2 runs | 2.2 | 2.9-3.1 | 3.4-4.4 | 4.7 | 2.8-3.8 |
| 3 runs | 4.0 | 4.2 | 4.3 | 4.5 | 4.9-5.5 |

Threes are mostly lofted into the deep, which brings in the chase camera's `h.T + 1.4`. Contact to the next run-up start is
`resultDur + BALL_GAP` (2 s), or longer when a replay follows. The run-up then takes 1.1-1.5 s.

Real pace, for scale: the Run-2 test (two 17.68 m legs with a turn, bat carried, no pads) averages 6.10 s for international men.
Run-a-three is 8.5-9.0 s at international level and 9.5-10.5 s at club level [1][2]. The logic's 3.0 / 5.4 / 8.0 s is already
at the elite end: the second run takes 2.4 s, against about 3.0 s per leg in Run-2. The body travels about 16 m, not the full
17.68 m, because the bat reaches over the crease and the non-striker has backed up 1.4-1.9 m.

### Options

The batters are home at `T_n` (3.0 / 5.4 / 8.0 s). Then 0.6 s to settle: the last run eased in, and the new striker turns and
takes guard. The striker must be in his stance 0.3 s before the run-up starts. Added seconds:

| option | 1s p50/p90 | 2s p50/p90 | 3s p50/p90 | per over |
|---|---|---|---|---|
| A. Lengthen the result phase to fit, no overlap with the countdown | 0.6 / 0.8-1.4 | 3.0 / 3.8 | 4.4 / 4.6 | 1.75-2.15 |
| B. Compress the running 1.25x, no overlap | 0 / 0.2-0.8 | 1.9 / 2.8 | 2.8 / 3.0 | 1.00-1.21 |
| **C. Logic pace, overlap with the countdown, extend only the rest** | 0 / 0 | 1.3 / 2.1 | 2.7 / 2.9 | **0.73-0.89** |
| D. As C, running 1.15x faster than the logic | 0 / 0 | 0.6 / 1.4 | 1.7 / 1.9 | 0.42-0.51 |

- A is honest but doubles the cost and puts a dead pause before every ball with runs.
- B and D look fast-forwarded. The batters would outrun the fielders (6.2-7.5 m/s), and in D the second run would take 2.1 s,
  about 35% quicker than international players. The visible run would also no longer match the decision: the logic says the
  batters needed 5.4 s for two.
- C keeps what you see consistent with what the logic decided, so "home before the ball" holds by construction. It costs time
  only on twos and threes (5-9 balls per 100), right when the player has just scored and is watching the payoff.

**Recommendation: C with a 3.0 s cap per ball.** If the cap would be hit (a three off a quick result), only the last leg speeds
up to fit. D is the fallback if the owner finds C slow (owner question 1).

How it is applied:
- At `commit`, `runPlan` sets the batters' timeline from `res.runs`. Extension = `clamp(T_n + 0.6 + 0.3 - (resultDur + 2.0), 0, 3.0)`,
  added to `resultDur`. The result phase grows, not the countdown, so the countdown always looks the same.
- If `afterResult` starts a replay (a drop, chance or save with runs, a catch, a boundary), the running carries on behind it on
  the game clock, as the bowler's walk back already does. The unused extension is dropped then, so a replayed ball adds nothing.
- Safety net: `ready` only starts the run-up once the striker is settled.
- Bowling (T20 first innings, `M.bowl`): no extension. `bowlUI` keeps Bowl off until the batters are home, as it does for `S.thr`.
  The player sets the delivery chips and the marker meanwhile.

## 2. Modes

| option | look | cost | verdict |
|---|---|---|---|
| **A. A non-striker in every match mode (not Nets)** | real cricket in the most-played mode | Quick match moves into the "with non-striker" budget: +~30 draw calls and ~26k triangles (CLAUDE.md, measured); iPhone frame rate unverified (backlog 5) | **recommended** |
| B. Running only where a non-striker exists (T20, Scenarios) | least work; Quick match stays static, so the two experiences differ | none | fallback |
| C. The striker alone runs and walks back | reads as a bug (nobody runs alone); the walk back costs time | small | rejected |

Quick match needs no strike logic: no names, tiers or HUD batter cards. `nsTick`'s `n.on` becomes "any match mode except Nets",
and the kit is `KIT.you`, as in Scenarios. Nets keeps today's loop: no non-striker and no running, because net practice has no
running.

## 3. Strike, ends and camera

- Outcomes are untouched. `batRecord` swaps on odd runs (not boundaries or wides) and after a wicket brings the next batter in on
  strike. `swapStrike` swaps at the over. Hold (`applyHold`) takes off the last odd run before `testRecord`/`recordBall`. The run
  plan always uses the final run count, after Hold.
- **Who stands where:** the figure at the striker's end (z=0) is the striker for the next ball. After an odd number of runs the
  figures have crossed. The striker rig (`G.bat`, driven by `poseTick`) then takes over the figure that finished at z=0, and the
  non-striker rig (`G.ns`) the one at the bowler's end. Both are the same model in the same kit (`SKN.b2` is a SkeletonUtils clone,
  and `setKits` dresses both), so the swap cannot be seen. It happens only once the recording has stopped: at `afterResult`, or
  when the batters are home if that is later. Swapping inside the recording would make `rpView` blend `G.bat`'s root across the
  pitch for one frame.
- **Over break:** no visible change, as today. In real cricket the batters stay put and the bowling end changes. The game keeps
  the striker's end at z=0, so `swapStrike` stays a HUD change.
- **Camera:** no change. The batting view stays behind z=0. The running happens in front of it: the striker runs away down the
  pitch, the non-striker comes towards the camera, and on a two the striker comes back towards it, easing to a stop around z
  -1..0, well inside the 9 m to the camera. The bowling view (end-on behind the bowler) shows the AI batters running the full
  length of the pitch.
- **HUD (T20, Scenarios):** the strike marker flips when the ball is recorded, before the batters cross. That is cosmetic; it
  could later wait for the crossing.

## 4. Throws and direct hits

Throws are show-only today (`planThrow`/`thrPlan`). Batting, they go to the bowler unless a cut is on. Bowling, the end is chosen
by geometry.

- **A. Throw to the danger end, timed against the batters (recommended).** The end is where the striker finishes his last run:
  the bowler's for 1 or 3 runs, the keeper's for 2. The striker starts from the batting crease after a shot, so he arrives later
  than the backing-up non-striker. If that end's planned arrival `ta` falls less than 0.3 s after his bat is grounded, the release
  `tr` waits up to 0.6 s ("he gathers, looks up"). Failing that, try the other end. Failing that, no throw (the ball is kept, as
  for long fetches today). In the batting view the keeper is drawn from contact on, for keeper's-end throws, until the next ball's
  `ready`. That changes `batView()`: today it hides him for the whole home view.
- B. Today's end rules, gated on the batters being home. Least change, but on a two the ball goes to the end nobody is in danger
  at.
- C. Throws only after the running has finished (a casual return). Never wrong, but it loses the moment of the ball coming in
  as the bat slides in.

**Direct hits** (10% of flat or underarm throws up to 30 m, 25% from the bowler): kept, but `o.hit` is allowed only when every
batter has been home for >= 0.5 s at the hit (bat grounded, not running). Otherwise it is a take. A hit on a batter who is clearly
in reads as "safe", as it does on TV, so the stumps-and-sound-only rule (no text) stays.

Consistency: the logic's return time is `t + REC + distance to the striker's end / 30`. The game throws flat at 28 m/s after a
wind-up, and to either end, so a straight deep fielder can reach the bowler's end earlier than the logic assumed. Hence the
release delay. The existing rules still hold: a bowler's-end throw ends inside the result phase (he must get back to his mark),
and a keeper's-end throw may run up to 1.6 s into the countdown. The result end (`tE`) now includes the extension.

## 5. Animation, replays and boundaries

| option | | verdict |
|---|---|---|
| **A. Procedural on the motion toolkit** | `MO.gait` jog and sprint (with flight) for both batters, from the track position as `nsTick` already does; the bat carried in the bottom hand with the free arm swinging (`nsPose`'s offset channels); keyed moments below; planted feet from the gait (slip gates as for fielders) | **recommended** |
| B. Authored run clips (Blender keyframes, glTF animation) | the project drives bones from poses, not an `AnimationMixer`; adds size; the bat and slide would still need procedural targets | rejected |
| C. A generic jog with no slide or turn | cheapest; reads cheap, and the turn is the most recognisable part of running | rejected |

Keyed moments:
- **Start:** from the end of the follow-through (contact + 0.25 s for a block, about 0.45 s for a full shot), the pose blends
  into the run over 0.2 s, the top hand coming off the handle. The non-striker is already backing up and goes from his
  `NS.u`.
- **Bat slide:** over the last 1.5 m before the crease the carrying arm reaches forward and down, with the blade toe on the ground
  (<= 3 cm). The bat crosses the line before the body. On a safe last run (the throw is more than 0.8 s away) the batter jogs in
  and grounds the bat without a slide.
- **Turn:** decelerate, ground the bat over the crease, plant the outside foot and pivot 180 degrees turning towards the ball's
  side, so he can see it (`MO.anchors` pivot steps), then push off. Switching the bat to the other hand is polish, not v1.
- **Calls:** by the usual convention, the striker calls for balls in front of square and the non-striker for balls behind it.
  The caller's head turns to the ball (`lookAt`), then his free arm points down the pitch ("yes") or goes up palm-out ("no" or
  "wait", used for Hold). The partner looks at the caller. No voice clips in v1 (owner question 3).
- **Lanes:** the batters run on opposite sides of the pitch, about 1.1 m from the middle, clear of the protected area (a strip
  0.3 m either side of the middle-stump line, from 1.52 m in front of each popping crease [3]). The non-striker keeps his side,
  away from the bowler (`NS.x`), and the striker takes the other.

**Hold** (T20 chase, Scenarios): the window opens when the outcome is shown, as now, and lasts 0.6 s. For a holdable ball the
runners play a "start": two or three strides out, watching. They commit to the run when the window closes. Held means they turn
back and ground the bat, with a "no" gesture (a single held to 0 runs), or they refuse the last run after the others (a three
held to 2). Under a cut (cordon or chase camera) the batters cannot be seen, so they wait at their creases until the window
closes. That adds up to about 1 s on these rare balls.

**Other outcomes:**
- Four along the ground: they set off, ease up within 3-4 m once the chase camera starts (contact + 0.15 s), and walk back.
  Boundaries keep the strike, so they finish at their own ends, all behind the replay.
- Six: a step or two, then they watch.
- Catch: they run cautiously while the ball is in the air and stop at the catch. The non-striker walks back behind the catch
  replay. There is no walk-off in v1, as today.
- Bowled, LBW, stumped, wides: no running.
- Drops with runs: they run as planned.
- 0 runs off a stop in the ring: a single "no" step is optional polish.

**Replays:** the striker's run goes into the pose's hip and feet channels (as `bpos` does), and the non-striker's into `ns.x/u`
(the `u` range grows to the far end). All of that is recorded already, so the 188-float frame layout is unchanged. Rule: no rig
swap inside the recording (section 3). Replays of fours and sixes need no running. `V.hideBat` (the striker hidden under the
chase camera) stays: the chase camera starts at the batter.

## 6. Fielders' timing

The fielders' plays come from the logic (`res.fplay`, times after contact). The throw is planned in `doSwing` (`planThrow`) and
runs inside the result phase, or up to 1.6 s past it at the keeper's end. Running adds three checks and no new fielding logic:
1. The throw arrives at its end >= 0.3 s after the batter's bat is grounded there (section 4). This holds on the logic's side
   because `runsFor` awards run n only when the return is at least `T_n`; the release delay covers the game's different throw
   speed and end.
2. The batters' run count always equals `res.runs`: no run is started that the logic did not award, except Hold's refused last
   run.
3. The receivers (keeper at his stumps, bowler at his) and the runners keep >= 0.6 m apart. The bowler's follow-through and his
   jog back cross the striker's lane at about z 13-17, about 2 s after release. A lab metric checks this, and the striker's lane
   moves out by 0.3 m if needed.

The fielders' walk back (`walkTo`) already reads the time left from `resultDur`, so the extension gives them more time with no
change.

## 7. Implementation steps

| step | what | files | size |
|---|---|---|---|
| 1 | `runPlan(res, ctx)`: legs, start, turn and arrival times from `T_n`, lanes, danger end, cap; extension at `commit`; replay takeover in `afterResult`; settled gate in `ready`; Bowl waits (`bowlUI`) | 04-match-flow.js, 08-loop.js (`update`), 04d-bowl.js | ~70 lines |
| 2 | Bodies: striker run layer after the follow-through (pose hip and feet plus the gait), `nsTick` running the full length, bat carry, slide, turn, calls, head look; rig swap outside the recording | 07-render3d.js (`poseTick`, `nsPose`, `nsTick`), 07-motion.js (if a pivot helper is missing) | ~150 |
| 3 | Quick match non-striker (`n.on`, kit), none in Nets; draw-call check | 07-render3d.js, 07-skin.js (`kitBatter`) | ~10 |
| 4 | Hold: start phase, turn back or refuse the last run; waiting under a cut | 04c-scen.js (`holdEnd`), 04-match-flow.js | ~25 |
| 5 | Throws: danger end, release delay, direct-hit gate, keeper drawn after contact for keeper's-end throws | 08-loop.js (`planThrow`, `thrPlan`), 07-render3d.js (`batView`) | ~40 |
| 6 | Boundaries, catches, drops: ease up, stop, walk back behind the replay | 04-match-flow.js, 07-render3d.js | ~25 |
| 7 | Replays: check the recorded running (no blend jumps), `RMAX` headroom | 08b-replay.js | ~10 |
| 8 | Lab: sequences and metrics (below) | 07b-lab.js, tests/charlab/{sequences,thresholds}.json, metrics.mjs | ~80 |
| 9 | Smoke: a `running` section | tests/smoke.mjs | ~90 |
| 10 | CLAUDE.md (ball state machine, non-striker, throws, replays, decision log) and this doc | CLAUDE.md, docs/running.md | small |

Estimate: about 2 days of agent work. That is M+, against the L in the roadmap, which included calling and run-outs. logic.js is
not touched, so `npm run test:balance` must stay green with `FP` 96fcd588 (run it once as a guard). Run `npm run test:smoke` and
the lab after each game step.

**Lab** (sequences 1, 2, 3 runs, a held single, a held three, a boundary ease-up, a catch while running; both kits; portrait and
landscape; batting and bowling cameras). Metrics:
- planted-foot slip < .05 m/s straight and < .15 m/s turning
- teleports 0 (rig swap included)
- facing <= .2 rad/frame
- bat toe <= 3 cm over the slide
- the bat over the crease >= 0.3 s before a thrown ball arrives at that end
- no stumps broken while a batter is short
- runner to runner, bowler and receiver distance >= 0.6 m
- striker in his stance before the run-up starts
- crossings counted = `res.runs`

**Smoke** (`running`): force a 1, 2 and 3 (`PLAYS` predicates on `res.runs`) and assert:
- the end each batter finishes at
- `M.st.s` agrees with the figure at z=0 (T20)
- added time <= 3.0 s and equal to the formula within 0.1 s
- the screenshots at the slide and the turn

Then also:
- a held single in a scenario (turn back), a drop with runs (batters home after the replay)
- the T20 bowling view: Bowl is off until the batters are home
- Quick match: the non-striker is drawn; Nets: none
- a landscape pass

Risks:
- **Time creep:** guarded by the cap and the smoke assertion. The per-over cost can be re-measured with this doc's script pattern
  after tuning.
- **The keeper in the batting view** when up to spin: drawn after contact, he can block the striker coming back for a two.
  Check the screenshot. The fallback is option B's ends for keeper's-end throws in the home view.
- **Throw release delays** that look like dawdling (>0.4 s): count how often they happen in the smoke run. Fallback: the other
  end, or no throw.
- **Recording length:** `RMAX` 600 frames is 8 s from the run-up, while a three's result with the extension is about 7.4 s.
  Replays end earlier (a drop's tk + 0.8), so frames dropped at the end do no harm. Check `REC.n < RMAX` for replayed balls.
- **Procedural fallback batter** (GLB failed): `G.bat` and `G.ns` no longer look the same, so the rig swap would show. That is
  only on the fallback path; accept it.
- **Performance:** Quick match +~30 draw calls. iPhone frame rate is still unverified; the adaptive tiers react to it.
- **Concurrent work:** character polish P1-P3 touches the same batter and gait code (07-render3d.js, 07-motion.js). Sequence it
  after P, or agree file ownership as in docs/characters.md.

## Owner questions (recommended answer first)

1. Timing: C (logic pace, overlapping the countdown, cap +3.0 s; about +0.8 s per over), or D (15% faster; about +0.45 s per
   over)?
2. A non-striker and running in Quick match: yes (recommended), or T20 and Scenarios only?
3. Calls: gestures only in v1 (recommended), or recorded voice calls ("Yes", "No", "Wait"; new clips and licences)?
4. Throws to the danger end, with the keeper drawn in the batting view after contact for keeper's-end throws: yes (recommended),
   or today's ends?

## Sources

1. Topend Sports, Run-2 cricket running speed test (procedure; international men 6.10 +/- 0.16 s, Ahmun et al. 2020):
   https://www.topendsports.com/testing/tests/run-2-cricket.htm
2. Topend Sports, Run-a-three test (international 8.5-9.0 s, club 9.5-10.5 s): https://www.topendsports.com/testing/tests/run-a-three.htm
3. Protected area (Law 41: a rectangle from 1.52 m in front of each popping crease, 0.30 m either side of the middle-stump line):
   https://www.crictracker.com/cricket-news/what-is-a-danger-area-in-cricket-what-does-it-mean-and-why-was-kuldeep-yadav-warned-9759/
   and https://www.cricket.com.au/news/3308652

Measurements: a throwaway node:vm script over src/logic.js (bot as in tests/balance.mjs; `dur` as in `doSwing`), not committed.
