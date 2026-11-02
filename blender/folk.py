"""The customers in the boss's style: public/models/folk.glb and their painted clothes and faces in public/textures/folk/.

Made as the boss and the staff are (blender/boss.py): an Overcooked cook's big round head on a short plump body rounding off underneath,
no legs, floating mitten hands; but lighter, low in faces and shaded smooth, the detail painted rather than modelled:
- FolkBody: the body turned on a lathe (24 round), its UVs round it (u, the front at 0.5) and up it (v): what they wear is a picture
  painted for each kind of customer (textures/folk/outfit_<kind>_<n>.png: the suit and its tie, the sailor collar, the yukata and its obi,
  the maid's apron...), so a jacket's lapels and a tie cost no faces.
- FolkHead: the head, its nose and ears, in their skin (tinted by the game); FolkFace: a shell over the front of it carrying the face,
  painted in a strip of eight expressions (textures/folk/face_<type>.png: as they are, blinking, delighted, cross, sad, chewing, talking,
  surprised) for four kinds of face (male, female, elder, kid): the game shows one by sliding the picture along.
- Folk_hair_<style>: a dozen hairstyles, each one mesh in the hair's colour (tinted by the game): crop, part, long, bob, bunLow,
  bunHigh, twin, pony, perm, bald, pomp, spiky, kid, gyaru.
- Folk_acc_<name>: what some of them have about them: glasses, a moustache, headphones, a sun hat and a camera, a yellow school cap and
  a randoseru, a backpack, a maid's frilled cap, a bōsōzoku's hachimaki, hoop earrings, a yukata's obi bow and hairpin, a knitted shawl,
  a towel round the neck, a gakuran's stand collar.
- FolkHandL, FolkHandR: the mittens, in their skin.
Every part's own place; the game shows the ones each customer has.

Run:
    blender -b --factory-startup --python blender/folk.py -- <project path> [preview.png]
    (PREVIEW_SHOW="hair_twin,acc_phones" picks the parts shown in the preview; PREVIEW_CAM and PREVIEW_AT where it's seen from and looks)
"""
import math
import os
import struct
import sys
import zlib

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import pbr, export_dish  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
TEX_DIR = os.path.join(PROJECT, "public", "textures", "folk")
os.makedirs(TEX_DIR, exist_ok=True)


def P(x, y, z):
    """three's frame (y up, z toward the viewer) to Blender's (z up)"""
    return (x, -z, y)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def rgb(hexs):
    """a colour as painted (sRGB, 0..1)"""
    return np.array([int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def active():
    return bpy.context.view_layer.objects.active


bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- the figure's measure, as the boss's (blender/boss.py)
PROFILE = [(0.0, 0.0), (0.008, 0.08), (0.03, 0.155), (0.07, 0.21), (0.12, 0.243), (0.18, 0.26), (0.24, 0.262),
           (0.3, 0.255), (0.36, 0.238), (0.41, 0.21), (0.45, 0.17), (0.48, 0.11), (0.495, 0.05), (0.5, 0.0)]
BH = 1.24
DY = 0.5 * (BH - 1)
PROFILE = [(y * BH, r) for (y, r) in PROFILE]
BODY_TOP = PROFILE[-1][0]
C = Vector((0.0, 0.68 + DY, 0.0))
R = 0.27
HAND_AT = {-1: Vector((-0.31, 0.26, 0.05)), 1: Vector((0.31, 0.26, 0.05))}


def rb(y):
    for (y0, r0), (y1, r1) in zip(PROFILE, PROFILE[1:]):
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * (y - y0) / max(1e-6, y1 - y0)
    return 0.0


def on_head(x, y, out=0.0):
    z = math.sqrt(max(R * R - x * x - y * y, 0.0))
    n = Vector((x, y, z)).normalized()
    return C + n * (R + out), n


def head_at(a, e, out=0.0):
    """the point on the head at bearing a (round from +z toward +x) and elevation e"""
    n = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)))
    return C + n * (R + out)


def on_body(x, y, out=0.0):
    r = rb(y)
    z = math.sqrt(max(r * r - x * x, 0.0))
    n = Vector((x, 0, z)).normalized() if r > 0 else Vector((0, 1, 0))
    return Vector((x, y, z)) + n * out


# ---- materials (the game gives each its look; these are what they're called, and how they look in the preview)
M = {
    "body": pbr("FolkBody", lin("#c8c0b0"), rough=0.8),
    "skin": pbr("FolkSkin", lin("#f0d0b4"), rough=0.6),
    "face": pbr("FolkFace", (1, 1, 1), rough=0.6),
    "hair": pbr("FolkHair", lin("#3a2a20"), rough=0.5),
    "white": pbr("FolkWhite", lin("#f6f3ec"), rough=0.6),
    "dark": pbr("FolkDark", lin("#22201e"), rough=0.5),
    "frame": pbr("FolkFrame", lin("#2a1e18"), rough=0.4),
    "gold": pbr("FolkGold", lin("#e0b040"), rough=0.3, metal=1.0),
    "red": pbr("FolkRed", lin("#c8302a"), rough=0.5),
    "yellow": pbr("FolkYellow", lin("#f2c62a"), rough=0.5),
    "straw": pbr("FolkStraw", lin("#e4c88a"), rough=0.8),
    "bag": pbr("FolkBag", lin("#b8261c"), rough=0.4),
    "pack": pbr("FolkPack", lin("#3a4a5a"), rough=0.7),
    "phones": pbr("FolkPhones", lin("#2a2c30"), rough=0.4),
    "cup": pbr("FolkPhonesCup", lin("#e86a4a"), rough=0.4),
    "knit": pbr("FolkKnit", lin("#8a6a9a"), rough=0.9),
    "obi": pbr("FolkObi", lin("#d8a840"), rough=0.5),
}
parts = []


def fin(o, name, mat, smooth=True):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = smooth
    parts.append(o)
    return o


