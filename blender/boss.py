"""The owner (老闆), standing at his grill when the shop's shut: boss.glb, node "Boss", about 0.95 tall, facing +z three, resting on y 0.

Made as the cooks of Overcooked 2 are: a big round head set straight down on a plump body about as tall as the head is wide, rounding
off underneath (no legs, no feet), no arms, floating mitten hands (a plump paddle and a thumb). His face is the one on his picture
(ui/Avatar.tsx, role 'owner'); dressed as a Japanese cook: his head wrapped in an indigo tenugui, a white fish pressed on its front, knotted at the back,
its front edge rolled, a little brown hair at the sides and the nape; round-cornered glasses over small dark eyes, short thick brows, a round
button nose, a moustache and a smile, ears, a pencil behind his right one; a white kappōgi crossed at the front over an indigo under-collar,
a little gold fish pinned to his chest, indigo trousers and a navy apron (前掛け) with 聞野 on it in white, its cream cord tied in a bow at
his left, a blue-striped hand towel tucked in at his right. Kept light in geometry, the cloth and hair given their look by painted
textures (the tenugui's fish, the cotton's weave, the indigo's dye, the hair's strands).
- his hands are separate nodes (BossHandL, BossHandR) so the game can move them, and so are the tongs and the fan he picks up
  (BossTongs, BossFan: hidden till he holds them).

Run:
    blender -b --factory-startup --python blender/boss.py -- <project path> [preview.png]

The staff are made by the same script, the boss's figure dressed for their job: CREW=<variant> writes crew_<variant>.glb (the same node
names, so the game moves them as it moves him), no moustache, pencil or gold pin:
- chef: a cook in the white kappōgi and a white tenugui cap, the navy apron with 聞野 and a towel at the cord
- chefF: the same for a woman, her hair in a bun at the back
- server: an indigo samue, a white hachimaki round the head (its knot and ends at the back), the hair over the crown, a short dark apron
- serverF: a kimono of deep plum with a gold obi, the hair put up in a bun with a red comb, no apron
- stock: work clothes of khaki green, a white hachimaki, no apron
Hair and skin are painted light (CrewHair, CrewSkin) for the game to tint per person; the glasses are kept for it to show or hide.
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
CREW = os.environ.get("CREW")
WEAR = {None: "boss", "chef": "cap", "chefF": "cap", "server": "band", "serverF": "bun", "stock": "band"}[CREW]
FEMALE = CREW in ("chefF", "serverF")


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


# (low, by the owner's rule for every figure (2,000 to 3,500 triangles a person, outline and all): no ball more than 24 round, none shut
# with a fan into a pole; each ball, tube and turned piece given the fewest it needs to read at the size it's seen)
def ring_ball(radius=1.0, segs=12, rings=6, location=(0, 0, 0)):
    """a ball made of rings round its axis (Blender's z, three's y), as a UV sphere is, but its two ends shut with ladders of quads, not
    fans into a pole; `segs` round it (no more than 24), `rings` bands from its foot to its top; u round it and v up it as a UV sphere's
    are (so a picture laid on one still fits). Made the active object at `location`, as the primitive is"""
    segs = min(24, segs)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    lat = [-math.pi / 2 + math.pi * k / rings for k in range(1, rings)]
    rows = [[bm.verts.new((radius * math.cos(t) * math.cos(2 * math.pi * i / segs), radius * math.cos(t) * math.sin(2 * math.pi * i / segs),
                           radius * math.sin(t))) for i in range(segs)] for t in lat]

    def uvof(i, k):
        return (i / segs, (lat[k] + math.pi / 2) / math.pi)
    for k in range(len(rows) - 1):
        for i in range(segs):
            f = bm.faces.new((rows[k][i], rows[k][(i + 1) % segs], rows[k + 1][(i + 1) % segs], rows[k + 1][i]))
            for lp, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                lp[uvl].uv = uvof(ii, kk)
    for k in (0, len(rows) - 1):
        for f in ladder_fill(bm, rows[k]):
            for lp in f.loops:
                lp[uvl].uv = uvof(rows[k].index(lp.vert), k)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Ball"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("Ball", me); bpy.context.collection.objects.link(o)
    o.location = location
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    return o


def disc(name, at, n, r, mat, segs=6):
    """a flat round dot (a glint, a pin's eye) on the surface at `at` facing out along `n`: `segs` round, shut by a ladder (no fan)"""
    n = Vector(n).normalized()
    a = n.cross(Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))).normalized()
    b = n.cross(a)
    bm = bmesh.new()
    ring = [bm.verts.new(P(*(Vector(at) + (a * math.cos(2 * math.pi * i / segs) + b * math.sin(2 * math.pi * i / segs)) * r))) for i in range(segs)]
    ladder_fill(bm, ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    # (facing out: its normal along n)
    if (o.data.polygons[0].normal.dot(Vector(P(*n)))) < 0:
        for poly in o.data.polygons:
            poly.flip()
    return fin(o, name, mat)


bpy.ops.wm.read_factory_settings(use_empty=True)
M = {
    "skin": pbr("BossSkin", lin("#d99a68"), rough=0.6),
    "cheek": pbr("BossCheek", lin("#ee8a78"), rough=0.6),
    "hair": pbr("BossHair", lin("#5a3a2a"), rough=0.6),
    "brow": pbr("BossBrow", lin("#3a2418"), rough=0.6),
    "coat": pbr("BossCoat", lin("#f7f3ea"), rough=0.75),
    "collar": pbr("BossCollar", lin("#d8cfbd"), rough=0.7),
    "red": pbr("BossRed", lin("#c4442f"), rough=0.6),
    "apron": pbr("BossApron", lin("#1e2a48"), rough=0.85),
    "cord": pbr("BossCord", lin("#e8dcc0"), rough=0.7),
    "band": pbr("BossBand", lin("#fbf8f2"), rough=0.6),
    "dark": pbr("BossDark", lin("#1c1410"), rough=0.4),
    "white": pbr("BossWhite", lin("#ffffff"), rough=0.3),
    "frame": pbr("BossFrame", lin("#2a1e18"), rough=0.4),
    "mouth": pbr("BossMouth", lin("#5a2018"), rough=0.6),
    "shoe": pbr("BossShoe", lin("#3a2a20"), rough=0.6),
    "print": pbr("BossPrint", lin("#f4efe2"), rough=0.7),
    "fan": pbr("BossFanPaper", lin("#f6efe0"), rough=0.7),
    "bamboo": pbr("BossBamboo", lin("#c8a86a"), rough=0.6),
}
# ---- painted textures: the look of the cloth and hair, so the shapes can stay simple
_n = 256
_u, _v = grid01(_n)
_rng = np.random.default_rng(7)
_grain = _rng.random((_n, _n)).astype(np.float32)


def _weave(base, k=0.05, lines=96):
    """a cloth's colour with its weave: fine crossing threads and a little unevenness of the dye"""
    w = 0.5 + 0.5 * np.sin(_u * lines * 2 * np.pi) * np.sin(_v * lines * 2 * np.pi)
    t = 1.0 + (w - 0.5) * k + (_grain - 0.5) * k * 0.8
    return (np.array(base, np.float32)[None, None, :] * t[..., None]).clip(0, 1).astype(np.float32)


def _weave_at(base, w, h, k=0.05, lines=96):
    """the same weave at w x h pixels (its threads as fine one way as the other)"""
    u = np.tile((np.arange(w) + 0.5) / w, (h, 1))
    v = np.tile(((np.arange(h) + 0.5) / h)[:, None], (1, w))
    g = np.random.default_rng(11).random((h, w)).astype(np.float32)
    wv = 0.5 + 0.5 * np.sin(u * lines * 2 * np.pi) * np.sin(v * lines * (h / w) * 2 * np.pi)
    t = 1.0 + (wv - 0.5) * k + (g - 0.5) * k * 0.8
    return (np.array(base, np.float32)[None, None, :] * t[..., None]).clip(0, 1).astype(np.float32)


# (the tenugui: indigo, white dots in rows, each row offset half a step (豆絞り), a soft edge to each dot as dye would give)
_du, _dv = (_u * 24) % 1.0, (_v * 12) % 1.0
_row = np.floor(_v * 12) % 2
_du = (_du + 0.5 * _row) % 1.0
_dot = np.clip(1.3 - np.hypot(_du - 0.5, (_dv - 0.5) * 0.9) / 0.2, 0, 1)
_tg = _weave((0.16, 0.22, 0.42), 0.08)
_tgCap = _tg.copy()
# (plain indigo for the roll and the knot; the cap's own cloth, with the fish pressed on it, is made once its front is found)
M["tenugui"] = pbr("BossTenugui", (1, 1, 1), tex=image("boss_tenugui", _tg.astype(np.float32)), rough=0.8)
# (the kappōgi's cotton: white with its weave, a faint shade down the folds)
COAT = {"server": (0.2, 0.25, 0.4), "serverF": (0.42, 0.14, 0.24), "stock": (0.42, 0.44, 0.3)}.get(CREW, (0.96, 0.94, 0.9))
_ct = _weave(COAT, 0.06)
if CREW == "serverF":
    _fu, _fv = grid01(256)
    for k in range(0, 9):
        for j in range(0, 9):
            cu, cv = (k + 0.5 * (j % 2)) / 9, (j + 0.3) / 9
            du = (_fu - cu + 0.5) % 1.0 - 0.5
            dv = _fv - cv
            a = np.arctan2(dv, du)
            rr = np.hypot(du, dv)
            petal = rr < 0.026 * (0.72 + 0.28 * np.abs(np.cos(2.5 * a)))
            _ct[petal] = (0.95, 0.78, 0.82)
            _ct[rr < 0.008] = (0.9, 0.7, 0.3)
if CREW == "server":
    _fu, _fv = grid01(256)
    st = ((np.abs(((_fu * 20) % 1.0) - 0.5) < 0.04) & (((_fv * 60) % 1.0) < 0.6)) | ((np.abs(((_fv * 20) % 1.0) - 0.5) < 0.04) & (((_fu * 60) % 1.0) < 0.6))
    _ct[st] = _ct[st] * 0.55 + np.array([0.75, 0.78, 0.86], np.float32) * 0.45
# (a faint shade down the folds)
_ct = _ct * (1 - 0.05 * (0.5 + 0.5 * np.sin(_u * 2 * np.pi * 9)))[..., None]


def _creases(c, specs):
    """the cloth's creases (the owner's: the kappōgi wants its folds): each (u0, v0, u1, v1, width, depth) a fold from one point to the other on
    the body's picture (u round it from the front, wrapping; v up it, the body from 0.11 to 0.355), a shadow down one side of its line and a
    little light along the other, both fading toward its ends"""
    shade = np.zeros_like(_u)
    for (u0, v0, u1, v1, w, d) in specs:
        du = ((_u - u0 + 0.5) % 1.0) - 0.5
        dv = _v - v0
        ex, ey = ((u1 - u0 + 0.5) % 1.0) - 0.5, v1 - v0
        L = math.hypot(ex, ey)
        tx, ty = ex / L, ey / L
        along = du * tx + dv * ty
        across = -du * ty + dv * tx
        t = np.clip(along / L, 0, 1)
        taper = np.where((along > 0) & (along < L), np.sin(np.pi * t) ** 0.7, 0)
        dark = np.where(across < 0, smooth(w, 0, -across), 0) * d
        light = np.where(across > 0, smooth(w * 0.5, 0, across), 0) * d * 0.35
        shade += (light - dark) * taper
    return (c * (1 + np.clip(shade, -0.4, 0.2))[..., None]).clip(0, 1).astype(np.float32)


_W = 0.30 / 1.64     # (the apron's ties round the waist, where the cloth gathers)
_ct = _creases(_ct, [
    # (behind: radiating from the ties, up toward the shoulders and down to the hem)
    (0.5, _W, 0.4, 0.33, 0.024, 0.22), (0.5, _W, 0.46, 0.345, 0.02, 0.18), (0.5, _W, 0.54, 0.345, 0.02, 0.18), (0.5, _W, 0.6, 0.33, 0.024, 0.22),
    (0.5, _W, 0.42, 0.12, 0.022, 0.2), (0.5, _W, 0.48, 0.113, 0.018, 0.16), (0.5, _W, 0.52, 0.113, 0.018, 0.16), (0.5, _W, 0.58, 0.12, 0.022, 0.2),
    # (down the sides from under the arms)
    (0.22, 0.345, 0.27, 0.2, 0.022, 0.2), (0.27, 0.33, 0.31, 0.22, 0.018, 0.15), (0.78, 0.345, 0.73, 0.2, 0.022, 0.2), (0.73, 0.33, 0.69, 0.22, 0.018, 0.15),
    # (across the chest along the crossed front, and a few short gathers at the hem)
    (0.1, 0.345, 0.03, 0.27, 0.018, 0.16), (0.9, 0.345, 0.97, 0.27, 0.018, 0.16),
    (0.15, 0.118, 0.16, 0.155, 0.014, 0.14), (0.32, 0.118, 0.33, 0.15, 0.014, 0.14), (0.68, 0.118, 0.67, 0.15, 0.014, 0.14), (0.85, 0.118, 0.84, 0.155, 0.014, 0.14),
])
M["coat"] = pbr("BossCoat", (1, 1, 1), tex=image(f"{CREW or 'boss'}_cotton", _ct.astype(np.float32)), rough=0.75)
if CREW:
    # (the cap's tenugui white, a band's white; the collar a shade of the coat, the kimono's white)
    _tg = _weave((0.95, 0.94, 0.9), 0.06)
    _tgCap = _tg.copy()
    M["tenugui"] = pbr("BossTenugui", (1, 1, 1), tex=image(f"{CREW}_tenugui", _tg.astype(np.float32)), rough=0.8)
    M["collar"] = pbr("BossCollar", lin({"serverF": "#f4efe2", "server": "#2a3350", "stock": "#5a5c40"}.get(CREW, "#d8cfbd")), rough=0.7)
    M["skin"] = pbr("CrewSkin", lin("#f0d8c4"), rough=0.6)
# (indigo cloth for the trousers and a deeper navy for the apron, both dyed a touch unevenly)
PANTS = {"server": (0.17, 0.21, 0.35), "serverF": (0.36, 0.11, 0.2), "stock": (0.2, 0.2, 0.18)}.get(CREW, (0.2, 0.25, 0.4))
APRON = {"server": (0.16, 0.1, 0.07)}.get(CREW, (0.12, 0.16, 0.28))
M["pants"] = pbr("BossPants", (1, 1, 1), tex=image(f"{CREW or 'boss'}_indigo", _weave(PANTS, 0.1)), rough=0.85)
M["apron"] = pbr("BossApron", (1, 1, 1), tex=image(f"{CREW or 'boss'}_navy", _weave(APRON, 0.12, 128)), rough=0.85)
# (hair: brown with strands combed down from the crown, lighter and darker by turns)
_hs = 0.75 + 0.25 * np.sin(_u * 2 * np.pi * 60 + np.sin(_u * 2 * np.pi * 7) * 2) * (0.6 + 0.4 * _grain)
M["hair"] = (pbr("CrewHair", lin("#3a2a20"), rough=0.5) if CREW else
             pbr("BossHair", (1, 1, 1), tex=image("boss_hair", (np.array([0.36, 0.23, 0.16], np.float32)[None, None, :] * _hs[..., None]).astype(np.float32)), rough=0.6))
# (the cook's trousers: a small grey-and-charcoal check, its squares square round the body)
_n = 512
_u, _v = grid01(_n)
_ck = ((np.floor(_u * 72) + np.floor(_v * 72)) % 2)[..., None]
_ck = None
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def tube(name, pts, r, mat, cyclic=False, most=None):
    """a round tube through points given in three's frame: four-sided (it's thin, and smooth shading rounds it), six-sided when it's
    thick; a long run taken at no more than `most` of its points (a closed loop 12, an open run 5, unless told)"""
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = r; cd.bevel_resolution = 0 if r < 0.02 else 1
    most = most or (12 if cyclic else 5)
    if len(pts) > most:
        k = len(pts) if cyclic else len(pts) - 1
        m = most if cyclic else most - 1
        pts = [pts[min(len(pts) - 1, round(i * k / m)) % len(pts)] for i in range(most)]
    sp = cd.splines.new("POLY"); sp.points.add(len(pts) - 1); sp.use_cyclic_u = cyclic
    for spt, q in zip(sp.points, pts):
        spt.co = (*P(*q), 1)
    cd.use_fill_caps = not cyclic
    o = bpy.data.objects.new(name, cd); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return fin(active(), name, mat)


def ribbon(name, pts, outs, width, thick, mat):
    """a flat band of cloth through points (three's frame) lying on a surface whose outward normals are `outs`: `width` across it, `thick`
    off the surface, its edges eased"""
    bm = bmesh.new()
    rows = []
    n = len(pts)
    for i, (q, o) in enumerate(zip(pts, outs)):
        t = (pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]).normalized()
        o = o.normalized()
        side = t.cross(o).normalized()
        row = []
        for (a, b) in ((-0.5, 0.0), (-0.47, 1.0), (0.47, 1.0), (0.5, 0.0)):
            row.append(bm.verts.new(P(*(q + side * width * a + o * thick * b))))
        rows.append(row)
    for i in range(n - 1):
        for k in range(3):
            bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return fin(o, name, mat)


