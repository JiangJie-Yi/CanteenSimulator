"""What's kept in the cook's table's two cupboards (cubbystock.glb), which are fridges (the owner's: under-counter fridges, a cold white
lining inside, what's kept cold kept there): no plates or bowls (those are all on the dish racks), nor anything that keeps at room temperature.
The two alike now (the owner's): each 1.15 across, its wire shelf over its outer half only, with what's grilled on it and under it; its inner
half, by the cook's notch, left the whole height for the bottles and the seasonings. "StockLeft": on the shelf trays of negima and pork belly
skewers, under it a crate of corn; by the notch the two big 1.8-litre bottles (一升瓶) of soy sauce and mirin, the glazed jar of tare for
basting and two tins of condensed milk. "StockRight": on the shelf a tray of sausages and onigiri on a plate, under it a box of mushrooms
(shiitake, king oyster), a bundle of asparagus and a basket of shishito; by the notch another 一升瓶 of soy sauce, the tub of miso under its
lid, a box of wasabi, a jar of yuzu kosho and three lemons in a dish.

Each in its cupboard's own frame, in the room's units: y up from the cupboard's floor, x along the table, +z toward the doors, the middle
of its floor at the origin.

Run:
    blender -b --factory-startup --python blender/cubbystock.py -- <project path> [preview.png]
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
seed(5)


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)


def label_tex(name, ground, block, ink):
    """a printed paper label: its ground, a coloured block in its middle with brush strokes of a name down it, fine lines above and below"""
    W, H = 256, 128
    img = np.zeros((H, W, 3), np.float32) + lin(ground)
    img[:, :] *= (0.94 + 0.06 * fbm(128, 4, 4)[np.ix_(np.arange(H) % 128, np.arange(W) % 128)])[..., None]
    # (its block at a quarter turn round from the seam: facing the cupboard's doors as the bottle stands)
    x0, x1, y0, y1 = 160, 224, 14, 114
    img[y0:y1, x0:x1] = lin(block)
    for k in range(4):
        cx = 176 + (k % 2) * 30
        cy = 30 + k * 20
        img[cy:cy + 12, cx:cx + 4] = lin(ink)
        img[cy + 4:cy + 7, cx - 6:cx + 10] = lin(ink)
    for y in (8, 119):
        img[y:y + 2, 6:W - 6] = lin(block)
    return image(name, img)


def kraft_tex(name, band=None, mark=None):
    """corrugated board: kraft brown, faintly mottled, a printed band and a mark on it"""
    S = 128
    u, v = grid01(S)
    col = mix(lin("#9a7448"), lin("#c09a66"), fbm(S, 5, 5))
    if band:
        col = mix(col, lin(band), smooth(0.0, 0.02, 0.09 - np.abs(v - 0.62)))
    if mark:
        m = (np.abs(u - 0.5) < 0.12) & (np.abs(v - 0.62) < 0.06)
        col[m] = lin(mark)
    return image(name, col)


M = {
    "soyGlass": pbr("StockSoyGlass", tuple(lin("#2a140a")), rough=0.15),
    "mirinGlass": pbr("StockMirinGlass", tuple(lin("#8a5a18")), rough=0.15),
    "soyLabel": pbr("StockSoyLabel", (1, 1, 1), tex=label_tex("StockSoyLabelTex", "#f1e8d2", "#b8322a", "#1c1410"), rough=0.6),
    "mirinLabel": pbr("StockMirinLabel", (1, 1, 1), tex=label_tex("StockMirinLabelTex", "#f6f0dc", "#2a4f8a", "#f6f0dc"), rough=0.6),
    "cap": pbr("StockCap", tuple(lin("#c9a64e")), rough=0.35, metal=0.6),
    "jar": pbr("StockPickleJar", tuple(lin("#7a4a2a")), rough=0.25),
    "jarLip": pbr("StockPickleJarLip", tuple(lin("#c9a476")), rough=0.5),
    "lid": pbr("StockLidWood", tuple(lin("#b0844e")), rough=0.7),
    "stone": pbr("StockStone", tuple(lin("#6c6a66")), rough=0.9),
    "cloth": pbr("StockCloth", tuple(lin("#f2f0ea")), rough=0.95),
    "indigo": pbr("StockClothIndigo", tuple(lin("#2c3e66")), rough=0.95),
    "cedar": pbr("StockCedar", tuple(lin("#c49a62")), rough=0.7),
    "saltMark": pbr("StockSaltMark", tuple(lin("#b8322a")), rough=0.6),
    "kraft": pbr("StockKraft", (1, 1, 1), tex=kraft_tex("StockKraftTex", band="#b8322a"), rough=0.9),
    "coalBox": pbr("StockCoalBox", (1, 1, 1), tex=kraft_tex("StockCoalBoxTex", band="#1c1a18", mark="#f2efe6"), rough=0.9),
    "iron": pbr("StockIron", tuple(lin("#3c3c40")), rough=0.5, metal=0.8),
    "steel": pbr("StockSteel", tuple(lin("#b8bcc2")), rough=0.3, metal=1.0),
    "twine": pbr("StockTwine", tuple(lin("#b89a62")), rough=0.9),
    "foilBox": pbr("StockFoilBox", tuple(lin("#3a6ab0")), rough=0.6),
    "foilEnd": pbr("StockFoilEnd", tuple(lin("#e8eaee")), rough=0.25, metal=1.0),
    "lemon": pbr("StockLemon", tuple(lin("#f0cc2a")), rough=0.45),
    "tray": pbr("StockTrayWood", tuple(lin("#a8784a")), rough=0.6),
    "spiceW": pbr("StockSpiceSesame", tuple(lin("#efe4c8")), rough=0.8),
    "spiceR": pbr("StockSpiceChili", tuple(lin("#b8322a")), rough=0.8),
    "spiceB": pbr("StockSpiceBonito", tuple(lin("#a8784a")), rough=0.8),
    "glass": pbr("StockJarGlass", tuple(lin("#dfe8ea")), rough=0.1),
    "oilTin": pbr("StockOilTin", tuple(lin("#d8b24a")), rough=0.35, metal=0.7),
    "misoTub": pbr("StockMisoTub", tuple(lin("#c8a46a")), rough=0.6),
    "misoHoop": pbr("StockMisoHoop", tuple(lin("#2c3e66")), rough=0.6),
    "misoLid": pbr("StockMisoLid", tuple(lin("#a8784a")), rough=0.7),
    "milkTin": pbr("StockMilkTin", (1, 1, 1), tex=label_tex("StockMilkLabelTex", "#f4f1e6", "#2a6ab0", "#f4f1e6"), rough=0.4),
    "tinEnd": pbr("StockTinEnd", tuple(lin("#c8ccd2")), rough=0.3, metal=0.9),
    "wasabiBox": pbr("StockWasabiBox", tuple(lin("#5f9a3a")), rough=0.6),
    "wasabiBand": pbr("StockWasabiBand", tuple(lin("#f2efe6")), rough=0.6),
    "yuzu": pbr("StockYuzuPaste", tuple(lin("#a8b83a")), rough=0.7),
    "dish": pbr("StockDishWhite", tuple(lin("#f2f0ea")), rough=0.3),
    "foam": pbr("StockFoamTray", tuple(lin("#f4f4f2")), rough=0.85),
    "chicken": pbr("StockChicken", tuple(lin("#f0d6c4")), rough=0.6),
    "negi": pbr("StockNegi", tuple(lin("#8ab84a")), rough=0.6),
    "pork": pbr("StockPork", tuple(lin("#e8a0a0")), rough=0.6),
    "fat": pbr("StockPorkFat", tuple(lin("#f6eee4")), rough=0.6),
    "sausage": pbr("StockSausage", tuple(lin("#a8402a")), rough=0.45),
    "rice": pbr("StockOnigiri", tuple(lin("#f6f4ee")), rough=0.8),
    "nori": pbr("StockNori", tuple(lin("#1e2a1e")), rough=0.6),
    "corn": pbr("StockCorn", tuple(lin("#f2c63a")), rough=0.6),
    "husk": pbr("StockCornHusk", tuple(lin("#a8c06a")), rough=0.8),
    "crate": pbr("StockCrateWood", tuple(lin("#c49a62")), rough=0.8),
    "shiitake": pbr("StockShiitake", tuple(lin("#6a4428")), rough=0.7),
    "stem": pbr("StockMushroomStem", tuple(lin("#efe4cc")), rough=0.7),
    "aspara": pbr("StockAsparagus", tuple(lin("#6a9a3a")), rough=0.6),
    "shishito": pbr("StockShishito", tuple(lin("#4a8a2a")), rough=0.45),
    "basket": pbr("StockBasketBamboo", tuple(lin("#c8a86a")), rough=0.8),
}
groups = {"right": [], "left": []}
cur = "right"


def add(o):
    groups[cur].append(o)
    return o


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 2)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    finish(o, name, M[mat], smooth_shade=bool(bev))
    return add(o)


def lathe(name, prof, mat_of, at, seg=16, uv_v=False):
    """a turned shape (radius, height pairs from its foot up), each band its own material; its own cylindrical UVs if uv_v"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), y)) for k in range(seg)] if r > 1e-5 else [bm.verts.new((0, 0, y))])
    mats = []
    h0, h1 = prof[0][1], prof[-1][1]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        mn = mat_of(i)
        if mn not in mats:
            mats.append(mn)
        for k in range(seg):
            k2 = (k + 1) % seg
            if len(a) == 1:
                f = bm.faces.new((a[0], b[k], b[k2]))
                ks = [(None, i), (k, i + 1), (k + 1, i + 1)]
            elif len(b) == 1:
                f = bm.faces.new((a[k], b[0], a[k2]))
                ks = [(k, i), (None, i + 1), (k + 1, i)]
            else:
                f = bm.faces.new((a[k], b[k], b[k2], a[k2]))
                ks = [(k, i), (k, i + 1), (k + 1, i + 1), (k + 1, i)]
            f.material_index = mats.index(mn)
            for loop, (kk, ii) in zip(f.loops, ks):
                loop[uvl].uv = ((kk if kk is not None else k + 0.5) / seg, (prof[ii][1] - h0) / (h1 - h0 + 1e-6))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for mn in mats:
        o.data.materials.append(M[mn])
    for p in o.data.polygons:
        p.use_smooth = True
    o.location = P(*at)
    return add(o)


