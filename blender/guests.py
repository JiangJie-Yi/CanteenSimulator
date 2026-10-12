"""Generate the customers: ten kinds of chibi figures on one shared rig, with sitting, eating and walking actions.

Usage:
  blender -b --factory-startup --python blender/guests.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/guests.blend
  <project_dir>/public/models/guests.glb

Each kind (data/guests.ts GuestKind) is a set of meshes named "<kind>.<part>", all skinned to the one armature
"Rig", so the web app (scene/Person3D.tsx) clones the scene and keeps only the kind it needs. The body is one
continuous mesh (a skin-modifier skeleton, subdivided) with its clothes painted on by region, plus garments that
stand off it (skirts, the yukata, jacket hems, collars) and the head: a rounded face with its features fitted to
its surface, ears and a nose, and hair built up from a cap and tapered locks.

Materials the app recolours per customer: Skin, Hair, Top, Bottom, Shoes (others keep their colour). Top and
Bottom carry UVs in metres around each limb, for the cloth patterns (scene/patterns.ts).

Options any kind can show: "<kind>.glasses". Swapped in by the app: "<kind>.eyes" / "<kind>.eyesShut" (a blink)
and "<kind>.mouth" / "<kind>.mouthOpen" (chewing).

The figure faces -Y in Blender (+Z in the glTF), feet on the ground at its origin, about 0.97 tall; sitting, its
hips rest on a seat 0.34 up.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)

KINDS = ["salaryman", "officeLady", "highSchoolGirl", "highSchoolBoy", "grandma", "grandpa", "kid", "uncle",
         "student", "yukata"]

# =====================================================================
# Materials
# =====================================================================

MATS = {}


def mat(name, color, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = 0.8
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(m, attr, value)
            except (AttributeError, TypeError):
                pass
    m.diffuse_color = (*color, alpha)
    MATS[name] = m
    return m


def srgb(h):
    """'#rrggbb' to linear rgb"""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# the ones the app recolours (these colours are only the defaults)
mat("Skin", srgb("#f3d2b0"))
mat("Hair", srgb("#2b1d14"))
mat("Top", srgb("#2a3550"))
mat("Bottom", srgb("#2a2a30"))
mat("Shoes", srgb("#2a1e16"))
# and the fixed ones
mat("Eye", srgb("#2a1d16"))
mat("EyeWhite", srgb("#fbf8f2"))
mat("Lash", srgb("#1a120e"))
mat("Mouth", srgb("#9a3a2e"))
mat("MouthIn", srgb("#5a1a16"))
mat("Blush", srgb("#f08a7a"), alpha=0.5)
mat("Cheek", srgb("#e9a890"))
mat("Shirt", srgb("#f4f2ec"))
mat("Tie", srgb("#a8322a"))
mat("Lapel", srgb("#1b2232"))
mat("Navy", srgb("#23324a"))
mat("Ribbon", srgb("#c4302a"))
mat("Socks", srgb("#f4f1ea"))
mat("Gold", srgb("#d4b04a"))
mat("Button", srgb("#2a2420"))
mat("Belt", srgb("#2a1e16"))
mat("Buckle", srgb("#c8b070"))
mat("Lens", srgb("#2a2220"))
mat("CapYellow", srgb("#f2c62a"))
mat("Bag", srgb("#c4302a"))
mat("BagDark", srgb("#8a1e1a"))
mat("Obi", srgb("#e8c45a"))
mat("ObiCord", srgb("#c4302a"))
mat("Collar", srgb("#f4efe2"))
mat("Band", srgb("#f4f1ea"))
mat("BandRed", srgb("#c4302a"))
mat("Wood", srgb("#a87a4a"))
mat("Strap", srgb("#7a2a1e"))
mat("Pin", srgb("#e85a7a"))
mat("Cord", srgb("#e8e4da"))

# =====================================================================
# Skeleton (standing, arms a little out)
# =====================================================================

HC = Vector((0, 0, 0.835))        # the middle of the head
HEAD_R = 0.128

HREF = lambda p: HC                     # noqa: E731
BREF = lambda p: Vector((0, 0, p.z))     # noqa: E731

BONES = [
    # name, head, tail, parent
    ("hips", (0, 0, 0.46), (0, 0, 0.53), None),
    ("spine", (0, 0, 0.53), (0, 0, 0.615), "hips"),
    ("chest", (0, 0, 0.615), (0, 0, 0.69), "spine"),
    ("neck", (0, 0, 0.69), (0, 0, 0.735), "chest"),
    ("head", (0, 0, 0.735), (0, 0, 0.98), "neck"),
]
for s, sd in (("L", 1), ("R", -1)):
    BONES += [
        (f"clavicle.{s}", (sd * 0.015, 0, 0.664), (sd * 0.092, 0, 0.668), "chest"),
        (f"upperarm.{s}", (sd * 0.092, 0, 0.668), (sd * 0.152, 0, 0.552), f"clavicle.{s}"),
        (f"forearm.{s}", (sd * 0.152, 0, 0.552), (sd * 0.2, 0, 0.445), f"upperarm.{s}"),
        (f"hand.{s}", (sd * 0.2, 0, 0.445), (sd * 0.222, -0.006, 0.372), f"forearm.{s}"),
        (f"thigh.{s}", (sd * 0.057, 0, 0.445), (sd * 0.06, 0, 0.262), "hips"),
        (f"shin.{s}", (sd * 0.06, 0, 0.262), (sd * 0.06, 0.004, 0.075), f"thigh.{s}"),
        (f"foot.{s}", (sd * 0.06, 0.004, 0.075), (sd * 0.062, -0.07, 0.03), f"shin.{s}"),
    ]
BONE = {b[0]: (Vector(b[1]), Vector(b[2])) for b in BONES}


def seg(name, p):
    """distance from p to a bone, and how far along it (0..1)"""
    a, b = BONE[name]
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def nearest_bone(p):
    best = None
    for name in BONE:
        side = name[-1] if "." in name else ""
        # (a point on the left never belongs to the right arm or leg)
        if (side == "L" and p.x < -0.004) or (side == "R" and p.x > 0.004):
            continue
        d, t = seg(name, p)
        if best is None or d < best[0]:
            best = (d, name, t)
    return best[1], best[2], best[0]


def smoothstep(a, b, x):
    k = max(0.0, min(1.0, (x - a) / (b - a)))
    return k * k * (3 - 2 * k)


# =====================================================================
# Mesh helpers
# =====================================================================

COL = bpy.data.collections.new("Guests")
bpy.context.scene.collection.children.link(COL)


def new_obj(name, me):
    o = bpy.data.objects.new(name, me)
    COL.objects.link(o)
    return o


def fix_normals(bm, ref):
    """closed parts by their own shape; open patches (things laid on a surface) facing away from ref(p)"""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    seen = set()
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        island, stack = [], [f0]
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        if all(len(e.link_faces) == 2 for f in island for e in f.edges):
            continue
        vote = sum(f.normal.dot(f.calc_center_median() - ref(f.calc_center_median())) * f.calc_area() for f in island)
        if vote < 0:
            bmesh.ops.reverse_faces(bm, faces=island)


def from_bm(name, bm, mats, ref=None):
    bm.faces.index_update()
    bm.normal_update()
    if ref is not None:
        fix_normals(bm, ref)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    return new_obj(name, me)


def evaluated_copy(o, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o2 = new_obj(name, me)
    bpy.data.objects.remove(o)
    if old.users == 0:
        bpy.data.meshes.remove(old)
    o2.name = name
    return o2


def loft(bm, path, widths, thicks, normals, ring=8, cap_start=True, mi=0, tip=True):
    """A tapered, flattened tube along path: width across (perpendicular to the path and to normals), thickness
    along normals. Ends in a point if tip."""
    rings = []
    n = len(path)
    for i, p in enumerate(path):
        t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        nn = normals[i] - t * normals[i].dot(t)
        nn.normalize()
        s = t.cross(nn).normalized()
        w, h = widths[i], thicks[i]
        if tip and i == n - 1:
            rings.append([bm.verts.new(p)])
            continue
        rings.append([bm.verts.new(p + s * math.cos(a) * w + nn * math.sin(a) * h)
                      for a in (2 * math.pi * k / ring for k in range(ring))])
    faces = []
    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(ring):
            k1 = (k + 1) % ring
            if len(r1) == 1:
                f = bm.faces.new((r0[k], r0[k1], r1[0]))
            else:
                f = bm.faces.new((r0[k], r0[k1], r1[k1], r1[k]))
            f.material_index = mi
            faces.append(f)
    if cap_start:
        f = bm.faces.new(list(reversed(rings[0])))
        f.material_index = mi
    if not tip:
        f = bm.faces.new(rings[-1])
        f.material_index = mi
    return faces


def ellipsoid(bm, c, r, mi=0, seg=16, rings=10, rot=None):
    m = Matrix.Diagonal((*r, 1))
    if rot:
        m = rot.to_4x4() @ m
    ret = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=Matrix.Translation(c) @ m)
    for v in ret["verts"]:
        for f in v.link_faces:
            f.material_index = mi
    return ret["verts"]


def tube_ring(bm, c, axis, r, thick, mi=0, seg=24, rx=None):
    """a torus round axis at c (a hem, a cuff, a belt)"""
    axis = axis.normalized()
    q = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
    m = Matrix.Translation(c) @ q
    if rx:
        m = m @ Matrix.Diagonal((rx / r, 1, 1, 1))
    ret = bmesh.ops.create_circle(bm, cap_ends=False, radius=1, segments=seg)
    bm.verts.ensure_lookup_table()
    verts = []
    # build the torus by hand: a ring of small rings
    ring = 6
    for v in ret["verts"]:
        bm.verts.remove(v)
    grid = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        cen = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        out = Vector((math.cos(a), math.sin(a), 0))
        row = []
        for k in range(ring):
            b = 2 * math.pi * k / ring
            p = cen + out * math.cos(b) * thick[0] + Vector((0, 0, 1)) * math.sin(b) * thick[1]
            row.append(bm.verts.new(m @ p))
        grid.append(row)
        verts += row
    for i in range(seg):
        for k in range(ring):
            f = bm.faces.new((grid[i][k], grid[(i + 1) % seg][k], grid[(i + 1) % seg][(k + 1) % ring], grid[i][(k + 1) % ring]))
            f.material_index = mi
    return verts


# =====================================================================
# Kinds: their build and what they wear
# =====================================================================

STYLE = {
    # body:   shoulders, waist, hips, belly (forward), chest (forward)
    # clothes: sleeves 'long' | 'short' | 'elbow'; legs 'long' | 'shorts' | 'skirt' | 'robe'; socks: how far up the shin
    "salaryman": dict(sh=1.0, waist=1.0, hip=1.0, belly=0.0, chest=0.0, sleeves="long", legs="long", hair="side",
                      jacket=True, collar="shirt"),
    "officeLady": dict(sh=0.9, waist=0.88, hip=1.0, belly=0.0, chest=0.01, sleeves="long", legs="skirt", hair="bob",
                       skirt=(0.265, 0.008, 0.0), jacket=True, collar="blouse", heels=True),
    "highSchoolGirl": dict(sh=0.88, waist=0.86, hip=0.98, belly=0.0, chest=0.008, sleeves="long", legs="skirt",
                           hair="long", skirt=(0.3, 0.035, 1.0), socks=0.55, collar="sailor"),
    "highSchoolBoy": dict(sh=1.0, waist=0.98, hip=0.96, belly=0.0, chest=0.0, sleeves="long", legs="long",
                          hair="spiky", collar="gakuran", jacket=True),
    "grandma": dict(sh=0.92, waist=1.04, hip=1.06, belly=0.01, chest=0.01, sleeves="long", legs="skirt",
                    hair="bun", skirt=(0.14, 0.02, 0.0), collar="round", socks=0.15),
    "grandpa": dict(sh=0.96, waist=1.04, hip=1.0, belly=0.008, chest=0.0, sleeves="long", legs="long", hair="bald",
                    collar="shirt", vest=True),
    "kid": dict(sh=0.92, waist=1.02, hip=1.0, belly=0.012, chest=0.0, sleeves="short", legs="shorts", hair="cap",
                collar="tee", socks=0.3, head=1.1),
    "uncle": dict(sh=1.06, waist=1.22, hip=1.12, belly=0.045, chest=0.0, sleeves="short", legs="long", hair="crop",
                  collar="aloha"),
    "student": dict(sh=1.0, waist=1.0, hip=0.98, belly=0.0, chest=0.0, sleeves="long", legs="long", hair="messy",
                    collar="hood"),
    "yukata": dict(sh=0.88, waist=0.9, hip=0.98, belly=0.0, chest=0.006, sleeves="elbow", legs="robe", hair="updo",
                   collar="yukata", socks=0.12),
}


# =====================================================================
# Body: a skin-modifier skeleton, subdivided into one smooth mesh
# =====================================================================

def body(kind):
    st = STYLE[kind]
    sh, wa, hi = st["sh"], st["waist"], st["hip"]
    verts, radii, edges = [], [], []

    def v(p, r):
        verts.append(Vector(p))
        radii.append(r)
        return len(verts) - 1

    pelvis = v((0, 0, 0.44), 0.078 * hi)
    waist = v((0, 0, 0.51), 0.07 * wa)
    chest = v((0, 0, 0.6), 0.077 * (sh * 0.5 + wa * 0.5))
    top = v((0, 0, 0.655), 0.07 * sh)
    neck0 = v((0, 0, 0.69), 0.033)
    neck1 = v((0, 0, 0.765), 0.03)
    edges += [(pelvis, waist), (waist, chest), (chest, top), (top, neck0), (neck0, neck1)]
    for sd in (1, -1):
        shoulder = v((sd * 0.088 * sh, 0, 0.66), 0.038)
        elbow = v((sd * 0.152, 0, 0.552), 0.028)
        wrist = v((sd * 0.198, 0, 0.448), 0.022)
        palm = v((sd * 0.208, -0.002, 0.415), 0.03)
        knuckle = v((sd * 0.216, -0.004, 0.388), 0.027)
        tip = v((sd * 0.222, -0.006, 0.368), 0.018)
        thumb0 = v((sd * 0.2, -0.018, 0.425), 0.012)
        thumb1 = v((sd * 0.207, -0.032, 0.403), 0.01)
        edges += [(top, shoulder), (shoulder, elbow), (elbow, wrist), (wrist, palm), (palm, knuckle), (knuckle, tip),
                  (palm, thumb0), (thumb0, thumb1)]
        hip = v((sd * 0.052 * hi, 0, 0.425), 0.054 * hi)
        knee = v((sd * 0.06, 0, 0.262), 0.04)
        ankle = v((sd * 0.06, 0.004, 0.085), 0.03)
        heel = v((sd * 0.06, 0.016, 0.032), 0.032)
        toe = v((sd * 0.062, -0.06, 0.03), 0.032)
        edges += [(pelvis, hip), (hip, knee), (knee, ankle), (ankle, heel), (ankle, toe)]
    me = bpy.data.meshes.new(f"{kind}.body")
    me.from_pydata([tuple(p) for p in verts], edges, [])
    o = new_obj(f"{kind}.body", me)
    sk = o.modifiers.new("Skin", "SKIN")
    sk.branch_smoothing = 0.6
    sk.use_smooth_shade = True
    for i, r in enumerate(radii):
        me.skin_vertices[0].data[i].radius = (r, r)
    me.skin_vertices[0].data[pelvis].use_root = True
    sub = o.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    o = evaluated_copy(o, f"{kind}.body")

    # shape it: a torso flatter front to back, a bit of chest, a belly, a seat; flat hands; shoes longer and lower
    for vt in o.data.vertices:
        p = vt.co
        name, t, _ = nearest_bone(p)
        if abs(p.x) < 0.11 and 0.36 < p.z < 0.72 and not name.startswith(("upperarm", "forearm", "hand", "clavicle")):
            k = smoothstep(0.36, 0.43, p.z) * (1 - smoothstep(0.66, 0.72, p.z))
            p.y *= 1 - 0.24 * k
            if p.y < 0:
                p.y -= st["belly"] * math.exp(-((p.z - 0.53) / 0.06) ** 2) * (1 - (p.x / 0.11) ** 2)
                p.y -= st["chest"] * math.exp(-((p.z - 0.615) / 0.03) ** 2) * math.exp(-((abs(p.x) - 0.035) / 0.025) ** 2)
            else:
                p.y += 0.012 * math.exp(-((p.z - 0.44) / 0.035) ** 2)
        if name.startswith("hand"):
            a, b = BONE[name]
            ax = (b - a).normalized()
            n = ax.cross(Vector((0, 1, 0))).normalized()
            off = p - a
            d = off.dot(n)
            p -= n * d * 0.42
        if name.startswith("foot") or (name.startswith("shin") and t > 0.9):
            if p.z < 0.012:
                p.z = 0.012 + (p.z - 0.012) * 0.3
    o.data.update()
    paint_body(o, kind)
    return o


def body_mat(name, t, p, st, kind):
    """which material a point of the body is (by the bone it's nearest and how far along)"""
    if name == "head" or name == "neck":
        if st["collar"] == "gakuran" and p.z < 0.74:
            return "Top"
        if st["collar"] == "hood" and p.z < 0.705:
            return "Top"
        return "Skin"
    if name.startswith("hand"):
        return "Skin"
    if name.startswith("forearm"):
        if st["sleeves"] == "short":
            return "Skin"
        if st["sleeves"] == "elbow":
            return "Top" if t < 0.45 else "Skin"
        return "Top" if t < 0.84 else "Skin"
    if name.startswith("upperarm"):
        if st["sleeves"] == "short":
            return "Top" if t < 0.55 else "Skin"
        return "Shirt" if st.get("vest") else "Top"
    if name.startswith("clavicle"):
        return "Shirt" if st.get("vest") and abs(p.x) > 0.07 else "Top"
    if name.startswith("foot"):
        return "Shoes"
    if name.startswith(("thigh", "shin")):
        legs = st["legs"]
        if name.startswith("shin") and t > 0.93:
            return "Shoes"
        socks = st.get("socks")
        if socks and name.startswith("shin") and t > 1 - socks:
            return "Socks"
        if legs == "long":
            return "Bottom"
        if legs == "shorts":
            return "Bottom" if name.startswith("thigh") and t < 0.72 else "Skin"
        return "Skin"
    # the torso: the top down to the waist, then the trousers (or the robe, or the skirt)
    if st["legs"] in ("skirt", "robe"):
        return "Top" if p.z > 0.47 or st["legs"] == "robe" else "Bottom"
    if st.get("jacket") and p.z > 0.43:
        return "Top"
    return "Top" if p.z > 0.47 else "Bottom"


def cyl_uv_layer(o, rules):
    """UVs in metres round and along each part's bone (for the cloth patterns)"""
    me = o.data
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        us = []
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            name, t, d = rules(p)
            a, b = BONE[name]
            ax = (b - a).normalized()
            ref = Vector((0, -1, 0)) if abs(ax.y) < 0.9 else Vector((0, 0, 1))
            e1 = (ref - ax * ref.dot(ax)).normalized()
            e2 = ax.cross(e1)
            off = p - a
            ang = math.atan2(off.dot(e2), off.dot(e1))
            r = 0.07 if name in ("hips", "spine", "chest", "neck") else 0.035
            along = off.dot(ax)
            us.append([ang * r, -along if name not in ("hips", "spine", "chest", "neck") else p.z])
        # (a face across the seam at the back: bring its corners round to the same side)
        r = 0.07 * math.pi
        if max(u for u, _ in us) - min(u for u, _ in us) > r:
            for c in us:
                if c[0] < 0:
                    c[0] += 2 * r
        for li, c in zip(poly.loop_indices, us):
            uv.data[li].uv = (c[0] * 6, c[1] * 6)


def paint_body(o, kind):
    st = STYLE[kind]
    me = o.data
    order = ["Skin", "Top", "Bottom", "Shoes", "Socks", "Shirt"]
    for n in order:
        me.materials.append(MATS[n])
    for poly in me.polygons:
        c = poly.center
        name, t, _ = nearest_bone(c)
        poly.material_index = order.index(body_mat(name, t, c, st, kind))
    cyl_uv_layer(o, lambda p: nearest_bone(p))


# =====================================================================
# Head and face
# =====================================================================

def ang_dir(yaw, pitch):
    """a direction from the middle of the head: yaw round from the front (+ to their left), pitch up"""
    return Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))


