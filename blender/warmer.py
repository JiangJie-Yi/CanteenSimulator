"""The kitchen's warming counter (warmer.glb; the owner's, 2026-11-09: the rice tub, the miso soup's pot, the old rice pot on its stove and the
electric cooker each stood on a little stand of their own, about the middle of the kitchen's floor: all four now on one counter in a row,
along the bar's side of the kitchen, the floor between kept clear).

A dark burnt-cedar body on a black plinth, four stainless sliding doors in its front; a top of brushed stainless steel with four shallow round
warming wells let into it, each a faint warm red inside (what stands on it is kept hot); along the front edge under the top a dark control
strip: for each well a black bakelite knob, a little round thermometer (65 / 75 ℃ painted on its face) and an amber-red pilot lamp.

The game's frame, in the kitchen's own units (Decor's): y up from the floor, x along the counter, its front toward +z; its middle at the
origin; WARMER_L long, WARMER_D deep, WARMER_H high (the rice tub's stand's top). The wells' places along it: SLOTS (the same in Decor.tsx).

Run:
    blender -b --factory-startup --python blender/warmer.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import active, export_dish, image, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

L, D, H = 3.0, 1.0, 0.7
TOP_T = 0.035          # the stainless top's thickness
# (x along it from its middle, and each well's radius: the rice tub, the miso pot, the rice pot's stove, the electric cooker)
SLOTS = ((-0.98, 0.46), (-0.03, 0.38), (0.645, 0.24), (1.2, 0.26))


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


rng = np.random.default_rng(7)
# (burnt cedar: long streaks of grain, darker and paler, along the board)
W, Hh = 512, 128
v = np.linspace(0, 1, Hh)[:, None]
u = np.linspace(0, 1, W)[None, :]
grain = 0.5 + 0.5 * np.sin((v * 40 + np.sin(u * 9 + v * 3) * 0.8) * math.pi * 2)
streak = rng.random((Hh, 1)) * 0.5
wood = np.clip(0.75 + 0.18 * grain - 0.25 * streak + rng.normal(0, 0.03, (Hh, W)), 0, 1)
base = np.array(lin("#3a2416"))
wood_rgb = (wood[..., None] * base[None, None, :] * 1.15).astype(np.float32)
# (brushed steel: fine streaks along its length)
sw, sh = 512, 64
brush = np.clip(0.86 + rng.normal(0, 0.05, (sh, 1)) + rng.normal(0, 0.015, (sh, sw)), 0, 1)
steel_rgb = (brush[..., None] * np.array(lin("#9aa0a6"))[None, None, :]).astype(np.float32)
# (a thermometer's face: cream, a scale round its top, a red needle at 70 or so)
dn = 128
yy, xx = np.mgrid[0:dn, 0:dn] / (dn - 1) * 2 - 1
r = np.hypot(xx, yy)
ang = np.arctan2(-yy, xx)
dial = np.ones((dn, dn, 3)) * np.array(lin("#f2ead6"))
ticks = (np.abs(r - 0.72) < 0.1) & (ang > 0.25) & (ang < math.pi - 0.25) & (np.mod(ang * 12 / math.pi, 1) < 0.35)
dial[ticks] = lin("#2a2420")
hot = (np.abs(r - 0.6) < 0.05) & (ang > 0.25) & (ang < 1.1)
dial[hot] = lin("#c0392b")
needle_a = 1.05
along_n = xx * math.cos(needle_a) + (-yy) * math.sin(needle_a)
across_n = -xx * math.sin(needle_a) + (-yy) * math.cos(needle_a)
needle = (along_n > -0.05) & (along_n < 0.68) & (np.abs(across_n) < 0.04)
dial[needle] = lin("#b3241c")
dial[r < 0.1] = lin("#2a2420")
dial[r > 0.93] = lin("#7a6a58")
M = {
    "wood": pbr("WarmerWood", (1, 1, 1), tex=image("warmer_wood", wood_rgb), rough=0.7),
    "steel": pbr("WarmerSteel", (1, 1, 1), tex=image("warmer_steel", steel_rgb), rough=0.25, metal=0.7),
    "dark": pbr("WarmerDark", lin("#17120f"), rough=0.6),
    "well": pbr("WarmerWell", lin("#5a5f66"), rough=0.35, metal=0.6),
    "glow": pbr("WarmerGlow", lin("#7a2a18"), emit=lin("#ff5a2a"), emit_strength=0.6),
    "knob": pbr("WarmerKnob", lin("#4a3c32"), rough=0.4),
    "dial": pbr("WarmerDial", (1, 1, 1), tex=image("warmer_dial", dial.astype(np.float32)), rough=0.4),
    "lamp": pbr("WarmerLamp", lin("#ff6a2a"), emit=lin("#ff6a2a"), emit_strength=2.0),
    "brass": pbr("WarmerBrass", lin("#b98a3a"), rough=0.3, metal=0.8),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def disc(name, x, y, z, radius, depth, mat, segs=20, facing="up"):
    """a short cylinder: lying flat (its face up) or stood on its edge facing the front (+z)"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=depth, location=P(x, y, z))
    o = active()
    if facing == "front":
        o.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.name = name
    o.data.materials.append(M[mat])
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


