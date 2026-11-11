"""The kitchen's two working counters, made like the sink's (the owner's, 2026-11-11: the warming counter moved up between the cook table and
the till, its height and look the sink's; the rice tub and the old rice pot on its stove out of use; only the soup kept hot; where the warming
counter stood, a counter for making the rice balls, the electric cooker on it):

- warmer.glb, node "Warmer": the soup counter. A terrazzo top with an upstand along its back, a dark-stained sugi cabinet of panelled doors with
  brass pulls on a black kick; let into its top one round stainless warming well, a faint warm red inside (the miso pot stands in it); under
  the top's front edge, before the well, a black knob, a little round thermometer and an amber pilot lamp.
- prepcounter.glb, node "PrepCounter": the rice-ball counter, the same make without the well; on it a hinoki board with three rice balls
  shaped and their nori, a lacquered bowl of hand water, a box of nori sheets and a little salt pot (the cooker stands at its sink end: Decor).

The game's frame, in the kitchen's own units (Decor's): y up from the floor, x along the counter, its front toward +z; its middle at the
origin; H high (the sink's top), D deep. The warmer's well at WELL_X along it; the board's middle at BOARD_X (the same in Decor.tsx).

Run:
    blender -b --factory-startup --python blender/warmer.py -- <project path> [preview.png]
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

H, D = 1.236, 1.0        # the sink's top (1.236 in the kitchen's units), deep
TT = 0.07                # the terrazzo top's thickness
UP = 0.1                 # the upstand along the back
KICK = 0.1               # the black kick under the cabinet, set back
# (the warmer cut to half its length, its left end kept, the rice-ball counter pushed up against its right end (the owner's, 2026-11-11: 併桌);
# its well where it was from that end (it was 2.8 long, the well at -0.4))
WARMER_L, PREP_L = 1.4, 3.0
WELL_X, WELL_R = 0.3, 0.4
BOARD_X = -0.35


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------------------------------------------- pictures (the sink's)
N = 512
u, v = grid01(N)
ground = mix((0.8, 0.79, 0.76), (0.72, 0.71, 0.68), fbm(N, 6, 6, 4))
terr = ground.copy()
for cells, thr, col, k in ((90, 0.9, (0.18, 0.18, 0.19), 0.95), (140, 0.88, (0.5, 0.5, 0.5), 0.8), (110, 0.9, (0.96, 0.95, 0.93), 0.9),
                           (60, 0.95, (0.58, 0.38, 0.28), 0.85), (220, 0.86, (0.35, 0.35, 0.36), 0.7)):
    chip = smooth(thr, thr + 0.03, vnoise(N, cells, cells))
    terr = mix(terr, col, chip * k)
terr = terr * (0.96 + 0.06 * fbm(N, 64, 64, 2))[..., None]
grain = np.sin((u * 34 + (fbm(N, 2, 5, 4) - 0.5) * 0.9 + (fbm(N, 6, 2, 3) - 0.5) * 0.25) * 2 * math.pi) * 0.5 + 0.5
sugi = mix((0.34, 0.22, 0.14), (0.25, 0.155, 0.095), smooth(0.6, 1.0, grain) * 0.6)
sugi = sugi * (0.94 + 0.08 * fbm(N, 3, 12, 4))[..., None]
hin = mix((0.86, 0.74, 0.55), (0.76, 0.62, 0.42), smooth(0.6, 1.0, np.sin((u * 40 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.6)
# (a thermometer's face: cream, a scale round its top, a red needle at 70 or so)
dn = 128
yy, xx = np.mgrid[0:dn, 0:dn] / (dn - 1) * 2 - 1
r = np.hypot(xx, yy)
ang = np.arctan2(-yy, xx)
dial = np.ones((dn, dn, 3)) * np.array(lin("#f2ead6"))
ticks = (np.abs(r - 0.72) < 0.1) & (ang > 0.25) & (ang < math.pi - 0.25) & (np.mod(ang * 12 / math.pi, 1) < 0.35)
dial[ticks] = lin("#2a2420")
dial[(np.abs(r - 0.6) < 0.05) & (ang > 0.25) & (ang < 1.1)] = lin("#c0392b")
na = 1.05
along_n = xx * math.cos(na) + (-yy) * math.sin(na)
across_n = -xx * math.sin(na) + (-yy) * math.cos(na)
dial[(along_n > -0.05) & (along_n < 0.68) & (np.abs(across_n) < 0.04)] = lin("#b3241c")
dial[r < 0.1] = lin("#2a2420")
dial[r > 0.93] = lin("#7a6a58")


def mats(pre):
    return {
        "terrazzo": pbr(f"{pre}Terrazzo", (1, 1, 1), tex=image(f"{pre.lower()}_terrazzo", np.clip(terr, 0, 1).astype(np.float32)), rough=0.35),
        "sugi": pbr(f"{pre}Sugi", (1, 1, 1), tex=image(f"{pre.lower()}_sugi", np.clip(sugi, 0, 1).astype(np.float32)), rough=0.5),
        "kick": pbr(f"{pre}Kick", lin("#1a120c"), rough=0.6),
        "brass": pbr(f"{pre}Brass", lin("#b98a3a"), rough=0.3, metal=0.8),
    }


M = {}
M.update(mats("Warmer"))
M.update({f"p_{k}": m for k, m in mats("Prep").items()})
M.update({
    "well": pbr("WarmerWell", lin("#5a5f66"), rough=0.35, metal=0.6),
    "glow": pbr("WarmerGlow", lin("#7a2a18"), emit=lin("#ff5a2a"), emit_strength=0.6),
    "knob": pbr("WarmerKnob", lin("#2a2420"), rough=0.4),
    "dial": pbr("WarmerDial", (1, 1, 1), tex=image("warmer_dial", dial.astype(np.float32)), rough=0.4),
    "lamp": pbr("WarmerLamp", lin("#ff6a2a"), emit=lin("#ff6a2a"), emit_strength=2.0),
    "hinoki": pbr("PrepHinoki", (1, 1, 1), tex=image("prep_hinoki", np.clip(hin, 0, 1).astype(np.float32)), rough=0.55),
    "rice": pbr("PrepRice", lin("#f6f3ea"), rough=0.8),
    "nori": pbr("PrepNori", lin("#1d2a1e"), rough=0.6),
    "lacquer": pbr("PrepLacquer", lin("#7a1a14"), rough=0.25),
    "lacquerin": pbr("PrepLacquerIn", lin("#1a1210"), rough=0.2),
    "water": pbr("PrepWater", lin("#8fb2b8"), rough=0.1),
    "salt": pbr("PrepSalt", lin("#e9e4d6"), rough=0.5),
})
parts = []


def box_uv(o, tile=0.5):
    """every face's picture laid flat on it at its true size, from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, tile=0.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 1)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    box_uv(o, tile)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def disc(name, x, y, z, radius, depth, mat, segs=20, facing="up", r1=None):
    """a short cylinder (or a cone's slice, r1 its top): lying flat, its face up, or stood on its edge facing the front (+z)"""
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=radius, radius2=radius if r1 is None else r1, depth=depth, location=P(x, y, z))
    o = active()
    if facing == "front":
        o.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cyl_uv(o)
    finish(o, name, M[mat])
    for p in o.data.polygons:
        p.use_smooth = abs(p.normal.z) < 0.9
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    for o_ in objs[1:]:
        if o_ in parts:
            parts.remove(o_)
    return o


