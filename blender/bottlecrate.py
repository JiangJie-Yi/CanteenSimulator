"""The brewer's plastic beer crate (P箱) the empty and full bottles stand in by the drinks fridges (the owner's: its hand-holds cut through,
not painted on black, and plastic to look at): bottlecrate.glb, node "BottleCrate".

A tray of moulded plastic 0.36 x 0.29 x 0.2 (the game's frame: y up, x along its long sides, z across; its floor's middle at the origin):
walls 12 mm thick with a hand-hold slot cut through each, a rounded slot near the top; a lip round the rim; vertical ribs standing out along
the walls' lower band, and on each long side a smooth panel above them where the brewer's name is moulded ("BottleCrateLetters": two planes
just off the panels, the game's white lettering on them); inside, a grid of thin walls making twenty cells for the bottles (5 x 4).
"CratePlastic" all of it but the lettering (the game gives it a glossy red).

Run:
    blender -b --factory-startup --python blender/bottlecrate.py -- <project path> [preview.png]
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

bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    """the game's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


W, D, H, T, FLOOR = 0.36, 0.29, 0.2, 0.012, 0.012
SLOT_Y, SLOT_H = H - 0.042, 0.028
COLS, ROWS = 5, 4
M = {
    "plastic": pbr("CratePlastic", (0.6, 0.06, 0.04), rough=0.35),
    "letters": pbr("CrateLetters", (1, 1, 1), rough=0.5),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(scale=True)
    return o


def slot_cutter(name, along_x, at, length, height, depth=0.08, segs=8):
    """a rounded slot (a capsule's outline, `length` long, `height` high) pushed through a wall: along x for the long sides, along z for the
    ends; its middle at `at`"""
    bm = bmesh.new()
    r = height / 2
    half = length / 2 - r
    outline = []
    for k in range(segs + 1):
        a = -math.pi / 2 + math.pi * k / segs
        outline.append((half + r * math.cos(a), r * math.sin(a)))
    for k in range(segs + 1):
        a = math.pi / 2 + math.pi * k / segs
        outline.append((-half + r * math.cos(a), r * math.sin(a)))
    rings = []
    for side in (-1, 1):
        ring = []
        for u, v in outline:
            if along_x:
                p = (at[0] + u, at[1] + v, at[2] + side * depth / 2)
            else:
                p = (at[0] + side * depth / 2, at[1] + v, at[2] + u)
            ring.append(bm.verts.new(P(*p)))
        rings.append(ring)
    n = len(outline)
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = "EXACT"
    m.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


# ---- the tray: the outer box less its inside, less a slot through each wall
tray = box("BottleCrateTray", -W / 2, W / 2, 0.0, H, -D / 2, D / 2)
cut(tray, box("inside", -W / 2 + T, W / 2 - T, FLOOR, H + 0.05, -D / 2 + T, D / 2 - T))
for sd in (-1, 1):
    cut(tray, slot_cutter(f"slotL{sd}", True, (0.0, SLOT_Y, sd * D / 2), 0.12, SLOT_H))
    cut(tray, slot_cutter(f"slotE{sd}", False, (sd * W / 2, SLOT_Y, 0.0), 0.09, SLOT_H))
parts.append(tray)
# ---- the lip round the rim, standing out a little
rim = []
LIP = 0.005
# (what stands out of the walls starts a millimetre inside them: no face of it lies in a wall's face, to flicker against it)
IN = 0.001
def out_of(sd, half, by):
    a, b = sd * (half - IN), sd * (half + by)
    return min(a, b), max(a, b)
for sd in (-1, 1):
    rim.append(box(f"lipL{sd}", -W / 2 - LIP, W / 2 + LIP, H - 0.014, H, *out_of(sd, D / 2, LIP)))
    rim.append(box(f"lipE{sd}", *out_of(sd, W / 2, LIP), H - 0.014, H, -D / 2, D / 2))
# ---- ribs along the walls' lower band (the long sides' panels above them left smooth for the name; the ends' ribs up to the slots)
RIB, RIB_OUT = 0.007, 0.004
n_l = 11
for sd in (-1, 1):
    for k in range(n_l):
        x = -W / 2 + 0.025 + (W - 0.05) * k / (n_l - 1)
        rim.append(box(f"ribL{sd}{k}", x - RIB / 2, x + RIB / 2, 0.006, 0.07, *out_of(sd, D / 2, RIB_OUT)))
    n_e = 8
    for k in range(n_e):
        z = -D / 2 + 0.025 + (D - 0.05) * k / (n_e - 1)
        rim.append(box(f"ribE{sd}{k}", *out_of(sd, W / 2, RIB_OUT), 0.006, SLOT_Y - SLOT_H / 2 - 0.012, z - RIB / 2, z + RIB / 2))
    # (a band round the foot, standing out as the lip does)
    rim.append(box(f"footL{sd}", -W / 2 - LIP * 0.6, W / 2 + LIP * 0.6, 0.0, 0.008, *out_of(sd, D / 2, LIP * 0.6)))
    rim.append(box(f"footE{sd}", *out_of(sd, W / 2, LIP * 0.6), 0.0, 0.008, -D / 2, D / 2))
# ---- the cells' walls inside
for c in range(1, COLS):
    x = -W / 2 + T + (W - 2 * T) * c / COLS
    rim.append(box(f"cellC{c}", x - 0.0025, x + 0.0025, FLOOR, H * 0.88, -D / 2 + T, D / 2 - T))
for r in range(1, ROWS):
    z = -D / 2 + T + (D - 2 * T) * r / ROWS
    rim.append(box(f"cellR{r}", -W / 2 + T, W / 2 - T, FLOOR, H * 0.88, z - 0.0025, z + 0.0025))
bpy.ops.object.select_all(action="DESELECT")
for o in rim + [tray]:
    o.select_set(True)
bpy.context.view_layer.objects.active = tray
bpy.ops.object.join()
tray = bpy.context.view_layer.objects.active
tray.name = "BottleCrateBody"
tray.data.materials.clear()
tray.data.materials.append(M["plastic"])
for pg in tray.data.polygons:
    pg.use_smooth = False
parts = [tray]
# ---- the lettering's two planes, just off the long sides' smooth panels (the game's picture on them: u along, v up)
for sd in (-1, 1):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    z = sd * (D / 2 + 0.0006)
    y0, y1 = 0.074, SLOT_Y - SLOT_H / 2 - 0.006
    xs = (-W / 2 + 0.03, W / 2 - 0.03) if sd > 0 else (W / 2 - 0.03, -W / 2 + 0.03)
    vs = [bm.verts.new(P(xs[0], y0, z)), bm.verts.new(P(xs[1], y0, z)), bm.verts.new(P(xs[1], y1, z)), bm.verts.new(P(xs[0], y1, z))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    me = bpy.data.meshes.new(f"BottleCrateLetters{sd}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"BottleCrateLetters{sd}", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["letters"])
    parts.append(o)

root = bpy.data.objects.new("BottleCrate", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("CRATE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.0, 0.1, 0.0)
    cam.location = P(0.45, 0.45, 0.7)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.7, 0.2, 0.6)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "bottlecrate.glb"), os.path.join(PROJECT, "blender", "bottlecrate.blend"), PREVIEW)
print("CRATE_DONE")
