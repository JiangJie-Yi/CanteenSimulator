"""The round window's woodwork (丸窓, roundwindow.glb, node "RoundWindowWood"), the paper behind it drawn by the game:
- RoundFrame: the frame, a ring of keyaki turned to a moulded profile (a lip over the reveal, a chamfer, a broad face, an outer
  roundover down to the wall), made as such a frame is, of four bent segments, each its own tone, the grain running round with it and a
  fine joint where one meets the next;
- RoundBead: a fine dark bead where the frame meets the reveal;
- RoundReveal: the reveal, the wall's thickness lined in wood, its grain running round;
- RoundLattice: the lattice (組子) over the paper, three bars each way, their edges eased, the grain along each, crossing in half-laps.
In the game's frame (three's): x the wall's normal, the room toward -x; y up; z along the wall; the window's middle at the origin, its paper
(the game's, 0.4 across) just off the wall at x = -0.004.

Run:
    blender -b --factory-startup --python blender/roundwindow.py -- <project path> [preview.png]
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
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(5)


def P(x, y, z):
    """three's frame (y up) into Blender's (z up)"""
    return Vector((x, -z, y))


R = 0.4
SEG = 4

N = 512
u, v = grid01(N)
# ---- the pictures: u round the ring (or along a bar), v across it
# (keyaki: warm brown, the grain in long flowing lines along it, here and there a tighter figure; the ring's four segments each a little
# different in tone and in where its lines fall, a fine dark joint between them)
seg_i = np.floor(u * SEG)
tone = 1 + 0.06 * np.sin(seg_i * 2.3 + 0.7)
warp = (fbm(N, 3, 2, 4) - 0.5) * 2.6 + (fbm(N, 9, 3, 3) - 0.5) * 0.6 + 0.12 * np.sin(u * 2 * np.pi * SEG * 1.5 + seg_i)
lines = np.sin((v * (8 + 3 * fbm(N, 2, 1, 2)) + seg_i * 0.37 + warp) * 2 * np.pi) * 0.5 + 0.5
fine = np.sin((v * 47 + warp * 3.1) * 2 * np.pi) * 0.5 + 0.5
pores = (fbm(N, 90, 6, 2) > 0.7).astype(np.float32)
keyaki = mix((0.72, 0.48, 0.27), (0.53, 0.32, 0.16), smooth(0.55, 0.97, lines) * 0.62 + smooth(0.75, 1.0, fine) * 0.12 + pores * 0.08)
keyaki = keyaki * tone[..., None] * (0.92 + 0.12 * fbm(N, 6, 3, 4))[..., None]
joint = np.minimum.reduce([np.abs(u - k / SEG) for k in range(SEG + 1)])
keyaki = mix(keyaki, (0.3, 0.17, 0.08), smooth(0.0009, 0.0002, joint) * 0.8)
# (the reveal: the same wood a shade darker, in shadow inside the wall; the bead: dark stained; the lattice: paler sugi, its grain along it)
reveal = keyaki * 0.82
lat_lines = np.sin((v * 7 + (fbm(N, 2, 3, 4) - 0.5) * 0.9) * 2 * np.pi) * 0.5 + 0.5
lattice = mix((0.69, 0.47, 0.28), (0.56, 0.36, 0.2), smooth(0.6, 1.0, lat_lines) * 0.7) * (0.95 + 0.07 * fbm(N, 3, 16, 3))[..., None]
M = {
    "frame": pbr("RoundFrameWood", (1, 1, 1), tex=image("round_keyaki", np.clip(keyaki, 0, 1).astype(np.float32)), rough=0.45, coat=0.25),
    "reveal": pbr("RoundRevealWood", (1, 1, 1), tex=image("round_reveal", np.clip(reveal, 0, 1).astype(np.float32)), rough=0.6),
    "bead": pbr("RoundBeadWood", (0.11, 0.06, 0.03), rough=0.4),
    "lattice": pbr("RoundLatticeWood", (1, 1, 1), tex=image("round_lattice", np.clip(lattice, 0, 1).astype(np.float32)), rough=0.55),
}
parts = []


def fin(o, name, mat, smooth_shade=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth_shade
    parts.append(o)
    return o


def from_bm(name, bm, mat, smooth_shade=True, recalc=True):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return fin(o, name, mat, smooth_shade)


def revolve(name, profile, mat, seg=96, outward=True, closed=False):
    """a ring turned round the window's axis from a profile of (r, x) points (r out from the middle, x toward the room), u round it and v
    along the profile (by its length); `outward` false turns its faces the other way"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    lens = [0.0]
    for (r0, x0), (r1, x1) in zip(profile, profile[1:]):
        lens.append(lens[-1] + math.hypot(r1 - r0, x1 - x0))
    total = lens[-1] or 1
    rows = []
    for j in range(seg + 1):
        a = 2 * math.pi * j / seg
        rows.append([bm.verts.new(P(x, r * math.sin(a), r * math.cos(a))) for r, x in profile])
    n = len(profile)
    for j in range(seg):
        for i in range(n - 1 + (1 if closed else 0)):
            i2 = (i + 1) % n
            # (wound so each face looks to the left of the profile as it's drawn, (r, x) round from the window's middle: the frame's, drawn from
            # its inner lip out and back to the wall, toward the room and outward; the reveal's, drawn from the wall toward the room, in
            # toward the middle, seen from inside it)
            q = (rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i])
            uvs = ((j / seg, lens[i] / total), (j / seg, (lens[i2] if i2 else total) / total), ((j + 1) / seg, (lens[i2] if i2 else total) / total), ((j + 1) / seg, lens[i] / total))
            f = bm.faces.new(q if outward else q[::-1])
            for loop, uv in zip(f.loops, uvs if outward else uvs[::-1]):
                loop[uvl].uv = uv
    # (the seam where the sweep closes: its last ring onto its first)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    return from_bm(name, bm, mat, recalc=False)


