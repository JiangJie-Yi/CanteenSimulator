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

NA = 20
# (the two bottles' outlines, (radius, height) up from the foot: the foot's chamfer, the body, the shoulder, the neck, the paper cap's skirt
# and its top. The shoulder in five steps, eased in off the body and into the neck (item 285, the owner's: 「模型要精緻」: it was one
# bend, a cone, the bottles read as cut from card), as a real 一升瓶's rounds over)
def _shoulder(r0, z0, r1, z1, n=4):
    return tuple((round(r1 + (r0 - r1) * (0.5 + 0.5 * math.cos(math.pi * i / (n + 1))), 5), round(z0 + (z1 - z0) * i / (n + 1), 5)) for i in range(1, n + 1))


ISSHO = ((0.047, 0.0), (0.052, 0.007), (0.052, 0.232)) + _shoulder(0.052, 0.232, 0.0165, 0.33) + ((0.0165, 0.33), (0.0165, 0.362), (0.0185, 0.366), (0.0185, 0.395))
YONGO = ((0.037, 0.0), (0.04, 0.006), (0.04, 0.178)) + _shoulder(0.04, 0.178, 0.0135, 0.25) + ((0.0135, 0.25), (0.0135, 0.272), (0.0155, 0.276), (0.0155, 0.298))
CAP_FROM = 8          # (from this point up, the paper cap)
NECK_FOOT = 7         # (where the shoulder meets the neck)

# =====================================================================
# The bottles' picture: one column each (u round the bottle once, its front (-y) at the column's middle), v up it (the foot at 0, the
# cap's top at 1)
# =====================================================================
NB = 13               # (twelve bottles and the hang tag's picture)
# (448 wide a column, 1024 high: thirteen in a row would be 5,824 across, past the 4,096 every GPU takes; so two rows of seven (item 285),
# 3,136 by 2,048, the last cell empty)
NCOL, NROW = 7, 2
CWID, CH = 448, 1024
# (each column with a margin either side that carries its own picture on round the bottle (item 398, the owner's 「酒瓶背後都有一條縫線?」
# 「幾乎每個都有」): a bottle's back is where its column's two edges meet, and they met the next columns' pictures; kept 0.6 % in from them
# (item 197) was a pixel at full size, under one as the game draws the picture smaller (scene/textureCap), and the next bottle's colour
# came in down every back as a line, lit by the glass's own glow; 24 pixels a side, the picture round the bottle carried on into them)
GUT = 24
TAG = 12              # (the hang tag's picture: the cell after the twelve bottles')
NIGORI = {11}         # (the cloudy one: its sake white)
# (the stoneware one's washi cap draped down its neck, tied with a gold cord, two tassels over its shoulder (item 285, the owner's picture):
# the drape's top ring just outside the cap's skirt, its middle ring, its hem (every other point hanging lower); the cord's height; each
# tassel's cord from round the cord (its angle from the front) down to where its tassel hangs from)
DRAPE = {10: dict(top=(0.0158, 0.2765), mid=(0.0163, 0.257), hem=(0.0228, 0.228, 0.2385), cord=0.257,
                  ends=((-math.pi / 2 - 0.38, 0.206), (-math.pi / 2 + 0.22, 0.197)))}
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
        # (just showing: brighter, it read as a scratch down the bottle's side (item 197))
        self.col[seam] *= 1.08
        # (its mottle round the bottle without a break where the column's edges meet: a noise that tiles across the column's width)
        mottle = np.tile(fbm(CWID, 18, 36, 3).repeat(2, 0), (2, 1))[:CH]
        self.col *= (0.94 + 0.06 * mottle)[..., None]
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
    n = wrapnoise(60, 120, 2)
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
    """a ruled frame `w` wide just inside the rectangle; round the whole bottle (a label that goes all the way round, its ends meeting at its
    back), its top and foot only (item 398, the owner's 「酒瓶背後都有一條縫線?」: its two upright lines stood down every bottle's back)"""
    if x0 <= -c.circ / 2 + 0.003 and x1 >= c.circ / 2 - 0.003:
        c.paint(c.rect(-c.circ, c.circ, y0, y1) & ~c.rect(-c.circ, c.circ, y0 + w, y1 - w), colour, rough)
        return
    c.paint(c.rect(x0, x1, y0, y1) & ~c.rect(x0 + w, x1 - w, y0 + w, y1 - w), colour, rough)


def wrapnoise(cx, cy, octaves):
    """noise over a bottle's column that runs on round it without a break where the column's two edges meet, at its back (item 398): as
    fbm(CH // 2, cx, cy) was over 512 (cut to the column's 448 it broke there), over a square of the column's width, each row doubled down"""
    k = CWID / (CH // 2)
    n = fbm(CWID, max(1, round(cx * k)), max(1, round(cy * k)), octaves).repeat(2, 0)
    return np.tile(n, (int(np.ceil(CH / n.shape[0])), 1))[:CH]


def disc(c, x0, y0, r, colour, ring=0.0, rough=0.6):
    d = np.sqrt((c.x - x0) ** 2 + (c.y - y0) ** 2)
    c.paint((d < r) & (d >= r - ring) if ring else (d < r), colour, rough)


def worn(c, m, k=0.12):
    """the print a little worn where a hand takes the bottle"""
    n = wrapnoise(30, 60, 3)
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
    # (round the neck all the way (item 87, the owner's: "it should go all the way round"): `w` only how wide its writing is)
    m = c.rect(-c.circ / 2, c.circ / 2, y0, y1)
    washi(c, m, base)
    border(c, -c.circ / 2, c.circ / 2, y0, y1, 0.0009, ink)
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

# (each bottle's opaque bands, (from, to) up it: its label, its shoulder label, its cap; the rest of it glass the light comes through (item
# 88); the mesh is cut into rings at each band's edges)
OPAQUE = {}


def back_label(c, y1, name, size, colour):
    """the back of a label that goes all the way round (item 87): its fine print (the brewer, the rice, its strength, how much) in
    columns at its back, as a 裏ラベル carries"""
    fine_print(c, c.circ / 2 - 0.018, y1 - 0.018, [ADDR.format(name)] + [s_.format(name, size) for s_ in INFO], 0.0042, colour)


# (the makes made up after the way real brewers name theirs (the owner's: "made up, after real brewers'"), each looked for and none found)
H = ISSHO[-1][1]
# 0: 雪嶺錦 (1.8 l), 特別純米: brown glass; a tall cream label, gold leaf flecks over it, snowy peaks in grey wash across its foot, the name
# brushed big down its middle, 特別純米 in red beside it, the romanised name and the brewer small at its foot; a cream shoulder label
c = Col(2 * math.pi * 0.052, H, (0.2, 0.09, 0.03))
# (its label all the way round (item 87): the front's drawing as it was, the paper and its wash on round the back)
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.045, 0.218
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
back_label(c, Y1, "雪嶺", "一八〇〇ml", INK)
worn(c, lab)
OPAQUE[0] = [(Y0, Y1), (0.258, 0.284), (ISSHO[CAP_FROM][1] - 0.004, H)]
neck_label(c, 0.258, 0.284, 0.024, (0.92, 0.88, 0.76), RED, "特撰", "TOKUSEN")
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.93, 0.9, 0.84), RED)
cols.append(c)

