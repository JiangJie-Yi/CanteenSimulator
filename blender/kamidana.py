"""The household shrine (神棚) on the shelf by the door, and what's about it on its table: a three-bay shrine (三社造), the middle bay taller than
the two at its sides, in pale hinoki whose grain runs along each piece and differs from piece to piece; a thick, gently curved roof of cypress
bark laid in courses, each gable's bargeboards running up past the ridge as the crossed finials (千木), one piece of wood each, crossing as one;
its metal fittings in gold, plainly apart from the wood (the ridge, the ridge logs' caps (鰹木), the door crests and corner plates, the onion-domed
caps (擬宝珠) on the railing's posts, the steps' plates). Also the offering table under it (three boards of keyaki, their growth rings showing,
a dark lip, gold corners, an apron with arched openings), the mikan on a footed porcelain dish (高坏), and the book of prayers (大祓詞) between
brocade covers, its title on a slip, tied with a silk cord ending in a tassel.

Run:
    blender -b --factory-startup --python blender/kamidana.py -- <project path> [preview.png]
Writes public/models/kamidana.glb and blender/kamidana.blend.

Frame: the shrine's own, as the game stands it (DiningRoom's Kamidana, inside its shrine group): +y up, its front toward -x, its width along
z, the base's foot at y = 0. Nodes the game looks for: Kamidana (the shrine), KamiOranges, KamiSutra, KamiTable (each taken out and set where
it stands; the table in the altar's own frame and size: its top's surface at y = 0, its front at x = -D/2).
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

seed(31)
bpy.ops.wm.read_factory_settings(use_empty=True)
jit = np.random.default_rng(5)


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# =====================================================================
# Textures
# =====================================================================
N = 512


def board(n, light, dark, line, rings=9.0, seed_u=0.5, fine_n=70, arch=0.5):
    """a board's face, its grain along v: fine lines of uneven spacing and strength that fade and come back, gently wavering, and through part
    of it the growth rings cut at a slant (nested arches and long ellipses along the board); soft streaks of tone; pores flecked along it.
    Low contrast: a pale wood stays pale."""
    uu, vv = grid01(n)
    warp = (fbm(n, 4, 1, 4) - 0.5) * 0.05 + (fbm(n, 1, 2, 3) - 0.5) * 0.04
    phase = (uu + warp) * fine_n + fbm(n, 1, 6, 3) * 2.2 + fbm(n, 1, 2, 2) * 3
    fine = smooth(0.45, 0.9, (np.sin(phase * math.pi * 2) * 0.5 + 0.5) * (0.4 + 0.6 * fbm(n, 2, 9, 3)))
    wob = fbm(n, 3, 3, 4) - 0.5
    d = np.sqrt(((uu - seed_u) * 3.0 + wob * 0.45) ** 2 + ((vv + 0.3) * 0.85 + wob * 0.25) ** 2)
    ring = (d * rings + fbm(n, 2, 6, 3) * 0.7) % 1.0
    late = smooth(0.74, 0.9, ring) * (1 - smooth(0.9, 1.0, ring))
    # (the rings only through a band of the board, fading out to its edges, where the grain runs straight)
    band = np.exp(-((uu - seed_u) / 0.3) ** 2) * arch
    streak = smooth(0.4, 0.85, fbm(n, 5, 1, 4))
    col = mix(light, dark, streak * 0.6 + smooth(0.2, 0.85, ring) * band * 0.3)
    col = mix(col, line, fine * 0.16 + late * band * 0.55)
    return mix(col, line, (fbm(n, 4, fine_n, 2) > 0.7).astype(np.float32) * 0.12)


# (hinoki: pale, warm, three boards of it so the pieces differ)
HINOKI = ((0.93, 0.8, 0.6), (0.86, 0.71, 0.5), (0.72, 0.56, 0.37))
hinoki_texs = [image(f"hinoki{k}", board(N, *HINOKI, rings=8 + k * 2, seed_u=0.3 + k * 0.2, fine_n=55 + k * 15)) for k in range(3)]
hinoki_dark_tex = image("hinokiDark", board(N, (0.78, 0.6, 0.4), (0.7, 0.52, 0.33), (0.52, 0.37, 0.22), rings=10, seed_u=0.6))
# (keyaki for the table: a warm mid brown, its rings bold, a board each)
KEYAKI = ((0.56, 0.36, 0.22), (0.47, 0.29, 0.17), (0.3, 0.17, 0.09))
keyaki_texs = [image(f"keyaki{k}", board(N, *KEYAKI, rings=7 + k * 2, seed_u=0.35 + k * 0.15, fine_n=50 + k * 12, arch=1.0)) for k in range(3)]
keyaki_dark_tex = image("keyakiDark", board(N, (0.3, 0.18, 0.1), (0.24, 0.14, 0.08), (0.14, 0.08, 0.04), rings=9, arch=0.7))


def bark_roof(n):
    """cypress bark laid in courses (檜皮葺): along the roof (u) the courses' lower edges step down the slope (v), each course its own tone and a
    soft shadow under its edge; down each course, fibres of bark in fine wavering lines; patches weathered paler"""
    uu, vv = grid01(n)
    rows = 16
    cv = vv * rows + (fbm(n, 6, 1, 3) - 0.5) * 0.35
    k = np.floor(cv)
    f = cv - k
    tone = (np.sin(k * 12.9898) * 43758.5453) % 1.0
    base = mix((0.43, 0.27, 0.16), (0.33, 0.2, 0.12), tone * 0.8)
    fib = np.sin((uu * 140 + fbm(n, 2, 12, 3) * 4 + k * 0.37) * math.pi * 2) * 0.5 + 0.5
    col = mix(base, (0.25, 0.15, 0.09), smooth(0.55, 0.95, fib) * 0.35)
    # (the shadow under each course's edge, and its edge catching light just above it)
    col = mix(col, (0.16, 0.09, 0.05), smooth(0.8, 1.0, f) * 0.55)
    col = mix(col, (0.55, 0.38, 0.25), (1 - smooth(0.0, 0.08, f)) * 0.3)
    return mix(col, (0.58, 0.48, 0.4), smooth(0.65, 0.95, fbm(n, 5, 5, 4)) * 0.25)


bark_tex = image("bark", bark_roof(N))

M = {
    "wood": [pbr(f"KamiWood{k}", (1, 1, 1), tex=t, rough=0.6) for k, t in enumerate(hinoki_texs)],
    "woodDark": pbr("KamiWoodDark", (1, 1, 1), tex=hinoki_dark_tex, rough=0.6),
    "roof": pbr("KamiRoof", (1, 1, 1), tex=bark_tex, rough=0.85),
    "roofEdge": pbr("KamiRoofEdge", lin("#6b4a30"), rough=0.85),
    "eaveLine": pbr("KamiEaveLine", lin("#3a2414"), rough=0.8),
    "gold": pbr("KamiGold", lin("#d9a93c"), rough=0.22, metal=1.0),
    "seam": pbr("KamiSeam", lin("#2a1a10"), rough=0.8),
    "inside": pbr("KamiInside", lin("#3a2818"), rough=0.9),
}
_w = [0]


def wood():
    """the hinoki boards in turn, so neighbouring pieces differ"""
    _w[0] += 1
    return M["wood"][_w[0] % 3]


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def uv_grain(o, size=0.2):
    """UVs with the grain (v) along the piece's longest side on every face, the other way across (u), each piece shifted to its own part of
    the board, so no two show the same figure"""
    me_ = o.data
    lo = Vector([min(v.co[i] for v in me_.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in me_.vertices) for i in range(3)])
    ext = hi - lo
    long_ = max(range(3), key=lambda i: ext[i])
    ou, ov = float(jit.uniform(0, 1)), float(jit.uniform(0, 1))
    if not me_.uv_layers:
        me_.uv_layers.new()
    uvl = me_.uv_layers.active.data
    for poly in me_.polygons:
        nrm = poly.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        if ax == long_:
            # (an end of the piece: the end grain, across both ways)
            a, b = [i for i in range(3) if i != ax]
        else:
            a, b = [i for i in range(3) if i not in (ax, long_)][0], long_
        for li in poly.loop_indices:
            co = me_.vertices[me_.loops[li].vertex_index].co
            uvl[li].uv = (co[a] / size + ou, co[b] / size + ov)


def box(name, size, at, mat_, bev=0.0, rot=(0, 0, 0), uv=0.2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat_, smooth_shade=False)
    if bev:
        bevel(o, bev, 2, angle=False)
        apply_mods(o)
    if uv:
        uv_grain(o, uv)
    return o


def cyl(name, r, depth, at, mat_, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    return finish(active(), name, mat_)


def mesh_obj(name, verts, faces, mat_, smooth_shade=False):
    me_ = bpy.data.meshes.new(name)
    me_.from_pydata([tuple(v) for v in verts], [], faces)
    me_.update()
    o = bpy.data.objects.new(name, me_)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat_, smooth_shade=smooth_shade)


def giboshi(name, at, r):
    """an onion-domed post cap (擬宝珠): a collar, the bulb, its pointed tip"""
    parts = [cyl(f"{name}Collar", r * 1.05, r * 0.6, Vector(at) + Vector((0, 0, r * 0.3)), M["gold"], verts=16)]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=10, location=Vector(at) + Vector((0, 0, r * 1.4)))
    b = active()
    for vv in b.data.vertices:
        if vv.co.z > 0:
            vv.co.z *= 1 + vv.co.z / r * 0.5
    parts.append(finish(b, f"{name}Bulb", M["gold"]))
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r * 0.3, radius2=0, depth=r * 0.9, location=Vector(at) + Vector((0, 0, r * 2.7)))
    parts.append(finish(active(), f"{name}Tip", M["gold"]))
    return parts


parts = []
# =====================================================================
# The base: two stepped plinths, gold plates along their fronts; three steps up the front to the middle bay, gold plates on their risers
# =====================================================================
RX_ = 0.083  # (the railing's half depth: its front posts stand at BX - RX_)
BX = 0.015  # (the base's middle, set back a little: the shrine is deeper than it was, all of it toward the back)
parts.append(box("KamiPlinth", S(0.2, 0.02, 0.36), P(BX, 0.01, 0), wood(), bev=0.002))
parts.append(box("KamiDeck", S(0.18, 0.02, 0.33), P(BX, 0.03, 0), wood(), bev=0.002))
# (the steps up to the deck between the front posts: three solid blocks standing on the table, each a tread lower and further out, a brass
# nosing along the whole top edge of each riser, flush on its face)
SW = 0.096            # (their width: from one front post to the other)
SD = 0.018            # (each tread's depth)
DF = BX - 0.09        # (the deck's front face)
for k in range(3):
    top = 0.03 - k * 0.01
    front = DF - (k + 1) * SD
    parts.append(box(f"KamiStep{k}", S(DF - front, top, SW), P((front + DF) / 2, top / 2, 0), wood(), bev=0.0008))
    parts.append(box(f"KamiStepGold{k}", S(0.0008, 0.0026, SW - 0.003), P(front - 0.0004, top - 0.0015, 0), M["gold"], uv=0))
# (a side board each side of the steps (袖), like a stair's string: from the front post's foot down to the table in front of the bottom step,
# its top edge sloping as the steps do, so the steps don't stand out as bare blocks)
FB = DF - 3 * SD
for sz in (-1, 1):
    pts = [(BX - RX_ + 0.004, 0.058), (BX - RX_ + 0.004, 0.0), (FB - 0.004, 0.0), (FB - 0.004, 0.012)]
    g_ = mesh_obj(f"KamiStepSide{sz}", [P(x, y, sz * (SW / 2 + 0.003)) for x, y in pts], [(0, 1, 2, 3)], M["woodDark"])
    sol = g_.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.006; sol.offset = 0
    bev_ = g_.modifiers.new("b", "BEVEL"); bev_.width = 0.0008; bev_.segments = 1
    apply_mods(g_)
    uv_grain(g_, 0.1)
    parts.append(g_)

# =====================================================================
# The railing round the deck: posts with gold caps, two rails and a row of balusters between, open at the front for the steps
# =====================================================================
DY = 0.04
RX = 0.083
posts = [(BX + sx * RX, sz * 0.153) for sx in (-1, 1) for sz in (-1, 1)] + [(BX - RX, sz * 0.05) for sz in (-1, 1)]
for i, (x, z) in enumerate(posts):
    parts.append(box(f"KamiPost{i}", S(0.012, 0.055, 0.012), P(x, DY + 0.0275, z), M["woodDark"], bev=0.0012))
    parts += giboshi(f"KamiCap{i}", P(x, DY + 0.055, z), 0.0058)
for y in (DY + 0.018, DY + 0.045):
    parts.append(box(f"KamiRailBack{int(y * 1000)}", S(0.007, 0.006, 0.306), P(BX + RX, y, 0), M["woodDark"]))
    for sz in (-1, 1):
        parts.append(box(f"KamiRailSide{sz}{int(y * 1000)}", S(2 * RX, 0.006, 0.007), P(BX, y, sz * 0.153), M["woodDark"]))
        parts.append(box(f"KamiRailFront{sz}{int(y * 1000)}", S(0.007, 0.006, 0.103), P(BX - RX, y, sz * 0.1015), M["woodDark"]))
for z in np.linspace(-0.14, 0.14, 9):
    parts.append(box(f"KamiBalB{z:.3f}", S(0.004, 0.026, 0.004), P(BX + RX, DY + 0.0315, z), wood(), uv=0.1))
for x in np.linspace(-RX + 0.018, RX - 0.018, 6):
    for sz in (-1, 1):
        parts.append(box(f"KamiBalS{x:.3f}{sz}", S(0.004, 0.026, 0.004), P(BX + x, DY + 0.0315, sz * 0.153), wood(), uv=0.1))
for z in (-0.135, -0.11, -0.085, 0.085, 0.11, 0.135):
    parts.append(box(f"KamiBalF{z:.3f}", S(0.004, 0.026, 0.004), P(BX - RX, DY + 0.0315, z), wood(), uv=0.1))

RT = 0.016  # (the roof's thickness: bark laid deep)


def strip(name, pts, h, z0, th, mat_):
    """a board of height `h` (across its centreline) and thickness `th` (along z, centred on z0) whose centreline runs through `pts` (x, y)"""
    vs, fs = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, ty)
        nx, ny = -ty / ln, tx / ln
        for sy in (-1, 1):
            for sz in (-1, 1):
                vs.append(P(x + nx * h / 2 * sy, y + ny * h / 2 * sy, z0 + sz * th / 2))
    # (4 verts per section: 0 (-h,-z), 1 (-h,+z), 2 (+h,-z), 3 (+h,+z))
    for i in range(n - 1):
        a, b = i * 4, (i + 1) * 4
        fs += [(a + 0, b + 0, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2), (a + 0, a + 2, b + 2, b + 0), (a + 1, b + 1, b + 3, a + 3)]
    e = (n - 1) * 4
    fs += [(0, 1, 3, 2), (e, e + 2, e + 3, e + 1)]
    o = mesh_obj(name, vs, fs, mat_)
    o.data.validate()
    o.data.update()
    # (outward faces whichever way they were wound)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv_grain(o, 0.12)
    return o


M["plaque"] = pbr("KamiPlaque", lin("#141210"), rough=0.35)


def crest_half(name, at, rad, sd):
    """the family crest (三つ柏: three oak leaves in a ring, gold on a black lacquer disc) facing out of the doors at at (game frame), rad its
    radius; only the half on door leaf sd's side of the meeting line, so each leaf carries its half and they part when the doors open"""
    x, y, z = at
    f = rad / 0.0105
    objs = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=rad, depth=0.0016, location=P(x, y, z), rotation=(0, math.pi / 2, 0))
    objs.append((active(), M["plaque"]))
    bpy.ops.mesh.primitive_torus_add(major_radius=rad * 0.86, minor_radius=0.0006 * f, major_segments=48, minor_segments=6, location=P(x - 0.0009, y, z),
                                     rotation=(0, math.pi / 2, 0))
    objs.append((active(), M["gold"]))
    for j in range(3):
        a_ = math.pi / 2 + j * 2 * math.pi / 3
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8, location=P(x - 0.0009, y + math.sin(a_) * 0.0046 * f, z + math.cos(a_) * 0.0046 * f))
        lf = active()
        lf.scale = (0.0004, 0.0028 * f, 0.005 * f)
        lf.rotation_euler = (a_ - math.pi / 2, 0, 0)
        objs.append((lf, M["gold"]))
        # (its midrib, cut dark down the leaf from the middle out)
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(x - 0.0014, y + math.sin(a_) * 0.0042 * f, z + math.cos(a_) * 0.0042 * f))
        vn = active()
        vn.scale = (0.0003, 0.0003 * f, 0.0084 * f)
        vn.rotation_euler = (a_ - math.pi / 2, 0, 0)
        objs.append((vn, M["plaque"]))
    out_ = []
    for k_, (o, m_) in enumerate(objs):
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.bisect(plane_co=P(x, y, z), plane_no=(0, -sd, 0), clear_inner=True, use_fill=True)
        bpy.ops.object.mode_set(mode="OBJECT")
        out_.append(finish(o, f"{name}{k_}", m_))
    return out_


