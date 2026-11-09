"""The kitchen's food-waste bin (foodwaste.glb, node "FoodWaste"; the owner's, 2026-11-10: the woven basket on the floor by the cook made a
food-waste bin, the basket put out on the bar for the customers): a round bin of olive-green plastic, a little wider at its top, a rolled rim,
two grips moulded into its sides, a few ribs round its lower part; its lid sat on it a little askew, domed, a bar of a handle across it; a white
label on its front (the game writes on it: "WasteLabel"). About 400 triangles. Its foot at y 0, its middle over the origin, its front to +z.

Run:
    blender -b --factory-startup --python blender/foodwaste.py -- <project path> [preview.png]
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
seed(5)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)

R0, R1, H = 0.128, 0.152, 0.3     # (its foot's radius, its top's, its height: as the basket it stands for (Roasting's TRASH_R, TRASH_H))
SEG = 20


def plastic(hexs, N=256):
    """moulded plastic: its colour a little mottled, faint streaks down it from the mould"""
    u, v = grid01(N)
    base = lin(hexs)
    n = (np.sin(u * 40 + np.sin(v * 9) * 2) * 0.5 + 0.5) * 0.04 + np.random.default_rng(2).normal(0, 0.012, (N, N))
    return (np.broadcast_to(base, (N, N, 3)) * (0.96 + n)[..., None]).astype(np.float32)


M = {
    "body": pbr("WasteBody", (1, 1, 1), tex=image("waste_body", plastic("#5f7d3c")), rough=0.55),
    "lid": pbr("WasteLid", (1, 1, 1), tex=image("waste_lid", plastic("#47612c")), rough=0.5),
    "label": pbr("WasteLabel", (1, 1, 1), rough=0.8),
}
parts = []


def mesh(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = smooth_
    parts.append(o)
    return o


def lathe(prof, segs=SEG):
    """turned round y: (radius, height) pairs; a point on the axis isn't made, the ring beside it closed in a ladder"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) for j in range(segs)]
             if r > 1e-6 else None for (r, y) in prof]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if a is None or b is None:
            for f in ladder_fill(bm, a or b):
                for lp in f.loops:
                    lp[uvl].uv = (lp.vert.co.x * 2 + 0.5, lp.vert.co.y * 2 + 0.5)
            continue
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((a[j], b[j], b[j2], a[j2]))
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl].uv = ((math.atan2(-co.y, co.x) / (2 * math.pi)) % 1.0, co.z / H)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ---- the bin: its foot, a few ribs low round it, flaring to a rolled rim ----
prof = [(0.0, 0.0), (R0 - 0.006, 0.0), (R0, 0.008), (R0 + 0.004, 0.04), (R0 + 0.006, 0.046), (R0 + 0.006, 0.06), (R0 + 0.01, 0.066),
        (R1 - 0.004, H - 0.02), (R1 + 0.006, H - 0.012), (R1 + 0.006, H - 0.002), (R1 - 0.006, H)]
mesh("FoodWasteBody", lathe(prof), "body")
# ---- its two grips, moulded into its sides: a bar across a hollow, each side ----
for sd in (-1, 1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * 0.016, v.co.y * 0.075, v.co.z * 0.022))
    bmesh.ops.translate(bm, verts=bm.verts, vec=P(sd * (R1 + 0.006), H - 0.05, 0))
    mesh(f"FoodWasteGrip{'R' if sd > 0 else 'L'}", bm, "body", smooth_=False)
# ---- its lid: domed, its lip over the rim, a bar of a handle across it; sat a little askew ----
lid_prof = [(R1 + 0.012, -0.012), (R1 + 0.014, 0.004), (R1 - 0.01, 0.014), (R1 * 0.6, 0.026), (0.0, 0.03)]
lid = mesh("FoodWasteLid", lathe(lid_prof), "lid")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
for v in bm.verts:
    v.co = Vector((v.co.x * 0.12, v.co.y * 0.022, v.co.z * 0.022))
bmesh.ops.translate(bm, verts=bm.verts, vec=P(0, 0.04, 0))
handle = mesh("FoodWasteLidHandle", bm, "lid", smooth_=False)
handle.parent = lid
lid.location = P(0.006, H + 0.002, -0.004)
lid.rotation_euler = (math.radians(1.5), math.radians(-2.0), math.radians(20))
# ---- the label on its front: a curved strip of four quads just off the body (the game draws its words) ----
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
cols = 5
ys = (0.12, 0.22)
ring = []
for j in range(cols):
    a = math.pi / 2 + (j / (cols - 1) - 0.5) * 0.85
    # (off the body by 3 mm at each of its heights: the body flares, so where it is at the label's middle is in it at its top)
    rad = lambda y: (R0 + 0.006 + (R1 - R0 - 0.01) * ((y - 0.066) / (H - 0.086)) + 0.004) / math.cos(math.pi / SEG)
    ring.append([bm.verts.new(P(rad(y) * math.cos(a), y, rad(y) * math.sin(a))) for y in ys])
for j in range(cols - 1):
    f = bm.faces.new((ring[j][0], ring[j + 1][0], ring[j + 1][1], ring[j][1]))
    for lp in f.loops:
        k = next(i for i in range(cols) for t in range(2) if ring[i][t] is lp.vert)
        t = 0 if ring[k][0] is lp.vert else 1
        lp[uvl].uv = (1 - k / (cols - 1), t)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh("FoodWasteLabel", bm, "label", smooth_=False)

root = bpy.data.objects.new("FoodWaste", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
print("FOODWASTE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.16, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.45, 0.55, 0.7)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "foodwaste.glb"), os.path.join(PROJECT, "blender", "foodwaste.blend"), PREVIEW)
print("FOODWASTE_DONE")