def head(kind):
    st = STYLE[kind]
    k = st.get("head", 1.0)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=HEAD_R * k)
    for vt in bm.verts:
        p = vt.co
        # a chibi face: round, a little wider than tall at the cheeks, the jaw tucked in, the back of the head full
        z = p.z / (HEAD_R * k)
        p.x *= 1.04 - 0.08 * smoothstep(-0.2, -1.0, z)
        p.y *= 0.96
        if p.y < 0:
            p.y *= 1 - 0.1 * smoothstep(-0.1, -0.9, z)
            # soft cheeks
            p.y -= 0.006 * k * math.exp(-((z + 0.35) / 0.25) ** 2) * math.exp(-((abs(p.x) / (HEAD_R * k) - 0.55) / 0.3) ** 2)
        else:
            p.y *= 1.04
        p.z *= 0.97
        if z < -0.6:
            p.z -= 0.01 * k * smoothstep(-0.6, -1.0, z) * (1 if p.y < 0 else 0.3)
        vt.co = p + HC + Vector((0, 0, (k - 1) * HEAD_R * 0.6))
    for f in bm.faces:
        f.smooth = True
    o = from_bm(f"{kind}.head", bm, [MATS["Skin"]], HREF)
    return o


class Surface:
    """the outside of a mesh, to lay things on it"""

    def __init__(self, o, centre):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()
        self.c = centre

    def at(self, d, off=0.0):
        d = d.normalized()
        hit = self.bvh.ray_cast(self.c + d * 0.6, -d)
        if hit[0] is None:
            return self.c + d * HEAD_R, d
        return hit[0] + hit[1] * off, hit[1]

    def ang(self, yaw, pitch, off=0.0):
        return self.at(ang_dir(yaw, pitch), off)


