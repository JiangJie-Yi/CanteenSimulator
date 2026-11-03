"""The entrance's lantern and curtain, in finer shape (their pictures, the shop's name and crest, are still painted by the game):

- chochin.glb, node "Chochin": a long paper lantern (長提灯) 62 cm tall, nearly a cylinder (ChochinSkin, UVs once round it, bottom to top;
  its ribs painted by the game), black lacquered caps top and bottom each with a gold band, a cord loop to hang it by. Its middle at the
  origin.
- noren.glb, node "Noren": the curtain's lacquered rod with brass end caps (NorenRod), and three cloth panels (NorenPanel0..2), each hung from its
  top edge at its own origin (the game swings them about it), soft folds running down it and growing toward the hem, a turned hem, and the cloth
  tabs (乳) looping over the rod. Each panel's UVs 0..1 over it.

Run:
    blender -b --factory-startup --python blender/genkan.py -- <project path>
"""
import math
import os
import sys

import bmesh
import bpy
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


def grid_mesh(name, nu, nv, at):
    """a grid of quads, at(u, v) -> (point, uv) for u, v in 0..1"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = [[bm.verts.new(at(i / nu, j / nv)[0]) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = at(a / nu, b / nv)[1]
    # (facing out: the ink shell drawn round it is its back faces grown a little, and would cover a surface facing in)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def lantern():
    """a long lantern (長提灯): a tall paper cylinder barely swelling at its middle, 62 cm tall and 23 across, black lacquered caps top and
    bottom each with a gold band, a cord loop over the top. Its ribs and their shading are painted (the game's picture), not modelled: a
    smooth body of few faces"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {"paper": pbr("ChochinPaper", lin("#e03a2c"), rough=0.8), "lacquer": pbr("ChochinLacquer", lin("#140a06"), rough=0.3, coat=0.5),
         "gold": pbr("ChochinGold", lin("#d6a84a"), rough=0.3, metal=1.0), "red": pbr("ChochinTassel", lin("#b8241a"), rough=0.7)}
    parts = []
    H, R = 0.62, 0.115

    def skin(u, v):
        # (its rows drawn closer toward the caps, where it curves, and wider across its straight middle)
        v = 0.5 - 0.5 * math.cos(math.pi * v)
        y = v * H - H / 2
        # (nearly straight, swelling a little at its middle, drawn in a touch toward each cap)
        r = R * (0.84 + 0.16 * math.sin(math.pi * v) ** 0.45)
        a = 2 * math.pi * u
        # (the picture turned to read upright from outside: glTF's textures run top-down)
        return P(r * math.cos(a), y, r * math.sin(a)), (1 - u, 1 - v)
    # (24 round and 10 down: smooth shading carries the curve; it was 32 by 16, half again its faces for nothing the eye can tell)
    fin(grid_mesh("ChochinSkin", 24, 10, skin), "ChochinSkin", M["paper"], parts)
    for sd, y in ((1, H / 2 + 0.006), (-1, -H / 2 - 0.006)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=R * 0.86, depth=0.045, location=P(0, y, 0))
        c = active()
        bv = c.modifiers.new("b", "BEVEL"); bv.width = 0.005; bv.segments = 1
        bpy.ops.object.modifier_apply(modifier="b")
        fin(c, f"ChochinCap{'Top' if sd > 0 else 'Bottom'}", M["lacquer"], parts)
        bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.87, minor_radius=0.003, major_segments=24, minor_segments=4, location=P(0, y - sd * 0.014, 0))
        fin(active(), f"ChochinBand{'Top' if sd > 0 else 'Bottom'}", M["gold"], parts)
    # (the cord loop over the top cap)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.026, minor_radius=0.0025, major_segments=14, minor_segments=4, location=P(0, H / 2 + 0.05, 0),
                                     rotation=(math.pi / 2, 0, 0))
    fin(active(), "ChochinBail", M["gold"], parts)
    root = bpy.data.objects.new("Chochin", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "chochin.glb"), os.path.join(PROJECT, "blender", "chochin.blend"), None)
    print("CHOCHIN_DONE", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts))


def noren():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {"cloth": pbr("NorenCloth", lin("#25396a"), rough=0.9), "rod": pbr("NorenRod", lin("#3a2414"), rough=0.35, coat=0.4),
         "brass": pbr("NorenBrass", lin("#c9a04a"), rough=0.3, metal=1.0)}
    parts = []
    W, H, ROD_Y = 1.05, 0.68, 0.0
    PW = W / 3 - 0.012
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.012, depth=W + 0.06, location=P(0, ROD_Y, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "NorenRod", M["rod"], parts)
    for sd in (-1, 1):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.017, subdivisions=2, location=P(sd * (W / 2 + 0.035), ROD_Y, 0))
        fin(active(), f"NorenCap{sd}", M["brass"], parts)
    for k in range(3):
        cx = (k - 1) * (W / 3)

        def panel(u, v, k=k):
            x = (u - 0.5) * PW
            y = -0.03 - v * (H - 0.03)
            # (soft folds down it, deeper toward the hem, each panel its own; the hem turned a touch toward the room)
            fold = (0.004 + 0.012 * v) * math.sin(u * math.pi * 5 + k * 1.3) + 0.004 * math.sin(u * math.pi * 11 + k)
            curl = 0.01 * max(0.0, v - 0.94) / 0.06
            return P(x, y, fold - curl), (u, v)
        # (12 across for its folds, 5 down: they only deepen toward the hem, and the cloth's picture is its texture's; 24 x 12 made each
        # panel 1,872 triangles with its thickness, 20 down 2,700)
        pnl = grid_mesh(f"NorenPanel{k}", 12, 5, panel)
        sol = pnl.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.003
        bpy.context.view_layer.objects.active = pnl
        bpy.ops.object.modifier_apply(modifier="t")
        # (its tabs: three loops of the same cloth over the rod)
        tabs = []
        for t in (-0.38, 0, 0.38):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.022, minor_radius=0.004, major_segments=10, minor_segments=4,
                                             location=P(t * PW, ROD_Y - 0.008, 0), rotation=(0, math.pi / 2, 0))
            tb = active(); tb.scale = (1.0, 0.7, 1.4)
            bpy.ops.object.transform_apply(scale=True)
            tabs.append(tb)
        for tb in tabs:
            tb.select_set(True)
        pnl.select_set(True)
        bpy.context.view_layer.objects.active = pnl
        bpy.ops.object.join()
        # (its own origin at its top middle, where it swings from)
        pnl.location = (0, 0, 0)
        for vt in pnl.data.vertices:
            vt.co.x += cx
        fin(pnl, f"NorenPanel{k}", M["cloth"], parts)
        bpy.context.scene.cursor.location = P(cx, ROD_Y, 0)
        bpy.ops.object.select_all(action="DESELECT"); pnl.select_set(True); bpy.context.view_layer.objects.active = pnl
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    root = bpy.data.objects.new("Noren", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "noren.glb"), os.path.join(PROJECT, "blender", "noren.blend"), None)
    print("NOREN_DONE", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts))


# (each made on its own when asked: GENKAN_ONLY=lantern makes the lanterns alone, leaving the noren's file as it is)
ONLY = os.environ.get("GENKAN_ONLY", "lantern,noren")
if "lantern" in ONLY:
    lantern()
if "noren" in ONLY:
    noren()
