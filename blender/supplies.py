"""The supplies in the corner by the drinks fridge (the owner's: tissue cartons and cleaning things, for the toilets and about the shop):
supplies.glb, node "CornerSupplies".

Two corrugated cartons of tissue boxes stacked (taped shut, the upper one turned a little), a twelve-roll pack of toilet paper on top, a
blue bucket in front, and a carton of cleaning things (the owner's: the detergents boxed, not stood about loose; the mop and the broom gone).
The cartons' print is the game's ("SupplyCartonPrint", 1536 x 512): each carton laid out on it as a flat dieline at one scale, 750 px to the
metre, so what's printed keeps its shape on every face (the owner saw the words run off the edges: a face was squeezed into a cell of
another shape): its front (its back the same) and one end side by side along the top of its piece, its top under them; the pieces side by
side, the two tissue cartons and then the cleaning one (CARTON_PIECES below, which the game's painter follows).

The game's frame (y up), its back to the wall at z = 0 (facing +z), along the wall x, the floor at y = 0; about 0.9 along, 0.4 out, real
size (metres), about half a metre along it.

Run:
    blender -b --factory-startup --python blender/supplies.py -- <project path> [preview.png]
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


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {
    "print": pbr("SupplyCartonPrint", (1, 1, 1), rough=0.85),
    "tape": pbr("SupplyTape", lin("#c9a46a"), rough=0.35),
    "roll": pbr("SupplyRoll", lin("#f4f2ec"), rough=0.9),
    "rollcore": pbr("SupplyRollCore", lin("#b89a6a"), rough=0.9),
    "wrap": pbr("SupplyWrapBand", lin("#3a78c8"), rough=0.5),
    "bucket": pbr("SupplyBucket", lin("#2f78c4"), rough=0.4),
    "bucketin": pbr("SupplyBucketInside", lin("#1f4f86"), rough=0.5),
    "handle": pbr("SupplyHandle", lin("#c8a26a"), rough=0.55),
    "mop": pbr("SupplyMopHead", lin("#d8d4c8"), rough=0.95),
    "broom": pbr("SupplyBroomHead", lin("#b8954a"), rough=0.9),
    "bamboo": pbr("SupplyBamboo", lin("#9aa860"), rough=0.5),
    "bottleW": pbr("SupplyBottleWhite", lin("#eef2f4"), rough=0.3),
    "bottleP": pbr("SupplyBottlePink", lin("#f0a0b8"), rough=0.3),
    "trigger": pbr("SupplyTrigger", lin("#2a5aa8"), rough=0.4),
    "jug": pbr("SupplyJug", lin("#5ab060"), rough=0.35),
    "cap": pbr("SupplyCap", lin("#f2c040"), rough=0.4),
    "label": pbr("SupplyLabel", lin("#f6f2e6"), rough=0.6),
}
parts = []


def fin(o, mat, smooth=True):
    o.data.materials.clear()
    o.data.materials.append(M[mat])
    for pg in o.data.polygons:
        pg.use_smooth = smooth
    parts.append(o)
    return o


PX, TW, TH = 750.0, 1536.0, 512.0
CARTON_PIECES = []


def carton(name, cx, y0, cz, w, d, h, yaw, px0):
    """a corrugated carton, taped shut: its faces laid out on the print as a dieline from `px0` along it (front and back on one piece W x H,
    the ends on one D x H beside it, the top W x D under them; the bottom on a corner of the top), one scale for all; a strip of tape over
    its top and down its ends"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    hw, hd = w / 2, d / 2
    corners = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]

    def at(x, y, z):
        c, s = math.cos(yaw), math.sin(yaw)
        return P(cx + x * c + z * s, y0 + y, cz - x * s + z * c)
    # (the pieces, in the print's pixels from its top left: front x0..x0+W, end beside it, top under the front)
    W, D, H = w * PX, d * PX, h * PX
    front = (px0, 0.0, px0 + W, H)
    end = (px0 + W, 0.0, px0 + W + D, H)
    top = (px0, H, px0 + W, H + D)
    CARTON_PIECES.append((name, px0, W, D, H))
    # (each face's corners in its own order: bottom left, bottom right, top right, top left as seen from outside it; the top's "bottom" its
    # front edge)
    faces = [
        ([(-hw, 0, hd), (hw, 0, hd), (hw, h, hd), (-hw, h, hd)], front),       # front (+z)
        ([(hw, 0, -hd), (-hw, 0, -hd), (-hw, h, -hd), (hw, h, -hd)], front),   # back
        ([(hw, 0, hd), (hw, 0, -hd), (hw, h, -hd), (hw, h, hd)], end),         # end (+x)
        ([(-hw, 0, -hd), (-hw, 0, hd), (-hw, h, hd), (-hw, h, -hd)], end),     # end (-x)
        ([(-hw, h, hd), (hw, h, hd), (hw, h, -hd), (-hw, h, -hd)], top),       # top
        ([(-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd)], (px0, H + D - 8, px0 + 8, H + D)),  # bottom
    ]
    for pts, (x0, ya, x1, yb) in faces:
        vs = [bm.verts.new(at(*p)) for p in pts]
        f = bm.faces.new(vs)
        # (the picture's v runs up from its foot: a face's foot is the piece's lower edge (yb), its top the upper (ya))
        for lp, (uu, vv) in zip(f.loops, ((x0, yb), (x1, yb), (x1, ya), (x0, ya))):
            lp[uvl].uv = (uu / TW, 1 - vv / TH)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    fin(o, "print", smooth=False)
    # (the tape: over the top's middle and down both ends)
    tb = bmesh.new()
    tw = 0.05
    for (x0, x1, y0_, y1_, z0, z1) in ((-hw - 0.001, hw + 0.001, h, h + 0.002, -tw / 2, tw / 2),
                                         (hw, hw + 0.002, h - 0.08, h, -tw / 2, tw / 2), (-hw - 0.002, -hw, h - 0.08, h, -tw / 2, tw / 2)):
        bmesh.ops.create_cube(tb, size=1.0)
        new = tb.verts[-8:]
        for v in new:
            v.co = at(x0 + (x1 - x0) * (v.co.x + 0.5), y0_ + (y1_ - y0_) * (v.co.z + 0.5), z0 + (z1 - z0) * (v.co.y + 0.5))
    me = bpy.data.meshes.new(name + "Tape")
    tb.to_mesh(me)
    tb.free()
    t = bpy.data.objects.new(name + "Tape", me)
    bpy.context.collection.objects.link(t)
    fin(t, "tape", smooth=False)
    return o


