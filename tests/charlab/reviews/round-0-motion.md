# Round 0 review: motion, clipping and cricket authenticity

Reviewer: independent critic (lens: motion). Artefacts: `tests/charlab/out/baseline-20261016` (142 sequences, 19468 gates,
7868 red). Judged against docs/art-style.md sections 6, 7 and 8 (item 8 cross-checked with metrics.json). Frames named as
`sequence__planet__kit / phase / camera` under `shots/`; sheets under `sheets/`. Code was read only to locate causes.

## Verdict

Not production ready; nowhere near. Every character class fails the motion principles of section 6 and most of the checklist
in section 7 at normal speed from the game cameras. The batter is the only one with a real swing, and even there the drive
follow-through puts the top-hand forearm through the helmet, the leave and the duck fire after the ball has passed, the
backlift goes straight over the head for every shot and the bat stalls at impact (batAV .88-.99). The bowler bowls chest-on
with the front arm held out in a T, no gather, no bound, no braced front leg, no follow-through, and snaps to an idle pose at
contact. The non-striker is a statue that never backs up or walks. Fielders stand like mannequins (straight legs, arms at
the sides, then hands on hips as "ready"), dive as a rigid plank 20-25 cm into the turf, "leap" without leaving the ground,
throw with both hands behind the head like a soccer throw-in, and reset between balls at 9-31 m/s instead of walking. The
keeper standing back takes the ball with both arms locked straight overhead; standing up to spin he never moves his hands
at all and the ball drops beside him. The lab's pen gate is miscalibrated (19 cm "penetrations" in a clean stance) and the
teleport/slip gates are swamped by the deterministic between-ball resets, so the automated layer cannot yet be trusted to
confirm a fix.

## Findings

Severity per art-style section 8. Area: assets | batter | people | harness.

### Blocker

**M01 · batter · drive and pull follow-through: top-hand forearm and glove pass through the helmet.**
Where: `bat-cover__earth__ai / follow / g16, f16, q4` (2.11 s), `bat-cover / finish / q4`, `bat-straight / follow / s4`,
`bat-pull / impact / b4, f16` (hands at the chin, forearm across the grille); same in bat-hook, bat-loft-cover, bat-late, the
sweeps and cel. Metrics agree: `pen:bat:farm-head 0.13`, `glove-head 0.08`, `head-uarm 0.12` at follow in bat-cover,
`farm-head 0.12` at impact in bat-pull, 0.14 in bat-leave. Visible at 4 m and in the side-on slow-motion replay (a game
camera), so this is a clipping blocker by the rubric's letter.
Right: the follow-through wraps over the front shoulder, hands finishing above and outside the helmet (the bat crosses
behind the head, the arms never do); for the pull the hands stay at chest height and roll over in front of the body.
Fix: in `SH3` follow/finish poses move the hand points 15-20 cm outward and forward of the head and let the capsule
`resolve` (07-motion) push the forearm off the helmet; add a head-vs-forearm clearance term to `mixPose`.

**M02 · people · bowler and fielders teleport between balls instead of walking back.**
Where: every sequence: `slip:bowler = 31.164 m/s` at result+0.1 (identical value in all 142 rows: the bowler is put back at
his mark in one jump), `slip:f1..f8 = 9.03 m/s` with `teleport 0.13 m/frame` at tEnd+0.9 (ring and deep fielders glide 1-2 m
back to their spots in ~0.15 s), `slip:slip = 7.2 m/s`, `teleport:slip 0.09 m/frame` at release+0.1 (the walk-in snaps back).
Mid-off, cover, mid-on and the bowler are in the batting view on every ball. Section 6: "Nobody teleports in view;
between balls everyone walks back."
Fix: drive the reset through `gait` at walking speed from the result until `ready` (the 2 s `BALL_GAP` is enough for 2-3 m),
and let the bowler jog to his mark (`08-loop` `resetFielders`/`bowlerState`); end the walk-in with a split-step, not a snap.

**M03 · people · the keeper standing up to spin never plays the ball; it drops beside him.**
Where: `fld-keeper-spin__earth__ai / ready, take, give / q4` (2.01-2.43 s): the keeper stands upright, arms hanging at his
sides, while the ball passes at knee height 0.3 m from his hip and lies on the ground next to his foot at `take`. Same on
Mars, Neptune and Venus (`fld-keeper-spin__*__ai / take / q4`). `handsBall:keeper:take 0.35 m` here, 2.07 m in bat-duck.
Visible in the T20 bowling view and in every replay of a ball that beats the bat.
Right: section 7, keeping: squat just behind the bails, gloves together fingers down, rise with the bounce, soft give,
sideways shuffle to the line.
Fix: `keepTick` must target `hands2` on the ball's line from the pitch (not only after `tEnd`), with the gather at the
logic's `tEnd` position; the squat-rise blend should carry the hands, not only the hips.

