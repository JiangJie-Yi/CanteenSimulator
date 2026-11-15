"""The shop's own beckoning cat (ownluckycat.glb, node "OwnLuckyCat"; items 97, 118, 121, the owner's): made after the big cat at the door
(luckycat3.glb, the one the owner circled, 2026-11-15: "the shape's still far off"), as the owner wants the shop's figures made: a clean
low-poly mesh of quads over its shape, its colour baked into a picture (as the beckoning cats and the Ebisu are), not built up of balls.

How: the door cat's mesh, turned to face -y and brought to 0.30 tall, is fused whole (a voxel remesh), retopologised into an even grid of quads
(a coarse voxel remesh) and the quads shrunk back onto its surface; unwrapped, and its colours baked from the original into a 1024 picture (Cycles,
selected to active). The raised paw (its hand, out past the head's side) beckons by bending: a shape key tips it forward about its foot,
fading into the body round it, which the game eases in and out (a morph target); no cut.

Run:
    blender -b --factory-startup --python blender/ownluckycat.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import export_dish, grid01, image, mix, pbr, smooth  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

TALL = 0.30
VOXEL = 0.018
# (the raised hand: past the head's side, between these heights (shares of TALL))
PAW_X, PAW_Z0, PAW_Z1 = 0.086, 0.4, 0.9


# ---- the koban's picture: gold, 千万両 written down it by hand, as the door cat's is (the owner's, 2026-11-15: "the words on the coin:
# draw them, not a typeface"; the door cat's koban (luckycat3's own picture) has 千万両 in thick round-ended strokes, a marker's, no font's).
# Each character's strokes drawn as a hand would go, a round nib along each, on the coin's face in metres (its oval 2 x KOBAN_R), each
# point a fraction of a millimetre off true (the same each time it's made)
KOBAN_R = (0.026, 0.042)
STROKES = {
    "千": [[(0.76, 0.06), (0.55, 0.15), (0.30, 0.22)],
           [(0.08, 0.50), (0.50, 0.48), (0.92, 0.46)],
           [(0.50, 0.20), (0.50, 0.58), (0.50, 0.95)]],
    "万": [[(0.06, 0.15), (0.50, 0.14), (0.94, 0.13)],
           [(0.40, 0.15), (0.39, 0.42), (0.31, 0.68), (0.12, 0.92)],
           [(0.39, 0.44), (0.62, 0.43), (0.82, 0.43), (0.81, 0.66), (0.76, 0.86), (0.64, 0.91), (0.55, 0.85)]],
    "両": [[(0.06, 0.09), (0.50, 0.09), (0.94, 0.09)],
           [(0.50, 0.09), (0.50, 0.72)],
           [(0.17, 0.32), (0.17, 0.95)],
           [(0.17, 0.32), (0.83, 0.32), (0.83, 0.88), (0.74, 0.95)],
           [(0.33, 0.48), (0.33, 0.73), (0.67, 0.73), (0.67, 0.48)]],
}
# (each character's cell down the coin's middle (across, down, in metres), their middles' heights, the nib's radius)
CELL_W, CELL_H, CELL_Z, NIB = 0.019, 0.023, (0.025, 0.0, -0.025), 0.0021


def brush_mask(n):
    """how much ink each texel of an n x n picture of the coin's face holds (0..1): every stroke of 千万両 drawn with a round nib"""
    v_, u_ = np.mgrid[0:n, 0:n].astype(np.float32) + 0.5
    x = (u_ / n - 0.5) * 2 * KOBAN_R[0]
    z = (v_ / n - 0.5) * 2 * KOBAN_R[1]
    ink = np.zeros((n, n), np.float32)
    px_ = 2 * KOBAN_R[0] / n
    for k_, (ch, zc) in enumerate(zip("千万両", CELL_Z)):
        for s_, stroke in enumerate(STROKES[ch]):
            pts = [((cu - 0.5) * CELL_W + 0.00025 * math.sin(3.1 * k_ + 1.7 * s_ + 2.3 * j_),
                    zc + (0.5 - cw) * CELL_H - 0.00025 * math.cos(2.7 * k_ + 1.3 * s_ + 1.9 * j_)) for j_, (cu, cw) in enumerate(stroke)]
            for (ax, az), (bx, bz) in zip(pts, pts[1:]):
                dx, dz = bx - ax, bz - az
                t = np.clip(((x - ax) * dx + (z - az) * dz) / max(1e-12, dx * dx + dz * dz), 0, 1)
                d = np.hypot(x - ax - t * dx, z - az - t * dz)
                ink = np.maximum(ink, np.clip((NIB - d) / px_ + 0.5, 0, 1))
    return ink


