"""
The rice and the miso soup as they're served (items 205 and 206, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？我要看
到好的動畫品質」): a rice bowl (茶碗, blue-and-white porcelain) and its heap of rice, a lacquered soup bowl (汁椀, black without, vermilion
within) and the soup's face in it (miso, tofu, wakame, spring onion), the rice paddle (しゃもじ) and the ladle (お玉) with what each carries,
and the tray (お盆) a server carries them out on. Each its own node at its own origin, for the game to take up, fill and carry:
  ChawanBody, ChawanRice (its base at its origin, scaled by the game as it's filled), WanBody, WanSoup (a disc, set at the soup's height),
  Shamoji (its grip at its origin, its blade out along +z), ShamojiRice (a lump of rice on the blade), Otama (its grip at its origin),
  OtamaSoup (the soup in its cup), Bon (the tray, its underside's middle at its origin).
Low-poly (docs/MODELING.md): round things 16 round, each 50-110 faces, no fan into one point (ladder caps); the detail painted.

  blender -b --factory-startup --python blender/sidebowls.py -- <project> [preview.png]
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

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


parts = []
SEG = 16


def turn(name, prof, mats, band_mat, cap_lo=None, cap_hi=None, segs=SEG, uv_planar=None):
    """a round thing turned about its upright axis at the origin: `prof` (radius, height) rings in order; band i (ring i to i+1) of material
    band_mat[i] (an index into `mats`); the first ring closed with a ladder (`cap_lo`: its material, None: open), the last likewise
    (`cap_hi`). UVs round it (u the angle, v the height), or laid flat from above across `uv_planar` (a radius) for a top seen from above."""
    bm = bmesh.new()
    rings = []
    for r_, h_ in prof:
        rings.append([bm.verts.new(P(r_ * math.cos(2 * math.pi * i / segs), h_, r_ * math.sin(2 * math.pi * i / segs))) for i in range(segs)])
    for k, (a_, b_) in enumerate(zip(rings, rings[1:])):
        for i in range(segs):
            f = bm.faces.new((a_[i], a_[(i + 1) % segs], b_[(i + 1) % segs], b_[i]))
            f.material_index = band_mat[k]
    if cap_lo is not None:
        for f in ladder_fill(bm, list(reversed(rings[0]))):
            f.material_index = cap_lo
    if cap_hi is not None:
        for f in ladder_fill(bm, rings[-1]):
            f.material_index = cap_hi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    if uv_planar:
        planar_uv(o, uv_planar)
    else:
        cyl_uv(o)
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def planar_uv(o, r):
    """each face's picture laid flat on it from above, a square `r` either side of the axis"""
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (0.5 + co.x / (2 * r), 0.5 + co.y / (2 * r))


