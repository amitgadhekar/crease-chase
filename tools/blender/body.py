"""Shared body code for every skinned person model (batter.py, fielder.py). Runs inside Blender (bpy, numpy).

The athletic body (docs/art-style.md section 2): one smooth mesh from a smooth union of signed-distance shapes (sdf.py) at the
rig.py lengths, meshed by surface nets, voxel-remeshed, decimated (denser where `keep` says), cut into kit regions by plane
bisects and labelled per face, skinned to the rig.py skeleton (automatic weights, smoothed shoulder/elbow blends, twist share).
Textures: every mesh is smart-projected, the islands are packed (our own shelf packer, so a model can pack into REGIONS of an
atlas) and rasterised here (position + material id per texel, no Blender bake needed for those); only ambient occlusion is a
Cycles bake, with every object visible (inter-object AO). Detail is painted in numpy from the texel's game position and
material. The atlas is written as PNG (own encoder, exact sRGB bytes) and exported inside the GLB as WebP.

Atlas convention (read by src/game/07-skin.js kit() and by the fielder material): rgb = linear multiplier of the material
colour (AO, seams, grooves, face), sRGB encoded; a = 1 - tint mask: 1 = the plain material colour, 0 = the material's tint
colour (trim on the shirt, eye white on the skin, team cuff on the glove), mixed before the rgb multiply. Alpha 1 where
nothing is tinted keeps three's default map code (diffuse *= map) harmless for materials without a tint.

Everything is authored in game coordinates (metres, +x forward, +y up, +z the person's left; see rig.py) and converted with g2b.
"""
import bpy
import bmesh
import math
import os
import struct
import sys
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import rig  # noqa: E402
import sdf  # noqa: E402
from sdf import ellipsoid, cone, sphere, torus, box, frame, norm  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ARGS = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2)}
T0 = time.time()
TAG = 'body'


def log(*a):
    print('[%s %.1fs]' % (TAG, time.time() - T0), *a, flush=True)


def srgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_lin(c):
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c]


J = rig.joints()
L = rig.HUMAN
v3 = lambda *a: np.array(a, dtype=float)
P = lambda k: np.array(J[k], dtype=float)
WAIST_Y = J['hip'][1] + 0.065
COLLAR_C = P('shoulders') + v3(-0.006, 0.012, 0)
COLLAR_N = norm([0.38, 1, 0])    # collar ring plane: lower at the front
COLLAR_W = 0.011                 # half width of the collar band
ACOLLAR_C, ACOLLAR_N, ACOLLAR_R = P('shoulders') + v3(-0.008, 0.05, 0), norm([0.45, 1, 0]), 0.078   # athletic body: up the neck behind the trapezius
EYE_X, EYE_Z = 0.078, 0.033      # eyeball centres in the head frame
SLEEVE = (0.185, 0.2)            # short sleeve: trim band along the upper arm (m from the shoulder joint); skin beyond


def smooth01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- the athletic body (game coordinates, rest pose)
def torso_shapes(add, athletic=False):
    """pelvis, glutes, abdomen, ribcage, pecs, lats, trapezius, deltoids: shoulders .47 outside the deltoids, hips .33,
    chest depth .24, waist depth .21 (art-style section 2). athletic (fielders): a V taper from a wide armpit line to a .28 waist,
    a flat pec plate and a fuller trapezius slope, so the short-sleeve shirt doesn't read as a barrel when the arms move"""
    hip = P('hip')
    add('torso', 0, ellipsoid(hip + v3(-0.005, -0.02, 0), [0.108, 0.11, 0.15]))
    for s in (1, -1):
        add('torso', 0.03, ellipsoid(hip + v3(-0.05, -0.07, 0.06 * s), [0.08, 0.09, 0.075]))          # glutes
    if athletic:
        add('torso', 0.04, ellipsoid(hip + v3(0.0, 0.15, 0), [0.1, 0.17, 0.118]))                       # abdomen
        add('torso', 0.05, ellipsoid(hip + v3(-0.005, 0.32, 0), [0.118, 0.16, 0.145]))                  # ribcage
        add('torso', 0.05, ellipsoid(hip + v3(-0.015, 0.39, 0), [0.098, 0.08, 0.19]))                    # armpit line
        for s in (1, -1):
            add('torso', 0.045, ellipsoid(hip + v3(0.068, 0.395, 0.066 * s), [0.038, 0.058, 0.085]))    # pec plate
            add('torso', 0.04, ellipsoid(hip + v3(-0.045, 0.33, 0.1 * s), [0.068, 0.12, 0.08]))          # lats
        add('torso', 0.04, ellipsoid(P('shoulders') + v3(-0.03, -0.035, 0), [0.07, 0.07, 0.17]))        # upper back
        add('torso', 0.05, ellipsoid(P('shoulders') + v3(-0.025, 0.0, 0), [0.058, 0.07, 0.13]))         # trapezius slope
        for k, s in (('L', 1), ('R', -1)):
            add('torso', 0.035, ellipsoid(P('shoulder_' + k) + v3(0, -0.018, 0.004 * s), [0.064, 0.07, 0.05]))  # deltoid
    else:
        add('torso', 0.05, ellipsoid(hip + v3(0.0, 0.15, 0), [0.105, 0.18, 0.15]))                      # abdomen
        add('torso', 0.06, ellipsoid(hip + v3(-0.005, 0.31, 0), [0.12, 0.17, 0.165]))                   # ribcage
        for s in (1, -1):
            add('torso', 0.05, ellipsoid(hip + v3(0.055, 0.37, 0.065 * s), [0.05, 0.055, 0.085]))       # pecs (flat, wide)
            add('torso', 0.04, ellipsoid(hip + v3(-0.045, 0.3, 0.1 * s), [0.07, 0.14, 0.085]))          # lats
        add('torso', 0.04, ellipsoid(P('shoulders') + v3(-0.03, -0.035, 0), [0.07, 0.07, 0.17]))        # upper back
        add('torso', 0.045, ellipsoid(P('shoulders') + v3(-0.01, 0.02, 0), [0.055, 0.05, 0.1]))         # trapezius slope
        for k, s in (('L', 1), ('R', -1)):
            add('torso', 0.035, ellipsoid(P('shoulder_' + k) + v3(0, -0.025, 0.004 * s), [0.058, 0.064, 0.05]))  # deltoid
    add('torso', 0.004, torus(v3(-0.004, WAIST_Y + 0.006, 0), [0, 1, 0], 0.1, 0.007, (0.95, 1.35)))          # shirt hem lip


