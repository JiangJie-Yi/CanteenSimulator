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
from common import export_dish, grid01, image, ladder_fill, mix, pbr, smooth  # noqa: E402

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
# (as the shop's big cat at the door has it (item 118, the owner's, 2026-11-15: "not much like one: go by the one in the red circle"): small
# narrow eyes closed in a smile, set wide and low, fine ink lines; a little pink nose, a fine ω mouth, whiskers drawn thin)
CX, CY = 0.5, 0.42
for sx in (-1, 1):
    ex, ey, r = CX + sx * 0.2, CY + 0.07, 0.06
    d = np.hypot(u - ex, (v - ey) * 1.6)
    ang = np.arctan2(v - ey, u - ex)
    arc = (np.abs(d - r) < 0.008 * (0.35 + 0.65 * np.sin(np.clip(ang, 0, math.pi)))) & (v > ey + 0.008)
    stroke(arc.astype(np.float32), INK)
for sx in (-1, 1):
    d = np.hypot(u - (CX + sx * 0.25), (v - (CY - 0.02)) * 1.5)
    stroke(smooth(0.06, 0.0, d) * 0.45, (0.96, 0.6, 0.6))
d = np.hypot(u - CX, (v - (CY - 0.005)) * 1.7)
stroke((d < 0.022).astype(np.float32), (0.92, 0.48, 0.55))
for sx in (-1, 1):
    mx, my = CX + sx * 0.03, CY - 0.045
    d = np.hypot(u - mx, v - my)
    stroke(((np.abs(d - 0.03) < 0.005) & (v < my)).astype(np.float32), INK)
for sx in (-1, 1):
    for k, tilt in enumerate((0.14, 0.0, -0.14)):
        x0, y0 = CX + sx * 0.3, CY - 0.0 + 0.025 * (1 - k)
        t = (u - x0) * sx
        line = (t > 0) & (t < 0.15) & (np.abs((v - y0) - t * tilt) < 0.003)
        stroke(line.astype(np.float32), INK, 0.75)
# (inside the ears' fronts, the pink: the ears' own material)
face_img = image("ownluckycat_face", np.clip(face, 0, 1))
# (the koban's face: gold, a raised rim, 千萬兩 written down it in black (the reference's coin), straight on)
FONTS = ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc")


def glyph(ch):
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = bpy.context.view_layer.objects.active
    tx.data.body = ch
    for f_ in FONTS:
        if os.path.exists(f_):
            tx.data.font = bpy.data.fonts.load(f_, check_existing=True)
            break
    tx.data.size = 1.0
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    tx.data.resolution_u = 5
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    bm_ = bmesh.new(); bm_.from_mesh(o.data)
    bmesh.ops.triangulate(bm_, faces=bm_.faces[:])
    tris = [[(lp.vert.co.x, lp.vert.co.y) for lp in f.loops] for f in bm_.faces]
    bm_.free()
    bpy.data.objects.remove(o)
    return tris


def fill_tris(mask, tris, cx, cy, sx, sy):
    H_, W_ = mask.shape
    for t in tris:
        P_ = [(cx + x * sx, cy + y * sy) for x, y in t]
        x0, x1 = int(max(0, min(p_[0] for p_ in P_))), int(min(W_ - 1, max(p_[0] for p_ in P_) + 1))
        y0, y1 = int(max(0, min(p_[1] for p_ in P_))), int(min(H_ - 1, max(p_[1] for p_ in P_) + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
        (ax, ay), (bx, by), (qx, qy) = P_
        d1 = (gx - bx) * (ay - by) - (ax - bx) * (gy - by)
        d2 = (gx - qx) * (by - qy) - (bx - qx) * (gy - qy)
        d3 = (gx - ax) * (qy - ay) - (qx - ax) * (gy - ay)
        mask[y0:y1 + 1, x0:x1 + 1] |= ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))


KN = 256
ku, kv = grid01(KN)
kob = mix((0.86, 0.66, 0.2), (0.98, 0.82, 0.36), smooth(0.9, 0.2, np.hypot((ku - 0.5) * 1.4, kv - 0.5) * 2))
ring = np.hypot((ku - 0.5) / 0.47, (kv - 0.5) / 0.47)
kob = mix(kob, (0.62, 0.44, 0.1), (np.abs(ring - 0.88) < 0.03).astype(np.float32))
km = np.zeros((KN * 2, KN * 2), bool)
for i_, ch in enumerate("千萬兩"):
    fill_tris(km, glyph(ch), KN, (0.78 - i_ * 0.28) * KN * 2, 0.34 * KN, 0.25 * KN * 2)
kob = mix(kob, (0.1, 0.07, 0.04), km.reshape(KN, 2, KN, 2).mean(axis=(1, 3)))
koban_img = image("ownluckycat_koban", np.clip(kob, 0, 1))

