"""The little cabinet by the staff's door that the samurai helmet sits on (kabutostand.glb; the owner's, 2026-11-12: "a small wooden stand
beside the staff-only door, and the helmet on it"; item 292, 2026-11-17: 「台座的模型太複雜了」「武士頭盔底下的台座有拉門」): a low cabinet of
dark keyaki, its top a paler board overhanging it a little, two sliding doors across its front in their own tracks (引き戸), each its frame
round a panel of kumiko lattice with a round pull let into it; inside a shelf, and the helmet's own lacquered box on its floor (where it's
put away out of season). Clean boxes, about 150 triangles in all: the grain, the lattice and the pulls in its picture (colour, and their
relief in a normal map), nothing carved in the mesh.

The game's frame: y up from the floor, x along the wall, z out from it; its foot's middle at the origin; in the wall's own units (DiningRoom's
wall frame: the wainscot 0.85 high), drawn as it is. As before: 0.30 along the wall, 0.20 out, its top at 0.70 (the helmet's place and the
way past it unchanged, item 48).

- "KabutoStandBody": everything that doesn't move: the plinth, the sides, the back, the floor, the top, the rail over the doors and the
  track under them, the shelf, the box.
- "KabutoStandDoorL", "KabutoStandDoorR": the two doors, the left in the back track, the right in the front one; each slides across behind
  or before the other to open its half (the game's).

Run:
    blender -b --factory-startup --python blender/kabutostand.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import export_dish, image, pbr  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

H, W, D, TOP_T = 0.70, 0.30, 0.20, 0.032
SIDE_T, BACK_T, PL_H = 0.018, 0.012, 0.05
X_IN = W / 2 - SIDE_T               # the inside's half width
FRONT = D / 2                        # the sides' front faces
OPEN_Y = (0.082, 0.638)              # the doors' opening, between the track and the rail
DOOR_T = 0.011
DOOR_W = X_IN + 0.006                # each door a little more than half, overlapping in the middle
TRACK_Z = {"L": (0.077, 0.077 + DOOR_T), "R": (0.0885, 0.0885 + DOOR_T)}


def P(x, y, z):
    return Vector((x, -z, y))


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


# =====================================================================
# Its picture: four quarters (u, v from the picture's bottom left): the carcass's keyaki (0..0.5, 0..0.5), the top's paler board
# (0.5..1, 0..0.5), the door's face, frame, lattice and pull (0..0.5, 0.5..1), the box's black lacquer and the inside's plain wood
# (0.5..1, 0.5..1); and the lattice's and the pull's relief, a height turned to a normal map
# =====================================================================
N = 512
rng = np.random.default_rng(5)


def grain(n, tone, rings=26, seed=0):
    r = np.random.default_rng(seed)
    v = np.linspace(0, 1, n)[:, None]
    u = np.linspace(0, 1, n)[None, :]
    g = 0.5 + 0.5 * np.sin((v * rings + np.sin(u * 6 + v * 3) * 0.8 + np.sin(u * 23) * 0.06) * math.pi * 2)
    k = np.clip(0.78 + 0.18 * g ** 1.6 - 0.12 * r.random((n, 1)) + r.normal(0, 0.02, (n, n)), 0, 1.2)
    return k[..., None] * lin(tone)[None, None, :]


Q = N // 2
rgb = np.zeros((N, N, 3), np.float32)
height = np.zeros((N, N), np.float32)
# (rows go up from the picture's foot: row r is v r/N)
rgb[0:Q, 0:Q] = grain(Q, "#7a4a2a", seed=1)                 # carcass: dark keyaki
rgb[0:Q, Q:N] = grain(Q, "#a8743f", rings=18, seed=2)       # top: paler
# (the door's face, in its quarter: u across the door 0..1, v up it 0..1)
door = grain(Q, "#6a3e22", seed=3)                          # its frame
dh = np.zeros((Q, Q), np.float32)
yy, xx = np.mgrid[0:Q, 0:Q] / (Q - 1)
inner = (xx > 0.12) & (xx < 0.88) & (yy > 0.08) & (yy < 0.92)
door[inner] = lin("#2a1a10") * 1.0                           # the dark ground behind the lattice
dh[~inner] = 1.0
# (the kumiko: a square lattice, its bars pale and standing proud of the dark ground; a diagonal cross in every other square)
lat = np.zeros((Q, Q), bool)
gx, gy = (xx - 0.12) / 0.76 * 4, (yy - 0.08) / 0.84 * 9
fx, fy = gx % 1, gy % 1
lat |= (fx < 0.09) | (fx > 0.91) | (fy < 0.07) | (fy > 0.93)
odd = ((np.floor(gx) + np.floor(gy)) % 2) == 0
lat |= odd & ((np.abs(fx - fy) < 0.06) | (np.abs(fx + fy - 1) < 0.06))
lat &= inner
door[lat] = grain(Q, "#c99a62", rings=40, seed=4)[lat]
dh[lat] = 0.7
# (the round pull let in at its outer edge (the left door's left, mirrored for the right by its UVs), a dark ring, recessed)
for cx in (0.06,):
    d = np.hypot((xx - cx) * 1.0, (yy - 0.5) * (0.56 / 0.138))
    ring = d < 0.035
    door[ring] = lin("#20140c")
    door[d < 0.022] = lin("#c9a050")
    dh[ring] = 0.2
rgb[Q:N, 0:Q] = door
height[Q:N, 0:Q] = dh
# (the box: black lacquer, a fine gold line round its lid's foot; the inside: plain pale wood)
box_q = np.zeros((Q, Q, 3), np.float32) + lin("#141010") * 1.6
box_q[: Q // 2, :] = grain(Q, "#b89468", rings=12, seed=6)[: Q // 2, :]
box_q[Q // 2 + 30: Q // 2 + 34, :] = lin("#c9a050")
rgb[Q:N, Q:N] = box_q


def normal_map(hf, strength=6.0):
    gy_, gx_ = np.gradient(hf)
    nx, ny, nz = -gx_ * strength, -gy_ * strength, np.ones_like(hf)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / L * 0.5 + 0.5, ny / L * 0.5 + 0.5, nz / L * 0.5 + 0.5], -1).astype(np.float32)


M = {
    "wood": pbr("KabutoStandWood", (1, 1, 1), tex=image("kabutostand_wood", rgb), nrm=image("kabutostand_nrm", normal_map(height), data=True),
                nrm_strength=0.8, rough=0.6),
}

# quarters of the picture, as (u0, v0, u1, v1)
CARCASS, TOPQ, DOORQ, BOXQ, INSIDE = (0, 0, 0.5, 0.5), (0.5, 0, 1, 0.5), (0, 0.5, 0.5, 1), (0.5, 0.75, 1, 1), (0.5, 0.5, 1, 0.75)
parts = []


def slab(bm, uvl, x0, x1, y0, y1, z0, z1, quad, front=None, flip_u=False):
    """a box; each face's picture its quarter (`quad`), the front face (+z) its own (`front`) if given, read the right way round from the
    front (or mirrored, `flip_u`)"""
    faces = {
        "+z": ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)),
        "-z": ((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)),
        "+x": ((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)),
        "-x": ((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)),
        "+y": ((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)),
        "-y": ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)),
    }
    for k, pts in faces.items():
        q = front if (k == "+z" and front) else quad
        f = bm.faces.new([bm.verts.new(P(*p)) for p in pts])
        u0, v0, u1, v1 = q
        # (the whole quarter on the front, read right; a strip of it on the rest, along its longer side)
        if k == "+z" and front:
            corners = ((0, 0), (1, 0), (1, 1), (0, 1))
            if flip_u:
                corners = ((1, 0), (0, 0), (0, 1), (1, 1))
        else:
            corners = ((0, 0), (1, 0), (1, 1), (0, 1))
        for lp, (a, b) in zip(f.loops, corners):
            lp[uvl].uv = (u0 + (u1 - u0) * a, v0 + (v1 - v0) * b)


def mesh(name, boxes):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    for b in boxes:
        slab(bm, uvl, *b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["wood"])
    parts.append(o)
    return o


body = mesh("KabutoStandBody", [
    # (the plinth, set back a little at the front)
    (-W / 2 + 0.008, W / 2 - 0.008, 0.0, PL_H, -D / 2 + 0.006, FRONT - 0.014, CARCASS),
    # (the sides, the back, the floor)
    (-W / 2, -X_IN, PL_H, H - TOP_T + 0.002, -D / 2, FRONT, CARCASS),
    (X_IN, W / 2, PL_H, H - TOP_T + 0.002, -D / 2, FRONT, CARCASS),
    (-X_IN + 0.0005, X_IN - 0.0005, PL_H, H - TOP_T + 0.001, -D / 2, -D / 2 + BACK_T, CARCASS),
    (-X_IN + 0.0005, X_IN - 0.0005, PL_H, OPEN_Y[0] - 0.012, -D / 2 + BACK_T, FRONT - 0.002, INSIDE),
    # (the track under the doors and the rail over them)
    (-X_IN + 0.0005, X_IN - 0.0005, OPEN_Y[0] - 0.012, OPEN_Y[0], TRACK_Z["L"][0] - 0.004, FRONT - 0.002, CARCASS),
    (-X_IN + 0.0005, X_IN - 0.0005, OPEN_Y[1], H - TOP_T + 0.001, TRACK_Z["L"][0] - 0.004, FRONT - 0.002, CARCASS),
    # (the top: a paler board, overhanging a centimetre all round but the back)
    (-W / 2 - 0.01, W / 2 + 0.01, H - TOP_T, H, -D / 2, FRONT + 0.01, TOPQ),
    # (inside: a shelf half way up, and the helmet's box on the floor)
    (-X_IN + 0.001, X_IN - 0.001, 0.36, 0.375, -D / 2 + BACK_T + 0.001, TRACK_Z["L"][0] - 0.012, INSIDE),
    (-0.09, 0.09, OPEN_Y[0] - 0.011, 0.22, -0.075, 0.035, BOXQ),
])
door_y = (OPEN_Y[0] + 0.001, OPEN_Y[1] - 0.001)
doorL = mesh("KabutoStandDoorL", [(-X_IN, -X_IN + DOOR_W, door_y[0], door_y[1], TRACK_Z["L"][0], TRACK_Z["L"][1], CARCASS, DOORQ, False)])
doorR = mesh("KabutoStandDoorR", [(X_IN - DOOR_W, X_IN, door_y[0], door_y[1], TRACK_Z["R"][0], TRACK_Z["R"][1], CARCASS, DOORQ, True)])

root = bpy.data.objects.new("KabutoStand", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("STAND_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.35, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.55, 0.75, 1.1)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kabutostand.glb"), os.path.join(PROJECT, "blender", "kabutostand.blend"), PREVIEW)
print("STAND_DONE")