def neck_shapes(add, head, athletic=False):
    top = P('neck_top') + (v3(0.004, -0.01, 0) if head else v3(0.0, 0.015, 0))
    r0, r1, k = (0.068, 0.062, 0.03) if athletic else (0.066, 0.058, 0.04)
    add('neck', k, cone(P('shoulders') + v3(-0.01, -0.05, 0), top, r0, r1))
    c, n, r = (ACOLLAR_C, ACOLLAR_N, ACOLLAR_R) if athletic else (COLLAR_C, COLLAR_N, 0.07)
    add('collar', 0.008, torus(c, n, r, 0.0105, (1.0, 1.05)))


def head_shapes(add, lab='head'):
    """cranium, jaw with its angles, chin, cheekbones, brow ridge, nose, eyes, lips, ears (x forward, z left)"""
    hc = P('head_c')
    add(lab, 0.03, ellipsoid(hc + v3(-0.012, 0.012, 0), [0.103, 0.112, 0.088]))
    add(lab, 0.03, ellipsoid(hc + v3(0.03, -0.048, 0), [0.07, 0.066, 0.066]))
    for s in (1, -1):
        add(lab, 0.025, ellipsoid(hc + v3(0.0, -0.072, 0.052 * s), [0.03, 0.022, 0.016]))
        add(lab, 0.03, cone(hc + v3(0.006, -0.074, 0.05 * s), hc + v3(0.074, -0.1, 0.016 * s), 0.014, 0.012))
    add(lab, 0.016, ellipsoid(hc + v3(0.079, -0.101, 0), [0.024, 0.02, 0.027]))
    for s in (1, -1):
        add(lab, 0.018, ellipsoid(hc + v3(0.056, -0.018, 0.047 * s), [0.03, 0.019, 0.026]))
        add(lab, 0.012, cone(hc + v3(0.087, 0.026, 0.004 * s), hc + v3(0.077, 0.028, 0.05 * s), 0.0085, 0.007))
        add(lab, 0.008, ellipsoid(hc + v3(-0.008, -0.006, 0.087 * s), [0.019, 0.029, 0.009]))
        add(lab, -0.003, sphere(hc + v3(-0.004, -0.01, 0.097 * s), 0.008))
        add(lab, -0.004, ellipsoid(hc + v3(0.095, 0.005, EYE_Z * s), [0.01, 0.009, 0.014]))
        add(lab, 0.003, sphere(hc + v3(EYE_X, 0.004, EYE_Z * s), 0.0125))
    add(lab, 0.008, cone(hc + v3(0.095, 0.017, 0), hc + v3(0.117, -0.024, 0), 0.007, 0.0105))
    add(lab, 0.006, sphere(hc + v3(0.116, -0.027, 0), 0.0105))
    for s in (1, -1):
        add(lab, 0.005, ellipsoid(hc + v3(0.103, -0.032, 0.013 * s), [0.009, 0.008, 0.008]))
    add(lab, 0.006, ellipsoid(hc + v3(0.1, -0.054, 0), [0.009, 0.006, 0.02]))
    add(lab, 0.006, ellipsoid(hc + v3(0.097, -0.066, 0), [0.009, 0.0065, 0.017]))
    add(lab, -0.003, ellipsoid(hc + v3(0.108, -0.06, 0), [0.006, 0.0015, 0.019]))


def hand_frame(k):
    """hand point g (the game's hand centre for a fielder, the grip point for the batter), aim a (along the hand), width w
    (+x: the thumb side, palms toward the thighs in the A-pose), back of the hand n (a x w, up and outward in rest)"""
    g, a = P('hand_' + k), P('arm_dir_' + k)
    w = v3(1, 0, 0)
    n = np.cross(a, w)
    return g, a, w, n


def finger_shapes(add, k):
    """cupped relaxed hand: palm, four fingers in two curled phalanx segments, a thumb; .19 m wrist to fingertip, .10 wide"""
    g, a, w, n = hand_frame(k)
    add('hand_' + k, 0.012, ellipsoid(g - a * 0.012, [0.047, 0.042, 0.017], np.array([a, w, n])))
    add('hand_' + k, 0.01, ellipsoid(g + a * 0.03, [0.014, 0.044, 0.016], np.array([a, w, n])))   # knuckles
    for i, (x, l1, l2, r) in enumerate(((-0.033, 0.033, 0.03, 0.0085), (-0.011, 0.038, 0.032, 0.009),
                                        (0.011, 0.037, 0.03, 0.0088), (0.033, 0.03, 0.026, 0.0082))):
        p0 = g + a * 0.038 + w * x
        d1 = norm(a * math.cos(0.5) - n * math.sin(0.5))
        p1 = p0 + d1 * l1
        d2 = norm(a * math.cos(1.1) - n * math.sin(1.1))
        add('hand_' + k, 0.004, cone(p0, p1, r, r * 0.92))
        add('hand_' + k, 0.003, cone(p1, p1 + d2 * l2, r * 0.9, r * 0.78))
    t0 = g - a * 0.01 + w * 0.042 - n * 0.004
    d1 = norm(a * 0.55 + w * 0.8 - n * 0.25)
    t1 = t0 + d1 * 0.045
    d2 = norm(a * 0.75 + w * 0.3 - n * 0.6)
    add('hand_' + k, 0.008, cone(t0, t1, 0.0125, 0.0105))
    add('hand_' + k, 0.003, cone(t1, t1 + d2 * 0.034, 0.0102, 0.0085))


def arm_shapes(add, k, hands):
    sh, el, gp, u = P('shoulder_' + k), P('elbow_' + k), P('hand_' + k), P('arm_dir_' + k)
    add('uarm_' + k, 0.035, cone(sh + u * 0.025, sh + u * SLEEVE[1], 0.055, 0.049))
    add('cuff_' + k, 0.006, torus(sh + u * (SLEEVE[0] + SLEEVE[1]) / 2, u, 0.049, 0.0075))
    add('farm_' + k, 0.02, cone(sh + u * SLEEVE[1], el, 0.047, 0.042))                 # biceps/triceps to the elbow
    F = frame(u, [1, 0, 0])
    add('farm_' + k, 0.02, ellipsoid(sh + u * 0.19 + F[2] * 0.0, [0.09, 0.05, 0.046], F))   # biceps belly
    wrist = gp - u * 0.075
    add('farm_' + k, 0.02, cone(el, wrist, 0.042, 0.028))
    add('farm_' + k, 0.02, ellipsoid(el + u * 0.07 + F[1] * 0.006, [0.09, 0.048, 0.042], F))  # forearm belly
    add('hand_' + k, 0.012, ellipsoid(gp - u * 0.078, [0.03, 0.03, 0.021], F))               # wrist
    if hands:
        finger_shapes(add, k)


