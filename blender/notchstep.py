"""The wooden steps (木台階) on the floor of the cook table's notch, for the owner to stand on at the fire, and of the third cook's bay at
its far end (the owner's): notchstep.glb, nodes "NotchStep" and "SousStep", each the size of its recess at the floor (from wall to wall
across, 2 to 3 mm off each, and from its back wall out: the owner's past the table's edge to under his feet, the third cook's to the
table's end).

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


# (across, deep: the recesses' walls at the floor are 0.05 out from the cuts the game names (COOK_NOTCH, SOUS_NOTCH: its body set in under
# the top, its dark kick at its foot), the steps 0.047 out, so 3 mm off them; the owner's from his notch's back wall to 2.40 out (under his
# feet, at 2.3, and the step up a little in front of them), the third cook's from his bay's back wall to the table's end (3.1))
STEPS = {"NotchStep": (1.3 + 2 * 0.047, 2.4 - (1.26 - 0.047)), "SousStep": (1.3 + 2 * 0.047, 3.1 - (2.33 - 0.047))}
H = 0.05                            # tall: a duckboard's height (the owner's, 2026-11-10: at 0.2, then 0.14 before that, he stood up out of
                                    # the notch, the table's top at his hips), the table's dark kick behind it no higher
EASE = 0.012                        # the edges' bevel
M = {
    "top": pbr("StepTop", (0.86, 0.66, 0.42), rough=0.55),
    "skirt": pbr("StepSkirt", (0.62, 0.42, 0.26), rough=0.6),
}
parts = []

# (each one block: a cube scaled to the step, its edges bevelled once, the bottom taken off; the top's faces the top's wood, the rest the
# sides'; under an empty of its own name, its foot's middle at the origin)
roots = []
for name, (W, D) in STEPS.items():
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H / 2, 0))
    o = bpy.context.view_layer.objects.active
    o.name = name + "Block"
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
            # (each face its own two axes, in units: x and z on the top, x and y on the front and back, z and y on the ends; the bevel's
            # slants by whichever they lean to)
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
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    o.parent = root
    roots.append(root)
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
export_dish(roots[0], parts + roots, os.path.join(PROJECT, "public", "models", "notchstep.glb"), os.path.join(PROJECT, "blender", "notchstep.blend"), PREVIEW)
print("STEP_DONE")
