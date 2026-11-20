"""The kitchen's serving counter (配膳台, servecounter.glb; item 167, the owner's, 2026-11-15: the takeaways' boxes stood in a plate at the cook
table's plating place, "if it's the orders that do it, a serving counter, there in the red box": the floor between the cook table and the
freezer). Wood and bamboo (item 403, the owner's, 2026-11-20: 「這要用木竹」: since items 254 and 286 it was all bamboo, its top, its back, its
ends and its doors woven 網代 over all of them, a flat picture of weaving): a board of pale hinoki for its top, its edges eased round; a frame
of darker wood, its square legs and its rails; under the top a cupboard of two sliding doors, each a wooden frame round a panel of split
bamboo (割竹) set upright, a short round culm for its pull; its ends the same split bamboo in their frames, its back a plain board. The aged
bamboo of items 254 and 286 kept (the fence's kind, yellow-brown, flaking): each split strip its own tone, its nodes at heights of its own.
Its top level with the cook table's, the takeaways' boxes packed and waiting on it.

- node "ServeCounter": the table. Low-poly: boxes (the top's and the legs' edges eased) and a few 8-sided culms; the split bamboo, the
  grain in their pictures.
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


# (wood and bamboo, item 403: the top a hinoki board, the frame darker wood, the doors and the ends split bamboo in wooden frames; the culm's
# skin of items 254 and 286 (the fence's kind, 「已經放一段時間的那種竹」, 「然後會有點撥離感」) kept for the split strips and the pulls)
L, D, H = 1.0, 0.36, 0.496
TT = 0.03             # the top's thickness
LEG_W = 0.036         # the legs: square
LEG_IN = 0.034        # the legs' middles in from the top's edges
FLOOR_Y, FLOOR_T = 0.05, 0.012   # the cupboard's floor
CULM_TILE = 0.36      # the culm's picture: its length along a culm (two nodes to it)
SPLIT_TILE = 0.24     # the split bamboo's picture: 16 strips across it, as tall
WOOD_TILE = 0.5       # the boards' pictures

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
# ---- the split bamboo (割竹): culms split and set upright side by side, each strip its own tone, rounded across (its middle lit, its edges
# turning away), a thin dark gap between strips, its nodes at two heights of its own (staggered, as a screen's are), fibres up it
STRIPS = 16
si = np.floor(u * STRIPS).astype(int)
fu = u * STRIPS - si
rs = np.random.default_rng(403)
tone = (0.84 + 0.22 * rs.random(STRIPS))[si]
roundness = 0.7 + 0.3 * np.sin(np.pi * np.clip(fu, 0, 1)) ** 0.6
gaps = smooth(0.0, 0.07, fu) * smooth(0.0, 0.07, 1 - fu)
split = base[None, None, :] * (tone * roundness * (0.3 + 0.7 * gaps))[..., None]
split = split * (0.95 + 0.05 * np.sin((v * 70 + fu * 2) * 2 * math.pi))[..., None]
nodes_at = rs.random(STRIPS)[si]
for k0 in (0.0, 0.5):
    dd = ((v - (nodes_at + k0) % 1.0 + 0.5) % 1.0) - 0.5
    split = mix(split, (0.94, 0.86, 0.66), np.exp(-((dd - 0.012) / 0.008) ** 2) * 0.45)
    split = mix(split, (0.34, 0.24, 0.13), np.exp(-(dd / 0.006) ** 2) * 0.85)
# (and a few strips' skin flaked, paler, as the culms' is: in long narrow patches up a strip, not blots across several)
split = mix(split, (0.88, 0.8, 0.62), smooth(0.74, 0.78, fbm(N, 24, 3, 4)) * 0.6 * gaps)


def wood_picture(base_, dark, rings, seed_):
    """a board's wood: its grain's lines along it (u), wandering, a few streaks; `rings` lines across the picture"""
    seed(seed_)
    # (hinoki's grain fine and straight, wandering only a little: at 2.4 and 0.45 it read as marble)
    wob = fbm(N, 2, 6, 4)
    lines = smooth(0.7, 1.0, np.sin((v * rings + wob * 1.0) * 2 * math.pi))
    col = mix(np.array(base_, np.float32)[None, None, :] * np.ones((N, N, 1), np.float32), dark, lines * 0.28)
    return col * (0.93 + 0.07 * fbm(N, 2, 24, 4))[..., None]


top_wood = wood_picture((0.86, 0.72, 0.52), (0.68, 0.52, 0.34), 16, 4031)
# (a mid brown: darker it went black in the kitchen's shade)
frame_wood = wood_picture((0.54, 0.35, 0.2), (0.38, 0.24, 0.13), 12, 4032)
M = {
    "culm": pbr("ServeCulm", (1, 1, 1), tex=image("servecounter_culm", np.clip(culm, 0, 1).astype(np.float32)), rough=0.55),
    "split": pbr("ServeSplit", (1, 1, 1), tex=image("servecounter_split", np.clip(split, 0, 1).astype(np.float32)), rough=0.55),
    "top": pbr("ServeTopWood", (1, 1, 1), tex=image("servecounter_top", np.clip(top_wood, 0, 1).astype(np.float32)), rough=0.5),
    "frame": pbr("ServeFrameWood", (1, 1, 1), tex=image("servecounter_frame", np.clip(frame_wood, 0, 1).astype(np.float32)), rough=0.55),
}
parts = []


def box_uv(o, tile):
    """every face's picture laid flat on it at its true size, from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    # (its layer named as the culms' and the eased boxes' are: verify() names a new one "Float2", and joined into one mesh with "UVMap"
    # first, every box's picture was lost, all of it at one corner (item 403: the split bamboo a dark gap's colour, black))
    uvl = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
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