def from_bm(name, bm, mat, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return fin(o, name, mat, smooth)


def sphere(name, at, r, mat, seg=12, rings=8, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=P(*at))
    o = active()
    o.scale = (scale[0], scale[2], scale[1])
    # (the scale alone: transform_apply's other two default to on, and would move its origin to the world's)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return fin(o, name, mat)


def tube(name, pts, r, mat, cyclic=False, res=1):
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = r
    cd.bevel_resolution = res
    sp = cd.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    sp.use_cyclic_u = cyclic
    for spt, q in zip(sp.points, pts):
        spt.co = (*P(*q), 1)
    cd.use_fill_caps = not cyclic
    o = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return fin(active(), name, mat)


def lathe(name, profile, mat, seg=24, a0=0.0, a1=2 * math.pi, uv=False, vtop=1.0, solid=0.0):
    """turned on the y axis; `uv`: u round it (the front, +z, at 0.5), v up it (y / vtop); `solid`: a sheet given that thickness"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    n = seg if full else seg + 1
    rings = [[bm.verts.new(P(math.sin(a0 + (a1 - a0) * i / seg) * r, y, math.cos(a0 + (a1 - a0) * i / seg) * r)) for i in range(n)] for (y, r) in profile]
    for j in range(len(rings) - 1):
        for i in range(seg):
            i2 = (i + 1) % n
            try:
                f = bm.faces.new([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]])
            except ValueError:
                continue
            if uv:
                u0 = i / seg + 0.5
                if u0 >= 1.0 - 1e-9:
                    u0 -= 1.0
                u1 = u0 + 1.0 / seg
                v0, v1 = profile[j][0] / vtop, profile[j + 1][0] / vtop
                for lp, q in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                    lp[uvl].uv = q
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    o = from_bm(name, bm, mat)
    if solid:
        s = o.modifiers.new("s", "SOLIDIFY")
        s.thickness = solid
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="s")
    return o


def cut_sphere(name, r, mat, planes, seg=20, rings=12, at=None):
    """a ball round the head's middle (or `at`) with what's on the outer side of each plane (point, normal; three's frame) cut away"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=P(*(at or C)))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(P(*co)), plane_no=Vector(P(*no)).normalized(), clear_outer=True)
    bm.to_mesh(o.data)
    bm.free()
    return fin(o, name, mat)


def tuft(name, at, d, r, ln, mat, flat=1.0, seg=8, rings=6):
    """a lock (or a curl, a quiff): a soft cone from `at` out along `d`, `r` across at its root, `ln` long, flattened across by `flat`"""
    d = d.normalized()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=seg, ring_count=rings, location=(0, 0, 0))
    o = active()
    for v in o.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        t = (z + 1) / 2
        w = r * (1 - t) ** 0.8 + 0.003
        v.co = Vector((x * w, y * w * flat, t * ln))
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector(P(*d)).to_track_quat("Z", "Y")
    o.location = P(*at)
    return fin(o, name, mat)


def join(objs, name):
    """the pieces as one mesh, keeping their materials"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        if o in parts:
            parts.remove(o)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    o.data.name = name
    parts.append(o)
    return o


# ===================================================================== the figure
body = lathe("FolkBody", PROFILE, M["body"], seg=24, uv=True, vtop=BODY_TOP)

# (the head: a ball, a button nose, ears; one mesh in their skin)
h = sphere("hd", C, R, M["skin"], seg=24, rings=14)
nose = sphere("nose", on_head(0.0, -0.035, 0.002)[0], 0.022, M["skin"], seg=8, rings=6)
ears = [sphere(f"ear{sd}", Vector((sd * (R + 0.006), C.y - 0.005, -0.015)), 0.048, M["skin"], seg=10, rings=6, scale=(0.45, 0.85, 0.95)) for sd in (-1, 1)]
join([h, nose] + ears, "FolkHead")

# (the face: a shell just off the front of the head, its picture a strip of eight; this one's UVs over the first)
FACE_AZ, FACE_EL = (-62.0, 62.0), (-52.0, 42.0)
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
NA, NE = 14, 10
grid = []
for j in range(NE + 1):
    row = []
    for i in range(NA + 1):
        az = math.radians(FACE_AZ[0] + (FACE_AZ[1] - FACE_AZ[0]) * i / NA)
        el = math.radians(FACE_EL[0] + (FACE_EL[1] - FACE_EL[0]) * j / NE)
        row.append(bm.verts.new(P(*head_at(az, el, 0.0035))))
    grid.append(row)
for j in range(NE):
    for i in range(NA):
        f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
        for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
            lp[uvl].uv = ((ii / NA) / 8.0, jj / NE)
from_bm("FolkFace", bm, M["face"])

# (hands: floating mittens, a plump paddle and a thumb, each its own mesh about where it hangs)
for sd, at in HAND_AT.items():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=(0, 0, 0))
    hm = active()
    for v in hm.data.vertices:
        x, y, z = v.co.x, v.co.z, -v.co.y
        w = 1.0 + 0.12 * (-y)
        q = Vector(P(x * 0.05 * w, y * 0.06, z * 0.036)) + Vector(P(0, 0, 0.016 * max(0.0, -y) ** 2))
        v.co = q
    hm.location = P(*at)
    hm.rotation_euler = (0, -sd * 0.25, 0)
    fin(hm, "mitt", M["skin"])
    th = sphere("thumb", at + Vector((-sd * 0.036, 0.014, 0.024)), 1.0, M["skin"], seg=8, rings=6, scale=(0.019, 0.019, 0.03))
    th.rotation_euler = (0.5, 0, -sd * 0.6)
    join([hm, th], f"FolkHand{'L' if sd < 0 else 'R'}")

# ===================================================================== hairstyles
HT = 0.012


def back_shell(name="back", nape=-0.15):
    """the hair round the back and sides, from just behind the ears, down to the nape"""
    return cut_sphere(name, R + HT, M["hair"], [((0, 0, 0.055), (0, 0, 1)), ((0, nape, -R), Vector((0, -1, 0.4)))], seg=20, rings=12)


def crown(name="crown", fringe=False):
    """the hair over the crown: a man's front edge just over the brows; a woman's brought down straight over them (a fringe)"""
    co, no = ((0, -0.03, 0), (0, -1, 0.47)) if fringe else ((0, 0.01, 0), (0, -1, 0.4))
    return cut_sphere(name, R + HT * 1.4, M["hair"], [(co, no)], seg=22, rings=12)


def side_locks(length=0.13, at_e=0.3):
    return [tuft(f"side{sd}", head_at(sd * 1.22, at_e, 0.006), Vector((sd * 0.08, -1, 0.12)), 0.03, length, M["hair"], 0.5) for sd in (-1, 1)]


def style(name, objs):
    return join(objs, f"Folk_hair_{name}")


style("crop", [back_shell(), crown()])
style("part", [back_shell(), crown(), tuft("partlock", head_at(0.55, 0.62, -0.004), head_at(-0.2, 0.46, 0.014) - head_at(0.55, 0.62, -0.004), 0.05, 0.2, M["hair"], 0.35)])
# (long: down the back past the shoulders, a lock before each ear down to the chest)
long_back = lathe("longback", [(C.y + 0.05, R + 0.016), (C.y - 0.08, R + 0.018), (C.y - 0.2, 0.25), (C.y - 0.32, 0.24), (C.y - 0.4, 0.22)],
                  M["hair"], seg=14, a0=math.pi * 0.58, a1=math.pi * 1.42, solid=0.018)
style("long", [back_shell(nape=-0.25), crown(fringe=True), long_back] + side_locks(0.3, 0.2))
# (bob: cut level with the chin all round but the face)
bob = lathe("bobshell", [(C.y + 0.12, R + 0.02), (C.y, R + 0.026), (C.y - 0.12, R + 0.02), (C.y - 0.16, R - 0.01)],
            M["hair"], seg=16, a0=math.pi * 0.32, a1=math.pi * 1.68, solid=0.016)
style("bob", [back_shell(), crown(fringe=True), bob])
style("bunLow", [back_shell(nape=-0.2), crown(fringe=True), sphere("bunlo", head_at(math.pi, -0.05, 0.03), 0.075, M["hair"], seg=12, rings=8)] + side_locks())
style("bunHigh", [back_shell(nape=-0.2), crown(fringe=True), sphere("bunhi", head_at(math.pi, 0.62, 0.05), 0.085, M["hair"], seg=12, rings=8, scale=(1.1, 0.9, 0.85))] + side_locks())
# (twin tails, tied high either side)
twin = [tuft(f"tail{sd}", head_at(sd * 1.35, 0.42, 0.0), Vector((sd * 0.45, -1, -0.2)), 0.05, 0.3, M["hair"], 0.75) for sd in (-1, 1)]
ties = [sphere(f"tie{sd}", head_at(sd * 1.35, 0.42, 0.012), 0.022, M["red"], seg=8, rings=6) for sd in (-1, 1)]
style("twin", [back_shell(), crown(fringe=True)] + twin + ties)
pony = tuft("pony", head_at(math.pi, 0.45, 0.02), Vector((0, -1, -0.35)), 0.06, 0.32, M["hair"], 0.75)
style("pony", [back_shell(), crown(fringe=True), pony, sphere("ponytie", head_at(math.pi, 0.45, 0.03), 0.024, M["red"], seg=8, rings=6)])
def perm_shell(name="perm"):
    """a grandmother's perm (the owner: seventeen balls stuck on, each inked round, looked odd): one soft, full shell over the crown, the
    sides and the back, as a set perm sits, cut by one tilted plane, so its edge is a smooth line from over the brows in front, past the
    ears' tops, down to the nape; the curls only bumps in its surface (many, small, packed), so its outline is scalloped and its ink goes
    round the whole of it, not round each curl"""
    rnd = __import__("random").Random(11)
    curls = []
    n = 62
    for k in range(n):
        y = 1 - 2 * (k + 0.5) / n
        rr = math.sqrt(max(0.0, 1 - y * y))
        t = k * math.pi * (3 - math.sqrt(5))
        curls.append((Vector((rr * math.sin(t), y, rr * math.cos(t))), rnd.uniform(0.85, 1.15)))
    cut_n = Vector((0, -1, 0.55)).normalized()
    bm = bmesh.new()
    # (as fine as the curls need and no finer: each grandmother wears it)
    seg, rings = 44, 24
    grid = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        row = []
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            d = Vector((math.sin(th) * math.sin(ph), math.cos(th), math.sin(th) * math.cos(ph)))
            bump = 0.0
            for c, k in curls:
                cs = d.dot(c)
                # (each curl a round cap, as a ball pressed into the mass: deep enough between them that each one shows)
                a = math.acos(max(-1.0, min(1.0, cs)))
                W = 0.29 * k
                if a < W:
                    bump = max(bump, 0.052 * k * math.sqrt(1 - (a / W) ** 2))
            # (fuller over the crown and the sides than at the nape: a set perm's round shape; and drawn in to the scalp at its edge, so it
            # sits on the head there and doesn't stand off it like a cap)
            full = 0.016 + 0.012 * max(0.0, d.y + 0.2)
            edge = max(0.0, -(d * R - Vector((0, -0.06, 0))).dot(cut_n))
            hug = min(1.0, edge / 0.09) ** 0.7
            row.append(bm.verts.new(P(*(C + d * (R + 0.004 + (full + bump) * hug)))))
            if i in (0, rings):
                break
        grid.append(row)
    for i in range(rings):
        for j in range(seg):
            j2 = (j + 1) % seg
            a_, b_ = grid[i], grid[i + 1]
            if i == 0:
                bm.faces.new((a_[0], b_[j], b_[j2]))
            elif i == rings - 1:
                bm.faces.new((a_[j], b_[0], a_[j2]))
            else:
                bm.faces.new((a_[j], b_[j], b_[j2], a_[j2]))
    # (one tilted plane: over the brows in front (0.09 up), the ears' tops at the sides (-0.06), the nape behind (-0.21))
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(P(*(C + Vector((0, -0.06, 0))))), plane_no=Vector(P(0, -1, 0.55)).normalized(), clear_outer=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return fin(o, name, M["hair"])


style("perm", [perm_shell()])
# (bald on top: a ring of hair round the back and the sides only)
ring = lathe("baldring", [(C.y + 0.07, R + 0.008), (C.y + 0.03, R + 0.016), (C.y - 0.06, R + 0.014), (C.y - 0.11, R - 0.01)],
             M["hair"], seg=16, a0=math.pi * 0.4, a1=math.pi * 1.6, solid=0.012)
style("bald", [ring])
# (a pompadour: the quiff rolled up and forward over the brow)
quiff = [tuft("quiff0", head_at(0.0, 0.95, -0.01), Vector((0, 0.35, 1.0)), 0.1, 0.17, M["hair"], 0.8, seg=10, rings=8),
         tuft("quiff1", head_at(0.0, 1.25, -0.01), Vector((0, 0.6, 1.0)), 0.08, 0.13, M["hair"], 0.8)]
style("pomp", [back_shell(), crown()] + quiff)
def clump(name, frm, to, r, flat=0.5, n=5, m=5):
    """a clump of hair combed along the head: from `frm` (bearing, elevation), its root a little under the hair's face, round the head to
    `to` (bearing, elevation, how far off the head its point stands), lifting off it and narrowing to that point; `r` its half-width at the
    root, `flat` its thickness against its width"""
    n0 = (head_at(*frm) - C).normalized()
    n1 = (head_at(to[0], to[1]) - C).normalized()
    ang = n0.angle(n1)

    def round_to(t):
        return n0 if ang < 1e-4 else (n0 * math.sin((1 - t) * ang) + n1 * math.sin(t * ang)) / math.sin(ang)
    way = [(C + round_to(i / n) * (R + HT * 0.4 + to[2] * (i / n) ** 2), round_to(i / n)) for i in range(n + 1)]
    bm = bmesh.new()
    rings = []
    for i in range(n):
        p, out = way[i]
        across = (way[i + 1][0] - p).normalized().cross(out).normalized()
        # (swelling out of the hair from a narrow root, so it rises from it with no edge, then narrowing to its point)
        w = r * max(0.2, min(1.0, (i / n / 0.3) ** 0.6)) * (1 - i / n) ** 0.75
        rings.append([bm.verts.new(P(*(p + across * math.cos(2 * math.pi * j / m) * w + out * math.sin(2 * math.pi * j / m) * w * flat))) for j in range(m)])
    tip = bm.verts.new(P(*way[n][0]))
    for i in range(n - 1):
        for j in range(m):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % m], rings[i + 1][(j + 1) % m], rings[i + 1][j]))
    for j in range(m):
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % m], tip))
    bm.faces.new(rings[0][::-1])
    return from_bm(name, bm, M["hair"])


# (spiky: a schoolboy's cut in clumps combed round the head from the crown, each lifting off it to a point at its end: a fringe of points over
# the brow, one at each temple and over each ear, the back's down to a ragged nape, and a few standing up off the top and the crown; once a
# ring of cones stood straight out of a smooth cap, a hedgehog's)
SPIKY = (
    [((ar, 1.3), (at, 0.3, 0.035), 0.085) for ar, at in ((-0.7, -0.48), (-0.2, -0.12), (0.3, 0.24), (0.8, 0.6))]
    + [((sd * 0.9, 1.15), (sd * 1.12, 0.22, 0.03), 0.08) for sd in (-1, 1)]
    + [((sd * 1.6, 1.1), (sd * 1.62, 0.2, 0.03), 0.08) for sd in (-1, 1)]
    + [((math.pi + d * 0.5, 1.25), (math.pi + d, -0.3, 0.035), 0.085) for d in (-1.0, -0.35, 0.3, 0.95)]
    + [((math.pi + d, 1.4), (math.pi + d * 1.5, 0.95, 0.13), 0.075) for d in (-0.35, 0.3)]
    + [((sd * 0.3, 1.0), (math.pi - sd * 0.5, 1.3, 0.11), 0.075) for sd in (-1, 1)]
)
spikes = [clump(f"spike{k}", frm, to, r) for k, (frm, to, r) in enumerate(SPIKY)]
style("spiky", [back_shell(), crown()] + spikes)
style("kid", [back_shell(), crown(fringe=True), tuft("ahoge", head_at(0.0, 1.3, -0.006), Vector((0.1, 1, 0.75)), 0.032, 0.1, M["hair"], 0.45)])
def hair_cap(name, hairline, seg=24, rings=9, full=0.02):
    """a cap of hair in clean quads: every column from the crown down to the hairline (`hairline(bearing)` its elevation there, bearing 0 the
    front), a little off the head and fuller over the top, drawn in to the scalp along its edge so it sits on the head there; a ring of
    thin triangles only round the very top of the crown. (The other styles' shells are balls cut by planes, which leaves slivers and odd
    faces along each cut and a pole at the top: the owner saw the gyaru's in the wireframe)"""
    bm = bmesh.new()
    top = bm.verts.new(P(*(C + Vector((0, 1, 0)) * (R + HT * 1.4 + full + 0.008))))
    cols = []
    for j in range(seg):
        a = 2 * math.pi * j / seg - math.pi
        e_h = hairline(a)
        col = []
        for i in range(1, rings + 1):
            t = i / rings
            e = math.pi / 2 - (math.pi / 2 - e_h) * t
            hug = 1 - 0.8 * t ** 4
            col.append(bm.verts.new(P(*head_at(a, e, (HT * 1.4 + full * max(0.0, math.sin(e)) + 0.008) * hug + 0.002))))
        cols.append(col)
    for j in range(seg):
        j2 = (j + 1) % seg
        bm.faces.new((top, cols[j2][0], cols[j][0]))
        for i in range(rings - 1):
            bm.faces.new((cols[j][i], cols[j2][i], cols[j2][i + 1], cols[j][i + 1]))
    return from_bm(name, bm, M["hair"])


def drill(name, top, down, length, r0, turns=2.2, sides=10, rings=16):
    """a ringlet (縦ロール) hanging from `top` along `down`: a lock twisted round on itself, two spiral ridges running round it to its tip,
    swelling a little below its root and narrowing to a point; clean quads, a fan only at its tip and a cap at its root (in the hair)"""
    d = down.normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 1e-3:
        u = d.cross(Vector((1, 0, 0)))
    u.normalize()
    w = d.cross(u).normalized()
    bm = bmesh.new()
    rings_v = []
    for i in range(rings + 1):
        t = i / rings
        c = top + d * length * t
        rr = r0 * (1 - 0.72 * t ** 1.2) * (0.78 + 0.22 * math.sin(math.pi * min(1.0, t * 2.5)))
        ring = []
        for k in range(sides):
            th = 2 * math.pi * k / sides
            ridge = 1 + 0.26 * math.sin(2 * th - 2 * math.pi * turns * t)
            ring.append(bm.verts.new(P(*(c + (u * math.cos(th) + w * math.sin(th)) * rr * ridge))))
        rings_v.append(ring)
    tip = bm.verts.new(P(*(top + d * (length + r0 * 0.35))))
    for i in range(rings):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((rings_v[i][k], rings_v[i][k2], rings_v[i + 1][k2], rings_v[i + 1][k]))
    for k in range(sides):
        bm.faces.new((rings_v[-1][k], rings_v[-1][(k + 1) % sides], tip))
    bm.faces.new(rings_v[0][::-1])
    return from_bm(name, bm, M["hair"])


# (gyaru: long, big and full, a fringe over the brows, the back down past the shoulders, and a ringlet down each side from behind the ear (it
# was three balls stacked up each side, and the cap two cut balls))
long_back2 = lathe("longback2", [(C.y + 0.05, R + 0.016), (C.y - 0.08, R + 0.018), (C.y - 0.2, 0.25), (C.y - 0.32, 0.24), (C.y - 0.4, 0.22)],
                   M["hair"], seg=14, a0=math.pi * 0.58, a1=math.pi * 1.42, solid=0.018)
gyaru_cap = hair_cap("gyarucap", lambda a: 0.35 - 0.95 * (lambda x: x * x * (3 - 2 * x))(min(1.0, abs(a) / math.pi)), full=0.03)
ringlets = [drill(f"ringlet{sd}", head_at(sd * 1.32, -0.1, 0.03), Vector((sd * 0.14, -1, 0.06)), 0.3, 0.056) for sd in (-1, 1)]
style("gyaru", [gyaru_cap, long_back2] + ringlets)

# ===================================================================== what some of them have about them
EY = 0.015


def acc(name, objs):
    return join(objs, f"Folk_acc_{name}") if len(objs) > 1 else fin(objs[0], f"Folk_acc_{name}", objs[0].data.materials[0])


# (glasses: a round-cornered frame round each eye, a bridge, arms back to the ears)
gl = []
for sd in (-1, 1):
    ex = sd * 0.09
    ring = []
    for i in range(16):
        t = 2 * math.pi * i / 16
        c_, s_ = math.cos(t), math.sin(t)
        ring.append(on_head(ex + 0.05 * math.copysign(abs(c_) ** 0.7, c_), EY + 0.04 * math.copysign(abs(s_) ** 0.7, s_), 0.022)[0])
    gl.append(tube(f"gl{sd}", ring, 0.0055, M["frame"], cyclic=True))
    a_out = math.asin(0.143 / R)
    arm = [on_head(sd * 0.143, EY + 0.012, 0.022)[0]] + [head_at(sd * (a_out + (math.radians(84) - a_out) * k / 4), math.asin((EY + 0.012) / R), 0.012 + 0.01 * (1 - k / 4)) for k in range(1, 5)]
    gl.append(tube(f"ga{sd}", arm, 0.0045, M["frame"]))
gl.append(tube("gb", [on_head(x, EY + 0.012 + 0.006 * (1 - (x / 0.033) ** 2), 0.024)[0] for x in (-0.033, 0, 0.033)], 0.005, M["frame"]))
acc("glasses", gl)
# (a moustache: two soft wings under the nose, in the hair's colour)
acc("moustache", [tube(f"mo{sd}", [on_head(sd * (0.012 + 0.036 * u), -0.07 + 0.008 * math.sin(math.pi * u) - 0.01 * u * u, 0.006)[0] for u in (0, 0.33, 0.66, 1)], 0.0095, M["hair"]) for sd in (-1, 1)])
# (headphones: a band over the crown, a cup on each ear)
band = tube("hpb", [head_at(math.radians(90) * (2 * u - 1), math.radians(90) * (1 - abs(2 * u - 1)) ** 0.6, 0.03) for u in [k / 10 for k in range(11)]], 0.012, M["phones"])
cups = []
for sd in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.06, depth=0.04, location=P(sd * (R + 0.03), C.y - 0.01, 0))
    cy = active()
    cy.rotation_euler = (0, math.pi / 2, 0)
    cups.append(fin(cy, f"cup{sd}", M["cup"]))
acc("phones", [band] + cups)
# (a straw sun hat: a wide brim, its crown and a ribbon round it)
brim = lathe("brim", [(C.y + 0.17, 0.2), (C.y + 0.15, 0.33), (C.y + 0.13, 0.38)], M["straw"], seg=20, solid=0.012)
hcrown = lathe("hcrown", [(C.y + 0.16, 0.25), (C.y + 0.26, 0.24), (C.y + 0.32, 0.18), (C.y + 0.335, 0.0)], M["straw"], seg=20)
ribbon_ = lathe("hrib", [(C.y + 0.165, 0.252), (C.y + 0.205, 0.248)], M["red"], seg=20, solid=0.004)
acc("sunhat", [brim, hcrown, ribbon_])
# (a camera on a strap round the neck, on the chest)
cam_at = on_body(0.0, 0.47, 0.03)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(*cam_at))
cb = active()
cb.scale = (0.13, 0.045, 0.08)
bpy.ops.object.transform_apply(scale=True)
bv = cb.modifiers.new("b", "BEVEL")
bv.width = 0.01
bv.segments = 2
bpy.context.view_layer.objects.active = cb
bpy.ops.object.modifier_apply(modifier="b")
fin(cb, "camb", M["dark"])
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.03, depth=0.05, location=P(*(cam_at + Vector((0.015, 0, 0.04)))))
ln = active()
ln.rotation_euler = (math.pi / 2, 0, 0)
fin(ln, "camlens", M["frame"])
strap = tube("camstrap", [on_body(-0.05, 0.5, 0.01), on_body(-0.12, 0.58, 0.004), Vector((-0.14, 0.62, 0.0)), Vector((0, 0.6, -0.18)),
                          Vector((0.14, 0.62, 0.0)), on_body(0.12, 0.58, 0.004), on_body(0.05, 0.5, 0.01)], 0.006, M["dark"])
