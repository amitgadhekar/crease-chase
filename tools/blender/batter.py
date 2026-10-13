"""Builds the skinned batter: Blender -b --factory-startup --python tools/blender/batter.py -- --out batter.glb
   [--render DIR] [--poses poses.json] [--h 0.005] [--save file.blend]

Body: one smooth mesh from a smooth union of signed-distance shapes (sdf.py), meshed by surface nets, decimated,
cut into kit regions (shirt, trim, trousers, skin) by plane bisects, skinned to the rig.py skeleton with automatic
weights. Rigid kit (helmet with grille, pads, gloves, shoes) are separate meshes parented to bones; their placement
matches the procedural batter in 07-render3d.js (same frames and profiles). Ambient occlusion is baked into vertex
colours. Everything is authored in game coordinates (see rig.py) and converted with g2b.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import rig  # noqa: E402
import sdf  # noqa: E402
from sdf import ellipsoid, cone, sphere, torus, box, frame, norm  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ARGS = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2)}
H = float(ARGS.get('h', 0.005))
T0 = time.time()


def log(*a):
    print('[batter %.1fs]' % (time.time() - T0), *a, flush=True)


def srgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# Kit colours (KIT.you in 01-core.js) are applied by the game per material name; these are for the Blender renders.
MATS = {'skin': ((0.69, 0.48, 0.33), 0.6), 'shirt': (srgb('#12606e'), 0.88), 'trim': (srgb('#f2b134'), 0.88),
        'pants': (srgb('#e9edf0'), 0.9), 'helmet': (srgb('#15324d'), 0.22), 'grille': ((0.34, 0.36, 0.4), 0.35),
        'pad': ((0.95, 0.95, 0.93), 0.45), 'glove': ((0.96, 0.96, 0.96), 0.55), 'shoe': ((1, 1, 1), 0.6)}

J = rig.joints()
L = rig.HUMAN
v3 = lambda *a: np.array(a, dtype=float)
P = lambda k: np.array(J[k], dtype=float)
WAIST_Y = J['hip'][1] + 0.065
SLEEVE = (0.245, 0.262)          # trim band along the upper arm (m from the shoulder joint); skin beyond
COLLAR_C = P('shoulders') + v3(-0.006, 0.012, 0)
COLLAR_N = norm([0.38, 1, 0])    # collar ring plane: lower at the front
COLLAR_W = 0.011                 # half width of the collar band


# ---------------------------------------------------------------- body shapes (game coordinates, rest pose)
def body_shapes():
    S = []
    add = lambda lab, k, s: S.append((lab, k) + s)
    hip = P('hip')
    # pelvis, glutes, abdomen, ribcage, chest, back, trapezius, deltoids
    add('torso', 0, ellipsoid(hip + v3(-0.005, -0.02, 0), [0.108, 0.11, 0.148]))
    for s in (1, -1):
        add('torso', 0.03, ellipsoid(hip + v3(-0.05, -0.07, 0.06 * s), [0.08, 0.09, 0.075]))
    add('torso', 0.05, ellipsoid(hip + v3(0.0, 0.15, 0), [0.11, 0.18, 0.158]))
    add('torso', 0.06, ellipsoid(hip + v3(-0.005, 0.31, 0), [0.12, 0.17, 0.168]))
    for s in (1, -1):
        add('torso', 0.05, ellipsoid(hip + v3(0.05, 0.37, 0.06 * s), [0.055, 0.06, 0.085]))
        add('torso', 0.04, ellipsoid(hip + v3(-0.04, 0.32, 0.09 * s), [0.075, 0.13, 0.09]))
    add('torso', 0.04, ellipsoid(P('shoulders') + v3(-0.025, -0.03, 0), [0.07, 0.065, 0.16]))
    for k, s in (('L', 1), ('R', -1)):
        add('torso', 0.035, ellipsoid(P('shoulder_' + k) + v3(0, -0.03, 0.012 * s), [0.058, 0.062, 0.055]))
    # neck, collar
    add('neck', 0.04, cone(P('shoulders') + v3(-0.01, -0.05, 0), P('neck_top') + v3(0.004, -0.01, 0), 0.066, 0.056))
    add('collar', 0.008, torus(COLLAR_C, COLLAR_N, 0.07, 0.0105, (1.0, 1.05)))
    # head: cranium, jaw, chin, cheekbones, brow, nose, eyes, lips
    hc = P('head_c')
    add('head', 0.03, ellipsoid(hc + v3(-0.012, 0.012, 0), [0.103, 0.112, 0.088]))
    add('head', 0.03, ellipsoid(hc + v3(0.035, -0.05, 0), [0.072, 0.07, 0.068]))
    add('head', 0.02, ellipsoid(hc + v3(0.078, -0.098, 0), [0.028, 0.024, 0.032]))
    for s in (1, -1):
        add('head', 0.02, ellipsoid(hc + v3(0.07, -0.012, 0.047 * s), [0.032, 0.022, 0.026]))
    add('head', 0.015, cone(hc + v3(0.087, 0.03, -0.042), hc + v3(0.087, 0.03, 0.042), 0.016, 0.016))
    add('head', 0.012, cone(hc + v3(0.1, 0.022, 0), hc + v3(0.119, -0.022, 0), 0.01, 0.015))
    add('head', 0.01, ellipsoid(hc + v3(0.106, -0.027, 0), [0.015, 0.012, 0.022]))
    for s in (1, -1):
        add('head', -0.01, sphere(hc + v3(0.1, 0.006, 0.034 * s), 0.019))
        add('head', 0.004, sphere(hc + v3(0.083, 0.005, 0.034 * s), 0.0145))
    add('head', 0.01, ellipsoid(hc + v3(0.099, -0.058, 0), [0.012, 0.014, 0.026]))
    add('head', -0.006, ellipsoid(hc + v3(0.112, -0.059, 0), [0.008, 0.003, 0.024]))
    # arms
    for k, s in (('L', 1), ('R', -1)):
        sh, el, gp, u = P('shoulder_' + k), P('elbow_' + k), P('hand_' + k), P('arm_dir_' + k)
        add('uarm_' + k, 0.035, cone(sh + u * 0.025, sh + u * SLEEVE[1], 0.054, 0.047))
        add('cuff_' + k, 0.006, torus(sh + u * (SLEEVE[0] + SLEEVE[1]) / 2, u, 0.0465, 0.0075))
        add('farm_' + k, 0.02, cone(sh + u * SLEEVE[1], el, 0.045, 0.043))
        add('farm_' + k, 0.02, cone(el, gp - u * 0.07, 0.043, 0.029))
        F = frame(u, [1, 0, 0])
        add('farm_' + k, 0.02, ellipsoid(el + u * 0.065 + F[1] * 0.006, [0.09, 0.047, 0.042], F))
        add('hand_' + k, 0.015, ellipsoid(gp - u * 0.005, [0.055, 0.045, 0.028], F))
    # legs
    for k, s in (('L', 1), ('R', -1)):
        hj, kn, an, v = P('hipj_' + k), P('knee_' + k), P('ankle_' + k), P('leg_dir_' + k)
        F = frame(v, [1, 0, 0])
        add('thigh_' + k, 0.05, cone(hj + v3(0, 0.02, 0), kn, 0.09, 0.063))
        add('thigh_' + k, 0.03, ellipsoid(hj + v * 0.19 + v3(0.018, 0, 0), [0.17, 0.072, 0.076], F))
        add('thigh_' + k, 0.03, ellipsoid(hj + v * 0.21 + v3(-0.018, 0, 0), [0.16, 0.068, 0.072], F))
        add('shin_' + k, 0.02, cone(kn, an, 0.054, 0.036))
        add('shin_' + k, 0.02, ellipsoid(kn + v * 0.12 + v3(-0.012, 0, 0), [0.1, 0.045, 0.045], F))
        add('foot_' + k, 0.015, cone(an, an + v3(0.1, -0.045, 0), 0.036, 0.028))
    return S


# ---------------------------------------------------------------- rigid kit shapes
def glove_shapes(k):
    """padded batting glove around the handle; origin at the hand point (the grip), handle along +x at rest"""
    g, u = P('hand_' + k), P('arm_dir_' + k)
    b = v3(1, 0, 0)
    w = np.cross(u, b) * (1 if k == 'L' else -1)   # back of the hand, mirrored between hands
    G = lambda du, db, dw: g + u * du + b * db + w * dw
    A = np.array([u, b, w])
    S = [('glove', 0) + (box(G(0.006, 0, 0.004), [0.042, 0.05, 0.036], 0.022, A))]
    for i in range(4):
        db = -0.036 + 0.024 * i
        S.append(('glove', 0.012) + (cone(G(0.04, db, -0.016), G(0.04, db, 0.024), 0.0135, 0.0135)))
    S.append(('glove', 0.015) + (cone(G(-0.01, 0.046, -0.026), G(0.026, 0.036, -0.034), 0.015, 0.014)))
    S.append(('glove', 0.02) + (cone(G(-0.03, 0, 0.002), G(-0.125, 0, 0), 0.042, 0.047)))
    return S


def shoe_shapes(k):
    """spiked-free batting shoe; origin at the ankle, sole ankle_h below it"""
    a = P('ankle_' + k)
    sole = -L['ankle_h']
    A = lambda x, y, z: a + v3(x, y, z)
    S = [('shoe', 0) + (ellipsoid(A(0.035, sole + 0.04, 0), [0.125, 0.045, 0.05])),
         ('shoe', 0.03) + (ellipsoid(A(-0.04, sole + 0.045, 0), [0.05, 0.05, 0.046])),
         ('shoe', 0.03) + (ellipsoid(A(0.115, sole + 0.022, 0), [0.05, 0.026, 0.046])),
         ('shoe', 0.025) + (cone(A(-0.005, sole + 0.04, 0), A(-0.01, sole + 0.105, 0), 0.047, 0.044)),
         ('shoe', 0.004) + (box(A(0.035, sole + 0.008, 0), [0.135, 0.009, 0.054], 0.008)),
         ('shoe', -0.002) + sdf.plane(A(0, sole, 0), [0, 1, 0])]
    return S


# ---------------------------------------------------------------- Blender helpers
def new_object(name, verts_game, faces, mats=None, mat_idx=None, outward=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([rig.g2b(v) for v in verts_game], [], [list(map(int, f)) for f in faces])
    me.validate()
    if outward:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats or []:
        me.materials.append(material(m))
    if mat_idx is not None:
        me.polygons.foreach_set('material_index', np.asarray(mat_idx, dtype=np.int32))
    me.update()
    return ob


_mats = {}


def material(n):
    if n not in _mats:
        m = bpy.data.materials.new(n)
        if m.node_tree is None or 'Principled BSDF' not in m.node_tree.nodes:
            m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        c, r = MATS[n]
        lin = [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c]
        bsdf.inputs['Base Color'].default_value = (*lin, 1)
        bsdf.inputs['Roughness'].default_value = r
        if n == 'grille':
            bsdf.inputs['Metallic'].default_value = 0.7
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        mix = m.node_tree.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1
        mix.inputs[6].default_value = (*lin, 1)
        m.node_tree.links.new(vc.outputs['Color'], mix.inputs[7])
        m.node_tree.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
        _mats[n] = m
    return _mats[n]


def activate(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)


def apply_mod(ob, kind, **kw):
    activate(ob)
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        setattr(m, k, v)
    bpy.ops.object.modifier_apply(modifier=m.name)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def keep_largest(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    seen, parts = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        comp, stack = [], [v]
        seen.add(v)
        while stack:
            x = stack.pop()
            comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        parts.append(comp)
    parts.sort(key=len, reverse=True)
    for comp in parts[1:]:
        bmesh.ops.delete(bm, geom=comp, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    return len(parts)


def sdf_object(name, shapes, lo, hi, h, target, smooth=2, mats=None):
    """surface nets -> voxel remesh (manifold) -> smooth -> decimate. Decimation without its symmetry option: with it,
    faces along the mirror plane fold over."""
    v, q = sdf.mesh(shapes, lo, hi, h)
    ob = new_object(name, v, q, mats)
    n = keep_largest(ob)
    apply_mod(ob, 'REMESH', mode='VOXEL', voxel_size=h, adaptivity=0)
    if smooth:
        apply_mod(ob, 'SMOOTH', factor=0.5, iterations=smooth)
    apply_mod(ob, 'DECIMATE', ratio=min(1.0, target / max(1, tris(ob))))
    log('%s: %d quads -> %d tris (%d parts)' % (name, len(q), tris(ob), n))
    return ob


def game_verts(ob):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)


def bisect(ob, co, no, sel):
    """inserts an edge loop where the plane (game coordinates) crosses faces whose vertices all pass sel"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    b2g = lambda c: np.array([c.x, c.z, -c.y])
    faces = [f for f in bm.faces if any(sel(b2g(v.co)) for v in f.verts)]
    geom = list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}) + faces
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=rig.g2b(co), plane_no=rig.g2b(no), dist=0.0005)
    bm.to_mesh(ob.data)
    bm.free()


