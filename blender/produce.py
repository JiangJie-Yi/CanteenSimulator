"""The raw potatoes and sweet potatoes in their sacks (produce.glb, node "ProduceSacks"), after the photoscanned sack of potatoes the owner
pointed to (looked at, nothing taken from it): three burlap sacks standing upright against the kitchen side of the bar, full to the brim, what's
in them heaped up out of their mouths, the cloth's edge folded in over it, a seam with its flap down the front, soft creases round the upper
part where it's been gathered and let go, a slumped foot, the weave coarse and grimy (two of potatoes, one of sweet potatoes with a red band
woven round it); a few have rolled out onto the floor in front.

And the sack of binchotan (node "CharcoalSack") that stands on the floor by the cook table, its crate on the table filled from it: the same
sack in a darker cloth, a band of black stripes and a red stamp printed on it, the sticks standing up out of its mouth ("CharcoalStick0".."13":
the game shows as many as the sack has left).

The game's frame, in the room's units: y up, the sacks along x (about 1.1 across), their backs to -z, the middle of their foot at the
origin; the charcoal sack on its own, its foot's middle at the origin.

Run:
    blender -b --factory-startup --python blender/produce.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403
from tubers import potato, potato_skin, sweet_potato, sweet_potato_skin  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
seed(7)


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], np.float32)


bpy.ops.wm.read_factory_settings(use_empty=True)


def burlap(name, band=None, base=("#7a6648", "#c8b38a"), stripes=False):
    """burlap's coarse plain weave: thick threads over and under, uneven, flecked, a little hairy; grimier toward the foot and in the creases
    round its upper part (where v is 0.55, 0.7, 0.83 up it); `band` a colour woven round it near the top; `stripes` three black bands
    printed round it and a red stamp (the charcoal's)"""
    S = 1024
    u, v = grid01(S)
    f = 150
    wob = (fbm(S, 4, 4) - 0.5) * 0.35
    wx, wy = np.abs(np.sin(np.pi * (u * f + wob))), np.abs(np.sin(np.pi * (v * f + wob * 0.7)))
    over = (np.floor(u * f + wob) + np.floor(v * f + wob * 0.7)) % 2
    thread = np.where(over > 0, 0.3 + 0.7 * wx, 0.3 + 0.7 * wy)
    # (each thread's own shade: some darker, some paler, along their length)
    tone = np.where(over > 0, vnoise(S, 3, f), vnoise(S, f, 3))
    gaps = smooth(0.02, 0.32, np.minimum(wx, wy))
    n = fbm(S, 6, 6)
    fleck = smooth(0.62, 0.8, fbm(S, 24, 24))
    col = mix(lin(base[0]), lin(base[1]), np.clip(thread * 0.55 + n * 0.35 + (tone - 0.5) * 0.3, 0, 1))
    col = mix(col, lin("#3e2c18"), fleck * 0.25)
    col *= (0.7 + 0.3 * gaps)[..., None]
    # (grime: up from the foot, and settled in the creases; blotches here and there)
    blot = fbm(S, 3, 3)
    grime = smooth(0.2, 0.0, v) * 0.4 + smooth(0.62, 0.9, blot) * 0.16
    for c in (0.55, 0.7, 0.83):
        # (only here and there along each crease, as a fold traps it)
        grime = grime + smooth(0.025, 0.0, np.abs(v - c - (fbm(S, 6, 2) - 0.5) * 0.05)) * 0.22 * smooth(0.35, 0.7, fbm(S, 7, 3))
    col *= (1 - np.clip(grime, 0, 0.7))[..., None]
    if band is not None:
        b = smooth(0.0, 0.012, 0.03 - np.abs(v - 0.72)) * np.where(over > 0, 1.0, 0.75)
        col = mix(col, lin(band) * (0.75 + 0.25 * thread)[..., None], b)
    if stripes:
        # (printed, so a little broken where the weave's high: three black bands round it, and a red stamp on its front)
        ink = np.zeros_like(u)
        for c in (0.36, 0.42, 0.48):
            ink = np.maximum(ink, smooth(0.012, 0.004, np.abs(v - c)))
        sx, sy = (u - 0.25) * 4.0, (v - 0.62) * 4.6
        ring = smooth(0.05, 0.0, np.abs(np.sqrt(sx * sx + sy * sy) - 0.32)) + smooth(0.32, 0.26, np.sqrt(sx * sx + sy * sy)) * smooth(0.06, 0.0, np.abs(sx))
        col = mix(col, lin("#141210"), np.clip(ink, 0, 1) * (0.55 + 0.45 * thread) * 0.9)
        col = mix(col, lin("#b3261e"), np.clip(ring, 0, 1) * (0.5 + 0.5 * thread) * 0.85)
    return pbr(name, (1, 1, 1), tex=image(name, col), rough=0.95)


# (the potatoes' and sweet potatoes' own skins, as dug: blender/tubers.py)
POTATO_SKIN, SWEET_SKIN = potato_skin(512), sweet_potato_skin(512)
M = {
    "sackP": burlap("ProduceSackPotato"),
    "sackS": burlap("ProduceSackSweet", band="#b8322a"),
    # (the onions' sack: the same burlap with a green band woven round it)
    "sackO": burlap("ProduceSackOnion", band="#3f7a3a"),
    "potato": pbr("ProducePotato", (1, 1, 1), tex=image("produce_potato", POTATO_SKIN[0]), nrm=image("produce_potato_n", POTATO_SKIN[1], data=True), rough=0.85),
    "sweet": pbr("ProduceSweetPotato", (1, 1, 1), tex=image("produce_sweet", SWEET_SKIN[0]), nrm=image("produce_sweet_n", SWEET_SKIN[1], data=True), rough=0.55),
    "tie": pbr("ProduceTwine", tuple(lin("#a88a5a")), rough=0.9),
    "sackC": burlap("CharcoalSackCloth", base=("#4a3c2a", "#9a8460"), stripes=True),
    "inside": pbr("ProduceSackInside", tuple(lin("#2e2416")), rough=1.0),
    # (binchotan has a dull metallic sheen, near black)
    "coal": pbr("CharcoalSackStick", tuple(lin("#2a2a2e")), rough=0.45, metal=0.35),
}
parts = []


def mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def sack(name, cx, cz, h, r, mat, lean=(0.0, 0.0), seg=24, front=math.pi / 2, salt=0, inside=True):
    """a sack standing full, after the photoscan: a soft barrel from its slumped foot up to its mouth, shallow creases round the upper part
    where it was gathered (deeper on some sides than others), lumpy up top with what's in it; the cloth's edge at the mouth folded in over
    what's heaped there; a dark floor just inside, under what's heaped (no looking down into an empty sack); and a seam down the front (at
    angle `front`), a flap of the cloth standing proud of it. Cylindrical UVs, the weave running round it"""
    rnd = __import__("random").Random(salt + int(cx * 1000))
    ph = [rnd.uniform(0, 6.3) for _ in range(6)]
    # (heights up it: dense where the creases are, a fold at each)
    ts = [0.0, 0.04, 0.16, 0.32, 0.47, 0.53, 0.58, 0.67, 0.72, 0.8, 0.85, 0.92, 1.0]
    CREASES = ((0.555, 0.045), (0.705, 0.035), (0.835, 0.03))

    def radius(t, a):
        base = r * (0.9 + 0.1 * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.6)
        if t < 0.06:
            base *= 1.05 - 0.4 * (0.06 - t)            # (the foot slumped out under its weight, rounded under)
        for (tc, depth) in CREASES:
            d = (t - tc) / 0.022
            base -= r * depth * math.exp(-d * d) * (0.55 + 0.45 * math.sin(2 * a + ph[0] + tc * 9))
        # (what's inside pressing out, lumpy toward the top)
        base *= 1 + 0.035 * t * math.sin(3 * a + ph[1]) * math.cos(2 * a - ph[2] + t * 3)
        return base
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rows = []
    dx, dz = lean
    for k, t in enumerate(ts):
        y = h * t
        row = []
        for jn in range(seg):
            a = 2 * math.pi * jn / seg
            rr = radius(t, a) if t > 0 else radius(0.0, a) * 0.92
            row.append(bm.verts.new(P(cx + rr * math.cos(a) + dx * y, y, cz + rr * math.sin(a) + dz * y)))
        rows.append((row, t))
    # (the mouth: the cloth's edge rising a little, then folded in and down over what's heaped there)
    top_r = [radius(1.0, 2 * math.pi * jn / seg) for jn in range(seg)]
    for (rf, dy, tv) in ((0.97, 0.02, 1.04), (0.82, 0.026, 1.08), (0.7, 0.01, 1.12)):
        row = []
        for jn in range(seg):
            a = 2 * math.pi * jn / seg
            gather = 1 + 0.06 * math.sin(5 * a + ph[3]) * math.cos(2 * a + ph[4])
            rr = top_r[jn] * rf * gather
            y = h + dy * (0.8 + 0.4 * math.sin(3 * a + ph[5]) ** 2)
            row.append(bm.verts.new(P(cx + rr * math.cos(a) + dx * h, y, cz + rr * math.sin(a) + dz * h)))
        rows.append((row, tv))
    for k in range(len(rows) - 1):
        (r0, t0), (r1, t1) = rows[k], rows[k + 1]
        for jn in range(seg):
            j2 = (jn + 1) % seg
            f = bm.faces.new((r0[jn], r1[jn], r1[j2], r0[j2]))
            for loop, (jj, tt) in zip(f.loops, ((jn, t0), (jn, t1), (jn + 1, t1), (jn + 1, t0))):
                loop[uv].uv = (jj / seg * 2, tt * 1.4)
    # (its foot: closed across in a ladder facing down, not a fan into its middle)
    ladder_fill(bm, rows[0][0])
    o = mesh_object(name, bm, mat)
    # ---- the dark floor just inside the mouth, under what's heaped there (none where a heap fills it) ----
    bm = bmesh.new()
    if not inside:
        bm.free()
        return seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o)
    ring = [bm.verts.new(P(cx + top_r[jn] * 0.86 * math.cos(2 * math.pi * jn / seg) + dx * h, h - 0.012,
                           cz + top_r[jn] * 0.86 * math.sin(2 * math.pi * jn / seg) + dz * h)) for jn in range(seg)]
    bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        if fc.normal.z < 0:
            fc.normal_flip()
    mesh_object(name + "Inside", bm, "inside")
    return seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o)