def decal_ellipse(bm, surf, yaw, pitch, ry, rp, mi, off=0.0016, rot=0.0, rings=4, segs=20, squash=None):
    """a filled ellipse lying on the surface, given in angles"""
    centre = bm.verts.new(surf.ang(yaw, pitch, off)[0])
    prev = None
    rows = []
    for i in range(1, rings + 1):
        rr = i / rings
        row = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            x, y = math.cos(a) * ry * rr, math.sin(a) * rp * rr
            if squash:
                x, y = squash(x, y)
            xr = x * math.cos(rot) - y * math.sin(rot)
            yr = x * math.sin(rot) + y * math.cos(rot)
            row.append(bm.verts.new(surf.ang(yaw + xr, pitch + yr, off)[0]))
        rows.append(row)
    for j in range(segs):
        f = bm.faces.new((centre, rows[0][j], rows[0][(j + 1) % segs]))
        f.material_index = mi
    for i in range(rings - 1):
        for j in range(segs):
            j1 = (j + 1) % segs
            f = bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j1], rows[i][j1]))
            f.material_index = mi
    return rows


def decal_strip(bm, surf, pts, widths, mi, off=0.0018):
    """a band along a curve on the surface (angles), its width in angle too; pointed ends where width is 0"""
    left, right = [], []
    n = len(pts)
    for i, (y, p) in enumerate(pts):
        y1, p1 = pts[min(i + 1, n - 1)]
        y0, p0 = pts[max(i - 1, 0)]
        ty, tp = y1 - y0, p1 - p0
        L = math.hypot(ty, tp) or 1
        ny, np_ = -tp / L, ty / L
        w = widths[i]
        left.append(bm.verts.new(surf.ang(y + ny * w, p + np_ * w, off)[0]))
        right.append(bm.verts.new(surf.ang(y - ny * w, p - np_ * w, off)[0]))
    for i in range(n - 1):
        quad = [left[i], right[i], right[i + 1], left[i + 1]]
        uniq = []
        for q in quad:
            if all((q.co - u.co).length > 1e-6 for u in uniq):
                uniq.append(q)
        if len(uniq) >= 3:
            f = bm.faces.new(uniq)
            f.material_index = mi
    return left + right


def face(kind, hd):
    """eyes (open and shut), brows, mouth (shut and open), blush, nose, ears"""
    st = STYLE[kind]
    k = st.get("head", 1.0)
    surf = Surface(hd, HC + Vector((0, 0, (k - 1) * HEAD_R * 0.6)))
    girl = kind in ("officeLady", "highSchoolGirl", "yukata", "grandma")
    old = kind in ("grandma", "grandpa")
    ex, ez = 0.36, -0.06          # eye yaw and pitch
    names = ["Eye", "EyeWhite", "Lash", "Hair", "Mouth", "MouthIn", "Blush", "Skin"]
    mi = {n: i for i, n in enumerate(names)}
    mats = [MATS[n] for n in names]

    # open eyes: a tall dark oval, a lighter lower half, two catchlights; a lash line over a girl's
    bm = bmesh.new()
    for sd in (1, -1):
        y = sd * ex
        if old:
            # (the old folk smile with their eyes: closed arcs)
            arc = [(y + sd * a * 0.11, ez + 0.012 - 0.05 * (a * a) + 0.03) for a in (-1, -0.6, -0.2, 0.2, 0.6, 1)]
            decal_strip(bm, surf, arc, [0.0, 0.013, 0.016, 0.016, 0.013, 0.0], mi["Eye"])
            continue
        rw, rh = (0.085, 0.13) if girl or kind == "kid" else (0.075, 0.115)
        decal_ellipse(bm, surf, y, ez, rw, rh, mi["Eye"])
        decal_ellipse(bm, surf, y + sd * 0.012, ez + 0.045, rw * 0.36, rh * 0.28, mi["EyeWhite"], off=0.0026)
        decal_ellipse(bm, surf, y - sd * 0.025, ez - 0.05, rw * 0.18, rh * 0.13, mi["EyeWhite"], off=0.0026)
        if girl:
            lash = [(y + sd * a * rw * 1.25, ez + rh * (0.95 - 0.25 * a * a) + 0.01) for a in (-1, -0.5, 0, 0.5, 1, 1.25)]
            decal_strip(bm, surf, lash, [0.0, 0.014, 0.016, 0.016, 0.012, 0.0], mi["Lash"], off=0.0024)
    eyes = from_bm(f"{kind}.eyes", bm, mats, HREF)

    bm = bmesh.new()
    for sd in (1, -1):
        y = sd * ex
        arc = [(y + sd * a * 0.09, ez - 0.02 + 0.035 * (1 - a * a)) for a in (-1, -0.5, 0, 0.5, 1)]
        if old:
            arc = [(y + sd * a * 0.11, ez + 0.042 - 0.05 * (a * a)) for a in (-1, -0.6, -0.2, 0.2, 0.6, 1)]
        decal_strip(bm, surf, arc, [0.0] + [0.012] * (len(arc) - 2) + [0.0], mi["Eye"])
    shut = from_bm(f"{kind}.eyesShut", bm, mats, HREF)

    # brows, mouth, blush (on the face mesh with the eyes: they never change)
    bm = bmesh.new()
    for sd in (1, -1):
        y = sd * ex
        lift = 0.2 if not old else 0.17
        brow = [(y + sd * a * 0.085, ez + lift + 0.02 * (1 - a * a) - sd * 0.0) for a in (-1, -0.4, 0.3, 1)]
        decal_strip(bm, surf, brow, [0.0, 0.012 if girl else 0.016, 0.012 if girl else 0.016, 0.0],
                    mi["Hair"] if kind not in ("grandpa",) else mi["Hair"], off=0.0024)
        if kind in ("kid", "highSchoolGirl", "yukata", "grandma", "officeLady"):
            decal_ellipse(bm, surf, sd * 0.56, -0.3, 0.12, 0.06, mi["Blush"], off=0.0012)
    if kind == "uncle":
        # a moustache: two tapered locks either side
        for sd in (1, -1):
            pts = [(sd * 0.01, -0.36), (sd * 0.12, -0.38), (sd * 0.22, -0.44)]
            decal_strip(bm, surf, pts, [0.03, 0.026, 0.0], mi["Hair"], off=0.003)
    if kind == "grandpa":
        for sd in (1, -1):
            # bushy white brows
            brow = [(sd * (ex + a * 0.1), ez + 0.19 + 0.025 * (1 - a * a)) for a in (-1, -0.4, 0.3, 1)]
            decal_strip(bm, surf, brow, [0.0, 0.022, 0.022, 0.0], mi["Hair"], off=0.003)
    feat = from_bm(f"{kind}.face", bm, mats, HREF)

    # the mouth: a small smile; open, a little D of a mouth (chewing)
    bm = bmesh.new()
    smile = [(a * 0.1, -0.4 - 0.035 * (1 - a * a)) for a in (-1, -0.5, 0, 0.5, 1)]
    decal_strip(bm, surf, smile, [0.0, 0.01, 0.012, 0.01, 0.0], mi["Mouth"])
    mouth = from_bm(f"{kind}.mouth", bm, mats, HREF)
    bm = bmesh.new()
    decal_ellipse(bm, surf, 0, -0.43, 0.07, 0.055, mi["MouthIn"], squash=lambda x, y: (x, y if y < 0 else y * 0.25))
    mouth_open = from_bm(f"{kind}.mouthOpen", bm, mats, HREF)

    # nose and ears, on the head mesh itself
    bm = bmesh.new()
    bm.from_mesh(hd.data)
    np_, nn = surf.ang(0, -0.24, -0.004)
    ellipsoid(bm, np_, (0.011 * k, 0.009 * k, 0.009 * k), mi=0)
    for sd in (1, -1):
        ep, en = surf.ang(sd * 1.5, -0.14, -0.012)
        rot = Vector((0, 0, 1)).rotation_difference(Vector((sd, 0.25, 0))).to_matrix()
        ellipsoid(bm, ep, (0.03 * k, 0.022 * k, 0.012 * k), mi=0, rot=rot @ Matrix.Rotation(math.pi / 2, 3, "Z"))
    bm.to_mesh(hd.data)
    bm.free()
    for p in hd.data.polygons:
        p.use_smooth = True
    return surf, [eyes, shut, feat, mouth, mouth_open]


