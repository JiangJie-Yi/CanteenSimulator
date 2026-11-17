"""The staff room upstairs (二樓員工休息室兼宿舍, dorm.glb; item 325, the owner's, 2026-11-18: 「然後捏個2F小房間，會切換場景，可以上樓去」):
a six-mat room over the shop, up the stair behind the staff door, where those who live in (the owner and the cooks) sleep and the crew
take their break. Seen as a doll's house is, from its open front: the back wall with its shoji window, the left wall with the store
room's fusuma and a tansu against it, the right wall low; on the mats a round low table (chabudai) with a pot of tea and a bowl of
mandarins, two cushions, the futons folded and stacked in the corner, a paper lamp hung over the table, a calendar; the stair coming up
through the floor at the front right, a rail round it.

- node "Dorm": the room, its foot's middle (the floor's middle) at the origin, its open front toward +z; metres.
- node "DormLook": an empty over the table, for the camera to look at.
- node "DormLamp": the lamp's shade (glowing, the game lights it).
- nodes "DormSeat0".."DormSeat2": empties where those living in sit (each facing the table), for the game to set them.

Low-poly (boxes and 16-round lathes, ladder caps); its pictures drawn here: the mats' rush weave, the plaster, the wood.

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
seed(325)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    """a colour as hex, made linear (a material's colour)"""
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# the room: six mats (3.6 by 2.7), its walls 2.4 high; the back wall at -z, the left at -x, the open front at +z
W, D, H = 3.6, 2.7, 2.4
X0, X1, Z0, Z1 = -W / 2, W / 2, -D / 2, D / 2
WALL = 0.1

# ---------------------------------------------------------------------------------------------------- pictures
N = 512
u, v = grid01(N)
# (the mats' rush (igusa): fine lines across the mat, its green gone straw with years, a little uneven)
rush = np.sin(v * 2 * math.pi * 120 + (fbm(N, 2, 8, 3) - 0.5) * 2) * 0.5 + 0.5
tatami = mix((0.74, 0.70, 0.48), (0.62, 0.58, 0.38), smooth(0.4, 1.0, rush) * 0.6)
tatami = tatami * (0.93 + 0.1 * fbm(N, 6, 3, 3))[..., None]
# (the mats' borders: dark indigo cloth with a fine weave)
heri = mix((0.12, 0.14, 0.22), (0.18, 0.2, 0.3), smooth(0.5, 1.0, np.sin(u * 2 * math.pi * 200) * 0.5 + 0.5) * 0.5)
# (the plaster: warm, mottled)
plaster = mix((0.92, 0.88, 0.8), (0.86, 0.81, 0.72), fbm(N, 8, 8, 4) * 0.7)
# (the wood: a warm honey grain along u)
grain = np.sin((v * 34 + (fbm(N, 2, 10, 3) - 0.5) * 2.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.62, 0.44, 0.27), (0.48, 0.32, 0.19), smooth(0.6, 1.0, grain) * 0.7) * (0.94 + 0.08 * fbm(N, 3, 3, 3))[..., None]
# (the shoji's paper, and the fusuma's: a pale pattern of waves on cream)
paper = mix((0.97, 0.95, 0.9), (0.93, 0.9, 0.84), fbm(N, 10, 10, 4) * 0.5)
fusuma = mix((0.9, 0.86, 0.76), (0.82, 0.76, 0.62), (np.sin(np.hypot((u % 0.25) - 0.125, (v % 0.25) + 0.05) * 90) * 0.5 + 0.5) ** 6 * 0.5)
# (the futons: a deep blue with white kasuri marks, a pink with small flowers, a white sheet)
kas = smooth(0.88, 0.94, vnoise(N, 60, 30))
futon_b = mix((0.16, 0.26, 0.5), (0.92, 0.92, 0.95), kas * 0.85)
flow = smooth(0.85, 0.9, vnoise(N, 40, 40))
futon_p = mix((0.9, 0.62, 0.66), (0.98, 0.95, 0.9), flow * 0.8)
M = {
    "tatami": pbr("DormTatami", (1, 1, 1), tex=image("dorm_tatami", np.clip(tatami, 0, 1).astype(np.float32)), rough=0.8),
    "heri": pbr("DormHeri", (1, 1, 1), tex=image("dorm_heri", np.clip(heri, 0, 1).astype(np.float32)), rough=0.8),
    "plaster": pbr("DormPlaster", (1, 1, 1), tex=image("dorm_plaster", np.clip(plaster, 0, 1).astype(np.float32)), rough=0.9),
    "wood": pbr("DormWood", (1, 1, 1), tex=image("dorm_wood", np.clip(wood, 0, 1).astype(np.float32)), rough=0.6),
    "paper": pbr("DormPaper", (1, 1, 1), tex=image("dorm_paper", np.clip(paper, 0, 1).astype(np.float32)), rough=0.9),
    "fusuma": pbr("DormFusuma", (1, 1, 1), tex=image("dorm_fusuma", np.clip(fusuma, 0, 1).astype(np.float32)), rough=0.9),
    "futon_b": pbr("DormFutonBlue", (1, 1, 1), tex=image("dorm_futon_b", np.clip(futon_b, 0, 1).astype(np.float32)), rough=0.9),
    "futon_p": pbr("DormFutonPink", (1, 1, 1), tex=image("dorm_futon_p", np.clip(futon_p, 0, 1).astype(np.float32)), rough=0.9),
    "sheet": pbr("DormSheet", lin("#f2efe8"), rough=0.9),
    "dark": pbr("DormDark", lin("#2a2420"), rough=0.6),
    "zabuton": pbr("DormZabuton", lin("#8a3a2e"), rough=0.9),
    "tea": pbr("DormTeaPot", lin("#4a5a48"), rough=0.4),
    "cup": pbr("DormCup", lin("#efe8da"), rough=0.4),
    "mikan": pbr("DormMikan", lin("#f08a2a"), rough=0.6),
    "lamp": pbr("DormLampShade", lin("#fff1d6"), rough=0.9, emit=lin("#ffd9a0"), emit_strength=0.6),
    "cal": pbr("DormCalendar", lin("#f4f0e6"), rough=0.9),
    "calred": pbr("DormCalendarRed", lin("#b8342a"), rough=0.9),
    "rail": pbr("DormRail", lin("#5a3a22"), rough=0.6),
}

parts = []


def box_uv(o, tile):
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


def block(name, lo, hi, mat, tile=1.0):
    """a box from `lo` to `hi` (the game's frame), its picture laid at `tile` metres"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(lo) + Vector(hi)) / 2
    s = Vector(hi) - Vector(lo)
    for vv in bm.verts:
        vv.co = P(c.x + vv.co.x * s.x, c.y + vv.co.y * s.y, c.z + vv.co.z * s.z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    box_uv(o, tile)
    parts.append(o)
    return o


def lathe(name, x, y, z, prof, mat, segs=16):
    """a round thing turned on its upright axis at (x, y, z): `prof` its (radius, height) from its foot up"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = [[bm.verts.new(P(x + r * math.cos(2 * math.pi * k / segs), y + h, z + r * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
             for r, h in prof]
    for i in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            for loop, (uu, vv) in zip(f.loops, ((k / segs, i / len(rings)), ((k + 1) / segs, i / len(rings)),
                                                ((k + 1) / segs, (i + 1) / len(rings)), (k / segs, (i + 1) / len(rings)))):
                loop[uvl].uv = (uu, vv)
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
    o.data.materials.append(M[mat])
    for p_ in o.data.polygons:
        p_.use_smooth = len(p_.vertices) == 4
    parts.append(o)
    return o