KN = 256
ku, kv = grid01(KN)
# (made as the door cat's (luckycat3) is (the owner's, 2026-11-15: "make it as that one's made"): its warm golden yellow all over, a little
# lighter in the middle, no engraved ring)
kob = mix((0.9, 0.62, 0.02), (0.97, 0.74, 0.12), smooth(0.95, 0.25, np.hypot((ku - 0.5) * 1.4, kv - 0.5) * 2))
# (drawn at twice the picture's size, each texel the mean of its four: smooth edges)
kob = mix(kob, (0.1, 0.07, 0.04), brush_mask(KN * 2).reshape(KN, 2, KN, 2).mean(axis=(1, 3)))
koban_img = image("ownluckycat_koban", np.clip(kob, 0, 1))


def qsphere(bm, centre, radii, cuts):
    """a quad sphere into bm: a cube's faces cut `cuts`+1 by `cuts`+1, its points pushed out onto the ellipsoid; returns its faces"""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=2.0)
    if cuts:
        bmesh.ops.subdivide_edges(tmp, edges=tmp.edges[:], cuts=cuts, use_grid_fill=True)
    for vv in tmp.verts:
        n = vv.co.normalized()
        vv.co = Vector((centre[0] + n.x * radii[0], centre[1] + n.y * radii[1], centre[2] + n.z * radii[2]))
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    before = set(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return [f for f in bm.faces if f not in before]



def select_only(*objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


# ---- the door cat, whole, facing -y, its foot's middle at the origin, TALL high
bpy.ops.import_scene.gltf(filepath=os.path.join(PROJECT, "public", "models", "luckycat3.glb"))
src = [o for o in bpy.data.objects if o.type == "MESH"][0]
select_only(src)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# (it faces +x, its raised paw toward +y: turned a quarter round, it faces -y, the game's front, the paw toward +x (the import turns it by a
# quaternion: an euler set without its mode changed did nothing, and it sat side on))
src.rotation_mode = "XYZ"
src.rotation_euler = (0, 0, -math.pi / 2)
bpy.ops.object.transform_apply(rotation=True)
vs = [v.co for v in src.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
k = TALL / (hi.z - lo.z)
for v in src.data.vertices:
    v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) * k, (v.co.y - (lo.y + hi.y) / 2) * k, (v.co.z - lo.z) * k))
src.data.update()

# ---- the door cat's own koban (a thin plate the grid of quads can't keep: fused with the body it came out a lump the bake found no colour
# for, gold or white round the made coin, the owner's "something odd at the coin's side", 2026-11-15) taken off a copy before it's fused;
# where it was kept, for the made one (its faces are those on the picture's top right corner, the coin's own island)
bm = bmesh.new()
bm.from_mesh(src.data)
uvl0 = bm.loops.layers.uv.active
coin_f = [f for f in bm.faces if 0.72 < sum(l[uvl0].uv.x for l in f.loops) / len(f.loops) < 0.91 and sum(l[uvl0].uv.y for l in f.loops) / len(f.loops) > 0.81]
coin_pts = [v.co.copy() for f in coin_f for v in f.verts]
bmesh.ops.delete(bm, geom=coin_f, context="FACES")
# (two copies of what's left: one baked from, as it is; one fused and shrunk onto, its open edges (the model has many: inside its ears, the
# coin's own) all closed, or the fusing can't tell inside from out and keeps a scrap of the cat; baked from that one, the closing faces,
# with no place in the picture, came out streaks on the ear)
fuse_src = src.copy()
fuse_src.data = src.data.copy()
fuse_src.name = "OwnCatSource"
bpy.context.collection.objects.link(fuse_src)
bm.to_mesh(fuse_src.data)
bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
shape_src = src.copy()
shape_src.data = src.data.copy()
shape_src.name = "OwnCatShape"
bpy.context.collection.objects.link(shape_src)
bm.to_mesh(shape_src.data)
bm.free()
print("COIN_FACES", len(coin_f))

