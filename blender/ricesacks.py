"""The sacks of white rice (白米) by the sake barrels, for the rice balls (the owner's: the room-temperature stock wants rice, its sacks
piled by the sake; after two scanned burlap bags on Sketchfab, looked at only): ricesacks.glb, node "RiceSacks".

Three sacks: two unopened, sewn shut at both ends, lying one on the other; the third open, stood beside them (below). Each a pillow
of a shape: full and round in its middle, thin and flat toward its sewn edges, its corners pulled out into little ears where the seams
end. The cloth a coarse burlap, paler than the potatoes' (RiceSack: its weave here; the game prints 白米 and the rest on it, the print's
place the middle of each face's UVs). Some 600 triangles.

The game's frame (y up), the pile's foot's middle at the origin, its front toward +z.

Run:
    blender -b --factory-startup --python blender/ricesacks.py -- <project path> [preview.png]
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
rnd = random.Random(31)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# (burlap's coarse plain weave, as the potatoes' sacks (blender/produce.py), paler: a rice sack's fresher, cleaner jute; a little grime to
# the edges where it's been dragged)
S = 512
u, v = grid01(S)
f = 72
wob = (fbm(S, 4, 4) - 0.5) * 0.3
wx, wy = np.abs(np.sin(np.pi * (u * f + wob))), np.abs(np.sin(np.pi * (v * f + wob * 0.7)))
over = (np.floor(u * f + wob) + np.floor(v * f + wob * 0.7)) % 2
thread = np.where(over > 0, 0.3 + 0.7 * wx, 0.3 + 0.7 * wy)
tone = np.where(over > 0, vnoise(S, 3, f), vnoise(S, f, 3))
gaps = smooth(0.02, 0.32, np.minimum(wx, wy))
col = mix((0.62, 0.52, 0.36), (0.9, 0.82, 0.64), np.clip(thread * 0.55 + fbm(S, 6, 6) * 0.35 + (tone - 0.5) * 0.3, 0, 1))
col = mix(col, (0.3, 0.22, 0.13), smooth(0.66, 0.84, fbm(S, 20, 20)) * 0.2)
col *= (0.86 + 0.14 * gaps)[..., None]
edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
col *= (1 - smooth(0.12, 0.0, edge) * 0.25)[..., None]
M = {"sack": pbr("RiceSack", (1, 1, 1), tex=image("rice_burlap", np.clip(col, 0, 1)), rough=0.95)}
parts = []


def pillow(name, at, L, W, T, rot):
    """a sack lying as it's put down: L long (its sewn ends at either end), W wide, T thick at its middle; turned by `rot` (Euler, the game's
    frame) about its middle, then set at `at`. 9 x 7 points over each face, the two faces meeting at its rim"""
    NU, NV = 9, 7
    verts, faces, uvs = [], [], []
    ear = [rnd.uniform(0.01, 0.018) for _ in range(4)]
    for side in (1, -1):
        for i in range(NU):
            for j in range(NV):
                uu = -1 + 2 * i / (NU - 1)
                vv = -1 + 2 * j / (NV - 1)
                # (full in the middle, falling to nothing at the rim; the sewn ends gathered a little narrower)
                th = (T / 2) * max(0.0, 1 - abs(uu) ** 3.2) ** 0.55 * max(0.0, 1 - abs(vv) ** 2.6) ** 0.5
                x = uu * L / 2 * (1 - 0.06 * vv * vv)
                z = vv * W / 2 * (1 - 0.1 * uu ** 4)
                # (the corners pulled out into ears where the seams end)
                if abs(uu) > 0.99 and abs(vv) > 0.99:
                    k = (0 if uu > 0 else 1) + (0 if vv > 0 else 2)
                    x += math.copysign(ear[k], uu)
                    z += math.copysign(ear[k] * 0.6, vv)
                y = side * th * (1 + 0.04 * math.sin(3 * uu + 2 * vv + len(name)))
                verts.append(Vector((x, y, z)))
    for s, side in enumerate((1, -1)):
        o = s * NU * NV
        for i in range(NU - 1):
            for j in range(NV - 1):
                a, b, c, d = o + i * NV + j, o + (i + 1) * NV + j, o + (i + 1) * NV + j + 1, o + i * NV + j + 1
                faces.append((a, d, c, b) if side > 0 else (a, b, c, d))
                q = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)] if side > 0 else [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
                # (the underside's run the other way round, so what's printed on it reads true from its own side too)
                uvs.append([((ii if side > 0 else NU - 1 - ii) / (NU - 1), jj / (NV - 1)) for ii, jj in q])
    me = bpy.data.meshes.new(name)
    rot_m = Euler(rot, "XYZ").to_matrix()
    me.from_pydata([P(*(rot_m @ vv + Vector(at))) for vv in verts], [], faces)
    me.update()
    uvl = me.uv_layers.new().data
    for poly, fu in zip(me.polygons, uvs):
        for li, uv in zip(poly.loop_indices, fu):
            uvl[li].uv = uv
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(M["sack"])
    # (the two faces share their rim's points: welded, so it's closed and shades round its edge)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    parts.append(obj)
    return obj


L, W, T = 0.62, 0.4, 0.17
# (two lying, the upper one a little askew)
pillow("RiceSack0", (0.0, T * 0.42, 0.0), L, W, T, (0.0, 0.08, 0.0))
pillow("RiceSack1", (0.03, T * 1.2, -0.01), L * 0.97, W * 0.98, T * 0.95, (0.03, -0.12, 0.02))

# ---- the third, open (the owner's: one sack in use): stood on its bottom beside them, its mouth rolled down into a cuff, the white rice
# heaped in it, a wooden measure (升) pushed into the rice. Its cloth the same printed burlap (RiceSack; u up its height, v across its front,
# as a lying sack's u runs along its length: the print reads the same), the inside of the cloth and the cuff's underside plain (RiceSackInside),
# the rice (RiceGrain) and the measure (RiceMasu) their own.

# (the inside's burlap: the weave, darker, no print; the rice: grains on grains, a few broken, a soft shade; the measure: pale hinoki)
M["inside"] = pbr("RiceSackInside", (1, 1, 1), tex=image("rice_burlap_in", np.clip(col * 0.72, 0, 1)), rough=0.95)
S2 = 256
u2, v2 = grid01(S2)
gr = np.zeros((S2, S2), np.float32)
grng = np.random.default_rng(5)
for _ in range(1400):
    cx, cy, a = grng.random(), grng.random(), grng.uniform(0, math.pi)
    dx = (u2 - cx + 0.5) % 1.0 - 0.5
    dy = (v2 - cy + 0.5) % 1.0 - 0.5
    rx, ry = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
    gr = np.maximum(gr, np.clip(1 - (rx / 0.011) ** 2 - (ry / 0.006) ** 2, 0, 1) * grng.uniform(0.7, 1.0))
rice_col = mix((0.78, 0.76, 0.7), (0.99, 0.98, 0.95), gr)
M["rice"] = pbr("RiceGrain", (1, 1, 1), tex=image("rice_grains", np.clip(rice_col, 0, 1)), rough=0.7)
grain = 0.5 + 0.5 * np.sin((u2 * 40 + (fbm(S2, 2, 8) - 0.5) * 3) * math.pi)
M["masu"] = pbr("RiceMasu", (1, 1, 1), tex=image("rice_masu", mix((0.86, 0.74, 0.54), (0.78, 0.64, 0.44), smooth(0.6, 1.0, grain) * 0.5)), rough=0.6)

import bmesh  # noqa: E402

OA, OB, OH = 0.19, 0.13, 0.4     # (the open sack's half-width, half-depth, height to its rolled rim)
SEG = 24


def wob(k, y):
    """how far out the cloth stands at point k round it, at height y, against the plain shape (the owner's, 2026-11-11, after Sketchfab's
    "Burlap Bags", looked at only: a burlap sack, not a bucket): a touch out of round all the way up; the rice inside pressing it out in a
    couple of soft bulges low down; and the cloth bunched into folds up under the rolled mouth, deeper toward it"""
    a, t = 2 * math.pi * k / SEG, min(1.0, max(0.0, y / OH))
    out = 1 + 0.025 * math.sin(2 * a + 0.7) + 0.02 * math.sin(3 * a + 1.9)
    out += 0.022 * math.exp(-((t - 0.32) / 0.22) ** 2) * math.sin(4 * a + 2.2)
    rise = max(0.0, min(1.0, (t - 0.5) / 0.5))
    out += 0.032 * rise * rise * math.sin(7 * a + 1.3) * (0.65 + 0.35 * math.sin(3 * a + 0.4))
    return out


def ring(sx, y, inset=0.0, at=None):
    """a rounded-square ring round y (a superellipse: a full sack's corners), `sx` its size against the sack's own (a number, or one for
    each point round it), its cloth's own unevenness (wob) as at height `at` (y's own if not given)"""
    pts = []
    for k in range(SEG):
        t = 2 * math.pi * k / SEG
        c, s = math.cos(t), math.sin(t)
        e = 2 / 3.0
        sk = (sx[k] if isinstance(sx, list) else sx) * wob(k, y if at is None else at)
        x = math.copysign(abs(c) ** e, c) * (OA * sk - inset)
        z = math.copysign(abs(s) ** e, s) * (OB * sk - inset)
        pts.append((x, y[k] if isinstance(y, list) else y, z))
    return pts


def tube(name, rings, mat, uvmap):
    """rings joined into a sleeve of quads; `uvmap(k, i)` gives each point's UV (k round it, i up the rings)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = [[bm.verts.new(P(*p)) for p in r] for r in rings]
    for i in range(len(vs) - 1):
        for k in range(SEG):
            k2 = (k + 1) % SEG
            f = bm.faces.new((vs[i][k], vs[i][k2], vs[i + 1][k2], vs[i + 1][k]))
            for lp, (kk, ii) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                lp[uvl].uv = uvmap(kk, ii)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


