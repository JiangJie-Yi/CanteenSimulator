"""The raw potatoes and sweet potatoes in their sacks (produce.glb, node "ProduceSacks"), after the photoscanned sack of potatoes the owner
pointed to (looked at, nothing taken from it): three burlap sacks standing upright against the kitchen side of the bar, full to the brim,
open (the owner's, 2026-11-10: they looked like barrels, or paper tubes wrapped in white cloth): heavy at the foot, slumped and bulging out,
drawn in a little at the waist, lumpy all over where what's inside presses the cloth out; their mouths rolled down outward into a thick soft
cuff, what's in them heaped up out of it, a few leaning on the cuff; a seam with its flap down the front; no woven bands (the sweet potatoes'
tied round instead with a rough jute twine, its ends hanging); the weave coarse, pressed in (a normal map), and grimy toward the foot (one of
potatoes, one of sweet potatoes, one of onions); a few have rolled out onto the floor in front.

And the sack of binchotan (node "CharcoalSack") that stands on the floor by the cook table, its crate on the table filled from it: the same
sack in a darker cloth, a band of black stripes and a red stamp printed on it, the sticks standing up out of its mouth ("CharcoalStick0".."13":
the game shows as many as the sack has left).

The game's frame, in the room's units: y up, the sacks along x (about 1.1 across), their backs to -z, the middle of their foot at the
origin; the charcoal sack on its own, its foot's middle at the origin.

Run:
    blender -b --factory-startup --python blender/produce.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403
from tubers import potato, potato_skin, sweet_potato, sweet_potato_skin  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
seed(7)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)


def weave_of(S=1024, f=150):
    """burlap's coarse plain weave: thick threads over and under, uneven; each thread's own shade along it; and its relief, the threads on
    top at each crossing standing proud, the gaps between sunk (made once: every sack's burlap is woven the same, its colour its own)"""
    u, v = grid01(S)
    wob = (fbm(S, 4, 4) - 0.5) * 0.35
    wx, wy = np.abs(np.sin(np.pi * (u * f + wob))), np.abs(np.sin(np.pi * (v * f + wob * 0.7)))
    over = (np.floor(u * f + wob) + np.floor(v * f + wob * 0.7)) % 2
    tone = np.where(over > 0, vnoise(S, 3, f), vnoise(S, f, 3))
    gaps = smooth(0.02, 0.32, np.minimum(wx, wy))
    relief = np.where(over > 0, 0.45 + 0.55 * wx, 0.45 + 0.55 * wy) * (0.55 + 0.45 * gaps)
    return {"S": S, "u": u, "v": v, "f": f, "wx": wx, "wy": wy, "over": over, "tone": tone, "gaps": gaps, "relief": relief}


WEAVE = weave_of()
# (the cross-weave pressed in: the produce sacks' normal map, one for the three, their weave the same)
WEAVE_N = image("produce_weave_n", to_normal(WEAVE["relief"], 1.4), data=True)


def burlap(name, band=None, base=("#7e5f3a", "#d2b07c"), stripes=False, creases=True, nrm=None):
    """burlap: the weave (WEAVE) flecked, a little hairy; grimier toward the foot, and (`creases`) in the creases round its upper part (where
    v is 0.55, 0.7, 0.83 up it); `band` a colour woven round it near the top; `stripes` three black bands printed round it and a red stamp
    (the charcoal's); `nrm` its relief"""
    S, u, v, f = WEAVE["S"], WEAVE["u"], WEAVE["v"], WEAVE["f"]
    wx, wy, over, tone, gaps = WEAVE["wx"], WEAVE["wy"], WEAVE["over"], WEAVE["tone"], WEAVE["gaps"]
    # (jute as it's woven (the owner's, 2026-11-11: the sacks nothing like sacks, a checkerboard in olive): each thread round, lighter along
    # its crown, its thickness uneven along it (slubs); between them only a narrow dark gap; the whole a warm tan, faded in broad soft patches,
    # loose fibres lying over it here and there, lighter than the cloth)
    thread = np.where(over > 0, 0.45 + 0.55 * wx, 0.45 + 0.55 * wy)
    slub = fbm(S, 5, 90)
    n = fbm(S, 6, 6)
    fleck = smooth(0.66, 0.82, fbm(S, 24, 24))
    col = mix(lin(base[0]), lin(base[1]), np.clip(thread * 0.42 + n * 0.3 + (tone - 0.5) * 0.18 + (slub - 0.5) * 0.25 + 0.12, 0, 1))
    col = mix(col, lin("#e6cfa2"), smooth(0.58, 0.82, fbm(S, 2, 2)) * 0.22)
    col = mix(col, lin("#4a3520"), fleck * 0.18)
    col *= (0.62 + 0.38 * smooth(0.0, 0.18, np.minimum(wx, wy) + 0.06))[..., None]
    hair = smooth(0.8, 0.95, vnoise(S, 7, 260)) * smooth(0.45, 0.7, fbm(S, 9, 9))
    hair = np.maximum(hair, smooth(0.82, 0.96, vnoise(S, 260, 7)) * smooth(0.5, 0.75, fbm(S, 11, 9)))
    col = mix(col, lin("#e8d2a8"), hair * 0.35)
    # (grime: up from the foot, and settled in the creases; blotches here and there)
    blot = fbm(S, 3, 3)
    grime = smooth(0.2, 0.0, v) * 0.4 + smooth(0.62, 0.9, blot) * 0.16
    for c in ((0.55, 0.7, 0.83) if creases else ()):
        # (only here and there along each crease, as a fold traps it)
        grime = grime + smooth(0.025, 0.0, np.abs(v - c - (fbm(S, 6, 2) - 0.5) * 0.05)) * 0.22 * smooth(0.35, 0.7, fbm(S, 7, 3))
    col *= (1 - np.clip(grime, 0, 0.7))[..., None]
    if band is not None:
        b = smooth(0.0, 0.012, 0.03 - np.abs(v - 0.72)) * np.where(over > 0, 1.0, 0.75)
        col = mix(col, lin(band) * (0.75 + 0.25 * thread)[..., None], b)
    if stripes:
        # (printed, so a little broken where the weave's high: three black bands round it, and a red stamp on its front)
        ink = np.zeros_like(u)
        for c in (0.36, 0.42, 0.48):
            ink = np.maximum(ink, smooth(0.012, 0.004, np.abs(v - c)))
        sx, sy = (u - 0.25) * 4.0, (v - 0.62) * 4.6
        ring = smooth(0.05, 0.0, np.abs(np.sqrt(sx * sx + sy * sy) - 0.32)) + smooth(0.32, 0.26, np.sqrt(sx * sx + sy * sy)) * smooth(0.06, 0.0, np.abs(sx))
        col = mix(col, lin("#141210"), np.clip(ink, 0, 1) * (0.55 + 0.45 * thread) * 0.9)
        col = mix(col, lin("#b3261e"), np.clip(ring, 0, 1) * (0.5 + 0.5 * thread) * 0.85)
    return pbr(name, (1, 1, 1), tex=image(name, col), nrm=nrm, rough=0.95)


# (the potatoes' and sweet potatoes' own skins, as dug: blender/tubers.py)
POTATO_SKIN, SWEET_SKIN = potato_skin(512), sweet_potato_skin(512)
M = {
    # (no bands woven round them (the owner's: stiff and too regular, like a barrel's hoops), no creases' grime round them; the weave pressed
    # in, the cloth rough (0.95))
    "sackP": burlap("ProduceSackPotato", creases=False, nrm=WEAVE_N),
    "sackS": burlap("ProduceSackSweet", creases=False, nrm=WEAVE_N),
    "sackO": burlap("ProduceSackOnion", creases=False, nrm=WEAVE_N),
    "potato": pbr("ProducePotato", (1, 1, 1), tex=image("produce_potato", POTATO_SKIN[0]), nrm=image("produce_potato_n", POTATO_SKIN[1], data=True), rough=0.85),
    "sweet": pbr("ProduceSweetPotato", (1, 1, 1), tex=image("produce_sweet", SWEET_SKIN[0]), nrm=image("produce_sweet_n", SWEET_SKIN[1], data=True), rough=0.55),
    # (a rough jute twine, earthy yellow)
    "tie": pbr("ProduceTwine", tuple(lin("#b58f52")), rough=0.95),
    "sackC": burlap("CharcoalSackCloth", base=("#4a3c2a", "#9a8460"), stripes=True),
    "inside": pbr("ProduceSackInside", tuple(lin("#2e2416")), rough=1.0),
    # (binchotan has a dull metallic sheen, near black)
    "coal": pbr("CharcoalSackStick", tuple(lin("#2a2a2e")), rough=0.45, metal=0.35),
}
parts = []


def mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def sack(name, cx, cz, h, r, mat, lean=(0.0, 0.0), seg=24, front=math.pi / 2, salt=0, inside=True):
    """a sack standing full, after the photoscan: a soft barrel from its slumped foot up to its mouth, shallow creases round the upper part
    where it was gathered (deeper on some sides than others), lumpy up top with what's in it; the cloth's edge at the mouth folded in over
    what's heaped there; a dark floor just inside, under what's heaped (no looking down into an empty sack); and a seam down the front (at
    angle `front`), a flap of the cloth standing proud of it. Cylindrical UVs, the weave running round it"""
    rnd = __import__("random").Random(salt + int(cx * 1000))
    ph = [rnd.uniform(0, 6.3) for _ in range(6)]
    # (heights up it: dense where the creases are, a fold at each)
    ts = [0.0, 0.04, 0.16, 0.32, 0.47, 0.53, 0.58, 0.67, 0.72, 0.8, 0.85, 0.92, 1.0]
    CREASES = ((0.555, 0.045), (0.705, 0.035), (0.835, 0.03))

    def radius(t, a):
        base = r * (0.9 + 0.1 * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.6)
        if t < 0.06:
            base *= 1.05 - 0.4 * (0.06 - t)            # (the foot slumped out under its weight, rounded under)
        for (tc, depth) in CREASES:
            d = (t - tc) / 0.022
            base -= r * depth * math.exp(-d * d) * (0.55 + 0.45 * math.sin(2 * a + ph[0] + tc * 9))
        # (what's inside pressing out, lumpy toward the top)
        base *= 1 + 0.035 * t * math.sin(3 * a + ph[1]) * math.cos(2 * a - ph[2] + t * 3)
        return base
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rows = []
    dx, dz = lean
    for k, t in enumerate(ts):
        y = h * t
        row = []
        for jn in range(seg):
            a = 2 * math.pi * jn / seg
            rr = radius(t, a) if t > 0 else radius(0.0, a) * 0.92
            row.append(bm.verts.new(P(cx + rr * math.cos(a) + dx * y, y, cz + rr * math.sin(a) + dz * y)))
        rows.append((row, t))
    # (the mouth: the cloth's edge rising a little, then folded in and down over what's heaped there)
    top_r = [radius(1.0, 2 * math.pi * jn / seg) for jn in range(seg)]
    for (rf, dy, tv) in ((0.97, 0.02, 1.04), (0.82, 0.026, 1.08), (0.7, 0.01, 1.12)):
        row = []
        for jn in range(seg):
            a = 2 * math.pi * jn / seg
            gather = 1 + 0.06 * math.sin(5 * a + ph[3]) * math.cos(2 * a + ph[4])
            rr = top_r[jn] * rf * gather
            y = h + dy * (0.8 + 0.4 * math.sin(3 * a + ph[5]) ** 2)
            row.append(bm.verts.new(P(cx + rr * math.cos(a) + dx * h, y, cz + rr * math.sin(a) + dz * h)))
        rows.append((row, tv))
    for k in range(len(rows) - 1):
        (r0, t0), (r1, t1) = rows[k], rows[k + 1]
        for jn in range(seg):
            j2 = (jn + 1) % seg
            f = bm.faces.new((r0[jn], r1[jn], r1[j2], r0[j2]))
            for loop, (jj, tt) in zip(f.loops, ((jn, t0), (jn, t1), (jn + 1, t1), (jn + 1, t0))):
                loop[uv].uv = (jj / seg * 2, tt * 1.4)
    # (its foot: closed across in a ladder facing down, not a fan into its middle)
    ladder_fill(bm, rows[0][0])
    o = mesh_object(name, bm, mat)
    # ---- the dark floor just inside the mouth, under what's heaped there (none where a heap fills it) ----
    bm = bmesh.new()
    if not inside:
        bm.free()
        return seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o)
    ring = [bm.verts.new(P(cx + top_r[jn] * 0.86 * math.cos(2 * math.pi * jn / seg) + dx * h, h - 0.012,
                           cz + top_r[jn] * 0.86 * math.sin(2 * math.pi * jn / seg) + dz * h)) for jn in range(seg)]
    bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        if fc.normal.z < 0:
            fc.normal_flip()
    mesh_object(name + "Inside", bm, "inside")
    return seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o)


def seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o):
    """the seam: a flap of the cloth standing proud down the front, from near the foot to the mouth"""
    dx, dz = lean
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    W, out = 0.012, 0.007
    strip = []
    for k, t in enumerate(ts):
        if t < 0.05:
            continue
        y = h * t
        a = front + 0.03 * math.sin(t * 7 + ph[0])
        rr = radius(t, a)
        nx, nz = math.cos(a), math.sin(a)
        tx, tz = -nz, nx
        base = Vector((cx + rr * nx + dx * y, y, cz + rr * nz + dz * y))
        lean_k = 0.5 + 0.5 * math.sin(t * 5 + ph[2])
        row = [bm.verts.new(P(*(base + Vector((tx * -W, 0, tz * -W)) - Vector((nx, 0, nz)) * 0.002))),
               bm.verts.new(P(*(base + Vector((tx * (W * 0.3), 0, tz * (W * 0.3))) + Vector((nx, 0, nz)) * out * (0.7 + 0.3 * lean_k)))),
               bm.verts.new(P(*(base + Vector((tx * W, 0, tz * W)) - Vector((nx, 0, nz)) * 0.002)))]
        strip.append((row, t))
    for k in range(len(strip) - 1):
        (a0, t0), (a1, t1) = strip[k], strip[k + 1]
        for i in range(2):
            f = bm.faces.new((a0[i], a0[i + 1], a1[i + 1], a1[i]))
            for loop, (ii, tt) in zip(f.loops, ((i, t0), (i + 1, t0), (i + 1, t1), (i, t1))):
                loop[uv].uv = (0.25 + ii * 0.02, tt)   # (a part of the cloth with nothing printed on it: KitchenStores' SACK_PRINT)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh_object(name + "Seam", bm, mat)
    return o


def open_sack(name, cx, cz, h, r, mat, lean=(0.0, 0.0), seg=24, front=math.pi / 2, salt=0, tie=False):
    """a sack standing full and open (the owner's, 2026-11-10: not a barrel, not a tube): heavy at its foot (its bottom third bulging out some
    12 per cent, slumped and rounded under on the floor), drawn in a little at its waist, a touch out of round, lumpy all over where what's
    inside presses the cloth out (more toward the top); its mouth rolled down outward into a thick soft cuff, uneven round it, its edge tucked
    back against the body under it; a dark floor just inside, under what's heaped there; a seam down the front; `tie`: a rough twine round its
    upper middle, drawing the cloth in a little, knotted, its two ends hanging. Returns it, its cuff's top all round (`rim`: the radius and
    height at each of its angles) and its mouth's own radius there"""
    rnd = __import__("random").Random(salt * 7919 + 13)
    ph = [rnd.uniform(0, 6.3) for _ in range(10)]
    # (what's inside pressing out: lumps a tuber across, here and there, more of them toward the top)
    # (2026-11-11, the owner's: more like an old burlap sack: the tubers pressing the cloth out harder, more of them)
    lumps = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(0.08, 0.95) ** 0.8, r * rnd.uniform(0.03, 0.06)) for _ in range(20)]
    TIE_T = 0.62

    def prof(t):
        # (only a little fuller low down: at 13 per cent its lower third bulged round like a belly (the owner's, 2026-11-11))
        f = 1 + 0.04 * math.exp(-((t - 0.22) / 0.2) ** 2) - 0.022 * math.exp(-((t - 0.55) / 0.13) ** 2) + 0.01 * math.exp(-((t - 0.86) / 0.1) ** 2)
        if t < 0.04:
            f *= 0.9 + 0.1 * (t / 0.04) ** 0.5            # (rounded under where it slumps on the floor)
        if tie:
            f *= 1 - 0.03 * math.exp(-((t - TIE_T) / 0.03) ** 2)
        return f

    def radius(t, a):
        base = r * prof(t) * (1 + 0.035 * math.cos(2 * a + ph[0]))
        # (out of round as a stuffed sack is, lopsided, its bulges wandering up it (the owner's, 2026-11-11: irregular))
        base *= 1 + 0.06 * math.sin(2 * a + ph[2] + 3 * t) + 0.04 * math.sin(3 * a + ph[4] - 2 * t)
        # (a sewn sack's foot, as an old burlap sack's (the owner's, 2026-11-11, a photo beside ours): its bottom seam runs across it from side to
        # side, so low down it's pressed flat into a long eye, drawn out to a point at each end of the seam, its left and right; the body itself
        # going out into its corners, the same cloth (they were cones stuck on); round again higher up, filled out)
        # (only at the very foot: higher it read as a bell; the point one vertex's, its neighbours only a little out)
        flat = math.exp(-(t / 0.09) ** 2)
        base *= (1 - 0.12 * flat) * (1 + 0.32 * flat * abs(math.cos(a - front - math.pi / 2)) ** 14)
        # (the cloth gathered into soft folds hanging down from under the cuff, deepest just under it, gone by the middle)
        base += r * 0.03 * smooth_(0.45, 0.95, t) * math.sin(9 * a + ph[7] + 1.5 * t) * (0.6 + 0.4 * math.sin(4 * a + ph[8]))
        for (la, lt, amp) in lumps:
            da = math.atan2(math.sin(a - la), math.cos(a - la))
            base += amp * math.exp(-(da / 0.33) ** 2 - ((t - lt) / 0.11) ** 2) * (0.35 + 0.65 * t)
        base += r * 0.008 * math.sin(5 * a + 7 * t + ph[1]) * math.cos(3 * a - 5 * t + ph[2])
        return base
    ts = [0.0, 0.025, 0.07, 0.14, 0.22, 0.31, 0.41, 0.51] + ([TIE_T - 0.02, TIE_T, TIE_T + 0.02] if tie else [0.6]) + [0.69, 0.78, 0.86, 0.93, 1.0]

    def smooth_(e0, e1, x):
        k = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
        return k * k * (3 - 2 * k)
    dx, dz = lean
    # (the ring of vertices turned a little so one falls on each corner's point: between two, the point came out rounded off)
    A0 = (front + math.pi / 2) % (2 * math.pi / seg)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rows = []

    def at(rr, a, y):
        # (its back pressed flat where it leans on the counter's face behind (the owner's, 2026-11-11: sunk in against the wall))
        return P(cx + rr * math.cos(a) + dx * y, y, max(WALL_Z, cz + rr * math.sin(a) + dz * y))
    # (the weave about as tall as it's wide round it, once up the body, so the picture's grimy foot is only at the sack's foot (at 1.4 times
    # up it the foot's grime came round again, a dark band three quarters up); the cuff back down the picture's clean part)
    for t in ts:
        y = h * t
        # (the corners' points lifted a little off the floor, as a stuffed sack's dog-ears stand)
        lift = lambda a_: 0.01 * math.exp(-(t / 0.05) ** 2) * abs(math.cos(a_ - front - math.pi / 2)) ** 14
        rows.append(([bm.verts.new(at(radius(t, (2 * math.pi * j / seg + A0)), (2 * math.pi * j / seg + A0), y + lift(2 * math.pi * j / seg + A0))) for j in range(seg)], [t * 0.9] * seg))
    # ---- the cuff: up from the mouth's edge, over, out and down, its edge tucked back under against the body
    # (rolled down unevenly, as a worn sack's mouth is: thick in one place, thin in another, its edge higher here and lower there)
    rc = [0.02 * (1 + 0.35 * math.sin(3 * a + ph[3]) + 0.15 * math.sin(7 * a + ph[4])) for a in ((2 * math.pi * j / seg + A0) for j in range(seg))]
    lip = [0.012 * math.sin(2 * a + ph[5]) + 0.007 * math.sin(5 * a + ph[6]) for a in ((2 * math.pi * j / seg + A0) for j in range(seg))]
    top = [radius(1.0, (2 * math.pi * j / seg + A0)) for j in range(seg)]
    PHI = [math.pi * k for k in (0.75, 0.5, 0.25, 0.0, -0.25, -0.5, -0.72, -0.92)]
    rim = []
    for k, phi in enumerate(PHI):
        row, vs = [], []
        for j in range(seg):
            a = (2 * math.pi * j / seg + A0)
            c = rc[j]
            rr = top[j] + c + 1.1 * c * math.cos(phi)
            y = h + lip[j] + 0.95 * c * math.sin(phi)
            row.append(bm.verts.new(at(rr, a, y)))
            vs.append(0.9 - (k + 1) * 0.04)
            if k == 1:
                rim.append((rr, y, a))
        rows.append((row, vs))
    for k in range(len(rows) - 1):
        (r0, v0), (r1, v1) = rows[k], rows[k + 1]
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm.faces.new((r0[j], r1[j], r1[j2], r0[j2]))
            for loop, (jj, vv) in zip(f.loops, ((j, v0[j]), (j, v1[j]), (j + 1, v1[j2]), (j + 1, v0[j2]))):
                loop[uv].uv = (jj / seg * 2, vv)
    ladder_fill(bm, rows[0][0])
    o = mesh_object(name, bm, mat)
    # ---- the dark floor just inside the mouth, under what's heaped there
    bm = bmesh.new()
    ring = [bm.verts.new(at(top[j] * 0.93, (2 * math.pi * j / seg + A0), h - 0.006)) for j in range(seg)]
    bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        if fc.normal.z < 0:
            fc.normal_flip()
    mesh_object(name + "Inside", bm, "inside")
    # ---- the seam, below the cuff
    # (down its side, toward the back, as a sack's is sewn: its front left for what's printed on it (the owner's, 2026-11-11))
    seam_of(name, cx, cz, h, r, mat, lean, front + math.pi * 0.62, [t for t in ts if t <= 0.92], radius, ph, o)
    # ---- the twine: round the waist, knotted at the front's side, its ends hanging
    if tie:
        y = h * TIE_T
        n = 16
        loop = [Vector((cx + (radius(TIE_T, a) + 0.007) * math.cos(a) + dx * y, y, cz + (radius(TIE_T, a) + 0.007) * math.sin(a) + dz * y))
                for a in (2 * math.pi * k / n for k in range(n))]
        tube_obj(name + "Twine", loop, 0.0055, "tie", cyclic=True)
        ka = front + 0.55
        kr = radius(TIE_T, ka) + 0.012
        knot = Vector((cx + kr * math.cos(ka) + dx * y, y, cz + kr * math.sin(ka) + dz * y))
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.012)
        for v_ in bm.verts:
            v_.co = Vector((v_.co.x * 1.25, v_.co.y * 0.9, v_.co.z * 0.8)) + Vector(P(*knot))
        mesh_object(name + "Knot", bm, "tie")
        out_ = Vector((math.cos(ka), 0.0, math.sin(ka)))
        side = Vector((-math.sin(ka), 0.0, math.cos(ka)))
        for s_, (hang, swing) in enumerate(((0.085, 0.012), (0.06, -0.016))):
            tail = [knot + side * swing * u + out_ * (0.006 + 0.01 * u) - Vector((0.0, hang * u, 0.0)) for u in (0.0, 0.35, 0.7, 1.0)]
            tube_obj(f"{name}TwineEnd{s_}", tail, 0.0045, "tie")
    return o, rim, top


def tube_obj(name, pts, rad, mat, cyclic=False, res=0):
    """a four-sided tube through points (the game's frame), its ends closed (`res` 1: eight-sided)"""
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = rad
    cd.bevel_resolution = res
    cd.use_fill_caps = not cyclic
    sp = cd.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    sp.use_cyclic_u = cyclic
    for spt, q in zip(sp.points, pts):
        spt.co = (*P(*q), 1)
    ob = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    ob.data.materials.clear()
    ob.data.materials.append(M[mat])
    for pg in ob.data.polygons:
        pg.use_smooth = True
    parts.append(ob)
    return ob


