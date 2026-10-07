"""Generate salt-grilled fish on skewers around a campfire ringed with stones.

Usage:
  blender -b --factory-startup --python blender/grilledfish.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/grilledfish.blend
  <project_dir>/public/models/grilledfish.glb

Flames, embers and the flicker light are animated in the web app (src/components/Fire.tsx).
Items that the web menu toggles are named by their menu id (src/menu.ts):
ExtraFish, GrilledCorn, GrilledShiitake, Onigiri, ShrimpSkewer, Sausage (skewers), Potato, SweetPotato (in the ash).
"""
import math
import os
import random
import sys
import warnings

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (active, apply_scale, bevel, cyl_uv, export_dish, fbm, finish, grid01, image, join,  # noqa: E402
                    leaf, mix, pbr, seed, smooth, to_normal, vnoise)

warnings.filterwarnings("ignore", category=DeprecationWarning)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
seed(44)

STONE_R = 0.9
STICK_FOOT_R = 0.7
STICK_TOP_R = 0.26
STICK_TOP_Z = 1.15


# =====================================================================
# Textures
# =====================================================================

TEX = {}

# log bark (u: around, v: along), partly charred
N = 512
ridges = vnoise(N, 48, 3) * 0.7 + vnoise(N, 96, 6) * 0.3
bark = mix((0.17, 0.10, 0.06), (0.36, 0.25, 0.15), ridges)
char = smooth(0.45, 0.7, fbm(N, 4, 4))
TEX["bark"] = image("T_Bark", mix(bark, (0.035, 0.03, 0.028), char * 0.9))
TEX["bark_n"] = image("T_Bark_N", to_normal(ridges, 4.0), data=True)

# glowing charcoal: dark lumps with hot cracks (emission map)
N = 256
cracks = 1 - smooth(0.0, 0.05, np.abs(fbm(N, 6, 6) - 0.5))
hot = np.clip(cracks + smooth(0.6, 0.9, fbm(N, 3, 3)) * 0.6, 0, 1)
TEX["ember"] = image("T_Ember", mix((0.05, 0.04, 0.035), (0.12, 0.08, 0.06), fbm(N, 16, 16)))
TEX["ember_e"] = image("T_Ember_E", mix((0, 0, 0), (1.0, 0.36, 0.06), hot))
TEX["ember_n"] = image("T_Ember_N", to_normal(-cracks + fbm(N, 16, 16) * 0.4, 2.5), data=True)

# stones
N = 256
stone = mix((0.33, 0.32, 0.30), (0.56, 0.54, 0.50), fbm(N, 6, 6))
TEX["stone"] = image("T_Stone", mix(stone, (0.2, 0.19, 0.18), (vnoise(N, 80, 80) > 0.85).astype(np.float32) * 0.7))
TEX["stone_n"] = image("T_Stone_N", to_normal(fbm(N, 12, 12), 2.5), data=True)

# fire-pit ground: sooty ash in the middle, packed dirt out past the stones, and an alpha edge that's
# wobbled by noise and fades out smoothly instead of ending in a hard circle
N = 512
u, v = grid01(N)
rad = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2       # 0 centre .. 1 disc edge
wobble = (fbm(N, 6, 6) - 0.5) * 0.18
dirt = mix((0.32, 0.23, 0.15), (0.45, 0.34, 0.23), fbm(N, 10, 10))
dirt = mix(dirt, (0.25, 0.18, 0.12), (vnoise(N, 90, 90) > 0.8).astype(np.float32) * 0.5)   # pebbles and grit
ash = mix((0.42, 0.40, 0.37), (0.12, 0.11, 0.10), np.clip(fbm(N, 8, 8) * 0.6 + (1 - rad / 0.5) * 0.6, 0, 1))
ground = mix(ash, dirt, smooth(0.36, 0.56, rad + wobble))
# a bed of coarse salt laid over the ash, thinning out toward the stones
salt_bed = (vnoise(N, 220, 220) > 0.55).astype(np.float32) * smooth(0.6, 0.45, rad + wobble * 0.5)
ground = mix(ground, (0.93, 0.92, 0.9), salt_bed * 0.85)
alpha = 1 - smooth(0.72, 0.98, rad + wobble)
TEX["pit"] = image("T_FirePit", ground, alpha=alpha)
TEX["pit_n"] = image("T_FirePit_N", to_normal(fbm(N, 24, 24), 1.5), data=True)

# ayu (sweetfish), salt-grilled. u: around the vertical axis (0 = head), v: belly (0) -> back (1)
N = 512
u, v = grid01(N)
back = smooth(0.45, 0.75, v + (fbm(N, 8, 4) - 0.5) * 0.1)
body = mix((0.93, 0.9, 0.82), (0.42, 0.44, 0.38), back)
# golden blush behind the gills, typical of ayu
gill = np.minimum(np.abs(u - 0.08), np.abs(u - 0.92))
body = mix(body, (0.92, 0.72, 0.3), smooth(0.08, 0.02, gill) * smooth(0.25, 0.5, v) * smooth(0.75, 0.55, v) * 0.8)
spots = (vnoise(N, 60, 30) > 0.82).astype(np.float32) * back
body = mix(body, (0.25, 0.25, 0.22), spots * 0.6)
# grill char: diagonal scorch bands and blistered skin
scorch = smooth(0.82, 0.95, 0.5 + 0.5 * np.sin((u * 14 + v * 3) * 2 * np.pi)) * smooth(0.6, 0.8, fbm(N, 6, 6) + 0.3)
body = mix(body, (0.2, 0.12, 0.06), scorch * 0.75)
TEX["fish"] = image("T_Ayu", body)
TEX["fish_n"] = image("T_Ayu_N", to_normal(vnoise(N, 120, 60) * 0.3 + scorch * 0.5, 1.5), data=True)

