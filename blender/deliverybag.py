"""The delivery rider's insulated box (デリバリーバッグ): deliverybag.glb, node "DeliveryBag", a square backpack box as Japan's delivery riders
carry, its face the platform's colour and mark. In the figure's own units (blender/folk.py's: the box 0.46 wide, 0.44 tall, 0.30 deep), y up,
its middle at the origin, its outer face (the one away from the rider's back, with the mark) toward -z.

The owner's (2026-11-13, item 77: "the bags of Japan's delivery platforms; they needn't be the same, but can be very like", with Wolt's teal,
Uber Eats' black and green, foodpanda's pink and 出前館's red to go by). Four made-up platforms, none a real one (each looked for, none found):
Torutto (teal, a white wordmark), モグゴー (black, a green wordmark), パクッと便 (pink), とどけ丸 (red-orange); each rider carries one (the
game picks by the rider). Low-poly by docs/MODELING.md: a box, its edges softened in two steps, a carry handle on top; everything else (the
platform's mark, the reflective band, the zip round the lid, the seams, the scuffs) in one picture, four looks in its four quarters, each face
of the box laid on its own part of its quarter.

Run:
    blender -b --factory-startup --python blender/deliverybag.py -- <project path> [preview.png]
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
rng = np.random.default_rng(11)

W, H, D = 0.46, 0.44, 0.30
FONT = "C:/Windows/Fonts/YuGothB.ttc"
BRUSH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "YujiBoku-Regular.ttf")

# =====================================================================
# The picture: 1024 square, four quarters (a look each); in each, the outer face at its lower left, the top at its lower right, the side
# at its upper left, the back and the bottom (plain) at its upper right
# =====================================================================
Q = 512
SS = 3
_glyphs = {}


def glyph(ch, font):
    key = (ch, font)
    if key in _glyphs:
        return _glyphs[key]
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = bpy.context.view_layer.objects.active
    tx.data.body = ch
    tx.data.font = bpy.data.fonts.load(font, check_existing=True)
    tx.data.size = 1.0
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    tx.data.resolution_u = 5
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    bm_ = bmesh.new(); bm_.from_mesh(o.data)
    bmesh.ops.triangulate(bm_, faces=bm_.faces[:])
    tris = [[(lp.vert.co.x, lp.vert.co.y) for lp in f.loops] for f in bm_.faces]
    w_ = (max((p[0] for t in tris for p in t), default=0.3) - min((p[0] for t in tris for p in t), default=-0.3))
    bm_.free()
    bpy.data.objects.remove(o)
    _glyphs[key] = (tris, w_)
    return _glyphs[key]


def fill_tris(mask, tris, cx, cy, s):
    H_, W_ = mask.shape
    for t in tris:
        P_ = [(cx + x * s, cy + y * s) for x, y in t]
        x0, x1 = int(max(0, min(p[0] for p in P_))), int(min(W_ - 1, max(p[0] for p in P_) + 1))
        y0, y1 = int(max(0, min(p[1] for p in P_))), int(min(H_ - 1, max(p[1] for p in P_) + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
        (ax, ay), (bx, by), (qx, qy) = P_
        d1 = (gx - bx) * (ay - by) - (ax - bx) * (gy - by)
        d2 = (gx - qx) * (by - qy) - (bx - qx) * (gy - qy)
        d3 = (gx - ax) * (qy - ay) - (qx - ax) * (gy - ay)
        mask[y0:y1 + 1, x0:x1 + 1] |= ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))


class Face:
    """one face's patch of a quarter: drawing in metres on the face (x right, y up as you look at it), (0, 0) its middle"""

    def __init__(self, img, x0, y0, w_px, h_px, w_m, h_m):
        self.img, self.x0, self.y0, self.w, self.h = img, x0, y0, w_px, h_px
        self.ppm = w_px / w_m
        yy, xx = np.mgrid[0:h_px, 0:w_px].astype(np.float32) + 0.5
        self.x = (xx - w_px / 2) / self.ppm
        self.y = (yy - h_px / 2) / self.ppm
        self.wm, self.hm = w_m, h_m

    def view(self):
        return self.img[self.y0:self.y0 + self.h, self.x0:self.x0 + self.w]

    def paint(self, m, c):
        v = self.view()
        v[m] = c

    def blend(self, m, c, k):
        v = self.view()
        v[:] = mix(v, c, np.clip(m.astype(np.float32) * k, 0, 1))

    def text(self, s, x, y, size, c, font=FONT, gap=0.95):
        m = np.zeros((self.h * SS, self.w * SS), bool)
        widths = [glyph(ch, font)[1] * size * gap for ch in s]
        cx = x - sum(widths) / 2
        for ch, w_ in zip(s, widths):
            if ch != " ":
                fill_tris(m, glyph(ch, font)[0], (self.w / 2 + (cx + w_ / 2) * self.ppm) * SS, (self.h / 2 + y * self.ppm) * SS, size * self.ppm * SS)
            cx += w_
        cov = m.reshape(self.h, SS, self.w, SS).mean(axis=(1, 3))
        v = self.view()
        v[:] = mix(v, c, cov)


