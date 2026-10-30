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
from mathutils import Matrix, Vector

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
def flatsawn(n, light, dark, line, rings=11.0, seed_u=0.5):
    """a flat-sawn board's face: growth rings cut through at a slant, so they come out as nested arches and long ellipses along the board
    (u across it, v along it), wavering; the latewood a fine darker line in each, pores flecked along the grain"""
    uu, vv = grid01(n)
    wob = fbm(n, 3, 3, 4) - 0.5
    d = np.sqrt(((uu - seed_u) * 3.2 + wob * 0.5) ** 2 + ((vv + 0.35) * 0.9 + wob * 0.25) ** 2)
    ring = (d * rings + fbm(n, 2, 6, 3) * 0.8) % 1.0
    late = smooth(0.72, 0.9, ring) * (1 - smooth(0.9, 1.0, ring))
    body = mix(light, dark, smooth(0.15, 0.85, ring) * 0.55)
    body = mix(body, line, late * 0.75)
    pores = (fbm(n, 70, 4, 3) > 0.62).astype(np.float32)
    return mix(body, line, pores * 0.18)


# (green bamboo: a fresh green, paler streaks running along the culm, a faint bloom; the texture is one length between two nodes (v 0 at a
# node, 1 at the next), so the nodes are painted: the joint a fine dark line, the lip just over it paler, the sheath's scar darker just under
# the next node, and a shade where the culm swells to its ridge (the culm's mesh is plain and light: what it lacks the picture gives))
bu, bv = grid01(512)
streak = fbm(512, 40, 2, 4)
fibre_b = fbm(512, 90, 3, 3)
light_b = np.exp(-((bu - 0.32) / 0.12) ** 2)          # (a soft lit streak down one side of the culm)
bamboo_base = mix(mix((0.3, 0.52, 0.16), (0.4, 0.62, 0.22), streak), (0.62, 0.76, 0.38), smooth(0.8, 1.0, streak) * 0.4)
bamboo_base = mix(bamboo_base, (0.25, 0.44, 0.13), smooth(0.55, 0.95, fibre_b) * 0.35)
bamboo_base = mix(bamboo_base, (0.78, 0.88, 0.55), light_b * 0.35)
_wob = (fbm(512, 8, 1, 2) - 0.5) * 0.004
_vn = bv + _wob
bamboo_base = mix(bamboo_base, (0.2, 0.3, 0.08), np.exp(-((_vn - 0.0) / 0.012) ** 2) * 0.45)          # (the ridge's shade, either side)
bamboo_base = mix(bamboo_base, (0.2, 0.3, 0.08), np.exp(-((_vn - 1.0) / 0.012) ** 2) * 0.45)
bamboo_base = mix(bamboo_base, (0.42, 0.42, 0.24), np.exp(-((_vn - 0.965) / 0.012) ** 2) * 0.35)      # (the sheath's scar)
bamboo_base = mix(bamboo_base, (0.68, 0.78, 0.42), np.exp(-((_vn - 0.016) / 0.007) ** 2) * 0.7)       # (the lip, paler)
bamboo_base = mix(bamboo_base, (0.23, 0.27, 0.1), ((_vn < 0.006) | (_vn > 0.994)).astype(np.float32) * 0.9)  # (the joint's line)
bamboo_tex = image("bamboo", bamboo_base)
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
kg = fbm(512, 3, 40, 5)
kl = (np.sin((grid01(512)[1] * 34 + fbm(512, 4, 3, 4) * 3.0) * math.pi * 2) * 0.5 + 0.5)
keyaki = mix(mix((0.8, 0.62, 0.42), (0.68, 0.49, 0.31), smooth(0.3, 0.85, kg)), (0.5, 0.34, 0.2), smooth(0.8, 1.0, kl) * 0.55)
keyaki_tex = image("keyaki", mix(keyaki, (0.5, 0.34, 0.2), (fbm(512, 60, 3, 3) > 0.64).astype(np.float32) * 0.15))
# (the lattice and anything boxy in keyaki: the same wood, flat-sawn)
keyaki_flat_tex = image("keyakiflat", flatsawn(512, (0.8, 0.63, 0.43), (0.7, 0.52, 0.33), (0.48, 0.32, 0.19), rings=9.0))
# (the partition: walnut for its frame and slats, a pale hinoki board behind the slats)
pg = fbm(256, 3, 70, 5)
def soft_walnut(n):
    """the partition's walnut: a soft, uneven grain, mostly long and straight with now and then a wandering arch, the lines faint and broken,
    warm patches of lighter and darker wood through it; never a regular pattern"""
    uu, vv = grid01(n)
    wob = (fbm(n, 2, 5, 4) - 0.5) * 0.4 + (fbm(n, 1, 2, 3) - 0.5) * 0.3
    phase = (uu + wob * 0.12) * 38 + fbm(n, 3, 8, 3) * 2.5
    lines = (np.sin(phase * math.pi * 2) * 0.5 + 0.5) * fbm(n, 6, 2, 4)
    d = np.sqrt(((uu - 0.55) * 2.4 + wob) ** 2 + ((vv + 0.5) * 0.7) ** 2)
    arch = smooth(0.8, 0.96, (d * 6 + fbm(n, 2, 5, 3)) % 1.0) * smooth(0.45, 0.8, fbm(n, 2, 3, 3))
    patch = fbm(n, 2, 3, 4)
    col = mix((0.5, 0.33, 0.21), (0.38, 0.25, 0.15), patch)
    col = mix(col, (0.28, 0.18, 0.11), smooth(0.5, 0.95, lines) * 0.28 + arch * 0.22)
    return mix(col, (0.24, 0.15, 0.09), (fbm(n, 4, 90, 2) > 0.7).astype(np.float32) * 0.12)


