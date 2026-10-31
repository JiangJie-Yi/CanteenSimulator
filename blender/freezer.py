"""The kitchen's ingredient freezer (食材冷凍櫃): a wide chest freezer, front +z, its length along x, standing on the floor at y=0.

- freezer.glb, nodes (kept plain: only what says "freezer", nothing fussy):
  - "FreezerBody": the cabinet in pale blue-white enamel with soft rounded corners on a dark plinth, the compressor housing at the right
    end (a louvred grille and a red power lamp), a chrome rim round the opening; the cavity inside lined pale.
  - "FreezerLid": the lid, its origin on the hinge along the back edge, made shut (the game swings it up): a thick slab, a chrome handle,
    the grey gasket round its underside, two hinges.
  - "FreezerGoods": what's in it, the shop's own fish laid out neatly on a bed of ice: whole fish glazed in ice in rows (mackerel, horse
    mackerel, ayu, saury) and vacuum-packed salmon and yellowtail fillets.

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
for (sx_, sz_, cx, cz) in ((LW + 0.02, 0.022, CX, D / 2 - 0.011), (LW + 0.02, 0.022, CX, -D / 2 + 0.011), (0.022, D, -W / 2 + 0.011, 0), (0.022, D, W / 2 - HOUSE + 0.011, 0)):
    box("FzRim", (sx_, 0.012, sz_), (cx, H - LID - 0.006, cz), M["steel"], 0.003, 2, body)
# (the housing: its top capped in steel, a louvred grille low on its face, the red lamp above)
HX = W / 2 - HOUSE / 2
box("FzHouseTop", (HOUSE + 0.01, 0.012, D + 0.01), (HX, H + 0.006, 0), M["steel"], 0.004, 2, body)
for k in range(5):
    box("FzLouvre", (0.2, 0.012, 0.006), (HX, 0.22 + k * 0.036, D / 2 + 0.003), M["gasket"], 0.002, 1, body)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.011, location=P(HX, 0.6, D / 2 + 0.004))
o = act(); o.name = "FzLampMesh"; o.data.materials.append(M["lamp"]); body.append(o)

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
FL = FL0 + 0.3               # (where the fish lie: on a bed of crushed ice, the freezer half full)
box("FzIceBed", (LW - 2 * WALL - 0.01, FL - FL0, D - 2 * WALL - 0.01), (CX, (FL + FL0) / 2, 0), M["frost"], 0.01, 2, goods)


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


# (whole fish in neat rows across the ice, heads one way: mackerel, horse mackerel, ayu at the back, the saury at the front)
x0 = CX - LW / 2 + WALL + 0.2
rows = ((M["mackerel"], 0.3, 0.08), (M["mackerel"], 0.3, 0.08), (M["aji"], 0.25, 0.07), (M["ayu"], 0.22, 0.06), (M["ayu"], 0.22, 0.06))
for k, (mat, ln, dp) in enumerate(rows):
    fish(f"FzFish{k}", (x0, FL + 0.002, -D / 2 + WALL + 0.07 + k * 0.095), ln, dp, mat, 0.0)
for k in range(4):
    fish(f"FzSaury{k}", (x0 + 0.38, FL + 0.002, -D / 2 + WALL + 0.07 + k * 0.12), 0.34, 0.045, M["saury"], 0.0)
# (vacuum-packed fillets, flat under their film, squared up at the right)
for k, mat in enumerate((M["salmon"], M["salmon"], M["buri"])):
    at = (CX + LW / 2 - WALL - 0.13, FL + 0.012, -D / 2 + WALL + 0.1 + k * 0.15)
    box(f"FzFillet{k}", (0.15, 0.02, 0.09), at, mat, 0.008, 2, goods)
    box(f"FzFilm{k}", (0.18, 0.024, 0.12), at, M["film"], 0.006, 2, goods)

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
