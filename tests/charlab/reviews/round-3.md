# Character review: round 3 (2026-10-17)

Critic: independent (models/look and motion/authenticity), judged against docs/art-style.md section 8.
Artefacts: tests/charlab/out/round3-20261017 (142 sequences, 19879 gates, 2326 red; round 2 had 4550), pairs/ and
pairs/diff.md against round2-20261016. Looked at: sheets bowl-pace, bowl-spin, fld-stop-throw, fld-dive, fld-keeper, cel,
bat-charge (earth), _lineup f16, _batter s4, _bowler gbowl, _fielding q4/gcord; pairs bowl-pace front s4/f16, bowl-spin walk
s4, stop-throw windup s4/release f4, lineup idle f4, dive sprint f4/lying s4, ring-catch catch s4, dive saturn hands q4
(23 images), plus metrics.json for both rounds.

Caveat on the numbers: the gate definitions changed again (unversioned -> f5e4d51f), so pairs/diff.md is not like for like.
Values quoted below are physical distances and speeds from metrics.json.

## Verdict

Not production ready. Better than round 2: the fielders' mass skating after contact is mostly gone (non-bowler slip reds 256,
down from about 800), the bowler's slide fell from 5-10 to about 2 m/s, the spin bowler's 1 m jump is down to 9 cm, the
celebration is fixed (standing tall, bat up, a real jump, no snap), the lofted finish is right, and Mercury reads correctly.
But the bowler is still the weak point, and he is in the foreground of the bowling view on every ball: his body still pops 9-20
cm in a single 120 Hz frame on every one of the 142 sequences, his planted foot still slides at about 2 m/s on 89 of them, the
spin approach is a 45-degree forward lean with both feet together behind him, the front-foot contact is still a T, and in the
bowling view the spin release looks the same as the pace release. Catches got worse (the ball 17-29 cm past the fingers), the
dive is still a catwalk walk into a face-plant, and the keeper's give is still gloves on his head. The claimed contact fix is not
in this build: bat-late's impact data is byte-identical to round 2. Another round is needed, bowler first.

## Round-2 findings, re-checked on the same frames

| id | status | evidence |
|---|---|---|
| R2-01 fielders skate | partly fixed | bat-cover/cel f1-f8 green; 256 non-bowler slip reds remain, up to 5.7 m/s (B4) |
| R2-02 spin teleport / lurch | teleport mostly fixed, pose not | teleport 1.02 -> 0.086 m; walk 0.40 s s4 is worse (B2) |
| R2-03 bowler slide | improved, still red | 89 sequences, median 2.09 m/s, max 3.44 (was ~6) (B1) |
| R2-04 cel snap | fixed | facing green on all 8 planets |
| R2-05 statue throw | open | windup s4 / release f4 (H1) |
| R2-06 T-pose front foot | open | front s4: both arms straight out at shoulder height (H2) |
| R2-07 spin = pace | partly | pivot changed; release identical in gbowl on all planets (H3) |
| R2-08 torso | partly fixed | standing V taper reads male; raised arms still collapse it (H6) |
| R2-09 Mercury | fixed | _lineup f16: ember skin, dark kit, visor readable |
| R2-10 ball past hands | reopened, worse | ring-catch earth 0.159 -> 0.244, saturn 0.293, jupiter leap 0.291 (H4) |
| R2-11 cel crouch | fixed | cel__earth raise/jump/orbit: standing tall, punch, airborne |
| R2-12 dive | open | sprint f4 / lying s4 (H5) |
| R2-13 keeper give | open | give 2.42 s: gloves on top of the helmet (M1) |
| R2-14 bowler arm through body | open | torso-uarm/farm-torso 0.11-0.13 m (M3) |
| R2-15 flips | worse | bowl-pace bowler flips 2 on 6 planets (was 1 on 4); slide moon/mercury 3 (M4) |
| R2-16 lofted finish | fixed | bat-charge finish 2.25 s: hands above helmet, bat behind head |
| R2-17 sinking | partly | slides -0.047 -> -0.017; keeper edge moon/mercury/jupiter still -0.043 (M5) |
| R2-18 Saturn halo | open | now floats free above the back in a dive; still a halo (M6) |
| R2-19 keeper take distance | partly | mercury 0.47 -> 0.19, moon 0.29 -> 0.14, still red |
| R2-20 gates changed | reopened | changed again; diff not like for like (M9) |
| R2-21 torso-uarm noise | partly | fielders fixed (0.0001); batter red on 142/142 incl. stance (M8) |
| R2-22 cordon framing | open | _fielding gcord: ~30 m of field, diver tiny, batter absent on Earth (M7) |
| R2-23 face cam / chase cam | half | chase cam fixed; 1.6 m face still headless at bat-charge impact (low) |
| R2-24 faces | open | low, not repeated |
| builder: bat-late contact 0.0059 | not in this build | impact.contact 0.0132, raw n/u/w identical to round 2 |

