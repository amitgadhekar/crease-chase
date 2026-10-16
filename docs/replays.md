# Replays: more events (plan)

Status: built (2026-10-15), see "7. As built" at the end. Before it a ball got a replay after a four or six (side-on slow motion, then
the spider-cam) and after a caught wicket (camera class by where the catch is taken: close, cab, field), the last wicket's too.
Owner request (2026-10-15): "Start planning on adding replays on many other events, like catching the ball, catch out, bowled
out, or any significant events where catches are missed." Owner priorities: batting feel first (replays short, skippable, not
too frequent), fielders visibly trying, original IP only.

## Decisions (proposed by the plan; owner decisions of 2026-10-15 at the end override them)

- **Add (v1):** bowled (played on included), LBW, stumped, dropped catches and hands-on missed chances (dives and leaps that touch a
  catchable ball), a rope save (a stop within 10 m of the rope of a ball that would have reached it), and the rider's leap under a
  six (slow motion inside the existing six replay). Always replayed, wherever they happen (batting, bowling, Scenarios, nets).
- **Not replayed:** near-miss dives (6-10 per 100 balls: far too common), plain or diving stops in the ring (12-21 per 100), throws
  and direct hits (show only; a replay would read as a run-out the game doesn't have, and the keeper's end now runs into the
  countdown, outside the recording), edges that beat the cordon untouched, top edges falling safe. Later (v2, if wanted): a
  play-and-miss shaving off stump and an LBW shout not given (pitched outside leg / outside the line), with the same cameras.
- **Build: a highlight detector + one replay director (approach B below).** `highlightOf(res,b,field)` in logic.js (pure, no
  randomness, so the balance fingerprint `FP` is unchanged) returns `{kind, ev, t}`; 08b turns it into a replay
  (`{cls, tk, slow window, end, sounds}`) and runs every replay, the existing ones included, through it.
- **Frequency: no new setting.** The new events add 0.05-0.65 replays per over (they are rare); the real load is the existing
  boundary replays (1.2-3.1 per over). Recommended: wickets and missed chances always; at most one boundary/save replay per over
  (open question 1). Tap-to-skip after 0.3 s stays.
- **Two new cameras only:** `stumps` (end-on, low, long lens from behind the bowler's stumps on the batter's stumps: bowled, LBW)
  and `crease` (square on at the popping crease, low: stumped). Drops reuse the catch classes; rope saves and six leaps reuse
  `field` (spider-cam with a slow window round the play).

## 1. Candidate events: detection and frequency

Measured over src/logic.js in node:vm (throwaway script, same harness pattern as tests/balance.mjs), Earth, 30,000 balls per
column, per 100 legal balls. Columns:
- **std**: the balance test's standard bot (always swings, 45 ms timing spread, 30% lofted, never leaves), short-format ring field.
- **human**: closer to a person: 65 ms spread, leaves 60% of balls wide of off (2% of others), 12% blocks, 22% lofted, half the balls
  with the "reads length" footwork bot; short-format ring field. About 29 / 13 / 9 balls per wicket (easy / medium / hard).
- **bowl**: the T20 first innings: the auto-bowler (`autoBowl`, a human-like release) to the AI batters (`aiBat`), T20 field
  templates, full innings.
- **T20 fields**: std / human on medium with the T20 templates (deep fielders, so rope events show up; the short-format field
  starts with none deep, so rope numbers there are understated).

