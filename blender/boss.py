"""The owner (老闆), standing at his grill when the shop's shut: boss.glb, node "Boss", about 0.95 tall, facing +z three, resting on y 0.

Made as the cooks of Overcooked 2 are: a big round head set straight down on a plump body about as tall as the head is wide, rounding
off underneath (no legs, no feet), no arms, floating mitten hands (a plump paddle and a thumb). His face is the one on his picture
(ui/Avatar.tsx, role 'owner'); dressed as a Japanese cook: his head wrapped in an indigo tenugui, a white fish pressed on its front, knotted at the back,
its front edge rolled, a little brown hair at the sides and the nape; round-cornered glasses over small dark eyes, short thick brows, a round
button nose, a moustache and a smile, ears, a pencil behind his right one; a white kappōgi crossed at the front over an indigo under-collar,
a little gold fish pinned to his chest, indigo trousers and a navy apron (前掛け) with 聞野 on it in white, its cream cord tied in a bow at
his left, a blue-striped hand towel tucked in at his right. Kept light in geometry, the cloth and hair given their look by painted
textures (the tenugui's fish, the cotton's weave, the indigo's dye, the hair's strands).
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
# ---- painted textures: the look of the cloth and hair, so the shapes can stay simple
_n = 256
_u, _v = grid01(_n)
_rng = np.random.default_rng(7)
_grain = _rng.random((_n, _n)).astype(np.float32)


def _weave(base, k=0.05, lines=96):
    """a cloth's colour with its weave: fine crossing threads and a little unevenness of the dye"""
    w = 0.5 + 0.5 * np.sin(_u * lines * 2 * np.pi) * np.sin(_v * lines * 2 * np.pi)
    t = 1.0 + (w - 0.5) * k + (_grain - 0.5) * k * 0.8
    return (np.array(base, np.float32)[None, None, :] * t[..., None]).clip(0, 1).astype(np.float32)


# (the tenugui: indigo, white dots in rows, each row offset half a step (豆絞り), a soft edge to each dot as dye would give)
_du, _dv = (_u * 24) % 1.0, (_v * 12) % 1.0
_row = np.floor(_v * 12) % 2
_du = (_du + 0.5 * _row) % 1.0
_dot = np.clip(1.3 - np.hypot(_du - 0.5, (_dv - 0.5) * 0.9) / 0.2, 0, 1)
_tg = _weave((0.16, 0.22, 0.42), 0.08)
_tgCap = _tg.copy()
# (plain indigo for the roll and the knot; the cap's own cloth, with the fish pressed on it, is made once its front is found)
M["tenugui"] = pbr("BossTenugui", (1, 1, 1), tex=image("boss_tenugui", _tg.astype(np.float32)), rough=0.8)
# (the kappōgi's cotton: white with its weave, a faint shade down the folds)
_ct = _weave((0.96, 0.94, 0.9), 0.06) * (1 - 0.05 * (0.5 + 0.5 * np.sin(_u * 2 * np.pi * 9)))[..., None]
M["coat"] = pbr("BossCoat", (1, 1, 1), tex=image("boss_cotton", _ct.astype(np.float32)), rough=0.75)
# (indigo cloth for the trousers and a deeper navy for the apron, both dyed a touch unevenly)
M["pants"] = pbr("BossPants", (1, 1, 1), tex=image("boss_indigo", _weave((0.2, 0.25, 0.4), 0.1)), rough=0.85)
M["apron"] = pbr("BossApron", (1, 1, 1), tex=image("boss_navy", _weave((0.12, 0.16, 0.28), 0.12, 128)), rough=0.85)
# (hair: brown with strands combed down from the crown, lighter and darker by turns)
_hs = 0.75 + 0.25 * np.sin(_u * 2 * np.pi * 60 + np.sin(_u * 2 * np.pi * 7) * 2) * (0.6 + 0.4 * _grain)
M["hair"] = pbr("BossHair", (1, 1, 1), tex=image("boss_hair", (np.array([0.36, 0.23, 0.16], np.float32)[None, None, :] * _hs[..., None]).astype(np.float32)), rough=0.6)
# (the cook's trousers: a small grey-and-charcoal check, its squares square round the body)
_n = 512
_u, _v = grid01(_n)
_ck = ((np.floor(_u * 72) + np.floor(_v * 72)) % 2)[..., None]
_ck = None
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


