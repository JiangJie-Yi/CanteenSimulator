"""A sake stand on the cook table (酒台): sakestand.glb, node "SakeStand", a low two-stepped stand of hinoki with the shop's sake on it,
three 1.8-litre bottles (一升瓶) up on its back step and two 720 ml ones (四合瓶) on its front, as a grill shop shows what it pours. In
metres, z up, the stand's foot's middle at the origin, its front toward -y.

The owner's (2026-11-13, item 73: "a sake stand in the red box, a few bottles of sake on it", with four Sketchfab sake bottles to go by;
low-poly, its look real). Low-poly by docs/LOWPOLY.md: each bottle a lathe of 16 round and six rings (foot, shoulder, neck, the paper cap),
its ends laddered; its glass, its label and its cap all painted in one picture (SakeBottles: a column a bottle, round it once), drawn in
one material shiny as glass (the game gives it the studio's reflection), no transmission. The stand an extruded step, its hinoki and its
black-lacquered edges painted (SakeStandWood). The makes made up after the way real brewers name theirs (雪嶺錦, 朝霞川, 鶴汀, 月汀桜; the owner's), each
looked for and none found to be a real one.

Run:
    blender -b --factory-startup --python blender/sakestand.py -- <project path> [preview.png]
"""
import math
import os
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
rng = np.random.default_rng(7)

NA = 16
# (the two bottles' outlines, (radius, height) up from the foot: the foot's chamfer, the body, the shoulder, the neck, the paper cap's skirt
# and its top)
ISSHO = ((0.048, 0.0), (0.052, 0.008), (0.052, 0.235), (0.036, 0.29), (0.0165, 0.33), (0.0165, 0.362), (0.0185, 0.366), (0.0185, 0.395))
YONGO = ((0.037, 0.0), (0.04, 0.006), (0.04, 0.18), (0.028, 0.222), (0.0135, 0.25), (0.0135, 0.272), (0.0155, 0.276), (0.0155, 0.298))
CAP_FROM = 5          # (from this point up, the paper cap)

# =====================================================================
# The bottles' picture: one column each (u round the bottle once, its front (-y) at the column's middle), v up it (the foot at 0, the
# cap's top at 1)
# =====================================================================
NB = 6                # (five bottles and the hang tag's picture)
CWID, CH = 512, 1024
SS = 2
FONTS = ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc")
# (the big names brushed: Yuji Boku, an open font (SIL OFL, blender/fonts/OFL-YujiBoku.txt), the owner's: "the labels' big characters
# brushed, as the real ones")
BRUSH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "YujiBoku-Regular.ttf")
_glyphs = {}


def glyph(ch, brush=False):
    if (ch, brush) in _glyphs:
        return _glyphs[(ch, brush)]
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = bpy.context.view_layer.objects.active
    tx.data.body = ch
    for f in ((BRUSH,) if brush else ()) + FONTS:
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
    _glyphs[(ch, brush)] = tris
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


def fatten(m, rx, ry):
    """thickened as a broad brush writes (rx, ry pixels)"""
    out = m.copy()
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx / max(rx, 1)) ** 2 + (dy / max(ry, 1)) ** 2 <= 1:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


