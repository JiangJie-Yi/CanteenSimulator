"""The raw potatoes and sweet potatoes in their sacks (produce.glb, node "ProduceSacks"): three burlap sacks standing against the kitchen side
of the bar, their mouths rolled down so what's in them shows (two of potatoes, one of sweet potatoes with a red band woven round it), and a
few that have rolled out onto the floor in front.

The game's frame, in the room's units: y up, the sacks along x (about 1.1 across), their backs to -z, the middle of their foot at the
origin.

Run:
    blender -b --factory-startup --python blender/produce.py -- <project path> [preview.png]
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
seed(7)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)


def burlap(name, band=None):
    """burlap's coarse plain weave: threads over and under, uneven, flecked, a little hairy; `band` a colour woven round it near the top"""
    S = 256
    u, v = grid01(S)
    f = 60
    wx, wy = np.abs(np.sin(np.pi * u * f)), np.abs(np.sin(np.pi * v * f))
    over = (np.floor(u * f) + np.floor(v * f)) % 2
    thread = np.where(over > 0, 0.35 + 0.65 * wx, 0.35 + 0.65 * wy)
    gaps = smooth(0.02, 0.3, np.minimum(wx, wy))
    n = fbm(S, 6, 6)
    fleck = smooth(0.62, 0.8, fbm(S, 24, 24))
    col = mix(lin("#5c4a32"), lin("#b59a6e"), np.clip(thread * 0.75 + n * 0.35, 0, 1))
    col = mix(col, lin("#3e2c18"), fleck * 0.25)
    col *= (0.62 + 0.38 * gaps)[..., None]
    if band is not None:
        b = smooth(0.0, 0.012, 0.03 - np.abs(v - 0.72)) * np.where(over > 0, 1.0, 0.75)
        col = mix(col, lin(band) * (0.75 + 0.25 * thread)[..., None], b)
    return pbr(name, (1, 1, 1), tex=image(name, col), rough=0.95)


M = {
    "sackP": burlap("ProduceSackPotato"),
    "sackS": burlap("ProduceSackSweet", band="#b8322a"),
    "potato": pbr("ProducePotato", tuple(lin("#c9a464")), rough=0.85),
    "sweet": pbr("ProduceSweetPotato", tuple(lin("#8e2f4c")), rough=0.6),
    "tie": pbr("ProduceTwine", tuple(lin("#a88a5a")), rough=0.9),
}
parts = []


def mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def sack(name, cx, cz, h, r, mat, lean=(0.0, 0.0), seg=20, rings=9):
    """a sack standing full: its sides bellied out and lumpy with what's in it, its foot slumped, its mouth rolled down outside into a
    fat roll round the top (a ring of its own: each a surface whose outside faces out, where one sheet folded back over itself had half
    of it turned inside out, its sides lit from within and dark); cylindrical UVs, the weave running round it"""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    lumps = [[1 + 0.07 * math.sin(3 * a + 1.3 * k) * math.cos(2 * a - k) for a in [2 * math.pi * j / seg for j in range(seg)]] for k in range(rings)]
    prof = []
    for k in range(rings):
        t = k / (rings - 1)
        y = h * t
        rr = r * (0.82 + 0.18 * math.sin(math.pi * min(1, t * 1.15)) ** 0.5) * (1.0 if t < 0.95 else 0.95)
        prof.append((rr, y, t))
    vrows = []
    for k, (rr, y, t) in enumerate(prof):
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            l = lumps[k][j]
            dx, dz = lean[0] * y, lean[1] * y
            row.append(bm.verts.new(P(cx + rr * l * math.cos(a) + dx, y, cz + rr * l * math.sin(a) + dz)))
        vrows.append(row)
    # (wound to face out: up the side first, then round)
    for k in range(len(vrows) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm.faces.new((vrows[k][j], vrows[k + 1][j], vrows[k + 1][j2], vrows[k][j2]))
            for loop, (jj, kk) in zip(f.loops, ((j, k), (j, k + 1), (j + 1, k + 1), (j + 1, k))):
                loop[uv].uv = (jj / seg * 2, prof[kk][2])
    # (its foot, a fan facing down)
    c = bm.verts.new(P(cx, 0.0, cz))
    for j in range(seg):
        bm.faces.new((vrows[0][j], vrows[0][(j + 1) % seg], c))
    o = mesh_object(name, bm, mat)
    # ---- the roll: the mouth's cloth turned down outside and rolled up fat, lumpy, a little flattened, hiding the side's top edge ----
    RR, ring = 0.034, 8
    top_r = prof[-1][0]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    grid = []
    for j in range(seg):
        a = 2 * math.pi * j / seg
        l = lumps[-1][j]
        bulge = 1 + 0.18 * math.sin(5 * a + cx * 9) * math.cos(3 * a)
        mid_r = top_r * l + RR * 0.55
        dx, dz = lean[0] * h, lean[1] * h
        row = []
        for i in range(ring):
            ph = 2 * math.pi * i / ring
            rad = mid_r + math.cos(ph) * RR * bulge
            y = h - RR * 0.25 + math.sin(ph) * RR * 0.8 * bulge
            row.append(bm.verts.new(P(cx + rad * math.cos(a) + dx, y, cz + rad * math.sin(a) + dz)))
        grid.append(row)
    for j in range(seg):
        j2 = (j + 1) % seg
        for i in range(ring):
            i2 = (i + 1) % ring
            f = bm.faces.new((grid[j][i], grid[j2][i], grid[j2][i2], grid[j][i2]))
            for loop, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                loop[uv].uv = (jj / seg * 2, 0.9 + ii / ring * 0.2)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh_object(name + "Roll", bm, mat)
    return o


def tuber(name, x, y, z, size, kind, rot=(0.0, 0.0, 0.0)):
    """a potato (lumpy, round-oval) or a sweet potato (long, tapered at both ends, a little bent)"""
    if kind == "potato":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=7, radius=1, location=P(x, y, z))
        o = active()
        o.scale = (size * 1.15, size * 0.95, size * 0.85)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=1, location=P(x, y, z))
        o = active()
        o.scale = (size * 2.1, size * 0.85, size * 0.8)
    apply_scale(o)
    me = o.data
    for vv in me.vertices:
        if kind == "potato":
            k = 1 + 0.08 * math.sin(vv.co.x * 41 + vv.co.y * 17) * math.cos(vv.co.z * 33)
        else:
            t = vv.co.x / (size * 2.1)
            k = 1 - 0.55 * abs(t) ** 2.2
            vv.co.z += size * 0.25 * (1 - t * t)
        vv.co.y *= k
        vv.co.z *= k if kind == "potato" else 1
    o.rotation_euler = rot
    o.name = name
    o.data.materials.append(M["potato" if kind == "potato" else "sweet"])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


