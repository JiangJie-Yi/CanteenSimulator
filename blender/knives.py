"""A cook's knives hung on the side of the hearth: knives.glb, node "KnifeSet". Three Japanese knives, each a steel blade (its edge
ground bright, a darker spine, the maker's little mark) in a wa-handle of pale magnolia with a black horn ferrule:
- yanagiba (柳刃): long and slender, for slicing;
- deba (出刃): short, broad and heavy, for taking a fish apart;
- nakiri (菜切): a straight-edged rectangle, for vegetables.
They hang flat against a knife board (包丁掛け) of pale hinoki screwed to the hearth frame's side: two bars of dark walnut across it, one
for each row, that the blades are held to, the yanagiba and the nakiri end to end along the upper, the deba on the lower; their edges down,
their handles all one way. Real size in metres, x along the blades (tips toward +x), z up; the board's back at y = 0, the knives out
toward -y (the game's +z, out from the frame's face); the board's middle at the origin.

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
N = 512
u, v = grid01(N)
# (the steel, laid out with u along the blade and v across it from the edge (0) to the spine (1): the bevel by the edge polished bright,
# its border with the body a soft wavy hamon; the body brushed along its length; darker toward the spine, which is left as forged)
brush = 0.88 + 0.12 * fbm(N, 2, 90, 3)
hamon = 0.3 + 0.025 * np.sin(u * 2 * np.pi * 9 + fbm(N, 6, 2, 3) * 3) + 0.01 * np.sin(u * 2 * np.pi * 31)
edge_band = smooth(hamon + 0.02, hamon - 0.02, v)
body = np.stack([0.66 * brush, 0.68 * brush, 0.71 * brush], -1)
steel = mix(body, (0.93, 0.94, 0.96), edge_band * 0.9)
steel = mix(steel, (0.26, 0.26, 0.28), smooth(0.8, 0.98, v) * 0.75)
steel = mix(steel, (0.98, 0.98, 1.0), smooth(0.03, 0.0, v) * 0.6)
steel = np.clip(steel, 0, 1).astype(np.float32)
weave = 0.9 + 0.1 * (np.sin(u * 2 * np.pi * 80) * np.sin(v * 2 * np.pi * 80) * 0.5 + 0.5)
cloth = np.stack([0.16 * weave, 0.22 * weave, 0.4 * weave], -1)
for y0 in (0.08, 0.92):
    cloth[np.abs(u - y0) < 0.012] = (0.92, 0.9, 0.84)
# (the handle's ho wood: pale greenish cream, fine straight grain along it)
hgrain = np.sin((v + (fbm(N, 2, 8, 3) - 0.5) * 0.04) * 2 * np.pi * 40) * 0.5 + 0.5
handle_wood = mix((0.82, 0.76, 0.6), (0.7, 0.63, 0.47), smooth(0.6, 1.0, hgrain) * 0.5).astype(np.float32)
M = {
    "steel": pbr("KnifeSteel", (1, 1, 1), tex=image("knife_steel", steel), rough=0.3, metal=0.6),
    "spine": pbr("KnifeSpine", lin("#4a4c50"), rough=0.4, metal=0.8),
    "handle": pbr("KnifeHandle", (1, 1, 1), tex=image("knife_handle", handle_wood), rough=0.55),
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


def interp(pts, x):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            t = t * t * (3 - 2 * t) if len(pts) > 2 else t
            return y0 + (y1 - y0) * t
    return pts[-1][1]


def blade(name, edge, spine, length, thick, at_y):
    """a blade from its edge and spine lines (y across it at each x along it), lying flat: a grid of three rows across, the edge, the
    bevel's line (shinogi) a third of the way up and the spine, so the polished bevel shows as its own face; thin at the edge, full at the
    bevel's line and the spine, thinning toward the tip; a short neck (machi) running back into the handle"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    NX, rows = 48, (0.0, 0.33, 1.0)
    grid = []
    for i in range(NX + 1):
        x = length * i / NX
        e, s_ = interp(edge, x), interp(spine, x)
        taper = 1 - 0.65 * (x / length) ** 2
        col = []
        for j, f in enumerate(rows):
            y = e + (s_ - e) * f
            t = thick * taper * (0.06 if j == 0 else (0.92 if j == 1 else 1.0))
            col.append((bm.verts.new((x, y + at_y, 0.012 + t / 2)), bm.verts.new((x, y + at_y, 0.012 - t / 2)), f))
        grid.append(col)

    def face(vs, uvs):
        if len(set(vs)) < 3:
            return
        try:
            fc = bm.faces.new(vs)
        except ValueError:
            return
        for l, uv in zip(fc.loops, uvs):
            l[uvl].uv = uv
    for i in range(NX):
        u0, u1 = i / NX, (i + 1) / NX
        for j in range(len(rows) - 1):
            a, b_, c, d = grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]
            face((a[0], b_[0], c[0], d[0]), ((u0, a[2]), (u1, b_[2]), (u1, c[2]), (u0, d[2])))
            face((d[1], c[1], b_[1], a[1]), ((u0, d[2]), (u1, c[2]), (u1, b_[2]), (u0, a[2])))
        for j in (0, len(rows) - 1):
            a, b_ = grid[i][j], grid[i + 1][j]
            face((a[0], a[1], b_[1], b_[0]), ((u0, rows[j]), (u0, rows[j]), (u1, rows[j]), (u1, rows[j])))
    for i in (0, NX):
        col = grid[i]
        for j in range(len(rows) - 1):
            face((col[j][0], col[j + 1][0], col[j + 1][1], col[j][1]), ((i / NX, rows[j]),) * 2 + ((i / NX, rows[j + 1]),) * 2)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    fin(o, name, M["steel"], smooth=False)
    # (the neck: a short square of the spine's steel from the heel back into the ferrule)
    w = interp(spine, 0) - interp(edge, 0)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.012, at_y + interp(edge, 0) + w * 0.62, 0.012))
    nk = active(); nk.scale = (0.026, w * 0.28, thick * 0.9)
    fin(nk, name + "Neck", M["spine"], smooth=False)