# ---- the new mesh: fused, quads over it, shrunk back onto its surface
lp = shape_src.copy()
lp.data = shape_src.data.copy()
lp.name = "OwnCatBody"
bpy.context.collection.objects.link(lp)
lp.data.materials.clear()
select_only(lp)
# (a coarse voxel remesh: whole, and quads already, an even grid of them over it (QuadriFlow does nothing run in the background))
m_ = lp.modifiers.new("fuse", "REMESH"); m_.mode = "VOXEL"; m_.voxel_size = VOXEL
bpy.ops.object.modifier_apply(modifier="fuse")
m_ = lp.modifiers.new("onto", "SHRINKWRAP"); m_.target = shape_src; m_.wrap_method = "NEAREST_SURFACEPOINT"
bpy.ops.object.modifier_apply(modifier="onto")
print('QUADS', len(lp.data.polygons))
for p in lp.data.polygons:
    p.use_smooth = True

# ---- unwrapped, its colours baked from the door cat's
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
bpy.ops.object.mode_set(mode="OBJECT")
img = bpy.data.images.new("ownluckycat_baked", 1024, 1024)
mat = bpy.data.materials.new("OwnCatBaked")
mat.use_nodes = True
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
nt.nodes.active = tex
lp.data.materials.append(mat)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 4
sc.cycles.device = "CPU"
select_only(fuse_src, lp, active=lp)
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.06, margin=8)
# (the koban: a thin plate, too thin for the grid of quads to keep, its baked rays found nothing and it came out black. Where the picture
# baked dark: gold; and which faces those are, for where the koban goes)
px = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)
dark = px[..., :3].max(axis=2) < 0.015   # (no colour found at all: the black ear's black is lighter than this)
# (gold, the koban's own (the owner's, 2026-11-15: painted white, the source's thin plate showed as a white sliver beside the made coin and
# a white lump over the bell): the made koban below covers the plate, so what shows of it reads as the coin's own edge)
px[dark, :3] = np.median(px[(px[..., :3].min(axis=2) > 0.5) & ~dark][:, :3], axis=0)
img.pixels.foreach_set(px.ravel())
uvl_ = lp.data.uv_layers.active.data
dark_at = []
for poly in lp.data.polygons:
    uu = sum(uvl_[li].uv.x for li in poly.loop_indices) / poly.loop_total
    vv = sum(uvl_[li].uv.y for li in poly.loop_indices) / poly.loop_total
    if dark[min(1023, int(vv * 1024)), min(1023, int(uu * 1024))] and poly.center.y < -0.03 and poly.center.z < 0.16:
        dark_at.append(poly.center.copy())
img.pack()
# (the picture into the colour only once it's baked: wired in before, it was read while it was being written)
nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
bpy.data.objects.remove(src)
bpy.data.objects.remove(fuse_src)
bpy.data.objects.remove(shape_src)

# ---- the raised hand beckons by bending, not cut off (the owner's, 2026-11-15: "the cat's hand is simply cut off": it was cut off along a
# plane across the arm into a node of its own and swung there, its seam a line down the paw and the flat faces of the cut showing as it
# swung): the cat one mesh, with a shape key ("Beckon"): the raised arm tipped forward about its foot (where it rises from the body by the
# head), its pull fading out over a ring of the grid round it, so the fur there stretches with it and nothing opens. The game eases the key
# in and out (a morph target), as the door cat's arm bends with its skin
import heapq
from collections import defaultdict
me_ = lp.data
lo_, hi_ = PAW_Z0 * TALL, PAW_Z1 * TALL
hand_ = [v.index for v in me_.vertices if v.co.x > PAW_X and lo_ - 0.008 < v.co.z < hi_]
top_z = max(me_.vertices[i].co.z for i in hand_)
foot_ = [me_.vertices[i].co for i in hand_ if me_.vertices[i].co.z < lo_ + 0.02] or [me_.vertices[i].co for i in hand_]
pivot = Vector((PAW_X, sum(c.y for c in foot_) / len(foot_), lo_ + 0.004))
# (how far round the hand its pull reaches over the surface, fading (a few rings of the grid: over one, the fur folded where the hand's top
# meets the ear); how far it's tipped at the most (rad): its top a little over 2 cm forward, as the cut hand's went)
REACH, BECKON = 0.045, 0.22
adj = defaultdict(list)
for e in me_.edges:
    a_, b_ = e.vertices
    L_ = (me_.vertices[a_].co - me_.vertices[b_].co).length
    adj[a_].append((b_, L_))
    adj[b_].append((a_, L_))