# Pacific saury (秋刀魚): steel-blue back, a crisp line onto a bright silver belly, blistered from the grill
back = smooth(0.52, 0.6, v + (fbm(N, 10, 4) - 0.5) * 0.04)
saury = mix((0.86, 0.87, 0.86), (0.2, 0.27, 0.38), back)
saury = mix(saury, (0.55, 0.6, 0.62), smooth(0.04, 0.0, np.abs(v - 0.56)) * 0.6)      # lateral line sheen
saury = mix(saury, (0.22, 0.13, 0.07), scorch * 0.7)
TEX["saury"] = image("T_Saury", saury)

# mackerel (鯖魚): blue-green back with dark wavy bars, silver-cream belly, grill-browned
back = smooth(0.48, 0.62, v)
waves = smooth(0.7, 0.85, 0.5 + 0.5 * np.sin((u * 26 + np.sin(v * 22) * 0.35) * 2 * np.pi)) * back
mackerel = mix((0.88, 0.86, 0.78), (0.24, 0.42, 0.44), back)
mackerel = mix(mackerel, (0.07, 0.1, 0.12), waves * 0.85)
mackerel = mix(mackerel, (0.3, 0.18, 0.08), scorch * 0.6)
TEX["mackerel"] = image("T_Mackerel", mackerel)

# coarse salt rubbed over every fish (塩焼き): white grains speckled all over the skin
salt_grains = (vnoise(N, 150, 75) > 0.8).astype(np.float32) * smooth(0.0, 0.3, fbm(N, 6, 6) + 0.2)
for key in ("fish", "saury", "mackerel"):
    img = TEX[key]
    px = np.array(img.pixels[:], np.float32).reshape(N, N, 4)[..., :3]
    TEX[key] = image(img.name + "_Salted", mix(px, (0.97, 0.97, 0.95), salt_grains * 0.85))

# binchotan: grey-white crust with fine lengthwise ridges and dark cracks
N = 256
u, v = grid01(N)
ridges = vnoise(N, 40, 4)
binchotan = mix((0.08, 0.075, 0.07), (0.22, 0.21, 0.2), ridges)    # mostly black, a little grey ash
binchotan = mix(binchotan, (0.08, 0.07, 0.07), smooth(0.03, 0.0, np.abs(fbm(N, 3, 8) - 0.5)))
TEX["binchotan"] = image("T_Binchotan", binchotan)

# grilled corn: kernels with charred patches
N = 256
u, v = grid01(N)
fu, fv = (u * 16) % 1, (v * 12) % 1
ker = np.clip(1 - ((fu - 0.5) ** 2 + 1.4 * (fv - 0.5) ** 2) * 4.5, 0, 1) ** 0.5
corn = mix((0.72, 0.46, 0.06), (1.0, 0.78, 0.2), ker)
burn = smooth(0.62, 0.8, fbm(N, 5, 5))
TEX["corn"] = image("T_GrilledCorn", mix(corn, (0.3, 0.16, 0.05), burn * ker * 0.8))
TEX["corn_n"] = image("T_GrilledCorn_N", to_normal(ker, 3.0), data=True)

# shiitake cap, grill-browned
N = 256
crack = 1 - smooth(0.0, 0.025, np.abs(fbm(N, 5, 5) - 0.5))
TEX["shiitake"] = image("T_GrilledShiitake", mix(mix((0.26, 0.15, 0.07), (0.4, 0.24, 0.1), fbm(N, 6, 6)),
                                                (0.78, 0.66, 0.5), crack * 0.8))

# yaki onigiri: soy-glazed rice with grains
N = 256
grains = vnoise(N, 90, 45)
rice = mix((0.72, 0.45, 0.2), (0.92, 0.72, 0.42), grains)
TEX["onigiri"] = image("T_Onigiri", mix(rice, (0.45, 0.22, 0.08), smooth(0.6, 0.85, fbm(N, 4, 4)) * 0.7))
TEX["onigiri_n"] = image("T_Onigiri_N", to_normal(grains, 2.5), data=True)

# Taiwanese sausage: glossy red with grill lines
N = 256
u, v = grid01(N)
lines = smooth(0.85, 0.95, 0.5 + 0.5 * np.sin(v * 2 * np.pi * 7))
TEX["sausage"] = image("T_Sausage", mix(mix((0.62, 0.14, 0.1), (0.78, 0.24, 0.16), fbm(N, 8, 8)), (0.28, 0.08, 0.04),
                                        lines * 0.8))

# potato and sweet potato roasting in the embers: skins with eyes / streaks and charred patches
N = 256
char = smooth(0.6, 0.78, fbm(N, 5, 5))
eyes = (vnoise(N, 14, 14) > 0.86).astype(np.float32)
potato = mix(mix((0.62, 0.45, 0.26), (0.76, 0.6, 0.38), fbm(N, 8, 8)), (0.35, 0.24, 0.13), eyes * 0.8)
TEX["potato"] = image("T_Potato", mix(potato, (0.12, 0.08, 0.05), char * 0.85))
TEX["potato_n"] = image("T_Potato_N", to_normal(fbm(N, 16, 16) * 0.5 - eyes * 0.5, 2.0), data=True)
streaks = vnoise(N, 64, 4)
sweet = mix((0.46, 0.14, 0.18), (0.62, 0.24, 0.26), streaks)
TEX["sweetpotato"] = image("T_SweetPotato", mix(sweet, (0.1, 0.05, 0.05), char * 0.85))
TEX["sweetpotato_n"] = image("T_SweetPotato_N", to_normal(streaks * 0.6, 2.0), data=True)