def eased(name, lo, hi, mat, bw, segs=2, bottom=True):
    """a box from `lo` to `hi` (the game's frame) with its edges eased round (common.chunky_box: its normals hardened), its picture at its
    true size"""
    o = chunky_box(name, lo[0], hi[0], -hi[2], -lo[2], lo[1], hi[1], bw, segs, M[mat], M[mat], bottom=bottom, uv_scale=WOOD_TILE)
    parts.append(o)
    return o


# ---- the top: one board of hinoki the whole of it, its edges eased round (under too)
eased("ServeTop", (-L / 2, H - TT, -D / 2), (L / 2, H, D / 2), "top", 0.008, 3)
# ---- the legs: square, darker wood, in from the corners, up into the top
LX, LZ = L / 2 - LEG_IN, D / 2 - LEG_IN
for sx in (-1, 1):
    for sz in (-1, 1):
        # (a single chamfer at their edges: two rounds' steps each, four legs, were 400 triangles for what reads the same at this size)
        eased(f"ServeLeg{sx}{sz}", (sx * LX - LEG_W / 2, 0.0, sz * LZ - LEG_W / 2), (sx * LX + LEG_W / 2, H - TT + 0.002, sz * LZ + LEG_W / 2), "frame", 0.004, 1)
# ---- the cupboard between the legs: its floor, its back a plain board, its ends split bamboo in their frames, its doors at its front
ix = LX - LEG_W / 2 - 0.002     # the cupboard's ends, inside the legs
zb = -LZ + LEG_W / 2 - 0.004    # its back's front face
zf = LZ + LEG_W / 2 - 0.004     # its front: the doors' outer track's front face, in a hair from the legs' fronts
top_y = H - TT - 0.03           # the rail under the top: the doors' tops just under it
block("ServeFloor", (-ix, FLOOR_Y, zb - 0.008), (ix, FLOOR_Y + FLOOR_T, zf - 0.002), "frame", WOOD_TILE)
block("ServeBack", (-ix, FLOOR_Y + FLOOR_T + 0.001, zb - 0.01), (ix, H - TT - 0.002, zb), "frame", WOOD_TILE)
# (the rails under the top all round, the front one the doors' top track)
block("ServeRailFront", (-LX + LEG_W / 2 + 0.001, top_y, zf - 0.03), (LX - LEG_W / 2 - 0.001, H - TT - 0.001, zf), "frame", WOOD_TILE)
for sx in (-1, 1):
    x0, x1 = sorted((sx * (ix - 0.012), sx * (ix + 0.001)))
    block(f"ServeRailEnd{sx}", (x0, top_y, -LZ + LEG_W / 2 + 0.001), (x1, H - TT - 0.001, LZ - LEG_W / 2 - 0.001), "frame", WOOD_TILE)
    # (the end's split bamboo, upright between the floor and the rail, set in its frame of the legs and a bottom rail)
    block(f"ServeEndRail{sx}", (x0, FLOOR_Y + FLOOR_T + 0.001, -LZ + LEG_W / 2 + 0.001), (x1, FLOOR_Y + FLOOR_T + 0.03, LZ - LEG_W / 2 - 0.001), "frame", WOOD_TILE)
    xs0, xs1 = sorted((sx * (ix - 0.009), sx * (ix - 0.003)))
    block(f"ServeEnd{sx}", (xs0, FLOOR_Y + FLOOR_T + 0.029, -LZ + LEG_W / 2 + 0.001), (xs1, top_y + 0.001, LZ - LEG_W / 2 - 0.001), "split", SPLIT_TILE)
# (the two doors: each a little over half the opening, one in the outer track, one in the inner, overlapping in the middle; each a frame of
# the darker wood round a panel of split bamboo set a hair back in it, a short round culm for its pull by its outer edge)
DW = ix + 0.02
door_lo, door_hi = FLOOR_Y + FLOOR_T + 0.002, top_y - 0.001
FB, FT = 0.022, 0.014            # the frame's bars: how wide, how thick
for d_, (x0, x1, zz) in enumerate(((-ix, -ix + DW, zf - FT - 0.03 - 0.001), (ix - DW, ix, zf - FT * 2 - 0.03 - 0.005))):
    nm = f"ServeDoor{d_}"
    block(nm + "Top", (x0, door_hi - FB, zz), (x1, door_hi, zz + FT), "frame", WOOD_TILE)
    block(nm + "Bot", (x0, door_lo, zz), (x1, door_lo + FB * 1.4, zz + FT), "frame", WOOD_TILE)
    block(nm + "L", (x0, door_lo + FB * 1.4 + 0.001, zz), (x0 + FB, door_hi - FB - 0.001, zz + FT), "frame", WOOD_TILE)
    block(nm + "R", (x1 - FB, door_lo + FB * 1.4 + 0.001, zz), (x1, door_hi - FB - 0.001, zz + FT), "frame", WOOD_TILE)
    block(nm + "Panel", (x0 + FB - 0.002, door_lo + FB * 1.4 - 0.002, zz + 0.004), (x1 - FB + 0.002, door_hi - FB + 0.002, zz + FT - 0.004), "split", SPLIT_TILE)
    # (its pull: a short culm upright on the frame by its outer edge, standing proud of it)
    px = x0 + FB / 2 if d_ == 0 else x1 - FB / 2
    my = (door_lo + door_hi) / 2
    culm(nm + "Pull", (px, my - 0.035, zz + FT + 0.006), (px, my + 0.035, zz + FT + 0.006), 0.006, segs=6, turn=0.6 * (d_ + 1))

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
