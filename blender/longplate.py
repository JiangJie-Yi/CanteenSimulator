"""
The long plate (長角皿, a yakizakana-zara; item 228, the owner's, 2026-11-16: 「盤子種類自己設計吧，這麼大一個盤子就裝那點東西」): what a
whole grilled fish, a squid or skewers are served on at an izakaya, a long rectangle with rounded corners, a flat well, a lifted lip all
round and a low foot. Made in the bar's own units (the size the game draws it at, the round plates' frame): 0.30 long (x), 0.115 across
(z in the game, -y here), 0.016 high. Its picture is painted in the game (wareDesigns' longDesign, a 染付 line drawing on white, as the
round plates' are), laid flat from above: u along it, v across it, the whole outline from 0 to 1.

Low-poly (docs/MODELING.md): 16 round its outline (four to each corner), five bands from the well's floor over the lip to the foot, the
floor and the underside each closed with a ladder of quads straight across (no fan into a point): 96 faces.

  blender -b --factory-startup --python blender/longplate.py -- <project> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import export_dish, ladder_fill, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# (half its length and its width, its corners' round)
A, B, RC = 0.15, 0.0575, 0.026
# (each ring in from the outline (d) at a height (h), from the well's floor out over the lip and down to the foot)
PROFILE = [(0.022, 0.005), (0.007, 0.0135), (0.0, 0.016), (0.005, 0.0065), (0.013, 0.0), (0.02, 0.0)]
PER_CORNER = 4


def outline(d):
    """the outline drawn in by `d`: PER_CORNER points to each corner (its own round, RC - d), anticlockwise from above, starting at the
    corner on +x, +y; the straight sides between corners are single edges"""
    pts = []
    r = RC - d
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy = sx * (A - RC), sy * (B - RC)
        for i in range(PER_CORNER):
            t = (k + i / (PER_CORNER - 1)) * math.pi / 2
            pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return pts


bm = bmesh.new()
uv = bm.loops.layers.uv.new()
rings = [[bm.verts.new((x, y, h)) for x, y in outline(d)] for d, h in PROFILE]
n = len(rings[0])
for ra, rb in zip(rings, rings[1:]):
    for i in range(n):
        bm.faces.new((ra[i], ra[(i + 1) % n], rb[(i + 1) % n], rb[i]))
# (the well's floor, seen from above; the underside)
ladder_fill(bm, rings[0])
ladder_fill(bm, list(reversed(rings[-1])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
for f in bm.faces:
    f.smooth = True
    for l in f.loops:
        l[uv].uv = (0.5 + l.vert.co.x / (2 * A), 0.5 + l.vert.co.y / (2 * B))
me = bpy.data.meshes.new("LongPlate")
bm.to_mesh(me)
bm.free()
plate = bpy.data.objects.new("LongPlate", me)
bpy.context.collection.objects.link(plate)
plate.data.materials.append(pbr("LongPlateGlaze", (0.96, 0.95, 0.92), rough=0.3))
# (flat where it's flat: the floor and the underside each a plane, their own normals; the lip and the walls round)
for p in plate.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.98
print("LONGPLATE_FACES", len(plate.data.polygons), "TRIS", sum(len(p.vertices) - 2 for p in plate.data.polygons))

root = bpy.data.objects.new("LongPlateRoot", None)
bpy.context.collection.objects.link(root)
plate.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.0, -0.32, 0.22)
    cam.rotation_euler = (math.radians(56), 0, 0)
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(20), math.radians(30))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new("W")
    world.color = (0.35, 0.33, 0.3)
    bpy.context.scene.world = world
export_dish(root, [plate, root], os.path.join(PROJECT, "public", "models", "longplate.glb"), os.path.join(PROJECT, "blender", "longplate.blend"), PREVIEW, ladder=False)
print("LONGPLATE_DONE")
