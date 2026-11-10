"""The washrooms' finer things (wcdecor.glb; the owner's, 2026-11-11: the plants finer, the lamp by the door less plain and brighter):

- node "WcLantern": a hanging wall lantern (掛け行灯): a dark cedar backboard against the wall, a bent arm out from its top, from it a round
  washi shade hung between a turned top and foot of dark wood, four thin ribs down it, a small bronze cap over its top; "WcLanternPaper",
  the shade's paper, the game lights it (its own glow, no light).
- node "Kokedama" (the men's): a moss ball, its moss flecked darker and paler, a few sprigs of fern out of its top, on a shallow near-black
  stoneware dish with a pale glaze run at its rim.
- node "Camellia" (the women's): a sprig of red camellia in a bamboo vase: the vase's nodes, a dark twig, five glossy dark leaves along it,
  one full flower (five cupped petals round a crown of yellow stamens) and a bud.

The game's frame (y up), each on its own origin: the lantern's backboard's back on the wall (z = 0), out toward +z, its middle at y = 0;
the plants' feet on their origins.

Run:
    blender -b --factory-startup --python blender/wcdecor.py -- <project path> [preview.png]
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
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 256
u, v = grid01(N)
moss = mix((0.16, 0.28, 0.08), (0.36, 0.5, 0.16), fbm(N, 10, 10, 4))
moss = mix(moss, (0.08, 0.14, 0.04), smooth(0.6, 0.8, fbm(N, 30, 30, 2)) * 0.6)
moss = mix(moss, (0.55, 0.62, 0.25), smooth(0.7, 0.85, vnoise(N, 60, 60)) * 0.5)
bamboo = mix((0.72, 0.62, 0.32), (0.6, 0.5, 0.24), smooth(0.4, 0.9, np.sin(u * 60 * math.pi) * 0.5 + 0.5) * 0.4)
cedar = mix((0.2, 0.12, 0.07), (0.28, 0.17, 0.1), smooth(0.5, 1.0, np.sin((v * 30 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.6)
glaze = mix((0.07, 0.065, 0.06), (0.12, 0.11, 0.1), fbm(N, 6, 6, 3))
glaze = mix(glaze, (0.62, 0.6, 0.52), smooth(0.86, 0.95, v) * 0.7)
M = {
    "cedar": pbr("WcdCedar", (1, 1, 1), tex=image("wcd_cedar", np.clip(cedar, 0, 1).astype(np.float32)), rough=0.6),
    "bronze": pbr("WcdBronze", lin("#7a5a2a"), rough=0.35, metal=0.8),
    "paper": pbr("WcLanternPaper", lin("#fff1cc"), rough=0.9),
    "moss": pbr("WcdMoss", (1, 1, 1), tex=image("wcd_moss", np.clip(moss, 0, 1).astype(np.float32)), rough=0.95),
    "fern": pbr("WcdFern", lin("#5e8f3a"), rough=0.6),
    "dish": pbr("WcdDish", (1, 1, 1), tex=image("wcd_glaze", np.clip(glaze, 0, 1).astype(np.float32)), rough=0.25),
    "bamboo": pbr("WcdBamboo", (1, 1, 1), tex=image("wcd_bamboo", np.clip(bamboo, 0, 1).astype(np.float32)), rough=0.45),
    "node": pbr("WcdNode", lin("#8a7a3a"), rough=0.5),
    "twig": pbr("WcdTwig", lin("#3a2a1a"), rough=0.7),
    "leaf": pbr("WcdLeaf", lin("#2f6a34"), rough=0.25),
    "petal": pbr("WcdPetal", lin("#c41f38"), rough=0.4),
    "stamen": pbr("WcdStamen", lin("#f2c230"), rough=0.6),
    "bud": pbr("WcdBud", lin("#8a1a2a"), rough=0.4),
}
parts = []


def finish_obj(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth_
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def lathe(name, prof, seg, mat, at=(0, 0, 0), cap_top=False, cap_foot=False, uv_v=None):
    """turned round y from (radius, y) points (no point on the axis: a cap is a ladder across the end ring)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(at[0] + r * math.cos(2 * math.pi * k / seg), at[1] + y, at[2] + r * math.sin(2 * math.pi * k / seg))) for k in range(seg)] for r, y in prof]
    for i in range(len(rings) - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            for lp, (kk, ii) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                lp[uvl].uv = (kk / seg, (uv_v[ii] if uv_v else ii / max(1, len(prof) - 1)))
    if cap_top:
        ladder_fill(bm, rings[-1])
    if cap_foot:
        ladder_fill(bm, rings[0])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_obj(name, bm, mat)


def box(name, x0, x1, y0, y1, z0, z1, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vt in bm.verts:
        vt.co = P(x0 + (vt.co.x + 0.5) * (x1 - x0), y0 + (vt.co.z + 0.5) * (y1 - y0), z0 + (-vt.co.y + 0.5) * (z1 - z0))
    uvl = bm.loops.layers.uv.new()
    for f in bm.faces:
        for lp in f.loops:
            c = lp.vert.co
            lp[uvl].uv = (c.x * 4 + c.y * 4, c.z * 4)
    return finish_obj(name, bm, mat, smooth_=False)


def tube(name, pts, r, mat, sides=5):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 0
    cu.resolution_u = 3
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = P(*p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    for o_ in objs[1:]:
        if o_ in parts:
            parts.remove(o_)
    return o


def leaf(name, at, along, up, length, width, mat, cup=0.25):
    """a leaf: an ellipse two quads across and four long, folded a little along its midrib, cupped up at its edges; from `at`, pointing
    `along`, its face toward `up`"""
    along, up = Vector(along).normalized(), Vector(up).normalized()
    side = along.cross(up).normalized()
    up = side.cross(along).normalized()
    bm = bmesh.new()
    rows = []
    for i in range(5):
        t = i / 4
        w = width * math.sin(math.pi * min(1.0, max(0.0, t * 0.92 + 0.04))) * (1.0 if t < 0.95 else 0.4)
        c = Vector(at) + along * (length * t)
        row = []
        for j, sj in enumerate((-1, 0, 1)):
            p = c + side * (sj * w / 2) + up * (abs(sj) * cup * w * 0.5 - (0.12 * w if sj == 0 else 0)) + up * (0.15 * length * math.sin(math.pi * t))
            row.append(bm.verts.new(P(p.x, p.y, p.z)))
        rows.append(row)
    for i in range(4):
        for j in range(2):
            bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    return finish_obj(name, bm, mat)


# ---------------------------------------------------------------------------------------------------- the lantern
LH, LR, OUT = 0.17, 0.055, 0.1
lan = [box("back", -0.045, 0.045, -0.15, 0.15, 0.0, 0.012, "cedar"),
       box("arm", -0.008, 0.008, 0.115, 0.13, 0.012, OUT + 0.01, "cedar"),
       box("drop", -0.006, 0.006, LH / 2 + 0.012, 0.13, OUT - 0.006, OUT + 0.006, "bronze")]
lan.append(lathe("top", [(LR + 0.006, LH / 2), (LR + 0.008, LH / 2 + 0.008), (LR * 0.7, LH / 2 + 0.014)], 12, "cedar", at=(0, 0, OUT), cap_top=True))
lan.append(lathe("cap", [(LR * 0.66, LH / 2 + 0.014), (LR * 0.35, LH / 2 + 0.03), (LR * 0.2, LH / 2 + 0.034)], 12, "bronze", at=(0, 0, OUT), cap_top=True))
lan.append(lathe("foot", [(LR * 0.6, -LH / 2 - 0.016), (LR + 0.008, -LH / 2 - 0.008), (LR + 0.006, -LH / 2)], 12, "cedar", at=(0, 0, OUT), cap_foot=True))
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    x, z = (LR + 0.003) * math.cos(a), OUT + (LR + 0.003) * math.sin(a)
    lan.append(box(f"rib{k}", x - 0.003, x + 0.003, -LH / 2, LH / 2, z - 0.003, z + 0.003, "cedar"))
lantern = join(lan, "WcLantern")
paper = lathe("WcLanternPaper", [(LR, -LH / 2), (LR * 1.04, -LH / 4), (LR * 1.05, 0), (LR * 1.04, LH / 4), (LR, LH / 2)], 12, "paper", at=(0, 0, OUT))
paper.parent = lantern

# ---------------------------------------------------------------------------------------------------- the moss ball on its dish
dish = lathe("KokedamaDish", [(0.05, 0.0), (0.062, 0.006), (0.068, 0.016), (0.064, 0.02), (0.052, 0.012)], 16, "dish", cap_foot=True, cap_top=True,
             uv_v=[0.0, 0.3, 0.92, 1.0, 0.7])
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.045)
rng = np.random.default_rng(3)
for vt in bm.verts:
    d = vt.co.normalized()
    k = 1 + 0.06 * math.sin(5 * d.x + 2) * math.cos(4 * d.y) + rng.uniform(-0.03, 0.03)
    vt.co = P(d.x * 0.045 * k, 0.012 + 0.04 + d.z * 0.04 * k, -d.y * 0.045 * k)
uvl = bm.loops.layers.uv.new()
for f in bm.faces:
    for lp in f.loops:
        c = lp.vert.co
        lp[uvl].uv = (math.atan2(c.y, c.x) / (2 * math.pi) + 0.5, c.z * 8)
ball = finish_obj("KokedamaBall", bm, "moss")
ferns = []
for k, (a, tilt, ln) in enumerate(((0.3, 0.55, 0.1), (1.6, 0.3, 0.12), (2.9, 0.6, 0.09), (4.2, 0.4, 0.11), (5.3, 0.7, 0.08))):
    base = Vector((0.01 * math.cos(a), 0.09, 0.01 * math.sin(a)))
    along = Vector((math.cos(a) * math.sin(tilt), math.cos(tilt), math.sin(a) * math.sin(tilt)))
    ferns.append(leaf(f"fern{k}", base, along, Vector((math.cos(a), 0.0, math.sin(a))).cross(Vector((0, 1, 0))) if False else Vector((-math.sin(a), 0.0, math.cos(a))).cross(along),
                      ln, 0.018, "fern", cup=0.1))
kokedama = join([dish, ball] + ferns, "Kokedama")

# ---------------------------------------------------------------------------------------------------- the camellia in its bamboo vase
vase = lathe("CamelliaVase", [(0.028, 0.0), (0.029, 0.03), (0.03, 0.07), (0.031, 0.1)], 12, "bamboo", cap_foot=True)
nodes = [lathe(f"node{k}", [(0.031 + 0.001 * k, y - 0.003), (0.034 + 0.001 * k, y), (0.031 + 0.001 * k, y + 0.003)], 12, "node") for k, y in enumerate((0.025, 0.065))]
inside = lathe("CamelliaWater", [(0.027, 0.085), (0.0275, 0.0855)], 12, "node", cap_top=True)
twig = tube("CamelliaTwig", [(0.0, 0.06, 0.0), (0.008, 0.14, 0.004), (0.02, 0.21, 0.006), (0.026, 0.25, 0.006)], 0.0028, "twig")
leaves = []
for k, (t, a, ln) in enumerate(((0.12, 0.6, 0.06), (0.15, 2.6, 0.065), (0.18, 4.2, 0.055), (0.2, 1.4, 0.05), (0.22, 3.6, 0.05))):
    base = Vector((0.006 + 0.08 * (t - 0.12), t, 0.004))
    along = Vector((math.cos(a) * 0.8, 0.45, math.sin(a) * 0.8))
    leaves.append(leaf(f"leaf{k}", base, along, Vector((0, 1, 0)), ln, 0.03, "leaf", cup=0.2))
# (the flower: five cupped petals round, opening outward and up, the stamens' crown in the middle)
fc = Vector((0.028, 0.255, 0.006))
petals = []
for k in range(5):
    a = 2 * math.pi * k / 5 + 0.3
    along = Vector((math.cos(a) * 0.7, 0.75, math.sin(a) * 0.7))
    petals.append(leaf(f"petal{k}", fc, along, Vector((0, 1, 0)), 0.042, 0.04, "petal", cup=0.6))
# (and three smaller inside them, more upright, round the stamens)
for k in range(3):
    a = 2 * math.pi * k / 3 + 1.0
    along = Vector((math.cos(a) * 0.35, 0.95, math.sin(a) * 0.35))
    petals.append(leaf(f"petalIn{k}", fc, along, Vector((math.cos(a), 0, math.sin(a))), 0.03, 0.03, "petal", cup=0.6))
stamen = lathe("stamen", [(0.008, -0.002), (0.009, 0.012), (0.006, 0.016)], 8, "stamen", at=tuple(fc), cap_top=True)
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.011)
for vt in bm.verts:
    vt.co = P(-0.012 + vt.co.x, 0.19 + vt.co.z * 1.4, 0.01 - vt.co.y)
bud = finish_obj("bud", bm, "bud")
camellia = join([vase] + nodes + [inside, twig] + leaves + petals + [stamen, bud], "Camellia")

kokedama.location = P(0.3, 0, 0)
camellia.location = P(0.5, 0, 0)
root = bpy.data.objects.new("WcDecor", None)
bpy.context.collection.objects.link(root)
for o in (lantern, kokedama, camellia):
    o.parent = root
print("WCDECOR_TRIS", {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (lantern, paper, kokedama, camellia)})
if PREVIEW:
    target = P(0.4, 0.14, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.42, 0.42, 0.6)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "wcdecor.glb"), os.path.join(PROJECT, "blender", "wcdecor.blend"), PREVIEW)
print("WCDECOR_DONE")