def merge_close(ob, d=1e-5):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=d)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()


def shade_smooth(ob):
    ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
    ob.data.update()


# ---------------------------------------------------------------- body
def build_body():
    shapes = body_shapes()
    ob = sdf_object('body', shapes, [-0.24, -0.02, -0.72], [0.26, 1.9, 0.72], H, int(ARGS.get('tris', 4700)), smooth=3,
                    mats=['skin', 'shirt', 'trim', 'pants'])
    # region cuts: waist, collar band, sleeve trim band
    near = lambda c, r: (lambda p: np.linalg.norm(p - c) < r)
    collar = lambda p: np.linalg.norm((p - COLLAR_C) - COLLAR_N * ((p - COLLAR_C) @ COLLAR_N)) < 0.12 and abs((p - COLLAR_C) @ COLLAR_N) < 0.06
    torso = lambda p: abs(p[2]) < 0.3 and abs(p[1] - WAIST_Y) < 0.12
    bisect(ob, (0, WAIST_Y, 0), (0, 1, 0), torso)
    for d in (-COLLAR_W, COLLAR_W):
        bisect(ob, COLLAR_C + COLLAR_N * d, COLLAR_N, collar)
    for k in ('L', 'R'):
        sh, u = P('shoulder_' + k), P('arm_dir_' + k)
        for t in SLEEVE:
            c = sh + u * t
            bisect(ob, c, u, near(c, 0.085))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.validate()
    # materials per face: 0 skin, 1 shirt, 2 trim, 3 trousers
    me = ob.data
    gv = game_verts(ob)
    cen = np.array([gv[list(p.vertices)].mean(0) for p in me.polygons])
    lab = sdf.label_of(shapes, cen)
    idx = np.zeros(len(cen), np.int32)
    for i, (c, l) in enumerate(zip(cen, lab)):
        dc = (c - COLLAR_C) @ COLLAR_N
        radial = np.linalg.norm((c - COLLAR_C) - COLLAR_N * dc)
        if l == 'head':
            idx[i] = 0
        elif l in ('neck', 'collar') or (l == 'torso' and radial < 0.12 and abs(dc) < 0.06):
            idx[i] = 0 if dc > COLLAR_W else 2 if dc > -COLLAR_W else 1
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
    shade_smooth(ob)
    log('body: %d tris after region cuts' % tris(ob))
    return ob