def seam_of(name, cx, cz, h, r, mat, lean, front, ts, radius, ph, o):
    """the seam: a flap of the cloth standing proud down the front, from near the foot to the mouth"""
    dx, dz = lean
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    W, out = 0.012, 0.007
    strip = []
    for k, t in enumerate(ts):
        if t < 0.05:
            continue
        y = h * t
        a = front + 0.03 * math.sin(t * 7 + ph[0])
        rr = radius(t, a)
        nx, nz = math.cos(a), math.sin(a)
        tx, tz = -nz, nx
        base = Vector((cx + rr * nx + dx * y, y, cz + rr * nz + dz * y))
        lean_k = 0.5 + 0.5 * math.sin(t * 5 + ph[2])
        row = [bm.verts.new(P(*(base + Vector((tx * -W, 0, tz * -W)) - Vector((nx, 0, nz)) * 0.002))),
               bm.verts.new(P(*(base + Vector((tx * (W * 0.3), 0, tz * (W * 0.3))) + Vector((nx, 0, nz)) * out * (0.7 + 0.3 * lean_k)))),
               bm.verts.new(P(*(base + Vector((tx * W, 0, tz * W)) - Vector((nx, 0, nz)) * 0.002)))]
        strip.append((row, t))
    for k in range(len(strip) - 1):
        (a0, t0), (a1, t1) = strip[k], strip[k + 1]
        for i in range(2):
            f = bm.faces.new((a0[i], a0[i + 1], a1[i + 1], a1[i]))
            for loop, (ii, tt) in zip(f.loops, ((i, t0), (i + 1, t0), (i + 1, t1), (i, t1))):
                loop[uv].uv = (0.5 + ii * 0.02, tt)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh_object(name + "Seam", bm, mat)
    return o