# 1: 朝霞川 (1.8 l), 純米吟醸: green glass; a white label, the name brushed big at its right, the grade small brushed over it, a red seal
# under it, columns of small print down its left, a pale blue wash of waves along its foot, the brewer's mark; a silver screw cap
c = Col(2 * math.pi * 0.052, H, (0.1, 0.32, 0.12))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.05, 0.2
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.97, 0.96, 0.93), fibre=0.03)
wave = lab & (c.y < Y0 + 0.022)
for k_ in range(int(c.circ / 0.014) + 1):
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
back_label(c, Y1, "朝霞", "一八〇〇ml", INK)
screw_cap(c, H, ISSHO[CAP_FROM][1] - 0.006, (0.72, 0.74, 0.76))
OPAQUE[1] = [(Y0, Y1), (ISSHO[CAP_FROM][1] - 0.006, H)]
cols.append(c)

# 2: 鶴汀 (1.8 l), 純米大吟醸: dark green glass; a black label, the name brushed big in gold, a red ring seal of 大吟醸 on it, 酒の元祖-like
# lines in gold small, a cream shoulder label 純米大吟醸 with its romanised name; a gold paper cap
c = Col(2 * math.pi * 0.052, H, (0.05, 0.13, 0.08))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.05, 0.2
lab = c.rect(X0, X1, Y0, Y1)
c.paint(lab, (0.08, 0.08, 0.08), 0.5)
c.col[lab] *= (0.85 + 0.15 * wrapnoise(80, 160, 2))[lab][:, None]
border(c, X0 + 0.002, X1 - 0.002, Y0 + 0.002, Y1 - 0.002, 0.0008, GOLD, 0.35)
c.text("鶴汀", 0.006, 0.152, 0.05, GOLD, brush=True, gap=0.95)
d = np.sqrt((c.x - 0.03) ** 2 + (c.y - 0.1) ** 2)
c.paint(lab & (np.abs(d - 0.011) < 0.0011), RED, 0.6)
c.text("大吟醸", 0.03, 0.109, 0.0065, RED, brush=True)
fine_print(c, -0.03, 0.185, ["登録商標", "酒の元祖", "創業二百年"], 0.0048, GOLD)
c.text("清酒", 0.038, 0.19, 0.0055, GOLD)
c.text("鶴汀酒造謹製", -0.024, 0.07, 0.0042, GOLD, vertical=False, gap=1.05)
neck_label(c, 0.252, 0.285, 0.028, (0.95, 0.9, 0.62), INK, "純米大吟醸", "TSURUNAGISA  JUNMAI DAIGINJO")
back_label(c, Y1, "鶴汀", "一八〇〇ml", GOLD)
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.86, 0.72, 0.4), (0.5, 0.1, 0.08))
OPAQUE[2] = [(Y0, Y1), (0.252, 0.285), (ISSHO[CAP_FROM][1] - 0.004, H)]
cols.append(c)

# 3: 月汀桜 (720 ml), 純米吟醸: green glass; a yellow label, a brushed ensō round the name, cherry blossoms in its corner, the grade
# brushed down its side, the brewer small in English at its foot; a yellow shoulder label; a gold screw cap; and a yellow hang tag on the
# neck, a prize's (金賞), on a card of its own
H4 = YONGO[-1][1]
c = Col(2 * math.pi * 0.04, H4, (0.12, 0.25, 0.1))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.035, 0.155
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
back_label(c, Y1, "月汀", "七二〇ml", INK)
screw_cap(c, H4, YONGO[CAP_FROM][1] - 0.006, (0.85, 0.7, 0.36))
OPAQUE[3] = [(Y0, Y1), (0.205, 0.228), (YONGO[CAP_FROM][1] - 0.006, H4)]
cols.append(c)

# 4: 鶴汀 (720 ml), 純米: the same brewer's small bottle, black matte glass; an off-white label, a gold crest at its top corner, grey peaks
# and gold flecks behind, the name and grade brushed big, a red 純米 small, its maker in English
c = Col(2 * math.pi * 0.04, H4, (0.06, 0.06, 0.065))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.04, 0.16
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
back_label(c, Y1, "鶴汀", "七二〇ml", INK)
cap(c, H4, YONGO[CAP_FROM][1] - 0.003, (0.1, 0.1, 0.1), GOLD)
OPAQUE[4] = [(Y0, Y1), (YONGO[CAP_FROM][1] - 0.003, H4)]
cols.append(c)

# ---- three more makes (item 132, the owner's, 2026-11-15: "more kinds of sake"), made up as the others are
# 5: 瑠璃灘 (1.8 l), 本醸造: deep blue glass; a white label, the name brushed big in indigo, a band of waves along its foot, a red seal
c = Col(2 * math.pi * 0.052, H, (0.06, 0.12, 0.32))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.05, 0.21
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.95, 0.95, 0.93))
peaks(c, lab, X0, X1, Y0 + 0.006, Y0 + 0.03, (0.25, 0.4, 0.62), 5)
c.text("瑠璃灘", 0.0, 0.175, 0.04, (0.12, 0.2, 0.45), brush=True, gap=0.98)
c.text("本醸造", 0.032, 0.19, 0.011, INK, brush=True, gap=1.05)
disc(c, -0.03, 0.1, 0.009, RED, ring=0.0013)
c.text("瑠", -0.03, 0.1, 0.009, RED, brush=True)
c.text("RURINADA", 0.0, Y0 + 0.04, 0.0048, (0.12, 0.2, 0.45), vertical=False, gap=0.62, x_centre=True)
back_label(c, Y1, "瑠璃灘", "一八〇〇ml", INK)
worn(c, lab)
OPAQUE[5] = [(Y0, Y1), (ISSHO[CAP_FROM][1] - 0.004, H)]
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.9, 0.92, 0.95), (0.12, 0.2, 0.45))
cols.append(c)

# 6: 雲雀谷 (720 ml), 純米大吟醸: pale blue-clear glass; a silver-grey label, the name brushed in black, a scatter of small stars, the grade in red
c = Col(2 * math.pi * 0.04, H4, (0.62, 0.74, 0.8))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.04, 0.16
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.8, 0.82, 0.85), fibre=0.03)
flecks(c, lab, 60, (0.96, 0.96, 0.98), 0.0011)
border(c, X0 + 0.002, X1 - 0.002, Y0 + 0.002, Y1 - 0.002, 0.0008, (0.4, 0.42, 0.46))
c.text("雲雀谷", -0.002, 0.125, 0.024, INK, brush=True, gap=0.98)
c.text("純米大吟醸", 0.026, 0.14, 0.0072, RED, brush=True, gap=1.05)
c.text("HIBARIDANI", 0.0, Y0 + 0.01, 0.0036, INK, vertical=False, gap=0.6, x_centre=True)
back_label(c, Y1, "雲雀谷", "七二〇ml", INK)
screw_cap(c, H4, YONGO[CAP_FROM][1] - 0.006, (0.78, 0.8, 0.84))
OPAQUE[6] = [(Y0, Y1), (YONGO[CAP_FROM][1] - 0.006, H4)]
cols.append(c)

