"""The kitchen's sink (流し台): sink.glb, node "Sink". A shop kitchen's stainless sink on four square legs with a shelf under it: one deep
basin to the left, a ribbed draining board to the right with a wire dish rack on it (three plates standing in it, a bowl upside down), a
splashback along the back, a gooseneck tap over the basin with its two handles, a sponge on the deck and a bottle of washing-up liquid.

The game's frame, its own size in metres (the room's units): y up, 1.1 across (x), 0.6 deep (z), its deck 0.85 up; its front (the side
the washer stands at) toward +z, the middle of its foot at the origin.

Nodes the game finds: SinkSpoutTip (where the water comes out), SinkBasinFloor (the middle of the basin's floor: the dirty plates are set
down there), SinkRackSlot0..2 (where a washed plate stands in the rack).

Run:
    blender -b --factory-startup --python blender/sink.py -- <project path> [preview.png]
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

W, D, H = 1.1, 0.6, 0.85        # across, deep, the deck's top
T = 0.03                        # the deck's thickness
BASIN = (-0.47, -0.03, -0.17, 0.19)   # its opening: x from, x to, z from (back), z to (front)
BASIN_DEEP = 0.25
SPLASH = 0.16                   # the splashback's height over the deck


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "steel": pbr("SinkSteel", lin("#c9cdd2"), rough=0.32, metal=1.0),
    "basin": pbr("SinkBasin", lin("#a9afb6"), rough=0.38, metal=1.0),
    "drain": pbr("SinkDrain", lin("#2b2d31"), rough=0.5, metal=0.6),
    "wire": pbr("SinkWire", lin("#dfe3e8"), rough=0.18, metal=1.0),
    "rubber": pbr("SinkRubber", lin("#2a2a2c"), rough=0.8),
    "plate": pbr("SinkPlate", lin("#f4f1ea"), rough=0.3),
    "rim": pbr("SinkPlateRim", lin("#2c4f8a"), rough=0.3),
    "sponge": pbr("SinkSponge", lin("#f2c230"), rough=0.9),
    "scour": pbr("SinkScour", lin("#2f7a3a"), rough=0.95),
    "bottle": pbr("SinkBottle", lin("#46a356"), rough=0.2),
    "cap": pbr("SinkCap", lin("#f2f2f0"), rough=0.4),
    "handle": pbr("SinkHandle", lin("#e9edf1"), rough=0.15, metal=1.0),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, seg=2):
    """a box from its extents (the game's frame); bevelled along its edges if bev"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, seg)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    finish(o, name, M[mat], smooth_shade=bool(bev))
    parts.append(o)
    return o


def cyl(name, x, y0, y1, z, r, mat, seg=12, axis="y"):
    """a cylinder from y0 to y1 at (x, z) (or along x / z: then y0, y1 run that way and (x, z) is the other two)"""
    if axis == "y":
        loc, rot, depth = P(x, (y0 + y1) / 2, z), (0, 0, 0), y1 - y0
    elif axis == "x":
        loc, rot, depth = P((y0 + y1) / 2, x, z), (0, math.pi / 2, 0), y1 - y0
    else:
        loc, rot, depth = P(x, z, (y0 + y1) / 2), (math.pi / 2, 0, 0), y1 - y0
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc, rotation=rot)
    o = active()
    finish(o, name, M[mat])
    for p in o.data.polygons:
        p.use_smooth = abs(p.normal.dot(Vector((0, 0, 1) if axis == "y" else (1, 0, 0) if axis == "x" else (0, 1, 0)))) < 0.9
    parts.append(o)
    return o


