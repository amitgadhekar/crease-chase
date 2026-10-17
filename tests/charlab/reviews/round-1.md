# Character review: round 1 (2026-10-16)

Critic: independent (models/look and motion/authenticity), judged against docs/art-style.md section 8.
Artefacts: tests/charlab/out/round1-20261016 (142 sequences, 19097 gates, 4149 red; baseline 7868 red: 3332 fixed, 411 newly red).
Looked at: the group sheets (_lineup f4/f16/s4, _batter f4/s4/f16/gbat, _fielding f4/q4/kp4/gcord/gchase, _bowler s4/gbowl,
_celebration q4/gcel, _nonstriker s4/gside, _tests s4), the sequence sheets bowl-pace/bowl-spin/bat-cover/fld-dive (earth,
jupiter)/fld-stop-throw/fld-keeper/fld-keeper-spin/fld-ring-catch/fld-edge land, and four single shots (33 images).

## Verdict

Not production ready. The Earth batter and the Earth fielding side have moved a long way (skinned bodies, kit, a real bowling
action, dives and takes that reach the ball), but a player of a polished mobile sports game would hit four blockers in the first
over on most planets: the keeper standing in the batting camera's foreground, fielders jumping metres at the start of a dive,
the whole fielding side rendered as black cut-outs on seven planets, and the keeper sinking into the turf on a dive. Below them,
the idle/ready poses (arms out, hands on hips while sprinting), the overhead "statue" throw and the plank dives are the things
that read wrong at normal speed. One more full round is needed; the fixes are mostly motion and material/lighting, not models.

## Findings (most severe first)

### Blockers
1. **Keeper in the batting view** (people) - bat-miss__earth__ai top 1.68 s, game: batting view; metric handsBall:keeper:take =
   7.36 m. A full-size keeper stands square-on between the camera and the stumps in the player's home batting view and never
   reaches the ball. Right: hidden in the home batting view (`batView`) as before, taking the ball at his stance behind the stumps.
2. **Fielders teleport into the dive** (people) - fld-dive__jupiter__ai teleport:f3 = 2.12 m and teleportHand 2.15 m in one frame
   at 2.23 s (between "sprint" 2.15 s standing at mid-off and "launch" 2.60 s); fld-dive__moon__ai slip:f2 = 19.5 m/s; 1339 red
   teleport checks, 211 slips. Right: the run profile carries the man to the launch point; the dive starts from where he stands.
