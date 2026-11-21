"""The premium liquor's hanging shelf over the bar (liquorshelf.glb; items 443, 450, the owner's, 2026-11-21: 「上面新增系統櫃壩台，專門放高級酒」,
then 「要做在燈的上面」, the cabinet over the kitchen crossed out and the L of the bar boxed: over the lamps along the bar).

An open shelf of dark walnut in an L over the two counters, hung from the room's top on short black rods, its foot just over the pendant
lamps (they hang from it): run A along the long counter from the corner out past its last seat, run B along the side counter from A's back
out past its last; bays divided by boards, a rail along the kitchen's side at the bottles' shoulders, a strip of warm LED under the top on
the customers' side (its own light: no lamp added). On it the shop's better bottles, four to a bay at their true size (four-go bottles of
sake, a shochu's stout bottle, a squared whisky, a round umeshu), their labels toward the customers. Each bottle a lathe of eight sides (the
whisky's four), its glass's colour and its cap's in its points' colour (one material); its label a band round the side it faces on its own
cell of one picture the game paints (LIQUOR_LABELS in the game: the cells in the order of CELL_KINDS here, round again past the last).

Made over (item 504, the owner's 「酒櫃實在不好看，幫我美化並調整酒瓶位置，要美觀」: four bottles huddled in the middle of each wide bay, their
heights, glass and turns at random, the kitchen's clutter seen between them, the LED a bare white line): each bay backed by a panel of warm
washi lit from behind (LiquorBack: brightest behind the bottles' bodies, falling off to its edges, so they stand against it as silhouettes),
a fascia under the top's front edge hiding the LED with a fine brass line along it (LiquorBrass), a low lip along each foot's front; one
kind to a bay (sake six, shochu, whisky and umeshu five), spread evenly over the bay, all at one depth, square to the customers, their
glass mirrored about the bay's middle.

Nodes: "LiquorCabinet" (its boards LiquorWood, the strips LiquorLED, the rods LiquorRod, the backs LiquorBack, the line LiquorBrass), "LiquorBottles" (LiquorGlass, its colours in its
points), "LiquorLabels" (LiquorLabel, the game's picture). The game's frame, in the bar's units: the corner (where the two counters' lamp
lines meet) at the origin, y up from the shelf's foot; x along run A (the long counter's way out from the corner), z along run B (the side
counter's); A's customers toward -z, B's toward -x. About 4,000 triangles all told.

Run:
    blender -b --factory-startup --python blender/liquorshelf.py -- <project path>
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
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(450)
RS = np.random.default_rng(450)


def P(x, y, z):
    """the game's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


L_A, L_B = 3.76, 3.41                     # its two runs: from the corner (the lamp lines' meeting) out past each counter's last seat
D, H, T = 0.17, 0.23, 0.012               # its depth, its height, its boards' thickness
ROD_UP = 0.05                              # its rods up to the room's top (the shelf's foot hung at 2.02 of the room's 2.3)
BAYS_A, BAYS_B = 5, 4
S = 0.6                                    # the bottles at their true size against the room (the cabinet's were made 1.6 times too big)
COLS, ROWS = 8, 4                          # the labels' picture's cells

# ---------------------------------------------------------------- pictures
# (walnut: a dark brown, its grain running along the board, a band of lighter figure now and then)
N = 512
u, v = grid01(N)
grain = np.sin((v * 38 + (fbm(N, 3, 9, 4) - 0.5) * 2.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.20, 0.11, 0.06), (0.11, 0.058, 0.03), smooth(0.4, 1.0, grain) * 0.85)
wood = mix(wood, (0.27, 0.15, 0.08), smooth(0.72, 0.95, fbm(N, 2, 7, 4)) * 0.3)
wood = wood * (0.92 + 0.1 * fbm(N, 4, 24, 3))[..., None]
WOOD_TEX = image("liquor_walnut", np.clip(wood, 0, 1).astype(np.float32))
WOOD_NRM = image("liquor_walnut_nrm", to_normal(grain * 0.6 + fbm(N, 6, 30, 3) * 0.4, 1.0).astype(np.float32), data=True)

