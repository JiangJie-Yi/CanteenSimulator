"""A cook's knives laid out on a folded cloth by the hearth: knives.glb, node "KnifeSet". Three Japanese knives side by side, each a steel
blade (its edge ground bright, a darker spine, the maker's little mark) in a wa-handle of pale magnolia with a black horn ferrule:
- yanagiba (柳刃): long and slender, for slicing;
- deba (出刃): short, broad and heavy, for taking a fish apart;
- nakiri (菜切): a straight-edged rectangle, for vegetables.
They lie on an indigo cotton cloth (布巾) folded in three. Real size in metres, x along the blades (tip toward +x), z up, the cloth's
middle at the origin.

Run:
    blender -b --factory-startup --python blender/knives.py -- <project path> [preview.png]
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


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


# (the blade's steel: brushed along its length, brighter toward the ground edge, the spine darker; the cloth's indigo with its weave and a
# white line near each end)
N = 256
u, v = grid01(N)
brush = 0.85 + 0.15 * fbm(N, 2, 60, 3)
steel = np.stack([0.8 * brush, 0.82 * brush, 0.85 * brush], -1) * (0.85 + 0.25 * (1 - v[..., None]) ** 2)
steel = np.clip(steel, 0, 1).astype(np.float32)
weave = 0.9 + 0.1 * (np.sin(u * 2 * np.pi * 80) * np.sin(v * 2 * np.pi * 80) * 0.5 + 0.5)
cloth = np.stack([0.16 * weave, 0.22 * weave, 0.4 * weave], -1)
for y0 in (0.08, 0.92):
    cloth[np.abs(u - y0) < 0.012] = (0.92, 0.9, 0.84)
M = {
    "steel": pbr("KnifeSteel", (1, 1, 1), tex=image("knife_steel", steel), rough=0.3, metal=0.6),
    "spine": pbr("KnifeSpine", lin("#4a4c50"), rough=0.4, metal=0.8),
    "handle": pbr("KnifeHandle", lin("#d8c49a"), rough=0.55),
    "horn": pbr("KnifeHorn", lin("#16120f"), rough=0.3),
    "cloth": pbr("KnifeCloth", (1, 1, 1), tex=image("knife_cloth", cloth.astype(np.float32)), rough=0.85),
    "mark": pbr("KnifeMark", lin("#2a2420"), rough=0.5),
}
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def blade(name, outline, thick, at_y):
    """a blade from its outline (x along it, y across it, the edge at y = 0), lying flat: thick along the spine, ground thin to the edge"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    top, bot = [], []
    ys = [p[1] for p in outline]
    ymax = max(ys) or 1
    for (x, y) in outline:
        t = thick * (0.15 + 0.85 * (max(0.0, y) / ymax) ** 0.6)
        top.append(bm.verts.new((x, y + at_y, 0.012 + t / 2)))
        bot.append(bm.verts.new((x, y + at_y, 0.012 - t / 2)))
    xs = [p[0] for p in outline]
    x0, x1 = min(xs), max(xs)
    for ring, flip in ((top, False), (bot, True)):
        f = bm.faces.new(ring[::-1] if flip else ring)
        for l in f.loops:
            l[uvl].uv = ((l.vert.co.x - x0) / (x1 - x0), (l.vert.co.y - at_y) / ymax)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return fin(o, name, M["steel"], smooth=False)


def handle(name, x0, length, r, at_y):
    """an octagonal wa-handle from x0 back along -x, its horn ferrule at the blade end"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=length, location=(x0 - length / 2 - 0.03, at_y, 0.012 + r * 0.3),
                                        rotation=(0, math.pi / 2, 0))
    o = active(); o.scale = (1, 1, 0.8)
    fin(o, name, M["handle"], smooth=False)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r * 1.04, depth=0.03, location=(x0 - 0.015, at_y, 0.012 + r * 0.3),
                                        rotation=(0, math.pi / 2, 0))
    o = active(); o.scale = (1, 1, 0.8)
    fin(o, name + "Ferrule", M["horn"], smooth=False)


def smooth_outline(pts, n=40):
    """a closed outline from a few points, rounded through them"""
    out = []
    m = len(pts)
    for i in range(m):
        p0, p1, p2, p3 = (Vector(pts[(i + k - 1) % m]) for k in range(4))
        for s in range(n // m):
            t = s / (n // m)
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
            out.append((q.x, max(0.0, q.y)))
    return out


# (yanagiba: long, slender, its edge straight to a fine point curving up to the spine)
yan = [(0, 0), (0.12, 0), (0.24, 0.001), (0.29, 0.012), (0.27, 0.03), (0.12, 0.034), (0.0, 0.034)]
blade("KnifeYanagiba", yan, 0.004, -0.11)
handle("KnifeYanagibaHandle", 0.0, 0.14, 0.013, -0.11 + 0.017)
# (deba: short and broad, a strong curved belly, a thick spine)
deb = [(0, 0), (0.06, -0.002), (0.13, 0.006), (0.165, 0.024), (0.16, 0.05), (0.07, 0.054), (0.0, 0.052)]
blade("KnifeDeba", deb, 0.008, 0.0)
handle("KnifeDebaHandle", 0.0, 0.12, 0.016, 0.026)
# (nakiri: a straight-edged rectangle with its corners just eased)
nak = [(0, 0), (0.16, 0), (0.168, 0.006), (0.168, 0.046), (0.16, 0.05), (0.0, 0.05)]
blade("KnifeNakiri", nak, 0.003, 0.1)
handle("KnifeNakiriHandle", 0.0, 0.12, 0.013, 0.125)
# (each maker's little mark stamped near the heel)
for i, y in enumerate((-0.11 + 0.02, 0.03, 0.125)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.004, depth=0.0006, location=(0.03, y, 0.0165))
    fin(active(), f"KnifeMark{i}", M["mark"], smooth=False)
# ---- the cloth under them: folded in three, its layers stepping up a little, a soft fold at each side
for k, (w, h) in enumerate(((0.62, 0.003), (0.6, 0.0065), (0.58, 0.01))):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, 0.01, h / 2 if k == 0 else 0.003 * k + 0.0015))
    o = active(); o.scale = (w, 0.36 - k * 0.006, 0.003)
    bevel(o, 0.0015, 2, angle=False)
    bpy.ops.object.modifier_apply(modifier="Bevel")
    fin(o, f"KnifeCloth{k}", M["cloth"], smooth=False)
# (the knives laid on it: lifted to its top, set a little apart, a touch askew)
for o in parts:
    if o.name.startswith("Knife") and not o.name.startswith("KnifeCloth"):
        o.location.z += 0.006
        o.location.x -= 0.02

root = bpy.data.objects.new("KnifeSet", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.15, -0.6, 0.5)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.45, 0.45, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "knives.glb"), os.path.join(PROJECT, "blender", "knives.blend"), PREVIEW)
print("KNIVES_DONE", sum(len(o.data.polygons) for o in parts))
