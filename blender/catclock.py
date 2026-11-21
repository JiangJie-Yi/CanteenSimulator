"""The cat wall clock (catclock.glb; item 477, the owner's, 2026-11-21: 「這邊增加一個喵咪掛鐘」): our own, a calico cat sitting up, its
round belly the clock's case with the dial on it, its face over it, a red collar and a gold bell at its neck, its two front paws at the
case's foot, its tail hanging under it for the pendulum. Hung on the back wall right of the round window.

Nodes:
- "CatClockBody": all that stands still: the case, the dial, the head, the ears (one black, one ginger, pink inside), the collar, the bell,
  the paws, the cap over the hands' pivot. The head's front and the dial's are one material, "CatClockPrint": the game paints them in one
  picture (the face on its left half, the dial on its right: its ticks and numbers), as the drinks fridge's sign is painted.
- "CatClockHour", "CatClockMinute": the hands, each its pivot at its origin (the dial's middle), pointing up (+y) at twelve.
- "CatClockTail": the tail, its pivot at its root (its origin), hanging down: swung as the pendulum.

The frame: metres; y up; x across; z out of the wall, the clock's back flat at z = 0; the dial's middle at the origin of x and y.
Low-poly (docs/MODELING.md): every round at most 24 sides, every cap a ladder, about 520 triangles all told.

Run:
    blender -b --factory-startup --python blender/catclock.py -- <project path> [preview.png]
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
    """the game's frame (y up, z out of the wall) to Blender's (z up)"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {
    "white": pbr("CatClockWhite", lin("#f7f2e8"), rough=0.6),
    "print": pbr("CatClockPrint", (1, 1, 1), rough=0.6),
    "black": pbr("CatClockBlack", lin("#2e2826"), rough=0.6),
    "ginger": pbr("CatClockGinger", lin("#e3953f"), rough=0.6),
    "pink": pbr("CatClockPink", lin("#f2a8a0"), rough=0.6),
    "red": pbr("CatClockRed", lin("#c8342c"), rough=0.5),
    "gold": pbr("CatClockGold", lin("#e2b34a"), rough=0.35, metal=0.6),
    "hand": pbr("CatClockHand", lin("#2b2420"), rough=0.5),
}

# ---- the measures
CASE_R, CASE_D = 0.11, 0.04            # (the belly: the case)
DIAL_R, DIAL_Z = 0.07, 0.044           # (the dial on it, its face's depth)
HEAD_C, HEAD_W, HEAD_H = 0.165, 0.085, 0.068   # (the head's middle (up from the dial's) and half its width and height)
HEAD_Z = (0.012, 0.05)
PRINT_HEAD = 0.17                      # (the square of the picture's left half laid over the head's front, its side)
PRINT_DIAL = 2 * DIAL_R                # (and its right half over the dial's)


def slab(bm, ring2d, z0, z1, uv=None, uvl=None):
    """a slab between depths z0 (back) and z1 (front) on an outline given round it (x, y), from its foot up one side and down the other: its
    faces laddered across, never fanned; `uv(x, y)` for its front's points (the rest at the picture's middle of its half)"""
    bk = [bm.verts.new(P(x, y, z0)) for x, y in ring2d]
    fr = [bm.verts.new(P(x, y, z1)) for x, y in ring2d]
    faces = []
    front = ladder_fill(bm, fr)
    faces += front
    faces += ladder_fill(bm, [bk[0]] + bk[:0:-1])
    n = len(ring2d)
    for k in range(n):
        faces.append(bm.faces.new((bk[k], bk[(k + 1) % n], fr[(k + 1) % n], fr[k])))
    if uv and uvl is not None:
        for f in faces:
            on_front = f in front
            for lp in f.loops:
                co = lp.vert.co
                lp[uvl].uv = uv(co.x, co.z) if on_front else uv(None, None)
    return faces


def ellipse(cx, cy, rx, ry, n):
    """an ellipse's outline from its foot round one side and back down the other"""
    return [(cx + rx * math.sin(2 * math.pi * k / n), cy - ry * math.cos(2 * math.pi * k / n)) for k in range(n)]


def part(name, build, mat):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    build(bm, uvl)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p_ in o.data.polygons:
        p_.use_smooth = False
    return o


body = []
# (the case: the belly, white, its back on the wall)
body.append(part("cc_case", lambda bm, uvl: slab(bm, ellipse(0, 0, CASE_R, CASE_R, 24), 0.0, CASE_D), M["white"]))
# (the dial: its face the picture's right half)
body.append(part("cc_dial", lambda bm, uvl: slab(bm, ellipse(0, 0, DIAL_R, DIAL_R, 24), CASE_D - 0.004, DIAL_Z,
                                                  lambda x, y: (0.75, 0.5) if x is None else (0.5 + 0.5 * (x + DIAL_R) / PRINT_DIAL, (y + DIAL_R) / PRINT_DIAL), uvl), M["print"]))
# (the head: an oval over the case, its front the picture's left half (the face, its calico patches))
body.append(part("cc_head", lambda bm, uvl: slab(bm, ellipse(0, HEAD_C, HEAD_W, HEAD_H, 20), HEAD_Z[0], HEAD_Z[1],
                                                  lambda x, y: (0.25, 0.5) if x is None else (0.5 * (x + PRINT_HEAD / 2) / PRINT_HEAD, (y - HEAD_C + PRINT_HEAD / 2) / PRINT_HEAD), uvl), M["print"]))
