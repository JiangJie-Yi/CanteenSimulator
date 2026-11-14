"""Shochu (燒酒) and its little glasses beside the sake stand (item 107, the owner's, 2026-11-14: "beside it, shochu glasses and shochu"):
shochu.glb, node "ShochuSet": a small black-lacquered tray, a 360 ml bottle of green glass with a paper label, and three small straight
shot glasses, each with the drink in it to be filled as it's poured (its liquid a node of its own, scaled up from its floor). In metres,
z up, the tray's middle at the origin, its front toward -y; drawn by the game at the sake stand's size.

Low-poly by docs/LOWPOLY.md: lathes 16 round, their ends laddered (no fan into a point); the label's lettering painted, not modelled. The
make is the shop's own, generic: 燒酒 and the shop's seal, no brand.

Run:
    blender -b --factory-startup --python blender/shochu.py -- <project path> [preview.png]
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

NA = 16


def lin(hexs):
    """a hex colour to linear rgb"""
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


FONTS = ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc")
_glyphs = {}


def glyph(ch):
    if ch in _glyphs:
        return _glyphs[ch]
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = bpy.context.view_layer.objects.active
    tx.data.body = ch
    for f in FONTS:
        if os.path.exists(f):
            tx.data.font = bpy.data.fonts.load(f, check_existing=True)
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
    _glyphs[ch] = tris
    return tris


def fill_tris(mask, tris, cx, cy, sx, sy):
    H_, W_ = mask.shape
    for t in tris:
        P_ = [(cx + x * sx, cy + y * sy) for x, y in t]
        x0, x1 = int(max(0, min(p[0] for p in P_))), int(min(W_ - 1, max(p[0] for p in P_) + 1))
        y0, y1 = int(max(0, min(p[1] for p in P_))), int(min(H_ - 1, max(p[1] for p in P_) + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
        (ax, ay), (bx, by), (qx, qy) = P_
        d1 = (gx - bx) * (ay - by) - (ax - bx) * (gy - by)
        d2 = (gx - qx) * (by - qy) - (bx - qx) * (gy - qy)
        d3 = (gx - ax) * (qy - ay) - (qx - ax) * (gy - ay)
        mask[y0:y1 + 1, x0:x1 + 1] |= ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))


# ---- the label's picture: round the bottle once (u), up it (v); its front at u = 0.75 (toward -y)
LW, LH = 512, 256
u = np.tile((np.arange(LW) + 0.5) / LW, (LH, 1))
v = np.tile(((np.arange(LH) + 0.5) / LH)[:, None], (1, LW))
paper = mix((0.95, 0.94, 0.9), (0.9, 0.89, 0.84), fbm(LW, 12, 6, 3)[:LH, :] * 0.6)
# (a green band top and bottom, a fine gold line inside each)
band = (v < 0.12) | (v > 0.88)
paper[band] = (0.12, 0.36, 0.2)
gl = (np.abs(v - 0.15) < 0.012) | (np.abs(v - 0.85) < 0.012)
paper[gl] = (0.74, 0.6, 0.3)
# (燒酒 big down the front, the shop's red seal under it)
mask = np.zeros((LH * 2, LW * 2), bool)
for i, ch in enumerate("燒酒"):
    fill_tris(mask, glyph(ch), 0.75 * LW * 2, (0.62 - i * 0.3) * LH * 2, 0.25 * LH * 2 * 0.45, 0.25 * LH * 2)
cov = mask.reshape(LH, 2, LW, 2).mean(axis=(1, 3))
paper = mix(paper, (0.08, 0.07, 0.06), cov)
seal = np.sqrt(((u - 0.82) * LW / LH) ** 2 + (v - 0.3) ** 2)
paper = mix(paper, (0.72, 0.1, 0.08), (np.abs(seal - 0.06) < 0.012) | (seal < 0.03))
label_tex = image("ShochuLabelPic", paper)

M = {
    "glass": pbr("ShochuGlass", lin("#2f7d4a"), rough=0.05),
    "label": pbr("ShochuLabel", tex=label_tex, rough=0.6),
    "cap": pbr("ShochuCap", lin("#c9ccd0"), rough=0.3, metal=0.9),
    "liquid": pbr("ShochuLiquid", lin("#e9efe6"), rough=0.05),
    "cup": pbr("ShochuCupGlass", lin("#e8f0f0"), rough=0.05),
    "tray": pbr("ShochuTray", lin("#1b1716"), rough=0.35),
    "trayRim": pbr("ShochuTrayRim", lin("#5a1a14"), rough=0.35),
}


def mesh(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth_
    return o


def lathe(name, prof, mat, at, close_bottom=True, close_top=True, uv=None):
    """a solid of revolution through (radius, height) up from `at`, NA round; its ends laddered closed"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new((at.x + r * math.cos(2 * math.pi * j / NA), at.y + r * math.sin(2 * math.pi * j / NA), at.z + h)) for j in range(NA)]
             for r, h in prof]
    for i in range(len(rings) - 1):
        for j in range(NA):
            jn = (j + 1) % NA
            f = bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
            if uv:
                for lp, (a, b) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                    lp[uvl].uv = uv(a / NA, b)
    if close_bottom:
        ladder_fill(bm, rings[0][::-1])
    if close_top:
        ladder_fill(bm, rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh(name, bm, mat)


root = bpy.data.objects.new("ShochuSet", None)
bpy.context.collection.objects.link(root)
nodes = []


def node(name, parts, at):
    """the parts joined into one node, its origin at `at` (its foot's middle)"""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    bpy.context.scene.cursor.location = at
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o.parent = root
    nodes.append(o)
    return o


# ---- the tray: a black-lacquered board with a low red-lacquered rim
TW, TD, TT = 0.22, 0.11, 0.008
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, TT / 2))
tr = bpy.context.view_layer.objects.active; tr.scale = (TW, TD, TT)
bpy.ops.object.transform_apply(scale=True)
tr.data.materials.append(M["tray"])
rims = []
for sx, sy, w, d in ((0, -1, TW, 0.006), (0, 1, TW, 0.006), (-1, 0, 0.006, TD - 0.012), (1, 0, 0.006, TD - 0.012)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * (TW / 2 - 0.003), sy * (TD / 2 - 0.003), TT + 0.005))
    r_ = bpy.context.view_layer.objects.active; r_.scale = (w, d, 0.01)
    bpy.ops.object.transform_apply(scale=True)
    r_.data.materials.append(M["trayRim"])
    rims.append(r_)
