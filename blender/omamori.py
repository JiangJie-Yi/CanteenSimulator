"""An omamori (御守) for the till's desk (the owner's: 開運招福, after the picture they gave): omamori.glb, node "Omamori".

A brocade pouch, puffed like a little cushion, its shoulders cut in to a flat top, stitched round its edge; a white cord's flower knot
(花結び) on top with a loop to hang it by, the cord's two ends going into the pouch's mouth. The pouch's two faces are unwrapped side by side
onto one picture, its front on the left half, its back on the right (the game paints it: red brocade, cherry blossom and gold waves, a white
label, 開運招福 on it); its edge, round, a strip of the same.

The game's frame (y up), its foot's middle at the origin, its front toward +z; real size (metres): 4.6 cm across, 7.4 cm tall, the knot above.

Run:
    blender -b --factory-startup --python blender/omamori.py -- <project path> [preview.png]
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


W, H, T = 0.046, 0.074, 0.009        # across, tall, thick at its fullest
SHOULDER = 0.011                     # how far the top's corners are cut in (across and down)
M = {
    # (the pouch's picture is the game's: a plain white here, its UVs what matter)
    "pouch": pbr("OmamoriPouch", (1, 1, 1), rough=0.6),
    "cord": pbr("OmamoriCord", (0.97, 0.96, 0.93), rough=0.45),
}
parts = []


def half_width(y):
    """how far the pouch reaches either side at height y: straight sides, its shoulders cut in at 45 degrees to a flat top, its foot's
    corners rounded"""
    hw = W / 2 if y < H - SHOULDER else W / 2 - (y - (H - SHOULDER))
    r = 0.005
    if y < r:
        hw -= r - math.sqrt(max(0.0, r * r - (r - y) ** 2))
    return hw


def pouch(nx=8, ny=14):
    """the pouch: a grid on each face, every row as wide as the outline is there (so its edge is the outline exactly), puffed like a
    cushion, fullest in the middle and rounding down to its edge, where the two faces share their vertices (the seam). Front UVs on the
    picture's left half, back on its right"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    edge = {}

    def vert(i, j, side):
        u, v = -1 + 2 * i / nx, j / ny
        y = v * H
        x = u * half_width(y)
        on_edge = i in (0, nx) or j in (0, ny)
        if on_edge:
            key = (i, j)
            if key not in edge:
                edge[key] = bm.verts.new(P(x, y, 0.0))
            return edge[key], (x, y)
        # (a cushion: full in the middle, rounding down to the seam all round)
        puff = math.sqrt(max(0.0, 1 - abs(u) ** 3)) * math.sqrt(max(0.0, 1 - abs(2 * v - 1) ** 3))
        return bm.verts.new(P(x, y, side * T / 2 * puff)), (x, y)
    for side in (1, -1):
        grid = [[vert(i, j, side) for j in range(ny + 1)] for i in range(nx + 1)]
        for i in range(nx):
            for j in range(ny):
                q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                if side < 0:
                    q.reverse()
                f = bm.faces.new([c[0] for c in q])
                for lp, c in zip(f.loops, q):
                    x, y = c[1]
                    u = (x + W / 2) / W
                    lp[uvl].uv = ((1 - u) * 0.5 + 0.5 if side < 0 else u * 0.5, y / H)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("OmamoriPouch")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("OmamoriPouch", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["pouch"])
    for pg in o.data.polygons:
        pg.use_smooth = True
    parts.append(o)
    return o


def cord(name, pts, r=0.0016, cyclic=False, steps=3):
    """a length of the white cord through `pts` (the game's frame), round, its ends closed"""
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = r
    cd.bevel_resolution = 1
    # (eight round, a few steps a span: a cord a few millimetres long was 600 triangles at five)
    cd.resolution_u = steps
    cd.use_fill_caps = True
    sp = cd.splines.new("BEZIER")
    sp.use_cyclic_u = cyclic
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = P(*p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    o.data.materials.append(M["cord"])
    for pg in o.data.polygons:
        pg.use_smooth = True
    parts.append(o)
    return o


def loop(name, cx, cy, rx, ry, tilt, n=8):
    """a closed loop of the cord: an ellipse round (cx, cy), stood a little off the pouch's face"""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        pts.append((x, y, 0.0015 * math.sin(a + tilt)))
    return cord(name, pts, cyclic=True, steps=2)


pouch()
# (the flower knot on top: a round knot in the middle, a petal loop either side and one above, the hanging loop over it all; the cord's
# two ends down into the pouch's mouth)
kx, ky = 0.0, H + 0.006
bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0042, location=P(kx, ky, 0))
knot = bpy.context.view_layer.objects.active
knot.name = "OmamoriKnot"
knot.scale = (1.0, 0.75, 1.0)
knot.data.materials.append(M["cord"])
for pg in knot.data.polygons:
    pg.use_smooth = True
parts.append(knot)
loop("OmamoriPetalL", kx - 0.0085, ky + 0.001, 0.0065, 0.0042, 0.3)
loop("OmamoriPetalR", kx + 0.0085, ky + 0.001, 0.0065, 0.0042, 1.2)
loop("OmamoriPetalT", kx, ky + 0.0075, 0.0042, 0.0055, 2.0)
cord("OmamoriHang", [(kx - 0.002, ky + 0.012, 0), (kx - 0.009, ky + 0.024, 0.001), (kx, ky + 0.031, 0.0015), (kx + 0.009, ky + 0.024, 0.001), (kx + 0.002, ky + 0.012, 0)])
cord("OmamoriTails", [(kx - 0.003, ky - 0.002, 0.001), (kx - 0.0035, H - 0.004, 0.0012)])
cord("OmamoriTails2", [(kx + 0.003, ky - 0.002, 0.001), (kx + 0.0035, H - 0.004, 0.0012)])

root = bpy.data.objects.new("Omamori", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("OMAMORI_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0, 0.045, 0)
    cam.location = P(0.05, 0.08, 0.16)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "omamori.glb"), os.path.join(PROJECT, "blender", "omamori.blend"), PREVIEW)
print("OMAMORI_DONE")
