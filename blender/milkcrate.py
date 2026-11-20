"""A plastic milk crate (牛奶籃) of cold drinks, the other style of crate by the drinks (item 437, the owner's: 「新整另一種籃子風格，裡面也是
用來裝冷飲類」, after a photo of one: moulded magenta plastic, a rim of ribs round its top, a hand-hold through each end, its sides a criss-cross
lattice, a solid band round its foot, worn): milkcrate.glb, nodes "MilkCrate" (its "MilkCrateLattice" in it) and "MilkCrateDrinks" under
"MilkCrateRoot".

The game's frame: y up, x along its long sides, z across, its floor's middle (its foot) at the origin. The beer crate's footprint
(blender/bottlecrate.py: 0.36 x 0.29, so the two stack), its lip standing out 5 mm round the top as that one's does; 0.25 tall.

"MilkCrate" ("MilkCratePlastic"): one closed shell of plain quads (372 triangles; 380 with the lattice). Its corners rounded 24 mm in three
steps (its inside 14 mm in two: the same length a step), each round's normals its own true ones, so it shades round and meets the flat sides
without a crease; walls 10 mm thick, the floor 12 mm. A solid band round the foot (to 50 mm), another round the top (from 185 mm), a lip
over it 14 mm tall standing out 5 mm; between the bands, on each side, an opening the lattice stands in. Through each end's top band a hand-hold, its outline
eight-sided: the end's face built round it as a frame (four quads, a triangle at each corner, the hole's sides through the wall), no boolean.
What's moulded on it is in its normal map, not its mesh: three ribs round the top band, broken short of a raised frame round each hand-hold;
the foot band's rib and a plain sunk panel on each side; two grooves up each corner; every edge's rounding. Its colour: a faded magenta, the
edges, corners and ribs knocked white, scratches across the foot and the corners, the rim's top scuffed by the crates stacked on it, grime at
the foot and on the floor (a grid of holes, drawn).

"MilkCrateLattice" ("MilkCrateLattice", in "MilkCrate"): one quad a side standing in its opening at the wall's middle, its edges a millimetre
into the posts and bands round it; the diamonds cut out of its picture's alpha (milkcrate_lattice: 1600 px a metre, the holes 0, the bars 1,
a pixel of edge between), the bars' rounding in its normal map. Exported alphaMode MASK (cut off at 0.5), double-sided: the far sides are seen
from inside.

"MilkCrateDrinks" ("MilkCrateDrinks"): the shop's own cold drinks (bar.ts DRINKS) at the size the game draws them (DrinkBottle's scale):
seven 500 ml bottles (four green tea, three of the sports drink) and three cans (two yuzu soda, a coffee) filling its back two rows (the
-z half: seen over its front, +z, the front wall hides the empty floor nearest it), standing a millimetre over the floor, apart from each
other and the walls; each turned from a profile of a few rings, 8 round (its shoulder's normals leaning up as a rounded one's would), its
top a ladder of quads (no fan), open below where the floor hides it. Their labels (as the game prints them), the tea seen through the
plastic, the caps and the lids in one picture (milkcrate_drinks); 492 triangles.

Run:
    blender -b --factory-startup --python blender/milkcrate.py -- <project path> [preview.png]
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


def P(x, y, z):
    """the game's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


G = np.random.default_rng(437)


