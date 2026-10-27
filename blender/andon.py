"""The table lantern (行燈): a cube of pale hinoki, lit from inside through washi, after a kumiko cube lamp: each face of the cube (the four
sides and the top) parted into four square panels by a thin cross of wood; some panels plain paper, some with a hemp-leaf star (麻の葉) in
fine kumiko strips, some with a diagonal lattice, set round the cube so no two neighbours repeat. The frame's edges are square sticks; it
stands on a thin base board.

Run:
    blender -b --factory-startup --python blender/andon.py -- <project path>
Writes public/models/andon.glb and blender/andon.blend.

Frame: +y up, its foot's middle at the origin, 0.22 across and about as tall (the game scales it). Materials: AndonWood (the frame and
the kumiko), AndonPaper (the washi, drawn lit by the game). Node: Andon.
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
M = {"wood": pbr("AndonWood", (1, 1, 1), tex=wood_tex, rough=0.6), "paper": pbr("AndonPaper", (1, 1, 1), tex=paper_tex, rough=0.9)}

parts = []


def bar(name, a, b, w, d, mat_=None):
    """a square-ish stick from a to b (points in the game's frame), w across (in the face) and d deep (out of it): the third axis given by the face"""
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


A = 0.22          # (the cube's side)
FB = 0.012        # (the base board's height)
T = 0.009         # (the frame's sticks)
H = A / 2
Y0, Y1 = FB, FB + A

# (the base board, a touch wider than the cube)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, FB / 2, 0))
o = active()
o.scale = (A + 0.012, A + 0.012, FB)
bpy.ops.object.transform_apply(scale=True)
parts.append(finish(o, "AndonBase", M["wood"], smooth_shade=False))
# (the frame: the twelve edges of the cube)
for sx in (-1, 1):
    for sz in (-1, 1):
        bar(f"AndonPost{sx}{sz}", (sx * (H - T / 2), Y0, sz * (H - T / 2)), (sx * (H - T / 2), Y1, sz * (H - T / 2)), T, T)
for y in (Y0 + T / 2, Y1 - T / 2):
    for s in (-1, 1):
        bar(f"AndonRailX{s}{int(y * 1000)}", (-H, y, s * (H - T / 2)), (H, y, s * (H - T / 2)), T, T)
        bar(f"AndonRailZ{s}{int(y * 1000)}", (s * (H - T / 2), y, -H), (s * (H - T / 2), y, H), T, T)

# each face: its middle, the two directions across it (right, up as seen from outside), and the way out
FACES = {
    "front": (Vector((0, Y0 + H, -H)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, -1))),
    "right": (Vector((H, Y0 + H, 0)), Vector((0, 0, 1)), Vector((0, 1, 0)), Vector((1, 0, 0))),
    "back": (Vector((0, Y0 + H, H)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
    "left": (Vector((-H, Y0 + H, 0)), Vector((0, 0, -1)), Vector((0, 1, 0)), Vector((-1, 0, 0))),
    "top": (Vector((0, Y1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0))),
}
# (which panel has what: cells (col, row) from the face's lower left; 'a' hemp leaf, 'd' diagonal lattice, '' plain)
PATTERN = {
    "front": {(1, 1): "a", (0, 0): "d"},
    "right": {(0, 1): "a", (1, 0): "d"},
    "back": {(1, 1): "a", (0, 0): "d"},
    "left": {(0, 1): "a", (1, 0): "d"},
    "top": {(1, 1): "a"},
}
K = 0.0024        # (a kumiko strip's width)
KD = 0.003        # (and depth)
IN = A / 2 - T    # (a face's open half-size, inside the frame)
for fname, (c, r, up, out) in FACES.items():
    # (the paper, just inside the frame, the whole face)
    pc = c - out * (T * 0.75)
    corners = [pc + r * sx * IN + up * sy * IN for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    me_ = bpy.data.meshes.new(f"AndonPaper_{fname}")
    me_.from_pydata([P(*p) for p in corners], [], [(0, 1, 2, 3)])
    me_.update()
    uvl = me_.uv_layers.new().data
    for li, (uu_, vv_) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uvl[li].uv = (uu_, vv_)
    po = bpy.data.objects.new(f"AndonPaper_{fname}", me_)
    bpy.context.collection.objects.link(po)
    parts.append(finish(po, f"AndonPaper_{fname}", M["paper"], smooth_shade=False))
    # (the cross dividing it into four, on the paper's outside)
    kc = c - out * (T * 0.5)
    bar(f"AndonCrossH_{fname}", kc - r * IN, kc + r * IN, 0.005, 0.006)
    bar(f"AndonCrossV_{fname}", kc - up * IN, kc + up * IN, 0.005, 0.006)
    # (the panels' kumiko)
    half = IN / 2
    for (col, row), kind in PATTERN[fname].items():
        pcen = kc + r * (col - 0.5) * IN + up * (row - 0.5) * IN
        h = half - 0.0025
        cn = [pcen + r * sx * h + up * sy * h for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        mids = [(cn[i] + cn[(i + 1) % 4]) / 2 for i in range(4)]
        if kind == "a":
            # (麻の葉 in a square: the spokes from the middle to the corners and to the edges' middles, and each leaf's outline: from a point
            # halfway out along a diagonal to the two edge middles beside it)
            for i in range(4):
                bar(f"AndonAsaD_{fname}{col}{row}{i}", pcen, cn[i], K, KD)
                bar(f"AndonAsaM_{fname}{col}{row}{i}", pcen, mids[i], K, KD)
                d = pcen + (cn[i] - pcen) * 0.5
                bar(f"AndonAsaL_{fname}{col}{row}{i}a", d, mids[i], K, KD)
                bar(f"AndonAsaL_{fname}{col}{row}{i}b", d, mids[(i - 1) % 4], K, KD)
        elif kind == "d":
            # (a diagonal lattice: three strips each way, crossing)
            for j in (-1, 0, 1):
                off = j * h * 0.66
                for sgn in (1, -1):
                    # (a line at 45°, clipped to the square)
                    pts = []
                    for t in np.linspace(-h, h, 2):
                        pass
                    a_ = pcen + r * (-h) + up * (sgn * (-h) + off)
                    b_ = pcen + r * h + up * (sgn * h + off)
                    # (clip into the square)
                    def clip(p0, p1):
                        lo, hi = 0.0, 1.0
                        dvec = p1 - p0
                        for ax in (r, up):
                            pv = (p0 - pcen).dot(ax)
                            dv_ = dvec.dot(ax)
                            for bound, sgn_b in ((h, 1), (-h, -1)):
                                if abs(dv_) < 1e-9:
                                    continue
                                tt = (bound - pv) / dv_
                                if sgn_b * dv_ > 0:
                                    hi = min(hi, tt)
                                else:
                                    lo = max(lo, tt)
                        return (p0 + dvec * lo, p0 + dvec * hi) if hi > lo + 1e-6 else None
                    seg = clip(a_, b_)
                    if seg:
                        bar(f"AndonHishi_{fname}{col}{row}{j}{sgn}", seg[0], seg[1], K, KD)

root = bpy.data.objects.new("Andon", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "andon.glb"), os.path.join(PROJECT, "blender", "andon.blend"))
print("ANDON_DONE", len(parts))