# ---------------------------------------------------------------- rigid kit
def surf(rows, segs, fn):
    """grid over rows (v values) x segs (angles, closed); returns verts, quads"""
    V = [fn(v, a) for v in rows for a in segs]
    n = len(segs)
    Q = [(r * n + i, r * n + (i + 1) % n, (r + 1) * n + (i + 1) % n, (r + 1) * n + i)
         for r in range(len(rows) - 1) for i in range(n)]
    return V, Q


def lin(n, a, b):
    return [a + (b - a) * i / n for i in range(n + 1)]


def crv(K, y):
    i = 0
    while i < len(K) - 2 and y > K[i + 1][0]:
        i += 1
    a, b, c, d = K[max(0, i - 1)], K[i], K[i + 1], K[min(len(K) - 1, i + 2)]
    t = min(1, max(0, (y - b[0]) / (c[0] - b[0])))
    t2, t3 = t * t, t * t * t
    return [0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2
                   + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3) for j in range(len(b))]


def join_geo(*gs):
    V, Q, M = [], [], []
    for g in gs:
        b = len(V)
        V += list(g[0])
        Q += [tuple(i + b for i in q) for q in g[1]]
        M += [g[2] if len(g) > 2 else 0] * len(g[1])
    return V, Q, M


def ell(o, r, segs, rows, tilt=0.0, l0=-math.pi / 2):
    """ellipsoid in a local frame (x lateral, y up, z forward), tilted about x; closed at the poles"""
    def f(v, a):
        l = l0 + (math.pi / 2 - l0) * v
        x, y, z = r[0] * math.cos(l) * math.cos(a), r[1] * math.sin(l), r[2] * math.cos(l) * math.sin(a)
        c, s = math.cos(tilt), math.sin(tilt)
        return (o[0] + x, o[1] + y * c - z * s, o[2] + y * s + z * c)
    return surf(lin(rows, 0, 1), lin(segs, 0, 2 * math.pi)[:-1], f)


