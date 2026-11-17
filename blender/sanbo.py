"""The offering stands on the shrine's table (sanbo.glb; the owner's, 2026-11-11: the offerings on stands like the photo, one with the oranges, the
other with glutinous rice dumplings):

- node "Sanbo": a 三方 of plain white hinoki: a square tray (折敷) with a low rim round it, its corners eased, on a square base (胴) a little
  narrower, each of whose four sides has its opening (眼象, a rounded cusped window) cut through the board for real (item 247; it was painted on the
  picture, which read as a black sticker), the hollow inside dark wood, a thin dark line where the tray sits on the base.
- node "Dango": five white glutinous rice dumplings heaped on a square of white kaishi paper laid corner-on, four below and one on top
  (stands on the tray's floor at its origin).

The game's frame, in the altar's units (DiningRoom's): y up, its middle over the origin, the tray's floor at TRAY_FLOOR. Low-poly: boxes
and icospheres, no fans into a point.

Run:
    blender -b --factory-startup --python blender/sanbo.py -- <project path> [preview.png]
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

TRAY_W, TRAY_RIM, BOARD = 0.095, 0.012, 0.004
BASE_W, BASE_H = 0.07, 0.05
TRAY_FLOOR = BASE_H + BOARD


def P(x, y, z):
    return Vector((x, -z, y))


N = 512
u, v = grid01(N)
# (pale hinoki, its grain fine along u: close straight lines, now and then a darker late-wood line, the colour wandering a little warmer and
# cooler, fine pores; item 61 (the owner's, 2026-11-13: "the offering stand's look isn't real"): it was a flat pale wash)
_f = fbm(N, 2, 4, 3)
_g = np.sin((u * 60 + _f * 1.5) * 2 * math.pi) * 0.5 + 0.5
_late = smooth(0.82, 0.97, np.sin((u * 13 + _f * 0.8) * 2 * math.pi) * 0.5 + 0.5)
hin = mix((0.94, 0.86, 0.71), (0.86, 0.75, 0.58), smooth(0.55, 1.0, _g) * 0.45 + _late * 0.35)
hin = hin * (0.96 + 0.06 * fbm(N, 6, 3, 3))[..., None]
hin = hin * (0.985 + 0.015 * np.sin(v * 900 + u * 40))[..., None]
hin_h = (smooth(0.55, 1.0, _g) * 0.15 + _late * 0.25).astype(np.float32)
# (item 247, the owner's, 2026-11-17: "the red circles look unreal": the openings were painted on the base's picture, a black sticker with no depth;
# now they are cut through the board for real (see `base_shell`), so the picture is the plain hinoki and the dark of the hollow is a material)
M = {
    "hinoki": pbr("SanboHinoki", (1, 1, 1), tex=image("sanbo_hinoki", np.clip(hin, 0, 1).astype(np.float32)),
                  nrm=image("sanbo_hinoki_n", to_normal(hin_h, 1.5).astype(np.float32), data=True), nrm_strength=1.0, rough=0.6),
    # (the hollow inside the base: dark wood, not black, so what is seen through an opening reads as a space)
    "inner": pbr("SanboInner", (0.14, 0.10, 0.065), rough=0.85),
    "line": pbr("SanboLine", lin("#5a4632") if False else (0.09, 0.06, 0.04), rough=0.6),
    "mochi": pbr("SanboMochi", (0.93, 0.92, 0.88), rough=0.75),
    "paper": pbr("SanboPaper", (0.95, 0.94, 0.9), rough=0.9),
}
parts = []


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, uv_side=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, 1)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            if uv_side and abs(n.z) < 0.5:
                # (each side's picture laid over the whole of it once: its opening in its middle)
                a = c.x if abs(n.y) > abs(n.x) else c.y
                # (the box's own points are about its middle: its height from -h/2 (item 61: taken from the floor's y0, the picture slid half a
                # face down, its window's cusped top showing at its foot and its foot at the top, two dark smudges)
                uvl.data[li].uv = ((a - (x0 if abs(n.y) > abs(n.x) else -z1)) / (x1 - x0), (c.z + (y1 - y0) / 2) / (y1 - y0))
            else:
                uvl.data[li].uv = (c.x / 0.1 + 0.5, (c.y if abs(n.z) > 0.5 else c.z) / 0.1 + 0.5)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# (an opening 眼象, in a wall's own frame: x along the wall, z up from the foot; round at the bottom, straight sides, its top rising in two
# curves to a cusp in the middle; 17 points, counter-clockwise from the bottom-right corner's start)
def window_outline():
    a, zb, r, zs = 0.0215, 0.0098, 0.009, 0.0262
    right = [(a - r + r * math.sin(math.radians(d)), zb + r - r * math.cos(math.radians(d))) for d in (0, 30, 60, 90)]
    right += [(a, zs), (0.0188, 0.0307), (0.0135, 0.0340), (0.0075, 0.0358), (0.0035, 0.0366)]
    return right + [(0.0, 0.0390)] + [(-x, z) for x, z in reversed(right)]


def base_shell():
    """The base (胴) as four boards, each a real wall of thickness BOARD with its opening cut through: outer face, inner face (the hollow's
    wall, dark), and the opening's cut edge between them (the board's thickness, lit hinoki). Rings of quads from the opening out to the
    wall's edge (a wall's corner takes one extra triangle), no fan; the hollow's floor is one quad."""
    hole = window_outline()
    cx, cz = 0.0, 0.024
    K = len(hole)
    ang = [math.atan2(z - cz, x - cx) for x, z in hole]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    T = BOARD

    def poly(pts, mat, uvf):
        f = bm.faces.new([bm.verts.new(p) for p in pts])
        f.material_index = mat
        for lp in f.loops:
            lp[uvl].uv = uvf(lp.vert.co)
        return f

    for w, (wide, rot) in enumerate(((BASE_W, 0), (BASE_W - 2 * T, 90), (BASE_W, 180), (BASE_W - 2 * T, 270))):
        hw = wide / 2
        y0, y1 = -b2, -b2 + T
        c, sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))

        def place(x, y, z):
            return (x * c - y * sn, x * sn + y * c, z)

        def uv_face(co):
            return (co.x / 0.1 + 0.5 + w * 0.13, co.z / 0.1 + 0.5)

        def uv_cut(co):
            return (co.x / 0.1 + 0.5 + w * 0.13, co.y / 0.1 + 0.5)

        def edge_pt(k):
            # (where the ray from the opening's middle through point k meets the wall's rectangle)
            dx, dz = hole[k][0] - cx, hole[k][1] - cz
            s = min((hw - cx) / dx if dx > 0 else (-hw - cx) / dx if dx < 0 else 1e9, (BASE_H - cz) / dz if dz > 0 else (0 - cz) / dz if dz < 0 else 1e9)
            return (cx + dx * s, cz + dz * s)

        corners = [(hw, 0.0), (hw, BASE_H), (-hw, BASE_H), (-hw, 0.0)]      # (counter-clockwise from the bottom-right)
        cang = [math.atan2(z - cz, x - cx) for x, z in corners]
        for k in range(K):
            k2 = (k + 1) % K
            o1, o2, h1, h2 = edge_pt(k), edge_pt(k2), hole[k], hole[k2]
            # (the corner between the two rays, if any: its angle after the first ray's, before the second's)
            span = (ang[k2] - ang[k]) % (2 * math.pi)
            between = [corners[i] for i in range(4) if 0 < (cang[i] - ang[k]) % (2 * math.pi) < span]
            for face_y, mat, flip in ((y0, 0, False), (y1, 1, True)):
                def ring(pts):
                    return [place(x, face_y, z) for x, z in (pts[::-1] if flip else pts)]
                if between:
                    poly(ring([o1, between[0], o2]), mat, uv_face)
                poly(ring([o1, o2, h2, h1]), mat, uv_face)
            # (the cut edge of the board: its face looks into the opening)
            poly([place(h1[0], y0, h1[1]), place(h2[0], y0, h2[1]), place(h2[0], y1, h2[1]), place(h1[0], y1, h1[1])], 0, uv_cut)
        if rot in (0, 180):
            # (the end of the board, seen from the side where it meets the next wall)
            poly([place(hw, y0, 0), place(hw, y1, 0), place(hw, y1, BASE_H), place(hw, y0, BASE_H)], 0, uv_cut)
            poly([place(-hw, y0, 0), place(-hw, y0, BASE_H), place(-hw, y1, BASE_H), place(-hw, y1, 0)], 0, uv_cut)
    # (a dark post in the middle of the hollow, so that looking in through an opening one sees a dim shape and not the room through the opposite
    # opening; its sides face out, in the dark wood)
    q = 0.017
    for pts in (((-q, -q), (q, -q)), ((q, -q), (q, q)), ((q, q), (-q, q)), ((-q, q), (-q, -q))):
        (x0, y0_), (x1, y1_) = pts
        poly([(x0, y0_, 0.002), (x1, y1_, 0.002), (x1, y1_, BASE_H - 0.002), (x0, y0_, BASE_H - 0.002)], 1, lambda co: (0, 0))
    i = b2 - T
    poly([(-i, -i, 0.002), (i, -i, 0.002), (i, i, 0.002), (-i, i, 0.002)], 1, lambda co: (0, 0))
    me = bpy.data.meshes.new("base")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("base", me)
    bpy.context.collection.objects.link(o)
    me.materials.append(M["hinoki"])
    me.materials.append(M["inner"])
    for p in me.polygons:
        p.use_smooth = False
    bpy.context.view_layer.objects.active = o
    parts.append(o)
    return o


