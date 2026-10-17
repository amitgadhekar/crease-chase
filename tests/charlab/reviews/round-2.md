# Character review: round 2 (2026-10-16)

Critic: independent (models/look and motion/authenticity), judged against docs/art-style.md section 8.
Artefacts: tests/charlab/out/round2-20261016 (142 sequences, 19819 gates, 4550 red; round 1 had 4149), pairs/ and
pairs/diff.md against round1-20261016. Looked at: _lineup f4/f16/s4, _batter gbat/s4, _fielding q4/w10/gcord, _bowler gbowl,
_celebration q4, _tests s4, sequence sheets bat-charge, fld-dive, fld-stop-throw, fld-keeper, bowl-pace, bowl-spin, cel (earth),
five pairs and six single shots (27 images), plus metrics.json for both rounds.

Caveat on the numbers: tests/charlab/metrics.mjs was edited at 22:29, after round 1 ran (20:58). The "broke"/"fixed" columns in
pairs/diff.md therefore mix motion changes with gate changes. The values I quote below are physical speeds and distances, so I
treat them as real unless the harness owner shows the gate is wrong.

## Verdict

Not production ready, and not better overall than round 1. The round-1 look blockers are fixed: the keeper is gone from the
batting view, the dive no longer teleports, every planet's side is lit and wears cream trousers, the keeper no longer sinks
into the turf, and the triangle gate is green. Motion has gone backwards, though. Fielders now skate (planted feet slide at
2-12 m/s in almost every sequence, 811 red against 155), the bowler's planted foot slides on every delivery, the spin bowler
jumps about 1 m in a single frame during his approach, and the celebrating batter turns 158 degrees in one frame. Three
round-1 highs are unchanged or only changed in form: the statue throw, the T-pose front-foot contact, and the spin action that
is just the pace action re-timed. The shared body also fails the proportion rules: a barrel or pear torso with shoulders
narrower than the waist, which in the bowling view reads as a soft, feminine figure. One more full round is needed: motion
first, then the torso.

## Round-1 findings, re-checked on the same frames

| id | status | evidence |
|---|---|---|
| R1-01 keeper in batting view | fixed | _batter gbat: no keeper in any frame |
| R1-02 dive teleport | fixed (but see B1) | fld-dive__jupiter teleport:f3 2.12 -> 0.09 m |
| R1-03 black cut-outs | fixed | _lineup f4/f16: lit, cream trousers on all 8 planets |
| R1-04 keeper sinks | mostly | ground gate 0 red; vertex still -0.043..-0.048 m (M6) |
| R1-05 zombie idle | fixed | _lineup f4: hands on hips, relaxed |
| R1-06 hands on hips while running | not shown | fld-dive__earth sprint 2.24 s: he stands still, feet together, and never runs (M1) |
| R1-07 statue throw | reopened | windup s4 pair: worse than round 1 (H1) |
| R1-08 sleepwalking keeper | fixed | release kp4 pair: running stride, arms bent |
| R1-09 black cordon cut | fixed | _fielding gcord: batter lit on Moon/Mars/Jupiter |
| R1-10 keeper give | reopened, new wrong pose | fld-keeper__earth give 2.40 s (M2) |
| R1-11 plank dives | reopened | fld-dive__earth hands/lying (M1) |
| R1-12 gliding walk | replaced | bowl-spin walk 0.40 s is now an unbalanced lurch (B2) |
| R1-13 cover drive impact | partly fixed | impact s4 pair: some forward lean, back heel up |
| R1-14 charge impact | partly | impact acceptable for a straight drive; follow-through still low (M5) |
| R1-15 front-foot contact | reopened, unchanged | front s4 pair: 2.95% of pixels differ (H2) |
| R1-16 spin = pace | reopened | bowl-spin pivot 1.00 s T-pose (H3) |
| R1-17 facing snaps / flips | facing fixed except cel; flips worse | B4, M4 |
| R1-18 bowler arm through body | reopened | M3 |
| R1-19 species features | Mercury/Venus ok; Saturn ring still off | M7 |
| R1-20 hands overlap | fixed | hands gate 1 red (0.105 vs 0.11) |
| R1-21 / R1-25 gate noise | open | X1, X2 |
| R1-22 tris | fixed | all tris gates green (gbat 129k) |
| R1-23 mannequin face | partly | eyes now have pupils; still flat (L1) |
| R1-24 camera framing | open | X3 |

## Findings (most severe first)