def arc(o, R, A, B, t0, t1, r, n, sides=5):
    C = np.cross(A, B)

    def f(v, a):
        t = t0 + (t1 - t0) * v
        q, w = R + r * math.cos(a), r * math.sin(a)
        return tuple(o[j] + (math.cos(t) * A[j] + math.sin(t) * B[j]) * q + C[j] * w for j in range(3))
    V, Q = surf(lin(n, 0, 1), lin(sides, 0, 2 * math.pi)[:-1], f)
    return V, Q


def build_helmet():
    """helmet shell, peak, neck guard, ear pieces and grille in the head frame of 07-render3d.js (x lateral, y up,
    z forward, origin at the head centre)"""
    H2 = math.pi / 2
    sm = lambda u: u * u * (3 - 2 * u)

    def dome(v, a):
        s = math.sin(a)
        lb = -0.8 + sm(min(1, max(0, (s + 0.35) / 1.1)))
        l = lb + (H2 - lb) * v
        c = math.cos(l)
        return (0.132 * c * math.cos(a), 0.015 + 0.14 * math.sin(l), -0.005 + (0.142 if s > 0 else 0.152) * c * s)
    shell = surf(lin(8, 0, 1), lin(26, 0, 2 * math.pi)[:-1], dome)
    parts = [ell([0, 0.04, 0.09], [0.128, 0.012, 0.1], 18, 5, 0.18) + (0,),
             ell([0.124, -0.01, 0.07], [0.012, 0.03, 0.034], 12, 5) + (0,),
             ell([-0.124, -0.01, 0.07], [0.012, 0.03, 0.034], 12, 5) + (0,)]
    bar = lambda y, R, sp: arc([0, y, 0], R, [1, 0, 0], [0, 0, 1], H2 - sp, H2 + sp, 0.0055, 12) + (1,)
    vb = lambda th: arc([0, -0.03, 0], 0.162, [0, 1, 0], [math.sin(th), 0, math.cos(th)], 1.2, 2.25, 0.0055, 7) + (1,)
    parts += [bar(-0.005, 0.158, 1), bar(-0.055, 0.156, 0.95), bar(-0.1, 0.142, 0.85), vb(0), vb(0.42), vb(-0.42)]
    hc = P('head_c')
    hf = lambda V: [hc + v3(p[2], p[1], -p[0]) for p in V]   # head frame at rest: x -> -z, y -> y, z -> x
    sh = new_object('helmet_shell', hf(shell[0]), shell[1], ['helmet'], outward=True)
    merge_close(sh)
    apply_mod(sh, 'SOLIDIFY', thickness=0.007, offset=-1, use_rim=True)
    V, Q, M = join_geo(*parts)
    ob = new_object('helmet', hf(V), Q, ['helmet', 'grille'], M, outward=True)
    merge_close(ob)
    activate(ob)
    sh.select_set(True)
    bpy.ops.object.join()
    shade_smooth(ob)
    return ob


