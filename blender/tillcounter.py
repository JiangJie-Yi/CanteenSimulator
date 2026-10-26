"""The till counter by the door: its dark wooden body (open on the cashier's side, two shelves inside, hinoki battens up the customers' face,
a kick board, a round window in its end lit from within like a paper lantern, its ring and lattice pale keyaki), green bamboo up the customers' face
(loose and each culm its own, a warm light behind them showing through), a white marble top with grey veins overhanging all round,
and a walnut partition of fine slats along the customers' side and down the end by the cats.

Run:
    blender -b --factory-startup --python blender/tillcounter.py -- <project path> [preview.png]
Writes public/models/tillcounter.glb and blender/tillcounter.blend.

Frame: the till's own (GuestBar3D's Register group): +y up, x along the bar, the cashier at +z, the customers at -z; the top's surface at
TOP. Node names the game looks for: TillCounterBody, TillCounterTop (the marble), TillShield (the partition), TillWindowPaper and TillBambooGlow (lit).
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

seed(21)
bpy.ops.wm.read_factory_settings(use_empty=True)

W, D, TOP = 1.2, 0.82, 0.86


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- textures: the marble (white, soft grey clouds, fine dark veins), the hinoki battens' grain, the body's dark wood
N = 512
u, v = grid01(N)
warp = fbm(N, 3, 3, 5)
vein = np.abs(np.sin((u * 2.2 + v * 1.1 + warp * 2.6) * math.pi * 2.0))
veins = smooth(0.06, 0.0, vein) * 0.75 + smooth(0.18, 0.0, np.abs(np.sin((u * 5 - v * 3 + warp * 4) * math.pi))) * 0.25
cloud = fbm(N, 4, 4, 5)
marble = mix(mix((0.95, 0.95, 0.94), (0.86, 0.86, 0.87), cloud * 0.6), (0.48, 0.5, 0.53), np.clip(veins, 0, 1) * 0.8)
marble_tex = image("marble", marble)
g2 = fbm(256, 2, 50, 4)
batten_tex = image("batten", mix((0.8, 0.62, 0.4), (0.7, 0.52, 0.32), smooth(0.4, 0.8, g2)))
# (green bamboo: a fresh green, paler streaks running along the culm, a faint bloom)
bu, bv = grid01(256)
streak = fbm(256, 40, 2, 4)
fibre_b = fbm(256, 90, 3, 3)
light_b = np.exp(-((bu - 0.32) / 0.12) ** 2)          # (a soft lit streak down one side of the culm)
bamboo_base = mix(mix((0.3, 0.52, 0.16), (0.4, 0.62, 0.22), streak), (0.62, 0.76, 0.38), smooth(0.8, 1.0, streak) * 0.4)
bamboo_base = mix(bamboo_base, (0.25, 0.44, 0.13), smooth(0.55, 0.95, fibre_b) * 0.35)
bamboo_tex = image("bamboo", mix(bamboo_base, (0.78, 0.88, 0.55), light_b * 0.35))
# (the window's paper, lit from behind like a paper lantern: brightest in the middle where the lamp is, warmer and dimmer toward the rim,
# the paper's long fibres showing through)
gu, gv = grid01(256)
rr = np.sqrt((gu - 0.5) ** 2 + (gv - 0.5) ** 2) * 2
fibre = fbm(256, 30, 3, 4) * 0.5 + fbm(256, 3, 30, 4) * 0.5
lamp = np.clip(1 - rr * 0.55, 0, 1) ** 1.4
paper_tex = image("windowpaper", mix(mix((0.86, 0.55, 0.26), (1.0, 0.93, 0.78), lamp), (0.96, 0.8, 0.55), smooth(0.55, 0.9, fibre) * 0.25))
# (the light behind the bamboo: a warm strip lamp along the foot and another under the top, the wall between them washed more softly)
lv = gv
wash = np.clip(np.exp(-lv / 0.16) + 0.75 * np.exp(-(1 - lv) / 0.14) + 0.18, 0, 1)
bamboo_glow_tex = image("bambooglow", mix((0.12, 0.06, 0.02), (1.0, 0.8, 0.5), wash))
# (the window's ring and lattice: a pale keyaki, its grain showing)
kg = fbm(256, 2, 46, 5)
keyaki_tex = image("keyaki", mix((0.78, 0.6, 0.4), (0.64, 0.46, 0.29), smooth(0.35, 0.8, kg)))
# (the partition: walnut for its frame and slats, a pale hinoki board behind the slats)
pg = fbm(256, 3, 70, 5)
walnut_tex = image("walnut", mix(mix((0.2, 0.12, 0.07), (0.3, 0.19, 0.11), smooth(0.3, 0.75, pg)), (0.13, 0.08, 0.05), smooth(0.7, 0.95, fbm(256, 2, 18, 4)) * 0.6))
dark_tex = image("darkwood", mix((0.25, 0.17, 0.11), (0.2, 0.13, 0.08), fbm(256, 2, 40, 4)))

M = {
    "body": pbr("TillBodyWood", (1, 1, 1), tex=dark_tex, rough=0.6),
    "shelf": pbr("TillShelf", lin("#4a3626"), rough=0.6),
    "batten": pbr("TillBatten", (1, 1, 1), tex=batten_tex, rough=0.55),
    "kick": pbr("TillKick", lin("#22180f"), rough=0.6),
    "marble": pbr("TillMarble", (1, 1, 1), tex=marble_tex, rough=0.12),
    "frame": pbr("TillShieldFrame", lin("#c7a174"), tex=batten_tex, rough=0.5),
    "acrylic": pbr("TillAcrylic", lin("#eef6fa"), rough=0.02),
    "ring": pbr("TillWindowRing", (1, 1, 1), tex=keyaki_tex, rough=0.5),
    "paper": pbr("TillWindowPaper", (1, 1, 1), tex=paper_tex, rough=0.9, emit=(1, 0.85, 0.6), emit_strength=1.5),
    "bambooGlow": pbr("TillBambooGlow", (1, 1, 1), tex=bamboo_glow_tex, rough=1.0, emit=(1, 0.8, 0.5), emit_strength=1.0),
    "walnut": pbr("TillShieldWalnut", (1, 1, 1), tex=walnut_tex, rough=0.4),
    "slatBack": pbr("TillShieldBack", (1, 1, 1), tex=batten_tex, rough=0.6),
    "shoe": pbr("TillShieldShoe", lin("#2a2622"), rough=0.35, metal=0.6),
    "bamboo": pbr("TillBamboo", (1, 1, 1), tex=bamboo_tex, rough=0.35),
    **{f"bamboo{i}": pbr(f"TillBamboo{i}", (1, 1, 1), tex=bamboo_tex, rough=0.35) for i in range(5)},
    "node": pbr("TillBambooNode", lin("#4e5a22"), rough=0.5),
    "lip": pbr("TillBambooLip", lin("#a8c468"), rough=0.4),
    "rope": pbr("TillRope", lin("#1c140e"), rough=0.9),
    "lattice": pbr("TillLattice", (1, 1, 1), tex=keyaki_tex, rough=0.5),
}


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def smooth_angle(o, deg=35):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))


def uv_box(o, size=0.6):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def box(name, size, at, mat_, bev=0.0, rot=(0, 0, 0), uv=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat_, smooth_shade=False)
    if bev:
        bevel(o, bev, 3, angle=False)
        apply_mods(o)
        smooth_angle(o)
    if uv:
        uv_box(o, uv)
    return o


def cyl(name, r, depth, at, mat_, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat_)
    smooth_angle(o, 40)
    return o


def node(name, parts):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    for o in parts:
        if o.parent is None:
            o.parent = e
    return e, parts


nodes = []
# =====================================================================
# The body: the customers' face and the two ends, two shelves, battens, kick board, the round window in the end toward the door
# =====================================================================
bd = []
H = TOP - 0.05
bd.append(box("TillFace", S(W - 0.04, H, 0.08), P(0, H / 2, -D / 2 + 0.06), M["body"], bev=0.006, uv=0.6))
for sx in (-1, 1):
    end = box(f"TillEnd{sx}", S(0.06, H, D - 0.06), P(sx * (W / 2 - 0.05), H / 2, 0.02), M["body"], bev=0.006, uv=0.6)
    if sx == 1:
        # (the round window: a hole through the end, its ring and lattice and lit paper set in it)
        hole_ = cyl("win", 0.2, 0.2, P(W / 2 - 0.05, H / 2 + 0.03, 0.02), M["body"], rot=(0, math.pi / 2, 0), verts=48)
        m_ = end.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = hole_; m_.solver = "EXACT"
        apply_mods(end)
        bpy.data.objects.remove(hole_)
    bd.append(end)
WX = W / 2 - 0.05
WY = H / 2 + 0.03
# (the ring round the opening, standing a little proud of the end; a sleeve of the same pale wood lining the hole back to the paper)
bpy.ops.mesh.primitive_torus_add(major_radius=0.213, minor_radius=0.017, major_segments=64, minor_segments=12, location=P(W / 2 - 0.016, WY, 0.02), rotation=(0, math.pi / 2, 0))
ring = active()
finish(ring, "TillWindowRing", M["ring"])
uv_box(ring, 0.3)
bd.append(ring)
sleeve = cyl("TillWindowSleeve", 0.201, 0.05, P(W / 2 - 0.045, WY, 0.02), M["ring"], rot=(0, math.pi / 2, 0), verts=64)
inner_ = cyl("sl", 0.193, 0.06, P(W / 2 - 0.045, WY, 0.02), M["ring"], rot=(0, math.pi / 2, 0), verts=64)
m_ = sleeve.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = inner_; m_.solver = "EXACT"
apply_mods(sleeve)
bpy.data.objects.remove(inner_)
uv_box(sleeve, 0.3)
bd.append(sleeve)
# (the paper, set back near the inside face of the end: lit from within, a lantern's glow, not a light thrown outward)
paper = cyl("TillWindowPaper", 0.196, 0.003, P(W / 2 - 0.066, WY, 0.02), M["paper"], rot=(0, math.pi / 2, 0), verts=64)
bpy.ops.object.select_all(action="DESELECT"); paper.select_set(True); bpy.context.view_layer.objects.active = paper
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=0.4); bpy.ops.object.mode_set(mode="OBJECT")
bd.append(paper)
# (the lattice just in front of the paper: three bars each way, their ends let into the sleeve)
for k in (-1, 0, 1):
    L = 2 * math.sqrt(0.196 ** 2 - (k * 0.095) ** 2)
    bd.append(box(f"TillLatticeV{k}", S(0.012, L, 0.011), P(W / 2 - 0.058, WY, 0.02 + k * 0.095), M["lattice"], bev=0.0015, uv=0.3))
    bd.append(box(f"TillLatticeH{k}", S(0.012, 0.011, L), P(W / 2 - 0.057, WY + k * 0.095, 0.02), M["lattice"], bev=0.0015, uv=0.3))
bd.append(box("TillShelfLow", S(W - 0.14, 0.03, D - 0.14), P(0, 0.1, 0.03), M["shelf"], bev=0.003))
bd.append(box("TillShelfHigh", S(W - 0.14, 0.025, D - 0.2), P(0, TOP - 0.2, 0.04), M["shelf"], bev=0.003))
BH = TOP - 0.1                            # how tall the culms stand (from just above the kick board to under the top)
FACE_Z = -D / 2 + 0.02                    # the face behind them
GAP_BACK = 0.012                          # how far they stand off it, so the light behind shows round them
brng = np.random.default_rng(5)


def culm(name, x, r, y0, h, z, lean, bow, phase, nodes_at, swell, shade):
    """a culm of bamboo: rings of verts up its length (close together round each node, so its shape shows), tapering a little, leaning and
    bowed, thicker and thinner along its length (`swell`: amount, wavelength, phase), and at each node a sharp ridge with the sheath's scar
    just under it and a little pinch above"""
    bm_ = bmesh.new()
    seg = 20
    uvl = bm_.loops.layers.uv.new("UVMap")
    ys = {round(y0 + h * i / 36, 5) for i in range(37)}
    for n in nodes_at:
        for d in (-0.016, -0.011, -0.008, -0.006, -0.004, -0.0025, -0.001, 0.0, 0.001, 0.0025, 0.004, 0.006, 0.009, 0.013, 0.018):
            if y0 < n + d < y0 + h:
                ys.add(round(n + d, 5))
    ys = sorted(ys)
    sa, sl, sp = swell

    def radius(y):
        t = (y - y0) / h
        rad = r * (1 - 0.07 * t) * (1 + sa * math.sin(2 * math.pi * (y - y0) / sl + sp))
        for n in nodes_at:
            d = y - n
            # (the ridge, sharp; the sheath's scar a little below it; the pinch just above)
            rad *= 1 + 0.07 * math.exp(-(d / 0.0024) ** 2) + 0.025 * math.exp(-((d + 0.006) / 0.003) ** 2) - 0.03 * math.exp(-((d - 0.009) / 0.006) ** 2)
        return rad

    def centre(y):
        t = (y - y0) / h
        return (x + lean * (y - y0) + bow * math.sin(math.pi * t + phase) * math.sin(math.pi * t), z + bow * 0.4 * math.sin(math.pi * t))

    grid = []
    for y in ys:
        cx, cz = centre(y)
        rad = radius(y)
        grid.append([bm_.verts.new(P(cx + rad * math.cos(2 * math.pi * j / seg), y, cz + rad * math.sin(2 * math.pi * j / seg))) for j in range(seg)])
    for i in range(len(ys) - 1):
        v0, v1 = (ys[i] - y0) / h, (ys[i + 1] - y0) / h
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm_.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
            for lp, (uu, vv) in zip(f.loops, ((j / seg, v0), ((j + 1) / seg, v0), ((j + 1) / seg, v1), (j / seg, v1))):
                lp[uvl].uv = (uu, vv * 3)
    bm_.faces.new(list(reversed(grid[0])))
    bm_.faces.new(grid[-1])
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me_ = bpy.data.meshes.new(name)
    bm_.to_mesh(me_)
    bm_.free()
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    finish(o, name, M[f"bamboo{shade}"])
    out = [o]
    # (each node: the joint a fine dark line round the ridge, the lip just over it a little paler)
    for n in nodes_at:
        for dy, k, mn, m in ((0.0, 0.985, 0.0012, "node"), (0.0028, 0.99, 0.0011, "lip")):
            cx, cz = centre(n + dy)
            bpy.ops.mesh.primitive_torus_add(major_radius=radius(n + dy) * k, minor_radius=mn, major_segments=28, minor_segments=5, location=P(cx, n + dy, cz))
            out.append(finish(active(), f"{name}Node{int(n * 1000)}{'ab'[dy > 0]}", M[m]))
    return out


# (laid along the face one by one: each a little thicker or thinner than the last, with a gap between that's never the same twice)
x = -(W - 0.08) / 2
k = 0
culms = []
while True:
    r = float(brng.uniform(0.012, 0.021))
    if x + 2 * r > (W - 0.08) / 2:
        break
    cx = x + r
    z = FACE_Z - GAP_BACK - r - float(brng.uniform(0, 0.006))
    first = float(brng.uniform(0.06, 0.2))
    step = float(brng.uniform(0.16, 0.24))
    nodes_at = [0.06 + first + n * step for n in range(6) if 0.06 + first + n * step < 0.06 + BH - 0.04]
    o = culm(f"TillBamboo{k}", cx, r, 0.06, BH - float(brng.uniform(0, 0.012)), z,
             float(brng.normal(0, 0.012)), float(brng.uniform(-0.006, 0.006)), float(brng.uniform(0, 1.0)), nodes_at,
             (float(brng.uniform(0.04, 0.11)), float(brng.uniform(0.25, 0.6)), float(brng.uniform(0, 6.28))), int(brng.integers(0, 5)))
    bd += o
    culms.append((cx, r, z))
    x += 2 * r + float(brng.uniform(0.005, 0.018))
    k += 1
# (the light behind them: a warm panel on the face, the strip lamps' glow at its foot and head)
bpy.ops.mesh.primitive_plane_add(size=1, location=P(0, 0.06 + BH / 2, FACE_Z - 0.0015), rotation=(-math.pi / 2, 0, 0))
glow = active()
glow.scale = (W - 0.08, BH, 1)
apply_scale(glow)
bd.append(finish(glow, "TillBambooGlow", M["bambooGlow"], smooth_shade=False))
# (two bamboo rails across the front, tied to every third culm with black palm rope)
RZ = min(z for _, _, z in culms) - 0.021 - 0.012
for yy in (0.17, TOP - 0.17):
    bd.append(cyl(f"TillBambooRail{int(yy * 100)}", 0.011, W - 0.07, P(0, yy, RZ), M["bamboo"], rot=(0, math.pi / 2, 0), verts=14))
    for i, (cx, r, z) in enumerate(culms):
        if i % 3:
            continue
        bpy.ops.mesh.primitive_torus_add(major_radius=0.013, minor_radius=0.0026, major_segments=12, minor_segments=5, location=P(cx, yy, RZ + 0.004), rotation=(0, math.pi / 2, 0))
        bd.append(finish(active(), f"TillRope{int(yy * 100)}_{i}", M["rope"]))
bd.append(box("TillKick", S(W - 0.06, 0.06, 0.02), P(0, 0.03, -D / 2 + 0.035), M["kick"], bev=0.002))
nodes.append(node("TillCounterBody", bd))

# =====================================================================
# The top: a slab of white marble, its corners rounded, its edges eased, overhanging all round
# =====================================================================
TW_, TD_, TT = W + 0.1, D + 0.1, 0.06
bm = bmesh.new()
R = 0.07
pts = []
for cx, cz, a0 in ((TW_ / 2 - R, -TD_ / 2 + R, -90), (TW_ / 2 - R, TD_ / 2 - R, 0), (-TW_ / 2 + R, TD_ / 2 - R, 90), (-TW_ / 2 + R, -TD_ / 2 + R, 180)):
    for k in range(13):
        a = math.radians(a0 + 90 * k / 12)
        pts.append((cx + R * math.cos(a), cz + R * math.sin(a)))
lo = [bm.verts.new(P(x, TOP - TT, z - 0.03)) for x, z in pts]
hi = [bm.verts.new(P(x, TOP, z - 0.03)) for x, z in pts]
bm.faces.new(list(reversed(lo)))
bm.faces.new(hi)
for i in range(len(pts)):
    j = (i + 1) % len(pts)
    bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("TillMarble")
bm.to_mesh(me)
bm.free()
top = bpy.data.objects.new("TillMarble", me)
bpy.context.collection.objects.link(top)
finish(top, "TillMarble", M["marble"], smooth_shade=False)
bevel(top, 0.008, 4, angle=True)
apply_mods(top)
smooth_angle(top, 40)
uv_box(top, 1.4)
nodes.append(node("TillCounterTop", [top]))

# =====================================================================
# The partition: walnut, along the customers' side (from a little in from its left end) and down the end by the cats to the cashier's
# edge. A dark bronze shoe where it meets the marble, a bottom and a top rail, posts at each end and corner and every so often between,
# and between them fine vertical slats (立て格子) over a pale hinoki board, a capping rail along the top with its edges eased; round posts
# at the two open ends
# =====================================================================
sh = []
SH = 0.26                                  # its height above the top
FT = 0.024                                 # the frame's thickness
ZF = -0.03 - TD_ / 2 + 0.035               # the customers' side, a little in from the edge
XE = TW_ / 2 - 0.035                       # the end by the cats
XL = -XE + 0.29                            # where it starts at the customers' left (the end by the bell is left open)
ZB = TD_ / 2 - 0.03 - 0.04                 # where the end run stops: at the cashier's edge
SHOE, RAIL, CAP = 0.008, 0.026, 0.022
RC = 0.05                                  # the corner's radius (at the middle of the partition's thickness)
YT = TOP + SH - CAP                        # the top rail's top, under the cap
Y0 = TOP + SHOE                            # the bottom rail's foot, on the shoe


def path(ext=0.0, n_arc=14):
    """the partition's line, from its customers'-side start round the rounded corner by the cats to the cashier's edge, as (x, z) points"""
    pts = [(XL - ext, ZF)]
    cx, cz = XE - RC, ZF + RC
    for i in range(n_arc + 1):
        a_ = math.radians(-90 + 90 * i / n_arc)
        pts.append((cx + RC * math.cos(a_), cz + RC * math.sin(a_)))
    pts.append((XE, ZB + ext))
    return pts


