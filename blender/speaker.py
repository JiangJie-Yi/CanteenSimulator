"""The shop's wall speaker (スピーカー): a black two-way cabinet with rounded edges, a domed perforated steel grille over a woofer
and a horn tweeter, a bass port, a badge and a power light, held in a U-shaped steel yoke on an arm out from a corner bracket, its
cable looping down from the terminal cup on the back.

Run:
    blender -b --factory-startup --python blender/speaker.py -- <project path> [preview.png]
Writes public/models/speaker.glb and blender/speaker.blend.

Frame: Blender Z-up, the speaker facing -Y (glTF +Z), the wall behind it at +Y; the origin is where the old in-code speaker had its
own (the room places it there). The cabinet is tilted down in the yoke by TILT. Node names the game looks for:
    SpeakerLED   the power light (its colour is set by the game)
    SpeakerArmReach, SpeakerMount  the arm (stretched along +Y) and the corner bracket (set into the room's corner) by the game
    SpeakerGrille the grille sheet (alpha-tested holes)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)

W, H, D = 0.30, 0.46, 0.22      # the cabinet
FRONT = -D / 2                  # its front face (y)
TILT = 0.22                     # tipped down toward the room
WOOF_Z, WOOF_R = -0.06, 0.098   # the woofer: its centre's height and radius
HORN_Z = 0.145                  # the tweeter horn's centre

# =====================================================================
# Textures and materials
# =====================================================================
S = 256
speck = fbm(S, 32, 32, 3)
abs_tex = image("abs", mix((0.05, 0.052, 0.058), (0.08, 0.083, 0.092), speck))

# the grille: 1.2 mm steel punched with 3.6 mm holes on a 5 mm staggered pitch; a solid border all round (its flange)
GW, GH = 640, 960
gx = np.arange(GW)[None, :] + 0.5
gy = np.arange(GH)[:, None] + 0.5
pitch = GW / 54.0
row = np.floor(gy / (pitch * 0.866))
cy = (row + 0.5) * pitch * 0.866
cx = (np.floor(gx / pitch - (row % 2) * 0.5) + 0.5 + (row % 2) * 0.5) * pitch
hole = np.hypot(gx - cx, gy - cy) < pitch * 0.36
border = (gx < 22) | (gx > GW - 22) | (gy < 22) | (gy > GH - 22)
grille_alpha = np.where(hole & ~border, 0.0, 1.0).astype(np.float32)
brushed = fbm(64, 4, 64, 3)
brushed = np.kron(brushed, np.ones((GH // 64 + 1, GW // 64 + 1)))[:GH, :GW]
grille_rgb = mix((0.08, 0.083, 0.09), (0.12, 0.124, 0.135), brushed.astype(np.float32))
grille_tex = image("grille", grille_rgb, alpha=grille_alpha)

paper = image("cone", mix((0.06, 0.06, 0.066), (0.1, 0.1, 0.108), fbm(S, 24, 24, 4)))

M = {
    "abs": pbr("SpeakerABS", (0.065, 0.067, 0.075), tex=abs_tex, rough=0.65),
    "baffle": pbr("SpeakerBaffle", (0.012, 0.012, 0.014), rough=0.8),
    "grille": pbr("SpeakerGrille", (0.06, 0.062, 0.068), tex=grille_tex, rough=0.4, metal=0.7, blend=True),
    "cone": pbr("SpeakerCone", (0.04, 0.04, 0.045), tex=paper, rough=0.85),
    "rubber": pbr("SpeakerRubber", (0.02, 0.02, 0.022), rough=0.7),
    "cap": pbr("SpeakerCap", (0.12, 0.12, 0.13), rough=0.35, metal=0.5),
    "frame": pbr("SpeakerFrame", (0.09, 0.09, 0.098), rough=0.5, metal=0.6),
    "steel": pbr("SpeakerSteel", (0.06, 0.062, 0.068), rough=0.45, metal=0.6),
    "screw": pbr("SpeakerScrew", (0.55, 0.56, 0.58), rough=0.3, metal=1.0),
    "badge": pbr("SpeakerBadge", (0.62, 0.63, 0.66), rough=0.3, metal=1.0),
    "ink": pbr("SpeakerBadgeInk", (0.02, 0.02, 0.025), rough=0.5),
    "led": pbr("SpeakerLED", (0.2, 0.9, 0.35), emit=(0.2, 0.9, 0.35), emit_strength=2.0),
    "cable": pbr("SpeakerCable", (0.015, 0.015, 0.017), rough=0.35),
    "red": pbr("SpeakerRed", (0.5, 0.05, 0.04), rough=0.4),
}


# =====================================================================
# Mesh helpers
# =====================================================================

def mesh_obj(name, bm, mat, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, smooth_shade)


def lathe(name, profile, mat, segs=48):
    """A solid of revolution about Z from a list of (r, z), facing +Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=segs, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat)