# ---- the three sacks, standing close together, leaning on each other a little ----
SACKS = [  # (x, z, height, radius, material, lean, what's in it)
    (-0.38, 0.0, 0.46, 0.17, "sackP", (0.03, 0.0), "potato"),
    (0.0, -0.03, 0.5, 0.18, "sackS", (0.0, 0.01), "sweet"),
    (0.37, 0.01, 0.42, 0.165, "sackP", (-0.04, 0.0), "potato"),
]
for i, (x, z, h, r, mat, lean, kind) in enumerate(SACKS):
    sack(f"ProduceSack{i}", x, z, h, r, mat, lean)
    # (what's in it, heaped in its mouth)
    tx, tz = x + lean[0] * h, z + lean[1] * h
    if kind == "potato":
        for k, (dx, dz, dy) in enumerate([(-0.06, -0.04, 0.0), (0.06, -0.05, 0.005), (0.0, 0.06, 0.01), (-0.07, 0.06, -0.005), (0.07, 0.05, 0.0), (0.0, 0.0, 0.035)]):
            tuber(f"ProducePotato{i}{k}", tx + dx, h - 0.01 + dy, tz + dz, 0.05, "potato", rot=(k * 0.7, k * 1.3, k * 0.4))
    else:
        for k, (dx, dz, dy, a) in enumerate([(-0.05, -0.05, 0.0, 0.4), (0.06, 0.0, 0.01, -0.6), (-0.02, 0.07, 0.0, 1.2), (0.02, -0.01, 0.04, 0.1)]):
            tuber(f"ProduceSweet{i}{k}", tx + dx, h - 0.005 + dy, tz + dz, 0.045, "sweet", rot=(0.0, 0.15 * k, a))
# ---- a few rolled out in front ----
tuber("ProduceLoose0", -0.2, 0.04, 0.27, 0.05, "potato", rot=(0.3, 0.2, 0.9))
tuber("ProduceLoose1", 0.25, 0.04, 0.3, 0.045, "potato", rot=(1.1, 0.0, 0.2))
tuber("ProduceLoose2", 0.06, 0.035, 0.33, 0.045, "sweet", rot=(0.0, 0.0, 0.7))

# ---- under one root ----
root = bpy.data.objects.new("ProduceSacks", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("PRODUCE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.25, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.5, 0.9, 1.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "produce.glb"), os.path.join(PROJECT, "blender", "produce.blend"), PREVIEW)
print("PRODUCE_DONE")