def hinoki_board(n):
    """the pale hinoki board behind the slats: its grain fine and close, gently wavering, some lines stronger than others, a few soft knots'
    swirls, a faint warm blush here and there"""
    uu, vv = grid01(n)
    wob = (fbm(n, 2, 4, 4) - 0.5) * 0.08
    phase = (uu + wob) * 70 + fbm(n, 4, 6, 3) * 3
    lines = smooth(0.55, 0.95, (np.sin(phase * math.pi * 2) * 0.5 + 0.5) * (0.5 + 0.5 * fbm(n, 8, 2, 3)))
    knot = np.zeros((n, n), np.float32)
    for kx, ky in ((0.3, 0.25), (0.72, 0.68), (0.15, 0.8)):
        r = np.sqrt(((uu - kx) * 3) ** 2 + ((vv - ky) * 1.2) ** 2)
        knot = np.maximum(knot, smooth(0.9, 0.0, r) * (np.sin(r * 60) * 0.5 + 0.5))
    col = mix((0.86, 0.72, 0.52), (0.8, 0.63, 0.43), fbm(n, 2, 3, 4))
    col = mix(col, (0.66, 0.5, 0.33), lines * 0.35 + knot * 0.3)
    return col


walnut_tex = image("walnut", soft_walnut(512))
hinoki_back_tex = image("hinokiback", hinoki_board(512))
# (the partition's lattice (立て格子) as a picture: four walnut slats across a tile, the pale hinoki board between them shadowed at their
# edges, each slat's edges eased (darker), a sheen down one side; and a normal map from its relief, so the slats stand off the board in the
# light)
_su, _sv = grid01(512)
_ph = (_su * 4) % 1.0                                      # (across one slat's period)
_half = 0.011 / 0.021 / 2
_d = np.abs(_ph - 0.5)                                     # (from the slat's middle)
_slat = smooth(_half + 0.012, _half - 0.012, _d)
_wal = soft_walnut(512)
_hin = hinoki_board(512)
_gap_shade = np.exp(-((_d - _half) / 0.06) ** 2)          # (the board's shadow close by each slat)
lat = mix(_hin, _hin * 0.45, _gap_shade * (1 - _slat) * 0.6)
_edge = smooth(_half - 0.07, _half, _d) * _slat
_sheen = np.exp(-((_ph - 0.43) / 0.05) ** 2) * _slat
lat = mix(lat, _wal, _slat)
lat = mix(lat, _wal * 0.55, _edge * 0.7)
lat = mix(lat, np.clip(_wal * 1.5, 0, 1), _sheen * 0.35)
slat_tex = image("shieldslats", lat)
_hgt = _slat * (1 - 0.5 * smooth(_half - 0.08, _half, _d))
slat_nrm = image("shieldslatsN", to_normal(_hgt.astype(np.float32), 3.0), data=True)
# (the body's dark wood and its shelves: the partition's soft walnut grain (long and mostly straight, the lines faint and broken, warm patches
# through it), stained darker for the body, a little less for the shelves; quiet, as a cabinet's wood is)
dark_tex = image("darkwood", (soft_walnut(512) * 0.6).astype(np.float32))
shelf_tex = image("shelfwood", (soft_walnut(512) * 0.78).astype(np.float32))

