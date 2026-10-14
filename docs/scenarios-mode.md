# Test Scenarios mode: design

Status: approved 2026-10-14; the owner accepted all four recommendations below. Steps 1-4 are implemented (logic and balance test;
animation and the non-striker; flow; UI). Step 5 (tuning on the owner's phone) is open. The working model is summarised in CLAUDE.md
(Scenarios); this doc keeps the reasoning, numbers and departures.

Inspiration: the owner remembers Ashes-style scenarios ("N runs needed in M overs with W wickets"). The closest real
precedents are Ashes Cricket 2009 (Codemasters; consoles/PC, ~56 "match defining moment" challenges such as
"crucial runs to win" and "hold out until lunch")[1] and Big Ant's Cricket 19 scenarios (start anywhere in a match with a
condition taken from famous Tests)[2]. No mobile Ashes game with such a mode was found. We copy **no** names, screens,
teams or branding. Scenarios are original, with fictional teams on our planet venues; real Tests only inspire the numbers.

## Decisions (proposed)

1. **A third mode, "Scenarios"**, beside Chase and Nets. You bat in Test conditions from a set situation and must meet an
   objective: chase, survive, avoid the follow-on, last pair, win or tie off the last over, or score fast before a declaration.
   Results are win, draw, tie or loss. A draw is a real result (surviving is a win for some objectives).