| event (per 100 balls) | std E / M / H | human E / M / H | bowl E / M / H | T20 fields std / human | detect from |
|---|---|---|---|---|---|
| four (replayed today) | 35 / 26 / 19 | 21 / 14 / 10 | 20 / 22 / 24 | 21 / 12 | `res.boundary===4` |
| six (replayed today) | 15 / 13 / 11 | 6.7 / 5.3 / 4.5 | 8.9 / 10 / 12 | 12 / 5.1 | `res.boundary===6` |
| caught (replayed today) | 1.3 / 3.7 / 6.9 | 1.9 / 3.8 / 5.6 | 6.9 / 7.0 / 6.9 | 6.9 / 4.8 | `res.catcher`, fplay `o:'catch'` |
| - of which diving/leaping | 0.5 / 1.7 / 3.1 | 0.8 / 1.6 / 2.9 | 3.3 / 3.1 / 2.8 | 2.9 / 2.2 | catch event `k` dive/jump |
| **bowled** (incl. played on) | 0.0 / 0.3 / 0.8 | 0.6 / 1.9 / 3.5 | 3.4 / 2.7 / 1.6 | 0.3 / 1.8 | `outText` Bowled / Played on; `S.stumps` |
| **LBW** | 0.0 / 0.2 / 0.3 | 0.4 / 0.7 / 1.4 | 2.0 / 1.6 / 1.1 | 0.2 / 0.7 | `outText==='LBW'`, `res.pad`, `S.padHit` |
| **stumped** | 0 / 0 / 0 | 0.7 / 1.1 / 1.1 | 0.2 / 0.2 / 0.2 | 0 / 0.9 | `res.stumped`; `S.stumps.bails` |
| **dropped catch** (air) | 0.5 / 1.3 / 1.7 | 0.9 / 1.4 / 1.4 | 2.5 / 2.6 / 2.6 | 2.2 / 1.7 | fplay `o:'drop'`, ball above 0.2 m |
| - close / ring / deep | | 1.1 / 0.3 / 0.0 (med) | 1.6 / 0.5 / 0.5 (med) | 0.7 / 0.3 / 1.2 (std) | catcher's position |
| **hands-on missed chance** | 0.1 / 0.5 / 0.6 | 0.1 / 0.3 / 0.3 | 0.8 / 0.8 / 1.0 | 1.7 / 0.8 | fplay `o:'miss'`, dive/jump, ball at the hands (`hitPos`) |
| caught-and-bowled chance | <0.1 | <0.1 | <0.1 | <0.1 | drop/miss by the bowler's slot |
| **rope save** (stop <10 m from rope, ball would reach it) | 0.1 | 0.1 | 2.4 / 2.3 / 3.1 | 3.7 / 2.1 | fplay `o:'stop'` + path's natural length >= `distToBoundary` |
| - by a dive or slide | 0.1 | 0.1 | 1.4 / 1.2 / 1.7 | 2.1 / 1.2 | stop `k` dive/slide |
| **six with the rider's leap** | 0 | 0 | 0.3 / 0.2 / 0.4 | 0.9 / 0.4 | six + fplay `k:'jump', o:'miss'` |
| edge with a cordon dive/drop | 1.0 / 2.3 / 3.0 | 2.3 / 3.0 / 3.0 | 3.6 / 3.5 / 3.2 | 1.5 / 2.4 | `resolveEdge` result + close dive/jump/drop |
| near-miss dive (show only) | 11 / 9.8 / 8.6 | 7.7 / 6.4 / 6.4 | 6.7 / 6.9 / 7.6 | 9.9 / 6.9 | fplay `o:'miss'`, hands short of the ball |
| diving stop (any) | 18 / 20 / 20 | 13 / 14 / 13 | 12 / 12 / 14 | 21 / 14 | fplay `o:'stop'`, dive/slide |
| top edge lands safe | 0.3 / 0.4 / 0.3 | 0.2 / 0.2 / 0.1 | 0.6 | 0.3 / 0.3 | lofted mishit edge, not out |
| play-and-miss within 8 cm of off stump / bails | 0.0 / 0.1 / 0.4 | 0.5 / 1.0 / 1.5 | 1.7 / 1.4 / 0.7 | 0.2 / 0.9 | beaten/left, `ballPos(b,b.tStumps)` |
| pad, not out, would hit (outside line / leg) | 0.0 / 0.1 / 0.3 | 0.2 / 0.4 / 0.8 | 0.3 / 0.2 / 0.2 | 0.1 / 0.4 | `res.pad`, not out, `b.onStumps` |
| stumping missed (out of the crease, not stumped) | 0 | 0.1 / 0.2 / 0.2 | <0.1 | 0 / 0.2 | `outOfCrease` after a beaten ball (no visual) |
| direct hit at the stumps (show only) | not in logic.js | | | | game side `S.thr.hit` (~10% of eligible flat/underarm throws) |

**Significant** (bold above): a wicket, a chance missed with a hand on the ball, a boundary saved at the rope, a near miss at a six.
Union per 100 balls:

| | std E / M / H | human E / M / H | bowl E / M / H | T20 fields std / human |
|---|---|---|---|---|
| replayed today (fours, sixes, catches) | 51 / 43 / 37 | 29 / 23 / 20 | 36 / 39 / 43 | 40 / 22 |
| added by v1 (not already replayed) | 0.8 / 1.9 / 3.6 | 3.0 / 5.0 / 7.8 | 10.7 / 9.6 / 7.8 | 6.2 / 7.4 |
| replays per over today | 3.1 / 2.6 / 2.2 | 1.8 / 1.4 / 1.2 | 2.2 / 2.3 / 2.6 | 2.4 / 1.3 |
| per over, v1 always | 3.1 / 2.7 / 2.5 | 1.9 / 1.7 / 1.7 | 2.8 / 2.9 / 3.0 | 2.8 / 1.8 |
| per over, v1 + one boundary/save slot per over | 1.1 / 1.3 / 1.5 | 1.1 / 1.3 / 1.4 | 1.8 / 1.8 / 1.7 | 1.6 / 1.4 |

(Per over assumes independent balls: always-events x 6 + 1 - (1 - p)^6 for the shared slot.) An over takes ~35-40 s of play; a
boundary replay ~3-6 s. Wicket rates per planet are not guarded (Jupiter drops edges short of the cordon), so drop/catch rates vary
by planet; the table is Earth.

## 2. Cameras and timing per class

All replays start 0.15 s before release in the existing side-on slow motion (0.6x easing to 0.35x near the event); the class sets
what follows. "Event" = the focus time `tk` on the replay clock.

| kind | camera after the lead-in | slow window | end | sound at tk |
|---|---|---|---|---|
| bowled / played on | `stumps` (new): from behind the bowler's stumps, 0.8 m up, ~2.5 m of ground across the shorter side, on the batter's stumps; cut at pitch | whole flight 0.45x | tk + 0.7 (bails fly) | stumps |
| LBW | `stumps`; at the pad a 0.6 s hold with the projected path drawn pad -> stumps (2D overlay from `ballPos(b,t)`, red/green by in line/hitting) | whole flight | tk + 0.6 + hold | pad |
| stumped | `crease` (new): square on at the popping crease, 0.6 m up, framing back foot, crease and stumps; side chosen by screenshot | from the keeper's gather (tEnd) to bails | tk + 0.7 | stumps |
| caught | today's classes: close (`cordCam`, or square on for a catch at the batter), cab (end-on from behind the striker), field (spider-cam) | as today | as today | catch |
| dropped / hands-on miss | same class as a catch at that fielder, keyed by the drop/miss event | as a catch | tk + 0.8 (ball spills) | gasp |
| rope save | `field` (spider-cam follows the drawn path, which stops at the save) | tk - 0.35 .. tk + 0.25 at 0.45x | tk + 0.7 | none (crowd) |
| six with rider's leap | today's six replay, plus the field slow window around the leap | tk - 0.35 .. tk + 0.25 | rope + 0.3 (today) | as today |