acc("camera", [cb, ln, strap])
# (a schoolchild's yellow cap, round, with a short brim all round)
acc("schoolhat", [lathe("sch", [(C.y + 0.06, R + 0.05), (C.y + 0.08, R + 0.02), (C.y + 0.2, R - 0.02), (C.y + 0.27, 0.16), (C.y + 0.3, 0.0)], M["yellow"], seg=20),
                  lathe("schb", [(C.y + 0.06, R + 0.01), (C.y + 0.055, R + 0.06)], M["yellow"], seg=20, solid=0.008)])


def backpack(name, mat, w, hgt, d, y0, round_top=0.05):
    z = -(rb(y0 + hgt / 2) + d / 2 - 0.01)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, y0 + hgt / 2, z))
    b = active()
    b.scale = (w, d, hgt)
    bpy.ops.object.transform_apply(scale=True)
    bvl = b.modifiers.new("b", "BEVEL")
    bvl.width = round_top
    bvl.segments = 3
    bpy.context.view_layer.objects.active = b
    bpy.ops.object.modifier_apply(modifier="b")
    fin(b, name + "box", mat)
    straps = [tube(f"{name}s{sd}", [Vector((sd * 0.09, y0 + hgt - 0.02, z + d / 2 - 0.02)), on_body(sd * 0.12, 0.6, 0.012), on_body(sd * 0.15, 0.42, 0.012),
                                    Vector((sd * 0.12, y0 + 0.04, z + d / 2 - 0.02))], 0.012, mat) for sd in (-1, 1)]
    return [b] + straps


