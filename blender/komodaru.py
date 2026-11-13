"""A stack of straw-wrapped sake barrels (菰樽): komodaru.glb, node "Komodaru", three barrels, two on the floor and one sat in the hollow
between them on top, as they're piled by a shop's door. A barrel 0.5 across and 0.42 tall, in metres, z up, the stack's middle at the
origin.

Low-poly, its detail in its pictures (the owner's, 2026-11-13, item 72: "far too many faces; it could be wrapped in a picture alone, and
it looks too plain", with a picture of real ones: the brewer's mark printed big right on the white straw mat, 登録商標 across its head,
chrysanthemums or a pine beside the name, small red writing and a red seal; "the names needn't be those, the layout can change a little").
It was 9,600 triangles of tubes and blades. Now each barrel a squat cask of 20 sides, its straw rolled over at the rim; its mat, its cords
and its print all painted round it in one picture, a row of it a barrel (KomoStraw: the woven rows, the grime; two thin cords round it near
the top and the foot, pairs of thick ones up its sides, none across the print), with a normal map from the same heights; its lid a low
dome painted with the straw folded in under a rope ring and its knot (KomoLid); the mat's straw ends frayed over the rim and the cord's two
ends hanging at its side, pictures on cards cut out by their alpha (KomoCards: drawn double-sided, alpha-tested, no ink line). About
1,000 triangles the stack. The brands are made up (聞野 the shop's own; 福壽, 玉泉 plain words), none a real brewer's.

Run:
    blender -b --factory-startup --python blender/komodaru.py -- <project path> [preview.png]
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(4)
rng = np.random.default_rng(3)


def active():
    return bpy.context.view_layer.objects.active


R, HT = 0.25, 0.42
NA = 20                       # (round the barrel: 16 showed its corners on the outline)
FRONT_U = 0.75                # (where round the picture its front is (toward -y); u grows to the right seen from the front)
# (the body's rings: (height as a share of HT, radius as a share of R): drawn in a little at the foot, full at the middle, the straw
# rolling over at the rim)
PROFILE = ((0.0, 0.93), (0.05, 0.975), (0.35, 1.0), (0.7, 1.0), (0.92, 0.975), (1.0, 0.9))


def cdist(du):
    """a distance round the barrel in u, the short way"""
    return np.abs(((du + 0.5) % 1.0) - 0.5)


# =====================================================================
# The sides' picture: three rows, a barrel each (row 0 the foot of barrel 0); in a row u round the barrel once, v up it
# =====================================================================
SW, RH = 2048, 512
PPM_X, PPM_Y = SW / (2 * math.pi * R), RH / HT        # (pixels a metre, round and up)


def straw_row(seed):
    u = np.tile((np.arange(SW) + 0.5) / SW, (RH, 1))
    v = np.tile(((np.arange(RH) + 0.5) / RH)[:, None], (1, SW))
    # (the mat: pale straw woven in close rows round it, each row a little its own shade; a fibre's grain along each, the rows' edges
    # grooved darker)
    # (the rows not ruled: each wanders a little up and down round the barrel, some fatter than others)
    ROWS = 84
    rs = np.random.default_rng(40 + seed)
    wob = np.zeros_like(u)
    for f_ in (3, 7, 13):
        wob += np.sin(u * 2 * math.pi * f_ + rs.uniform(0, 6.3)) * (0.18 / f_ ** 0.5)
    rv = v * ROWS + wob + 0.25 * np.sin(v * ROWS * 0.37 + rs.uniform(0, 6.3))
    row = np.floor(rv)
    tone = (np.sin((row + seed * 31) * 12.9898) * 43758.5453) % 1.0
    col = mix((0.84, 0.82, 0.74), (0.96, 0.94, 0.88), tone)
    # (each row's straws: streaks along it, a few darker, a few paler, every straw its own length)
    for k_, (fq, amp) in enumerate(((1900, 0.07), (780, 0.06), (260, 0.05))):
        ph = (np.sin((row + k_ * 17.3) * 78.233) * 12345.678) % 1.0
        col = col * (1 - amp + amp * np.sin(u * fq * (0.8 + 0.4 * ph) + ph * 40) * np.sign(ph - 0.5))[..., None]
    knots = smooth(0.7, 0.9, fbm(SW, 90, 18, 2)[:RH, :])
    col = mix(col, (0.7, 0.65, 0.52), knots * 0.25)
    edge = np.abs((rv % 1.0) - 0.5) * 2
    weave = 0.8 + 0.2 * (1 - edge ** 3)
    col = col * weave[..., None]
    height = (1 - edge ** 2) * 0.35
    # (the straw rolled over at the rim and gathered at the foot: shaded)
    col = col * (0.82 + 0.18 * smooth(1.0, 0.9, v) * smooth(0.0, 0.06, v))[..., None]
    return u, v, col, height, weave


def cord(dist_px, along, radius_px, col, height, light=1.0):
    """a twisted cord over the mat: within `radius_px` of its line, its strands spiralling round it (`along`: pixels along it), lit across
    it, a shadow just outside it; its heights up into the normal map"""
    on = dist_px < radius_px
    sh = (dist_px >= radius_px) & (dist_px < radius_px * 1.7)
    col[sh] = col[sh] * 0.7
    across = np.clip(dist_px / radius_px, 0, 1)
    twist = np.sin((along / (radius_px * 1.2) + across * 2.2) * math.pi)
    rc = mix((0.62, 0.6, 0.53), (0.9, 0.88, 0.8), smooth(-0.7, 0.9, twist))
    shade = (0.6 + 0.4 * np.sqrt(np.clip(1 - across ** 2, 0, 1))) * light
    rc = rc * shade[..., None]
    col[on] = rc[on]
    height[on] = np.maximum(height[on], 0.9 * np.sqrt(np.clip(1 - across[on] ** 2, 0, 1)) + 0.15 * twist[on])


# ---- the print's pieces, drawn as coverage masks (supersampled), then laid on in their colours over the weave
SS = 2
FONTS = ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/yumindb.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc")
FONT_BRUSH = ("C:/Windows/Fonts/HGRGY.TTC", "C:/Windows/Fonts/HGRSGU.TTC", "C:/Windows/Fonts/HGRKK.TTC") + FONTS
_glyphs = {}


def glyph(ch, brush):
    """a character's triangles in its own plane, its em a unit, centred"""
    key = (ch, brush)
    if key in _glyphs:
        return _glyphs[key]
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = active()
    tx.data.body = ch
    for f in (FONT_BRUSH if brush else FONTS):
        if os.path.exists(f):
            tx.data.font = bpy.data.fonts.load(f, check_existing=True)
            break
    tx.data.size = 1.0
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    tx.data.resolution_u = 5
    bpy.ops.object.convert(target="MESH")
    o = active()
    bm_ = bmesh.new(); bm_.from_mesh(o.data)
    bmesh.ops.triangulate(bm_, faces=bm_.faces[:])
    tris = [[(lp.vert.co.x, lp.vert.co.y) for lp in f.loops] for f in bm_.faces]
    bm_.free()
    bpy.data.objects.remove(o)
    _glyphs[key] = tris
    return tris