What V already records (188 floats/frame, run-up to the end of result): ball, batter pose, bowler, fielders with action, action
time, hands and stretch, stumps age and bails (`V.st`), far stumps (`V.st2`), non-striker, crowd. So every v1 kind replays from
recorded frames. Gaps to close:
- **Anchor time.** `rpStart` anchors on `S.hitStart` (contact). Bowled, LBW and stumped have no contact (`S.hit` null, `S.hitStart`
  stale from an earlier ball): the anchor becomes the event (`b.start + b.tStumps`, the pad's time, `b.start + b.tEnd`).
- **Exact frames.** `recContact` adds frames at contact and at the catch; add the stumps hit, the pad and the drop/save `t1`, so
  slow motion shows the ball at the stumps/pad/hands rather than blended short of them.
- **LBW projection.** Not a recorded state: computed from the delivery `b` (deterministic), kept on `RP` at `rpStart` before
  `nextBall` replaces `S.ball`. Drawn only in the replay. Generic look (a dotted path and a stumps outline), no broadcast branding.
- **Ball after the stumps.** Live, the ball is hidden once it hits the stumps without bails (06 `ballNow`); in slow motion it would
  vanish. Option: a short show-only deflection, the same live and in replay (it is then recorded like any ball position).
- **Late events.** Bowled/LBW/stumped commit with 1.9 s of result, drops/saves get `t1 + 1` (doSwing), so all fall inside the
  recording. Throws continuing into the countdown are outside it and are not replayed; `rpStart` already clears `S.thr`. A replayed
  drop or save is not out and not a boundary, so it can also have a throw planned: check that the keeper's-end throw cut by the
  replay leaves the keeper at his stance after it (risk, see 5).
- **Hidden keeper.** The keeper is hidden only in the home batting view; replays draw him (the stumped and close classes need him).

## 3. Frequency control

- **A. Always replay the listed events.** Simple and predictable. Cost: the new events are rare (0.05-0.65 per over), so this
  alone keeps today's load: 1.7-3.1 replays per over, mostly boundaries. In the bowling innings ~2.9 per over.
- **B. Significance score with a budget per over.** Score each highlight (wicket 100, missed chance 80, rope save 50, six 40,
  four 30); always show >= 80, others share one slot per over (first come). 1.1-1.8 per over, wickets and chances never lost.
  Cost: a counter per over (`M.rpOver`, reset in `newOver`, 04b/04c/04d flows) and one rule; some fours go unreplayed (the
  banner and chase camera still show them live).
- **C. A setting "Replays: key / all / off".** Lets each player choose. Owner prefers no new settings; also a third list to keep
  in step with the detector.

Recommendation: **B with a fixed budget, no setting.** It answers the request (more kinds) while lowering the total, which is what
batting feel needs. If the owner prefers not to touch boundary replays, A is the fallback (open question 1).

## 4. Overall build

- **A. Extend `rpWant`/`rpCatch` with more cases.** Least code at first; `rpStart` already branches on catch class and boundary,
  and five more kinds turn it into special cases scattered over `rpStart`, `rpUpdate` and `rpCam` with contact-time assumptions.
- **B. Highlight detector + one director.** `highlightOf(res,b,field)` in logic.js returns the most significant `{kind, ev, t}`
  (no randomness, DOM-free: the balance test can report the rates and guard a band per 100 balls). 08b's `rpPlan(hl)` maps kind
  -> `{cls, tk, sa, sb, slo, end, snd, hold}`; `rpStart(plan,nx)`, `rpUpdate` and `rpCam` read only the plan. The existing boundary
  and catch replays become two kinds (parity check by screenshots). `rpThen(rpWant(end), nx)` stays the single call site per flow.
- **C. Post-match highlights reel.** Shows the best moments at the end without interrupting play. Needs a recording per kept ball
  (~450 KB each at today's layout, or trimmed to the window), and the scene state at the time (planet is fixed, but T20 kits and
  fields change by innings, Scenarios sessions). A different feature; it could later reuse B's detector and director.

Recommendation: **B.** Same size as A after two kinds, testable in Node, and C stays possible.

## 5. Implementation steps

| step | what | files | size |
|---|---|---|---|
| 1 | `highlightOf` (kinds, priorities, event) in logic.js; balance test prints rates per 100 balls (std, bowling) with a loose band; `FP` unchanged | src/logic.js, tests/balance.mjs | ~40 + ~30 lines |
| 2 | Director: `rpPlan` + `rpStart(plan,nx)`; boundary and catch replays moved onto it; anchor time generalised; sounds per plan | src/game/08b-replay.js | ~60 lines changed |
| 3 | Drops and hands-on misses (catch classes), frames at their `t1`, gasp at tk | 08b, 04-match-flow (`doSwing` dur unchanged) | ~15 |
| 4 | Bowled, LBW, stumped: `stumps` and `crease` cameras, event frames, LBW projection overlay + hold, optional ball deflection off the stumps | 08b, 06 (overlay), 04-match-flow (`flightUpdate` frames) | ~80 |
| 5 | Rope saves and six leaps: field slow window keyed by the play | 08b | ~15 |
| 6 | Budget per over (if confirmed) and the end-of-innings rule (last wicket of any kind replayed before the end screen, innings break or scenario result) | 04-match-flow, 04b, 04c, 04d, 08b | ~20 |
| 7 | Smoke: forced plays per kind via `#test` (`PLAYS` predicates for drop, missed chance, rope save, six leap; bowled/LBW/stumped by forcing the delivery and no swing or a charge to spin), assert `RP.kind`/`cls`, pause at tk and screenshot, skip by tap, last wicket before the end screen, bowling view and landscape once | tests/smoke.mjs | ~90 |
| 8 | CLAUDE.md (View state and replays, decision log) and this doc | CLAUDE.md, docs/replays.md | small |

Run `npm run test:balance` after step 1 (detector only; numbers unchanged) and `npm run test:smoke` after each game step.

Risks:
- **Concurrent work on throws** (08-loop, 08b, smoke): steps 2-7 touch the same files; start after that lands.
- **Throw vs replay:** a replayed drop/save may have a throw planned; the replay clears `S.thr`, so the keeper's-end part that runs
  into the countdown is cut; the keeper must still end at his stance for the next ball (smoke check).
- **Stale anchors:** any code reading `S.hitStart`/`S.hit` in the replay for a no-contact kind (bowled, LBW, stumped) shows the last
  ball's contact; the plan must carry its own anchor and `rpCam` must not use the field-follow camera without `R.h`.
- **Frame budget:** 600 frames at 75 fps = 8 s; a bowled ball is ~3.5 s from run-up, a deep drop ~5 s: fine. A long spin run-up
  plus a deep save near 3.4 s result is the longest case; check `REC.n < RMAX`.
- **Tedium creep:** guard with the balance band (step 1) and the per-over budget.

## 6. Owner decisions (2026-10-15)

1. **Boundary replays are not thinned:** every four and six keeps its replay; the new kinds are added on top (about 1.7-3.1
   replays per over when batting). Rejected: one boundary/save slot per over (recommended by the plan; the owner prefers every
   boundary) and sixes-only.
2. **T20 first innings (you bowl):** the AI's wickets and missed chances are always replayed; its fours and sixes share one
   replay slot per over (that innings has the most events). Rejected: same rules as batting; wickets only.
3. **LBW projection overlay: yes**, a 0.6 s hold with the path drawn from the pad to the stumps, in an original, generic look
   (no broadcaster styling).
4. **Near misses are in v1** (moved up from v2): a play-and-miss shaving off stump and an LBW shout not given (with the reason:
   pitched outside leg / impact outside the line), with the `stumps` camera. Their rate must be measured first (step 1); if they
   would add more than ~0.5 replays per over, only the closest ones (a distance threshold) qualify, rather than a new setting.

Sources: none cited; camera choices are design reasoning from the game's own cameras, not broadcast practice.

## 7. As built (2026-10-15)

Approach B and the eight steps, with the owner decisions of section 6.

- **Detector:** `highlightOf(res,b,field,c)` in src/logic.js, no randomness (fingerprint `FP` 96fcd588 unchanged). `c` (the logic's
  contact point, `footAt(b,bp).c`) is a fourth argument the plan didn't have: the hands-on test (ball within 0.1 m of the hands
  horizontally, 0.15 m vertically, in the air) and the rope save's natural length need the path from it. Priority: wicket (bowled
  incl. played on, lbw, stumped, caught) > drop > chance > save > leap > six > four > shout > shave.
