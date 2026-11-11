"""The little shrine's steps drawn in toward it (the owner's, 2026-11-11: the steps in a little, more room before the shrine), in the finished
model (kamidana.glb, reduced after it was made: blender/optimize_glb.py), so it isn't made and reduced again for this: every vertex of the
steps (in the game's frame, before the deck's front face DF, within the side boards, under the deck's top: blender/kamidana.py's) brought
toward DF to STEP_K of how far out it was; the side boards' sloping ends with them. Written out with optimize_glb's settings.

Run:
    blender -b --factory-startup --python blender/kamidana_steps.py -- <in.glb> <out.glb>
"""
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
DF, HALF_W, TOP, STEP_K = 0.015 - 0.09, 0.062, 0.047, 0.55
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
moved = 0
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    # (only the shrine's own: under its root, not under the things set about it that hang there too)
    p, root, other = o, None, False
    while p is not None:
        if p.name == "Kamidana":
            root = p
        if p.name.startswith(("KamiOranges", "KamiSutra", "KamiTable", "KamiFlask", "KamiCupStand", "KamiBracket", "KamiLantern", "KamiEbisu")):
            other = True
        p = p.parent
    if root is None or other:
        continue
    mw, inv = o.matrix_world, o.matrix_world.inverted()
    for v in o.data.vertices:
        w = mw @ v.co
        # (Blender's frame from the glTF: x the game's x, y its -z, z its y)
        gx, gz, gy = w.x, -w.y, w.z
        if gx < DF - 1e-6 and abs(gz) < HALF_W and gy < TOP:
            w.x = DF + (gx - DF) * STEP_K
            v.co = inv @ w
            moved += 1
print("STEPS_MOVED", moved)
try:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True, export_image_format="WEBP",
                              export_image_quality=95, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True)
print("STEPS_DONE")
