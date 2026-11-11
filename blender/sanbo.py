"""The offering stands on the shrine's table (sanbo.glb; the owner's, 2026-11-11: the offerings on stands like the photo, one with the oranges, the
other with glutinous rice dumplings):

- node "Sanbo": a 三方 of plain white hinoki: a square tray (折敷) with a low rim round it, its corners eased, on a square base (胴) a little
  narrower, each of whose four sides has its opening (眼象, a rounded cusped window) painted dark on it (a picture, not cut through: the
  low-poly rule), a thin dark line where the tray sits on the base.
- node "Dango": five white glutinous rice dumplings heaped on a square of white kaishi paper laid corner-on, four below and one on top
  (stands on the tray's floor at its origin).

The game's frame, in the altar's units (DiningRoom's): y up, its middle over the origin, the tray's floor at TRAY_FLOOR. Low-poly: boxes
and icospheres, no fans into a point.

Run:
    blender -b --factory-startup --python blender/sanbo.py -- <project path> [preview.png]
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

TRAY_W, TRAY_RIM, BOARD = 0.095, 0.012, 0.004
BASE_W, BASE_H = 0.07, 0.05
TRAY_FLOOR = BASE_H + BOARD


def P(x, y, z):
    return Vector((x, -z, y))


N = 256
u, v = grid01(N)
# (pale hinoki, its grain fine along u)
hin = mix((0.93, 0.85, 0.7), (0.85, 0.74, 0.57), smooth(0.6, 1.0, np.sin((u * 26 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.5)
# (a base side: the hinoki, and its opening painted in its middle: a rounded window, its top cusped in three, dark within, a thin pale line
# round it as the cut edge's)
x, y = (u - 0.5) * 2, (v - 0.42) * 2
cusp = 0.62 + 0.1 * np.cos(np.clip(x / 0.62, -1, 1) * math.pi * 1.5)
inside = (np.abs(x) < 0.62) & (y > -0.45) & (y < cusp) & ((x / 0.62) ** 2 + ((y + 0.45) / 1.0) ** 2 < 1.6)
edge = (np.abs(x) < 0.68) & (y > -0.52) & (y < cusp + 0.07) & ~inside
side = hin.copy()
side[edge] = side[edge] * 0.93
side[inside] = np.array((0.16, 0.11, 0.07))
M = {
    "hinoki": pbr("SanboHinoki", (1, 1, 1), tex=image("sanbo_hinoki", np.clip(hin, 0, 1).astype(np.float32)), rough=0.6),
    "side": pbr("SanboSide", (1, 1, 1), tex=image("sanbo_side", np.clip(side, 0, 1).astype(np.float32)), rough=0.6),
    "line": pbr("SanboLine", lin("#5a4632") if False else (0.09, 0.06, 0.04), rough=0.6),
    "mochi": pbr("SanboMochi", (0.93, 0.92, 0.88), rough=0.75),
    "paper": pbr("SanboPaper", (0.95, 0.94, 0.9), rough=0.9),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, uv_side=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 1)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            if uv_side and abs(n.z) < 0.5:
                # (each side's picture laid over the whole of it once: its opening in its middle)
                a = c.x if abs(n.y) > abs(n.x) else c.y
                uvl.data[li].uv = ((a - (x0 if abs(n.y) > abs(n.x) else -z1)) / (x1 - x0), (c.z - y0) / (y1 - y0))
            else:
                uvl.data[li].uv = (c.x / 0.1 + 0.5, (c.y if abs(n.z) > 0.5 else c.z) / 0.1 + 0.5)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- the stand
s = []
b2, t2 = BASE_W / 2, TRAY_W / 2
s.append(box("base", -b2, b2, 0.0, BASE_H, -b2, b2, "side", bev=0.0015, uv_side=True))
s.append(box("seat", -b2 - 0.002, b2 + 0.002, BASE_H - 0.002, BASE_H, -b2 - 0.002, b2 + 0.002, "line"))
s.append(box("floor", -t2, t2, BASE_H, BASE_H + BOARD, -t2, t2, "hinoki", bev=0.0012))
for k, (a0, a1, c0, c1) in enumerate(((-t2, t2, -t2, -t2 + BOARD), (-t2, t2, t2 - BOARD, t2), (-t2, -t2 + BOARD, -t2 + BOARD, t2 - BOARD),
                                      (t2 - BOARD, t2, -t2 + BOARD, t2 - BOARD))):
    s.append(box(f"rim{k}", a0, a1, BASE_H + BOARD, BASE_H + BOARD + TRAY_RIM, c0, c1, "hinoki", bev=0.001))
bpy.ops.object.select_all(action="DESELECT")
for o in s:
    o.select_set(True)
bpy.context.view_layer.objects.active = s[0]
bpy.ops.object.join()
stand = active()
stand.name = "Sanbo"

# ---- the dumplings on their paper
d = []
paper = box("paper", -0.032, 0.032, 0.0, 0.0012, -0.032, 0.032, "paper")
paper.rotation_euler = (0, 0, math.pi / 4)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
d.append(paper)
R = 0.0125
for k, (dx, dy, dz) in enumerate([(-R, R * 0.9, -R), (R, R * 0.9, -R), (-R, R * 0.9, R), (R, R * 0.9, R), (0, R * 0.9 + R * 1.5, 0)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=R, location=P(dx, dy + 0.0012, dz))
    o = active()
    o.scale = (1, 1, 0.92)
    apply_scale(o)
    finish(o, f"dango{k}", M["mochi"])
    parts.append(o)
    d.append(o)
bpy.ops.object.select_all(action="DESELECT")
for o in d:
    o.select_set(True)
bpy.context.view_layer.objects.active = d[0]
bpy.ops.object.join()
dango = active()
dango.name = "Dango"
dango.location = P(0.16, 0, 0)

root = bpy.data.objects.new("SanboRoot", None)
bpy.context.collection.objects.link(root)
for o in (stand, dango):
    o.parent = root
print("SANBO_TRIS", {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (stand, dango)})
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.08, 0.04, 0)
    cam.location = P(0.08, 0.2, 0.32)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.4)
export_dish(root, [stand, dango, root], os.path.join(PROJECT, "public", "models", "sanbo.glb"), os.path.join(PROJECT, "blender", "sanbo.blend"), PREVIEW)
print("SANBO_DONE")
