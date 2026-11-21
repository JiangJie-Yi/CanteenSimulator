"""The staff room upstairs (二樓員工休息室兼宿舍, dorm.glb; item 325, the owner's, 2026-11-18: 「然後捏個2F小房間，會切換場景，可以上樓去」;
remade for item 339, the owner's: 「2樓有點太隨便，員工上樓也得呈現」): a four-and-a-half-mat room over the shop with a strip of board floor
beside it where the stair comes up from the staff door, where those who live in sleep and the crew take their break. Seen as a doll's
house is, from its open front.

The mats laid as they're laid (the half mat in the middle, the four turning round it: no four corners meeting at a point), their weave
across each mat; the board strip on the right, the stair's well in it with the steps going down out of sight and a rail on posts along its
open side, slippers at its head. The back wall: a window with its shoji slid half open on a night of roofs and lit windows, a television
on its low stand (books under it, a flask on it), a calendar and a clock over it; work clothes on hooks over the board floor. The left wall:
the closet (oshiire) with one fusuma slid across the other, the futons folded on its shelf; a small chest of drawers in the corner. A round
low table with tea and mandarins, three cushions round it; a washi lamp over it.

- node "Dorm": the room, its floor's middle at the origin, its open front toward +z; metres.
- node "DormLamp": the lamp's shade (glowing, the game lights it).
- node "DormTable": the low table and what's on it (shown while nobody's asleep); "DormTableAway": the table folded against the wall and the
  tea things on the stand (shown while someone is); "DormBedding0", "DormBedding1": a futon laid out, its quilt and pillow (shown while its
  sleeper sleeps).
- the bathroom behind the stair's head's wall (item 427, the owner's, 2026-11-21: 「這塊後面是衛浴設備」): a unit bath (ユニットバス) as a
  small flat's is, those who live in's bath and toilet: its floor a step up, its walls pale panels, a tub along its back with its mixer and
  shower on a rail and a curtain pushed back, the toilet beside it, a little basin and mirror by the door, a towel, a mat, the bottles on the
  tub's rim; open to the sky as the room is, looked down into. Its door a frosted sliding one into the wall's pocket (node "DormBathDoor",
  the game slides it), the work clothes that hung on that wall on its hooks now.
- empties "DormLook" (over the table, for the camera), "DormSeat0".."DormSeat2" (on each cushion, facing the table), "DormBed0",
  "DormBed1" (on each futon's pillow end, the body along +z), "DormStairTop" (the stair's head, on the board floor), "DormStairFoot" (down the
  stair, out of sight, where one coming up starts).

Low-poly: boxes (soft ones bevelled two steps), 8 to 24-round lathes with ladder caps; its pictures drawn here.

Run:
    blender -b --factory-startup --python blender/dorm.py -- <project path> [preview.png]
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
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(339)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    """a colour as hex, made linear (a material's colour)"""
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# the room: 3.6 by 2.7, its walls 2.4 high; the back wall at -z, the left at -x, the open front at +z. The mats from the left wall to
# x = 0.9 (four and a half: 2.7 by 2.7), the board strip from there to the right wall
W, D, H = 3.6, 2.7, 2.4
X0, X1, Z0, Z1 = -W / 2, W / 2, -D / 2, D / 2
WALL = 0.1
TX1 = X0 + 2.7
FLOOR = 0.055           # (the mats' top and the boards', flush)
# (the stair's well: in the board strip, from the front back 1.45; its head at its back end)
SX0, SX1, SZ0 = TX1 + 0.06, X1 - 0.05, Z1 - 1.45

# ---------------------------------------------------------------------------------------------------- pictures
N = 512
u, v = grid01(N)
# (the mats' rush: fine rows across the mat, its green gone straw with years, a little uneven)
rush = np.sin(v * 2 * math.pi * 120 + (fbm(N, 2, 8, 3) - 0.5) * 2) * 0.5 + 0.5
tatami = mix((0.76, 0.72, 0.5), (0.63, 0.59, 0.39), smooth(0.4, 1.0, rush) * 0.6)
tatami = tatami * (0.93 + 0.1 * fbm(N, 6, 3, 3))[..., None]
# (the borders: dark indigo cloth with a fine weave)
heri = mix((0.12, 0.14, 0.24), (0.2, 0.22, 0.33), smooth(0.5, 1.0, np.sin(u * 2 * math.pi * 200) * 0.5 + 0.5) * 0.5)
# (the plaster: warm sand wall (juraku), mottled with fine grit)
plaster = mix((0.9, 0.85, 0.75), (0.83, 0.77, 0.66), fbm(N, 8, 8, 4) * 0.7)
plaster = plaster * (0.96 + 0.06 * (vnoise(N, 160, 160) > 0.82))[..., None]
# (the wood: honey grain along v)
grain = np.sin((v * 34 + (fbm(N, 2, 10, 3) - 0.5) * 2.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.62, 0.44, 0.27), (0.48, 0.32, 0.19), smooth(0.6, 1.0, grain) * 0.7) * (0.94 + 0.08 * fbm(N, 3, 3, 3))[..., None]
# (the board floor: planks along v, their joints dark, a little worn)
plank = (np.abs(((u * 6) % 1) - 0.5) > 0.485).astype(np.float32)
boards = mix((0.56, 0.4, 0.25), (0.45, 0.31, 0.19), smooth(0.6, 1.0, grain) * 0.6) * (1 - 0.45 * plank)[..., None]
# (the shoji's paper; the fusuma's: pale waves on cream)
paper = mix((0.97, 0.95, 0.9), (0.93, 0.9, 0.84), fbm(N, 10, 10, 4) * 0.5)
fusuma = mix((0.9, 0.86, 0.76), (0.8, 0.74, 0.6), (np.sin(np.hypot((u % 0.25) - 0.125, (v % 0.25) + 0.05) * 90) * 0.5 + 0.5) ** 6 * 0.55)
# (the futons: deep blue with white kasuri marks; pink with small flowers)
futon_b = mix((0.16, 0.26, 0.5), (0.92, 0.92, 0.95), smooth(0.88, 0.94, vnoise(N, 60, 30)) * 0.85)
futon_p = mix((0.9, 0.62, 0.66), (0.98, 0.95, 0.9), smooth(0.85, 0.9, vnoise(N, 40, 40)) * 0.8)
# (the night through the window: the sky deep blue going lighter low down, the roofs across the lane black against it, their windows lit)
sky = mix((0.05, 0.07, 0.16), (0.2, 0.2, 0.34), smooth(0.9, 0.2, v))
roof = (v < 0.42 + 0.05 * np.sin(u * 9) + 0.04 * np.sign(np.sin(u * 23))).astype(np.float32)
lit = ((vnoise(N, 26, 18) > 0.8) & (v < 0.32) & (v > 0.06)).astype(np.float32) * roof
night = mix(sky, (0.04, 0.035, 0.05), roof)
night = mix(night, (1.0, 0.78, 0.42), lit)
# (the calendar: a picture of a mountain over the month's grid, a red band at its head)
cal = np.ones((N, N, 3), np.float32) * np.array((0.96, 0.94, 0.89), np.float32)
mount = (v > 0.55) & (v < 0.55 + 0.4 * (1 - np.abs(u - 0.5) * 2.2))
cal = mix(cal, (0.55, 0.68, 0.84), ((v > 0.55) & (v < 0.95)).astype(np.float32) * 0.8)
cal = mix(cal, (0.3, 0.36, 0.5), mount.astype(np.float32))
cal = mix(cal, (0.95, 0.95, 0.97), (mount & (v > 0.83)).astype(np.float32))
cells = ((np.abs(((u * 7) % 1) - 0.5) > 0.46) | (np.abs(((v * 10) % 1) - 0.5) > 0.46)) & (v < 0.5) & (v > 0.06)
cal = mix(cal, (0.6, 0.55, 0.5), cells.astype(np.float32))
cal = mix(cal, (0.72, 0.18, 0.15), (v > 0.95).astype(np.float32))
# (the books' spines: a row of colours with pale bands)
band = np.floor(u * 9)
spine = np.stack([0.3 + 0.5 * ((band * 37) % 7) / 7, 0.25 + 0.4 * ((band * 53) % 5) / 5, 0.25 + 0.5 * ((band * 29) % 6) / 6], -1)
spine = mix(spine, (0.92, 0.9, 0.84), ((v > 0.7) & (v < 0.78)).astype(np.float32))
spine = spine * (1 - 0.6 * (np.abs(((u * 9) % 1) - 0.5) > 0.46))[..., None]
# (the bathroom's pictures (items 427, 447): its walls white glazed tiles, 10 cm (nine to its 0.9 m), a faint blue in the glaze, each a
# shade of its own, grey grout; its floor little square mosaic tiles, 2.5 cm (twenty to its 0.5 m), pale blues and greys mixed, light
# grout; the frosted panes, milky, a faint vertical ripple; hinoki, pale straw-gold, a fine straight grain along u, a few darker lines)
NB = 256
ub, vb = grid01(NB)
cell = ((np.floor(ub * 9) * 7 + np.floor(vb * 9) * 13) % 5) / 5
bathwall = mix((0.90, 0.94, 0.94), (0.84, 0.90, 0.91), fbm(NB, 5, 5, 3)) * (0.96 + 0.05 * cell)[..., None]
grout = ((np.abs(((ub * 9) % 1) - 0.5) > 0.465) | (np.abs(((vb * 9) % 1) - 0.5) > 0.465)).astype(np.float32)
bathwall = mix(bathwall, (0.66, 0.69, 0.69), grout)
cellf = ((np.floor(ub * 20) * 11 + np.floor(vb * 20) * 17) % 7) / 7
bathfloor = mix((0.6, 0.71, 0.78), (0.76, 0.79, 0.8), cellf) * (0.96 + 0.06 * fbm(NB, 6, 6, 3))[..., None]
groutf = ((np.abs(((ub * 20) % 1) - 0.5) > 0.43) | (np.abs(((vb * 20) % 1) - 0.5) > 0.43)).astype(np.float32)
bathfloor = mix(bathfloor, (0.86, 0.86, 0.84), groutf)
frost = mix((0.86, 0.88, 0.88), (0.80, 0.83, 0.84), fbm(NB, 3, 24, 4))
hg = np.sin((vb * 60 + (fbm(NB, 2, 12, 3) - 0.5) * 1.6) * 2 * math.pi) * 0.5 + 0.5
hinoki = mix((0.93, 0.83, 0.62), (0.84, 0.71, 0.5), smooth(0.65, 1.0, hg) * 0.55) * (0.95 + 0.07 * fbm(NB, 3, 3, 3))[..., None]
FROST_IMG = image("dorm_frosted", np.clip(frost, 0, 1).astype(np.float32))
M = {
    "tatami": pbr("DormTatami", (1, 1, 1), tex=image("dorm_tatami", np.clip(tatami, 0, 1).astype(np.float32)), rough=0.8),
    "heri": pbr("DormHeri", (1, 1, 1), tex=image("dorm_heri", np.clip(heri, 0, 1).astype(np.float32)), rough=0.8),
    "plaster": pbr("DormPlaster", (1, 1, 1), tex=image("dorm_plaster", np.clip(plaster, 0, 1).astype(np.float32)), rough=0.9),
    "wood": pbr("DormWood", (1, 1, 1), tex=image("dorm_wood", np.clip(wood, 0, 1).astype(np.float32)), rough=0.6),
    "boards": pbr("DormBoards", (1, 1, 1), tex=image("dorm_boards", np.clip(boards, 0, 1).astype(np.float32)), rough=0.6),
    "paper": pbr("DormPaper", (1, 1, 1), tex=image("dorm_paper", np.clip(paper, 0, 1).astype(np.float32)), rough=0.9),
    "fusuma": pbr("DormFusuma", (1, 1, 1), tex=image("dorm_fusuma", np.clip(fusuma, 0, 1).astype(np.float32)), rough=0.9),
    "futon_b": pbr("DormFutonBlue", (1, 1, 1), tex=image("dorm_futon_b", np.clip(futon_b, 0, 1).astype(np.float32)), rough=0.9),
    "futon_p": pbr("DormFutonPink", (1, 1, 1), tex=image("dorm_futon_p", np.clip(futon_p, 0, 1).astype(np.float32)), rough=0.9),
    "night": pbr("DormNightView", (1, 1, 1), tex=image("dorm_night", np.clip(night, 0, 1).astype(np.float32)), rough=1.0),
    "cal": pbr("DormCalendar", (1, 1, 1), tex=image("dorm_calendar", np.clip(cal, 0, 1).astype(np.float32)), rough=0.9),
    "spine": pbr("DormBooks", (1, 1, 1), tex=image("dorm_books", np.clip(spine, 0, 1).astype(np.float32)), rough=0.8),
    "sheet": pbr("DormSheet", lin("#f2efe8"), rough=0.9),
    "dark": pbr("DormDark", lin("#2a2420"), rough=0.6),
    "shaft": pbr("DormShaft", lin("#3a2c22"), rough=0.8),
    "lacquer": pbr("DormLacquer", lin("#3a2418"), rough=0.4),
    "iron": pbr("DormIron", lin("#2e2b2a"), rough=0.5),
    "zab_r": pbr("DormZabutonRed", lin("#8a3a2e"), rough=0.9),
    "zab_b": pbr("DormZabutonBlue", lin("#2e3f66"), rough=0.9),
    "tea": pbr("DormTeaPot", lin("#3f5446"), rough=0.4),
    "cup": pbr("DormCup", lin("#efe8da"), rough=0.4),
    "mikan": pbr("DormMikan", lin("#f08a2a"), rough=0.6),
    "lamp": pbr("DormLampShade", lin("#fff1d6"), rough=0.9, emit=lin("#ffd9a0"), emit_strength=0.6),
    "tv": pbr("DormTv", lin("#1c1d22"), rough=0.3),
    "screen": pbr("DormScreen", lin("#101521"), rough=0.15),
    "happi": pbr("DormHappi", lin("#26365e"), rough=0.9),
    "apron": pbr("DormApron", lin("#e9e4d8"), rough=0.9),
    "slipper": pbr("DormSlipper", lin("#7a5a3a"), rough=0.8),
    "flask": pbr("DormFlask", lin("#c8463a"), rough=0.4),
    "clock": pbr("DormClockFace", lin("#f4f1ea"), rough=0.6),
    "box": pbr("DormBox", lin("#b8946a"), rough=0.9),
    # (the bathroom (items 427, 447): its tiles, its mosaic, the fittings' ivory china, the water, the chrome, the frosted panes, the
    # mirrors, the mat, the towel; the hinoki, the bucket's copper hoop, the toilet's slippers, the bottles)
    "bathwall": pbr("DormBathWall", (1, 1, 1), tex=image("dorm_bathwall", np.clip(bathwall, 0, 1).astype(np.float32)), rough=0.5),
    "bathfloor": pbr("DormBathFloor", (1, 1, 1), tex=image("dorm_bathfloor", np.clip(bathfloor, 0, 1).astype(np.float32)), rough=0.7),
    "frp": pbr("DormBathFRP", lin("#efeadd"), rough=0.35),
    "water": pbr("DormBathWater", lin("#bcd9e2"), rough=0.1),
    "chrome": pbr("DormChrome", lin("#c9ccd0"), rough=0.2, metal=0.8),
    "frost": pbr("DormFrosted", (1, 1, 1), tex=FROST_IMG, rough=0.6),
    # (the bath's window's panes (item 456): the same frosted glass, a material of their own for the game to light by the part of the day)
    "frostwin": pbr("DormBathWindow", (1, 1, 1), tex=FROST_IMG, rough=0.6),
    "mirror": pbr("DormMirror", lin("#9fb0b8"), rough=0.05, metal=0.6),
    "bathmat": pbr("DormBathMat", lin("#4f7f9a"), rough=0.95),
    "towel": pbr("DormTowel", lin("#e8d6b8"), rough=0.95),
    "hinoki": pbr("DormHinoki", (1, 1, 1), tex=image("dorm_hinoki", np.clip(hinoki, 0, 1).astype(np.float32)), rough=0.7),
    "copper": pbr("DormCopper", lin("#b06a3c"), rough=0.35, metal=0.6),
    "wcslipper": pbr("DormWcSlipper", lin("#6f8f6c"), rough=0.6),
    "bottle_b": pbr("DormBottleB", lin("#9cc3cf"), rough=0.4),
    "bottle_g": pbr("DormBottleG", lin("#5f8f6a"), rough=0.4),
    "bottle_w": pbr("DormBottleW", lin("#f1efe8"), rough=0.4),
}

parts = []
groups = {}            # (the pieces the game shows and hides: their parts by the node they join into)


def box_uv(o, tile, swap=False):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                uv = (c.y / tile, c.z / tile)
            else:
                uv = (c.x / tile, c.z / tile)
            loop[uvl].uv = (uv[1], uv[0]) if swap else uv
    bm.to_mesh(o.data)
    bm.free()


def _finish(o, mat, tile, group, swap=False, smooth_=False):
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    box_uv(o, tile, swap)
    for p_ in o.data.polygons:
        p_.use_smooth = smooth_
    (groups.setdefault(group, []) if group else parts).append(o)
    return o


def block(name, lo, hi, mat, tile=1.0, group=None, swap=False):
    """a box from `lo` to `hi` (the game's frame), its picture laid at `tile` metres; `group`: a piece of its own, for the game to show"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(lo) + Vector(hi)) / 2
    s = Vector(hi) - Vector(lo)
    for vv in bm.verts:
        vv.co = P(c.x + vv.co.x * s.x, c.y + vv.co.y * s.y, c.z + vv.co.z * s.z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return _finish(bpy.data.objects.new(name, me), mat, tile, group, swap)


def soft(name, lo, hi, mat, r=0.02, tile=1.0, group=None, segs=2, bulge=0.0):
    """a box with its edges rounded (a cushion, a quilt, a pillow: two bevel steps), its top swelling `bulge` in the middle"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(lo) + Vector(hi)) / 2
    s = Vector(hi) - Vector(lo)
    for vv in bm.verts:
        vv.co = P(c.x + vv.co.x * s.x, c.y + vv.co.y * s.y, c.z + vv.co.z * s.z)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(r, min(s) * 0.45), segments=segs, profile=0.5, affect='EDGES')
    if bulge:
        top = max(vv.co.z for vv in bm.verts)
        for vv in bm.verts:
            if vv.co.z > top - 1e-4:
                kx = 1 - min(1, abs(vv.co.x - P(c.x, 0, 0).x) / (s.x / 2))
                ky = 1 - min(1, abs(vv.co.y - P(0, 0, c.z).y) / (s.z / 2))
                vv.co.z += bulge * kx * ky
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return _finish(bpy.data.objects.new(name, me), mat, tile, group, smooth_=True)


