"""Builds the skinned batter: Blender -b --factory-startup --python tools/blender/batter.py -- --out batter.glb
   [--render DIR] [--poses poses.json] [--h 0.0035] [--size 1024] [--save file.blend]

Body: the shared athletic body (body.py) with the head, cut into kit regions (shirt, collar trim, sleeve trim, trousers,
skin) by plane bisects, skinned to the rig.py skeleton (rig v2). Kit is separate meshes: helmet with grille and shoes rigid
on a bone, gloves (gripping the handle) skinned to hand + forearm twist, pads skinned to shin + thigh; placement matches the
procedural batter in 07-render3d.js (same frames and profiles). One 1024^2 atlas for every mesh: ambient occlusion baked
with every object visible, then the kit language painted from texel positions: face (eye whites, irises, brows, lips),
polo placket with buttons, shoulder and side seams, a faint weave, the back number, belt and buckle, trouser creases, pad
ribs, knee roll and straps, glove finger grooves and padding bars with a team-colour cuff, shoe sole, lace band and spikes,
helmet vents. The game applies kit colours per material name and mixes the tint colour where the atlas alpha says so.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import bpy  # noqa: E402
import bmesh  # noqa: E402
import body as B  # noqa: E402
import rig  # noqa: E402
import sdf  # noqa: E402
from body import ARGS, log, P, v3, L, J, smooth01, band, ramp  # noqa: E402
from sdf import ellipsoid, cone, torus, box, frame, norm  # noqa: E402

B.TAG = 'batter'
H = float(ARGS.get('h', 0.0035))
SIZE = int(ARGS.get('size', 1024))
NUMBER = ARGS.get('number', '7')
SLEEVE, WAIST_Y, COLLAR_C, COLLAR_N, COLLAR_W, EYE_X, EYE_Z = B.SLEEVE, B.WAIST_Y, B.COLLAR_C, B.COLLAR_N, B.COLLAR_W, B.EYE_X, B.EYE_Z

# Kit colours (KIT.you in 01-core.js) and tints are applied by the game per material name; these are for the Blender renders.
B.MATS.update({'skin': ((0.69, 0.48, 0.33), 0.65, (0.91, 0.89, 0.86)), 'shirt': (B.srgb('#12606e'), 0.86, B.srgb('#f2b134')),
               'trim': (B.srgb('#f2b134'), 0.86), 'pants': (B.srgb('#e9edf0'), 0.88), 'helmet': (B.srgb('#15324d'), 0.3),
               'grille': ((0.34, 0.36, 0.4), 0.35), 'pad': ((0.95, 0.95, 0.93), 0.58), 'glove': ((0.96, 0.96, 0.96), 0.6, B.srgb('#f2b134')),
               'shoe': ((1, 1, 1), 0.55)})
MAT_ID = ['skin', 'shirt', 'trim', 'pants', 'helmet', 'grille', 'pad', 'glove', 'shoe']


# ---------------------------------------------------------------- body
def detail_zone(gv):
    """face, shoulders, deltoids and upper chest: seen up close in replays and curved, so decimation keeps them denser"""
    d = lambda c, r: smooth01(2.2 - 2.2 * np.linalg.norm((gv - c) / r, axis=1))
    w = d(P('head_c') + v3(0.075, -0.035, 0), v3(0.07, 0.1, 0.1))
    for k in ('L', 'R'):
        w = np.maximum(w, d(P('shoulder_' + k) + v3(0, -0.01, 0), v3(0.1, 0.11, 0.09)))
    return np.maximum(w, 0.6 * d(P('shoulders') + v3(0.03, -0.07, 0), v3(0.1, 0.09, 0.17)))


def build_body():
    shapes = B.body_shapes(head=True, hands=False)
    ob = B.sdf_object('body', shapes, [-0.24, -0.02, -0.72], [0.26, 1.9, 0.72], H, int(ARGS.get('tris', 5600)), smooth=3,
                      mats=['skin', 'shirt', 'trim', 'pants'], keep=detail_zone, keepf=float(ARGS.get('keepf', 0.04)))
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
    B.dissolve_degenerate(ob)
    B.triangulate(ob)
    me = ob.data
    cen = B.face_centres(ob)
    lab = sdf.label_of(shapes, cen)
    idx = np.zeros(len(cen), np.int32)   # 0 skin, 1 shirt, 2 trim, 3 trousers
    for i, (c, l) in enumerate(zip(cen, lab)):
        dc = (c - COLLAR_C) @ COLLAR_N
        radial = np.linalg.norm((c - COLLAR_C) - COLLAR_N * dc)
        if l == 'head':
            idx[i] = 0
        elif l in ('neck', 'collar') or (l == 'torso' and radial < 0.12 and abs(dc) < 0.06):
            idx[i] = 0 if dc > COLLAR_W else 2 if dc > -COLLAR_W and (l != 'torso' or radial < 0.095) else 1
        elif l == 'torso':
            idx[i] = 3 if c[1] < WAIST_Y else 1
        elif l[:4] in ('uarm', 'cuff', 'farm', 'hand'):
            k = l[-1]
            t = (c - P('shoulder_' + k)) @ P('arm_dir_' + k)
            idx[i] = 1 if t < SLEEVE[0] else 2 if t < SLEEVE[1] else 0
        else:
            idx[i] = 3
    me.polygons.foreach_set('material_index', idx)
    me.update()
    B.shade_smooth(ob)
    log('body: %d tris after region cuts' % B.tris(ob))
    return ob


# ---------------------------------------------------------------- gloves (the batting grip, as GA in 07-render3d.js batJoints)
GRIP_A = math.radians(-30)
HANDLE_R = 0.017   # bat handle radius (capG(.017, ...) in 07-render3d.js)
GLOVE_WRIST = (-0.005, 0.06)   # glove -> forearm twist weight along the forearm from the grip: the palm bends, the cuff follows the arm
FINGERS = (-0.034, -0.0115, 0.0115, 0.034)


def glove_frame(k):
    """hand point g, forearm u, handle e1 (toward the blade), back of the hand e2, and c: the hand's length direction
    across the handle. The hand bone's rest ref is the bat axis x; the game turns the bone so e1 lies on the handle."""
    g, u, x = P('hand_' + k), P('arm_dir_' + k), v3(1, 0, 0)
    e1 = math.cos(GRIP_A) * u + math.sin(GRIP_A) * x
    e2 = np.cross(u, x) * (-1 if k == 'L' else 1)   # left glove on the left hand: game coordinates are left-handed
    return g, u, e1, e2, norm(u - e1 * (u @ e1))


