"""Models running through each other in a saved scene (穿模), checked in Blender: every pair of mesh objects whose bounds overlap is tested
with BVH trees for faces crossing, and each pair that does is listed with how many faces cross. Skip pairs that are meant to touch with
SKIP (regex on either name).

Run:
    blender -b blender/grilledfish.blend --python blender/clipcheck.py -- [name regex to check, default all] [SKIP regex]
"""
import re
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WANT = re.compile(argv[0]) if argv and argv[0] else re.compile(".")
SKIP = re.compile(argv[1]) if len(argv) > 1 and argv[1] else None
dg = bpy.context.evaluated_depsgraph_get()
objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.visible_get()]
trees, boxes = {}, {}
for o in objs:
    e = o.evaluated_get(dg)
    me = e.to_mesh()
    vs = [o.matrix_world @ v.co for v in me.vertices]
    if not vs:
        e.to_mesh_clear()
        continue
    trees[o.name] = BVHTree.FromPolygons(vs, [tuple(p.vertices) for p in me.polygons])
    boxes[o.name] = (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))
    e.to_mesh_clear()
names = sorted(trees)
hits = []
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if not (WANT.search(a) or WANT.search(b)):
            continue
        if SKIP and (SKIP.search(a) or SKIP.search(b)):
            continue
        (a0, a1), (b0, b1) = boxes[a], boxes[b]
        if any(a1[k] < b0[k] or b1[k] < a0[k] for k in range(3)):
            continue
        n = len(trees[a].overlap(trees[b]))
        if n:
            hits.append((n, a, b))
for n, a, b in sorted(hits, reverse=True):
    print(f"CLIP {n:5d}  {a}  x  {b}")
print("CLIPCHECK_DONE", len(hits), "pairs")
