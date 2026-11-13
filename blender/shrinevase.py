"""A shrine vase (榊立て) for either side of the household shrine: a white porcelain bottle, slender necked, a cobalt band of waves round its
shoulder and a fine line at its foot, holding a spray of sakaki with a few flowers. About 18 cm tall in the shrine's units, standing on
y = 0, its middle at x = z = 0.

The flowers and leaves drawn as the willow's are (the owner's, 2026-11-13, item 57: "the shrine's vase flowers the same way"): not a model
of every petal and leaf (a ball chrysanthemum was 1,296 triangles, a vase's leaves 2,600), but pictures on crossed cards, cut out by their
alpha (VaseCards: the game draws it double-sided, alpha-tested, no ink line). One picture (VaseCardsPic, 1024 square) holds them all: a
sakaki sprig, a chrysanthemum's leafy stem, a bare stem, and the blooms seen face on. Each sakaki sprig and each flower's stem is a pair
of crossed strips along its curve from the vase's mouth; each bloom three cards through its middle, one facing the way it faces and two
turned either side of it. The vase is still a model.

Three arrangements, by the variant given: 2 the plain one, sakaki with a few small chrysanthemums (public/models/shrinevase.glb, root
"ShrineVase"); 0 white and gold chrysanthemums (shrinevase0.glb, "ShrineVase0"); 1 pink, crimson and violet blooms (shrinevase1.glb,
"ShrineVase1").

Run:
    blender -b --factory-startup --python blender/shrinevase.py -- <project path> [preview.png] [variant]
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 and argv[1] else None
# (which arrangement: 0 white and gold chrysanthemums, 1 pink, crimson and violet blooms with white, 2 sakaki with small chrysanthemums)
VARIANT = int(argv[2]) if len(argv) > 2 else 0
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(5 + 11 * VARIANT)
prng = random.Random(77)   # (the picture: the same for every variant)


def P(x, y, z):
    return (x, -z, y)


# =====================================================================
# The porcelain's picture: white, a cobalt band of seigaiha round the shoulder (v 0.62..0.78), a double line under it and at the foot
# =====================================================================
N = 512
u, v = grid01(N)
pc = np.ones((N, N, 3), np.float32) * np.array([0.95, 0.94, 0.9], np.float32)
band = (v > 0.62) & (v < 0.78)
cu, cv = (u * 18) % 1.0, ((v - 0.62) / 0.16 * 3) % 1.0
d = np.sqrt((cu - 0.5) ** 2 + (cv * 0.9) ** 2)
waves = (np.sin(d * 2 * math.pi * 4) > 0.2) & band
cobalt = np.array([0.12, 0.2, 0.52], np.float32)
pc[waves] = cobalt
for y0, w in ((0.6, 0.008), (0.585, 0.004), (0.8, 0.006), (0.06, 0.008), (0.045, 0.004)):
    pc[np.abs(v - y0) < w] = cobalt

# =====================================================================
# The cards' picture (row 0 its top as drawn here; turned over into the image): three strips down its left (128 x 512 each, the sprig's
# foot at the strip's foot) and the blooms in 128 squares to their right
# =====================================================================
A = 1024
RGB = np.zeros((A, A, 3), np.float32)
AL = np.zeros((A, A), np.float32)
CELL = 128


def cell_xy(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return xx, yy


def put(r0, c0, rgb, al):
    """a drawn cell into the picture at row r0, column c0 (where it's opaque)"""
    h, w = al.shape
    m = al > 0
    RGB[r0:r0 + h, c0:c0 + w][m] = rgb[m]
    AL[r0:r0 + h, c0:c0 + w][m] = al[m]


def shape_w(shape, t):
    if shape == "round":
        return np.sin(np.pi * np.clip(t, 0, 0.999) ** 0.6) ** 0.5
    if shape == "point":
        return np.sin(np.pi * np.clip(t, 0, 1) ** 1.25) ** 0.9
    return np.sin(np.pi * np.clip(t, 0, 1) ** 0.8) ** 0.7 * 0.9 + 0.1 * (t < 1)


def petal(rgb, al, xx, yy, cx, cy, a, r0, L, W, col, shape="narrow", inner=0.72, tipcol=None):
    """a petal from the bloom's middle (cx, cy) out at angle a: from r0 for L, W wide at its widest, the shape's; darker toward its base,
    a darker edge round it (the petals told apart), its colour toward `tipcol` at its tip if given"""
    ca, sa = math.cos(a), math.sin(a)
    along = (xx - cx) * ca + (yy - cy) * sa - r0
    across = -(xx - cx) * sa + (yy - cy) * ca
    t = along / L
    half = W / 2 * shape_w(shape, t)
    m = (t >= 0) & (t <= 1) & (np.abs(across) < half)
    if not m.any():
        return
    c = np.asarray(col, np.float32)
    k = (inner + (1 - inner) * np.clip(t, 0, 1))[..., None]
    out = c[None, None, :] * k
    if tipcol is not None:
        out = out * (1 - np.clip(t, 0, 1)[..., None] * 0.6) + np.asarray(tipcol, np.float32) * (np.clip(t, 0, 1)[..., None] * 0.6)
    edge = (np.abs(across) > half * 0.78) | (t > 0.94)
    out = np.where(edge[..., None], out * 0.78, out)
    rgb[m] = np.clip(out[m], 0, 1)
    al[m] = 1


def disc(rgb, al, xx, yy, cx, cy, r, col, dots=None):
    m = (xx - cx) ** 2 + (yy - cy) ** 2 < r * r
    rgb[m] = col
    al[m] = 1
    if dots:
        for _ in range(int(r * r * 0.25)):
            a_, rr = prng.uniform(0, 6.283), r * math.sqrt(prng.random()) * 0.9
            x0, y0 = cx + math.cos(a_) * rr, cy + math.sin(a_) * rr
            mm = (xx - x0) ** 2 + (yy - y0) ** 2 < 1.6
            rgb[mm] = dots


def bloom_pic(kind):
    """a bloom seen face on, in a 128 square"""
    rgb = np.zeros((CELL, CELL, 3), np.float32)
    al = np.zeros((CELL, CELL), np.float32)
    xx, yy = cell_xy(CELL, CELL)
    cx = cy = CELL / 2
    WHITE, YELLOW, GOLD = (0.95, 0.94, 0.88), (0.95, 0.78, 0.2), (0.9, 0.62, 0.12)
    if kind in ("mumWhite", "mumYellow"):
        col = WHITE if kind == "mumWhite" else YELLOW
        ph = prng.random()
        for i in range(16):
            petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + ph) / 16, 12, 46 * prng.uniform(0.9, 1.05), 11, col, "narrow")
        disc(rgb, al, xx, yy, cx, cy, 14, (0.55, 0.62, 0.22) if kind == "mumWhite" else (0.78, 0.5, 0.1), dots=(0.4, 0.45, 0.15))
    elif kind in ("ballWhite", "ballGold"):
        col = np.array(WHITE if kind == "ballWhite" else GOLD, np.float32)
        for n, L, W, light in ((24, 58, 10, 0.86), (20, 49, 11, 0.9), (16, 39, 11, 0.95), (12, 29, 10, 1.0), (8, 18, 9, 1.05)):
            ph = prng.random()
            for i in range(n):
                petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + ph) / n, 2, L * prng.uniform(0.92, 1.05), W, np.clip(col * light, 0, 1), "narrow", inner=0.8)
    elif kind in ("spiderGold", "spiderYellow"):
        col = GOLD if kind == "spiderGold" else YELLOW
        ph = prng.random()
        for i in range(28):
            petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + ph) / 28, 8, 54 * prng.uniform(0.85, 1.05), 4.5, col, "narrow", inner=0.85)
        for i in range(14):
            petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + 0.5) / 14, 2, 20, 7, col, "narrow", inner=0.9)
    elif kind in ("peony", "peonyBlush"):
        col = np.array((0.95, 0.55, 0.66) if kind == "peony" else (0.98, 0.8, 0.84), np.float32)
        for n, L, W, light in ((9, 58, 44, 0.92), (8, 47, 38, 0.97), (7, 35, 32, 1.03), (6, 24, 24, 1.08)):
            ph = prng.random()
            for i in range(n):
                petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + ph) / n, 2, L, W, np.clip(col * light, 0, 1), "round", inner=0.82, tipcol=np.clip(col * 1.1, 0, 1))
        disc(rgb, al, xx, yy, cx, cy, 7, (0.98, 0.86, 0.6))
    elif kind == "camellia":
        col = (0.78, 0.12, 0.18)
        for n, L, W, r0 in ((6, 58, 50, 4), (5, 40, 38, 3)):
            ph = prng.random()
            for i in range(n):
                petal(rgb, al, xx, yy, cx, cy, 2 * math.pi * (i + ph) / n, r0, L, W, col, "round", inner=0.75)
        disc(rgb, al, xx, yy, cx, cy, 13, (0.95, 0.92, 0.78))
        for k in range(14):
            a_ = 2 * math.pi * k / 14
            disc(rgb, al, xx, yy, cx + math.cos(a_) * 12, cy + math.sin(a_) * 12, 3.2, (0.95, 0.78, 0.2))
    elif kind == "bell":
        col = (0.55, 0.32, 0.78)
        ph = prng.random()
        for i in range(5):
            a_ = 2 * math.pi * (i + ph) / 5
            petal(rgb, al, xx, yy, cx, cy, a_, 3, 56, 42, col, "point", inner=0.7)
            # (each petal's dark vein down its middle)
            ca, sa = math.cos(a_), math.sin(a_)
            along = (xx - cx) * ca + (yy - cy) * sa
            across = -(xx - cx) * sa + (yy - cy) * ca
            vein = (np.abs(across) < 0.9) & (along > 8) & (along < 46) & (al > 0)
            rgb[vein] = np.asarray(col) * 0.6
        disc(rgb, al, xx, yy, cx, cy, 8, (0.95, 0.94, 0.9))
    elif kind == "breath":
        # (baby's breath: fine forking twigs, a puff of tiny white flowers at every tip)
        tips = []
        for b in range(9):
            a_ = -math.pi / 2 + prng.uniform(-1.2, 1.2)
            L = prng.uniform(30, 58)
            x1, y1 = cx + math.cos(a_) * L, CELL - 6 + math.sin(a_) * L - 20
            for s in range(40):
                f = s / 39
                x, y = cx + (x1 - cx) * f, CELL - 6 + (y1 - (CELL - 6)) * f
                m = (xx - x) ** 2 + (yy - y) ** 2 < 0.8
                rgb[m] = (0.45, 0.55, 0.3)
                al[m] = 1
            tips.append((x1, y1))
        for x1, y1 in tips:
            for _ in range(7):
                disc(rgb, al, xx, yy, x1 + prng.uniform(-9, 9), y1 + prng.uniform(-9, 9), prng.uniform(2.2, 3.4), (0.97, 0.97, 0.95))
    else:
        # (a bud: a closed oval, its sepals green round its foot)
        col = (0.42, 0.62, 0.25) if kind == "budGreen" else (0.5, 0.32, 0.72)
        m = ((xx - cx) / 26) ** 2 + ((yy - cy) / 40) ** 2 < 1
        rgb[m] = col
        al[m] = 1
        for sd in (-1, 1):
            petal(rgb, al, xx, yy, cx, cy + 34, -math.pi / 2 + sd * 0.5, 0, 30, 12, (0.3, 0.48, 0.18), "point")
    return rgb, al


