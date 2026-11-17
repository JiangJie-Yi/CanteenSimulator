"""The kitchen's serving counter (配膳台, servecounter.glb; item 167, the owner's, 2026-11-15: the takeaways' boxes stood in a plate at the cook
table's plating place, "if it's the orders that do it, a serving counter, there in the red box": the floor between the cook table and the
freezer); an old bamboo table since items 254 and 286 (the owner's, 2026-11-17: 「改成原木色竹編製的小矮桌，底下也有拉門」, its bamboo the
fence's kind, aged to a yellow-brown and flaking): round culms with their nodes for its legs and rails, a woven top framed in split culm, and
under it a cupboard of two sliding doors; its top level with the cook table's, the takeaways' boxes packed and waiting on it.

- node "ServeCounter": the table. Low-poly: 8-sided culms and boxes, about 600 triangles.
- node "ServeCounterTop": an empty at the middle of its top (what's set on it stands there).
- node "ServeCounterFront": an empty on the floor before its front (+z) middle, where one stands to take from it.

The game's frame, in the bar's units (GuestBar3D's): y up from the floor it stands on, x along it, its front toward +z; its foot's middle at the
origin; H high (the cook table's top, standing on the kitchen's dais), D deep, L long.

Run:
    blender -b --factory-startup --python blender/servecounter.py -- <project path> [preview.png]
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

def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# (the old bamboo table (items 254 and 286, the owner's, 2026-11-17: 「稍微改長一些然後改成原木色竹編製的小矮桌，底下也有拉門」, 「254 張單記得是
# 這種竹(原木色)的就是已經放一段時間的那種竹」 with a picture of the shop's fence's culms, 「然後會有點撥離感」): round culms with their nodes for
# its legs and its rails, aged to a yellow-brown, their skin worn and flaking off in places; its top and its cupboard's sides and back woven
# bamboo (網代編み); under its top a cupboard of two sliding doors, each a frame of split culm round a woven panel, in two tracks; its top level
# with the cook table's still (the takeaways' boxes and the sake station on it), a little longer than it was)
L, D, H = 1.0, 0.36, 0.496
TT = 0.03             # the top's thickness
RIM, RIM_UP = 0.018, 0.006   # the split culms round the top's edge: how wide, how proud of it
LEG_R = 0.0125        # the legs' culms
LEG_IN = 0.032        # the legs' middles in from the top's edges
FLOOR_Y, FLOOR_T = 0.05, 0.012   # the cupboard's floor
CULM_TILE = 0.36      # the culm's picture: its length along a culm (two nodes to it)
WEAVE_TILE = 0.24     # the weave's picture across a panel

N = 512
seed(254)
u, v = grid01(N)
# ---- the culm's skin: around it (u), along it (v)
base = np.array((0.80, 0.64, 0.38), np.float32)
mott = 0.86 + 0.18 * fbm(N, 3, 10, 4)
streak = 0.95 + 0.05 * np.sin((u * 26 + (fbm(N, 4, 2, 3) - 0.5) * 1.2) * 2 * math.pi)
culm = base[None, None, :] * (mott * streak)[..., None]
# (a few dark specks, as old bamboo has)
speck = smooth(0.9, 0.96, vnoise(N, 180, 180)) * smooth(0.55, 0.8, fbm(N, 8, 8, 3))
culm = mix(culm, (0.42, 0.3, 0.17), speck * 0.8)
# (its waxy skin flaked off in places: paler, duller, a thin dark edge round each patch)
flake = fbm(N, 5, 14, 4)
patch = smooth(0.76, 0.79, flake)
edge = smooth(0.73, 0.76, flake) - patch
culm = mix(culm, (0.88, 0.8, 0.62), patch * 0.85)
culm = mix(culm, (0.5, 0.37, 0.21), np.clip(edge, 0, 1) * 0.55)
# (its nodes: two to the picture's length, a dark line with a pale ridge over it and a shade under it)
for c0 in (0.25, 0.75):
    d = v - c0
    line = np.exp(-(d / 0.006) ** 2)
    ridge = np.exp(-((d - 0.014) / 0.008) ** 2)
    shade = np.exp(-((d + 0.02) / 0.016) ** 2)
    culm = mix(culm, (0.94, 0.86, 0.66), ridge * 0.55)
    culm = mix(culm, (0.55, 0.42, 0.25), shade * 0.35)
    culm = mix(culm, (0.32, 0.22, 0.12), line * 0.9)
# ---- the weave: a 2/2 twill of strips, the warp up the picture, the weft across it, each strip its own tone, fibres along it, dark gaps
n = 16
i, j = np.floor(u * n).astype(int), np.floor(v * n).astype(int)
fu, fv = u * n - i, v * n - j
warp_on = ((i + j) % 4) < 2
tone_w = 0.88 + 0.16 * np.random.default_rng(7).random(n)[i]
tone_h = 0.88 + 0.16 * np.random.default_rng(8).random(n)[j]
fib_w = 0.94 + 0.06 * np.sin((fu * 7 + vnoise(N, 64, 8) * 2) * 2 * math.pi)
fib_h = 0.94 + 0.06 * np.sin((fv * 7 + vnoise(N, 8, 64) * 2) * 2 * math.pi)
k = np.where(warp_on, tone_w * fib_w * (0.9 + 0.1 * np.sin(fv * math.pi)), tone_h * fib_h * (0.9 + 0.1 * np.sin(fu * math.pi)))
# (the strip's edges: darker where they part)
gap = np.where(warp_on, smooth(0.0, 0.12, fu) * smooth(0.0, 0.12, 1 - fu), smooth(0.0, 0.12, fv) * smooth(0.0, 0.12, 1 - fv))
weave = base[None, None, :] * (k * (0.55 + 0.45 * gap))[..., None]
# (a little worn here and there: a strip's skin paler in small spots, not blotches over it)
weave = mix(weave, (0.86, 0.78, 0.6), smooth(0.83, 0.87, fbm(N, 14, 14, 4)) * 0.3)
weave = weave * (0.92 + 0.1 * fbm(N, 4, 4, 3))[..., None]
M = {
    "culm": pbr("ServeCulm", (1, 1, 1), tex=image("servecounter_culm", np.clip(culm, 0, 1).astype(np.float32)), rough=0.55),
    "weave": pbr("ServeWeave", (1, 1, 1), tex=image("servecounter_weave", np.clip(weave, 0, 1).astype(np.float32)), rough=0.7),
    "pull": pbr("ServePull", (0.2, 0.14, 0.09), rough=0.6),
}

parts = []


def box_uv(o, tile):
    """every face's picture laid flat on it at its true size, from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        nn = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(nn.z) >= max(abs(nn.x), abs(nn.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(nn.x) >= abs(nn.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