def blob(name, x, y, z, sx, sy, sz, mat, seg=10, rings=7):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=P(x, y, z))
    o = active()
    o.scale = (sx, sz, sy)
    apply_scale(o)
    finish(o, name, M[mat])
    return add(o)


def rod(name, a, b, r, mat, sides=5):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=d.length, location=P(*((a + b) / 2)))
    o = active()
    o.rotation_euler = Vector((d.x, -d.z, d.y)).to_track_quat("Z", "Y").to_euler()
    finish(o, name, M[mat], smooth_shade=False)
    return add(o)


BOTTLE = [(0.0, 0.0), (0.046, 0.0), (0.05, 0.006), (0.05, 0.26), (0.044, 0.3), (0.022, 0.34), (0.016, 0.36), (0.016, 0.39), (0.018, 0.395), (0.018, 0.42), (0.0, 0.42)]
SH = 0.3


def ishobin(i, x, z, glass, lab):
    """a 一升瓶: a long body, round shoulders, a short neck, a gilt cap; the label round its middle"""
    lathe(f"StockBottle{i}", BOTTLE, lambda b, g=glass: "cap" if b >= 7 else g, (x, 0.0, z), seg=16)
    lathe(f"StockBottleLabel{i}", [(0.0512, 0.11), (0.0512, 0.23)], lambda b, l=lab: l, (x, 0.0, z), seg=16)