# ---- the body: short and plump, turned on a lathe; its top a low dome the head sits down into
# (its foot shut by a ladder, its top left open up inside the head; as few rings as hold its round)
PROFILE = [(0.0, 0.0), (0.008, 0.08), (0.03, 0.155), (0.07, 0.21), (0.13, 0.246), (0.17, 0.2546), (0.24, 0.262), (0.32, 0.25),
           (0.39, 0.225), (0.44, 0.19), (0.47, 0.14)]
# (stood up taller: the body about as tall as the head is wide, as Overcooked's cooks are)
BH = 1.24
DY = 0.5 * (BH - 1)
PROFILE = [(y * BH, r) for (y, r) in PROFILE]
# (where the jacket's hem comes down to, over the trousers)
HEM = 0.17 * BH


def rb(y):
    """the body's radius at height y"""
    for (y0, r0), (y1, r1) in zip(PROFILE[1:], PROFILE[2:]):
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return PROFILE[1][1] if y < PROFILE[1][0] else 0.0


def on_body(x, y, out=0.0):
    """the point on the front of the body at (x, y), out along it"""
    r = rb(y)
    z = math.sqrt(max(r * r - x * x, 0.0))
    n = Vector((x, 0, z)).normalized() if r > 0 else Vector((0, 1, 0))
    return Vector((x, y, z)) + n * out