dist = {i: 0.0 for i in hand_}
pq = [(0.0, i) for i in hand_]
heapq.heapify(pq)
while pq:
    d_, i = heapq.heappop(pq)
    if d_ > dist.get(i, 1e9):
        continue
    for j_, L_ in adj[i]:
        nd = d_ + L_
        if nd < REACH and nd < dist.get(j_, 1e9):
            dist[j_] = nd
            heapq.heappush(pq, (nd, j_))
lp.shape_key_add(name="Basis", from_mix=False)
key = lp.shape_key_add(name="Beckon", from_mix=False)
moved = 0
for i, d_ in dist.items():
    c = me_.vertices[i].co
    t_ = min(1.0, d_ / REACH)
    w_ = 1.0 - t_ * t_ * (3 - 2 * t_)
    # (less and less of the head over the hand's top: its ear stays where it is)
    if c.z > top_z:
        t_ = min(1.0, (c.z - top_z) / 0.03)
        w_ *= 1.0 - t_ * t_ * (3 - 2 * t_)
    if w_ <= 0:
        continue
    a_ = BECKON * w_
    dy, dz = c.y - pivot.y, c.z - pivot.z
    # (about x: its top toward -y, the cat's front)
    key.data[i].co = Vector((c.x, pivot.y + dy * math.cos(a_) - dz * math.sin(a_), pivot.z + dy * math.sin(a_) + dz * math.cos(a_)))
    moved += 1
print("BECKON_VERTS", len(hand_), "MOVED", moved)

# ---- the koban, made: a flat lens of an oval, 千萬兩 written down it, set where the dark blob was, just in front of it
kmat = pbr("OwnCatKoban", (1, 1, 1), tex=koban_img, rough=0.35)
kc = Vector((sum(c.x for c in dark_at), sum(c.y for c in dark_at), sum(c.z for c in dark_at))) / max(1, len(dark_at))
kh = (max(c.z for c in dark_at) - min(c.z for c in dark_at)) if dark_at else 0.06
front = min(c.y for c in dark_at) if dark_at else kc.y
bm = bmesh.new()
uvk = bm.loops.layers.uv.new()
# (as the door cat's: a tall plump oval held in its paw, over the whole of the source's plate (the gold patch below the bell), a few
# millimetres past it all round)
plate = coin_pts
if plate:
    kc = Vector(((min(c.x for c in plate) + max(c.x for c in plate)) / 2, kc.y, (min(c.z for c in plate) + max(c.z for c in plate)) / 2))
    # (its size the door cat's in proportion, a little over a quarter of the cat's height (the source's coin island takes in more than the
    # coin: sized by it, it came out half the cat's height); its middle the source coin's, its back against the body's front there)
    kc = Vector((sum(c.x for c in plate) / len(plate), kc.y, sum(c.z for c in plate) / len(plate)))
    KR = (0.026, 0.009, 0.042)
    # (in front of all of the body over its outline (the paw that held the source's coin wraps round its sides: a ray down its middle went
    # through the gap and the coin sat behind the paw)
    # (its upper half only: below it the cat's front feet reach out further, and taken in, the coin stood off the body in the air)
    near = [v.co.y for v in lp.data.vertices if abs(v.co.x - kc.x) < KR[0] * 0.8 and kc.z - KR[2] * 0.2 < v.co.z < kc.z + KR[2]]
    front = (min(near) if near else min(c.y for c in plate)) - KR[1] + 0.004
else:
    KR = (0.026, 0.009, 0.04)