def glove_shapes(k):
    """batting glove gripping the handle: fingers curled round it as padded phalanx rolls, a wrapped thumb, a padded back
    and a cuff around the forearm. Angles go round the handle from c (0) toward the back of the hand e2 (90 deg)."""
    g, u, e1, e2, c = glove_frame(k)
    at = lambda a, th, r: g + e1 * a + (c * math.cos(math.radians(th)) + e2 * math.sin(math.radians(th))) * r
    S = [('glove', 0) + ellipsoid(g + e2 * (HANDLE_R + 0.006) - c * 0.028, [0.047, 0.019, 0.05], np.array([e1, e2, c]))]
    for a, r, th in zip(FINGERS, (0.011, 0.0118, 0.012, 0.0115), ((82, 10, -78, -150), (84, 10, -82, -160), (84, 10, -84, -164), (84, 10, -82, -160))):
        R = HANDLE_R + r + 0.001
        pts = [at(a, t, R + (0.003 if t > 60 else 0)) for t in th]
        for p0, p1 in zip(pts, pts[1:]):
            S.append(('glove', 0.0025) + cone(p0, p1, r, r * 0.94))
    for a in (-0.023, 0.0, 0.023):   # padded bars on the back of the hand
        S.append(('glove', 0.005) + cone(at(a, 100, HANDLE_R + 0.022) - c * 0.012, at(a, 120, HANDLE_R + 0.022) - c * 0.042, 0.009, 0.009))
    tb = [g + e1 * 0.016 + e2 * 0.012 - c * 0.04, at(0.042, 190, HANDLE_R + 0.02), at(0.05, 240, HANDLE_R + 0.013)]
    S.append(('glove', 0.006) + cone(tb[0], tb[1], 0.0145, 0.0125))
    S.append(('glove', 0.003) + cone(tb[1], tb[2], 0.0125, 0.011))
    S.append(('glove', 0.018) + cone(g - u * 0.072, g - u * 0.15, 0.041, 0.047))
    S.append(('glove', 0.004) + torus(g - u * 0.147, u, 0.046, 0.006))
    S.append(('glove', -0.004) + cone(g - u * 0.11, g - u * 0.2, 0.033, 0.039))   # open cuff: the forearm goes in, no seam
    return S


