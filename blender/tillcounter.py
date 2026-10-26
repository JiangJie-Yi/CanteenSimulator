"""The till counter by the door: its dark wooden body (open on the cashier's side, two shelves inside, hinoki battens up the customers' face,
a kick board, a round lattice window in its end lit from within), a white marble top with grey veins overhanging all round, and the partition
along the customers' side and the end by the cats: clear acrylic in a hinoki frame, a pass-through cut low in it over the coin tray.

Run:
    blender -b --factory-startup --python blender/tillcounter.py -- <project path> [preview.png]
Writes public/models/tillcounter.glb and blender/tillcounter.blend.

Frame: the till's own (GuestBar3D's Register group): +y up, x along the bar, the cashier at +z, the customers at -z; the top's surface at
TOP. Node names the game looks for: TillCounterBody, TillCounterTop (the marble), TillShield (the partition), TillWindowPaper (lit).
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

seed(21)
bpy.ops.wm.read_factory_settings(use_empty=True)

W, D, TOP = 1.2, 0.82, 0.86


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- textures: the marble (white, soft grey clouds, fine dark veins), the hinoki battens' grain, the body's dark wood
N = 512
u, v = grid01(N)
warp = fbm(N, 3, 3, 5)
vein = np.abs(np.sin((u * 2.2 + v * 1.1 + warp * 2.6) * math.pi * 2.0))
veins = smooth(0.06, 0.0, vein) * 0.75 + smooth(0.18, 0.0, np.abs(np.sin((u * 5 - v * 3 + warp * 4) * math.pi))) * 0.25
cloud = fbm(N, 4, 4, 5)
marble = mix(mix((0.95, 0.95, 0.94), (0.86, 0.86, 0.87), cloud * 0.6), (0.48, 0.5, 0.53), np.clip(veins, 0, 1) * 0.8)
marble_tex = image("marble", marble)
g2 = fbm(256, 2, 50, 4)
batten_tex = image("batten", mix((0.8, 0.62, 0.4), (0.7, 0.52, 0.32), smooth(0.4, 0.8, g2)))
dark_tex = image("darkwood", mix((0.25, 0.17, 0.11), (0.2, 0.13, 0.08), fbm(256, 2, 40, 4)))

M = {
    "body": pbr("TillBodyWood", (1, 1, 1), tex=dark_tex, rough=0.6),
    "shelf": pbr("TillShelf", lin("#4a3626"), rough=0.6),
    "batten": pbr("TillBatten", (1, 1, 1), tex=batten_tex, rough=0.55),
    "kick": pbr("TillKick", lin("#22180f"), rough=0.6),
    "marble": pbr("TillMarble", (1, 1, 1), tex=marble_tex, rough=0.12),
    "frame": pbr("TillShieldFrame", lin("#c7a174"), tex=batten_tex, rough=0.5),
    "acrylic": pbr("TillAcrylic", lin("#eef6fa"), rough=0.02),
    "ring": pbr("TillWindowRing", lin("#5a3a22"), rough=0.5),
    "paper": pbr("TillWindowPaper", lin("#f2dcb0"), rough=0.9),
    "lattice": pbr("TillLattice", lin("#5a3a22"), rough=0.5),
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


def uv_box(o, size=0.6):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def box(name, size, at, mat_, bev=0.0, rot=(0, 0, 0), uv=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat_, smooth_shade=False)
    if bev:
        bevel(o, bev, 3, angle=False)
        apply_mods(o)
        smooth_angle(o)
    if uv:
        uv_box(o, uv)
    return o


def cyl(name, r, depth, at, mat_, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat_)
    smooth_angle(o, 40)
    return o


def node(name, parts):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    for o in parts:
        if o.parent is None:
            o.parent = e
    return e, parts


nodes = []
# =====================================================================
# The body: the customers' face and the two ends, two shelves, battens, kick board, the round window in the end toward the door
# =====================================================================
bd = []
H = TOP - 0.05
bd.append(box("TillFace", S(W - 0.04, H, 0.08), P(0, H / 2, -D / 2 + 0.06), M["body"], bev=0.006, uv=0.6))
for sx in (-1, 1):
    end = box(f"TillEnd{sx}", S(0.06, H, D - 0.06), P(sx * (W / 2 - 0.05), H / 2, 0.02), M["body"], bev=0.006, uv=0.6)
    if sx == 1:
        # (the round window: a hole through the end, its ring and lattice and lit paper set in it)
        hole_ = cyl("win", 0.2, 0.2, P(W / 2 - 0.05, H / 2 + 0.03, 0.02), M["body"], rot=(0, math.pi / 2, 0), verts=48)
        m_ = end.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = hole_; m_.solver = "EXACT"
        apply_mods(end)
        bpy.data.objects.remove(hole_)
    bd.append(end)
WX = W / 2 - 0.05
WY = H / 2 + 0.03
bpy.ops.mesh.primitive_torus_add(major_radius=0.215, minor_radius=0.018, major_segments=48, minor_segments=10, location=P(W / 2 - 0.018, WY, 0.02), rotation=(0, math.pi / 2, 0))
ring = active()
finish(ring, "TillWindowRing", M["ring"])
bd.append(ring)
bd.append(cyl("TillWindowPaper", 0.2, 0.004, P(WX - 0.01, WY, 0.02), M["paper"], rot=(0, math.pi / 2, 0), verts=48))
for k in (-1, 0, 1):
    L = 0.4 * math.sqrt(1 - (k * 0.1 / 0.2) ** 2)
    bd.append(box(f"TillLatticeV{k}", S(0.012, L, 0.012), P(W / 2 - 0.02, WY, 0.02 + k * 0.1), M["lattice"]))
    bd.append(box(f"TillLatticeH{k}", S(0.012, 0.012, L), P(W / 2 - 0.02, WY + k * 0.1, 0.02), M["lattice"]))
bd.append(box("TillShelfLow", S(W - 0.14, 0.03, D - 0.14), P(0, 0.1, 0.03), M["shelf"], bev=0.003))
bd.append(box("TillShelfHigh", S(W - 0.14, 0.025, D - 0.2), P(0, TOP - 0.2, 0.04), M["shelf"], bev=0.003))
for k in range(15):
    bd.append(box(f"TillBatten{k}", S(0.036, TOP - 0.14, 0.024), P((k - 7) * (W - 0.08) / 15, (TOP - 0.06) / 2 + 0.04, -D / 2 + 0.014), M["batten"], bev=0.004, uv=0.6))
bd.append(box("TillKick", S(W - 0.06, 0.06, 0.02), P(0, 0.03, -D / 2 + 0.035), M["kick"], bev=0.002))
nodes.append(node("TillCounterBody", bd))

# =====================================================================
# The top: a slab of white marble, its corners rounded, its edges eased, overhanging all round
# =====================================================================
TW_, TD_, TT = W + 0.1, D + 0.1, 0.06
bm = bmesh.new()
R = 0.07
pts = []
for cx, cz, a0 in ((TW_ / 2 - R, -TD_ / 2 + R, -90), (TW_ / 2 - R, TD_ / 2 - R, 0), (-TW_ / 2 + R, TD_ / 2 - R, 90), (-TW_ / 2 + R, -TD_ / 2 + R, 180)):
    for k in range(13):
        a = math.radians(a0 + 90 * k / 12)
        pts.append((cx + R * math.cos(a), cz + R * math.sin(a)))
lo = [bm.verts.new(P(x, TOP - TT, z - 0.03)) for x, z in pts]
hi = [bm.verts.new(P(x, TOP, z - 0.03)) for x, z in pts]
bm.faces.new(list(reversed(lo)))
bm.faces.new(hi)
for i in range(len(pts)):
    j = (i + 1) % len(pts)
    bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("TillMarble")
bm.to_mesh(me)
bm.free()
top = bpy.data.objects.new("TillMarble", me)
bpy.context.collection.objects.link(top)
finish(top, "TillMarble", M["marble"], smooth_shade=False)
bevel(top, 0.008, 4, angle=True)
apply_mods(top)
smooth_angle(top, 40)
uv_box(top, 1.4)
nodes.append(node("TillCounterTop", [top]))

# =====================================================================
# The partition: along the customers' side and down the end by the cats, clear acrylic held in a slim hinoki frame on the top, a
# pass-through cut low in the customers' panel over the coin tray
# =====================================================================
sh = []
SH, FR, AT = 0.38, 0.022, 0.005           # its height above the top, the frame's square, the acrylic's thickness
ZF = -0.03 - TD_ / 2 + 0.03               # the customers' side, a little in from the edge
XE = TW_ / 2 - 0.03                       # the end by the cats
ZB = 0.3                                  # where the end panel stops, short of the cashier's end
# (the frame: posts at the corners and between, a rail along the top and the foot)
for x in (-XE, -0.2, 0.2, XE):
    sh.append(box(f"TillPost{x:+.2f}", S(FR, SH, FR), P(x, TOP + SH / 2, ZF), M["frame"], bev=0.003, uv=0.4))
sh.append(box("TillPostEnd", S(FR, SH, FR), P(XE, TOP + SH / 2, ZB), M["frame"], bev=0.003, uv=0.4))
sh.append(box("TillRailFront", S(2 * XE + FR, FR, FR), P(0, TOP + SH - FR / 2, ZF), M["frame"], bev=0.003, uv=0.4))
sh.append(box("TillRailEnd", S(FR, FR, ZB - ZF), P(XE, TOP + SH - FR / 2, (ZB + ZF) / 2), M["frame"], bev=0.003, uv=0.4))
sh.append(box("TillFootEnd", S(FR, 0.012, ZB - ZF), P(XE, TOP + 0.006, (ZB + ZF) / 2), M["frame"], bev=0.002, uv=0.4))
for x0, x1 in ((-XE, -0.2), (0.2, XE)):
    sh.append(box(f"TillFootFront{x0:+.1f}", S(x1 - x0, 0.012, FR), P((x0 + x1) / 2, TOP + 0.006, ZF), M["frame"], bev=0.002, uv=0.4))
# (the acrylic: the customers' panel in three, the middle one cut away at the foot over the coin tray; the end panel whole)
for x0, x1 in ((-XE, -0.2), (-0.2, 0.2), (0.2, XE)):
    pane = box(f"TillPane{x0:+.1f}", S(x1 - x0 - FR, SH - FR - 0.012, AT), P((x0 + x1) / 2, TOP + 0.012 + (SH - FR - 0.012) / 2, ZF), M["acrylic"])
    if x0 == -0.2:
        gap = box("gap", S(0.3, 0.09, 0.05), P(0, TOP + 0.045, ZF), M["acrylic"], bev=0.02)
        m_ = pane.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = gap; m_.solver = "EXACT"
        apply_mods(pane)
        bpy.data.objects.remove(gap)
    sh.append(pane)
sh.append(box("TillPaneEnd", S(AT, SH - FR - 0.012, ZB - ZF - FR), P(XE, TOP + 0.012 + (SH - FR - 0.012) / 2, (ZB + ZF) / 2), M["acrylic"]))
nodes.append(node("TillShield", sh))

root = bpy.data.objects.new("TillCounter", None)
bpy.context.collection.objects.link(root)
parts = []
for e, ps in nodes:
    e.parent = root
    parts += [e] + ps

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (1.6, -1.6, 1.7)
    cam.rotation_euler = (Vector((0, 0, 0.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35
    bpy.context.scene.camera = cam
    for loc, e in (((2, -2, 3), 900), ((-2, -1, 1.5), 300), ((0, 2.5, 2), 300)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "tillcounter.glb"), os.path.join(PROJECT, "blender", "tillcounter.blend"), PREVIEW)
print("TILLCOUNTER_DONE", len(parts), "parts")