def box(name, size, at, mat, bev=0.0, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat, smooth_shade=bev > 0)
    if bev:
        bevel(o, bev, segs, angle=False)
    return o


def cyl(name, r, depth, at, mat, rot=(0, 0, 0), verts=24, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat)
    if bev:
        bevel(o, bev, 2)
    o.data.shade_auto_smooth() if hasattr(o.data, "shade_auto_smooth") else None
    return o


def rounded_rect(w, h, r, n=6):
    """Points round a rounded rectangle (x, z), counter-clockwise, starting bottom-left."""
    pts = []
    for cx_, cz_, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx_ + r * math.cos(a), cz_ + r * math.sin(a)))
    return pts


def to_front(o, y, z, x=0.0):
    """A part built facing +Z turned to face -Y (out of the cabinet's front), its centre at (x, y, z)."""
    o.rotation_euler = (math.pi / 2, 0, 0)
    o.location = (x, y, z)
    return o


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    apply_mods(target)
    bpy.data.objects.remove(cutter)


parts = []
cab_parts = []

# =====================================================================
# The cabinet: rounded all round, the driver openings cut into its front
# =====================================================================
cab = box("SpeakerCabinet", (W, D, H), (0, 0, 0), M["abs"])
bevel(cab, 0.03, 6, angle=False)
apply_mods(cab)
# (the front's recessed baffle: a shallow pocket the grille sits in, 4 mm deep, inside a 10 mm lip)
pocket = box("pocket", (W - 0.02, 0.02, H - 0.02), (0, FRONT - 0.006, 0), M["abs"], bev=0.012)
apply_mods(pocket)
cut(cab, pocket)
cut(cab, cyl("wcut", WOOF_R + 0.002, 0.12, (0, FRONT, WOOF_Z), M["abs"], rot=(math.pi / 2, 0, 0), verts=64))
horn_cut = box("hcut", (0.15, 0.1, 0.066), (0, FRONT, HORN_Z), M["abs"], bev=0.01)
apply_mods(horn_cut)
cut(cab, horn_cut)
port_cut = box("pcut", (0.17, 0.12, 0.02), (0, FRONT, -0.19), M["abs"], bev=0.008)
apply_mods(port_cut)
cut(cab, port_cut)
# (smooth over the rounded edges, sharp where the openings were cut)
bpy.ops.object.select_all(action="DESELECT")
cab.select_set(True)
bpy.context.view_layer.objects.active = cab
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
cab_parts.append(cab)

BAFFLE = FRONT + 0.004
# the inside, seen through the openings: a black back wall (no daylight through the box)
cab_parts.append(box("SpeakerInside", (W - 0.03, 0.004, H - 0.03), (0, FRONT + 0.06, 0), M["baffle"]))
# the port's tunnel
cab_parts.append(box("SpeakerPort", (0.168, 0.05, 0.018), (0, BAFFLE + 0.025, -0.19), M["baffle"]))

