"""The till's order tablet: a tablet of the iPad kind (flat aluminium sides, rounded corners, a thin even black border round the screen, the
front camera on the long edge, the top button and volume keys, speaker grilles and a USB-C port on the short edges, the camera on the back)
on an aluminium folding stand (a weighted base, a hinged back arm, a ledge with rubber pads the tablet rests on). No maker's mark.

Run:
    blender -b --factory-startup --python blender/ipad.py -- <project path> [preview.png]
Writes public/models/ipad.glb and blender/ipad.blend.

Frame: built in the game's frame (three.js +y up), as GuestBar3D's till group had it: the stand's middle at the origin, the screen toward
+z (the cashier). Blender gets (x, -z, y). Node names the game looks for:
    IpadScreen  the screen (its texture is the game's order screen; UV 0..1 over it)
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

seed(3)
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    """three.js (x, y, z) -> Blender"""
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


N = 128
brushed = fbm(N, 2, 48, 3)
alu_tex = image("alu", mix((0.78, 0.79, 0.81), (0.86, 0.87, 0.89), brushed))
M = {
    "alu": pbr("IpadAlu", (1, 1, 1), tex=alu_tex, rough=0.35, metal=0.8),
    "stand": pbr("IpadStand", lin("#a9adb3"), rough=0.4, metal=0.8),
    "glass": pbr("IpadGlass", lin("#0b0c0e"), rough=0.08),
    "screen": pbr("IpadScreen", (1, 1, 1), rough=0.1),
    "dark": pbr("IpadDark", lin("#1a1b1e"), rough=0.4),
    "lens": pbr("IpadLens", lin("#0d0f14"), rough=0.04, metal=0.2),
    "ring": pbr("IpadRing", lin("#3a3c40"), rough=0.3, metal=0.9),
    "iris": pbr("IpadIris", lin("#2a3a66"), rough=0.1, metal=0.5),
    "flash": pbr("IpadFlashGlass", lin("#e8e0c8"), rough=0.2),
    "rubber": pbr("IpadRubber", lin("#2a2b2e"), rough=0.8),
}


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def smooth_angle(o, deg=35):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))


def rounded_slab(name, w, h, d, r, mat, edge=0.0, n=10):
    """a flat slab, w wide and h tall (in its own x, z), d thick along y, its corners rounded by r, its edges eased by `edge`"""
    bm = bmesh.new()
    pts = []
    for cx, cz, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    front = [bm.verts.new((x, -d / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, d / 2, z)) for x, z in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((front[j], front[i], back[i], back[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    finish(o, name, mat, smooth_shade=False)
    if edge:
        bevel(o, edge, 3, angle=True)
        apply_mods(o)
    smooth_angle(o)
    return o


def box(name, size, at, mat, bev=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat, smooth_shade=False)
    if bev:
        bevel(o, bev, 3, angle=False)
        apply_mods(o)
        smooth_angle(o)
    return o


def cyl(name, r, depth, at, mat, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat)
    smooth_angle(o, 40)
    return o


# =====================================================================
# The tablet, upright in its own frame (screen toward three's +z = Blender -y), its middle at its origin
# =====================================================================
# (the current iPad's proportions, 248.6 x 179.5 x 7.0 mm, its corners about 18.5 mm round, the screen (2360 x 1640) inside an even 10.8 mm
# border; scaled so its long side is 0.275, the size the till has room for)
K = 0.275 / 0.2486
TW, TH, TD, TR = 0.1795 * K, 0.2486 * K, 0.0070 * K, 0.0185 * K
BORDER = 0.0108 * K
tab = []
body = rounded_slab("IpadBody", TW, TH, TD, TR, M["alu"], edge=0.0012)
tab.append(body)
# the front: one sheet of black glass, the screen inside its even border
glass = rounded_slab("IpadGlass", TW - 0.0016, TH - 0.0016, 0.0006, TR - 0.0008, M["glass"])
glass.location = (0, -TD / 2 - 0.0002, 0)
tab.append(glass)
# the front camera, in the border on the long side (on top when held landscape, as it stands here): a ring and the lens in it
FCX = TW / 2 - BORDER / 2
tab.append(cyl("IpadFrontCamRing", 0.0021, 0.0003, (FCX, -TD / 2 - 0.00062, 0), M["dark"], rot=(math.pi / 2, 0, 0), verts=20))
tab.append(cyl("IpadFrontCam", 0.0013, 0.0003, (FCX, -TD / 2 - 0.0007, 0), M["lens"], rot=(math.pi / 2, 0, 0), verts=20))
# the top button on the top edge at the right, the volume keys down the right edge, near the top
tab.append(box("IpadTopButton", S(0.022, 0.0012, 0.003), P(TW / 2 - 0.035, TH / 2 + 0.0004, 0), M["alu"], bev=0.0005))
for k in range(2):
    tab.append(box(f"IpadVolume{k}", S(0.0012, 0.017, 0.003), P(TW / 2 + 0.0004, TH / 2 - 0.045 - k * 0.022, 0), M["alu"], bev=0.0005))
# the speaker grilles: rows of small holes on the top and bottom edges; the USB-C port in the middle of the bottom
for sy in (1, -1):
    for side in (-1, 1):
        for k in range(7):
            tab.append(cyl(f"IpadGrille{sy}{side}{k}", 0.0006, 0.001, P(side * (0.045 + k * 0.004), sy * (TH / 2 + 0.0001), 0), M["dark"], verts=8))
tab.append(box("IpadPort", S(0.009, 0.0012, 0.0028), P(0, -TH / 2 - 0.0002, 0), M["dark"], bev=0.0009))
# the back camera, top left seen from the back: a rounded-square bump standing a little proud, the lens in a dark metal ring, the coated
# glass over it and the iris inside showing blue, the flash beside it and the microphone's pinhole
CX, CY, BACK = TW / 2 - 0.016, TH / 2 - 0.016, -TD / 2
tab.append(rounded_on_back := box("IpadCamBump", S(0.0145, 0.0145, 0.0012), P(CX, CY, BACK - 0.0006), M["alu"], bev=0.0035))
tab.append(cyl("IpadBackLensRing", 0.0052, 0.0009, P(CX, CY, BACK - 0.0014), M["ring"], rot=(math.pi / 2, 0, 0), verts=32))
tab.append(cyl("IpadBackLens", 0.0040, 0.0007, P(CX, CY, BACK - 0.0019), M["lens"], rot=(math.pi / 2, 0, 0), verts=32))
tab.append(cyl("IpadBackIris", 0.0017, 0.0002, P(CX, CY, BACK - 0.0023), M["iris"], rot=(math.pi / 2, 0, 0), verts=20))
tab.append(cyl("IpadFlash", 0.0016, 0.0003, P(CX, CY - 0.0125, BACK - 0.0002), M["flash"], rot=(math.pi / 2, 0, 0), verts=16))
tab.append(cyl("IpadMicHole", 0.0005, 0.0003, P(CX - 0.0105, CY, BACK - 0.0002), M["dark"], rot=(math.pi / 2, 0, 0), verts=8))
# the connector's three dots, on the left edge (the bottom held landscape)
for k in range(3):
    tab.append(cyl(f"IpadConnector{k}", 0.0009, 0.0006, P(-TW / 2 - 0.0002, (k - 1) * 0.004, 0), M["dark"], rot=(0, math.pi / 2, 0), verts=8))

# the tablet held landscape, as a till's is: everything above turned a quarter about the screen's normal (the camera's long edge to the
# top), leaning back on the stand with its long foot on the ledge
TILT_UP = TW / 2 + 0.001
tilt = bpy.data.objects.new("IpadTilt", None)
bpy.context.collection.objects.link(tilt)
tilt.location = P(0, 0.014, 0.035)
tilt.rotation_euler = (-0.3, 0, 0)
turn = bpy.data.objects.new("IpadTurn", None)
bpy.context.collection.objects.link(turn)
turn.parent = tilt
turn.location = P(0, TILT_UP, 0)
turn.rotation_euler = (0, -math.pi / 2, 0)
for o in tab:
    o.parent = turn
# the screen, landscape: its UV 0..1 left to right and bottom to top as the cashier sees it
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
scr = active()
scr.scale = (TH - 2 * BORDER, TW - 2 * BORDER, 1)
apply_scale(scr)
finish(scr, "IpadScreen", M["screen"], smooth_shade=False)
scr.parent = tilt
scr.location = Vector(P(0, TILT_UP, TD / 2 + 0.00055))
tab.append(scr)

# =====================================================================
# The stand: a weighted base plate, the back arm hinged on it, the ledge in front with its rubber pads
# =====================================================================
stand = []
base = rounded_slab("IpadStandBase", 0.15, 0.12, 0.009, 0.02, M["stand"], edge=0.002)
base.rotation_euler = (math.pi / 2, 0, 0)
base.location = P(0, 0.0045, -0.005)
stand.append(base)
# (a rubber ring under it)
stand.append(box("IpadStandFoot", S(0.14, 0.0015, 0.11), P(0, 0.0004, -0.005), M["rubber"], bev=0.0006))
# the back arm, up from a hinge at the base's back, leaning forward under the tablet's back
hinge = Vector(P(0, 0.012, -0.05))
top = Vector(P(0, 0.12, -0.008))
arm_len = (top - hinge).length
arm = rounded_slab("IpadStandArm", 0.07, arm_len, 0.006, 0.012, M["stand"], edge=0.0015)
d = top - hinge
# (its long side, Blender z, turned onto the line from the hinge to the top)
arm.rotation_euler = (math.atan2(-d.y, d.z), 0, 0)
arm.location = (hinge + top) / 2
stand.append(arm)
stand.append(cyl("IpadStandHinge", 0.006, 0.075, tuple(hinge), M["stand"], rot=(0, math.pi / 2, 0), verts=20))
# the ledge the tablet's foot rests on: a lip along the base's front, rubber lined
stand.append(box("IpadStandLedge", S(0.11, 0.013, 0.012), P(0, 0.0155, 0.046), M["stand"], bev=0.002))
stand.append(box("IpadStandLedgePad", S(0.1, 0.003, 0.004), P(0, 0.0175, 0.0405), M["rubber"], bev=0.001))

root = bpy.data.objects.new("Ipad", None)
bpy.context.collection.objects.link(root)
tilt.parent = root
for o in stand:
    o.parent = root
parts = [tilt, turn] + tab + stand

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (-0.22, 0.42, 0.26)
    cam.rotation_euler = (Vector((0, 0, 0.11)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((0.8, -1.2, 1.5), 300), ((-1.2, -0.5, 0.6), 100), ((0, 1.5, 1), 80)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 1.2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "ipad.glb"), os.path.join(PROJECT, "blender", "ipad.blend"), PREVIEW)
print("IPAD_DONE", len(parts), "parts")
