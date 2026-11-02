"""What's laid at each place along the bar, at its true size (a bar unit is about a metre: the customers' plates are 26 cm across):

- "BarSoyDish": a little soy dish (醤油皿) of porcelain, 9 cm across, shallow, on a low foot ring, its rim turned up a touch; its picture laid
  flat from above, as the plates' are (the game gives each place one of the plates' designs).
- "BarChopstick": one of a pair of lacquered chopsticks (塗り箸), 22 cm, square at the top tapering to a fine rounded tip: black lacquer over
  the top third with a thin gold band, a deep red-brown below.
- "BarHashioki": a chopstick rest (箸置き) of indigo-glazed porcelain, 4.5 cm, a little pillow drawn in at its waist.
- "BarTissue": a box of tissues in a walnut case, 24 x 12 cm and 7.5 high, its edges rounded, a slot along its top and a tissue puffed up out
  of it.
- "BarDrawerCase", "BarDrawer", "BarTissueLow": each place's drawer under the top on the customers' side (the owner's: a box of tissues to
  each place, in its own drawer): a walnut case open at the front hanging under the top, 17 cm across (the owner's: half what it was), 12.5
  deep (down) and 26 back; the drawer that runs in it, its front a little proud, a brass bar pull; and the box of tissues that lives in it,
  a compact one lying lengthways in the drawer, its tissue only just pulled up (a full puff would be squashed under the top), and the next
  tissue as it's left once one's been pulled, standing up out of the slot ("BarTissueLowPop": the game shows it once the box has been
  used, the flat one before; the owner's: a box that's been pulled from shows it). The case's and
  the drawer's origin is the middle of the case's front edge along its top (the top's underside): the case runs back into +z and down, the
  drawer slides out toward -z.
- "BarTissuePull": a tissue as it's pulled out of the box: a soft sheet hanging from where it's held (its top edge at the origin).
- "BarWalnutSwatch0".."3": four little hidden squares, each in one of the walnut's four boards (BarWalnut0..3: chocolate cathedral figure, a
  darker straight-grained one, a warmer one with a pale streak of sapwood, a cooler wavy one), for the game to give each place's drawer
  its own.
- "BarCondiments": what each two places share at the back between them: a soy-sauce pot (醤油差し: white porcelain, an indigo band of waves,
  a little spout and a lidded top with a knob) and a pot of wasabi (山葵: a lidded celadon jar, a wooden spoon from under its lid), on a
  little black-lacquered tray.

Each piece stands at its own origin (on y = 0, its middle over the origin; the chopstick and the rest lie along x). Low in triangles.

Run:
    blender -b --factory-startup --python blender/barsetting.py -- <project path> [preview.png]
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


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# =====================================================================
# The pictures
# =====================================================================
def sometsuke(N=256):
    """the soy dish's default picture (the game gives each place a plate's design instead): white glaze, a cobalt ring inside the rim and a
    little fish in the well"""
    u, v = grid01(N)
    x, y = (u - 0.5) * 2, (v - 0.5) * 2
    r = np.sqrt(x * x + y * y)
    col = np.broadcast_to(np.array((0.95, 0.95, 0.93), np.float32), (N, N, 3)).copy()
    blue = np.array((0.16, 0.24, 0.55), np.float32)
    ring = smooth(0.035, 0.0, np.abs(r - 0.78)) + smooth(0.02, 0.0, np.abs(r - 0.7)) * 0.7
    fish = smooth(0.06, 0.0, np.abs(((x + 0.05) / 0.32) ** 2 + (y / 0.15) ** 2 - 1)) + smooth(0.05, 0.0, np.abs(x - 0.32) + np.abs(y) * 1.6 - 0.12) * (x > 0.25)
    m = np.clip(ring + fish, 0, 1)
    return mix(col, blue, m * 0.9)


def lacquer(W=32, H=256):
    """the chopstick's lacquer along it (v from its top to its tip): black over the top third, a fine gold band, then a deep red-brown"""
    v = (np.arange(H, dtype=np.float32) + 0.5) / H
    col = np.zeros((H, W, 3), np.float32)
    black = np.array((0.07, 0.05, 0.045), np.float32)
    red = np.array((0.36, 0.12, 0.08), np.float32)
    gold = np.array((0.78, 0.6, 0.28), np.float32)
    for j in range(H):
        t = v[j]
        c = black if t < 0.33 else red
        if 0.33 <= t < 0.345 or 0.355 <= t < 0.362:
            c = gold
        col[j, :, :] = c
    # (a faint sheen streak along it)
    col *= (0.92 + 0.12 * np.sin(np.linspace(0, math.pi, W, dtype=np.float32)))[None, :, None]
    return col


