"""Generate the customers: fifteen kinds of chibi figures on one shared rig, with sitting, eating and walking actions.

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

Options any kind can show: "<kind>.glasses" (and the student's "student.phones"). Swapped in by the app:
"<kind>.eyes" / "<kind>.eyesShut" (a blink) / "<kind>.eyesJoy", "<kind>.brows" / "browsJoy" / "browsMad" / "browsSad",
and "<kind>.mouth" / "<kind>.mouthOpen" (chewing) / "mouthJoy" / "mouthMad" / "mouthSad" (as they're pleased or not).

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
         "student", "yukata", "yankee", "bosozoku", "tourist", "civilServant", "maid", "gyaru", "chef", "staffM",
         "staffF"]

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
mat("PhoneRed", srgb("#d0342c"))
mat("Vein", srgb("#d8262a"))
mat("Tear", srgb("#8fd0f4"))
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
mat("Iris", srgb("#6a4632"))
mat("IrisLight", srgb("#b4835a"))
mat("Sole", srgb("#4a403a"))
mat("Toque", srgb("#fbfaf6"))
mat("Wrinkle", srgb("#b0806a"))
mat("Work", srgb("#7a6a3e"))
mat("WorkDark", srgb("#5f5230"))

# =====================================================================
# Skeleton (standing, arms a little out)
# =====================================================================

HC = Vector((0, 0, 0.835))        # the middle of the head
HEAD_R = 0.158   # (a big round head sat straight on the body, as Overcooked's cooks have)

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
    # the delinquent (ヤンキー): a long gakuran (長ラン) over wide bontan trousers, a towering pompadour
    "yankee": dict(sh=1.04, waist=0.96, hip=1.0, belly=0.0, chest=0.0, sleeves="long", legs="long", hair="regent",
                   collar="gakuran", jacket=True, coat=0.3, baggy=1.3, tough=True),
    # the biker gang (暴走族): a tokkō coat (特攻服) to the ankles, its standing collar and gold embroidery, a punch
    # perm under a hachimaki with the rising sun
    "bosozoku": dict(sh=1.06, waist=1.0, hip=1.02, belly=0.0, chest=0.0, sleeves="long", legs="long", hair="oni",
                     collar="tokko", jacket=True, coat=0.14, baggy=1.2, tough=True),
    # a tourist from abroad: a T-shirt, cargo shorts, a big backpack
    "tourist": dict(sh=1.06, waist=1.02, hip=1.0, belly=0.006, chest=0.0, sleeves="short", legs="shorts", hair="side",
                    collar="tee", socks=0.2, backpack=True),
    # a civil servant (公務員): a plain grey suit, his staff pass on a lanyard
    "civilServant": dict(sh=0.98, waist=1.02, hip=1.0, belly=0.008, chest=0.0, sleeves="long", legs="long", hair="side",
                         jacket=True, collar="shirt", lanyard=True),
    # a maid café cosplayer: the black dress with its puffed sleeves, a frilled white apron and bib, a headdress,
    # knee socks
    "maid": dict(sh=0.88, waist=0.85, hip=0.98, belly=0.0, chest=0.008, sleeves="short", legs="skirt", hair="twin",
                 skirt=(0.3, 0.05, 1.0), collar="tee", socks=0.62, apron=True),
    # a gyaru (ギャル): bleached hair, a tan, a cropped top and a short skirt, slouched loose socks, platform shoes, and
    # heavy lashes with flicked liner
    "gyaru": dict(sh=0.88, waist=0.84, hip=0.98, belly=0.0, chest=0.01, sleeves="short", legs="skirt", hair="long",
                  skirt=(0.3, 0.035, 1.0), collar="tee", socks=0.48, heels=True),
    # the hired staff, a man and a woman, dressed by the app for their job (as in their pictures, ui/Avatar.tsx): a
    # shirt under what's coloured Top (all white for the cooks, a dark waistcoat for the floor, an olive work jacket
    # for the stock keeper), and the job's things shown or not: the cooks' toque or cap and buttons, the floor's bow
    # tie, the till's apron and name badge, the stock keeper's work cap
    "staffM": dict(sh=1.02, waist=1.0, hip=1.0, belly=0.006, chest=0.0, sleeves="long", legs="long", hair="short",
                  collar="shirt", vest=True, staff=True),
    "staffF": dict(sh=0.9, waist=0.88, hip=1.0, belly=0.0, chest=0.008, sleeves="long", legs="long", hair="bob",
                   collar="shirt", vest=True, staff=True),
    # (the cook, not a customer: a samue's crossed collar, a twisted headband)
    "chef": dict(sh=1.04, waist=1.06, hip=1.02, belly=0.015, chest=0.0, sleeves="long", legs="long", hair="crop",
                 collar="yukata"),
}


# the ways each kind can wear its hair (a customer is given one of them, at random by their id: the app finds the
# choices from the parts' names, "<kind>.<part>_<style>"); the first is the kind's own
HAIRS = {
    "salaryman": ["side", "short", "messy"],
    "officeLady": ["bob", "long", "updo"],
    "highSchoolGirl": ["long", "bob"],
    "highSchoolBoy": ["spiky", "short", "messy"],
    "grandma": ["bun", "short"],
    "grandpa": ["bald", "short"],
    "kid": ["cap", "spiky", "short"],
    "uncle": ["crop", "punch", "bald"],
    "student": ["messy", "side", "spiky"],
    "yukata": ["updo", "bob", "long"],
    "yankee": ["regent", "punch"],
    "bosozoku": ["oni"],
    "tourist": ["side", "messy", "short"],
    "civilServant": ["side", "short"],
    "maid": ["twin", "long", "bob"],
    "gyaru": ["long", "twin", "updo"],
    "chef": ["crop", "short", "side"],
    "staffM": ["short", "side", "messy"],
    "staffF": ["bob", "long", "bun"],
}


# =====================================================================
# Body: a skin-modifier skeleton, subdivided into one smooth mesh
# =====================================================================

def body(kind):
    st = STYLE[kind]
    sh, wa, hi = st["sh"], st["waist"], st["hip"]
    verts, radii, edges = [], [], []
    hand_roots = []

    def v(p, r):
        verts.append(Vector(p))
        radii.append(r)
        return len(verts) - 1

    # (a round body like an egg, its widest low, rising straight into the head: no waist to speak of, no neck showing)
    # (a round bean of a body from nearly the floor up into the head, widest low: the legs are inside it, only the feet showing; no neck)
    # (the skin's radii shrink as it's smoothed: set a third larger than they'll show)
    seat = v((0, 0, 0.16), 0.17 * hi)
    pelvis = v((0, 0, 0.29), 0.19 * hi)
    waist = v((0, 0, 0.43), 0.185 * wa)
    chest = v((0, 0, 0.55), 0.16 * (sh * 0.5 + wa * 0.5))
    top = v((0, 0, 0.64), 0.1 * sh)
    neck0 = v((0, 0, 0.69), 0.06)
    neck1 = v((0, 0, 0.73), 0.05)
    edges += [(seat, pelvis), (pelvis, waist), (waist, chest), (chest, top), (top, neck0), (neck0, neck1)]
    for sd in (1, -1):
        # (as Overcooked's cooks: no arms; the hands are their own floating mittens (hands(), below), not part of the body)
        bg = st.get("baggy", 1.0)
        # (short, stout legs: what shows under the round body is a thick stub and a big round shoe)
        hip = v((sd * 0.045 * hi, 0, 0.29), 0.05 * hi * (1 + (bg - 1) * 0.4))
        knee = v((sd * 0.05, 0, 0.17), 0.045 * bg)
        ankle = v((sd * 0.058, 0.0, 0.08), 0.045)
        heel = v((sd * 0.06, 0.012, 0.04), 0.05)
        toe = v((sd * 0.062, -0.07, 0.04), 0.055)
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
    for hr in hand_roots:
        me.skin_vertices[0].data[hr].use_root = True
    sub = o.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    o = evaluated_copy(o, f"{kind}.body")

    # shape it: a torso flatter front to back, a bit of chest, a belly, a seat; flat hands; shoes longer and lower
    for vt in o.data.vertices:
        p = vt.co
        name, t, _ = nearest_bone(p)
        if abs(p.x) < 0.11 and 0.36 < p.z < 0.72 and not name.startswith(("upperarm", "forearm", "hand", "clavicle")):
            k = smoothstep(0.36, 0.43, p.z) * (1 - smoothstep(0.66, 0.72, p.z))
            p.y *= 1 - 0.06 * k
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
            p -= n * d * 0.25
        if name.startswith("foot") or (name.startswith("shin") and t > 0.9):
            if p.z < 0.012:
                p.z = 0.012 + (p.z - 0.012) * 0.3
    o.data.update()
    paint_body(o, kind)
    return o


def body_mat(name, t, p, st, kind):
    """which material a point of the body is (by the bone it's nearest and how far along)"""
    if name == "head" or name == "neck":
        if st["collar"] in ("gakuran", "tokko") and p.z < (0.74 if st["collar"] == "gakuran" else 0.755):
            return "Top"
        if st["collar"] == "hood" and p.z < 0.705:
            return "Top"
        return "Skin"
    # (there are no arms: what of the body lies nearest an arm's bone is its shoulder and side, in the top's colour)
    if name.startswith(("hand", "forearm", "upperarm")):
        return "Top"
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
        return "Sole" if p.z < 0.018 else "Shoes"
    if name.startswith(("thigh", "shin")):
        legs = st["legs"]
        if name.startswith("shin") and t > 0.93:
            return "Shoes"
        if st.get("coat") and name.startswith("thigh") and p.z > st["coat"] + 0.02:
            return "Top"  # (under a long coat: in its colour, so a thigh pushing through it as they walk won't show)
        if legs in ("skirt", "robe") and name.startswith("thigh") and p.z > (st["skirt"][0] if legs == "skirt" else 0.1) + 0.02:
            return "Bottom"  # (under the skirt: in its colour, in case the hip shows at its waist as they move)
        # (the legs are inside the round body: what's thigh there is the body's lower half, the lap when sitting; under a skirt or shorts it's
        # in their colour, not a great round of skin)
        if legs in ("skirt", "shorts", "robe") and name.startswith("thigh"):
            return "Bottom"
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
        return "Top" if p.z > (0.44 if st.get("jacket") else 0.47) or st["legs"] == "robe" else "Bottom"
    if st.get("jacket") and p.z > 0.39:
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
    order = ["Skin", "Top", "Bottom", "Shoes", "Socks", "Shirt", "Sole"]
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


# each kind's face: how wide and how long, how much the jaw narrows to the chin (less is squarer), how far the chin
# drops, and how full the cheeks are
FACE = {
    "salaryman": dict(wide=1.02, long=1.0, jaw=0.13, chin=0.012, cheek=0.004),
    "officeLady": dict(wide=0.98, long=1.0, jaw=0.16, chin=0.014, cheek=0.005),
    "highSchoolGirl": dict(wide=1.03, long=0.97, jaw=0.12, chin=0.01, cheek=0.008),
    "highSchoolBoy": dict(wide=1.01, long=0.99, jaw=0.14, chin=0.012, cheek=0.005),
    "grandma": dict(wide=1.08, long=0.95, jaw=0.04, chin=0.006, cheek=0.011),
    "grandpa": dict(wide=0.99, long=1.04, jaw=0.1, chin=0.004, cheek=0.003),
    "kid": dict(wide=1.07, long=0.94, jaw=0.02, chin=0.004, cheek=0.013),
    "uncle": dict(wide=1.12, long=0.97, jaw=-0.03, chin=0.006, cheek=0.011),
    "student": dict(wide=0.98, long=1.03, jaw=0.15, chin=0.012, cheek=0.003),
    "yukata": dict(wide=0.99, long=1.0, jaw=0.15, chin=0.013, cheek=0.006),
    "yankee": dict(wide=0.98, long=1.04, jaw=0.2, chin=0.018, cheek=0.002),
    "bosozoku": dict(wide=1.06, long=1.02, jaw=0.0, chin=0.012, cheek=0.003),
    "tourist": dict(wide=0.97, long=1.06, jaw=0.17, chin=0.02, cheek=0.002),
    "civilServant": dict(wide=1.04, long=1.0, jaw=0.08, chin=0.01, cheek=0.006),
    "maid": dict(wide=1.02, long=0.96, jaw=0.13, chin=0.008, cheek=0.009),
    "gyaru": dict(wide=1.0, long=0.98, jaw=0.12, chin=0.01, cheek=0.008),
    "staffM": dict(wide=1.03, long=1.0, jaw=0.1, chin=0.01, cheek=0.005),
    "staffF": dict(wide=1.0, long=0.98, jaw=0.14, chin=0.01, cheek=0.007),
    "chef": dict(wide=1.06, long=0.99, jaw=0.05, chin=0.008, cheek=0.006),
}


def head(kind):
    st = STYLE[kind]
    fc = FACE[kind]
    k = st.get("head", 1.0)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=HEAD_R * k)
    for vt in bm.verts:
        p = vt.co
        # a chibi face: round, a little wider than tall at the cheeks, the jaw tucked in, the back of the head full
        # (each kind's own: wider or narrower, longer, squarer or more pointed at the chin)
        z = p.z / (HEAD_R * k)
        p.x *= fc["wide"] - fc["jaw"] * smoothstep(-0.2, -1.0, z)
        p.y *= 0.96
        if p.y < 0:
            p.y *= 1 - 0.03 * smoothstep(-0.1, -0.9, z)
            # (a chin that comes forward a little, not tucked back under the face)
            p.y -= 0.012 * k * math.exp(-((z + 0.82) / 0.16) ** 2) * math.exp(-(p.x / (HEAD_R * k * 0.45)) ** 2)
            # soft cheeks
            p.y -= fc["cheek"] * k * math.exp(-((z + 0.35) / 0.25) ** 2) * math.exp(-((abs(p.x) / (HEAD_R * k) - 0.55) / 0.3) ** 2)
        else:
            p.y *= 1.04
        p.z *= 0.97 * (fc["long"] if z < 0 else 1 + (fc["long"] - 1) * 0.3)
        if z < -0.6:
            p.z -= fc["chin"] * k * smoothstep(-0.6, -1.0, z) * (1 if p.y < 0 else 0.3)
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
    girl = kind in ("officeLady", "highSchoolGirl", "yukata", "grandma", "maid", "gyaru", "staffF")
    old = kind in ("grandma", "grandpa")
    ex, ez = 0.37, -0.075         # eye yaw and pitch
    tough = st.get("tough", False)
    names = ["Eye", "EyeWhite", "Lash", "Hair", "Mouth", "MouthIn", "Blush", "Skin", "Iris", "Wrinkle", "Vein", "Tear", "IrisLight"]
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
        # (Overcooked's eyes: two glossy black beans, a little taller than wide, one bright catchlight up on the one side; a girl's with a
        # short flick of lash at the outer corner, a tough one's flattened along the top into a glare)
        rw, rh = (0.07, 0.1) if girl or kind == "kid" else (0.062, 0.092)
        lid = 0.55 if tough else None
        decal_ellipse(bm, surf, y, ez, rw, rh, mi["Eye"],
                      squash=(lambda x, yy, lid=lid, rh=rh: (x, min(yy, lid * rh))) if lid else None)
        decal_ellipse(bm, surf, y + sd * rw * 0.28, ez + rh * 0.34, rw * 0.32, rh * 0.26, mi["EyeWhite"], off=0.0026)
        if girl:
            decal_strip(bm, surf, [(y + sd * rw * 0.8, ez + rh * 0.7), (y + sd * rw * 1.5, ez + rh * 1.0)], [0.012, 0.0], mi["Lash"], off=0.0024)
    eyes = from_bm(f"{kind}.eyes", bm, mats, HREF)

    bm = bmesh.new()
    for sd in (1, -1):
        y = sd * ex
        arc = [(y + sd * a * 0.09, ez - 0.02 + 0.035 * (1 - a * a)) for a in (-1, -0.5, 0, 0.5, 1)]
        if old:
            arc = [(y + sd * a * 0.11, ez + 0.042 - 0.05 * (a * a)) for a in (-1, -0.6, -0.2, 0.2, 0.6, 1)]
        decal_strip(bm, surf, arc, [0.0] + [0.012] * (len(arc) - 2) + [0.0], mi["Eye"])
    shut = from_bm(f"{kind}.eyesShut", bm, mats, HREF)

    # the moods, swapped in by the app as a customer's pleased or not: "joy" (eyes squeezed shut in happy arcs, brows
    # up, a wide open grin), "mad" (brows down hard in a V, a scowl), "sad" (brows up at the middle, a wobbly frown);
    # the plain face between. Eyes shut with joy:
    bm = bmesh.new()
    for sd in (1, -1):
        y = sd * ex
        arc = [(y + sd * a * 0.12, ez - 0.04 + 0.085 * (1 - a * a)) for a in (-1, -0.6, -0.2, 0.2, 0.6, 1)]
        decal_strip(bm, surf, arc, [0.0, 0.024, 0.028, 0.028, 0.024, 0.0], mi["Eye"])
        # (and cheeks gone pink with it)
        decal_ellipse(bm, surf, sd * 0.56, -0.28, 0.15, 0.08, mi["Blush"], off=0.0014)
    eyes_joy = from_bm(f"{kind}.eyesJoy", bm, mats, HREF)

    def brows(name, shape, thick, extra=None):
        bm = bmesh.new()
        for sd in (1, -1):
            y = sd * ex
            # (a: -1 at the brow's inner end, by the nose, 1 at its outer)
            pts = [(y + sd * a * 0.11, ez + shape(a)) for a in (-1, -0.4, 0.3, 1)]
            decal_strip(bm, surf, pts, [0.0, thick, thick, 0.0], mi["Hair"], off=0.0024 if kind != "grandpa" else 0.003)
        if extra:
            extra(bm)
        return from_bm(f"{kind}.{name}", bm, mats, HREF)

    def vein(bm):
        # (cross: the red "anger mark" standing out on the temple, four bent strokes in a cross)
        cy, cp = -0.62, 0.42
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            dy, dp = math.cos(a), math.sin(a)
            pts = [(cy + dy * 0.03, cp + dp * 0.03), (cy + dy * 0.08 + dp * 0.02, cp + dp * 0.08 - dy * 0.02), (cy + dy * 0.1, cp + dp * 0.1)]
            decal_strip(bm, surf, pts, [0.016, 0.014, 0.0], mi["Vein"], off=0.0026)

    def tear(bm):
        # (let down: a tear welling at one eye's corner and running down the cheek)
        decal_ellipse(bm, surf, -(ex + 0.06), ez - 0.2, 0.03, 0.05, mi["Tear"], off=0.0028,
                      squash=lambda x, y: (x * (0.4 if y > 0 else 1.0), y))
        decal_strip(bm, surf, [(-(ex + 0.05), ez - 0.1), (-(ex + 0.06), ez - 0.17)], [0.008, 0.012], mi["Tear"], off=0.0027)
    lift = 0.2 if not old else 0.17
    if kind == "grandpa":
        # (his bushy white brows)
        lift, plain_t = 0.21, 0.03
    else:
        plain_t = 0.017 if girl else 0.024
    lift += 0.03
    if tough:
        # (thin, plucked brows, drawn down hard toward the nose in a scowl)
        plain = lambda a: lift - 0.035 + 0.045 * (a + 1) / 2
    else:
        plain = lambda a: lift + (0.025 if kind == "grandpa" else 0.02) * (1 - a * a)
    b_plain = brows("brows", plain, plain_t)
    b_joy = brows("browsJoy", lambda a: lift + 0.06 + 0.045 * (1 - a * a), plain_t)
    b_mad = brows("browsMad", lambda a: lift - 0.1 + 0.13 * (a + 1) / 2, plain_t * 1.5, vein)
    b_sad = brows("browsSad", lambda a: lift + 0.07 - 0.11 * (a + 1) / 2, plain_t * 1.2, tear)

    # blush, the lines of age, the uncle's moustache (on the face mesh: they never change)
    bm = bmesh.new()
    for sd in (1, -1):
        if kind in ("kid", "highSchoolGirl", "yukata", "grandma", "officeLady", "maid", "gyaru", "staffF"):
            decal_ellipse(bm, surf, sd * 0.56, -0.28, 0.15, 0.075, mi["Blush"], off=0.0012)
        elif kind in ("highSchoolBoy", "student", "staffM"):
            decal_ellipse(bm, surf, sd * 0.56, -0.28, 0.1, 0.05, mi["Blush"], off=0.0012)
    if old:
        # the lines of age: across the brow, crow's feet at the eyes' corners, down from the nose to the mouth's corners
        for k in range(3):
            pz = 0.42 + k * 0.07
            decal_strip(bm, surf, [(a * 0.26, pz + 0.02 * (1 - a * a)) for a in (-1, -0.5, 0, 0.5, 1)],
                        [0.0, 0.007, 0.008, 0.007, 0.0], mi["Wrinkle"], off=0.0022)
        for sd in (1, -1):
            for k in (-1, 0, 1):
                y0 = sd * (ex + 0.13)
                decal_strip(bm, surf, [(y0, ez + k * 0.02), (y0 + sd * 0.05, ez + k * 0.045)], [0.006, 0.0], mi["Wrinkle"], off=0.0022)
            decal_strip(bm, surf, [(sd * 0.1, -0.24), (sd * 0.14, -0.32), (sd * 0.15, -0.4)], [0.007, 0.008, 0.0], mi["Wrinkle"],
                        off=0.0022)
    if kind == "uncle":
        # a moustache: two tapered locks either side
        for sd in (1, -1):
            pts = [(sd * 0.01, -0.36), (sd * 0.12, -0.38), (sd * 0.22, -0.44)]
            decal_strip(bm, surf, pts, [0.03, 0.026, 0.0], mi["Hair"], off=0.003)
    if kind == "tourist":
        # freckles across the nose
        for fy, fp in [(-0.2, -0.22), (-0.13, -0.27), (-0.26, -0.28), (0.2, -0.22), (0.13, -0.27), (0.26, -0.28)]:
            decal_ellipse(bm, surf, fy, fp, 0.012, 0.01, mi["Wrinkle"], off=0.0016)
    feat = from_bm(f"{kind}.face", bm, mats, HREF)

    # the mouth, each kind's own: a small smile; the uncle's broad, the tourist's a toothy grin, the kid's an open D,
    # the girls' a cat's ω, the student's and the rough lot's a crooked smirk, the civil servant's a straight line
    def mouth_mesh(name, build):
        bm = bmesh.new()
        build(bm)
        return from_bm(f"{kind}.{name}", bm, mats, HREF)

    def smile(bm, w=0.11, sag=0.04, t=0.016, z=-0.4, tilt=0.0):
        decal_strip(bm, surf, [(a * w, z - sag * (1 - a * a) + tilt * a) for a in (-1, -0.5, 0, 0.5, 1)],
                    [0.0, t * 0.85, t, t * 0.85, 0.0], mi["Mouth"])

    def open_d(bm, w, h, z=-0.42, teeth=True, tongue=True):
        decal_ellipse(bm, surf, 0, z, w, h, mi["MouthIn"], squash=lambda x, y: (x, y if y < 0 else y * 0.15))
        if teeth:
            decal_ellipse(bm, surf, 0, z - h * 0.05, w * 0.78, h * 0.2, mi["EyeWhite"], off=0.0021)
        if tongue:
            decal_ellipse(bm, surf, 0, z - h * 0.62, w * 0.5, h * 0.3, mi["Mouth"], off=0.0021)

    def cat(bm):
        for sd in (1, -1):
            decal_strip(bm, surf, [(sd * (0.06 + a * 0.06), -0.41 - 0.04 * (1 - a * a)) for a in (-1, -0.5, 0, 0.5, 1)],
                        [0.0, 0.015, 0.017, 0.015, 0.0], mi["Mouth"])

    def sad(bm):
        # (a wobbly frown: down at the corners, a little kink in the middle)
        decal_strip(bm, surf, [(-0.13, -0.49), (-0.07, -0.43), (0.0, -0.45), (0.07, -0.43), (0.13, -0.49)],
                    [0.0, 0.019, 0.019, 0.019, 0.0], mi["Mouth"])

    plain_mouth = {
        "uncle": lambda bm: smile(bm, 0.2, 0.07, 0.024, z=-0.46),
        "tourist": lambda bm: open_d(bm, 0.16, 0.08, tongue=False),
        "kid": lambda bm: open_d(bm, 0.11, 0.1, teeth=False),
        "highSchoolGirl": cat, "maid": cat,
        "gyaru": lambda bm: open_d(bm, 0.11, 0.055, tongue=False),
        "student": lambda bm: smile(bm, 0.1, 0.035, 0.016, tilt=0.015),
        "yankee": lambda bm: smile(bm, 0.11, 0.015, 0.018, tilt=0.025),
        "bosozoku": lambda bm: smile(bm, 0.12, 0.0, 0.02, tilt=0.025),
        "civilServant": lambda bm: smile(bm, 0.09, 0.0, 0.017),
    }.get(kind, lambda bm: smile(bm))
    mouth = mouth_mesh("mouth", plain_mouth)
    mouth_open = mouth_mesh("mouthOpen", lambda bm: decal_ellipse(bm, surf, 0, -0.43, 0.07, 0.055, mi["MouthIn"],
                                                                   squash=lambda x, y: (x, y if y < 0 else y * 0.25)))
    m_joy = mouth_mesh("mouthJoy", lambda bm: open_d(bm, 0.2, 0.15, z=-0.41))
    m_mad = mouth_mesh("mouthMad", lambda bm: smile(bm, 0.15, -0.07, 0.028, z=-0.46))
    m_sad = mouth_mesh("mouthSad", sad)

    # nose and ears, on the head mesh itself
    bm = bmesh.new()
    bm.from_mesh(hd.data)
    np_, nn = surf.ang(0, -0.235, -0.002)
    ellipsoid(bm, np_, (0.0075 * k, 0.006 * k, 0.006 * k), mi=0)
    for sd in (1, -1):
        ep, en = surf.ang(sd * 1.5, -0.14, -0.012)
        rot = Vector((0, 0, 1)).rotation_difference(Vector((sd, 0.25, 0))).to_matrix()
        ellipsoid(bm, ep, (0.03 * k, 0.022 * k, 0.012 * k), mi=0, rot=rot @ Matrix.Rotation(math.pi / 2, 3, "Z"))
    bm.to_mesh(hd.data)
    bm.free()
    for p in hd.data.polygons:
        p.use_smooth = True
    return surf, [eyes, shut, eyes_joy, b_plain, b_joy, b_mad, b_sad, feat, mouth, mouth_open, m_joy, m_mad, m_sad]


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


