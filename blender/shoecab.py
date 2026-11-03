"""The genkan's shoe cupboard (下駄箱), as a ryotei's or an izakaya's is (the owner's: low, broad and solid, not a tall narrow cupboard of
paper panes with brass knobs): shoecab.glb.

A low cabinet of dark walnut on a recessed plinth, its top board overhanging a little (the kabuto and a vase stand on it); inside, two
columns of two compartments; each compartment's door a frame with horizontal louvres over a dark backing (the airing a shoe cupboard
wants), a sunk pull (引手) cut into its free edge; in each compartment a pair of geta or of slippers. Every piece a plain box (no
subdivisions), the faces against the floor, the wall and each other left off: some 500 triangles.

Nodes the game finds: "ShoeCab" (the carcass and what's inside, still), "ShoeDoor0".."ShoeDoor3" (each door, its origin on its hinge, the
outer edge: the game swings it open 75 degrees), "ShoeDoorRow" in their names' order: 0 bottom left, 1 bottom right, 2 top left, 3 top right.

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


W, D, H = 0.56, 0.34, 0.66        # across, deep, tall (top board included)
T = 0.02                          # the carcass's boards
PLINTH = 0.05                     # the recessed plinth's height
TOP = 0.03                        # the top board, overhanging
M = {
    "wood": pbr("ShoeWood", lin("#5a3a22"), rough=0.5),
    "top": pbr("ShoeTop", lin("#4a2e1c"), rough=0.45),
    "slat": pbr("ShoeSlat", lin("#6e4a2c"), rough=0.55),
    "back": pbr("ShoeBack", lin("#1c120c"), rough=0.8),
    "inside": pbr("ShoeInside", lin("#2e2016"), rough=0.8),
    "pull": pbr("ShoePull", lin("#141010"), rough=0.4),
    "geta": pbr("ShoeGeta", lin("#c9a878"), rough=0.6),
    "strap": pbr("ShoeStrap", lin("#a8302a"), rough=0.7),
    "slipper": pbr("ShoeSlipper", lin("#2c3e66"), rough=0.8),
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
xm, ym = 0.0, (y_in0 + y_in1) / 2           # the divider's and the middle shelf's places
# (the plinth, set back; the sides; the floor; the top, overhanging; the back; the divider; the middle shelf)
carcass.append(box("Plinth", x0 + 0.02, x1 - 0.02, 0, PLINTH, z0 + 0.01, z1 - 0.03, "back", drop=('-y', '-z')))
carcass.append(box("SideL", x0, x0 + T, PLINTH, H - TOP, z0, z1, "wood", drop=('-y', '+y', '-z')))
carcass.append(box("SideR", x1 - T, x1, PLINTH, H - TOP, z0, z1, "wood", drop=('-y', '+y', '-z')))
carcass.append(box("Floor", x0 + T, x1 - T, PLINTH, y_in0, z0, z1, "wood", drop=('-y', '-x', '+x', '-z')))
carcass.append(box("Top", x0 - 0.012, x1 + 0.012, H - TOP, H, z0, z1 + 0.015, "top", drop=('-z',)))
carcass.append(box("Back", x0 + T, x1 - T, y_in0, y_in1, z0, z0 + 0.008, "inside", drop=('-z', '-x', '+x', '-y', '+y')))
carcass.append(box("Divider", xm - T / 2, xm + T / 2, y_in0, y_in1, z0 + 0.008, z1, "wood", drop=('-y', '+y', '-z')))
for sx0, sx1 in ((x0 + T, xm - T / 2), (xm + T / 2, x1 - T)):
    carcass.append(box("Shelf", sx0, sx1, ym - T / 2, ym + T / 2, z0 + 0.008, z1, "wood", drop=('-x', '+x', '-z')))
# (in each compartment its footwear: geta (a pale board and a red thong) above, slippers (a navy sole and its band) below)
FX = [(x0 + T + xm - T / 2) / 2, (xm + T / 2 + x1 - T) / 2]
for row, y in ((0, y_in0), (1, ym + T / 2)):
    for cx in FX:
        for sd in (-1, 1):
            px = cx + sd * 0.055
            if row:
                carcass.append(box("Geta", px - 0.04, px + 0.04, y, y + 0.02, -0.11, 0.11, "geta", drop=('-y',)))
                carcass.append(box("GetaStrap", px - 0.006, px + 0.006, y + 0.02, y + 0.03, -0.02, 0.07, "strap", drop=('-y',)))
            else:
                carcass.append(box("Slipper", px - 0.042, px + 0.042, y, y + 0.012, -0.12, 0.12, "slipper", drop=('-y',)))
                carcass.append(box("SlipperBand", px - 0.044, px + 0.044, y + 0.012, y + 0.035, 0.0, 0.07, "slipper", drop=('-y', '-z')))
cab = join(carcass, "ShoeCab")

# (the doors: each a frame of stiles and rails, louvres across it over a dark backing, a sunk pull at its free edge; its origin on its hinge)
doors = []
ZD = z1                           # the doors' back face, on the carcass's front
DT = 0.016                        # a door's thickness
for k, (cx0, cx1, cy0, cy1) in enumerate([(x0 + T, xm - T / 2, y_in0, ym - T / 2), (xm + T / 2, x1 - T, y_in0, ym - T / 2),
                                          (x0 + T, xm - T / 2, ym + T / 2, y_in1), (xm + T / 2, x1 - T, ym + T / 2, y_in1)]):
    g = 0.002                      # (the gap round each door)
    a0, a1, b0, b1 = cx0 + g, cx1 - g, cy0 + g, cy1 - g
    hinge_left = k % 2 == 0        # (the left doors hinge on the left, the right on the right: they open outward from the middle)
    parts = []
    S = 0.022                      # the frame's width
    parts.append(box("Backing", a0 + S / 2, a1 - S / 2, b0 + S / 2, b1 - S / 2, ZD, ZD + 0.004, "back", drop=('-z', '-x', '+x', '-y', '+y')))
    parts.append(box("StileL", a0, a0 + S, b0, b1, ZD, ZD + DT, "wood", drop=('-z',)))
    parts.append(box("StileR", a1 - S, a1, b0, b1, ZD, ZD + DT, "wood", drop=('-z',)))
    parts.append(box("RailB", a0 + S, a1 - S, b0, b0 + S, ZD, ZD + DT, "wood", drop=('-z', '-x', '+x')))
    parts.append(box("RailT", a0 + S, a1 - S, b1 - S, b1, ZD, ZD + DT, "wood", drop=('-z', '-x', '+x')))
    n = 5
    for i in range(n):
        y = b0 + S + (b1 - b0 - 2 * S) * (i + 0.5) / n
        parts.append(box("Louvre", a0 + S, a1 - S, y - 0.009, y + 0.009, ZD + 0.004, ZD + DT - 0.003, "slat", drop=('-z', '-x', '+x')))
    # (the pull: a dark recess cut into the free stile, as a hikite is)
    px = (a1 - S / 2) if hinge_left else (a0 + S / 2)
    py = (b0 + b1) / 2
    parts.append(box("Pull", px - 0.006, px + 0.006, py - 0.03, py + 0.03, ZD + DT - 0.004, ZD + DT + 0.0005, "pull", drop=('-z',)))
    d = join(parts, f"ShoeDoor{k}")
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
