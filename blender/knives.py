"""The cook's knives, hung upright on a knife rack on the table's face under the hearth (knives.glb, node "KnifeSet"), as a Japanese
kitchen keeps them (包丁差し): a board of pale hinoki screwed to the face, a rail of dark walnut across its top standing off it on two
blocks, and the knives hung through the gap between them, their ferrules resting on the rail, handles up, blades down in front of the
board, their faces out toward the cook (the bevel side, omote) and their edges all to the left; longest to shortest:
- yanagiba (柳刃), 270 mm: long and slender, single-bevel, for slicing;
- gyuto (牛刀), 210 mm: double-bevel, its body Damascus (layers of steel folded and etched, flowing lines) above a bright polished edge,
  an ebony handle with a white horn ferrule and a nickel spacer;
- usuba (薄刃), 180 mm: thin and rectangular, its end square, for vegetables;
- deba (出刃), 165 mm: short, broad and heavy, a strong belly, for taking a fish apart.
The single-bevel blades are ground as they are: the back (ura) flat; the front its flat face (hira) down to the bevel line (shinogi),
crisp and bright, and from there the bevel (kireha) to the edge, its soft iron hazed (kasumi) above the bright hard steel along the edge,
the line between them wavering; a short taper toward the tip. Each has its maker's mark (銘, 正本) cut near the heel below the rail. The
handles are octagonal ho wood (pale magnolia) with black buffalo-horn ferrules, eased at their edges.
Real size in metres: x along the board (the cook's left to right), z up, the board's back at y = 0 against the face, everything out toward
-y (the game's +z, toward the cook); the board's middle at the origin.

Run:
    blender -b --factory-startup --python blender/knives.py -- <project path> [preview.png]
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
seed(11)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 512
u, v = grid01(N)
# ---- the pictures. A blade's: u along it from the heel (0) to the tip (1), v across it from the edge (0) to the spine (1).
# (single-bevel steel: the bevel below SH, its hazed soft iron above the bright hard steel along the edge, the line between them
# wavering; the bevel line itself a crisp bright line with a thin dark one just above; the flat face brushed along its length, darker
# toward the spine)
SH = 0.3
brush = 0.9 + 0.1 * fbm(N, 2, 120, 3)
haze = fbm(N, 10, 6, 4)
wave = 0.1 + 0.022 * np.sin(u * 2 * np.pi * 7 + fbm(N, 5, 2, 3) * 4) + 0.007 * np.sin(u * 2 * np.pi * 23)
hard = smooth(wave + 0.008, wave - 0.008, v)
kasumi = mix((0.6, 0.61, 0.63), (0.76, 0.77, 0.79), haze)
bevel_face = mix(kasumi, (0.94, 0.95, 0.97), hard)
hira = np.stack([0.62 * brush, 0.64 * brush, 0.68 * brush], -1)
hira = mix(hira, (0.42, 0.43, 0.46), smooth(0.86, 1.0, v) * 0.6)
steel = np.where((v < SH)[..., None], bevel_face, hira)
steel = mix(steel, (0.98, 0.98, 1.0), smooth(0.007, 0.0, np.abs(v - SH)))
steel = mix(steel, (0.3, 0.31, 0.33), smooth(0.006, 0.0, np.abs(v - SH - 0.013)) * 0.55)
steel = mix(steel, (1.0, 1.0, 1.0), smooth(0.014, 0.0, v) * 0.7)
# (Damascus: layers folded and etched into flowing contour lines, light and dark, over the body; a narrow bright bevel at the edge)
flow = v * 9 + 1.1 * fbm(N, 3, 4, 4) + 0.3 * np.sin(u * 2 * np.pi * 2.5)
layers = 0.5 + 0.5 * np.sin(flow * 2 * np.pi * 3.2)
fine = 0.5 + 0.5 * np.sin(flow * 2 * np.pi * 9.5 + 1.3)
dam = mix((0.5, 0.51, 0.54), (0.76, 0.77, 0.8), smooth(0.2, 0.8, layers) * 0.75 + fine * 0.25)
dam = mix(dam, (0.92, 0.93, 0.95), smooth(0.11, 0.08, v))
dam = mix(dam, (1.0, 1.0, 1.0), smooth(0.02, 0.0, v) * 0.6)
dam = mix(dam, (0.34, 0.35, 0.38), smooth(0.9, 1.0, v) * 0.5)
# (the handles: ho wood, pale greenish cream with a fine straight grain along it; ebony, near black with faint streaks; white horn,
# cream marbled grey; v along the handle)
hgrain = np.sin((u + (fbm(N, 2, 8, 3) - 0.5) * 0.05) * 2 * np.pi * 40) * 0.5 + 0.5
ho = mix((0.84, 0.79, 0.63), (0.72, 0.66, 0.5), smooth(0.6, 1.0, hgrain) * 0.5)
ebony = mix((0.07, 0.055, 0.045), (0.2, 0.15, 0.11), smooth(0.7, 1.0, hgrain) * 0.6 + fbm(N, 3, 12, 3) * 0.15)
horn = mix((0.86, 0.83, 0.76), (0.56, 0.54, 0.52), smooth(0.55, 0.8, fbm(N, 3, 14, 4)) * 0.7)
# (the board: hinoki, pale and close-grained, the grain running up it, a growth ring or two showing; the rail: walnut, its grain along it)
bgrain = np.sin((u * 46 + fbm(N, 3, 2, 4) * 1.6) * 2 * np.pi) * 0.5 + 0.5
board = mix((0.9, 0.8, 0.62), (0.8, 0.67, 0.48), smooth(0.75, 1.0, bgrain) * 0.55 + fbm(N, 4, 4, 4) * 0.12)
rgrain = np.sin((v * 30 + fbm(N, 2, 3, 4) * 1.4) * 2 * np.pi) * 0.5 + 0.5
rail = mix((0.34, 0.21, 0.13), (0.22, 0.13, 0.08), smooth(0.6, 1.0, rgrain) * 0.7)
M = {
    "steel": pbr("KnifeSteel", (1, 1, 1), tex=image("knife_steel", steel.astype(np.float32)), rough=0.28, metal=0.7),
    "damascus": pbr("KnifeSteelDamascus", (1, 1, 1), tex=image("knife_damascus", dam.astype(np.float32)), rough=0.3, metal=0.7),
    "tang": pbr("KnifeNeckSteel", lin("#5a5c60"), rough=0.4, metal=0.8),
    "ho": pbr("KnifeHandleHo", (1, 1, 1), tex=image("knife_ho", ho.astype(np.float32)), rough=0.55),
    "ebony": pbr("KnifeHandleEbony", (1, 1, 1), tex=image("knife_ebony", ebony.astype(np.float32)), rough=0.35),
    "horn": pbr("KnifeHorn", lin("#141110"), rough=0.3),
    "hornWhite": pbr("KnifeHornWhite", (1, 1, 1), tex=image("knife_horn", horn.astype(np.float32)), rough=0.3),
    "silver": pbr("KnifeSilver", lin("#c9ccd0"), rough=0.25, metal=1.0),
    "mark": pbr("KnifeMark", lin("#1e1c1b"), rough=0.6),
    "board": pbr("KnifeBoard", (1, 1, 1), tex=image("knife_board", board.astype(np.float32)), rough=0.6),
    "rail": pbr("KnifeRail", (1, 1, 1), tex=image("knife_rail", rail.astype(np.float32)), rough=0.4, coat=0.3),
    "screw": pbr("KnifeScrew", lin("#c9a24a"), rough=0.3, metal=1.0),
}
parts = []


def fin(o, name, mat, smooth_shade=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth_shade
    parts.append(o)
    return o


def from_bm(name, bm, mat, smooth_shade=False):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return fin(o, name, mat, smooth_shade)


def interp(pts, x):
    """a curve through (x, y) points, eased between them"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            t = t * t * (3 - 2 * t)
            return y0 + (y1 - y0) * t
    return pts[-1][1]