def hair(kind, hd, surf, style=None):
    st = STYLE[kind]
    style = style or st["hair"]
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

    if style in ("crop", "short"):
        # a close crop with a receding front (and for "crop", a twisted headband, a hachimaki, on top)
        bm = cap(hd, surf, lambda y, p: (p > 0.55 - 0.15 * min(1, abs(y))) if abs(y) < 1.3 else p > -0.35, off=0.004, thick=0.007)
        o = from_bm(f"{kind}.hair", bm, mats, HREF)
        if style == "short":
            return o
        bm = bmesh.new()
        tube_ring(bm, surf.c + Vector((0, 0.005, 0.045)), Vector((0, -0.18, 1)), HEAD_R * 1.03, (0.012, 0.016), mi=0, seg=32)
        for sd in (1, -1):
            lock(bm, surf, [(math.pi - sd * 0.12, 0.25), (math.pi - sd * 0.25, -0.05), (math.pi - sd * 0.32, -0.45)],
                 0.02, 0.005, [0.016, 0.02, 0.022])
        from_bm(f"{kind}.band", bm, [MATS["Band"]], HREF)
        return o

    if style == "punch":
        # a punch perm: cropped close and set in small tight curls all over, squared off at the brow
        bm = cap(hd, surf, lambda y, p: p > (0.48 if abs(y) < 0.9 else -0.25 - 0.15 * smoothstep(1.4, 2.6, abs(y))), off=0.004)
        for i in range(19):
            pitch = 1.5 - i * 0.1
            n = max(1, int(40 * math.cos(pitch) + 0.5))
            for j in range(n):
                yaw = -math.pi + (j + 0.5 * (i % 2)) * 2 * math.pi / n
                if pitch < (0.5 if abs(yaw) < 0.9 else -0.22 - 0.15 * smoothstep(1.4, 2.6, abs(yaw))):
                    continue
                ellipsoid(bm, surf.ang(yaw, pitch, 0.007)[0], (0.009, 0.009, 0.008), seg=8, rings=5)
        return from_bm(f"{kind}.hair", bm, mats, HREF)

    if style == "oni":
        # the biker's 鬼リーゼント: the sides shaved up high and an M of 剃り込み cut into the brow either side, and
        # the front combed into one enormous roll jutting far out over the face; a hachimaki round it under the roll
        def keep(y, p):
            a = abs(y)
            if a < 0.32:
                edge = 0.45
            elif a < 0.72:
                edge = 0.98
            elif a < 2.3:
                edge = 0.72
            else:
                edge = 0.72 - 1.05 * smoothstep(2.3, 2.9, a)
            return p > edge
        bm = cap(hd, surf, keep, off=0.004, thick=0.008)
        roll_c = HC + Vector((0, -HEAD_R * 1.02, HEAD_R * 0.5))
        rot = Matrix.Rotation(0.04, 3, "X")
        ellipsoid(bm, roll_c, (0.078, 0.165, 0.058), seg=24, rings=16, rot=rot)
        for i in range(5):
            x = -0.04 + i * 0.02
            pts = [roll_c + rot @ Vector((x * 0.9, 0.12, 0.03)), roll_c + rot @ Vector((x, 0.0, 0.052)),
                   roll_c + rot @ Vector((x * 0.95, -0.11, 0.035)), roll_c + rot @ Vector((x * 0.8, -0.148, 0.0))]
            loft(bm, pts, [0.004, 0.006, 0.006, 0.003], [0.003] * 4, [rot @ Vector((0, 0, 1))] * 4, ring=6, tip=False)
        o = from_bm(f"{kind}.hair", bm, mats, HREF)
        bm = bmesh.new()
        tube_ring(bm, surf.c + Vector((0, 0.005, 0.052)), Vector((0, -0.06, 1)), HEAD_R * 1.0, (0.012, 0.02), mi=0, seg=32)
        for sd in (1, -1):
            lock(bm, surf, [(math.pi - sd * 0.12, 0.4), (math.pi - sd * 0.28, 0.1), (math.pi - sd * 0.36, -0.3)],
                 0.024, 0.005, [0.016, 0.02, 0.022])
        # (the red sun on its front, just under the roll)
        ellipsoid(bm, surf.ang(0, 0.42, 0.02)[0], (0.018, 0.005, 0.014), mi=1, seg=16, rings=6)
        from_bm(f"{kind}.band", bm, [MATS["Band"], MATS["BandRed"]], HREF)
        return o

    if style == "twin":
        # twin tails: a full fringe, the rest drawn up into a tail high either side, tied with a ribbon
        bm = cap(hd, surf, lambda y, p: p > (0.42 if abs(y) < 0.85 else -0.45), off=0.007, thick=0.01)
        for i in range(9):
            y0 = -0.72 + i * 0.18
            lock(bm, surf, [(y0 * 0.6, 1.1), (y0 * 0.9, 0.75), (y0, 0.38), (y0, 0.2)], 0.05, 0.016,
                 [0.006, 0.02, 0.02, 0.016], ring=6)
        for sd in (1, -1):
            for j in range(3):
                hang(bm, surf, (sd * (0.95 + j * 0.12), 0.25), 0.1, 0.03, 0.012, 0.01, n=6)
            root = surf.ang(sd * 1.9, 0.72, 0.01)[0]
            out = Vector((sd, 0.25, 0)).normalized()
            path = [root, root + out * 0.04 + Vector((0, 0, 0.005)), root + out * 0.075 + Vector((0, 0.01, -0.07)),
                    root + out * 0.085 + Vector((0, 0.015, -0.18)), root + out * 0.065 + Vector((0, 0.01, -0.3))]
            # (a round bunch of hair: a string of soft lumps, thickest a little way down, tapering to its tip)
            for k in range(26):
                t = k / 25
                seg_i = min(3, int(t * 4))
                u = t * 4 - seg_i
                q = path[seg_i].lerp(path[seg_i + 1], u)
                r = 0.026 + 0.026 * math.sin(math.pi * min(1, t * 1.6)) * (1 - 0.7 * t) - 0.016 * t
                ellipsoid(bm, q, (r, r, r * 1.3), seg=12, rings=8)
        o = from_bm(f"{kind}.hair", bm, mats, HREF)
        rb = bmesh.new()
        for sd in (1, -1):
            root = surf.ang(sd * 1.9, 0.72, 0.03)[0]
            for k in (1, -1):
                ellipsoid(rb, root + Vector((0, k * 0.022, 0.012)), (0.008, 0.022, 0.014), mi=0, seg=12, rings=8)
            ellipsoid(rb, root, (0.012, 0.012, 0.012), mi=0, seg=10, rings=6)
        for f in rb.faces:
            f.smooth = True
        from_bm(f"{kind}.pin", rb, [MATS["Ribbon"]], HREF)
        return o

    bm = None
    if style == "regent":
        # a regent: the sides slicked flat back to a duck's tail, the front swept up and out in a great pompadour
        bm = cap(hd, surf, lambda y, p: p > (0.5 if abs(y) < 0.9 else 0.02 - 0.4 * smoothstep(1.8, 2.8, abs(y))),
                 off=0.004, thick=0.008)
        # (the pompadour, the 飛機頭: a thick sweep of hair rising from the crown and thrust straight out forward over
        # the brow like a bill, rounded off at its front, the comb's ridges running the length of it)
        def pomp(x, y, z):
            return HC + Vector((x, y, z))
        path = [pomp(0, 0.05, 0.11), pomp(0, -0.03, 0.14), pomp(0, -0.1, 0.143), pomp(0, -0.15, 0.125), pomp(0, -0.178, 0.098),
                pomp(0, -0.188, 0.075)]
        wide = [0.072, 0.084, 0.086, 0.08, 0.066, 0.04]
        thick = [0.028, 0.04, 0.044, 0.04, 0.032, 0.018]
        ups = [Vector((0, 0.2, 1)).normalized(), Vector((0, 0, 1)), Vector((0, -0.1, 1)).normalized(), Vector((0, -0.4, 1)).normalized(),
               Vector((0, -0.8, 1)).normalized(), Vector((0, -1, 0.6)).normalized()]
        loft(bm, path, wide, thick, ups, ring=12, tip=False)
        for i in range(5):
            x = (i - 2) * 0.026
            ridge = [pomp(x * 0.8, 0.03, 0.135), pomp(x, -0.03, 0.178), pomp(x, -0.1, 0.185), pomp(x * 0.95, -0.15, 0.163),
                     pomp(x * 0.8, -0.18, 0.128)]
            loft(bm, ridge, [0.005, 0.008, 0.008, 0.007, 0.004], [0.004] * 5, ups[:5], ring=6, tip=False)
        for sd in (1, -1):
            # (combed straight back over the ears, above them)
            for i in range(4):
                p0 = 0.5 - i * 0.12
                lock(bm, surf, [(sd * 1.05, p0), (sd * 1.8, p0 + 0.04), (sd * 2.6, p0 + 0.01), (sd * 3.0, p0 - 0.06)], 0.04,
                     0.008, [0.005, 0.007, 0.007, 0.009], ring=6)
        # the duck's tail at the back of the neck
        for sd in (1, -1):
            lock(bm, surf, [(math.pi - sd * 0.3, -0.2), (math.pi - sd * 0.08, -0.45), (math.pi, -0.6)], 0.06, 0.014,
                 [0.008, 0.02, 0.03], ring=6)
    elif style == "side":
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
        # (close enough that no scalp shows between them)
        for j in range(17):
            y0 = 0.85 + j * (2 * math.pi - 1.7) / 16
            hang(bm, surf, (y0, 0.25), 0.15 + 0.03 * abs(math.cos(y0)), 0.05, 0.018, 0.01, splay=-0.02)
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


