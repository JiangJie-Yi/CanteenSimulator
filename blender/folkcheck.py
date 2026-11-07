"""Where the customers' heads come through their hair or what's on them (blender/folk.py's folk.blend): for every hairstyle and every head piece,
each point of the head (FolkHead) looked at from the head's middle; where a ray out to the point meets the hair first and the point is past
it by more than TOL, the point shows through. And every pair of head pieces whose boxes overlap (the ears, the earrings, a ringlet...).

Run:
    blender -b blender/folk.blend --python blender/folkcheck.py
"""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TOL = 0.002
deps = bpy.context.evaluated_depsgraph_get()


def world_mesh(o):
    me = o.evaluated_get(deps).to_mesh()
    vs = [o.matrix_world @ v.co for v in me.vertices]
    fs = [list(p.vertices) for p in me.polygons]
    o.evaluated_get(deps).to_mesh_clear()
    return vs, fs


head = bpy.data.objects.get("FolkHead")
hvs, _ = world_mesh(head)
centre = sum(hvs, Vector()) / len(hvs)
# (only the ball's own points: the ears and the nose stand out of the hair as they should)
rad = sorted((v - centre).length for v in hvs)[len(hvs) // 2]
hvs = [v for v in hvs if (v - centre).length < rad + 0.004]
total = 0
for o in bpy.data.objects:
    if o.type != "MESH" or not (o.name.startswith("Folk_hair_") or o.name.startswith("Folk_acc_")):
        continue
    vs, fs = world_mesh(o)
    if not fs:
        continue
    tree = BVHTree.FromPolygons(vs, fs)
    out = 0
    worst = 0.0
    for v in hvs:
        d = v - centre
        hit = tree.ray_cast(centre, d.normalized(), d.length + 0.05)
        if hit[0] is not None and hit[3] < d.length - TOL:
            out += 1
            worst = max(worst, d.length - hit[3])
            import math, os
            if os.environ.get("DETAIL"):
                # (where on the head: bearing round from the front (Blender -y is the game's +z, the front), elevation up)
                print(f"   at bearing {math.degrees(math.atan2(d.x, -d.y)):6.1f} elev {math.degrees(math.asin(d.z / d.length)):6.1f}  {(d.length - hit[3]) * 1000:.1f} mm  hit face {hit[2]}")
    total += out
    print(f"PIERCE {o.name:28s} {out:4d} head points through it (worst {worst * 1000:.1f} mm)")
print("FOLKCHECK_DONE", total)