def bay(tag, zc, width, body_h, ridge_h, depth=0.13):
    """one bay of the shrine: its body with a post at each corner, its pair of doors with the gold crest and corner plates, and its roof: two
    curved slopes of bark laid deep, each gable's bargeboards running up past the ridge as the crossed finials (one board each, the pair one
    piece where they cross), the gold ridge on top with the ridge logs across it"""
    out = []
    y0 = DY
    cx0 = BX + 0.005
    # (the body: a hollow box of boards, its inside a shadowed dark wood, a doorway cut in its front (the doors open into it))
    T_ = 0.005
    out.append(box(f"Kami{tag}WallBack", S(T_, body_h, width), P(cx0 + depth / 2 - T_ / 2, y0 + body_h / 2, zc), wood(), bev=0.001))
    for sz in (-1, 1):
        out.append(box(f"Kami{tag}WallSide{sz}", S(depth, body_h, T_), P(cx0, y0 + body_h / 2, zc + sz * (width / 2 - T_ / 2)), wood(), bev=0.001))
    out.append(box(f"Kami{tag}Floor", S(depth, T_, width), P(cx0, y0 + T_ / 2, zc), wood(), bev=0.0008))
    out.append(box(f"Kami{tag}Ceiling", S(depth, T_, width), P(cx0, y0 + body_h - T_ / 2, zc), wood(), bev=0.0008))
    OW, OH, OY = width * 0.66, body_h * 0.74, y0 + body_h * 0.46     # (the doorway: its width, height and middle)
    fzx = cx0 - depth / 2 + T_ / 2
    for sz in (-1, 1):
        sw = (width - OW) / 2
        out.append(box(f"Kami{tag}WallFront{sz}", S(T_, body_h, sw), P(fzx, y0 + body_h / 2, zc + sz * (OW / 2 + sw / 2)), wood(), bev=0.0008))
    out.append(box(f"Kami{tag}WallFrontTop", S(T_, y0 + body_h - (OY + OH / 2), OW), P(fzx, (OY + OH / 2 + y0 + body_h) / 2, zc), wood()))
    out.append(box(f"Kami{tag}WallFrontLow", S(T_, OY - OH / 2 - y0, OW), P(fzx, (OY - OH / 2 + y0) / 2, zc), wood()))
    # (inside, shadowed: dark boards behind and either side)
    out.append(box(f"Kami{tag}Inside", S(0.001, body_h - 2 * T_, width - 2 * T_), P(cx0 + depth / 2 - T_ - 0.0006, y0 + body_h / 2, zc), M["inside"], uv=0))
    # (the posts at its corners, standing a little proud of the walls)
    for sx in (-1, 1):
        for sz in (-1, 1):
            out.append(box(f"Kami{tag}Pillar{sx}{sz}", S(0.009, body_h, 0.009), P(cx0 + sx * (depth / 2 - 0.002), y0 + body_h / 2, zc + sz * (width / 2 - 0.002)),
                           M["woodDark"], bev=0.001))
    # (a tie beam round it under the roof)
    out.append(box(f"Kami{tag}Beam", S(depth + 0.006, 0.008, width + 0.006), P(cx0, y0 + body_h - 0.006, zc), M["woodDark"], bev=0.001))
    # (the doors: two leaves in a frame on the front, a dark seam, the gold crest where they meet, a gold plate at each corner)
    fx = cx0 - depth / 2 - 0.0012
    # (the doorway's frame: four dark bars round it)
    for sz in (-1, 1):
        out.append(box(f"Kami{tag}DoorJamb{sz}", S(0.006, OH + 0.008, 0.006), P(fx, OY, zc + sz * (OW / 2 + 0.003)), M["woodDark"], bev=0.0006))
    for sv in (-1, 1):
        out.append(box(f"Kami{tag}DoorSill{sv}", S(0.006, 0.006, OW + 0.012), P(fx, OY + sv * (OH / 2 + 0.003), zc), M["woodDark"], bev=0.0006))
    # (the two door leaves, each hung from its outer edge (a hinge the game turns it about): the leaf, a gold plate at each corner, and half the
    # crest where they meet)
    DW = OW / 2
    for sd in (-1, 1):
        hinge = Vector(P(fx - 0.0025, OY, zc + sd * OW / 2))
        leaf = bpy.data.objects.new(f"Kami{tag}DoorLeaf{sd}", None)
        bpy.context.collection.objects.link(leaf)
        leaf.location = hinge
        kids = [box(f"Kami{tag}Door{sd}", S(0.0025, OH - 0.001, DW - 0.0006), P(fx - 0.0025, OY, zc + sd * (OW / 2 - DW / 2)), wood())]
        for sv in (-1, 1):
            kids.append(box(f"Kami{tag}DoorPlate{sd}{sv}", S(0.0012, 0.009, 0.009), P(fx - 0.0045, OY + sv * OH * 0.44, zc + sd * (OW / 2 - 0.006)), M["gold"], uv=0))
        # (the crest's half on this leaf: on the big middle doors the family crest, on the side bays a gold half disc at its meeting edge)
        if tag == "M":
            kids += crest_half(f"Kami{tag}Crest{sd}_", (fx - 0.0045, OY, zc), width * 0.085, sd)
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=width * 0.07, depth=0.002, location=P(fx - 0.0045, OY, zc), rotation=(0, math.pi / 2, 0))
            cr = active()
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
            # (kept: the half on this leaf's side of the meeting line)
            bpy.ops.mesh.bisect(plane_co=P(fx, OY, zc), plane_no=(0, -sd, 0), clear_inner=True)
            bpy.ops.object.mode_set(mode="OBJECT")
            kids.append(finish(cr, f"Kami{tag}Crest{sd}", M["gold"]))
        for k_ in kids:
            mw = k_.matrix_world.copy()
            k_.parent = leaf
            k_.matrix_world = mw
        out.append(leaf)
        out += kids
    out.append(box(f"Kami{tag}Lintel", S(0.012, 0.01, width * 0.9), P(fx - 0.004, y0 + body_h - 0.018, zc), M["woodDark"], bev=0.001))
    out.append(box(f"Kami{tag}LintelGold", S(0.002, 0.003, width * 0.9), P(fx - 0.0105, y0 + body_h - 0.022, zc), M["gold"], uv=0))

    # (the roof: the top surface down each slope from the ridge, sagging a little in the middle so its eaves sweep up (照り), laid deep)
    top = y0 + body_h
    run = depth / 2 + 0.03
    rise = ridge_h - top
    sag = rise * 0.14
    W = width + 0.04

    def y_top(s):
        return ridge_h + 0.012 - rise * s - sag * math.sin(math.pi * s)

    NS = 12
    for sx in (-1, 1):
        vs, fs = [], []
        for i in range(NS + 1):
            s = i / NS
            for zz in (-W / 2, W / 2):
                vs.append(P(cx0 + sx * run * s, y_top(s), zc + zz))
        for i in range(NS):
            a = i * 2
            fs.append((a, a + 1, a + 3, a + 2) if sx > 0 else (a, a + 2, a + 3, a + 1))
        o = mesh_obj(f"Kami{tag}Roof{sx}", vs, fs, M["roof"], smooth_shade=True)
        me_ = o.data
        uvl = me_.uv_layers.new().data
        L = math.hypot(run, rise)
        for poly in me_.polygons:
            for li in poly.loop_indices:
                vi = me_.loops[li].vertex_index
                uvl[li].uv = (((vi % 2) - 0.5) * W / 0.12, (vi // 2) / NS * L / 0.12)
        # (the up side up, then made deep: the bark's thickness downward, its cut edge a paler brown)
        if me_.polygons[0].normal.z < 0:
            for poly in me_.polygons:
                poly.flip()
        o.data.materials.append(M["roofEdge"])
        sol = o.modifiers.new("t", "SOLIDIFY")
        sol.thickness = RT
        sol.offset = -1
        sol.material_offset_rim = 1
        sol.use_rim = True
        apply_mods(o)
        out.append(o)

    # (the gable ends: wood up under the roof, following its curve)
    for sz in (-1, 1):
        zz = zc + sz * (width / 2 - 0.004)
        pts = [(cx0 - run * 0.92, top), (cx0 + run * 0.92, top)]
        for i in range(NS, -1, -1):
            s = i / NS * 0.92
            pts.append((cx0 + run * s, max(top + 0.001, y_top(s) - RT - 0.002)))
        for i in range(1, NS + 1):
            s = i / NS * 0.92
            pts.append((cx0 - run * s, max(top + 0.001, y_top(s) - RT - 0.002)))
        g_ = mesh_obj(f"Kami{tag}Gable{sz}", [P(x, y, zz) for x, y in pts[:-1]], [tuple(range(len(pts) - 1))], wood())
        sol = g_.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.005; sol.offset = 0
        apply_mods(g_)
        uv_grain(g_, 0.15)
        out.append(g_)
        # (and out under the bargeboards, the gable's face filled with round logs laid across it, a darker wood, one on another from the tie
        # beam up to the ridge, each as long as the roof's underside lets it be at its height, so the whole triangle is filled)
        zf = zc + sz * (W / 2 - 0.001)
        out.append(box(f"Kami{tag}GableBeam{sz}", S(2 * run * 0.98, 0.007, 0.006), P(cx0, top + 0.0035, zf), M["woodDark"], bev=0.0006))
        under = lambda s_: y_top(s_) - RT * 0.55  # noqa: E731

        def reach(y):
            # (how far out from the middle the roof's underside comes down to y: the s where it's at y)
            lo, hi = 0.0, 1.0
            if under(0) <= y:
                return 0.0
            for _ in range(30):
                mid_ = (lo + hi) / 2
                if under(mid_) > y:
                    lo = mid_
                else:
                    hi = mid_
            return lo
        BH = 0.0075
        y = top + 0.007
        i = 0
        while y + BH * 0.5 < under(0):
            hw = run * reach(min(y + BH, under(0) - 0.0005))
            if hw < 0.002:
                break
            lg_ = cyl(f"Kami{tag}GableLog{sz}{i}", BH / 2, 2 * hw, P(cx0, y + BH / 2, zf), M["woodDark"], rot=(0, math.pi / 2, 0), verts=12)
            uv_grain(lg_, 0.08)
            out.append(lg_)
            y += BH
            i += 1
    # (the bargeboards and the crossed finials (千木): at each gable, each slope's board runs from the eave up along the roof's edge and on
    # past the ridge, straight, as one finial; the two cross over the ridge as one piece of wood (joined where they cross))
    tan0 = -(rise + sag * math.pi)  # (the slope's rise per unit of s at the ridge)
    CH = 0.032  # (how far each finial reaches past the ridge, along x: a short crossing, not a tall one)
    # (a side bay's inner gable tucks under the middle bay's roof: no finials there, they'd come up through it)
    for sz in ((-1, 1) if zc == 0 else (1 if zc > 0 else -1,)):
        zg = zc + sz * (W / 2 + 0.0025)
        boards = []
        for sx in (-1, 1):
            pts = []
            for i in range(NS, -1, -1):
                s = i / NS
                pts.append((cx0 + sx * run * s, y_top(s) - RT * 0.35))
            # (on past the ridge, straight on along the slope's line there)
            for j in range(1, 5):
                e = j / 4 * CH / run
                pts.append((cx0 - sx * run * e, y_top(0) - RT * 0.35 - tan0 * e))
            boards.append(strip(f"Kami{tag}Chigi{sz}{sx}", pts, 0.014, zg, 0.005, wood()))
        a, b = boards
        mod = a.modifiers.new("u", "BOOLEAN")
        mod.operation = "UNION"
        mod.object = b
        mod.solver = "EXACT"
        apply_mods(a)
        if len(a.data.vertices) > 8:
            bpy.data.objects.remove(b)
            a.name = f"Kami{tag}Chigi{sz}"
            uv_grain(a, 0.12)
            out.append(a)
        else:
            out += [a, b]
    # (the gold ridge on the roof's top, the logs across it with gold caps)
    out.append(box(f"Kami{tag}Ridge", S(0.016, 0.01, W + 0.004), P(cx0, ridge_h + 0.014, zc), M["gold"], bev=0.002, uv=0))
    # (the ridge logs (鰹木): spaced well apart along the ridge, each a log swelling in the middle and tapering to its ends like a cigar, its
    # grain running along it, a gold cap on each end)
    n = 3 if width > 0.12 else 2
    gap = width * (0.32 if n == 3 else 0.55)
    LL = 0.05
    for k in range(n):
        z = zc + (k - (n - 1) / 2) * gap
        lg = cyl(f"Kami{tag}Katsuogi{k}", 0.0068, LL, P(cx0, ridge_h + 0.025, z), M["woodDark"], rot=(0, math.pi / 2, 0), verts=20)
        bpy.ops.object.select_all(action="DESELECT"); lg.select_set(True); bpy.context.view_layer.objects.active = lg
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.mesh.select_mode(type="EDGE")
        bpy.ops.object.mode_set(mode="OBJECT")
        for e in lg.data.edges:
            v0, v1 = lg.data.vertices[e.vertices[0]].co, lg.data.vertices[e.vertices[1]].co
            e.select = abs(v0.x - v1.x) > LL * 0.5
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.subdivide(number_cuts=8); bpy.ops.object.mode_set(mode="OBJECT")
        for vt in lg.data.vertices:
            u_ = vt.co.x / (LL / 2)
            k_ = 1 - 0.2 * u_ * u_
            vt.co.y *= k_
            vt.co.z *= k_
        lg.data.update()
        for poly in lg.data.polygons:
            poly.use_smooth = True
        uv_grain(lg, 0.06)
        out.append(lg)
        for sx in (-1, 1):
            out.append(cyl(f"Kami{tag}KatsuogiCap{k}{sx}", 0.0058, 0.0045, P(cx0 + sx * (LL / 2 - 0.0005), ridge_h + 0.025, z), M["gold"], rot=(0, math.pi / 2, 0), verts=20))
    return out


parts += bay("M", 0.0, 0.15, 0.165, 0.28)
for sz in (-1, 1):
    parts += bay(f"S{sz}", sz * 0.112, 0.07, 0.125, 0.215, depth=0.112)

_su2, _sv2 = grid01(256)
straw = mix((0.9, 0.8, 0.6), (0.78, 0.66, 0.47), fbm(256, 60, 2, 3))
straw = mix(straw, (0.58, 0.5, 0.38), (np.sin((_su2 * 160 + fbm(256, 6, 2, 3) * 3) * math.pi * 2) > 0.7).astype(np.float32) * 0.25)
straw = mix(straw, (0.95, 0.92, 0.84), (np.sin((_su2 * 230 + 0.3) * math.pi * 2) > 0.85).astype(np.float32) * 0.2)
M["straw"] = pbr("KamiStraw", (1, 1, 1), tex=image("straw", straw), rough=0.8)
M["shide"] = pbr("KamiShide", lin("#fbfaf4"), rough=0.75)

# =====================================================================
# Inside: in the middle bay a little stone Ebisu (恵比寿), seated, round and smiling under his folded eboshi, a sea bream under his left arm
# and his fishing rod over his right shoulder, carved from one grey granite; in each side bay a talisman (御札) in its paper wrapper,
# stood against the back wall
# =====================================================================
_gu, _gv = grid01(512)
# (granite: grey with black and white grains, weathered: paler where it's been rubbed smooth, a little lichen green-grey low down, its face
# pitted (the relief a normal map))
_gr = fbm(512, 14, 14, 5)
granite = mix((0.62, 0.61, 0.58), (0.5, 0.49, 0.47), _gr)
granite = mix(granite, (0.22, 0.21, 0.2), (fbm(512, 110, 110, 2) > 0.66).astype(np.float32) * 0.65)
granite = mix(granite, (0.86, 0.84, 0.8), (fbm(512, 130, 130, 2) > 0.73).astype(np.float32) * 0.55)
granite = mix(granite, (0.52, 0.55, 0.47), smooth(0.62, 0.85, fbm(512, 5, 5, 4)) * 0.3)
pits = fbm(512, 90, 90, 3)
M["stone"] = pbr("KamiStone", (1, 1, 1), tex=image("granite", granite), nrm=image("graniteN", to_normal((pits * 0.6 + _gr * 0.4).astype(np.float32), 5.0), data=True),
                 nrm_strength=0.9, rough=0.82)
M["stoneDark"] = pbr("KamiStoneDark", lin("#34312d"), rough=0.9)
eb = []
carve = []


def blob(name, at, r, rot=(0, 0, 0), seg=32, rings=20, into=None):
    """an ellipsoid of the stone, at (game frame), radii (x, y, z), turned (Blender euler)"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=seg, ring_count=rings, location=P(*at), rotation=rot)
    o = active()
    o.scale = S(*r)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    (carve if into is None else into).append(o)
    return o


def ebtube(name, pts, r, mat_, ring=8):
    """a thin rod through pts (game frame), r thick: one smooth sweep along a curve through them, its ends rounded off"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts):
        sp.points[i].co = (*P(*q), 1)
    sp.use_endpoint_u = True
    sp.order_u = min(3, len(pts))
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    cu.resolution_u = 6
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return finish(active(), name, mat_)


# ---- the figure, modelled in rounded parts, then fused and smoothed into one carving (as cut from one stone, no seams)
# (the rock he sits on: low, rough, wider than him)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=P(0, 0.006, 0))
rk = active()
rk.scale = S(0.036, 0.009, 0.034)
bpy.ops.object.transform_apply(scale=True)
_rr = np.random.default_rng(8)
for vt in rk.data.vertices:
    vt.co += vt.co.normalized() * float(_rr.normal(0, 0.0012))
    vt.co.z = max(vt.co.z, -0.0055 + 0.006)
carve.append(rk)
# (his legs under the robe: the left folded flat across, the right knee raised in front, its bare foot planted on the rock, toes and all)
blob("LegL", (-0.008, 0.016, 0.006), (0.024, 0.009, 0.022))
blob("KneeR", (-0.019, 0.03, -0.013), (0.011, 0.012, 0.01))
blob("ShinR", (-0.026, 0.02, -0.015), (0.007, 0.012, 0.0075))
blob("FootR", (-0.031, 0.012, -0.015), (0.009, 0.0045, 0.008))
for _k in range(5):
    blob(f"Toe{_k}", (-0.0395, 0.0125, -0.0195 + _k * 0.0022), (0.0016, 0.0016, 0.0013))
# (the round belly and chest under the robe, its hem flaring over the legs)
blob("Belly", (-0.004, 0.034, 0), (0.021, 0.02, 0.024))
blob("Chest", (0.002, 0.046, 0), (0.018, 0.014, 0.021))
# (wide sleeves hanging at his sides)
blob("SleeveL", (-0.002, 0.034, 0.022), (0.012, 0.016, 0.009), rot=(0.25, 0, 0))
blob("SleeveR", (-0.004, 0.04, -0.022), (0.012, 0.014, 0.009), rot=(-0.3, 0, 0))
# (his hands: the left under the fish, holding it up at his chest; the right at his side gripping the rod)
blob("HandL", (-0.02, 0.04, 0.014), (0.005, 0.0045, 0.005))
blob("HandR", (-0.019, 0.04, -0.024), (0.0048, 0.0052, 0.0048))
# (the head: round and full, heavy cheeks, a little nose, long earlobes (福耳), a hint of chin)
blob("Head", (-0.002, 0.066, 0), (0.0145, 0.0148, 0.0155))
blob("CheekL", (-0.011, 0.061, 0.0075), (0.0062, 0.0058, 0.006))
blob("CheekR", (-0.011, 0.061, -0.0075), (0.0062, 0.0058, 0.006))
blob("Nose", (-0.0158, 0.064, 0), (0.0026, 0.0024, 0.0028))
blob("Chin", (-0.01, 0.053, 0), (0.007, 0.004, 0.0085))
# (a short pointed beard under the chin, and a moustache over the smile)
blob("Beard", (-0.0135, 0.0505, 0), (0.0045, 0.0058, 0.0055))
blob("BeardTip", (-0.0148, 0.0455, 0), (0.0028, 0.0035, 0.003))
blob("Moustache", (-0.0158, 0.0605, 0), (0.0016, 0.0013, 0.0058))
for sz in (-1, 1):
    blob(f"Ear{sz}", (0.0, 0.064, sz * 0.0155), (0.0032, 0.0075, 0.0022))
    blob(f"Lobe{sz}", (-0.001, 0.057, sz * 0.0158), (0.0034, 0.0034, 0.0026))
# (the eboshi: tall, folded, leaning back off the crown, its crease and its tip turned forward)
blob("Hat", (0.006, 0.082, 0), (0.015, 0.012, 0.0115), rot=(0, -0.35, 0))
blob("HatTop", (0.008, 0.093, 0), (0.009, 0.007, 0.0095), rot=(0, -0.5, 0))
blob("HatTip", (-0.004, 0.097, 0), (0.006, 0.0045, 0.0075))
# (the sea bream held up at his chest in his left hand, head up and out: plump, its back fin, its tail fanned below)
tai_parts = []
blob("Tai", (-0.022, 0.052, 0.015), (0.0048, 0.017, 0.0095), rot=(0.25, 0, 0), into=tai_parts)
blob("TaiFin", (-0.022, 0.054, 0.0255), (0.0016, 0.011, 0.003), rot=(0.25, 0, 0), into=tai_parts)
blob("TaiTail", (-0.021, 0.035, 0.0105), (0.0018, 0.0045, 0.0085), rot=(0.25, 0, 0), into=tai_parts)
carve += tai_parts
# (fused: a mesh by voxels round all of it, smoothed, then thinned to a sensible count)
for o in carve:
    finish(o, o.name, M["stone"])
fig = join(carve, "KamiEbisuFigure")
fig.data.remesh_voxel_size = 0.0009
bpy.ops.object.select_all(action="DESELECT"); fig.select_set(True); bpy.context.view_layer.objects.active = fig
bpy.ops.object.voxel_remesh()
sm = fig.modifiers.new("s", "SMOOTH"); sm.factor = 0.6; sm.iterations = 6
dc = fig.modifiers.new("d", "DECIMATE"); dc.ratio = 0.22
apply_mods(fig)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=0.06); bpy.ops.object.mode_set(mode="OBJECT")
finish(fig, "KamiEbisuFigure", M["stone"])
eb.append(fig)
# ---- what's cut into the stone, darker: closed, smiling eyes (two arcs), raised brows, a wide smile, the robe's crossed collar, the fish's eye
# and gill, the rod and its line
FX = -0.0163


def arc(name, cz, cy, w, h, n=7, up=True, rr=0.0006, x=FX):
    pts = []
    for i in range(n):
        u = -1 + 2 * i / (n - 1)
        pts.append((x - 0.0006 * (1 - u * u), cy + (h * (1 - u * u) if up else -h * (1 - u * u)), cz + u * w / 2))
    eb.append(ebtube(name, pts, rr, M["stoneDark"], ring=6))


for sz in (-1, 1):
    arc(f"KamiEbisuEye{sz}", sz * 0.0056, 0.0675, 0.0055, 0.0014, up=True)
    arc(f"KamiEbisuBrow{sz}", sz * 0.0058, 0.0722, 0.0062, 0.0011, up=True, rr=0.0005, x=FX + 0.0012)
arc("KamiEbisuSmile", 0.0, 0.0585, 0.0105, 0.0024, up=False, rr=0.0007, x=FX + 0.0006)
# (the collar: two bands crossing on his chest, left over right)
for sz in (-1, 1):
    eb.append(ebtube(f"KamiEbisuCollar{sz}", [(-0.0168, 0.0515, sz * 0.0085), (-0.0205, 0.0435, sz * 0.0025), (-0.0238, 0.0365, -sz * 0.0035)], 0.0009, M["stone"], ring=6))
# (the fish's eye and its gill line)
eb.append(cyl("KamiEbisuTaiEye", 0.0012, 0.001, P(-0.027, 0.064, 0.018), M["stoneDark"], rot=(0, math.pi / 2, 0), verts=10))
eb.append(ebtube("KamiEbisuTaiGill", [(-0.0272, 0.06, 0.0125), (-0.0275, 0.058, 0.0165), (-0.0272, 0.0585, 0.021)], 0.0004, M["stoneDark"], ring=5))
# (the rod: from his raised hand up past his shoulder, bending a little, its line hanging from the tip)
# (the rod: upright in his right hand, from the rock up past his hat, a little bent; its line hanging from the tip)
eb.append(ebtube("KamiEbisuRod", [(-0.019, 0.008, -0.025), (-0.019, 0.04, -0.025), (-0.017, 0.08, -0.026), (-0.012, 0.112, -0.027)], 0.0011, M["stone"], ring=7))
eb.append(ebtube("KamiEbisuLine", [(-0.012, 0.112, -0.027), (-0.016, 0.09, -0.03), (-0.018, 0.07, -0.031)], 0.00025, M["stoneDark"], ring=4))
# (a straw rope tied round his waist, its ends and a paper streamer hanging at the front, as at a shrine)
eb.append(ebtube("KamiEbisuRope", [(-0.022 * math.cos(a_), 0.03 + 0.002 * math.sin(a_ * 2), 0.0245 * math.sin(a_)) for a_ in [i * 2 * math.pi / 16 for i in range(17)]], 0.0012, M["straw"], ring=6))
eb.append(ebtube("KamiEbisuRopeEnd", [(-0.022, 0.03, 0.002), (-0.0235, 0.022, 0.003), (-0.0245, 0.016, 0.004)], 0.0008, M["straw"], ring=5))
for _j in range(3):
    eb.append(box(f"KamiEbisuShide{_j}", S(0.0004, 0.0048, 0.0036), P(-0.0236, 0.025 - _j * 0.0042, 0.006 + (0.0016 if _j % 2 else -0.0016)), M["shide"], uv=0))
# ---- the pedestal: a square block of the same granite under him
PED = 0.016
eb.append(box("KamiEbisuPedestal", S(0.068, PED, 0.068), P(0, -PED / 2, 0), M["stone"], bev=0.0012, uv=0.05))
ebisu = bpy.data.objects.new("KamiEbisu", None)
bpy.context.collection.objects.link(ebisu)
for o in eb:
    mw = o.matrix_world.copy()
    o.parent = ebisu
    o.matrix_world = mw
ebisu.location = P(BX + 0.012, DY + 0.005 + 0.016, 0)
parts += eb + [ebisu]
# (the talismans in the side bays)
M["fuda"] = pbr("KamiFuda", lin("#f3eedd"), rough=0.8)
M["fudaSeal"] = pbr("KamiFudaSeal", lin("#b8261c"), rough=0.6)
for sz in (-1, 1):
    zc_ = sz * 0.112
    parts.append(box(f"KamiFuda{sz}", S(0.004, 0.075, 0.026), P(BX + 0.05, DY + 0.005 + 0.0375, zc_), M["fuda"], bev=0.0006, uv=0))
    parts.append(box(f"KamiFudaFold{sz}", S(0.0045, 0.012, 0.0265), P(BX + 0.05, DY + 0.005 + 0.068, zc_), M["fuda"], uv=0))
    parts.append(box(f"KamiFudaSeal{sz}", S(0.0008, 0.008, 0.008), P(BX + 0.0476, DY + 0.005 + 0.03, zc_), M["fudaSeal"], uv=0))

# =====================================================================
# The sacred rope (注連縄) across the shrine's front, over the doors: twisted green-gold straw, fat in the middle and tapering to its tied
# ends, hanging in a shallow sag; three straw tassels (〆の子) hanging from it, each bound with a gold band, and four zigzag paper streamers
# (紙垂) between and outside them
# =====================================================================
sn = []


def tube(name, pts, radii, mat_, ring=10):
    """a tube along pts (game frame), radius radii[i] at each; its UVs round it and along it"""
    bm = bmesh.new() if False else None
    vs, fs, uvs = [], [], []
    n = len(pts)
    for i, p_ in enumerate(pts):
        a = Vector(pts[max(0, i - 1)]); b = Vector(pts[min(n - 1, i + 1)])
        t_ = (b - a).normalized()
        u_ = t_.cross(Vector((0, 1, 0)))
        if u_.length < 1e-6:
            u_ = t_.cross(Vector((1, 0, 0)))
        u_.normalize()
        w_ = t_.cross(u_).normalized()
        for k in range(ring):
            ang = 2 * math.pi * k / ring
            q = Vector(p_) + (u_ * math.cos(ang) + w_ * math.sin(ang)) * radii[i]
            vs.append(P(q.x, q.y, q.z))
            uvs.append((k / ring, i / (n - 1) * 6))
    for i in range(n - 1):
        for k in range(ring):
            k1 = (k + 1) % ring
            fs.append((i * ring + k, i * ring + k1, (i + 1) * ring + k1, (i + 1) * ring + k))
    o = mesh_obj(name, vs, fs, mat_, smooth_shade=True)
    uvl = o.data.uv_layers.new().data
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            uvl[li].uv = uvs[o.data.loops[li].vertex_index]
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return o


RX0, RY0, RZ0, SAG = -0.0655, 0.192, 0.066, 0.006     # (over the middle bay's doors, in front of its lintel; half its span; its sag)


def rope_at(t):
    """the rope's middle line at t (0..1 from one end to the other), and how thick it is there"""
    z = -RZ0 + 2 * RZ0 * t
    return Vector((RX0, RY0 - SAG * math.sin(math.pi * t), z)), 0.0026 + 0.0042 * math.sin(math.pi * t) ** 0.7


# (two strands twisted round the middle line, as loosely as a straw rope this long is (about 2.7 turns over its span), smooth, thick where
# the rope's thick)
NSEG = 120
for strand in range(2):
    pts, rad = [], []
    for i in range(NSEG + 1):
        t = i / NSEG
        c, r = rope_at(t)
        ang = t * 2.7 * 2 * math.pi + strand * math.pi
        pts.append((c.x + math.cos(ang) * r * 0.5, c.y + math.sin(ang) * r * 0.5, c.z))
        rad.append(r * 0.62)
    sn.append(tube(f"KamiShimenawa{strand}", pts, rad, M["straw"], ring=12))
# (the ends bound and cut: a band of straw round each, the ends splaying a little past it)
for sd in (0, 1):
    c, r = rope_at(sd * 1.0)
    out_ = -1 if sd == 0 else 1
    sn.append(cyl(f"KamiShimenawaTie{sd}", 0.0034, 0.003, P(c.x, c.y, c.z - out_ * 0.002), M["straw"], rot=(math.pi / 2, 0, 0), verts=14))
    for j in range(10):
        a_ = j * 2 * math.pi / 10
        p0 = Vector((c.x + math.cos(a_) * 0.0018, c.y + math.sin(a_) * 0.0018, c.z))
        p1 = Vector((c.x + math.cos(a_) * 0.0032, c.y + math.sin(a_) * 0.0032, c.z + out_ * 0.007))
        sn.append(tube(f"KamiShimenawaEnd{sd}{j}", [tuple(p0), tuple(p1)], [0.0006, 0.0005], M["straw"], ring=5))
# (the three tassels (〆の子): a knot where each is tied on, a gold band, then a bundle of straws hanging and spreading a little, cut square)
FIB = 14
for k, t in enumerate((0.25, 0.5, 0.75)):
    c, r = rope_at(t)
    top = c.y - r * 0.85
    L = 0.024 if k != 1 else 0.028
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0028, segments=14, ring_count=8, location=P(c.x, top, c.z))
    sn.append(finish(active(), f"KamiShimenawaKnob{k}", M["straw"]))
    sn.append(cyl(f"KamiShimenawaBand{k}", 0.0031, 0.0026, P(c.x, top - 0.0028, c.z), M["gold"], verts=16))
    rng_t = np.random.default_rng(40 + k)
    for j in range(FIB):
        a_ = j * 2 * math.pi / FIB + float(rng_t.uniform(-0.15, 0.15))
        r0, r1 = 0.0022, 0.0045 + float(rng_t.uniform(0, 0.0012))
        ll = L * float(rng_t.uniform(0.92, 1.0))
        p0 = (c.x + math.cos(a_) * r0, top - 0.004, c.z + math.sin(a_) * r0)
        pm = (c.x + math.cos(a_) * (r0 + r1) * 0.5, top - 0.004 - ll * 0.5, c.z + math.sin(a_) * (r0 + r1) * 0.5)
        p1 = (c.x + math.cos(a_) * r1, top - 0.004 - ll, c.z + math.sin(a_) * r1)
        sn.append(tube(f"KamiShimenawaStraw{k}{j}", [p0, pm, p1], [0.0011, 0.0011, 0.0009], M["straw"], ring=5))
    # (and a core, so the bundle reads full)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.0038, radius2=0.002, depth=L * 0.9, location=P(c.x, top - 0.004 - L * 0.45, c.z))
    sn.append(finish(active(), f"KamiShimenawaCore{k}", M["straw"]))
