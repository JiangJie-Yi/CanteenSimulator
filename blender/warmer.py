"""The kitchen's two working counters, made like the sink's (the owner's, 2026-11-11: the warming counter moved up between the cook table and
the till, its height and look the sink's; the rice tub and the old rice pot on its stove out of use; only the soup kept hot; where the warming
counter stood, a counter for making the rice balls, the electric cooker on it):

- warmer.glb, node "Warmer": the soup counter. A terrazzo top with an upstand along its back, a dark-stained sugi cabinet of panelled doors with
  brass pulls on a black kick; let into its top one round stainless warming well, a faint warm red inside (the miso pot stands in it); under
  the top's front edge, before the well, a black knob, a little round thermometer and an amber pilot lamp.
- prepcounter.glb, node "PrepCounter": the rice-ball counter, the same make without the well; on it a hinoki board with three rice balls
  shaped and their nori, a lacquered bowl of hand water, a box of nori sheets and a little salt pot (the cooker stands at its sink end: Decor).

The game's frame, in the kitchen's own units (Decor's): y up from the floor, x along the counter, its front toward +z; its middle at the
origin; H high (the sink's top), D deep. The warmer's well at WELL_X along it; the board's middle at BOARD_X (the same in Decor.tsx).

Run:
    blender -b --factory-startup --python blender/warmer.py -- <project path> [preview.png]
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

H, D = 1.236, 1.0        # the sink's top (1.236 in the kitchen's units), deep
TT = 0.07                # the terrazzo top's thickness
UP = 0.1                 # the upstand along the back
KICK = 0.1               # the black kick under the cabinet, set back
# (the warmer cut to half its length, its left end kept, the rice-ball counter pushed up against its right end (the owner's, 2026-11-11: 併桌);
# its well in its middle (kept where it stood, it came 2 cm from the counter's end: the owner's, moved off its place)
WARMER_L, PREP_L = 1.4, 3.0
WELL_X, WELL_R = 0.0, 0.4
# (one counter, the two of them joined (the owner's, 2026-11-11: they're one): its body all in warmer.glb, from the warmer's left end to the
# rice-ball counter's right, one top across both; the rice-ball counter's origin PREP_DX along it from the warmer's (Decor's PREP_AT), its
# model only what stands on it)
PREP_DX = WARMER_L / 2 + 0.02 + 0.002 + 0.02 + PREP_L / 2
# (to the right: the cooker stands at its left end now, by the miso pot (the owner's, 2026-11-11))
BOARD_X = 0.35


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------------------------------------------- pictures (the sink's)
N = 512
u, v = grid01(N)
ground = mix((0.8, 0.79, 0.76), (0.72, 0.71, 0.68), fbm(N, 6, 6, 4))
terr = ground.copy()
for cells, thr, col, k in ((90, 0.9, (0.18, 0.18, 0.19), 0.95), (140, 0.88, (0.5, 0.5, 0.5), 0.8), (110, 0.9, (0.96, 0.95, 0.93), 0.9),
                           (60, 0.95, (0.58, 0.38, 0.28), 0.85), (220, 0.86, (0.35, 0.35, 0.36), 0.7)):
    chip = smooth(thr, thr + 0.03, vnoise(N, cells, cells))
    terr = mix(terr, col, chip * k)
terr = terr * (0.96 + 0.06 * fbm(N, 64, 64, 2))[..., None]
grain = np.sin((u * 34 + (fbm(N, 2, 5, 4) - 0.5) * 0.9 + (fbm(N, 6, 2, 3) - 0.5) * 0.25) * 2 * math.pi) * 0.5 + 0.5
# (stained black, its grain just showing through (the owner's, 2026-11-11: the wood's colour black): it was a dark brown)
sugi = mix((0.04, 0.034, 0.03), (0.016, 0.014, 0.013), smooth(0.6, 1.0, grain) * 0.7)
sugi = sugi * (0.94 + 0.08 * fbm(N, 3, 12, 4))[..., None]
hin = mix((0.86, 0.74, 0.55), (0.76, 0.62, 0.42), smooth(0.6, 1.0, np.sin((u * 40 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.6)


def bamboo_slats(n=256, slats=50):
    """the rice-ball tray's bamboo (item 254): slats along u, `slats` of them across v, each its own tone, dark seams between them, a node's
    mark on each somewhere, fibres along them"""
    uu, vv = grid01(n)
    k = vv * slats
    idx = np.floor(k).astype(int)
    f = k - idx
    rr = np.random.default_rng(54)
    tone = 0.86 + 0.16 * rr.random(slats + 1)[idx]
    fib = 0.95 + 0.05 * np.sin((uu * 90 + vnoise(n, 32, 4) * 3) * 2 * math.pi)
    seam = smooth(0.0, 0.14, f) * smooth(0.0, 0.14, 1 - f)
    col = np.array((0.82, 0.66, 0.4), np.float32)[None, None, :] * (tone * fib * (0.5 + 0.5 * seam))[..., None]
    node_u = rr.random(slats + 1)[idx]
    node = np.exp(-((uu - node_u) / 0.008) ** 2) * (seam > 0.3)
    return mix(col, (0.45, 0.33, 0.18), node * 0.7)


def sasa_leaf(n=128):
    """a bamboo leaf's face (item 254): its length along u, across v: deep green darker to its edges, a pale midrib, fine veins along it"""
    uu, vv = grid01(n)
    a = np.abs(vv - 0.5) * 2
    col = mix((0.27, 0.5, 0.2), (0.16, 0.34, 0.12), smooth(0.2, 1.0, a))
    col = mix(col, (0.62, 0.74, 0.42), np.exp(-((vv - 0.5) / 0.018) ** 2) * 0.8)
    veins = (np.sin(vv * 2 * math.pi * 11) * 0.5 + 0.5) ** 6
    col = mix(col, (0.36, 0.6, 0.28), veins * 0.35 * (1 - a))
    return col * (0.92 + 0.12 * fbm(n, 4, 2, 3))[..., None]