### High

**M04 · people · bowling action (pace): chest-on, front arm in a T, no gather, no bound, no braced front leg, no follow-through,
arm frozen vertical for 0.14 s, ball floats off the hand.**
Where: `bowl-pace__earth__ai / gather, bound, front, release, follow / s4, f4` and the batting view `gbat` (what the player sees
every ball; the front arm reads as a T-pose from `ns-walk / release / gbowl`). At `bound` (release-0.14) both feet are on the
ground and the bowling arm is already straight up; at `front` and `release` it is still straight up (no arm speed), the front
arm is horizontal to the side instead of high then pulled into the hip, the trunk is square to the batter with no
hip-shoulder separation, the front knee is bent ~40° with a short stride, and at `follow` (release+0.25) the arms are simply
down by the sides, feet planted, no run-off. The ball sits 10-20 cm above the fingertips at release (`release / f4, s4`; on
Venus, Mars and Jupiter the arm is tilted 30-40° behind the head, the release point behind the body). `teleportHand:bowler
0.77 m/frame` at release-0.03 in every sequence: the hand snaps to the logic's release point.
Fix: author the pace keys as the docs/characters.md motion plan already lists (gather with hands together at the chest,
bound off the back foot, back-foot landing side-on, front arm high then pulled down, braced front leg, arm circle through
vertical with constant angular speed, follow-through across the body with 2-3 decelerating strides), and fit the arm circle
to the release point over the whole downswing rather than snapping the hand at release.

**M05 · people · spin action: no pivot, chest-on, same T front arm; ball 0.2-0.3 m from the hand on Saturn and Neptune.**
Where: `bowl-spin__earth__ai / pivot, release, follow / s4, q4`; `bowl-spin__saturn__ai / release / q4`,
`bowl-spin__neptune__ai / release / q4`. The hand sits behind the head at 45° and the body never turns side-on; follow is a
static stand with arms down.
Fix: as M04 for the spin keys (short approach, pivot on the back foot, side-on, front arm leading at the target, slower
circular arm, short follow-through); fit the release per species so the ball leaves the fingers (0-5 cm).

**M06 · people · the bowler pops from the bowling pose to the fielder pose at contact.**
Where: `teleport:bowler 0.96 m/frame` at impact+0.008 in bat-cover (0.94-0.96 in every batting sequence), then
`slip:bowler 31 m/s`. The rig switches from `bowlerState` to `fieldTick` in one frame, so the arms and facing jump while the
player is looking down the pitch.
Fix: cross-fade the bowler's `J` from the follow-through into the fielding idle over 0.3 s in `liveView`/`personJoints`.

**M07 · batter · the leave is raised after the ball has passed.**
Where: `bat-leave__earth__ai / leave (2.01 s), past (2.10 s) / s4, g16, gbat`: bat still grounded behind the back foot while the
ball is 1 m away and then at the keeper; `after (2.40 s)`: bat straight up over the head. In play the batter looks like he
played no leave at all and then salutes the keeper.
Right: bat lifted high and the hands over the shoulder before the ball reaches the stumps' line, head turned to watch it.
Fix: start the leave pose at the decision (pitch+0.1 at the latest), not at `tEnd`.

**M08 · batter · duck and sway do not duck or sway.**
Where: `bat-duck__earth__ai / duck (1.84 s), under (2.01 s) / s4, f4, b4`: the batter stands tall, the bat goes from a horizontal
half-backlift to straight up over the head while the ball passes 2.2 m up; the result text says "Ducked". `bat-sway / sway,
past / s4`: body upright, ball passes within 0.3 m of the helmet, no sway. In a Test scenario this is on the batting and replay
cameras every short ball.
Right: duck = head and shoulders drop below the ball's line, bat down and out of the way; sway = head moves 0.3 m off the
line, weight back.
Fix: `UP.duck`/`UP.sway` must drive hips and spine (hip drop ~0.4 m, spine flex), not only the bat; trigger at `b.duck`.

