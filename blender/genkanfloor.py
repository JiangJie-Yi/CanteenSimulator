"""The genkan's floor and its step (genkanfloor.glb; item 185, the owner's, 2026-11-15: "the genkan's doorway, its stone step and floor, too
plain": one flat picture of stones on a plane, a regular grid of grey slabs in thick pale joints, and the step up a thin dark board).

- node "GenkanStones": the floor, natural stones laid crazy-paving (乱張り): each its own outline (a Voronoi cell of the genkan's rect), its
  own tint (in its points' colour: pale granite, warm grey, cool grey, a dark slate now and then), its top domed (the owner's, 2026-11-17:
  "a little bulging out, more shape and style"): a few rings of points to each, the edge rounded off like a worn stone's, the top swelling
  up to a centimetre toward its middle and a hair tilted, shaded smooth; laid in the joints' pebble-wash. One mesh.
- node "GenkanMortar": the pebble-wash (洗い出し) between them: small black, grey and white pebbles packed in dark cement, seen in the joints.
- node "GenkanRug": ONE large rug (the owner's, 2026-11-17, in place of the little lettered doormat and the shoe-off stone, both gone):
  a 0.70 x 0.72 slab 1.8 cm thick laid on the stones just inside, a way in from the door, clear of the shoe cupboard's doors: a woven
  igusa (rush) field, its strands run the other way where a quiet 菱 (diamond) pattern is dyed into it, in a border of indigo cotton with two
  cream pin-stripes and a row of stitches. Four rim quads and a top (26 triangles); everything else is in its picture and normal map.
- node "GenkanSill": the door's threshold (敷居石): a long slab of dark granite across the doorway, a little proud of the floor.
- node "GenkanKamachi": the step's edge (上框): a polished keyaki beam along both of the genkan's open sides, its top a hair proud of the
  room's boards, its front the step's face down to the stones, its top front edge rounded; mitred at the corner.

The game's frame is RoomFloor's (GuestBar3D): x = minus the first counter's lay, z = its along from its middle, y up from the room's floor;
in the bar's units. The genkan's rect there (measured in the game, item 185): x 0.42..1.6569, z 2.4..3.7155, its stone 0.1 down.
The shoe cupboard stands against the wall side from x 1.297; the way in runs at x 1.16.
(The shoe-off stone, GenkanKutsunugi, that stood at x 0.80..1.27, z 2.445..2.72 is gone: the owner crossed it out, 2026-11-17.)

Run:
    blender -b --factory-startup --python blender/genkanfloor.py -- <project path> [preview.png]
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
seed(185)

# ------------------------------------------------------------------------------------------------ the genkan's rect and the parts' sizes
X0, X1, Z0, Z1, D = 0.42, 1.6569, 2.4, 3.7155, 0.1
FLOOR = -D                 # the genkan's stone, where people stand
MORTAR_Y = -D - 0.010      # the pebble-wash in the joints, a centimetre under the stones' tops
JOINT = 0.009              # half a joint's width
CHAMFER = 0.0045           # each stone's top edge, its chamfer in and down
# (the step's beam: its profile across the edge (u: from under the room's boards, + into the genkan), its top and how far down it goes)
K_BACK, K_FRONT, K_TOP, K_ROUND = -0.035, 0.024, 0.006, 0.012
K_FOOT = MORTAR_Y
# (each stone's top: its middle's height over the base (the dome), how far its edge is rounded off, and the rings of points it takes: how far
# in from its outline each lies (the last one is where the flat-ish top starts, closed with a ladder on export))
DOME, ROUND, RINGS = 0.006, 0.011, (0.0, 0.003, 0.006, 0.011, 0.035)
# (the rug: clear of the shoe cupboard's doors (x 1.297) and the step's stones where shoes are put (z up to about 2.8), on the way in (x 1.16),
# its far end 7 cm short of the threshold; its top a hair over the stones' crowns (the highest: FLOOR + 0.004 + 0.006 + a tilt's 1 mm))
RUG = {"x": (0.55, 1.25), "z": (2.85, 3.57), "top": FLOOR + 0.014, "foot": FLOOR - 0.004, "rim": 0.0055, "round": 0.012}
# (the threshold across the doorway, against the door's end)
SILL = {"x": (X0 + K_FRONT + 0.004, X1), "z": (Z1 - 0.075, Z1), "top": FLOOR + 0.004}


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# ------------------------------------------------------------------------------------------------ pictures
N = 1024
u, v = grid01(N)
# (granite: a pale grey-beige ground, cloudy, packed with grains: black mica, white quartz, a pink-brown feldspar; a few darker veins)
ground = mix((0.60, 0.58, 0.55), (0.47, 0.455, 0.43), fbm(N, 5, 5, 5))
gran = ground.copy()
for cells, thr, col, k in ((420, 0.80, (0.08, 0.08, 0.09), 0.9), (300, 0.84, (0.80, 0.79, 0.76), 0.7), (240, 0.86, (0.52, 0.40, 0.35), 0.6),
                           (520, 0.78, (0.24, 0.24, 0.25), 0.55)):
    chip = smooth(thr, thr + 0.04, vnoise(N, cells, cells))
    gran = mix(gran, col, chip * k)
vein = np.abs(fbm(N, 3, 7, 5) - 0.5)
gran = mix(gran, (0.36, 0.355, 0.35), smooth(0.03, 0.0, vein) * 0.35)
# (worn: a little lighter where it's walked on, a little dirtier in its low places)
gran = gran * (0.93 + 0.1 * fbm(N, 8, 8, 4))[..., None]
gh = fbm(N, 64, 64, 3) * 0.6 + fbm(N, 6, 6, 4) * 0.4
gh = gh - smooth(0.8, 0.86, vnoise(N, 420, 420)) * 0.25        # the mica's pits
STONE_TEX = image("genkan_granite", np.clip(gran, 0, 1).astype(np.float32))
STONE_NRM = image("genkan_granite_nrm", to_normal(gh, 3.0).astype(np.float32), data=True)

# (pebble-wash: dark cement, packed with small round pebbles, black (那智黒), grey, a few white)
M2 = 512
yy, xx = np.mgrid[0:M2, 0:M2].astype(np.float32)
peb = np.zeros((M2, M2, 3), np.float32) + np.array([0.20, 0.19, 0.18], np.float32)
peb = peb * (0.85 + 0.3 * fbm(M2, 8, 8, 4))[..., None]
ph = np.zeros((M2, M2), np.float32)
for _ in range(1700):
    r = rng.uniform(3.0, 7.5)
    cx, cy = rng.uniform(0, M2, 2)
    tone = rng.random()
    col = np.array((0.06, 0.06, 0.065) if tone < 0.55 else (0.42, 0.41, 0.40) if tone < 0.88 else (0.86, 0.85, 0.82), np.float32)
    col = col * rng.uniform(0.85, 1.15)
    for ox in (-M2, 0, M2):
        for oy in (-M2, 0, M2):
            px, py = cx + ox, cy + oy
            x0, x1 = int(max(0, px - r - 2)), int(min(M2, px + r + 2))
            y0, y1 = int(max(0, py - r - 2)), int(min(M2, py + r + 2))
            if x0 >= x1 or y0 >= y1:
                continue
            d = np.sqrt((xx[y0:y1, x0:x1] - px) ** 2 + (yy[y0:y1, x0:x1] - py) ** 2)
            m = np.clip((r - d) / 1.2, 0, 1)
            dome = np.clip(1 - (d / r) ** 2, 0, 1)
            shade = (0.75 + 0.35 * dome)[..., None]
            peb[y0:y1, x0:x1] = peb[y0:y1, x0:x1] * (1 - m[..., None]) + (col * shade) * m[..., None]
            ph[y0:y1, x0:x1] = np.maximum(ph[y0:y1, x0:x1], dome * m)
PEB_TEX = image("genkan_pebbles", np.clip(peb, 0, 1).astype(np.float32))
PEB_NRM = image("genkan_pebbles_nrm", to_normal(ph, 2.5).astype(np.float32), data=True)

# (keyaki, polished: a deep red-brown, its grain running the beam's length, a band of lighter figure here and there, a waxed sheen)
M3 = 512
u3, v3 = grid01(M3)
grain = np.sin((v3 * 46 + (fbm(M3, 3, 8, 4) - 0.5) * 2.2 + (fbm(M3, 9, 2, 3) - 0.5) * 0.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.30, 0.14, 0.07), (0.17, 0.075, 0.035), smooth(0.45, 1.0, grain) * 0.8)
wood = mix(wood, (0.38, 0.19, 0.09), smooth(0.7, 0.95, fbm(M3, 2, 6, 4)) * 0.35)
wood = wood * (0.92 + 0.1 * fbm(M3, 4, 24, 3))[..., None]
WOOD_TEX = image("genkan_keyaki", np.clip(wood, 0, 1).astype(np.float32))
WOOD_NRM = image("genkan_keyaki_nrm", to_normal(grain * 0.6 + fbm(M3, 6, 30, 3) * 0.4, 1.2).astype(np.float32), data=True)

# (the rug, 1024 square over 0.70 x 0.72 m, about 1,450 px a metre: a border of indigo cotton, 5 cm, with two cream pin-stripes and a row of
# stitches; inside it an igusa field, its strands (2 mm) running up the rug, each its own shade, in lengths a shade lighter or darker, bound
# by pale weft threads; a 菱 pattern dyed into it: a moss-green diamond band, a straw-coloured diamond inside it with a dyed middle, and a
# quarter-diamond in each corner, the strands in those turned across)
RN = 1024
RW, RL = RUG["x"][1] - RUG["x"][0], RUG["z"][1] - RUG["z"][0]
ru, rv = grid01(RN)
RX, RY = ru * RW, rv * RL
edge = np.minimum(np.minimum(RX, RW - RX), np.minimum(RY, RL - RY))
B_W = 0.05
col_i = (ru * RN / 3.0).astype(int)
row_i = (rv * RN / 3.0).astype(int)
rrng = np.random.default_rng(2117)      # (its own: the stones' layout, from the module's rng, stays as it was)
g_col, g_row = rrng.random(RN // 3 + 2).astype(np.float32), rrng.random(RN // 3 + 2).astype(np.float32)
seg_v, seg_h = vnoise(RN, 5, 30), vnoise(RN, 30, 5)
tone_v = np.clip(0.35 + 0.55 * g_col[col_i] + 0.4 * (seg_v - 0.5), 0, 1)
tone_h = np.clip(0.35 + 0.55 * g_row[row_i] + 0.4 * (seg_h - 0.5), 0, 1)
prof_v = 0.5 + 0.5 * np.cos(2 * math.pi * ru * RN / 3.0)
prof_h = 0.5 + 0.5 * np.cos(2 * math.pi * rv * RN / 3.0)
cx0, cy0 = RW / 2, RL / 2


def dia(cx, cy, a):
    return np.abs(RX - cx) / a + np.abs(RY - cy) / a


d_big = dia(cx0, cy0, 0.27)
d_in = dia(cx0, cy0, 0.145)
d_cor = np.minimum(np.minimum(dia(B_W, B_W, 0.10), dia(RW - B_W, B_W, 0.10)), np.minimum(dia(B_W, RL - B_W, 0.10), dia(RW - B_W, RL - B_W, 0.10)))
band = smooth(0.0, 0.03, d_big - 0.88) * smooth(0.0, 0.03, 1.0 - d_big)             # the moss diamond band
straw = smooth(0.0, 0.03, 1.0 - d_in) * (1 - smooth(0.0, 0.03, 0.30 - d_in))      # the straw diamond, its middle left out
core = smooth(0.0, 0.03, 0.30 - d_in)                                              # ...which is dyed
corner = smooth(0.0, 0.03, 1.0 - d_cor)
dyed = np.clip(band + core + corner, 0, 1)
pale = np.clip(straw, 0, 1) * (1 - dyed)
turned = np.clip(dyed + pale, 0, 1)                                               # strands run across where the pattern is
tone = tone_v * (1 - turned) + tone_h * turned
prof = prof_v * (1 - turned) + prof_h * turned
igusa = mix((0.44, 0.47, 0.27), (0.64, 0.64, 0.40), tone)
igusa = mix(igusa, igusa * np.array([0.66, 0.72, 0.74], np.float32), dyed)
igusa = mix(igusa, (0.78, 0.73, 0.54) * (0.92 + 0.12 * tone)[..., None], pale)
igusa = igusa * (0.86 + 0.14 * prof)[..., None]
# (the weft: pale cotton binding threads across the strands (along them in the turned parts), a thin line every 14 px, a shade lighter)
fr_v = (rv * RN / 14.0) % 1.0
fr_h = (ru * RN / 14.0) % 1.0
weft = np.maximum(smooth(0.80, 1.0, fr_v) * (1 - turned), smooth(0.80, 1.0, fr_h) * turned)
igusa = mix(igusa, (0.76, 0.72, 0.56), weft * 0.16)
igusa = igusa * (0.93 + 0.12 * fbm(RN, 3, 3, 4))[..., None]
# (the border: indigo cotton, a fine weave, two cream pin-stripes and a row of stitches, a thin dark seam where it meets the field)
weave = np.cos(2 * math.pi * ru * RN / 3.0) * np.cos(2 * math.pi * rv * RN / 3.0)
cloth = mix((0.085, 0.115, 0.225), (0.125, 0.165, 0.30), fbm(RN, 6, 6, 3)) * (0.94 + 0.06 * weave)[..., None]
stripe = smooth(0.0, 0.0006, edge - 0.0105) * smooth(0.0, 0.0006, 0.0128 - edge) + smooth(0.0, 0.0006, edge - 0.0165) * smooth(0.0, 0.0006, 0.0182 - edge)
cloth = mix(cloth, (0.80, 0.77, 0.66), stripe * 0.85)
along = np.where(np.minimum(RX, RW - RX) < np.minimum(RY, RL - RY), RY, RX)
stitch = smooth(0.0, 0.0005, edge - 0.0365) * smooth(0.0, 0.0005, 0.0385 - edge) * smooth(0.0, 0.0008, 0.0068 - ((along / 0.012) % 1.0) * 0.012)
cloth = mix(cloth, (0.74, 0.72, 0.62), stitch * 0.8)
in_border = smooth(0.0, 0.0012, B_W - edge)
seam = smooth(0.0, 0.0008, edge - (B_W - 0.0025)) * smooth(0.0, 0.0008, B_W + 0.0005 - edge)
rug_rgb = mix(igusa, cloth, in_border)
rug_rgb = mix(rug_rgb, rug_rgb * 0.45, seam)
rug_rgb = rug_rgb * (0.95 + 0.07 * fbm(RN, 8, 8, 3))[..., None]
RUG_TEX = image("genkan_rug", np.clip(rug_rgb, 0, 1).astype(np.float32))
# (its relief: strands as rounded ridges with the weft pressed across, the border a hair raised, finely woven)
rh = 0.5 * prof + 0.18 * weft + 0.1 * g_col[col_i] * (1 - turned)
rh = rh * (1 - in_border) + (0.62 + 0.18 * weave) * in_border
rh = rh - 0.3 * stitch
RUG_NRM = image("genkan_rug_nrm", to_normal(rh, 2.2).astype(np.float32), data=True)

M = {
    "rug": pbr("GenkanRug", (1, 1, 1), tex=RUG_TEX, nrm=RUG_NRM, nrm_strength=0.8, rough=0.95),
    "stone": pbr("GenkanStone", (1, 1, 1), tex=STONE_TEX, nrm=STONE_NRM, nrm_strength=0.6, rough=0.7),
    "pebble": pbr("GenkanPebble", (1, 1, 1), tex=PEB_TEX, nrm=PEB_NRM, nrm_strength=0.8, rough=0.85),
    "wood": pbr("GenkanKeyaki", (1, 1, 1), tex=WOOD_TEX, nrm=WOOD_NRM, nrm_strength=0.4, rough=0.3),
}

parts = []


def new_obj(name, bm, mat, smooth_shade=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for poly in o.data.polygons:
        poly.use_smooth = smooth_shade
    parts.append(o)
    return o


# ------------------------------------------------------------------------------------------------ geometry helpers (convex polygons in x, z)
def clip(poly, a, b, c):
    """the part of a convex polygon (x, z points) where a*x + b*z <= c"""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def inset(poly, d):
    """a convex polygon (counter-clockwise in x, z) with each edge moved in by d"""
    out = []
    n = len(poly)
    lines = []
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        ex, ez = q[0] - p[0], q[1] - p[1]
        L = math.hypot(ex, ez) or 1e-9
        nx, nz = -ez / L, ex / L          # inward for counter-clockwise
        lines.append((p[0] + nx * d, p[1] + nz * d, ex, ez))
    for i in range(n):
        x1, z1, dx1, dz1 = lines[i - 1]
        x2, z2, dx2, dz2 = lines[i]
        den = dx1 * dz2 - dz1 * dx2
        if abs(den) < 1e-12:
            out.append((x2, z2))
            continue
        t = ((x2 - x1) * dz2 - (z2 - z1) * dx2) / den
        out.append((x1 + dx1 * t, z1 + dz1 * t))
    return out


def ccw(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if a > 0 else poly[::-1]


def slab(bm, outline, top, foot, chamfer, uvl, col, tile, uv_off, dome=0.0, tilt=(0.0, 0.0)):
    """a stone: its outline (convex, x, z), its top at `top` (a little domed toward its middle, a little tilted), a chamfer of `chamfer` in and
    down round its top, its sides straight down to `foot`; its picture laid from above (`tile`, moved by `uv_off`), its tint `col`"""
    outline = ccw(outline)
    inner = inset(outline, chamfer)
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    rad = max(math.hypot(p[0] - cx, p[1] - cz) for p in outline) or 1

    def h(x, z, base):
        d = math.hypot(x - cx, z - cz) / rad
        return base + dome * (1 - d * d) + tilt[0] * (x - cx) + tilt[1] * (z - cz)

    top_v = [bm.verts.new(P(x, h(x, z, top), z)) for x, z in inner]
    rim_v = [bm.verts.new(P(x, h(x, z, top) - chamfer * 0.7, z)) for x, z in outline]
    foot_v = [bm.verts.new(P(x, foot, z)) for x, z in outline]
    faces = []
    faces.append(bm.faces.new(top_v))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((rim_v[i], rim_v[j], top_v[j], top_v[i])))
        faces.append(bm.faces.new((foot_v[i], foot_v[j], rim_v[j], rim_v[i])))
    for f in faces:
        f.normal_update()
        if f.normal.z < -0.5:
            f.normal_flip()
        for loop in f.loops:
            co = loop.vert.co
            # (game x = blender x, game z = -blender y, game y = blender z)
            gx, gz, gy = co.x, -co.y, co.z
            if abs(f.normal.z) > 0.6:
                loop[uvl["uv"]].uv = (gx / tile + uv_off[0], gz / tile + uv_off[1])
            else:
                # (the sides: along the edge and down)
                loop[uvl["uv"]].uv = ((gx + gz) / tile + uv_off[0], gy / tile * 3 + uv_off[1])
            loop[uvl["col"]] = (*col, 1.0)
    return faces


def drop_at(e):
    """how far down a stone's top lies at `e` in from its edge: a quarter circle of radius ROUND, steep at the edge, level from ROUND in"""
    if e >= ROUND:
        return 0.0
    t = 1.0 - e / ROUND
    return ROUND * (1.0 - math.sqrt(max(0.0, 1.0 - t * t)))


