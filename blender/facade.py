"""The shop's front over its way in (店構え, facade.glb; item 300, the owner's, 2026-11-17: 「玄關門的門改成，這樣。」「指屋頂」, after a
picture of an izakaya's front: a wooden eave over the door, a big red lantern hung under it in the middle, lit menu boards either side, a
wooden lattice). In the doorway's own frame (GuestBar3D's `look-door` group): x along the shop's front (+x toward the north wall, the
doorway's middle at x = -0.12), y up (the room's floor at 0, the genkan's stones at -0.11), z out to the street (the front's line at 0.46,
the noren hung at 0.27).

What's there to keep clear of (measured in the game): the noren x -0.68..0.44, y 1.34..2.29, z 0.22..0.31; the red and the grill's lanterns
hung at x -0.765 and -1.085, z 0.47, their tops at y 2.31, their papers 1.50..2.12, x -1.19..-0.64, z 0.35..0.59; the fish lantern beyond
the north wall's end, x 0.74..1.01, y 0.95..2.19; the till's counter x -1.88..-0.96, z up to 0.40, y up to 1.22; the north wall's end
x 0.43..0.71, its top at y 2.30, z up to 0.44.

- "FacadePost": a square post on the doorway's south side, between the noren and the red lantern (behind it, the lantern 2 cm in front).
- "FacadeBeam": the head beam (差鴨居) along the front, its foot just over the north wall's top and the noren's rod.
- "FacadeBack": the front's upper wall, a dark board from the beam up to the band's top.
- "FacadeLattice": the wooden lattice (木格子): a strip of it along the wall between the beam and the eave, and the band's middle bay (over the
  big lantern): squares, the slats in their picture, the gaps cut out.
- "FacadeRafters": the rafters (垂木), out from the wall, down to the eave's edge.
- "FacadeRoof": the eave's boards (野地板), sloping down to the street (item 341: the tiles were painted on this one slab, and the owner:
  「屋頂不像阿」).
- "FacadeTileRoof": the tiles (いぶし瓦), in their own shapes: pan tiles side by side across it, a trough and a roll each, in six courses down
  the slope, each course's lower edge lapped up over the next (the lap a step in the shape, not a line in a picture); over the big lantern
  the eave swept up in a bell (軒唐破風), the tiles and the boards and the rafters with it.
- "FacadeEaveTiles", "FacadeRoundEnds": along the edge, the flat end tiles (軒平瓦) in a band with their scroll, and a round end tile (軒丸瓦)
  at every roll.
- "FacadeGable", "FacadeGableTrim", "FacadeGegyo": the swept-up eave's front: its curved bargeboard (唐破風板) with a pale trim along its top, a
  little ridge plate (鬼板) on its crown and the hanging ornament (懸魚) under it. "FacadeVerge": the eave's two ends, a board down each.
- "FacadeFrame": the band of the menu boards on the wall over the eave: its foot rail over the roof's back (雨押さえ), the stiles between the
  boards' bays, its top rail and the coping (笠木) on it.
- "FacadeBar": the bar the red and the grill's lanterns hang from (提灯掛け), on two short arms out from the beam.

Why the boards are over the eave and not under it, as the picture's are: this game's camera never looks up (it keeps 9 degrees and more over
what it looks at), and from over it an eave hides what's under it; over the eave they're seen from wherever the front is.

The menu boards themselves, lit, and the big lantern are the game's (GuestBar3D: the boards from the menu as it stands, the lantern the
door lanterns' own model). Low: boxes and a few squares, the detail in the pictures.

Run:
    blender -b --factory-startup --python blender/facade.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# --- the front's measures (the game's frame) -------------------------------------------------------------------
XL, XR = -1.32, 0.71            # the band's two ends: past the grill's lantern, and the north wall's outer face
Z0, Z1 = 0.20, 0.34             # the beam's and the band's back and front
BEAM = (2.305, 2.42)            # the head beam, just over the wall's top (2.30) and the noren's rod (2.29)
FOOT = (2.61, 2.66)             # the band's foot rail, just over the roof's back (雨押さえ)
BAY = (2.66, 3.04)              # the boards' bays
RAIL = (3.04, 3.10)             # the band's top rail
COPING = dict(y=(3.10, 3.135), z=(0.18, 0.38))
BACK_Z = (0.215, 0.235)         # the front's upper wall, a dark board from the beam to the band's top
LOW_LATTICE = (2.425, 2.545)    # the lattice strip between the beam and the eave
STILE_W = 0.022
POST_X = (-0.8225, -0.7125)     # the post, under the stile between the 3rd and 4th boards on the left
POST_Z = (0.21, 0.33)
# (the boards: 0.10 wide, 0.135 apart; seven on the left of the big lantern, four on its right; the bay behind it its lattice)
SIGN_L = [-0.43 - 0.135 * k for k in range(7)]
SIGN_R = [0.19 + 0.135 * k for k in range(4)]
LATTICE_X = (-0.3625, 0.1225)
# (the eave: from the wall over the beam out to the street, sloping down; its underside's height along z)
EAVE_X = (-1.40, 1.16)
EAVE_Z = (0.237, 1.06)


def under(z):
    """the eave's boards' underside at z: 2.56 at the wall, down 0.16 by z 1.0 (the lanterns' tops, 2.31, well under it)"""
    return 2.56 - 0.16 * (z - 0.20) / 0.80


# (the eave swept up over the big lantern (軒唐破風, item 341): its middle and half width along the front, how high its crown rises at the
# edge; the lift dies away up the slope from KARA_FROM)
KARA_X, KARA_HW, KARA_H = -0.12, 0.42, 0.16
KARA_FROM = 0.5


def bell(x):
    """the swept-up edge's height over the straight eave at x: a bell, its crown a little peaked, curving out into the straight both sides"""
    s_ = abs(x - KARA_X) / KARA_HW
    if s_ >= 1:
        return 0.0
    return KARA_H * ((1 + math.cos(math.pi * s_)) / 2) ** 0.85


def lift(x, z):
    """how far the roof at (x, z) is lifted by the swept-up eave: the bell at the edge, dying away up the slope"""
    if z <= KARA_FROM:
        return 0.0
    return bell(x) * ((z - KARA_FROM) / (EAVE_Z[1] - KARA_FROM)) ** 1.6


RAFTER_W, RAFTER_H = 0.035, 0.045
ROOF_T = 0.05
BAR = dict(x=(-1.19, -0.66), y=(2.31, 2.335), z=(0.457, 0.483))
BAR_ARM_X = [-1.14, -0.71]


def mesh_obj(name, bm, smooth_shade=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth_shade
    return o


def tris(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


TILE = 0.5   # one repeat of the wood's picture covers this much along the grain


def add_box(bm, uvl, c0, c1, grain="x", corners=None):
    """a box from c0 to c1 (the game's frame), or by its eight corners (x0y0z0, x1y0z0, x0y1z0, x1y1z0, x0y0z1, ... in the game's frame);
    its picture's u along the grain (x, y or z) every TILE, v across"""
    if corners is None:
        (x0, y0, z0), (x1, y1, z1) = c0, c1
        corners = [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
    v = [bm.verts.new(P(*c)) for c in corners]
    # (each face by its corners' indices, wound outward as the game sees it)
    faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    gi = "xyz".index(grain)
    out = []
    for f in faces:
        try:
            face = bm.faces.new([v[i] for i in f])
        except ValueError:
            continue
        pts = [corners[i] for i in f]
        # (u along the grain; v along whichever other axis the face spans most)
        spans = [max(p[a] for p in pts) - min(p[a] for p in pts) for a in range(3)]
        others = [a for a in range(3) if a != gi]
        va = max(others, key=lambda a: spans[a])
        for lp, p in zip(face.loops, pts):
            lp[uvl].uv = (p[gi] / TILE, p[va] / TILE)
        out.append(face)
    return out


def box_obj(name, boxes, grain="x"):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    for b in boxes:
        if isinstance(b, dict):
            add_box(bm, uvl, None, None, b.get("grain", grain), b["corners"])
        else:
            add_box(bm, uvl, b[0], b[1], b[2] if len(b) > 2 else grain)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


# =====================================================================
# The pictures
# =====================================================================
def wood_picture(N=256, base=(0.24, 0.15, 0.09), seed=3):
    """dark stained timber, the grain along u: long streaks, a knot or two"""
    rng_ = np.random.default_rng(seed)
    u = np.linspace(0, 1, N, endpoint=False)
    v = np.linspace(0, 1, N, endpoint=False)
    U, V = np.meshgrid(u, v)
    g = np.zeros((N, N), np.float32)
    for _ in range(9):
        f = rng_.integers(6, 30)
        ph = rng_.random() * 6.28
        g += np.sin(V * f * 6.28 + np.sin(U * 6.28 * rng_.integers(1, 3) + ph) * 0.8 + ph) * rng_.random()
    g = (g - g.min()) / (g.max() - g.min())
    k = 0.84 + 0.3 * g
    for _ in range(2):
        cx, cy = rng_.random(), rng_.random()
        d = np.hypot((U - cx) * 3, (V - cy) * 9)
        k *= 1 - 0.35 * np.exp(-d * d * 30)
    rgb = np.stack([np.clip(base[i] * k, 0, 1) for i in range(3)], -1).astype(np.float32)
    return rgb


def tile_picture(N=256):
    """the roof's tiles from above (u across the front, v down the slope): pan tiles (桟瓦), each a trough and a roll side by side, the rolls
    running down the slope as ridges (lit along their crests, dark in the troughs), the rows lapped over each other in a fine dark line with a
    pale lip just above it; each tile its own shade of dull silver-grey"""
    rng_ = np.random.default_rng(11)
    u = np.linspace(0, 1, N, endpoint=False)
    v = np.linspace(0, 1, N, endpoint=False)
    U, V = np.meshgrid(u, v)
    ROWS, ROLLS = 6, 8
    cu = (U * ROLLS) % 1.0                                      # across each tile: 0..1
    # (its profile: the trough's long hollow, then the roll's quick hump at its side)
    prof = np.where(cu < 0.68, 0.5 - 0.5 * np.cos(cu / 0.68 * math.pi) * 0.4, 0.5 + 0.5 * np.sin((cu - 0.68) / 0.32 * math.pi))
    k = 0.58 + 0.42 * prof
    rv = (V * ROWS) % 1.0                                       # down each row: 0 its top, 1 its lapped edge
    k *= 1 - 0.38 * np.clip((rv - 0.94) / 0.06, 0, 1)           # the lap's dark line
    k *= 1 + 0.12 * np.clip(1 - np.abs(rv - 0.9) / 0.04, 0, 1)  # its lip catching the light
    tone = 0.92 + 0.12 * rng_.random((ROWS, ROLLS))
    k *= tone[(V * ROWS).astype(int) % ROWS, (U * ROLLS).astype(int) % ROLLS]
    base = np.array([0.34, 0.35, 0.37], np.float32)
    # (Blender's rows go up from the bottom: row 0 is v 0, the slope's top, so each row's lapped edge comes downhill of it)
    return np.clip(base[None, None, :] * k[..., None] * 1.3, 0, 1).astype(np.float32)


def tile_tone_picture(N=128, ROWS=6, ROLLS=8):
    """the tiles' faces now they've their own shapes (item 341): dull silver-grey, each tile its own shade, a fine fired mottle, a little
    lighter toward each one's lower edge where the weather's worn it"""
    rng_ = np.random.default_rng(341)
    u = np.linspace(0, 1, N, endpoint=False)
    U, V = np.meshgrid(u, u)
    tone = 0.9 + 0.16 * rng_.random((ROWS, ROLLS))
    k = tone[(V * ROWS).astype(int) % ROWS, (U * ROLLS).astype(int) % ROLLS]
    k = k * (0.95 + 0.08 * rng_.random((N, N)))
    k = k * (1 + 0.06 * ((V * ROWS) % 1.0))
    base = np.array([0.36, 0.37, 0.39], np.float32)
    return np.clip(base[None, None, :] * k[..., None], 0, 1).astype(np.float32)


def eave_tile_picture(W=512, H=64):
    """the eave tiles' ends along the edge (u along it, v up it): round ends (軒丸瓦) every 1/8, each a boss ringed and studded, and under
    them the flat ends (軒平瓦) with a scroll along them"""
    rgb = np.zeros((H, W, 3), np.float32)
    base = np.array([0.30, 0.31, 0.33], np.float32)
    rgb[:] = base
    yy, xx = np.mgrid[0:H, 0:W]
    # (the flat tiles' band across the lower third, its scroll a fine lighter wave)
    flat = yy < H * 0.36
    rgb[flat] = base * 0.92
    wave = np.abs(yy - (H * 0.18 + np.sin(xx / W * 2 * math.pi * 16) * H * 0.07)) < 1.4
    rgb[flat & wave] = base * 1.35
    # (the round ends over it)
    n = 8
    for k in range(n):
        cx, cy, r = (k + 0.5) * W / n, H * 0.62, H * 0.36
        d = np.hypot(xx - cx, yy - cy)
        disc = d < r
        rgb[disc] = base * 1.08
        rgb[disc & (d > r * 0.84)] = base * 0.7                 # its rim
        rgb[disc & (d < r * 0.34)] = base * 1.3                 # its boss
        for j in range(8):                                       # the studs round it
            a = j * math.pi / 4
            rgb[np.hypot(xx - cx - math.cos(a) * r * 0.62, yy - cy - math.sin(a) * r * 0.62) < r * 0.09] = base * 1.4
    return rgb


def lattice_picture(N=128):
    """the lattice behind the big lantern: thin square slats standing close (the gaps between cut out), two rails across"""
    rgb = np.zeros((N, N, 3), np.float32)
    a = np.zeros((N, N), np.float32)
    wood = np.array([0.27, 0.17, 0.10], np.float32)
    for k in range(11):
        x0 = int(k * N / 11 + 2)
        rgb[:, x0:x0 + 6] = wood * (0.9 + 0.2 * ((k * 7) % 3) / 2)
        rgb[:, x0:x0 + 1] = wood * 1.35
        a[:, x0:x0 + 6] = 1
    for y in (int(N * 0.18), int(N * 0.82)):
        rgb[y - 3:y + 3, :] = wood * 0.85
        rgb[y - 3, :] = wood * 1.3
        a[y - 3:y + 3, :] = 1
    return rgb, a


# =====================================================================
# The parts
# =====================================================================
bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "wood": pbr("FacadeWood", (1, 1, 1), tex=image("facadewood", wood_picture()), rough=0.75),
    "rafter": pbr("FacadeRafter", (1, 1, 1), tex=image("facaderafter", wood_picture(base=(0.30, 0.19, 0.11), seed=5)), rough=0.75),
    "soffit": pbr("FacadeSoffit", (1, 1, 1), tex=image("facadesoffit", wood_picture(base=(0.42, 0.29, 0.18), seed=8)), rough=0.8),
    "tiles": pbr("FacadeTiles", (1, 1, 1), tex=image("facadetiles", tile_picture()), rough=0.55),
    "eavetiles": pbr("FacadeEaveTiles", (1, 1, 1), tex=image("facadeeavetiles", eave_tile_picture()), rough=0.55),
    "tileshape": pbr("FacadeTileFaces", (1, 1, 1), tex=image("facadetilefaces", tile_tone_picture()), rough=0.5),
    "roundend": pbr("FacadeRoundEnds", (0.36, 0.37, 0.4), rough=0.45),
    "trim": pbr("FacadeTrim", (0.86, 0.8, 0.66), rough=0.6),
    "gold": pbr("FacadeGegyo", (0.62, 0.48, 0.22), rough=0.4, metal=0.5),
    "back": pbr("FacadeBack", (0.11, 0.075, 0.05), rough=0.9),
}
lat_rgb, lat_a = lattice_picture()
M["lattice"] = pbr("FacadeLattice", (1, 1, 1), tex=image("facadelattice", lat_rgb, alpha=lat_a), rough=0.8, blend=True)

parts = []


def keep(o, mat):
    o.data.materials.append(mat)
    parts.append(o)
    return o


# the post, the beam
keep(box_obj("FacadePost", [((POST_X[0], 0.002, POST_Z[0]), (POST_X[1], BEAM[0] - 0.003, POST_Z[1]), "y")]), M["wood"])
keep(box_obj("FacadeBeam", [((XL, BEAM[0], Z0), (XR, BEAM[1], Z1))]), M["wood"])

# the band's frame over the eave: its foot rail, the stiles between the bays (and at its ends), its top rail and the coping on it; and the
# wall behind, from the beam up
stiles = sorted(set([round(c + 0.0675, 4) for c in SIGN_L] + [round(c - 0.0675, 4) for c in SIGN_L]
                    + [round(c + 0.0675, 4) for c in SIGN_R] + [round(c - 0.0675, 4) for c in SIGN_R]))
frame = [((XL, RAIL[0], Z0), (XR, RAIL[1], Z1)), ((XL, FOOT[0], Z0), (XR, FOOT[1], Z1 + 0.02)),
         ((XL - 0.02, COPING["y"][0], COPING["z"][0]), (XR + 0.02, COPING["y"][1], COPING["z"][1]))]
for sx in stiles:
    x0, x1 = max(XL, sx - STILE_W / 2), min(XR, sx + STILE_W / 2)
    frame.append(((x0, BAY[0], BACK_Z[1]), (x1, BAY[1], Z1 - 0.01), "y"))
# (its two ends: the stile at each end runs the bays' height, the full depth)
frame.append(((XL, BAY[0], Z0), (XL + 0.026, BAY[1], Z1), "y"))
frame.append(((stiles[-1] + STILE_W / 2, BAY[0], Z0), (XR, BAY[1], Z1), "y"))
keep(box_obj("FacadeFrame", frame), M["wood"])
keep(box_obj("FacadeBack", [((XL + 0.004, BEAM[1], BACK_Z[0]), (XR - 0.004, RAIL[0], BACK_Z[1]))]), M["back"])

# the lattice: the band's middle bay (over the big lantern), a little in front of the wall; and the strip along the wall between the beam and
# the eave (its slats' picture laid along it at the same size: u by length)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
lx0, lx1 = LATTICE_X[0] + STILE_W / 2, LATTICE_X[1] - STILE_W / 2
for (x0, x1, y0, y1, z, u1) in ((lx0, lx1, BAY[0], BAY[1], BACK_Z[1] + 0.03, 1.0),
                                (XL + 0.03, XR - 0.03, LOW_LATTICE[0], LOW_LATTICE[1], BACK_Z[1] + 0.005, (XR - XL - 0.06) / 0.46)):
    vs = [bm.verts.new(P(x, y, z)) for (x, y) in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (u1, 0), (u1, 1), (0, 1))):
        lp[uvl].uv = uv
keep(mesh_obj("FacadeLattice", bm), M["lattice"])

# the rafters: from the band's back, over its top rail and the beam out front, down to the eave's edge (their tops on the roof's underside)
rafters = []
n_r = 10
for k in range(n_r):
    x = EAVE_X[0] + 0.05 + k * (EAVE_X[1] - EAVE_X[0] - 0.1) / (n_r - 1)
    za, zb = BACK_Z[1] + 0.01, EAVE_Z[1] - 0.03
    ya, yb = under(za), under(zb) + lift(x, zb)
    corners = [(xx, yy, zz) for zz, ytop in ((za, ya), (zb, yb)) for yy in (ytop - RAFTER_H, ytop - 0.001) for xx in (x - RAFTER_W / 2, x + RAFTER_W / 2)]
    rafters.append({"corners": corners, "grain": "z"})
keep(box_obj("FacadeRafters", rafters, "z"), M["rafter"])

# the roof (item 341): its boards (the soffit seen between the rafters, their ends at the edge), lifted where the eave sweeps up; on them the
# tiles in their own shapes, six courses of pan tiles down the slope; along the edge the end tiles; over the big lantern the swept-up eave's
# front; a board down each end
z0, z1 = EAVE_Z
TW = (EAVE_X[1] - EAVE_X[0]) / 20                   # twenty tiles across
NC = 6                                              # six courses down the slope
PROF_U = [0.0, 0.34, 0.68, 0.84]                    # across a tile: its trough's two sides and its hollow, the roll's crest
PROF_H = [0.024, 0.010, 0.024, 0.042]               # how high each stands over the boards
LAP = 0.012                                         # each course's lower edge lapped up over the next
xs = [EAVE_X[0] + (i + PROF_U[j]) * TW for i in range(20) for j in range(4)] + [EAVE_X[1]]
hs = [PROF_H[j] for i in range(20) for j in range(4)] + [PROF_H[0]]
zs = [z0 + (z1 - z0) * c / NC for c in range(NC + 1)]


def board_top(x, z):
    return under(z) + ROOF_T + lift(x, z)


# (the boards: a grid along the tiles' columns and the courses' edges, its top and underside lifted alike; its front, back and ends closed)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
cols = [EAVE_X[0] + k * TW for k in range(21)]
top = [[bm.verts.new(P(x, board_top(x, z), z)) for x in cols] for z in zs]
bot = [[bm.verts.new(P(x, board_top(x, z) - ROOF_T, z)) for x in cols] for z in zs]
for r in range(NC):
    for k in range(20):
        f = bm.faces.new((top[r][k], top[r + 1][k], top[r + 1][k + 1], top[r][k + 1]))
        f.material_index = 1
        f = bm.faces.new((bot[r][k], bot[r][k + 1], bot[r + 1][k + 1], bot[r + 1][k]))
        f.material_index = 1
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = (-co.y / TILE, co.x / TILE)
for k in range(20):
    for row in (NC, 0):
        f = bm.faces.new((bot[row][k], bot[row][k + 1], top[row][k + 1], top[row][k]))
        f.material_index = 1
for r in range(NC):
    for k in (0, 20):
        f = bm.faces.new((bot[r][k], bot[r + 1][k], top[r + 1][k], top[r][k]))
        f.material_index = 1
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
roof_o = keep(mesh_obj("FacadeRoof", bm), M["tiles"])
roof_o.data.materials.append(M["soffit"])

# (the tiles: each course a strip across the front in the tiles' profile, rising LAP to its lower edge, and the step down from that edge to
# the next course's top: the lap, a shadowed edge as tiles have)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()


def tile_y(i, z, raised):
    return board_top(xs[i], z) + hs[i] + (LAP if raised else 0.0)


for c in range(NC):
    za, zb = zs[c], zs[c + 1]
    ra = [bm.verts.new(P(xs[i], tile_y(i, za, False), za)) for i in range(len(xs))]
    rb = [bm.verts.new(P(xs[i], tile_y(i, zb, True), zb)) for i in range(len(xs))]
    for i in range(len(xs) - 1):
        f = bm.faces.new((ra[i], rb[i], rb[i + 1], ra[i + 1]))
        for lp, (xx, zz) in zip(f.loops, ((xs[i], za), (xs[i], zb), (xs[i + 1], zb), (xs[i + 1], za))):
            lp[uvl].uv = ((xx - EAVE_X[0]) / (TW * 8), 1 - (zz - z0) / (z1 - z0))
    if c < NC - 1:
        # (the lap's face: down from this course's lifted edge to the next one's top, facing the street)
        nb = [bm.verts.new(P(xs[i], tile_y(i, zb, False) + 0.0005, zb + 0.0005)) for i in range(len(xs))]
        for i in range(len(xs) - 1):
            f = bm.faces.new((rb[i], nb[i], nb[i + 1], rb[i + 1]))
            for lp in f.loops:
                lp[uvl].uv = ((lp.vert.co.x - EAVE_X[0]) / (TW * 8), 1 - (c + 0.98) / NC)
# (all facing up and out toward the street: an open strip could come out either way)
for f in bm.faces:
    f.normal_update()
    if f.normal.z < -0.05 or (abs(f.normal.z) <= 0.05 and f.normal.y > 0):
        f.normal_flip()
keep(mesh_obj("FacadeTileRoof", bm), M["tileshape"])

# (the end tiles along the edge: the flat ends' band under the rolls, following the sweep; a round end at every roll, facing the street)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
ex = [EAVE_X[0] + k * TW / 2 for k in range(41)]
zf0, zf1 = z1 - 0.004, z1 + 0.022
band = []
for x in ex:
    yb_ = board_top(x, z1) - 0.012
    yt_ = board_top(x, z1) + 0.03
    band.append([bm.verts.new(P(x, yb_, zf1)), bm.verts.new(P(x, yt_, zf1)), bm.verts.new(P(x, yt_, zf0)), bm.verts.new(P(x, yb_, zf0))])
for k in range(40):
    a, b_ = band[k], band[k + 1]
    for j in range(4):
        f = bm.faces.new((a[j], b_[j], b_[(j + 1) % 4], a[(j + 1) % 4]))
        if j == 0:   # (its front: the flat ends' scroll, the lower band of the eave tiles' picture)
            for lp, (uu, vv) in zip(f.loops, ((ex[k], 0.0), (ex[k + 1], 0.0), (ex[k + 1], 0.36), (ex[k], 0.36))):
                lp[uvl].uv = ((uu - EAVE_X[0]) / 0.82, vv)
bm.faces.new(tuple(reversed(band[0])))
bm.faces.new(tuple(band[-1]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
keep(mesh_obj("FacadeEaveTiles", bm), M["eavetiles"])
bm = bmesh.new()
RR, SEG = 0.024, 10
for i in range(20):
    x = EAVE_X[0] + (i + 0.84) * TW
    cy = board_top(x, z1) + 0.026
    rings = [[bm.verts.new(P(x + RR * math.cos(2 * math.pi * k / SEG), cy + RR * math.sin(2 * math.pi * k / SEG), zz)) for k in range(SEG)]
             for zz in (z1 - 0.05, z1 + 0.03)]
    for k in range(SEG):
        k2 = (k + 1) % SEG
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
    bm.faces.new(rings[1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
keep(mesh_obj("FacadeRoundEnds", bm), M["roundend"])

# (the swept-up eave's front: its curved bargeboard standing just proud of the end tiles, from where the sweep begins to where it ends, a
# pale trim along its top; a little ridge plate on its crown; the ornament hung under it)
gx = [KARA_X - KARA_HW - 0.06 + k * (2 * KARA_HW + 0.12) / 36 for k in range(37)]
gz0, gz1 = z1 + 0.024, z1 + 0.046


def gable_edge(x):
    return board_top(x, z1) + 0.034


def swept_band(name, y_lo, y_hi, za_, zb_, mat):
    bm_ = bmesh.new()
    uvl_ = bm_.loops.layers.uv.new()
    ring = []
    for x in gx:
        yt_ = gable_edge(x)
        ring.append([bm_.verts.new(P(x, yt_ + y_lo, zb_)), bm_.verts.new(P(x, yt_ + y_hi, zb_)), bm_.verts.new(P(x, yt_ + y_hi, za_)),
                     bm_.verts.new(P(x, yt_ + y_lo, za_))])
    for k in range(len(gx) - 1):
        a, b_ = ring[k], ring[k + 1]
        for j in range(4):
            f = bm_.faces.new((a[j], b_[j], b_[(j + 1) % 4], a[(j + 1) % 4]))
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl_].uv = (co.x / TILE, co.z / TILE)
    bm_.faces.new(tuple(reversed(ring[0])))
    bm_.faces.new(tuple(ring[-1]))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    return keep(mesh_obj(name, bm_), M[mat])


swept_band("FacadeGable", -0.075, 0.0, gz0, gz1, "rafter")
swept_band("FacadeGableTrim", -0.002, 0.012, gz0 - 0.002, gz1 + 0.004, "trim")
crown = gable_edge(KARA_X)
# (the ridge plate on the crown: tile-grey, as the end tiles are)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
add_box(bm, uvl, (KARA_X - 0.04, crown + 0.012, gz0 - 0.03), (KARA_X + 0.04, crown + 0.07, gz1 + 0.006), "x")
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
keep(mesh_obj("FacadeOnita", bm), M["roundend"])
bm = bmesh.new()
# (the ornament under the crown: a six-sided board, wider than tall, its point down)
hx = [(-0.06, 0.0), (-0.04, 0.035), (0.04, 0.035), (0.06, 0.0), (0.03, -0.055), (-0.03, -0.055)]
gy = crown - 0.075 - 0.04
front = [bm.verts.new(P(KARA_X + a, gy + b, gz1 + 0.012)) for a, b in hx]
back_ = [bm.verts.new(P(KARA_X + a, gy + b, gz1 - 0.002)) for a, b in hx]
bm.faces.new(front)
bm.faces.new(tuple(reversed(back_)))
for k in range(6):
    k2 = (k + 1) % 6
    bm.faces.new((back_[k], back_[k2], front[k2], front[k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
keep(mesh_obj("FacadeGegyo", bm), M["gold"])
# (the eave's two ends: a board down each (けらば), so it's seen to have a thickness from the side)
ends = []
for x0_, x1_ in ((EAVE_X[0] - 0.014, EAVE_X[0] + 0.004), (EAVE_X[1] - 0.004, EAVE_X[1] + 0.014)):
    corners = []
    for zz in (z0, z1 + 0.024):
        for lohi in ("lo", "hi"):
            for xx in (x0_, x1_):
                yy = (board_top(xx, min(zz, z1)) - ROOF_T - 0.02) if lohi == "lo" else (board_top(xx, min(zz, z1)) + 0.05)
                corners.append((xx, yy, zz))
    ends.append({"corners": corners, "grain": "z"})
keep(box_obj("FacadeVerge", ends, "z"), M["rafter"])

# the lanterns' bar, on two short arms out from the beam
bx, by, bz = BAR["x"], BAR["y"], BAR["z"]
keep(box_obj("FacadeBar", [((bx[0], by[0], bz[0]), (bx[1], by[1], bz[1]))]
             + [((ax - 0.012, by[0] + 0.003, Z1 - 0.004), (ax + 0.012, by[1] - 0.003, bz[0] + 0.004), "z") for ax in BAR_ARM_X]), M["wood"])

root = bpy.data.objects.new("Facade", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
    print(o.name, tris([o]))

if PREVIEW:
    target = P(-0.3, 2.6, 0.4)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 3.6, 3.6)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35
    bpy.context.scene.camera = cam
    for nm, loc, energy in (("Key", P(2.0, 4.0, 3.0), 4.0), ("Fill", P(-2.0, 2.0, 3.0), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = energy
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "facade.glb"), os.path.join(PROJECT, "blender", "facade.blend"), PREVIEW)
print("FACADE_DONE", tris(parts))