# 7: 楓霞 (720 ml), 特別本醸造: amber glass; a cream label, the name brushed big in deep red, red maple leaves scattered at its foot
c = Col(2 * math.pi * 0.04, H4, (0.36, 0.18, 0.05))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.04, 0.155
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.95, 0.9, 0.78), fibre=0.05)
for k_, (bx, by) in enumerate(((-0.02, 0.06), (0.012, 0.055), (0.03, 0.07), (-0.032, 0.075))):
    for j in range(5):
        a = j * 2 * math.pi / 5 + k_ * 0.7
        disc(c, bx + 0.003 * math.cos(a), by + 0.003 * math.sin(a), 0.0022, (0.78, 0.2, 0.08))
c.text("楓霞", 0.0, 0.125, 0.03, (0.55, 0.08, 0.05), brush=True, gap=0.98)
c.text("特別本醸造", 0.026, 0.142, 0.0068, INK, brush=True, gap=1.05)
c.text("FUKA", 0.0, Y0 + 0.008, 0.004, INK, vertical=False, gap=0.6, x_centre=True)
back_label(c, Y1, "楓霞", "七二〇ml", INK)
cap(c, H4, YONGO[CAP_FROM][1] - 0.003, (0.95, 0.9, 0.78), (0.55, 0.08, 0.05))
OPAQUE[7] = [(Y0, Y1), (YONGO[CAP_FROM][1] - 0.003, H4)]
cols.append(c)

# ---- four more (item 285, the owner's, 2026-11-17: 「酒台不夠精美，數量也不夠…模型要精緻」, and two bottles to go by: a black stoneware
# one, its washi cap tied with a gold cord and tassels, a cream label brushed big; a smoky clear one, a white label brushed big in blue, a
# strip of paper down its front), made up as the others are, each looked for and none found to be a real one
# 8: 稲穂川 (1.8 l), 本醸造, the house's everyday sake: amber glass; a kraft paper label all round, the name brushed big in black, an ear of
# rice in gold arching up its side, 本醸造 in red, a red seal; a kraft paper cap tied with red
c = Col(2 * math.pi * 0.052, H, (0.3, 0.15, 0.04))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.048, 0.205
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.76, 0.63, 0.43), fibre=0.08)
border(c, X0, X1, Y0 + 0.002, Y1 - 0.002, 0.0011, (0.35, 0.22, 0.1))
# (the ear of rice up the label's left: its stem rising and bowing over at the top under the grains' weight, the grains along its upper
# part in gold, long and pointed, each leaning out from the stem, alternate sides, smaller toward the tip)
def ear_pt(t):
    return -0.034 + 0.011 * t - 0.009 * t ** 3, 0.066 + 0.112 * t - 0.03 * t ** 3
for i in range(40):
    sx_, sy_ = ear_pt(i / 39)
    disc(c, sx_, sy_, 0.0007, (0.45, 0.32, 0.12))
for i in range(12):
    t = 0.42 + 0.56 * i / 11
    (x0_, y0_), (x1_, y1_) = ear_pt(t - 0.01), ear_pt(t + 0.01)
    ang_ = math.atan2(y1_ - y0_, x1_ - x0_) + (0.6 if i % 2 else -0.6)
    a_, b_ = 0.0042 * (1.1 - 0.4 * i / 11), 0.0017 * (1.1 - 0.3 * i / 11)
    gx, gy = ear_pt(t)
    gx, gy = gx + math.cos(ang_) * a_ * 0.9, gy + math.sin(ang_) * a_ * 0.9
    dx, dy = c.x - gx, c.y - gy
    u_, v_ = (dx * math.cos(ang_) + dy * math.sin(ang_)) / a_, (-dx * math.sin(ang_) + dy * math.cos(ang_)) / b_
    grain = u_ ** 2 + v_ ** 2 * (1.0 + 0.6 * np.clip(u_, 0, 1)) < 1.0
    c.paint(grain, GOLD, 0.4)
    c.paint(grain & (u_ ** 2 + v_ ** 2 > 0.62), (0.55, 0.38, 0.12), 0.5)
c.text("稲穂川", 0.004, 0.185, 0.04, INK, brush=True, gap=0.98)
c.text("本醸造", 0.032, 0.192, 0.0105, RED, brush=True, gap=1.05)
c.paint(c.rect(0.026, 0.038, 0.062, 0.074), RED, 0.7)
c.text("稲", 0.032, 0.068, 0.0085, (0.95, 0.9, 0.78))
c.text("INAHOGAWA", 0.0, Y0 + 0.008, 0.0042, INK, vertical=False, gap=0.62, x_centre=True)
back_label(c, Y1, "稲穂川", "一八〇〇ml", INK)
worn(c, lab)
cap(c, H, ISSHO[CAP_FROM][1] - 0.004, (0.78, 0.66, 0.46), RED)
OPAQUE[8] = [(Y0, Y1), (ISSHO[CAP_FROM][1] - 0.004, H)]
cols.append(c)

# 9: 澄藍 (1.8 l), 純米吟醸 無濾過生原酒: smoky clear glass, grey; a white label low on it, the name brushed big in indigo, one character over
# the other, the grade down its side, the brewer's red seal; a strip of white paper down its front over it, 無濾過生原酒 in black and a small
# red seal (on the body, not the shoulder: the picture's round is the body's, so up the shoulder its words would be squeezed); a black
# screw cap
c = Col(2 * math.pi * 0.052, H, (0.5, 0.53, 0.55))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.04, 0.158
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.97, 0.97, 0.96), fibre=0.025)
INDIGO = (0.1, 0.2, 0.52)
c.text("澄", 0.0, 0.128, 0.05, INDIGO, brush=True)
c.text("藍", 0.0, 0.08, 0.038, INDIGO, brush=True)
c.text("純米吟醸", 0.03, 0.146, 0.0085, INK, brush=True, gap=1.05)
disc(c, -0.03, 0.06, 0.0075, RED, ring=0.0012)
c.text("澄", -0.03, 0.06, 0.0075, RED, brush=True)
c.text("CHORAN", 0.0, Y0 + 0.006, 0.0046, INDIGO, vertical=False, gap=0.62, x_centre=True)
fine_print(c, -0.024, 0.15, ["清酒", "精米歩合五五％", "原酒　生"], 0.0042, INK)
back_label(c, Y1, "澄藍", "一八〇〇ml", INK)
strip = c.rect(-0.0065, 0.0065, 0.168, 0.229)
washi(c, strip, (0.97, 0.97, 0.95), fibre=0.02)
c.text("無濾過生原酒", 0.0, 0.222, 0.0072, INK, gap=1.04)
c.paint(c.rect(-0.003, 0.003, 0.171, 0.177), RED, 0.7)
screw_cap(c, H, ISSHO[CAP_FROM][1] - 0.006, (0.1, 0.1, 0.11))
OPAQUE[9] = [(Y0, Y1), (ISSHO[CAP_FROM][1] - 0.006, H)]
cols.append(c)

# 10: 玄雪 (720 ml), 純米大吟醸: black stoneware, matte, flecked; a cream label on its front only (the pot's own black round the rest), the
# name brushed big, the grade and 清酒 small, a red seal; its washi cap draped down the neck in points and tied with a gold cord, two
# tassels hanging over the shoulder (the drape and the cord are shapes: drape())
c = Col(2 * math.pi * 0.04, H4, (0.06, 0.055, 0.05))
nz = wrapnoise(40, 80, 3)
c.col[:] = np.asarray((0.07, 0.065, 0.06), np.float32) * (0.75 + 0.5 * nz)[..., None]
r_ = np.random.default_rng(10)
for _ in range(900):
    yy_, xx_ = r_.integers(0, CH), r_.integers(0, CWID)
    c.col[yy_, xx_] = (0.32, 0.29, 0.25) if r_.random() < 0.6 else (0.5, 0.42, 0.3)