**M09 · batter · the bat stalls at the impact pose.**
Where: `batAV 0.88-0.99` (limit 0.4) in 69 of 72 shots (bat-cover 0.92, bat-pull 0.96, bat-block 0.995): the bat's angular
velocity changes by ~90% across the impact frame. In the side-on replay at 0.35x this reads as the bat stopping on the ball
and restarting.
Fix: make the `mixPose` arc C1 through impact as the motion plan says (match bat angular velocity in and out of the exact
impact pose; time-warp only the ball, not the bat).

**M10 · people · non-striker is a statue: no backing up, no walking, one frozen mid-stride pose.**
Where: `ns-walk__earth__ai / wait, backing, release, result, back, home / s4, q4, gbowl` (0.2-4.8 s): identical pose and spot in
every phase (one knee bent as if mid-stride, bat held out at 45°), while `slip:ns 2.84 m/s` at 4.28 s shows him sliding with
planted feet when he does move. He is the largest figure in the T20 bowling view.
Right: section 7: backs up with the bat grounded or carried as the bowler reaches the crease, walks back between balls.
Fix: `nsTick` with the planned `gait` walk/backpedal and a real backing-up trigger from the run-up (`BZR`), bat trailing in
the bottom hand.

**M11 · people · fielders' idle, walk-in and ready position.**
Where: `lineup__earth__ai / idle / f4, s4` (legs straight and together, arms hanging: a mannequin), `walkin / f4` (hands on
hips, one foot lifted), `ready / f4, s4` (release+0.2: standing straight, hands on hips), `fld-ring-catch / ready / q4`,
`fld-deep-catch / settle / q4, f4` (under a skier: arms at the sides, legs locked), `fld-dive / sprint / q4, f4` (one arm
pointing sideways, legs straight). Ring fielders are in the batting view on every ball.
Right: section 7 fielding: walking in on the balls of the feet, split-step at release, knees bent, weight forward, hands in
front at hip height; a deep catcher settles with hands up early.
Fix: `gait` walk-in blended into a crouched ready (`anchors` split-step), arms forward; `hands2` reaches for the ball from
the first `airChance` sample rather than at t1.

**M12 · people · dives: rigid plank, straight legs, no launch, lying 20-25 cm under the turf, rigid get-up.**
Where: `fld-dive__earth__ai / launch (2.47 s) / q4, f4, gchase` (body flat and horizontal 0.5 m up, both legs straight and
parallel, arms straight ahead), `hands, lying / f4` (prone plank), `up / q4` (standing again 0.6 s later); `fld-deep-catch /
catch, give, hold / q4, f4, gchase` (`hold` = the body pivoting up about the feet as one rigid board, legs straight, bent 45°);
`fld-edge / launch, hands / q4, gcord`. Metrics: `ground:bowler -0.23`, `vertex -0.25` (fld-dive earth), `ground:longoff
-0.20` / `vertex -0.22` (deep catch), `ground:midoff -0.40` (Mars stop-throw), `pen:*:torso-uarm 0.21-0.29` while lying, `facing:longoff
1.16 rad/frame`, `facing:f3 2.25 rad/frame` (a 130° snap turn in one frame). Chase and cordon cameras show every one of these.
Right: push off one foot with the trailing knee bent, arms reaching with the near elbow soft, land on hip and forearm with
the ball brought to the chest, knees come under the body to get up in two beats; nothing below the turf.
Fix: dive keys in `fieldTick`/`playTick` with bent knees and a kneel-up as the motion plan says; `clampGround` every joint and
capsule of a lying body at 0; slerp the facing with the `.2 rad/frame` cap.

**M13 · people · the leap does not leave the ground.**
Where: `fld-leap__earth__ai / jump, top, land, after / s4` (5.11-6.01 s): both feet planted, knees bent, one arm straight up,
the ball hovering ~10 cm above the fingertips; the pose is held unchanged for 0.9 s. `fld-leap__moon__ai / jump, top, land /
q4`: the Selenite simply stands with his arms down facing away from the ball (result "jump miss by f3"; `flips:f3 8`,
`facing 2.2 rad/frame`).
Right: a two-foot or one-foot jump with the free arm driving, hands meeting the ball at the top, soft landing.
Fix: add the hip lift (0.3-0.5 m by planet gravity) and arm swing to act 4, time the top to t1; fix the Moon facing.

