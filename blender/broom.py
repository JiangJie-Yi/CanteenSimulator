"""A house broom (座敷箒, broom.glb; the owner's, 2026-11-10: a floor server sweeps up a bottle broken on the floor, broom in hand): a bamboo
handle with two nodes, a fan of golden sorghum straw bound to it at the top with two bands of red cord, its foot cut straight and a little
splayed. About 200 triangles, every part a band of quads (no fan of triangles crowding to a point).

The game's frame: y up, its foot's middle at the origin, its fan across x, its thickness along z; 1.2 m tall (the game scales it to whoever
holds it).

Run:
    blender -b --factory-startup --python blender/broom.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import export_dish, image, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

TALL, HEAD_H = 1.2, 0.32


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


rng = np.random.default_rng(11)
# (the straw: fine upright strands, each its own gold, a darker gap between, ends ragged at the foot)
W, H = 256, 256
u = np.arange(W)[None, :]
v = np.linspace(0, 1, H)[:, None]
strand = rng.random(W)
shade = 0.72 + 0.28 * strand[None, :] + 0.08 * np.sin(u * 0.9 + strand[None, :] * 6)
gaps = (np.sin(u * math.pi * 0.5 + strand[None, :] * 3) > 0.86) * 0.22
straw = np.clip(shade - gaps - 0.12 * (1 - v) ** 6, 0, 1)
straw_rgb = (straw[..., None] * np.array(lin("#c9a253"))[None, None, :] * 1.15).astype(np.float32)
# (the bamboo: a pale green-gold, finely streaked along)
bw = 64
bamboo = np.clip(0.86 + 0.1 * np.sin(np.arange(bw)[None, :] * 1.7) + rng.normal(0, 0.03, (bw, bw)), 0, 1)
bamboo_rgb = (bamboo[..., None] * np.array(lin("#c8b56a"))[None, None, :]).astype(np.float32)
M = {
    "straw": pbr("BroomStraw", (1, 1, 1), tex=image("broom_straw", straw_rgb), rough=0.85),
    "bamboo": pbr("BroomBamboo", (1, 1, 1), tex=image("broom_bamboo", bamboo_rgb), rough=0.45),
    "node": pbr("BroomNode", lin("#9a8240"), rough=0.5),
    "cord": pbr("BroomCord", lin("#b8261c"), rough=0.7),
}
parts = []


def loft(name, rings, seg, mat, close_top=False, uv_v=None):
    """A band of quads through rings of points (each a list of (x, y, z) in the game's frame, `seg` round), its UVs round and along"""
    bm = bmesh.new()
    vs = [[bm.verts.new(P(*p)) for p in ring] for ring in rings]
    uvl = bm.loops.layers.uv.new()
    for i in range(len(rings) - 1):
        for j in range(seg):
            a, b = vs[i][j], vs[i][(j + 1) % seg]
            c, d = vs[i + 1][(j + 1) % seg], vs[i + 1][j]
            f = bm.faces.new((a, b, c, d))
            for lp, (uu, vv) in zip(f.loops, ((j / seg, i), ((j + 1) / seg, i), ((j + 1) / seg, i + 1), (j / seg, i + 1))):
                lp[uvl].uv = (uu, (uv_v[vv] if uv_v else vv / (len(rings) - 1)))
    if close_top:
        f = bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def ellipse(y, rx, rz, seg, dx=0.0):
    return [(dx + rx * math.cos(2 * math.pi * k / seg), y, rz * math.sin(2 * math.pi * k / seg)) for k in range(seg)]


# the fan of straw: flat and wide at its foot, drawn in to the handle at its top, a little bowed
HEAD = [(0.0, 0.135, 0.016), (0.1, 0.12, 0.018), (0.2, 0.085, 0.02), (0.27, 0.05, 0.02), (HEAD_H, 0.03, 0.019)]
head = loft("BroomHead", [ellipse(y, rx, rz, 10) for y, rx, rz in HEAD], 10, "straw", uv_v=[0, 0.3, 0.62, 0.84, 1])
# (its foot closed: a ladder of quads across it, made by export_dish from the n-gon)
bm = bmesh.new()
bm.from_mesh(head.data)
bm.verts.ensure_lookup_table()
foot = [v for v in bm.verts if abs(v.co.z) < 1e-6]
if len(foot) >= 3:
    foot.sort(key=lambda v: math.atan2(v.co.y, v.co.x))
    bm.faces.new(foot)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(head.data)
bm.free()
# the handle: a bamboo pole from inside the straw's top to the broom's top, two nodes along it
R = 0.011
pole = loft("BroomHandle", [ellipse(y, R, R, 6) for y in (HEAD_H - 0.05, 0.75, TALL)], 6, "bamboo", close_top=True)
for k, y in enumerate((0.62, 0.95)):
    loft(f"BroomNode{k}", [ellipse(y - 0.006, R * 1.18, R * 1.18, 6), ellipse(y, R * 1.32, R * 1.32, 6), ellipse(y + 0.006, R * 1.18, R * 1.18, 6)], 6, "node")
# the binding: two bands of red cord round the straw's top
for k, y in enumerate((0.255, 0.3)):
    rx = np.interp(y, [h[0] for h in HEAD], [h[1] for h in HEAD]) + 0.004
    rz = np.interp(y, [h[0] for h in HEAD], [h[2] for h in HEAD]) + 0.004
    loft(f"BroomCord{k}", [ellipse(y - 0.008, rx, rz, 10), ellipse(y + 0.008, rx, rz, 10)], 10, "cord")

root = bpy.data.objects.new("Broom", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("BROOM_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.4, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 0.9, 1.5)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "broom.glb"), os.path.join(PROJECT, "blender", "broom.blend"), PREVIEW)
print("BROOM_DONE")