WALNUTS = (
    # (its two browns (the board's streaks wander between them); how far the pith was below the face (0: quartered, straight stripes), how
    # much the log tapered (how tall the arches), how many rings across, how much darker the late wood, a pale streak of sapwood, a dark
    # mineral streak)
    # (a lighter walnut than it was, oiled, warm (the owner's: a little brighter): its browns a quarter or so up on what they were)
    dict(base=(0.5, 0.335, 0.215), alt=(0.43, 0.29, 0.2), d=0.14, taper=0.24, rings=34, late=0.3, sap=0.0, streak=0.0),
    dict(base=(0.42, 0.28, 0.185), alt=(0.37, 0.25, 0.18), d=0.0, taper=0.0, rings=44, late=0.28, sap=0.0, streak=0.0),
    dict(base=(0.53, 0.36, 0.225), alt=(0.47, 0.32, 0.21), d=0.09, taper=0.3, rings=28, late=0.28, sap=1.0, streak=0.0),
    dict(base=(0.47, 0.32, 0.215), alt=(0.41, 0.28, 0.205), d=0.2, taper=0.17, rings=38, late=0.27, sap=0.0, streak=1.0),
)


def walnut(variant=0, N=512):
    """a board of walnut, its grain along u, drawn as the wood is: the growth rings where the face cuts them, long narrow arches up the
    board where it's flat-sawn (the log's taper: each arch's peak toward +u), straight stripes where it's quartered; each ring's late wood
    a little darker, soft-edged, the rings' spacing uneven; the colour drifting in long streaks along the grain between two browns; the
    open pores as fine dark flecks drawn out along it, and a silky sheen of fibre; in one a pale streak of sapwood along an edge, in
    another a dark mineral streak"""
    w = WALNUTS[variant]
    seed(31 + variant * 7)
    u, v = grid01(N)
    wob = fbm(N, 2, 3, 4) - 0.5
    # (the grain wandering as a tree's does: long slow bends along the board, and finer ripples on them)
    bend = (fbm(N, 1, 3, 4) - 0.5) * 0.09 + (fbm(N, 3, 9, 3) - 0.5) * 0.018
    vv = v + bend
    # (the rings: the distance from the pith, the pith wandering a little under the board, less the taper along it)
    vc = 0.5 + 0.16 * np.sin(2 * math.pi * (u * 0.45 + 0.21 * variant)) + wob * 0.07
    if w["d"] > 0:
        ring = (np.sqrt((vv - vc) ** 2 + w["d"] ** 2) - w["taper"] * u) * w["rings"]
    else:
        ring = (vv + wob * 0.05 + 0.012 * np.sin(2 * math.pi * u)) * w["rings"]
    # (rings unevenly wide: good years and lean ones, a run of narrow ones here and there)
    ring = ring + (fbm(N, 2, 7, 3) - 0.5) * 1.6 + np.sin(ring * 0.37 + wob * 3) * 0.35
    ph = ring - np.floor(ring)
    # (each ring: the early wood pale and open, darkening through the year to a sharp edge where the next year starts)
    late = smooth(0.35, 0.9, ph) ** 1.6 * (1 - smooth(0.93, 1.0, ph))
    # (each ring's late wood its own depth: a hard year's darker)
    seed(41 + variant)
    late = late * (0.65 + 0.55 * vnoise(N, 2, 16))
    # (the colour drifting along the grain: long streaks across, between the board's two browns)
    seed(53 + variant)
    drift = smooth(0.25, 0.75, vnoise(N, 2, 9) * 0.65 + vnoise(N, 3, 23) * 0.35)
    col = mix(np.array(w["base"], np.float32), np.array(w["alt"], np.float32), drift)
    col = col * (1 - late * w["late"])[..., None]
    # (the pores: fine dark flecks, long along the grain, a few more in the late wood)
    seed(77 + variant)
    pore = vnoise(N, 12, 190) * vnoise(N, 40, 270)
    flecks = smooth(0.36, 0.56, pore) * (0.6 + 0.4 * late)
    col = col * (1 - flecks * 0.3)[..., None]
    # (and a silky sheen of fibre along it, with walnut's cool grey-violet in the darkest streaks)
    fibre = vnoise(N, 5, 310)
    col = col * (0.96 + 0.08 * fibre)[..., None]
    cool = np.array((0.3, 0.24, 0.24), np.float32)
    col = mix(col, cool, (late * (1 - drift) * 0.18).astype(np.float32))
    if w["sap"]:
        # (the sapwood: a creamy streak along one edge, its border soft and wandering)
        edge = 0.14 + 0.035 * np.sin(2 * math.pi * u * 1.3) + wob * 0.05
        sap = smooth(edge + 0.012, edge - 0.025, v)
        cream = np.array((0.64, 0.5, 0.36), np.float32) * (0.94 + 0.1 * fibre)[..., None]
        col = mix(col, cream * (1 - late * 0.12)[..., None], sap * 0.9)
    if w["streak"]:
        # (a dark mineral streak along the grain, fading in and out)
        line = smooth(0.03, 0.0, np.abs(v - (0.68 + 0.02 * np.sin(2 * math.pi * u)) - wob * 0.03)) * smooth(0.1, 0.4, u) * smooth(0.95, 0.7, u)
        col = col * (1 - line * 0.35)[..., None]
    return np.clip(col, 0, 1)


