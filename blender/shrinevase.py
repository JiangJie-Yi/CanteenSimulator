"""A shrine vase (榊立て) for either side of the household shrine: a white porcelain bottle, slender necked, a cobalt band of waves round its
shoulder and a fine line at its foot, holding a spray of sakaki (glossy dark leaves, veined, on branching stems) with a few small chrysanthemums
(white and yellow, petals in layers). About 18 cm tall in the shrine's units, standing on y = 0, its middle at x = z = 0.

Writes public/models/shrinevase.glb and blender/shrinevase.blend; its root node is "ShrineVase".

Run:
    blender -b --factory-startup --python blender/shrinevase.py -- <project path> [preview.png]
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 and argv[1] else None
# (which arrangement: 0 white and gold chrysanthemums, 1 pink, crimson and violet blooms with white)
VARIANT = int(argv[2]) if len(argv) > 2 else 0
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(5 + 11 * VARIANT)


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


# ---- the porcelain's picture: white, a cobalt band of seigaiha round the shoulder (v 0.62..0.78), a double line under it and at the foot
N = 512
u, v = grid01(N)
pc = np.ones((N, N, 3), np.float32) * np.array([0.95, 0.94, 0.9], np.float32)
band = (v > 0.62) & (v < 0.78)
cu, cv = (u * 18) % 1.0, ((v - 0.62) / 0.16 * 3) % 1.0
d = np.sqrt((cu - 0.5) ** 2 + (cv * 0.9) ** 2)
waves = (np.sin(d * 2 * math.pi * 4) > 0.2) & band
cobalt = np.array([0.12, 0.2, 0.52], np.float32)
pc[waves] = cobalt
for y0, w in ((0.6, 0.008), (0.585, 0.004), (0.8, 0.006), (0.06, 0.008), (0.045, 0.004)):
    pc[np.abs(v - y0) < w] = cobalt
M = {
    "porcelain": pbr("VasePorcelain", (1, 1, 1), tex=image("vase_porcelain", pc), rough=0.12, coat=0.8),
    "leaf": pbr("VaseLeaf", lin("#1f4a24"), rough=0.25, coat=0.5),
    "leafBack": pbr("VaseLeafPale", lin("#4f7a3a"), rough=0.5),
    "stem": pbr("VaseStem", lin("#5a3d22"), rough=0.7),
    "white": pbr("VaseMumWhite", lin("#f4f1e6"), rough=0.6),
    "yellow": pbr("VaseMumYellow", lin("#e8b82a"), rough=0.6),
    "heart": pbr("VaseMumHeart", lin("#c98a1a"), rough=0.7),
    "pink": pbr("VaseMumPink", lin("#f08aa8"), rough=0.55),
    "crimson": pbr("VaseMumCrimson", lin("#c8283c"), rough=0.55),
    "violet": pbr("VaseMumViolet", lin("#9a5ac8"), rough=0.55),
    "bud": pbr("VaseBud", lin("#6a9a3a"), rough=0.6),
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


# ---- the vase: turned from a profile (radius, height), its foot, belly, shoulder, slender neck and flared lip; hollow at the mouth
prof = [(0.0, 0.0), (0.024, 0.0), (0.026, 0.004), (0.03, 0.018), (0.034, 0.04), (0.033, 0.058), (0.026, 0.07), (0.016, 0.08),
        (0.012, 0.092), (0.012, 0.104), (0.015, 0.112), (0.018, 0.116), (0.0165, 0.117), (0.011, 0.112), (0.0, 0.11)]
seg = 40
import bmesh  # noqa: E402
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / seg), y, r * math.sin(2 * math.pi * j / seg))) for j in range(seg)] for r, y in prof]
H = 0.117
for i in range(len(rings) - 1):
    for j in range(seg):
        j2 = (j + 1) % seg
        f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
        for lp, (uu, vv) in zip(f.loops, ((j / seg, prof[i][1]), ((j + 1) / seg, prof[i][1]), ((j + 1) / seg, prof[i + 1][1]), (j / seg, prof[i + 1][1]))):
            lp[uvl].uv = (uu, vv / H)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Vase")
bm.to_mesh(me)
bm.free()
vase = bpy.data.objects.new("Vase", me)
bpy.context.collection.objects.link(vase)
fin(vase, "VaseBody", M["porcelain"])

# ---- the sakaki: a few branching stems out of the mouth, each with pairs of glossy, pointed, gently folded leaves along it
leaf_bm = bmesh.new()


def leaf_mesh():
    """a sakaki leaf along +y: pointed oval, folded a little along its midrib, 4 cm long (its pale back on the other side)"""
    b = bmesh.new()
    L, W = 0.034, 0.013
    cols = []
    for i in range(9):
        t = i / 8
        w = W / 2 * math.sin(math.pi * t) ** 0.8
        cols.append([b.verts.new((s * w, t * L, abs(s) * w * 0.35 - 0.002 * math.sin(math.pi * t))) for s in (-1, 0, 1)])
    for i in range(8):
        for k in range(2):
            b.faces.new((cols[i][k], cols[i][k + 1], cols[i + 1][k + 1], cols[i + 1][k]))
    me_ = bpy.data.meshes.new("leaf")
    b.to_mesh(me_)
    b.free()
    return me_


LEAF = leaf_mesh()
leaves = []
stems = []
MOUTH = Vector(P(0, 0.112, 0))
NST = 7
for s in range(NST):
    ang = s * 2 * math.pi / NST + random.uniform(-0.3, 0.3)
    lean = random.uniform(0.4, 0.95)
    length = random.uniform(0.08, 0.13)
    d = Vector(P(math.cos(ang) * math.sin(lean), math.cos(lean), math.sin(ang) * math.sin(lean)))
    pts = [MOUTH + d * length * t + Vector(P(0, -0.01 * t * t, 0)) for t in (0, 0.5, 1)]
    cu = bpy.data.curves.new(f"stem{s}", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts):
        sp.points[i].co = (*q, 1)
    cu.bevel_depth = 0.0012
    cu.bevel_resolution = 1
    o = bpy.data.objects.new(f"stem{s}", cu)
    bpy.context.collection.objects.link(o)
    stems.append(o)
    for k in range(3):
        t = 0.35 + k * 0.22
        at = MOUTH + d * length * t
        for side in (-1, 1):
            lo = bpy.data.objects.new(f"leaf{s}{k}{side}", LEAF.copy())
            bpy.context.collection.objects.link(lo)
            lo.location = at
            # (out from the stem, then up along it, each pair turned a quarter from the last)
            lo.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
            lo.rotation_euler.rotate(Euler((side * 1.1, 0, k * 1.57 + random.uniform(-0.3, 0.3))))
            lo.scale = (1, random.uniform(0.75, 1.1), 1)
            leaves.append(lo)
    # (and a leaf at its tip)
    lo = bpy.data.objects.new(f"leafTip{s}", LEAF.copy())
    bpy.context.collection.objects.link(lo)
    lo.location = MOUTH + d * length
    lo.rotation_euler = (d.to_track_quat("Y", "Z")).to_euler()
    leaves.append(lo)
for o in stems:
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
bpy.ops.object.select_all(action="DESELECT")
for o in stems:
    o.select_set(True)
bpy.context.view_layer.objects.active = stems[0]
bpy.ops.object.join()
fin(stems[0], "VaseStems", M["stem"])
for o in leaves:
    o.select_set(False)
bpy.ops.object.select_all(action="DESELECT")
for o in leaves:
    o.select_set(True)
bpy.context.view_layer.objects.active = leaves[0]
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.join()
lv = leaves[0]
sol = lv.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.0006
bpy.ops.object.modifier_apply(modifier="t")
fin(lv, "VaseLeaves", M["leaf"])

# ---- the blooms, each built petal by petal: every petal a little curved sheet (its width along it shaped round, narrow or pointed),
# rising from the heart at its own angle and curling as it goes, cupped across; laid in rings, each ring turned from the last
def petal(b, a, r0, L, W, elev, curl, cup, shape, nt=7, ns=5):
    rad = Vector((math.cos(a), math.sin(a), 0))
    tan = Vector((-math.sin(a), math.cos(a), 0))
    up = Vector((0, 0, 1))
    spine, p_ = [], rad * r0
    for i in range(nt + 1):
        t = i / nt
        e = elev + curl * t
        spine.append((p_.copy(), e))
        p_ += (rad * math.cos(e) + up * math.sin(e)) * (L / nt)
    rows = []
    for i, (c, e) in enumerate(spine):
        t = i / nt
        w = {"round": math.sin(math.pi * min(0.999, t ** 0.6)) ** 0.5 if t < 1 else 0.25,
             "narrow": math.sin(math.pi * t ** 0.8) ** 0.7 * 0.9 + (0.1 if t < 1 else 0.0),
             "point": math.sin(math.pi * t ** 1.25) ** 0.9}[shape] * W / 2
        nrm = up * math.cos(e) - rad * math.sin(e)
        across = [k / (ns // 2) - 1 for k in range(ns)]
        rows.append([b.verts.new(c + tan * w * s_ + nrm * cup * w * (s_ * s_)) for s_ in across])
    for i in range(nt):
        for k in range(ns - 1):
            b.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]))


def stalk(name, at):
    cu = bpy.data.curves.new(name + "Stalk", "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("POLY"); sp.points.add(2)
    mid = (MOUTH + at) / 2 + Vector((0, 0, -0.006))
    for k, q in enumerate((MOUTH, mid, at)):
        sp.points[k].co = (*q, 1)
    cu.bevel_depth = 0.0011
    o = bpy.data.objects.new(name + "Stalk", cu); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    fin(active(), name + "Stalk", M["stem"])


def bloom(name, at, face, rings, mat, heart=None, extra=None, with_stalk=True):
    """a flower at `at` (the Blender frame) facing along `face`: `rings` of (count, start radius, length, width, rise, curl, cup, shape)"""
    b = bmesh.new()
    for (n, r0, L, W, elev, curl, cup, shape) in rings:
        ph = random.uniform(0, 1)
        for i in range(n):
            petal(b, 2 * math.pi * (i + ph) / n, r0, L * random.uniform(0.88, 1.12), W * random.uniform(0.9, 1.1),
                  elev + random.uniform(-0.12, 0.12), curl * random.uniform(0.8, 1.2), cup, shape, nt=5 if shape == "narrow" else 7,
                  ns=3 if shape == "narrow" else 5)
    me_ = bpy.data.meshes.new(name); b.to_mesh(me_); b.free()
    o = bpy.data.objects.new(name, me_); bpy.context.collection.objects.link(o)
    q = Vector(face).normalized().to_track_quat("Z", "Y")
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = q
    o.location = at
    fin(o, name, mat)
    if heart:
        hm, hr, hz = heart
        bpy.ops.mesh.primitive_uv_sphere_add(radius=hr, segments=12, ring_count=7, location=at + q @ Vector((0, 0, hz)))
        hb = active(); hb.scale = (1, 1, 0.65); hb.rotation_mode = "QUATERNION"; hb.rotation_quaternion = q
        fin(hb, name + "Heart", hm)
    if extra:
        extra(name, at, q)
    if with_stalk:
        stalk(name, at)


def stamens(name, at, q):
    """a camellia's heart: a short pale column of filaments crowned with a ring of yellow anthers"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.0045, depth=0.009, location=at + q @ Vector((0, 0, 0.006)))
    c = active(); c.rotation_mode = "QUATERNION"; c.rotation_quaternion = q
    fin(c, name + "Filament", M["cream"])
    for k in range(12):
        a = 2 * math.pi * k / 12
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0014, segments=6, ring_count=4,
                                             location=at + q @ Vector((math.cos(a) * 0.0047, math.sin(a) * 0.0047, 0.0108)))
        fin(active(), f"{name}Anther{k}", M["yellow"])