acc("randoseru", backpack("rs", M["bag"], 0.3, 0.3, 0.16, 0.24))
acc("backpack", backpack("bp", M["pack"], 0.32, 0.3, 0.14, 0.2, 0.08))
# (the maid's cap: a frilled white band over the crown)
frill = tube("mfb", [head_at(math.radians(85) * (2 * u - 1), math.radians(60) + math.radians(30) * (1 - abs(2 * u - 1)), 0.03) for u in [k / 10 for k in range(11)]], 0.018, M["white"])
frills = [sphere(f"mf{k}", head_at(math.radians(85) * (2 * (k / 8) - 1), math.radians(60) + math.radians(30) * (1 - abs(2 * (k / 8) - 1)), 0.045), 0.022, M["white"], seg=8, rings=5) for k in range(9)]
acc("maidcap", [frill] + frills)
# (the bōsōzoku's hachimaki: a white band round the brow, the rising sun on its front)
hb = tube("hcb", [head_at(2 * math.pi * k / 20, math.asin(0.11 / R) - 0.1 * max(0.0, -math.cos(2 * math.pi * k / 20)), 0.02) for k in range(20)], 0.02, M["white"], cyclic=True)
sun = sphere("hsun", head_at(0.0, math.asin(0.11 / R), 0.038), 0.026, M["red"], seg=10, rings=6, scale=(1, 1, 0.3))
acc("hachimaki", [hb, sun])
# (hoop earrings, gold)
hoops = []
for sd in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.005, major_segments=16, minor_segments=6, location=P(sd * (R + 0.02), C.y - 0.07, 0.0))
    t = active()
    t.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    hoops.append(fin(t, f"hoop{sd}", M["gold"]))