def glaze(N=64):
    """the rest's indigo glaze, a little paler where it pools thin"""
    seed(4)
    n = fbm(N, 4, 4, 3)
    return mix((0.13, 0.2, 0.42), (0.28, 0.38, 0.62), n * 0.6)


# =====================================================================
# Meshes
# =====================================================================
def mesh_obj(name, bm, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth_shade
    return o


def soy_dish(name, segs=24):
    """turned on the wheel: the profile (radius, height) from the middle of its underside out round the foot, up the outside, over the rim and
    back in across the well; its picture laid flat from above (u, v from x, z over its 9 cm)"""
    prof = [(0.023, 0.004), (0.025, 0.0), (0.0295, 0.0), (0.031, 0.004), (0.039, 0.0105), (0.0442, 0.0165), (0.0452, 0.0188),
            (0.0438, 0.0194), (0.0405, 0.0158), (0.031, 0.0092), (0.016, 0.0066)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) if r > 1e-6 else None
                      for j in range(segs)])
    centre = {}
    for i, (r, y) in enumerate(prof):
        if r <= 1e-6:
            centre[i] = bm.verts.new(P(0, y, 0))
    D = 0.09

    def uv_of(co):
        return (co.x / D + 0.5, -co.y / D + 0.5)
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            a = rings[i][j] or centre[i]
            b = rings[i][j2] or centre[i]
            c = rings[i + 1][j2] or centre[i + 1]
            d = rings[i + 1][j] or centre[i + 1]
            vs = [a, b, c, d]
            uniq = []
            for vv in vs:
                if vv not in uniq:
                    uniq.append(vv)
            if len(uniq) < 3:
                continue
            f = bm.faces.new(uniq)
            for lp in f.loops:
                lp[uvl].uv = uv_of(lp.vert.co)
    # (its underside's middle and its well's floor closed flat across the rings next to the axis, laddered on export: they were fans of
    # triangles into a point at the middle, 24 of them (the owner's low-poly rule))
    for ring in (rings[0], rings[-1]):
        if ring[0] is None:
            continue
        f = bm.faces.new(ring)
        for lp in f.loops:
            lp[uvl].uv = uv_of(lp.vert.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def chopstick(name, L=0.22, w0=0.0068, r1=0.0016, segs=8):
    """one chopstick along +x from its top (x 0) to its tip (x L): square at the top, its corners easing round as it tapers to a fine tip"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    n = 7
    loops = []
    for k in range(n + 1):
        t = k / n
        x = t * L
        # (from a square (half-width w0/2) to a circle (r1) by the tip)
        hw = w0 / 2 * (1 - t) + r1 * t
        sq = 1 - t ** 0.7
        ring = []
        for j in range(segs):
            a = 2 * math.pi * (j + 0.5) / segs
            cx, cz = math.cos(a), math.sin(a)
            # (a square's point in that direction, eased toward the circle)
            m = max(abs(cx), abs(cz))
            px, pz = cx / m * sq + cx * (1 - sq), cz / m * sq + cz * (1 - sq)
            ring.append(bm.verts.new(P(x, hw * pz + hw, hw * px)))
        loops.append(ring)
    for k in range(n):
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((loops[k][j], loops[k][j2], loops[k + 1][j2], loops[k + 1][j]))
            for lp, (kk, jj) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                lp[uvl].uv = (jj / segs, kk / n)
    for ring, rev in ((loops[0], True), (loops[-1], False)):
        f = bm.faces.new(list(reversed(ring)) if rev else ring)
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.0 if rev else 1.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def hashioki(name, L=0.045, r0=0.0062, rw=0.0044, segs=12, n=8):
    """a pillow of porcelain along x, drawn in at its waist, its underside flattened to sit"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    loops = []
    for k in range(n + 1):
        t = k / n
        x = (t - 0.5) * L
        r = rw + (r0 - rw) * (2 * t - 1) ** 2
        ring = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            y, z = math.sin(a) * r, math.cos(a) * r
            y = max(y, -r * 0.55)
            ring.append(bm.verts.new(P(x, y + r * 0.55, z)))
        loops.append(ring)
    for k in range(n):
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((loops[k][j], loops[k][j2], loops[k + 1][j2], loops[k + 1][j]))
            for lp, (kk, jj) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                lp[uvl].uv = (jj / segs, kk / n)
    for ring, rev in ((loops[0], True), (loops[-1], False)):
        f = bm.faces.new(list(reversed(ring)) if rev else ring)
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def tissue_case(name, W=0.24, H=0.075, D=0.12, r=0.008):
    """the case, made as a joiner would (the owner's: it was a plain rounded block): a body with its corners rounded, and a lid board laid on
    it, a fine shadow line of a seam between them, the lid's edges chamfered; through the lid a long slot with rounded ends, its sides
    going down into the box. Its grain along it"""
    LT = min(0.009, H * 0.15)          # the lid's thickness
    SW, SD = W * 0.56, 0.016           # the slot: long, narrow
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, (H - LT) / 2, 0))
    body = bpy.context.view_layer.objects.active
    body.scale = (W, D, H - LT - 0.0012)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    mod = body.modifiers.new("round", "BEVEL")
    mod.width = r
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # (the seam's shadow: the body's top a hair under the lid, and the lid a hair in from its edges)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H - LT / 2, 0))
    lid = bpy.context.view_layer.objects.active
    lid.scale = (W - 0.002, D - 0.002, LT)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    mod = lid.modifiers.new("chamfer", "BEVEL")
    mod.width = 0.0022
    mod.segments = 1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # (the slot: a stadium cut down through the lid and on into the box)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=SD / 2, depth=0.05, location=P(0, H, 0))
    cut = bpy.context.view_layer.objects.active
    cut.scale = ((SW + SD) / SD, 1.0, 1.0)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    # (squared off into a stadium: its middle part's sides flattened)
    for vtx in cut.data.vertices:
        if abs(vtx.co.x) < SW / 2:
            vtx.co.y = math.copysign(SD / 2, vtx.co.y) if abs(vtx.co.y) > 1e-6 else vtx.co.y
    for target in (lid, body):
        b = target.modifiers.new("slot", "BOOLEAN")
        b.operation = "DIFFERENCE"
        b.solver = "EXACT"
        b.object = cut
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(cut, do_unlink=True)
    o = joined(name, [body, lid])
    o.name = name
    # (its picture laid along it: u along x, v round it, at one scale)
    me = o.data
    uvl = me.uv_layers.new(name="UVMap") if not me.uv_layers else me.uv_layers[0]
    for poly in me.polygons:
        nrm = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(nrm.z) > 0.6:
                uvl.data[li].uv = (co.x / 0.3 + 0.5, co.y / 0.3 + 0.5)
            elif abs(nrm.y) > 0.6:
                uvl.data[li].uv = (co.x / 0.3 + 0.5, co.z / 0.3)
            else:
                uvl.data[li].uv = (co.y / 0.3 + 0.5, co.z / 0.3)
    for f in me.polygons:
        f.use_smooth = True
    return o