def strip_pic(kind):
    """a stem 512 tall in a 128 strip, its foot at the bottom: the sakaki sprig, a chrysanthemum's leafy stem, or a bare one"""
    W_, H_ = 128, 512
    rgb = np.zeros((H_, W_, 3), np.float32)
    al = np.zeros((H_, W_), np.float32)
    xx, yy = cell_xy(W_, H_)
    sway = lambda y: W_ / 2 + 6 * math.sin((H_ - y) / H_ * math.pi * 1.6)
    thick = {"sakaki": 3.2, "mumstem": 2.6, "stem": 2.0}[kind]
    stem_col = (0.35, 0.25, 0.14) if kind == "sakaki" else (0.32, 0.46, 0.18)
    top = 18 if kind == "sakaki" else 0
    sx = np.array([sway(y) for y in range(H_)], np.float32)[:, None]
    m = (np.abs(xx - sx) < thick * (0.55 + 0.45 * yy / H_)) & (yy > top)
    rgb[m] = stem_col
    al[m] = 1

    def leaf(y, side, L, Wd, col, ang, lobed=False):
        cx0 = sway(y)
        dx, dy = math.sin(ang) * side, -math.cos(ang)
        cx, cy = cx0 + dx * (L / 2 + 2), y + dy * (L / 2 + 2)
        lx = (xx - cx) * dx + (yy - cy) * dy
        ly = -(xx - cx) * dy + (yy - cy) * dx
        t = np.clip(1 - (2 * lx / L) ** 2, 0, 1)
        half = (Wd / 2) * t ** 0.7
        if lobed:
            half = half * (0.78 + 0.22 * np.cos(lx / L * math.pi * 5) ** 2)
        inside = np.abs(ly) < half
        c = np.asarray(col, np.float32)
        light = np.where(ly * side > 0, 1.0, 0.8)
        out = c[None, None, :] * light[..., None]
        # (the glossy sheen down one half, a paler midrib)
        if kind == "sakaki":
            out = np.where(((ly * side > half * 0.25) & (ly * side < half * 0.55))[..., None], np.clip(out * 1.35 + 0.06, 0, 1), out)
        out = np.where((np.abs(ly) < 0.8)[..., None], np.clip(c * 1.45 + 0.05, 0, 1), out)
        edge = (np.abs(ly) > half * 0.82) & inside
        out = np.where(edge[..., None], out * 0.7, out)
        rgb[inside] = out[inside]
        al[inside] = 1

    if kind == "sakaki":
        y, side = H_ - 90, 1
        while y > 60:
            f = (y - 60) / (H_ - 150)
            L, Wd = 56 + 18 * f, 22 + 6 * f
            leaf(y, side, L * prng.uniform(0.9, 1.08), Wd, (0.11, 0.27, 0.12) if prng.random() < 0.6 else (0.14, 0.31, 0.14), math.radians(prng.uniform(38, 58)))
            y -= prng.uniform(34, 46)
            side = -side
        for sd in (-1, 1):
            leaf(36, sd, 36, 13, (0.3, 0.48, 0.2), math.radians(16))
    elif kind == "mumstem":
        for y, side in ((H_ - 150, 1), (H_ - 260, -1), (H_ - 360, 1)):
            leaf(y, side, 62, 34, (0.24, 0.42, 0.18), math.radians(55), lobed=True)
    else:
        leaf(H_ - 210, 1, 50, 14, (0.28, 0.46, 0.2), math.radians(40))
    return rgb, al


