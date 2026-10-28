"""What's kept on the till counter's low shelf: corrugated cardboard boxes of the shop's supplies (paper bags, till rolls, chopsticks, napkins,
coasters), each its own: its own board (a shade warmer or greyer, newer or more knocked about, white-coated for the chopsticks), its own tape
(kraft paper, clear, or the red "handle with care"), its printing, a shipping label with a barcode on some, a stamp on others; and on the
biggest the register's operating manual, a bound book.

Run:
    blender -b --factory-startup --python blender/tillboxes.py -- <project path> [preview.png]
Writes public/models/tillboxes.glb and blender/tillboxes.blend.

Frame: the till's own (GuestBar3D's Register group: +y up, the shelf's top at y 0.115, the cashier's side +z). Blender gets (x, -z, y).
Node names the game looks for:
    TillManual  the manual (clicked, it opens)
    TillBox<Name>...  each box and everything on it (the game cuts the model up by these)
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

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


def board(name, base, light, wear, seed_):
    """a box's board: its own shade, the faint ribs of the flutes showing through the liner, fibres, scuffs and water marks as worn as `wear`"""
    seed(seed_)
    f = fbm(N, 40, 40, 3)
    c = mix(base, light, f)
    # (the flutes under the liner: faint stripes one way)
    c = c * (1 - 0.035 * (0.5 + 0.5 * np.sin(v * np.pi * 2 * 48)))[..., None]
    sc = smooth(0.7 - 0.12 * wear, 0.9, fbm(N, 5, 5, 4))
    c = mix(c, np.asarray(base) * 0.72, sc * (0.2 + 0.4 * wear))
    # (a water ring or two on the worn ones)
    r = np.random.default_rng(seed_)
    for _ in range(int(wear * 3)):
        cx_, cy_, r_ = r.uniform(0.2, 0.8), r.uniform(0.2, 0.8), r.uniform(0.08, 0.18)
        d_ = np.sqrt((u - cx_) ** 2 + (v - cy_) ** 2)
        ring = smooth(0.012, 0.0, np.abs(d_ - r_)) * 0.5 + (d_ < r_) * 0.08
        c = c * (1 - 0.22 * ring)[..., None]
    return pbr(name, (1, 1, 1), tex=image(name, c), rough=0.92)


def label_tex(name):
    """a shipping label: white paper, a few lines of print, a barcode across its foot"""
    c = np.ones((N, N, 3), np.float32) * 0.95
    for j, (y0, w_) in enumerate(((0.86, 0.7), (0.78, 0.5), (0.71, 0.62), (0.64, 0.4))):
        c[(v > y0) & (v < y0 + 0.035) & (u > 0.08) & (u < 0.08 + w_)] = 0.25 if j == 0 else 0.45
    bars = np.random.default_rng(5).random(70) < 0.5
    col = np.clip(np.floor((u - 0.08) / 0.84 * 70).astype(int), 0, 69)
    on = (u > 0.08) & (u < 0.92) & (v > 0.12) & (v < 0.48)
    c[on & bars[col]] = 0.05
    return pbr(name, (1, 1, 1), tex=image(name, c), rough=0.6)


def fragile_tex(name):
    """the red tape: red, a dashed white stripe along it"""
    c = mix((0.72, 0.1, 0.08), (0.78, 0.14, 0.1), fbm(N, 20, 20, 2))
    c[(v > 0.44) & (v < 0.56) & ((u * 8) % 1 < 0.6)] = (0.96, 0.93, 0.86)
    return pbr(name, (1, 1, 1), tex=image(name, c), rough=0.3)