def tissue_sheet(name, h=0.045, fan=0.05, y0=0.075):
    """the tissue pulled up out of the slot: a soft sheet, its foot in the slot, its top fanned and folded over (`h` how far up it stands)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    nu, nv = 5, 4
    vs = []
    for j in range(nv + 1):
        t = j / nv
        row = []
        for i in range(nu + 1):
            s = i / nu - 0.5
            w = 0.05 + fan * t
            x = s * w * 2
            y = y0 + t * h - (s * 2) ** 2 * 0.012 * t * h / 0.045
            z = 0.012 * math.sin(math.pi * t) * (1 - abs(s)) - 0.008 * t * t + 0.004 * math.sin(s * 6 + t * 3)
            row.append(bm.verts.new(P(x, y, z)))
        vs.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ii / nu, jj / nv)
    return mesh_obj(name, bm)


def board(name, x0, x1, y0, y1, z0, z1, ease=0.0015):
    """a piece of wood between those bounds, its edges eased a little, its picture laid on each face at one scale (grain along x)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    if ease:
        mod = o.modifiers.new("ease", "BEVEL")
        mod.width = ease
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    me = o.data
    uvl = me.uv_layers.new(name="UVMap") if not me.uv_layers else me.uv_layers[0]
    for poly in me.polygons:
        nrm = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(nrm.z) > 0.6:
                uvl.data[li].uv = (co.x / 0.3 + 0.5, co.y / 0.3 + 0.5)
            elif abs(nrm.y) > 0.6:
                uvl.data[li].uv = (co.x / 0.3 + 0.5, co.z / 0.3)
            else:
                uvl.data[li].uv = (co.y / 0.3 + 0.5, co.z / 0.3)
    for f in me.polygons:
        f.use_smooth = False
    return o