# (the paper streamers: one strip of paper cut and folded into a zigzag of four, each fold stepping down and across over the one above,
# all one piece, hung over the rope)
SW, SH_ = 0.0052, 0.0092
for k, t in enumerate((0.07, 0.375, 0.625, 0.93)):
    c, r = rope_at(t)
    y = c.y - r * 0.4
    sgn = 1 if k % 2 else -1
    folds = []
    for j in range(4):
        dz = sgn * (SW * 0.27 if j % 2 else -SW * 0.27)
        hj = SH_ * (1.15 if j == 3 else 1.0)
        # (each fold overlapping the one above by a little, the paper turned over at it, so the strip is one piece; a hair in front of it)
        folds.append(box(f"KamiShideF{k}{j}", S(0.00045, hj, SW), P(c.x - 0.0016 - j * 0.0002, y - hj * 0.5 - j * (SH_ - 0.0022), c.z + dz), M["shide"], uv=0))
    sn.append(join(folds, f"KamiShide{k}"))
parts += sn

root = bpy.data.objects.new("Kamidana", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root


def lathe(name, prof, mat_, segs=64, smooth_shade=True):
    """a turned piece: the profile (r, y) swept round the vertical, from its foot's middle round to its top's"""
    vs, fs = [], []
    n = len(prof)
    for j in range(segs):
        a = j / segs * 2 * math.pi
        for r, y in prof:
            vs.append(P(r * math.cos(a), y, r * math.sin(a)))
    for j in range(segs):
        j2 = (j + 1) % segs
        for i in range(n - 1):
            fs.append((j * n + i, j * n + i + 1, j2 * n + i + 1, j2 * n + i))
    o = mesh_obj(name, vs, fs, mat_, smooth_shade=smooth_shade)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=1e-6)
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")
    me_ = o.data
    uvl = me_.uv_layers.new().data
    for poly in me_.polygons:
        for li in poly.loop_indices:
            co = me_.vertices[me_.loops[li].vertex_index].co
            uvl[li].uv = (math.atan2(co.y, co.x) / (2 * math.pi) + 0.5, co.z / 0.06)
    return o