M = {
    "kraft": pbr("BoxKraft", (1, 1, 1), tex=kraft_tex, rough=0.9),
    "kraftOld": board("BoxKraftOld", (0.52, 0.37, 0.22), (0.6, 0.44, 0.27), 1.0, 21),
    "kraftGrey": board("BoxKraftGrey", (0.58, 0.5, 0.4), (0.66, 0.58, 0.47), 0.4, 22),
    "kraftNew": board("BoxKraftNew", (0.72, 0.53, 0.3), (0.79, 0.6, 0.36), 0.1, 23),
    "coated": board("BoxCoated", (0.86, 0.84, 0.8), (0.92, 0.9, 0.86), 0.3, 24),
    "kraftEdge": pbr("BoxKraftEdge", (0.5, 0.36, 0.21), rough=0.9),
    "tape": pbr("BoxTape", (0.62, 0.43, 0.2), rough=0.35),
    "tapePaper": pbr("BoxTapePaper", (0.74, 0.6, 0.4), rough=0.8),
    "tapeClear": pbr("BoxTapeClear", (0.8, 0.68, 0.5), rough=0.12),
    "tapeRed": fragile_tex("BoxTapeRed"),
    "label": label_tex("BoxLabel"),
    "green": pbr("BoxGreen", (0.1, 0.3, 0.18), rough=0.6),
    "blue": pbr("BoxBlue", (0.12, 0.2, 0.45), rough=0.7),
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
    t.data.extrude = 0.0
    t.data.resolution_u = 3    # (flat lettering, coarse curves: its sides never showed, and the curves were most of the triangles)
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


def uv_label(o):
    """the label's top face takes the whole picture"""
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    xs = [vt.co.x for vt in me.vertices]
    ys = [vt.co.y for vt in me.vertices]
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = ((co.x - min(xs)) / (max(xs) - min(xs)), (co.y - min(ys)) / (max(ys) - min(ys)))


def cardboard(name, at, w, h, d, label_zh, label_ja, sub, mat="kraft", tape="tape", base=SHELF, yaw=0.0, label=False, stamp=None, band=None,
              slump=0.0, uvs=0.3):
    """a box stood at `at` (x, z) on `base`, turned `yaw`: everything on it built round its own middle, then turned and set in its place"""
    x0, z0 = at
    cy = base + h / 2
    mine = []
    b = box(name, S(w, h, d), P(0, cy, 0), M[mat], bev=0.004)
    uv_box(b, uvs)
    # (an old box sags: its top dished a little in the middle)
    if slump:
        for vt in b.data.vertices:
            if vt.co.z > base + h - 0.003:
                k_ = (1 - min(1, (2 * vt.co.x / w) ** 2)) * (1 - min(1, (2 * vt.co.y / d) ** 2))
                vt.co.z -= slump * k_
    mine.append(b)
    top = base + h
    # (the seam between the two long flaps, along its middle, a hair dark; and the short flaps' edges under them at each end)
    mine.append(box(f"{name}Seam", S(w - 0.01, 0.0008, 0.0016), P(0, top + 0.0002, 0), M["kraftEdge"]))
    for sx in (-1, 1):
        mine.append(box(f"{name}SeamEnd{sx}", S(0.0012, 0.0006, d - 0.02), P(sx * (w / 2 - 0.012), top + 0.0001, 0), M["kraftEdge"]))
    # (the tape: across the seam's length, folded down over both ends a little way)
    tw = 0.05 if tape == "tapeRed" else 0.048
    mine.append(box(f"{name}Tape", S(w + 0.004, 0.0012, tw), P(0, top + 0.0006, 0), M[tape]))
    for sx in (-1, 1):
        mine.append(box(f"{name}TapeEnd{sx}", S(0.0012, min(0.06, h * 0.45), tw), P(sx * (w / 2 + 0.0006), top - min(0.03, h * 0.225), 0), M[tape]))
    # (its printing on the side toward the cashier: what's in it in Chinese and Japanese, a line of detail, the this-way-up arrows; on the
    # coated box a printed band of colour with the name reversed out of it)
    fz = d / 2 + 0.0004
    if band:
        mine.append(box(f"{name}Band", S(w - 0.02, h * 0.34, 0.0004), P(0, cy + h * 0.17, fz), M[band]))
    mine.append(text(f"{name}LabelZh", label_zh, h * 0.2, M["white" if band else "ink"], P(0, cy + h * 0.17, fz + 0.0004), (math.pi / 2, 0, 0), ZH, fit=w * 0.8))
    mine.append(text(f"{name}LabelJa", label_ja, h * 0.12, M["ink"], P(0, cy - h * 0.08, fz), (math.pi / 2, 0, 0), JA, fit=w * 0.8))
    mine.append(text(f"{name}Sub", sub, h * 0.07, M["ink"], P(0, cy - h * 0.27, fz), (math.pi / 2, 0, 0), JA, fit=w * 0.8))
    if not band:
        for k in (-1, 1):
            mine.append(text(f"{name}Up{k}", "↑↑", h * 0.11, M["red"], P(k * w * 0.37, cy + h * 0.3, fz), (math.pi / 2, 0, 0), ZH))
    # (a shipping label stuck on the top, a little askew)
    if label:
        lb = box(f"{name}Label", S(0.075, 0.0005, 0.05), P(w * 0.22, top + 0.0013, -d * 0.22), M["label"], rot=(0, 0, 0.09))
        uv_label(lb)
        mine.append(lb)
    # (a stamp in the corner of the face: a ring and its word)
    if stamp:
        txt, col = stamp
        sx_, sy_ = -w * 0.33, cy - h * 0.22
        bpy.ops.mesh.primitive_torus_add(major_radius=h * 0.09, minor_radius=0.0011, major_segments=28, minor_segments=3,
                                         location=P(sx_, sy_, fz + 0.0003), rotation=(math.pi / 2, 0, 0))
        mine.append(finish(active(), f"{name}StampRing", M[col], smooth_shade=False))
        mine.append(text(f"{name}Stamp", txt, h * 0.1, M[col], P(sx_, sy_, fz + 0.0003), (math.pi / 2, 0.25, 0), ZH))
    place = Matrix.Translation(P(x0, 0, z0)) @ Matrix.Rotation(yaw, 4, "Z")
    for o in mine:
        o.matrix_world = place @ o.matrix_world
    parts.extend(mine)
    return top


# (along the shelf from the door end: the bags' big box with the manual on it and the napkins' old one behind, the till rolls with the
# coasters on them, the chopsticks' coated box at the far end; each its own board and tape)
top1 = cardboard("TillBoxBags", (-0.27, 0.11), 0.36, 0.2, 0.27, "紙袋", "手さげ紙袋", "M サイズ ・ 100 枚入", label=True, stamp=("検", "red"))
cardboard("TillBoxNapkins", (-0.17, -0.17), 0.44, 0.27, 0.24, "紙巾", "紙ナプキン", "2 枚重ね ・ 3000 枚", mat="kraftOld", tape="tapePaper",
          yaw=-0.05, slump=0.007, stamp=("済", "blue"), uvs=0.36)
topR = cardboard("TillBoxRolls", (0.14, 0.12), 0.25, 0.16, 0.21, "收銀紙捲", "レジロール", "58 mm × 20 巻", mat="kraftNew", tape="tapeClear",
                 yaw=0.04, label=True, uvs=0.26)
cardboard("TillBoxCoasters", (0.15, 0.13), 0.17, 0.07, 0.14, "杯墊", "コースター", "和紙 ・ 500 枚", mat="kraftGrey", tape="tapeRed", base=topR,
          yaw=-0.22, uvs=0.22)
cardboard("TillBoxChopsticks", (0.41, 0.06), 0.2, 0.12, 0.3, "割箸", "竹 割り箸", "天削 21 cm ・ 1000 膳", mat="coated", tape="tapeClear",
          band="green", yaw=0.08, uvs=0.32)

# =====================================================================
# The manual: a bound A5 book, a couple of centimetres thick, lying on the bags' box, turned a little: hard covers a hair bigger than the
# pages, a rounded spine, the page block's edges showing pale between them
# =====================================================================
BW, BD, BT = 0.15, 0.212, 0.024
CB = 0.0028                              # a cover board's thickness
K = BD / 0.155                           # (the cover's printing, laid out for the old booklet, scaled up to the book)
book = bpy.data.objects.new("TillManual", None)
bpy.context.collection.objects.link(book)
book.location = P(-0.27, top1 + 0.0006, 0.1)
book.rotation_euler = (0, 0, 0.12)
bk = []
bk.append(box("ManualPages", S(BW - 0.006, BT - 2 * CB, BD - 0.006), P(0.002, BT / 2, 0), M["pages"], bev=0.0008))
bk.append(box("ManualCoverTop", S(BW, CB, BD), P(0, BT - CB / 2, 0), M["cover"], bev=0.0009))
bk.append(box("ManualCoverBottom", S(BW, CB, BD), P(0, CB / 2, 0), M["cover"], bev=0.0009))
# (the spine: rounded, its edges well eased)
bk.append(box("ManualSpine", S(0.007, BT, BD), P(-BW / 2 + 0.0015, BT / 2, 0), M["cover"], bev=0.0032))
# (the hinge groove pressed into the cover beside the spine, and the headband peeping out top and bottom)
bk.append(box("ManualHinge", S(0.0016, 0.0004, BD - 0.004), P(-BW / 2 + 0.011, BT + 0.0001, 0), M["band"]))
for sz in (-1, 1):
    bk.append(box(f"ManualHeadband{sz}", S(0.004, BT - 2 * CB, 0.0014), P(-BW / 2 + 0.004, BT / 2, sz * (BD / 2 - 0.0035)), M["red"]))
# (the cover: a pale band across with the title, the Japanese under it, a line of small print at the foot, a register drawn in white)
CT = BT + 0.0002
bk.append(box("ManualBand", S(BW - 0.016, 0.0003, 0.05 * K), P(0.004, CT, -0.03 * K), M["band"]))
bk.append(text("ManualTitle", "收銀機操作說明書", 0.0115 * K, M["ink"], P(0.004, CT + 0.0003, -0.037 * K), (0, 0, 0), ZH, fit=BW - 0.028))
bk.append(text("ManualTitleJa", "レジスター 取扱説明書", 0.0068 * K, M["ink"], P(0.004, CT + 0.0003, -0.019 * K), (0, 0, 0), JA, fit=BW - 0.036))
bk.append(text("ManualFoot", "聞野 日式烤魚　店內用", 0.0055 * K, M["white"], P(0.004, CT, 0.064 * K), (0, 0, 0), ZH, fit=BW - 0.036))
# (the little register on the cover: its body, its display on a stalk, a grid of keys)
bk.append(box("ManualPicBody", S(0.05 * K, 0.0002, 0.026 * K), P(0.004, CT, 0.03 * K), M["white"]))
bk.append(box("ManualPicStalk", S(0.003 * K, 0.0002, 0.012 * K), P(0.02 * K, CT, 0.012 * K), M["white"]))
bk.append(box("ManualPicDisplay", S(0.022 * K, 0.0002, 0.008 * K), P(0.02 * K, CT, 0.004 * K), M["white"]))
for i in range(5):
    for j in range(3):
        bk.append(box(f"ManualPicKey{i}{j}", S(0.006 * K, 0.0002, 0.004 * K), P((-0.012 + i * 0.008) * K, CT + 0.0001, (0.026 + j * 0.006) * K), M["cover"]))
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