# (item 504: the bays' backs, warm washi lit from behind: its fibres and a few long ones, warm cream at its middle where the bottles stand,
# falling off to amber and dusk at its edges, a little more at its foot and its top; one bay's worth, each bay's back laid over all of it)
bu, bv = grid01(256)
# (washi: soft clouding, and its fibres short and fine, a few here and there, mostly up and down (long waving lines read as wood grain))
fib = smooth(0.8, 0.9, vnoise(256, 90, 26)) * 0.07 + (fbm(256, 5, 4, 3) - 0.5) * 0.07
glow = np.exp(-((bu - 0.5) / 0.36) ** 2) * np.exp(-((bv - 0.52) / 0.42) ** 2)
back = mix((0.32, 0.17, 0.07), (1.0, 0.86, 0.62), np.clip(glow, 0, 1) ** 0.8)
back = np.clip(back + fib[..., None], 0, 1)
BACK_TEX = image("liquor_back", back.astype(np.float32))

M = {
    "wood": pbr("LiquorWood", (1, 1, 1), tex=WOOD_TEX, nrm=WOOD_NRM, nrm_strength=0.5, rough=0.45),
    "back": pbr("LiquorBack", (1, 1, 1), tex=BACK_TEX, rough=0.9),
    "brass": pbr("LiquorBrass", (0.72, 0.57, 0.25), rough=0.35, metal=0.8),
    "led": pbr("LiquorLED", (1.0, 0.86, 0.62), rough=0.4, emit=(1.0, 0.86, 0.62), emit_strength=3.0),
    "rod": pbr("LiquorRod", (0.05, 0.05, 0.055), rough=0.35, metal=0.8),
    "glass": pbr("LiquorGlass", (1, 1, 1), rough=0.08),
    "label": pbr("LiquorLabel", (1, 1, 1), rough=0.7),
}
parts = []


def srgb(h):
    """a hex colour as the points' colours take it: as it's written (the exporter makes it linear)"""
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ---------------------------------------------------------------- the shelf: its boards, its strips, its rail, its rods
cab = bmesh.new()
CL = {"uv": cab.loops.layers.uv.new("UVMap")}
MAT = {"wood": 0, "led": 1, "rod": 2, "back": 3, "brass": 4}