class Col:
    """one bottle's column: drawing on it in metres round its front (x, to the right) and up its height (y), its circumference `circ`"""

    def __init__(self, circ, height, glass):
        self.circ, self.height = circ, height
        self.ppx, self.ppy = CWID / circ, CH / height
        u = (np.arange(CWID) + 0.5) / CWID
        v = (np.arange(CH) + 0.5) / CH
        self.uu, self.vv = np.meshgrid(u, v)
        self.x = (self.uu - 0.5) * circ
        self.y = self.vv * height
        # (the glass: its colour, deeper at the foot where it's thick, a faint seam up each side from the mould, tiny bubbles and wear)
        g = np.asarray(glass, np.float32)
        self.col = np.broadcast_to(g, (CH, CWID, 3)).copy()
        self.col *= (0.8 + 0.2 * smooth(0.0, 0.05, self.vv))[..., None]
        seam = (np.abs(cdist(self.uu - 0.25)) < 0.003) | (np.abs(cdist(self.uu - 0.75)) < 0.003)
        self.col[seam] *= 1.25
        self.col *= (0.94 + 0.06 * fbm(CWID, 20, 40, 3)[:CH // 2].repeat(2, 0)[:CH])[..., None]
        self.rough = np.full((CH, CWID), 0.12, np.float32)

    def rect(self, x0, x1, y0, y1):
        return (self.x >= x0) & (self.x <= x1) & (self.y >= y0) & (self.y <= y1)

    def paint(self, m, c, rough=0.75):
        self.col[m] = c
        self.rough[m] = rough

    def text(self, chars, x, y, size, c, vertical=True, gap=1.0, bold=0, x_centre=False, brush=False):
        if x_centre and not vertical:
            x -= (len(chars) - 1) * size * gap / 2
        m = np.zeros((CH * SS, CWID * SS), bool)
        for i, ch in enumerate(chars):
            cx, cy = (x, y - i * size * gap) if vertical else (x + i * size * gap, y)
            if ch == "　" or ch == " ":
                continue
            fill_tris(m, glyph(ch, brush), (cx / self.circ + 0.5) * CWID * SS, cy * self.ppy * SS, size * self.ppx * SS, size * self.ppy * SS)
        if bold:
            m = fatten(m, bold, max(1, bold * 2 // 3))
        cov = m.reshape(CH, SS, CWID, SS).mean(axis=(1, 3))
        self.col[:] = mix(self.col, c, cov)
        self.rough[cov > 0.5] = 0.7


def cdist(du):
    return np.abs(((du + 0.5) % 1.0) - 0.5)


def washi(col, m, base, fibre=0.06):
    """washi paper over `m`: its base colour, long fibres through it, a little uneven"""
    n = fbm(CWID, 60, 120, 2)[:CH // 2].repeat(2, 0)[:CH]
    f = np.abs(np.sin(col.x * 900 + n * 20) * np.sin(col.y * 300 + n * 9))
    c = np.asarray(base, np.float32)[None, None, :] * (1 - fibre + fibre * f)[..., None] * (0.96 + 0.06 * n)[..., None]
    col.col[m] = c[m]
    col.rough[m] = 0.85


def cap(col, top, skirt, paper, cord):
    """the paper cap (紙蓋): washi folded over the stopper and down the neck, pleated, tied round with a cord"""
    m = col.y > skirt
    washi(col, m, paper)
    pleat = m & (np.abs(((col.uu * 12) % 1.0) - 0.5) < 0.05)
    col.col[pleat] *= 0.82
    for yc in (skirt + (top - skirt) * 0.3,):
        band = np.abs(col.y - yc) < 0.0022
        col.paint(band, cord, 0.6)


RED = (0.7, 0.09, 0.07)
INK = (0.05, 0.045, 0.04)
GOLD = (0.8, 0.62, 0.27)
cols = []


def border(c, x0, x1, y0, y1, w, colour, rough=0.6):
    """a ruled frame `w` wide just inside the rectangle"""
    c.paint(c.rect(x0, x1, y0, y1) & ~c.rect(x0 + w, x1 - w, y0 + w, y1 - w), colour, rough)


def disc(c, x0, y0, r, colour, ring=0.0, rough=0.6):
    d = np.sqrt((c.x - x0) ** 2 + (c.y - y0) ** 2)
    c.paint((d < r) & (d >= r - ring) if ring else (d < r), colour, rough)


def worn(c, m, k=0.12):
    """the print a little worn where a hand takes the bottle"""
    n = fbm(CWID, 30, 60, 3)[:CH // 2].repeat(2, 0)[:CH]
    c.col[m] = mix(c.col, np.asarray((0.93, 0.9, 0.82), np.float32), smooth(0.62, 0.9, n) * k)[m]


def enso(c, x0, y0, r, w, colour, gap=0.6):
    """an ensō, the brushed circle: one stroke round, thick where the brush came down, thinning and dry as it ends, a gap where it began"""
    d = np.sqrt((c.x - x0) ** 2 + (c.y - y0) ** 2)
    a = (np.arctan2(c.y - y0, c.x - x0) + 2 * math.pi - gap) % (2 * math.pi)
    t = a / (2 * math.pi - 0.35)
    width = w * (1.0 - 0.75 * t) * (1 + 0.15 * np.sin(a * 7))
    on = (np.abs(d - r) < width / 2) & (t < 1)
    dry = np.sin((d - r) / max(w, 1e-6) * 40 + a * 3) > 0.6 - 0.9 * (1 - t)
    c.paint(on & ~(dry & (t > 0.55)), colour, 0.7)


def fine_print(c, x0, y0, cols_, size, colour, gap=1.05):
    """columns of small print right to left from x0 (ingredients, strength, the brewer's address), as a label carries"""
    for i, s_ in enumerate(cols_):
        c.text(s_, x0 - i * size * 1.35, y0, size, colour, gap=gap)


def flecks(c, m, n, colour, size):
    """gold leaf flecks scattered over `m`"""
    r_ = np.random.default_rng(int(size * 1e5) + n)
    ys, xs = np.nonzero(m)
    if not len(ys):
        return
    for _ in range(n):
        i = r_.integers(0, len(ys))
        cx, cy = c.x[ys[i], xs[i]], c.y[ys[i], xs[i]]
        s_ = size * r_.uniform(0.4, 1.4)
        c.paint(m & (np.abs(c.x - cx) < s_) & (np.abs(c.y - cy) < s_ * r_.uniform(0.5, 1.2)), colour, 0.3)


def peaks(c, m, x0, x1, base, top, colour, seed):
    """a range of mountains in grey wash across the label's foot, their tops snow-pale"""
    r_ = np.random.default_rng(seed)
    ridge = np.full_like(c.x, base)
    for _ in range(4):
        px, ph, pw = r_.uniform(x0, x1), r_.uniform(0.4, 1.0) * (top - base), r_.uniform(0.02, 0.04)
        ridge = np.maximum(ridge, base + ph * np.clip(1 - np.abs(c.x - px) / pw, 0, 1) ** 1.3)
    under = m & (c.y < ridge) & (c.y > base - 0.002)
    shade = smooth(base, top, c.y)
    c.col[under] = mix(c.col, np.asarray(colour, np.float32), (0.35 + 0.45 * (1 - shade)))[under]
    c.col[under & (c.y > ridge - 0.004)] = (0.9, 0.9, 0.9)


def neck_label(c, y0, y1, w, base, ink, big, small=None):
    """the shoulder label (肩貼り): a band of paper round the neck, its grade big, a romanised line under it"""
    m = c.rect(-w, w, y0, y1)
    washi(c, m, base)
    border(c, -w, w, y0, y1, 0.0009, ink)
    hh = y1 - y0
    sz = min(hh * (0.48 if small else 0.62), 2 * w * 0.85 / (len(big) * 1.05))
    c.text(big, 0.0, y0 + hh * (0.62 if small else 0.5), sz, ink, vertical=False, gap=1.05, x_centre=True, brush=True)
    if small:
        c.text(small, 0.0, y0 + hh * 0.2, min(hh * 0.15, 2 * w * 0.9 / (len(small) * 0.62)), ink, vertical=False, gap=0.62, x_centre=True)


def screw_cap(c, top, skirt, colour):
    """a metal screw cap: its skirt ribbed, a bright line where it's rolled over, a dull top"""
    m = c.y > skirt
    rib = np.abs(((c.uu * 48) % 1.0) - 0.5) < 0.18
    c.paint(m, colour, 0.3)
    c.col[m & rib] *= 0.8
    c.col[m & (np.abs(c.y - (skirt + (top - skirt) * 0.25)) < 0.0012)] = np.asarray(colour) * 1.25
    c.col[m & (c.y > top - 0.002)] *= 0.85


ADDR = "株式会社　{0}酒造　新潟県南魚沼市"
INFO = ("原材料名　米（国産）米麹（国産米）", "精米歩合　五〇％　アルコール分十五度", "内容量　{1}", "製造年月　令和七年十月")

# (the makes made up after the way real brewers name theirs (the owner's: "made up, after real brewers'"), each looked for and none found)
H = ISSHO[-1][1]
# 0: 雪嶺錦 (1.8 l), 特別純米: brown glass; a tall cream label, gold leaf flecks over it, snowy peaks in grey wash across its foot, the name
# brushed big down its middle, 特別純米 in red beside it, the romanised name and the brewer small at its foot; a cream shoulder label
c = Col(2 * math.pi * 0.052, H, (0.2, 0.09, 0.03))
X0, X1, Y0, Y1 = -0.052, 0.052, 0.045, 0.218
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.93, 0.91, 0.84))
peaks(c, lab, X0, X1, Y0 + 0.012, Y0 + 0.06, (0.45, 0.47, 0.5), 3)
flecks(c, lab & (c.y > Y0 + 0.07), 70, GOLD, 0.0012)
c.text("雪嶺錦", 0.004, 0.185, 0.044, INK, brush=True, gap=0.98)
c.text("特別純米", 0.036, 0.2, 0.0115, RED, brush=True, gap=1.05)
disc(c, -0.033, 0.198, 0.0085, GOLD, ring=0.0012, rough=0.35)
c.text("雪", -0.033, 0.198, 0.009, GOLD, brush=True)
fine_print(c, -0.03, 0.17, [s.format("雪嶺", "一八〇〇ml") for s in INFO[:3]], 0.0042, INK)
c.text("SETSUREI-NISHIKI", 0.0, Y0 + 0.008, 0.0042, INK, vertical=False, gap=0.62, x_centre=True)
worn(c, lab)
neck_label(c, 0.258, 0.284, 0.024, (0.92, 0.88, 0.76), RED, "特撰", "TOKUSEN")
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.93, 0.9, 0.84), RED)
cols.append(c)

# 1: 朝霞川 (1.8 l), 純米吟醸: green glass; a white label, the name brushed big at its right, the grade small brushed over it, a red seal
# under it, columns of small print down its left, a pale blue wash of waves along its foot, the brewer's mark; a silver screw cap
c = Col(2 * math.pi * 0.052, H, (0.1, 0.32, 0.12))
X0, X1, Y0, Y1 = -0.05, 0.05, 0.05, 0.2
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.97, 0.96, 0.93), fibre=0.03)
wave = lab & (c.y < Y0 + 0.022)
for k_ in range(8):
    for j in range(3):
        cx, cy = X0 + (k_ + 0.5 * (j % 2)) * 0.014, Y0 + 0.003 + j * 0.008
        d = np.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2)
        c.paint(wave & (np.abs(((d / 0.0024) % 1.0) - 0.5) < 0.2) & (d < 0.0085) & (c.y > cy), (0.55, 0.7, 0.85), 0.8)
