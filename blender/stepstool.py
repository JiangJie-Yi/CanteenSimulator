"""The step stool before the sink (踏み台, stepstool.glb; item 221, the owner's, 2026-11-16: 「在流理台前面加一張小矮凳，供給使用者洗碗盤用」):
the sink's counter is 0.86 high and the shop's people are drawn small (about 1.2 of the sink's metres), so it came to their chest; a low
wooden platform before the basin to stand on and wash at a comfortable height, as a small kitchen keeps one. Made as the waiting bench is
(bench.py), of the same brown wood: one thick top board, its edges eased; two board legs at its ends, each cut away at its foot to leave
two feet; an apron under the top's front edge. Low-poly (docs/MODELING.md): about 70 faces.

The game's frame: y up from the floor, x across it, z its depth (+z its front, away from the sink); its middle at the origin. Drawn in the
sink's own frame (its metres), before the basin, so it grows and moves with the sink. An empty, StepStoolTop, at its top's middle: the game
finds it there to stand those washing on it.

Run:
    blender -b --factory-startup --python blender/stepstool.py -- <project path> [preview.png]
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

# (as wide as the basin, as deep as a step, as high as brings the counter to a small person's waist)
WIDTH, DEPTH, TOP_H, TOP_T = 0.66, 0.40, 0.22, 0.032


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


rng = np.random.default_rng(5)
W, Hh = 512, 64
v = np.linspace(0, 1, Hh)[:, None]
u = np.linspace(0, 1, W)[None, :]
grain = 0.5 + 0.5 * np.sin((v * 22 + np.sin(u * 7 + v * 2) * 0.9) * math.pi * 2)
wood = np.clip(0.8 + 0.16 * grain - 0.2 * rng.random((Hh, 1)) + rng.normal(0, 0.025, (Hh, W)), 0, 1)
# (the waiting bench's brown wood (item 214); its top a little worn lighter in the middle, where it's stood on)
worn = 1 + 0.08 * np.exp(-((u - 0.5) ** 2) / 0.03)
top_rgb = np.clip(wood[..., None] * worn[..., None] * np.array(lin("#9c7552"))[None, None, :] * 1.1, 0, 1).astype(np.float32)
leg_rgb = (wood[..., None] * np.array(lin("#79583d"))[None, None, :] * 1.1).astype(np.float32)
M = {
    "top": pbr("StepStoolTopWood", (1, 1, 1), tex=image("stepstool_top", top_rgb), rough=0.6),
    "leg": pbr("StepStoolLegWood", (1, 1, 1), tex=image("stepstool_leg", leg_rgb), rough=0.7),
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
    # (its grain along x: u along it, v across, in units)
    me = o.data
    uv = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x * 1.4 + 0.5, (co.y if abs(poly.normal.z) > 0.5 else co.z) * 1.4 + 0.5)
    parts.append(o)
    return o


# (the top: one board, its edges eased)
top = box("StepStoolTopBoard", -WIDTH / 2, WIDTH / 2, TOP_H - TOP_T, TOP_H, -DEPTH / 2, DEPTH / 2, "top", bev=0.008)
UNDER = TOP_H - TOP_T + 0.002        # (the top's underside, a hair into it)
LEG_X = WIDTH / 2 - 0.05             # (each leg's middle, set in from the top's ends)
LEG_T, LEG_D = 0.03, DEPTH - 0.05    # (a leg board's thickness, and how deep it is)
FOOT, ARCH = 0.07, 0.07              # (each foot's width, and how high the cut between them)


def leg(name, x):
    """a board leg standing across the stool at x: an upright board with the middle of its foot cut away, leaving two feet, pushed through
    its thickness; each face a quad or its two halves either side of the cut (no fan)"""
    hd = LEG_D / 2
    # (the board as three quads either side and over the cut: the left foot, the right foot, the bridge over the cut)
    pts = {
        "a": (-hd, 0), "b": (-hd + FOOT, 0), "c": (-hd + FOOT, ARCH), "d": (hd - FOOT, ARCH), "e": (hd - FOOT, 0), "f": (hd, 0),
        "g": (hd, ARCH), "h": (hd, UNDER), "i": (-hd, UNDER), "j": (-hd, ARCH),
    }
    quads = [("a", "b", "c", "j"), ("e", "f", "g", "d"), ("j", "c", "d", "g"), ("j", "g", "h", "i")]
    bm_ = bmesh.new()
    lo = {k: bm_.verts.new(P(x - LEG_T / 2, y, z)) for k, (z, y) in pts.items()}
    hi = {k: bm_.verts.new(P(x + LEG_T / 2, y, z)) for k, (z, y) in pts.items()}
    for q in quads:
        bm_.faces.new([lo[k] for k in q])
        bm_.faces.new([hi[k] for k in reversed(q)])
    ring = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
    for i in range(len(ring)):
        k0, k1 = ring[i], ring[(i + 1) % len(ring)]
        bm_.faces.new((lo[k0], lo[k1], hi[k1], hi[k0]))
    bmesh.ops.remove_doubles(bm_, verts=bm_.verts[:], dist=1e-6)
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces[:])
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["leg"])
    me = o.data
    uv = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.z * 1.5, (-co.y if abs(poly.normal.x) > 0.5 else co.x) * 1.5)
    parts.append(o)
    return o


legs = [leg(f"StepStoolLeg{i}", sx * LEG_X) for i, sx in enumerate((-1, 1))]
# (the apron under the top's front edge, between the legs: what keeps them square, and what's seen from the kitchen)
apron = box("StepStoolApron", -LEG_X + LEG_T / 2, LEG_X - LEG_T / 2, UNDER - 0.05, UNDER, DEPTH / 2 - 0.045, DEPTH / 2 - 0.025, "leg")
for o in parts:
    for p_ in o.data.polygons:
        p_.use_smooth = False
mark = bpy.data.objects.new("StepStoolTop", None)
mark.location = P(0, TOP_H, 0)
bpy.context.collection.objects.link(mark)
root = bpy.data.objects.new("StepStool", None)
bpy.context.collection.objects.link(root)
for o in parts + [mark]:
    o.parent = root
print("STEPSTOOL_FACES", {o.name: len(o.data.polygons) for o in parts}, "TOTAL", sum(len(o.data.polygons) for o in parts))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.9, -1.1, 0.75)
    cam.rotation_euler = (math.radians(62), 0, math.radians(38))
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(20), math.radians(30))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new("W")
    world.color = (0.35, 0.33, 0.3)
    bpy.context.scene.world = world
export_dish(root, parts + [mark, root], os.path.join(PROJECT, "public", "models", "stepstool.glb"), os.path.join(PROJECT, "blender", "stepstool.blend"), PREVIEW)
print("STEPSTOOL_DONE")
