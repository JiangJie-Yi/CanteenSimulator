"""A samurai helmet (兜) on its red lacquer stand, set out on the shoe cupboard (the owner's: after the Sketchfab "Samurai Helm / Kabuto
(Low-poly)", looked at only): a ribbed bowl of black lacquered iron, gold rivets down its ribs; a gold plate down its brow and a gold band
round it, a gold peak (眉庇) over the face; a pair of flat gold horns (鍬形) sweeping up and out, a gold crescent (前立) between them; the
turned-back wings (吹返) at its sides, gold, studded in rows; the neck guard (錣) of four lames flaring out round the back, laced; a dark
lacquered half mask (面頬) under the peak, its nose and mouth; an orange cord tied under it; on a stand of red lacquer, a post on a cross.

Every part a sheet of even quads (the owner's: 佈線均勻), about as wide as they're tall, given a little thickness; the ribs, rivets, studs,
lacing and the gold's engraving painted on, not modelled. About 2,000 triangles in all.

Writes public/models/kabuto.glb and blender/kabuto.blend. Its root is the node "Kabuto", the stand's foot at y = 0, facing -z (three's frame).

Run:
    blender -b --factory-startup --python blender/kabuto.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
seed(5)


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# =====================================================================
# Pictures
# =====================================================================
def dots(u, v, nu, rows, r, jitter=0.0):
    """round studs: `nu` across, at the given v rows, radius r (in v units); 1 inside"""
    m = np.zeros_like(u)
    for vr in rows:
        du = (u * nu) % 1.0 - 0.5
        d = np.sqrt((du / nu) ** 2 + (v - vr) ** 2)
        m = np.maximum(m, smooth(r, r * 0.6, d))
    return m


# (the bowl: black lacquer, thirty-two ribs round it (a lit ridge, a dark groove), a gold rivet on each rib in four rows)
S = 512
u, v = grid01(S)
rib = np.abs(((u * 32) % 1.0) - 0.5) * 2
bowl = mix((0.035, 0.037, 0.05), (0.09, 0.095, 0.12), smooth(0.35, 0.0, rib))
bowl = mix(bowl, (0.012, 0.012, 0.018), smooth(0.8, 1.0, rib) * 0.8)
riv = np.zeros_like(u)
for vr in (0.18, 0.38, 0.58, 0.78):
    du = ((u * 32) % 1.0 - 0.5) / 32 * 2.6
    riv = np.maximum(riv, smooth(0.016, 0.009, np.sqrt(du ** 2 + (v - vr) ** 2 * 0.25)))
bowl = mix(bowl, (0.75, 0.55, 0.2), riv)
bowl *= (0.92 + 0.08 * fbm(S, 8, 8))[..., None]

# (the gold: worn bright where it stands proud, darker in the engraving: scrolls of tendrils over it, a beaded border at its edges)
G = 512
gu, gv = grid01(G)
# (fine engraved lines: tendrils curling over it, thin and low in contrast, the gold itself catching the light in soft patches)
scroll = np.abs(np.sin(gu * 2 * np.pi * 4 + np.sin(gv * 2 * np.pi * 4 + np.sin(gu * 2 * np.pi * 2) * 2) * 1.8))
gold = mix((0.62, 0.44, 0.13), (0.92, 0.74, 0.32), fbm(G, 4, 4))
gold = mix(gold, (0.32, 0.2, 0.06), smooth(0.07, 0.0, scroll) * 0.45)
edge = np.minimum(np.minimum(gu, 1 - gu), np.minimum(gv, 1 - gv))
gold *= (0.9 + 0.1 * fbm(G, 6, 6))[..., None]

# (the wings: gold plates with three columns of round studs down them and a dark rim)
wing = mix((0.62, 0.44, 0.12), (0.9, 0.7, 0.3), fbm(G, 5, 5))
for col in (0.3, 0.5, 0.7):
    for row in np.linspace(0.12, 0.88, 9):
        d = np.sqrt((gu - col) ** 2 + (gv - row) ** 2 * 0.6)
        wing = mix(wing, (0.35, 0.22, 0.06), smooth(0.05, 0.04, d))
        wing = mix(wing, (1.0, 0.85, 0.45), smooth(0.038, 0.02, d) * (gv > row - 0.03))
        wing = mix(wing, (0.8, 0.6, 0.22), smooth(0.038, 0.02, d) * (gv <= row - 0.03))
wing = mix(wing, (0.08, 0.06, 0.04), smooth(0.05, 0.03, edge))

# (the neck guard's lames: black lacquer laced in navy cords, columns of them down; along each lame's foot a row of small gold scales)
L = 512
lu, lv = grid01(L)
lace_col = np.abs(((lu * 28) % 1.0) - 0.5) * 2
lace = mix((0.03, 0.03, 0.04), (0.04, 0.07, 0.2), smooth(0.45, 0.2, lace_col))
lace = mix(lace, (0.07, 0.11, 0.26), smooth(0.25, 0.0, lace_col) * (0.6 + 0.4 * np.sin(lv * 2 * np.pi * 5)))
lace = mix(lace, (0.85, 0.64, 0.25), dots(lu, lv, 56, (0.12,), 0.06))
lace = mix(lace, (0.6, 0.45, 0.16), smooth(0.05, 0.0, lv) * 0.8)

# (the mask: dark red-brown lacquer, lighter on its cheeks and nose; the mouth's slot black, a line of teeth in it)
mask = mix((0.07, 0.03, 0.025), (0.2, 0.09, 0.06), smooth(0.6, 0.0, np.abs(gu - 0.5) * 2) * smooth(0.0, 0.6, gv))
mouth = (np.abs(gu - 0.5) < 0.16) * (np.abs(gv - 0.32) < 0.045)
mask = np.where(mouth[..., None], np.array([0.01, 0.005, 0.005], np.float32), mask)
teeth = (np.abs(gu - 0.5) < 0.13) * (np.abs(gv - 0.335) < 0.012) * ((gu * 30) % 1.0 > 0.15)
mask = np.where(teeth[..., None], np.array([0.85, 0.82, 0.72], np.float32), mask)

# (the cord: orange, twisted: diagonal strands)
cord = mix((0.75, 0.36, 0.08), (0.98, 0.62, 0.22), smooth(-0.2, 0.9, np.sin((gu * 3 + gv * 24) * 2 * np.pi)))

M = {
    "lacquer": pbr("KabutoLacquer", (1, 1, 1), tex=image("kabuto_bowl", np.clip(bowl, 0, 1)), rough=0.3, coat=0.5),
    "gold": pbr("KabutoGold", (1, 1, 1), tex=image("kabuto_gold", np.clip(gold, 0, 1)), rough=0.28, metal=1.0),
    "wing": pbr("KabutoWing", (1, 1, 1), tex=image("kabuto_wing", np.clip(wing, 0, 1)), rough=0.3, metal=1.0),
    "lace": pbr("KabutoLace", (1, 1, 1), tex=image("kabuto_lace", np.clip(lace, 0, 1)), rough=0.6),
    "mask": pbr("KabutoMask", (1, 1, 1), tex=image("kabuto_mask", np.clip(mask, 0, 1)), rough=0.35, coat=0.4),
    "cord": pbr("KabutoCord", (1, 1, 1), tex=image("kabuto_cord", np.clip(cord, 0, 1)), rough=0.8),
    "stand": pbr("KabutoStand", lin("#9a1e14"), rough=0.35, coat=0.4),
    "dark": pbr("KabutoInside", lin("#0a0a0c"), rough=0.6),
}
parts = []


def sheet(name, nu, nv, fn, mat, closed=False, thick=0.003, uv_scale=(1.0, 1.0)):
    """a sheet of nu x nv even quads through fn(s, t) (s, t in 0..1, three's frame), its UVs the same s, t; given `thick`"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    cols = nu if closed else nu + 1
    rows = [[bm.verts.new(P(*fn(i / nu, j / nv))) for i in range(cols)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            i2 = (i + 1) % cols
            f = bm.faces.new((rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (a / nu * uv_scale[0], b / nv * uv_scale[1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if thick:
        so = o.modifiers.new("t", "SOLIDIFY")
        so.thickness = thick
        so.offset = 0
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="t")
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def box(name, w, h, d, at, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*at))
    o = bpy.context.view_layer.objects.active
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.004; bv.segments = 1
    bpy.ops.object.modifier_apply(modifier="b")
    o.name = name
    o.data.materials.append(mat)
    parts.append(o)
    return o


# =====================================================================
# The helmet
# =====================================================================
B0 = 0.2          # (the bowl's rim, above the stand's foot)
R = 0.11          # (the bowl's radius at its rim; a tenth longer front to back)
DEEP = 1.1
HD = 0.095        # (the dome's height)
FRONT = -math.pi / 2   # (the face is toward -z: the angle round from +x)


def dome(t, a, out=0.0):
    """a point on the bowl: t 0 (the rim) .. 1 (the crown), a the angle round"""
    th = t * math.pi / 2
    r = (R + out) * math.cos(th)
    return (r * math.cos(a), B0 + (HD + out) * math.sin(th), r * math.sin(a) * DEEP)


# (the bowl: 24 round, six rings up to the crown's opening, which the gold tehen ring covers)
sheet("KabutoBowl", 24, 6, lambda s, t: dome(t * 0.9, s * 2 * math.pi), M["lacquer"], closed=True, thick=0.004)
# (inside it, seen under the peak: dark)
sheet("KabutoInside", 24, 2, lambda s, t: dome(t * 0.5, s * 2 * math.pi, -0.006), M["dark"], closed=True, thick=0)
# (the tehen: a gold ring at the crown, its top closed)
sheet("KabutoTehen", 12, 1, lambda s, t: ((0.024 - 0.006 * t) * math.cos(s * 2 * math.pi), B0 + HD - 0.004 + 0.01 * t, (0.024 - 0.006 * t) * math.sin(s * 2 * math.pi) * DEEP),
      M["gold"], closed=True, thick=0.003, uv_scale=(2, 0.3))
# (a gold band round the bowl's foot over the face, and a gold plate up its front from it)
sheet("KabutoBand", 14, 2, lambda s, t: dome(t * 0.18, FRONT + (s - 0.5) * 3.4, 0.003), M["gold"], thick=0.002, uv_scale=(6, 0.5))
sheet("KabutoPlate", 3, 6, lambda s, t: dome(0.15 + t * 0.72, FRONT + (s - 0.5) * 0.5 * (1 - 0.4 * t), 0.004), M["gold"], thick=0.002, uv_scale=(1, 2))
# (the peak over the face: sloping down and out from the band, gold)
sheet("KabutoPeak", 12, 1, lambda s, t: ((R + 0.004 + 0.026 * t) * math.cos(FRONT + (s - 0.5) * 2.7), B0 + 0.004 - 0.016 * t,
                                          (R + 0.004 + 0.026 * t) * math.sin(FRONT + (s - 0.5) * 2.7) * DEEP), M["gold"], thick=0.004, uv_scale=(5, 0.5))

# (the horns: flat gold blades from the band's front, out and up, then hooked out at their tips; each a strip of quads along its middle)
def horn(sd):
    pts = [(0.028, B0 + 0.02, -0.122), (0.05, B0 + 0.055, -0.128), (0.068, B0 + 0.095, -0.126), (0.08, B0 + 0.135, -0.12), (0.092, B0 + 0.165, -0.112),
           (0.112, B0 + 0.185, -0.104), (0.135, B0 + 0.192, -0.098)]
    wid = [0.016, 0.02, 0.022, 0.022, 0.02, 0.016, 0.008]

    def at(s, t):
        f = s * (len(pts) - 1)
        i = min(len(pts) - 2, int(f))
        k = f - i
        p = [pts[i][c] * (1 - k) + pts[i + 1][c] * k for c in range(3)]
        w = wid[i] * (1 - k) + wid[i + 1] * k
        # (across the blade: in its own plane, at right angles to its run in x-y)
        dx, dy = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        # (kept lower than drawn: from the shoe cupboard they reached the light switches on the wall over it)
        return (sd * (p[0] + nx * w * (t - 0.5)), B0 + (p[1] + ny * w * (t - 0.5) - B0) * 0.78, p[2])
    sheet(f"KabutoHorn{sd}", 10, 1, at, M["gold"], thick=0.003, uv_scale=(3.5, 0.4))


for sd in (-1, 1):
    horn(sd)
# (the crescent on the brow between them: a thin new moon, its horns up, on a short stem)
sheet("KabutoCrest", 12, 1, lambda s, t: ((0.032 - (0.002 + 0.009 * math.sin(s * math.pi)) * t) * math.cos(math.pi * (1.1 - 1.2 * s)),
                                           B0 + 0.06 - (0.032 - (0.002 + 0.009 * math.sin(s * math.pi)) * t) * math.sin(math.pi * (1.1 - 1.2 * s)),
                                           -R * DEEP - 0.012), M["gold"], thick=0.003, uv_scale=(2, 0.3))

# (the wings turned back at the peak's ends: gold plates standing out sideways, curling back, studded in rows)
def wingp(sd):
    def at(s, t):
        a = FRONT + sd * (1.7 + 0.25 * s)
        r = R + 0.01 + 0.06 * s
        y = B0 - 0.005 - 0.085 * t + 0.012 * s
        return (r * math.cos(a), y, r * math.sin(a) * DEEP - 0.012 * s * s)
    sheet(f"KabutoWing{sd}", 4, 4, at, M["wing"], thick=0.004)


for sd in (-1, 1):
    wingp(sd)

# (the neck guard: four lames, round from one cheek past the back to the other, each flaring out a little more and stepping down)
OPEN = 3.9   # (the angle the face is left open across: the lames end behind the wings)
for k in range(4):
    y0 = B0 - 0.006 - k * 0.022
    r0 = R + 0.004 + k * 0.024

    def lame(s, t, y0=y0, r0=r0):
        a = FRONT + OPEN / 2 + s * (2 * math.pi - OPEN)
        r = r0 + 0.03 * t
        return (r * math.cos(a), y0 - 0.026 * t, r * math.sin(a) * DEEP)
    sheet(f"KabutoShikoro{k}", 20, 1, lame, M["lace"], thick=0.004)

# (the mask under the peak: a half shell over the face, its chin drawn in, the nose standing out of it)
def maskp(s, t):
    a = FRONT + (s - 0.5) * 2.2
    y = B0 - 0.03 - 0.11 * t
    r = 0.08 * (1 - 0.35 * t * t)
    out = 0.02 * math.exp(-((s - 0.5) / 0.09) ** 2 - ((t - 0.25) / 0.16) ** 2)
    return ((r + out) * math.cos(a), y, (r + out) * math.sin(a) * DEEP - 0.01)


sheet("KabutoMask", 8, 6, maskp, M["mask"], thick=0.004)

# (the cord: from under the wings down round the chin, crossed and tied under it, its ends hanging)
def cordp(s, t):
    a = s * 2 * math.pi
    path = [(-0.075, B0 - 0.05, -0.04), (-0.06, B0 - 0.12, -0.07), (-0.02, B0 - 0.16, -0.095), (0.0, B0 - 0.17, -0.1), (0.02, B0 - 0.16, -0.095),
            (0.06, B0 - 0.12, -0.07), (0.075, B0 - 0.05, -0.04)]
    f = t * (len(path) - 1)
    i = min(len(path) - 2, int(f))
    k = f - i
    p = [path[i][c] * (1 - k) + path[i + 1][c] * k for c in range(3)]
    return (p[0] + 0.006 * math.cos(a), p[1] + 0.006 * math.sin(a), p[2])


sheet("KabutoCord", 6, 12, lambda s, t: cordp(s, t), M["cord"], closed=True, thick=0)
# (its knot and the two ends hanging from it)
# (not closed to a point at its ends (a pole of triangles): its ends left open where the cord runs into it)
sheet("KabutoKnot", 8, 4, lambda s, t: (0.016 * math.sin((0.15 + 0.7 * t) * math.pi) * math.cos(s * 2 * math.pi), B0 - 0.17 - 0.012 * math.cos((0.15 + 0.7 * t) * math.pi),
                                         -0.1 + 0.016 * math.sin((0.15 + 0.7 * t) * math.pi) * math.sin(s * 2 * math.pi) * 0.7 - 0.004), M["cord"], closed=True, thick=0)
for sd in (-1, 1):
    sheet(f"KabutoCordEnd{sd}", 6, 4, lambda s, t, sd=sd: (sd * (0.008 + 0.012 * t) + 0.005 * math.cos(s * 2 * math.pi), B0 - 0.18 - 0.05 * t,
                                                           -0.1 + 0.005 * math.sin(s * 2 * math.pi)), M["cord"], closed=True, thick=0)

# =====================================================================
# The stand: red lacquer, a post up into the bowl on two boards crossed
# =====================================================================
box("KabutoStandBoard0", 0.22, 0.03, 0.05, (0, 0.015, 0), M["stand"])
box("KabutoStandBoard1", 0.05, 0.03, 0.2, (0, 0.016, 0), M["stand"])
box("KabutoStandPost", 0.045, B0 + 0.02, 0.03, (0, (B0 + 0.02) / 2 + 0.03, 0), M["stand"])
box("KabutoStandArm", 0.14, 0.025, 0.03, (0, B0 - 0.04, 0), M["stand"])

root = bpy.data.objects.new("Kabuto", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    from mathutils import Vector
    cam.location = (0.3, 0.75, 0.4)
    cam.rotation_euler = (Vector((0, 0, 0.2)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((0.6, 1, 1.2), 200), ((-1, 0.4, 0.5), 80)):
        Lt = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        Lt.data.energy = e; Lt.data.size = 1
        Lt.location = loc
        Lt.rotation_euler = (Vector((0, 0, 0.2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(Lt)
    w = bpy.data.worlds.new("w"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.4, 0.4, 0.42, 1)
    bpy.context.scene.world = w
os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kabuto.glb"), os.path.join(PROJECT, "blender", "kabuto.blend"), PREVIEW)
print("KABUTO_DONE", len(parts), "parts", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts), "tris")
