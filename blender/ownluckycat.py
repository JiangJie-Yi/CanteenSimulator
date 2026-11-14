"""The shop's own beckoning cat (ownluckycat.glb, node "OwnLuckyCat"; items 97, 118, 121, the owner's): made after the big cat at the door
(luckycat3.glb, the one the owner circled, 2026-11-15: "the shape's still far off"), as the owner wants the shop's figures made: a clean
low-poly mesh of quads over its shape, its colour baked into a picture (as the beckoning cats and the Ebisu are), not built up of balls.

How: the door cat's mesh, turned to face -y and brought to 0.30 tall, is fused whole (a voxel remesh), retopologised into an even grid of quads
(a coarse voxel remesh) and the quads shrunk back onto its surface; unwrapped, and its colours baked from the original into a 1024 picture (Cycles,
selected to active). The raised paw (its hand, out past the head's side) cut off into a node of its own, its origin at the wrist, the game
swinging it about x to beckon; both cuts closed.

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


FONTS = ("C:/Windows/Fonts/YuMinB.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/YuGothB.ttc")


def glyph(ch):
    bpy.ops.object.text_add(location=(0, 0, 0))
    tx = bpy.context.view_layer.objects.active
    tx.data.body = ch
    for f_ in FONTS:
        if os.path.exists(f_):
            tx.data.font = bpy.data.fonts.load(f_, check_existing=True)
            break
    tx.data.size = 1.0
    tx.data.align_x = "CENTER"; tx.data.align_y = "CENTER"
    tx.data.resolution_u = 5
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    bm_ = bmesh.new(); bm_.from_mesh(o.data)
    bmesh.ops.triangulate(bm_, faces=bm_.faces[:])
    tris = [[(lp.vert.co.x, lp.vert.co.y) for lp in f.loops] for f in bm_.faces]
    bm_.free()
    bpy.data.objects.remove(o)
    return tris


def fill_tris(mask, tris, cx, cy, sx, sy):
    H_, W_ = mask.shape
    for t in tris:
        P_ = [(cx + x * sx, cy + y * sy) for x, y in t]
        x0, x1 = int(max(0, min(p_[0] for p_ in P_))), int(min(W_ - 1, max(p_[0] for p_ in P_) + 1))
        y0, y1 = int(max(0, min(p_[1] for p_ in P_))), int(min(H_ - 1, max(p_[1] for p_ in P_) + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
        (ax, ay), (bx, by), (qx, qy) = P_
        d1 = (gx - bx) * (ay - by) - (ax - bx) * (gy - by)
        d2 = (gx - qx) * (by - qy) - (bx - qx) * (gy - qy)
        d3 = (gx - ax) * (qy - ay) - (qx - ax) * (gy - ay)
        mask[y0:y1 + 1, x0:x1 + 1] |= ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))


KN = 256
ku, kv = grid01(KN)
kob = mix((0.86, 0.66, 0.2), (0.98, 0.82, 0.36), smooth(0.9, 0.2, np.hypot((ku - 0.5) * 1.4, kv - 0.5) * 2))
ring = np.hypot((ku - 0.5) / 0.47, (kv - 0.5) / 0.47)
kob = mix(kob, (0.62, 0.44, 0.1), (np.abs(ring - 0.88) < 0.03).astype(np.float32))
km = np.zeros((KN * 2, KN * 2), bool)
for i_, ch in enumerate("千萬兩"):
    fill_tris(km, glyph(ch), KN, (0.78 - i_ * 0.28) * KN * 2, 0.34 * KN, 0.25 * KN * 2)
kob = mix(kob, (0.1, 0.07, 0.04), km.reshape(KN, 2, KN, 2).mean(axis=(1, 3)))
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

# ---- the new mesh: fused, quads over it, shrunk back onto its surface
lp = src.copy()
lp.data = src.data.copy()
lp.name = "OwnCatBody"
bpy.context.collection.objects.link(lp)
lp.data.materials.clear()
select_only(lp)
# (a coarse voxel remesh: whole, and quads already, an even grid of them over it (QuadriFlow does nothing run in the background))
m_ = lp.modifiers.new("fuse", "REMESH"); m_.mode = "VOXEL"; m_.voxel_size = VOXEL
bpy.ops.object.modifier_apply(modifier="fuse")
m_ = lp.modifiers.new("onto", "SHRINKWRAP"); m_.target = src; m_.wrap_method = "NEAREST_SURFACEPOINT"
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
select_only(src, lp, active=lp)
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.06, margin=8)
# (the koban: a thin plate, too thin for the grid of quads to keep, its baked rays found nothing and it came out black. Where the picture
# baked dark: gold; and which faces those are, for where the koban goes)
px = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)
dark = px[..., :3].max(axis=2) < 0.015   # (no colour found at all: the black ear's black is lighter than this)
px[dark, :3] = (0.86, 0.66, 0.22)
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

# ---- the raised hand cut off, its own node, its origin at the wrist; the cuts closed
bm = bmesh.new()
bm.from_mesh(lp.data)
paw = [f for f in bm.faces if f.calc_center_median().x > PAW_X and PAW_Z0 * TALL < f.calc_center_median().z < PAW_Z1 * TALL]
pv = {v for f in paw for v in f.verts}
wrist = Vector((PAW_X, sum(v.co.y for v in pv) / len(pv), min(v.co.z for v in pv) + 0.012))
for f in bm.faces:
    f.select = f in paw
bm.to_mesh(lp.data)
bm.free()
select_only(lp)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="SELECTED")
bpy.ops.object.mode_set(mode="OBJECT")
hand = [o for o in bpy.data.objects if o.type == "MESH" and o is not lp][0]
hand.name = "OwnCatPaw"
for o in (lp, hand):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
sc.cursor.location = wrist
select_only(hand)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# ---- the koban, made: a flat lens of an oval, 千萬兩 written down it, set where the dark blob was, just in front of it
kmat = pbr("OwnCatKoban", (1, 1, 1), tex=koban_img, rough=0.35)
kc = Vector((sum(c.x for c in dark_at), sum(c.y for c in dark_at), sum(c.z for c in dark_at))) / max(1, len(dark_at))
kh = (max(c.z for c in dark_at) - min(c.z for c in dark_at)) if dark_at else 0.06
front = min(c.y for c in dark_at) if dark_at else kc.y
bm = bmesh.new()
uvk = bm.loops.layers.uv.new()
KR = (kh * 0.36, 0.005, kh * 0.52)
for f in qsphere(bm, (0.0, 0.0, 0.0), KR, 2):
    for l in f.loops:
        l[uvk].uv = (0.5 + l.vert.co.x / (2 * KR[0]), 0.5 + l.vert.co.z / (2 * KR[2]))
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(0.2, 3, "X"))
bmesh.ops.translate(bm, verts=bm.verts, vec=(kc.x, front - 0.004, kc.z))
me = bpy.data.meshes.new("OwnCatKoban"); bm.to_mesh(me); bm.free()
koban = bpy.data.objects.new("OwnCatKoban", me); bpy.context.collection.objects.link(koban)
koban.data.materials.append(kmat)
for p_ in koban.data.polygons:
    p_.use_smooth = True
print("KOBAN", len(dark_at), tuple(round(c, 3) for c in kc), round(kh, 3))

root = bpy.data.objects.new("OwnLuckyCat", None)
bpy.context.collection.objects.link(root)
for o in (lp, hand, koban):
    o.parent = root
print("OWNCAT_TRIS", sum(len(p.vertices) - 2 for o in (lp, hand) for p in o.data.polygons), "WRIST", tuple(round(c, 3) for c in wrist))
export_dish(root, [lp, hand, koban, root], os.path.join(PROJECT, "public", "models", "ownluckycat.glb"), os.path.join(PROJECT, "blender", "ownluckycat.blend"), PREVIEW, ladder=False)
print("OWNCAT_DONE")
