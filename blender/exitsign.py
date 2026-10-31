"""The emergency exit sign (誘導灯) on the wall by the way out: a slim light box of white-enamelled steel, its corners rounded, the lit face
let into its front (the game paints the face: the running figure, the door, the arrow and the words, in the language on screen), held off the
wall on a little bracket at each end.

- "ExitBox": the housing, 36 x 13 cm, 4.5 deep, its front edge a little chamfered round the face.
- "ExitFace": the face, a plane just inside the front, its UVs the whole face (0..1), facing +z.
- "ExitBracket": the two brackets from the box's back to the wall (the wall at z = -0.04).

The sign faces +z, its back toward the wall (-z), its middle at the origin.

Run:
    blender -b --factory-startup --python blender/exitsign.py -- <project path> [preview.png]
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
W, H, D = 0.36, 0.13, 0.045


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def rounded_box(name, w, h, d, r, bevel_segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, 0, 0))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new("round", "BEVEL")
    mod.width = r
    mod.segments = bevel_segments
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def face(name, w, h, z):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = [bm.verts.new(P(x, y, z)) for (x, y) in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    # (facing +z: the game's front)
    if o.data.polygons[0].normal.y > 0:
        o.data.flip_normals()
    return o


def bracket(name, x):
    """an L of flat steel: down the wall, then out under the box"""
    parts = []
    for (cx, cy, cz, sx, sy, sz) in ((x, -H / 2 - 0.004, -D / 2 - 0.02, 0.022, 0.006, 0.04), (x, -H / 2 + 0.01, -D / 2 - 0.038, 0.022, 0.03, 0.004)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(cx, cy, cz))
        o = bpy.context.view_layer.objects.active
        o.scale = (sx, sz, sy)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        parts.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def fin(o, mat, parts):
    o.data.materials.clear()
    o.data.materials.append(mat)
    parts.append(o)
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "box": pbr("ExitEnamel", (0.86, 0.87, 0.86), rough=0.35, coat=0.3),
    "face": pbr("ExitFaceLit", (0.05, 0.55, 0.25), emit=(0.05, 0.55, 0.25), emit_strength=2.0),
    "steel": pbr("ExitSteel", (0.55, 0.56, 0.57), rough=0.4, metal=0.8),
}
parts = []
fin(rounded_box("ExitBox", W, H, D, 0.012), M["box"], parts)
fin(face("ExitFace", W - 0.03, H - 0.026, D / 2 + 0.0012), M["face"], parts)
b1 = bracket("ExitBracketL", -W / 2 + 0.05)
b2 = bracket("ExitBracketR", W / 2 - 0.05)
bpy.ops.object.select_all(action="DESELECT")
b1.select_set(True)
b2.select_set(True)
bpy.context.view_layer.objects.active = b1
bpy.ops.object.join()
b1.name = "ExitBracket"
fin(b1, M["steel"], parts)
root = bpy.data.objects.new("ExitSign", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("EXIT_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.25, 0.12, 0.55)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.3, 0.3, 0.32)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "exitsign.glb"), os.path.join(PROJECT, "blender", "exitsign.blend"), PREVIEW)
print("EXIT_DONE")