def spot(i, n, rmin, rmax, hmin, hmax):
    """where the i-th of n blooms sits: spread round the mouth by the golden angle, the outer ones lower and leaning out"""
    a_ = i * 2.399 + random.uniform(-0.25, 0.25)
    rr = rmin + (rmax - rmin) * (i / max(1, n - 1)) ** 0.7 + random.uniform(-0.004, 0.004)
    h = hmax - (hmax - hmin) * (rr - rmin) / max(1e-6, rmax - rmin) + random.uniform(-0.006, 0.006)
    at = Vector(P(math.cos(a_) * max(0.0, rr), h, math.sin(a_) * max(0.0, rr)))
    out = at - MOUTH
    out.z = 0
    face = out * 12 + Vector((0, 0, 1))
    return at, face


M["cream"] = pbr("VaseFlowerCream", lin("#f2ead0"), rough=0.6)
M["gold"] = pbr("VaseMumGold", lin("#e0a020"), rough=0.55)
M["green"] = pbr("VaseMumGreen", lin("#b8c860"), rough=0.6)
M["peony"] = pbr("VaseMumPeony", lin("#f4a6bc"), rough=0.55)
M["blush"] = pbr("VaseMumBlush", lin("#fbd6de"), rough=0.55)
if VARIANT == 0:
    # 金運: white and gold chrysanthemums in three kinds: big incurved ball blooms (輪菊) heaped at the top, gold spider mums (糸菊) with long
    # thread petals curling at their ends, and a scatter of small single spray mums (小菊) round them, white and yellow with green hearts
    def BALL(r):
        return [(22, 0.002, r, r * 0.3, 0.15, 0.5, 0.6, "narrow"), (20, 0.002, r * 0.92, r * 0.32, 0.55, 0.7, 0.7, "narrow"),
                (17, 0.001, r * 0.85, r * 0.34, 0.95, 0.8, 0.8, "narrow"), (13, 0.0, r * 0.72, r * 0.36, 1.3, 0.9, 0.8, "narrow"),
                (9, 0.0, r * 0.55, r * 0.38, 1.5, 1.0, 0.8, "narrow")]

    def SPIDER(r):
        return [(26, 0.003, r, r * 0.07, 0.25, 1.7, 0.3, "narrow"), (20, 0.002, r * 0.8, r * 0.08, 0.7, 1.6, 0.3, "narrow"),
                (14, 0.0, r * 0.45, r * 0.12, 1.2, 0.9, 0.5, "narrow")]

    def SINGLE(r):
        return [(16, r * 0.25, r * 0.8, r * 0.26, 0.12, -0.15, 0.25, "narrow")]

    for i, (c, r) in enumerate([("white", 0.034), ("gold", 0.03), ("white", 0.028)]):
        at, face = spot(i, 3, 0.0, 0.03, 0.17, 0.19)
        bloom(f"VaseMumBall{i}", at, face, BALL(r), M[c])
    for i in range(2):
        at, face = spot(i + 3, 5, 0.03, 0.05, 0.155, 0.17)
        bloom(f"VaseMumSpider{i}", at, face, SPIDER(0.036), M["gold" if i == 0 else "yellow"])
    for i in range(9):
        at, face = spot(i + 2, 11, 0.032, 0.058, 0.145, 0.172)
        c = ("yellow", "white")[i % 2]
        bloom(f"VaseMumSmall{i}", at, face, SINGLE(0.014), M[c], heart=(M["green"] if c == "white" else M["heart"], 0.004, 0.001))
    NBUD, BUDMAT = 6, ["bud"]