c.text("朝霞", 0.016, 0.168, 0.042, INK, brush=True, gap=0.98)
c.text("川", 0.016, 0.083, 0.042, INK, brush=True)
c.text("純米吟醸", 0.016, 0.193, 0.0085, INK, vertical=False, gap=1.02, x_centre=True)
c.paint(c.rect(0.036, 0.046, 0.058, 0.068), RED, 0.7)
c.text("霞", 0.041, 0.063, 0.0075, (0.97, 0.94, 0.88))
fine_print(c, -0.022, 0.185, ["清酒", "原材料名　米・米麹", "アルコール分十五度", "精米歩合五五％", "内容量一八〇〇ml", "朝霞川酒造株式会社"], 0.0042, INK)
c.paint(c.rect(-0.046, -0.036, 0.06, 0.07), (0.25, 0.3, 0.6), 0.6)
c.text("A", -0.041, 0.065, 0.0075, (0.97, 0.97, 0.97))
screw_cap(c, H, ISSHO[CAP_FROM][1] - 0.006, (0.72, 0.74, 0.76))
cols.append(c)

# 2: 鶴汀 (1.8 l), 純米大吟醸: dark green glass; a black label, the name brushed big in gold, a red ring seal of 大吟醸 on it, 酒の元祖-like
# lines in gold small, a cream shoulder label 純米大吟醸 with its romanised name; a gold paper cap
c = Col(2 * math.pi * 0.052, H, (0.05, 0.13, 0.08))
X0, X1, Y0, Y1 = -0.046, 0.046, 0.05, 0.2
lab = c.rect(X0, X1, Y0, Y1)
c.paint(lab, (0.08, 0.08, 0.08), 0.5)
c.col[lab] *= (0.85 + 0.15 * fbm(CWID, 80, 160, 2)[:CH // 2].repeat(2, 0)[:CH])[lab][:, None]
border(c, X0 + 0.002, X1 - 0.002, Y0 + 0.002, Y1 - 0.002, 0.0008, GOLD, 0.35)
c.text("鶴汀", 0.006, 0.152, 0.05, GOLD, brush=True, gap=0.95)
d = np.sqrt((c.x - 0.03) ** 2 + (c.y - 0.1) ** 2)
c.paint(lab & (np.abs(d - 0.011) < 0.0011), RED, 0.6)
c.text("大吟醸", 0.03, 0.109, 0.0065, RED, brush=True)
fine_print(c, -0.03, 0.185, ["登録商標", "酒の元祖", "創業二百年"], 0.0048, GOLD)
c.text("清酒", 0.038, 0.19, 0.0055, GOLD)
c.text("鶴汀酒造謹製", -0.024, 0.07, 0.0042, GOLD, vertical=False, gap=1.05)
neck_label(c, 0.252, 0.285, 0.028, (0.95, 0.9, 0.62), INK, "純米大吟醸", "TSURUNAGISA  JUNMAI DAIGINJO")
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.86, 0.72, 0.4), (0.5, 0.1, 0.08))
cols.append(c)