LOOKS = [
    # (name, the bag's colour, its darker trim, the mark's colour, the wordmark, its font, a symbol)
    ("Torutto", (0.0, 0.62, 0.74), (0.0, 0.42, 0.52), (0.98, 0.98, 0.98), "Torutto", FONT, "dot"),
    ("Mogugo", (0.07, 0.07, 0.08), (0.03, 0.03, 0.035), (0.2, 0.78, 0.38), "モグゴー", FONT, "none"),
    ("Pakutto", (0.86, 0.12, 0.45), (0.62, 0.06, 0.3), (0.99, 0.95, 0.97), "パクッと便", FONT, "bowl"),
    ("Todokemaru", (0.9, 0.2, 0.1), (0.66, 0.1, 0.05), (0.99, 0.97, 0.9), "とどけ丸", BRUSH, "maru"),
]
ATLAS = np.zeros((2 * Q, 2 * Q, 3), np.float32)
# (each quarter's patches: (x0, y0, w, h) in pixels within it; the face's size in metres)
PATCH = {"out": (0, 0, 256, 245, W, H), "top": (256, 0, 256, 167, W, D), "side": (0, 256, 167, 245, D, H), "plain": (256, 256, 256, 256, W, H)}
for k, (nm, base, trim, ink, word, font, sym) in enumerate(LOOKS):
    qx, qy = (k % 2) * Q, (k // 2) * Q
    img = ATLAS[qy:qy + Q, qx:qx + Q]
    # (the fabric: the colour, a fine weave, a little uneven, darker toward its edges and foot)
    n = fbm(Q, 24, 24, 3)
    weave = 0.95 + 0.05 * np.sin(np.arange(Q)[:, None] * 2.4) * np.sin(np.arange(Q)[None, :] * 2.4)
    img[:] = np.asarray(base, np.float32) * ((0.92 + 0.1 * n) * weave)[..., None]
    faces = {key: Face(img, *pv) for key, pv in PATCH.items()}
    for key, f in faces.items():
        v = f.view()
        edge = np.minimum(f.wm / 2 - np.abs(f.x), f.hm / 2 - np.abs(f.y))
        v *= (0.78 + 0.22 * smooth(0.0, 0.03, edge))[..., None]
        # (the seams: a stitched line just in from each edge, a trim of the darker colour round it)
        f.paint((edge < 0.012), trim)
        f.blend((np.abs(edge - 0.016) < 0.0012) & (np.sin((f.x + f.y) * 900) > 0), (0.15, 0.15, 0.15), 0.5)
        # (scuffs and dust, more on the foot)
        sc = smooth(0.72, 0.9, fbm(Q, 10, 10, 3)[:f.h, :f.w]) * (0.5 + 0.5 * smooth(0.0, -f.hm / 2, f.y))
        v[:] = mix(v, (0.55, 0.53, 0.5), sc * (0.35 if sum(base) > 0.6 else 0.12))
    out, top, side = faces["out"], faces["top"], faces["side"]
    # (the reflective band round the box near its foot: silver-white, its sheen in fine stripes)
    for f in (out, side):
        band = np.abs(f.y + f.hm / 2 - 0.07) < 0.012
        f.paint(band, (0.82, 0.84, 0.86))
        f.blend(band & (np.sin(f.x * 1200) > 0.6), (0.97, 0.97, 0.98), 0.6)
    # (the platform's mark on the outer face: the wordmark big across its middle, a symbol over it)
    out.text(word, 0.0, -0.01, 0.1 if word.isascii() else min(0.085, 0.36 / len(word)), ink, font)
    if sym == "dot":
        d = np.sqrt(out.x ** 2 + (out.y - 0.1) ** 2)
        out.paint(d < 0.03, ink)
        out.paint(d < 0.013, base)
    elif sym == "bowl":
        d = np.sqrt(out.x ** 2 + (out.y - 0.1) ** 2)
        out.paint((d < 0.036) & (out.y < 0.1), ink)
        out.paint((np.abs(out.y - 0.1) < 0.004) & (np.abs(out.x) < 0.044), ink)
        for sx in (-0.012, 0.012):
            out.paint((np.abs(out.x - sx - (out.y - 0.13) * 0.3) < 0.003) & (out.y > 0.1) & (out.y < 0.16), ink)
    elif sym == "maru":
        d = np.sqrt(out.x ** 2 + (out.y - 0.105) ** 2)
        out.paint(np.abs(d - 0.032) < 0.006, ink)
        out.text("丸", 0.0, 0.105, 0.04, ink, BRUSH)
    else:
        out.paint((np.abs(out.y - 0.075) < 0.003) & (np.abs(out.x) < 0.09), ink)
    out.text("FOOD DELIVERY", 0.0, -0.09, 0.02, ink, FONT, gap=1.2)
    # (its name smaller along the side, the band under it; the top: the zip round the lid, its pull, the mark small)
    side.text(word, 0.0, 0.05, 0.034 if len(word) <= 5 else 0.028, ink, font)
    zip_ = np.abs(np.minimum(top.wm / 2 - np.abs(top.x), top.hm / 2 - np.abs(top.y)) - 0.03) < 0.0035
    top.paint(zip_, (0.1, 0.1, 0.1))
    top.blend(zip_ & (np.sin((top.x + top.y) * 1500) > 0), (0.55, 0.55, 0.55), 0.6)
    top.paint((np.abs(top.x - 0.14) < 0.006) & (np.abs(top.y - (top.hm / 2 - 0.03)) < 0.02), (0.6, 0.6, 0.62))
    top.text(word, 0.0, -0.035, 0.03 if len(word) <= 5 else 0.024, ink, font)
ATLAS = np.clip(ATLAS, 0, 1)

# =====================================================================
# The box: its edges softened in two steps, each face laid on its patch (by the way it faces); the carry handle on top
# =====================================================================
M = {"bag": pbr("DeliveryBag", (1, 1, 1), tex=image("delivery_bag", ATLAS.astype(np.float32)), rough=0.7),
     "strap": pbr("DeliveryStrap", (0.1, 0.1, 0.11), rough=0.8)}
bpy.ops.mesh.primitive_cube_add(size=1)
box = bpy.context.view_layer.objects.active
box.scale = (W, D, H)
bpy.ops.object.transform_apply(scale=True)
bevel(box, 0.025, 2, angle=False)
bpy.ops.object.select_all(action="DESELECT")
box.select_set(True)
bpy.context.view_layer.objects.active = box
for m_ in list(box.modifiers):
    bpy.ops.object.modifier_apply(modifier=m_.name)
bm = bmesh.from_edit_mesh(box.data) if box.mode == "EDIT" else None
bm = bmesh.new(); bm.from_mesh(box.data)
uvl = bm.loops.layers.uv.verify()


def patch_uv(key, a, b, sa, sb):
    """(a, b) metres on that face (its middle 0) into the first quarter's patch for `key`, uv (the game shifts it to the rider's quarter)"""
    x0, y0, w, h, wm, hm = PATCH[key]
    return ((x0 + (0.5 + a / wm) * w) / (2 * Q), (y0 + (0.5 + b / hm) * h) / (2 * Q))


for f in bm.faces:
    nrm = f.normal
    ax = max(range(3), key=lambda i: abs(nrm[i]))
    for l in f.loops:
        co = l.vert.co
        # (Blender: x across, y depth (-y the outer face), z up)
        if ax == 1 and nrm.y < 0:
            l[uvl].uv = patch_uv("out", co.x, co.z, W, H)
        elif ax == 2 and nrm.z > 0:
            l[uvl].uv = patch_uv("top", co.x, co.y, W, D)
        elif ax == 0:
            l[uvl].uv = patch_uv("side", co.y * (1 if nrm.x > 0 else -1), co.z, D, H)
        else:
            l[uvl].uv = patch_uv("plain", co.x, co.z if ax == 1 else co.y, W, H)
bm.to_mesh(box.data)
bm.free()
box.name = box.data.name = "DeliveryBagBox"
box.data.materials.append(M["bag"])
for p_ in box.data.polygons:
    p_.use_smooth = True
# (the carry handle: a flat strap arched over the lid, front to back, four bends)
bm = bmesh.new()
pts = [(-0.06, H / 2), (-0.045, H / 2 + 0.035), (0.045, H / 2 + 0.035), (0.06, H / 2)]
rows = []
for x, z in pts:
    rows.append([bm.verts.new((x, y, z + dz)) for y, dz in ((-0.02, 0), (0.02, 0), (0.02, 0.006), (-0.02, 0.006))])
for a, b in zip(rows, rows[1:]):
    for i in range(4):
        bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("DeliveryBagHandle"); bm.to_mesh(me); bm.free()
handle = bpy.data.objects.new("DeliveryBagHandle", me); bpy.context.collection.objects.link(handle)
handle.data.materials.append(M["strap"])
root = bpy.data.objects.new("DeliveryBag", None)
bpy.context.collection.objects.link(root)
for o in (box, handle):
    o.parent = root
print("DELIVERYBAG_TRIS", sum(len(p.vertices) - 2 for o in (box, handle) for p in o.data.polygons))
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.55, -1.1, 0.45)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.7, 0.2, 0.5)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1)
    bpy.context.scene.world = w
export_dish(root, [box, handle, root], os.path.join(PROJECT, "public", "models", "deliverybag.glb"), os.path.join(PROJECT, "blender", "deliverybag.blend"), PREVIEW)
print("DELIVERYBAG_DONE")
