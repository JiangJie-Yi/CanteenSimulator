"""The owner (老闆), standing at his grill when the shop's shut: boss.glb, node "Boss", about 0.95 tall, facing +z three, resting on y 0.

Made as the cooks of Overcooked 2 are: a big round head set straight down on a short, plump body that rounds off underneath (no legs, no
feet), no arms, floating mitten hands (a plump paddle and a thumb). His face is the one on his picture (ui/Avatar.tsx, role 'owner'): brown
hair cropped short, a twisted white headband (ねじり鉢巻) with a red strand through it knotted at his left, its two ends sticking out;
round-cornered glasses over big dark eyes, kind arched brows, a moustache, a smile, rosy cheeks, ears; a white kappōgi crossed at the
front over a red under-collar, its hem over checked cook's trousers, a red cord round the waist bowed at his left, 聞野 on his chest.
- his hands are separate nodes (BossHandL, BossHandR) so the game can move them, and so are the tongs and the fan he picks up
  (BossTongs, BossFan: hidden till he holds them).

Run:
    blender -b --factory-startup --python blender/boss.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "skin": pbr("BossSkin", lin("#d99a68"), rough=0.6),
    "cheek": pbr("BossCheek", lin("#ee8a78"), rough=0.6),
    "hair": pbr("BossHair", lin("#5a3a2a"), rough=0.6),
    "brow": pbr("BossBrow", lin("#3a2418"), rough=0.6),
    "coat": pbr("BossCoat", lin("#f7f3ea"), rough=0.75),
    "collar": pbr("BossCollar", lin("#d8cfbd"), rough=0.7),
    "red": pbr("BossRed", lin("#c4442f"), rough=0.6),
    "apron": pbr("BossApron", lin("#1e2a48"), rough=0.85),
    "cord": pbr("BossCord", lin("#e8dcc0"), rough=0.7),
    "band": pbr("BossBand", lin("#fbf8f2"), rough=0.6),
    "dark": pbr("BossDark", lin("#1c1410"), rough=0.4),
    "white": pbr("BossWhite", lin("#ffffff"), rough=0.3),
    "frame": pbr("BossFrame", lin("#2a1e18"), rough=0.4),
    "mouth": pbr("BossMouth", lin("#5a2018"), rough=0.6),
    "shoe": pbr("BossShoe", lin("#3a2a20"), rough=0.6),
    "print": pbr("BossPrint", lin("#f4efe2"), rough=0.7),
    "fan": pbr("BossFanPaper", lin("#f6efe0"), rough=0.7),
    "bamboo": pbr("BossBamboo", lin("#c8a86a"), rough=0.6),
}
# (the cook's trousers: a small grey-and-charcoal check, its squares square round the body)
_n = 512
_u, _v = grid01(_n)
_ck = ((np.floor(_u * 72) + np.floor(_v * 72)) % 2)[..., None]
M["pants"] = pbr("BossPants", (1, 1, 1), tex=image("boss_check", (np.array([0.11, 0.12, 0.14]) * _ck + np.array([0.62, 0.64, 0.68]) * (1 - _ck)).astype(np.float32)), rough=0.8)
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def tube(name, pts, r, mat, cyclic=False):
    """a round tube through points given in three's frame"""
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = r; cd.bevel_resolution = 3
    sp = cd.splines.new("POLY"); sp.points.add(len(pts) - 1); sp.use_cyclic_u = cyclic
    for spt, q in zip(sp.points, pts):
        spt.co = (*P(*q), 1)
    cd.use_fill_caps = not cyclic
    o = bpy.data.objects.new(name, cd); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return fin(active(), name, mat)


# ---- the body: short and plump, turned on a lathe; its top a low dome the head sits down into
PROFILE = [(0.0, 0.0), (0.0, 0.0), (0.008, 0.08), (0.03, 0.155), (0.07, 0.21), (0.12, 0.243), (0.18, 0.26), (0.24, 0.262),
           (0.3, 0.255), (0.36, 0.238), (0.41, 0.21), (0.45, 0.17), (0.48, 0.11), (0.495, 0.05), (0.5, 0.0)]
