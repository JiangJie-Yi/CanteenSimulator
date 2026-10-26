"""The small things on the till's counter: the pen cup (pens, markers, a highlighter, a pencil, scissors and a ruler in a glazed cup), the
receipt printer (a thermal one: its cover, the cutter and the slip coming out, its lights and buttons), the card reader (a payment terminal on
its cradle: the screen, the keys, the card slot and the contactless mark), the service bell (a chrome dome on its base), and the wooden desk
mat the reader, the printer, the pens and the tablet stand on. Each device's lead drops into a small hole in the mat right behind it.

Run:
    blender -b --factory-startup --python blender/tilldesk.py -- <project path> [preview.png]
Writes public/models/tilldesk.glb and blender/tilldesk.blend.

Frame: the till's own (+y up, the cashier at +z); each piece built round its own origin (the middle of its foot), as its group in the game
stands it. Node names the game looks for: TillPens, TillPrinter, TillCardReader, TillBell, TillMat.
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

seed(13)
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


BOLD = bpy.data.fonts.load("C:/Windows/Fonts/arialbd.ttf") if os.path.exists("C:/Windows/Fonts/arialbd.ttf") else None
JA = bpy.data.fonts.load("C:/Windows/Fonts/YuGothB.ttc") if os.path.exists("C:/Windows/Fonts/YuGothB.ttc") else BOLD

N = 256
u, v = grid01(N)
# (hinoki: pale, a fine straight grain along the board)
grain = fbm(N, 2, 40, 4)
hinoki = mix((0.86, 0.74, 0.55), (0.78, 0.63, 0.43), smooth(0.4, 0.75, grain))
hinoki_tex = image("hinoki", hinoki)


def mat(name, hexs, rough=0.5, metal=0.0, tex=None):
    return pbr(name, lin(hexs) if tex is None else (1, 1, 1), tex=tex, rough=rough, metal=metal)


M = {
    "cup": mat("PenCupGlaze", "#2c3e5c", 0.25), "cupBand": mat("PenCupBand", "#e8e2d4", 0.3), "cupIn": mat("PenCupInside", "#1a2333", 0.6),
    "ink": mat("DeskInk", "#16171a", 0.5), "white": mat("DeskWhite", "#f2f0ea", 0.5), "chrome": mat("DeskChrome", "#d9dde2", 0.15, 1.0),
    "steel": mat("DeskSteel", "#9aa0a8", 0.3, 0.9), "printer": mat("PrinterBody", "#eceae4", 0.45), "printerDark": mat("PrinterDark", "#3a3c40", 0.45),
    "slot": mat("DeskSlot", "#0b0c0e", 0.6), "paper": mat("ReceiptPaper", "#fbfaf6", 0.8), "green": mat("LedGreen", "#3ddc6a", 0.3),
    "amber": mat("LedAmber", "#ffb21e", 0.3), "red": mat("KeyRed", "#c8322a", 0.4), "yellow": mat("KeyYellow", "#e7bf2a", 0.4),
    "keyGreen": mat("KeyGreen", "#2f9a4c", 0.4), "reader": mat("ReaderBody", "#26282d", 0.45), "readerTrim": mat("ReaderTrim", "#3b3e45", 0.4),
    "key": mat("ReaderKey", "#d6d9de", 0.4), "screen": mat("ReaderScreen", "#123a5c", 0.15), "bellBase": mat("BellBase", "#1d1b19", 0.4),
    "mat": mat("DeskMatWood", "#ffffff", 0.6, tex=hinoki_tex), "matEdge": mat("DeskMatEdge", "#b8915c", 0.6), "felt": mat("DeskMatFelt", "#3a3530", 0.9),
    "hole": mat("DeskHole", "#060607", 0.6), "holeRing": mat("DeskHoleRing", "#3a3c40", 0.3, 0.8), "cable": mat("DeskCable", "#17171a", 0.4),
    "cableW": mat("DeskCableWhite", "#e9e9ec", 0.4),
}
PEN_COLORS = ["#1f3f9c", "#c22a24", "#16171a", "#2f8a4a", "#e05a9c", "#f0e14a", "#7a4ab0", "#ef8a2a", "#1f9cc8", "#16171a", "#d0d4da"]


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


def box(name, size, at, mat_, bev=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat_, smooth_shade=False)
    if bev:
        bevel(o, bev, 3, angle=False)
        apply_mods(o)
        smooth_angle(o)
    return o


def cyl(name, r, depth, at, mat_, rot=(0, 0, 0), verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat_)
    smooth_angle(o, 40)
    return o


def text(name, body, size, mat_, at, rot, font=None, fit=None):
    bpy.ops.object.text_add(location=at, rotation=rot)
    t = active()
    t.data.body = body
    t.data.size = size
    t.data.align_x = "CENTER"
    t.data.align_y = "CENTER"
    t.data.extrude = 0.0001
    if font:
        t.data.font = font
    bpy.ops.object.convert(target="MESH")
    t = active()
    if fit and t.dimensions.x > fit:
        t.scale.x = fit / t.dimensions.x
        apply_scale(t)
    return finish(t, name, mat_, smooth_shade=False)


def tube(name, pts, r, mat_):
    """a cable through the points (three frame)"""
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = r
    cd.bevel_resolution = 3
    cd.resolution_u = 10
    sp = cd.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(P(*p))
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(o)
    cd.materials.append(mat_)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return active()


def hole(prefix, x, z):
    """a small cable hole let into the surface the device stands on, its ring flush, black inside"""
    return [cyl(f"{prefix}HoleRing", 0.007, 0.0008, P(x, 0.0004, z), M["holeRing"], verts=24),
            cyl(f"{prefix}Hole", 0.0045, 0.0009, P(x, 0.00045, z), M["hole"], verts=20)]


def node(name, parts):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    # (only what isn't already inside another part: the terminal keeps its screen and keys)
    for o in parts:
        if o.parent is None:
            o.parent = e
    return e, parts


nodes = []

# =====================================================================
# The pen cup: a tall glazed cup, a pale band round it, full of pens and the rest
# =====================================================================
pc = []
CR, CH = 0.034, 0.088
cup = cyl("PenCup", CR, CH, P(0, CH / 2, 0), M["cup"], verts=40, r2=CR * 0.94)
inner = cyl("pcin", CR - 0.003, CH, P(0, CH / 2 + 0.004, 0), M["cup"], verts=40, r2=CR * 0.94 - 0.003)
m_ = cup.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = inner; m_.solver = "EXACT"
apply_mods(cup)
bpy.data.objects.remove(inner)
pc.append(cup)
pc.append(cyl("PenCupBand", CR * 0.975 + 0.0004, 0.012, P(0, CH * 0.62, 0), M["cupBand"], verts=40))
pc.append(cyl("PenCupFloor", CR - 0.0035, 0.002, P(0, CH * 0.35, 0), M["cupIn"], verts=32))
rng2 = np.random.default_rng(5)
for i, col in enumerate(PEN_COLORS):
    a = 2 * math.pi * i / len(PEN_COLORS) + rng2.uniform(-0.2, 0.2)
    rr = (CR - 0.012) * math.sqrt(rng2.uniform(0.15, 1))
    bx, bz = rr * math.cos(a), rr * math.sin(a)
    tilt = 0.12 + 0.16 * rr / CR
    L = rng2.uniform(0.13, 0.15)
    marker = i in (3, 7)
    rad = 0.0055 if marker else 0.0038
    # (leaning out from the middle, its foot on the cup's floor)
    d = Vector((bx, bz, 0)).normalized() if rr > 1e-4 else Vector((1, 0, 0))
    rot = (-d.y * tilt, d.x * tilt, 0)
    body = cyl(f"Pen{i}", rad, L, (bx, -bz, CH * 0.35 + L / 2), mat(f"Pen{i}Col", col, 0.4), rot=rot, verts=10)
    pc.append(body)
    # (its cap, or its click button, at the top)
    top = Vector((bx, -bz, CH * 0.35 + L / 2)) + body.matrix_world.to_3x3() @ Vector((0, 0, L / 2 + 0.006))
    cap = cyl(f"PenCap{i}", rad * (1.15 if marker else 0.8), 0.014 if marker else 0.006, tuple(top), M["ink"] if not marker else mat(f"Pen{i}Col", col, 0.4), rot=rot, verts=10)
    pc.append(cap)
    if not marker and i % 2 == 0:
        clip_at = Vector((bx, -bz, CH * 0.35 + L / 2)) + body.matrix_world.to_3x3() @ Vector((rad + 0.0006, 0, L / 2 - 0.012))
        pc.append(box(f"PenClip{i}", (0.0012, 0.003, 0.022), tuple(clip_at), M["chrome"], rot=rot))
# (scissors, their orange handles up; a clear ruler leaning at the back)
for k in (-1, 1):
    ring = cyl(f"ScissorRing{k}", 0.009, 0.004, P(0.012 * k, CH + 0.05, -0.006), mat("ScissorHandle", "#ef7a1e", 0.4), rot=(math.pi / 2, 0, 0.3 * k), verts=20)
    pc.append(ring)
pc.append(box("ScissorBlades", (0.006, 0.002, 0.07), P(0.0, CH + 0.005, -0.006), M["steel"]))
pc.append(box("PenRuler", (0.028, 0.0015, 0.16), P(-0.01, CH * 0.35 + 0.08, 0.012), mat("RulerClear", "#cfe3ee", 0.1), rot=(-0.12, 0.05, 0)))
nodes.append(node("TillPens", pc))

# =====================================================================
# The receipt printer: a pale thermal printer, its cover rounded over the paper roll at the back, the slip coming out of the slot
# =====================================================================
pr = []
PW, PH, PD = 0.13, 0.085, 0.15
pr.append(box("PrinterBase", S(PW, 0.012, PD), P(0, 0.006, 0), M["printerDark"], bev=0.004))
pr.append(box("PrinterBody", S(PW, PH - 0.012, PD - 0.004), P(0, 0.012 + (PH - 0.012) / 2, 0), M["printer"], bev=0.012))
# (the cover over the roll: the back two thirds of the top, a shade darker, its seam round it)
pr.append(box("PrinterCover", S(PW - 0.012, 0.006, PD * 0.62), P(0, PH + 0.001, -PD * 0.15), M["printer"], bev=0.004))
pr.append(box("PrinterSeam", S(PW - 0.008, 0.0012, 0.0015), P(0, PH + 0.0002, PD * 0.16), M["slot"]))
# (the slot in front of the cover, its serrated cutter, and the slip of paper standing out of it, curling toward the cashier)
pr.append(box("PrinterSlot", S(PW * 0.72, 0.0014, 0.005), P(0, PH + 0.0003, PD * 0.2), M["slot"]))
for k in range(18):
    pr.append(box(f"PrinterTooth{k}", (0.0018, 0.0016, 0.0012), P(-PW * 0.34 + k * PW * 0.68 / 17, PH + 0.001, PD * 0.2 + 0.003), M["steel"]))
slip = bpy.data.objects.new("ReceiptSlip", None)
bm = bmesh.new()
segs = 10
vs = []
for i in range(segs + 1):
    t = i / segs
    y = PH + 0.001 + 0.05 * t
    z = PD * 0.2 + 0.03 * t * t
    vs.append((bm.verts.new(P(-0.028, y, z)), bm.verts.new(P(0.028, y, z))))
for a, b in zip(vs, vs[1:]):
    bm.faces.new((a[0], a[1], b[1], b[0]))
me = bpy.data.meshes.new("ReceiptSlip")
bm.to_mesh(me)
bm.free()
slip = bpy.data.objects.new("ReceiptSlip", me)
bpy.context.collection.objects.link(slip)
finish(slip, "ReceiptSlip", M["paper"])
sl = slip.modifiers.new("Solidify", "SOLIDIFY"); sl.thickness = 0.0004
apply_mods(slip)
pr.append(slip)
# (its lights (power, error, paper) and the feed button, on the front's top right; the cover's release lever on the left)
for k, m_ in enumerate((M["green"], M["amber"], M["slot"])):
    pr.append(cyl(f"PrinterLed{k}", 0.0016, 0.0008, P(PW * 0.3 + k * 0.007, PH - 0.006, PD / 2 - 0.0003), m_, rot=(math.pi / 2, 0, 0), verts=12))
pr.append(box("PrinterFeed", S(0.016, 0.008, 0.003), P(PW * 0.32, PH - 0.018, PD / 2), M["printerDark"], bev=0.0012))
pr.append(text("PrinterFeedLabel", "FEED", 0.0035, M["white"], P(PW * 0.32, PH - 0.018, PD / 2 + 0.0016), (math.pi / 2, 0, 0), BOLD))
pr.append(box("PrinterLever", S(0.018, 0.006, 0.004), P(-PW * 0.32, PH - 0.006, PD / 2 - 0.001), M["printerDark"], bev=0.0015))
# (vents down its side, the power switch on the right side)
for k in range(6):
    pr.append(box(f"PrinterVent{k}", S(0.0008, 0.03, 0.003), P(-PW / 2 - 0.0002, 0.04, -0.03 + k * 0.009), M["slot"]))
pr.append(box("PrinterSwitch", S(0.003, 0.012, 0.008), P(PW / 2 + 0.0012, 0.035, -0.04), M["printerDark"], bev=0.001))
# (its lead out of the back, down into the hole behind it)
pr.append(tube("PrinterCable", [(0.03, 0.02, -PD / 2), (0.03, 0.012, -PD / 2 - 0.012), (0.03, 0.002, -PD / 2 - 0.02), (0.03, -0.01, -PD / 2 - 0.022)], 0.0028, M["cable"]))
pr += hole("Printer", 0.03, -PD / 2 - 0.022)
nodes.append(node("TillPrinter", pr))

# =====================================================================
# The card reader: a payment terminal, its face to the customers (-z), lying back on its cradle
# =====================================================================
cr = []
cradle = box("ReaderCradle", S(0.08, 0.012, 0.11), P(0, 0.006, 0.0), M["readerTrim"], bev=0.004)
cr.append(cradle)
term = bpy.data.objects.new("ReaderTerminal", None)
bpy.context.collection.objects.link(term)
# (high enough on its cradle that its low end, tipped back, clears the cradle's top)
term.location = P(0, 0.012 + 0.015 * math.cos(0.35) + 0.075 * math.sin(0.35) + 0.002, 0)
term.rotation_euler = (-0.35, 0, math.pi)  # (lying back on its cradle, its face up and turned to the customers)
tp = []
RW, RH, RD = 0.074, 0.15, 0.03
body = box("ReaderBody", S(RW, RD, RH), P(0, 0, 0), M["reader"], bev=0.009)
tp.append(body)
FACE = RD / 2
# the screen at the top of the face, its contactless mark above it; the keys below; the card slot at the foot
tp.append(box("ReaderScreenBezel", S(RW - 0.012, 0.0008, 0.05), P(0, FACE + 0.0003, -0.035), M["slot"], bev=0.002))
tp.append(box("ReaderScreen", S(RW - 0.018, 0.0006, 0.042), P(0, FACE + 0.0008, -0.035), M["screen"]))
tp.append(text("ReaderAmount", "¥ 2,080", 0.008, M["white"], P(0, FACE + 0.0012, -0.042), (-math.pi / 2, 0, math.pi), BOLD))
tp.append(text("ReaderPrompt", "カードをどうぞ", 0.0042, M["white"], P(0, FACE + 0.0012, -0.026), (-math.pi / 2, 0, math.pi), JA, fit=RW - 0.024))
for k, rad in enumerate((0.003, 0.0045, 0.006)):
    arc = cyl(f"ReaderNfc{k}", rad, 0.0003, P(0, FACE + 0.0003, -0.067), M["white"], verts=24)
    inner = cyl("nfcin", rad - 0.0006, 0.002, P(0, FACE + 0.0003, -0.067), M["white"], verts=24)
    m_ = arc.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = inner; m_.solver = "EXACT"
    apply_mods(arc)
    bpy.data.objects.remove(inner)
    arc.rotation_euler = (math.pi / 2, 0, 0)
    tp.append(arc)
labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]
for i, lab in enumerate(labels):
    kx = (i % 3 - 1) * 0.019
    kz = 0.0 + (i // 3) * 0.013
    tp.append(box(f"ReaderKey{i}", S(0.015, 0.003, 0.009), P(kx, FACE + 0.0015, kz), M["key"], bev=0.0012))
    tp.append(text(f"ReaderKeyLabel{i}", lab, 0.0055, M["ink"], P(kx, FACE + 0.0031, kz), (-math.pi / 2, 0, math.pi), BOLD))
for k, (m_, lab) in enumerate(((M["red"], "×"), (M["yellow"], "<"), (M["keyGreen"], "O"))):
    kx = (k - 1) * 0.019
    tp.append(box(f"ReaderFn{k}", S(0.015, 0.003, 0.009), P(kx, FACE + 0.0015, 0.054), m_, bev=0.0012))
    tp.append(text(f"ReaderFnLabel{k}", lab, 0.006, M["white"], P(kx, FACE + 0.0031, 0.054), (-math.pi / 2, 0, math.pi), BOLD))
tp.append(box("ReaderChipSlot", S(0.06, 0.004, 0.003), P(0, 0.002, RH / 2 + 0.0002), M["slot"]))
tp.append(box("ReaderStripe", S(0.002, 0.004, 0.09), P(RW / 2 + 0.0002, 0.0, -0.01), M["slot"]))
for o in tp:
    o.parent = term
# (set it down so its lowest point rests on the cradle's top, and prop its raised end on a wedge-shaped back rest)
bpy.context.view_layer.update()
low = min((term.matrix_world @ body.matrix_local @ vv.co).z for vv in body.data.vertices)
term.location.z += (0.012 + 0.0005) - low
bpy.context.view_layer.update()
under = [(term.matrix_world @ body.matrix_local @ vv.co) for vv in body.data.vertices]
# (the underside's highest point over the cradle, toward the cashier's side (+z three, Blender -y): the rest fills up to it)
back = max(under, key=lambda q: -q.y)
rest_h = max(0.004, min(q.z for q in under if q.y < back.y + 0.01) - 0.012)
cr.append(box("ReaderRest", (0.05, 0.03, rest_h), (0, back.y + 0.012, 0.012 + rest_h / 2), M["readerTrim"], bev=0.002))
cr.append(term)
cr += tp
# (its lead from the cradle's back (the cashier's side), down into the hole behind it)
cr.append(tube("ReaderCable", [(0.0, 0.008, 0.055), (0.0, 0.006, 0.066), (0.0, 0.002, 0.072), (0.0, -0.01, 0.074)], 0.0024, M["cable"]))
cr += hole("Reader", 0.0, 0.074)
nodes.append(node("TillCardReader", cr))

# =====================================================================
# The service bell: a chrome dome on a black base, the plunger on top
# =====================================================================
bl = []
bl.append(cyl("BellBase", 0.042, 0.014, P(0, 0.007, 0), M["bellBase"], verts=40))
bl.append(cyl("BellBaseRim", 0.043, 0.003, P(0, 0.0015, 0), M["felt"], verts=40))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.036, location=P(0, 0.014, 0), segments=40, ring_count=20)
dome = active()
cut_ = box("domecut", (0.1, 0.1, 0.05), (0, 0, 0.014 - 0.025), M["chrome"])
m_ = dome.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = cut_; m_.solver = "EXACT"
apply_mods(dome)
bpy.data.objects.remove(cut_)
finish(dome, "BellDome", M["chrome"])
dome.scale = (1, 1, 0.78)
apply_scale(dome)
bl.append(dome)
bl.append(cyl("BellStem", 0.0025, 0.012, P(0, 0.014 + 0.028 + 0.006, 0), M["chrome"], verts=12))
bl.append(cyl("BellKnob", 0.0075, 0.005, P(0, 0.014 + 0.028 + 0.013, 0), M["chrome"], verts=24))
nodes.append(node("TillBell", bl))

# =====================================================================
# The desk mat: a hinoki board with rounded corners and eased edges, felt underneath, the reader, the printer, the pens and the tablet on it
# =====================================================================
MW, MD, MT = 0.5, 0.39, 0.015
mt = []
bm = bmesh.new()
pts = []
R = 0.03
for cx, cz, a0 in ((MW / 2 - R, -MD / 2 + R, -90), (MW / 2 - R, MD / 2 - R, 0), (-MW / 2 + R, MD / 2 - R, 90), (-MW / 2 + R, -MD / 2 + R, 180)):
    for k in range(9):
        a = math.radians(a0 + 90 * k / 8)
        pts.append((cx + R * math.cos(a), cz + R * math.sin(a)))
bot = [bm.verts.new(P(x, 0.002, z)) for x, z in pts]
topv = [bm.verts.new(P(x, MT, z)) for x, z in pts]
bm.faces.new(list(reversed(bot)))
bm.faces.new(topv)
for i in range(len(pts)):
    j = (i + 1) % len(pts)
    bm.faces.new((bot[i], bot[j], topv[j], topv[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("DeskMat")
bm.to_mesh(me)
bm.free()
board = bpy.data.objects.new("DeskMat", me)
bpy.context.collection.objects.link(board)
finish(board, "DeskMat", M["mat"], smooth_shade=False)
bevel(board, 0.003, 3, angle=True)
apply_mods(board)
smooth_angle(board)
bpy.ops.object.select_all(action="DESELECT")
board.select_set(True)
bpy.context.view_layer.objects.active = board
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.cube_project(cube_size=0.6)
bpy.ops.object.mode_set(mode="OBJECT")
mt.append(board)
mt.append(box("DeskMatFelt", S(MW - 0.01, 0.002, MD - 0.01), P(0, 0.001, 0), M["felt"]))
nodes.append(node("TillMat", mt))

root = bpy.data.objects.new("TillDesk", None)
bpy.context.collection.objects.link(root)
parts = []
for i, (e, ps) in enumerate(nodes):
    e.parent = root
    parts += [e] + ps
if PREVIEW:
    # (laid out side by side for the picture only)
    for i, (e, _) in enumerate(nodes[:4]):
        e.location = (-0.3 + i * 0.2, 0, 0.0)
    nodes[4][0].location = (0, 0.35, 0)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.05, -0.75, 0.45)
    cam.rotation_euler = (Vector((0, 0.05, 0.05)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 40
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
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = 1280, 900
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for e, _ in nodes:
        e.location = (0, 0, 0)

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "tilldesk.glb"), os.path.join(PROJECT, "blender", "tilldesk.blend"))
print("TILLDESK_DONE", len(parts), "parts")