# ---- the tubers, as the Ebisu and the lucky cats are made (the owner's): a clean, coarse grid of quads with what a detailed one looks like baked
# onto it. (The real tubers were too many triangles; a picture painted for the heap, and then a shell laid over it with the heap baked on,
# didn't look right: a heap of potatoes is its potatoes' outlines.) A few of each kind are made twice from one seed, at full detail and as a
# coarse grid (the same shape, unwrapped the same way); the detailed one's skin and shape are baked onto the coarse one's own cell of a shared
# picture (its colour, and a normal map, so the room's light shades it as if it were round and shows its eyes and creases), and every tuber
# in the heaps and on the floor is one of these, turned and sized its own way.
TUBER_CELL = 256
TEMPLATES = [("potato", 11), ("potato", 23), ("potato", 37), ("potato", 41), ("sweet", 5), ("sweet", 17), ("sweet", 29)]
POTATO_SIZE, SWEET_SIZE = 0.057, 0.05


def to_srgb(c):
    """linear light (as Cycles bakes it) to the sRGB an 8-bit picture holds (as the skins it was baked from were painted)"""
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055).astype(np.float32)


def tuber_pair(kind, seed_, k):
    """a tuber twice from one seed: at full detail, and as a coarse grid of quads (12 round and 8 from pole to pole, a potato; 10 round and 10
    along, a sweet potato: coarser and their outlines showed corners close up); set apart from the others while they're baked"""
    out = []
    for detail in (True, False):
        name = f"Tuber{kind}{seed_}{'Hi' if detail else ''}"
        if kind == "potato":
            o = potato(name, M["potato"], size=POTATO_SIZE * 2.1, seed=seed_, seg=28 if detail else 12, rings=18 if detail else 8)
        else:
            o = sweet_potato(name, M["sweet"], length=SWEET_SIZE * 4.3, girth=SWEET_SIZE * 1.8, bend=0.1, seed=seed_,
                             rings=28 if detail else 10, around=18 if detail else 10)
        o.location = (k * 0.5, 3.0, 0.0)
        out.append(o)
    return out