### Blockers
- **B1 Fielders skate (people).** Planted feet slide in nearly every sequence, usually all fielders at the same instant just
  after contact: bat-cover__earth f1-f8 at 2.0-2.2 m/s at 24.2-24.45 s; cel__earth f1-f8 at about 2.2 m/s at 3.18 s;
  fld-dive__moon f1 11.5 and f3 12.9 m/s at 406.6; fld-ring-catch__moon f4 12.5; fld-deep-catch__saturn longoff 11.1;
  fld-slide longon 31-34 m/s on five planets. Fielder slips went from 155 to 811 red. The reaction to the shot turns or translates
  the body while the feet stay planted. Right: every turn pivots on a lifted or ball-of-foot step, translation only through
  gait steps, and the slide's sliding foot exempted explicitly rather than allowed to pop at 30 m/s.
- **B2 Spin bowler teleports about 1 m in his approach (people).** teleport:bowler is 1.02 m at 0.79 s on bowl-spin__earth,
  1.05 on Neptune, and the same on every spin, keeper-spin and lineup sequence (0.79 in round 1 too; it was missed then). At
  walk 0.40 s (bowl-spin__earth walk s4 pair) both feet are together behind him and the torso is well ahead of them, with no
  support under the centre of mass. Right: a short, rhythmic, accelerating approach in which each stride lands under the hips,
  continuous into the gather.
- **B3 Bowler's planted foot slides on every delivery (people).** slip:bowler is 4.9-7.6 m/s on every sequence with a delivery:
  bowl-pace__earth 4.86 at 1.85 s (follow-through), bowl-spin__earth 6.26 at 0.99 s (pivot), bowl-spin__moon 18.95. That is
  133 red against 16. It is visible in both the batting and bowling views. Right: the back foot pivots on its ball (slipTurn,
  not slip) and the follow-through decelerates through real strides.
- **B4 Celebrating batter spins 158 degrees in one frame (batter).** facing:bat is 2.72-2.77 rad at about 2.44 s on all 8 cel
  sequences (newly red; 0.08 in round 1), in the celebration camera. Right: turn over 0.3 s or more, stepping round.

### High
- **H1 Throw is still a statue, and worse (people).** fld-stop-throw__earth windup 3.67 s (s4 pair): upright and front-on, feet
  close together, throwing arm locked straight up with the ball held aloft. Round 1's stride has gone. Release 3.79 s looks the
  same. Right: side-on, front arm pointing at the keeper, ball hand back behind the head with the elbow at shoulder height and
  bent about 90 degrees, a crow-hop or stride, then weight onto the front foot through release.
- **H2 Pace front-foot contact unchanged (people).** bowl-pace__earth front 1.45 s s4 (only 2.95% of pixels changed): both arms
  straight out in a T at shoulder height, torso upright. Right: front arm high and pulling down, bowling arm coming through
  from low behind, chest closing from side-on, braced front leg.
- **H3 Spin action is the pace action re-timed (people).** bowl-spin__earth pivot 1.00 s has the same T arms. Release 1.10 s
  is the same vertical straight arm as pace. Right: short approach, a pivot on the back foot, side-on, front arm leading to the
  target, a slower circular arm with the wrist cocked and turning.
- **H4 Shared body fails the proportions (assets).** lineup__earth__ai idle f16 and bowl-pace__earth front f16: a barrel or pear
  torso with sloping shoulders narrower than the waist, a rounded soft chest that reads as feminine, and a long thin neck.
  Section 2 asks for shoulders about 1.45x the hips with a V taper. The bowler fills the foreground of the bowling view, so this
  is a game-camera issue. Right: broad deltoids (.46-.48 m), a narrow waist, a flat pec plane under the shirt, and a neck
  .12-.13 m wide with a trapezius slope.
- **H5 Mercury's head and kit are unreadable (assets).** lineup__mercury__ai idle f16: the head and arms are black with orange
  bands, so there is no readable face. Section 5 asks for ember-orange skin with darker veins, and this is the inverse. The AI
  shirt is peach, close to skin tone, so the man looks shirtless. Right: orange skin with dark veins, a visor band, a readable
  jaw, and a shirt colour at least 25 L* away from the skin.
- **H6 Catch frames: ball short of the hands, feet stacked (people).** fld-ring-catch__mars catch s4: the ball is about 30 cm
  beyond the fingertips (handsBall 0.278). Jupiter is at 0.231 and 0.222. Earth is at 0.159 (0.072 in round 1, so worse), and
  fld-ring-catch__earth catch f4 also shows one shoe on top of the other, knock-kneed. Every catch now gets a slow-motion replay.
  Right: the ball meets both hands at t1 (<= 0.12 m), fingers up for a catch above the chest, feet apart.
