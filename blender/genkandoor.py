"""The sliding door at the way in (玄関の格子戸, genkandoor.glb; item 410, the owner's, 2026-11-20: 「玄關試著做和式拉門」「客人進來的時候會先開拉
門再脫鞋」). In the doorway's own frame (GuestBar3D's `look-door` group, as blender/facade.py): x along the shop's front (+x toward the north
wall), y up (the room's floor at 0, the genkan's stones at -0.09 to -0.11), z out to the street.

Two leaves (引き違い戸, item 415, the owner's 「拉門我要兩節，和式得那種，且我也可以互動」: item 410's had three) on two tracks across the
doorway, from the post's inner face (x -0.712) to the north wall's end (x 0.43), as a shop's lattice door is: each a frame of dark wood (its
stiles, its top rail, a deep bottom rail, a middle rail), a wooden panel (腰板) under the middle rail, frosted glass over it with the
lattice's slats (縦格子) on its street side and a cross rail (横桟) over them two thirds of the way up; a dark bronze pull (引手) on each at
the edge where they meet. The south leaf on the inner track, the north on the outer (右前, as seen from in the shop); opened, the north one
slides south over the south one, the way left open 0.56 wide (x -0.131 to 0.429): the game slides it ("GenkanDoorN", moved along x only;
"GenkanDoorS" stays). Over them the lintel (鴨居) and a transom (欄間) of the same glass and slats up to the beam, a head rail into the beam's
front; under them the track (敷居) on the stone sill.

What's to be kept clear of (measured in the game, items 410 and 415): the threshold stone the track stands on (z 0.384 to 0.459, its top at
y -0.096); the red lantern's paper (hung 6.4 cm further south for these leaves, item 415: x -0.962 to -0.708, z 0.355 to 0.585, y 1.50 to
2.13: at the outer track's street face, z 0.43, it reaches x -0.716, past the post); the big lantern's back (z 0.433 at x -0.344 to 0.083,
y 1.67 up); the noren (z 0.21 to 0.30, swung); the beam (z 0.20 to 0.34, from y 2.305). So all of it within z 0.385 to 0.43 (the head rail
back to the beam's front, 0.338), from the post to the wall.

Low: boxes, the glass one square each (seen from both sides), the slats boxes; the wood's grain in its picture.

Run:
    blender -b --factory-startup --python blender/genkandoor.py -- <project path> [preview.png]
"""
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

bpy.ops.wm.read_factory_settings(use_empty=True)
seed(410)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# --- the measures (the doorway's frame) ------------------------------------------------------------------------
X_POST, X_WALL = -0.712, 0.43       # the post's inner face, the north wall's end
X_S = X_POST + 0.001                 # the leaves' and the lintel's south end: at the post (the red lantern hung clear of it, item 415)
TRACK_Y = (-0.0955, -0.084)          # the track (敷居) on the sill
LEAF_Y = (-0.082, 1.975)             # a leaf, from the track up into the lintel
LINTEL_Y = (1.96, 2.03)
TRANSOM_Y = (2.03, 2.28)
HEAD_Y = (2.28, 2.304)               # the head rail into the beam's front (under its foot, 2.305)
FRAME_Z = (0.385, 0.43)              # the track's and the lintel's depth (on the threshold stone, z 0.384 to 0.459)
TRACK_Z = [(0.388, 0.406), (0.409, 0.427)]      # the south leaf's (inner), the north leaf's (outer)
OVERLAP = 0.02                       # how far the two overlap shut, at the middle
W_LEAF = round(((X_WALL - 0.001) - X_S + OVERLAP) / 2, 4)
LEAF_X = [(X_S, X_S + W_LEAF), (X_WALL - 0.001 - W_LEAF, X_WALL - 0.001)]
CROSS_K, CROSS_H = 0.62, 0.014       # the lattice's cross rail: how far up the glass, how deep
PULL = (0.012, 0.07, 0.86)           # a pull's width, height and its middle's height
STILE, TOP_RAIL, BOTTOM_RAIL, MID_RAIL = 0.03, 0.045, 0.11, 0.035
MID_Y = 0.56                         # the middle rail's foot, over the leaf's foot
SLAT_W, SLAT_GAP = 0.009, 0.036      # the lattice's slats: their width, their pitch (fine: at 12 mm and 46 they read as bars)
BRASS_S = 0.07                       # a corner's brass fitting, its side (item 421)
# the north jamb's pieces, foot to top: from, to, how far north (item 419: the wall's face 0.498, its chair rail's 0.453, its nageshi's 0.473,
# the plaster's over that 0.494; half a millimetre to one short of each)
JAMB = [(TRACK_Y[0], 0.824, 0.4975), (0.824, 0.876, 0.4525), (0.876, 1.976, 0.4975), (1.976, 2.004, 0.4725), (2.004, 2.199, 0.4935)]