# ---------------------------------------------------------------------------------------------------- the room
# (the floor: six mats, three along, two across; each its border along its long sides; under them a board floor's edge)
block("DormFloorBase", (X0, -0.06, Z0), (X1, -0.002, Z1), "wood", 0.8)
MW, ML = W / 3, D / 2            # (each mat 1.2 by 1.35: six to the room)
for i in range(3):
    for j in range(2):
        x0, x1 = X0 + i * MW + 0.004, X0 + (i + 1) * MW - 0.004
        z0, z1 = Z0 + j * ML + 0.004, Z0 + (j + 1) * ML - 0.004
        block(f"DormMat{i}{j}", (x0 + 0.03, 0.0, z0), (x1 - 0.03, 0.055, z1), "tatami", 0.9)
        for sx, (a, b) in enumerate(((x0, x0 + 0.03), (x1 - 0.03, x1))):
            block(f"DormHeri{i}{j}{sx}", (a, 0.0, z0), (b, 0.056, z1), "heri", 0.3)
# (the walls: the back and the left full height, the right one low (seen over), a skirting board and a rail high round them)
block("DormWallBack", (X0 - WALL, 0.0, Z0 - WALL), (X1 + WALL, H, Z0), "plaster", 1.2)
block("DormWallLeft", (X0 - WALL, 0.0, Z0), (X0, H, Z1), "plaster", 1.2)
block("DormWallRight", (X1, 0.0, Z0), (X1 + WALL, 0.9, Z1), "plaster", 1.2)
for nm, lo, hi in (("Back", (X0, 0.056, Z0), (X1, 0.13, Z0 + 0.012)), ("Left", (X0, 0.056, Z0 + 0.012), (X0 + 0.012, 0.13, Z1)),
                   ("BackRail", (X0, H - 0.42, Z0), (X1, H - 0.36, Z0 + 0.02)), ("LeftRail", (X0, H - 0.42, Z0 + 0.02), (X0 + 0.02, H - 0.36, Z1))):
    block(f"DormTrim{nm}", lo, hi, "wood", 0.6)
