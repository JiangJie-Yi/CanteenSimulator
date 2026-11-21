"""What the stove and the fryer make (stovefood.glb; items 461, 469, 470: the owner's 「需要蛋有蛋料理，蛋花湯、玉子燒、蛋包飯等等..」「以及飯糰
多手卷，也需要蛋」「料理台在增加油炸台，可以炸薯條、天婦羅」): the food alone, each to be set on the shop's own plates and bowls (no plate of
its own), and what's seen in the pans while it's made. No eyes on anything (the owner's, 2026-11-12).

Nodes (each its own; its origin the middle of its foot, where it sits on the plate):
- "Tamagoyaki": the rolled omelette cut in four, the slices leaning a little each way, their cut faces showing its layers (a picture), a
  mound of grated daikon with a drop of soy beside them.
- "Omurice": the omelette over its rice, an oval dome, golden, a zigzag of ketchup over its top, a sprig of parsley.
- "HandRoll": a hand roll (手巻き): a cone of nori standing, rice at its mouth, a stick of tamago, of cucumber and a piece of salmon out of
  it.
- "Fries": a paper cone of chips standing, a dozen chips out of its top.
- "Tempura": two prawns in their golden batter, their red tails; a slice of sweet potato and a leaf of shiso, battered on one side; on a
  folded paper (kaishi).
- "EggDropTop": egg-drop soup's face (a disc): a clear golden broth with ribbons of egg and green onion (a picture), for the soup bowl.
- "PanEgg": beaten egg spread thin in the frying pan (an irregular round), and "PanRoll": the half-rolled omelette in the square pan.

The frame: metres; y up; x across; z toward the guest. Low-poly (docs/MODELING.md): every round at most 16 sides, ends laddered, under
1,100 triangles all told.

Run:
    blender -b --factory-startup --python blender/stovefood.py -- <project path> [preview.png]
"""
import math
import os
import random
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
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(461)
rng = random.Random(461)


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- the pictures: the omelette's cut face (its rolled layers, a lighter yellow, a fine darker line between), the egg-drop soup's face
N = 256
u, v = grid01(N)
# (the cut face: rings round a point low in it, as rolled; a little browned at its top edge)
r = np.sqrt(((u - 0.5) * 1.0) ** 2 + ((v - 0.42) * 1.25) ** 2)
lines = smooth(0.0, 0.035, np.abs(((r * 7.5) % 1.0) - 0.5) - 0.42)
cut = mix((0.98, 0.84, 0.36), (0.94, 0.74, 0.22), lines * 0.8)
cut = mix(cut, (0.78, 0.52, 0.18), smooth(0.88, 1.0, v) * 0.6)
CUT_TEX = image("tamago_cut", np.clip(cut, 0, 1).astype(np.float32))
# (the soup: clear gold, the egg's soft ribbons swirling, flecks of green onion)
broth = mix((0.86, 0.66, 0.32), (0.92, 0.74, 0.40), fbm(N, 3, 3, 3))
ang = np.arctan2(v - 0.5, u - 0.5)
rad = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2)
swirl = np.sin(ang * 3 + rad * 22 + fbm(N, 5, 5, 3) * 5)
ribbon = smooth(0.55, 0.85, swirl) * smooth(0.48, 0.3, rad)
broth = mix(broth, (0.99, 0.92, 0.55), ribbon * 0.95)
for _ in range(40):
    cx, cy = rng.uniform(0.15, 0.85), rng.uniform(0.15, 0.85)
    if (cx - 0.5) ** 2 + (cy - 0.5) ** 2 > 0.12:
        continue
    d = np.sqrt((u - cx) ** 2 + (v - cy) ** 2)
    broth = mix(broth, (0.32, 0.62, 0.22), smooth(0.012, 0.006, d))
SOUP_TEX = image("eggdrop_soup", np.clip(broth, 0, 1).astype(np.float32))