def joined(name, objs):
    """several pieces made one mesh (one material: one draw)"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


# (each place's drawer: its case's outside, the drawer's front and box, in the game's frame from the middle of the case's front edge along the
# top's underside: x across, y up (all below 0), z back toward the cook)
DW, DH, DD, DT = 0.17, 0.125, 0.26, 0.012


def drawer_case(name):
    """the case: a top just under the counter's, a bottom, two sides and a back, open at the front"""
    x, y0 = DW / 2, -DH
    return joined(name, [board(f"{name}Top", -x, x, -DT, 0, 0, DD, ease=0.0028), board(f"{name}Bottom", -x, x, y0, y0 + DT, 0, DD, ease=0.0028),
                         board(f"{name}L", -x, -x + DT, y0 + DT, -DT, 0, DD, ease=0.0028), board(f"{name}R", x - DT, x, y0 + DT, -DT, 0, DD, ease=0.0028),
                         board(f"{name}Back", -x + DT, x - DT, y0 + DT, -DT, DD - DT, DD)])


def drawer_body(name):
    """the drawer: its front (2 mm proud of the case: a frame, its edges chamfered, and a raised field in it a little prouder still, its
    edges chamfered too, so a fine shadow runs round it; the owner: better made), and the box behind it: a bottom, two sides, a back"""
    fy0, fy1 = -DH + 0.014, -0.014
    by0 = -DH + DT + 0.002
    fx = DW / 2 - DT - 0.002
    ix = fx - 0.008
    m = 0.011
    return joined(name, [board(f"{name}Front", -fx, fx, fy0, fy1, -0.002, 0.014, ease=0.0028),
                         board(f"{name}Field", -fx + m, fx - m, fy0 + m, fy1 - m, -0.0045, 0.0, ease=0.0022),
                         board(f"{name}Bottom", -ix - 0.006, ix + 0.006, by0, by0 + 0.006, 0.014, 0.236, ease=0),
                         board(f"{name}L", -ix - 0.006, -ix, by0, -0.035, 0.014, 0.236, ease=0),
                         board(f"{name}R", ix, ix + 0.006, by0, -0.035, 0.014, 0.236, ease=0),
                         board(f"{name}Back", -ix, ix, by0, -0.035, 0.23, 0.236, ease=0)])


