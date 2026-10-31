"""Cardboard cases of drinks (段ボール), stacked by the crates at the back of the drinks: drinkcartons.glb, node "DrinkCartons".

Five cases: two side by side on the floor, two on them a little askew, one on top turned across. Each a box of kraft board, bulging a hair, its
top flaps shut under a strip of brown tape running over and down the ends, its edges eased; its long sides and one end printed (material
"CartonPrint<k>", the picture laid once over each printed face: the game draws each its own drink's print on it), the rest plain board
("CartonKraft"). The game's frame: y up, the stack standing on y = 0, its middle at the origin; each case 0.30 long, 0.14 tall, 0.20 deep.

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
L, H, D = 0.30, 0.14, 0.20


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def kraft():
    """corrugated kraft board: warm brown, faint flutes showing through, a few scuffs"""
    seed(4)
    N = 256
    u, v = grid01(N)
    col = mix((0.72, 0.55, 0.36), (0.66, 0.49, 0.31), fbm(N, 8, 8, 4) * 0.7)
    flutes = (np.sin(2 * math.pi * u * 40) * 0.5 + 0.5) * 0.06
    col = col * (1 - flutes)[..., None]
    scuff = smooth(0.82, 0.95, fbm(N, 20, 20, 3))
    return mix(col, (0.8, 0.66, 0.48), scuff * 0.35)


M = {"kraft": pbr("CartonKraft", (1, 1, 1), tex=image("cartonkraft", kraft()), rough=0.85),
     "tape": pbr("CartonTape", lin("#a8784a"), rough=0.5)}
PRINTS = [pbr(f"CartonPrint{k}", (1, 1, 1), tex=image(f"cartonprint{k}", kraft()), rough=0.8) for k in range(5)]
parts = []


def carton(k, at, turn):
    """one case, its print material k, standing at `at` (its foot's middle, the game's frame), turned `turn` about the upright"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    n = 4                                                  # (each face in n x n, so it can bulge)
    faces = []
    # (each face: its axis, side, and the two in-face axes; printed: the long sides (z) and one end (+x))
    for ax, side, printed in ((0, 1, True), (0, -1, False), (1, 1, False), (1, -1, False), (2, 1, True), (2, -1, True)):
        others = [a for a in range(3) if a != ax]
        half = (L / 2, H / 2, D / 2)
        grid = []
        for i in range(n + 1):
            row = []
            for j in range(n + 1):
                p = [0.0, 0.0, 0.0]
                p[ax] = side * half[ax]
                p[others[0]] = -half[others[0]] + 2 * half[others[0]] * i / n
                p[others[1]] = -half[others[1]] + 2 * half[others[1]] * j / n
                # (the board bulging a hair at the middle of each face)
                s = math.sin(math.pi * i / n) * math.sin(math.pi * j / n)
                p[ax] += side * 0.0025 * s
                row.append((bm.verts.new(P(p[0], p[1] + H / 2, p[2])), (i / n, j / n)))
            grid.append(row)
        for i in range(n):
            for j in range(n):
                q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                if side < 0:
                    q.reverse()
                f = bm.faces.new([vv for vv, _ in q])
                f.material_index = 1 if printed else 0
                for lp, (_, uv) in zip(f.loops, q):
                    # (printed faces: the print laid once over the face, upright; plain ones: the board's flutes along)
                    uu, vv = uv
                    if ax == 0:
                        lp[uvl].uv = (vv if side > 0 else 1 - vv, uu)
                    elif ax == 2:
                        lp[uvl].uv = (uu if side > 0 else 1 - uu, vv)
                    else:
                        lp[uvl].uv = (uu, vv)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"Carton{k}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"Carton{k}", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["kraft"])
    o.data.materials.append(PRINTS[k])
    # (crisp, as board is: its faces flat, only the faintest swell)
    for f in o.data.polygons:
        f.use_smooth = False
    # (the tape: over the flaps' seam along the top and down both ends)
    tw = 0.045
    tape = []
    for (sx, sy, sz, px, py, pz) in ((L + 0.004, 0.002, tw, 0, H + 0.007, 0), (0.002, 0.06, tw, L / 2 + 0.007, H - 0.03, 0), (0.002, 0.06, tw, -L / 2 - 0.007, H - 0.03, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(px, py, pz))
        t = bpy.context.view_layer.objects.active
        t.scale = (sx, sz, sy)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        t.data.materials.append(M["tape"])
        tape.append(t)
    for t in tape:
        t.parent = o
    o.matrix_world = Matrix.Translation(P(*at)) @ Matrix.Rotation(turn, 4, "Z")
    parts.append(o)
    parts.extend(tape)
    return o


# (two on the floor side by side; two on them, a little askew; one on top, turned across)
carton(0, (-0.155, 0.0, 0.0), 0.02)
carton(1, (0.155, 0.0, 0.01), -0.03)
carton(2, (-0.14, H + 0.012, 0.005), 0.06)
carton(3, (0.16, H + 0.012, -0.01), -0.05)
carton(4, (0.0, 2 * H + 0.024, 0.0), math.pi / 2 + 0.08)
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