def lathe(name, profile, mat, seg=14, a0=0.0, a1=2 * math.pi, shut=False):
    """a piece turned round the body's axis through `profile` (height, radius), `seg` round it; `shut` closes its first ring with a ladder"""
    seg = max(6, seg)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    n = seg if full else seg + 1
    rings = []
    for (y, r) in profile:
        ring = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / seg
            ring.append(bm.verts.new(P(math.sin(a) * r, y, math.cos(a) * r)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for i in range(seg):
            i2 = (i + 1) % n
            vs = [rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]]
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            # (u round it, v up it, to the same scale: a pattern on it comes out square)
            y0, y1 = profile[j][0], profile[j + 1][0]
            for lp, uv in zip(f.loops, ((i / seg, y0 / 1.64), ((i + 1) / seg, y0 / 1.64), ((i + 1) / seg, y1 / 1.64), (i / seg, y1 / 1.64))):
                lp[uvl].uv = uv
    if shut and full:
        for f in ladder_fill(bm, rings[0][::-1]):
            for lp in f.loops:
                lp[uvl].uv = (rings[0].index(lp.vert) / seg, profile[0][0] / 1.64)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return fin(o, name, mat)


# (the trousers below, the jacket from just under its hem up, the two overlapping)
body = lathe("BossPants", [q for q in PROFILE[1:] if q[0] <= HEM + 0.04], M["pants"], seg=12, shut=True)
lathe("BossBody", [(y, r + (0.006 if y < HEM + 0.04 else 0.0)) for (y, r) in PROFILE[1:] if y >= HEM - 0.03], M["coat"], seg=12)

# ---- the head: a big ball, set down on the body
C = Vector((0.0, 0.68 + DY, 0.0))
R = 0.27
# (the owner's head 22 round, the staff's 20: what of it the tenugui, the hair and the body hide is culled at the end)
ring_ball(radius=R, segs=22 if not CREW else 20, rings=12, location=P(*C))
head = fin(active(), "BossHead", M["skin"])


def on_head(x, y, out=0.0):
    """the point on the front of the head at (x, y) (x, y measured from the head's middle), out along it; and its normal"""
    z = math.sqrt(max(R * R - x * x - y * y, 0.0))
    n = Vector((x, y, z)).normalized()
    return C + n * (R + out), n


def head_at(a, e, out=0.0):
    """the point on the head at bearing a (round from +z, toward +x) and elevation e"""
    n = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)))
    return C + n * (R + out)


# (his hair: only what shows under the tenugui, short at the sides and the nape; a light shell, its strands painted)
HT = 0.012
ring_ball(radius=R + HT, segs=16 if not CREW else 14, rings=10 if not CREW else 9, location=P(*C))
hair = active()
bm = bmesh.new(); bm.from_mesh(hair.data)
# (cut clean with planes, not face by face, so its edges are smooth lines: off in front of the ears, off under the tenugui's edge, and a
# nape line, higher at the sides than at the back)

for co, no in ((Vector(P(0, 0, 0.055)), Vector(P(0, 0, 1))),                     # (nothing in front of the ears)
               *([(Vector(P(0, 0.17, 0)), Vector(P(0, 1, 0)))] if WEAR in ("boss", "cap") else []),  # (nothing over the crown: the tenugui's there)
               (Vector(P(0, -0.15 if not FEMALE else -0.2, -R)), Vector(P(0, -1, 0.4)).normalized())):  # (the nape, rising toward the ears)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)  # (the shell's own frame: its middle at the head's)