# ---- the rack: the board's front at y = -BD; the rail standing off it, its top at RAIL_TOP; the blades hang in the gap between
BW, BD, B_BOT = 0.44, 0.012, -0.145
RAIL_TOP, RAIL_H, GAP, RAIL_D = 0.15, 0.024, 0.012, 0.02
BLADE_Y = -BD - 0.0006                  # each blade's back (its flat ura), just off the board
HEEL_Z = RAIL_TOP - 0.003               # the top of each blade's heel, under the rail's top (the tang runs up from it into the ferrule)


class Knife:
    def __init__(self, name, x0, length, edge, spine, thick, bevel, double, steel, handle_mat, ferrule_mat, handle_len, r, spacer=False):
        self.__dict__.update(locals())


def place(k, x_along, w, t):
    """a point of knife k from its own terms (x along the blade from the heel down, w across from the edge toward the spine, t out of
    its back toward the cook) into the rack's"""
    return Vector((k.x0 + w, BLADE_Y - t, HEEL_Z - x_along))


def thickness(k, x):
    """how thick the blade is at x along it: full at the heel, thinning toward the tip"""
    return k.thick * (1 - 0.7 * (x / k.length) ** 2)


def blade(k):
    """the blade: a grid along it (NX steps) and across it at three lines (the edge, the bevel line, the spine), its front and back faces,
    the edge's and the spine's narrow faces, the heel's end; closing to one point at the tip"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    NX = 30
    rows = (0.0, k.bevel, 1.0)
    rows_v = (0.0, 0.1 if k.double else SH, 1.0)
    front, back = [], []
    tip = None
    for i in range(NX + 1):
        x = k.length * i / NX
        if i == NX:
            tip = tip or bm.verts.new(place(k, x, interp(k.edge, x), 0.0))
            front.append([tip] * 3)
            back.append([tip] * 3)
            continue
        e, s = interp(k.edge, x), interp(k.spine, x)
        T = thickness(k, x)
        fr, bk = [], []
        for j, f in enumerate(rows):
            w = e + (s - e) * f
            if k.double:
                tf = (0.0001, T / 2, T * 0.46)[j]
                fr.append(bm.verts.new(place(k, x, w, T / 2 + tf)))
                bk.append(bm.verts.new(place(k, x, w, T / 2 - tf)))
            else:
                tf = (0.0002, T, T * 0.93)[j]
                fr.append(bm.verts.new(place(k, x, w, tf)))
                bk.append(bm.verts.new(place(k, x, w, 0.0)))
        front.append(fr)
        back.append(bk)

    def face(vs, uvs):
        keep = []
        for vert, uv in zip(vs, uvs):
            if all(vert is not q for q, _ in keep):
                keep.append((vert, uv))
        if len(keep) < 3:
            return
        try:
            fc = bm.faces.new([q for q, _ in keep])
        except ValueError:
            return
        for loop, (_, uv) in zip(fc.loops, keep):
            loop[uvl].uv = uv
    for i in range(NX):
        u0, u1 = i / NX, (i + 1) / NX
        for j in range(2):
            v0, v1 = rows_v[j], rows_v[j + 1]
            face((front[i][j], front[i + 1][j], front[i + 1][j + 1], front[i][j + 1]), ((u0, v0), (u1, v0), (u1, v1), (u0, v1)))
            face((back[i][j + 1], back[i + 1][j + 1], back[i + 1][j], back[i][j]), ((u0, v1), (u1, v1), (u1, v0), (u0, v0)))
        # (the edge's hairline face and the spine's narrow one)
        face((front[i][0], back[i][0], back[i + 1][0], front[i + 1][0]), ((u0, 0.0), (u0, 0.0), (u1, 0.0), (u1, 0.0)))
        face((front[i + 1][2], back[i + 1][2], back[i][2], front[i][2]), ((u1, 1.0), (u1, 1.0), (u0, 1.0), (u0, 1.0)))
    # (the heel's end)
    face((back[0][0], back[0][1], back[0][2], front[0][2], front[0][1], front[0][0]), ((0, 0), (0, 0.3), (0, 1), (0, 1), (0, 0.3), (0, 0)))
    return from_bm(k.name, bm, k.steel)


def octagon(name, cx, cy, z0, z1, r0, r1, mat, squash=0.86, grain=True):
    """an octagonal piece standing from z0 to z1 about (cx, cy), r0 across at its foot and r1 at its top, a little narrower front to back
    (squash), its edges eased; its picture's grain running up it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for z, r in ((z0, r0), (z1, r1)):
        rings.append([bm.verts.new((cx + r * math.cos(math.pi / 8 + k * math.pi / 4), cy + squash * r * math.sin(math.pi / 8 + k * math.pi / 4), z))
                      for k in range(8)])
    for k in range(8):
        k2 = (k + 1) % 8
        fc = bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
        for loop, (uu, vv) in zip(fc.loops, ((k / 8, 0), ((k + 1) / 8, 0), ((k + 1) / 8, 1), (k / 8, 1))):
            loop[uvl].uv = (uu, vv * (z1 - z0) * 4) if grain else (uu, vv)
    for ring in rings:
        fc = bm.faces.new(ring)
        for loop in fc.loops:
            loop[uvl].uv = (0.5, 0.5)
    o = from_bm(name, bm, mat)
    bev = bevel(o, min(0.0009, r0 * 0.08), 2, angle=False)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=bev.name)
    return o


