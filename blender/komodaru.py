"""A stack of straw-wrapped sake barrels (菰樽): komodaru.glb, node "Komodaru", three barrels, two on the floor and one sat in the hollow
between them on top, as they're piled by a shop's door. Each barrel is a cask bulging a little at its middle, wrapped all round in a woven
straw mat (菰) the colour of old straw, its mat's seam down the back; the brewer's mark printed big on its front in brushed ink with a red
seal; a thick twisted straw rope round it near the top and near the foot, others running up and down its side between them, and its top a
straw lid gathered at the rim under a rope tied off in loops with the ends hanging. About 0.5 across and 0.5 tall a barrel, in metres,
z up, the stack's middle at the origin.

Run:
    blender -b --factory-startup --python blender/komodaru.py -- <project path> [preview.png]
"""
import math
import os
import random
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
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(4)


def active():
    return bpy.context.view_layer.objects.active


# ---- textures
N = 1024
u, v = grid01(N)
rng = np.random.default_rng(3)
# (the straw mat: woven, its straws running round the barrel (along u) in close rows, each row its own shade of old straw, the warp cords
# crossing up it every so often; weathered, a little grubby toward the foot)
row = np.floor(v * 140)
tone = (np.sin(row * 12.9898) * 43758.5453) % 1.0
straw = mix((0.62, 0.52, 0.34), (0.8, 0.71, 0.5), tone)
fib = 0.88 + 0.12 * np.sin((u * 900 + tone * 50) + np.sin(v * 140 * np.pi) * 2)
straw = straw * fib[..., None]
edge = np.abs(((v * 140) % 1.0) - 0.5) * 2
straw = straw * (0.82 + 0.18 * (1 - edge ** 6))[..., None]
warp = np.abs(((u * 26) % 1.0) - 0.5) * 2
straw = mix(straw, (0.42, 0.33, 0.2), smooth(0.93, 1.0, warp) * 0.6)
straw = mix(straw, (0.4, 0.33, 0.24), smooth(0.25, 0.0, v) * 0.25)
straw = mix(straw, (0.5, 0.42, 0.3), smooth(0.6, 0.9, fbm(N, 5, 5, 4)) * 0.3)
# (the rope: twisted straw, its strands spiralling round it)
ru, rv = grid01(256)
twist = np.sin((ru * 3 + rv * 9) * 2 * np.pi)
rope = mix((0.5, 0.42, 0.28), (0.78, 0.69, 0.5), smooth(-0.6, 0.8, twist))
rope = rope * (0.9 + 0.1 * np.sin(ru * 2 * np.pi * 60))[..., None]
# (the label printed on the straw: cream paper with its fibres, the straw's rows faintly through it, a red double border with a black hairline
# inside, a red diamond crest at its head over the brewer's name, a deep red band at its foot ruled with gold)
LW, LH = 256, 352
lu, lv = np.meshgrid((np.arange(LW) + 0.5) / LW, (np.arange(LH) + 0.5) / LH)
paper = mix((0.86, 0.8, 0.66), (0.92, 0.88, 0.76), (np.sin(lu * 380 + np.sin(lv * 60) * 3) * 0.5 + 0.5) * 0.25)
paper = paper * (0.93 + 0.07 * (np.abs(((lv * 46) % 1.0) - 0.5) * 2))[..., None]
red = np.array((0.66, 0.1, 0.07), np.float32)
dx, dy = np.minimum(lu, 1 - lu), np.minimum(lv, 1 - lv)
d = np.minimum(dx * LW / LH, dy)
border = ((d > 0.012) & (d < 0.04)) | ((d > 0.052) & (d < 0.06))
paper[border] = red
paper[(d > 0.07) & (d < 0.074)] = (0.08, 0.06, 0.05)
# (the crest: a red diamond at the head, a cream diamond in it, a red dot in that)
cx, cy = np.abs(lu - 0.5) * LW / LH, np.abs(lv - 0.86)
dia = cx + cy
paper[(dia < 0.075) & (lv > 0.7)] = red
paper[(dia < 0.05) & (lv > 0.7)] = (0.9, 0.84, 0.7)
paper[(dia < 0.022) & (lv > 0.7)] = red
# (the band at the foot, ruled with two gold lines)
band = (lv > 0.08) & (lv < 0.17) & (d > 0.075)
paper[band] = (0.5, 0.07, 0.05)
paper[band & ((np.abs(lv - 0.1) < 0.004) | (np.abs(lv - 0.15) < 0.004))] = (0.82, 0.64, 0.3)
LABEL_TEX = image("komo_label", np.clip(paper, 0, 1).astype(np.float32))
M = {
    "straw": pbr("KomoStraw", (1, 1, 1), tex=image("komo_straw", straw.astype(np.float32)), rough=0.85),
    "lid": pbr("KomoLid", (1, 1, 1), tex=image("komo_lid", straw.astype(np.float32)), rough=0.85),
    "rope": pbr("KomoRope", (1, 1, 1), tex=image("komo_rope", rope.astype(np.float32)), rough=0.9),
    "ink": pbr("KomoInk", (0.04, 0.03, 0.025), rough=0.8),
    "red": pbr("KomoRed", (0.62, 0.08, 0.05), rough=0.7),
    "label": pbr("KomoLabel", (1, 1, 1), tex=LABEL_TEX, rough=0.85),
}
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