# (where the jacket's hem comes down to, over the trousers)
HEM = 0.17


def rb(y):
    """the body's radius at height y"""
    for (y0, r0), (y1, r1) in zip(PROFILE[1:], PROFILE[2:]):
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return PROFILE[1][1] if y < PROFILE[1][0] else 0.0


def on_body(x, y, out=0.0):
    """the point on the front of the body at (x, y), out along it"""
    r = rb(y)
    z = math.sqrt(max(r * r - x * x, 0.0))
    n = Vector((x, 0, z)).normalized() if r > 0 else Vector((0, 1, 0))
    return Vector((x, y, z)) + n * out


def lathe(name, profile, mat, seg=48, a0=0.0, a1=2 * math.pi):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    n = seg if full else seg + 1
    rings = []
    for (y, r) in profile:
        ring = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / seg
            ring.append(bm.verts.new(P(math.sin(a) * r, y, math.cos(a) * r)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for i in range(seg):
            i2 = (i + 1) % n
            vs = [rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]]
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            # (u round it, v up it, to the same scale: a pattern on it comes out square)
            y0, y1 = profile[j][0], profile[j + 1][0]
            for lp, uv in zip(f.loops, ((i / seg, y0 / 1.64), ((i + 1) / seg, y0 / 1.64), ((i + 1) / seg, y1 / 1.64), (i / seg, y1 / 1.64))):
                lp[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return fin(o, name, mat)


# (the trousers below, the jacket from just under its hem up, the two overlapping)
body = lathe("BossPants", [q for q in PROFILE if q[0] <= HEM + 0.02], M["pants"], seg=48)
lathe("BossBody", [(y, r + (0.006 if y < HEM + 0.04 else 0.0)) for (y, r) in PROFILE if y >= HEM - 0.03 or (y, r) == PROFILE[0] and False],
      M["coat"], seg=48)

# ---- the head: a big ball, set down on the body
C = Vector((0.0, 0.68, 0.0))
R = 0.27
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=48, ring_count=24, location=P(*C))
head = fin(active(), "BossHead", M["skin"])


def on_head(x, y, out=0.0):
    """the point on the front of the head at (x, y) (x, y measured from the head's middle), out along it; and its normal"""
    z = math.sqrt(max(R * R - x * x - y * y, 0.0))
    n = Vector((x, y, z)).normalized()
    return C + n * (R + out), n


def head_at(a, e, out=0.0):
    """the point on the head at bearing a (round from +z, toward +x) and elevation e"""
    n = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)))
    return C + n * (R + out)


# (his hair, cropped short: a skin a hair proud of the head over its crown, down the back to the nape and to the tops of the ears at the
# sides; at the front only above the headband)
bpy.ops.mesh.primitive_uv_sphere_add(radius=R + 0.008, segments=48, ring_count=24, location=P(*C))
hair = active()
bm = bmesh.new(); bm.from_mesh(hair.data)
gone = []
for f in bm.faces:
    c = f.calc_center_median()
    x, y, z = c.x, c.z, -c.y
    keep = y > 0.1 or (z < -0.04 and y > -0.13) or (z < 0.06 and abs(x) > 0.16 and y > 0.02)
    if not keep:
        gone.append(f)
bmesh.ops.delete(bm, geom=gone, context="FACES")
bm.to_mesh(hair.data); bm.free()
so = hair.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.008; so.offset = -1
bpy.context.view_layer.objects.active = hair
bpy.ops.object.modifier_apply(modifier="t")
fin(hair, "BossHair", M["hair"])

