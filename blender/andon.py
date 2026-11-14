"""The table lantern (行燈): a floor lantern on four legs, as it stood before: dark posts running from the floor up past the shade, rails
round the shade's top and bottom, a shelf low between the legs, a handle arching over the top; and its tall washi shade, lit from inside,
with kumiko panels after a kumiko lamp: each side parted into two by three panels by thin crossbars of pale hinoki, some panels with a
hemp-leaf star (麻の葉), some with a diagonal lattice, the rest plain paper, placed so no two neighbours repeat.

Run:
    blender -b --factory-startup --python blender/andon.py -- <project path>
Writes public/models/andon.glb and blender/andon.blend.

Frame: +y up, its feet on y = 0, the posts 0.2 apart (the game scales it). Materials: AndonWood (pale: crossbars, kumiko), AndonFrame (the
dark posts, rails, handle), AndonShelf, AndonPaper (the washi, drawn lit by the game). Node: Andon.
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

seed(12)
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 256
u, v = grid01(N)
# (plain wood, as kumiko is left: a warm natural hinoki-and-cedar brown, its grain showing, not bleached pale)
wood = mix((0.72, 0.52, 0.32), (0.62, 0.43, 0.25), smooth(0.3, 0.8, fbm(N, 2, 12, 4)))
wood_tex = image("andonWood", mix(wood, (0.48, 0.32, 0.18), (np.sin((u + fbm(N, 2, 6, 3) * 0.05) * math.pi * 2 * 30) > 0.85).astype(np.float32) * 0.35))
# (washi: warm white, its long fibres faintly showing)
paper = mix((1.0, 0.95, 0.84), (0.97, 0.9, 0.76), fbm(N, 6, 6, 4) * 0.7)
paper = mix(paper, (0.93, 0.84, 0.68), (fbm(N, 40, 3, 2) > 0.7).astype(np.float32) * 0.3)
paper_tex = image("andonPaper", paper)
M = {"wood": pbr("AndonWood", (1, 1, 1), tex=wood_tex, rough=0.6), "paper": pbr("AndonPaper", (1, 1, 1), tex=paper_tex, rough=0.9),
     "frame": pbr("AndonFrame", lin("#3a2416"), rough=0.6), "shelf": pbr("AndonShelf", lin("#4a2e1c"), rough=0.6)}

parts = []


def bar(name, a, b, w, d, mat_=None):
    """a stick from a to b (points in the game's frame), w by d in section"""
    a, b = Vector(a), Vector(b)
    mid, dv = (a + b) / 2, b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*mid))
    o = active()
    o.scale = (w, d, dv.length)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector(P(*dv)).to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    finish(o, name, mat_ or M["wood"], smooth_shade=False)
    parts.append(o)
    return o


def quad(name, corners, uv):
    me_ = bpy.data.meshes.new(name)
    me_.from_pydata([P(*p) for p in corners], [], [(0, 1, 2, 3)])
    me_.update()
    uvl = me_.uv_layers.new().data
    for li, q in enumerate(uv):
        uvl[li].uv = q
    po = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(po)
    parts.append(finish(po, name, M["paper"], smooth_shade=False))


S_ = 0.2          # (the posts' spacing)
SH = 0.36         # (the shade's height)
LEG = 0.16        # (the shade's foot, up from the floor)
PT = 0.022        # (the posts' thickness)
TOP = LEG + SH
# (the posts, from the floor to a little over the shade)
for sx in (-1, 1):
    for sz in (-1, 1):
        bar(f"AndonPost{sx}{sz}", (sx * S_ / 2, 0, sz * S_ / 2), (sx * S_ / 2, TOP + 0.04, sz * S_ / 2), PT, PT, M["frame"])
# (rails round the shade's foot and top, both ways)
for y in (LEG, TOP):
    for sd in (-1, 1):
        bar(f"AndonRailX{sd}{int(y * 1000)}", (-(S_ + 0.03) / 2, y, sd * S_ / 2), ((S_ + 0.03) / 2, y, sd * S_ / 2), 0.02, 0.02, M["frame"])
        bar(f"AndonRailZ{sd}{int(y * 1000)}", (sd * S_ / 2, y, -(S_ + 0.03) / 2), (sd * S_ / 2, y, (S_ + 0.03) / 2), 0.02, 0.02, M["frame"])