**M14 · people · throws: two-handed overhead throw-in, no side-on, no front arm, no crow-hop; Mars side-arm fling.**
Where: `fld-stop-throw__earth__ai / windup (3.68 s) / s4, q4` (throwing arm straight up, other arm sideways, one leg kicked out
to the side), `release (3.8 s) / f4, q4` (both hands behind the head), `follow / s4` (arm pointing sideways);
`fld-stop-throw__saturn__ai / windup, release / q4` (V-arms cheer then both hands behind the head);
`fld-stop-throw__mars__ai / windup, release / q4` (no windup at all, then a horizontal side-arm). Mid-off is on screen.
Right: section 7: side-on, front arm points at the target, ball taken back past the ear with the elbow high, release in
front of the head, arm follows across the body; underarm flick close in.
Fix: author throw keys on the `J` struct (`o.act 7`): gather to the chest, turn side-on, front arm point, crow-hop for the
long throw, release ahead of the head.

**M15 · people · a routine mid-off stop is played lying on the ground with the legs folded.**
Where: `fld-stop-throw__earth__ai / stop (2.78 s) / s4, q4, f4` (result "stop by midoff" for a 0.7-power ground shot): the
fielder lies on his side, shins crossed over the thighs; `take (4.65 s)`: back to a stiff upright stand with arms at the sides;
`gather (3.18 s)`: squat with straight arms and the ball between the knees. Mars: `stop / q4` the folded legs sink into the
ground (`ground -0.40`, `pen shin-torso 0.16`).
Right: long barrier or an attacking pick-up (act 2 is "stoop/squat"), then up with the ball into the throwing hand.
Fix: act 2 must not use the dive/lying pose; author a long barrier and a running pick-up; blend to the throw gather.

**M16 · people · keeper standing back: arms locked straight overhead and hands on the head at the take.**
Where: `fld-keeper__earth__ai / rise (1.86 s) / s4, q4` (both arms straight up), `ready, take, give / s4, q4, g16, gbowl`
(hands clasped behind/over the head, knees locked), `fld-keeper__moon__ai / take / q4` (goalkeeper arms, legs split),
`bat-leave / leave, past / kp4` (arms overhead while a waist-high ball passes). `teleportHand:keeper 1.23 m/frame`,
`slip:keeper 82 m/s`, `hands:keeper 0.0001 m` (the two gloves coincide). The keeper is in the bowling view every ball.
Right: section 7 keeping: gloves together at the knees in the squat, rise with the bounce, take in front of the body at
hip-to-chest height with a give, sidestep to the line.
Fix: `keepTick`/`hands2` targets on the ball's line at the ball's height; `teleportHand` cap; keep the gloves 2 cm apart.

**M17 · batter · sweep: the back shin is buried, and the "crouch" never crouches.**
Where: `bat-sweep__earth__ai / impact / f4, s4` (`ground:bat -0.19`, `vertex -0.23` at 238.51: the kneeling shin and foot are
under the pitch), `crouch (1.78 s) / s4` (batter upright with the bat straight over his head, the kneel starts after the
downswing has begun); `up (2.79 s)`: still kneeling. Same in bat-reverse (`ground -0.20`).
Fix: `qKN` kneel ground clamp on the shin capsule and toe; start the crouch at the aim as the motion plan says; stand up by
result+0.5.

### Medium

**M18 · batter · the backlift goes straight over the head for every shot.**
Where: `bat-cover / top / s4, q4, g16`, `bat-pull / top / s4`, `bat-cut / top / s4`, `bat-flick / top`, `bat-charge / step`: hands at
helmet height, blade vertical, toe to the sky; the same shape for drives, cuts, pulls and the sweeps.
Right: backlift toward first slip/gully, hands around chest-shoulder height, shorter for the block, higher and more open for
the pull/hook. Fix: per-family backlift in `SH3`/`FAM`.

**M19 · batter · back-foot shots have no weight transfer.**
Where: `bat-pull / top, impact, follow, finish / s4` and `bat-cut`, `bat-hook`: both feet stay on the stance marks, the body
upright; the pull's hands are at the chin at impact (`impact / b4`). Right: back and across onto the back foot, wrists
rolling. Fix: a back-foot step in the pull/cut/hook `SH3` keys (the LBW `FOOT` contract is for the trigger step only).

**M20 · batter · cut and late cut chop downward and finish at the ground, in front of the pads.**
Where: `bat-cut / impact, follow, finish / s4, f4` (`pen:blade-pad 0.08`, `blade-thigh 0.07`), `bat-late-cut / follow / s4`.
Right: horizontal bat, contact square or behind point, follow-through rising over the off shoulder.