bm.to_mesh(hair.data); bm.free()
fin(hair, "BossHair", M["hair"])
if WEAR in ("band", "bun"):
    # (the crown's hair standing a little fuller than the shell round the sides: its edge just over the brows in front, down to the nape behind)
    ring_ball(radius=R + HT * 1.3, segs=14, rings=8, location=P(*C))
    top = active()
    bm = bmesh.new(); bm.from_mesh(top.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector(P(0, -0.03 if FEMALE else 0.01, 0)),
                           plane_no=Vector(P(0, -1, 0.47 if FEMALE else 0.4)).normalized(), clear_outer=True)
    bm.to_mesh(top.data); bm.free()
    fin(top, "BossHairTop", M["hair"])
def tuft(name, at, d, r, ln, flat=1.0):
    """a lock of hair: a soft cone from `at` out along `d`, `r` across at its root, `ln` long, flattened across by `flat`"""
    d = d.normalized()
    ring_ball(radius=1, segs=6, rings=4, location=(0, 0, 0))
    o = active()
    for v in o.data.vertices:
        x, y, z = v.co.x, v.co.z, -v.co.y            # three frame, the lock along +y
        t = (y + 1) / 2                               # 0 at the root, 1 at the tip
        w = r * (1 - t) ** 0.8 + 0.002
        v.co = Vector(P(x * w, t * ln, z * w * flat))
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    o.location = P(*at)
    return fin(o, name, M["hair"])


if CREW == "server":
    # (a lock standing up on his crown, curling forward (アホ毛))
    tuft("BossHairAhoge", head_at(0.0, 1.3, -0.006), Vector((0.1, 1, 0.75)), 0.034, 0.1, 0.45)
if FEMALE:
    # (a lock down in front of each ear, framing her face)
    for sd in (-1, 1):
        root_ = head_at(sd * 1.22, 0.3, 0.006)
        tuft(f"BossHairSide{sd}", root_, Vector((sd * 0.08, -1, 0.12)), 0.03, 0.13, 0.5)
if FEMALE:
    # (her hair put up: a round bun, high at the back of the crown for the kimono, low under the cap for a cook; a lacquered comb in it)
    bq = head_at(math.pi, 0.62, 0.05) if CREW == "serverF" else head_at(math.pi, -0.05, 0.03)
    ring_ball(radius=0.085, segs=12 if CREW == "serverF" else 10, rings=5, location=P(*bq))
    o = active(); o.scale = (1.1, 0.9, 0.85)
    fin(o, "BossHairBun", M["hair"])
    if CREW == "serverF":
        cq = head_at(math.pi, 0.86, 0.06)
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(*cq))
        o = active(); o.scale = (0.12, 0.022, 0.03); o.rotation_euler = (0.5, 0, 0)
        bpy.ops.object.transform_apply(scale=True)
        fin(o, "BossComb", pbr("CrewComb", lin("#b8261c"), rough=0.3))
# (sideburns down in front of the ears)
for sd in (-1, 1):
    q = head_at(sd * math.radians(76), -0.05, 0.004)
    ring_ball(radius=1, segs=6, rings=4, location=P(*q))
    o = active(); o.scale = (0.016, 0.02, 0.045)
    fin(o, f"BossSideburn{sd}", M["hair"])

# ---- the face
EY = 0.015
for sd in (-1, 1):
    ex = sd * 0.09
    # (eyes: big dark ovals with two glints)
    p, n = on_head(ex, EY, 0.0)
    ring_ball(radius=1, segs=8, rings=4, location=P(*p))
    o = active(); o.scale = (0.016, 0.01, 0.021) if not CREW else (0.018, 0.01, 0.025)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
    fin(o, f"BossEye{sd}", M["dark"])
    if FEMALE:
        # (lashes: a little flick off the eye's outer top)
        tube(f"BossEyeLash{sd}", [on_head(ex + sd * (0.008 + 0.016 * u), EY + 0.021 + 0.004 * u * u - 0.004 * u, 0.004)[0] for u in (0, 0.5, 1)], 0.0035, M["dark"])
    # (the glints: two flat white dots on the eye, facing out)
    p, n = on_head(ex + 0.006, EY + 0.008, 0.0105)
    disc(f"BossEyeShine{sd}", p, n, 0.0055, M["white"])
    p, n = on_head(ex - 0.005, EY - 0.009, 0.0105)
    disc(f"BossEyeShineB{sd}", p, n, 0.0026, M["white"], segs=5)
    # (the glasses: a round-cornered frame round each eye, standing a little off the face)
    ring = []
    for i in range(9 if not CREW else 8):
        t = 2 * math.pi * i / (9 if not CREW else 8) + math.pi / 8
        c_, s_ = math.cos(t), math.sin(t)
        fx = ex + 0.05 * math.copysign(abs(c_) ** 0.7, c_)
        fy = EY + 0.04 * math.copysign(abs(s_) ** 0.7, s_)
        ring.append(on_head(fx, fy, 0.022)[0])
    tube(f"BossGlass{sd}", ring, 0.0055, M["frame"], cyclic=True)
    # (its arm back to the ear)
    arm = [on_head(sd * 0.143, EY + 0.012, 0.022)[0]]
    a_out = math.asin(0.143 / R)
    for k in range(1, 4):
        arm.append(head_at(sd * (a_out + (math.radians(84) - a_out) * k / 3), math.asin((EY + 0.012) / R), 0.012 + 0.01 * (1 - k / 3)))
    tube(f"BossGlassArm{sd}", arm, 0.0045, M["frame"])
    # (brows: arched and kind, over the frames)
    if not CREW:
        tube(f"BossBrow{sd}", [on_head(ex + 0.028 * (2 * u - 1), EY + 0.078 + 0.01 * (1 - (2 * u - 1) ** 2), 0.006)[0]
                               for u in [k / 8 for k in range(9)]], 0.011, M["brow"])
    else:
        tube(f"BossBrow{sd}", [on_head(ex + 0.02 * (2 * u - 1), EY + 0.068 + 0.008 * (1 - (2 * u - 1) ** 2) - sd * 0.0 * u, 0.004)[0]
                               for u in [k / 6 for k in range(7)]], 0.0065, M["brow"])
# (the bridge between the frames)
tube("BossGlassBridge", [on_head(x, EY + 0.012 + 0.006 * (1 - (x / 0.033) ** 2), 0.024)[0] for x in (-0.033, -0.017, 0, 0.017, 0.033)], 0.005, M["frame"])
# (a round nose)
p, n = on_head(0.0, -0.04, 0.012) if not CREW else on_head(0.0, -0.035, 0.002)
ring_ball(radius=0.042 if not CREW else 0.022, segs=8, rings=5, location=P(*p))
fin(active(), "BossNose", M["skin"])
# (a moustache: two soft brown wings either side under the nose)
for sd in ((-1, 1) if not CREW else ()):
    tube(f"BossMoustache{sd}", [on_head(sd * (0.012 + 0.036 * u), -0.088 + 0.008 * math.sin(math.pi * u) - 0.01 * u * u, 0.006)[0]
                                for u in [k / 8 for k in range(9)]], 0.0095, M["hair"])
# (a smile under it)
if CREW:
    M["mouth"] = pbr("BossMouth", lin("#b8483e" if FEMALE else "#6a2a20"), rough=0.6)
    tube("BossMouth", [on_head(0.017 * (2 * u - 1), -0.092 - 0.009 * (1 - (2 * u - 1) ** 2), 0.003)[0] for u in [k / 8 for k in range(9)]], 0.005, M["mouth"])
else:
    tube("BossMouth", [on_head(0.022 * (2 * u - 1), -0.118 - 0.01 * (1 - (2 * u - 1) ** 2), 0.003)[0] for u in [k / 10 for k in range(11)]], 0.0055, M["mouth"])