acc("hoops", hoops)
# (the yukata's obi bow on the back, and a flower hairpin)
BELT = 0.235 * BH
bow = [sphere(f"bw{sd}", Vector((sd * 0.09, BELT + 0.05, -(rb(BELT + 0.05) + 0.04))), 0.07, M["obi"], seg=10, rings=6, scale=(1, 0.65, 0.4)) for sd in (-1, 1)]
bow.append(sphere("bwk", Vector((0, BELT + 0.05, -(rb(BELT + 0.05) + 0.05))), 0.035, M["obi"], seg=8, rings=6))
acc("obibow", bow)
pin = [sphere(f"kp{k}", head_at(1.0 + 0.12 * math.cos(2 * math.pi * k / 5), 0.75 + 0.12 * math.sin(2 * math.pi * k / 5), 0.03), 0.022, M["red"], seg=8, rings=5) for k in range(5)]
pin.append(sphere("kpc", head_at(1.0, 0.75, 0.04), 0.016, M["yellow"], seg=8, rings=5))
acc("kanzashi", pin)
# (a knitted shawl round the shoulders, and a towel round the neck)
acc("shawl", [lathe("shawl", [(0.6, 0.15), (0.56, 0.22), (0.5, 0.25), (0.46, 0.262)], M["knit"], seg=20, solid=0.02)])
NY = 0.575
tw = [tube("nt", [Vector((math.sin(2 * math.pi * i / 16) * 0.172, NY + 0.015 * math.cos(2 * math.pi * i / 16), math.cos(2 * math.pi * i / 16) * 0.172)) for i in range(16)], 0.022, M["white"], cyclic=True)]
tw += [tube(f"nte{sd}", [on_body(sd * (0.075 + 0.01 * u), NY - 0.01 - 0.15 * u, 0.012) for u in (0, 0.5, 1)], 0.02, M["white"]) for sd in (-1, 1)]
acc("towel", tw)
# (a gakuran's stand collar, black, round the neck)
acc("collar", [lathe("collar", [(0.53, 0.2), (0.57, 0.185), (0.61, 0.16)], M["dark"], seg=20, solid=0.015)])

