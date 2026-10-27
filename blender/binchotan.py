"""Binchotan (備長炭): the sticks and the pieces they break into, for the crate, the hand and the fire.

A stick as it comes from the kiln: hard, dark grey with a silvery sheen, a little bent, never quite round (the bark's ridges and the long
splits down it), its ends broken off unevenly. Six sticks, each its own; six broken pieces (short, thinner, both ends jagged). One material for
all of them: the face (charcoal grey streaked along the grain, fine splits and a silver fleck), its relief (the splits sunk in), and a glow map
(the emissive texture, dark until the game heats it): the crazing a burning stick shows, an irregular net of cracks, longer along the stick
than round it, some branching off and dying out, never a grid, each crack a hot core in a wider red.

Run:
    blender -b --factory-startup --python blender/binchotan.py -- <project path>
Writes public/models/binchotan.glb and blender/binchotan.blend.

Frame: each piece along +y (the game's up; Blender's +z), its middle at the origin: a stick 0.3 long and about 0.032 round (the game scales
it to each stick's length and thickness), a piece 0.05 to 0.1 long. Nodes: BinStick0..5, BinChunk0..5.
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

seed(77)
bpy.ops.wm.read_factory_settings(use_empty=True)
R0 = np.random.default_rng(3)

# =====================================================================
# Textures (u round the stick, v along it; both tile)
# =====================================================================
N = 512
uu, vv = grid01(N)


def voronoi_cracks(n_seeds, stretch, warp, width, keep, rng):
    """an irregular net of cracks: the edges between cells scattered at random (tiling), the cells drawn out along the stick by `stretch`, the
    lines wavering (`warp`), each a little wider or narrower along its length; `keep` of the edges drawn, the rest left out, so cracks branch
    and stop. Returns (core, halo) masks."""
    pts = rng.random((n_seeds, 2))
    wu = uu + (fbm(N, 6, 6, 4) - 0.5) * warp
    wv = vv + (fbm(N, 6, 6, 4) - 0.5) * warp
    f1 = np.full((N, N), 9.0, np.float32)
    f2 = np.full((N, N), 9.0, np.float32)
    i1 = np.zeros((N, N), np.int32)
    i2 = np.zeros((N, N), np.int32)
    for k, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.sqrt((wu - px - ox) ** 2 + ((wv - py - oy) / stretch) ** 2).astype(np.float32)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                i2 = np.where(closer, i1, np.where(d < f2, k, i2))
                f1 = np.where(closer, d, f1)
                i1 = np.where(closer, k, i1)
    edge = f2 - f1
    a, b = np.minimum(i1, i2), np.maximum(i1, i2)
    h = ((a * 73856093) ^ (b * 19349663)) % 1000 / 1000.0
    on = (h < keep).astype(np.float32)
    w = width * (0.5 + fbm(N, 8, 8, 3))
    core = (1 - smooth(0.0, w, edge)) * on
    halo = (1 - smooth(0.0, w * 5, edge)) * on
    return core, halo


c1, h1 = voronoi_cracks(18, 2.2, 0.08, 0.012, 0.72, R0)
c2, h2 = voronoi_cracks(46, 1.6, 0.05, 0.006, 0.45, R0)
core = np.clip(c1 + c2 * 0.6, 0, 1)
halo = np.clip(h1 + h2 * 0.5, 0, 1)

# (the face: charcoal grey streaked along the grain, silver flecks, the splits dark)
streak = fbm(N, 24, 2, 3)
face = mix((0.15, 0.15, 0.16), (0.3, 0.3, 0.32), smooth(0.3, 0.8, streak))
face = mix(face, (0.52, 0.53, 0.56), (fbm(N, 90, 30, 2) > 0.74).astype(np.float32) * 0.35)
face = mix(face, (0.05, 0.05, 0.05), core * 0.8 + (1 - smooth(0.0, 0.004, np.abs(np.sin(uu * math.pi * 26 + fbm(N, 2, 6, 3) * 3)))) * 0.25)
face_tex = image("binFace", face)
# (the relief: the splits sunk in, the grain's ridges along it)
height = 1 - core * 0.9 - halo * 0.15 + (streak - 0.5) * 0.25
nrm_tex = image("binNormal", to_normal(height.astype(np.float32), 3.0), data=True)
# (the glow: a hot yellow core in each crack, a wider orange-red round it; soft red under the skin in patches)
glow = mix(np.zeros((N, N, 3), np.float32), (0.55, 0.08, 0.01), halo * 0.8)
glow = mix(glow, (1.0, 0.42, 0.08), smooth(0.2, 0.9, core))
glow = mix(glow, (1.0, 0.82, 0.45), smooth(0.75, 1.0, core) * 0.7)
glow = glow + np.asarray((0.22, 0.03, 0.0), np.float32) * smooth(0.6, 0.9, fbm(N, 4, 4, 4))[..., None]
glow_tex = image("binGlow", np.clip(glow, 0, 1))

MAT = pbr("Binchotan", (1, 1, 1), tex=face_tex, nrm=nrm_tex, nrm_strength=1.0, rough=0.42, metal=0.35, emit=(1, 1, 1), emit_strength=1.0, emit_tex=glow_tex)


def piece(name, L, R, jag, rng, bend=0.03, NA=16, NL=24):
    """a stick (or a piece of one) along z: its section never quite round (ridges, a couple of splits sunk in, a slight flat), bent a little,
    thicker at one end; its ends broken unevenly (`jag`), each end closed by a rough fan"""
    ph = rng.uniform(0, 6.28, 4)
    splits = rng.uniform(0, 2 * math.pi, 3)
    vs, fs, uvs = [], [], []

    def rad(a, t):
        r = 1 + 0.05 * math.sin(3 * a + ph[0]) + 0.035 * math.sin(7 * a + ph[1] + t * 3) + 0.02 * math.sin(13 * a + ph[2])
        for s_ in splits:
            d = math.atan2(math.sin(a - s_), math.cos(a - s_))
            r -= 0.07 * math.exp(-(d / 0.09) ** 2)
        return R * r * (1 + 0.06 * (t - 0.5))

    ends = [[float(rng.normal(0, jag)) for _ in range(NA)] for _ in range(2)]
    # (the jag smoothed round, so the broken end's edge wanders rather than spikes)
    for e in ends:
        sm = [(e[i - 1] + 2 * e[i] + e[(i + 1) % NA]) / 4 for i in range(NA)]
        e[:] = sm
    for j in range(NL + 1):
        t = j / NL
        for i in range(NA + 1):
            a = i / NA * 2 * math.pi
            ii = i % NA
            z = -L / 2 + L * t
            if j == 0:
                z += ends[0][ii]
            elif j == NL:
                z -= ends[1][ii]
            r = rad(a, t)
            bx = bend * L * math.sin(t * math.pi) * math.cos(ph[3])
            by = bend * L * math.sin(t * math.pi) * math.sin(ph[3])
            vs.append((r * math.cos(a) + bx, r * math.sin(a) + by, z))
            uvs.append((i / NA, (z + L / 2) / (2 * math.pi * R)))
    row = NA + 1
    for j in range(NL):
        for i in range(NA):
            a = j * row + i
            fs.append((a, a + 1, a + 1 + row, a + row))
    # (the ends: a fan to a middle a little in, the broken face rough)
    for end, j, sgn in ((0, 0, -1), (1, NL, 1)):
        cx = sum(vs[j * row + i][0] for i in range(NA)) / NA
        cy = sum(vs[j * row + i][1] for i in range(NA)) / NA
        cz = sum(vs[j * row + i][2] for i in range(NA)) / NA + sgn * float(rng.uniform(-0.3, 0.6)) * jag
        c = len(vs)
        vs.append((cx, cy, cz))
        uvs.append((0.5, 0.5))
        first = len(vs)
        for i in range(NA):
            x, y, z = vs[j * row + i]
            vs.append((x, y, z))
            a = i / NA * 2 * math.pi
            uvs.append((0.5 + math.cos(a) * 0.15, 0.5 + math.sin(a) * 0.15))
        for i in range(NA):
            p, q = first + i, first + (i + 1) % NA
            fs.append((c, q, p) if sgn < 0 else (c, p, q))
    me_ = bpy.data.meshes.new(name)
    me_.from_pydata(vs, [], fs)
    me_.update()
    uvl = me_.uv_layers.new().data
    for poly in me_.polygons:
        for li in poly.loop_indices:
            uvl[li].uv = uvs[me_.loops[li].vertex_index]
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    finish(o, name, MAT, smooth_shade=True)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return o


parts = []
for k in range(6):
    rng = np.random.default_rng(100 + k)
    parts.append(piece(f"BinStick{k}", 0.3, 0.032, 0.006, rng, bend=0.03 + 0.01 * (k % 3)))
for k in range(6):
    rng = np.random.default_rng(200 + k)
    parts.append(piece(f"BinChunk{k}", float(rng.uniform(0.05, 0.1)), 0.024, 0.012, rng, bend=0.01, NL=6))

root = bpy.data.objects.new("Binchotan", None)
bpy.context.collection.objects.link(root)
for k, o in enumerate(parts):
    o.parent = root
    # (laid out apart in the file, set back at the origin by the game)
    o.location = ((k % 6) * 0.1, (k // 6) * 0.4, 0)

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "binchotan.glb"), os.path.join(PROJECT, "blender", "binchotan.blend"))
print("BINCHOTAN_DONE", len(parts))
