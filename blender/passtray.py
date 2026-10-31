"""The pass's tray (出餐口の盆): passtray.glb, node "PassTray". A long tray of lacquer the cooks put what's ready on for the servers: its
corners rounded, its low wall flaring out a little to a rounded lip with a fine gold line along it, black lacquer outside, vermilion (朱)
inside, standing on two low runners.

The game's frame, in the grill scene's units (the tray as drawn there): y up, 0.84 along it (z) and 0.44 across (x), 0.045 high; the middle
of its foot at the origin.

Run:
    blender -b --factory-startup --python blender/passtray.py -- <project path> [preview.png]
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
PREVIEW = argv[1] if len(argv) > 1 else None
L, W, H = 0.84, 0.44, 0.045
CR, WALL, FLARE, FOOT = 0.05, 0.012, 0.008, 0.008


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def outline(inset, n=6):
    """the rounded rectangle's outline (x across, z along), `inset` in from the tray's edge, its corners each n steps round"""
    hx, hz, r = W / 2 - inset, L / 2 - inset, max(0.005, CR - inset)
    pts = []
    for cx, cz, a0 in ((hx - r, hz - r, 0.0), (-(hx - r), hz - r, 0.5 * math.pi), (-(hx - r), -(hz - r), math.pi), (hx - r, -(hz - r), 1.5 * math.pi)):
        for k in range(n + 1):
            a = a0 + 0.5 * math.pi * k / n
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {"black": pbr("TrayBlack", lin("#16100c"), rough=0.25, coat=0.6),
     "red": pbr("TrayRed", lin("#9a2a1c"), rough=0.3, coat=0.5),
     "gold": pbr("TrayGold", lin("#d2a64e"), rough=0.3, metal=1.0)}
bm = bmesh.new()
mats = {"black": 0, "red": 1, "gold": 2}
# (the rings of the section, each an outline: the foot's edge, out and up the outside, over the lip, down the inside to the floor)
rings_spec = [  # (inset from the edge, height, material of the band from this ring to the next)
    (FLARE + 0.004, 0.0, "black"),
    (FLARE, 0.004, "black"),
    (0.0, H - 0.004, "black"),
    (0.0015, H, "gold"),
    (WALL - 0.0015, H, "red"),
    (WALL, H - 0.004, "red"),
    (WALL + FLARE * 0.6, 0.011, "red"),
]
rings = []
for inset, y, _ in rings_spec:
    rings.append([bm.verts.new(P(x, y, z)) for (x, z) in outline(inset)])
n = len(rings[0])
for r in range(len(rings) - 1):
    for k in range(n):
        k2 = (k + 1) % n
        f = bm.faces.new((rings[r][k], rings[r][k2], rings[r + 1][k2], rings[r + 1][k]))
        f.material_index = mats[rings_spec[r][2]]
# (the floor inside, vermilion, and the underside, black: each a fan to its middle)
for ring, y, mat, up in ((rings[-1], 0.011, "red", True), (rings[0], 0.0, "black", False)):
    c = bm.verts.new(P(0, y, 0))
    for k in range(n):
        k2 = (k + 1) % n
        f = bm.faces.new((ring[k], ring[k2], c) if up else (ring[k2], ring[k], c))
        f.material_index = mats[mat]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("PassTrayBody")
bm.to_mesh(me)
bm.free()
body = bpy.data.objects.new("PassTrayBody", me)
bpy.context.collection.objects.link(body)
for m in ("black", "red", "gold"):
    body.data.materials.append(M[m])
# (the walls round smooth, the floor and the underside flat: smoothed into the walls they streaked)
for p in body.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.9
parts = [body]
# (the two runners under it, along its length)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(sx * (W / 2 - 0.07), -FOOT / 2, 0))
    o = bpy.context.view_layer.objects.active
    o.scale = (0.03, L - 0.12, FOOT)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = f"PassTrayRunner{0 if sx < 0 else 1}"
    o.data.materials.append(M["black"])
    parts.append(o)
# (the whole lifted onto its runners)
for o in parts:
    o.location.z += FOOT
root = bpy.data.objects.new("PassTray", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("PASSTRAY_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.02, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.7, 0.6, 0.8)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 0.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "passtray.glb"), os.path.join(PROJECT, "blender", "passtray.blend"), PREVIEW)
print("PASSTRAY_DONE")