# 3: 月汀桜 (720 ml), 純米吟醸: green glass; a yellow label, a brushed ensō round the name, cherry blossoms in its corner, the grade
# brushed down its side, the brewer small in English at its foot; a yellow shoulder label; a gold screw cap; and a yellow hang tag on the
# neck, a prize's (金賞), on a card of its own
H4 = YONGO[-1][1]
c = Col(2 * math.pi * 0.04, H4, (0.12, 0.25, 0.1))
X0, X1, Y0, Y1 = -0.038, 0.038, 0.035, 0.155
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.93, 0.74, 0.18), fibre=0.05)
border(c, X0 + 0.002, X1 - 0.002, Y0 + 0.002, Y1 - 0.002, 0.0007, (0.55, 0.32, 0.08))
enso(c, 0.0, 0.098, 0.026, 0.004, INK)
c.text("月汀桜", 0.0, 0.118, 0.019, INK, brush=True, gap=1.0)
c.text("純米吟醸", 0.031, 0.142, 0.0075, (0.45, 0.12, 0.05), brush=True, gap=1.05)
for k_, (bx, by) in enumerate(((-0.03, 0.142), (-0.025, 0.133), (-0.032, 0.126))):
    for j in range(5):
        a = j * 2 * math.pi / 5 + k_
        disc(c, bx + 0.0028 * math.cos(a), by + 0.0028 * math.sin(a), 0.002, (0.96, 0.75, 0.8))
