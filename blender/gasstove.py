"""The work counter's gas stove and its pans (gasstove.glb; item 461, the owner's, 2026-11-21: 「電鍋往左移，右邊加一個瓦斯爐灶，用平底鍋
來煎料。」「需要蛋有蛋料理，蛋花湯、玉子燒、蛋包飯等等..」): a one-burner cassette gas stove (カセットコンロ), as a small kitchen's counter
has, its gas can under the lid at its right (the counter left room for one burner only, between the rice cooker moved left and the rice-ball
things: a two-burner's 81 cm, scaled as the cooker is, ran over them), the frying pan on it; the square copper tamagoyaki pan hung by it.

Nodes (each its own, for the game to work):
- "GasStove": the stove: its cream enamel body with its edges rounded, its charcoal top plate, the two burners' steel caps, the black cast
  iron pan supports (a ring and four prongs each), the front panel's strip; still.
- "StoveKnob0": the knob on its front, its axis at its origin (turned as the burner's lit).
- "StoveFlame0": the blue flames round the burner's cap, their origin at the cap's middle (shown, flickered and turned down by the game;
  small when off).
- "FryPan": the frying pan, its bottom's middle at its origin, resting on the burner's supports; its handle out to the left.
- "EggPan": the tamagoyaki pan (玉子焼き器), square, copper outside, tinned inside, its wooden handle toward the front; its bottom's middle
  at its origin (the game hangs it, and sets it on the burner for a tamagoyaki).
- "SoupPot": a little yukihira pot (雪平鍋), hammered aluminium, its wooden handle out to its left; its bottom's middle at its origin, where
  it waits on the counter at the stove's front left (the game sets it on the burner for an egg-drop soup).
- "StoveTools": what a stove's corner has by it (item 494, the owner's 「加入 鍋碗等料理用具」 round the stove): behind it a stoneware crock of
  tools standing in it, a ladle, a turner and a pair of long cooking chopsticks; at its front left a bowl of beaten egg with its chopsticks
  across it; still.

The frame: metres; y up; x across the stove (its left burner at -x); z out toward the cook in front of it (its knobs at +z); the stove's
foot's middle at the origin.
Low-poly (docs/MODELING.md): rounds at most 24 sides, ends laddered, about 800 triangles all told (the frying pan 250, the tamagoyaki pan 70).

Run:
    blender -b --factory-startup --python blender/gasstove.py -- <project path> [preview.png]
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
    """the game's frame (y up, z toward the cook) to Blender's (z up)"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {
    "enamel": pbr("StoveEnamel", lin("#ece7dc"), rough=0.45),
    "top": pbr("StoveTop", lin("#2b2d31"), rough=0.35),
    "steel": pbr("StoveSteel", lin("#b8bbbf"), rough=0.3, metal=0.8),
    "iron": pbr("StoveIron", lin("#1d1d1f"), rough=0.7),
    "knob": pbr("StoveKnob", lin("#222225"), rough=0.4),
    "mark": pbr("StoveMark", lin("#d8463a"), rough=0.5),
    "flame": pbr("StoveFlame", lin("#4f8cff"), rough=1.0, emit=lin("#5f9cff"), emit_strength=2.0),
    "pan": pbr("PanNonstick", lin("#2c2c30"), rough=0.45),
    "panin": pbr("PanInside", lin("#3d3d42"), rough=0.35),
    "bakelite": pbr("PanHandle", lin("#1f1c1a"), rough=0.5),
    "copper": pbr("PanCopper", lin("#c0683a"), rough=0.35, metal=0.7),
    "tin": pbr("PanTin", lin("#c9c8c2"), rough=0.4, metal=0.5),
    "wood": pbr("PanWood", lin("#b07a4a"), rough=0.6),
}

# ---- the measures
W, D, H = 0.34, 0.28, 0.085                 # (the body)
TOP_Y = H + 0.004                           # (the top plate's face)
BURN_X, BURN_Z = 0.05, -0.006               # (the burner: left of the middle (as -BURN_X), the can's lid at the right)
CAP_R, CAP_H = 0.038, 0.014
REST_Y = TOP_Y + 0.036                      # (the pan supports' tops: where a pan's bottom rests)
parts = []


