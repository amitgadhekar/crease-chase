"""Builds the shared fielder body: Blender -b --factory-startup --python tools/blender/fielder.py -- --out fielder.glb
   [--render DIR] [--h 0.0035] [--size 512] [--save file.blend]

One athletic body (body.py) at the rig.py lengths for every species (docs/art-style.md section 5: species differ by head,
skin and one feature only): collared short-sleeve shirt with trim bands, cream trousers with a belt, a neck stub (heads are
separate: the Earth head with a face here, the species heads procedural in 07-people.js, rigid on the head bone), cupped
hands with a thumb, white spikes on the foot bones, a team cap on the head bone, and the keeper's kit as separate meshes:
webbed gauntlets (skinned to hand + forearm twist) and shorter pads (shin + thigh).

Textures: ONE material ('fielder') for every mesh. UV islands are packed into REGIONS of a 512^2 atlas; the GLB carries the
detail map (rgb = AO and painted detail multiplying the colour, a = 1 - tint mask: 0 where the trim colour goes, i.e. placket
edges, and eye whites on the skin). The game paints the kit colours per region into a canvas of the same layout
(07-people.js / spApply: skin, shirt, trim, pants, shin, shoe, cap, wkglove, wkpad) and multiplies this detail in:
  colour = mix(trim, canvas.rgb, detail.a) * detail.rgb
REGIONS below is shared with 07-people.js; 'species' is the old 128 px species atlas for procedural heads (not in this GLB).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import bpy  # noqa: E402
import body as B  # noqa: E402
import rig  # noqa: E402
import sdf  # noqa: E402
from body import ARGS, log, P, v3, L, J, smooth01, band, ramp  # noqa: E402
from sdf import ellipsoid, cone, torus, frame, norm  # noqa: E402

B.TAG = 'fielder'
H = float(ARGS.get('h', 0.0035))
SIZE = int(ARGS.get('size', 512))
SLEEVE, WAIST_Y, COLLAR_C, COLLAR_N, COLLAR_W, EYE_X, EYE_Z = B.SLEEVE, B.WAIST_Y, B.ACOLLAR_C, B.ACOLLAR_N, B.COLLAR_W, B.EYE_X, B.EYE_Z

# UV rects (u0, v0, u1, v1) per region, shared with src/game/07-people.js
REGIONS = {'skin': (0, 0, .5, .5), 'shirt': (.5, 0, 1, .4), 'trim': (.5, .4, 1, .5), 'pants': (0, .5, .5, .75), 'shin': (.5, .5, .75, .75),
           'shoe': (.75, .5, 1, .75), 'cap': (0, .75, .25, 1), 'wkglove': (.25, .75, .5, 1), 'wkpad': (.5, .75, .75, 1), 'species': (.75, .75, 1, 1)}
REG_ID = ['skin', 'shirt', 'trim', 'pants', 'shin', 'shoe', 'cap', 'wkglove', 'wkpad']
# preview colours per region for the Blender renders (the game paints its own): Earth AI kit
PREVIEW = {'skin': '#b07a55', 'shirt': '#7a1f2b', 'trim': '#f1ece0', 'pants': '#f1ece0', 'shin': '#f1ece0', 'shoe': '#ffffff', 'cap': '#7a1f2b',
           'wkglove': '#efe9dc', 'wkpad': '#f4f2ee'}
B.MATS.update({'fielder': ((1, 1, 1), 0.8), 'pad': ((1, 1, 1), 0.8)})


# ---------------------------------------------------------------- body
def detail_zone(gv):
    """hands (fingers), shoulders and the neck stub keep more triangles"""
    d = lambda c, r: smooth01(2.2 - 2.2 * np.linalg.norm((gv - c) / r, axis=1))
    w = np.zeros(len(gv))
    for k in ('L', 'R'):
        w = np.maximum(w, d(P('hand_' + k) + P('arm_dir_' + k) * 0.03, v3(0.12, 0.12, 0.12)))
        w = np.maximum(w, 0.7 * d(P('shoulder_' + k) + v3(0, -0.01, 0), v3(0.1, 0.11, 0.09)))
    return np.maximum(w, 0.5 * d(P('neck_top'), v3(0.1, 0.08, 0.1)))


def build_body():
    shapes = B.body_shapes(head=False, hands=True, athletic=True)
    ob = B.sdf_object('body', shapes, None, None, H, int(ARGS.get('tris', 3700)), smooth=3, mats=['fielder'], keep=detail_zone,
                      keepf=float(ARGS.get('keepf', 0.04)))
    near = lambda c, r: (lambda p: np.linalg.norm(p - c) < r)
    collar = lambda p: np.linalg.norm((p - COLLAR_C) - COLLAR_N * ((p - COLLAR_C) @ COLLAR_N)) < 0.12 and abs((p - COLLAR_C) @ COLLAR_N) < 0.06
    torso = lambda p: abs(p[2]) < 0.3 and abs(p[1] - WAIST_Y) < 0.12
    B.bisect(ob, (0, WAIST_Y, 0), (0, 1, 0), torso)
    for d in (-COLLAR_W, COLLAR_W):
        B.bisect(ob, COLLAR_C + COLLAR_N * d, COLLAR_N, collar)
    for k in ('L', 'R'):
        sh, u = P('shoulder_' + k), P('arm_dir_' + k)
        for t in SLEEVE:
            c = sh + u * t
            B.bisect(ob, c, u, near(c, 0.085))
        kn = P('knee_' + k)
        B.bisect(ob, kn + v3(0, -0.02, 0), (0, 1, 0), near(kn, 0.12))
    B.dissolve_degenerate(ob)
    B.triangulate(ob)
    cen = B.face_centres(ob)
    lab = sdf.label_of(shapes, cen)
    reg = np.zeros(len(cen), np.int32)
    for i, (c, l) in enumerate(zip(cen, lab)):
        dc = (c - COLLAR_C) @ COLLAR_N
        radial = np.linalg.norm((c - COLLAR_C) - COLLAR_N * dc)
        if l in ('neck', 'collar') or (l == 'torso' and radial < 0.13 and dc > -0.06):   # the trapezius above the collar is neck skin
            reg[i] = 0 if dc > COLLAR_W else 2 if dc > -COLLAR_W and (l != 'torso' or radial < 0.095) else 1
        elif l == 'torso':
            reg[i] = 3 if c[1] < WAIST_Y else 1
        elif l[:4] in ('uarm', 'cuff', 'farm', 'hand'):
            k = l[-1]
            t = (c - P('shoulder_' + k)) @ P('arm_dir_' + k)
            reg[i] = 1 if t < SLEEVE[0] else 2 if t < SLEEVE[1] else 0
        elif l[:5] == 'thigh':
            reg[i] = 3 if c[1] > P('knee_' + l[-1])[1] - 0.02 else 4
        else:
            reg[i] = 4
    B.shade_smooth(ob)
    log('body: %d tris after region cuts' % B.tris(ob))
    return ob, reg


# ---------------------------------------------------------------- Earth head, cap
def build_head():
    S = []
    add = lambda lab, k, s: S.append((lab, k) + s)
    B.head_shapes(add, 'head')
    add('head', 0.02, cone(P('neck_top') - v3(0, 0.035, 0), P('neck_top') + v3(0.004, 0.012, 0), 0.057, 0.055))   # covers the body's neck stub
    ob = B.sdf_object('head_earth', S, None, None, 0.003, int(ARGS.get('headtris', 820)), smooth=2, mats=['fielder'])
    B.triangulate(ob)
    B.shade_smooth(ob)
    return ob


def build_cap():
    """team cap: a dome over the upper half of the skull and a peak, in the head frame (x lateral, y up, z forward)"""
    dome = B.ell([0, 0.025, -0.008], [0.103, 0.1, 0.118], 20, 6, 0.0, -0.12) + (0,)
    peak = B.ell([0, 0.035, 0.1], [0.08, 0.007, 0.075], 16, 4, 0.12) + (0,)
    button = B.ell([0, 0.126, -0.008], [0.012, 0.006, 0.012], 8, 3) + (0,)
    V, Q, M = B.join_geo(dome, peak, button)
    ob = B.new_object('cap', B.head_frame_pts(V), Q, ['fielder'], outward=True)
    B.merge_close(ob)
    B.triangulate(ob)
    B.shade_smooth(ob)
    return ob


# ---------------------------------------------------------------- shoes (spikes), keeper gauntlets and pads
GAUNT_WRIST = (0.055, 0.06)   # gauntlet -> forearm twist weight along the forearm from the hand centre


def gauntlet_shapes(k):
    """keeper's gauntlet: one cupped mitt round the whole hand (fingers inside), a thumb lobe, webbing between thumb and
    index finger, a padded cuff open toward the forearm"""
    g, a, w, n = B.hand_frame(k)
    F = np.array([a, w, n])
    S = [('wkglove', 0) + ellipsoid(g + a * 0.03 - n * 0.006, [0.125, 0.068, 0.03], F),
         ('wkglove', 0.02) + ellipsoid(g + a * 0.085 - n * 0.025, [0.06, 0.06, 0.028], F),           # cupped finger end
         ('wkglove', 0.012) + cone(g + w * 0.05 - a * 0.005, g + (a * 0.5 + w * 0.85) / 1.0 * 0.07 + w * 0.05 - n * 0.01, 0.018, 0.015),
         ('wkglove', 0.006) + ellipsoid(g + a * 0.045 + w * 0.065 - n * 0.004, [0.04, 0.035, 0.0045], F),   # webbing
         ('wkglove', 0.015) + cone(g - a * 0.055, g - a * 0.13, 0.044, 0.05),
         ('wkglove', -0.004) + cone(g - a * 0.095, g - a * 0.2, 0.036, 0.042)]
    return S


def build_gauntlet(k):
    ob = B.sdf_object('wkglove_' + k, gauntlet_shapes(k), None, None, 0.0025, int(ARGS.get('wkglove', 320)), smooth=2, mats=['fielder'])
    B.triangulate(ob)
    B.shade_smooth(ob)
    return ob


# ---------------------------------------------------------------- atlas painting per region
def paint_skin(p, ao):
    rgb = np.repeat((1 - 0.7 * (1 - ao))[:, None], 3, 1)
    a = np.zeros(len(p))
    q = p - P('head_c')
    for s in (1, -1):
        ec = v3(EYE_X, 0.004, EYE_Z * s)
        e = np.linalg.norm(q - ec, axis=1)
        white = ramp(e, 0.0138, 0.0118)   # softer than the batter's: half the texels per metre
        iris = np.linalg.norm(q - (ec + v3(0.0115, -0.0005, 0)), axis=1)
        ir = ramp(iris, 0.0072, 0.0052)
        a = np.maximum(a, white * (1 - ir))
        eye = (1 - ir * 0.8)[:, None] * v3(1, 0.9, 0.8)[None, :] ** ir[:, None]
        rgb = rgb * (1 - white)[:, None] + white[:, None] * eye
        b = np.linalg.norm((q - v3(0.09, 0.031, 0.031 * s)) / v3(0.02, 0.0055, 0.021), axis=1)
        rgb *= (1 - 0.6 * smooth01((1.1 - b) / 0.3))[:, None]
        nos = np.linalg.norm(q - v3(0.108, -0.031, 0.011 * s), axis=1)
        rgb *= (1 - 0.5 * ramp(nos, 0.006, 0.003))[:, None]
    m = np.linalg.norm((q - v3(0.1, -0.06, 0)) / v3(0.014, 0.0115, 0.021), axis=1)
    lip = smooth01((1.05 - m) / 0.25)
    rgb *= 1 - lip[:, None] * v3(0.1, 0.3, 0.3)[None, :]
    rgb *= (1 - 0.6 * band(q[:, 1] + 0.06, 0.0008, 0.0008) * (np.abs(q[:, 2]) < 0.018) * (q[:, 0] > 0.095))[:, None]
    # hair: a darker band below the cap line round the back and sides of the head
    hair = ramp(q[:, 1], 0.0, 0.03) * ramp(-q[:, 1], -0.085, -0.075) * ramp(-q[:, 0], -0.02, 0.01) * (np.linalg.norm(q, axis=1) < 0.14)
    rgb *= (1 - 0.72 * hair)[:, None]
    for k in ('L', 'R'):   # knuckle and finger creases
        g, ad, w, n = B.hand_frame(k)
        qq = p - g
        here = np.linalg.norm(qq, axis=1) < 0.14
        t = qq @ ad
        rgb *= (1 - 0.18 * here * (band(t - 0.036, 0.0012, 0.001) + band(t - 0.072, 0.0012, 0.001)) * (qq @ n > 0))[:, None]
    return rgb, a


def paint_shirt(p, ao):
    rgb = np.repeat((1 - 0.62 * (1 - ao))[:, None], 3, 1) * B.weave(p, 1400, 0.045)[:, None]
    a = np.zeros(len(p))
    y = p[:, 1] - P('shoulders')[1]
    front = p[:, 0] > 0.04
    seam = band(np.abs(p[:, 2]) - 0.017, 0.0012, 0.001) * front * (y < -0.02) * (y > -0.16)
    rgb *= (1 - 0.3 * seam)[:, None]
    a = np.maximum(a, band(np.abs(p[:, 2]) - 0.017, 0.0025, 0.001) * front * (y < -0.02) * (y > -0.16))   # placket edge in trim
    for by in (-0.055, -0.095, -0.135):
        rgb *= (1 - 0.55 * ramp(np.hypot(p[:, 2], y - by), 0.0048, 0.0036) * front)[:, None]
    for k in ('L', 'R'):
        sj, u = P('shoulder_' + k), P('arm_dir_' + k)
        t = (p - sj) @ u
        rgb *= (1 - 0.22 * band(t - 0.02, 0.0012, 0.001) * (np.linalg.norm(p - sj, axis=1) < 0.09))[:, None]
    rgb *= (1 - 0.18 * band(p[:, 0] + 0.02, 0.0012, 0.001) * (np.abs(p[:, 2]) > 0.12) * (y < -0.1) * (y > -0.42))[:, None]
    rgb *= (1 - 0.25 * band(p[:, 1] - WAIST_Y - 0.004, 0.003, 0.002))[:, None]
    return rgb, a


def paint_plain(s):
    return lambda p, ao: (np.repeat((1 - s * (1 - ao))[:, None], 3, 1), np.zeros(len(p)))


def paint_pants(p, ao):
    rgb = np.repeat((1 - 0.68 * (1 - ao))[:, None], 3, 1) * v3(0.97, 0.95, 0.89)[None, :] * B.weave(p, 1100, 0.03)[:, None]
    belt = ramp(p[:, 1], WAIST_Y - 0.004, WAIST_Y - 0.008) * ramp(-p[:, 1], -(WAIST_Y - 0.03), -(WAIST_Y - 0.026))
    rgb *= (1 - belt * 0.72)[:, None]
    buckle = belt * ramp(np.abs(p[:, 2]), 0.016, 0.012) * (p[:, 0] > 0.03)
    rgb = rgb * (1 - buckle[:, None]) + buckle[:, None] * v3(0.55, 0.55, 0.5)[None, :] * (1 - 0.3 * (1 - ao))[:, None]
    return creases(p, rgb), np.zeros(len(p))


def creases(p, rgb):
    for k in ('L', 'R'):
        for jn, jo in (('hipj_', 'knee_'), ('knee_', 'ankle_')):
            a, b = P(jn + k), P(jo + k)
            u = norm(b - a)
            t = (p - a) @ u
            on = (t > 0.04) & (t < np.linalg.norm(b - a) - 0.03) & (p[:, 0] > a[0] + 0.02)
            d = (p - a) - np.outer(t, u)
            z = d @ v3(0, 0, 1)
            rgb *= (1 - 0.12 * on * (band(z - 0.003, 0.0012, 0.001) + band(z + 0.003, 0.0012, 0.001)))[:, None]
    return rgb


def paint_shin(p, ao):
    rgb = np.repeat((1 - 0.68 * (1 - ao))[:, None], 3, 1) * v3(0.97, 0.95, 0.89)[None, :] * B.weave(p, 1100, 0.03)[:, None]
    for k in ('L', 'R'):   # gathered over the shoe: a darker fold line
        an = P('ankle_' + k)
        rgb *= (1 - 0.2 * band(p[:, 1] - an[1] - 0.04, 0.003, 0.002) * (np.linalg.norm(p - an, axis=1) < 0.12))[:, None]
    return creases(p, rgb), np.zeros(len(p))


def paint_shoe(p, ao):
    rgb = np.repeat((1 - 0.5 * (1 - ao))[:, None], 3, 1)
    for k in ('L', 'R'):
        an = P('ankle_' + k)
        q = p - an
        here = np.linalg.norm(q, axis=1) < 0.3
        y = q[:, 1] + L['ankle_h']
        sole = ramp(y, 0.016, 0.012) * here
        rgb = rgb * (1 - sole[:, None]) + sole[:, None] * v3(0.3, 0.3, 0.32)[None, :]
        rgb *= (1 - 0.35 * band(y - 0.019, 0.002, 0.0015) * here)[:, None]
        under = ramp(y, 0.004, 0.001) * here
        for sx, sz in ((0.09, 0.02), (0.09, -0.02), (0.125, 0.0), (0.02, 0.025), (0.02, -0.025), (-0.06, 0.0)):
            sp = ramp(np.hypot(q[:, 0] - sx, q[:, 2] - sz), 0.0062, 0.0048) * under
            rgb = rgb * (1 - sp[:, None]) + sp[:, None] * v3(0.85, 0.85, 0.85)[None, :]
        lace = here * (q[:, 0] > 0.0) * (q[:, 0] < 0.085) * (np.abs(q[:, 2]) < 0.028) * (y > 0.055)
        rgb *= (1 - 0.18 * lace * (0.5 + 0.5 * np.sin((q[:, 0] + q[:, 2]) * 400)) - 0.12 * lace)[:, None]
        rgb *= (1 - 0.3 * band(q[:, 0] - 0.08, 0.0015, 0.001) * here * (y > 0.03) * (y < 0.08))[:, None]
    return rgb, np.zeros(len(p))


def paint_cap(p, ao):
    rgb = np.repeat((1 - 0.55 * (1 - ao))[:, None], 3, 1)
    q = p - P('head_c')
    hx, hy, hz = -q[:, 2], q[:, 1], q[:, 0]
    for ang in (0.0, math.pi / 3, 2 * math.pi / 3):   # six-panel seams over the dome
        d = hx * math.cos(ang) + hz * math.sin(ang)
        rgb *= (1 - 0.25 * band(d, 0.0012, 0.001) * (hy > 0.045))[:, None]
    rgb *= (1 - 0.35 * ramp(-hy, -0.04, -0.03) * (hz > 0.06))[:, None]   # peak underside darker
    return rgb, np.zeros(len(p))


def paint_wkglove(p, ao):
    rgb = np.repeat((1 - 0.6 * (1 - ao))[:, None], 3, 1)
    a = np.zeros(len(p))
    for k in ('L', 'R'):
        g, ad, w, n = B.hand_frame(k)
        q = p - g
        here = np.linalg.norm(q, axis=1) < 0.25
        t, x, back = q @ ad, q @ w, q @ n
        palm = here * (back < 0.0)
        for fx in (-0.034, -0.011, 0.011, 0.034):   # finger seams on the palm side, from the knuckles out
            rgb *= (1 - 0.35 * band(x - fx, 0.0013, 0.001) * palm * (t > 0.04))[:, None]
        rgb *= (1 - 0.3 * band(t - 0.04, 0.0015, 0.001) * palm)[:, None]
        web = here * (x > 0.04) * (t > 0.01) * (t < 0.08) * (np.abs(back) < 0.012)
        rgb *= (1 - 0.3 * web * (0.5 + 0.5 * np.sin(x * 500)))[:, None]
        cuff = ramp(-t, 0.09, 0.1) * here
        a = np.maximum(a, cuff * ramp(-t, 0.1, 0.11))
        rgb *= (1 - 0.25 * band(-t - 0.095, 0.0015, 0.001) * here)[:, None]
    return rgb, a


PAINT = {'skin': paint_skin, 'shirt': paint_shirt, 'trim': paint_plain(0.6), 'pants': paint_pants, 'shin': paint_shin, 'shoe': paint_shoe,
         'cap': paint_cap, 'wkglove': paint_wkglove, 'wkpad': lambda p, ao: B.paint_pad(p, ao, straps=(-0.14, 0.04))}


def paint_atlas(pos, rid, ao):
    rgb = np.ones(pos.shape, np.float32)
    alpha = np.zeros(rid.shape, np.float32)
    for i, name in enumerate(REG_ID):
        m = rid == i
        if not m.any():
            continue
        r, a = PAINT[name](pos[m].astype(float), ao[m].astype(float))
        rgb[m] = np.clip(r, 0, 1)
        alpha[m] = np.clip(a, 0, 1)
        log('painted %-8s %6d texels' % (name, m.sum()))
    return rgb, alpha


def preview_atlas(rid, rgb_lin, tint_mask, cov, path):
    """what the game will show for the Earth AI kit: region colours x detail, trim where the mask says"""
    col = np.ones(rgb_lin.shape, np.float32)
    for i, name in enumerate(REG_ID):
        col[rid == i] = B.to_lin(B.srgb(PREVIEW[name]))
    trim = np.array(B.to_lin(B.srgb(PREVIEW['trim'])), np.float32)
    col = col * (1 - tint_mask)[..., None] + trim[None, None, :] * tint_mask[..., None]
    rgba = np.concatenate([B.encode_srgb(B.dilate(col * rgb_lin, cov)), np.ones(rid.shape + (1,), np.float32)], 2)
    B.write_png(path, np.round(rgba * 255).astype(np.uint8))
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'sRGB'
    return img


# ---------------------------------------------------------------- main
def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    arm = rig.build_armature('rig')
    body, reg_body = build_body()
    B.auto_skin(body, arm)
    head, cap = build_head(), build_cap()
    rigid = [(head, 'head'), (cap, 'head')]
    skinned = []
    for k in ('L', 'R'):
        rigid.append((B.build_shoe(k, 'fielder', 260), 'foot_' + k))
        gl = build_gauntlet(k)
        g, u = P('hand_' + k), P('arm_dir_' + k)
        B.skin_to(gl, arm, 'hand_' + k, 'farm_tw_' + k, smooth01(((g - B.game_verts(gl)) @ u - GAUNT_WRIST[0]) / GAUNT_WRIST[1]))
        pd = B.build_pad(k, bottom=-0.24, top=0.22, name='wkpad', segs=(20, 6))
        B.skin_pad(pd, arm, k)
        for ob in (gl, pd):
            ob.data.materials.clear()
            ob.data.materials.append(B.material('fielder'))
        skinned += [gl, pd]
    for ob, b in rigid:
        B.parent_to_bone(ob, arm, b)
    objs = [body] + [o for o, _ in rigid] + skinned
    rects = {i: REGIONS[n] for i, n in enumerate(REG_ID)}
    entries = []
    for ob in objs:
        B.unwrap(ob)
        nf = len(ob.data.polygons)
        if ob is body:
            reg = reg_body
        else:
            nm = ob.name.split('_')[0]
            reg = np.full(nf, REG_ID.index({'head': 'skin', 'cap': 'cap', 'shoe': 'shoe', 'wkglove': 'wkglove', 'wkpad': 'wkpad'}[nm]), np.int32)
        entries.append((ob, reg, rects, 2.2 if ob is head else 1.0))   # the face gets 2.2x the texels per metre
    data = B.layout_atlas(entries, SIZE, margin_px=2)
    pos, rid, oid, nrm, cov = B.rasterise(data, SIZE)
    plain = [o for o in objs if o not in skinned]   # the keeper's kit must not darken the body's forearms and shins
    ao = B.bake_ao(objs, SIZE, samples=int(ARGS.get('aos', 32)), groups=[(plain, plain), (skinned, objs)])
    rgb, alpha = paint_atlas(pos, rid, ao)
    out = ARGS.get('out') or os.path.join(__import__('tempfile').gettempdir(), 'fielder.glb')   # the atlas PNGs go next to the GLB
    base = os.path.splitext(out)[0]
    B.finish_atlas(rgb, alpha, cov, base + '-atlas.png')
    B.report(objs)
    log('bones %d' % len(arm.data.bones))
    if 'out' in ARGS:
        B.export(ARGS['out'], arm, objs, quality=int(ARGS.get('q', 76)))
    if 'save' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=ARGS['save'])
    if 'render' in ARGS:
        prev = preview_atlas(rid, rgb, B.dilate(alpha, cov), cov, base + '-preview.png')
        for m in B._mats.values():
            for nd in m.node_tree.nodes:
                if nd.type == 'TEX_IMAGE':
                    nd.image = prev
        for o in skinned:   # keeper kit shown in its own renders only
            o.hide_render = o.name.startswith('wk')
        poses = {'relaxed': B.arm_pose(70, 12)}
        close = [('face', 1.2, 'head@0.4'), ('hands', 1.1, 'hand_L@0.2'), ('feet', 1.5, 'foot_L@0.2')]
        B.render_poses(arm, poses, ARGS['render'], close=close)
        for o in skinned:
            o.hide_render = False
        B.render_poses(arm, {'keeper': B.arm_pose(70, 12)}, os.path.join(ARGS['render'], 'keeper'), rest_views=[], close=[('hands', 1.1, 'hand_L@0.2'), ('pads', 1.6, 'shin_L@0.5')])


if __name__ == '__main__':
    main()