X0, X1, Y0, Y1 = -0.031, 0.031, 0.03, 0.152
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.93, 0.88, 0.74), fibre=0.07)
border(c, X0, X1, Y0, Y1, 0.0012, (0.72, 0.62, 0.42))
c.text("玄雪", 0.002, 0.128, 0.034, INK, brush=True, gap=0.96)
c.text("純米大吟醸", 0.024, 0.146, 0.0064, INK, brush=True, gap=1.04)
c.text("清酒", -0.023, 0.146, 0.0058, INK)
c.paint(c.rect(-0.026, -0.016, 0.04, 0.05), RED, 0.7)
c.text("玄", -0.021, 0.045, 0.0075, (0.95, 0.9, 0.78), brush=True)
c.text("GENSETSU", 0.004, Y0 + 0.006, 0.0036, INK, vertical=False, gap=0.6, x_centre=True)
cap(c, H4, YONGO[CAP_FROM][1] - 0.003, (0.95, 0.94, 0.9), GOLD)
OPAQUE[10] = [(0.0, H4)]
cols.append(c)

# 11: 雪見舟 (720 ml), 活性にごり: clear glass, the sake in it white (its own material); a white label, a little boat under falling snow in
# pale blue and the name brushed big in deep rose, にごり酒 brushed beside it; a white screw cap, pink on top
c = Col(2 * math.pi * 0.04, H4, (0.8, 0.85, 0.86))
X0, X1, Y0, Y1 = -c.circ / 2, c.circ / 2, 0.036, 0.152
lab = c.rect(X0, X1, Y0, Y1)
washi(c, lab, (0.98, 0.97, 0.96), fibre=0.03)
ROSE = (0.62, 0.12, 0.24)
SNOW = (0.55, 0.7, 0.85)
r_ = np.random.default_rng(11)
for _ in range(26):
    disc(c, r_.uniform(-0.045, 0.045), r_.uniform(0.06, 0.15), r_.uniform(0.0008, 0.0016), SNOW)
# (the boat: a low hull, its pole leaning)
c.paint(lab & (c.y > 0.048) & (c.y < 0.048 + 0.006 * (1 - ((c.x + 0.012) / 0.016) ** 2)) & (np.abs(c.x + 0.012) < 0.016), SNOW, 0.6)
c.paint(lab & (np.abs(c.x + 0.004 - (c.y - 0.05) * 0.25) < 0.0006) & (c.y > 0.05) & (c.y < 0.07), SNOW, 0.6)
c.text("雪見舟", 0.008, 0.136, 0.026, ROSE, brush=True, gap=0.98)
c.text("にごり酒", -0.016, 0.142, 0.0085, INK, brush=True, gap=1.05)
c.text("活性", 0.03, 0.142, 0.0065, RED, gap=1.05)
c.text("YUKIMIBUNE", 0.0, Y0 + 0.006, 0.0036, ROSE, vertical=False, gap=0.6, x_centre=True)
back_label(c, Y1, "雪見舟", "七二〇ml", INK)
screw_cap(c, H4, YONGO[CAP_FROM][1] - 0.006, (0.95, 0.95, 0.95))
c.paint(c.y > H4 - 0.006, (0.92, 0.55, 0.65), 0.4)
OPAQUE[11] = [(Y0, Y1), (YONGO[CAP_FROM][1] - 0.006, H4)]
cols.append(c)

assert len(cols) == TAG
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

cells = [np.clip(k.col, 0, 1) for k in cols] + [np.full((CH, CWID, 3), 0.5, np.float32)] * (NCOL * NROW - len(cols))
# (each column's margins: its right edge's picture on the left of it, its left edge's on the right, as round the bottle they're one)
cells = [np.concatenate([c[:, -GUT:], c, c[:, :GUT]], 1) for c in cells]
atlas = np.concatenate([np.concatenate(cells[r * NCOL:(r + 1) * NCOL], 1) for r in range(NROW)], 0).astype(np.float32)
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

# ---- (item 383) the stand's woods and pictures: keyaki (欅) for its feet, plinth, posts and beams (the hinoki's own grain stained a warm
# mid brown); a figured burl (玉杢) for the plinth's long faces, as the screen's lower panel; the risers' shoji (格子): keyaki bars over warm
# paper, a cell across a picture and the riser's height up it; the plaque's two faces, pale wood in a keyaki edge, brushed in sumi
keyaki_col = (stand_col * np.array([0.7, 0.5, 0.33], np.float32)).astype(np.float32)


def burl(n=512, seed=383):
    """burl (玉杢): a burr cut through, its curling eyes (rings whorled round a dark knot), the grain swirling between them; a warm mid
    brown, its lines darker; tiling"""
    r_ = np.random.default_rng(seed)
    yy, xx = (np.mgrid[0:n, 0:n].astype(np.float32) + 0.5) / n
    ph = np.zeros((n, n), np.float32)
    knots = np.zeros((n, n), np.float32)
    for _ in range(14):
        cx, cy = r_.random(), r_.random()
        dx = (xx - cx + 0.5) % 1.0 - 0.5
        dy = (yy - cy + 0.5) % 1.0 - 0.5
        d = np.hypot(dx * 1.6, dy)
        sz = 0.05 + 0.06 * r_.random()
        ph += np.exp(-(d / (3 * sz)) ** 2) * (d / sz) * 6.0
        knots = np.maximum(knots, np.exp(-(d / (0.12 * sz)) ** 2))
    g = np.zeros((n, n), np.float32)
    for k in range(1, 5):
        a = r_.random() * 2 * math.pi
        g += np.sin((xx * k * 2 + yy * (5 - k)) * 2 * math.pi + a) * (0.6 / k)
    lines = smooth(0.55, 0.98, np.abs(np.sin((ph + yy * 26 + g * 1.4) * math.pi)))
    img = mix((0.55, 0.32, 0.15), (0.27, 0.13, 0.05), lines * 0.75)
    img = mix(img, (0.12, 0.06, 0.02), knots * 0.9)
    return img.astype(np.float32)


def shoji_pic(w=128, h=128):
    """one cell of the risers' lattice: warm paper, a keyaki bar at each side (half of it: they tile across), along its top and its foot
    and across its middle; a faint shade along each bar on the paper"""
    U, V = np.meshgrid((np.arange(w) + 0.5) / w, (np.arange(h) + 0.5) / h)
    r_ = np.random.default_rng(3831)
    paper = np.array([0.97, 0.92, 0.8], np.float32)[None, None, :] * (0.95 + 0.05 * r_.random((h, w, 1)).astype(np.float32))
    dist = np.minimum.reduce([np.minimum(U, 1 - U) - 0.06, V - 0.13, 0.87 - V, np.abs(V - 0.5) - 0.045])
    bar = dist < 0
    paper = paper * (0.86 + 0.14 * smooth(0.0, 0.05, np.maximum(dist, 0)))[..., None]
    img = np.where(bar[..., None], np.array([0.4, 0.24, 0.12], np.float32)[None, None, :], paper)
    return img.astype(np.float32)


