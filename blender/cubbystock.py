"""What's kept in the cook's table's two cupboards (cubbystock.glb): no plates or bowls (those are all on the dish racks), the grill's own
stores. "StockRight" for the right-hand cupboard (1.64 across, a shelf over its right-hand part): two big 1.8-litre bottles (一升瓶) of soy
sauce and mirin, a glazed pickle jar under a wooden lid, a stack of folded cloths, a cedar salt box, a carton under the shelf, and on the
shelf three little jars of seasoning and a tin of sesame oil. "StockLeft" for the left-hand one (1.15 across, a shelf the whole way): a
carton of binchotan and a charcoal starter on its floor, and on the shelf two bundles of iron skewers tied with twine, a box of foil and
three lemons on a little tray.

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


# ===================== the right-hand cupboard =====================
cur = "right"
# (two 一升瓶: a long body, round shoulders, a short neck, a gilt cap; the label round its middle)
BOTTLE = [(0.0, 0.0), (0.046, 0.0), (0.05, 0.006), (0.05, 0.26), (0.044, 0.3), (0.022, 0.34), (0.016, 0.36), (0.016, 0.39), (0.018, 0.395), (0.018, 0.42), (0.0, 0.42)]
for i, (x, z, glass, lab) in enumerate(((-0.68, -0.28, "soyGlass", "soyLabel"), (-0.55, -0.34, "mirinGlass", "mirinLabel"))):
    lathe(f"StockBottle{i}", BOTTLE, lambda b, g=glass: "cap" if b >= 7 else g, (x, 0.0, z), seg=16)
    lathe(f"StockBottleLabel{i}", [(0.0512, 0.11), (0.0512, 0.23)], lambda b, l=lab: l, (x, 0.0, z), seg=16)
# (the pickle jar: a glazed belly, a pale unglazed lip, a wooden drop lid with a stone on it)
JAR = [(0.0, 0.0), (0.08, 0.0), (0.12, 0.06), (0.135, 0.13), (0.12, 0.2), (0.09, 0.235), (0.09, 0.25), (0.075, 0.25), (0.075, 0.235)]
lathe("StockPickleJar", JAR, lambda b: "jarLip" if b >= 5 else "jar", (-0.3, 0.0, -0.25), seg=18)
lathe("StockPickleLid", [(0.0, 0.0), (0.082, 0.0), (0.082, 0.018), (0.0, 0.018)], lambda b: "lid", (-0.3, 0.25, -0.25), seg=18)
blob("StockPickleStone", -0.3, 0.29, -0.25, 0.05, 0.03, 0.045, "stone")
# (the folded cloths, white and indigo by turns)
for k in range(4):
    box(f"StockCloth{k}", -0.62, -0.42, k * 0.034, k * 0.034 + 0.032, 0.08, 0.24, "indigo" if k % 2 else "cloth", bev=0.008)
# (the salt box: cedar, its lid a shade over, 塩 brushed on it as a dark mark)
box("StockSaltBox", -0.1, 0.16, 0.0, 0.15, -0.3, -0.12, "cedar", bev=0.004)
box("StockSaltLid", -0.11, 0.17, 0.15, 0.17, -0.31, -0.11, "cedar", bev=0.004)
box("StockSaltMark", 0.005, 0.045, 0.055, 0.095, -0.115, -0.112, "saltMark")
# (under the shelf, a carton)
box("StockCarton", 0.38, 0.76, 0.0, 0.24, -0.4, -0.05, "kraft")
# (on the shelf: three little jars of seasoning, a tin of sesame oil)
SH = 0.3
for k, mat in enumerate(("spiceW", "spiceR", "spiceB")):
    x = 0.42 + k * 0.1
    lathe(f"StockSpiceJar{k}", [(0.0, 0.0), (0.036, 0.0), (0.036, 0.09), (0.0, 0.09)], lambda b: "glass", (x, SH, -0.28), seg=12)
    lathe(f"StockSpice{k}", [(0.0, 0.004), (0.032, 0.004), (0.032, 0.06), (0.0, 0.06)], lambda b, m=mat: m, (x, SH, -0.28), seg=12)
    lathe(f"StockSpiceCap{k}", [(0.0, 0.09), (0.038, 0.09), (0.038, 0.11), (0.0, 0.11)], lambda b: "lid", (x, SH, -0.28), seg=12)
lathe("StockOilTin", [(0.0, 0.0), (0.05, 0.0), (0.05, 0.15), (0.02, 0.17), (0.014, 0.19), (0.0, 0.19)], lambda b: "oilTin", (0.72, SH, -0.2), seg=14)

# ===================== the left-hand cupboard =====================
cur = "left"
# (a carton of binchotan, its black band with 炭 left white in it; a charcoal starter: an iron pot with holes round its foot, a long handle)
box("StockCoalCarton", -0.5, -0.06, 0.0, 0.24, -0.42, -0.08, "coalBox")
lathe("StockStarter", [(0.0, 0.0), (0.07, 0.0), (0.075, 0.16), (0.0, 0.16)], lambda b: "iron", (0.12, 0.0, -0.22), seg=14)
rod("StockStarterHandle", (0.19, 0.12, -0.22), (0.42, 0.13, -0.18), 0.008, "iron", sides=6)
SH = 0.3
# (on the shelf: two bundles of iron skewers, a box of foil, three lemons on a little tray)
for b in range(2):
    z0 = -0.36 + b * 0.12
    for k in range(14):
        a = 2 * math.pi * k / 14
        rr = 0.012 if k % 2 else 0.022
        rod(f"StockSkewer{b}{k}", (-0.48, SH + 0.03 + rr * math.sin(a), z0 + rr * math.cos(a)), (-0.08, SH + 0.03 + rr * math.sin(a), z0 + rr * math.cos(a)), 0.003, "steel", sides=4)
    for xt in (-0.38, -0.18):
        lathe(f"StockSkewerTie{b}{int(-xt * 100)}", [(0.03, 0.0), (0.03, 0.012)], lambda m: "twine", (0.0, 0.0, 0.0), seg=10).rotation_euler = (math.pi / 2, 0, 0)
        groups[cur][-1].location = P(xt, SH + 0.03, z0)
        groups[cur][-1].rotation_euler = (0, math.pi / 2, 0)
box("StockFoilBox", 0.0, 0.34, SH, SH + 0.06, -0.38, -0.32, "foilBox", bev=0.003)
lathe("StockFoilRoll", [(0.0, 0.0), (0.024, 0.0), (0.024, 0.006), (0.0, 0.006)], lambda b: "foilEnd", (0.0, 0.0, 0.0), seg=12)
groups[cur][-1].location = P(0.344, SH + 0.03, -0.35)
groups[cur][-1].rotation_euler = (0, math.pi / 2, 0)
box("StockLemonTray", 0.1, 0.42, SH, SH + 0.02, -0.18, 0.0, "tray", bev=0.004)
for k, (x, z) in enumerate(((0.18, -0.09), (0.28, -0.11), (0.34, -0.05))):
    blob(f"StockLemon{k}", x, SH + 0.055, z, 0.048, 0.036, 0.036, "lemon")

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
