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

# ---- the chrysanthemums: a few small ones among the leaves, rows of slim petals round a domed heart, outer ones splayed, inner ones cupped
def mum(name, at, r, mat):
    b = bmesh.new()
    for ring, (n, rr, up) in enumerate(((20, r, 0.1), (18, r * 0.85, 0.4), (15, r * 0.66, 0.75), (11, r * 0.45, 1.05))):
        for i in range(n):
            a = 2 * math.pi * (i + ring * 0.37) / n
            tip = Vector((math.cos(a) * rr, math.sin(a) * rr, rr * up))
            side = Vector((-math.sin(a), math.cos(a), 0)) * rr * 0.22
            base = Vector((0, 0, 0))
            vs = [b.verts.new(base + side * 0.3), b.verts.new(tip * 0.55 + side), b.verts.new(tip), b.verts.new(tip * 0.55 - side), b.verts.new(base - side * 0.3)]
            b.faces.new((vs[0], vs[1], vs[2], vs[3], vs[4]))
    me_ = bpy.data.meshes.new(name)
    b.to_mesh(me_)
    b.free()
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    o.location = at
    sol_ = o.modifiers.new("t", "SOLIDIFY"); sol_.thickness = 0.0005
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="t")
    fin(o, name, mat)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.22, segments=10, ring_count=6, location=at + Vector((0, 0, r * 0.45)))
    hb = active(); hb.scale = (1, 1, 0.6)
    fin(hb, name + "Heart", M["heart"])


# (the blooms: a crowd of them heaped over the mouth and spilling out round it, the biggest at the top, some leaning well out; a few buds)
PAL = (["white", "yellow", "white", "yellow", "white"] if VARIANT == 0 else ["pink", "crimson", "violet", "pink", "white", "crimson"])
NB = 9 if VARIANT == 0 else 10
for i in range(NB):
    a_ = i * 2.399 + random.uniform(-0.2, 0.2)
    rr = 0.0 if i == 0 else random.uniform(0.022, 0.05)
    up = 0.185 - rr * 0.9 + random.uniform(-0.008, 0.008)
    r = (0.032 if i == 0 else random.uniform(0.02, 0.028)) * (1.0 if VARIANT == 0 else 0.95)
    at = Vector(P(math.cos(a_) * rr, up, math.sin(a_) * rr))
    mum(f"VaseMum{i}", at, r, M[PAL[i % len(PAL)]])
    # (its stalk, down to the mouth)
    cu = bpy.data.curves.new(f"stalk{i}", "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("POLY"); sp.points.add(1)
    sp.points[0].co = (*MOUTH, 1); sp.points[1].co = (*(at - Vector((0, 0, r * 0.2))), 1)
    cu.bevel_depth = 0.001
    o = bpy.data.objects.new(f"stalk{i}", cu); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    fin(active(), f"VaseStalk{i}", M["stem"])
for i in range(5):
    a_ = random.uniform(0, 2 * math.pi)
    rr = random.uniform(0.04, 0.06)
    at = Vector(P(math.cos(a_) * rr, random.uniform(0.15, 0.175), math.sin(a_) * rr))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0035, segments=10, ring_count=6, location=at)
    bd = active(); bd.scale = (1, 1, 1.4)
    fin(bd, f"VaseBud{i}", M["bud"] if VARIANT == 0 else M[PAL[i % len(PAL)]])
root = bpy.data.objects.new(f"ShrineVase{VARIANT}", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", f"shrinevase{VARIANT}.glb"), os.path.join(PROJECT, "blender", f"shrinevase{VARIANT}.blend"), PREVIEW)
print("SHRINEVASE_DONE", len(parts), "parts", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts), "tris")