# =====================================================================
# The mikan on a footed porcelain dish (高坏): a flared foot ring, a waisted stem, a shallow bowl with a rolled rim, white glaze with a cobalt
# line round the rim and one round the foot; four mikan heaped on it, each a little flattened, its peel dimpled, a calyx and stem stub on top,
# two glossy leaves on the top one
# =====================================================================
ox = []
peel = mix((0.96, 0.46, 0.04), (0.86, 0.34, 0.02), fbm(256, 6, 6, 4))
pores = fbm(256, 46, 46, 2)
peel = mix(peel, (0.74, 0.28, 0.02), smooth(0.62, 0.8, pores) * 0.45)          # (the pits of the big oil pores, a little darker)
peel = mix(peel, (1.0, 0.6, 0.16), smooth(0.25, 0.08, pores) * 0.4)           # (the skin between them catching the light)
peel_tex = image("peel", peel)
M["peel"] = pbr("KamiPeel", (1, 1, 1), tex=peel_tex, rough=0.45)
M["calyx"] = pbr("KamiCalyx", lin("#4c6a22"), rough=0.6)
M["leaf"] = pbr("KamiLeaf", lin("#2f6a24"), rough=0.3)
glz = mix((0.96, 0.95, 0.92), (0.9, 0.9, 0.88), fbm(256, 8, 8, 3) * 0.6)
M["dish"] = pbr("KamiDish", (1, 1, 1), tex=image("glaze", glz), rough=0.25)
M["cobalt"] = pbr("KamiCobalt", lin("#1f3c8a"), rough=0.25)
PROF = [(0.0, 0.0005), (0.036, 0.0005), (0.046, 0.0015), (0.048, 0.005), (0.042, 0.009), (0.03, 0.013), (0.022, 0.018), (0.02, 0.026),
        (0.026, 0.032), (0.05, 0.038), (0.075, 0.044), (0.088, 0.049), (0.092, 0.053), (0.091, 0.056), (0.087, 0.0565), (0.08, 0.054),
        (0.06, 0.049), (0.03, 0.0465), (0.0, 0.046)]