# =====================================================================
# Hair
# =====================================================================

def scalp_path(surf, pts, off):
    """points over the head (yaw, pitch) at a height off its surface"""
    return [surf.ang(y, p, o)[0] for (y, p), o in zip(pts, off)]


def lock(bm, surf, pts, width, thick, off, mi=0, ring=8):
    """a lock of hair: from its root (buried in the cap) along the scalp, tapering to a point"""
    path = scalp_path(surf, pts, off)
    n = len(path)
    normals = [(p - surf.c).normalized() for p in path]
    widths = [width * (1 - (i / (n - 1)) ** 1.6) + 0.0015 for i in range(n)]
    thicks = [thick * (1 - (i / (n - 1)) ** 1.3) + 0.001 for i in range(n)]
    loft(bm, path, widths, thicks, normals, ring=ring, mi=mi)


def hang(bm, surf, start, down, width, thick, off, mi=0, curl=0.0, n=7, splay=0.0):
    """a lock hanging from a point on the head straight down (past the head's edge), for long hair"""
    y, p = start
    root = surf.ang(y, p, off)[0]
    d = ang_dir(y, 0)
    path = [root]
    for i in range(1, n):
        t = i / (n - 1)
        q = root + Vector((0, 0, -down * t)) + d * (0.01 * t + splay * t * t) + Vector((-d.y, d.x, 0)) * curl * t * t
        # keep clear of the head
        c = surf.c
        r = (q - c)
        if r.length < HEAD_R + off + 0.004 and q.z > c.z - HEAD_R:
            q = c + r.normalized() * (HEAD_R + off + 0.004)
        path.append(q)
    normals = [((p_ - surf.c) * Vector((1, 1, 0))).normalized() if (p_ - surf.c).xy.length > 1e-4 else d for p_ in path]
    widths = [width * (1 - 0.65 * (i / (n - 1)) ** 2) for i in range(n)]
    widths[-1] = 0.002
    thicks = [thick * (1 - 0.5 * i / (n - 1)) for i in range(n)]
    loft(bm, path, widths, thicks, normals, ring=8, mi=mi)


def cap(hd, surf, keep, off=0.006, thick=0.008):
    """a shell of hair over the head where keep(yaw, pitch)"""
    bm = bmesh.new()
    bm.from_mesh(hd.data)
    drop = []
    for vt in bm.verts:
        r = vt.co - surf.c
        yaw = math.atan2(r.x, -r.y)
        pitch = math.asin(max(-1, min(1, r.z / r.length)))
        if not keep(yaw, pitch):
            drop.append(vt)
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    for vt in bm.verts:
        vt.co = vt.co + (vt.co - surf.c).normalized() * off
    bm.normal_update()
    ret = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=-thick)
    del ret
    for f in bm.faces:
        f.material_index = 0
        f.smooth = True
    return bm


