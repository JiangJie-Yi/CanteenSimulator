"""Generate a personal (small) hot pot on a retro cassette gas stove, with procedural textures.

The blue burner flames are animated in the web app (src/components/GasFlame.tsx);
this file only builds the solid parts: pot, ingredients and the stove.

Usage:
  blender -b --factory-startup --python blender/hotpot.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/hotpot.blend
  <project_dir>/public/models/hotpot.glb
"""
import math
import os
import random
import sys
import warnings

import bmesh
import bpy
import numpy as np
from mathutils import Vector

warnings.filterwarnings("ignore", category=DeprecationWarning)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(21)
rng = np.random.default_rng(11)

# Layout (Blender units, Z up)
POT_R = 0.75          # outer radius at the bottom
POT_H = 0.42
FLARE = 1.06
WALL = 0.03
FOOT_H = 0.09         # rubber feet under the stove
BODY_H = 0.3          # stove body thickness
Z0 = 0.417 + FOOT_H   # pot bottom, on short pot supports with a gap for the burner flames
BZ = Z0 + 0.30        # broth surface
INNER_R = POT_R * (1 + (FLARE - 1) * 0.30 / POT_H) - WALL


# =====================================================================
# Procedural textures (numpy -> packed images, exported into the .glb)
# =====================================================================

def vnoise(size, cx, cy):
    """Tileable value noise with cx x cy cells."""
    g = rng.random((cy, cx)).astype(np.float32)
    ux = np.arange(size) * cx / size
    uy = np.arange(size) * cy / size
    ix0, iy0 = ux.astype(int), uy.astype(int)
    fx, fy = ux - ix0, uy - iy0
    ix1, iy1 = (ix0 + 1) % cx, (iy0 + 1) % cy
    fx = (fx * fx * (3 - 2 * fx))[None, :]
    fy = (fy * fy * (3 - 2 * fy))[:, None]
    a, b = g[np.ix_(iy0, ix0)], g[np.ix_(iy0, ix1)]
    c, d = g[np.ix_(iy1, ix0)], g[np.ix_(iy1, ix1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(size, cx=4, cy=4, octaves=5):
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        mx, my = cx * 2 ** o, cy * 2 ** o
        if mx > size or my > size:
            break
        out += amp * vnoise(size, mx, my)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def mix(c1, c2, m):
    c1 = np.broadcast_to(np.asarray(c1, np.float32), m.shape + (3,)) if np.ndim(c1) == 1 else c1
    c2 = np.broadcast_to(np.asarray(c2, np.float32), m.shape + (3,)) if np.ndim(c2) == 1 else c2
    return c1 * (1 - m[..., None]) + c2 * m[..., None]


def to_normal(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-gx, -gy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def image(name, rgb, data=False):
    h, w = rgb.shape[:2]
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1), np.float32)], -1).astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=False)
    if data:
        img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = "PNG"
    img.pack()
    return img


def grid01(size):
    u = np.tile((np.arange(size) + 0.5) / size, (size, 1))
    return u, u.T.copy()   # u along columns, v along rows (row 0 = bottom)


TEX = {}