# ---- the woofer: cast frame and its screws, the rubber surround, the paper cone, the dust cap
fr = lathe("SpeakerWooferFrame", [(WOOF_R + 0.006, 0.0), (WOOF_R + 0.006, 0.002), (WOOF_R - 0.006, 0.002), (WOOF_R - 0.008, -0.001)], M["frame"])
cab_parts.append(to_front(fr, BAFFLE, WOOF_Z))
sur = [(0.086 + 0.006 * (1 - math.cos(math.pi * k / 12)), 0.0005 + 0.0065 * math.sin(math.pi * k / 12)) for k in range(13)]
cab_parts.append(to_front(lathe("SpeakerSurround", sur, M["rubber"]), BAFFLE - 0.0015, WOOF_Z))
cone = [(0.086 - 0.054 * t, -0.042 * t ** 1.4) for t in np.linspace(0, 1, 10)]
cab_parts.append(to_front(lathe("SpeakerCone", cone, M["cone"]), BAFFLE - 0.001, WOOF_Z))
cap = [(0.032 * math.cos(a), -0.042 + 0.013 * math.sin(a)) for a in np.linspace(0, math.pi / 2, 8)]
cab_parts.append(to_front(lathe("SpeakerDustCap", cap, M["cap"]), BAFFLE - 0.001, WOOF_Z))
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    s = cyl(f"SpeakerWooferScrew{k}", 0.0035, 0.002, (0, 0, 0), M["screw"], verts=12)
    to_front(s, BAFFLE - 0.003, WOOF_Z + (WOOF_R + 0.001) * math.sin(a), (WOOF_R + 0.001) * math.cos(a))
    cab_parts.append(s)

# ---- the tweeter: a constant-directivity horn flaring from a small throat to a wide mouth, a phase plug in the throat
bm = bmesh.new()
loops = []
for depth, w_, h_, r_ in ((0.0, 0.145, 0.062, 0.012), (-0.012, 0.11, 0.046, 0.01), (-0.028, 0.06, 0.03, 0.008), (-0.042, 0.024, 0.02, 0.006)):
    loops.append([bm.verts.new((x, z, depth)) for x, z in rounded_rect(w_, h_, r_)])
lip = [bm.verts.new((x, z, 0.0)) for x, z in rounded_rect(0.16, 0.074, 0.016)]
for a, b in zip([lip] + loops[:-1], loops):
    for i in range(len(a)):
        bm.faces.new((a[i], a[(i + 1) % len(a)], b[(i + 1) % len(b)], b[i]))