def ribbon(name, pts, outs, width, thick, mat):
    """a flat band of cloth through points (three's frame) lying on a surface whose outward normals are `outs`: `width` across it, `thick`
    off the surface, its edges eased"""
    bm = bmesh.new()
    rows = []
    n = len(pts)
    for i, (q, o) in enumerate(zip(pts, outs)):
        t = (pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]).normalized()
        o = o.normalized()
        side = t.cross(o).normalized()
        row = []
        for (a, b) in ((-0.5, 0.0), (-0.47, 1.0), (0.47, 1.0), (0.5, 0.0)):
            row.append(bm.verts.new(P(*(q + side * width * a + o * thick * b))))
        rows.append(row)
    for i in range(n - 1):
        for k in range(3):
            bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return fin(o, name, mat)


# ---- the body: short and plump, turned on a lathe; its top a low dome the head sits down into
PROFILE = [(0.0, 0.0), (0.0, 0.0), (0.008, 0.08), (0.03, 0.155), (0.07, 0.21), (0.12, 0.243), (0.18, 0.26), (0.24, 0.262),
           (0.3, 0.255), (0.36, 0.238), (0.41, 0.21), (0.45, 0.17), (0.48, 0.11), (0.495, 0.05), (0.5, 0.0)]
# (stood up taller: the body about as tall as the head is wide, as Overcooked's cooks are)
BH = 1.24
DY = 0.5 * (BH - 1)
PROFILE = [(y * BH, r) for (y, r) in PROFILE]
# (where the jacket's hem comes down to, over the trousers)
HEM = 0.17 * BH


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
C = Vector((0.0, 0.68 + DY, 0.0))
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


# (his hair: only what shows under the tenugui, short at the sides and the nape; a light shell, its strands painted)
HT = 0.012
bpy.ops.mesh.primitive_uv_sphere_add(radius=R + HT, segments=64, ring_count=32, location=P(*C))
hair = active()
bm = bmesh.new(); bm.from_mesh(hair.data)
# (cut clean with planes, not face by face, so its edges are smooth lines: off in front of the ears, off under the tenugui's edge, and a
# nape line, higher at the sides than at the back)

for co, no in ((Vector(P(0, 0, 0.055)), Vector(P(0, 0, 1))),                     # (nothing in front of the ears)
               (Vector(P(0, 0.17, 0)), Vector(P(0, 1, 0))),                      # (nothing over the crown: the tenugui's there)
               (Vector(P(0, -0.15, -R)), Vector(P(0, -1, 0.4)).normalized())):  # (the nape, rising toward the ears)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)  # (the shell's own frame: its middle at the head's)
bm.to_mesh(hair.data); bm.free()
fin(hair, "BossHair", M["hair"])
# (sideburns down in front of the ears)
for sd in (-1, 1):
    q = head_at(sd * math.radians(76), -0.05, 0.004)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=10, ring_count=6, location=P(*q))
    o = active(); o.scale = (0.016, 0.02, 0.045)
    fin(o, f"BossSideburn{sd}", M["hair"])

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
        fx = ex + 0.05 * math.copysign(abs(c_) ** 0.7, c_)
        fy = EY + 0.04 * math.copysign(abs(s_) ** 0.7, s_)
        ring.append(on_head(fx, fy, 0.022)[0])
    tube(f"BossGlass{sd}", ring, 0.0055, M["frame"], cyclic=True)
    # (its arm back to the ear)
    arm = [on_head(sd * 0.143, EY + 0.012, 0.022)[0]]
    a_out = math.asin(0.143 / R)
    for k in range(1, 7):
        arm.append(head_at(sd * (a_out + (math.radians(84) - a_out) * k / 6), math.asin((EY + 0.012) / R), 0.012 + 0.01 * (1 - k / 6)))
    tube(f"BossGlassArm{sd}", arm, 0.0045, M["frame"])
    # (brows: arched and kind, over the frames)
    tube(f"BossBrow{sd}", [on_head(ex + 0.028 * (2 * u - 1), EY + 0.078 + 0.01 * (1 - (2 * u - 1) ** 2), 0.006)[0]
                           for u in [k / 8 for k in range(9)]], 0.011, M["brow"])
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
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.048, segments=16, ring_count=8, location=P(sd * (R + 0.006), C.y - 0.005, -0.015))
    e = active(); e.scale = (0.45, 0.85, 0.95)
    fin(e, f"BossEar{sd}", M["skin"])