M = {
    "body": pbr("TillBodyWood", (1, 1, 1), tex=dark_tex, rough=0.6),
    "shelf": pbr("TillShelf", (1, 1, 1), tex=shelf_tex, rough=0.55),
    "batten": pbr("TillBatten", (1, 1, 1), tex=batten_tex, rough=0.55),
    "kick": pbr("TillKick", lin("#22180f"), rough=0.6),
    "marble": pbr("TillMarble", (1, 1, 1), tex=marble_tex, rough=0.12),
    "frame": pbr("TillShieldFrame", lin("#c7a174"), tex=batten_tex, rough=0.5),
    "acrylic": pbr("TillAcrylic", lin("#eef6fa"), rough=0.02),
    "ring": pbr("TillWindowRing", (1, 1, 1), tex=keyaki_tex, rough=0.5),
    "paper": pbr("TillWindowPaper", (1, 1, 1), tex=paper_tex, rough=0.9, emit=(1, 0.85, 0.6), emit_strength=1.5),
    "bambooGlow": pbr("TillBambooGlow", (1, 1, 1), tex=bamboo_glow_tex, rough=1.0, emit=(1, 0.8, 0.5), emit_strength=1.0),
    "walnut": pbr("TillShieldWalnut", (1, 1, 1), tex=walnut_tex, rough=0.4),
    "slats": pbr("TillShieldSlats", (1, 1, 1), tex=slat_tex, nrm=slat_nrm, nrm_strength=1.0, rough=0.45),
    "slatBack": pbr("TillShieldBack", (1, 1, 1), tex=hinoki_back_tex, rough=0.6),
    "shoe": pbr("TillShieldShoe", lin("#2a2622"), rough=0.35, metal=0.6),
    "bamboo": pbr("TillBamboo", (1, 1, 1), tex=bamboo_tex, rough=0.35),
    **{f"bamboo{i}": pbr(f"TillBamboo{i}", (1, 1, 1), tex=bamboo_tex, rough=0.35) for i in range(5)},
    "node": pbr("TillBambooNode", lin("#4e5a22"), rough=0.5),
    "lip": pbr("TillBambooLip", lin("#a8c468"), rough=0.4),
    "rope": pbr("TillRope", lin("#1c140e"), rough=0.9),
    "lattice": pbr("TillLattice", (1, 1, 1), tex=keyaki_flat_tex, rough=0.5),
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


def uv_along(o, tile=0.45, k=0):
    """a stick's UVs with the grain down its length: v along its longest side (a tile of the board's picture every `tile`), u a narrow slice
    across, each stick (`k`) its own slice"""
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    cs = [vt.co for vt in me.vertices]
    ext = [max(c[i] for c in cs) - min(c[i] for c in cs) for i in range(3)]
    ax = ext.index(max(ext))
    a, b = [i for i in range(3) if i != ax]
    lo = min(c[ax] for c in cs)
    for poly in me.polygons:
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (0.15 + 0.17 * (k % 4) + (c[a] + c[b]) * 2.5, (c[ax] - lo) / tile)


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
bd.append(ring)
sleeve = cyl("TillWindowSleeve", 0.201, 0.05, P(W / 2 - 0.045, WY, 0.02), M["ring"], rot=(0, math.pi / 2, 0), verts=64)
inner_ = cyl("sl", 0.193, 0.06, P(W / 2 - 0.045, WY, 0.02), M["ring"], rot=(0, math.pi / 2, 0), verts=64)
m_ = sleeve.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = inner_; m_.solver = "EXACT"
apply_mods(sleeve)
bpy.data.objects.remove(inner_)
bpy.ops.object.select_all(action="DESELECT"); sleeve.select_set(True); bpy.context.view_layer.objects.active = sleeve
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cylinder_project(); bpy.ops.object.mode_set(mode="OBJECT")
bd.append(sleeve)
# (the paper, set back near the inside face of the end: lit from within, a lantern's glow, not a light thrown outward)
paper = cyl("TillWindowPaper", 0.196, 0.003, P(W / 2 - 0.066, WY, 0.02), M["paper"], rot=(0, math.pi / 2, 0), verts=64)
bpy.ops.object.select_all(action="DESELECT"); paper.select_set(True); bpy.context.view_layer.objects.active = paper
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=0.4); bpy.ops.object.mode_set(mode="OBJECT")
bd.append(paper)
# (the lattice just in front of the paper: three bars each way, their ends let into the sleeve)
for k in (-1, 0, 1):
    L = 2 * math.sqrt(0.196 ** 2 - (k * 0.095) ** 2)
    # (the grain running down each bar, as a sawn stick has it)
    lv = box(f"TillLatticeV{k}", S(0.012, L, 0.011), P(W / 2 - 0.058, WY, 0.02 + k * 0.095), M["lattice"], bev=0.0015)
    lh = box(f"TillLatticeH{k}", S(0.012, 0.011, L), P(W / 2 - 0.057, WY + k * 0.095, 0.02), M["lattice"], bev=0.0015)
    uv_along(lv, k=k + 1)
    uv_along(lh, k=k + 2)
    bd += [lv, lh]
