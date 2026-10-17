"""Skeleton contract shared by every skinned person model (the batter now, species later with their own lengths).

Coordinates are GAME coordinates: metres, +x = forward (the off side for a batter in stance), +y = up,
+z = the person's LEFT. Game coordinates are left-handed, so a model authored here looks mirrored in Blender's
viewport; names follow the game (L = left = the front side of a right-handed batter). g2b() maps game -> Blender
(a proper rotation), and the glTF exporter's Y-up conversion maps it back, so the GLB holds game coordinates.

Rest pose: A-pose facing +x, legs spread LEG_SPREAD, arms ARM_DOWN below horizontal, all limbs straight.
Every bone stores two rest vectors as custom properties, exported as glTF extras (three: bone.userData):
  aim  the rest direction the bone points along (head -> tail)
  ref  a rest vector across it that fixes the twist
The game drives a bone by giving the same two vectors for the current pose (src/game/07-skin.js, skinVecs):
its rotation maps rest aim -> current aim and rest ref -> current ref (made perpendicular), so the runtime never
depends on Blender's or the exporter's bone axis conventions. Bone lengths equal the game's limb lengths, so
joints land on the pose's joints. Rig v2 (docs/characters.md): the game writes every bone's world matrix (position and
rotation), so a stretched limb is closed at the hands and feet, and four twist bones share the twist along the arms:
  uarm_tw_K  child of upperarm_K, head at the upper arm's midpoint: the elbow plane; the upper arm's root takes less
  farm_tw_K  child of forearm_K, head at the forearm's midpoint: the hand's twist; the forearm's root keeps the elbow plane
They carry no automatic weights: batter.py moves a smoothstep share of the parent's weights onto them along the bone.
"""
from math import cos, sin, radians

# Lengths (m). They are the batter's in 07-render3d.js batJoints(); species will pass their own dict.
HUMAN = dict(
    hip_half=0.10,     # hip joints sit +-hip_half along the hip axis ...
    hip_drop=0.04,     # ... and hip_drop below the hip centre (pelvis bone head)
    thigh=0.43, shin=0.43,
    ankle_h=0.08,      # ankle above the sole
    foot=0.14,         # foot bone, ankle -> ball of the foot (visual only)
    spine=0.22, chest=0.28,   # hip centre -> shoulder centre is spine + chest along the spine direction
    shoulder_half=0.19,
    clavicle=0.17,     # clavicle from near the sternum to the shoulder joint; it follows the arm a little (shrug)
    upperarm=0.31, forearm=0.30,  # forearm ends at the hand point: the grip on the bat handle
    hand=0.08,
    neck=0.17,         # shoulder centre -> base of the head
    head=0.20,         # head bone; the head centre is head_c along it
    head_c=0.06,
)
LEG_SPREAD = radians(6)
ARM_DOWN = radians(45)

X, Y, Z = (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)
NEG = lambda v: tuple(-a for a in v)
ADD = lambda a, b: tuple(x + y for x, y in zip(a, b))
SC = lambda a, s: tuple(x * s for x in a)


def g2b(p):
    """game (x, y, z) -> Blender (x, -z, y); the glTF exporter maps Blender (x, y, z) -> (x, z, -y)."""
    return (p[0], -p[2], p[1])


def joints(L=HUMAN):
    """Rest joint positions in game coordinates."""
    leg_len = L['thigh'] + L['shin']
    hip_y = L['ankle_h'] + leg_len * cos(LEG_SPREAD) + L['hip_drop']
    J = {'hip': (0.0, hip_y, 0.0)}
    J['chest'] = ADD(J['hip'], (0, L['spine'], 0))
    J['shoulders'] = ADD(J['hip'], (0, L['spine'] + L['chest'], 0))
    J['neck_top'] = ADD(J['shoulders'], (0, L['neck'], 0))
    J['head_c'] = ADD(J['neck_top'], (0, L['head_c'], 0))
    for s, k in ((1, 'L'), (-1, 'R')):
        arm = (0.0, -sin(ARM_DOWN), s * cos(ARM_DOWN))
        leg = (0.0, -cos(LEG_SPREAD), s * sin(LEG_SPREAD))
        J['arm_dir_' + k] = arm
        J['leg_dir_' + k] = leg
        J['shoulder_' + k] = ADD(J['shoulders'], (0, 0, s * L['shoulder_half']))
        J['clavicle_' + k] = ADD(J['shoulders'], (0, 0, s * (L['shoulder_half'] - L['clavicle'])))
        J['elbow_' + k] = ADD(J['shoulder_' + k], SC(arm, L['upperarm']))
        J['hand_' + k] = ADD(J['elbow_' + k], SC(arm, L['forearm']))
        J['hipj_' + k] = ADD(J['hip'], (0, -L['hip_drop'], s * L['hip_half']))
        J['knee_' + k] = ADD(J['hipj_' + k], SC(leg, L['thigh']))
        J['ankle_' + k] = ADD(J['knee_' + k], SC(leg, L['shin']))
    return J