# shrimp shell (u: along body, v: around)
N = 256
u, v = grid01(N)
stripes = 0.5 + 0.5 * np.cos(2 * np.pi * u * 9)
top = smooth(0.25, 0.75, 0.5 + 0.5 * np.sin(2 * np.pi * v))
TEX["shrimp"] = image("T_Shrimp", mix((0.98, 0.78, 0.62), (0.95, 0.36, 0.14), 0.35 + 0.65 * top * (0.7 + 0.3 * stripes)))


# =====================================================================
# Materials
# =====================================================================

M = {
    "bark": pbr("Bark", tex=TEX["bark"], nrm=TEX["bark_n"], rough=0.85),
    "ember": pbr("Ember", tex=TEX["ember"], nrm=TEX["ember_n"], rough=0.9, emit_tex=TEX["ember_e"], emit_strength=6.0),
    "stone": pbr("Stone", tex=TEX["stone"], nrm=TEX["stone_n"], rough=0.8),
    "pit": pbr("FirePit", tex=TEX["pit"], nrm=TEX["pit_n"], rough=0.95, blend=True),
    "stick": pbr("BambooSkewer", (0.82, 0.68, 0.42), rough=0.6),
    "fish": pbr("Ayu", tex=TEX["fish"], nrm=TEX["fish_n"], rough=0.4, coat=0.3),
    "salt": pbr("SaltCrust", (0.97, 0.97, 0.95), rough=0.8),
    "saury": pbr("Saury", tex=TEX["saury"], nrm=TEX["fish_n"], rough=0.3, coat=0.4),
    "binchotan": pbr("Binchotan", tex=TEX["binchotan"], rough=0.9),
    "saury_fin": pbr("SauryFin", (0.32, 0.36, 0.42), rough=0.5),
    "mackerel": pbr("Mackerel", tex=TEX["mackerel"], nrm=TEX["fish_n"], rough=0.35, coat=0.4),
    "mackerel_fin": pbr("MackerelFin", (0.36, 0.42, 0.4), rough=0.5),
    "eye": pbr("FishEye", (0.95, 0.95, 0.9), rough=0.2),
    "pupil": pbr("FishPupil", (0.05, 0.05, 0.06), rough=0.2),
    "corn": pbr("GrilledCorn", tex=TEX["corn"], nrm=TEX["corn_n"], rough=0.4),
    "shiitake": pbr("GrilledShiitake", tex=TEX["shiitake"], rough=0.55),
    "stem": pbr("MushroomStem", (0.85, 0.78, 0.65), rough=0.6),
    "gills": pbr("MushroomGills", (0.9, 0.82, 0.66), rough=0.7),
    "husk": pbr("CornHusk", (0.74, 0.76, 0.42), rough=0.6),
    "onigiri": pbr("Onigiri", tex=TEX["onigiri"], nrm=TEX["onigiri_n"], rough=0.6),
    "nori": pbr("Nori", (0.06, 0.1, 0.07), rough=0.5),
    "sausage": pbr("Sausage", tex=TEX["sausage"], rough=0.3, coat=0.5),
    "potato": pbr("Potato", tex=TEX["potato"], nrm=TEX["potato_n"], rough=0.8),
    "sweetpotato": pbr("SweetPotato", tex=TEX["sweetpotato"], nrm=TEX["sweetpotato_n"], rough=0.7),
    "shrimp": pbr("Shrimp", tex=TEX["shrimp"], rough=0.3, coat=0.3),
    "dirt": pbr("Dirt", (0.3, 0.22, 0.15), rough=0.95),
}


# =====================================================================
# Fire pit: ash, logs, charcoal, stone ring
# =====================================================================

# ground disc reaching well past the stone ring; its texture fades the edge out (see T_FirePit)
PIT_R = 1.55
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=PIT_R, fill_type="TRIFAN", location=(0, 0, 0.004))
o = active()
bm = bmesh.new()
bm.from_mesh(o.data)
uv = bm.loops.layers.uv.verify()
for f in bm.faces:
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / (2 * PIT_R) + 0.5, l.vert.co.y / (2 * PIT_R) + 0.5)
bm.to_mesh(o.data)
bm.free()
finish(o, "FirePit", M["pit"], smooth_shade=False)

# binchotan (備長炭) charcoal fire, the Japanese way: long thin sticks of white charcoal heaped into a low mound,
# ash-grey on the outside and glowing through the cracks. Sizes and angles vary stick to stick.
sticks = []
for i in range(34):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * 0.36
    length = random.uniform(0.14, 0.34)
    radius = random.uniform(0.018, 0.034)
    lift = max(0.0, 0.12 * (1 - r / 0.4)) * random.uniform(0.4, 1.0)     # mounded in the middle
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=length,
                                        location=(r * math.cos(a), r * math.sin(a), radius + lift),
                                        rotation=(math.radians(90) + random.uniform(-0.35, 0.35), 0,
                                                  random.uniform(0, math.pi)))
    o = active()
    cyl_uv(o)
    bevel(o, 0.006, 1)
    # the ones down in the middle of the heap glow; the outer ones are grey white charcoal
    sticks.append(finish(o, "Binchotan", M["ember"] if r < 0.12 or random.random() < 0.15 else M["binchotan"],
                         smooth_shade=False))
join(sticks, "BinchotanHeap")

