"""The owner's futon (futon.glb; item 444, the owner's, 2026-11-21: 「老闆也有體力值，累了也會在一樓打地舖睡」): what he lays down on the shop's
floor by the staff's door the nights he's too tired for the stair, gets into, and folds away in the morning.

Nodes, each its own (the game unrolls, unfolds and folds them, each from its foot end):
- "FutonShiki": the mattress (shikibuton), a cotton-wadded slab with its edges rounded over, its cover pale ecru with a fine blue stripe
  along it; its foot end's middle at its origin, its length along +z.
- "FutonKake": the quilt (kakebuton), thicker, in indigo with a white kasuri cross scattered over it and a plain band where it turns down
  at the shoulders; its middle swelling over the one lying under it, its sides falling to the mattress; its foot end's middle at its origin.
- "FutonMakura": the buckwheat pillow, a soft round-ended roll in white with a blue band; its foot's middle at its origin.

The game's frame, in the bar's units (the owner stands about 1.0 tall in them): y up, z along the futon from its foot to its head.
Low-poly: rounded quads, every cap a ladder, about 650 triangles all told.

Run:
    blender -b --factory-startup --python blender/futon.py -- <project path> [preview.png]
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
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(444)


def P(x, y, z):
    return Vector((x, -z, y))


# (sizes: the mattress, the quilt (from the foot to the shoulders, a little wider), its swell over him, the pillow)
SW, SL, ST = 0.62, 1.25, 0.07
KW, KL, KT, HUMP = 0.78, 0.95, 0.035, 0.44
MW, MD, MH = 0.30, 0.15, 0.085

# ---------------------------------------------------------------- pictures
N = 512
u, v = grid01(N)
# (the mattress's cover: ecru cotton, a fine blue stripe along it every 6 cm, the weave)
stripe = smooth(0.0, 0.004, np.abs(((u * SW) % 0.06) - 0.03) - 0.026)
eggshell = mix((0.90, 0.87, 0.80), (0.84, 0.81, 0.74), fbm(N, 6, 6, 4))
shiki = mix(eggshell, (0.36, 0.48, 0.66), stripe * 0.85)
shiki = shiki * (0.95 + 0.06 * fbm(N, 64, 64, 2))[..., None]
SHIKI_TEX = image("futon_shiki", np.clip(shiki, 0, 1).astype(np.float32))
# (the quilt: indigo, a white kasuri cross every 8 cm in a staggered grid, each a little ragged, a plain lighter band at its head end)
ind = mix((0.10, 0.16, 0.33), (0.14, 0.21, 0.40), fbm(N, 5, 5, 4))
gx, gy = u * KW / 0.08, v * KL / 0.08
row = np.floor(gy)
cx = (gx + (row % 2) * 0.5) % 1.0 - 0.5
cy = gy % 1.0 - 0.5
rag = (fbm(N, 40, 40, 3) - 0.5) * 0.05
cross = np.maximum(smooth(0.06 + rag, 0.03 + rag, np.abs(cx)) * smooth(0.22, 0.18, np.abs(cy)),
                   smooth(0.06 + rag, 0.03 + rag, np.abs(cy)) * smooth(0.22, 0.18, np.abs(cx)))
kake = mix(ind, (0.88, 0.88, 0.84), cross * 0.9)
band = smooth(0.84, 0.86, v)
kake = mix(kake, (0.82, 0.80, 0.72), band)
kake = kake * (0.94 + 0.08 * fbm(N, 48, 48, 2))[..., None]
KAKE_TEX = image("futon_kake", np.clip(kake, 0, 1).astype(np.float32))
# (the pillow: white cotton, a blue band round its middle)
pil = mix((0.93, 0.92, 0.88), (0.86, 0.85, 0.80), fbm(N, 8, 8, 3))
pil = mix(pil, (0.30, 0.44, 0.66), smooth(0.0, 0.01, 0.1 - np.abs(u - 0.5)))
PIL_TEX = image("futon_pillow", np.clip(pil, 0, 1).astype(np.float32))
M = {"shiki": pbr("FutonShiki", (1, 1, 1), tex=SHIKI_TEX, rough=0.9),
     "kake": pbr("FutonKake", (1, 1, 1), tex=KAKE_TEX, rough=0.9),
     "pillow": pbr("FutonMakura", (1, 1, 1), tex=PIL_TEX, rough=0.85)}
parts = []


def make(name, mat, build):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    build(bm, uvl)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def grid_slab(bm, uvl, w, l, top_of, bottom, nx, nz, uv_of):
    """a slab over x in [-w/2, w/2], z in [0, l]: its top a grid of nx x nz quads at top_of(x, z), rounded down its edges to `bottom` (the
    grid's outer ring), its foot a ladder; normals out"""
    xs = [-w / 2 + w * i / nx for i in range(nx + 1)]
    zs = [l * j / nz for j in range(nz + 1)]
    vt = [[bm.verts.new(P(x, top_of(x, z), z)) for x in xs] for z in zs]
    faces = []
    for j in range(nz):
        for i in range(nx):
            faces.append(bm.faces.new((vt[j][i], vt[j][i + 1], vt[j + 1][i + 1], vt[j + 1][i])))
    # (the ring round its foot)
    ring = [vt[0][i] for i in range(nx + 1)] + [vt[j][nx] for j in range(1, nz + 1)] + [vt[nz][i] for i in range(nx - 1, -1, -1)] + [vt[j][0] for j in range(nz - 1, 0, -1)]
    foot = [bm.verts.new(P(c.co.x, bottom, -c.co.y)) for c in ring]
    n = len(ring)
    for k in range(n):
        faces.append(bm.faces.new((ring[k], foot[k], foot[(k + 1) % n], ring[(k + 1) % n])))
    faces += ladder_fill(bm, foot[::-1])
    mid = Vector(P(0, bottom, l / 2))
    for f in faces:
        f.normal_update()
        c = f.calc_center_median()
        want = f.normal.dot(c - mid) > 0 if abs(f.normal.z) < 0.6 else (f.normal.z > 0) == (c.z > bottom + 0.004)
        if not want:
            f.normal_flip()
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = uv_of(co.x, -co.y, co.z)
    return faces


# ---------------------------------------------------------------- the mattress: flat, its edges rounded over (its outer quads lower)
def shiki_top(x, z):
    ex = min(abs(abs(x) - SW / 2), 0.04) / 0.04
    ez = min(min(z, SL - z), 0.04) / 0.04
    e = min(ex, ez)
    return ST * (0.55 + 0.45 * math.sin(e * math.pi / 2))


make("FutonShiki", "shiki", lambda bm, uvl: grid_slab(bm, uvl, SW, SL, shiki_top, 0.002, 4, 6,
                                                     lambda x, y, z: ((x + SW / 2) / SW, z / SL)))


# ---------------------------------------------------------------- the quilt: its middle swelling over him, its sides falling to the mattress
def kake_top(x, z):
    # (across: a rounded swell over his body, its sides down to the mattress's top; along: up from the foot, highest at his belly, easing
    # to his shoulders at its head end)
    a = max(0.0, 1 - (abs(x) / (KW / 2)) ** 2) ** 0.6
    t = z / KL
    along = math.sin(min(1.0, t / 0.6) * math.pi / 2) * (1 - 0.3 * max(0.0, (t - 0.6) / 0.4))
    return ST + 0.004 + KT + HUMP * a * along


make("FutonKake", "kake", lambda bm, uvl: grid_slab(bm, uvl, KW, KL, kake_top, ST + 0.003, 6, 6,
                                                    lambda x, y, z: ((x + KW / 2) / KW, z / KL)))


# ---------------------------------------------------------------- the pillow: a soft roll, its ends rounded
def pillow(bm, uvl):
    segs, rings = 10, 6
    vs = []
    for j in range(rings + 1):
        t = j / rings
        x = -MW / 2 + MW * t
        end = math.sin(math.pi * t) ** 0.35
        vs.append([bm.verts.new(P(x, MH / 2 + (MH / 2) * end * math.sin(2 * math.pi * s / segs) * 0.95,
                                  (MD / 2) * end * math.cos(2 * math.pi * s / segs))) for s in range(segs)])
    faces = []
    for j in range(rings):
        for s in range(segs):
            t = (s + 1) % segs
            faces.append(bm.faces.new((vs[j][s], vs[j][t], vs[j + 1][t], vs[j + 1][s])))
    faces += ladder_fill(bm, vs[0]) + ladder_fill(bm, vs[-1][::-1])
    mid = Vector(P(0, MH / 2, 0))
    for f in faces:
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = ((co.x + MW / 2) / MW, 0.5 + math.atan2(co.z - MH / 2, -co.y) / (2 * math.pi))
    return faces


make("FutonMakura", "pillow", pillow)

root = bpy.data.objects.new("FutonRoot", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
parts[1].location = P(0, 0, 0)
parts[2].location = P(0, ST, SL - 0.16)
print("FUTON_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.15, 0.6)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.1, 1.0, -0.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 3
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 1)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.4, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "futon.glb"), os.path.join(PROJECT, "blender", "futon.blend"), PREVIEW)
print("FUTON_DONE")
