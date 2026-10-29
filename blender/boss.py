"""The owner (老闆), standing at his grill when the shop's shut: boss.glb, node "Boss", about 1.0 tall, facing +z three, his feet at y 0.

Made as the cooks of Overcooked are: one round body that is head and all (no neck, next to no chin), floating mitten hands, two small
shoes peeping out under it. Shaped from metaballs and turned to a smooth mesh, then dressed:
- his face on the front of the head: brows thick and kind, eyes dark with a highlight, a round nose, a small moustache, a wide open laugh
  with its tongue, rosy cheeks; ears at the sides; short dark hair under a white twisted headband (ねじり鉢巻) knotted at the side, its two
  ends hanging;
- an indigo samue jacket with its white collar crossing at the front, a navy apron (前掛け) from the waist with 聞野 on it in white and its
  cord tied round;
- his hands as separate nodes (BossHandL, BossHandR) so the game can move them; the right one raised.

Run:
    blender -b --factory-startup --python blender/boss.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

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
    "skin": pbr("BossSkin", lin("#f2c8a0"), rough=0.6),
    "cheek": pbr("BossCheek", lin("#f08a7a"), rough=0.6),
    "hair": pbr("BossHair", lin("#2a1c14"), rough=0.6),
    "jacket": pbr("BossJacket", lin("#2c4470"), rough=0.8),
    "collar": pbr("BossCollar", lin("#f2ece0"), rough=0.7),
    "apron": pbr("BossApron", lin("#1a2440"), rough=0.85),
    "cord": pbr("BossCord", lin("#e8dcc0"), rough=0.7),
    "band": pbr("BossBand", lin("#fbf8f2"), rough=0.6),
    "dark": pbr("BossDark", lin("#1c1410"), rough=0.4),
    "white": pbr("BossWhite", lin("#ffffff"), rough=0.3),
    "mouth": pbr("BossMouth", lin("#7a2018"), rough=0.6),
    "tongue": pbr("BossTongue", lin("#e8706a"), rough=0.6),
    "shoe": pbr("BossShoe", lin("#3a2a20"), rough=0.6),
    "print": pbr("BossPrint", lin("#f4efe2"), rough=0.7),
}
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


# ---- the body: head and all one round form, from metaballs
mb = bpy.data.metaballs.new("BossMB")
mb.resolution = 0.018
mb.render_resolution = 0.018
mbo = bpy.data.objects.new("BossMB", mb)
bpy.context.collection.objects.link(mbo)
for (x, y, z, r, sx, sy, sz) in [
    (0, 0.72, 0.0, 0.3, 1.0, 0.95, 0.95),     # the head
    (0, 0.4, 0.0, 0.34, 1.0, 1.05, 0.88),     # the body
    (0, 0.3, 0.05, 0.25, 1.0, 0.9, 0.9),      # the belly
    (0, 0.16, 0.0, 0.26, 1.05, 0.7, 0.9),     # the hips, wide, low
]:
    e = mb.elements.new()
    e.type = "ELLIPSOID"
    e.co = P(x, y, z)
    e.radius = r
    e.size_x, e.size_y, e.size_z = sx, sz, sy
bpy.context.view_layer.objects.active = mbo
mbo.select_set(True)
bpy.ops.object.convert(target="MESH")
body = active()
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
sm = body.modifiers.new("s", "SMOOTH"); sm.iterations = 8; sm.factor = 0.6
bpy.ops.object.modifier_apply(modifier="s")
dec = body.modifiers.new("d", "DECIMATE"); dec.ratio = 0.35
bpy.ops.object.modifier_apply(modifier="d")
# (rounder: the blobs come out narrower than their radii; widened to a full bean, the head a little narrower than the hips; set on the
# floor, cut off flat at the foot, about 1.0 tall)
zs = [v.co.z for v in body.data.vertices]
z0, z1 = min(zs), max(zs)
for v in body.data.vertices:
    v.co.z = (v.co.z - z0) / (z1 - z0) * 1.0
xs = [abs(v.co.x) for v in body.data.vertices]
kx = 0.33 / max(xs)
for v in body.data.vertices:
    t = v.co.z
    k = kx * (1.0 - 0.1 * max(0.0, (t - 0.55) / 0.45))
    v.co.x *= k
    v.co.y *= k * 0.92
    if v.co.z < 0.03:
        v.co.z = 0.03
body.data.update()
HEAD_TOP = max(v.co.z for v in body.data.vertices)
body.data.materials.clear()
for k in ("skin", "hair", "jacket"):
    body.data.materials.append(M[k])
# (which part of him each face is: the head skin, the hair over its top and back, the jacket below; the skin running down in a V at the
# front where the collar opens)
for poly in body.data.polygons:
    c = poly.center
    x, y, z = c.x, c.z, -c.y
    hair = y > HEAD_TOP - 0.09 or (y > 0.64 and z < -0.13) or (y > 0.74 and z < 0.02 and abs(x) > 0.2)
    skin = y > 0.56 or (y > 0.46 and z > 0.12 and abs(x) < (y - 0.46) * 0.75)
    poly.material_index = 1 if hair else 0 if skin else 2
    poly.use_smooth = True
body.name = "BossBody"
parts.append(body)

bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())


def side_r(y, a):
    """how far out his surface is at height y, in direction a (radians round from +z)"""
    d = Vector(P(math.sin(a), 0, math.cos(a)))
    hit = bvh.ray_cast(Vector(P(0, y, 0)) + d * 1.0, -d)
    return (hit[0] - Vector(P(0, y, 0))).length if hit[0] is not None else 0.25


def front(x, y):
    """the point on his front at (x, y), and its normal (three frame)"""
    # (a ray in from the front; should it slip through a seam, a hair to the side)
    for dx in (0.0, 0.003, -0.003, 0.008):
        hit = bvh.ray_cast(Vector(P(x + dx, y, 1.0)), Vector(P(0, 0, -1)))
        if hit[0] is not None:
            loc, nrm = hit[0], hit[1]
            return Vector((loc.x, loc.z, -loc.y)), Vector((nrm.x, nrm.z, -nrm.y))
    hit = bvh.find_nearest(Vector(P(x, y, 0.3)))
    loc, nrm = hit[0], hit[1]
    return Vector((loc.x, loc.z, -loc.y)), Vector((nrm.x, nrm.z, -nrm.y))


def on_face(name, x, y, mat, size, out=0.004, squash=(1, 1, 0.35), rot=0.0):
    """a flattened ellipsoid laid on his front at (x, y), facing out along the surface"""
    p, n = front(x, y)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10, location=P(*(p + n * out)))
    o = active()
    o.scale = (size[0] * squash[0], size[1] * squash[2], size[1] * squash[1])
    q = Vector(P(*n)).to_track_quat("Y", "Z")
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = q
    o.rotation_mode = "XYZ"
    o.rotation_euler.rotate_axis("Y", rot)
    return fin(o, name, mat)


# ---- the face
for sd in (-1, 1):
    on_face(f"BossEye{sd}", sd * 0.085, 0.735, M["dark"], (0.03, 0.04), out=0.0)
    on_face(f"BossEyeShine{sd}", sd * 0.085 + 0.012, 0.75, M["white"], (0.009, 0.009), out=0.012)
    # (brows: thick, kind, tilted up toward the middle)
    on_face(f"BossBrow{sd}", sd * 0.09, 0.81, M["hair"], (0.05, 0.016), out=0.004, squash=(1, 1, 0.5), rot=sd * 0.25)
    on_face(f"BossCheek{sd}", sd * 0.15, 0.665, M["cheek"], (0.045, 0.028), out=-0.004, squash=(1, 1, 0.3))
on_face("BossNose", 0.0, 0.69, M["skin"], (0.032, 0.028), out=0.0, squash=(1, 1, 0.9))
# (a short moustache either side under the nose)
for sd in (-1, 1):
    on_face(f"BossMoustache{sd}", sd * 0.035, 0.655, M["hair"], (0.04, 0.014), out=0.004, squash=(1, 1, 0.6), rot=-sd * 0.3)
# (the open laugh: a dark half-oval, its tongue)
on_face("BossMouth", 0.0, 0.615, M["mouth"], (0.055, 0.032), out=-0.002, squash=(1, 1, 0.3))
on_face("BossTongue", 0.0, 0.602, M["tongue"], (0.03, 0.014), out=0.004, squash=(1, 1, 0.3))
# (ears)
for sd in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, segments=14, ring_count=8, location=P(sd * (side_r(0.72, sd * math.pi / 2) - 0.004), 0.72, -0.01))
    e = active(); e.scale = (0.55, 1.0, 1.0)
    fin(e, f"BossEar{sd}", M["skin"])

# ---- the headband: a twisted white cloth round the brow, knotted at his right, its two ends hanging
BAND_Y = HEAD_TOP - 0.1
# (a twisted cloth round the head: a tube through points laid on the head all the way round, a hair proud of it, its twist showing as a
# swell every so often)
pts = []
for i in range(49):
    a = 2 * math.pi * i / 48
    rad = side_r(BAND_Y, a) + 0.014 + 0.006 * math.sin(a * 12)
    pts.append(Vector(P(math.sin(a) * rad, BAND_Y + 0.008 * math.sin(a * 12 + 1), math.cos(a) * rad)))
cd = bpy.data.curves.new("BossBand", "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = 0.026; cd.bevel_resolution = 3
spl = cd.splines.new("POLY"); spl.points.add(len(pts) - 1); spl.use_cyclic_u = True
for sp_, q in zip(spl.points, pts):
    sp_.co = (q.x, q.y, q.z, 1)
hbo = bpy.data.objects.new("BossBand", cd); bpy.context.collection.objects.link(hbo)
bpy.ops.object.select_all(action="DESELECT"); hbo.select_set(True); bpy.context.view_layer.objects.active = hbo
bpy.ops.object.convert(target="MESH")
hb = active()
fin(hb, "BossBand", M["band"])
KA = math.radians(55)
kr = side_r(BAND_Y, KA) + 0.03
kx_, kz_ = math.sin(KA) * kr, math.cos(KA) * kr
for k, (dx, dy, dz, s) in enumerate([(0.0, 0.0, 0.0, 0.042), (0.03, -0.03, 0.02, 0.03)]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=s, segments=14, ring_count=8, location=P(kx_ + dx, BAND_Y + dy, kz_ + dz))
    fin(active(), f"BossKnot{k}", M["band"])
for k, (ex, ey, ez) in enumerate([(0.07, -0.1, 0.05), (0.03, -0.12, 0.08)]):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.022, radius2=0.012, depth=0.12, location=P(kx_ + ex / 2, BAND_Y + ey / 2, kz_ + ez / 2))
    t = active()
    d = Vector(P(ex, ey, ez))
    t.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    fin(t, f"BossBandEnd{k}", M["band"])

# ---- the samue's collar: white bands crossing at the front, left over right
for sd in (-1, 1):
    pts = []
    for i in range(9):
        t = i / 8
        y = 0.57 - t * 0.12
        x = sd * (0.13 - t * 0.13 + (0.0 if sd > 0 else 0.008))
        p, n = front(x, y)
        pts.append(p + n * 0.006)
    cd = bpy.data.curves.new(f"BossCollar{sd}", "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = 0.016; cd.bevel_resolution = 2
    sp = cd.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for spt, q in zip(sp.points, pts):
        spt.co = (*P(*q), 1)
    co = bpy.data.objects.new(f"BossCollar{sd}", cd)
    bpy.context.collection.objects.link(co)
    bpy.ops.object.select_all(action="DESELECT"); co.select_set(True); bpy.context.view_layer.objects.active = co
    bpy.ops.object.convert(target="MESH")
    fin(active(), f"BossCollar{sd}", M["collar"])

# ---- the apron: a cloth over his front from the waist down, following his shape a little proud of it
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
NA, NY = 18, 8
grid = []
for j in range(NY + 1):
    y = 0.42 - j * (0.36 / NY)
    row = []
    for i in range(NA + 1):
        a = math.radians(-75 + 150 * i / NA)
        o_ = Vector(P(0, y, 0)); d = Vector(P(math.sin(a), 0, math.cos(a)))
        hit = bvh.ray_cast(o_ + d * 1.0, -d)
        q = hit[0] + d * 0.012 if hit[0] else o_ + d * 0.3
        row.append(bm.verts.new(q))
    grid.append(row)
for j in range(NY):
    for i in range(NA):
        f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        for lp, (uu, vv) in zip(f.loops, ((i / NA, 1 - j / NY), ((i + 1) / NA, 1 - j / NY), ((i + 1) / NA, 1 - (j + 1) / NY), (i / NA, 1 - (j + 1) / NY))):
            lp[uvl].uv = (uu, vv)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("BossApron"); bm.to_mesh(me); bm.free()
ap = bpy.data.objects.new("BossApron", me); bpy.context.collection.objects.link(ap)
so = ap.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.006
bpy.context.view_layer.objects.active = ap
bpy.ops.object.modifier_apply(modifier="t")
fin(ap, "BossApron", M["apron"])
# (its cord round the waist)
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.012, major_segments=48, minor_segments=8, location=P(0, 0.425, 0))
cord = active()
# (its points in the world's own frame, so the waist it's laid on is where it is)
bpy.ops.object.transform_apply(location=True)
for v in cord.data.vertices:
    p3 = Vector((v.co.x, v.co.z, -v.co.y))
    d = Vector(P(p3.x, 0, p3.z)).normalized() if p3.length > 0 else Vector((1, 0, 0))
    hit = bvh.ray_cast(Vector(P(0, 0.425, 0)) + d * 1.0, -d)
    if hit[0]:
        v.co = hit[0] + d * 0.014 + Vector((0, 0, v.co.z - 0.425))
fin(cord, "BossCord", M["cord"])
# (the shop's name on it, white, upright)
bpy.ops.object.text_add(location=P(0, 0.26, 0.0))
tx = active()
tx.data.body = "聞野"
JP = bpy.data.fonts.load("C:/Windows/Fonts/YuGothB.ttc") if os.path.exists("C:/Windows/Fonts/YuGothB.ttc") else None
if JP:
    tx.data.font = JP
tx.data.size = 0.085
tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
tx.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.convert(target="MESH")
tx = active()
p_, n_ = front(0, 0.26)
tx.location = P(*(p_ + n_ * 0.022))
fin(tx, "BossPrint", M["print"], smooth=False)

# ---- hands (floating mittens) and shoes
hands = {}
for sd, at in ((-1, (-(side_r(0.34, -math.pi / 2) + 0.06), 0.34, 0.08)), (1, (side_r(0.55, math.pi / 2) + 0.08, 0.62, 0.1))):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.072, segments=18, ring_count=10, location=P(*at))
    h = active(); h.scale = (0.95, 0.85, 1.05)
    hn = fin(h, f"BossHand{'L' if sd < 0 else 'R'}Mitt", M["skin"])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=12, ring_count=8, location=P(at[0] + sd * 0.0, at[1] + 0.04, at[2] + 0.05))
    th = fin(active(), f"BossHand{'L' if sd < 0 else 'R'}Thumb", M["skin"])
    # (its own node at the world's origin, the mitt and thumb under it where they are: the game moves the node)
    e = bpy.data.objects.new(f"BossHand{'L' if sd < 0 else 'R'}", None)
    bpy.context.collection.objects.link(e)
    for o in (hn, th):
        mw = o.matrix_world.copy(); o.parent = e; o.matrix_world = mw
    hands[sd] = e
for sd in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=16, ring_count=8, location=P(sd * 0.11, 0.035, 0.06))
    s_ = active(); s_.scale = (0.85, 1.25, 0.6)
    fin(s_, f"BossShoe{sd}", M["shoe"])

root = bpy.data.objects.new("Boss", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
for e in hands.values():
    e.parent = root
export_dish(root, parts + list(hands.values()) + [root], os.path.join(PROJECT, "public", "models", "boss.glb"), os.path.join(PROJECT, "blender", "boss.blend"), PREVIEW)
print("BOSS_DONE", sum(len(o.data.polygons) for o in parts))