def plaque_pic(w=128, h=168):
    """the plaque's two faces side by side: the customers' (銘酒) left, the owner's (聞野) right; pale hinoki in a keyaki edge, the two
    characters brushed down it in sumi"""
    out = np.zeros((h, 2 * w, 3), np.float32)
    ink = np.array([0.05, 0.04, 0.04], np.float32)
    edge = np.array([0.42, 0.25, 0.12], np.float32)
    for col, chars in ((0, "銘酒"), (1, "聞野")):
        x0 = col * w
        cell = np.array(stand_col[:h, x0 * 3:x0 * 3 + w], np.float32)
        m = np.zeros((h * SS, w * SS), bool)
        size = w * 0.7
        for n_, ch in enumerate(chars):
            # (down the board: the first character above)
            fill_tris(m, glyph(ch, True), (w / 2) * SS, (h / 2 + (0.5 - n_) * size * 1.06) * SS, size * SS, size * SS)
        cov = m.reshape(h, SS, w, SS).mean(axis=(1, 3))
        cell = cell * (1 - cov[..., None]) + ink * cov[..., None]
        yy, xx = np.mgrid[0:h, 0:w]
        e = 7
        cell[(xx < e) | (xx >= w - e) | (yy < e) | (yy >= h - e)] = edge
        out[:, x0:x0 + w] = cell
    return out


M = {
    "glass": pbr("SakeBottles", (1, 1, 1), tex=image("sake_bottles", atlas), rough=0.18),
    # (the same picture: the game draws this one see-through, the light through it (item 88))
    "clear": pbr("SakeGlass", (1, 1, 1), tex=bpy.data.images["sake_bottles"], rough=0.08),
    "liquid": pbr("SakeLiquid", (0.96, 0.92, 0.74), rough=0.05),
    # (the cloudy sake (にごり, item 285): white, near opaque, the game its own see-through for it)
    "nigori": pbr("SakeLiquidNigori", (0.95, 0.94, 0.9), rough=0.25),
    # (the stand's woods (item 383): its hinoki, its keyaki, the burl of the plinth's faces, the risers' shoji (the game lights its paper
    # softly), the plaque)
    "wood": pbr("SakeStandWood", (1, 1, 1), tex=image("sake_stand_wood", stand_col), rough=0.6),
    "keyaki": pbr("SakeWoodKeyaki", (1, 1, 1), tex=image("sake_keyaki", keyaki_col), rough=0.5),
    "burl": pbr("SakeWoodBurl", (1, 1, 1), tex=image("sake_burl", burl()), rough=0.45),
    "shoji": pbr("SakeShoji", (1, 1, 1), tex=image("sake_shoji", shoji_pic()), rough=0.7),
    "plaque": pbr("SakeWoodPlaque", (1, 1, 1), tex=image("sake_plaque", plaque_pic()), rough=0.5),
}
parts = []


def mesh_obj(name, bm, mat, smooth_=True, join=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for m_ in (mat if isinstance(mat, (list, tuple)) else (mat,)):
        o.data.materials.append(m_)
    for p in o.data.polygons:
        p.use_smooth = smooth_
    if join:
        parts.append(o)
    return o


def prof_r(prof, z):
    """the bottle's radius at height z, by its outline"""
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return prof[-1][0] if z > prof[-1][1] else prof[0][0]


def tube(bm, uvl, pts, rad, sides, uv, out=None):
    """a cord along `pts` (Vectors), `sides` round, its rings square to its way (`out`, a way it never runs along, to set them by)"""
    rings_ = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        o = (out or Vector((p.x, p.y, 0))).normalized()
        b = t.cross(o).normalized()
        n = b.cross(t).normalized()
        rings_.append([bm.verts.new(p + rad * (math.cos(2 * math.pi * (j + 0.5) / sides) * n + math.sin(2 * math.pi * (j + 0.5) / sides) * b)) for j in range(sides)])
    for a, b in zip(rings_, rings_[1:]):
        for j in range(sides):
            f = bm.faces.new((a[j], a[(j + 1) % sides], b[(j + 1) % sides], b[j]))
            for l in f.loops:
                l[uvl].uv = uv
    return rings_


def drape(bm, uvl, k, prof, u0, uw, vrow):
    """the washi draped down the neck from under the cap, its hem cut in points (into the bottle's own mesh); and a gold cord round it, two
    cords from that down over the shoulder and a tassel on each (a mesh of their own: too fine to outline). All in the bottle's own picture:
    the washi from its cap's paper (above the cord's band), the gold from its cap's cord"""
    d = DRAPE[k]
    cap0, capH = prof[CAP_FROM][1] - 0.003, prof[-1][1]
    gold = (u0 + uw * 0.5, vrow(cap0 + (capH - cap0) * 0.3))
    paper = lambda t: vrow(cap0 + (capH - cap0) * (0.42 + 0.5 * t))
    (rt, zt), (rm, zm), (rh, zlo, zhi) = d["top"], d["mid"], d["hem"]
    ang = lambda i: -math.pi / 2 + 2 * math.pi * (i / NA - 0.5)
    rs = [[bm.verts.new((rt * math.cos(ang(i)), rt * math.sin(ang(i)), zt)) for i in range(NA)],
          [bm.verts.new((rm * math.cos(ang(i)), rm * math.sin(ang(i)), zm)) for i in range(NA)],
          [bm.verts.new((rh * math.cos(ang(i)), rh * math.sin(ang(i)), zlo if i % 2 == 0 else zhi)) for i in range(NA)]]
    for a, b, (va, vb) in ((rs[0], rs[1], (1.0, 0.6)), (rs[1], rs[2], (0.6, 0.0))):
        for i in range(NA):
            i2 = (i + 1) % NA
            f = bm.faces.new((b[i], b[i2], a[i2], a[i]))
            f.material_index = 0
            for l, uvq in zip(f.loops, ((u0 + uw * i / NA, paper(vb)), (u0 + uw * (i + 1) / NA, paper(vb)), (u0 + uw * (i + 1) / NA, paper(va)), (u0 + uw * i / NA, paper(va)))):
                l[uvl].uv = uvq
    # (the cords: one round the drape at its middle ring, and from it down the shoulder, a little off whatever's under them)
    cb = bmesh.new()
    cuv = cb.loops.layers.uv.new()
    zc = d["cord"]
    R_ = rm + 0.0017
    ring_pts = [Vector((R_ * math.cos(2 * math.pi * j / 12), R_ * math.sin(2 * math.pi * j / 12), zc)) for j in range(13)]
    tube(cb, cuv, ring_pts, 0.0015, 4, gold, out=Vector((0, 0, 1)))
    shell_r = lambda z: (rm + (rh - rm) * (zm - z) / (zm - zlo)) if zlo <= z <= zm else 0.0
    for a0, z_end in d["ends"]:
        zs = [zc - (zc - z_end) * s / 6 for s in range(7)]
        pts = []
        for z in zs:
            r = max(shell_r(z), prof_r(prof, z)) + 0.0028
            if z == zc:
                r = R_
            pts.append(Vector((r * math.cos(a0), r * math.sin(a0), z)))
        tube(cb, cuv, pts, 0.0012, 4, gold)
        # (its tassel: a knot, then a bunch of threads widening down the shoulder, along its slope and a little off it)
        zb = z_end - 0.022
        A = Vector(((prof_r(prof, z_end) + 0.0042) * math.cos(a0), (prof_r(prof, z_end) + 0.0042) * math.sin(a0), z_end))
        B = Vector(((prof_r(prof, zb) + 0.0068) * math.cos(a0), (prof_r(prof, zb) + 0.0068) * math.sin(a0), zb))
        ax = (B - A).normalized()
        o = Vector((math.cos(a0), math.sin(a0), 0))
        bn = ax.cross(o).normalized()
        nn = bn.cross(ax).normalized()
        rings_ = []
        for t, rr in ((0.0, 0.0026), (0.16, 0.0029), (0.24, 0.0031), (1.0, 0.0055)):
            c_ = A + (B - A) * t
            rings_.append([cb.verts.new(c_ + rr * (math.cos(2 * math.pi * j / 6) * nn + math.sin(2 * math.pi * j / 6) * bn)) for j in range(6)])
        for a, b in zip(rings_, rings_[1:]):
            for j in range(6):
                f = cb.faces.new((a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]))
                for l in f.loops:
                    l[cuv].uv = gold
        for ring_ in (rings_[0][::-1], rings_[-1]):
            for f in ladder_fill(cb, ring_):
                for l in f.loops:
                    l[cuv].uv = gold
    bmesh.ops.recalc_face_normals(cb, faces=cb.faces)
    return cb