def drawer_pull(name, segs=10):
    """a little brass bar pull on two posts, across the front's middle"""
    cy, z = -DH / 2, -0.002
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=0.0042, depth=0.056, location=P(0, cy, z - 0.013), rotation=(0, math.pi / 2, 0))
    bar = bpy.context.view_layer.objects.active
    posts = []
    for sx in (-0.021, 0.021):
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=0.003, depth=0.013, location=P(sx, cy, z - 0.0065), rotation=(math.pi / 2, 0, 0))
        posts.append(bpy.context.view_layer.objects.active)
    o = joined(name, [bar] + posts)
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def tissue_pull(name):
    """a tissue as it's pulled out: a soft sheet hanging from where it's held (its top edge's middle at the origin), its corners falling
    away, a crease or two down it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    nu, nv = 6, 7
    W, H = 0.14, 0.17
    vs = []
    for j in range(nv + 1):
        t = j / nv
        row = []
        for i in range(nu + 1):
            s_ = i / nu - 0.5
            # (narrower where it's held, spreading below; folds across; its lower corners curling back)
            w = W * (0.35 + 0.65 * min(1.0, t * 1.6))
            x = s_ * w
            y = -t * H + 0.01 * math.sin(s_ * 9 + t * 2) * t
            z = 0.012 * math.sin(math.pi * s_ * 2 + t * 4) * t + 0.02 * t * t * abs(s_) * 2 - 0.008 * t
            row.append(bm.verts.new(P(x, y, z)))
        vs.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ii / nu, jj / nv)
    return mesh_obj(name, bm)


def lathe(name, prof, segs=24, v_of=None):
    """turned: the profile (radius, height) round the y axis, from the middle of its underside out and up; its picture wrapped round it (u
    the way round, v from v_of(height), else its height over the profile's)"""
    # (a profile starting or ending on the axis: that point left out and the ring beside it closed flat instead, laddered on export; never a
    # fan of triangles into the middle)
    shut = [prof[0][0] <= 1e-6, prof[-1][0] <= 1e-6]
    prof = prof[1 if shut[0] else 0: len(prof) - (1 if shut[1] else 0)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    top = max(y for _, y in prof) or 1.0
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) if r > 1e-6 else None
                      for j in range(segs)])
    centre = {i: bm.verts.new(P(0, y, 0)) for i, (r, y) in enumerate(prof) if r <= 1e-6}
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            a = rings[i][j] or centre[i]
            b = rings[i][j2] or centre[i]
            c = rings[i + 1][j2] or centre[i + 1]
            d = rings[i + 1][j] or centre[i + 1]
            uniq = []
            for vv in (a, b, c, d):
                if vv not in uniq:
                    uniq.append(vv)
            if len(uniq) < 3:
                continue
            f = bm.faces.new(uniq)
            for lp in f.loops:
                co = lp.vert.co
                ang = (math.atan2(-co.y, co.x) / (2 * math.pi)) % 1.0
                lp[uvl].uv = (ang, v_of(co.z) if v_of else co.z / top)
    for ring, on in ((rings[0], shut[0]), (rings[-1], shut[1])):
        if not on:
            continue
        f = bm.faces.new(ring)
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = ((math.atan2(-co.y, co.x) / (2 * math.pi)) % 1.0, v_of(co.z) if v_of else co.z / top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def tube(name, a, b, r0, r1, segs=10):
    """a tapered tube from a to b (the game's frame), its ends closed"""
    a, b = Vector(a), Vector(b)
    ax = (b - a).normalized()
    side = ax.cross(Vector((0, 1, 0)))
    if side.length < 1e-4:
        side = ax.cross(Vector((1, 0, 0)))
    side.normalize()
    up = side.cross(ax).normalized()
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for t, r in ((0.0, r0), (1.0, r1)):
        c = a.lerp(b, t)
        rings.append([bm.verts.new(P(*(c + side * (r * math.cos(2 * math.pi * j / segs)) + up * (r * math.sin(2 * math.pi * j / segs)))))
                      for j in range(segs)])
    for j in range(segs):
        j2 = (j + 1) % segs
        f = bm.faces.new((rings[0][j], rings[0][j2], rings[1][j2], rings[1][j]))
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.97)
    for ring, rev in ((rings[0], True), (rings[1], False)):
        f = bm.faces.new(list(reversed(ring)) if rev else ring)
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.97)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)


def seigaiha(x, y, line=0.05):
    """the blue waves (青海波), as lines: rows of fans, each of nested arcs, the rows half a fan apart and each lower row in front of the
    one above; x, y in fans (a fan's radius 1, rows half a radius apart, y up). How strongly each point is on a line, 0..1"""
    best = np.full(x.shape, 9.0, np.float32)
    base = np.floor(y * 2)
    # (the rows whose fans can reach here: the lowest last, as it's in front)
    for k in (0, 1, 2):
        j = base - k
        off = np.mod(j, 2)
        cx = np.round((x - off) / 2) * 2 + off
        cy = j * 0.5
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        mine = (d < 1.0) & (y >= cy - 0.02)
        best = np.where(mine, d, best)
    rings = np.zeros(x.shape, np.float32)
    for r in (0.28, 0.52, 0.76, 0.98):
        rings = np.maximum(rings, smooth(line, 0.0, np.abs(best - r)))
    return rings * (best < 1.5)


def shoyu_glaze(N=512):
    """the soy pot's glaze, wrapped round it (u round, v up its height): white porcelain, a band of indigo waves (seigaiha) round its belly
    between two fine lines, its neck, lid and spout (the top of the picture) a deeper indigo"""
    u, v = grid01(N)
    col = np.broadcast_to(np.array((0.95, 0.95, 0.93), np.float32), (N, N, 3)).copy()
    ind = np.array((0.14, 0.22, 0.5), np.float32)
    lo, hi = 0.3, 0.62
    band = ((v > lo) & (v < hi)).astype(np.float32)
    m = seigaiha(u * 14, (v - lo) / (hi - lo) * 3.2, 0.07) * band
    m = np.maximum(m, smooth(0.006, 0.0, np.abs(v - lo + 0.008)) + smooth(0.006, 0.0, np.abs(v - hi - 0.008)))
    m = np.maximum(m, smooth(0.84, 0.88, v))
    return mix(col, ind, np.clip(m, 0, 1) * 0.92)