def block(name, lo, hi, mat, tile):
    """a box from `lo` to `hi` (the game's frame), its picture at its true size"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(lo) + Vector(hi)) / 2
    s = Vector(hi) - Vector(lo)
    for vv in bm.verts:
        vv.co = P(c.x + vv.co.x * s.x, c.y + vv.co.y * s.y, c.z + vv.co.z * s.z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    box_uv(o, tile)
    parts.append(o)
    return o


def culm(name, a, b, r, segs=8, turn=0.0):
    """a round culm from `a` to `b` (the game's frame), `segs` round, capped; its picture round it and along it (nodes every half
    CULM_TILE), turned round its length by `turn` (each its own way, so their nodes and patches don't line up)"""
    a, b = Vector(a), Vector(b)
    ax = (b - a)
    length = ax.length
    w = ax.normalized()
    t = Vector((0, 1, 0)) if abs(w.y) < 0.9 else Vector((1, 0, 0))
    e1 = w.cross(t).normalized()
    e2 = w.cross(e1).normalized()
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    for end in (a, b):
        ring = []
        for kk in range(segs):
            ang = 2 * math.pi * kk / segs + turn
            p = end + (e1 * math.cos(ang) + e2 * math.sin(ang)) * r
            ring.append(bm.verts.new(P(p.x, p.y, p.z)))
        rings.append(ring)
    off = (turn * 0.37) % 1.0
    for kk in range(segs):
        k2 = (kk + 1) % segs
        f = bm.faces.new((rings[0][kk], rings[0][k2], rings[1][k2], rings[1][kk]))
        u0, u1 = kk / segs, (kk + 1) / segs
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
    o.data.materials.append(M["culm"])
    for p_ in o.data.polygons:
        p_.use_smooth = len(p_.vertices) == 4
    parts.append(o)
    return o


# ---- the top: a woven panel, the split culms round its edge a little proud of it (the panel stopping a hair short of them)
RIM_R = 0.016
ry = H + RIM_UP - RIM_R
block("ServeTop", (-L / 2 + 2 * RIM_R + 0.001, H - TT, -D / 2 + 2 * RIM_R + 0.001), (L / 2 - 2 * RIM_R - 0.001, H, D / 2 - 2 * RIM_R - 0.001), "weave", WEAVE_TILE)
for sz in (-1, 1):
    z = sz * (D / 2 - RIM_R)
    culm(f"ServeRimLong{sz}", (-L / 2, ry, z), (L / 2, ry, z), RIM_R, turn=0.4 * sz)
for sx in (-1, 1):
    x = sx * (L / 2 - RIM_R)
    culm(f"ServeRimShort{sx}", (x, ry, -D / 2 + 2 * RIM_R + 0.001), (x, ry, D / 2 - 2 * RIM_R - 0.001), RIM_R * 0.94, turn=1.1 * sx)
# ---- the legs, round culms in from the corners, each turned its own way
LX, LZ = L / 2 - LEG_IN, D / 2 - LEG_IN
for n_, (sx, sz) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
    culm(f"ServeLeg{sx}{sz}", (sx * LX, 0, sz * LZ), (sx * LX, H - TT - 0.001, sz * LZ), LEG_R, turn=0.9 * n_)
# ---- the cupboard between the legs: its floor, its back and its ends woven, its doors in two tracks at its front
ix = LX - LEG_R - 0.002          # the cupboard's ends, inside the legs
zb = -LZ + LEG_R * 0.2           # its back's front face
zf = LZ - LEG_R * 0.2            # its front: the doors' outer track's front face
top_y = H - TT - 0.03            # the rail under the top, the doors' tops just under it
block("ServeFloor", (-ix, FLOOR_Y, zb - 0.008), (ix, FLOOR_Y + FLOOR_T, zf - 0.002), "weave", WEAVE_TILE)
block("ServeBack", (-ix, FLOOR_Y + FLOOR_T + 0.001, zb - 0.008), (ix, H - TT - 0.002, zb), "weave", WEAVE_TILE)
for sx in (-1, 1):
    x0, x1 = sorted((sx * (ix - 0.008), sx * ix))
    block(f"ServeEnd{sx}", (x0, FLOOR_Y + FLOOR_T + 0.001, zb + 0.001), (x1, H - TT - 0.002, zf - 0.03), "weave", WEAVE_TILE)
# (the rails between the legs under the top: the front one the doors' top track, the floor's edge their bottom one)
culm("ServeRailFront", (-LX + LEG_R + 0.001, H - TT - 0.02, LZ), (LX - LEG_R - 0.001, H - TT - 0.02, LZ), 0.009, turn=0.7)
for sx in (-1, 1):
    culm(f"ServeRailEnd{sx}", (sx * LX, H - TT - 0.02, -LZ + LEG_R + 0.001), (sx * LX, H - TT - 0.02, LZ - LEG_R - 0.001), 0.009, turn=1.6 * sx)
# (the two doors: each a little over half the opening, one in the outer track, one in the inner, overlapping in the middle; each a frame of
# split culm (four bars) round a woven panel set a hair back in it, a dark finger pull near its outer edge)
DW = ix + 0.02
door_lo, door_hi = FLOOR_Y + FLOOR_T + 0.002, top_y
FB, FT = 0.016, 0.012            # the frame's bars: how wide, how thick
for d_, (x0, x1, zz) in enumerate(((-ix, -ix + DW, zf - FT), (ix - DW, ix, zf - FT * 2 - 0.004))):
    nm = f"ServeDoor{d_}"
    block(nm + "Top", (x0, door_hi - FB, zz), (x1, door_hi, zz + FT), "culm", CULM_TILE)
    block(nm + "Bot", (x0, door_lo, zz), (x1, door_lo + FB, zz + FT), "culm", CULM_TILE)
    block(nm + "L", (x0, door_lo + FB + 0.001, zz), (x0 + FB, door_hi - FB - 0.001, zz + FT), "culm", CULM_TILE)
    block(nm + "R", (x1 - FB, door_lo + FB + 0.001, zz), (x1, door_hi - FB - 0.001, zz + FT), "culm", CULM_TILE)
    block(nm + "Panel", (x0 + FB - 0.002, door_lo + FB - 0.002, zz + 0.003), (x1 - FB + 0.002, door_hi - FB + 0.002, zz + FT - 0.003), "weave", WEAVE_TILE)
    # (its pull: a dark oval let into the frame by its outer edge)
    px = x0 + FB / 2 if d_ == 0 else x1 - FB / 2
    block(nm + "Pull", (px - 0.005, (door_lo + door_hi) / 2 - 0.022, zz + FT), (px + 0.005, (door_lo + door_hi) / 2 + 0.022, zz + FT + 0.0015), "pull", 0.1)

# (one node of it all, its own name; the marks)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
counter = bpy.context.view_layer.objects.active
counter.name = "ServeCounter"
root = bpy.data.objects.new("ServeCounterRoot", None)
bpy.context.collection.objects.link(root)
counter.parent = root
top = bpy.data.objects.new("ServeCounterTop", None)
top.location = P(0, H, 0)
front = bpy.data.objects.new("ServeCounterFront", None)
front.location = P(0, 0, D / 2 + 0.18)
for o in (top, front):
    bpy.context.collection.objects.link(o)
    o.parent = root
print("SERVE_TRIS", sum(len(p.vertices) - 2 for p in counter.data.polygons))
export_dish(root, [counter, top, front, root], os.path.join(PROJECT, "public", "models", "servecounter.glb"),
            os.path.join(PROJECT, "blender", "servecounter.blend"), PREVIEW)
print("SERVE_DONE")