def bake_tubers():
    """each template's detailed twin baked onto it (Cycles, selected to active): its colour and its normal map, in its cell of one picture"""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    try:
        sc.cycles.use_denoising = False
    except AttributeError:
        pass
    W, H = TUBER_CELL * 4, TUBER_CELL * 2
    col_img = bpy.data.images.new("TuberBakeColour", W, H, float_buffer=True)
    nrm_img = bpy.data.images.new("TuberBakeNormal", W, H, float_buffer=True)
    nrm_img.colorspace_settings.name = "Non-Color"
    bake = bpy.data.materials.new("TuberBake")
    bake.use_nodes = True
    node = bake.node_tree.nodes.new("ShaderNodeTexImage")
    bake.node_tree.nodes.active = node
    lows = {}
    for k, (kind, seed_) in enumerate(TEMPLATES):
        hi, lo = tuber_pair(kind, seed_, k)
        cx, cy = k % 4, k // 4
        for d in lo.data.uv_layers.active.data:
            d.uv = ((cx + 0.03 + d.uv.x * 0.94) / 4, (cy + 0.03 + d.uv.y * 0.94) / 2)
        lo.data.materials.clear()
        lo.data.materials.append(bake)
        bpy.context.view_layer.update()
        for img, kind_, kw in ((col_img, "DIFFUSE", {"pass_filter": {"COLOR"}}), (nrm_img, "NORMAL", {"normal_space": "TANGENT"})):
            node.image = img
            bpy.ops.object.select_all(action="DESELECT")
            hi.select_set(True)
            lo.select_set(True)
            bpy.context.view_layer.objects.active = lo
            sc.cycles.samples = 4
            bpy.ops.object.bake(type=kind_, use_selected_to_active=True, cage_extrusion=0.005, max_ray_distance=0.02, margin=6,
                                margin_type="EXTEND", use_clear=(k == 0), **kw)
        me = hi.data
        bpy.data.objects.remove(hi, do_unlink=True)
        bpy.data.meshes.remove(me)
        lows[(kind, seed_)] = lo
    col = to_srgb(np.array(col_img.pixels[:], np.float32).reshape(H, W, 4)[..., :3])
    nrm = np.array(nrm_img.pixels[:], np.float32).reshape(H, W, 4)[..., :3].copy()
    if os.environ.get("TUBER_DEBUG"):
        for nm, img in (("col", col_img), ("nrm", nrm_img)):
            img.filepath_raw = os.path.join(os.environ["TUBER_DEBUG"], f"tuber_{nm}.png")
            img.file_format = "PNG"
            img.save()
    bpy.data.images.remove(col_img)
    bpy.data.images.remove(nrm_img)
    mat = pbr("ProduceTuber", (1, 1, 1), tex=image("produce_tuber", col), nrm=image("produce_tuber_n", nrm, data=True), rough=0.8)
    for lo in lows.values():
        lo.data.materials.clear()
        lo.data.materials.append(mat)
    bpy.data.materials.remove(bake)
    print("TUBER_TRIS", {f"{k}{s_}": sum(len(p.vertices) - 2 for p in lo.data.polygons) for (k, s_), lo in lows.items()})
    return lows


