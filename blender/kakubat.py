"""The open shop's square iron tray by the fire and the floor's tongs (item 317, the owner's, 2026-11-18: 「開店的時候老闆的碗會收起來換成方形鐵
盤，用來放剛烤好的料理用的，就是會從那個方形鐵把鐵籤給收回來，然後料理部份再由服務員用夾子(會放在旁邊)夾到碗內給客人」), in the fire's frame (as
the tasting bowl it stands in for: 0.8 across there):

- "KakubatPan": a stainless 角バット, 0.92 by 0.64 over its rim and 7 cm deep, its walls sloping in a little to its foot, its corners rounded,
  its rim a flat lip; one closed solid (its floor inside, its foot outside), 12 points round each of its five rings.
- "KakubatRack": the wire rack (網) that lies in it 3 cm over its floor, for what's grilled to lie on: one square, its wires a picture with
  the gaps cut out (the game tests its alpha, both sides seen).
- "KakubatTong0", "KakubatTong1": the two arms of a pair of stainless tongs (トング), 42 cm, lying flat along +x from their hinge at the
  origin, spread a little apart in z (they're sprung open), each a strip on edge with a broad scalloped grip at its end; the hinge's loop on
  the first. Each arm's origin its hinge, for the game to close them on what they pick up (turning each about y).

The tray stands at its origin (its foot's middle on y = 0, its long side along x). Low in triangles: the pan 88, the rack 2, the tongs 100.

Run:
    blender -b --factory-startup --python blender/kakubat.py -- <project path> [preview.png]
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


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def mesh_obj(name, bm, smooth_shade=True, sharp_deg=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth_shade
    if smooth_shade and sharp_deg is not None:
        try:
            o.data.set_sharp_from_angle(angle=math.radians(sharp_deg))
        except AttributeError:
            pass
    return o


def tris(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def rrect(hx, hz, r, y, n=3):
    """a rounded rectangle's points round it (half sizes hx, hz, its corners' radius r), n to each corner's quarter, at height y"""
    pts = []
    for cx, cz, a0 in ((hx - r, hz - r, 0.0), (-(hx - r), hz - r, 90.0), (-(hx - r), -(hz - r), 180.0), (hx - r, -(hz - r), 270.0)):
        for k in range(n):
            a = math.radians(a0 + 90.0 * k / (n - 1))
            pts.append((cx + r * math.cos(a), y, cz + r * math.sin(a)))
    return pts


# =====================================================================
# The rack's picture: its wires, the gaps between them clear
# =====================================================================
RACK_L, RACK_W, RACK_Y = 0.84, 0.56, 0.03


def rack_picture(W=512, H=344):
    u = (np.arange(W) + 0.5) / W * RACK_L
    v = (np.arange(H) + 0.5) / H * RACK_W
    X, Z = np.meshgrid(u, v)
    a = np.zeros((H, W), np.float32)
    edge = np.zeros((H, W), np.float32)

    def wires(coord, step, start, half):
        # (each wire: its core, and a darker line either side of it, as the room's ink draws an edge)
        d = np.abs(((coord - start) + step / 2) % step - step / 2)
        return (d <= half).astype(np.float32), ((d > half) & (d <= half + 0.0009)).astype(np.float32)

    # (lengthwise wires every 6 cm across it; cross wires every 8 cm along it; a thicker frame wire round it)
    for coord, step, start, half in ((Z, RACK_W / 9, 0.0, 0.003), (X, RACK_L / 10, 0.0, 0.0032)):
        core, rim = wires(coord, step, start, half)
        a = np.maximum(a, core)
        edge = np.maximum(edge, rim)
    border = (np.minimum(np.minimum(X, RACK_L - X), np.minimum(Z, RACK_W - Z)) <= 0.006).astype(np.float32)
    a = np.maximum(a, border)
    rgb = np.zeros((H, W, 3), np.float32)
    steel = np.array([0.93, 0.94, 0.95], np.float32)
    rgb[:] = steel
    dark = steel * 0.8
    rgb = np.where(edge[..., None] > 0, dark, rgb)
    alpha = np.maximum(a, edge)
    return rgb, alpha