# ---- the tenugui: indigo with a white fish pressed on the front (押花), wrapped over the crown like a cap down to the brow, its front edge rolled, knotted at the back with
# its two corners sticking out
BE = math.asin(0.12 / R)
bpy.ops.mesh.primitive_uv_sphere_add(radius=R + 0.02, segments=32, ring_count=16, location=P(*C))
cap = active()
bm = bmesh.new(); bm.from_mesh(cap.data)
gone = []
for f in bm.faces:
    c = f.calc_center_median()
    x, y, z = c.x, c.z, -c.y
    # (down to the brow at the front, lower over the ears and the back)
    edge = (R + 0.02) * math.sin(BE) - 0.07 * max(0.0, -z / (R + 0.02))
    if y < edge:
        gone.append(f)
bmesh.ops.delete(bm, geom=gone, context="FACES")
# (where on its picture the front of the crown falls, for the fish)
uvl = bm.loops.layers.uv.active
front = Vector(P(0, math.sin(0.72), math.cos(0.72)))
best = min(bm.faces, key=lambda f: (f.calc_center_median().normalized() - front).length)
u0 = sum(l[uvl].uv.x for l in best.loops) / len(best.loops)
v0 = sum(l[uvl].uv.y for l in best.loops) / len(best.loops)
bm.to_mesh(cap.data); bm.free()


def fish_mask(x, y):
    """a fish pressed in white (押花) in its own frame (nose at -x, about 1 long): its body, tail, fins, eye, gill and a line down its side left
    in the cloth's indigo, as a stencil leaves them"""
    t = (x + 0.5)
    half = 0.2 * np.sin(np.pi * np.clip(t / 0.85, 0, 1)) ** 0.75
    body = (t > 0) & (t < 0.85) & (np.abs(y) < half)
    tail = (t >= 0.78) & (t < 1.05) & (np.abs(y) < (t - 0.78) * 1.25 + 0.02) & ~((t > 0.98) & (np.abs(y) < (t - 0.98) * 3))
    dorsal = (t > 0.3) & (t < 0.62) & (y > 0) & (y < half + 0.07 * np.sin(np.pi * (t - 0.3) / 0.32))
    belly = (t > 0.45) & (t < 0.62) & (y < 0) & (-y < half + 0.04 * np.sin(np.pi * (t - 0.45) / 0.17))
    white = body | tail | dorsal | belly
    eye = np.hypot(t - 0.12, y - 0.04) < 0.028
    gill = np.abs(np.hypot(t - 0.05, y) - 0.17) < 0.012
    gill &= (t > 0.15) & (np.abs(y) < 0.14)
    # (and a fine line down its side, from the gill to the tail)
    line = (t > 0.22) & (t < 0.8) & (np.abs(y - 0.01 * np.sin(t * 9)) < 0.008)
    return (white & ~eye & ~gill & ~line).astype(np.float32)


# (the picture's pixels round the front, in the fish's frame: across is round the head at that height, up is over it, scaled so the fish
# isn't stretched; about 0.75 of a radian long)
lat = (v0 - 0.5) * math.pi
_fu, _fv = grid01(512)
fx = ((_fu - u0 + 0.5) % 1.0 - 0.5) * 2 * math.pi * math.cos(lat) / 0.75
fy = (_fv - v0) * math.pi / 0.75
mask = fish_mask(-fx, fy)
# (soft at its edge, as a print on cloth)
mask = 0.25 * mask + 0.75 * np.clip((mask + np.roll(mask, 1, 0) + np.roll(mask, -1, 0) + np.roll(mask, 1, 1) + np.roll(mask, -1, 1)) / 5, 0, 1)
_cap = np.repeat(np.repeat(_tgCap, 2, 0), 2, 1) * (1 - mask[..., None]) + np.array([0.94, 0.92, 0.86], np.float32) * mask[..., None]
M["tenuguiCap"] = pbr("BossTenuguiFish", (1, 1, 1), tex=image("boss_tenugui_fish", _cap.astype(np.float32)), rough=0.8)
fin(cap, "BossTenugui", M["tenuguiCap"])
# (its rolled front edge: a soft roll round where it ends)
roll = []
for i in range(40):
    a = 2 * math.pi * i / 40
    zc = math.cos(a)
    e = math.asin(max(-0.9, ((R + 0.02) * math.sin(BE) - 0.07 * max(0.0, -zc)) / (R + 0.02)))
    roll.append(head_at(a, e, 0.022))