def hair(kind, hd, surf):
    st = STYLE[kind]
    style = st["hair"]
    mats = [MATS["Hair"]]
    if style == "bald":
        # a horseshoe of hair round the back and over the ears
        bm = cap(hd, surf, lambda y, p: abs(y) > 1.3 and -0.4 < p < 0.22, off=0.004, thick=0.012)
        # (soft tufts over it, swept back)
        for sd in (1, -1):
            for i in range(6):
                y0 = sd * (1.35 + i * 0.3)
                for p0 in (0.15, -0.12):
                    lock(bm, surf, [(y0, p0), (y0 + sd * 0.12, p0 - 0.12), (y0 + sd * 0.2, p0 - 0.3)],
                         0.035, 0.009, [0.006, 0.01, 0.006], ring=6)
        return from_bm(f"{kind}.hair", bm, mats, HREF)

    if style == "crop":
        # a close crop with a receding front, and a twisted headband (hachimaki) on top
        bm = cap(hd, surf, lambda y, p: (p > 0.55 - 0.15 * min(1, abs(y))) if abs(y) < 1.3 else p > -0.35, off=0.004, thick=0.007)
        o = from_bm(f"{kind}.hair", bm, mats, HREF)
        bm = bmesh.new()
        tube_ring(bm, surf.c + Vector((0, 0.005, 0.045)), Vector((0, -0.18, 1)), HEAD_R * 1.03, (0.012, 0.016), mi=0, seg=32)
        for sd in (1, -1):
            lock(bm, surf, [(math.pi - sd * 0.12, 0.25), (math.pi - sd * 0.25, -0.05), (math.pi - sd * 0.32, -0.45)],
                 0.02, 0.005, [0.016, 0.02, 0.022])
        from_bm(f"{kind}.band", bm, [MATS["Band"]], HREF)
        return o

    bm = None
    if style == "side":
        # neat short hair, parted on one side and combed over
        bm = cap(hd, surf, lambda y, p: p > (0.32 if abs(y) < 0.9 else -0.1 - 0.25 * smoothstep(1.2, 2.6, abs(y))))
        for i in range(7):
            y0 = -0.75 + i * 0.25
            lock(bm, surf, [(0.25, 1.1), (y0 * 0.6 + 0.1, 0.75), (y0, 0.45), (y0 - 0.12, 0.3)], 0.05, 0.016,
                 [0.004, 0.016, 0.016, 0.01])
        for sd in (1, -1):
            for i in range(3):
                lock(bm, surf, [(sd * (0.9 + i * 0.3), 0.5), (sd * (1.0 + i * 0.3), 0.15), (sd * (1.05 + i * 0.3), -0.12)],
                     0.04, 0.012, [0.004, 0.012, 0.01])
    elif style == "spiky":
        bm = cap(hd, surf, lambda y, p: p > (0.38 if abs(y) < 0.9 else -0.2 - 0.2 * smoothstep(1.4, 2.6, abs(y))))
        for i in range(6):
            y0 = -0.62 + i * 0.25
            lock(bm, surf, [(y0 * 0.4, 1.05), (y0 * 0.8, 0.7), (y0 + 0.05 * (i % 2), 0.36), (y0 + 0.1, 0.2)], 0.05, 0.016,
                 [0.004, 0.02, 0.02, 0.012])
        for j in range(9):
            y0 = -2.2 + j * 0.55
            lock(bm, surf, [(y0, 1.0), (y0 * 1.08, 1.15), (y0 * 1.1, 1.3)], 0.05, 0.02, [0.0, 0.03, 0.065], ring=6)
    elif style == "messy":
        bm = cap(hd, surf, lambda y, p: p > (0.3 if abs(y) < 0.9 else -0.3 - 0.2 * smoothstep(1.4, 2.6, abs(y))), off=0.009)
        for i in range(8):
            y0 = -0.8 + i * 0.23
            lock(bm, surf, [(y0 * 0.3, 1.1), (y0 * 0.85, 0.7), (y0, 0.3), (y0 + 0.1 * (-1) ** i, 0.1)], 0.048, 0.016,
                 [0.006, 0.02, 0.02, 0.014])
        for sd in (1, -1):
            for i in range(4):
                lock(bm, surf, [(sd * (0.95 + i * 0.4), 0.6), (sd * (1.05 + i * 0.4), 0.1), (sd * (1.1 + i * 0.42), -0.35)],
                     0.05, 0.016, [0.006, 0.018, 0.016])
    elif style == "cap":
        # a little hair under a yellow school cap
        bm = cap(hd, surf, lambda y, p: p > (0.2 if abs(y) < 0.9 else -0.25 - 0.2 * smoothstep(1.4, 2.6, abs(y))))
        for i in range(5):
            y0 = -0.5 + i * 0.25
            lock(bm, surf, [(y0, 0.42), (y0 + 0.04, 0.25), (y0 + 0.06, 0.12)], 0.05, 0.012, [0.012, 0.014, 0.01])
        cb = bmesh.new()
        cb2 = cap(hd, surf, lambda y, p: p > 0.32 - 0.06 * math.cos(y), off=0.02, thick=0.01)
        cbm = bpy.data.meshes.new("tmp")
        cb2.to_mesh(cbm)
        cb2.free()
        cb.from_mesh(cbm)
        bpy.data.meshes.remove(cbm)
        # the brim, and a button on top
        brim = []
        for i in range(13):
            a = -1.1 + i * 2.2 / 12
            brim.append(surf.ang(a, 0.34, 0.02)[0])
        rows = [[cb.verts.new(p) for p in brim],
                [cb.verts.new(p + (ang_dir(-1.1 + i * 2.2 / 12, 0) * 0.055 + Vector((0, 0, -0.012))) * (math.cos((-1.1 + i * 2.2 / 12) * 1.25) ** 0.6))
                 for i, p in enumerate(brim)]]
        top_ = [cb.verts.new(v.co + Vector((0, 0, 0.006))) for v in rows[0]] + [cb.verts.new(v.co + Vector((0, 0, 0.006))) for v in rows[1]]
        for i in range(12):
            cb.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
            cb.faces.new((top_[i], top_[13 + i], top_[13 + i + 1], top_[i + 1]))
        ellipsoid(cb, surf.c + Vector((0, 0, HEAD_R * 1.1 + 0.035)), (0.012, 0.012, 0.008))
        for f in cb.faces:
            f.smooth = True
        from_bm(f"{kind}.hat", cb, [MATS["CapYellow"]], HREF)
    elif style == "bob":
        # a chin-length bob with a side-swept fringe
        bm = cap(hd, surf, lambda y, p: p > (0.36 if abs(y) < 0.85 else -0.6), off=0.007, thick=0.01)
        for i in range(7):
            y0 = -0.7 + i * 0.24
            lock(bm, surf, [(0.3, 1.15), (y0 * 0.7 + 0.15, 0.75), (y0, 0.35), (y0 - 0.15, 0.18)], 0.055, 0.016,
                 [0.006, 0.02, 0.02, 0.012])
        for j in range(11):
            y0 = 0.85 + j * (2 * math.pi - 1.7) / 10
            hang(bm, surf, (y0, 0.25), 0.15 + 0.03 * abs(math.cos(y0)), 0.042, 0.016, 0.01, splay=-0.02)
    elif style == "long":
        # long straight hair with a blunt fringe, a lock either side of the face, falling past the shoulders
        bm = cap(hd, surf, lambda y, p: p > (0.42 if abs(y) < 0.85 else -0.6), off=0.007, thick=0.01)
        for i in range(9):
            y0 = -0.72 + i * 0.18
            lock(bm, surf, [(y0 * 0.6, 1.1), (y0 * 0.9, 0.75), (y0, 0.38), (y0, 0.2)], 0.05, 0.016,
                 [0.006, 0.02, 0.02, 0.016], ring=6)
        for j in range(13):
            y0 = 0.8 + j * (2 * math.pi - 1.6) / 12
            front = abs(abs(y0 - math.pi) - math.pi) < 1.2
            hang(bm, surf, (y0, 0.25), 0.3 if not front else 0.26, 0.042, 0.016, 0.012, splay=0.035, n=8)
    elif style == "bun":
        # pulled back into a bun, grey, a few soft waves
        bm = cap(hd, surf, lambda y, p: p > (0.5 if abs(y) < 0.8 else -0.45), off=0.006)
        for i in range(10):
            y0 = -1.4 + i * 0.31
            lock(bm, surf, [(y0, 0.5 if abs(y0) < 0.8 else 0.1), (y0 * 0.7 + math.pi * (1 if y0 > 0 else -1) * 0.3, 0.75),
                            (math.pi * (1 if y0 > 0 else -1) * 0.85, 0.7)], 0.05, 0.014, [0.008, 0.016, 0.01])
        ellipsoid(bm, surf.c + Vector((0, HEAD_R * 0.95, HEAD_R * 0.55)), (0.05, 0.045, 0.045), seg=16, rings=10)
    elif style == "updo":
        # put up with a bun on top, a hairpin with a flower, loose locks by the ears
        bm = cap(hd, surf, lambda y, p: p > (0.4 if abs(y) < 0.85 else -0.5), off=0.006)
        for i in range(7):
            y0 = -0.7 + i * 0.23
            lock(bm, surf, [(y0 * 0.2, 1.1), (y0 * 0.8, 0.7), (y0 * 1.05, 0.4), (y0 * 1.15, 0.28)], 0.05, 0.015,
                 [0.006, 0.018, 0.018, 0.012])
        for sd in (1, -1):
            hang(bm, surf, (sd * 1.0, 0.25), 0.13, 0.02, 0.01, 0.012, curl=sd * 0.02, n=6)
        ellipsoid(bm, surf.c + Vector((0, HEAD_R * 0.5, HEAD_R * 1.0)), (0.055, 0.05, 0.05), seg=16, rings=10)
        pb = bmesh.new()
        p0 = surf.c + Vector((0.035, HEAD_R * 0.45, HEAD_R * 1.05))
        loft(pb, [p0, p0 + Vector((0.07, 0.03, 0.03))], [0.004, 0.003], [0.004, 0.003], [Vector((0, 0, 1))] * 2, ring=6,
             tip=False, mi=1)
        for a in range(5):
            t = 2 * math.pi * a / 5
            ellipsoid(pb, p0 + Vector((math.cos(t) * 0.014, -0.01, math.sin(t) * 0.014)), (0.01, 0.006, 0.01), mi=0, seg=10, rings=6)
        ellipsoid(pb, p0 + Vector((0, -0.016, 0)), (0.007, 0.005, 0.007), mi=1, seg=8, rings=6)
        for f in pb.faces:
            f.smooth = True
        from_bm(f"{kind}.pin", pb, [MATS["Pin"], MATS["Gold"]], HREF)
    return from_bm(f"{kind}.hair", bm, mats, HREF)


# =====================================================================
# Clothes that stand off the body
# =====================================================================

def body_radius(bd, z, x0=None):
    """the torso's half width and half depth at height z"""
    xs, ys = [0.0], [0.0]
    for vt in bd.data.vertices:
        p = vt.co
        if abs(p.z - z) < 0.006 and (abs(p.x) < 0.11 if x0 is None else abs(p.x - x0) < 0.06):
            xs.append(abs(p.x if x0 is None else p.x - x0))
            ys.append(abs(p.y))
    return max(xs), max(ys)


def skirt(kind, bd, top, hem, flare, pleats, mi_name="Bottom"):
    """a skirt (or the yukata's robe): a flared tube from top to hem, pleated if asked"""
    bm = bmesh.new()
    rows = 8
    segs = 48
    rx0, ry0 = body_radius(bd, top)
    rows_v = []
    for i in range(rows + 1):
        t = i / rows
        z = top + (hem - top) * t
        rx, ry = body_radius(bd, max(z, 0.4))
        rx = max(rx, rx0 * 0.98) + 0.006 + flare * t ** 0.8 + (0.006 if kind == "officeLady" else 0)
        ry = max(ry, ry0 * 0.98) + 0.006 + flare * 0.9 * t ** 0.8
        row = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            r = 1.0
            if pleats:
                ph = (j % 4) / 4
                r += pleats * 0.06 * t * (abs(ph - 0.5) * 2 - 0.5)
            row.append(bm.verts.new((math.sin(a) * rx * r, -math.cos(a) * ry * r, z)))
        rows_v.append(row)
    for i in range(rows):
        for j in range(segs):
            j1 = (j + 1) % segs
            bm.faces.new((rows_v[i][j], rows_v[i][j1], rows_v[i + 1][j1], rows_v[i + 1][j]))
    bm.normal_update()
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    for f in bm.faces:
        f.smooth = True
    o = from_bm(f"{kind}.skirt", bm, [MATS[mi_name]], BREF)
    cyl_uv_layer(o, lambda p: ("hips", 0, 0))
    return o


def band(kind, bd, z, h, mi, name, extra=0.004, dz=0.0):
    """a band round the waist (a belt, the obi)"""
    rx, ry = body_radius(bd, z)
    bm = bmesh.new()
    segs = 40
    rings = []
    # (a stiff band: as wide as the body is anywhere under it)
    for k in range(9):
        r = body_radius(bd, z - h / 2 + h * k / 8)
        rx, ry = max(rx, r[0]), max(ry, r[1])
    for zz in (z - h / 2, z + h / 2):
        rings.append([bm.verts.new((math.sin(2 * math.pi * j / segs) * (rx + extra), -math.cos(2 * math.pi * j / segs) * (ry + extra), zz + dz))
                      for j in range(segs)])
    for j in range(segs):
        j1 = (j + 1) % segs
        bm.faces.new((rings[0][j], rings[0][j1], rings[1][j1], rings[1][j]))
    bm.normal_update()
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    for f in bm.faces:
        f.material_index = 0
        f.smooth = True
    return from_bm(f"{kind}.{name}", bm, [MATS[mi]], BREF)