**M21 · batter · drive impact: back heel flat, back foot turned square.**
Where: `bat-cover / impact / s4, q4`, `bat-straight / impact / q4`. Right: back heel up, weight over the front knee.
(Head over the front knee and the high front elbow are acceptable here.)

**M22 · batter · stance: head drooped, chin on the collar, eyes on the pitch 2 m ahead.**
Where: `bat-stance__earth__ai / stance, trigger / g16, f16, f4`. Right: head level, eyes level, looking at the bowler; the
trigger (3.63 s) is invisible at 4 m. Fix: `lookAt` the release point from the stance; a visible trigger press.

**M23 · batter · elbow/knee pole flips in the follow-through and bat-ball contact off by 7 cm.**
Where: `flips:bat 3` at 2.07 s in bat-cover, 2 in bat-pull, 1 in most shots; `contact 0.07` in bat-straight (limit 0.01),
5 of 18 red; `skinErr 0.04-0.05` in 15 of 19 (skinned mesh 4-5 cm off the joints). Visible in the slow-motion replay as a
popping elbow and the ball a few cm off the blade. Fix: `ikS` pole hysteresis; recheck `aimSwing`'s `cp` for the straight drive.

**M24 · people · ring catch: arms locked straight overhead, ball 10 cm above the fingertips, no give.**
Where: `fld-ring-catch__earth__ai / catch, give / q4`. Right: hands above the eyes, fingers up, elbows soft, give to the chest.

**M25 · batter · celebration is one static pose; "jump" does not jump; dejection static.**
Where: `cel__earth__ai / raise, jump, orbit, late / f4, s4, q4, w10` (identical for 5 s), `jump, late / fr4` (hands on hips, no
change). Fix: the planned bat raise, a jump or punch at `cel+1.5`, pivot steps.

**M26 · assets · Jupiter body: arms embedded in the torso while running and lying.**
Where: `fld-dive__jupiter__ai / launch, hands, lying / q4` (`pen:f5:torso-uarm 0.295`). Fix: with the unified athletic body
(docs/characters.md) this disappears; until then widen the Graviton shoulder sockets.

**M27 · harness · the pen gate is miscalibrated and the teleport/slip gates are swamped by between-ball resets.**
Where: `pen:bat:torso-uarm 0.19`, `glove-torso 0.19`, `handle-torso 0.17` at 0.14-0.20 s of bat-cover, i.e. in a stance that is
visibly clean at 1.6 m (`bat-stance / stance / g16`); `pen:bat:farm-handle 0.057` at 0.01 s in every sequence (the gripping
hand on the handle counts as penetration); 2141 of 3680 pen checks red. `slip:bowler 31.164` and `slip:f1 9.0352` appear with
the same value in every row, 1480 teleport and 1633 slip rows red, which buries the real ones (`teleport:f3 2.03 m` on
Neptune, `slip:keeper 82`). Key timing: `fld-dive / sprint` fires at contact+0.01 before any sprint, `bat-sweep / crouch`
before the crouch, `bat-stance / walk` shows the stance, `cel / jump` is not at a jump.
Fix: calibrate the torso/limb capsules against the mesh (or measure vertex-vs-capsule), exclude the grip pairs, report the
between-ball reset as one `reset` check per person and exclude it from teleport/slip, and anchor the phase keys to the
events they name (`play` t1-0.4 for the sprint, the aim for the crouch).

### Low

**M28 · harness · landscape and skipped shots.** `fld-slide__moon__ai` skipped 7 shots (sprint/drop/slide/stop/up on gchase);
`fld-stop-throw__moon__ai` "skipped gather". Not reviewed; the runner should fail the row or say why.

## Checklist (section 7) pass/fail summary

Batting: stance feet/knees/bat pass; head level fail (M22); grip V not judgeable at 1.6 m (gloves read as one blob);
backlift toward slip fail (M18); trigger not visible (M22); front-foot drive: head over knee pass, high elbow pass, bat by
the pad pass, follow-through high pass, back heel fail (M21), forearm through helmet fail (M01); pull/cut weight transfer
fail (M19), cut shape fail (M20); sweep shape pass, knee ground fail (M17); defence pass; non-striker fail (M10).
Bowling: pace fail on every item but "arm straight" (M04); spin fail (M05); legality: the arm is straight throughout, so
nothing reads as a throw.
Keeping: fail (M03, M16). Fielding: ready fail (M11), ground fielding fail (M12, M15), catching fail (M13, M24; the dive catch
hands do close on the ball), throwing fail (M14).