def nori_sheet(n=128):
    """dried nori (item 254): a dark green-black, its pressed fibres showing, a few greener flecks"""
    col = np.array((0.1, 0.15, 0.1), np.float32)[None, None, :] * (0.75 + 0.5 * fbm(n, 24, 24, 3))[..., None]
    fleck = smooth(0.82, 0.9, vnoise(n, 60, 60))
    return mix(col, (0.2, 0.3, 0.16), fleck * 0.6)
# (plywood for the cupboards' insides: a paler, plainer grain than the hinoki, a little shade of age)
ply = mix((0.62, 0.5, 0.36), (0.55, 0.43, 0.3), smooth(0.55, 1.0, np.sin((u * 22 + fbm(N, 2, 3, 3) * 1.4) * 2 * math.pi) * 0.5 + 0.5) * 0.7)
ply = ply * (0.9 + 0.12 * fbm(N, 5, 5, 3))[..., None]
# (a thermometer's face: cream, a scale round its top, a red needle at 70 or so)
dn = 128
yy, xx = np.mgrid[0:dn, 0:dn] / (dn - 1) * 2 - 1
r = np.hypot(xx, yy)
ang = np.arctan2(-yy, xx)
dial = np.ones((dn, dn, 3)) * np.array(lin("#f2ead6"))
ticks = (np.abs(r - 0.72) < 0.1) & (ang > 0.25) & (ang < math.pi - 0.25) & (np.mod(ang * 12 / math.pi, 1) < 0.35)
dial[ticks] = lin("#2a2420")
dial[(np.abs(r - 0.6) < 0.05) & (ang > 0.25) & (ang < 1.1)] = lin("#c0392b")
na = 1.05
along_n = xx * math.cos(na) + (-yy) * math.sin(na)
across_n = -xx * math.sin(na) + (-yy) * math.cos(na)
dial[(along_n > -0.05) & (along_n < 0.68) & (np.abs(across_n) < 0.04)] = lin("#b3241c")
dial[r < 0.1] = lin("#2a2420")
dial[r > 0.93] = lin("#7a6a58")


def mats(pre):
    return {
        "terrazzo": pbr(f"{pre}Terrazzo", (1, 1, 1), tex=image(f"{pre.lower()}_terrazzo", np.clip(terr, 0, 1).astype(np.float32)), rough=0.35),
        "sugi": pbr(f"{pre}Sugi", (1, 1, 1), tex=image(f"{pre.lower()}_sugi", np.clip(sugi, 0, 1).astype(np.float32)), rough=0.5),
        "kick": pbr(f"{pre}Kick", lin("#1a120c"), rough=0.6),
        # (the cupboards' insides, behind their doors (item 130)): plain plywood, as a kitchen's cupboards are inside (item 197: a dark sheet
        # a hair in front of the cabinet's face, the cupboard flat as a wall behind its open door)
        "inside": pbr(f"{pre}Inside", (1, 1, 1), tex=image(f"{pre.lower()}_inside", np.clip(ply[::2, ::2], 0, 1).astype(np.float32)), rough=0.8),
        "brass": pbr(f"{pre}Brass", lin("#b98a3a"), rough=0.3, metal=0.8),
    }