def on_body(bd):
    bm = bmesh.new()
    bm.from_mesh(bd.data)
    bvh = BVHTree.FromBMesh(bm)
    bm.free()

    def at(p, d, off=0.002):
        """the body's surface seen from p looking along d"""
        hit = bvh.ray_cast(p, d)
        if hit[0] is None:
            hit = bvh.find_nearest(p + d * 0.3)
        return hit[0] + hit[1] * off, hit[1]
    return at


def front_decal(bm, at, outline, mi, off=0.0025, z_rows=None):
    """a flat shape (x, z pairs) pressed onto the front of the body"""
    vs = [bm.verts.new(at(Vector((x, -0.3, z)), Vector((0, 1, 0)), off)[0]) for x, z in outline]
    f = bm.faces.new(vs)
    f.material_index = mi
    return f


def back_decal(bm, at, outline, mi, off=0.0025):
    vs = [bm.verts.new(at(Vector((x, 0.3, z)), Vector((0, -1, 0)), off)[0]) for x, z in outline]
    f = bm.faces.new(list(reversed(vs)))
    f.material_index = mi
    return f


def subdivide_faces(bm, cuts=3):
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)


def press(bm, at, d, off):
    """push every vertex onto the body's surface along d"""
    for v in bm.verts:
        v.co = at(v.co - d * 0.3, d, off)[0]


def clothes(kind, bd, hd, surf):
    st = STYLE[kind]
    at = on_body(bd)
    out = []
    names = ["Shirt", "Tie", "Lapel", "Top", "Button", "Navy", "Ribbon", "Gold", "Collar", "Belt", "Buckle", "Bottom",
             "Obi", "ObiCord", "Bag", "BagDark", "Strap", "Cord"]
    mi = {n: i for i, n in enumerate(names)}
    mats = [MATS[n] for n in names]
    F = Vector((0, 1, 0))
    B = Vector((0, -1, 0))

    def fr(outline, m, off=0.0025, cuts=3):
        b = bmesh.new()
        vs = [b.verts.new((x, -0.3, z)) for x, z in outline]
        f = b.faces.new(vs)
        f.material_index = mi[m]
        subdivide_faces(b, cuts)
        press(b, at, F, off)
        return b

    def bk(outline, m, off=0.0025, cuts=3):
        b = bmesh.new()
        vs = [b.verts.new((x, 0.3, z)) for x, z in outline]
        f = b.faces.new(list(reversed(vs)))
        f.material_index = mi[m]
        subdivide_faces(b, cuts)
        press(b, at, B, off)
        return b

    parts = []
    c = st["collar"]
    if c in ("shirt", "blouse"):
        # the shirt's V under the jacket, its collar points; the tie
        if not st.get("vest"):
            parts.append(fr([(-0.03, 0.69), (0.0, 0.565 if c == "shirt" else 0.6), (0.03, 0.69)], "Shirt", 0.0022))
        for sd in (1, -1):
            parts.append(fr([(sd * 0.002, 0.672), (sd * 0.034, 0.692), (sd * 0.028, 0.655)], "Shirt", 0.004, cuts=2))
        if kind == "salaryman":
            parts.append(fr([(-0.006, 0.672), (0.006, 0.672), (0.012, 0.59), (0.0, 0.575), (-0.012, 0.59)], "Tie", 0.003))
            parts.append(fr([(-0.009, 0.684), (0.009, 0.684), (0.006, 0.669), (-0.006, 0.669)], "Tie", 0.0042, cuts=1))
        if st.get("jacket"):
            for sd in (1, -1):
                parts.append(fr([(sd * 0.03, 0.692), (sd * 0.058, 0.67), (sd * 0.04, 0.63), (sd * 0.004, 0.565 if c == "shirt" else 0.6)],
                                "Lapel" if kind == "salaryman" else "Top", 0.0035))
            for z in ((0.548, 0.51) if kind == "salaryman" else (0.58, 0.545)):
                b = bmesh.new()
                ellipsoid(b, at(Vector((0.004, -0.3, z)), F, 0.003)[0], (0.007, 0.004, 0.007), mi=mi["Button"], seg=10, rings=6)
                parts.append(b)
            # a breast pocket's welt
            if kind == "salaryman":
                parts.append(fr([(0.035, 0.625), (0.068, 0.628), (0.068, 0.62), (0.035, 0.617)], "Lapel", 0.0032, cuts=1))
        if st.get("vest"):
            # a knit vest over the shirt: a deep V, buttons
            parts.append(fr([(-0.026, 0.69), (0.0, 0.6), (0.026, 0.69)], "Shirt", 0.0022))
            for z in (0.58, 0.545, 0.51):
                b = bmesh.new()
                ellipsoid(b, at(Vector((0.0, -0.3, z)), F, 0.003)[0], (0.006, 0.004, 0.006), mi=mi["Button"], seg=10, rings=6)
                parts.append(b)
    elif c == "sailor":
        # the sailor collar: a square flap down the back, a navy V in front with a red ribbon
        parts.append(bk([(-0.075, 0.69), (0.075, 0.69), (0.075, 0.6), (-0.075, 0.6)], "Navy", 0.004))
        parts.append(bk([(-0.068, 0.618), (0.068, 0.618), (0.068, 0.612), (-0.068, 0.612)], "Collar", 0.0055, cuts=1))
        for sd in (1, -1):
            parts.append(fr([(sd * 0.03, 0.695), (sd * 0.07, 0.675), (sd * 0.012, 0.6), (sd * 0.0, 0.6)], "Navy", 0.004))
        rib = bmesh.new()
        p0 = at(Vector((0, -0.3, 0.6)), F, 0.008)[0]
        for sd in (1, -1):
            ellipsoid(rib, p0 + Vector((sd * 0.016, 0, 0.002)), (0.018, 0.006, 0.011), mi=mi["Ribbon"], seg=12, rings=8,
                      rot=Matrix.Rotation(sd * 0.3, 3, "Y"))
            loft(rib, [p0, p0 + Vector((sd * 0.012, -0.004, -0.04))], [0.008, 0.01], [0.003, 0.003], [B, B], mi=mi["Ribbon"],
                 tip=False)
        ellipsoid(rib, p0, (0.007, 0.006, 0.008), mi=mi["Ribbon"], seg=10, rings=6)
        parts.append(rib)
    elif c == "gakuran":
        # the black standing collar and a row of brass buttons
        b = bmesh.new()
        tube_ring(b, Vector((0, 0, 0.712)), Vector((0, 0, 1)), 0.037, (0.006, 0.018), mi=mi["Top"], seg=28)
        parts.append(b)
        for z in (0.665, 0.625, 0.585, 0.545, 0.505):
            b = bmesh.new()
            ellipsoid(b, at(Vector((0.0, -0.3, z)), F, 0.003)[0], (0.008, 0.005, 0.008), mi=mi["Gold"], seg=10, rings=6)
            parts.append(b)
    elif c == "round":
        # a cardigan: a round neck edge, buttons down its front
        b = bmesh.new()
        tube_ring(b, Vector((0, 0.003, 0.685)), Vector((0, 0.15, 1)), 0.04, (0.006, 0.006), mi=mi["Top"], seg=28)
        parts.append(b)
        parts.append(fr([(-0.003, 0.68), (0.003, 0.68), (0.003, 0.47), (-0.003, 0.47)], "Button", 0.0024, cuts=4))
        for z in (0.645, 0.6, 0.555, 0.51):
            b = bmesh.new()
            ellipsoid(b, at(Vector((0.0, -0.3, z)), F, 0.003)[0], (0.007, 0.004, 0.007), mi=mi["Button"], seg=10, rings=6)
            parts.append(b)
    elif c == "tee":
        b = bmesh.new()
        tube_ring(b, Vector((0, 0.002, 0.688)), Vector((0, 0.15, 1)), 0.037, (0.005, 0.005), mi=mi["Top"], seg=28)
        parts.append(b)
    elif c == "aloha":
        # an open collar either side
        for sd in (1, -1):
            parts.append(fr([(sd * 0.004, 0.66), (sd * 0.042, 0.695), (sd * 0.07, 0.668), (sd * 0.012, 0.6)], "Top", 0.0045))
        parts.append(fr([(-0.01, 0.66), (0.012, 0.6), (0.004, 0.58), (-0.004, 0.6)], "Top", 0.003, cuts=1))
    elif c == "hood":
        # a hood lying behind the neck, and its drawstrings
        b = bmesh.new()
        ellipsoid(b, Vector((0, 0.06, 0.678)), (0.072, 0.04, 0.035), mi=mi["Top"], seg=20, rings=12)
        tube_ring(b, Vector((0, 0.0, 0.69)), Vector((0, 0.3, 1)), 0.045, (0.01, 0.01), mi=mi["Top"], seg=28)
        for sd in (1, -1):
            p0 = at(Vector((sd * 0.02, -0.3, 0.675)), F, 0.004)[0]
            loft(b, [p0, p0 + Vector((sd * 0.002, -0.004, -0.04)), p0 + Vector((sd * 0.003, -0.006, -0.07))], [0.003] * 3,
                 [0.003] * 3, [B] * 3, mi=mi["Cord"], tip=False, ring=6)
        # a pouch pocket
        parts.append(fr([(-0.05, 0.56), (0.05, 0.56), (0.06, 0.48), (-0.06, 0.48)], "Top", 0.0045, cuts=3))
        parts.append(b)
    elif c == "yukata":
        # the yukata's collars crossing, left over right
        parts.append(fr([(-0.032, 0.697), (-0.052, 0.69), (0.012, 0.565), (0.03, 0.565)], "Collar", 0.0034))
        parts.append(fr([(0.032, 0.697), (0.052, 0.69), (0.012, 0.6), (0.0, 0.615)], "Collar", 0.0026))

    # a belt where there are trousers (not under a jacket)
    if st["legs"] in ("long", "shorts") and not st.get("jacket"):
        out.append(band(kind, bd, 0.47, 0.022, "Belt", "belt", extra=0.003))
        b = bmesh.new()
        ellipsoid(b, at(Vector((0, -0.3, 0.47)), F, 0.006)[0], (0.012, 0.004, 0.009), mi=mi["Buckle"], seg=10, rings=6)
        parts.append(b)
    if st.get("jacket") and st["legs"] != "skirt":
        # the jacket's skirts over the hips: a little flare, open at the front
        out.append(skirt(kind, bd, 0.475, 0.405, 0.012, 0, mi_name="Top"))
        out[-1].name = f"{kind}.hem"
    if kind == "kid":
        # a red randoseru on his back, its straps over his shoulders
        b = bmesh.new()
        bc = Vector((0, 0.115, 0.585))
        bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation(bc) @ Matrix.Diagonal((0.12, 0.07, 0.13, 1)))
        for f in b.faces:
            f.material_index = mi["Bag"]
        bmesh.ops.bevel(b, geom=b.edges[:], offset=0.018, segments=3, affect="EDGES")
        flap = bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation(bc + Vector((0, 0.037, 0.02))) @ Matrix.Diagonal((0.124, 0.004, 0.1, 1)))
        for v in flap["verts"]:
            for f in v.link_faces:
                f.material_index = mi["BagDark"]
        parts.append(b)
        for sd in (1, -1):
            parts.append(fr([(sd * 0.03, 0.665), (sd * 0.055, 0.665), (sd * 0.06, 0.53), (sd * 0.04, 0.53)], "Strap", 0.003))
    if kind == "yukata":
        out.append(band(kind, bd, 0.53, 0.07, "Obi", "obi", extra=0.008))
        b = bmesh.new()
        # the bow at the back, and the cord round the front
        bc = Vector((0, 0.085, 0.535))
        for sd in (1, -1):
            ellipsoid(b, bc + Vector((sd * 0.045, 0.01, 0.01)), (0.045, 0.014, 0.03), mi=mi["Obi"], seg=14, rings=8,
                      rot=Matrix.Rotation(sd * 0.25, 3, "Y"))
            loft(b, [bc, bc + Vector((sd * 0.02, 0.008, -0.06)), bc + Vector((sd * 0.03, 0.01, -0.09))], [0.022, 0.02, 0.018],
                 [0.004] * 3, [F] * 3, mi=mi["Obi"], tip=False)
        ellipsoid(b, bc + Vector((0, 0.008, 0)), (0.018, 0.014, 0.024), mi=mi["Obi"], seg=12, rings=8)
        parts.append(b)
        out.append(band(kind, bd, 0.53, 0.008, "ObiCord", "cord", extra=0.013))
    # the skirt or robe
    if st["legs"] == "skirt":
        hem, flare, pl = st["skirt"]
        out.append(skirt(kind, bd, 0.475, hem, flare, pl))
    if st["legs"] == "robe":
        out.append(skirt(kind, bd, 0.48, 0.1, 0.012, 0, mi_name="Top"))
        out[-1].name = f"{kind}.robe"
        # the robe's front edge, where it overlaps
        b = fr([(0.03, 0.49), (0.04, 0.49), (0.05, 0.1), (0.04, 0.1)], "Collar", 0.0)
        bmesh.ops.delete(b, geom=b.verts[:], context="VERTS")
        b.free()
    if kind == "uncle":
        # a shirt open over the belly: no extras but a chest pocket
        parts.append(fr([(0.03, 0.635), (0.07, 0.635), (0.07, 0.6), (0.03, 0.6)], "Top", 0.0035, cuts=2))

    if parts:
        bm = bmesh.new()
        tmp = bpy.data.meshes.new("tmp")
        for b in parts:
            b.to_mesh(tmp)
            bm.from_mesh(tmp)
            b.free()
        bpy.data.meshes.remove(tmp)
        for f in bm.faces:
            f.smooth = True
        out.append(from_bm(f"{kind}.details", bm, mats, BREF))
    # hems and cuffs: a rolled edge at each sleeve and trouser end
    hb = bmesh.new()
    for sd in (1, -1):
        sname = {"long": ("forearm", 0.84), "short": ("upperarm", 0.55), "elbow": ("forearm", 0.45)}[st["sleeves"]]
        a, b2 = BONE[f"{sname[0]}.{'L' if sd > 0 else 'R'}"]
        cpt = a + (b2 - a) * sname[1]
        r = limb_radius(bd, a, b2, sname[1])
        tube_ring(hb, cpt, b2 - a, r + 0.002, (0.004 if st["sleeves"] != "elbow" else 0.006, 0.005), mi=0, seg=20)
        if st["legs"] == "shorts":
            a, b2 = BONE[f"thigh.{'L' if sd > 0 else 'R'}"]
            cpt = a + (b2 - a) * 0.72
            tube_ring(hb, cpt, b2 - a, limb_radius(bd, a, b2, 0.72) + 0.002, (0.005, 0.006), mi=1, seg=20)
        if st["legs"] == "long":
            a, b2 = BONE[f"shin.{'L' if sd > 0 else 'R'}"]
            cpt = a + (b2 - a) * 0.9
            tube_ring(hb, cpt, b2 - a, limb_radius(bd, a, b2, 0.9) + 0.002, (0.004, 0.006), mi=1, seg=20)
        socks = st.get("socks")
        if socks:
            a, b2 = BONE[f"shin.{'L' if sd > 0 else 'R'}"]
            cpt = a + (b2 - a) * (1 - socks)
            tube_ring(hb, cpt, b2 - a, limb_radius(bd, a, b2, 1 - socks) + 0.0015, (0.003, 0.004), mi=2, seg=20)
    for f in hb.faces:
        f.smooth = True
    sleeve_mat = "Top"
    out.append(from_bm(f"{kind}.cuffs", hb, [MATS[sleeve_mat], MATS["Bottom"], MATS["Socks"]], BREF))
    return out