block("DormRightCap", (X1 - 0.004, 0.9, Z0), (X1 + WALL + 0.004, 0.94, Z1), "wood", 0.6)
# (the shoji window in the back wall: its frame and its grid over the paper, a little proud of the wall)
WX0, WX1, WY0, WY1 = -0.75, 0.75, 0.85, 1.75
block("DormWindowPaper", (WX0, WY0, Z0 + 0.004), (WX1, WY1, Z0 + 0.008), "paper", 1.0)
for nm, lo, hi in (("T", (WX0 - 0.04, WY1, Z0), (WX1 + 0.04, WY1 + 0.04, Z0 + 0.04)), ("B", (WX0 - 0.04, WY0 - 0.04, Z0), (WX1 + 0.04, WY0, Z0 + 0.05)),
                   ("L", (WX0 - 0.04, WY0, Z0), (WX0, WY1, Z0 + 0.04)), ("R", (WX1, WY0, Z0), (WX1 + 0.04, WY1, Z0 + 0.04))):
    block(f"DormWindowFrame{nm}", lo, hi, "wood", 0.6)
for k in range(1, 6):
    x = WX0 + (WX1 - WX0) * k / 6
    block(f"DormWindowBarV{k}", (x - 0.008, WY0, Z0 + 0.008), (x + 0.008, WY1, Z0 + 0.02), "wood", 0.6)
for k in range(1, 4):
    y = WY0 + (WY1 - WY0) * k / 4
    block(f"DormWindowBarH{k}", (WX0, y - 0.008, Z0 + 0.008), (WX1, y + 0.008, Z0 + 0.02), "wood", 0.6)
# (the store room's fusuma in the left wall: two panels in a frame)
FZ0, FZ1, FY1 = Z0 + 0.35, Z0 + 0.35 + 1.5, 1.8
block("DormFusuma", (X0 + 0.004, 0.06, FZ0), (X0 + 0.024, FY1, FZ1), "fusuma", 1.0)
for nm, lo, hi in (("T", (X0, FY1, FZ0 - 0.04), (X0 + 0.04, FY1 + 0.05, FZ1 + 0.04)), ("A", (X0, 0.06, FZ0 - 0.04), (X0 + 0.04, FY1, FZ0)),
                   ("Z", (X0, 0.06, FZ1), (X0 + 0.04, FY1, FZ1 + 0.04)), ("M", (X0 + 0.024, 0.06, (FZ0 + FZ1) / 2 - 0.012), (X0 + 0.036, FY1, (FZ0 + FZ1) / 2 + 0.012))):
    block(f"DormFusumaFrame{nm}", lo, hi, "wood", 0.6)
