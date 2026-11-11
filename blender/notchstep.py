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
import numpy as np  # noqa: E402

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
H = 0.09                            # tall: a duckboard's (the owner's, 2026-11-11: thicker; 0.05 before, and at 0.2, then 0.14, he stood up
                                    # out of the notch, the table's top at his hips), the table's dark kick behind it no higher
SLAT_T, SLAT_W, GAP = 0.026, 0.085, 0.016   # each slat's thickness, width, and the gap between two
EASE = 0.006                        # the slats' and battens' edges eased


def grain(n, base, dark, streaks, seed):
    """a cedar board's face: fine straight grain along u, a few darker late-wood lines, a soft figure across it"""
    rng = np.random.default_rng(seed)
    u, v = grid01(n)
    lines_ = np.sin((v + fbm(n, seed, 2, 3) * 0.04) * 2 * np.pi * streaks)
    col = mix(base, dark, smooth(0.55, 0.95, lines_) * 0.55)
    col = mix(col, dark, smooth(0.6, 0.9, fbm(n, seed + 1, 1, 3)) * 0.25)
    col = mix(col, (min(1, base[0] * 1.12), min(1, base[1] * 1.1), min(1, base[2] * 1.08)), smooth(0.65, 0.95, fbm(n, seed + 2, 4, 3)) * 0.3)
    return col


M = {
    # (oiled sugi slats, warm mid-brown: the owner's, 2026-11-11: the dark flat-painted top was ugly)
    "top": pbr("StepTop", tex=image("T_StepSlat", grain(256, (0.42, 0.25, 0.13), (0.24, 0.13, 0.06), 9, 3)), rough=0.6),
    "skirt": pbr("StepSkirt", tex=image("T_StepBatten", grain(256, (0.27, 0.16, 0.08), (0.15, 0.08, 0.04), 7, 8)), rough=0.7),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=EASE, along_x=True):
    """a board, its edges eased once, its bottom kept (a duckboard's turned up as it's carried out to dry); UVs in units along its length"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bv = o.modifiers.new("Ease", "BEVEL")
    bv.width = bev
    bv.segments = 1
    bpy.ops.object.modifier_apply(modifier=bv.name)
    o.data.materials.append(M[mat])
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            v = l.vert.co
            gx, gy, gz = v.x, v.z, -v.y
            a = gx if along_x else gz
            c = (gz if along_x else gx) if abs(n.z) > 0.5 else gy
            l[uvl].uv = (a * 1.2, c * 4.0)
    bm.to_mesh(o.data)
    bm.free()
    for pg in o.data.polygons:
        pg.use_smooth = False
    return o


# (each a duckboard (すのこ): slats across the recess (along its width), a gap between each two, laid on three battens running out of it
# underneath, their ends set in from the slats'; joined into one mesh, the slats one material and the battens another; under an empty of
# its own name, its foot's middle at the origin)
roots = []
for name, (W, D) in STEPS.items():
    n = max(3, int((D + GAP) // (SLAT_W + GAP)))
    pitch = (D - SLAT_W) / (n - 1)
    objs = []
    for k in range(n):
        z = -D / 2 + SLAT_W / 2 + k * pitch
        objs.append(box(f"{name}Slat{k}", -W / 2, W / 2, H - SLAT_T, H, z - SLAT_W / 2, z + SLAT_W / 2, "top"))
    for bx in (-W / 2 + 0.1, 0.0, W / 2 - 0.1):
        objs.append(box(f"{name}Batten", bx - 0.025, bx + 0.025, 0, H - SLAT_T + 0.002, -D / 2 + 0.04, D / 2 - 0.04, "skirt", along_x=False))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name + "Block"
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
