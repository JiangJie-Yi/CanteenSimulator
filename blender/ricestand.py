"""The rice tub's stand (飯台) by the grill: ricestand.glb, node "RiceStand", in the game's own units, its feet on y 0, its top at H, W square.

Made as a small piece of Japanese furniture rather than a plain table: a thick top of pale hinoki with its edges eased, a raised border of
dark walnut round it (a 縁, so the tub can't slide off) mitred at the corners; four legs of hinoki tapering toward the floor and splayed
out a little; under the top on every side an apron (幕板) of walnut with a cloud-shaped arch cut from its lower edge; low down a shelf of
bamboo slats on two rails, each slat with its nodes, for the rice bowls; and a stretcher (貫) between the legs at either end near the
floor. A dark line of ink where the parts meet is left to the game.

Run:
    blender -b --factory-startup --python blender/ricestand.py -- <project path> [preview.png]
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

W, H = 1.35, 1.08          # (its width and depth, and the height of its top, as the game sets it out)
TOP_T = 0.06               # (the top's thickness)
LEG = 0.085                # (a leg's width at the top; it tapers to 0.7 of it at the foot)
SPLAY = 0.03               # (how far each foot stands out past the top of its leg)
APRON_H = 0.16
SHELF_Y = 0.28


def P(x, y, z):
    """three's frame (x, y up, z toward the front) to Blender's"""
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
seed(31)

# ---- the woods: hinoki pale and fine-grained; walnut dark, its grain bolder; bamboo a warm straw green
N = 512
u, v = grid01(N)
wob = (fbm(N, 2, 6, 4) - 0.5) * 0.06
hin = mix(lin("#e2c08e"), lin("#d4ad76"), smooth(0.3, 1.0, (fbm(N, 3, 2, 4))))
hin = mix(hin, lin("#c39a62"), smooth(0.7, 1.0, (np.sin((v + wob) * 2 * math.pi * 26) * 0.5 + 0.5)) * 0.35)
wal = mix(lin("#6a4428"), lin("#57361f"), smooth(0.3, 1.0, fbm(N, 3, 2, 4)))
wal = mix(wal, lin("#3e2614"), smooth(0.6, 1.0, (np.sin((v + wob * 1.6) * 2 * math.pi * 14) * 0.5 + 0.5)) * 0.5)
M = {
    "hinoki": pbr("StandHinoki", (1, 1, 1), tex=image("T_StandHinoki", hin), rough=0.55, coat=0.2),
    "walnut": pbr("StandWalnut", (1, 1, 1), tex=image("T_StandWalnut", wal), rough=0.45, coat=0.35),
    "bamboo": pbr("StandBamboo", lin("#c9b46c"), rough=0.4, coat=0.3),
    "node": pbr("StandBambooNode", lin("#a8934e"), rough=0.5),
}


def act():
    return bpy.context.view_layer.objects.active


def box_uv(o, scale=1.0):
    """UVs laid from where each face is, along its longest run, so the grain runs along every piece and keeps one scale"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    bm.normal_update()
    dims = o.dimensions
    long_axis = max(range(3), key=lambda i: dims[i])
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        others = [i for i in range(3) if i != ax]
        # (the grain, v, along the piece's long axis where the face has it)
        if long_axis in others:
            a = long_axis
            b = [i for i in others if i != a][0]
        else:
            a, b = others
        for lp in f.loops:
            c = lp.vert.co
            lp[uvl].uv = (c[b] * scale, c[a] * scale * 0.5)
    bm.to_mesh(o.data)
    bm.free()


parts = []


def block(name, size, at, mat, bev=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*at))
    o = act()
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev:
        m = o.modifiers.new("b", "BEVEL"); m.width = bev; m.segments = 2
        bpy.ops.object.modifier_apply(modifier="b")
    box_uv(o)
    o.name = name
    o.data.materials.append(mat)
    parts.append(o)
    return o


