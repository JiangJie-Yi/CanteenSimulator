"""A samurai helmet (兜) on its lacquered stand, for the corridor: a ribbed bowl of black lacquered iron with gold rivets down its ribs,
a gold crest (kuwagata horns and a sun disc) on the brow, a short visor, the turned-back wings (吹返し) at its sides, and the neck guard
(しころ) of five lames flaring out and down, laced in navy cord; on a black lacquer stand with gold edges and a purple tassel.

Writes public/models/kabuto.glb and blender/kabuto.blend. Its root is the node "Kabuto", standing on its stand's foot at y = 0, facing -z
(three's frame).

Run:
    blender -b --factory-startup --python blender/kabuto.py -- <project path> [preview.png]
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


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


# ---- materials: black lacquer with a deep blue sheen; gold; the lacing (navy cords, a lighter thread between, in rows); the stand's lacquer;
# purple silk
N = 256
u, v = grid01(N)
cords = 0.5 + 0.5 * np.sin(v * 2 * math.pi * 14)
lace = mix((0.02, 0.03, 0.09), (0.06, 0.1, 0.24), smooth(0.25, 0.9, cords))
# (where the cords cross the lames, a fine gold-brown stitch, faint)
lace = mix(lace, (0.42, 0.33, 0.16), (np.abs(np.sin(u * 2 * math.pi * 24)) > 0.985).astype(np.float32) * 0.45)
M = {
    "lacquer": pbr("KabutoLacquer", lin("#0b0c11"), rough=0.32, coat=0.5),
    "gold": pbr("KabutoGold", lin("#d4a73c"), rough=0.25, metal=1.0),
    "lace": pbr("KabutoLace", (1, 1, 1), tex=image("kabuto_lace", lace), rough=0.75),
    "leather": pbr("KabutoLeather", lin("#5a3820"), rough=0.6),
    "stand": pbr("KabutoStand", lin("#16110e"), rough=0.3, coat=0.4),
    "silk": pbr("KabutoSilk", lin("#5a2a78"), rough=0.6),
}
parts = []


def fin(o, name, mat):
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def lathe(name, prof, mat, seg=48, ribs=0, rib_depth=0.0, uv_rows=1.0, arc=(0.0, 2 * math.pi)):
    """a surface turned round the vertical from a profile of (radius, height) points; ribs: raised ridges round it"""
    bm = bmesh.new()
    rings = []
    closed = arc[1] - arc[0] >= 2 * math.pi - 1e-6
    n = seg if closed else seg + 1
    for (r, y) in prof:
        ring = []
        for j in range(n):
            a = arc[0] + (arc[1] - arc[0]) * j / seg
            rr = r * (1 + (rib_depth * max(0.0, math.cos(a * ribs)) ** 6 if ribs else 0))
            ring.append(bm.verts.new(P(rr * math.cos(a), y, rr * math.sin(a))))
        rings.append(ring)
    uvl = bm.loops.layers.uv.new()
    for i in range(len(rings) - 1):
        for j in range(seg):
            j2 = (j + 1) % n
            f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
            for lp, (uu, vv) in zip(f.loops, ((j / seg, i), ((j + 1) / seg, i), ((j + 1) / seg, i + 1), (j / seg, i + 1))):
                lp[uvl].uv = (uu, vv / max(1, len(rings) - 1) * uv_rows)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    sol = o.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.003
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="t")
    return fin(o, name, mat)


H0 = 0.16                      # (the stand's height: the helmet sits on it)
# ---- the bowl: a low dome, a little longer front to back, its 32 ribs standing up, gold at its crown (the tehen)
bowl = [(0.11 * math.cos(t), H0 + 0.07 + 0.085 * math.sin(t)) for t in [i / 14 * math.pi / 2 for i in range(15)]]
bowl[-1] = (0.004, bowl[-1][1])
b = lathe("KabutoBowl", bowl, M["lacquer"], seg=96, ribs=32, rib_depth=0.07)
b.scale = (1.0, 1.1, 1.0)
bpy.ops.object.select_all(action="DESELECT"); b.select_set(True); bpy.context.view_layer.objects.active = b
bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.016, depth=0.008, location=P(0, H0 + 0.157, 0))
fin(active(), "KabutoTehen", M["gold"])
# (gold rivets down the front ribs)
for k in range(6):
    t = 0.15 + k * 0.12
    for sd in (-1, 0, 1):
        a = -math.pi / 2 + sd * 0.25
        r = 0.112 * math.cos(t)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0035, segments=8, ring_count=5,
                                             location=P(r * math.cos(a), H0 + 0.07 + 0.087 * math.sin(t), r * math.sin(a) * 1.1))
        fin(active(), f"KabutoRivet{k}{sd}", M["gold"])
# ---- the neck guard: five lames, each a flaring ring, stepping down and out round the back and sides, laced
OPEN = (-math.pi / 2 + 0.8, -math.pi / 2 - 0.8 + 2 * math.pi)       # (round from one cheek, past the back, to the other: the face (-z) left open)
for k in range(5):
    y = H0 + 0.07 - k * 0.02
    r0 = 0.112 + k * 0.011
    lathe(f"KabutoShikoro{k}", [(r0, y), (r0 + 0.014, y - 0.024)], M["lace"], seg=40, uv_rows=1.0, arc=OPEN)
# (a gold edge along the lowest)
lathe("KabutoHem", [(0.112 + 4 * 0.011 + 0.0145, H0 + 0.07 - 4 * 0.02 - 0.024), (0.112 + 4 * 0.011 + 0.016, H0 + 0.07 - 4 * 0.02 - 0.03)],
      M["gold"], seg=40, arc=OPEN)
# ---- the wings turned back at the front corners, lacquered, edged gold
for sd in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(sd * 0.125, H0 + 0.05, -0.1))
    w = active()
    w.scale = (0.008, 0.075, 0.095)
    w.rotation_euler = (0.0, 0.0, -sd * 0.9)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    bv = w.modifiers.new("b", "BEVEL"); bv.width = 0.004; bv.segments = 2
    bpy.ops.object.modifier_apply(modifier="b")
    fin(w, f"KabutoFukigaeshi{sd}", M["lacquer"])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, segments=16, ring_count=8, location=P(sd * 0.13, H0 + 0.055, -0.112))
    m_ = active(); m_.scale = (0.4, 1, 1); bpy.ops.object.transform_apply(scale=True)
    fin(m_, f"KabutoWingCrest{sd}", M["gold"])
# ---- the visor at the brow, a short lacquered peak
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.125, depth=0.005, location=P(0, H0 + 0.07, 0))
vz = active()
bm = bmesh.new(); bm.from_mesh(vz.data)
bmesh.ops.delete(bm, geom=[vv for vv in bm.verts if vv.co.y < 0.0], context="VERTS")
bm.to_mesh(vz.data); bm.free()
vz.rotation_euler = (math.radians(-18), 0, 0)
bpy.ops.object.select_all(action="DESELECT"); vz.select_set(True); bpy.context.view_layer.objects.active = vz
bpy.ops.object.transform_apply(rotation=True)
fin(vz, "KabutoVisor", M["lacquer"])
# ---- the crest: two gold horns sweeping up and out in a V (kuwagata), a gold sun disc between them on the brow
for sd in (-1, 1):
    cu = bpy.data.curves.new(f"KabutoHorn{sd}", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(2)
    pts = [(sd * 0.02, H0 + 0.1, -0.118), (sd * 0.085, H0 + 0.18, -0.135), (sd * 0.11, H0 + 0.27, -0.11)]
    for bp, q in zip(sp.bezier_points, pts):
        bp.co = P(*q)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.bevel_depth = 0.01
    cu.bevel_resolution = 2
    sp.bezier_points[2].radius = 0.4
    o = bpy.data.objects.new(f"KabutoHorn{sd}", cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    fin(active(), f"KabutoHorn{sd}", M["gold"])
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.03, depth=0.005, location=P(0, H0 + 0.112, -0.122), rotation=(math.pi / 2 - 0.3, 0, 0))
fin(active(), "KabutoSun", M["gold"])
# ---- the stand: a black lacquer box, a gold edge round its top, short feet, a purple silk tassel hanging from the front
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H0 / 2 + 0.01, 0))
st = active(); st.scale = (0.26, 0.26, H0 - 0.02); bpy.ops.object.transform_apply(scale=True)
bv = st.modifiers.new("b", "BEVEL"); bv.width = 0.006; bv.segments = 3
bpy.ops.object.modifier_apply(modifier="b")
fin(st, "KabutoStand", M["stand"])
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H0 - 0.002, 0))
gt = active(); gt.scale = (0.265, 0.265, 0.004); bpy.ops.object.transform_apply(scale=True)
fin(gt, "KabutoStandEdge", M["gold"])
for sx in (-1, 1):
    for sz in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(sx * 0.11, 0.005, sz * 0.11))
        f = active(); f.scale = (0.03, 0.03, 0.01); bpy.ops.object.transform_apply(scale=True)
        fin(f, f"KabutoFoot{sx}{sz}", M["stand"])
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.009, segments=12, ring_count=8, location=P(0, H0 - 0.03, -0.134))
fin(active(), "KabutoTasselKnot", M["silk"])
bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.016, radius2=0.004, depth=0.05, location=P(0, H0 - 0.064, -0.134))
fin(active(), "KabutoTassel", M["silk"])

root = bpy.data.objects.new("Kabuto", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kabuto.glb"), os.path.join(PROJECT, "blender", "kabuto.blend"), PREVIEW)
print("KABUTO_DONE", len(parts), "parts", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts), "tris")
