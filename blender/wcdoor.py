"""The toilets' sliding doors (引き戸), in cedar: wcdoor.glb, two nodes.

- "WcDoorPanel": one sliding panel, a waist-high board shoji (腰高障子): a frame of straight-grained cedar (two stiles, a top rail, a deep bottom
  rail, a rail across at the waist), below it a board of figured cedar (板目, its grain in arches across it) and above a lattice of fine
  kumiko (three upright, close-set rows across: 横繁) over washi; on the board near the free edge a small brass plate for the lock's little
  window (the game lays 使用中 / 空き on it) and under it a sunk oval pull (引手), black lacquer in a brass rim. Its origin the middle of its
  foot, in the middle of its thickness; its face toward -x (the room), z across it, y up: 0.80 wide and 1.83 tall.
- "WcDoorFrame": the doorway round it, dark cedar: two posts, the head over them and the sill, in the doorway's frame (its middle at z = 0,
  the wall's face at x = 0, the room toward -x).

Every member's grain runs along it (its own UVs), the board's arches across the board. Run:
    blender -b --factory-startup --python blender/wcdoor.py -- <project path> [preview.png]
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
# (the doorway's opening as the game has it: WC_W 0.82 by WC_H 1.85; one repeat of the wood's picture over 0.4 of the wood)
OW, OH = 0.82, 1.85
DW, DH = 0.80, 1.83
TILE = 0.4


def P(x, y, z):
    """the game's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# =====================================================================
# Textures: the wood's grain runs along v
# =====================================================================
def wood(base, dark, figure, N=512, sd=7):
    """cedar: `figure` 0 straight-grained (the frame's members, quarter-sawn), 1 flame-figured (a flat-sawn board, arches nested along it)"""
    seed(sd)
    u, v = grid01(N)
    wob = fbm(N, 3, 2, 4) - 0.5
    straight = u * 9.0 + 0.1 * np.sin(2 * math.pi * v) + wob * 0.5
    # (a flat-sawn board: the log's rings cut through at a slant, so arches nest one inside the next climbing the board (cathedral), the
    # centre line wandering; drawn once over the whole board, not repeated)
    centre = 0.5 + 0.08 * np.sin(2 * math.pi * v * 0.7 + 1.1) + wob * 0.06
    arches = ((u - centre) * 2.0) ** 2 * 5.0 - v * 5.5 + wob * 0.35
    ring = straight * (1 - figure) + arches * figure
    late = smooth(0.6, 0.97, np.sin(2 * math.pi * ring * (2.2 if not figure else 1.0)))
    col = mix(np.broadcast_to(np.asarray(base, np.float32), u.shape + (3,)).copy(), dark, late * (0.7 if not figure else 0.5))
    # (the fine lines between, and the soft streaks along)
    fine = np.sin(2 * math.pi * (u * 40 + wob * 4 + fbm(N, 5, 2, 3)))
    col = mix(col, np.asarray(dark, np.float32), smooth(0.8, 1.0, fine) * 0.25)
    col = col * (0.9 + 0.2 * fbm(N, 8, 2, 3))[..., None]
    # (a knot or two in the figured board)
    if figure:
        for cx, cy, r in ((0.78, 0.22, 0.014),):
            d = np.sqrt(((u - cx) * 1.0) ** 2 + ((v - cy) * 0.5) ** 2)
            col = mix(col, np.asarray(dark, np.float32) * 0.8, smooth(r, r * 0.4, d) * 0.85)
    return col


def washi():
    """the paper: warm white, its fibres showing, a little uneven"""
    seed(3)
    N = 256
    u, v = grid01(N)
    col = mix((0.95, 0.92, 0.85), (0.91, 0.87, 0.78), fbm(N, 6, 6, 4) * 0.6)
    fib = smooth(0.82, 0.95, vnoise(N, 60, 14)) * smooth(0.4, 0.9, vnoise(N, 10, 10))
    return mix(col, (0.82, 0.76, 0.64), fib * 0.5)