def profile(hw, y0, y1, rc, seg=4):
    """a rectangle across the line (half-width hw, from y0 to y1) with its corners rounded off (radius rc), as (across, up) points"""
    out = []
    for (cl, cy, a0) in ((hw - rc, y0 + rc, -90), (hw - rc, y1 - rc, 0), (-hw + rc, y1 - rc, 90), (-hw + rc, y0 + rc, 180)):
        for i in range(seg + 1):
            a_ = math.radians(a0 + 90 * i / seg)
            out.append((cl + rc * math.cos(a_), cy + rc * math.sin(a_)))
    return out


def sweep(name, prof, pts, mat_):
    """the profile carried along the line (each ring square to it), its two ends closed"""
    bm_ = bmesh.new()
    rings = []
    for i, (px, pz) in enumerate(pts):
        ax, az = pts[max(0, i - 1)]
        bx, bz = pts[min(len(pts) - 1, i + 1)]
        tx, tz = bx - ax, bz - az
        L = math.hypot(tx, tz)
        tx, tz = tx / L, tz / L
        nx, nz = -tz, tx
        rings.append([bm_.verts.new(P(px + nx * l, y, pz + nz * l)) for l, y in prof])
    m = len(prof)
    for i in range(len(rings) - 1):
        for j in range(m):
            bm_.faces.new((rings[i][j], rings[i][(j + 1) % m], rings[i + 1][(j + 1) % m], rings[i + 1][j]))
    bm_.faces.new(rings[0])
    bm_.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me_ = bpy.data.meshes.new(name)
    bm_.to_mesh(me_)
    bm_.free()
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    finish(o, name, mat_)
    smooth_angle(o, 50)
    uv_box(o, 0.4)
    return o