M = {
    "egg": pbr("FoodEgg", lin("#f2c548"), rough=0.5),
    "eggtop": pbr("FoodEggBrowned", lin("#e3a83a"), rough=0.5),
    "eggcut": pbr("FoodEggCut", (1, 1, 1), tex=CUT_TEX, rough=0.6),
    "daikon": pbr("FoodDaikon", lin("#f5f2ea"), rough=0.8),
    "soy": pbr("FoodSoyDrop", lin("#5a2a14"), rough=0.2),
    "omelette": pbr("FoodOmelette", lin("#f4b938"), rough=0.4),
    "ketchup": pbr("FoodKetchup", lin("#c8261e"), rough=0.3),
    "parsley": pbr("FoodParsley", lin("#3f8a2e"), rough=0.7),
    "nori": pbr("FoodNori", lin("#1d3326"), rough=0.6),
    "rice": pbr("FoodRice", lin("#f8f6ef"), rough=0.8),
    "cucumber": pbr("FoodCucumber", lin("#4f9a3a"), rough=0.6),
    "salmon": pbr("FoodSalmonRaw", lin("#f08a5a"), rough=0.5),
    "fry": pbr("FoodFry", lin("#e9b84e"), rough=0.6),
    "paper": pbr("FoodPaper", lin("#f6f1e6"), rough=0.9),
    "paperband": pbr("FoodPaperBand", lin("#c8342c"), rough=0.8),
    "batter": pbr("FoodBatter", lin("#e2aa4c"), rough=0.7),
    "tail": pbr("FoodPrawnTail", lin("#d2452c"), rough=0.5),
    "potato": pbr("FoodSweetPotato", lin("#f0c64e"), rough=0.6),
    "potskin": pbr("FoodSweetPotatoSkin", lin("#7a2f5a"), rough=0.6),
    "shiso": pbr("FoodShiso", lin("#3e7f34"), rough=0.6),
    "soup": pbr("FoodEggDropSoup", (1, 1, 1), tex=SOUP_TEX, rough=0.2),
}
parts = []


def obj_of(name, bm, mats):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for m_ in mats:
        o.data.materials.append(m_)
    for p_ in o.data.polygons:
        p_.use_smooth = False
    parts.append(o)
    return o


