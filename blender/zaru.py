"""The woven bamboo basket by the hearth the foil-roasted potatoes are served into (竹ざる): zaru.glb, node "Zaru".

A shallow round basket, 0.96 across and 0.145 deep (the game's units, as Roasting's BASKET_R): its bowl woven of thin split-bamboo strips in
a plain over-and-under weave running straight across it both ways (as a zaru is woven), each strip rounded (lit along its middle, shadowed
where it dips under the next), its own shade of the bamboo's skin, a dark gap between; a relief map gives the weave its depth. Its rim a
thick rolled hoop of bamboo bound round and round with a narrow strip of darker cane, wrapped on a slant.

The game's frame: y up, the basket's middle on y = 0 at the origin. Low in triangles: a lathe of 48 round, the hoop 48 by 10.

Run:
    blender -b --factory-startup --python blender/zaru.py -- <project path> [preview.png]
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
R = 0.48


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# =====================================================================
# The weave: strips both ways across the basket (u and v laid straight down onto it from above), 34 across it each way
# =====================================================================
def weave(N=1024, K=34):
    seed(23)
    u, v = grid01(N)
    # (turned a little off the square, as a basket lies)
    a = 0.12
    x = (u - 0.5) * math.cos(a) - (v - 0.5) * math.sin(a)
    y = (u - 0.5) * math.sin(a) + (v - 0.5) * math.cos(a)
    su, sv = (x + 0.5) * K, (y + 0.5) * K
    iu, iv = np.floor(su), np.floor(sv)
    fu, fv = su - iu, sv - iv
    # (each strip a little narrower than its lane: the dark gap between; rounded across)
    half = 0.43
    du, dv = np.abs(fu - 0.5), np.abs(fv - 0.5)
    on_u = du < half                     # (inside a strip running along v: the one lane across u)
    on_v = dv < half
    prof_u = np.sqrt(np.clip(1 - (du / half) ** 2, 0, 1))
    prof_v = np.sqrt(np.clip(1 - (dv / half) ** 2, 0, 1))
    # (over and under: at each crossing the strip along v is on top where the lanes' sum is even)
    over_u = ((iu + iv) % 2 == 0)
    # (each strip's own shade of the bamboo skin, the odd one showing its paler inside)
    def shade(idx, salt):
        h = np.sin(idx * 12.9898 + salt) * 43758.5453
        return h - np.floor(h)
    ru, rv = shade(iu, 1.3), shade(iv, 7.7)
    skin = np.array((0.78, 0.66, 0.42), np.float32)
    warm = np.array((0.72, 0.56, 0.32), np.float32)
    pale = np.array((0.88, 0.8, 0.6), np.float32)
    col_u = mix(mix(skin, warm, smooth(0.4, 1.0, ru)), pale, smooth(0.86, 0.97, ru))
    col_v = mix(mix(skin, warm, smooth(0.4, 1.0, rv)), pale, smooth(0.86, 0.97, rv))
    # (along each strip, fine fibres and a node now and then)
    fib_u = 0.92 + 0.08 * np.sin(sv * 40 + fbm(N, 4, 40, 2) * 3)
    fib_v = 0.92 + 0.08 * np.sin(su * 40 + fbm(N, 40, 4, 2) * 3)
    gap = np.array((0.18, 0.12, 0.07), np.float32)
    col = np.broadcast_to(gap, (N, N, 3)).copy()
    height = np.zeros((N, N), np.float32)
    # (where only one strip is: it; where both cross, the one on top, the one under shadowed at the top one's edges)
    only_u, only_v, both = on_u & ~on_v, on_v & ~on_u, on_u & on_v
    lit_u = col_u * (0.62 + 0.38 * prof_u)[..., None] * fib_u[..., None]
    lit_v = col_v * (0.62 + 0.38 * prof_v)[..., None] * fib_v[..., None]
    # (a strip dips as it goes under: darker toward the crossing)
    dip_u = 0.75 + 0.25 * smooth(0.0, 0.5, np.minimum(fv, 1 - fv))
    dip_v = 0.75 + 0.25 * smooth(0.0, 0.5, np.minimum(fu, 1 - fu))
    col[only_u] = (lit_u * dip_u[..., None])[only_u]
    col[only_v] = (lit_v * dip_v[..., None])[only_v]
    top_u = both & over_u
    top_v = both & ~over_u
    col[top_u] = lit_u[top_u]
    col[top_v] = lit_v[top_v]
    height[only_u] = (prof_u * 0.55 * dip_u)[only_u]
    height[only_v] = (prof_v * 0.55 * dip_v)[only_v]
    height[top_u] = (0.45 + prof_u * 0.55)[top_u]
    height[top_v] = (0.45 + prof_v * 0.55)[top_v]
    # (the middle, where hot potatoes have sat: oil and ash worked into it; the rim's edge rubbed paler by hands)
    r = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2
    col = mix(col, col * np.array((0.7, 0.6, 0.5), np.float32), smooth(0.55, 0.0, r) * 0.35 * fbm(N, 5, 5, 3))
    col = mix(col, col * np.float32(1.1), smooth(0.8, 1.0, r) * 0.4)
    return np.clip(col, 0, 1), height


def binding(W=512, H=128, turns=60):
    """the rim's binding: a narrow strip of dark cane wound on a slant round the hoop (u round the rim, v round the hoop)"""
    u, v = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)
    t = (u * turns + v * 1.0) % 1.0
    strip = np.sin(np.pi * np.clip((t - 0.06) / 0.82, 0, 1))
    cane = np.array((0.48, 0.33, 0.18), np.float32)
    col = mix(np.array((0.2, 0.13, 0.07), np.float32), cane, strip ** 0.6)
    col = col * (0.9 + 0.1 * np.sin(v * np.pi * 2 * 3 + u * 9))[..., None]
    return np.clip(col, 0, 1), strip


