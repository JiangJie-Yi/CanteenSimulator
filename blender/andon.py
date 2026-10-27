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
wood = mix((0.9, 0.78, 0.6), (0.82, 0.68, 0.5), smooth(0.3, 0.8, fbm(N, 2, 12, 4)))
wood_tex = image("andonWood", mix(wood, (0.7, 0.55, 0.37), (np.sin((u + fbm(N, 2, 6, 3) * 0.05) * math.pi * 2 * 30) > 0.85).astype(np.float32) * 0.3))
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
# (the handle: a half ring arching over the top, across the lantern)
pts_h = [(S_ * 0.35 * math.cos(a), TOP + 0.02 + S_ * 0.35 * math.sin(a), 0) for a in np.linspace(0, math.pi, 13)]
for i in range(len(pts_h) - 1):
    bar(f"AndonHandle{i}", pts_h[i], pts_h[i + 1], 0.016, 0.016, M["frame"])

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
        mids = [(cn[i] + cn[(i + 1) % 4]) / 2 for i in range(4)]
        if kind == "a":
            # (麻の葉: spokes from the middle to the corners and to the edges' middles, and each leaf's outline from halfway out along a
            # diagonal to the two edge middles beside it)
            for i in range(4):
                bar(f"AndonAsaD_{fname}{col}{row}{i}", pcen, cn[i], K, KD)
                bar(f"AndonAsaM_{fname}{col}{row}{i}", pcen, mids[i], K, KD)
                d = pcen + (cn[i] - pcen) * 0.5
                bar(f"AndonAsaL_{fname}{col}{row}{i}a", d, mids[i], K, KD)
                bar(f"AndonAsaL_{fname}{col}{row}{i}b", d, mids[(i - 1) % 4], K, KD)
        else:
            # (a diagonal lattice: strips both ways at 45°, crossing, clipped to the panel)
            def clip(p0, p1, pcen=pcen, w_=w_, h_=h_, r=r, up=up):
                lo, hi = 0.0, 1.0
                dvec = p1 - p0
                for ax, lim in ((r, w_), (up, h_)):
                    pv = (p0 - pcen).dot(ax)
                    dv_ = dvec.dot(ax)
                    if abs(dv_) < 1e-9:
                        if abs(pv) > lim:
                            return None
                        continue
                    t1, t2 = (lim - pv) / dv_, (-lim - pv) / dv_
                    lo, hi = max(lo, min(t1, t2)), min(hi, max(t1, t2))
                return (p0 + dvec * lo, p0 + dvec * hi) if hi > lo + 1e-6 else None
            for j in (-2, -1, 0, 1, 2):
                off = j * h_ * 0.55
                for sgn in (1, -1):
                    seg = clip(pcen + r * (-2 * w_) + up * (sgn * (-2 * w_) + off), pcen + r * (2 * w_) + up * (sgn * (2 * w_) + off))
                    if seg:
                        bar(f"AndonHishi_{fname}{col}{row}{j}{sgn}", seg[0], seg[1], K, KD)
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
