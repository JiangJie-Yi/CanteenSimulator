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


def bay(tag, zc, width, body_h, ridge_h, depth=0.13):
    """one bay of the shrine: its body with a post at each corner, its pair of doors with the gold crest and corner plates, and its roof: two
    curved slopes of bark laid deep, each gable's bargeboards running up past the ridge as the crossed finials (one board each, the pair one
    piece where they cross), the gold ridge on top with the ridge logs across it"""
    out = []
    y0 = DY
    cx0 = BX + 0.005
    out.append(box(f"Kami{tag}Body", S(depth, body_h, width), P(cx0, y0 + body_h / 2, zc), wood(), bev=0.0015))
    # (the posts at its corners, standing a little proud of the walls)
    for sx in (-1, 1):
        for sz in (-1, 1):
            out.append(box(f"Kami{tag}Pillar{sx}{sz}", S(0.009, body_h, 0.009), P(cx0 + sx * (depth / 2 - 0.002), y0 + body_h / 2, zc + sz * (width / 2 - 0.002)),
                           M["woodDark"], bev=0.001))
    # (a tie beam round it under the roof)
    out.append(box(f"Kami{tag}Beam", S(depth + 0.006, 0.008, width + 0.006), P(cx0, y0 + body_h - 0.006, zc), M["woodDark"], bev=0.001))
    # (the doors: two leaves in a frame on the front, a dark seam, the gold crest where they meet, a gold plate at each corner)
    fx = cx0 - depth / 2 - 0.0012
    out.append(box(f"Kami{tag}DoorFrame", S(0.004, body_h * 0.8, width * 0.72), P(fx, y0 + body_h * 0.46, zc), M["woodDark"]))
    for sd in (-1, 1):
        out.append(box(f"Kami{tag}Door{sd}", S(0.002, body_h * 0.74, width * 0.33), P(fx - 0.002, y0 + body_h * 0.46, zc + sd * width * 0.17), wood()))
        for sv in (-1, 1):
            out.append(box(f"Kami{tag}DoorPlate{sd}{sv}", S(0.0012, 0.009, 0.009),
                           P(fx - 0.0035, y0 + body_h * 0.46 + sv * body_h * 0.33, zc + sd * width * 0.3), M["gold"], uv=0))
    out.append(box(f"Kami{tag}Seam", S(0.0014, body_h * 0.74, 0.0016), P(fx - 0.0035, y0 + body_h * 0.46, zc), M["seam"], uv=0))
    out.append(cyl(f"Kami{tag}Crest", width * 0.07, 0.002, P(fx - 0.004, y0 + body_h * 0.46, zc), M["gold"], rot=(0, math.pi / 2, 0), verts=24))
    out.append(cyl(f"Kami{tag}CrestRing", width * 0.045, 0.0025, P(fx - 0.0045, y0 + body_h * 0.46, zc), M["seam"], rot=(0, math.pi / 2, 0), verts=20))
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
        # (the eave's cut edge: a dark line along it, the bark's layers)
        ex = cx0 + sx * (run + 0.0005)
        for k, dy in enumerate((-0.004, -0.009)):
            out.append(box(f"Kami{tag}EaveLine{sx}{k}", S(0.0012, 0.0012, W + 0.001), P(ex, y_top(1) + dy, zc), M["eaveLine"], uv=0))
        out.append(box(f"Kami{tag}EaveGold{sx}", S(0.0025, 0.003, W + 0.002), P(ex - sx * 0.002, y_top(1) - RT - 0.001, zc), M["gold"], uv=0))
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
    # (the bargeboards and the crossed finials (千木): at each gable, each slope's board runs from the eave up along the roof's edge and on
    # past the ridge, straight, as one finial; the two cross over the ridge as one piece of wood (joined where they cross))
    tan0 = -(rise + sag * math.pi)  # (the slope's rise per unit of s at the ridge)
    CH = 0.06  # (how far each finial reaches past the ridge, along x)
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
    n = 3 if width > 0.12 else 2
    for k in range(n):
        z = zc + (k - (n - 1) / 2) * width * 0.32
        lg = cyl(f"Kami{tag}Katsuogi{k}", 0.0065, 0.05, P(cx0, ridge_h + 0.025, z), M["woodDark"], rot=(0, math.pi / 2, 0), verts=14)
        uv_grain(lg, 0.1)
        out.append(lg)
        for sx in (-1, 1):
            out.append(cyl(f"Kami{tag}KatsuogiCap{k}{sx}", 0.0069, 0.005, P(cx0 + sx * 0.025, ridge_h + 0.025, z), M["gold"], rot=(0, math.pi / 2, 0), verts=14))
    return out


