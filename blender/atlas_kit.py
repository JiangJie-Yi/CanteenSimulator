"""One picture for many small things (item 353, the owner's, 2026-11-19: 「品質不OK」 over the rice-ball counter: its things were plain boxes
and cylinders in flat colours, a material each): an atlas of painted cells, each thing's UVs laid into its own cell, all of them one material
(one draw in the game, after it's merged by material). And the meshes that go with it, each made with its UVs: turned things (round the
upright axis: their picture round them, or laid flat over them from above), boxes (each face its picture fitted to the box's size), flat
outlines given a thickness (a paddle, a slice).

The game's frame (three's) throughout: y up; P() puts it into Blender's.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from common import fbm, grid01, image, mix, pbr, smooth, vnoise  # noqa: F401


def P(x, y, z):
    return Vector((x, -z, y))


class Atlas:
    """cells of `unit` px on a grid; put() paints one (w x h units) where it fits, row by row from the bottom left"""

    def __init__(self, name, size=(1024, 1024), unit=128):
        self.name, self.unit = name, unit
        self.W, self.H = size
        self.cols, self.rows = self.W // unit, self.H // unit
        self.used = np.zeros((self.rows, self.cols), bool)
        self.px = np.zeros((self.H, self.W, 3), np.float32)
        self.rect = {}
        self.mat = None

    def put(self, key, w, h, painter):
        for r in range(self.rows - h + 1):
            for c in range(self.cols - w + 1):
                if not self.used[r:r + h, c:c + w].any():
                    self.used[r:r + h, c:c + w] = True
                    pw, ph = w * self.unit, h * self.unit
                    sq = max(pw, ph)
                    img = np.clip(np.asarray(painter(sq, sq), np.float32), 0, 1)
                    # (a painter that only paints squares: its picture squeezed to the cell, nearest pixel)
                    if img.shape[:2] != (ph, pw):
                        ri = (np.arange(ph) * img.shape[0] / ph).astype(int)
                        ci = (np.arange(pw) * img.shape[1] / pw).astype(int)
                        img = img[ri][:, ci]
                    assert img.shape == (ph, pw, 3), (key, img.shape)
                    self.px[r * self.unit:r * self.unit + ph, c * self.unit:c * self.unit + pw] = img
                    # (inset by a pixel and a half, so a cell's edge never samples its neighbour)
                    e = 1.5
                    self.rect[key] = ((c * self.unit + e) / self.W, (r * self.unit + e) / self.H,
                                      (pw - 2 * e) / self.W, (ph - 2 * e) / self.H)
                    return
        raise RuntimeError(f"atlas {self.name} full at {key}")

    def material(self, rough=0.6):
        if self.mat is None:
            self.mat = pbr(self.name, (1, 1, 1), tex=image(self.name.lower(), self.px), rough=rough)
        return self.mat

    def uv_to(self, o, key):
        """the object's UVs (0..1) laid into cell `key`"""
        u0, v0, du, dv = self.rect[key]
        uvl = o.data.uv_layers.active
        for d in uvl.data:
            x, y = d.uv
            d.uv = (u0 + min(1.0, max(0.0, x)) * du, v0 + min(1.0, max(0.0, y)) * dv)
        return o


