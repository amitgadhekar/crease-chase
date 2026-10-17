# Art style: characters

Status: rules for the character upgrade (2026-10-15). Every model, pose and review is judged against this page.
Owner decisions: one athletic human body in real cricket kit for every team; alien species shown only by head, skin and one
signature feature; "like real cricket and real humans"; nothing may look awkward, clip or float. Original IP only.

## 1. Target look: stylised-real

- Clean, readable shapes first, detail second. Every character must read at its usual distance: the batter at 5-10 m
  (batting view), fielders at 20-70 m, everyone at 2-4 m in replays. If a detail can't be seen at its distance, spend the
  triangles or texels elsewhere.
- Real human anatomy with slightly heroic sport proportions: broad shoulders, narrow waist, strong forearms and calves. No
  toy, chibi or mannequin look: necks, wrists, knees, heels and shoulders exist and bend.
- Materials: matte cloth (roughness .75-.88, a faint weave), satin pads and gloves (.55-.65), glossy helmet (.3), metal grille,
  skin with a soft subsurface feel (warm, roughness .6-.7). The sky rim light is a seasoning, not a coating: cloth .4, pads and
  gloves .6, shoes .5, skin .9, helmet 1.1 of today's strength.
- One light model for everything (the stadium's sun and sky light); no character may look pasted on or glow unless the
  species' feature is meant to.

## 2. Proportions (game metres; the rig contract in docs/characters.md is the source of truth for bone lengths)

| | Batter / athletic body |
|---|---|
| Height (standing, shoes on) | 1.82 m (7.5 heads; head .24 m chin to crown) |
| Shoulder width (outside the deltoids) | .46-.48 m, about 1.45x the hip width |
| Hip width | .33 m |
| Chest depth / waist depth | .24 m / .21 m (side view must not look flat) |
| Neck | visible, .12-.13 m wide, trapezius slope from the ear line to the shoulder; the helmet/cap sits on the head, never on the neck |
| Upper arm / forearm (to the wrist) / hand | .31 / .27 / .19 m |
| Thigh / shin / foot | .43 / .43 / .27 m (shoe .29-.30 m) |
| Hands | palm .10 m wide; gloves .11 m; a closed batting grip wraps the handle completely |

Silhouette checks: from the front, shoulders clearly wider than hips and the arms separate from the torso in the stance; from
the side, chest and seat give an S-curve; shoes are not tiny; pads stand off the leg.

## 3. Kit language (same for every team)

- Shirt: collared polo, a 3-button placket, sleeve trim band, a back number (team-local, 1-11), short sleeves for fielders and
  bowlers, long or short for the batter. Shirt is cut, not painted on: a hem step at the waist, folds at the armpit and back.
- Trousers: cream for both teams (cricket whites read as cricket); belt; loose seat and leg, a crease line, gathered over the
  shoe. Team colour appears on shirt, trim, cap, helmet and gloves, not on trousers.
- Batting pads: brighter and smoother than the trousers (pads white .95, trousers cream .88), vertical ribs, a knee roll, an
  inner wing, three straps behind the calf. Batting gloves: separate fingers with padding bars, a thumb, team-colour cuff.
- Keeper: webbed gauntlets (one mitt with a thumb), shorter pads, cap when back to pace, helmet when up to the stumps.
- Shoes: white spikes with a visible sole line and a darker sole; a lace band.
- Cap (fielders, keeper back): a team-colour cap with a peak; the bowler bowls capless.
- Helmet: team colour, a grille clear of the chin by 1-2 cm, a neck guard, vents.

## 4. Colour rules

- Every team: shirt (main), trim (second colour), cap/helmet (main or darkened main), cream trousers, white pads/shoes.
- Contrast: species skin vs shirt CIE L* difference >= 25; shirt vs grass (mean outfield colour) L* difference >= 20 or hue
  difference >= 60 deg; trim vs shirt L* difference >= 20. Nothing saturated next to its complement (no vibrating edges).
- Human skin: warm, natural tones; one team may mix several tones (seeded per player).
- Emissive (glowing) features: only a species' signature feature, at most 15% of the head's area.

## 5. Species identity (the body and kit are shared; only the head, skin and one feature differ)

Every species head fits the shared neck socket and stays within a .26 m x .30 m envelope (cap or ring excluded), so the body
reads as an athlete; the alien is in the face and skin.

| Planet / species | Skin and pattern | Head silhouette | Signature feature |
|---|---|---|---|
| Earth / humans | natural tones, no pattern | human, ears, eyes, brows, mouth | team cap |
| Moon / Selenites | pale grey-blue, fine crater speckle | high smooth dome, large dark eyes | a softly glowing crest line over the dome |
| Mercury / Scorchlings | ember orange with darker cracked veins | angular, heavy jaw, visor band over the eyes | a short swept-back crest fin |
| Venus / Cloudwaders | soft teal with lilac mottling | rounded, short snout | two pairs of feathery gill fronds (not tendrils everywhere) |
| Mars / Rustkin | rust red, dusty freckles | broad brow band, wide-set eyes | two short antenna stalks with glowing tips |
| Jupiter / Gravitons | tan with Jupiter-like horizontal bands | wide, low, heavy brow | glowing amber eyes |
| Saturn / Ringlings | pale gold, faint concentric stripes | egg-shaped, tall | a small floating ring above the head (tilted, slow spin) |
| Neptune / Tidefolk | deep blue with bioluminescent spots | smooth, finned temples | swept head fins with glow spots |

Species may differ in skin, head and feature only: same height (+-3% seeded per player), same limbs, same kit, shoes for all.
Gait physics per planet stay (low-gravity float on the Moon, heavier steps on Jupiter); the body mechanics stay human.

## 6. Motion principles

- Weight is always somewhere: over the planted foot, between the feet in a stance, never floating. Planted feet do not slide.
- Movement starts in the hips: hips lead the shoulders, shoulders lead the arms, the head arrives last and stays level.
- No locked joints at rest: knees 5-10 deg soft, elbows 10-15 deg, fingers relaxed.
- Arcs, not lines: hands, bat and feet travel on curves; fast moves accelerate and decelerate; nothing pops or snaps between
  poses; turns pivot on a foot.
- Anticipation and follow-through: a backlift before a swing, a gather before a throw, a split-step before a dive.
- Eyes on the ball: the batter's head tracks the ball from release and is still at impact; fielders, keeper and bowler watch it.
- Nobody teleports in view; between balls everyone walks back.
- Two hands never pass through each other, the ball, the body or the ground; arms never pass through the torso; the bat never
  passes through the body, pads or helmet.

## 7. Cricket authenticity checklist (reviewers check every item)

Batting
- Stance: feet shoulder width, astride the batting crease, knees flexed, weight on the balls of the feet, head level and eyes
  level, bat grounded behind the back toe or raised slightly.
- Grip: both hands together near the top of the handle, the V between thumb and first finger of both hands in line between the
  outside edge and the splice; top hand's back toward mid-off; bottom hand relaxed.
- Backlift toward first slip/gully; a small trigger movement before release.
- Front-foot drive: head over the front knee at impact, high front elbow, bat close to the front pad, full face, follow-through
  high; back heel up.
- Back-foot shots: pull and cut with a horizontal bat, weight transferring back and across, roll of the wrists in the pull.
- Sweep: front knee bent forward, back knee down on the ground, bat horizontal in front of the front pad; reverse sweep crosses
  the hands.
- Defence: soft hands, bat angled down, head over the ball.
- Non-striker: backing up with the bat grounded or carried, walking back between balls, never sliding.

Bowling (MCC Law 21.2 and the ICC 15 deg tolerance: the arm must not visibly straighten after it reaches shoulder level)
- Pace: run-up accelerating, gather, a bound, back-foot contact side-on or mid-way, front arm high and pulled down, braced or
  slightly flexed front leg at front-foot contact, hip-shoulder separation, release with a vertical arm, follow-through across
  the body and off the pitch's danger area, decelerating strides.
- Spin: short approach, pivot on the back foot, side-on, front arm leading toward the target, a slower circular arm with wrist
  or fingers visibly working, short follow-through.

Wicket-keeping
- Squat on the balls of the feet behind the stumps (back to pace: well back; up to spin: just behind the bails), gloves together,
  fingers down, rising with the bounce; sideways shuffles (sidesteps), no crossing feet; soft give on the take.

Fielding
- Ready position: walking in, split-step at release, weight forward, hands ready.
- Ground fielding: long barrier or attacking pick-up; dives launch off one foot, land on hip and forearm, get up in two beats.
- Catching: two hands, fingers up for catches above the chest, fingers down and palms up for low catches; hands give with the
  ball and come to the chest.
- Throwing: side-on, front arm points at the target, crow-hop for long throws, overarm from the posed shoulder; underarm flick
  close in.

## 8. Review rubric (the critic's checklist)

Judge on the 4 m and 1.6 m contact sheets and the real game cameras (batting, bowling, side-on replay, cordon, celebration).
For each item: pass / fail with the frame (species/sequence/phase/camera) as evidence.
1. Silhouette and proportions as in sections 2 and 5 (head height, shoulder/hip ratio, neck, hand and foot sizes).
2. Faces: eyes, brows and mouth readable at 1.6 m; no stretched colours; species features as in section 5.
3. Hands: correct grip; no glove overlap or float (gap <= 1 cm); catching hands apart and shaped; keeper mitts together.
4. Kit: as in section 3; pads don't clip the thigh in lunges; grille clear of the chin; both kits read as the same model.
5. Colour: section 4 contrast rules; nothing plastic; rim light subtle.
6. Motion: every item in section 6 for every sequence; checked at normal speed (motion strips) and frame by frame.
7. Cricket authenticity: every item in section 7 that the sequence shows.
8. Clipping and contact: none visible from any game camera; the automated metrics in tests/charlab agree.

Severity
- Blocker: clipping, floating, flipping, teleporting, sliding or an illegal-looking action visible from a game camera.
- High: anything that looks wrong at normal speed from a game camera (awkward pose, wrong technique, unreadable silhouette).
- Medium: visible on the 4 m sheets or in slow-motion replays.
- Low: only on the 1.6 m sheets.

Stop condition: two consecutive review rounds with no blocker, high or medium findings, all automated gates green, and the full
smoke and balance tests green. Reviewers never review code they wrote in that round; they judge artefacts first and read code
only to locate a cause.

## Sources

- MCC Laws of Cricket, Law 21 (No ball), 21.2 Fair delivery - the arm: https://www.lords.org/mcc/the-laws/no-ball
- ICC regulations on suspected illegal bowling actions (15 degree elbow extension tolerance): https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions
- Batting, keeping, fielding and bowling technique items follow standard coaching practice (stance, grip V, head over the ball,
  long barrier, crow-hop); reviewers apply them as listed above.