c.text("GETTEIZAKURA  since 1873", 0.0, Y0 + 0.007, 0.0034, INK, vertical=False, gap=0.6, x_centre=True)
c.text("酒魂", 0.0, Y0 + 0.017, 0.006, INK, vertical=False, gap=1.1, x_centre=True)
neck_label(c, 0.205, 0.228, 0.022, (0.93, 0.74, 0.18), INK, "純米吟醸", "JUNMAI GINJO")
screw_cap(c, H4, YONGO[CAP_FROM][1] - 0.006, (0.85, 0.7, 0.36))
cols.append(c)

# 4: 鶴汀 (720 ml), 純米: the same brewer's small bottle, black matte glass; an off-white label, a gold crest at its top corner, grey peaks
# and gold flecks behind, the name and grade brushed big, a red 純米 small, its maker in English
c = Col(2 * math.pi * 0.04, H4, (0.06, 0.06, 0.065))
X0, X1, Y0, Y1 = -0.034, 0.034, 0.04, 0.16
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.92, 0.91, 0.87), fibre=0.04)
peaks(c, lab, X0, X1, Y0 + 0.008, Y0 + 0.05, (0.55, 0.56, 0.58), 9)
flecks(c, lab, 50, GOLD, 0.001)
c.text("純米", 0.012, 0.148, 0.011, RED, brush=True)
c.text("鶴汀", -0.004, 0.122, 0.03, INK, brush=True, gap=0.98)
disc(c, -0.024, 0.148, 0.007, GOLD, rough=0.3)
disc(c, -0.024, 0.148, 0.0045, (0.92, 0.91, 0.87), ring=0.001)
c.text("JAPANESE SAKE", -0.012, 0.058, 0.0032, INK, vertical=False, gap=0.62, x_centre=True)
c.text("Tsurunagisa", -0.012, 0.052, 0.0045, INK, vertical=False, gap=0.55, x_centre=True)
cap(c, H4, YONGO[CAP_FROM][1] - 0.003, (0.1, 0.1, 0.1), GOLD)
cols.append(c)

