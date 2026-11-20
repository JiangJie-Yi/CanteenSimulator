"""The two stone steps down from the genkan to the street (stonesteps.glb; item 352, the owner's, 2026-11-18: 「石階梯太假了吧」 over item
342's steps: two boxes in the base's masonry picture, read as bricks stacked). Each one long slab the doorway's width, its edges eased, the
tread's front edge worn rounder, faced in the genkan floor's crazy paving (item 395, the owner's, 2026-11-20: three styles of stone one over
another at the way in, 「應該是由裡面第一種為主」): the floor's granite in stones each of its own outline and tint, in the floor's pebble-wash
joints, each stone's edge rounded off (crazy_paving: a picture and its normal map, the faces as they were; the footing's face under the
genkan's edge is laid in the same picture at the same scale, GuestBar3D's ShopBase). In the bar's own units (GuestBar3D's ShopBase: x across the doorway, y up, z out to the street), each slab's middle at its
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
TILE = 0.8          # one repeat of the stones' picture, in the bar's units (about three stones across, as big as the genkan floor's)
JOINT = 0.009       # half a joint's width, the genkan floor's
ROUND = 0.011       # how far in each stone's edge is rounded off, the floor's
# (the floor's stones' tints: pale granite, warm grey, cool grey, a grey, a darker grey; the dark slate last)
TINTS = [(1.0, 1.0, 1.0), (1.02, 0.94, 0.84), (0.84, 0.88, 0.94), (0.9, 0.88, 0.86), (0.66, 0.65, 0.66), (0.5, 0.5, 0.53)]


def P(x, y, z):
    return Vector((x, -z, y))


def crazy_paving(N=1024):
    """(item 395, the owner's, 2026-11-20: 「石階很怪，目前這樣看有三種風格，應該是由裡面第一種為主」: the genkan's floor crazy paving, the footing's
    face in courses of blocks, the steps plain granite) the genkan floor's crazy paving (blender/genkanfloor.py) as a picture that repeats
    every TILE, for the steps and the footing's faces (GuestBar3D's ShopBase lays the same picture at the same scale): its granite in stones
    each of its own outline (the cells round seeds a hand or two apart, measured round the repeat's edges) and its own tint (the floor's, the
    dark slate now and then), each stone's edge rounded off and its middle a little proud; the floor's pebble-wash in the joints, as wide;
    and the height of it all, for the normal map"""
    rng_ = np.random.default_rng(395)
    seeds = []
    tries = 0
    while len(seeds) < 9 and tries < 6000:
        tries += 1
        p = rng_.random(2)
        if all(np.hypot(*(((p - q + 0.5) % 1.0) - 0.5)) * TILE > 0.24 for q in seeds):
            seeds.append(p)
    yy, xx = (np.mgrid[0:N, 0:N].astype(np.float32) + 0.5) / N
    f1 = np.full((N, N), 9.0, np.float32)
    f2 = np.full((N, N), 9.0, np.float32)
    idx = np.zeros((N, N), np.int32)
    for k, (sx, sy) in enumerate(seeds):
        # (the nearest copy of the seed round the repeat: its cells run on over the picture's edges)
        d = np.hypot((xx - sx + 0.5) % 1.0 - 0.5, (yy - sy + 0.5) % 1.0 - 0.5).astype(np.float32) * TILE
        near = d < f1
        f2 = np.where(near, f1, np.minimum(f2, d))
        idx = np.where(near, k, idx)
        f1 = np.where(near, d, f1)
    # (how far in from its stone's edge, about: half the way to the next seed's cell)
    edge = (f2 - f1) / 2
    stone = smooth(JOINT - 0.0012, JOINT + 0.0012, edge)
    fall = smooth(JOINT, JOINT + ROUND, edge)
    dome = smooth(JOINT, 0.12, edge)
    # (the granite, the floor's: a pale grey-beige ground, cloudy, packed with grains; a few darker veins; worn)
    ground = mix((0.60, 0.58, 0.55), (0.47, 0.455, 0.43), fbm(N, 5, 5, 5))
    gran = ground.copy()
    for cells, thr, col, k in ((840, 0.80, (0.08, 0.08, 0.09), 0.9), (600, 0.84, (0.80, 0.79, 0.76), 0.7), (480, 0.86, (0.52, 0.40, 0.35), 0.6),
                               (1024, 0.78, (0.24, 0.24, 0.25), 0.55)):
        chip = smooth(thr, thr + 0.04, vnoise(N, cells, cells))
        gran = mix(gran, col, chip * k)
    vein = np.abs(fbm(N, 3, 7, 5) - 0.5)
    gran = mix(gran, (0.36, 0.355, 0.35), smooth(0.03, 0.0, vein) * 0.35)
    gran = gran * (0.93 + 0.1 * fbm(N, 8, 8, 4))[..., None]
    # (each stone its own tint, as the floor's are given theirs: one of the five, the dark slate one in five)
    tints = np.array([TINTS[int(rng_.integers(0, len(TINTS) - 1))] if rng_.random() > 0.2 else TINTS[-1] for _ in seeds], np.float32)
    # (the floor's tints are its vertices' colours, laid on in the light's linear values; this picture's are the values as they're shown:
    # each tint brought to them (to the power 1/2.2), or the warm grey came out brown and the slate near black)
    col_s = gran * (tints ** (1 / 2.2))[idx]
    # (its edge rounded off, a shade darker where it falls away into the joint (the floor's stones have it from their rounded edges in the
    # light, these from the picture: kept faint, or the steps came out a quarter darker than the floor, 89 against its 124))
    col_s = col_s * (0.9 + 0.1 * fall)[..., None]
    # (and as light as the floor's stones come out under their tints: the floor's picture 130 on average, these 116 (the falling edges, the
    # darker tints laid in); the steps stand out under the eave, in less of the room's light than the floor)
    col_s = col_s * 1.1
    # (the pebble-wash, the floor's: dark cement packed with small round pebbles, black, grey, a few white; laid only where there's joint)
    peb = np.zeros((N, N, 3), np.float32) + np.array([0.20, 0.19, 0.18], np.float32)
    peb = peb * (0.85 + 0.3 * fbm(N, 16, 16, 4))[..., None]
    ph = np.zeros((N, N), np.float32)
    for _ in range(9000):
        cx, cy = rng_.uniform(0, N, 2)
        if edge[int(cy) % N, int(cx) % N] > JOINT + 0.004:
            continue
        r = rng_.uniform(3.0, 6.5)
        tone = rng_.random()
        c_ = np.array((0.06, 0.06, 0.065) if tone < 0.55 else (0.42, 0.41, 0.40) if tone < 0.88 else (0.86, 0.85, 0.82), np.float32)
        c_ = c_ * rng_.uniform(0.85, 1.15)
        ir = int(r) + 2
        gy, gx = np.meshgrid(np.arange(int(cy) - ir, int(cy) + ir + 1), np.arange(int(cx) - ir, int(cx) + ir + 1), indexing="ij")
        d = np.hypot(gx - cx, gy - cy)
        m = np.clip((r - d) / 1.2, 0, 1)
        dm = np.clip(1 - (d / r) ** 2, 0, 1)
        gy %= N
        gx %= N
        peb[gy, gx] = peb[gy, gx] * (1 - m[..., None]) + (c_ * (0.75 + 0.35 * dm)[..., None]) * m[..., None]
        ph[gy, gx] = np.maximum(ph[gy, gx], dm * m)
    col = mix(peb, col_s, stone)
    # (its height: the joints down with their pebbles a little up in them, each stone up, its edge rounded over, its middle a hair proud)
    hgt = (1 - stone) * ph * 0.3 + stone * (0.45 + 0.35 * fall + 0.12 * dome) + 0.03 * fbm(N, 64, 64, 3)
    return np.clip(col, 0, 1).astype(np.float32), hgt.astype(np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)
seed(395)
g_col, g_h = crazy_paving()
STONE = pbr("StoneStepGranite", (1, 1, 1), tex=image("stonestep_paving", g_col),
            nrm=image("stonestep_paving_normal", to_normal(g_h, 3.0), data=True), nrm_strength=1.0, rough=0.7)
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
