"""The shop's two upright drink fridges (drinkfridge.glb), made here in place of the downloaded one (the owner's: it was the heaviest thing in
the room, its parts and its outlines some 8,500 triangles and nine draws a fridge, and someone else's model): a commercial one-door cooler in
plain boxes and planes, about 400 triangles.

- "FridgeBody": the black cabinet (sides, back, top, plinth with its louvre slats), its white liner inside, the stainless strip under the door,
  the dark gasket round the opening (FridgeShell, FridgeLiner, FridgeLouver, FridgeMetal, FridgeGasket).
- "FridgeSign": the light box over the door, one quad (its picture, the washi sign, painted by the game: FridgeSign).
- "FridgeShelves": the four wire shelves, each a quad whose picture is the wire grid (its gaps see-through: FridgeWire) and a white front
  lip (FridgeLiner).
- "FridgeDoor": the glass door: its black frame, the pane (FridgeGlass, see-through) and the long silver handle on its right; the game swings
  it on its left edge.

The game's frame, in the room's units: y up, the door's face toward +z, the middle of its foot at the origin; as big as bar.ts's FRIDGE
(0.86 across, 2.17 up, 0.75 deep), the shelves where FRIDGE_UNITS puts the drinks (0.27, 0.72, 1.19, 1.63 up).

Run:
    blender -b --factory-startup --python blender/drinkfridge.py -- <project path> [preview.png]
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

W, H, D = 0.86, 2.17, 0.75
T = 0.035                     # the walls' thickness
PLINTH = 0.14                 # the louvred foot
HEAD = 0.27                   # the header over the door, the sign in it
SHELVES = (0.27, 0.72, 1.19, 1.63)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# (the wire grid: a frame round its edge, wires running front to back every 2.4 cm, two cross wires; the rest see-through)
S = 256
u = (np.arange(S) + 0.5) / S
U, V = np.meshgrid(u, u)
wires = (np.abs(((U * 30) % 1) - 0.5) > 0.38) | (np.minimum(U, 1 - U) < 0.02) | (np.minimum(V, 1 - V) < 0.03) | (np.abs(V - 0.5) < 0.012)
wire_rgb = np.ones((S, S, 3), np.float32) * 0.92
M = {
    "shell": pbr("FridgeShell", lin("#1d1e21"), rough=0.5),
    "liner": pbr("FridgeLiner", lin("#eef0ef"), rough=0.6),
    "louver": pbr("FridgeLouver", lin("#2b2d31"), rough=0.6),
    "metal": pbr("FridgeMetal", lin("#c6c9cd"), rough=0.3, metal=0.8),
    "gasket": pbr("FridgeGasket", lin("#101113"), rough=0.8),
    "sign": pbr("FridgeSign", (1, 1, 1), rough=0.6),
    "wire": pbr("FridgeWire", (1, 1, 1), tex=image("fridge_wire", wire_rgb, alpha=wires.astype(np.float32)), rough=0.4, blend=False),
    "glass": pbr("FridgeGlass", lin("#cfe2ea"), rough=0.05, blend=True),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat):
    """a box between those bounds, in the game's frame"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def quad(name, corners, mat, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
    """one four-cornered face, corners in the game's frame, counter-clockwise seen from its front"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([P(*c) for c in corners], [], [(0, 1, 2, 3)])
    me.uv_layers.new()
    for lp, (a, b) in zip(me.uv_layers.active.data, uv):
        lp.uv = (a, b)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    for o_ in objs[1:]:
        if o_ in parts:
            parts.remove(o_)
    return o


# ---- the cabinet
x0, x1 = -W / 2, W / 2
zb, zf = -D / 2, D / 2
open_y0, open_y1 = PLINTH, H - HEAD
body = [
    box("side-l", x0, x0 + T, 0, H, zb, zf, "shell"),
    box("side-r", x1 - T, x1, 0, H, zb, zf, "shell"),
    box("back", x0 + T, x1 - T, 0, H, zb, zb + T, "shell"),
    box("top", x0 + T, x1 - T, H - T, H, zb + T, zf, "shell"),
    box("head", x0 + T, x1 - T, open_y1, H - T, zf - 0.06, zf, "shell"),
    box("plinth", x0 + T, x1 - T, 0.0, PLINTH, zf - 0.08, zf - 0.02, "louver"),
    box("floor", x0 + T, x1 - T, PLINTH - 0.02, PLINTH, zb + T, zf - 0.02, "liner"),
    box("strip", x0 + T, x1 - T, PLINTH - 0.025, PLINTH, zf - 0.02, zf, "metal"),
]
# (the louvre: slats across the foot, a little proud of it)
for k in range(4):
    y = 0.025 + k * 0.028
    body.append(box(f"slat{k}", x0 + T + 0.03, x1 - T - 0.03, y, y + 0.01, zf - 0.02, zf - 0.008, "gasket"))
# (the liner: the back and sides inside, white; the ceiling under the header)
ix0, ix1, iz0, iz1 = x0 + T, x1 - T, zb + T, zf - 0.06
body.append(quad("liner-back", [(ix0, open_y0, iz0 + 0.001), (ix1, open_y0, iz0 + 0.001), (ix1, open_y1, iz0 + 0.001), (ix0, open_y1, iz0 + 0.001)], "liner"))
body.append(quad("liner-l", [(ix0 + 0.001, open_y0, iz1), (ix0 + 0.001, open_y0, iz0), (ix0 + 0.001, open_y1, iz0), (ix0 + 0.001, open_y1, iz1)], "liner"))
body.append(quad("liner-r", [(ix1 - 0.001, open_y0, iz0), (ix1 - 0.001, open_y0, iz1), (ix1 - 0.001, open_y1, iz1), (ix1 - 0.001, open_y1, iz0)], "liner"))
body.append(quad("liner-top", [(ix0, open_y1 - 0.001, iz1), (ix1, open_y1 - 0.001, iz1), (ix1, open_y1 - 0.001, iz0), (ix0, open_y1 - 0.001, iz0)], "liner"))
# (the gasket: a dark frame round the opening, just inside the door)
g = 0.012
body += [box("gasket-t", ix0, ix1, open_y1 - g, open_y1, zf - 0.03, zf - 0.02, "gasket"),
         box("gasket-l", ix0, ix0 + g, open_y0, open_y1, zf - 0.03, zf - 0.02, "gasket"),
         box("gasket-r", ix1 - g, ix1, open_y0, open_y1, zf - 0.03, zf - 0.02, "gasket")]
fridge_body = join(body, "FridgeBody")

# ---- the sign in the header: a quad just proud of its face, the washi light box's picture on it
sy0, sy1, sx = open_y1 + 0.035, H - 0.045, W / 2 - 0.07
sign = quad("FridgeSign", [(-sx, sy0, zf + 0.002), (sx, sy0, zf + 0.002), (sx, sy1, zf + 0.002), (-sx, sy1, zf + 0.002)], "sign")

# ---- the shelves: a wire grid on each, a white lip along its front
shelves = []
for k, y in enumerate(SHELVES):
    sy = y - 0.004
    shelves.append(quad(f"shelf{k}", [(ix0 + 0.01, sy, iz1 - 0.01), (ix1 - 0.01, sy, iz1 - 0.01), (ix1 - 0.01, sy, iz0 + 0.02), (ix0 + 0.01, sy, iz0 + 0.02)], "wire"))
    shelves.append(box(f"lip{k}", ix0 + 0.01, ix1 - 0.01, sy - 0.025, sy + 0.012, iz1 - 0.022, iz1 - 0.01, "liner"))
fridge_shelves = join(shelves, "FridgeShelves")

# ---- the door: its frame, the pane, the handle on its right
dz0, dz1 = zf - 0.005, zf + 0.025
fx0, fx1, fy0, fy1 = x0 + 0.008, x1 - 0.008, open_y0 - 0.01, open_y1 + 0.006
fw = 0.045
door = [
    box("dframe-t", fx0, fx1, fy1 - fw, fy1, dz0, dz1, "shell"),
    box("dframe-b", fx0, fx1, fy0, fy0 + fw * 1.4, dz0, dz1, "shell"),
    box("dframe-l", fx0, fx0 + fw, fy0, fy1, dz0, dz1, "shell"),
    box("dframe-r", fx1 - fw, fx1, fy0, fy1, dz0, dz1, "shell"),
    quad("pane", [(fx0 + fw, fy0 + fw * 1.4, (dz0 + dz1) / 2), (fx1 - fw, fy0 + fw * 1.4, (dz0 + dz1) / 2),
                  (fx1 - fw, fy1 - fw, (dz0 + dz1) / 2), (fx0 + fw, fy1 - fw, (dz0 + dz1) / 2)], "glass"),
    # (the long handle: a bar on two posts, out from the frame on its right)
    box("handle", fx1 - fw * 0.7, fx1 - fw * 0.3, 0.75, 1.55, dz1 + 0.03, dz1 + 0.048, "metal"),
    box("post-t", fx1 - fw * 0.65, fx1 - fw * 0.35, 1.5, 1.53, dz1, dz1 + 0.032, "metal"),
    box("post-b", fx1 - fw * 0.65, fx1 - fw * 0.35, 0.77, 0.8, dz1, dz1 + 0.032, "metal"),
]
fridge_door = join(door, "FridgeDoor")

root = bpy.data.objects.new("DrinkFridge", None)
bpy.context.collection.objects.link(root)
for o in (fridge_body, sign, fridge_shelves, fridge_door):
    o.parent = root
print("FRIDGE_TRIS", sum(len(p.vertices) - 2 for o in (fridge_body, sign, fridge_shelves, fridge_door) for p in o.data.polygons))
if PREVIEW:
    target = P(0, 1.1, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.3, 1.6, 2.6)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "drinkfridge.glb"), os.path.join(PROJECT, "blender", "drinkfridge.blend"), PREVIEW)
print("FRIDGE_DONE")
