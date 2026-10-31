"""The toilets' fittings, in finer shape:

- toilet.glb, node "WcToilet": a Japanese washlet toilet facing -x three (toward the door): one glazed skirted piece from the floor to
  the rim, its oval well; the washlet's ivory body with its seam, power lamp and wand shutter; the seat; the lid (node "WcLid", its origin
  on the hinge, made closed, for the game to lift); the water (node "WcWater", to swirl); the cistern behind with the hand basin on its
  lid (手洗い付き), its spout curving over, the lever at its side.
- wcbits.glb, node "WcBits": the room's small fittings, each its own node, made with its back to a wall at z=0 facing +z: the wall
  remote "WcRemote" (screen, stop, wash and bidet keys), the flush keys "WcFlushKey", the Otohime "WcOtohime" (sakura on its face) and
  its lit ring "WcOtoLed", the walnut paper holder "WcHolder" with the roll "WcRoll" (unit radius, scaled by what's left), its core
  "WcCore" and the folded point "WcFold"; on the floor the brush pot "WcBrushPot" and brush "WcBrush", and the sanitary bin "WcBin".
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


def lathe_oval(name, prof, sx=1.0, sz=1.0, segs=40, cx=0.0, cz=0.0, cap=True):
    """a turned piece, its rings stretched to an oval (sx along x, sz along z), centred at (cx, cz) (three frame); a profile that closes
    on itself (a ring, like the seat) takes cap=False, or its ends would be filled across its hole"""
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(cx + r * sx * math.cos(2 * math.pi * j / segs), y, cz + r * sz * math.sin(2 * math.pi * j / segs))) for j in range(segs)])
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    if cap and prof[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if cap and prof[-1][0] > 1e-4:
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
    M = {"china": pbr("WcChina", lin("#f7f7f3"), rough=0.1, coat=0.9),
         "ivory": pbr("WcIvory", lin("#f1ece0"), rough=0.25, coat=0.5),
         "seam": pbr("WcSeam", lin("#c9c4b8"), rough=0.4),
         "nozzle": pbr("WcNozzle", lin("#9aa4ac"), rough=0.3, metal=0.4),
         "lamp": pbr("WcLamp", lin("#3aa0ff"), rough=0.3, emit=lin("#3aa0ff"), emit_strength=2.0),
         "chrome": pbr("WcChrome", lin("#d8dce0"), rough=0.12, metal=1.0),
         "panel": pbr("WcPanel", lin("#3b4048"), rough=0.25, coat=0.6),
         "stop": pbr("WcButtonOrange", lin("#e8762c"), rough=0.35),
         "blue": pbr("WcButtonBlue", lin("#3a7ac8"), rough=0.35),
         "pink": pbr("WcButtonPink", lin("#e07aa0"), rough=0.35),
         "grey": pbr("WcButtonGrey", lin("#a8adb4"), rough=0.35),
         "water": pbr("WcWater", lin("#8fc4d6"), rough=0.04)}
    parts = []
    BX, SX = -0.03, 1.32
    # (one glazed piece from the floor to the rim: a skirt hiding the trap, swelling to an oval bowl, over the rim and down into its well)
    body = lathe_oval("WcBowl", [(0.128, 0.0), (0.136, 0.006), (0.137, 0.03), (0.131, 0.12), (0.134, 0.2), (0.152, 0.285), (0.174, 0.35),
                                 (0.186, 0.38), (0.188, 0.391), (0.18, 0.397), (0.164, 0.395), (0.146, 0.372), (0.112, 0.33), (0.07, 0.298),
                                 (0.03, 0.288), (0.0, 0.286)], SX, 1.0, 56, BX, 0)
    fin(body, "WcBowl", M["china"], parts)
    # (its back running on into the cistern's foot, all one glaze: a rounded block under the seat's hinge)
    fin(rbox("WcNeck", (0.24, 0.34, 0.27), (0.215, 0.17, 0), 0.06, 5), "WcNeck", M["china"], parts)
    # (the water in the well: its own node, to swirl when it's flushed)
    w = lathe_oval("WcWater", [(0.0, 0.0), (0.068, 0.0), (0.0, 0.0001)], 1.22, 1.0, 32, 0, 0)
    w.location = P(BX - 0.005, 0.297, 0)
    fin(w, "WcWater", M["water"], parts)
    # (the washlet: its body behind the seat, rounded, a seam line round it, the blue power lamp on its side, the wand's grey shutter under its lip)
    fin(rbox("WcWashlet", (0.17, 0.1, 0.4), (0.225, 0.447, 0), 0.04, 5), "WcWashlet", M["ivory"], parts)
    fin(rbox("WcWashletSeam", (0.172, 0.008, 0.402), (0.225, 0.425, 0), 0.003, 2), "WcWashletSeam", M["seam"], parts)
    fin(rbox("WcNozzle", (0.03, 0.012, 0.05), (0.15, 0.405, 0), 0.005, 2), "WcNozzle", M["nozzle"], parts)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.006, location=P(0.2, 0.465, 0.201))
    fin(active(), "WcPowerLamp", M["lamp"], parts)
    # (the washlet's own control arm along the seat's right side: a long rounded panel, its keys on top (おしり blue, ビデ pink, the big
    # orange 止, the dryer and the deodoriser grey, a little lit screen), so it reads at a glance as a 免治便座)
    fin(rbox("WcArm", (0.3, 0.06, 0.08), (0.06, 0.45, 0.235), 0.022, 4), "WcArm", M["ivory"], parts)
    fin(rbox("WcArmFace", (0.25, 0.006, 0.058), (0.05, 0.481, 0.235), 0.004, 2), "WcArmFace", M["panel"], parts)
    fin(rbox("WcArmScreen", (0.05, 0.003, 0.03), (0.14, 0.485, 0.235), 0.002, 1), "WcArmScreen", M["lamp"], parts)
    for k, mat in enumerate(("stop", "blue", "pink", "grey", "grey")):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016 if k == 0 else 0.011, depth=0.008, location=P(0.07 - k * 0.04, 0.487, 0.235))
        fin(active(), f"WcArmButton{k}", M[mat], parts)
    # (the wand, tucked in under the washlet's lip: its own node, slid out over the bowl while it washes)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.007, depth=0.12, location=P(0.16, 0.402, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WcWand", M["nozzle"], parts)
    # (the seat: a soft ring on the rim)
    seat = lathe_oval("WcSeat", [(0.112, 0.399), (0.184, 0.399), (0.192, 0.41), (0.184, 0.422), (0.118, 0.422), (0.108, 0.41), (0.112, 0.399)], SX * 0.985, 1.0, 56, BX, 0, cap=False)
    fin(seat, "WcSeat", M["ivory"], parts)
    # (the lid: a gently domed oval, made closed and hinged on the washlet's front edge, its node's origin on the hinge, so the game lifts it)
    HX, HY = 0.16, 0.432
    lid = lathe_oval("WcLid", [(0.0, -0.008), (0.19, -0.008), (0.197, 0.002), (0.188, 0.016), (0.12, 0.026), (0.0, 0.03)], SX * 0.98, 1.0, 56, BX - HX, 0)
    lid.location = P(HX, HY, 0)
    fin(lid, "WcLid", M["ivory"], parts)
    # (the cistern behind: a rounded tank, the hand-wash basin on its lid (手洗い付き), its spout curving over, the lever on its left side)
    fin(rbox("WcTank", (0.17, 0.34, 0.44), (0.305, 0.58, 0), 0.04, 5), "WcTank", M["china"], parts)
    basin = lathe_oval("WcTankBasin", [(0.0, 0.748), (0.15, 0.748), (0.205, 0.765), (0.212, 0.782), (0.196, 0.788), (0.15, 0.772), (0.0, 0.766)], 0.42, 1.0, 40, 0.3, 0)
    fin(basin, "WcTankBasin", M["china"], parts)
    fin(tube("WcSpout", [(0.365, 0.78, 0.0), (0.365, 0.85, 0.0), (0.34, 0.885, 0.0), (0.3, 0.86, 0.0)], 0.0095), "WcSpout", M["chrome"], parts)
    fin(rbox("WcLever", (0.07, 0.014, 0.016), (0.25, 0.7, -0.225), 0.005, 2), "WcLever", M["chrome"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016, depth=0.012, location=P(0.29, 0.7, -0.222))
    fin(active(), "WcLeverRose", M["chrome"], parts)
    root = bpy.data.objects.new("WcToilet", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "toilet.glb"), os.path.join(PROJECT, "blender", "toilet.blend"), None)
    print("TOILET_DONE", sum(len(o.data.polygons) for o in parts))


def bits():
    """the room's small fittings, each its own node, each made with its back to a wall at z=0 (three), facing +z, its origin on that wall
    (or on the floor, for the brush and the bin)"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {"ivory": pbr("BitIvory", lin("#f1ece0"), rough=0.3, coat=0.4),
         "panel": pbr("BitPanel", lin("#3b4048"), rough=0.25, coat=0.6),
         "lcd": pbr("BitLcd", lin("#8fb8a8"), rough=0.2, emit=lin("#9fd8c0"), emit_strength=0.6),
         "stop": pbr("BitStop", lin("#e8762c"), rough=0.35),
         "blue": pbr("BitBlue", lin("#3a7ac8"), rough=0.35),
         "pink": pbr("BitPink", lin("#e07aa0"), rough=0.35),
         "grey": pbr("BitGrey", lin("#a8adb4"), rough=0.35),
         "chrome": pbr("BitChrome", lin("#d8dce0"), rough=0.12, metal=1.0),
         "walnut": pbr("BitWalnut", lin("#5a3a22"), rough=0.4, coat=0.3),
         "brass": pbr("BitBrass", lin("#c9a04a"), rough=0.25, metal=1.0),
         "paper": pbr("BitPaper", lin("#fbfaf6"), rough=0.8),
         "core": pbr("BitCore", lin("#b08a5a"), rough=0.8),
         "oto": pbr("BitOto", lin("#fbf8f2"), rough=0.3, coat=0.5),
         "sakura": pbr("BitSakura", lin("#f2a6bc"), rough=0.4),
         "grille": pbr("BitGrille", lin("#8a8f96"), rough=0.4),
         "led": pbr("BitLed", lin("#5ab4ff"), rough=0.3, emit=lin("#5ab4ff"), emit_strength=1.5),
         "pot": pbr("BitPot", lin("#e9e2d2"), rough=0.2, coat=0.6),
         "bristle": pbr("BitBristle", lin("#f4f4f0"), rough=0.7),
         "bin": pbr("BitBin", lin("#e8d6d2"), rough=0.3, coat=0.4)}
    groups = {}

    def node(name):
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        groups[name] = []
        return e

    def add(g, o, name, mat, smooth=True):
        fin(o, name, mat, groups[g], smooth)
        o.parent = bpy.data.objects[g]

    def cyl(r, d, at, rot=(0, 0, 0), v=24):
        bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=P(*at), rotation=rot)
        return active()
    # (a cylinder's axis is blender z, three y: turned to blender -y, three +z, out of the wall)
    FRONT = (math.pi / 2, 0, 0)
    # ---- the washlet's wall remote: a slim dark panel framed in ivory, a little screen, the big orange stop, the wash and bidet keys
    # either side, a row of small keys under them
    node("WcRemote")
    add("WcRemote", rbox("RemBody", (0.17, 0.1, 0.02), (0, 0, 0.01), 0.008, 3), "RemBody", M["ivory"])
    add("WcRemote", rbox("RemFace", (0.15, 0.08, 0.004), (0, 0, 0.021), 0.003, 2), "RemFace", M["panel"])
    add("WcRemote", rbox("RemLcd", (0.05, 0.016, 0.003), (-0.035, 0.022, 0.024), 0.001, 1), "RemLcd", M["lcd"])
    add("WcRemote", cyl(0.016, 0.008, (0.0, -0.002, 0.026), FRONT), "RemStop", M["stop"])
    add("WcRemote", cyl(0.011, 0.007, (-0.038, -0.004, 0.025), FRONT), "RemWash", M["blue"])
    add("WcRemote", cyl(0.011, 0.007, (0.038, -0.004, 0.025), FRONT), "RemBidet", M["pink"])
    for k in range(4):
        add("WcRemote", rbox(f"RemKey{k}", (0.018, 0.008, 0.004), (-0.045 + k * 0.03, -0.03, 0.025), 0.002, 1), f"RemKey{k}", M["grey"])
    # ---- the flush keys apart beside it (大 and 小), their own node to press in
    node("WcFlushKey")
    add("WcFlushKey", rbox("FlushPlate", (0.05, 0.07, 0.012), (0.0, 0.0, 0.006), 0.006, 3), "FlushPlate", M["ivory"])
    add("WcFlushKey", cyl(0.016, 0.008, (0.0, 0.006, 0.014), FRONT), "FlushBig", M["chrome"])
    add("WcFlushKey", cyl(0.009, 0.008, (0.0, -0.022, 0.014), FRONT), "FlushSmall", M["chrome"])
    # ---- the Otohime (音姫): a little white box, a sakura flower on its face, a speaker grille, a round sensor with a blue ring that lights
    node("WcOtohime")
    add("WcOtohime", rbox("OtoBody", (0.095, 0.13, 0.035), (0, 0, 0.0175), 0.012, 4), "OtoBody", M["oto"])
    add("WcOtohime", cyl(0.02, 0.006, (0.0, 0.022, 0.036), FRONT, 32), "OtoSensor", M["panel"])
    for k in range(5):
        a = math.pi / 2 + k * 2 * math.pi / 5
        add("WcOtohime", cyl(0.0065, 0.003, (0.03 + 0.008 * math.cos(a), -0.002 + 0.008 * math.sin(a), 0.0355), FRONT, 12), f"OtoPetal{k}", M["sakura"])
    for k in range(5):
        add("WcOtohime", rbox(f"OtoGrille{k}", (0.05, 0.003, 0.002), (0.0, -0.025 - k * 0.008, 0.035), 0.0, 1), f"OtoGrille{k}", M["grille"], False)
    node("WcOtoLed")
    bpy.ops.mesh.primitive_torus_add(major_radius=0.023, minor_radius=0.0025, major_segments=32, minor_segments=6, location=P(0.0, 0.022, 0.037), rotation=FRONT)
    add("WcOtoLed", active(), "OtoLed", M["led"])
    # ---- the paper holder: a walnut shelf with two cheeks, a brass bar between; the roll (its own node, unit radius, scaled to how much
    # is left) round its card core, and a little folded point on the roll's end (三角折り) that shows when it's been freshly seen to
    node("WcHolder")
    add("WcHolder", rbox("HolShelf", (0.17, 0.014, 0.12), (0, 0.07, 0.06), 0.004, 2), "HolShelf", M["walnut"])
    for sd in (-1, 1):
        add("WcHolder", rbox(f"HolCheek{sd}", (0.012, 0.1, 0.11), (sd * 0.079, 0.02, 0.058), 0.003, 2), f"HolCheek{sd}", M["walnut"])
    add("WcHolder", cyl(0.006, 0.15, (0, 0.0, 0.065), (0, math.pi / 2, 0), 12), "HolBar", M["brass"])
    node("WcRoll")
    add("WcRoll", cyl(1.0, 0.105, (0, 0, 0), (0, math.pi / 2, 0), 32), "Roll", M["paper"])
    node("WcCore")
    add("WcCore", cyl(0.021, 0.107, (0, 0, 0), (0, math.pi / 2, 0), 20), "Core", M["core"])
    node("WcFold")
    bm = bmesh.new()
    vs = [bm.verts.new(P(*q)) for q in ((-0.035, 0.0, 0.0), (0.035, 0.0, 0.0), (0.0, -0.032, 0.004))]
    bm.faces.new(vs)
    me = bpy.data.meshes.new("Fold")
    bm.to_mesh(me)
    bm.free()
    fo = bpy.data.objects.new("Fold", me)
    bpy.context.collection.objects.link(fo)
    add("WcFold", fo, "Fold", M["paper"], False)
    # ---- the toilet brush in its pot, on the floor (the brush its own node, to scrub with)
    node("WcBrushPot")
    pot = lathe_oval("BrushPot", [(0.0, 0.0), (0.05, 0.0), (0.056, 0.01), (0.05, 0.16), (0.054, 0.17), (0.046, 0.17), (0.04, 0.03), (0.0, 0.03)], 1, 1, 32, 0, 0)
    add("WcBrushPot", pot, "BrushPot", M["pot"])
    node("WcBrush")
    add("WcBrush", tube("BrushHandle", [(0.0, 0.05, 0.0), (0.0, 0.2, 0.0), (0.004, 0.33, 0.0)], 0.007), "BrushHandle", M["pot"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.034, location=P(0.0, 0.06, 0.0))
    o = active()
    o.scale = (1, 1, 0.9)
    bpy.ops.object.transform_apply(scale=True)
    add("WcBrush", o, "BrushHead", M["bristle"])
    # ---- the sanitary bin (the women's): a slim pedal bin with a round lid
    node("WcBin")
    add("WcBin", lathe_oval("BinBody", [(0.0, 0.0), (0.075, 0.0), (0.08, 0.01), (0.078, 0.23), (0.0, 0.23)], 1.0, 0.7, 32, 0, 0), "BinBody", M["bin"])
    add("WcBin", lathe_oval("BinLid", [(0.0, 0.23), (0.082, 0.23), (0.084, 0.24), (0.06, 0.255), (0.0, 0.258)], 1.0, 0.7, 32, 0, 0), "BinLid", M["ivory"])
    add("WcBin", rbox("BinPedal", (0.05, 0.012, 0.03), (0.0, 0.012, 0.065), 0.004, 2), "BinPedal", M["chrome"])
    allp = []
    for g, ps in groups.items():
        allp += ps + [bpy.data.objects[g]]
    root = bpy.data.objects.new("WcBits", None)
    bpy.context.collection.objects.link(root)
    for g in groups:
        bpy.data.objects[g].parent = root
    export_dish(root, allp + [root], os.path.join(PROJECT, "public", "models", "wcbits.glb"), os.path.join(PROJECT, "blender", "wcbits.blend"), None)
    print("BITS_DONE", sum(len(o.data.polygons) for o in allp if o.type == "MESH"))


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
bits()
washstand()