# (the frame's profile, from the lip that overhangs the reveal round to the wall: a lip, a chamfer up onto the broad face, a roundover down
# its outer side to the wall)
FRAME = [(R - 0.002, -0.058), (R - 0.006, -0.063), (R - 0.006, -0.073), (R + 0.004, -0.084), (R + 0.02, -0.0885), (R + 0.045, -0.089),
         (R + 0.062, -0.085), (R + 0.072, -0.075), (R + 0.077, -0.06), (R + 0.078, -0.035), (R + 0.078, -0.006)]
# (the profile's points go outward and toward the wall; for the faces to point out of the ring, the sweep's order decides: checked below)
frame = revolve("RoundFrame", FRAME, M["frame"])
# (the bead: a small half-round where the lip meets the reveal)
BEAD = [(R - 0.002 + 0.0055 * math.cos(t), -0.059 + 0.0055 * math.sin(t)) for t in np.linspace(math.pi * 0.5, math.pi * 1.5, 7)]
revolve("RoundBead", [(r, x) for r, x in BEAD], M["bead"], seg=72)
# (the reveal: the inside of the wall's thickness, lined; seen from inside the ring)
revolve("RoundReveal", [(R + 0.004, -0.001), (R + 0.004, -0.06)], M["reveal"], seg=72)


def bar(name, length, w, d, at, vertical):
    """a lattice bar, eased at its edges, its grain along it"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.view_layer.objects.active
    # (built along Blender's z, then turned: vertical bars stand up the window (three's y), the others run along it (three's z))
    o.scale = (d, w, length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = bevel(o, 0.0018, 2, angle=False)
    bpy.ops.object.modifier_apply(modifier=bev.name)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for loop in f.loops:
            c = loop.vert.co
            loop[uvl].uv = (c.z / 0.9 + 0.5, (c.x + c.y) / 0.05 + 0.5)
    bm.to_mesh(o.data)
    bm.free()
    if not vertical:
        o.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.location = at
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    return fin(o, name, M["lattice"], smooth_shade=False)


LAT = (-0.2, 0.0, 0.2)
for k in LAT:
    L = 2 * math.sqrt(R * R - k * k) + 0.006
    # (vertical bars: across at z = k; the others: up at y = k; both at x = -0.012, 0.018 deep, 0.016 wide)
    bar(f"RoundLatticeV{k:+.1f}", L, 0.016, 0.018, P(-0.012, 0, k), True)
    bar(f"RoundLatticeH{k:+.1f}", L, 0.016, 0.018, P(-0.012, k, 0), False)

root = bpy.data.objects.new("RoundWindowWood", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
tris = 0
for o in parts:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
print("ROUNDWINDOW_TRIS", tris)
if PREVIEW:
    # (the paper, for the preview only: a pale disc behind the lattice)
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=R, fill_type="NGON", location=P(-0.004, 0, 0), rotation=(0, math.pi / 2, 0))
    paper = bpy.context.view_layer.objects.active
    paper.data.materials.append(pbr("PreviewPaper", (0.85, 0.9, 1.0), rough=0.9))
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(map(float, os.environ.get("PREVIEW_CAM", "-1.4,0.5,0.35").split(",")))
    cam.rotation_mode = "QUATERNION"
    at = Vector(map(float, os.environ.get("PREVIEW_AT", "0,0,0").split(",")))
    cam.rotation_quaternion = (at - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (0.9, -0.6, 0.0)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.72, 0.66, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "roundwindow.glb"), os.path.join(PROJECT, "blender", "roundwindow.blend"), PREVIEW)
print("ROUNDWINDOW_DONE", len(parts))