def headwear(kind, hd, surf):
    """the staff's hats: the second chef's toque, the third's low white cap (和帽子), the stock keeper's work cap"""
    # the toque: a band round the head, a pleated tube up from it, a puffed top
    bm = bmesh.new()
    tube_ring(bm, surf.c + Vector((0, 0, HEAD_R * 0.42)), Vector((0, 0, 1)), HEAD_R * 1.02, (0.012, 0.035), mi=0, seg=32)
    ret = bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=HEAD_R * 0.95, radius2=HEAD_R * 1.1,
                                depth=HEAD_R * 0.75, matrix=Matrix.Translation(surf.c + Vector((0, 0, HEAD_R * 0.95))))
    for v in ret["verts"]:
        a = math.atan2(v.co.y - surf.c.y, v.co.x - surf.c.x)
        d = Vector((v.co.x - surf.c.x, v.co.y - surf.c.y, 0))
        v.co += d.normalized() * 0.004 * math.cos(a * 12)
    ellipsoid(bm, surf.c + Vector((0, 0, HEAD_R * 1.36)), (HEAD_R * 1.18, HEAD_R * 1.18, HEAD_R * 0.38), mi=0, seg=24, rings=12)
    for f in bm.faces:
        f.smooth = True
    from_bm(f"{kind}.toque", bm, [MATS["Toque"]], HREF)
    # the low white cap: a soft dome down to the brow, a seam round it
    bm = cap(hd, surf, lambda y, p: p > 0.36 - 0.08 * math.cos(y), off=0.022, thick=0.01)
    tube_ring(bm, surf.c + Vector((0, 0, HEAD_R * 0.36)), Vector((0, -0.05, 1)), HEAD_R * 1.1, (0.004, 0.006), mi=0, seg=32)
    from_bm(f"{kind}.wacap", bm, [MATS["Toque"]], HREF)
    # the work cap: a crown, a peak to the front, a button on top
    cb = bmesh.new()
    cb2 = cap(hd, surf, lambda y, p: p > 0.32 - 0.06 * math.cos(y), off=0.02, thick=0.01)
    cbm = bpy.data.meshes.new("tmp")
    cb2.to_mesh(cbm)
    cb2.free()
    cb.from_mesh(cbm)
    bpy.data.meshes.remove(cbm)
    brim = [surf.ang(-1.1 + i * 2.2 / 12, 0.34, 0.02)[0] for i in range(13)]
    rows = [[cb.verts.new(p) for p in brim],
            [cb.verts.new(p + (ang_dir(-1.1 + i * 2.2 / 12, 0) * 0.055 + Vector((0, 0, -0.012))) * (math.cos((-1.1 + i * 2.2 / 12) * 1.25) ** 0.6))
             for i, p in enumerate(brim)]]
    top_ = [cb.verts.new(v.co + Vector((0, 0, 0.006))) for v in rows[0]] + [cb.verts.new(v.co + Vector((0, 0, 0.006))) for v in rows[1]]
    for i in range(12):
        f = cb.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        f.material_index = 1
        f = cb.faces.new((top_[i], top_[13 + i], top_[13 + i + 1], top_[i + 1]))
        f.material_index = 1
    ellipsoid(cb, surf.c + Vector((0, 0, HEAD_R * 1.1 + 0.035)), (0.012, 0.012, 0.008), mi=1)
    for f in cb.faces:
        f.smooth = True
    from_bm(f"{kind}.workcap", cb, [MATS["Work"], MATS["WorkDark"]], HREF)


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