def tube(name, pts, r, mat, res=4, sides=8):
    """a round rod along the points (the game's frame), as a curve made a mesh"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(1, sides // 4 - 1)
    cu.resolution_u = res
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = P(*p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = active()
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def lathe(name, prof, mat_of, seg=20, at=(0, 0, 0), tilt=(0, 0, 0)):
    """a turned shape from its profile (radius, height) pairs, each band its own material (mat_of(i) for the band from point i)"""
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        if r < 1e-5:
            rings.append([bm.verts.new((0, 0, y))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), y)) for k in range(seg)])
    mats_used = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        mname = mat_of(i)
        if mname not in mats_used:
            mats_used.append(mname)
        mi = mats_used.index(mname)
        for k in range(seg):
            k2 = (k + 1) % seg
            if len(a) == 1:
                f = bm.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                f = bm.faces.new((a[k], b[0], a[k2]))
            else:
                f = bm.faces.new((a[k], b[k], b[k2], a[k2]))
            f.material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for mname in mats_used:
        o.data.materials.append(M[mname])
    for p in o.data.polygons:
        p.use_smooth = True
    o.rotation_euler = tilt
    o.location = P(*at)
    parts.append(o)
    return o


def empty(name, x, y, z):
    e = bpy.data.objects.new(name, None)
    e.location = P(x, y, z)
    bpy.context.collection.objects.link(e)
    parts.append(e)
    return e


# ---- the stand: four square legs on rubber feet, a shelf low between them ----
LEG = 0.04
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * (W / 2 - 0.05), sz * (D / 2 - 0.06)
        box(f"SinkLeg{sx}{sz}", x - LEG / 2, x + LEG / 2, 0.025, H - T, z - LEG / 2, z + LEG / 2, "steel", bev=0.006, seg=2)
        cyl(f"SinkFoot{sx}{sz}", x, 0.0, 0.03, z, 0.022, "rubber", seg=10)
box("SinkShelf", -W / 2 + 0.06, W / 2 - 0.06, 0.15, 0.17, -D / 2 + 0.07, D / 2 - 0.07, "steel", bev=0.004, seg=1)
# (the shelf's rim turned down along its front and back)
for sz in (-1, 1):
    box(f"SinkShelfRim{sz}", -W / 2 + 0.06, W / 2 - 0.06, 0.13, 0.17, sz * (D / 2 - 0.07) - 0.006, sz * (D / 2 - 0.07) + 0.006, "steel")

# ---- the deck, round its basin: the strips before, behind and either side, the draining board to the right ----
bx0, bx1, bz0, bz1 = BASIN
y0, y1 = H - T, H
box("SinkDeckFront", -W / 2, W / 2, y0, y1, bz1, D / 2 - 0.02, "steel")
box("SinkDeckBack", -W / 2, W / 2, y0, y1, -D / 2, bz0, "steel")
box("SinkDeckLeft", -W / 2, bx0, y0, y1, bz0, bz1, "steel")
box("SinkDeckRight", bx1, W / 2, y0, y1, bz0, bz1, "steel")
# (its front edge rolled over, a bull nose the length of it)
cyl("SinkNose", 0, -W / 2, W / 2, D / 2 - 0.02, 0.02, "steel", seg=12, axis="x").location = P(0, H - 0.02, D / 2 - 0.02)
# (the draining board's ribs, raised a little, running toward the basin)
for k in range(7):
    z = bz0 + 0.04 + k * (bz1 - bz0 - 0.08) / 6
    box(f"SinkRib{k}", bx1 + 0.06, W / 2 - 0.05, H, H + 0.004, z - 0.004, z + 0.004, "steel", bev=0.002, seg=1)
# (the splashback up the back, a lip turned over its top)
box("SinkSplash", -W / 2, W / 2, H, H + SPLASH, -D / 2, -D / 2 + 0.02, "steel")
box("SinkSplashLip", -W / 2, W / 2, H + SPLASH - 0.012, H + SPLASH, -D / 2, -D / 2 + 0.045, "steel", bev=0.004, seg=2)
# (the deck's sides closed, a skirt down its front)
box("SinkSkirt", -W / 2, W / 2, H - 0.11, H - T, D / 2 - 0.035, D / 2 - 0.025, "steel")

# ---- the basin: its walls down from the opening's edge to a floor, the corners rounded; a drain in the floor ----
bm = bmesh.new()
cr, n = 0.03, 4


def rrect(y, inset):
    pts = []
    hx, hz = (bx1 - bx0) / 2 - inset, (bz1 - bz0) / 2 - inset
    cx, cz = (bx0 + bx1) / 2, (bz0 + bz1) / 2
    r = cr
    for qx, qz, a0 in ((hx - r, hz - r, 0.0), (-(hx - r), hz - r, 0.5 * math.pi), (-(hx - r), -(hz - r), math.pi), (hx - r, -(hz - r), 1.5 * math.pi)):
        for k in range(n + 1):
            a = a0 + 0.5 * math.pi * k / n
            pts.append(bm.verts.new(P(cx + qx + r * math.cos(a), y, cz + qz + r * math.sin(a))))
    return pts


top = rrect(H, 0.0)
lip = rrect(H - 0.012, 0.0)
low = rrect(H - BASIN_DEEP + 0.03, 0.01)
bot = rrect(H - BASIN_DEEP, 0.03)
for ra, rb in ((top, lip), (lip, low), (low, bot)):
    m = len(ra)
    for k in range(m):
        k2 = (k + 1) % m
        bm.faces.new((ra[k], ra[k2], rb[k2], rb[k]))
c = bm.verts.new(P((bx0 + bx1) / 2, H - BASIN_DEEP, (bz0 + bz1) / 2))
m = len(bot)
for k in range(m):
    bm.faces.new((bot[k], bot[(k + 1) % m], c))
# (seen from above, from inside: every face turned to face the basin's middle)
inside = P((bx0 + bx1) / 2, H - BASIN_DEEP / 2, (bz0 + bz1) / 2)
bm.normal_update()
for f in bm.faces:
    if (f.calc_center_median() - inside).dot(f.normal) > 0:
        f.normal_flip()
me = bpy.data.meshes.new("SinkBasin")
bm.to_mesh(me)
bm.free()
basin = bpy.data.objects.new("SinkBasin", me)
bpy.context.collection.objects.link(basin)
basin.data.materials.append(M["basin"])
for p in basin.data.polygons:
    p.use_smooth = True
parts.append(basin)
cyl("SinkDrainPlate", (bx0 + bx1) / 2, H - BASIN_DEEP + 0.0005, H - BASIN_DEEP + 0.004, (bz0 + bz1) / 2, 0.045, "drain", seg=20)
cyl("SinkDrainRing", (bx0 + bx1) / 2, H - BASIN_DEEP + 0.004, H - BASIN_DEEP + 0.006, (bz0 + bz1) / 2, 0.05, "wire", seg=20)
empty("SinkBasinFloor", (bx0 + bx1) / 2, H - BASIN_DEEP + 0.006, (bz0 + bz1) / 2)

# ---- the tap: a pillar on the deck behind the basin, a gooseneck over it, a handle either side ----
TX, TZ = (bx0 + bx1) / 2, -D / 2 + 0.085
cyl("SinkTapBase", TX, H, H + 0.03, TZ, 0.028, "handle", seg=16)
cyl("SinkTapPillar", TX, H + 0.03, H + 0.24, TZ, 0.014, "handle", seg=12)
neck = tube("SinkTapNeck", [(TX, H + 0.235, TZ), (TX, H + 0.33, TZ + 0.05), (TX, H + 0.31, TZ + 0.17), (TX, H + 0.25, TZ + 0.2)], 0.012, "handle", res=6, sides=8)
cyl("SinkTapNozzle", TX, H + 0.225, H + 0.255, TZ + 0.2, 0.014, "handle", seg=12)
empty("SinkSpoutTip", TX, H + 0.224, TZ + 0.2)
for sx in (-1, 1):
    hx = TX + sx * 0.1
    cyl(f"SinkValve{sx}", hx, H, H + 0.05, TZ, 0.016, "handle", seg=12)
    # (a cross handle on each: four short spokes and a cap, red or blue on it)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        p0 = (hx, H + 0.055, TZ)
        p1 = (hx + 0.035 * math.cos(ang), H + 0.058, TZ + 0.035 * math.sin(ang))
        tube(f"SinkSpoke{sx}{a}", [p0, p1], 0.005, "handle", res=1, sides=6)
    cap = cyl(f"SinkValveCap{sx}", hx, H + 0.05, H + 0.065, TZ, 0.012, "handle", seg=12)
dot_r = pbr("SinkHot", lin("#c4302a"), rough=0.3)
dot_b = pbr("SinkCold", lin("#2a6ab0"), rough=0.3)
for sx, mat in ((-1, dot_r), (1, dot_b)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.007, depth=0.003, location=P(TX + sx * 0.1, H + 0.0665, TZ))
    o = active()
    o.name = f"SinkValveDot{sx}"
    o.data.materials.append(mat)
    parts.append(o)

# ---- the dish rack on the draining board: a wire basket, plates standing in it, a bowl upside down ----
RX0, RX1, RZ0, RZ1 = bx1 + 0.08, W / 2 - 0.04, bz0 + 0.02, bz1 - 0.01
RY = H + 0.012
RH = 0.1
for y in (RY, RY + RH):
    tube(f"SinkRackRing{int(y * 1000)}", [(RX0, y, RZ0), (RX1, y, RZ0), (RX1, y, RZ1), (RX0, y, RZ1), (RX0, y, RZ0)], 0.003, "wire", res=1, sides=5)
for k in range(6):
    x = RX0 + (RX1 - RX0) * k / 5
    for z in (RZ0, RZ1):
        tube(f"SinkRackPost{k}{int(z * 100)}", [(x, RY, z), (x, RY + RH, z)], 0.0025, "wire", res=1, sides=5)
# (the floor's bars across, and the low comb the plates stand in)
for k in range(9):
    z = RZ0 + (RZ1 - RZ0) * (k + 0.5) / 9
    tube(f"SinkRackBar{k}", [(RX0, RY, z), (RX1, RY, z)], 0.0022, "wire", res=1, sides=5)
for k in range(7):
    x = RX0 + 0.05 + k * 0.035
    tube(f"SinkRackTine{k}", [(x, RY, RZ0 + 0.06), (x, RY + 0.06, RZ0 + 0.06), (x, RY + 0.06, RZ1 - 0.05), (x, RY, RZ1 - 0.05)], 0.0022, "wire", res=1, sides=5)

PLATE = [(0.0, 0.0), (0.06, 0.0), (0.075, 0.006), (0.105, 0.016), (0.12, 0.024), (0.115, 0.028), (0.1, 0.02), (0.07, 0.012), (0.0, 0.012)]
for i in range(3):
    x = RX0 + 0.065 + i * 0.07
    o = lathe(f"SinkRackPlate{i}", PLATE, lambda b: "rim" if b in (3, 4, 5) else "plate", seg=20, at=(x, RY + 0.125, (RZ0 + RZ1) / 2 + 0.01),
              tilt=(math.radians(84), 0, math.radians(90 + 6 - i * 4)))
    empty(f"SinkRackSlot{i}", x, RY + 0.125, (RZ0 + RZ1) / 2 + 0.01)
BOWL = [(0.0, 0.0), (0.035, 0.0), (0.04, 0.006), (0.07, 0.03), (0.082, 0.062), (0.079, 0.064), (0.066, 0.034), (0.034, 0.01), (0.0, 0.01)]
lathe("SinkRackBowl", BOWL, lambda b: "rim" if b in (3, 4) else "plate", seg=18, at=(RX1 - 0.09, RY + 0.075, (RZ0 + RZ1) / 2 + 0.03),
      tilt=(math.pi, 0, 0))

# ---- a sponge on the deck by the basin's back corner, and the washing-up liquid at the back on the right ----
box("SinkSponge", bx0 + 0.02, bx0 + 0.11, H, H + 0.026, -D / 2 + 0.035, -D / 2 + 0.095, "sponge", bev=0.006, seg=2)
box("SinkScourPad", bx0 + 0.02, bx0 + 0.11, H + 0.026, H + 0.034, -D / 2 + 0.035, -D / 2 + 0.095, "scour", bev=0.003, seg=1)
BOTTLE = [(0.0, 0.0), (0.03, 0.0), (0.034, 0.008), (0.034, 0.13), (0.026, 0.16), (0.014, 0.175), (0.012, 0.19), (0.0, 0.19)]
lathe("SinkBottle", BOTTLE, lambda b: "cap" if b >= 5 else "bottle", seg=16, at=(W / 2 - 0.07, H, -D / 2 + 0.06))

# ---- put together under one root, the deck's steel joined into one mesh ----
root = bpy.data.objects.new("Sink", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
meshes = [o for o in parts if o.type == "MESH"]
print("SINK_TRIS", sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.75, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 1.7, 1.6)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.5, 0.48, 0.46)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "sink.glb"), os.path.join(PROJECT, "blender", "sink.blend"), PREVIEW)
print("SINK_DONE")