def obj_of(name, bm, mat, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if isinstance(mat, list):
        for m_ in mat:
            o.data.materials.append(m_)
    else:
        o.data.materials.append(mat)
    for p_ in o.data.polygons:
        p_.use_smooth = smooth
    return o


def box(bm, lo, hi, mi=0):
    """a box's six faces into `bm` (material index `mi`)"""
    vs = [bm.verts.new(P(x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    for a, b, c, d in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        f = bm.faces.new((vs[a], vs[b], vs[c], vs[d]))
        f.material_index = mi
    return vs


def rounded_box(name, lo, hi, r, mats):
    """a box with its upright edges and its top's edges rounded (two steps), its top in mats[0], the rest in mats[1]"""
    bm = bmesh.new()
    box(bm, lo, hi)
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges if not all(abs(v.co.z - P(0, lo[1], 0).z) < 1e-6 for v in e.verts)], offset=r, segments=2,
                    profile=0.5, affect='EDGES')
    top = max(v.co.z for v in bm.verts)
    for f in bm.faces:
        f.material_index = 0 if all(abs(v.co.z - top) < 1e-6 for v in f.verts) else 1
    return obj_of(name, bm, mats)


def lathe(bm, cx, cz, prof, segs, mi=0, shut=(True, False)):
    """turned round the upright through (cx, cz): `prof` (radius, height) from the foot up; its ends shut by ladders where asked"""
    rings = [[bm.verts.new(P(cx + r * math.cos(2 * math.pi * k / segs), h, cz + r * math.sin(2 * math.pi * k / segs))) for k in range(segs)] for r, h in prof]
    for i in range(len(rings) - 1):
        for k in range(segs):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
            f.material_index = mi
    if shut[0]:
        for f in ladder_fill(bm, rings[0][::-1]):
            f.material_index = mi
    if shut[1]:
        for f in ladder_fill(bm, rings[-1]):
            f.material_index = mi
    return rings


# ---- the stove: its body (cream enamel, the top's edges rounded), its charcoal top plate a little proud and in from the edges, the
# panel strip along its front under the knobs, the burners' steel caps, the black pan supports
body = rounded_box("sb", (-W / 2, 0, -D / 2), (W / 2, H, D / 2), 0.012, [M["enamel"], M["enamel"]])
bm = bmesh.new()
box(bm, (-W / 2 + 0.014, H - 0.002, -D / 2 + 0.014), (W / 2 - 0.11, TOP_Y, D / 2 - 0.04))
# (the gas can's lid along its right, a little higher, its catch at the front)
box(bm, (W / 2 - 0.1, H - 0.002, -D / 2 + 0.01), (W / 2 - 0.012, H + 0.01, D / 2 - 0.012))
plate = obj_of("st", bm, M["top"])
bm = bmesh.new()
box(bm, (W / 2 - 0.1, 0.014, D / 2 - 0.002), (W / 2 - 0.014, 0.07, D / 2 + 0.002))
panel = obj_of("sp", bm, M["top"])
caps = []
for k, sd in enumerate((-1,)):
    bm = bmesh.new()
    lathe(bm, sd * BURN_X, BURN_Z, [(CAP_R + 0.012, TOP_Y - 0.002), (CAP_R + 0.012, TOP_Y + 0.004), (CAP_R, TOP_Y + 0.006),
                                     (CAP_R, TOP_Y + CAP_H), (CAP_R - 0.006, TOP_Y + CAP_H + 0.003)], 16, shut=(False, True))
    caps.append(obj_of(f"sc{k}", bm, M["steel"]))
# (the pan supports: a ring of ten round the burner, four prongs across it to the pan's rest)
grates = []
for k, sd in enumerate((-1,)):
    bm = bmesh.new()
    cx, cz, n, R, t = sd * BURN_X, BURN_Z, 10, 0.1, 0.008
    ring = [[bm.verts.new(P(cx + (R + dr) * math.cos(2 * math.pi * i / n), y, cz + (R + dr) * math.sin(2 * math.pi * i / n))) for (dr, y) in
             ((-t / 2, TOP_Y), (t / 2, TOP_Y), (t / 2, TOP_Y + 0.012), (-t / 2, TOP_Y + 0.012))] for i in range(n)]
    for i in range(n):
        a, b_ = ring[i], ring[(i + 1) % n]
        for j in range(4):
            bm.faces.new((a[j], b_[j], b_[(j + 1) % 4], a[(j + 1) % 4]))
    for q in range(4):
        ang = math.pi / 4 + q * math.pi / 2
        c_, s_ = math.cos(ang), math.sin(ang)
        r0, r1 = 0.05, R + 0.004
        # (a prong: a bar from near the cap out over the ring, its top the rest)
        pts = []
        for r_ in (r0, r1):
            for w_ in (-t / 2, t / 2):
                for y_ in (TOP_Y + 0.004, REST_Y):
                    pts.append(bm.verts.new(P(cx + r_ * c_ - w_ * s_, y_, cz + r_ * s_ + w_ * c_)))
        for a_, b2, c2, d2 in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            bm.faces.new((pts[a_], pts[b2], pts[c2], pts[d2]))
    grates.append(obj_of(f"sg{k}", bm, M["iron"]))
bpy.ops.object.select_all(action="DESELECT")
for o in [body, plate, panel] + caps + grates:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
STOVE = bpy.context.view_layer.objects.active
STOVE.name = "GasStove"
parts.append(STOVE)

# ---- the knob on the front panel under the can's lid: a round with a grip across it and a red mark; its axis at its origin
for k, sd in enumerate((1,)):
    bm = bmesh.new()
    n, r = 14, 0.021
    front = D / 2 + 0.002
    rings = [[bm.verts.new(P(r_ * math.cos(2 * math.pi * i / n), r_ * math.sin(2 * math.pi * i / n), z_)) for i in range(n)] for r_, z_ in ((r, 0.0), (r, 0.012), (r - 0.003, 0.016))]
    for i in range(2):
        for j in range(n):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
    ladder_fill(bm, rings[-1])
    grip = box(bm, (-0.017, -0.004, 0.016), (0.017, 0.004, 0.026))
    bm2 = bmesh.new()
    box(bm2, (0.009, -0.0022, 0.026), (0.015, 0.0022, 0.0265))
    knob = obj_of(f"StoveKnob{k}", bm, M["knob"])
    mark = obj_of(f"km{k}", bm2, M["mark"])
    bpy.ops.object.select_all(action="DESELECT")
    knob.select_set(True)
    mark.select_set(True)
    bpy.context.view_layer.objects.active = knob
    bpy.ops.object.join()
    knob = bpy.context.view_layer.objects.active
    knob.name = f"StoveKnob{k}"
    knob.location = P(W / 2 - 0.057, 0.042, front)
    parts.append(knob)

# ---- the flames: ten tongues round the cap, leaning out, blue; their origin the cap's middle at its top
for k, sd in enumerate((-1,)):
    bm = bmesh.new()
    n = 10
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        c_, s_ = math.cos(a), math.sin(a)
        t_ = Vector((-s_, 0, c_))
        base = Vector((CAP_R * c_, 0.004, CAP_R * s_))
        tip = Vector(((CAP_R + 0.012) * c_, 0.026, (CAP_R + 0.012) * s_))
        vs = [bm.verts.new(P(*(base - t_ * 0.007))), bm.verts.new(P(*(base + t_ * 0.007))), bm.verts.new(P(*tip))]
        bm.faces.new(vs)
    fl = obj_of(f"StoveFlame{k}", bm, M["flame"])
    fl.location = P(sd * BURN_X, TOP_Y + CAP_H, BURN_Z)
    parts.append(fl)

# ---- the frying pan: a shallow round pan, its outside dark, its cooking face a lighter grey, its rim rolled; its handle out to the left,
# a little up; its origin its bottom's middle, resting on the left burner
bm = bmesh.new()
segs = 20
out = lathe(bm, 0, 0, [(0.1, 0.0), (0.118, 0.038), (0.121, 0.041)], segs, mi=0, shut=(True, False))
inn = lathe(bm, 0, 0, [(0.094, 0.004), (0.114, 0.038), (0.117, 0.041)], segs, mi=1, shut=(True, False))
for k in range(segs):
    f = bm.faces.new((out[-1][k], inn[-1][k], inn[-1][(k + 1) % segs], out[-1][(k + 1) % segs]))
    f.material_index = 0
# (the handle: a tapering bar from under the rim, out and a little up)
hv = []
for t_, (w_, h_) in ((0.0, (0.013, 0.011)), (0.17, (0.009, 0.009))):
    x_ = -(0.112 + t_)
    y_ = 0.03 + t_ * 0.18
    hv.append([bm.verts.new(P(x_, y_ + dy, dz)) for dy, dz in ((-h_ / 2, -w_ / 2), (-h_ / 2, w_ / 2), (h_ / 2, w_ / 2), (h_ / 2, -w_ / 2))])
for j in range(4):
    f = bm.faces.new((hv[0][j], hv[0][(j + 1) % 4], hv[1][(j + 1) % 4], hv[1][j]))
    f.material_index = 2
for ring_, rev in ((hv[0], True), (hv[1], False)):
    f = bm.faces.new(ring_[::-1] if rev else ring_)
    f.material_index = 2
FRY = obj_of("FryPan", bm, [M["pan"], M["panin"], M["bakelite"]])
FRY.location = P(-BURN_X, REST_Y, BURN_Z)
parts.append(FRY)

# ---- the tamagoyaki pan: square, its walls straight, copper outside, tinned inside; its wooden handle toward the front on a copper
# collar; its origin its bottom's middle, resting on the right burner
bm = bmesh.new()
EW, EL, EH, ET = 0.15, 0.18, 0.03, 0.004
# (the outside: the bottom and the four walls; the inside: one face in from each)
o = box(bm, (-EW / 2, 0, -EL / 2), (EW / 2, EH, EL / 2), mi=0)
# (the open top: the box's top face taken out, and the inside's walls and floor put in, joined to the outside along the rim)
top_face = [f for f in bm.faces if all(abs(v.co.z - EH) < 1e-6 for v in f.verts)]
bmesh.ops.delete(bm, geom=top_face, context='FACES_ONLY')
iv = [bm.verts.new(P(x, y, z)) for x in (-EW / 2 + ET, EW / 2 - ET) for y in (ET, EH) for z in (-EL / 2 + ET, EL / 2 - ET)]
# (iv: index = 4x + 2y + z bits)
for a, b, c, d in ((0, 2, 6, 4), (1, 5, 7, 3), (0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1)):
    f = bm.faces.new((iv[a], iv[b], iv[c], iv[d]))
    f.material_index = 1
# (the rim: the outside's top edge to the inside's)
ov = {(round(v.co.x, 5), round(v.co.y, 5)): v for v in bm.verts if abs(v.co.z - EH) < 1e-6 and v not in iv}
rim_out = [ov[(round(x, 5), round(-z, 5))] for x, z in ((-EW / 2, -EL / 2), (EW / 2, -EL / 2), (EW / 2, EL / 2), (-EW / 2, EL / 2))]
rim_in = [iv[4 * xi + 2 + zi] for xi, zi in ((0, 0), (1, 0), (1, 1), (0, 1))]
for j in range(4):
    f = bm.faces.new((rim_out[j], rim_out[(j + 1) % 4], rim_in[(j + 1) % 4], rim_in[j]))
    f.material_index = 0
# (the collar and the handle: a copper socket off the front wall, the round wooden bar out of it, a little up)
box(bm, (-0.012, 0.008, EL / 2), (0.012, 0.024, EL / 2 + 0.03), mi=0)
n = 8
hr = []
for t_, r_ in ((0.0, 0.011), (0.16, 0.012)):
    z_ = EL / 2 + 0.028 + t_
    y_ = 0.016 + t_ * 0.2
    hr.append([bm.verts.new(P(r_ * math.cos(2 * math.pi * i / n), y_ + r_ * math.sin(2 * math.pi * i / n), z_)) for i in range(n)])
for j in range(n):
    f = bm.faces.new((hr[0][j], hr[0][(j + 1) % n], hr[1][(j + 1) % n], hr[1][j]))
    f.material_index = 2
for f in ladder_fill(bm, hr[0][::-1]) + ladder_fill(bm, hr[1]):
    f.material_index = 2
EGG = obj_of("EggPan", bm, [M["copper"], M["tin"], M["wood"]])
EGG.location = P(-BURN_X + 0.32, REST_Y, BURN_Z)
parts.append(EGG)

# ---- (item 494) the stove's corner's things: where each stands, on the counter round the stove (its frame: the counter's top at y 0), clear
# of the rice cooker's paddle holder behind it on its left, the tamagoyaki pan hung on the shelf's post at its right, the fryer past it, the
# pan's handle and the cook's hands at the front; each measured in the game (tests/e2e/_stovearea494.mjs)
M["crock"] = pbr("StoveCrock", lin("#5b4636"), rough=0.5)
M["crockin"] = pbr("StoveCrockIn", lin("#2a1f18"), rough=0.7)
M["bowl"] = pbr("StoveBowl", lin("#eeeae2"), rough=0.3)
M["indigo"] = pbr("StoveIndigo", lin("#2c4a7a"), rough=0.3)
M["egg"] = pbr("StoveBeatenEgg", lin("#e7b02c"), rough=0.4)
M["bamboo"] = pbr("StoveChopsticks", lin("#d8bd8a"), rough=0.6)
M["alu"] = pbr("StovePotAlu", lin("#c3c6ca"), rough=0.35, metal=0.7)
M["aluin"] = pbr("StovePotInside", lin("#8d9197"), rough=0.4, metal=0.6)


def stick(bm, a, b, w0, w1, mi):
    """a four-sided stick from a to b (the game's frame), w0 across at a, w1 at b, its ends shut"""
    a, b = Vector(a), Vector(b)
    ax = (b - a).normalized()
    t = Vector((0, 1, 0)) if abs(ax.y) < 0.9 else Vector((1, 0, 0))
    e1 = ax.cross(t).normalized()
    e2 = ax.cross(e1).normalized()
    rings = []
    for c, w in ((a, w0), (b, w1)):
        rings.append([bm.verts.new(P(*(c + (e1 * sx + e2 * sy) * (w / 2)))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for j in range(4):
        f = bm.faces.new((rings[0][j], rings[0][(j + 1) % 4], rings[1][(j + 1) % 4], rings[1][j]))
        f.material_index = mi
    for ring_, rev in ((rings[0], True), (rings[1], False)):
        f = bm.faces.new(ring_[::-1] if rev else ring_)
        f.material_index = mi


TOOLS = []
# (the crock, behind the stove: stoneware, its mouth a little narrower than its shoulder, dark within, a floor inside 3 cm up)
CX, CZ = -0.033, -0.279
bm = bmesh.new()
out = lathe(bm, CX, CZ, [(0.04, 0.0), (0.047, 0.045), (0.043, 0.12)], 16, mi=0, shut=(False, False))
inn = lathe(bm, CX, CZ, [(0.037, 0.03), (0.039, 0.12)], 16, mi=1, shut=(True, False))
for k in range(16):
    f = bm.faces.new((out[-1][k], inn[-1][k], inn[-1][(k + 1) % 16], out[-1][(k + 1) % 16]))
    f.material_index = 0
# (in it, heads up and leaning out a little: the ladle, its bowl turned toward the back; the turner; the long chopsticks)
stick(bm, (CX - 0.012, 0.035, CZ + 0.006), (CX - 0.036, 0.25, CZ - 0.004), 0.012, 0.01, 2)
lad = lathe(bm, 0, 0, [(0.012, -0.024), (0.03, -0.016), (0.038, 0.0), (0.034, 0.0), (0.026, -0.013), (0.01, -0.02)], 10, mi=2, shut=(True, True))
# (the ladle's bowl: made round the upright at the origin, turned so its mouth faces the back and set at the handle's top)
from mathutils import Matrix  # noqa: E402
xf = Matrix.Translation(P(CX - 0.04, 0.265, CZ - 0.03)) @ Matrix.Rotation(math.pi / 2, 4, 'X')
for ring_ in lad:
    for v_ in ring_:
        v_.co = xf @ v_.co
stick(bm, (CX + 0.01, 0.035, CZ - 0.004), (CX + 0.026, 0.22, CZ - 0.012), 0.012, 0.01, 3)
# (the turner's blade: a flat steel plate on its handle's top)
box(bm, (CX + 0.0, 0.222, CZ - 0.0155), (CX + 0.062, 0.3, CZ - 0.0125), mi=2)
for dx in (0.0, 0.009):
    stick(bm, (CX + 0.004 + dx, 0.035, CZ + 0.012), (CX - 0.004 + dx * 2, 0.33, CZ + 0.03), 0.006, 0.0035, 4)
TOOLS.append(obj_of("tc", bm, [M["crock"], M["crockin"], M["steel"], M["pan"], M["bamboo"]], smooth=True))
# (the bowl of beaten egg, at the stove's front left: white porcelain, an indigo line round under its rim, the egg in it, its chopsticks
# laid across it)
EX, EZ = -0.286, 0.353
bm = bmesh.new()
out = lathe(bm, EX, EZ, [(0.032, 0.0), (0.056, 0.03), (0.062, 0.044)], 16, mi=0, shut=(True, False))
band = lathe(bm, EX, EZ, [(0.062, 0.044), (0.066, 0.055)], 16, mi=1, shut=(False, False))
inn = lathe(bm, EX, EZ, [(0.054, 0.036), (0.062, 0.055)], 16, mi=0, shut=(False, False))
for k in range(16):
    f = bm.faces.new((band[-1][k], inn[-1][k], inn[-1][(k + 1) % 16], band[-1][(k + 1) % 16]))
    f.material_index = 0
# (the beaten egg: its face across the inside, 3.6 cm up, on the inside's bottom ring)
for f in ladder_fill(bm, inn[0]):
    f.material_index = 2
for dz in (-0.006, 0.006):
    stick(bm, (EX - 0.09, 0.062, EZ + dz - 0.03), (EX + 0.11, 0.058, EZ + dz + 0.03), 0.0055, 0.0035, 3)
TOOLS.append(obj_of("tb", bm, [M["bowl"], M["indigo"], M["egg"], M["bamboo"]], smooth=True))
bpy.ops.object.select_all(action="DESELECT")
for o in TOOLS:
    o.select_set(True)
bpy.context.view_layer.objects.active = TOOLS[0]
bpy.ops.object.join()
tools = bpy.context.view_layer.objects.active
tools.name = "StoveTools"
parts.append(tools)

# ---- (item 494) the yukihira pot: straight walls a little flared, hammered aluminium (its dimples in the light), its wooden handle on a
# socket out to its left, rising a little; its bottom's middle at its origin, where it waits at the stove's front left
bm = bmesh.new()
out = lathe(bm, 0, 0, [(0.072, 0.0), (0.078, 0.062), (0.079, 0.066)], 16, mi=0, shut=(True, False))
inn = lathe(bm, 0, 0, [(0.07, 0.006), (0.076, 0.066)], 16, mi=1, shut=(True, False))
for k in range(16):
    f = bm.faces.new((out[-1][k], inn[-1][k], inn[-1][(k + 1) % 16], out[-1][(k + 1) % 16]))
    f.material_index = 0
box(bm, (-0.098, 0.034, -0.009), (-0.074, 0.052, 0.009), mi=0)
stick(bm, (-0.098, 0.043, 0.0), (-0.235, 0.075, 0.0), 0.02, 0.017, 2)
POT = obj_of("SoupPot", bm, [M["alu"], M["aluin"], M["wood"]], smooth=True)
POT.location = P(-0.307, 0.0, 0.553)
parts.append(POT)

root = bpy.data.objects.new("GasStoveRoot", None)
bpy.context.collection.objects.link(root)
for o_ in parts:
    o_.parent = root
    print(o_.name, sum(len(p_.vertices) - 2 for p_ in o_.data.polygons))

export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "gasstove.glb"), os.path.join(PROJECT, "blender", "gasstove.blend"), PREVIEW)