# coarse salt: grains strewn over the ash around the skewer feet, and a few little heaps of it
grains = []
for _ in range(1800):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0.1, 1.0)) * 0.86   # salt laid right across the ash bed
    s = random.uniform(0.006, 0.012)
    # lying flat on the ash (only spun about the vertical), a hair above it: a level, even crust of salt
    bpy.ops.mesh.primitive_cube_add(size=1, location=(r * math.cos(a), r * math.sin(a), 0.0065),
                                    rotation=(0, 0, random.uniform(0, math.pi)))
    o = active()
    o.scale = (s, s * random.uniform(0.7, 1.2), 0.003)
    grains.append(finish(o, "Grain", M["salt"], smooth_shade=False))
join(grains, "SaltGrains")


# a thick bed of glowing charcoal, heaped higher in the middle; joined into one mesh to keep draw calls low
coals = []
for _ in range(44):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * 0.44
    s = random.uniform(0.03, 0.075)
    heap = max(0.0, 0.08 * (1 - r / 0.44)) * random.uniform(0.3, 1.0)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1,
                                          location=(r * math.cos(a), r * math.sin(a), s * 0.45 + heap),
                                          rotation=(random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3)))
    o = active()
    o.scale = (s * random.uniform(0.8, 1.3), s * random.uniform(0.8, 1.3), s * random.uniform(0.6, 0.9))
    coals.append(finish(o, "Coal", M["ember"], smooth_shade=False))
join(coals, "Charcoal")

# a tight ring of mixed big and small stones: pick a half-width for each (along the ring, local Y),
# then space them by those widths so neighbours touch whatever their size
sizes = []
while sum(sizes) * 2 < 2 * math.pi * STONE_R:
    big = len(sizes) % 3 != 1 and random.random() < 0.7      # mostly big, with smaller ones tucked between
    sizes.append(random.uniform(0.16, 0.21) if big else random.uniform(0.09, 0.12))
fit = 2 * math.pi * STONE_R / (sum(sizes) * 2) * 1.04          # scale to close the ring, with slight overlap
a = 0.0
for i, half in enumerate(sizes):
    half *= fit
    a += half / STONE_R
    k = half / 0.18                                             # overall size relative to a typical stone
    # stagger in and out of the ring a little so it doesn't look laid with a compass
    r = STONE_R + (0.045 if i % 2 else -0.03) + random.uniform(-0.025, 0.025) + (1 - k) * 0.03
    # river-stone ovals: long along the ring, narrower across it, and fairly flat
    sx, sy, sz = half * random.uniform(0.5, 0.9), half, half * random.uniform(0.45, 0.7)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12,
                                         location=(r * math.cos(a), r * math.sin(a), sz * 0.55),
                                         rotation=(random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08),
                                                   a + random.uniform(-0.18, 0.18)))
    a += half / STONE_R
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        vtx.co *= random.uniform(0.97, 1.03)   # just enough to break the perfect ellipse
        if vtx.co.z < 0:
            vtx.co.z *= 0.6                    # flatter underneath, so it sits on the ground
    bm.to_mesh(o.data)
    bm.free()
    o.scale = (sx, sy, sz)
    finish(o, "Stone", M["stone"])


# =====================================================================
# Skewers: each one is planted just inside the stones and leans over the fire.
# Items are modelled along local +X (the skewer axis), then placed on the stick.
# =====================================================================

def stick_frame(angle_deg, along, var=(0.0, 0.0, 0.0)):
    """Matrix for a point `along` (0 = foot, 1 = tip) on the skewer at this angle.
    Local X runs up the stick, local Y points out of the fire circle, local Z completes the frame.
    `var` = (tip radius offset, tip height offset, sideways lean in radians) so no two sticks are planted alike."""
    a = math.radians(angle_deg)
    dr, dz, lean = var
    foot = Vector((STICK_FOOT_R * math.cos(a), STICK_FOOT_R * math.sin(a), 0.0))
    tip = Vector(((STICK_TOP_R + dr) * math.cos(a + lean), (STICK_TOP_R + dr) * math.sin(a + lean), STICK_TOP_Z + dz))
    x = (tip - foot).normalized()
    out = Vector((math.cos(a), math.sin(a), 0))
    y = (out - x * out.dot(x)).normalized()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = foot.lerp(tip, along)
    return m, foot, tip


def skewer_stick(angle_deg, name, var=(0.0, 0.0, 0.0), extra=0.0):
    """The bamboo stick; `extra` lengthens it past the tip (sticks come long and short)."""
    _, foot, tip = stick_frame(angle_deg, 0, var)
    d = tip - foot
    length = d.length + 0.08 + extra
    centre = foot + d.normalized() * (length / 2 - 0.08)
    rot = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.012, depth=length, location=centre)
    shaft = active()
    shaft.rotation_euler = rot
    finish(shaft, name, M["stick"])
    # sharpened point continuing past the top of the shaft
    point_len = 0.07
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.012, radius2=0.0, depth=point_len,
                                    location=centre + d.normalized() * (length / 2 + point_len / 2))
    point = active()
    point.rotation_euler = rot
    finish(point, name + "Point", M["stick"])
    return join([shaft, point], name)


def place(objs, angle_deg, along, name, stick=True):
    """Join the parts, move them onto the skewer and (optionally) add the stick into the same object."""
    o = join(objs, name)
    # each skewer is pushed into the ash a little differently: leaning, higher or lower, longer or shorter
    var = (random.uniform(-0.05, 0.05), random.uniform(-0.12, 0.08), random.uniform(-0.12, 0.12))
    m, _, _ = stick_frame(angle_deg, along, var)
    o.matrix_world = m @ o.matrix_world
    if stick:
        # joined into the item, which keeps its origin on the stick so the web pop-in scales from there
        o = join([o, skewer_stick(angle_deg, name + "Stick", var, random.uniform(-0.05, 0.3))], name)
    return o