def leg_shapes(add, k):
    hj, kn, an, v = P('hipj_' + k), P('knee_' + k), P('ankle_' + k), P('leg_dir_' + k)
    F = frame(v, [1, 0, 0])
    add('thigh_' + k, 0.05, cone(hj + v3(0, 0.02, 0), kn, 0.09, 0.062))
    add('thigh_' + k, 0.03, ellipsoid(hj + v * 0.19 + v3(0.018, 0, 0), [0.17, 0.072, 0.076], F))
    add('thigh_' + k, 0.03, ellipsoid(hj + v * 0.21 + v3(-0.018, 0, 0), [0.16, 0.068, 0.072], F))
    add('shin_' + k, 0.02, cone(kn, an, 0.054, 0.035))
    add('shin_' + k, 0.02, ellipsoid(kn + v * 0.12 + v3(-0.014, 0, 0), [0.1, 0.045, 0.047], F))   # calf
    add('foot_' + k, 0.015, cone(an, an + v3(0.1, -0.045, 0), 0.036, 0.028))


def body_shapes(head=True, hands=False, athletic=False):
    """head: the head is part of the body (batter); else a neck stub (fielder: heads are separate meshes).
    hands: fingers and thumb (fielder); else wrist stubs (the batter's hands are the gloves)."""
    S = []
    add = lambda lab, k, s: S.append((lab, k) + s)
    torso_shapes(add, athletic)
    neck_shapes(add, head, athletic)
    if head:
        head_shapes(add)
    for k in ('L', 'R'):
        arm_shapes(add, k, hands)
        leg_shapes(add, k)
    return S


# ---------------------------------------------------------------- Blender helpers
MATS = {}       # name -> (srgb colour, roughness, tint srgb or None); set by the model script before build
_mats = {}
ATLAS = {'img': None}


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


def material(n):
    """Principled material n from MATS. Base colour = mix(colour, tint, atlas.a) * atlas.rgb once the atlas exists
    (set_atlas_nodes), so the Blender renders show what the game shows."""
    if n not in _mats:
        m = bpy.data.materials.new(n)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        c, r = MATS[n][0], MATS[n][1]
        bsdf.inputs['Base Color'].default_value = (*to_lin(c), 1)
        bsdf.inputs['Roughness'].default_value = r
        if n == 'grille':
            bsdf.inputs['Metallic'].default_value = 0.7
        _mats[n] = m
    return _mats[n]


def set_atlas_nodes(img):
    for n, m in _mats.items():
        nt = m.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        c, tint = MATS[n][0], MATS[n][2] if len(MATS[n]) > 2 else None
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MIX'
        mix.inputs[6].default_value = (*to_lin(tint or c), 1)   # alpha 0 -> tint
        mix.inputs[7].default_value = (*to_lin(c), 1)           # alpha 1 -> the plain colour
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Factor'])
        mul = nt.nodes.new('ShaderNodeMix')
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1
        nt.links.new(mix.outputs[2], mul.inputs[6])
        nt.links.new(tex.outputs['Color'], mul.inputs[7])
        nt.links.new(mul.outputs[2], bsdf.inputs['Base Color'])
        nt.nodes.active = tex


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


def sdf_bounds(shapes, h, margin=0.02):
    """grid box around every finite shape box (half-spaces excluded) with a margin, so no surface is cut open at the
    grid (an open mesh makes the voxel remesh collapse)"""
    fin = [(np.asarray(a), np.asarray(b)) for lab, k, fn, a, b in shapes if np.all(np.abs(a) < 8)]
    lo = np.min([a for a, b in fin], 0) - margin - 2 * h
    hi = np.max([b for a, b in fin], 0) + margin + 2 * h
    return lo, hi


def sdf_object(name, shapes, lo, hi, h, target, smooth=2, mats=None, keep=None, keepf=0.04):
    """surface nets -> voxel remesh (manifold) -> smooth -> decimate. Decimation without its symmetry option: with it,
    faces along the mirror plane fold over. keep(game verts) -> 0..1 weights where decimation keeps more detail.
    lo/hi None: the grid is fitted to the shapes (sdf_bounds)."""
    if lo is None or hi is None:
        lo, hi = sdf_bounds(shapes, h)
    v, q = sdf.mesh(shapes, lo, hi, h)
    ob = new_object(name, v, q, mats)
    n = keep_largest(ob)
    apply_mod(ob, 'REMESH', mode='VOXEL', voxel_size=h, adaptivity=0)
    if smooth:
        apply_mod(ob, 'SMOOTH', factor=0.5, iterations=smooth)
    kw = {}
    if keep:   # inverted weight 0 is never collapsed and small factors already bite hard, hence 0.5 and 0.04
        vg = ob.vertex_groups.new(name='keep')
        for i, w in enumerate(keep(game_verts(ob))):
            vg.add([i], 0.5 * float(w), 'REPLACE')
        kw = dict(vertex_group='keep', vertex_group_factor=float(keepf), invert_vertex_group=True)
    apply_mod(ob, 'DECIMATE', ratio=min(1.0, target / max(1, tris(ob))), **kw)
    if keep:
        ob.vertex_groups.remove(ob.vertex_groups['keep'])
    log('%s: %d quads -> %d tris (%d parts)' % (name, len(q), tris(ob), n))
    return ob


def game_verts(ob):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)


def face_centres(ob):
    gv = game_verts(ob)
    return np.array([gv[list(p.vertices)].mean(0) for p in ob.data.polygons])


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


