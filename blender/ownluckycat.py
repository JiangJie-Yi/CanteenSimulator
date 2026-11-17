"""The shop's own beckoning cat (ownluckycat.glb, node "OwnLuckyCat"; items 97, 118, 121, the owner's): made after the big cat at the door
(luckycat3.glb, the one the owner circled, 2026-11-15: "the shape's still far off"), as the owner wants the shop's figures made: a clean
low-poly mesh of quads over its shape, its colour baked into a picture (as the beckoning cats and the Ebisu are), not built up of balls.

How: the door cat's mesh, turned to face -y and brought to 0.30 tall, is fused whole (a fine voxel remesh) and retopologised by QuadriFlow into
quads that run with its shape (item 246, the owner's, 2026-11-17: 「這貓怎了?」 over a wireframe of it: a coarse voxel grid before, its quads
lined up with the voxels' axes and not the cat's, read as a tangle of skewed triangles, 2,184 of them); unwrapped, and its colours baked from
the original into a 1024 picture (Cycles, selected to active), where the bake finds nothing filled from round about. The raised paw stays still (item 223, the owner's, 2026-11-16: 「你手別動好了，會不會比較好看」; it beckoned by a shape
key before, items 97 and 163). The koban is made: a pillow-edged oval plate as thick as a coin should look, where the door cat's own was.

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
from common import export_dish, grid01, image, ladder_fill, mix, pbr, smooth  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

TALL = 0.30
# (the fusing's voxel: fine, so the shape QuadriFlow lays its quads over is the door cat's own; and how many quads it lays: the silhouette
# and the face's planes kept (ears, raised paw, the paw on the coin), the rest in the picture)
FUSE_VOXEL = 0.003
QUADS = 650


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
# (where the door cat's coin is and which way it faces, for the made one: the coin itself the largest group of those faces joined through
# their edges (one face of the picture's corner is on the paw), its middle, and its axes by how its points spread (the thinnest way through
# it its face's, turned toward the front; the longest, up))
left_ = set(coin_f)
groups_ = []
while left_:
    f0 = left_.pop()
    st_, g_ = [f0], [f0]
    while st_:
        f_ = st_.pop()
        for e_ in f_.edges:
            for h_ in e_.link_faces:
                if h_ in left_:
                    left_.discard(h_)
                    st_.append(h_)
                    g_.append(h_)
    groups_.append(g_)
coin_xyz = np.array(list({v.index: tuple(v.co) for v in {v for f in max(groups_, key=len) for v in f.verts}}.values()))
KC = Vector(coin_xyz.mean(axis=0))
_w, _V = np.linalg.eigh(np.cov((coin_xyz - coin_xyz.mean(axis=0)).T))
KN = Vector(_V[:, 0] if _V[1, 0] < 0 else -_V[:, 0])
KUP = Vector(_V[:, 2] if _V[2, 2] > 0 else -_V[:, 2])
KSIDE = KUP.cross(KN)
print("COIN_FRAME", tuple(round(c, 4) for c in KC), "front", tuple(round(c, 3) for c in KN), "up", tuple(round(c, 3) for c in KUP))
# (only the coin's own faces go: the body behind it stays whole (item 246). Item 223 took off every face of the body within 7 mm of the coin
# as well (the "wall" beside it, 117 faces), which was the body's own surface behind the coin: the jagged hole it left, closed by one face
# across it, came out a twisted flap the mesh followed, a white patch on the collar by the bell and white shards with ragged ink round the
# paw on the coin (the owner's 「這貓怎了?」). The made koban, as wide as the old one, stands over where the coin hung)
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

# ---- the new mesh: fused whole, QuadriFlow's quads laid over it along its shape, shrunk back onto its surface
lp = shape_src.copy()
lp.data = shape_src.data.copy()
lp.name = "OwnCatBody"
bpy.context.collection.objects.link(lp)
lp.data.materials.clear()
select_only(lp)
m_ = lp.modifiers.new("fuse", "REMESH"); m_.mode = "VOXEL"; m_.voxel_size = FUSE_VOXEL
bpy.ops.object.modifier_apply(modifier="fuse")
# (QuadriFlow turns down a mesh with an edge of next to no length (its "needs to be manifold" warning; a voxel surface has a few, and that's
# why it seemed to do nothing in the background before): those points merged first, and anything left not a closed surface (a loose point,
# an edge with no face or three) cut out and closed again; then done at 100 times the size, its tolerances being for a metre-sized thing)
bm = bmesh.new()
bm.from_mesh(lp.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=2e-6)
for _ in range(6):
    bad_e = [e for e in bm.edges if not e.is_manifold]
    bad_v = [v for v in bm.verts if not v.is_manifold]
    if not bad_e and not bad_v:
        break
    bmesh.ops.delete(bm, geom=list({f for e in bad_e for f in e.link_faces} | {f for v in bad_v for f in v.link_faces}), context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
print("FUSED", len(bm.faces), "faces; not closed:", sum(1 for e in bm.edges if not e.is_manifold), "edges,", sum(1 for v in bm.verts if not v.is_manifold), "points")
for v in bm.verts:
    v.co *= 100
bm.to_mesh(lp.data)
bm.free()
lp.data.update()
r_ = bpy.ops.object.quadriflow_remesh(mode="FACES", target_faces=QUADS, use_mesh_symmetry=False, use_preserve_sharp=False,
                                     use_preserve_boundary=False, smooth_normals=False, seed=0)
assert r_ == {"FINISHED"}, r_
for v in lp.data.vertices:
    v.co *= 0.01
lp.data.update()
# (left where QuadriFlow lays them, on the 3 mm fused surface: shrunk back onto the door cat's own, points along the paw on the coin and the
# collar's crease were drawn onto the surface behind and the faces folded, ink showing through)
print('QUADS', len(lp.data.polygons), 'of them quads', sum(1 for p in lp.data.polygons if len(p.vertices) == 4))
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
# (where its baked rays found nothing (the holes the door cat's coin and the wall round it left): filled from the colours round about in
# the picture, which are the surface's round about (painted the cat's white before, a white patch on the red collar by the bell and white
# shards round the paw on the coin, item 246))
px = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)
valid = px[..., :3].max(axis=2) >= 0.015   # (no colour found at all: the black ear's black is lighter than this)
# (and the body just behind where the coin hung: the door cat's picture there was never painted (its coin always hid it), dark with flecks,
# and a strip of it shows beside the made koban (item 246): the texels of every face within the coin's outline (a fifth to a third wider) and
# from 3.5 cm behind its middle to 6 mm in front of it taken as empty too, so they're filled from the fur and the bib round them)
uvd_ = lp.data.uv_layers.active.data
hid_ = 0
for poly_ in lp.data.polygons:
    d_ = poly_.center - KC
    a_, u_, w_ = d_.dot(KN), d_.dot(KSIDE) / (0.031 * 1.3), d_.dot(KUP) / (0.043 * 1.2)
    if not (-0.035 < a_ < 0.006 and u_ * u_ + w_ * w_ < 1):
        continue
    hid_ += 1
    uv_ = [np.array(uvd_[li_].uv) * 1024 for li_ in poly_.loop_indices]
    for t_ in range(1, len(uv_) - 1):
        A_, B_, C_ = uv_[0], uv_[t_], uv_[t_ + 1]
        x0_, x1_ = int(max(0, min(A_[0], B_[0], C_[0]) - 2)), int(min(1023, max(A_[0], B_[0], C_[0]) + 2))
        y0_, y1_ = int(max(0, min(A_[1], B_[1], C_[1]) - 2)), int(min(1023, max(A_[1], B_[1], C_[1]) + 2))
        yy_, xx_ = np.mgrid[y0_:y1_ + 1, x0_:x1_ + 1].astype(np.float32) + 0.5
        den_ = (B_[1] - C_[1]) * (A_[0] - C_[0]) + (C_[0] - B_[0]) * (A_[1] - C_[1])
        if abs(den_) < 1e-9:
            continue
        l1_ = ((B_[1] - C_[1]) * (xx_ - C_[0]) + (C_[0] - B_[0]) * (yy_ - C_[1])) / den_
        l2_ = ((C_[1] - A_[1]) * (xx_ - C_[0]) + (A_[0] - C_[0]) * (yy_ - C_[1])) / den_
        m_in = (l1_ > -0.02) & (l2_ > -0.02) & (1 - l1_ - l2_ > -0.02)
        valid[y0_:y1_ + 1, x0_:x1_ + 1] &= ~m_in
print("BEHIND_COIN", hid_, "faces")
col_ = px[..., :3].copy()
print("BAKE_EMPTY", int((~valid).sum()))
for _ in range(48):
    acc_ = np.zeros_like(col_)
    cnt_ = np.zeros(valid.shape, np.float32)
    for sh_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sv_ = np.roll(valid, sh_, axis=(0, 1))
        acc_ += np.roll(col_, sh_, axis=(0, 1)) * sv_[..., None]
        cnt_ += sv_
    grow_ = ~valid & (cnt_ > 0)
    if not grow_.any():
        break
    col_[grow_] = acc_[grow_] / cnt_[grow_][:, None]
    valid |= grow_
px[..., :3] = col_
# (a black-and-white cat, the owner's, 2026-11-17: 「這隻招財貓換黑白色」, item 267): the door cat's orange patches (its calico's third colour)
# turned black, a little of their light and shade kept in them; the white fur, the black patches, the red collar, the green bib, the pink
# of the ears and pads, the face's lines as they were
mx_, mn_ = col_.max(axis=2), col_.min(axis=2)
sat_ = np.where(mx_ > 1e-4, (mx_ - mn_) / np.maximum(mx_, 1e-4), 0)
r_, g_, b_ = col_[..., 0], col_[..., 1], col_[..., 2]
hue_ = np.degrees(np.arctan2(np.sqrt(3) * (g_ - b_), 2 * r_ - g_ - b_)) % 360
orange_ = (hue_ > 15) & (hue_ < 48) & (sat_ > 0.3) & (mx_ > 0.25)
shade_ = 0.05 + 0.09 * np.clip((mx_ - 0.25) / 0.75, 0, 1)
for c_ in range(3):
    px[..., c_] = np.where(orange_, shade_, px[..., c_])
print("BLACK_PATCH", int(orange_.sum()), "texels")
img.pixels.foreach_set(px.ravel())
img.pack()
# (the picture into the colour only once it's baked: wired in before, it was read while it was being written)
nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
bpy.data.objects.remove(src)
bpy.data.objects.remove(fuse_src)
bpy.data.objects.remove(shape_src)

# ---- the koban, made (item 223, the owner's, 2026-11-16: 「錢幣的厚度呢?」: the lens it was before thinned to nothing at its edge and read as
# a sheet of paper, and narrower and further forward than the door cat's coin, the body's wall that hugged that coin's side stood beside it, a
# thin white sliver): a plate with a pillow edge, 1.4 cm through (as thick as the door cat's ceramic coin looks), its face flat and its rim
# rounded, standing where the door cat's coin stood and turned as it was (KC, KN, KUP), as wide as it so the wall behind its side is covered,
# its top just under the bell. Three rings of 16 round it (its face's edge, its widest, its back's edge), the face and the back each closed
# with a ladder of quads straight across (never a fan into a point): 64 faces, 92 triangles. 千萬兩 laid flat over its face
kmat = pbr("OwnCatKoban", (1, 1, 1), tex=koban_img, rough=0.35)
kc = Vector(KC)
KR = (0.031, 0.007, 0.043)
# (how far its face's edge comes in from its widest: the pillow of its rim)
KINSET = 0.9
bm = bmesh.new()
uvk = bm.loops.layers.uv.new()
KSEG = 16


def kring(scale, depth):
    """a ring of KSEG points round the koban, `depth` behind its middle (toward the body), its first at its foot, going round anticlockwise
    as it's looked at from in front"""
    out = []
    for i in range(KSEG):
        t = -math.pi / 2 + 2 * math.pi * i / KSEG
        p = kc + KSIDE * (KR[0] * scale * math.cos(t)) + KUP * (KR[2] * scale * math.sin(t)) - KN * depth
        out.append(bm.verts.new(p))
    return out


