"""A koban (小判), the old oval gold coin, standing in a little lacquered stand between the beckoning cats at the door (the owner's, after a
Sketchfab model they pointed to, only looked at): koban.glb, node "Koban".

The coin: an oval, a good deal taller than wide, its edge rounded, a narrow raised rim round each face and the face inside it a hair lower;
a clean low mesh (rings round the oval, a fan at the middle), all its detail painted by the game onto its two faces (the hammer's fine
lines across it (茣蓙目), the paulownia in its fan-shaped frame stamped at top and foot, 壹両 and 光次 with the mint's mark down the middle,
the little stamps on the back) and lit as raised and sunk by a normal map made from the same painting. Its two faces are unwrapped side by
side onto one picture, the front on the left half, the back on the right, each as wide and tall as the coin is (so the painting isn't
squashed); its edge on a plain gold strip at the picture's foot.
The stand: a low block of black lacquer with rounded edges, the coin's foot sunk into a slot in it, the coin leaning back a little.

The game's frame (y up), the stand's foot's middle at the origin, the coin's front toward +z; sizes in the shop's units (its cats are 0.44
and 0.5 tall): the coin 0.075 across, 0.14 tall.

Run:
    blender -b --factory-startup --python blender/koban.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


W, H, T = 0.075, 0.14, 0.0055      # the coin: across, tall, thick
RIM = 0.0042                        # the raised rim's width, in from the edge
SINK = 0.0007                       # how far the face lies below the rim
N = 48                              # points round the oval
STAND = (0.10, 0.026, 0.044)        # the stand: along, tall, deep
LEAN = math.radians(6)              # the coin leans back this much
FOOT = 0.012                        # and its foot is this far down in the stand's slot
M = {
    # (the coin's picture is the game's: plain here, its UVs what matter)
    "gold": pbr("KobanGold", (0.9, 0.7, 0.3), rough=0.3, metal=1.0),
    "lacquer": pbr("KobanLacquer", (0.05, 0.035, 0.03), rough=0.25),
}
parts = []


def oval(k, s):
    """the oval's point k (of N) scaled by s (1 the edge): (x, y) about its middle"""
    a = 2 * math.pi * k / N
    return (s * W / 2 * math.sin(a), s * H / 2 * math.cos(a))


def coin():
    """rings round the oval on each face (the edge's rounding, the rim, the face sunk inside it, a little doming toward the middle), the
    two faces joined by the rounded edge; each face's UVs where the picture's cell for it has that point (front left, back right,
    mirrored, so the back reads the right way round from behind); the edge's on the plain strip"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    # (each ring: its scale of the oval, its height off the middle plane (a share of half the thickness))
    rim_in = 1 - 2 * RIM / W
    rings = [(1.0, 0.55), (0.985, 0.92), (0.965, 1.0), (rim_in + 0.012, 1.0), (rim_in, 1 - SINK / (T / 2)), (0.62, 1 - SINK / (T / 2) + 0.05),
             (0.3, 1 - SINK / (T / 2) + 0.08)]
    faces_by_side = {}
    for side in (1, -1):
        rows = []
        for s, h in rings:
            rows.append([bm.verts.new(P(*oval(k, s), side * h * T / 2)) for k in range(N)])
        centre = bm.verts.new(P(0, 0, side * (1 - SINK / (T / 2) + 0.09) * T / 2))
        faces_by_side[side] = (rows, centre)

    def uv_of(v, side):
        x, y = v.co.x, v.co.z   # (Blender's x is the game's x, its z the game's y)
        u = x / W + 0.5
        if side < 0:
            u = 1 - u
        # (the cell: the coin's width of the picture across, its height up; the cells side by side over the picture's top, the edge's
        # strip under them)
        return (0.5 * u + (0.5 if side < 0 else 0.0), 0.08 + 0.92 * (y / H + 0.5))

    for side in (1, -1):
        rows, centre = faces_by_side[side]
        for r in range(len(rows) - 1):
            for k in range(N):
                q = [rows[r][k], rows[r][(k + 1) % N], rows[r + 1][(k + 1) % N], rows[r + 1][k]]
                if side < 0:
                    q.reverse()
                f = bm.faces.new(q)
                f.material_index = 0
                for lp in f.loops:
                    lp[uvl].uv = uv_of(lp.vert, side)
        for k in range(N):
            q = [rows[-1][k], rows[-1][(k + 1) % N], centre]
            if side < 0:
                q.reverse()
            f = bm.faces.new(q)
            for lp in f.loops:
                lp[uvl].uv = uv_of(lp.vert, side)
    # (the edge: the two faces' outer rings joined, its UVs along the strip at the picture's foot)
    front, back = faces_by_side[1][0][0], faces_by_side[-1][0][0]
    for k in range(N):
        q = [front[(k + 1) % N], front[k], back[k], back[(k + 1) % N]]
        f = bm.faces.new(q)
        for lp, (u, v) in zip(f.loops, [((k + 1) / N, 0.06), (k / N, 0.06), (k / N, 0.01), ((k + 1) / N, 0.01)]):
            lp[uvl].uv = (u, v)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("KobanCoin")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("KobanCoin", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["gold"])
    for pg in o.data.polygons:
        pg.use_smooth = True
    # (stood in its stand: its foot down in the slot, leaning back)
    o.location = P(0, H / 2 + STAND[1] - FOOT, 0.002)
    o.rotation_euler = (-LEAN, 0, 0)
    parts.append(o)
    return o


def stand():
    """the stand: a low block of black lacquer, its edges rounded (a bevel), the coin's foot in a slot in its top"""
    sx, sy, sz = STAND
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, sy / 2, 0))
    o = bpy.context.view_layer.objects.active
    o.name = "KobanStand"
    o.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = o.modifiers.new("Round", "BEVEL")
    bev.width = 0.004
    bev.segments = 3
    bev.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=bev.name)
    o.data.materials.append(M["lacquer"])
    for pg in o.data.polygons:
        pg.use_smooth = True
    parts.append(o)
    # (a thin gold line round its top, as lacquerware has)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, sy - 0.0045, 0))
    line = bpy.context.view_layer.objects.active
    line.name = "KobanStandLine"
    line.scale = (sx + 0.0012, sz + 0.0012, 0.0016)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    line.data.materials.append(M["gold"])
    parts.append(line)
    return o


coin()
stand()
root = bpy.data.objects.new("Koban", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("KOBAN_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0, 0.085, 0)
    cam.location = P(0.08, 0.13, 0.32)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "koban.glb"), os.path.join(PROJECT, "blender", "koban.blend"), PREVIEW)
print("KOBAN_DONE")