# (its body: the foot spread a little where it sits, full in the middle, drawing in a touch to the rim; up its height u, round its front v:
# the front half's v 0..1 one way, the back half's back again, so the print stands on its front and its back)
# (the mouth's edge up here and down there round it: the body's top, the cuff and the inside all meet along it)
lip = [0.008 * math.sin(2 * 2 * math.pi * k / SEG + 0.5) + 0.005 * math.sin(5 * 2 * math.pi * k / SEG + 2.6) for k in range(SEG)]
# (sagging at its foot under the rice's weight, drawn in a little under the rolled mouth)
body = [(0.95, 0.0), (1.04, 0.02), (1.1, 0.07), (1.11, 0.14), (1.08, 0.22), (1.03, 0.3), (0.99, 0.36), (1.0, OH)]
across = lambda k: 1 - abs(((k / SEG) % 1.0) * 2 - 1)  # noqa: E731
tube("RiceSackOpen", [ring(s_, [OH + lip[k] for k in range(SEG)] if y == OH else y, at=y) for s_, y in body], "sack", lambda k, i: (across(k), 1 - body[i][1] / OH))
# (the mouth rolled down outward: over the rim and down in a cuff; under it and the inside of the cloth plain burlap, down to the rice)
# (rolled unevenly, as a worn sack's is: thick in one place and thin in another, its edge up here and down there, hanging lower at the side)
CUFF = [(1.0, 0.0), (1.05, 0.022), (1.11, 0.012), (1.13, -0.03), (1.1, -0.05), (1.06, -0.04)]
thick = [1 + 0.5 * math.sin(3 * 2 * math.pi * k / SEG + 0.4) + 0.25 * math.sin(5 * 2 * math.pi * k / SEG + 2.0) for k in range(SEG)]
droop = [0.6 + 0.8 * (0.5 + 0.5 * math.sin(2 * 2 * math.pi * k / SEG + 1.1)) for k in range(SEG)]
cuff = [([1 + (s_ - 1) * thick[k] for k in range(SEG)], [OH + lip[k] + dy * (droop[k] if dy < 0 else 1) for k in range(SEG)]) for s_, dy in CUFF]
tube("RiceSackCuff", [ring(s_, y, at=OH) for s_, y in cuff], "inside", lambda k, i: (k / SEG * 3, i / 5))
RICE_Y = OH - 0.05
inner = [(1.0, [OH + lip[k] for k in range(SEG)]), (0.97, OH - 0.02), (0.96, RICE_Y - 0.02)]
tube("RiceSackIn", [ring(s_, y, at=OH) for s_, y in inner], "inside", lambda k, i: (k / SEG * 3, i / 2))
# (the rice: heaped a little to the middle, its rim tucked under the cloth; closed across in a ladder, no fan to its middle)
rice_rings = [ring(0.965, RICE_Y - 0.01, at=OH), ring(0.75, RICE_Y + 0.012, at=OH), ring(0.45, RICE_Y + 0.024, at=OH)]
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
vs = [[bm.verts.new(P(*p)) for p in r] for r in rice_rings]
for i in range(len(vs) - 1):
    for k in range(SEG):
        k2 = (k + 1) % SEG
        bm.faces.new((vs[i][k], vs[i][k2], vs[i + 1][k2], vs[i + 1][k]))