def flat_fin(name, outline, thickness, mat, at=(0, 0, 0)):
    """A thin fin from a 2D outline in the fish's X/Z plane (X along the body, Z up), lightly thickened in Y,
    with ray grooves suggested by the edge being slightly scalloped."""
    bm = bmesh.new()
    verts = [bm.verts.new((at[0] + x, at[1], at[2] + z)) for x, z in outline]
    face = bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=[face], quad_method="BEAUTY", ngon_method="EAR_CLIP")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = thickness
    s.offset = 0
    return finish(o, name, mat, smooth_shade=False)


def forked_tail(length, height, peduncle):
    """Outline of a forked (swallow) tail, starting at the body at x=0 and spreading back to -length:
    narrow at the root, two pointed lobes, and a V notch between them — the arrow-like tail of real fish."""
    pts = [(0.0, peduncle)]
    # upper edge sweeping out to the upper lobe tip
    for t in (0.35, 0.7):
        pts.append((-length * t, peduncle + (height - peduncle) * t ** 1.4))
    pts.append((-length, height))                      # upper tip
    pts.append((-length * 0.86, height * 0.55))        # trailing edge curving in…
    pts.append((-length * 0.62, height * 0.12))
    pts.append((-length * 0.58, 0.0))                  # …to the notch
    pts.append((-length * 0.62, -height * 0.12))
    pts.append((-length * 0.86, -height * 0.55))
    pts.append((-length, -height))                     # lower tip
    for t in (0.7, 0.35):
        pts.append((-length * t, -peduncle - (height - peduncle) * t ** 1.4))
    pts.append((0.0, -peduncle))
    return pts


# body proportions per species: half-length, half-width, half-depth, how pointed the snout is, tail size
SPECIES = {
    "ayu": dict(length=0.3, width=0.055, depth=0.085, snout=0.6, tail=(0.12, 0.085), body="fish", fin="salt"),
    "saury": dict(length=0.42, width=0.032, depth=0.05, snout=1.2, tail=(0.09, 0.06), body="saury", fin="salt"),
    "mackerel": dict(length=0.34, width=0.06, depth=0.08, snout=0.8, tail=(0.12, 0.09), body="mackerel", fin="salt"),
}


def fish(species="ayu"):
    """A grilled fish along local X (head at +X), curved like it's swimming up the skewer."""
    sp = SPECIES[species]
    L, W, D = sp["length"], sp["width"], sp["depth"]
    bend = lambda x: 0.035 * math.sin(x * 9 * 0.3 / L)   # noqa: E731  same S-curve whatever the length
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=1, calc_uvs=True)
    for vtx in bm.verts:
        x = vtx.co.x
        taper = 1 + min(0, x) * 0.82                       # narrowing into the tail root (-X)
        head = 1 - max(0, x - 0.55) * sp["snout"]          # snout: pointed for saury, blunter for ayu
        vtx.co.y *= W * taper * head
        vtx.co.z *= D * taper * head
        vtx.co.x *= L
        vtx.co.y += bend(vtx.co.x)
    me = bpy.data.meshes.new("FishBody")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("FishBody", me)
    bpy.context.collection.objects.link(body)
    finish(body, "FishBody", M[sp["body"]])
    parts = [body]

    # forked tail, rooted just inside the narrow end of the body
    tail_len, tail_h = sp["tail"]
    root_x = -L * 0.93
    parts.append(flat_fin("TailFin", forked_tail(tail_len, tail_h, D * 0.16), 0.006, M[sp["fin"]],
                          at=(root_x, bend(root_x), 0)))

    # dorsal fin: a low swept-back sail; a small anal fin underneath
    dx = L * 0.05
    parts.append(flat_fin("DorsalFin", [(dx + L * 0.12, 0), (dx + L * 0.02, D * 0.75), (dx - L * 0.12, D * 0.55),
                                        (dx - L * 0.2, 0)], 0.005, M[sp["fin"]], at=(0, bend(dx), D * 0.82)))
    ax = -L * 0.45
    parts.append(flat_fin("AnalFin", [(ax + L * 0.1, 0), (ax - L * 0.08, -D * 0.45), (ax - L * 0.16, 0)], 0.005,
                          M[sp["fin"]], at=(0, bend(ax), -D * 0.55)))

    # eyes on both sides of the head
    ex = L * 0.73
    er = 0.014 + D * 0.03
    for side in (-1, 1):
        ey = bend(ex) + side * W * 0.5
        bpy.ops.mesh.primitive_uv_sphere_add(radius=er, segments=12, ring_count=8, location=(ex, ey, D * 0.25))
        parts.append(finish(active(), "Eye", M["eye"]))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=er * 0.56, segments=10, ring_count=6,
                                             location=(ex + 0.004, ey + side * er * 0.55, D * 0.26))
        parts.append(finish(active(), "Pupil", M["pupil"]))
    return parts


CORN_L = 0.3
KERNELS_AROUND, KERNELS_ALONG = 16, 12   # must match the T_GrilledCorn texture grid