def cyl(name, mat, x, y0, z, r0, r1, h, segs=16, cap=True):
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r0, radius2=r1, depth=h, location=P(x, y0 + h / 2, z), end_fill_type="NGON" if cap else "NOTHING")
    o = bpy.context.view_layer.objects.active
    o.name = name
    return fin(o, mat)


def stick(name, mat, a, b, r, segs=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=d.length, location=P(*((a + b) / 2)))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    return fin(o, mat)


# ---- stacked to fit the narrow gap between the drinks fridge and the toilets' door (about half a metre along the wall): the cartons
# against the wall, the pack of rolls on top of them, the bucket and the carton of cleaning things in front of them
carton("SupplyCarton0", 0.0, 0.0, 0.17, 0.44, 0.31, 0.27, 0.0, 4.0)
carton("SupplyCarton1", 0.01, 0.27, 0.17, 0.4, 0.29, 0.24, 0.08, 4.0 + (0.44 + 0.31) * PX + 10)
carton("SupplyCarton2", 0.15, 0.0, 0.47, 0.26, 0.2, 0.22, -0.1, 4.0 + (0.44 + 0.31 + 0.4 + 0.29) * PX + 20)
for i in range(3):
    for j in range(2):
        for k in range(2):
            x, z = -0.105 + i * 0.105, 0.115 + j * 0.105
            cyl(f"SupplyRoll{i}{j}{k}", "roll", x, 0.51 + k * 0.1, z, 0.05, 0.05, 0.1, segs=14)
            cyl(f"SupplyRollCore{i}{j}{k}", "rollcore", x, 0.51 + k * 0.1 + 0.0995, z, 0.018, 0.018, 0.0012, segs=10)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0.0, 0.61, 0.1675))
band = bpy.context.view_layer.objects.active
band.name = "SupplyWrapBand"
band.scale = (0.316, 0.216, 0.05)
bpy.ops.object.transform_apply(scale=True)
fin(band, "wrap", smooth=False)
bx, bz = -0.15, 0.52
cyl("SupplyBucket", "bucket", bx, 0.0, bz, 0.12, 0.15, 0.27, segs=20, cap=False)
cyl("SupplyBucketFloor", "bucketin", bx, 0.003, bz, 0.118, 0.118, 0.003, segs=20)
stick("SupplyBucketBail", "handle", (bx - 0.15, 0.27, bz), (bx + 0.15, 0.27, bz), 0.004, 6)

root = bpy.data.objects.new("CornerSupplies", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("SUPPLIES_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
print("CARTON_PIECES", [(n, round(x), round(w), round(d), round(h)) for n, x, w, d, h in CARTON_PIECES])
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.0, 0.35, 0.15)
    cam.location = P(0.9, 1.2, 2.0)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.7, 0.2, 0.6)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "supplies.glb"), os.path.join(PROJECT, "blender", "supplies.blend"), PREVIEW)
print("SUPPLIES_DONE")