def celadon(N=64):
    """the wasabi jar's pale green glaze, a little deeper where it pools"""
    seed(12)
    n = fbm(N, 4, 4, 3)
    return mix((0.55, 0.68, 0.58), (0.68, 0.79, 0.68), n * 0.7)


def condiments(name, M, ps):
    """the soy pot and the wasabi on their tray (its middle at the origin; the soy toward +x, the spouts toward the places, -z)"""
    out = []
    # (the tray: black lacquer, its corners eased)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, 0.006, 0))
    tr = bpy.context.view_layer.objects.active
    tr.name = f"{name}Tray"
    tr.scale = (0.15, 0.08, 0.012)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    mod = tr.modifiers.new("ease", "BEVEL")
    mod.width = 0.004
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    out.append(fin(tr, M["tray"], ps))
    # (the soy pot: a squat round body narrowing to a short neck, a lid with a knob; the spout off its shoulder, toward the places)
    sx = 0.032
    top = 0.096

    def up_to(y):
        return y / top
    body = lathe(f"{name}Shoyu", [(0.0, 0.012), (0.02, 0.012), (0.022, 0.0135), (0.026, 0.024), (0.0275, 0.04), (0.025, 0.056),
                                  (0.017, 0.066), (0.0135, 0.071), (0.0135, 0.075), (0.0, 0.075)], segs=20, v_of=up_to)
    lid = lathe(f"{name}ShoyuLid", [(0.0, 0.074), (0.0158, 0.074), (0.0158, 0.078), (0.012, 0.083), (0.005, 0.085), (0.0042, 0.09),
                                    (0.0055, 0.094), (0.0, top)], segs=16, v_of=up_to)
    spout = tube(f"{name}ShoyuSpout", (0, 0.05, -0.02), (0, 0.066, -0.036), 0.0058, 0.0032, segs=10)
    for o in (body, lid, spout):
        o.location = P(sx, 0, 0)
        out.append(fin(o, M["shoyu"], ps))
    # (the wasabi: a little lidded jar, a wooden spoon's handle out from under its lid)
    wx = -0.036
    jar = lathe(f"{name}Wasabi", [(0.0, 0.012), (0.014, 0.012), (0.016, 0.014), (0.0195, 0.024), (0.019, 0.04), (0.0168, 0.044),
                                  (0.0, 0.044)], segs=18)
    jl = lathe(f"{name}WasabiLid", [(0.0, 0.0435), (0.0182, 0.0435), (0.0175, 0.047), (0.012, 0.0505), (0.0045, 0.051), (0.0045, 0.055),
                                    (0.0, 0.056)], segs=18)
    for o in (jar, jl):
        o.location = P(wx, 0, 0)
        out.append(fin(o, M["celadon"], ps))
    spoon = tube(f"{name}WasabiSpoon", (wx + 0.004, 0.046, -0.006), (wx + 0.016, 0.052, -0.027), 0.0019, 0.0015, segs=6)
    out.append(fin(spoon, M["spoon"], ps))
    return out