def pillow(bm, outline, top, foot, uvl, col, tile, uv_off, dome, tilt):
    """a stone worn round: its outline (convex, x, z) down to `foot` straight, then its top in a few rings in from the edge (RINGS), each
    ring's points at the height of the stone's dome there less the edge's rounding (drop_at), the last ring closed flat (a ladder on export);
    shaded smooth; its picture laid from above (`tile`, moved by `uv_off`), its tint `col`"""
    outline = ccw(outline)
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    rad = max(math.hypot(p[0] - cx, p[1] - cz) for p in outline) or 1
    n = len(outline)
    rings = [outline]
    for e in RINGS[1:]:
        r = inset(outline, e)
        # (a ring that has run past a short edge: no longer the same way round as the outline: leave it and the ones in from it)
        ok = len(r) == n and all((r[(i + 1) % n][0] - r[i][0]) * (outline[(i + 1) % n][0] - outline[i][0])
                                 + (r[(i + 1) % n][1] - r[i][1]) * (outline[(i + 1) % n][1] - outline[i][1]) > 1e-9 for i in range(n))
        if not ok:
            break
        rings.append(r)
    ring_v = []
    for k, r in enumerate(rings):
        e = RINGS[k]
        ring_v.append([bm.verts.new(P(x, top + dome * (1 - (math.hypot(x - cx, z - cz) / rad) ** 2) + tilt[0] * (x - cx) + tilt[1] * (z - cz)
                                      - drop_at(e), z)) for x, z in r])
    foot_v = [bm.verts.new(P(x, foot, z)) for x, z in outline]
    sides, tops = [], []
    for i in range(n):
        j = (i + 1) % n
        sides.append(bm.faces.new((foot_v[i], foot_v[j], ring_v[0][j], ring_v[0][i])))
        for k in range(len(rings) - 1):
            tops.append(bm.faces.new((ring_v[k][i], ring_v[k][j], ring_v[k + 1][j], ring_v[k + 1][i])))
    cap = bm.faces.new(ring_v[-1])
    tops.append(cap)
    cen = Vector(P(cx, 0, cz))
    for f in sides + tops:
        f.normal_update()
        if f in sides:
            c = f.calc_center_median() - cen
            want = f.normal.x * c.x + f.normal.y * c.y > 0
        else:
            want = f.normal.z > 0
        if not want:
            f.normal_flip()
        for loop in f.loops:
            co = loop.vert.co
            gx, gz, gy = co.x, -co.y, co.z
            if f in tops:
                loop[uvl["uv"]].uv = (gx / tile + uv_off[0], gz / tile + uv_off[1])
            else:
                loop[uvl["uv"]].uv = ((gx + gz) / tile + uv_off[0], gy / tile * 3 + uv_off[1])
            loop[uvl["col"]] = (*col, 1.0)
    return sides + tops


