"""The toilets' fittings, in finer shape:

- toilet.glb, node "WcToilet": a Japanese washlet toilet facing -x three (toward the door): one glazed skirted piece from the floor to
  the rim, its oval well; the washlet's ivory body with its seam, power lamp and wand shutter; the seat; the lid (node "WcLid", its origin
  on the hinge, made closed, for the game to lift); the water (node "WcWater", to swirl); the cistern behind with the hand basin on its
  lid (手洗い付き), its spout curving over, the lever at its side.
- wcbits.glb, node "WcBits": the room's small fittings, each its own node, made with its back to a wall at z=0 facing +z: the wall
  remote "WcRemote" (screen, stop, wash and bidet keys), the flush keys "WcFlushKey", the Otohime "WcOtohime" (sakura on its face) and
  its lit ring "WcOtoLed", the walnut paper holder "WcHolder" with the roll "WcRoll" (unit radius, scaled by what's left), its core
  "WcCore" and the folded point "WcFold"; on the floor the brush pot "WcBrushPot" and brush "WcBrush", and the sanitary bin "WcBin"; the
  women's sanitary pads "WcPads" (a hinoki wall shelf, a rattan basket of them in pastel wrappers).
- washstand.glb, node "WcWashstand": the washroom's vanity against its back wall (its back +x three): a hinoki counter on a dark cedar
  cabinet with sliding lattice doors, a Shigaraki vessel bowl with a brass drain, a soap bottle, a brass wall tap whose cross handle is
  its own node ("WashTapHandle"), the marks "WashSpoutTip" and "WashBowlFloor" for the game's water, and a round mirror over it.

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


def lathe_oval(name, prof, sx=1.0, sz=1.0, segs=24, cx=0.0, cz=0.0, cap=True):
    """a turned piece, its rings stretched to an oval (sx along x, sz along z), centred at (cx, cz) (three frame); a profile that closes
    on itself (a ring, like the seat) takes cap=False, or its ends would be filled across its hole. A profile's end on the axis (r 0) isn't a
    point all its ring gathers into: the ring next to it is closed across by a ladder of quads instead (the owner's: a fan of triangles into a
    middle shades in a dark blotch), as an end off the axis is"""
    while len(prof) > 2 and prof[0][0] <= 1e-4:
        prof = prof[1:]
    while len(prof) > 2 and prof[-1][0] <= 1e-4:
        prof = prof[:-1]
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(cx + r * sx * math.cos(2 * math.pi * j / segs), y, cz + r * sz * math.sin(2 * math.pi * j / segs))) for j in range(segs)])
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    if cap:
        ladder_fill(bm, list(reversed(rings[0])))
        ladder_fill(bm, rings[-1])
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


def tube(name, pts, r, caps=False, res=3, ru=10):
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"; cd.bevel_depth = r; cd.bevel_resolution = res; cd.resolution_u = ru
    cd.use_fill_caps = caps
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
                                 (0.03, 0.288), (0.0, 0.286)], SX, 1.0, 40, BX, 0)
    fin(body, "WcBowl", M["china"], parts)
    # (its back running on into the cistern's foot, all one glaze: a rounded block under the seat's hinge)
    fin(rbox("WcNeck", (0.24, 0.34, 0.27), (0.215, 0.17, 0), 0.06, 3), "WcNeck", M["china"], parts)
    # (the water in the well: its own node, to swirl when it's flushed)
    # (a thin disc, its two faces ladders across it: no point in its middle for the swirl to gather into)
    w = lathe_oval("WcWater", [(0.068, 0.0), (0.068, 0.0001)], 1.22, 1.0, 20, 0, 0)
    w.location = P(BX - 0.005, 0.297, 0)
    fin(w, "WcWater", M["water"], parts)
    # (the washlet: its body behind the seat, rounded, a seam line round it, the blue power lamp on its side, the wand's grey shutter under its lip)
    fin(rbox("WcWashlet", (0.17, 0.1, 0.4), (0.225, 0.447, 0), 0.04, 3), "WcWashlet", M["ivory"], parts)
    fin(rbox("WcWashletSeam", (0.172, 0.008, 0.402), (0.225, 0.425, 0), 0.003, 2), "WcWashletSeam", M["seam"], parts)
    fin(rbox("WcNozzle", (0.03, 0.012, 0.05), (0.15, 0.405, 0), 0.005, 2), "WcNozzle", M["nozzle"], parts)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.006, location=P(0.2, 0.465, 0.201))
    fin(active(), "WcPowerLamp", M["lamp"], parts)
    # (the washlet's own control arm along the seat's right side: a long rounded panel, its keys on top (おしり blue, ビデ pink, the big
    # orange 止, the dryer and the deodoriser grey, a little lit screen), so it reads at a glance as a 免治便座)
    fin(rbox("WcArm", (0.3, 0.06, 0.08), (0.06, 0.45, 0.235), 0.022, 3), "WcArm", M["ivory"], parts)
    fin(rbox("WcArmFace", (0.25, 0.006, 0.058), (0.05, 0.481, 0.235), 0.004, 2), "WcArmFace", M["panel"], parts)
    fin(rbox("WcArmScreen", (0.05, 0.003, 0.03), (0.14, 0.485, 0.235), 0.002, 1), "WcArmScreen", M["lamp"], parts)
    for k, mat in enumerate(("stop", "blue", "pink", "grey", "grey")):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016 if k == 0 else 0.011, depth=0.008, location=P(0.07 - k * 0.04, 0.487, 0.235))
        fin(active(), f"WcArmButton{k}", M[mat], parts)
    # (the wand, tucked in under the washlet's lip: its own node, slid out over the bowl while it washes)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.007, depth=0.12, location=P(0.16, 0.402, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WcWand", M["nozzle"], parts)
    # (the seat: a soft ring on the rim)
    seat = lathe_oval("WcSeat", [(0.112, 0.399), (0.184, 0.399), (0.192, 0.41), (0.184, 0.422), (0.118, 0.422), (0.108, 0.41), (0.112, 0.399)], SX * 0.985, 1.0, 40, BX, 0, cap=False)
    fin(seat, "WcSeat", M["ivory"], parts)
    # (the lid: a gently domed oval, made closed and hinged on the washlet's front edge, its node's origin on the hinge, so the game lifts it)
    HX, HY = 0.16, 0.432
    lid = lathe_oval("WcLid", [(0.0, -0.008), (0.19, -0.008), (0.197, 0.002), (0.188, 0.016), (0.12, 0.026), (0.0, 0.03)], SX * 0.98, 1.0, 40, BX - HX, 0)
    lid.location = P(HX, HY, 0)
    fin(lid, "WcLid", M["ivory"], parts)
    # (the cistern behind: a rounded tank, the hand-wash basin on its lid (手洗い付き), its spout curving over, the lever on its left side)
    fin(rbox("WcTank", (0.17, 0.34, 0.44), (0.305, 0.58, 0), 0.04, 3), "WcTank", M["china"], parts)
    basin = lathe_oval("WcTankBasin", [(0.0, 0.748), (0.15, 0.748), (0.205, 0.765), (0.212, 0.782), (0.196, 0.788), (0.15, 0.772), (0.0, 0.766)], 0.42, 1.0, 32, 0.3, 0)
    fin(basin, "WcTankBasin", M["china"], parts)
    # (the spout: a round foot on the basin's back, a gooseneck rising and curving over in one smooth bend (its ends closed: an open pipe
    # end showed as a ring), a nozzle at its tip, its dark outlet underneath, over the basin's middle; the game's water runs from SPOUT_TIP)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.017, depth=0.012, location=P(0.372, 0.778, 0))
    fin(active(), "WcSpoutFoot", M["chrome"], parts)
    fin(tube("WcSpout", [(0.372, 0.78, 0.0), (0.372, 0.832, 0.0), (0.364, 0.868, 0.0), (0.338, 0.888, 0.0), (0.31, 0.882, 0.0),
                         (0.297, 0.868, 0.0)], 0.0105, caps=True, res=2, ru=5), "WcSpout", M["chrome"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0125, depth=0.016, location=P(0.295, 0.861, 0))
    fin(active(), "WcSpoutTip", M["chrome"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.008, depth=0.002, location=P(0.295, 0.8525, 0))
    fin(active(), "WcSpoutOutlet", M["panel"], parts)
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
         "bin": pbr("BitBin", lin("#e8d6d2"), rough=0.3, coat=0.4),
         "hinoki": pbr("BitHinoki", lin("#dcc096"), rough=0.5),
         "rattan": pbr("BitRattan", lin("#b98a52"), rough=0.6),
         "padPink": pbr("BitPadPink", lin("#f4b8ca"), rough=0.45, coat=0.3),
         "padWhite": pbr("BitPadWhite", lin("#f8f4f1"), rough=0.45, coat=0.3),
         "padLilac": pbr("BitPadLilac", lin("#cbb8e6"), rough=0.45, coat=0.3)}
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
    pot = lathe_oval("BrushPot", [(0.0, 0.0), (0.05, 0.0), (0.056, 0.01), (0.05, 0.16), (0.054, 0.17), (0.046, 0.17), (0.04, 0.03), (0.0, 0.03)], 1, 1, 20, 0, 0)
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
    add("WcBin", lathe_oval("BinBody", [(0.0, 0.0), (0.075, 0.0), (0.08, 0.01), (0.078, 0.23), (0.0, 0.23)], 1.0, 0.7, 20, 0, 0), "BinBody", M["bin"])
    add("WcBin", lathe_oval("BinLid", [(0.0, 0.23), (0.082, 0.23), (0.084, 0.24), (0.06, 0.255), (0.0, 0.258)], 1.0, 0.7, 20, 0, 0), "BinLid", M["ivory"])
    add("WcBin", rbox("BinPedal", (0.05, 0.012, 0.03), (0.0, 0.012, 0.065), 0.004, 2), "BinPedal", M["chrome"])
    # ---- the women's: sanitary pads, free to take (the owner's: 女廁有提供衛生棉): a little hinoki shelf on the wall (its origin where the
    # shelf's top meets the wall) on two brackets, a woven rattan basket on it, the pads in it stood on end like cards, each in its own pastel
    # wrapper, leaning a little this way and that
    node("WcPads")
    add("WcPads", rbox("PadShelf", (0.22, 0.014, 0.1), (0, -0.007, 0.05), 0.003, 2), "PadShelf", M["hinoki"])
    for sd in (-1, 1):
        add("WcPads", rbox(f"PadBracket{sd}", (0.012, 0.06, 0.07), (sd * 0.085, -0.044, 0.035), 0.002, 1), f"PadBracket{sd}", M["hinoki"])
    add("WcPads", lathe_oval("PadBasket", [(0.0, 0.0), (0.05, 0.0), (0.054, 0.004), (0.057, 0.048), (0.053, 0.05), (0.05, 0.01), (0.0, 0.01)],
                             1.45, 0.8, 20, 0, 0.05), "PadBasket", M["rattan"])
    for k, (c, lean) in enumerate((("padPink", -0.12), ("padWhite", -0.05), ("padLilac", 0.02), ("padPink", 0.06), ("padWhite", 0.1), ("padLilac", 0.16))):
        o = rbox(f"Pad{k}", (0.013, 0.064, 0.05), (-0.052 + k * 0.021, 0.042, 0.05), 0.005, 2)
        o.rotation_euler = (0, lean, 0)
        add("WcPads", o, f"Pad{k}", M[c])
    allp = []
    for g, ps in groups.items():
        allp += ps + [bpy.data.objects[g]]
    root = bpy.data.objects.new("WcBits", None)
    bpy.context.collection.objects.link(root)
    for g in groups:
        bpy.data.objects[g].parent = root
    export_dish(root, allp + [root], os.path.join(PROJECT, "public", "models", "wcbits.glb"), os.path.join(PROJECT, "blender", "wcbits.blend"), None)
    print("BITS_DONE", sum(len(o.data.polygons) for o in allp if o.type == "MESH"))


def box_uv(o, k, up=False):
    """box-projected UVs, `k` repeats a metre, the picture's u (its grain) along the piece's length: across the stand (three z) unless `up`
    (along three y: for what stands upright, the slats and the doors' stiles)"""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new()
    uv = me.uv_layers.active.data
    for f in me.polygons:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in f.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            tx, ty, tz = co.x, co.z, -co.y
            if ax == 2:
                a, b = tz, tx
            elif ax == 0:
                a, b = tz, ty
            else:
                a, b = tx, ty
            if up and ax != 2:
                a, b = b, a
            uv[li].uv = (a * k, b * k)
    return o


def lathe_uv(name, prof, segs=24, cx=0.0, cz=0.0):
    """a turned piece with its picture on it: u round it, v along its profile by length (0 at its first point, 1 at its last); a profile that
    starts or ends on the axis (r 0) isn't gathered into a point there: the ring next to the axis is closed by a ladder of quads across it
    (the owner's: a fan into a middle shades in a dark blotch). Returns the piece and its profile's points' places along it (0..1), as
    before, the axis ends among them"""
    L = [0.0]
    for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
        L.append(L[-1] + math.hypot(r1 - r0, y1 - y0))
    total = L[-1]
    shut = [prof[0][0] < 1e-6, prof[-1][0] < 1e-6]
    lo, hi = (1 if shut[0] else 0), len(prof) - (1 if shut[1] else 0)
    pg, lg = prof[lo:hi], L[lo:hi]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(cx + r * math.cos(2 * math.pi * j / segs), y, cz + r * math.sin(2 * math.pi * j / segs))) for j in range(segs)] for (r, y) in pg]
    for i in range(len(pg) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
            for l, (uu, vi) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                l[uvl].uv = (uu / segs, lg[vi] / total)
    for k, ring in ((0, list(reversed(rings[0]))), (-1, rings[-1])):
        if not shut[0 if k == 0 else 1]:
            continue
        for f in ladder_fill(bm, ring):
            for l in f.loops:
                l[uvl].uv = (rings[k].index(l.vert) / segs, lg[k] / total)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o, [x / total for x in L]


def washstand():
    """the washroom's vanity, the first thing seen as the door's slid open (the owner's): its back to the wall at x=0 (three), facing -x.
    A thick counter of pale hinoki on a low cabinet of dark cedar, two sliding doors of upright hinoki slats (引き違いの竪格子) on it over a
    shadowed plinth; on the counter a Shigaraki vessel bowl (warm speckled clay, a glassy green ash glaze run down from its scorched rim and
    pooled deep in its well, a brass drain), a little celadon soap bottle with a brass pump; a brass wall tap over the bowl (横水栓: its
    body out of the wall, the cross handle on its bonnet a node of its own, WashTapHandle, its origin on the spindle, for the game to turn;
    the spout running on and turning down to its mouth over the drain, marked WashSpoutTip; the drain marked WashBowlFloor); over it all a
    round mirror in a slim black-lacquered frame with a fine brass ring"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    seed(3)
    N = 256
    u, v = grid01(N)
    # (hinoki: pale and warm, a fine straight grain along u, a few darker growth lines, a faint sheen of figure)
    hin = mix((0.84, 0.69, 0.48), (0.91, 0.78, 0.58), fbm(N, 3, 24, 4))
    lines = np.sin((v * 34 + fbm(N, 2, 6, 3) * 2.4) * math.pi * 2) * 0.5 + 0.5
    hin = mix(hin, (0.66, 0.48, 0.3), smooth(0.86, 1.0, lines) * 0.45)
    # (the cabinet's cedar, darkened (sumi): the same grain, deep brown)
    sugi = mix((0.17, 0.11, 0.07), (0.25, 0.165, 0.105), fbm(N, 3, 24, 4))
    sugi = mix(sugi, (0.09, 0.055, 0.035), smooth(0.84, 1.0, lines) * 0.6)
    # (the bowl: u round it, v along its profile; where the foot, the rim and the well's floor fall on it is known once it's turned)
    T = 0.76
    prof = [(0.0, T), (0.06, T), (0.066, T + 0.005), (0.068, T + 0.014), (0.064, T + 0.018), (0.088, T + 0.026),
            (0.124, T + 0.05), (0.151, T + 0.083), (0.165, T + 0.112), (0.17, T + 0.129), (0.168, T + 0.136), (0.162, T + 0.138),
            (0.157, T + 0.133), (0.151, T + 0.115), (0.135, T + 0.084), (0.11, T + 0.058), (0.076, T + 0.042), (0.036, T + 0.035), (0.0, T + 0.033)]
    bowl, vs = lathe_uv("WashBowl", prof, 32, -0.21, 0)
    vf, vr = vs[5], vs[10]
    NB = 512
    bu, bv = grid01(NB)
    clay = mix((0.7, 0.42, 0.24), (0.84, 0.57, 0.34), fbm(NB, 10, 6, 4))
    sp = rng.random((NB, NB))
    clay = np.where((sp > 0.994)[..., None], np.array((0.95, 0.91, 0.82), np.float32), clay)
    clay = np.where((sp < 0.004)[..., None], np.array((0.32, 0.19, 0.1), np.float32), clay)
    # (the glaze's lower edge on the outside: wavering round it, with a few long drips running down nearly to the foot)
    wav = fbm(NB, 14, 2, 3)[NB // 2]
    drip = np.zeros(NB, np.float32)
    for c0, w0, d0 in ((0.07, 0.012, 0.9), (0.21, 0.02, 0.6), (0.37, 0.01, 1.0), (0.52, 0.016, 0.7), (0.66, 0.012, 0.95), (0.83, 0.022, 0.55), (0.93, 0.01, 0.8)):
        dd = np.minimum(np.abs(bu[0] - c0), 1 - np.abs(bu[0] - c0))
        drip = np.maximum(drip, d0 * np.exp(-(dd / w0) ** 2))
    edge = vr - (vr - vf) * (0.42 + 0.22 * wav + 0.5 * drip)
    out = bv < vr
    glz = smooth(0.0, 0.012, bv - edge[None, :])
    # (thick where it ran: a darker, greener bead along the drips' ends and the edge)
    bead = np.exp(-((bv - edge[None, :]) / 0.012) ** 2)
    ash = mix((0.5, 0.5, 0.24), (0.34, 0.44, 0.22), fbm(NB, 8, 8, 3))
    outer = mix(clay, ash, glz * 0.82)
    outer = mix(outer, (0.16, 0.3, 0.17), bead * 0.7)
    # (the rim scorched in the kiln (焦げ): dark, patchy)
    scorch = smooth(vr - 0.06, vr, bv) * (1 - smooth(vr, vr + 0.05, bv)) * (0.5 + 0.5 * fbm(NB, 9, 3, 3))
    # (inside: the glaze glassy green, deepening down the well to a clear pool on its floor, fine crackle through it)
    t = np.clip((bv - vr) / (1 - vr), 0, 1)
    inner = mix((0.48, 0.5, 0.27), (0.2, 0.4, 0.27), smooth(0.05, 0.6, t))
    inner = mix(inner, (0.07, 0.29, 0.26), smooth(0.55, 0.95, t))
    crack = np.abs(fbm(NB, 18, 18, 3) - 0.5) < 0.008
    inner = mix(inner, (0.1, 0.16, 0.1), crack.astype(np.float32) * 0.35)
    col = np.where(out[..., None], outer, inner)
    col = mix(col, (0.2, 0.13, 0.08), scorch * 0.75)
    M = {"hinoki": pbr("WashHinoki", (1, 1, 1), tex=image("washhinoki", hin), rough=0.5, coat=0.3),
         "sugi": pbr("WashSugi", (1, 1, 1), tex=image("washsugi", sugi), rough=0.55),
         "shadow": pbr("WashShadow", lin("#140d08"), rough=0.8),
         "bowl": pbr("WashBowl", (1, 1, 1), tex=image("washbowl", col), rough=0.15, coat=0.8),
         "brass": pbr("WashBrass", lin("#c9a04a"), rough=0.22, metal=1.0),
         "mirror": pbr("WashMirror", lin("#d8e2e6"), rough=0.02, metal=1.0),
         "frame": pbr("WashFrame", lin("#1c1410"), rough=0.3, coat=0.6),
         "celadon": pbr("WashSoap", lin("#a9c7b4"), rough=0.2, coat=0.7),
         "outlet": pbr("WashOutlet", lin("#2a2620"), rough=0.6)}
    parts = []
    W, DP, TH, PL = 0.56, 0.42, 0.05, 0.09
    CD = DP - 0.03
    CW = W - 0.04
    # ---- the counter, its edges eased, its grain along it
    fin(box_uv(rbox("WashTop", (DP, TH, W), (-DP / 2, T - TH / 2, 0), 0.006, 2), 2.2), "WashTop", M["hinoki"], parts)
    # ---- the cabinet under it, the plinth set back in shadow
    fin(box_uv(rbox("WashCabinet", (CD, T - TH - PL, CW), (-CD / 2, PL + (T - TH - PL) / 2, 0), 0.004, 1), 2.2, up=True), "WashCabinet", M["sugi"], parts)
    fin(rbox("WashPlinth", (CD - 0.05, PL, CW - 0.06), (-(CD - 0.05) / 2, PL / 2, 0), 0.0, 1), "WashPlinth", M["shadow"], parts)
    # ---- its two sliding doors, one on each of two tracks, the front one over the back's edge: a frame of hinoki and upright slats, a dark
    # panel behind them, a little notch of a pull in each outer stile
    y0, y1 = PL + 0.022, T - TH - 0.022
    for k, (za, zb, x0) in enumerate(((-CW / 2 + 0.02, 0.006, -CD - 0.001), (-0.006, CW / 2 - 0.02, -CD - 0.017))):
        zc, dw = (za + zb) / 2, zb - za
        fin(rbox(f"WashDoorBack{k}", (0.004, y1 - y0, dw), (x0 - 0.004, (y0 + y1) / 2, zc), 0.0, 1), f"WashDoorBack{k}", M["shadow"], parts)
        st, rl = 0.02, 0.028
        for sd in (-1, 1):
            fin(box_uv(rbox(f"WashStile{k}{sd}", (0.012, y1 - y0, st), (x0 - 0.008, (y0 + y1) / 2, zc + sd * (dw - st) / 2), 0.002, 1), 2.2, up=True), f"WashStile{k}{sd}", M["hinoki"], parts)
            fin(box_uv(rbox(f"WashRail{k}{sd}", (0.012, rl, dw - 2 * st), (x0 - 0.008, (y0 + y1) / 2 + sd * ((y1 - y0) - rl) / 2, zc), 0.002, 1), 2.2), f"WashRail{k}{sd}", M["hinoki"], parts)
        n = 7
        inner = dw - 2 * st
        for j in range(n):
            z = zc - inner / 2 + inner * (j + 1) / (n + 1)
            fin(box_uv(rbox(f"WashSlat{k}{j}", (0.008, y1 - y0 - 2 * rl, 0.011), (x0 - 0.006, (y0 + y1) / 2, z), 0.0, 1), 2.2, up=True), f"WashSlat{k}{j}", M["hinoki"], parts)
        pz = zc + (-1 if k == 0 else 1) * (dw / 2 - st / 2)
        fin(rbox(f"WashPull{k}", (0.006, 0.055, 0.009), (x0 - 0.013, (y0 + y1) / 2, pz), 0.002, 1), f"WashPull{k}", M["shadow"], parts)
    # ---- the bowl, on the counter, and its brass drain
    fin(bowl, "WashBowl", M["bowl"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.027, depth=0.004, location=P(-0.21, T + 0.035, 0))
    fin(active(), "WashDrain", M["brass"], parts)
    for k in range(6):
        a = k * math.pi / 3
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=0.002, location=P(-0.21 + 0.014 * math.cos(a), T + 0.0372, 0.014 * math.sin(a)))
        fin(active(), f"WashDrainHole{k}", M["outlet"], parts)
    # ---- the tap: its rose on the wall, its body out of it, the bonnet on top, the spout running on and turning down over the drain
    HY = T + 0.33
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.026, depth=0.01, location=P(-0.005, HY, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashTapRose", M["brass"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.015, depth=0.08, location=P(-0.045, HY, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashTapBody", M["brass"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.017, depth=0.03, location=P(-0.045, HY + 0.022, 0))
    fin(active(), "WashTapBonnet", M["brass"], parts)
    fin(tube("WashTapSpout", [(-0.08, HY, 0.0), (-0.13, HY + 0.002, 0.0), (-0.18, HY - 0.012, 0.0), (-0.204, HY - 0.045, 0.0), (-0.21, HY - 0.07, 0.0)],
             0.0115, caps=True, res=2, ru=6), "WashTapSpout", M["brass"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0135, depth=0.016, location=P(-0.21, HY - 0.076, 0))
    fin(active(), "WashTapMouth", M["brass"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.009, depth=0.002, location=P(-0.21, HY - 0.0845, 0))
    fin(active(), "WashTapOutlet", M["outlet"], parts)
    # (the cross handle: four arms with a ball on each end, a cap in the middle, on a short spindle: its own node, turned about the spindle)
    handle = bpy.data.objects.new("WashTapHandle", None)
    bpy.context.collection.objects.link(handle)
    handle.location = P(-0.045, HY + 0.037, 0)
    bpy.context.view_layer.update()
    hparts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.006, depth=0.022, location=P(-0.045, HY + 0.046, 0))
    fin(active(), "WashHandleSpindle", M["brass"], hparts)
    for a in (0.0, math.pi / 2):
        fin(rbox(f"WashHandleArm{int(a * 10)}", (0.07 if a == 0 else 0.009, 0.008, 0.009 if a == 0 else 0.07), (-0.045, HY + 0.058, 0), 0.003, 2),
            f"WashHandleArm{int(a * 10)}", M["brass"], hparts)
    for k in range(4):
        a = k * math.pi / 2
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.008, location=P(-0.045 + 0.035 * math.cos(a), HY + 0.058, 0.035 * math.sin(a)))
        fin(active(), f"WashHandleBall{k}", M["brass"], hparts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.011, depth=0.01, location=P(-0.045, HY + 0.064, 0))
    fin(active(), "WashHandleCap", M["brass"], hparts)
    bpy.context.view_layer.update()
    for o in hparts:
        mw = o.matrix_world.copy()
        o.parent = handle
        o.matrix_world = mw
    # ---- the soap bottle, celadon, a brass pump on it
    sx, sz = -0.1, 0.215
    fin(lathe_oval("WashSoapBottle", [(0.0, T), (0.026, T), (0.03, T + 0.008), (0.031, T + 0.058), (0.027, T + 0.078), (0.013, T + 0.09),
                                      (0.012, T + 0.098), (0.0, T + 0.098)], 1, 1, 16, sx, sz), "WashSoapBottle", M["celadon"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.007, depth=0.02, location=P(sx, T + 0.106, sz))
    fin(active(), "WashPumpNeck", M["brass"], parts)
    fin(rbox("WashPumpHead", (0.024, 0.01, 0.016), (sx - 0.006, T + 0.12, sz), 0.003, 2), "WashPumpHead", M["brass"], parts)
    fin(tube("WashPumpNozzle", [(sx - 0.014, T + 0.121, sz), (sx - 0.034, T + 0.118, sz)], 0.003, caps=True, res=1, ru=2), "WashPumpNozzle", M["brass"], parts)
    # ---- the mirror over it all: round, a slim black-lacquered frame, a fine brass ring at the glass's edge
    MY = T + 0.66
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.205, depth=0.022, location=P(-0.011, MY, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashMirrorFrame", M["frame"], parts)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.188, depth=0.004, location=P(-0.0235, MY, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashMirror", M["mirror"], parts)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.19, minor_radius=0.0032, major_segments=64, minor_segments=6, location=P(-0.024, MY, 0), rotation=(0, math.pi / 2, 0))
    fin(active(), "WashMirrorRing", M["brass"], parts)
    # (the marks the game reads: the spout's mouth, the drain)
    marks = []
    for name, at in (("WashSpoutTip", (-0.21, HY - 0.086, 0)), ("WashBowlFloor", (-0.21, T + 0.037, 0))):
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        e.location = P(*at)
        marks.append(e)
    root = bpy.data.objects.new("WcWashstand", None)
    bpy.context.collection.objects.link(root)
    for o in parts + marks + [handle]:
        o.parent = root
    export_dish(root, parts + hparts + marks + [handle, root], os.path.join(PROJECT, "public", "models", "washstand.glb"),
                os.path.join(PROJECT, "blender", "washstand.blend"), None)
    print("WASH_DONE", sum(len(o.data.polygons) for o in parts + hparts))


ONLY = os.environ.get("WC_ONLY", "toilet,bits,washstand")
if "toilet" in ONLY:
    toilet()
if "bits" in ONLY:
    bits()
if "washstand" in ONLY:
    washstand()