def skirt(kind, bd, top, hem, flare, pleats, mi_name="Bottom", front=None, grow=0.0):
    """a skirt (or the yukata's robe): a flared tube from top to hem, pleated if asked; with front (an angle), only
    the part of it that far round either side of the front (an apron), grown out a little to lie over the skirt"""
    bm = bmesh.new()
    rows = 8
    segs = 48
    rx0, ry0 = body_radius(bd, top)
    rows_v = []
    for i in range(rows + 1):
        t = i / rows
        z = top + (hem - top) * t
        rx, ry = body_radius(bd, max(z, 0.4))
        rx = max(rx, rx0 * 0.98) + 0.006 + flare * t ** 0.8 + (0.006 if kind == "officeLady" else 0) + grow
        ry = max(ry, ry0 * 0.98) + 0.006 + flare * 0.9 * t ** 0.8 + grow
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
            if front is not None:
                a = 2 * math.pi * (j + 0.5) / segs
                if min(a, 2 * math.pi - a) > front:
                    continue
            bm.faces.new((rows_v[i][j], rows_v[i][j1], rows_v[i + 1][j1], rows_v[i + 1][j]))
    if front is not None:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
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
        if kind in ("salaryman", "civilServant"):
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
    elif c == "tokko":
        # the tokkō coat's tall standing collar, and gold embroidery down both fronts and across the back
        b = bmesh.new()
        tube_ring(b, Vector((0, 0, 0.718)), Vector((0, 0, 1)), 0.04, (0.007, 0.03), mi=mi["Top"], seg=28)
        parts.append(b)
        for sd in (1, -1):
            parts.append(fr([(sd * 0.014, 0.664), (sd * 0.03, 0.664), (sd * 0.032, 0.48), (sd * 0.016, 0.48)], "Gold", 0.003, cuts=4))
        # (on the back, a gold-embroidered frame with the rising sun in it, its rays out to the frame)
        for x0, z0, x1, z1 in ((-0.055, 0.655, 0.055, 0.643), (-0.055, 0.507, 0.055, 0.495), (-0.055, 0.655, -0.043, 0.495),
                               (0.043, 0.655, 0.055, 0.495)):
            parts.append(bk([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], "Gold", 0.003, cuts=3))
        sun = Vector((0, 0.3, 0.575))
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            ux, uz = math.cos(a), math.sin(a)
            vx, vz = -uz, ux
            pts = [(ux * 0.022 + vx * 0.004, uz * 0.022 + vz * 0.004), (ux * 0.045 + vx * 0.012, uz * 0.06 + vz * 0.012),
                   (ux * 0.045 - vx * 0.012, uz * 0.06 - vz * 0.012), (ux * 0.022 - vx * 0.004, uz * 0.022 - vz * 0.004)]
            parts.append(bk([(sun.x + x, sun.z + z) for x, z in pts], "Gold", 0.0032, cuts=2))
        b = bmesh.new()
        ellipsoid(b, at(Vector((0, 0.3, 0.575)), B, 0.003)[0], (0.02, 0.004, 0.02), mi=mi["Ribbon"], seg=16, rings=6)
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
    if st["legs"] in ("long", "shorts") and not st.get("jacket") and kind != "chef":
        out.append(band(kind, bd, 0.47, 0.022, "Belt", "belt", extra=0.003))
        b = bmesh.new()
        ellipsoid(b, at(Vector((0, -0.3, 0.47)), F, 0.006)[0], (0.012, 0.004, 0.009), mi=mi["Buckle"], seg=10, rings=6)
        parts.append(b)
    if kind == "chef":
        # the samue's cloth tie at the waist, knotted at the side, its ends hanging (no belt, no buckle)
        out.append(band(kind, bd, 0.47, 0.014, "Top", "tie", extra=0.004))
        b = bmesh.new()
        kp = at(Vector((0.05, -0.3, 0.47)), F, 0.007)[0]
        ellipsoid(b, kp, (0.01, 0.006, 0.008), mi=mi["Top"], seg=10, rings=6)
        for dx in (-0.006, 0.006):
            loft(b, [kp, kp + Vector((dx, -0.004, -0.04))], [0.007, 0.005], [0.003, 0.003], [B, B], mi=mi["Top"], tip=False)
        parts.append(b)
    if st.get("jacket") and st["legs"] != "skirt" and st.get("coat"):
        # a long coat's skirts, down to the knee or more (a suit jacket's are painted on the round body: a flared hem stood out from it like a brim)
        hem = st.get("coat", 0.405)
        out.append(skirt(kind, bd, 0.475, hem, 0.012 + 0.13 * (0.405 - hem), 0, mi_name="Top"))
        out[-1].name = f"{kind}.hem"
    if st.get("staff"):
        def own(name, bms, mat_names):
            b = bmesh.new()
            for x in bms:
                me_ = bpy.data.meshes.new("tmp")
                x.to_mesh(me_)
                x.free()
                b.from_mesh(me_)
                bpy.data.meshes.remove(me_)
            o_ = from_bm(f"{kind}.{name}", b, [MATS[n] for n in mat_names], BREF)
            out.append(o_)
        # a cook's jacket: crossed over, two rows of buttons
        bb = [fr([(-0.04, 0.665), (-0.03, 0.672), (0.035, 0.56), (0.026, 0.55)], "Button", 0.0032, cuts=3)]
        for z in (0.6, 0.555, 0.51):
            for x in (-0.026, 0.026):
                b = bmesh.new()
                ellipsoid(b, at(Vector((x, -0.3, z)), F, 0.003)[0], (0.006, 0.004, 0.006), mi=mi["Button"], seg=10, rings=6)
                bb.append(b)
        own("buttons", bb, names)
        # the floor's red bow tie
        b = bmesh.new()
        p0 = at(Vector((0, -0.3, 0.676)), F, 0.006)[0]
        for sd in (1, -1):
            ellipsoid(b, p0 + Vector((sd * 0.014, 0, 0)), (0.014, 0.005, 0.009), mi=mi["Ribbon"], seg=10, rings=6,
                      rot=Matrix.Rotation(sd * 0.2, 3, "Y"))
        ellipsoid(b, p0, (0.006, 0.006, 0.007), mi=mi["Ribbon"], seg=8, rings=6)
        own("bowtie", [b], names)
        # the till's name badge
        own("badge", [fr([(0.03, 0.62), (0.058, 0.62), (0.058, 0.6), (0.03, 0.6)], "Shirt", 0.0055, cuts=1)], names)
        # and the till's red apron, its bib and its skirt
        out.append(skirt(kind, bd, 0.5, 0.3, 0.02, 0, mi_name="Ribbon", front=1.0, grow=0.01))
        out[-1].name = f"{kind}.apron"
        own("bib", [fr([(-0.05, 0.6), (0.05, 0.6), (0.055, 0.49), (-0.055, 0.49)], "Ribbon", 0.0045)], names)
    if st.get("lanyard"):
        # the staff pass on its lanyard: the cord round the neck and down, the card at the chest
        for sd in (1, -1):
            parts.append(fr([(sd * 0.026, 0.69), (sd * 0.034, 0.688), (sd * 0.006, 0.56), (sd * 0.0, 0.562)], "Navy", 0.006, cuts=4))
        parts.append(fr([(-0.022, 0.565), (0.022, 0.565), (0.022, 0.505), (-0.022, 0.505)], "Shirt", 0.0075, cuts=2))
        parts.append(fr([(-0.016, 0.556), (0.0, 0.556), (0.0, 0.528), (-0.016, 0.528)], "Navy", 0.0085, cuts=1))
    if st.get("backpack"):
        # a big trekking pack on the back, its lid and side pockets, the straps over the shoulders
        b = bmesh.new()
        bc = Vector((0, 0.12, 0.6))
        bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation(bc) @ Matrix.Diagonal((0.15, 0.085, 0.19, 1)))
        for f in b.faces:
            f.material_index = mi["Navy"]
        bmesh.ops.bevel(b, geom=b.edges[:], offset=0.025, segments=3, affect="EDGES")
        lid = bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation(bc + Vector((0, 0.005, 0.09))) @ Matrix.Diagonal((0.155, 0.09, 0.04, 1)))
        for v in lid["verts"]:
            for f in v.link_faces:
                f.material_index = mi["Strap"]
        for sd in (1, -1):
            pk = bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation(bc + Vector((sd * 0.08, 0.01, -0.04))) @ Matrix.Diagonal((0.025, 0.06, 0.08, 1)))
            for v in pk["verts"]:
                for f in v.link_faces:
                    f.material_index = mi["Strap"]
        parts.append(b)
        for sd in (1, -1):
            parts.append(fr([(sd * 0.03, 0.665), (sd * 0.055, 0.665), (sd * 0.06, 0.52), (sd * 0.04, 0.52)], "Strap", 0.003))
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
    if st.get("apron"):
        out.append(skirt(kind, bd, 0.48, 0.33, 0.05, 0, mi_name="Collar", front=1.05, grow=0.012))
        out[-1].name = f"{kind}.apron"
        # its bib over the chest, and the ribbon bow at the collar
        parts.append(fr([(-0.042, 0.62), (0.042, 0.62), (0.05, 0.48), (-0.05, 0.48)], "Collar", 0.004))
        rib = bmesh.new()
        p0 = at(Vector((0, -0.3, 0.675)), F, 0.006)[0]
        for sd in (1, -1):
            ellipsoid(rib, p0 + Vector((sd * 0.016, 0, 0.002)), (0.018, 0.006, 0.011), mi=mi["Ribbon"], seg=12, rings=8,
                      rot=Matrix.Rotation(sd * 0.3, 3, "Y"))
        ellipsoid(rib, p0, (0.007, 0.006, 0.008), mi=mi["Ribbon"], seg=10, rings=6)
        parts.append(rib)
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
        # (no sleeves' cuffs: there are no arms, only the floating hands)
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