LOWS = bake_tubers()
PLACED = {"potato": 0, "sweet": 0}


def tuber(name, x, y, z, size, kind, rot=(0.0, 0.0, 0.0)):
    """a potato or a sweet potato: one of the baked ones (each kind's in turn), its middle at (x, y, z), `size` as the old round ones were (a
    potato about twice it long, a sweet potato about four times), turned by `rot`"""
    ts = [t for t in TEMPLATES if t[0] == kind]
    t = ts[PLACED[kind] % len(ts)]
    PLACED[kind] += 1
    o = bpy.data.objects.new(name, LOWS[t].data)
    bpy.context.collection.objects.link(o)
    o.location = P(x, y, z)
    o.rotation_euler = rot
    o.scale = [size / (POTATO_SIZE if kind == "potato" else SWEET_SIZE)] * 3
    parts.append(o)
    return o


# ---- onions, carrots, burdock (the owner's: the sacks hold potatoes, onions and sweet potatoes; carrots and burdock in a crate beside them)
def skin_picture(name, base, dark, streaks, lined=0.5, n=256):
    """a vegetable's skin, u round it and v along it: `base` to `dark` in soft patches, `streaks` fine lines along it"""
    u, v = grid01(n)
    col = mix(lin(base), lin(dark), smooth(0.35, 0.75, fbm(n, 4, 6)))
    lines = smooth(0.85, 1.0, np.abs(np.sin((u * streaks + (fbm(n, 2, 3) - 0.5) * 2.0) * np.pi)))
    col = mix(col, lin(dark) * 0.75, lines * lined)
    return image(name, col)


M["onion"] = pbr("ProduceOnion", (1, 1, 1), tex=skin_picture("produce_onion", "#e6bc74", "#c08a48", 12, 0.25), rough=0.55)
M["onion_root"] = pbr("ProduceOnionRoot", tuple(lin("#b89a70")), rough=0.9)
M["carrot"] = pbr("ProduceCarrot", (1, 1, 1), tex=skin_picture("produce_carrot", "#ec7f2c", "#c55a16", 10), rough=0.6)
M["carrot_leaf"] = pbr("ProduceCarrotLeaf", tuple(lin("#4f8a34")), rough=0.7)
M["gobo"] = pbr("ProduceGobo", (1, 1, 1), tex=skin_picture("produce_gobo", "#8a6a48", "#5e4428", 18), rough=0.85)
M["crate"] = pbr("ProduceCrate", tuple(lin("#b48a58")), rough=0.8)