def world_bvh(objs):
    """the objects (and what hangs from them) as one tree, where they are now"""
    bpy.context.view_layer.update()
    verts, polys = [], []
    for o in objs:
        for ob in [o] + list(o.children_recursive):
            m = ob.matrix_world
            base = len(verts)
            verts += [m @ v.co for v in ob.data.vertices]
            polys += [[base + i for i in pg.vertices] for pg in ob.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def settle(o, cloth, step=0.003, most=0.08):
    """lifted until it's clear of the sack's cloth: resting on the cuff, or in the mouth, not through it; how far it went"""
    up = 0.0
    while cloth.overlap(world_bvh([o])) and up < most:
        o.location.z += step
        up += step
    return up


# ---- the tubers, as the Ebisu and the lucky cats are made (the owner's): a clean, coarse grid of quads with what a detailed one looks like baked
# onto it. (The real tubers were too many triangles; a picture painted for the heap, and then a shell laid over it with the heap baked on,
# didn't look right: a heap of potatoes is its potatoes' outlines.) A few of each kind are made twice from one seed, at full detail and as a
# coarse grid (the same shape, unwrapped the same way); the detailed one's skin and shape are baked onto the coarse one's own cell of a shared
# picture (its colour, and a normal map, so the room's light shades it as if it were round and shows its eyes and creases), and every tuber
# in the heaps and on the floor is one of these, turned and sized its own way.
TUBER_CELL = 256
TEMPLATES = [("potato", 11), ("potato", 23), ("potato", 37), ("potato", 41), ("sweet", 5), ("sweet", 17), ("sweet", 29)]
POTATO_SIZE, SWEET_SIZE = 0.057, 0.05


def to_srgb(c):
    """linear light (as Cycles bakes it) to the sRGB an 8-bit picture holds (as the skins it was baked from were painted)"""
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055).astype(np.float32)


def tuber_pair(kind, seed_, k):
    """a tuber twice from one seed: at full detail, and as a coarse grid of quads (12 round and 8 from pole to pole, a potato; 10 round and 10
    along, a sweet potato: coarser and their outlines showed corners close up); set apart from the others while they're baked"""
    out = []
    for detail in (True, False):
        name = f"Tuber{kind}{seed_}{'Hi' if detail else ''}"
        if kind == "potato":
            o = potato(name, M["potato"], size=POTATO_SIZE * 2.1, seed=seed_, seg=28 if detail else 12, rings=18 if detail else 8)
        else:
            o = sweet_potato(name, M["sweet"], length=SWEET_SIZE * 4.3, girth=SWEET_SIZE * 1.8, bend=0.1, seed=seed_,
                             rings=28 if detail else 10, around=18 if detail else 10)
        o.location = (k * 0.5, 3.0, 0.0)
        out.append(o)
    return out


def bake_tubers():
    """each template's detailed twin baked onto it (Cycles, selected to active): its colour and its normal map, in its cell of one picture"""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    try:
        sc.cycles.use_denoising = False
    except AttributeError:
        pass
    W, H = TUBER_CELL * 4, TUBER_CELL * 2
    col_img = bpy.data.images.new("TuberBakeColour", W, H, float_buffer=True)
    nrm_img = bpy.data.images.new("TuberBakeNormal", W, H, float_buffer=True)
    nrm_img.colorspace_settings.name = "Non-Color"
    bake = bpy.data.materials.new("TuberBake")
    bake.use_nodes = True
    node = bake.node_tree.nodes.new("ShaderNodeTexImage")
    bake.node_tree.nodes.active = node
    lows = {}
    for k, (kind, seed_) in enumerate(TEMPLATES):
        hi, lo = tuber_pair(kind, seed_, k)
        cx, cy = k % 4, k // 4
        for d in lo.data.uv_layers.active.data:
            d.uv = ((cx + 0.03 + d.uv.x * 0.94) / 4, (cy + 0.03 + d.uv.y * 0.94) / 2)
        lo.data.materials.clear()
        lo.data.materials.append(bake)
        bpy.context.view_layer.update()
        for img, kind_, kw in ((col_img, "DIFFUSE", {"pass_filter": {"COLOR"}}), (nrm_img, "NORMAL", {"normal_space": "TANGENT"})):
            node.image = img
            bpy.ops.object.select_all(action="DESELECT")
            hi.select_set(True)
            lo.select_set(True)
            bpy.context.view_layer.objects.active = lo
            sc.cycles.samples = 4
            bpy.ops.object.bake(type=kind_, use_selected_to_active=True, cage_extrusion=0.005, max_ray_distance=0.02, margin=6,
                                margin_type="EXTEND", use_clear=(k == 0), **kw)
        me = hi.data
        bpy.data.objects.remove(hi, do_unlink=True)
        bpy.data.meshes.remove(me)
        lows[(kind, seed_)] = lo
    col = to_srgb(np.array(col_img.pixels[:], np.float32).reshape(H, W, 4)[..., :3])
    nrm = np.array(nrm_img.pixels[:], np.float32).reshape(H, W, 4)[..., :3].copy()
    if os.environ.get("TUBER_DEBUG"):
        for nm, img in (("col", col_img), ("nrm", nrm_img)):
            img.filepath_raw = os.path.join(os.environ["TUBER_DEBUG"], f"tuber_{nm}.png")
            img.file_format = "PNG"
            img.save()
    bpy.data.images.remove(col_img)
    bpy.data.images.remove(nrm_img)
    mat = pbr("ProduceTuber", (1, 1, 1), tex=image("produce_tuber", col), nrm=image("produce_tuber_n", nrm, data=True), rough=0.8)
    for lo in lows.values():
        lo.data.materials.clear()
        lo.data.materials.append(mat)
    bpy.data.materials.remove(bake)
    print("TUBER_TRIS", {f"{k}{s_}": sum(len(p.vertices) - 2 for p in lo.data.polygons) for (k, s_), lo in lows.items()})
    return lows


LOWS = bake_tubers()
PLACED = {"potato": 0, "sweet": 0}


def tuber(name, x, y, z, size, kind, rot=(0.0, 0.0, 0.0)):
    """a potato or a sweet potato: one of the baked ones (each kind's in turn), its middle at (x, y, z), `size` as the old round ones were (a
    potato about twice it long, a sweet potato about four times), turned by `rot`"""
    ts = [t for t in TEMPLATES if t[0] == kind]
    t = ts[PLACED[kind] % len(ts)]
    PLACED[kind] += 1
    o = bpy.data.objects.new(name, LOWS[t].data)
    bpy.context.collection.objects.link(o)
    o.location = P(x, y, z)
    o.rotation_euler = rot
    o.scale = [size / (POTATO_SIZE if kind == "potato" else SWEET_SIZE)] * 3
    parts.append(o)
    return o


# ---- onions, carrots, burdock (the owner's: the sacks hold potatoes, onions and sweet potatoes; carrots and burdock in a crate beside them)
def skin_picture(name, base, dark, streaks, lined=0.5, n=256):
    """a vegetable's skin, u round it and v along it: `base` to `dark` in soft patches, `streaks` fine lines along it"""
    u, v = grid01(n)
    col = mix(lin(base), lin(dark), smooth(0.35, 0.75, fbm(n, 4, 6)))
    lines = smooth(0.85, 1.0, np.abs(np.sin((u * streaks + (fbm(n, 2, 3) - 0.5) * 2.0) * np.pi)))
    col = mix(col, lin(dark) * 0.75, lines * lined)
    return image(name, col)


M["onion"] = pbr("ProduceOnion", (1, 1, 1), tex=skin_picture("produce_onion", "#e6bc74", "#c08a48", 12, 0.25), rough=0.55)
M["onion_root"] = pbr("ProduceOnionRoot", tuple(lin("#b89a70")), rough=0.9)
M["carrot"] = pbr("ProduceCarrot", (1, 1, 1), tex=skin_picture("produce_carrot", "#ec7f2c", "#c55a16", 10), rough=0.6)
M["carrot_leaf"] = pbr("ProduceCarrotLeaf", tuple(lin("#4f8a34")), rough=0.7)
M["gobo"] = pbr("ProduceGobo", (1, 1, 1), tex=skin_picture("produce_gobo", "#a98355", "#7d5c36", 18), rough=0.85)
def crate_wood(n=512, tones=("#9a7448", "#c9a273"), salt=0):
    """an old produce crate's pine (the owner's, 2026-11-11: a better crate): planed boards gone grey-brown with use, the grain running
    along u, a knot or two, darker toward the board's ends and edges where it's handled and wet, and a nail's head in near each end"""
    u, v = grid01(n)
    warp = (fbm(n, 3, 2) - 0.5) * 0.15
    rings = np.sin((v + warp + 0.04 * np.sin(u * 6.0)) * 2 * np.pi * 9) * 0.5 + 0.5
    fine = vnoise(n, 3, 120)
    col = mix(lin(tones[0]), lin(tones[1]), smooth(0.2, 0.9, rings) * 0.7 + fine * 0.3)
    col = mix(col, lin("#7a6a58"), smooth(0.5, 0.85, fbm(n, 5, 4)) * 0.3)
    kn = np.hypot((u - 0.62 + 0.1 * salt) * 3.0, (v - 0.4) * 6.0)
    col = mix(col, lin("#5a3e22"), smooth(0.22, 0.06, kn) * 0.8)
    edge = np.minimum(np.minimum(u, 1 - u) * 6.0, np.minimum(v, 1 - v) * 10.0)
    col *= (0.72 + 0.28 * smooth(0.0, 1.0, edge))[..., None]
    for cu in (0.06, 0.94):
        nail = np.hypot((u - cu) * 40.0, (v - 0.5) * 22.0)
        col = mix(col, lin("#2e2a26"), smooth(1.0, 0.7, nail))
        col = mix(col, lin("#8a8580"), smooth(0.55, 0.2, nail) * 0.6)
    return col


M["crate"] = pbr("ProduceCrate", (1, 1, 1), tex=image("produce_crate", crate_wood()), rough=0.8)


def lathe_veg(name, prof, seg, mat):
    """a vegetable turned from `prof` [(radius, height)...] bottom to top, `seg` round, its ends closed (filled in rows on export, no fan to a
    centre point); u round it, v up it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rows = [[bm.verts.new((r * math.cos(2 * math.pi * j / seg), r * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)] for r, z in prof]
    for k in range(len(rows) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm.faces.new((rows[k][j], rows[k][j2], rows[k + 1][j2], rows[k + 1][j]))
            for l, (uu, vv) in zip(f.loops, ((j, k), (j + 1, k), (j + 1, k + 1), (j, k + 1))):
                l[uvl].uv = (uu / seg, vv / (len(rows) - 1))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def onion(name, x, y, z, size, rot=(0.0, 0.0, 0.0)):
    """a yellow onion: a squat ball drawn up into a pointed neck, a flat root end with a short tuft; `size` its radius; 12 round"""
    rnd = __import__("random").Random(name)
    sq = 0.82 + 0.1 * rnd.random()
    prof = [(0.25, -0.86), (0.62, -0.78), (0.9, -0.5), (1.0, -0.1), (0.94, 0.3), (0.7, 0.62), (0.36, 0.86), (0.12, 1.08), (0.04, 1.3)]
    o = lathe_veg(name, [(r * size, h * size * sq) for r, h in prof], 12, "onion")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    root = lathe_veg(name + "Root", [(0.22 * size, -0.95 * size * sq), (0.26 * size, -0.86 * size * sq)], 8, "onion_root")
    root.parent = o
    return o


def carrot(name, x, y, z, length, rot):
    """a carrot: a long taper from its shoulder to a thin tip, 8 round; three stalks of its leaves cut short above the shoulder"""
    r = length * 0.12
    prof = [(0.06 * r, -length * 0.5)] + [(r * (0.25 + 0.75 * t ** 0.7), -length * 0.5 + length * t) for t in (0.2, 0.45, 0.7, 0.9)]
    prof += [(r * 0.9, length * 0.5), (r * 0.5, length * 0.53)]
    o = lathe_veg(name, prof, 8, "carrot")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    for k in range(3):
        a = 2 * math.pi * k / 3
        bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=r * 0.12, depth=length * 0.35,
                                            location=(math.cos(a) * r * 0.25, math.sin(a) * r * 0.25, length * 0.53 + length * 0.16),
                                            rotation=(math.cos(a) * 0.25, math.sin(a) * 0.25, 0))
        lf = active()
        lf.name = f"{name}Leaf{k}"
        lf.data.materials.append(M["carrot_leaf"])
        lf.parent = o
        parts.append(lf)
    return o


def gobo(name, x, y, z, length, rot):
    """a burdock root: long and thin, a little thicker at its top, 6 round"""
    r = 0.012
    o = lathe_veg(name, [(r * 0.35, -length / 2), (r * 0.8, -length / 4), (r, 0.0), (r * 1.1, length / 4), (r * 1.15, length / 2)], 6, "gobo")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    return o


def board(name, cx, cy, cz, w, h, d):
    """one plank of the crate, its middle at (cx, cy, cz) in the game's frame, w along x, h up, d along z: its edges eased, the wood's
    picture laid along its longest side once (its grain along it, a nail near each end)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(cx, cy, cz))
    o = active()
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name
    m = o.modifiers.new("ease", "BEVEL")
    m.width = min(0.003, min(w, h, d) * 0.3)
    m.segments = 1
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.append(M["crate"])
    dims = sorted([(w, 0), (d, 1), (h, 2)], reverse=True)
    la, sa = dims[0][1], dims[1][1]
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            c = (co.x, co.y, co.z)
            ext = (w, d, h)
            uvl.data[li].uv = (c[la] / ext[la] + 0.5, c[sa] / ext[sa] + 0.5 if abs(poly.normal[sa]) < 0.5 else c[3 - la - sa] / ext[3 - la - sa] + 0.5)
    parts.append(o)
    return o


