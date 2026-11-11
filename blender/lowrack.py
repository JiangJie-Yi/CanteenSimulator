"""The low dish rack by the cook table (lowrack.glb; the owner's, 2026-11-11: a low rack of plates beside the hearth table, the clean plates near
the plating place): a knee-high stand of oiled cedar, four square posts, two shelves of slats with a gap between each, a rail along the front
and the back under each shelf; the plates stand on it in piles (drawn by the game: as many as there are).

The game's frame: y up from the floor, x across it, its front toward +z; the middle of its foot at the origin. W wide, D deep, H high; SHELF
the shelves' tops (PlateRack.tsx's LOW_SHELVES, the same). About 230 triangles.

Run:
    blender -b --factory-startup --python blender/lowrack.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import active, export_dish, image, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

W, D, H = 0.62, 0.38, 0.42
POST = 0.036
SHELF = (0.1, 0.34)
SLAT_T, SLATS = 0.018, 5


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# (oiled cedar: the grain running along the picture, a little uneven from board to board)
rng = np.random.default_rng(11)
Wt, Ht = 512, 64
v = np.linspace(0, 1, Ht)[:, None]
u = np.linspace(0, 1, Wt)[None, :]
grain = 0.5 + 0.5 * np.sin((v * 18 + np.sin(u * 6 + v * 3) * 0.8) * math.pi * 2)
wood = np.clip(0.78 + 0.18 * grain - 0.18 * rng.random((Ht, 1)) + rng.normal(0, 0.025, (Ht, Wt)), 0, 1)
M = {
    "slat": pbr("LowRackSlat", (1, 1, 1), tex=image("lowrack_slat", (wood[..., None] * np.array(lin("#b07a48"))[None, None, :] * 1.1).astype(np.float32)), rough=0.6),
    "frame": pbr("LowRackFrame", (1, 1, 1), tex=image("lowrack_frame", (wood[..., None] * np.array(lin("#7a5230"))[None, None, :] * 1.1).astype(np.float32)), rough=0.65),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.003):
    """a board, its edges eased, its picture laid along its longest side (the grain along it)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = o.modifiers.new("b", "BEVEL")
    m.width = bev
    m.segments = 1
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.name = name
    o.data.materials.append(M[mat])
    ext = (x1 - x0, z1 - z0, y1 - y0)
    la = max(range(3), key=lambda i: ext[i])
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        n = poly.normal
        sa = 1 if la != 1 and abs(n[1]) < 0.5 else (2 if la != 2 else 0)
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (co[la] * 1.6 + 0.5, co[sa] * 1.6 + 0.5)
    parts.append(o)
    return o


hw, hd = W / 2, D / 2
# (the four posts, foot to top)
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * (hw - POST / 2), sz * (hd - POST / 2)
        box(f"post{sx}{sz}", x - POST / 2, x + POST / 2, 0, H, z - POST / 2, z + POST / 2, "frame")
# (each shelf: a rail front and back between the posts under it, the slats across it from side to side with a gap between each, their ends
# on the side rails)
for k, top in enumerate(SHELF):
    for sz in (-1, 1):
        z = sz * (hd - POST / 2)
        box(f"rail{k}{sz}", -hw + POST, hw - POST, top - SLAT_T - 0.05, top - SLAT_T, z - 0.011, z + 0.011, "frame", bev=0.002)
    for sx in (-1, 1):
        x = sx * (hw - POST / 2)
        box(f"side{k}{sx}", x - 0.011, x + 0.011, top - SLAT_T - 0.03, top - SLAT_T, -hd + POST, hd - POST, "frame", bev=0.002)
    span = D - 2 * POST + 0.01
    sw = (span - (SLATS - 1) * 0.014) / SLATS
    for j in range(SLATS):
        z0 = -span / 2 + j * (sw + 0.014)
        box(f"slat{k}{j}", -hw + POST / 2, hw - POST / 2, top - SLAT_T, top, z0, z0 + sw, "slat", bev=0.002)
# (a cap rail along the back at the top, to keep the piles from going over)
box("cap", -hw, hw, H - 0.02, H, -hd, -hd + 0.03, "frame", bev=0.003)

bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = active()
body.name = "LowRackBody"
root = bpy.data.objects.new("LowRack", None)
bpy.context.collection.objects.link(root)
body.parent = root
export_dish(root, [body, root], os.path.join(PROJECT, "public", "models", "lowrack.glb"), os.path.join(PROJECT, "blender", "lowrack.blend"), PREVIEW)
print("LOWRACK_DONE")
