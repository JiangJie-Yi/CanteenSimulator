"""The toilets' fittings, in finer shape:

- toilet.glb, node "WcToilet": a Japanese toilet with its washlet seat, facing -x three (toward the door): a glazed white bowl turned
  round an oval and its foot, the seat and the raised lid in a warm ivory, the washlet's body behind them with a control arm at its side
  (a row of soft buttons, blue and orange), the cistern behind with the hand basin on its lid (手洗い付き), its spout curving over.
- washstand.glb, node "WcWashstand": a hand-wash counter against the wall (its back +x three): a plank of cedar on two brackets, a round
  stone vessel sink sat on it, a brass tap from the wall arching over it, a round mirror framed in wood above, a brass towel ring.

Run:
    blender -b --factory-startup --python blender/wc.py -- <project path>
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


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


def fin(o, name, mat, parts, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def lathe_oval(name, prof, sx=1.0, sz=1.0, segs=40, cx=0.0, cz=0.0):
    """a turned piece, its rings stretched to an oval (sx along x, sz along z), centred at (cx, cz) (three frame)"""
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(cx + r * sx * math.cos(2 * math.pi * j / segs), y, cz + r * sz * math.sin(2 * math.pi * j / segs))) for j in range(segs)])
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    if prof[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if prof[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def rbox(name, size, at, bev=0.01, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*at))
    o = active()
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    if bev:
        m = o.modifiers.new("b", "BEVEL"); m.width = bev; m.segments = segs
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="b")
    o.name = name
    return o


def tube(name, pts, r):
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"; cd.bevel_depth = r; cd.bevel_resolution = 3; cd.resolution_u = 10
    sp = cd.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(P(*p)); bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return active()


def toilet():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {"china": pbr("WcChina", lin("#f6f6f2"), rough=0.12, coat=0.8),
         "ivory": pbr("WcIvory", lin("#ece4d2"), rough=0.3, coat=0.4),
         "dark": pbr("WcInside", lin("#c8ccd0"), rough=0.2),
         "blue": pbr("WcButtonBlue", lin("#3a7ac8"), rough=0.4),
         "orange": pbr("WcButtonOrange", lin("#e88a3a"), rough=0.4),
         "grey": pbr("WcButtonGrey", lin("#9aa0a8"), rough=0.4),
         "chrome": pbr("WcChrome", lin("#d8dce0"), rough=0.12, metal=1.0),
         "water": pbr("WcWater", lin("#9ac8d8"), rough=0.05)}
    parts = []
    # (the bowl: an oval turned up from a narrow foot, flaring to the rim; its inside a shallower glazed well)
    BX = -0.03
    foot = lathe_oval("WcFoot", [(0.13, 0.0), (0.14, 0.01), (0.12, 0.06), (0.11, 0.2), (0.0, 0.2)], 1.35, 1.0, 40, BX, 0)
    fin(foot, "WcFoot", M["china"], parts)
    bowl = lathe_oval("WcBowl", [(0.11, 0.2), (0.16, 0.3), (0.185, 0.37), (0.19, 0.385), (0.17, 0.39), (0.12, 0.33), (0.05, 0.28), (0.0, 0.27)], 1.3, 1.0, 48, BX, 0)
    fin(bowl, "WcBowl", M["china"], parts)
    fin(lathe_oval("WcWater", [(0.0, 0.28), (0.06, 0.28), (0.0, 0.2801)], 1.2, 1.0, 24, BX - 0.01, 0), "WcWater", M["water"], parts)
    # (the seat: a flat ring on the rim; the lid raised against the washlet, standing up)
    seat = lathe_oval("WcSeat", [(0.12, 0.392), (0.19, 0.392), (0.195, 0.405), (0.185, 0.415), (0.125, 0.415), (0.115, 0.405), (0.12, 0.392)], 1.3, 1.0, 48, BX, 0)
    fin(seat, "WcSeat", M["ivory"], parts)
    lid = lathe_oval("WcLid", [(0.0, 0.0), (0.18, 0.0), (0.19, 0.012), (0.17, 0.025), (0.0, 0.03)], 1.25, 1.0, 40, 0, 0)
    lid.rotation_euler = (0, math.radians(-82), 0)
    lid.location = P(0.14, 0.43 + 0.22, 0)
    bpy.ops.object.select_all(action="DESELECT"); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.transform_apply(location=True, rotation=True)
    fin(lid, "WcLid", M["ivory"], parts)
    # (the washlet's body behind the seat, and the arm of buttons at its right)
    fin(rbox("WcWashlet", (0.16, 0.09, 0.34), (0.2, 0.43, 0), 0.03, 4), "WcWashlet", M["ivory"], parts)
    fin(rbox("WcArm", (0.24, 0.05, 0.07), (0.06, 0.46, 0.235), 0.02, 3), "WcArm", M["ivory"], parts)
    for k, mat in enumerate(("blue", "orange", "grey", "grey", "blue")):
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.011, depth=0.006, location=P(-0.03 + k * 0.035, 0.487, 0.235))
        fin(active(), f"WcButton{k}", M[mat], parts)
    # (the cistern behind, its lid a shallow hand basin with the spout curving over it)
    fin(rbox("WcTank", (0.17, 0.36, 0.44), (0.3, 0.56, 0), 0.025, 4), "WcTank", M["china"], parts)
    basin = lathe_oval("WcTankBasin", [(0.0, 0.73), (0.15, 0.73), (0.2, 0.75), (0.21, 0.765), (0.19, 0.77), (0.14, 0.75), (0.0, 0.745)], 0.45, 1.0, 32, 0.3, 0)
    fin(basin, "WcTankBasin", M["china"], parts)
    fin(tube("WcSpout", [(0.36, 0.76, 0.0), (0.36, 0.83, 0.0), (0.33, 0.86, 0.0), (0.29, 0.83, 0.0)], 0.009), "WcSpout", M["chrome"], parts)
    fin(rbox("WcLever", (0.06, 0.015, 0.015), (0.22, 0.68, -0.2), 0.005, 2), "WcLever", M["chrome"], parts)
    root = bpy.data.objects.new("WcToilet", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "toilet.glb"), os.path.join(PROJECT, "blender", "toilet.blend"), None)
    print("TOILET_DONE", sum(len(o.data.polygons) for o in parts))


def washstand():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    seed(3)
    N = 256
    u, v = grid01(N)
    cedar = mix((0.62, 0.4, 0.24), (0.74, 0.5, 0.32), smooth(0.3, 0.9, fbm(N, 3, 40, 4)))
    cedar = mix(cedar, (0.42, 0.24, 0.12), smooth(0.85, 1.0, np.sin((u * 26 + fbm(N, 3, 3, 3) * 3) * math.pi * 2) * 0.5 + 0.5) * 0.4)
    stone = mix((0.32, 0.33, 0.34), (0.46, 0.47, 0.48), fbm(N, 30, 30, 4))
    stone = stone * (1 - 0.15 * (fbm(N, 80, 80, 2) > 0.62))[..., None]
    M = {"cedar": pbr("WashCedar", (1, 1, 1), tex=image("washcedar", cedar), rough=0.45, coat=0.4),
         "bracket": pbr("WashBracket", lin("#4a2e1a"), rough=0.5),
         "stone": pbr("WashStone", (1, 1, 1), tex=image("washstone", stone), rough=0.55),
         "water": pbr("WashWater", lin("#8ab8c8"), rough=0.05),
         "brass": pbr("WashBrass", lin("#c9a04a"), rough=0.25, metal=1.0),
         "mirror": pbr("WashMirror", lin("#c8d8e0"), rough=0.03, metal=1.0),
         "frame": pbr("WashFrame", lin("#6a4428"), rough=0.5)}
    parts = []
    TOP = 0.74
    fin(rbox("WashTop", (0.24, 0.04, 0.36), (-0.12, TOP, 0), 0.006, 2), "WashTop", M["cedar"], parts)
    bpy.ops.object.select_all(action="DESELECT")
    for sd in (-1, 1):
        fin(rbox(f"WashBracket{sd}", (0.18, 0.12, 0.03), (-0.09, TOP - 0.08, sd * 0.13), 0.008, 2), f"WashBracket{sd}", M["bracket"], parts)
    # (the stone bowl: thick walled, round, its inside a deep well, a little water standing in it)
    bowl = lathe_oval("WashBowl", [(0.0, TOP + 0.02), (0.08, TOP + 0.02), (0.11, TOP + 0.05), (0.12, TOP + 0.1), (0.118, TOP + 0.11), (0.1, TOP + 0.11),
                                   (0.095, TOP + 0.06), (0.06, TOP + 0.035), (0.0, TOP + 0.03)], 1.0, 1.0, 40, -0.13, 0)
    fin(bowl, "WashBowl", M["stone"], parts)
    fin(lathe_oval("WashWater", [(0.0, TOP + 0.05), (0.085, TOP + 0.05), (0.0, TOP + 0.0501)], 1, 1, 24, -0.13, 0), "WashWater", M["water"], parts)
    # (the tap: out of the wall, arching over the bowl, a cross handle on top)
    fin(tube("WashTap", [(0.0, TOP + 0.2, 0.0), (-0.06, TOP + 0.22, 0.0), (-0.11, TOP + 0.21, 0.0), (-0.13, TOP + 0.17, 0.0)], 0.009), "WashTap", M["brass"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.022, depth=0.012, location=P(-0.006, TOP + 0.2, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashTapRose", M["brass"], parts)
    for a in (0, math.pi / 2):
        fin(rbox(f"WashHandle{int(a * 10)}", (0.05 if a == 0 else 0.008, 0.008, 0.008 if a == 0 else 0.05), (-0.05, TOP + 0.245, 0), 0.003, 2), f"WashHandle{int(a * 10)}", M["brass"], parts)
    # (the mirror over it, round in a wooden frame; a brass towel ring at its side)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.15, depth=0.02, location=P(-0.012, TOP + 0.55, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashMirrorFrame", M["frame"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.128, depth=0.004, location=P(-0.024, TOP + 0.55, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashMirror", M["mirror"], parts)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.006, major_segments=32, minor_segments=8, location=P(-0.03, TOP + 0.18, 0.26), rotation=(math.pi / 2, 0, 0))
    fin(active(), "WashTowelRing", M["brass"], parts)
    root = bpy.data.objects.new("WcWashstand", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "washstand.glb"), os.path.join(PROJECT, "blender", "washstand.blend"), None)
    print("WASH_DONE", sum(len(o.data.polygons) for o in parts))


toilet()
washstand()
