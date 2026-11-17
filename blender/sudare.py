"""The round window's bamboo blind (簾, sudare.glb; item 301, the owner's, 2026-11-17: 「圓窗加上日式窗簾注意面數」), half rolled up, in the
round window's own frame (blender/roundwindow.py: x the wall's normal, the room toward -x; y up; z along the wall; the window's middle at the
origin, 0.8 across, its frame's face at x = -0.089 and its outer edge 0.478 out):

- "SudarePole": the bamboo pole it hangs from, just over the frame's top, a little wider than the frame (6 round, its ends closed).
- "SudareBlind": what hangs down: one square, 1.0 wide, from the pole to just over the window's middle; its picture the slats (fine split
  bamboo laid across, each its own straw tone, a node here and there), the gaps between them cut out (the window seen through them), the
  dark threads woven down through them, and the indigo cloth bound along both sides and the top.
- "SudareRoll": the rest of it rolled up at its foot: a roll of the same slats (8 round, its ends closed), the slats running along it.
- "SudareCord0", "SudareCord1": the two cords that hold it up, down from the pole in front of it and round under the roll.

In front of the frame by 1.6 cm, nothing touching it. Low: about a hundred triangles in all, everything else in its picture.

Run:
    blender -b --factory-startup --python blender/sudare.py -- <project path> [preview.png]
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


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


W = 1.0                 # its width along the wall
X = -0.105              # the hanging blind's plane (the frame's face is at -0.089)
TOP, FOOT = 0.53, 0.05  # the pole's height, and where the hanging part ends at the roll
ROLL_R = 0.028          # the roll's radius
POLE_R = 0.011


def mesh_obj(name, bm, smooth_shade=True):
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


# =====================================================================
# The blind's picture
# =====================================================================
def blind_picture(N=256):
    """u across it (0..1 along the wall), v down it (0 at its top): the slats, their gaps clear, the threads, the cloth along the sides and top"""
    rng_ = np.random.default_rng(7)
    rgb = np.zeros((N, N, 3), np.float32)
    a = np.ones((N, N), np.float32)
    v = np.arange(N)
    # (a slat every 5 pixels: 4 of split bamboo, 1 a gap between, see-through)
    slat = (v % 5) < 4
    tones = np.array([[0.80, 0.66, 0.42], [0.75, 0.60, 0.37], [0.84, 0.71, 0.48], [0.72, 0.57, 0.35]], np.float32)
    for row in range(0, N, 5):
        t = tones[rng_.integers(len(tones))] * (0.94 + 0.08 * rng_.random())
        rgb[row:row + 4, :] = t
        # (the slat's own sheen down its middle, a little darker at its edges)
        rgb[row, :] *= 0.9
        rgb[row + 3:row + 4, :] *= 0.86
        # (a node or two along it: a short darker band)
        for _ in range(rng_.integers(0, 3)):
            c = rng_.integers(10, N - 10)
            rgb[row:row + 4, c:c + 3] *= 0.72
    rgb[~slat] = 0.18
    a[~slat] = 0.0
    # (the threads woven down through it, dark, a little thick where they pass over a slat)
    for u0 in (0.13, 0.31, 0.5, 0.69, 0.87):
        c = int(u0 * N)
        rgb[:, c - 1:c + 2] = (0.24, 0.15, 0.09)
        a[:, c - 1:c + 2] = 1.0
    # (the cloth bound along both sides and the top: indigo, a fine pale line in it)
    cloth = np.array([0.17, 0.22, 0.38], np.float32)
    for sl in (np.s_[:, :9], np.s_[:, N - 9:], np.s_[:10, :]):
        rgb[sl] = cloth
        a[sl] = 1.0
    rgb[:, 6] = rgb[:, N - 7] = (0.78, 0.74, 0.62)
    rgb[7, 9:N - 9] = (0.78, 0.74, 0.62)
    # (image rows go up from the bottom: v down the blind is the picture's top to its foot)
    return rgb[::-1].copy(), a[::-1].copy()


# =====================================================================
# The parts
# =====================================================================
def blind(name):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = [bm.verts.new(P(X, y, z)) for (y, z) in ((FOOT, -W / 2), (FOOT, W / 2), (TOP - 0.012, W / 2), (TOP - 0.012, -W / 2))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if f.normal.x > 0:
        f.normal_flip()
    return mesh_obj(name, bm, smooth_shade=False)


def rod(name, cx, cy, r, n, uv_scale=1.0):
    """a round rod along z (the wall), its middle at (cx, cy), `n` round, its ends closed with ladders; u along it, v round it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for z in (-W / 2 - 0.01, W / 2 + 0.01):
        rings.append([bm.verts.new(P(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n), z)) for k in range(n)])
    for k in range(n):
        j = (k + 1) % n
        f = bm.faces.new((rings[0][k], rings[0][j], rings[1][j], rings[1][k]))
        for lp, uv in zip(f.loops, ((0, k / n * uv_scale), (0, (k + 1) / n * uv_scale), (1, (k + 1) / n * uv_scale), (1, k / n * uv_scale))):
            lp[uvl].uv = uv
    ladder_fill(bm, rings[0])
    ladder_fill(bm, list(reversed(rings[1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, smooth_shade=True)


def cord(name, z):
    """a cord down from the pole in front of the blind, round under the roll and up a little behind it: a thin square tube through a few points"""
    cx, cy = X - ROLL_R - 0.003, FOOT - ROLL_R
    pts = [(X - 0.012, TOP - 0.004), (cx - ROLL_R - 0.004, cy + 0.01), (cx - ROLL_R * 0.7, cy - ROLL_R * 0.8), (cx, cy - ROLL_R - 0.004),
           (cx + ROLL_R * 0.75, cy - ROLL_R * 0.7)]
    T = 0.0022
    bm = bmesh.new()
    rings = []
    for i, (x, y) in enumerate(pts):
        a_ = pts[max(0, i - 1)]
        b_ = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b_[0] - a_[0], b_[1] - a_[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        rings.append([bm.verts.new(P(x + nx * o1, y + ny * o1, z + o2)) for (o1, o2) in ((-T, -T), (T, -T), (T, T), (-T, T))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, smooth_shade=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
rgb, alpha = blind_picture()
M = {
    "slats": pbr("SudareSlats", (1, 1, 1), tex=image("sudareslats", rgb, alpha=alpha), rough=0.7, blend=True),
    "pole": pbr("SudarePole", (0.62, 0.48, 0.28), rough=0.5),
    "cord": pbr("SudareCord", (0.2, 0.12, 0.07), rough=0.8),
}
parts = []
for o, mat in ((blind("SudareBlind"), M["slats"]), (rod("SudareRoll", X - ROLL_R - 0.003, FOOT - ROLL_R, ROLL_R, 8, 0.45), M["slats"]),
               (rod("SudarePole", X - 0.004, TOP, POLE_R, 6), M["pole"]), (cord("SudareCord0", -W * 0.3), M["cord"]),
               (cord("SudareCord1", W * 0.3), M["cord"])):
    o.data.materials.append(mat)
    parts.append(o)
root = bpy.data.objects.new("Sudare", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
    print(o.name, tris([o]))
if PREVIEW:
    target = P(-0.1, 0.3, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(-1.6, 0.6, -0.7)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for nm, loc, energy in (("Key", P(-2.0, 2.0, -1.5), 4.0), ("Fill", P(-1.5, 1.0, 1.5), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = energy
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "sudare.glb"), os.path.join(PROJECT, "blender", "sudare.blend"), PREVIEW)
print("SUDARE_DONE", tris(parts))
