"""The takeaway stand and its kraft bags (takeout.glb; the owner's, 2026-11-11: a stand of its own for the takeaways, right behind the
cashier's chair; the takeaways in kraft paper bags):

- node "TakeoutStand": a small round table (the owner's, 2026-11-11: made to go with the till's walnut chairs, its triangles minded): a
  round top of black walnut, flat-sawn, its edge eased; an apron of four rails under it; four square legs, tapered and splayed a touch as
  the chairs' are, on little blue silicone caps; two stretchers crossed low between them. Its front toward +z (the cashier's chair). The
  warming tub stands on its back half, the bags along its front (GuestBar3D).
- node "KraftBag": a kraft paper bag, its top folded over twice, two twisted paper handles, a red seal on its fold.

The game's frame, in the bar's units (GuestBar3D's): y up from the floor, x across, the stand's front toward +z; its middle at the origin on
the floor; STAND_H its top's height. The bag stands on its foot at its own origin.

Run:
    blender -b --factory-startup --python blender/takeout.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

STAND_W, STAND_D, STAND_H = 0.5, 0.32, 0.42
TOP_R = 0.31
BAG_W, BAG_D, BAG_H = 0.15, 0.09, 0.15


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 256
u, v = grid01(N)
hin = mix((0.86, 0.74, 0.55), (0.76, 0.62, 0.42), smooth(0.6, 1.0, np.sin((u * 30 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.6)
# (kraft paper: brown, its fibres flecked darker and paler)
kraft = mix((0.72, 0.53, 0.33), (0.62, 0.44, 0.26), fbm(N, 8, 8, 4)) * (0.94 + 0.08 * vnoise(N, 120, 120))[..., None]
# (black walnut as the till's chairs' (blender/tillstools.py): a deep chocolate brown, a cool grey in it, its grain in long soft arches)
wob = fbm(N, 3, 2, 4) - 0.5
ring = ((u - (0.5 + 0.12 * np.sin(2 * math.pi * v) + wob * 0.1)) * 2.0) ** 2 * 3.0 + 0.2 * np.sin(2 * math.pi * (v * 2 + 0.3)) + wob * 0.3
wbase = np.array((0.36, 0.235, 0.16), np.float32)
wal = mix(wbase, wbase * np.float32(0.62), smooth(0.55, 0.98, np.sin(2 * math.pi * ring * 2.2)) * 0.7)
wal = mix(wal, wbase * np.float32(0.75), smooth(0.75, 1.0, np.sin(2 * math.pi * (u * 46 + wob * 4))) * 0.35)
wal = wal * (0.92 + 0.12 * fbm(N, 4, 16, 3))[..., None]
M = {
    "walnut": pbr("TakeoutWalnut", (1, 1, 1), tex=image("takeout_walnut", np.clip(wal, 0, 1).astype(np.float32)), rough=0.45),
    "cap": pbr("TakeoutCap", (0.078, 0.212, 0.552), rough=0.7),
    "hinoki": pbr("TakeoutHinoki", (1, 1, 1), tex=image("takeout_hinoki", np.clip(hin, 0, 1).astype(np.float32)), rough=0.55),
    "rail": pbr("TakeoutRail", lin("#3a2416"), rough=0.6),
    "kraft": pbr("KraftPaper", (1, 1, 1), tex=image("takeout_kraft", np.clip(kraft, 0, 1).astype(np.float32)), rough=0.9),
    "handle": pbr("KraftHandle", lin("#9a7048"), rough=0.9),
    "seal": pbr("KraftSeal", lin("#b3241c"), rough=0.5),
}
parts = []


def box_uv(o, tile=0.3):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, tile=0.3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 1)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    box_uv(o, tile)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def tube(name, pts, r, mat, sides=6):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(0, sides // 4 - 1)
    cu.resolution_u = 3
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = P(*p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = active()
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    for o_ in objs[1:]:
        if o_ in parts:
            parts.remove(o_)
    return o


# ---------------------------------------------------------------------------------------------------- the round table
h = STAND_H
TT, SEGS = 0.028, 24


def top_disc():
    """the round top: its upper face and underside closed in ladders (no fan into the middle), its edge eased in two steps; the grain laid
    across it once"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    prof = [(TOP_R - 0.006, h), (TOP_R, h - 0.006), (TOP_R, h - TT + 0.004), (TOP_R - 0.004, h - TT)]
    rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / SEGS), y, r * math.sin(2 * math.pi * j / SEGS))) for j in range(SEGS)] for r, y in prof]
    for a, b in zip(rings, rings[1:]):
        for j in range(SEGS):
            j2 = (j + 1) % SEGS
            bm.faces.new((a[j], b[j], b[j2], a[j2]))
    ladder_fill(bm, rings[0][::-1])
    ladder_fill(bm, rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        for loop in f.loops:
            c = loop.vert.co
            # (boards across it: the picture's arches narrow, three or so boards' worth across the top, its grain long along them)
            loop[uvl].uv = (c.x / (2 * TOP_R) * 2.6 + 0.5, c.y / (2 * TOP_R) * 0.55 + 0.5 + (0 if abs(f.normal.z) > 0.5 else c.z * 2))
    me = bpy.data.meshes.new("top")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("top", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["walnut"])
    parts.append(o)
    return o


def leg(name, foot, head, w0, w1):
    """a square leg from its foot to its head, tapering from w1 at the head to w0 at the foot (a frustum along the line between)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    a, b = Vector(foot), Vector(head)
    ax = (b - a).normalized()
    side = Vector((1, 0, 0)) - ax * ax.x
    side.normalize()
    fwd = ax.cross(side)
    rings = []
    for c, w_ in ((a, w0), (b, w1)):
        rings.append([bm.verts.new(P(*(c + side * sx * w_ / 2 + fwd * sz * w_ / 2))) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for j in range(4):
        j2 = (j + 1) % 4
        f = bm.faces.new((rings[0][j], rings[0][j2], rings[1][j2], rings[1][j]))
        for loop, (uu, vv) in zip(f.loops, ((0, 0), (0.08, 0), (0.08, 1), (0, 1))):
            loop[uvl].uv = (uu + j * 0.1, vv)
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["walnut"])
    parts.append(o)
    return o


s = [top_disc()]
# (four legs under the apron's corners, splayed out a touch toward their feet, their caps)
LA, LF = 0.17, 0.2      # (each leg's head in from the middle, its foot out)
APR = h - TT - 0.06
heads = []
for k, (sx, sz) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
    head = (sx * LA * 0.7071, h - TT, sz * LA * 0.7071)
    foot = (sx * LF * 0.7071, 0.018, sz * LF * 0.7071)
    heads.append(head)
    s.append(leg(f"leg{k}", foot, head, 0.026, 0.036))
    s.append(box(f"cap{k}", foot[0] - 0.016, foot[0] + 0.016, 0.0, 0.02, foot[2] - 0.016, foot[2] + 0.016, "cap", bev=0.004))
# (the apron: a rail between each two legs' heads, under the top)
for k in range(4):
    a, b = heads[k], heads[(k + 1) % 4]
    cx, cz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
    if abs(a[0] - b[0]) > 1e-6:
        s.append(box(f"apron{k}", min(a[0], b[0]) + 0.018, max(a[0], b[0]) - 0.018, APR, h - TT, cz - 0.009, cz + 0.009, "walnut", bev=0.002))
    else:
        s.append(box(f"apron{k}", cx - 0.009, cx + 0.009, APR, h - TT, min(a[2], b[2]) + 0.018, max(a[2], b[2]) - 0.018, "walnut", bev=0.002))
# (two stretchers crossed low between opposite legs, halved where they cross)
ys = 0.11
for k, (sx, sz) in enumerate(((1, 1), (1, -1))):
    r_ = 0.19 * 0.7071
    s.append(tube(f"stretch{k}", [(-sx * r_, ys + k * 0.012, -sz * r_), (sx * r_, ys + k * 0.012, sz * r_)], 0.011, "walnut", sides=4))
stand = join(s, "TakeoutStand")

# ---------------------------------------------------------------------------------------------------- the bag
bw, bd, bh = BAG_W / 2, BAG_D / 2, BAG_H
b = [box("bagbody", -bw, bw, 0, bh, -bd, bd, "kraft", tile=0.2),
     # (its top folded over twice: a band a little proud of the body, down its front)
     box("fold", -bw - 0.002, bw + 0.002, bh - 0.004, bh + 0.012, -bd - 0.002, bd + 0.002, "kraft", tile=0.2),
     box("foldfront", -bw - 0.002, bw + 0.002, bh - 0.03, bh + 0.012, bd + 0.002, bd + 0.006, "kraft", tile=0.2),
     box("seal", -0.012, 0.012, bh - 0.028, bh + 0.008, bd + 0.006, bd + 0.008, "seal")]
for sz in (-1, 1):
    z = sz * (bd - 0.012)
    b.append(tube(f"handle{sz}", [(-0.035, bh + 0.008, z), (0, bh + 0.06, z), (0.035, bh + 0.008, z)], 0.005, "handle"))
bag = join(b, "KraftBag")
bag.location = P(0.6, 0, 0)

root = bpy.data.objects.new("Takeout", None)
bpy.context.collection.objects.link(root)
for o in (stand, bag):
    o.parent = root
print("TAKEOUT_TRIS", {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (stand, bag)})
if PREVIEW:
    target = P(0.3, 0.25, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 0.9, 1.3)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "takeout.glb"), os.path.join(PROJECT, "blender", "takeout.blend"), PREVIEW)
print("TAKEOUT_DONE")
