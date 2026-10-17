# Round 0 review, lens: art (models and look)

Run: tests/charlab/out/baseline-20261016 (142 sequences, dist/lab.html 1579 KB). Judged against docs/art-style.md sections 1-5
and rubric items 1-5 and 8. Frames are shots/<sequence>__<planet>__<kit>__<phase>__<camera>.png; sheets/_<group>__<camera>.png
are the montages. No Blender turntables exist in this run (tools/blender has no render output), so the batter was judged from
the lab cameras only.

## Verdict

Not shippable. The batter is the only character that reads as a cricketer, and even he fails the kit language (crew-neck
long-sleeve shirt, no placket, collar, number or belt), has marshmallow pads without a knee roll or straps, blob gloves and
slipper shoes, and a shirt that reads as plastic in the side-on replay. Every fielder, bowler and keeper is still the old
capsule mannequin: no shoulders, neck taper, elbows, knees, fingers or face; the keeper has no gauntlets or pads; the bowler
bowls in a cap; the eight species have eight different bodies (Moon ~2.2 m stick, Jupiter a squat tank) instead of one athletic
body with a species head; Earth's "you" kit wears the AI team's sleeves; and on six planets the lit side faces away from every
close camera, so faces are black silhouettes and the batter is a black cut-out in the T20 bowling view. Kit-vs-grass contrast
fails on Saturn and Neptune. A player of a polished mobile sports game would not accept the fielding side at all, and would
notice the batter's kit in the first replay.

## Findings (most severe first)

### Blocker

B1 (people) Keeper's hands pass through each other on the take. fld-keeper__neptune__ai take f16/f4 and
fld-keeper__saturn__ai take f16: both forearms cross at the chest and overlap by most of a hand; fld-keeper__mars__ai take:
both arms straight up to full length, hands touching. Right: gloves together, fingers down, elbows soft, hands 2 radii apart
(thresholds hand-hand). Visible from the bowling view at every take.

### High

H1 (assets) Fielders, bowler and keeper are capsule mannequins, not athletes. lineup__earth__ai idle f4/s4/f16,
bowl-pace__earth__ai release f4/f16, fld-ring-catch__earth__ai catch f4, fld-stop-throw__earth__ai release f4: shoulder width
equals hip width, no deltoids or trapezius, a straight cylinder neck, arms and legs are constant-radius tubes with no elbow or
knee, hands are rounded nubs with no fingers or thumb, the torso is a flat pill, shoes are black ovals. Section 2 (shoulders
1.45x hips, visible joints, hands .19 m) and section 3 (white spikes with a sole line) fail from the batting view (ring
fielders 20-30 m) and every replay. Right: the shared fielder body planned in docs/characters.md (fielder.glb).

H2 (assets) Species have different bodies. lineup sheet f4/s4: Moon is ~2.2 m, spindly, with blue blade-shaped hands;
Jupiter is ~1.5 m with shoulders twice the hip width and club forearms; Mercury broad; Mars, Saturn and Neptune tall and thin.
Section 5: same height (+-3%), same limbs, same kit; the alien is in the head, skin and one feature. Also the fallback kit is
not shared: Neptune has glossy luminous blue shins and shoes (lineup__neptune__ai b4, fld-keeper__neptune__ai take f4),
Venus two-tone khaki legs (lineup__venus__ai b4), Moon blue forearms over a white torso (bowl-pace__moon__ai release f4).
Right: cream trousers, white shoes, team shirt on every species; skin only on head, neck, forearms and hands.

H3 (people) Earth "you" kit wears the AI team's sleeves. lineup__earth__you idle f16/f4: teal shirt, maroon forearm sleeves.
Cause: 07-people.js line 9-10, `sleeve:1` paints the forearm from species swatch 0, which is baked from
`PLANETS.earth.vis.kit.shirt` (the AI maroon) at atlas build time, so `spApply('earth', KIT.you)` never recolours it. Seen in
every T20 first innings (your fielders are Earth humans in KIT.you). Right: sleeve from the live kit colour.