2. **Content:**
   - **Series:** a five-Test series against one AI team, 3 scenarios per Test (15), unlocked in order.
   - **Classics:** about 10 one-off scenarios whose numbers are inspired by famous finishes (table below), fictionalised.
   - **Stars:** 1-3 per scenario (objective met / met with margin / met with a bonus such as "no wicket lost" or "inside
     N balls"), stored in `cc_scen`.
3. **Two batters, strike matters.** A lineup of 11 with skill tiers (top order, middle, all-rounder, tail). Strike changes
   on odd runs and at the end of each over. You always bat whoever is on strike. A tail-ender has a narrower timing window,
   less power, more edges and more misses, so **farming the strike** (protecting the tail) becomes the core skill of a
   last-pair scenario. The non-striker is drawn at the bowler's end, as a second instance of the skinned batter model.
4. **Run control, minimal.** Runs stay automatic. A **Hold** button appears for about 0.6 s after a ground shot: tap it to
   refuse the run and keep the strike. No run-out mechanic in v1.
5. **Test conditions model.** Each scenario sets day (1-5), session and ball age (overs since the new ball):
   - swing fades over the first ~25 overs of a ball;
   - reverse swing builds from ~35 overs[3];
   - spin turn and bounce variance grow with the day (footmarks and rough from day 3-4)[4];
   - a new ball is available at 80 overs[5].

   Planet physics still multiply on top.
6. **Test rules:**
   - no powerplay;
   - leg side at most 2 fielders behind the popping crease (keeper excluded, Law 28)[6];
   - at most 2 bouncers per over (ICC Test clause 41.6)[7];
   - a draw when the overs or session run out.

   The T20 field system is reused with a Test `fieldOk` variant and Test templates.
7. **New batting shots and moves, with no new buttons:**
   - **Sweep, slog-sweep and reverse sweep** come from the existing slingshot aim against spin: aiming fine or square on the
     leg side to a full spinning ball plays a sweep; aiming fine on the off side plays a reverse sweep. They have their own
     poses, shot fit and risk (top edge, LBW).
   - **Duck/sway:** pull the joystick back while a short ball rises to evade it. Otherwise a bouncer at the body or helmet
     hits you ("Hit on the helmet"; no injury mechanic in v1).
8. **AI bowling and captaincy for Tests:**
   - **Deliveries:**
     - reverse swing, seam movement off the pitch, and around-the-wicket angles;
     - spinners bowling into the rough on day 4-5;
     - variations: googly (exists), doosra, carrom ball, arm ball, top-spinner;
     - a short-ball barrage with a leg trap, respecting the 2-per-over limit.
   - **Spells:** bowlers tire (pace and accuracy drop) and are rotated in spells.
   - **Tail tactics:** when the set batter has the strike late in an over, the field goes back to give him a single, and the
     plan attacks the tail-ender with yorkers and bouncers.

## As built (step 1)

All in `src/logic.js` (no DOM), checked by `tests/balance.mjs`. Short formats and T20 are untouched: every new behaviour
needs a `cond` (makeDelivery, planBall) or a `bat` (evalSwing, beaten) argument, and a seeded fingerprint of the
short-format and T20 rows must match the pre-Test value (`FP` in balance.mjs; update it only when that balance changes on purpose).

- **Conditions** (`cond = {day, ballAge, planet}`, `testDev`): conventional swing x1.35 with the new ball, fading to x0.15 by
  25 overs; reverse from 35 overs, full at 55, scaled by pace (none below ~110 km/h), opposite to the seam's swing; seam off
  the pitch greenest on day 1; turn x0.75 (day 1) to x1.45 (day 5); bounce spread 3% to 14%; footmarks outside both stumps from
  day 3 add turn and bounce spread; spinners aim at them on day 4-5 (`line:'rough'`). New ball (`NEW_BALL` 80) is taken at once.
- **Bowling:** around the wicket (`plan.ar`: release on the leg side), spin variations (`TARCH`: doosra, carrom ball, arm ball,
  top-spinner; the googly stays), fatigue per over in a spell (pace drops ~7%, line spread +40% when spent), spells (`SPELL`
  6 pace / 12 spin overs, a tired or expensive bowler is taken off, pace rests 2 overs, never two overs in a row).
- **Rules:** `fieldOkTest` (Law 28.4: at most 2 behind the popping crease on the leg side, keeper excluded); Test templates in
  `TPL` (`test:1`): SC slip cordon, UM umbrella, LT leg trap, TF single on offer, SV saving the single, SR spin into the rough,
  DF defensive, RV reverse swing. `adjust` takes `ok` so the captain's swaps stay legal. Max 2 balls above shoulder height per
  over: S and B are not planned after two, and a ball that still bounces above the shoulder is re-planned.
- **Captain** (`captainPickTest`, `testStock`, `testPlanId`): plans per over by ball age and day, per ball for the tail:
  a tail-ender on strike gets the umbrella or the leg trap (yorkers and bouncers within the limit); with plan `tail` and the
  set batter on strike, **the single is offered on balls 1-4 and saved on balls 5-6**. This reverses the brief's "give him a
  single at the end of an over": a last-ball single keeps the set batter on strike, so a real captain denies it then and offers
  it early, when it exposes the tail-ender for the rest of the over. The farming bot plays the mirror image.
- **Batters:** `TIER` A-E (timing window x1 / .88 / .72 / .55 / .4, power, edge and mishit x, extra edge chance). Blocks use
  window^0.3, so a tail-ender can defend but not score. Measured on Earth (standard bot / careful bot, balls per wicket):
  A 12.8 / 58, B 9.7 / 46, C 7.4 / 38, D 6.0 / 25, E 4.4 / 19; runs per wicket A 25 vs E 3.5 (real Tests: about 45 vs 8).
- **Shots:** `SWEEPS` (sweep, slog-sweep, reverse sweep), picked by `shotForBall` only with `bat`, against spin met at full or
  good length (`SWEEP_FULL`), aim -165 to -100 or +110 to +165. Narrower window, own shot fit (forgives line, not length),
  higher mishit risk, mishits balloon (top edge, glove), and a missed sweep lunges the front pad across (`sweepBp`), so LBW is
  ~13% of sweep dismissals vs 2%. Sweeping into an open fine leg pays (3.1 vs 1.7 runs a ball); slog-sweeping into a deep
  leg-side field is out every ~4 balls.
- **Short balls:** `bodyHit`; `beaten(..., bat)` gives "Hit on the body/helmet" when not ducked (`b.duck`) or played, "Ducked"
  under a high one, and "Ducked into it" under one that keeps low. A block at chest height is a fend that can be caught by the
  close fielders; inside edges can go bat-pad to short leg; extra slips and a leg slip catch edges.
- **Strike and Hold:** `testRecord` swaps on odd runs and at the over, the new batter takes strike (Law 18.11; `batRecord`, shared
  with T20 since 2026-10-14). `applyHold` refuses the last run of an odd number (1 becomes 0, 3 becomes 2).
- **Objectives:** `scenEnd` (chase, scoreBy, survive, avoidFO, tieOrWin, plus `session` for staged chases: reach `par` without
  being all out), `scenStars`, `stageNext` (carries runs needed, wickets, batters and ball age; each session brings its own
  attack, rested after the interval). `obj.wkts` = wickets the side can lose before it fails.
- **Content:** 15 Series (the rival is the fictional Meridian XI; its bowlers keep their names across Tests) and 10 Classics.

Departures from the plan above, and why:

- **Game-scale run targets.** Against Test fields the standard bot scores ~2 runs a ball and an A-tier batter lasts ~12 balls,
  so a last-wicket stand is worth ~15-25 runs, as in real Tests. Tail chases keep their story but not their real totals: the
  heist needs 20 (not 73), two short 30 (not 107), the master and the tail 30 (not 92), the follow-on turnaround a 50 lead,
  the decider 200 in three 10-over sessions. Ball counts are kept where they fit (hold out 24, long stand 69, last over 4 to win).
- **Band bot.** The band is checked with the standard bot, except survive scenarios, which use the careful bot: the standard
  bot swings at everything and survives 0-20% of them, which says nothing about the intended play.
- **Narrative fixes.** You cannot declare while batting last, so Test 1's sprint is "120 by stumps" in a fourth-innings chase;
  Test 3's sweep scenario is "130 by stumps" in the first innings; Test 4's tail scenario is a first-innings lead (38 in 6),
  because its Test ends with the last-over chase.
- **Level or win** starts with the set batter on strike on Earth: with the number eleven on strike on the Moon the farming bot
  could not beat the standard bot (big hitting on the Moon beats strike farming).

Measured (balance test, 1500 plays for the band bot; std / farm / careful at 300):

| id | objective | numbers | band | measured |
|---|---|---|---|---|
| s1a | survive | 60 balls, no wicket | 55-90 careful | 76 |
| s1b | avoidFO | 50 in 120 balls, 4 wkts | 50-85 | 68 |
| s1c | scoreBy | 120 in 48 balls | 50-85 | 73 |
| s2a | survive (nightwatchman) | 54 balls, 2 wkts | 45-85 careful | 74 |
| s2b | chase (reverse) | 85 in 120, 7 wkts | 35-70 | 46 |
| s2c | chase, last pair | 12 in 90 | 25-60 | 40 (farm 62) |
| s3a | scoreBy (sweeps) | 130 in 36 | 35-70 | 53 |
| s3b | survive (rough) | 90 balls, 2 wkts | 30-70 careful | 46 |
| s3c | chase | 190 in 120, 4 wkts | 35-70 | 46 |
| s4a | survive (short balls) | 48 balls, no wicket | 35-80 careful | 55 |
| s4b | scoreBy (tail) | 38 in 36 | 30-65 | 40 |
| s4c | tieOrWin | 12 off 6, 2 wkts | 30-65 | 50 |
| s5a-c | session, session, chase | par 100, par 55, 45 to win | 40-85, 30-70, 35-70 | 68, 50, 61; all three in a row 9% |
| c1 | chase, last pair | 20 in 150 | 10-45 | 20 (farm 37) |
| c2 | chase | 30, 2 wkts | 15-50 | 30 |
| c3 | survive, last pair | 24 balls | 15-55 careful | 30 |
| c4 | survive, last pair | 69 balls (easy) | 15-55 careful | 33 |
| c5 | scoreBy | 50 lead, 3 wkts | 15-50 | 30 |
| c6 | chase | 150 in 180, 6 wkts | 30-70 | 54 |
| c7 | tieOrWin, last pair | 4 off 6 | 50-85 | 64 (farm 79) |
| c8 | chase, last pair | 7 in 30 | 30-70 | 50 (farm 64) |
| c9 | chase | 30, 2 wkts | 15-50 | 27 |
| c10 | survive | 90 balls, 2 wkts | 25-65 careful | 51 |

Runtime: the whole balance test takes ~40 s on a laptop, the Test part ~20 s at `SCEN_N=300`.

## As built (steps 2-4)

- **Flow (04c-scen.js):** the scenario's data drives the match (lineup, striker and non-striker with their scores, attack, `cond`,
  objective). Per over `testBall` picks bowler, spell, plan and field; per ball the next `testBall` (tail plans move the field ball by
  ball, shown as a field-change note). Swings, pads and body hits use the striker's tier. `scenEnd` after each ball: a drawn
  session of the final day goes to a short interstitial ("Lunch"/"Tea", stars for that session) and the next session starts from
  `stageNext`; otherwise the result card (stars earned, best, Next/Retry/Back).
