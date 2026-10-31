"""What's laid at each place along the bar, at its true size (a bar unit is about a metre: the customers' plates are 26 cm across):

- "BarSoyDish": a little soy dish (醤油皿) of porcelain, 9 cm across, shallow, on a low foot ring, its rim turned up a touch; its picture laid
  flat from above, as the plates' are (the game gives each place one of the plates' designs).
- "BarChopstick": one of a pair of lacquered chopsticks (塗り箸), 22 cm, square at the top tapering to a fine rounded tip: black lacquer over
  the top third with a thin gold band, a deep red-brown below.
- "BarHashioki": a chopstick rest (箸置き) of indigo-glazed porcelain, 4.5 cm, a little pillow drawn in at its waist.
- "BarTissue": a box of tissues in a walnut case, 24 x 12 cm and 7.5 high, its edges rounded, a slot along its top and a tissue puffed up out
  of it.

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


def walnut(N=256):
    """the tissue case's walnut: deep brown, long fine grain along u"""
    seed(9)
    u, v = grid01(N)
    base = np.array((0.38, 0.25, 0.17), np.float32)
    wob = fbm(N, 3, 2, 4) - 0.5
    ring = v * 10 + 0.15 * np.sin(2 * math.pi * u) + wob * 0.3
    late = smooth(0.55, 0.98, np.sin(2 * math.pi * ring * 2))
    col = mix(base, base * np.float32(0.65), late * 0.6)
    fine = np.sin(2 * math.pi * (v * 50 + wob * 4))
    col = mix(col, base * np.float32(0.8), smooth(0.75, 1.0, fine) * 0.3)
    return col * (0.9 + 0.18 * fbm(N, 6, 2, 3))[..., None]


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
    prof = [(0.0, 0.004), (0.023, 0.004), (0.025, 0.0), (0.0295, 0.0), (0.031, 0.004), (0.039, 0.0105), (0.0442, 0.0165), (0.0452, 0.0188),
            (0.0438, 0.0194), (0.0405, 0.0158), (0.031, 0.0092), (0.016, 0.0066), (0.0, 0.0062)]
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
    """the case: a box with its edges rounded (one bevel round, two steps), its grain along it"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H / 2, 0))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (W, D, H)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new("round", "BEVEL")
    mod.width = r
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
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


def tissue_sheet(name):
    """the tissue pulled up out of the slot: a soft sheet, its foot in the slot, its top fanned and folded over"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    nu, nv = 5, 4
    vs = []
    for j in range(nv + 1):
        t = j / nv
        row = []
        for i in range(nu + 1):
            s = i / nu - 0.5
            w = 0.05 + 0.05 * t
            x = s * w * 2
            y = 0.075 + t * 0.045 - (s * 2) ** 2 * 0.012 * t
            z = 0.012 * math.sin(math.pi * t) * (1 - abs(s)) - 0.008 * t * t + 0.004 * math.sin(s * 6 + t * 3)
            row.append(bm.verts.new(P(x, y, z)))
        vs.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ii / nu, jj / nv)
    return mesh_obj(name, bm)


def slot(name, W=0.13, D=0.014, y=0.0752):
    bm = bmesh.new()
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
    "walnut": pbr("BarTissueWalnut", (1, 1, 1), tex=image("bartissuewood", walnut()), rough=0.45, coat=0.2),
    "paper": pbr("BarTissuePaper", (0.97, 0.96, 0.94), rough=0.9),
    "slot": pbr("BarTissueSlot", (0.05, 0.04, 0.03), rough=0.9),
}
roots, allparts = [], []
for name, build, offset in (
        ("BarSoyDish", lambda ps: [fin(soy_dish("BarSoyDishBody"), M["dish"], ps)], (0, 0, 0)),
        ("BarChopstick", lambda ps: [fin(chopstick("BarChopstickBody"), M["lacquer"], ps)], (0.15, 0, 0)),
        ("BarHashioki", lambda ps: [fin(hashioki("BarHashiokiBody"), M["rest"], ps)], (0.45, 0, 0)),
        ("BarTissue", lambda ps: [fin(tissue_case("BarTissueCase"), M["walnut"], ps), fin(slot("BarTissueSlot"), M["slot"], ps),
                                  fin(tissue_sheet("BarTissueSheet"), M["paper"], ps)], (0.7, 0, 0))):
    parts = []
    build(parts)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    root.location = P(*offset)
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