def flat(name, outline, thick, mat, uv_r):
    """a flat piece: `outline` (x, z) round it in order, `thick` deep (from y 0 up), its two faces ladders, its edge all round"""
    bm = bmesh.new()
    lo = [bm.verts.new(P(x, 0, z)) for x, z in outline]
    hi = [bm.verts.new(P(x, thick, z)) for x, z in outline]
    n = len(outline)
    for i in range(n):
        bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    ladder_fill(bm, hi)
    ladder_fill(bm, list(reversed(lo)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    planar_uv(o, uv_r)
    parts.append(o)
    return o


def bar(name, pts, w, mat):
    """a thin square rod through `pts` (the game's frame), `w` across: a 4-sided tube, its two ends closed"""
    bm = bmesh.new()
    rings = []
    for k, p in enumerate(pts):
        a = Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])
        a.normalize()
        side = a.cross(Vector((0, 1, 0)))
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(a)
        up.normalize()
        c = Vector(p)
        rings.append([bm.verts.new(P(*(c + (side * sx + up * sy) * (w / 2)))) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))])
    for a_, b_ in zip(rings, rings[1:]):
        for i in range(4):
            bm.faces.new((a_[i], a_[(i + 1) % 4], b_[(i + 1) % 4], b_[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    cyl_uv(o)
    parts.append(o)
    return o


# ---------------------------------------------------------------------------------------------------- pictures
N = 512
u, v = grid01(N)

# (the rice bowl's glaze: a warm white porcelain, a cobalt line under the rim and another round the foot, between them a ring of waves (青海
# 波) painted by hand, each arc a little uneven; the foot ring left unglazed; the inside white with a thin line under the rim)
glaze = np.stack([np.full_like(u, 0.93), np.full_like(u, 0.915), np.full_like(u, 0.87)], -1)
cobalt = np.array([0.12, 0.2, 0.52])
band = ((v > 0.86) & (v < 0.9)) | ((v > 0.2) & (v < 0.225))
glaze[band] = cobalt
# (the waves: rows of concentric arcs, three to a scale, round the outer wall's middle)
wx, wy = (u * 18.0), (v - 0.3) / 0.5 * 4.0
row = np.floor(wy)
cx = np.floor(wx + 0.5 * (row % 2)) - 0.5 * (row % 2)
d = np.sqrt((wx - cx - 0.5) ** 2 + ((wy - row) * 1.15) ** 2)
ring = (np.abs(np.sin(d * math.pi * 3.0)) > 0.82) & (d < 0.62) & (v > 0.3) & (v < 0.8)
glaze[ring] = cobalt * 1.15
# (the brush's unevenness: the blue lighter here, deeper there)
shade = 0.9 + 0.2 * fbm(N, 6, 3)
blue = band | ring
glaze[blue] = np.clip(glaze[blue] * shade[blue][:, None], 0, 1)
glaze[v < 0.13] = [0.78, 0.7, 0.58]     # the bare foot ring
CHAWAN_GLAZE = pbr("ChawanGlaze", tex=image("T_ChawanGlaze", glaze), rough=0.22)

# (the rice: a heap of grains, each a little oval catching the light, a soft shadow between them; drawn with a height for its normals)
RN = 256
ru, rv = grid01(RN)
grains = np.zeros((RN, RN), np.float32)
yy, xx = np.mgrid[0:RN, 0:RN].astype(np.float32)
for _ in range(900):
    cx_, cy_ = rng.uniform(0, RN, 2)
    a_ = rng.uniform(0, math.pi)
    ca, sa = math.cos(a_), math.sin(a_)
    x0, x1 = int(max(0, cx_ - 7)), int(min(RN, cx_ + 7))
    y0, y1 = int(max(0, cy_ - 7)), int(min(RN, cy_ + 7))
    dx, dy = xx[y0:y1, x0:x1] - cx_, yy[y0:y1, x0:x1] - cy_
    e = ((dx * ca + dy * sa) / 5.2) ** 2 + ((-dx * sa + dy * ca) / 2.6) ** 2
    grains[y0:y1, x0:x1] = np.maximum(grains[y0:y1, x0:x1], np.clip(1 - e, 0, 1) ** 0.6)
# (bright: freshly cooked rice reads white even in the evening's warm light; the gaps between grains only a little darker)
rice_c = np.stack([0.9 + 0.1 * grains, 0.9 + 0.1 * grains, 0.87 + 0.1 * grains], -1)
RICE = pbr("Rice", tex=image("T_Rice", rice_c), nrm=image("T_RiceN", to_normal(grains, 1.2), data=True), nrm_strength=0.45, rough=0.55)

# (the lacquer: a black bowl, a deep vermilion inside, a soft sheen on both)
WAN_BLACK = pbr("WanBlack", lin("#1a1210"), rough=0.28, coat=0.6)
WAN_RED = pbr("WanRed", lin("#8c1e14"), rough=0.3, coat=0.6)

# (the miso soup's face: the miso clouded in the dashi, some cubes of tofu, wakame and rings of spring onion floating in it)
SN = 256
su, sv = grid01(SN)
cloud = fbm(SN, 4, 4)
soup = mix(np.array([0.54, 0.34, 0.15]), np.array([0.74, 0.55, 0.3]), cloud)
syy, sxx = np.mgrid[0:SN, 0:SN].astype(np.float32)
for _ in range(7):    # tofu
    cx_, cy_ = rng.uniform(60, 196, 2)
    s_ = rng.uniform(9, 13)
    m = (np.abs(sxx - cx_) < s_) & (np.abs(syy - cy_) < s_)
    soup[m] = [0.93, 0.9, 0.8]
    edge = m & ((np.abs(sxx - cx_) > s_ - 2) | (np.abs(syy - cy_) > s_ - 2))
    soup[edge] = [0.8, 0.76, 0.64]
for _ in range(9):    # wakame
    cx_, cy_ = rng.uniform(50, 206, 2)
    r_ = rng.uniform(8, 15)
    d_ = np.sqrt(((sxx - cx_) / 1.6) ** 2 + (syy - cy_) ** 2)
    soup[d_ < r_ * (0.75 + 0.25 * cloud)] = [0.12, 0.22, 0.08]
for _ in range(14):   # spring onion rings
    cx_, cy_ = rng.uniform(50, 206, 2)
    d_ = np.sqrt((sxx - cx_) ** 2 + (syy - cy_) ** 2)
    soup[(d_ > 3.0) & (d_ < 5.2)] = [0.3, 0.62, 0.2]
MISO = pbr("MisoSurface", tex=image("T_MisoSurface", soup), rough=0.18)

# (the paddle: pale wood, a fine grain along it; the ladle: brushed steel)
# (a pale paddle, as a rice paddle is: near white, a faint grain)
pw = np.stack([np.full_like(u, 0.95), np.full_like(u, 0.92), np.full_like(u, 0.84)], -1)
pw = pw * (0.96 + 0.04 * np.sin(u * 160 + fbm(N, 2, 12) * 6))[..., None]
SHAMOJI = pbr("ShamojiWood", tex=image("T_ShamojiWood", np.clip(pw, 0, 1)), rough=0.6)
OTAMA = pbr("OtamaSteel", lin("#c8ccd0"), rough=0.3, metal=0.85)

# (the tray: black lacquer, its floor a dark red-brown)
BON_BLACK = pbr("BonBlack", lin("#16100e"), rough=0.3, coat=0.5)
BON_FLOOR = pbr("BonFloor", lin("#4a1a12"), rough=0.35, coat=0.5)

# ---------------------------------------------------------------------------------------------------- the rice bowl and its rice
# (its foot, the body swelling out to the shoulder, the rim a flat band 6 mm across (the bowl's thickness, seen from above and from the side),
# down inside to the well; 12 cm across, 6 high)
# (five bands round, its underside left open (never seen: it stands on the tray or the counter): 174 triangles, 188 before)
turn("ChawanBody", [(0.0265, 0.0), (0.0495, 0.034), (0.0525, 0.0565), (0.0465, 0.0585), (0.042, 0.032), (0.018, 0.013)],
     [CHAWAN_GLAZE], [0, 0, 0, 0, 0], cap_hi=0)
# (the rice, heaped a little over the rim when full: its base the bowl's inside at the rim's height; the game sets it down and scales it
# as it's filled, scoop by scoop)
turn("ChawanRice", [(0.047, 0.0), (0.043, 0.011), (0.031, 0.021), (0.013, 0.027)], [RICE], [0, 0, 0], cap_hi=0, uv_planar=0.05)
# (a lump of it on the paddle's blade)
turn("ShamojiRice", [(0.022, 0.0), (0.02, 0.007), (0.013, 0.013), (0.005, 0.016)], [RICE], [0, 0, 0], cap_hi=0, uv_planar=0.025)

# ---------------------------------------------------------------------------------------------------- the soup bowl and its soup
# (as the rice bowl: black to the rim's band, red from its inside edge down)
turn("WanBody", [(0.028, 0.0), (0.0485, 0.03), (0.0505, 0.0505), (0.0445, 0.0525), (0.0395, 0.03), (0.019, 0.012)],
     [WAN_BLACK, WAN_RED], [0, 0, 0, 1, 1], cap_hi=1)
# (the soup's face: a disc the inside's width at four fifths full (the game sets it at its height, a little narrower as it goes down))
turn("WanSoup", [(0.043, 0.0)], [MISO], [], cap_hi=0, uv_planar=0.045)

# ---------------------------------------------------------------------------------------------------- the paddle and the ladle
# (the paddle: a flat oval blade on a short handle, the grip at the origin, out along +z; 3 mm thick)
blade = [(0.028 * math.cos(a), 0.058 + 0.036 * math.sin(a)) for a in [math.radians(d) for d in range(-62, 243, 23)]]
outline = [(0.0075, 0.0)] + list(reversed([(x, z) for x, z in blade if x > 0])) + [(x, z) for x, z in blade if x <= 0] + [(-0.0075, 0.0)]
outline = [(0.0075, 0.0), (0.0085, 0.024)] + sorted([q for q in blade], key=lambda q: math.atan2(q[1] - 0.058, q[0]))[::-1] + [(-0.0085, 0.024), (-0.0075, 0.0)]
flat("Shamoji", outline, 0.003, SHAMOJI, 0.1)
# (the ladle: a round cup 5.6 cm across, its handle up and back from its rim to the grip, the origin; open, drawn both sides by the game)
cup = turn("OtamaCup", [(0.006, 0.0), (0.016, 0.003), (0.025, 0.011), (0.028, 0.022)], [OTAMA], [0, 0, 0], cap_lo=0)
handle = bar("OtamaHandle", [(0.028, 0.02, 0.0), (0.06, 0.06, 0.0), (0.17, 0.11, 0.0), (0.185, 0.106, 0.0)], 0.006, OTAMA)
parts.remove(cup)
parts.remove(handle)
otama = join([cup, handle], "Otama")
parts.append(otama)
# (the grip, the handle's end, at the origin)
for vtx in otama.data.vertices:
    vtx.co -= P(0.185, 0.106, 0.0)
turn("OtamaSoup", [(0.025, 0.0)], [MISO], [], cap_hi=0, uv_planar=0.03)
for vtx in parts[-1].data.vertices:
    vtx.co += P(-0.185, 0.018 - 0.106, 0.0)

# ---------------------------------------------------------------------------------------------------- the tray
# (a rounded oblong, 28 by 20 cm, a low rim: its outer wall, the rim's top, the inside down to its floor)
def rrect(w, d_, r, n=4):
    pts = []
    for cx_, cz_, a0 in ((w / 2 - r, d_ / 2 - r, 0), (-w / 2 + r, d_ / 2 - r, 90), (-w / 2 + r, -d_ / 2 + r, 180), (w / 2 - r, -d_ / 2 + r, 270)):
        for k in range(n):
            a = math.radians(a0 + 90 * k / (n - 1))
            pts.append((cx_ + r * math.cos(a), cz_ + r * math.sin(a)))
    return pts


bm = bmesh.new()
levels = [(rrect(0.28, 0.2, 0.03), 0.0), (rrect(0.28, 0.2, 0.03), 0.016), (rrect(0.268, 0.188, 0.024), 0.016), (rrect(0.268, 0.188, 0.024), 0.006)]
vrings = [[bm.verts.new(P(x, h, z)) for x, z in pts] for pts, h in levels]
n = len(vrings[0])
for k, (a_, b_) in enumerate(zip(vrings, vrings[1:])):
    for i in range(n):
        f = bm.faces.new((a_[i], a_[(i + 1) % n], b_[(i + 1) % n], b_[i]))
        f.material_index = 0
for f in ladder_fill(bm, vrings[-1]):
    f.material_index = 1
for f in ladder_fill(bm, list(reversed(vrings[0]))):
    f.material_index = 0
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Bon")
bm.to_mesh(me)
bm.free()
bon = bpy.data.objects.new("Bon", me)
bpy.context.collection.objects.link(bon)
bon.data.materials.append(BON_BLACK)
bon.data.materials.append(BON_FLOOR)
planar_uv(bon, 0.15)
parts.append(bon)

# ---------------------------------------------------------------------------------------------------- out
for o in parts:
    o.location = (0, 0, 0)
root = bpy.data.objects.new("SideBowls", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("SIDEBOWLS_FACES", {o.name: len(o.data.polygons) for o in parts})
if PREVIEW:
    # (laid out in a row for the preview, a camera on them)
    for k, o in enumerate(parts):
        o.location = ((k % 5) * 0.16 - 0.32, -(k // 5) * 0.2, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.0, -0.75, 0.42)
    cam.rotation_euler = (math.radians(62), 0, 0)
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(20), math.radians(30))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new("W")
    world.color = (0.35, 0.33, 0.3)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "sidebowls.glb"), os.path.join(PROJECT, "blender", "sidebowls.blend"), PREVIEW)
if PREVIEW:
    for o in parts:
        o.location = (0, 0, 0)
print("SIDEBOWLS_DONE", len(parts))