parts += bay("M", 0.0, 0.15, 0.165, 0.28)
for sz in (-1, 1):
    parts += bay(f"S{sz}", sz * 0.112, 0.07, 0.125, 0.215, depth=0.112)

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
peel = mix((0.95, 0.5, 0.06), (0.88, 0.4, 0.04), fbm(256, 6, 6, 4))
dots = (fbm(256, 60, 60, 2) > 0.62).astype(np.float32)
peel_tex = image("peel", mix(peel, (1.0, 0.62, 0.18), dots * 0.5))
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
DISH_Y = 0.046 - 0.004
for k, (x, y, z, r) in enumerate([(0, 0.03, -0.022, 0.03), (-0.022, 0.03, 0.022, 0.029), (0.024, 0.03, 0.02, 0.03), (0, 0.078, 0.006, 0.027)]):
    y += DISH_Y
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=20, location=P(x, y, z))
    o = active()
    rng_ = np.random.default_rng(k + 3)
    for vv in o.data.vertices:
        n_ = vv.co.normalized()
        vv.co.z *= 0.82
        vv.co += n_ * float(rng_.normal(0, r * 0.012))
    o.rotation_euler = (float(rng_.normal(0, 0.2)), float(rng_.normal(0, 0.2)), float(rng_.uniform(0, 6.28)))
    finish(o, f"KamiOrange{k}", M["peel"])
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.sphere_project(); bpy.ops.object.mode_set(mode="OBJECT")
    ox.append(o)
    topv = Vector(P(x, y + r * 0.82, z))
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
    lf.location = Vector(P(0, DISH_Y + 0.078 + 0.027 * 0.82 + 0.002, 0.006)) + Vector((math.cos(rz) * 0.014, math.sin(rz) * 0.014, 0.001))
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
fx_.append(lathe("KamiFlaskBody", FPROF, M["dish"], segs=40))
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
flask = bpy.data.objects.new("KamiFlask", None)
bpy.context.collection.objects.link(flask)
for o in fx_:
    if o.parent is None:
        o.parent = flask

# =====================================================================
# The stand the three sake cups sit on (in the shrine's frame, before it): a low board of hinoki on two feet, a fine raised edge round it,
# its top 1.75 cm up, where the cups' feet are
# =====================================================================
cs_ = []
CST, CSD, CSW = 0.0175, 0.07, 0.29
cs_.append(box("KamiCupStandTop", S(CSD, 0.006, CSW), P(0, CST - 0.003, 0), wood(), bev=0.001))
for sd in (-1, 1):
    cs_.append(box(f"KamiCupStandFoot{sd}", S(CSD - 0.012, CST - 0.006, 0.014), P(0, (CST - 0.006) / 2, sd * (CSW / 2 - 0.02)), wood(), bev=0.0008))
for sx in (-1, 1):
    cs_.append(box(f"KamiCupStandEdgeX{sx}", S(0.003, 0.002, CSW), P(sx * (CSD / 2 - 0.0015), CST + 0.001, 0), M["woodDark"], uv=0.1))
for sd in (-1, 1):
    cs_.append(box(f"KamiCupStandEdgeZ{sd}", S(CSD, 0.002, 0.003), P(0, CST + 0.001, sd * (CSW / 2 - 0.0015)), M["woodDark"], uv=0.1))
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