def lathe_veg(name, prof, seg, mat):
    """a vegetable turned from `prof` [(radius, height)...] bottom to top, `seg` round, its ends closed (filled in rows on export, no fan to a
    centre point); u round it, v up it"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rows = [[bm.verts.new((r * math.cos(2 * math.pi * j / seg), r * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)] for r, z in prof]
    for k in range(len(rows) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            f = bm.faces.new((rows[k][j], rows[k][j2], rows[k + 1][j2], rows[k + 1][j]))
            for l, (uu, vv) in zip(f.loops, ((j, k), (j + 1, k), (j + 1, k + 1), (j, k + 1))):
                l[uvl].uv = (uu / seg, vv / (len(rows) - 1))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def onion(name, x, y, z, size, rot=(0.0, 0.0, 0.0)):
    """a yellow onion: a squat ball drawn up into a pointed neck, a flat root end with a short tuft; `size` its radius; 12 round"""
    rnd = __import__("random").Random(name)
    sq = 0.82 + 0.1 * rnd.random()
    prof = [(0.25, -0.86), (0.62, -0.78), (0.9, -0.5), (1.0, -0.1), (0.94, 0.3), (0.7, 0.62), (0.36, 0.86), (0.12, 1.08), (0.04, 1.3)]
    o = lathe_veg(name, [(r * size, h * size * sq) for r, h in prof], 12, "onion")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    root = lathe_veg(name + "Root", [(0.22 * size, -0.95 * size * sq), (0.26 * size, -0.86 * size * sq)], 8, "onion_root")
    root.parent = o
    return o


def carrot(name, x, y, z, length, rot):
    """a carrot: a long taper from its shoulder to a thin tip, 8 round; three stalks of its leaves cut short above the shoulder"""
    r = length * 0.12
    prof = [(0.06 * r, -length * 0.5)] + [(r * (0.25 + 0.75 * t ** 0.7), -length * 0.5 + length * t) for t in (0.2, 0.45, 0.7, 0.9)]
    prof += [(r * 0.9, length * 0.5), (r * 0.5, length * 0.53)]
    o = lathe_veg(name, prof, 8, "carrot")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    for k in range(3):
        a = 2 * math.pi * k / 3
        bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=r * 0.12, depth=length * 0.35,
                                            location=(math.cos(a) * r * 0.25, math.sin(a) * r * 0.25, length * 0.53 + length * 0.16),
                                            rotation=(math.cos(a) * 0.25, math.sin(a) * 0.25, 0))
        lf = active()
        lf.name = f"{name}Leaf{k}"
        lf.data.materials.append(M["carrot_leaf"])
        lf.parent = o
        parts.append(lf)
    return o


def gobo(name, x, y, z, length, rot):
    """a burdock root: long and thin, a little thicker at its top, 6 round"""
    r = 0.012
    o = lathe_veg(name, [(r * 0.35, -length / 2), (r * 0.8, -length / 4), (r, 0.0), (r * 1.1, length / 4), (r * 1.15, length / 2)], 6, "gobo")
    o.location = P(x, y, z)
    o.rotation_euler = rot
    return o


def board(name, cx, cy, cz, w, h, d):
    """one plank of the crate, its middle at (cx, cy, cz) in the game's frame, w along x, h up, d along z"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(cx, cy, cz))
    o = active()
    o.scale = (w, d, h)
    o.name = name
    o.data.materials.append(M["crate"])
    parts.append(o)
    return o