for k, z in enumerate((FZ0 + 0.12, FZ1 - 0.12)):
    block(f"DormFusumaPull{k}", (X0 + 0.024, 0.95, z - 0.03), (X0 + 0.03, 1.03, z + 0.03), "dark", 0.2)
# (the tansu against the left wall, by the front: two drawers over two doors, dark iron pulls)
TX0, TX1, TZ0, TZ1 = X0 + 0.004, X0 + 0.45, Z1 - 0.95, Z1 - 0.15
block("DormTansu", (TX0, 0.056, TZ0), (TX1, 1.05, TZ1), "wood", 0.5)
for k, (y0, y1) in enumerate(((0.8, 1.0), (0.58, 0.78), (0.1, 0.56))):
    block(f"DormTansuFace{k}", (TX1, y0, TZ0 + 0.03), (TX1 + 0.012, y1, TZ1 - 0.03), "wood", 0.4)
    block(f"DormTansuPull{k}", (TX1 + 0.012, (y0 + y1) / 2 - 0.012, (TZ0 + TZ1) / 2 - 0.06), (TX1 + 0.024, (y0 + y1) / 2 + 0.012, (TZ0 + TZ1) / 2 + 0.06), "dark", 0.2)
# (the stair coming up through the floor at the front right: its hole a dark well, a rail round its open sides)
SX0, SX1, SZ0, SZ1 = X1 - 0.95, X1 - 0.05, Z1 - 1.25, Z1 - 0.02
block("DormStairWell", (SX0, 0.0, SZ0), (SX1, 0.058, SZ1), "dark", 1.0)
for k in range(4):
    y = 0.03 - 0.0 * k
    block(f"DormStairTread{k}", (SX0 + 0.02, y - 0.004, SZ0 + 0.05 + k * 0.28), (SX1 - 0.02, y + 0.0 + 0.002, SZ0 + 0.05 + k * 0.28 + 0.22), "wood", 0.6)
for nm, lo, hi in (("PostA", (SX0 - 0.04, 0.056, SZ0 - 0.04), (SX0, 0.9, SZ0)), ("PostB", (SX0 - 0.04, 0.056, SZ1 - 0.04), (SX0, 0.9, SZ1)),
                   ("RailL", (SX0 - 0.035, 0.86, SZ0), (SX0 - 0.005, 0.9, SZ1 - 0.04)), ("RailB", (SX0, 0.86, SZ0 - 0.035), (SX1, 0.9, SZ0 - 0.005)),
                   ("PostC", (SX1 - 0.0, 0.056, SZ0 - 0.04), (SX1 + 0.04, 0.9, SZ0))):
    block(f"DormStair{nm}", lo, hi, "rail", 0.4)
# (the futons folded and stacked in the back left corner: a blue one, a pink one, the sheets and a pillow on top)
FX, FZ = X0 + 0.65, Z0 + 0.5
for k, (mat, h) in enumerate((("futon_b", 0.16), ("futon_p", 0.14), ("futon_b", 0.14), ("sheet", 0.06))):
    y0 = 0.056 + sum(hh for _, hh in (("futon_b", 0.16), ("futon_p", 0.14), ("futon_b", 0.14), ("sheet", 0.06))[:k])
    block(f"DormFuton{k}", (FX - 0.5 + 0.01 * k, y0, FZ - 0.35 + 0.01 * k), (FX + 0.5 - 0.01 * k, y0 + h - 0.004, FZ + 0.35 - 0.01 * k), mat, 0.8)
block("DormPillow", (FX - 0.22, 0.056 + 0.5, FZ - 0.14), (FX + 0.22, 0.056 + 0.58, FZ + 0.14), "sheet", 0.5)
# (the low table in the middle of the room: a round top on four short legs; on it a pot of tea, two cups and a bowl of mandarins)
CX, CZ, CR, CH = 0.15, 0.1, 0.42, 0.34
lathe("DormTableTop", CX, CH - 0.03, CZ, [(CR, 0.0), (CR, 0.03)], "wood", 24)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    lx, lz = CX + math.cos(a) * CR * 0.62, CZ + math.sin(a) * CR * 0.62
    block(f"DormTableLeg{k}", (lx - 0.025, 0.056, lz - 0.025), (lx + 0.025, CH - 0.03, lz + 0.025), "wood", 0.4)