STRIPS = {"sakaki": 0, "mumstem": 1, "stem": 2}
for name, k in STRIPS.items():
    put(0, k * CELL, *strip_pic(name))
BLOOMS = ["mumWhite", "mumYellow", "ballWhite", "ballGold", "spiderGold", "spiderYellow", "peony", "peonyBlush", "camellia", "bell",
          "breath", "budGreen", "budViolet"]
for i, kind in enumerate(BLOOMS):
    put((i // 5) * CELL, 3 * CELL + (i % 5) * CELL, *bloom_pic(kind))


def strip_uv(name):
    """(u0, u1) of a strip; v runs 0 at its foot (the picture's row 512) to 1 at its top (row 0)"""
    c0 = STRIPS[name] * CELL
    return c0 / A, (c0 + CELL) / A, 1 - 512 / A, 1.0


def bloom_uv(kind):
    i = BLOOMS.index(kind)
    r0, c0 = (i // 5) * CELL, 3 * CELL + (i % 5) * CELL
    return c0 / A, (c0 + CELL) / A, 1 - (r0 + CELL) / A, 1 - r0 / A


M = {
    "porcelain": pbr("VasePorcelain", (1, 1, 1), tex=image("vase_porcelain", pc), rough=0.12, coat=0.8),
    "cards": pbr("VaseCards", (1, 1, 1), tex=image("VaseCardsPic", RGB[::-1], alpha=AL[::-1]), rough=0.6, blend=True),
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


# =====================================================================
# The vase: turned from a profile (radius, height), its foot, belly, shoulder, slender neck and flared lip; hollow at the mouth (no points
# on the axis: its foot and the floor down its mouth closed flat across their rings, laddered on export. 24 round)
# =====================================================================
prof = [(0.024, 0.0), (0.026, 0.004), (0.03, 0.018), (0.034, 0.04), (0.033, 0.058), (0.026, 0.07), (0.016, 0.08),
        (0.012, 0.092), (0.012, 0.104), (0.015, 0.112), (0.018, 0.116), (0.0165, 0.117), (0.011, 0.112)]
seg = 24
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / seg), y, r * math.sin(2 * math.pi * j / seg))) for j in range(seg)] for r, y in prof]
H = 0.117
for i in range(len(rings) - 1):
    for j in range(seg):
        j2 = (j + 1) % seg
        f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
        for lp, (uu, vv) in zip(f.loops, ((j / seg, prof[i][1]), ((j + 1) / seg, prof[i][1]), ((j + 1) / seg, prof[i + 1][1]), (j / seg, prof[i + 1][1]))):
            lp[uvl].uv = (uu, vv / H)
