"""The two stone steps down from the genkan to the street (stonesteps.glb; item 352, the owner's, 2026-11-18: 「石階梯太假了吧」 over item
342's steps: two boxes in the base's masonry picture, read as bricks stacked). Each one long slab the doorway's width, its edges eased, the
tread's front edge worn rounder, faced in the genkan floor's crazy paving (item 395, the owner's, 2026-11-20: three styles of stone one over
another at the way in, 「應該是由裡面第一種為主」): the floor's granite in stones each of its own outline and tint, in the floor's pebble-wash
joints, each stone's edge rounded off (crazy_paving: a picture and its normal map, the faces as they were; the footing's face under the
genkan's edge is laid in the same picture at the same scale, GuestBar3D's ShopBase). In the bar's own units (GuestBar3D's ShopBase: x across the doorway, y up, z out to the street), each slab's middle at its
origin, as the game measures them: StoneStep1 (the upper) 1.2329 x 0.2247 x 0.168, StoneStep2 1.2289 x 0.1123 x 0.168; the game scales each
to the doorway as it stands (within a percent).
The two steps and the band over them (StoneStep1, StoneStep2, StoneStep0) are stones of their own now (item 424, the owner's, 2026-11-21:
「這石階跟裡面比，不夠精緻，其次是可以加點青苔感。」), made as the genkan's floor is: each face that shows its own crazy paving of domed stones
worn round at their edges, in a recessed pebble-wash, moss in their shaded corners (build_step, below); the footing's sides and the genkan's
side by the wall (StoneSide, StoneFoot) are still the courses' picture.

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


# ================================================================================================ the steps' own stones (item 424)
# (the owner's, 2026-11-21: 「這石階跟裡面比，不夠精緻，其次是可以加點青苔感。」: the two steps and the band over them were slabs with a
# picture of stones on them (item 404's courses), flat, their joints coarse dark lines; the genkan's floor inside is stones of their own,
# each domed and worn round at its edge, set in a pebble-wash (blender/genkanfloor.py). So these are made as that floor is: on each face that
# shows (a tread, a riser, an end) its own crazy paving of whole stones, each its own outline and tint, domed, its edge rounded off, in 1 cm
# joints (the floor's 1.8 cm read as coarse lines at the steps' size) of the floor's pebble-wash a centimetre and a half down; a tread's
# stones run out over its riser's at the nosing, a riser's run to its corners, an end's stop behind them. And moss where a step is shaded
# and damp, not where it's walked: a cushion along the back corner of each tread toward its ends, along the lower step's foot by the street,
# along the foot of each end; never a pad stuck on a face (they read as stickers); in the joints round it (the pebble-wash greened there) and
# creeping a little onto the stones round it (their colour greened at their edges), a little
# in the pebble-wash's cement all over. Each step one node of three materials: the stones, the pebble-wash, the moss.)
RS = np.random.default_rng(424)
SJ = 0.005               # half a joint
RECESS = 0.014           # the pebble-wash this far under the stones' crowns
SK = 0.016               # a stone's thickness, its crown to its foot in the pebble-wash
OVER = 0.002             # a tread's front stones this far out over its riser's crowns
S_RINGS = (0.0, 0.0025, 0.005, 0.009, 0.028)
S_ROUND = 0.009
S_DOME = 0.004
GREEN = (0.55, 0.76, 0.36)   # what moss does to a stone's colour where it creeps onto it
MOSS_TINT = (0.46, 0.70, 0.26)  # ...and to the pebble-wash's

# (the genkan floor's own granite (blender/genkanfloor.py's, the same recipe), for the stones)
N1 = 1024
gr = mix((0.60, 0.58, 0.55), (0.47, 0.455, 0.43), fbm(N1, 5, 5, 5))
for cells_, thr, col_, k_ in ((420, 0.80, (0.08, 0.08, 0.09), 0.9), (300, 0.84, (0.80, 0.79, 0.76), 0.7), (240, 0.86, (0.52, 0.40, 0.35), 0.6),
                              (520, 0.78, (0.24, 0.24, 0.25), 0.55)):
    gr = mix(gr, col_, smooth(thr, thr + 0.04, vnoise(N1, cells_, cells_)) * k_)
vein_ = np.abs(fbm(N1, 3, 7, 5) - 0.5)
gr = mix(gr, (0.36, 0.355, 0.35), smooth(0.03, 0.0, vein_) * 0.35)
gr = gr * (0.93 + 0.1 * fbm(N1, 8, 8, 4))[..., None]
gh_ = fbm(N1, 64, 64, 3) * 0.6 + fbm(N1, 6, 6, 4) * 0.4
gh_ = gh_ - smooth(0.8, 0.86, vnoise(N1, 420, 420)) * 0.25
# (the floor's pebble-wash, its cement a shade lighter (the dark joints read as coarse lines in the street's light), moss in the cement here
# and there: green where it's damp, the pebbles standing out of it)
M2_ = 512
yy_, xx_ = np.mgrid[0:M2_, 0:M2_].astype(np.float32)
cem = mix((0.27, 0.26, 0.24), (0.33, 0.32, 0.30), fbm(M2_, 8, 8, 4))
mossy = smooth(0.5, 0.72, fbm(M2_, 4, 4, 4)) * (0.6 + 0.4 * fbm(M2_, 30, 30, 3))
cem = mix(cem, (0.17, 0.24, 0.08), mossy * 0.75)
peb_ = cem.copy()
ph_ = np.zeros((M2_, M2_), np.float32)
for _ in range(1500):
    r_ = RS.uniform(3.0, 6.5)
    cx_, cy_ = RS.uniform(0, M2_, 2)
    tn = RS.random()
    c_ = np.array((0.07, 0.07, 0.075) if tn < 0.5 else (0.44, 0.43, 0.42) if tn < 0.86 else (0.84, 0.83, 0.80), np.float32) * RS.uniform(0.85, 1.15)
    for ox in (-M2_, 0, M2_):
        for oy in (-M2_, 0, M2_):
            px, py = cx_ + ox, cy_ + oy
            x0_, x1_ = int(max(0, px - r_ - 2)), int(min(M2_, px + r_ + 2))
            y0_, y1_ = int(max(0, py - r_ - 2)), int(min(M2_, py + r_ + 2))
            if x0_ >= x1_ or y0_ >= y1_:
                continue
            d_ = np.sqrt((xx_[y0_:y1_, x0_:x1_] - px) ** 2 + (yy_[y0_:y1_, x0_:x1_] - py) ** 2)
            m_ = np.clip((r_ - d_) / 1.2, 0, 1)
            dm_ = np.clip(1 - (d_ / r_) ** 2, 0, 1)
            peb_[y0_:y1_, x0_:x1_] = peb_[y0_:y1_, x0_:x1_] * (1 - m_[..., None]) + (c_ * (0.75 + 0.35 * dm_)[..., None]) * m_[..., None]
            ph_[y0_:y1_, x0_:x1_] = np.maximum(ph_[y0_:y1_, x0_:x1_], dm_ * m_)
# (moss: a velvet of dark and yellow-green, its tips catching the light in fine specks, clumped)
M4_ = 512
mo = mix((0.13, 0.20, 0.05), (0.32, 0.42, 0.10), fbm(M4_, 6, 6, 5))
tips = smooth(0.80, 0.9, vnoise(M4_, 150, 150))
mo = mix(mo, (0.52, 0.60, 0.20), tips * 0.6)
mo = mo * (0.7 + 0.4 * fbm(M4_, 26, 26, 3))[..., None]
mh_ = fbm(M4_, 40, 40, 3) * 0.5 + vnoise(M4_, 150, 150) * 0.5
STEP_M = [pbr("StepStone", (1, 1, 1), tex=image("step_granite", np.clip(gr, 0, 1).astype(np.float32)),
              nrm=image("step_granite_nrm", to_normal(gh_, 3.0).astype(np.float32), data=True), nrm_strength=0.6, rough=0.7),
          pbr("StepPebble", (1, 1, 1), tex=image("step_pebbles", np.clip(peb_, 0, 1).astype(np.float32)),
              nrm=image("step_pebbles_nrm", to_normal(ph_, 2.5).astype(np.float32), data=True), nrm_strength=0.8, rough=0.85),
          pbr("StepMoss", (1, 1, 1), tex=image("step_moss", np.clip(mo, 0, 1).astype(np.float32)),
              nrm=image("step_moss_nrm", to_normal(mh_, 4.0).astype(np.float32), data=True), nrm_strength=1.0, rough=0.95)]


# ---- convex polygons in a face's (a, b)
def ccw2(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if a > 0 else poly[::-1]


def clip2(poly, a, b, c):
    """the part of a convex polygon where a*x + b*y <= c (blender/genkanfloor.py's clip)"""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def inset2(poly, d):
    """a convex polygon (counter-clockwise) with each edge moved in by d (blender/genkanfloor.py's inset)"""
    out, lines = [], []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        ex, ez = q[0] - p[0], q[1] - p[1]
        L_ = math.hypot(ex, ez) or 1e-9
        lines.append((p[0] - ez / L_ * d, p[1] + ex / L_ * d, ex, ez))
    for i in range(n):
        x1, z1, dx1, dz1 = lines[i - 1]
        x2, z2, dx2, dz2 = lines[i]
        den = dx1 * dz2 - dz1 * dx2
        if abs(den) < 1e-12:
            out.append((x2, z2))
            continue
        t = ((x2 - x1) * dz2 - (z2 - z1) * dx2) / den
        out.append((x1 + dx1 * t, z1 + dz1 * t))
    return out


def paving(a0, a1, b0, b1, md):
    """a face's crazy paving in its rect (a0..a1, b0..b1): seeds a jittered spread, none nearer another than md; each one's cell less half a
    joint all round (half a joint in from the rect's edges: pass an edge out by SJ where its stones run flush to it); corners nearer than
    1.2 cm merged"""
    want = max(1, int(round((a1 - a0) * (b1 - b0) / (md * md * 0.85))))
    seeds, tries = [], 0
    while len(seeds) < want and tries < 5000:
        tries += 1
        p = (RS.uniform(a0, a1), RS.uniform(b0, b1))
        if all(math.hypot(p[0] - q[0], p[1] - q[1]) > md for q in seeds):
            seeds.append(p)
    rect = [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]
    out = []
    for i, s in enumerate(seeds):
        cell = rect
        for j, q in enumerate(seeds):
            if i == j:
                continue
            a, b = q[0] - s[0], q[1] - s[1]
            cell = clip2(cell, a, b, (q[0] ** 2 + q[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2 - SJ * math.hypot(a, b))
            if len(cell) < 3:
                break
        if len(cell) < 3:
            continue
        for a, b, c in ((-1, 0, -(a0 + SJ)), (1, 0, a1 - SJ), (0, -1, -(b0 + SJ)), (0, 1, b1 - SJ)):
            cell = clip2(cell, a, b, c)
        merged = []
        for p in cell:
            if not merged or math.hypot(p[0] - merged[-1][0], p[1] - merged[-1][1]) > 0.012:
                merged.append(p)
        if len(merged) > 3 and math.hypot(merged[0][0] - merged[-1][0], merged[0][1] - merged[-1][1]) < 0.012:
            merged.pop()
        if len(merged) >= 3:
            out.append(merged)
    return out


def drop2(e, rnd):
    """how far down a stone's face lies `e` in from its edge: a quarter circle of radius rnd (blender/genkanfloor.py's drop_at)"""
    if e >= rnd:
        return 0.0
    t = 1.0 - e / rnd
    return rnd * (1.0 - math.sqrt(max(0.0, 1.0 - t * t)))


# (a face's frame: (a, b) across it, h out of it, to the game's (x, y, z))
FR = {"top": lambda a, b, h: (a, h, b), "front": lambda a, b, h: (a, b, h),
      "right": lambda a, b, h: (h, b, a), "left": lambda a, b, h: (-h, b, a)}
OUT = {"top": (0, 1, 0), "front": (0, 0, 1), "right": (1, 0, 0), "left": (-1, 0, 0)}


def gv(p):
    return P(*p)


class Mossy:
    """where a step's moss is (its cushions' corner lines, in the step's frame): how mossy a point is there (0..1),
    for the stones' and the pebble-wash's colour round it; and a little toward its ends"""
    def __init__(self, W):
        self.lines, self.W = [], W

    def at(self, x, y, z):
        m = 0.0
        q = Vector((x, y, z))
        for p0, p1, r in self.lines:
            a, b = Vector(p0), Vector(p1)
            t = max(0.0, min(1.0, (q - a).dot(b - a) / max(1e-9, (b - a).length_squared)))
            d = (q - (a + (b - a) * t)).length
            m = max(m, min(1.0, max(0.0, 1.0 - (d - r * 1.2) / 0.05)))
        m = max(m, 0.3 * min(1.0, max(0.0, (abs(x) - (self.W / 2 - 0.1)) / 0.1)))
        return m


def stone(bm, L, poly, face, crown, tint, moss, rnd=S_ROUND, rings=S_RINGS, dome=S_DOME, thick=SK):
    """a stone on a face, as the genkan floor's pillow(): its outline (convex, in the face's a, b), its crown `crown` out of the face (a
    little domed toward its middle, a hair tilted), its edge rounded off (`rnd`), its sides straight in to its foot `thick` under the crown;
    its picture laid on it from the face (world size, its own place in it), its colour its tint, greened at its edge where moss is near"""
    fr, out = FR[face], Vector(gv(OUT[face]))
    poly = ccw2(poly)
    n = len(poly)
    ca, cb = sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n
    rad = max(math.hypot(p[0] - ca, p[1] - cb) for p in poly) or 1
    tilt = (RS.uniform(-0.003, 0.003), RS.uniform(-0.003, 0.003))
    base = crown - dome - 0.0006
    rs_ = [poly]
    for e in rings[1:]:
        r = inset2(poly, e)
        ok = len(r) == n and all((r[(i + 1) % n][0] - r[i][0]) * (poly[(i + 1) % n][0] - poly[i][0])
                                 + (r[(i + 1) % n][1] - r[i][1]) * (poly[(i + 1) % n][1] - poly[i][1]) > 1e-9 for i in range(n))
        if not ok:
            break
        rs_.append(r)
    info = {}

    def vert(a, b, h, ring):
        g = fr(a, b, h)
        v = bm.verts.new(gv(g))
        info[v] = (a, b, h, g, ring)
        return v
    ring_v = [[vert(a, b, base + dome * (1 - (math.hypot(a - ca, b - cb) / rad) ** 2) + tilt[0] * (a - ca) + tilt[1] * (b - cb) - drop2(rings[k], rnd), k)
               for a, b in r] for k, r in enumerate(rs_)]
    foot_v = [vert(a, b, crown - thick, 0) for a, b in poly]
    sides, tops = [], []
    for i in range(n):
        j = (i + 1) % n
        sides.append(bm.faces.new((foot_v[i], foot_v[j], ring_v[0][j], ring_v[0][i])))
        for k in range(len(rs_) - 1):
            tops.append(bm.faces.new((ring_v[k][i], ring_v[k][j], ring_v[k + 1][j], ring_v[k + 1][i])))
    tops += ladder_fill(bm, ring_v[-1])
    cen = Vector(gv(fr(ca, cb, crown - thick / 2)))
    tile, off = 0.65, (RS.random(), RS.random())
    for f in sides + tops:
        f.normal_update()
        if f in tops:
            want = f.normal.dot(out) > 0
        else:
            c = f.calc_center_median() - cen
            c = c - out * c.dot(out)
            want = f.normal.dot(c) > 0
        if not want:
            f.normal_flip()
        f.material_index = 0
        f.smooth = True
        for lp in f.loops:
            a, b, h, g, ring = info[lp.vert]
            if f in tops:
                lp[L["uv"]].uv = (a / tile + off[0], b / tile + off[1])
            else:
                lp[L["uv"]].uv = ((a + b) / tile + off[0], h / tile * 3 + off[1])
            m = moss.at(*g) * (1.0, 0.85, 0.55, 0.3, 0.15)[min(ring, 4)]
            lp[L["col"]] = (*(tint[i_] * (1 - m * (1 - GREEN[i_])) for i_ in range(3)), 1.0)
    return len(sides) * 2 + sum(len(f.verts) - 2 for f in tops)


def mortar(bm, L, lo, hi, moss, tile=0.25, cell=0.06):
    """the pebble-wash's block from lo to hi (the game's x, y, z), its faces' picture laid at world size; each face that shows a coarse grid
    (`cell`), its points greened where moss is (the joints there mossy), the back and the foot one quad"""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    mid = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    tris = 0
    # (each face: its fixed axis and value, its two axes across it, and whether it shows)
    for ax, val, (ua, u0, u1), (va, v0, v1), shows in (("z", z1, ("x", x0, x1), ("y", y0, y1), True), ("z", z0, ("x", x0, x1), ("y", y0, y1), False),
                                                       ("y", y1, ("x", x0, x1), ("z", z0, z1), True), ("y", y0, ("x", x0, x1), ("z", z0, z1), False),
                                                       ("x", x1, ("z", z0, z1), ("y", y0, y1), True), ("x", x0, ("z", z0, z1), ("y", y0, y1), True)):
        nu = max(1, int(round((u1 - u0) / cell))) if shows else 1
        nv = max(1, int(round((v1 - v0) / cell))) if shows else 1

        def at(i, j):
            g = {ax: val, ua: u0 + (u1 - u0) * i / nu, va: v0 + (v1 - v0) * j / nv}
            return (g["x"], g["y"], g["z"])
        vs = [[bm.verts.new(gv(at(i, j))) for j in range(nv + 1)] for i in range(nu + 1)]
        out = Vector(gv(tuple((1.0 if k == ax else 0.0) * (1 if val > mid["xyz".index(ax)] else -1) for k in "xyz")))
        for i in range(nu):
            for j in range(nv):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
                f.normal_update()
                if f.normal.dot(out) < 0:
                    f.normal_flip()
                f.material_index = 1
                for lp in f.loops:
                    co = lp.vert.co
                    gx, gy, gz = co.x, co.z, -co.y
                    lp[L["uv"]].uv = {"z": (gx / tile, gy / tile), "y": (gx / tile, gz / tile), "x": (gz / tile, gy / tile)}[ax]
                    m = min(1.0, moss.at(gx, gy, gz) * 1.2) if shows else 0.0
                    lp[L["col"]] = (*(1 - m * (1 - MOSS_TINT[k]) for k in range(3)), 1.0)
                tris += 2
    return tris


def cushion(bm, L, p0, p1, nf, nw, r, tone):
    """moss in a corner (its line from p0 to p1, the game's x, y, z), between a floor (its normal nf) and a wall (its normal nw): a cushion
    bulging out of the corner, rounder in its middle and thinning to its ends, lumpy, its crest wandering; its two ends closed (ladders)"""
    p0, p1, nf, nw = Vector(p0), Vector(p1), Vector(nf), Vector(nw)
    segs = max(4, int((p1 - p0).length / 0.014))
    rows = []
    for i in range(segs + 1):
        t = i / segs
        rr = r * (0.2 + 0.8 * math.sin(math.pi * t) ** 0.7) * RS.uniform(0.82, 1.18)
        c = p0 + (p1 - p0) * t
        row = []
        for k in range(5):
            th = (math.pi / 2) * k / 4
            q = rr * RS.uniform(0.78, 1.22) if 0 < k < 4 else rr
            row.append(bm.verts.new(gv(tuple(c + (nf * math.cos(th) + nw * math.sin(th)) * q))))
        rows.append(row)
    corner = [bm.verts.new(gv(tuple(p))) for p in (p0, p1)]
    faces = []
    for i in range(segs):
        for k in range(4):
            faces.append(bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k])))
    ends = ladder_fill(bm, [corner[0]] + rows[0]) + ladder_fill(bm, [corner[1]] + rows[-1][::-1])
    mid = Vector(gv(tuple((p0 + p1) / 2)))
    out = Vector(gv(tuple(nf + nw))).normalized()
    for f in faces + ends:
        f.normal_update()
        want = f.normal.dot(out) > -0.2 if f in faces else f.normal.dot(f.calc_center_median() - mid) > 0
        if not want:
            f.normal_flip()
        f.material_index = 2
        f.smooth = True
        for lp in f.loops:
            co = lp.vert.co
            gx, gy, gz = co.x, co.z, -co.y
            lp[L["uv"]].uv = (gx / 0.09, (gy + gz) / 0.09)
            lp[L["col"]] = (tone, tone, tone, 1.0)
    return sum(len(f.verts) - 2 for f in faces + ends)