def corn_cob():
    """Cob with real kernel bumps (lined up with the texture), a narrower tip, and husk leaves peeled back
    around a stalk stub at the base. Built along local Z with the tip at +Z, then laid along X (tip up the stick)."""
    rings, seg = 72, 64
    bm = bmesh.new()
    grid = []
    for i in range(rings + 1):
        v = i / rings
        z = (v - 0.5) * CORN_L
        t = z / (CORN_L / 2)                                    # -1 base .. +1 tip
        taper = math.sqrt(max(0.0, 1 - abs(t) ** 6)) * (1 - 0.28 * max(0.0, t) ** 2)
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            fu = (j / seg * KERNELS_AROUND) % 1
            fv = (v * KERNELS_ALONG) % 1
            ker = max(0.0, 1 - ((fu - 0.5) ** 2 + 1.4 * (fv - 0.5) ** 2) * 4.5) ** 0.5
            r = 0.06 * max(taper, 0.05) * (1 + 0.1 * ker)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        grid.append(row)
    for i in range(rings):
        for j in range(seg):
            jn = (j + 1) % seg
            bm.faces.new((grid[i][j], grid[i][jn], grid[i + 1][jn], grid[i + 1][j]))
    for row, z, flip in ((grid[0], -CORN_L / 2, True), (grid[-1], CORN_L / 2, False)):
        c = bm.verts.new((0, 0, z))
        for j in range(seg):
            jn = (j + 1) % seg
            bm.faces.new((c, row[jn], row[j]) if flip else (c, row[j], row[jn]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Cob")
    bm.to_mesh(me)
    bm.free()
    cob = bpy.data.objects.new("Cob", me)
    bpy.context.collection.objects.link(cob)
    cyl_uv(cob)
    finish(cob, "Cob", M["corn"])
    cob.rotation_euler = (0, math.radians(90), 0)
    parts = [cob]

    # stalk stub at the base
    base_x = -CORN_L / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.024, depth=0.06, location=(base_x - 0.025, 0, 0),
                                        rotation=(0, math.radians(90), 0))
    parts.append(finish(active(), "Stalk", M["husk"]))

    # three husk leaves folded back from the base, fanning out around the cob
    for k in range(3):
        phi = 2 * math.pi * k / 3 + random.uniform(-0.2, 0.2)
        radial = Vector((0, math.cos(phi), math.sin(phi)))
        direction = (Vector((-1, 0, 0)) * math.cos(0.35) + radial * math.sin(0.35)).normalized()
        length = random.uniform(0.2, 0.26)
        o = leaf(0, 0, 0, 0, length, 0.07, M["husk"], "Husk", cup=0.06, thickness=0.004)
        # leaf grid runs along local X; aim X down the stick and flare its face outward
        z_axis = (radial - direction * radial.dot(direction)).normalized()
        y_axis = z_axis.cross(direction)
        basis = Matrix((direction, y_axis, z_axis)).transposed().to_4x4()
        basis.translation = Vector((base_x + 0.02, 0, 0)) + radial * 0.05 + direction * length / 2
        o.matrix_world = basis
        parts.append(o)
    return parts


def shiitake_trio():
    """Three shiitake on a skewer: domed caps facing outward (toward the viewer), pale gills underneath,
    stems pointing back toward the fire."""
    parts = []
    for i in range(3):
        x = (i - 1) * 0.12
        bm = bmesh.new()
        bm.loops.layers.uv.new()
        bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=1, calc_uvs=True)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0),
                               plane_no=(0, 0, -1), clear_outer=True)
        gills = bmesh.ops.edgeloop_fill(bm, edges=[e for e in bm.edges if e.is_boundary])["faces"]
        for vtx in bm.verts:
            vtx.co.x *= 0.062
            vtx.co.y *= 0.062
            vtx.co.z *= 0.036
        bm.normal_update()
        for f in gills:
            if f.normal.z > 0:
                f.normal_flip()
            f.material_index = 1
        me = bpy.data.meshes.new("Cap")
        bm.to_mesh(me)
        bm.free()
        cap = bpy.data.objects.new("Cap", me)
        bpy.context.collection.objects.link(cap)
        cap.data.materials.append(M["shiitake"])
        cap.data.materials.append(M["gills"])
        for p in cap.data.polygons:
            p.use_smooth = p.material_index == 0
        # dome (+Z) -> outward (+Y)
        cap.location = (x, 0.012, 0)
        cap.rotation_euler = (math.radians(-90), 0, 0)
        parts.append(cap)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.016, depth=0.045, location=(x, -0.012, 0),
                                            rotation=(math.radians(90), 0, 0))
        parts.append(finish(active(), "Stem", M["stem"]))
    return parts


def onigiri():
    """Rounded triangle of rice, flat faces toward the camera, with a nori band at the bottom."""
    bm = bmesh.new()
    pts = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        r = 0.1 * (1 + 0.16 * math.cos(3 * a))      # soft triangle
        pts.append((r * math.cos(a), r * math.sin(a)))
    ring_f = [bm.verts.new((x, -0.035, z)) for x, z in pts]
    ring_b = [bm.verts.new((x, 0.035, z)) for x, z in pts]
    for i in range(48):
        j = (i + 1) % 48
        bm.faces.new((ring_f[i], ring_f[j], ring_b[j], ring_b[i]))
    bm.faces.new(ring_f[::-1])
    bm.faces.new(ring_b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uvl = bm.loops.layers.uv.new()
    for f in bm.faces:
        for l in f.loops:
            l[uvl].uv = (l.vert.co.x * 4 + 0.5, l.vert.co.z * 4 + 0.5)
    me = bpy.data.meshes.new("Rice")
    bm.to_mesh(me)
    bm.free()
    rice = bpy.data.objects.new("Rice", me)
    bpy.context.collection.objects.link(rice)
    bevel(rice, 0.02, 3)
    finish(rice, "Rice", M["onigiri"])
    # the triangle is drawn with its point at +X, which is already up the stick; the flat side sits at
    # x ≈ -0.084, so the nori band wraps across that bottom edge, square to it and centred on the rice
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.062, 0, 0))
    n = active()
    n.scale = (0.05, 0.084, 0.15)
    return [rice, finish(n, "Nori", M["nori"], smooth_shade=False)]


