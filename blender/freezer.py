"""The kitchen's ingredient freezer (食材冷凍櫃): a wide chest freezer, front +z, its length along x, standing on the floor at y=0.

- freezer.glb, nodes (kept plain: only what says "freezer", nothing fussy):
  - "FreezerBody": the cabinet in pale blue-white enamel with soft rounded corners on a dark plinth, the compressor housing at the right
    end (a louvred grille, the temperature display reading -20 and a red power lamp), a chrome rim round the opening; the cavity inside lined pale.
  - "FreezerLid": the lid, its origin on the hinge along the back edge, made shut (the game swings it up): a thick slab, a chrome handle,
    the grey gasket round its underside, two hinges.
  - "FreezerGoods": what's in it, as a fish shop's freezer holds: a wire basket hung on the rim with saury frozen in a bundle; whole fish
    glazed in ice laid side by side (mackerel, horse mackerel, ayu); vacuum-packed salmon and yellowtail fillets, flat under their film;
    a white styrofoam fish box with its lid ajar and a label; blocks of ice; the stock packed in below, so it looks half full.

Run:
    blender -b --factory-startup --python blender/freezer.py -- <project path>
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(8)


def P(x, y, z):
    """three's frame (x along, y up, z to the front) to Blender's"""
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def act():
    return bpy.context.view_layer.objects.active


def box(name, size, at, mat, bev=0.0, seg=3, parts=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*at))
    o = act()
    o.scale = (size[0], size[2], size[1])
    # (the size baked in, the place kept: so a turn given afterwards turns it about its own middle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev:
        m = o.modifiers.new("b", "BEVEL"); m.width = bev; m.segments = seg
        bpy.ops.object.modifier_apply(modifier="b")
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = bev > 0
    parts.append(o)
    return o


def cyl(name, r, depth, at, rot, mat, parts, v=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=depth, location=P(*at), rotation=rot)
    o = act()
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


W, D, H, HOUSE, PLINTH, WALL, LID = 1.5, 0.74, 0.86, 0.34, 0.1, 0.05, 0.09
LW = W - HOUSE
CX = -HOUSE / 2          # (the cavity's middle along x)
M = {
    "enamel": pbr("FzEnamel", lin("#dce9f1"), rough=0.3, coat=0.6),
    "lid": pbr("FzLid", lin("#eaf3f9"), rough=0.28, coat=0.6),
    "liner": pbr("FzLiner", lin("#eef6fb"), rough=0.5),
    "frost": pbr("FzFrost", lin("#f8fcff"), rough=0.9),
    "plinth": pbr("FzPlinth", lin("#46576a"), rough=0.6),
    "steel": pbr("FzSteel", lin("#cdd5db"), rough=0.2, metal=0.9),
    "dark": pbr("FzDark", lin("#2a3138"), rough=0.6),
    "gasket": pbr("FzGasket", lin("#5a646e"), rough=0.7),
    "lcd": pbr("FzLcd", lin("#1c2a24"), rough=0.3, emit=lin("#5affb0"), emit_strength=0.8),
    "lamp": pbr("FzLamp", lin("#ff4a3a"), rough=0.3, emit=lin("#ff4a3a"), emit_strength=2.0),
    "plate": pbr("FzPlate", lin("#c8a24a"), rough=0.3, metal=0.8),
    "wire": pbr("FzWire", lin("#d8dee4"), rough=0.25, metal=0.8),
    "ice": pbr("FzIce", lin("#cfe8f6"), rough=0.08, coat=0.9),
    "film": pbr("FzFilm", lin("#f4f8fb"), rough=0.1, coat=1.0),
    "salmon": pbr("FzSalmon", lin("#f08a64"), rough=0.4),
    "buri": pbr("FzBuri", lin("#e8b0a0"), rough=0.4),
    "mackerel": pbr("FzMackerel", lin("#4a7a86"), rough=0.3, coat=0.5),
    "aji": pbr("FzAji", lin("#8aa0ac"), rough=0.3, coat=0.5),
    "ayu": pbr("FzAyu", lin("#7c9474"), rough=0.3, coat=0.5),
    "belly": pbr("FzBelly", lin("#eceee6"), rough=0.3, coat=0.5),
    "saury": pbr("FzSaury", lin("#3c5c8c"), rough=0.3, coat=0.5),
    "styro": pbr("FzStyro", lin("#f6f6f2"), rough=0.9),
    "label": pbr("FzLabel", lin("#f2e6c8"), rough=0.7),
    "labelInk": pbr("FzLabelInk", lin("#c8302a"), rough=0.7),
}

# ---------------------------------------------------------------- the body
body = []
box("FzPlinth", (W - 0.04, PLINTH, D - 0.04), (0, PLINTH / 2, 0), M["plinth"], 0.01, 2, body)
CH = H - LID - PLINTH
# (the walls round the cavity, softly rounded at the outer corners; the housing a solid block at the right)
box("FzFront", (LW, CH, WALL), (CX, PLINTH + CH / 2, D / 2 - WALL / 2), M["enamel"], 0.012, 3, body)
box("FzBack", (LW, CH, WALL), (CX, PLINTH + CH / 2, -D / 2 + WALL / 2), M["enamel"], 0.012, 3, body)
box("FzLeft", (WALL, CH, D), (-W / 2 + WALL / 2, PLINTH + CH / 2, 0), M["enamel"], 0.012, 3, body)
box("FzHouse", (HOUSE, H - PLINTH, D), (W / 2 - HOUSE / 2, (H + PLINTH) / 2, 0), M["enamel"], 0.014, 3, body)
box("FzFloor", (LW - 2 * WALL + 0.02, 0.05, D - 2 * WALL + 0.02), (CX, PLINTH + 0.025, 0), M["liner"], 0, 1, body)
for z in (1, -1):
    box("FzLinerFB", (LW - 2 * WALL, CH - 0.06, 0.004), (CX, PLINTH + 0.05 + (CH - 0.06) / 2, z * (D / 2 - WALL - 0.002)), M["liner"], 0, 1, body)
box("FzSep", (0.004, CH - 0.06, D - 2 * WALL), (W / 2 - HOUSE - 0.002, PLINTH + 0.05 + (CH - 0.06) / 2, 0), M["liner"], 0, 1, body)
# (the chrome rim round the opening)
# (one flat frame, mitred at its corners, set in a little from the body's rounded outer edges so no end of it sticks out)
RI = 0.008                  # (how far in from the body's outer faces)
RW = 0.022                  # (its width)
x0_, x1_, z0_, z1_ = -W / 2 + RI, W / 2 - HOUSE - 0.002, -D / 2 + RI, D / 2 - RI
outer = [(x0_, z0_), (x1_, z0_), (x1_, z1_), (x0_, z1_)]
inner = [(x0_ + RW, z0_ + RW), (x1_ - RW, z0_ + RW), (x1_ - RW, z1_ - RW), (x0_ + RW, z1_ - RW)]
bm = bmesh.new()
ry0, ry1 = H - LID - 0.012, H - LID
vo = [[bm.verts.new(P(x, y, z)) for (x, z) in outer] for y in (ry0, ry1)]
vi = [[bm.verts.new(P(x, y, z)) for (x, z) in inner] for y in (ry0, ry1)]
for i in range(4):
    j = (i + 1) % 4
    bm.faces.new((vo[1][i], vo[1][j], vi[1][j], vi[1][i]))
    bm.faces.new((vo[0][j], vo[0][i], vi[0][i], vi[0][j]))
    bm.faces.new((vo[0][i], vo[0][j], vo[1][j], vo[1][i]))
    bm.faces.new((vi[0][j], vi[0][i], vi[1][i], vi[1][j]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("FzRim"); bm.to_mesh(me); bm.free()
o = bpy.data.objects.new("FzRim", me); bpy.context.collection.objects.link(o)
o.data.materials.append(M["steel"])
bpy.context.view_layer.objects.active = o
m_ = o.modifiers.new("b", "BEVEL"); m_.width = 0.002; m_.segments = 2
bpy.ops.object.modifier_apply(modifier="b")
body.append(o)
# (the housing: its top capped in steel, a louvred grille low on its face, the red lamp above)
HX = W / 2 - HOUSE / 2
box("FzHouseTop", (HOUSE + 0.01, 0.012, D + 0.01), (HX, H + 0.006, 0), M["steel"], 0.004, 2, body)
for k in range(5):
    box("FzLouvre", (0.2, 0.012, 0.006), (HX, 0.22 + k * 0.036, D / 2 + 0.003), M["gasket"], 0.002, 1, body)
# (the temperature display, reading -20, in its dark frame)
box("FzDisplay", (0.11, 0.045, 0.006), (HX - 0.03, 0.62, D / 2 + 0.004), M["lcd"], 0.003, 1, body)
box("FzDisplayFrame", (0.125, 0.06, 0.004), (HX - 0.03, 0.62, D / 2 + 0.001), M["gasket"], 0.003, 1, body)
# (the power lamp's chrome bezel; its glass bulb is the game's own, so it can glow: Decor's IngredientFridge)
cyl("FzLampBezel", 0.016, 0.008, (HX + 0.07, 0.62, D / 2 + 0.004), (math.pi / 2, 0, 0), M["steel"], body, 20)

# ---------------------------------------------------------------- the lid, hinged on its back edge
lid = []
HY, HZ = H - LID, -D / 2
box("FzLidSlab", (LW, LID, D), (CX, HY + LID / 2, 0), M["lid"], 0.02, 4, lid)
box("FzLidLiner", (LW - 0.06, 0.006, D - 0.06), (CX, HY + 0.003, 0), M["liner"], 0, 1, lid)
for sz in (-1, 1):
    box("FzGasket", (LW - 0.06, 0.008, 0.016), (CX, HY + 0.0045, sz * (D / 2 - 0.045)), M["gasket"], 0.003, 1, lid)
for sx in (-1, 1):
    box("FzGasket", (0.016, 0.008, D - 0.06), (CX + sx * (LW / 2 - 0.045), HY + 0.0045, 0), M["gasket"], 0.003, 1, lid)
cyl("FzHandle", 0.011, 0.5, (CX, HY + LID * 0.62, D / 2 + 0.02), (0, math.pi / 2, 0), M["steel"], lid, 12)
for x in (-0.22, 0.22):
    box("FzHandleFoot", (0.02, 0.03, 0.03), (CX + x, HY + LID * 0.62, D / 2 + 0.006), M["steel"], 0.004, 2, lid)
for x in (-LW / 2 + 0.16, LW / 2 - 0.16):
    box("FzHinge", (0.1, 0.05, 0.014), (CX + x, HY + LID / 2, -D / 2 - 0.004), M["steel"], 0.003, 2, lid)

# ---------------------------------------------------------------- what's in it
goods = []
FL0 = PLINTH + 0.05         # (the cavity's floor)
FL = FL0 + 0.34              # (where today's things lie: on the stock packed below them, the freezer half full)
# (the stock packed in below: a layer of white fish boxes side by side, each with its red-lettered label, filling the floor)
for i in range(4):
    for j in range(2):
        bx = CX - LW / 2 + WALL + 0.14 + i * (LW - 2 * WALL - 0.1) / 4
        bz = -D / 2 + WALL + 0.16 + j * 0.3
        box(f"FzStock{i}{j}", ((LW - 2 * WALL - 0.12) / 4 - 0.01, 0.33, 0.29), (bx + 0.03, FL0 + 0.165, bz), M["styro"], 0.01, 2, goods)
        box(f"FzStockLabel{i}{j}", (0.12, 0.003, 0.07), (bx + 0.03, FL0 + 0.332, bz), M["label"], 0, 1, goods)
        box(f"FzStockInk{i}{j}", (0.08, 0.004, 0.018), (bx + 0.03, FL0 + 0.333, bz - 0.01), M["labelInk"], 0, 1, goods)


def fish(name, at, length, depth, mat, turn=0.0):
    """a whole fish frozen stiff, glazed in a skin of ice: a slim oval body, its tail, laid on its side"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=1)
    for v in bm.verts:
        x, y, z = v.co
        taper = 1 - max(0.0, -x) * 0.7
        v.co = Vector((x * length / 2, y * depth * 0.32 * taper, z * depth / 2 * taper))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o.rotation_euler = (math.pi / 2, 0, turn)
    o.location = P(at[0], at[1] + depth * 0.32, at[2])
    goods.append(o)
    # (the tail)
    bm = bmesh.new()
    vs = [bm.verts.new(q) for q in ((0, 0, 0), (-length * 0.16, 0, depth * 0.38), (-length * 0.12, 0, 0), (-length * 0.16, 0, -depth * 0.38))]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(name + "Tail"); bm.to_mesh(me); bm.free()
    t = bpy.data.objects.new(name + "Tail", me); bpy.context.collection.objects.link(t)
    t.data.materials.append(mat)
    sm = t.modifiers.new("s", "SOLIDIFY"); sm.thickness = 0.004
    t.location = (-length / 2 + 0.01, 0, 0)
    t.parent = o
    goods.append(t)
    # (its glaze: the same shape a hair bigger, clear ice)
    g = o.copy(); g.data = o.data.copy(); g.data.materials.clear(); g.data.materials.append(M["ice"])
    g.scale = (1.04, 1.08, 1.06); bpy.context.collection.objects.link(g); g.name = name + "Glaze"
    goods.append(g)