- **Hold:** shown left of Loft for 0.6 s of game time after a ground shot (not lofted, not a boundary) with an odd run. The ball is
  recorded when it is tapped or the window closes, so the score, strike and chips update then.
- **Duck:** the stick pulled back once a short (S or B) ball has pitched. Already holding it back at the pitch counts as footwork
  (`b.noDuck`), so a player who went back keeps the pull, cut or block; a duck needs pulling back after the pitch (the window is
  ~0.2 s at pace). A duck cancels a later swing. Tests only.
- **Poses:** sweep and reverse sweep down on the back knee, front leg bent, bat flat across, the ball met in front of the front pad
  (contact window `FAM.sweep`); the reverse sweep's face turns to the off side. Aiming a sweep (the backlift) already crouches the
  batter onto the knee, so the 75 ms downswing doesn't drop him in one frame. Kneeling needed one pose parameter (`qKN`, the back
  knee's IK pole). Duck (crouch, head down), sway (lean back, bat up) when the ball is not at the body, a 0.7 s flinch when hit.
  Contact accuracy is unchanged: the ball sits on the face (offset 0.05 m = its radius, across < 1 mm) for all three sweeps.
- **Non-striker:** a SkeletonUtils clone of the skinned batter with its own bat, at the bowler's end on the side away from the bowler,
  backing up in the run-up and walking back between balls; recorded for replays. Both batters wear the same kit, so the strike
  is shown by the HUD's partner card, not by the models. ~30 more draw calls between balls (172 vs 142), Tests only.