def swatch(name):
    """a little square (the walnut's boards are kept on these, for the game to take)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = [bm.verts.new(P(x, 0, z)) for (x, z) in ((0, 0), (0.01, 0), (0.01, 0.01), (0, 0.01))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    return mesh_obj(name, bm, smooth_shade=False)


def slot(name, W=0.13, D=0.014, y=0.0752):
    """the dark inside seen down the slot: a floor a little way under the lid (the tissues' top, in shadow)"""
    bm = bmesh.new()
    y = y - 0.012
    vs = [bm.verts.new(P(x, y, z)) for (x, z) in ((-W / 2, -D / 2), (W / 2, -D / 2), (W / 2, D / 2), (-W / 2, D / 2))]
    bm.faces.new(list(reversed(vs)))
    return mesh_obj(name, bm, smooth_shade=False)


def fin(o, mat, parts):
    o.data.materials.clear()
    o.data.materials.append(mat)
    parts.append(o)
    return o


def tris(parts):
    return sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons)


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "dish": pbr("BarDishGlaze", (1, 1, 1), tex=image("bardish", sometsuke()), rough=0.25, coat=0.4),
    "lacquer": pbr("BarChopLacquer", (1, 1, 1), tex=image("barchop", lacquer()), rough=0.3, coat=0.5),
    "rest": pbr("BarRestGlaze", (1, 1, 1), tex=image("barrest", glaze()), rough=0.2, coat=0.5),
    "walnut": pbr("BarTissueWalnut", (1, 1, 1), tex=image("bartissuewood", walnut(0)), rough=0.45, coat=0.2),
    **{f"walnut{k}": pbr(f"BarWalnut{k}", (1, 1, 1), tex=image(f"barwalnut{k}", walnut(k)), rough=0.45, coat=0.2) for k in range(4)},
    "tray": pbr("BarCondTray", (0.06, 0.045, 0.04), rough=0.25, coat=0.6),
    "shoyu": pbr("BarShoyuGlaze", (1, 1, 1), tex=image("barshoyu", shoyu_glaze()), rough=0.2, coat=0.5),
    "celadon": pbr("BarWasabiGlaze", (1, 1, 1), tex=image("barwasabi", celadon()), rough=0.2, coat=0.5),
    "spoon": pbr("BarWasabiSpoon", (0.72, 0.56, 0.36), rough=0.6),
    "paper": pbr("BarTissuePaper", (0.97, 0.96, 0.94), rough=0.9),
    "slot": pbr("BarTissueSlot", (0.05, 0.04, 0.03), rough=0.9),
    "brass": pbr("BarDrawerBrass", (0.78, 0.6, 0.3), rough=0.35, metal=0.8),
}
roots, allparts = [], []
for name, build, offset in (
        ("BarSoyDish", lambda ps: [fin(soy_dish("BarSoyDishBody"), M["dish"], ps)], (0, 0, 0)),
        ("BarChopstick", lambda ps: [fin(chopstick("BarChopstickBody"), M["lacquer"], ps)], (0.15, 0, 0)),
        ("BarHashioki", lambda ps: [fin(hashioki("BarHashiokiBody"), M["rest"], ps)], (0.45, 0, 0)),
        ("BarTissue", lambda ps: [fin(tissue_case("BarTissueCase"), M["walnut"], ps), fin(slot("BarTissueSlot"), M["slot"], ps),
                                  fin(tissue_sheet("BarTissueSheet"), M["paper"], ps)], (0.7, 0, 0)),
        ("BarTissueLow", lambda ps: [fin(tissue_case("BarTissueLowCase", W=0.2, H=0.06, D=0.11), M["walnut"], ps),
                                     fin(slot("BarTissueLowSlot", W=0.1, y=0.0602), M["slot"], ps),
                                     fin(tissue_sheet("BarTissueLowSheet", h=0.01, fan=0.02, y0=0.06), M["paper"], ps),
                                     fin(tissue_sheet("BarTissueLowPop", h=0.04, fan=0.04, y0=0.06), M["paper"], ps)], (0.7, 0, 0.3)),
        ("BarTissuePull", lambda ps: [fin(tissue_pull("BarTissuePullSheet"), M["paper"], ps)], (0.95, 0.2, 0.3)),
        ("BarDrawerCase", lambda ps: [fin(drawer_case("BarDrawerCaseBody"), M["walnut"], ps)], (0.1, 0.2, 0.3)),
        ("BarDrawer", lambda ps: [fin(drawer_body("BarDrawerBody"), M["walnut"], ps), fin(drawer_pull("BarDrawerPull"), M["brass"], ps)], (0.5, 0.2, 0.3)),
        ("BarCondiments", lambda ps: condiments("BarCond", M, ps), (0.3, 0, -0.3)),
        *[(f"BarWalnutSwatch{k}", (lambda k: lambda ps: [fin(swatch(f"BarWalnutSwatchMesh{k}"), M[f"walnut{k}"], ps)])(k), (1.2 + 0.05 * k, 0, 0))
          for k in range(4)]):
    parts = []
    build(parts)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    root.location = P(*offset)
    if name == "BarTissueLow":
        # (lengthways in the drawer: its long side front to back)
        root.rotation_euler = (0, 0, math.pi / 2)
    roots.append(root)
    allparts += parts
    print(name, tris(parts))
# (the tissue's paper seen from both sides)
M["paper"].use_backface_culling = False
top = bpy.data.objects.new("BarSetting", None)
bpy.context.collection.objects.link(top)
for r in roots:
    r.parent = top
if PREVIEW:
    target = P(0.42, 0.02, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.42, 0.5, -0.62)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 40
    bpy.context.scene.camera = cam
    for nm, loc, energy in (("Key", P(-1.0, 2.0, -1.5), 5.0), ("Fill", P(1.5, 1.0, 1.0), 2.0)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = energy
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(top, allparts + roots + [top], os.path.join(PROJECT, "public", "models", "barsetting.glb"), os.path.join(PROJECT, "blender", "barsetting.blend"), PREVIEW)
print("BARSETTING_DONE", tris(allparts))
