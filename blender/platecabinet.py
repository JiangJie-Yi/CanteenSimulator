"""The dish cabinet's base (食器棚の下台): platecabinet.glb, node "PlateCabinet", a low cupboard of warm cedar the dish rack (PlateRack.tsx)
stands on. Its carcass and a thick top board overhanging a little, a plinth set back at the foot; across the top two drawers (for the
chopsticks and the cloths), each with a small brass pull; below them a pair of sliding doors (引き違い戸) in two tracks, frame and panel, the
panels flat-sawn with their figure, each with a sunk oval pull. The grain runs along every member (its own UVs), the panels' figure laid
once over each.

The game's frame: y up, its front toward +z, the middle of its foot at the origin; 1.0 wide, 0.56 tall, 0.50 deep (one of the two low
racks' own size and a little over: the shop's plates are kept on two of them side by side, low enough to see the kitchen over).

Run:
    blender -b --factory-startup --python blender/platecabinet.py -- <project path> [preview.png]
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
CW, CH, CD = 1.0, 0.56, 0.50
TILE = 0.5


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def wood(base, dark, figure, N=512, sd=5):
    """the rack's cedar: `figure` 0 straight-grained, 1 a flat-sawn panel's arches climbing it (drawn once over the panel)"""
    seed(sd)
    u, v = grid01(N)
    wob = fbm(N, 3, 2, 4) - 0.5
    straight = u * 9.0 + 0.1 * np.sin(2 * math.pi * v) + wob * 0.5
    centre = 0.5 + 0.08 * np.sin(2 * math.pi * v * 0.7 + 1.1) + wob * 0.06
    arches = ((u - centre) * 2.0) ** 2 * 5.0 - v * 4.5 + wob * 0.35
    ring = straight * (1 - figure) + arches * figure
    late = smooth(0.6, 0.97, np.sin(2 * math.pi * ring * (2.2 if not figure else 1.0)))
    col = mix(np.broadcast_to(np.asarray(base, np.float32), u.shape + (3,)).copy(), dark, late * (0.6 if not figure else 0.45))
    fine = np.sin(2 * math.pi * (u * 40 + wob * 4 + fbm(N, 5, 2, 3)))
    col = mix(col, np.asarray(dark, np.float32), smooth(0.8, 1.0, fine) * 0.22)
    return col * (0.9 + 0.2 * fbm(N, 8, 2, 3))[..., None]


# (the rack's two tones: its light shelves and the darker posts and lips)
M = {"carcass": pbr("CabCedar", (1, 1, 1), tex=image("cabcedar", wood((0.66, 0.47, 0.29), (0.45, 0.29, 0.16), 0)), rough=0.6),
     "dark": pbr("CabCedarDark", (1, 1, 1), tex=image("cabcedardark", wood((0.49, 0.33, 0.19), (0.3, 0.18, 0.09), 0, sd=8)), rough=0.6),
     "panel": pbr("CabPanel", (1, 1, 1), tex=image("cabpanel", wood((0.7, 0.5, 0.31), (0.48, 0.31, 0.17), 1, sd=12)), rough=0.6),
     "brass": pbr("CabBrass", lin("#c49a48"), rough=0.35, metal=1.0),
     "lacquer": pbr("CabLacquer", lin("#141010"), rough=0.3),
     "shadow": pbr("CabShadow", lin("#2a1a10"), rough=0.9)}
parts = []


def beam(name, x, y, z, mat, fit=False, bev=0.003):
    """a box over x[0]..x[1], y[0]..y[1], z[0]..z[1] (the game's frame), its UVs on each face from that face's own axes, the box's longest
    axis along v (the grain along the member); `fit`: the picture laid once over each face"""
    lo, hi = (x[0], y[0], z[0]), (x[1], y[1], z[1])
    size = [hi[i] - lo[i] for i in range(3)]
    long_ax = max(range(3), key=lambda i: size[i])
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    corners = {(ix, iy, iz): bm.verts.new(P(x[ix], y[iy], z[iz])) for ix in (0, 1) for iy in (0, 1) for iz in (0, 1)}
    for ax in range(3):
        for side in (0, 1):
            others = [a for a in range(3) if a != ax]
            quad = []
            for (p, q) in ((0, 0), (1, 0), (1, 1), (0, 1)):
                key = [0, 0, 0]
                key[ax] = side; key[others[0]] = p; key[others[1]] = q
                quad.append(tuple(key))
            if side == 0:
                quad.reverse()
            f = bm.faces.new([corners[k] for k in quad])
            a_u, a_v = (others[1], others[0]) if others[0] == long_ax else (others[0], others[1])
            for lp, k in zip(f.loops, quad):
                co = (x[k[0]], y[k[1]], z[k[2]])
                if fit:
                    lp[uvl].uv = ((co[a_u] - lo[a_u]) / (size[a_u] or 1), (co[a_v] - lo[a_v]) / (size[a_v] or 1))
                else:
                    lp[uvl].uv = (co[a_u] / TILE + (hash(name) % 89) / 89, co[a_v] / TILE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if bev:
        m = o.modifiers.new("b", "BEVEL"); m.width = min(bev, min(size) * 0.25); m.segments = 1
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier="b")
        o.select_set(False)
    for f in o.data.polygons:
        f.use_smooth = False
    parts.append(o)
    return o


x0, x1 = -CW / 2, CW / 2
zb, zf = -CD / 2, CD / 2
T = 0.025                         # (the boards' thickness)
PL = 0.07                         # (the plinth's height)
TOP = 0.035                       # (the top board's)
# (the carcass: its sides, the bottom over the plinth, the back, a divider down the middle; the plinth set back; the top board over all,
# standing a little proud at the front and the sides)
for sd in (-1, 1):
    beam(f"CabSide{sd}", (x0, x0 + T) if sd < 0 else (x1 - T, x1), (0, CH - TOP), (zb, zf - 0.005), M["carcass"])
beam("CabBottom", (x0 + T, x1 - T), (PL, PL + T), (zb, zf - 0.01), M["carcass"])
beam("CabBack", (x0 + T, x1 - T), (PL, CH - TOP), (zb, zb + 0.012), M["dark"], bev=0)
beam("CabPlinth", (x0 + T, x1 - T), (0, PL), (zf - 0.06, zf - 0.04), M["dark"])
beam("CabTop", (x0 - 0.015, x1 + 0.015), (CH - TOP, CH), (zb, zf + 0.02), M["carcass"], bev=0.006)
# (the drawers: two across under the top, each a front of the darker wood with a small brass pull; a rail under them)
DR = 0.13
y_dr0, y_dr1 = CH - TOP - DR, CH - TOP
beam("CabRail", (x0 + T, x1 - T), (y_dr0 - 0.022, y_dr0), (zf - 0.03, zf - 0.005), M["carcass"])
for k, (a, b) in enumerate(((x0 + T + 0.004, -0.004), (0.004, x1 - T - 0.004))):
    beam(f"CabDrawer{k}", (a, b), (y_dr0 + 0.006, y_dr1 - 0.006), (zf - 0.028, zf - 0.006), M["dark"])
    beam(f"CabDrawerPull{k}", ((a + b) / 2 - 0.05, (a + b) / 2 + 0.05), ((y_dr0 + y_dr1) / 2 - 0.009, (y_dr0 + y_dr1) / 2 + 0.009), (zf - 0.006, zf + 0.008),
         M["brass"], bev=0.002)
# (the sliding doors under them, in two tracks: the left in front, the right behind it, overlapping a little in the middle; each a frame of
# the darker wood round a figured panel, its pull sunk by its meeting edge)
y_d0, y_d1 = PL + T + 0.006, y_dr0 - 0.028
for k, (a, b, z) in enumerate(((x0 + T + 0.003, 0.03, zf - 0.008), (-0.03, x1 - T - 0.003, zf - 0.032))):
    st = 0.055
    beam(f"CabDoorStileA{k}", (a, a + st), (y_d0, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorStileB{k}", (b - st, b), (y_d0, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorRailT{k}", (a + st, b - st), (y_d1 - st, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorRailB{k}", (a + st, b - st), (y_d0, y_d0 + st), (z - 0.02, z), M["dark"])
    beam(f"CabDoorPanel{k}", (a + st - 0.004, b - st + 0.004), (y_d0 + st - 0.004, y_d1 - st + 0.004), (z - 0.014, z - 0.006), M["panel"], fit=True, bev=0)
    # (the pull, by the edge the other door meets: a black oval in a brass rim, sunk in the stile)
    px = (b - st / 2) if k == 0 else (a + st / 2)
    py = (y_d0 + y_d1) / 2
    for nm, r, d, mat, dz in (("Rim", 0.017, 0.004, M["brass"], 0.0015), ("Well", 0.0135, 0.0045, M["lacquer"], 0.0019)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=d, location=P(px, py, z + dz - 0.002))
        o = bpy.context.view_layer.objects.active
        o.rotation_euler = (math.pi / 2, 0, 0)
        o.scale = (0.62, 1, 1)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        o.name = f"CabPull{nm}{k}"
        o.data.materials.append(mat)
        parts.append(o)
# (the tracks the doors run in: a groove strip at the foot and the head of the opening)
for y_ in (y_d0 - 0.008, y_d1 + 0.002):
    beam(f"CabTrack{int(y_ * 1000)}", (x0 + T, x1 - T), (y_, y_ + 0.008), (zf - 0.045, zf - 0.002), M["dark"], bev=0)
# (and the dark of the inside, seen in the gap between the doors where they overlap)
beam("CabInside", (x0 + T, x1 - T), (PL + T, y_dr0 - 0.022), (zb + 0.012, zb + 0.016), M["shadow"], bev=0)
root = bpy.data.objects.new("PlateCabinet", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.4, 1.1, 2.2)
    cam.rotation_euler = (P(0, 0.35, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 45
    bpy.context.scene.camera = cam
    for nm, loc, e in (("Key", P(2, 3, 2.5), 4.5), ("Fill", P(-2, 1, 1.5), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = e
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (P(0, 0.3, 0) - loc).to_track_quat("-Z", "Y").to_euler()
    w = bpy.data.worlds.new("W"); w.color = (0.35, 0.35, 0.37); bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "platecabinet.glb"), os.path.join(PROJECT, "blender", "platecabinet.blend"), PREVIEW)
print("CABINET_DONE", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