- **Bowler side:** the bowler is now drawn on the side of his release, so around the wicket shows (step 1 only moved the ball).
- **HUD:** objective line ("Need 12, last pair" / "Survive 54 balls, no wicket"), conditions chip ("Day 5 · Ball 62 ov · Reverse",
  or "Turning" with a spinner on from day 3, "Swing" under 15 overs), partner card (strike marker, tier badge, runs and balls), bowler
  O-M-R-W and the field plan. The radar uses a square-root radial scale in Tests, so slips, short leg and silly point separate.
- **Unlocks and stars:** a Series scenario opens when the one before has a star; Classics are open. Stars are per scenario id (each
  session of the final day has its own), best kept, in `cc_scen`. A session that misses its par still carries on (0 stars for it).
  The later sessions are also playable alone from their own data once unlocked.
- **Save and resume** (owner, 2026-10-14): one slot in `cc_scensave`, apart from `cc_t20` and the stars, so a T20 and a scenario
  save coexist. Written after every recorded ball (after Hold resolves) and after each over's bowler and field are picked, so a
  resume at an over boundary keeps that bowler (as in T20). It holds the scenario as played (a later session is a `stageNext`
  object, not a `SCEN` entry), `M.st` without `sc` and `A` (`testAttack` is seeded, so the names come back), and the flow's maidens,
  over runs, over number and chips, timing stats. The next delivery is re-planned. Resume continues the over with the same bowler
  when one is picked (`st.bi`), else starts the next over. A drawn session saves the next session unplayed (Resume opens its
  briefing); the result card clears it. Quitting keeps it, and a ball still in its Hold window is recorded as not held first (T20
  too). A "Resume" tile tops the Scenarios list with the objective line ("Need 125, 6 wkts left · 168 balls left"). Saves are
  versioned and validated; a bad one is not offered.
- **Not built:** a pause scorecard; a visible keeper; run-outs.

## Owner decisions (2026-10-14: all recommendations accepted)

