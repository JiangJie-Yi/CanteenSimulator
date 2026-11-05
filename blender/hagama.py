"""The kitchen's rice pot on its stove (hagama.glb), beside the rice tub, in the game's units (the rice tub's): a little round clay stove (へっつい:
white plaster over clay, a band of dark tiles round its top, a stone foot) with its fire mouth at the front (a dark arch, the coals' glow
inside it the game lights while it's cooking), and on it an iron rice pot (羽釜: its wide flange, the "feather", sitting on the stove's rim,
its shoulder and short sides above, black iron worn brown) under a thick wooden lid (two boards and a bar of a grip), node "KamaLid" (the
game rattles it as the rice boils). The stove's foot at y 0, its middle over the origin; the mouth faces +z.

Run:
    blender -b --factory-startup --python blender/hagama.py -- <project path> [preview.png]
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
seed(23)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)

SR, SH = 0.3, 0.56          # (the stove's radius and height)
FR = 0.33                   # (the pot's flange: wider than the stove's hole, it sits on the rim)
PR, PH = 0.235, 0.17        # (the pot's sides over the flange: radius, height)
LR, LT = 0.25, 0.045        # (the lid: radius, thickness)


def plaster(N=512):
    """the stove's white plaster: chalky, greyer low down, soot up over the fire mouth at the front (u 0.25); a band of dark glazed tiles
    round its top (v over 0.86), a grey stone foot (v under 0.1)"""
    u, v = grid01(N)
    col = mix(lin("#e9e3d6"), lin("#d4cdbd"), fbm(N, 6, 4))
    col = mix(col, lin("#a79e8c"), smooth(0.35, 0.0, v) * 0.45)
    front = np.exp(-((((u - 0.25 + 0.5) % 1.0) - 0.5) / 0.09) ** 2)
    col = mix(col, lin("#5e5446"), front * smooth(0.45, 0.85, v) * 0.4)
    tiles = v > 0.86
    tu, tv = (u * 18) % 1.0, ((v - 0.86) / 0.14 * 2) % 1.0
    shade = (np.floor(u * 18) * 7.31 + np.floor((v - 0.86) / 0.14 * 2) * 3.7) % 1.0
    tile = mix(lin("#20302c"), lin("#34463f"), shade)
    joint = (tu < 0.05) | (tv < 0.08)
    col[tiles] = tile[tiles]
    col[tiles & joint] = lin("#b8b0a0")
    stone = v < 0.1
    col[stone] = mix(lin("#7d7a74"), lin("#9c9890"), fbm(N, 10, 3))[stone]
    # (the fire mouth at the front: a dark arch (0.2 wide, from 0.12 up to 0.32), its edge a little sooty; the glow's quad sits in it)
    ax = (((u - 0.25 + 0.5) % 1.0) - 0.5) * 2 * math.pi * SR * 1.03 / 0.1
    ay = (v * SH - 0.12) / 0.2
    inside = (np.abs(ax) < 1) & (ay > 0) & ((ay < 0.55) | (ax * ax + ((ay - 0.55) / 0.45) ** 2 < 1))
    col = mix(col, lin("#3a3128"), (smooth(1.35, 1.0, np.sqrt(ax * ax + np.maximum(ay - 0.55, 0) ** 2 / 0.2)) * (ay > -0.08)) * 0.5)
    col[inside] = lin("#140d09")
    return col


def iron(N=256):
    """the pot's iron: near black, a dull bloom over it, rusty brown worn into it in blotches"""
    col = mix(lin("#1d1c1b"), lin("#34302c"), fbm(N, 6, 6))
    return mix(col, lin("#5a3a22"), smooth(0.62, 0.85, fbm(N, 5, 5)) * 0.6)


def lidwood(N=256):
    """the lid: pale sugi in two boards, straight grain, a darker joint down the middle, a ring of steam stain round its edge"""
    u, v = grid01(N)
    wob = (fbm(N, 2, 6, 4) - 0.5) * 0.04
    col = mix(lin("#c9a476"), lin("#b48b5c"), smooth(0.3, 1.0, fbm(N, 3, 2, 4)))
    col = mix(col, lin("#8e6a44"), smooth(0.75, 1.0, np.sin((u + wob) * 2 * math.pi * 22) * 0.5 + 0.5) * 0.35)
    col = mix(col, lin("#6e5034"), smooth(0.006, 0.0, np.abs(u - 0.5)))
    r = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2)
    return mix(col, lin("#7a5c3c"), smooth(0.4, 0.5, r) * 0.45)