def fill_tris(mask, tris, cx, cy, sx, sy):
    """the triangles filled into `mask`, centred at pixel (cx, cy), scaled `sx`, `sy` pixels a unit; rows up"""
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
        neg = (d1 < 0) | (d2 < 0) | (d3 < 0)
        pos = (d1 > 0) | (d2 > 0) | (d3 > 0)
        mask[y0:y1 + 1, x0:x1 + 1] |= ~(neg & pos)


class Print:
    """one barrel's print, drawn in metres from the middle of its front (x to the right round it, y up from its foot)"""

    def __init__(self):
        self.layers = []
        H_, W_ = RH * SS, SW * SS
        yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32) + 0.5
        self.x = (xx / SS - FRONT_U * SW) / PPM_X
        self.y = yy / SS / PPM_Y

    def text(self, chars, x, y, size, colour, vertical=True, brush=False, gap=1.0):
        """`chars` from (x, y) (its first character's middle), down if `vertical`, else to the right; `size` the em in metres"""
        m = np.zeros((RH * SS, SW * SS), bool)
        for i, ch in enumerate(chars):
            cx, cy = (x, y - i * size * gap) if vertical else (x + i * size * gap, y)
            fill_tris(m, glyph(ch, brush), (FRONT_U * SW + cx * PPM_X) * SS, cy * PPM_Y * SS, size * PPM_X * SS, size * PPM_Y * SS)
        if brush:
            # (fattened as a big brush writes it: a broad nib, its strokes thicker down than across)
            ys, xs = np.nonzero(m)
            pad = 14
            y0, y1, x0, x1 = max(0, ys.min() - pad), ys.max() + pad, max(0, xs.min() - pad), xs.max() + pad
            sub = m[y0:y1, x0:x1]
            out = sub.copy()
            rx, ry = int(size * PPM_X * SS * 0.045), int(size * PPM_Y * SS * 0.03)
            for dy in range(-ry, ry + 1):
                for dx in range(-rx, rx + 1):
                    if (dx / max(rx, 1)) ** 2 + (dy / max(ry, 1)) ** 2 <= 1:
                        out |= np.roll(np.roll(sub, dy, 0), dx, 1)
            m[y0:y1, x0:x1] = out
        self.layers.append((m, colour))

    def shape(self, fn, colour):
        """a shape from a function of (x, y) in metres from the front's middle (boolean)"""
        self.layers.append((fn(self.x, self.y), colour))

    def onto(self, col, weave, fade):
        """laid over the mat: the ink takes the weave's grooves, worn a little unevenly"""
        for m, colour in self.layers:
            cov = m.reshape(RH, SS, SW, SS).mean(axis=(1, 3))
            ink = np.asarray(colour, np.float32)[None, None, :] * (0.8 + 0.2 * weave)[..., None]
            col[:] = mix(col, ink, np.clip(cov * fade, 0, 1))


