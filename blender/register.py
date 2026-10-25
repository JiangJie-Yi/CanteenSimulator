"""The till's electronic cash register (レジスター): a cream steel cash-drawer case, the register body on it (a wedge low at the front where
the sloped key panel is, climbing to a deck at the back), a roomy keyboard (function keys, the number pad, department keys, the total
keys), the operator's display and the customers' display on its stalk, the mode key switch, the paper cover with its tear bar, and the
drawer itself (a front with its lock, label and media slot, and the tray behind it).

Run:
    blender -b --factory-startup --python blender/register.py -- <project path> [preview.png]
Writes public/models/register.glb and blender/register.blend.

Frame: built in the register's own units, in the game's frame (GuestBar3D's register group, before its 1.4 scale): three.js +y up, the
operator at -z. Blender gets (x, -z, y). Node names the game looks for:
    RegBody    everything fixed
    RegDrawer  the drawer (front and tray), slid out along three's -z by the game
The displays' figures, the receipt and the cash in the drawer are drawn by the game.
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

seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(hexs):
    """an sRGB '#rrggbb' as linear (the game's colours were written in sRGB)"""
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def P(x, y, z):
    """three.js (x, y, z) -> Blender"""
    return (x, -z, y)


def S(w, h, d):
    """a three.js size (x, y, z) -> Blender"""
    return (w, d, h)


# =====================================================================
# Textures and materials
# =====================================================================
N = 256
u, v = grid01(N)
# (the cream enamel: a faint mottle, and grime gathered toward the edges where cloths don't reach)
edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
grime = smooth(0.12, 0.0, edge) * 0.5 + fbm(N, 6, 6, 4) * 0.25
# (texture values are sRGB, as the colours were in the game before: #d9d1bf and the like)
cream = mix((0.87, 0.83, 0.75), (0.74, 0.7, 0.6), np.clip(grime, 0, 1) * 0.55)
cream_tex = image("cream", cream)
case_tex = image("case", mix((0.82, 0.79, 0.72), (0.7, 0.67, 0.58), np.clip(grime, 0, 1) * 0.5))
panel_tex = image("panel", mix((0.78, 0.76, 0.7), (0.68, 0.66, 0.6), fbm(N, 16, 16, 3) * 0.6))

M = {
    "body": pbr("RegBody", (0.62, 0.58, 0.49), tex=cream_tex, rough=0.45),
    "case": pbr("RegCase", (0.56, 0.53, 0.45), tex=case_tex, rough=0.4, metal=0.2),
    "foot": pbr("RegFoot", (0.42, 0.4, 0.34), rough=0.5),
    "panel": pbr("RegPanel", (0.5, 0.48, 0.42), tex=panel_tex, rough=0.6),
    "well": pbr("RegWell", (0.16, 0.16, 0.17), rough=0.7),
    "dark": pbr("RegDark", (0.03, 0.032, 0.035), rough=0.5),
    "screen": pbr("RegScreen", (0.01, 0.02, 0.012), rough=0.2),
    "chrome": pbr("RegChrome", (0.7, 0.72, 0.75), rough=0.2, metal=1.0),
    "steel": pbr("RegSteel", (0.45, 0.46, 0.48), rough=0.35, metal=0.9),
    "label": pbr("RegLabel", (0.86, 0.74, 0.3), rough=0.5),
    "ink": pbr("RegInk", (0.04, 0.04, 0.045), rough=0.6),
    "inkw": pbr("RegInkWhite", (0.92, 0.9, 0.86), rough=0.6),
    "tray": pbr("RegTray", (0.06, 0.062, 0.068), rough=0.6),
    "red": pbr("RegRed", (0.6, 0.08, 0.06), rough=0.5),
    # the keys, in the colours they had before
    "k_blue": pbr("RegKeyBlue", lin("#a9bbea"), rough=0.45),
    "k_red": pbr("RegKeyRed", lin("#c23a30"), rough=0.45),
    "k_green": pbr("RegKeyGreen", lin("#3f9a55"), rough=0.45),
    "k_yellow": pbr("RegKeyYellow", lin("#e0bc34"), rough=0.45),
    "k_num": pbr("RegKeyNum", lin("#2c2f36"), rough=0.45),
    "k_grey": pbr("RegKeyGrey", lin("#c9ccd0"), rough=0.45),
    "k_white": pbr("RegKeyWhite", lin("#f1ede6"), rough=0.45),
    "dial": pbr("RegDial", lin("#1a1a1c"), rough=0.4),
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


def uv_box(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=0.4)
    bpy.ops.object.mode_set(mode="OBJECT")


def box(name, size, at, mat, bev=0.0, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat, smooth_shade=False)
    if bev:
        bevel(o, bev, segs, angle=False)
        apply_mods(o)
        smooth_angle(o)
    return o


def cyl(name, r, depth, at, mat, rot=(0, 0, 0), verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=at, rotation=rot)
    o = finish(active(), name, mat)
    smooth_angle(o, 40)
    return o


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    apply_mods(target)
    bpy.data.objects.remove(cutter)


def text(name, body, size, mat, at, rot, align="CENTER"):
    """flat printed lettering (a hair proud of the surface), lines split on '/'"""
    bpy.ops.object.text_add(location=at, rotation=rot)
    t = active()
    t.data.body = body.replace("/", "\n")
    t.data.size = size
    t.data.align_x = align
    t.data.align_y = "CENTER"
    t.data.extrude = 0.00015
    t.data.space_line = 0.9
    bpy.ops.object.convert(target="MESH")
    t = active()
    return finish(t, name, mat, smooth_shade=False)


body_parts = []
drawer_parts = []

# =====================================================================
# The cash-drawer case: one steel shell, eased edges, the opening at the front where the drawer comes out
# =====================================================================
CW, CD, CH = 0.4, 0.34, 0.086
case = box("RegCase", S(CW, CH, CD), P(0, CH / 2, 0), M["case"], bev=0.006)
cut(case, box("c1", S(0.37, 0.062, CD), P(0, 0.006 + 0.031, -0.03), M["case"]))
uv_box(case)
body_parts.append(case)
# (the dark inside, seen when the drawer's out)
body_parts.append(box("RegCaseInside", S(0.368, 0.06, 0.004), P(0, 0.037, 0.12), M["dark"]))
# rubber feet
for sx in (-1, 1):
    for sz in (-1, 1):
        body_parts.append(cyl(f"RegFoot{sx}{sz}", 0.012, 0.006, P(sx * 0.17, -0.002, sz * 0.14), M["dark"], verts=16))

# =====================================================================
# The register body: a foot slab, the wedge over it, the key panel let into its slope
# =====================================================================
body_parts.append(box("RegFootSlab", S(0.35, 0.023, 0.29), P(0, 0.0975, 0), M["foot"], bev=0.006))
prof = [(-0.15, 0.109), (-0.15, 0.134), (0.01, 0.188), (0.018, 0.215), (0.14, 0.215), (0.148, 0.205), (0.148, 0.109)]
bm = bmesh.new()
BW = 0.17
L = [bm.verts.new(P(-BW, y, z)) for z, y in prof]
R = [bm.verts.new(P(BW, y, z)) for z, y in prof]
bm.faces.new(L)
bm.faces.new(list(reversed(R)))
for i in range(len(prof)):
    j = (i + 1) % len(prof)
    bm.faces.new((L[i], L[j], R[j], R[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("RegWedge")
bm.to_mesh(me)
bm.free()
wedge = bpy.data.objects.new("RegWedge", me)
bpy.context.collection.objects.link(wedge)
finish(wedge, "RegWedge", M["body"], smooth_shade=False)
bevel(wedge, 0.006, 3, angle=False)
apply_mods(wedge)
smooth_angle(wedge)
# (the key panel's well: a shallow tray sunk into the slope, its floor PLATE_TOP in the panel's frame)
PANEL_AT, PANEL_TILT = Vector(P(0, 0.172, -0.07)), -0.34
PLATE_TOP = -0.012
ROT = Vector((PANEL_TILT, 0, 0))


def in_panel(x, y, z):
    """a point in the key panel's tilted frame (three units) -> Blender"""
    from mathutils import Euler
    return PANEL_AT + Euler(ROT).to_matrix() @ Vector(P(x, y, z))


cut(wedge, box("w", S(0.338, 0.042, 0.172), tuple(in_panel(0, PLATE_TOP + 0.021, 0)), M["body"], bev=0.004, rot=tuple(ROT)))
uv_box(wedge)
body_parts.append(wedge)

# ---- the key panel: its plate, and the keys on it, all in the panel's own tilted frame
panel = bpy.data.objects.new("RegPanel", None)
bpy.context.collection.objects.link(panel)
panel.location = PANEL_AT
panel.rotation_euler = (PANEL_TILT, 0, 0)
panel_parts = []
panel_parts.append(box("RegPanelPlate", S(0.334, 0.01, 0.168), P(0, PLATE_TOP - 0.005, 0), M["panel"], bev=0.002))


def keycap(name, w, d, mat, at):
    """a keycap: a little tapered, its edges eased, standing 9 mm"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vv in bm.verts:
        vv.co.x *= w
        vv.co.y *= d
        vv.co.z = (vv.co.z + 0.5) * 0.009
        if vv.co.z > 0.004:
            vv.co.x *= 0.86 + 0.06 * min(1, w / 0.06)
            vv.co.y *= 0.84
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    finish(o, name, mat, smooth_shade=False)
    bevel(o, 0.0022, 3, angle=False)
    apply_mods(o)
    smooth_angle(o, 50)
    o.location = at
    return o


# the keys as they were (every one kept), [col, row, cols wide, face, key material, ink]: col 0 at the operator's left, row 0 at the back;
# the department keys (col 1) blank with their number in the corner
KEYS = [
    (0, 1, 1, "RETURN", "k_blue", "ink"), (0, 2, 1, "VOID", "k_blue", "ink"), (0, 3, 1, "CANCEL", "k_blue", "ink"), (0, 4, 1, "TAX", "k_green", "inkw"),
    *[(1, r, 1, f"#{r}", "k_grey", "ink") for r in range(1, 5)],
    (2, 0, 1, "CLEAR", "k_blue", "ink"), (3, 0, 1, "PLU", "k_red", "inkw"), (4, 0, 1, "X/TIME", "k_blue", "ink"), (5, 0, 1, "RCPT/ON-OFF", "k_red", "inkw"),
    *[(2 + n % 3, 1 + n // 3, 1, t, "k_num", "inkw") for n, t in enumerate(["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "."])],
    (5, 1, 1, "CLERK−", "k_green", "inkw"), (5, 2, 1, "− %", "k_green", "inkw"), (5, 3, 1, "+ %", "k_green", "inkw"), (5, 4, 1, "FEED", "k_blue", "ink"),
    (6, 0, 1, "NO SALE", "k_red", "inkw"), (7, 0, 1, "CALC", "k_green", "inkw"),
    (6, 1, 1, "RA +", "k_yellow", "ink"), (7, 1, 1, "PO −", "k_yellow", "ink"),
    (6, 2, 1, "CHECK", "k_blue", "ink"), (7, 2, 1, "CHARGE", "k_blue", "ink"),
    (6, 3, 2, "SUBTOTAL", "k_white", "ink"), (6, 4, 2, "CASH/TEND =", "k_white", "ink"),
]
# (spaced out across the wider panel: smaller caps, wider gaps, all the small print one size)
PX, PZ, KW, KD = 0.0395, 0.031, 0.031, 0.0235
X0, Z0 = 0.138, 0.062
for col, row, cw, face, mat, ink in KEYS:
    x = X0 - (col + (cw - 1) / 2) * PX
    z = Z0 - row * PZ
    w = KW * cw + (cw - 1) * (PX - KW)
    panel_parts.append(keycap(f"RegKey{col}{row}", w, KD, M[mat], P(x, PLATE_TOP, z)))
    top = PLATE_TOP + 0.0091
    if face.startswith("#"):
        # (its number small in the cap's lower right corner, as the operator sees it)
        panel_parts.append(text(f"RegKeyFace{col}{row}", face[1:], 0.0052, M[ink], P(x - 0.0085, top, z - 0.0055), (0, 0, math.pi)))
        continue
    digits = face in ("0", "00", ".") or face.isdigit()
    size = 0.0105 if digits else 0.0066 if face == "PLU" else 0.0043 if "/" in face else 0.0051
    panel_parts.append(text(f"RegKeyFace{col}{row}", face, size, M[ink], P(x, top, z), (0, 0, math.pi)))
# the mode dial in the panel's top left corner (over the first two columns), its positions round it
dx, dz = X0 - 0.5 * PX, Z0
panel_parts.append(cyl("RegDialBase", 0.016, 0.003, P(dx, PLATE_TOP + 0.0015, dz), M["steel"], verts=28))
panel_parts.append(cyl("RegDialKnob", 0.011, 0.01, P(dx, PLATE_TOP + 0.008, dz), M["dial"], verts=24, r2=0.0095))
panel_parts.append(box("RegDialPointer", S(0.003, 0.014, 0.011), P(dx, PLATE_TOP + 0.017, dz), M["dial"], bev=0.001, rot=(0, 0, 0.5)))
panel_parts.append(box("RegDialMark", S(0.0012, 0.0004, 0.006), P(dx, PLATE_TOP + 0.0242, dz - 0.0025), M["inkw"], rot=(0, 0, 0.5)))
for k, t in enumerate(["OFF", "REG", "X", "Z"]):
    a = math.radians(-75 + k * 50)
    # (round the dial's far side, reading for the operator)
    panel_parts.append(text(f"RegMode{t}", t, 0.0045, M["ink"], P(dx - math.sin(a) * 0.023, PLATE_TOP + 0.0002, dz + math.cos(a) * 0.023), (0, 0, math.pi)))
for o in panel_parts:
    o.parent = panel

# ---- the deck: the operator's display on its base, the mode key switch with its positions, the paper cover and its tear bar
body_parts.append(box("RegDisplayBase", S(0.1, 0.014, 0.05), P(0.085, 0.222, 0.05), M["body"], bev=0.004))
disp = box("RegDisplay", S(0.15, 0.058, 0.014), P(0.085, 0.252, 0.05), M["body"], bev=0.004, rot=(-0.14, 0, 0))
body_parts.append(disp)
# (its window: a dark bezel the figures show in, set into its face toward the operator)
bz = box("RegDisplayWindow", S(0.136, 0.044, 0.002), P(0, 0, 0), M["screen"], bev=0.001)
bz.parent = disp
bz.location = Vector(P(0, 0.002, -0.0068))
body_parts.append(bz)
ks = Vector(P(0.145, 0.2155, 0.03))
body_parts.append(cyl("RegKeySwitch", 0.014, 0.006, ks + Vector((0, 0, 0.003)), M["steel"], verts=24))
body_parts.append(cyl("RegKeyBarrel", 0.008, 0.005, ks + Vector((0, 0, 0.0085)), M["chrome"], verts=20))
body_parts.append(box("RegKeyBow", S(0.004, 0.014, 0.014), tuple(ks + Vector((0, 0, 0.017))), M["dark"], bev=0.0015, rot=(0, 0, 0.6)))
# the paper cover: a raised lid over the roll, the receipt coming up in front of it through a slot with a serrated tear bar
body_parts.append(box("RegPaperCover", S(0.11, 0.012, 0.06), P(-0.035, 0.221, 0.112), M["body"], bev=0.005))
body_parts.append(box("RegPaperSlot", S(0.07, 0.002, 0.006), P(-0.025, 0.2155, 0.076), M["dark"]))
tear = box("RegTearBar", S(0.072, 0.004, 0.003), P(-0.025, 0.218, 0.072), M["steel"])
body_parts.append(tear)
body_parts.append(text("RegPaperMark", "PAPER", 0.006, M["ink"], P(-0.035, 0.2272, 0.112), (0, 0, math.pi)))

# ---- the customers' display, on a stalk at the back
body_parts.append(cyl("RegStalk", 0.006, 0.11, P(0.085, 0.265, 0.12), M["steel"], verts=14, r2=0.005))
cdisp = box("RegCustDisplay", S(0.17, 0.065, 0.02), P(0.085, 0.33, 0.12), M["body"], bev=0.005, rot=(-0.18, 0, 0))
body_parts.append(cdisp)
cw_ = box("RegCustWindow", S(0.156, 0.05, 0.002), P(0, 0, 0), M["screen"], bev=0.001)
cw_.parent = cdisp
cw_.location = Vector(P(0, 0, 0.0095))
body_parts.append(cw_)

# ---- the sides: a card slot on the left, a socket panel and power switch on the right; the maker's line on the foot
body_parts.append(box("RegCardSlot", S(0.002, 0.008, 0.05), P(-BW - 0.0015, 0.15, -0.02), M["dark"]))
body_parts.append(box("RegSockets", S(0.002, 0.03, 0.08), P(BW + 0.0015, 0.15, 0.06), M["dark"], bev=0.0008))
for i, (y, z) in enumerate(((0.155, 0.08), (0.155, 0.05), (0.143, 0.065))):
    body_parts.append(box(f"RegSocket{i}", S(0.002, 0.008, 0.014), P(BW + 0.0028, y, z), M["steel"]))
body_parts.append(box("RegPowerSwitch", S(0.004, 0.012, 0.008), P(0.177, 0.104, 0.1), M["red"], bev=0.001))
body_parts.append(text("RegMaker", "ELECTRONIC CASH REGISTER", 0.0075, M["ink"], P(-0.06, 0.098, -0.1455), (math.pi / 2, 0, math.pi)))

# =====================================================================
# The drawer: its front (a recessed panel, the media slot, the label, the lock) and the tray behind it
# =====================================================================
front = box("RegDrawerFront", S(0.384, 0.068, 0.018), P(0, 0.04, -0.176), M["body"], bev=0.004)
cut(front, box("r", S(0.35, 0.048, 0.01), P(0, 0.04, -0.187), M["body"], bev=0.003))
uv_box(front)
drawer_parts.append(front)
# (the finger pull: a lip along the front's underside)
drawer_parts.append(box("RegDrawerLip", S(0.2, 0.006, 0.012), P(0, 0.006, -0.188), M["body"], bev=0.0025))
# the media slot (cheques and notes posted without opening it), a dark slit with a chrome surround
drawer_parts.append(box("RegMediaSlotRim", S(0.13, 0.009, 0.003), P(-0.02, 0.054, -0.1835), M["steel"], bev=0.0008))
drawer_parts.append(box("RegMediaSlot", S(0.12, 0.003, 0.003), P(-0.02, 0.054, -0.1845), M["dark"]))
# the label holder (a small yellow card) and the lock: a chrome barrel with its keyway
drawer_parts.append(box("RegDrawerLabel", S(0.05, 0.016, 0.0015), P(-0.11, 0.028, -0.1825), M["label"], bev=0.0005))
drawer_parts.append(text("RegDrawerLabelText", "¥", 0.009, M["ink"], P(-0.11, 0.028, -0.1835), (math.pi / 2, 0, math.pi)))
drawer_parts.append(cyl("RegLock", 0.009, 0.006, P(0.11, 0.035, -0.184), M["chrome"], rot=(math.pi / 2, 0, 0), verts=28))
drawer_parts.append(box("RegKeyway", S(0.0016, 0.009, 0.002), P(0.11, 0.035, -0.1872), M["dark"]))
drawer_parts.append(box("RegLockRing", S(0.024, 0.024, 0.001), P(0.11, 0.035, -0.1822), M["steel"], bev=0.0008, rot=(0, 0, math.pi / 4)))
# the tray: a floor and walls, the front's back the fourth
drawer_parts.append(box("RegTrayFloor", S(0.35, 0.007, 0.3), P(0, 0.0135, -0.01), M["tray"]))
for sd in (-1, 1):
    drawer_parts.append(box(f"RegTraySide{sd}", S(0.007, 0.04, 0.3), P(sd * 0.1715, 0.03, -0.01), M["case"], bev=0.0015))
drawer_parts.append(box("RegTrayBack", S(0.35, 0.04, 0.007), P(0, 0.03, 0.1385), M["case"], bev=0.0015))

# =====================================================================
# Assemble: RegBody (fixed) and RegDrawer under the root
# =====================================================================
root = bpy.data.objects.new("Register", None)
bpy.context.collection.objects.link(root)
body = bpy.data.objects.new("RegBody", None)
drawer = bpy.data.objects.new("RegDrawer", None)
for e in (body, drawer):
    bpy.context.collection.objects.link(e)
    e.parent = root
for o in body_parts:
    if o.parent is None:
        o.parent = body
panel.parent = body
for o in drawer_parts:
    o.parent = drawer
parts = [body, drawer, panel] + body_parts + panel_parts + drawer_parts

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.25, 0.75, 0.55)
    cam.rotation_euler = (Vector((0, 0, 0.13)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((0.8, 1.2, 1.5), 300), ((-1.2, 0.5, 0.6), 100), ((0, -1.5, 1), 80)):
        Lg = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        Lg.data.energy = e
        Lg.data.size = 1.2
        Lg.location = loc
        Lg.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(Lg)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "register.glb"),
            os.path.join(PROJECT, "blender", "register.blend"), PREVIEW)
print("REGISTER_DONE", len(parts), "parts")
