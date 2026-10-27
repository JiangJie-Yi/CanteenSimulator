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
# (the cup's glaze: a deep blue, speckled with iron, paler where it ran thin)
speck = (rng.random((N, N)) > 0.985).astype(np.float32)
glaze = mix(mix((0.13, 0.2, 0.33), (0.2, 0.3, 0.46), fbm(N, 6, 12, 4)), (0.55, 0.47, 0.36), speck * 0.8)
glaze_tex = image("glaze", glaze)
# (the grain of the stand's hinoki: straight, fine, a warm pale gold)
grain2 = fbm(N, 3, 60, 5)
hinoki = mix((0.93, 0.8, 0.6), (0.82, 0.66, 0.45), smooth(0.35, 0.8, grain2))
hinoki_tex = image("hinoki2", hinoki)
# (the cat's stone: a grey river stone, mottled, a few pale flecks)
stone = mix(mix((0.22, 0.22, 0.21), (0.36, 0.35, 0.33), fbm(N, 5, 5, 5)), (0.7, 0.68, 0.64), (rng.random((N, N)) > 0.97).astype(np.float32) * 0.6)
stone_tex = image("catstone", stone)
# (the stand's walnut, flat-sawn: its growth rings cut through at a slant come out as nested arches and long ellipses, wavering, the latewood
# a fine darker line, the pores flecked along the grain)
def flatsawn(n, light, dark, line, rings=11.0, seed_u=0.5):
    uu, vv = grid01(n)
    wob = fbm(n, 3, 3, 4) - 0.5
    d = np.sqrt(((uu - seed_u) * 3.2 + wob * 0.5) ** 2 + ((vv + 0.35) * 0.9 + wob * 0.25) ** 2)
    ring = (d * rings + fbm(n, 2, 6, 3) * 0.8) % 1.0
    late = smooth(0.72, 0.9, ring) * (1 - smooth(0.9, 1.0, ring))
    body = mix(mix(light, dark, smooth(0.15, 0.85, ring) * 0.55), line, late * 0.75)
    return mix(body, line, (fbm(n, 70, 4, 3) > 0.62).astype(np.float32) * 0.18)


def walnut_board(n):
    """walnut as it's usually seen on furniture: mostly straight, fine grain running along the board (along u: the stand's width), gently
    wavering, a soft cathedral of growth rings rising through part of it, darker streaks of heartwood, open pores flecked along the grain;
    a warm brown, not near black"""
    uu, vv = grid01(n)
    warp = (fbm(n, 4, 1, 4) - 0.5) * 0.06 + (fbm(n, 1, 2, 3) - 0.5) * 0.04
    # (the fine grain: lines of uneven spacing and strength, some fading out and coming back, not a regular stripe)
    phase = (vv + warp) * 64 + fbm(n, 6, 1, 3) * 2.2 + fbm(n, 2, 1, 2) * 3
    fine = (np.sin(phase * math.pi * 2) * 0.5 + 0.5) * (0.4 + 0.6 * fbm(n, 9, 2, 3))
    fine = smooth(0.45, 0.9, fine)
    # (the cathedral: wide arches along the board, only through the middle of it, faint)
    d = np.sqrt(((vv - 0.5) * 2.6 + warp) ** 2 + ((uu + 0.6) * 0.55) ** 2)
    arch = smooth(0.75, 0.95, (d * 7 + fbm(n, 5, 2, 3) * 0.6) % 1.0) * np.exp(-((vv - 0.5) / 0.22) ** 2)
    streak = smooth(0.45, 0.85, fbm(n, 1, 5, 4))
    # (a lighter, warm walnut: honey-brown sapwood tones through the darker heart, the grain a soft shade darker, not a heavy line)
    col = mix((0.6, 0.42, 0.27), (0.48, 0.32, 0.2), streak * 0.85)
    col = mix(col, (0.36, 0.23, 0.14), fine * 0.18 + arch * 0.14)
    pores = (fbm(n, 5, 120, 2) > 0.68).astype(np.float32)
    return mix(col, (0.28, 0.18, 0.11), pores * 0.18)


walnut_tex = image("walnut", walnut_board(512))
# (the change tray's floor: a black resin, a faint sheen in its texture)
resin_tex = image("resin", mix((0.05, 0.05, 0.055), (0.09, 0.085, 0.09), fbm(N, 20, 20, 3)))


def mat(name, hexs, rough=0.5, metal=0.0, tex=None):
    return pbr(name, lin(hexs) if tex is None else (1, 1, 1), tex=tex, rough=rough, metal=metal)