# (the shelf low between the legs)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, LEG * 0.45, 0))
o = active()
o.scale = (S_, S_, 0.012)
bpy.ops.object.transform_apply(scale=True)
parts.append(finish(o, "AndonShelf", M["shelf"], smooth_shade=False))
# (the handle: an arch from the top of one front post's pair to the other's, its feet set into the posts' tops, rising over the shade)
HR = S_ / 2
pts_h = [(HR * math.cos(a), TOP + 0.03 + HR * 0.6 * math.sin(a), 0) for a in np.linspace(0, math.pi, 17)]
pts_h[0] = (S_ / 2, TOP + 0.03, 0)
pts_h[-1] = (-S_ / 2, TOP + 0.03, 0)
for i in range(len(pts_h) - 1):
    # (each piece a little longer than its stretch, so the joints close)
    a_, b_ = Vector(pts_h[i]), Vector(pts_h[i + 1])
    d_ = (b_ - a_).normalized() * 0.003
    bar(f"AndonHandle{i}", a_ - d_, b_ + d_, 0.016, 0.016, M["frame"])
# (a cap on each post the handle's feet sit in)
for sx in (-1, 1):
    bar(f"AndonHandleFoot{sx}", (sx * S_ / 2, TOP + 0.015, 0), (sx * S_ / 2, TOP + 0.045, 0), 0.026, 0.026, M["frame"])