sh.append(sweep("TillShoe", profile((FT + 0.006) / 2, TOP, TOP + SHOE, 0.002), path(), M["shoe"]))
sh.append(sweep("TillRailLow", profile(FT / 2, Y0, Y0 + RAIL, 0.004), path(), M["walnut"]))
sh.append(sweep("TillRailTop", profile(FT / 2, YT - RAIL, YT, 0.004), path(), M["walnut"]))
sh.append(sweep("TillCap", profile((FT + 0.018) / 2, YT, YT + CAP, 0.007), path(), M["walnut"]))
# (the posts: round ones at the two open ends, standing the full height with a domed top over the cap's end; a round one at the corner;
# square ones about every 30 cm along each straight run)
for tag, (ex, ez) in (("Start", (XL, ZF)), ("End", (XE, ZB))):
    pr = (FT + 0.018) / 2 + 0.002
    sh.append(cyl(f"TillPost{tag}", pr, YT + CAP - TOP, P(ex, (TOP + YT + CAP) / 2, ez), M["walnut"], verts=40))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=pr, segments=40, ring_count=16, location=P(ex, YT + CAP, ez))
    dome = active()
    dome.scale = (1, 1, 0.35)
    apply_scale(dome)
    sh.append(finish(dome, f"TillPost{tag}Top", M["walnut"]))
