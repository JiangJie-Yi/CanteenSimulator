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
    "logo": pbr("IpadLogo", lin("#e9ebee"), rough=0.08, metal=1.0),
    "logoStone": pbr("IpadLogoStone", lin("#c9ccd1"), rough=0.3, metal=0.9),
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
# (the iPad Pro 13-inch's proportions, 281.6 x 215.5 x 5.1 mm, its corners about 18 mm round, the 4:3 screen (2752 x 2064) inside an even
# 8.8 mm border, its own corners rounded to match; scaled so its long side is 0.28, the size the till has room for)
K = 0.28 / 0.2816
TW, TH, TD, TR = 0.2155 * K, 0.2816 * K, 0.0051 * K, 0.018 * K
BORDER = 0.0088 * K
SCREEN_R = TR - BORDER
tab = []
body = rounded_slab("IpadBody", TW, TH, TD, TR, M["alu"], edge=0.0009)
tab.append(body)
# the front: one sheet of black glass, the screen inside its even border
glass = rounded_slab("IpadGlass", TW - 0.0012, TH - 0.0012, 0.0005, TR - 0.0006, M["glass"])
glass.location = (0, -TD / 2 - 0.0002, 0)
tab.append(glass)
# the front camera, in the border on the long side (on top when held landscape, as it stands here): a ring and the lens in it
FCX = TW / 2 - BORDER / 2
tab.append(cyl("IpadFrontCamRing", 0.0019, 0.0003, (FCX, -TD / 2 - 0.00055, 0), M["dark"], rot=(math.pi / 2, 0, 0), verts=20))
tab.append(cyl("IpadFrontCam", 0.0012, 0.0003, (FCX, -TD / 2 - 0.00062, 0), M["lens"], rot=(math.pi / 2, 0, 0), verts=20))
# the top button on the top edge at the right, the volume keys down the right edge, near the top
tab.append(box("IpadTopButton", S(0.024, 0.001, 0.0024), P(TW / 2 - 0.038, TH / 2 + 0.0003, 0), M["alu"], bev=0.0004))
for k in range(2):
    tab.append(box(f"IpadVolume{k}", S(0.001, 0.018, 0.0024), P(TW / 2 + 0.0003, TH / 2 - 0.046 - k * 0.023, 0), M["alu"], bev=0.0004))
# the four speakers: a short row of holes near each end of the top and bottom edges; the USB-C port in the middle of the bottom
for sy in (1, -1):
    for side in (-1, 1):
        for k in range(6):
            tab.append(cyl(f"IpadGrille{sy}{side}{k}", 0.0005, 0.001, P(side * (0.062 + k * 0.0035), sy * (TH / 2 + 0.0001), 0), M["dark"], verts=8))