# --- spicy broth with chili-oil droplets ---
N = 512
base = mix((0.55, 0.07, 0.03), (0.70, 0.15, 0.05), fbm(N, 3, 3))
oil = np.zeros((N, N), np.float32)
height = np.zeros((N, N), np.float32)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
for _ in range(170):
    r = rng.uniform(2.5, 12)
    cx, cy = rng.uniform(0, N, 2)
    x0, x1 = int(max(0, cx - r - 2)), int(min(N, cx + r + 2))
    y0, y1 = int(max(0, cy - r - 2)), int(min(N, cy + r + 2))
    d = np.sqrt((xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2)
    m = np.clip((r - d) / 1.3, 0, 1)
    oil[y0:y1, x0:x1] = np.maximum(oil[y0:y1, x0:x1], m)
    height[y0:y1, x0:x1] = np.maximum(height[y0:y1, x0:x1], np.clip(1 - (d / r) ** 2, 0, 1) * min(1, r / 6))
col = mix(base, (0.98, 0.45, 0.08), oil * 0.85)
specks = (vnoise(N, 170, 170) > 0.93).astype(np.float32)
col = mix(col, (0.28, 0.03, 0.02), specks * 0.9)
TEX["broth"] = image("T_Broth", col)
TEX["broth_n"] = image("T_Broth_N", to_normal(height + fbm(N, 6, 6) * 0.25, 2.0), data=True)

# the web menu swaps the broth surface between three soup bases (src/menu.ts BROTHS); they share the
# droplet layout so the normal map fits all of them
tomato = mix(mix((0.78, 0.22, 0.08), (0.92, 0.38, 0.13), fbm(N, 3, 3)), (1.0, 0.62, 0.22), oil * 0.5)
kombu = mix(mix((0.86, 0.72, 0.45), (0.94, 0.83, 0.6), fbm(N, 3, 3)), (1.0, 0.92, 0.66), oil * 0.35)
kombu = mix(kombu, (0.28, 0.38, 0.16), (vnoise(N, 120, 120) > 0.965).astype(np.float32) * 0.8)
BROTH_VARIANTS = {"mala": col, "tomato": tomato, "kombu": kombu}

# --- marbled beef slice (u runs along the slice) ---
N = 512
u, v = grid01(N)
fat = np.maximum(1 - smooth(0.0, 0.035, np.abs(fbm(N, 3, 10) - 0.5)),
                 1 - smooth(0.0, 0.022, np.abs(fbm(N, 5, 16) - 0.5)))
fat = np.maximum(fat, smooth(0.13, 0.06, v))
meat = mix((0.60, 0.11, 0.12), (0.80, 0.26, 0.26), fbm(N, 8, 8))
TEX["beef"] = image("T_Beef", mix(meat, (0.97, 0.89, 0.85), fat * 0.9))
TEX["beef_n"] = image("T_Beef_N", to_normal(fat * 0.6 + fbm(N, 24, 24) * 0.3, 1.2), data=True)

# --- napa cabbage leaf (u: stem -> tip, v: across, rib at 0.5) ---
N = 512
u, v = grid01(N)
green = smooth(0.25, 0.9, u + (fbm(N, 4, 4) - 0.5) * 0.25)
leaf = mix((0.95, 0.95, 0.84), (0.55, 0.78, 0.30), green)
across = np.abs(v - 0.5)
rib_w = 0.13 * (1 - u) + 0.02
rib = smooth(rib_w, rib_w * 0.5, across)
vein = smooth(0.82, 1.0, np.cos((across * 1.2 - u * 0.5) * 2 * np.pi * 7)) * (across > rib_w)
TEX["cabbage"] = image("T_Cabbage", mix(leaf, (0.97, 0.97, 0.9), np.maximum(rib, vein * 0.55)))
TEX["cabbage_n"] = image("T_Cabbage_N", to_normal(rib + vein * 0.4 + fbm(N, 16, 16) * 0.2, 1.6), data=True)

# --- corn kernels (u: around, v: along) ---
N = 256
u, v = grid01(N)
fu, fv = (u * 16) % 1, (v * 7) % 1
ker = np.clip(1 - ((fu - 0.5) ** 2 + 1.4 * (fv - 0.5) ** 2) * 4.5, 0, 1) ** 0.5
TEX["corn"] = image("T_Corn", mix((0.72, 0.46, 0.06), (1.0, 0.80, 0.22), ker))
TEX["corn_n"] = image("T_Corn_N", to_normal(ker, 3.0), data=True)

# --- crab stick (u: around, v: along) ---
N = 256
u, v = grid01(N)
fib = vnoise(N, 128, 4)
red = smooth(0.25, 0.35, 0.5 + 0.5 * np.cos(2 * np.pi * u)) * (0.75 + 0.25 * fib)
TEX["crab"] = image("T_Crab", mix((0.97, 0.95, 0.9), (0.93, 0.26, 0.12), red))
TEX["crab_n"] = image("T_Crab_N", to_normal(fib * 0.4, 1.0), data=True)

# --- shrimp shell (u: along body, v: around) ---
N = 256
u, v = grid01(N)
stripes = 0.5 + 0.5 * np.cos(2 * np.pi * u * 9)
top = smooth(0.25, 0.75, 0.5 + 0.5 * np.sin(2 * np.pi * v))
TEX["shrimp"] = image("T_Shrimp", mix((0.98, 0.78, 0.62), (0.95, 0.36, 0.14), 0.35 + 0.65 * top * (0.7 + 0.3 * stripes)))
TEX["shrimp_n"] = image("T_Shrimp_N", to_normal(stripes * 0.5, 1.5), data=True)

# --- tofu / fried tofu / taro / meatball / fishball / shiitake ---
N = 256
TEX["tofu"] = image("T_Tofu", mix((0.96, 0.93, 0.81), (0.88, 0.84, 0.70), fbm(N, 32, 32) * 0.6))
TEX["tofu_n"] = image("T_Tofu_N", to_normal(fbm(N, 32, 32), 0.6), data=True)

TEX["fried"] = image("T_FriedTofu", mix((0.72, 0.42, 0.13), (0.92, 0.63, 0.26), fbm(N, 8, 8)))
TEX["fried_n"] = image("T_FriedTofu_N", to_normal(fbm(N, 24, 24), 3.0), data=True)

taro = mix((0.82, 0.77, 0.79), (0.72, 0.66, 0.72), fbm(N, 8, 8))
TEX["taro"] = image("T_Taro", mix(taro, (0.50, 0.36, 0.58), (vnoise(N, 64, 64) > 0.78).astype(np.float32) * 0.8))
TEX["taro_n"] = image("T_Taro_N", to_normal(fbm(N, 20, 20), 1.0), data=True)

mb = mix((0.55, 0.43, 0.33), (0.70, 0.58, 0.46), fbm(N, 8, 8))
TEX["meatball"] = image("T_Meatball", mix(mb, (0.33, 0.24, 0.19), (vnoise(N, 90, 90) > 0.88).astype(np.float32)))
TEX["meatball_n"] = image("T_Meatball_N", to_normal(fbm(N, 16, 16), 2.5), data=True)

TEX["fishball"] = image("T_Fishball", mix((0.98, 0.97, 0.94), (0.90, 0.88, 0.84), fbm(N, 6, 6) * 0.7))
TEX["fishball_n"] = image("T_Fishball_N", to_normal(fbm(N, 24, 24), 0.5), data=True)

crack = 1 - smooth(0.0, 0.025, np.abs(fbm(N, 5, 5) - 0.5))
cap = mix((0.30, 0.17, 0.08), (0.44, 0.27, 0.12), fbm(N, 6, 6))
TEX["shiitake"] = image("T_Shiitake", mix(cap, (0.80, 0.70, 0.55), crack * 0.8))
TEX["shiitake_n"] = image("T_Shiitake_N", to_normal(-crack + fbm(N, 16, 16) * 0.3, 2.0), data=True)

# --- brushed steel (streaks run around the pot) ---
N = 512
TEX["steel_n"] = image("T_Steel_N", to_normal(vnoise(N, 2, 256) * 0.6 + vnoise(N, 4, 128) * 0.4, 0.5), data=True)

# --- dirt ground (preview only) ---
N = 512
TEX["dirt"] = image("T_Dirt", mix((0.16, 0.11, 0.07), (0.30, 0.22, 0.15), fbm(N, 8, 8)))


# =====================================================================
# Materials
# =====================================================================

def pbr(name, color=(1, 1, 1), tex=None, nrm=None, nrm_strength=1.0, rough=0.5, metal=0.0,
        coat=0.0, coat_rough=0.05, emit=None, emit_strength=0.0, emit_tex=None):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    def setin(key, val):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = val

    setin("Base Color", (*color, 1))
    setin("Roughness", rough)
    setin("Metallic", metal)
    setin("Coat Weight", coat)
    setin("Coat Roughness", coat_rough)
    if emit:
        setin("Emission Color", (*emit, 1))
    if emit or emit_tex:
        setin("Emission Strength", emit_strength)
    if emit_tex:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = emit_tex
        nt.links.new(n.outputs["Color"], bsdf.inputs["Emission Color"])
    if tex:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = tex
        nt.links.new(n.outputs["Color"], bsdf.inputs["Base Color"])
    if nrm:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = nrm
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = nrm_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    m.diffuse_color = (*color, 1)
    return m


M = {
    "steel": pbr("BrushedSteel", (0.80, 0.80, 0.82), nrm=TEX["steel_n"], nrm_strength=0.5, rough=0.28, metal=1.0),
    "bakelite": pbr("Bakelite", (0.02, 0.02, 0.022), rough=0.35, coat=0.4),
    "enamel": pbr("StoveEnamel", (0.45, 0.72, 0.62), rough=0.35, coat=0.5),       # retro mint body
    "enamel_dark": pbr("StoveEnamelDark", (0.36, 0.6, 0.52), rough=0.35, coat=0.5),
    "plate": pbr("StovePlate", (0.12, 0.12, 0.13), rough=0.45, metal=0.3),
    "burner": pbr("Burner", (0.25, 0.25, 0.27), rough=0.5, metal=0.7),
    "knob_mark": pbr("KnobMark", (0.85, 0.2, 0.15), rough=0.4),
    "print": pbr("PanelPrint", (0.95, 0.95, 0.92), rough=0.5),
    "lcd": pbr("Display", (0.16, 0.2, 0.15), rough=0.2, coat=0.6),
    "broth": pbr("SpicyBroth", tex=TEX["broth"], nrm=TEX["broth_n"], nrm_strength=0.8, rough=0.16, coat=0.2,
                 coat_rough=0.1),
    "beef": pbr("Beef", tex=TEX["beef"], nrm=TEX["beef_n"], rough=0.45),
    "cabbage": pbr("NapaCabbage", tex=TEX["cabbage"], nrm=TEX["cabbage_n"], rough=0.4),
    "corn": pbr("Corn", tex=TEX["corn"], nrm=TEX["corn_n"], rough=0.35),
    "crab": pbr("CrabStick", tex=TEX["crab"], nrm=TEX["crab_n"], rough=0.4),
    "shrimp": pbr("Shrimp", tex=TEX["shrimp"], nrm=TEX["shrimp_n"], rough=0.3, coat=0.3),
    "tofu": pbr("Tofu", tex=TEX["tofu"], nrm=TEX["tofu_n"], rough=0.6),
    "fried": pbr("FriedTofu", tex=TEX["fried"], nrm=TEX["fried_n"], rough=0.55),
    "taro": pbr("Taro", tex=TEX["taro"], nrm=TEX["taro_n"], rough=0.6),
    "meatball": pbr("Meatball", tex=TEX["meatball"], nrm=TEX["meatball_n"], rough=0.65),
    "fishball": pbr("Fishball", tex=TEX["fishball"], nrm=TEX["fishball_n"], rough=0.45),
    "shiitake": pbr("ShiitakeCap", tex=TEX["shiitake"], nrm=TEX["shiitake_n"], rough=0.6),
    "stem": pbr("MushroomStem", (0.85, 0.78, 0.65), rough=0.6),
    "enoki": pbr("Enoki", (0.95, 0.92, 0.80), rough=0.5),
    "chili": pbr("DriedChili", (0.65, 0.03, 0.02), rough=0.3, coat=0.4),
    "pepper": pbr("SichuanPepper", (0.30, 0.07, 0.04), rough=0.8),
    "scallion": pbr("Scallion", (0.35, 0.70, 0.20), rough=0.35),
    "dirt": pbr("Dirt", tex=TEX["dirt"], rough=0.95),
}


# =====================================================================
# Mesh helpers
# =====================================================================

def active():
    return bpy.context.view_layer.objects.active


def finish(obj, name, mat, smooth_shade=True):
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = smooth_shade
    return obj


def bevel(obj, width, segments=3, angle=True):
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = width
    b.segments = segments
    if angle:
        b.limit_method = "ANGLE"
    return b


def apply_scale(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def cyl_uv(obj):
    """Cylindrical UVs around local Z (u = angle, v = height)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.verify()
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    for f in bm.faces:
        us = [(math.atan2(l.vert.co.y, l.vert.co.x) / (2 * math.pi)) % 1 for l in f.loops]
        if max(us) - min(us) > 0.5:
            us = [x + 1 if x < 0.5 else x for x in us]
        for l, x in zip(f.loops, us):
            l[uv].uv = (x, (l.vert.co.z - z0) / (z1 - z0 + 1e-6))
    bm.to_mesh(obj.data)
    bm.free()


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    return o


placed = []


def spot(size, sep=0.15, rmax=None):
    """Random (x, y) inside the pot, keeping distance from other items."""
    rmax = (rmax or INNER_R - 0.05) - size
    x = y = 0.0
    for _ in range(400):
        a = random.uniform(0, 2 * math.pi)
        r = math.sqrt(random.uniform(0, 1)) * rmax
        x, y = r * math.cos(a), r * math.sin(a)
        if all((x - px) ** 2 + (y - py) ** 2 > (sep + ps) ** 2 for px, py, ps in placed):
            break
    placed.append((x, y, size))
    return x, y


def scatter(rmax=INNER_R - 0.04):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * rmax
    return r * math.cos(a), r * math.sin(a)


# =====================================================================
# Retro cassette gas stove (the pot is centred on the burner, the knob faces -Y)
# =====================================================================

BODY_Y = -0.12     # body extends further toward the front for the knob
FRONT_Y = BODY_Y - 0.85
BODY_X0 = -1.05    # left end of the main body; the canister bay is bolted on beyond it
BAY_W = 0.5


def box(name, size, loc, mat, bev_width=0.0, segments=3, smooth_shade=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = active()
    o.scale = size
    apply_scale(o)
    if bev_width:
        bevel(o, bev_width, segments)
    return finish(o, name, mat, smooth_shade)


body_mid = FOOT_H + BODY_H / 2
box("StoveBody", (2.1, 1.7, BODY_H), (0, BODY_Y, body_mid), M["enamel"], 0.06, 4)
box("StovePlate", (1.94, 1.5, 0.014), (0, BODY_Y + 0.03, FOOT_H + BODY_H + 0.006), M["plate"], 0.006, 2)

# rubber feet at the corners (two more under the canister bay)
for fx in (-0.92, 0.92, BODY_X0 - BAY_W + 0.1):
    for fy in (BODY_Y - 0.7, BODY_Y + 0.7):
        # slightly tapered rubber foot, wider where it meets the body
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.05, radius2=0.07, depth=FOOT_H + 0.01,
                                        location=(fx, fy, (FOOT_H + 0.01) / 2))
        o = active()
        bevel(o, 0.01, 2)
        finish(o, "StoveFoot", M["bakelite"])

# canister housing on the left end (the gas can lies inside, along Y): a profile with a big rounded outer
# shoulder, extruded front to back, so the cover curves over the can the way real cassette stoves do
def canister_housing(x_in, x_out, z0, z1, depth, radius, name, mat):
    pts = [(x_in, z0), (x_out, z0)]
    # outer side rises, then a quarter arc over to the top
    for i in range(13):
        t = i / 12 * math.pi / 2
        pts.append((x_out + radius - radius * math.cos(t), z1 - radius + radius * math.sin(t)))
    pts.append((x_in, z1))
    bm = bmesh.new()
    y0, y1 = BODY_Y - depth / 2, BODY_Y + depth / 2
    front = [bm.verts.new((x, y0, z)) for x, z in pts]
    back = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bevel(o, 0.02, 3)
    finish(o, name, mat)
    # smooth the arc, keep the flat faces crisp
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    return o


HOUSING_OUT = BODY_X0 - BAY_W
canister_housing(BODY_X0 + 0.02, HOUSING_OUT, FOOT_H, FOOT_H + BODY_H, 1.62, 0.2, "CanisterHousing", M["enamel"])
# seam where the cover lifts off, running along the top of the curve
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.006, depth=1.62,
                                    location=(HOUSING_OUT + 0.2 - 0.2 * math.cos(math.radians(55)),
                                              BODY_Y, FOOT_H + BODY_H - 0.2 + 0.2 * math.sin(math.radians(55))),
                                    rotation=(math.radians(90), 0, 0))
finish(active(), "HousingSeam", M["enamel_dark"])
# canister lock lever on the front face of the housing
lever_x = HOUSING_OUT + 0.24
box("LockLeverBase", (0.12, 0.02, 0.12), (lever_x, BODY_Y - 0.81 - 0.01, body_mid), M["steel"], 0.01, 2)
box("LockLever", (0.03, 0.03, 0.15), (lever_x, BODY_Y - 0.81 - 0.035, body_mid + 0.02), M["bakelite"], 0.01, 2)
# vent slots along the housing's front
for i in range(5):
    box("Vent", (0.012, 0.012, 0.09), (HOUSING_OUT + 0.08 + i * 0.03, BODY_Y - 0.81 - 0.004, body_mid - 0.04),
        M["enamel_dark"], smooth_shade=False)


# ignition knob on the front-right
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.085, depth=0.06, location=(0.62, FRONT_Y - 0.03, body_mid),
                                    rotation=(math.radians(90), 0, 0))
o = active()
bevel(o, 0.012, 3)
finish(o, "Knob", M["bakelite"])
box("KnobMark", (0.018, 0.008, 0.07), (0.62, FRONT_Y - 0.062, body_mid + 0.02), M["knob_mark"], smooth_shade=False)

# heat scale printed around the knob: ticks over a 270° arc that grow from 小 (left) to 大 (right),
# matching the web app's knob rotation (src/components/StoveControls.tsx)
KNOB_X, KNOB_Z = 0.62, body_mid
for i in range(11):
    t = i / 10
    ang = math.radians(225 - 270 * t)          # 225° (lower left) clockwise to -45° (lower right)
    length = 0.014 + 0.022 * t
    r = 0.112 + length / 2
    box("KnobTick", (0.007, 0.004, length),
        (KNOB_X + r * math.cos(ang), FRONT_Y - 0.002, KNOB_Z + r * math.sin(ang)), M["print"], smooth_shade=False)
    active().rotation_euler = (0, -(ang - math.pi / 2), 0)

# LCD display panel left of the knob; the web app draws the live heat reading onto it
box("DisplayBezel", (0.3, 0.012, 0.13), (0.18, FRONT_Y - 0.006, body_mid), M["bakelite"], 0.01, 2)
box("Display", (0.26, 0.006, 0.09), (0.18, FRONT_Y - 0.014, body_mid), M["lcd"], smooth_shade=False)

# burner and its cap
plate_top = FOOT_H + BODY_H + 0.013
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.36, depth=0.035, location=(0, 0, plate_top + 0.0175))
o = active()
bevel(o, 0.008, 2)
finish(o, "Burner", M["burner"])
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.24, depth=0.02, location=(0, 0, plate_top + 0.045))
o = active()
bevel(o, 0.006, 2)
finish(o, "BurnerCap", M["plate"])

# four pot supports: short radial prongs tucked under the pot, just outside the burner flames
prong_h = Z0 - plate_top
for i in range(4):
    a = math.radians(45 + i * 90)
    r = 0.5
    bpy.ops.mesh.primitive_cube_add(size=1, location=(r * math.cos(a), r * math.sin(a), plate_top + prong_h / 2),
                                    rotation=(0, 0, a))
    o = active()
    o.scale = (0.14, 0.035, prong_h)
    apply_scale(o)
    bevel(o, 0.008, 2)
    finish(o, "PotSupport", M["steel"], smooth_shade=False)


# =====================================================================
# Pot
# =====================================================================

# lathed profile: flat centre, a generous rounded corner, then the flared wall up to the rim
CORNER = 0.17
profile = [(0.0, 0.0), (POT_R - CORNER, 0.0)]
for i in range(1, 9):
    t = i / 8 * math.pi / 2
    profile.append((POT_R - CORNER + CORNER * math.sin(t), CORNER - CORNER * math.cos(t)))
for i in range(1, 7):
    z = CORNER + (POT_H - CORNER) * i / 6
    profile.append((POT_R * (1 + (FLARE - 1) * z / POT_H), z))

bm = bmesh.new()
verts = [bm.verts.new((r, 0, Z0 + z)) for r, z in profile]
edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=2 * math.pi, steps=96,
               use_duplicate=False)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.normal_update()
# normals out, away from the axis
side = max(bm.faces, key=lambda f: f.calc_center_median().z)
c = side.calc_center_median()
if side.normal.dot(Vector((c.x, c.y, 0))) < 0:
    for f in bm.faces:
        f.normal_flip()
me = bpy.data.meshes.new("Pot")
bm.to_mesh(me)
bm.free()
pot = bpy.data.objects.new("Pot", me)
bpy.context.collection.objects.link(pot)
cyl_uv(pot)
s = pot.modifiers.new("Solidify", "SOLIDIFY")
s.thickness = WALL
s.offset = -1
finish(pot, "Pot", M["steel"])

bpy.ops.mesh.primitive_torus_add(major_radius=POT_R * FLARE - WALL / 2, minor_radius=0.022, major_segments=128,
                                 minor_segments=16, location=(0, 0, Z0 + POT_H))
finish(active(), "Rim", M["steel"])

# loop handles: a round bakelite grip bent into a U that comes out of the wall, curves around and goes back in,
# with a steel rivet plate where each end meets the pot
HANDLE_Z = Z0 + POT_H - 0.075
wall_r = POT_R * (1 + (FLARE - 1) * (HANDLE_Z - Z0) / POT_H)
for sx in (-1, 1):
    pts = [(wall_r - 0.01, -0.13), (wall_r + 0.1, -0.13), (wall_r + 0.19, -0.075), (wall_r + 0.205, 0.0),
           (wall_r + 0.19, 0.075), (wall_r + 0.1, 0.13), (wall_r - 0.01, 0.13)]
    cu = bpy.data.curves.new("HandleCurve", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.024
    cu.bevel_resolution = 4
    cu.resolution_u = 12
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y) in zip(sp.bezier_points, pts):
        bp.co = (sx * x, y, HANDLE_Z)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.use_endpoint_u = True
    ob = bpy.data.objects.new("Handle", cu)
    bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    finish(active(), "Handle", M["bakelite"])
    for py in (-0.13, 0.13):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.04, depth=0.02,
                                            location=(sx * (wall_r + 0.004), py, HANDLE_Z),
                                            rotation=(0, math.radians(90), 0))
        o = active()
        bevel(o, 0.006, 2)
        finish(o, "HandleRivet", M["steel"])


# =====================================================================
# Broth
# =====================================================================

bm = bmesh.new()
n = 96
c = bm.verts.new((0, 0, BZ))
ring = [bm.verts.new((INNER_R * math.cos(2 * math.pi * i / n), INNER_R * math.sin(2 * math.pi * i / n), BZ))
        for i in range(n)]
for i in range(n):
    bm.faces.new((c, ring[i], ring[(i + 1) % n]))
uv = bm.loops.layers.uv.new()
for f in bm.faces:
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / (2 * INNER_R) + 0.5, l.vert.co.y / (2 * INNER_R) + 0.5)
me = bpy.data.meshes.new("Broth")
bm.to_mesh(me)
bm.free()
broth = bpy.data.objects.new("Broth", me)
bpy.context.collection.objects.link(broth)
finish(broth, "Broth", M["broth"])


# =====================================================================
# Ingredients
# =====================================================================

def leaf(x, y, rot, length, width, mat, name, z=BZ + 0.006):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=18, y_subdivisions=10, size=1, location=(x, y, z),
                                    rotation=(0, 0, rot))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        t = vtx.co.x + 0.5
        w = 0.35 + 0.65 * math.sin(math.pi * min(1.0, t * 0.95 + 0.05))
        vtx.co.y *= w
        vtx.co.z = 0.012 * math.sin(t * 14) * math.sin(vtx.co.y * 20) * t - 0.05 * (2 * vtx.co.y) ** 2 + 0.01
        vtx.co.x *= length
        vtx.co.y *= width
    bm.to_mesh(o.data)
    bm.free()
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.006
    return finish(o, name, mat)


# napa cabbage bed around the edge
for i in range(4):
    a = i * math.pi / 2 + random.uniform(-0.3, 0.3)
    r = 0.38
    leaf(r * math.cos(a), r * math.sin(a), a + math.pi + random.uniform(-0.3, 0.3), 0.42, 0.26,
         M["cabbage"], "NapaCabbage")


def ball(mat, name, r=0.065):
    x, y = spot(r)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=16, location=(x, y, BZ + r * 0.25),
                                         rotation=(random.uniform(0, 3), random.uniform(0, 3), 0))
    finish(active(), name, mat)


def cube(mat, name, size, bev):
    x, y = spot(size * 0.7)
    bpy.ops.mesh.primitive_cube_add(size=size, location=(x, y, BZ + size * 0.25),
                                    rotation=(random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15),
                                              random.uniform(0, math.pi)))
    o = active()
    bevel(o, bev, 3, angle=False)
    finish(o, name, mat, smooth_shade=False)


def corn():
    x, y = spot(0.08)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.06, depth=0.11, location=(x, y, BZ + 0.025),
                                        rotation=(math.radians(90), 0, random.uniform(0, math.pi)))
    o = active()
    cyl_uv(o)
    bevel(o, 0.015, 3)
    finish(o, "Corn", M["corn"])


def crab():
    x, y = spot(0.1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.024, depth=0.2, location=(x, y, BZ + 0.012),
                                        rotation=(0, math.radians(90), random.uniform(0, math.pi)))
    o = active()
    cyl_uv(o)
    bevel(o, 0.006, 2)
    finish(o, "CrabStick", M["crab"])


def shrimp():
    x, y = spot(0.09)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.065, minor_radius=0.024, major_segments=32, minor_segments=12,
                                     location=(0, 0, 0))
    body = active()
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if abs(math.atan2(v.co.y, v.co.x)) < math.pi / 4],
                     context="VERTS")
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    bm.to_mesh(body.data)
    bm.free()
    finish(body, "Shrimp", M["shrimp"])
    ta = math.pi / 4
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.022, radius2=0.002, depth=0.05,
                                    location=(0.065 * math.cos(ta) + 0.018, 0.065 * math.sin(ta) - 0.012, 0),
                                    rotation=(math.radians(90), 0, ta - math.radians(90)))
    tail = active()
    tail.scale = (1, 0.45, 1)
    finish(tail, "ShrimpTail", M["shrimp"])
    o = join([body, tail], "Shrimp")
    o.location = (x, y, BZ + 0.012)
    o.rotation_euler = (0, 0, random.uniform(0, 2 * math.pi))


def shiitake():
    x, y = spot(0.075)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16, location=(x, y, BZ + 0.01),
                                         rotation=(random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), 0))
    capo = active()
    capo.scale = (0.075, 0.075, 0.035)
    finish(capo, "ShiitakeCap", M["shiitake"])


def enoki():
    x, y = spot(0.12)
    a = random.uniform(0, math.pi)
    parts = []
    for _ in range(22):
        off = random.uniform(-0.03, 0.03)
        fan = a + random.uniform(-0.15, 0.15)
        px, py = x - math.sin(a) * off, y + math.cos(a) * off
        z = BZ + 0.008 + random.uniform(0, 0.012)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.005, depth=0.22, location=(px, py, z),
                                            rotation=(0, math.radians(90), fan))
        parts.append(finish(active(), "EnokiStem", M["enoki"]))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.009, segments=8, ring_count=6,
                                             location=(px + math.cos(fan) * 0.11, py + math.sin(fan) * 0.11, z))
        parts.append(finish(active(), "EnokiCap", M["enoki"]))
    join(parts, "Enoki")


def beef():
    x, y = spot(0.1, sep=0.05)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=22, y_subdivisions=8, size=1, location=(x, y, BZ + 0.03),
                                    rotation=(0, 0, random.uniform(0, math.pi)))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    ph = random.uniform(0, math.pi)
    for vtx in bm.verts:
        vtx.co.z = 0.022 * math.sin(vtx.co.x * math.pi * 2.4 + ph) + 0.006 * math.sin(vtx.co.y * 9)
        vtx.co.x *= 0.30
        vtx.co.y *= 0.13
    bm.to_mesh(o.data)
    bm.free()
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.008
    finish(o, "BeefSlice", M["beef"])


corn()
for _ in range(2):
    cube(M["taro"], "Taro", 0.11, 0.012)
for _ in range(2):
    cube(M["tofu"], "Tofu", 0.12, 0.01)
for _ in range(2):
    cube(M["fried"], "FriedTofu", 0.12, 0.03)
for _ in range(3):
    ball(M["meatball"], "Meatball")
for _ in range(2):
    ball(M["fishball"], "Fishball")
for _ in range(2):
    crab()
for _ in range(2):
    shrimp()
for _ in range(2):
    shiitake()
enoki()
for _ in range(3):
    beef()

# garnish, joined per type to keep draw calls low
parts = []
for _ in range(8):
    x, y = scatter()
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.02, radius2=0.006, depth=0.12, location=(x, y, BZ + 0.01),
                                    rotation=(math.radians(90), 0, random.uniform(0, math.pi)))
    parts.append(finish(active(), "Chili", M["chili"]))
join(parts, "DriedChili")

parts = []
for _ in range(24):
    x, y = scatter()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=8, ring_count=6, location=(x, y, BZ + 0.004))
    parts.append(finish(active(), "Pepper", M["pepper"]))
join(parts, "SichuanPepper")

parts = []
for _ in range(26):
    x, y = scatter()
    bpy.ops.mesh.primitive_torus_add(major_radius=0.018, minor_radius=0.006, major_segments=14, minor_segments=6,
                                     location=(x, y, BZ + 0.006),
                                     rotation=(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), 0))
    parts.append(finish(active(), "Ring", M["scallion"]))
join(parts, "Scallion")


# =====================================================================
# Group under one root
# =====================================================================

root = bpy.data.objects.new("HotPot", None)
bpy.context.collection.objects.link(root)
hotpot_parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in hotpot_parts:
    o.parent = root


# =====================================================================
# Preview scene (ground, lights, camera are not exported)
# =====================================================================

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
finish(active(), "Ground", M["dirt"], smooth_shade=False)

world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
try:
    world.use_nodes = True
except AttributeError:
    pass
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.10, 0.11, 0.15, 1)   # dusk
bg.inputs["Strength"].default_value = 0.6


def light(name, kind, energy, loc, color=(1, 1, 1), size=1.0, target=(0, 0, 0.35)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(ob)


light("Burner", "POINT", 40, (0, 0, 0.26), color=(0.4, 0.6, 1.0))                  # gas flame glow
light("Key", "AREA", 350, (3.0, 0.8, 2.8), color=(1.0, 0.88, 0.75), size=2.0)    # warm key, side-lit
light("Fill", "AREA", 120, (-2.8, -1.2, 2.2), color=(0.65, 0.75, 1.0), size=3.0)  # cool dusk fill
light("Rim", "AREA", 300, (-1.2, 3.0, 2.0), color=(1.0, 0.95, 0.9), size=1.5)    # back light for edges

cam = bpy.data.cameras.new("Camera")
cam.lens = 38
cam_obj = bpy.data.objects.new("Camera", cam)
cam_obj.location = (0.4, -3.4, 2.5)
cam_obj.rotation_euler = (Vector((0, 0, 0.5)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj


# =====================================================================
# Outputs
# =====================================================================

scene = bpy.context.scene
models_dir = os.path.join(PROJECT, "public", "models")
blend_dir = os.path.join(PROJECT, "blender")
os.makedirs(models_dir, exist_ok=True)
os.makedirs(blend_dir, exist_ok=True)

if PREVIEW:
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    try:
        scene.view_settings.view_transform = "AgX"
        for look in ("AgX - Punchy", "Punchy"):
            try:
                scene.view_settings.look = look
                break
            except TypeError:
                continue
    except TypeError:
        pass
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 900
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in hotpot_parts:
    o.select_set(True)
glb = os.path.join(models_dir, "hotpot.glb")
try:
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                              export_image_format="WEBP")
except TypeError:
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, "hotpot.blend"))

# broth surfaces for the web menu's soup-base choice
tex_dir = os.path.join(PROJECT, "public", "textures")
os.makedirs(tex_dir, exist_ok=True)
for key, rgb in BROTH_VARIANTS.items():
    img = image(f"T_Broth_{key}", rgb)
    img.filepath_raw = os.path.join(tex_dir, f"broth-{key}.png")
    img.file_format = "PNG"
    img.save()
print("HOTPOT_DONE", len(hotpot_parts), "parts")