# --- pictures -----------------------------------------------------------------------------------------------------
def wood_picture(n=256):
    """dark wood (a shade lighter than the facade's: in the shade under the noren it went black), its grain up the picture: long streaks wandering, a little lighter and darker by turns"""
    u, v = grid01(n)
    streak = fbm(n, 24, 2, 4)
    fine = 0.5 + 0.5 * np.sin(2 * np.pi * (u * 38 + 0.8 * fbm(n, 3, 2)))
    k = 0.82 + 0.14 * streak + 0.06 * fine
    # (a medium brown now (item 419, the owner's 「顏色要亮一些」): 0.3, 0.19, 0.11 before, near black in the genkan's shade)
    base = np.array((0.42, 0.28, 0.17), np.float32)
    return (base[None, None, :] * k[..., None]).clip(0, 1).astype(np.float32)


def carve_pictures(n=512):
    """the leaves' lower panels (腰板), carved as a main door's are (item 421, the owner's 「畢竟是大門，會有些華麗的刻文」): a bead and a groove
    round the edge; the field cut in blue-sea waves (青海波), rings of circles each row over the one above it; in the middle a round crest, its
    rim raised and a cut round it, a sea bream (鯛, the shop's grilled fish) raised in it, its eye and its gill cut. The wood's colour darker
    down in the cuts, lighter on what stands up. Returns (colour, normal)"""
    u, v = grid01(n)
    h = np.full((n, n), 0.5, np.float32)
    d = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
    h += 0.22 * np.sqrt(np.clip(1 - np.abs(d - 0.022) / 0.010, 0, 1))
    h -= 0.18 * np.clip(1 - np.abs(d - 0.038) / 0.005, 0, 1)
    field = d > 0.044
    # (the waves: circles R across, rows half R apart and every other one half a circle along; a point is the lowest row's that reaches it)
    R = 0.09
    found = np.zeros((n, n), bool)
    dist = np.zeros((n, n), np.float32)
    jlo = np.floor((v - R) / (0.5 * R)).astype(int) + 1
    for k in range(5):
        j = jlo + k
        cy = j * 0.5 * R
        off = np.mod(j, 2) * R
        cx = np.round((u - off) / (2 * R)) * 2 * R + off
        dd = np.hypot(u - cx, v - cy)
        take = (~found) & (dd < R)
        dist[take] = dd[take]
        found |= take
    rr = dist / R
    g = np.zeros_like(h)
    # (three rings to a fan, cut wide and deep enough to read from the street: four thin ones were lost there)
    for k in (0.4, 0.7, 0.99):
        g = np.maximum(g, np.clip(1 - np.abs(rr - k) / 0.08, 0, 1))
    h -= np.where(field & found, 0.22 * g, 0)
    # (the crest: cleared of the waves, its rim raised, a cut round it)
    CR = 0.2
    rc = np.hypot(u - 0.5, v - 0.5)
    inside = rc < CR
    h = np.where(inside, 0.52, h)
    h += 0.2 * np.clip(1 - np.abs(rc - (CR - 0.012)) / 0.01, 0, 1)
    h -= 0.14 * np.clip(1 - np.abs(rc - (CR + 0.008)) / 0.005, 0, 1)
    # (the bream, its head to the right: a domed body, a low ridge of a back fin, a forked tail off a narrow root)
    body = np.sqrt(np.clip(1 - ((u - 0.515) / 0.105) ** 2 - ((v - 0.5) / 0.06) ** 2, 0, 1))
    fin = np.sqrt(np.clip(1 - ((u - 0.5) / 0.07) ** 2 - ((v - 0.565) / 0.022) ** 2, 0, 1))
    tx = (0.415 - u) / 0.055
    spread = 0.012 + 0.048 * tx
    tail = np.where((tx >= 0) & (tx <= 1), np.clip(1 - np.abs(v - 0.5) / spread, 0, 1), 0)
    tail = np.where((tx > 0.7) & (np.abs(v - 0.5) < (tx - 0.7) * 0.09), 0, tail)
    relief = np.maximum(np.maximum(body, 0.55 * fin), 0.55 * tail)
    h = np.where(inside, h + 0.32 * relief, h)
    h -= 0.25 * np.clip(1 - np.hypot(u - 0.585, v - 0.512) / 0.009, 0, 1)
    gill = np.clip(1 - np.abs(np.hypot(u - 0.62, v - 0.5) - 0.07) / 0.004, 0, 1) * (np.abs(v - 0.5) < 0.045) * (u < 0.57) * (relief > 0.3)
    h -= 0.12 * gill
    k = 0.84 + 0.12 * fbm(n, 24, 2, 4)
    base = np.array((0.42, 0.28, 0.17), np.float32)
    # (the flat of it the door's own wood; only the cuts darker and what stands up lighter: at 0.72 the whole panel read darker than the door)
    ao = np.clip(1.0 + 1.25 * (h - 0.5), 0.55, 1.35)
    col = base[None, None, :] * (k * ao)[..., None]
    return col.clip(0, 1).astype(np.float32), to_normal(h, 9.0).astype(np.float32)


