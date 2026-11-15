"""The genkan's floor and its step (genkanfloor.glb; item 185, the owner's, 2026-11-15: "the genkan's doorway, its stone step and floor, too
plain": one flat picture of stones on a plane, a regular grid of grey slabs in thick pale joints, and the step up a thin dark board).

- node "GenkanStones": the floor, natural stones laid crazy-paving (乱張り): each its own outline (a Voronoi cell of the genkan's rect), its
  own tint (in its points' colour: pale granite, warm grey, cool grey, a dark slate now and then), its top a hair off level, a small chamfer
  round it that catches the light; laid in the joints' pebble-wash. One mesh.
- node "GenkanMortar": the pebble-wash (洗い出し) between them: small black, grey and white pebbles packed in dark cement, seen in the joints.
- node "GenkanKutsunugi": the shoe-off stone (沓脱石) at the step, where the way in from the door crosses it: a slab of granite half the
  step's height, rounded at its corners, its top a little domed, chamfered. People stand on it as they take their shoes off (bar.ts's
  KUTSUNUGI; its place there and here the same).
- node "GenkanSill": the door's threshold (敷居石): a long slab of dark granite across the doorway, a little proud of the floor.
- node "GenkanKamachi": the step's edge (上框): a polished keyaki beam along both of the genkan's open sides, its top a hair proud of the
  room's boards, its front the step's face down to the stones, its top front edge rounded; mitred at the corner.

The game's frame is RoomFloor's (GuestBar3D): x = minus the first counter's lay, z = its along from its middle, y up from the room's floor;
in the bar's units. The genkan's rect there (measured in the game, item 185): x 0.42..1.6569, z 2.4..3.7155, its stone 0.1 down.
The shoe cupboard stands against the wall side from x 1.297; the way in runs at x 1.16.

Run:
    blender -b --factory-startup --python blender/genkanfloor.py -- <project path> [preview.png]
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
seed(185)

# ------------------------------------------------------------------------------------------------ the genkan's rect and the parts' sizes
X0, X1, Z0, Z1, D = 0.42, 1.6569, 2.4, 3.7155, 0.1
FLOOR = -D                 # the genkan's stone, where people stand
MORTAR_Y = -D - 0.010      # the pebble-wash in the joints, a centimetre under the stones' tops
JOINT = 0.009              # half a joint's width
CHAMFER = 0.0045           # each stone's top edge, its chamfer in and down
# (the step's beam: its profile across the edge (u: from under the room's boards, + into the genkan), its top and how far down it goes)
K_BACK, K_FRONT, K_TOP, K_ROUND = -0.035, 0.024, 0.006, 0.012
K_FOOT = MORTAR_Y
# (the shoe-off stone: clear of the shoe cupboard's doors (x 1.297) and the doormat (from z 2.75), on the way in (x 1.16))
KU = {"x": (0.80, 1.27), "z": (Z0 + 0.045, Z0 + 0.32), "top": FLOOR + 0.05, "r": 0.05}
# (the threshold across the doorway, against the door's end)
SILL = {"x": (X0 + K_FRONT + 0.004, X1), "z": (Z1 - 0.075, Z1), "top": FLOOR + 0.004}


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# ------------------------------------------------------------------------------------------------ pictures
N = 1024
u, v = grid01(N)
# (granite: a pale grey-beige ground, cloudy, packed with grains: black mica, white quartz, a pink-brown feldspar; a few darker veins)
ground = mix((0.60, 0.58, 0.55), (0.47, 0.455, 0.43), fbm(N, 5, 5, 5))
gran = ground.copy()
for cells, thr, col, k in ((420, 0.80, (0.08, 0.08, 0.09), 0.9), (300, 0.84, (0.80, 0.79, 0.76), 0.7), (240, 0.86, (0.52, 0.40, 0.35), 0.6),
                           (520, 0.78, (0.24, 0.24, 0.25), 0.55)):
    chip = smooth(thr, thr + 0.04, vnoise(N, cells, cells))
    gran = mix(gran, col, chip * k)
vein = np.abs(fbm(N, 3, 7, 5) - 0.5)
gran = mix(gran, (0.36, 0.355, 0.35), smooth(0.03, 0.0, vein) * 0.35)
# (worn: a little lighter where it's walked on, a little dirtier in its low places)
gran = gran * (0.93 + 0.1 * fbm(N, 8, 8, 4))[..., None]
gh = fbm(N, 64, 64, 3) * 0.6 + fbm(N, 6, 6, 4) * 0.4
gh = gh - smooth(0.8, 0.86, vnoise(N, 420, 420)) * 0.25        # the mica's pits
STONE_TEX = image("genkan_granite", np.clip(gran, 0, 1).astype(np.float32))
STONE_NRM = image("genkan_granite_nrm", to_normal(gh, 3.0).astype(np.float32), data=True)

# (pebble-wash: dark cement, packed with small round pebbles, black (那智黒), grey, a few white)
M2 = 512
yy, xx = np.mgrid[0:M2, 0:M2].astype(np.float32)
peb = np.zeros((M2, M2, 3), np.float32) + np.array([0.20, 0.19, 0.18], np.float32)
peb = peb * (0.85 + 0.3 * fbm(M2, 8, 8, 4))[..., None]
ph = np.zeros((M2, M2), np.float32)
for _ in range(1700):
    r = rng.uniform(3.0, 7.5)
    cx, cy = rng.uniform(0, M2, 2)
    tone = rng.random()
    col = np.array((0.06, 0.06, 0.065) if tone < 0.55 else (0.42, 0.41, 0.40) if tone < 0.88 else (0.86, 0.85, 0.82), np.float32)
    col = col * rng.uniform(0.85, 1.15)
    for ox in (-M2, 0, M2):
        for oy in (-M2, 0, M2):
            px, py = cx + ox, cy + oy
            x0, x1 = int(max(0, px - r - 2)), int(min(M2, px + r + 2))
            y0, y1 = int(max(0, py - r - 2)), int(min(M2, py + r + 2))
            if x0 >= x1 or y0 >= y1:
                continue
            d = np.sqrt((xx[y0:y1, x0:x1] - px) ** 2 + (yy[y0:y1, x0:x1] - py) ** 2)
            m = np.clip((r - d) / 1.2, 0, 1)
            dome = np.clip(1 - (d / r) ** 2, 0, 1)
            shade = (0.75 + 0.35 * dome)[..., None]
            peb[y0:y1, x0:x1] = peb[y0:y1, x0:x1] * (1 - m[..., None]) + (col * shade) * m[..., None]
            ph[y0:y1, x0:x1] = np.maximum(ph[y0:y1, x0:x1], dome * m)
PEB_TEX = image("genkan_pebbles", np.clip(peb, 0, 1).astype(np.float32))
PEB_NRM = image("genkan_pebbles_nrm", to_normal(ph, 2.5).astype(np.float32), data=True)

# (keyaki, polished: a deep red-brown, its grain running the beam's length, a band of lighter figure here and there, a waxed sheen)
M3 = 512
u3, v3 = grid01(M3)
grain = np.sin((v3 * 46 + (fbm(M3, 3, 8, 4) - 0.5) * 2.2 + (fbm(M3, 9, 2, 3) - 0.5) * 0.4) * 2 * math.pi) * 0.5 + 0.5
wood = mix((0.30, 0.14, 0.07), (0.17, 0.075, 0.035), smooth(0.45, 1.0, grain) * 0.8)
wood = mix(wood, (0.38, 0.19, 0.09), smooth(0.7, 0.95, fbm(M3, 2, 6, 4)) * 0.35)
wood = wood * (0.92 + 0.1 * fbm(M3, 4, 24, 3))[..., None]
WOOD_TEX = image("genkan_keyaki", np.clip(wood, 0, 1).astype(np.float32))
WOOD_NRM = image("genkan_keyaki_nrm", to_normal(grain * 0.6 + fbm(M3, 6, 30, 3) * 0.4, 1.2).astype(np.float32), data=True)

M = {
    "stone": pbr("GenkanStone", (1, 1, 1), tex=STONE_TEX, nrm=STONE_NRM, nrm_strength=0.6, rough=0.7),
    "pebble": pbr("GenkanPebble", (1, 1, 1), tex=PEB_TEX, nrm=PEB_NRM, nrm_strength=0.8, rough=0.85),
    "wood": pbr("GenkanKeyaki", (1, 1, 1), tex=WOOD_TEX, nrm=WOOD_NRM, nrm_strength=0.4, rough=0.3),
}

parts = []


def new_obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for poly in o.data.polygons:
        poly.use_smooth = False
    parts.append(o)
    return o


# ------------------------------------------------------------------------------------------------ geometry helpers (convex polygons in x, z)
def clip(poly, a, b, c):
    """the part of a convex polygon (x, z points) where a*x + b*z <= c"""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def inset(poly, d):
    """a convex polygon (counter-clockwise in x, z) with each edge moved in by d"""
    out = []
    n = len(poly)
    lines = []
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        ex, ez = q[0] - p[0], q[1] - p[1]
        L = math.hypot(ex, ez) or 1e-9
        nx, nz = -ez / L, ex / L          # inward for counter-clockwise
        lines.append((p[0] + nx * d, p[1] + nz * d, ex, ez))
    for i in range(n):
        x1, z1, dx1, dz1 = lines[i - 1]
        x2, z2, dx2, dz2 = lines[i]
        den = dx1 * dz2 - dz1 * dx2
        if abs(den) < 1e-12:
            out.append((x2, z2))
            continue
        t = ((x2 - x1) * dz2 - (z2 - z1) * dx2) / den
        out.append((x1 + dx1 * t, z1 + dz1 * t))
    return out


def ccw(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if a > 0 else poly[::-1]


def slab(bm, outline, top, foot, chamfer, uvl, col, tile, uv_off, dome=0.0, tilt=(0.0, 0.0)):
    """a stone: its outline (convex, x, z), its top at `top` (a little domed toward its middle, a little tilted), a chamfer of `chamfer` in and
    down round its top, its sides straight down to `foot`; its picture laid from above (`tile`, moved by `uv_off`), its tint `col`"""
    outline = ccw(outline)
    inner = inset(outline, chamfer)
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    rad = max(math.hypot(p[0] - cx, p[1] - cz) for p in outline) or 1

    def h(x, z, base):
        d = math.hypot(x - cx, z - cz) / rad
        return base + dome * (1 - d * d) + tilt[0] * (x - cx) + tilt[1] * (z - cz)

    top_v = [bm.verts.new(P(x, h(x, z, top), z)) for x, z in inner]
    rim_v = [bm.verts.new(P(x, h(x, z, top) - chamfer * 0.7, z)) for x, z in outline]
    foot_v = [bm.verts.new(P(x, foot, z)) for x, z in outline]
    faces = []
    faces.append(bm.faces.new(top_v))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((rim_v[i], rim_v[j], top_v[j], top_v[i])))
        faces.append(bm.faces.new((foot_v[i], foot_v[j], rim_v[j], rim_v[i])))
    for f in faces:
        f.normal_update()
        if f.normal.z < -0.5:
            f.normal_flip()
        for loop in f.loops:
            co = loop.vert.co
            # (game x = blender x, game z = -blender y, game y = blender z)
            gx, gz, gy = co.x, -co.y, co.z
            if abs(f.normal.z) > 0.6:
                loop[uvl["uv"]].uv = (gx / tile + uv_off[0], gz / tile + uv_off[1])
            else:
                # (the sides: along the edge and down)
                loop[uvl["uv"]].uv = ((gx + gz) / tile + uv_off[0], gy / tile * 3 + uv_off[1])
            loop[uvl["col"]] = (*col, 1.0)
    return faces


def layers(bm):
    return {"uv": bm.loops.layers.uv.verify(), "col": bm.loops.layers.color.new("Col")}


# ------------------------------------------------------------------------------------------------ the stones: crazy paving
SX0, SX1 = X0 + K_FRONT + 0.004, X1
SZ0, SZ1 = Z0 + K_FRONT + 0.004, SILL["z"][0] - 0.004
# (seeds: a jittered spread, none too near another, so the stones come out a hand or two across, none a sliver)
seeds = []
tries = 0
while len(seeds) < 15 and tries < 6000:
    tries += 1
    p = (rng.uniform(SX0, SX1), rng.uniform(SZ0, SZ1))
    if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 0.27 for q in seeds):
        seeds.append(p)
rect = [(SX0, SZ0), (SX1, SZ0), (SX1, SZ1), (SX0, SZ1)]
TINTS = [(1.0, 1.0, 1.0), (1.02, 0.94, 0.84), (0.84, 0.88, 0.94), (0.9, 0.88, 0.86), (0.66, 0.65, 0.66), (0.5, 0.5, 0.53)]
bm = bmesh.new()
L = layers(bm)
n_st = 0
for i, s in enumerate(seeds):
    cell = rect
    for j, q in enumerate(seeds):
        if i == j:
            continue
        # (nearer s than q, less half a joint: the perpendicular bisector moved toward s)
        a, b = q[0] - s[0], q[1] - s[1]
        L2 = math.hypot(a, b)
        c = (q[0] ** 2 + q[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2 - JOINT * L2
        cell = clip(cell, a, b, c)
        if len(cell) < 3:
            break
    if len(cell) < 3:
        continue
    # (half a joint in from the rect's edges too, where the stones meet the beam, the walls and the threshold)
    cell = clip(cell, -1, 0, -(SX0 + JOINT))
    cell = clip(cell, 1, 0, SX1 - JOINT)
    cell = clip(cell, 0, -1, -(SZ0 + JOINT))
    cell = clip(cell, 0, 1, SZ1 - JOINT)
    # (no corner sharper than the eye takes for a cut stone: points closer than 1.5 cm merged)
    merged = []
    for p in cell:
        if not merged or math.hypot(p[0] - merged[-1][0], p[1] - merged[-1][1]) > 0.015:
            merged.append(p)
    if len(merged) > 3 and math.hypot(merged[0][0] - merged[-1][0], merged[0][1] - merged[-1][1]) < 0.015:
        merged.pop()
    if len(merged) < 3:
        continue
    tint = TINTS[int(rng.integers(0, len(TINTS) - 1))] if rng.random() > 0.2 else TINTS[-1]
    slab(bm, merged, FLOOR + 0.002 + rng.uniform(-0.0012, 0.0012), MORTAR_Y, CHAMFER, L, tint, 0.65, (rng.random(), rng.random()),
         dome=0.0015, tilt=(rng.uniform(-0.004, 0.004), rng.uniform(-0.004, 0.004)))
    n_st += 1
stones = new_obj("GenkanStones", bm, "stone")
print("GENKAN_STONES", n_st)

# ------------------------------------------------------------------------------------------------ the pebble-wash under them
bm = bmesh.new()
L = layers(bm)
quad = [bm.verts.new(P(x, MORTAR_Y, z)) for x, z in ((SX0 - 0.002, SZ0 - 0.002), (SX1, SZ0 - 0.002), (SX1, Z1), (SX0 - 0.002, Z1))]
f = bm.faces.new(quad)
f.normal_update()
if f.normal.z < 0:
    f.normal_flip()
for loop in f.loops:
    loop[L["uv"]].uv = (loop.vert.co.x / 0.28, -loop.vert.co.y / 0.28)
    loop[L["col"]] = (1, 1, 1, 1)
mortar = new_obj("GenkanMortar", bm, "pebble")

# ------------------------------------------------------------------------------------------------ the shoe-off stone and the threshold
def rounded_rect(x0, x1, z0, z1, r, seg=4, jitter=0.0):
    pts = []
    for (cx, cz, a0) in ((x1 - r, z0 + r, -math.pi / 2), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, math.pi / 2), (x0 + r, z0 + r, math.pi)):
        for k in range(seg + 1):
            a = a0 + (math.pi / 2) * k / seg
            jr = r + (rng.uniform(-jitter, jitter) if jitter else 0)
            pts.append((cx + math.cos(a) * jr, cz + math.sin(a) * jr))
    return pts


bm = bmesh.new()
L = layers(bm)
slab(bm, rounded_rect(KU["x"][0], KU["x"][1], KU["z"][0], KU["z"][1], KU["r"], seg=4, jitter=0.003), KU["top"], FLOOR - 0.004, 0.009, L,
     (0.78, 0.77, 0.76), 0.55, (0.31, 0.62), dome=0.005)
kutsu = new_obj("GenkanKutsunugi", bm, "stone")
bm = bmesh.new()
L = layers(bm)
slab(bm, [(SILL["x"][0], SILL["z"][0]), (SILL["x"][1], SILL["z"][0]), (SILL["x"][1], SILL["z"][1]), (SILL["x"][0], SILL["z"][1])], SILL["top"],
     MORTAR_Y, 0.005, L, (0.46, 0.46, 0.49), 0.65, (0.12, 0.4))
sill = new_obj("GenkanSill", bm, "stone")

# ------------------------------------------------------------------------------------------------ the step's beam (上框)
# (its profile across the edge: from under the room's boards out to its rounded top front edge and down its face to the stones)
prof = [(K_BACK, K_FOOT), (K_BACK, K_TOP)]
for k in range(4):
    a = math.pi / 2 * k / 3
    prof.append((K_FRONT - K_ROUND + math.sin(a) * K_ROUND, K_TOP - K_ROUND + math.cos(a) * K_ROUND))
prof.append((K_FRONT, K_FOOT))
bm = bmesh.new()
L = layers(bm)


def run(points_at):
    """one run of the beam: `points_at(u, y)` gives (start, end) in x, z for each profile point; a strip between each two of them"""
    ring_a = [bm.verts.new(P(*points_at(pu, py)[0], )) for pu, py in prof]
    ring_b = [bm.verts.new(P(*points_at(pu, py)[1], )) for pu, py in prof]
    faces = []
    for i in range(len(prof) - 1):
        faces.append(bm.faces.new((ring_a[i], ring_b[i], ring_b[i + 1], ring_a[i + 1])))
    return faces, ring_a, ring_b


# (along the room side, z = Z0, from the corner (mitred: its end on the diagonal x - X0 = z - Z0) to the side wall)
fa, ra, rb = run(lambda pu, py: ((X0 + pu, py, Z0 + pu), (X1, py, Z0 + pu)))
# (along the till side, x = X0, from the corner to the door's end)
fb, sa, sb = run(lambda pu, py: ((X0 + pu, py, Z0 + pu), (X0 + pu, py, Z1)))
for f in fa + fb:
    f.normal_update()
# (each face outward: away from the beam's middle line)
for f, mid in [(f, Vector(P(X0 + (K_BACK + K_FRONT) / 2, (K_TOP + K_FOOT) / 2, 0))) for f in fa] + [(f, None) for f in fb]:
    c = f.calc_center_median()
    if mid is not None:
        out = Vector((0, c.y - P(0, 0, Z0 + (K_BACK + K_FRONT) / 2).y, c.z - (K_TOP + K_FOOT) / 2))
    else:
        out = Vector((c.x - (X0 + (K_BACK + K_FRONT) / 2), 0, c.z - (K_TOP + K_FOOT) / 2))
    if f.normal.dot(out) < 0:
        f.normal_flip()
for f in fa + fb:
    for loop in f.loops:
        co = loop.vert.co
        gx, gz, gy = co.x, -co.y, co.z
        along = gx if f in fa else gz
        across = gy if abs(f.normal.z) < 0.6 else (gz if f in fa else gx)
        loop[L["uv"]].uv = (along / 0.5, across / 0.12)
        loop[L["col"]] = (1, 1, 1, 1)
kamachi = new_obj("GenkanKamachi", bm, "wood")

# ------------------------------------------------------------------------------------------------ out
root = bpy.data.objects.new("GenkanRoot", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts}
print("GENKAN_TRIS", tris, sum(tris.values()))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.2, 0.9, 4.3)
    look = P(1.05, -0.1, 3.0)
    cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (0.6, 0.2, 0.8)
    bpy.context.collection.objects.link(sun)
export_dish(root, [root] + parts, os.path.join(PROJECT, "public", "models", "genkanfloor.glb"), os.path.join(PROJECT, "blender", "genkanfloor.blend"), PREVIEW)
print("GENKAN_DONE")