for ring in (rings[0], rings[-1]):
    f = bm.faces.new(ring)
    for lp in f.loops:
        co = lp.vert.co
        lp[uvl].uv = (0.5 + co.x / 0.07, 0.5 - co.y / 0.07)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Vase")
bm.to_mesh(me)
bm.free()
vase = bpy.data.objects.new("Vase", me)
bpy.context.collection.objects.link(vase)
fin(vase, "VaseBody", M["porcelain"])

# =====================================================================
# The cards (Blender's frame, z up): all one mesh
# =====================================================================
CV, CF, CUV = [], [], []
MOUTH = Vector(P(0, 0.112, 0))
UPV = Vector((0, 0, 1))


def card_strip(path, width, uv, crossed=True):
    """a strip along `path` (points from its foot to its top), `width` across, mapped to `uv` (u0, u1, v0, v1) foot to top; with a second
    strip crossing it square"""
    n = len(path)
    u0, u1, v0, v1 = uv
    for c in range(2 if crossed else 1):
        base = len(CV)
        for i, q in enumerate(path):
            a = path[max(0, i - 1)]; b = path[min(n - 1, i + 1)]
            t = (b - a).normalized()
            side = t.cross(UPV)
            if side.length < 1e-4:
                side = Vector((1, 0, 0))
            side.normalize()
            across = side if c == 0 else t.cross(side).normalized()
            CV.extend([q - across * width / 2, q + across * width / 2])
        for i in range(n - 1):
            a0 = base + i * 2
            CF.append((a0, a0 + 1, a0 + 3, a0 + 2))
            va, vb = v0 + (v1 - v0) * i / (n - 1), v0 + (v1 - v0) * (i + 1) / (n - 1)
            CUV.append([(u0, va), (u1, va), (u1, vb), (u0, vb)])


