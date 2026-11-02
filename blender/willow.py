"""A weeping willow (柳) in a tall glazed pot, by the sake barrels in the front corner (the owner's: its quality up, its faces not too many;
it was a pot, a stick, fourteen tubes and 140 little cones, 2,128 triangles): willow.glb, node "Willow".

The pot turned on 16 sides, its glaze a celadon green-grey run pale down from the rim in drips, its foot unglazed clay; dark soil in it. A
slender trunk with an easy S in it (6 sides), six branches arching out from its top and over (4 sides). From the branches hang the willow's
long twigs: each a pair of crossed strips (so it has body from any side), painted with a thin twig and its narrow leaves alternating down
it, cut out by their alpha (WillowLeaves: the game draws it double-sided, alpha-tested, no ink line). Some 1,300 triangles.

Materials: WillowPot, WillowSoil, WillowBark, WillowLeaves.

The game's frame (y up), the pot's foot's middle at the origin.

Run:
    blender -b --factory-startup --python blender/willow.py -- <project path> [preview.png]
"""
import math
import os
import random
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
rnd = random.Random(23)
npr = np.random.default_rng(23)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


# =====================================================================
# Pictures
# =====================================================================
# (the glaze: a deep celadon grey-green, mottled; from the rim a paler glaze run down in drips of different lengths; the foot bare clay)
S = 256
gu, gv = grid01(S)            # (u round the pot, v up it: row 0 at the foot)
base = mix((0.22, 0.3, 0.26), (0.3, 0.38, 0.32), fbm(S, 5, 9, 4))
drip_len = np.array([0.18 + 0.32 * rnd.random() ** 2 for _ in range(S)], np.float32)
drip_len = np.convolve(np.concatenate([drip_len[-4:], drip_len, drip_len[:4]]), np.ones(5) / 5, mode="same")[4:-4]
run = smooth(0.0, 0.06, gv - (1 - drip_len[None, :]))           # (1 from where each drip reaches up to the rim)
glaze = mix(base, (0.5, 0.58, 0.5), run * 0.8)
glaze = mix(glaze, (0.18, 0.24, 0.2), smooth(0.02, 0.0, np.abs(gv - (1 - drip_len[None, :]))) * 0.5)   # (a darker bead where a drip ends)
glaze = mix(glaze, (0.56, 0.43, 0.31), smooth(0.06, 0.03, gv))   # (the foot's bare clay)
glaze = np.clip(glaze * (0.94 + 0.12 * fbm(S, 40, 40, 2)[..., None]), 0, 1)
pot_tex = image("WillowPotGlaze", glaze)

# (the bark: grey-brown, furrowed along the trunk, a few pale lenticels)
bu, bv = grid01(S)
furrow = np.abs(np.sin((bu * 9 + fbm(S, 3, 12, 3) * 1.4) * math.pi))
bark = mix((0.3, 0.25, 0.19), (0.46, 0.4, 0.31), smooth(0.25, 0.9, furrow) * (0.7 + 0.3 * fbm(S, 6, 30, 3)))
bark = mix(bark, (0.62, 0.58, 0.48), (fbm(S, 60, 20, 2) > 0.8).astype(np.float32) * 0.35)
bark_tex = image("WillowBarkPic", bark)

# (a hanging twig: a thin olive twig down the middle, swaying a little, and its narrow leaves on short stalks, alternating side to side, each
# pointing down and out, in a few greens with a paler midrib; transparent between. 128 across, 1024 down: the strip's top at the top)
LW, LH = 128, 1024
rgb = np.zeros((LH, LW, 3), np.float32)
alpha = np.zeros((LH, LW), np.float32)
yy, xx = np.mgrid[0:LH, 0:LW].astype(np.float32)
sway = lambda y: LW / 2 + 5 * math.sin(y / LH * math.pi * 3.0)
twig = np.abs(xx - np.array([sway(y) for y in range(LH)], np.float32)[:, None]) < 1.6 + 0.8 * (1 - yy / LH)
rgb[twig] = (0.42, 0.4, 0.22)
alpha[twig] = 1
GREENS = [(0.42, 0.58, 0.22), (0.5, 0.66, 0.27), (0.36, 0.52, 0.2), (0.56, 0.7, 0.32), (0.46, 0.6, 0.24)]
y = 18.0
side = 1
while y < LH - 40:
    L = 66 + 30 * rnd.random() * (0.6 + 0.4 * y / LH)          # (a little longer toward the tip, as willow's are)
    Wd = 7.5 + 3 * rnd.random()
    ang = math.radians(28 + 16 * rnd.random())                  # (off the twig, down and out)
    cx0 = sway(y)
    dx, dy = math.sin(ang) * side, math.cos(ang)
    cx, cy = cx0 + dx * (L / 2 + 3), y + dy * (L / 2 + 3)
    # (the leaf: a long ellipse pointed at both ends, in its own frame along (dx, dy))
    lx = (xx - cx) * dx + (yy - cy) * dy
    ly = -(xx - cx) * dy + (yy - cy) * dx
    t = np.clip(1 - (2 * lx / L) ** 2, 0, 1)
    inside = np.abs(ly) < (Wd / 2) * t ** 0.8
    g = np.array(GREENS[rnd.randrange(len(GREENS))], np.float32) * (0.9 + 0.2 * rnd.random())
    shade = 0.82 + 0.18 * (ly / (Wd / 2 + 1e-3) * side > 0)        # (one half a shade darker, as the leaf's fold catches the light)
    col = g[None, None, :] * np.where(inside, shade, 1)[..., None]
    rib = inside & (np.abs(ly) < 0.7)
    rgb[inside] = col[inside]
    rgb[rib] = np.clip(g * 1.25, 0, 1)
    alpha[inside] = 1
    # (its little stalk to the twig)
    st = (np.abs(-(xx - cx0) * dy + (yy - y) * dx) < 0.9) & (((xx - cx0) * dx + (yy - y) * dy) > 0) & (((xx - cx0) * dx + (yy - y) * dy) < 5)
    rgb[st] = (0.4, 0.42, 0.2)
    alpha[st] = 1
    y += 19 + 10 * rnd.random()
    side = -side