def kumiko_picture(w=1024, h=256, W=1.082, H=0.25, s=0.06, t=0.0035):
    """the transom's lattice (欄間の組子, item 421), hemp-leaf (麻の葉): a grid of triangles, each one's three corners joined to its middle, in
    thin strips of pale wood with a strip along its top and foot; the rest clear (W by H metres, a triangle's side s, a strip t wide).
    Returns (colour, alpha)"""
    X, Y = np.meshgrid((np.arange(w) + 0.5) / w * W, (np.arange(h) + 0.5) / h * H)
    ht = s * np.sqrt(3) / 2
    r = Y / ht
    q = X / s - r / 2
    fq, fr = q - np.floor(q), r - np.floor(r)
    low = fq + fr < 1
    la = np.where(low, 1 - fq - fr, fq + fr - 1)
    lb = np.where(low, fq, 1 - fr)
    lc = np.where(low, fr, 1 - fq)
    dist = np.minimum(np.minimum(la, lb), lc) * ht
    for a, b, c in ((la, lb, lc), (lb, lc, la), (lc, la, lb)):
        dist = np.minimum(dist, np.where(a >= 1 / 3 - t / s, np.abs(b - c) * s / 2, np.inf))
    dist = np.minimum(dist, np.maximum(np.minimum(Y, H - Y) - t, 0))
    alpha = np.clip((t / 2 - dist) / (W / w) + 0.5, 0, 1)
    k = 0.86 + 0.1 * np.sin(2 * np.pi * (X * 23 + Y * 3))
    col = np.array((0.6, 0.45, 0.3), np.float32)[None, None, :] * k[..., None]
    return col.clip(0, 1).astype(np.float32), alpha.astype(np.float32)


