"""The waiting bench in the genkan (bench.glb; the owner's, 2026-11-09: somewhere for those who come in with every stool taken to sit and wait
their turn). Made over in bamboo (item 439, the owner's, 2026-11-21: 「候位長凳才是坐墊位置為竹蓆，也就是老闆後面那個小櫃原本的風格，骨架則是
竹子」: a hinoki bench as a joiner makes one before): its seat a mat of split bamboo woven 網代 (the serving counter's own weave of items 254
and 286), set in a frame of culms; four culm legs, culm stretchers low between them at the ends and along the back, a binding of rattan
round each leg's head where it meets the frame. Its size as before (the sitters sit where they did). Braced as a long bench must be (item
449, the owner's, 2026-11-21: 「你的等候椅底下太空了，會不會垮?」: four thin legs at its ends and the long middle bare under it): six
legs, a pair at its middle as at its ends, the front three set in from the seat's front edge (clear of the sitters' calves), three
bearers under the mat on them; under the frame a second rail along the front and the back from leg to leg, low down long stretchers (貫)
front and back and three across lower still (as a joiner offsets them), thicker culms; about 800 triangles.

The game's frame: y up from the floor, x along the bench, z across it; its middle at the origin; SEAT_H the seat's top, LENGTH long, DEPTH
deep (the people's units: the game draws it at the people's scale, the same every way).

Run:
    blender -b --factory-startup --python blender/bench.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import active, export_dish, fbm, grid01, image, mix, pbr, seed, smooth, vnoise  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

# (its size as the owner set it (items 214, 379): 0.86 long, 0.24 deep against the wall at BACK, its seat's top 0.29)
LENGTH, DEPTH, SEAT_H = 0.86, 0.24, 0.29
BACK = -0.14
MID = BACK + DEPTH / 2
FR = 0.014                # the seat frame's culms' radius
LR = 0.018                # the legs'
SR = 0.011                # the stretchers' and the mat's bearers'
CULM_TILE = 0.3           # the culm's picture along a culm (two nodes to it)
MAT_TILE = 0.24           # the mat's weave: twenty strips across the picture


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 512
seed(439)
u, v = grid01(N)
# ---- the culm's skin (the serving counter's, items 254 and 286: aged, yellow-brown, flaking here and there): round it (u), along it (v)
base = np.array((0.80, 0.64, 0.38), np.float32)
culm = base[None, None, :] * ((0.86 + 0.18 * fbm(N, 3, 10, 4)) * (0.95 + 0.05 * np.sin((u * 26 + (fbm(N, 4, 2, 3) - 0.5) * 1.2) * 2 * math.pi)))[..., None]
culm = mix(culm, (0.42, 0.3, 0.17), smooth(0.9, 0.96, vnoise(N, 180, 180)) * smooth(0.55, 0.8, fbm(N, 8, 8, 3)) * 0.8)
flake = fbm(N, 5, 14, 4)
culm = mix(culm, (0.88, 0.8, 0.62), smooth(0.76, 0.79, flake) * 0.85)
culm = mix(culm, (0.5, 0.37, 0.21), np.clip(smooth(0.73, 0.76, flake) - smooth(0.76, 0.79, flake), 0, 1) * 0.55)
for c0 in (0.25, 0.75):
    d = v - c0
    culm = mix(culm, (0.94, 0.86, 0.66), np.exp(-((d - 0.014) / 0.008) ** 2) * 0.55)
    culm = mix(culm, (0.55, 0.42, 0.25), np.exp(-((d + 0.02) / 0.016) ** 2) * 0.35)
    culm = mix(culm, (0.32, 0.22, 0.12), np.exp(-(d / 0.006) ** 2) * 0.9)
# ---- the mat (網代): split strips woven two over two under, each row a step on, so the weave runs in diagonals; each strip its own tone,
# rounded across (lit down its middle), fibres along it, the one on top over the crossing a shade lighter, a thin dark gap between strips
S_ = 20
fx, fy = u * S_, v * S_
ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
ax, ay = fx - ix, fy - iy
up = ((ix - iy) % 4) < 2                       # (the strip running up it on top here, else the one across)
rs = np.random.default_rng(439)
tone_c, tone_r = 0.84 + 0.22 * rs.random(S_ + 1), 0.84 + 0.22 * rs.random(S_ + 1)
t_ = np.where(up, tone_c[ix % S_], tone_r[iy % S_])
across = np.where(up, ax, ay)                 # (across the strip on top)
along = np.where(up, fy, fx)                  # (along it)
round_ = 0.72 + 0.28 * np.sin(np.pi * np.clip(across, 0, 1)) ** 0.7
gap = smooth(0.0, 0.08, across) * smooth(0.0, 0.08, 1 - across)
fib = 0.95 + 0.05 * np.sin((along * 6 + across * 0.5) * 2 * math.pi)
# (where the strip on top dives under the next crossing, a shade darker: the weave's relief)
dive = np.where(up, ay, ax)
shade = 0.86 + 0.14 * np.sin(np.pi * np.clip(dive, 0, 1))
mat_rgb = base[None, None, :] * (t_ * round_ * fib * shade * (0.35 + 0.65 * gap))[..., None]
mat_rgb = mix(mat_rgb, (0.88, 0.8, 0.62), smooth(0.8, 0.84, fbm(N, 6, 18, 4)) * 0.4 * gap)
M = {
    "culm": pbr("BenchCulm", (1, 1, 1), tex=image("bench_culm", np.clip(culm, 0, 1).astype(np.float32)), rough=0.55),
    "mat": pbr("BenchMat", (1, 1, 1), tex=image("bench_mat", np.clip(mat_rgb, 0, 1).astype(np.float32)), rough=0.6),
    "rattan": pbr("BenchRattan", lin("#5a3a1e"), rough=0.7),
}
parts = []


def culm_part(name, a, b, r, segs=8, turn=0.0, mat="culm"):
    """a round culm from a to b (the game's frame), capped; its picture round it and along it, turned round its length by `turn`"""
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    w = (b - a).normalized()
    t = Vector((0, 1, 0)) if abs(w.y) < 0.9 else Vector((1, 0, 0))
    e1 = w.cross(t).normalized()
    e2 = w.cross(e1).normalized()
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = [[bm.verts.new(P(*(end + (e1 * math.cos(2 * math.pi * k / segs + turn) + e2 * math.sin(2 * math.pi * k / segs + turn)) * r)))
              for k in range(segs)] for end in (a, b)]
    off = (turn * 0.37) % 1.0
    for k in range(segs):
        k2 = (k + 1) % segs
        f = bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
        u0, u1 = k / segs, (k + 1) / segs
        for loop, (uu, vv) in zip(f.loops, ((u0, off), (u1, off), (u1, off + length / CULM_TILE), (u0, off + length / CULM_TILE))):
            loop[uvl].uv = (uu, vv)
    for ring, flip in ((rings[0], True), (rings[1], False)):
        f = bm.faces.new(list(reversed(ring)) if flip else ring)
        for loop in f.loops:
            loop[uvl].uv = (0.5, off)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p_ in o.data.polygons:
        p_.use_smooth = len(p_.vertices) == 4
    parts.append(o)
    return o


def slab(name, x0, x1, y0, y1, z0, z1, mat, tile):
    """a flat box, its top's picture at its true size"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vv in bm.verts:
        vv.co = P((x0 + x1) / 2 + vv.co.x * (x1 - x0), (y0 + y1) / 2 + vv.co.z * (y1 - y0), (z0 + z1) / 2 - vv.co.y * (z1 - z0))
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for loop in f.loops:
            c = loop.vert.co
            loop[uvl].uv = (c.x / tile, c.y / tile)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


# ---- the seat: its frame of culms (along its front and back, across its ends between them), the woven mat set in it a little below
# their tops, on two bearers across under it
ZB, ZF = BACK + FR, BACK + DEPTH - FR
XE = LENGTH / 2 - FR
YF = SEAT_H - FR
for k, zz in enumerate((ZB, ZF)):
    culm_part(f"BenchRail{k}", (-LENGTH / 2, YF, zz), (LENGTH / 2, YF, zz), FR, turn=0.4 + k)
for k, sx in enumerate((-1, 1)):
    culm_part(f"BenchEnd{k}", (sx * XE, YF, ZB + FR + 0.001), (sx * XE, YF, ZF - FR - 0.001), FR, turn=1.3 + k)
slab("BenchSeat", -XE + FR + 0.001, XE - FR - 0.001, SEAT_H - 0.017, SEAT_H - 0.007, ZB + FR + 0.001, ZF - FR - 0.001, "mat", MAT_TILE)
# ---- the legs: three pairs, at its ends a little in and at its middle; the back three under the back rail, up to it; the front three
# set in 3 cm from the seat's front edge (the sitters' calves hang there), up to the bearers; each one's head bound with rattan
LX = LENGTH / 2 - 0.07
ZFL = ZF - 0.03
ZBL = BACK + LR + 0.0026           # (the back three as near the wall as their bindings let them: none into it)
YBR = SEAT_H - 0.017 - SR          # the bearers' middle, under the mat
for k, lx in enumerate((-LX, 0.0, LX)):
    culm_part(f"BenchBearer{k}", (lx, YBR, ZB + FR), (lx, YBR, ZF - FR), SR, segs=6, turn=2.2 + k)
legs_at = [(lx, ZBL, YF - FR * 0.5) for lx in (-LX, 0.0, LX)] + [(lx, ZFL, YBR - SR * 0.5) for lx in (-LX, 0.0, LX)]
for k, (lx, lz, top) in enumerate(legs_at):
    culm_part(f"BenchLeg{k}", (lx, 0.0, lz), (lx, top, lz), LR, turn=0.7 * k + 0.3)
    culm_part(f"BenchBind{k}", (lx, top - 0.04, lz), (lx, top - 0.024, lz), LR + 0.0025, segs=8, mat="rattan")
# ---- a second rail under the frame, along the front and the back from end leg to end leg through the middle one
YA = SEAT_H - 0.075
for k, lz in enumerate((ZBL, ZFL)):
    culm_part(f"BenchApron{k}", (-LX - LR, YA, lz), (LX + LR, YA, lz), SR, segs=6, turn=5.0 + k)
# ---- the stretchers, low: along the front and the back (貫), and across each end and the middle a little lower (offset, as a joiner
# makes them, so no two meet at one point)
SY = 0.085
for k, lz in enumerate((ZBL, ZFL)):
    culm_part(f"BenchStretchLong{k}", (-LX - LR, SY, lz), (LX + LR, SY, lz), SR, segs=6, turn=4.0 + k)
for k, lx in enumerate((-LX, 0.0, LX)):
    culm_part(f"BenchStretch{k}", (lx, SY - 0.025, ZBL + LR + 0.001), (lx, SY - 0.025, ZFL - LR - 0.001), SR, segs=6, turn=3.1 + k)

# (two nodes, as the game had them: the seat and the rest)
bpy.ops.object.select_all(action="DESELECT")
seat_parts = [o for o in parts if o.name == "BenchSeat"]
rest = [o for o in parts if o.name != "BenchSeat"]
for o in rest:
    o.select_set(True)
bpy.context.view_layer.objects.active = rest[0]
bpy.ops.object.join()
bench_legs = active()
bench_legs.name = "BenchLegs"
bench_seat = seat_parts[0]
parts = [bench_seat, bench_legs]
root = bpy.data.objects.new("Bench", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("BENCH_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.15, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.6, 0.55, 0.8)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "bench.glb"), os.path.join(PROJECT, "blender", "bench.blend"), PREVIEW)
print("BENCH_DONE")