leaves_tex = image("WillowLeafStrip", rgb[::-1], alpha=alpha[::-1])   # (Blender's rows go up from the bottom)

M = {
    "pot": pbr("WillowPot", (1, 1, 1), tex=pot_tex, rough=0.3),
    "soil": pbr("WillowSoil", (0.24, 0.16, 0.1), rough=0.9),
    "bark": pbr("WillowBark", (1, 1, 1), tex=bark_tex, rough=0.85),
    "leaves": pbr("WillowLeaves", (1, 1, 1), tex=leaves_tex, rough=0.6, blend=True),
}
parts = []


def mesh_from(name, verts, faces, uvs, mat, smooth_shade=True):
    """a mesh in the game's frame: its vertices (game coords), faces, and each face's loops' UVs"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([P(*v) for v in verts], [], faces)
    me.update()
    uvl = me.uv_layers.new().data
    for poly, fu in zip(me.polygons, uvs):
        for li, uv in zip(poly.loop_indices, fu):
            uvl[li].uv = uv
        poly.use_smooth = smooth_shade
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


# =====================================================================
# The pot: turned from its profile on 16 sides, the soil's disc in it
# =====================================================================
SEG = 16
PROFILE = [(0.094, 0.0), (0.1, 0.012), (0.112, 0.12), (0.124, 0.25), (0.13, 0.312), (0.137, 0.332), (0.138, 0.342),
           (0.127, 0.344), (0.122, 0.33), (0.12, 0.31)]
SOIL_Y = 0.31
verts, faces, uvs = [], [], []
n = len(PROFILE)
lens = [0.0]
for i in range(1, n):
    lens.append(lens[-1] + math.dist(PROFILE[i - 1], PROFILE[i]))
for i, (r, h) in enumerate(PROFILE):
    for k in range(SEG + 1):
        a = 2 * math.pi * k / SEG
        verts.append((r * math.cos(a), h, r * math.sin(a)))
for i in range(n - 1):
    for k in range(SEG):
        a0, a1 = i * (SEG + 1) + k, (i + 1) * (SEG + 1) + k
        faces.append((a0, a1, a1 + 1, a0 + 1))
        v0, v1 = lens[i] / lens[-1], lens[i + 1] / lens[-1]
        uvs.append([(k / SEG, v0), (k / SEG, v1), ((k + 1) / SEG, v1), ((k + 1) / SEG, v0)])
# (the foot closed by its own ring, laddered on export (never a fan into the middle): its UVs on the bare clay at the glaze's foot)
faces.append(tuple(range(SEG)))
uvs.append([(k / SEG, 0.01) for k in range(SEG)])
pot = mesh_from("WillowPotBody", verts, faces, uvs, M["pot"])
parts.append(pot)
# (the soil: a disc at the soil's level inside the rim, a ladder across it)
sv = [(0.12 * math.cos(2 * math.pi * k / SEG), SOIL_Y, 0.12 * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]
soil = mesh_from("WillowSoilTop", sv, [tuple(reversed(range(SEG)))], [[(0.5, 0.5)] * SEG], M["soil"], smooth_shade=False)
parts.append(soil)


# =====================================================================
# The trunk and the branches: tubes along curves
# =====================================================================
def tube(name, pts, r0, r1, sides, mat):
    """a tube along `pts` (game coords), its radius r0 at the start to r1 at the end, `sides` round, its far end left open (hidden in the
    leaves), its near end in the pot or the trunk"""
    verts, faces, uvs = [], [], []
    m = len(pts)
    for i, p in enumerate(pts):
        a = Vector(pts[max(0, i - 1)]); b = Vector(pts[min(m - 1, i + 1)])
        t = (b - a).normalized()
        u = t.cross(Vector((0, 1, 0)))
        if u.length < 1e-4:
            u = t.cross(Vector((1, 0, 0)))
        u.normalize()
        w = t.cross(u).normalized()
        r = r0 + (r1 - r0) * i / (m - 1)
        for k in range(sides + 1):
            ang = 2 * math.pi * k / sides
            q = Vector(p) + (u * math.cos(ang) + w * math.sin(ang)) * r
            verts.append(tuple(q))
    for i in range(m - 1):
        for k in range(sides):
            a0, a1 = i * (sides + 1) + k, (i + 1) * (sides + 1) + k
            faces.append((a0, a0 + 1, a1 + 1, a1))
            uvs.append([(k / sides, i / (m - 1) * 3), ((k + 1) / sides, i / (m - 1) * 3), ((k + 1) / sides, (i + 1) / (m - 1) * 3), (k / sides, (i + 1) / (m - 1) * 3)])
    return mesh_from(name, verts, faces, uvs, mat)


TOP = Vector((0.004, 1.06, -0.004))
trunk_pts = [(0.0, 0.29, 0.0), (0.014, 0.48, 0.006), (-0.01, 0.7, -0.002), (0.012, 0.9, -0.01), tuple(TOP)]
parts.append(tube("WillowTrunk", trunk_pts, 0.024, 0.012, 6, M["bark"]))
hang = []   # (where twigs hang from: (point, outward direction))
for b in range(6):
    a = b / 6 * 2 * math.pi + rnd.uniform(-0.25, 0.25)
    d = Vector((math.cos(a), 0, math.sin(a)))
    reach = rnd.uniform(0.17, 0.27)
    start = TOP + Vector((0, rnd.uniform(-0.05, 0.03), 0))
    ctrl = [start, start + d * reach * 0.45 + Vector((0, 0.07, 0)), start + d * reach * 0.85 + Vector((0, 0.06, 0)),
            start + d * reach * 1.1 + Vector((0, 0.0, 0)), start + d * reach * 1.25 + Vector((0, -0.08, 0))]
    # (a smooth arch through those: a Catmull-Rom curve, 9 points)
    pts = []
    for i in range(9):
        f = i / 8 * (len(ctrl) - 1)
        k = min(int(f), len(ctrl) - 2)
        t = f - k
        p0, p1, p2, p3 = ctrl[max(0, k - 1)], ctrl[k], ctrl[k + 1], ctrl[min(len(ctrl) - 1, k + 2)]
        pts.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    parts.append(tube(f"WillowBranch{b}", [tuple(p) for p in pts], 0.007, 0.003, 4, M["bark"]))
    for f in (0.3, 0.5, 0.68, 0.84, 1.0):
        # (along its outer part, and its tip)
        i = f * (len(pts) - 1)
        p = pts[int(i)].lerp(pts[min(len(pts) - 1, int(i) + 1)], i - int(i))
        hang.append((p, d))
    # (a twig or two from the trunk's top between the branches)
    if b % 2 == 0:
        hang.append((TOP + d.copy() * 0.05 + Vector((0, 0.02, 0)), d))


# =====================================================================
# The hanging twigs: each two strips crossed, falling from where it hangs, curving out a little and swaying
# =====================================================================
leaf_parts = []
SEGS = 6
for j, (p, d) in enumerate(hang):
    # (those nearer the trunk shorter, filling the crown; the outer ones falling furthest)
    length = rnd.uniform(0.3, 0.5) if (p - TOP).length < 0.14 else rnd.uniform(0.45, 0.8)
    width = rnd.uniform(0.06, 0.075)
    out = rnd.uniform(0.03, 0.08)
    turn = rnd.uniform(-0.6, 0.6)
    dd = Vector((d.x * math.cos(turn) - d.z * math.sin(turn), 0, d.x * math.sin(turn) + d.z * math.cos(turn)))
    side = Vector((-dd.z, 0, dd.x))
    path = [p + dd * (out * math.sin(i / SEGS * math.pi * 0.6)) + Vector((0, -length * i / SEGS, 0)) + side * (0.015 * math.sin(i / SEGS * math.pi * 1.5 + j))
            for i in range(SEGS + 1)]
    for c, across in enumerate((side, dd)):
        verts, faces, uvs = [], [], []
        for i, q in enumerate(path):
            verts += [tuple(q - across * width / 2), tuple(q + across * width / 2)]
        for i in range(SEGS):
            a0 = i * 2
            faces.append((a0, a0 + 1, a0 + 3, a0 + 2))
            uvs.append([(0, 1 - i / SEGS), (1, 1 - i / SEGS), (1, 1 - (i + 1) / SEGS), (0, 1 - (i + 1) / SEGS)])
        leaf_parts.append(mesh_from(f"WillowTwig{j}_{c}", verts, faces, uvs, M["leaves"]))
leaves = join(leaf_parts, "WillowLeaves")
parts.append(leaves)

root = bpy.data.objects.new("Willow", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("WILLOW_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0, 0.7, 0)
    cam.location = P(1.4, 1.1, 1.9)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.5)
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "willow.glb"), os.path.join(PROJECT, "blender", "willow.blend"), PREVIEW)
print("WILLOW_DONE")