node("ShochuTray", [tr] + rims, Vector((0, 0, 0)))

# ---- the bottle: 360 ml of green glass, its paper label round its body, a screw cap
BX = -TW / 2 + 0.045
PROF = ((0.028, 0.0), (0.032, 0.006), (0.032, 0.15), (0.026, 0.178), (0.0135, 0.2), (0.0135, 0.214), (0.0145, 0.216), (0.0145, 0.232))
glass = lathe("ShochuBottleGlass", PROF[:6], M["glass"], Vector((BX, 0, TT)))
cap = lathe("ShochuCapM", ((0.0145, 0.212), (0.0145, 0.232), (0.0105, 0.234)), M["cap"], Vector((BX, 0, TT)), close_bottom=False)
lab = lathe("ShochuLabelM", ((0.0326, 0.045), (0.0326, 0.125)), M["label"], Vector((BX, 0, TT)), close_bottom=False, close_top=False,
            uv=lambda a, b: (a, b))
bottle = node("ShochuBottle", [glass, cap, lab], Vector((BX, 0, TT)))
liq = lathe("ShochuLiquid", ((0.029, 0.004), (0.029, 0.15), (0.023, 0.172)), M["liquid"], Vector((BX, 0, TT)))
bpy.context.scene.cursor.location = Vector((BX, 0, TT))
bpy.ops.object.select_all(action="DESELECT"); liq.select_set(True); bpy.context.view_layer.objects.active = liq
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
liq.parent = bottle
liq.matrix_parent_inverse = bottle.matrix_world.inverted()

# ---- three shot glasses: straight, thick-bottomed, a little wider at the lip, open; the drink in each its own node from its floor
for k in range(3):
    cx = BX + 0.06 + k * 0.045
    at = Vector((cx, 0.006 * (1 - k), TT))
    outer = ((0.017, 0.0), (0.0195, 0.002), (0.022, 0.05))
    inner = ((0.0195, 0.05), (0.0175, 0.012), (0.0, 0.012))
    bm = bmesh.new()
    rings = [[bm.verts.new((at.x + r * math.cos(2 * math.pi * j / NA), at.y + r * math.sin(2 * math.pi * j / NA), at.z + h)) for j in range(NA)]
             for r, h in outer + inner[:2]]
    for i in range(len(rings) - 1):
        for j in range(NA):
            jn = (j + 1) % NA
            bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
    ladder_fill(bm, rings[0][::-1])
    ladder_fill(bm, rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cup = node(f"ShochuCup{k}", [mesh(f"ShochuCupM{k}", bm, M["cup"])], at.copy())
    lq = lathe(f"ShochuCupLiquid{k}", ((0.0172, 0.0122), (0.0185, 0.042)), M["liquid"], at)
    bpy.context.scene.cursor.location = at + Vector((0, 0, 0.0122))
    bpy.ops.object.select_all(action="DESELECT"); lq.select_set(True); bpy.context.view_layer.objects.active = lq
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    lq.parent = cup
    lq.matrix_parent_inverse = cup.matrix_world.inverted()

allp = [o for o in bpy.data.objects if o.type == "MESH"]
print("SHOCHU_TRIS", sum(len(p.vertices) - 2 for o in allp for p in o.data.polygons))
export_dish(root, allp + [root], os.path.join(PROJECT, "public", "models", "shochu.glb"), os.path.join(PROJECT, "blender", "shochu.blend"), PREVIEW)
print("SHOCHU_DONE")