tube("BossTenuguiRoll", roll, 0.013, M["tenugui"], cyclic=True)
# (the knot at the back, and its two corners: flat flaps of the cloth, hanging and flaring out)
kp = head_at(math.pi, 0.14, 0.035)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.034, segments=16, ring_count=10, location=P(*kp))
k_ = active(); k_.scale = (1.35, 0.95, 0.85)
fin(k_, "BossKnot", M["tenugui"])
for k, sd in enumerate((-1, 1)):
    pts, outs = [], []
    for i in range(7):
        t = i / 6
        q = kp + Vector((sd * (0.02 + 0.07 * t), -0.02 - 0.09 * t * t, -0.025 - 0.02 * t))
        pts.append(q); outs.append(Vector((sd * 0.3, 0.1, -1)))
    o = ribbon(f"BossKnotEnd{k}", pts, outs, 0.045, 0.006, M["tenugui"])

# ---- the kappōgi's collar: wide flat bands crossed left over right on the chest, lying on it; the indigo under-collar at the neck
def body_out(q):
    return Vector((q.x, 0, q.z)).normalized() + Vector((0, 0.35, 0))


under = [on_body(0.1 - 0.1 * u, 0.43 + DY - 0.11 * u, 0.002) for u in [k / 8 for k in range(9)]]
ribbon("BossCollarUnder", under, [body_out(q) for q in under], 0.05, 0.008, M["collar"])
over = [on_body(-0.1 + 0.24 * u, 0.43 + DY - 0.19 * u, 0.008) for u in [k / 10 for k in range(11)]]
ribbon("BossCollarOver", over, [body_out(q) for q in over], 0.055, 0.008, M["collar"])
neck = [on_body(-0.08 + 0.16 * u, 0.44 + DY - 0.055 * (1 - abs(2 * u - 1)), 0.001) for u in [k / 10 for k in range(11)]]
ribbon("BossCollarUnderNeck", neck, [body_out(q) for q in neck], 0.03, 0.006, M["pants"])
# (the jacket's hem: a band standing a hair proud of the trousers all round; the cord pressed round the waist, its bow at his left)
lathe("BossHem", [(HEM - 0.016, rb(HEM - 0.016) + 0.002), (HEM - 0.012, rb(HEM - 0.012) + 0.008), (HEM + 0.012, rb(HEM + 0.012) + 0.008),
                  (HEM + 0.016, rb(HEM + 0.016) + 0.002)], M["coat"], seg=64)
BELT = 0.235 * BH
tube("BossCord", [Vector((math.sin(2 * math.pi * i / 64) * (rb(BELT) + 0.005), BELT, math.cos(2 * math.pi * i / 64) * (rb(BELT) + 0.005)))
                  for i in range(64)], 0.008, M["cord"], cyclic=True)
ba = math.radians(60)
bc = Vector((math.sin(ba) * (rb(BELT) + 0.02), BELT, math.cos(ba) * (rb(BELT) + 0.02)))
side_ = Vector((math.cos(ba), 0, -math.sin(ba)))
for sd in (-1, 1):
    tube(f"BossCordBow{sd}", [bc + side_ * sd * 0.03 * math.sin(math.pi * u) + Vector((0, 0.022 * math.sin(2 * math.pi * u), 0)) * sd
                              for u in [k / 12 for k in range(13)]], 0.007, M["cord"])
    tube(f"BossCordTail{sd}", [bc + side_ * sd * 0.012 * u + Vector((0, -0.05 * u, 0.01 * u)) for u in (0, 0.5, 1)], 0.006, M["cord"])
# (the apron (前掛け): navy, from the cord down over his front nearly to the ground, a little proud of him; 聞野 on it in white)
AP = [(y, rb(y) + 0.012) for y in (0.04, 0.08, 0.13, 0.19, 0.25, BELT - 0.004)]
ap = lathe("BossApron", AP, M["apron"], seg=20, a0=-math.radians(68), a1=math.radians(68))
so = ap.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.005
bpy.context.view_layer.objects.active = ap
bpy.ops.object.modifier_apply(modifier="t")
bpy.ops.object.text_add(location=(0, 0, 0))
tx = active()
tx.data.body = "聞野"
JP = bpy.data.fonts.load("C:/Windows/Fonts/YuGothB.ttc") if os.path.exists("C:/Windows/Fonts/YuGothB.ttc") else None
if JP:
    tx.data.font = JP