M = {}
M.update(mats("Warmer"))
M.update({f"p_{k}": m for k, m in mats("Prep").items()})
M.update({
    "well": pbr("WarmerWell", lin("#5a5f66"), rough=0.35, metal=0.6),
    "glow": pbr("WarmerGlow", lin("#7a2a18"), emit=lin("#ff5a2a"), emit_strength=0.6),
    "knob": pbr("WarmerKnob", lin("#2a2420"), rough=0.4),
    "dial": pbr("WarmerDial", (1, 1, 1), tex=image("warmer_dial", dial.astype(np.float32)), rough=0.4),
    "lamp": pbr("WarmerLamp", lin("#ff6a2a"), emit=lin("#ff6a2a"), emit_strength=2.0),
    "hinoki": pbr("PrepHinoki", (1, 1, 1), tex=image("prep_hinoki", np.clip(hin, 0, 1).astype(np.float32)), rough=0.55),
    "rice": pbr("PrepRice", lin("#f6f3ea"), rough=0.8),
    "nori": pbr("PrepNori", (1, 1, 1), tex=image("prep_nori", np.clip(nori_sheet(), 0, 1).astype(np.float32)), rough=0.6),
    "lacquer": pbr("PrepLacquer", lin("#7a1a14"), rough=0.25),
    "lacquerin": pbr("PrepLacquerIn", lin("#1a1210"), rough=0.2),
    "water": pbr("PrepWater", lin("#8fb2b8"), rough=0.1),
    "salt": pbr("PrepSalt", lin("#e9e4d6"), rough=0.5),
})
M.update({
    # (what's kept in the cupboards (item 197), each its plain colour: drawn as one by the game (plainColours))
    "s_cream": pbr("StoreCream", lin("#eee4cf"), rough=0.5),
    "s_orange": pbr("StoreOrange", lin("#d4742c"), rough=0.45),
    "s_lacq": pbr("StoreLacquer", lin("#8a1f17"), rough=0.3),
    "s_black": pbr("StoreBlack", lin("#1f1b19"), rough=0.35),
    "s_kraft": pbr("StoreKraft", lin("#b48d5a"), rough=0.85),
    "s_red": pbr("StoreRed", lin("#b3362b"), rough=0.6),
    "s_nori": pbr("StoreNori", lin("#22301f"), rough=0.6),
    "s_white": pbr("StoreWhite", lin("#f1efe9"), rough=0.5),
    "s_blue": pbr("StoreBlue", lin("#6f97bb"), rough=0.45),
    "s_indigo": pbr("StoreIndigo", lin("#2c466d"), rough=0.8),
    "s_bamboo": pbr("StoreBamboo", lin("#c7a765"), rough=0.7),
})
parts = []


