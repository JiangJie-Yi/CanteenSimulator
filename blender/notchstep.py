"""A low wooden step (踏み台) on the floor of the cook table's notch, for the owner or his cook to stand on at the fire (the owner's):
notchstep.glb, node "NotchStep".

Four boards across its top, a gap between each, the front one's edge rounded over (it's what's stepped up onto); a skirt round its four
sides, set in a little under the boards; two dark battens underneath across it. Plain materials (StepTop, StepSkirt, StepBatten): the game
puts its own wood on them (Roasting's keyaki and cedar, as the table's), their UVs in the shop's units (one UV unit a unit of length), so
its wood comes out the same size as the table's.

The game's frame (y up), its foot's middle on the floor at the origin; x across the notch (the table's along), z out of it toward the
cook's back (its front, the step up, at +z).

Run:
    blender -b --factory-startup --python blender/notchstep.py -- <project path> [preview.png]
"""
import os
import sys

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


W, D, H = 1.22, 0.95, 0.14         # across, deep, tall
TOP = 0.026                         # the boards' thickness
GAP = 0.005                         # between the boards
INSET = 0.012                       # the skirt set in under the boards' edge
M = {
    "top": pbr("StepTop", (0.86, 0.66, 0.42), rough=0.55),
    "skirt": pbr("StepSkirt", (0.62, 0.42, 0.26), rough=0.6),
    "batten": pbr("StepBatten", (0.2, 0.13, 0.08), rough=0.7),
}
parts = []


def box(name, x, y, z, mat, bevel=0.0, front_only=False):
    """a box from x[0]..x[1], y[0]..y[1], z[0]..z[1] (the game's frame), its UVs in the shop's units: each face's two own axes, so the
    game's wood tiles over it at its true size; `bevel` rounds its edges over"""
    cx, cy, cz = (x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(cx, cy, cz))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (x[1] - x[0], z[1] - z[0], y[1] - y[0])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        bv = o.modifiers.new("Round", "BEVEL")
        bv.width = bevel
        bv.segments = 3
        bv.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=bv.name)
    # (UVs from each face's own two axes, in units: x and z on the top and bottom, x and y on the front and back, z and y on the ends)
    me = o.data
    uv = me.uv_layers.new(name="UVMap") if not me.uv_layers else me.uv_layers[0]
    for pg in me.polygons:
        n = pg.normal
        for li in pg.loop_indices:
            v = o.matrix_world @ me.vertices[me.loops[li].vertex_index].co
            gx, gy, gz = v.x, v.z, -v.y   # (back into the game's frame)
            if abs(n.z) > 0.7:
                uv.data[li].uv = (gx, gz)
            elif abs(n.y) > 0.7:
                uv.data[li].uv = (gx, gy)
            else:
                uv.data[li].uv = (gz, gy)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


# (the top: four boards across it, the front one's edge rounded over)
bw = (D - 3 * GAP) / 4
for k in range(4):
    z0 = -D / 2 + k * (bw + GAP)
    box(f"StepBoard{k}", (-W / 2, W / 2), (H - TOP, H), (z0, z0 + bw), "top", bevel=0.008 if k == 3 else 0.003)
# (the skirt round its sides, set in a little under the boards)
sk = 0.018
box("StepSkirtFront", (-W / 2 + INSET, W / 2 - INSET), (0, H - TOP), (D / 2 - INSET - sk, D / 2 - INSET), "skirt", bevel=0.002)
box("StepSkirtBack", (-W / 2 + INSET, W / 2 - INSET), (0, H - TOP), (-D / 2 + INSET, -D / 2 + INSET + sk), "skirt", bevel=0.002)
for sd in (-1, 1):
    x0 = sd * (W / 2 - INSET)
    box(f"StepSkirtEnd{sd}", (min(x0, x0 - sd * sk), max(x0, x0 - sd * sk)), (0, H - TOP), (-D / 2 + INSET + sk, D / 2 - INSET - sk), "skirt", bevel=0.002)
# (two battens under the boards, across from back to front)
for sd in (-1, 1):
    x = sd * W * 0.22
    box(f"StepBatten{sd}", (x - 0.025, x + 0.025), (0.0, H - TOP), (-D / 2 + INSET + sk, D / 2 - INSET - sk), "batten")

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