- **Director:** 08b. `rpWant(end)` picks, `rpStart(h,nx)` builds the plan, `rpUpdate`/`rpCam` read only the plan. The four/six and
  catch replays run through it unchanged in look (same lead-in, classes, speeds and ends). No-contact kinds anchor on the event
  (`b.start + t`), never on `S.hitStart`.
- **When:** batting (short formats, nets, T20 chase, Scenarios), every highlight; T20 first innings, the AI's fours, sixes and leaps
  share one replay per over (`M.rpOver`), everything else always (wickets, chances, saves, near misses: the owner named wickets and
  chances; saves and near misses are rare there, 0.15 and 0.1 per over, so they were kept). At the end of an innings only a wicket
  of any kind is replayed (before the end screen, innings break or scenario result); a winning hit still goes to the celebration.
- **Cameras:** as section 2, with `stumps` placed 3.4 m up at z 27, 0.5 m to the side away from the bowler (lower, it looks
  through the bowler and the non-striker; the tallest species are 2.2 m), 2.8 m across the shorter side; `crease` from (6.5, 1.1,
  4.1) toward the popping crease (straight square on at x 6.5 looks through silly point). Both cut at the pitch.
- **Slow windows:** stumps and crease 0.45x for the whole flight after the cut; save and leap 0.45x in tk -0.35..+0.25; drops and
  chances as a catch of their class. Ends: bowled/stumped tk + 0.7, LBW/shout/shave tk + 0.5 (after the 0.6 s hold), save tk + 0.7,
  drop/chance tk + 0.8 (to the rope + 0.3 if it then goes for four or six).