bottles = []
# (how full each is: up into its shoulder, a little lower in the open ones)
FILL = {0: 0.262, 1: 0.248, 2: 0.255, 3: 0.196, 4: 0.19, 5: 0.25, 6: 0.2, 7: 0.192, 8: 0.252, 9: 0.258, 10: 0.19, 11: 0.198}


def bottle(k, prof, at, turn):
    """bottle k (its column of the picture) with outline `prof`, its foot at `at`, its front turned `turn` from -y"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    H_ = prof[-1][1]
    # (cut at each opaque band's edges (item 88): a ring there, its radius between the two it falls between)
    cuts = sorted({z for band in OPAQUE[k] for z in band if prof[0][1] < z < H_ - 1e-6} - {z for _, z in prof})
    prof0 = prof
    prof = list(prof)
    for z in cuts:
        j = next(i for i in range(len(prof) - 1) if prof[i][1] < z < prof[i + 1][1])
        (r0, z0), (r1, z1) = prof[j], prof[j + 1]
        prof.insert(j + 1, (r0 + (r1 - r0) * (z - z0) / (z1 - z0), z))
    opaque = lambda z: any(lo - 1e-6 <= z <= hi + 1e-6 for lo, hi in OPAQUE[k])
    rings = [[bm.verts.new((r * math.cos(-math.pi / 2 + 2 * math.pi * (i / NA - 0.5)), r * math.sin(-math.pi / 2 + 2 * math.pi * (i / NA - 0.5)), z))
              for i in range(NA)] for r, z in prof]
    # (each bottle's column kept a little in from its edges: its back, where the column's edges meet, picked up the next bottle's colour as
    # the picture was drawn smaller (item 197: a line of another bottle's colour down each one's back, the kitchen's side); in two rows
    # now (item 285), its foot and its cap's top kept in from the row above and below the same way)
    u0, uw = ((k % NCOL) + GUT / (CWID + 2 * GUT)) / NCOL, CWID / (CWID + 2 * GUT) / NCOL
    vrow = lambda z: ((k // NCOL) + 0.004 + 0.992 * z / H_) / NROW
    for j in range(len(prof) - 1):
        for i in range(NA):
            i2 = (i + 1) % NA
            f = bm.faces.new((rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]))
            f.material_index = 0 if opaque((prof[j][1] + prof[j + 1][1]) / 2) else 1
            ua, ub = u0 + uw * i / NA, u0 + uw * (i + 1) / NA
            va, vb = vrow(prof[j][1]), vrow(prof[j + 1][1])
            for l, uvq in zip(f.loops, ((ua, va), (ub, va), (ub, vb), (ua, vb))):
                l[uvl].uv = uvq
    for f in ladder_fill(bm, rings[0][::-1]):
        f.material_index = 0 if opaque(0.0) else 1
        for l in f.loops:
            l[uvl].uv = (u0 + uw * 0.5, vrow(0.002))
    for f in ladder_fill(bm, rings[-1]):
        for l in f.loops:
            l[uvl].uv = (u0 + uw * 0.5, vrow(H_ - 0.002))
    cord = drape(bm, uvl, k, prof0, u0, uw, vrow) if k in DRAPE else None
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if k == 3:
        # (the hang tag (by the outline as given: the bands' cuts put into `prof` move its points' numbers): a card on a cord round the neck, hanging down the bottle's shoulder, a little turned out; its picture the last column)
        # (hung from the neck's foot, flat down over the shoulder, its foot clear of the body (the shoulder's radius there and a little))
        z0, w_, h_ = prof0[NECK_FOOT][1] - 0.004, 0.035, 0.07
        y0 = -prof0[NECK_FOOT][0] - 0.003
        y1 = -prof0[2][0] - 0.007
        q = [Vector((-w_ / 2 + 0.006, y1, z0 - h_)), Vector((w_ / 2 + 0.006, y1, z0 - h_)), Vector((w_ / 2, y0, z0)), Vector((-w_ / 2, y0, z0))]
        sw = Matrix.Rotation(-0.55, 4, "Z")
        q = [sw @ p_ for p_ in q]
        f = bm.faces.new([bm.verts.new(p_) for p_ in q])
        tu0, tv0, tw = ((TAG % NCOL) + GUT / (CWID + 2 * GUT)) / NCOL, (TAG // NCOL) / NROW, CWID / (CWID + 2 * GUT) / NCOL
        for l, uvq in zip(f.loops, ((tu0, tv0), (tu0 + tw, tv0), (tu0 + tw, tv0 + 1 / NROW), (tu0, tv0 + 1 / NROW))):
            l[uvl].uv = uvq
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(turn, 4, "Z"), verts=bm.verts)
    o = mesh_obj(f"SakeBottle{k}", bm, [M["glass"], M["clear"]], join=False)
    o.location = at
    bottles.append(o)
    if cord is not None:
        bmesh.ops.transform(cord, matrix=Matrix.Rotation(turn, 4, "Z"), verts=cord.verts)
        co = mesh_obj(f"SakeCord{k}", cord, M["glass"], join=False)
        co.parent = o
        bottles.append(co)
    # (the sake in it: its glass's inside (9/10 of it, a little in from the wall) from just over its foot up to how full it is, 12 round,
    # laddered top and bottom; its own object under the bottle, so it can go down as it's poured)
    fill = FILL[k]
    pts = [(prof[0][0] * 0.88, 0.004)]
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z1 <= 0.004:
            continue
        if z1 >= fill:
            pts.append(((r0 + (r1 - r0) * (fill - z0) / (z1 - z0)) * 0.9 - 0.001, fill))
            break
        pts.append((r1 * 0.9 - 0.001, z1))
    bl = bmesh.new()
    LN = 12
    lr = [[bl.verts.new((r * math.cos(2 * math.pi * i / LN), r * math.sin(2 * math.pi * i / LN), z)) for i in range(LN)] for r, z in pts]
    for a_, b_ in zip(lr, lr[1:]):
        for i in range(LN):
            bl.faces.new((a_[i], a_[(i + 1) % LN], b_[(i + 1) % LN], b_[i]))
    ladder_fill(bl, lr[0][::-1])
    ladder_fill(bl, lr[-1])
    bmesh.ops.recalc_face_normals(bl, faces=bl.faces)
    lo = mesh_obj(f"SakeLiquid{k}", bl, M["nigori"] if k in NIGORI else M["liquid"], join=False)
    lo.parent = o
    bottles.append(lo)


# =====================================================================
# The stand (item 383, the owner's, 2026-11-20: 「酒台的風格不行，要日式，木造」, after a woodblock print's 衝立: a wooden screen, its frame
# on two feet, a lattice in its upper half, a panel of figured wood under it, a top rail over its posts run on past them. Item 380's black
# lacquer, gold and vermilion didn't go with the shop's Edo wood (the bar's lip, item 313, after a 衝立 too)). All of it wood now, joined
# as a joiner joins it: a keyaki plinth up on two bracket feet (脚), its long faces figured burl (玉杢) as the screen's lower panel; two
# steps on it, their tops pale hinoki, their risers a shoji lattice (格子) of keyaki bars over paper, lit softly from within; each bottle
# on a hinoki coaster, the best one up on a white-wood dais; behind them a gate of keyaki at the back corners: two posts standing on the
# feet, the top rail (笠木) over them, its ends run on past them and cut slanting, the tie beam (貫) under it through the posts, and at
# the middle between the two the plaque (額束) brushed in sumi, 銘酒 to the customers and 聞野 to the owner. Bold rounded shapes (item
# 379's 造型感: bevels with their normals hardened). The steps' heights and the bottles' places as they were (the pour, the tasting)
# =====================================================================
L, D = 0.93, 0.25
FRONT_D = 0.11
PL = 0.056           # (the plinth's top)
T1 = PL + 0.042      # (the front step's top)
T2 = T1 + 0.06       # (the back step's top)
CO = 0.006           # (a coaster's height)
DAI = 0.045          # (the best bottle's dais)
PX = L / 2 + 0.046   # (the plinth's half length)
PY0, PY1 = -D / 2 - 0.02, D / 2 + 0.035     # (its depth: deeper behind, the gate's posts on it behind the steps)
FOOT_H = 0.022       # (the feet: the plinth stands up on them, the table seen under it between them)
POST_X, POST_Y, POST_W = L / 2 + 0.018, D / 2 + 0.017, 0.032
NUKI_Z, KASA_Z = 0.515, 0.6      # (the tie beam's top; the top rail's foot)
KASA_H, KASA_D, KASA_RUN = 0.028, 0.048, 0.055
CELL = 0.05          # (the risers' lattice: a cell across)


def rounded_box(name, x0, x1, y0, y1, z0, z1, bw, segs, top_mat, side_mat, bottom=False):
    """the shared chunky box (common.chunky_box: rounded, its normals hardened), kept with the stand's parts"""
    o = chunky_box(name, x0, x1, y0, y1, z0, z1, bw, segs, top_mat, side_mat, bottom=bottom, uv_scale=0.16)
    parts.append(o)
    return o