def headphones(kind, surf):
    """big over-ear headphones (the student's, some of them): a band up over the crown clear of the hair, a padded
    red cup over each ear"""
    bm = bmesh.new()
    path, norms = [], []
    for yaw, pitch, off in [(1.5, -0.02, 0.036), (1.5, 0.35, 0.048), (1.5, 0.75, 0.056), (1.5, 1.15, 0.06), (0.0, 1.5707, 0.062),
                            (-1.5, 1.15, 0.06), (-1.5, 0.75, 0.056), (-1.5, 0.35, 0.048), (-1.5, -0.02, 0.036)]:
        pt = surf.ang(yaw, pitch, off)[0]
        path.append(pt)
        norms.append((pt - surf.c).normalized())
    loft(bm, path, [0.016] * len(path), [0.006] * len(path), norms, ring=8, mi=0, tip=False)
    for sd in (1, -1):
        c, n = surf.ang(sd * 1.5, -0.13, 0.032)
        rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
        ellipsoid(bm, c, (0.05, 0.05, 0.022), mi=1, seg=16, rings=8, rot=rot)
        tube_ring(bm, c - n * 0.012, n, 0.044, (0.009, 0.009), mi=0, seg=20)
    for f in bm.faces:
        f.smooth = True
    return from_bm(f"{kind}.phones", bm, [MATS["Lens"], MATS["PhoneRed"]], HREF)


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