def shrimp_pair():
    parts = []
    for i, x in enumerate((-0.07, 0.07)):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.022, major_segments=32, minor_segments=12,
                                         location=(x, 0, 0), rotation=(math.radians(90), 0, 0))
        b = active()
        bm = bmesh.new()
        bm.from_mesh(b.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if abs(math.atan2(v.co.y, v.co.x)) < math.pi / 4],
                         context="VERTS")
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bm.to_mesh(b.data)
        bm.free()
        parts.append(finish(b, "Shrimp", M["shrimp"]))
    return parts


def sausage():
    """A plump link with rounded ends, curved like a real sausage. Built along local Z, then laid along X."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=24, rotation=(0, math.radians(90), 0))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        z = vtx.co.z
        # long capsule: fuller through the middle, rounded at the ends
        k = math.sqrt(max(0.0, 1 - z ** 8)) ** 0.5
        vtx.co.x *= 0.042 * k
        vtx.co.y *= 0.042 * k
        vtx.co.z = z * 0.13
        vtx.co.x += 0.055 * z * z      # bend: the ends curl the same way
    bm.to_mesh(o.data)
    bm.free()
    cyl_uv(o)
    return [finish(o, "Sausage", M["sausage"])]


# base fish (always there) and the toggleable skewers. Angles avoid the camera side (-90°).
# ---------------------------------------------------------------------------------------------------------
# more yakitori-shop skewers: textures and materials
N = 256
u, v = grid01(N)
glaze_char = smooth(0.62, 0.8, fbm(N, 6, 6))
TEX["chicken"] = image("T_Chicken", mix(mix((0.72, 0.45, 0.22), (0.86, 0.6, 0.32), fbm(N, 8, 8)), (0.3, 0.14, 0.05),
                                        glaze_char * 0.8))
fat = smooth(0.08, 0.02, np.abs(((v * 5) % 1) - 0.5) - 0.2)
TEX["pork"] = image("T_PorkBelly", mix(mix((0.8, 0.5, 0.4), (0.97, 0.88, 0.78), fat), (0.45, 0.22, 0.1),
                                       glaze_char * 0.7))
TEX["squid"] = image("T_Squid", mix(mix((0.95, 0.86, 0.72), (0.92, 0.6, 0.35), fbm(N, 5, 5)), (0.55, 0.25, 0.1),
                                    glaze_char * 0.6))
blister = (vnoise(N, 40, 40) > 0.78).astype(np.float32)
TEX["shishito"] = image("T_Shishito", mix(mix((0.22, 0.48, 0.14), (0.38, 0.62, 0.2), fbm(N, 6, 6)), (0.12, 0.1, 0.05),
                                          blister * 0.85))
toast = smooth(0.55, 0.75, fbm(N, 5, 5))
TEX["mochi"] = image("T_Mochi", mix((0.97, 0.95, 0.9), (0.68, 0.45, 0.2), toast * 0.85))
score = smooth(0.06, 0.0, np.minimum(np.abs(((u + v) * 8) % 1 - 0.5), np.abs(((u - v) * 8) % 1 - 0.5)))
TEX["eryngii"] = image("T_Eryngii", mix(mix((0.93, 0.87, 0.74), (0.82, 0.7, 0.5), fbm(N, 6, 6)), (0.45, 0.3, 0.15),
                                        score * 0.75))
M.update({
    "chicken": pbr("Chicken", tex=TEX["chicken"], rough=0.35, coat=0.5),
    "leek": pbr("Leek", (0.9, 0.93, 0.82), rough=0.45),
    "leek_green": pbr("LeekGreen", (0.42, 0.62, 0.25), rough=0.45),
    "pork": pbr("PorkBelly", tex=TEX["pork"], rough=0.35, coat=0.4),
    "squid": pbr("Squid", tex=TEX["squid"], rough=0.3, coat=0.5),
    "shishito": pbr("Shishito", tex=TEX["shishito"], rough=0.3, coat=0.4),
    "mochi": pbr("Mochi", tex=TEX["mochi"], rough=0.6),
    "eryngii": pbr("Eryngii", tex=TEX["eryngii"], rough=0.55),
})


def rounded_box(name, size, mat, at, bev=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at,
                                    rotation=(random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2)))
    o = active()
    o.scale = size
    apply_scale(o)
    bevel(o, bev, 3, angle=False)
    return finish(o, name, mat)


def yakitori():
    """Negima: chicken thigh chunks with leek between, along local X."""
    parts = []
    for i, x in enumerate((-0.14, -0.07, 0.0, 0.07, 0.14)):
        if i % 2 == 0:
            parts.append(rounded_box("Chicken", (0.06, 0.055, 0.05), M["chicken"], (x, 0, 0), 0.018))
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.02, depth=0.04, location=(x, 0, 0),
                                                rotation=(math.radians(90), 0, 0))
            parts.append(finish(active(), "Leek", M["leek"]))
    return parts


def pork_belly():
    """Three folded slices of pork belly, fat and meat in layers."""
    parts = []
    for x in (-0.11, 0.0, 0.11):
        parts.append(rounded_box("Pork", (0.07, 0.09, 0.025), M["pork"], (x, 0, 0), 0.01))
    return parts


def squid():
    """A whole grilled squid: tapered mantle with fins at the top, tentacles hanging below."""
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1, calc_uvs=True)
    for vtx in bm.verts:
        t = (vtx.co.x + 1) / 2                      # 0 bottom .. 1 tip
        k = 1 - 0.55 * t ** 1.5
        vtx.co.y *= 0.035 * k
        vtx.co.z *= 0.05 * k
        vtx.co.x = vtx.co.x * 0.15 + 0.03
    me = bpy.data.meshes.new("SquidBody")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("SquidBody", me)
    bpy.context.collection.objects.link(body)
    parts = [finish(body, "SquidBody", M["squid"])]
    parts.append(flat_fin("SquidFin", [(0.0, 0.0), (-0.05, 0.06), (-0.09, 0.0), (-0.05, -0.06)], 0.006, M["squid"],
                          at=(0.17, 0, 0)))
    for i in range(6):
        a = (i - 2.5) * 0.12
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.008, radius2=0.002, depth=0.12,
                                        location=(-0.17, a * 0.15, a * 0.25), rotation=(0, math.radians(-90) + a, 0))
        parts.append(finish(active(), "Tentacle", M["squid"]))
    return parts


def shishito():
    """Four blistered shishito peppers, slightly curved, stems out to one side."""
    parts = []
    for i, x in enumerate((-0.11, -0.04, 0.03, 0.1)):
        bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.018, radius2=0.004, depth=0.11,
                                        location=(x, 0, -0.01), rotation=(random.uniform(-0.25, 0.25), 0, 0))
        o = active()
        bevel(o, 0.006, 2)
        parts.append(finish(o, "Shishito", M["shishito"]))
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.004, depth=0.02, location=(x, 0, 0.055))
        parts.append(finish(active(), "Stem", M["leek_green"]))
    return parts


def mochi():
    """Two toasted rice cakes, puffing up."""
    parts = []
    for x in (-0.065, 0.065):
        o = rounded_box("Mochi", (0.11, 0.035, 0.075), M["mochi"], (x, 0, 0), 0.016)
        o.scale.y *= 1.2
        parts.append(o)
    return parts


def eryngii():
    """Three thick slices of king oyster mushroom stem, scored on the face."""
    parts = []
    for x in (-0.09, 0.0, 0.09):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.04, depth=0.028, location=(x, 0, 0),
                                            rotation=(math.radians(90), 0, 0))
        o = active()
        bevel(o, 0.006, 2)
        parts.append(finish(o, "Eryngii", M["eryngii"]))
    return parts


place(yakitori(), 75, 0.6, "Yakitori")
place(pork_belly(), 112, 0.6, "PorkBelly")
place(squid(), 178, 0.58, "Squid")
place(shishito(), 144, 0.6, "Shishito")
place(mochi(), 224, 0.6, "Mochi")
place(eryngii(), 357, 0.6, "KingOyster")
# ---------------------------------------------------------------------------------------------------------

place(fish(), 95, 0.64, "ExtraFish")
place(fish("saury"), -97, 0.6, "Saury")
place(fish("mackerel"), -122, 0.62, "Mackerel")
place(corn_cob(), 55, 0.6, "GrilledCorn")
place(shiitake_trio(), 128, 0.6, "GrilledShiitake")
place(onigiri(), -20, 0.58, "Onigiri")
place(shrimp_pair(), 200, 0.6, "ShrimpSkewer")
place(sausage(), -150, 0.6, "Sausage")


# potatoes and sweet potatoes nestled in the ash at the front edge of the fire (no skewer)
def roast_in_ash(name, mat, angle_deg, r, size, bend=0.0):
    a = math.radians(angle_deg)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12,
                                         location=(r * math.cos(a), r * math.sin(a), size[2] * 0.7),
                                         rotation=(0, 0, a + math.pi / 2 + random.uniform(-0.4, 0.4)))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        x = vtx.co.x
        # lumpy, and for sweet potatoes tapered at both ends with a gentle curve
        vtx.co *= random.uniform(0.94, 1.06)
        if bend:
            taper = 1 - 0.55 * x * x
            vtx.co.y *= taper
            vtx.co.z *= taper
            vtx.co.y += bend * (1 - x * x)
    bm.to_mesh(o.data)
    bm.free()
    o.scale = size
    return finish(o, name, mat)


roast_in_ash("Potato", M["potato"], -62, 0.56, (0.1, 0.085, 0.075))
roast_in_ash("Potato", M["potato"], -78, 0.62, (0.085, 0.075, 0.065))
roast_in_ash("SweetPotato", M["sweetpotato"], -112, 0.56, (0.17, 0.06, 0.06), bend=0.25)
roast_in_ash("SweetPotato", M["sweetpotato"], -128, 0.63, (0.15, 0.055, 0.055), bend=-0.2)


# =====================================================================
# Group, preview scene, outputs
# =====================================================================

root = bpy.data.objects.new("GrilledFish", None)
bpy.context.collection.objects.link(root)
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in parts:
    o.parent = root

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
finish(active(), "Ground", M["dirt"], smooth_shade=False)

world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
try:
    world.use_nodes = True
except AttributeError:
    pass
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.12, 0.13, 0.18, 1)
bg.inputs["Strength"].default_value = 0.6


def light(name, kind, energy, loc, color=(1, 1, 1), size=1.0, target=(0, 0, 0.5)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(ob)


light("Fire", "POINT", 220, (0, 0, 0.35), color=(1.0, 0.5, 0.15))
light("Key", "AREA", 300, (3.0, 0.8, 2.8), color=(1.0, 0.88, 0.75), size=2.0)
light("Fill", "AREA", 120, (-2.8, -1.2, 2.2), color=(0.65, 0.75, 1.0), size=3.0)

cam = bpy.data.cameras.new("Camera")
cam.lens = 38
cam_obj = bpy.data.objects.new("Camera", cam)
cam_obj.location = (0.4, -3.4, 2.4)
cam_obj.rotation_euler = (Vector((0, 0, 0.55)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "grilledfish.glb"),
            os.path.join(PROJECT, "blender", "grilledfish.blend"), PREVIEW)
print("GRILLEDFISH_DONE", len(parts), "parts")