def skewer_tray(t, x0, kind):
    """a tray of skewers ready for the fire, on the shelf"""
    box(f"StockSkewerTray{t}", x0, x0 + 0.24, SH, SH + 0.015, -0.4, -0.16, "foam", bev=0.004)
    for k in range(4):
        z = -0.37 + k * 0.06
        rod(f"StockTraySkewer{t}{k}", (x0 + 0.02, SH + 0.03, z), (x0 + 0.23, SH + 0.03, z), 0.0025, "steel", sides=4)
        for c in range(4):
            x = x0 + 0.05 + c * 0.04
            if kind == "negima":
                mat = "negi" if c % 2 else "chicken"
                box(f"StockMeat{t}{k}{c}", x - 0.014, x + 0.014, SH + 0.016, SH + 0.044, z - 0.014, z + 0.014, mat, bev=0.004)
            elif kind == "pork":
                box(f"StockMeat{t}{k}{c}", x - 0.016, x + 0.016, SH + 0.016, SH + 0.04, z - 0.016, z + 0.016, "pork", bev=0.003)
                box(f"StockFat{t}{k}{c}", x - 0.004, x + 0.004, SH + 0.016, SH + 0.041, z - 0.0161, z + 0.0161, "fat")
            elif c < 2:
                o = lathe(f"StockSausage{t}{k}{c}", [(0.0, 0.0), (0.012, 0.006), (0.013, 0.07), (0.0, 0.078)], lambda b: "sausage", (0.0, 0.0, 0.0), seg=10)
                o.location = P(x0 + 0.05 + c * 0.085, SH + 0.03, z)
                o.rotation_euler = (0, math.pi / 2, 0)


