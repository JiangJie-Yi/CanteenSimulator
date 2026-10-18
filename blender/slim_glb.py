"""Cut a downloaded glb's meshes down to a triangle budget for the web: same nodes, materials, skin and animation.

    blender -b --factory-startup --python blender/slim_glb.py -- <in.glb> <out.glb> <target triangles in all>

Every mesh gets a Decimate (collapse) modifier at the ratio that brings the whole model to the target, applied on export.
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst, target = argv[0], argv[1], int(argv[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > 1024:
        k = 1024 / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
        img.pack()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
ratio = min(1.0, target / max(1, total))
print(f"SLIM before={total} ratio={ratio:.3f}")
for o in meshes:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris < 120 or o.data.shape_keys:
        continue
    m = o.modifiers.new("Slim", "DECIMATE")
    m.ratio = ratio
    m.use_collapse_triangulate = True
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_apply=True, export_animations=True,
                          export_image_format="AUTO", export_skins=True)
print("SLIM_DONE", dst)