else:
    # 良緣: a softer, livelier mix: full pink peony-like blooms (cupped round petals, paler at the heart), crimson camellias (椿) opened
    # wide round a column of stamens, violet bellflowers (桔梗) with their five pointed petals and balloon buds, and clouds of baby's
    # breath (霞草) through them
    def PEONY(r):
        return [(9, 0.003, r, r * 0.75, 0.3, 0.5, 0.6, "round"), (8, 0.002, r * 0.85, r * 0.7, 0.7, 0.6, 0.65, "round"),
                (7, 0.001, r * 0.65, r * 0.65, 1.05, 0.6, 0.65, "round"), (6, 0.0, r * 0.45, r * 0.6, 1.35, 0.5, 0.6, "round")]

    def PEONY_IN(r):
        return [(5, 0.0, r * 0.32, r * 0.55, 1.45, 0.4, 0.5, "round")]

    def CAMELLIA(r):
        return [(6, 0.003, r, r * 0.9, 0.25, 0.35, 0.5, "round"), (5, 0.002, r * 0.8, r * 0.85, 0.75, 0.35, 0.6, "round")]

    def BELL(r):
        return [(5, 0.0015, r, r * 0.6, 0.75, -0.35, 0.4, "point")]

    for i, (c, kind) in enumerate([("peony", "p"), ("crimson", "c"), ("peony", "p"), ("crimson", "c"), ("violet", "b"), ("violet", "b"),
                                   ("blush", "p"), ("violet", "b")]):
        at, face = spot(i, 8, 0.0, 0.055, 0.14, 0.19)
        if kind == "p":
            bloom(f"VaseMumPeony{i}", at, face, PEONY(0.03), M[c])
            bloom(f"VaseMumPeonyIn{i}", at, face, PEONY_IN(0.03), M["blush" if c == "peony" else "white"], with_stalk=False)
        elif kind == "c":
            bloom(f"VaseMumCamellia{i}", at, face, CAMELLIA(0.026), M[c], extra=stamens)
        else:
            bloom(f"VaseMumBell{i}", at, face, BELL(0.022), M[c], heart=(M["white"], 0.0035, 0.004))
    # (baby's breath: fine twigs forking out between the blooms, each tip a tiny white puff)
    twigs, dots = [], []
    for k in range(7):
        a_ = k * 0.9 + random.uniform(-0.3, 0.3)
        rr = random.uniform(0.05, 0.075)
        tip = Vector(P(math.cos(a_) * rr, random.uniform(0.15, 0.2), math.sin(a_) * rr))
        mid = MOUTH + (tip - MOUTH) * 0.55
        for f in range(6):
            end = tip + Vector((random.uniform(-0.018, 0.018), random.uniform(-0.018, 0.018), random.uniform(-0.01, 0.014)))
            twigs.append((MOUTH, mid, end) if f == 0 else (mid, end))
            for d_ in range(3):
                dots.append(end + Vector((random.uniform(-0.004, 0.004), random.uniform(-0.004, 0.004), random.uniform(-0.003, 0.003))))
    cu = bpy.data.curves.new("VaseBreathTwigs", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0005
    for tw in twigs:
        sp = cu.splines.new("POLY"); sp.points.add(len(tw) - 1)
        for k, q in enumerate(tw):
            sp.points[k].co = (*q, 1)
    o = bpy.data.objects.new("VaseBreathTwigs", cu); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    fin(active(), "VaseBreathTwigs", M["bud"])
    bm2 = bmesh.new()
    for q in dots:
        bmesh.ops.create_icosphere(bm2, subdivisions=1, radius=random.uniform(0.0016, 0.0024), matrix=Matrix.Translation(q))
    me2 = bpy.data.meshes.new("VaseMumBreath"); bm2.to_mesh(me2); bm2.free()
    o = bpy.data.objects.new("VaseMumBreath", me2); bpy.context.collection.objects.link(o)
    fin(o, "VaseMumBreath", M["white"])
    NBUD, BUDMAT = 5, ["violet"]
for i in range(NBUD):
    a_ = random.uniform(0, 2 * math.pi)
    rr = random.uniform(0.04, 0.065)
    at = Vector(P(math.cos(a_) * rr, random.uniform(0.15, 0.18), math.sin(a_) * rr))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0042 if VARIANT else 0.0035, segments=10, ring_count=6, location=at)
    bd = active(); bd.scale = (1, 1, 1.4)
    fin(bd, f"VaseBud{i}", M[BUDMAT[i % len(BUDMAT)]])
    stalk(f"VaseBud{i}", at)
root = bpy.data.objects.new(f"ShrineVase{VARIANT}", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
if PREVIEW:
    # (a close look for checking it: a camera a little above, a sun and a grey world)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.0, 0.24, 0.62)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(P(0, 0.12, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 70
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.45, 0.45, 1)
    bpy.context.scene.world = w
os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", f"shrinevase{VARIANT}.glb"), os.path.join(PROJECT, "blender", f"shrinevase{VARIANT}.blend"), PREVIEW)
print("SHRINEVASE_DONE", len(parts), "parts", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts), "tris")