mid = path()[8]
sh.append(cyl("TillPostCorner", FT / 2 + 0.006, YT - Y0, P(mid[0], (Y0 + YT) / 2, mid[1]), M["walnut"], verts=32))


def straight(x0, z0, x1, z1, tag):
    """one straight run (from its open end to where the corner's curve begins): the pale hinoki board between the rails, the fine walnut
    slats (立て格子) standing on both faces of it, and the square posts along it (none at the open end: the round post is there)"""
    L = math.hypot(x1 - x0, z1 - z0)
    ux, uz = (x1 - x0) / L, (z1 - z0) / L
    rot = (0, 0, -math.atan2(uz, ux))
    at = lambda t, y, off=0.0: P(x0 + ux * t - uz * off, y, z0 + uz * t + ux * off)   # noqa: E731
    n = max(1, round(L / 0.32))
    for i in range(1, n):
        sh.append(box(f"TillPost{tag}{i}", S(0.03, YT - Y0, FT + 0.004), at(L * i / n, (Y0 + YT) / 2), M["walnut"], bev=0.003, rot=rot, uv=0.4))
    ph = YT - Y0 - 2 * RAIL
    pc = Y0 + RAIL + ph / 2
    sh.append(box(f"TillBack{tag}", S(L, ph, 0.006), at(L / 2, pc), M["slatBack"], rot=rot, uv=0.4))
    m = int((L - 0.03) / 0.021)
    for i in range(m):
        t = 0.03 + (L - 0.04) * (i + 0.5) / m
        for side in (-1, 1):
            sh.append(box(f"TillSlat{tag}{i}{'ab'[side > 0]}", S(0.011, ph, 0.007), at(t, pc, side * 0.007), M["walnut"], bev=0.0015, rot=rot, uv=0.4))


