"""The emergency exit sign (誘導灯) on the wall by the way out, made as the edge-lit kind: a slim housing of brushed aluminium along the top,
fixed to the wall, its front sloping back to a lip; and hanging from a slot along its underside a thin pane of acrylic, lit from the edge,
its face printed (the game paints the face: EXIT, the running figure leaving by a doorway, the words in the language on screen).

- "ExitBox": the housing, 44 cm along, 6 tall, 7 deep; its end caps a little darker.
- "ExitFace": the pane's front, its UVs the whole face (0..1), facing +z; "ExitBack": its back, the same picture (u turned, so it reads
  right from behind too); "ExitPane": the pane's clear edges.

The sign faces +z, its back toward the wall (-z), the middle of the pane at the origin.

Run:
    blender -b --factory-startup --python blender/exitsign.py -- <project path> [preview.png]
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
# (the pane: its width and height, its thickness; the housing over it)
PW, PH, PT = 0.42, 0.155, 0.006
HW, HH, HD = 0.44, 0.06, 0.07


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def quad(bm, uvl, pts, uvs):
    f = bm.faces.new([bm.verts.new(P(*p)) for p in pts])
    for lp, uv in zip(f.loops, uvs):
        lp[uvl].uv = uv
    return f


def mesh_from(name, build, smooth=False):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    build(bm, uvl)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for p in o.data.polygons:
        p.use_smooth = smooth
    return o


def housing(bm, uvl):
    """the aluminium extrusion along x: its section (y, z) swept from end to end, the ends capped. Section: the wall side straight up, the
    top flat, the front sloping down and back to a lip, the underside with the slot the pane hangs in"""
    y0 = PH / 2 + 0.004
    sec = [(y0, -HD / 2), (y0 + HH, -HD / 2), (y0 + HH, HD / 2 - 0.022), (y0 + HH * 0.55, HD / 2), (y0 + 0.008, HD / 2 - 0.004), (y0, HD / 2 - 0.012)]
    n = len(sec)
    ends = []
    for x in (-HW / 2, HW / 2):
        ends.append([bm.verts.new(P(x, y, z)) for (y, z) in sec])
    run = 0.0
    for k in range(n):
        k2 = (k + 1) % n
        (ya, za), (yb, zb) = sec[k], sec[k2]
        L = math.hypot(yb - ya, zb - za)
        f = bm.faces.new((ends[0][k], ends[0][k2], ends[1][k2], ends[1][k]))
        for lp, uv in zip(f.loops, ((0, run), (0, run + L), (1, run + L), (1, run))):
            lp[uvl].uv = (uv[0] * 4, uv[1] * 8)
        run += L
    for e, rev in ((0, True), (1, False)):
        f = bm.faces.new(list(reversed(ends[e])) if rev else ends[e])
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.5)


def pane_front(bm, uvl):
    quad(bm, uvl, [(-PW / 2, -PH / 2, PT / 2), (PW / 2, -PH / 2, PT / 2), (PW / 2, PH / 2, PT / 2), (-PW / 2, PH / 2, PT / 2)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])


def pane_back(bm, uvl):
    # (seen from behind it reads the right way round: its u runs the other way)
    quad(bm, uvl, [(PW / 2, -PH / 2, -PT / 2), (-PW / 2, -PH / 2, -PT / 2), (-PW / 2, PH / 2, -PT / 2), (PW / 2, PH / 2, -PT / 2)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])


def pane_edges(bm, uvl):
    c = [(-PW / 2, -PH / 2), (PW / 2, -PH / 2), (PW / 2, PH / 2), (-PW / 2, PH / 2)]
    for k in range(4):
        (xa, ya), (xb, yb) = c[k], c[(k + 1) % 4]
        quad(bm, uvl, [(xa, ya, -PT / 2), (xb, yb, -PT / 2), (xb, yb, PT / 2), (xa, ya, PT / 2)], [(0, 0), (1, 0), (1, 1), (0, 1)])


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "alu": pbr("ExitAluminium", (0.78, 0.79, 0.8), rough=0.32, metal=1.0),
    "face": pbr("ExitFaceLit", (0.05, 0.55, 0.25), emit=(0.05, 0.55, 0.25), emit_strength=2.0),
    "edge": pbr("ExitPaneEdge", (0.55, 0.9, 0.7), emit=(0.4, 0.9, 0.6), emit_strength=1.0),
}
parts = []
for name, build, mat in (("ExitBox", housing, "alu"), ("ExitFace", pane_front, "face"), ("ExitBack", pane_back, "face"), ("ExitPane", pane_edges, "edge")):
    o = mesh_from(name, build)
    o.data.materials.append(M[mat])
    parts.append(o)
root = bpy.data.objects.new("ExitSign", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("EXIT_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.02, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.18, 0.08, 0.7)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.3, 0.3, 0.32)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "exitsign.glb"), os.path.join(PROJECT, "blender", "exitsign.blend"), PREVIEW)
print("EXIT_DONE")