# ---- the face
EY = 0.015
for sd in (-1, 1):
    ex = sd * 0.09
    # (eyes: big dark ovals with two glints)
    p, n = on_head(ex, EY, 0.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=18, ring_count=10, location=P(*p))
    o = active(); o.scale = (0.016, 0.01, 0.021)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
    fin(o, f"BossEye{sd}", M["dark"])
    p, n = on_head(ex + 0.006, EY + 0.008, 0.007)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0055, segments=10, ring_count=6, location=P(*p))
    fin(active(), f"BossEyeShine{sd}", M["white"])
    p, n = on_head(ex - 0.005, EY - 0.009, 0.007)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0025, segments=8, ring_count=5, location=P(*p))
    fin(active(), f"BossEyeShineB{sd}", M["white"])
    # (the glasses: a round-cornered frame round each eye, standing a little off the face)
    ring = []
    for i in range(32):
        t = 2 * math.pi * i / 32
        c_, s_ = math.cos(t), math.sin(t)
        fx = ex + 0.055 * math.copysign(abs(c_) ** 0.45, c_)
        fy = EY + 0.044 * math.copysign(abs(s_) ** 0.45, s_)
        ring.append(on_head(fx, fy, 0.022)[0])
    tube(f"BossGlass{sd}", ring, 0.0055, M["frame"], cyclic=True)
    # (its arm back to the ear)
    arm = [on_head(sd * 0.143, EY + 0.012, 0.022)[0]]
    a_out = math.asin(0.143 / R)
    for k in range(1, 7):
        arm.append(head_at(sd * (a_out + (math.pi / 2 - a_out) * k / 6), math.asin((EY + 0.012) / R), 0.012 + 0.01 * (1 - k / 6)))
    tube(f"BossGlassArm{sd}", arm, 0.0045, M["frame"])
    # (brows: arched and kind, over the frames)
    tube(f"BossBrow{sd}", [on_head(ex + 0.028 * (2 * u - 1), EY + 0.078 + 0.01 * (1 - (2 * u - 1) ** 2), 0.006)[0]
                           for u in [k / 8 for k in range(9)]], 0.011, M["brow"])
    # (rosy cheeks under the frames)
    p, n = on_head(sd * 0.135, -0.05, -0.003)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8, location=P(*p))
    o = active(); o.scale = (0.03, 0.008, 0.026)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
    fin(o, f"BossCheek{sd}", M["cheek"])
# (the bridge between the frames)
tube("BossGlassBridge", [on_head(x, EY + 0.012 + 0.006 * (1 - (x / 0.033) ** 2), 0.024)[0] for x in (-0.033, -0.017, 0, 0.017, 0.033)], 0.005, M["frame"])
# (a round nose)
p, n = on_head(0.0, -0.04, 0.012)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.042, segments=16, ring_count=8, location=P(*p))
fin(active(), "BossNose", M["skin"])
# (a moustache: two soft brown wings either side under the nose)
for sd in (-1, 1):
    tube(f"BossMoustache{sd}", [on_head(sd * (0.012 + 0.036 * u), -0.088 + 0.008 * math.sin(math.pi * u) - 0.01 * u * u, 0.006)[0]
                                for u in [k / 8 for k in range(9)]], 0.0095, M["hair"])
# (a smile under it)
tube("BossMouth", [on_head(0.022 * (2 * u - 1), -0.118 - 0.01 * (1 - (2 * u - 1) ** 2), 0.003)[0] for u in [k / 10 for k in range(11)]], 0.0055, M["mouth"])
# (ears)
for sd in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.048, segments=16, ring_count=8, location=P(sd * (R - 0.01), C.y + 0.0, -0.01))
    e = active(); e.scale = (0.5, 0.8, 1.0)
    fin(e, f"BossEar{sd}", M["skin"])

# ---- the headband: two white strands and a red one twisted round the brow, knotted at his left, its two ends sticking out
BE = math.asin(0.13 / R)
KA = math.radians(78)
for k, (mat, r, ph) in enumerate(((M["band"], 0.017, 0.0), (M["band"], 0.017, 2.1), (M["red"], 0.009, 4.2))):
    pts = []
    for i in range(97):
        a = 2 * math.pi * i / 96
        base = head_at(a, BE, 0.016)
        out = (base - C); out.y = 0; out.normalize()
        tw = 24 * a + ph
        pts.append(base + out * 0.011 * math.cos(tw) + Vector((0, 1, 0)) * 0.011 * math.sin(tw))
    tube(f"BossBand{k}", pts[:-1], r, mat, cyclic=True)
