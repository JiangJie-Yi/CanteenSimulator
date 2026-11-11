"""The kitchen's electric rice cooker (電鍋, the owner's: the rice for the rice balls is cooked in it), denkinabe.glb, in the game's units (the
rice tub's): a classic Taiwanese cooker, its round body a soft pastel green rounded at the shoulder and foot, a stainless rim and domed
stainless lid with a black knob (node "DenkiLid": the game lifts it a little as the rice boils), two black side handles, and at the front
the switch: a black lever (node "DenkiLever": down while it cooks, popped up when it's done) and its little lamp (material "DenkiLamp": the
game lights it red cooking, amber keeping warm). Its foot at y 0, its middle over the origin; its front toward +z.

Low-poly: 24 round, lathed profiles, no fans into the middle (the ends closed in ladders).

Run:
    blender -b --factory-startup --python blender/denkinabe.py -- <project path> [preview.png]
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
seed(41)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)

R, H = 0.2, 0.25        # (the body's radius, its height to the rim)
SEG = 24

M = {
    "body": pbr("DenkiBody", lin("#9fd2b4"), rough=0.35),
    "steel": pbr("DenkiSteel", lin("#c9ccd0"), rough=0.25, metal=0.9),
    "black": pbr("DenkiBlack", lin("#1e1c1b"), rough=0.5),
    "lamp": pbr("DenkiLamp", lin("#3a1a14"), rough=0.4),
    "badge": pbr("DenkiBadge", lin("#f4f1e6"), rough=0.5),
    "pot": pbr("DenkiPot", lin("#b9bcc0"), rough=0.3, metal=0.85),
    "rice": pbr("DenkiRice", lin("#f4f1e8"), rough=0.85),
}
parts = []


def lathe(name, prof, mat, segs=SEG, smooth_=True):
    """turned round y: the profile's (radius, height) pairs, a point on the axis closed as a ladder (no fan)"""
    bm = bmesh.new()
    rings = [[bm.verts.new(P(r * math.sin(2 * math.pi * j / segs), y, r * math.cos(2 * math.pi * j / segs))) for j in range(segs)]
             if r > 1e-6 else None for (r, y) in prof]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if a is None or b is None:
            ladder_fill(bm, a or b)
            continue
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((a[j], b[j], b[j2], a[j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth_
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def box(name, size, at, mat, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = P(v.co.x * size[0] + at[0], v.co.z * size[1] + at[1], v.co.y * size[2] + at[2])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    if parent:
        o.parent = parent
    parts.append(o)
    return o


# ---- the body: a black foot ring, the green body rounded at its foot and shoulder, a stainless rim at the top ----
lathe("DenkiFoot", [(R * 0.8, 0.0), (R * 0.92, 0.0), (R * 0.95, 0.018)], "black")
lathe("DenkiBody", [(R * 0.93, 0.016), (R * 0.99, 0.04), (R, 0.08), (R, H - 0.05), (R * 0.97, H - 0.015), (R * 0.9, H)], "body")
lathe("DenkiRim", [(R * 0.9, H - 0.002), (R * 0.93, H + 0.006), (R * 0.88, H + 0.014), (R * 0.84, H + 0.008)], "steel")
# ---- inside (the owner's, 2026-11-11: the cooker opened by a click, its rice seen): the inner pot, stainless, its faces turned to be seen from
# within; the rice in it, a soft dome, its own node ("DenkiRice": the game sets it as high as the rice left, at y 0 it's on the pot's floor) ----
pot = lathe("DenkiPot", [(R * 0.85, H + 0.008), (R * 0.83, H - 0.012), (R * 0.81, 0.05), (R * 0.72, 0.036), (0.0, 0.036)], "pot")
bm_ = bmesh.new()
bm_.from_mesh(pot.data)
bmesh.ops.reverse_faces(bm_, faces=bm_.faces)
bm_.to_mesh(pot.data)
bm_.free()
rice = lathe("DenkiRice", [(R * 0.8, 0.0), (R * 0.62, 0.012), (R * 0.3, 0.019), (0.0, 0.021)], "rice")
rice.location = P(0, 0.038, 0)
# ---- the lid: a stainless dome on the rim, a black knob on top; its own node ----
lid = lathe("DenkiLid", [(R * 0.86, 0.0), (R * 0.84, 0.02), (R * 0.65, 0.055), (R * 0.32, 0.072), (0.0, 0.076)], "steel")
knob = lathe("DenkiKnob", [(0.0, 0.07), (0.025, 0.07), (0.028, 0.085), (0.02, 0.1), (0.0, 0.102)], "black", segs=12)
knob.parent = lid
lid.location = P(0, H + 0.008, 0)
# ---- the two side handles: black bars standing out from the body's sides ----
for sd in (-1, 1):
    box(f"DenkiHandle{sd}", (0.03, 0.022, 0.09), (sd * (R + 0.012), H - 0.06, 0.0), "black")
# ---- the switch at the front: a black box on the body, its lever (its own node) and the lamp beside it; a cream badge above ----
box("DenkiSwitchBox", (0.07, 0.06, 0.03), (0.0, 0.075, R + 0.006), "black")
lever = box("DenkiLever", (0.026, 0.012, 0.03), (0.0, 0.0, 0.0), "black")
lever.location = P(0.0, 0.085, R + 0.03)
box("DenkiLampLens", (0.014, 0.014, 0.008), (0.026, 0.09, R + 0.022), "lamp")
box("DenkiBadge", (0.08, 0.026, 0.006), (0.0, 0.16, R + 0.003), "badge")

root = bpy.data.objects.new("DenkiNabe", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
print("DENKI_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.15, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.45, 0.55, 0.75)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "denkinabe.glb"), os.path.join(PROJECT, "blender", "denkinabe.blend"), PREVIEW)
print("DENKI_DONE")