# ===================== the left-hand fridge: its shelf over its outer (left, -x) half, the bottles by the notch (+x) =====================
cur = "left"
# (on the shelf: trays of negima and pork belly skewers)
skewer_tray(0, -0.53, "negima")
skewer_tray(1, -0.27, "pork")
# (under it, on its floor: a crate of corn, its husks pulled back)
box("StockCornCrate", -0.52, -0.14, 0.0, 0.1, -0.4, -0.1, "crate", bev=0.004)
for k in range(4):
    x = -0.47 + k * 0.09
    o = lathe(f"StockCorn{k}", [(0.0, 0.0), (0.03, 0.01), (0.034, 0.06), (0.03, 0.17), (0.0, 0.2)], lambda b: "corn", (0.0, 0.0, 0.0), seg=10)
    o.location = P(x, 0.13, -0.32)
    o.rotation_euler = (math.pi / 2, 0, 0.1 * k)
    h = lathe(f"StockCornHusk{k}", [(0.0, 0.0), (0.036, 0.004), (0.03, 0.05), (0.0, 0.06)], lambda b: "husk", (0.0, 0.0, 0.0), seg=8)
    h.location = P(x, 0.13, -0.13)
    h.rotation_euler = (math.pi / 2, 0, 0.1 * k)
# (by the notch, the whole height: the soy sauce and the mirin, the tare's jar, two tins of condensed milk in front)
ishobin(0, 0.12, -0.3, "soyGlass", "soyLabel")
ishobin(1, 0.24, -0.35, "mirinGlass", "mirinLabel")
JAR = [(0.0, 0.0), (0.08, 0.0), (0.12, 0.06), (0.135, 0.13), (0.12, 0.2), (0.09, 0.235), (0.09, 0.25), (0.075, 0.25), (0.075, 0.235)]
lathe("StockPickleJar", JAR, lambda b: "jarLip" if b >= 5 else "jar", (0.41, 0.0, -0.25), seg=18)
lathe("StockPickleLid", [(0.0, 0.0), (0.082, 0.0), (0.082, 0.018), (0.0, 0.018)], lambda b: "lid", (0.41, 0.25, -0.25), seg=18)
for k in range(2):
    lathe(f"StockMilkTin{k}", [(0.0, 0.0), (0.038, 0.0), (0.04, 0.004), (0.04, 0.076), (0.038, 0.08), (0.0, 0.08)],
          lambda b: "tinEnd" if b in (0, 4) else "milkTin", (0.16, k * 0.08, -0.1), seg=14)

# ===================== the right-hand fridge: its shelf over its outer (right, +x) half, the seasonings by the notch (-x) =====================
cur = "right"
# (on the shelf: a tray of sausages, and onigiri on a plate)
skewer_tray(2, 0.03, "sausage")
lathe("StockOnigiriPlate", [(0.0, 0.0), (0.08, 0.0), (0.12, 0.016), (0.125, 0.02), (0.0, 0.008)], lambda b: "dish", (0.41, SH, -0.26), seg=18)
for k, (x, z, rot) in enumerate(((0.37, -0.28, 0.3), (0.46, -0.27, -0.4), (0.41, -0.21, 1.2))):
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.045, radius2=0.03, depth=0.03, location=P(x, SH + 0.025, z))
    o = active()
    o.rotation_euler = (0, 0, rot)
    b = bevel(o, 0.012, 3)
    b.limit_method = "NONE"
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=b.name)
    finish(o, f"StockOnigiri{k}", M["rice"])
    add(o)
    box(f"StockNori{k}", x - 0.016, x + 0.016, SH + 0.008, SH + 0.03, z - 0.032, z - 0.029, "nori")