def brass_pictures(n=128, S=0.07, wa=0.022, lobe=0.013):
    """a corner's brass fitting (飾り金具, item 421), in the picture's lower left: two arms along the edges, each ending in a round knob, an
    engraved line round inside its edge, three rivets; the rest clear (S metres across). Returns (colour, alpha, normal)"""
    u, v = grid01(n)
    X, Y = u * S, v * S

    def box_sdf(cx, cy, hx, hy):
        qx, qy = np.abs(X - cx) - hx, np.abs(Y - cy) - hy
        return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0)

    sdf = np.minimum.reduce([
        box_sdf(wa / 2, (S - lobe) / 2, wa / 2, (S - lobe) / 2), box_sdf((S - lobe) / 2, wa / 2, (S - lobe) / 2, wa / 2),
        np.hypot(X - wa / 2, Y - (S - lobe)) - lobe, np.hypot(X - (S - lobe), Y - wa / 2) - lobe])
    alpha = np.clip(0.5 - sdf / (S / n), 0, 1)
    hgt = 0.5 + 0.15 * np.clip(-sdf / 0.002, 0, 1)
    hgt -= 0.2 * np.clip(1 - np.abs(sdf + 0.0028) / 0.0007, 0, 1)
    dome = np.zeros_like(hgt)
    for cx, cy in ((wa / 2, S - lobe), (S - lobe, wa / 2), (wa / 2, wa / 2)):
        dome = np.maximum(dome, np.sqrt(np.clip(1 - (np.hypot(X - cx, Y - cy) / 0.0035) ** 2, 0, 1)))
    hgt += 0.3 * dome
    ao = np.clip(0.75 + 1.2 * (hgt - 0.5), 0.45, 1.3)
    col = np.array((0.8, 0.62, 0.3), np.float32)[None, None, :] * ao[..., None]
    return col.clip(0, 1).astype(np.float32), alpha.astype(np.float32), to_normal(hgt, 4.0).astype(np.float32)


def band_pictures(w=1024, h=64, W=1.14, H=0.053):
    """the lintel's face (item 421), carved in a running seven-treasures (七宝つなぎ): circles each overlapping the next, cut in, a line along
    its top and foot. Returns (colour, normal)"""
    X, Y = np.meshgrid((np.arange(w) + 0.5) / w * W, (np.arange(h) + 0.5) / h * H)
    rho = H * 0.36
    step = rho * np.sqrt(2)
    hgt = np.full(X.shape, 0.5, np.float32)
    g = np.zeros_like(hgt)
    i0 = np.round(X / step)
    for di in (-1, 0, 1):
        cx = (i0 + di) * step
        g = np.maximum(g, np.clip(1 - np.abs(np.hypot(X - cx, Y - H / 2) - rho) / 0.0012, 0, 1))
    for yl in (0.004, H - 0.004):
        g = np.maximum(g, np.clip(1 - np.abs(Y - yl) / 0.0008, 0, 1))
    hgt -= 0.24 * g
    k = 0.84 + 0.12 * np.sin(2 * np.pi * (X * 7 + 0.3 * np.sin(Y * 90)))
    # (the flat of it the wood's own colour, the cuts darker: at 0.72 it read as a dark band under the eave's shade)
    ao = np.clip(1.0 + 1.4 * (hgt - 0.5), 0.5, 1.3)
    col = np.array((0.42, 0.28, 0.17), np.float32)[None, None, :] * (k * ao)[..., None]
    return col.clip(0, 1).astype(np.float32), to_normal(hgt, 5.0).astype(np.float32)


CARVE_COL, CARVE_NRM = carve_pictures()
KUMIKO_COL, KUMIKO_A = kumiko_picture()
BRASS_COL, BRASS_A, BRASS_NRM = brass_pictures()
BAND_COL, BAND_NRM = band_pictures()