# (his mouth open, as he talks: a dark rounded opening, its tongue showing at the bottom; the game shows it in turn with the smile)
p, n = on_head(0.0, -0.122, -0.002)
ring_ball(radius=1, segs=6, rings=3, location=P(*p))
o = active(); o.scale = (0.026, 0.008, 0.02)
o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
fin(o, "BossMouthOpen", M["mouth"])
p, n = on_head(0.0, -0.132, 0.002)
ring_ball(radius=1, segs=6, rings=3, location=P(*p))
o = active(); o.scale = (0.016, 0.006, 0.008)
o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
fin(o, "BossMouthTongue", M["cheek"])
if CREW:
    # (a soft blush on each cheek)
    for sd in (-1, 1):
        p, n = on_head(sd * 0.135, -0.055, 0.0)
        ring_ball(radius=1, segs=6, rings=3, location=P(*p))
        o = active(); o.scale = (0.03, 0.006, 0.018)
        o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*n)).to_track_quat("Y", "Z")
        fin(o, f"BossCheek{sd}", M["cheek"])
# (ears)
for sd in (-1, 1):
    ring_ball(radius=0.048, segs=8, rings=4, location=P(sd * (R + 0.006), C.y - 0.005, -0.015))
    e = active(); e.scale = (0.45, 0.85, 0.95)
    fin(e, f"BossEar{sd}", M["skin"])

# ---- the tenugui: indigo with a white fish pressed on the front (押花), wrapped over the crown like a cap down to the brow, its front edge rolled, knotted at the back with
# its two corners sticking out
BE = math.asin(0.12 / R)
CAPPED = WEAR in ("boss", "cap")
ring_ball(radius=R + 0.02, segs=14, rings=10, location=P(*C))
cap = active()
bm = bmesh.new(); bm.from_mesh(cap.data)
gone = []
for f in bm.faces:
    c = f.calc_center_median()
    x, y, z = c.x, c.z, -c.y
    # (down to the brow at the front, lower over the ears and the back)
    edge = (R + 0.02) * math.sin(BE) - 0.07 * max(0.0, -z / (R + 0.02))
    if y < edge:
        gone.append(f)
bmesh.ops.delete(bm, geom=gone, context="FACES")
# (where on its picture the front of the crown falls, for the fish)
uvl = bm.loops.layers.uv.active
front = Vector(P(0, math.sin(0.72), math.cos(0.72)))
best = min(bm.faces, key=lambda f: (f.calc_center_median().normalized() - front).length)
u0 = sum(l[uvl].uv.x for l in best.loops) / len(best.loops)
v0 = sum(l[uvl].uv.y for l in best.loops) / len(best.loops)
bm.to_mesh(cap.data); bm.free()


def fish_mask(x, y):
    """a fish pressed in white (押花) in its own frame (nose at -x, about 1 long): its body, tail, fins, eye, gill and a line down its side left
    in the cloth's indigo, as a stencil leaves them"""
    t = (x + 0.5)
    half = 0.2 * np.sin(np.pi * np.clip(t / 0.85, 0, 1)) ** 0.75
    body = (t > 0) & (t < 0.85) & (np.abs(y) < half)
    tail = (t >= 0.78) & (t < 1.05) & (np.abs(y) < (t - 0.78) * 1.25 + 0.02) & ~((t > 0.98) & (np.abs(y) < (t - 0.98) * 3))
    dorsal = (t > 0.3) & (t < 0.62) & (y > 0) & (y < half + 0.07 * np.sin(np.pi * (t - 0.3) / 0.32))
    belly = (t > 0.45) & (t < 0.62) & (y < 0) & (-y < half + 0.04 * np.sin(np.pi * (t - 0.45) / 0.17))
    white = body | tail | dorsal | belly
    eye = np.hypot(t - 0.12, y - 0.04) < 0.028
    gill = np.abs(np.hypot(t - 0.05, y) - 0.17) < 0.012
    gill &= (t > 0.15) & (np.abs(y) < 0.14)
    # (and a fine line down its side, from the gill to the tail)
    line = (t > 0.22) & (t < 0.8) & (np.abs(y - 0.01 * np.sin(t * 9)) < 0.008)
    return (white & ~eye & ~gill & ~line).astype(np.float32)


# (the picture's pixels round the front, in the fish's frame: across is round the head at that height, up is over it, scaled so the fish
# isn't stretched; about 0.75 of a radian long)
lat = (v0 - 0.5) * math.pi
_fu, _fv = grid01(512)
fx = ((_fu - u0 + 0.5) % 1.0 - 0.5) * 2 * math.pi * math.cos(lat) / 0.75
fy = (_fv - v0) * math.pi / 0.75
mask = fish_mask(-fx, fy) * (0.0 if CREW else 1.0)
# (soft at its edge, as a print on cloth)
mask = 0.25 * mask + 0.75 * np.clip((mask + np.roll(mask, 1, 0) + np.roll(mask, -1, 0) + np.roll(mask, 1, 1) + np.roll(mask, -1, 1)) / 5, 0, 1)
_cap = np.repeat(np.repeat(_tgCap, 2, 0), 2, 1) * (1 - mask[..., None]) + np.array([0.94, 0.92, 0.86], np.float32) * mask[..., None]
M["tenuguiCap"] = pbr("BossTenuguiFish", (1, 1, 1), tex=image("boss_tenugui_fish", _cap.astype(np.float32)), rough=0.8)
fin(cap, "BossTenugui", M["tenuguiCap"])
if not CAPPED:
    parts.remove(cap)
    bpy.data.objects.remove(cap)
# (its rolled front edge: a soft roll round where it ends; a hachimaki is that roll alone, a twisted white band round the brow, lower behind)
HB = math.asin(0.105 / R)
roll = []
for i in range(10):
    a = 2 * math.pi * i / 10
    zc = math.cos(a)
    e = math.asin(max(-0.9, ((R + 0.02) * math.sin(BE) - 0.07 * max(0.0, -zc)) / (R + 0.02))) if CAPPED else HB - 0.12 * max(0.0, -zc)
    roll.append(head_at(a, e, 0.022 if CAPPED else 0.023))
if WEAR != "bun":
    tube("BossTenuguiRoll", roll, 0.013 if CAPPED else 0.017, M["tenugui"], cyclic=True, most=10)
# (the knot at the back, and its two corners: flat flaps of the cloth, hanging and flaring out)
kp = head_at(math.pi, 0.14 if CAPPED else HB - 0.12, 0.035 if CAPPED else 0.05)
ring_ball(radius=0.034, segs=8, rings=4, location=P(*kp))
k_ = active(); k_.scale = (1.35, 0.95, 0.85)
fin(k_, "BossKnot", M["tenugui"])
for k, sd in enumerate((-1, 1)):
    pts, outs = [], []
    for i in range(4):
        t = i / 3
        q = kp + Vector((sd * (0.02 + 0.07 * t), -0.02 - 0.09 * t * t, -0.025 - 0.02 * t))
        pts.append(q); outs.append(Vector((sd * 0.3, 0.1, -1)))
    o = ribbon(f"BossKnotEnd{k}", pts, outs, 0.045 if CAPPED else 0.032, 0.006, M["tenugui"])
if WEAR == "bun":
    for o in [x for x in parts if x.name.startswith("BossKnot")]:
        parts.remove(o); bpy.data.objects.remove(o)