# (under it: a box of mushrooms, shiitake caps and king oyster stems; asparagus in a bundle, tied; a basket of shishito)
box("StockMushroomBox", 0.03, 0.33, 0.0, 0.08, -0.4, -0.16, "crate", bev=0.003)
for k in range(5):
    x, z = 0.08 + (k % 3) * 0.1, -0.34 + (k // 3) * 0.1
    lathe(f"StockShiitakeStem{k}", [(0.0, 0.0), (0.012, 0.0), (0.012, 0.03), (0.0, 0.03)], lambda b: "stem", (x, 0.07, z), seg=8)
    lathe(f"StockShiitake{k}", [(0.0, 0.03), (0.045, 0.03), (0.04, 0.045), (0.022, 0.058), (0.0, 0.06)], lambda b: "shiitake", (x, 0.07, z), seg=12)
for k in range(2):
    o = lathe(f"StockEringi{k}", [(0.0, 0.0), (0.02, 0.0), (0.024, 0.1), (0.032, 0.12), (0.0, 0.14)], lambda b: "stem" if b < 3 else "shiitake", (0.0, 0.0, 0.0), seg=10)
    o.location = P(0.27 - k * 0.07, 0.11, -0.2)
    o.rotation_euler = (math.pi / 2 - 0.1, 0, 0.3)
for k in range(9):
    a = 2 * math.pi * k / 9
    rod(f"StockAsparagus{k}", (0.45 + 0.02 * math.cos(a), 0.0, -0.32 + 0.02 * math.sin(a)), (0.45 + 0.024 * math.cos(a), 0.22, -0.32 + 0.024 * math.sin(a)), 0.006, "aspara", sides=5)
lathe("StockAsparaTie", [(0.03, 0.06), (0.03, 0.075)], lambda b: "twine", (0.45, 0.0, -0.32), seg=10)
lathe("StockShishitoBasket", [(0.0, 0.0), (0.07, 0.0), (0.1, 0.06), (0.0, 0.03)], lambda b: "basket", (0.43, 0.0, -0.08), seg=14)
for k in range(7):
    a = 2 * math.pi * k / 7
    o = blob(f"StockShishito{k}", 0.43 + 0.045 * math.cos(a), 0.055, -0.08 + 0.045 * math.sin(a), 0.035, 0.012, 0.012, "shishito", seg=8, rings=5)
    o.rotation_euler = (0, 0, a)
# (by the notch, the whole height: another 一升瓶 of soy sauce, the miso's tub, and in front a box of wasabi, a jar of yuzu kosho, lemons in a dish)
ishobin(2, -0.12, -0.33, "soyGlass", "soyLabel")
lathe("StockMisoTub", [(0.0, 0.0), (0.12, 0.0), (0.13, 0.17), (0.0, 0.17)], lambda b: "misoTub", (-0.38, 0.0, -0.25), seg=20)
for k, y in enumerate((0.03, 0.13)):
    lathe(f"StockMisoHoop{k}", [(0.123 + 0.0006 * y * 10, y), (0.124 + 0.0006 * y * 10, y + 0.018)], lambda b: "misoHoop", (-0.38, 0.0, -0.25), seg=20)
lathe("StockMisoLid", [(0.0, 0.17), (0.138, 0.17), (0.138, 0.19), (0.0, 0.19)], lambda b: "misoLid", (-0.38, 0.0, -0.25), seg=20)
box("StockMisoKnob", -0.43, -0.33, 0.19, 0.21, -0.265, -0.235, "misoLid", bev=0.004)
box("StockWasabiBox", -0.26, -0.1, 0.0, 0.05, -0.16, -0.08, "wasabiBox", bev=0.003)
box("StockWasabiBand", -0.21, -0.18, 0.0, 0.051, -0.161, -0.079, "wasabiBand")
lathe("StockYuzuJar", [(0.0, 0.0), (0.036, 0.0), (0.036, 0.09), (0.0, 0.09)], lambda b: "glass", (-0.06, 0.0, -0.17), seg=12)
lathe("StockYuzuPaste", [(0.0, 0.004), (0.032, 0.004), (0.032, 0.062), (0.0, 0.062)], lambda b: "yuzu", (-0.06, 0.0, -0.17), seg=12)
lathe("StockYuzuCap", [(0.0, 0.09), (0.038, 0.09), (0.038, 0.11), (0.0, 0.11)], lambda b: "lid", (-0.06, 0.0, -0.17), seg=12)
lathe("StockLemonDish", [(0.0, 0.0), (0.06, 0.0), (0.1, 0.03), (0.105, 0.034), (0.0, 0.012)], lambda b: "dish", (-0.38, 0.0, -0.05), seg=18)
for k, (x, z) in enumerate(((-0.41, -0.07), (-0.34, -0.07), (-0.38, -0.01))):
    blob(f"StockLemon{k}", x, 0.05, z, 0.045, 0.034, 0.034, "lemon")

# ===================== two roots =====================
roots = {}
for key, name in (("right", "StockRight"), ("left", "StockLeft")):
    r = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(r)
    for o in groups[key]:
        o.parent = r
    roots[key] = r
# (the left one stood beside the right for the preview only)
allp = groups["right"] + groups["left"]
print("CUBBYSTOCK_TRIS", sum(len(p.vertices) - 2 for o in allp for p in o.data.polygons))
if PREVIEW:
    roots["left"].location = P(-1.5, 0, 0)
    target = P(-0.7, 0.2, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(-0.7, 0.9, 1.8)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(roots["right"], allp + list(roots.values()), os.path.join(PROJECT, "public", "models", "cubbystock.glb"),
            os.path.join(PROJECT, "blender", "cubbystock.blend"), PREVIEW)
print("CUBBYSTOCK_DONE")