# ---- the top: a thick hinoki board, its edges eased
block("StandTop", (W, TOP_T, W), (0, H - TOP_T / 2, 0), M["hinoki"], 0.012)
# (the raised walnut border round it, mitred: each side a strip whose ends are cut at 45°)
BW, BH = 0.06, 0.03
for k in range(4):
    bm = bmesh.new()
    o_, i_ = W / 2, W / 2 - BW
    ring = [(-o_, o_), (o_, o_), (i_, i_), (-i_, i_)]
    lo = [bm.verts.new((x, -y, H)) for x, y in ring]
    hi = [bm.verts.new((x, -y, H + BH)) for x, y in ring]
    bm.faces.new(hi)
    bm.faces.new(lo[::-1])
    for i in range(4):
        bm.faces.new((lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"StandRim{k}")
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(f"StandRim{k}", me)
    bpy.context.collection.objects.link(o)
    o.rotation_euler = (0, 0, k * math.pi / 2)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.ops.object.transform_apply(rotation=True)
    m = o.modifiers.new("b", "BEVEL"); m.width = 0.006; m.segments = 2
    bpy.ops.object.modifier_apply(modifier="b")
    box_uv(o)
    o.data.materials.append(M["walnut"])
    parts.append(o)

# ---- the legs: square, tapering toward the floor, each foot splayed out a little from under the top's corner
LX = W / 2 - LEG / 2 - 0.04
for sx in (-1, 1):
    for sz in (-1, 1):
        bm = bmesh.new()
        t, b_ = LEG / 2, LEG * 0.35
        top_c = Vector((sx * LX, sz * LX))
        foot_c = Vector((sx * (LX + SPLAY), sz * (LX + SPLAY)))
        ys = (0.0, H - TOP_T)
        rings = []
        for y, c, hw in ((ys[0], foot_c, b_), (ys[1], top_c, t)):
            rings.append([bm.verts.new((c.x + dx * hw, -(c.y + dz * hw), y)) for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        bm.faces.new(rings[1])
        bm.faces.new(rings[0][::-1])
        for i in range(4):
            bm.faces.new((rings[0][i], rings[0][(i + 1) % 4], rings[1][(i + 1) % 4], rings[1][i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new("StandLeg"); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new("StandLeg", me)
        bpy.context.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new("b", "BEVEL"); m.width = 0.006; m.segments = 2
        bpy.ops.object.modifier_apply(modifier="b")
        box_uv(o)
        o.data.materials.append(M["hinoki"])
        parts.append(o)


def apron(name, length, at, turn):
    """a walnut apron board under the top, its lower edge cut in a cloud-shaped arch between the legs"""
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "2D"
    cd.fill_mode = "BOTH"
    cd.extrude = 0.012
    cd.bevel_depth = 0.003
    sp = cd.splines.new("POLY")
    pts = [(-length / 2, 0), (length / 2, 0), (length / 2, -APRON_H)]
    # (the lower edge: straight for a hand's width from each leg, then a shallow cloud: two small lobes rising to a broad arch)
    n = 40
    edge = []
    for i in range(n + 1):
        x = length / 2 - 0.1 - (length - 0.2) * i / n
        t = (x + length / 2 - 0.1) / (length - 0.2)            # 1 .. 0 across the arch
        s = max(0.0, math.sin(math.pi * t))
        lobe = 0.02 * math.sin(3 * math.pi * t) ** 2
        edge.append((x, -APRON_H + 0.085 * s ** 0.8 - lobe))
    pts += [(length / 2 - 0.1, -APRON_H)] + edge + [(-length / 2 + 0.1, -APRON_H), (-length / 2, -APRON_H)]
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = act()
    # (stood upright, facing out from the table's side)
    o.rotation_euler = (math.pi / 2, 0, turn)
    o.location = at
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    box_uv(o)
    o.data.materials.clear()
    o.data.materials.append(M["walnut"])
    parts.append(o)


AL = 2 * LX - LEG                # (between the legs)
AY = H - TOP_T                   # (hung from under the top)
AO = LX + LEG / 2 - 0.02         # (set in a little from the legs' outer faces)
apron("StandApronF", AL, Vector(P(0, AY, AO)), 0)
apron("StandApronB", AL, Vector(P(0, AY, -AO)), math.pi)
apron("StandApronL", AL, Vector(P(-AO, AY, 0)), math.pi / 2)
apron("StandApronR", AL, Vector(P(AO, AY, 0)), -math.pi / 2)

# ---- the low shelf: bamboo slats on two walnut rails between the legs, front to back; and a stretcher at either end near the floor
RAIL_IN = LX - LEG / 2 + 0.01
for sx in (-1, 1):
    block("StandRail", (0.04, 0.05, 2 * LX + 0.02), (sx * (LX - 0.005), SHELF_Y - 0.035, 0), M["walnut"], 0.005)
    block("StandStretcher", (0.035, 0.04, 2 * LX + 0.02), (sx * (LX + 0.008), 0.11, 0), M["walnut"], 0.005)
NS = 13
for i in range(NS):
    z = -RAIL_IN + 0.03 + (2 * RAIL_IN - 0.06) * i / (NS - 1)
    L_ = 2 * LX + 0.03
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.021, depth=L_, location=P(0, SHELF_Y + 0.006, z), rotation=(0, math.pi / 2, 0))
    o = act(); o.name = "StandSlat"; o.data.materials.append(M["bamboo"])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    # (two nodes along each, staggered slat to slat)
    for xn in ((-0.25, 0.3) if i % 2 else (-0.4, 0.12)):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.021, minor_radius=0.004, major_segments=12, minor_segments=4,
                                         location=P(xn * L_ / 1.2, SHELF_Y + 0.006, z), rotation=(0, math.pi / 2, 0))
        o = act(); o.name = "StandSlatNode"; o.data.materials.append(M["node"])
        parts.append(o)

for o in parts:
    o.select_set(False)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
stand = act()
stand.name = "RiceStand"
stand.data.name = "RiceStand"
root = bpy.data.objects.new("RiceStandRoot", None)
bpy.context.collection.objects.link(root)
stand.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (2.2, -2.6, 1.9)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0.55)) - cam.location).to_track_quat("-Z", "Y")
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.rotation_euler = (0.7, 0.2, 0.6)
    bpy.context.scene.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.color = (0.5, 0.5, 0.5); bpy.context.scene.world = w
export_dish(root, [stand, root], os.path.join(PROJECT, "public", "models", "ricestand.glb"), os.path.join(PROJECT, "blender", "ricestand.blend"), PREVIEW)
print("RICESTAND_DONE", len(stand.data.polygons))
