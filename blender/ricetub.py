"""The rice tub (お櫃) by the grill, in finer shape: ricetub.glb, three nodes the game handles apart (the lid lifts off, the rice shows when it's
open), sized as the game's own (its foot at y 0, 0.42 tall, 0.27 across the rim):

- RiceTubBody: 28 staves of pale sawara cypress, each its own shade and grain, bevelled so a dark line shows between them; three hammered
  copper hoops (a wide one low, two narrow above) gone a little green at their edges, each lapped and riveted; an ear either side with a
  loop of cord through it; the inside wall and floor in the same wood.
- RiceTubLid: the lid, its origin at its underside's middle: a disc of the same wood with its rings turned into it, an eased edge, a
  bar of darker wood across it to lift it by.
- RiceTubRice: the rice filled to a little under the rim, gently heaped, every grain painted, and the paddle (しゃもじ) laid in it on the rim.

Run:
    blender -b --factory-startup --python blender/ricetub.py -- <project path>
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


def fin(o, name, mat, parts, smooth=True):
    o.name = name
    o.data.materials.clear()
    if isinstance(mat, list):
        for m in mat:
            o.data.materials.append(m)
    else:
        o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
seed(7)
rng = random.Random(3)
N = 256
u, v = grid01(N)
# (sawara: pale yellow-cream, fine straight grain up the stave)
saw = mix((0.86, 0.72, 0.5), (0.78, 0.62, 0.4), smooth(0.3, 0.9, fbm(N, 40, 3, 4)))
saw = mix(saw, (0.62, 0.46, 0.28), smooth(0.86, 1.0, np.sin((u * 18 + fbm(N, 3, 3, 3) * 2) * math.pi * 2) * 0.5 + 0.5) * 0.35)
# (hammered copper, a little verdigris at its edges)
cop = mix((0.72, 0.4, 0.2), (0.86, 0.52, 0.28), fbm(N, 30, 30, 3))
cop = cop * (1 - 0.12 * (fbm(N, 60, 60, 2) > 0.6))[..., None]
cop = mix(cop, (0.36, 0.6, 0.5), smooth(0.85, 1.0, np.abs(v - 0.5) * 2) * 0.45)
# (the lid's top: rings turned into it)
rr = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2)
lidt = mix((0.84, 0.7, 0.48), (0.76, 0.6, 0.38), smooth(0.3, 0.9, fbm(N, 6, 6, 4)))
lidt = mix(lidt, (0.6, 0.44, 0.26), smooth(0.82, 1.0, np.sin((rr * 40 + fbm(N, 4, 4, 3) * 0.8) * math.pi * 2) * 0.5 + 0.5) * 0.4)
# (cooked rice, close up: grain on grain, each a plump little oval lying its own way, lit on top and shaded under, the gaps between them
# in soft shadow; a pearly white with the faintest warm cast)
RN = 1024
rice = np.ones((RN, RN, 3), np.float32) * np.array([0.84, 0.83, 0.8], np.float32)
yy, xx = np.mgrid[0:RN, 0:RN].astype(np.float32)
grng = np.random.default_rng(11)
for k in range(9000):
    cx, cy = grng.uniform(0, RN), grng.uniform(0, RN)
    a = grng.uniform(0, np.pi)
    L, W = grng.uniform(9, 13), grng.uniform(4.5, 6)
    x0, x1, y0, y1 = int(max(0, cx - 14)), int(min(RN, cx + 15)), int(max(0, cy - 14)), int(min(RN, cy + 15))
    if x1 <= x0 or y1 <= y0:
        continue
    dx, dy = xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy
    u_ = (dx * np.cos(a) + dy * np.sin(a)) / L
    v_ = (-dx * np.sin(a) + dy * np.cos(a)) / W
    d = u_ * u_ + v_ * v_
    m = d < 1
    # (lit from above: brighter toward its upper side, a highlight, darker at its rim)
    shade = 0.9 + 0.1 * np.clip(-dy / W * 0.6 + 0.5, 0, 1) - 0.06 * d
    shade = shade + 0.08 * np.exp(-((u_ + 0.15) ** 2 + (v_ + 0.35) ** 2) * 6)
    col = np.stack([shade * 1.0, shade * 0.995, shade * 0.97], -1)
    rice[y0:y1, x0:x1][m] = np.clip(col[m], 0, 1)

M = {"saw": [pbr(f"RiceStave{k}", (1 - 0.06 * k, 1 - 0.07 * k, 1 - 0.09 * k), tex=image(f"ricesaw{k}", saw), rough=0.55) for k in range(3)],
     "gap": pbr("RiceGap", lin("#6a4a2a"), rough=0.8),
     "inside": pbr("RiceInside", lin("#c8a470"), rough=0.7),
     "copper": pbr("RiceCopper", (1, 1, 1), tex=image("ricecopper", cop), rough=0.35, metal=0.85),
     "rivet": pbr("RiceRivet", lin("#d8a066"), rough=0.3, metal=1.0),
     "cord": pbr("RiceCord", lin("#8a6a3c"), rough=0.9),
     "lid": pbr("RiceLidTop", (1, 1, 1), tex=image("ricelid", lidt), rough=0.5),
     "bar": pbr("RiceLidBar", lin("#9a6a3a"), rough=0.5),
     "rice": pbr("RiceRice", (1, 1, 1), tex=image("ricegrain", rice), rough=0.35, coat=0.25),
     "paddle": pbr("RicePaddle", lin("#e2c89a"), rough=0.5)}

H, R0, R1 = 0.42, 0.255, 0.27
body, lidp, ricep = [], [], []
# (the staves: each a curved slab of the wall, a hair narrower than its share so a dark line shows between)
NS = 28
for k in range(NS):
    a0, a1 = 2 * math.pi * k / NS + 0.004, 2 * math.pi * (k + 1) / NS - 0.004
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    cols = 4
    rows = []
    for (y, r) in ((0.0, R0), (H, R1)):
        for side, dr in (("out", 0.0), ("in", -0.014)):
            pass
    grid = {}
    for yi, y in enumerate((0.0, H)):
        r = R0 + (R1 - R0) * (y / H)
        for side, dr in ((0, 0.0), (1, -0.014)):
            for ci in range(cols + 1):
                a = a0 + (a1 - a0) * ci / cols
                grid[(yi, side, ci)] = bm.verts.new(P((r + dr) * math.cos(a), y, (r + dr) * math.sin(a)))
    def face(vs, uvs):
        f = bm.faces.new(vs)
        for lp, uv in zip(f.loops, uvs):
            lp[uvl].uv = uv
    for ci in range(cols):
        u0, u1 = ci / cols * 0.25 + (k % 4) * 0.25, (ci + 1) / cols * 0.25 + (k % 4) * 0.25
        face([grid[(0, 0, ci)], grid[(0, 0, ci + 1)], grid[(1, 0, ci + 1)], grid[(1, 0, ci)]], [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
        face([grid[(0, 1, ci + 1)], grid[(0, 1, ci)], grid[(1, 1, ci)], grid[(1, 1, ci + 1)]], [(u1, 0), (u0, 0), (u0, 1), (u1, 1)])
        face([grid[(1, 0, ci)], grid[(1, 0, ci + 1)], grid[(1, 1, ci + 1)], grid[(1, 1, ci)]], [(u0, 0.98), (u1, 0.98), (u1, 1), (u0, 1)])
    for ci in (0, cols):
        face([grid[(0, 0, ci)], grid[(1, 0, ci)], grid[(1, 1, ci)], grid[(0, 1, ci)]], [(0, 0), (0, 1), (0.02, 1), (0.02, 0)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"RiceStave{k}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"RiceStave{k}", me)
    bpy.context.collection.objects.link(o)
    m_ = o.modifiers.new("b", "BEVEL"); m_.width = 0.0022; m_.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="b")
    fin(o, f"RiceStave{k}", M["saw"][rng.randrange(3)], body)
# (the dark wall behind the staves' gaps, and the floor)
bpy.ops.mesh.primitive_cone_add(vertices=56, radius1=R0 - 0.004, radius2=R1 - 0.004, depth=H - 0.004, location=P(0, H / 2, 0), end_fill_type="NOTHING")
fin(active(), "RiceGapWall", M["gap"], body)
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=R0 - 0.014, depth=0.02, location=P(0, 0.018, 0))
fin(active(), "RiceFloor", M["inside"], body)
# (the copper hoops: flat bands following the wall's taper, each with a lap and two rivets)
for (y, w) in ((0.07, 0.045), (0.2, 0.03), (0.3, 0.03)):
    r = R0 + (R1 - R0) * (y / H) + 0.004
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=r, depth=w, location=P(0, y, 0), end_fill_type="NOTHING")
    hp = active()
    sol = hp.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.003; sol.offset = 1
    bpy.context.view_layer.objects.active = hp
    bpy.ops.object.modifier_apply(modifier="s")
    fin(hp, f"RiceHoop{int(y * 100)}", M["copper"], body)
    a = 0.5
    for dy in (-w * 0.25, w * 0.25):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.004, segments=8, ring_count=5, location=P((r + 0.004) * math.cos(a), y + dy, (r + 0.004) * math.sin(a)))
        fin(active(), f"RiceRivet{int(y * 100)}{dy > 0}", M["rivet"], body)
# (the ears: a block of the wood either side, a hole through it, a loop of cord)
for sd in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(sd * (R1 + 0.02), 0.355, 0))
    e = active(); e.scale = (0.045, 0.05, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    m_ = e.modifiers.new("b", "BEVEL"); m_.width = 0.008; m_.segments = 3
    bpy.context.view_layer.objects.active = e
    bpy.ops.object.modifier_apply(modifier="b")
    fin(e, f"RiceEar{sd}", M["saw"][0], body)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.022, minor_radius=0.0045, major_segments=16, minor_segments=6, location=P(sd * (R1 + 0.04), 0.36, 0), rotation=(math.pi / 2, 0, 0))
    fin(active(), f"RiceCord{sd}", M["cord"], body)
# (the rim's lip, eased)
bpy.ops.mesh.primitive_torus_add(major_radius=R1 - 0.005, minor_radius=0.008, major_segments=56, minor_segments=8, location=P(0, H - 0.002, 0))
fin(active(), "RiceRim", M["saw"][1], body)

# ---- the lid: its origin at its underside
bpy.ops.mesh.primitive_cylinder_add(vertices=56, radius=0.285, depth=0.032, location=P(0, 0.016, 0))
lid = active()
m_ = lid.modifiers.new("b", "BEVEL"); m_.width = 0.008; m_.segments = 3
bpy.context.view_layer.objects.active = lid
bpy.ops.object.modifier_apply(modifier="b")
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.cylinder_project(direction="ALIGN_TO_OBJECT", scale_to_bounds=True)
bpy.ops.object.mode_set(mode="OBJECT")
# (its top's UVs flat across it, for the turned rings)
for poly in lid.data.polygons:
    if poly.normal.z > 0.9:
        for li in poly.loop_indices:
            co = lid.data.vertices[lid.data.loops[li].vertex_index].co
            lid.data.uv_layers.active.data[li].uv = (0.5 + co.x / 0.58, 0.5 + co.y / 0.58)
fin(lid, "RiceTubLidTop", M["lid"], lidp)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, 0.05, 0))
bar = active(); bar.scale = (0.24, 0.05, 0.035)
bpy.ops.object.transform_apply(scale=True)
m_ = bar.modifiers.new("b", "BEVEL"); m_.width = 0.01; m_.segments = 3
bpy.context.view_layer.objects.active = bar
bpy.ops.object.modifier_apply(modifier="b")
fin(bar, "RiceTubLidBar", M["bar"], lidp)

# ---- the rice: filled to a little under the rim, its top gently heaped and uneven where it's been turned with the paddle, meeting the
# wall all round; the paddle (しゃもじ) laid in it, leaning on the rim
RTOP = H - 0.045
RIN = R0 + (R1 - R0) * (RTOP / H) - 0.006
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
NR, NA = 18, 64
rings = []
centre = bm.verts.new(P(0, RTOP + 0.022, 0))
for i in range(1, NR + 1):
    t = i / NR
    row = []
    for j in range(NA):
        a_ = 2 * math.pi * j / NA
        r = RIN * t
        # (a soft heap, and the paddle's furrows and lumps)
        h = 0.022 * (1 - t * t) + 0.006 * math.sin(a_ * 3 + t * 5) * t * (1 - t) * 4 + 0.003 * math.sin(a_ * 11 + t * 17)
        row.append(bm.verts.new(P(r * math.cos(a_), RTOP + h, r * math.sin(a_))))
    rings.append(row)
faces = [bm.faces.new((centre, rings[0][(j + 1) % NA], rings[0][j])) for j in range(NA)]
for i in range(NR - 1):
    for j in range(NA):
        jn = (j + 1) % NA
        faces.append(bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j])))
# (and down the inside of the wall a little, so no gap shows at its edge)
skirt = [bm.verts.new(P(RIN * math.cos(2 * math.pi * j / NA), RTOP - 0.03, RIN * math.sin(2 * math.pi * j / NA))) for j in range(NA)]
for j in range(NA):
    jn = (j + 1) % NA
    faces.append(bm.faces.new((rings[-1][j], rings[-1][jn], skirt[jn], skirt[j])))
for f in faces:
    for l in f.loops:
        co = l.vert.co
        l[uvl].uv = (co.x * 3.0, co.y * 3.0)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    if f.normal.z < 0 and f.calc_center_median().z > RTOP - 0.001:
        f.normal_flip()
me_ = bpy.data.meshes.new("RiceTubRiceMound"); bm.to_mesh(me_); bm.free()
rc = bpy.data.objects.new("RiceTubRiceMound", me_); bpy.context.collection.objects.link(rc)
fin(rc, "RiceTubRiceMound", M["rice"], ricep)
# (the paddle: a flat oval blade a little dished, a slim handle widening into it; its blade lying in the rice at a slant, the handle resting
# on the rim and out over it)
bm = bmesh.new()
outline = []
for k in range(40):
    t = 2 * math.pi * k / 40
    x, y = math.cos(t), math.sin(t)
    # (the blade: an oval, wider toward its tip; y runs along the paddle, the blade's end at +y)
    w = 0.036 * (1 + 0.12 * y)
    outline.append((x * w, 0.05 * y))
top = [bm.verts.new((x, y, 0.004 - 0.003 * (1 - (x / 0.04) ** 2))) for x, y in outline]
bot = [bm.verts.new((x, y, -0.002 - 0.003 * (1 - (x / 0.04) ** 2))) for x, y in outline]
bm.faces.new(top); bm.faces.new(bot[::-1])
for k in range(40):
    kn = (k + 1) % 40
    bm.faces.new((top[k], top[kn], bot[kn], bot[k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me_ = bpy.data.meshes.new("RiceTubPaddleBlade"); bm.to_mesh(me_); bm.free()
bl = bpy.data.objects.new("RiceTubPaddleBlade", me_); bpy.context.collection.objects.link(bl)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1, depth=1, location=(0, -0.05 - 0.15, 0.001))
hd = active(); hd.scale = (0.011, 0.007, 0.3); hd.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(scale=True, rotation=True)
# (the neck where the handle widens into the blade)
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.02, radius2=0.011, depth=0.04, location=(0, -0.06, 0.001), rotation=(math.pi / 2, 0, 0))
nk = active(); nk.scale = (1, 0.45, 1)
bpy.ops.object.transform_apply(scale=True, rotation=True)
for o in (hd, nk):
    bpy.ops.object.select_all(action="DESELECT")
bpy.ops.object.select_all(action="DESELECT")
for o in (bl, hd, nk):
    o.select_set(True)
bpy.context.view_layer.objects.active = bl
bpy.ops.object.join()
pd = bl
# (laid in: its blade in the rice toward the far side, tilted up along its length so the handle rests on the near rim)
pd.rotation_euler = (math.radians(-22), 0, math.radians(30))
pd.location = P(-0.02, RTOP + 0.03, -0.1)
fin(pd, "RiceTubPaddle", M["paddle"], ricep)

nodes = []
for name, ps in (("RiceTubBody", body), ("RiceTubLid", lidp), ("RiceTubRice", ricep)):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    for o in ps:
        o.parent = e
    nodes.append(e)
root = bpy.data.objects.new("RiceTub", None)
bpy.context.collection.objects.link(root)
for e in nodes:
    e.parent = root
export_dish(root, body + lidp + ricep + nodes + [root], os.path.join(PROJECT, "public", "models", "ricetub.glb"), os.path.join(PROJECT, "blender", "ricetub.blend"), None)
print("RICETUB_DONE", sum(len(o.data.polygons) for o in body + lidp + ricep))
