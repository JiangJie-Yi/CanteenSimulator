"""The cook table's fryer (fryer.glb; item 469, the owner's, 2026-11-21: 「料理台在增加油炸台，可以炸薯條、天婦羅」): a stainless tabletop
deep fryer as a small shop's is (業務用卓上フライヤー), its oil well, its basket hung on its back rim, its control box behind with a knob and
a lamp; a draining tray beside it with its wire rack (網) where what's fried is set to drain.

Nodes (each its own, for the game to work):
- "Fryer": the fryer's body (stainless, its edges eased), the oil well's walls and rim, the control box and its knob and lamp; still.
- "FryerOil": the oil's face in the well (golden), a hand under the rim: the game shimmers it and bubbles it while something's in.
- "FryerBasket": the basket (a wire box: its frame and its mesh's bars) with its handle out toward the front, hung over the back rim; its
  origin its floor's middle (the game lowers it into the oil and lifts it out).
- "FryerRack": the draining tray (天ぷらバット) with its wire rack over it, beside the fryer at its right.
(Its stainless work table of its own, "FryerStand", is gone (item 494, the owner's 「做飯糰的區域減少至二分之一」, an arrow from the fryer to
beside the stove): the rice balls' place halved, the fryer stands on the work counter itself now, by the stove.)

The frame: metres; y up; x across (the rack at +x); z toward the cook in front (the basket's handle at +z); the fryer's foot's middle at
the origin.
Low-poly (docs/MODELING.md): boxes and bars, no rounds over 16 sides, about 900 triangles all told.

Run:
    blender -b --factory-startup --python blender/fryer.py -- <project path> [preview.png]
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
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {
    "steel": pbr("FryerSteel", lin("#c4c7cb"), rough=0.3, metal=0.8),
    "dark": pbr("FryerDark", lin("#3a3c40"), rough=0.5, metal=0.4),
    "oil": pbr("FryerOil", lin("#c98a2a"), rough=0.15),
    "wire": pbr("FryerWire", lin("#9a9da2"), rough=0.35, metal=0.8),
    "grip": pbr("FryerGrip", lin("#1f1d1c"), rough=0.5),
    "knob": pbr("FryerKnob", lin("#232326"), rough=0.4),
    "lamp": pbr("FryerLamp", lin("#ff5a3a"), rough=0.4, emit=lin("#ff5a3a"), emit_strength=1.5),
}
FW, FD, FH = 0.30, 0.36, 0.22               # (the body)
WW, WD, WELL = 0.22, 0.24, 0.16             # (the oil well's opening, its depth)
WZ = 0.03                                   # (the well's middle a little forward of the body's)
OIL_Y = FH - 0.04                           # (the oil's face)
parts = []


def obj_of(name, bm, mat):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for m_ in (mat if isinstance(mat, list) else [mat]):
        o.data.materials.append(m_)
    for p_ in o.data.polygons:
        p_.use_smooth = False
    return o


def box(bm, lo, hi, mi=0, skip=()):
    """a box's faces into `bm` (`skip`: which to leave out: 'top', 'bottom')"""
    vs = [bm.verts.new(P(x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    faces = {'x0': (0, 1, 3, 2), 'x1': (4, 6, 7, 5), 'bottom': (0, 4, 5, 1), 'top': (2, 3, 7, 6), 'z0': (0, 2, 6, 4), 'z1': (1, 5, 7, 3)}
    for k, (a, b, c, d) in faces.items():
        if k in skip:
            continue
        f = bm.faces.new((vs[a], vs[b], vs[c], vs[d]))
        f.material_index = mi
    return vs


# ---- the body: a stainless box with the well's opening in its top: its top a frame round the opening, the well's four walls down to the
# well's floor; the control box behind, a knob and a red lamp on its face
bm = bmesh.new()
box(bm, (-FW / 2, 0, -FD / 2), (FW / 2, FH, FD / 2), skip=('top',))
x0, x1, z0, z1 = -WW / 2, WW / 2, WZ - WD / 2, WZ + WD / 2
# (the top frame: four strips round the opening)
for lo, hi in (((-FW / 2, FH - 0.004, -FD / 2), (FW / 2, FH, z0)), ((-FW / 2, FH - 0.004, z1), (FW / 2, FH, FD / 2)),
               ((-FW / 2, FH - 0.004, z0), (x0, FH, z1)), ((x1, FH - 0.004, z0), (FW / 2, FH, z1))):
    box(bm, lo, hi, skip=('bottom',))
# (the well: its walls inside the opening, its floor; dark inside)
box(bm, (x0, FH - WELL, z0), (x1, FH - 0.004, z1), mi=1, skip=('top',))
# (the control box behind, its face toward the cook, a knob and the lamp on it)
box(bm, (-FW / 2 + 0.02, FH, -FD / 2 + 0.005), (FW / 2 - 0.02, FH + 0.07, -FD / 2 + 0.06))
FRY = obj_of("fb", bm, [M["steel"], M["dark"]])
bm = bmesh.new()
n = 12
kr = [[bm.verts.new(P(-0.06 + r * math.cos(2 * math.pi * i / n), FH + 0.035 + r * math.sin(2 * math.pi * i / n), z)) for i in range(n)] for r, z in ((0.017, -FD / 2 + 0.06), (0.017, -FD / 2 + 0.075), (0.013, -FD / 2 + 0.079))]
for i in range(2):
    for j in range(n):
        bm.faces.new((kr[i][j], kr[i][(j + 1) % n], kr[i + 1][(j + 1) % n], kr[i + 1][j]))
ladder_fill(bm, kr[-1])
knob = obj_of("fk", bm, M["knob"])
bm = bmesh.new()
box(bm, (0.05, FH + 0.028, -FD / 2 + 0.06), (0.066, FH + 0.044, -FD / 2 + 0.066))
lamp = obj_of("fl", bm, M["lamp"])
bpy.ops.object.select_all(action="DESELECT")
for o in (FRY, knob, lamp):
    o.select_set(True)
bpy.context.view_layer.objects.active = FRY
bpy.ops.object.join()
FRY = bpy.context.view_layer.objects.active
FRY.name = "Fryer"
parts.append(FRY)

# ---- the oil's face: one sheet across the well, in from its walls a hair
bm = bmesh.new()
vs = [bm.verts.new(P(x, 0, z)) for x, z in ((x0 + 0.001, z0 + 0.001), (x1 - 0.001, z0 + 0.001), (x1 - 0.001, z1 - 0.001), (x0 + 0.001, z1 - 0.001))]
bm.faces.new(vs[::-1])
OIL = obj_of("FryerOil", bm, M["oil"])
OIL.location = P(0, OIL_Y, 0)
parts.append(OIL)

# ---- the basket: a wire box (its four corner posts, its top rim and its floor's frame as bars; its mesh as bars across its floor and up
# its sides, every 2 cm), its handle out of its front rim toward the cook; its origin its floor's middle
BW_, BD_, BH_ = WW - 0.03, WD - 0.05, 0.1
t = 0.004
bm = bmesh.new()


def bar(a, b, th=t, mi=0):
    """a square bar from a to b (in the basket's frame)"""
    d = (b - a).normalized()
    up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized() * th / 2
    s2 = d.cross(s1).normalized() * th / 2
    ring_a = [bm.verts.new(P(*(a + s1 * i + s2 * j))) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ring_b = [bm.verts.new(P(*(b + s1 * i + s2 * j))) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for k in range(4):
        f = bm.faces.new((ring_a[k], ring_a[(k + 1) % 4], ring_b[(k + 1) % 4], ring_b[k]))
        f.material_index = mi


cx = [-BW_ / 2, BW_ / 2]
cz = [-BD_ / 2, BD_ / 2]
for y in (0.0, BH_):
    bar(Vector((cx[0], y, cz[0])), Vector((cx[1], y, cz[0])))
    bar(Vector((cx[0], y, cz[1])), Vector((cx[1], y, cz[1])))
    bar(Vector((cx[0], y, cz[0])), Vector((cx[0], y, cz[1])))
    bar(Vector((cx[1], y, cz[0])), Vector((cx[1], y, cz[1])))
for x in cx:
    for z in cz:
        bar(Vector((x, 0, z)), Vector((x, BH_, z)))
# (the floor's mesh: bars across it every 2.4 cm; the sides' every 3 cm, upright)
k = 1
while -BW_ / 2 + 0.024 * k < BW_ / 2 - 0.01:
    x = -BW_ / 2 + 0.024 * k
    bar(Vector((x, 0, cz[0])), Vector((x, 0, cz[1])), th=0.0025)
    for z in cz:
        bar(Vector((x, 0, z)), Vector((x, BH_, z)), th=0.0025)
    k += 1
k = 1
while -BD_ / 2 + 0.03 * k < BD_ / 2 - 0.01:
    z = -BD_ / 2 + 0.03 * k
    for x in cx:
        bar(Vector((x, 0, z)), Vector((x, BH_, z)), th=0.0025)
    k += 1
# (the handle: two rods from the front rim's corners meeting in a grip out toward the cook, a little up)
g0 = Vector((0, BH_ + 0.04, cz[1] + 0.13))
bar(Vector((cx[0] + 0.02, BH_, cz[1])), g0 + Vector((-0.012, 0, -0.02)))
bar(Vector((cx[1] - 0.02, BH_, cz[1])), g0 + Vector((0.012, 0, -0.02)))
bar(g0 + Vector((0, 0, -0.03)), g0 + Vector((0, 0.012, 0.07)), th=0.016, mi=1)
BASKET = obj_of("FryerBasket", bm, [M["wire"], M["grip"]])
# (hung over the back: its floor a little under the oil's face when it's down; here up, out of the oil, hooked on the back rim)
BASKET.location = P(0, OIL_Y + 0.02, WZ)
parts.append(BASKET)

# ---- the draining tray and its rack, at the fryer's right: a shallow steel tray, a rack of bars over it, standing on its rim
RX = FW / 2 + 0.03 + 0.11
TW, TD, TH = 0.22, 0.26, 0.04
bm = bmesh.new()
box(bm, (RX - TW / 2, 0, -TD / 2), (RX + TW / 2, TH, TD / 2), skip=('top',))
box(bm, (RX - TW / 2 + 0.006, 0.004, -TD / 2 + 0.006), (RX + TW / 2 - 0.006, TH, TD / 2 - 0.006), mi=1, skip=('top',))
# (its rim: four strips over the gap between the outside and the inside)
for lo, hi in (((RX - TW / 2, TH, -TD / 2), (RX + TW / 2, TH + 0.002, -TD / 2 + 0.006)), ((RX - TW / 2, TH, TD / 2 - 0.006), (RX + TW / 2, TH + 0.002, TD / 2)),
               ((RX - TW / 2, TH, -TD / 2 + 0.006), (RX - TW / 2 + 0.006, TH + 0.002, TD / 2 - 0.006)), ((RX + TW / 2 - 0.006, TH, -TD / 2 + 0.006), (RX + TW / 2, TH + 0.002, TD / 2 - 0.006))):
    box(bm, lo, hi, skip=('bottom',))
RACK_Y = TH + 0.012
for k in range(9):
    x = RX - TW / 2 + 0.02 + k * (TW - 0.04) / 8
    box(bm, (x - 0.002, RACK_Y - 0.003, -TD / 2 + 0.012), (x + 0.002, RACK_Y, TD / 2 - 0.012), mi=2)
for z in (-TD / 2 + 0.02, 0.0, TD / 2 - 0.02):
    box(bm, (RX - TW / 2 + 0.012, RACK_Y - 0.007, z - 0.002), (RX + TW / 2 - 0.012, RACK_Y - 0.003, z + 0.002), mi=2)
# (its feet: four little posts from the rack's corners down to the tray's floor)
for x in (RX - TW / 2 + 0.014, RX + TW / 2 - 0.014):
    for z in (-TD / 2 + 0.014, TD / 2 - 0.014):
        box(bm, (x - 0.002, 0.004, z - 0.002), (x + 0.002, RACK_Y - 0.007, z + 0.002), mi=2)
RACK = obj_of("FryerRack", bm, [M["steel"], M["dark"], M["wire"]])
parts.append(RACK)

# (no stand of its own (item 494): the fryer and the tray stand on the work counter, beside the stove)

root = bpy.data.objects.new("FryerRoot", None)
bpy.context.collection.objects.link(root)
for o_ in parts:
    o_.parent = root
    print(o_.name, sum(len(p_.vertices) - 2 for p_ in o_.data.polygons))

export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "fryer.glb"), os.path.join(PROJECT, "blender", "fryer.blend"), PREVIEW)