# (the ears: prisms up off the head's top, leaning out a little; the left black, the right ginger; pink inside, a little in front)
top = HEAD_C + HEAD_H
for sd, mat in ((-1, M["black"]), (1, M["ginger"])):
    base = [(sd * 0.026, top - 0.022), (sd * 0.074, top - 0.03), (sd * 0.064, top + 0.038)]
    tri = [base[0], base[1], base[2]]
    body.append(part(f"cc_ear{sd}", lambda bm, uvl, t=tri: slab(bm, t, 0.02, 0.046), mat))
    inner = [(sd * 0.038, top - 0.008), (sd * 0.064, top - 0.012), (sd * 0.06, top + 0.022)]
    body.append(part(f"cc_eari{sd}", lambda bm, uvl, t=inner: slab(bm, t, 0.046, 0.0485), M["pink"]))
# (the collar at the neck, a little proud of the head and the case; the bell hung under its middle, clear of the dial's twelve)
body.append(part("cc_collar", lambda bm, uvl: slab(bm, [(-0.072, 0.088), (-0.072, 0.102), (0.072, 0.102), (0.072, 0.088)], 0.03, 0.052), M["red"]))


def bell(bm, uvl):
    """a round bell (10 round, four rings: it was a six-sided nut at 8 and three)"""
    c, r, n = Vector((0.0, 0.083, 0.054)), 0.012, 10
    rings = []
    for i in range(1, 5):
        a = math.pi * i / 5
        rings.append([bm.verts.new(P(c.x + r * math.sin(a) * math.cos(2 * math.pi * k / n), c.y + r * math.cos(a), c.z + r * math.sin(a) * math.sin(2 * math.pi * k / n))) for k in range(n)])
    for k in range(3):
        for j in range(n):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % n], rings[k + 1][(j + 1) % n], rings[k + 1][j]))
    # (its top and its foot shut by ladders across the end rings)
    ladder_fill(bm, rings[0])
    ladder_fill(bm, rings[-1][::-1])


body.append(part("cc_bell", bell, M["gold"]))
# (its mouth: a dark slit across its lower front)
body.append(part("cc_bellslit", lambda bm, uvl: slab(bm, [(-0.0075, 0.0785), (-0.0075, 0.0805), (0.0075, 0.0805), (0.0075, 0.0785)], 0.0645, 0.0662), M["black"]))
# (the front paws at the case's foot, a little in front of it, under the dial)
for sd in (-1, 1):
    body.append(part(f"cc_paw{sd}", lambda bm, uvl, s=sd: slab(bm, ellipse(s * 0.04, -0.1, 0.028, 0.022, 12), 0.03, 0.056), M["white"]))
# (the cap over the hands' pivot)
body.append(part("cc_cap", lambda bm, uvl: slab(bm, ellipse(0, 0, 0.0065, 0.0065, 8), 0.052, 0.054), M["gold"]))
bpy.ops.object.select_all(action="DESELECT")
for o in body:
    o.select_set(True)
bpy.context.view_layer.objects.active = body[0]
bpy.ops.object.join()
BODY = bpy.context.view_layer.objects.active
BODY.name = "CatClockBody"


def hand(name, w, back, length, z):
    o = part(name, lambda bm, uvl: slab(bm, [(0, -back), (-w, -back + w), (-w * 0.8, length - 2 * w), (0, length), (w * 0.8, length - 2 * w), (w, -back + w)], 0.0, 0.002), M["hand"])
    o.location = P(0, 0, z)
    return o


HOUR = hand("CatClockHour", 0.0045, 0.012, 0.04, 0.046)
MINUTE = hand("CatClockMinute", 0.0032, 0.015, 0.06, 0.049)


# ---- the tail: a round tube from its root down in an S, its tip curling up, ginger; its pivot at its root
def tail(bm, uvl):
    pts = [Vector((0.0, 0.0, 0.0)), Vector((0.012, -0.055, 0.004)), Vector((-0.01, -0.11, 0.006)), Vector((0.006, -0.165, 0.008)),
           Vector((0.03, -0.19, 0.008))]
    sides, r = 6, 0.011
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = Vector((0, 0, 1)).cross(d).normalized()
        up = d.cross(side).normalized()
        rr = r * (1 - 0.3 * i / (len(pts) - 1))
        rings.append([bm.verts.new(P(*(p + side * rr * math.cos(2 * math.pi * k / sides) + up * rr * math.sin(2 * math.pi * k / sides)))) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    ladder_fill(bm, rings[0][::-1])
    ladder_fill(bm, rings[-1])


TAIL = part("CatClockTail", tail, M["ginger"])
TAIL.location = P(0.0, -0.105, 0.02)

root = bpy.data.objects.new("CatClock", None)
bpy.context.collection.objects.link(root)
for o in (BODY, HOUR, MINUTE, TAIL):
    o.parent = root
    print(o.name, len([t for p_ in o.data.polygons for t in range(len(p_.vertices) - 2)]))

export_dish(root, [BODY, HOUR, MINUTE, TAIL, root], os.path.join(PROJECT, "public", "models", "catclock.glb"),
            os.path.join(PROJECT, "blender", "catclock.blend"), PREVIEW)