3. **Fielding side is a black cut-out on 7 of 8 planets** (people, material/lighting) - lineup__venus__ai idle f4 (daylit: shirt
   and trousers black, only the shoes lit); _lineup f4/f16/s4 Moon, Mercury, Venus, Mars, Jupiter, Saturn, Neptune; _bowler s4 all
   non-Earth; _fielding gcord. Trousers are not cream on Venus (both kits), Mars, Neptune. Fails section 4 outright (shirt vs
   grass, trim vs shirt). Right: cream trousers and the team shirt readable from the shadow side as on Earth (fill from the
   env light + rim; check spPaint's regions / v flip and LOOK3D env intensity per planet).
4. **Keeper sinks into the ground on the edge dive** (people) - fld-edge__mercury__ai vertex:keeper = -0.107 m; fld-edge__earth
   __ai__land ground:keeper = -0.084 m at 2.70 s, seen by the cordon camera. Right: lying touches the turf, never below -1 cm.

### High
5. **Idle "zombie" pose** (people) - lineup__venus__ai idle f4 and _lineup f16/f4 on every non-Earth planet, fld-dive__jupiter__ai
   sprint 2.15 s: arms held away from the body, elbows bent outward, hands splayed. Right: arms hang with soft elbows, or hands on
   knees/hips in the ready crouch; shoulders relaxed.
6. **Hands on hips while running** (people) - fld-dive__earth__ai sprint 2.23 s (4 m side/front/10 m): legs in stride, hands on
   the hips. The idle variant bleeds into movement. Right: the gait's arm swing takes over as soon as speed > 0.5 m/s.
7. **Throw is a statue of liberty** (people) - fld-stop-throw__earth__ai windup 3.66 s and release 3.76 s (4 m side/front): body
   front-on, legs straight and together, throwing arm vertical above the head, front arm hanging; release looks like the wind-up.
   Right: side-on, front arm points at the target, hand behind the head, hips then shoulders turn, release in front of the head,
   follow-through across the body, weight onto the front foot.
8. **Receiving keeper sleepwalks to the stumps** (people) - _fielding kp4 (fld-stop-throw release frames, every planet): wide
   straddle, both arms held out horizontally in front, hands up. Right: jogs with the gait's arms, gloves come up only in the last
   0.4 s before the throw arrives (as the take already does).
9. **Batter black in the cordon camera** (assets/lighting) - _fielding gcord: fld-edge Venus, Mars, Mercury, Moon, Jupiter, Saturn
   show the batter and slip as silhouettes on a bright ground in a live cut. Right: a lit batter from every game camera (section 1:
   one light model, nobody pasted on); the sun azimuth or env/rim must cover the behind-the-bowler view.
10. **Keeper "give" at arm's length** (people) - fld-keeper__earth__ai give 2.45 s (4 m front/side): both arms straight out to the
    side at shoulder height with the ball. Right: the hands give toward the hip/chest with soft elbows.

### Medium
11. **Plank dives** (people) - fld-dive__earth__ai hands 2.83/lying 3.23 s, fld-ring-catch__earth__ai catch 4.96 to hold 5.66 s,
    fld-edge__earth__ai__land hands 2.40 s (keeper fully horizontal 0.8 m up): straight body, both arms forward, legs straight,
    landing flat prone and staying there. Right: launch off one foot, land on hip and forearm, roll, ball held up, up in two beats.
12. **Over-long walking strides** (people) - bowl-spin__earth__ai walk 0.40 s; fld-stop-throw__earth__ai 4 m bowler 2.76/3.66 s and
    4 m keeper 4.03 s: legs split ~1.2 m with both feet flat, torso upright. Right: ~0.7 m stride with heel strike and toe-off (the
    2.6 m cycle cap is a sprint number).
13. **Cover-drive impact** (batter) - bat-cover__earth__ai impact 1.98 s (4 m side/front): body upright, head behind the front knee,
    arms fully extended to reach. Right: head over the front knee, high front elbow, bat close to the pad.
14. **Charge impact** (batter) - bat-charge__earth__ai impact 1.80 s (4 m side): upright jab, bat vertical at hip height, no forward
    lean. Right: head over the ball, weight through the front foot, full face.
15. **Bowler front-foot contact** (people) - bowl-pace__earth__ai front 1.45 s (4 m side/front): chest open to the batter, front arm
    at the chest not high, bowling arm folded behind the head. Right: side-on, front arm high then pulled down, braced front leg.
16. **Spin is the pace action re-timed** (people) - bowl-spin__earth__ai pivot 1.00/release 1.10 s vs bowl-pace release 1.50 s:
    same gather and vertical-arm release, T-pose arms at the pivot. Right: short approach, pivot on the back foot, slower rounder
    arm, fingers/wrist working, short follow-through.
17. **Facing snaps and pole flips** (people) - facing gate 116 red up to 0.37 rad/frame (fld-stop-throw__mercury midon; ns-walk
    slips 0.25); flips:f3 = 4 on fld-leap__moon. Right: facing eased <= 0.2 rad/frame; 0 flips.
18. **Bowler's arm through his own body in the follow-through** (people) - bat-straight__earth__ai pen:bowler:thigh-uarm = 0.10 m,
    bat-back-cut pen:bowler:torso-uarm = 0.14 m; bowl-spin__moon pen hand-torso 0.11 m. Right: the arm crosses in front of the body.
19. **Species features** (assets) - lineup__saturn f16/f4: the ring is a thin jagged polyline hanging to one side; lineup__mercury
    f16: the crest fin reads as a candle flame; lineup__venus f16: no gill fronds visible. Right: a solid tilted torus with a
    visible thickness, a swept fin, two pairs of fronds (section 5).
20. **Gauntlets/hands overlap** (people) - hands:keeper = 0.096 m (lineup, bat-leave, fld-keeper) under the 0.11 gate; hands:midoff
    = 0.033 m on fld-stop-throw__saturn. Right: gauntlets side by side 0.13 m, never through each other.
21. **Lab resets and the countdown cut** (harness) - every sequence: all fielders teleport 0.095 m at 1.11 s (the skipped
    countdown); reset:f6 = 16.2 m (fld-ring-catch__earth), reset:dmid = 27.3 m (fld-slide__mars). Right: the lab plays the gap or
    exempts the cut; men 16-27 m from their spot still jump under the 12 m rule and need the walk-back.
22. **Triangle gate red** (harness) - tris:gcel 536k, gbat 248k, gchase 244k vs 230k: the crowd. Right: the gate measures people
    (or the crowd budget is agreed and the gate raised with a decision in docs/characters.md).

### Low
23. Earth faces at 1.6 m (assets) - bowl-pace__earth gather/front 1.6 m face, fld-keeper__earth ready 2.03 s: oversized pale eyes
    without pupils, flat features; mannequin rather than athlete.
24. Lab cameras (harness) - the batter's "1.6 m face" camera shows his back (bat-stance f16); the chase camera at "sprint" sits
    inside the batter's helmet (fld-dive earth/jupiter gchase sprint).
25. Resting arm vs torso (harness/people) - pen:bowler:torso-uarm 0.0257 on every sequence, cel fielders 0.03: the hanging upper arm
    is 2.5-3 cm inside the lab's torso capsule; calibrate the capsule or widen the hang.

## Passes worth keeping
Earth batter kit, grip (gloves together on the handle in every 1.6 m hands frame), back number, pads and shoes; impactExact, contact,
skinErr, batAV/batAxis all green; draw calls well under budget (gbat 103, gbowl 63, gcel 115); build 2.27 MB; pace release with a
vertical arm and a braced front leg; keeper squat/rise up to pace and spin; keeper helmet up to spin; non-striker backing up.
