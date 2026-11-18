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
from atlas_kit import (Atlas, _obj, boxed, ladder, p_bento, p_band, p_black, p_cloth, p_dish, p_hinoki, p_kombu,  # noqa: E402
                       p_lacquer, p_lacquer_black, p_lid, p_nori, p_plastic, p_porcelain, p_rice, p_salmon, p_sasa, p_stoneware,
                       p_takuan, p_tape, p_tenugui, p_fukin, p_ume, p_water, p_weave, p_wood, p_wrap, slab, turned)

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


# (what's kept in the rice-ball side's cupboard, painted (item 353, the owner's 「品質不OK」 with its doors open: plain white boxes with blue
# slabs on, a stack of flat colours): one picture for them, one material)
SA = Atlas("StoreAtlas", size=(1024, 512))
for _k, _w, _h, _p in (("plastic", 2, 2, p_plastic), ("lid", 2, 2, p_lid), ("clothw", 2, 2, p_cloth),
                       ("clothi", 2, 2, lambda w, h: p_cloth(w, h, base=(0.17, 0.25, 0.42), line=(0.9, 0.9, 0.86))),
                       ("weave", 2, 2, p_weave), ("bento", 2, 2, p_bento), ("band", 2, 1, p_band), ("tape", 2, 1, p_tape)):
    SA.put(_k, _w, _h, _p)
SAM = SA.material(rough=0.6)


def _facing(o, outward=True):
    me = o.data
    cx = sum(v.co.x for v in me.vertices) / len(me.vertices)
    cy = sum(v.co.y for v in me.vertices) / len(me.vertices)
    s_ = sum(p.normal.x * (p.center.x - cx) + p.normal.y * (p.center.y - cy) for p in me.polygons)
    if (s_ > 0) != outward:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
    return o


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

    # (the rice-ball side's cupboard (item 353, the owner's 「品質不OK」 with its doors open): food tubs of milky plastic with blue lids, three
    # to a stack, a strip of masking tape written on across each one's front; folded cloths, white with a blue stripe and indigo with a white
    # one; on the shelf two zaru of woven bamboo, and the takeaway boxes, black with a red rim, a paper band round them. Each stacked right on
    # the one under it (a hair apart), no two faces in one plane)
    l, r = inn[2]
    for n_, bx in enumerate((l + 0.06, l + 0.42)):
        for q in range(3):
            y_ = yf + q * 0.1145
            put(SA.uv_to(boxed(f"food{n_}{q}", bx, bx + 0.3, y_ + 0.0005, y_ + 0.098, zc - 0.13, zc + 0.11, parts, SAM, bev=0.012, segs=2), "plastic"))
            put(SA.uv_to(boxed(f"foodlid{n_}{q}", bx - 0.004, bx + 0.304, y_ + 0.098, y_ + 0.114, zc - 0.134, zc + 0.114, parts, SAM, bev=0.005, segs=2), "lid"))
            put(SA.uv_to(boxed(f"foodtape{n_}{q}", bx + 0.09, bx + 0.21, y_ + 0.045, y_ + 0.075, zc + 0.1105, zc + 0.1125, parts, SAM), "tape"))
    for q, key in enumerate(("clothw", "clothi", "clothw", "clothi")):
        y_ = yf + q * 0.0385
        put(SA.uv_to(boxed(f"cloth{q}", l + 0.84 + 0.006 * q, l + 1.12 + 0.006 * q, y_ + 0.0005, y_ + 0.038, zc - 0.1, zc + 0.12, parts, SAM, bev=0.012, segs=2), key))
    for n_, bx in enumerate((l + 0.2, l + 0.56)):
        put(SA.uv_to(_facing(turned(f"zaru{n_}", bx, ys + 0.0005, zc, [(0.11, 0.0), (0.15, 0.02), (0.17, 0.045), (0.175, 0.052), (0.168, 0.05),
                                                                       (0.145, 0.028), (0.105, 0.008)], parts, SAM, segs=20, cap=True), True), "weave"))
    for q in range(3):
        put(SA.uv_to(boxed(f"takeaway{q}", l + 0.82, l + 1.14, ys + 0.0005 + q * 0.052, ys + 0.0505 + q * 0.052, zc - 0.13, zc + 0.11, parts, SAM,
                           bev=0.006, segs=2), "bento"))
    put(SA.uv_to(boxed("takeawayband", l + 0.875, l + 0.955, ys + 0.002, ys + 0.158, zc - 0.133, zc + 0.113, parts, SAM), "band"))


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
# (each one's UVs under one name before they're joined (item 353): the join keeps the first one's map and drops a differently named one's,
# and the painted ones came out all one corner of their picture, grey)
for _o in STORES:
    if _o.data.uv_layers:
        _o.data.uv_layers[0].name = "UVMap"
        _o.data.uv_layers.active_index = 0
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
# (item 353, the owner's, 2026-11-19: 「品質不OK」 (a second time: item 254 gave them a line and a few pictures): its things were boxes and
# discs in flat colours, the rice balls paper-white, the dishes stickers, the leaves cucumbers. Each made over as the thing it is, and all of
# them painted into one picture (atlas_kit): one material, one draw, the more detail)
A = Atlas("PrepAtlas")
for key, w_, h_, painter in (("rice", 2, 2, p_rice), ("nori", 2, 2, p_nori), ("hinoki", 2, 2, p_hinoki), ("dish", 2, 2, p_dish),
                             ("tenugui", 2, 2, p_fukin), ("bamboo", 2, 2, lambda w, h: bamboo_slats(w)), ("sasa", 2, 2, p_sasa),
                             ("salmon", 2, 2, p_salmon), ("ume", 2, 2, p_ume), ("kombu", 2, 2, p_kombu), ("takuan", 2, 2, p_takuan),
                             ("stoneware", 2, 2, p_stoneware), ("lacq", 1, 1, p_lacquer), ("lacqin", 1, 1, p_lacquer_black),
                             ("water", 1, 1, p_water), ("porcelain", 1, 1, p_porcelain), ("wood", 1, 1, p_wood), ("wrap", 1, 1, p_wrap),
                             ("black", 1, 1, p_black)):
    A.put(key, w_, h_, painter)