def board(lo, hi, mat, grain_axis=0, tile=0.6):
    """a box from lo to hi (the game's frame), its picture laid on each face at world size, the grain along `grain_axis` (0 x, 1 y, 2 z)
    wherever that axis lies in the face"""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    vs = {(i, j, k): cab.verts.new(P(x1 if i else x0, y1 if j else y0, z1 if k else z0)) for i in (0, 1) for j in (0, 1) for k in (0, 1)}
    mid = Vector(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    for q, normal_axis in (((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), 2), (((1, 0, 0), (0, 0, 0), (0, 1, 0), (1, 1, 0)), 2), \
                          (((0, 1, 1), (1, 1, 1), (1, 1, 0), (0, 1, 0)), 1), (((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), 1), \
                          (((1, 0, 1), (1, 0, 0), (1, 1, 0), (1, 1, 1)), 0), (((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)), 0):
        f = cab.faces.new([vs[k] for k in q])
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
        f.material_index = mat
        inplane = [a for a in (0, 1, 2) if a != normal_axis]
        ua = grain_axis if grain_axis in inplane else inplane[0]
        va = inplane[1] if ua == inplane[0] else inplane[0]
        for lp in f.loops:
            c = lp.vert.co
            g = (c.x, c.z, -c.y)
            lp[CL["uv"]].uv = (g[ua] / tile, g[va] / tile)


def back_board(lo, hi, axis, sign):
    """a bay's back (item 504): a box from lo to hi, its face toward the customers (normal along `axis`, `sign`) the warm washi over all of it
    (u across the bay from the customers' left, v up), its other faces walnut"""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    board(lo, hi, MAT["wood"], 2 if axis == 0 else 0)
    # (the last board's six faces: the one toward the customers turned to the washi)
    cab.faces.ensure_lookup_table()
    for f in list(cab.faces)[-6:]:
        n_ = f.normal
        g = (n_.x, n_.z, -n_.y)
        if abs(g[axis] - sign) > 1e-3:
            continue
        f.material_index = MAT["back"]
        for lp in f.loops:
            c = lp.vert.co
            gc = (c.x, c.z, -c.y)
            if axis == 2:
                uu = (gc[0] - x0) / (x1 - x0)
            else:
                uu = (z1 - gc[2]) / (z1 - z0)
            lp[CL["uv"]].uv = (uu, (gc[1] - y0) / (y1 - y0))


def rod(x, z, y0, y1):
    segs = 6
    ring0 = [cab.verts.new(P(x + 0.005 * math.cos(2 * math.pi * k / segs), y0, z + 0.005 * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    ring1 = [cab.verts.new(P(x + 0.005 * math.cos(2 * math.pi * k / segs), y1, z + 0.005 * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    c0 = Vector(P(x, (y0 + y1) / 2, z))
    for k in range(segs):
        j = (k + 1) % segs
        f = cab.faces.new((ring0[k], ring0[j], ring1[j], ring1[k]))
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - c0) < 0:
            f.normal_flip()
        f.material_index = MAT["rod"]
        for lp in f.loops:
            lp[CL["uv"]].uv = (0.5, 0.5)


# (run A along +x from its corner end (out past the corner by half its depth) to its far end; run B along +z from run A's back to its far
# end; A's customers on its -z side, B's on its -x side (the L's outside), the kitchen in the L)
A0, A1 = -D / 2, L_A
B0, B1 = D / 2, L_B
# (A: its foot, its top, its two ends)
board((A0, 0.0, -D / 2), (A1, T, D / 2), MAT["wood"], 0)
board((A0, H - T, -D / 2), (A1, H, D / 2), MAT["wood"], 0)
for xe in (A0, A1 - T):
    board((xe, T, -D / 2), (xe + T, H - T, D / 2), MAT["wood"], 1)
# (B: its foot, its top (from A's back on), its far end)
board((-D / 2, 0.0, B0), (D / 2, T, B1), MAT["wood"], 2)
board((-D / 2, H - T, B0), (D / 2, H, B1), MAT["wood"], 2)
board((-D / 2, T, B1 - T), (D / 2, H - T, B1), MAT["wood"], 1)
# (the bays: A's from past the corner square to its far end, B's from A's back; a divider between each two)
bays_a = []
xa0, xa1 = D / 2, A1 - T
wa = (xa1 - xa0) / BAYS_A
for k in range(BAYS_A):
    bays_a.append((xa0 + wa * k + (T / 2 if k else 0.0), xa0 + wa * (k + 1) - (T / 2 if k < BAYS_A - 1 else 0.0)))
    if k:
        xd = xa0 + wa * k
        board((xd - T / 2, T, -D / 2 + 0.004), (xd + T / 2, H - T, D / 2 - 0.004), MAT["wood"], 1)
bays_b = []
zb0, zb1 = B0, B1 - T
wb = (zb1 - zb0) / BAYS_B
for k in range(BAYS_B):
    bays_b.append((zb0 + wb * k + (T / 2 if k else 0.0), zb0 + wb * (k + 1) - (T / 2 if k < BAYS_B - 1 else 0.0)))
    if k:
        zd = zb0 + wb * k
        board((-D / 2 + 0.004, T, zd - T / 2), (D / 2 - 0.004, H - T, zd + T / 2), MAT["wood"], 1)
# (item 504: each bay's back, warm washi toward the customers (the rail that ran along the kitchen's side at the bottles' shoulders gone with
# them: they keep the bottles now); a low lip along each foot's front; under the top's front edge a fascia hiding the strip, a fine brass
# line along its face)
for a, b in bays_a:
    back_board((a, T, D / 2 - 0.008), (b, H - T, D / 2 - 0.002), 2, -1)
for a, b in bays_b:
    back_board((D / 2 - 0.008, T, a), (D / 2 - 0.002, H - T, b), 0, -1)
board((A0 + T, T, -D / 2), (A1 - T, T + 0.014, -D / 2 + 0.006), MAT["wood"], 0)
board((-D / 2, T, B0 + 0.006), (-D / 2 + 0.006, T + 0.014, B1 - T), MAT["wood"], 2)
FASCIA = 0.02
board((A0, H - T - FASCIA, -D / 2), (A1, H - T, -D / 2 + 0.008), MAT["wood"], 0)
board((-D / 2, H - T - FASCIA, -D / 2 + 0.008), (-D / 2 + 0.008, H - T, B1), MAT["wood"], 2)
board((A0 + 0.006, H - T - FASCIA * 0.55, -D / 2 - 0.0012), (A1 - 0.006, H - T - FASCIA * 0.4, -D / 2), MAT["brass"], 0)
board((-D / 2 - 0.0012, H - T - FASCIA * 0.55, -D / 2 + 0.014), (-D / 2, H - T - FASCIA * 0.4, B1 - 0.006), MAT["brass"], 2)
# (the strips: under the top on the customers' side, behind the fascia, their light their own)
board((A0 + T + 0.01, H - T - 0.007, -D / 2 + 0.012), (A1 - T - 0.01, H - T, -D / 2 + 0.022), MAT["led"], 0)
board((-D / 2 + 0.012, H - T - 0.007, B0 + 0.01), (-D / 2 + 0.022, H - T, B1 - T - 0.01), MAT["led"], 2)
# (the rods up to the room's top: at the corner, over A's and B's middles and near their far ends)
for x, z in ((0.0, 0.0), (A1 * 0.5, 0.0), (A1 - 0.25, 0.0), (0.0, B1 * 0.5), (0.0, B1 - 0.25)):
    rod(x, z, H, H + ROD_UP)
me = bpy.data.meshes.new("LiquorCabinet")
cab.to_mesh(me)
cab.free()
cab_o = bpy.data.objects.new("LiquorCabinet", me)
bpy.context.collection.objects.link(cab_o)
for k in ("wood", "led", "rod", "back", "brass"):
    cab_o.data.materials.append(M[k])
parts.append(cab_o)

# ---------------------------------------------------------------- the bottles
# (each kind's profile up its height (radius, height, at the cabinet's size: S brings them to their true size), its glass's colours to
# choose from, its caps', its label's band (from, to up it), its sides (the whisky's square))
KINDS = {
    "yongobin": {"prof": [(0.04, 0.0), (0.042, 0.19), (0.017, 0.246), (0.0135, 0.256), (0.0135, 0.294), (0.0155, 0.303)], "glass": ["#21385c", "#cfd8d2", "#1d3a25", "#3a2410"], "cap": ["#c9a44c", "#e8e2d6", "#1a1a1a", "#8c1c16"],
                 "label": (0.055, 0.16), "segs": 8},
    "shochu": {"prof": [(0.046, 0.0), (0.048, 0.19), (0.02, 0.24), (0.017, 0.255), (0.017, 0.282), (0.019, 0.292)], "glass": ["#4a2a10", "#1a1a1a"], "cap": ["#1a1a1a", "#c9a44c"],
               "label": (0.05, 0.17), "segs": 8},
    "whisky": {"prof": [(0.052, 0.0), (0.054, 0.2), (0.02, 0.24), (0.016, 0.25), (0.016, 0.277), (0.021, 0.29)], "glass": ["#a8611c"], "cap": ["#1a1a1a", "#7a1410"],
               "label": (0.06, 0.15), "segs": 4},
    "umeshu": {"prof": [(0.045, 0.0), (0.048, 0.14), (0.044, 0.2), (0.016, 0.242), (0.016, 0.264), (0.018, 0.272)], "glass": ["#d9a94e"], "cap": ["#c9a44c"],
               "label": (0.05, 0.13), "segs": 8},
}
# (the labels' cells in order, as the game's LIQUOR_LABELS (item 504): sixteen sake, six shochu, five whisky, five umeshu)
CELL_KINDS = ["yongobin"] * 16 + ["shochu"] * 6 + ["whisky"] * 5 + ["umeshu"] * 5
CELLS_OF = {kd: [i for i, k_ in enumerate(CELL_KINDS) if k_ == kd] for kd in KINDS}
bot = bmesh.new()
BL = {"uv": bot.loops.layers.uv.new("UVMap"), "col": bot.loops.layers.color.new("Col")}
lab = bmesh.new()
LL = {"uv": lab.loops.layers.uv.new("UVMap")}
tris = {}


def bottle(kind, cx, cz, y0, turn, cell, face, glass_hex, cap_hex):
    """a bottle of `kind` standing at (cx, y0, cz), turned `turn` about its own upright; its label's band on picture cell `cell`, facing the
    way `face` (its angle in the x-z plane: -pi/2 toward -z, pi toward -x); its glass and its cap as given"""
    k = KINDS[kind]
    segs, prof = k["segs"], [(r * S, y * S) for r, y in k["prof"]]
    glass, cap = srgb(glass_hex), srgb(cap_hex)
    off = math.pi / 4 if segs == 4 else 0.0
    sq = 1.0 / math.cos(math.pi / 4) if segs == 4 else 1.0
    rings = []
    for i, (r, y) in enumerate(prof):
        rr = r * (sq if segs == 4 and y < 0.21 * S else 1.0)
        rings.append([bot.verts.new(P(cx + rr * math.cos(off + turn + 2 * math.pi * s / segs), y0 + y, cz + rr * math.sin(off + turn + 2 * math.pi * s / segs)))
                      for s in range(segs)])
    faces = []
    n_tri = 0
    for i in range(len(rings) - 1):
        for s in range(segs):
            t = (s + 1) % segs
            f = bot.faces.new((rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]))
            faces.append((f, i))
            n_tri += 2
    for rg, top in ((rings[0], False), (rings[-1], True)):
        for f in ladder_fill(bot, rg if top else rg[::-1]):
            faces.append((f, len(prof) - 1 if top else 0))
            n_tri += len(f.verts) - 2
    c_mid = Vector(P(cx, y0 + prof[-1][1] / 2, cz))
    for f, i in faces:
        f.normal_update()
        cen = f.calc_center_median()
        side = cen - c_mid
        side.z = 0.0
        want = (f.normal.dot(side) > 0) if abs(f.normal.z) < 0.7 else (f.normal.z > 0) == (cen.z > c_mid.z)
        if not want:
            f.normal_flip()
        f.smooth = True
        # (the cap: its neck and its top, and the top's ladder, in its own colour: the capsule over the neck)
        is_cap = i >= len(prof) - 3
        col = cap if is_cap else glass
        for lp in f.loops:
            lp[BL["col"]] = (*col, 1.0)
            lp[BL["uv"]].uv = (0.5, 0.5)
    # (its label: a band round the side it faces, a hair off it, a third of the way round, on its own cell)
    a0, a1 = k["label"][0] * S, k["label"][1] * S
    r_body = max(r for r, y in prof) * (sq if segs == 4 else 1.0) + 0.0015
    cu, cv = cell % COLS, cell // COLS
    arc = 4
    span = math.pi * 0.62 if segs != 4 else math.pi / 2 * 0.9
    nx, nz = math.cos(face), math.sin(face)
    tx, tz = math.sin(face), -math.cos(face)
    pts = []
    for s in range(arc + 1):
        if segs == 4:
            # (on the square's face toward `face`: flat, a hair off it (item 504: at 0.0365 it was inside the glass, the face 0.054 out, and
            # every whisky's label hidden; turned at random a corner of it showed now and then))
            w = (s / arc - 0.5) * 0.072 * S
            r_face = max(r for r, y in prof) + 0.0015
            pts.append((cx + nx * r_face + tx * w, cz + nz * r_face + tz * w))
        else:
            ang = face + span / 2 - span * s / arc
            pts.append((cx + r_body * math.cos(ang), cz + r_body * math.sin(ang)))
    lo = [lab.verts.new(P(x, y0 + a0, z)) for x, z in pts]
    hi = [lab.verts.new(P(x, y0 + a1, z)) for x, z in pts]
    for s in range(arc):
        f = lab.faces.new((lo[s], lo[s + 1], hi[s + 1], hi[s]))
        f.normal_update()
        mx = (pts[s][0] + pts[s + 1][0]) / 2 - cx
        mz = (pts[s][1] + pts[s + 1][1]) / 2 - cz
        if f.normal.dot(Vector(P(mx, 0, mz))) < 0:
            f.normal_flip()
        for lp in f.loops:
            # (u across the band from its left end seen from where it faces, v up it, into the cell)
            idx = lo.index(lp.vert) if lp.vert in lo else hi.index(lp.vert)
            up = 1.0 if lp.vert in hi else 0.0
            lp[LL["uv"]].uv = ((cu + idx / arc) / COLS, 1 - (cv + 1 - up) / ROWS)
        n_tri += 2
    return n_tri


# (item 504: one kind to a bay, as a bar shows its shelf (they were four to a bay, huddled in its middle, every kind mixed, their heights,
# glass and turns at random): the sake's six, the others' five, spread evenly over the bay with 7 cm left at its ends, all at one depth,
# square to the customers, their glass in a pattern mirrored about the bay's middle; the runs alike, the whisky in the middle of the long
# one; each bottle's label the next of its kind's cells, round again (a run's twin labels on the other run, far apart))
BLUE, FROST, GREEN, BROWN, BLACK, AMBER, UME = "#21385c", "#cfd8d2", "#1d3a25", "#3a2410", "#1a1a1a", "#a8611c", "#d9a94e"
GOLD, INK, RED = "#c9a44c", "#1a1a1a", "#8c1c16"
CAP_OF = {BLUE: GOLD, FROST: RED, GREEN: GOLD, BROWN: INK}
SAKE = [[BLUE, FROST, GREEN, GREEN, FROST, BLUE], [BROWN, FROST, BLUE, BLUE, FROST, BROWN], [GREEN, FROST, BROWN, BROWN, FROST, GREEN],
        [BLUE, GREEN, FROST, FROST, GREEN, BLUE]]
BAYS = {"A": ["yongobin", "shochu", "whisky", "umeshu", "yongobin"], "B": ["yongobin", "shochu", "whisky", "yongobin"]}
next_cell = {kd: 0 for kd in KINDS}
sake_bay = 0
n = 0
for run, spans in (("A", bays_a), ("B", bays_b)):
    for (a, b), kind in zip(spans, BAYS[run]):
        if kind == "yongobin":
            looks = [(g_, CAP_OF[g_]) for g_ in SAKE[sake_bay % len(SAKE)]]
            sake_bay += 1
        elif kind == "shochu":
            looks = [(BROWN if i % 2 == 0 else BLACK, INK if i % 2 == 0 else GOLD) for i in range(5)]
        elif kind == "whisky":
            looks = [(AMBER, INK if i % 2 == 0 else RED) for i in range(5)]
        else:
            looks = [(UME, GOLD)] * 5
        m = 0.07
        for i, (g_, c_) in enumerate(looks):
            along = a + m + (b - a - 2 * m) * i / (len(looks) - 1)
            cells = CELLS_OF[kind]
            cell = cells[next_cell[kind] % len(cells)]
            next_cell[kind] += 1
            if run == "A":
                tris[kind] = bottle(kind, along, -0.008, T + 0.0015, 0.0, cell, -math.pi / 2, g_, c_)
            else:
                tris[kind] = bottle(kind, -0.008, along, T + 0.0015, 0.0, cell, math.pi, g_, c_)
            n += 1
print("LIQUOR_BOTTLES", n, "BOTTLE_TRIS", tris)
me = bpy.data.meshes.new("LiquorBottles")
bot.to_mesh(me)
bot.free()
bot_o = bpy.data.objects.new("LiquorBottles", me)
bpy.context.collection.objects.link(bot_o)
bot_o.data.materials.append(M["glass"])
parts.append(bot_o)
me = bpy.data.meshes.new("LiquorLabels")
lab.to_mesh(me)
lab.free()
lab_o = bpy.data.objects.new("LiquorLabels", me)
bpy.context.collection.objects.link(lab_o)
lab_o.data.materials.append(M["label"])
parts.append(lab_o)

root = bpy.data.objects.new("LiquorShelf", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("LIQUOR_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "liquorshelf.glb"), os.path.join(PROJECT, "blender", "liquorshelf.blend"), None)
print("LIQUOR_DONE")
