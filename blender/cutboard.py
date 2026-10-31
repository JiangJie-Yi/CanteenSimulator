"""The big chopping board (大砧板) in front of the fire, where an order's raw food is set out:

- cutboard.glb, node "CutBoard": a thick board of pale hinoki (檜), lighter than the table it lies on, 1.6 long by 0.9 deep (the game's tray units; the game scales
  it with the rest of the table), its top from y=0.045 down to -0.01 underneath, its corners rounded and every edge softly eased.
  Edge-glued from four planks running its length, each its own shade and figure: flat-sawn grain in long cathedral arches and fine
  straight lines, the joints just a hairline; the knife's fine scratches criss-crossing the working middle, a little darker where it's
  been wet; the ends show end grain, the long edges a band of straight grain, all slightly darker for the oil. One texture: the top in
  its lower three quarters, the edges in a strip above.

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

L, D, TOP, BOT, R = 1.6, 0.9, 0.045, -0.01, 0.07
TOPV = 0.75          # (the top's share of the texture, from v=0; the edge strip above it)

bpy.ops.wm.read_factory_settings(use_empty=True)
seed(11)
N = 1024
u, v = grid01(N)

# ---- the top: four planks along its length (u along the board, v across it, the top's v scaled into 0..TOPV)
vv = v / TOPV
planks = 4
pi_ = np.clip(np.floor(vv * planks), 0, planks - 1)
pv = vv * planks - pi_                        # (0..1 across each plank)
tones = np.array([(0.94, 0.8, 0.58), (0.96, 0.84, 0.63), (0.91, 0.76, 0.54), (0.95, 0.82, 0.6)], np.float32)
base = tones[pi_.astype(int)]
wob = (fbm(N, 2, 6, 4) - 0.5)
# (flat-sawn figure: arches nested along the plank, their crowns wandering; and fine straight lines between)
arch = np.abs(pv - 0.5 - 0.15 * np.sin(u * 3.1 + pi_ * 1.7)) * 2
cath = np.sin((arch * 7 + wob * 1.6 + np.sqrt(np.abs(np.sin(u * 2.2 + pi_))) * 1.2) * math.pi * 2)
lines = np.sin((pv * 46 + wob * 5 + fbm(N, 1, 30, 3) * 2) * math.pi * 2)
col = mix(base, base * np.float32(0.8), smooth(0.55, 0.95, cath) * 0.55)
col = mix(col, base * np.float32(0.86), smooth(0.7, 1.0, lines) * 0.35)
col = mix(col, base * np.float32(1.1), smooth(0.6, 0.9, fbm(N, 6, 2, 3)) * 0.25)            # soft light streaks
# (the hairline joints between the planks, and each plank a little darker toward its edges)
edge = np.minimum(pv, 1 - pv)
col = col * (1 - 0.1 * smooth(0.12, 0.0, edge))[..., None]
col = mix(col, (0.55, 0.38, 0.22), smooth(0.007, 0.0, edge) * (pi_ > 0) * 0.75)
# (a knot or two)
for kx, ky, kr in ((0.27, 0.52, 0.018), (0.81, 0.18, 0.013)):
    d = np.sqrt(((u - kx) * 1.0) ** 2 + ((vv - ky) * 1.8) ** 2)
    col = mix(col, (0.55, 0.36, 0.18), smooth(kr, kr * 0.4, d) * 0.85)
    col = mix(col, col * np.float32(0.85), (np.sin(d * 420) * 0.5 + 0.5) * smooth(kr * 3.5, kr, d) * 0.5)
# (the knife's scratches over the working middle, and the damp there)
rng = np.random.default_rng(5)
scr = np.zeros((N, N), np.float32)
for _ in range(260):
    x0, y0 = rng.uniform(0.15, 0.85), rng.uniform(0.15, 0.85)
    a = rng.uniform(-0.5, 0.5) + (math.pi / 2 if rng.random() < 0.35 else 0)
    ln = rng.uniform(0.02, 0.09)
    for t in np.linspace(0, 1, int(ln * N * 1.2)):
        xi, yi = int((x0 + math.cos(a) * ln * t) * N), int((y0 + math.sin(a) * ln * t) * TOPV * N)
        if 0 <= xi < N and 0 <= yi < N:
            scr[yi, xi] = max(scr[yi, xi], rng.uniform(0.4, 1.0))
col = mix(col, col * np.float32(0.78), scr * 0.5)
damp = smooth(0.42, 0.1, np.sqrt(((u - 0.5) * 1.1) ** 2 + ((vv - 0.5) * 0.9) ** 2) + (fbm(N, 4, 4, 3) - 0.5) * 0.25)
col = mix(col, col * np.float32(0.88), damp * 0.5)
# ---- the edge strip (v from TOPV to 1): straight grain along it, end grain where it turns the ends, darker for the oil
sv = np.clip((v - TOPV) / (1 - TOPV), 0, 1)
side = (0.84, 0.68, 0.46) * np.ones((N, N, 3), np.float32)
side = mix(side, (0.68, 0.5, 0.3), smooth(0.5, 0.95, np.sin((sv * 9 + wob * 2) * math.pi * 2)) * 0.45)
side = mix(side, (0.74, 0.56, 0.34), smooth(0.4, 0.9, fbm(N, 40, 3, 3)) * 0.3)
col = np.where((v >= TOPV)[..., None], side, col)
M = pbr("CutBoard", (1, 1, 1), tex=image("T_CutBoard", col), rough=0.55, coat=0.15)

# ---- the board: a rounded rectangle, made solid, every edge eased by a bevel
bm = bmesh.new()
pts = []
for cx, cy, a0 in ((L / 2 - R, D / 2 - R, 0), (-L / 2 + R, D / 2 - R, 90), (-L / 2 + R, -D / 2 + R, 180), (L / 2 - R, -D / 2 + R, 270)):
    for k in range(9):
        a = math.radians(a0 + k * 90 / 8)
        pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
lo = [bm.verts.new((x, y, BOT)) for x, y in pts]
hi = [bm.verts.new((x, y, TOP)) for x, y in pts]
bm.faces.new(hi)
bm.faces.new(lo[::-1])
n = len(pts)
for i in range(n):
    bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("CutBoard")
bm.to_mesh(me)
bm.free()
o = bpy.data.objects.new("CutBoard", me)
bpy.context.collection.objects.link(o)
bpy.context.view_layer.objects.active = o
o.select_set(True)
mod = o.modifiers.new("b", "BEVEL")
mod.width = 0.014
mod.segments = 4
mod.limit_method = "ANGLE"
mod.angle_limit = math.radians(60)
bpy.ops.object.modifier_apply(modifier="b")
# (the top's two big faces split finer, so the toon light and the ink line sit evenly; then UVs: top and bottom laid flat, the rest
# wrapped round into the edge strip by how far round the board it is)
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
finish(o, "CutBoard", M, smooth_shade=True)
for p in o.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.99
root = bpy.data.objects.new("CutBoardRoot", None)
bpy.context.collection.objects.link(root)
o.parent = root
export_dish(root, [o, root], os.path.join(PROJECT, "public", "models", "cutboard.glb"), os.path.join(PROJECT, "blender", "cutboard.blend"), None)
print("CUTBOARD_DONE", len(o.data.polygons))