def handle(k):
    """the knife's handle above its ferrule, standing on the rail: centred over its tang (toward the spine), in the blade's middle"""
    w0 = interp(k.spine, 0.0)
    cx, cy = k.x0 + w0 * 0.6, BLADE_Y - k.thick / 2
    fl = 0.024
    octagon(k.name + "Ferrule", cx, cy, RAIL_TOP, RAIL_TOP + fl, k.r * 0.9, k.r * 0.92, k.ferrule_mat, grain=False)
    z = RAIL_TOP + fl
    if k.spacer:
        octagon(k.name + "Spacer", cx, cy, z, z + 0.0022, k.r * 0.925, k.r * 0.93, M["silver"], grain=False)
        z += 0.0022
    octagon(k.name + "Handle", cx, cy, z, RAIL_TOP + fl + k.handle_len, k.r * 0.93, k.r, k.handle_mat)
    # (the tang's neck, between the blade's heel and the ferrule: a short square of steel, mostly behind the rail)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, (HEEL_Z + RAIL_TOP) / 2 + 0.0005))
    nk = bpy.context.view_layer.objects.active
    nk.scale = (w0 * 0.42, k.thick * 0.85, RAIL_TOP - HEEL_Z + 0.004)
    fin(nk, k.name + "Neck", M["tang"], smooth_shade=False)