PADK = [[-.27, .055, .062], [-.2, .066, .08], [0, .074, .086], [.17, .078, .09], [.215, .084, .1], [.26, .08, .094],
        [.3, .074, .082], [.335, .066, .07]]


def build_pad(k):
    """the procedural pad profile (padG in 07-geometry.js): ribbed front, knee roll; open behind the thigh above
    the knee so a bent knee doesn't push the thigh through it"""
    rows = sorted(set(lin(7, 0, 1) + [0.76, 0.81, 0.89]))
    segs = [math.pi * i / 28 for i in range(28)] + [math.pi + math.pi * (i + 0.5) / 8 for i in range(8)]

    def f(v, a):
        y = -0.27 + 0.605 * v
        _, hw, fz = crv(PADK, y)
        e = math.sqrt(min(1, max(0, (y + 0.27) / 0.045)) * min(1, max(0, (0.335 - y) / 0.05)))
        e = max(e, 0.35)
        c, s = math.cos(a), math.sin(a)
        fr = max(0.0, s)
        rid = fr * (0.008 * (0.5 - 0.5 * math.cos(a * 14)) + 0.011 * math.exp(-((y - 0.225) / 0.022) ** 2))
        return (e * (hw + rid) * c, y, e * (fz + rid if s > 0 else 0.062) * s)
    V, Q = surf(rows, segs, f)
    n = len(segs)
    # drop back faces above the knee
    keep = []
    for q in Q:
        r, i = q[0] // n, q[0] % n
        y = -0.27 + 0.605 * rows[r]
        if y > 0.2 and math.sin(segs[i] + math.pi / n) < -0.3:
            continue
        keep.append(q)
    # caps at the bottom (closed) and top (front part) ends
    an, kn, t = P('ankle_' + k), P('knee_' + k), v3(1, 0, 0)
    Yv = norm(kn - an)
    Xv = norm(np.cross(Yv, t))
    Zv = np.cross(Xv, Yv)
    c = (an + kn) / 2
    Vg = [c + Xv * p[0] + Yv * p[1] + Zv * p[2] for p in V]
    ob = new_object('pad_' + k, Vg, keep, ['pad'], outward=True)
    tone = ob.data.attributes.new('tone', 'FLOAT', 'POINT')   # grooves between the ribs, like the procedural pad texture
    tone.data.foreach_set('value', [0.8 + 0.2 * (0.5 - 0.5 * math.cos(segs[i % n] * 14)) if math.sin(segs[i % n]) > 0 else 1.0
                                    for i in range(len(V))])
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bottom = [bm.verts[i] for i in range(n)]
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if all(v in bottom for v in e.verts)])
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    shade_smooth(ob)
    return ob