def lathe(name, x, y0, z, prof, mat, segs=16, top=True):
    """a round thing turned about its upright axis, its foot at (x, y0, z): `prof` (radius, height) from its foot up; its foot left open (it
    stands on something), its top closed with a ladder of quads if `top` (never a fan into one point)"""
    bm = bmesh.new()
    rings = []
    for r_, h_ in prof:
        rings.append([bm.verts.new(P(x + r_ * math.cos(2 * math.pi * i / segs), y0 + h_, z + r_ * math.sin(2 * math.pi * i / segs))) for i in range(segs)])
    for a_, b_ in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((a_[i], a_[(i + 1) % segs], b_[(i + 1) % segs], b_[i]))
    if top:
        ladder_fill(bm, rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    cyl_uv(o)
    finish(o, name, M[mat])
    parts.append(o)
    return o


def box_uv(o, tile=0.5):
    """every face's picture laid flat on it at its true size, from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, tile=0.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 1)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    box_uv(o, tile)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def disc(name, x, y, z, radius, depth, mat, segs=20, facing="up", r1=None):
    """a short cylinder (or a cone's slice, r1 its top): lying flat, its face up, or stood on its edge facing the front (+z)"""
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=radius, radius2=radius if r1 is None else r1, depth=depth, location=P(x, y, z))
    o = active()
    if facing == "front":
        o.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cyl_uv(o)
    finish(o, name, M[mat])
    for p in o.data.polygons:
        p.use_smooth = abs(p.normal.z) < 0.9
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    for o_ in objs[1:]:
        if o_ in parts:
            parts.remove(o_)
    return o


def counter(L, pre, doors, cx=0.0):
    """the counter's body: the black kick set back, the sugi cabinet with its doors' panels proud of it and a brass pull on each, the
    terrazzo top a little proud all round (no upstand along its back: the owner's, 2026-11-11, taken away)"""
    k = "" if pre == "Warmer" else "p_"
    x0, x1, z0, z1 = cx - L / 2, cx + L / 2, -D / 2, D / 2
    front = z1 - 0.04
    o = [
        box("kick", x0 + 0.04, x1 - 0.04, 0, KICK, z0 + 0.02, front - 0.06, k + "kick"),
        box("top", x0 - 0.02, x1 + 0.02, H - TT, H, z0, z1, k + "terrazzo", bev=0.008),
    ]
    dw = (L - 0.08) / doors
    leaves = []
    if pre == "Warmer":
        o += cupboards(x0, x1, z0, front, dw, doors, k)
    else:
        o.append(box("cabinet", x0, x1, KICK, H - TT, z0, front, k + "sugi"))
    for i in range(doors):
        a = x0 + 0.04 + i * dw
        if pre != "Warmer":
            o.append(box(f"door{i}", a + 0.02, a + dw - 0.02, KICK + 0.05, H - TT - 0.16, front, front + 0.018, k + "sugi", bev=0.006))
            px = a + (dw - 0.1 if i % 2 == 0 else 0.1)
            o.append(box(f"pull{i}", px - 0.012, px + 0.012, H - TT - 0.42, H - TT - 0.26, front + 0.018, front + 0.032, k + "brass"))
            continue
        # (each door and its pull its own node, its origin on its hinge: the edge away from its pull, at the door's back face; each pair's
        # free edges meeting in the middle, a hair apart (item 277: no mullion between them now, and through the gap left for it the lit
        # inside showed))
        dx0 = 0.0015 if i % 2 == 1 else 0.02
        dx1 = 0.0015 if i % 2 == 0 else 0.02
        door = box(f"door{i}", a + dx0, a + dw - dx1, KICK + 0.05, H - TT - 0.16, front + 0.0035, front + 0.0215, k + "sugi", bev=0.006)
        px = a + (dw - 0.1 if i % 2 == 0 else 0.1)
        pull = box(f"pull{i}", px - 0.012, px + 0.012, H - TT - 0.42, H - TT - 0.26, front + 0.0215, front + 0.0355, k + "brass")
        hx = a + 0.02 if i % 2 == 0 else a + dw - 0.02
        leaf = join([door, pull], f"{pre}Door{i}")
        bpy.context.scene.cursor.location = P(hx, (KICK + H - TT) / 2, front + 0.0035)
        bpy.ops.object.select_all(action="DESELECT"); leaf.select_set(True); bpy.context.view_layer.objects.active = leaf
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        leaves.append(leaf)
    # (a rail along the cabinet's top, under the counter's edge)
    o.append(box("rail", x0 + 0.02, x1 - 0.02, H - TT - 0.13, H - TT - 0.02, front, front + 0.012, k + "sugi"))
    body_ = join(o, f"{pre}Body")
    return (body_, leaves) if pre == "Warmer" else body_


T_ = 0.025       # the cupboards' boards
STORES = []      # what's kept in them: joined into one node of its own (WarmerStores), ink round it as round the rest


def cupboards(x0, x1, z0, front, dw, doors, k):
    """the counter's cupboards (item 197, the owner's, 2026-11-16: 「酒台與料理台的內裝完全不行」: behind each door was a dark sheet a hair in
    front of a solid block, a strip of a shelf on it, nothing in it): a carcass of boards, the back, the ends, the floor and the ceiling,
    a face frame round the doors' openings, a partition between each pair of doors (three cupboards), plywood inside, a shelf across each,
    and in them what a soup and rice-ball counter keeps: the stock pot and the miso tub, the soup bowls; the rice, the trays, the nori and
    the salt; the food boxes, the cloths, the bamboo trays and the takeaway boxes. Each board a little short of the next one's face, no two
    faces in one plane."""
    T = T_
    y_lo, y_hi, mid = KICK + T, H - TT - T, (KICK + H - TT) / 2
    zi = z0 + T + 0.004       # the inside of the back's lining
    zf = front - 0.02         # the back of the face frame
    o = [
        box("back", x0, x1, KICK, H - TT, z0, z0 + T, k + "sugi"),
        box("endl", x0, x0 + T, KICK, H - TT, z0 + T, zf, k + "sugi"),
        box("endr", x1 - T, x1, KICK, H - TT, z0 + T, zf, k + "sugi"),
        box("floor", x0 + T, x1 - T, KICK, y_lo, z0 + T, zf, k + "inside"),
        box("ceil", x0 + T, x1 - T, y_hi, H - TT, z0 + T, zf, k + "inside"),
        box("backin", x0 + T, x1 - T, y_lo, y_hi, z0 + T, zi, k + "inside"),
        box("endlin", x0 + T, x0 + T + 0.004, y_lo, y_hi, zi, zf, k + "inside"),
        box("endrin", x1 - T - 0.004, x1 - T, y_lo, y_hi, zi, zf, k + "inside"),
        box("facebot", x0, x1, KICK, KICK + 0.05, zf, front, k + "sugi"),
        box("facetop", x0, x1, H - TT - 0.16, H - TT, zf, front, k + "sugi"),
        box("facel", x0, x0 + 0.06, KICK + 0.05, H - TT - 0.16, zf, front, k + "sugi"),
        box("facer", x1 - 0.06, x1, KICK + 0.05, H - TT - 0.16, zf, front, k + "sugi"),
    ]
    bays = doors // 2
    xs = [x0 + 0.04 + j * 2 * dw for j in range(bays + 1)]
    for j in range(1, bays):
        o.append(box(f"part{j}", xs[j] - T / 2, xs[j] + T / 2, y_lo, y_hi, zi, zf, k + "inside"))
        o.append(box(f"stile{j}", xs[j] - 0.02, xs[j] + 0.02, KICK + 0.05, H - TT - 0.16, zf, front, k + "sugi"))
    # (no mullion where each pair of doors meet (item 277, the owner's, 2026-11-17: 「櫃門內裝不行，這一條也要拿掉」: it stood in the middle of
    # each opened cupboard, a dark strip down it): the two doors close on each other; the gap between them dark, the cupboard's inside unlit
    # while they're shut (Decor's Warmer: its lamp on as they open))
    # (each cupboard's inside, wall to wall, and its shelf across it, set back from the face; the shelf's top, the floor's top)
    inn = [((x0 + T + 0.004) if j == 0 else (xs[j] + T / 2), (x1 - T - 0.004) if j == bays - 1 else (xs[j + 1] - T / 2)) for j in range(bays)]
    ys = mid + 0.011
    for j, (l, r) in enumerate(inn):
        o.append(box(f"shelf{j}", l + 0.002, r - 0.002, mid - 0.011, ys, zi + 0.002, front - 0.09, k + "inside"))
    stores(inn, y_lo, ys, zi, front - 0.09)
    return o


def stores(inn, yf, ys, zb, zs):
    """what's kept in the cupboards, set in each from its walls, the back and the front with room round it: `inn` each cupboard's walls,
    `yf` its floor's top, `ys` its shelf's top, `zb` its back, `zs` the shelf's front"""
    def put(o):
        STORES.append(o)
        return o
    zc = (zb + zs) / 2
    # (the soup's cupboard, under the warming well)
    l, r = inn[0]
    # (a stock pot (寸胴鍋): its body, its lid and the lid's knob, its two handles)
    px, pz, pr, ph = l + 0.27, zc - 0.07, 0.2, 0.36
    put(lathe("pot", px, yf, pz, [(pr, 0.0), (pr, ph)], "well", segs=16, top=False))
    put(lathe("potlid", px, yf + ph, pz, [(pr + 0.012, 0.0), (pr + 0.012, 0.012), (pr * 0.55, 0.035), (0.03, 0.04)], "well", segs=16))
    put(lathe("potknob", px, yf + ph + 0.04, pz, [(0.022, 0.0), (0.026, 0.022)], "s_black", segs=8))
    for sd in (-1, 1):
        put(box(f"pothandle{sd}", px + sd * (pr + 0.004), px + sd * (pr + 0.05), yf + ph - 0.09, yf + ph - 0.06, pz - 0.035, pz + 0.035, "well"))
    # (the two tubs of miso that stood by it are gone (item 275: miso's kept cold, in the cook's table's fridge, as many as its stock); the
    # peanut powder's pouches stand there now, as many as its stock (blender/pantry.py))
    # (on its shelf, the soup bowls in stacks (汁椀, red lacquer), and their lids in one)
    for n_, bx in enumerate((l + 0.14, l + 0.36, l + 0.58)):
        # (the stack's outline, a rim's step halfway up: 12 round, 70 faces)
        prof = [(0.05, 0.0), (0.056, 0.012), (0.084, 0.03), (0.086, 0.09), (0.083, 0.095), (0.086, 0.19)]
        put(lathe(f"bowls{n_}", bx, ys, zc + 0.02, prof, "s_lacq", segs=12))
    put(lathe("bowllids", l + 0.82, ys, zc + 0.02, [(0.08, 0.0), (0.082, 0.015), (0.082, 0.1), (0.07, 0.11)], "s_black", segs=16))
    # (and the small dishes, a stack of white)
    put(lathe("dishes", l + 1.08, ys, zc - 0.02, [(0.07, 0.0), (0.1, 0.012), (0.1, 0.09), (0.095, 0.095)], "s_white", segs=16))

    # (the middle cupboard: on its shelf the trays; the rice, the salt, the shichimi and the nori that were here in plain colours, no stock
    # behind them, are blender/pantry.py's now, each as many as its stock (items 274, 275))
    l, r = inn[1]
    put(box("trays", l + 0.04, l + 0.56, ys, ys + 0.16, zc - 0.2, zc + 0.17, "s_black", bev=0.008))

    # (the rice-ball side's cupboard: food boxes in two stacks and the cloths on its floor; the bamboo trays and the takeaway boxes above)
    l, r = inn[2]
    for n_, bx in enumerate((l + 0.06, l + 0.42)):
        for q in range(3):
            y_ = yf + q * 0.12
            put(box(f"food{n_}{q}", bx, bx + 0.3, y_, y_ + 0.1, zc - 0.13, zc + 0.11, "s_white", bev=0.01))
            put(box(f"foodlid{n_}{q}", bx - 0.005, bx + 0.305, y_ + 0.1, y_ + 0.118, zc - 0.135, zc + 0.115, "s_blue", bev=0.004))
    for q, m_ in enumerate(("s_white", "s_indigo", "s_white", "s_indigo")):
        put(box(f"cloth{q}", l + 0.84 + 0.006 * q, l + 1.12 + 0.006 * q, yf + q * 0.04, yf + q * 0.04 + 0.038, zc - 0.1, zc + 0.12, m_, bev=0.01))
    for n_, bx in enumerate((l + 0.2, l + 0.56)):
        put(lathe(f"zaru{n_}", bx, ys, zc, [(0.13, 0.0), (0.17, 0.035), (0.172, 0.045), (0.17, 0.09)], "s_bamboo", segs=16))
    put(box("takeaway", l + 0.82, l + 1.14, ys, ys + 0.18, zc - 0.13, zc + 0.11, "s_black", bev=0.006))
    put(box("takeawayband", l + 0.82 - 0.002, l + 1.14 + 0.002, ys + 0.05, ys + 0.08, zc - 0.132, zc + 0.112, "s_red"))


def root_of(name, objs):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root
    print(f"{name.upper()}_TRIS", sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons))
    return root


