"""The sliding door at the way in (玄関の格子戸, genkandoor.glb; item 410, the owner's, 2026-11-20: 「玄關試著做和式拉門」「客人進來的時候會先開拉
門再脫鞋」). In the doorway's own frame (GuestBar3D's `look-door` group, as blender/facade.py): x along the shop's front (+x toward the north
wall), y up (the room's floor at 0, the genkan's stones at -0.09 to -0.11), z out to the street.

Three leaves (三枚引き戸) on three tracks across the doorway, from the post's inner face (x -0.712) to the north wall's end (x 0.43), as a
shop's lattice door is: each a frame of dark wood (its stiles, its top rail, a deep bottom rail, a middle rail), a wooden panel (腰板) under
the middle rail, frosted glass over it with the lattice's slats (縦格子) on its street side. Opened, the middle and the north leaves slide
south over the south one, the way left open 0.69 wide (x -0.26 to 0.43): the game slides them ("GenkanDoorM", "GenkanDoorN": each moved
along x only; "GenkanDoorS" stays). Over them the lintel (鴨居) and a transom (欄間) of the same glass and slats up to the beam, a head rail
into the beam's front; under them the track (敷居) on the stone sill; a jamb strip (方立) between the post and the south leaf.

What's to be kept clear of (measured in the game, item 410): the red lantern's paper (a round one, its middle at x -0.772 z 0.47, 0.119
round, y 1.50 to 2.12: within x -0.712 it reaches -0.653 at z 0.47, -0.676 at z 0.40); the big lantern's back (z 0.433 at x -0.126, y 1.70
to 2.29); the noren (z 0.21 to 0.30, swung); the beam (z 0.20 to 0.34, from y 2.305); the lanterns' bar's arm (x -0.722 to -0.698). So all
of it within z 0.33 to 0.425, its south end at x -0.655 where it's over y 1.5 (the jamb strip behind the lantern, z 0.33 to 0.356).

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
X_S = -0.655                         # the leaves' and the lintel's south end (clear of the red lantern)
TRACK_Y = (-0.0955, -0.084)          # the track (敷居) on the sill
LEAF_Y = (-0.082, 1.975)             # a leaf, from the track up into the lintel
LINTEL_Y = (1.96, 2.03)
TRANSOM_Y = (2.03, 2.28)
HEAD_Y = (2.28, 2.304)               # the head rail into the beam's front (under its foot, 2.305)
FRAME_Z = (0.353, 0.425)             # the track's and the lintel's depth
TRACK_Z = [(0.358, 0.376), (0.379, 0.397), (0.400, 0.418)]      # the south, the middle, the north leaf's
W_LEAF = 0.375
LEAF_X = [(X_S, X_S + W_LEAF), (-0.295, -0.295 + W_LEAF), (X_WALL - 0.001 - W_LEAF, X_WALL - 0.001)]
STILE, TOP_RAIL, BOTTOM_RAIL, MID_RAIL = 0.03, 0.045, 0.11, 0.035
MID_Y = 0.56                         # the middle rail's foot, over the leaf's foot
SLAT_W, SLAT_GAP = 0.009, 0.036      # the lattice's slats: their width, their pitch (fine: at 12 mm and 46 they read as bars)


# --- pictures -----------------------------------------------------------------------------------------------------
def wood_picture(n=256):
    """dark wood (a shade lighter than the facade's: in the shade under the noren it went black), its grain up the picture: long streaks wandering, a little lighter and darker by turns"""
    u, v = grid01(n)
    streak = fbm(n, 24, 2, 4)
    fine = 0.5 + 0.5 * np.sin(2 * np.pi * (u * 38 + 0.8 * fbm(n, 3, 2)))
    k = 0.82 + 0.14 * streak + 0.06 * fine
    base = np.array((0.3, 0.19, 0.11), np.float32)
    return (base[None, None, :] * k[..., None]).clip(0, 1).astype(np.float32)


M = {
    "wood": pbr("GenkanDoorWood", (1, 1, 1), tex=image("genkan_door_wood", wood_picture()), rough=0.6),
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


def mesh_of(name, build_wood, build_glass=None):
    """an object of its wood (and its glass), each its own material"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    build_wood(bm, uvl)
    nw = len(bm.faces)
    if build_glass:
        build_glass(bm, uvl)
    for i, f in enumerate(bm.faces):
        f.material_index = 0 if i < nw else 1
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index == 0])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["wood"])
    if build_glass:
        o.data.materials.append(M["glass"])
    parts.append(o)
    return o


def leaf(name, xa, xb, za, zb):
    """one leaf: its frame, its panel, its glass and the slats on the glass's street side"""
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

    def glass(bm, uvl):
        glass_quad(bm, uvl, xa + STILE - 0.002, xb - STILE + 0.002, MID_Y + MID_RAIL - 0.002, y1 - TOP_RAIL + 0.002, zm)

    return mesh_of(name, wood, glass)


# --- the leaves --------------------------------------------------------------------------------------------------
leaves = [leaf(n, *LEAF_X[k], *TRACK_Z[k]) for k, n in enumerate(("GenkanDoorS", "GenkanDoorM", "GenkanDoorN"))]


# --- the frame: the track, the jamb strip, the lintel, the transom and its head rail ------------------------------
def frame_wood(bm, uvl):
    box(bm, uvl, X_POST, X_WALL - 0.001, TRACK_Y[0], TRACK_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    # (between the post and the south leaf, full height, behind the lantern's reach)
    box(bm, uvl, X_POST + 0.001, X_S + 0.001, TRACK_Y[1] - 0.001, LINTEL_Y[0] + 0.01, 0.33, 0.3565, "y")
    box(bm, uvl, X_S, X_WALL - 0.001, LINTEL_Y[0], LINTEL_Y[1], FRAME_Z[0], FRAME_Z[1], "x")
    # (the transom's frame: its two ends; its slats on the glass's street side)
    tz = (0.372, 0.405)
    box(bm, uvl, X_S, X_S + STILE, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    box(bm, uvl, X_WALL - 0.001 - STILE, X_WALL - 0.001, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, *tz, "y")
    inner = (X_WALL - 0.001 - STILE) - (X_S + STILE)
    n = int(round(inner / (SLAT_GAP * 1.5))) - 1
    for k in range(n):
        cx = X_S + STILE + inner * (k + 1) / (n + 1)
        box(bm, uvl, cx - SLAT_W / 2, cx + SLAT_W / 2, TRANSOM_Y[0] - 0.001, TRANSOM_Y[1] + 0.001, 0.3895, 0.404, "y")
    # (its head rail, from the transom back into the beam's front (z 0.34), under the beam's foot)
    box(bm, uvl, X_S, X_WALL - 0.001, HEAD_Y[0], HEAD_Y[1], 0.338, 0.41, "x")


def frame_glass(bm, uvl):
    glass_quad(bm, uvl, X_S + STILE - 0.002, X_WALL - 0.001 - STILE + 0.002, TRANSOM_Y[0], TRANSOM_Y[1], 0.388)


frame = mesh_of("GenkanDoorFrame", frame_wood, frame_glass)

root = bpy.data.objects.new("GenkanDoor", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("GENKANDOOR_TRIS", sum(len(o.data.polygons) for o in parts), {o.name: len(o.data.polygons) for o in parts})
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "genkandoor.glb"), os.path.join(PROJECT, "blender", "genkandoor.blend"), PREVIEW)
print("GENKANDOOR_DONE")
