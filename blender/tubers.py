"""Potatoes and sweet potatoes as they come out of the ground (after photoscans of real ones), for any script that wants them:

- sweet_potato(): a satsumaimo, a long spindle a little bent, blunt at its stem end and drawn out into a thin tail at its root end, its
  sides lumpy and run with shallow grooves along it; its skin (sweet_potato_skin) a deep magenta-purple, streaked darker along it, scuffed
  paler here and there, little rootlet scars in rough rows, a trace of soil toward its ends.
- potato(): an irregular, knobbly oval, its eyes sunk in dimples; its skin (potato_skin) a pale tan netted with fine russeting, freckled,
  the eyes dark with a pinkish ring, a smudge or two of soil.
The meshes are built about the origin in Blender's frame (z up): the sweet potato along x, its stem end toward -x; their UVs are what the
skins are painted for (the sweet potato: u along it, v round it; the potato: u round it, v from pole to pole, the eyes where EYES puts
them, the same on every potato).
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from common import fbm, grid01, mix, smooth, to_normal, vnoise

# ---------------------------------------------------------------------------------------------------- skins


def sweet_potato_skin(N=512):
    """(colour, normal) for a sweet potato's skin: u along it, v round it"""
    u, v = grid01(N)
    base = mix((0.47, 0.11, 0.2), (0.6, 0.18, 0.27), fbm(N, 4, 6, 5))
    # (darker streaks along it, the grain of its skin)
    streak = np.abs(np.sin((v * 13 + (fbm(N, 2, 3, 4) - 0.5) * 1.6) * 2 * math.pi))
    # (broken up: the lines come and go along it, never one long stripe)
    col = mix(base, (0.33, 0.07, 0.13), smooth(0.18, 0.0, streak) * smooth(0.35, 0.7, fbm(N, 9, 3, 3)) * 0.4)
    col = mix(col, (0.34, 0.08, 0.14), smooth(0.55, 0.85, vnoise(N, 24, 90)) * 0.35)
    # (scuffs where the skin's rubbed thin, paler and pinker)
    scuff = smooth(0.66, 0.82, fbm(N, 6, 10, 4))
    col = mix(col, (0.72, 0.42, 0.42), scuff * 0.55)
    # (rootlet scars: small dark pits in rough rows along it, each with a faintly raised paler rim)
    pits = np.zeros((N, N), np.float32)
    rims = np.zeros((N, N), np.float32)
    rng = np.random.default_rng(7)
    for row in range(5):
        vv = (row + 0.5) / 5 + rng.uniform(-0.04, 0.04)
        for k in range(9):
            uu = rng.uniform(0.08, 0.92)
            d = np.hypot((u - uu) * 2.0, (np.mod(v - vv + 0.5, 1.0) - 0.5) * 1.0)
            pits = np.maximum(pits, smooth(0.008, 0.002, d))
            rims = np.maximum(rims, smooth(0.016, 0.009, d) * smooth(0.006, 0.01, d))
    col = mix(col, (0.62, 0.3, 0.32), rims * 0.6)
    col = mix(col, (0.18, 0.05, 0.07), pits)
    # (a trace of soil, mostly toward the ends)
    ends = smooth(0.25, 0.0, np.minimum(u, 1 - u))
    col = mix(col, (0.4, 0.29, 0.21), smooth(0.6, 0.85, fbm(N, 8, 8, 4)) * (0.25 + 0.5 * ends))
    col = col * (0.95 + 0.08 * fbm(N, 64, 64, 2))[..., None]
    h = smooth(0.18, 0.0, streak) * -0.25 + scuff * 0.2 - pits * 1.2 + rims * 0.5 + fbm(N, 32, 32, 3) * 0.3
    return np.clip(col, 0, 1).astype(np.float32), to_normal(h, 2.5).astype(np.float32)


# (where a potato's eyes are, as directions from its middle: the same for every potato, so the skin's picture has them in the same places)
EYES = [Vector(d).normalized() for d in ((0.9, 0.3, 0.2), (0.6, -0.7, 0.3), (-0.2, 0.85, -0.3), (-0.8, -0.2, 0.45), (0.1, -0.4, -0.85),
                                         (-0.6, 0.5, 0.55), (0.35, 0.55, -0.7), (-0.95, -0.1, -0.2))]


def eye_uv(d):
    return (math.atan2(d.y, d.x) / (2 * math.pi)) % 1.0, math.acos(max(-1.0, min(1.0, d.z))) / math.pi