def box(bm, lo, hi, mi=0, rot=0.0, about=(0, 0, 0), uvl=None, cut_mi=None):
    """a box (turned `rot` round the upright through `about`); `cut_mi`: its two ends (the faces across x) in that material, their
    picture filling each"""
    c_, s_ = math.cos(rot), math.sin(rot)

    def T(x, y, z):
        dx, dz = x - about[0], z - about[2]
        return P(about[0] + dx * c_ - dz * s_, y, about[2] + dx * s_ + dz * c_)
    vs = [bm.verts.new(T(x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    for key, (a, b, c, d) in {'x0': (0, 1, 3, 2), 'x1': (4, 6, 7, 5), 'y0': (0, 4, 5, 1), 'y1': (2, 3, 7, 6), 'z0': (0, 2, 6, 4), 'z1': (1, 5, 7, 3)}.items():
        f = bm.faces.new((vs[a], vs[b], vs[c], vs[d]))
        f.material_index = cut_mi if (cut_mi is not None and key in ('x0', 'x1')) else (1 if key == 'y1' and mi == 0 and cut_mi is not None else mi)
        if uvl is not None and key in ('x0', 'x1'):
            for lp, (uu, vv) in zip(f.loops, ((0, 0), (0, 1), (1, 1), (1, 0)) if key == 'x0' else ((0, 0), (1, 0), (1, 1), (0, 1))):
                lp[uvl].uv = (uu, vv)
    return vs


def dome(bm, cx, cz, rx, rz, h, segs=16, rings=4, mi=0):
    """a half-egg: its oval foot (rx by rz) at y 0 up to `h`; its top shut by a ladder, never a fan"""
    rr = []
    for i in range(rings + 1):
        a = (math.pi / 2) * i / (rings + 0.6)
        k, y = math.cos(a), h * math.sin(a) / math.sin((math.pi / 2) * rings / (rings + 0.6))
        rr.append([bm.verts.new(P(cx + rx * k * math.cos(2 * math.pi * j / segs), y, cz + rz * k * math.sin(2 * math.pi * j / segs))) for j in range(segs)])
    for i in range(rings):
        for j in range(segs):
            f = bm.faces.new((rr[i][j], rr[i][(j + 1) % segs], rr[i + 1][(j + 1) % segs], rr[i + 1][j]))
            f.material_index = mi
    for f in ladder_fill(bm, rr[-1]) + ladder_fill(bm, rr[0][::-1]):
        f.material_index = mi
    return rr


def tube(bm, pts, rads, sides=6, mi=0, shut=(True, True)):
    """a tube through points (the game's frame) with a radius at each"""
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = (Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))).cross(d).normalized()
        up = d.cross(side).normalized()
        rings.append([bm.verts.new(P(*(p + side * rads[i] * math.cos(2 * math.pi * k / sides) + up * rads[i] * math.sin(2 * math.pi * k / sides)))) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
            f.material_index = mi
    if shut[0]:
        for f in ladder_fill(bm, rings[0][::-1]):
            f.material_index = mi
    if shut[1]:
        for f in ladder_fill(bm, rings[-1]):
            f.material_index = mi
    return rings


# ---- tamagoyaki: four slices standing in a row, each leaning a little, their cut faces toward the guest's left and right; daikon and soy
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
for k in range(4):
    x = -0.054 + k * 0.036
    box(bm, (x - 0.016, 0.0, -0.026), (x + 0.016, 0.032, 0.026), mi=0, rot=(k - 1.5) * 0.05, about=(x, 0, 0), uvl=uvl, cut_mi=2)
d0 = dome(bm, 0.09, 0.012, 0.022, 0.018, 0.022, segs=10, rings=3, mi=3)
d1 = dome(bm, 0.096, 0.004, 0.006, 0.005, 0.0235, segs=6, rings=2, mi=4)
obj_of("Tamagoyaki", bm, [M["egg"], M["eggtop"], M["eggcut"], M["daikon"], M["soy"]])

# ---- omurice: an oval dome of omelette, a zigzag of ketchup over its top, a sprig of parsley at its end
bm = bmesh.new()
dome(bm, 0.0, 0.0, 0.085, 0.05, 0.045, segs=16, rings=4, mi=0)
zig = []
for i in range(7):
    x = -0.055 + i * 0.0183
    z = 0.016 * (1 if i % 2 else -1)
    y = 0.045 * math.sqrt(max(0.0, 1 - (x / 0.085) ** 2 - (z / 0.05) ** 2)) + 0.002
    zig.append(Vector((x, y, z)))
tube(bm, zig, [0.0045] * len(zig), sides=4, mi=1)
for k in range(3):
    a = k * 2.1
    tube(bm, [Vector((0.07, 0.03, 0.0)), Vector((0.07 + 0.016 * math.cos(a), 0.038, 0.016 * math.sin(a)))], [0.004, 0.007], sides=5, mi=2)
obj_of("Omurice", bm, [M["omelette"], M["ketchup"], M["parsley"]])

# ---- the hand roll: a cone of nori standing (its point down), rice at its mouth, tamago, cucumber and salmon out of it
bm = bmesh.new()
n = 10
cone = [[bm.verts.new(P(rad * math.cos(2 * math.pi * j / n), y, rad * math.sin(2 * math.pi * j / n))) for j in range(n)] for rad, y in ((0.006, 0.0), (0.034, 0.1))]
for j in range(n):
    f = bm.faces.new((cone[0][j], cone[0][(j + 1) % n], cone[1][(j + 1) % n], cone[1][j]))
    f.material_index = 0
for f in ladder_fill(bm, cone[0][::-1]):
    f.material_index = 0
dome(bm, 0.0, 0.0, 0.032, 0.032, 0.012, segs=10, rings=2, mi=1)
for f in bm.faces:
    pass
# (the rice's dome sits at the cone's mouth: lifted there)
for vv in bm.verts:
    pass
obj_hr = obj_of("HandRollCone", bm, [M["nori"], M["rice"]])
bm = bmesh.new()
box(bm, (-0.006, 0.07, -0.006), (0.006, 0.14, 0.006), mi=0, rot=0.3)
box(bm, (0.008, 0.075, -0.004), (0.017, 0.135, 0.005), mi=1, rot=-0.2, about=(0.012, 0, 0))
box(bm, (-0.02, 0.08, 0.002), (-0.006, 0.125, 0.016), mi=2, rot=0.5, about=(-0.013, 0, 0.009))
fill = obj_of("HandRollFill", bm, [M["egg"], M["cucumber"], M["salmon"]])
# (the rice dome up to the cone's mouth)
for vv in obj_hr.data.vertices:
    pass
bpy.ops.object.select_all(action="DESELECT")
obj_hr.select_set(True)
fill.select_set(True)
bpy.context.view_layer.objects.active = obj_hr
bpy.ops.object.join()
HR = bpy.context.view_layer.objects.active
HR.name = "HandRoll"
parts.remove(fill)
# (the rice's dome was made at the foot: its points above the cone's foot and within the dome's round are the rice: lifted to the mouth)
me = HR.data
for p_ in me.polygons:
    if p_.material_index == 1:
        for vi in p_.vertices:
            co = me.vertices[vi].co
            if co.z < 0.02:
                co.z += 0.094

# ---- fries: a paper cone standing, a red band round it, a dozen chips out of its top at all angles
bm = bmesh.new()
n = 12
cone = [[bm.verts.new(P(rad * math.cos(2 * math.pi * j / n), y, rad * math.sin(2 * math.pi * j / n))) for j in range(n)] for rad, y in ((0.026, 0.0), (0.03, 0.03), (0.031, 0.04), (0.04, 0.085))]
for i in range(3):
    for j in range(n):
        f = bm.faces.new((cone[i][j], cone[i][(j + 1) % n], cone[i + 1][(j + 1) % n], cone[i + 1][j]))
        f.material_index = 1 if i == 1 else 0
for f in ladder_fill(bm, cone[0][::-1]):
    f.material_index = 0
for k in range(12):
    a = 2 * math.pi * k / 12 + rng.uniform(-0.2, 0.2)
    r0 = 0.02 * rng.uniform(0.2, 1.0)
    lean = rng.uniform(0.15, 0.4)
    x0, z0 = r0 * math.cos(a), r0 * math.sin(a)
    length = rng.uniform(0.07, 0.1)
    top = Vector((x0 + lean * length * math.cos(a), 0.05 + length, z0 + lean * length * math.sin(a)))
    foot = Vector((x0, 0.04, z0))
    tube(bm, [foot, top], [0.0045, 0.0045], sides=4, mi=2)
obj_of("Fries", bm, [M["paper"], M["paperband"], M["fry"]])

# ---- tempura on its folded paper: two prawns (golden, a little bumpy, their red tails fanned), a slice of sweet potato, a leaf of shiso
bm = bmesh.new()
box(bm, (-0.075, 0.0, -0.06), (0.075, 0.002, 0.06), mi=0, rot=0.12)
for k, (x, z, a) in enumerate(((-0.02, -0.022, 0.25), (0.0, 0.022, 0.05))):
    c_, s_ = math.cos(a), math.sin(a)
    pts, rads = [], []
    for i in range(6):
        t = i / 5
        along = -0.06 + 0.12 * t
        bow = 0.012 * math.sin(math.pi * t)
        pts.append(Vector((x + along * c_ - bow * s_, 0.012 + 0.004 * math.sin(math.pi * t), z + along * s_ + bow * c_)))
        rads.append(0.012 * (0.55 + 0.55 * math.sin(math.pi * min(1.0, t * 1.15))) + (0.0015 if i % 2 else 0.0))
    tube(bm, pts, rads, sides=6, mi=1, shut=(False, True))
    tail = pts[0]
    for sd in (-1, 1):
        tv = [bm.verts.new(P(*(tail + Vector((0.0, 0.0, 0.0))))), bm.verts.new(P(*(tail + Vector((-0.022 * c_ - sd * 0.01 * s_, 0.006, -0.022 * s_ + sd * 0.01 * c_))))),
              bm.verts.new(P(*(tail + Vector((-0.018 * c_ + sd * 0.002 * s_, 0.012, -0.018 * s_ - sd * 0.002 * c_)))))]
        f = bm.faces.new(tv)
        f.material_index = 2
# (the sweet potato: a thick round slice, its purple skin round it, battered)
n = 12
sp = [[bm.verts.new(P(0.045 + rad * math.cos(2 * math.pi * j / n), y, 0.03 + rad * 0.8 * math.sin(2 * math.pi * j / n))) for j in range(n)] for rad, y in ((0.026, 0.004), (0.026, 0.018))]
for j in range(n):
    f = bm.faces.new((sp[0][j], sp[0][(j + 1) % n], sp[1][(j + 1) % n], sp[1][j]))
    f.material_index = 4
for f in ladder_fill(bm, sp[1]):
    f.material_index = 3
for f in ladder_fill(bm, sp[0][::-1]):
    f.material_index = 3
# (the shiso leaf: a flat leaf, battered on its underside, leaning on the prawns)
lf = [(0.0, 0.0), (0.02, 0.012), (0.034, 0.03), (0.036, 0.05), (0.024, 0.068), (0.0, 0.08), (-0.024, 0.068), (-0.036, 0.05), (-0.034, 0.03), (-0.02, 0.012)]
top_ = [bm.verts.new(P(-0.05 + x, 0.01 + y * 0.25, 0.03 - y * 0.6)) for x, y in lf]
for f in ladder_fill(bm, top_):
    f.material_index = 5
obj_of("Tempura", bm, [M["paper"], M["batter"], M["tail"], M["potato"], M["potskin"], M["shiso"]])

# ---- egg-drop soup's face: a round of the picture, for the soup bowl (in its broth's place)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
n = 16
ring = [bm.verts.new(P(0.05 * math.cos(2 * math.pi * j / n), 0.0, 0.05 * math.sin(2 * math.pi * j / n))) for j in range(n)]
for f in ladder_fill(bm, ring):
    f.material_index = 0
    for lp in f.loops:
        co = lp.vert.co
        lp[uvl].uv = (0.5 + co.x / 0.1, 0.5 + co.y / 0.1)
_soup = obj_of("EggDropTop", bm, [M["soup"]])
# (its face up (item 494): a flat round of one side, its normals worked out round its own middle came out facing down, and seen from
# above, in the bowl and in the pot, it was culled: the bowl looked empty)
if _soup.data.polygons[0].normal.z < 0:
    _soup.data.flip_normals()

# ---- in the pans: beaten egg spread thin over the frying pan's face (an uneven round); the half-rolled omelette in the square pan
bm = bmesh.new()
n = 16
ring = [bm.verts.new(P(0.09 * (1 + 0.06 * math.sin(3 * j + 1)) * math.cos(2 * math.pi * j / n), 0.0, 0.09 * (1 + 0.06 * math.sin(3 * j + 1)) * math.sin(2 * math.pi * j / n))) for j in range(n)]
up = [bm.verts.new(P(v_.co.x * 0.98, 0.004, -v_.co.y * 0.98)) for v_ in ring]
for j in range(n):
    f = bm.faces.new((ring[j], ring[(j + 1) % n], up[(j + 1) % n], up[j]))
    f.material_index = 0
for f in ladder_fill(bm, up) + ladder_fill(bm, ring[::-1]):
    f.material_index = 0
obj_of("PanEgg", bm, [M["egg"]])
bm = bmesh.new()
box(bm, (-0.06, 0.0, -0.08), (0.06, 0.006, 0.08), mi=0)
tube(bm, [Vector((-0.058, 0.018, -0.055)), Vector((0.058, 0.018, -0.055))], [0.018, 0.018], sides=8, mi=1)
obj_of("PanRoll", bm, [M["egg"], M["eggtop"]])

# ---- what they're served on: a round white plate with an indigo line round its rim (the dishes but the soup), and the soup's lacquered bowl
# (black outside, red inside: the egg-drop soup's face set in it)
bm = bmesh.new()
n = 16
prof = [(0.0, 0.0), (0.05, 0.0), (0.06, 0.006), (0.085, 0.012), (0.092, 0.016), (0.088, 0.017), (0.06, 0.009)]
rings = [[bm.verts.new(P(r_ * math.cos(2 * math.pi * j / n), y_, r_ * math.sin(2 * math.pi * j / n))) for j in range(n)] for r_, y_ in prof[1:]]
for i in range(len(rings) - 1):
    for j in range(n):
        f = bm.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
        f.material_index = 1 if i == 2 else 0
for f in ladder_fill(bm, rings[0][::-1]) + ladder_fill(bm, rings[-1]):
    f.material_index = 0
obj_of("DishPlate", bm, [pbr("FoodPlate", lin("#f7f4ee"), rough=0.3), pbr("FoodPlateRim", lin("#2c4a7a"), rough=0.3)])
bm = bmesh.new()
prof = [(0.028, 0.0), (0.032, 0.008), (0.05, 0.03), (0.056, 0.05), (0.052, 0.05), (0.046, 0.032), (0.03, 0.014)]
rings = [[bm.verts.new(P(r_ * math.cos(2 * math.pi * j / n), y_, r_ * math.sin(2 * math.pi * j / n))) for j in range(n)] for r_, y_ in prof]
for i in range(len(rings) - 1):
    for j in range(n):
        f = bm.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
        f.material_index = 1 if i >= 3 else 0
for f in ladder_fill(bm, rings[0][::-1]):
    f.material_index = 0
for f in ladder_fill(bm, rings[-1]):
    f.material_index = 1
obj_of("SoupBowl", bm, [pbr("FoodBowlBlack", lin("#1f1a18"), rough=0.3), pbr("FoodBowlRed", lin("#a3241c"), rough=0.3)])

root = bpy.data.objects.new("StoveFood", None)
bpy.context.collection.objects.link(root)
for k, o_ in enumerate(parts):
    o_.parent = root
    # (laid out in a row, for the preview and for the game to find each by name)
    o_.location = P(-0.6 + 0.2 * k, 0.0, 0.0)
    print(o_.name, sum(len(p_.vertices) - 2 for p_ in o_.data.polygons))

export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "stovefood.glb"), os.path.join(PROJECT, "blender", "stovefood.blend"), PREVIEW)