# =====================================================================
# The parts
# =====================================================================
def pan(name):
    """the tray: five rings (its foot, its rim's outside, its rim's inside, its floor inside) closed into one solid; ladders across its
    floor and its foot (never a fan)"""
    bm = bmesh.new()
    rings = [
        rrect(0.44, 0.30, 0.05, 0.0),        # its foot
        rrect(0.462, 0.322, 0.062, 0.066),   # up its sloping outside to under the lip
        rrect(0.46, 0.32, 0.06, 0.07),       # the lip's top, out
        rrect(0.447, 0.307, 0.054, 0.07),    # the lip's top, in
        rrect(0.432, 0.292, 0.046, 0.007),   # down its inside to its floor
    ]
    vs = [[bm.verts.new(P(*p)) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    ladder_fill(bm, vs[-1])
    ladder_fill(bm, list(reversed(vs[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, smooth_shade=True, sharp_deg=50)


def rack(name):
    """the rack: one square over the floor, its wires its picture"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    hx, hz = RACK_L / 2, RACK_W / 2
    vs = [bm.verts.new(P(x, RACK_Y, z)) for (x, z) in ((-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if f.normal.z < 0:
        f.normal_flip()
    return mesh_obj(name, bm, smooth_shade=False)


def tong_arm(name, s, hinge_loop):
    """one arm of the tongs: a strip on edge (1.3 cm high, 4 mm thick) along a path out from the hinge, bowed out and in again, its last
    stretch the grip, broader (2 cm high) and turned in toward the other's; `s`: which side (z) it's on. With `hinge_loop`, the sprung loop
    round the hinge (a flattened ring of 8) too"""
    bm = bmesh.new()
    path = [(0.0, 0.004), (0.07, 0.017), (0.2, 0.026), (0.33, 0.022), (0.37, 0.014), (0.42, 0.010)]
    high = [0.013, 0.013, 0.013, 0.014, 0.02, 0.02]
    T = 0.002
    rings = []
    for k, (x, z) in enumerate(path):
        # (the way the strip runs here, and across it, flat)
        a = path[max(0, k - 1)]
        b = path[min(len(path) - 1, k + 1)]
        dx, dz = b[0] - a[0], (b[1] - a[1]) * s
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L, dx / L
        y0, y1 = 0.003, 0.003 + high[k]
        zc = z * s
        rings.append([bm.verts.new(P(x + nx * o, y, zc + nz * o)) for (o, y) in ((-T, y0), (T, y0), (T, y1), (-T, y1))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    if hinge_loop:
        # (the loop: a flattened ring round the hinge, behind it, its two ends where the arms come in)
        R, cx = 0.016, -0.012
        lo = [bm.verts.new(P(cx + R * 0.8 * math.cos(math.radians(a)), 0.003, R * math.sin(math.radians(a)))) for a in range(0, 360, 45)]
        hi = [bm.verts.new(P(cx + R * 0.8 * math.cos(math.radians(a)), 0.016, R * math.sin(math.radians(a)))) for a in range(0, 360, 45)]
        lo_in = [bm.verts.new(P(cx + (R - 0.004) * 0.8 * math.cos(math.radians(a)), 0.003, (R - 0.004) * math.sin(math.radians(a)))) for a in range(0, 360, 45)]
        hi_in = [bm.verts.new(P(cx + (R - 0.004) * 0.8 * math.cos(math.radians(a)), 0.016, (R - 0.004) * math.sin(math.radians(a)))) for a in range(0, 360, 45)]
        m = len(lo)
        for k in range(m):
            j = (k + 1) % m
            bm.faces.new((lo[k], lo[j], hi[j], hi[k]))           # its outside
            bm.faces.new((hi_in[k], hi_in[j], lo_in[j], lo_in[k]))   # its inside
            bm.faces.new((hi[k], hi[j], hi_in[j], hi_in[k]))     # its top
            bm.faces.new((lo_in[k], lo_in[j], lo[j], lo[k]))     # its underside
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, smooth_shade=True, sharp_deg=40)


bpy.ops.wm.read_factory_settings(use_empty=True)
rack_rgb, rack_a = rack_picture()
M = {
    "steel": pbr("KakuSteel", (0.78, 0.8, 0.82), rough=0.3, metal=0.85),
    "rack": pbr("KakubatRack", (1, 1, 1), tex=image("kakubatrack", rack_rgb, alpha=rack_a), rough=0.35, metal=0.6, blend=True),
}
parts = []
tray = bpy.data.objects.new("KakubatTray", None)
bpy.context.collection.objects.link(tray)
for o, mat in ((pan("KakubatPan"), M["steel"]), (rack("KakubatRack"), M["rack"])):
    o.data.materials.append(mat)
    o.parent = tray
    parts.append(o)
tongs = bpy.data.objects.new("KakubatTongs", None)
bpy.context.collection.objects.link(tongs)
tongs.location = P(-0.2, 0, 0.45)
for k, s in enumerate((1, -1)):
    o = tong_arm(f"KakubatTong{k}", s, k == 0)
    o.data.materials.append(M["steel"])
    o.parent = tongs
    parts.append(o)
top = bpy.data.objects.new("Kakubat", None)
bpy.context.collection.objects.link(top)
tray.parent = top
tongs.parent = top
for o in parts:
    print(o.name, tris([o]))
if PREVIEW:
    target = P(0.0, 0.03, 0.1)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.5, 0.9, -0.9)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 40
    bpy.context.scene.camera = cam
    for nm, loc, energy in (("Key", P(-1.0, 2.0, -1.5), 5.0), ("Fill", P(1.5, 1.0, 1.0), 2.0)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = energy
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.38, 0.36)
    bpy.context.scene.world = world
export_dish(top, parts + [tray, tongs, top], os.path.join(PROJECT, "public", "models", "kakubat.glb"), os.path.join(PROJECT, "blender", "kakubat.blend"), PREVIEW)
print("KAKUBAT_DONE", tris(parts))