def build_glove(k):
    g = P('hand_' + k)
    ob = B.sdf_object('glove_' + k, glove_shapes(k), None, None, 0.002, int(ARGS.get('glove', 650)), smooth=2, mats=['glove'])
    B.triangulate(ob)
    B.shade_smooth(ob)
    return ob


# ---------------------------------------------------------------- shoes
# ---------------------------------------------------------------- helmet
def build_helmet():
    """helmet shell, peak, neck guard (the dome runs lower at the back), ear pieces and grille in the head frame of
    07-render3d.js (x lateral, y up, z forward, origin at the head centre)"""
    H2 = math.pi / 2
    sm = lambda u: u * u * (3 - 2 * u)

    def dome(v, a):
        s = math.sin(a)
        lb = -0.85 + sm(min(1, max(0, (s + 0.35) / 1.1))) * 1.05
        l = lb + (H2 - lb) * v
        c = math.cos(l)
        return (0.132 * c * math.cos(a), 0.015 + 0.14 * math.sin(l), -0.005 + (0.142 if s > 0 else 0.152) * c * s)
    shell = B.surf(B.lin(7, 0, 1), B.lin(22, 0, 2 * math.pi)[:-1], dome)
    parts = [B.ell([0, 0.04, 0.09], [0.128, 0.012, 0.1], 18, 5, 0.18) + (0,),
             B.ell([0.124, -0.01, 0.07], [0.012, 0.03, 0.034], 12, 5) + (0,),
             B.ell([-0.124, -0.01, 0.07], [0.012, 0.03, 0.034], 12, 5) + (0,)]
    bar = lambda y, R, sp: B.arc([0, y, 0], R, [1, 0, 0], [0, 0, 1], H2 - sp, H2 + sp, 0.0055, 12) + (1,)
    vb = lambda th: B.arc([0, -0.03, 0], 0.162, [0, 1, 0], [math.sin(th), 0, math.cos(th)], 1.2, 2.25, 0.0055, 7) + (1,)
    parts += [bar(-0.005, 0.158, 1), bar(-0.055, 0.156, 0.95), bar(-0.1, 0.142, 0.85), vb(0), vb(0.42), vb(-0.42)]
    sh = B.new_object('helmet_shell', B.head_frame_pts(shell[0]), shell[1], ['helmet'], outward=True)
    B.merge_close(sh)
    B.apply_mod(sh, 'SOLIDIFY', thickness=0.007, offset=-1, use_rim=True)
    V, Q, M = B.join_geo(*parts)
    ob = B.new_object('helmet', B.head_frame_pts(V), Q, ['helmet', 'grille'], M, outward=True)
    B.merge_close(ob)
    B.join(ob, [sh])
    B.triangulate(ob)
    B.shade_smooth(ob)
    return ob


# ---------------------------------------------------------------- atlas painting (per material; p = texel game positions)
def paint_skin(p, ao):
    rgb = np.repeat((1 - 0.7 * (1 - ao))[:, None], 3, 1)
    a = np.zeros(len(p))
    q = p - P('head_c')
    for s in (1, -1):
        ec = v3(EYE_X, 0.004, EYE_Z * s)
        e = np.linalg.norm(q - ec, axis=1)
        white = ramp(e, 0.0138, 0.0128)
        iris = np.linalg.norm(q - (ec + v3(0.0115, -0.0005, 0)), axis=1)
        ir = ramp(iris, 0.006, 0.005)
        pu = ramp(iris, 0.0028, 0.002)
        a = np.maximum(a, white * (1 - ir))
        eye = (1 - ir * 0.75)[:, None] * v3(1, 0.9, 0.8)[None, :] ** ir[:, None] * (1 - pu * 0.9)[:, None]   # no AO in the eye
        rgb = rgb * (1 - white)[:, None] + white[:, None] * eye
        lid = band((q - ec) @ v3(0.35, 0.94, 0), 0.0012, 0.001) * ramp(e, 0.019, 0.013) * ((q - ec)[:, 1] > 0.004)
        rgb *= (1 - 0.35 * lid)[:, None]
        b = np.linalg.norm((q - v3(0.09, 0.031, 0.031 * s)) / v3(0.02, 0.0055, 0.021), axis=1)
        rgb *= (1 - 0.6 * smooth01((1.1 - b) / 0.3))[:, None]
        nos = np.linalg.norm(q - v3(0.108, -0.031, 0.011 * s), axis=1)
        rgb *= (1 - 0.5 * ramp(nos, 0.006, 0.003))[:, None]
    m = np.linalg.norm((q - v3(0.1, -0.06, 0)) / v3(0.014, 0.0115, 0.021), axis=1)
    lip = smooth01((1.05 - m) / 0.25)
    rgb *= 1 - lip[:, None] * v3(0.1, 0.3, 0.3)[None, :]
    rgb *= (1 - 0.6 * band(q[:, 1] + 0.06, 0.0008, 0.0008) * (np.abs(q[:, 2]) < 0.018) * (q[:, 0] > 0.095))[:, None]   # mouth line
    return rgb, a