bd.append(box("TillShelfLow", S(W - 0.14, 0.03, D - 0.14), P(0, 0.1, 0.03), M["shelf"], bev=0.003, uv=0.6))
bd.append(box("TillShelfHigh", S(W - 0.14, 0.025, D - 0.2), P(0, TOP - 0.2, 0.04), M["shelf"], bev=0.003, uv=0.6))
BH = TOP - 0.1                            # how tall the culms stand (from just above the kick board to under the top)
FACE_Z = -D / 2 + 0.02                    # the face behind them
GAP_BACK = 0.012                          # how far they stand off it, so the light behind shows round them
brng = np.random.default_rng(5)


def culm(name, x, r, y0, h, z, lean, bow, phase, nodes_at, swell, shade):
    """a culm of bamboo: rings of verts up its length (close together round each node, so its shape shows), tapering a little, leaning and
    bowed, thicker and thinner along its length (`swell`: amount, wavelength, phase), and at each node a sharp ridge with the sheath's scar
    just under it and a little pinch above"""
    bm_ = bmesh.new()
    seg = 12
    uvl = bm_.loops.layers.uv.new("UVMap")
    ys = {round(y0 + h * i / 12, 5) for i in range(13)}
    for n in nodes_at:
        for d in (-0.006, -0.0025, 0.0, 0.0025, 0.009):
            if y0 < n + d < y0 + h:
                ys.add(round(n + d, 5))
    ys = sorted(ys)
    sa, sl, sp = swell

    # (each length between two nodes a little thicker or thinner than the next, eased across the node so it doesn't step)
    seg_k = [1 + float(brng.uniform(-0.09, 0.09)) for _ in range(len(nodes_at) + 1)]

    def radius(y):
        t = (y - y0) / h
        idx = sum(1 for n in nodes_at if n < y)
        kk = seg_k[idx]
        for n in nodes_at:
            if abs(y - n) < 0.012:
                j = nodes_at.index(n)
                kk = seg_k[j] + (seg_k[j + 1] - seg_k[j]) * (0.5 + (y - n) / 0.024)
        rad = r * kk * (1 - 0.07 * t) * (1 + sa * math.sin(2 * math.pi * (y - y0) / sl + sp))
        for n in nodes_at:
            d = y - n
            # (the ridge, sharp; the sheath's scar a little below it; the pinch just above)
            rad *= 1 + 0.11 * math.exp(-(d / 0.0026) ** 2) + 0.04 * math.exp(-((d + 0.006) / 0.003) ** 2) - 0.04 * math.exp(-((d - 0.009) / 0.006) ** 2)
        return rad

    def centre(y):
        t = (y - y0) / h
        return (x + lean * (y - y0) + bow * math.sin(math.pi * t + phase) * math.sin(math.pi * t), z + bow * 0.4 * math.sin(math.pi * t))

    # (v: which length between nodes, and how far up it: the texture's tile is one such length, its node at the foot)
    def v_of(y):
        ns = sorted(nodes_at)
        if not ns:
            return (y - y0) / 0.2
        step_ = (ns[-1] - ns[0]) / max(1, len(ns) - 1) if len(ns) > 1 else 0.2
        edges = [ns[0] - step_] + ns + [ns[-1] + step_]
        for i_ in range(len(edges) - 1):
            if y <= edges[i_ + 1] or i_ == len(edges) - 2:
                return i_ + (y - edges[i_]) / (edges[i_ + 1] - edges[i_])
        return 0.0

    grid = []
    for y in ys:
        cx, cz = centre(y)
        rad = radius(y)
        grid.append([bm_.verts.new(P(cx + rad * math.cos(2 * math.pi * j / seg), y, cz + rad * math.sin(2 * math.pi * j / seg))) for j in range(seg)])
    for i in range(len(ys) - 1):
        v0, v1 = v_of(ys[i]), v_of(ys[i + 1])
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm_.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
            for lp, (uu, vv) in zip(f.loops, ((j / seg, v0), ((j + 1) / seg, v0), ((j + 1) / seg, v1), (j / seg, v1))):
                lp[uvl].uv = (uu, vv)
    bm_.faces.new(list(reversed(grid[0])))
    bm_.faces.new(grid[-1])
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me_ = bpy.data.meshes.new(name)
    bm_.to_mesh(me_)
    bm_.free()
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    finish(o, name, M[f"bamboo{shade}"])
    return [o]


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
    RL_ = W - 0.07
    first = float(brng.uniform(0.04, 0.12))
    # (its nodes evenly spaced, as a cut length of one culm has them, a good hand apart: the texture's painted node lands on each)
    step_r = float(brng.uniform(0.21, 0.25))
    nodes_r = [-RL_ / 2 + first + n * step_r for n in range(6)]
    rail = culm(f"TillBambooRail{int(yy * 100)}", 0.0, 0.0115, -RL_ / 2, RL_, 0.0, 0.0, float(brng.uniform(0.002, 0.004)), float(brng.uniform(0, 1)),
                [n for n in nodes_r if n < RL_ / 2 - 0.03], (0.03, float(brng.uniform(0.3, 0.5)), float(brng.uniform(0, 6.28))), int(brng.integers(0, 5)))
    # (built standing, laid along the face: turned so its length runs along x, then set in place)
    lay_ = Matrix.Translation(Vector(P(0, yy, RZ))) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    for o in rail:
        o.matrix_world = lay_ @ o.matrix_world
    bd += rail
    # (lashed to every third culm with black palm rope: two loops crossed over the joint (an X), round the rail and the culm together;
    # not where a node of the rail is)
    for i, (cx, r, z) in enumerate(culms):
        if i % 3 or any(abs(cx - n) < 0.03 for n in nodes_r):
            continue
        for sgn in (-1, 1):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.019, minor_radius=0.0017, major_segments=16, minor_segments=5,
                                             location=P(cx, yy, (RZ + z) / 2), rotation=(0, sgn * math.pi / 4, 0))
            tl_ = active(); tl_.scale = (1, 0.75, 1); apply_scale(tl_)
            bd.append(finish(tl_, f"TillRope{int(yy * 100)}_{i}_{sgn}", M["rope"]))
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
    sh.append(cyl(f"TillPost{tag}", pr, YT + CAP - TOP, P(ex, (TOP + YT + CAP) / 2, ez), M["walnut"], verts=20))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=pr, segments=20, ring_count=8, location=P(ex, YT + CAP, ez))
    dome = active()
    dome.scale = (1, 1, 0.35)
    apply_scale(dome)
    sh.append(finish(dome, f"TillPost{tag}Top", M["walnut"]))