ox.append(lathe("KamiDish", PROF, M["dish"]))
# (the cobalt lines: round the rim's top, round the foot)
for nm, r, y, rr in (("Rim", 0.0895, 0.0555, 0.0012), ("Foot", 0.0475, 0.004, 0.001)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=rr, major_segments=72, minor_segments=6, location=P(0, y, 0))
    ox.append(finish(active(), f"KamiDishLine{nm}", M["cobalt"]))
# (where each comes to rest, as they would if set down and let go: the three below each sitting in the dish's well (its surface under its
# middle), the fourth on top settling down until it touches the three (its height the highest at which it meets any of them))
WELL = [(0.0, 0.046), (0.03, 0.0465), (0.06, 0.049), (0.08, 0.054), (0.087, 0.0565)]


def well_at(d):
    for (r0, y0), (r1, y1) in zip(WELL, WELL[1:]):
        if d <= r1:
            return y0 + (y1 - y0) * (d - r0) / (r1 - r0)
    return WELL[-1][1]


FLAT = 0.82
LOW = [(0.0, -0.023, 0.03), (-0.021, 0.0125, 0.029), (0.021, 0.0125, 0.03)]
rest = []
for x, z, r in LOW:
    d = math.hypot(x, z)
    # (its underside on the well: the lowest point of the flattened ball, a touch above the curve at its edge too)
    rest.append((x, max(well_at(d), well_at(d + r * 0.5) - 0.0015) + r * FLAT, z, r))