# ---- what fills each sack's mouth (the owner's, 2026-11-17: "too perfunctory": the open sacks showed their mouth as a flat dark disc, a few
# tubers laid on it): a low dome of quads across the mouth with a heap of that sack's tubers baked onto it (colour and normal map, as the
# tubers themselves are), the loose tubers still standing out of it. One mesh a sack ("ProducePotatoHeap", "ProduceSweetHeap",
# "ProduceOnionHeap"), for the game to hide with the rest of what's in the sack when there's none left ----
HEAP_TOP, HEAP_EDGE, HEAP_N, HEAP_PX = 0.04, -0.012, 10, 512
HEAP_REACH = 0.98                # (how far out toward the cloth, of the mouth's radius)
HEAP_NAMES = {"potato": "ProducePotatoHeap", "sweet": "ProduceSweetHeap", "onion": "ProduceOnionHeap"}


def drop(o):
    """a part made only to be baked from: out of the scene and the parts list, its children with it"""
    for c in list(o.children):
        drop(c)
    if o in parts:
        parts.remove(o)
    me = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    if me is not None and me.users == 0 and isinstance(me, bpy.types.Mesh):
        bpy.data.meshes.remove(me)


def heap_hi(kind, tx, tz, h, R, rnd):
    """the detailed heap to bake from: the tubers close-packed in a dome over the mouth (jittered rows, a little sunk, turned every way)"""
    out = []
    step = {"potato": 0.062, "sweet": 0.066, "onion": 0.058}[kind]
    n = int(R * 1.2 / step) + 1
    k = 0
    for gi in range(-n, n + 1):
        for gj in range(-n, n + 1):
            dx, dz = gi * step + rnd.uniform(-0.012, 0.012) + (0.5 * step if gj % 2 else 0.0), gj * step * 0.9 + rnd.uniform(-0.012, 0.012)
            rr = math.hypot(dx, dz) / R
            if rr > 1.15:
                continue
            y = h + HEAP_EDGE + (HEAP_TOP - HEAP_EDGE) * max(0.0, 1 - min(rr, 1.0) ** 2.2) ** 0.8 - 0.006
            at_ = P(tx + dx, y, tz + dz)
            if kind == "potato":
                o = potato(f"HeapHi{k}", M["potato"], size=0.057 * 2.1 * rnd.uniform(0.82, 1.0), seed=rnd.choice([11, 23, 37, 41]), seg=24, rings=16)
                o.rotation_euler = (rnd.uniform(0, 6.3), rnd.uniform(0, 6.3), rnd.uniform(0, 6.3))
            elif kind == "sweet":
                o = sweet_potato(f"HeapHi{k}", M["sweet"], length=0.05 * 4.3 * rnd.uniform(0.8, 1.0), girth=0.05 * 1.8, bend=0.1,
                                 seed=rnd.choice([5, 17, 29]), rings=22, around=16)
                o.rotation_euler = (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.35, 0.35), rnd.uniform(0, 6.3))
            else:
                o = onion(f"HeapHi{k}", 0, 0, 0, 0.044 * rnd.uniform(0.85, 1.0), rot=(rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.3)))
                for c in list(o.children):
                    drop(c)
                bpy.context.view_layer.objects.active = o
                o.modifiers.new("fine", "SUBSURF").levels = 1
                bpy.ops.object.modifier_apply(modifier="fine")
            o.location = at_
            if o not in out:
                out.append(o)
            k += 1
    return out


def bake_heap(name, hi, low, ground=(0.2, 0.12, 0.07)):
    """the heap's colour and normals baked from `hi` onto `low` (Cycles, selected to active), into pictures of their own; (colour, normal)"""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 4
    try:
        sc.cycles.use_denoising = False
    except AttributeError:
        pass
    S = HEAP_PX
    col_img = bpy.data.images.new(name + "Colour", S, S, float_buffer=True)
    nrm_img = bpy.data.images.new(name + "Normal", S, S, float_buffer=True)
    nrm_img.colorspace_settings.name = "Non-Color"
    # (a flat colour of the tubers' own (`ground`, linear) and a flat normal under them, for where a ray finds nothing)
    fill = np.zeros((S, S, 4), np.float32)
    fill[..., :3] = ground
    fill[..., 3] = 1
    col_img.pixels = fill.ravel()
    fill[..., :3] = (0.5, 0.5, 1.0)
    nrm_img.pixels = fill.ravel()
    bake = bpy.data.materials.new("HeapBake")
    bake.use_nodes = True
    node = bake.node_tree.nodes.new("ShaderNodeTexImage")
    bake.node_tree.nodes.active = node
    low.data.materials.clear()
    low.data.materials.append(bake)
    bpy.context.view_layer.update()
    for img, kind_, kw in ((col_img, "DIFFUSE", {"pass_filter": {"COLOR"}}), (nrm_img, "NORMAL", {"normal_space": "TANGENT"})):
        node.image = img
        bpy.ops.object.select_all(action="DESELECT")
        for o in hi:
            o.select_set(True)
        low.select_set(True)
        bpy.context.view_layer.objects.active = low
        bpy.ops.object.bake(type=kind_, use_selected_to_active=True, cage_extrusion=0.03, max_ray_distance=0.06, margin=8,
                            margin_type="EXTEND", use_clear=False, **kw)
    col = to_srgb(np.array(col_img.pixels[:], np.float32).reshape(S, S, 4)[..., :3])
    nrm = np.array(nrm_img.pixels[:], np.float32).reshape(S, S, 4)[..., :3].copy()
    bpy.data.images.remove(col_img)
    bpy.data.images.remove(nrm_img)
    bpy.data.materials.remove(bake)
    return col, nrm


def heap_of(kind, tx, tz, h, top, A0, cloth=None):
    """a sack's heap under the loose ones on top: real tubers (onions), close-packed across its mouth a little sunk, each one of the baked
    templates turned and sized its own way, lifted clear of the cloth; joined into one mesh for the game to hide with the rest when the sack's
    empty (item 314, the owner's, 2026-11-18: 「貼圖有點怪」「原本地瓜、馬鈴薯、洋蔥的貼圖還比較好看些」: a heap of tubers baked onto a dome over the
    mouth read as flat red shards and blotches, its colours off the tubers' own; a heap of potatoes is its potatoes' outlines, as e64b275e
    found trying a painted heap and a baked shell)"""
    rnd = __import__("random").Random(len(parts) * 17 + 3)
    seg = len(top)
    R = sum(top) / seg
    step = {"potato": 0.064, "sweet": 0.08, "onion": 0.064}[kind]
    keep = {"potato": 0.07, "sweet": 0.06, "onion": 0.055}[kind]
    n = int(R / step) + 1
    made = []
    k = 0
    for gi in range(-n, n + 1):
        for gj in range(-n, n + 1):
            dx = gi * step + (0.5 * step if gj % 2 else 0.0) + rnd.uniform(-0.01, 0.01)
            dz = gj * step * 0.88 + rnd.uniform(-0.01, 0.01)
            r = math.hypot(dx, dz)
            if r > R - keep:
                continue
            y = h + 0.002 + 0.02 * max(0.0, 1 - (r / R) ** 2)
            name = f"{HEAP_NAMES[kind]}Part{k}"
            if kind == "potato":
                o = tuber(name, tx + dx, y, max(WALL_Z + 0.04, tz + dz), 0.054 * rnd.uniform(0.9, 1.05), "potato",
                          rot=(rnd.uniform(0, 6.3), rnd.uniform(0, 6.3), rnd.uniform(0, 6.3)))
            elif kind == "sweet":
                o = tuber(name, tx + dx, y, max(WALL_Z + 0.04, tz + dz), 0.047 * rnd.uniform(0.9, 1.05), "sweet",
                          rot=(rnd.uniform(-0.2, 0.2), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.3)))
            else:
                o = onion(name, tx + dx, y, max(WALL_Z + 0.04, tz + dz), 0.041 * rnd.uniform(0.9, 1.05),
                          rot=(rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.3)))
            made.append(o)
            k += 1
    # (each its own copy (the templates' meshes are shared), lifted clear of the cloth as the loose ones are, the little roots of an onion with it)
    for o in made:
        if o.data.users > 1:
            o.data = o.data.copy()
        if cloth is not None:
            settle(o, cloth)
    every = []
    for o in made:
        every.append(o)
        for c in list(o.children):
            if c.type == "MESH":
                if c.data.users > 1:
                    c.data = c.data.copy()
                every.append(c)
    for o in every:
        if o in parts:
            parts.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in every:
        o.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    for o in every:
        if o.parent is not None:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    bpy.ops.object.join()
    heap = bpy.context.view_layer.objects.active
    heap.name = HEAP_NAMES[kind]
    heap.data.name = HEAP_NAMES[kind]
    parts.append(heap)
    print("HEAP", HEAP_NAMES[kind], len(made), "tubers, tris", sum(len(f.vertices) - 2 for f in heap.data.polygons))
    return heap


# ---- the three sacks, standing close together, a little apart at their cuffs; the middle one a step back ----
# (the counter's face behind them, in this frame (Decor's SACKS_AT puts it here): every sack's back pressed flat this side of it)
WALL_Z = -0.255
SACKS = [  # (x, z, height, radius, material, lean, what's in it)
    # (squatter than they were, as full sacks of potatoes sag (the owner's, 2026-11-11: not like vases))
    # (close together (the owner's, 2026-11-11): 0.39 apart, they were 0.43)
    # (half as tall again (the owner's, 2026-11-11): 0.41, 0.45, 0.38 before)
    # (fuller, 1.12 times as round (the owner's, 2026-11-11), a little further apart for it)
    (-0.405, -0.035, 0.615, 0.172, "sackP", (-0.02, -0.014), "potato"),
    (0.0, -0.04, 0.675, 0.181, "sackS", (0.006, -0.016), "sweet"),
    (0.4, -0.045, 0.57, 0.167, "sackO", (0.02, -0.012), "onion"),
]


def lean_out(a, tilt):
    """turned to lie along the way out of the sack at bearing `a` (the game's: from +x toward +z), tipped `tilt` down at its outer end (a
    tuber lies along its own x)"""
    return (0.0, tilt, -a)


