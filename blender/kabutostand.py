"""The little wooden stand by the staff's door that the samurai helmet sits on (kabutostand.glb; the owner's, 2026-11-12: "a small wooden
stand beside the staff-only door, and the helmet on it"): a joiner's plant stand of the bench's hinoki, its top a board with its edges eased,
four square legs, a shelf low between them a little in from their outer faces. About 56 faces (top 26, legs 6 each, shelf 6).

The game's frame: y up from the floor, x along the wall, z out from it; its foot's middle at the origin; in the wall's own units (DiningRoom's
wall frame: the wainscot 0.85 high), drawn as it is.

Run:
    blender -b --factory-startup --python blender/kabutostand.py -- <project path> [preview.png]
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

# (its top 0.70 up, the helmet on it reaching to about the wainscot's rail; 0.30 along the wall, 0.28 out from it)
H, W, D, TOP_T = 0.70, 0.30, 0.28, 0.032
LEG, SHELF_Y, SHELF_T = 0.036, 0.13, 0.02


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# (the bench's grain and its two tones: the top the paler, the legs and the shelf the darker)
rng = np.random.default_rng(5)
GW, GH = 512, 64
v = np.linspace(0, 1, GH)[:, None]
u = np.linspace(0, 1, GW)[None, :]
grain = 0.5 + 0.5 * np.sin((v * 22 + np.sin(u * 7 + v * 2) * 0.9) * math.pi * 2)
wood = np.clip(0.8 + 0.16 * grain - 0.2 * rng.random((GH, 1)) + rng.normal(0, 0.025, (GH, GW)), 0, 1)
top_rgb = (wood[..., None] * np.array(lin("#b98754"))[None, None, :] * 1.1).astype(np.float32)
leg_rgb = (wood[..., None] * np.array(lin("#8f5f37"))[None, None, :] * 1.1).astype(np.float32)
M = {
    "top": pbr("StandTop", (1, 1, 1), tex=image("kabutostand_top", top_rgb), rough=0.6),
    "leg": pbr("StandLeg", (1, 1, 1), tex=image("kabutostand_leg", leg_rgb), rough=0.7),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev:
        m = o.modifiers.new("b", "BEVEL")
        m.width = bev
        m.segments = 1
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.name = name
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


# (the top: one board, its edges eased, overhanging the legs a little all round)
top = box("StandTop", -W / 2, W / 2, H - TOP_T, H, -D / 2, D / 2, "top", bev=0.006)
legs = []
LX, LZ = W / 2 - 0.03, D / 2 - 0.03         # (each leg's middle, set in from the top's edges)
for sx in (-1, 1):
    for sz in (-1, 1):
        # (up a hair into the top's underside: no two faces in one plane)
        legs.append(box(f"leg{sx}{sz}", sx * LX - LEG / 2, sx * LX + LEG / 2, 0, H - TOP_T + 0.003, sz * LZ - LEG / 2, sz * LZ + LEG / 2, "leg"))
# (the shelf low between the legs, through them, its edges short of their outer faces)
legs.append(box("shelf", -LX - LEG / 2 + 0.006, LX + LEG / 2 - 0.006, SHELF_Y, SHELF_Y + SHELF_T, -LZ - LEG / 2 + 0.006, LZ + LEG / 2 - 0.006, "leg"))
frame = join(legs, "StandLegs")

root = bpy.data.objects.new("KabutoStand", None)
bpy.context.collection.objects.link(root)
for o in (top, frame):
    o.parent = root
print("STAND_FACES", sum(len(o.data.polygons) for o in (top, frame)), "TRIS", sum(len(p.vertices) - 2 for o in (top, frame) for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.35, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 0.9, 1.2)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kabutostand.glb"), os.path.join(PROJECT, "blender", "kabutostand.blend"), PREVIEW)
print("STAND_DONE")