# ---- the kappōgi's collar: wide flat bands crossed left over right on the chest, lying on it; the indigo under-collar at the neck
def body_out(q):
    return Vector((q.x, 0, q.z)).normalized() + Vector((0, 0.35, 0))


under = [on_body(0.1 - 0.1 * u, 0.43 + DY - 0.11 * u, 0.002) for u in [k / 4 for k in range(5)]]
ribbon("BossCollarUnder", under, [body_out(q) for q in under], 0.05, 0.008, M["collar"])
over = [on_body(-0.1 + 0.24 * u, 0.43 + DY - 0.19 * u, 0.008) for u in [k / 5 for k in range(6)]]
ribbon("BossCollarOver", over, [body_out(q) for q in over], 0.055, 0.008, M["collar"])
neck = [on_body(-0.08 + 0.16 * u, 0.44 + DY - 0.055 * (1 - abs(2 * u - 1)), 0.001) for u in [k / 4 for k in range(5)]]
ribbon("BossCollarUnderNeck", neck, [body_out(q) for q in neck], 0.03, 0.006, M["pants"])
# (the jacket's hem: a band standing a hair proud of the trousers all round; the cord pressed round the waist, its bow at his left)
lathe("BossHem", [(HEM - 0.016, rb(HEM - 0.016) + 0.002), (HEM, rb(HEM) + 0.009), (HEM + 0.016, rb(HEM + 0.016) + 0.002)], M["coat"], seg=12)
BELT = 0.235 * BH
tube("BossCord", [Vector((math.sin(2 * math.pi * i / 11) * (rb(BELT) + 0.009), BELT, math.cos(2 * math.pi * i / 11) * (rb(BELT) + 0.009)))
                  for i in range(11)], 0.008, M["cord"], cyclic=True, most=11)
ba = math.radians(60)
bc = Vector((math.sin(ba) * (rb(BELT) + 0.02), BELT, math.cos(ba) * (rb(BELT) + 0.02)))
side_ = Vector((math.cos(ba), 0, -math.sin(ba)))
for sd in (-1, 1):
    tube(f"BossCordBow{sd}", [bc + side_ * sd * 0.03 * math.sin(math.pi * u) + Vector((0, 0.022 * math.sin(2 * math.pi * u), 0)) * sd
                              for u in [k / 4 for k in range(5)]], 0.007, M["cord"])
    tube(f"BossCordTail{sd}", [bc + side_ * sd * 0.012 * u + Vector((0, -0.05 * u, 0.01 * u)) for u in (0, 0.5, 1)], 0.006, M["cord"])
if CREW == "serverF":
    # (the kimono's obi: a wide gold band round the waist, a little proud)
    M["obi"] = pbr("CrewObi", lin("#d8a840"), rough=0.5)
    lathe("BossObi", [(BELT - 0.06, rb(BELT - 0.06) + 0.004), (BELT - 0.055, rb(BELT - 0.055) + 0.014), (BELT + 0.055, rb(BELT + 0.055) + 0.014),
                      (BELT + 0.06, rb(BELT + 0.06) + 0.004)], M["obi"], seg=12)
    M["obijime"] = pbr("CrewObijime", lin("#c8302a"), rough=0.5)
    tube("BossObiCord", [Vector((math.sin(2 * math.pi * i / 9) * (rb(BELT) + 0.019), BELT, math.cos(2 * math.pi * i / 9) * (rb(BELT) + 0.019))) for i in range(9)],
         0.006, M["obijime"], cyclic=True, most=9)
    # (the taiko knot: a block on her back, its edges rounded off (a box, its corners bevelled once))
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, BELT + 0.03, -(rb(BELT) + 0.035)))
    o = active(); o.scale = (0.24, 0.07, 0.17)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.022; bv.segments = 1
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier="b")
    fin(o, "BossObiKnot", M["obi"])
# (the apron (前掛け): navy, from the cord down over his front nearly to the ground, a little proud of him; 聞野 on it in white)
AP = [(y, rb(y) + 0.015) for y in (0.04, 0.13, HEM, BELT - 0.004)]
if CREW == "server":
    # (shorter: to the knee, as a server's is)
    AP = [(y, rb(y) + 0.015) for y in (0.09, HEM, BELT - 0.004)]
AP_A = math.radians(68)
ap = lathe("BossApron", AP, M["apron"], seg=6, a0=-AP_A, a1=AP_A)
# (its picture over the whole of it: across its width, up its height (a pixel as wide as it's tall), so the 聞野 written into it is sharp)
AP_W, AP_H = 2 * AP_A * (rb(0.15) + 0.015), AP[-1][0] - AP[0][0]
for lp in ap.data.uv_layers.active.data:
    lp.uv = (lp.uv.x, (lp.uv.y * 1.64 - AP[0][0]) / AP_H)
so = ap.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.005
bpy.context.view_layer.objects.active = ap
bpy.ops.object.modifier_apply(modifier="t")
# (聞野 in white on it, as the letters were (the font's at the size they stood, a little above its middle): the letters made as a mesh once,
# each of its triangles filled into the picture, the mesh let go: two letters were five hundred triangles)
_aw, _ah = 512, max(64, round(512 * AP_H / AP_W))
_ap = _weave_at(APRON, _aw, _ah, 0.12, 128)
if CREW not in ("serverF", "stock"):
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = active()
    tx.data.body = "聞野"
    JP = bpy.data.fonts.load("C:/Windows/Fonts/YuGothB.ttc") if os.path.exists("C:/Windows/Fonts/YuGothB.ttc") else None
    if JP:
        tx.data.font = JP
    tx.data.size = 0.075
    tx.data.resolution_u = 6
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    bpy.ops.object.convert(target="MESH")
    tx = active()
    _tb = bmesh.new(); _tb.from_mesh(tx.data)
    bmesh.ops.triangulate(_tb, faces=_tb.faces[:])
    # (the letters' middle on the apron: half across it, at 0.15 up the body)
    _cu, _cv = 0.5, (0.15 - AP[0][0]) / AP_H
    _mask = np.zeros((_ah, _aw), np.float32)
    _yy, _xx = np.mgrid[0:_ah, 0:_aw].astype(np.float32)
    for f in _tb.faces:
        q = [((_cu + l.vert.co.x / AP_W) * _aw, (_cv + l.vert.co.y / AP_H) * _ah) for l in f.loops]
        x0, x1 = int(max(0, min(t[0] for t in q) - 1)), int(min(_aw, max(t[0] for t in q) + 2))
        y0, y1 = int(max(0, min(t[1] for t in q) - 1)), int(min(_ah, max(t[1] for t in q) + 2))
        if x1 <= x0 or y1 <= y0:
            continue
        X, Y = _xx[y0:y1, x0:x1] + 0.5, _yy[y0:y1, x0:x1] + 0.5
        (ax, ay), (bx, by), (cx, cy) = q
        d1 = (bx - ax) * (Y - ay) - (by - ay) * (X - ax)
        d2 = (cx - bx) * (Y - by) - (cy - by) * (X - bx)
        d3 = (ax - cx) * (Y - cy) - (ay - cy) * (X - cx)
        inside = ((d1 >= 0) & (d2 >= 0) & (d3 >= 0)) | ((d1 <= 0) & (d2 <= 0) & (d3 <= 0))
        _mask[y0:y1, x0:x1] = np.maximum(_mask[y0:y1, x0:x1], inside.astype(np.float32))
    _tb.free()
    bpy.data.objects.remove(tx)
    # (its edge soft, as a print's)
    _mask = 0.4 * _mask + 0.6 * np.clip((_mask + np.roll(_mask, 1, 0) + np.roll(_mask, -1, 0) + np.roll(_mask, 1, 1) + np.roll(_mask, -1, 1)) / 5, 0, 1)
    _ap = _ap * (1 - _mask[..., None]) + np.array([0.94, 0.92, 0.86], np.float32) * _mask[..., None]