R, HT = 0.25, 0.5


def radius_at(z):
    """the barrel's radius at height z: bulging a little at its middle, drawn in to the rims"""
    t = z / HT
    return R * (0.9 + 0.1 * math.sin(math.pi * t) ** 0.7)


def tube(name, pts, r, mat, cyclic=False):
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = r; cd.bevel_resolution = 1
    sp = cd.splines.new("POLY"); sp.points.add(len(pts) - 1); sp.use_cyclic_u = cyclic
    for spt, q in zip(sp.points, pts):
        spt.co = (*q, 1)
    cd.use_fill_caps = not cyclic
    o = bpy.data.objects.new(name, cd); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = active()
    # (its twist from where each point is: the strands' spiral runs on across the rope wherever it goes)
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new()
    uvd = me.uv_layers.active.data
    for li, lp in enumerate(me.loops):
        c = me.vertices[lp.vertex_index].co
        uvd[li].uv = (c.x * 9 + c.y * 9, c.z * 9 + c.x * 5 - c.y * 5)
    return fin(o, name, mat)


def wrap_text(text, size, z, mat, name, spread=1.0):
    """brushed lettering on the barrel's front: a text laid flat, then bent round the barrel's curve so it lies on the straw"""
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = active()
    tx.data.body = text
    font = None
    for f in ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/yumindb.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc"):
        if os.path.exists(f):
            font = bpy.data.fonts.load(f)
            break
    if font:
        tx.data.font = font
    tx.data.size = size
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    # (printed flat, its curves at a modest resolution: seen at a few metres a brushed character needs no more)
    tx.data.extrude = 0.0
    tx.data.resolution_u = 2
    bpy.ops.object.convert(target="MESH")
    o = active()
    # (the text lies in x-y; stood up on the barrel's front (+y out of it), x bent round the barrel)
    for vt in o.data.vertices:
        x, y, zz = vt.co
        zh = z + y
        rr = radius_at(zh) + 0.004 + zz
        a = x * spread / radius_at(zh)
        vt.co = Vector((math.sin(a) * rr, -math.cos(a) * rr, zh))
    return fin(o, name, mat, smooth=False)