def limb_radius(bd, a, b, t):
    c = a + (b - a) * t
    ax = (b - a).normalized()
    rs = []
    for vt in bd.data.vertices:
        off = vt.co - c
        along = off.dot(ax)
        if abs(along) < 0.006:
            r = (off - ax * along).length
            if r < 0.07:
                rs.append(r)
    return sum(rs) / len(rs) if rs else 0.03


def glasses(kind, surf):
    bm = bmesh.new()
    for sd in (1, -1):
        c, n = surf.ang(sd * 0.36, -0.06, 0.012)
        tube_ring(bm, c, n, 0.03, (0.003, 0.003), mi=0, seg=24)
        # the arm back to the ear
        e = surf.ang(sd * 1.45, -0.04, 0.008)[0]
        loft(bm, [c + Vector((sd * 0.028, 0, 0)), surf.ang(sd * 0.9, -0.03, 0.012)[0], e], [0.002] * 3, [0.002] * 3,
             [Vector((0, 0, 1))] * 3, ring=6, tip=False)
    l, r = surf.ang(0.17, -0.04, 0.014)[0], surf.ang(-0.17, -0.04, 0.014)[0]
    mid = surf.ang(0, -0.02, 0.014)[0]
    loft(bm, [l, mid, r], [0.0022] * 3, [0.0022] * 3, [Vector((0, -1, 0))] * 3, ring=6, tip=False)
    for f in bm.faces:
        f.smooth = True
    return from_bm(f"{kind}.glasses", bm, [MATS["Lens"]], HREF)


# =====================================================================
# Rig, weights
# =====================================================================