mid = path()[8]
sh.append(cyl("TillPostCorner", FT / 2 + 0.006, YT - Y0, P(mid[0], (Y0 + YT) / 2, mid[1]), M["walnut"], verts=16))


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
    return [L * i / n for i in range(1, n)]


LF = (XE - RC) - XL
LE = ZB - (ZF + RC)
LA = RC * math.pi / 2
posts_f = straight(XL, ZF, XE - RC, ZF, "F")
posts_e = straight(XE, ZB, XE, ZF + RC, "E")
# (where the posts stand, as distances along the whole line: the slats keep clear of them)
TOTAL = LF + LA + LE
POSTS = [0.0, TOTAL, LF + LA / 2] + posts_f + [TOTAL - t for t in posts_e]
LINE = path(n_arc=60)
SEGS = []
acc = 0.0
for (ax, az), (bx, bz) in zip(LINE, LINE[1:]):
    L = math.hypot(bx - ax, bz - az)
    SEGS.append((acc, L, ax, az, (bx - ax) / L, (bz - az) / L))
    acc += L


def along(t):
    """the point and the direction at distance t along the line"""
    for a0, L, ax, az, ux, uz in SEGS:
        if t <= a0 + L or (a0, L) == SEGS[-1][:2]:
            k = t - a0
            return ax + ux * k, az + uz * k, ux, uz
    return LINE[-1][0], LINE[-1][1], 0.0, 1.0