root = bpy.data.objects.new("Folk", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root


# ===================================================================== the pictures: what they wear, their faces
def write_png(path, arr):
    """an (h, w, 3|4) array, its row 0 the bottom (as UVs run), written as an 8-bit PNG top row first"""
    a = np.clip(np.flipud(arr), 0, 1)
    h, w, ch = a.shape
    data = (a * 255 + 0.5).astype(np.uint8)
    raw = b"".join(b"\x00" + data[y].tobytes() for y in range(h))

    def chunk(tag, body_):
        c = struct.pack(">I", len(body_)) + tag + body_
        return c + struct.pack(">I", zlib.crc32(tag + body_) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6 if ch == 4 else 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


# ---- the clothes, one picture for each kind (and its other colours): u round the body (the front at 0.5), v up it (the neck at 1)
OW, OH = 256, 128
U = np.tile((np.arange(OW) + 0.5) / OW, (OH, 1))
V = np.tile(((np.arange(OH) + 0.5) / OH)[:, None], (1, OW))
DU = U - 0.5                       # (round from the front: 0 at its middle, ±0.5 at the back)
AY = V * BODY_TOP                  # (height on the body)
WAIST = 0.42
NECK = 0.86


def fill(col):
    return np.broadcast_to(rgb(col), (OH, OW, 3)).copy()


def put(img, mask, col, a=1.0):
    m = np.clip(mask.astype(np.float32) * a, 0, 1)[..., None]
    img[:] = img * (1 - m) + rgb(col) * m


def soft(x, w=0.004):
    return np.clip(0.5 + x / w, 0, 1)


def weave(img, k=0.05):
    rng = np.random.default_rng(3)
    n = rng.random((OH, OW)).astype(np.float32)
    t = 1.0 + (np.sin(U * 2 * np.pi * 96) * np.sin(V * 2 * np.pi * 48)) * k * 0.5 + (n - 0.5) * k
    img *= t[..., None]


def vee(depth=0.22, half=0.07):
    """the open front of a jacket or a shirt at the neck: a V, `half` across at the top, down to NECK - depth"""
    tip = NECK - depth
    return (V > tip) & (np.abs(DU) < half * (V - tip) / depth)


def pinstripe(img, col, every=0.02):
    put(img, (np.abs(((U / every) % 1.0) - 0.5) < 0.06) & (V < NECK), col, 0.6)


def check(img, a, b, every=0.05):
    put(img, (((U / every) % 1.0) < 0.5) ^ (((V * 0.4 / every) % 1.0) < 0.5), a, 0.35)
    put(img, (np.abs(((U / every) % 1.0) - 0.25) < 0.04) | (np.abs(((V * 0.4 / every) % 1.0) - 0.25) < 0.04), b, 0.5)


def dots(img, col, every_u=0.07, every_v=0.16, r=0.012, petals=0):
    cu = (U / every_u + 0.5 * (np.floor(V / every_v) % 2)) % 1.0 - 0.5
    cv = (V / every_v) % 1.0 - 0.5
    rr = np.hypot(cu * every_u, cv * every_v * 0.42)
    if petals:
        a = np.arctan2(cv * every_v * 0.42, cu * every_u)
        rr = rr / (0.72 + 0.28 * np.abs(np.cos(petals / 2 * a)))
    put(img, rr < r, col)


def buttons(img, col, at=(0.62, 0.72), x=0.0, r=0.009):
    for v in at:
        put(img, np.hypot((DU - x) * 1.0, (V - v) * 0.42) < r, col)


def tie(img, col, stripe=None):
    w = np.where(V > 0.8, 0.018, 0.018 + (0.8 - V) * 0.06)
    m = (np.abs(DU) < w) & (V > 0.52) & (V < NECK - 0.03)
    put(img, m, col)
    put(img, (np.abs(DU) < 0.022) & (V > NECK - 0.06) & (V < NECK - 0.02), col)
    if stripe:
        put(img, m & (np.abs((((V + DU) / 0.05) % 1.0) - 0.5) < 0.12), stripe)


def lapels(img, col, depth=0.3):
    tip = NECK - depth
    edge = np.abs(np.abs(DU) - 0.075 * (V - tip) / depth)
    put(img, (V > tip) & (V < NECK) & (edge < 0.008), col)


def outfit(kind, n):
    """what `kind` wears (its `n`th colours), as a picture round the body"""
    if kind == "salaryman":
        suit = ["#2b3444", "#3a3e46"][n]
        img = fill(suit)
        pinstripe(img, "#5a6474")
        put(img, vee(0.24, 0.075), "#f4f2ee")
        tie(img, ["#a8322a", "#2a4a8a"][n], "#e8c050")
        lapels(img, "#1a2030")
        buttons(img, "#1a1e26", (0.5, 0.58), 0.0, 0.007)
    elif kind == "officeLady":
        img = fill(["#6a6f78", "#7a5a5a"][n])
        put(img, V < WAIST, ["#4a4f58", "#5a3e3e"][n])
        put(img, vee(0.22, 0.07), "#f6f4f0")
        lapels(img, "#40444c")
        buttons(img, "#d8c070", (0.55,), 0.0, 0.008)
    elif kind == "schoolgirl":
        img = fill("#f4f1ea")
        put(img, V < WAIST, "#23324a")
        put(img, (V < WAIST) & (np.abs(((U / 0.035) % 1.0) - 0.5) < 0.05), "#16223a")
        put(img, (V > 0.76) | vee(0.2, 0.09) & (V > 0.66), "#23324a")
        put(img, vee(0.2, 0.06) & (V > 0.66), "#f4f1ea")
        put(img, (np.abs(V - 0.79) < 0.008) & ~vee(0.2, 0.1), "#f4f1ea")
        put(img, (np.abs(DU) < 0.03 + (0.72 - V) * 0.25) & (V > 0.6) & (V < 0.72), ["#c8302a", "#2a4a9a"][n])
    elif kind == "schoolboy":
        img = fill(["#1c1e26", "#22263a"][n])
        buttons(img, "#e0b040", (0.48, 0.58, 0.68, 0.78), 0.0, 0.011)
        put(img, V > 0.84, "#101218")
    elif kind == "grandma":
        img = fill(["#c9b48a", "#9a8ab0"][n])
        dots(img, "#f2e8d8", 0.06, 0.14, 0.011, petals=5)
        put(img, np.abs(DU) < 0.006, "#7a6a50")
        buttons(img, "#f4f0e6", (0.5, 0.6, 0.7), 0.012, 0.008)
        put(img, V < WAIST - 0.04, ["#5a4a3e", "#4a4a5a"][n])
    elif kind == "grandpa":
        img = fill("#f0ece2")
        vest = ~vee(0.36, 0.11) & (V > WAIST - 0.02)
        put(img, vest, ["#7a5a3a", "#5a6a4a"][n])
        put(img, vest & ((np.abs(((U / 0.04) % 1.0) - 0.5) < 0.08) | (np.abs(((V / 0.05) % 1.0) - 0.5) < 0.1)), "#000000", 0.15)
        put(img, V < WAIST - 0.02, "#4a4038")
    elif kind == "kid":
        img = fill(["#e85a4a", "#4a8ad8"][n])
        put(img, ((V / 0.07) % 1.0) < 0.45, "#f6f2ea")
        put(img, V < WAIST, "#2a4a7a")
    elif kind == "uncle":
        img = fill(["#4a7a5a", "#a8432f"][n])
        dots(img, "#f2d0a0", 0.09, 0.2, 0.02, petals=5)
        dots(img, "#2a3a2a", 0.09, 0.2, 0.005)
        buttons(img, "#f4f0e6", (0.5, 0.6, 0.7, 0.8), 0.0, 0.007)
        put(img, V < WAIST - 0.03, "#c8b48a")
    elif kind == "collegeStudent":
        img = fill(["#6d7f8c", "#8a4a3a"][n])
        check(img, "#1a1a1a", "#f0e8d0")
        put(img, vee(0.3, 0.09), "#f2f0ea")
        put(img, V < WAIST, "#3a4a6a")
        put(img, (V < WAIST) & (np.abs(((U / 0.25) % 1.0) - 0.5) < 0.004), "#c8a050")
    elif kind == "yukataLady":
        base = ["#3a5a8c", "#a84a6a"][n]
        img = fill(base)
        dots(img, "#f4efe6", 0.08, 0.18, 0.02, petals=5)
        dots(img, "#f2c84a", 0.08, 0.18, 0.005)
        cross = (np.abs(DU - (V - 0.6) * 0.32) < 0.03) & (V > 0.6) | (np.abs(DU + (V - 0.6) * 0.32) < 0.03) & (V > 0.66)
        put(img, cross, "#f4efe6")
        put(img, (V > 0.42) & (V < 0.58), ["#e8b84a", "#e8d8a8"][n])
        put(img, np.abs(V - 0.5) < 0.008, "#c8302a")
    elif kind == "delinquent":
        img = fill("#15161c")
        put(img, np.abs(DU) < 0.05 + 0.02 * (V > 0.6), "#a8242a")
        put(img, (np.abs(np.abs(DU) - 0.05) < 0.006), "#e0b040")
        buttons(img, "#e0b040", (0.3, 0.42, 0.54), -0.065, 0.009)
        put(img, V > 0.86, "#0c0d12")
    elif kind == "bosozoku":
        coat = ["#f2efe8", "#4a2a5e"][n]
        img = fill(coat)
        ink = "#c8302a" if n == 0 else "#e0b040"
        for k in range(4):
            put(img, (np.abs(DU - 0.1) < 0.012) & (np.abs(V - (0.78 - k * 0.07)) < 0.025), ink)
            put(img, (np.abs(DU - 0.14) < 0.006) & (np.abs(V - (0.76 - k * 0.07)) < 0.03), ink)
        put(img, (np.abs(DU) < 0.004), "#000000", 0.3)
        put(img, V > 0.84, coat)
    elif kind == "foreignTourist":
        img = fill(["#e8d24a", "#4aa8d8"][n])
        if n == 1:
            dots(img, "#f4f0e0", 0.09, 0.2, 0.02, petals=5)
        else:
            put(img, np.hypot(DU * 1.0, (V - 0.66) * 0.42) < 0.05, "#e85a4a")
            put(img, np.hypot(DU * 1.0, (V - 0.66) * 0.42) < 0.03, "#f6f2ea")
        put(img, V < WAIST, "#a8946a")
    elif kind == "civilServant":
        img = fill(["#4a4e56", "#3a4250"][n])
        put(img, vee(0.24, 0.07), "#f4f2ee")
        tie(img, ["#2a2e3a", "#5a2a2a"][n])
        lapels(img, "#30343a")
        put(img, (np.abs(DU + 0.12) < 0.025) & (np.abs(V - 0.7) < 0.03), "#f6f4ee")
        put(img, (np.abs(DU + 0.12) < 0.02) & (np.abs(V - 0.715) < 0.006), "#3a5a9a")
    elif kind == "maidCoser":
        img = fill("#1c1c24")
        apron = ((np.abs(DU) < 0.16) & (V < WAIST + 0.02)) | ((np.abs(DU) < 0.075) & (V >= WAIST) & (V < 0.72))
        put(img, apron, "#f8f6f2")
        put(img, apron & (V < 0.05), "#e8e2d8")
        put(img, (np.abs(np.abs(DU) - 0.06) < 0.01) & (V > 0.72) & (V < NECK), "#f8f6f2")
        put(img, (V > 0.8) & (np.abs(DU) < 0.12), "#f8f6f2")
        put(img, (np.abs(DU) < 0.02) & (np.abs(V - 0.79) < 0.02), "#c8302a")
    elif kind == "gyaru":
        img = fill(["#f06aa0", "#f2f0ea"][n])
        put(img, (V > 0.44) & (V < 0.52), "#d8a07a")
        put(img, V < 0.46, ["#3a5a8a", "#1c1c22"][n])
        put(img, (V > 0.44) & (V < 0.465), "#e8c050")
        put(img, vee(0.16, 0.06), "#d8a07a")
    else:
        img = fill("#888888")
    weave(img)
    return img


KINDS = ["salaryman", "officeLady", "schoolgirl", "schoolboy", "grandma", "grandpa", "kid", "uncle", "collegeStudent", "yukataLady", "delinquent",
         "bosozoku", "foreignTourist", "civilServant", "maidCoser", "gyaru"]
for kind in KINDS:
    for n in (0, 1):
        write_png(os.path.join(TEX_DIR, f"outfit_{kind}_{n}.png"), outfit(kind, n))

# ---- faces: eight expressions side by side, each a cell 256 across, painted in degrees round the head (so a circle is a circle)
FC = 256
fu = np.tile((np.arange(FC) + 0.5) / FC, (FC, 1))
fv = np.tile(((np.arange(FC) + 0.5) / FC)[:, None], (1, FC))
AZ = FACE_AZ[0] + (FACE_AZ[1] - FACE_AZ[0]) * fu
EL = FACE_EL[0] + (FACE_EL[1] - FACE_EL[0]) * fv
EYE_AZ, EYE_EL = 19.5, 3.2
BROW_EL, MOUTH_EL = 17.6, -19.6
EXPR = ["neutral", "blink", "joy", "mad", "sad", "chew", "talk", "surprised"]


def arc_mask(cx, cy, half, bend, thick, slope=0.0):
    """a stroke across from cx-half to cx+half, bowed by `bend` (up at its middle when positive), tipped by `slope`, `thick` across (degrees)"""
    t = (AZ - cx) / half
    y = cy + bend * (1 - t * t) + slope * t
    d = np.abs(EL - y)
    w = thick * (1 - 0.35 * t * t)
    return np.clip((w - d) / 0.35 + 0.5, 0, 1) * (np.abs(t) <= 1.0)


def oval(cx, cy, rx, ry):
    return np.clip((1 - np.hypot((AZ - cx) / rx, (EL - cy) / ry)) * min(rx, ry) / 0.35 + 0.5, 0, 1)


def paint_face(ftype, expr):
    col = np.zeros((FC, FC, 3), np.float32)
    al = np.zeros((FC, FC), np.float32)

    def lay(mask, c, a=1.0):
        # (laid over what's there, its colour kept as it is where it's faint: not darkened toward the empty black under it)
        m = np.clip(mask * a, 0, 1)
        out_a = m + al * (1 - m)
        col[:] = np.where(out_a[..., None] > 1e-4, (rgb(c) * m[..., None] + col * (al * (1 - m))[..., None]) / np.maximum(out_a, 1e-4)[..., None], col)
        al[:] = out_a
    big = {"kid": 1.15, "female": 1.06, "male": 1.0, "elder": 0.88}[ftype]
    ex_r, ey_r = 3.8 * big, 5.3 * big
    brow_c = "#8a8580" if ftype == "elder" else "#3a2418"
    eye_c = "#1c1410"
    lip = "#b8483e" if ftype == "female" else "#6a2a20"
    # (a soft blush)
    for sd in (-1, 1):
        lay(oval(sd * 30, -11.8, 6.4, 3.6), "#f08a7a", 0.45)
    for sd in (-1, 1):
        cx = sd * EYE_AZ
        if expr == "blink":
            lay(arc_mask(cx, EYE_EL - 1.0, 3.6 * big, -1.4, 0.75), eye_c)
        elif expr == "joy":
            lay(arc_mask(cx, EYE_EL - 1.5, 3.8 * big, 3.0, 0.8), eye_c)
        else:
            sx, sy = (1.2, 1.25) if expr == "surprised" else (1.0, 1.0)
            o = oval(cx, EYE_EL, ex_r * sx, ey_r * sy)
            if expr == "mad":
                o = o * (EL < EYE_EL + 2.4 - 2.0 * sd * (AZ - cx) / ex_r)
            lay(o, eye_c)
            lay(oval(cx + 1.1 * big, EYE_EL + 2.0 * big, 1.4 * big, 1.5 * big), "#ffffff")
            lay(oval(cx - 1.0 * big, EYE_EL - 2.2 * big, 0.7 * big, 0.75 * big), "#ffffff")
            if ftype == "female":
                lay(arc_mask(cx + sd * 3.6, EYE_EL + 4.6, 1.4, 0.0, 0.5, 0.8), eye_c)
        if ftype == "elder" and expr != "joy":
            lay(arc_mask(cx + sd * 6.0, EYE_EL - 3.2, 1.2, 0.4, 0.3), "#b07a5a", 0.6)
        # (brows)
        slope = {"mad": -2.2, "sad": 2.0}.get(expr, 0.0) * sd * -1
        lift = 2.0 if expr in ("joy", "surprised") else 0.0
        lay(arc_mask(cx, BROW_EL + lift, 4.4, 1.0, 0.75 if ftype != "male" else 0.95, slope), brow_c)
    # (the mouth)
    if expr in ("neutral", "blink"):
        lay(arc_mask(0, MOUTH_EL + 0.6, 3.4, -1.1, 0.55), lip)
    elif expr == "joy":
        m = (EL < MOUTH_EL + 1.6) & (EL > MOUTH_EL + 1.6 - 4.5 * np.sqrt(np.clip(1 - (AZ / 4.6) ** 2, 0, 1)))
        lay(m.astype(np.float32), "#6a2018")
        lay(oval(0, MOUTH_EL - 1.4, 2.4, 1.0) * m, "#e8786a")
    elif expr == "mad":
        lay(arc_mask(0, MOUTH_EL, 3.0, 0.8, 0.55, 0.0), lip)
    elif expr == "sad":
        lay(arc_mask(0, MOUTH_EL - 0.6, 3.0, 1.4, 0.55), lip)
    elif expr == "chew":
        lay(oval(0, MOUTH_EL, 2.6, 1.9), "#6a2018")
        lay(oval(0, MOUTH_EL - 0.9, 1.5, 0.7), "#e8786a")
    elif expr == "talk":
        lay(oval(0, MOUTH_EL, 3.0, 2.3), "#6a2018")
        lay(oval(0, MOUTH_EL - 1.2, 1.9, 0.9), "#e8786a")
    elif expr == "surprised":
        lay(oval(0, MOUTH_EL - 0.5, 2.2, 2.8), "#6a2018")
    return np.concatenate([col, al[..., None]], -1)


for ftype in ("male", "female", "elder", "kid"):
    strip = np.concatenate([paint_face(ftype, e) for e in EXPR], axis=1)
    write_png(os.path.join(TEX_DIR, f"face_{ftype}.png"), strip)

# ===================================================================== preview, export
if PREVIEW:
    show = set((os.environ.get("PREVIEW_SHOW") or "hair_crop").split(","))
    for o in parts:
        if o.name.startswith("Folk_"):
            o.hide_render = o.name[len("Folk_"):] not in show
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(*map(float, os.environ.get("PREVIEW_CAM", "0.7,1.1,1.9").split(",")))
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(P(*map(float, os.environ.get("PREVIEW_AT", "0,0.5,0").split(",")))) - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 42
    bpy.context.scene.camera = cam
    sun_ = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun_.data.energy = 4
    sun_.rotation_euler = (0.6, 0.3, 0.4)
    bpy.context.collection.objects.link(sun_)
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "folk.glb"), os.path.join(PROJECT, "blender", "folk.blend"), PREVIEW)
tris = 0
for o in parts:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
print("FOLK_DONE", len(parts), "parts", tris, "triangles")
for o in sorted(parts, key=lambda o: -len(o.data.loop_triangles))[:12]:
    print("  ", o.name, len(o.data.loop_triangles))