| # | Question | Decision |
|---|---|---|
| 1 | Strike model: you bat both batters with skill tiers and a Hold button (decisions 3 and 4), or always on strike as in T20? | Both batters plus Hold. Without it, last-pair scenarios lose their point. |
| 2 | New shot inputs: sweeps from the existing aim direction, duck from the joystick (decision 7), or new buttons? | Existing inputs, so the UI doesn't grow. |
| 3 | Structure: Series (5 Tests × 3) plus Classics with stars and unlocks, or one flat list? | Series plus Classics. Progression gives a reason to replay for stars. |
| 4 | Classic scenarios' in-game text: fictional only, or "inspired by Headingley 2019"-style notes? | Fictional only in game. Real references stay in this doc. |

## Scenario format (data, in logic.js so the balance test can run every scenario)

```
{id, set:'series'|'classic', test:1-5, title, brief,           // brief = one situation card, plain text
 planet, diff, day:1-5, ballAge, oppText,                      // "Rival XI 374 & 251. You 267 & 286/9."
 obj:{type:'chase'|'survive'|'avoidFO'|'tieOrWin'|'scoreBy', target, balls, wkts},
 lineup:[{name, tier:'A'..'E', runs, balls}], striker, nonStriker,   // set batter can start on 87*
 attack:[{arch, fatigue, oversLeft}], plan:'tail'|'attack'|'contain',
 stars:[{t:'win'}, {t:'margin', runs|balls}, {t:'bonus', ...}]}
```

## Classics (numbers inspired by real Tests; all names and venues fictional in game)

| Archetype | Inspired by | Situation to recreate |
|---|---|---|
| Last-wicket heist | Headingley 2019[8] | Chase 359; 73 needed, last man in, a well-set batter at the other end. The tail-ender faced 17 balls in the real stand. |
| Two short | Edgbaston 2005[8] | 107 needed with 2 wickets at the start of the day, ninth-wicket stand, then the last pair. |
| Hold out | Old Trafford 2005[9] | Last pair must survive 24 balls against a 7-slip field. |
| The long stand | Cardiff 2009[10] | 9 down, still 6 short of making the opponents bat again; the last pair survives ~69 balls. |
| Follow-on turnaround | Headingley 1981[11] | Following on, 135/7, score enough to set any target (scoreBy). |
| Pace the chase | Gabba 2021[12] | 328 in 98 overs (shortened to a playable slice, e.g. the last 30 overs: 140 needed, 6 wickets). |
| Level or win | Chennai 1986, Brisbane 1960[13] | Last over: 4 needed with 1 wicket (or 6 needed, 3 wickets in hand). Win or tie. |
| One-run thriller | Wellington 2023[14] | Last pair, a handful needed (the real one fell with 2 needed), bouncer plan with a leg trap. |
| Tail with the master | Mohali 2010[15] | 92 needed, 8 down, a set batter plus two tail-enders. |
| Day-five collapse | Adelaide 2006[16] | Survive to tea on a day-5 pitch against a leg-spinner in the rough. |

## Series (15 scenarios, a 5-Test arc; one example set)

- **Test 1 (day 1-2 pitch):** survive the new ball for 10 overs (survive); avoid the follow-on (avoidFO); declaration
  sprint: 80 in 12 overs (scoreBy).
- **Test 2 (green seamer):** chase 140 with reverse swing at the death; nightwatchman: protect the top order to stumps; last pair 20 needed.
- **Test 3 (dust bowl):** survive a session against spin in the rough; sweep your way: 60 in 10 overs against two spinners; chase 210 on day 5.
- **Test 4 (bouncy):** short-ball barrage, survive 8 overs; 50 in 6 with the tail; tie or win in the last over.
- **Test 5 (decider):** a three-stage final day: chase 280 in 70 overs, split into 3 playable sessions; the stages run in order and carry the score forward.

Lengths stay mobile-friendly: most scenarios are 6-30 overs (5-20 minutes). Long chases are split into stages.

## Pressure UI (reuses the T20 HUD bar)

- **HUD:**
  - **Chase:** "Need R from B, W wickets".
  - **Survive:** "Survive B balls" plus "Day 5 · Session 3 · Ball age 62 ov".
  - **Both:** partner card: striker and non-striker names, tiers and scores, strike indicator.
- **Hold:** the button appears only when a run is available (44 px, near Loft).
- **Briefing card** before play: situation text, objective, star conditions. **Result card:** stars earned, best.
- **Scenarios screen:** Series progress (5 Tests, stars) and the Classics grid. This is the only new screen.