def make_rig():
    arm = bpy.data.armatures.new("Rig")
    rig = new_obj("Rig", arm)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, h, t, parent in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail = h, t
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = (Vector(h) - Vector(eb[parent].tail)).length < 1e-5
        eb[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def weights_by_bones(o, allowed=None, power=4.0):
    """skin weights from how near each vertex is to each bone (left and right kept apart)"""
    groups = {name: o.vertex_groups.new(name=name) for name in BONE}
    for vt in o.data.vertices:
        p = vt.co
        ws = []
        for name in BONE:
            if allowed and name not in allowed:
                continue
            side = name[-1] if "." in name else ""
            if (side == "L" and p.x < -0.004) or (side == "R" and p.x > 0.004):
                continue
            d, _ = seg(name, p)
            ws.append((1 / (d + 0.004) ** power, name))
        ws.sort(reverse=True)
        ws = ws[:3]
        tot = sum(w for w, _ in ws)
        for w, name in ws:
            if w / tot > 0.02:
                groups[name].add([vt.index], w / tot, "REPLACE")


def weights_rigid(o, bone):
    g = o.vertex_groups.new(name=bone)
    g.add([v.index for v in o.data.vertices], 1.0, "REPLACE")


def weights_skirt(o, top, hem):
    """a skirt or robe: the hips at the waist, then more and more the thigh (and the shin, lower) on its side"""
    gs = {n: o.vertex_groups.new(name=n) for n in ("hips", "thigh.L", "thigh.R", "shin.L", "shin.R")}
    for vt in o.data.vertices:
        p = vt.co
        t = smoothstep(top - 0.01, top - 0.06, p.z)
        sideL = smoothstep(-0.03, 0.03, p.x)
        low = smoothstep(0.27, 0.22, p.z)
        w = {"hips": 1 - t}
        w["thigh.L"] = t * sideL * (1 - low)
        w["thigh.R"] = t * (1 - sideL) * (1 - low)
        w["shin.L"] = t * sideL * low
        w["shin.R"] = t * (1 - sideL) * low
        for n, x in w.items():
            if x > 0.01:
                gs[n].add([vt.index], x, "REPLACE")


def copy_weights(src, o):
    """each vertex takes the weights of the nearest vertex of src"""
    kd = KDTree(len(src.data.vertices))
    for v in src.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    names = {g.index: g.name for g in src.vertex_groups}
    groups = {}
    for v in o.data.vertices:
        _, i, _ = kd.find(v.co)
        for ge in src.data.vertices[i].groups:
            n = names[ge.group]
            if n not in groups:
                groups[n] = o.vertex_groups.get(n) or o.vertex_groups.new(name=n)
            groups[n].add([v.index], ge.weight, "REPLACE")


def bind(o, rig):
    o.parent = rig
    m = o.modifiers.new("Rig", "ARMATURE")
    m.object = rig


def auto_weights(o, rig):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        ok = len(o.vertex_groups) > 0 and any(v.groups for v in o.data.vertices)
    except RuntimeError:
        ok = False
    if not ok:
        print("auto weights failed for", o.name, "- using distance weights")
        o.parent = None
        o.modifiers.clear()
        o.vertex_groups.clear()
        weights_by_bones(o)
        bind(o, rig)
    else:
        # (no stray weights from one side to the other)
        pass


# =====================================================================
# Build everything
# =====================================================================

rig = make_rig()
for kind in KINDS:
    bd = body(kind)
    hd = head(kind)
    surf, feats = face(kind, hd)
    hr = hair(kind, hd, surf)
    extra = clothes(kind, bd, hd, surf)
    gl = glasses(kind, surf)
    # skin them all to the rig: the body by heat, the head and all on it rigidly, garments by their own rules
    auto_weights(bd, rig)
    for o in [hd, hr, gl, *feats] + [x for x in COL.objects if x.name.startswith(f"{kind}.") and x.name.split(".")[1] in ("hat", "band", "pin")]:
        if o.parent is None:
            weights_rigid(o, "head")
            bind(o, rig)
    for o in extra:
        part = o.name.split(".")[1]
        if part == "skirt" and kind == "officeLady":
            copy_weights(bd, o)
        elif part in ("skirt", "robe", "hem"):
            top = 0.48 if part == "robe" else 0.475
            weights_skirt(o, top, 0.1)
        elif part == "cuffs":
            weights_by_bones(o, allowed=[n for n in BONE if n.startswith(("upperarm", "forearm", "hand", "thigh", "shin", "foot"))])
        else:
            copy_weights(bd, o)
        bind(o, rig)
    print("built", kind)


# =====================================================================
# Poses and actions
# =====================================================================

def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()


def aim(name, d, twist=0.0):
    pb = rig.pose.bones[name]
    bpy.context.view_layer.update()
    M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = cur.rotation_difference(Vector(d).normalized())
    R = q.to_matrix().to_4x4()
    if twist:
        R = Matrix.Rotation(twist, 4, Vector(d).normalized()) @ R
    T = M.translation.copy()
    pb.matrix = Matrix.Translation(T) @ R @ Matrix.Translation(-T) @ M
    bpy.context.view_layer.update()


def move_hips(z, y=0.0):
    pb = rig.pose.bones["hips"]
    bpy.context.view_layer.update()
    M = pb.matrix.copy()
    M.translation = Vector((0, y, z))
    pb.matrix = M
    bpy.context.view_layer.update()


def sit_base(lean=0.12, breathe=0.0):
    move_hips(0.37)
    aim("spine", (0, -lean * 0.6, 1))
    aim("chest", (0, -lean, 1 + breathe))
    aim("neck", (0, -lean * 0.3, 1))
    aim("head", (0, 0.05, 1))
    for s, sd in (("L", 1), ("R", -1)):
        aim(f"thigh.{s}", (sd * 0.12, -1, 0.04))
        aim(f"shin.{s}", (0, 0.12, -1))
        aim(f"foot.{s}", (sd * 0.05, -1, -0.25))


def reach(s, wrist, pole, hand_dir):
    """the arm bent so its wrist is at wrist (armature space), the elbow out toward pole"""
    bpy.context.view_layer.update()
    S = rig.pose.bones[f"upperarm.{s}"].head.copy()
    L1 = (BONE[f"upperarm.{s}"][1] - BONE[f"upperarm.{s}"][0]).length
    L2 = (BONE[f"forearm.{s}"][1] - BONE[f"forearm.{s}"][0]).length
    W = Vector(wrist)
    d = min((W - S).length, (L1 + L2) * 0.999)
    u = (W - S).normalized()
    v = Vector(pole) - u * Vector(pole).dot(u)
    v.normalize()
    a = math.acos(max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
    E = S + (u * math.cos(a) + v * math.sin(a)) * L1
    aim(f"upperarm.{s}", E - S)
    aim(f"forearm.{s}", S + u * d - E)
    aim(f"hand.{s}", hand_dir)


# where the hands rest on the bar (its top is 0.49 up, its edge 0.13 in front of them), and the mouth
BAR_HAND = 0.515
MOUTH = Vector((0, -0.15, 0.7))


def arms_on_bar(s, sd, forward=0.0):
    """forearms on the bar, hands in front of them"""
    aim(f"clavicle.{s}", (sd, -0.15, 0.04))
    reach(s, (sd * 0.075, -0.2 - forward, BAR_HAND), (sd, 0.2, -1), (-sd * 0.3, -1, -0.1))


def key_all(frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    rig.pose.bones["hips"].keyframe_insert("location", frame=frame)


def action(name, frames):
    """frames: [(frame, pose function)]"""
    ad = rig.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    for f, pose in frames:
        reset_pose()
        pose()
        key_all(f)
    # smooth, looping
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, int(frames[0][0]), act)
    st.name = name
    ad.action = None
    return act


def sit(breathe):
    def pose():
        sit_base(breathe=breathe)
        arms_on_bar("L", 1)
        arms_on_bar("R", -1)
    return pose


def eat(phase):
    """the right hand brings the food up to the mouth (phase 0: down on the bar, 1: at the mouth)"""
    def pose():
        sit_base(lean=0.12 + 0.05 * phase)
        aim("head", (0, -0.12 * phase, 1))
        arms_on_bar("L", 1, forward=0.03)
        aim("clavicle.R", (-1, -0.15, 0.04 + 0.12 * phase))
        rest = Vector((-0.075, -0.21, BAR_HAND))
        # (lifted to just in front of the mouth, the skewer in the fist pointing at it)
        lifted = MOUTH + Vector((-0.035, -0.11, -0.06))
        w = rest.lerp(lifted, phase)
        hand = Vector((-0.3, -1, -0.1)).lerp(MOUTH - lifted, phase)
        reach("R", w, (-1, 0.3, -0.8), hand)
    return pose


def walk(phase):
    """one step: phase 0..1 over a stride of both feet"""
    a = math.sin(2 * math.pi * phase)
    c = math.cos(2 * math.pi * phase)

    def pose():
        move_hips(0.46 - 0.008 + 0.012 * abs(c), 0)
        aim("spine", (0, -0.04, 1), twist=0.06 * a)
        aim("chest", (0, -0.05, 1), twist=-0.1 * a)
        aim("head", (0, 0.0, 1), twist=0.04 * a)
        for s, sd in (("L", 1), ("R", -1)):
            sw = a * sd
            aim(f"thigh.{s}", (sd * 0.02, -0.45 * sw, -1))
            knee = max(0.0, -math.sin(2 * math.pi * phase + 0.6) * sd) * 0.9 + 0.08
            aim(f"shin.{s}", (0, -0.45 * sw + knee, -1))
            aim(f"foot.{s}", (sd * 0.04, -1, -0.3 + max(0, sw) * 0.3))
            aim(f"clavicle.{s}", (sd, 0, 0.02))
            aim(f"upperarm.{s}", (sd * 0.3, 0.5 * sw, -1))
            aim(f"forearm.{s}", (sd * 0.25, 0.5 * sw - 0.35 - max(0, -sw) * 0.4, -1))
            aim(f"hand.{s}", (sd * 0.12, 0.5 * sw - 0.3, -1))
    return pose


action("Sit", [(0, sit(0)), (36, sit(0.025)), (72, sit(0))])
action("Eat", [(0, eat(0)), (14, eat(0.6)), (22, eat(1)), (32, eat(1)), (44, eat(0.4)), (56, eat(0)), (72, eat(0))])
action("Walk", [(i * 3, walk(i / 8)) for i in range(9)])
reset_pose()

# =====================================================================
# Export
# =====================================================================

root = bpy.data.objects.new("Guests", None)
COL.objects.link(root)
rig.parent = root

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJECT, "blender", "guests.blend"))
bpy.ops.object.select_all(action="DESELECT")
for o in COL.objects:
    o.select_set(True)
out = os.path.join(PROJECT, "public", "models", "guests.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=False,
                          export_animations=True, export_animation_mode="ACTIONS", export_skins=True,
                          export_def_bones=False, export_optimize_animation_size=False, export_force_sampling=True)
print("GUESTS_DONE", out)

if PREVIEW:
    scene = bpy.context.scene
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    cam.location = (0, -2.6, 0.6)
    cam.rotation_euler = (math.radians(88), 0, 0)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 1200, 600
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