AM = A.material(rough=0.55)


def made(o, key, into=set_):
    A.uv_to(o, key)
    into.append(o)
    return o


def facing(o, outward=True, up=None):
    """a turned surface's faces turned the way they're seen: out from its axis (`outward`), or in toward it; or up (`up`)"""
    me = o.data
    cx = sum(v.co.x for v in me.vertices) / len(me.vertices)
    cy = sum(v.co.y for v in me.vertices) / len(me.vertices)
    s = 0.0
    for p in me.polygons:
        if up is not None:
            s += p.normal.z
        else:
            c = p.center
            s += p.normal.x * (c.x - cx) + p.normal.y * (c.y - cy)
    want = (up if up is not None else outward)
    if (s > 0) != want:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
    return o


def jitter(o, amount, seed_):
    """a soft heap's edge made uneven: each vertex out or in from the axis a little, by a noise of its angle"""
    rr = np.random.default_rng(seed_)
    me = o.data
    cx = sum(v.co.x for v in me.vertices) / len(me.vertices)
    cy = sum(v.co.y for v in me.vertices) / len(me.vertices)
    ph = rr.uniform(0, 6.3, 3)
    for v in me.vertices:
        a = math.atan2(v.co.y - cy, v.co.x - cx)
        k = 1 + amount * (math.sin(3 * a + ph[0]) * 0.5 + math.sin(5 * a + ph[1]) * 0.3 + math.sin(7 * a + ph[2]) * 0.2)
        v.co.x = cx + (v.co.x - cx) * k
        v.co.y = cy + (v.co.y - cy) * k
    return o