x0, x1, z0, z1 = -L / 2, L / 2, -D / 2, D / 2
body = [
    # (the plinth, set back a little; the body; the top, a little proud all round)
    box("plinth", x0 + 0.03, x1 - 0.03, 0, 0.07, z0 + 0.03, z1 - 0.04, "dark"),
    box("body", x0, x1, 0.07, H - TOP_T, z0, z1 - 0.02, "wood"),
    box("top", x0 - 0.015, x1 + 0.015, H - TOP_T, H, z0 - 0.01, z1 + 0.015, "steel"),
    # (the control strip under the top's front edge)
    box("strip", x0 + 0.03, x1 - 0.03, H - TOP_T - 0.09, H - TOP_T - 0.01, z1 - 0.02, z1 + 0.004, "dark"),
]
# (four stainless sliding doors in its front, a dark gap between, a recessed pull on each)
n = 4
dw = (L - 0.12) / n
for k in range(n):
    a = x0 + 0.06 + k * dw
    body.append(box(f"door{k}", a + 0.035, a + dw - 0.035, 0.14, H - TOP_T - 0.14, z1 - 0.02, z1 - 0.006, "steel"))
    px = a + (dw - 0.08 if k % 2 == 0 else 0.08)
    body.append(box(f"pull{k}", px - 0.012, px + 0.012, 0.26, 0.42, z1 - 0.006, z1 - 0.001, "dark"))
warmer = join(body, "WarmerBody")
# (the wells: a shallow ring of darker steel just proud of the top, its middle glowing faintly warm)
wells = []
for x, rr in SLOTS:
    wells.append(disc("well", x, H + 0.002, 0, rr, 0.004, "well", segs=24))
    wells.append(disc("glow", x, H + 0.004, 0, rr * 0.78, 0.002, "glow", segs=24))
warmer_wells = join(wells, "WarmerWells")
# (for each well, on the strip: a knob, a thermometer, a pilot lamp)
ctrl = []
for i, (x, _) in enumerate(SLOTS):
    ctrl.append(disc("knob", x - 0.12, H - TOP_T - 0.05, z1 + 0.016, 0.026, 0.024, "knob", segs=12, facing="front"))
    ctrl.append(box("knobmark", x - 0.123, x - 0.117, H - TOP_T - 0.05, H - TOP_T - 0.028, z1 + 0.028, z1 + 0.03, "brass"))
    ctrl.append(disc("dialrim", x, H - TOP_T - 0.05, z1 + 0.008, 0.032, 0.008, "brass", segs=16, facing="front"))
    d = disc("dial", x, H - TOP_T - 0.05, z1 + 0.0125, 0.027, 0.001, "dial", segs=16, facing="front")
    ctrl.append(d)
    ctrl.append(disc("lamp", x + 0.11, H - TOP_T - 0.05, z1 + 0.01, 0.012, 0.012, "lamp", segs=10, facing="front"))
# (the dials' faces: their picture across each, front on)
for o in ctrl:
    if o.name.startswith("dial") and not o.name.startswith("dialrim"):
        me = o.data
        uvl = me.uv_layers.active or me.uv_layers.new()
        for poly in me.polygons:
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((co.x - o.location.x) / 0.054 + 0.5, (co.z - o.location.z) / 0.054 + 0.5)
warmer_ctrl = join(ctrl, "WarmerControls")

root = bpy.data.objects.new("Warmer", None)
bpy.context.collection.objects.link(root)
for o in (warmer, warmer_wells, warmer_ctrl):
    o.parent = root
print("WARMER_TRIS", sum(len(p.vertices) - 2 for o in (warmer, warmer_wells, warmer_ctrl) for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.5, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.6, 1.6, 2.6)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "warmer.glb"), os.path.join(PROJECT, "blender", "warmer.blend"), PREVIEW)
print("WARMER_DONE")