def _obj(bm, name, parts, mat, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    # (None: each face as it was made)
    if smooth_shade is not None:
        for p in o.data.polygons:
            p.use_smooth = smooth_shade
    parts.append(o)
    return o


def ladder(bm, ring):
    """a ring closed with a ladder of quads across it (never a fan into a point)"""
    n = len(ring)
    faces = [bm.faces.new((ring[0], ring[1], ring[n - 1]))]
    lo, hi = 1, n - 1
    while hi - lo > 2:
        faces.append(bm.faces.new((ring[lo], ring[lo + 1], ring[hi - 1], ring[hi])))
        lo += 1
        hi -= 1
    if hi - lo == 2:
        faces.append(bm.faces.new((ring[lo], ring[lo + 1], ring[hi])))
    return faces


def turned(name, x, y0, z, prof, parts, mat, segs=16, cap=True, uv="cyl", R=None, flat_cap=True):
    """a thing turned about the upright axis at (x, z), its foot at y0: `prof` (radius, height) from the first ring to the last (the last
    closed with a ladder if `cap`); its UVs: `cyl` round it (u the angle, v along the profile), or `polar` laid over it from above (the
    profile's widest `R` the cell's edge)"""
    bm = bmesh.new()
    rings = []
    for r_, h_ in prof:
        rings.append([bm.verts.new(P(x + r_ * math.cos(2 * math.pi * i / segs), y0 + h_, z + r_ * math.sin(2 * math.pi * i / segs)))
                      for i in range(segs)])
    faces = []
    for k, (a_, b_) in enumerate(zip(rings, rings[1:])):
        for i in range(segs):
            f = bm.faces.new((a_[i], a_[(i + 1) % segs], b_[(i + 1) % segs], b_[i]))
            f.smooth = True
            faces.append((f, k, i))
    caps = ladder(bm, rings[-1]) if cap and prof[-1][0] > 1e-4 else []
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    R = R or max(r_ for r_, _ in prof)
    # (along the profile: its length, for v)
    acc = [0.0]
    for (r0, h0), (r1, h1) in zip(prof, prof[1:]):
        acc.append(acc[-1] + math.hypot(r1 - r0, h1 - h0))
    L = acc[-1] or 1.0
    ring_of = {}
    for k, ring in enumerate(rings):
        for i, vt in enumerate(ring):
            ring_of[vt] = (k, i)
    for f in bm.faces:
        for lp in f.loops:
            k, i = ring_of[lp.vert]
            if uv == "polar" or f in caps:
                c = lp.vert.co
                gx, gz = c.x - x, -c.y - z
                lp[uvl].uv = (0.5 + gx / (2 * R), 0.5 + gz / (2 * R))
            else:
                # (the seam: the last column's loops at 1, not 0)
                ii = i
                if any(ring_of[l2.vert][1] == segs - 1 for l2 in f.loops) and i == 0:
                    ii = segs
                lp[uvl].uv = (ii / segs, acc[k] / L)
    for f in caps:
        f.smooth = not flat_cap
    return _obj(bm, name, parts, mat, smooth_shade=None)


def boxed(name, x0, x1, y0, y1, z0, z1, parts, mat, bev=0.0, segs=1):
    """a box (its edges rounded by `bev`), each face's UVs its picture fitted to the box's size on that side"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vt in bm.verts:
        cx, cy, cz = vt.co
        gx = x0 + (cx + 0.5) * (x1 - x0)
        gz = z0 + (0.5 - cy) * (z1 - z0)
        gy = y0 + (cz + 0.5) * (y1 - y0)
        vt.co = P(gx, gy, gz)
    if bev:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bev, segments=segs, profile=0.5, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        for lp in f.loops:
            c = lp.vert.co
            gx, gy, gz = c.x, c.z, -c.y
            ux, uy, uz = (gx - x0) / (x1 - x0), (gy - y0) / (y1 - y0), (gz - z0) / (z1 - z0)
            if abs(n.z) >= max(abs(n.x), abs(n.y)):        # (up or down)
                lp[uvl].uv = (ux, uz)
            elif abs(n.x) >= abs(n.y):                     # (its ends, along x)
                lp[uvl].uv = (uz, uy)
            else:                                          # (its front or back)
                lp[uvl].uv = (ux, uy)
    return _obj(bm, name, parts, mat, smooth_shade=False)


def slab(name, pts, y0, thick, parts, mat, x=0.0, z=0.0, turn=0.0, side_v=None):
    """a flat outline (`pts`, (x, z) round it in order, convex or not, no fan: its faces a strip between its two halves) given a thickness
    up from y0, turned `turn` about the upright and set at (x, z); top and bottom its picture laid flat over its box, its edge a strip"""
    bm = bmesh.new()
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    bx0, bx1, bz0, bz1 = min(xs), max(xs), min(zs), max(zs)
    ca, sa = math.cos(turn), math.sin(turn)

    def at(px, pz, y):
        return P(x + px * ca - pz * sa, y, z + px * sa + pz * ca)
    lo = [bm.verts.new(at(px, pz, y0)) for px, pz in pts]
    hi = [bm.verts.new(at(px, pz, y0 + thick)) for px, pz in pts]
    n = len(pts)
    top = ladder(bm, hi)
    bot = ladder(bm, lo[::-1])
    sides = [bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new("UVMap")
    idx = {vt: i for i, vt in enumerate(lo)}
    idx.update({vt: i for i, vt in enumerate(hi)})
    for f in top + bot:
        for lp in f.loops:
            px, pz = pts[idx[lp.vert]]
            lp[uvl].uv = ((px - bx0) / (bx1 - bx0 + 1e-9), (pz - bz0) / (bz1 - bz0 + 1e-9))
    for k, f in enumerate(sides):
        for lp in f.loops:
            i = idx[lp.vert]
            px, pz = pts[i]
            lp[uvl].uv = ((px - bx0) / (bx1 - bx0 + 1e-9), 0.02 if lp.vert in lo else (side_v or 0.06))
    for f in top + bot:
        f.smooth = False
    return _obj(bm, name, parts, mat, smooth_shade=False)


# ---------------------------------------------------------------------------------------------------- pictures
def _rng(k):
    return np.random.default_rng(k)


def p_rice(w, h):
    """cooked rice: grains packed close, each a little dome lit from the upper left, the gaps between them a shade darker and warmer"""
    rr = _rng(3531)
    hgt = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n = int(w * h / 26)
    for _ in range(n):
        cx, cy = rr.uniform(0, w), rr.uniform(0, h)
        a = rr.uniform(0, math.pi)
        L, W = rr.uniform(4.6, 6.4) * w / 256, rr.uniform(2.1, 2.9) * w / 256
        x0, x1 = int(max(0, cx - L - 1)), int(min(w, cx + L + 2))
        y0, y1 = int(max(0, cy - L - 1)), int(min(h, cy + L + 2))
        if x1 <= x0 or y1 <= y0:
            continue
        dx, dy = xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy
        p = (dx * math.cos(a) + dy * math.sin(a)) / L
        q = (-dx * math.sin(a) + dy * math.cos(a)) / W
        dome = np.sqrt(np.clip(1 - (p * p + q * q), 0, 1)) * rr.uniform(0.75, 1.0)
        hgt[y0:y1, x0:x1] = np.maximum(hgt[y0:y1, x0:x1], dome)
    gx = np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)
    gy = np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)
    lit = np.clip(0.75 - 0.55 * gx + 0.55 * gy, 0.35, 1.1)
    base = np.array((0.95, 0.945, 0.915), np.float32)
    col = base[None, None, :] * (0.8 + 0.2 * smooth(0.0, 0.5, hgt))[..., None] * (0.9 + 0.13 * lit)[..., None]
    gap = 1 - smooth(0.02, 0.3, hgt)
    col = mix(col, (0.79, 0.76, 0.69), gap * 0.75)
    return col


def p_nori(w, h):
    rr = _rng(3532)
    col = np.array((0.07, 0.11, 0.075), np.float32)[None, None, :] * (0.7 + 0.6 * fbm(w, 26, 26, 3))[..., None]
    # (the pressed sheet's fibres, its faint sheen, a greener fleck)
    fib = np.sin((grid01(w)[1] * 60 + fbm(w, 3, 9, 3) * 4) * 2 * math.pi) * 0.5 + 0.5
    col = col * (0.9 + 0.16 * fib)[..., None]
    col = mix(col, (0.18, 0.27, 0.14), smooth(0.84, 0.92, vnoise(w, 70, 70)) * 0.55)
    return col


def p_hinoki(w, h):
    """the hinoki board: pale, a fine straight grain along it, its late wood a little darker, fine knife marks crossing it"""
    u, v = grid01(w)
    g = np.sin((v * 46 + (fbm(w, 2, 6, 4) - 0.5) * 1.6) * 2 * math.pi) * 0.5 + 0.5
    col = mix((0.94, 0.86, 0.69), (0.83, 0.71, 0.52), smooth(0.72, 1.0, g) * 0.7)
    col = col * (0.95 + 0.07 * fbm(w, 3, 14, 3))[..., None]
    rr = _rng(3533)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for _ in range(60):
        cx, cy, a, L = rr.uniform(0.15, 0.85) * w, rr.uniform(0.15, 0.85) * h, rr.uniform(0, math.pi), rr.uniform(0.04, 0.16) * w
        dx, dy = xx - cx, yy - cy
        along = dx * math.cos(a) + dy * math.sin(a)
        across = -dx * math.sin(a) + dy * math.cos(a)
        m = (np.abs(across) < 0.6) * (np.abs(along) < L)
        col = mix(col, (0.74, 0.62, 0.45), m * rr.uniform(0.15, 0.35))
    return col


def p_dish(w, h):
    """a small sometsuke dish from above: white glaze, a cobalt band at its rim and a fine line in from it, a plum blossom in its well"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x, y = (xx + 0.5) / w * 2 - 1, (yy + 0.5) / h * 2 - 1
    r = np.hypot(x, y)
    col = np.ones((h, w, 3), np.float32) * np.array((0.95, 0.95, 0.925), np.float32)
    col = col * (0.97 + 0.04 * fbm(w, 5, 5, 3))[..., None]
    cob, wash = (0.16, 0.24, 0.55), (0.62, 0.7, 0.88)
    col = mix(col, cob, (smooth(0.84, 0.86, r) * (1 - smooth(0.95, 0.97, r))))
    col = mix(col, cob, (np.abs(r - 0.77) < 0.012).astype(np.float32) * 0.9)
    petal = np.zeros_like(r)
    ring = np.zeros_like(r)
    for k in range(5):
        a = math.pi / 2 + k * 2 * math.pi / 5
        d = np.hypot(x - 0.2 * math.cos(a), y - 0.2 * math.sin(a))
        petal = np.maximum(petal, (d < 0.15).astype(np.float32))
        ring = np.maximum(ring, (np.abs(d - 0.15) < 0.018).astype(np.float32))
    col = mix(col, wash, petal * 0.45)
    col = mix(col, cob, ring * 0.95)
    col = mix(col, cob, (np.hypot(x, y) < 0.05).astype(np.float32))
    # (the unglazed foot ring, seen as the outside's bottom maps here)
    return col


def p_ume(w, h):
    col = mix((0.5, 0.05, 0.07), (0.74, 0.13, 0.12), fbm(w, 6, 6, 4))
    wr = np.abs(vnoise(w, 9, 9) - 0.5) < 0.035
    col = mix(col, (0.33, 0.02, 0.04), wr.astype(np.float32) * 0.8)
    col = mix(col, (0.93, 0.5, 0.46), smooth(0.86, 0.95, vnoise(w, 7, 7)) * 0.35)
    return col


def p_salmon(w, h):
    u, v = grid01(w)
    col = mix((0.93, 0.5, 0.36), (0.99, 0.72, 0.56), smooth(0.45, 0.8, vnoise(w, 16, 16)))
    fat = (np.sin((u * 5 + v * 11 + fbm(w, 4, 4, 3) * 2.5) * 2 * math.pi) * 0.5 + 0.5) ** 10
    col = mix(col, (0.98, 0.88, 0.8), fat * 0.6)
    gaps = smooth(0.0, 0.18, vnoise(w, 20, 20))
    col = mix(col, (0.7, 0.32, 0.22), (1 - gaps) * 0.6)
    return col


def p_kombu(w, h):
    u, v = grid01(w)
    s = np.sin((v * 16 + u * 3 + fbm(w, 3, 3, 3) * 2) * 2 * math.pi) * 0.5 + 0.5
    col = mix((0.09, 0.08, 0.05), (0.3, 0.25, 0.14), smooth(0.8, 1.0, s) * 0.8)
    col = mix(col, (0.86, 0.79, 0.62), smooth(0.93, 0.97, vnoise(w, 46, 46)) * 0.9)
    return col


def p_takuan(w, h):
    """a slice of pickled daikon (the half moon's straight edge along the cell's foot): bright yellow, fibres out from its middle, its rim
    paler and clearer"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x, y = (xx + 0.5) / w * 2 - 1, (yy + 0.5) / h
    r = np.hypot(x, y)
    a = np.arctan2(y, x)
    col = mix((0.95, 0.76, 0.18), (0.99, 0.86, 0.36), fbm(w, 4, 4, 3))
    fib = (np.sin(a * 40 + fbm(w, 3, 3, 3) * 3) * 0.5 + 0.5) ** 4
    col = mix(col, (0.88, 0.66, 0.12), fib * 0.35 * smooth(0.15, 0.6, r))
    col = mix(col, (0.99, 0.93, 0.62), smooth(0.86, 0.98, r) * 0.7)
    return col


def p_lacquer(w, h, base=(0.5, 0.07, 0.05), hi=(0.75, 0.2, 0.15)):
    u, v = grid01(w)
    col = np.ones((h, w, 3), np.float32) * np.array(base, np.float32)
    col = col * (0.9 + 0.12 * fbm(w, 2, 20, 3))[..., None]
    sheen = np.exp(-((v - 0.72) / 0.06) ** 2)
    return mix(col, hi, sheen * 0.35)


def p_lacquer_black(w, h):
    return p_lacquer(w, h, base=(0.055, 0.045, 0.045), hi=(0.32, 0.27, 0.25))


def p_water(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x, y = (xx + 0.5) / w * 2 - 1, (yy + 0.5) / h * 2 - 1
    r = np.hypot(x, y)
    col = mix((0.47, 0.6, 0.66), (0.66, 0.77, 0.82), smooth(0.2, 1.0, r))
    crest = np.exp(-((np.hypot(x + 0.25, y - 0.3) - 0.42) / 0.05) ** 2) * (x < 0.1)
    return mix(col, (0.93, 0.96, 0.97), crest * 0.7)


def p_porcelain(w, h):
    u, v = grid01(w)
    col = np.ones((h, w, 3), np.float32) * np.array((0.94, 0.94, 0.915), np.float32)
    col = col * (0.97 + 0.04 * fbm(w, 4, 4, 2))[..., None]
    for c_, wd in ((0.8, 0.012), (0.74, 0.006), (0.2, 0.008)):
        col = mix(col, (0.16, 0.24, 0.55), (np.abs(v - c_) < wd).astype(np.float32) * 0.9)
    return col


def p_tenugui(w, h):
    """a tenugui's cotton with 豆絞り: indigo dots in staggered rows, their edges a little bled into the weave"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    weave = (np.sin(xx * math.pi * 0.9) * np.sin(yy * math.pi * 0.9)) * 0.5 + 0.5
    col = np.ones((h, w, 3), np.float32) * np.array((0.95, 0.95, 0.925), np.float32) * (0.95 + 0.05 * weave)[..., None]
    sp = w / 9.0
    row = np.floor(yy / sp)
    ox = (row % 2) * sp / 2
    cx = (np.floor((xx - ox) / sp) + 0.5) * sp + ox
    cy = (row + 0.5) * sp
    d = np.hypot(xx - cx, (yy - cy) * 1.15)
    bleed = (vnoise(w, 30, 30) - 0.5) * sp * 0.08
    dot = 1 - smooth(sp * 0.2, sp * 0.26, d + bleed)
    return mix(col, (0.15, 0.22, 0.42), dot)


def p_fukin(w, h):
    """a folded kitchen cloth (布巾): white cotton, its weave just showing, a pair of indigo stripes in from each edge (item 353: the dots
    read as a grater)"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    weave = (np.sin(xx * math.pi * 0.9) * np.sin(yy * math.pi * 0.9)) * 0.5 + 0.5
    col = np.ones((h, w, 3), np.float32) * np.array((0.95, 0.95, 0.925), np.float32) * (0.95 + 0.05 * weave)[..., None]
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    stripe = np.zeros_like(u)
    for c_ in (0.1, 0.16, 0.84, 0.9):
        stripe = np.maximum(stripe, (np.abs(v - c_) < 0.018).astype(np.float32))
        stripe = np.maximum(stripe, (np.abs(u - c_) < 0.018).astype(np.float32) * 0.85)
    return mix(col, (0.17, 0.26, 0.48), stripe * 0.9)


def p_sasa(w, h):
    """a bamboo leaf's face, its length along u: bright green, darker to its edges, a pale midrib, fine parallel veins, a little gloss"""
    u, v = grid01(w)
    a = np.abs(v - 0.5) * 2
    col = mix((0.34, 0.58, 0.2), (0.18, 0.38, 0.12), smooth(0.25, 1.0, a))
    col = mix(col, (0.72, 0.84, 0.5), np.exp(-((v - 0.5) / 0.022) ** 2) * 0.85)
    veins = (np.sin(v * 2 * math.pi * 14) * 0.5 + 0.5) ** 8
    col = mix(col, (0.46, 0.7, 0.32), veins * 0.4 * (1 - a))
    gloss = np.exp(-((v - 0.32) / 0.08) ** 2) * smooth(0.1, 0.4, u) * (1 - smooth(0.7, 0.95, u))
    col = mix(col, (0.62, 0.8, 0.46), gloss * 0.3)
    return col * (0.94 + 0.1 * fbm(w, 4, 2, 3))[..., None]


def p_stoneware(w, h):
    """a little stoneware pot: speckled clay, a dark brown glaze poured over its shoulder and run down unevenly"""
    u, v = grid01(w)
    col = mix((0.6, 0.47, 0.34), (0.68, 0.55, 0.41), fbm(w, 5, 5, 3))
    col = mix(col, (0.24, 0.17, 0.12), smooth(0.88, 0.93, vnoise(w, 50, 50)) * 0.8)
    edge = 0.55 + 0.12 * (fbm(w, 9, 2, 3) - 0.5) * 2
    glaze = smooth(edge - 0.02, edge + 0.02, v)
    gl = mix((0.26, 0.15, 0.08), (0.42, 0.25, 0.12), fbm(w, 3, 8, 3))
    return mix(col, gl, glaze)


def p_wood(w, h):
    u, v = grid01(w)
    g = np.sin((v * 26 + (fbm(w, 2, 5, 4) - 0.5) * 1.4) * 2 * math.pi) * 0.5 + 0.5
    return mix((0.82, 0.66, 0.45), (0.68, 0.51, 0.33), smooth(0.6, 1.0, g) * 0.7)


def p_wrap(w, h):
    """the box of food wrap: white card, a red band round it, a blue strip along its top, a pale window where the roll shows"""
    u, v = grid01(w)
    col = np.ones((h, w, 3), np.float32) * np.array((0.95, 0.95, 0.93), np.float32)
    col = mix(col, (0.74, 0.12, 0.12), ((v > 0.32) & (v < 0.6)).astype(np.float32))
    col = mix(col, (0.38, 0.55, 0.78), (v > 0.86).astype(np.float32))
    col = mix(col, (0.98, 0.98, 0.98), ((v > 0.38) & (v < 0.54) & (u > 0.12) & (u < 0.42)).astype(np.float32) * 0.9)
    return col


def p_black(w, h):
    return p_lacquer(w, h, base=(0.045, 0.04, 0.04), hi=(0.25, 0.22, 0.2))


def p_plastic(w, h):
    """a food tub's milky white plastic: a soft shade down it, faint moulding lines, a printed scale up one side"""
    u, v = grid01(w)
    col = mix((0.86, 0.87, 0.86), (0.97, 0.97, 0.96), smooth(0.0, 0.9, v))
    col = mix(col, (0.78, 0.8, 0.8), (np.abs(v - 0.88) < 0.01).astype(np.float32) * 0.6)
    tick = ((u > 0.08) & (u < 0.12 + 0.04 * (np.floor(v * 10) % 2)) & ((v * 10) % 1 < 0.12) & (v > 0.15) & (v < 0.82))
    return mix(col, (0.45, 0.55, 0.62), tick.astype(np.float32) * 0.7)


def p_lid(w, h):
    u, v = grid01(w)
    col = mix((0.28, 0.48, 0.7), (0.38, 0.6, 0.82), fbm(w, 3, 3, 2))
    rim = 1 - smooth(0.04, 0.1, np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v)))
    return mix(col, (0.18, 0.34, 0.52), rim * 0.6)