# (whole fish side by side on the floor at the left: mackerel, horse mackerel, ayu)
x0 = CX - LW / 2 + WALL + 0.19
for k, (mat, ln, dp) in enumerate(((M["mackerel"], 0.3, 0.08), (M["mackerel"], 0.29, 0.08), (M["aji"], 0.24, 0.07), (M["aji"], 0.25, 0.07), (M["ayu"], 0.22, 0.06))):
    fish(f"FzFish{k}", (x0 + 0.02 * (k % 2), FL + 0.002 + (k // 3) * 0.05, -D / 2 + WALL + 0.09 + (k % 3) * 0.1), ln, dp, mat, random.uniform(-0.08, 0.08))
# (vacuum-packed fillets, flat under their film, in the middle)
for k, mat in enumerate((M["salmon"], M["salmon"], M["buri"], M["buri"])):
    at = (CX + 0.02 + (k % 2) * 0.17, FL + 0.012 + (k // 2) * 0.026, 0.02 + (k % 2) * 0.03)
    box(f"FzFillet{k}", (0.15, 0.02, 0.09), at, mat, 0.008, 2, goods).rotation_euler.z = random.uniform(-0.2, 0.2)
    box(f"FzFilm{k}", (0.18, 0.024, 0.12), at, M["film"], 0.006, 2, goods).rotation_euler.z = goods[-2].rotation_euler.z
# (a styrofoam fish box at the right of the cavity, its lid set ajar, a red-lettered label)
SBX = W / 2 - HOUSE - WALL - 0.17
box("FzStyroBox", (0.3, 0.16, 0.4), (SBX, FL + 0.08, 0.03), M["styro"], 0.01, 2, goods)
lidb = box("FzStyroLid", (0.31, 0.03, 0.41), (SBX - 0.02, FL + 0.175, 0.05), M["styro"], 0.008, 2, goods)
lidb.rotation_euler = (0.06, 0, 0.12)
box("FzStyroLabel", (0.14, 0.003, 0.08), (SBX - 0.02, FL + 0.192, 0.06), M["label"], 0, 1, goods).rotation_euler = (0.06, 0, 0.12)
box("FzStyroLabelInk", (0.1, 0.004, 0.02), (SBX - 0.02, FL + 0.193, 0.05), M["labelInk"], 0, 1, goods).rotation_euler = (0.06, 0, 0.12)
# (a wire basket hung on the front rim, the saury frozen in a bundle in it)
BX, BZ, BY = CX - 0.12, D / 2 - WALL - 0.13, H - LID - 0.2
for (a, b) in (((-0.18, 0, -0.1), (0.18, 0, -0.1)), ((-0.18, 0, 0.1), (0.18, 0, 0.1)), ((-0.18, 0, -0.1), (-0.18, 0, 0.1)), ((0.18, 0, -0.1), (0.18, 0, 0.1))):
    for yy in (0.0, 0.16):
        pa, pb = Vector((BX + a[0], BY + yy, BZ + a[2])), Vector((BX + b[0], BY + yy, BZ + b[2]))
        mid = (pa + pb) / 2
        dd = pb - pa
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.003, depth=dd.length, location=P(*mid))
        o = act(); o.name = "FzWire"; o.data.materials.append(M["wire"])
        o.rotation_euler = (0, math.pi / 2, 0) if abs(dd.x) > abs(dd.z) else (math.pi / 2, 0, 0)
        goods.append(o)
for k in range(9):
    x = BX - 0.16 + k * 0.04
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0025, depth=0.2, location=P(x, BY, BZ), rotation=(math.pi / 2, 0, 0))
    o = act(); o.name = "FzWire"; o.data.materials.append(M["wire"]); goods.append(o)
for (sx, sz) in ((-0.18, -0.1), (0.18, -0.1), (-0.18, 0.1), (0.18, 0.1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.003, depth=0.16, location=P(BX + sx, BY + 0.08, BZ + sz))
    o = act(); o.name = "FzWire"; o.data.materials.append(M["wire"]); goods.append(o)
for k in range(5):
    fish(f"FzSaury{k}", (BX - 0.02 + k * 0.012, BY + 0.01 + k * 0.012, BZ - 0.06 + k * 0.03), 0.34, 0.045, M["saury"], random.uniform(-0.04, 0.04))
# (blocks of ice and a scatter of frost over it all)
for k in range(10):
    at = (CX - LW / 2 + WALL + 0.08 + random.random() * (LW - 2 * WALL - 0.16), FL + 0.02, random.uniform(-D / 2 + WALL + 0.09, D / 2 - WALL - 0.09))
    s = random.uniform(0.02, 0.035)
    box("FzIceCube", (s, s, s), at, M["ice"], 0.004, 1, goods).rotation_euler = (random.random(), random.random(), random.random())

# ---------------------------------------------------------------- joined into its three nodes and exported
def join(objs, name, origin=None):
    for o in objs:
        for m in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = act()
    o.name = name
    o.data.name = name
    if origin:
        bpy.context.scene.cursor.location = origin
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        bpy.context.scene.cursor.location = (0, 0, 0)
    return o


b = join(body, "FreezerBody")
l = join(lid, "FreezerLid", P(CX, HY, HZ))
g = join(goods, "FreezerGoods")
root = bpy.data.objects.new("Freezer", None)
bpy.context.collection.objects.link(root)
for o in (b, l, g):
    o.parent = root
export_dish(root, [root, b, l, g], os.path.join(PROJECT, "public", "models", "freezer.glb"), os.path.join(PROJECT, "blender", "freezer.blend"), None)
print("FREEZER_DONE", sum(len(o.data.polygons) for o in (b, l, g)))