def relay_uv(o, fn):
    """each corner's place on its picture from its face's normal, its place and its material (through the mesh: the hardened normals
    kept)"""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uvl = me.uv_layers[0]
    for pg in me.polygons:
        for li in pg.loop_indices:
            uvl.data[li].uv = fn(pg.normal, me.vertices[me.loops[li].vertex_index].co, pg.material_index)


def along_uv(scale):
    """the grain along the stand (x) on every face, `scale` metres a picture: across the tops, up the faces"""
    def f(n, c, mi):
        if abs(n.z) > 0.7:
            return (c.x / scale, c.y / scale)
        return ((c.x if abs(n.y) >= abs(n.x) else c.y) / scale, c.z / scale)
    return f


def upright_uv(scale):
    """the grain up a post"""
    def f(n, c, mi):
        if abs(n.z) > 0.7:
            return (c.x / scale, c.y / scale)
        return (c.z / scale, (c.x if abs(n.y) >= abs(n.x) else c.y) / scale)
    return f


def shoji_uv(z0, z1):
    """the risers' lattice: a cell every CELL along the face, the riser's height (z0 to z1) up it; the tops their hinoki's grain"""
    def f(n, c, mi):
        if mi == 0:
            return (c.x / 0.16, c.y / 0.16)
        return ((c.x if abs(n.y) >= abs(n.x) else c.y) / CELL, min(1.0, max(0.0, (c.z - z0) / (z1 - z0))))
    return f


