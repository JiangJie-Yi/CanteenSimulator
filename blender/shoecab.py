"""The genkan's shoe cupboard (下駄箱), as a ryotei's or an izakaya's is (the owner's: low, broad and solid, not a tall narrow cupboard of
paper panes with brass knobs): shoecab.glb.

A low, long cabinet of walnut on a recessed plinth, its top board overhanging a little all round (a vase stands on it); inside, two
rows of four empty cubbies (the owner's, 2026-11-09: lower and longer than the three by three it was, a third lower, one cubby to each of
the eight places; the guests' own shoes go in them); each one's door a fine frame with a kumiko lattice (two uprights, two rails) over washi,
a little bronze ring pull at the top of its free edge. Every piece a plain box (no subdivisions) but the rings, the faces against the
floor, the wall and each other left off.

Nodes the game finds: "ShoeCab" (the carcass and what's inside, still), "ShoeDoorL<k>" / "ShoeDoorR<k>" (each door, hinged on its left or
right edge, its origin on its hinge: the game swings it open 75 degrees), numbered row by row from the bottom left.

The game's frame (y up), the foot's middle at the origin, the front toward +z, x across it.

Run:
    blender -b --factory-startup --python blender/shoecab.py -- <project path> [preview.png]
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(h):
    """a colour as written (#rrggbb, sRGB) into the linear values the material takes"""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


W, D, H = 0.9, 0.4, 0.56          # across, deep, tall (top board included): long and low (the owner's)
T = 0.022                          # the carcass's boards
PLINTH = 0.06                     # the recessed plinth's height
TOP = 0.035                        # the top board, overhanging
M = {
    # (a deep walnut, matt (the owner's: roughness 0.85); the lattice a shade lighter, the washi behind it pale)
    "wood": pbr("ShoeWood", lin("#5a3a22"), rough=0.85),
    "top": pbr("ShoeTop", lin("#4a2e18"), rough=0.85),
    "slat": pbr("ShoeSlat", lin("#6a4428"), rough=0.85),
    "ring": pbr("ShoeRing", lin("#9a6a34"), rough=0.4),
    "paper": pbr("ShoePaper", lin("#efe6d0"), rough=0.9),
    "back": pbr("ShoeBack", lin("#1c120c"), rough=0.8),
    "inside": pbr("ShoeInside", lin("#2e2016"), rough=0.8),
    "pull": pbr("ShoePull", lin("#141010"), rough=0.4),
}


def box(name, x0, x1, y0, y1, z0, z1, mat, drop=()):
    """a box from (x0, y0, z0) to (x1, y1, z1) in the game's frame; `drop`: which of its faces to leave off ('-y' its bottom, '+z' its front...)"""
    bm = bmesh.new()
    vs = {}
    for ix, x in enumerate((x0, x1)):
        for iy, y in enumerate((y0, y1)):
            for iz, z in enumerate((z0, z1)):
                vs[ix, iy, iz] = bm.verts.new(P(x, y, z))
    faces = {
        '-x': [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)], '+x': [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
        '-y': [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)], '+y': [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
        '-z': [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)], '+z': [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    }
    for k, f in faces.items():
        if k not in drop:
            bm.faces.new([vs[c] for c in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for pg in o.data.polygons:
        pg.use_smooth = False
    return o


carcass = []
x0, x1 = -W / 2, W / 2
z0, z1 = -D / 2, D / 2
y_in0, y_in1 = PLINTH + T, H - TOP          # the compartments' floor and ceiling
# (three columns and three rows of empty cubbies, for the guests' own shoes (the owner's: nothing in them, and more of them))
COLS, ROWS = 4, 2
xs = [x0 + T + (W - 2 * T + T) * c / COLS - (T / 2 if c else 0) for c in range(COLS + 1)]
xs[-1] = x1 - T
ys = [y_in0 + (y_in1 - y_in0 + T) * r / ROWS - (T / 2 if r else 0) for r in range(ROWS + 1)]
ys[-1] = y_in1
# (each cubby's span: from past one divider (or the side) to the next divider (or the other side))
cells_x = [(xs[c] + (T / 2 if c else 0), xs[c + 1] - (T / 2 if c + 1 < COLS else 0)) for c in range(COLS)]
cells_y = [(ys[r] + (T / 2 if r else 0), ys[r + 1] - (T / 2 if r + 1 < ROWS else 0)) for r in range(ROWS)]
# (the plinth, set back; the sides; the floor; the top, overhanging; the back; the dividers; the shelves)
carcass.append(box("Plinth", x0 + 0.02, x1 - 0.02, 0, PLINTH, z0 + 0.01, z1 - 0.03, "back", drop=('-y', '-z')))
carcass.append(box("SideL", x0, x0 + T, PLINTH, H - TOP, z0, z1, "wood", drop=('-y', '+y', '-z')))
carcass.append(box("SideR", x1 - T, x1, PLINTH, H - TOP, z0, z1, "wood", drop=('-y', '+y', '-z')))
carcass.append(box("Floor", x0 + T, x1 - T, PLINTH, y_in0, z0, z1, "wood", drop=('-y', '-x', '+x', '-z')))
carcass.append(box("Top", x0 - 0.015, x1 + 0.015, H - TOP, H, z0, z1 + 0.018, "top", drop=('-z',)))
carcass.append(box("Back", x0 + T, x1 - T, y_in0, y_in1, z0, z0 + 0.008, "inside", drop=('-z', '-x', '+x', '-y', '+y')))
for c in range(1, COLS):
    carcass.append(box("Divider", xs[c] - T / 2, xs[c] + T / 2, y_in0, y_in1, z0 + 0.008, z1, "wood", drop=('-y', '+y', '-z')))
for r in range(1, ROWS):
    for sx0, sx1 in cells_x:
        carcass.append(box("Shelf", sx0, sx1, ys[r] - T / 2, ys[r] + T / 2, z0 + 0.008, z1, "wood", drop=('-x', '+x', '-z')))
cab = join(carcass, "ShoeCab")

# (the doors: each a frame of stiles and rails, louvres across it over a dark backing, a sunk pull at its free edge; its origin on its hinge)
doors = []
ZD = z1                           # the doors' back face, on the carcass's front
DT = 0.02                        # a door's thickness
CELLS = [(c, r) for r in range(ROWS) for c in range(COLS)]
for k, (col, row) in enumerate(CELLS):
    (cx0, cx1), (cy0, cy1) = cells_x[col], cells_y[row]
    g = 0.002                      # (the gap round each door)
    a0, a1, b0, b1 = cx0 + g, cx1 - g, cy0 + g, cy1 - g
    hinge_left = col < COLS - 1    # (the right column hinges on the right, the others on the left: none swings into the next one open)
    parts = []
    S = 0.016                      # the frame's width
    # (the washi, set in the frame; over it the kumiko: two uprights and three rails, proud of the paper (the owner's: the shoji face kept))
    parts.append(box("Washi", a0 + S, a1 - S, b0 + S, b1 - S, ZD + 0.004, ZD + 0.006, "paper", drop=('-z', '-x', '+x', '-y', '+y')))
    parts.append(box("StileL", a0, a0 + S, b0, b1, ZD, ZD + DT, "wood", drop=('-z',)))
    parts.append(box("StileR", a1 - S, a1, b0, b1, ZD, ZD + DT, "wood", drop=('-z',)))
    parts.append(box("RailB", a0 + S, a1 - S, b0, b0 + S, ZD, ZD + DT, "wood", drop=('-z', '-x', '+x')))
    parts.append(box("RailT", a0 + S, a1 - S, b1 - S, b1, ZD, ZD + DT, "wood", drop=('-z', '-x', '+x')))
    K = 0.005                      # a kumiko bar's width
    # (two uprights and two rails: a fine three-by-three lattice; the rails broken at the uprights)
    xs_k = [a0 + S + (a1 - a0 - 2 * S) * i / 3 for i in (1, 2)]
    for xk in xs_k:
        parts.append(box("Kumiko", xk - K / 2, xk + K / 2, b0 + S, b1 - S, ZD + 0.006, ZD + DT - 0.004, "slat", drop=('-z', '-y', '+y')))
    edges = [a0 + S] + [v for xk in xs_k for v in (xk - K / 2, xk + K / 2)] + [a1 - S]
    for i in (1, 2):
        y = b0 + S + (b1 - b0 - 2 * S) * i / 3
        for xa, xb in zip(edges[0::2], edges[1::2]):
            parts.append(box("Kumiko", xa, xb, y - K / 2, y + K / 2, ZD + 0.006, ZD + DT - 0.004, "slat", drop=('-z', '-x', '+x')))
    # (the pull: a small bronze ring hanging from a round plate, at the top of the free stile)
    px = (a1 - S / 2) if hinge_left else (a0 + S / 2)
    py = b1 - 0.03
    parts.append(box("Pull", px - 0.006, px + 0.006, py - 0.006, py + 0.006, ZD + DT, ZD + DT + 0.002, "ring", drop=('-z',)))
    bpy.ops.mesh.primitive_torus_add(major_segments=8, minor_segments=4, major_radius=0.009, minor_radius=0.0018,
                                     location=P(px, py - 0.008, ZD + DT + 0.004), rotation=(1.5708, 0, 0))
    ring = bpy.context.active_object
    ring.name = "Ring"
    ring.data.materials.append(M["ring"])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    parts.append(ring)
    d = join(parts, f"ShoeDoor{'L' if hinge_left else 'R'}{k}")
    # (its origin on its hinge: the outer edge's back corner)
    hx = a0 if hinge_left else a1
    pivot = P(hx, 0, ZD)
    for v in d.data.vertices:
        v.co -= Vector((pivot.x, pivot.y, 0))
    d.location = (pivot.x, pivot.y, 0)
    doors.append(d)

root = bpy.data.objects.new("ShoeCabinet", None)
bpy.context.collection.objects.link(root)
for o in [cab] + doors:
    o.parent = root
export_dish(root, [cab] + doors + [root], os.path.join(PROJECT, "public", "models", "shoecab.glb"), os.path.join(PROJECT, "blender", "shoecab.blend"), PREVIEW, ladder=False)
print("SHOECAB_TRIS", sum(len(p.vertices) - 2 for o in [cab] + doors for p in o.data.polygons))