tx, tz, tr = 0.0, 0.0, 0.027
ty = 0.0
for x, y, z, r in rest:
    dd = math.hypot(tx - x, tz - z)
    reach = (r + tr) * 0.93
    if dd < reach:
        ty = max(ty, y + math.sqrt(reach * reach - dd * dd) * FLAT)
rest.append((tx, ty, tz, tr))
TOP_Y = ty
for k, (x, y, z, r) in enumerate(rest):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=20, location=P(x, y, z))
    o = active()
    rng_ = np.random.default_rng(k + 3)
    ph_ = rng_.uniform(0, 6.28, 3)
    for vv in o.data.vertices:
        n_ = vv.co.normalized()
        vv.co.z *= FLAT
        # (a ponkan's peel: loose and pebbly, a few soft lobes round it, and the knob (its neck) pushed up round the stem)
        a_ = math.atan2(n_.y, n_.x)
        lobe = 0.03 * math.sin(5 * a_ + ph_[0]) * (1 - abs(n_.z))
        knob = 0.22 * max(0.0, n_.z - 0.82) / 0.18
        vv.co += n_ * r * (lobe + float(rng_.normal(0, 0.016)))
        vv.co.z += r * knob * 0.35
    # (turned about the vertical only, so it sits on its flattened underside)
    o.rotation_euler = (0, 0, float(rng_.uniform(0, 6.28)))
    finish(o, f"KamiOrange{k}", M["peel"])
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.sphere_project(); bpy.ops.object.mode_set(mode="OBJECT")
    ox.append(o)
    topv = Vector(P(x, y + r * (0.82 + 0.077), z))   # (on the knob round the stem)
    for j in range(5):
        a_ = j * 2 * math.pi / 5
        sp = box(f"KamiCalyx{k}{j}", S(0.007, 0.0015, 0.004), tuple(topv + Vector(P(math.cos(a_) * 0.0035, 0.0, math.sin(a_) * 0.0035))), M["calyx"], uv=0)
        sp.rotation_euler = (0, 0, -a_)
        ox.append(sp)
    ox.append(cyl(f"KamiStem{k}", 0.0012, 0.006, tuple(topv + Vector((0, 0, 0.003))), M["calyx"], verts=8))
for j, (rz, lean) in enumerate(((0.4, 0.5), (2.6, 0.4))):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8)
    lf = active()
    lf.scale = (0.022, 0.009, 0.0012)
    apply_scale(lf)
    for vv in lf.data.vertices:
        vv.co.z += (vv.co.x / 0.022) ** 2 * 0.003
    lf.location = Vector(P(0, TOP_Y + 0.027 * (FLAT + 0.077) + 0.002, 0.0)) + Vector((math.cos(rz) * 0.014, math.sin(rz) * 0.014, 0.001))
    lf.rotation_euler = (lean * 0.3, -lean * 0.4, rz)
    ox.append(finish(lf, f"KamiOrangeLeaf{j}", M["leaf"]))
oranges = bpy.data.objects.new("KamiOranges", None)
bpy.context.collection.objects.link(oranges)
for o in ox:
    if o.parent is None:
        o.parent = oranges

# =====================================================================
# The book of prayers (大祓詞), a folded book (折本): its accordion-folded pages, gilt along their edges, between two boards covered in a deep
# purple brocade woven with gold (七宝, interlocking rings), a cream title slip edged in gold with its name written down it in black, tied
# round with a purple silk cord, a bow on top, its two ends running off the book to a tassel (房) lying on the table
# =====================================================================
sx_ = []
W2, D2, H2 = 0.105, 0.24, 0.022
M["paper"] = pbr("KamiPaper", lin("#f3ecd8"), rough=0.8)
pages = box("KamiSutraPages", S(W2 - 0.004, H2 - 0.006, D2 - 0.004), P(0, H2 / 2, 0), M["paper"], uv=0)
sx_.append(pages)
# (the folds' edges, gilt, every leaf)
for k in range(10):
    yy = 0.004 + (H2 - 0.008) * (k + 0.5) / 10
    for sz in (-1, 1):
        sx_.append(box(f"KamiSutraFold{k}{sz}", S(W2 - 0.006, 0.0004, 0.0012), P(0, yy, sz * (D2 / 2 - 0.0015)), M["gold"], uv=0))
uu, vv = grid01(N)
# (七宝: rings on a grid, each overlapping its neighbours, in gold on deep purple; a fainter woven texture under it)
gx, gy = (uu * 20) % 1.0, (vv * 44) % 1.0
ring_ = lambda cx, cy: np.abs(np.sqrt((gx - cx) ** 2 + (gy - cy) ** 2) - 0.5) < 0.035  # noqa: E731
shippo = (ring_(0, 0) | ring_(1, 0) | ring_(0, 1) | ring_(1, 1) | ring_(0.5, 0.5)).astype(np.float32)
weave = (np.sin(uu * math.pi * 2 * 220) * np.sin(vv * math.pi * 2 * 220) > 0).astype(np.float32)
bro = mix(mix((0.2, 0.07, 0.24), (0.26, 0.1, 0.3), fbm(N, 8, 8, 3)), (0.14, 0.05, 0.17), weave * 0.25)
brocade_tex = image("brocade", mix(bro, (0.78, 0.62, 0.28), shippo * 0.7))
M["brocade"] = pbr("KamiBrocade", (1, 1, 1), tex=brocade_tex, rough=0.45)
M["slip"] = pbr("KamiSlip", lin("#f4ecd4"), rough=0.7)
M["ink"] = pbr("KamiInk", lin("#141010"), rough=0.6)
M["cord"] = pbr("KamiCord", lin("#5a2068"), rough=0.5)
for y, nm in ((0.0015, "Back"), (H2 - 0.0015, "Front")):
    cov = box(f"KamiSutra{nm}", S(W2, 0.003, D2), P(0, y, 0), M["brocade"], bev=0.0008, uv=0)
    # (the brocade's pattern laid square on the cover)
    me_ = cov.data
    uvl = me_.uv_layers.new().data
    for poly in me_.polygons:
        for li in poly.loop_indices:
            co = me_.vertices[me_.loops[li].vertex_index].co
            uvl[li].uv = (co.x / W2 + 0.5, co.y / D2 + 0.5)
    sx_.append(cov)
# (the title slip: cream, gold edged, its name written down it)
SLZ, SLL = -0.035, 0.15
sx_.append(box("KamiSutraSlipGold", S(0.03, 0.0005, SLL + 0.006), P(0.022, H2 + 0.0002, SLZ), M["gold"], uv=0))
sx_.append(box("KamiSutraSlip", S(0.026, 0.0005, SLL), P(0.022, H2 + 0.0005, SLZ), M["slip"], uv=0))
font = None
for fp in ("C:/Windows/Fonts/kaiu.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothM.ttc"):
    if os.path.exists(fp):
        try:
            font = bpy.data.fonts.load(fp)
            break
        except RuntimeError:
            continue