# ---- the hang tag's picture (its own column): yellow card, a black-edged red title, 最高金賞 brushed big, a gold medal
tag = Col(0.035 * 2, 0.07 * 2, (0.95, 0.82, 0.12))
tag.col[:] = (0.97, 0.84, 0.14)
TB = 0.035
tag.paint(tag.rect(-TB, TB, 0.09, 0.105), (0.15, 0.15, 0.15), 0.6)
tag.text("全国新酒鑑評会", 0.0, 0.0975, 0.0058, (0.98, 0.95, 0.8), vertical=False, gap=1.0, x_centre=True)
tag.text("最高", 0.0, 0.072, 0.02, INK, brush=True, vertical=False, gap=1.0, x_centre=True)
tag.text("金賞", 0.0, 0.047, 0.022, (0.75, 0.12, 0.08), brush=True, vertical=False, gap=1.0, x_centre=True)
disc(tag, 0.022, 0.02, 0.009, GOLD, rough=0.3)
disc(tag, 0.0, 0.124, 0.003, (0.3, 0.3, 0.3))
cols.append(tag)

atlas = np.concatenate([np.clip(k.col, 0, 1) for k in cols], 1).astype(np.float32)
rough = np.concatenate([k.rough for k in cols], 1)
# (the roughness in the picture's alpha is no use to the game's toon; the shine kept in a second small picture would be one more texture:
# instead the label's matte and the glass's gloss come from the material's own roughness, the label's own look painted)

# =====================================================================
# The stand's picture: hinoki, its grain along the stand, its edges lacquered black (u along the stand, v round its step profile)
# =====================================================================
WW, WH = 1024, 256
wu, wv = np.meshgrid((np.arange(WW) + 0.5) / WW, (np.arange(WH) + 0.5) / WH)
# (hinoki's close straight grain (柾目): fine lines along it, a few a little darker, bending slightly; pale and warm, a faint sheen of
# plane marks across)
fw = fbm(WW, 3, 2, 3)[:WH]
ring = np.abs(np.sin((wv * 90 + 0.8 * fw + 0.15 * np.sin(wu * 5)) * math.pi))
late = smooth(0.85, 1.0, ring)
wood = mix((0.94, 0.84, 0.66), (0.86, 0.72, 0.5), late * (0.55 + 0.45 * smooth(0.3, 0.7, np.sin(wv * 23 + fw * 4) * 0.5 + 0.5)))
wood *= (0.97 + 0.03 * np.sin(wu * 2600 + wv * 50))[..., None]
wood *= (0.97 + 0.04 * fbm(WW, 40, 8, 3)[:WH])[..., None]
stand_col = wood.astype(np.float32)