def dissolve_degenerate(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.validate()


def shade_smooth(ob):
    ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
    ob.data.update()


def triangulate(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='SHORT_EDGE')
    bm.to_mesh(ob.data)
    bm.free()


def join(target, others):
    activate(target)
    for o in others:
        o.select_set(True)
    bpy.ops.object.join()
    return target


# ---------------------------------------------------------------- parametric surfaces (kit)
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


def head_frame_pts(V):
    """head frame of 07-render3d.js (x lateral, y up, z forward, origin at the head centre) -> rest game coordinates"""
    hc = P('head_c')
    return [hc + v3(p[2], p[1], -p[0]) for p in V]


# ---------------------------------------------------------------- skinning
def skin_to(ob, arm, b0, b1, w):
    """skins ob to two bones: weight w (per vertex) on b1, 1 - w on b0"""
    ob.parent = arm
    ob.modifiers.new('rig', 'ARMATURE').object = arm
    g0, g1 = ob.vertex_groups.new(name=b0), ob.vertex_groups.new(name=b1)
    for i, x in enumerate(w):
        if x < 0.999:
            g0.add([i], 1 - float(x), 'REPLACE')
        if x > 0.001:
            g1.add([i], float(x), 'REPLACE')


def group_weights(ob, names):
    col = {}
    for j, n in enumerate(names):
        g = ob.vertex_groups.get(n)
        if g:
            col[g.index] = j
    W = np.zeros((len(ob.data.vertices), len(names)))
    for v in ob.data.vertices:
        for g in v.groups:
            if g.group in col:
                W[v.index, col[g.group]] = g.weight
    return W


def set_group_weights(ob, names, W, eps=1e-4):
    every = list(range(len(ob.data.vertices)))
    for j, n in enumerate(names):
        vg = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)
        vg.remove(every)
        for i in np.nonzero(W[:, j] > eps)[0]:
            vg.add([int(i)], float(W[i, j]), 'REPLACE')


def smooth_weights(ob, zones, iters=4, f=0.5):
    """Laplacian smoothing of every group's weights on the vertices inside zones [(centre, radius)]"""
    names = [g.name for g in ob.vertex_groups]
    W, gv = group_weights(ob, names), game_verts(ob)
    mask = np.zeros(len(gv), bool)
    for c, r in zones:
        mask |= np.linalg.norm(gv - c, axis=1) < r
    E = np.array([[e.vertices[0], e.vertices[1]] for e in ob.data.edges])
    deg = np.maximum(np.bincount(E.ravel(), minlength=len(gv)), 1)
    for _ in range(iters):
        S = np.zeros_like(W)
        np.add.at(S, E[:, 0], W[E[:, 1]])
        np.add.at(S, E[:, 1], W[E[:, 0]])
        W[mask] = (1 - f) * W[mask] + f * (S / deg[:, None])[mask]
    W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
    set_group_weights(ob, names, W)
    log('smoothed weights on %d vertices' % mask.sum())


TWIST_RAMP = (0.1, 0.9)   # share of the parent bone's weight moved to its twist bone: 0 at the head -> 1 at the tail


def twist_split(ob):
    """rig v2: each arm bone keeps its weight near the head and hands it to the twist bone toward the tail"""
    gv = game_verts(ob)
    for tw, par in rig.TWIST.items():
        k, up = par[-1], par.startswith('upper')
        a, b = (P('shoulder_' + k), P('elbow_' + k)) if up else (P('elbow_' + k), P('hand_' + k))
        u = b - a
        t = ((gv - a) @ u) / (u @ u)
        sh = smooth01((t - TWIST_RAMP[0]) / (TWIST_RAMP[1] - TWIST_RAMP[0]))
        gp, gt = ob.vertex_groups[par], ob.vertex_groups.new(name=tw)
        moved = [(v.index, g.weight) for v in ob.data.vertices for g in v.groups if g.group == gp.index and g.weight > 0]
        n = 0
        for i, w in moved:
            x = sh[i]
            if x > 0.001:
                gt.add([i], float(w * x), 'REPLACE')
                gp.add([i], float(w * (1 - x)), 'REPLACE')
                n += 1
        log('%s: %d of %d vertices share %s' % (tw, n, len(moved), par))


def auto_skin(body, arm):
    """automatic weights for the 19 deform bones, cleaned to 4 influences, smoothed shoulder/elbow blends, twist share"""
    for n in rig.TWIST:
        arm.data.bones[n].use_deform = False
    activate(body)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for n in rig.TWIST:
        arm.data.bones[n].use_deform = True
    activate(body)
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.01)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    smooth_weights(body, [(P('shoulder_' + k), 0.13) for k in 'LR'] + [(P('elbow_' + k), 0.09) for k in 'LR'])
    twist_split(body)
    activate(body)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    used = {g.group for v in body.data.vertices for g in v.groups}
    log('bones without weights:', [g.name for g in body.vertex_groups if g.index not in used])


def parent_to_bone(ob, arm, bone):
    from mathutils import Matrix
    activate(ob)
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    pb = arm.pose.bones[bone]
    tail = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    ob.matrix_parent_inverse = tail.inverted()


# ---------------------------------------------------------------- UVs: smart project, islands, shelf packing
def unwrap(ob, angle=89.0):
    """smart project every face (object space = game metres, so islands keep their world scale across objects)"""
    activate(ob)
    if not ob.data.uv_layers:
        ob.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=0.0, area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def uv_arrays(ob):
    me = ob.data
    n = len(me.loops)
    uv = np.empty(n * 2)
    me.uv_layers.active.data.foreach_get('uv', uv)
    vi = np.empty(n, np.int32)
    me.loops.foreach_get('vertex_index', vi)
    ls = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_start', ls)
    mi = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('material_index', mi)
    return uv.reshape(-1, 2), vi, ls, mi


def set_uvs(ob, uv):
    ob.data.uv_layers.active.data.foreach_set('uv', np.ascontiguousarray(uv, dtype=np.float32).ravel())
    ob.data.update()


def islands(uv, vi, ls, groups):
    """island id per face (triangles): faces joined when they share a vertex at the same UV and the same group"""
    nf = len(ls)
    key = np.stack([vi, np.round(uv[:, 0] * 2e4).astype(np.int64), np.round(uv[:, 1] * 2e4).astype(np.int64)], 1)
    face = np.repeat(np.arange(nf), 3)
    kid = np.unique(key, axis=0, return_inverse=True)[1].ravel()
    kid = kid * (groups.max() + 1) + groups[face]
    parent = np.arange(nf)

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    order = np.argsort(kid, kind='stable')
    ks, fs = kid[order], face[order]
    same = np.nonzero(ks[1:] == ks[:-1])[0]
    for a, b in zip(fs[same], fs[same + 1]):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    roots = np.array([find(i) for i in range(nf)])
    return np.unique(roots, return_inverse=True)[1].ravel()