H4 (assets) Front faces and kit are black on six planets. lineup f16 sheet and fielding f16 sheet: Moon, Mercury, Venus
(partly), Mars, Saturn and Neptune bodies render as near-black silhouettes with the sun behind them; bowl-pace__jupiter__ai
release gbowl and fld-keeper__jupiter__ai squat gbowl: the batter in the planet kit is a black cut-out 25 m away in the game's
own bowling view. Section 1: one light model, nothing may look pasted on; section 2 of the rubric: faces readable at 1.6 m.
The env (sky) light on these planets does not fill the shadow side (LOOK3D env/exp per planet, 07-render3d). Right: shadow
side at >= 25-30% of the lit side so the shirt colour and face still read; the batting view already has this on Earth.

H5 (assets) Kit vs grass contrast fails on Saturn and Neptune; Venus is marginal. Sampled from the lineup b4 shots (shirt
centre vs outfield; approximate, the back of the shirt is in half shade): Saturn olive-green shirt (#3d6b4f) on olive turf,
dL ~19, dH ~25 deg (needs dL >= 20 or dH >= 60); Neptune navy (#1b3f8f) on teal turf, dL ~15, dH ~12; Venus purple on brown,
dL ~9, dH small. lineup__saturn__ai b4 and lineup__neptune__ai b4 show a fielder that merges into the ground at 4 m; at 30 m
(fielding w10 sheet, fld-ring-catch__saturn__ai, fld-stop-throw__neptune__ai) only the shadow gives him away. Right: shift
these team mains (or the trim) to clear the rule; Saturn toward gold/cream, Neptune toward white or orange trim.

H6 (assets) Keeper kit missing. fld-keeper__earth__ai squat f4/g16, fld-keeper-spin__earth__ai squat f4: bare nub hands,
no gauntlets, no pads, same cap up to the stumps (section 3: webbed gauntlets, shorter pads, helmet up to spin). The keeper
is drawn at 2-4 m in the cordon camera and in every bowling-view take, so this is seen every over of the T20 first innings.

H7 (assets) Bowler bowls in a cap, long sleeves. bowl-pace__earth__ai release f4/f16 and bowl-spin: cap on at release,
long-sleeved shirt (section 3: capless, short sleeves for fielders and bowlers). The fielders are all long-sleeved too
(lineup__earth__ai idle f16).

### Medium

M1 (assets) Batter shirt is not the kit language. bat-stance__earth__ai stance f16/g16, ns-walk__earth__ai backing f16:
crew-neck long-sleeve shirt with a yellow band at the neck and cuffs, no collar, placket, sleeve trim band, back number
(bat-stance b4) or belt; the hem is a straight seam with no step. Visible in every side-on replay at 4 m.

M2 (assets) Batter shirt reads as plastic. bat-cover__earth__ai impact g16 (crop): a broad white specular band along the
back and shoulder; bat-stance f16: the same on the shoulder. kit() shirt roughness is .88 in 07-skin.js, so the sheen comes
from the rim term (RIM at full strength on cloth) and the vertex-colour AO. Section 1: cloth rim .4 of today's, pads .6.
Helmet gloss (.22) is right.

M3 (assets) Pads are quilted tubes. bat-stance__earth__ai stance s4/l16, ns-walk__earth__ai backing l16, bat-cover impact
gside: deep bulbous vertical ribs the full height, no knee roll, no inner wing, no straps on the back (bat-stance b4 shows a
plain white back). Pads and trousers are the same white (pads .95 vs trousers cream .88 asked; Earth pants '#f1ece0' renders
white under the tone map). Right: satin, shallow ribs, a knee roll at the knee, three straps behind the calf, cream trousers.

M4 (assets) Batting gloves are blobs. bat-stance__earth__ai stance g16 (crop), bat-cover impact g16: fingers merge into a
lumpy mass with vertical ridges, no padding bars, no cuff in the team colour. The grip itself is right (top hand's back to
the bowler, hands together near the top). Glove-to-handle gap is fine.

M5 (assets) Shoes are small flat slippers. bat-stance__earth__ai stance l16 (crop), ns-walk backing l16: the back shoe is a
grey sliver with a white toe, no sole line, no lace band, the pad reaches the ground over it; the front shoe is .22-.24 m by
eye against the .43 m shin. Section 2: shoe .29-.30 m, visible sole line, darker sole.

M6 (assets) Earth fielder face is not a face. lineup__earth__ai idle f16 (crop), fld-keeper__earth__ai squat f16: a smooth
sphere, a flat polygonal nose wedge, no eyes under the peak, no mouth, no ears; the cap is a flat disc with a detached pink
peak that sits above the head rather than on it. At 1.6 m nothing is readable (rubric 2).

M7 (assets) Species heads differ from the section 5 brief. Venus (lineup__venus__ai f16, fld-keeper__venus__ai squat f16):
six red spikes radiating sideways from an olive-yellow head with a snout; the brief is soft teal with lilac mottling, two
pairs of feathery gill fronds. Mercury (lineup__mercury__ai f16): black head with an orange visor, glowing cracks run down the
forearms and hands (the brief puts the ember skin on the head and the glow on the crest only; emissive <= 15% of the head).
Saturn (lineup__saturn__ai f16): eyes are two dark dots on an unlit egg; nothing else reads. Mars, Moon and Jupiter match
the brief in silhouette. Neptune's glow spots and fins match, but the glowing wrist strips and shins do not.

M8 (harness) The 1.6 m face camera is on the dark side. cameras.json f16 is az 15 from the subject's facing; in the lineup
and keeper sequences the subject faces away from the sun on every planet but Earth, so the face sheets are silhouettes and
rubric 2 cannot be judged. Fix with a lit-side variant (az chosen toward LOOK3D's sun azimuth) or by turning the lineup
subject to face the batter as fielders do in play. H4 is still real in the game's bowling view; this item is about the
sheets.

M9 (harness) No colour gate. The run has no automated check of section 4 (skin vs shirt L*, shirt vs grass L*/hue, trim vs
shirt). Add one that samples the rendered kit and outfield (mean of a shirt rect and a ground rect under the same light),
so H5 cannot regress silently.

M10 (people) Catching hands are two nubs with the ball between them. fld-ring-catch__earth__ai catch f4,
fld-deep-catch__earth__ai catch gchase: straight tube arms, hands a ball's width apart, no finger shape; the throw release
(fld-stop-throw__earth__ai release f4) is a two-handed overhead throw-in. Hands shaped by `hands2` only make sense once the
hands have fingers (H1).

### Low

L1 (assets) Batter face. ns-walk__earth__ai backing f16: eyes read as two dark marks, the brows and mouth do not; the face
is a smooth mannequin with a nose. Only the 1.6 m camera sees it.

L2 (assets) Helmet peak and grille. bat-stance__earth__ai stance f16: the grille is clear of the chin (good), but the
helmet's lower edge is a hard cut over the ear with no ear or neck guard, and the dome has one sharp specular dot that reads
as plastic at 1.6 m.

L3 (harness) Lineup sheets have no non-Earth "you" fielders in play sequences and no Blender turntables; the fielding
sheets show only the AI kit. Add the "you" kit to one fielding sequence per planet once H3 is fixed.

## Passes (for the record)

- Batter proportions at 4 m (bat-stance f4/s4): shoulders wider than hips, arms clear of the torso, S-curve in the side view,
  helmet sits on the head. The stance, backlift and cover-drive finish read as cricket at the batting-view distance.
- Non-striker is the batter's clone and reads as the same model (ns-walk backing f4).
- Grip (top hand's back to the bowler, hands together) and the bat in the gloves (no float at g16).
- Earth kit colours (maroon vs teal) read against the grass and against each other.

## Automated gates seen (not this lens, noted for the round log)

7868 red of 19468: pen 2141, slip 1633, teleport 1480; gcel 356 draw calls / 525k tris; gbat 161 draw calls; batter.glb has
no twist bones (rig v1).