def barrel(at, turn, k):
    """one komodaru at `at` (its foot's middle), turned `turn` about z"""
    made = []
    start = len(parts)
    # (the body: the straw mat round it, its rows running round; a little uneven, as a mat is)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    NA, NZ = 32, 10
    rings = []
    for j in range(NZ + 1):
        z = HT * j / NZ
        rings.append([bm.verts.new((math.cos(2 * math.pi * i / NA) * radius_at(z) * (1 + 0.006 * math.sin(i * 1.7 + j)),
                                    math.sin(2 * math.pi * i / NA) * radius_at(z) * (1 + 0.006 * math.sin(i * 1.7 + j)), z)) for i in range(NA)])
    for j in range(NZ):
        for i in range(NA):
            i2 = (i + 1) % NA
            f = bm.faces.new((rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]))
            for l, (uu, vv) in zip(f.loops, ((i / NA, j / NZ), ((i + 1) / NA, j / NZ), ((i + 1) / NA, (j + 1) / NZ), (i / NA, (j + 1) / NZ))):
                l[uvl].uv = (uu * 2, vv)
    # (the lid: a straw disc a little domed, gathered in at its rim)
    # (its dome two rings in toward the middle, the last closed across in a ladder, and its foot laddered too: fans of 32 into a point)
    lid = [rings[-1]]
    for kk, (fr, up) in enumerate(((0.62, 0.021), (0.3, 0.028))):
        lid.append([bm.verts.new((v.co.x * fr, v.co.y * fr, HT + up)) for v in rings[-1]])
    lid_faces = []
    for a_, b_ in zip(lid, lid[1:]):
        for i in range(NA):
            i2 = (i + 1) % NA
            lid_faces.append(bm.faces.new((a_[i], a_[i2], b_[i2], b_[i])))
    lid_faces += ladder_fill(bm, lid[-1])
    for f in lid_faces:
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = (0.5 + co.x * 1.6, 0.5 + co.y * 1.6)
    ladder_fill(bm, rings[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"KomoBody{k}"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(f"KomoBody{k}", me); bpy.context.collection.objects.link(o)
    fin(o, f"KomoBody{k}", M["straw"])
    # (the mat's straw ends where it's gathered over the lid's rim: a ragged frill of flat blades, each a little up out of the rope, then
    # flaring out and drooping over the edge as straw does, their lengths and lean uneven; both faces, seen from in and out)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    NB = 96
    for i in range(NB):
        a = 2 * math.pi * i / NB + random.uniform(-0.02, 0.02)
        out_ = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-math.sin(a), math.cos(a), 0))
        r0 = radius_at(HT) - 0.006
        L = random.uniform(0.022, 0.042)
        w = random.uniform(0.014, 0.02)
        rise, flare, droop = random.uniform(0.008, 0.016), random.uniform(0.6, 1.0), random.uniform(0.3, 0.8)
        base = Vector((math.cos(a) * r0, math.sin(a) * r0, HT - 0.004)) + side * random.uniform(-0.003, 0.003)
        pts = []
        for t in (0.0, 0.45, 1.0):
            pts.append(base + out_ * (L * flare * t) + Vector((0, 0, rise * math.sin(math.pi * min(1.0, t * 1.4)) - droop * L * t * t)))
        # (each face of the blade its own vertices: the two sides wound opposite ways)
        for flip in (False, True):
            rows = [[bm.verts.new(q + side * (w / 2) * (1 - 0.7 * t)), bm.verts.new(q - side * (w / 2) * (1 - 0.7 * t))] for q, t in zip(pts, (0.0, 0.45, 1.0))]
            for j in range(2):
                a0, b0, a1, b1 = rows[j][0], rows[j][1], rows[j + 1][0], rows[j + 1][1]
                f = bm.faces.new((a1, b1, b0, a0) if flip else (a0, b0, b1, a1))
                for l in f.loops:
                    co = l.vert.co
                    l[uvl].uv = (0.5 + co.x * 1.6, 0.5 + co.y * 1.6)
    me = bpy.data.meshes.new(f"KomoFringe{k}"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(f"KomoFringe{k}", me); bpy.context.collection.objects.link(o)
    fin(o, f"KomoFringe{k}", M["lid"], smooth=False)
    # (the ropes: two bands round it, near the top and near the foot; eight running up between them over the side; a ring round the lid)
    for zb in (0.07, HT - 0.06):
        tube(f"KomoBand{k}{int(zb * 100)}", [Vector((math.cos(2 * math.pi * i / 24) * (radius_at(zb) + 0.012), math.sin(2 * math.pi * i / 24) * (radius_at(zb) + 0.012), zb)) for i in range(24)],
             0.011, M["rope"], cyclic=True)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.5:
            continue  # (none across the brewer's mark on the front)
        pts = [Vector((math.cos(a) * (radius_at(z) + 0.01), math.sin(a) * (radius_at(z) + 0.01), z)) for z in np.linspace(0.07, HT - 0.06, 5)]
        tube(f"KomoUp{k}{i}", pts, 0.008, M["rope"])
    tube(f"KomoLidRing{k}", [Vector((math.cos(2 * math.pi * i / 20) * (radius_at(HT) - 0.03), math.sin(2 * math.pi * i / 20) * (radius_at(HT) - 0.03), HT + 0.012)) for i in range(20)],
         0.01, M["rope"], cyclic=True)
    # (the rope tied off over the lid: a loop either side of a knot, its two ends hanging down the side)
    kn = Vector((0.05, -0.05, HT + 0.04))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=8, ring_count=6, location=kn)
    fin(active(), f"KomoKnot{k}", M["rope"])
    for sd in (-1, 1):
        loop = [kn + Vector((sd * 0.07 * math.sin(math.pi * t), -0.03 * math.sin(2 * math.pi * t), 0.02 * math.sin(math.pi * t))) for t in np.linspace(0, 1, 7)]
        tube(f"KomoLoop{k}{sd}", loop, 0.008, M["rope"])
    for sd, ln in ((-1, 0.22), (1, 0.16)):
        a = -math.pi / 2 + sd * 0.45
        end = [kn, Vector((math.cos(a) * (radius_at(HT) + 0.02), math.sin(a) * (radius_at(HT) + 0.02), HT + 0.01))]
        end.append(Vector((math.cos(a) * (radius_at(HT - ln) + 0.025), math.sin(a) * (radius_at(HT - ln) + 0.025), HT - ln)))
        tube(f"KomoEnd{k}{sd}", end, 0.008, M["rope"])
        # (its frayed tassel)
        for t in range(3):
            tip = end[-1] + Vector((random.uniform(-0.015, 0.015), random.uniform(-0.015, 0.015), -random.uniform(0.03, 0.05)))
            tube(f"KomoFray{k}{sd}{t}", [end[-1], tip], 0.002, M["lid"])
    # (the front: a pale paper-coloured label patch printed on the straw, the brewer's name big in brushed ink, a red seal, small lines)
    names = (("菊", "正宗"), ("聞", "野"), ("福", "壽"))[k % 3]
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    pl = active()
    bm = bmesh.new(); bm.from_mesh(pl.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)
    bm.to_mesh(pl.data); bm.free()
    for vt in pl.data.vertices:
        x, y = vt.co.x * 0.22, vt.co.y * 0.3
        zh = HT * 0.5 + y
        rr = radius_at(zh) + 0.002
        a = x / radius_at(zh)
        vt.co = Vector((math.sin(a) * rr, -math.cos(a) * rr, zh))
    fin(pl, f"KomoLabel{k}", M["label"])
    wrap_text(names[0], 0.12, HT * 0.58, M["ink"], f"KomoMark{k}a")
    wrap_text(names[1], 0.075, HT * 0.36, M["ink"], f"KomoMark{k}b")
    # (the brewer's red seal stamped low at the label's right, beside the second line, inside its border)
    zs = HT * 0.37
    xs = 0.062
    asl = xs / radius_at(zs)
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.014, depth=0.002,
                                        location=(math.sin(asl) * (radius_at(zs) + 0.004), -math.cos(asl) * (radius_at(zs) + 0.004), zs), rotation=(math.pi / 2, 0, asl))
    fin(active(), f"KomoSeal{k}", M["red"], smooth=False)
    # (the whole barrel turned and set in place, a hair askew)
    tilt = Matrix.Rotation(random.uniform(-0.03, 0.03), 4, "X")
    # (each part's own scale and turn taken into its matrix first: set just now, they aren't in it until the scene's updated)
    bpy.context.view_layer.update()
    for o in parts[start:]:
        o.matrix_world = Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z") @ tilt @ o.matrix_world
    return made