def build_glove(k):
    g = P('hand_' + k)
    ob = sdf_object('glove_' + k, glove_shapes(k), g - 0.17, g + 0.17, 0.0025, 480, smooth=4,
                    mats=['glove'])
    shade_smooth(ob)
    return ob


def build_shoe(k):
    a = P('ankle_' + k)
    ob = sdf_object('shoe_' + k, shoe_shapes(k), a + v3(-0.12, -0.1, -0.08), a + v3(0.2, 0.06, 0.08), 0.003, 300,
                    smooth=1, mats=['shoe'])
    shade_smooth(ob)
    return ob


def parent_to_bone(ob, arm, bone):
    activate(ob)
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    pb = arm.pose.bones[bone]
    tail = arm.matrix_world @ pb.matrix @ __import__('mathutils').Matrix.Translation((0, pb.bone.length, 0))
    ob.matrix_parent_inverse = tail.inverted()


# ---------------------------------------------------------------- ambient occlusion -> vertex colours
def bake_ao(objs, detail):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    if sc.world is None:
        sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.1
    sc.render.bake.target = 'VERTEX_COLORS'
    for ob in objs:
        me = ob.data
        if 'Col' not in me.color_attributes:
            me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        me.color_attributes.active_color = me.color_attributes['Col']
        activate(ob)
        for o in objs:
            o.hide_render = o is not ob
        bpy.ops.object.bake(type='AO')
        for o in objs:
            o.hide_render = False
        ca = me.color_attributes['Col']
        c = np.empty(len(ca.data) * 4, np.float32)
        ca.data.foreach_get('color', c)
        c = c.reshape(-1, 4)
        gv = game_verts(ob)
        ao = c[:, 0]
        s = detail.get(ob.name.split('_')[0], (0.65, None))
        val = 1 - s[0] * (1 - ao)
        rgb = np.repeat(val[:, None], 3, 1)
        if s[1]:
            rgb *= s[1](gv)
        if 'tone' in me.attributes:
            t = np.empty(len(me.vertices), np.float32)
            me.attributes['tone'].data.foreach_get('value', t)
            rgb *= t[:, None]
            me.attributes.remove(me.attributes['tone'])
        c[:, :3] = np.clip(rgb, 0, 1)
        c[:, 3] = 1
        ca.data.foreach_set('color', c.ravel())
        me.update()
        log('ao %s: mean %.2f min %.2f' % (ob.name, val.mean(), val.min()))