M = {
    "glass": pbr("SakeBottles", (1, 1, 1), tex=image("sake_bottles", atlas), rough=0.18),
    "wood": pbr("SakeStandWood", (1, 1, 1), tex=image("sake_stand_wood", stand_col), rough=0.6),
    "lacquer": pbr("SakeStandLacquer", (0.04, 0.03, 0.03), rough=0.3),
}
parts = []


def mesh_obj(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth_
    parts.append(o)
    return o


def bottle(k, prof, at, turn):
    """bottle k (its column of the picture) with outline `prof`, its foot at `at`, its front turned `turn` from -y"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    H_ = prof[-1][1]
    rings = [[bm.verts.new((r * math.cos(-math.pi / 2 + 2 * math.pi * (i / NA - 0.5)), r * math.sin(-math.pi / 2 + 2 * math.pi * (i / NA - 0.5)), z))
              for i in range(NA)] for r, z in prof]
    u0, uw = k / NB, 1 / NB
    for j in range(len(prof) - 1):
        for i in range(NA):
            i2 = (i + 1) % NA
            f = bm.faces.new((rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]))
            ua, ub = u0 + uw * i / NA, u0 + uw * (i + 1) / NA
            va, vb = prof[j][1] / H_, prof[j + 1][1] / H_
            for l, uvq in zip(f.loops, ((ua, va), (ub, va), (ub, vb), (ua, vb))):
                l[uvl].uv = uvq
    for f in ladder_fill(bm, rings[0][::-1]):
        for l in f.loops:
            l[uvl].uv = (u0 + uw * 0.5, 0.002)
    for f in ladder_fill(bm, rings[-1]):
        for l in f.loops:
            l[uvl].uv = (u0 + uw * 0.5, 0.998)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if k == 3:
        # (the hang tag: a card on a cord round the neck, hanging down the bottle's shoulder, a little turned out; its picture the last column)
        # (hung from the neck's foot, flat down over the shoulder, its foot clear of the body (the shoulder's radius there and a little))
        z0, w_, h_ = prof[4][1] - 0.004, 0.035, 0.07
        y0 = -prof[4][0] - 0.003
        y1 = -prof[2][0] - 0.007
        q = [Vector((-w_ / 2 + 0.006, y1, z0 - h_)), Vector((w_ / 2 + 0.006, y1, z0 - h_)), Vector((w_ / 2, y0, z0)), Vector((-w_ / 2, y0, z0))]
        sw = Matrix.Rotation(-0.55, 4, "Z")
        q = [sw @ p_ for p_ in q]
        f = bm.faces.new([bm.verts.new(p_) for p_ in q])
        tu0 = 5 / NB
        for l, uvq in zip(f.loops, ((tu0, 0.0), (tu0 + 1 / NB, 0.0), (tu0 + 1 / NB, 1.0), (tu0, 1.0))):
            l[uvl].uv = uvq
    bmesh.ops.transform(bm, matrix=Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z"), verts=bm.verts)
    mesh_obj(f"SakeBottle{k}", bm, M["glass"])


# ---- the stand: two steps, hinoki, a black-lacquered band round each step's front edge, on two low feet
L, D = 0.62, 0.25
FRONT_D, FRONT_H, BACK_H = 0.11, 0.045, 0.105
STEP = ((-D / 2, 0.012), (-D / 2, FRONT_H), (-D / 2 + FRONT_D, FRONT_H), (-D / 2 + FRONT_D, BACK_H), (D / 2, BACK_H), (D / 2, 0.012))
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
ends = []
for xs in (-L / 2, L / 2):
    ends.append([bm.verts.new((xs, y, z)) for y, z in STEP])
per = [0.0]
for (y0, z0), (y1, z1) in zip(STEP, STEP[1:]):
    per.append(per[-1] + math.hypot(y1 - y0, z1 - z0))
for j in range(len(STEP) - 1):
    f = bm.faces.new((ends[0][j], ends[0][j + 1], ends[1][j + 1], ends[1][j]))
    for l, (uq, vq) in zip(f.loops, ((0, per[j]), (0, per[j + 1]), (1, per[j + 1]), (1, per[j]))):
        l[uvl].uv = (uq, vq / per[-1])
# (the underside, and each end two quads (the step's L), facing out)
f = bm.faces.new((ends[0][-1], ends[1][-1], ends[1][0], ends[0][0]))
for e, sgn in ((ends[0], -1), (ends[1], 1)):
    for quad in ((0, 1, 2, 5), (2, 3, 4, 5)):
        f = bm.faces.new([e[q] for q in quad])
        for l in f.loops:
            l[uvl].uv = (0.5 + l.vert.co.y / D * 0.4, 0.5 + l.vert.co.z * 3)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh_obj("SakeStandBody", bm, M["wood"], smooth_=False)
# (the lacquered bands: a thin box along each step's front edge, a hair proud of it; the feet: two low blocks under its ends)
def block(name, x0, x1, y0, y1, z0, z1, mat):
    bm_ = bmesh.new()
    bmesh.ops.create_cube(bm_, size=1.0)
    bmesh.ops.transform(bm_, matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)), verts=bm_.verts)
    return mesh_obj(name, bm_, mat, smooth_=False)


block("SakeStandBand0", -L / 2 - 0.002, L / 2 + 0.002, -D / 2 - 0.003, -D / 2 + 0.006, FRONT_H - 0.008, FRONT_H + 0.003, M["lacquer"])
block("SakeStandBand1", -L / 2 - 0.002, L / 2 + 0.002, -D / 2 + FRONT_D - 0.003, -D / 2 + FRONT_D + 0.006, BACK_H - 0.008, BACK_H + 0.003, M["lacquer"])
for xs in (-1, 1):
    block(f"SakeStandFoot{xs}", xs * L / 2 - (0.05 if xs > 0 else -0.05) - 0.03, xs * L / 2 - (0.05 if xs > 0 else -0.05) + 0.03, -D / 2 + 0.01, D / 2 - 0.01, 0.0, 0.0125, M["lacquer"])

# ---- the bottles: three tall at the back, two short at the front, each turned a touch its own way, a hair over the step
ys_back = -D / 2 + FRONT_D + (D - FRONT_D) / 2
bottle(0, ISSHO, Vector((0.0, ys_back, BACK_H + 0.0005)), 0.0)
bottle(1, ISSHO, Vector((-0.19, ys_back + 0.004, BACK_H + 0.0005)), 0.12)
bottle(2, ISSHO, Vector((0.19, ys_back - 0.004, BACK_H + 0.0005)), -0.1)
ys_front = -D / 2 + FRONT_D / 2
bottle(3, YONGO, Vector((-0.1, ys_front, FRONT_H + 0.0005)), 0.08)
bottle(4, YONGO, Vector((0.11, ys_front + 0.002, FRONT_H + 0.0005)), -0.14)

# (joined by material)
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
root = bpy.data.objects.new("SakeStand", None)
bpy.context.collection.objects.link(root)
for o in joined:
    o.parent = root
print("SAKESTAND_TRIS", sum(len(p.vertices) - 2 for o in joined for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.25, -0.95, 0.42)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0.17)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.8, 0.2, 0.6)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1)
    bpy.context.scene.world = w
export_dish(root, joined + [root], os.path.join(PROJECT, "public", "models", "sakestand.glb"), os.path.join(PROJECT, "blender", "sakestand.blend"), PREVIEW)
print("SAKESTAND_DONE")