tab.append(box("IpadPort", S(0.0085, 0.001, 0.0024), P(0, -TH / 2 - 0.0002, 0), M["dark"], bev=0.0008))
# the back camera, top left seen from the back, as on the Pro: a rounded-square plateau in the body's own metal standing proud, and on it
# the wide lens (top left) in its dark ring, the LiDAR scanner's black glass (below it), the flash (bottom right), the microphone (top right)
BACK = -TD / 2
BS, BR, BH = 0.03, 0.0085, 0.0012
BX, BY = TW / 2 - 0.009 - BS / 2, TH / 2 - 0.009 - BS / 2
bump = rounded_slab("IpadCamBump", BS, BS, BH, BR, M["alu"], edge=0.0005)
bump.location = P(BX, BY, BACK - BH / 2)
tab.append(bump)
TOPB = BACK - BH
q = BS / 4.1
LX, LY = BX + q, BY + q          # (seen from the back, +x is the left)
tab.append(cyl("IpadBackLensRing", 0.0058, 0.0012, P(LX, LY, TOPB - 0.0006), M["ring"], rot=(math.pi / 2, 0, 0), verts=36))
tab.append(cyl("IpadBackLens", 0.0045, 0.0006, P(LX, LY, TOPB - 0.0012), M["lens"], rot=(math.pi / 2, 0, 0), verts=36))
tab.append(cyl("IpadBackIris", 0.002, 0.0002, P(LX, LY, TOPB - 0.0015), M["iris"], rot=(math.pi / 2, 0, 0), verts=24))
tab.append(cyl("IpadLidarRing", 0.0042, 0.0006, P(LX, BY - q, TOPB - 0.0003), M["ring"], rot=(math.pi / 2, 0, 0), verts=32))
tab.append(cyl("IpadLidar", 0.0034, 0.0004, P(LX, BY - q, TOPB - 0.0006), M["lens"], rot=(math.pi / 2, 0, 0), verts=32))
tab.append(cyl("IpadFlash", 0.0028, 0.0003, P(BX - q, BY - q, TOPB - 0.0002), M["flash"], rot=(math.pi / 2, 0, 0), verts=24))
tab.append(cyl("IpadMicHole", 0.0007, 0.0003, P(BX - q, LY, TOPB - 0.0002), M["dark"], rot=(math.pi / 2, 0, 0), verts=10))
# the logo, in the middle of the back where the maker's would be: an avocado cut in half, polished, its stone a round hollow
def avocado(w, h, n=48):
    """the outline of a halved avocado: round at the foot, narrowing to the stalk end (x, y around its middle)"""
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        y = math.sin(t)
        x = math.cos(t) * (1 - 0.3 * y) * (1 + 0.04 * y * y)
        pts.append((x * w / 2, y * h / 2 - 0.08 * h))
    return pts
import bmesh as _bm
lb = _bm.new()
outer = [lb.verts.new((x, 0, y)) for x, y in avocado(0.026, 0.034)]
lb.faces.new(outer)
lmesh = bpy.data.meshes.new("IpadLogo")
lb.to_mesh(lmesh)
lb.free()
logo = bpy.data.objects.new("IpadLogo", lmesh)
bpy.context.collection.objects.link(logo)
finish(logo, "IpadLogo", M["logo"], smooth_shade=False)
sol = logo.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = 0.0002
apply_mods(logo)
# (its stone: a round hollow, a little below the middle)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0062, depth=0.01, location=(0, 0, -0.006), rotation=(math.pi / 2, 0, 0))
stone = active()
m = logo.modifiers.new("cut", "BOOLEAN")
m.operation = "DIFFERENCE"
m.object = stone
m.solver = "EXACT"
apply_mods(logo)
bpy.data.objects.remove(stone)
# (upright when held upright, as the maker's is: on the back, facing out of it)
logo.location = P(0, 0.0, BACK - 0.00012)
tab.append(logo)
tab.append(cyl("IpadLogoStone", 0.0055, 0.00015, P(0, -0.006 + 0.0, BACK - 0.0001), M["logoStone"], rot=(math.pi / 2, 0, 0), verts=32))
# the connector's three dots, on the back by the long edge that's the bottom held landscape (where a keyboard case clips on)
for k in range(3):
    tab.append(cyl(f"IpadConnector{k}", 0.0011, 0.0003, P(-TW / 2 + 0.006, (k - 1) * 0.005, BACK - 0.0001), M["dark"], rot=(math.pi / 2, 0, 0), verts=12))

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
scr = rounded_slab("IpadScreen", TH - 2 * BORDER, TW - 2 * BORDER, 0.0001, SCREEN_R, M["screen"])
# (its UVs straight across it, 0..1 left to right and bottom to top as the cashier sees it)
uvl = scr.data.uv_layers.new(name="UVMap")
for poly in scr.data.polygons:
    for li in poly.loop_indices:
        co = scr.data.vertices[scr.data.loops[li].vertex_index].co
        uvl.data[li].uv = (co.x / (TH - 2 * BORDER) + 0.5, co.z / (TW - 2 * BORDER) + 0.5)
scr.parent = tilt
scr.location = Vector(P(0, TILT_UP, TD / 2 + 0.0005))
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