def p_tape(w, h):
    """masking tape written on in a hurry: a cream strip, a few brush-pen strokes"""
    u, v = grid01(w)
    col = np.ones((h, w, 3), np.float32) * np.array((0.93, 0.88, 0.72), np.float32)
    rr = _rng(3534)
    for k in range(5):
        cx = 0.18 + k * 0.16 + rr.uniform(-0.02, 0.02)
        path = np.abs(u - cx - 0.04 * np.sin(v * 6 + k)) < 0.016
        col = mix(col, (0.12, 0.1, 0.09), (path & (np.abs(v - 0.5) < 0.28)).astype(np.float32))
    return col


def p_cloth(w, h, base=(0.93, 0.93, 0.9), line=(0.24, 0.36, 0.6)):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    weave = (np.sin(xx * math.pi * 0.85) * np.sin(yy * math.pi * 0.85)) * 0.5 + 0.5
    col = np.ones((h, w, 3), np.float32) * np.array(base, np.float32) * (0.94 + 0.06 * weave)[..., None]
    v = (yy + 0.5) / h
    stripe = (((v * 6) % 1) < 0.12).astype(np.float32)
    return mix(col, line, stripe * 0.85)


def p_weave(w, h):
    """a zaru's woven bamboo: strips over and under each other on a diagonal"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    s = w / 12.0
    a = (xx + yy) / s
    b = (xx - yy) / s
    ia, ib = np.floor(a), np.floor(b)
    over = ((ia + ib) % 2 == 0)
    fa, fb = a - ia, b - ib
    shade = np.where(over, 0.75 + 0.3 * np.sin(fa * math.pi), 0.75 + 0.3 * np.sin(fb * math.pi))
    edge = np.minimum(np.minimum(fa, 1 - fa), np.minimum(fb, 1 - fb))
    col = np.array((0.78, 0.62, 0.38), np.float32)[None, None, :] * shade[..., None]
    return mix(col, (0.38, 0.27, 0.15), (1 - smooth(0.0, 0.08, edge)) * 0.8)


def p_bento(w, h):
    u, v = grid01(w)
    col = p_lacquer(w, h, base=(0.05, 0.045, 0.045), hi=(0.28, 0.24, 0.22))
    return mix(col, (0.62, 0.1, 0.08), ((v > 0.84) & (v < 0.92)).astype(np.float32))


def p_band(w, h):
    """the paper band round the takeaway boxes: washi, a red seal-like square, brushed strokes"""
    u, v = grid01(w)
    col = mix((0.94, 0.92, 0.86), (0.9, 0.87, 0.8), fbm(w, 8, 8, 3))
    col = mix(col, (0.7, 0.14, 0.1), ((np.abs(u - 0.5) < 0.09) & (np.abs(v - 0.5) < 0.3)).astype(np.float32))
    return col
