"""The two stone steps down from the genkan to the street (stonesteps.glb; item 352, the owner's, 2026-11-18: 「石階梯太假了吧」 over item
342's steps: two boxes in the base's masonry picture, read as bricks stacked). Each one long slab the doorway's width, its edges eased, the
tread's front edge worn rounder, faced in the genkan floor's crazy paving (item 395, the owner's, 2026-11-20: three styles of stone one over
another at the way in, 「應該是由裡面第一種為主」): the floor's granite in stones each of its own outline and tint, in the floor's pebble-wash
joints, each stone's edge rounded off (crazy_paving: a picture and its normal map, the faces as they were; the footing's face under the
genkan's edge is laid in the same picture at the same scale, GuestBar3D's ShopBase). In the bar's own units (GuestBar3D's ShopBase: x across the doorway, y up, z out to the street), each slab's middle at its
origin, as the game measures them: StoneStep1 (the upper) 1.2329 x 0.2247 x 0.168, StoneStep2 1.2289 x 0.1123 x 0.168; the game scales each
to the doorway as it stands (within a percent).

Run:
    blender -b --factory-startup --python blender/stonesteps.py -- <project path> [preview.png]
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
JOINT = 0.009       # half a joint's width, the genkan floor's
ROUND = 0.011       # how far in each stone's edge is rounded off, the floor's
# (the floor's stones' tints: pale granite, warm grey, cool grey, a grey, a darker grey; the dark slate last)
TINTS = [(1.0, 1.0, 1.0), (1.02, 0.94, 0.84), (0.84, 0.88, 0.94), (0.9, 0.88, 0.86), (0.66, 0.65, 0.66), (0.5, 0.5, 0.53)]


def P(x, y, z):
    return Vector((x, -z, y))


PX = 1200           # the atlas's pixels a unit (the bar's): a stone's grains and its joint's pebbles as fine as the floor's
AW, AH = 2048, 2048
# (the slabs, in the bar's units, as the game measures and scales them: the footing's band over the upper step (StoneStep0, item 404: the
# genkan's edge between the upper step and the floor, a riser of its own now, a thin slab laid on the footing's face), the upper step, the lower)
SLABS = {"StoneStep0": (1.2369, 0.1123, 0.012), "StoneStep1": (1.2329, 0.2247, 0.168), "StoneStep2": (1.2289, 0.1123, 0.168),
         # (and the rest of the way in's stone, each face its own course (item 404: they were boxes the paving's one picture was laid over at
         # one scale): the genkan's side by the wall (along it), and the footing itself (its sides; its front's behind the band and the steps);
         # the door's curb that stood up over the genkan's stone taken away (item 407))
         "StoneSide": (0.02, 0.112, 1.3155), "StoneFoot": (1.2369, 0.337, 1.3155)}
# (each slab's faces' places on the atlas (x, y, w, h in its pixels, its row 0 the picture's foot), the faces' own sizes, and how many courses
# across: the upper step's riser two, its joint where the lower step's tread meets it, so what shows of it over the lower step is one course)
def _r(x, y, W, H):
    return (x, y, max(1, round(W * PX)), max(1, round(H * PX)))
FACES = {
    "StoneStep0": {"front": (_r(0, 0, 1.2369, 0.1123), 1.2369, 0.1123, 1)},
    "StoneStep1": {"front": (_r(0, 141, 1.2329, 0.2247), 1.2329, 0.2247, 2), "top": (_r(0, 417, 1.2329, 0.168), 1.2329, 0.168, 1),
                   "left": (_r(1500, 0, 0.168, 0.2247), 0.168, 0.2247, 1), "right": (_r(1712, 0, 0.168, 0.2247), 0.168, 0.2247, 1)},
    "StoneStep2": {"front": (_r(0, 625, 1.2289, 0.1123), 1.2289, 0.1123, 1), "top": (_r(0, 766, 1.2289, 0.168), 1.2289, 0.168, 1),
                   "left": (_r(1500, 280, 0.168, 0.1123), 0.168, 0.1123, 1), "right": (_r(1712, 280, 0.168, 0.1123), 0.168, 0.1123, 1)},
    # (a part's two long faces never seen at once: one place for both)
    "StoneSide": {"left": (_r(0, 1254, 1.3155, 0.112), 1.3155, 0.112, 1), "right": (_r(0, 1254, 1.3155, 0.112), 1.3155, 0.112, 1)},
    # (the footing's sides in three courses, a course a step's rise: their joints level with the steps' treads)
    "StoneFoot": {"left": (_r(0, 1394, 1.3155, 0.337), 1.3155, 0.337, 3), "right": (_r(0, 1394, 1.3155, 0.337), 1.3155, 0.337, 3)},
}
# (what's never seen, and the band's edges a hair wide: the joints' pebble-wash only)
JOINT_ONLY = (1924, 0, 120, 120)


def course(W, H, rows, rng_):
    """(item 404, the owner's 「切得很怪」: one picture of crazy paving laid over every face, its stones cut off wherever a face ended, the
    steps' treads and risers in sliced bands) a face's stones as a mason lays them: one course of whole stones along it (or `rows` of them,
    one over another), each stone its own length, their joints across slanting and once bent, never a stone over the face's edge, half a
    joint all round its edge (the next face's half makes it whole at the corner). For each pixel of the face (PX a unit): how far in from its
    stone's edge, and which stone (0..n)"""
    wpx, hpx = max(1, round(W * PX)), max(1, round(H * PX))
    fx = np.broadcast_to((np.arange(wpx, dtype=np.float32) + 0.5)[None, :] / PX, (hpx, wpx))
    fy = np.broadcast_to((np.arange(hpx, dtype=np.float32) + 0.5)[:, None] / PX, (hpx, wpx))
    along = W >= H
    L, T = (W, H) if along else (H, W)
    u, v = (fx, fy) if along else (fy, fx)
    edge = np.minimum(np.minimum(u, L - u), np.minimum(v, T - v)).astype(np.float32)
    sid = np.zeros((hpx, wpx), np.int32)
    n = 0
    for r_ in range(rows):
        v0, v1 = T * r_ / rows, T * (r_ + 1) / rows
        th = v1 - v0
        inrow = (v >= v0) & (v < v1) if rows > 1 else np.ones((hpx, wpx), bool)
        if r_:
            edge = np.where(inrow, np.minimum(edge, v - v0), edge)
        if r_ < rows - 1:
            edge = np.where(inrow, np.minimum(edge, v1 - v), edge)
        cuts = []
        x = rng_.uniform(0.09, 0.2)
        while x < L - 0.11:
            a, b = x + rng_.uniform(-0.35, 0.35) * th, x + rng_.uniform(-0.35, 0.35) * th
            cuts.append((a, (a + b) / 2 + rng_.uniform(-0.2, 0.2) * th, b))
            x += rng_.uniform(0.17, 0.3)
        t = np.clip((v - v0) / th, 0, 1)
        cnt = np.zeros((hpx, wpx), np.int32)
        for a, m, b in cuts:
            xc = np.where(t < 0.5, a + (m - a) * t * 2, m + (b - m) * (t - 0.5) * 2)
            edge = np.where(inrow, np.minimum(edge, np.abs(u - xc) * 0.95), edge)
            cnt += (u > xc).astype(np.int32)
        sid = np.where(inrow, n + cnt, sid)
        n += len(cuts) + 1
    return edge, sid, n


def paving_atlas():
    """the steps' stones, face by face (FACES), on one picture: the genkan floor's granite in each stone (blender/genkanfloor.py's: its
    ground, its grains, its veins), each stone one of the floor's tints (brought to the picture's values) and its edge rounded off a little,
    the floor's pebble-wash in the joints; and the height of it all, for the normal map"""
    rng_ = np.random.default_rng(404)
    edge = np.full((AH, AW), -1.0, np.float32)      # (-1: no face there; the joints' pebble-wash)
    sid = np.zeros((AH, AW), np.int32)
    total = 0
    laid = set()
    for name, faces in FACES.items():
        for face, ((x, y, w, h), W, H, rows) in faces.items():
            if (x, y) in laid:
                continue
            laid.add((x, y))
            e, s_, n_ = course(W, H, rows, rng_)
            edge[y:y + h, x:x + w] = e[:h, :w]
            sid[y:y + h, x:x + w] = s_[:h, :w] + total
            total += n_
    # (the never-seen faces' patch: all joint)
    x_, y_, w_, h_ = JOINT_ONLY
    edge[y_:y_ + h_, x_:x_ + w_] = 0.0
    # (the floor's granite, over the whole picture, its sizes a square's (fbm's), the first rows taken)
    N = AW
    ground = mix((0.60, 0.58, 0.55), (0.47, 0.455, 0.43), fbm(N, 10, 10, 5))
    gran = ground.copy()
    for cells, thr, col, k in ((1680, 0.80, (0.08, 0.08, 0.09), 0.9), (1200, 0.84, (0.80, 0.79, 0.76), 0.7), (960, 0.86, (0.52, 0.40, 0.35), 0.6),
                               (2048, 0.78, (0.24, 0.24, 0.25), 0.55)):
        chip = smooth(thr, thr + 0.04, vnoise(N, cells, cells))
        gran = mix(gran, col, chip * k)
    vein = np.abs(fbm(N, 6, 14, 5) - 0.5)
    gran = mix(gran, (0.36, 0.355, 0.35), smooth(0.03, 0.0, vein) * 0.35)
    gran = (gran * (0.93 + 0.1 * fbm(N, 16, 16, 4))[..., None])[:AH]
    tints = np.array([TINTS[int(rng_.integers(0, len(TINTS) - 1))] if rng_.random() > 0.2 else TINTS[-1] for _ in range(total)], np.float32)
    stone = smooth(JOINT - 0.0012, JOINT + 0.0012, edge)
    fall = smooth(JOINT, JOINT + ROUND, edge)
    dome = smooth(JOINT, 0.08, edge)
    col_s = gran * (tints ** (1 / 2.2))[sid] * (0.9 + 0.1 * fall)[..., None] * 1.1
    # (the pebble-wash, the floor's, laid only where there's joint)
    peb = np.zeros((AH, AW, 3), np.float32) + np.array([0.20, 0.19, 0.18], np.float32)
    peb = peb * (0.85 + 0.3 * fbm(N, 32, 32, 4)[:AH])[..., None]
    ph = np.zeros((AH, AW), np.float32)
    for _ in range(26000):
        cx, cy = rng_.uniform(0, AW), rng_.uniform(0, AH)
        e_ = edge[int(cy), int(cx)]
        if e_ < 0 or e_ > JOINT + 0.004:
            continue
        r = rng_.uniform(3.0, 6.0)
        tone = rng_.random()
        c_ = np.array((0.06, 0.06, 0.065) if tone < 0.55 else (0.42, 0.41, 0.40) if tone < 0.88 else (0.86, 0.85, 0.82), np.float32)
        c_ = c_ * rng_.uniform(0.85, 1.15)
        ir = int(r) + 2
        y0, y1, x0, x1 = max(0, int(cy) - ir), min(AH, int(cy) + ir + 1), max(0, int(cx) - ir), min(AW, int(cx) + ir + 1)
        gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.hypot(gx - cx, gy - cy)
        m = np.clip((r - d) / 1.2, 0, 1)
        dm = np.clip(1 - (d / r) ** 2, 0, 1)
        peb[y0:y1, x0:x1] = peb[y0:y1, x0:x1] * (1 - m[..., None]) + (c_ * (0.75 + 0.35 * dm)[..., None]) * m[..., None]
        ph[y0:y1, x0:x1] = np.maximum(ph[y0:y1, x0:x1], dm * m)
    col = mix(peb, col_s, stone)
    hgt = (1 - stone) * ph * 0.3 + stone * (0.45 + 0.35 * fall + 0.12 * dome) + 0.03 * fbm(N, 128, 128, 3)[:AH]
    return np.clip(col, 0, 1).astype(np.float32), hgt.astype(np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)
seed(404)
g_col, g_h = paving_atlas()
STONE = pbr("StoneStepGranite", (1, 1, 1), tex=image("stonestep_paving", g_col),
            nrm=image("stonestep_paving_normal", to_normal(g_h, 3.0), data=True), nrm_strength=1.0, rough=0.7)
parts = []


def slab(name, W, H, D, wear, ease=0.008):
    """a slab W x H x D about its middle, its edges eased (a bevel of two), the tread's front edge rounder (`wear`); UVs in world size, the
    tread's picture paler down its middle where it's walked (a second UV? no: its colour in the vertices (paler) — kept simple: the picture's
    own)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = P(v.co.x * W, v.co.z * H, -v.co.y * D)
    edges = bm.edges[:]
    bmesh.ops.bevel(bm, geom=edges, offset=ease, segments=2, profile=0.5, affect="EDGES")
    # (the front top edge worn rounder: the verts along it eased down and back a little more)
    for v in bm.verts:
        gx, gy, gz = v.co.x, v.co.z, -v.co.y
        if gy > H / 2 - 0.012 and gz > D / 2 - 0.012:
            k = min(1.0, (gy - (H / 2 - 0.012)) / 0.012) * min(1.0, (gz - (D / 2 - 0.012)) / 0.012)
            v.co.z -= wear * k
            v.co.y += wear * k * 0.6
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # (each face on its own place on the atlas (FACES), at its own size: its stones laid to it, a joint round its edge; an eased edge's faces
    # go with the face they lean to, their joint's half; what's never seen (its back, its foot, the band's thin edges) on the joints' patch)
    uvl = bm.loops.layers.uv.new("UVMap")
    faces = FACES.get(name, {})
    for f in bm.faces:
        n = f.normal
        nx, ny, nz = n.x, n.z, -n.y
        if abs(ny) >= max(abs(nx), abs(nz)):
            key = "top" if ny > 0 else None
        elif abs(nx) >= abs(nz):
            key = "right" if nx > 0 else "left"
        else:
            key = "front" if nz > 0 else "back"
        reg = faces.get(key) if key else None
        for lp in f.loops:
            c = lp.vert.co
            gx, gy, gz = c.x, c.z, -c.y
            if reg is None:
                (x, y, w, h), fu, fv = JOINT_ONLY, 0.5, 0.5
            else:
                (x, y, w, h), FW, FH, _ = reg
                if key == "front":
                    fu, fv = (gx + W / 2) / FW, (gy + H / 2) / FH
                elif key == "top":
                    fu, fv = (gx + W / 2) / FW, (gz + D / 2) / FH
                elif key == "back":
                    fu, fv = (W / 2 - gx) / FW, (gy + H / 2) / FH
                elif key == "left":
                    fu, fv = (gz + D / 2) / FW, (gy + H / 2) / FH
                else:
                    fu, fv = (D / 2 - gz) / FW, (gy + H / 2) / FH
            fu, fv = min(1.0, max(0.0, fu)), min(1.0, max(0.0, fv))
            lp[uvl].uv = ((x + fu * w) / AW, (y + fv * h) / AH)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(STONE)
    for p in o.data.polygons:
        p.use_smooth = False
    parts.append(o)
    return o


s1 = slab("StoneStep1", *SLABS["StoneStep1"], 0.004)
s2 = slab("StoneStep2", *SLABS["StoneStep2"], 0.004)
# (the footing's band over the upper step, a riser of its own (item 404): thin, its edges eased less, not worn)
s0 = slab("StoneStep0", *SLABS["StoneStep0"], 0.0, ease=0.003)
ss = slab("StoneSide", *SLABS["StoneSide"], 0.0, ease=0.004)
sf = slab("StoneFoot", *SLABS["StoneFoot"], 0.0, ease=0.003)
s2.location = P(0, 0, 0.5)   # (apart in the file; the game sets each where it stands)
s0.location = P(0, 0, -0.5)
ss.location = P(2, 0, 0)
sf.location = P(4, 0, 0)
root = bpy.data.objects.new("StoneSteps", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
print("STEPS_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0, 0, 0.25)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.6, 0.5, 1.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 2)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.4, 0.4, 0.4)
    bpy.context.scene.world = world
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "stonesteps.glb"),
            os.path.join(PROJECT, "blender", "stonesteps.blend"), PREVIEW)
print("STEPS_DONE")