M = {
    "cup": mat("PenCupGlaze", "#2c3e5c", 0.25), "cupBand": mat("PenCupBand", "#e8e2d4", 0.3), "cupIn": mat("PenCupInside", "#1a2333", 0.6),
    "cupGlaze": mat("PenCupGlaze", "#ffffff", 0.2, tex=glaze_tex), "cupRim": mat("PenCupRim", "#b9a585", 0.7), "scissor": mat("ScissorHandle", "#ef7a1e", 0.4),
    "gold": mat("BellGold", "#d4af37", 0.15, 1.0), "bellWood": mat("BellWood", "#3a2416", 0.4),
    "ink": mat("DeskInk", "#16171a", 0.5), "white": mat("DeskWhite", "#f2f0ea", 0.5), "chrome": mat("DeskChrome", "#d9dde2", 0.15, 1.0),
    "steel": mat("DeskSteel", "#9aa0a8", 0.3, 0.9), "printer": mat("PrinterBody", "#eceae4", 0.45), "printerDark": mat("PrinterDark", "#3a3c40", 0.45),
    "slot": mat("DeskSlot", "#0b0c0e", 0.6), "paper": mat("ReceiptPaper", "#fbfaf6", 0.8), "green": mat("LedGreen", "#3ddc6a", 0.3),
    "amber": mat("LedAmber", "#ffb21e", 0.3), "red": mat("KeyRed", "#c8322a", 0.4), "yellow": mat("KeyYellow", "#e7bf2a", 0.4),
    "keyGreen": mat("KeyGreen", "#2f9a4c", 0.4), "reader": mat("ReaderBody", "#383b40", 0.4), "readerTrim": mat("ReaderTrim", "#3b3e45", 0.4),
    "key": mat("ReaderKey", "#d6d9de", 0.4), "screen": mat("ReaderScreen", "#123a5c", 0.15), "bellBase": mat("BellBase", "#1d1b19", 0.4),
    "mat": mat("DeskMatWood", "#ffffff", 0.6, tex=hinoki_tex), "matEdge": mat("DeskMatEdge", "#b8915c", 0.6), "felt": mat("DeskMatFelt", "#3a3530", 0.9),
    "walnut": mat("StandWalnut", "#ffffff", 0.45, tex=walnut_tex), "walnutEnd": mat("StandWalnutEnd", "#2a1a10", 0.5),
    "brass": mat("StandBrass", "#c9a24a", 0.25, 1.0), "drawerIn": mat("StandDrawerInside", "#6a4a30", 0.7),
    "resin": mat("TrayResin", "#ffffff", 0.35, tex=resin_tex), "resinRib": mat("TrayRib", "#1a1a1c", 0.5), "gilt": mat("TrayGilt", "#d4b25a", 0.3, 0.8),
    "rubber": mat("TrayFoot", "#202020", 0.9),
    "potGlaze": mat("TreePotGlaze", "#9c2a1e", 0.2), "potFoot": mat("TreePotFoot", "#5a3a28", 0.8), "soil": mat("TreeSoil", "#3a2a1c", 0.95),
    "pebble": mat("TreePebble", "#e8e2d4", 0.6), "bark": mat("TreeBark", "#8a7a52", 0.8), "stem": mat("TreeStem", "#6f8a3a", 0.6),
    "leaf": mat("TreeLeaf", "#2f7a2e", 0.3), "leaf2": mat("TreeLeaf2", "#3f9238", 0.3), "ribbonRed": mat("TreeRibbon", "#c8221a", 0.5),
    "coinGold": mat("IngotGold", "#e0b24a", 0.15, 1.0), "lacquerRed": mat("IngotStand", "#8e1e16", 0.25), "cushion": mat("IngotCushion", "#c4321e", 0.7),
    "lcd": mat("ReaderLcd", "#aab3a6", 0.3), "lcdInk": mat("ReaderLcdInk", "#1c2420", 0.5), "card": mat("ReaderCardFace", "#2f7fd0", 0.3),
    "cardBand": mat("ReaderCardBand", "#7fb6ea", 0.3), "keyRubber": mat("ReaderKeyRubber", "#3a3d42", 0.6),
    "hole": mat("DeskHole", "#060607", 0.6), "holeRing": mat("DeskHoleRing", "#3a3c40", 0.3, 0.8), "cable": mat("DeskCable", "#17171a", 0.4),
    "cableW": mat("DeskCableWhite", "#e9e9ec", 0.4),
    "stone": mat("CatStone", "#ffffff", 0.75, tex=stone_tex),
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
# The pen cup: a glazed stoneware cup (a speckled glaze, a pale band, its rim left bare), the pens stood in it in order: a ring of
# ballpoints round the inside, sorted by colour and leaning evenly out, and in the middle the markers, a highlighter and the scissors upright
# =====================================================================
pc = []
CR, CH = 0.034, 0.09
cup = cyl("PenCup", CR, CH, P(0, CH / 2, 0), M["cupGlaze"], verts=48, r2=CR * 0.96)
inner = cyl("pcin", CR - 0.0032, CH, P(0, CH / 2 + 0.004, 0), M["cupGlaze"], verts=48, r2=CR * 0.96 - 0.0032)
m_ = cup.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = inner; m_.solver = "EXACT"
apply_mods(cup)
bpy.data.objects.remove(inner)
bpy.ops.object.select_all(action="DESELECT"); cup.select_set(True); bpy.context.view_layer.objects.active = cup
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cylinder_project(); bpy.ops.object.mode_set(mode="OBJECT")
pc.append(cup)
pc.append(cyl("PenCupRim", CR * 0.96 + 0.0002, 0.003, P(0, CH - 0.0015, 0), M["cupRim"], verts=48))
pc.append(cyl("PenCupBand", CR * 0.985 + 0.0004, 0.010, P(0, CH * 0.6, 0), M["cupBand"], verts=48))
pc.append(cyl("PenCupFloor", CR - 0.0035, 0.002, P(0, 0.012, 0), M["cupIn"], verts=32))
FLOOR = 0.013
RING = ["#1f3f9c", "#1f9cc8", "#2f8a4a", "#f0e14a", "#ef8a2a", "#c22a24", "#e05a9c", "#7a4ab0", "#16171a", "#d0d4da"]
LEAN = 0.13
for i, col in enumerate(RING):
    a = 2 * math.pi * i / len(RING)
    rr = CR - 0.009
    bx, bz = rr * math.cos(a), rr * math.sin(a)
    L = 0.14 if i % 2 == 0 else 0.132
    # (leaning straight out from the middle, all by the same angle)
    rot = (math.sin(a) * LEAN, math.cos(a) * LEAN, 0)
    body = cyl(f"Pen{i}", 0.0037, L, (bx, -bz, FLOOR + L / 2), mat(f"Pen{i}Col", col, 0.35), rot=rot, verts=12)
    pc.append(body)
    up = body.matrix_world.to_3x3() @ Vector((0, 0, 1))
    tip = Vector((bx, -bz, FLOOR + L / 2)) + up * (L / 2 + 0.0035)
    pc.append(cyl(f"PenCap{i}", 0.0029, 0.007, tuple(tip), M["chrome"] if i % 3 == 0 else M["ink"], rot=rot, verts=12))
    # (a clip on each, down the outside)
    out = Vector((math.cos(a), -math.sin(a), 0))
    clip = Vector((bx, -bz, FLOOR + L / 2)) + up * (L / 2 - 0.012) + out * 0.0042
    pc.append(box(f"PenClip{i}", (0.0014, 0.0014, 0.02), tuple(clip), M["chrome"], rot=rot))
# (the middle: two thick markers, a highlighter, the scissors, upright and side by side)
for k, (col, dx, dz, L, r) in enumerate((("#16171a", -0.007, -0.006, 0.13, 0.0058), ("#c22a24", 0.007, -0.006, 0.13, 0.0058), ("#f0e14a", 0.0, 0.008, 0.125, 0.0065))):
    pc.append(cyl(f"Marker{k}", r, L, P(dx, FLOOR + L / 2, dz), mat(f"Marker{k}Col", col, 0.4), verts=14))
    pc.append(cyl(f"MarkerCap{k}", r * 1.08, 0.022, P(dx, FLOOR + L - 0.011, dz), mat(f"Marker{k}Col", col, 0.4), verts=14))
    pc.append(cyl(f"MarkerBand{k}", r * 1.1, 0.004, P(dx, FLOOR + L - 0.024, dz), M["white"], verts=14))
for k in (-1, 1):
    pc.append(cyl(f"ScissorRing{k}", 0.008, 0.0035, P(0.0105 * k, FLOOR + 0.142, 0.0), M["scissor"], rot=(0, math.pi / 2, 0), verts=24))
pc.append(box("ScissorPivot", (0.003, 0.003, 0.03), P(0.0, FLOOR + 0.125, 0.0), M["steel"]))
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
# (its lead: out of the back low down, a short loop round the back corner and along beside it, down into a hole by its side, so it stays on the
# stand however the printer is turned)
HX, HZ = PW / 2 + 0.018, -PD / 2 + 0.035
pr.append(tube("PrinterCable", [(0.03, 0.02, -PD / 2), (0.034, 0.012, -PD / 2 - 0.01), (PW / 2 + 0.006, 0.006, -PD / 2 - 0.012),
                                (HX, 0.004, -PD / 2 + 0.004), (HX, 0.002, HZ - 0.008), (HX, -0.01, HZ)], 0.0028, M["cable"]))
pr += hole("Printer", HX, HZ)
nodes.append(node("TillPrinter", pr))

# =====================================================================
# The card reader: a countertop payment terminal lying on the stand, its keypad and card slot toward the customers (-z), its built-in
# receipt printer at the back toward the cashier. Its shell rises from the slot at the front up the keypad's gentle slope to the screen,
# then swells over the paper roll; under the screen two soft keys and the scroll keys; the rubber keypad, each key's figure and letters;
# F, 0 and the point; the red, yellow and green keys across the foot; the chip slot; the lead out of the back
# =====================================================================
cr = []
RW, RL = 0.082, 0.19                      # its width and length (front -z to back +z)
FZ, BZ = -RL / 2, RL / 2
# (the shell's side: (z, top height) from the front to the back)
SIDE = [(FZ, 0.022), (FZ + 0.012, 0.026), (0.0, 0.036), (0.004, 0.037), (0.046, 0.046), (0.054, 0.052), (0.062, 0.062), (0.078, 0.066), (BZ - 0.004, 0.064), (BZ, 0.058)]
bm_ = bmesh.new()
left, right = [], []
outline = [(FZ, 0.003)] + SIDE + [(BZ, 0.003)]
for zz, yy in outline:
    left.append(bm_.verts.new(P(-RW / 2, yy, zz)))
    right.append(bm_.verts.new(P(RW / 2, yy, zz)))
bm_.faces.new(left)
bm_.faces.new(list(reversed(right)))
n_ = len(outline)
for i in range(n_):
    j = (i + 1) % n_
    bm_.faces.new((left[i], left[j], right[j], right[i]))
bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
me_ = bpy.data.meshes.new("ReaderBody")
bm_.to_mesh(me_)
bm_.free()
shell = bpy.data.objects.new("ReaderBody", me_)
bpy.context.collection.objects.link(shell)
finish(shell, "ReaderBody", M["reader"], smooth_shade=False)
bevel(shell, 0.007, 4, angle=True)
apply_mods(shell)
smooth_angle(shell, 40)
cr.append(shell)
# (a softer grey band round its waist, the shell's two halves meeting)
cr.append(box("ReaderSeamL", S(0.0012, 0.003, RL - 0.02), P(-RW / 2 - 0.0002, 0.012, 0), M["readerTrim"]))
cr.append(box("ReaderSeamR", S(0.0012, 0.003, RL - 0.02), P(RW / 2 + 0.0002, 0.012, 0), M["readerTrim"]))


def top_at(zz):
    """the shell's top height at z (along the side's line)"""
    for (z0, y0), (z1, y1) in zip(SIDE, SIDE[1:]):
        if z0 <= zz <= z1:
            return y0 + (y1 - y0) * (zz - z0) / (z1 - z0)
    return SIDE[-1][1]


def panel(name, z0, z1):
    """an empty lying on the shell's top between z0 and z1, tilted to its slope, its local +y up out of the surface (children laid flat on it)"""
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    y0, y1 = top_at(z0), top_at(z1)
    e.location = P(0, (y0 + y1) / 2 + 0.0004, (z0 + z1) / 2)
    e.rotation_euler = (-math.atan2(y1 - y0, z1 - z0), 0, 0)
    return e


def on(e, objs):
    for o in objs:
        o.parent = e
    cr.extend(objs)
    return objs


TXT = (0, 0, math.pi)                     # (a text lying flat, reading from the customers' side)
# (the keypad: the slope from the foot to the screen)
kp = panel("ReaderKeypad", FZ + 0.012, 0.0)
cr.append(kp)
rows = [("1", "QZ"), ("2", "ABC"), ("3", "DEF"), ("4", "GHI"), ("5", "JKL"), ("6", "MNO"), ("7", "PRS"), ("8", "TUV"), ("9", "WXY"),
        ("F", ""), ("0", ""), (".", "")]
for i, (lab, sub) in enumerate(rows):
    kx = (i % 3 - 1) * 0.022
    kz = 0.031 - (i // 3) * 0.0155          # (in the panel's frame: the first row by the screen, down toward the foot)
    key = box(f"ReaderKey{i}", S(0.017, 0.0035, 0.0105), P(kx, 0.0017, kz), M["keyRubber"], bev=0.0016)
    # (the figure on the customer's left of the key, its letters small on the right)
    lab_o = text(f"ReaderKeyLabel{i}", lab, 0.0058, M["white"], P(kx + (0.003 if sub else 0), 0.0036, kz), TXT, BOLD)
    objs = [key, lab_o]
    if sub:
        objs.append(text(f"ReaderKeySub{i}", sub, 0.0024, M["white"], P(kx - 0.0042, 0.0036, kz - 0.0012), TXT, BOLD))
    on(kp, objs)
# (the red, yellow and green keys across the foot: cancel, correct, enter)
for k, (m_, lab) in enumerate(((M["red"], "×"), (M["yellow"], "<"), (M["keyGreen"], "O"))):
    kx = (k - 1) * 0.022
    on(kp, [box(f"ReaderFn{k}", S(0.018, 0.004, 0.0105), P(-kx, 0.0018, -0.0335), m_, bev=0.0018)])
# (under the screen: two soft keys at the sides, curved, and the up and down keys between them)
nav = panel("ReaderNav", 0.004, 0.02)
cr.append(nav)
for sx in (-1, 1):
    on(nav, [box(f"ReaderSoft{sx}", S(0.016, 0.003, 0.007), P(sx * 0.024, 0.0015, 0), M["key"], bev=0.0025)])
for k, sym in enumerate(("▲", "▼")):
    on(nav, [box(f"ReaderArrow{k}", S(0.011, 0.003, 0.007), P((k - 0.5) * 0.013, 0.0015, 0), M["key"], bev=0.0022),
             text(f"ReaderArrowLabel{k}", sym, 0.004, M["ink"], P((k - 0.5) * 0.013, 0.0031, 0), TXT, JA)])
# (the screen: a grey LCD in a glossy black surround, steeper than the keypad, its figures dark)
sc = panel("ReaderScreenPanel", 0.022, 0.054)
cr.append(sc)
# (what it shows is the game's to draw (TillDesk's reader screen: ready, or the amount while a card is being paid): the LCD's face carries UVs
# from corner to corner, upright as the customer reads it)
lcd_ = box("ReaderScreen", S(RW - 0.026, 0.0008, 0.022), P(0, 0.0011, 0), M["lcd"])
_me = lcd_.data
_xs = [v.co.x for v in _me.vertices]
_ys = [v.co.y for v in _me.vertices]
_uvl = _me.uv_layers.active.data if _me.uv_layers else _me.uv_layers.new().data
for _poly in _me.polygons:
    for _li in _poly.loop_indices:
        _co = _me.vertices[_me.loops[_li].vertex_index].co
        _uvl[_li].uv = (1 - (_co.x - min(_xs)) / (max(_xs) - min(_xs)), (_co.y - min(_ys)) / (max(_ys) - min(_ys)))
on(sc, [box("ReaderScreenBezel", S(RW - 0.012, 0.0012, 0.032), P(0, 0.0004, 0), M["slot"], bev=0.002), lcd_])
# (the printer at the back: its lid's seam, the tear bar's slot, a little of the slip showing, the lid's catch)
pt = panel("ReaderPrinter", 0.07, BZ - 0.006)
cr.append(pt)
on(pt, [box("ReaderLidSeam", S(RW - 0.014, 0.0008, 0.0012), P(0, 0.0003, -0.008), M["slot"]),
        box("ReaderTearSlot", S(RW - 0.02, 0.001, 0.003), P(0, 0.0004, 0.008), M["slot"]),
        box("ReaderSlip", S(RW - 0.026, 0.006, 0.0006), P(0, 0.003, 0.008), M["paper"], rot=(0.25, 0, 0)),
        box("ReaderCatch", S(0.012, 0.0012, 0.004), P(0, 0.0008, -0.014), M["readerTrim"], bev=0.0006)])
# (the chip slot at the foot, empty until someone pays)
cr.append(box("ReaderChipSlot", S(0.062, 0.004, 0.003), P(0, 0.012, FZ - 0.0002), M["slot"]))
# (felt feet, and its lead out of the back, down into the hole behind it)
for sx in (-1, 1):
    for sz in (-1, 1):
        cr.append(cyl(f"ReaderFoot{sx}{sz}", 0.005, 0.002, P(sx * (RW / 2 - 0.012), 0.001, sz * (RL / 2 - 0.02)), M["felt"], verts=12))
cr.append(tube("ReaderCable", [(0.0, 0.014, BZ - 0.002), (0.0, 0.012, BZ + 0.008), (0.0, 0.004, BZ + 0.014), (0.0, -0.01, BZ + 0.016)], 0.0024, M["cable"]))
cr += hole("Reader", 0.0, BZ + 0.016)
nodes.append(node("TillCardReader", cr))

# =====================================================================
# The service bell: a polished brass dome on a dark wooden base with a felt foot, the plunger (its own node, TillBellPlunger) on top
# =====================================================================
bl = []
bl.append(cyl("BellBase", 0.044, 0.015, P(0, 0.0075, 0), M["bellWood"], verts=48))
bl.append(cyl("BellBaseBevel", 0.045, 0.003, P(0, 0.0135, 0), M["bellWood"], verts=48, r2=0.042))
bl.append(cyl("BellBaseRim", 0.0445, 0.002, P(0, 0.001, 0), M["felt"], verts=48))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.037, location=P(0, 0.015, 0), segments=48, ring_count=24)
dome = active()
cut_ = box("domecut", (0.1, 0.1, 0.05), (0, 0, 0.015 - 0.025), M["gold"])
m_ = dome.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = cut_; m_.solver = "EXACT"
apply_mods(dome)
bpy.data.objects.remove(cut_)
# (the boolean leaves the dome's material slots in a muddle: cleared, and the brass given to every face)
dome.data.materials.clear()
finish(dome, "BellDome", M["gold"])
for poly in dome.data.polygons:
    poly.material_index = 0
dome.scale = (1, 1, 0.8)
apply_scale(dome)
smooth_angle(dome, 60)
bl.append(dome)
bl.append(cyl("BellCollar", 0.006, 0.004, P(0, 0.015 + 0.0296 + 0.0015, 0), M["gold"], verts=24))
plunger = bpy.data.objects.new("TillBellPlunger", None)
bpy.context.collection.objects.link(plunger)
plunger.location = P(0, 0.015 + 0.0296 + 0.0035, 0)
pl = [cyl("BellStem", 0.0024, 0.012, (0, 0, 0.006), M["gold"], verts=16),
      cyl("BellKnob", 0.0085, 0.006, (0, 0, 0.0135), M["gold"], verts=32)]
for o in pl:
    o.parent = plunger
bl.append(plunger)
bl += pl
nodes.append(node("TillBell", bl))

# =====================================================================
# The desk stand: a walnut cabinet 15 cm high the reader, the printer, the pens and the tablet stand on: a thick top with eased edges
# overhanging a little, solid sides and a back, a plinth set in under it, and below the top two drawers side by side across its front,
# each with a raised fielded front and a brass bar pull, the divider between them; felt pads under
# =====================================================================
MW, MD, MH = 0.5, 0.39, 0.15
TT, ST, PL = 0.022, 0.016, 0.014         # the top's thickness, the sides', the plinth's height
mt = []
mt.append(box("DeskMat", S(MW, TT, MD), P(0, MH - TT / 2, 0), M["walnut"], bev=0.005))
CW = MW - 0.024                            # the carcass, set in under the top's overhang
CD = MD - 0.02
for sx in (-1, 1):
    mt.append(box(f"DeskMatSide{sx}", S(ST, MH - TT - PL, CD), P(sx * (CW / 2 - ST / 2), PL + (MH - TT - PL) / 2, 0), M["walnut"], bev=0.002))
mt.append(box("DeskMatBack", S(CW - 2 * ST, MH - TT - PL, 0.01), P(0, PL + (MH - TT - PL) / 2, -CD / 2 + 0.005), M["walnut"], bev=0.001))
mt.append(box("DeskMatBottom", S(CW - 2 * ST, 0.012, CD - 0.01), P(0, PL + 0.006, 0.005), M["walnut"], bev=0.001))
mt.append(box("DeskMatPlinth", S(CW - 0.03, PL, CD - 0.03), P(0, PL / 2, -0.005), M["walnutEnd"], bev=0.001))
# (the drawers: two openings across the front, the divider between them, each filled by its drawer)
OH = MH - TT - PL - 0.012 - 0.006       # the openings' height, between the bottom and the top
OY = PL + 0.012 + OH / 2
FZ = CD / 2                               # the front face
DW = (CW - 2 * ST - 0.012) / 2
mt.append(box("DeskMatDivider", S(0.012, OH, CD - 0.02), P(0, OY, 0.0), M["walnut"], bev=0.001))
for k, sx in enumerate((-1, 1)):
    cx = sx * (0.006 + DW / 2)
    first_ = len(mt)
    # (its front: a board with a fielded panel standing a little proud in the middle, a fine gap all round it)
    mt.append(box(f"DeskMatDrawer{k}Front", S(DW - 0.004, OH - 0.004, 0.016), P(cx, OY, FZ - 0.006), M["walnut"], bev=0.0025))
    mt.append(box(f"DeskMatDrawer{k}Panel", S(DW - 0.034, OH - 0.032, 0.004), P(cx, OY, FZ + 0.003), M["walnut"], bev=0.003))
    # (the box behind it, open on top, a little of its pale inside showing at the gap)
    dbox = box(f"DeskMatDrawer{k}Box", S(DW - 0.01, OH - 0.012, CD - 0.06), P(cx, OY - 0.002, FZ - 0.014 - (CD - 0.06) / 2), M["drawerIn"])
    # (hollow: thin sides and a floor, open on top)
    hol = box("hol", S(DW - 0.026, OH, CD - 0.076), P(cx, OY + 0.006, FZ - 0.014 - (CD - 0.06) / 2), M["drawerIn"])
    m_ = dbox.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = hol; m_.solver = "EXACT"
    apply_mods(dbox)
    bpy.data.objects.remove(hol)
    mt.append(dbox)
    # (a brass bar pull on two posts)
    for px in (-1, 1):
        mt.append(cyl(f"DeskMatDrawer{k}Post{px}", 0.0025, 0.012, P(cx + px * 0.035, OY, FZ + 0.011), M["brass"], rot=(math.pi / 2, 0, 0), verts=12))
    mt.append(cyl(f"DeskMatDrawer{k}Pull", 0.0032, 0.082, P(cx, OY, FZ + 0.017), M["brass"], rot=(0, math.pi / 2, 0), verts=16))
    # (each drawer its own node, DeskMatDrawer0/1, so the game can slide it out (along +z, toward the cashier))
    dr = bpy.data.objects.new(f"DeskMatDrawer{k}", None)
    bpy.context.collection.objects.link(dr)
    for o in mt[first_:]:
        o.parent = dr
    mt.append(dr)
for sx in (-1, 1):
    for sz in (-1, 1):
        mt.append(box(f"DeskMatFelt{sx}{sz}", S(0.03, 0.002, 0.03), P(sx * (CW / 2 - 0.04), 0.001, sz * (CD / 2 - 0.04)), M["felt"]))
for o in mt:
    if o.type == "MESH" and o.data.materials and o.data.materials[0].name.startswith("StandWalnut"):
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.cube_project(cube_size=0.6)
        bpy.ops.object.mode_set(mode="OBJECT")
nodes.append(node("TillMat", mt))

# =====================================================================
# The change tray (カルトン): a black resin tray with its corners well rounded and its rim sloping in, the floor ribbed in a fine diamond
# so coins don't slide and can be picked up, ありがとうございました lettered in gold on the floor along the near edge, four rubber feet under
# =====================================================================
tr = []
TW2, TD2, TH2 = 0.21, 0.15, 0.013
outer = box("TillTrayBody", S(TW2, TH2, TD2), P(0, TH2 / 2, 0), M["resin"], bev=0.0105)
well = box("well", S(TW2 - 0.012, TH2, TD2 - 0.012), P(0, TH2 / 2 + 0.0024, 0), M["resin"], bev=0.0095)
m_ = outer.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = well; m_.solver = "EXACT"
apply_mods(outer)
bpy.data.objects.remove(well)
smooth_angle(outer, 50)
tr.append(outer)
# (the ribs: a diamond lattice standing a millimetre off the floor, inside the well)
FW, FD = TW2 - 0.05, TD2 - 0.05
ribs = []
for k in range(-12, 13):
    for sgn in (-1, 1):
        L = 0.3
        r_ = box(f"rib{k}{sgn}", S(0.0012, 0.001, L), P(k * 0.012, 0.0029, 0), M["resinRib"], rot=(0, 0, sgn * math.radians(45)))
        ribs.append(r_)
bpy.ops.object.select_all(action="DESELECT")
for r_ in ribs:
    r_.select_set(True)
bpy.context.view_layer.objects.active = ribs[0]
bpy.ops.object.join()
lattice = active()
lattice.name = "TillTrayRibs"
clip = box("clip", S(FW, 0.02, FD), P(0, 0.0029, 0), M["resinRib"], bev=0.01)
m_ = lattice.modifiers.new("clip", "BOOLEAN"); m_.operation = "INTERSECT"; m_.object = clip; m_.solver = "EXACT"
apply_mods(lattice)
bpy.data.objects.remove(clip)
tr.append(lattice)
tr.append(text("TillTrayThanks", "ありがとうございました", 0.0068, M["gilt"], P(0, 0.0027, FD / 2 + 0.0075), (0, 0, 0), JA, fit=TW2 - 0.075))
for sx in (-1, 1):
    for sz in (-1, 1):
        tr.append(cyl(f"TillTrayFoot{sx}{sz}", 0.006, 0.0016, P(sx * (TW2 / 2 - 0.02), -0.0008, sz * (TD2 / 2 - 0.02)), M["rubber"], verts=16))
nodes.append(node("TillTray", tr))

# =====================================================================
# The cat's stand: a river stone, its top worn level, the cat (on its own red zabuton) sat up on it
# =====================================================================
cs = []
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.0)
st = active()
SX, SZ, SY = 0.1, 0.135, 0.17
for vtx in st.data.vertices:
    x, y, z = vtx.co
    w = 1 + 0.07 * math.sin(x * 5.1 + y * 3.3) + 0.05 * math.sin(y * 7.7 - x * 2.1) + 0.03 * math.sin(z * 9 + x * 6)
    x, y = x * SX * w, y * SZ * w
    z = (min(z, 0.55) / 0.55 * 0.5 + 0.5) if z > -0.7 else 0.0
    vtx.co = (x, y, max(0.0, z) * SY)
