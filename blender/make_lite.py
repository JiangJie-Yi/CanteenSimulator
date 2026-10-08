"""Make the light version of a dish for phones and modest GPUs: <dish>-lite.glb next to <dish>.glb.

    blender -b blender/<dish>.blend --python blender/make_lite.py -- <project dir> [max texture px]

Textures are the real cost on a phone (a 1024 px texture takes 4 MB of GPU memory however well it's compressed in
the file), so every image is scaled down to at most MAX px (512 by default). Dense meshes without shape keys are
decimated to about half their triangles; small ones and anything with shape keys (the mochi's puff) are left
as they are. Nothing else changes: same object names, materials and hierarchy, so the web app treats both
versions alike.
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX = int(argv[1]) if len(argv) > 1 else 512
DENSE = 2500          # triangles: meshes above this get decimated
RATIO = 0.5

name = os.path.splitext(os.path.basename(bpy.data.filepath))[0]

for img in bpy.data.images:
    w, h = img.size
    if w > MAX or h > MAX:
        k = MAX / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
        img.pack()

scene = bpy.context.scene
roots = [o for o in scene.objects if o.parent is None and o.type == "EMPTY"]
keep = set()
for r in roots:
    keep.add(r)
    keep.update(r.children_recursive)

decimated = 0
for o in keep:
    if o.type != "MESH" or o.data.shape_keys:
        continue
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris < DENSE:
        continue
    m = o.modifiers.new("Lite", "DECIMATE")
    m.ratio = RATIO
    m.use_collapse_triangulate = True
    decimated += 1

bpy.ops.object.select_all(action="DESELECT")
for o in keep:
    o.select_set(True)
out = os.path.join(PROJECT, "public", "models", f"{name}-lite.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True,
                          export_image_format="WEBP", export_vertex_color="ACTIVE")
print(f"LITE_DONE {name} decimated={decimated} -> {out}")