# (the plain cloth it was turned in let go first, so this one keeps the name)
ap.data.materials.clear()
bpy.data.materials.remove(M["apron"])
M["apron"] = pbr("BossApron", (1, 1, 1), tex=image(f"{CREW or 'boss'}_apron", _ap.astype(np.float32)), rough=0.85)
ap.data.materials.append(M["apron"])
if CREW in ("serverF", "stock"):
    for o in [x for x in parts if x.name == "BossApron"]:
        parts.remove(o); bpy.data.objects.remove(o)
if CREW == "serverF":
    for o in [x for x in parts if x.name.startswith("BossCord")]:
        parts.remove(o); bpy.data.objects.remove(o)

# ---- the little things about him
M["gold"] = pbr("BossGold", lin("#e0b040"), rough=0.3, metal=1.0) if "metal" in pbr.__code__.co_varnames else pbr("BossGold", lin("#e0b040"), rough=0.3)
M["towel"] = pbr("BossTowel", lin("#f4f1e8"), rough=0.8)
M["blue"] = pbr("BossTowelBlue", lin("#2c4a8a"), rough=0.8)
M["pencil"] = pbr("BossPencil", lin("#f2c230"), rough=0.6)
M["pink"] = pbr("BossEraser", lin("#ec8a9a"), rough=0.7)
_before_bits = len(parts)
# (a little gold fish pinned on his chest, his left)
fp = on_body(0.12, 0.33 * BH + 0.06, 0.012)
ring_ball(radius=1, segs=6, rings=3, location=P(*fp))
o = active(); o.scale = (0.028, 0.008, 0.016)
fin(o, "BossPinFish", M["gold"])
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.016, radius2=0.0, depth=0.02, location=P(*(fp + Vector((0.032, 0, 0)))))
o = active(); o.rotation_euler = (0, math.pi / 2, 0); o.scale = (1, 0.4, 1)
fin(o, "BossPinTail", M["gold"], smooth=False)
disc("BossPinEye", fp + Vector((-0.015, 0.004, 0.0085)), Vector((0, 0, 1)), 0.003, M["dark"], segs=5)
# (a hand towel (手拭い) tucked under the cord at his right, hanging down, two blue stripes across it)
ta = math.radians(-62)
tt = Vector((math.sin(ta) * (rb(BELT) + 0.012), BELT, math.cos(ta) * (rb(BELT) + 0.012)))
tw = Vector((math.cos(ta), 0, -math.sin(ta)))
for k, (y0, y1, mat, out) in enumerate(((0.0, 0.17, M["towel"], 0.0), (0.035, 0.05, M["blue"], 0.004), (0.12, 0.135, M["blue"], 0.004))):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*(tt + Vector((0, -(y0 + y1) / 2 + 0.01, 0)) + Vector((math.sin(ta), 0, math.cos(ta))) * (0.006 + out))))
    o = active(); o.scale = (0.075 + out * 2, 0.012 + out, y1 - y0)
    o.rotation_euler = (0, 0, ta)
    bpy.ops.object.transform_apply(scale=True)
    fin(o, f"BossTowel{k}", mat, smooth=False)
# (a pencil behind his right ear)
ep = Vector((-(R - 0.01), C.y + 0.03, -0.0))
d = Vector((0.15, 0.95, -0.35)).normalized()
for k, (off, ln, r, mat) in enumerate(((0.0, 0.11, 0.007, M["pencil"]),)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r, depth=ln, location=P(*(ep + d * off)))
    o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    fin(o, "BossPencil", mat, smooth=False)
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0072, depth=0.014, location=P(*(ep + d * 0.062)))
o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
fin(o, "BossPencilEraser", M["pink"])
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.007, radius2=0.0, depth=0.022, location=P(*(ep - d * 0.066)))
o = active(); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector(P(*(-d))).to_track_quat("Z", "Y")
fin(o, "BossPencilTip", M["towel"], smooth=False)

if CREW:
    for o in [x for x in parts[_before_bits:] if x.name.startswith(("BossPin", "BossPencil")) or (CREW not in ("chef", "chefF", "stock") and x.name.startswith("BossTowel"))]:
        parts.remove(o); bpy.data.objects.remove(o)

if CREW == "stock":
    # (a towel round his neck, its two ends down his front)
    M["towel"] = pbr("BossTowel", lin("#f4f1e8"), rough=0.8)
    NY = 0.575
    tube("BossNeckTowel", [Vector((math.sin(2 * math.pi * i / 12) * 0.172, NY + 0.015 * math.cos(2 * math.pi * i / 12), math.cos(2 * math.pi * i / 12) * 0.172)) for i in range(12)],
         0.019, M["towel"], cyclic=True)
    for sd in (-1, 1):
        pts = [on_body(sd * (0.075 + 0.01 * u), NY - 0.01 - 0.15 * u, 0.012) for u in (0, 0.33, 0.66, 1)]
        ribbon(f"BossNeckTowelEnd{sd}", pts, [body_out(q) for q in pts], 0.05, 0.008, M["towel"])

# ---- hands: floating mittens as Overcooked's, a plump rounded paddle (the fingers together, curled a little) and a thumb of its own,
# hanging at his sides; each its own node so the game can swing them, raise them, hold things in them
hands = {}
HAND_AT = {-1: Vector((-0.31, 0.26, 0.05)), 1: Vector((0.31, 0.26, 0.05))}
for sd, at in HAND_AT.items():
    ring_ball(radius=1, segs=9, rings=5, location=(0, 0, 0))
    h = active()
    # (the paddle: wider than thick, longest down the fingers; the finger end fuller, curled in toward the palm)
    for v in h.data.vertices:
        x, y, z = v.co.x, v.co.z, -v.co.y          # three frame: y along the fingers (down), x across, z thickness
        w = 1.0 + 0.12 * (-y)                       # fuller at the finger end (y < 0)
        v.co = Vector(P(x * 0.05 * w, y * 0.06, z * 0.036))
        cz = 0.016 * max(0.0, -y) ** 2            # the fingers curling forward
        v.co += Vector(P(0, 0, cz))
    h.location = P(*at)
    h.rotation_euler = (0, -sd * 0.25, 0)
    if CREW == "stock" and "glove" not in M:
        M["glove"] = pbr("CrewGlove", lin("#e6e1d2"), rough=0.9)
    hn = fin(h, f"BossHand{'L' if sd < 0 else 'R'}Mitt", M["glove"] if CREW == "stock" else M["skin"])
    # (the thumb: a short rounded stub out from the side of the palm, toward the front)
    ring_ball(radius=1, segs=6, rings=3, location=P(*(at + Vector((-sd * 0.036, 0.014, 0.024)))))
    th = active(); th.scale = (0.019, 0.019, 0.03)
    th.rotation_euler = (0.5, 0, -sd * 0.6)
    th = fin(th, f"BossHand{'L' if sd < 0 else 'R'}Thumb", M["glove"] if CREW == "stock" else M["skin"])
    e = bpy.data.objects.new(f"BossHand{'L' if sd < 0 else 'R'}", None)
    bpy.context.collection.objects.link(e)
    bpy.context.view_layer.update()
    for o in (hn, th):
        mw = o.matrix_world.copy(); o.parent = e; o.matrix_world = mw
    hands[sd] = e