# (two on the floor side by side, the third sat on them in the hollow between, set back a touch)
barrel(Vector((-R * 1.02, 0, 0)), 0.15, 0)
barrel(Vector((R * 1.02, 0.02, 0)), -0.2, 1)
barrel(Vector((0, 0.06, HT - 0.07)), 0.05, 2)

# (all of each joined by material, to keep the draw calls down)
by = {}
for o in parts:
    by.setdefault(o.data.materials[0].name, []).append(o)
joined = []
for mname, os_ in by.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in os_:
        o.select_set(True)
    bpy.context.view_layer.objects.active = os_[0]
    bpy.ops.object.join()
    os_[0].name = "Komo" + mname.replace("Komo", "")
    joined.append(os_[0])
root = bpy.data.objects.new("Komodaru", None)
bpy.context.collection.objects.link(root)
for o in joined:
    o.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.6, -1.6, 0.9)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0.45)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.7, 0.2, 0.5)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.4, 0.4, 0.4, 1)
    bpy.context.scene.world = w
export_dish(root, joined + [root], os.path.join(PROJECT, "public", "models", "komodaru.glb"), os.path.join(PROJECT, "blender", "komodaru.blend"), PREVIEW)
print("KOMODARU_DONE", sum(len(o.data.polygons) for o in joined))