kp = head_at(KA, BE, 0.03)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.034, segments=16, ring_count=8, location=P(*kp))
fin(active(), "BossKnot", M["band"])
side = Vector((math.sin(KA), 0, math.cos(KA)))
for k, (up, ln) in enumerate(((0.55, 0.11), (-0.45, 0.1))):
    d = (side + Vector((0, up, 0))).normalized()
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.026, radius2=0.012, depth=ln, location=P(*(kp + d * ln * 0.5)))
    t = active(); t.scale = (1.0, 0.45, 1.0)
    t.rotation_mode = "QUATERNION"; t.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    fin(t, f"BossBandEnd{k}", M["band"])

# ---- the kappōgi's collar: crossed left over right, a red under-collar showing at the neck
tube("BossCollarUnder", [on_body(0.1 - 0.1 * u, 0.43 - 0.11 * u, 0.006) for u in [k / 8 for k in range(9)]], 0.013, M["collar"])
tube("BossCollarOver", [on_body(-0.1 + 0.24 * u, 0.43 - 0.19 * u, 0.012) for u in [k / 10 for k in range(11)]], 0.014, M["collar"])
tube("BossCollarRed", [on_body(-0.07 + 0.14 * u, 0.437 - 0.05 * (1 - abs(2 * u - 1)), 0.008) for u in [k / 8 for k in range(9)]], 0.008, M["red"])
# (the jacket's hem standing a little proud over the trousers, and a cord tied round the waist, its bow at his left)
tube("BossHem", [Vector((math.sin(2 * math.pi * i / 64) * (rb(HEM) + 0.012), HEM, math.cos(2 * math.pi * i / 64) * (rb(HEM) + 0.012)))
                 for i in range(64)], 0.009, M["coat"], cyclic=True)
BELT = 0.235
tube("BossCord", [Vector((math.sin(2 * math.pi * i / 64) * (rb(BELT) + 0.007), BELT, math.cos(2 * math.pi * i / 64) * (rb(BELT) + 0.007)))
                  for i in range(64)], 0.009, M["red"], cyclic=True)
ba = math.radians(60)
bc = Vector((math.sin(ba) * (rb(BELT) + 0.02), BELT, math.cos(ba) * (rb(BELT) + 0.02)))
side_ = Vector((math.cos(ba), 0, -math.sin(ba)))
for sd in (-1, 1):
    tube(f"BossCordBow{sd}", [bc + side_ * sd * 0.03 * math.sin(math.pi * u) + Vector((0, 0.022 * math.sin(2 * math.pi * u), 0)) * sd
                              for u in [k / 12 for k in range(13)]], 0.007, M["red"])
    tube(f"BossCordTail{sd}", [bc + side_ * sd * 0.012 * u + Vector((0, -0.05 * u, 0.01 * u)) for u in (0, 0.5, 1)], 0.006, M["red"])
# (the shop's name stitched small on his chest, navy on the white)
bpy.ops.object.text_add(location=(0, 0, 0))
tx = active()
tx.data.body = "聞野"
JP = bpy.data.fonts.load("C:/Windows/Fonts/YuGothB.ttc") if os.path.exists("C:/Windows/Fonts/YuGothB.ttc") else None
if JP:
    tx.data.font = JP
tx.data.size = 0.05
tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
tx.rotation_euler = (math.pi / 2, 0, math.asin(0.105 / rb(0.33)))
bpy.ops.object.convert(target="MESH")
tx = active()
tx.location = P(*on_body(0.105, 0.33, 0.009))
fin(tx, "BossPrint", M["apron"], smooth=False)