for i, (x, z, h, r, mat, lean, kind) in enumerate(SACKS):
    front = math.pi / 2 + (i - 1) * 0.35
    body, rim, top = open_sack(f"ProduceSack{i}", x, z, h, r, mat, lean, front=front, salt=i, tie=(kind == "sweet"))
    cloth = world_bvh([o for o in parts if o.name.startswith(f"ProduceSack{i}") and "Inside" not in o.name])
    mouth = sum(top) / len(top)
    tx, tz = x + lean[0] * h, z + lean[1] * h
    heap = []
    # (what's in it, heaped up out of the cuff: a ring round inside the mouth at heights each its own, more on top, as full as a sack can
    # be; a couple at the front leaning out on the cuff)
    if kind == "potato":
        for k in range(7):
            a = 2 * math.pi * k / 7 + 0.3
            heap.append(tuber(f"ProducePotato{i}{k}", tx + mouth * 0.55 * math.cos(a), h + 0.012 + 0.01 * ((k * 3) % 4) / 3, tz + mouth * 0.55 * math.sin(a),
                              0.057, "potato", rot=(k * 0.7, k * 1.3 + a, k * 0.4)))
        for k, da in enumerate((-0.7, 0.75)):
            a = front + da
            heap.append(tuber(f"ProducePotatoEdge{i}{k}", tx + mouth * 0.84 * math.cos(a), h + 0.022, tz + mouth * 0.84 * math.sin(a), 0.056, "potato",
                              rot=lean_out(a, 0.35)))
        for k, (dx_, dz_, dy) in enumerate([(-0.035, -0.02, 0.0), (0.04, -0.015, 0.012), (0.0, 0.04, 0.006)]):
            heap.append(tuber(f"ProducePotatoTop{i}{k}", tx + dx_, h + 0.062 + dy, tz + dz_, 0.056, "potato", rot=(k * 1.1, k * 0.7, k * 0.9)))
    elif kind == "onion":
        for k in range(6):
            a = 2 * math.pi * k / 6 + i
            heap.append(onion(f"ProduceOnion{i}{k}", tx + mouth * 0.55 * math.cos(a), h + 0.018 + 0.008 * (k % 3) / 2, tz + mouth * 0.55 * math.sin(a), 0.045,
                              rot=(0.3 * math.cos(a), 0.3 * math.sin(a), k)))
        for k, da in enumerate((-0.75, 0.7)):
            a = front + da
            heap.append(onion(f"ProduceOnionEdge{i}{k}", tx + mouth * 0.86 * math.cos(a), h + 0.03, tz + mouth * 0.86 * math.sin(a), 0.043,
                              rot=(0.5 * math.sin(a), -0.5 * math.cos(a), k * 1.7)))
        for k, (dx_, dz_, dy) in enumerate([(-0.03, -0.02, 0.0), (0.035, 0.0, 0.008), (0.0, 0.04, 0.004)]):
            heap.append(onion(f"ProduceOnionTop{i}{k}", tx + dx_, h + 0.068 + dy, tz + dz_, 0.044, rot=(0.2 * k, -0.15 * k, k)))
    else:
        for k, (dx_, dz_, dy, a) in enumerate([(-0.06, -0.05, 0.0, 0.4), (0.07, 0.0, 0.012, -0.6), (-0.02, 0.07, 0.004, 1.2), (0.03, -0.02, 0.05, 0.1)]):
            heap.append(tuber(f"ProduceSweet{i}{k}", tx + dx_, h + 0.014 + dy, tz + dz_, 0.05, "sweet", rot=(0.0, 0.15 * k, a)))
        # (two at the front's sides: one laid out over the cuff, one stood up out of the heap against it)
        for k, (da, rr_, dy, tilt) in enumerate(((-0.6, 0.74, 0.03, 0.32), (0.85, 0.66, 0.05, -0.55))):
            a = front + da
            heap.append(tuber(f"ProduceSweetEdge{i}{k}", tx + mouth * rr_ * math.cos(a), h + dy, tz + mouth * rr_ * math.sin(a), 0.05, "sweet",
                              rot=lean_out(a, tilt)))
    # (each lifted till it's clear of the cloth: on the cuff, not through it)
    lifts = {o.name: round(settle(o, cloth), 3) for o in heap}
    print("SETTLED", i, {k_: v for k_, v in lifts.items() if v})
    # (and what's under them: the heap filling the mouth, so there's no flat dark disc to look down onto)
    heap_of(kind, tx, tz, h, top, (front + math.pi / 2) % (2 * math.pi / 24), cloth)


def sealed_sack(name, cx, cz, L, W, T, yaw, mat, salt=0, seg=16, NU=14, stand=False):
    """a sack of potatoes not yet opened (the owner's, 2026-11-11, after a photo of old burlap sacks), lying on the floor as it was set down:
    a pillow stuffed full, its ends sewn shut across into a thin flat lip, each end's two corners standing out in points (dog-ears), what's
    inside pressing the cloth out in lumps, slumped flat under its own weight where it lies. Along x (L long) before it's turned `yaw`, W across,
    T thick; its middle over (cx, cz), its underside on the floor. Its picture as the standing sacks': round it twice (u), along it (v).
    `stand`: stood up on its end instead (the owner's, 2026-11-11), its sewn end at the top, its foot settled flatter and wider under its
    weight, W across its front, T front to back"""
    rnd = __import__("random").Random(salt * 131 + 7)
    ph = [rnd.uniform(0, 6.3) for _ in range(6)]
    lumps = [(rnd.uniform(-0.8, 0.8), rnd.uniform(0, 2 * math.pi), rnd.uniform(0.06, 0.11)) for _ in range(16)]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    cy, sy = math.cos(yaw), math.sin(yaw)
    rows = []
    for i in range(NU + 1):
        u = -1 + 2 * i / NU
        # (full in its middle, drawn in to the sewn lip at its ends; the lip as wide as the sack, its corners drawn out a little further)
        pinch = max(0.06, (1 - abs(u) ** 5)) ** 0.55
        wide = 1 + 0.08 * abs(u) ** 8
        if stand:
            # (stood on it: its foot not sewn thin but settled, full and a little spread; its belly full; drawn in to shoulders up toward the
            # sewn top, whose two corners stand out past them)
            # (its top flat (the owner's, 2026-11-11): full nearly to the top, then closed quickly into the sewn edge, no sloping shoulders;
            # shut tight there, a thin seam (it stood a hand's width open at the top, and looked unsealed))
            pinch = max(0.7, (1 - abs(u) ** 6)) ** 0.4 if u < 0 else max(0.03, max(0.0, 1 - u ** 12) ** 0.3)
            wide = (1 + 0.05 * math.cos(u * math.pi / 2) + (0.08 * abs(u) ** 3 if u < 0 else 0)) * (1 - 0.06 * max(0.0, u - 0.6) / 0.4) + 0.12 * max(0.0, u) ** 16
        row = []
        for j in range(seg):
            th = 2 * math.pi * j / seg
            y = T / 2 * pinch * math.sin(th)
            # (slumped: flatter under, where it lies, than over)
            if y < 0 and not stand:
                y *= 0.6
            z = W / 2 * wide * math.cos(th) * (0.88 + 0.12 * pinch)
            # (the potatoes inside pressing it out here and there, more on top; a few soft creases across it)
            bump = sum(amp * math.exp(-((u - lu) / 0.22) ** 2 - (math.atan2(math.sin(th - lt), math.cos(th - lt)) / 0.6) ** 2) for lu, lt, amp in lumps)
            bump += 0.015 * math.sin(7 * u + ph[0] + 2 * th) * math.cos(3 * th + ph[1])
            k = 1 + bump * pinch
            x = L / 2 * u * (1 + 0.02 * math.sin(3 * th + ph[2]))
            lx, ly, lz = x, y * k, z * k
            if stand:
                # (up on its end: along it up, across it along x, its thickness front to back; turned yaw about up)
                X, Y, Z = lz, lx + L / 2, ly
                row.append(bm.verts.new(P(cx + X * cy - Z * sy, max(0.0, Y), max(WALL_Z, cz + X * sy + Z * cy))))
            else:
                row.append(bm.verts.new(P(cx + lx * cy - lz * sy, ly + T / 2 * 0.6, cz + lx * sy + lz * cy)))
        rows.append((row, (u + 1) / 2 * 0.9))
    for q in range(NU):
        (r0, v0), (r1, v1) = rows[q], rows[q + 1]
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm.faces.new((r0[j], r0[j2], r1[j2], r1[j]))
            for loop, (jj, vv) in zip(f.loops, ((j, v0), (j + 1, v0), (j + 1, v1), (j, v1))):
                loop[uv].uv = (jj / seg * 2, vv)
    # (the sewn ends closed across in a ladder)
    ladder_fill(bm, rows[0][0])
    ladder_fill(bm, rows[-1][0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


# ---- a sack of potatoes not yet opened, stood up on its end beside the open ones, at the potatoes' end (the owner's, 2026-11-11: it lay
# on the floor in front of them; stood up, clear of the counter's face behind) ----
sealed_sack("ProduceSackSealed", -0.81, -0.08, 0.75, 0.38, 0.3, -0.12, "sackP", salt=3, stand=True)
# ---- a few rolled out in front ----
tuber("ProduceLoose0", -0.22, 0.045, 0.29, 0.055, "potato", rot=(0.3, 0.2, 0.9))
# (a potato and an onion: the owner's)
onion("ProduceLooseOnion", 0.24, 0.044, 0.31, 0.044, rot=(1.4, 0.3, 0.6))
# ---- the stepped stand of six wooden baskets that stood beside the onions' sack is gone (the owner's, 2026-11-15: crossed out, and "take
# it" when asked); the summer vegetables are in the crate and the wicker basket in front of the sacks now (item 133) ----

M["tomato"] = pbr("ProduceTomato", tuple(lin("#c8261a")), rough=0.3, coat=0.5)
M["calyx"] = pbr("ProduceCalyx", tuple(lin("#3f7a2a")), rough=0.7)
M["cucumber"] = pbr("ProduceCucumber", tuple(lin("#2f6a24")), rough=0.5)
M["eggplant"] = pbr("ProduceEggplant", tuple(lin("#3a1438")), rough=0.25, coat=0.6)
M["piman"] = pbr("ProducePiman", tuple(lin("#2c7a1e")), rough=0.25, coat=0.5)
M["paprika_r"] = pbr("ProducePaprikaRed", tuple(lin("#c81e14")), rough=0.25, coat=0.5)
M["paprika_y"] = pbr("ProducePaprikaYellow", tuple(lin("#f2b414")), rough=0.25, coat=0.5)


def ball(name, x, y, z, r, mat, squash=(1.0, 1.0, 1.0), rot=(0.0, 0.0, 0.0)):
    """a round vegetable: an icosphere (no pole fanning to a point), 80 faces, squashed as given"""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=P(x, y, z), rotation=rot)
    o = active()
    o.scale = squash
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name
    o.data.materials.append(M[mat])
    for pg in o.data.polygons:
        pg.use_smooth = True
    parts.append(o)
    return o


def stem(name, x, y, z, length, mat="calyx", r=0.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=r, depth=length, location=P(x, y + length / 2, z))
    o = active()
    o.name = name
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def long_veg(name, x, y, z, length, r, mat, rot, seg=8, tip=0.6):
    """a cucumber or an eggplant lying in its basket: a long round shape, its stem end narrower (`tip`)"""
    prof = [(r * 0.35, -length / 2), (r * 0.85, -length * 0.38), (r, -length * 0.1), (r * 0.95, length * 0.2), (r * tip, length * 0.42), (r * tip * 0.5, length / 2)]
    o = lathe_veg(name, prof, seg, mat)
    o.location = P(x, y, z)
    o.rotation_euler = rot
    return o



# ---- two baskets of vegetables on the floor in front of the potatoes' and sweet potatoes' sacks (item 133, the owner's, 2026-11-15: "two
# vegetable baskets like the reference pictures, in the red circle"): a slatted wooden crate heaped with cabbages, peppers and a pumpkin, and a
# wicker basket with a handle, a cabbage, broccoli, radishes, cucumbers and a courgette in it. Each its own node (VegCrate, VegBasket), its foot's
# middle at its origin, for the game to stand them where it likes ----
veg_from = len(parts)


def wicker(n=1024):
    """a wicker basket's weave (item 153, the owner's, 2026-11-15: the old picture was plain bars in a deep orange, no weave in it): willow
    weavers running round it (rows along u), each rounded across its height, over one upright stake and under the next, the next row the
    other way; where a weaver goes under, the stake shows, a rounded rod; a pale willow tan, in the picture's own colours, a shade darker
    inside (v past 0.55: the outside is laid up v 0..0.5, the inside from 0.5 down)"""
    u, v = grid01(n)
    srgb = lambda h: np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
    ROWS, STAKES = 24, 30
    ry, rk = (v * ROWS) % 1, np.floor(v * ROWS)
    sx, sk = (u * STAKES) % 1, np.floor(u * STAKES)
    over = ((sk + rk) % 2) == 0
    tone = np.clip(fbm(n, 6, 3) * 0.8 + 0.2, 0, 1)
    weave = mix(srgb("#b88a50"), srgb("#e8c890"), tone)
    rnd = np.sin(ry * np.pi) ** 0.5
    # (over a stake: full and lit; going under: drawn in toward its ends, shadowed)
    dip = np.where(over, 1.0, 0.72 + 0.28 * np.abs(np.cos(sx * np.pi)))
    weave = weave * (0.32 + 0.68 * rnd * dip)[..., None]
    rod = np.cos(np.clip((sx - 0.5) / 0.17, -1, 1) * np.pi / 2)
    stake = srgb("#a07642") * (0.35 + 0.65 * rod)[..., None]
    show = (~over) & (np.abs(sx - 0.5) < 0.17) & (np.abs(ry - 0.5) < 0.42)
    col = np.where(show[..., None], stake, weave)
    col = np.where((v > 0.55)[..., None], col * 0.78, col)
    return col


M["wicker"] = pbr("VegWicker", (1, 1, 1), tex=image("veg_wicker", wicker()), rough=0.8)
M["wicker_cane"] = pbr("VegWickerCane", tuple(lin("#c9a36a")), rough=0.7)
def cabbage_picture(name, base, deep, n=256):
    """a cabbage's leaf (item 153: the old one's dark wavy lines read as a watermelon's): a pale green, deeper in soft patches, and its veins
    pale, near white, running from its root up and out (along v), a few branching off"""
    u, v = grid01(n)
    col = mix(lin(base), lin(deep), smooth(0.4, 0.8, fbm(n, 3, 4)) * 0.6)
    wob = (fbm(n, 2, 3) - 0.5) * 0.35
    main = smooth(0.9, 0.99, np.abs(np.sin((u * 6 + wob) * np.pi)))
    side = smooth(0.95, 1.0, np.abs(np.sin((u * 18 + v * 3 + wob * 2) * np.pi))) * smooth(0.2, 0.6, v)
    col = mix(col, lin("#eef5d6"), np.clip(main * 0.85 + side * 0.4, 0, 1))
    return image(name, col)


M["cabbage"] = pbr("VegCabbage", (1, 1, 1), tex=cabbage_picture("veg_cabbage", "#b6d98a", "#7fb556"), rough=0.6)
M["cabbage_pale"] = pbr("VegCabbagePale", (1, 1, 1), tex=cabbage_picture("veg_cabbage_pale", "#d4e8a8", "#a6cc78"), rough=0.6)
def buds(n=256):
    """broccoli's florets: tight buds, a dark green with lighter tips speckled over it"""
    d = vnoise(n, 40, 40)
    return mix(lin("#3d7226"), lin("#8fbe5a"), smooth(0.45, 0.8, d))


M["broccoli"] = pbr("VegBroccoli", (1, 1, 1), tex=image("veg_broccoli", buds()), rough=0.85)
# (an outer leaf of a cabbage: both its sides drawn, the head seen through between them)
M["cabbage_leaf"] = pbr("VegCabbageLeaf", (1, 1, 1), tex=cabbage_picture("veg_cabbage_leaf", "#9fcd6c", "#5f9a3c"), rough=0.6)
M["cabbage_leaf"].use_backface_culling = False
M["broccoli_stem"] = pbr("VegBroccoliStem", tuple(lin("#8cb85a")), rough=0.6)
M["pumpkin"] = pbr("VegPumpkin", (1, 1, 1), tex=skin_picture("veg_pumpkin", "#e88a2a", "#c0601a", 10, 0.6), rough=0.5)
M["radish"] = pbr("VegRadish", tuple(lin("#a8183a")), rough=0.35, coat=0.4)
M["courgette"] = pbr("VegCourgette", (1, 1, 1), tex=skin_picture("veg_courgette", "#b6d27a", "#7ea84c", 12, 0.5), rough=0.45)


def qball(name, x, y, z, r, mat, squash=(1.0, 1.0, 1.0), rot=(0.0, 0.0, 0.0), cuts=3, shape=None):
    """a round vegetable made finer (item 153, the owner's, 2026-11-15: "the quality isn't OK": icospheres of 80 faces, every face seen): a
    cube's faces cut `cuts`+1 by `cuts`+1 and pushed out round, quads all over (no pole), smooth; `shape(n)` scales the radius along the
    direction n (lobes, a dimple); laid out in the picture round it (u) and up it (v)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    uvl = bm.loops.layers.uv.new()
    for v in bm.verts:
        n = v.co.normalized()
        k = shape(n) if shape else 1.0
        v.co = Vector((n.x * r * k * squash[0], n.y * r * k * squash[1], n.z * r * k * squash[2]))
    for f in bm.faces:
        us = []
        for l in f.loops:
            n = l.vert.co.normalized()
            us.append((math.atan2(n.y, n.x) + math.pi) / (2 * math.pi))
        wrap = max(us) - min(us) > 0.5
        for l, u_ in zip(f.loops, us):
            l[uvl].uv = (u_ + (1.0 if wrap and u_ < 0.5 else 0.0), 0.5 + l.vert.co.normalized().z * 0.5)
    o = mesh_object(name, bm, mat)
    o.location = P(x, y, z)
    o.rotation_euler = rot
    return o


def leaf_shell(name, x, y, z, r, mat, tilt, turn, reach=1.15, flare=0.18):
    """a cabbage's outer leaf: a cup of a sphere `reach` rad round its middle, a little bigger than the head, its edge flared out, cupped round
    it from the side `turn`, leant `tilt` off upright; rings from a little round its middle out (no fan to it), both its sides drawn"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    SEG, RINGS = 10, 4
    rows = []
    for k in range(RINGS + 1):
        a = 0.25 + (reach - 0.25) * k / RINGS
        rr = r * (1.05 + flare * (k / RINGS) ** 2)
        rows.append([bm.verts.new((rr * math.sin(a) * math.cos(2 * math.pi * j / SEG + 0.3 * math.sin(j * 1.7)),
                                   rr * math.sin(a) * math.sin(2 * math.pi * j / SEG + 0.3 * math.sin(j * 1.7)), rr * math.cos(a))) for j in range(SEG)])
    for k in range(RINGS):
        for j in range(SEG):
            j2 = (j + 1) % SEG
            f = bm.faces.new((rows[k][j], rows[k][j2], rows[k + 1][j2], rows[k + 1][j]))
            for l, (uu, vv) in zip(f.loops, ((j, k), (j + 1, k), (j + 1, k + 1), (j, k + 1))):
                l[uvl].uv = (uu / SEG, vv / RINGS)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, mat)
    o.location = P(x, y, z)
    o.rotation_euler = (tilt, 0.0, turn)
    return o