def cut_under(bd, lo, hi, bones):
    """drop the body where a skirt or robe hides it (by its bones), so no leg pokes through the cloth as it moves"""
    bm = bmesh.new()
    bm.from_mesh(bd.data)
    dl = bm.verts.layers.deform.active
    names = {g.index: g.name for g in bd.vertex_groups}
    drop = []
    for v in bm.verts:
        if lo < v.co.z < hi:
            w = v[dl]
            tot = sum(w.values())
            if tot > 0 and sum(x for i, x in w.items() if names[i] in bones) / tot > 0.9:
                drop.append(v)
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    bm.to_mesh(bd.data)
    bm.free()


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
    st_ = STYLE[kind]
    styles = HAIRS[kind]
    hrs = []
    for style in styles:
        before = set(COL.objects)
        hrs.append(hair(kind, hd, surf, style))
        if len(styles) > 1:
            for o in set(COL.objects) - before:
                o.name = f"{o.name}_{style}"
    extra = clothes(kind, bd, hd, surf)
    gl = glasses(kind, surf)
    if kind == "student":
        gl = [gl, headphones(kind, surf)]
    else:
        gl = [gl]
    if st_.get("staff"):
        headwear(kind, hd, surf)
    if kind == "maid":
        # the headdress: a band of white frills over the crown, ear to ear
        hb = bmesh.new()
        for i in range(9):
            yy = -1.45 + i * 0.3625
            pc = surf.ang(yy, 0.95 - 0.25 * (yy / 1.45) ** 2, 0.03)[0]
            ellipsoid(hb, pc, (0.02, 0.012, 0.016), mi=0, seg=10, rings=6)
        lock(hb, surf, [(-1.5, 0.62), (-0.75, 0.9), (0, 1.0), (0.75, 0.9), (1.5, 0.62)], 0.03, 0.008,
             [0.024, 0.026, 0.026, 0.026, 0.024], mi=1, ring=6)
        for f in hb.faces:
            f.smooth = True
        from_bm(f"{kind}.band", hb, [MATS["Collar"], MATS["Button"]], HREF)
    # skin them all to the rig: the body by heat, the head and all on it rigidly, garments by their own rules
    auto_weights(bd, rig)
    # (the floating hands: a round mitten on each hand bone, a stub of a thumb toward the front, each held rigidly by its own bone)
    for s_, sd in (("L", 1), ("R", -1)):
        hb_ = bmesh.new()
        a_, b_ = BONE[f"hand.{s_}"]
        c_ = a_ + (b_ - a_) * 0.45
        ellipsoid(hb_, c_, (0.04, 0.034, 0.046), mi=0, seg=20, rings=12)
        ellipsoid(hb_, c_ + Vector((-sd * 0.012, -0.03, 0.012)), (0.015, 0.016, 0.019), mi=0, seg=12, rings=8)
        for f in hb_.faces:
            f.smooth = True
        hand_o = from_bm(f"{kind}.hand{s_}", hb_, [MATS["Skin"]], BREF)
        weights_rigid(hand_o, f"hand.{s_}")
        bind(hand_o, rig)
    for o in [hd, *hrs, *gl, *feats] + [x for x in COL.objects if x.name.startswith(f"{kind}.")
                                         and x.name.split(".")[1].split("_")[0] in ("hat", "band", "pin", "toque", "wacap", "workcap")]:
        if o.parent is None:
            weights_rigid(o, "head")
            bind(o, rig)
    for o in extra:
        part = o.name.split(".")[1]
        if part == "skirt" and kind == "officeLady":
            copy_weights(bd, o)
        elif part in ("skirt", "robe", "hem", "apron"):
            top = 0.48 if part == "robe" else 0.475
            weights_skirt(o, top, 0.1)
        elif part == "cuffs":
            weights_by_bones(o, allowed=[n for n in BONE if n.startswith(("upperarm", "forearm", "hand", "thigh", "shin", "foot"))])
        else:
            copy_weights(bd, o)
        bind(o, rig)
    # (the round body stays whole under a skirt or a robe: it's the skirt's shape, and nothing shows through)
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
    # (the hands a little turned in toward each other, the way hands rest on a table)
    reach(s, (sd * 0.085, -0.2 - forward, BAR_HAND), (sd, 0.2, -1), (-sd * 0.6, -0.8, -0.15))