def preview_cam():
    target = P(0, 1.0, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.8, 2.6, 3.2)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------------------------------------------- the soup counter
JOINED_L = PREP_DX + PREP_L / 2 + WARMER_L / 2
body, warmer_doors = counter(JOINED_L, "Warmer", 6, cx=-WARMER_L / 2 + JOINED_L / 2)
wells = [disc("well", WELL_X, H + 0.002, 0.02, WELL_R, 0.006, "well", segs=24),
         disc("glow", WELL_X, H + 0.005, 0.02, WELL_R * 0.8, 0.002, "glow", segs=24)]
warmer_wells = join(wells, "WarmerWells")
cy, cz = H - TT - 0.075, D / 2 - 0.04 + 0.012
ctrl = [disc("knob", WELL_X - 0.14, cy, cz + 0.014, 0.028, 0.026, "knob", segs=12, facing="front"),
        box("knobmark", WELL_X - 0.143, WELL_X - 0.137, cy, cy + 0.024, cz + 0.027, cz + 0.029, "brass"),
        disc("dialrim", WELL_X, cy, cz + 0.006, 0.034, 0.01, "brass", segs=16, facing="front"),
        disc("dial", WELL_X, cy, cz + 0.0115, 0.028, 0.001, "dial", segs=16, facing="front"),
        disc("lamp", WELL_X + 0.12, cy, cz + 0.008, 0.013, 0.014, "lamp", segs=10, facing="front")]