def chrysanthemum(pr, x0, y0, rr, stem_to=None):
    """a big yellow chrysanthemum (round, its petals many), its leaves green, outlined in ink; centred at (x0, y0), `rr` its radius"""
    def flower(f):
        def fn(x, y):
            d, a = np.sqrt((x - x0) ** 2 + (y - y0) ** 2), np.arctan2(y - y0, x - x0)
            saw = np.abs(((a / (2 * math.pi)) * 24) % 1.0 - 0.5) * 2
            return d < rr * (0.8 + 0.2 * (1 - saw) ** 1.5) * f
        return fn
    if stem_to is not None:
        pr.shape(lambda x, y: (np.abs(x - x0 - (y - y0) * 0.15) < 0.0035) & (y < y0) & (y > stem_to), (0.2, 0.42, 0.18))
        for sd, ly in ((-1, 0.62), (1, 0.42), (-1, 0.25)):
            lyy = y0 - (y0 - stem_to) * ly
            lx = x0 + sd * rr * 0.7

            def leaf(x, y, lx=lx, lyy=lyy, f=1.0):
                # (a chrysanthemum's leaf: lobed deep down its sides)
                return (((x - lx) / (rr * 0.8 * f)) ** 2 + ((y - lyy) / (rr * 0.48 * f)) ** 2 + 0.55 * np.abs(np.sin((x - lx) / rr * 7)) ** 1.5) < 1
            pr.shape(lambda x, y, leaf=leaf: leaf(x, y, f=1.12), (0.08, 0.12, 0.06))
            pr.shape(leaf, (0.24, 0.5, 0.2))
            pr.shape(lambda x, y, lx=lx, lyy=lyy: (np.abs(y - lyy) < 0.0012) & (np.abs(x - lx) < rr * 0.6), (0.1, 0.25, 0.08))
    pr.shape(flower(1.08), (0.45, 0.25, 0.05))
    pr.shape(flower(1.0), (0.95, 0.74, 0.2))

    # (its petals: three rings of long narrow ones, each ring set between the last's, an ink line between each two; the middle a tight boss)
    def petal_lines(x, y):
        d, a = np.sqrt((x - x0) ** 2 + (y - y0) ** 2), np.arctan2(y - y0, x - x0)
        t = d / rr
        out = np.zeros_like(x, bool)
        for j, (t0, t1, n_) in enumerate(((0.62, 1.0, 22), (0.36, 0.7, 18), (0.16, 0.42, 14))):
            ph = (a / (2 * math.pi) * n_ + j * 0.5) % 1.0
            out |= (t > t0) & (t < t1) & (np.abs(ph - 0.5) > 0.42)
        return out & (t < 1.0)
    pr.shape(petal_lines, (0.58, 0.34, 0.06))
    pr.shape(lambda x, y: np.sqrt((x - x0) ** 2 + (y - y0) ** 2) < rr * 0.12, (0.72, 0.46, 0.1))


