"""The two stone steps down from the genkan to the street (stonesteps.glb; item 352, the owner's, 2026-11-18: 「石階梯太假了吧」 over item
342's steps: two boxes in the base's masonry picture, read as bricks stacked). Each one long slab of granite (御影石), the doorway's width:
its edges eased, the tread's front edge worn rounder; its picture granite's salt and pepper (white feldspar, grey quartz, black mica in a pale
grey), the tread bush-hammered (a fine stipple) and walked paler down its middle, the riser a little rougher and darker; a normal map from
the same grains. In the bar's own units (GuestBar3D's ShopBase: x across the doorway, y up, z out to the street), each slab's middle at its
origin, as the game measures them: StoneStep1 (the upper) 1.2329 x 0.2247 x 0.168, StoneStep2 1.2289 x 0.1123 x 0.168; the game scales each
to the doorway as it stands (within a percent).

Run:
    blender -b --factory-startup --python blender/stonesteps.py -- <project path> [preview.png]
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
TILE = 0.25         # one repeat of the stone's picture, in the bar's units (half a metre: grains of a few millimetres)


def P(x, y, z):
    return Vector((x, -z, y))


def granite(N=512):
    """the granite's face, tileable: a pale grey ground, grains of three minerals (black mica the smallest and sharpest, grey quartz, white
    feldspar the largest and softest), a slow cloud of tone over it; and its height (grains a little proud, the stipple's pits) for the
    normal map"""
    rng_ = np.random.default_rng(352)
    col = np.ones((N, N, 3), np.float32) * np.array((0.72, 0.71, 0.69), np.float32)
    hgt = np.zeros((N, N), np.float32)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    for n_, r0, r1, c_, hh in ((5200, 1.6, 3.4, (0.84, 0.83, 0.8), 0.25), (4400, 1.0, 2.2, (0.6, 0.6, 0.61), 0.15),
                               (3600, 0.6, 1.4, (0.24, 0.23, 0.23), 0.35)):
        for _ in range(n_):
            cx, cy, r = rng_.uniform(0, N), rng_.uniform(0, N), rng_.uniform(r0, r1)
            ir = int(r) + 2
            ys_, xs_ = np.arange(int(cy) - ir, int(cy) + ir + 1), np.arange(int(cx) - ir, int(cx) + ir + 1)
            gy, gx = np.meshgrid(ys_, xs_, indexing="ij")
            d = np.hypot(gx - cx, gy - cy)
            m = np.clip(r - d + 0.5, 0, 1) * 0.85
            gy %= N
            gx %= N
            col[gy, gx] = col[gy, gx] * (1 - m[..., None]) + np.array(c_, np.float32) * m[..., None]
            hgt[gy, gx] = np.maximum(hgt[gy, gx], m * hh)
    cloud = fbm(N, 3, 3, 4)
    col = col * (0.93 + 0.12 * cloud)[..., None]
    stip = rng_.random((N, N)).astype(np.float32)
    hgt = hgt - 0.25 * (stip > 0.86)
    col = col * (1 - 0.06 * (stip > 0.86))[..., None]
    return np.clip(col, 0, 1).astype(np.float32), hgt.astype(np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)
g_col, g_h = granite()
STONE = pbr("StoneStepGranite", (1, 1, 1), tex=image("stonestep_granite", g_col),
            nrm=image("stonestep_normal", to_normal(g_h, 1.6), data=True), nrm_strength=1.0, rough=0.7)
parts = []


def slab(name, W, H, D, wear):
    """a slab W x H x D about its middle, its edges eased (a bevel of two), the tread's front edge rounder (`wear`); UVs in world size, the
    tread's picture paler down its middle where it's walked (a second UV? no: its colour in the vertices (paler) — kept simple: the picture's
    own)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = P(v.co.x * W, v.co.z * H, -v.co.y * D)
    edges = bm.edges[:]
    bmesh.ops.bevel(bm, geom=edges, offset=0.008, segments=2, profile=0.5, affect="EDGES")
    # (the front top edge worn rounder: the verts along it eased down and back a little more)
    for v in bm.verts:
        gx, gy, gz = v.co.x, v.co.z, -v.co.y
        if gy > H / 2 - 0.012 and gz > D / 2 - 0.012:
            k = min(1.0, (gy - (H / 2 - 0.012)) / 0.012) * min(1.0, (gz - (D / 2 - 0.012)) / 0.012)
            v.co.z -= wear * k
            v.co.y += wear * k * 0.6
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        for lp in f.loops:
            c = lp.vert.co
            gx, gy, gz = c.x, c.z, -c.y
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                lp[uvl].uv = (gx / TILE + 0.37, gz / TILE + 0.11)
            elif abs(n.x) >= abs(n.y):
                lp[uvl].uv = (gz / TILE + 0.71, gy / TILE + 0.29)
            else:
                lp[uvl].uv = (gx / TILE + 0.53, gy / TILE + 0.83)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(STONE)
    for p in o.data.polygons:
        p.use_smooth = False
    parts.append(o)
    return o


s1 = slab("StoneStep1", 1.2329, 0.2247, 0.168, 0.004)
s2 = slab("StoneStep2", 1.2289, 0.1123, 0.168, 0.004)
s2.location = P(0, 0, 0.5)   # (apart in the file; the game sets each where it stands)
root = bpy.data.objects.new("StoneSteps", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("STEPS_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0, 0.25)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.6, 0.5, 1.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.4, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "stonesteps.glb"),
            os.path.join(PROJECT, "blender", "stonesteps.blend"), PREVIEW)
print("STEPS_DONE")