# ---- what he holds (shown by the game when he holds it): long steel tongs and a round paper fan (団扇), each its own node with its grip
# at the node's origin, the tongs pointing forward (+z), the fan's face up the +y
props = []
tg = bpy.data.objects.new("BossTongs", None); bpy.context.collection.objects.link(tg)
for sd in (-1, 1):
    pts = [Vector((sd * 0.004, 0, -0.02)), Vector((sd * 0.011, 0, 0.12)), Vector((sd * 0.006, -0.004, 0.2))]
    o = tube(f"BossTongsArm{sd}", pts, 0.0035, M["frame"])
    o.parent = tg
tube("BossTongsHinge", [Vector((-0.006, 0, -0.024)), Vector((0.006, 0, -0.024))], 0.006, M["frame"]).parent = tg
props.append(tg)
fan = bpy.data.objects.new("BossFan", None); bpy.context.collection.objects.link(fan)
# (the fan: a round of paper on its handle, the bamboo ribs fanning up from the handle's top and the red rim painted on the paper (they were
# ten little tubes and a ring of forty): one thin twelve-sided slab, the picture on both its faces)
_fn = 128
_fu, _fv = grid01(_fn)
_fx, _fy = (_fu - 0.5) * 2, (_fv - 0.5) * 2
_fr = np.hypot(_fx, _fy)
_fp = np.repeat(np.array([0.965, 0.935, 0.88], np.float32)[None, None, :], _fn, 0).repeat(_fn, 1)
# (from the handle's top, below the paper's middle, the ribs spread out to the rim)
_hx, _hy = 0.0, (0.035 - 0.1) / 0.07
_ang = np.arctan2(_fx - _hx, _fy - _hy)
for k in range(9):
    a_ = math.radians(-80 + 20 * k)
    rib = np.abs(np.sin(_ang - a_)) * np.hypot(_fx - _hx, _fy - _hy) < 0.022
    rib &= np.cos(_ang - a_) > 0
    _fp[rib] = (0.78, 0.66, 0.42)
_fp[(_fr > 0.9) & (_fr <= 1.0)] = (0.77, 0.27, 0.18)
bpy.data.materials.remove(M["fan"])
M["fan"] = pbr("BossFanPaper", (1, 1, 1), tex=image(f"{CREW or 'boss'}_fan", _fp.astype(np.float32)), rough=0.7)
_bm = bmesh.new()
_uvl = _bm.loops.layers.uv.new()
_N = 12
for zz in (-0.002, 0.002):
    ring_ = [_bm.verts.new(P(math.sin(2 * math.pi * i / _N) * 0.07, 0.1 + math.cos(2 * math.pi * i / _N) * 0.07, zz)) for i in range(_N)]
    for f in ladder_fill(_bm, ring_ if zz > 0 else ring_[::-1]):
        for lp in f.loops:
            x_, y_ = lp.vert.co.x, lp.vert.co.z
            lp[_uvl].uv = (x_ / 0.14 + 0.5, (y_ - 0.1) / 0.14 + 0.5)
_bm.verts.ensure_lookup_table()
for i in range(_N):
    a_, b_, c_, d_ = _bm.verts[i], _bm.verts[(i + 1) % _N], _bm.verts[_N + (i + 1) % _N], _bm.verts[_N + i]
    f = _bm.faces.new((a_, b_, c_, d_))
    for lp in f.loops:
        lp[_uvl].uv = (0.5, 0.01)
bmesh.ops.recalc_face_normals(_bm, faces=_bm.faces)
_me = bpy.data.meshes.new("BossFanPaper"); _bm.to_mesh(_me); _bm.free()
fp = bpy.data.objects.new("BossFanPaper", _me); bpy.context.collection.objects.link(fp)
fin(fp, "BossFanPaper", M["fan"], smooth=False).parent = fan
tube("BossFanHandle", [Vector((0, -0.03, 0)), Vector((0, 0.035, 0))], 0.006, M["bamboo"]).parent = fan
props.append(fan)

from mathutils.bvhtree import BVHTree  # noqa: E402


def cull_hidden(o, covers, reach=0.07):
    """delete the faces of `o` that can't be seen: from a face's middle and from near each of its corners, rays out along its normal and
    tilted 35 degrees four ways round it all meet one of `covers` within `reach` (it's under them, or inside them)"""
    covers = [c for c in covers if c is not None and c is not o]
    if not covers:
        return 0
    deps = bpy.context.evaluated_depsgraph_get()
    vs, fs = [], []
    for c in covers:
        me_ = c.evaluated_get(deps).to_mesh()
        base = len(vs)
        vs += [c.matrix_world @ v.co for v in me_.vertices]
        fs += [[base + i for i in pl.vertices] for pl in me_.polygons]
        c.evaluated_get(deps).to_mesh_clear()
    tree = BVHTree.FromPolygons(vs, fs)
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    bm_ = bmesh.new(); bm_.from_mesh(o.data)
    gone = []
    for f in bm_.faces:
        n = (nm @ f.normal).normalized()
        a = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
        b = n.cross(a)
        dirs = [n] + [(n + d * math.tan(math.radians(35))).normalized() for d in (a, -a, b, -b)]
        c0 = f.calc_center_median()
        pts = [c0] + [c0 + (v.co - c0) * 0.8 for v in f.verts]
        if all(tree.ray_cast(mw @ q + n * 0.001, d, reach)[0] is not None for q in pts for d in dirs):
            gone.append(f)
    bmesh.ops.delete(bm_, geom=gone, context="FACES")
    bm_.to_mesh(o.data); bm_.free()
    return len(gone)


bpy.context.view_layer.update()
_by = {o.name: o for o in parts}
_cut = {}
_cut["BossHead"] = cull_hidden(_by.get("BossHead"), [_by.get(n) for n in ("BossTenugui", "BossTenuguiRoll", "BossHair", "BossHairTop", "BossHairBun",
                                                                         "BossBody", "BossPants", "BossEar1", "BossEar-1", "BossSideburn1", "BossSideburn-1", "BossKnot")])
_cut["BossPants"] = cull_hidden(_by.get("BossPants"), [_by.get(n) for n in ("BossBody", "BossHem", "BossApron")])
_cut["BossBody"] = cull_hidden(_by.get("BossBody"), [_by.get(n) for n in ("BossHead", "BossApron", "BossCollarOver", "BossCollarUnder")])
_cut["BossHair"] = cull_hidden(_by.get("BossHair"), [_by.get(n) for n in ("BossTenugui", "BossTenuguiRoll", "BossHairTop", "BossEar1", "BossEar-1")])
print("CULLED", _cut)
root = bpy.data.objects.new("Crew" if CREW else "Boss", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root
for e in list(hands.values()) + props:
    e.parent = root
if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    # (where the preview looks from: PREVIEW_CAM="x,y,z" in three's frame, or a little above and in front)
    cam.location = P(*map(float, os.environ.get("PREVIEW_CAM", "0.3,1.6,1.6").split(",")))
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(P(0, 0.5, 0)) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 42
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
    bpy.context.scene.world = w
OUT = f"crew_{CREW}" if CREW else "boss"
export_dish(root, parts + list(hands.values()) + props + [root], os.path.join(PROJECT, "public", "models", f"{OUT}.glb"), os.path.join(PROJECT, "blender", f"{OUT}.blend"), PREVIEW)
print("BOSS_DONE", sum(len(o.data.polygons) for o in parts))