def lathe(name, x, y, z, prof, mat, segs=16, group=None, sx=1.0, sz=1.0, bands=None):
    """turned round the upright through (x, y, z): `prof` (radius, height) from the foot up; its ends closed in a ladder, not a fan; `sx`,
    `sz` its round drawn out across and along (an oval: a toilet's bowl); `bands` a material for each band between the profile's points
    (a bucket's hoop), else `mat` for all"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    keys = list(dict.fromkeys(bands)) if bands else [mat]
    rings = [[bm.verts.new(P(x + r * sx * math.cos(2 * math.pi * k / segs), y + h, z + r * sz * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
             for r, h in prof]
    for i in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            if bands:
                f.material_index = keys.index(bands[i])
            for loop, (uu, vv) in zip(f.loops, ((k / segs, i / len(rings)), ((k + 1) / segs, i / len(rings)),
                                                ((k + 1) / segs, (i + 1) / len(rings)), (k / segs, (i + 1) / len(rings)))):
                loop[uvl].uv = (uu, vv)
    # (its ends closed flat (export_dish lays a convex cap out in a ladder); never a ring drawn in to a point, a fan of slivers)
    if prof[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if prof[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for kk in keys:
        o.data.materials.append(M[kk])
    for p_ in o.data.polygons:
        p_.use_smooth = len(p_.vertices) == 4
    (groups.setdefault(group, []) if group else parts).append(o)
    return o


def tube(name, x, y, z0, z1, r, mat, segs=10, group=None, axis="z"):
    """a round lying along z from z0 to z1 about (x, y) (a roll of paper): its sides smooth, its ends flat (laid in a ladder on export);
    `axis` "x": lying along x instead, from z0 to z1 there, about (y, z) = (y, x)"""
    bm = bmesh.new()
    if axis == "x":
        rings = [[bm.verts.new(P(xx, y + r * math.sin(2 * math.pi * k / segs), x + r * math.cos(2 * math.pi * k / segs))) for k in range(segs)]
                 for xx in (z0, z1)]
    else:
        rings = [[bm.verts.new(P(x + r * math.cos(2 * math.pi * k / segs), y + r * math.sin(2 * math.pi * k / segs), zz)) for k in range(segs)]
                 for zz in (z0, z1)]
    for k in range(segs):
        k2 = (k + 1) % segs
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _finish(bpy.data.objects.new(name, me), mat, 0.4, group)
    for p_ in o.data.polygons:
        p_.use_smooth = len(p_.vertices) == 4
    return o


# ---------------------------------------------------------------------------------------------------- the floor
# (its base under everything but the stair's well)
block("DormFloorBaseA", (X0, -0.06, Z0), (SX0, -0.002, Z1), "wood", 0.8)
block("DormFloorBaseB", (SX0, -0.06, Z0), (SX1, -0.002, SZ0), "wood", 0.8)
block("DormFloorBaseC", (SX1, -0.06, Z0), (X1, -0.002, Z1), "wood", 0.8)
# (the mats: the half mat in the middle, the four turning round it; each its borders along its long sides, the weave across it)
MATS = [("A", 0.0, 1.8, 0.0, 0.9), ("B", 1.8, 2.7, 0.0, 1.8), ("C", 0.9, 2.7, 1.8, 2.7), ("D", 0.0, 0.9, 0.9, 2.7), ("H", 0.9, 1.8, 0.9, 1.8)]
for nm, a, b, c, d in MATS:
    x0, x1, z0, z1 = X0 + a + 0.003, X0 + b - 0.003, Z0 + c + 0.003, Z0 + d - 0.003
    along_x = (x1 - x0) > (z1 - z0) + 0.01
    if along_x:
        block(f"DormMat{nm}", (x0, 0.0, z0 + 0.03), (x1, FLOOR, z1 - 0.03), "tatami", 0.9, swap=True)
        for k, (p, q) in enumerate(((z0, z0 + 0.03), (z1 - 0.03, z1))):
            block(f"DormHeri{nm}{k}", (x0, 0.0, p), (x1, FLOOR + 0.001, q), "heri", 0.3, swap=True)
    else:
        block(f"DormMat{nm}", (x0 + 0.03, 0.0, z0), (x1 - 0.03, FLOOR, z1), "tatami", 0.9)
        for k, (p, q) in enumerate(((x0, x0 + 0.03), (x1 - 0.03, x1))):
            block(f"DormHeri{nm}{k}", (p, 0.0, z0), (q, FLOOR + 0.001, z1), "heri", 0.3)
# (the board strip: behind the well, and either side of it; the sill between it and the mats)
block("DormBoardsBack", (TX1 + 0.02, 0.0, Z0), (X1, FLOOR, SZ0), "boards", 0.9)
block("DormBoardsL", (TX1 + 0.02, 0.0, SZ0), (SX0, FLOOR, Z1), "boards", 0.9)
block("DormBoardsR", (SX1, 0.0, SZ0), (X1, FLOOR, Z1), "boards", 0.9)
block("DormSill", (TX1 - 0.002, 0.0, Z0), (TX1 + 0.02, FLOOR + 0.004, Z1), "wood", 0.5)

# ---------------------------------------------------------------------------------------------------- the stair
# (down through the well toward the front: six steps of 0.2 rise, 0.22 going, solid to the shaft's floor; the shaft's walls and floor dark)
RISE, GO = 0.2, 0.22
for i in range(6):
    top = FLOOR - RISE * (i + 1)
    block(f"DormStep{i}", (SX0 + 0.01, -1.42, SZ0 + GO * i), (SX1 - 0.01, top, SZ0 + GO * (i + 1)), "wood", 0.6)
    block(f"DormStepNose{i}", (SX0 + 0.01, top - 0.025, SZ0 + GO * (i + 1) - 0.004), (SX1 - 0.01, top + 0.004, SZ0 + GO * (i + 1) + 0.01), "lacquer", 0.4)
block("DormShaftL", (SX0 - 0.03, -1.45, SZ0), (SX0, -0.002, Z1), "shaft", 1.0)
block("DormShaftR", (SX1, -1.45, SZ0), (SX1 + 0.03, -0.002, Z1), "shaft", 1.0)
block("DormShaftEnd", (SX0, -1.45, SZ0 - 0.03), (SX1, -0.002, SZ0), "shaft", 1.0)
block("DormShaftFloor", (SX0, -1.48, SZ0), (SX1, -1.42, Z1), "shaft", 1.0)
# (the rail along the well's open side, toward the mats: three posts and a rail on them, rounded at the ends)
for k, z in enumerate((SZ0 + 0.03, (SZ0 + Z1) / 2, Z1 - 0.05)):
    block(f"DormRailPost{k}", (SX0 - 0.06, 0.0, z - 0.025), (SX0 - 0.01, 0.86, z + 0.025), "lacquer", 0.4)
soft("DormRail", (SX0 - 0.065, 0.84, SZ0), (SX0 - 0.005, 0.9, Z1 - 0.02), "lacquer", r=0.02, tile=0.4)
# (slippers at the stair's head, two pairs, toes to the room)
for k, x in enumerate((TX1 + 0.18, TX1 + 0.5)):
    for sd in (-1, 1):
        soft(f"DormSlipper{k}{sd}", (x + sd * 0.055 - 0.04, FLOOR, SZ0 - 0.32), (x + sd * 0.055 + 0.04, FLOOR + 0.025, SZ0 - 0.1), "slipper", r=0.012, segs=1)

# (the left wall, its trims, its cut edge and the closet's shell: a piece of their own (item 426), for the game to take away when the view's
# turned round to that side, as a doll's house's near wall is; the closet's floor, shelf and what's in it stay)
LEFT_CUT = "DormLeftCut"

# ---------------------------------------------------------------------------------------------------- the walls
# (the back wall round its window; the left round the closet; the right low over the board strip; skirting and a rail high round them)
WX0, WX1, WY0, WY1 = -1.15, 0.0, 0.78, 1.66
block("DormWallBackL", (X0 - WALL, 0.0, Z0 - WALL), (WX0, H, Z0), "plaster", 1.2)
# (its right stretch, over the stair's head, a doorway in it (item 427): the bathroom's)
BD0, BD1, BDH = 1.0, 1.72, 1.85
block("DormWallBackR", (WX1, 0.0, Z0 - WALL), (BD0 - 0.04, H, Z0), "plaster", 1.2)
block("DormWallBackRR", (BD1 + 0.04, 0.0, Z0 - WALL), (X1 + WALL, H, Z0), "plaster", 1.2)
block("DormWallBackRT", (BD0 - 0.04, BDH + 0.05, Z0 - WALL), (BD1 + 0.04, H, Z0), "plaster", 1.2)
block("DormWallBackB", (WX0, 0.0, Z0 - WALL), (WX1, WY0, Z0), "plaster", 1.2)
block("DormWallBackT", (WX0, WY1, Z0 - WALL), (WX1, H, Z0), "plaster", 1.2)
OZ0, OZ1, OY1 = Z0 + 0.75, Z0 + 2.55, 1.8
block("DormWallLeftB", (X0 - WALL, 0.0, Z0), (X0, H, OZ0), "plaster", 1.2, group=LEFT_CUT)
block("DormWallLeftF", (X0 - WALL, 0.0, OZ1), (X0, H, Z1), "plaster", 1.2, group=LEFT_CUT)
block("DormWallLeftT", (X0 - WALL, OY1, OZ0), (X0, H, OZ1), "plaster", 1.2, group=LEFT_CUT)
block("DormWallRight", (X1, 0.0, Z0), (X1 + WALL, 0.9, Z1), "plaster", 1.2)
block("DormRightCap", (X1 - 0.004, 0.9, Z0 - 0.004), (X1 + WALL + 0.004, 0.94, Z1), "wood", 0.6)
for nm, lo, hi in (("BackL", (X0, 0.0, Z0), (WX0, 0.12, Z0 + 0.012)), ("BackR", (WX1, 0.0, Z0), (BD0 - 0.045, 0.12, Z0 + 0.012)),
                   ("BackRR", (BD1 + 0.045, 0.0, Z0), (X1, 0.12, Z0 + 0.012)),
                   ("LeftB", (X0, 0.0, Z0 + 0.012), (X0 + 0.012, 0.12, OZ0)), ("LeftF", (X0, 0.0, OZ1), (X0 + 0.012, 0.12, Z1)),
                   ("BackRail", (X0, H - 0.42, Z0), (X1, H - 0.36, Z0 + 0.022)), ("LeftRail", (X0, H - 0.42, Z0 + 0.022), (X0 + 0.022, H - 0.36, Z1))):
    block(f"DormTrim{nm}", lo, hi, "wood", 0.6, group=LEFT_CUT if nm.startswith("Left") else None)
# (the cut walls' edges, toward the viewer: a dark core between the plaster's faces, as a doll's house is cut)
block("DormCutLeft", (X0 - WALL, 0.0, Z1), (X0, H, Z1 + 0.004), "dark", 1.0, group=LEFT_CUT)
block("DormCutRight", (X1, 0.0, Z1), (X1 + WALL, 0.9, Z1 + 0.004), "dark", 1.0)

# ---------------------------------------------------------------------------------------------------- the window
# (the night outside, a little back in the wall; the frame and sill; two shoji panels on their tracks, the right slid behind the left: half open)
block("DormNightView", (WX0, WY0, Z0 - 0.09), (WX1, WY1, Z0 - 0.085), "night", 1.15)
for nm, lo, hi in (("T", (WX0 - 0.05, WY1, Z0 - WALL), (WX1 + 0.05, WY1 + 0.05, Z0 + 0.03)), ("L", (WX0 - 0.05, WY0, Z0 - WALL), (WX0, WY1, Z0 + 0.03)),
                   ("R", (WX1, WY0, Z0 - WALL), (WX1 + 0.05, WY1, Z0 + 0.03))):
    block(f"DormWindowFrame{nm}", lo, hi, "wood", 0.6)
block("DormWindowSill", (WX0 - 0.07, WY0 - 0.035, Z0 - WALL), (WX1 + 0.07, WY0, Z0 + 0.07), "wood", 0.6)
PW = (WX1 - WX0) / 2 + 0.02
for k, (px0, pz) in enumerate(((WX0, Z0 + 0.012), (WX0 + 0.06, Z0 - 0.02))):
    px1 = px0 + PW
    block(f"DormShojiPaper{k}", (px0 + 0.02, WY0 + 0.02, pz), (px1 - 0.02, WY1 - 0.02, pz + 0.004), "paper", 1.0)
    for nm, lo, hi in (("T", (px0, WY1 - 0.025, pz - 0.006), (px1, WY1, pz + 0.014)), ("B", (px0, WY0, pz - 0.006), (px1, WY0 + 0.03, pz + 0.014)),
                       ("L", (px0, WY0, pz - 0.006), (px0 + 0.022, WY1, pz + 0.014)), ("R", (px1 - 0.022, WY0, pz - 0.006), (px1, WY1, pz + 0.014))):
        block(f"DormShojiFrame{k}{nm}", lo, hi, "wood", 0.5)
    for j in range(1, 3):
        x = px0 + (px1 - px0) * j / 3
        block(f"DormShojiBarV{k}{j}", (x - 0.006, WY0, pz + 0.004), (x + 0.006, WY1, pz + 0.012), "wood", 0.5)
    for j in range(1, 5):
        y = WY0 + (WY1 - WY0) * j / 5
        block(f"DormShojiBarH{k}{j}", (px0, y - 0.006, pz + 0.004), (px1, y + 0.006, pz + 0.012), "wood", 0.5)

# ---------------------------------------------------------------------------------------------------- the closet (oshiire)
# (its inside back in the wall: a floor, a shelf half way, a back and sides; the futons folded on the shelf, boxes under it; two fusuma, the
# front one slid across the back one, the closet's front half open)
OX0 = X0 - 0.8
block("DormClosetBack", (OX0 - 0.03, 0.0, OZ0), (OX0, OY1, OZ1), "plaster", 1.0, group=LEFT_CUT)
block("DormClosetSideA", (OX0, 0.0, OZ0 - 0.03), (X0, OY1, OZ0), "plaster", 1.0, group=LEFT_CUT)
block("DormClosetSideB", (OX0, 0.0, OZ1), (X0, OY1, OZ1 + 0.03), "plaster", 1.0, group=LEFT_CUT)
block("DormClosetFloor", (OX0, 0.0, OZ0), (X0, 0.06, OZ1), "boards", 0.9)
block("DormClosetTop", (OX0, OY1 - 0.03, OZ0), (X0, OY1, OZ1), "boards", 0.9, group=LEFT_CUT)
block("DormClosetShelf", (OX0, 0.8, OZ0), (X0, 0.84, OZ1), "boards", 0.9)
block("DormClosetShelfFace", (X0 - 0.04, 0.78, OZ0), (X0, 0.86, OZ1), "wood", 0.5)
for k, (mat, h) in enumerate((("futon_b", 0.15), ("futon_p", 0.14), ("futon_b", 0.14), ("sheet", 0.07))):
    y0 = 0.84 + sum(hh for _, hh in (("futon_b", 0.15), ("futon_p", 0.14), ("futon_b", 0.14), ("sheet", 0.07))[:k])
    soft(f"DormStack{k}", (OX0 + 0.06 + 0.01 * k, y0, OZ1 - 1.05 + 0.01 * k), (X0 - 0.08 - 0.01 * k, y0 + h - 0.003, OZ1 - 0.05 - 0.01 * k), mat, r=0.03, tile=0.8)
soft("DormStackPillow", (OX0 + 0.25, 1.34, OZ1 - 0.75), (X0 - 0.3, 1.42, OZ1 - 0.35), "sheet", r=0.03, tile=0.5)
for k, z in enumerate((OZ1 - 0.95, OZ1 - 0.45)):
    block(f"DormClosetBox{k}", (OX0 + 0.08, 0.06, z), (X0 - 0.12, 0.42, z + 0.4), "box", 0.6)
for k, (pz0, px) in enumerate(((OZ0, X0 + 0.012), (OZ0 + 0.06, X0 + 0.034))):
    pz1 = pz0 + 0.92
    block(f"DormFusumaPanel{k}", (px - 0.008, 0.06, pz0 + 0.03), (px + 0.008, OY1 - 0.03, pz1 - 0.03), "fusuma", 1.0)
    for nm, lo, hi in (("T", (px - 0.012, OY1 - 0.04, pz0), (px + 0.012, OY1, pz1)), ("B", (px - 0.012, 0.06, pz0), (px + 0.012, 0.1, pz1)),
                       ("A", (px - 0.012, 0.06, pz0), (px + 0.012, OY1, pz0 + 0.03)), ("Z", (px - 0.012, 0.06, pz1 - 0.03), (px + 0.012, OY1, pz1))):
        block(f"DormFusumaFrame{k}{nm}", lo, hi, "lacquer", 0.5)
    block(f"DormFusumaPull{k}", (px + 0.008, 0.9, pz1 - 0.15), (px + 0.014, 0.96, pz1 - 0.09), "iron", 0.2)
for nm, lo, hi in (("T", (X0, OY1, OZ0 - 0.04), (X0 + 0.045, OY1 + 0.05, OZ1 + 0.04)), ("B", (X0, 0.0, OZ0 - 0.04), (X0 + 0.04, 0.06, OZ1 + 0.04))):
    block(f"DormClosetFrame{nm}", lo, hi, "wood", 0.6)

# ---------------------------------------------------------------------------------------------------- the chest, the television, the walls' things
# (the chest of drawers in the back left corner: four drawers, iron pulls, on a plinth)
CX0, CX1, CZ0, CZ1 = X0 + 0.02, X0 + 0.58, Z0 + 0.02, Z0 + 0.44
block("DormChest", (CX0, FLOOR, CZ0), (CX1, 0.95, CZ1), "wood", 0.5)
for k in range(4):
    y0, y1 = 0.1 + k * 0.21, 0.29 + k * 0.21
    block(f"DormChestFace{k}", (CX0 + 0.03, y0, CZ1), (CX1 - 0.03, y1, CZ1 + 0.012), "wood", 0.4)
    block(f"DormChestPull{k}", ((CX0 + CX1) / 2 - 0.05, (y0 + y1) / 2 - 0.01, CZ1 + 0.012), ((CX0 + CX1) / 2 + 0.05, (y0 + y1) / 2 + 0.01, CZ1 + 0.026), "iron", 0.2)
# (the television on its low stand right of the window: the stand's shelf with books, a flask on top; the set's screen and its foot)
VX0, VX1, VZ0, VZ1 = 0.12, 0.82, Z0 + 0.02, Z0 + 0.4
block("DormStandTop", (VX0, 0.4, VZ0), (VX1, 0.44, VZ1), "wood", 0.5)
block("DormStandShelf", (VX0 + 0.02, 0.2, VZ0), (VX1 - 0.02, 0.23, VZ1), "wood", 0.5)
for k, x in enumerate((VX0, VX1 - 0.03)):
    block(f"DormStandSide{k}", (x, FLOOR, VZ0), (x + 0.03, 0.4, VZ1), "wood", 0.5)
block("DormBooks", (VX0 + 0.06, 0.23, VZ0 + 0.06), (VX0 + 0.46, 0.38, VZ1 - 0.08), "spine", 0.4)
block("DormTvFoot", (0.4, 0.44, VZ0 + 0.12), (0.56, 0.46, VZ0 + 0.26), "tv", 0.3)
block("DormTvNeck", (0.46, 0.46, VZ0 + 0.17), (0.5, 0.52, VZ0 + 0.21), "tv", 0.3)
block("DormTvBody", (0.2, 0.5, VZ0 + 0.15), (0.76, 0.84, VZ0 + 0.2), "tv", 0.3)
block("DormTvScreen", (0.225, 0.52, VZ0 + 0.2), (0.735, 0.82, VZ0 + 0.204), "screen", 0.3)
lathe("DormFlask", 0.7, 0.44, VZ0 + 0.3, [(0.045, 0.0), (0.045, 0.2), (0.03, 0.24), (0.03, 0.27), (0.015, 0.28)], "flask", 12)
# (the calendar and the clock over the set; the work clothes on their hooks over the board floor: a happi coat and an apron)
block("DormCalendar", (0.24, 1.1, Z0 + 0.002), (0.66, 1.6, Z0 + 0.008), "cal", 0.5)
# (the clock: turned on its back to face out of the wall, its rim and its face)
for nm, prof, mat in (("DormClockRim", [(0.12, 0.0), (0.12, 0.035), (0.105, 0.035), (0.105, 0.03)], "lacquer"), ("DormClockFace", [(0.106, 0.0), (0.106, 0.031)], "clock")):
    o = lathe(nm, 0.0, 0.0, 0.0, prof, mat, 16)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = P(0.45, 1.86, Z0 + 0.004)
block("DormClockHandH", (0.448, 1.86, Z0 + 0.041), (0.456, 1.92, Z0 + 0.045), "dark", 0.2)
block("DormClockHandM", (0.452, 1.79, Z0 + 0.045), (0.46, 1.87, Z0 + 0.049), "dark", 0.2)
# (the work clothes: on hooks on the bathroom's door now, where they hung on the wall before it (item 427); built with the door below)
# (a waste bin at the mats' front right)
lathe("DormBin", TX1 - 0.2, FLOOR, Z1 - 0.2, [(0.11, 0.0), (0.13, 0.26), (0.125, 0.26), (0.105, 0.012)], "box", 16)

# ---------------------------------------------------------------------------------------------------- the table and the cushions
# (the round low table in the middle of the mats: its top on four legs; a teapot with its spout and handle, three cups, a caddy, mandarins)
TCX, TCZ, TR, TH = X0 + 1.35, Z0 + 1.35, 0.42, 0.34
lathe("DormTableTop", TCX, TH - 0.035, TCZ, [(TR - 0.01, 0.0), (TR, 0.012), (TR, 0.035), (TR - 0.01, 0.035)], "wood", 24, group="DormTable")
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    lx, lz = TCX + math.cos(a) * TR * 0.62, TCZ + math.sin(a) * TR * 0.62
    block(f"DormTableLeg{k}", (lx - 0.025, FLOOR, lz - 0.025), (lx + 0.025, TH - 0.035, lz + 0.025), "wood", 0.4, group="DormTable")
TEA = [("DormTeaPot", -0.12, -0.06, [(0.04, 0.0), (0.07, 0.03), (0.068, 0.08), (0.045, 0.1), (0.02, 0.11), (0.012, 0.125)], "tea", 16),
       ("DormCaddy", 0.18, -0.18, [(0.035, 0.0), (0.035, 0.1), (0.03, 0.102)], "tea", 12),
       ("DormBowl", 0.04, 0.16, [(0.05, 0.0), (0.09, 0.05), (0.08, 0.05), (0.045, 0.012)], "cup", 16)]
for nm, dx, dz, prof, mat, segs in TEA:
    lathe(nm, TCX + dx, TH, TCZ + dz, prof, mat, segs, group="DormTable")
block("DormTeaSpout", (TCX - 0.12 + 0.06, TH + 0.05, TCZ - 0.075), (TCX - 0.12 + 0.11, TH + 0.08, TCZ - 0.045), "tea", 0.2, group="DormTable")
block("DormTeaHandle", (TCX - 0.12 - 0.015, TH + 0.06, TCZ - 0.06 - 0.12), (TCX - 0.12 + 0.015, TH + 0.09, TCZ - 0.06 - 0.06), "tea", 0.2, group="DormTable")
for k, (dx, dz) in enumerate(((0.06, -0.2), (0.2, 0.02), (-0.16, 0.14))):
    lathe(f"DormCup{k}", TCX + dx, TH, TCZ + dz, [(0.022, 0.0), (0.032, 0.06), (0.027, 0.06), (0.02, 0.012)], "cup", 12, group="DormTable")
MIKAN = [(0.01, 0.0), (0.028, 0.012), (0.026, 0.036), (0.01, 0.048)]
for k in range(4):
    a = k * math.pi / 2 + 0.3
    lathe(f"DormMikan{k}", TCX + 0.04 + math.cos(a) * 0.035, TH + 0.035, TCZ + 0.16 + math.sin(a) * 0.035, MIKAN, "mikan", 8, group="DormTable")
lathe("DormMikanTop", TCX + 0.04, TH + 0.075, TCZ + 0.16, MIKAN, "mikan", 8, group="DormTable")
# (folded away: the table on its edge, its legs folded under, leaning on the low wall beside the stair over the board floor (it stood against
# the back wall there, where the bathroom's door is now, item 427), clear of the door and short of the stair's head; the tea things on the
# stand)
lathe("DormAwayTop", 0.0, 0.0, 0.0, [(TR - 0.01, 0.0), (TR, 0.012), (TR, 0.035), (TR - 0.01, 0.035)], "wood", 24, group="DormTableAway")
away_top = groups["DormTableAway"][-1]
away_top.rotation_euler = (0, math.radians(78), 0)
away_top.location = P(X1 - 0.11, TR + FLOOR, Z0 + 0.75)
for nm, dx, dz, prof, mat, segs in TEA[:1]:
    lathe("DormAwayTeaPot", 0.3, 0.44, VZ0 + 0.31, prof, mat, segs, group="DormTableAway")
# (three cushions round the table: on its left, its right and behind it, each turned to it)
SEATS = [(TCX - 0.62, TCZ + 0.08, "zab_r"), (TCX + 0.62, TCZ + 0.05, "zab_b"), (TCX + 0.02, TCZ - 0.62, "zab_r")]
for k, (sx, sz, mat) in enumerate(SEATS):
    soft(f"DormZabuton{k}", (sx - 0.27, FLOOR, sz - 0.29), (sx + 0.27, FLOOR + 0.07, sz + 0.29), mat, r=0.03, tile=0.5, bulge=0.025)

# ---------------------------------------------------------------------------------------------------- the futons laid out
# (for the night, two side by side, their heads to the back wall: the mattress, the quilt over all but the pillow's end, the pillow)
BEDS = [(X0 + 0.68, "futon_b"), (X0 + 1.82, "futon_p")]
for k, (bx, mat) in enumerate(BEDS):
    g = f"DormBedding{k}"
    soft(f"DormMattress{k}", (bx - 0.5, FLOOR, Z0 + 0.55), (bx + 0.5, FLOOR + 0.07, Z0 + 2.55), "sheet", r=0.03, tile=0.8, group=g)
    soft(f"DormQuilt{k}", (bx - 0.52, FLOOR + 0.07, Z0 + 0.98), (bx + 0.52, FLOOR + 0.16, Z0 + 2.58), mat, r=0.04, tile=0.8, group=g, bulge=0.03)
    soft(f"DormPillow{k}", (bx - 0.22, FLOOR + 0.07, Z0 + 0.62), (bx + 0.22, FLOOR + 0.15, Z0 + 0.92), "sheet", r=0.03, tile=0.5, group=g)

# ---------------------------------------------------------------------------------------------------- the lamp
# (a washi drum on a wooden ring top and bottom, on its cord; a pull string hanging under it)
LY = 1.62
lathe("DormLampShade", TCX, LY, TCZ, [(0.2, 0.0), (0.21, 0.04), (0.21, 0.24), (0.2, 0.28)], "lamp", 16)
lamp_o = parts[-1]
for k, y in enumerate((LY - 0.005, LY + 0.275)):
    lathe(f"DormLampRing{k}", TCX, y, TCZ, [(0.212, 0.0), (0.22, 0.004), (0.22, 0.016), (0.212, 0.02)], "lacquer", 16)
block("DormLampCord", (TCX - 0.005, LY + 0.29, TCZ - 0.005), (TCX + 0.005, H, TCZ + 0.005), "dark", 0.2)
block("DormLampPull", (TCX + 0.1 - 0.003, LY - 0.3, TCZ - 0.003), (TCX + 0.1 + 0.003, LY, TCZ + 0.003), "dark", 0.2)

# ---------------------------------------------------------------------------------------------------- the bathroom (items 427, 447, 451)
# (behind the back wall's right stretch, over the stair's head: x from BX0 to BX1, z from BZ0 back to BZ1 at the wall's back; plaster
# outside, as high as the room's, open to the sky as it is. Its left wall clear of the window by 30 cm of the house's back wall (item 451,
# the owner's 「窗台外看出去就是浴室?」: it stood against the window's edge, into it 5 cm). Japanese, as a house's is (item 447, the owner's
# 「衛浴設備是日式的哦！」): in from the room, the changing room with the toilet and the basin (洗面所とトイレ: a board floor; the toilet at
# its left end with its warm-water seat and its buttons, the basin on its cistern's lid, its paper, the slippers by the door; the basin's
# cabinet at its right, its mirror cabinet over it); a wall across behind it, the bath's frosted door in it straight on from the way in;
# behind that the bath (浴室) all across: white tiles, a mosaic floor a step down, the deep square hinoki tub at its left under its lid of
# boards, the washing place at its right (slatted boards, the stool facing the tap and the shower low on the back wall, the mirror over them,
# the three bottles on a rack by them, the bucket). Seen straight on through both doors; looked down on, the tub's open end and the tap;
# turned to the stair's side, the right wall and the wall across taken away (the cut), all of it)
BX0, BX1 = 0.4, X1
BZ1 = Z0 - WALL
BZ0 = BZ1 - 1.8
BF = FLOOR + 0.12
BW = BF - 0.03
# (the wall across: z from PZ0 to PZ1; the bath's doorway in it from DX0 to DX1, up to BDH2)
PZ0, PZ1 = BZ0 + 1.0, BZ0 + 1.05
DX0, DX1, BDH2 = 1.05, 1.63, BF + 1.8
# (its right wall, its cap and what hangs on it, and the wall across with all on it: a piece of their own, for the game to take away while
# the view's turned round to that side, as the room's left wall is (item 426); under the wall across a strip of the bath's floor)
BATH_CUT = "DormBathCut"
block("DormBathFloor", (BX0, 0.0, BZ0), (BX1, BW, PZ0), "bathfloor", 0.5)
block("DormBathMidFloor", (BX0, 0.0, PZ0), (BX1, BW, PZ1), "bathfloor", 0.5)
block("DormWashFloor", (BX0, 0.0, PZ1), (BX1, BF, BZ1), "boards", 0.9)
# (the bath's window (item 456, the owner's 「開個窗口」): a little frosted one high over the tub, as a house's bath's is, for its steam and
# its light: x from BWX0 to BWX1 over the tub (its taps, its shower's rail and its mirror off at the right, clear of it), y from BWY0 to BWY1)
BWX0, BWX1 = BX0 + 0.11, BX0 + 0.65
BWY0, BWY1 = BW + 1.02, BW + 1.47
# (its walls: the back (round the window: either side of it, under it, over it), the left, the right, each a slab of plaster; the wall
# across round the bath's doorway (its jambs 3 cm within))
for nm, lo, hi in (("Back", (BX0 - WALL, 0.0, BZ0 - WALL), (BWX0, H, BZ0)), ("BackR", (BWX1, 0.0, BZ0 - WALL), (BX1 + WALL, H, BZ0)),
                   ("BackB", (BWX0, 0.0, BZ0 - WALL), (BWX1, BWY0, BZ0)), ("BackT", (BWX0, BWY1, BZ0 - WALL), (BWX1, H, BZ0)),
                   ("Left", (BX0 - WALL, 0.0, BZ0), (BX0, H, BZ1)), ("Right", (BX1, 0.0, BZ0), (BX1 + WALL, H, BZ1))):
    block(f"DormBath{nm}Wall", lo, hi, "plaster", 1.2, group=BATH_CUT if nm == "Right" else None)
block("DormBathMidL", (BX0, 0.0, PZ0), (DX0 - 0.03, H, PZ1), "plaster", 1.2, group=BATH_CUT)
block("DormBathMidR", (DX1 + 0.03, 0.0, PZ0), (BX1, H, PZ1), "plaster", 1.2, group=BATH_CUT)
block("DormBathMidT", (DX0 - 0.03, BDH2 + 0.05, PZ0), (DX1 + 0.03, H, PZ1), "plaster", 1.2, group=BATH_CUT)
# (the bath's walls tiled: a skin 2 mm in front of each slab: its back, its left, its right (away with the wall), the wall across's back)
for nm, lo, hi in (("", (BX0, BW, BZ0), (BWX0, H, BZ0 + 0.002)), ("R", (BWX1, BW, BZ0), (BX1, H, BZ0 + 0.002)),
                   ("B", (BWX0, BW, BZ0), (BWX1, BWY0, BZ0 + 0.002)), ("T", (BWX0, BWY1, BZ0), (BWX1, H, BZ0 + 0.002))):
    block(f"DormBathSkinBack{nm}", lo, hi, "bathwall", 0.9)
# (the window in its hole: an aluminium frame in the wall's outer half; two frosted panes on their two tracks, the left behind, the right
# before it, overlapping at the middle, each its meeting stile; the hole's sides and head tiled in from the frame to the wall's face; a
# tiled sill under it, a little out into the bath, its top 4 mm over the wall's)
FZ0, FZ1, FB = BZ0 - 0.09, BZ0 - 0.04, 0.025
for nm, lo, hi in (("L", (BWX0 + 0.001, BWY0 + 0.001, FZ0), (BWX0 + FB, BWY1 - 0.001, FZ1)),
                   ("R", (BWX1 - FB, BWY0 + 0.001, FZ0), (BWX1 - 0.001, BWY1 - 0.001, FZ1)),
                   ("B", (BWX0 + FB, BWY0 + 0.001, FZ0), (BWX1 - FB, BWY0 + FB, FZ1)),
                   ("T", (BWX0 + FB, BWY1 - FB, FZ0), (BWX1 - FB, BWY1 - 0.001, FZ1))):
    block(f"DormBathWinFrame{nm}", lo, hi, "chrome", 0.2)
BWM = (BWX0 + BWX1) / 2
for k, (x0_, x1_, zz) in enumerate(((BWX0 + FB - 0.004, BWM + 0.02, FZ0 + 0.014), (BWM - 0.02, BWX1 - FB + 0.004, FZ0 + 0.03))):
    block(f"DormBathWinPane{k}", (x0_, BWY0 + FB - 0.004, zz), (x1_, BWY1 - FB + 0.004, zz + 0.005), "frostwin", 0.6)
    sx_ = (x1_ - 0.016, x1_) if k == 0 else (x0_, x0_ + 0.016)
    block(f"DormBathWinStile{k}", (sx_[0], BWY0 + FB - 0.004, zz - 0.004), (sx_[1], BWY1 - FB + 0.004, zz + 0.009), "chrome", 0.2)
for nm, lo, hi in (("L", (BWX0, BWY0 + 0.004, FZ1), (BWX0 + 0.003, BWY1, BZ0 + 0.002)),
                   ("R", (BWX1 - 0.003, BWY0 + 0.004, FZ1), (BWX1, BWY1, BZ0 + 0.002)),
                   ("T", (BWX0 + 0.003, BWY1 - 0.003, FZ1), (BWX1 - 0.003, BWY1, BZ0 + 0.002))):
    block(f"DormBathWinReveal{nm}", lo, hi, "bathwall", 0.9)
block("DormBathWinSill", (BWX0 - 0.03, BWY0 - 0.018, FZ1 + 0.005), (BWX1 + 0.03, BWY0 + 0.004, BZ0 + 0.04), "bathwall", 0.9)
block("DormBathSkinLeft", (BX0, BW, BZ0 + 0.002), (BX0 + 0.002, H, PZ0), "bathwall", 0.9)
block("DormBathSkinRight", (BX1 - 0.002, BW, BZ0 + 0.002), (BX1, H, PZ0), "bathwall", 0.9, group=BATH_CUT)
block("DormBathSkinMidL", (BX0 + 0.002, BW, PZ0 - 0.002), (DX0 - 0.03, H, PZ0), "bathwall", 0.9, group=BATH_CUT)
block("DormBathSkinMidR", (DX1 + 0.03, BW, PZ0 - 0.002), (BX1 - 0.002, H, PZ0), "bathwall", 0.9, group=BATH_CUT)
block("DormBathSkinMidT", (DX0 - 0.03, BDH2 + 0.05, PZ0 - 0.002), (DX1 + 0.03, H, PZ0), "bathwall", 0.9, group=BATH_CUT)
# (the tops of its walls capped, as the room's are seen from above; the sides' from the back's inner edge on, the wall across's between them)
for nm, lo, hi in (("Back", (BX0 - WALL - 0.004, H, BZ0 - WALL - 0.004), (BX1 + WALL + 0.004, H + 0.03, BZ0 + 0.004)),
                   ("Left", (BX0 - WALL - 0.004, H, BZ0 + 0.004), (BX0 + 0.004, H + 0.03, BZ1)),
                   ("Mid", (BX0 + 0.004, H, PZ0 - 0.004), (BX1 - 0.004, H + 0.03, PZ1 + 0.004)),
                   ("Right", (BX1 - 0.004, H, BZ0 + 0.004), (BX1 + WALL + 0.004, H + 0.03, BZ1))):
    block(f"DormBathCap{nm}", lo, hi, "wood", 0.6, group=BATH_CUT if nm in ("Right", "Mid") else None)
# (the doorway from the room: dark jambs and head through the wall; its sill up to the board floor)
for nm, lo, hi in (("L", (BD0 - 0.04, 0.0, Z0 - WALL - 0.004), (BD0, BDH, Z0 + 0.012)), ("R", (BD1, 0.0, Z0 - WALL - 0.004), (BD1 + 0.04, BDH, Z0 + 0.012)),
                   ("T", (BD0 - 0.04, BDH, Z0 - WALL - 0.004), (BD1 + 0.04, BDH + 0.05, Z0 + 0.012))):
    block(f"DormBathJamb{nm}", lo, hi, "lacquer", 0.5)
block("DormBathSill", (BD0, 0.0, Z0 - WALL), (BD1, BF, Z0 + 0.01), "wood", 0.5)
# (the bath's doorway in the wall across: hinoki jambs and head lining it (away with the wall), a lip across its foot a little over the board
# floor (it stays, the floor's))
for nm, lo, hi in (("L", (DX0 - 0.03, 0.0, PZ0 - 0.004), (DX0, BDH2, PZ1 + 0.004)), ("R", (DX1, 0.0, PZ0 - 0.004), (DX1 + 0.03, BDH2, PZ1 + 0.004)),
                   ("T", (DX0 - 0.03, BDH2, PZ0 - 0.004), (DX1 + 0.03, BDH2 + 0.05, PZ1 + 0.004))):
    block(f"DormBathInJamb{nm}", lo, hi, "hinoki", 0.6, group=BATH_CUT)
block("DormBathLip", (DX0, 0.0, PZ0), (DX1, BF + 0.012, PZ1 + 0.004), "hinoki", 0.6)
# (its door, slid open to the left along the wall across on the changing room's side: a hinoki frame round a frosted pane, on its rail)
DS0 = DX0 - 0.58
block("DormBathInDoor", (DS0, BF + 0.01, PZ1 + 0.006), (DS0 + 0.6, BDH2 - 0.012, PZ1 + 0.026), "hinoki", 0.6, group=BATH_CUT)
block("DormBathInPane", (DS0 + 0.06, BF + 0.09, PZ1 + 0.004), (DS0 + 0.54, BDH2 - 0.08, PZ1 + 0.028), "frost", 0.6, group=BATH_CUT)
block("DormBathInRail", (DS0 - 0.02, BDH2 - 0.01, PZ1 + 0.004), (DX1 + 0.03, BDH2 + 0.02, PZ1 + 0.03), "chrome", 0.2, group=BATH_CUT)

# (the tub: a deep square box of hinoki at the bath's left, its four boards' edges eased, a rim round its top a little proud of them; the
# water a hand under the rim; its lid of three boards across it, two over its front and the third laid on them, its back left open)
TX0, TX1, TZ0, TZ1 = BX0 + 0.03, BX0 + 0.73, BZ0 + 0.03, PZ0 - 0.03
TT, TW, RO, RT = BW + 0.58, 0.045, 0.008, 0.022
for nm, lo, hi in (("Front", (TX0, BW, TZ1 - TW), (TX1, TT, TZ1)), ("Back", (TX0, BW, TZ0), (TX1, TT, TZ0 + TW)),
                   ("Left", (TX0, BW, TZ0 + TW - 0.002), (TX0 + TW, TT, TZ1 - TW + 0.002)),
                   ("Right", (TX1 - TW, BW, TZ0 + TW - 0.002), (TX1, TT, TZ1 - TW + 0.002))):
    soft(f"DormTub{nm}", lo, hi, "hinoki", r=0.01, tile=0.6)
for nm, lo, hi in (("Front", (TX0 - RO, TT, TZ1 - TW - 0.004), (TX1 + RO, TT + RT, TZ1 + RO)),
                   ("Back", (TX0 - RO, TT, TZ0 - RO), (TX1 + RO, TT + RT, TZ0 + TW + 0.004)),
                   ("Left", (TX0 - RO, TT, TZ0 + TW + 0.004), (TX0 + TW + 0.004, TT + RT, TZ1 - TW - 0.004)),
                   ("Right", (TX1 - TW - 0.004, TT, TZ0 + TW + 0.004), (TX1 + RO, TT + RT, TZ1 - TW - 0.004))):
    block(f"DormTubRim{nm}", lo, hi, "hinoki", 0.6)
block("DormBathWater", (TX0 + TW + 0.002, TT - 0.13, TZ0 + TW + 0.002), (TX1 - TW - 0.002, TT - 0.128, TZ1 - TW - 0.002), "water", 1.0)
for k, (z1, y0) in enumerate(((TZ1 + RO, TT + RT), (TZ1 + RO - 0.3, TT + RT), (TZ1 + RO - 0.29, TT + RT + 0.022))):
    block(f"DormTubLid{k}", (TX0 - RO, y0, z1 - 0.3), (TX1 + RO, y0 + 0.022, z1), "hinoki", 0.6)

# (the washing place at the bath's right: slatted hinoki boards on two runners; the tap low on the back wall to sit at, its two knobs (the
# left's red dot hot), its spout; the shower's rail at its left, the shower on it, its hose; the mirror over the tap; a rack at its right
# with the three bottles; the stool facing the tap, the bucket by it)
WX0, WX1 = TX1 + RO + 0.022, BX1 - 0.02
for k, x0 in enumerate((WX0 + 0.06, WX1 - 0.1)):
    block(f"DormSunokoRun{k}", (x0, BW, BZ0 + 0.05), (x0 + 0.04, BW + 0.02, PZ0 - 0.05), "hinoki", 0.6)
SY = BW + 0.035
for k in range(9):
    z0 = BZ0 + 0.06 + k * 0.095
    block(f"DormSunoko{k}", (WX0, BW + 0.02, z0), (WX1, SY, z0 + 0.065), "hinoki", 0.6)
TAPX, WZ = (WX0 + WX1) / 2 + 0.03, BZ0 + 0.002
block("DormTapBar", (TAPX - 0.13, BW + 0.53, WZ), (TAPX + 0.13, BW + 0.57, WZ + 0.04), "chrome", 0.2)
for k, dx in enumerate((-0.15, 0.15)):
    soft(f"DormTapKnob{k}", (TAPX + dx - 0.03, BW + 0.515, WZ + 0.004), (TAPX + dx + 0.03, BW + 0.585, WZ + 0.05), "chrome", r=0.012, tile=0.2)
block("DormTapHot", (TAPX - 0.158, BW + 0.543, WZ + 0.05), (TAPX - 0.142, BW + 0.557, WZ + 0.053), "flask", 0.2)
block("DormTapSpout", (TAPX - 0.015, BW + 0.535, WZ + 0.04), (TAPX + 0.015, BW + 0.553, WZ + 0.15), "chrome", 0.2)
block("DormTapSpoutTip", (TAPX - 0.015, BW + 0.51, WZ + 0.13), (TAPX + 0.015, BW + 0.535, WZ + 0.15), "chrome", 0.2)
SRX = TAPX - 0.26
block("DormShowerRail", (SRX - 0.01, BW + 0.7, WZ), (SRX + 0.01, BW + 1.4, WZ + 0.02), "chrome", 0.2)
soft("DormShowerHead", (SRX - 0.04, BW + 1.12, WZ + 0.02), (SRX + 0.04, BW + 1.32, WZ + 0.07), "chrome", r=0.015, tile=0.2)
block("DormShowerHoseA", (TAPX - 0.096, BW + 0.3, WZ + 0.01), (TAPX - 0.08, BW + 0.53, WZ + 0.026), "chrome", 0.2)
block("DormShowerHoseB", (SRX + 0.014, BW + 0.3, WZ + 0.01), (TAPX - 0.08, BW + 0.316, WZ + 0.026), "chrome", 0.2)
block("DormShowerHoseC", (SRX + 0.014, BW + 0.316, WZ + 0.01), (SRX + 0.03, BW + 1.12, WZ + 0.026), "chrome", 0.2)
block("DormBathMirror", (TAPX - 0.14, BW + 0.68, WZ), (TAPX + 0.14, BW + 1.1, WZ + 0.004), "mirror", 0.6)
RKX0, RKX1, RKY = TAPX + 0.15, BX1 - 0.006, BW + 0.8
block("DormBathRack", (RKX0, RKY, WZ), (RKX1, RKY + 0.012, WZ + 0.09), "chrome", 0.2)
for k, mat in enumerate(("bottle_w", "bottle_g", "bottle_b")):
    bx_, bz_ = RKX0 + 0.024 + k * 0.047, WZ + 0.045
    lathe(f"DormBathBottle{k}", bx_, RKY + 0.012, bz_, [(0.021, 0.0), (0.022, 0.15), (0.012, 0.17), (0.009, 0.18)], mat, 8)
    block(f"DormBathPump{k}", (bx_ - 0.005, RKY + 0.192, bz_ - 0.005), (bx_ + 0.005, RKY + 0.212, bz_ + 0.005), "bottle_w", 0.2)
    block(f"DormBathPumpN{k}", (bx_ - 0.005, RKY + 0.204, bz_), (bx_ + 0.005, RKY + 0.212, bz_ + 0.03), "bottle_w", 0.2)
STX, STZ = TAPX, BZ0 + 0.42
for k, x0 in enumerate((STX - 0.12, STX + 0.095)):
    block(f"DormStoolLeg{k}", (x0, SY, STZ - 0.09), (x0 + 0.025, SY + 0.2, STZ + 0.09), "hinoki", 0.6)
soft("DormStoolSeat", (STX - 0.125, SY + 0.2, STZ - 0.1), (STX + 0.125, SY + 0.232, STZ + 0.1), "hinoki", r=0.008, tile=0.6, segs=1)
lathe("DormBucket", WX1 - 0.13, SY, STZ + 0.3, [(0.095, 0.0), (0.1, 0.008), (0.1065, 0.058), (0.1085, 0.06), (0.11, 0.08), (0.1088, 0.082),
                                                (0.112, 0.105), (0.103, 0.105), (0.09, 0.014), (0.03, 0.012)], "hinoki", 10,
      bands=["hinoki", "hinoki", "copper", "copper", "copper", "hinoki", "hinoki", "hinoki", "hinoki"])

# (the toilet at the changing room's left end, its cistern against the left wall, facing in toward the way in: the cistern with the basin on
# its lid and the basin's tap (the water that fills it running over your hands first); its bowl, a long round; its seat and its lid shut;
# the warm-water seat's works at its back, its buttons on an arm at its right (toward the room's wall))
WCZ = (PZ1 + BZ1) / 2 - 0.03
soft("DormWcTank", (BX0, BF + 0.36, WCZ - 0.2), (BX0 + 0.2, BF + 0.8, WCZ + 0.2), "frp", r=0.02, tile=0.6)
lathe("DormWcHand", BX0 + 0.1, BF + 0.8, WCZ, [(0.07, 0.0), (0.088, 0.015), (0.097, 0.045), (0.087, 0.045), (0.06, 0.022), (0.02, 0.018)],
      "frp", 12, sz=1.75)
lathe("DormWcTap", BX0 + 0.022, BF + 0.8, WCZ, [(0.01, 0.0), (0.009, 0.09), (0.012, 0.1)], "chrome", 8)
block("DormWcTapSpout", (BX0 + 0.02, BF + 0.885, WCZ - 0.009), (BX0 + 0.075, BF + 0.9, WCZ + 0.009), "chrome", 0.2)
lathe("DormWcBowl", BX0 + 0.43, BF, WCZ, [(0.12, 0.0), (0.105, 0.16), (0.15, 0.33), (0.165, 0.37)], "frp", 16, sx=1.3)
soft("DormWcBody", (BX0 + 0.2, BF + 0.37, WCZ - 0.17), (BX0 + 0.33, BF + 0.47, WCZ + 0.17), "frp", r=0.02, tile=0.6)
soft("DormWcSeat", (BX0 + 0.33, BF + 0.37, WCZ - 0.18), (BX0 + 0.66, BF + 0.395, WCZ + 0.18), "frp", r=0.012, tile=0.6, segs=1)
soft("DormWcLid", (BX0 + 0.335, BF + 0.395, WCZ - 0.172), (BX0 + 0.655, BF + 0.42, WCZ + 0.172), "frp", r=0.02, tile=0.6)
block("DormWcPanel", (BX0 + 0.36, BF + 0.39, WCZ + 0.18), (BX0 + 0.56, BF + 0.43, WCZ + 0.235), "frp", 0.6)
for k, (dx, mat) in enumerate(((0.39, "flask"), (0.44, "bathmat"), (0.49, "bathmat"))):
    block(f"DormWcButton{k}", (BX0 + dx, BF + 0.43, WCZ + 0.195), (BX0 + dx + 0.025, BF + 0.436, WCZ + 0.22), mat, 0.2)
# (the paper on the room's wall at its right, under its chrome cover; the slippers just in from the way in, toes to it, as they're left)
PX_ = BX0 + 0.5
block("DormWcPaperCover", (PX_ - 0.07, BF + 0.7, BZ1 - 0.13), (PX_ + 0.07, BF + 0.71, BZ1), "chrome", 0.2)
block("DormWcPaperLip", (PX_ - 0.07, BF + 0.665, BZ1 - 0.13), (PX_ + 0.07, BF + 0.7, BZ1 - 0.12), "chrome", 0.2)
for k, dx in enumerate((-0.065, 0.058)):
    block(f"DormWcPaperArm{k}", (PX_ + dx, BF + 0.625, BZ1 - 0.075), (PX_ + dx + 0.007, BF + 0.665, BZ1), "chrome", 0.2)
tube("DormWcPaper", BZ1 - 0.065, BF + 0.645, PX_ - 0.058, PX_ + 0.058, 0.052, "sheet", 10, axis="x")
for sd in (-1, 1):
    soft(f"DormWcSlipper{sd}", (BD0 + 0.08, BF, BZ1 - 0.21 + sd * 0.055 - 0.04), (BD0 + 0.3, BF + 0.025, BZ1 - 0.21 + sd * 0.055 + 0.04), "wcslipper",
         r=0.012, segs=1)

# (the basin at the changing room's right against the right wall: its cabinet on the floor (it stays as the wall's taken away), its two
# doors, a white bowl on its top and the tap behind it; the mirror cabinet over it, on the wall (away with it))
WZ0_, WZ1_ = BZ1 - 0.39, BZ1 - 0.05
soft("DormWashCabinet", (BX1 - 0.32, BF, WZ0_), (BX1 - 0.002, BF + 0.78, WZ1_), "frp", r=0.012, tile=0.6, segs=1)
block("DormWashSeam", (BX1 - 0.323, BF + 0.06, (WZ0_ + WZ1_) / 2 - 0.002), (BX1 - 0.32, BF + 0.7, (WZ0_ + WZ1_) / 2 + 0.002), "dark", 0.2)
for k, dz in enumerate((-0.03, 0.022)):
    block(f"DormWashPull{k}", (BX1 - 0.33, BF + 0.6, (WZ0_ + WZ1_) / 2 + dz), (BX1 - 0.32, BF + 0.68, (WZ0_ + WZ1_) / 2 + dz + 0.008), "chrome", 0.2)
LX, LZ = BX1 - 0.17, (WZ0_ + WZ1_) / 2
lathe("DormWashBowl", LX, BF + 0.78, LZ, [(0.05, 0.0), (0.1, 0.022), (0.125, 0.075), (0.116, 0.08), (0.085, 0.04), (0.035, 0.031)], "frp", 12)
lathe("DormWashTap", BX1 - 0.025, BF + 0.78, LZ, [(0.016, 0.0), (0.013, 0.14), (0.016, 0.15)], "chrome", 8)
block("DormWashSpout", (LX + 0.01, BF + 0.905, LZ - 0.01), (BX1 - 0.025, BF + 0.925, LZ + 0.01), "chrome", 0.2)
block("DormWashLever", (BX1 - 0.04, BF + 0.93, LZ - 0.01), (BX1 - 0.01, BF + 0.945, LZ + 0.01), "chrome", 0.2)
block("DormWashMirrorCab", (BX1 - 0.12, BF + 1.05, WZ0_), (BX1, BF + 1.72, WZ1_), "frp", 0.6, group=BATH_CUT)
block("DormWashMirror", (BX1 - 0.124, BF + 1.1, WZ0_ + 0.03), (BX1 - 0.12, BF + 1.67, WZ1_ - 0.03), "mirror", 0.6, group=BATH_CUT)
# (a hand towel on its ring by the bath's doorway, on the wall across at its right (away with it); the bath mat before the doorway)
block("DormBathTowelBar", (DX1 + 0.05, BF + 1.15, PZ1), (BX1 - 0.02, BF + 1.17, PZ1 + 0.045), "chrome", 0.2, group=BATH_CUT)
soft("DormBathTowel", (DX1 + 0.055, BF + 0.8, PZ1 + 0.012), (BX1 - 0.025, BF + 1.18, PZ1 + 0.05), "towel", r=0.012, tile=0.6, group=BATH_CUT)
soft("DormBathMat", (DX0 + 0.03, BF, PZ1 + 0.03), (DX1 - 0.03, BF + 0.012, PZ1 + 0.35), "bathmat", r=0.006, tile=0.6)

# ---------------------------------------------------------------------------------------------------- its door, sliding into the wall
# (a frosted pane in a dark frame over a solid lower panel, in the wall's middle, sliding left into the wall's pocket; the work clothes on
# two hooks on its room side: a piece of its own, the game slides it)
DZ = Z0 - WALL / 2
DOOR = "DormBathDoor"
block("DormBathDoorFrame", (BD0 - 0.002, BF, DZ - 0.016), (BD1 + 0.002, BDH - 0.004, DZ + 0.016), "lacquer", 0.5, group=DOOR)
block("DormBathDoorPane", (BD0 + 0.05, BF + 0.62, DZ - 0.018), (BD1 - 0.05, BDH - 0.06, DZ + 0.018), "frost", 0.6, group=DOOR)
block("DormBathDoorLow", (BD0 + 0.05, BF + 0.06, DZ - 0.018), (BD1 - 0.05, BF + 0.56, DZ + 0.018), "wood", 0.5, group=DOOR)
block("DormBathDoorPull", (BD1 - 0.09, BF + 0.85, DZ + 0.018), (BD1 - 0.07, BF + 1.05, DZ + 0.024), "iron", 0.2, group=DOOR)
for k, (x, mat, w, h) in enumerate(((BD0 + 0.18, "happi", 0.3, 0.72), (BD0 + 0.5, "apron", 0.3, 0.62))):
    block(f"DormHook{k}", (x - 0.012, 1.7, DZ + 0.016), (x + 0.012, 1.73, DZ + 0.042), "iron", 0.2, group=DOOR)
    soft(f"DormCloth{k}", (x - w / 2, 1.7 - h, DZ + 0.02), (x + w / 2, 1.7, DZ + 0.046), mat, r=0.012, tile=0.6, group=DOOR)

# ---------------------------------------------------------------------------------------------------- joined, named, marked
def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


room_parts = [o for o in parts if o is not lamp_o]
room = join(room_parts, "Dorm")
lamp_o.name = "DormLamp"
pieces = {name: join(objs, name) for name, objs in groups.items()}
root = bpy.data.objects.new("DormRoot", None)
bpy.context.collection.objects.link(root)
for o in [room, lamp_o, *pieces.values()]:
    o.parent = root
marks = []


def mark(name, x, y, z, yaw=0.0):
    e = bpy.data.objects.new(name, None)
    e.location = P(x, y, z)
    e.rotation_euler = (0, 0, yaw)
    marks.append(e)


mark("DormLook", TCX + 0.4, 0.6, TCZ)
for k, (sx, sz, _) in enumerate(SEATS):
    mark(f"DormSeat{k}", sx, FLOOR + 0.07, sz)
for k, (bx, _) in enumerate(BEDS):
    mark(f"DormBed{k}", bx, FLOOR + 0.07, Z0 + 0.8)
mark("DormStairTop", (SX0 + SX1) / 2, FLOOR, SZ0 - 0.25)
mark("DormStairFoot", (SX0 + SX1) / 2, FLOOR - RISE * 6, SZ0 + GO * 6)
for e in marks:
    bpy.context.collection.objects.link(e)
    e.parent = root
everything = [room, lamp_o, *pieces.values()]
print("DORM_TRIS", {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in everything})
export_dish(root, everything + [root] + marks, os.path.join(PROJECT, "public", "models", "dorm.glb"), os.path.join(PROJECT, "blender", "dorm.blend"), PREVIEW)
print("DORM_DONE")
