"""A beckoning cat of the shop's own (ownluckycat.glb; the owner's, 2026-11-14, item 97: "can you make a lucky cat of your own? and it should
move", "on the first step"): a white calico sat up, its left paw raised and beckoning (its own node, its origin at the shoulder, for the game
to swing), its right holding a gold koban to its chest, a red collar with a gold bell; its face drawn on its head (closed smiling eyes, a pink
nose, the ω mouth, blushing cheeks, whiskers), its calico patches whole faces of the head and the body in orange and black.

Low-poly, built of shapes (docs/MODELING.md): the head and the body quad spheres (a cube's faces cut 4 by 4 and 3 by 3, pushed out round:
no pole of triangles anywhere), the ears pyramids, the collar a ring 16 round, the koban a quad sphere pressed flat. About 650
triangles: the shop's mascot, its outline kept round.

Blender frame: z up, the cat's front toward -y (the game's +z), its foot's middle at the origin; real size, 0.30 tall.

Run:
    blender -b --factory-startup --python blender/ownluckycat.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import export_dish, grid01, image, ladder_fill, pbr, smooth  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# =====================================================================
# The face's picture: on the head's front, projected straight on (u across, v up), white elsewhere
# =====================================================================
N = 512
u, v = grid01(N)
face = np.ones((N, N, 3), np.float32) * np.asarray((0.97, 0.96, 0.93), np.float32)
INK = np.asarray((0.12, 0.09, 0.08), np.float32)


def stroke(mask, colour, k=1.0):
    global face
    face = face * (1 - mask[..., None] * k) + np.asarray(colour, np.float32) * mask[..., None] * k


# (the face's middle at u 0.5, v 0.42 of the head's front; the picture spans the head's width and height)
CX, CY = 0.5, 0.44
# (closed eyes, smiling: two arcs, bowed up, thick in the middle and thin at their ends)
for sx in (-1, 1):
    ex, ey, r = CX + sx * 0.19, CY + 0.06, 0.085
    d = np.hypot(u - ex, (v - ey) * 1.25)
    ang = np.arctan2(v - ey, u - ex)
    arc = (np.abs(d - r) < 0.013 * (0.4 + 0.6 * np.sin(np.clip(ang, 0, math.pi)))) & (v > ey + 0.012)
    stroke(arc.astype(np.float32), INK)
# (the blush under each eye)
for sx in (-1, 1):
    d = np.hypot(u - (CX + sx * 0.27), (v - (CY - 0.06)) * 1.4)
    stroke(smooth(0.075, 0.0, d) * 0.55, (0.95, 0.55, 0.55))
# (the nose: a small pink rounded triangle)
d = np.hypot(u - CX, (v - (CY - 0.03)) * 1.6)
stroke((d < 0.032).astype(np.float32), (0.93, 0.5, 0.55))
# (the ω mouth under it)
for sx in (-1, 1):
    mx, my = CX + sx * 0.045, CY - 0.085
    d = np.hypot(u - mx, v - my)
    stroke(((np.abs(d - 0.045) < 0.008) & (v < my)).astype(np.float32), INK)
# (whiskers: three each side, out from the cheeks, a little fanned)
for sx in (-1, 1):
    for k, tilt in enumerate((0.12, 0.0, -0.12)):
        x0, y0 = CX + sx * 0.33, CY - 0.04 + 0.03 * (1 - k)
        t = (u - x0) * sx
        line = (t > 0) & (t < 0.16) & (np.abs((v - y0) - t * tilt) < 0.0045)
        stroke(line.astype(np.float32), INK, 0.8)
# (inside the ears' fronts, the pink: the ears' own material)
face_img = image("ownluckycat_face", np.clip(face, 0, 1))

M = {
    "skin": pbr("OwnCatFace", (1, 1, 1), tex=face_img, rough=0.55),
    "white": pbr("OwnCatWhite", lin("#f6f4ee"), rough=0.55),
    "orange": pbr("OwnCatOrange", lin("#e89a3c"), rough=0.55),
    "black": pbr("OwnCatBlack", lin("#2a2522"), rough=0.55),
    "pink": pbr("OwnCatPink", lin("#f2a3ac"), rough=0.6),
    "red": pbr("OwnCatCollar", lin("#c8241c"), rough=0.5),
    "gold": pbr("OwnCatGold", lin("#e0b23a"), rough=0.3, metal=0.8),
}
MATS = list(M.values())
MI = {k: i for i, k in enumerate(M)}
parts = []


def obj_of(name, bm, mats=None, origin=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for m in (mats or MATS):
        o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    o.location = origin
    parts.append(o)
    return o


def qsphere(bm, centre, radii, cuts):
    """a quad sphere into bm: a cube's faces cut `cuts`+1 by `cuts`+1, its points pushed out onto the ellipsoid; returns its faces"""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=2.0)
    if cuts:
        bmesh.ops.subdivide_edges(tmp, edges=tmp.edges[:], cuts=cuts, use_grid_fill=True)
    for vv in tmp.verts:
        n = vv.co.normalized()
        vv.co = Vector((centre[0] + n.x * radii[0], centre[1] + n.y * radii[1], centre[2] + n.z * radii[2]))
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    before = set(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return [f for f in bm.faces if f not in before]


def mid(f):
    return f.calc_center_median()


# ---- the head and the body, one mesh: white, the face's picture on the head's front, calico patches
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
HEAD_C, HEAD_R = (0.0, -0.004, 0.222), (0.096, 0.08, 0.076)
head = qsphere(bm, HEAD_C, HEAD_R, 3)
body = qsphere(bm, (0.0, 0.004, 0.092), (0.086, 0.076, 0.092), 2)
for vv in bm.verts:
    if vv.co.z < 0.004:
        vv.co.z = 0.004 if vv.co.z > -0.001 else 0.0
for f in head:
    c = mid(f)
    rel = c - Vector(HEAD_C)
    if rel.y < -0.02:
        # (its front: the face's picture, projected straight on across the head's width and height)
        f.material_index = MI["skin"]
        for l in f.loops:
            p = l.vert.co
            l[uvl].uv = (0.5 + (p.x - HEAD_C[0]) / (2 * HEAD_R[0]), 0.5 + (p.z - HEAD_C[2]) / (2 * HEAD_R[2]))
    elif rel.x > 0.015 and rel.z > -0.01:
        # (a big orange patch over its right brow and back over the crown, a black one over the left ear's root)
        f.material_index = MI["orange"]
    elif rel.x < -0.025 and rel.z > 0.015:
        f.material_index = MI["black"]
    else:
        f.material_index = MI["white"]
for f in body:
    c = mid(f)
    if c.y > -0.01 and c.x > 0.0 and c.z > 0.06:
        f.material_index = MI["orange"]
    elif c.y > 0.0 and c.x < -0.02 and c.z < 0.09:
        f.material_index = MI["black"]
    else:
        f.material_index = MI["white"]
# (the ears: pyramids up off the head's top either side, the left orange, the right black, their fronts pink)
for sx in (-1, 1):
    base = [bm.verts.new((sx * 0.032, -0.03, 0.282)), bm.verts.new((sx * 0.082, -0.016, 0.262)), bm.verts.new((sx * 0.058, 0.03, 0.272))]
    tip = bm.verts.new((sx * 0.07, -0.006, 0.334))
    fr = bm.faces.new((base[0], base[1], tip) if sx > 0 else (base[1], base[0], tip))
    fr.material_index = MI["pink"]
    for a, b in ((base[1], base[2]), (base[2], base[0])):
        f = bm.faces.new((a, b, tip) if sx > 0 else (b, a, tip))
        f.material_index = MI["orange"] if sx > 0 else MI["black"]
# (the tail: a short oval curled round its back at the foot)
for f in qsphere(bm, (0.05, 0.075, 0.03), (0.055, 0.022, 0.018), 1):
    f.material_index = MI["orange"]
# (the right paw at its chest, holding the koban: behind the coin, its edge showing past the coin's left (it went through the coin's face))
for f in qsphere(bm, (-0.05, -0.062, 0.112), (0.028, 0.024, 0.026), 1):
    f.material_index = MI["white"]
# (its hind feet in front at the foot)
for sx in (-1, 1):
    for f in qsphere(bm, (sx * 0.045, -0.06, 0.018), (0.03, 0.03, 0.018), 1):
        f.material_index = MI["white"]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatBody", bm)

# ---- the collar: a ring round the neck 16 round, 3 across; the bell under its front
bm = bmesh.new()
RING, SEG, R0, RT = 16, 3, 0.072, 0.007
rows = []
for j in range(SEG):
    a = 2 * math.pi * j / SEG
    rows.append([bm.verts.new((math.cos(2 * math.pi * i / RING) * (R0 + RT * math.cos(a)), math.sin(2 * math.pi * i / RING) * (R0 * 0.9 + RT * math.cos(a)),
                               0.163 + RT * math.sin(a))) for i in range(RING)])
for j in range(SEG):
    for i in range(RING):
        f = bm.faces.new((rows[j][i], rows[j][(i + 1) % RING], rows[(j + 1) % SEG][(i + 1) % RING], rows[(j + 1) % SEG][i]))
        f.material_index = MI["red"]
for f in qsphere(bm, (0.0, -0.075, 0.148), (0.016, 0.014, 0.016), 1):
    f.material_index = MI["gold"]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatCollar", bm)

# ---- the koban held to its chest: a flat lens of an oval (a quad sphere pressed thin: closed, no seam), gold, tipped back a little
bm = bmesh.new()
for f in qsphere(bm, (0.0, 0.0, 0.0), (0.034, 0.0055, 0.048), 2):
    f.material_index = MI["gold"]
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(0.25, 3, "X"))
bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.018, -0.094, 0.1))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatKoban", bm)

# ---- the beckoning paw: its own node, its origin at the shoulder (the game swings it about x); the arm up beside the head, its paw's pad pink
SHOULDER = (0.072, -0.03, 0.15)
bm = bmesh.new()
arm = qsphere(bm, (0.004, -0.004, 0.055), (0.03, 0.029, 0.07), 1)
for f in arm:
    c = mid(f)
    # (its palm toward whoever's in front, the pink pad on the paw's front: the arm's front quads up at the paw)
    f.material_index = MI["pink"] if (c.y < -0.022 and c.z > 0.075 and abs(c.x - 0.004) < 0.022) else MI["white"]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatPaw", bm, origin=SHOULDER)

root = bpy.data.objects.new("OwnLuckyCat", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("OWNCAT_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.25, -0.75, 0.3)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0.16)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 60
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.8, 0.2, 0.6)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "ownluckycat.glb"), os.path.join(PROJECT, "blender", "ownluckycat.blend"), PREVIEW)
print("OWNCAT_DONE")
