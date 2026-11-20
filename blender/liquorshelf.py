"""The premium liquor's hanging cabinet over the kitchen's far side (liquorshelf.glb; item 443, the owner's, 2026-11-21: 「上面新增系統櫃壩台，
專門放高級酒」, a red box round the dark space over the kitchen, from the left to the drinks fridges, seen from the customers' side).

A long built-in cabinet of dark walnut hung on four black rods over the plate racks, the freezer and the sink (nothing stands under it on the
floor: those are there), open to the customers: three bays, two levels, a strip of warm LED under the top and under the shelf at the front
of each bay (their own light: no lamp added), its back panel walnut washed warm under each strip (painted in its picture). In it the shop's
better bottles: on the floor of each bay four isshobin (1.8 L: daiginjo, junmai, honjozo), on its shelf five more (yongobin of ginjo,
a shochu's stout bottle, a squared whisky, a round umeshu). Each bottle a lathe of eight sides (the whisky's four), its glass's colour and its
cap's in its points' colour (one material); its label a band round the front of its body on its own cell of one picture the game paints
(LIQUOR_LABELS in the game, the cells in the order here: bay by bay, the floor's four then the shelf's five).

Nodes: "LiquorCabinet" (its boards LiquorWood, its back LiquorBack, the strips LiquorLED, the rods LiquorRod), "LiquorBottles"
(LiquorGlass, its colours in its points), "LiquorLabels" (LiquorLabel, the game's picture). The game's frame, in the bar's units: x along
the cabinet, y up, z out to its open front; the middle of its back's foot at the origin. About 2,800 triangles all told, a bottle about 100.

Run:
    blender -b --factory-startup --python blender/liquorshelf.py -- <project path> [preview.png]
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
seed(443)
RS = np.random.default_rng(443)


def P(x, y, z):
    """the game's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


L, H, D, T = 4.35, 0.95, 0.32, 0.03     # its length, height, depth; its boards' thickness
BAYS = 3
SHELF_Y = 0.5                            # the shelf's top in each bay
ROD_UP = 1.4                             # how far up its rods run (out of the room's top)
COLS, ROWS = 8, 4                        # the labels' picture's cells

# ---------------------------------------------------------------- pictures
# (walnut: a dark brown, its grain running along the cabinet, a band of lighter figure now and then)
N = 512
u, v = grid01(N)
grain = np.sin((v * 38 + (fbm(N, 3, 9, 4) - 0.5) * 2.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.20, 0.11, 0.06), (0.11, 0.058, 0.03), smooth(0.4, 1.0, grain) * 0.85)
wood = mix(wood, (0.27, 0.15, 0.08), smooth(0.72, 0.95, fbm(N, 2, 7, 4)) * 0.3)
wood = wood * (0.92 + 0.1 * fbm(N, 4, 24, 3))[..., None]
WOOD_TEX = image("liquor_walnut", np.clip(wood, 0, 1).astype(np.float32))
WOOD_NRM = image("liquor_walnut_nrm", to_normal(grain * 0.6 + fbm(N, 6, 30, 3) * 0.4, 1.0).astype(np.float32), data=True)
# (the back panel, up its height (its picture's v from its foot to its top): walnut washed warm under each strip, brightest just under it,
# fading down the bay; the grain as the boards')
BH = 512
bv = (np.arange(BH, dtype=np.float32) + 0.5) / BH
yb = bv * H
glow = np.zeros(BH, np.float32)
for top in (SHELF_Y - 0.025, H - T):
    d = top - yb
    glow = np.maximum(glow, np.where(d > 0, np.exp(-d / 0.12), 0.0))
back = wood[:BH, :, :] * (0.8 + 1.4 * glow[:, None, None]) + np.array([0.32, 0.17, 0.05], np.float32) * glow[:, None, None] * 0.9
BACK_TEX = image("liquor_back", np.clip(back, 0, 1).astype(np.float32))

M = {
    "wood": pbr("LiquorWood", (1, 1, 1), tex=WOOD_TEX, nrm=WOOD_NRM, nrm_strength=0.5, rough=0.45),
    "back": pbr("LiquorBack", (1, 1, 1), tex=BACK_TEX, rough=0.6),
    "led": pbr("LiquorLED", (1.0, 0.86, 0.62), rough=0.4, emit=(1.0, 0.86, 0.62), emit_strength=3.0),
    "rod": pbr("LiquorRod", (0.05, 0.05, 0.055), rough=0.35, metal=0.8),
    "glass": pbr("LiquorGlass", (1, 1, 1), rough=0.08),
    "label": pbr("LiquorLabel", (1, 1, 1), rough=0.7),
}
parts = []


