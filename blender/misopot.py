"""The miso soup's pot beside the rice tub (misopot.glb, node "MisoPot"), in the game's units (the rice tub's), standing on its own little
stand (the game sets it on a small copy of the rice tub's stand).

A hammered aluminium pot with two handles (両手鍋), its rim rolled, the hammer's dimples all over its sides catching the light; full of miso soup
(its cloudy brown surface, little cubes of tofu, wakame and rings of green onion in it); its wooden lid pushed half off and resting across
the rim, a dark bar of a handle on it; a ladle (お玉) of the same aluminium in it, its long handle resting against the rim. The pot's foot at
y 0, its middle over the origin.

Run:
    blender -b --factory-startup --python blender/misopot.py -- <project path> [preview.png]
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
seed(17)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)

R, H = 0.3, 0.38           # (the pot's radius and height)
SOUP = 0.31                # (how high the soup comes)


def hammered(N=512):
    """the hammered aluminium: a field of round dimples, each a little brighter at one side and darker at the other, over a soft grey; its
    height for the normal map too"""
    u, v = grid01(N)
    col = np.broadcast_to(lin("#b9bec4"), (N, N, 3)).copy()
    h = np.zeros((N, N), np.float32)
    rng_ = np.random.default_rng(3)
    for _ in range(900):
        cx, cy, r = rng_.random(), rng_.random(), 0.012 + 0.01 * rng_.random()
        dx = (u - cx + 0.5) % 1.0 - 0.5
        dy = (v - cy + 0.5) % 1.0 - 0.5
        d = np.sqrt(dx * dx + dy * dy) / r
        h -= np.clip(1 - d * d, 0, 1) * (0.6 + 0.4 * rng_.random())
    h = h - h.min()
    h /= h.max() + 1e-6
    shade = to_normal(h, 6.0)
    col *= (0.86 + 0.22 * (shade[..., 0] * 0.6 + shade[..., 1] * 0.4))[..., None]
    col *= (0.94 + 0.08 * fbm(N, 4, 4))[..., None]
    return col, to_normal(h, 3.0)


def soup(N=512):
    """the soup seen from above: cloudy brown miso, darker where it's settled, paler swirls where it's moving; cubes of tofu, bits of wakame
    and rings of green onion floating in it"""
    u, v = grid01(N)
    x, y = (u - 0.5) * 2, (v - 0.5) * 2
    swirl = fbm(N, 4, 4)
    col = mix(lin("#8a5a2a"), lin("#c8955a"), smooth(0.3, 0.8, swirl))
    col = mix(col, lin("#6e4420"), smooth(0.6, 1.0, np.sqrt(x * x + y * y)) * 0.35)
    rng_ = np.random.default_rng(8)
    for _ in range(9):
        cx, cy, s = rng_.uniform(-0.6, 0.6), rng_.uniform(-0.6, 0.6), rng_.uniform(0.07, 0.1)
        a = rng_.uniform(0, math.pi)
        rx = (x - cx) * math.cos(a) + (y - cy) * math.sin(a)
        ry = -(x - cx) * math.sin(a) + (y - cy) * math.cos(a)
        m = (np.abs(rx) < s) & (np.abs(ry) < s)
        col[m] = lin("#f4efe2")
        edge = m & ((np.abs(rx) > s * 0.82) | (np.abs(ry) > s * 0.82))
        col[edge] = lin("#ded5c0")
    for _ in range(10):
        cx, cy = rng_.uniform(-0.7, 0.7), rng_.uniform(-0.7, 0.7)
        d = np.sqrt((x - cx) ** 2 * 1.8 + (y - cy) ** 2)
        col = mix(col, lin("#2e4a22"), smooth(0.12, 0.06, d + (fbm(N, 12, 12) - 0.5) * 0.08))
    for _ in range(14):
        cx, cy = rng_.uniform(-0.75, 0.75), rng_.uniform(-0.75, 0.75)
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        col = mix(col, lin("#7fb84a"), smooth(0.012, 0.0, np.abs(d - 0.035)))
    return col


def wood(N=256):
    seed(4)
    u, v = grid01(N)
    wob = (fbm(N, 2, 6, 4) - 0.5) * 0.06
    col = mix(lin("#c8a070"), lin("#b48a58"), smooth(0.3, 1.0, fbm(N, 3, 2, 4)))
    return mix(col, lin("#9a7444"), smooth(0.7, 1.0, (np.sin((v + wob) * 2 * math.pi * 18) * 0.5 + 0.5)) * 0.4)


AL, AL_N = hammered()
M = {
    "alu": pbr("MisoPotAlu", (1, 1, 1), tex=image("T_MisoPotAlu", AL), nrm=image("T_MisoPotAluN", AL_N, data=True), rough=0.32, metal=0.85),
    "inside": pbr("MisoPotInside", tuple(lin("#8f9499")), rough=0.4, metal=0.7),
    "soup": pbr("MisoSoup", (1, 1, 1), tex=image("T_MisoSoup", soup()), rough=0.25),
    "lid": pbr("MisoPotLid", (1, 1, 1), tex=image("T_MisoPotLid", wood()), rough=0.6),
    "grip": pbr("MisoPotGrip", tuple(lin("#3a2414")), rough=0.5),
}
parts = []


def mesh(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = smooth_
    parts.append(o)
    return o


def lathe(name, prof, mat, segs=24, top_uv=False):
    """turned round y: the profile (radius, height) pairs; UVs round it, or laid flat from above (top_uv: a surface seen from above). A point
    of it on the axis isn't made: the ring beside it is closed across in a ladder instead (a fan of triangles into the middle shades in
    a dark blotch: the owner's)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) for j in range(segs)]
             if r > 1e-6 else None for (r, y) in prof]

    def uv(f):
        for lp in f.loops:
            co = lp.vert.co
            if top_uv:
                lp[uvl].uv = (co.x / (2 * R) + 0.5, -co.y / (2 * R) + 0.5)
            else:
                ang = (math.atan2(-co.y, co.x) / (2 * math.pi)) % 1.0
                lp[uvl].uv = (ang * 3, co.z / H)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if a is None or b is None:
            for f in ladder_fill(bm, a or b):
                uv(f)
            continue
        for j in range(segs):
            j2 = (j + 1) % segs
            uv(bm.faces.new((a[j], b[j], b[j2], a[j2])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # (a surface seen from above faces up)
    if top_uv:
        bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f.normal.z < 0])
    return bm