def pack(items, rect, margin_px, size, aspect=1.0):
    """shelf-packs UV islands into rect (u0, v0, u1, v1) of a size^2 atlas with margin_px texels between islands.
    items: [(uv (n,2), face loops of one island)]; returns the uniform scale and the per-item offsets. Every item keeps
    its orientation; the scale is the largest that fits (bisection)."""
    boxes = [(uv.min(0), uv.max(0)) for uv in items]
    ext = np.array([b[1] - b[0] for b in boxes])
    W, Hh = (rect[2] - rect[0]), (rect[3] - rect[1])
    m = margin_px / size
    order = np.argsort(-ext[:, 1])

    def layout(s):
        """skyline bottom-left: each island goes where the skyline is lowest among the places it fits"""
        sky = [(0.0, 0.0, W)]   # (x, top y, width) left to right
        pos = np.zeros((len(items), 2))
        for i in order:
            w, h = ext[i] * s + m
            if w > W + 1e-9:
                return None
            best = None
            for idx, (sx, sy, sw) in enumerate(sky):
                if sx + w > W + 1e-9:
                    break
                y, j = sy, idx
                while j < len(sky) and sky[j][0] < sx + w - 1e-12:
                    y = max(y, sky[j][1])
                    j += 1
                if y + h > Hh + 1e-9:
                    continue
                if best is None or y < best[0] - 1e-12:
                    best = (y, sx)
            if best is None:
                return None
            y, sx = best
            pos[i] = (sx + m / 2, y + m / 2)
            out = [(sx, y + h, w)]
            for tx, ty, tw in sky:
                if tx + tw <= sx + 1e-12 or tx >= sx + w - 1e-12:
                    out.append((tx, ty, tw))
                else:
                    if tx < sx - 1e-12:
                        out.append((tx, ty, sx - tx))
                    if tx + tw > sx + w + 1e-12:
                        out.append((sx + w, ty, tx + tw - sx - w))
            out.sort()
            sky = []
            for seg in out:   # merge level neighbours
                if sky and abs(sky[-1][1] - seg[1]) < 1e-12:
                    sky[-1] = (sky[-1][0], sky[-1][1], sky[-1][2] + seg[2])
                else:
                    sky.append(seg)
        return pos
    lo, hi = 1e-6, 1e3
    for _ in range(60):
        mid = math.sqrt(lo * hi)
        if layout(mid) is None:
            hi = mid
        else:
            lo = mid
    pos = layout(lo)
    return lo, [(rect[0] + pos[i][0] - boxes[i][0][0] * lo, rect[1] + pos[i][1] - boxes[i][0][1] * lo) for i in range(len(items))]


def tri_areas(p):
    """p: (n, 3, d) triangle corners -> areas (2D or 3D)"""
    a, b = p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]
    if p.shape[2] == 2:
        return 0.5 * np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0])
    return 0.5 * np.linalg.norm(np.cross(a, b), axis=1)


def normalise_island(puv, pw, density=1.0):
    """island UVs scaled so UV area = world area x density^2 (one texel density everywhere, whatever smart_project did per
    object; density > 1 gives an object, e.g. a face, more texels per metre) and turned so the island's long axis is
    vertical (shelf rows pack taller-than-wide boxes better)"""
    s = density * math.sqrt(tri_areas(pw.reshape(-1, 3, 3)).sum() / max(1e-12, tri_areas(puv.reshape(-1, 3, 2)).sum()))
    q = puv * s
    c = q.mean(0)
    d = q - c
    cov = d.T @ d
    w, v = np.linalg.eigh(cov)
    ax = v[:, np.argmax(w)]
    ang = math.atan2(ax[1], ax[0])
    rot = math.pi / 2 - ang
    R = np.array([[math.cos(rot), -math.sin(rot)], [math.sin(rot), math.cos(rot)]])
    return d @ R.T + c


def layout_atlas(entries, size, margin_px=4):
    """entries: [(ob, region_of_face (nf,) ints, {region: rect}[, density])]: packs every island of every object into its
    region's rect (one rect for a single-atlas model), sharing one texel scale per rect (times the object's density).
    Writes the UVs back. Returns, per object, the arrays rasterise() needs."""
    per_rect = {}
    data = []
    for e in entries:
        ob, reg, rects = e[:3]
        density = e[3] if len(e) > 3 else 1.0
        uv, vi, ls, mi = uv_arrays(ob)
        isl = islands(uv, vi, ls, reg)
        gv = game_verts(ob)
        data.append([ob, uv, vi, ls, mi, reg, isl])
        for i in np.unique(isl):
            faces = np.nonzero(isl == i)[0]
            loops = (ls[faces][:, None] + np.arange(3)).ravel()
            r = tuple(rects[int(reg[faces[0]])])
            per_rect.setdefault(r, []).append((len(data) - 1, loops, normalise_island(uv[loops], gv[vi[loops]], density)))
    for r, items in per_rect.items():
        s, offs = pack([it[2] for it in items], r, margin_px, size)
        for (di, loops, puv), off in zip(items, offs):
            data[di][1][loops] = puv * s + np.array(off)
        log('rect %s: %d islands, %.0f texels/m' % (str([round(x, 2) for x in r]), len(items), s * size))
    out = []
    for ob, uv, vi, ls, mi, reg, isl in data:
        set_uvs(ob, uv)
        out.append((ob, uv, vi, ls, mi, reg))
    return out


def rasterise(data, size):
    """per texel: game position (interpolated), region/material id (-1 = none), object index, coverage. Texel (i, j) =
    column i (u), row j (v, bottom row first, as Blender's image pixels)."""
    pos = np.zeros((size, size, 3), np.float32)
    rid = np.full((size, size), -1, np.int16)
    oid = np.full((size, size), -1, np.int16)
    nrm = np.zeros((size, size, 3), np.float32)
    for k, (ob, uv, vi, ls, mi, reg) in enumerate(data):
        gv = game_verts(ob)
        nf = len(ls)
        T = uv[(ls[:, None] + np.arange(3)).ravel()].reshape(nf, 3, 2) * size - 0.5
        V = gv[vi[(ls[:, None] + np.arange(3)).ravel()]].reshape(nf, 3, 3)
        N = np.cross(V[:, 1] - V[:, 0], V[:, 2] - V[:, 0])
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
        lo = np.floor(T.min(1)).astype(int)
        hi = np.ceil(T.max(1)).astype(int)
        for f in range(nf):
            a, b, c = T[f]
            x0, y0 = np.maximum(lo[f], 0)
            x1, y1 = np.minimum(hi[f], size - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1), indexing='ij')
            px, py = xs.ravel().astype(float), ys.ravel().astype(float)
            d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
            if abs(d) < 1e-12:
                continue
            w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / d
            w2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / d
            w0 = 1 - w1 - w2
            eps = -0.002
            inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
            if not inside.any():
                continue
            ix, iy = xs.ravel()[inside], ys.ravel()[inside]
            ws = np.stack([w0[inside], w1[inside], w2[inside]], 1)
            pos[ix, iy] = ws @ V[f]
            nrm[ix, iy] = N[f]
            rid[ix, iy] = reg[f]
            oid[ix, iy] = k
    cov = rid >= 0
    log('rasterised %d objects: %.1f%% of %d^2 texels covered' % (len(data), 100 * cov.mean(), size))
    return pos, rid, oid, nrm, cov