def layers(bm):
    return {"uv": bm.loops.layers.uv.verify(), "col": bm.loops.layers.color.new("Col")}


# ------------------------------------------------------------------------------------------------ the stones: crazy paving
SX0, SX1 = X0 + K_FRONT + 0.004, X1
SZ0, SZ1 = Z0 + K_FRONT + 0.004, SILL["z"][0] - 0.004
# (seeds: a jittered spread, none too near another, so the stones come out a hand or two across, none a sliver)
seeds = []
tries = 0
while len(seeds) < 15 and tries < 6000:
    tries += 1
    p = (rng.uniform(SX0, SX1), rng.uniform(SZ0, SZ1))
    if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 0.27 for q in seeds):
        seeds.append(p)
rect = [(SX0, SZ0), (SX1, SZ0), (SX1, SZ1), (SX0, SZ1)]
TINTS = [(1.0, 1.0, 1.0), (1.02, 0.94, 0.84), (0.84, 0.88, 0.94), (0.9, 0.88, 0.86), (0.66, 0.65, 0.66), (0.5, 0.5, 0.53)]
bm = bmesh.new()
L = layers(bm)
n_st = 0
for i, s in enumerate(seeds):
    cell = rect
    for j, q in enumerate(seeds):
        if i == j:
            continue
        # (nearer s than q, less half a joint: the perpendicular bisector moved toward s)
        a, b = q[0] - s[0], q[1] - s[1]
        L2 = math.hypot(a, b)
        c = (q[0] ** 2 + q[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2 - JOINT * L2
        cell = clip(cell, a, b, c)
        if len(cell) < 3:
            break
    if len(cell) < 3:
        continue
    # (half a joint in from the rect's edges too, where the stones meet the beam, the walls and the threshold)
    cell = clip(cell, -1, 0, -(SX0 + JOINT))
    cell = clip(cell, 1, 0, SX1 - JOINT)
    cell = clip(cell, 0, -1, -(SZ0 + JOINT))
    cell = clip(cell, 0, 1, SZ1 - JOINT)
    # (no corner sharper than the eye takes for a cut stone: points closer than 1.5 cm merged)
    merged = []
    for p in cell:
        if not merged or math.hypot(p[0] - merged[-1][0], p[1] - merged[-1][1]) > 0.015:
            merged.append(p)
    if len(merged) > 3 and math.hypot(merged[0][0] - merged[-1][0], merged[0][1] - merged[-1][1]) < 0.015:
        merged.pop()
    if len(merged) < 3:
        continue
    tint = TINTS[int(rng.integers(0, len(TINTS) - 1))] if rng.random() > 0.2 else TINTS[-1]
    pillow(bm, merged, FLOOR + 0.004 + rng.uniform(-0.001, 0.001), MORTAR_Y, L, tint, 0.65, (rng.random(), rng.random()),
           dome=DOME, tilt=(rng.uniform(-0.004, 0.004), rng.uniform(-0.004, 0.004)))
    n_st += 1
stones = new_obj("GenkanStones", bm, "stone", smooth_shade=True)
print("GENKAN_STONES", n_st)

# ------------------------------------------------------------------------------------------------ the pebble-wash under them
bm = bmesh.new()
L = layers(bm)
quad = [bm.verts.new(P(x, MORTAR_Y, z)) for x, z in ((SX0 - 0.002, SZ0 - 0.002), (SX1, SZ0 - 0.002), (SX1, Z1), (SX0 - 0.002, Z1))]
f = bm.faces.new(quad)
f.normal_update()
if f.normal.z < 0:
    f.normal_flip()
for loop in f.loops:
    loop[L["uv"]].uv = (loop.vert.co.x / 0.28, -loop.vert.co.y / 0.28)
    loop[L["col"]] = (1, 1, 1, 1)
mortar = new_obj("GenkanMortar", bm, "pebble")

# ------------------------------------------------------------------------------------------------ the shoe-off stone and the threshold
def rug_slab(bm, rect, top, foot, rim, round_, uvl):
    """the rug: a rectangle, its edge taken off in two steps (`rim` down at its edge, half of `round_` in, then the flat top), straight sides
    down to `foot`; its picture laid across the whole top (edges clamped into it), white points"""
    (x0, x1), (z0, z1) = rect
    rings = [(0.0, top - rim), (round_ * 0.45, top - rim * 0.28), (round_, top)]
    ring_v = [[bm.verts.new(P(x, h, z)) for x, z in ((x0 + e, z0 + e), (x1 - e, z0 + e), (x1 - e, z1 - e), (x0 + e, z1 - e))] for e, h in rings]
    foot_v = [bm.verts.new(P(x, foot, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.append(("side", bm.faces.new((foot_v[i], foot_v[j], ring_v[0][j], ring_v[0][i]))))
        for k in range(len(rings) - 1):
            faces.append(("top", bm.faces.new((ring_v[k][i], ring_v[k][j], ring_v[k + 1][j], ring_v[k + 1][i]))))
    faces.append(("top", bm.faces.new(ring_v[-1])))
    cen = Vector(P((x0 + x1) / 2, 0, (z0 + z1) / 2))
    for kind, f in faces:
        f.normal_update()
        if kind == "side":
            c = f.calc_center_median() - cen
            want = f.normal.x * c.x + f.normal.y * c.y > 0
        else:
            want = f.normal.z > 0
        if not want:
            f.normal_flip()
        for loop in f.loops:
            co = loop.vert.co
            gx, gz = co.x, -co.y
            uu = min(max((gx - x0) / (x1 - x0), 0.003), 0.997)
            vv = min(max(1.0 - (gz - z0) / (z1 - z0), 0.003), 0.997)
            loop[uvl["uv"]].uv = (uu, vv)
            loop[uvl["col"]] = (1.0, 1.0, 1.0, 1.0)


bm = bmesh.new()
L = layers(bm)
rug_slab(bm, (RUG["x"], RUG["z"]), RUG["top"], RUG["foot"], RUG["rim"], RUG["round"], L)
rug = new_obj("GenkanRug", bm, "rug", smooth_shade=False)
bm = bmesh.new()
L = layers(bm)
slab(bm, [(SILL["x"][0], SILL["z"][0]), (SILL["x"][1], SILL["z"][0]), (SILL["x"][1], SILL["z"][1]), (SILL["x"][0], SILL["z"][1])], SILL["top"],
     MORTAR_Y, 0.005, L, (0.46, 0.46, 0.49), 0.65, (0.12, 0.4))
sill = new_obj("GenkanSill", bm, "stone")

# ------------------------------------------------------------------------------------------------ the step's beam (上框)
# (its profile across the edge: from under the room's boards out to its rounded top front edge and down its face to the stones)
prof = [(K_BACK, K_FOOT), (K_BACK, K_TOP)]
for k in range(4):
    a = math.pi / 2 * k / 3
    prof.append((K_FRONT - K_ROUND + math.sin(a) * K_ROUND, K_TOP - K_ROUND + math.cos(a) * K_ROUND))
prof.append((K_FRONT, K_FOOT))
bm = bmesh.new()
L = layers(bm)


def run(points_at):
    """one run of the beam: `points_at(u, y)` gives (start, end) in x, z for each profile point; a strip between each two of them"""
    ring_a = [bm.verts.new(P(*points_at(pu, py)[0], )) for pu, py in prof]
    ring_b = [bm.verts.new(P(*points_at(pu, py)[1], )) for pu, py in prof]
    faces = []
    for i in range(len(prof) - 1):
        faces.append(bm.faces.new((ring_a[i], ring_b[i], ring_b[i + 1], ring_a[i + 1])))
    return faces, ring_a, ring_b


# (along the room side, z = Z0, from the corner (mitred: its end on the diagonal x - X0 = z - Z0) to the side wall)
fa, ra, rb = run(lambda pu, py: ((X0 + pu, py, Z0 + pu), (X1, py, Z0 + pu)))
# (along the till side, x = X0, from the corner to the door's end)
fb, sa, sb = run(lambda pu, py: ((X0 + pu, py, Z0 + pu), (X0 + pu, py, Z1)))
for f in fa + fb:
    f.normal_update()
# (each face outward: away from the beam's middle line)
for f, mid in [(f, Vector(P(X0 + (K_BACK + K_FRONT) / 2, (K_TOP + K_FOOT) / 2, 0))) for f in fa] + [(f, None) for f in fb]:
    c = f.calc_center_median()
    if mid is not None:
        out = Vector((0, c.y - P(0, 0, Z0 + (K_BACK + K_FRONT) / 2).y, c.z - (K_TOP + K_FOOT) / 2))
    else:
        out = Vector((c.x - (X0 + (K_BACK + K_FRONT) / 2), 0, c.z - (K_TOP + K_FOOT) / 2))
    if f.normal.dot(out) < 0:
        f.normal_flip()
for f in fa + fb:
    for loop in f.loops:
        co = loop.vert.co
        gx, gz, gy = co.x, -co.y, co.z
        along = gx if f in fa else gz
        across = gy if abs(f.normal.z) < 0.6 else (gz if f in fa else gx)
        loop[L["uv"]].uv = (along / 0.5, across / 0.12)
        loop[L["col"]] = (1, 1, 1, 1)
kamachi = new_obj("GenkanKamachi", bm, "wood")

# ------------------------------------------------------------------------------------------------ out
root = bpy.data.objects.new("GenkanRoot", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts}
print("GENKAN_TRIS", tris, sum(tris.values()))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.2, 0.9, 4.3)
    look = P(1.05, -0.1, 3.0)
    cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (0.6, 0.2, 0.8)
    bpy.context.collection.objects.link(sun)
export_dish(root, [root] + parts, os.path.join(PROJECT, "public", "models", "genkanfloor.glb"), os.path.join(PROJECT, "blender", "genkanfloor.blend"), PREVIEW)
print("GENKAN_DONE")