def card_bloom(at, face, size, kind):
    """a bloom: three square cards through its middle, one facing `face`, two turned 60 degrees either side about the upright"""
    u0, u1, v0, v1 = bloom_uv(kind)
    # (looking up at most 40 degrees, and out some way: one right over the mouth faced straight up, its cards lay flat, a white line from the
    # front)
    flat = Vector((face[0], face[1], 0))
    if flat.length < 1e-3:
        a_ = random.uniform(0, 2 * math.pi)
        flat = Vector((math.cos(a_), math.sin(a_), 0))
    flat.normalize()
    rise = min(math.atan2(face[2], math.hypot(face[0], face[1])), math.radians(40))
    fwd = (flat * math.cos(rise) + UPV * math.sin(rise)).normalized()
    for turn in (0, math.radians(60), -math.radians(60)):
        f2 = fwd.copy()
        if turn:
            c_, s_ = math.cos(turn), math.sin(turn)
            f2 = Vector((fwd.x * c_ - fwd.y * s_, fwd.x * s_ + fwd.y * c_, fwd.z)).normalized()
        right = f2.cross(UPV)
        if right.length < 1e-4:
            right = Vector((1, 0, 0))
        right.normalize()
        up = right.cross(f2).normalized()
        h = size / 2
        base = len(CV)
        CV.extend([at - right * h - up * h, at + right * h - up * h, at + right * h + up * h, at - right * h + up * h])
        CF.append((base, base + 1, base + 2, base + 3))
        CUV.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])