M = {
    "wood": pbr("GenkanDoorWood", (1, 1, 1), tex=image("genkan_door_wood", wood_picture()), rough=0.6),
    # (item 421: the carved panels, the transom's lattice (cut out), the corners' brass (cut out), the lintel's carved band)
    "carve": pbr("GenkanDoorCarve", (1, 1, 1), tex=image("genkan_door_carve", CARVE_COL), nrm=image("genkan_door_carve_n", CARVE_NRM, data=True), rough=0.6),
    "kumiko": pbr("GenkanDoorKumiko", (1, 1, 1), tex=image("genkan_door_kumiko", KUMIKO_COL, alpha=KUMIKO_A), rough=0.6, blend=True),
    "brass": pbr("GenkanDoorBrass", (1, 1, 1), tex=image("genkan_door_brass", BRASS_COL, alpha=BRASS_A), nrm=image("genkan_door_brass_n", BRASS_NRM, data=True),
                 rough=0.35, metal=0.8, blend=True),
    "band": pbr("GenkanDoorBand", (1, 1, 1), tex=image("genkan_door_band", BAND_COL), nrm=image("genkan_door_band_n", BAND_NRM, data=True), rough=0.6),
    # (the pulls: dark bronze)
    "pull": pbr("GenkanDoorPull", (0.08, 0.06, 0.045), rough=0.45),
    # (frosted glass: the game draws it its own way, see-through a little, from both sides)
    "glass": pbr("GenkanDoorGlass", (0.86, 0.89, 0.9), rough=0.35),
}
parts = []


def box(bm, uvl, x0, x1, y0, y1, z0, z1, grain="y"):
    """a box into `bm`, its picture laid on each face along `grain` (the wood's run: up a stile, along a rail)"""
    vs = [bm.verts.new(P(x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    idx = lambda i, j, k: vs[i * 4 + j * 2 + k]
    faces = [
        ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)),
        ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)),
        ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),
    ]
    span = {"x": (x0, x1), "y": (y0, y1), "z": (z0, z1)}
    for f in faces:
        try:
            face = bm.faces.new([idx(*c) for c in f])
        except ValueError:
            continue
        for lp, c in zip(face.loops, f):
            co = {"x": (x0, x1)[c[0]], "y": (y0, y1)[c[1]], "z": (z0, z1)[c[2]]}
            other = [a for a in ("x", "y", "z") if a != grain and span[a][1] - span[a][0] > 1e-6]
            lp[uvl].uv = (co[other[0]] / 0.35 if other else 0.0, co[grain] / 0.7)
    return bm


def glass_quad(bm, uvl, x0, x1, y0, y1, z):
    """the glass: one square across, facing the street (drawn from both sides)"""
    vs = [bm.verts.new(P(x, y, z)) for (x, y) in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    f = bm.faces.new(vs)
    for lp, (a, b) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = (a, b)


FLAT = ("glass", "kumiko", "brass", "band")


def quad_uv(bm, uvl, corners, uvs, out):
    """one face through four points (the game's frame), each its uv, turned to face `out` (a direction in the game's frame)"""
    vs = [bm.verts.new(P(*c)) for c in corners]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(P(*out)) < 0:
        f.normal_flip()
    uv = dict(zip(vs, uvs))
    for lp in f.loops:
        lp[uvl].uv = uv[lp.vert]
    return f


def carved_box(bm, uvl, x0, x1, y0, y1, z0, z1):
    """a lower panel's box (item 421): its two broad faces the carving's picture whole across them (the street one as drawn, the shop's one
    turned about so it reads the same from in there), its narrow sides a corner of it (the bead's plain wood)"""
    vs = [bm.verts.new(P(x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    idx = lambda i, j, k: vs[i * 4 + j * 2 + k]
    faces = [
        ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)),
        ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)),
        ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),
    ]
    for f in faces:
        face = bm.faces.new([idx(*c) for c in f])
        broad = all(c[2] == f[0][2] for c in f)
        for lp, c in zip(face.loops, f):
            if broad:
                uu = c[0] if f[0][2] == 1 else 1 - c[0]
                lp[uvl].uv = (float(uu), float(c[1]))
            else:
                lp[uvl].uv = (0.015, 0.015)