# ---- the stand
s = []
b2, t2 = BASE_W / 2, TRAY_W / 2
s.append(base_shell())
s.append(box("seat", -b2 - 0.002, b2 + 0.002, BASE_H - 0.002, BASE_H, -b2 - 0.002, b2 + 0.002, "line"))
s.append(box("floor", -t2, t2, BASE_H, BASE_H + BOARD, -t2, t2, "hinoki", bev=0.0012))
for k, (a0, a1, c0, c1) in enumerate(((-t2, t2, -t2, -t2 + BOARD), (-t2, t2, t2 - BOARD, t2), (-t2, -t2 + BOARD, -t2 + BOARD, t2 - BOARD),
                                      (t2 - BOARD, t2, -t2 + BOARD, t2 - BOARD))):
    s.append(box(f"rim{k}", a0, a1, BASE_H + BOARD, BASE_H + BOARD + TRAY_RIM, c0, c1, "hinoki", bev=0.001))
bpy.ops.object.select_all(action="DESELECT")
for o in s:
    o.select_set(True)
bpy.context.view_layer.objects.active = s[0]
bpy.ops.object.join()
stand = active()
stand.name = "Sanbo"

# ---- the dumplings on their paper
d = []
paper = box("paper", -0.032, 0.032, 0.0, 0.0012, -0.032, 0.032, "paper")
paper.rotation_euler = (0, 0, math.pi / 4)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
d.append(paper)
R = 0.0125
for k, (dx, dy, dz) in enumerate([(-R, R * 0.9, -R), (R, R * 0.9, -R), (-R, R * 0.9, R), (R, R * 0.9, R), (0, R * 0.9 + R * 1.5, 0)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=R, location=P(dx, dy + 0.0012, dz))
    o = active()
    o.scale = (1, 1, 0.92)
    apply_scale(o)
    finish(o, f"dango{k}", M["mochi"])
    parts.append(o)
    d.append(o)
bpy.ops.object.select_all(action="DESELECT")
for o in d:
    o.select_set(True)
bpy.context.view_layer.objects.active = d[0]
bpy.ops.object.join()
dango = active()
dango.name = "Dango"
dango.location = P(0.16, 0, 0)

root = bpy.data.objects.new("SanboRoot", None)
bpy.context.collection.objects.link(root)
for o in (stand, dango):
    o.parent = root
print("SANBO_TRIS", {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (stand, dango)})
if PREVIEW:
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    target = P(0.08, 0.04, 0)
    cam.location = P(0.08, 0.2, 0.32)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.rotation_euler = (0.6, 0.2, 0.4)
export_dish(root, [stand, dango, root], os.path.join(PROJECT, "public", "models", "sanbo.glb"), os.path.join(PROJECT, "blender", "sanbo.blend"), PREVIEW)
print("SANBO_DONE")