# the shade's faces: each one's middle, the directions across it (right, up as seen from outside), and the way out
HW = S_ / 2 - PT / 2          # (the open half-width between the posts)
HH = SH / 2 - 0.012           # (the open half-height, inside the rails)
YC = LEG + SH / 2
FACES = {
    "front": (Vector((0, YC, -S_ / 2)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, -1))),
    "right": (Vector((S_ / 2, YC, 0)), Vector((0, 0, 1)), Vector((0, 1, 0)), Vector((1, 0, 0))),
    "back": (Vector((0, YC, S_ / 2)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
    "left": (Vector((-S_ / 2, YC, 0)), Vector((0, 0, -1)), Vector((0, 1, 0)), Vector((-1, 0, 0))),
}
# (two columns by three rows; which panel has what: 'a' hemp leaf, 'd' diagonal lattice, unlisted plain; turned about from face to face)
PATTERN = {
    "front": {(1, 2): "a", (0, 1): "d", (1, 0): "a"},
    "right": {(0, 2): "a", (1, 1): "d", (0, 0): "d"},
    "back": {(1, 2): "d", (0, 1): "a", (1, 0): "a"},
    "left": {(0, 2): "d", (1, 1): "a", (0, 0): "d"},
}
K = 0.0024        # (a kumiko strip's width)
KD = 0.003        # (and depth)
# (the kumiko's two patterns drawn once, side by side: 麻の葉 (hemp leaf: spokes from the middle to the corners and to the edges' middles,
# each leaf's outline from halfway out along a diagonal to the edge middles beside it) on the left, a diagonal lattice (strips both ways at
# 45°) on the right; a panel's strips at their own width, the wood's colour along them, a little darker where they cross; cut out by alpha)
_W_, _H_ = HW / 2 - 0.003, HH / 3 - 0.003
KPX = 256
KPY = int(round(KPX * _H_ / _W_))
_kx, _ky = np.meshgrid((np.arange(KPX) + 0.5) / KPX * 2 * _W_ - _W_, (np.arange(KPY) + 0.5) / KPY * 2 * _H_ - _H_)


def _seg_d(ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = np.clip(((_kx - ax) * dx + (_ky - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(_kx - (ax + t * dx), _ky - (ay + t * dy))


_cn = [(-_W_, -_H_), (_W_, -_H_), (_W_, _H_), (-_W_, _H_)]
_md = [((_cn[i][0] + _cn[(i + 1) % 4][0]) / 2, (_cn[i][1] + _cn[(i + 1) % 4][1]) / 2) for i in range(4)]
_da = np.full(_kx.shape, 9.0)
for i in range(4):
    _da = np.minimum(_da, _seg_d(0, 0, *_cn[i]))
    _da = np.minimum(_da, _seg_d(0, 0, *_md[i]))
    _h = (_cn[i][0] * 0.5, _cn[i][1] * 0.5)
    _da = np.minimum(_da, _seg_d(*_h, *_md[i]))
    _da = np.minimum(_da, _seg_d(*_h, *_md[(i - 1) % 4]))
_dd = np.full(_kx.shape, 9.0)
for j in (-2, -1, 0, 1, 2):
    off = j * _H_ * 0.55
    for sgn in (1, -1):
        _dd = np.minimum(_dd, _seg_d(-2 * _W_, sgn * (-2 * _W_) + off, 2 * _W_, sgn * (2 * _W_) + off))
# (drawn a little wider than the strip's own width: flat, its sides don't show as the solid strips' did, and it read thin)
_kal = np.concatenate([smooth(K * 0.95, K * 0.7, _da), smooth(K * 0.95, K * 0.7, _dd)], 1).astype(np.float32)
_kc = np.zeros((KPY, 2 * KPX, 3), np.float32) + np.array((0.7, 0.5, 0.3), np.float32)
_kc *= (0.88 + 0.12 * np.sin(np.arange(2 * KPX) * 0.9))[None, :, None]
M["kumiko"] = pbr("AndonKumikoCutout", (1, 1, 1), tex=image("andonKumiko", _kc, alpha=_kal), rough=0.6, blend=True)


def kumiko_card(name, corners, u0):
    me_ = bpy.data.meshes.new(name)
    me_.from_pydata([P(*p) for p in corners], [], [(0, 1, 2, 3)])
    me_.update()
    uvl = me_.uv_layers.new().data
    for li, q in enumerate(((u0, 0), (u0 + 0.5, 0), (u0 + 0.5, 1), (u0, 1))):
        uvl[li].uv = q
    po = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(po)
    parts.append(finish(po, name, M["kumiko"], smooth_shade=False))
for fname, (c, r, up, out) in FACES.items():
    # (the washi, a little in from the posts' outer faces)
    pc = c - out * 0.004
    quad(f"AndonPaper_{fname}", [pc + r * sx * (S_ / 2) + up * sy * (SH / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
         ((0, 0), (1, 0), (1, 2), (0, 2)))
    # (the crossbars: one down the middle, two across, on the paper's outside)
    kc = c - out * 0.0015
    bar(f"AndonBarV_{fname}", kc - up * HH, kc + up * HH, 0.005, 0.005)
    for row in (1, 2):
        yy = -HH + row * (2 * HH / 3)
        bar(f"AndonBarH_{fname}{row}", kc + up * yy - r * HW, kc + up * yy + r * HW, 0.005, 0.005)
    hw, hh = HW / 2, HH / 3
    for (col, row), kind in PATTERN[fname].items():
        pcen = kc + r * (col - 0.5) * HW + up * (-HH + (row + 0.5) * (2 * HH / 3))
        w_, h_ = hw - 0.003, hh - 0.003
        cn = [pcen + r * sx * w_ + up * sy * h_ for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        # (each kumiko panel one card in the strips' plane, its pattern drawn on it and cut out by its alpha (item 85, the owner's,
        # 2026-11-14: "far too many faces round the fire; one sheet?"): it was dozens of little strips a panel, 1,900 triangles the lantern's)
        u0 = 0.0 if kind == "a" else 0.5
        kumiko_card(f"AndonKumiko_{fname}{col}{row}", cn, u0)
# (and the shade's top: plain paper)
pc = Vector((0, TOP - 0.004, 0))
quad("AndonPaper_top", [pc + Vector((sx * S_ / 2, 0, sz * S_ / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))], ((0, 0), (1, 0), (1, 1), (0, 1)))

root = bpy.data.objects.new("Andon", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "andon.glb"), os.path.join(PROJECT, "blender", "andon.blend"))
print("ANDON_DONE", len(parts))
