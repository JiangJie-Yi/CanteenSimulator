"""The customers' side of the bar, in finer shape (the stools are blender/stools.py's):

- bamboopot.glb, node "PottedBamboo": bamboo in a glazed pot, about 1.3 m: an indigo pot with the glaze running thick toward its foot, a
  pale rim where the glaze stops, soil topped with moss and pale pebbles; five culms of different heights with their nodes, a slight lean,
  side branches near the top and clusters of narrow leaves drooping off them.

Run:
    blender -b --factory-startup --python blender/barfurnish.py -- <project path> [preview.png]
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None


def P(x, y, z):
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


def fin(o, name, mat, parts, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def apply_all(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def lathe(name, prof, segs=24):
    """a turned piece: the profile [(radius, height)] swept round the vertical, its UVs round it and up it. A profile that starts or ends on
    the axis has that point left out and the ring beside it closed flat instead (laddered on export): never a fan of triangles into the
    middle (the owner's low-poly rule; the pot's foot was 120 triangles round one point)"""
    if prof[0][0] <= 1e-4:
        prof = prof[1:]
    if prof[-1][0] <= 1e-4:
        prof = prof[:-1]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new(P(r * math.cos(2 * math.pi * j / segs), y, r * math.sin(2 * math.pi * j / segs))) for j in range(segs)])
    L = sum(math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) for i in range(len(prof) - 1)) or 1
    acc = [0.0]
    for i in range(len(prof) - 1):
        acc.append(acc[-1] + math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) / L)
    for i in range(len(prof) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
            for lp, (u, v) in zip(f.loops, ((j / segs, acc[i]), ((j + 1) / segs, acc[i]), ((j + 1) / segs, acc[i + 1]), (j / segs, acc[i + 1]))):
                lp[uvl].uv = (u, v)
    for ring, top in ((rings[0], False), (rings[-1], True)):
        if prof[0 if not top else -1][0] > 1e-4:
            bm.faces.new(ring if top else list(reversed(ring)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def rod(name, a, b, r0, r1, segs=12):
    """a round rod from a to b (three frame), tapering r0 to r1"""
    a, b = Vector(P(*a)), Vector(P(*b))
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = active()
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    o.name = name
    return o


# =====================================================================
# The potted bamboo
# =====================================================================
def bamboo():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    seed(21)
    rng = random.Random(4)
    N = 256
    u, v = grid01(N)
    # (the pot's glaze: indigo, running thicker and darker toward the foot in drips, a paler band where it pools)
    drip = smooth(0.2, 0.9, fbm(N, 24, 2, 3)) * (1 - v)
    glaze = mix((0.16, 0.27, 0.42), (0.06, 0.12, 0.24), np.clip(drip + (1 - v) * 0.4, 0, 1))
    glaze = mix(glaze, (0.55, 0.62, 0.66), smooth(0.92, 0.98, v) * 0.7)
    culm = mix((0.36, 0.5, 0.16), (0.46, 0.6, 0.22), fbm(N, 40, 2, 3))
    culm = mix(culm, (0.6, 0.66, 0.35), smooth(0.85, 1.0, np.sin(u * math.pi * 2 * 6) * 0.5 + 0.5) * 0.25)
    M = {"glaze": pbr("PotGlaze", (1, 1, 1), tex=image("potglaze", glaze), rough=0.18, coat=0.6),
         "clay": pbr("PotClay", lin("#b89a7a"), rough=0.9),
         "soil": pbr("PotSoil", lin("#3a2a1c"), rough=0.95),
         "moss": pbr("PotMoss", lin("#4a6a2a"), rough=0.9),
         "pebble": pbr("PotPebble", lin("#e2dccd"), rough=0.5),
         "culm": pbr("BambooCulm", (1, 1, 1), tex=image("bamboo", culm), rough=0.35, coat=0.3),
         "node": pbr("BambooNode", lin("#8a9a4a"), rough=0.5),
         "leaf": pbr("BambooLeaf", lin("#4f8a32"), rough=0.45),
         "leaf2": pbr("BambooLeaf2", lin("#6a9e3a"), rough=0.45)}
    parts = []
    # (the pot: a tapering bowl with a rolled lip; the unglazed clay foot)
    pot = lathe("BambooPot", [(0.0, 0.012), (0.1, 0.012), (0.115, 0.03), (0.15, 0.12), (0.168, 0.22), (0.17, 0.25), (0.178, 0.262), (0.17, 0.27),
                              (0.158, 0.262), (0.152, 0.24)], 24)
    fin(pot, "BambooPot", M["glaze"], parts)
    fin(lathe("BambooPotFoot", [(0.0, 0.0), (0.104, 0.0), (0.104, 0.014), (0.0, 0.014)], 24), "BambooPotFoot", M["clay"], parts)
    fin(lathe("BambooSoil", [(0.0, 0.236), (0.152, 0.236), (0.152, 0.24), (0.0, 0.243)], 24), "BambooSoil", M["soil"], parts)
    # (moss in soft clumps, pale pebbles between)
    for i in range(14):
        a, r = rng.random() * 6.28, 0.03 + rng.random() * 0.11
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022 + rng.random() * 0.012, segments=10, ring_count=6, location=P(math.cos(a) * r, 0.24, math.sin(a) * r))
        m = active(); m.scale = (1, 1, 0.35); bpy.ops.object.transform_apply(scale=True)
        fin(m, f"BambooMoss{i}", M["moss"], parts)
    for i in range(18):
        a, r = rng.random() * 6.28, 0.03 + rng.random() * 0.115
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.008 + rng.random() * 0.006, segments=8, ring_count=5, location=P(math.cos(a) * r, 0.244, math.sin(a) * r))
        m = active(); m.scale = (1.3, 1, 0.55); bpy.ops.object.transform_apply(scale=True)
        fin(m, f"BambooPebble{i}", M["pebble"], parts)
    # (the culms: each its height and lean, nodes every so often, narrowing as they rise)
    leaf_bm = bmesh.new()
    for k, (x, z, h, lean_x, lean_z) in enumerate([(0.03, 0.02, 1.32, 0.04, 0.02), (-0.045, 0.03, 1.12, -0.06, 0.03), (0.0, -0.06, 0.96, 0.02, -0.07),
                                                   (0.06, -0.035, 0.82, 0.08, -0.03), (-0.03, -0.02, 1.2, -0.02, -0.05)]):
        y0 = 0.24
        r0 = 0.013 - k * 0.0008
        def pt(t):
            return Vector(P(x + lean_x * t * t, y0 + h * t, z + lean_z * t * t))
        nodes = []
        t = 0.0
        step = 0.13 + 0.02 * (k % 3)
        while t < 1:
            nodes.append(t)
            t += step / h * (1 + 0.15 * t)
        # (between each pair of nodes a tapering length; a ridge ring at each node)
        for i in range(len(nodes)):
            ta, tb = nodes[i], min(1.0, nodes[i + 1] if i + 1 < len(nodes) else 1.0)
            a_, b_ = pt(ta), pt(tb)
            d = b_ - a_
            if d.length < 0.01:
                continue
            ra, rb = r0 * (1 - 0.45 * ta), r0 * (1 - 0.45 * tb)
            bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=ra, radius2=rb * 0.97, depth=d.length, location=(a_ + b_) / 2)
            c = active()
            c.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
            bpy.ops.object.transform_apply(rotation=True)
            fin(c, f"BambooCulm{k}_{i}", M["culm"], parts)
            if i:
                bpy.ops.mesh.primitive_torus_add(major_radius=ra * 1.02, minor_radius=ra * 0.13, major_segments=14, minor_segments=5, location=a_)
                nd = active()
                nd.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
                fin(nd, f"BambooNode{k}_{i}", M["node"], parts)
        # (side branches off the upper nodes, each with a fan of drooping leaves at its tip)
        for i, tn in enumerate(nodes):
            if tn < 0.45:
                continue
            base = pt(tn)
            ang = (i * 2.4 + k) % (2 * math.pi)
            dirv = Vector((math.cos(ang), math.sin(ang), 0.55)).normalized()
            blen = 0.08 + 0.06 * rng.random()
            tip = base + dirv * blen
            br = rod(f"BambooBranch{k}_{i}", (0, 0, 0), (0, 0, 0.0001), 0.002, 0.0015, 5)
            bpy.data.objects.remove(br)
            bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.0022, depth=blen, location=(base + tip) / 2)
            bo = active(); bo.rotation_euler = dirv.to_track_quat("Z", "Y").to_euler(); bpy.ops.object.transform_apply(rotation=True)
            fin(bo, f"BambooBranch{k}_{i}", M["node"], parts)
            for j in range(5 + (i % 3)):
                la = ang + (j - 2.5) * 0.55 + rng.uniform(-0.15, 0.15)
                L = 0.11 + rng.random() * 0.05
                W = L * 0.17
                d0 = Vector((math.cos(la), math.sin(la), 0.15)).normalized()
                side = d0.cross(Vector((0, 0, 1))).normalized()
                # (a narrow lanceolate leaf, drooping along its length)
                prev = None
                vs = []
                # (five rows down it: seven made the pot's leaves some six thousand triangles)
                for s_ in range(5):
                    t_ = s_ / 4
                    w_ = W * math.sin(math.pi * min(1, t_ * 1.15)) * (1 - 0.3 * t_)
                    c_ = tip + d0 * (L * t_) + Vector((0, 0, -0.06 * t_ * t_ - 0.01 * t_))
                    vs.append((leaf_bm.verts.new(c_ - side * w_), leaf_bm.verts.new(c_ + side * w_)))
                for s_ in range(4):
                    f = leaf_bm.faces.new((vs[s_][0], vs[s_][1], vs[s_ + 1][1], vs[s_ + 1][0]))
                    f.material_index = (j + i) % 2
    me = bpy.data.meshes.new("BambooLeaves")
    leaf_bm.to_mesh(me)
    leaf_bm.free()
    lo = bpy.data.objects.new("BambooLeaves", me)
    bpy.context.collection.objects.link(lo)
    lo.data.materials.append(M["leaf"])
    lo.data.materials.append(M["leaf2"])
    sol = lo.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.0012
    apply_all(lo)
    for p_ in lo.data.polygons:
        p_.use_smooth = True
    parts.append(lo)
    root = bpy.data.objects.new("PottedBamboo", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "bamboopot.glb"), os.path.join(PROJECT, "blender", "bamboopot.blend"), None)
    print("BAMBOO_DONE", sum(len(o.data.polygons) for o in parts))


bamboo()