def paint_shirt(p, ao, number=True):
    rgb = np.repeat((1 - 0.62 * (1 - ao))[:, None], 3, 1) * B.weave(p, 1400, 0.045)[:, None]
    a = np.zeros(len(p))
    sh = P('shoulders')
    y = p[:, 1] - sh[1]
    front = p[:, 0] > 0.04
    # placket: two seam lines from the collar down 13 cm, three buttons
    seam = np.maximum(band(np.abs(p[:, 2]) - 0.017, 0.0012, 0.001), 0) * front * (y < -0.02) * (y > -0.16)
    rgb *= (1 - 0.3 * seam)[:, None]
    for by in (-0.055, -0.095, -0.135):
        bt = ramp(np.hypot(p[:, 2], y - by), 0.0048, 0.0036) * front
        rgb *= (1 - 0.55 * bt)[:, None]
    # shoulder seams and side seams, a faint hem shadow
    for k in ('L', 'R'):
        sj, u = P('shoulder_' + k), P('arm_dir_' + k)
        t = (p - sj) @ u
        rgb *= (1 - 0.22 * band(t - 0.02, 0.0012, 0.001) * (np.linalg.norm(p - sj, axis=1) < 0.09))[:, None]
    rgb *= (1 - 0.18 * band(np.abs(p[:, 0] + 0.02) - 0.0, 0.0012, 0.001) * (np.abs(p[:, 2]) > 0.12) * (y < -0.1) * (y > -0.42))[:, None]
    rgb *= (1 - 0.25 * band(p[:, 1] - WAIST_Y - 0.004, 0.003, 0.002))[:, None]
    if number:
        back = p[:, 0] < -0.05
        a = np.maximum(a, B.digits_mask(-p[:, 2], y + 0.19, NUMBER, 0.11) * back)
    return rgb, a


def paint_trim(p, ao):
    return np.repeat((1 - 0.6 * (1 - ao))[:, None], 3, 1), np.zeros(len(p))


def paint_pants(p, ao):
    rgb = np.repeat((1 - 0.68 * (1 - ao))[:, None], 3, 1) * v3(0.97, 0.95, 0.89)[None, :] * B.weave(p, 1100, 0.03)[:, None]
    belt = ramp(p[:, 1], WAIST_Y - 0.004, WAIST_Y - 0.008) * ramp(-p[:, 1], -(WAIST_Y - 0.03), -(WAIST_Y - 0.026))
    rgb *= (1 - belt * 0.72)[:, None]
    buckle = belt * ramp(np.abs(p[:, 2]), 0.016, 0.012) * (p[:, 0] > 0.03)
    rgb = rgb * (1 - buckle[:, None]) + buckle[:, None] * v3(0.55, 0.55, 0.5)[None, :] * (1 - 0.3 * (1 - ao))[:, None]
    for k in ('L', 'R'):   # a front crease on each leg, read as two faint shadow lines
        for jn, jo in (('hipj_', 'knee_'), ('knee_', 'ankle_')):
            a, b = P(jn + k), P(jo + k)
            u = norm(b - a)
            t = (p - a) @ u
            on = (t > 0.04) & (t < np.linalg.norm(b - a) - 0.03) & (p[:, 0] > a[0] + 0.02)
            d = (p - a) - np.outer(t, u)
            z = d @ v3(0, 0, 1)
            rgb *= (1 - 0.12 * on * (band(z - 0.003, 0.0012, 0.001) + band(z + 0.003, 0.0012, 0.001)))[:, None]
    return rgb, np.zeros(len(p))