finish(st, "CatStone", M["stone"])
bpy.ops.object.select_all(action="DESELECT"); st.select_set(True); bpy.context.view_layer.objects.active = st
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=0.4); bpy.ops.object.mode_set(mode="OBJECT")
smooth_angle(st, 70)
cs.append(st)
nodes.append(node("TillCatStand", cs))

# =====================================================================
# The money tree (発財樹, a pachira): three trunks braided together in a glazed red pot, its soil topped with pale pebbles, branching at the top
# into stems each holding a hand of five glossy leaflets; a red ribbon round the braid with a gold coin hanging from it
# =====================================================================
mtree = []
PR, PH2 = 0.055, 0.075
pot = cyl("TreePot", PR, PH2, P(0, PH2 / 2, 0), M["potGlaze"], verts=40, r2=PR * 0.78)
potin = cyl("tpin", PR - 0.006, PH2, P(0, PH2 / 2 + 0.008, 0), M["potGlaze"], verts=40, r2=PR * 0.78 - 0.006)
m_ = pot.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = potin; m_.solver = "EXACT"
apply_mods(pot)
bpy.data.objects.remove(potin)
mtree.append(pot)
mtree.append(cyl("TreePotRim", PR + 0.002, 0.008, P(0, PH2 - 0.004, 0), M["potGlaze"], verts=40))
mtree.append(cyl("TreePotFoot", PR * 0.8, 0.006, P(0, 0.003, 0), M["potFoot"], verts=40))
mtree.append(cyl("TreeSoil", PR - 0.007, 0.004, P(0, PH2 - 0.012, 0), M["soil"], verts=32))
for i in range(14):
    a_ = i * 2.399
    rr = 0.012 + (i % 5) * 0.008
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.0055 + (i % 3) * 0.0012, location=P(rr * math.cos(a_), PH2 - 0.009, rr * math.sin(a_)))
    pb = active(); pb.scale = (1, 1, 0.6); apply_scale(pb)
    mtree.append(finish(pb, f"TreePebble{i}", M["pebble"]))
