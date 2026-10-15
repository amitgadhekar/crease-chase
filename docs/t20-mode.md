# T20 mode: design

Status: chase steps 1-4 implemented (2026-10-13), strike rotation 2026-10-14. Player bowling (below, 2026-10-14): step 1 (pure
logic, balance test) and step 2 (camera, controls, flow, HUD, save/resume, smoke) done. The working model is summarised in
CLAUDE.md; this doc keeps the reasoning and rejected options.

## Player bowling: owner decisions (2026-10-14)

- **Every T20 is a full match.** The player bowls the first innings (20 overs, 10 wickets) to an AI batting side, then chases
  that score + 1 with the existing batting (strike rotation, tiers, Hold). The simulated-target chase is replaced. Short formats
  and Scenarios are untouched.
- **Captaincy:** before each over the player picks the bowler (5 in the attack, max 4 overs each, never consecutive) and a field
  plan (a `TPL` template legal for the phase); the captain's suggestion is preselected. **Simulate rest** finishes the innings.
- **Per ball:** pick a delivery from the bowler's options, place a marker on the pitch (line and length, continuous), tap a release
  meter in the run-up. Good release: near the marker at full pace. Early: fuller; late: shorter (as in real bowling, see Sources;
  the owner did not choose a direction); line scatter grows with the error;
  a very bad release is a wide, a long hop or a full toss. Narrower sweet spot on harder levels, scaled by the bowler's accuracy.
  No tap = a poor release.
- **The AI batter plays the same shot physics** as the player (`evalSwing`, `beaten`, pads, stumpings, fielding).
- **Not in v1:** toss, no-balls and free hits, run-outs, DRS, dragging fielders.

## Player bowling: as built (step 1)

- **Attack:** the XI's 7-11 (Quarry, Ashby, Marlow, Tenby, Gage), archetypes from `makeAttack`'s rules seeded per planet (a death
  specialist and a spinner, the rest suited to the conditions; Earth: death, cutter, express, off-spin, left-arm orthodox). Options
  per bowler (max 5): pace = stock (swing bowlers: outswinger and inswinger instead), yorker, bouncer, slower ball, cutter (`slow`
  >= 1.5); spin = stock, flighted, quicker one, wrong'un (`wrong`), arm ball. Each is a pace/swing/seam/turn variation with a
  suggested length; the marker decides where it pitches. The AI side bats six planet-named batters and its five bowlers, tiers as
  the player's XI.
- **Release meter:** `rel` -1..1, good half-width .16 / .11 / .075 (easy / medium / hard) x `acc`/0.85. Inside it the length moves
  up to 0.25 m; beyond, 2 m per window of error, and the line scatters 0.15 m per window. A release error moves a full ball's
  pitch point further (flatter descent): length errors x ((zr - z)/(zr - 5.4))^2, 0.5-2. Beyond 3.5 windows: a wide, else a full
  toss (early) or a long hop (late). No tap: 2-3 windows, random side. Above head height (1.85 m) at the popping crease is a wide
  (ICC playing conditions call it a wide, https://en.wikipedia.org/wiki/Bouncer_(cricket); the T20I limit of one bouncer per
  over is not modelled, as no-balls are out of v1, https://icc-cricket.com/news/mens-t20i-match-clause-21-no-ball). Measured on medium
  (standard plans, 1000 innings, before the direction was flipped to early = fuller): perfect release 171, a human tap (sd 0.09 of the meter) 176, sloppy (sd 0.2) 184: the meter
  matters, but where the marker goes matters more.
- **Same physics, difficulty elsewhere:** the player's deliveries and the AI's shots use medium physics (`BOWL_D`) on every level;
  a harder `DIFF` would give the player faster bowlers and the batter tighter windows, i.e. make bowling easier. Difficulty is the
  meter and the batter (`AIB`): timing spread 71 / 68 / 58 ms (64 ms on medium before fielding v2), share of a pace change read from the hand .5 / .6 / .7, misreads
  and footwork.
- **AI batter (`aiBat`):** reads length at release and line at the bat with errors (larger for swing); commits footwork on the
  length as read within the joystick's limits (back to short, forward or down the pitch to good length, across to an expected
  yorker); good length and yorkers at the stumps are harder to time, loose balls (half-volley, full toss, long hop, short and
  wide, on the pads) easier; an unread slower ball makes it early. Shots: the best fit (`SHOTS`/`shotFit`) toward a gap; lofts by
  phase (18 / 12 / 30%) x carry, more at loose balls, fewer after quick wickets, with a rider there or without a lofted shot that
  fits; blocks some hard balls when new or after a collapse. It returns the same `sw` the player's slingshot produces.