# (the maker's mark, 正本, cut into the flat face near the heel, toward the spine: strokes in a character's own square (0..1 across from
# its left, 0..1 down from its top), the characters one under the other down the blade)
GLYPHS = [
    [((0.12, 0.1), (0.88, 0.1)), ((0.5, 0.1), (0.5, 0.9)), ((0.5, 0.5), (0.82, 0.5)), ((0.24, 0.45), (0.24, 0.9)), ((0.06, 0.9), (0.94, 0.9))],
    [((0.1, 0.3), (0.9, 0.3)), ((0.5, 0.04), (0.5, 0.96)), ((0.47, 0.34), (0.1, 0.76)), ((0.53, 0.34), (0.9, 0.76)), ((0.3, 0.76), (0.7, 0.76))],
]


def mark(k):
    size, gap, at_x = 0.0062, 0.0016, 0.032
    w_c = interp(k.spine, at_x) * 0.66
    bm = bmesh.new()
    for n, strokes in enumerate(GLYPHS):
        top = at_x + n * (size + gap)
        for (a, b) in strokes:
            pa = (w_c + (a[0] - 0.5) * size, top + a[1] * size)
            pb = (w_c + (b[0] - 0.5) * size, top + b[1] * size)
            d = Vector((pb[0] - pa[0], pb[1] - pa[1]))
            if d.length < 1e-6:
                continue
            nrm = Vector((-d.y, d.x)).normalized() * 0.00034
            quad = []
            for (w, xa) in ((pa[0] + nrm.x, pa[1] + nrm.y), (pb[0] + nrm.x, pb[1] + nrm.y), (pb[0] - nrm.x, pb[1] - nrm.y), (pa[0] - nrm.x, pa[1] - nrm.y)):
                t = (thickness(k, xa) / 2 + thickness(k, xa) * 0.46 if k.double else thickness(k, xa) * 0.975) + 0.00022
                quad.append(bm.verts.new(place(k, xa, w, t)))
            bm.faces.new(quad)
    return from_bm(k.name + "Mark", bm, M["mark"])