def pine(pr, x0, y0, w):
    """a pine's green crown across the top, in rounded lobes, its needles in fine stripes, outlined"""
    lobes = [(x0 + (i - 3) * w / 6.5, y0 + 0.012 * math.cos(i * 1.7), w / 8.5) for i in range(7)]

    def crown(f):
        def fn(x, y):
            m = np.zeros_like(x, bool)
            for lx, ly, lr in lobes:
                m |= (((x - lx) / (lr * f)) ** 2 + ((y - ly) / (lr * 0.5 * f)) ** 2) < 1
            return m
        return fn
    pr.shape(crown(1.12), (0.06, 0.16, 0.08))
    pr.shape(crown(1.0), (0.2, 0.52, 0.28))
    pr.shape(lambda x, y: crown(0.95)(x, y) & (np.abs(((x * 260 + np.abs(y - y0) * 120) % 1.0) - 0.5) < 0.12), (0.1, 0.3, 0.14))


RED, INK = (0.72, 0.12, 0.08), (0.07, 0.06, 0.06)


def seal(pr, x0, y0, rr, chars):
    """a red round seal: a ring, two or four characters inside"""
    pr.shape(lambda x, y: np.abs(np.sqrt((x - x0) ** 2 + (y - y0) ** 2) - rr) < rr * 0.09, RED)
    if len(chars) == 2:
        for i, ch in enumerate(chars):
            pr.text(ch, x0, y0 + (0.5 - i) * rr * 0.85, rr * 0.75, RED)
    else:
        for i, ch in enumerate(chars):
            pr.text(ch, x0 + (0.5 - i // 2) * rr * 0.8, y0 + (0.5 - i % 2) * rr * 0.85, rr * 0.7, RED)


def design(k):
    pr = Print()
    pr.text("登録商標", -0.07, HT * 0.9, 0.024, RED, vertical=False, gap=1.6)
    if k == 0:
        # (the shop's own: 聞野 big and brushed, a chrysanthemum either side, its grade in red at the left, its seal at the right)
        pr.text("聞野", 0.0, HT * 0.64, 0.12, INK, brush=True, gap=1.02)
        chrysanthemum(pr, -0.13, HT * 0.62, 0.034, stem_to=HT * 0.2)
        chrysanthemum(pr, 0.13, HT * 0.62, 0.034, stem_to=HT * 0.2)
        pr.text("特撰清酒", -0.205, HT * 0.7, 0.02, RED)
        seal(pr, 0.205, HT * 0.32, 0.024, "聞野酒造")
        pr.text("キキノ", -0.028, HT * 0.13, 0.022, RED, vertical=False, gap=1.1)
    elif k == 1:
        # (福壽 in a ruled frame under a pine's crown, its grade either side in ink, a seal low at the right)
        pine(pr, 0.0, HT * 0.73, 0.24)
        pr.shape(lambda x, y: (((np.abs(np.abs(x) - 0.095) < 0.0025) & (y > HT * 0.12) & (y < HT * 0.63))
                               | (((np.abs(y - HT * 0.63) < 0.0025) | (np.abs(y - HT * 0.12) < 0.0025)) & (np.abs(x) < 0.0975))), INK)
        pr.text("福", 0.0, HT * 0.5, 0.09, INK, brush=True)
        pr.text("壽", 0.0, HT * 0.26, 0.09, INK, brush=True)
        pr.text("本醸造", -0.15, HT * 0.62, 0.022, INK)
        pr.text("生一本", 0.15, HT * 0.62, 0.022, INK)
        seal(pr, 0.15, HT * 0.2, 0.02, "福壽")
    else:
        # (玉泉 big and brushed down the middle, its maker in red down the left in a ring, its grade at the right, a seal under it)
        pr.text("玉泉", 0.01, HT * 0.65, 0.125, INK, brush=True)
        pr.text("吟醸", -0.12, HT * 0.68, 0.026, RED)
        pr.text("酒造", -0.155, HT * 0.68, 0.026, RED)
        seal(pr, -0.137, HT * 0.3, 0.03, "玉泉")
        pr.text("御酒", 0.15, HT * 0.68, 0.026, RED)
        seal(pr, 0.15, HT * 0.3, 0.02, "玉泉")
    return pr


rows_c, rows_h = [], []
for k in range(3):
    u, v, col, height, weave = straw_row(k)
    design(k).onto(col, weave, 0.92 - 0.2 * smooth(0.5, 0.8, fbm(SW, 8, 8, 3)[:RH, :]))
    # (the cords: a thin one round near the head and near the foot; pairs of thick ones up the sides and the back, clear of the print)
    for vb in (0.08, 0.83):
        cord(np.abs(v - vb) * RH, u * SW, 0.007 * PPM_Y, col, height)
    for uc in (FRONT_U + 0.25, FRONT_U + 0.5, FRONT_U + 0.75):
        for du in (-0.012, 0.012):
            cord(cdist(u - (uc + du)) * SW, v * RH, 0.009 * PPM_X, col, height)
    # (weathered: grubby toward the foot and at the rim, stains, the whole a little uneven)
    g = fbm(SW, 6, 3, 4)[:RH, :]
    col = mix(col, (0.55, 0.52, 0.42), np.clip(smooth(0.2, 0.0, v) * 0.4 + smooth(0.9, 1.0, v) * 0.25, 0, 1))
    col = mix(col, (0.62, 0.58, 0.46), smooth(0.62, 0.88, g) * 0.3)
    col = col * (0.92 + 0.1 * fbm(SW, 30, 15, 3)[:RH, :])[..., None]
    col = col * (0.7 + 0.3 * smooth(0.0, 0.12, v))[..., None]
    rows_c.append(col); rows_h.append(height)
side_col = np.clip(np.concatenate(rows_c, 0), 0, 1).astype(np.float32)
side_nrm = to_normal(np.concatenate(rows_h, 0).astype(np.float32), 2.5).astype(np.float32)

# =====================================================================
# The lid's picture (looking down on it, its middle the picture's): the straw folded in from the rim in pleats, a rope ring, its knot
# =====================================================================
LN = 512
lu_, lv_ = grid01(LN)
lx, ly = lu_ * 2 - 1, lv_ * 2 - 1
lr, la = np.sqrt(lx ** 2 + ly ** 2), np.arctan2(ly, lx)
spoke = np.floor((la / (2 * math.pi) + 0.5) * 160)
ltone = (np.sin(spoke * 7.31) * 9133.7) % 1.0
lcol = mix((0.76, 0.74, 0.66), (0.9, 0.88, 0.8), ltone)
lcol = lcol * (0.84 + 0.16 * np.abs(np.sin(la * 80)))[..., None]
lcol = lcol * (0.72 + 0.28 * smooth(0.0, 0.55, lr))[..., None]
lcol = mix(lcol, (0.5, 0.47, 0.38), smooth(0.6, 0.85, fbm(LN, 5, 5, 3)) * 0.4)
lht = (np.abs(np.sin(la * 80)) * 0.2).astype(np.float32)
cord(np.abs(lr - 0.72) * LN / 2, la * LN / 2 * 0.72, 0.012 / R * LN / 2, lcol, lht)
kx, ky = 0.0, -0.72
for cx_, cy_, rr in ((kx, ky, 0.08), (kx - 0.11, ky + 0.04, 0.05), (kx + 0.11, ky + 0.04, 0.05)):
    dd = np.sqrt((lx - cx_) ** 2 + (ly - cy_) ** 2)
    cord(np.abs(dd - rr * 0.55) * LN / 2, np.arctan2(ly - cy_, lx - cx_) * 60, rr * 0.45 * LN / 2, lcol, lht)
lid_col = np.clip(lcol, 0, 1).astype(np.float32)
lid_nrm = to_normal(lht, 2.5).astype(np.float32)

# =====================================================================
# The cards' picture, cut out by its alpha: the straw ends frayed over a rim (the top quarter, the rim along its top) and a cord's end with
# its frayed tassel (the left quarter of the rest, its knot at the top)
# =====================================================================
CW, CH = 512, 512
ccol = np.zeros((CH, CW, 3), np.float32)
cal = np.zeros((CH, CW), np.float32)
yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
STRAW_LO, STRAW_HI = np.array((0.7, 0.68, 0.6), np.float32), np.array((0.92, 0.9, 0.83), np.float32)
for _ in range(190):
    x0 = rng.uniform(0, CW)
    L, w, lean = rng.uniform(40, 125), rng.uniform(2.0, 4.5), rng.uniform(-0.35, 0.35)
    t = (CH - 1 - yy) / L
    xc = x0 + lean * (CH - 1 - yy)
    on = (t >= 0) & (t <= 1) & (np.abs(xx - xc) < w * (1 - 0.6 * t)) & (yy >= 384)
    c = STRAW_LO + (STRAW_HI - STRAW_LO) * rng.random()
    ccol[on] = c * (0.75 + 0.25 * (1 - t[on]))[:, None]
    cal[on] = 1
rx = 64.0
rope_d = np.abs(xx - rx)
on = (yy >= 100) & (yy < 384) & (xx < 128) & (rope_d < 8)
tw = np.sin(((yy / 8) + rope_d / 8 * 2.2) * math.pi)
rope_c = mix((0.62, 0.6, 0.53), (0.9, 0.88, 0.8), smooth(-0.7, 0.9, tw)) * (0.62 + 0.38 * np.sqrt(np.clip(1 - (rope_d / 8) ** 2, 0, 1)))[..., None]
ccol[on] = rope_c[on]
cal[on] = 1
for _ in range(26):
    ang = rng.uniform(-0.45, 0.45)
    L = rng.uniform(50, 95)
    t = (100 - yy) / L
    xc = rx + ang * (100 - yy)
    on = (t >= 0) & (t <= 1) & (np.abs(xx - xc) < 1.8) & (xx < 128)
    ccol[on] = (0.84, 0.82, 0.74)
    cal[on] = 1

M = {
    "straw": pbr("KomoStraw", (1, 1, 1), tex=image("komo_straw", side_col), nrm=image("komo_straw_n", side_nrm, data=True), nrm_strength=1.0, rough=0.85),
    "lid": pbr("KomoLid", (1, 1, 1), tex=image("komo_lid", lid_col), nrm=image("komo_lid_n", lid_nrm, data=True), nrm_strength=1.0, rough=0.85),
    "cards": pbr("KomoCards", (1, 1, 1), tex=image("komo_cards", np.clip(ccol, 0, 1), alpha=cal), rough=0.85, blend=True),
}
parts = []


def fin(o, mat, smooth_=True):
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth_
    parts.append(o)
    return o


def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return o


def barrel(at, turn, k):
    """one komodaru at `at` (its foot's middle), turned `turn` about z; its print row k"""
    start = len(parts)
    v0, v1 = (k * RH + 1) / (3 * RH), ((k + 1) * RH - 1) / (3 * RH)
    # (the body: 16 round, its rings up its profile; its row of the sides' picture round it once)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new((math.cos(2 * math.pi * i / NA) * R * rr, math.sin(2 * math.pi * i / NA) * R * rr, t * HT)) for i in range(NA)]
             for t, rr in PROFILE]
    for j in range(len(PROFILE) - 1):
        for i in range(NA):
            i2 = (i + 1) % NA
            f = bm.faces.new((rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]))
            u0, u1 = i / NA, (i + 1) / NA
            va, vb = v0 + (v1 - v0) * PROFILE[j][0], v0 + (v1 - v0) * PROFILE[j + 1][0]
            for l, uvq in zip(f.loops, ((u0, va), (u1, va), (u1, vb), (u0, vb))):
                l[uvl].uv = uvq
    for f in ladder_fill(bm, rings[0][::-1]):
        for l in f.loops:
            l[uvl].uv = (0.5, v0 + 0.01)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    fin(mesh_obj(f"KomoBody{k}", bm), M["straw"])
    # (the lid: a low dome in toward the middle, the straw's roll high round its edge, laddered across; its picture laid on from above)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rt = R * PROFILE[-1][1]
    rim = [bm.verts.new((math.cos(2 * math.pi * i / NA) * rt, math.sin(2 * math.pi * i / NA) * rt, HT)) for i in range(NA)]
    lid = [rim] + [[bm.verts.new((v.co.x * fr, v.co.y * fr, HT + up)) for v in rim] for fr, up in ((0.82, 0.016), (0.5, 0.012))]
    faces = []
    for a_, b_ in zip(lid, lid[1:]):
        for i in range(NA):
            i2 = (i + 1) % NA
            faces.append(bm.faces.new((a_[i], a_[i2], b_[i2], b_[i])))
    faces += ladder_fill(bm, lid[-1])
    for f in faces:
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = (0.5 + co.x / rt * 0.5, 0.5 + co.y / rt * 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    fin(mesh_obj(f"KomoLid{k}", bm), M["lid"])
    # (the cards: the straw ends frayed over the rim, sixteen leaning out and down round it; the cord's two ends down its side by the side
    # cords, each two crossed strips)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    for i in range(NA):
        a0, a1 = 2 * math.pi * (i - 0.1) / NA, 2 * math.pi * (i + 1.1) / NA
        r0 = rt - 0.004
        drop, out = random.uniform(0.03, 0.045), random.uniform(0.016, 0.024)
        q = [Vector((math.cos(a) * r0, math.sin(a) * r0, HT + 0.008)) for a in (a0, a1)]
        q += [Vector((math.cos(a) * (r0 + out), math.sin(a) * (r0 + out), HT - drop)) for a in (a1, a0)]
        f = bm.faces.new([bm.verts.new(p) for p in q])
        s0 = (i % 4) / 4
        for l, uvq in zip(f.loops, ((s0, 1.0), (s0 + 0.25, 1.0), (s0 + 0.25, 0.75), (s0, 0.75))):
            l[uvl].uv = uvq
    for sd, ln in ((-1, 0.15), (1, 0.11)):
        a = 2 * math.pi * (FRONT_U + 0.25) + sd * 0.1       # (at the right side, either side of its pair of cords)
        top = Vector((math.cos(a) * (R + 0.008), math.sin(a) * (R + 0.008), HT * 0.83 + 0.01))
        foot = Vector((math.cos(a) * (R + 0.014), math.sin(a) * (R + 0.014), HT * 0.83 - ln))
        outv = Vector((math.cos(a), math.sin(a), 0))
        for across in (Vector((-math.sin(a), math.cos(a), 0)), outv):
            w = 0.026
            vs = [bm.verts.new(p) for p in (foot - across * w / 2, foot + across * w / 2, top + across * w / 2, top - across * w / 2)]
            f = bm.faces.new(vs)
            for l, uvq in zip(f.loops, ((0.0, 0.0), (0.25, 0.0), (0.25, 0.75), (0.0, 0.75))):
                l[uvl].uv = uvq
    fin(mesh_obj(f"KomoCards{k}", bm), M["cards"], smooth_=False)
    # (the whole barrel turned and set in place, a hair askew)
    tilt = Matrix.Rotation(random.uniform(-0.025, 0.025), 4, "X")
    for o in parts[start:]:
        o.matrix_world = Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z") @ tilt @ o.matrix_world


# (two on the floor side by side, the third sat on them in the hollow between, set back a touch)
barrel(Vector((-R * 1.03, 0, 0)), 0.15, 0)
barrel(Vector((R * 1.03, 0.02, 0)), -0.2, 1)
barrel(Vector((0, 0.07, HT + 0.012)), 0.05, 2)        # (resting on the two lids' straw rolls, not sunk in them)

# (all of each joined by material, to keep the draw calls down)
by = {}
for o in parts:
    by.setdefault(o.data.materials[0].name, []).append(o)
joined = []
for mname, os_ in by.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in os_:
        o.select_set(True)
    bpy.context.view_layer.objects.active = os_[0]
    bpy.ops.object.join()
    os_[0].name = os_[0].data.name = mname
    joined.append(os_[0])
root = bpy.data.objects.new("Komodaru", None)
bpy.context.collection.objects.link(root)
for o in joined:
    o.parent = root
print("KOMODARU_TRIS", sum(len(p.vertices) - 2 for o in joined for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.35, -1.7, 0.75)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0.4)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.7, 0.2, 0.5)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.47, 0.5, 1)
    bpy.context.scene.world = w
export_dish(root, joined + [root], os.path.join(PROJECT, "public", "models", "komodaru.glb"), os.path.join(PROJECT, "blender", "komodaru.blend"), PREVIEW)
print("KOMODARU_DONE")