- **H7 Celebration pose (batter).** cel__* raise 2.93 s to late 7.93 s (_celebration q4, cel__earth sheet): the batter stays in
  the batting crouch, knees bent and seat back, with the bat held up in both hands for 5 s, and the "jump" phase has no jump.
  Right: stand tall, bat raised in the top hand toward the dressing room, the free arm punching or the helmet raised.

### Medium
- **M1 Dives: no approach, plank and prone landing (people).** fld-dive__earth sprint 2.24 s: he stands with feet together.
  Launch 2.69 s: he dives from a static straddle. Hands 2.84 s and lying 3.24 s: straight body, face down. fld-dive__saturn
  hands q4: he is on all fours, on his knees. Right: a run, a split step, a launch off one foot, landing on hip and forearm,
  then up in two beats.
- **M2 Keeper's give (people).** fld-keeper__earth give 2.40 s (f4/f16): both gauntlets up beside the face with elbows flared,
  which reads as "head in hands". Right: the gloves ride back softly toward the hip or chest on the side of the take, elbows
  bent and relaxed.
- **M3 Bowler's arm through his own body (people).** bat-straight__earth thigh-uarm 0.109 and torso-uarm 0.134; ns-walk and
  bat-sway torso-uarm 0.127; bat-charge and bowl-spin hand-torso 0.113. Unchanged from round 1. Right: the follow-through arm
  sweeps outside the front thigh and across the chest, clear of both.
- **M4 Elbow and knee pole flips (people).** New on bowl-pace for Mercury, Venus, Mars and Jupiter (bowler, 1-2 flips) and on
  fld-dive f2/f3 for Moon, Mercury, Venus and Mars. fld-leap__moon f3 is still at 4. Right: 0 flips (keep the pole on the same
  side through the dive and the delivery).
- **M5 Lofted six: low finish and an odd charge (batter).** bat-charge__earth follow 1.96 s and finish 2.25 s: the bat stops
  about 45 degrees below the head for a 77 m six. Step 1.26 s: the bat is held horizontal at shoulder height, pointing to point,
  while he charges. Right: a high, full follow-through over the front shoulder; while charging, a compact backlift toward slip.
- **M6 Bodies still sink into the turf (people).** vertex -0.043..-0.045 m on keeper edge dives (Mercury, Venus, Jupiter,
  Neptune, Earth -0.038), fld-keeper__jupiter -0.041, and fld-slide longon -0.047..-0.048 on six planets (limit -0.01). Right:
  pads and gauntlets touch the turf and stay above it.
- **M7 Saturn's ring follows the head (assets).** fld-dive__saturn hands q4: the ring stands vertical in front of the face like
  a hoop. In lineup f16 it reads as an angel's halo. Right: tilted, world-up, floating above the crown whatever the head does.
- **M8 Keeper takes far from the ball (people).** handsBall keeper:take: bat-duck 1.85 m and bat-sway 1.50 m (unchanged),
  fld-keeper Mercury 0.47, Mars 0.32, Moon 0.29, cel__mercury 0.61. These are visible in the bowling view. Right: the gloves
  meet the ball (<= 0.12 m), shuffling sideways to get in line.

### Harness
- **X1 Gates changed between rounds; noise is still in them (medium).** metrics.mjs changed after round 1, so the diff is not
  like for like. Fielders f1-f8 still "teleport" 0.068-0.072 m at one shared instant per sequence (R1-21). fld-slide's slide
  counts as slip. teleportHand:bowler is 0.40 m/frame on every delivery (48 m/s at 120 Hz, above a real release hand speed of
  roughly 30 m/s): either a real snap at release or a gate that needs a bowling-arm rule. Decide which, and say so in summary.md.
- **X2 torso-uarm gate (medium).** torso-uarm is 0.0201-0.0208 on every bowler and 0.03 on every celebration fielder, which is
  pure noise (R1-25). The builders report that the ALLOW key is unsorted, so pairKey never matches it. Fix it so that real arm
  penetrations (M3) stand out.
- **X3 Camera framing (low).** bat-charge impact f16 shows the torso but no head. Chase camera "sprint" on fld-dive__earth sits
  inside the batter's helmet (R1-24). Check whether the lab hides the batter as the game does.
- **X4 Cordon camera (medium).** _fielding gcord: about 30 m of field in frame, the diver tiny, and the batter out of frame on
  Mercury, Venus, Saturn and Neptune. That does not match the long-lens cut (9 m across) in CLAUDE.md. Either the lab shot
  time or the game camera is wrong.

### Low
- **L1 Earth faces still mannequin-like (assets).** lineup__earth__ai idle f16: smooth, flat planes, small eyes, faint brows,
  no visible ears.