M = {
    "skin": pbr("OwnCatFace", (1, 1, 1), tex=face_img, rough=0.55),
    "white": pbr("OwnCatWhite", lin("#f6f4ee"), rough=0.55),
    "orange": pbr("OwnCatOrange", lin("#e89a3c"), rough=0.55),
    "black": pbr("OwnCatBlack", lin("#2a2522"), rough=0.55),
    "pink": pbr("OwnCatPink", lin("#f2a3ac"), rough=0.6),
    "red": pbr("OwnCatCollar", lin("#c8241c"), rough=0.5),
    "gold": pbr("OwnCatGold", lin("#e0b23a"), rough=0.3, metal=0.8),
    "earIn": pbr("OwnCatEarIn", lin("#d23a2a"), rough=0.6),
    "koban": pbr("OwnCatKoban", (1, 1, 1), tex=koban_img, rough=0.35),
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
HEAD_C, HEAD_R = (0.0, -0.004, 0.212), (0.108, 0.084, 0.07)
head = qsphere(bm, HEAD_C, HEAD_R, 3)
body = qsphere(bm, (0.0, 0.006, 0.094), (0.088, 0.078, 0.1), 2)
# (the body broad at its foot, drawn in toward the head: as the reference cat sits, a bell shape)
for f in body:
    for vv in f.verts:
        k_ = 1 + 0.22 * max(0.0, 1 - vv.co.z / 0.16)
        vv.co.x *= k_; vv.co.y = 0.006 + (vv.co.y - 0.006) * k_
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
    elif rel.x > 0.03 and rel.z > 0.01:
        # (an orange patch over its right brow and back over the crown, a black one over the left ear's root)
        f.material_index = MI["orange"]
    elif rel.x < -0.045 and rel.z > 0.02:
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
# (the ears: bigger pyramids set out at the head's top corners, leaning out; their fronts red inside (the reference's); the left black, the
# right white)
for sx in (-1, 1):
    base = [bm.verts.new((sx * 0.045, -0.034, 0.262)), bm.verts.new((sx * 0.104, -0.014, 0.236)), bm.verts.new((sx * 0.078, 0.034, 0.25))]
    tip = bm.verts.new((sx * 0.098, -0.01, 0.318))
    fr = bm.faces.new((base[0], base[1], tip) if sx > 0 else (base[1], base[0], tip))
    fr.material_index = MI["earIn"]
    for a, b in ((base[1], base[2]), (base[2], base[0])):
        f = bm.faces.new((a, b, tip) if sx > 0 else (b, a, tip))
        f.material_index = MI["white"] if sx > 0 else MI["black"]
# (the tail: a short oval curled round its back at the foot)
for f in qsphere(bm, (0.05, 0.075, 0.03), (0.055, 0.022, 0.018), 1):
    f.material_index = MI["orange"]
# (the right paw at its chest, holding the koban: behind the coin, its edge showing past the coin's left (it went through the coin's face))
for f in qsphere(bm, (-0.056, -0.07, 0.1), (0.03, 0.026, 0.028), 1):
    f.material_index = MI["white"]
# (its hind feet in front at the foot)
for sx in (-1, 1):
    for f in qsphere(bm, (sx * 0.052, -0.084, 0.018), (0.032, 0.03, 0.018), 1):
        f.material_index = MI["white"]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatBody", bm)

# ---- the collar: a ring round the neck 16 round, 3 across; the bell under its front
bm = bmesh.new()
RING, SEG, R0, RT = 16, 3, 0.084, 0.007
rows = []
for j in range(SEG):
    a = 2 * math.pi * j / SEG
    rows.append([bm.verts.new((math.cos(2 * math.pi * i / RING) * (R0 + RT * math.cos(a)), math.sin(2 * math.pi * i / RING) * (R0 * 0.9 + RT * math.cos(a)),
                               0.15 + RT * math.sin(a))) for i in range(RING)])
for j in range(SEG):
    for i in range(RING):
        f = bm.faces.new((rows[j][i], rows[j][(i + 1) % RING], rows[(j + 1) % SEG][(i + 1) % RING], rows[(j + 1) % SEG][i]))
        f.material_index = MI["red"]
for f in qsphere(bm, (0.0, -0.086, 0.134), (0.019, 0.017, 0.019), 1):
    f.material_index = MI["gold"]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatCollar", bm)

# ---- the koban held to its chest: a flat lens of an oval (a quad sphere pressed thin: closed, no seam), gold, tipped back a little
bm = bmesh.new()
uvk = bm.loops.layers.uv.new()
for f in qsphere(bm, (0.0, 0.0, 0.0), (0.034, 0.0055, 0.048), 2):
    f.material_index = MI["koban"]
    for l in f.loops:
        l[uvk].uv = (0.5 + l.vert.co.x / 0.068, 0.5 + l.vert.co.z / 0.096)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(0.25, 3, "X"))
bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.03, -0.108, 0.092))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_of("OwnCatKoban", bm)

# ---- the beckoning paw: its own node, its origin at the shoulder (the game swings it about x); the arm up beside the head, its paw's pad pink
SHOULDER = (0.08, -0.03, 0.15)
bm = bmesh.new()
arm = qsphere(bm, (0.006, -0.004, 0.058), (0.034, 0.031, 0.074), 1)
for f in arm:
    c = mid(f)
    f.material_index = MI["white"]
# (the palm's pad: a pink oval just under the toe beans, not the paw's whole front)
for f in qsphere(bm, (0.006, -0.031, 0.094), (0.015, 0.004, 0.012), 1):
    f.material_index = MI["pink"]
for k_ in range(3):
    for f in qsphere(bm, (0.006 + (k_ - 1) * 0.016, -0.032, 0.118 + (0.005 if k_ == 1 else 0)), (0.0068, 0.0045, 0.0068), 1):
        f.material_index = MI["pink"]
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