def dilate(img, cov, steps=6):
    """fills uncovered texels from covered neighbours, one ring per step (keeps bilinear filtering off the gaps)"""
    img = img.copy()
    cov = cov.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        cnt = np.zeros(cov.shape, np.float32)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(img, dx, 0), dy, 1)
            sc = np.roll(np.roll(cov, dx, 0), dy, 1)
            acc += sh * sc[..., None] if img.ndim == 3 else sh * sc
            cnt += sc
        fill = (~cov) & (cnt > 0)
        if img.ndim == 3:
            img[fill] = acc[fill] / cnt[fill][:, None]
        else:
            img[fill] = acc[fill] / cnt[fill]
        cov = cov | fill
    return img


# ---------------------------------------------------------------- ambient occlusion bake (Cycles, every object visible)
def bake_ao(objs, size, samples=32, groups=None):
    """groups: [(objects to bake, objects visible)] when some kit must not occlude the body (the keeper's gauntlets and
    pads are worn by one fielder only); default: every object baked with every object visible"""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.12
    img = bpy.data.images.new('ao', size, size, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    px = np.zeros(size * size * 4, np.float32)
    img.pixels.foreach_set(px)
    for m in _mats.values():
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.name = 'bake'
        nt.nodes.active = tex
    sc.render.bake.target = 'IMAGE_TEXTURES'
    sc.render.bake.use_clear = False
    sc.render.bake.margin = 2
    sc.render.bake.use_selected_to_active = False
    for bake, visible in groups or [(objs, objs)]:
        for o in objs:
            o.hide_render = o not in visible
        activate(bake[0])
        for o in bake:
            o.select_set(True)
        bpy.ops.object.bake(type='AO')
    for o in objs:
        o.hide_render = False
    img.pixels.foreach_get(px)
    ao = px.reshape(size, size, 4)[:, :, 0].T.copy()   # (u, v) indexing like rasterise()
    for m in _mats.values():
        m.node_tree.nodes.remove(m.node_tree.nodes['bake'])
    bpy.data.images.remove(img)
    log('ao baked: mean %.2f' % ao.mean())
    return ao


# ---------------------------------------------------------------- atlas painting helpers (texel positions in game metres)
def band(d, w, soft=0.0015):
    """1 inside |d| < w, soft edge"""
    return smooth01((w - np.abs(d)) / soft + 0.5)


def ramp(x, a, b):
    return smooth01((x - a) / (b - a))


DIGITS = {  # 5x7 bitmap digits
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100']}


def digits_mask(u, v, text, h):
    """text drawn in a box of height h (width 5/7 h per digit, a 1/7 h gap) centred at (0,0) in the (u, v) plane; u right,
    v up; returns 0/1 coverage per sample (rounded corners by a half-cell soft edge)"""
    cell = h / 7
    w = len(text) * 6 * cell - cell
    out = np.zeros_like(u)
    x0 = -w / 2
    for ch in text:
        rows = DIGITS.get(ch)
        if rows:
            for r, row in enumerate(rows):
                for c, bit in enumerate(row):
                    if bit == '1':
                        cx, cy = x0 + (c + 0.5) * cell, h / 2 - (r + 0.5) * cell
                        out = np.maximum(out, band(u - cx, cell * 0.55, cell * 0.35) * band(v - cy, cell * 0.55, cell * 0.35))
        x0 += 6 * cell
    return np.clip(out, 0, 1)


def noise2(x, y, seed=3):
    """cheap value noise in [0,1) on a 2D domain (texel positions in metres scaled by the caller)"""
    xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def h(a, b):
        n = (a * 374761393 + b * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        return ((n ^ (n >> 16)) & 0xFFFF) / 65536.0
    return (h(xi, yi) * (1 - fx) + h(xi + 1, yi) * fx) * (1 - fy) + (h(xi, yi + 1) * (1 - fx) + h(xi + 1, yi + 1) * fx) * fy


def weave(p, scale=900.0, amount=0.05):
    """faint cloth weave: two crossed frequencies on the position's y and the horizontal angle"""
    a = np.arctan2(p[:, 2], p[:, 0] + 1e-9)
    s = 0.5 + 0.5 * np.sin(p[:, 1] * scale) * np.sin(a * scale * 0.08 + p[:, 0] * scale)
    return 1 - amount * s


# ---------------------------------------------------------------- PNG, export, renders
def write_png(path, rgba8):
    """rgba8: (size_u, size_v, 4) uint8 indexed (u, v) with v = 0 the bottom row -> PNG rows top first"""
    img = np.transpose(rgba8, (1, 0, 2))[::-1]   # rows = v from the top, columns = u
    h, w = img.shape[:2]
    raw = b''.join(b'\x00' + img[r].tobytes() for r in range(h))

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def encode_srgb(lin):
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def finish_atlas(rgb_lin, tint_mask, cov, path):
    """dilates, encodes and writes the atlas (alpha = 1 - tint mask); loads it as the Blender image used by the materials
    and the export"""
    rgb = dilate(rgb_lin, cov)
    a = 1 - dilate(tint_mask, cov)
    rgba = np.concatenate([encode_srgb(rgb), np.clip(a, 0, 1)[..., None]], 2)
    write_png(path, np.round(rgba * 255).astype(np.uint8))
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'sRGB'
    img.alpha_mode = 'CHANNEL_PACKED'
    ATLAS['img'] = img
    set_atlas_nodes(img)
    log('atlas %s: %d bytes png' % (os.path.basename(path), os.path.getsize(path)))
    return img


def export(path, arm, objs, quality=82):
    activate(arm)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_texcoords=True,
                              export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_image_format='WEBP', export_image_quality=quality, export_image_add_webp=False,
                              export_image_webp_fallback=False, export_vertex_color='NONE', export_extras=True,
                              export_yup=True, export_apply=False, export_animations=False, export_skins=True,
                              export_influence_nb=4, export_def_bones=False, export_rest_position_armature=True,
                              export_leaf_bone=False)
    log('exported', path, os.path.getsize(path), 'bytes')


def render_setup(res=(600, 900)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
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
    gm.use_nodes = True
    gm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.2, 0.35, 0.15, 1)
    gr.data.materials.append(gm)
    sc.collection.objects.link(gr)
    return cam


def bat_objects(bat):
    """render-only bat from the game's pose: handle (radius 0.017) H+0.04d..H+0.30d, blade H+0.28d..H+0.86d facing n"""
    from mathutils import Matrix, Vector
    H, d, n = (np.array(bat[k]) for k in ('H', 'd', 'fn' if 'fn' in bat else 'n'))
    x = np.cross(d, n)
    obs = []
    for nm, c, sz, mat in (('handle', H + d * 0.17, (0.017, 0.13, 0.017), 'grip'), ('blade', H + d * 0.57 - n * 0.012, (0.054, 0.29, 0.022), 'blade')):
        me = bpy.data.meshes.new(nm)
        bm = bmesh.new()
        if nm == 'handle':
            bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1, radius2=1, depth=2)
            bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        else:
            bmesh.ops.create_cube(bm, size=2)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(nm, me)
        bpy.context.scene.collection.objects.link(ob)
        M = Matrix([list(rig.g2b(x * sz[0])) + [0], list(rig.g2b(d * sz[1])) + [0], list(rig.g2b(n * sz[2])) + [0], [0, 0, 0, 1]]).transposed()
        M.translation = Vector(rig.g2b(c))
        ob.matrix_world = M
        m = bpy.data.materials.new(mat)
        m.use_nodes = True
        m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*to_lin((0.2, 0.15, 0.1) if mat == 'grip' else (0.86, 0.74, 0.55)), 1)
        me.materials.append(m)
        obs.append(ob)
    return obs