# (the lattice: one board from end to end round the corner, as thick as the slats stood on both its faces, the slats and the hinoki between
# painted on (STEP apart, four to a tile of the picture), its edges hidden in the rails and the end posts)
ph = YT - Y0 - 2 * RAIL
pc = Y0 + RAIL + ph / 2
STEP = 0.021
HT = 0.0105
bm_ = bmesh.new()
uvl = bm_.loops.layers.uv.new("UVMap")
LINE2 = path(n_arc=16)
rows = []
acc2 = 0.0
for i, (px, pz) in enumerate(LINE2):
    if i:
        acc2 += math.hypot(px - LINE2[i - 1][0], pz - LINE2[i - 1][1])
    ax, az = LINE2[max(0, i - 1)]
    bx, bz = LINE2[min(len(LINE2) - 1, i + 1)]
    tx, tz = bx - ax, bz - az
    L_ = math.hypot(tx, tz)
    nx, nz = -tz / L_, tx / L_
    rows.append((acc2, [bm_.verts.new(P(px + nx * side * HT, y, pz + nz * side * HT)) for side in (-1, 1) for y in (pc - ph / 2, pc + ph / 2)]))
for (t0, r0), (t1, r1) in zip(rows, rows[1:]):
    u0, u1 = t0 / (4 * STEP), t1 / (4 * STEP)
    # (each face: lo, hi of this ring and the next, wound to face out)
    for (a_, b_), side in (((0, 1), -1), ((2, 3), 1)):
        f = bm_.faces.new([r0[a_], r1[a_], r1[b_], r0[b_]])
        for lp, uv in zip(f.loops, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)]):
            lp[uvl].uv = uv
        # (turned to face out of its own side)
        f.normal_update()
        if f.normal.dot(Vector(r0[2].co) - Vector(r0[0].co)) * side < 0:
            f.normal_flip()
me_ = bpy.data.meshes.new("TillLattice")
bm_.to_mesh(me_)
bm_.free()
lat_o = bpy.data.objects.new("TillLattice", me_)
bpy.context.collection.objects.link(lat_o)
sh.append(finish(lat_o, "TillLattice", M["slats"], smooth_shade=False))
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
