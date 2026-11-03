"""The fish lantern by the door (the owner's, after their photograph of one: a round paper lantern with a fish lantern hung under it on a
short chain): one model, hung from the ring on its top (the origin, the ring's top; everything hangs below it, y down).

- "FishLanternTop": the round paper lantern (丸提灯), a little squat, its paper ("FishLanternTopPaper", lettered and lit by the game: u
  round it, reading left to right from the front, v from its top down) between two black-lacquered caps ("FishLanternLacquer"), an iron ring on top and a loop under it.
- "FishLanternChain": four iron links from that loop down to the fish's head.
- "FishLanternBody": the fish, hung head up: turned along its length, blunt-headed and full in the shoulder, narrowing to the root of its
  tail, a little flattened front to back. Its paper ("FishLanternPaper", painted and lit by the game: u round it, 0 at its right side,
  0.75 the middle of its front (+z), v from its head (0) to its tail (1)).
- "FishLanternFins": its fins, of the same lit paper but ribbed ("FishLanternFinPaper", the game's: u from the fin's root (0) to its edge
  (1), v across it): a pair of pectoral fins spread out and down from behind its head, a smaller pair at its belly and another under its
  tail, and its tail fanned out at the foot, all in the plane it faces, a little cupped.

Clean quads, few of them; the pictures are the game's. Run:
    blender -b --factory-startup --python blender/fishlantern.py -- <project path> [preview.png]
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

bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    """the game's frame (y up, z toward whoever looks at it) into Blender's (z up)"""
    return Vector((x, -z, y))


def mesh_obj(name, bm, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in o.data.polygons:
        f.use_smooth = smooth
    return o


def lathe(name, prof, segs, mat, flat=1.0, u0=0.0):
    """turned round the vertical: `prof` the (radius, height, v) points from one end to the other; `flat` squeezes it front to back; u round
    it the way that reads left to right from the front (+z): 0 at its right side (+x), 0.25 at its back, 0.5 its left, 0.75 the middle of
    its front; where an end's radius is 0, the ring beside it closed across in a ladder instead (not a fan into one point)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for r, y, _ in prof:
        ring = []
        for k in range(segs + 1):
            a = 2 * math.pi * k / segs
            ring.append(bm.verts.new(P(r * math.cos(a), y, flat * r * math.sin(a))) if (r > 1e-6 and k < segs) else (ring[0] if k == segs else None))
        rings.append(ring if r > 1e-6 else None)
    for j in range(len(prof) - 1):
        if rings[j] is None or rings[j + 1] is None:
            jj = j + 1 if rings[j] is None else j
            for f in ladder_fill(bm, rings[jj][:segs]):
                for lp in f.loops:
                    k = rings[jj].index(lp.vert)
                    lp[uvl].uv = (u0 + 1 - k / segs, prof[jj][2])
            continue
        for k in range(segs):
            a, b, c, d = rings[j][k], rings[j][k + 1], rings[j + 1][k + 1], rings[j + 1][k]
            vs = [a, b, c, d]
            uv = [(1 - k / segs, prof[j][2]), (1 - (k + 1) / segs, prof[j][2]), (1 - (k + 1) / segs, prof[j + 1][2]), (1 - k / segs, prof[j + 1][2])]
            keep = []
            for v, t in zip(vs, uv):
                if not keep or keep[-1][0] is not v:
                    keep.append((v, t))
            if keep[0][0] is keep[-1][0]:
                keep.pop()
            if len(keep) < 3:
                continue
            try:
                f = bm.faces.new([v for v, _ in keep])
            except ValueError:
                continue
            for lp, (_, t) in zip(f.loops, keep):
                lp[uvl].uv = (u0 + t[0], t[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm)
    o.data.materials.append(mat)
    return o


def torus(name, at, R, r, mat, turn=0.0, stretch=1.0, segs=12, sides=6):
    """a ring (a chain's link if stretched): its middle at `at`, upright, facing z, turned `turn` round the vertical"""
    bm = bmesh.new()
    vs = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        row = []
        for j in range(sides):
            b = 2 * math.pi * j / sides
            rr = R + r * math.cos(b)
            x, y, z = rr * math.cos(a), stretch * rr * math.sin(a), r * math.sin(b)
            # (upright in x-y, then turned round y)
            xx, zz = x * math.cos(turn) + z * math.sin(turn), -x * math.sin(turn) + z * math.cos(turn)
            row.append(bm.verts.new(P(at[0] + xx, at[1] + y, at[2] + zz)))
        vs.append(row)
    for i in range(segs):
        for j in range(sides):
            bm.faces.new((vs[i][j], vs[(i + 1) % segs][j], vs[(i + 1) % segs][(j + 1) % sides], vs[i][(j + 1) % sides]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm)
    o.data.materials.append(mat)
    return o


def cap(name, y0, y1, r, mat, segs=16):
    """a short lacquered cylinder between heights y0 and y1, closed"""
    bm = bmesh.new()
    bot = [bm.verts.new(P(r * math.cos(2 * math.pi * k / segs), y0, r * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    top = [bm.verts.new(P(r * math.cos(2 * math.pi * k / segs), y1, r * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
    for k in range(segs):
        bm.faces.new((bot[k], bot[(k + 1) % segs], top[(k + 1) % segs], top[k]))
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # (its edges eased a touch)
    o = mesh_obj(name, bm)
    o.data.materials.append(mat)
    bev = o.modifiers.new("ease", "BEVEL")
    bev.width = 0.003
    bev.segments = 2
    bev.limit_method = "ANGLE"
    return o


M = {
    "top": pbr("FishLanternTopPaper", (0.98, 0.95, 0.88), rough=0.8),
    "body": pbr("FishLanternPaper", (0.25, 0.32, 0.58), rough=0.8),
    "fin": pbr("FishLanternFinPaper", (0.3, 0.38, 0.62), rough=0.8),
    "lacquer": pbr("FishLanternLacquer", (0.05, 0.04, 0.035), rough=0.35, coat=0.6),
    "iron": pbr("FishLanternIron", (0.12, 0.11, 0.1), rough=0.5, metal=0.8),
}
parts = []

# =====================================================================
# The round lantern
# =====================================================================
A, B = 0.135, 0.125                     # (its belly's radius, its half height were it whole)
PHI = math.acos(0.062 / A)              # (where the caps take it)
YC = -0.05 - B * math.sin(PHI)          # (its middle: its paper's top just inside the top cap)
prof = []
N = 12
for i in range(N + 1):
    f = -PHI + 2 * PHI * i / N
    prof.append((A * math.cos(f), YC + B * math.sin(f), 1 - i / N))
parts.append(lathe("FishLanternTopPaper", prof, 20, M["top"]))
TOP_Y = YC + B * math.sin(PHI)
BOT_Y = YC - B * math.sin(PHI)
parts.append(cap("FishLanternCapTop", TOP_Y - 0.008, TOP_Y + 0.018, 0.066, M["lacquer"]))
parts.append(cap("FishLanternCapFoot", BOT_Y - 0.018, BOT_Y + 0.008, 0.066, M["lacquer"]))
parts.append(torus("FishLanternRing", (0, -0.016, 0), 0.013, 0.003, M["iron"]))
LOOP_Y = BOT_Y - 0.018 - 0.012
parts.append(torus("FishLanternLoop", (0, LOOP_Y, 0), 0.009, 0.0025, M["iron"]))

# =====================================================================
# The chain
# =====================================================================
LINK = 0.022
y = LOOP_Y - 0.009 - LINK / 2 + 0.004
for k in range(4):
    parts.append(torus(f"FishLanternLink{k}", (0, y, 0), 0.0075, 0.0022, M["iron"], turn=(math.pi / 2) * ((k + 1) % 2), stretch=1.5, segs=10, sides=5))
    y -= LINK - 0.004
HEAD_Y = y + LINK / 2 - 0.002

# =====================================================================
# The fish
# =====================================================================
L = 0.56
# (its radius down its length, t 0 its head's top to 1 the root of its tail: blunt, full in the shoulder, narrowing late)
RT = [(0.0, 0.0), (0.02, 0.026), (0.06, 0.047), (0.12, 0.063), (0.2, 0.076), (0.3, 0.085), (0.4, 0.086), (0.5, 0.081),
      (0.6, 0.072), (0.7, 0.059), (0.8, 0.044), (0.9, 0.031), (0.96, 0.026), (1.0, 0.024), (1.0001, 0.0)]
FLAT = 0.82


def r_at(t):
    for (t0, r0), (t1, r1) in zip(RT, RT[1:]):
        if t0 <= t <= t1:
            return r0 + (r1 - r0) * (t - t0) / max(1e-6, t1 - t0)
    return 0.0


def y_at(t):
    return HEAD_Y - L * t


prof = [(r, y_at(t), t) for t, r in RT]
parts.append(lathe("FishLanternBody", prof, 16, M["body"], flat=FLAT))
# (a little loop on its head the chain's last link holds)
parts.append(torus("FishLanternHeadLoop", (0, HEAD_Y + 0.004, 0), 0.006, 0.002, M["iron"], turn=math.pi / 2, segs=10, sides=5))


def fin(name_parts, t0, t1, reach, droop, spread, side, cup=0.012, nu=4, nv=5, scallop=0.0):
    """a fin on the fish's side (`side` 1 its right, +x; -1 its left), its root along its side from t0 to t1, reaching `reach` out from it,
    swept down by `droop` (radians from straight out), its edge `spread` times its root's length; cupped a little toward the front. u from its
    root (0) to its edge (1), v across it (0 at the root's head end)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = []
    for i in range(nu + 1):
        s = i / nu                      # (root to edge)
        row = []
        for j in range(nv + 1):
            v = j / nv                  # (across)
            t = t0 + (t1 - t0) * v
            rx, ry = side * (r_at(t) * 0.92), y_at(t)
            # (spread wider toward its edge, about its middle)
            mid = 0.5 + (v - 0.5) * (1 + (spread - 1) * s)
            tm = t0 + (t1 - t0) * mid
            ex = side * (r_at(t) * 0.92 + reach * s * math.cos(droop))
            ey = y_at(tm) - reach * s * math.sin(droop) * (0.6 + 0.4 * v)
            x = rx * (1 - s) + ex * s if s > 0 else rx
            yy = ry * (1 - s) + ey * s if s > 0 else ry
            z = cup * math.sin(math.pi * v) * s + 0.006 * s * s
            row.append(bm.verts.new(P(x, yy, z)))
        vs.append(row)
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (ii / nu, jj / nv)
    o = mesh_obj(name_parts, bm)
    o.data.materials.append(M["fin"])
    return o


fins = []
for sd in (1, -1):
    tag = "R" if sd > 0 else "L"
    fins.append(fin(f"FishLanternPectoral{tag}", 0.2, 0.32, 0.12, math.radians(38), 1.7, sd))
    fins.append(fin(f"FishLanternPelvic{tag}", 0.5, 0.59, 0.1, math.radians(48), 1.7, sd))
    fins.append(fin(f"FishLanternAnal{tag}", 0.71, 0.79, 0.085, math.radians(54), 1.6, sd))

# (the tail, fanned out at the foot: from the root of the tail spreading down and out, its edge a shallow curve out, as a fan's)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
nu, nv = 5, 6
TAIL = 0.17
root_y = y_at(0.965)
vs = []
for i in range(nu + 1):
    s = i / nu
    row = []
    for j in range(nv + 1):
        v = j / nv
        w = 0.024 + (0.115 - 0.024) * (s ** 0.8)
        x = (v - 0.5) * 2 * w
        # (the edge bowed out at its middle)
        bow = 0.025 * math.cos(math.pi * (v - 0.5)) * s
        yy = root_y - TAIL * s - bow
        z = 0.01 * math.sin(math.pi * v) * s
        row.append(bm.verts.new(P(x, yy, z)))
    vs.append(row)
for i in range(nu):
    for j in range(nv):
        f = bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
        for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
            lp[uvl].uv = (ii / nu, jj / nv)
tail = mesh_obj("FishLanternTail", bm)
tail.data.materials.append(M["fin"])
fins.append(tail)
# (the fins one mesh: one draw)
bpy.ops.object.select_all(action="DESELECT")
for o in fins:
    o.select_set(True)
bpy.context.view_layer.objects.active = fins[0]
bpy.ops.object.join()
fins_obj = bpy.context.view_layer.objects.active
fins_obj.name = "FishLanternFins"
parts.append(fins_obj)

# (the links, rings and loops one iron mesh; the caps one lacquer one)
def joined(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


iron = [o for o in parts if o.data.materials[0] is M["iron"]]
lac = [o for o in parts if o.data.materials[0] is M["lacquer"]]
for o in lac:
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="ease")
rest = [o for o in parts if o not in iron and o not in lac]
parts = rest + [joined("FishLanternChain", iron), joined("FishLanternCaps", lac)]

root = bpy.data.objects.new("FishLantern", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
tris = sum(len(o.data.polygons) * 2 for o in parts)
print("FishLantern parts", [o.name for o in parts], "about", tris, "tris")

if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.45, -0.55, 2.3)
    d = P(0, -0.56, 0) - cam.location
    world = bpy.data.worlds.new("W")
    world.color = (0.5, 0.5, 0.52)
    bpy.context.scene.world = world
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (0.6, 0.2, 0.4)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "fishlantern.glb"), os.path.join(PROJECT, "blender", "fishlantern.blend"), PREVIEW)