tx.data.size = 0.075
tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
tx.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.convert(target="MESH")
tx = active()
tx.location = P(*on_body(0, 0.15, 0.019))
fin(tx, "BossPrint", M["print"], smooth=False)

# ---- the little things about him
M["gold"] = pbr("BossGold", lin("#e0b040"), rough=0.3, metal=1.0) if "metal" in pbr.__code__.co_varnames else pbr("BossGold", lin("#e0b040"), rough=0.3)
M["towel"] = pbr("BossTowel", lin("#f4f1e8"), rough=0.8)
M["blue"] = pbr("BossTowelBlue", lin("#2c4a8a"), rough=0.8)
M["pencil"] = pbr("BossPencil", lin("#f2c230"), rough=0.6)
M["pink"] = pbr("BossEraser", lin("#ec8a9a"), rough=0.7)
# (a little gold fish pinned on his chest, his left)
fp = on_body(0.12, 0.33 * BH + 0.06, 0.012)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=14, ring_count=8, location=P(*fp))
o = active(); o.scale = (0.028, 0.008, 0.016)
fin(o, "BossPinFish", M["gold"])
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.016, radius2=0.0, depth=0.02, location=P(*(fp + Vector((0.032, 0, 0)))))
o = active(); o.rotation_euler = (0, math.pi / 2, 0); o.scale = (1, 0.4, 1)
fin(o, "BossPinTail", M["gold"], smooth=False)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.003, segments=8, ring_count=5, location=P(*(fp + Vector((-0.015, 0.004, 0.008)))))
fin(active(), "BossPinEye", M["dark"])
# (a hand towel (手拭い) tucked under the cord at his right, hanging down, two blue stripes across it)
ta = math.radians(-62)
tt = Vector((math.sin(ta) * (rb(BELT) + 0.012), BELT, math.cos(ta) * (rb(BELT) + 0.012)))
tw = Vector((math.cos(ta), 0, -math.sin(ta)))
for k, (y0, y1, mat, out) in enumerate(((0.0, 0.17, M["towel"], 0.0), (0.035, 0.05, M["blue"], 0.004), (0.12, 0.135, M["blue"], 0.004))):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*(tt + Vector((0, -(y0 + y1) / 2 + 0.01, 0)) + Vector((math.sin(ta), 0, math.cos(ta))) * (0.006 + out))))
    o = active(); o.scale = (0.075 + out * 2, 0.012 + out, y1 - y0)
    o.rotation_euler = (0, 0, ta)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.004; bv.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="b")
    fin(o, f"BossTowel{k}", mat, smooth=False)
# (a pencil behind his right ear)
ep = Vector((-(R - 0.01), C.y + 0.03, -0.0))
d = Vector((0.15, 0.95, -0.35)).normalized()
for k, (off, ln, r, mat) in enumerate(((0.0, 0.11, 0.007, M["pencil"]),)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r, depth=ln, location=P(*(ep + d * off)))
    o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    fin(o, "BossPencil", mat, smooth=False)
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.0072, depth=0.014, location=P(*(ep + d * 0.062)))
o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
fin(o, "BossPencilEraser", M["pink"])
bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.007, radius2=0.0, depth=0.022, location=P(*(ep - d * 0.066)))
o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*(-d))).to_track_quat("Z", "Y")
fin(o, "BossPencilTip", M["towel"], smooth=False)

# ---- hands: floating mittens as Overcooked's, a plump rounded paddle (the fingers together, curled a little) and a thumb of its own,
# hanging at his sides; each its own node so the game can swing them, raise them, hold things in them
hands = {}
HAND_AT = {-1: Vector((-0.31, 0.26, 0.05)), 1: Vector((0.31, 0.26, 0.05))}
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
    # (where the preview looks from: PREVIEW_CAM="x,y,z" in three's frame, or a little above and in front)
    cam.location = P(*map(float, os.environ.get("PREVIEW_CAM", "0.3,1.6,1.6").split(",")))
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
