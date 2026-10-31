"""The till's own two seats (帳場の椅子), made to go with its walnut partition rather than the customers' round oak stools:

- "TillStoolHigh": the cashier's chair, 44 cm to its seat. A square seat with rounded corners: a frame of walnut round a seat of woven
  rush (い草), wrapped the old way, its strands running along each rail and meeting in an X at the corners' diagonals, a little domed;
  four square legs tapering to small brass shoes, splayed a touch; a footrest across the front faced in brass, rails at the sides and the
  back; the back legs run on up as two posts, raked back, a crest rail bent round the sitter between them, and under it a small panel of
  kumiko (角麻の葉: a square grid, each square crossed) in pale hinoki in a walnut frame.
- "TillStoolLow": a helper's stool of the same make, 34 cm, with no back.

Both face -z (a sitter on the high one faces -z, its back at +z). Every piece carries its own UVs: the walnut's grain runs along each
piece, the rush's picture is laid once over the whole seat. Low in triangles: square sections, a bevel or two, 8 round the brass.

Run:
    blender -b --factory-startup --python blender/tillstools.py -- <project path> [preview.png]
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
# (how much wood one repeat of the walnut's picture covers, along the grain and across it)
TILE = 0.3


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# =====================================================================
# The pictures
# =====================================================================
def walnut(N=512, flat=False):
    """black walnut: a deep chocolate brown with a cool grey cast, its grain in long fine lines along v (quarter-sawn, as the legs, rails
    and posts are), or `flat`: flat-sawn, the late wood in long soft arches (the seat's frame, the crest rail); open pores in streaks,
    lighter and darker runs down the board"""
    seed(41 if flat else 43)
    u, v = grid01(N)
    base = np.array((0.36, 0.235, 0.16), np.float32)
    wob = fbm(N, 3, 2, 4) - 0.5
    if flat:
        centre = 0.5 + 0.12 * np.sin(2 * math.pi * v) + wob * 0.1
        ring = ((u - centre) * 2.0) ** 2 * 3.0 + 0.2 * np.sin(2 * math.pi * (v * 2 + 0.3)) + wob * 0.3
    else:
        ring = u * 9.0 + 0.1 * np.sin(2 * math.pi * v) + wob * 0.3
    late = smooth(0.55, 0.98, np.sin(2 * math.pi * ring * 2.2))
    col = mix(base, base * np.float32(0.62), late * 0.7)
    # (fine lines between, the grain running nearly along)
    fine = np.sin(2 * math.pi * (u * 46 + wob * 4 + fbm(N, 6, 2, 3) * 1.4))
    col = mix(col, base * np.float32(0.75), smooth(0.75, 1.0, fine) * 0.35)
    # (the pores, short dark streaks along the grain)
    pores = smooth(0.82, 0.95, vnoise(N, 110, 8)) * smooth(0.3, 0.8, vnoise(N, 24, 5))
    col = mix(col, col * np.float32(0.55), pores * 0.6)
    # (a purple-grey cast in places, and the long runs of lighter and darker)
    cast = fbm(N, 4, 2, 3)
    col = mix(col, col * np.array((0.92, 0.9, 1.02), np.float32), cast * 0.5)
    col = col * (0.88 + 0.22 * fbm(N, 8, 2, 3))[..., None]
    return col


def rush(N=512):
    """the woven rush seat, seen from above over the whole seat (u across, v front to back): wrapped round each corner in turn, so each
    quarter's strands run along its own rail, meeting the next quarter's in a seam down each diagonal; each strand a twisted rope of rush,
    straw green to gold, rounded (lit along its middle, dark in the grooves between), a few a shade off"""
    seed(17)
    u, v = grid01(N)
    du, dv = u - 0.5, v - 0.5
    fb = np.abs(dv) >= np.abs(du)                 # (the front and back quarters: strands run across, along u)
    # (how far in from its rail, across the strands; and how far along them)
    inward = np.where(fb, 0.5 - np.abs(dv), 0.5 - np.abs(du))
    along = np.where(fb, u, v)
    k = 26                                         # (strands from a rail to the middle)
    s = inward * 2 * k
    idx = np.floor(s)
    f = s - idx
    # (each strand's own tint, by its index and quarter)
    q = np.where(fb, np.where(dv > 0, 0, 1), np.where(du > 0, 2, 3))
    h = np.sin(idx * 12.9898 + q * 78.233) * 43758.5453
    r = h - np.floor(h)
    straw = np.array((0.66, 0.62, 0.38), np.float32)
    gold = np.array((0.74, 0.62, 0.34), np.float32)
    green = np.array((0.56, 0.58, 0.34), np.float32)
    tint = mix(mix(straw, gold, smooth(0.5, 1.0, r)), green, smooth(0.5, 0.0, r) * 0.7)
    # (the twist: the strand's lay running across it on a slant)
    twist = 0.5 + 0.5 * np.sin(2 * math.pi * (along * 2 * k * 0.9 + f * 1.0 + idx * 0.37))
    roundness = np.sin(np.pi * f)                  # (0 in the grooves, 1 along the middle)
    shade = 0.55 + 0.45 * roundness ** 0.6
    col = tint * (shade * (0.9 + 0.12 * twist))[..., None]
    # (the dark grooves between strands, and the seams down the diagonals where they turn)
    col = mix(col, (0.2, 0.17, 0.08), smooth(0.25, 0.0, roundness) * 0.55)
    seam = np.abs(np.abs(du) - np.abs(dv))
    col = mix(col, (0.24, 0.2, 0.1), smooth(0.012, 0.0, seam) * 0.75)
    # (a soft unevenness over it all, and the middle a touch worn and paler where it's sat on)
    col = col * (0.92 + 0.14 * fbm(N, 6, 6, 3))[..., None]
    worn = np.exp(-((du / 0.22) ** 2 + (dv / 0.2) ** 2))
    col = mix(col, col * np.float32(1.12), worn * 0.4)
    return col


def hinoki(N=256):
    """the kumiko's pale hinoki: a warm cream, the faintest straight grain"""
    seed(7)
    u, v = grid01(N)
    base = np.array((0.88, 0.78, 0.6), np.float32)
    lines = np.sin(2 * math.pi * (u * 30 + fbm(N, 4, 2, 3) * 0.8))
    col = mix(base, base * np.float32(0.86), smooth(0.7, 1.0, lines) * 0.4)
    return col * (0.95 + 0.08 * fbm(N, 6, 2, 3))[..., None]


# =====================================================================
# Meshes, each with its own UVs
# =====================================================================
def mesh_obj(name, bm, smooth_shade=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth_shade
    return o


def beam(name, a, b, w, d, up=(0, 1, 0), wb=None, db=None, bevel=0.0, segs=1):
    """a square-sectioned piece of wood from `a` to `b` (the game's frame), `w` wide and `d` deep at `a` (`wb`, `db` at `b`: tapered),
    its width lying along the `up` side of it; its grain (the picture's v) running along it; its long edges rounded `bevel`"""
    A, B = P(*a), P(*b)
    z = (B - A)
    L = z.length
    z.normalize()
    upv = P(*up)
    x = upv.cross(z)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)).cross(z)
    x.normalize()
    y = z.cross(x)
    wb = w if wb is None else wb
    db = d if db is None else db
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ends = []
    for (c, ww, dd) in ((A, w, d), (B, wb, db)):
        ends.append([bm.verts.new(c + x * (sx * ww / 2) + y * (sy * dd / 2)) for (sx, sy) in corners])
    per = [w, d, w, d]
    acc = 0.0
    for k in range(4):
        k2 = (k + 1) % 4
        f = bm.faces.new((ends[0][k], ends[0][k2], ends[1][k2], ends[1][k]))
        for lp, (uu, vv) in zip(f.loops, ((acc, 0), (acc + per[k], 0), (acc + per[k], L), (acc, L))):
            lp[uvl].uv = (uu / TILE * 3, vv / TILE)
        acc += per[k]
    for e, rev in ((0, True), (1, False)):
        f = bm.faces.new(list(reversed(ends[e])) if rev else ends[e])
        for lp, (sx, sy) in zip(f.loops, corners if not rev else list(reversed(corners))):
            lp[uvl].uv = (0.5 + sx * 0.02, 0.5 + sy * 0.02)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        long_edges = [e for e in bm.edges if (e.verts[0] in ends[0]) != (e.verts[1] in ends[0])]
        bmesh.ops.bevel(bm, geom=long_edges, offset=bevel, segments=segs, profile=0.5, affect="EDGES")
    o = mesh_obj(name, bm, smooth_shade=bevel > 0)
    return o