def bones(L=HUMAN):
    """[(name, parent, head, tail, ref)] in parent-first order, game coordinates. aim = tail - head."""
    J = joints(L)
    B = [('pelvis', None, J['hip'], ADD(J['hip'], (0, -0.1, 0)), Z),
         ('spine', 'pelvis', J['hip'], J['chest'], Z),
         ('chest', 'spine', J['chest'], J['shoulders'], Z),
         ('neck', 'chest', J['shoulders'], J['neck_top'], X),
         ('head', 'neck', J['neck_top'], ADD(J['neck_top'], (0, L['head'], 0)), X)]
    for k in ('L', 'R'):
        a = J['arm_dir_' + k]
        B += [('clavicle_' + k, 'chest', J['clavicle_' + k], J['shoulder_' + k], Y),
              ('upperarm_' + k, 'clavicle_' + k, J['shoulder_' + k], J['elbow_' + k], NEG(X)),   # ref: elbow points back
              ('forearm_' + k, 'upperarm_' + k, J['elbow_' + k], J['hand_' + k], NEG(X)),
              ('hand_' + k, 'forearm_' + k, J['hand_' + k], ADD(J['hand_' + k], SC(a, L['hand'])), X),  # ref: bat axis
              ('thigh_' + k, 'pelvis', J['hipj_' + k], J['knee_' + k], X),               # ref: knee points forward
              ('shin_' + k, 'thigh_' + k, J['knee_' + k], J['ankle_' + k], X),           # ref: toe direction
              ('foot_' + k, 'shin_' + k, J['ankle_' + k], ADD(J['ankle_' + k], (L['foot'], 0, 0)), Y)]
    for k in ('L', 'R'):   # twist bones last: the first 19 keep their v1 order
        mid = lambda a, b: tuple((x + y) / 2 for x, y in zip(a, b))
        B += [('uarm_tw_' + k, 'upperarm_' + k, mid(J['shoulder_' + k], J['elbow_' + k]), J['elbow_' + k], NEG(X)),
              ('farm_tw_' + k, 'forearm_' + k, mid(J['elbow_' + k], J['hand_' + k]), J['hand_' + k], NEG(X))]
    return B


TWIST = {'uarm_tw_L': 'upperarm_L', 'farm_tw_L': 'forearm_L', 'uarm_tw_R': 'upperarm_R', 'farm_tw_R': 'forearm_R'}


def build_armature(name='rig', L=HUMAN):
    """Creates the armature in Blender (rest pose = contract) with aim/ref custom properties on every bone."""
    import bpy
    from mathutils import Vector
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    spec = bones(L)
    for n, parent, h, t, ref in spec:
        eb = arm.edit_bones.new(n)
        eb.head, eb.tail = Vector(g2b(h)), Vector(g2b(t))
        eb.align_roll(Vector(g2b(ref)))  # bone Z axis along ref (made perpendicular)
        if parent:
            eb.parent = arm.edit_bones[parent]
        eb.use_connect = False
        eb.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for n, parent, h, t, ref in spec:
        d = [b - a for a, b in zip(h, t)]
        l = sum(x * x for x in d) ** 0.5
        arm.bones[n]['aim'] = [round(x / l, 6) for x in d]
        arm.bones[n]['ref'] = list(ref)
    return ob


def pose_armature(ob, targets):
    """Poses the armature from game-space drive vectors {root: [x,y,z], bones: {name: {a: aim, r: ref, p: head}}, pins:
    {name: [x,y,z]}}, the same rule the game uses: bone rotation maps rest (aim, ref) to current (aim, ref); a bone with a
    head p (rig v2: every bone) is placed there, else the root moves and pinned bones (hands, feet) are placed on the
    pose's hand points and ankles (v1 dumps)."""
    import bpy
    from mathutils import Matrix, Vector

    def basis(a, r):
        a = Vector(a).normalized()
        r = (Vector(r) - a * a.dot(Vector(r))).normalized()
        return Matrix((a, r, a.cross(r))).transposed()

    for n, parent, h, t, ref in bones():
        pb = ob.pose.bones[n]
        rest = ob.data.bones[n].matrix_local.to_3x3()
        aim0 = Vector(g2b(ob.data.bones[n]['aim']))
        ref0 = Vector(g2b(ob.data.bones[n]['ref']))
        Lm = rest.transposed() @ basis(aim0, ref0)   # rest aim/ref in bone-local axes
        d = targets['bones'].get(n)
        if d is None:   # a v1 dump: a twist bone follows its parent
            d = targets['bones'][TWIST[n]]
        W = basis(g2b(d['a']), g2b(d['r'])) @ Lm.transposed()
        bpy.context.view_layer.update()
        pin = d.get('p') or targets.get('pins', {}).get(n)
        head = Vector(g2b(targets['root'] if parent is None and not pin else pin)) if parent is None or pin else pb.matrix.translation.copy()
        M = W.to_4x4()
        M.translation = head
        pb.matrix = M
    bpy.context.view_layer.update()
