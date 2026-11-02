"""The sacks of white rice (白米) by the sake barrels, for the rice balls (the owner's: the room-temperature stock wants rice, its sacks
piled by the sake; after two scanned burlap bags on Sketchfab, looked at only): ricesacks.glb, node "RiceSacks".

Three sacks, unopened, sewn shut at both ends: two lying one on the other, the third stood on its end leaning against them. Each a pillow
of a shape: full and round in its middle, thin and flat toward its sewn edges, its corners pulled out into little ears where the seams
end. The cloth a coarse burlap, paler than the potatoes' (RiceSack: its weave here; the game prints 白米 and the rest on it, the print's
place the middle of each face's UVs). Some 600 triangles.

The game's frame (y up), the pile's foot's middle at the origin, its front toward +z.

Run:
    blender -b --factory-startup --python blender/ricesacks.py -- <project path> [preview.png]
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
rnd = random.Random(31)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# (burlap's coarse plain weave, as the potatoes' sacks (blender/produce.py), paler: a rice sack's fresher, cleaner jute; a little grime to
# the edges where it's been dragged)
S = 512
u, v = grid01(S)
f = 72
wob = (fbm(S, 4, 4) - 0.5) * 0.3
wx, wy = np.abs(np.sin(np.pi * (u * f + wob))), np.abs(np.sin(np.pi * (v * f + wob * 0.7)))
over = (np.floor(u * f + wob) + np.floor(v * f + wob * 0.7)) % 2
thread = np.where(over > 0, 0.3 + 0.7 * wx, 0.3 + 0.7 * wy)
tone = np.where(over > 0, vnoise(S, 3, f), vnoise(S, f, 3))
gaps = smooth(0.02, 0.32, np.minimum(wx, wy))
col = mix((0.62, 0.52, 0.36), (0.9, 0.82, 0.64), np.clip(thread * 0.55 + fbm(S, 6, 6) * 0.35 + (tone - 0.5) * 0.3, 0, 1))
col = mix(col, (0.3, 0.22, 0.13), smooth(0.66, 0.84, fbm(S, 20, 20)) * 0.2)
col *= (0.86 + 0.14 * gaps)[..., None]
edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
col *= (1 - smooth(0.12, 0.0, edge) * 0.25)[..., None]
M = {"sack": pbr("RiceSack", (1, 1, 1), tex=image("rice_burlap", np.clip(col, 0, 1)), rough=0.95)}
parts = []


def pillow(name, at, L, W, T, rot):
    """a sack lying as it's put down: L long (its sewn ends at either end), W wide, T thick at its middle; turned by `rot` (Euler, the game's
    frame) about its middle, then set at `at`. 9 x 7 points over each face, the two faces meeting at its rim"""
    NU, NV = 9, 7
    verts, faces, uvs = [], [], []
    ear = [rnd.uniform(0.01, 0.018) for _ in range(4)]
    for side in (1, -1):
        for i in range(NU):
            for j in range(NV):
                uu = -1 + 2 * i / (NU - 1)
                vv = -1 + 2 * j / (NV - 1)
                # (full in the middle, falling to nothing at the rim; the sewn ends gathered a little narrower)
                th = (T / 2) * max(0.0, 1 - abs(uu) ** 3.2) ** 0.55 * max(0.0, 1 - abs(vv) ** 2.6) ** 0.5
                x = uu * L / 2 * (1 - 0.06 * vv * vv)
                z = vv * W / 2 * (1 - 0.1 * uu ** 4)
                # (the corners pulled out into ears where the seams end)
                if abs(uu) > 0.99 and abs(vv) > 0.99:
                    k = (0 if uu > 0 else 1) + (0 if vv > 0 else 2)
                    x += math.copysign(ear[k], uu)
                    z += math.copysign(ear[k] * 0.6, vv)
                y = side * th * (1 + 0.04 * math.sin(3 * uu + 2 * vv + len(name)))
                verts.append(Vector((x, y, z)))
    for s, side in enumerate((1, -1)):
        o = s * NU * NV
        for i in range(NU - 1):
            for j in range(NV - 1):
                a, b, c, d = o + i * NV + j, o + (i + 1) * NV + j, o + (i + 1) * NV + j + 1, o + i * NV + j + 1
                faces.append((a, d, c, b) if side > 0 else (a, b, c, d))
                q = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)] if side > 0 else [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
                # (the underside's run the other way round, so what's printed on it reads true from its own side too)
                uvs.append([((ii if side > 0 else NU - 1 - ii) / (NU - 1), jj / (NV - 1)) for ii, jj in q])
    me = bpy.data.meshes.new(name)
    rot_m = Euler(rot, "XYZ").to_matrix()
    me.from_pydata([P(*(rot_m @ vv + Vector(at))) for vv in verts], [], faces)
    me.update()
    uvl = me.uv_layers.new().data
    for poly, fu in zip(me.polygons, uvs):
        for li, uv in zip(poly.loop_indices, fu):
            uvl[li].uv = uv
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(M["sack"])
    # (the two faces share their rim's points: welded, so it's closed and shades round its edge)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    parts.append(obj)
    return obj


L, W, T = 0.62, 0.4, 0.17
# (two lying, the upper one a little askew; the third stood on its end against them, leaning back)
pillow("RiceSack0", (0.0, T * 0.42, 0.0), L, W, T, (0.0, 0.08, 0.0))
pillow("RiceSack1", (0.03, T * 1.2, -0.01), L * 0.97, W * 0.98, T * 0.95, (0.03, -0.12, 0.02))
pillow("RiceSack2", (L / 2 + 0.12, L / 2 + 0.02, 0.0), L * 0.96, W, T, (0.0, 0.25, math.pi / 2 - 0.22))

root = bpy.data.objects.new("RiceSacks", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("RICE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.15, 0.2, 0)
    cam.location = P(0.9, 1.0, 1.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "ricesacks.glb"), os.path.join(PROJECT, "blender", "ricesacks.blend"), PREVIEW)
print("RICE_DONE")