# ---- hands: floating mittens as Overcooked's, a plump rounded paddle (the fingers together, curled a little) and a thumb of its own,
# hanging at his sides; each its own node so the game can swing them, raise them, hold things in them
hands = {}
HAND_AT = {-1: Vector((-0.3, 0.2, 0.05)), 1: Vector((0.3, 0.2, 0.05))}
for sd, at in HAND_AT.items():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=12, location=(0, 0, 0))
    h = active()
    # (the paddle: wider than thick, longest down the fingers; the finger end fuller, curled in toward the palm)
    for v in h.data.vertices:
        x, y, z = v.co.x, v.co.z, -v.co.y          # three frame: y along the fingers (down), x across, z thickness
        w = 1.0 + 0.12 * (-y)                       # fuller at the finger end (y < 0)
        v.co = Vector(P(x * 0.05 * w, y * 0.06, z * 0.036))
        cz = 0.016 * max(0.0, -y) ** 2            # the fingers curling forward
        v.co += Vector(P(0, 0, cz))
    h.location = P(*at)
    h.rotation_euler = (0, -sd * 0.25, 0)
    hn = fin(h, f"BossHand{'L' if sd < 0 else 'R'}Mitt", M["skin"])
    # (the thumb: a short rounded stub out from the side of the palm, toward the front)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=14, ring_count=8, location=P(*(at + Vector((-sd * 0.036, 0.014, 0.024)))))
    th = active(); th.scale = (0.019, 0.019, 0.03)
    th.rotation_euler = (0.5, 0, -sd * 0.6)
    th = fin(th, f"BossHand{'L' if sd < 0 else 'R'}Thumb", M["skin"])
    e = bpy.data.objects.new(f"BossHand{'L' if sd < 0 else 'R'}", None)
    bpy.context.collection.objects.link(e)
    bpy.context.view_layer.update()
    for o in (hn, th):
        mw = o.matrix_world.copy(); o.parent = e; o.matrix_world = mw
    hands[sd] = e

# ---- what he holds (shown by the game when he holds it): long steel tongs and a round paper fan (団扇), each its own node with its grip
# at the node's origin, the tongs pointing forward (+z), the fan's face up the +y
props = []
tg = bpy.data.objects.new("BossTongs", None); bpy.context.collection.objects.link(tg)
for sd in (-1, 1):
    pts = [Vector((sd * 0.004, 0, -0.02)), Vector((sd * 0.008, 0, 0.06)), Vector((sd * 0.012, 0, 0.16)), Vector((sd * 0.006, -0.004, 0.2))]
    o = tube(f"BossTongsArm{sd}", pts, 0.0035, M["frame"])
    o.parent = tg
tube("BossTongsHinge", [Vector((-0.006, 0, -0.024)), Vector((0.006, 0, -0.024))], 0.006, M["frame"]).parent = tg
props.append(tg)
fan = bpy.data.objects.new("BossFan", None); bpy.context.collection.objects.link(fan)
bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.07, depth=0.004, location=P(0, 0.1, 0), rotation=(0, 0, 0))
fp = active(); fp.rotation_euler = (0, 0, 0)
fp.scale = (1, 1, 1)
fp.rotation_mode = "XYZ"; fp.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(rotation=True)
fin(fp, "BossFanPaper", M["fan"]).parent = fan
for k in range(9):
    a = math.radians(-80 + 20 * k)
    tube(f"BossFanRib{k}", [Vector((0, 0.035, 0.003)), Vector((math.sin(a) * 0.066, 0.1 + math.cos(a) * 0.066, 0.003))], 0.0012, M["bamboo"]).parent = fan
tube("BossFanHandle", [Vector((0, -0.03, 0)), Vector((0, 0.035, 0))], 0.006, M["bamboo"]).parent = fan
tube("BossFanRim", [Vector((math.sin(2 * math.pi * i / 40) * 0.07, 0.1 + math.cos(2 * math.pi * i / 40) * 0.07, 0)) for i in range(40)],
     0.002, M["red"], cyclic=True).parent = fan
props.append(fan)

root = bpy.data.objects.new("Boss", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
for e in list(hands.values()) + props:
    e.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.35, 0.8, 1.3)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(P(0, 0.5, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 42
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
    bpy.context.scene.world = w
export_dish(root, parts + list(hands.values()) + props + [root], os.path.join(PROJECT, "public", "models", "boss.glb"), os.path.join(PROJECT, "blender", "boss.blend"), PREVIEW)
print("BOSS_DONE", sum(len(o.data.polygons) for o in parts))