## Tests and balance

- **Scenario simulator** in tests/balance.mjs runs every scenario with the standard bot and a farming bot (holds early-over
  singles with a tail-ender, takes a last-ball single). Checks:
  - each scenario's bot win rate fits its intended difficulty band;
  - farming beats not farming in last-pair scenarios;
  - survive scenarios can be survived by careful play (the leave-heavy bot) and lost by slogging;
  - the bouncer limit and leg-side limit are never broken;
  - swing, reverse and turn follow ball age and day (unit checks on `makeDelivery` stats).
- **Smoke:** play one scenario of each type a few balls (forced swings), Hold, strike change, duck, sweep, briefing and result cards.

## Implementation order

1. **Logic, pure, plus the balance test:**
   - Test conditions (ball age, day, reverse, seam, turn, bounce variance), short-ball limit, Test `fieldOk` and templates
     (slip cordon, umbrella, leg trap, tail fields);
   - new deliveries (doosra, carrom, arm ball, top-spinner, around the wicket), fatigue and spells;
   - lineup and skill tiers (timing window, power, edge rates), strike rotation;
   - sweeps and reverse sweep (shot fit and risk), duck and hit-by-ball;
   - scenario objectives and stars;
   - the scenario simulator and checks.
2. **Animation:** sweep, slog-sweep, reverse sweep, duck and sway, hit-on-helmet reaction, Hold. The pose system drives the skinned batter; add the non-striker instance.
3. **Flow (04/new 04c-scenarios.js):** scenario load, objectives and end states (incl. draw), strike handling, Hold,
   the captain's tail plans, nightwatchman, stages.
4. **UI:** Scenarios screen, briefing and result cards, HUD survive/partner rows, records (`cc_scen`).
5. **Content and tuning:** 15 Series plus 10 Classics; balance bands; the owner plays on the phone.

## Rejected options

- **Using "Ashes", real teams or real player names:** trademark and branding risk; CLAUDE.md forbids copying.
- **Full 5-day Tests:** too long for mobile; scenarios slice the decisive phase instead.
- **Player-called runs with run-outs in v1:** reported as fiddly in other games; Hold covers farming.
- **Bowling scenarios ("take a wicket within N runs"):** needs player bowling (backlog #1); revisit after that.

## Sources

[1] https://www.cricketweb.net/?p=2296 ; https://www.gamespot.com/articles/ashes-cricket-2009-hands-on/1100-6213077/
[2] https://www.gamesradar.com/cricket-19-game-preview ; https://www.trueachievements.com/game/Cricket-19/walkthrough/3
[3] https://en.wikipedia.org/wiki/Swing_bowling ; https://sportskeeda.com/cricket/sk-glossary-what-is-reverse-swing-in-cricket
[4] https://www.icc-cricket.com/news/enough-rough-in-the-surface-for-spinners-says-pujara-as-india-chase-opening-win
[5] https://www.newsbytesapp.com/news/sports/decoding-the-new-ball-option-in-test-cricket/story
[6] https://www.lords.org/mcc/the-laws/the-fielder
[7] https://www.icc-cricket.com/news/mens-test-match-clause-41-unfair-play
[8] https://en.wikipedia.org/wiki/2019_Ashes_series ; https://en.wikipedia.org/wiki/2005_Ashes_series
[9] https://www.espncricinfo.com/series/14823/game/215686
[10] https://www.cricketarchive.com/Archive/Articles/10/10777.html
[11] https://cricket.com/news/ian-botham-overturns-the-odds-of-500-1-to-beat-australia-7202023-1689840422429
[12] https://www.aljazeera.com/news/2021/1/19/india-clinch-australia-test-series-with-historic-win-at-gabba
[13] https://en.wikipedia.org/wiki/Tied_Test
[14] https://www.qatar-tribune.com/article/52713/sports/new-zealand-beat-england-by-1-run-in-one-of-all-time-great-finishes
[15] https://www.aljazeera.com/sports/2010/10/5/laxman-leads-india-to-thrilling-win
[16] https://au.sports.yahoo.com/35-years-of-great-ashes-tests-no-3-adelaide-oval-2006-17891606.html
