"""The waiting bench in the genkan (bench.glb; the owner's, 2026-11-09: somewhere for those who come in with every stool taken to sit and wait
their turn): a long low bench of cedar, two planks for its seat with a gap between, six legs (a pair at each end splayed a little, a pair in the
middle), a stretcher across each pair and one along, the ends of the planks rounded off; long enough for four (the owner's, 2026-11-11). About
250 triangles.

The game's frame: y up from the floor, x along the bench, z across it; its middle at the origin; SEAT_H the seat's top (a stool's, so those
sat on it sit as at the bar), LENGTH long, DEPTH deep.

Run:
    blender -b --factory-startup --python blender/bench.py -- <project path> [preview.png]
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

LENGTH, DEPTH, SEAT_H, PLANK_T = 1.8, 0.34, 0.29, 0.035


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


rng = np.random.default_rng(3)
W, Hh = 512, 64
v = np.linspace(0, 1, Hh)[:, None]
u = np.linspace(0, 1, W)[None, :]
grain = 0.5 + 0.5 * np.sin((v * 22 + np.sin(u * 7 + v * 2) * 0.9) * math.pi * 2)
wood = np.clip(0.8 + 0.16 * grain - 0.2 * rng.random((Hh, 1)) + rng.normal(0, 0.025, (Hh, W)), 0, 1)
seat_rgb = (wood[..., None] * np.array(lin("#9a6a3e"))[None, None, :] * 1.1).astype(np.float32)
leg_rgb = (wood[..., None] * np.array(lin("#5e3c22"))[None, None, :] * 1.1).astype(np.float32)
M = {
    "seat": pbr("BenchSeat", (1, 1, 1), tex=image("bench_seat", seat_rgb), rough=0.6),
    "leg": pbr("BenchLeg", (1, 1, 1), tex=image("bench_leg", leg_rgb), rough=0.7),
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


seat = []
gap = 0.012
pw = (DEPTH - gap) / 2
for k, z in enumerate((-DEPTH / 2, gap / 2)):
    seat.append(box(f"plank{k}", -LENGTH / 2, LENGTH / 2, SEAT_H - PLANK_T, SEAT_H, z, z + pw, "seat", bev=0.008))
bench_seat = join(seat, "BenchSeat")
legs = []
lx, lz, splay = LENGTH / 2 - 0.1, DEPTH / 2 - 0.06, 0.03
for sx in (-1, 0, 1):
    for sz in (-1, 1):
        o = box(f"leg{sx}{sz}", -0.022, 0.022, 0, SEAT_H - PLANK_T, -0.022, 0.022, "leg")
        # (splayed out a little at the foot)
        for vtx in o.data.vertices:
            if vtx.co.z < 0.01:
                vtx.co.x += sx * splay
                vtx.co.y -= sz * splay
        o.location = P(sx * lx, 0, sz * lz)
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        legs.append(o)
    # (a stretcher across each end)
    legs.append(box(f"cross{sx}", sx * lx - 0.016, sx * lx + 0.016, 0.07, 0.1, -lz, lz, "leg"))
# (and one along the middle, low)
legs.append(box("along", -lx, lx, 0.07, 0.1, -0.016, 0.016, "leg"))
# (a rail under the seat's long edges)
for sz in (-1, 1):
    legs.append(box(f"apron{sz}", -lx - 0.02, lx + 0.02, SEAT_H - PLANK_T - 0.05, SEAT_H - PLANK_T, sz * lz - 0.012, sz * lz + 0.012, "leg"))
bench_legs = join(legs, "BenchLegs")

root = bpy.data.objects.new("Bench", None)
bpy.context.collection.objects.link(root)
for o in (bench_seat, bench_legs):
    o.parent = root
print("BENCH_TRIS", sum(len(p.vertices) - 2 for o in (bench_seat, bench_legs) for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.15, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 0.7, 1.1)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "bench.glb"), os.path.join(PROJECT, "blender", "bench.blend"), PREVIEW)
print("BENCH_DONE")