def handle(name, x0, length, r, at_y):
    """an octagonal wa-handle of ho wood from x0 back along -x, tapering a little toward its butt, its edges eased, a buffalo-horn ferrule
    at the blade end"""
    FER = 0.03
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r * 0.9, radius2=r, depth=length, location=(x0 - FER - length / 2 - 0.02, at_y, 0.012 + r * 0.25),
                                    rotation=(0, math.pi / 2, 0))
    o = active(); o.scale = (0.82, 1, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(o, 0.0012, 2, angle=False)
    bpy.ops.object.modifier_apply(modifier="Bevel")
    # (the grain along it: u round it, v along it)
    bm = bmesh.new(); bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            c = l.vert.co
            l[uvl].uv = (math.atan2(c.z, c.y) / (2 * math.pi) + 0.5, c.x * 4)
    bm.to_mesh(o.data); bm.free()
    fin(o, name, M["handle"], smooth=False)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r * 1.02, radius2=r * 1.06, depth=FER, location=(x0 - FER / 2 - 0.02, at_y, 0.012 + r * 0.25),
                                    rotation=(0, math.pi / 2, 0))
    o = active(); o.scale = (0.82, 1, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(o, 0.001, 2, angle=False)
    bpy.ops.object.modifier_apply(modifier="Bevel")
    fin(o, name + "Ferrule", M["horn"], smooth=False)


import mathutils
# (each knife built lying flat as before, at width 0, then stood up on its edge (its width up, z) and set in its place on the board)
UP = mathutils.Matrix.Rotation(math.pi / 2, 4, "X")


def stand(names, x, z):
    """the parts named, turned up on their edges and moved to x along the board, their edge at height z, out in front of it"""
    # (each part's matrix brought up to date first: one just scaled still holds its old one till the scene's updated, and would lose its size)
    bpy.context.view_layer.update()
    for o in parts:
        if o.name in names:
            o.matrix_world = mathutils.Matrix.Translation((x, -0.03, z)) @ UP @ o.matrix_world


# (yanagiba: long and slender, its edge straight, sweeping up into a fine point near the spine)
blade("KnifeYanagiba", [(0, 0), (0.2, 0.0), (0.28, 0.01), (0.29, 0.016)], [(0, 0.033), (0.2, 0.033), (0.27, 0.026), (0.29, 0.016)], 0.29, 0.0042, 0.0)
handle("KnifeYanagibaHandle", 0.0, 0.14, 0.0125, 0.016)
# (deba: short and broad, a strong curved belly rising to its point, a thick spine)
blade("KnifeDeba", [(0, 0), (0.07, -0.001), (0.12, 0.004), (0.152, 0.016), (0.168, 0.034)], [(0, 0.052), (0.08, 0.054), (0.14, 0.05), (0.168, 0.034)], 0.168, 0.008, 0.0)
handle("KnifeDebaHandle", 0.0, 0.12, 0.016, 0.028)
# (nakiri: a straight edge and spine, its square end just eased)
blade("KnifeNakiri", [(0, 0), (0.16, 0.0), (0.168, 0.006)], [(0, 0.05), (0.16, 0.05), (0.168, 0.044)], 0.168, 0.0032, 0.0)
handle("KnifeNakiriHandle", 0.0, 0.12, 0.013, 0.027)
# (each maker's mark stamped near the heel: a small round seal and a short line of signature beside it)
for i, (name, y, th) in enumerate((("KnifeYanagiba", 0.017, 0.0042), ("KnifeDeba", 0.028, 0.008), ("KnifeNakiri", 0.027, 0.0032))):
    zt = 0.012 + th / 2 + 0.0002
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.0042, depth=0.0006, location=(0.028, y, zt))
    fin(active(), f"{name}Mark", M["mark"], smooth=False)
    for k in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.04 + k * 0.006, y, zt))
        o = active(); o.scale = (0.0035, 0.0012, 0.0005)
        fin(o, f"{name}Sign{k}", M["mark"], smooth=False)