lathe("DormTeaPot", CX - 0.12, CH, CZ - 0.05, [(0.05, 0.0), (0.07, 0.04), (0.06, 0.09), (0.03, 0.11), (0.0, 0.12)], "tea", 16)
for k, (dx, dz) in enumerate(((0.06, -0.14), (0.16, 0.0))):
    lathe(f"DormCup{k}", CX + dx, CH, CZ + dz, [(0.022, 0.0), (0.03, 0.05), (0.0, 0.05)], "cup", 12)
lathe("DormBowl", CX + 0.02, CH, CZ + 0.15, [(0.05, 0.0), (0.09, 0.05), (0.0, 0.05)], "cup", 16)
for k in range(4):
    a = k * math.pi / 2 + 0.3
    lathe(f"DormMikan{k}", CX + 0.02 + math.cos(a) * 0.035, CH + 0.035, CZ + 0.15 + math.sin(a) * 0.035,
          [(0.0, 0.0), (0.024, 0.008), (0.03, 0.025), (0.024, 0.042), (0.0, 0.048)], "mikan", 10)
lathe("DormMikanTop", CX + 0.02, CH + 0.075, CZ + 0.15, [(0.0, 0.0), (0.024, 0.008), (0.03, 0.025), (0.024, 0.042), (0.0, 0.048)], "mikan", 10)
# (two cushions by the table, toward the front)
for k, (zx, zz) in enumerate(((CX - 0.5, CZ + 0.45), (CX + 0.55, CZ + 0.4))):
    block(f"DormZabuton{k}", (zx - 0.26, 0.056, zz - 0.28), (zx + 0.26, 0.11, zz + 0.28), "zabuton", 0.5)
# (the paper lamp over the table on its cord)
lathe("DormLampShade", CX, 1.55, CZ, [(0.0, 0.0), (0.16, 0.04), (0.2, 0.16), (0.16, 0.3), (0.0, 0.34)], "lamp", 16)
block("DormLampCord", (CX - 0.006, 1.89, CZ - 0.006), (CX + 0.006, H, CZ + 0.006), "dark", 0.2)
# (a calendar on the back wall, by the window: its paper and a red band at its head)
block("DormCalendar", (WX1 + 0.35, 0.95, Z0 + 0.003), (WX1 + 0.75, 1.5, Z0 + 0.008), "cal", 0.5)
block("DormCalendarHead", (WX1 + 0.35, 1.42, Z0 + 0.008), (WX1 + 0.75, 1.5, Z0 + 0.012), "calred", 0.5)

# (all of it one node of its own name; the lamp's shade apart, for the game to light; the marks)
lamp_o = next(o for o in parts if o.name == "DormLampShade")
room_parts = [o for o in parts if o is not lamp_o]
bpy.ops.object.select_all(action="DESELECT")
for o in room_parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = room_parts[0]
bpy.ops.object.join()
room = bpy.context.view_layer.objects.active
room.name = "Dorm"
lamp_o.name = "DormLamp"
root = bpy.data.objects.new("DormRoot", None)
bpy.context.collection.objects.link(root)
room.parent = root
lamp_o.parent = root
marks = []
look = bpy.data.objects.new("DormLook", None)
look.location = P(CX, 0.6, CZ)
marks.append(look)
for k, (sx, sz, face) in enumerate(((CX - 0.5, CZ + 0.45, 0.0), (CX + 0.55, CZ + 0.4, 0.0), (CX + 0.05, CZ - 0.55, 0.0))):
    e = bpy.data.objects.new(f"DormSeat{k}", None)
    e.location = P(sx, 0.11, sz)
    marks.append(e)
for e in marks:
    bpy.context.collection.objects.link(e)
    e.parent = root
print("DORM_TRIS", sum(len(p.vertices) - 2 for p in room.data.polygons) + sum(len(p.vertices) - 2 for p in lamp_o.data.polygons))
export_dish(root, [room, lamp_o, root] + marks, os.path.join(PROJECT, "public", "models", "dorm.glb"), os.path.join(PROJECT, "blender", "dorm.blend"), PREVIEW)
print("DORM_DONE")