def tint_of():
    return TINTS[int(RS.integers(0, len(TINTS) - 1))] if RS.random() > 0.2 else TINTS[-1]


def build_step(name):
    """one of the steps (or the band over them): its stones face by face, its pebble-wash block, its moss; one node, three materials"""
    W, H, D = SLABS[name]
    bm = bmesh.new()
    L = {"uv": bm.loops.layers.uv.new("UVMap"), "col": bm.loops.layers.color.new("Col")}
    moss = Mossy(W)
    tris = {"stone": 0, "mortar": 0, "moss": 0}
    if name == "StoneStep0":
        # (the band: one face, its stones on edge, thin (the band's 1.2 cm): smaller rounding, its pebble-wash a plate behind them)
        moss.lines.append(((-W / 2 + 0.02, -H / 2 - 0.002, D / 2), (-W / 2 + 0.12, -H / 2 - 0.002, D / 2), 0.008))
        for poly in paving(-W / 2, W / 2, -H / 2, H / 2, 0.15):
            tris["stone"] += stone(bm, L, poly, "front", D / 2, tint_of(), moss, rnd=0.005, rings=(0.0, 0.0015, 0.003, 0.005, 0.016), dome=0.002, thick=0.0105)
        tris["mortar"] += mortar(bm, L, (-W / 2, -H / 2, -D / 2), (W / 2, H / 2, -D / 2 + 0.004), moss)
    else:
        upper = name == "StoneStep1"
        # (where the tread's back corner is: the band's face over the upper step, 1.15 cm in from the step's back; the upper step's riser
        # over the lower, 2 mm behind it; how high up its riser shows (the upper's lower half is behind the lower step))
        wall = -D / 2 + (0.0125 if upper else 0.0)
        r_lo = -0.006 if upper else -H / 2
        fy = H / 2 - 0.006
        # (the moss: cushions in the tread's back corner toward its ends, the lower step's along its foot by the street toward its ends,
        # each step's along the foot of its two ends)
        # (the street's paving 8 mm under a step's foot, measured)
        gnd = -H / 2 - 0.008
        UP, OUTZ, RX, LX = (0, 1, 0), (0, 0, 1), (1, 0, 0), (-1, 0, 0)
        if upper:
            cush = [((-W / 2 + 0.004, fy, wall), (-W / 2 + 0.24, fy, wall), UP, OUTZ, 0.016),
                    ((W / 2 - 0.18, fy, wall), (W / 2 - 0.004, fy, wall), UP, OUTZ, 0.014)]
        else:
            cush = [((-W / 2 + 0.004, fy, wall), (-W / 2 + 0.21, fy, wall), UP, OUTZ, 0.017),
                    ((W / 2 - 0.15, fy, wall), (W / 2 - 0.004, fy, wall), UP, OUTZ, 0.014),
                    ((-W / 2 + 0.43, fy, wall), (-W / 2 + 0.52, fy, wall), UP, OUTZ, 0.009),
                    # (along its foot by the street, against the riser's stones, toward its ends)
                    ((-W / 2 + 0.002, gnd, D / 2), (-W / 2 + 0.17, gnd, D / 2), UP, OUTZ, 0.015),
                    ((W / 2 - 0.25, gnd, D / 2), (W / 2 - 0.03, gnd, D / 2), UP, OUTZ, 0.012)]
        # (and at the foot of each end, along it, against its stones)
        cush += [((W / 2, gnd, -D / 2 + 0.02), (W / 2, gnd, D / 2 - 0.03), UP, RX, 0.013),
                 ((-W / 2, gnd, -D / 2 + 0.03), (-W / 2, gnd, D / 2 - 0.04), UP, LX, 0.012)]
        for p0, p1, nf, nw, r in cush:
            moss.lines.append((p0, p1, r))
        # (the tread: its stones flush to the ends and out over the riser at the nosing)
        for poly in paving(-W / 2 - SJ, W / 2 + SJ, -D / 2, D / 2 + OVER + SJ, 0.17):
            tris["stone"] += stone(bm, L, poly, "top", H / 2, tint_of(), moss)
        # (the riser: to the corners, a joint under the tread's stones)
        for poly in paving(-W / 2 - SJ, W / 2 + SJ, r_lo, H / 2 - SK - SJ, 0.16):
            tris["stone"] += stone(bm, L, poly, "front", D / 2, tint_of(), moss)
        # (the ends: from the step's back to behind the riser's stones, from its foot to under the tread's)
        for face in ("right", "left"):
            for poly in paving(-D / 2 - SJ, D / 2 - SK - SJ, -H / 2, H / 2 - SK - SJ, 0.12):
                tris["stone"] += stone(bm, L, poly, face, W / 2, tint_of(), moss)
        # (the pebble-wash's block: where the stones are, a recess under their crowns; the upper step's lower front (behind the lower
        # step) flush)
        if upper:
            tris["mortar"] += mortar(bm, L, (-W / 2 + RECESS, -0.012, -D / 2), (W / 2 - RECESS, H / 2 - RECESS, D / 2 - RECESS), moss)
            tris["mortar"] += mortar(bm, L, (-W / 2 + RECESS, -H / 2, -D / 2), (W / 2 - RECESS, -0.010, D / 2 - 0.004), moss)
        else:
            tris["mortar"] += mortar(bm, L, (-W / 2 + RECESS, -H / 2, -D / 2), (W / 2 - RECESS, H / 2 - RECESS, D / 2 - RECESS), moss)
        for p0, p1, nf, nw, r in cush:
            tris["moss"] += cushion(bm, L, p0, p1, nf, nw, r * 1.2, RS.uniform(0.85, 1.0))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for m in STEP_M:
        o.data.materials.append(m)
    parts.append(o)
    print("STEP424", name, tris)
    return o


s1 = build_step("StoneStep1")
s2 = build_step("StoneStep2")
s0 = build_step("StoneStep0")

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