- **Sounds at tk:** stumps (bowled, stumped), pad (LBW, shout), a gasp (shave), gloves and a gasp (drop, chance); the bat at contact,
  an edge for played on.
- **LBW overlay** (`rpLbw`, 06): a dotted path from the pad to the stumps drawn out over 0.35 s of the hold, the wicket outline,
  rings at the pitch, the pad and where it reaches the stumps (red: hitting; amber: the reason it is not out), the verdict ("Out:
  hitting the stumps", "Not out: pitched outside leg", "Not out: impact outside the line").
- **Deflection off the stumps:** done (cheap): `ballNow` carries the ball on to the stumps and off them, slowing, for bowled and
  played on, live and so in the recording. Played on's bails now go when the ball reaches the stumps, not at contact.
- **Exact frames:** `flightUpdate` records a frame at the pad, at the stumps and at the keeper's take (`tEnd`) as they happen;
  `recContact` at contact and at the highlight's play.

Measured (tests/balance.mjs, `hlRates`, Earth, 10,000 legal balls a row; rows as section 1):

| per 100 balls | caught | bowled | lbw | stumped | drop | chance | save | leap | six | four | shout | shave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| std E / M / H | 1.5 / 3.8 / 7.0 | 0.1 / 0.4 / 0.9 | 0.0 / 0.1 / 0.3 | 0 | 0.7 / 1.4 / 1.6 | 0.1 / 0.3 / 0.4 | 0.1 | 0 | 15 / 12 / 11 | 35 / 27 / 20 | 0.0 / 0.1 / 0.3 | 0.0 / 0.2 / 0.4 |
| human E / M / H | 2.2 / 3.5 / 5.8 | 0.9 / 1.9 / 3.3 | 0.4 / 0.7 / 1.5 | 1.0 | 1.1 / 1.4 / 1.7 | 0.1 / 0.2 / 0.2 | 0.0-0.2 | 0 | 6.9 / 5.6 / 5.1 | 22 / 15 / 9.5 | 0.2 / 0.3 / 0.9 | 1.0 / 1.6 / 2.0 |
| bowl E / M / H | 6.9 / 6.9 / 6.7 | 3.2 / 2.8 / 1.9 | 2.2 / 1.6 / 1.0 | 0.2-0.4 | 2.8 / 2.5 / 2.4 | 0.6 / 0.6 / 0.7 | 2.5 / 2.2 / 2.8 | 0.2 | 8.1 / 9.9 / 12 | 21 / 22 / 23 | 0.3 / 0.2 / 0.1 | 1.7 / 1.3 / 0.8 |

| replays per over | all | new kinds | near misses |
|---|---|---|---|
| std E / M / H | 3.11 / 2.72 / 2.48 | 0.06 / 0.16 / 0.24 | 0.00 / 0.01 / 0.04 |
| human E / M / H | 2.12 / 1.86 / 1.86 | 0.28 / 0.43 / 0.64 | 0.07 / 0.11 / 0.17 |
| bowl E / M / H (one boundary slot) | 2.07 / 1.97 / 1.87 | 0.83 / 0.70 / 0.60 | 0.12 / 0.09 / 0.05 |

Near-miss threshold: 8 cm (`SHAVE`) past off stump or over the bails, and every shout not given. They add at most 0.17-0.18 replays per
over, well under the owner's 0.5, so no tighter threshold was needed. The balance test guards: near misses <= 0.5 per over, new
kinds 0.01-1.2, all replays 0.5-3.6 per over, in every row.

Deviations from the plan: the detector's fourth argument `c`; `leap` is its own kind (a six with the rider's leap); saves and near
misses are always replayed in the bowling innings (not in the shared slot); a hands-on leap at a six that clears the fielder counts
as a chance (it outranks the leap). Smoke (`replay2` in tests/smoke.mjs): every kind forced and checked at its event (kind, camera
class, ball and stumps or fielder on screen, parity, skip), the keeper at his stance and the bowler at his mark after a replayed
drop or save, the last wicket bowled before the end screen, bowled in the T20 bowling view, LBW in landscape. Screenshots
`tests/screenshots/replay2-*.png`.