M = {
    "plaster": pbr("KamaStove", (1, 1, 1), tex=image("T_KamaStove", plaster()), rough=0.85),
    "glow": pbr("KamaGlow", tuple(lin("#ff7a2a")), rough=1.0),
    "iron": pbr("KamaIron", (1, 1, 1), tex=image("T_KamaIron", iron()), rough=0.55, metal=0.6),
    "lid": pbr("KamaLidWood", (1, 1, 1), tex=image("T_KamaLidWood", lidwood()), rough=0.7),
    "grip": pbr("KamaGrip", tuple(lin("#4a3220")), rough=0.6),
}
parts = []


def mesh(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = smooth_
    parts.append(o)
    return o


def lathe(prof, segs=24, top_uv=None, vmax=1.0):
    """turned round y: the profile's (radius, height) pairs; UVs round it (v by height over vmax, u 0 at the back so the front is u 0.25..),
    or laid flat from above (top_uv: its radius). A point on the axis isn't made: the ring beside it is closed in a ladder (no fan)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(r * math.sin(2 * math.pi * j / segs), y, r * math.cos(2 * math.pi * j / segs))) for j in range(segs)]
             if r > 1e-6 else None for (r, y) in prof]

    def uv(f):
        us = []
        for lp in f.loops:
            co = lp.vert.co
            if top_uv:
                lp[uvl].uv = (co.x / (2 * top_uv) + 0.5, -co.y / (2 * top_uv) + 0.5)
            else:
                ang = (math.atan2(co.x, -co.y) / (2 * math.pi) + 0.25) % 1.0
                us.append(ang)
                lp[uvl].uv = (ang, co.z / vmax)
        # (the seam: a face across it takes its u's from the same side)
        if us and max(us) - min(us) > 0.5:
            for lp in f.loops:
                if lp[uvl].uv[0] < 0.5:
                    lp[uvl].uv = (lp[uvl].uv[0] + 1.0, lp[uvl].uv[1])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if a is None or b is None:
            for f in ladder_fill(bm, a or b):
                uv(f)
            continue
        for j in range(segs):
            j2 = (j + 1) % segs
            uv(bm.faces.new((a[j], b[j], b[j2], a[j2])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if top_uv:
        bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f.normal.z < 0])
    return bm


# ---- the stove: a stone foot, the plastered body bellied a little, a rim of tiles turned in to the pot's hole ----
stove = [(0.0, 0.0), (SR * 1.04, 0.0), (SR * 1.06, 0.05), (SR * 1.02, 0.056), (SR * 1.0, 0.1), (SR * 1.03, SH * 0.55), (SR * 1.0, SH - 0.03),
         (SR * 0.98, SH), (PR + 0.02, SH)]
mesh("KamaStove", lathe(stove, vmax=SH), "plaster")


# ---- the coals' glow, low in the fire mouth (drawn on the plaster): a flat quad a few mm out from it (the game lights it while cooking) ----
bm = bmesh.new()
gw, gy0, gy1 = 0.13, 0.125, 0.19
r = SR * 1.0 + 0.012
vs = [bm.verts.new(P(x, y, math.sqrt(r * r - x * x))) for (x, y) in ((-gw / 2, gy0), (gw / 2, gy0), (gw / 2, gy1), (-gw / 2, gy1))]
bm.faces.new(vs)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    if f.normal.y > 0:
        f.normal_flip()
mesh("KamaGlow", bm, "glow", smooth_=False)
# ---- the pot: its rounded bottom down in the stove, the flange (the "feather") out over the rim, the shoulder and short sides up to the lid ----
pot = [(0.0, SH - 0.12), (PR * 0.7, SH - 0.11), (PR * 1.0, SH - 0.06), (PR * 1.05, SH + 0.0), (FR, SH + 0.006), (FR + 0.008, SH + 0.018),
       (FR - 0.01, SH + 0.026), (PR * 1.04, SH + 0.03), (PR * 1.0, SH + PH * 0.6), (PR * 0.98, SH + PH), (PR * 0.93, SH + PH + 0.008)]
mesh("KamaPot", lathe(pot, vmax=SH + PH), "iron")
# ---- the lid: a thick round of wood resting in the pot's mouth, a bar of a grip across it; its own node, rattled by the game ----
lid = mesh("KamaLid", lathe([(0.0, 0.0), (LR, 0.0), (LR, LT), (0.0, LT)], top_uv=LR), "lid")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = P(v.co.x * 0.3, v.co.z * 0.04 + 0.02 + LT, v.co.y * 0.045)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
grip = mesh("KamaLidGrip", bm, "grip", smooth_=False)
grip.parent = lid
lid.location = P(0, SH + PH - 0.012, 0)

root = bpy.data.objects.new("Hagama", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
print("HAGAMA_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.45, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 1.3, 1.5)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "hagama.glb"), os.path.join(PROJECT, "blender", "hagama.blend"), PREVIEW)
print("HAGAMA_DONE")