M = {"cedar": pbr("WcDoorCedar", (1, 1, 1), tex=image("wcdoorcedar", wood((0.5, 0.32, 0.19), (0.33, 0.19, 0.1), 0)), rough=0.6),
     "board": pbr("WcDoorBoard", (1, 1, 1), tex=image("wcdoorboard", wood((0.64, 0.43, 0.27), (0.42, 0.25, 0.13), 1, sd=9)), rough=0.6),
     "frame": pbr("WcDoorFrameWood", (1, 1, 1), tex=image("wcdoorframe", wood((0.3, 0.18, 0.1), (0.18, 0.1, 0.05), 0, sd=11)), rough=0.6),
     "paper": pbr("WcDoorPaper", (1, 1, 1), tex=image("wcdoorpaper", washi()), rough=0.9),
     "brass": pbr("WcDoorBrass", lin("#c49a48"), rough=0.35, metal=1.0),
     "lacquer": pbr("WcDoorLacquer", lin("#141010"), rough=0.3)}


def beam(name, x, y, z, mat, parts, fit=False):
    """a box from x[0]..x[1], y[0]..y[1], z[0]..z[1] (the game's frame), its UVs on each face from the face's own two axes, the box's
    longest axis along v, so the grain runs along the member"""
    lo, hi = (x[0], y[0], z[0]), (x[1], y[1], z[1])
    size = [hi[i] - lo[i] for i in range(3)]
    long_ax = max(range(3), key=lambda i: size[i])
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    corners = {}
    for ix in (0, 1):
        for iy in (0, 1):
            for iz in (0, 1):
                corners[(ix, iy, iz)] = bm.verts.new(P(x[ix], y[iy], z[iz]))
    # (each face: the axis it faces along, which side, and its four corners in turn)
    for ax in range(3):
        for side in (0, 1):
            others = [a for a in range(3) if a != ax]
            quad = []
            for (p, q) in ((0, 0), (1, 0), (1, 1), (0, 1)):
                key = [0, 0, 0]
                key[ax] = side
                key[others[0]] = p
                key[others[1]] = q
                quad.append(tuple(key))
            if side == 0:
                quad.reverse()
            f = bm.faces.new([corners[k] for k in quad])
            # (u across the grain, v along it: the face's other axis that's the box's long one goes to v)
            a_u, a_v = (others[1], others[0]) if others[0] == long_ax else (others[0], others[1])
            for lp, k in zip(f.loops, quad):
                co = (x[k[0]], y[k[1]], z[k[2]])
                if fit:
                    # (the picture laid once over the whole face, as a board's own figure is)
                    lp[uvl].uv = ((co[a_u] - lo[a_u]) / (size[a_u] or 1), (co[a_v] - lo[a_v]) / (size[a_v] or 1))
                else:
                    lp[uvl].uv = (co[a_u] / TILE + (hash(name) % 97) / 97, co[a_v] / TILE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    m = o.modifiers.new("b", "BEVEL"); m.width = min(0.0025, min(size) * 0.2); m.segments = 1
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="b")
    o.select_set(False)
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


# =====================================================================
# The panel
# =====================================================================
pp = []
T = 0.014                        # (half its thickness)
SW = 0.045                       # (each stile's width)
z0, z1 = -DW / 2, DW / 2
y_foot, y_waist0, y_waist1, y_head = 0.075, 1.0, 1.04, DH - 0.05
# (the frame: the stiles the whole height, the rails between them)
for sd in (-1, 1):
    beam(f"WcStile{sd}", (-T, T), (0, DH), (sd * (DW / 2 - SW) if sd > 0 else z0, z1 if sd > 0 else z0 + SW), M["cedar"], pp)
beam("WcRailFoot", (-T, T), (0, y_foot), (z0 + SW, z1 - SW), M["cedar"], pp)
beam("WcRailWaist", (-T, T), (y_waist0, y_waist1), (z0 + SW, z1 - SW), M["cedar"], pp)
beam("WcRailHead", (-T, T), (y_head, DH), (z0 + SW, z1 - SW), M["cedar"], pp)
# (the board below: set back a little in the frame, its flame figure running up it)
beam("WcBoard", (-0.006, 0.006), (y_foot, y_waist0), (z0 + SW - 0.004, z1 - SW + 0.004), M["board"], pp, fit=True)
# (the paper above, in the middle of the frame's thickness; the kumiko over it, close-set rows across and three uprights)
bpy.ops.mesh.primitive_plane_add(size=1)
paper = bpy.context.view_layer.objects.active
paper.name = "WcPaper"
paper.scale = (DW - 2 * SW + 0.004, y_head - y_waist1 + 0.004, 1)
paper.rotation_euler = (math.pi / 2, 0, math.pi / 2)
paper.location = P(0.0, (y_head + y_waist1) / 2, 0)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
paper.data.materials.append(M["paper"])
pp.append(paper)
kw, kd = 0.011, 0.016
for k in range(1, 4):
    z = z0 + SW + (DW - 2 * SW) * k / 4
    beam(f"WcKumikoV{k}", (-kd / 2 - 0.002, kd / 2 - 0.002), (y_waist1, y_head), (z - kw / 2, z + kw / 2), M["cedar"], pp)