# (the braid: three trunks winding round each other as they rise, thinning, then each spreading out)
TB, TT_ = PH2 - 0.01, 0.2
for k in range(3):
    pts = []
    for j in range(13):
        t = j / 12
        y = TB + (TT_ - TB) * t
        a_ = k * 2.094 + t * 7.0
        rr = 0.008 * (1 - 0.5 * t)
        pts.append((rr * math.cos(a_), y, rr * math.sin(a_)))
    # (and out into its branch at the top)
    ox, oz = math.cos(k * 2.094 + 0.5), math.sin(k * 2.094 + 0.5)
    pts += [(ox * 0.02, TT_ + 0.03, oz * 0.02), (ox * 0.045, TT_ + 0.06, oz * 0.045)]
    mtree.append(tube(f"TreeTrunk{k}", pts, 0.0055 - k * 0.0004, M["bark"]))
    # (the stems off each branch, each with a hand of leaflets)
    for h in range(3):
        b = h * 2.1 + k * 0.7
        sx, sz = ox * 0.045, oz * 0.045
        ex, ez = sx + math.cos(b) * 0.045, sz + math.sin(b) * 0.045
        ey = TT_ + 0.075 + (h % 2) * 0.02
        mtree.append(tube(f"TreeStem{k}{h}", [(sx, TT_ + 0.06, sz), ((sx + ex) / 2, ey + 0.005, (sz + ez) / 2), (ex, ey, ez)], 0.0012, M["stem"]))
        for f in range(5):
            fa = b + (f - 2) * 0.55
            L = 0.045 if f == 2 else 0.038 - abs(f - 2) * 0.003
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=14, ring_count=7)
            lf = active()
            lf.scale = (L / 2, 0.009, 0.0012)
            apply_scale(lf)
            lf.location = P(ex + math.cos(fa) * L / 2, ey + 0.004 - (abs(f - 2)) * 0.003, ez + math.sin(fa) * L / 2)
            lf.rotation_euler = (0.25 * (f - 2) * 0.3, -0.18, -fa)
            mtree.append(finish(lf, f"TreeLeaf{k}{h}{f}", M["leaf"] if (k + h + f) % 3 else M["leaf2"]))