def cabbage(name, x, y, z, r, mat, leaf_mat, rot=0.0):
    """a cabbage: its tight head (a fine round), three outer leaves cupped round it from three sides, their edges flared out"""
    qball(name, x, y, z, r, mat, squash=(1, 1, 0.92), rot=(0.2, 0.1, rot), cuts=2)
    for k in range(3):
        leaf_shell(f"{name}Leaf{k}", x, y, z, r, leaf_mat, tilt=1.25, turn=rot + k * 2 * math.pi / 3)


def paprika(name, x, y, z, r, mat, rot=0.0, cuts=2):
    """a bell pepper: four lobes round it, its shoulders up round a dimple where its stalk is, glossy; the stalk a short thick green one"""
    def lobes(n):
        th = math.atan2(n.y, n.x)
        return (1 + 0.1 * math.cos(4 * th) * (1 - abs(n.z))) * (1 - 0.18 * max(0.0, n.z - 0.75) / 0.25)
    qball(name, x, y, z, r, mat, squash=(1, 1, 1.08), rot=(0.15, 0.1, rot), cuts=cuts, shape=lobes)
    stem(name + "Stem", x, y + r * 0.8, z, 0.014, r=0.0055)


def broccoli(name, x, y, z, s=1.0):
    """a head of broccoli: a pale stalk, nine small florets bunched into a dome on it (a fine round each), budded (the picture)"""
    stem(name + "Stalk", x, y, z, 0.05 * s, mat="broccoli_stem", r=0.012 * s)
    for k in range(9):
        a = k * 2.4
        ring = 0 if k == 0 else (1 if k < 6 else 2)
        rr = (0.0, 0.02, 0.03)[ring] * s
        qball(f"{name}Floret{k}", x + rr * math.cos(a), y + (0.066 - 0.012 * ring) * s, z + rr * math.sin(a), (0.017 - 0.002 * ring) * s, "broccoli",
              squash=(1, 1, 0.85), cuts=1)


# ---- the three containers (the owner's, 2026-11-17: "the basket should look more like the reference, bigger; the crate bigger, one more, better
# made, each holding different vegetables"; and with no vegetables, empty): the wicker basket of leaf vegetables (VegBasket), a crate of the
# summer fruit vegetables (VegCrate) and one of the roots (VegCrate2). Each is a node of its own, its foot's middle at its origin; under it
# "<Container>_Frame" (what it's made of) and one group a kind of vegetable, "<Container>_<Kind>", holding that kind's vegetables one by one
# ("<Container>_<Kind>_0", "_1"...: the lowest, the ones that stand on the floor, first; the game shows as many as there's stock for, the last
# ones going first, and each stands on the container's floor or on the ones before it, so nothing hangs in the air) ----
M["radish_leaf"] = pbr("VegRadishLeaf", (1, 1, 1), tex=cabbage_picture("veg_radish_leaf", "#6fae45", "#3f7e2a"), rough=0.6)
M["radish_leaf"].use_backface_culling = False
M["paprika_o"] = pbr("ProducePaprikaOrange", tuple(lin("#e8700f")), rough=0.25, coat=0.5)
M["daikon"] = pbr("VegDaikon", (1, 1, 1), tex=skin_picture("veg_daikon", "#f2f0e2", "#dcdccb", 8, 0.25), rough=0.5)
M["daikon_top"] = pbr("VegDaikonTop", tuple(lin("#a8c878")), rough=0.6)
M["negi_white"] = pbr("VegNegiWhite", tuple(lin("#eef0dc")), rough=0.5)
M["negi_green"] = pbr("VegNegiGreen", (1, 1, 1), tex=skin_picture("veg_negi", "#3f8a3a", "#2c6a2a", 9, 0.5), rough=0.55)
M["crate2"] = pbr("ProduceCrateRoots", (1, 1, 1), tex=image("produce_crate2", crate_wood(512, ("#7d6446", "#b39674"), 5)), rough=0.8)


def napa_picture(n=256):
    """a napa cabbage's skin: cream white low down, going to a frilled yellow green at its top, its ribs running up it (u round it, v up)"""
    u, v = grid01(n)
    wob = (fbm(n, 3, 3) - 0.5) * 0.3
    ribs = smooth(0.6, 1.0, np.abs(np.sin((u * 9 + wob) * np.pi)))
    top = smooth(0.5, 0.85, v + (fbm(n, 4, 4) - 0.5) * 0.3)
    col = mix(lin("#ece9bc"), lin("#a9c964"), top * 0.85)
    col = mix(col, lin("#fbfbe6"), ribs * (1 - top * 0.4) * 0.5)
    return col


M["napa"] = pbr("VegNapa", (1, 1, 1), tex=image("veg_napa", napa_picture()), rough=0.6)
EMPTIES = []
GROUPS = {}
CONT_ROOT = {}
KIND_N = {}