- **The batters learn the attack** (`st.bm`, mirrors the bowler `mem`): the share of each length in recent balls and each
  bowler's pace. A length the attack keeps bowling is read better, timed better (spread x up to 0.5), stepped to and aimed into a
  gap. This is what makes predictability expensive; per-bowler memory was tried first and let "always yorker" pay on hard.
- **Captain:** `captainPick` (batting first, par = the innings' own rate) and `planPick` suggest; the field is the template as is.
  Moving fielders deep into hot zones (`adjust`) for the suggestion was tried and conceded more: this batter mostly scores along
  the ground, so ring fielders matter more than riders. A zone-coverage plan pick was tried and made no difference.
- **Simulate rest (`simRest`):** auto-captain, auto-bowler (`autoBowl`: `planBall` with the plan's mix and the side's `mem`,
  learning at the hard rate; marker allowing for movement; release sd 0.09) and the AI batter, ball by ball, from wherever the
  innings stands.
- **Calibration (balance test, T20_N=300):** Earth first-innings totals vs the standard bowling bot ~132-140 / ~165-175 / ~205-210
  (easy / medium / hard; the old fixed targets were ~157 / ~166 / ~184: easy is lower and hard higher, both still in band). Full
  matches (that innings, then the standard batting bot chases): ~96% / ~45-55% / ~5-10%. Medium on every planet ~45-60% after a
  per-planet `t20` factor on the AI timing spread (Moon .98, Mercury .88, Venus 1.18, Mars .89, Jupiter 1, Saturn 1.2,
  Neptune 1.25): without it, medium matches ran 25-80% (the AI reads swing and lofts by carry, so its scoring follows the
  planets less than the batting bot's). Bowling skill: accurate bot ~155-170, careless (random option and marker, sd 0.2)
  ~220-240. Exploits on medium / hard: always yorker ~270 / ~275, always bouncer ~300 / ~315, same spot ~405 / ~380, vs
  standard ~170 / ~205. Field plans: a random legal field (captain's bowling kept) concedes ~3% more per ball than the captain's
  plan on the same deliveries (paired comparison; small, because this batter seeks gaps). Section runtime ~30 s.
- **Sources for the control model.** A review of a mobile cricket game with a tap-timed bowling meter: the idea is fine but the
  lag between tap and meter makes precise timing impossible, and its pitch placement felt unresponsive
  (https://www.digitallydownloaded.net/?p=53984): step 2 must timestamp the tap (`gameTimeAt`) and not the frame. A console
  game's bowling guide ties length to the release point (https://planetcricket.org/forums/threads/bowling-guide.89045/post-2747859);
  it says early = fuller and late = shorter, as in real bowling (letting go early floats the ball up; holding on drags it into
  the pitch), and the game follows it: the sign of `sg` in `bowlDelivery` (step 1 had it the other way round; flipped 2026-10-14,
  the balance numbers above stayed in their bands, and the fingerprint `FP` changed because it covers the bowled first innings). The third link (https://www.planetcricket.org/forums/goto/post?id=3639715) is about how long the batting pitch
  marker stays visible, not bowling marker accuracy, so it does not support the marker design either way.

## Player bowling: as built (step 2)

- **Flow:** T20 Play -> "You bowl first" (their XI with tiers, your attack) -> per over the picker (bowler, field plan, Simulate
  rest) -> the over's banner -> per ball: chip, marker, Bowl, meter tap in the run-up -> the AI plays it -> after 10 wickets or 20
  overs the innings break (their total, top scorers, your bowling, "Chase N") -> the existing chase against the AI attack.
- **Camera:** end-on from behind the bowler's arm, 14 m behind the bowling crease and 6 m up, the lens solved so the batter's
  feet sit at 55% of the screen height and a 12 m length at 80% (landscape 42% / 82% of the height above the home indicator).
  The bowler runs in from below the frame and is seen from behind at release. Rejected: the batting camera turned round (the
  batter small and far, the near pitch under the HUD), a higher broadcast camera (the batter shrinks, the marker range gets
  too short to drag precisely on a phone).
- **Meter:** the cursor sweeps the meter over the last second of the run-up and ends as the ball leaves the hand, so the tap
  window is ±55 ms on medium (±80 easy, ±37 hard, x the bowler's accuracy). The tap is timestamped from the event
  (`gameTimeAt(perfOf(e))`), never the frame (the reviewed game's lag complaint). Rejected: a sweep centred on the release
  (a late tap would hold the ball in the hand, or come after it is gone), a countdown run-up (no time to set the ball up).
- **Marker:** a chip moves it to the delivery's suggested spot (`optSpot`, allowing for its movement); dragging moves it by the
  finger's offset, so the finger never covers it; a tap on the ground puts it there. Each bowler keeps his last delivery and
  spot. Rejected: keeping a dragged marker when a chip is picked (the chip would then do nothing visible).
- **AI batter:** `aiBat` at release; its footwork drives `S.bpos` at the stick's speeds until the ball pitches; at `tc -
  SWING_DELAY` it fills `S.swing`/`S.bat` as the slingshot does, so contact targeting, the pose, pads, fielding and replays are
  the batting game's code. Medium physics (`BOWL_D`) for the shot, as in the balance test.
- **Sides on screen:** the player's fielders and bowler are humans in the player's kit; both batters wear the planet team's kit.
  Swapped per innings. The chase restores the planet's species.
- **Save `v:3`:** both innings, mid-over in either; remembered deliveries and markers; v1/v2 saves are not offered (their
  targets were simulated).
- **Records:** `records[diff].t20` keeps `{w, p, hs}` (wins, played, best chase score); the T20 card reads "won 3 of 7 · best
  chase 187".

## Player bowling: rejected options

- **Keep the simulated-target chase alongside the full match:** the owner chose to replace it.
- **A toss:** more flows (bat or bowl first) for little play; the player always bowls first.
- **Only a star bowler's 4 overs by the player:** little bowling per match.
- **All 20 overs with no shortcut:** too long on a phone; "Simulate rest" finishes the innings with the same logic.
- **Marker without a meter:** no release skill; the marker alone would make every ball land where aimed.
- **Swipe bowling:** imprecise on phones, and it collides with the slingshot's mental model.
- **Captain-set fields and dragging fielders:** templates only in v1 (legal by construction, no field editor).

## As built: departures and details

- **Targets: option B** (see "Target and difficulty"). Superseded 2026-10-14: the target is now the first innings the player
  bowls. The simulated targets (`DIFF.t20` .85 / .9 / 1, ~157 / ~166 / ~184 on Earth; planet target multipliers Moon 2.16 ...
  Neptune 0.68; `AI_T20` per-phase weights) were removed with the checks on them.
- **Strike rotation** (owner decision 1, 2026-10-14): the player bats the XI of the Scenarios series (`XI`: four A, two B, two C,
  one D, two E), whoever is on strike, with `newTest`'s state shapes and the shared `batRecord`/`swapStrike` (odd runs, over end,
  new batter on strike). Tiers apply as in Tests (`{tier,t20:1}`) without sweeps or body hits; Hold and the non-striker as in
  Scenarios. HUD batters row, a batting table in the pause scorecard, save `v:2`. No tail-ender plans for the captain.
- **Death vs middle check:** the tail bats more of the death, so the balance test compares the phases tier for tier (weighted by
  death balls), on easy and medium only (on hard the top order is rarely in at the death).
- **"Always loft" vs standard** is checked against the same pooled targets for both rows (hard is ~5% vs ~3%, and target
  noise alone could flip a gap that small).
- **Close catchers:** slip, gully, short third and short fine leg are behind the batting camera; short leg and silly point
  (4 m, x = ±3.9) are off-screen in portrait and stand clear of the batter and the ball's line in landscape. None moved or dropped.
- **Mid-over swap:** tried after every boundary that doesn't end the over (one `adjust` move, `fieldOk`-checked); the note
  ("Mid-on moves to long-on") shows at the next ball, so it doesn't cover the boundary banner.
- **Overs left** in the banner and HUD count the current over ("2 overs left" = this one and one more; "last over").
- **Pace marker:** "half the target by over 10" is the straight line from 0 to the target over 120 balls, so the marker is
  runs minus `target × balls / 120` ("8 ahead" / "12 behind") plus a bar (runs / target) with a tick at the par point.
- **Save:** after every ball and also right after each over is picked; otherwise a resume at an over boundary re-picks a
  different bowler. Match end and Restart clear the save; Quit keeps it so the innings can be resumed (owner review fix). A ball still in its Hold window at Quit is recorded as not held first, so the save keeps it. Resuming sets the menu to that match (planet, difficulty, T20). T20 learning is per match (`M.st.mem`), never `cc_mem`.
- **Records:** nets and 1-5 over chases share the `short` format.


## Decisions

1. **What it is.** A new chase length, "T20": the AI bats first (simulated instantly; since 2026-10-14 the player bowls it), and
   the player then bats up to 20 overs with 10 wickets to reach the target. Bowling stays AI and is not visualised beyond what exists.
   No new 3D models; the planet's species team supplies the bowlers and fielders.
2. **A real bowling attack.** Each AI team has 5 named bowlers (original names, per planet) with archetypes
   (express pace, swing/seam, hit-the-deck/cutters, death specialist, off-spin, leg-spin, left-arm orthodox). Max 4 overs each,
   and no bowler bowls consecutive overs. A captain picks the bowler per over by phase, match state and how each bowler is going.
3. **Plans, not just lengths.** A plan couples a field template with a delivery mix. "Wide-yorker death plan" means
   the field (third man, deep point, deep cover, long-off back) and the deliveries (wide yorkers, slower balls wide) change
   together. This is how fielding favours a type of bowling. The existing learning brain (`mem`, `bScore`) still
   tunes lengths and lines inside the chosen plan.
4. **Real fielding rules.** Overs 1-6 are a powerplay: at most 2 fielders outside the inner circle. From over 7, at most 5.
   At most 5 on the leg side, and at most 2 (keeper excluded) behind the popping crease on the leg side, which is the line
   through the batter, so `a < −90` (ICC T20I clause 28). The circle scales with each planet's
   boundary (`27.43 m × BOUNDARY/65`). Templates are validated against these rules, and so is every reactive tweak.
5. **Targets come from the game's own scoring, not real-world totals.** The game scores far faster than real cricket
   (medium bot: ~2.1 runs/ball vs ~1.6 in the IPL), so a fixed "180" would be trivial. Targets are a percentile of the
   simulated innings distribution for this planet and difficulty. Proper T20 fields (5 out after the powerplay) will lower
   scoring by themselves; the balance test re-measures par after they land.
6. **The player needs to plan, so the HUD shows the chase state**: required vs current rate, balls left, wickets,
   current bowler with figures and overs left, phase and its restriction, and a "half the target by over 10" pace
   marker. The existing radar shows the circle and which fielders are out. No other new screens, apart from a scorecard in
   the pause screen.
7. **Long matches need resume.** 120 balls at ~7 s each plus replays is ~15 minutes. The match state is saved after
   every ball (`cc_t20`) and offered as "Resume" in the menu.

## Owner decisions (2026-10-13: all recommendations accepted)

| # | Question | Decision |
|---|---|---|
| 1 | Strike rotation: is the player always on strike, or does a simulated partner face balls after odd runs? | **2026-10-14: you bat both**, like Scenarios: the XI in order with tiers, Hold and the non-striker. Superseded v1: always on strike (one unnamed batter); simpler, but no "keep the strike at the death" planning and no tail to protect. A simulated partner was rejected: it cuts the balls you actually bat. |
| 2 | Targets: game-par based (decision 5), or real-looking totals (~160-210) by slowing scoring? | Game par. Slowing scoring would change batting feel, which matters most. |
| 3 | Where it lives: a 4th "Match length" option in Chase, or a separate mode? | A 4th length, "T20 (20 overs, 10 wkts)". Fewer menu changes, and the same flow. |
| 4 | Close catchers (slip, short leg, silly point) are drawn near the batter. Some may sit in the batting view. | Draw them and check the batting-camera view. Drop any that cover the ball's line. |

## Rules reference (sourced)

- Powerplay overs 1-6: max 2 outside the 30-yard circle. Overs 7-20: max 5. Leg side: max 5. Max 2 behind the popping crease on the
  on side, keeper excluded. A breach is a no-ball. ICC men's T20I playing conditions, clause 28:
  https://www.icc-cricket.com/news/mens-t20i-match-clause-28-the-fielder
- Slow over rate: one fewer fielder outside the circle for the rest of the innings (in-match penalty since Jan 2022):
  https://www.icc-cricket.com/news/changes-to-t20i-playing-conditions-come-into-effect. **Not modelled**: the AI is never late.
- Max 4 overs per bowler. Phases are by convention: powerplay 1-6, middle 7-15/16, death 16/17-20:
  https://criconometrics.substack.com/p/29-the-t20-bowling-jigsaw
- Benchmarks (for flavour and plan design, not targets):
  - IPL 2026 average first-innings score 192 (2025: 191), average winning total 217;
    https://english.ratopati.com/story/64229/high-scoring-ipl-2026-batsmens-reign-bowlers-plight
  - IPL 2025 phase run rates: powerplay 9.1, middle 8.6, death 10.4;
    https://www.wisden.com/series/ipl-2026/cricket-news/crash-bang-wallop-how-ipl-batting-has-changed-since-2008
  - Chases: 50% of the target by over 10 makes a win more likely than not; losing 3 or more wickets in the first 10 overs while chasing 9/over
    won 2 of 32: https://www.espn.in/cricket/story/_/id/26712889. These drive the HUD pace marker and the
    "survive vs score" tension we want to reproduce.

## Field templates

Positions use the game's convention: angle in degrees, 0 = straight back past the bowler, +90 = square off, −90 = square leg.
Inner positions are in metres (scaled by `BOUNDARY/65`, like today); "deep" means 0.9 × BOUNDARY. Keeper and bowler are
extra, and the slip stays at its current spot. Inner-circle radius `RC = 27.43 × BOUNDARY/65`.

| Position | Angle | Dist | | Position | Angle | Dist |
|---|---|---|---|---|---|---|
| slip | 150 | 17 | | short leg | −75 | 4 |
| gully | 125 | 14 | | short fine leg | −140 | 14 |
| short third | 140 | 20 | | long-off / long-on | ±12 | deep |
| silly point | 80 | 4 | | deep cover | 50 | deep |
| point | 96 | 24 | | deep point | 95 | deep |
| cover | 52 | 26 | | third man | 150 | deep |
| mid-off / mid-on | ±16 | 26 | | deep midwicket | −50 | deep |
| midwicket | −55 | 26 | | deep square leg | −90 | deep |
| square leg | −96 | 24 | | fine leg | −150 | deep |

Templates (9 fielders each; out = outside the circle):

| Id | Template | Fielders | Out | Paired delivery mix |
|---|---|---|---|---|
| PA | Powerplay pace attack | slip, gully, point, cover, mid-off, mid-on, midwicket, third man, fine leg | 2 | good/full, off line, swing |
| PC | Powerplay pace contain | point, cover, mid-off, mid-on, midwicket, square leg, short third, third man, fine leg | 2 | hard length, off/middle |
| PS | Powerplay spin | slip, short leg, point, cover, mid-off, mid-on, midwicket, deep midwicket, long-on | 2 | good, stump line |
| OF | Middle 6-3 off side | point, cover, mid-off, midwicket, deep cover, long-off, third man, deep midwicket, long-on | 5 | good/short-of-good, off line, cutters |
| SB | Short-ball trap | short fine leg, square leg, mid-on, mid-off, cover, point, short third, deep square leg, deep midwicket | 2 | short/bouncer, body line |
| WY | Death wide yorker | point, cover, mid-on, midwicket, third man, deep point, deep cover, long-off, long-on | 5 | wide yorker, slower wide |
| SY | Death straight yorker | point, cover, mid-off, mid-on, fine leg, deep midwicket, long-on, long-off, deep cover | 5 | yorker at the stumps, slower |
| SL | Slower balls and cutters | mid-off, mid-on, cover, point, midwicket, square leg, deep cover, deep midwicket, long-on | 3 | slower, good/full |
| OA | Off-spin attack | slip, short leg, point, cover, mid-off, mid-on, midwicket, deep midwicket, long-on | 2 | good, stump line |
| OC | Off-spin contain | cover, mid-off, short third, mid-on, long-on, deep midwicket, deep square leg, long-off, deep cover | 5 | good/full, middle |
| LA | Leg-spin/SLA attack | slip, silly point, point, cover, mid-off, mid-on, midwicket, deep midwicket, long-off | 2 | good, off/middle, wrong'un mix |
| LC | Leg-spin/SLA contain | point, cover, mid-off, midwicket, deep cover, long-off, long-on, deep midwicket, deep point | 5 | full/good, off |
| CH | Vs a charger | mid-on, short third, cover, point, deep cover, deep point, long-off, long-on, deep midwicket | 5 | spin flatter and wider, shorter (stumping chances) |

Validation (`fieldOk`): count out ≤ 2 (powerplay) or ≤ 5, leg side ≤ 5, leg side behind square (`a < −90`) ≤ 2.
Templates marked 5 out are middle and death only. The selector never offers an illegal template.

## How a ball is decided

```
per over:   bowler = captainPick(attack, over, matchState)          // quota, no consecutive overs, phase roles
            plan   = planPick(bowler, phase, matchState, batterTrend) // template id + delivery-mix weights
            field  = adjust(template(plan), scoringZones, footTrend) // ≤2 swaps, re-validated
per ball:   length/line = planBall(mem, bowler, plan.mix, ctx)       // existing learning on top of the plan's mix
            after a boundary: captain may swap one fielder (validated), shown on the radar + one-line note
```

- **`captainPick`.** Each archetype has phase roles:
  - powerplay: swing/express, sometimes a spinner;
  - middle: spin plus cutters;
  - death: death specialist plus express.
  - A bowler going at more than par + 3/over loses his next slot (hard: +2), unless quotas force it.
  - On hard, the captain saves 2 overs of his best death bowler for 18-20.
  - Planned over by over at the innings start, then re-planned each over.
- **`planPick`.** Weighted by phase, the archetype's preferred plans, and how the batter has scored:
  - recent scoring zones with decay (`M.shots` gains a per-phase decaying view; today it is match-wide with no decay);
  - footwork trend: charging → CH vs spin, SB vs pace;
  - match state: needing above 12/over → attack; wickets falling → keep attacking; batter well set → contain.
  - Easy picks mostly the phase default. Hard weights by what has worked (per-bowler `mem`).
- **`adjust`.** Today's `fieldFor` moves up to `DIFF.deep` fielders into scoring sectors. It becomes "swap at most 2
  fielders toward the batter's top scoring sectors", only if the result still passes `fieldOk`.
- **Bowler profile** replaces the global `DIFF` knobs per bowler: pace range (or spin speed), swing/spin amount, slower and
  yorker/bouncer share, line accuracy, length bias, and wide rate. `DIFF` scales all of them (easy bowlers are slower and less
  accurate). `makeDelivery` takes the profile; spin direction comes from the archetype (off-spin or SLA vs leg-spin), not a coin.
- **Pressure** today fires at need/ball > 1.8 or ≤ 4 balls left (tuned for 1-5 overs). For T20 it becomes
  required rate vs par rate by phase, and the death overs by default.

## Target and difficulty

- (Superseded 2026-10-14: the first innings is played, see Player bowling.) `simulateAI` gains a T20 model: per-phase outcome weights (powerplay and death more boundaries and more wickets) instead of one
  flat table, still scaled by the planet `ai` multiplier.
- **Owner decision (2026-10-13, option B): targets must never fall as difficulty rises** (roughly easy ~200, medium ~215, hard ~230
  on Earth). Hard is then genuinely harder, and win rates spread wider. Test bands: easy ≥ 75%, medium 40-60%, hard ≤ 25% for the
  standard bot. A per-planet T20 multiplier (measured scoring ratio vs Earth) keeps planets fair, because the short-format `ai`
  multipliers don't carry over to 20 overs. This supersedes the 70/50/30 calibration below.
- Original calibration (superseded): the balance test plays N full T20 chases with the standard bot against the new attack and fields, per difficulty, on Earth.
  Targets are set so the bot wins about 70% (easy), 50% (medium) and 30% (hard). The AI's simulated innings is then tuned to produce those
  targets. The intro screen keeps "Team 214/6 · You need 215 from 120 balls".
- Wickets matter: 10 wickets over 120 balls. The bot measures roughly 26 balls per wicket on medium, so a reckless player can be all out.
  The test checks "always loft" loses more chases than the standard bot on medium and hard. That is the
  survive-vs-score tension the owner wants. If it doesn't hold, death-over yorkers and boundary-rider catches get tuned, not batting feel.

## UI (no new models)

- **HUD** (03-hud.js), chase mode:
  - "need R from B";
  - required rate vs current rate (new);
  - a phase chip ("Powerplay · 2 out", "Middle · 5 out", "Death");
  - current bowler and figures ("R. Vexa 2-0-14-1, 2 left").
- **Pace marker:** a small tick in the score area. "50% of the target by over 10" is the chase benchmark, and the tick shows ahead or behind.
- **Over break banner:** bowler change ("Spin from R. Vexa, 2 overs left"), field plan in one line ("Wide-yorker field: third man,
  deep point back"), and a field note after a mid-over swap. The existing "Bowler's plan" footwork/length note stays.
- **Radar** (06): draw the inner circle; ring the fielders who are out.
- **Pause screen:** a scorecard with bowling figures, fall of wickets and runs per over (text table, no charts in v1).
- **Menu:** "T20" as a 4th match length. A "Resume T20" button when `cc_t20` holds an unfinished innings.
- **Records:** `cc_records` gets a format level: `records[diff]` becomes `records[diff][format]`. Old data migrates as format
  "short" inside try/catch.

## Visual and other touches

- Fielders already render from `S.fpos`. Templates just change positions; the fielder rigs, species and replays keep working.
  Close catchers (short leg at 4 m) need a batting-camera check (open question 4).
- Bug to fix in passing: the fielder run animation ignores `ENV.run` (04-match-flow.js), while the outcome uses it (logic.js).
- Doc fix in passing: CLAUDE.md says anti-repeat is hard only; the code applies it to medium too (`d.k > 0.3`).

## Implementation order

1. **Logic, pure (logic.js) plus the balance test.**
   - Positions, templates and `fieldOk`.
   - Bowler archetypes and profiles; `makeDelivery` takes a profile.
   - `captainPick`, `planPick`, `adjust`; per-bowler `mem` keys (`b<i>:type:len`).
   - T20 `simulateAI`.
   - balance.mjs: an innings simulator (120 balls, 10 wickets, rotation, fields moving), checks for quotas and restrictions on every
     over, chase win rates per difficulty, "always loft" vs standard, and existing short-format checks unchanged.
2. **Match flow (04).** The T20 length, bowler rotation per over, plan and field per over, mid-over swaps after boundaries,
   pressure by phase, save and resume (`cc_t20`), records format.
3. **UI (03, 06, index.html, styles).** HUD rows and chip, pace marker, over-break announcements, radar circle, pause
   scorecard, menu option and Resume.
4. **Visual check.** Close catchers in the batting view, field changes in replays, and smoke test T20 paths (start, a few
   overs, a forced bowler change, resume).
5. **Tuning pass on the owner's phone** (open). CLAUDE.md has the core model bullets and decision-log lines.

## Rejected options

- **A separate T20 mode screen:** more UI for the same flow (see open question 3).
- **Fixed real-world targets (160-210):** too easy at the game's scoring rate unless batting is slowed, which hurts batting feel.
- **Visualising the AI innings:** the owner asked for simulated bowling only (superseded 2026-10-14: the player bowls it).
- **Modelling the slow over-rate penalty:** the AI never runs late, so the rule would never trigger.
- **Left-handed field mirroring:** the batter is right-handed only.