def mesh_of(name, builds):
    """an object of its parts, each its own material: `builds` a list of (the material's key, its builder); the boxes' normals put right,
    the flat faces (glass, the lattice, the brass, the band) as they're made"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    keys = []
    for key, build in builds:
        n0 = len(bm.faces)
        build(bm, uvl)
        bm.faces.ensure_lookup_table()
        if len(bm.faces) == n0:
            continue
        if key not in keys:
            keys.append(key)
        for i in range(n0, len(bm.faces)):
            bm.faces[i].material_index = keys.index(key)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if keys[f.material_index] not in FLAT])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for key in keys:
        o.data.materials.append(M[key])
    parts.append(o)
    return o


def leaf(name, xa, xb, za, zb, meet):
    """one leaf: its frame, its panel, its glass and the slats on the glass's street side, their cross rail; its pull on both faces at the
    stile where it meets the other (`meet`: -1 its south one, 1 its north one)"""
    zm = (za + zb) / 2
    y0, y1 = LEAF_Y

    def wood(bm, uvl):
        box(bm, uvl, xa, xa + STILE, y0, y1, za, zb, "y")
        box(bm, uvl, xb - STILE, xb, y0, y1, za, zb, "y")
        box(bm, uvl, xa + STILE, xb - STILE, y1 - TOP_RAIL, y1, za, zb, "x")
        box(bm, uvl, xa + STILE, xb - STILE, y0, y0 + BOTTOM_RAIL, za, zb, "x")
        box(bm, uvl, xa + STILE, xb - STILE, MID_Y, MID_Y + MID_RAIL, za, zb, "x")
        # (the slats over the glass, on its street side: evenly across between the stiles)
        inner = (xb - STILE) - (xa + STILE)
        n = max(1, int(round(inner / SLAT_GAP)) - 1)
        for k in range(n):
            cx = xa + STILE + inner * (k + 1) / (n + 1)
            box(bm, uvl, cx - SLAT_W / 2, cx + SLAT_W / 2, MID_Y + MID_RAIL - 0.002, y1 - TOP_RAIL + 0.002, zm + 0.0015, zb - 0.001, "y")
        # (the cross rail over the slats, a little proud of them on the street side)
        cy = MID_Y + MID_RAIL + (y1 - TOP_RAIL - MID_Y - MID_RAIL) * CROSS_K
        box(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, cy - CROSS_H / 2, cy + CROSS_H / 2, zm + 0.001, zb - 0.0005, "x")

    def carve(bm, uvl):
        # (the panel under the middle rail, set in from both faces: carved, item 421)
        carved_box(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, y0 + BOTTOM_RAIL - 0.002, MID_Y + 0.002, zm - 0.004, zm + 0.004)

    def glass(bm, uvl):
        glass_quad(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, MID_Y + MID_RAIL - 0.002, y1 - TOP_RAIL + 0.002, zm)

    def brass(bm, uvl):
        # (a brass fitting on each corner, both faces, a little proud: from just over the track to just under the lintel, their arms along the
        # stile and the rail; the picture's L turned to each corner)
        S, yb, yt = BRASS_S, TRACK_Y[1] + 0.006, LINTEL_Y[0] - 0.006
        for (cx0, cy0, fu, fv) in ((xa, yb, 0, 0), (xb - S, yb, 1, 0), (xa, yt - S, 0, 1), (xb - S, yt - S, 1, 1)):
            for z, out in ((zb + 0.0012, (0, 0, 1)), (za - 0.0012, (0, 0, -1))):
                pts = [(cx0, cy0, z), (cx0 + S, cy0, z), (cx0 + S, cy0 + S, z), (cx0, cy0 + S, z)]
                uvs = [(abs(fu - a), abs(fv - b)) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))]
                quad_uv(bm, uvl, pts, uvs, out)

    def pull(bm, uvl):
        # (on the meeting stile's middle, both faces, a millimetre proud of the wood)
        w, h, cy = PULL
        cx = (xb - STILE / 2) if meet > 0 else (xa + STILE / 2)
        box(bm, uvl, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, zb - 0.001, zb + 0.001, "y")
        box(bm, uvl, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, za - 0.001, za + 0.001, "y")

    return mesh_of(name, [("wood", wood), ("carve", carve), ("glass", glass), ("pull", pull), ("brass", brass)])


# --- the leaves --------------------------------------------------------------------------------------------------
leaves = [leaf("GenkanDoorS", *LEAF_X[0], *TRACK_Z[0], 1), leaf("GenkanDoorN", *LEAF_X[1], *TRACK_Z[1], -1)]
print("GENKANDOOR_LEAVES", W_LEAF, LEAF_X, "open way", LEAF_X[0][1], X_WALL - 0.001)


# --- the frame: the track, the lintel, the transom and its head rail, the north jamb -------------------------------
def frame_wood(bm, uvl):
    box(bm, uvl, X_POST, X_WALL - 0.001, TRACK_Y[0], TRACK_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    box(bm, uvl, X_S, X_WALL - 0.001, LINTEL_Y[0], LINTEL_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    # (the transom's frame: its two ends; its lattice (組子) over the glass's street side, kumiko below (item 421: plain slats before))
    tz = (0.392, 0.425)
    box(bm, uvl, X_S, X_S + STILE, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    box(bm, uvl, X_WALL - 0.001 - STILE, X_WALL - 0.001, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    # (its head rail, from the transom back into the beam's front (z 0.34), under the beam's foot)
    box(bm, uvl, X_S, X_WALL - 0.001, HEAD_Y[0], HEAD_Y[1], 0.338, 0.43, "x")
    # (the jamb (縦枠) at the north end, the north leaf shut against it, out to the room's wall: item 419, the owner's 「這個門沒密合」, a slot
    # 7 cm wide from the sill to the head between the shut leaf (x 0.429) and the wall's face (0.498), the shoe cupboard seen through it at
    # its foot. Measured in the game (tests/e2e/_doorbox419.mjs): notched round the wall's chair rail (y 0.825 to 0.875, out to x 0.453) and
    # its nageshi (1.977 to 2.003, out to 0.473), which run out to the door's line; over the nageshi the plaster's face is 4 mm nearer (0.494);
    # up to the wall's band over the door (from y 2.2))
    for y0, y1, x1 in JAMB:
        box(bm, uvl, X_WALL, x1, y0, y1, FRAME_Z[0], FRAME_Z[1], "y")


def frame_glass(bm, uvl):
    glass_quad(bm, uvl, X_S + STILE - 0.002, X_WALL - 0.001 - STILE + 0.002, TRANSOM_Y[0], TRANSOM_Y[1], 0.408)


def frame_kumiko(bm, uvl):
    """the transom's hemp-leaf lattice (item 421): one face, cut out by its picture, between the glass and the frame's street face"""
    x0, x1, y0, y1, z = X_S + STILE - 0.001, X_WALL - 0.001 - STILE + 0.001, TRANSOM_Y[0], TRANSOM_Y[1], 0.4168
    quad_uv(bm, uvl, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 0), (1, 0), (1, 1), (0, 1)], (0, 0, 1))


def frame_band(bm, uvl):
    """the lintel's street face carved (item 421): one face of its picture, a hair proud, over the leaves' tops to the transom"""
    x0, x1, y0, y1, z = X_S, X_WALL - 0.001, 1.976, LINTEL_Y[1] - 0.001, FRAME_Z[1] + 0.0012
    quad_uv(bm, uvl, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 0), (1, 0), (1, 1), (0, 1)], (0, 0, 1))


frame = mesh_of("GenkanDoorFrame", [("wood", frame_wood), ("band", frame_band), ("kumiko", frame_kumiko), ("glass", frame_glass)])

root = bpy.data.objects.new("GenkanDoor", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("GENKANDOOR_TRIS", sum(len(o.data.polygons) for o in parts), {o.name: len(o.data.polygons) for o in parts})
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "genkandoor.glb"), os.path.join(PROJECT, "blender", "genkandoor.blend"), PREVIEW)
print("GENKANDOOR_DONE")