print("KOBAN_KR", tuple(round(v, 3) for v in KR))
# (3 cuts: 16 round its edge, a smooth oval where 2 gave a twelve-sided plate (the owner's, 2026-11-15); 96 faces)
for f in qsphere(bm, (0.0, 0.0, 0.0), KR, 3):
    for l in f.loops:
        l[uvk].uv = (0.5 + l.vert.co.x / (2 * KR[0]), 0.5 + l.vert.co.z / (2 * KR[2]))
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(0.2, 3, "X"))
# (its foot clear of what the cat sits on)
bmesh.ops.translate(bm, verts=bm.verts, vec=(kc.x, front - 0.004, max(kc.z, KR[2] + 0.006)))
me = bpy.data.meshes.new("OwnCatKoban"); bm.to_mesh(me); bm.free()
koban = bpy.data.objects.new("OwnCatKoban", me); bpy.context.collection.objects.link(koban)
koban.data.materials.append(kmat)
for p_ in koban.data.polygons:
    p_.use_smooth = True
print("KOBAN", len(dark_at), tuple(round(c, 3) for c in kc), round(kh, 3))
# (the bell on its collar: in the same unbaked patch, painted white with it; made, a little gold ball where the patch's top is (54 faces))
top_ = [c for c in dark_at if c.z > max(d.z for d in dark_at) - 0.02] if dark_at else []
if top_:
    bc = Vector((sum(c.x for c in top_), sum(c.y for c in top_), sum(c.z for c in top_))) / len(top_)
    bm = bmesh.new()
    BR = 0.0135
    bctr = Vector((bc.x + 0.003, min(c.y for c in top_) + 0.002, bc.z + 0.006))
    uvb = bm.loops.layers.uv.new()
    for f in qsphere(bm, tuple(bctr), (BR, BR, BR), 2):
        for l in f.loops:
            d_ = l.vert.co - bctr
            u_ = (math.atan2(d_.y, d_.x) + math.pi) / (2 * math.pi)
            l[uvb].uv = (u_, 0.5 + d_.z / (2 * BR))
    # (a seam's faces across u=0/1: their corners on the far side brought round, so the picture doesn't run back across them)
    for f in bm.faces:
        us = [l[uvb].uv.x for l in f.loops]
        if max(us) - min(us) > 0.5:
            for l in f.loops:
                if l[uvb].uv.x < 0.5:
                    l[uvb].uv.x += 1.0
    me = bpy.data.meshes.new("OwnCatBell"); bm.to_mesh(me); bm.free()
    bell = bpy.data.objects.new("OwnCatBell", me); bpy.context.collection.objects.link(bell)
    # (as a bell is (the owner's, 2026-11-15: "the bell doesn't look like one"): gold, a raised band round its middle with a groove either
    # side, and below it, facing the front, the slit with a round hole at its top end)
    bu, bv = grid01(128)
    bcol = mix((0.78, 0.5, 0.02), (0.98, 0.78, 0.2), smooth(0.0, 1.0, bv))
    for at, dk in ((0.47, 0.45), (0.57, 0.45)):
        bcol = mix(bcol, (0.35, 0.2, 0.0), (np.abs(bv - at) < 0.018).astype(np.float32) * dk)
    bcol = mix(bcol, (1.0, 0.88, 0.4), (np.abs(bv - 0.52) < 0.02).astype(np.float32) * 0.7)
    fu = np.minimum(np.abs(bu - 0.25), 1)
    slit = ((fu < 0.018) & (bv > 0.1) & (bv < 0.36)) | (np.hypot((bu - 0.25) * 2.4, bv - 0.34) < 0.045)
    bcol = mix(bcol, (0.05, 0.03, 0.0), slit.astype(np.float32))
    bell.data.materials.append(pbr("OwnCatBellGold", (1, 1, 1), tex=image("ownluckycat_bell", np.clip(bcol, 0, 1)), rough=0.3, metal=0.6))
    for p_ in bell.data.polygons:
        p_.use_smooth = True
    print("BELL", tuple(round(c, 3) for c in bc))
else:
    bell = None

root = bpy.data.objects.new("OwnLuckyCat", None)
bpy.context.collection.objects.link(root)
for o in (lp, koban) + ((bell,) if bell else ()):
    o.parent = root
print("OWNCAT_TRIS", sum(len(p.vertices) - 2 for p in lp.data.polygons), "PIVOT", tuple(round(c, 3) for c in pivot))
export_dish(root, [lp, koban, root] + ([bell] if bell else []), os.path.join(PROJECT, "public", "models", "ownluckycat.glb"), os.path.join(PROJECT, "blender", "ownluckycat.blend"), PREVIEW, ladder=False)
print("OWNCAT_DONE")
