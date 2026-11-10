"""The brewer's plastic beer crate (P箱) the empty and full bottles stand in by the drinks fridges (the owner's: its hand-holds cut through,
not painted on black, and plastic to look at): bottlecrate.glb, node "BottleCrate".

A tray of moulded plastic 0.36 x 0.29 x 0.2 (the game's frame: y up, x along its long sides, z across; its floor's middle at the origin):
walls 12 mm thick with a hand-hold opening near the top of each (each wall four plain boxes round it: no boolean cut); a lip round the rim; vertical ribs standing out along
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


# (every piece a plain box, one quad to a face (the owner's: the hand-holds were cut through with booleans, leaving long slivers of triangles
# fanned across the walls and floor): each wall four boxes round its hand-hold, so the hole's still a real opening, square-cornered)
rim = []
IN = 0.001
LIP_H = 0.014
def out_of(sd, half, by):
    a, b = sd * (half - IN), sd * (half + by)
    return min(a, b), max(a, b)
def wall(name, along_x, sd, hole_w):
    """a wall, its outer face at sd * half, built round a hand-hold `hole_w` long from SLOT_Y - SLOT_H/2 to SLOT_Y + SLOT_H/2"""
    half_len = W / 2 if along_x else D / 2 - T
    t0, t1 = (sd * (D / 2 - T), sd * D / 2) if along_x else (sd * (W / 2 - T), sd * W / 2)
    t0, t1 = min(t0, t1), max(t0, t1)
    y0, y1 = SLOT_Y - SLOT_H / 2, SLOT_Y + SLOT_H / 2
    def b(n, a0, a1, yy0, yy1):
        if along_x:
            rim.append(box(f"{name}{n}", a0, a1, yy0, yy1, t0, t1))
        else:
            rim.append(box(f"{name}{n}", t0, t1, yy0, yy1, a0, a1))
    b("Low", -half_len, half_len, 0.0, y0)
    # (up to the lip, which caps the wall's top: no two faces in one plane to flicker)
    b("High", -half_len, half_len, y1, H - LIP_H)
    b("Left", -half_len, -hole_w / 2, y0, y1)
    b("Right", hole_w / 2, half_len, y0, y1)
for sd in (-1, 1):
    wall(f"wallL{sd}", True, sd, 0.12)
    wall(f"wallE{sd}", False, sd, 0.09)
rim.append(box("floor", -W / 2 + T - IN, W / 2 - T + IN, 0.0, FLOOR, -D / 2 + T - IN, D / 2 - T + IN))
# ---- the lip round the rim and the band round the foot, standing out a little
LIP = 0.005
def over(sd, half, by):
    # (the lip over the whole of the wall's thickness, out past it)
    a, b = sd * (half - T), sd * (half + by)
    return min(a, b), max(a, b)
def ring(name, xo, zo, xi, zi, y0, y1):
    """a rectangular ring in one piece (the owner's: the rim was four boxes, their ends showing as seams at the corners): out to xo, zo, in
    to xi, zi, from y0 to y1; its top, bottom, outer and inner sides each four quads round it"""
    bm = bmesh.new()
    rect = lambda hx, hz, y: [bm.verts.new(P(sx * hx, y, sz * hz)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ot, it, ob, ib = rect(xo, zo, y1), rect(xi, zi, y1), rect(xo, zo, y0), rect(xi, zi, y0)
    for k in range(4):
        n = (k + 1) % 4
        bm.faces.new((ot[k], ot[n], it[n], it[k]))
        bm.faces.new((ob[k], ib[k], ib[n], ob[n]))
        bm.faces.new((ob[k], ob[n], ot[n], ot[k]))
        bm.faces.new((ib[k], it[k], it[n], ib[n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o
rim.append(ring("lip", W / 2 + LIP, D / 2 + LIP, W / 2 - T, D / 2 - T, H - LIP_H, H))
for sd in (-1, 1):
    rim.append(box(f"footL{sd}", -W / 2 - LIP * 0.6, W / 2 + LIP * 0.6, 0.0, 0.008, *out_of(sd, D / 2, LIP * 0.6)))
    rim.append(box(f"footE{sd}", *out_of(sd, W / 2, LIP * 0.6), 0.0, 0.008, -D / 2 + IN, D / 2 - IN))
# ---- a few ribs along the walls' lower band, evenly spaced and the same on every side (the long sides' panels above them left smooth for
# the name)
RIB, RIB_OUT = 0.009, 0.004
for sd in (-1, 1):
    for k in range(5):
        x = -W / 2 + 0.04 + (W - 0.08) * k / 4
        rim.append(box(f"ribL{sd}{k}", x - RIB / 2, x + RIB / 2, 0.008, 0.07, *out_of(sd, D / 2, RIB_OUT)))
    for k in range(3):
        z = -D / 2 + 0.05 + (D - 0.1) * k / 2
        rim.append(box(f"ribE{sd}{k}", *out_of(sd, W / 2, RIB_OUT), 0.008, SLOT_Y - SLOT_H / 2 - 0.012, z - RIB / 2, z + RIB / 2))
# ---- the cells' walls inside: up to a little under the hand-holds (the owner's: they ran up past the holds' bottom, showing through them
# across the opening)
CELL_TOP = SLOT_Y - SLOT_H / 2 - 0.008
for c in range(1, COLS):
    x = -W / 2 + T + (W - 2 * T) * c / COLS
    rim.append(box(f"cellC{c}", x - 0.0025, x + 0.0025, FLOOR, CELL_TOP, -D / 2 + T, D / 2 - T))
for r in range(1, ROWS):
    z = -D / 2 + T + (D - 2 * T) * r / ROWS
    rim.append(box(f"cellR{r}", -W / 2 + T, W / 2 - T, FLOOR, CELL_TOP, z - 0.0025, z + 0.0025))
tray = rim[0]
bpy.ops.object.select_all(action="DESELECT")
for o in rim:
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