TITLE = "大祓詞"
for k, ch in enumerate(TITLE):
    cu = bpy.data.curves.new(f"KamiSutraChar{k}", "FONT")
    cu.body = ch
    if font:
        cu.font = font
    cu.size = 0.019
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = 0.0002
    t = bpy.data.objects.new(f"KamiSutraChar{k}", cu)
    bpy.context.collection.objects.link(t)
    # (written down the slip, top to bottom from its far end; each upright with its top toward the slip's far end)
    t.location = P(0.022, H2 + 0.0009, SLZ - SLL / 2 + 0.03 + k * 0.03)
    t.rotation_euler = (0, 0, 0)
    bpy.ops.object.select_all(action="DESELECT"); t.select_set(True); bpy.context.view_layer.objects.active = t
    bpy.ops.object.convert(target="MESH")
    t = active()
    print("TITLE_CHAR", ch, len(t.data.vertices))
    sx_.append(finish(t, f"KamiSutraChar{k}", M["ink"], smooth_shade=False))
# (the cord round its middle, a bow on top)
CZ = 0.07
bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.04, major_segments=40, minor_segments=6, location=P(0, H2 / 2, CZ))
cord = active()
cord.scale = (W2 / 2 + 0.0015, H2 / 2 + 0.0015, 0.08)
apply_scale(cord)
cord.rotation_euler = (math.pi / 2, 0, 0)
sx_.append(finish(cord, "KamiSutraCord", M["cord"]))
for sd in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.008, minor_radius=0.0013, major_segments=16, minor_segments=6, location=P(sd * 0.008, H2 + 0.002, CZ))
    sx_.append(finish(active(), f"KamiSutraBow{sd}", M["cord"]))
# (the two ends of the cord from the bow over the book's edge and down onto the table, to the tassel)
TX, TZ = W2 / 2 + 0.05, CZ + 0.03
for j, off in enumerate((-0.003, 0.003)):
    path = [(0.0, H2 + 0.002, CZ + off), (W2 / 2, H2 + 0.002, CZ + off * 1.5), (W2 / 2 + 0.008, H2 * 0.5, CZ + off * 2 + 0.004),
            (W2 / 2 + 0.018, 0.002, CZ + off * 2 + 0.012), (TX - 0.012, 0.002, TZ - 0.004)]
    for i in range(len(path) - 1):
        a, b = Vector(P(*path[i])), Vector(P(*path[i + 1]))
        mid, d = (a + b) / 2, b - a
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0013, depth=d.length + 0.002, location=mid)
        c = active()
        c.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        sx_.append(finish(c, f"KamiSutraTail{j}{i}", M["cord"]))
# (the tassel, lying on the table: a knotted head, a gold band, a spray of silk threads)
tdir = Vector(P(1, 0, 0.35)).normalized()
head = Vector(P(TX - 0.008, 0.005, TZ - 0.003))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, segments=14, ring_count=8, location=head)
sx_.append(finish(active(), "KamiSutraTasselHead", M["cord"]))
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.0055, depth=0.005, location=head + tdir * 0.007)
band = active()
band.rotation_euler = tdir.to_track_quat("Z", "Y").to_euler()
sx_.append(finish(band, "KamiSutraTasselBand", M["gold"]))
frng = np.random.default_rng(9)
for i in range(22):
    a_ = i / 22 * 2 * math.pi
    spread = Vector((0, 0, 0))
    side = Vector(P(0, 0, 1)).cross(tdir).normalized()
    up = tdir.cross(side).normalized()
    r0 = 0.004
    p0 = head + tdir * 0.009 + side * math.cos(a_) * r0 + up * math.sin(a_) * r0 * 0.5
    ln = 0.03 + float(frng.uniform(-0.004, 0.004))
    p1 = head + tdir * (0.009 + ln) + side * math.cos(a_) * (r0 + 0.004) + up * math.sin(a_) * 0.001
    p1.z = max(p1.z, 0.0012)
    d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.0007, depth=d.length, location=(p0 + p1) / 2)
    f_ = active()
    f_.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    sx_.append(finish(f_, f"KamiSutraFringe{i}", M["cord"]))
sutra = bpy.data.objects.new("KamiSutra", None)
bpy.context.collection.objects.link(sutra)
for o in sx_:
    if o.parent is None:
        o.parent = sutra

# =====================================================================
# The offering table (in the altar's own frame and size): its top three boards of keyaki side by side, their grain along the table and their
# rings showing, each board its own; a dark lip along the front and sides with a gold line inlaid inside it, gold caps on the two front corners,
# and under the front edge an apron cut with five arched openings
# =====================================================================
tx_ = []
TD, TL, TT = 0.58, 0.9, 0.034
M["keyaki"] = [pbr(f"KamiTable{k}", (1, 1, 1), tex=t, rough=0.45) for k, t in enumerate(keyaki_texs)]
M["keyakiDark"] = pbr("KamiTableDark", (1, 1, 1), tex=keyaki_dark_tex, rough=0.5)
for k in range(3):
    bw = TD / 3
    tx_.append(box(f"KamiTableBoard{k}", S(bw - 0.0015, TT, TL), P(-TD / 2 + bw * (k + 0.5), -TT / 2, 0), M["keyaki"][k], bev=0.001, uv=0.45))
# (a dark backing under the seams, so the joints read)
tx_.append(box("KamiTableCore", S(TD - 0.01, TT - 0.004, TL - 0.01), P(0, -TT / 2, 0), M["eaveLine"], uv=0))
LIP, LIP_H = 0.014, 0.012
tx_.append(box("KamiTableLipF", S(LIP, LIP_H, TL), P(-TD / 2 + LIP / 2, LIP_H / 2, 0), M["keyakiDark"], bev=0.001))
for sd in (-1, 1):
    tx_.append(box(f"KamiTableLip{sd}", S(TD - LIP, LIP_H, LIP), P(LIP / 2, LIP_H / 2, sd * (TL / 2 - LIP / 2)), M["keyakiDark"], bev=0.001))
tx_.append(box("KamiTableInlayF", S(0.004, 0.0006, TL - 2 * LIP - 0.024), P(-TD / 2 + LIP + 0.012, 0.0003, 0), M["gold"], uv=0))
for sd in (-1, 1):
    tx_.append(box(f"KamiTableInlay{sd}", S(TD - LIP - 0.024, 0.0006, 0.004), P(LIP / 2 + 0.006, 0.0003, sd * (TL / 2 - LIP - 0.012)), M["gold"], uv=0))