## Findings (most severe first)

Blockers
- B1 bowler, every delivery: teleport:bowler red on all 142 sequences, 0.09-0.20 m in one 120 Hz frame (bowl-pace__earth
  0.127 @1.29 s, 0.2 s before release at the bound landing; bowl-pace__mercury/mars 0.204/0.206); fld-stop-throw on every
  planet 0.51-0.60 m (bowler, 2.08 s) with the hand jumping 0.59-0.65 m. Plus slip:bowler on 89 sequences at ~2 m/s (bowl-spin
  1.72 @0.27 s after release, ns-walk 3.44). Right: continuous hip path through bound and landing, planted foot locked.
- B2 bowl-spin__earth walk 0.40 s s4: torso pitched ~45 degrees forward, both feet together trailing behind, no support under
  the centre of mass (worse than round 2). Right: an upright walking/jogging approach, one foot under the hips.
- B3 fielder teleports in leaps: fld-leap__earth f2 0.29 m (was 0.068), jupiter f3 0.28, venus f3 0.27; hands 0.31-0.37 m.
- B4 residual skating: fld-edge__saturn keeper 5.74 m/s, fld-slide__saturn midoff 5.63, deep-catch venus/mars longoff
  3.7-3.9, stop-throw midoff 2.6-3.2 on 5 planets; lineup moon f4 / mars f3 turn 2.5-3.0 rad/s on planted feet while idle.

High
- H1 fld-stop-throw__earth windup 3.70 s / release 3.82 s: upright, feet under the hips, arm held straight out at the target,
  then the forearm wrapped over the cap. Right: side-on crow-hop, front shoulder to target, wide stride, arm cocked back low.
- H2 bowl-pace__earth front 1.45 s s4: unchanged T, both arms straight at shoulder height. Right: front arm pulling down past
  the hip, bowling arm rising behind, chest closing.
- H3 bowl-spin release 1.10 s vs bowl-pace 1.50 s (_bowler gbowl, all planets): the same vertical straight arm. Right: shorter
  approach, lower and rounder arm, wrist cocked, pivot over a braced front leg.
- H4 catches: fld-ring-catch__earth catch s4 ball ~25 cm past the fingers (0.244), saturn 0.293, mars 0.172, jupiter leap
  0.291, moon/mercury/saturn leap 0.14-0.17; slide stops 0.38-0.49 m. Right: ball inside cupped hands at t1, gap <= 1 cm.
- H5 fld-dive__earth sprint 2.36 s f4: legs crossed like a catwalk walk, upright, no run; lying 3.36 s s4: face planted, on
  hands and knees (f2 head-uarm 0.145). Right: low run, a side-on launch off the outside foot, landing on the forearm and hip.
- H6 bowl-pace__earth front f16 (and the 1.6 m face in every bowling shot): with arms raised the shoulders cave in and the chest
  rounds into a bust; waist pinched. Standing (lineup f4) is now acceptable.

Medium
- M1 fld-keeper__earth give 2.42 s: gauntlets on top of the helmet, elbows flared. Right: mitts together riding back toward the
  hip, elbows soft.
- M2 batter hands: farm-farm/wrst-wrst/handle-wrst 2-6 cm on 33-60 sequences (bowl-pace leave 0.063 @136.09). Deferred last round,
  still there.
- M3 bowler arm through body: torso-uarm/farm-torso 0.11-0.13 m at the release on mercury/saturn/neptune/jupiter, 0.13 at the
  first frame of most bat sequences (bat-edge 0.135 @0.01 s).
- M4 flips: bowl-pace bowler 2 on mercury/venus/mars/jupiter/saturn/neptune; fld-slide moon tman 3, mercury dmid 3.
- M5 sinking: keeper vertex -0.043 on fld-edge moon/mercury/jupiter, fld-keeper/cel jupiter -0.040; midon -0.018..-0.024 in
  stop-throw on all planets.
- M6 Saturn ring (_lineup f16, dive hands q4): a halo floating over the head, detached over the back in a dive. Right: a ring
  that reads as part of the head (a crest or a band through the skull), not a halo.
- M7 _fielding gcord: still ~30 m of field, the diver tiny, Earth shows no batter. Right: the documented 9 m long-lens cut.
- M8 harness: bat:torso-uarm red on 142/142 (stance 0.044); the lab's round r .15 torso does not match the batter's chest,
  so the gate cannot show real arm-through-chest. Fielder shin-thigh red on 135 (0.12 in plain crouches) needs a knee-flex rule
  or it is real calf-through-thigh: prove which.
- M9 harness: gate definitions changed again; re-run round 2 under f5e4d51f so the next diff is like for like.