def shoe_tone(gv):
    y = gv[:, 1]
    return np.where(y < 0.022, 0.55, 1.0)[:, None] * np.ones(3)


# ---------------------------------------------------------------- export, renders
def export(path, arm, objs):
    activate(arm)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_texcoords=False,
                              export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_extras=True, export_yup=True, export_apply=False,
                              export_animations=False, export_skins=True, export_influence_nb=4,
                              export_def_bones=False, export_rest_position_armature=True, export_leaf_bone=False)
    log('exported', path, os.path.getsize(path), 'bytes')


def render_setup():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 600, 900
    sc.render.film_transparent = False
    w = sc.world
    if w.node_tree is None:
        w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.55, 0.62, 0.7, 1)
    bg.inputs['Strength'].default_value = 0.7
    sc.view_settings.view_transform = 'AgX'
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN'))
    fill.data.energy = 1.0
    fill.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(fill)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 70
    sc.collection.objects.link(cam)
    sc.camera = cam
    gr = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    gr.data.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    gm = bpy.data.materials.new('groundm')
    if gm.node_tree is None:
        gm.use_nodes = True
    gm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.2, 0.35, 0.15, 1)
    gr.data.materials.append(gm)
    sc.collection.objects.link(gr)
    return cam


def shoot(cam, path, az, el=8, dist=4.6, look=(0, 0, 0.95)):
    from mathutils import Vector
    a, e = math.radians(az), math.radians(el)
    t = Vector(look)
    cam.location = t + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    arm = rig.build_armature('rig')
    body = build_body()
    activate(body)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    activate(body)
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.01)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    empty = [g.name for g in body.vertex_groups if not any(g.index in [x.group for x in v.groups] for v in body.data.vertices)]
    log('bones without weights:', empty)
    rigid = [(build_helmet(), 'head')]
    for k in ('L', 'R'):
        rigid += [(build_pad(k), 'shin_' + k), (build_glove(k), 'hand_' + k), (build_shoe(k), 'foot_' + k)]
    for ob, b in rigid:
        parent_to_bone(ob, arm, b)
    objs = [body] + [o for o, _ in rigid]
    bake_ao(objs, {'body': (0.7, None), 'helmet': (0.6, None), 'pad': (0.75, None), 'glove': (0.6, None),
                   'shoe': (0.55, shoe_tone)})
    total = sum(tris(o) for o in objs)
    log('triangles: body %d, rigid %d, total %d; bones %d' % (tris(body), total - tris(body), total, len(arm.data.bones)))
    if 'out' in ARGS:
        export(ARGS['out'], arm, objs)
    if 'save' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=ARGS['save'])
    if 'render' in ARGS:
        os.makedirs(ARGS['render'], exist_ok=True)
        cam = render_setup()
        poses = json.load(open(ARGS['poses'])) if 'poses' in ARGS else {}
        for name, tg in [('rest', None)] + list(poses.items()):
            for pb in arm.pose.bones:
                pb.location = (0, 0, 0)
                pb.rotation_quaternion = (1, 0, 0, 0)
            bpy.context.view_layer.update()
            if tg:
                rig.pose_armature(arm, tg)
            views = tg.get('views', [[-60, 8]]) if tg else [[0, 8], [-90, 8], [180, 8], [-45, 15]]
            if 'close' in ARGS:
                views = [v + [1.3, 1.45] for v in views]
            look = rig.g2b(tg['root']) if tg else (0, 0, 0.95)
            for v in views:
                shoot(cam, os.path.join(ARGS['render'], '%s%s_%d.png' % (name, '_close' if len(v) > 2 else '', v[0])), v[0], v[1],
                      v[2] if len(v) > 2 else 4.6, (look[0], look[1], v[3] if len(v) > 3 else 0.95))
        log('renders in', ARGS['render'])


if __name__ == '__main__':
    main()