CAP = 0.042
for sd in (-1, 1):
    zc_ = sd * (TL / 2 - CAP / 2)
    tx_.append(box(f"KamiTableCapTop{sd}", S(CAP, 0.0024, CAP), P(-TD / 2 + CAP / 2, LIP_H + 0.0012, zc_), M["gold"], uv=0))
    tx_.append(box(f"KamiTableCapFront{sd}", S(0.0024, LIP_H + TT, CAP), P(-TD / 2 - 0.0012, (LIP_H - TT) / 2, zc_), M["gold"], uv=0))
    tx_.append(box(f"KamiTableCapSide{sd}", S(CAP, LIP_H + TT, 0.0024), P(-TD / 2 + CAP / 2, (LIP_H - TT) / 2, sd * (TL / 2 + 0.0012)), M["gold"], uv=0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.004, segments=10, ring_count=6, location=P(-TD / 2 + CAP / 2 - 0.004, LIP_H + 0.0034, zc_ - sd * 0.004))
    tx_.append(finish(active(), f"KamiTableCapNail{sd}", M["gold"]))
# (the apron: a board under the front edge, five arched openings cut through it)
AW, AH, AT = 0.86, 0.07, 0.016
apron = box("KamiTableApron", S(AT, AH, AW), P(-TD / 2 + LIP + AT / 2, -TT - AH / 2 + 0.001, 0), M["keyakiDark"], bev=0.0015)
for k in range(5):
    zc_ = (k - 2) * 0.15
    cut = box(f"KamiApronCut{k}", S(AT * 3, AH - 0.032, 0.05), P(-TD / 2 + LIP + AT / 2, -TT - AH + 0.016 + (AH - 0.032) / 2, zc_), M["seam"], uv=0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.025, depth=AT * 3, location=P(-TD / 2 + LIP + AT / 2, -TT - 0.016 - 0.025 + 0.004, zc_), rotation=(0, math.pi / 2, 0))
    arch_ = active()
    for c_ in (cut, arch_):
        mod = apron.modifiers.new("d", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = c_
        mod.solver = "EXACT"
        apply_mods(apron)
        bpy.data.objects.remove(c_)
uv_grain(apron, 0.3)
tx_.append(apron)
table = bpy.data.objects.new("KamiTable", None)
bpy.context.collection.objects.link(table)
for o in tx_:
    if o.parent is None:
        o.parent = table

# =====================================================================
# The sake flask (御神酒徳利): white porcelain, a round belly narrowing to a long neck and a flared lip; a red cord tied round the neck with
# its knot, a folded paper streamer (紙垂) hanging from it, and a paper label down the belly with 御神酒 written on it inside a red border.
# Its foot's middle at the origin (it's tipped about it as it pours)
# =====================================================================
fx_ = []
M["redCord"] = pbr("KamiRedCord", lin("#c4302a"), rough=0.55)
FPROF = [(0.0, 0.0), (0.022, 0.0), (0.03, 0.003), (0.036, 0.01), (0.04, 0.026), (0.0395, 0.042), (0.036, 0.056), (0.028, 0.072), (0.019, 0.086),
         (0.0125, 0.1), (0.011, 0.114), (0.0108, 0.128), (0.0125, 0.138), (0.015, 0.145), (0.0148, 0.1495), (0.012, 0.15), (0.009, 0.147),
         (0.0085, 0.136)]
# (its glaze painted in cobalt (染付): a double line round the foot, a band of waves (青海波) round the shoulder between double lines, a line
# round the neck; UVs round it (u) and up it (v, the flask's height))
_fu, _fv = grid01(512)
fl = np.ones((512, 512, 3), np.float32) * np.asarray((0.95, 0.94, 0.9), np.float32)
COB = (0.12, 0.2, 0.5)
for lo_, hi_ in ((0.012, 0.022), (0.84, 0.848)):
    fl = mix(fl, COB, ((_fv >= lo_) & (_fv <= hi_)).astype(np.float32) * 0.9)
# (the sea round its foot: rows of nested arcs (青海波) from the foot up to about a third of its height, deeper blue toward the bottom, fading
# out as they rise)
SEA_TOP = 0.34
band = (_fv > 0.025) & (_fv < SEA_TOP)
wy = (_fv - 0.025) / (SEA_TOP - 0.025) * 4.0
row = np.floor(wy)
wx = _fu * 22 + row * 0.5
cx_ = np.floor(wx) + 0.5
dd = np.sqrt((wx - cx_) ** 2 + (wy - row) ** 2)
waves = (np.abs((dd * 5) % 1.0 - 0.5) < 0.17) & (dd < 0.62)
depth = np.clip(1.0 - (_fv - 0.025) / (SEA_TOP - 0.025), 0, 1)
SEA_DEEP, SEA_LIGHT = (0.06, 0.13, 0.42), (0.3, 0.48, 0.78)
sea = mix(np.broadcast_to(np.asarray(SEA_LIGHT, np.float32), _fv.shape + (3,)), SEA_DEEP, depth)
fl = mix(fl, sea, (band & waves).astype(np.float32) * (0.45 + 0.5 * depth))
# (a wash of pale blue under the waves, the water itself, strongest at the foot)
fl = mix(fl, (0.55, 0.68, 0.88), band.astype(np.float32) * depth * 0.35)
# (along the top of the sea, the crests breaking: a scalloped line of foam curling over)
crest_y = SEA_TOP - 0.012 + 0.012 * np.abs(np.sin(_fu * math.pi * 22))
crest = np.abs(_fv - crest_y) < 0.006
fl = mix(fl, COB, crest.astype(np.float32) * 0.85)
M["flaskGlaze"] = pbr("KamiFlaskGlaze", (1, 1, 1), tex=image("flaskGlaze", fl), rough=0.22)
fb_ = lathe("KamiFlaskBody", FPROF, M["flaskGlaze"], segs=48)
_me = fb_.data
_uvl = _me.uv_layers.active.data
for _poly in _me.polygons:
    for _li in _poly.loop_indices:
        _co = _me.vertices[_me.loops[_li].vertex_index].co
        _uvl[_li].uv = (math.atan2(_co.y, _co.x) / (2 * math.pi) + 0.5, _co.z / 0.15)
fx_.append(fb_)
bpy.ops.mesh.primitive_torus_add(major_radius=0.0122, minor_radius=0.0021, major_segments=24, minor_segments=6, location=P(0, 0.112, 0))
fx_.append(finish(active(), "KamiFlaskCord", M["redCord"]))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0042, segments=10, ring_count=6, location=P(-0.0128, 0.112, 0))
fx_.append(finish(active(), "KamiFlaskKnot", M["redCord"]))
for j, (dz, ln) in enumerate(((-0.003, 0.03), (0.003, 0.026))):
    tail = box(f"KamiFlaskCordTail{j}", S(0.0018, ln, 0.0024), P(-0.0135 - 0.002, 0.112 - ln / 2, dz), M["redCord"], uv=0)
    tail.rotation_euler = (0, 0.08 * (1 if j else -1), 0)
    fx_.append(tail)
# (the streamer: a strip of paper cut and folded back and forth, hanging in four steps)
zz_, yy_ = 0.0, 0.106
for k in range(4):
    w_ = 0.013
    fx_.append(box(f"KamiFlaskShide{k}", S(0.0006, 0.012, w_), P(-0.017 - k * 0.001, yy_ - 0.006, zz_ + (0.004 if k % 2 else -0.004)), M["paper"], uv=0))
    yy_ -= 0.012
# (the label down the belly, facing out from the flask's front (-x), a red border round it, its name written in black)
LX = -0.0402
fx_.append(box("KamiFlaskLabel", S(0.0008, 0.06, 0.03), P(LX, 0.04, 0), M["paper"], uv=0))
for nm, size, at in (("T", S(0.0006, 0.0015, 0.027), (0.067,)), ("B", S(0.0006, 0.0015, 0.027), (0.013,))):
    fx_.append(box(f"KamiFlaskLabelRed{nm}", size, P(LX - 0.0006, at[0], 0), M["redCord"], uv=0))
for sd in (-1, 1):
    fx_.append(box(f"KamiFlaskLabelRedS{sd}", S(0.0006, 0.055, 0.0015), P(LX - 0.0006, 0.04, sd * 0.0128), M["redCord"], uv=0))
for k, ch in enumerate("御神酒"):
    cu = bpy.data.curves.new(f"KamiFlaskChar{k}", "FONT")
    cu.body = ch
    if font:
        cu.font = font
    cu.size = 0.0145
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = 0.00015
    t = bpy.data.objects.new(f"KamiFlaskChar{k}", cu)
    bpy.context.collection.objects.link(t)
    t.location = P(LX - 0.0008, 0.056 - k * 0.016, 0)
    t.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.select_all(action="DESELECT"); t.select_set(True); bpy.context.view_layer.objects.active = t
    bpy.ops.object.convert(target="MESH")
    fx_.append(finish(active(), f"KamiFlaskChar{k}", M["ink"], smooth_shade=False))
# (the label and all on it wrapped onto the belly: every point taken round the flask at its height, as far out from the glaze as it was from
# the label's flat back, so it lies on the curve, not off it)
OUT = [(r, y) for r, y in FPROF[1:10]]


def body_r(y):
    for (r0, y0), (r1, y1) in zip(OUT, OUT[1:]):
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return OUT[-1][0]


def wrap(o, cuts=0):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if cuts:
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.subdivide(number_cuts=cuts)
        bpy.ops.object.mode_set(mode="OBJECT")
    for vt in o.data.vertices:
        gx, gy, gz = vt.co.x, vt.co.z, -vt.co.y          # (the game's frame)
        r = body_r(gy)
        rad = r + 0.0004 + (LX - gx)
        a = gz / r
        vt.co = Vector(P(-rad * math.cos(a), gy, rad * math.sin(a)))
    o.data.update()


for o in fx_:
    if o.name.startswith(("KamiFlaskLabel", "KamiFlaskChar")):
        wrap(o, cuts=10 if o.name.startswith("KamiFlaskLabel") else 0)
flask = bpy.data.objects.new("KamiFlask", None)
bpy.context.collection.objects.link(flask)
for o in fx_:
    if o.parent is None:
        o.parent = flask

# =====================================================================
# The stand the three sake cups sit on (in the shrine's frame, before it): a long porcelain tray, its corners rounded and its rim curling up
# and out, on a low foot ring; glazed a deep cobalt (瑠璃釉) with emerald and turquoise running through it in flowing streaks, as a kiln
# leaves them; its well flat at 1.75 cm up, where the cups' feet are
# =====================================================================
cs_ = []
uu_, vv_ = grid01(512)
warp_ = (fbm(512, 3, 3, 4) - 0.5) * 0.35
flow = fbm(512, 6, 2, 5)
band = np.sin((uu_ * 7 + vv_ * 2 + warp_ * 3 + flow * 2.5) * math.pi * 2) * 0.5 + 0.5
glaze_ = mix((0.015, 0.035, 0.13), (0.025, 0.065, 0.2), fbm(512, 8, 8, 4))
glaze_ = mix(glaze_, (0.04, 0.26, 0.3), smooth(0.74, 0.93, band) * smooth(0.35, 0.7, flow) * 0.8)   # (turquoise runs)
glaze_ = mix(glaze_, (0.05, 0.24, 0.14), smooth(0.8, 0.95, fbm(512, 5, 5, 4)) * 0.6)              # (emerald pools)
glaze_ = mix(glaze_, (0.3, 0.42, 0.46), smooth(0.94, 0.995, band) * 0.25)                         # (paler where it thinned)
M["ruri"] = pbr("KamiRuri", (1, 1, 1), tex=image("ruri", glaze_), rough=0.08, coat=1.0)
CST, RX_S, RZ_S = 0.0175, 0.029, 0.128
# (the section from the foot's middle out and round to the well's middle: (how far out, as a part of the outline), height)
SEC = [(0.0, 0.0), (0.78, 0.0), (0.82, 0.0015), (0.83, 0.0045), (0.8, 0.006), (0.86, 0.008), (0.94, 0.012), (1.0, 0.0165), (1.035, 0.021),
       (1.045, 0.0232), (1.025, 0.0238), (0.985, 0.0212), (0.95, 0.0185), (0.9, 0.0176), (0.0, CST)]
NA = 72
vs, fs, uvs = [], [], []
for j in range(NA):
    t = j / NA * 2 * math.pi
    # (a rounded oblong: a superellipse, square-ish with soft corners)
    ct, st_ = math.cos(t), math.sin(t)
    ex = 0.25
    ex_x = math.copysign(abs(ct) ** ex, ct) * RX_S
    ex_z = math.copysign(abs(st_) ** ex, st_) * RZ_S
    for k_, (f, y) in enumerate(SEC):
        vs.append(P(ex_x * f, y, ex_z * f))
        uvs.append((ex_x * f / 0.09 + 0.5, ex_z * f / 0.32 + 0.5 + y * 2))
n_ = len(SEC)
for j in range(NA):
    j2 = (j + 1) % NA
    for k_ in range(n_ - 1):
        fs.append((j * n_ + k_, j * n_ + k_ + 1, j2 * n_ + k_ + 1, j2 * n_ + k_))
me_ = bpy.data.meshes.new("KamiCupStand")
me_.from_pydata(vs, [], fs)
me_.update()
uvl = me_.uv_layers.new().data
for poly in me_.polygons:
    for li in poly.loop_indices:
        uvl[li].uv = uvs[me_.loops[li].vertex_index]
st_o = bpy.data.objects.new("KamiCupStandBody", me_)
bpy.context.collection.objects.link(st_o)
finish(st_o, "KamiCupStandBody", M["ruri"], smooth_shade=True)
bpy.ops.object.select_all(action="DESELECT"); st_o.select_set(True); bpy.context.view_layer.objects.active = st_o
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=1e-6)
bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")
cs_.append(st_o)
cupstand = bpy.data.objects.new("KamiCupStand", None)
bpy.context.collection.objects.link(cupstand)
for o in cs_:
    if o.parent is None:
        o.parent = cupstand

oranges.parent = root
sutra.parent = root
table.parent = root
flask.parent = root
cupstand.parent = root
flask.location = (1.0, 0, 0)
cupstand.location = (1.3, 0, 0)
oranges.location = (0.4, 0, 0)
sutra.location = (0.7, 0, 0)
table.location = (0, 1.2, 0)
parts += ox + sx_ + tx_ + fx_ + cs_ + [oranges, sutra, table, flask, cupstand]

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (-0.75, -0.35, 0.3)
    cam.rotation_euler = (Vector((0, 0, 0.15)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((-1, -1, 1.5), 300), ((1, 1, 1), 100)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 1.2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kamidana.glb"), os.path.join(PROJECT, "blender", "kamidana.blend"), PREVIEW)
print("KAMIDANA_DONE", len(parts), "parts")
