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


M = {
    "wood": pbr("GenkanDoorWood", (1, 1, 1), tex=image("genkan_door_wood", wood_picture()), rough=0.6),
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


def mesh_of(name, build_wood, build_glass=None, build_pull=None):
    """an object of its wood (and its glass, its pulls), each its own material"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    build_wood(bm, uvl)
    nw = len(bm.faces)
    if build_glass:
        build_glass(bm, uvl)
    ng = len(bm.faces)
    if build_pull:
        build_pull(bm, uvl)
    for i, f in enumerate(bm.faces):
        f.material_index = 0 if i < nw else 1 if i < ng else 2
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index != 1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["wood"])
    o.data.materials.append(M["glass"])
    if build_pull:
        o.data.materials.append(M["pull"])
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
        # (the panel under the middle rail, set in from both faces)
        box(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, y0 + BOTTOM_RAIL - 0.002, MID_Y + 0.002, zm - 0.004, zm + 0.004, "y")
        # (the slats over the glass, on its street side: evenly across between the stiles)
        inner = (xb - STILE) - (xa + STILE)
        n = max(1, int(round(inner / SLAT_GAP)) - 1)
        for k in range(n):
            cx = xa + STILE + inner * (k + 1) / (n + 1)
            box(bm, uvl, cx - SLAT_W / 2, cx + SLAT_W / 2, MID_Y + MID_RAIL - 0.002, y1 - TOP_RAIL + 0.002, zm + 0.0015, zb - 0.001, "y")
        # (the cross rail over the slats, a little proud of them on the street side)
        cy = MID_Y + MID_RAIL + (y1 - TOP_RAIL - MID_Y - MID_RAIL) * CROSS_K
        box(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, cy - CROSS_H / 2, cy + CROSS_H / 2, zm + 0.001, zb - 0.0005, "x")

    def glass(bm, uvl):
        glass_quad(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, MID_Y + MID_RAIL - 0.002, y1 - TOP_RAIL + 0.002, zm)

    def pull(bm, uvl):
        # (on the meeting stile's middle, both faces, a millimetre proud of the wood)
        w, h, cy = PULL
        cx = (xb - STILE / 2) if meet > 0 else (xa + STILE / 2)
        box(bm, uvl, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, zb - 0.001, zb + 0.001, "y")
        box(bm, uvl, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, za - 0.001, za + 0.001, "y")

    return mesh_of(name, wood, glass, pull)


# --- the leaves --------------------------------------------------------------------------------------------------
leaves = [leaf("GenkanDoorS", *LEAF_X[0], *TRACK_Z[0], 1), leaf("GenkanDoorN", *LEAF_X[1], *TRACK_Z[1], -1)]
print("GENKANDOOR_LEAVES", W_LEAF, LEAF_X, "open way", LEAF_X[0][1], X_WALL - 0.001)


# --- the frame: the track, the lintel, the transom and its head rail, the north jamb -------------------------------
def frame_wood(bm, uvl):
    box(bm, uvl, X_POST, X_WALL - 0.001, TRACK_Y[0], TRACK_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    box(bm, uvl, X_S, X_WALL - 0.001, LINTEL_Y[0], LINTEL_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    # (the transom's frame: its two ends; its slats on the glass's street side)
    tz = (0.392, 0.425)
    box(bm, uvl, X_S, X_S + STILE, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    box(bm, uvl, X_WALL - 0.001 - STILE, X_WALL - 0.001, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    inner = (X_WALL - 0.001 - STILE) - (X_S + STILE)
    n = int(round(inner / (SLAT_GAP * 1.5))) - 1
    for k in range(n):
        cx = X_S + STILE + inner * (k + 1) / (n + 1)
        box(bm, uvl, cx - SLAT_W / 2, cx + SLAT_W / 2, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, 0.4095, 0.424, "y")
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


frame = mesh_of("GenkanDoorFrame", frame_wood, frame_glass)

root = bpy.data.objects.new("GenkanDoor", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("GENKANDOOR_TRIS", sum(len(o.data.polygons) for o in parts), {o.name: len(o.data.polygons) for o in parts})
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "genkandoor.glb"), os.path.join(PROJECT, "blender", "genkandoor.blend"), PREVIEW)
print("GENKANDOOR_DONE")
