# T20 chase mode: design

Status: steps 1-4 implemented (2026-10-13), strike rotation (decision 1 revised) 2026-10-14; step 5 (tuning on the owner's
phone) is open. The owner accepted all recommendations below. The working model is summarised in CLAUDE.md (T20 chase); this doc keeps the reasoning and rejected options.

## As built: departures and details

- **Targets: option B** (see "Target and difficulty"). With strike rotation (2026-10-14) `DIFF.t20` .85 / .9 / 1 gives mean Earth
  targets ~157 / ~166 / ~184 (were ~201 / ~213 / ~230 with the player always on strike: the tail now bats, the bot loses ~9.4
  wickets on medium). The standard bot wins ~98% / ~50% / ~5% (3000 innings each: 98.1 / 50.5 / 5.5): the bands hold, but hard
  is near-unwinnable for the bot, so tune it on the phone.
- **Per-planet `t20` multiplier** (measured T20 scoring vs Earth): Moon 2.16, Mercury 1.84, Mars 1.76, Jupiter 0.77, Venus 0.75,
  Saturn 0.70, Neptune 0.68. Moon, Mercury and Mars were re-measured with strike rotation (were 1.75 / 1.57 / 1.53): their top
  order bats through, Earth's tail does not, so the ratio rose (Moon fell out of the 0.8-1.25 band). Medium-bot win rates per
  planet ~45-60%.
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

1. **What it is.** A new chase length, "T20": the AI bats first (simulated instantly, as today), and the player then bats
   up to 20 overs with 10 wickets to reach the target. Bowling stays AI and is not visualised beyond what exists.
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

- `simulateAI` gains a T20 model: per-phase outcome weights (powerplay and death more boundaries and more wickets) instead of one
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
- **Visualising the AI innings:** the owner asked for simulated bowling only. Instant simulation stays.
- **Modelling the slow over-rate penalty:** the AI never runs late, so the rule would never trigger.
- **Left-handed field mirroring:** the batter is right-handed only.