def counter(L, pre, doors):
    """the counter's body: the black kick set back, the sugi cabinet with its doors' panels proud of it and a brass pull on each, the
    terrazzo top a little proud all round with an upstand along its back"""
    k = "" if pre == "Warmer" else "p_"
    x0, x1, z0, z1 = -L / 2, L / 2, -D / 2, D / 2
    front = z1 - 0.04
    o = [
        box("kick", x0 + 0.04, x1 - 0.04, 0, KICK, z0 + 0.02, front - 0.06, k + "kick"),
        box("cabinet", x0, x1, KICK, H - TT, z0, front, k + "sugi"),
        box("top", x0 - 0.02, x1 + 0.02, H - TT, H, z0, z1, k + "terrazzo", bev=0.008),
        box("upstand", x0 - 0.02, x1 + 0.02, H, H + UP, z0, z0 + 0.04, k + "terrazzo", bev=0.006),
    ]
    dw = (L - 0.08) / doors
    for i in range(doors):
        a = x0 + 0.04 + i * dw
        o.append(box(f"door{i}", a + 0.02, a + dw - 0.02, KICK + 0.05, H - TT - 0.16, front, front + 0.018, k + "sugi", bev=0.006))
        px = a + (dw - 0.1 if i % 2 == 0 else 0.1)
        o.append(box(f"pull{i}", px - 0.012, px + 0.012, H - TT - 0.42, H - TT - 0.26, front + 0.018, front + 0.032, k + "brass"))
    # (a rail along the cabinet's top, under the counter's edge)
    o.append(box("rail", x0 + 0.02, x1 - 0.02, H - TT - 0.13, H - TT - 0.02, front, front + 0.012, k + "sugi"))
    return join(o, f"{pre}Body")


def root_of(name, objs):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root
    print(f"{name.upper()}_TRIS", sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons))
    return root


