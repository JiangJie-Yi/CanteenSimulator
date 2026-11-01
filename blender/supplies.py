"""The supplies in the corner by the drinks fridge (the owner's: tissue cartons and cleaning things, for the toilets and about the shop):
supplies.glb, node "CornerSupplies".

Two corrugated cartons of tissue boxes stacked (taped shut, the upper one turned a little; their print, 衛生紙 and what's in them, is the
game's: their faces UV'd onto one picture, "SupplyCartonPrint"), a twelve-roll pack of toilet paper on the floor beside them, and the cleaning
things against the wall: a blue bucket with a string mop stood in it, a broom (a straw head on a bamboo handle), two trigger spray bottles and
a jug of detergent.

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


def carton(name, cx, y0, cz, w, d, h, yaw, cell):
    """a corrugated carton, taped shut: its four sides and top UV'd onto the print picture's cell `cell` (of four across, two up: the long
    sides in the cell's top half, the ends and the top below), its edges a touch rounded; a strip of tape over its top and down its ends"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    hw, hd = w / 2, d / 2
    corners = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]

    def at(x, y, z):
        c, s = math.cos(yaw), math.sin(yaw)
        return P(cx + x * c + z * s, y0 + y, cz - x * s + z * c)
    cu, cv = (cell % 4) / 4, (cell // 4) / 2
    # (each face: the cell's left half the front/back, right half the ends; the top along the cell's foot)
    faces = [
        ([(-hw, 0, hd), (hw, 0, hd), (hw, h, hd), (-hw, h, hd)], (0.0, 0.3, 0.5, 1.0)),       # front (+z)
        ([(hw, 0, -hd), (-hw, 0, -hd), (-hw, h, -hd), (hw, h, -hd)], (0.0, 0.3, 0.5, 1.0)),   # back
        ([(hw, 0, hd), (hw, 0, -hd), (hw, h, -hd), (hw, h, hd)], (0.5, 0.3, 1.0, 1.0)),       # end (+x)
        ([(-hw, 0, -hd), (-hw, 0, hd), (-hw, h, hd), (-hw, h, -hd)], (0.5, 0.3, 1.0, 1.0)),   # end (-x)
        ([(-hw, h, hd), (hw, h, hd), (hw, h, -hd), (-hw, h, -hd)], (0.0, 0.0, 1.0, 0.3)),     # top
        ([(-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd)], (0.0, 0.0, 0.1, 0.1)),     # bottom
    ]
    for pts, (u0, v0, u1, v1) in faces:
        vs = [bm.verts.new(at(*p)) for p in pts]
        f = bm.faces.new(vs)
        for lp, (uu, vv) in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
            lp[uvl].uv = (cu + uu / 4, cv + vv / 2)
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
# against the wall, the pack of rolls on top of them, the bucket and mop in front of them, the broom leant beside, the bottles at the side
carton("SupplyCarton0", 0.0, 0.0, 0.17, 0.44, 0.31, 0.27, 0.0, 0)
carton("SupplyCarton1", 0.01, 0.27, 0.17, 0.4, 0.29, 0.24, 0.08, 1)
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
bx, bz = -0.1, 0.5
cyl("SupplyBucket", "bucket", bx, 0.0, bz, 0.12, 0.15, 0.27, segs=20, cap=False)
cyl("SupplyBucketFloor", "bucketin", bx, 0.003, bz, 0.118, 0.118, 0.003, segs=20)
stick("SupplyBucketBail", "handle", (bx - 0.15, 0.27, bz), (bx + 0.15, 0.27, bz), 0.004, 6)
stick("SupplyMopHandle", "handle", (bx + 0.02, 0.06, bz), (bx - 0.06, 1.25, 0.035), 0.012, 8)
for k in range(14):
    a = 2 * math.pi * k / 14
    stick(f"SupplyMopStrand{k}", "mop", (bx + 0.02 + 0.02 * math.cos(a), 0.22, bz + 0.02 * math.sin(a)),
          (bx + 0.02 + 0.08 * math.cos(a), 0.06, bz + 0.08 * math.sin(a)), 0.012, 5)
stick("SupplyBroomHandle", "bamboo", (0.2, 0.2, 0.46), (0.23, 1.3, 0.035), 0.012, 8)
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.11, radius2=0.035, depth=0.22, location=P(0.195, 0.11, 0.48))
head = bpy.context.view_layer.objects.active
head.name = "SupplyBroomHead"
head.scale = (1.0, 0.35, 1.0)
bpy.ops.object.transform_apply(scale=True)
fin(head, "broom")
for k, (x, mat) in enumerate(((0.07, "bottleW"), (0.14, "bottleP"))):
    cyl(f"SupplySpray{k}", mat, x, 0.0, 0.4, 0.035, 0.03, 0.2, segs=14)
    cyl(f"SupplySprayNeck{k}", "trigger", x, 0.2, 0.4, 0.016, 0.014, 0.03, segs=10)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(x, 0.245, 0.415))
    t = bpy.context.view_layer.objects.active
    t.name = f"SupplyTrigger{k}"
    t.scale = (0.02, 0.035, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    fin(t, "trigger", smooth=False)
    cyl(f"SupplySprayLabel{k}", "label", x, 0.06, 0.4, 0.0355, 0.034, 0.08, segs=14, cap=False)
cyl("SupplyJug", "jug", 0.07, 0.0, 0.5, 0.055, 0.05, 0.22, segs=16)
cyl("SupplyJugCap", "cap", 0.07, 0.22, 0.5, 0.02, 0.018, 0.03, segs=10)
cyl("SupplyJugLabel", "label", 0.07, 0.07, 0.5, 0.0555, 0.054, 0.09, segs=16, cap=False)

root = bpy.data.objects.new("CornerSupplies", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("SUPPLIES_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
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
