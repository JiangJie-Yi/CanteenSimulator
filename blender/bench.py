"""The waiting bench in the genkan (bench.glb; the owner's, 2026-11-09: somewhere for those who come in with every stool taken to sit and wait
their turn). Remade (the owner's, 2026-11-11: it looked odd, its proportions off; it was drawn squashed, its thin legs splayed): a bench of
hinoki as a joiner makes one, drawn at one scale: one thick seat board, its edges eased; two board legs at its ends, set in, each cut away
at its foot to leave two feet; an apron under the seat's front and back edges between them; a low stretcher through both legs, its tenons
showing through their outer faces. About 300 triangles.

The game's frame: y up from the floor, x along the bench, z across it; its middle at the origin; SEAT_H the seat's top, LENGTH long, DEPTH
deep (the people's units: the game draws it at the people's scale, the same every way).

Run:
    blender -b --factory-startup --python blender/bench.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import active, export_dish, image, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

LENGTH, DEPTH, SEAT_H, SEAT_T = 0.86, 0.28, 0.29, 0.036


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
seat_rgb = (wood[..., None] * np.array(lin("#c99a66"))[None, None, :] * 1.1).astype(np.float32)
leg_rgb = (wood[..., None] * np.array(lin("#a8774a"))[None, None, :] * 1.1).astype(np.float32)
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


# (the seat: one board, its edges eased)
bench_seat = box("BenchSeat", -LENGTH / 2, LENGTH / 2, SEAT_H - SEAT_T, SEAT_H, -DEPTH / 2, DEPTH / 2, "seat", bev=0.008)
legs = []
UNDER = SEAT_H - SEAT_T + 0.002      # (the seat's underside, a hair into it)
LEG_X = LENGTH / 2 - 0.07            # (each leg's middle, set in from the seat's ends)
LEG_T, LEG_D = 0.032, DEPTH - 0.04   # (a leg board's thickness, and how deep it is across)
FOOT, ARCH = 0.06, 0.05              # (each foot's width, and how high the cut between them)


def leg(name, x):
    """a board leg standing across the bench at x: its outline (an upright board with the middle of its foot cut away, leaving two feet)
    pushed through its thickness"""
    hd = LEG_D / 2
    outline = [(-hd, 0), (-hd + FOOT, 0), (-hd + FOOT, ARCH), (hd - FOOT, ARCH), (hd - FOOT, 0), (hd, 0), (hd, UNDER), (-hd, UNDER)]
    bm_ = bmesh.new()
    lo = [bm_.verts.new(P(x - LEG_T / 2, y, z)) for z, y in outline]
    hi = [bm_.verts.new(P(x + LEG_T / 2, y, z)) for z, y in outline]
    bm_.faces.new(lo)
    bm_.faces.new(hi[::-1])
    for i in range(len(outline)):
        j = (i + 1) % len(outline)
        bm_.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new("b", "BEVEL")
    m.width = 0.004
    m.segments = 1
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.append(M["leg"])
    # (its grain up the board: u up it, v across it, in units)
    me = o.data
    uv = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.z * 1.5, (-co.y if abs(poly.normal.x) > 0.5 else co.x) * 1.5)
    parts.append(o)
    return o


for sx in (-1, 1):
    legs.append(leg(f"leg{sx}", sx * LEG_X))
# (the aprons under the seat's long edges, between the legs, set in from its edges)
for sz in (-1, 1):
    z = sz * (DEPTH / 2 - 0.03)
    legs.append(box(f"apron{sz}", -LEG_X + LEG_T / 2 - 0.002, LEG_X - LEG_T / 2 + 0.002, UNDER - 0.045, UNDER, z - 0.011, z + 0.011, "leg", bev=0.003))
# (the stretcher low through both legs, its tenons showing a little through their outer faces)
legs.append(box("stretcher", -LEG_X - LEG_T / 2 - 0.012, LEG_X + LEG_T / 2 + 0.012, ARCH + 0.03, ARCH + 0.062, -0.014, 0.014, "leg", bev=0.003))
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
    cam.location = P(0.6, 0.55, 0.8)
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