# ---- the three sacks, standing close together, leaning on each other a little ----
SACKS = [  # (x, z, height, radius, material, lean, what's in it)
    (-0.38, 0.0, 0.46, 0.17, "sackP", (0.03, 0.0), "potato"),
    (0.0, -0.03, 0.5, 0.18, "sackS", (0.0, 0.01), "sweet"),
    (0.37, 0.01, 0.42, 0.165, "sackO", (-0.04, 0.0), "onion"),
]
for i, (x, z, h, r, mat, lean, kind) in enumerate(SACKS):
    sack(f"ProduceSack{i}", x, z, h, r, mat, lean, front=math.pi / 2 + (i - 1) * 0.35, salt=i)
    # (what's in it, heaped up out of its mouth: a ring round the edge and more on top, as full as a sack can be)
    tx, tz = x + lean[0] * h, z + lean[1] * h
    if kind == "potato":
        ring_n = 6
        for k in range(ring_n):
            a = 2 * math.pi * k / ring_n + i
            rr = r * 0.52
            tuber(f"ProducePotato{i}{k}", tx + rr * math.cos(a), h + 0.012 + 0.006 * (k % 2), tz + rr * math.sin(a), 0.058, "potato",
                  rot=(k * 0.7, k * 1.3 + a, k * 0.4))
        for k, (dx_, dz_) in enumerate([(-0.035, -0.02), (0.04, -0.015), (0.0, 0.04)]):
            tuber(f"ProducePotatoTop{i}{k}", tx + dx_, h + 0.06, tz + dz_, 0.056, "potato", rot=(k * 1.1, k * 0.7, k * 0.9))
    elif kind == "onion":
        for k in range(6):
            a = 2 * math.pi * k / 6 + i
            onion(f"ProduceOnion{i}{k}", tx + r * 0.52 * math.cos(a), h + 0.02 + 0.006 * (k % 2), tz + r * 0.52 * math.sin(a), 0.045,
                  rot=(0.3 * math.cos(a), 0.3 * math.sin(a), k))
        for k, (dx_, dz_) in enumerate([(-0.03, -0.02), (0.035, 0.0), (0.0, 0.04)]):
            onion(f"ProduceOnionTop{i}{k}", tx + dx_, h + 0.07, tz + dz_, 0.044, rot=(0.2 * k, -0.15 * k, k))
    else:
        for k, (dx_, dz_, dy, a) in enumerate([(-0.06, -0.05, 0.0, 0.4), (0.07, 0.0, 0.012, -0.6), (-0.02, 0.08, 0.004, 1.2), (0.03, -0.02, 0.05, 0.1),
                                            (-0.07, 0.04, 0.03, 2.0)]):
            tuber(f"ProduceSweet{i}{k}", tx + dx_, h + 0.012 + dy, tz + dz_, 0.05, "sweet", rot=(0.0, 0.15 * k, a))
# ---- a few rolled out in front ----
tuber("ProduceLoose0", -0.2, 0.045, 0.27, 0.055, "potato", rot=(0.3, 0.2, 0.9))
# (a potato and an onion: the owner's)
onion("ProduceLooseOnion", 0.25, 0.038, 0.3, 0.044, rot=(1.4, 0.3, 0.6))
# ---- the crate of carrots and burdock, beside the onions' sack ----
CX, CW, CD, CH = 0.78, 0.38, 0.26, 0.18
board("ProduceCrateBottom", CX, 0.012, 0.0, CW, 0.024, CD)
for sd in (-1, 1):
    board(f"ProduceCrateSide{sd}", CX + sd * (CW / 2 - 0.01), CH / 2, 0.0, 0.02, CH, CD)
    for k, yy in enumerate((0.05, 0.13)):
        board(f"ProduceCrateSlat{sd}{k}", CX, yy, sd * (CD / 2 - 0.01), CW - 0.04, 0.06, 0.016)
# (the carrots lying across it, front to back, in two layers, their leaves to the back; the burdock leaning in its far end)
for k in range(7):
    layer = k // 4
    carrot(f"ProduceCarrot{k}", CX - 0.14 + (k % 4) * 0.045 + layer * 0.02, 0.13 + layer * 0.035, 0.0, 0.18,
           rot=(math.pi / 2 + 0.08 * (k % 3 - 1), 0.0, 0.12 * (k % 2) - 0.06))