def hx(s):
    """a colour as the picture holds it (sRGB), from #rrggbb"""
    return np.array([int(s[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


# =====================================================================
# The crate's measures (the game's frame)
# =====================================================================
W, D, H = 0.36, 0.29, 0.25
R, T = 0.024, 0.010            # the corners' round outside; the walls' thickness
NO, NI = 3, 2                  # steps round a corner outside, inside (its round 10 mm less: about the same length a step)
LIP, LIP_H = 0.005, 0.014      # the lip round the top: how far it stands out, how tall
YL = H - LIP_H
YB, YT = 0.050, 0.185          # the foot band up to YB, the top band from YT: the lattice between
FY = 0.012                     # the floor's top
SW, SY0, SY1, SCH = 0.110, 0.201, 0.226, 0.008   # the hand-hold: how long, its foot and top, its corners' cut
SYC, SHH = (SY0 + SY1) / 2, (SY1 - SY0) / 2
RIBS = ((0.1925, 0.1975), (0.2045, 0.2095), (0.2165, 0.2215))   # the top band's ribs (foot, top)
FRAME_W = 0.004                # the frame moulded round each hand-hold
# (the corners counter-clockwise seen from above, each by which way from the middle and the angle its round starts at: back right, back
# left, front left, front right; the side after each: the back, the left end, the front, the right end)
CORNERS = ((1, -1, 0.0), (-1, -1, 90.0), (-1, 1, 180.0), (1, 1, 270.0))
SHORT = (False, True, False, True)

MAG = hx("#c4407e")            # the magenta, faded a little
FADE = hx("#cf6d9a")           # faded more (the sun on its top)
WHITE = hx("#f0c4d6")          # the plastic knocked white
GRIME = hx("#5a3c42")


def outline(r, n):
    """the crate's outline round at `r` from the corners' middles, n steps a corner: [(x, z)], counter-clockwise from above"""
    pts = []
    for sx, sz, a0 in CORNERS:
        cx, cz = sx * (W / 2 - R), sz * (D / 2 - R)
        for j in range(n + 1):
            a = math.radians(a0 + 90.0 * j / n)
            pts.append((cx + r * math.cos(a), cz - r * math.sin(a)))
    return pts


def lengths(pts):
    """how far round the outline each point is from the first (one more at the end: the whole way round)"""
    cum = [0.0]
    for k in range(len(pts)):
        cum.append(cum[-1] + math.dist(pts[k], pts[(k + 1) % len(pts)]))
    return cum


O_PTS, L_PTS, I_PTS = outline(R, NO), outline(R + LIP, NO), outline(R - T, NI)
O_CUM, I_CUM = lengths(O_PTS), lengths(I_PTS)
P_O, P_I = O_CUM[-1], I_CUM[-1]
M_O, M_I = len(O_PTS), len(I_PTS)


def side_ends(s, n):
    """the outline's points a side runs between (its start's, its end's), n steps a corner"""
    return s * (n + 1) + n, ((s + 1) * (n + 1)) % (4 * (n + 1))


def side_geo(s):
    """a side: its points (outside), its start, its direction along it, its outward normal (x, z), its length"""
    ks, ke = side_ends(s, NO)
    (ax, az), (bx, bz) = O_PTS[ks], O_PTS[ke]
    L = math.hypot(bx - ax, bz - az)
    d = ((bx - ax) / L, (bz - az) / L)
    return ks, ke, (ax, az), d, (-d[1], d[0]), L


def spt(s, t, y, depth):
    """a point on side s: `t` along it, `y` up, `depth` in from its outside"""
    _, _, (ax, az), d, out, _ = side_geo(s)
    return (ax + d[0] * t - out[0] * depth, y, az + d[1] * t - out[1] * depth)


def centre(ci):
    sx, sz, _ = CORNERS[ci]
    return sx * (W / 2 - R), sz * (D / 2 - R)


# =====================================================================
# The body's picture (milkcrate_plastic, 800 px a metre): the outside round (u how far round, v up), the inside round, the rim's profile
# (its underside out, the lip up, its top in), the floor from above, a strip for the cut edges
# =====================================================================
PPM = 800.0
GUT = 4
BW = 1024
RIM_H = LIP + LIP_H + LIP + T


def _reg(x, y, w_m, h_m):
    return (x, y, int(math.ceil(w_m * PPM)), int(math.ceil(h_m * PPM)))


REG = {"out": _reg(0, 0, P_O, YL)}
REG["in"] = _reg(0, REG["out"][1] + REG["out"][3] + GUT, P_I, H - FY)
REG["rim"] = _reg(0, REG["in"][1] + REG["in"][3] + GUT, P_O, RIM_H)
_FLY = REG["rim"][1] + REG["rim"][3] + GUT
REG["floor"] = _reg(0, _FLY, W - 2 * T, D - 2 * T)
REG["edge"] = (REG["floor"][2] + 2 * GUT, _FLY, 256, 16)
BH = int(math.ceil((_FLY + REG["floor"][3] + GUT) / 16.0) * 16)
assert REG["out"][2] <= BW and REG["rim"][2] <= BW


def buv(reg, s, t):
    """the body picture's uv of the point `s` across and `t` up its region (metres)"""
    return ((REG[reg][0] + s * PPM) / BW, (REG[reg][1] + t * PPM) / BH)


def wnoise(h, w, cx, cy):
    """value noise over an h x w picture, cx cells across (wrapping round: a strip round the crate meets itself) and cy up"""
    cx, cy = max(1, int(round(cx))), max(1, int(round(cy)))
    g = G.random((cy + 1, cx)).astype(np.float32)
    ux = (np.arange(w) + 0.5) * cx / w
    uy = (np.arange(h) + 0.5) * cy / h
    ix0, iy0 = np.floor(ux).astype(int), np.floor(uy).astype(int)
    fx, fy = ux - ix0, uy - iy0
    ix1, ix0 = (ix0 + 1) % cx, ix0 % cx
    iy1 = np.minimum(iy0 + 1, cy)
    fx = (fx * fx * (3 - 2 * fx))[None, :]
    fy = (fy * fy * (3 - 2 * fy))[:, None]
    a, b = g[np.ix_(iy0, ix0)], g[np.ix_(iy0, ix1)]
    c, d = g[np.ix_(iy1, ix0)], g[np.ix_(iy1, ix1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def wfbm(h, w, cx, cy, octaves=4):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * wnoise(h, w, cx * 2 ** o, cy * 2 ** o)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


def raised(ins, height, bev):
    """a moulded rise `height` tall: `ins` how far in from its edge (metres), its edge rounded over `bev`"""
    t = np.clip(ins / bev, 0, 1)
    return height * (1 - (1 - t) ** 2)


def eased(d, bev):
    """a corner of the shell rounded off: `d` how far from the edge (metres); the face falls away to it, 45 degrees at the edge"""
    t = np.clip(d / bev, 0, 1)
    return -0.5 * bev * (1 - t) ** 2


def rinter(a, b, r):
    """the inside of both of two shapes (each `a`, `b` how far inside it), its corners rounded `r`: how far inside"""
    qa, qb = r - a, r - b
    return -(np.sqrt(np.maximum(qa, 0) ** 2 + np.maximum(qb, 0) ** 2) + np.minimum(np.maximum(qa, qb), 0) - r)


def nmap(hg, ppm, wrap=False):
    """a height picture (metres, `ppm` pixels a metre; `wrap` across) as a normal map"""
    if wrap:
        gx = (np.roll(hg, -1, 1) - np.roll(hg, 1, 1)) * ppm / 2
    else:
        hp = np.pad(hg, ((0, 0), (1, 1)), mode="edge")
        gx = (hp[:, 2:] - hp[:, :-2]) * ppm / 2
    vp = np.pad(hg, ((1, 1), (0, 0)), mode="edge")
    gy = (vp[2:] - vp[:-2]) * ppm / 2
    n = np.stack([-gx, -gy, np.ones_like(hg)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def blur(a, r):
    out = np.zeros_like(a)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out += np.roll(np.roll(a, dy, 0), dx, 1)
    return out / (2 * r + 1) ** 2


def scratches(h, w, n, ppm, y_of, ang_of, lens, amp, width=0.75, wrap=True):
    """n scratches as lines: each from a random place across, `y_of()` up (metres), at `ang_of()` radians, `lens` long (metres), as strong as
    `amp` at most, fading to its ends; the strongest of them at each pixel"""
    m = np.zeros((h, w), np.float32)
    for _ in range(n):
        x0, y0 = G.uniform(0, w), y_of() * ppm
        ln, a = G.uniform(*lens) * ppm, ang_of()
        x1, y1 = x0 + ln * math.cos(a), y0 + ln * math.sin(a)
        bx0, bx1 = int(min(x0, x1) - 2), int(max(x0, x1) + 3)
        by0, by1 = max(0, int(min(y0, y1) - 2)), min(h, int(max(y0, y1) + 3))
        if by1 <= by0:
            continue
        xs = np.arange(bx0, bx1)
        if not wrap:
            xs = xs[(xs >= 0) & (xs < w)]
            if not len(xs):
                continue
        X, Y = (xs + 0.5)[None, :], (np.arange(by0, by1) + 0.5)[:, None]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
        dd = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
        s = (amp * G.uniform(0.35, 1.0) * np.clip(1 - dd / width, 0, 1) * np.sqrt(np.sin(np.pi * t))).astype(np.float32)
        cols = xs % w
        m[by0:by1, cols] = np.maximum(m[by0:by1, cols], s)
    return m


def colmap(cum, n, w):
    """for each column of a strip round an outline (n steps a corner): on a side or round a corner; which; how far along the side; the side's
    length; how far round the corner; the corner's length round; on an end"""
    S = (np.arange(w) + 0.5) / PPM
    cum = np.asarray(cum)
    k = np.clip(np.searchsorted(cum, S, side="right") - 1, 0, 4 * (n + 1) - 1)
    ci, j = k // (n + 1), k % (n + 1)
    side = j == n
    c0, c1 = cum[ci * (n + 1)], cum[ci * (n + 1) + n]
    s1 = cum[ci * (n + 1) + n + 1]
    return {"side": side, "which": ci, "t": S - c1, "L": s1 - c1, "cpos": S - c0, "clen": c1 - c0,
            "short": side & np.isin(ci, (1, 3))}


def strip(cum, n, reg, y0_m):
    """a strip's columns' facts spread over its rows, and each row's height (metres, from y0_m)"""
    _, _, w, h = REG[reg]
    c = colmap(cum, n, w)
    out = {k: np.broadcast_to(np.asarray(v)[None, :], (h, w)) for k, v in c.items()}
    out["Y"] = np.broadcast_to((y0_m + (np.arange(h) + 0.5) / PPM)[:, None], (h, w))
    out["h"], out["w"] = h, w
    return out


def octa(t, L, Y):
    """how far outside an end's hand-hold (eight-sided) a point is, `t` along the end"""
    dx, dy = np.abs(t - L / 2), np.abs(Y - SYC)
    hx_ = SW / 2
    return np.maximum(np.maximum(dx - hx_, dy - SHH), (dx + dy - (hx_ + SHH - SCH)) / math.sqrt(2))


def paint_out():
    """the outside round, from the foot to the lip"""
    c = strip(O_CUM, NO, "out", 0.0)
    h, w, Y = c["h"], c["w"], c["Y"]
    side, short, t, L, cpos, clen = c["side"], c["short"], c["t"], c["L"], c["cpos"], c["clen"]
    sd = np.where(short, octa(t, L, Y), 1.0)
    post = ~side & (Y > YB) & (Y < YT)
    feat = np.zeros((h, w), np.float32)
    # (the ribs round the top band, stopping short of each hand-hold's frame)
    for r0, r1 in RIBS:
        feat += raised(np.minimum(np.minimum(Y - r0, r1 - Y), sd - FRAME_W - 0.003), 0.0012, 0.0014)
    # (the frame moulded round each hand-hold)
    feat += raised(np.where(sd >= 0, np.minimum(sd, FRAME_W - sd), -1.0), 0.0012, 0.0012)
    # (the foot band's rib round it, and a plain panel sunk in it on every side, a short one on the ends)
    feat += raised(np.minimum(Y - 0.039, 0.044 - Y), 0.0010, 0.0012)
    pw = np.where(short, 0.075, 0.11)
    pin = np.minimum(np.minimum(t - (L / 2 - pw), (L / 2 + pw) - t), np.minimum(Y - 0.010, 0.032 - Y))
    feat -= np.where(side, raised(pin, 0.0008, 0.0012), 0.0)
    # (two grooves up each corner post between the bands)
    for f in (1 / 3, 2 / 3):
        g = np.abs(cpos - f * clen)
        feat -= np.where(post, 0.0006 * np.clip(1 - (g / 0.0011) ** 2, 0, 1) * np.clip(np.minimum(Y - YB, YT - Y) / 0.006, 0, 1), 0.0)
    # (the shell's edges rounded: at the foot, round the openings, the posts' edges at them)
    edge = eased(Y, 0.0025)
    edge = edge + np.where(side & (Y < YB), eased(YB - Y, 0.002), 0.0)
    edge = edge + np.where(side & (Y > YT), eased(Y - YT, 0.002), 0.0)
    edge = edge + np.where(post, eased(np.minimum(cpos, clen - cpos), 0.002), 0.0)
    nlo = wfbm(h, w, P_O / 0.09, YL / 0.09, 4)
    nmid = wfbm(h, w, P_O / 0.03, YL / 0.03, 3)
    nhi = wfbm(h, w, P_O / 0.008, YL / 0.008, 2)
    col = MAG[None, None, :] * (0.93 + 0.12 * nlo)[..., None]
    col = mix(col, FADE, np.clip((0.15 + 0.35 * Y / YL) * nlo - 0.05, 0, 1))
    # (a shade in the grooves and the panels and at the foot of each rise)
    ao = np.clip((blur(feat, 3) - feat) / 0.0007, 0, 1)
    col = col * (1 - 0.22 * ao)[..., None]
    # (knocked white: the foot's edge, round the openings, the posts' edges, the ribs' and frames' tops; up the corners, where they're
    # knocked, in streaks up them)
    wz = np.clip(1 - Y / 0.006, 0, 1)
    wz = np.maximum(wz, np.where(side & (Y < YB), np.clip(1 - (YB - Y) / 0.004, 0, 1), 0))
    wz = np.maximum(wz, np.where(side & (Y > YT), np.clip(1 - (Y - YT) / 0.004, 0, 1), 0))
    wz = np.maximum(wz, np.where(post, np.clip(1 - np.minimum(cpos, clen - cpos) / 0.004, 0, 1), 0))
    wz = np.maximum(wz, np.clip(feat / 0.0012 - 0.6, 0, 1) * 0.8)
    col = mix(col, WHITE, np.clip(wz * (nhi * 1.8 - 0.55 + 0.3 * nmid), 0, 1) * 0.75)
    nup = wfbm(h, w, P_O / 0.006, YL / 0.05, 3)
    col = mix(col, WHITE, np.where(~side, np.clip(nup * 1.6 - 0.95, 0, 1), 0.0) * 0.8)
    # (scratches: many across the foot band and up the corners, some across the top band; a few dark ones)
    sc = scratches(h, w, 260, PPM, lambda: abs(G.normal(0, 0.05)), lambda: G.normal(0, 0.12), (0.008, 0.06), 0.55)
    sc = np.maximum(sc, scratches(h, w, 90, PPM, lambda: G.uniform(YT, YL), lambda: G.normal(0, 0.08), (0.01, 0.05), 0.4))
    col = mix(col, WHITE, sc)
    col = mix(col, GRIME, scratches(h, w, 50, PPM, lambda: abs(G.normal(0, 0.04)), lambda: G.normal(0, 0.1), (0.005, 0.03), 0.4))
    # (grime at the foot; a shade under the lip)
    col = mix(col, GRIME, np.clip(1 - Y / 0.010, 0, 1) * (0.25 + 0.35 * nmid))
    col = col * (1 - 0.18 * np.clip(1 - (YL - Y) / 0.004, 0, 1))[..., None]
    grain = (wnoise(h, w, w / 2, h / 2) - 0.5) * 0.00003
    return col, nmap(feat + edge + grain, PPM, wrap=True)


def paint_in():
    """the inside round, from the floor to the top"""
    c = strip(I_CUM, NI, "in", FY)
    h, w, Y = c["h"], c["w"], c["Y"]
    side, short, t, L, cpos, clen = c["side"], c["short"], c["t"], c["L"], c["cpos"], c["clen"]
    sd = np.where(short, octa(t, L, Y), 1.0)
    post = ~side & (Y > YB) & (Y < YT)
    edge = eased(H - Y, 0.0025)
    edge = edge + np.where(side & (Y < YB), eased(YB - Y, 0.002), 0.0)
    edge = edge + np.where(side & (Y > YT), eased(Y - YT, 0.002), 0.0)
    edge = edge + np.where(post, eased(np.minimum(cpos, clen - cpos), 0.002), 0.0)
    edge = edge + np.where(short & (sd >= 0), eased(sd, 0.002), 0.0)
    nlo = wfbm(h, w, P_I / 0.09, (H - FY) / 0.09, 4)
    nmid = wfbm(h, w, P_I / 0.03, (H - FY) / 0.03, 3)
    nhi = wfbm(h, w, P_I / 0.008, (H - FY) / 0.008, 2)
    col = MAG[None, None, :] * (0.9 + 0.1 * nlo)[..., None]
    col = mix(col, FADE, np.clip(0.25 * nlo * (Y - FY) / (H - FY), 0, 1))
    # (the bottles' and cans' scrapes up and down it, a few across)
    sc = scratches(h, w, 140, PPM, lambda: G.uniform(0, H - FY), lambda: math.pi / 2 + G.normal(0, 0.15), (0.01, 0.07), 0.35)
    sc = np.maximum(sc, scratches(h, w, 40, PPM, lambda: G.uniform(0, H - FY), lambda: G.normal(0, 0.2), (0.01, 0.04), 0.3))
    col = mix(col, WHITE, sc)
    wz = np.clip(1 - (H - Y) / 0.005, 0, 1)
    wz = np.maximum(wz, np.where(side & ((Y < YB) & (YB - Y < 0.004) | (Y > YT) & (Y - YT < 0.004)), 0.7, 0))
    col = mix(col, WHITE, np.clip(wz * (nhi * 1.8 - 0.6), 0, 1) * 0.6)
    # (grime down at the floor)
    col = mix(col, GRIME, np.clip(1 - (Y - FY) / 0.03, 0, 1) ** 1.5 * (0.35 + 0.35 * nmid))
    return col, nmap(edge, PPM, wrap=True)


def paint_rim():
    """the rim's profile: its underside out from the wall, the lip up, its top in to the inside"""
    c = strip(O_CUM, NO, "rim", 0.0)
    h, w, V = c["h"], c["w"], c["Y"]
    e1, e2 = LIP, LIP + LIP_H
    edge = eased(np.abs(V - e1), 0.0018) + eased(np.abs(V - e2), 0.003) + eased(RIM_H - V, 0.002)
    top, under = V > e2, V < e1
    nlo = wfbm(h, w, P_O / 0.09, 2, 4)
    # (scuffs drawn out along the rim, as the crates stacked on it slide)
    nst = wfbm(h, w, P_O / 0.03, 10, 3)
    col = MAG[None, None, :] * (0.93 + 0.12 * nlo)[..., None]
    col = mix(col, FADE, np.clip(np.where(top, 0.45, 0.25) * nlo, 0, 1))
    # (its top worn by the crates stacked on it, white along its outer edge; the lip's face knocked)
    wz = np.where(top, 0.5, np.where(under, 0.0, 0.3))
    wz = np.maximum(wz, np.clip(1 - np.abs(V - e2) / 0.003, 0, 1))
    col = mix(col, WHITE, np.clip(wz * (nst * 1.9 - 0.65), 0, 1) * 0.6)
    sc = scratches(h, w, 260, PPM, lambda: G.uniform(e2, RIM_H), lambda: G.normal(0, 0.05), (0.01, 0.08), 0.6)
    sc = np.maximum(sc, scratches(h, w, 90, PPM, lambda: G.uniform(e1, e2), lambda: G.normal(0, 0.08), (0.008, 0.05), 0.45))
    col = mix(col, WHITE, sc)
    col = col * np.where(under, 0.72, 1.0)[..., None]
    return col, nmap(edge, PPM, wrap=True)


def paint_floor():
    """the floor from above: a grid of square holes in it (drawn), a plain border round them, grime"""
    _, _, w, h = REG["floor"]
    X = np.broadcast_to(((np.arange(w) + 0.5) / PPM - (W / 2 - T))[None, :], (h, w))
    Z = np.broadcast_to(((np.arange(h) + 0.5) / PPM - (D / 2 - T))[:, None], (h, w))
    pitch, hs, rr = 0.020, 0.0125, 0.002
    qx = np.abs(X - np.round(X / pitch) * pitch) - (hs / 2 - rr)
    qz = np.abs(Z - np.round(Z / pitch) * pitch) - (hs / 2 - rr)
    sdf = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qz, 0) ** 2) + np.minimum(np.maximum(qx, qz), 0) - rr
    inside = (np.abs(np.round(X / pitch) * pitch) <= 0.141) & (np.abs(np.round(Z / pitch) * pitch) <= 0.101)
    dep = np.where(inside, np.clip(-sdf / 0.0016, 0, 1), 0.0)
    hgt = -0.003 * (1 - (1 - dep) ** 2)
    nlo = wfbm(h, w, 6, 5, 4)
    nmid = wfbm(h, w, 20, 16, 3)
    col = MAG[None, None, :] * (0.86 + 0.1 * nlo)[..., None]
    col = mix(col, GRIME, np.clip(0.15 + 0.3 * nmid * nlo, 0, 1))
    col = mix(col, hx("#1e1416"), dep * 0.92)
    # (darker in toward the walls)
    edge_d = np.minimum((W / 2 - T) - np.abs(X), (D / 2 - T) - np.abs(Z))
    col = col * (1 - 0.3 * np.clip(1 - edge_d / 0.014, 0, 1))[..., None]
    sc = scratches(h, w, 60, PPM, lambda: G.uniform(0, D - 2 * T), lambda: G.uniform(0, math.pi), (0.01, 0.05), 0.3, wrap=False)
    col = mix(col, WHITE, sc * (1 - dep))
    return col, nmap(hgt, PPM)


def paint_edge():
    """the cut edges round the openings and through the hand-holds: plain, a shade darker"""
    _, _, w, h = REG["edge"]
    col = MAG[None, None, :] * (0.8 + 0.08 * wfbm(h, w, 24, 2, 2))[..., None]
    return col, np.broadcast_to(np.array([0.5, 0.5, 1.0], np.float32), (h, w, 3))


BODY = np.broadcast_to(MAG * 0.9, (BH, BW, 3)).copy()
BODYN = np.broadcast_to(np.array([0.5, 0.5, 1.0], np.float32), (BH, BW, 3)).copy()
for _name, _fn in (("out", paint_out), ("in", paint_in), ("rim", paint_rim), ("floor", paint_floor), ("edge", paint_edge)):
    _x, _y, _w, _h = REG[_name]
    _c, _n = _fn()
    BODY[_y:_y + _h, _x:_x + _w] = np.clip(_c, 0, 1)
    BODYN[_y:_y + _h, _x:_x + _w] = _n

# =====================================================================
# The lattice's picture (milkcrate_lattice, 1600 px a metre): the long sides' panel and the ends'; the holes' alpha 0
# =====================================================================
PPM_L = 1600.0
LW, LH = 1024, 256
LAT_H = (YT - YB) + 0.002
LREG = {}
LREG["long"] = (0, 0, int(math.ceil((W - 2 * R + 0.002) * PPM_L)), int(math.ceil(LAT_H * PPM_L)))
LREG["short"] = (LREG["long"][2] + 8, 0, int(math.ceil((D - 2 * R + 0.002) * PPM_L)), int(math.ceil(LAT_H * PPM_L)))
assert LREG["short"][0] + LREG["short"][2] <= LW and LREG["long"][3] <= LH
BAR, HOLE_R, BORDER = 0.0055, 0.0025, 0.006


def paint_lattice(Lside, reg):
    """a side's lattice: bars criss-cross at the diamonds' slant, a plain border round them where it meets the bands and the posts; the
    holes' corners rounded, the bars' edges rounded over (its normal map), the plastic's wear as the walls'"""
    _, _, w, h = reg
    wm = Lside + 0.002
    U = np.broadcast_to(((np.arange(w) + 0.5) / PPM_L - wm / 2)[None, :], (h, w))
    V = np.broadcast_to(((np.arange(h) + 0.5) / PPM_L - LAT_H / 2)[:, None], (h, w))
    hu, hv = Lside / 2 - BORDER, (YT - YB) / 2 - BORDER
    # (crossings at the middle, along the top and the foot, and at the border's ends: the diamonds come out whole or halved against it)
    nx = max(2, int(round(2 * hu / 0.025)))
    px, py = 2 * hu / nx, 2 * hv / 4
    a, b = U / px + V / py, U / px - V / py
    gn = math.sqrt(1 / px ** 2 + 1 / py ** 2)
    sa = np.abs(a - np.round(a)) / gn - BAR / 2
    sb = np.abs(b - np.round(b)) / gn - BAR / 2
    hole = rinter(rinter(sa, sb, HOLE_R), -np.maximum(np.abs(U) - hu, np.abs(V) - hv), 0.003)
    m = -hole
    alpha = np.clip(0.5 + m * PPM_L, 0, 1)
    hgt = raised(m, 0.0022, 0.0022)
    nlo = wnoise(h, w, wm / 0.08, LAT_H / 0.08)
    nhi = wfbm(h, w, wm / 0.008, LAT_H / 0.008, 2)
    col = MAG[None, None, :] * (0.92 + 0.12 * nlo)[..., None]
    col = mix(col, FADE, np.clip(0.3 * nlo * (V / LAT_H + 0.5), 0, 1))
    col = col * (0.8 + 0.2 * np.clip(m / 0.0022, 0, 1))[..., None]
    # (knocked white along the bars' edges, more toward the foot; scratches across, mostly low; grime on the foot's border)
    low = np.clip(0.5 - V / LAT_H, 0, 1)
    col = mix(col, WHITE, np.clip((1 - np.clip(m / 0.0016, 0, 1)) * (nhi * 1.7 - 0.6) * (0.4 + 0.8 * low), 0, 1) * 0.7)
    sc = scratches(h, w, 70, PPM_L, lambda: abs(G.normal(0, 0.05)), lambda: G.normal(0, 0.12), (0.01, 0.06), 0.5, width=1.0, wrap=False)
    col = mix(col, WHITE, sc)
    col = mix(col, GRIME, np.clip(1 - (V + LAT_H / 2) / 0.008, 0, 1) * 0.35)
    return np.clip(col, 0, 1), alpha, nmap(hgt, PPM_L)


LAT = np.broadcast_to(MAG * 0.9, (LH, LW, 3)).copy()
LATA = np.ones((LH, LW), np.float32)
LATN = np.broadcast_to(np.array([0.5, 0.5, 1.0], np.float32), (LH, LW, 3)).copy()
for _k, _len in (("long", W - 2 * R), ("short", D - 2 * R)):
    _x, _y, _w, _h = LREG[_k]
    _c, _a, _n = paint_lattice(_len, LREG[_k])
    LAT[_y:_y + _h, _x:_x + _w], LATA[_y:_y + _h, _x:_x + _w], LATN[_y:_y + _h, _x:_x + _w] = _c, _a, _n

# =====================================================================
# The drinks' picture (milkcrate_drinks): each kind's print round it (u round, v up), the caps' and the lids' tops
# =====================================================================
DW, DH = 512, 512
DREG = {"gt": (0, 0, 256, 256), "sp": (256, 0, 256, 256), "yz": (0, 260, 256, 160), "cf": (256, 260, 256, 160),
        "gtcap": (0, 424, 64, 64), "spcap": (68, 424, 64, 64), "lid": (136, 424, 64, 64)}
PET_R, PET_RS, PET_TOP = 0.0305, 0.0150, 0.214
PET_RINGS = ((PET_R, 0.0), (PET_R, 0.130), (PET_RS, 0.188), (PET_RS, PET_TOP))
PET_TILT = ((0, 0), (0, 40), (0, 0))      # each band's normals leaning up (degrees) at its foot, at its top: the shoulder rounded
CAN_R, CAN_RT, CAN_TOP = 0.029, 0.0245, 0.124
CAN_RINGS = ((CAN_R, 0.0), (CAN_R, 0.113), (CAN_RT, CAN_TOP))
CAN_TILT = ((0, 0), (5, 35))
LAB_Y0, LAB_Y1, FILL, CAP_Y0 = 0.030, 0.112, 0.177, 0.188
PET_AIR = hx("#8a9ea8")        # the clear plastic over the drink: the dark of the crate through it
FONT_JP = os.path.join(PROJECT, "blender", "fonts", "YujiBoku-Regular.ttf")
FONT_GOTHIC = "C:/Windows/Fonts/YuGothB.ttc"
FONT_LATIN = "C:/Windows/Fonts/ariblk.ttf"
_GLYPHS = {}


def glyphs(text, path):
    """a text's letters as triangles, its size 1, centred on its middle (none if the font isn't here)"""
    key = (text, path)
    if key in _GLYPHS:
        return _GLYPHS[key]
    tris = []
    if os.path.exists(path):
        cu = bpy.data.curves.new("glyphs", "FONT")
        cu.body = text
        cu.font = bpy.data.fonts.load(path, check_existing=True)
        cu.size = 1.0
        cu.align_x, cu.align_y = "CENTER", "CENTER"
        ob = bpy.data.objects.new("glyphs", cu)
        bpy.context.collection.objects.link(ob)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        me = ev.to_mesh()
        me.calc_loop_triangles()
        vs = [(v.co.x, v.co.y) for v in me.vertices]
        tris = [[vs[i] for i in lt.vertices] for lt in me.loop_triangles]
        ev.to_mesh_clear()
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        if tris:
            xs, ys = [p[0] for t in tris for p in t], [p[1] for t in tris for p in t]
            mx, my = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            tris = [[(x - mx, y - my) for x, y in t] for t in tris]
    _GLYPHS[key] = tris
    return tris


def raster(tris, h, w, ss=3):
    """how much of each pixel of an h x w picture the triangles (pixel coordinates, y up) cover"""
    m = np.zeros((h * ss, w * ss), np.float32)
    for tri in tris:
        q = [(x * ss, y * ss) for x, y in tri]
        x0, x1 = max(0, int(min(p[0] for p in q)) - 1), min(w * ss, int(max(p[0] for p in q)) + 2)
        y0, y1 = max(0, int(min(p[1] for p in q)) - 1), min(h * ss, int(max(p[1] for p in q)) + 2)
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
        (ax, ay), (bx, by), (cx, cy) = q
        d1 = (bx - ax) * (yy - ay) - (by - ay) * (xx - ax)
        d2 = (cx - bx) * (yy - by) - (cy - by) * (xx - bx)
        d3 = (ax - cx) * (yy - cy) - (ay - cy) * (xx - cx)
        ins = ((d1 >= 0) & (d2 >= 0) & (d3 >= 0)) | ((d1 <= 0) & (d2 <= 0) & (d3 <= 0))
        m[y0:y1, x0:x1] = np.maximum(m[y0:y1, x0:x1], ins)
    return m.reshape(h, ss, w, ss).mean(axis=(1, 3))


class Sheet:
    """a picture painted in metres: w x h pixels over mw x mh (x round a turned thing, wrapping; y up it)"""

    def __init__(self, w, h, mw, mh):
        self.w, self.h, self.mw, self.mh = w, h, mw, mh
        self.X = np.broadcast_to(((np.arange(w) + 0.5) / w * mw)[None, :], (h, w))
        self.Y = np.broadcast_to(((np.arange(h) + 0.5) / h * mh)[:, None], (h, w))
        self.col = np.zeros((h, w, 3), np.float32)
        self.px = min(mw / w, mh / h)

    def put(self, mask, colour, k=1.0):
        c = np.asarray(colour, np.float32)
        self.col = mix(self.col, np.broadcast_to(c, self.col.shape) if c.ndim == 1 else c, np.clip(mask * k, 0, 1))

    def dx(self, cx):
        return (self.X - cx + self.mw / 2) % self.mw - self.mw / 2

    def ellipse(self, cx, cy, rx, ry, ang=0.0):
        x, y = self.dx(cx), self.Y - cy
        if ang:
            ca, sa = math.cos(ang), math.sin(ang)
            x, y = x * ca + y * sa, -x * sa + y * ca
        return np.clip((1 - np.sqrt((x / rx) ** 2 + (y / ry) ** 2)) * min(rx, ry) / self.px, 0, 1)

    def rect(self, x0, y0, x1, y1):
        d = np.maximum(np.abs(self.dx((x0 + x1) / 2)) - (x1 - x0) / 2, np.abs(self.Y - (y0 + y1) / 2) - (y1 - y0) / 2)
        return np.clip(0.5 - d / self.px, 0, 1)

    def band(self, y0, y1):
        return np.clip(np.minimum(self.Y - y0, y1 - self.Y) / self.px + 0.5, 0, 1)

    def text(self, s, path, cx, cy, em, vertical=False, gap=0.98, sx=1.0):
        """letters `em` (metres) to their size, centred on (cx, cy); one under another if vertical"""
        chars = list(s) if vertical else [s]
        out = np.zeros((self.h, self.w), np.float32)
        for k, ch in enumerate(chars):
            tris = glyphs(ch, path)
            if not tris:
                continue
            y = cy + ((len(chars) - 1) / 2 - k) * em * gap
            q = [[((cx + x * em * sx) / self.mw * self.w, (y + yy * em) / self.mh * self.h) for x, yy in t] for t in tris]
            out = np.maximum(out, raster(q, self.h, self.w))
        return out


def sheen(S, below, k_bare, k_label):
    """the light down a bottle or can's side: two soft streaks up it"""
    on_label = (S.Y >= LAB_Y0) & (S.Y < LAB_Y1)
    for xs, k in ((0.15, 1.0), (0.62, 0.45)):
        d = np.abs(S.dx(xs * S.mw))
        S.put(np.exp(-(d / 0.0028) ** 2) * (S.Y < below), (1, 1, 1), k * np.where(on_label, k_label, k_bare))


def label_gt(S, lab):
    """the green tea's label, as the game prints it: white to green down it, 緑茶 down its middle, tea leaves, a red seal 濃"""
    t = np.clip((S.Y - LAB_Y0) / (LAB_Y1 - LAB_Y0), 0, 1)
    g = np.where((t > 0.4)[..., None], mix(hx("#dfecc8"), hx("#f6f8ee"), (t - 0.4) / 0.6), mix(hx("#9cc070"), hx("#dfecc8"), t / 0.4))
    S.put(lab, g)
    for f in (0.25, 0.75):
        cx = f * S.mw
        for k in range(5):
            S.put(S.ellipse(cx + 0.017, LAB_Y0 + 0.066 - k * 0.0095, 0.0066, 0.0023, -0.6 + k * 0.3) * lab, hx("#4a8a3a"), 0.4)
        S.put(S.text("緑茶", FONT_JP, cx - 0.004, LAB_Y0 + 0.043, 0.023, vertical=True) * lab, hx("#1f4a22"))
        S.put(S.rect(cx + 0.0115, LAB_Y0 + 0.008, cx + 0.0215, LAB_Y0 + 0.018) * lab, hx("#c4302a"))
        S.put(S.text("濃", FONT_JP, cx + 0.0165, LAB_Y0 + 0.013, 0.0078) * lab, (1, 1, 1))
    S.put(S.band(LAB_Y1 - 0.0012, LAB_Y1) + S.band(LAB_Y0, LAB_Y0 + 0.0012), hx("#4a8a3a"), 0.7)


def label_sp(S, lab):
    """the sports drink's label: white, a blue wave over its lower half, SPORTS DRINK in blue, イオン in white"""
    S.put(lab, (1, 1, 1))
    wave = LAB_Y0 + 0.034 + 0.004 * np.sin(S.X / S.mw * 2 * np.pi * 4)
    S.put(np.clip((wave - S.Y) / S.px + 0.5, 0, 1) * lab, hx("#1f5fb8"))
    for f in (0.25, 0.75):
        cx = f * S.mw
        S.put(S.text("SPORTS", FONT_LATIN, cx, LAB_Y0 + 0.064, 0.0105) * lab, hx("#1f5fb8"))
        S.put(S.text("DRINK", FONT_LATIN, cx, LAB_Y0 + 0.051, 0.0085) * lab, hx("#1f5fb8"))
        S.put(S.text("イオン", FONT_GOTHIC, cx, LAB_Y0 + 0.016, 0.011) * lab, (1, 1, 1))


def pet_sheet(reg, liquid, cap, label):
    """a 500 ml bottle round: the drink seen through the clear plastic (its foot's petals deeper), clear over the drink, the label, the
    neck's ring and the cap ribbed round"""
    _, _, w, h = DREG[reg]
    S = Sheet(w, h, 2 * math.pi * PET_R, PET_TOP)
    liq = np.asarray(liquid, np.float32)
    S.col[:] = liq
    S.put(np.clip(1 - S.Y / 0.012, 0, 1), liq * 0.6)
    S.put(S.band(FILL, CAP_Y0 + 0.001), PET_AIR)
    S.put(S.band(FILL - 0.0012, FILL), np.clip(liq * 1.15 + 0.08, 0, 1), 0.9)
    for yy in (0.141, 0.150, 0.172):
        S.put(S.band(yy - 0.0006, yy + 0.0006), (1, 1, 1), 0.3)
    lab = S.band(LAB_Y0, LAB_Y1)
    label(S, lab)
    sheen(S, CAP_Y0, 0.55, 0.22)
    S.put(S.band(CAP_Y0, CAP_Y0 + 0.0028), hx("#d8dee2"))
    capm = S.band(CAP_Y0 + 0.0028, PET_TOP + 0.01)
    rib = 0.5 + 0.5 * np.cos(2 * np.pi * 36 * S.X / S.mw)
    S.put(capm, np.asarray(cap, np.float32)[None, None, :] * (0.84 + 0.16 * rib)[..., None])
    S.put(capm * np.clip(1 - (PET_TOP - S.Y) / 0.0022, 0, 1), np.clip(np.asarray(cap) * 1.3 + 0.06, 0, 1), 0.7)
    return S.col


def alu(S):
    """the cans' bare aluminium: grey, lighter up the neck"""
    v = 0.74 + 0.1 * np.clip((S.Y - 0.113) / 0.011, 0, 1) + 0.05 * np.cos(2 * np.pi * S.X / S.mw * 2)
    return np.repeat(v[..., None], 3, -1) * np.array([0.98, 1.0, 1.03], np.float32)


def can_sheet(reg, kind):
    """a can round: its print from its foot's rim to its neck, bare aluminium above and below (yuzu soda or coffee, as the game prints
    them)"""
    _, _, w, h = DREG[reg]
    S = Sheet(w, h, 2 * math.pi * CAN_R, CAN_TOP)
    S.col = alu(S)
    body = S.band(0.004, 0.113)
    t = np.clip((S.Y - 0.004) / 0.109, 0, 1)
    if kind == "yz":
        S.put(body, mix(hx("#b8d050"), hx("#f4f2a0"), t))
        for _ in range(22):
            r = G.uniform(0.0012, 0.0024)
            S.put(S.ellipse(G.uniform(0, S.mw), G.uniform(0.012, 0.104), r, r) * body, (1, 1, 1), 0.7)
        for f in (0.25, 0.75):
            cx = f * S.mw
            S.put(S.ellipse(cx + 0.012, 0.062, 0.0125, 0.0125) * body, hx("#f2c41c"))
            S.put(S.ellipse(cx + 0.016, 0.0775, 0.0062, 0.0028, -0.5) * body, hx("#3a7a2a"))
            S.put(S.text("ゆず", FONT_JP, cx - 0.011, 0.063, 0.017, vertical=True) * body, hx("#2a5a2a"))
            S.put(S.text("SODA", FONT_LATIN, cx, 0.021, 0.0095) * body, hx("#2a5a2a"))
    else:
        S.put(body, mix(hx("#1c0e06"), hx("#3a2012"), t))
        for yy in (0.004 + 0.109 * 0.14, 0.004 + 0.109 * 0.84):
            S.put(S.band(yy - 0.0006, yy + 0.0006), hx("#c89a4a"))
        for f in (0.25, 0.75):
            cx = f * S.mw
            ty = np.clip((S.Y - 0.050) / 0.013, 0, 1)
            cup = np.clip(((0.006 + 0.002 * ty) - np.abs(S.dx(cx))) / S.px + 0.5, 0, 1) * S.band(0.050, 0.063)
            S.put(cup * body, hx("#f2e6cc"))
            ring = np.clip(1 - np.abs(np.sqrt((S.dx(cx + 0.0085) / 0.0034) ** 2 + ((S.Y - 0.0565) / 0.0036) ** 2) - 1) * 0.0034 / 0.0009, 0, 1)
            S.put(ring * (S.dx(cx + 0.0085) > 0) * body, hx("#f2e6cc"))
            for dxs in (-0.0035, 0.0, 0.0035):
                wisp = np.clip(1 - np.abs(S.dx(cx + dxs + 0.0012 * np.sin((S.Y - 0.066) / 0.0035))) / 0.0006, 0, 1) * S.band(0.066, 0.077)
                S.put(wisp * body, hx("#f2e6cc"), 0.7)
            S.put(S.text("COFFEE", FONT_LATIN, cx, 0.037, 0.0085) * body, hx("#e8c27a"))
            S.put(S.ellipse(cx + 0.016, 0.090, 0.0068, 0.0068) * body, hx("#c4302a"))
            S.put(S.text("微糖", FONT_GOTHIC, cx + 0.016, 0.090, 0.0042) * body, (1, 1, 1))
    sheen(S, CAN_TOP + 1, 0.45, 0.25)
    return S.col


def top_sheet(reg, kind, cap=None):
    """a top from above (the square's circle its edge): a cap (its colour, a ring pressed in it, fine ribs round its edge, the light on
    it) or a can's lid (the rolled rim, the lid sunk in it, its scored ring, the pull lying on it with its finger hole and rivet)"""
    _, _, s, _ = DREG[reg]
    u = np.broadcast_to(((np.arange(s) + 0.5) / s * 2 - 1)[None, :], (s, s))
    v = np.broadcast_to(((np.arange(s) + 0.5) / s * 2 - 1)[:, None], (s, s))
    r = np.sqrt(u * u + v * v)
    S = Sheet(s, s, 2.0, 2.0)
    px = 2.0 / s

    def disc(cx, cy, rx, ry):
        return np.clip((1 - np.sqrt(((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2)) * min(rx, ry) / px, 0, 1)

    def ring(r0, r1):
        return np.clip(np.minimum(r - r0, r1 - r) / px + 0.5, 0, 1)
    if kind == "cap":
        c = np.asarray(cap, np.float32)
        S.col[:] = c
        S.put(ring(0.6, 0.68), c * 0.72)
        rib = 0.5 + 0.5 * np.cos(36 * np.arctan2(v, u))
        S.put(ring(0.84, 1.2) * rib, c * 0.7, 0.8)
        S.put(disc(-0.28, 0.3, 0.32, 0.22), np.clip(c * 1.35 + 0.12, 0, 1), 0.5)
    else:
        S.col[:] = 0.7
        S.put(ring(0.87, 1.2), (0.88, 0.89, 0.91))
        S.put(ring(0.84, 0.87), (0.5, 0.52, 0.55), 0.8)
        S.put(ring(0.655, 0.68), (0.5, 0.52, 0.55), 0.6)
        S.put(disc(0.0, 0.4, 0.27, 0.17), (0.6, 0.62, 0.65), 0.6)
        S.put(disc(0.0, -0.1, 0.18, 0.36), (0.88, 0.89, 0.91))
        S.put(disc(0.0, -0.3, 0.09, 0.07), (0.52, 0.54, 0.57))
        S.put(disc(0.0, 0.07, 0.06, 0.06), (0.95, 0.95, 0.96))
        S.put(disc(-0.3, 0.32, 0.3, 0.2), (1, 1, 1), 0.25)
    return S.col


DRK = np.broadcast_to(np.array([0.7, 0.7, 0.7], np.float32), (DH, DW, 3)).copy()
_sheets = {"gt": pet_sheet("gt", hx("#a9b85c"), hx("#2f7a3a"), label_gt), "sp": pet_sheet("sp", hx("#d7e8f0"), hx("#1f6fb8"), label_sp),
           "yz": can_sheet("yz", "yz"), "cf": can_sheet("cf", "cf"), "gtcap": top_sheet("gtcap", "cap", hx("#2f7a3a")),
           "spcap": top_sheet("spcap", "cap", hx("#1f6fb8")), "lid": top_sheet("lid", "lid")}
for _k, _c in _sheets.items():
    _x, _y, _w, _h = DREG[_k]
    DRK[_y:_y + _h, _x:_x + _w] = np.clip(_c, 0, 1)

# =====================================================================
# Materials
# =====================================================================
M = {"plastic": pbr("MilkCratePlastic", (1, 1, 1), tex=image("milkcrate_plastic", BODY), nrm=image("milkcrate_plastic_n", BODYN, data=True),
                    rough=0.45),
     "lattice": pbr("MilkCrateLattice", (1, 1, 1), tex=image("milkcrate_lattice", LAT, alpha=LATA),
                    nrm=image("milkcrate_lattice_n", LATN, data=True), rough=0.45),
     "drinks": pbr("MilkCrateDrinks", (1, 1, 1), tex=image("milkcrate_drinks", DRK), rough=0.32)}
# (the lattice's alpha rounded to 0 or 1 before it's the surface's: exported as alphaMode MASK (cut at 0.5), and cut clean in the preview;
# it alone double-sided: the far sides are seen from inside the crate)
_nt = M["lattice"].node_tree
_tex = next(n for n in _nt.nodes if n.type == "TEX_IMAGE" and n.image and n.image.name == "milkcrate_lattice")
_rd = _nt.nodes.new("ShaderNodeMath")
_rd.operation = "ROUND"
_nt.links.new(_tex.outputs["Alpha"], _rd.inputs[0])
_nt.links.new(_rd.outputs[0], _nt.nodes["Principled BSDF"].inputs["Alpha"])
M["lattice"].use_backface_culling = False
M["plastic"].use_backface_culling = True
M["drinks"].use_backface_culling = True


def set_normals(obj, normal_of):
    """each face corner's normal from normal_of(polygon, its vertex's place) (Blender's frame); the edges where they differ either side
    made sharp, the rest smooth"""
    me = obj.data
    nrm = [None] * len(me.loops)
    at = {}
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            nrm[li] = Vector(normal_of(p, me.vertices[vi].co)).normalized()
            at[(p.index, vi)] = nrm[li]
    by_edge = {}
    for p in me.polygons:
        for ek in p.edge_keys:
            by_edge.setdefault(ek, []).append(p.index)
    for e in me.edges:
        ps = by_edge.get(tuple(sorted(e.vertices)), [])
        e.use_edge_sharp = len(ps) != 2 or any((at[(ps[0], v)] - at[(ps[1], v)]).length > 1e-4 for v in e.vertices)
    for p in me.polygons:
        p.use_smooth = True
    me.normals_split_custom_set([tuple(n) for n in nrm])


# =====================================================================
# The crate's shell
# =====================================================================
bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UVMap")
VS = {}
BUILT = []


def vtx(key, x, y, z):
    v = VS.get(key)
    if v is None:
        v = VS[key] = bm.verts.new(P(x, y, z))
    return v


def ov(k, y):
    k %= M_O
    return vtx(("o", k, round(y, 6)), O_PTS[k][0], y, O_PTS[k][1])


def lv(k, y):
    k %= M_O
    return vtx(("l", k, round(y, 6)), L_PTS[k][0], y, L_PTS[k][1])


def iv(k, y):
    k %= M_I
    return vtx(("i", k, round(y, 6)), I_PTS[k][0], y, I_PTS[k][1])


def face(vs, uvs, want, rnd=None):
    """a face through vs (their uvs), turned to face `want` (the game's frame); `rnd` (a corner's middle x, z and 1 out or -1 in) if it's
    one of a round's steps"""
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(P(*want)) < 0:
        f.normal_flip()
    m = dict(zip(vs, uvs))
    for lp in f.loops:
        lp[uvl].uv = m[lp.vert]
    BUILT.append((f, rnd))
    return f


def seg_out(pts, k):
    """the outward normal of the outline's k-th step (x, 0, z)"""
    (ax, az), (bx, bz) = pts[k], pts[(k + 1) % len(pts)]
    ln = math.hypot(bx - ax, bz - az)
    return (-(bz - az) / ln, 0.0, (bx - ax) / ln)


def euv(s, t):
    return buv("edge", s, t)


# ---- the outside: the foot band all round; between the bands only the corner posts; the top band round the corners and along the long
# sides up to the lip (the ends' faces round their hand-holds below)
for y0, y1, which in ((0.0, YB, "all"), (YB, YT, "corners"), (YT, YL, "notends")):
    for k in range(M_O):
        ci, side = k // (NO + 1), k % (NO + 1) == NO
        if (which == "corners" and side) or (which == "notends" and side and SHORT[ci]):
            continue
        s0, s1 = O_CUM[k], O_CUM[k + 1]
        face([ov(k, y0), ov(k + 1, y0), ov(k + 1, y1), ov(k, y1)],
             [buv("out", s0, y0), buv("out", s1, y0), buv("out", s1, y1), buv("out", s0, y1)],
             seg_out(O_PTS, k), None if side else (*centre(ci), 1))
# ---- the inside the same, from the floor to the top
for y0, y1, which in ((FY, YB, "all"), (YB, YT, "corners"), (YT, H, "notends")):
    for k in range(M_I):
        ci, side = k // (NI + 1), k % (NI + 1) == NI
        if (which == "corners" and side) or (which == "notends" and side and SHORT[ci]):
            continue
        s0, s1 = I_CUM[k], I_CUM[k + 1]
        o = seg_out(I_PTS, k)
        face([iv(k, y0), iv(k + 1, y0), iv(k + 1, y1), iv(k, y1)],
             [buv("in", s0, y0 - FY), buv("in", s1, y0 - FY), buv("in", s1, y1 - FY), buv("in", s0, y1 - FY)],
             (-o[0], 0.0, -o[2]), None if side else (*centre(ci), -1))
# ---- the lip: its underside out from the wall, its face up to the top
for k in range(M_O):
    ci, side = k // (NO + 1), k % (NO + 1) == NO
    s0, s1 = O_CUM[k], O_CUM[k + 1]
    face([ov(k, YL), ov(k + 1, YL), lv(k + 1, YL), lv(k, YL)],
         [buv("rim", s0, 0.0), buv("rim", s1, 0.0), buv("rim", s1, LIP), buv("rim", s0, LIP)], (0, -1, 0))
    face([lv(k, YL), lv(k + 1, YL), lv(k + 1, H), lv(k, H)],
         [buv("rim", s0, LIP), buv("rim", s1, LIP), buv("rim", s1, LIP + LIP_H), buv("rim", s0, LIP + LIP_H)],
         seg_out(L_PTS, k), None if side else (*centre(ci), 1))


def inner_u(m):
    """how far round the outside strip the inside's point m lies (its corner's same fraction round)"""
    if m >= M_I:
        return P_O
    ci, j = divmod(m, NI + 1)
    c0, c1 = O_CUM[ci * (NO + 1)], O_CUM[ci * (NO + 1) + NO]
    return c0 + (c1 - c0) * j / NI


# ---- the top: from the lip's edge in to the inside; at each corner two quads and a triangle between the lip's four points and the
# inside's three
TV0, TV1 = LIP + LIP_H, RIM_H
for ci in range(4):
    lk = [ci * (NO + 1) + j for j in range(NO + 1)]
    ik = [ci * (NI + 1) + j for j in range(NI + 1)]
    for ls, ins in (((lk[0], lk[1]), (ik[1], ik[0])), ((lk[1], lk[2]), (ik[1],)), ((lk[2], lk[3]), (ik[2], ik[1]))):
        face([lv(k, H) for k in ls] + [iv(m, H) for m in ins],
             [buv("rim", O_CUM[k], TV0) for k in ls] + [buv("rim", inner_u(m), TV1) for m in ins], (0, 1, 0))
    ln, ln2, inn, in2 = lk[-1], (ci + 1) * (NO + 1), ik[-1], (ci + 1) * (NI + 1)
    face([lv(ln, H), lv(ln2, H), iv(in2, H), iv(inn, H)],
         [buv("rim", O_CUM[ln], TV0), buv("rim", O_CUM[ln2], TV0), buv("rim", inner_u(in2), TV1), buv("rim", inner_u(inn), TV1)], (0, 1, 0))
# ---- each side's opening: its cut edges (the foot's facing up, the top's down, its ends facing in along it)
for s in range(4):
    ks, ke, _, d, _, L = side_geo(s)
    kis, kie = side_ends(s, NI)
    face([ov(ks, YB), ov(ke, YB), iv(kie, YB), iv(kis, YB)], [euv(0, 0), euv(L, 0), euv(L, T), euv(0, T)], (0, 1, 0))
    face([ov(ks, YT), ov(ke, YT), iv(kie, YT), iv(kis, YT)], [euv(0, 0), euv(L, 0), euv(L, T), euv(0, T)], (0, -1, 0))
    hh = YT - YB
    face([ov(ks, YB), ov(ks, YT), iv(kis, YT), iv(kis, YB)], [euv(0, 0), euv(hh, 0), euv(hh, T), euv(0, T)], (d[0], 0, d[1]))
    face([ov(ke, YB), ov(ke, YT), iv(kie, YT), iv(kie, YB)], [euv(0, 0), euv(hh, 0), euv(hh, T), euv(0, T)], (-d[0], 0, -d[1]))


def octagon(L):
    """the hand-hold's outline round (t along the end, y up)"""
    tc, hx_ = L / 2, SW / 2
    return [(tc - hx_ + SCH, SY0), (tc + hx_ - SCH, SY0), (tc + hx_, SY0 + SCH), (tc + hx_, SY1 - SCH),
            (tc + hx_ - SCH, SY1), (tc - hx_ + SCH, SY1), (tc - hx_, SY1 - SCH), (tc - hx_, SY0 + SCH)]


# ---- each end's top band round its hand-hold, outside (up to the lip) and inside (up to the top): a frame of four quads from the band's
# four corners to the hole's long sides and ends, a triangle at each of the hole's cut corners; then the hole's sides through the wall
for s in (1, 3):
    ks, ke, _, d, out, L = side_geo(s)
    kis, kie = side_ends(s, NI)
    oc = octagon(L)
    for outer in (True, False):
        depth, top = (0.0, YL) if outer else (T, H)
        A, B = (ov(ks, YT), ov(ke, YT)) if outer else (iv(kis, YT), iv(kie, YT))
        C, Dv = (ov(ke, top), ov(ks, top)) if outer else (iv(kie, top), iv(kis, top))
        hv = [vtx(("slot", s, outer, i), *spt(s, t, y, depth)) for i, (t, y) in enumerate(oc)]
        reg, s0, vo = ("out", O_CUM[ks], 0.0) if outer else ("in", I_CUM[kis], FY)
        cA, cB, cC, cD = (0.0, YT), (L, YT), (L, top), (0.0, top)
        want = (out[0], 0.0, out[1]) if outer else (-out[0], 0.0, -out[1])
        for poly in (((A, cA), (B, cB), (hv[1], oc[1]), (hv[0], oc[0])), ((B, cB), (hv[2], oc[2]), (hv[1], oc[1])),
                     ((B, cB), (C, cC), (hv[3], oc[3]), (hv[2], oc[2])), ((C, cC), (hv[4], oc[4]), (hv[3], oc[3])),
                     ((C, cC), (Dv, cD), (hv[5], oc[5]), (hv[4], oc[4])), ((Dv, cD), (hv[6], oc[6]), (hv[5], oc[5])),
                     ((Dv, cD), (A, cA), (hv[7], oc[7]), (hv[6], oc[6])), ((A, cA), (hv[0], oc[0]), (hv[7], oc[7]))):
            face([v for v, _ in poly], [buv(reg, s0 + c[0], c[1] - vo) for _, c in poly], want)
    for i in range(8):
        j = (i + 1) % 8
        (ti, yi), (tj, yj) = oc[i], oc[j]
        wt, wy = L / 2 - (ti + tj) / 2, SYC - (yi + yj) / 2
        ln = math.hypot(tj - ti, yj - yi)
        face([VS[("slot", s, True, i)], VS[("slot", s, True, j)], VS[("slot", s, False, j)], VS[("slot", s, False, i)]],
             [euv(0, 0), euv(ln, 0), euv(ln, T), euv(0, T)], (d[0] * wt, wy, d[1] * wt))


def adopt(f, want, uv_of):
    f.normal_update()
    if f.normal.dot(P(*want)) < 0:
        f.normal_flip()
    for lp in f.loops:
        lp[uvl].uv = uv_of(lp.vert.co)
    BUILT.append((f, None))


# ---- the floor's top (a ladder of quads straight across: no fan), the foot under it
for f in ladder_fill(bm, [iv(m, FY) for m in range(M_I)]):
    adopt(f, (0, 1, 0), lambda co: buv("floor", co.x + W / 2 - T, -co.y + D / 2 - T))
for f in ladder_fill(bm, [ov(k, 0.0) for k in range(M_O)]):
    adopt(f, (0, -1, 0), lambda co: buv("floor", (co.x / W + 0.5) * (W - 2 * T), (-co.y / D + 0.5) * (D - 2 * T)))
bm.faces.index_update()
RND = {f.index: r for f, r in BUILT if r}
_open = [e for e in bm.edges if len(e.link_faces) != 2]
print("CRATE_OPEN_EDGES", len(_open), "MAX_SIDES", max(len(f.verts) for f in bm.faces))
me = bpy.data.meshes.new("MilkCrate")
bm.to_mesh(me)
bm.free()
crate = bpy.data.objects.new("MilkCrate", me)
bpy.context.collection.objects.link(crate)
crate.data.materials.append(M["plastic"])


def crate_normal(p, co):
    r = RND.get(p.index)
    if not r:
        return p.normal.copy()
    cx, cz, sg = r
    dx, dz = co.x - cx, -co.y - cz
    ln = math.hypot(dx, dz)
    return P(sg * dx / ln, 0.0, sg * dz / ln)


set_normals(crate, crate_normal)

# ---- the lattice: a quad a side at the wall's middle, a millimetre into the posts and bands round its opening, facing out
bm = bmesh.new()
uvl2 = bm.loops.layers.uv.new("UVMap")
for s in range(4):
    _, _, _, _, out, L = side_geo(s)
    lx, ly, _, _ = LREG["short" if SHORT[s] else "long"]
    t0, t1, y0, y1 = -0.001, L + 0.001, YB - 0.001, YT + 0.001
    corners = ((t0, y0), (t1, y0), (t1, y1), (t0, y1))
    vs = [bm.verts.new(P(*spt(s, t, y, T / 2))) for t, y in corners]
    uvs = dict(zip(vs, [((lx + (t - t0) * PPM_L) / LW, (ly + (y - y0) * PPM_L) / LH) for t, y in corners]))
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(P(out[0], 0, out[1])) < 0:
        f.normal_flip()
    for lp in f.loops:
        lp[uvl2].uv = uvs[lp.vert]
me = bpy.data.meshes.new("MilkCrateLattice")
bm.to_mesh(me)
bm.free()
lattice = bpy.data.objects.new("MilkCrateLattice", me)
bpy.context.collection.objects.link(lattice)
lattice.data.materials.append(M["lattice"])
lattice.parent = crate

# =====================================================================
# The drinks
# =====================================================================
DR_N = 8
COLS_X = (-0.132, -0.066, 0.0, 0.066, 0.132)
ROWS_Z = (-0.0975, -0.0325, 0.0325, 0.0975)
# (where each stands (row back to front, column left to right): the back two rows full, the bottles behind, the cans before them; the
# front two gone to the fridge. Seen from over its front (+z), the front wall hides the floor nearest it, so the crate looks full)
LAYOUT = [(0, 0, "gt"), (0, 1, "sp"), (0, 2, "gt"), (0, 3, "sp"), (0, 4, "gt"),
          (1, 0, "sp"), (1, 1, "yz"), (1, 2, "cf"), (1, 3, "yz"), (1, 4, "gt")]
KINDS = {"gt": (PET_RINGS, PET_TILT, "gt", "gtcap"), "sp": (PET_RINGS, PET_TILT, "sp", "spcap"),
         "yz": (CAN_RINGS, CAN_TILT, "yz", "lid"), "cf": (CAN_RINGS, CAN_TILT, "cf", "lid")}
bm = bmesh.new()
uv3 = bm.loops.layers.uv.new("UVMap")
DINFO = []
FOOT = FY + 0.001


def turned(at, turn, rings, tilts, wrap, top):
    """a bottle or can turned from its profile `rings` [(r, y)] (its foot up), 8 round about `at` (x, z), its print's seam turned `turn`;
    each band's normals leaning up `tilts` (degrees, its foot's, its top's); its top closed by a ladder"""
    cx, cz = at
    ys = [y for _, y in rings]
    vr = [[bm.verts.new(P(cx + r * math.cos(turn + 2 * math.pi * j / DR_N), FOOT + y, cz - r * math.sin(turn + 2 * math.pi * j / DR_N)))
           for j in range(DR_N)] for r, y in rings]
    wx, wy, ww, wh = DREG[wrap]
    for i in range(len(rings) - 1):
        for j in range(DR_N):
            jn = (j + 1) % DR_N
            f = bm.faces.new((vr[i][j], vr[i][jn], vr[i + 1][jn], vr[i + 1][j]))
            for lp, u, v in zip(f.loops, (j, j + 1, j + 1, j), (ys[i], ys[i], ys[i + 1], ys[i + 1])):
                lp[uv3].uv = ((wx + u / DR_N * ww) / DW, (wy + v / ys[-1] * wh) / DH)
            DINFO.append((f, ("band", cx, cz, FOOT + ys[i], FOOT + ys[i + 1], tilts[i][0], tilts[i][1])))
    tx, ty, ts, _ = DREG[top]
    ring = vr[-1]
    for f in ladder_fill(bm, ring):
        f.normal_update()
        if f.normal.dot(P(0, 1, 0)) < 0:
            f.normal_flip()
        for lp in f.loops:
            a = 2 * math.pi * ring.index(lp.vert) / DR_N
            lp[uv3].uv = ((tx + (0.5 + 0.5 * math.cos(a)) * ts) / DW, (ty + (0.5 + 0.5 * math.sin(a)) * ts) / DH)
        DINFO.append((f, ("top",)))


def inside(x, z, margin):
    """whether (x, z) is inside the crate's inside outline by `margin`"""
    ex, ez = W / 2 - T - margin, D / 2 - T - margin
    if abs(x) > ex or abs(z) > ez:
        return False
    cx, cz = W / 2 - R, D / 2 - R
    if abs(x) > cx and abs(z) > cz:
        return math.hypot(abs(x) - cx, abs(z) - cz) <= R - T - margin
    return True


PLACED = []
_GP = np.random.default_rng(4370)      # (their own draws: the pictures' noise doesn't move them)
for row, colm, kind in LAYOUT:
    rings, tilts, wrap, top = KINDS[kind]
    x, z = COLS_X[colm] + _GP.uniform(-0.0015, 0.0015), ROWS_Z[row] + _GP.uniform(-0.0015, 0.0015)
    r = max(rr for rr, _ in rings)
    PLACED.append((x, z, r))
    turned((x, z), _GP.uniform(0, 2 * math.pi), rings, tilts, wrap, top)
# (each a millimetre or more clear of the others and of the walls: the closest gaps)
_gap = min(math.hypot(a[0] - b[0], a[1] - b[1]) - a[2] - b[2] for i, a in enumerate(PLACED) for b in PLACED[i + 1:])
_wall = all(inside(x + r * math.cos(q), z + r * math.sin(q), 0.001) for x, z, r in PLACED for q in np.linspace(0, 2 * math.pi, 48))
print("DRINKS_GAP", round(_gap, 4), "CLEAR_OF_WALLS", _wall)
assert _gap >= 0.001 and _wall
bm.faces.index_update()
DN = {f.index: info for f, info in DINFO}
me = bpy.data.meshes.new("MilkCrateDrinks")
bm.to_mesh(me)
bm.free()
drinks = bpy.data.objects.new("MilkCrateDrinks", me)
bpy.context.collection.objects.link(drinks)
drinks.data.materials.append(M["drinks"])


def drink_normal(p, co):
    info = DN[p.index]
    if info[0] == "top":
        return P(0, 1, 0)
    _, cx, cz, y0, y1, t0, t1 = info
    gx, gy, gz = co.x, co.z, -co.y
    dx, dz = gx - cx, gz - cz
    ln = math.hypot(dx, dz)
    tilt = math.radians(t0 + (t1 - t0) * min(1.0, max(0.0, (gy - y0) / (y1 - y0))))
    return P(math.cos(tilt) * dx / ln, math.sin(tilt), math.cos(tilt) * dz / ln)


set_normals(drinks, drink_normal)

root = bpy.data.objects.new("MilkCrateRoot", None)
bpy.context.collection.objects.link(root)
crate.parent = root
drinks.parent = root
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (crate, lattice, drinks)}
_xs = [v.co.x for v in crate.data.vertices]
_zs = [-v.co.y for v in crate.data.vertices]
_ys = [v.co.z for v in crate.data.vertices]
print("MILKCRATE_TRIS", tris, "CRATE", tris["MilkCrate"] + tris["MilkCrateLattice"])
print("MILKCRATE_SIZE x", round(min(_xs), 4), round(max(_xs), 4), "y", round(min(_ys), 4), round(max(_ys), 4),
      "z", round(min(_zs), 4), round(max(_zs), 4))
print("MILKCRATE_ATLAS body", BW, BH, "lattice", LW, LH, "drinks", DW, DH)

# =====================================================================
# Preview (a floor under it, a sun, two more views) and export
# =====================================================================
if PREVIEW:
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Punchy"
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 1280, 900
    floor_me = bpy.data.meshes.new("PreviewFloor")
    floor_me.from_pydata([(-2, -2, -0.0004), (2, -2, -0.0004), (2, 2, -0.0004), (-2, 2, -0.0004)], [], [(0, 1, 2, 3)])
    floor_ob = bpy.data.objects.new("PreviewFloor", floor_me)
    bpy.context.collection.objects.link(floor_ob)
    floor_me.materials.append(pbr("PreviewFloor", (0.32, 0.27, 0.22), rough=0.8))
    sun = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(12)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (P(0, 0, 0) - P(-0.6, 1.2, 0.9)).to_track_quat("-Z", "Y").to_euler()
    fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "SUN"))
    fill.data.energy = 1.2
    bpy.context.collection.objects.link(fill)
    fill.rotation_euler = (P(0, 0, 0) - P(1.0, 0.8, -0.7)).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.55, 0.55, 0.57)
    scene.world = world
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    def aim(eye, at, lens):
        cam.location = P(*eye)
        cam.rotation_euler = (P(*at) - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens

    base, ext = os.path.splitext(PREVIEW)
    for suffix, eye, at, lens in (("-top", (0.32, 0.78, 0.52), (0.0, 0.09, 0.0), 50), ("-end", (0.52, 0.27, -0.16), (0.12, 0.15, 0.0), 50),
                                  ("-close", (0.36, 0.36, 0.40), (0.14, 0.17, 0.11), 70)):
        aim(eye, at, lens)
        scene.render.filepath = base + suffix + ext
        bpy.ops.render.render(write_still=True)
    aim((0.5, 0.42, 0.78), (0.0, 0.11, 0.0), 50)
export_dish(root, [crate, lattice, drinks, root], os.path.join(PROJECT, "public", "models", "milkcrate.glb"),
            os.path.join(PROJECT, "blender", "milkcrate.blend"), PREVIEW, ladder=False)
print("MILKCRATE_DONE")