def srgb(h):
    """a hex colour as the points' colours take it: as it's written (the exporter makes it linear)"""
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ---------------------------------------------------------------- the cabinet: its boards, its back, its strips, its rods
cab = bmesh.new()
CL = {"uv": cab.loops.layers.uv.new("UVMap")}


def board(lo, hi, mat, tile=0.6, along="x"):
    """a box from lo to hi (the game's frame), its picture laid on each face at world size, the grain along `along`"""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    vs = {(i, j, k): cab.verts.new(P(x1 if i else x0, y1 if j else y0, z1 if k else z0)) for i in (0, 1) for j in (0, 1) for k in (0, 1)}
    mid = Vector(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    for q, ax in (((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), "z"), (((1, 0, 0), (0, 0, 0), (0, 1, 0), (1, 1, 0)), "z"), \
                 (((0, 1, 1), (1, 1, 1), (1, 1, 0), (0, 1, 0)), "y"), (((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), "y"), \
                 (((1, 0, 1), (1, 0, 0), (1, 1, 0), (1, 1, 1)), "x"), (((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)), "x"):
        f = cab.faces.new([vs[k] for k in q])
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - mid) < 0:
            f.normal_flip()
        f.material_index = mat
        for lp in f.loops:
            c = lp.vert.co
            gx, gy, gz = c.x, c.z, -c.y
            a, b = {"z": (gx, gy), "y": (gx, gz), "x": (gz, gy)}[ax]
            if along == "y":
                a, b = b, a
            lp[CL["uv"]].uv = (a / tile, b / tile)


MAT = {"wood": 0, "back": 1, "led": 2, "rod": 3}
x0, x1 = -L / 2, L / 2
# (its top, its floor, its two ends; the dividers between its bays; the shelf in each bay)
board((x0, H - T, 0.0), (x1, H, D), MAT["wood"])
board((x0, 0.0, 0.0), (x1, 0.035, D), MAT["wood"])
for xe in (x0, x1 - T):
    board((xe, 0.035, 0.0), (xe + T, H - T, D), MAT["wood"], along="y")
bay_w = L / BAYS
dividers = [x0 + bay_w * k for k in range(1, BAYS)]
for xd in dividers:
    board((xd - T / 2, 0.035, 0.015), (xd + T / 2, H - T, D), MAT["wood"], along="y")
bays = [(x0 + (T if k == 0 else T / 2) + bay_w * k, x0 + bay_w * (k + 1) - (T if k == BAYS - 1 else T / 2)) for k in range(BAYS)]
for a, b in bays:
    board((a + 0.002, SHELF_Y - 0.025, 0.015), (b - 0.002, SHELF_Y, D - 0.004), MAT["wood"])
# (the back: a board across the whole of it, its face the washed picture: v up its height, u along at the grain's size)
board((x0 + T, 0.035, 0.0), (x1 - T, H - T, 0.015), MAT["wood"])
bq = [cab.verts.new(P(x, y, 0.0155)) for x, y in ((x0 + T, 0.035), (x1 - T, 0.035), (x1 - T, H - T), (x0 + T, H - T))]
f = cab.faces.new(bq)
f.normal_update()
if f.normal.dot(Vector(P(0, 0, 1)) - Vector(P(0, 0, 0))) < 0:
    f.normal_flip()
f.material_index = MAT["back"]
for lp in f.loops:
    c = lp.vert.co
    lp[CL["uv"]].uv = (c.x / 0.6, c.z / H)
# (the strips: under the top and under the shelf at the front of each bay, a centimetre in from its edge, their light their own)
for a, b in bays:
    for y in (H - T - 0.009, SHELF_Y - 0.025 - 0.009):
        board((a + 0.02, y, D - 0.03), (b - 0.02, y + 0.008, D - 0.018), MAT["led"])
# (the rods up from its top, two over each end bay and the middle's dividers: thin, black, up out of the room)
for xr in (x0 + 0.25, dividers[0], dividers[-1], x1 - 0.25):
    segs = 6
    ring0 = [cab.verts.new(P(xr + 0.007 * math.cos(2 * math.pi * k / segs), H, D / 2 + 0.007 * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    ring1 = [cab.verts.new(P(xr + 0.007 * math.cos(2 * math.pi * k / segs), H + ROD_UP, D / 2 + 0.007 * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    c0 = Vector(P(xr, H, D / 2))
    for k in range(segs):
        j = (k + 1) % segs
        f = cab.faces.new((ring0[k], ring0[j], ring1[j], ring1[k]))
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - Vector(P(xr, H + ROD_UP / 2, D / 2))) < 0:
            f.normal_flip()
        f.material_index = MAT["rod"]
        for lp in f.loops:
            lp[CL["uv"]].uv = (0.5, 0.5)
me = bpy.data.meshes.new("LiquorCabinet")
cab.to_mesh(me)
cab.free()
cab_o = bpy.data.objects.new("LiquorCabinet", me)
bpy.context.collection.objects.link(cab_o)
for k in ("wood", "back", "led", "rod"):
    cab_o.data.materials.append(M[k])
parts.append(cab_o)

# ---------------------------------------------------------------- the bottles
# (each kind's profile up its height (radius, height), its glass's colours to choose from, its caps', its label's band (from, to up it),
# its sides (the whisky's square))
KINDS = {
    "isshobin": {"prof": [(0.05, 0.0), (0.052, 0.25), (0.022, 0.318), (0.0165, 0.33), (0.0165, 0.377), (0.019, 0.39)], "glass": ["#1d3a25", "#3a2410", "#1d3a25", "#2a2018"], "cap": ["#c9a44c", "#1a1a1a", "#8c1c16"],
                 "label": (0.07, 0.2), "segs": 8},
    "yongobin": {"prof": [(0.04, 0.0), (0.042, 0.19), (0.017, 0.246), (0.0135, 0.256), (0.0135, 0.294), (0.0155, 0.303)], "glass": ["#21385c", "#cfd8d2", "#1d3a25"], "cap": ["#c9a44c", "#e8e2d6", "#1a1a1a"],
                 "label": (0.055, 0.16), "segs": 8},
    "shochu": {"prof": [(0.046, 0.0), (0.048, 0.19), (0.02, 0.24), (0.017, 0.255), (0.017, 0.282), (0.019, 0.292)], "glass": ["#4a2a10", "#1a1a1a"], "cap": ["#1a1a1a", "#c9a44c"],
               "label": (0.05, 0.17), "segs": 8},
    "whisky": {"prof": [(0.052, 0.0), (0.054, 0.2), (0.02, 0.24), (0.016, 0.25), (0.016, 0.277), (0.021, 0.29)], "glass": ["#a8611c"], "cap": ["#1a1a1a", "#7a1410"],
               "label": (0.06, 0.15), "segs": 4},
    "umeshu": {"prof": [(0.045, 0.0), (0.048, 0.14), (0.044, 0.2), (0.016, 0.242), (0.016, 0.264), (0.018, 0.272)], "glass": ["#d9a94e"], "cap": ["#c9a44c"],
               "label": (0.05, 0.13), "segs": 8},
}
# (bay by bay: the floor's four, the shelf's five; the labels' cells in this order (the game's LIQUOR_LABELS))
LAYOUT = [
    (["isshobin"] * 4, ["yongobin", "shochu", "whisky", "umeshu", "yongobin"]),
    (["isshobin"] * 4, ["shochu", "yongobin", "umeshu", "whisky", "shochu"]),
    (["isshobin"] * 4, ["yongobin", "whisky", "yongobin", "shochu", "umeshu"]),
]
bot = bmesh.new()
BL = {"uv": bot.loops.layers.uv.new("UVMap"), "col": bot.loops.layers.color.new("Col")}
lab = bmesh.new()
LL = {"uv": lab.loops.layers.uv.new("UVMap")}
cell = 0
tris = {}


def bottle(kind, cx, cz, y0, turn, cell):
    """a bottle of `kind` standing at (cx, y0, cz), turned `turn` about its own upright; its label's band on picture cell `cell`"""
    k = KINDS[kind]
    segs, prof = k["segs"], k["prof"]
    glass = srgb(k["glass"][int(RS.integers(0, len(k["glass"])))])
    cap = srgb(k["cap"][int(RS.integers(0, len(k["cap"])))])
    off = math.pi / 4 if segs == 4 else 0.0
    sq = 1.0 / math.cos(math.pi / 4) if segs == 4 else 1.0
    rings = []
    for i, (r, y) in enumerate(prof):
        rr = r * (sq if segs == 4 and y < 0.21 else 1.0)
        rings.append([bot.verts.new(P(cx + rr * math.cos(off + turn + 2 * math.pi * s / segs), y0 + y, cz + rr * math.sin(off + turn + 2 * math.pi * s / segs)))
                      for s in range(segs)])
    faces = []
    n_tri = 0
    for i in range(len(rings) - 1):
        for s in range(segs):
            t = (s + 1) % segs
            f = bot.faces.new((rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]))
            faces.append((f, i))
            n_tri += 2
    for rg, top in ((rings[0], False), (rings[-1], True)):
        for f in ladder_fill(bot, rg if top else rg[::-1]):
            faces.append((f, len(prof) - 1 if top else 0))
            n_tri += len(f.verts) - 2
    c_mid = Vector(P(cx, y0 + prof[-1][1] / 2, cz))
    for f, i in faces:
        f.normal_update()
        cen = f.calc_center_median()
        side = cen - c_mid
        side.z = 0.0
        want = (f.normal.dot(side) > 0) if abs(f.normal.z) < 0.7 else (f.normal.z > 0) == (cen.z > c_mid.z)
        if not want:
            f.normal_flip()
        f.smooth = True
        # (the cap: its neck and its top, and the top's ladder, in its own colour: the capsule over the neck)
        is_cap = i >= len(prof) - 3
        col = cap if is_cap else glass
        for lp in f.loops:
            lp[BL["col"]] = (*col, 1.0)
            lp[BL["uv"]].uv = (0.5, 0.5)
    # (its label: a band round the front of its body, 2 mm off it, a third of the way round, on its own cell)
    a0, a1 = k["label"]
    r_body = max(r for r, y in prof) * (sq if segs == 4 else 1.0) + 0.002
    cu, cv = cell % COLS, cell // COLS
    arc = 4
    span = math.pi * 0.62 if segs != 4 else math.pi / 2 * 0.9
    # (round the front, toward +z, the game's open side of the cabinet)
    mid_a = math.pi / 2
    pts = []
    for s in range(arc + 1):
        ang = mid_a + span / 2 - span * s / arc
        if segs == 4:
            # (on the square's front face: flat)
            xx = cx + (s / arc - 0.5) * 0.072
            zz = cz + 0.0365
            pts.append((xx, zz))
        else:
            pts.append((cx + r_body * math.cos(ang), cz + r_body * math.sin(ang)))
    lo = [lab.verts.new(P(x, y0 + a0, z)) for x, z in pts]
    hi = [lab.verts.new(P(x, y0 + a1, z)) for x, z in pts]
    for s in range(arc):
        f = lab.faces.new((lo[s], lo[s + 1], hi[s + 1], hi[s]))
        f.normal_update()
        if f.normal.dot(Vector(P(0, 0, 1)) - Vector(P(0, 0, 0))) < 0 and segs != 4:
            pass
        mx = (pts[s][0] + pts[s + 1][0]) / 2 - cx
        mz = (pts[s][1] + pts[s + 1][1]) / 2 - cz
        if f.normal.dot(Vector(P(mx, 0, mz))) < 0:
            f.normal_flip()
        for lp in f.loops:
            # (u across the band from its left end seen from the front, v up it, into the cell)
            idx = lo.index(lp.vert) if lp.vert in lo else hi.index(lp.vert)
            up = 1.0 if lp.vert in hi else 0.0
            lp[LL["uv"]].uv = ((cu + idx / arc) / COLS, 1 - (cv + 1 - up) / ROWS)
        n_tri += 2
    return n_tri


for b, (floor_row, shelf_row) in enumerate(LAYOUT):
    a, bb = bays[b]
    for row, y0, zc in ((floor_row, 0.035, D * 0.5), (shelf_row, SHELF_Y, D * 0.52)):
        n = len(row)
        for i, kind in enumerate(row):
            cx = a + (bb - a) * (i + 0.5) / n + RS.uniform(-0.01, 0.01)
            tris[kind] = bottle(kind, cx, zc + RS.uniform(-0.012, 0.012), y0 + 0.0015, RS.uniform(-0.15, 0.15), cell)
            cell += 1
print("LIQUOR_CELLS", cell, "BOTTLE_TRIS", tris)
me = bpy.data.meshes.new("LiquorBottles")
bot.to_mesh(me)
bot.free()
bot_o = bpy.data.objects.new("LiquorBottles", me)
bpy.context.collection.objects.link(bot_o)
bot_o.data.materials.append(M["glass"])
parts.append(bot_o)
me = bpy.data.meshes.new("LiquorLabels")
lab.to_mesh(me)
lab.free()
lab_o = bpy.data.objects.new("LiquorLabels", me)
bpy.context.collection.objects.link(lab_o)
lab_o.data.materials.append(M["label"])
parts.append(lab_o)

root = bpy.data.objects.new("LiquorShelf", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("LIQUOR_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, H / 2, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(-1.2, 1.0, 2.2)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 3
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 3)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.3, 0.3, 0.3)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "liquorshelf.glb"), os.path.join(PROJECT, "blender", "liquorshelf.blend"), PREVIEW)
print("LIQUOR_DONE")