def key_all(frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    rig.pose.bones["hips"].keyframe_insert("location", frame=frame)


# the standing and walking actions: the hips are brought down (or up) until the lower foot stands right on the floor, so no
# one's feet hover (the sole of a foot sits 0.017 under the lower end of its bone, standing flat)
GROUNDED = {"Walk", "WalkF", "WalkU", "WalkO", "Cook", "Stand", "Hold", "Carry", "Fetch"}


def plant():
    bpy.context.view_layer.update()
    low = min(min(rig.pose.bones[f"foot.{s}"].head.z, rig.pose.bones[f"foot.{s}"].tail.z) for s in ("L", "R"))
    hips = rig.pose.bones["hips"]
    move_hips(hips.head.z + (0.017 - low), hips.head.y)


def action(name, frames):
    """frames: [(frame, pose function)]"""
    ad = rig.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    for f, pose in frames:
        reset_pose()
        pose()
        if name in GROUNDED:
            plant()
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


# the rice bowl held up in the left hand while eating (Person3D draws it here)
BOWL = Vector((0.025, -0.21, 0.6))


def eat(phase):
    """the bowl held up in the left hand, the chopsticks in the right going from it (phase 0) up to the mouth (1)"""
    def pose():
        sit_base(lean=0.1 + 0.04 * phase)
        aim("head", (0, -0.06 - 0.08 * phase, 1))
        # (the left hand under the bowl, palm up, fingers round toward the middle)
        aim("clavicle.L", (1, -0.15, 0.06))
        reach("L", BOWL + Vector((0.045, 0.01, -0.045)), (1, 0.2, -1), (-1, -0.25, 0.2))
        aim("clavicle.R", (-1, -0.15, 0.06 + 0.1 * phase))
        # (the hand off to the right of the bowl, the chopsticks held low across toward it, tips just dipped in the
        # rice; then lifted to the mouth, still held crosswise, the tips at the lips: never stabbed straight down)
        dip = BOWL + Vector((-0.1, -0.01, 0.06))
        lifted = MOUTH + Vector((-0.13, -0.09, -0.05))
        w = dip.lerp(lifted, phase)
        # (aimed at the bowl, then at the mouth: the chopsticks reach just to the lips, the fist clear of the face)
        hand = Vector((0.1, -0.02, -0.05)).lerp(Vector((0.13, 0.09, 0.05)), phase)
        reach("R", w, (-1, 0.3, -0.8), hand)
    return pose


def walk(phase, style="man"):
    """one step: phase 0..1 over a stride of both feet. Each walks their own way: a man's easy stride; a woman's
    shorter steps, the feet set in toward one line, the hips turning, the arms kept closer in; the middle-aged
    uncle's heavier gait, leaning back a touch, the feet wide, the arms out; the old folk stooped forward, short
    shuffling steps on bent knees, the hands held behind the back"""
    a = math.sin(2 * math.pi * phase)
    c = math.cos(2 * math.pi * phase)
    # (roll: the round body rocking side to side onto the foot that's down, Overcooked's waddle; bob: up on each step, a bounce)
    st = {"man": dict(step=0.45, lean=-0.04, twist=0.06, wide=0.02, arm=0.5, out=0.3, knee=0.08, bob=0.02, roll=0.07),
          "woman": dict(step=0.32, lean=-0.02, twist=0.11, wide=-0.02, arm=0.32, out=0.16, knee=0.06, bob=0.016, roll=0.06),
          "uncle": dict(step=0.36, lean=0.05, twist=0.04, wide=0.07, arm=0.32, out=0.45, knee=0.06, bob=0.022, roll=0.1),
          "old": dict(step=0.22, lean=-0.32, twist=0.03, wide=0.04, arm=0.0, out=0.2, knee=0.3, bob=0.008, roll=0.04)}[style]

    def pose():
        z0 = 0.46 - 0.008 - (0.03 if style == "old" else 0) + st["bob"] * abs(c)
        move_hips(z0, 0)
        aim("spine", (st["roll"] * a, st["lean"], 1), twist=st["twist"] * a)
        aim("chest", (0, st["lean"] * 0.8 - 0.01, 1), twist=-st["twist"] * 1.4 * a)
        # (the old look up ahead from their stoop)
        aim("head", (0, 0.25 if style == "old" else 0.0, 1), twist=0.04 * a)
        for s, sd in (("L", 1), ("R", -1)):
            sw = a * sd
            aim(f"thigh.{s}", (sd * st["wide"], -st["step"] * sw - (0.12 if style == "old" else 0), -1))
            knee = max(0.0, -math.sin(2 * math.pi * phase + 0.6) * sd) * 0.9 * st["step"] / 0.45 + st["knee"]
            aim(f"shin.{s}", (0, -st["step"] * sw + knee, -1))
            aim(f"foot.{s}", (sd * 0.04, -1, -0.3 + max(0, sw) * 0.3))
            aim(f"clavicle.{s}", (sd, 0, 0.02))
            if style == "old":
                # (hands clasped behind, at the small of the back)
                aim(f"upperarm.{s}", (sd * 0.25, 0.55, -1))
                aim(f"forearm.{s}", (-sd * 0.6, 0.55, -0.15))
                aim(f"hand.{s}", (-sd * 0.8, 0.3, -0.2))
                continue
            aim(f"upperarm.{s}", (sd * st["out"], st["arm"] * sw, -1))
            aim(f"forearm.{s}", (sd * st["out"] * 0.8, st["arm"] * sw - 0.35 - max(0, -sw) * 0.4, -1))
            aim(f"hand.{s}", (sd * 0.12, st["arm"] * sw - 0.3, -1))
        # (the legs reach less far down the more they stride or bend, so the hips come down until the lower foot
        # stands on the ground: no one walks an inch above the floor)
        bpy.context.view_layer.update()
        low = min(min(rig.pose.bones[f"foot.{s}"].head.z, rig.pose.bones[f"foot.{s}"].tail.z) for s in ("L", "R"))
        move_hips(z0 + (0.017 - low), 0)
    return pose


action("Sit", [(0, sit(0)), (36, sit(0.025)), (72, sit(0))])
action("Eat", [(0, eat(0)), (14, eat(0.6)), (22, eat(1)), (32, eat(1)), (44, eat(0.4)), (56, eat(0)), (72, eat(0))])
action("Walk", [(i * 2, walk(i / 12)) for i in range(13)])
# (the others' strides take their own time: quick little steps, a heavier tread, a slow shuffle)
action("WalkF", [(i * 2, walk(i / 12, "woman")) for i in range(13)])
action("WalkU", [(round(i * 8 / 3), walk(i / 12, "uncle")) for i in range(13)])
action("WalkO", [(round(i * 10 / 3), walk(i / 12, "old")) for i in range(13)])


def cook(phase):
    """the cook at the fire, standing: the left hand fanning the coals with an uchiwa all along, the right turning a
    skewer low over them (the first half), then held up high shaking salt down (the second)"""
    a = math.sin(2 * math.pi * phase * 6)
    salt = smoothstep(0.42, 0.55, phase) * (1 - smoothstep(0.88, 0.98, phase))

    def pose():
        move_hips(0.455, 0)
        aim("spine", (0, -0.06, 1), twist=0.08 * math.sin(2 * math.pi * phase))
        aim("chest", (0, -0.1, 1))
        aim("neck", (0, -0.05, 1))
        aim("head", (0.06 * math.sin(2 * math.pi * phase * 2), -0.22 + 0.1 * salt, 1))
        for s, sd in (("L", 1), ("R", -1)):
            aim(f"thigh.{s}", (sd * 0.05, -0.02, -1))
            aim(f"shin.{s}", (0, 0.04, -1))
            aim(f"foot.{s}", (sd * 0.12, -1, -0.3))
        aim("clavicle.L", (1, -0.12, 0.03))
        reach("L", (0.17, -0.2, 0.55 + 0.012 * a), (1, 0.3, -1), (0.75 * a, -0.6, 0.35))
        aim("clavicle.R", (-1, -0.12, 0.03 + 0.12 * salt))
        low = Vector((-0.07, -0.27, 0.5 + 0.01 * math.sin(2 * math.pi * phase * 4)))
        high = Vector((-0.1, -0.2, 0.86 + 0.012 * math.sin(2 * math.pi * phase * 14)))
        turn = (0.35 * math.sin(2 * math.pi * phase * 3), -1, -0.35)
        reach("R", low.lerp(high, salt), (-1, 0.2, -0.6), Vector(turn).lerp(Vector((0.1, -0.35, -1)), salt))
    return pose


action("Cook", [(i * 4, cook(i / 24)) for i in range(25)])


def stand(breathe, hold=False):
    """standing by, for the staff on the floor: hands together in front (the till), or held out at the waist bearing
    something (a tray, a crate)"""
    def pose():
        move_hips(0.458, 0)
        aim("spine", (0, -0.02, 1))
        aim("chest", (0, -0.03, 1 + breathe))
        aim("head", (0, 0.02 - breathe, 1))
        for s, sd in (("L", 1), ("R", -1)):
            aim(f"thigh.{s}", (sd * 0.03, 0, -1))
            aim(f"shin.{s}", (0, 0.02, -1))
            aim(f"foot.{s}", (sd * 0.1, -1, -0.3))
            if hold:
                aim(f"clavicle.{s}", (sd, -0.1, 0.03))
                reach(s, (sd * 0.085, -0.17, 0.52), (sd, 0.3, -1), (-sd * 0.25, -0.9, 0.15))
            else:
                aim(f"clavicle.{s}", (sd, -0.05, 0))
                reach(s, (sd * 0.02, -0.1, 0.47), (sd, 0.5, -0.5), (-sd * 0.8, -0.3, -0.5))
    return pose


action("Stand", [(0, stand(0)), (40, stand(0.03)), (80, stand(0))])


def fetch(phase):
    """standing at the drinks fridge (2.25 s): the left hand takes the door's handle and pulls it open (the first part), the
    right reaches in to a shelf for a drink (the middle), draws it out to the chest while the left lets go (the last)"""
    L_rest, L_handle, L_pulled = Vector((0.1, -0.06, 0.42)), Vector((0.15, -0.28, 0.56)), Vector((0.13, -0.17, 0.52))
    R_rest, R_in, R_back = Vector((-0.07, -0.06, 0.42)), Vector((-0.05, -0.31, 0.61)), Vector((-0.04, -0.17, 0.5))
    wl = L_rest.lerp(L_handle, smoothstep(0.03, 0.2, phase)).lerp(L_pulled, smoothstep(0.22, 0.42, phase)).lerp(L_rest, smoothstep(0.66, 0.9, phase))
    wr = R_rest.lerp(R_in, smoothstep(0.3, 0.5, phase)).lerp(R_back, smoothstep(0.55, 0.8, phase))
    lean = 0.08 + 0.08 * smoothstep(0.3, 0.5, phase) * (1 - smoothstep(0.6, 0.85, phase))

    def pose():
        move_hips(0.452, 0)
        aim("spine", (0, -lean, 1), twist=0.05)
        aim("chest", (0, -lean * 1.2, 1), twist=0.08)
        aim("neck", (0, -0.05, 1))
        aim("head", (0, -0.14, 1))
        for s, sd in (("L", 1), ("R", -1)):
            aim(f"thigh.{s}", (sd * 0.06, -0.03 * (1 if s == "R" else 0), -1))
            aim(f"shin.{s}", (0, 0.03, -1))
            aim(f"foot.{s}", (sd * 0.12, -1, -0.3))
        aim("clavicle.L", (1, -0.14, 0.04))
        reach("L", wl, (1, 0.3, -1), (-0.1, -0.9, 0.2))
        aim("clavicle.R", (-1, -0.14, 0.04))
        reach("R", wr, (-1, 0.3, -1), (0.1, -0.9, 0.25))
    return pose


def phone(phase):
    """sat looking down at a phone held in both hands over the bar, the right thumb scrolling"""
    th = math.sin(2 * math.pi * phase * 3)
    def pose():
        sit_base(lean=0.16)
        aim("neck", (0, -0.12, 1))
        aim("head", (-0.08 + 0.03 * math.sin(2 * math.pi * phase), -0.5, 1))
        aim("clavicle.L", (1, -0.18, 0.04))
        aim("clavicle.R", (-1, -0.18, 0.04))
        # (held up at the chest, clear of the bar, its screen turned up to the face)
        # (held at the chest, clear of the bar, a little to the right so it shows past the head from behind, its
        # screen turned up to the face)
        reach("L", (-0.005, -0.23, 0.56), (1, 0.3, -1), (-0.5, -0.6, 0.6))
        reach("R", (-0.075, -0.22, 0.565 + 0.005 * th), (-1, 0.3, -1), (0.4 + 0.08 * th, -0.6, 0.6))
    return pose


def chin(phase):
    """sat leaning on the bar, the chin propped on the right hand, the left arm lying along the bar, gazing about"""
    b = math.sin(2 * math.pi * phase)
    def pose():
        sit_base(lean=0.2)
        aim("head", (0.06 * b, -0.02, 1), twist=0.12 * b)
        aim("clavicle.L", (1, -0.15, 0.04))
        reach("L", (0.06, -0.21, BAR_HAND), (1, 0.2, -1), (-0.8, -0.5, -0.1))
        aim("clavicle.R", (-1, -0.2, 0.1))
        reach("R", MOUTH + Vector((-0.02, -0.03, -0.105)), (-0.6, 0.0, -1), (0.2, -0.2, 1))
    return pose


def talk(side, phase):
    """sat turned toward the one beside them (side +1: on their left), talking: the head and shoulders round to them,
    nodding, a hand lifted now and then as they say something"""
    a = math.sin(2 * math.pi * phase * 2)
    g = smoothstep(0.3, 0.45, phase) * (1 - smoothstep(0.65, 0.8, phase))
    def pose():
        sit_base(lean=0.1)
        aim("spine", (0, -0.06, 1), twist=side * 0.18)
        aim("chest", (0, -0.08, 1), twist=side * 0.25)
        # (the head turned round to them about its own up, nodding a little; not tipped over sideways)
        aim("head", (0, -0.05 + 0.06 * a, 1), twist=side * 0.85)
        arms_on_bar("L", 1)
        if side > 0:
            aim("clavicle.R", (-1, -0.15, 0.04 + 0.08 * g))
            reach("R", Vector((-0.085, -0.2, BAR_HAND)).lerp(Vector((-0.03, -0.24, 0.6)), g), (-1, 0.2, -1),
                  Vector((0.6, -0.8, -0.15)).lerp(Vector((0.4, -0.5, 0.8)), g))
        else:
            arms_on_bar("R", -1)
            aim("clavicle.L", (1, -0.15, 0.04 + 0.08 * g))
            reach("L", Vector((0.085, -0.2, BAR_HAND)).lerp(Vector((0.03, -0.24, 0.6)), g), (1, 0.2, -1),
                  Vector((-0.6, -0.8, -0.15)).lerp(Vector((-0.4, -0.5, 0.8)), g))
    return pose


def carry(phase):
    """walking with something held level in both hands at the waist (a server bringing a plate): the legs stride as in
    walk, the body upright and steady, the arms held out still"""
    a = math.sin(2 * math.pi * phase)
    c = math.cos(2 * math.pi * phase)

    def pose():
        move_hips(0.46 - 0.008 + 0.012 * abs(c), 0)
        aim("spine", (0, -0.02, 1), twist=0.03 * a)
        aim("chest", (0, -0.03, 1), twist=-0.03 * a)
        aim("head", (0, 0.02, 1))
        for s_, sd in (("L", 1), ("R", -1)):
            sw = a * sd
            aim(f"thigh.{s_}", (sd * 0.02, -0.4 * sw, -1))
            knee = max(0.0, -math.sin(2 * math.pi * phase + 0.6) * sd) * 0.8 + 0.08
            aim(f"shin.{s_}", (0, -0.4 * sw + knee, -1))
            aim(f"foot.{s_}", (sd * 0.04, -1, -0.3 + max(0, sw) * 0.3))
            aim(f"clavicle.{s_}", (sd, -0.1, 0.03))
            reach(s_, (sd * 0.085, -0.17, 0.52 + 0.004 * c), (sd, 0.3, -1), (-sd * 0.25, -0.9, 0.15))
    return pose


action("Carry", [(i * 3, carry(i / 8)) for i in range(9)])
action("Phone", [(i * 6, phone(i / 12)) for i in range(13)])
action("Chin", [(i * 12, chin(i / 8)) for i in range(9)])
action("TalkL", [(i * 6, talk(1, i / 16)) for i in range(17)])
action("TalkR", [(i * 6, talk(-1, i / 16)) for i in range(17)])
action("Hold", [(0, stand(0, True)), (40, stand(0.03, True)), (80, stand(0, True))])
action("Fetch", [(i * 3, fetch(i / 18)) for i in range(19)])
reset_pose()

# =====================================================================
# Export
# =====================================================================

root = bpy.data.objects.new("Guests", None)
COL.objects.link(root)
rig.parent = root

# (light enough for a dozen at a time: the hair and the things on it, built up of many locks and lumps, are cut down
# to about BUDGET triangles each; seen this small, toon-shaded, nobody can tell)
BUDGET = {"hair": 1300, "pin": 300, "band": 400, "hat": 450, "toque": 450, "wacap": 400, "workcap": 400}
# (and the rest, for a web game: each part cut to a share of its triangles, the body and head to about half; flat-shaded in toon
# colours at this size, the silhouette is what shows, and it holds. Parts under SMALL triangles are left as they are.)
SHARE = {"body": 0.5, "head": 0.5, "eyes": 0.45, "eyesJoy": 0.45, "eyesShut": 0.6, "cuffs": 0.4, "glasses": 0.5, "hem": 0.5, "skirt": 0.5,
         "details": 0.5, "mouth": 0.6, "mouthJoy": 0.5, "mouthOpen": 0.5, "mouthMad": 0.6, "mouthSad": 0.6, "face": 0.6, "browsSad": 0.6,
         "robe": 0.6, "apron": 0.6, "belt": 0.6}
SMALL = 260
# (and a web game with a dozen of them at once, drawn small: every part cut to about a tenth of what it was built with, the hair to a few
# hundred, the body and head each to a few hundred; small parts (eyes, mouths) left alone)
# (cut too far (the hair to 130, the body to 560, the cuffs to 40) the parts came apart: hair in spikes, hems torn, the body cut coarser than the
# clothes over it and poking through them. So a middle way: about a quarter of what they were built with, the body kept finer than what's
# worn over it (so it stays inside), the little parts of the face left whole)
BUDGET = {k: max(160, v // 4) for k, v in BUDGET.items()}
BUDGET["hair"] = 1000
BUDGET.update({"body": 2200, "head": 900, "eyes": 160, "cuffs": 260, "details": 220, "face": 120})
SHARE = {k: min(1.0, v * 0.7) for k, v in SHARE.items()}
SHARE.update({"body": 1.0, "eyes": 1.0, "eyesJoy": 1.0, "eyesShut": 1.0, "mouth": 1.0, "mouthJoy": 1.0, "mouthOpen": 1.0, "mouthMad": 1.0, "mouthSad": 1.0,
              "browsSad": 1.0, "glasses": 0.8})
SMALL = 300
for o in list(COL.objects):
    if o.type != "MESH":
        continue
    part = o.name.split(".")[1].split("_")[0] if "." in o.name else ""
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    ratio = None
    if part in BUDGET and tris > BUDGET[part]:
        ratio = BUDGET[part] / tris
    elif part in SHARE and tris > SMALL:
        ratio = max(SHARE[part], SMALL / tris)
    elif tris > 600:
        ratio = max(0.35, 400 / tris)
    if ratio is not None:
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new("Lighter", "DECIMATE")
        m.ratio = ratio
        bpy.ops.object.modifier_move_to_index(modifier="Lighter", index=0)
        bpy.ops.object.modifier_apply(modifier="Lighter")

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJECT, "blender", "guests.blend"))
bpy.ops.object.select_all(action="DESELECT")
for o in COL.objects:
    o.select_set(True)
out = os.path.join(PROJECT, "public", "models", "guests.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=False,
                          export_animations=True, export_animation_mode="ACTIONS", export_skins=True,
                          export_def_bones=False, export_optimize_animation_size=True, export_force_sampling=True)
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
