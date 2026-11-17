"""The dry goods in the cook table's cupboards (pantry.glb; items 274, 275, the owner's, 2026-11-17: 「調料有缺 跟庫存的對不上(比方說鹽巴、
味精...)，這些可以放到 料理台下的系統櫃門」, after a picture of real shop goods: boxes, bottles, tins and bags, simple shapes and their print).
In the warming counter's own frame (blender/warmer.py's "Warmer": x along it, y up from the floor, +z toward its doors). Its three cupboards
(warmer.py's `cupboards`): partitions at x 0.794 and 2.248, each with its floor's top at y 0.125 and a shelf across it, its top at 0.644, from
the back (z -0.469) to 0.37; the first holds the stock pot and the soup bowls, the second the trays, the third the food boxes and the baskets.

What the shop keeps dry, each as many as there's stock of it (game/pantry: all at the usual stock, none at none), where the plain-coloured
salt tub, nori box, miso tubs and rice bags stood (warmer.py had them, no stock behind them):

- "PantryRice0", "1": 5 kg bags of rice lying one on the other, the middle cupboard's floor (the rice for the onigiri, its stock's).
- "PantrySalt0".."2": 500 g bags of salt stood up beside them.
- "PantryShichimi0".."2": tins of shichimi on its shelf, past the trays.
- "PantryNori0".."2": packs of nori lying one on the other beside them.
- "PantryPeanut0".."2": stand-up pouches of the peanut powder on the first cupboard's floor, past the stock pot.

Every package's print is the game's (Decor paints one picture, a sixth of it each, three across and two down, in the stock panel's own names
for them, in the page's language): here each face is only laid on its place in that picture, a plain stand-in painted. Each sixth: its
label u 0..0.72 (the package's front; a tin's round), its side's colour u 0.76..1 v 0..0.48, its top's v 0.52..1.

Run:
    blender -b --factory-startup --python blender/pantry.py -- <project path> [preview.png]
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
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


FLOOR, SHELF = 0.125, 0.644      # the cupboards' floors' tops and their shelves' tops (warmer.py)
CUP0 = (-0.671, 0.7815)           # the first cupboard's inside, wall to partition
CUP1 = (0.8065, 2.2355)           # the second's
# (the atlas's sixths: three across, two down)
CELL = {"salt": (0, 1), "shichimi": (1, 1), "rice": (2, 1), "peanut": (0, 0), "nori": (1, 0)}
LABEL_U = (0.0, 0.72)
SIDE = ((0.76, 1.0), (0.0, 0.48))
TOPA = ((0.76, 1.0), (0.52, 1.0))


def cell_uv(kind, u, v):
    """a quarter's own (u, v) into the atlas's"""
    cx, cy = CELL[kind]
    return ((cx + u) / 3, (cy + v) / 2)


def mesh_obj(name, bm, smooth_shade=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth_shade
    return o


def tris(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def face(bm, uvl, pts, uvs):
    f = bm.faces.new([bm.verts.new(P(*p)) for p in pts])
    for lp, uv in zip(f.loops, uvs):
        lp[uvl].uv = uv
    return f


def bag(name, kind, cx, cz, w, h, d, seal=0.025, crimp=0.82):
    """a bag stood up (cx, cz its foot's middle, on the floor or shelf at y0 given by the caller through `base`): its sides straight, its front and
    back leaning in over its top fifth to a flat sealed seam; the front its label, the back too, the sides and the seam their colours"""
    return lambda y0: _bag(name, kind, cx, y0, cz, w, h, d, seal, crimp)


def _bag(name, kind, cx, y0, cz, w, h, d, seal, crimp):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    x0, x1 = cx - w / 2, cx + w / 2
    ys = [y0, y0 + h * crimp, y0 + h]
    ds = [d / 2, d / 2, seal / 2]
    L = lambda u, v: cell_uv(kind, LABEL_U[0] + (LABEL_U[1] - LABEL_U[0]) * u, v)
    S = lambda u, v: cell_uv(kind, SIDE[0][0] + (SIDE[0][1] - SIDE[0][0]) * u, SIDE[1][0] + (SIDE[1][1] - SIDE[1][0]) * v)
    T = lambda u, v: cell_uv(kind, TOPA[0][0] + (TOPA[0][1] - TOPA[0][0]) * u, TOPA[1][0] + (TOPA[1][1] - TOPA[1][0]) * v)
    vs = [ys[0], ys[1], ys[2]]
    for k in range(2):
        ya, yb, da, db = ys[k], ys[k + 1], ds[k], ds[k + 1]
        va, vb = (ya - y0) / h, (yb - y0) / h
        # (front, +z; back, -z: the label each, the back's mirrored)
        face(bm, uvl, [(x0, ya, cz + da), (x1, ya, cz + da), (x1, yb, cz + db), (x0, yb, cz + db)], [L(0, va), L(1, va), L(1, vb), L(0, vb)])
        face(bm, uvl, [(x1, ya, cz - da), (x0, ya, cz - da), (x0, yb, cz - db), (x1, yb, cz - db)], [L(0, va), L(1, va), L(1, vb), L(0, vb)])
        # (the sides)
        face(bm, uvl, [(x1, ya, cz + da), (x1, ya, cz - da), (x1, yb, cz - db), (x1, yb, cz + db)], [S(0, va), S(1, va), S(1, vb), S(0, vb)])
        face(bm, uvl, [(x0, ya, cz - da), (x0, ya, cz + da), (x0, yb, cz + db), (x0, yb, cz - db)], [S(0, va), S(1, va), S(1, vb), S(0, vb)])
    # (its seam on top, its foot)
    face(bm, uvl, [(x0, ys[2], cz + ds[2]), (x1, ys[2], cz + ds[2]), (x1, ys[2], cz - ds[2]), (x0, ys[2], cz - ds[2])], [T(0, 0), T(1, 0), T(1, 1), T(0, 1)])
    face(bm, uvl, [(x0, y0, cz - ds[0]), (x1, y0, cz - ds[0]), (x1, y0, cz + ds[0]), (x0, y0, cz + ds[0])], [T(0, 0), T(1, 0), T(1, 1), T(0, 1)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def flat_pack(name, kind, cx, y0, cz, w, t, d, crown=0.012):
    """a pack lying flat (rice in its bag, nori in its sleeve), its label on its top, which bellies up a little (`crown`) along its middle;
    its edges its side's colour, its underside its top's"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    x0, x1, z0, z1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2
    yb, yt = y0, y0 + t
    L = lambda u, v: cell_uv(kind, LABEL_U[0] + (LABEL_U[1] - LABEL_U[0]) * u, v)
    S = lambda u, v: cell_uv(kind, SIDE[0][0] + (SIDE[0][1] - SIDE[0][0]) * u, SIDE[1][0] + (SIDE[1][1] - SIDE[1][0]) * v)
    T = lambda u, v: cell_uv(kind, TOPA[0][0] + (TOPA[0][1] - TOPA[0][0]) * u, TOPA[1][0] + (TOPA[1][1] - TOPA[1][0]) * v)
    zm = cz
    # (its top in two, raised along its middle: the label read from the doors, its foot toward them)
    face(bm, uvl, [(x0, yt, z1), (x1, yt, z1), (x1, yt + crown, zm), (x0, yt + crown, zm)], [L(0, 0), L(1, 0), L(1, 0.5), L(0, 0.5)])
    face(bm, uvl, [(x0, yt + crown, zm), (x1, yt + crown, zm), (x1, yt, z0), (x0, yt, z0)], [L(0, 0.5), L(1, 0.5), L(1, 1), L(0, 1)])
    # (its edges)
    face(bm, uvl, [(x0, yb, z1), (x1, yb, z1), (x1, yt, z1), (x0, yt, z1)], [S(0, 0), S(1, 0), S(1, 1), S(0, 1)])
    face(bm, uvl, [(x1, yb, z0), (x0, yb, z0), (x0, yt, z0), (x1, yt, z0)], [S(0, 0), S(1, 0), S(1, 1), S(0, 1)])
    face(bm, uvl, [(x1, yb, z1), (x1, yb, z0), (x1, yt, z0), (x1, yt + crown, zm), (x1, yt, z1)][:3] + [(x1, yt, z1)], [S(0, 0), S(1, 0), S(1, 1), S(0, 1)])
    face(bm, uvl, [(x1, yt, z1), (x1, yt, z0), (x1, yt + crown, zm)], [S(0, 0), S(1, 0), S(0.5, 1)])
    face(bm, uvl, [(x0, yb, z0), (x0, yb, z1), (x0, yt, z1), (x0, yt, z0)], [S(0, 0), S(1, 0), S(1, 1), S(0, 1)])
    face(bm, uvl, [(x0, yt, z0), (x0, yt, z1), (x0, yt + crown, zm)], [S(0, 0), S(1, 0), S(0.5, 1)])
    face(bm, uvl, [(x0, yb, z0), (x1, yb, z0), (x1, yb, z1), (x0, yb, z1)], [T(0, 0), T(1, 0), T(1, 1), T(0, 1)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def tin(name, kind, cx, y0, cz, r, h, seg=12):
    """a tin stood up: its round the label, the seam at its back (its label's middle facing the doors), its lid and foot closed with ladders"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    T = lambda u, v: cell_uv(kind, TOPA[0][0] + (TOPA[0][1] - TOPA[0][0]) * u, TOPA[1][0] + (TOPA[1][1] - TOPA[1][0]) * v)
    rings = []
    for y in (y0, y0 + h):
        ring = []
        for k in range(seg + 1):
            a = -math.pi + 2 * math.pi * k / seg       # from the back round by +x to the front (a 0) and on
            ring.append(bm.verts.new(P(cx + r * math.sin(a), y, cz + r * math.cos(a))))
        rings.append(ring)
    for k in range(seg):
        f = bm.faces.new((rings[0][k], rings[0][k + 1], rings[1][k + 1], rings[1][k]))
        u0, u1 = LABEL_U[0] + (LABEL_U[1] - LABEL_U[0]) * k / seg, LABEL_U[0] + (LABEL_U[1] - LABEL_U[0]) * (k + 1) / seg
        for lp, uv in zip(f.loops, (cell_uv(kind, u0, 0), cell_uv(kind, u1, 0), cell_uv(kind, u1, 1), cell_uv(kind, u0, 1))):
            lp[uvl].uv = uv
    # (the seam's two columns of points made one, then the ends closed in ladders)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.verts.ensure_lookup_table()
    for y in (y0, y0 + h):
        ring = sorted([v for v in bm.verts if abs(v.co.z - y) < 1e-6], key=lambda v: math.atan2(v.co.x - cx, -v.co.y - cz))
        if y == y0:
            ring = list(reversed(ring))
        before = set(bm.faces)
        ladder_fill(bm, ring)
        for f in set(bm.faces) - before:
            for lp in f.loops:
                lx, lz = (lp.vert.co.x - cx) / r, (-lp.vert.co.y - cz) / r
                lp[uvl].uv = T(0.5 + 0.5 * lx, 0.5 + 0.5 * lz)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, smooth_shade=True)


def slab(bm, uvl, x0, x1, y0, y1, z0, z1):
    for pts in (((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)), ((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)),
                ((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)), ((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)),
                ((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)), ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))):
        f = face(bm, uvl, pts, [(p[0] * 2, p[1] * 2 + p[2] * 2) for p in pts])


# =====================================================================
# The stand-in picture (the game paints its own over it)
# =====================================================================
def stand_in(N=256):
    rgb = np.zeros((N * 2, N * 3, 3), np.float32)
    looks = {"salt": ((0.95, 0.95, 0.93), (0.2, 0.35, 0.7)), "shichimi": ((0.78, 0.2, 0.12), (0.75, 0.62, 0.3)),
             "rice": ((0.74, 0.6, 0.42), (0.7, 0.2, 0.15)), "peanut": ((0.72, 0.56, 0.36), (0.45, 0.3, 0.16)),
             "nori": ((0.08, 0.12, 0.1), (0.75, 0.62, 0.3))}
    for kind, (cx, cy) in CELL.items():
        body, band = looks[kind]
        x0, y0 = cx * N, cy * N
        rgb[y0:y0 + N, x0:x0 + N] = body
        rgb[y0 + int(N * 0.72):y0 + int(N * 0.84), x0:x0 + int(N * 0.72)] = band
    return rgb


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "label": pbr("PantryLabel", (1, 1, 1), tex=image("pantrylabel", stand_in()), rough=0.6),
}
parts = []


def keep(o, mat):
    o.data.materials.append(mat)
    parts.append(o)
    return o


# the packages, each kind's first on the left (shown first: the last of it taken last), toward the doors of their cupboard (its floor's front
# rail covers its foot's first 2.5 cm, as it would)
ZF = 0.16
# (the middle cupboard's floor: the rice, two bags lying one on the other at its left; the salt stood up beside them)
for k in range(2):
    keep(flat_pack(f"PantryRice{k}", "rice", 1.13, FLOOR + 0.001 + k * 0.142, ZF - 0.08, 0.5, 0.13, 0.38, crown=0.01), M["label"])
for k, x in enumerate((1.56, 1.78, 2.0)):
    keep(bag(f"PantrySalt{k}", "salt", x, ZF, 0.18, 0.3, 0.08)(FLOOR + 0.001), M["label"])
# (its shelf, past the trays (warmer.py's, to x 1.37): the shichimi's tins, the nori's packs lying one on the other)
for k, x in enumerate((1.47, 1.6, 1.73)):
    keep(tin(f"PantryShichimi{k}", "shichimi", x, SHELF + 0.001, ZF + 0.02, 0.05, 0.22), M["label"])
for k in range(3):
    keep(flat_pack(f"PantryNori{k}", "nori", 1.99, SHELF + 0.001 + k * 0.034, ZF - 0.06, 0.34, 0.03, 0.3, crown=0.003), M["label"])
# (the first cupboard's floor, past the stock pot (to x -0.15): the peanut powder's pouches)
for k, x in enumerate((0.1, 0.34, 0.58)):
    keep(bag(f"PantryPeanut{k}", "peanut", x, ZF, 0.2, 0.3, 0.07, seal=0.02, crimp=0.86)(FLOOR + 0.001), M["label"])

root = bpy.data.objects.new("Pantry", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
    print(o.name, tris([o]))
if PREVIEW:
    target = P(2.25, 0.55, 0.0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(2.25, 1.1, 3.0)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35
    bpy.context.scene.camera = cam
    for nm, loc, energy in (("Key", P(1.0, 3.0, 3.0), 4.0), ("Fill", P(4.0, 2.0, 3.0), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = energy
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "pantry.glb"), os.path.join(PROJECT, "blender", "pantry.blend"), PREVIEW)
print("PANTRY_DONE", tris(parts))