def potato_skin(N=512):
    """(colour, normal) for a potato's skin: u round it, v from pole to pole"""
    u, v = grid01(N)
    base = mix((0.79, 0.64, 0.44), (0.68, 0.53, 0.35), fbm(N, 5, 5, 5))
    # (the fine net of russeting: two warped fields' ridges crossing)
    n1 = np.abs(np.sin((u * 9 + fbm(N, 6, 6, 4) * 2.2) * 2 * math.pi))
    n2 = np.abs(np.sin((v * 7 + fbm(N, 7, 5, 4) * 2.0) * 2 * math.pi))
    net = np.maximum(smooth(0.12, 0.0, n1), smooth(0.12, 0.0, n2)) * smooth(0.35, 0.7, fbm(N, 4, 4, 3))
    col = mix(base, (0.55, 0.4, 0.26), net * 0.55)
    # (freckles)
    freck = smooth(0.8, 0.95, vnoise(N, 70, 70))
    col = mix(col, (0.5, 0.36, 0.22), freck * 0.6)
    # (the eyes: dark little pits, a pinkish ring round them)
    eyes = np.zeros((N, N), np.float32)
    ring = np.zeros((N, N), np.float32)
    for d in EYES:
        eu, ev = eye_uv(d)
        squash = max(0.25, math.sin(ev * math.pi))
        dd = np.hypot((np.mod(u - eu + 0.5, 1.0) - 0.5) * squash * 2, (v - ev))
        eyes = np.maximum(eyes, smooth(0.014, 0.004, dd))
        ring = np.maximum(ring, smooth(0.04, 0.016, dd) * smooth(0.008, 0.016, dd))
    col = mix(col, (0.7, 0.45, 0.4), ring * 0.45)
    col = mix(col, (0.3, 0.2, 0.13), eyes)
    # (a smudge or two of soil)
    col = mix(col, (0.45, 0.35, 0.25), smooth(0.68, 0.86, fbm(N, 6, 6, 4)) * 0.5)
    col = col * (0.95 + 0.08 * fbm(N, 64, 64, 2))[..., None]
    h = -net * 0.35 - freck * 0.3 - eyes * 1.0 + fbm(N, 24, 24, 3) * 0.35
    return np.clip(col, 0, 1).astype(np.float32), to_normal(h, 2.2).astype(np.float32)


# ---------------------------------------------------------------------------------------------------- meshes


def _object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def sweet_potato(name, mat, length=0.2, girth=0.065, bend=0.12, seed=0, rings=16, around=12):
    """a sweet potato along x about the origin, its stem end toward -x, `girth` across at its fattest, bent up by `bend` of its length"""
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.3) for _ in range(8)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    grid = []
    for i in range(rings + 1):
        t = i / rings
        # (fattest a little toward the stem end, blunt there; drawn out to a thin tail at the root end)
        s = math.sin(math.pi * min(1.0, max(0.0, t)) ** 0.85) ** 0.62
        s *= 1 - 0.25 * t * t
        r = girth / 2 * max(0.05, s)
        x = (t - 0.5) * length
        zc = bend * length * math.sin(math.pi * t) * 0.6 + bend * length * 0.15 * math.sin(2 * math.pi * t + ph[0])
        yc = bend * length * 0.2 * math.sin(math.pi * t * 1.3 + ph[1])
        row = []
        for j in range(around):
            a = 2 * math.pi * j / around
            lump = 1 + 0.09 * math.sin(2 * math.pi * t * 2.3 + ph[2]) * math.cos(a + ph[3]) + 0.06 * math.sin(2 * math.pi * t * 5.1 + ph[4] + 2 * a)
            groove = 1 - 0.045 * (0.5 + 0.5 * math.cos(5 * a + ph[5] + t * 1.5))
            rr = r * lump * groove
            row.append(bm.verts.new((x, yc + rr * math.cos(a) * 0.92, zc + rr * math.sin(a))))
        grid.append(row)
    for i in range(rings):
        for j in range(around):
            j2 = (j + 1) % around
            f = bm.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
            for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                loop[uvl].uv = (ii / rings, jj / around)
    # (the ends: the stem end a little dome, the root end's tail closed to a point)
    for i, d in ((0, -1), (rings, 1)):
        ring = grid[i]
        c = sum((v_.co for v_ in ring), Vector()) / len(ring)
        tip = bm.verts.new(c + Vector((d * length * (0.012 if d < 0 else 0.03), 0, 0)))
        for j in range(around):
            j2 = (j + 1) % around
            q = (ring[j], ring[j2], tip) if d > 0 else (ring[j2], ring[j], tip)
            f = bm.faces.new(q)
            for loop in f.loops:
                loop[uvl].uv = (i / rings, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, mat)


def potato(name, mat, size=0.09, seed=0, seg=16, rings=11):
    """a potato about the origin, `size` long (along x), knobbly, its eyes sunk in dimples where EYES puts them"""
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.3) for _ in range(6)]
    ky, kz = rnd.uniform(0.74, 0.86), rnd.uniform(0.62, 0.74)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()

    def at(th, a):
        d = Vector((math.sin(th) * math.cos(a), math.sin(th) * math.sin(a), math.cos(th)))
        knob = 1 + 0.07 * math.sin(3 * d.x + ph[0]) * math.cos(2 * d.y + ph[1]) + 0.05 * math.sin(4 * d.z + 2 * d.x + ph[2])
        dent = max([0.075 * (1 - (d.angle(e) / 0.32) ** 2) for e in EYES if d.angle(e) < 0.32] or [0.0])
        r = size / 2 * (knob - dent)
        return Vector((d.x * r, d.y * r * ky, d.z * r * kz))
    top, bot = bm.verts.new(at(0.0, 0.0)), bm.verts.new(at(math.pi, 0.0))
    grid = [[top] * seg] + [[bm.verts.new(at(math.pi * i / rings, 2 * math.pi * j / seg)) for j in range(seg)] for i in range(1, rings)] + [[bot] * seg]
    for i in range(rings):
        for j in range(seg):
            j2 = (j + 1) % seg
            corners = ((i, j, j), (i, j2, j + 1), (i + 1, j2, j + 1), (i + 1, j, j))
            vs, uvs = [], []
            for ii, jj, ju in corners:
                vtx = grid[ii][jj]
                if vtx in vs:
                    continue
                vs.append(vtx)
                # (u round it, v from the top pole down: as the skin's eyes are painted (eye_uv))
                uvs.append((((j + 0.5) if ii in (0, rings) else ju) / seg, ii / rings))
            f = bm.faces.new(vs)
            for loop, uv in zip(f.loops, uvs):
                loop[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, mat)