def profile(name, pts, axis, a0, a1, mat, bev, segs=2, uv=None):
    """an outline (`pts` round the plane across `axis`: (y, z) for 'x', (x, z) for 'y') given its thickness from a0 to a1 along `axis`,
    its edges rounded `bev` (a bevel by angle, its normals hardened)"""
    bm_ = bmesh.new()

    def at(p, a):
        return Vector((a, p[0], p[1])) if axis == "x" else Vector((p[0], a, p[1]))
    lo = [bm_.verts.new(at(p, a0)) for p in pts]
    hi = [bm_.verts.new(at(p, a1)) for p in pts]
    bm_.faces.new(lo)
    bm_.faces.new(hi[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm_.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    o = mesh_obj(name, bm_, mat)
    m = o.modifiers.new("b", "BEVEL")
    m.width, m.segments, m.limit_method, m.angle_limit, m.harden_normals = bev, segs, "ANGLE", math.radians(40), True
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    relay_uv(o, uv or along_uv(0.16))
    return o


def lathe(name, prof, at, segs, mats, mat_of=None, smooth_=True, top_mat=None, foot=True):
    """a turned piece round z at `at`: `prof` (radius, height) up from its foot, its ends capped (the caps laddered at export, no fan);
    each band's material `mat_of(i)` (an index into `mats`), the caps the first band's and the last's"""
    bm_ = bmesh.new()
    uv_ = bm_.loops.layers.uv.new()
    rings_ = [[bm_.verts.new((at.x + r * math.cos(2 * math.pi * a / segs), at.y + r * math.sin(2 * math.pi * a / segs), at.z + z)) for a in range(segs)]
              for r, z in prof]
    for b_, (ra, rb) in enumerate(zip(rings_, rings_[1:])):
        for a in range(segs):
            f = bm_.faces.new((ra[a], ra[(a + 1) % segs], rb[(a + 1) % segs], rb[a]))
            f.material_index = mat_of(b_) if mat_of else 0
            for l in f.loops:
                l[uv_].uv = (0.5, 0.5)
    if foot and prof[0][0] > 1e-5:
        f = bm_.faces.new(rings_[0][::-1])
        f.material_index = mat_of(0) if mat_of else 0
    if prof[-1][0] > 1e-5:
        f = bm_.faces.new(rings_[-1])
        f.material_index = top_mat if top_mat is not None else (mat_of(len(prof) - 2) if mat_of else 0)
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    return mesh_obj(name, bm_, mats, smooth_=smooth_)


# ---- the feet: two keyaki bracket feet under the plinth's ends, front to back, each its two toes and the arch cut up between them, the
# tops of its ends rounded off (the screen's feet)
FY0, FY1 = PY0 - 0.018, PY1 + 0.018
TOE, ARCH, FR = 0.036, 0.007, 0.011
foot_pts = [(FY0, 0.0), (FY0 + TOE, 0.0), (FY0 + TOE + 0.01, ARCH), (FY1 - TOE - 0.01, ARCH), (FY1 - TOE, 0.0), (FY1, 0.0), (FY1, FOOT_H - FR)]
foot_pts += [(FY1 - FR + FR * math.cos(a), FOOT_H - FR + FR * math.sin(a)) for a in (math.pi / 6, math.pi / 3)] + [(FY1 - FR, FOOT_H), (FY0 + FR, FOOT_H)]
foot_pts += [(FY0 + FR - FR * math.cos(a), FOOT_H - FR + FR * math.sin(a)) for a in (math.pi / 3, math.pi / 6)] + [(FY0, FOOT_H - FR)]
for sx in (-1, 1):
    profile(f"SakeStandFoot{sx}", foot_pts, "x", sx * POST_X - 0.021, sx * POST_X + 0.021, M["keyaki"], 0.003)

# ---- the plinth up on them: keyaki, its long faces figured burl (the screen's lower panel), its edges rounded over, under too
plinth = rounded_box("SakeStandPlinth", -PX, PX, PY0, PY1, FOOT_H - 0.001, PL, 0.009, 3, M["keyaki"], M["burl"], bottom=True)
relay_uv(plinth, lambda n, c, mi: (c.x / 0.16, c.y / 0.16) if mi == 0 else (((c.x if abs(n.y) >= abs(n.x) else c.y) / 0.12), (c.z - FOOT_H) / 0.12))

# ---- the two steps: the front one the whole depth, the back one on it behind (sunk a hair into it: no face shared); their tops pale
# hinoki, their risers and their backs the shoji lattice
s0_ = rounded_box("SakeStandStep0", -L / 2, L / 2, -D / 2, D / 2, PL - 0.001, T1, 0.007, 3, M["wood"], M["shoji"])
relay_uv(s0_, shoji_uv(PL, T1))
s1_ = rounded_box("SakeStandStep1", -L / 2, L / 2, -D / 2 + FRONT_D, D / 2, T1 - 0.002, T2, 0.007, 3, M["wood"], M["shoji"])
relay_uv(s1_, shoji_uv(T1, T2))

# ---- the bottles, each on its coaster: six tall up the back and the best one between them up on its dais; five along the front, each
# between two at the back so every label shows, the front's right-hand end kept for the tokkuri (on a coaster of its own)
ys_back = -D / 2 + FRONT_D + (D - FRONT_D) / 2
ys_front = -D / 2 + FRONT_D / 2
SPAN = 0.131


def coaster(name, x, y, z, r):
    """a bottle's coaster: a disc of hinoki, its rim keyaki, its top's edge eased"""
    prof = ((r, 0.0), (r, CO - 0.0015), (r - 0.0015, CO))
    lathe(name, prof, Vector((x, y, z)), 16, [M["keyaki"], M["wood"]], top_mat=1, foot=False)


for k_, j_ in ((8, -3), (1, -2), (0, -1), (9, 1), (2, 2), (5, 3)):
    coaster(f"SakeStandCoaster{k_}", j_ * SPAN, ys_back, T2, 0.056)
    bottle(k_, ISSHO, Vector((j_ * SPAN, ys_back, T2 + CO + 0.0003)), 0.0)
dai = rounded_box("SakeStandDai", -0.05, 0.05, ys_back - 0.05, ys_back + 0.05, T2 - 0.001, T2 + DAI, 0.007, 3, M["wood"], M["wood"])
relay_uv(dai, along_uv(0.16))
coaster("SakeStandCoaster10", 0.0, ys_back, T2 + DAI, 0.043)
bottle(10, YONGO, Vector((0.0, ys_back, T2 + DAI + CO + 0.0003)), 0.0)
for k_, j_ in ((3, -2.5), (6, -1.5), (7, -0.5), (4, 0.5), (11, 1.5)):
    coaster(f"SakeStandCoaster{k_}", j_ * SPAN, ys_front, T1, 0.045)
    bottle(k_, YONGO, Vector((j_ * SPAN, ys_front, T1 + CO + 0.0003)), 0.0)
coaster("SakeStandCoasterJug", 2.5 * SPAN, ys_front, T1, 0.045)

# ---- the gate behind them: two keyaki posts at the back corners standing on the feet through the plinth; the top rail (笠木) over them,
# its ends run on past them and cut slanting (its top longer than its foot); the tie beam (貫) under it through the posts, its ends just out
# past them; between the two at the middle the plaque (額束)
for sx in (-1, 1):
    x = sx * POST_X
    post = rounded_box(f"SakeStandPost{sx}", x - POST_W / 2, x + POST_W / 2, POST_Y - POST_W / 2, POST_Y + POST_W / 2, FOOT_H - 0.001, KASA_Z + 0.004,
                       0.005, 2, M["keyaki"], M["keyaki"])
    relay_uv(post, upright_uv(0.16))
XK = POST_X + POST_W / 2 + KASA_RUN
profile("SakeStandKasagi", [(-XK + 0.016, KASA_Z), (XK - 0.016, KASA_Z), (XK, KASA_Z + KASA_H), (-XK, KASA_Z + KASA_H)], "y",
        POST_Y - KASA_D / 2, POST_Y + KASA_D / 2, M["keyaki"], 0.006, 3)
XN = POST_X + POST_W / 2 + 0.018
nuki = rounded_box("SakeStandNuki", -XN, XN, POST_Y - 0.011, POST_Y + 0.011, NUKI_Z - 0.018, NUKI_Z, 0.004, 2, M["keyaki"], M["keyaki"], bottom=True)
relay_uv(nuki, along_uv(0.16))
# (the plaque: a board from the tie beam up into the top rail, its faces the picture's two halves, each read the right way round from its
# side; its edges the picture's keyaki edge)
GW, GT = 0.034, 0.012
z0g, z1g = NUKI_Z - 0.002, KASA_Z + 0.002
bm_ = bmesh.new()
uv_ = bm_.loops.layers.uv.new()
bmesh.ops.create_cube(bm_, size=1.0)
bmesh.ops.transform(bm_, matrix=Matrix.Translation((0, POST_Y, (z0g + z1g) / 2)) @ Matrix.Diagonal((2 * GW, GT, z1g - z0g, 1)), verts=bm_.verts)
for f in bm_.faces:
    for l in f.loops:
        c = l.vert.co
        v = (c.z - z0g) / (z1g - z0g)
        if f.normal.y < -0.5:
            l[uv_].uv = ((c.x + GW) / (2 * GW) * 0.5, v)
        elif f.normal.y > 0.5:
            l[uv_].uv = (0.5 + (GW - c.x) / (2 * GW) * 0.5, v)
        else:
            l[uv_].uv = (0.01, 0.5)
mesh_obj("SakeStandGakuzuka", bm_, M["plaque"], smooth_=False)

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
for o in bottles:
    if o.parent is None:
        o.parent = root
print("SAKESTAND_TRIS", sum(len(p.vertices) - 2 for o in joined + bottles for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.3, -1.3, 0.5)
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
export_dish(root, joined + bottles + [root], os.path.join(PROJECT, "public", "models", "sakestand.glb"), os.path.join(PROJECT, "blender", "sakestand.blend"), PREVIEW)
print("SAKESTAND_DONE")