# =====================================================================
# The basket
# =====================================================================
def lathe(name, prof, segs):
    """a turned shape from the profile [(r, y)]: UVs laid straight down from above over the basket's width"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = [[bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) if r > 1e-6 else None
              for j in range(segs)] for (r, y) in prof]
    centres = {i: bm.verts.new(P(0, y, 0)) for i, (r, y) in enumerate(prof) if r <= 1e-6}
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            vs = [rings[i][j] or centres[i], rings[i][j2] or centres[i], rings[i + 1][j2] or centres[i + 1], rings[i + 1][j] or centres[i + 1]]
            uniq = []
            for vv in vs:
                if vv not in uniq:
                    uniq.append(vv)
            if len(uniq) < 3:
                continue
            f = bm.faces.new(uniq)
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl].uv = (co.x / (2 * R * 1.04) + 0.5, -co.y / (2 * R * 1.04) + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def hoop(name, radius, tube, y, segs=48, sides=10):
    """the rolled rim: a torus round the basket's lip, its UVs u round the rim and v round the tube"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    grid = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        c, out = P(radius * math.cos(a), y, radius * math.sin(a)), Vector((math.cos(a), -math.sin(a), 0))
        grid.append([bm.verts.new(c + out * (tube * math.cos(2 * math.pi * k / sides)) + Vector((0, 0, tube * 0.85 * math.sin(2 * math.pi * k / sides))))
                     for k in range(sides)])
    for i in range(segs):
        for k in range(sides):
            vs = (grid[i][k], grid[(i + 1) % segs][k], grid[(i + 1) % segs][(k + 1) % sides], grid[i][(k + 1) % sides])
            f = bm.faces.new(vs)
            for lp, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                lp[uvl].uv = (ii / segs, kk / sides)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


col, h = weave()
bcol, bh = binding()
M = {
    "weave": pbr("ZaruWeave", (1, 1, 1), tex=image("zaru_weave", col), nrm=image("zaru_weave_n", to_normal(h, 3.0), data=True), nrm_strength=1.0, rough=0.7),
    "rim": pbr("ZaruRim", (1, 1, 1), tex=image("zaru_rim", bcol), nrm=image("zaru_rim_n", to_normal(bh, 2.0), data=True), rough=0.6),
}
# (the bowl: its outside and its inside one surface with a thin wall between, the wall's top hidden under the hoop)
prof_out = [(0.0, 0.006), (R * 0.55, 0.008), (R * 0.82, 0.036), (R * 0.97, 0.096), (R * 1.0, 0.126)]
prof_in = [(R * 0.975, 0.126), (R * 0.95, 0.1), (R * 0.8, 0.044), (R * 0.53, 0.018), (0.0, 0.016)]
bowl = lathe("ZaruBowl", prof_out + prof_in, 48)
bowl.data.materials.append(M["weave"])
rim = hoop("ZaruRim", R * 0.99, 0.017, 0.132)
rim.data.materials.append(M["rim"])
root = bpy.data.objects.new("Zaru", None)
bpy.context.collection.objects.link(root)
for o in (bowl, rim):
    o.parent = root
print("ZARU_TRIS", sum(len(p.vertices) - 2 for o in (bowl, rim) for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0.05, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 1.1, 0.9)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 0.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.35, 0.33, 0.3)
    bpy.context.scene.world = world
export_dish(root, [bowl, rim, root], os.path.join(PROJECT, "public", "models", "zaru.glb"), os.path.join(PROJECT, "blender", "zaru.blend"), PREVIEW)
print("ZARU_DONE")
