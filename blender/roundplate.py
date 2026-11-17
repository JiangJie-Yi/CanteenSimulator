"""
The round plates (丸皿, and the little 豆皿 the game draws the same shape smaller; item 228 and the owner's, 2026-11-17: 「盤子造型再精美些有點太簡陋，
厚度感要出來」「但模型要簡易」「碗盤面數太密」): made in the frame the game's code-made plate (GuestBar3D's PLATE_GEO) has, 0.26 across the rim
(PLATE_R = 0.13), so the game's KIND_SCALE (0.17 / 0.26 for the round one, 0.11 / 0.26 for the little one) takes it as it takes that. Its
picture is painted in the game (wareDesigns' wareDesign), laid flat from above: u = x / 0.26 + 0.5, v = y / 0.26 + 0.5 (Blender's y is the
game's -z), the rim's edge at 0 and 1, as PLATE_GEO's.

Low-poly (docs/MODELING.md): 20 round it, six bands in its profile from the well's floor, up a sloped well to a lip (a rounded shoulder, an
outer face 7 mm deep: the plate's thickness), down and in along the outside to a foot ring (高台) with a shallow recess under it; the floor
and the recess each closed with a ladder of quads straight across (no fan into a point): 140 faces, 276 triangles (PLATE_GEO's lathe
was 384). 0.0375 high at the rim.

  blender -b --factory-startup --python blender/roundplate.py -- <project> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import export_dish, ladder_fill, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

R = 0.13
SEG = 20
# (radius, height): the floor (dished a little: its middle lower than where it meets the well), the lip's top inside (the well one slope up
# to it), its rounded shoulder, its outer face, the belly drawn in under it, the foot ring's outer edge, the recess's edge under it
PROFILE = [(0.070, 0.009), (0.1205, 0.0395), (0.1300, 0.0375), (0.1300, 0.0305), (0.1085, 0.0195), (0.062, 0.0), (0.050, 0.003)]

bm = bmesh.new()
uv = bm.loops.layers.uv.new()
rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / SEG), r * math.sin(2 * math.pi * i / SEG), h)) for i in range(SEG)] for r, h in PROFILE]
for ra, rb in zip(rings, rings[1:]):
    for i in range(SEG):
        bm.faces.new((ra[i], ra[(i + 1) % SEG], rb[(i + 1) % SEG], rb[i]))
# (the well's floor, seen from above; the recess under it)
ladder_fill(bm, rings[0])
ladder_fill(bm, list(reversed(rings[-1])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
for f in bm.faces:
    f.smooth = True
    for l in f.loops:
        l[uv].uv = (0.5 + l.vert.co.x / (2 * R), 0.5 + l.vert.co.y / (2 * R))
me = bpy.data.meshes.new("RoundPlate")
bm.to_mesh(me)
bm.free()
plate = bpy.data.objects.new("RoundPlate", me)
bpy.context.collection.objects.link(plate)
plate.data.materials.append(pbr("RoundPlateGlaze", (0.96, 0.95, 0.92), rough=0.3))
# (flat where it's flat: the floor and the recess each a plane, their own normals; the well, lip and walls round)
for p in plate.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.98
print("ROUNDPLATE_FACES", len(plate.data.polygons), "TRIS", sum(len(p.vertices) - 2 for p in plate.data.polygons))

root = bpy.data.objects.new("RoundPlateRoot", None)
bpy.context.collection.objects.link(root)
plate.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.0, -0.3, 0.22)
    cam.rotation_euler = (math.radians(56), 0, 0)
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(20), math.radians(30))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new("W")
    world.color = (0.35, 0.33, 0.3)
    bpy.context.scene.world = world
export_dish(root, [plate, root], os.path.join(PROJECT, "public", "models", "roundplate.glb"), os.path.join(PROJECT, "blender", "roundplate.blend"), PREVIEW, ladder=False)
print("ROUNDPLATE_DONE")