KNIVES = [
    # (yanagiba: its edge straight, the spine sweeping down to a fine point near the edge)
    Knife("KnifeYanagiba", -0.19, 0.27, [(0, 0), (0.22, 0.0), (0.27, 0.004)], [(0, 0.033), (0.2, 0.032), (0.25, 0.02), (0.27, 0.004)],
          0.0036, 0.32, False, M["steel"], M["ho"], M["horn"], 0.135, 0.0125),
    # (gyuto: a gentle belly rising to the point, the spine straight then dropping to it)
    Knife("KnifeGyuto", -0.089, 0.21, [(0, 0), (0.14, 0.001), (0.19, 0.01), (0.21, 0.03)], [(0, 0.046), (0.15, 0.044), (0.2, 0.036), (0.21, 0.03)],
          0.0024, 0.14, True, M["damascus"], M["ebony"], M["hornWhite"], 0.13, 0.0125, spacer=True),
    # (usuba: edge and spine straight and parallel, its end square, the corner just eased)
    Knife("KnifeUsuba", 0.025, 0.18, [(0, 0), (0.172, 0.0), (0.18, 0.006)], [(0, 0.046), (0.18, 0.046), (0.1801, 0.006)],
          0.0034, 0.22, False, M["steel"], M["ho"], M["horn"], 0.125, 0.0125),
    # (deba: a strong belly curving up to the point, a thick spine)
    Knife("KnifeDeba", 0.139, 0.165, [(0, 0), (0.07, -0.001), (0.12, 0.005), (0.15, 0.018), (0.165, 0.034)],
          [(0, 0.05), (0.08, 0.051), (0.14, 0.046), (0.165, 0.034)], 0.0072, 0.4, False, M["steel"], M["ho"], M["horn"], 0.12, 0.0155),
]
for k in KNIVES:
    blade(k)
    handle(k)
    mark(k)

# ---- the board: hinoki, its face eased at its edges, screwed to the face at its corners; the rail across its top on two blocks
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -BD / 2, (B_BOT + RAIL_TOP) / 2))
o = bpy.context.view_layer.objects.active
o.scale = (BW, BD, RAIL_TOP - B_BOT)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bev = bevel(o, 0.0025, 2, angle=False)
bpy.ops.object.modifier_apply(modifier=bev.name)


def flat_uv(o, axis_u, axis_v, size_u, size_v):
    """every face's picture laid flat from the front: u along axis_u, v along axis_v, over size_u x size_v"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for loop in f.loops:
            c = loop.vert.co
            loop[uvl].uv = (c[axis_u] / size_u + 0.5, c[axis_v] / size_v + 0.5)
    bm.to_mesh(o.data)
    bm.free()


flat_uv(o, 0, 2, BW, RAIL_TOP - B_BOT)
fin(o, "KnifeBoard", M["board"], smooth_shade=False)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -BD - GAP - RAIL_D / 2, RAIL_TOP - RAIL_H / 2))
o = bpy.context.view_layer.objects.active
o.scale = (BW, RAIL_D, RAIL_H)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bev = bevel(o, 0.003, 2, angle=False)
bpy.ops.object.modifier_apply(modifier=bev.name)
flat_uv(o, 0, 2, BW, RAIL_H * 8)
fin(o, "KnifeRail", M["rail"], smooth_shade=False)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * (BW / 2 - 0.012), -BD - GAP / 2, RAIL_TOP - RAIL_H / 2))
    o = bpy.context.view_layer.objects.active
    o.scale = (0.024, GAP, RAIL_H)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    flat_uv(o, 0, 2, BW, RAIL_H * 8)
    fin(o, f"KnifeRailBlock{sx}", M["rail"], smooth_shade=False)
# (brass screws: two through the rail's ends, two at the board's foot)
for x, y, z in ((-(BW / 2 - 0.012), -BD - GAP - RAIL_D, RAIL_TOP - RAIL_H / 2), ((BW / 2 - 0.012), -BD - GAP - RAIL_D, RAIL_TOP - RAIL_H / 2),
                (-(BW / 2 - 0.016), -BD, B_BOT + 0.016), ((BW / 2 - 0.016), -BD, B_BOT + 0.016)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.0042, depth=0.003, location=(x, y - 0.0012, z), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.view_layer.objects.active
    fin(o, "KnifeScrew", M["screw"], smooth_shade=False)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y - 0.0029, z))
    o = bpy.context.view_layer.objects.active
    o.scale = (0.0058, 0.0004, 0.0009)
    o.rotation_euler = (0, 0.5, 0)
    fin(o, "KnifeScrewSlot", M["mark"], smooth_shade=False)

root = bpy.data.objects.new("KnifeSet", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
tris = 0
for o in parts:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
print("KNIVES_TRIS", tris)
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    at = Vector(map(float, os.environ.get("PREVIEW_AT", "0,0,0.06").split(",")))
    cam.location = Vector(map(float, os.environ.get("PREVIEW_CAM", "0.1,-0.85,0.25").split(",")))
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (at - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = float(os.environ.get("PREVIEW_LENS", "50"))
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (1.0, 0.0, 0.5)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "knives.glb"), os.path.join(PROJECT, "blender", "knives.blend"), PREVIEW)
print("KNIVES_DONE", len(parts))