def rice_ball(name, x, y0, z, r, t):
    """a rice ball as it's shaped by hand (item 129): a rounded triangle, a corner up, 4 points round each corner, its faces puffed out (four
    rings front to back, the outer two drawn in), its flat foot at y0; its band of nori wrapped up from under its foot onto its front and
    back faces. Its rice's picture laid on it from the front (item 353: the grains, not a paper white); the nori's along its band. Returns
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
    lift = y0 + g + 0.0005 - ybot * 0.97
    vs = [[bm.verts.new(P(x + px * s, lift + py * s, z + dz)) for px, py in sec] for dz, s in rings]
    n = len(sec)
    for k in range(len(rings) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((vs[k][j], vs[k][j2], vs[k + 1][j2], vs[k + 1][j]))
    ladder(bm, vs[0][::-1])
    ladder(bm, vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            c = lp.vert.co
            lp[uvl].uv = (0.5 + (c.x - x) / (2.3 * r), 0.5 + (c.z - lift) / (2.3 * r))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    finish(o, name, AM)
    parts.append(o)
    A.uv_to(o, "rice")
    w, hb = r * 0.62, r * 0.75
    yo = lift + ybot * 0.8 - y0
    path = [(-t / 2 - g, yo + hb), (-t / 2 - g, yo), (-t * 0.3, 0.0005), (t * 0.3, 0.0005), (t / 2 + g, yo), (t / 2 + g, yo + hb)]
    acc = [0.0]
    for (z0_, y0_), (z1_, y1_) in zip(path, path[1:]):
        acc.append(acc[-1] + math.hypot(z1_ - z0_, y1_ - y0_))
    bm = bmesh.new()
    row = [[bm.verts.new(P(x + sx * w / 2, y0 + yy, z + zz)) for sx in (-1, 1)] for zz, yy in path]
    for k in range(len(row) - 1):
        bm.faces.new((row[k][0], row[k][1], row[k + 1][1], row[k + 1][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            k = next(i for i, rw in enumerate(row) if lp.vert in rw)
            lp[uvl].uv = (0.0 if lp.vert is row[k][0] else 1.0, acc[k] / acc[-1])
    me = bpy.data.meshes.new(name + "nori")
    bm.to_mesh(me)
    bm.free()
    nori = bpy.data.objects.new(name + "nori", me)
    bpy.context.collection.objects.link(nori)
    finish(nori, name + "nori", AM, smooth_shade=False)
    parts.append(nori)
    A.uv_to(nori, "nori")
    return o, nori


# (the hinoki board, its edges eased; two rice balls on it, shaped, and the third cook's one in the making between them is the game's)
made(boxed("board", BOARD_X - 0.36, BOARD_X + 0.36, H, H + 0.035, -0.2, 0.22, parts, AM, bev=0.006, segs=2), "hinoki")
for i, dx in enumerate((-0.2, 0.2)):
    set_.extend(rice_ball(f"onigiri{i}", BOARD_X + dx, H + 0.035, 0.04, 0.072, 0.056))

# (the bowl of hand water (手水): a lacquered bowl on a foot ring, red without and black within, the water a little under its rim)
WX, WZ = BOARD_X - 0.62, 0.02
made(facing(turned("bowl", WX, H, WZ, [(0.068, 0.0), (0.072, 0.012), (0.076, 0.016), (0.096, 0.034), (0.116, 0.066), (0.125, 0.092),
                                        (0.123, 0.0985), (0.119, 0.0992), (0.117, 0.097)], parts, AM, segs=20, cap=False), True), "lacq")
made(facing(turned("bowlin", WX, H, WZ, [(0.117, 0.097), (0.114, 0.088), (0.1, 0.058), (0.082, 0.036), (0.06, 0.026)], parts, AM, segs=20,
                   cap=True, uv="cyl"), False), "lacqin")
made(facing(turned("water", WX, H, WZ, [(0.104, 0.072)], parts, AM, segs=20, cap=True, uv="polar"), up=True), "water")

# (the fillings, each in a little sometsuke dish before the board: pickled plums, flaked salmon, kombu)
DISH = [(0.03, 0.0), (0.034, 0.006), (0.05, 0.016), (0.055, 0.0225), (0.05, 0.0215), (0.037, 0.012), (0.032, 0.0095)]
for i, (fill, dx) in enumerate((("ume", -0.2), ("salmon", 0.0), ("kombu", 0.2))):
    x = BOARD_X + dx
    made(facing(turned(f"dish{i}", x, H, 0.345, DISH, parts, AM, segs=16, cap=True, uv="polar", R=0.056), True), "dish")
    if fill == "ume":
        for k, (ox, oz) in enumerate(((-0.012, -0.006), (0.011, -0.008), (0.0, 0.011))):
            rr_ = 0.0125 - 0.001 * k
            prof = [(rr_ * math.sin(t_), rr_ * (1 - math.cos(t_)) * 0.85) for t_ in (0.45, 0.9, 1.35, 1.8, 2.25, 2.6)]
            made(facing(turned(f"fill{i}u{k}", x + ox, H + 0.0095 + 0.0008 * k, 0.345 + oz, prof, parts, AM, segs=8, cap=True, uv="cyl"), True), "ume")
    else:
        prof = [(0.031, 0.0), (0.03, 0.006), (0.025, 0.012), (0.016, 0.0165), (0.007, 0.0185)]
        o = turned(f"fill{i}", x, H + 0.0096, 0.345, prof, parts, AM, segs=16, cap=True, uv="polar", R=0.032)
        made(facing(jitter(o, 0.06, 353 + i), True), fill)

# (behind the board: the rice paddle on its little rest, a dish of pickled daikon, the pot of sesame)
made(slab("paddlehandle", [(-0.12, -0.012), (0.02, -0.014), (0.02, 0.014), (-0.12, 0.012), (-0.126, 0.0)], H + 0.0005, 0.008, parts, AM,
          x=BOARD_X - 0.12, z=-0.31), "bamboo")
head = [(0.055 * math.cos(a), 0.046 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
made(slab("paddlehead", head, H + 0.0005, 0.0095, parts, AM, x=BOARD_X - 0.1 + 0.044, z=-0.31), "bamboo")
made(facing(turned("pickledish", BOARD_X + 0.3, H, -0.32, DISH, parts, AM, segs=16, cap=True, uv="polar", R=0.056), True), "dish")
half = [(0.022 * math.cos(a), 0.022 * math.sin(a)) for a in np.linspace(0, math.pi, 9)]
half = [(0.018 * math.cos(a), 0.018 * math.sin(a)) for a in np.linspace(0, math.pi, 9)]
for k in range(3):
    made(slab(f"takuan{k}", half, H + 0.0098 + k * 0.0032, 0.003, parts, AM, x=BOARD_X + 0.3 - 0.012 + k * 0.012, z=-0.326 + 0.006 * k,
              turn=-0.3 + k * 0.25), "takuan")
made(facing(turned("sesamepot", BOARD_X + 0.46, H, -0.32, [(0.025, 0.0), (0.03, 0.006), (0.034, 0.025), (0.033, 0.048), (0.027, 0.062),
                                                         (0.025, 0.068)], parts, AM, segs=16, cap=False), True), "stoneware")
made(facing(turned("sesamelid", BOARD_X + 0.46, H, -0.32, [(0.0285, 0.067), (0.03, 0.072), (0.027, 0.077), (0.014, 0.0795)], parts, AM,
                   segs=16, cap=True, uv="cyl"), True), "wood")
made(facing(turned("sesameknob", BOARD_X + 0.46, H, -0.32, [(0.006, 0.0792), (0.0075, 0.084), (0.005, 0.088)], parts, AM, segs=8, cap=True), True), "wood")

# (a folded tenugui, its indigo dots, between the water bowl and the board's front corner)
made(boxed("towel", BOARD_X - 0.5, BOARD_X - 0.34, H, H + 0.034, 0.28, 0.4, parts, AM, bev=0.011, segs=2), "tenugui")

# (the box of nori sheets, black lacquer, its lid slid back off half of it; the box of food wrap behind it; the little porcelain salt pot)
NX0, NX1, NZ0, NZ1 = BOARD_X + 0.5, BOARD_X + 0.78, -0.22, 0.0
made(boxed("noribox", NX0, NX1, H, H + 0.055, NZ0, NZ1, parts, AM, bev=0.004), "black")
made(boxed("norisheets", NX0 + 0.012, NX1 - 0.012, H + 0.0552, H + 0.0585, NZ0 + 0.136, NZ1 - 0.012, parts, AM), "nori")
made(boxed("norilid", NX0 - 0.004, NX1 + 0.004, H + 0.0552, H + 0.0672, NZ0 - 0.004, NZ0 + 0.13, parts, AM, bev=0.004), "black")
made(boxed("wrapbox", BOARD_X + 0.52, BOARD_X + 0.78, H, H + 0.06, -0.4, -0.3, parts, AM, bev=0.003), "wrap")
made(facing(turned("salt", BOARD_X + 0.5, H, 0.12, [(0.026, 0.0), (0.033, 0.01), (0.036, 0.045), (0.03, 0.064), (0.031, 0.07)], parts, AM,
                   segs=16, cap=False), True), "porcelain")
made(facing(turned("saltlid", BOARD_X + 0.5, H, 0.12, [(0.0335, 0.0695), (0.034, 0.074), (0.026, 0.08), (0.012, 0.083)], parts, AM,
                   segs=16, cap=True), True), "porcelain")

# (the bamboo tray of finished rice balls at the right end: its floor and four low walls, eased; bamboo leaves laid on it under them)
TX0, TX1, TZ0, TZ1 = BOARD_X + 0.62, BOARD_X + 1.05, 0.04, 0.36
made(boxed("trayfloor", TX0, TX1, H, H + 0.008, TZ0, TZ1, parts, AM, bev=0.002), "bamboo")
for nm, a0, a1, b0, b1 in (("traywallb", TX0, TX1, TZ0, TZ0 + 0.012), ("traywallf", TX0, TX1, TZ1 - 0.012, TZ1),
                          ("traywalll", TX0, TX0 + 0.012, TZ0 + 0.012, TZ1 - 0.012), ("traywallr", TX1 - 0.012, TX1, TZ0 + 0.012, TZ1 - 0.012)):
    made(boxed(nm, a0, a1, H + 0.008, H + 0.045, b0, b1, parts, AM, bev=0.003), "bamboo")


def sasa(name, lx, y, lz, ang, L_=0.24, W_=0.07):
    """a bamboo leaf laid down (item 353: they were six-sided plates and read as cucumbers): long and pointed, folded a little along its
    midrib, arched along its length; u along it, v across it (its picture's midrib down the middle)"""
    bm = bmesh.new()
    st = 10
    rows = []
    for k in range(st + 1):
        t = k / st
        wd = (W_ / 2) * (math.sin(math.pi * min(1.0, 0.04 + t * 0.96)) ** 0.8)
        arch = 0.004 * math.sin(math.pi * t)
        px = (t - 0.5) * L_
        row_ = []
        for s_ in (-1, 0, 1):
            pz = s_ * wd
            hy = y + arch + (0.0025 if s_ == 0 else 0.0)
            row_.append(bm.verts.new(P(lx + px * math.cos(ang) - pz * math.sin(ang), hy, lz + px * math.sin(ang) + pz * math.cos(ang))))
        rows.append((t, wd, row_))
    for (t0, w0, r0), (t1, w1, r1) in zip(rows, rows[1:]):
        bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
        bm.faces.new((r0[1], r1[1], r1[2], r0[2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    for t, wd, row_ in rows:
        for s_, vt in zip((-1, 0, 1), row_):
            for lp in vt.link_loops:
                lp[uvl].uv = (t, 0.5 + s_ * 0.5 * (wd / (W_ / 2) if W_ else 0))
    o = _obj(bm, name, parts, AM, smooth_shade=True)
    facing(o, up=True)
    return made(o, "sasa")


for k in range(3):
    sasa(f"sasa{k}", TX0 + 0.075 + k * 0.14, H + 0.0095 + 0.0006 * k, (TZ0 + TZ1) / 2 - 0.02, math.pi / 2 + (k - 1) * 0.18)

done_ = []


def onigiri_at(name, x, y0, z):
    """a finished rice ball on the tray: its own node (the game shows as many as the tray holds, game/rice's TRAY_MAX: item 129), its rice
    and its nori one mesh"""
    o, nori = rice_ball(name, x, y0, z, 0.06, 0.046)
    done_.append(join([o, nori], name))


for k in range(3):
    onigiri_at(f"PrepDone{k}", TX0 + 0.075 + k * 0.14, H + 0.017, (TZ0 + TZ1) / 2 - 0.02)
# (each thing its own node, under the root: the game inks each but the flat ones (the water, the leaves, the nori, the heaps) before it draws
# them all as one by material)
root = root_of("PrepCounter", set_ + done_)
if PREVIEW:
    preview_cam()
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "prepcounter.glb"), os.path.join(PROJECT, "blender", "prepcounter.blend"),
            PREVIEW.replace(".png", "-prep.png") if PREVIEW else None)
print("WARMER_DONE")