# (on the board: the yanagiba and the nakiri end to end along the upper row, the deba below; handles toward -x)
# (a hand's width between the yanagiba's tip and the nakiri's handle: nothing runs through anything)
stand({n for n in (o.name for o in parts) if n.startswith("KnifeYanagiba")}, -0.2, 0.072)
stand({n for n in (o.name for o in parts) if n.startswith("KnifeNakiri")}, 0.33, 0.07)
stand({n for n in (o.name for o in parts) if n.startswith("KnifeDeba")}, -0.02, 0.0)
# ---- the board: pale hinoki, its edges eased, a bar of dark walnut across it behind each row, brass screws at its corners
M["board"] = pbr("KnifeBoard", lin("#d9c39a"), rough=0.55)
M["bar"] = pbr("KnifeBar", lin("#3a2618"), rough=0.4, coat=0.3)
M["screw"] = pbr("KnifeScrew", lin("#c9a24a"), rough=0.3, metal=1.0)
BW, BH, BD, BX = 0.92, 0.13, 0.014, 0.06
bpy.ops.mesh.primitive_cube_add(size=1, location=(BX, -BD / 2, 0.055))
o = active(); o.scale = (BW, BD, BH)
bevel(o, 0.003, 2, angle=False)
bpy.ops.object.modifier_apply(modifier="Bevel")
fin(o, "KnifeBoard", M["board"], smooth=False)
for k, z in enumerate((0.1, 0.025)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(BX, -BD - 0.006, z))
    o = active(); o.scale = (BW - 0.06, 0.012, 0.022)
    bevel(o, 0.002, 2, angle=False)
    bpy.ops.object.modifier_apply(modifier="Bevel")
    fin(o, f"KnifeBar{k}", M["bar"], smooth=False)
for x in (BX - BW / 2 + 0.018, BX + BW / 2 - 0.018):
    for z in (0.055 - BH / 2 + 0.014, 0.055 + BH / 2 - 0.014):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0045, depth=0.004, location=(x, -BD - 0.0015, z), rotation=(math.pi / 2, 0, 0))
        fin(active(), "KnifeScrew", M["screw"], smooth=False)

root = bpy.data.objects.new("KnifeSet", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.25, -1.25, 0.45)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (1.1, 0.0, 0.35)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.45, 0.45, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "knives.glb"), os.path.join(PROJECT, "blender", "knives.blend"), PREVIEW)
print("KNIVES_DONE", sum(len(o.data.polygons) for o in parts))