front_r, mid_r, back_r = kring(KINSET, -KR[1]), kring(1.0, 0.0), kring(KINSET, KR[1])
faces_ = ladder_fill(bm, front_r) + ladder_fill(bm, back_r[::-1])
flat_ = set(faces_)
for ra, rb in ((front_r, mid_r), (mid_r, back_r)):
    for i in range(KSEG):
        j = (i + 1) % KSEG
        faces_.append(bm.faces.new((ra[i], rb[i], rb[j], ra[j])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
for f in bm.faces:
    f.smooth = f not in flat_
    for l in f.loops:
        d_ = l.vert.co - kc
        l[uvk].uv = (0.5 + d_.dot(KSIDE) / (2 * KR[0]), 0.5 + d_.dot(KUP) / (2 * KR[2]))
me = bpy.data.meshes.new("OwnCatKoban"); bm.to_mesh(me); bm.free()
koban = bpy.data.objects.new("OwnCatKoban", me); bpy.context.collection.objects.link(koban)
koban.data.materials.append(kmat)
kz = [v.co.z for v in koban.data.vertices]
print("KOBAN", len(koban.data.polygons), "faces", sum(len(p.vertices) - 2 for p in koban.data.polygons), "tris; z", round(min(kz), 4), round(max(kz), 4))
# (the bell on its collar, made: a little gold ball where the door cat's is, just over the coin's top and a little behind it, placed by the
# coin (it was found by the patch the bake found no colour for, which goes with the coin's rim now) (54 faces)
bm = bmesh.new()
BR = 0.0135
bctr = KC + KSIDE * 0.0073 + KUP * 0.0578 - KN * 0.0069
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
print("BELL", tuple(round(c, 3) for c in bctr))

root = bpy.data.objects.new("OwnLuckyCat", None)
bpy.context.collection.objects.link(root)
for o in (lp, koban, bell):
    o.parent = root
print("OWNCAT_TRIS", sum(len(p.vertices) - 2 for p in lp.data.polygons))
export_dish(root, [lp, koban, root, bell], os.path.join(PROJECT, "public", "models", "ownluckycat.glb"), os.path.join(PROJECT, "blender", "ownluckycat.blend"), PREVIEW, ladder=False)
print("OWNCAT_DONE")