def shoot(cam, path, az, el=8, dist=4.6, look=(0, 0, 0.95)):
    from mathutils import Vector
    a, e = math.radians(az), math.radians(el)
    t = Vector(look)
    cam.location = t + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


TURNS = [[0, 8], [-90, 8], [180, 8], [-45, 15]]   # front (the model faces +x = Blender +x), side, back, three-quarter


def render_poses(arm, poses, out_dir, rest_views=TURNS, close=None):
    """renders the rest pose and every pose in poses (the lab's poses.json / __lab.drive() shape) from its views.
    view = [azimuth, elevation, distance, look height | 'bone' | 'bone@f']; close = [(tag, dist, bone@f)] extra close-ups."""
    os.makedirs(out_dir, exist_ok=True)
    cam = bpy.context.scene.camera or render_setup()
    for name, tg in [('rest', None)] + list(poses.items()):
        for pb in arm.pose.bones:
            pb.location = (0, 0, 0)
            pb.rotation_quaternion = (1, 0, 0, 0)
        bpy.context.view_layer.update()
        if tg:
            rig.pose_armature(arm, tg)
        views = list(tg.get('views', [[-60, 8]])) if tg else list(rest_views)
        for tag, dist, at in (close or []):
            views.append([-50, 10, dist, at, tag])
        look = rig.g2b(tg['root']) if tg else (0, 0, 0.95)
        bat = bat_objects(tg['bat']) if tg and tg.get('bat') else []
        for v in views:
            at = v[3] if len(v) > 3 else 0.95
            tag = ('_' + (v[4] if len(v) > 4 else at.partition('@')[0])) if isinstance(at, str) else '_close' if len(v) > 2 else ''
            if isinstance(at, str):
                n, _, f = at.partition('@')
                pb = arm.pose.bones[n]
                at = tuple(arm.matrix_world @ pb.head.lerp(pb.tail, float(f or 0)))
            else:
                at = (look[0], look[1], at)
            shoot(cam, os.path.join(out_dir, '%s%s_%d.png' % (name.replace('@', '_'), tag, v[0])), v[0], v[1], v[2] if len(v) > 2 else 4.6, at)
        for o in bat:
            bpy.data.objects.remove(o)
    log('renders in', out_dir)


def arm_pose(rot_deg_down=70, elbow_deg=12):
    """drive targets for a relaxed standing pose from the rest pose: arms rot_deg_down below horizontal, elbows soft"""
    out = {'root': list(J['hip']), 'bones': {}, 'pins': {}}
    spec = {b[0]: b for b in rig.bones()}
    for n, parent, h, t, ref in rig.bones():
        out['bones'][n] = {'a': [float(x) for x in norm(np.subtract(t, h))], 'r': list(ref), 'p': list(h)}
    for k, s in (('L', 1), ('R', -1)):
        sh = P('shoulder_' + k)
        a = math.radians(rot_deg_down)
        u = v3(0.0, -math.sin(a), s * math.cos(a))
        e = math.radians(elbow_deg)
        f = norm(u * math.cos(e) + v3(1, 0, 0) * math.sin(e))
        el = sh + u * L['upperarm']
        hd = el + f * L['forearm']
        for n, aim, p in (('upperarm_' + k, u, sh), ('forearm_' + k, f, el), ('hand_' + k, f, hd),
                          ('uarm_tw_' + k, u, (sh + el) / 2), ('farm_tw_' + k, f, (el + hd) / 2)):
            out['bones'][n]['a'] = [float(x) for x in aim]
            out['bones'][n]['p'] = [float(x) for x in p]
            out['bones'][n]['r'] = [-1.0, 0.0, 0.0] if 'hand' not in n else [1.0, 0.0, 0.0]
    return out


def report(objs):
    total = 0
    for o in objs:
        t = tris(o)
        total += t
        log('  %-14s %5d tris' % (o.name, t))
    log('triangles total %d' % total)
    return total


# ---------------------------------------------------------------- shoes (shared: batter and fielders)
def shoe_shapes(k, lab='shoe'):
    """spiked shoe .28 m long (heel -0.105 .. toe 0.175 from the ankle) with a sole plate and toe spring: the tip sits
    1.5 cm up, so a foot pitched onto its toes (back foot in a drive, a kneeling sweep) does not dig into the ground.
    Spikes are painted on the sole. Origin at the ankle, sole ankle_h below it."""
    a = P('ankle_' + k)
    sole = -L['ankle_h']
    A = lambda x, y, z: a + v3(x, y, z)
    return [(lab, 0) + ellipsoid(A(0.035, sole + 0.04, 0), [0.135, 0.046, 0.05]),
            (lab, 0.03) + ellipsoid(A(-0.055, sole + 0.046, 0), [0.05, 0.05, 0.046]),
            (lab, 0.03) + ellipsoid(A(0.125, sole + 0.031, 0), [0.05, 0.029, 0.045]),
            (lab, 0.025) + cone(A(-0.01, sole + 0.04, 0), A(-0.015, sole + 0.1, 0), 0.047, 0.043),
            (lab, 0.004) + box(A(0.02, sole + 0.008, 0), [0.125, 0.009, 0.054], 0.008),
            (lab, -0.002) + sdf.plane(A(0, sole, 0), [0, 1, 0])]