# (four rows across, evenly spaced: half what there were (the owner's))
NR = 5
for k in range(1, NR):
    y = y_waist1 + (y_head - y_waist1) * k / NR
    beam(f"WcKumikoH{k}", (-kd / 2 - 0.002, kd / 2 - 0.002), (y - kw / 2, y + kw / 2), (z0 + SW, z1 - SW), M["cedar"], pp)
# (the lock's little brass plate near the free edge, its window the game's, and the pull under it: a black oval sunk in a brass rim)
LZ = DW / 2 - 0.08
lock = beam("WcLockPlate", (-0.0095, -0.006), (0.915, 0.975), (LZ - 0.048, LZ + 0.048), M["brass"], pp)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.03, depth=0.004, location=P(-0.0075, 0.8, LZ))
rim = bpy.context.view_layer.objects.active
rim.rotation_euler = (0, math.pi / 2, 0)
rim.scale = (1, 0.65, 1)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
rim.name = "WcPullRim"
rim.data.materials.append(M["brass"])
pp.append(rim)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.024, depth=0.0045, location=P(-0.0079, 0.8, LZ))
well = bpy.context.view_layer.objects.active
well.rotation_euler = (0, math.pi / 2, 0)
well.scale = (1, 0.62, 1)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
well.name = "WcPullWell"
well.data.materials.append(M["lacquer"])
pp.append(well)
for o in pp:
    for f in o.data.polygons:
        f.use_smooth = False
panel_root = bpy.data.objects.new("WcDoorPanel", None)
bpy.context.collection.objects.link(panel_root)
for o in pp:
    o.parent = panel_root

# =====================================================================
# The doorway's frame
# =====================================================================
fp = []
for sd in (-1, 1):
    zc = sd * (OW / 2 + 0.03)
    beam(f"WcPost{sd}", (-0.06, 0.0), (0.0, OH + 0.06), (zc - 0.03, zc + 0.03), M["frame"], fp)
beam("WcHead", (-0.07, 0.0), (OH, OH + 0.07), (-(OW / 2 + 0.06), OW / 2 + 0.06), M["frame"], fp)
beam("WcSill", (-0.055, 0.0), (0.0, 0.025), (-(OW / 2 + 0.06), OW / 2 + 0.06), M["frame"], fp)
frame_root = bpy.data.objects.new("WcDoorFrame", None)
bpy.context.collection.objects.link(frame_root)
for o in fp:
    o.parent = frame_root

if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(-2.6, 1.1, 0.9)
    cam.rotation_euler = (P(0, 0.95, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 45
    bpy.context.scene.camera = cam
    for nm, loc, e in (("Key", P(-3, 3, 1.5), 4.5), ("Fill", P(-2, 1, -2), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = e
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (P(0, 1, 0) - loc).to_track_quat("-Z", "Y").to_euler()
    w = bpy.data.worlds.new("W")
    w.color = (0.35, 0.35, 0.37)
    bpy.context.scene.world = w
root = bpy.data.objects.new("WcDoor", None)
bpy.context.collection.objects.link(root)
panel_root.parent = root
frame_root.parent = root
export_dish(root, pp + fp + [panel_root, frame_root, root], os.path.join(PROJECT, "public", "models", "wcdoor.glb"),
            os.path.join(PROJECT, "blender", "wcdoor.blend"), PREVIEW)
print("WCDOOR_DONE", sum(len(p.vertices) - 2 for o in pp + fp for p in o.data.polygons))
