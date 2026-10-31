"""The dining room's walls, painted procedurally, tileable both ways (no seam where one tile meets the next), saved as JPEG for the game:

- public/textures/plaster_wall.jpg: the plaster above the wainscot, a tile 1.2 x 1.2: an earthen wall (聚楽壁) of warm cream clay, mottled at
  several scales, its fine sand in it (grains a shade darker and lighter), the trowel's long shallow sweeps faint across it, chopped straw
  showing here and there; every mark wrapped round the tile's edges.
- public/textures/wainscot_boards.jpg: the wainscot, a tile 1.44 across and as high as the wainscot (0.85): twelve upright boards of warm
  brown wood (a wide tile, so the boards' pattern doesn't come round again every few steps along the wall), each its own tone; most flat-sawn
  (板目: cathedral arches climbing them, pointed or broad, their lines wandering as real grain does), some quarter-sawn (柾目: fine straight
  lines close together); the late wood darker and sharp on one side; a few knots (節) with the grain swirling round them; the open pores in
  short streaks; a little darker toward the floor where feet have scuffed it; a V-groove between each, shadowed on one side and catching
  the light on the other.

Run:
    blender -b --factory-startup --python blender/walltex.py -- <project path>
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJECT, "public", "textures")
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def save(name, rgb):
    """write an (h, w, 3) display-space array as a JPEG (rows bottom-up, as Blender's images are)"""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.colorspace_settings.name = "sRGB"
    a = np.ones((h, w, 1), np.float32)
    img.pixels.foreach_set(np.concatenate([np.clip(rgb, 0, 1), a], -1).astype(np.float32).ravel())
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    sc.view_settings.view_transform = "Standard"
    img.save_render(os.path.join(OUT, name + ".jpg"), scene=sc)
    print("SAVED", name)


def rnoise(w, h, cx, cy, r):
    """tileable value noise over a w x h picture, cx x cy cells"""
    g = r.random((cy, cx)).astype(np.float32)
    ux, uy = np.arange(w) * cx / w, np.arange(h) * cy / h
    ix0, iy0 = ux.astype(int), uy.astype(int)
    fx, fy = ux - ix0, uy - iy0
    ix1, iy1 = (ix0 + 1) % cx, (iy0 + 1) % cy
    fx = (fx * fx * (3 - 2 * fx))[None, :]
    fy = (fy * fy * (3 - 2 * fy))[:, None]
    a, b = g[np.ix_(iy0, ix0)], g[np.ix_(iy0, ix1)]
    c, d = g[np.ix_(iy1, ix0)], g[np.ix_(iy1, ix1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def rfbm(w, h, cx, cy, octaves, r):
    out, amp, tot = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octaves):
        out += amp * rnoise(w, h, cx * 2 ** o, cy * 2 ** o, r)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


# ---- the plaster
N = 1024
seed(81)
u, v = grid01(N)
base = np.array((0.93, 0.88, 0.78), np.float32)
col = np.broadcast_to(base, (N, N, 3)).copy()
# (mottled at several scales: the clay's own unevenness; fbm and vnoise tile)
m1, m2, m3 = fbm(N, 3, 3, 5), fbm(N, 9, 9, 4), fbm(N, 28, 28, 3)
col = mix(col, np.array((0.84, 0.78, 0.66), np.float32), smooth(0.45, 0.85, m1) * 0.45)
col = mix(col, np.array((0.96, 0.93, 0.85), np.float32), smooth(0.55, 0.9, m2) * 0.35)
col = col * (0.97 + 0.05 * m3)[..., None]
# (the trowel's sweeps: long shallow arcs, lighter along one edge and darker along the other, wrapped)
rng = np.random.default_rng(5)
for _ in range(26):
    cx, cy, r = rng.random(), rng.random(), 0.15 + rng.random() * 0.3
    a0, span = rng.random() * 2 * math.pi, 0.5 + rng.random() * 0.7
    dx = (u - cx + 0.5) % 1.0 - 0.5
    dy = (v - cy + 0.5) % 1.0 - 0.5
    d = np.sqrt(dx * dx + dy * dy)
    ang = (np.arctan2(dy, dx) - a0) % (2 * math.pi)
    on = (ang < span).astype(np.float32) * np.sin(np.clip(ang / span, 0, 1) * math.pi)
    band = np.exp(-((d - r) / 0.012) ** 2) * on
    edge = np.exp(-((d - r - 0.01) / 0.006) ** 2) * on
    col = mix(col, col * np.float32(1.04), band * 0.5)
    col = mix(col, col * np.float32(0.95), edge * 0.5)
# (sand: fine grains, darker and lighter)
g1 = rng.random((N, N)).astype(np.float32)
col = mix(col, col * np.float32(0.82), (g1 > 0.965).astype(np.float32) * 0.6)
col = mix(col, np.minimum(1, col * np.float32(1.08)), (g1 < 0.03).astype(np.float32) * 0.6)
# (chopped straw: short golden fibres at all angles, each drawn wrapped round the tile)
img = col
for _ in range(170):
    x0, y0, a, ln = rng.random(), rng.random(), rng.random() * math.pi, (5 + rng.random() * 12) / N
    steps = 24
    for k in range(steps):
        t = k / (steps - 1)
        px = int(((x0 + math.cos(a) * ln * t) % 1.0) * N)
        py = int(((y0 + math.sin(a) * ln * t) % 1.0) * N)
        img[py % N, px % N] = img[py % N, px % N] * 0.45 + np.array((0.7, 0.54, 0.28), np.float32) * 0.55
save("plaster_wall", img)

# ---- the wainscot boards
TW, TH = 1.44, 0.85                     # (the tile, metres)
B = 12                                  # (boards in it, 12 cm each)
NW, NH = 1536, 907                      # (about 1070 pixels a metre)
rng = np.random.default_rng(9)
u = np.tile((np.arange(NW, dtype=np.float32) + 0.5) / NW, (NH, 1))
v = np.tile(((np.arange(NH, dtype=np.float32) + 0.5) / NH)[:, None], (1, NW))
bk = np.floor(u * B).astype(int)
bu = u * B - bk                         # (0..1 across each board)
# (each board its own: a tone, flat-sawn or quarter-sawn, its figure's middle, breadth, pitch and how pointed its arches are)
tone = np.array([(0.45, 0.29, 0.18), (0.41, 0.26, 0.16), (0.48, 0.32, 0.2), (0.43, 0.27, 0.17), (0.46, 0.3, 0.19), (0.4, 0.25, 0.15)], np.float32)
board_tone = tone[rng.integers(0, len(tone), B)] * (0.9 + 0.2 * rng.random((B, 1))).astype(np.float32)
board_tone[:, 0] *= (0.97 + 0.06 * rng.random(B)).astype(np.float32)        # (some a touch redder)
straight = rng.random(B) < 0.3
straight[0] = False
centre0 = (0.35 + 0.3 * rng.random(B)).astype(np.float32)
breadth = (2.0 + 3.0 * rng.random(B)).astype(np.float32)
pitch = (1.6 + 2.2 * rng.random(B)).astype(np.float32)
point = (1.3 + 0.6 * rng.random(B)).astype(np.float32)
phase = rng.random(B).astype(np.float32)
lines = (9 + rng.integers(0, 8, B)).astype(np.float32)
basecol = board_tone[bk]
# (the arches pointing up the wall, as such boards are put up; the grain's wander: a slow sway of each board's middle up it, and finer noise bending every line)
warp = rfbm(NW, NH, 24, 3, 4, rng) - 0.5
fine = rfbm(NW, NH, 96, 10, 3, rng) - 0.5
sway = np.sin(2 * math.pi * (v * 1.3 + phase[bk])) * 0.07 + np.sin(2 * math.pi * (v * 3.1 + phase[bk] * 2.3)) * 0.025
c = centre0[bk] + sway + warp * 0.12
flat_ring = np.abs(bu - c) ** point[bk] * breadth[bk] + v * pitch[bk] + phase[bk] * 3 + warp * 0.35 + fine * 0.06
straight_ring = bu * lines[bk] / 4 + warp * 0.5 + fine * 0.08 + np.sin(2 * math.pi * v * 2 + phase[bk] * 6) * 0.05
ring = np.where(straight[bk], straight_ring, flat_ring)
density = np.where(straight[bk], 4.0, 3.2).astype(np.float32)
# (knots: a few, each a dark core with a lighter rim, the rings round it pulled into a swirl)
for _ in range(4):
    b = int(rng.integers(0, B))
    if straight[b]:
        continue
    ku, kv, kr = 0.3 + 0.4 * rng.random(), rng.random(), 0.008 + 0.008 * rng.random()
    dxm = (bu - ku) * (TW / B)
    dvm = ((v - kv + 0.5) % 1.0 - 0.5) * TH
    dm = np.sqrt(dxm * dxm + (dvm * 0.8) ** 2)
    on = (bk == b)
    ring = ring + np.where(on, 1.4 * np.exp(-(dm / (kr * 3.2)) ** 2), 0)
    core = np.where(on, smooth(kr, kr * 0.55, dm), 0)
    rim = np.where(on, smooth(kr * 1.5, kr, dm) * (1 - core), 0)
    basecol = mix(basecol, basecol * np.float32(1.08), rim * 0.5)
    basecol = mix(basecol, np.array((0.16, 0.09, 0.05), np.float32), core * 0.9)
f = (ring * density) % 1.0
# (the late wood: rising slowly through the early wood, ending sharp)
late = smooth(0.55, 0.9, f) * smooth(1.0, 0.94, f)
col = mix(basecol, basecol * np.array((0.6, 0.55, 0.52), np.float32), late * 0.7)
# (the pores, in short streaks up the board)
pr = rnoise(NW, NH, 640, 56, rng)
col = mix(col, col * np.float32(0.7), smooth(0.8, 0.95, pr) * 0.6)
# (patina: the boards' faces uneven in tone, darker toward the floor where feet have scuffed them)
pat = rfbm(NW, NH, 6, 2, 4, rng)
col = col * (0.93 + 0.1 * pat)[..., None]
col = col * (0.86 + 0.14 * smooth(0.0, 0.3, v))[..., None]
# (each board a little lighter down its middle: its face rounded by years of hands)
col = col * (0.93 + 0.1 * np.sin(math.pi * bu) ** 0.5)[..., None]
# (the V-groove between boards: dark at the joint, a light edge on its left side as the light falls)
d = np.minimum(bu, 1 - bu)
col = mix(col, np.array((0.11, 0.065, 0.04), np.float32), smooth(0.018, 0.0, d) * 0.92)
col = mix(col, col * np.float32(1.22), (smooth(0.04, 0.018, bu) * (bu < 0.05)).astype(np.float32) * 0.5)
save("wainscot_boards", np.clip(col, 0, 1))
print("WALLTEX_DONE")