bm.faces.new(list(reversed(loops[-1])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
horn = mesh_obj("SpeakerHorn", bm, M["frame"])
s = horn.modifiers.new("Solidify", "SOLIDIFY")
s.thickness = 0.002
cab_parts.append(to_front(horn, BAFFLE - 0.001, HORN_Z))
cab_parts.append(to_front(lathe("SpeakerPhasePlug", [(0.007, 0.0), (0.006, 0.004), (0.0, 0.007)], M["cap"], 20), BAFFLE + 0.04, HORN_Z))

# ---- the grille: a sheet domed a little outward, its edge turned back into the pocket
bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=54, size=1)
g = active()
GWm, GHm = W - 0.026, H - 0.026
for v in g.data.vertices:
    u, w_ = v.co.x * 2, v.co.y * 2   # -1..1
    edge = max(abs(u), abs(w_))
    bulge = 0.005 * (1 - u * u) * (1 - w_ * w_)
    v.co.x *= GWm
    v.co.y *= GHm
    v.co.z = bulge - (0.006 if edge > 0.999 else 0.0)
grille = finish(g, "SpeakerGrille", M["grille"])
s = grille.modifiers.new("Solidify", "SOLIDIFY")
s.thickness = 0.0012
cab_parts.append(to_front(grille, FRONT - 0.001, 0))
GRILLE_FACE = FRONT - 0.001 - 0.0012

# ---- the badge on the grille's foot (brushed aluminium, the word inked in) and the power light
badge = box("SpeakerBadge", (0.072, 0.0015, 0.018), (-0.06, GRILLE_FACE - 0.001, -H / 2 + 0.036), M["badge"], bev=0.002)
cab_parts.append(badge)
bpy.ops.object.text_add(location=(0, 0, 0))
t = active()
t.data.body = "SOUND"
t.data.size = 0.012
t.data.align_x = "CENTER"
t.data.align_y = "CENTER"
t.data.extrude = 0.0003
t.data.space_character = 1.15
bpy.ops.object.convert(target="MESH")
t = active()
finish(t, "SpeakerBadgeText", M["ink"], smooth_shade=False)
t.rotation_euler = (math.pi / 2, 0, 0)
t.location = (-0.06, GRILLE_FACE - 0.0028, -H / 2 + 0.036)
cab_parts.append(t)
led = cyl("SpeakerLED", 0.0045, 0.004, (0, 0, 0), M["led"], verts=16)
to_front(led, GRILLE_FACE - 0.0015, -H / 2 + 0.036, 0.105)
cab_parts.append(led)

# ---- the back: a recessed terminal cup with two spring clips; the knob inserts on the sides (the yoke's bolts go in there)
BACK = D / 2
cab_parts.append(box("SpeakerTerminal", (0.07, 0.006, 0.05), (0, BACK + 0.001, -0.09), M["baffle"], bev=0.004))
for x, mat in ((-0.015, M["red"]), (0.015, M["baffle"])):
    cab_parts.append(box(f"SpeakerClip{x}", (0.012, 0.012, 0.02), (x, BACK + 0.006, -0.09), mat, bev=0.002))

# the cabinet hangs tilted in the yoke, pivoting on the knobs a little behind and above its middle
PIVOT = Vector((0, 0.02, 0.02))
tilt = bpy.data.objects.new("SpeakerTilt", None)
bpy.context.collection.objects.link(tilt)
tilt.location = PIVOT
tilt.rotation_euler = (TILT, 0, 0)
for o in cab_parts:
    o.parent = tilt
    o.location = Vector(o.location) - PIVOT
parts += cab_parts

# =====================================================================
# The yoke, the arm and the wall plate
# =====================================================================

def strip(name, path, h, t, mat):
    """A flat steel strip (h tall, t thick) bent along a 2D path (x, y) at the pivot's height."""
    bm = bmesh.new()
    rows = []
    for i, (x, y) in enumerate(path):
        a = Vector(path[max(i - 1, 0)])
        b = Vector(path[min(i + 1, len(path) - 1)])
        d = (b - a).normalized()
        n = Vector((-d.y, d.x))
        rows.append([bm.verts.new((x + n.x * s_ * t / 2, y + n.y * s_ * t / 2, PIVOT.z + z_ * h / 2)) for s_, z_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for a, b in zip(rows, rows[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(rows[0])
    bm.faces.new(list(reversed(rows[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat)


YX = W / 2 + 0.014
YB = 0.19
R = 0.035
path = [(-YX, PIVOT.y - 0.03)]
path += [(-YX + R - R * math.cos(a), YB - R + R * math.sin(a)) for a in np.linspace(0, math.pi / 2, 7)]
path += [(YX - R + R * math.sin(a), YB - R + R * math.cos(a)) for a in np.linspace(0, math.pi / 2, 7)]
path += [(YX, PIVOT.y - 0.03)]
yoke = strip("SpeakerYoke", path, 0.042, 0.006, M["steel"])
bevel(yoke, 0.0015, 2)
parts.append(yoke)
# (the yoke's arms end round, past the pivot, under the knobs)
for sx in (-1, 1):
    parts.append(cyl(f"SpeakerYokeEnd{sx}", 0.021, 0.006, (sx * YX, PIVOT.y - 0.03, PIVOT.z), M["steel"], rot=(0, math.pi / 2, 0), verts=32))
    # the clamping knob: fluted, a washer under it
    parts.append(cyl(f"SpeakerWasher{sx}", 0.016, 0.002, (sx * (YX + 0.004), PIVOT.y, PIVOT.z), M["screw"], rot=(0, math.pi / 2, 0)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.021, depth=0.016, location=(sx * (YX + 0.013), PIVOT.y, PIVOT.z), rotation=(0, math.pi / 2, 0))
    k = active()
    for v in k.data.vertices:
        r_ = math.hypot(v.co.x, v.co.y)
        if r_ > 0.01:
            a = math.atan2(v.co.y, v.co.x)
            f = 1.0 if (round(a / (math.tau / 32)) % 2) else 0.86
            v.co.x *= f
            v.co.y *= f
    finish(k, f"SpeakerKnob{sx}", M["rubber"])
    bevel(k, 0.002, 2)
    parts.append(k)
# the arm back to the corner, a ball joint where it meets the yoke, and the corner bracket: an angle of steel whose two flanges lie flat on the
# two walls, the arm screwed into its spine. The game stretches the arm (its own node, SpeakerArmReach, along +Y from the joint) and sets the
# bracket (SpeakerMount, its spine at its origin) into the room's corner behind it, however far that is.
WALL = 0.38
reach = bpy.data.objects.new("SpeakerArmReach", None)
bpy.context.collection.objects.link(reach)
reach.location = (0, YB, PIVOT.z)
arm = cyl("SpeakerArm", 0.014, WALL - YB, (0, (WALL - YB) / 2, 0), M["steel"], rot=(math.pi / 2, 0, 0))
arm.parent = reach
parts += [reach, arm]
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0, YB + 0.012, PIVOT.z), segments=24, ring_count=12)
parts.append(finish(active(), "SpeakerJoint", M["steel"]))
parts.append(cyl("SpeakerJointNut", 0.017, 0.012, (0, YB + 0.03, PIVOT.z), M["steel"], rot=(math.pi / 2, 0, 0), verts=6))
mount = bpy.data.objects.new("SpeakerMount", None)
bpy.context.collection.objects.link(mount)
mount.location = (0, WALL, PIVOT.z)
mp = []
FL, FH, FT = 0.085, 0.17, 0.006           # each flange's width out from the corner, its height, its thickness
for sx in (-1, 1):
    # (each flange runs from the corner forward along its wall: 45° either side of the arm)
    a_ = sx * math.radians(45)
    d = Vector((math.sin(a_), -math.cos(a_), 0))
    n = Vector((d.y, -d.x, 0)) * sx
    c = d * (FL / 2) + n * (FT / 2)
    f = box(f"SpeakerMountFlange{sx}", (FT, FL, FH), tuple(c), M["steel"], bev=0.002)
    f.rotation_euler = (0, 0, a_)
    mp.append(f)
    for sz in (-1, 1):
        at = d * (FL * 0.62) + n * (FT + 0.0015)
        at = Vector((at.x, at.y, sz * 0.06))
        mp.append(cyl(f"SpeakerMountScrew{sx}{sz}", 0.006, 0.003, tuple(at), M["screw"], rot=(math.pi / 2, 0, a_ + math.pi / 2), verts=16, bev=0.0012))
# (the spine where the flanges meet, rounded, and a boss on it the arm screws into)
mp.append(cyl("SpeakerMountSpine", 0.008, FH, (0, -0.004, 0), M["steel"], verts=16))
mp.append(cyl("SpeakerMountBoss", 0.02, 0.024, (0, -0.016, 0), M["steel"], rot=(math.pi / 2, 0, 0), verts=24))
for o in mp:
    o.parent = mount
parts += [mount] + mp

# ---- the cable: out of the terminal, a loose loop down, back up into the arm at the joint (it runs inside the arm to the corner)
bpy.context.view_layer.update()
term = tilt.matrix_world @ (Vector((0, BACK + 0.01, -0.09)) - PIVOT)
pts = [term, term + Vector((0, 0.03, -0.05)), Vector((0.02, 0.17, -0.2)), Vector((0.012, YB + 0.03, PIVOT.z - 0.05)),
       Vector((0.0, YB + 0.045, PIVOT.z - 0.012))]
cd = bpy.data.curves.new("SpeakerCable", "CURVE")
cd.dimensions = "3D"
cd.bevel_depth = 0.0042
cd.bevel_resolution = 3
cd.resolution_u = 10
sp = cd.splines.new("BEZIER")
sp.bezier_points.add(len(pts) - 1)
for bp, p in zip(sp.bezier_points, pts):
    bp.co = p
    bp.handle_left_type = bp.handle_right_type = "AUTO"
cable = bpy.data.objects.new("SpeakerCable", cd)
bpy.context.collection.objects.link(cable)
cd.materials.append(M["cable"])
bpy.ops.object.select_all(action="DESELECT")
cable.select_set(True)
bpy.context.view_layer.objects.active = cable
bpy.ops.object.convert(target="MESH")
parts.append(active())

root = bpy.data.objects.new("WallSpeaker", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
tilt.parent = root
parts.append(tilt)

# =====================================================================
# Preview: a camera off the front corner, a key light and a fill
# =====================================================================
if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (-0.75, -1.05, -0.35)
    d = Vector((0, 0.08, -0.02)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 55
    bpy.context.scene.camera = cam
    for loc, e in (((-1.5, -2, 2), 600), ((2, -1, 0.5), 150), ((0, 2, 1), 200)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 1.5
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.5, 0.45, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "speaker.glb"),
            os.path.join(PROJECT, "blender", "speaker.blend"), PREVIEW)
print("SPEAKER_DONE", len(parts), "parts")