def sweep(name, pts, w, d, bevel=0.0, segs=1):
    """a piece bent along `pts` (the game's frame), w across (level) and d tall, its grain along it; its edges rounded `bevel`"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    V = [P(*p) for p in pts]
    up = Vector((0, 0, 1))
    loops, run = [], [0.0]
    for i, c in enumerate(V):
        t = (V[min(i + 1, len(V) - 1)] - V[max(i - 1, 0)]).normalized()
        x = t.cross(up).normalized()
        loops.append([bm.verts.new(c + x * (sx * w / 2) + up * (sy * d / 2)) for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        if i:
            run.append(run[-1] + (V[i] - V[i - 1]).length)
    per = [w, d, w, d]
    for i in range(len(V) - 1):
        acc = 0.0
        for k in range(4):
            k2 = (k + 1) % 4
            f = bm.faces.new((loops[i][k], loops[i][k2], loops[i + 1][k2], loops[i + 1][k]))
            for lp, (uu, vv) in zip(f.loops, ((acc, run[i]), (acc + per[k], run[i]), (acc + per[k], run[i + 1]), (acc, run[i + 1]))):
                lp[uvl].uv = (uu / TILE * 3, vv / TILE)
            acc += per[k]
    for e in (0, len(V) - 1):
        f = bm.faces.new(loops[e] if e else list(reversed(loops[e])))
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        # (only the edges running along it: those whose two ends sit in neighbouring loops at the same corner)
        idx = {v: (i, k) for i, lp in enumerate(loops) for k, v in enumerate(lp)}
        long_edges = [e for e in bm.edges if idx[e.verts[0]][1] == idx[e.verts[1]][1] and idx[e.verts[0]][0] != idx[e.verts[1]][0]]
        bmesh.ops.bevel(bm, geom=long_edges, offset=bevel, segments=segs, profile=0.5, affect="EDGES")
    return mesh_obj(name, bm, smooth_shade=bevel > 0)


def seat_panel(name, cx, cz, W, D, y, dome, n=8):
    """the woven seat: a grid over W x D at height y, domed `dome` in the middle; its UVs the whole seat once (u across, v back to front)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            u, v = i / n, j / n
            h = dome * math.sin(math.pi * u) * math.sin(math.pi * v)
            row.append(bm.verts.new(P(cx + (u - 0.5) * W, y + h, cz + (v - 0.5) * D)))
        vs.append(row)
    # (wound to face up: the game's +z is Blender's -y)
    for j in range(n):
        for i in range(n):
            f = bm.faces.new((vs[j][i], vs[j + 1][i], vs[j + 1][i + 1], vs[j][i + 1]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (ii / n, 1 - jj / n)
    return mesh_obj(name, bm, smooth_shade=True)


def shoe(name, at, r, h, segs=8):
    """a brass shoe on a leg's foot: a short square-ish cap (an 8-sided cylinder, turned 22.5 degrees)"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=h, location=P(at[0], at[1] + h / 2, at[2]))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.rotation_euler = (0, 0, math.pi / segs)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def fin(o, mat, parts):
    o.data.materials.clear()
    o.data.materials.append(mat)
    parts.append(o)
    return o


# =====================================================================
# The chair and the stool
# =====================================================================
def seat_and_legs(name, M, parts, H, W, D, splay, rails):
    """the seat (a walnut frame round the woven rush) at height H, W x D, and the four legs under it, splayed `splay` at the floor, with
    their brass shoes; rails between them at the heights in `rails` (front, sides, back), the front one the footrest, its top faced in brass.
    Returns the back legs' tops (for the back's posts)"""
    th, fw = 0.032, 0.03
    y0 = H - th
    # (the frame: four rails, flat-sawn walnut, mitred by overlapping at the rounded corners)
    for k, (a, b) in enumerate((((-W / 2 + fw / 2, -D / 2 + fw / 2), (W / 2 - fw / 2, -D / 2 + fw / 2)),
                                 ((W / 2 - fw / 2, -D / 2 + fw / 2), (W / 2 - fw / 2, D / 2 - fw / 2)),
                                 ((W / 2 - fw / 2, D / 2 - fw / 2), (-W / 2 + fw / 2, D / 2 - fw / 2)),
                                 ((-W / 2 + fw / 2, D / 2 - fw / 2), (-W / 2 + fw / 2, -D / 2 + fw / 2)))):
        ext = fw / 2
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz)
        ux, uz = dx / L, dz / L
        fin(beam(f"{name}Frame{k}", (a[0] - ux * ext, y0 + th / 2, a[1] - uz * ext), (b[0] + ux * ext, y0 + th / 2, b[1] + uz * ext), fw, th,
                 up=(0, 1, 0), bevel=0.007, segs=2), M["walnutf"], parts)
    # (the rush, set in the frame, domed up a little above it)
    fin(seat_panel(f"{name}Rush", 0, 0, W - fw * 1.4, D - fw * 1.4, H - 0.004, 0.014), M["rush"], parts)
    # (the legs: square, tapering, splayed a touch outward at the floor)
    tops = []
    for k, (sx, sz) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        t_ = (sx * (W / 2 - 0.028), y0, sz * (D / 2 - 0.028))
        f_ = (sx * (W / 2 - 0.028 + splay), 0.022, sz * (D / 2 - 0.028 + splay))
        tops.append(t_)
        fin(beam(f"{name}Leg{k}", t_, f_, 0.034, 0.034, up=(0, 0, 1) if abs(sz) else (1, 0, 0), wb=0.026, db=0.026, bevel=0.005, segs=1),
            M["walnut"], parts)
        fin(shoe(f"{name}Shoe{k}", (f_[0], 0, f_[2]), 0.018, 0.024), M["brass"], parts)
    # (the rails between the legs, where the legs are at each height)
    def leg_at(k, y):
        tx, ty, tz = tops[k]
        fx, fz = tx + (splay if tx > 0 else -splay), tz + (splay if tz > 0 else -splay)
        t = (y0 - y) / (y0 - 0.022)
        return (tx + (fx - tx) * t, y, tz + (fz - tz) * t)
    yf, ys, yb = rails
    for nm, (k1, k2), y, w_, d_ in (("Foot", (0, 1), yf, 0.026, 0.03), ("SideL", (0, 3), ys, 0.02, 0.022), ("SideR", (1, 2), ys, 0.02, 0.022),
                                  ("Back", (3, 2), yb, 0.02, 0.022)):
        a, b = leg_at(k1, y), leg_at(k2, y)
        fin(beam(f"{name}Rail{nm}", a, b, w_, d_, up=(0, 1, 0), bevel=0.004, segs=1), M["walnut"], parts)
        if nm == "Foot":
            # (its top faced in brass, where the heels rest)
            fin(beam(f"{name}FootBrass", (a[0], y + d_ / 2 + 0.002, a[2]), (b[0], y + d_ / 2 + 0.002, b[2]), w_ + 0.004, 0.004), M["brass"], parts)
    return tops


def chair(name, M, H=0.44, W=0.32, D=0.3):
    parts = []
    tops = seat_and_legs(name, M, parts, H, W, D, splay=0.022, rails=(0.15, 0.22, 0.22))
    # (the back: the back legs run on up as posts, raked back; a crest rail bent round the sitter; a panel of kumiko under it)
    rake, top_y = 0.045, H + 0.24
    posts = []
    for k, side in ((3, -1), (2, 1)):
        tx, ty, tz = tops[k]
        a = (tx, ty, tz)
        b = (tx, top_y, tz + rake)
        posts.append((a, b))
        fin(beam(f"{name}Post{k}", a, b, 0.03, 0.03, up=(0, 0, 1), wb=0.026, db=0.026, bevel=0.005), M["walnut"], parts)
    (l0, l1), (r0, r1) = posts
    # (the crest rail: across the posts' tops, bowed back away from the sitter, a little past each post)
    n = 9
    pts = []
    for i in range(n + 1):
        t = i / n
        x = l1[0] - 0.018 + (r1[0] - l1[0] + 0.036) * t
        z = l1[2] + 0.028 * math.sin(math.pi * t)
        pts.append((x, top_y - 0.03, z))
    fin(sweep(f"{name}Crest", pts, 0.026, 0.06, bevel=0.008, segs=2), M["walnutf"], parts)
    # (the kumiko panel between the posts, under the crest rail: a walnut frame, and in it a grid of squares in pale hinoki, each crossed)
    def post_at(p, y):
        (ax, ay, az), (bx, by, bz) = p
        t = (y - ay) / (by - ay)
        return (ax + (bx - ax) * t, y, az + (bz - az) * t)
    py0, py1 = H + 0.05, top_y - 0.07
    xl, xr = post_at(posts[0], py0)[0] + 0.015, post_at(posts[1], py0)[0] - 0.015

    def zat(y):
        return post_at(posts[0], y)[2]
    for nm, y in (("Bottom", py0 - 0.008), ("Top", py1 + 0.008)):
        fin(beam(f"{name}Panel{nm}", (xl, y, zat(y)), (xr, y, zat(y)), 0.018, 0.016, up=(0, 1, 0), bevel=0.003), M["walnut"], parts)
    cols, rows = 4, 2
    cw, ch = (xr - xl) / cols, (py1 - py0) / rows
    bars = []
    for i in range(1, cols):
        x = xl + i * cw
        bars.append(((x, py0, zat(py0)), (x, py1, zat(py1))))
    for j in range(1, rows):
        y = py0 + j * ch
        bars.append(((xl, y, zat(y)), (xr, y, zat(y))))
    for i in range(cols):
        for j in range(rows):
            xa, xb = xl + i * cw, xl + (i + 1) * cw
            ya, yb = py0 + j * ch, py0 + (j + 1) * ch
            bars.append(((xa, ya, zat(ya)), (xb, yb, zat(yb))))
            bars.append(((xb, ya, zat(ya)), (xa, yb, zat(yb))))
    for k, (a, b) in enumerate(bars):
        fin(beam(f"{name}Kumiko{k}", a, b, 0.006, 0.012, up=(0, 0, 1)), M["hinoki"], parts)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    return root, parts


def stool(name, M, H=0.34, W=0.29, D=0.27):
    parts = []
    seat_and_legs(name, M, parts, H, W, D, splay=0.02, rails=(0.11, 0.17, 0.17))
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    return root, parts


def materials():
    return {"walnut": pbr("TillWalnut", (1, 1, 1), tex=image("tillwalnut", walnut()), rough=0.45, coat=0.3),
            "walnutf": pbr("TillWalnutFlat", (1, 1, 1), tex=image("tillwalnutflat", walnut(flat=True)), rough=0.45, coat=0.3),
            "rush": pbr("TillRush", (1, 1, 1), tex=image("tillrush", rush()), rough=0.85),
            "hinoki": pbr("TillHinoki", (1, 1, 1), tex=image("tillhinoki", hinoki()), rough=0.6),
            "brass": pbr("StoolBrass", (0.78, 0.6, 0.3), rough=0.3, metal=1.0)}


def preview_rig(at_y, dist):
    target = P(0.25, at_y, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.25 - dist * 0.55, at_y + dist * 0.45, -dist * 0.7)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for name, loc, energy, col in (("Key", P(-1.5, 2.5, -1.0), 6.0, (1.0, 0.94, 0.86)), ("Fill", P(1.5, 1.2, 0.6), 2.5, (0.85, 0.9, 1.0))):
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


bpy.ops.wm.read_factory_settings(use_empty=True)
M = materials()
hi, hp = chair("TillStoolHigh", M)
lo, lp = stool("TillStoolLow", M)
lo.location = P(0.5, 0, 0)
till = bpy.data.objects.new("TillStools", None)
bpy.context.collection.objects.link(till)
hi.parent = till
lo.parent = till
if PREVIEW:
    preview_rig(0.36, 1.6)
export_dish(till, hp + lp + [hi, lo, till], os.path.join(PROJECT, "public", "models", "tillstool.glb"), os.path.join(PROJECT, "blender", "tillstool.blend"), PREVIEW)
print("TILLSTOOL_DONE", tris(hp), tris(lp))