for o in ctrl:
    if o.name.startswith("dial") and not o.name.startswith("dialrim"):
        me = o.data
        uvl = me.uv_layers.active or me.uv_layers.new()
        for poly in me.polygons:
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((co.x - o.location.x) / 0.056 + 0.5, (co.z - o.location.z) / 0.056 + 0.5)
warmer_ctrl = join(ctrl, "WarmerControls")
warmer_stores = join(STORES, "WarmerStores")
root = root_of("Warmer", [body, warmer_wells, warmer_ctrl, warmer_stores] + warmer_doors)
if PREVIEW:
    preview_cam()
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "warmer.glb"), os.path.join(PROJECT, "blender", "warmer.blend"),
            PREVIEW.replace(".png", "-warmer.png") if PREVIEW else None)

# ---------------------------------------------------------------------------------------------------- the rice-ball counter
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
parts = []
set_ = []
def rice_ball(name, x, y0, z, r, t):
    """a rice ball as it's shaped by hand (item 129, the owner's, 2026-11-15: the counter too plain; they were three-sided cylinders with
    their edges rounded): a rounded triangle, a corner up, 4 points round each corner, its faces puffed out (four rings front to back, the
    outer two drawn in), its flat foot at y0; and its band of nori wrapped up from under its foot onto its front and back faces. Returns
    (rice, nori)."""
    bm = bmesh.new()
    rc = r * 0.42
    sec = []
    for i, a0 in enumerate((math.pi / 2, math.pi / 2 + 2 * math.pi / 3, math.pi / 2 + 4 * math.pi / 3)):
        cx, cy = (r - rc) * math.cos(a0), (r - rc) * math.sin(a0)
        for k in range(4):
            a = a0 - math.pi / 3 + (2 * math.pi / 3) * k / 3
            sec.append((cx + rc * math.cos(a), cy + rc * math.sin(a)))
    ybot = min(p[1] for p in sec)
    rings = [(-t / 2, 0.8), (-t * 0.3, 0.97), (t * 0.3, 0.97), (t / 2, 0.8)]
    g = 0.0015
    # (its middle rings' foot a nori's thickness and a hair over y0, the nori under it; the outer rings drawn in, their foot a little up)
    lift = y0 + g + 0.0005 - ybot * 0.97
    vs = [[bm.verts.new(P(x + px * s, lift + py * s, z + dz)) for px, py in sec] for dz, s in rings]
    n = len(sec)
    for k in range(len(rings) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((vs[k][j], vs[k][j2], vs[k + 1][j2], vs[k + 1][j]))
    bm.faces.new(vs[0][::-1])
    bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    finish(o, name, M["rice"])
    parts.append(o)
    # (the nori: up the back face, under the foot along the puffed rings, up the front face; a hair off the rice all the way)
    w, hb = r * 0.62, r * 0.75
    yo = lift + ybot * 0.8 - y0              # (the outer rings' foot, over y0)
    path = [(-t / 2 - g, yo + hb), (-t / 2 - g, yo), (-t * 0.3, 0.0005), (t * 0.3, 0.0005), (t / 2 + g, yo), (t / 2 + g, yo + hb)]
    bm = bmesh.new()
    row = [[bm.verts.new(P(x + sx * w / 2, y0 + yy, z + zz)) for sx in (-1, 1)] for zz, yy in path]
    for k in range(len(row) - 1):
        bm.faces.new((row[k][0], row[k][1], row[k + 1][1], row[k + 1][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "nori")
    bm.to_mesh(me)
    bm.free()
    nori = bpy.data.objects.new(name + "nori", me)
    bpy.context.collection.objects.link(nori)
    finish(nori, name + "nori", M["nori"], smooth_shade=False)
    parts.append(nori)
    return o, nori

# (the hinoki board, its rice balls on it: rounded triangles stood up, a band of nori round each one's foot)
set_.append(box("board", BOARD_X - 0.36, BOARD_X + 0.36, H, H + 0.035, -0.2, 0.22, "hinoki", bev=0.008))
# (two on it now, shaped, and the third cook's one in the making between them is the game's (item 129))
for i, dx in enumerate((-0.2, 0.2)):
    set_.extend(rice_ball(f"onigiri{i}", BOARD_X + dx, H + 0.035, 0.04, 0.072, 0.056))
# (the bowl of hand water: lacquered red without, black within, the water in it)
set_.append(disc("bowl", BOARD_X - 0.62, H + 0.045, 0.02, 0.1, 0.09, "lacquer", segs=16, r1=0.13))
set_.append(disc("bowlin", BOARD_X - 0.62, H + 0.088, 0.02, 0.115, 0.004, "lacquerin", segs=16))
set_.append(disc("water", BOARD_X - 0.62, H + 0.07, 0.02, 0.1, 0.004, "water", segs=16))
# (the box of nori sheets, its lid off beside it, and the little salt pot)
set_.append(box("noribox", BOARD_X + 0.5, BOARD_X + 0.78, H, H + 0.06, -0.22, 0.0, "lacquerin", bev=0.006))
set_.append(box("norisheets", BOARD_X + 0.52, BOARD_X + 0.76, H + 0.06, H + 0.066, -0.2, -0.02, "nori"))
set_.append(disc("salt", BOARD_X + 0.62, H + 0.04, 0.12, 0.045, 0.08, "salt", segs=12, r1=0.038))
# (the owner's, 2026-11-12: the counter's top was bare, a board, three rice balls, a bowl, a box and a pot: the fillings in their dishes before the
# board, the rice paddle and the pickles and the sesame behind it, a folded towel, the box of wrap, and a bamboo tray of the finished ones at the
# right end, each wrapped with its band of nori)
M.update({
    "dish": pbr("PrepDish", lin("#f1eee4"), rough=0.3),
    "ume": pbr("PrepUme", lin("#b3262a"), rough=0.45),
    "salmon": pbr("PrepSalmon", lin("#ee8a66"), rough=0.6),
    "kombu": pbr("PrepKombu", lin("#2c261e"), rough=0.5),
    "takuan": pbr("PrepTakuan", lin("#e8c23a"), rough=0.5),
    "sesame": pbr("PrepSesame", lin("#3a3128"), rough=0.5),
    "towel": pbr("PrepTowel", lin("#eef0ea"), rough=0.9),
    "towelband": pbr("PrepTowelBand", lin("#3a5f8f"), rough=0.9),
    # (the bamboo: slats a centimetre wide side by side, each its own tone, dark seams, a node's mark here and there, its fibres along it
    # (item 254, the owner's, 2026-11-17: 「這風格明顯不符」: the rice-ball set was plain colour, no picture, no line))
    "bamboo": pbr("PrepBamboo", (1, 1, 1), tex=image("prep_bamboo", np.clip(bamboo_slats(), 0, 1).astype(np.float32)), rough=0.55),
    "card": pbr("PrepCard", lin("#c9a26c"), rough=0.8),
    "label": pbr("PrepLabel", lin("#f4f0e4"), rough=0.7),
})


done_ = []


def onigiri_at(name, x, y0, z):
    """a finished rice ball on the tray: its own node (the game shows as many as the tray holds, game/rice's TRAY_MAX: item 129), its rice
    and its nori one mesh"""
    o, nori = rice_ball(name, x, y0, z, 0.06, 0.046)
    done_.append(join([o, nori], name))


# (the fillings, each in a small white dish before the board: a pickled plum, flaked salmon, kombu)
for i, (fill, dx) in enumerate((("ume", -0.2), ("salmon", 0.0), ("kombu", 0.2))):
    x = BOARD_X + dx
    set_.append(disc(f"dish{i}", x, H + 0.015, 0.345, 0.034, 0.03, "dish", segs=14, r1=0.055))
    set_.append(disc(f"fill{i}", x, H + 0.034, 0.345, 0.042, 0.016, fill, segs=12, r1=0.026))
# (behind the board: the paddle on its rest, a dish of pickled radish, the pot of sesame)
set_.append(box("paddle", BOARD_X - 0.32, BOARD_X + 0.02, H + 0.012, H + 0.02, -0.33, -0.29, "bamboo", bev=0.003))
set_.append(box("paddlehead", BOARD_X + 0.02, BOARD_X + 0.14, H + 0.012, H + 0.02, -0.36, -0.26, "bamboo", bev=0.004))
set_.append(box("paddlerest", BOARD_X - 0.2, BOARD_X - 0.17, H, H + 0.012, -0.34, -0.28, "bamboo"))
set_.append(disc("pickledish", BOARD_X + 0.3, H + 0.015, -0.32, 0.034, 0.03, "dish", segs=14, r1=0.06))
for k in range(3):
    set_.append(disc(f"takuan{k}", BOARD_X + 0.3 + (k - 1) * 0.022, H + 0.034 + k * 0.004, -0.32 + (k % 2) * 0.01, 0.026, 0.008, "takuan", segs=10))
set_.append(disc("sesamepot", BOARD_X + 0.46, H + 0.04, -0.32, 0.034, 0.08, "sesame", segs=12, r1=0.03))
set_.append(disc("sesamelid", BOARD_X + 0.46, H + 0.088, -0.32, 0.034, 0.012, "bamboo", segs=12))
# (a folded towel with a blue stripe, between the water bowl and the board's front corner)
set_.append(box("towel", BOARD_X - 0.5, BOARD_X - 0.34, H, H + 0.04, 0.28, 0.4, "towel", bev=0.008))
set_.append(box("towelband", BOARD_X - 0.4, BOARD_X - 0.38, H + 0.0005, H + 0.0405, 0.2795, 0.4005, "towelband"))
# (the box of wrap behind the nori box, its label on its front)
set_.append(box("wrapbox", BOARD_X + 0.52, BOARD_X + 0.78, H, H + 0.06, -0.4, -0.3, "card", bev=0.004))
set_.append(box("wraplabel", BOARD_X + 0.58, BOARD_X + 0.72, H + 0.012, H + 0.048, -0.3, -0.2985, "label"))
# (the bamboo tray of finished rice balls at the right end: a floor, four low walls, three of them stood in it)
TX0, TX1, TZ0, TZ1 = BOARD_X + 0.62, BOARD_X + 1.05, 0.04, 0.36
set_.append(box("trayfloor", TX0, TX1, H, H + 0.008, TZ0, TZ1, "bamboo"))
set_.append(box("traywallb", TX0, TX1, H, H + 0.05, TZ0, TZ0 + 0.012, "bamboo"))
set_.append(box("traywallf", TX0, TX1, H, H + 0.05, TZ1 - 0.012, TZ1, "bamboo"))
set_.append(box("traywalll", TX0, TX0 + 0.012, H, H + 0.05, TZ0, TZ1, "bamboo"))
set_.append(box("traywallr", TX1 - 0.012, TX1, H, H + 0.05, TZ0, TZ1, "bamboo"))
# (bamboo leaves laid under them, as rice balls are set out (item 129): long pointed blades, a little apart, a hair over the tray's floor)
M["sasa"] = pbr("PrepSasa", (1, 1, 1), tex=image("prep_sasa", np.clip(sasa_leaf(), 0, 1).astype(np.float32)), rough=0.5)
for k in range(3):
    bm_ = bmesh.new()
    lx, lz, L_, W_ = TX0 + 0.075 + k * 0.14, (TZ0 + TZ1) / 2 - 0.02, 0.24, 0.07
    pts = [(-L_ / 2, 0), (-L_ / 4, -W_ / 2), (L_ / 4, -W_ / 2 * 0.9), (L_ / 2, 0), (L_ / 4, W_ / 2 * 0.9), (-L_ / 4, W_ / 2)]
    ang = math.pi / 2 + (k - 1) * 0.18
    vs_ = [bm_.verts.new(P(lx + px * math.cos(ang) - pz * math.sin(ang), H + 0.0095 + 0.0004 * k, lz + px * math.sin(ang) + pz * math.cos(ang))) for px, pz in pts]
    fs_ = [bm_.faces.new((vs_[0], vs_[1], vs_[5])), bm_.faces.new((vs_[1], vs_[2], vs_[4], vs_[5])), bm_.faces.new((vs_[2], vs_[3], vs_[4]))]
    # (its picture laid along it: its length u, across it v (item 254))
    uv_ = bm_.loops.layers.uv.new("UVMap")
    for f_ in fs_:
        for lp in f_.loops:
            px, pz = pts[vs_.index(lp.vert)]
            lp[uv_].uv = (px / L_ + 0.5, pz / W_ + 0.5)
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me_ = bpy.data.meshes.new(f"sasa{k}")
    bm_.to_mesh(me_)
    bm_.free()
    lf = bpy.data.objects.new(f"sasa{k}", me_)
    bpy.context.collection.objects.link(lf)
    finish(lf, f"sasa{k}", M["sasa"], smooth_shade=False)
    parts.append(lf)
    set_.append(lf)
for k in range(3):
    onigiri_at(f"PrepDone{k}", TX0 + 0.075 + k * 0.14, H + 0.0105, (TZ0 + TZ1) / 2 - 0.02)
prep_set = join(set_, "PrepSet")
root = root_of("PrepCounter", [prep_set] + done_)
if PREVIEW:
    preview_cam()
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "prepcounter.glb"), os.path.join(PROJECT, "blender", "prepcounter.blend"),
            PREVIEW.replace(".png", "-prep.png") if PREVIEW else None)
print("WARMER_DONE")