def paint_helmet(p, ao):
    rgb = np.repeat((1 - 0.55 * (1 - ao))[:, None], 3, 1)
    q = p - P('head_c')
    hx, hy, hz = -q[:, 2], q[:, 1], q[:, 0]   # head frame: x lateral, y up, z forward
    for cx, cy, cz, rx, rz in ((0.058, 0.1, -0.015, 0.009, 0.03), (-0.058, 0.1, -0.015, 0.009, 0.03), (0.0, 0.118, 0.035, 0.008, 0.03),
                               (0.0, 0.1, -0.075, 0.025, 0.009)):
        v = np.linalg.norm(np.stack([(hx - cx) / rx, (hz - cz) / rz], 1), axis=1) * (hy > 0.06)
        rgb *= (1 - 0.75 * ramp(v, 1.15, 0.85) * (hy > 0.06))[:, None]
    rgb *= (1 - 0.2 * band(hy - 0.02, 0.002, 0.0015) * (hz > 0.02))[:, None]   # peak seam
    return rgb, np.zeros(len(p))


def paint_grille(p, ao):
    return np.repeat((1 - 0.5 * (1 - ao))[:, None], 3, 1), np.zeros(len(p))


def paint_glove(p, ao):
    rgb = np.repeat((1 - 0.6 * (1 - ao))[:, None], 3, 1)
    a = np.zeros(len(p))
    for k in ('L', 'R'):
        g, u, e1, e2, c = glove_frame(k)
        q = p - g
        here = np.linalg.norm(q, axis=1) < 0.2
        s, w, back = q @ e1, q @ c, q @ e2
        rad = np.hypot(w, back)
        onfing = here * (rad < HANDLE_R + 0.034) * (rad > HANDLE_R - 0.004)
        for x in ((FINGERS[0] + FINGERS[1]) / 2, (FINGERS[1] + FINGERS[2]) / 2, (FINGERS[2] + FINGERS[3]) / 2):
            rgb *= (1 - 0.5 * band(s - x, 0.0013, 0.001) * onfing)[:, None]
        rgb *= (1 - 0.3 * band(s - FINGERS[0] + 0.0125, 0.0013, 0.001) * onfing)[:, None]
        rgb *= (1 - 0.3 * band(s - FINGERS[3] - 0.0125, 0.0013, 0.001) * onfing)[:, None]
        for x in (-0.0115, 0.0115):   # seams between the padding bars on the back
            rgb *= (1 - 0.3 * band(s - x, 0.0012, 0.001) * here * (back > HANDLE_R + 0.012) * (w < -0.008))[:, None]
        wrist = -(q @ u)
        cuff = ramp(wrist, 0.096, 0.104) * here
        a = np.maximum(a, cuff)
        rgb *= (1 - 0.25 * band(wrist - 0.095, 0.0015, 0.001) * here)[:, None]
    return rgb, a


def paint_shoe(p, ao):
    rgb = np.repeat((1 - 0.5 * (1 - ao))[:, None], 3, 1)
    for k in ('L', 'R'):
        an = P('ankle_' + k)
        q = p - an
        here = np.linalg.norm(q, axis=1) < 0.3
        y = q[:, 1] + L['ankle_h']
        sole = ramp(y, 0.016, 0.012) * here
        rgb = rgb * (1 - sole[:, None]) + sole[:, None] * v3(0.3, 0.3, 0.32)[None, :]
        rgb *= (1 - 0.35 * band(y - 0.019, 0.002, 0.0015) * here)[:, None]   # sole line
        under = ramp(y, 0.004, 0.001) * here
        for sx, sz in ((0.09, 0.02), (0.09, -0.02), (0.125, 0.0), (0.02, 0.025), (0.02, -0.025), (-0.06, 0.0)):
            sp = ramp(np.hypot(q[:, 0] - sx, q[:, 2] - sz), 0.0062, 0.0048) * under
            rgb = rgb * (1 - sp[:, None]) + sp[:, None] * v3(0.85, 0.85, 0.85)[None, :]
        lace = here * (q[:, 0] > 0.0) * (q[:, 0] < 0.085) * (np.abs(q[:, 2]) < 0.028) * (y > 0.055)
        rgb *= (1 - 0.18 * lace * (0.5 + 0.5 * np.sin((q[:, 0] + q[:, 2]) * 400)) - 0.12 * lace)[:, None]
        rgb *= (1 - 0.3 * band(q[:, 0] - 0.08, 0.0015, 0.001) * here * (y > 0.03) * (y < 0.08))[:, None]   # toe cap seam
    return rgb, np.zeros(len(p))


