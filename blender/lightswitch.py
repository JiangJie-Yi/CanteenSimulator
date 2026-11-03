"""The shop's light switch on the wall by the door: lightswitch.glb, a Japanese wide rocker switch (ワイドスイッチ) in ivory.

- "SwitchPlate": the cover plate, a soft-cornered rectangle with a fine bevel, standing a little proud of the wall, its frame a shade warmer
  than the face; the opening for the rocker.
- "SwitchRocker": the wide rocker filling the opening, gently convex, rocked about its middle (the game tilts it: one way on, the other
  off); its origin at that middle.
- "SwitchLamp": a slim window low on the rocker for the little guide light (ホタル), lit by the game while the lights are off, so the switch
  is found in the dark.

The game's frame: y up, the wall at z = 0, the face toward +z; 9 cm wide and 14 cm tall. With SWITCH=slim, the slim one (スリムスイッチ)
instead: lightswitch-slim.glb, 3.4 cm wide and 12 cm tall, its rocker narrow, for a door frame's post (the toilets' switches, between their
doors where the sliding doors don't cover them: the owner's).

Run:
    blender -b --factory-startup --python blender/lightswitch.py -- <project path>
    SWITCH=slim blender -b --factory-startup --python blender/lightswitch.py -- <project path>
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {"plate": pbr("SwitchPlate", lin("#efe8d8"), rough=0.45),
     "frame": pbr("SwitchFrame", lin("#e2d8c4"), rough=0.5),
     "rocker": pbr("SwitchRocker", lin("#f6f1e6"), rough=0.35),
     "lamp": pbr("SwitchLamp", lin("#6f8a62"), rough=0.4)}
SLIM = os.environ.get("SWITCH") == "slim"
# (SWITCH=double: one plate, two rockers side by side (the owner's: the toilets' two switches in one frame on the post between their doors))
DOUBLE = os.environ.get("SWITCH") == "double"
W, H, T = (0.034, 0.12, 0.008) if SLIM else (0.08, 0.12, 0.008) if DOUBLE else (0.09, 0.14, 0.008)


def slab(name, w, h, d, z0, r, mat, bow=0.0, bevel=True):
    """a soft-cornered slab, w by h, d thick, its back at z0 (the game's frame), its corners rounded r; its face bowed out by `bow`; its edges
    bevelled (not the guide light's window, a sliver too thin for one)"""
    bm = bmesh.new()
    # (each corner's quarter round in two steps, and the edges' bevel a single step: a small thing, held to the low-poly rule (it was 944
    # triangles with four and two); the ink line and the light round the edge read the same)
    seg = 2
    outline = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            outline.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    back = [bm.verts.new(P(x, y, z0)) for x, y in outline]
    front = [bm.verts.new(P(x, y, z0 + d + bow * (1 - (2 * y / h) ** 2))) for x, y in outline]
    n = len(outline)
    for i in range(n):
        bm.faces.new((back[i], back[(i + 1) % n], front[(i + 1) % n], front[i]))
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if bevel:
        m = o.modifiers.new("b", "BEVEL"); m.width = 0.0015; m.segments = 1
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier="b")
    for f in o.data.polygons:
        f.use_smooth = True
    return o


parts = []
# (the plate: its frame round the edge, the face set in a touch inside it)
frame = slab("SwitchPlate", W, H, T, 0.0, 0.008 if SLIM or DOUBLE else 0.01, M["frame"])
face = slab("SwitchPlateFace", W - (0.008 if SLIM or DOUBLE else 0.012), H - (0.008 if SLIM or DOUBLE else 0.012), T + 0.0008, 0.0, 0.004 if SLIM or DOUBLE else 0.006, M["plate"])
bpy.ops.object.select_all(action="DESELECT")
frame.select_set(True); face.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.object.join()
plate = bpy.context.view_layer.objects.active
plate.name = "SwitchPlate"
parts.append(plate)
# (the rocker: a wide paddle over most of the face, bowed out a little; its origin at its middle, where it rocks; the double's two side by side,
# SwitchRocker0 (left, -x) and SwitchRocker1, each with its own guide light)
rockers = []
for k, x in ([(0, -0.0185), (1, 0.0185)] if DOUBLE else [(None, 0.0)]):
    rw = 0.031 if DOUBLE else W - (0.014 if SLIM else 0.024)
    rh = H - (0.03 if SLIM or DOUBLE else 0.04)
    nm = "SwitchRocker" if k is None else f"SwitchRocker{k}"
    rocker = slab(nm, rw, rh, 0.006, 0.0, 0.003 if SLIM or DOUBLE else 0.004, M["rocker"], bow=0.0012)
    rocker.location = P(x, 0, T + 0.0008)
    parts.append(rocker)
    rockers.append(rocker)
    # (the guide light's slim window, low on the rocker)
    lamp = slab("SwitchLamp" if k is None else f"SwitchLamp{k}", 0.008 if SLIM or DOUBLE else 0.016, 0.004, 0.0004, 0.0, 0.0015, M["lamp"], bevel=False)
    lamp.location = P(0, -rh / 2 + 0.012, 0.006 + 0.0012 * 0.3)
    lamp.parent = rocker
    parts.append(lamp)
root = bpy.data.objects.new("LightSwitch", None)
bpy.context.collection.objects.link(root)
plate.parent = root
for r_ in rockers:
    r_.parent = root
NAME = "lightswitch-slim" if SLIM else "lightswitch-double" if DOUBLE else "lightswitch"
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", NAME + ".glb"), os.path.join(PROJECT, "blender", NAME + ".blend"), None)
print("SWITCH_DONE", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