straight(XL, ZF, XE - RC, ZF, "F")
straight(XE, ZB, XE, ZF + RC, "E")
# (round the corner too: the board behind in short pieces following the curve, and the slats on it, so the run never breaks)
arc = path()[1:16]
ph = YT - Y0 - 2 * RAIL
pc = Y0 + RAIL + ph / 2
for i in range(len(arc) - 1):
    (ax, az), (bx, bz) = arc[i], arc[i + 1]
    L = math.hypot(bx - ax, bz - az)
    sh.append(box(f"TillBackC{i}", S(L + 0.002, ph, 0.006), P((ax + bx) / 2, pc, (az + bz) / 2), M["slatBack"], rot=(0, 0, -math.atan2(bz - az, bx - ax)), uv=0.4))
for k in range(1, 4):
    a_ = math.radians(-90 + 90 * k / 4)
    tx, tz = -math.sin(a_), math.cos(a_)
    for side in (-1, 1):
        r_ = RC - side * 0.007
        sh.append(box(f"TillSlatC{k}{'ab'[side > 0]}", S(0.011, ph, 0.007), P(XE - RC + r_ * math.cos(a_), pc, ZF + RC + r_ * math.sin(a_)), M["walnut"], bev=0.0015,
                      rot=(0, 0, -math.atan2(tz, tx)), uv=0.4))
nodes.append(node("TillShield", sh))

root = bpy.data.objects.new("TillCounter", None)
bpy.context.collection.objects.link(root)
parts = []
for e, ps in nodes:
    e.parent = root
    parts += [e] + ps

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (1.6, -1.6, 1.7)
    cam.rotation_euler = (Vector((0, 0, 0.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35
    bpy.context.scene.camera = cam
    for loc, e in (((2, -2, 3), 900), ((-2, -1, 1.5), 300), ((0, 2.5, 2), 300)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "tillcounter.glb"), os.path.join(PROJECT, "blender", "tillcounter.blend"), PREVIEW)
print("TILLCOUNTER_DONE", len(parts), "parts")
