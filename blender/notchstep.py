"""A wooden step (木台階) on the floor of the cook table's notch, for the owner or his cook to stand on at the fire (the owner's):
notchstep.glb, node "NotchStep".

One solid block, as the owner asked (a cube of a thing, higher, its wood natural, and far fewer faces: it was four boards with gaps and
rounded edges, a skirt and two battens, 1,600 triangles): its edges eased with a single bevel, its top one material (StepTop) and its four
sides another (StepSkirt), the bottom left off (it's on the floor). The game puts its own wood on them (Roasting's keyaki on the top, the
bar's standing boards round the sides), their UVs in the shop's units (one UV unit a unit of length), so its wood comes out the same size
as the table's and the bar's.

The game's frame (y up), its foot's middle on the floor at the origin; x across the notch (the table's along), z out of it toward the
cook's back (its front, the step up, at +z).

Run:
    blender -b --factory-startup --python blender/notchstep.py -- <project path> [preview.png]
"""
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

bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


W, D, H = 1.22, 1.05, 0.045        # across, deep, tall (deeper, to stand him back off the seasoning ledge; low, a duckboard's height, the owner's
                                    # (2026-11-10): at 0.2, then 0.14 before that, he stood up out of the notch, the table's top at his hips)
EASE = 0.012                        # the edges' bevel
M = {
    "top": pbr("StepTop", (0.86, 0.66, 0.42), rough=0.55),
    "skirt": pbr("StepSkirt", (0.62, 0.42, 0.26), rough=0.6),
}
parts = []

# (one block: a cube scaled to the step, its edges bevelled once, the bottom taken off; the top's faces the top's wood, the rest the sides')
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H / 2, 0))
o = bpy.context.view_layer.objects.active
o.name = "NotchStepBlock"
o.scale = (W, D, H)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bv = o.modifiers.new("Ease", "BEVEL")
bv.width = EASE
bv.segments = 1
bv.limit_method = "ANGLE"
bpy.ops.object.modifier_apply(modifier=bv.name)
o.data.materials.append(M["top"])
o.data.materials.append(M["skirt"])
bm = bmesh.new()
bm.from_mesh(o.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.7], context="FACES")
for f in bm.faces:
    f.material_index = 0 if f.normal.z > 0.7 else 1
uvl = bm.loops.layers.uv.verify()
for f in bm.faces:
    n = f.normal
    for l in f.loops:
        v = l.vert.co
        gx, gy, gz = v.x, v.z, -v.y   # (back into the game's frame)
        # (each face its own two axes, in units: x and z on the top, x and y on the front and back, z and y on the ends; the bevel's slants
        # by whichever they lean to)
        if abs(n.z) > 0.5:
            l[uvl].uv = (gx, gz)
        elif abs(n.y) >= abs(n.x):
            l[uvl].uv = (gx, gy)
        else:
            l[uvl].uv = (gz, gy)
bm.to_mesh(o.data)
bm.free()
for pg in o.data.polygons:
    pg.use_smooth = False
parts.append(o)

root = bpy.data.objects.new("NotchStep", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("STEP_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0, 0.05, 0)
    cam.location = P(0.9, 0.9, 1.6)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "notchstep.glb"), os.path.join(PROJECT, "blender", "notchstep.blend"), PREVIEW)
print("STEP_DONE")