def preview_cam():
    target = P(0, 1.0, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.8, 2.6, 3.2)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 3, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------------------------------------------- the soup counter
body = counter(WARMER_L, "Warmer", 2)
wells = [disc("well", WELL_X, H + 0.002, 0.02, WELL_R, 0.006, "well", segs=24),
         disc("glow", WELL_X, H + 0.005, 0.02, WELL_R * 0.8, 0.002, "glow", segs=24)]
warmer_wells = join(wells, "WarmerWells")
cy, cz = H - TT - 0.075, D / 2 - 0.04 + 0.012
ctrl = [disc("knob", WELL_X - 0.14, cy, cz + 0.014, 0.028, 0.026, "knob", segs=12, facing="front"),
        box("knobmark", WELL_X - 0.143, WELL_X - 0.137, cy, cy + 0.024, cz + 0.027, cz + 0.029, "brass"),
        disc("dialrim", WELL_X, cy, cz + 0.006, 0.034, 0.01, "brass", segs=16, facing="front"),
        disc("dial", WELL_X, cy, cz + 0.0115, 0.028, 0.001, "dial", segs=16, facing="front"),
        disc("lamp", WELL_X + 0.12, cy, cz + 0.008, 0.013, 0.014, "lamp", segs=10, facing="front")]
for o in ctrl:
    if o.name.startswith("dial") and not o.name.startswith("dialrim"):
        me = o.data
        uvl = me.uv_layers.active or me.uv_layers.new()
        for poly in me.polygons:
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((co.x - o.location.x) / 0.056 + 0.5, (co.z - o.location.z) / 0.056 + 0.5)
warmer_ctrl = join(ctrl, "WarmerControls")
root = root_of("Warmer", [body, warmer_wells, warmer_ctrl])
if PREVIEW:
    preview_cam()
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "warmer.glb"), os.path.join(PROJECT, "blender", "warmer.blend"),
            PREVIEW.replace(".png", "-warmer.png") if PREVIEW else None)

# ---------------------------------------------------------------------------------------------------- the rice-ball counter
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
parts = []
body = counter(PREP_L, "Prep", 3)
set_ = []
# (the hinoki board, its rice balls on it: rounded triangles stood up, a band of nori round each one's foot)
set_.append(box("board", BOARD_X - 0.36, BOARD_X + 0.36, H, H + 0.035, -0.2, 0.22, "hinoki", bev=0.008))
for i, dx in enumerate((-0.18, 0.0, 0.18)):
    x = BOARD_X + dx
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=0.075, depth=0.055, location=P(x, H + 0.035 + 0.062, 0.04))
    o = active()
    # (a corner up, its flat faces to the front and back: turned a quarter about its own axis, then stood on its side facing the front)
    o.rotation_euler = (0, 0, math.pi / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    b = bevel(o, 0.03, 2)
    b.limit_method = "NONE"
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=b.name)
    finish(o, f"onigiri{i}", M["rice"])
    parts.append(o)
    set_.append(o)
    set_.append(box(f"nori{i}", x - 0.045, x + 0.045, H + 0.036, H + 0.09, 0.04 + 0.0285, 0.04 + 0.0325, "nori"))
# (the bowl of hand water: lacquered red without, black within, the water in it)
set_.append(disc("bowl", BOARD_X - 0.62, H + 0.045, 0.02, 0.1, 0.09, "lacquer", segs=16, r1=0.13))
set_.append(disc("bowlin", BOARD_X - 0.62, H + 0.088, 0.02, 0.115, 0.004, "lacquerin", segs=16))
set_.append(disc("water", BOARD_X - 0.62, H + 0.07, 0.02, 0.1, 0.004, "water", segs=16))
# (the box of nori sheets, its lid off beside it, and the little salt pot)
set_.append(box("noribox", BOARD_X + 0.5, BOARD_X + 0.78, H, H + 0.06, -0.22, 0.0, "lacquerin", bev=0.006))
set_.append(box("norisheets", BOARD_X + 0.52, BOARD_X + 0.76, H + 0.06, H + 0.066, -0.2, -0.02, "nori"))
set_.append(disc("salt", BOARD_X + 0.62, H + 0.04, 0.12, 0.045, 0.08, "salt", segs=12, r1=0.038))
prep_set = join(set_, "PrepSet")
root = root_of("PrepCounter", [body, prep_set])
if PREVIEW:
    preview_cam()
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "prepcounter.glb"), os.path.join(PROJECT, "blender", "prepcounter.blend"),
            PREVIEW.replace(".png", "-prep.png") if PREVIEW else None)
print("WARMER_DONE")