ladder_fill(bm, vs[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    if f.normal.z < 0:
        f.normal_flip()
    for lp in f.loops:
        lp[uvl].uv = (lp.vert.co.x * 4 + 0.5, lp.vert.co.y * 4 + 0.5)
me = bpy.data.meshes.new("RiceSackRice")
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
rice = bpy.data.objects.new("RiceSackRice", me)
bpy.context.collection.objects.link(rice)
rice.data.materials.append(M["rice"])
parts.append(rice)
# (the measure: an open hinoki box, 8 cm, pushed into the rice at a tilt, full of rice)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
mw, mh, wall = 0.045, 0.07, 0.006
outer = [(-mw, -mw), (mw, -mw), (mw, mw), (-mw, mw)]
inner_ = [(-mw + wall, -mw + wall), (mw - wall, -mw + wall), (mw - wall, mw - wall), (-mw + wall, mw - wall)]
ob = [bm.verts.new((x, z, 0)) for x, z in outer]
ot = [bm.verts.new((x, z, mh)) for x, z in outer]
it = [bm.verts.new((x, z, mh)) for x, z in inner_]
ib = [bm.verts.new((x, z, mh - 0.02)) for x, z in inner_]
for k in range(4):
    k2 = (k + 1) % 4
    for q in ((ob[k], ob[k2], ot[k2], ot[k]), (ot[k], ot[k2], it[k2], it[k]), (it[k], it[k2], ib[k2], ib[k])):
        f = bm.faces.new(q)
        for lp in f.loops:
            lp[uvl].uv = (lp.vert.co.x * 8 + lp.vert.co.y * 8 + 0.5, lp.vert.co.z * 8)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("RiceMasu")
bm.to_mesh(me)
bm.free()
masu = bpy.data.objects.new("RiceMasu", me)
bpy.context.collection.objects.link(masu)
masu.data.materials.append(M["masu"])
parts.append(masu)
# (the rice heaped in it: a quad at its rim's height)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
f = bm.faces.new([bm.verts.new((x, z, mh - 0.008)) for x, z in inner_])
for lp in f.loops:
    lp[uvl].uv = (lp.vert.co.x * 4 + 0.5, lp.vert.co.y * 4 + 0.5)
me = bpy.data.meshes.new("RiceMasuRice")
bm.to_mesh(me)
bm.free()
masu_rice = bpy.data.objects.new("RiceMasuRice", me)
bpy.context.collection.objects.link(masu_rice)
masu_rice.data.materials.append(M["rice"])
masu_rice.parent = masu
parts.append(masu_rice)
masu.location = P(0.05, RICE_Y - 0.008, 0.02)
masu.rotation_euler = (math.radians(14), math.radians(-10), math.radians(25))
# (the open sack's pieces as one group, stood beside the lying pair)
opened = bpy.data.objects.new("RiceSackOpenSet", None)
bpy.context.collection.objects.link(opened)
for o in (bpy.data.objects["RiceSackOpen"], bpy.data.objects["RiceSackCuff"], bpy.data.objects["RiceSackIn"], rice, masu):
    o.parent = opened
opened.location = P(L / 2 + 0.25, 0.0, 0.03)
opened.rotation_euler = (0, 0, math.radians(-8))
parts.append(opened)

root = bpy.data.objects.new("RiceSacks", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
print("RICE_TRIS", sum(len(p.vertices) - 2 for o in parts if o.type == "MESH" for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.15, 0.2, 0)
    cam.location = P(0.9, 1.0, 1.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "ricesacks.glb"), os.path.join(PROJECT, "blender", "ricesacks.blend"), PREVIEW)
print("RICE_DONE")