def stalk_path(at, steps=4):
    """a stem's line from the water to a bloom: rising near upright out of the mouth, leaning out and curving over to meet it from under"""
    span = at - MOUTH
    out = Vector((span.x, span.y, 0))
    reach = out.length
    out = out.normalized() if reach > 1e-6 else Vector((1, 0, 0))
    h = span.z
    p0, p3 = MOUTH - Vector((0, 0, 0.02)), at
    p1 = MOUTH + Vector((0, 0, h * 0.6)) + out * reach * 0.08
    p2 = at - out * reach * (0.3 + 0.25 * min(1.0, reach / 0.06)) - Vector((0, 0, h * 0.18))
    return [p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t * t + p3 * t ** 3 for t in (k / steps for k in range(steps + 1))]


def flower(at, face, size, kind, stem="stem", stem_w=0.014):
    card_strip(stalk_path(at), stem_w, strip_uv(stem))
    card_bloom(at, face, size, kind)


def spot(i, n, rmin, rmax, hmin, hmax):
    """where the i-th of n blooms sits: spread round the mouth by the golden angle, the outer ones lower and leaning out"""
    a_ = i * 2.399 + random.uniform(-0.25, 0.25)
    rr = rmin + (rmax - rmin) * (i / max(1, n - 1)) ** 0.7 + random.uniform(-0.004, 0.004)
    h = hmax - (hmax - hmin) * (rr - rmin) / max(1e-6, rmax - rmin) + random.uniform(-0.006, 0.006)
    at = Vector(P(math.cos(a_) * max(0.0, rr), h, math.sin(a_) * max(0.0, rr)))
    out = at - MOUTH
    out.z = 0
    face = out * 12 + Vector((0, 0, 1))
    return at, face


# ---- the sakaki: seven sprigs out of the mouth, up and out, giving under their leaves' weight, each a crossed pair of strips
NST = 7
for s in range(NST):
    ang = s * 2 * math.pi / NST + random.uniform(-0.3, 0.3)
    lean = random.uniform(0.35, 0.9)
    length = random.uniform(0.1, 0.15)
    d = Vector(P(math.cos(ang) * math.sin(lean), math.cos(lean), math.sin(ang) * math.sin(lean)))
    droop = random.uniform(0.012, 0.03) * (0.6 + lean)
    path = [MOUTH - Vector((0, 0, 0.02)) + d * length * t + UPV * (0.012 * math.sin(math.pi * t * 0.7)) - UPV * (droop * t * t) for t in (k / 4 for k in range(5))]
    card_strip(path, random.uniform(0.055, 0.068), strip_uv("sakaki"))