def empty(name, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.parent = parent
    EMPTIES.append(e)
    return e


def mk(cont, kind, build, *a, **kw):
    """one vegetable of `kind` in `cont`: whatever `build` makes gathered under "<cont>_<kind>_<n>", in the group "<cont>_<kind>" """
    n0 = len(parts)
    build(*a, **kw)
    made = [o for o in parts[n0:] if o.parent is None]
    if (cont, kind) not in GROUPS:
        GROUPS[(cont, kind)] = empty(f"{cont}_{kind}", CONT_ROOT[cont])
    k = KIND_N.get((cont, kind), 0)
    KIND_N[(cont, kind)] = k + 1
    it = empty(f"{cont}_{kind}_{k}", GROUPS[(cont, kind)])
    for o in made:
        o.parent = it
    return it


def aim(d, roll=0.0):
    """the turn that lays a lathe's own +z along `d` (the game's frame), rolled `roll` round itself"""
    v = P(*d).normalized()
    return (Vector((0, 0, 1)).rotation_difference(v) @ Quaternion((0, 0, 1), roll)).to_euler()


def leaf_card(name, base, yaw, pitch, length, width, mat, bend=0.9):
    """a leaf: a strip of 4 by 2 quads springing from `base` (the game's frame) outward at bearing `yaw`, rising `pitch` off flat and curving
    over by `bend` along its length, widest in its middle; both its sides drawn (the material's)"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    out = Vector((math.cos(yaw), 0.0, math.sin(yaw)))
    side = Vector((-math.sin(yaw), 0.0, math.cos(yaw)))
    cur = Vector(base)
    ang = pitch
    rows = []
    N = 4
    for k in range(N + 1):
        t = k / N
        w = width * (0.35 + 0.65 * math.sin(math.pi * min(1.0, 0.18 + 0.82 * t)) ** 0.6)
        rows.append([bm.verts.new(P(*(cur + side * w * s))) for s in (-0.5, 0.0, 0.5)])
        ang -= bend / N
        step = length / N
        cur = cur + out * math.cos(ang) * step + Vector((0.0, math.sin(ang) * step, 0.0))
    for k in range(N):
        for i in range(2):
            f = bm.faces.new((rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]))
            for loop, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                loop[uvl].uv = (ii / 2, kk / N)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def capped(o, z, rad, mat, stalk=0.012, name="Cap"):
    """a calyx (a little low dome, six round) and a short stalk, hung on the lathe `o` at z up its own axis"""
    cap = lathe_veg(o.name + name, [(rad, 0.0), (rad * 0.8, rad * 0.22), (rad * 0.28, rad * 0.4)], 6, mat)
    cap.parent = o
    cap.location = (0, 0, z)
    if stalk:
        bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=rad * 0.2, depth=stalk, location=(0, 0, 0))
        st = active()
        st.name = o.name + name + "Stalk"
        st.data.materials.append(M[mat])
        st.parent = o
        st.location = (0, 0, z + rad * 0.3 + stalk / 2)
        parts.append(st)
    return cap


def tomato(name, x, y, z, r, rot=0.0):
    """a tomato: a fine round a little flattened, dimpled where its calyx sits, the calyx and stalk on it"""
    o = qball(name, x, y, z, r, "tomato", squash=(1, 1, 0.88), rot=(0.1, 0.05, rot), cuts=2,
              shape=lambda n: 1 - 0.14 * max(0.0, (n.z - 0.8) / 0.2) ** 2)
    capped(o, r * 0.78, r * 0.45, "calyx", stalk=r * 0.3)
    return o


def eggplant(name, x, y, z, length, r, d, roll=0.0):
    """an eggplant along game direction `d`, middle at (x, y, z): glossy, fat at its blossom end, narrower toward the calyx, a green cap on it"""
    o = long_veg(name, x, y, z, length, r, "eggplant", (0, 0, 0), seg=10, tip=0.55)
    o.rotation_euler = aim(d, roll)
    capped(o, length / 2 - r * 0.1, r * 0.62, "calyx", stalk=r * 0.8)
    return o


def piman(name, x, y, z, d, roll=0.0, length=0.1, r=0.016):
    """a green pepper along `d`: a long tapering one with its stalk"""
    o = lathe_veg(name, [(r * 0.25, -length / 2), (r * 0.8, -length * 0.4), (r, -length * 0.1), (r * 0.95, length * 0.2), (r * 0.7, length * 0.4),
                         (r * 0.35, length / 2)], 6, "piman")
    o.location = P(x, y, z)
    o.rotation_euler = aim(d, roll)
    capped(o, length / 2 - 0.002, r * 0.5, "calyx", stalk=0.014)
    return o


def carrot2(name, x, y, z, length, d):
    """a carrot along `d`, its shoulder (and its cut-short leaves) at the front"""
    o = carrot(name, x, y, z, length, (0, 0, 0))
    o.rotation_euler = aim(d)
    return o


def daikon(name, x, y, z, length, r, d):
    """a daikon along `d`: a long fat white root drawn to a tail, a short crown of pale green stalks cut at its shoulder"""
    prof = [(r * 0.12, -length / 2), (r * 0.5, -length * 0.42), (r * 0.9, -length * 0.25), (r, 0.0), (r * 0.98, length * 0.25), (r * 0.8, length * 0.42),
            (r * 0.45, length * 0.5)]
    o = lathe_veg(name, prof, 12, "daikon")
    o.location = P(x, y, z)
    o.rotation_euler = aim(d)
    top = lathe_veg(name + "Crown", [(r * 0.4, 0.0), (r * 0.3, 0.012), (r * 0.12, 0.024)], 6, "daikon_top")
    top.parent = o
    top.location = (0, 0, length * 0.5 - 0.002)
    return o


def negi(name, x, y, z, length, r, d):
    """a leek along `d` (its white end toward -d, the green leaves the rest), a short tuft of roots at the white end"""
    wl = length * 0.38
    o = lathe_veg(name, [(r * 0.45, -wl / 2), (r * 0.9, -wl / 2 + 0.006), (r, 0.0), (r * 1.02, wl / 2)], 8, "negi_white")
    # (x, y, z the whole leek's middle: its white end's middle is half of the length less the white's half back along it)
    o.location = P(*(Vector((x, y, z)) + Vector(d).normalized() * (wl / 2 - length / 2)))
    o.rotation_euler = aim(d)
    g = lathe_veg(name + "Green", [(r * 1.0, 0.0), (r * 1.04, (length - wl) * 0.3), (r * 0.85, (length - wl) * 0.7), (r * 0.3, length - wl)], 8, "negi_green")
    g.parent = o
    g.location = (0, 0, wl / 2 - 0.001)
    root = lathe_veg(name + "Root", [(r * 0.4, 0.0), (r * 0.28, -0.012)], 6, "onion_root")
    root.parent = o
    root.location = (0, 0, -wl / 2 + 0.001)
    return o


def radish(name, x, y, z, r, yaw):
    """a red radish (a fine round, a thin tail under it) with a tuft of leaves fanned from its top"""
    o = qball(name, x, y, z, r, "radish", squash=(1, 1, 0.95), cuts=1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=r * 0.09, depth=r * 0.5, location=(0, 0, -r * 1.05))
    tail = active()
    tail.name = name + "Tail"
    tail.data.materials.append(M["radish"])
    tail.parent = o
    parts.append(tail)
    for k in range(3):
        leaf_card(f"{name}Leaf{k}", (x, y + r * 0.85, z), yaw + k * 2 * math.pi / 3 + 0.3, 0.8, r * 2.6, r * 1.7, "radish_leaf", bend=0.6)
    return o


def napa(name, x, y, z, r, tall, yaw):
    """a napa cabbage standing: a tall fine round (cream low down, frilled green at its top) with leaves flaring out of its crown; (x, y, z) its
    foot"""
    o = qball(name, x, y + tall / 2, z, r, "napa", squash=(1, 1, tall / 2 / r), rot=(0, 0, yaw), cuts=3,
              shape=lambda n: (1 - 0.3 * max(0.0, n.z - 0.45) ** 1.5) * (1 + 0.05 * math.cos(6 * math.atan2(n.y, n.x))))
    for k in range(5):
        leaf_card(f"{name}Frill{k}", (x, y + tall * 0.9, z), yaw + k * 2 * math.pi / 5, 1.0, r * 1.5, r * 1.1, "cabbage_leaf", bend=1.3)
    return o


def lean_veg(name, ang, rho0, y0, length, r, mat, seg=8, tip=0.7):
    """a long vegetable (a cucumber or a courgette) stood in the basket: its low end on the floor at bearing `ang` (from +z toward +x), `rho0`
    from the middle, `y0` up; leant out against the basket's inner wall (or its lattice's inner side) as high as its length lets it reach"""
    def wall(y):
        pts = [(rr, yy) for rr, yy in inner[::-1]]          # (inner profile from the floor up: radius, height)
        for (r0, y0_), (r1, y1_) in zip(pts[:-1], pts[1:]):
            if y0_ <= y <= y1_:
                return r0 + (r1 - r0) * (y - y0_) / (y1_ - y0_)
        return pts[-1][0] + (y - pts[-1][1]) * 0.17
    lo = Vector((rho0 * math.sin(ang), y0, rho0 * math.cos(ang)))
    best = None
    for k in range(200):
        yt = y0 + (LAT1 - y0) * k / 199
        rt = wall(yt) - r * 1.25 - 0.004
        d_ = math.hypot(rt - rho0, yt - y0)
        if d_ >= length - r * 0.35:
            best = (rt, yt)
            break
    rt, yt = best or (wall(LAT1) - r * 1.25, LAT1)
    hi = Vector((rt * math.sin(ang), yt, rt * math.cos(ang)))
    d = (hi - lo).normalized()
    c = lo + d * (length / 2 - r * 0.35)
    o = long_veg(name, c.x, c.y, c.z, length, r, mat, (0, 0, 0), seg=seg, tip=tip)
    o.rotation_euler = aim(d)
    return o


def crate_frame(cont, root, W, D, mat, gap=0.012):
    """a slatted crate (outer W along x, D along z, its foot's middle the origin): two skids under it, a floor of five boards with gaps, three
    side boards on each long side and three on each end with a gap between each, and a square post inside each corner; returns (floor top,
    wall top)"""
    SK, FL, T = 0.018, 0.012, 0.014
    n0 = len(parts)
    SLh = 0.05
    top = SK + 3 * SLh + 2 * gap
    for sd in (-1, 1):
        board(f"{cont}Skid{sd}", 0.0, SK / 2, sd * (D / 2 - 0.075), W - 0.05, SK, 0.034)
        for k in range(3):
            y_ = SK + k * (SLh + gap) + SLh / 2
            board(f"{cont}Side{sd}{k}", 0.0, y_, sd * (D / 2 - T / 2), W, SLh, T)
            board(f"{cont}End{sd}{k}", sd * (W / 2 - T / 2), y_, 0.0, T, SLh, D - 2 * T - 0.004)
        for sz in (-1, 1):
            board(f"{cont}Post{sd}{sz}", sd * (W / 2 - T - 0.015), SK + (top - SK - 0.006) / 2 + 0.0, sz * (D / 2 - T - 0.015), 0.03, top - SK - 0.006, 0.03)
    FW = (D - 2 * T - 0.01) / 5
    for k in range(5):
        board(f"{cont}Floor{k}", 0.0, SK + FL / 2, (k - 2) * (FW + 0.0025), W - 2 * T - 0.006, FL, FW - 0.002)
    for o in parts[n0:]:
        if o.name.startswith(cont):
            o.data.materials.clear()
            o.data.materials.append(M[mat])
        o.parent = root
    return SK + FL, top


CRATE_W, CRATE_D = 0.54, 0.36


# ---- the crate of summer vegetables: tomatoes, sweet peppers, aubergines, green peppers (the stock's Tomato, Paprika, Eggplant, Piman) ----
veg_from = len(parts)
crate1_root = empty("VegCrate")
CONT_ROOT["VegCrate"] = crate1_root
F1, TOP1 = crate_frame("VegCrate", empty("VegCrate_Frame", crate1_root), CRATE_W, CRATE_D, "crate")
TR = 0.035
for k, (x_, z_, l) in enumerate([(-0.186 + 0.07 * i, 0.04 + 0.07 * j, 0) for j in range(2) for i in range(3)] +
                                 [(-0.151, 0.075, 1), (-0.081, 0.075, 1), (-0.116, 0.075, 2)]):
    y_ = F1 + TR * 0.88 + (0.0, 0.046, 0.1)[l]
    mk("VegCrate", "Tomato", tomato, f"VegCrateTomato{k}", x_, y_, z_, TR, rot=k * 0.8)
for k, (x_, z_, l) in enumerate([(-0.185 + 0.075 * i, -0.125 + 0.075 * j, 0) for j in range(2) for i in range(3)] + [(-0.1475, -0.0875, 1), (-0.0725, -0.0875, 1)]):
    mat = ("paprika_r", "paprika_y", "paprika_o")[(k + k // 3) % 3]
    mk("VegCrate", "Paprika", paprika, f"VegCratePaprika{k}", x_, F1 + 0.039 + (0.0, 0.052)[l], z_, 0.036, mat, rot=k * 0.9)
EGG_R = 0.029
for k, (z_, l) in enumerate([(0.04, 0), (0.1, 0), (0.07, 1), (0.13, 1)]):
    mk("VegCrate", "Eggplant", eggplant, f"VegCrateEggplant{k}", 0.11, F1 + EGG_R + 0.0008 + (0.0, 0.052)[l], z_, 0.15, EGG_R, (1, 0, 0), roll=k)
rnd1 = __import__("random").Random(31)
for k, (x_, z_, l) in enumerate([(0.06 + 0.11 * i, -0.12 + 0.037 * j, 0) for j in range(4) for i in range(2)] +
                                 [(0.07 + 0.11 * i, -0.102 + 0.074 * j, 1) for j in range(2) for i in range(2)]):
    mk("VegCrate", "Piman", piman, f"VegCratePiman{k}", x_ + rnd1.uniform(-0.006, 0.006), F1 + 0.0168 + 0.033 * l, z_ + rnd1.uniform(-0.002, 0.002),
       (1, 0, rnd1.uniform(-0.12, 0.12)), roll=rnd1.uniform(0, 6))
crate_parts = parts[veg_from:]

# ---- the crate of roots: carrots, burdock, daikon, leeks laid across the top (the stock's Carrot, Gobo, Daikon, Negi) ----
veg_from = len(parts)
crate2_root = empty("VegCrate2")
CONT_ROOT["VegCrate2"] = crate2_root
F2, TOP2 = crate_frame("VegCrate2", empty("VegCrate2_Frame", crate2_root), CRATE_W, CRATE_D, "crate2")
CR = 0.0204
for k, (x_, l) in enumerate([(-0.2 + 0.0412 * i, 0) for i in range(4)] + [(-0.179 + 0.0412 * i, 1) for i in range(3)] + [(-0.158 + 0.0412 * i, 2) for i in range(2)]):
    mk("VegCrate2", "Carrot", carrot2, f"VegCrate2Carrot{k}", x_, F2 + CR + 0.0008 + 0.0357 * l, -0.02, 0.17, (0, 0, 1))
for k, (x_, l) in enumerate([(-0.03 + 0.03 * i, 0) for i in range(3)] + [(-0.015 + 0.03 * i, 1) for i in range(2)]):
    mk("VegCrate2", "Gobo", gobo, f"VegCrate2Gobo{k}", x_ + 0.012, F2 + 0.0138 + 0.0008 + 0.025 * l, 0.0, 0.3, (math.pi / 2, 0, 0))
for k, (x_, l) in enumerate([(0.1, 0), (0.18, 0), (0.14, 1)]):
    mk("VegCrate2", "Daikon", daikon, f"VegCrate2Daikon{k}", x_, F2 + 0.036 + 0.0008 + 0.06 * l, 0.0, 0.26, 0.036, (0, 0, 1))
for k in range(3):
    mk("VegCrate2", "Negi", negi, f"VegCrate2Negi{k}", 0.0, TOP2 + 0.0122, -0.118 + 0.03 * k, 0.56, 0.0108, (1, 0, 0.03 * (k - 1)))
crate2_parts = parts[veg_from:]
crate2_parts = [o for o in crate2_parts if o.parent is not None or True]

# ---- the wicker basket: round, flared, woven (its weave seen inside and out), an open diamond lattice band round the top between two canes,
# a tall doubled-cane handle arched over ----
basket_from = len(parts)
basket_root = empty("VegBasket")
CONT_ROOT["VegBasket"] = basket_root
frame_b = empty("VegBasket_Frame", basket_root)
seg = 24
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
SB = 0.88                       # (how much wider than its first draft: Ø 0.40 across the rim, the owner's 35 to 40 cm)
prof = [(0.15 * SB, 0.0), (0.168 * SB, 0.03), (0.19 * SB, 0.08), (0.21 * SB, 0.13), (0.22 * SB, 0.16)]
inner = [(0.212 * SB, 0.16), (0.202 * SB, 0.13), (0.182 * SB, 0.08), (0.16 * SB, 0.03), (0.142 * SB, 0.012)]
allp = prof + inner
rows = [[bm.verts.new((rr * math.cos(2 * math.pi * j / seg), rr * math.sin(2 * math.pi * j / seg), yy)) for j in range(seg)] for rr, yy in allp]
# (the picture's v by the length along the wall: the outside up v 0..0.5, the inside from 0.55 down the picture's other half)
cum = [0.0]
for (r0, y0), (r1, y1) in zip(allp[:-1], allp[1:]):
    cum.append(cum[-1] + math.hypot(r1 - r0, y1 - y0))
vs = [c / cum[len(prof) - 1] * 0.5 if k < len(prof) else 0.55 + (c - cum[len(prof)]) / (cum[-1] - cum[len(prof)]) * 0.45 for k, c in enumerate(cum)]
for k in range(len(rows) - 1):
    for j in range(seg):
        j2 = (j + 1) % seg
        f = bm.faces.new((rows[k][j], rows[k][j2], rows[k + 1][j2], rows[k + 1][j]))
        for l, (uu, vv) in zip(f.loops, ((j, vs[k]), (j + 1, vs[k]), (j + 1, vs[k + 1]), (j, vs[k + 1]))):
            l[uvl].uv = (uu / seg, vv)
bm.faces.new(list(reversed(rows[0])))
bm.faces.new(rows[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh_object("VegBasketBody", bm, "wicker").parent = frame_b
LAT0, LAT1 = 0.16, 0.205            # (the lattice band's height: between its two canes)


def lat_r(y):
    return 0.22 * SB + (y - LAT0) * 0.17


def ring_pts(y, n=24):
    return [(lat_r(y) * math.cos(2 * math.pi * j / n), y, lat_r(y) * math.sin(2 * math.pi * j / n)) for j in range(n)]


tube_obj("VegBasketCaneLow", ring_pts(LAT0 + 0.002), 0.0065, "wicker_cane", cyclic=True).parent = frame_b
tube_obj("VegBasketCaneRim", ring_pts(LAT1), 0.0075, "wicker_cane", cyclic=True).parent = frame_b
# (the lattice: two sets of slanted flat bars, one set over the other (a hair apart), each running up one segment round from the lower cane
# to the upper; the bars' ends buried in the canes)
for sset, (dirn, off) in enumerate(((1, 0.0048), (-1, -0.0048))):
    for j in range(seg):
        a0 = 2 * math.pi * j / seg
        a1 = a0 + dirn * 2 * math.pi / seg
        p0 = Vector((lat_r(LAT0 + 0.002) * math.cos(a0), LAT0 + 0.002, lat_r(LAT0 + 0.002) * math.sin(a0)))
        p1 = Vector((lat_r(LAT1) * math.cos(a1), LAT1, lat_r(LAT1) * math.sin(a1)))
        am = (a0 + a1) / 2
        nrm = Vector((math.cos(am), 0.0, math.sin(am)))
        dd = (p1 - p0).normalized()
        sd_ = dd.cross(nrm).normalized()
        W_, T_b = 0.0065, 0.0045
        bm = bmesh.new()
        vv_ = []
        for pp in (p0, p1):
            c_ = pp + nrm * off
            vv_.append([bm.verts.new(P(*(c_ + sd_ * sx * W_ / 2 + nrm * sy * T_b / 2))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        for i in range(4):
            bm.faces.new((vv_[0][i], vv_[0][(i + 1) % 4], vv_[1][(i + 1) % 4], vv_[1][i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh_object(f"VegBasketLattice{sset}{j}", bm, "wicker_cane").parent = frame_b
# (the handle: two canes side by side arched from one side of the lattice to the other, standing up a hand and more above the rim)
HANDLE_UP = 0.15
for s_, dz in enumerate((-0.0085, 0.0085)):
    tube_obj(f"VegBasketHandle{s_}", [(-lat_r(LAT1) * 0.985 * math.cos(math.pi * t / 16), 0.17 + (LAT1 - 0.17 + HANDLE_UP) * math.sin(math.pi * t / 16) ** 0.85, dz)
                                      for t in range(17)], 0.0085, "wicker_cane", res=1).parent = frame_b
RIM_TOP = LAT1 + 0.0075
B_ = 0.012                        # (its floor's top)
# (the leaves: a napa cabbage at the back left, a green cabbage at the front left, two heads of broccoli at the right, radishes with their
# leaves at the front, cucumbers and a courgette leaning on the rim)
def pol(th, rho):
    return rho * math.sin(math.radians(th)), rho * math.cos(math.radians(th))


nx_, nz_ = pol(225, 0.062)
mk("VegBasket", "Napa", napa, "VegBasketNapa0", nx_, B_ + 0.002, nz_, 0.05, 0.30, 0.4)
cx_, cz_ = pol(-55, 0.08)
mk("VegBasket", "Cabbage", cabbage, "VegBasketCabbage0", cx_, B_ + 0.052, cz_, 0.052, "cabbage_pale", "cabbage_leaf", rot=0.8)
bx_, bz_ = pol(105, 0.068)
mk("VegBasket", "Broccoli", broccoli, "VegBasketBroccoli0", bx_, B_ + 0.002, bz_, 1.2)
for k, (x_, z_) in enumerate(((-0.005, 0.105), (0.03, 0.1), (0.012, 0.075))):
    mk("VegBasket", "Radish", radish, f"VegBasketRadish{k}", x_, B_ + 0.026, z_, 0.018, k * 1.3)
for k, (ang, rho) in enumerate(((175, 0.02), (150, 0.09))):
    mk("VegBasket", "Cucumber", lean_veg, f"VegBasketCucumber{k}", math.radians(ang), rho, B_ + 0.016, 0.2, 0.016, "cucumber")
mk("VegBasket", "Zucchini", lean_veg, "VegBasketZucchini0", math.radians(55), 0.08, B_ + 0.022, 0.22, 0.022, "courgette", 8, 0.8)
basket_parts = parts[basket_from:]
roots3 = [crate1_root, crate2_root, basket_root]
crate_parts = [o for o in crate_parts]
veg_parts = crate_parts + crate2_parts + basket_parts
sack_parts = [o for o in parts if o not in veg_parts]
for lo in LOWS.values():
    bpy.data.objects.remove(lo, do_unlink=True)


def stick(name, x, y0, z, length, rad, tilt, spin):
    """a stick of binchotan standing up out of the sack: knobbly, a few flat facets and cracks, its top end cut"""
    bm = bmesh.new()
    segs, n = 6, 3
    rnd = __import__("random").Random(name)
    rows = []
    for k in range(n + 1):
        t = k / n
        row = []
        for jn in range(segs):
            a = 2 * math.pi * jn / segs
            rr = rad * (0.88 + 0.22 * rnd.random()) * (1 - 0.08 * t)
            row.append(bm.verts.new(Vector((rr * math.cos(a), rr * math.sin(a), length * t))))
        rows.append(row)
    for k in range(n):
        for jn in range(segs):
            j2 = (jn + 1) % segs
            bm.faces.new((rows[k][jn], rows[k][j2], rows[k + 1][j2], rows[k + 1][jn]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, "coal")
    for pg in o.data.polygons:
        pg.use_smooth = False
    o.location = P(x, y0, z)
    o.rotation_euler = (tilt[0], tilt[1], spin)
    return o


# ---- the sack of binchotan, on its own: the sticks standing up out of it ----
CH_H, CH_R = 0.5, 0.17
sack("CharcoalSackBody", 0.0, 0.0, CH_H, CH_R, "sackC", front=math.pi / 2, salt=9)
coal = []
rnd = __import__("random").Random(5)
for k in range(14):
    # (packed upright: an inner ring and an outer one, leaning out a little, their tops at different heights)
    ring_r = CH_R * (0.25 if k < 5 else 0.6)
    a = 2 * math.pi * (k if k < 5 else k - 5) / (5 if k < 5 else 9) + (0.3 if k >= 5 else 0)
    x, z = ring_r * math.cos(a), ring_r * math.sin(a)
    lean_ = 0.12 if k >= 5 else 0.05
    coal.append(stick(f"CharcoalStick{k}", x, CH_H - 0.16, z, 0.24 + 0.05 * rnd.random(), 0.016 + 0.004 * rnd.random(),
                      (-math.sin(a) * lean_, math.cos(a) * lean_), rnd.random() * 6))
charcoal_parts = [o for o in parts if o not in sack_parts and o not in veg_parts]

# ---- under their roots ----
root = bpy.data.objects.new("ProduceSacks", None)
bpy.context.collection.objects.link(root)
# (only what isn't hung from another part already: an onion's root tuft and a carrot's leaves stay with it (taken off them, the tufts lay
# in a heap under the floor and the leaves inside the sweet potatoes' sack, the onions bare))
for o in sack_parts:
    if o.parent is None:
        o.parent = root
croot = bpy.data.objects.new("CharcoalSack", None)
bpy.context.collection.objects.link(croot)
for o in charcoal_parts:
    if o.parent is None:
        o.parent = croot
croot.location = P(1.2, 0, 0)
# (the three containers side by side along x, a metre apart, each with its foot's middle at its own origin)
veg_roots = roots3
for vr, at in zip(veg_roots, (2.0, 2.9, 3.8)):
    vr.location = P(at, 0, 0)
top = bpy.data.objects.new("Produce", None)
bpy.context.collection.objects.link(top)
root.parent = top
croot.parent = top
for vr in veg_roots:
    vr.parent = top
print("PRODUCE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    # (from in front, a little above, as the kitchen's floor sees them)
    target = P(-0.15, 0.2, 0.05)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.05, 0.75, 2.4)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(top, parts + [root, croot, top] + EMPTIES, os.path.join(PROJECT, "public", "models", "produce.glb"), os.path.join(PROJECT, "blender", "produce.blend"), PREVIEW)
print("PRODUCE_DONE")