# (a red ribbon tied round the braid, and a gold coin hung from it)
bpy.ops.mesh.primitive_torus_add(major_radius=0.011, minor_radius=0.0028, major_segments=24, minor_segments=6, location=P(0, TB + 0.06, 0))
rb = active(); rb.scale = (1, 1, 1.6); apply_scale(rb)
mtree.append(finish(rb, "TreeRibbon", M["ribbonRed"]))
mtree.append(tube("TreeRibbonTail", [(0.011, TB + 0.06, 0), (0.016, TB + 0.045, 0.004), (0.017, TB + 0.03, 0.006)], 0.0018, M["ribbonRed"]))
coin = cyl("TreeCoin", 0.011, 0.002, P(0.018, TB + 0.022, 0.007), M["coinGold"], rot=(math.pi / 2, 0, 0.3), verts=28)
hole_ = box("ch", S(0.006, 0.006, 0.02), P(0.018, TB + 0.022, 0.007), M["coinGold"])
m_ = coin.modifiers.new("cut", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = hole_; m_.solver = "EXACT"
apply_mods(coin)
bpy.data.objects.remove(hole_)
mtree.append(coin)
nodes.append(node("TillMoneyTree", mtree))

# =====================================================================
# The gold ingot (元寶): a boat-shaped shoe of gold, its two ends curling up, a round dome rising from its middle, on a small red lacquer
# stand with a gold rim and a tasselled cushion
# =====================================================================
ig = []
ig.append(cyl("IngotStand", 0.05, 0.012, P(0, 0.006, 0), M["lacquerRed"], verts=40, r2=0.046))
ig.append(cyl("IngotStandRim", 0.0505, 0.003, P(0, 0.0125, 0), M["coinGold"], verts=40))
cush = box("IngotCushion", S(0.07, 0.012, 0.05), P(0, 0.02, 0), M["cushion"], bev=0.006)
ig.append(cush)
bm_ = bmesh.new()
L, Wd, H_ = 0.075, 0.042, 0.022
NU, NV = 28, 14
grid = []
for i in range(NU + 1):
    u = i / NU * 2 - 1                       # -1..1 along
    row = []
    for j in range(NV + 1):
        v_ = j / NV * 2 - 1                  # -1..1 across
        x = u * L / 2
        z = v_ * Wd / 2 * (1 - 0.35 * u * u)
        # (the shoe: low in the middle, its ends swept up in a curl, its sides rounded)
        y = H_ * (0.25 + 0.75 * u ** 4) * (1 - 0.6 * v_ * v_) + 0.006 * (1 - v_ * v_)
        row.append(bm_.verts.new(P(x, 0.026 + y, z)))
    grid.append(row)
for i in range(NU):
    for j in range(NV):
        bm_.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
# (its underside: a flat-ish bottom joining the rims)
under = [bm_.verts.new(P(u * L / 2 * 0.9, 0.026, 0)) for u in [i / NU * 2 - 1 for i in range(NU + 1)]]
for i in range(NU):
    bm_.faces.new((grid[i][0], under[i], under[i + 1], grid[i + 1][0]))
    bm_.faces.new((grid[i + 1][NV], under[i + 1], under[i], grid[i][NV]))
bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
me_ = bpy.data.meshes.new("IngotShoe")
bm_.to_mesh(me_)
bm_.free()
shoe = bpy.data.objects.new("IngotShoe", me_)
bpy.context.collection.objects.link(shoe)
finish(shoe, "IngotShoe", M["coinGold"])
sol = shoe.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.003
apply_mods(shoe)
smooth_angle(shoe, 60)
ig.append(shoe)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.017, segments=32, ring_count=16, location=P(0, 0.034, 0))
dome = active(); dome.scale = (1, 1, 0.85); apply_scale(dome)
ig.append(finish(dome, "IngotDome", M["coinGold"]))
for sx in (-1, 1):
    ig.append(tube(f"IngotTassel{sx}", [(sx * 0.036, 0.02, 0.026), (sx * 0.04, 0.01, 0.03), (sx * 0.041, 0.0, 0.031)], 0.0022, M["ribbonRed"]))
nodes.append(node("TillIngot", ig))

root = bpy.data.objects.new("TillDesk", None)
bpy.context.collection.objects.link(root)
parts = []
for i, (e, ps) in enumerate(nodes):
    e.parent = root
    parts += [e] + ps
if PREVIEW:
    # (laid out side by side for the picture only)
    for i, (e, _) in enumerate(nodes):
        e.location = ((i % 4 - 1.5) * 0.3, (i // 4) * 0.45, 0.0)
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
