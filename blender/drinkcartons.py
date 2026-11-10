"""Cardboard cases of drinks (段ボール), stacked by the crates at the back of the drinks: drinkcartons.glb, node "DrinkCartons".

Nine cases (the owner: bigger cases, more of them, stacked up high): two side by side to a layer, four layers each a little askew on the
last, one on top turned across, about 1.1 tall. The game's frame: y up, the stack standing on y = 0, its middle at the origin; each case 0.40
long, 0.21 tall, 0.28 deep (a case of 24 cans). Each a box of board with its upright and top edges bevelled 5 mm (no bottom: it stands on
the floor or the case under it; 30 triangles), its top flaps shut under a strip of tape along the seam, over the bevels and down both ends.

Its faces all one material ("CartonPrint"), laid out on the game's print (1024 x 1024, 930 px to the metre, the same for every face: the
owner's, 2026-11-10: the print was one 2:1 picture laid over each face whatever its shape, the ends' squashed, and the +x end's mirrored) as
a dieline: each drink's row, its long side (front and back, W x H) and its end (D x H) beside it; one top for all (W x D) at the right. Every
face's picture right reading seen from outside it (CartonLayout below, which the game's painter follows: shops/grill/drinkCartons.ts).

Run:
    blender -b --factory-startup --python blender/drinkcartons.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
L, H, D = 0.40, 0.21, 0.28


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def kraft():
    """corrugated kraft board: warm brown, faint flutes showing through, a few scuffs (the preview's: the game paints the print)"""
    seed(4)
    N = 256
    u, v = grid01(N)
    col = mix((0.72, 0.55, 0.36), (0.66, 0.49, 0.31), fbm(N, 8, 8, 4) * 0.7)
    flutes = (np.sin(2 * math.pi * u * 40) * 0.5 + 0.5) * 0.06
    col = col * (1 - flutes)[..., None]
    scuff = smooth(0.82, 0.95, fbm(N, 20, 20, 3))
    return mix(col, (0.8, 0.66, 0.48), scuff * 0.35)


M = {"print": pbr("CartonPrint", (1, 1, 1), tex=image("cartonprint", kraft()), rough=0.88),
     "tape": pbr("CartonTape", lin("#c9a26a"), rough=0.35)}
parts = []

# (the print's layout, in its pixels from its top left (the game's drinkCartons.ts follows it): one scale for every face)
PX, TW, TH = 930.0, 1024.0, 1024.0
SIDE_X, END_X, ROW0, ROW = 4.0, 384.0, 4.0, 202.0
TOP_X, TOP_Y = 650.0, 4.0
BEVEL = 0.005


def carton(idx, k, at, turn):
    """one case (the idx-th), its print row k, standing at `at` (its foot's middle, the game's frame), turned `turn` about the upright"""
    hw, hd = L / 2, D / 2
    W, Hh, Dd = L * PX, H * PX, D * PX
    row_y = ROW0 + k * ROW
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    v = {}
    for sx in (-1, 1):
        for y in (0.0, H):
            for sz in (-1, 1):
                v[(sx, y, sz)] = bm.verts.new(P(sx * hw, y, sz * hd))
    # (its four sides and its top; no bottom)
    for q in (((-1, 0.0, 1), (1, 0.0, 1), (1, H, 1), (-1, H, 1)), ((1, 0.0, -1), (-1, 0.0, -1), (-1, H, -1), (1, H, -1)),
              ((1, 0.0, 1), (1, 0.0, -1), (1, H, -1), (1, H, 1)), ((-1, 0.0, -1), (-1, 0.0, 1), (-1, H, 1), (-1, H, -1)),
              ((-1, H, 1), (1, H, 1), (1, H, -1), (-1, H, -1))):
        bm.faces.new([v[c] for c in q])
    bm.normal_update()
    # (each face turned out of the box)
    mid = Vector(P(0, H / 2, 0))
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
    # (its upright edges and its top's bevelled: the board's edges eased, not cut sharp (the owner's); the foot's edges left, standing flat)
    edges = [e for e in bm.edges if not all(abs(vv.co.z) < 1e-6 for vv in e.verts)]
    bmesh.ops.bevel(bm, geom=edges, offset=BEVEL, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
    bm.normal_update()
    # (each face's picture: by which way it faces, the bevels' taking the edge of the face they lean to (a side's or an end's before the
    # top's), each seen from outside right reading: x, y, z the game's)
    for f in bm.faces:
        n = f.normal
        g = (n.x, n.z, -n.y)
        ax = max(range(3), key=lambda a_: abs(g[a_]) - (0.02 if a_ == 1 else 0.0))
        for lp in f.loops:
            co = lp.vert.co
            x, y, z = co.x, min(H, max(0.0, co.z)), -co.y
            if ax == 2:
                u = (x + hw) / L if g[2] > 0 else (hw - x) / L
                px, py = SIDE_X + u * W, row_y + (H - y) / H * Hh
            elif ax == 0:
                u = (hd - z) / D if g[0] > 0 else (z + hd) / D
                px, py = END_X + u * Dd, row_y + (H - y) / H * Hh
            else:
                px, py = TOP_X + (x + hw) / L * W, TOP_Y + (z + hd) / D * Dd
            lp[uvl].uv = (px / TW, 1 - py / TH)
    me = bpy.data.meshes.new(f"Carton{idx}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"Carton{idx}", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["print"])
    for f in o.data.polygons:
        f.use_smooth = False
    # (the tape: one strip along the top's seam, over the bevels and down both ends 3 cm (the owner's), lying 2.5 mm off the board, out past
    # the ink line round the box (inside it, the line drawn over it at the edges, the tape looked cut there: the owner saw it break))
    tw, drop, off = 0.048, 0.03, 0.0025
    c = off * math.tan(math.pi / 8)
    prof = [(-hw - off, H - drop), (-hw - off, H - BEVEL + c), (-hw + BEVEL - c, H + off),
            (hw - BEVEL + c, H + off), (hw + off, H - BEVEL + c), (hw + off, H - drop)]
    bm = bmesh.new()
    uvt = bm.loops.layers.uv.new()
    rows = [[bm.verts.new(P(x, y, zz)) for (x, y) in prof] for zz in (-tw / 2, tw / 2)]
    run = [0.0]
    for i in range(1, len(prof)):
        run.append(run[-1] + math.dist(prof[i], prof[i - 1]))
    for i in range(len(prof) - 1):
        f = bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        for lp, (ss, ii) in zip(f.loops, ((0, i), (0, i + 1), (1, i + 1), (1, i))):
            lp[uvt].uv = (ss, run[ii] / run[-1])
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
    me = bpy.data.meshes.new(f"CartonTape{idx}")
    bm.to_mesh(me)
    bm.free()
    t = bpy.data.objects.new(f"CartonTape{idx}", me)
    bpy.context.collection.objects.link(t)
    t.data.materials.append(M["tape"])
    t.parent = o
    o.matrix_world = Matrix.Translation(P(*at)) @ Matrix.Rotation(turn, 4, "Z")
    parts.append(o)
    parts.append(t)
    return o


# (two to a layer side by side, four layers, each case a little askew on the one below; one on top, turned across)
LAYOUT = [(-0.205, 0.0, 0.0, 0.02), (0.205, 0.0, 0.01, -0.03),
          (-0.195, 1, 0.006, 0.05), (0.21, 1, -0.008, -0.04),
          (-0.2, 2, -0.004, -0.03), (0.2, 2, 0.008, 0.045),
          (-0.19, 3, 0.006, 0.04), (0.205, 3, -0.006, -0.05),
          (0.0, 4, 0.0, math.pi / 2 + 0.08)]
PRINT_OF = [0, 1, 2, 3, 4, 2, 0, 3, 1]
# (each layer sitting on the tape of the one under it: they stood 1.2 cm apart, each case floating over the last)
for i, (x, layer, z, turn) in enumerate(LAYOUT):
    carton(i, PRINT_OF[i], (x, layer * (H + 0.003), z), turn)
root = bpy.data.objects.new("DrinkCartons", None)
bpy.context.collection.objects.link(root)
bpy.context.view_layer.update()
for o in parts:
    if o.parent is None:
        mw = o.matrix_world.copy()
        o.parent = root
        o.matrix_world = mw
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 0.7, 1.0)
    cam.rotation_euler = (P(0, 0.22, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN")); lt.data.energy = 4.5
    bpy.context.collection.objects.link(lt); lt.location = P(2, 3, 2); lt.rotation_euler = (P(0, 0, 0) - lt.location).to_track_quat("-Z", "Y").to_euler()
    w = bpy.data.worlds.new("W"); w.color = (0.35, 0.35, 0.37); bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "drinkcartons.glb"), os.path.join(PROJECT, "blender", "drinkcartons.blend"), PREVIEW)
print("CARTONS_DONE", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
