"""The shop's round stools (丸椅子), short and sturdy, in natural oak:

- stool.glb, node "Stool": the customers' bar stool, 29 cm to its seat. A thick round seat of two oak boards edge-glued (their grain
  running straight across it, the late wood in soft arches, open pores), its edge rolled round like a bun; a plump indigo cushion piped
  round its rim and buttoned in the middle; four stout round legs splayed out, tapering a little to rounded feet; one bent ring between
  them low down for the feet. The grain follows each piece: across the seat, down each leg, round the ring.
(The till's two seats are blender/tillstools.py's: a walnut chair and stool of their own.)

Every piece's UVs are its own (the seat's laid flat from above, the legs' and the ring's along them), so the oak's grain runs the way it
would in the wood. Low in triangles: the round parts 20 to 24 round, smooth shaded.

Run:
    blender -b --factory-startup --python blender/stools.py -- <project path> [preview.png]
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
# (how much of the wood one repeat of the oak's picture covers: two boards across, each 12.5 cm wide)
TILE = 0.25


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# =====================================================================
# The oak: two boards side by side, their grain running along v
# =====================================================================
def oak(N=1024, straight=False):
    """oak as boards really are (the owner: more natural, irregular): growth rings of uneven widths, wandering where the tree grew as it
    would, each ring's late wood a darker band of its own width; the colour drifting along each board; open pores in streaks; oak's
    silvery rays across the grain; on the seat's boards a small pin knot, the rings bending round it. `straight`: quarter-sawn, as the legs
    and the ring are turned from (the rings in long wandering lines down it, the rays' flecks plainer); else flat-sawn (soft arches,
    cathedrals). Every frequency a whole number of times round the picture, so it repeats without a seam"""
    seed(31 if straight else 47)
    u, v = grid01(N)
    boards = 2
    bk = np.clip(np.floor(u * boards), 0, boards - 1)
    bu = u * boards - bk                                    # (0..1 across each board)
    tones = np.array([(0.78, 0.59, 0.39), (0.72, 0.535, 0.345)], np.float32)
    base = tones[bk.astype(int)]
    w1 = fbm(N, 3, 2, 5) - 0.5                              # (the wood's own slow wandering)
    w2 = (fbm(N, 9, 4, 4) - 0.5) * 0.55                     # (and its smaller waver)
    if straight:
        ring = bu * 8.0 + w1 * 1.6 + w2 * 0.45 + 0.2 * np.sin(2 * math.pi * (v + bk * 0.3))
    else:
        centre = 0.5 + 0.13 * np.sin(2 * math.pi * (v + bk * 0.37)) + w1 * 0.16
        d = np.abs(bu - centre) * 2.0
        # (the cathedral: the rings' crowns rising and falling along the board)
        ring = (d ** 1.5) * 6.5 + 1.7 * np.sin(2 * math.pi * v + bk * 2.1) * (0.75 + w1) + w2 * 0.9
        # (a pin knot on each board, the rings bent round it)
        for b, (ku, kv) in enumerate([(0.32, 0.44), (0.66, 0.62)]):
            kx = (bu - ku) * 1.0
            ky = (v - kv) * 2.2
            r2 = kx * kx + ky * ky
            on = (bk == b)
            ring = ring + np.where(on, 1.6 * np.exp(-r2 / 0.003), 0.0)
            knot = np.where(on, smooth(0.0009, 0.0002, r2), 0.0)
            base = mix(base, np.float32(0.42) * base, knot * 0.8)
    # (each ring its own width: the ring count drawn through a slow uneven step)
    f = np.mod(ring + 0.32 * np.sin(ring * 1.9 + 1.3) + 0.16 * np.sin(ring * 0.7), 1.0)
    late = smooth(0.74, 0.88, f) * (1 - smooth(0.96, 1.0, f))
    col = mix(base, base * np.float32(0.76), late * (0.5 + 0.3 * fbm(N, 6, 3, 3)))
    # (the finest grain: hairlines between the rings, broken)
    fine = np.sin(2 * math.pi * (ring * 6.0 + w2 * 2.0))
    col = mix(col, base * np.float32(0.82), smooth(0.86, 1.0, fine) * 0.22 * smooth(0.3, 0.7, fbm(N, 12, 6, 3)))
    # (open pores in short streaks along the grain)
    pores = smooth(0.82, 0.94, vnoise(N, 110, 9)) * smooth(0.4, 0.8, vnoise(N, 24, 6))
    col = mix(col, col * np.float32(0.58), pores * 0.5)
    # (oak's rays, the silver flake: short pale lenses across the grain, plainer on the quarter-sawn)
    rays = smooth(0.86 if straight else 0.9, 0.97, vnoise(N, 14 if straight else 22, 64)) * smooth(0.45, 0.85, fbm(N, 7, 7, 3))
    col = mix(col, col * np.float32(1.16), rays * (0.45 if straight else 0.25))
    # (the colour drifting along each board: warmer, cooler, a darker streak here and there)
    drift = fbm(N, 2, 3, 3)
    col = col * (0.9 + 0.18 * drift)[..., None]
    col = mix(col, col * np.float32(0.86) * np.array([1.04, 0.98, 0.92], np.float32), smooth(0.62, 0.8, fbm(N, 3, 8, 3)) * 0.4)
    # (and the glue line between the boards a hairline)
    edge = np.minimum(bu, 1 - bu)
    col = mix(col, (0.36, 0.22, 0.12), smooth(0.004, 0.0, edge) * 0.7)
    return np.clip(col, 0, 1)


def cloth(kind="blue", N=512):
    """the cushion's cover: a fine plain weave, a little uneven, a pattern pressed into it (押し模様), tone on tone, after the owner's
    reference patterns: the blue with waves (青海波: rows of nested arcs, each lower row in front), the red with interlocking circles (七宝);
    lit from above, the pressed lines catch the light along their tops and shade along their feet"""
    seed(5 if kind == "blue" else 9)
    u, v = grid01(N)
    weave = ((np.sin(u * math.pi * 2 * 150) * np.sin(v * math.pi * 2 * 150)) > 0).astype(np.float32)
    dark, light = ((0.09, 0.15, 0.31), (0.14, 0.21, 0.4)) if kind == "blue" else ((0.36, 0.04, 0.07), (0.5, 0.07, 0.11))
    col = mix(dark, light, weave * 0.42 + fbm(N, 30, 30, 2) * 0.33)
    h = np.zeros_like(u)
    if kind == "blue":
        R, rows = 0.075, 16
        for j in range(rows, -2, -1):
            cy = j * R * 0.62
            for i in range(-1, int(1 / (2 * R)) + 3):
                cx = i * 2 * R + (j % 2) * R
                d = np.hypot(u - cx, v - cy)
                inside = (d < R) & (v >= cy)
                lines = np.zeros_like(u)
                for k in (1.0, 0.72, 0.46, 0.22):
                    lines = np.maximum(lines, smooth(0.008, 0.002, np.abs(d - R * k)))
                h = np.where(inside, lines, h)
    else:
        r = 0.07
        lines = np.zeros_like(u)
        for i in range(-1, int(1 / r) + 2):
            for j in range(-1, int(1 / r) + 2):
                d = np.hypot(u - i * r, v - j * r)
                lines = np.maximum(lines, smooth(0.007, 0.0018, np.abs(d - r * 0.7071)))
        h = lines
    # (pressed: the raised lines a shade lighter, a highlight along their tops and a shadow along their feet)
    up = np.roll(h, 1, axis=0)
    down = np.roll(h, -1, axis=0)
    col = col * (1 + 0.1 * h + 0.22 * (h - up) - 0.14 * (h - down))[..., None]
    return np.clip(col, 0, 1)


# =====================================================================
# Meshes, each with its own UVs
# =====================================================================
def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def lathe(name, prof, segs, uv="flat", y0=0.0):
    """a turned piece: the profile [(radius, height)] swept round the upright; its UVs laid flat from above (`flat`, as a board's top
    is) or round it and up it (`round`)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) for j in range(segs)] for (r, y) in prof]
    acc = [0.0]
    for i in range(len(prof) - 1):
        acc.append(acc[-1] + math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]))

    def uv_of(i, j):
        r, y = prof[i]
        a = 2 * math.pi * j / segs
        if uv == "flat":
            return (r * math.cos(a) / TILE + 0.5, r * math.sin(a) / TILE + 0.5)
        return (j / segs, acc[i] / TILE)
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = j + 1
            vs = (rings[i][j], rings[i][j2 % segs], rings[i + 1][j2 % segs], rings[i + 1][j])
            if len(set(vs)) < 4:
                continue
            f = bm.faces.new(vs)
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j2), (i + 1, j2), (i + 1, j))):
                lp[uvl].uv = uv_of(ii, jj)
    # (a flat end where the profile stops short of the middle)
    for k, top in ((0, False), (len(prof) - 1, True)):
        if prof[k][0] > 1e-4:
            f = bm.faces.new(rings[k] if top else list(reversed(rings[k])))
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl].uv = (co.x / TILE + 0.5, -co.y / TILE + 0.5)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def leg(name, top, foot, r0, r1, segs=14, rings=5):
    """a round leg from `top` to `foot` (the game's frame), r0 thick at the top and r1 at the foot, its foot rounded off; the grain
    (the picture's v) running down it"""
    a, b = P(*top), P(*foot)
    d = (b - a)
    L = d.length
    z = d.normalized()
    x = z.cross(Vector((0, 0, 1)))
    if x.length < 1e-6:
        x = Vector((1, 0, 0))
    x.normalize()
    y = z.cross(x)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    circ = 2 * math.pi * (r0 + r1) / 2
    # (the shaft, then the foot's dome in three steps down to its tip)
    steps = [(t / rings, r0 + (r1 - r0) * t / rings) for t in range(rings + 1)]
    for k in range(1, 4):
        ang = k / 3 * math.pi / 2
        steps.append((1 + r1 * math.sin(ang) * 0.75 / L, r1 * math.cos(ang)))
    loops = []
    for (t, r) in steps:
        c = a + d * t
        loops.append([bm.verts.new(c + (x * math.cos(2 * math.pi * j / segs) + y * math.sin(2 * math.pi * j / segs)) * max(r, 1e-4)) for j in range(segs)])
    for i in range(len(loops) - 1):
        for j in range(segs):
            vs = (loops[i][j], loops[i][(j + 1) % segs], loops[i + 1][(j + 1) % segs], loops[i + 1][j])
            f = bm.faces.new(vs)
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (jj / segs * circ / TILE, steps[ii][0] * L / TILE)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def ring(name, y, R, r, segs=28, tube=8):
    """a bent ring of round wood, level at height y, R round and r thick; its grain running round it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    grid = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        c, rad = P(R * math.cos(a), y, R * math.sin(a)), Vector((math.cos(a), -math.sin(a), 0))
        grid.append([bm.verts.new(c + rad * (r * math.cos(2 * math.pi * k / tube)) + Vector((0, 0, r * math.sin(2 * math.pi * k / tube)))) for k in range(tube)])
    for i in range(segs):
        for k in range(tube):
            vs = (grid[i][k], grid[(i + 1) % segs][k], grid[(i + 1) % segs][(k + 1) % tube], grid[i][(k + 1) % tube])
            f = bm.faces.new(vs)
            for lp, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                lp[uvl].uv = (kk / tube * 2 * math.pi * r / TILE, ii / segs * 2 * math.pi * R / TILE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def fin(o, mat, parts):
    o.data.materials.clear()
    o.data.materials.append(mat)
    parts.append(o)
    return o


# =====================================================================
# A stool
# =====================================================================
def stool(name, M, seat_top=0.29, R=0.128, rings_at=(0.1,), splay=0.05):
    """one stool, its root `name`: the seat's top `seat_top` from the floor, R round; the legs splayed `splay` further out at the floor;
    a ring between them at each height in `rings_at`"""
    parts = []
    th = 0.05
    s0 = seat_top - th
    # (the seat: a bun of oak, its top a touch domed, its edge rolled round, its underside chamfered in)
    # (its ends a small ring closed in a ladder, not drawn into one point: the owner's low-poly rule)
    prof = [(R * 0.12, seat_top + 0.004), (R * 0.55, seat_top + 0.003), (R - 0.022, seat_top), (R - 0.007, seat_top - 0.006), (R, seat_top - 0.018),
            (R - 0.002, s0 + 0.016), (R - 0.012, s0 + 0.003), (R - 0.03, s0), (R * 0.12, s0)]
    fin(lathe(f"{name}Seat", list(reversed(prof)), 24, "flat"), M["oak"], parts)
    # (the cushion: plump, domed, its middle drawn down by the button; piped round its rim)
    top = seat_top + 0.002
    cr = R - 0.02
    cp = [(cr * 0.08, top + 0.03)]
    for i in range(1, 9):
        t = i / 8
        h = 0.046 * math.sqrt(max(0.0, 1 - t ** 3)) - 0.011 * math.exp(-(t / 0.16) ** 2)
        cp.append((cr * t, top + max(0.004, h)))
    cp.append((cr + 0.004, top + 0.006))
    cp.append((cr, top))
    # (two cushions, blue and red (the owner's): the game keeps one on each stool; no piping round the rim, its button covered in the cloth)
    for tag, mat in (("", "cloth"), ("Red", "clothRed")):
        cush = lathe(f"{name}Cushion{tag}", list(reversed(cp)), 24, "flat")
        fin(cush, M[mat], parts)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.008, subdivisions=1, location=P(0, top + 0.033, 0))
        b = bpy.context.view_layer.objects.active
        b.name = f"{name}Button{tag}"
        b.scale = (1, 1, 0.5)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        fin(b, M["button" if not tag else "buttonRed"], parts)
    # (the legs: stout, splayed, tapering a little to a rounded foot)
    r_top, r_foot = R * 0.58, R * 0.58 + splay
    legs = []
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        t_ = (math.cos(a) * r_top, s0 + 0.004, math.sin(a) * r_top)
        f_ = (math.cos(a) * r_foot, 0.018, math.sin(a) * r_foot)
        legs.append((t_, f_))
        fin(leg(f"{name}Leg{k}", t_, f_, 0.026, 0.021), M["oakl"], parts)
    # (each ring through the legs where they are at its height)
    for n, y in enumerate(rings_at):
        t = (s0 - y) / (s0 - 0.018)
        fin(ring(f"{name}Ring{n}", y, r_top + (r_foot - r_top) * t, 0.011), M["oakl"], parts)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    return root, parts


def materials():
    return {"oak": pbr("StoolOak", (1, 1, 1), tex=image("stooloak", oak()), rough=0.5, coat=0.25),
            "oakl": pbr("StoolOakLeg", (1, 1, 1), tex=image("stooloakleg", oak(straight=True)), rough=0.5, coat=0.25),
            "cloth": pbr("StoolCloth", (1, 1, 1), tex=image("stoolcloth", cloth("blue")), rough=0.9),
            "clothRed": pbr("StoolClothRed", (1, 1, 1), tex=image("stoolclothred", cloth("red")), rough=0.9),
            "button": pbr("StoolButton", lin("#1c2a4e"), rough=0.8),
            "buttonRed": pbr("StoolButtonRed", lin("#6a1018"), rough=0.8)}


def preview_rig(at_y, dist):
    """a camera a little above, three-quarters on, and a warm key light with a cool fill, for the preview picture"""
    target = P(0, at_y, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(dist * 0.62, at_y + dist * 0.42, dist * 0.62)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for name, loc, energy, col in (("Key", P(1.5, 2.5, 1.0), 6.0, (1.0, 0.94, 0.86)), ("Fill", P(-1.5, 1.2, -0.6), 2.5, (0.85, 0.9, 1.0))):
        lt = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        lt.data.energy = energy
        lt.data.color = col
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.35, 0.35, 0.38)
    bpy.context.scene.world = world


def tris(parts):
    return sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons)


# ---- the customers' stool
bpy.ops.wm.read_factory_settings(use_empty=True)
M = materials()
root, parts = stool("Stool", M)
if PREVIEW:
    preview_rig(0.18, 1.0)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "stool.glb"), os.path.join(PROJECT, "blender", "stool.blend"), PREVIEW)
print("STOOL_DONE", tris(parts))