def build_shoe(k, mat='shoe', target=300):
    ob = sdf_object('shoe_' + k, shoe_shapes(k), None, None, 0.003, target, smooth=1, mats=[mat])
    triangulate(ob)
    shade_smooth(ob)
    return ob


# ---------------------------------------------------------------- pads (batting pads; the keeper's are shorter)
PAD_HINGE = (0.012, 0.05)   # pad -> thigh weight from 1.2 cm above the knee joint over 5 cm (the knee roll top)
PADK = [[-.27, .055, .062], [-.2, .066, .08], [0, .074, .086], [.17, .078, .09], [.215, .084, .1], [.26, .08, .094],
        [.3, .074, .082], [.335, .066, .07]]
KNEE_ROLLS = (0.2, 0.235, 0.27)
PAD_FRAME = {}


def pad_frame(k):
    an, kn, t = P('ankle_' + k), P('knee_' + k), v3(1, 0, 0)
    Yv = norm(kn - an)
    Xv = norm(np.cross(Yv, t))
    Zv = np.cross(Xv, Yv)
    return (an + kn) / 2, Xv, Yv, Zv


def build_pad(k, bottom=-0.27, top=0.335, name='pad', segs=(28, 8)):
    """the procedural pad profile (padG in 07-geometry.js): ribbed front, a three-roll knee roll, an inner wing; open
    behind the thigh above the knee, where the flap is skinned to the thigh (PAD_HINGE) so a deep lunge bends it.
    bottom/top: metres from the shin's midpoint along it (keeper: -0.24, 0.22)"""
    span = top - bottom
    rows = sorted(set(lin(7, 0, 1) + [(y - bottom) / span for y in (0.19, 0.2175, 0.2525, 0.285) if bottom < y < top]))
    segs = [math.pi * i / segs[0] for i in range(segs[0])] + [math.pi + math.pi * (i + 0.5) / segs[1] for i in range(segs[1])]
    inner = 1 if k == 'L' else -1
    s01 = lambda x: min(1.0, max(0.0, x)) ** 2 * (3 - 2 * min(1.0, max(0.0, x)))

    def f(v, a):
        y = bottom + span * v
        _, hw, fz = crv(PADK, y)
        e = math.sqrt(min(1, max(0, (y - bottom) / 0.045)) * min(1, max(0, (top - y) / 0.05)))
        e = max(e, 0.35)
        c, s = math.cos(a), math.sin(a)
        fr = max(0.0, s)
        rid = fr * (0.006 * (0.5 - 0.5 * math.cos(a * 14)) + sum(0.009 * math.exp(-((y - r) / 0.012) ** 2) for r in KNEE_ROLLS if r < top - 0.03))
        wing = 1 + 0.14 * max(0.0, inner * c) * s01((y + 0.12) / 0.08) * s01((min(top, 0.24) - y) / 0.08)
        e *= 1 - 0.16 * min(1, max(0, -s / 0.5)) * min(1, max(0, (y - 0.19) / 0.04))   # flap edges tuck in against the thigh
        return (e * (hw * wing + rid) * c, y, e * (fz + rid if s > 0 else 0.062) * s)
    V, Q = surf(rows, segs, f)
    n = len(segs)
    keep = []
    for q in Q:
        r, i = q[0] // n, q[0] % n
        y = bottom + span * rows[r]
        if y > 0.2 and math.sin(segs[i] + math.pi / n) < -0.3:
            continue
        keep.append(q)
    c, Xv, Yv, Zv = pad_frame(k)
    PAD_FRAME[k] = (c, Xv, Yv, Zv)
    Vg = [c + Xv * p[0] + Yv * p[1] + Zv * p[2] for p in V]
    ob = new_object(name + '_' + k, Vg, keep, ['pad' if 'pad' in MATS else list(MATS)[0]], outward=True)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bottom_vs = [bm.verts[i] for i in range(n)]
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if all(v in bottom_vs for v in e.verts)])
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    triangulate(ob)
    shade_smooth(ob)
    return ob


def skin_pad(ob, arm, k):
    an, kn = P('ankle_' + k), P('knee_' + k)
    skin_to(ob, arm, 'shin_' + k, 'thigh_' + k, smooth01(((game_verts(ob) - kn) @ norm(kn - an) - PAD_HINGE[0]) / PAD_HINGE[1]))


def paint_pad(p, ao, straps=(-0.16, 0.02, 0.17)):
    """satin pad: shallow rib grooves on the front, the gaps between the knee rolls, three grey straps with buckles on the back"""
    rgb = np.repeat((1 - 0.72 * (1 - ao))[:, None], 3, 1)
    for k, (c, Xv, Yv, Zv) in PAD_FRAME.items():
        q = p - c
        x, y, z = q @ Xv, q @ Yv, q @ Zv
        here = (np.abs(y) < 0.4) & (np.hypot(x, z) < 0.16)
        ang = np.arctan2(z, x)
        frontal = ramp(np.sin(ang), 0.05, 0.3)
        grooves = frontal * ramp(-np.cos(ang * 14), 0.75, 0.97) * (y < 0.185) * (y > -0.25)
        rgb *= (1 - 0.28 * grooves * here)[:, None]
        for r in KNEE_ROLLS:
            rgb *= (1 - 0.3 * frontal * band(y - (r + 0.0175), 0.0025, 0.002) * here)[:, None]
        rgb *= (1 - 0.3 * frontal * band(y - 0.1825, 0.0025, 0.002) * here)[:, None]
        rgb *= (1 - 0.25 * frontal * band(y - 0.2875, 0.0025, 0.002) * here)[:, None]
        back = ramp(-np.sin(ang), 0.1, 0.4) * here
        for sy in straps:
            strap = back * band(y - sy, 0.011, 0.002)
            rgb = rgb * (1 - strap[:, None]) + strap[:, None] * v3(0.6, 0.6, 0.58)[None, :] * (1 - 0.4 * (1 - ao))[:, None]
            buckle = strap * ramp(np.abs(x - 0.035 * (1 if k == 'L' else -1)), 0.012, 0.008)
            rgb = rgb * (1 - buckle[:, None]) + buckle[:, None] * v3(0.42, 0.42, 0.4)[None, :]
    return rgb, np.zeros(len(p))