# ---- the pot: its sides a little flared, the rim rolled; the inside its own duller grey; the soup's surface ----
outside = [(0.0, 0.0), (R * 0.92, 0.0), (R * 0.97, 0.01), (R, 0.04), (R * 1.01, H - 0.02), (R * 1.04, H), (R * 1.055, H + 0.012), (R * 1.03, H + 0.02)]
mesh("MisoPotBody", lathe("MisoPotBody", outside, "alu"), "alu")
inside = [(R * 1.0, H + 0.018), (R * 0.975, H - 0.01), (R * 0.965, 0.03), (R * 0.9, 0.012), (0.0, 0.012)]
mesh("MisoPotInside", lathe("MisoPotInside", inside, "inside"), "inside")
mesh("MisoSoup", lathe("MisoSoup", [(0.0, SOUP), (R * 0.966, SOUP)], "soup", top_uv=True), "soup")
# ---- its two handles: loops of round bar riveted to its sides ----
for sd in (-1, 1):
    bm = bmesh.new()
    pts = [Vector((sd * (R + 0.01), H - 0.07, -0.06)), Vector((sd * (R + 0.06), H - 0.06, -0.05)), Vector((sd * (R + 0.075), H - 0.05, 0.0)),
           Vector((sd * (R + 0.06), H - 0.06, 0.05)), Vector((sd * (R + 0.01), H - 0.07, 0.06))]
    rings = []
    for i, c in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.cross(Vector((0, 1, 0))).normalized()
        b2 = a.cross(t).normalized()
        rings.append([bm.verts.new(P(*(c + a * 0.011 * math.cos(2 * math.pi * k / 8) + b2 * 0.011 * math.sin(2 * math.pi * k / 8)))) for k in range(8)])
    for i in range(len(rings) - 1):
        for k in range(8):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % 8], rings[i + 1][(k + 1) % 8], rings[i + 1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh(f"MisoPotHandle{sd}", bm, "alu")
# ---- the lid: a wooden disc pushed half off, resting across the rim, a dark bar of a handle on it ----
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
segs = 28
LR, LT = R * 1.06, 0.022
top = [bm.verts.new(P(LR * math.cos(2 * math.pi * j / segs), LT, LR * math.sin(2 * math.pi * j / segs))) for j in range(segs)]
bot = [bm.verts.new(P(LR * math.cos(2 * math.pi * j / segs), 0.0, LR * math.sin(2 * math.pi * j / segs))) for j in range(segs)]
f = bm.faces.new(top)
for lp in f.loops:
    lp[uvl].uv = (lp.vert.co.x / (2 * LR) + 0.5, -lp.vert.co.y / (2 * LR) + 0.5)
f = bm.faces.new(list(reversed(bot)))
for lp in f.loops:
    lp[uvl].uv = (lp.vert.co.x / (2 * LR) + 0.5, -lp.vert.co.y / (2 * LR) + 0.5)
for j in range(segs):
    j2 = (j + 1) % segs
    f = bm.faces.new((bot[j], bot[j2], top[j2], top[j]))
    for lp in f.loops:
        lp[uvl].uv = (j / segs, lp.vert.co.z / LT)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
lid = mesh("MisoPotLid", bm, "lid")
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, LT + 0.018, 0))
grip = active()
grip.scale = (0.2, 0.034, 0.03)
apply_scale(grip)
bv = bevel(grip, 0.01, 2)
bv.limit_method = "NONE"
bpy.context.view_layer.objects.active = grip
bpy.ops.object.modifier_apply(modifier=bv.name)
finish(grip, "MisoPotLidGrip", M["grip"])
parts.append(grip)
grip.parent = lid
# (pushed back off a third of the way and tipped up a little, resting on the rim at the back)
lid.location = P(0.0, H + 0.02, -R * 0.42)
lid.rotation_euler = (math.radians(-6), 0, 0)
# ---- the ladle: a shallow round bowl and a long handle hooked at its end, resting against the rim at the front-right ----
bm = lathe("MisoLadleBowl", [(0.0, 0.0), (0.045, 0.006), (0.062, 0.03), (0.064, 0.042), (0.06, 0.044), (0.0, 0.012)], "alu", segs=18)
ladle = mesh("MisoLadleBowl", bm, "alu")
bm = bmesh.new()
pts = [Vector((0.058, 0.04, 0.0)), Vector((0.12, 0.14, 0.0)), Vector((0.2, 0.3, 0.0)), Vector((0.26, 0.4, 0.0)), Vector((0.275, 0.43, 0.0)), Vector((0.27, 0.45, 0.0))]
rings = []
for i, c in enumerate(pts):
    t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
    a = t.cross(Vector((0, 0, 1))).normalized()
    b2 = a.cross(t).normalized()
    w = 0.008
    rings.append([bm.verts.new(P(*(c + a * w * 1.4 * math.cos(2 * math.pi * k / 6) + b2 * w * math.sin(2 * math.pi * k / 6)))) for k in range(6)])
for i in range(len(rings) - 1):
    for k in range(6):
        bm.faces.new((rings[i][k], rings[i][(k + 1) % 6], rings[i + 1][(k + 1) % 6], rings[i + 1][k]))
bm.faces.new(list(reversed(rings[0])))
bm.faces.new(rings[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
handle = mesh("MisoLadleHandle", bm, "alu")
handle.parent = ladle
# (dipped in the soup at the front-right, its handle up over the rim)
ladle.location = P(R * 0.35, SOUP - 0.035, R * 0.3)
ladle.rotation_euler = (0, 0, math.radians(-35))

root = bpy.data.objects.new("MisoPot", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
print("MISOPOT_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.25, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.5, 0.95, 0.9)
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
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "misopot.glb"), os.path.join(PROJECT, "blender", "misopot.blend"), PREVIEW)
print("MISOPOT_DONE")