if VARIANT == 2:
    # 平安 (the plain one, shrinevase.glb): the sakaki itself, with a few small chrysanthemums among its leaves, white and yellow
    for i in range(5):
        at, face = spot(i, 5, 0.025, 0.06, 0.15, 0.175)
        flower(at, face, 0.03, ("mumWhite", "mumYellow")[i % 2], "mumstem", 0.03)
    BUDS = ["budGreen"] * 3
elif VARIANT == 0:
    # 金運: big incurved ball chrysanthemums heaped at the top, white and gold; gold spider mums with long thread petals; small spray mums
    for i, kind in enumerate(["ballWhite", "ballGold", "ballWhite"]):
        at, face = spot(i, 3, 0.0, 0.03, 0.17, 0.19)
        flower(at, face, 0.066, kind, "mumstem", 0.034)
    for i in range(2):
        at, face = spot(i + 3, 5, 0.03, 0.05, 0.155, 0.17)
        flower(at, face, 0.07, ("spiderGold", "spiderYellow")[i], "mumstem", 0.03)
    for i in range(9):
        at, face = spot(i + 2, 11, 0.032, 0.058, 0.145, 0.172)
        flower(at, face, 0.028, ("mumYellow", "mumWhite")[i % 2])
    BUDS = ["budGreen"] * 6
else:
    # 良緣: full pink peonies, crimson camellias, violet bellflowers, clouds of baby's breath through them
    for i, kind in enumerate(["peony", "camellia", "peony", "camellia", "bell", "bell", "peonyBlush", "bell"]):
        at, face = spot(i, 8, 0.0, 0.055, 0.14, 0.19)
        flower(at, face, {"peony": 0.062, "peonyBlush": 0.058, "camellia": 0.054, "bell": 0.044}[kind], kind)
    for k in range(7):
        a_ = k * 0.9 + random.uniform(-0.3, 0.3)
        rr = random.uniform(0.05, 0.075)
        at = Vector(P(math.cos(a_) * rr, random.uniform(0.15, 0.2), math.sin(a_) * rr))
        out = at - MOUTH
        out.z = 0
        flower(at, out * 12 + Vector((0, 0, 1)), 0.05, "breath")
    BUDS = ["budViolet"] * 5
for i, kind in enumerate(BUDS):
    a_ = random.uniform(0, 2 * math.pi)
    rr = random.uniform(0.04, 0.065)
    at = Vector(P(math.cos(a_) * rr, random.uniform(0.15, 0.18), math.sin(a_) * rr))
    out = at - MOUTH
    out.z = 0
    flower(at, out * 12 + Vector((0, 0, 1)), 0.016, kind)

me = bpy.data.meshes.new("VaseCards")
me.from_pydata([tuple(v) for v in CV], [], CF)
me.update()
uvd = me.uv_layers.new().data
for poly, fu in zip(me.polygons, CUV):
    for li, uv in zip(poly.loop_indices, fu):
        uvd[li].uv = uv
cards = bpy.data.objects.new("VaseCards", me)
bpy.context.collection.objects.link(cards)
fin(cards, "VaseCards", M["cards"], smooth=False)

# (the plain one keeps its old file and root name)
NAME = "shrinevase" if VARIANT == 2 else f"shrinevase{VARIANT}"
root = bpy.data.objects.new("ShrineVase" if VARIANT == 2 else f"ShrineVase{VARIANT}", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
if PREVIEW:
    # (a close look for checking it: a camera a little above, a sun and a grey world)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.0, 0.24, 0.62)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(P(0, 0.12, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 70
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.45, 0.45, 1)
    bpy.context.scene.world = w
os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", f"{NAME}.glb"), os.path.join(PROJECT, "blender", f"{NAME}.blend"), PREVIEW)
print("SHRINEVASE_DONE", len(parts), "parts", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts), "tris")