for k in range(4):
    gobo(f"ProduceGobo{k}", CX + 0.09 + 0.012 * k, 0.17, -0.06 + 0.04 * k, 0.36, rot=(0.08 * (k - 1.5), 0.55, 0.0))
sack_parts = list(parts)
for lo in LOWS.values():
    bpy.data.objects.remove(lo, do_unlink=True)


def stick(name, x, y0, z, length, rad, tilt, spin):
    """a stick of binchotan standing up out of the sack: knobbly, a few flat facets and cracks, its top end cut"""
    bm = bmesh.new()
    segs, n = 6, 3
    rnd = __import__("random").Random(name)
    rows = []
    for k in range(n + 1):
        t = k / n
        row = []
        for jn in range(segs):
            a = 2 * math.pi * jn / segs
            rr = rad * (0.88 + 0.22 * rnd.random()) * (1 - 0.08 * t)
            row.append(bm.verts.new(Vector((rr * math.cos(a), rr * math.sin(a), length * t))))
        rows.append(row)
    for k in range(n):
        for jn in range(segs):
            j2 = (jn + 1) % segs
            bm.faces.new((rows[k][jn], rows[k][j2], rows[k + 1][j2], rows[k + 1][jn]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, "coal")
    for pg in o.data.polygons:
        pg.use_smooth = False
    o.location = P(x, y0, z)
    o.rotation_euler = (tilt[0], tilt[1], spin)
    return o


# ---- the sack of binchotan, on its own: the sticks standing up out of it ----
CH_H, CH_R = 0.5, 0.17
sack("CharcoalSackBody", 0.0, 0.0, CH_H, CH_R, "sackC", front=math.pi / 2, salt=9)
coal = []
rnd = __import__("random").Random(5)
for k in range(14):
    # (packed upright: an inner ring and an outer one, leaning out a little, their tops at different heights)
    ring_r = CH_R * (0.25 if k < 5 else 0.6)
    a = 2 * math.pi * (k if k < 5 else k - 5) / (5 if k < 5 else 9) + (0.3 if k >= 5 else 0)
    x, z = ring_r * math.cos(a), ring_r * math.sin(a)
    lean_ = 0.12 if k >= 5 else 0.05
    coal.append(stick(f"CharcoalStick{k}", x, CH_H - 0.16, z, 0.24 + 0.05 * rnd.random(), 0.016 + 0.004 * rnd.random(),
                      (-math.sin(a) * lean_, math.cos(a) * lean_), rnd.random() * 6))
charcoal_parts = [o for o in parts if o not in sack_parts]

# ---- under their roots ----
root = bpy.data.objects.new("ProduceSacks", None)
bpy.context.collection.objects.link(root)
for o in sack_parts:
    o.parent = root
croot = bpy.data.objects.new("CharcoalSack", None)
bpy.context.collection.objects.link(croot)
for o in charcoal_parts:
    o.parent = croot
croot.location = P(1.2, 0, 0)
top = bpy.data.objects.new("Produce", None)
bpy.context.collection.objects.link(top)
root.parent = top
croot.parent = top
print("PRODUCE_TRIS", sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons))
if PREVIEW:
    target = P(0.45, 0.25, 0)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(0.9, 1.1, 2.1)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    lt = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    lt.data.energy = 4
    bpy.context.collection.objects.link(lt)
    lt.location = P(1, 2, 1.5)
    lt.rotation_euler = (target - lt.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("PreviewWorld")
    world.color = (0.45, 0.43, 0.4)
    bpy.context.scene.world = world
export_dish(top, parts + [root, croot, top], os.path.join(PROJECT, "public", "models", "produce.glb"), os.path.join(PROJECT, "blender", "produce.blend"), PREVIEW)
print("PRODUCE_DONE")
