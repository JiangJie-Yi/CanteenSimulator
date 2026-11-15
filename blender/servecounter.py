"""The kitchen's serving counter (配膳台, servecounter.glb; item 167, the owner's, 2026-11-15: the takeaways' boxes stood in a plate at the cook
table's plating place, "if it's the orders that do it, a serving counter, there in the red box": the floor between the cook table and the
freezer): made as the kitchen's other counters are (blender/warmer.py), a terrazzo top on black-stained sugi, but open, on four legs, a shelf
low between them; its top level with the cook table's, the takeaways' boxes packed and waiting on it.

- node "ServeCounter": the counter. Low-poly: boxes, about 120 triangles.
- node "ServeCounterTop": an empty at the middle of its top (what's set on it stands there).
- node "ServeCounterFront": an empty on the floor before its front (+z) middle, where one stands to take from it.

The game's frame, in the bar's units (GuestBar3D's): y up from the floor it stands on, x along it, its front toward +z; its foot's middle at the
origin; H high (the cook table's top, standing on the kitchen's dais), D deep, L long.

Run:
    blender -b --factory-startup --python blender/servecounter.py -- <project path> [preview.png]
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
bpy.ops.wm.read_factory_settings(use_empty=True)

# (the cook table's top is 0.58 over the bar frame's floor; the dais it stands on, 0.084)
L, D, H = 0.9, 0.36, 0.496
TT = 0.035            # the terrazzo top's thickness
LEG = 0.032           # the legs' square
INSET = 0.025         # the legs in from the top's edge
APRON = 0.045         # the rails under the top
SHELF_Y, SHELF_T = 0.085, 0.02


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# ---------------------------------------------------------------------------------------------------- pictures (the kitchen counters')
N = 512
u, v = grid01(N)
ground = mix((0.8, 0.79, 0.76), (0.72, 0.71, 0.68), fbm(N, 6, 6, 4))
terr = ground.copy()
for cells, thr, col, k in ((90, 0.9, (0.18, 0.18, 0.19), 0.95), (140, 0.88, (0.5, 0.5, 0.5), 0.8), (110, 0.9, (0.96, 0.95, 0.93), 0.9),
                           (60, 0.95, (0.58, 0.38, 0.28), 0.85), (220, 0.86, (0.35, 0.35, 0.36), 0.7)):
    chip = smooth(thr, thr + 0.03, vnoise(N, cells, cells))
    terr = mix(terr, col, chip * k)
terr = terr * (0.96 + 0.06 * fbm(N, 64, 64, 2))[..., None]
grain = np.sin((u * 34 + (fbm(N, 2, 5, 4) - 0.5) * 0.9 + (fbm(N, 6, 2, 3) - 0.5) * 0.25) * 2 * math.pi) * 0.5 + 0.5
# (black-stained sugi, its grain just showing, as the warmer's)
sugi = mix((0.04, 0.034, 0.03), (0.016, 0.014, 0.013), smooth(0.6, 1.0, grain) * 0.7)
sugi = sugi * (0.94 + 0.08 * fbm(N, 3, 12, 4))[..., None]
M = {
    "terrazzo": pbr("ServeTerrazzo", (1, 1, 1), tex=image("servecounter_terrazzo", np.clip(terr, 0, 1).astype(np.float32)), rough=0.35),
    "sugi": pbr("ServeSugi", (1, 1, 1), tex=image("servecounter_sugi", np.clip(sugi, 0, 1).astype(np.float32)), rough=0.5),
}


def box_uv(o, tile):
    """every face's picture laid flat on it at its true size, from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


parts = []


def block(name, lo, hi, mat, tile):
    """a box from `lo` to `hi` (the game's frame), its picture at its true size"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(lo) + Vector(hi)) / 2
    s = Vector(hi) - Vector(lo)
    for vv in bm.verts:
        vv.co = P(c.x + vv.co.x * s.x, c.y + vv.co.y * s.y, c.z + vv.co.z * s.z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    box_uv(o, tile)
    parts.append(o)
    return o


# the top
block("ServeTop", (-L / 2, H - TT, -D / 2), (L / 2, H, D / 2), "terrazzo", 0.3)
# the legs, square, in from the corners
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * (L / 2 - INSET - LEG / 2), sz * (D / 2 - INSET - LEG / 2)
        block(f"ServeLeg{sx}{sz}", (x - LEG / 2, 0, z - LEG / 2), (x + LEG / 2, H - TT, z + LEG / 2), "sugi", 0.15)
# the rails under the top, between the legs (set a hair in from the legs' faces, so no two faces lie in one plane)
ri = L / 2 - INSET - LEG + 0.002
rj = D / 2 - INSET - LEG + 0.002
for sz in (-1, 1):
    z = sz * (D / 2 - INSET - LEG / 2)
    block(f"ServeRailLong{sz}", (-ri, H - TT - APRON, z - LEG / 2 + 0.004), (ri, H - TT - 0.001, z + LEG / 2 - 0.004), "sugi", 0.15)
for sx in (-1, 1):
    x = sx * (L / 2 - INSET - LEG / 2)
    block(f"ServeRailShort{sx}", (x - LEG / 2 + 0.004, H - TT - APRON, -rj), (x + LEG / 2 - 0.004, H - TT - 0.001, rj), "sugi", 0.15)
# the shelf low between the legs, its corners notched round them (four boxes: a middle board and two end strips between the legs)
sx0 = L / 2 - INSET - LEG
block("ServeShelf", (-sx0 + 0.001, SHELF_Y, -(D / 2 - INSET)), (sx0 - 0.001, SHELF_Y + SHELF_T, D / 2 - INSET), "sugi", 0.15)
for sx in (-1, 1):
    x0, x1 = sorted((sx * (sx0 + 0.001), sx * (L / 2 - INSET - 0.001)))
    block(f"ServeShelfEnd{sx}", (x0, SHELF_Y, -(D / 2 - INSET - LEG - 0.001)), (x1, SHELF_Y + SHELF_T, D / 2 - INSET - LEG - 0.001), "sugi", 0.15)

# (one node of it all, its own name; the marks)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
counter = bpy.context.view_layer.objects.active
counter.name = "ServeCounter"
root = bpy.data.objects.new("ServeCounterRoot", None)
bpy.context.collection.objects.link(root)
counter.parent = root
top = bpy.data.objects.new("ServeCounterTop", None)
top.location = P(0, H, 0)
front = bpy.data.objects.new("ServeCounterFront", None)
front.location = P(0, 0, D / 2 + 0.18)
for o in (top, front):
    bpy.context.collection.objects.link(o)
    o.parent = root
print("SERVE_TRIS", sum(len(p.vertices) - 2 for p in counter.data.polygons))
export_dish(root, [counter, top, front, root], os.path.join(PROJECT, "public", "models", "servecounter.glb"),
            os.path.join(PROJECT, "blender", "servecounter.blend"), PREVIEW)
print("SERVE_DONE")