PAINT = {'skin': paint_skin, 'shirt': paint_shirt, 'trim': paint_trim, 'pants': paint_pants, 'helmet': paint_helmet,
         'grille': paint_grille, 'pad': B.paint_pad, 'glove': paint_glove, 'shoe': paint_shoe}


def paint_atlas(pos, rid, ao):
    rgb = np.ones(pos.shape, np.float32)
    alpha = np.zeros(rid.shape, np.float32)
    for i, name in enumerate(MAT_ID):
        m = rid == i
        if not m.any():
            continue
        r, a = PAINT[name](pos[m].astype(float), ao[m].astype(float))
        rgb[m] = np.clip(r, 0, 1)
        alpha[m] = np.clip(a, 0, 1)
        log('painted %-7s %6d texels' % (name, m.sum()))
    return rgb, alpha


# ---------------------------------------------------------------- main
def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    arm = rig.build_armature('rig')
    body = build_body()
    B.auto_skin(body, arm)
    rigid, skinned = [(build_helmet(), 'head')], []
    for k in ('L', 'R'):
        rigid.append((B.build_shoe(k, 'shoe', 320), 'foot_' + k))
        gl, pd = build_glove(k), B.build_pad(k)
        g, u, an, kn = P('hand_' + k), P('arm_dir_' + k), P('ankle_' + k), P('knee_' + k)
        B.skin_to(gl, arm, 'hand_' + k, 'farm_tw_' + k, smooth01(((g - B.game_verts(gl)) @ u - GLOVE_WRIST[0]) / GLOVE_WRIST[1]))
        B.skin_pad(pd, arm, k)
        skinned += [gl, pd]
    for ob, b in rigid:
        B.parent_to_bone(ob, arm, b)
    objs = [body] + [o for o, _ in rigid] + skinned
    # UVs: every object smart-projected, all islands packed into one atlas, material ids global (MAT_ID)
    entries = []
    for ob in objs:
        B.unwrap(ob)
        slots = [MAT_ID.index(m.name) for m in ob.data.materials]
        mi = np.empty(len(ob.data.polygons), np.int32)
        ob.data.polygons.foreach_get('material_index', mi)
        entries.append((ob, np.array(slots)[mi], {i: (0, 0, 1, 1) for i in range(len(MAT_ID))}))
    data = B.layout_atlas(entries, SIZE, margin_px=3)
    pos, rid, oid, nrm, cov = B.rasterise(data, SIZE)
    ao = B.bake_ao(objs, SIZE, samples=int(ARGS.get('aos', 32)))
    rgb, alpha = paint_atlas(pos, rid, ao)
    out = ARGS.get('out') or os.path.join(__import__('tempfile').gettempdir(), 'batter.glb')   # the atlas PNGs go next to the GLB
    B.finish_atlas(rgb, alpha, cov, os.path.splitext(out)[0] + '-atlas.png')
    B.report(objs)
    log('bones %d' % len(arm.data.bones))
    if 'out' in ARGS:
        B.export(ARGS['out'], arm, objs, quality=int(ARGS.get('q', 76)))
    if 'save' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=ARGS['save'])
    if 'render' in ARGS:
        poses = json.load(open(ARGS['poses'])) if 'poses' in ARGS else {}
        close = [('face', 1.3, 'head@0.4'), ('hands', 1.3, 'hand_R@0.3'), ('feet', 1.5, 'foot_L@0.2')]
        if 'only' in ARGS:
            poses = {k: v for k, v in poses.items() if any(k.startswith(x) for x in ARGS['only'].split(','))}
        B.render_poses(arm, poses, ARGS['render'], close=close if ARGS.get('close', '1') == '1' else None)


if __name__ == '__main__':
    main()
