"""What's kept on the till counter's low shelf: two corrugated cardboard boxes (one of paper bags, one of till rolls), their flaps shut with
packing tape, printed on their sides; and on the bigger one the register's operating manual, a stapled booklet.

Run:
    blender -b --factory-startup --python blender/tillboxes.py -- <project path> [preview.png]
Writes public/models/tillboxes.glb and blender/tillboxes.blend.

Frame: the till's own (GuestBar3D's Register group: +y up, the shelf's top at y 0.115, the cashier's side +z). Blender gets (x, -z, y).
Node names the game looks for:
    TillManual  the manual (clicked, it opens)
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

seed(9)
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


FONT_ZH = "C:/Windows/Fonts/msjhbd.ttc"
FONT_JA = "C:/Windows/Fonts/YuGothB.ttc"
ZH = bpy.data.fonts.load(FONT_ZH) if os.path.exists(FONT_ZH) else None
JA = bpy.data.fonts.load(FONT_JA) if os.path.exists(FONT_JA) else ZH

# =====================================================================
# Textures and materials
# =====================================================================
N = 256
u, v = grid01(N)
fib = fbm(N, 40, 40, 3)
# (kraft board: a warm brown, fibres, a few darker scuffs and water marks)
kraft = mix((0.62, 0.45, 0.27), (0.70, 0.53, 0.33), fib)
scuff = smooth(0.72, 0.9, fbm(N, 5, 5, 4))
kraft = mix(kraft, (0.5, 0.35, 0.2), scuff * 0.35)
kraft_tex = image("kraft", kraft)
M = {
    "kraft": pbr("BoxKraft", (1, 1, 1), tex=kraft_tex, rough=0.9),
    "kraftEdge": pbr("BoxKraftEdge", (0.5, 0.36, 0.21), rough=0.9),
    "tape": pbr("BoxTape", (0.62, 0.43, 0.2), rough=0.35),
    "ink": pbr("BoxInk", (0.08, 0.06, 0.05), rough=0.8),
    "red": pbr("BoxRed", (0.5, 0.06, 0.05), rough=0.7),
    "cover": pbr("ManualCover", (0.09, 0.2, 0.36), rough=0.5),
    "band": pbr("ManualBand", (0.85, 0.82, 0.74), rough=0.6),
    "pages": pbr("ManualPages", (0.93, 0.91, 0.86), rough=0.9),
    "white": pbr("ManualInk", (0.95, 0.94, 0.9), rough=0.6),
    "staple": pbr("ManualStaple", (0.7, 0.72, 0.74), rough=0.3, metal=1.0),
}


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def box(name, size, at, mat, bev=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat, smooth_shade=False)
    if bev:
        bevel(o, bev, 2, angle=False)
        apply_mods(o)
    return o


def uv_box(o, size=0.3):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def text(name, body, size, mat, at, rot, font=None, align="CENTER", fit=None):
    bpy.ops.object.text_add(location=at, rotation=rot)
    t = active()
    t.data.body = body.replace("/", "\n")
    t.data.size = size
    t.data.align_x = align
    t.data.align_y = "CENTER"
    t.data.extrude = 0.0002
    if font:
        t.data.font = font
    bpy.ops.object.convert(target="MESH")
    t = active()
    if fit and t.dimensions.x > fit:
        t.scale.x = fit / t.dimensions.x
        apply_scale(t)
    return finish(t, name, mat, smooth_shade=False)


parts = []
SHELF = 0.115

# =====================================================================
# A cardboard box: its body, the seam where the top flaps meet, a strip of tape over the seam and down the ends, its printing
# =====================================================================
FRONT = (math.pi / 2, 0, math.pi)  # a text facing the cashier (+z three = Blender -y... turned to face +z): see note below


def cardboard(name, at, w, h, d, label_zh, label_ja, sub):
    x0, z0 = at
    cy = SHELF + h / 2
    b = box(name, S(w, h, d), P(x0, cy, z0), M["kraft"], bev=0.004)
    uv_box(b)
    parts.append(b)
    top = SHELF + h
    # (the seam between the two long flaps, along its middle, a hair dark)
    parts.append(box(f"{name}Seam", S(w - 0.01, 0.0008, 0.0016), P(x0, top + 0.0002, z0), M["kraftEdge"]))
    # (the tape: across the seam's length, folded down over both ends a little way)
    parts.append(box(f"{name}Tape", S(w + 0.004, 0.0012, 0.05), P(x0, top + 0.0006, z0), M["tape"]))
    for sx in (-1, 1):
        parts.append(box(f"{name}TapeEnd{sx}", S(0.0012, 0.05, 0.05), P(x0 + sx * (w / 2 + 0.0006), top - 0.025, z0), M["tape"]))
    # (its printing on the side toward the cashier: what's in it in Chinese and Japanese, a line of detail, the this-way-up arrows)
    fz = z0 + d / 2 + 0.0004
    parts.append(text(f"{name}LabelZh", label_zh, h * 0.2, M["ink"], P(x0, cy + h * 0.17, fz), (math.pi / 2, 0, 0), ZH, fit=w * 0.8))
    parts.append(text(f"{name}LabelJa", label_ja, h * 0.12, M["ink"], P(x0, cy - h * 0.06, fz), (math.pi / 2, 0, 0), JA, fit=w * 0.8))
    parts.append(text(f"{name}Sub", sub, h * 0.07, M["ink"], P(x0, cy - h * 0.25, fz), (math.pi / 2, 0, 0), JA, fit=w * 0.8))
    for k in (-1, 1):
        parts.append(text(f"{name}Up{k}", "↑↑", h * 0.11, M["red"], P(x0 + k * w * 0.36, cy + h * 0.28, fz), (math.pi / 2, 0, 0), ZH))
    return top


top1 = cardboard("TillBoxBags", (-0.3, 0.12), 0.22, 0.11, 0.16, "紙袋", "手さげ紙袋", "M サイズ ・ 100 枚入")
cardboard("TillBoxRolls", (0.05, 0.1), 0.14, 0.09, 0.12, "收銀紙捲", "レジロール", "58 mm × 20 巻")

# =====================================================================
# The manual: a stapled booklet lying on the bags' box, turned a little
# =====================================================================
BW, BD, BT = 0.12, 0.155, 0.009
book = bpy.data.objects.new("TillManual", None)
bpy.context.collection.objects.link(book)
book.location = P(-0.3, top1 + 0.0006, 0.115)
book.rotation_euler = (0, 0, 0.12)
bk = []
# (the pages, a little in from the cover's edges, and the soft cover over and under them)
bk.append(box("ManualPages", S(BW - 0.004, BT - 0.0016, BD - 0.004), P(0.001, BT / 2, 0), M["pages"]))
bk.append(box("ManualCoverTop", S(BW, 0.0008, BD), P(0, BT - 0.0004, 0), M["cover"], bev=0.0003))
bk.append(box("ManualCoverBottom", S(BW, 0.0008, BD), P(0, 0.0004, 0), M["cover"], bev=0.0003))
bk.append(box("ManualSpine", S(0.0016, BT, BD), P(-BW / 2 - 0.0002, BT / 2, 0), M["cover"], bev=0.0004))
# (the staples in the spine's fold)
for k in (-1, 1):
    bk.append(box(f"ManualStaple{k}", S(0.0012, 0.0006, 0.014), P(-BW / 2 + 0.006, BT + 0.0001, k * 0.04), M["staple"]))
# (the cover: a pale band across with the title, the Japanese under it, a line of small print at the foot, a register drawn in white)
CT = BT + 0.0002
bk.append(box("ManualBand", S(BW - 0.012, 0.0003, 0.05), P(0.004, CT, -0.03), M["band"]))
bk.append(text("ManualTitle", "收銀機操作說明書", 0.0115, M["ink"], P(0.004, CT + 0.0003, -0.037), (0, 0, 0), ZH, fit=BW - 0.022))
bk.append(text("ManualTitleJa", "レジスター 取扱説明書", 0.0068, M["ink"], P(0.004, CT + 0.0003, -0.019), (0, 0, 0), JA, fit=BW - 0.03))
bk.append(text("ManualFoot", "闊野 日式烤魚　店內用", 0.0055, M["white"], P(0.004, CT, 0.064), (0, 0, 0), ZH, fit=BW - 0.03))
# (the little register on the cover: its body, its display on a stalk, a grid of keys)
bk.append(box("ManualPicBody", S(0.05, 0.0002, 0.026), P(0.004, CT, 0.03), M["white"]))
bk.append(box("ManualPicStalk", S(0.003, 0.0002, 0.012), P(0.02, CT, 0.012), M["white"]))
bk.append(box("ManualPicDisplay", S(0.022, 0.0002, 0.008), P(0.02, CT, 0.004), M["white"]))
for i in range(5):
    for j in range(3):
        bk.append(box(f"ManualPicKey{i}{j}", S(0.006, 0.0002, 0.004), P(-0.012 + i * 0.008, CT + 0.0001, 0.026 + j * 0.006), M["cover"]))
for o in bk:
    o.parent = book

root = bpy.data.objects.new("TillBoxes", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
book.parent = root
parts += [book] + bk

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (-0.05, -0.75, 0.55)
    cam.rotation_euler = (Vector((-0.15, -0.1, 0.17)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((0.8, -1.2, 1.5), 300), ((-1.2, -0.5, 0.6), 100), ((0, 1.5, 1), 80)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 1.2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "tillboxes.glb"), os.path.join(PROJECT, "blender", "tillboxes.blend"), PREVIEW)
print("TILLBOXES_DONE", len(parts), "parts")
