"""The big chopping board (大砧板) in front of the fire, where an order's raw food is set out:

- cutboard.glb, node "CutBoard": a thick board in the same warm, hand-painted wood as the cut-fish board at the table's corner (orange-brown,
  long painterly grain, darker toward its edges), 1.6 long by 0.9 deep (the game's tray units; the game scales it with the rest of the
  table), its top from y=0.045 down to -0.01. Not a plain slab: its outline a soft rounded oblong, a little fuller at one end than the
  other, as a board cut from one piece is, every edge eased round; an oval hole through it near the fuller end to hang it up by, a hand's
  grip. One texture: the top in its lower three quarters, the edges in a strip above.

Run:
    blender -b --factory-startup --python blender/cutboard.py -- <project path>
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

L, D, TOP, BOT = 1.6, 0.9, 0.045, -0.01
TOPV = 0.75          # (the top's share of the texture, from v=0; the edge strip above it)

bpy.ops.wm.read_factory_settings(use_empty=True)
seed(17)
N = 1024
u, v = grid01(N)

# ---- the top: painted wood after the cut-fish board's, warm orange-brown, its grain long strokes along the board
vv = v / TOPV
wob = fbm(N, 2, 7, 4) - 0.5
base = mix((0.78, 0.42, 0.18), (0.88, 0.52, 0.24), fbm(N, 3, 2, 4))
# (long strokes of grain, wavering, some broad and soft, some fine and dark)
broad = np.sin(2 * math.pi * (vv * 9 + wob * 1.8 + 0.3 * np.sin(2 * math.pi * u * 1.3)))
fine = np.sin(2 * math.pi * (vv * 38 + wob * 5 + fbm(N, 1, 24, 3) * 2))
col = mix(base, (0.6, 0.28, 0.1), smooth(0.4, 1.0, broad) * 0.35)
col = mix(col, (0.55, 0.25, 0.09), smooth(0.8, 1.0, fine) * 0.4)
col = mix(col, (0.95, 0.62, 0.32), smooth(0.65, 0.95, fbm(N, 8, 2, 3)) * 0.3)          # light catching along it
# (two seams where the planks were glued, soft, and a knot)
for sv in (0.36, 0.68):
    col = mix(col, (0.48, 0.22, 0.08), smooth(0.006, 0.0, np.abs(vv - sv - wob * 0.01)) * 0.6)
d = np.sqrt(((u - 0.3) * 1.0) ** 2 + ((vv - 0.55) * 1.8) ** 2)
col = mix(col, (0.45, 0.2, 0.07), smooth(0.016, 0.006, d) * 0.85)
col = mix(col, col * np.float32(0.85), (np.sin(d * 380) * 0.5 + 0.5) * smooth(0.06, 0.016, d) * 0.5)
# (darker toward its edges, the oil; knife marks over its middle)
edge = np.minimum(np.minimum(u, 1 - u) * 1.8, np.minimum(vv, 1 - vv))
col = col * (1 - 0.22 * smooth(0.18, 0.0, edge))[..., None]
rng = np.random.default_rng(5)
scr = np.zeros((N, N), np.float32)
for _ in range(180):
    x0, y0 = rng.uniform(0.2, 0.8), rng.uniform(0.2, 0.8)
    a = rng.uniform(-0.6, 0.6) + (math.pi / 2 if rng.random() < 0.3 else 0)
    ln = rng.uniform(0.02, 0.08)
    for t in np.linspace(0, 1, int(ln * N * 1.2)):
        xi, yi = int((x0 + math.cos(a) * ln * t) * N), int((y0 + math.sin(a) * ln * t) * TOPV * N)
        if 0 <= xi < N and 0 <= yi < N:
            scr[yi, xi] = max(scr[yi, xi], rng.uniform(0.4, 1.0))
col = mix(col, col * np.float32(0.75), scr * 0.45)
# ---- the edge strip: the board's sides, end grain and long grain together, darker
sv_ = np.clip((v - TOPV) / (1 - TOPV), 0, 1)
side = (0.6, 0.3, 0.12) * np.ones((N, N, 3), np.float32)
side = mix(side, (0.46, 0.21, 0.08), smooth(0.5, 0.95, np.sin((sv_ * 7 + wob * 2) * math.pi * 2)) * 0.5)
col = np.where((v >= TOPV)[..., None], side, col)
M = pbr("CutBoard", (1, 1, 1), tex=image("T_CutBoard", col), rough=0.55, coat=0.15)

# ---- the board: its outline a soft oblong, fuller at one end (+x), drawn as a 2D curve with the hang hole cut through it, made solid,
# its edges eased round by the curve's own bevel
cd = bpy.data.curves.new("CutBoard", "CURVE")
cd.dimensions = "2D"
cd.fill_mode = "BOTH"
cd.resolution_u = 24
cd.extrude = (TOP - BOT) / 2 - 0.012
cd.bevel_depth = 0.012
cd.bevel_resolution = 3


def outline(n=96):
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s_ = math.cos(a), math.sin(a)
        # (a superellipse, square-shouldered but round, the +x end a little fuller, the long sides a touch bowed)
        e = 2 / 3.2
        x = L / 2 * math.copysign(abs(c) ** e, c)
        y = D / 2 * math.copysign(abs(s_) ** e, s_)
        y *= 0.93 + 0.07 * (x / (L / 2))
        y *= 1 + 0.025 * math.cos(math.pi * x / L)
        pts.append((x, y))
    return pts


def spline(pts):
    sp = cd.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True


spline(outline())
# (the hang hole: an oval near the fuller end, toward the far side, big enough for fingers)
HX, HY, HA, HB = L / 2 - 0.2, D / 2 - 0.2, 0.11, 0.06
spline([(HX + HA * math.cos(2 * math.pi * k / 40), HY + HB * math.sin(2 * math.pi * k / 40)) for k in range(40)][::-1])
o = bpy.data.objects.new("CutBoard", cd)
bpy.context.collection.objects.link(o)
o.location = (0, 0, (TOP + BOT) / 2)
bpy.context.view_layer.objects.active = o
o.select_set(True)
bpy.ops.object.convert(target="MESH")
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# (UVs: top and bottom laid flat across the whole board; the sides wrapped round into the edge strip by how far round the board they are)
bm = bmesh.new()
bm.from_mesh(o.data)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
uvl = bm.loops.layers.uv.verify()
bm.normal_update()
for f in bm.faces:
    flat = abs(f.normal.z) > 0.7
    us = []
    for lp in f.loops:
        x, y, z = lp.vert.co
        if flat:
            lp[uvl].uv = (x / L + 0.5, (y / D + 0.5) * TOPV * 0.995)
        else:
            a = (math.atan2(y / D, x / L) / (2 * math.pi)) % 1
            us.append(a)
            lp[uvl].uv = (a * 3, TOPV + 0.01 + (z - BOT) / (TOP - BOT + 0.02) * (1 - TOPV - 0.02))
    if us and max(us) - min(us) > 0.5:
        for lp in f.loops:
            uu, vv_ = lp[uvl].uv
            if uu < 1.5:
                lp[uvl].uv = (uu + 3, vv_)
bm.to_mesh(o.data)
bm.free()
o.data.materials.clear()
finish(o, "CutBoard", M, smooth_shade=True)
for p in o.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.99
root = bpy.data.objects.new("CutBoardRoot", None)
bpy.context.collection.objects.link(root)
o.parent = root
export_dish(root, [o, root], os.path.join(PROJECT, "public", "models", "cutboard.glb"), os.path.join(PROJECT, "blender", "cutboard.blend"), None)
print("CUTBOARD_DONE", len(o.data.polygons))
