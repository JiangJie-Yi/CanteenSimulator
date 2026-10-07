"""Generate salt-grilled fish on skewers around a campfire ringed with stones.

Usage:
  blender -b --factory-startup --python blender/grilledfish.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/grilledfish.blend
  <project_dir>/public/models/grilledfish.glb

Flames, embers and the flicker light are animated in the web app (src/components/Fire.tsx).
Items that the web menu toggles are named by their menu id (src/menu.ts):
ExtraFish, Saury, Mackerel, GrilledCorn, GrilledShiitake, Onigiri, ShrimpSkewer, Sausage, Yakitori, PorkBelly,
Squid, Shishito, Mochi, KingOyster, Asparagus (skewers), Potato, SweetPotato (in the ash).
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

# split bamboo for the skewers (u: around, v: along): fine lengthwise fibres, darker streaks, a couple of nodes
N = 256
u, v = grid01(N)
fibres = vnoise(N, 90, 3) * 0.6 + vnoise(N, 40, 2) * 0.4
bamboo = mix((0.66, 0.5, 0.28), (0.88, 0.75, 0.5), fibres)
bamboo = mix(bamboo, (0.5, 0.36, 0.18), smooth(0.72, 0.9, vnoise(N, 24, 6)) * 0.6)
for node in (0.33, 0.71):
    bamboo = mix(bamboo, (0.48, 0.34, 0.17), smooth(0.012, 0.0, np.abs(v - node)) * 0.8)
TEX["bamboo"] = image("T_Bamboo", bamboo)

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
# inside the stones the whole floor is a thick bed of coarse white salt: faint grain and drifts in it,
# and only a light grey dusting of ash right under the coals
grit = vnoise(N, 260, 260)
salt = mix((0.86, 0.86, 0.84), (0.98, 0.98, 0.96), np.clip(grit * 0.6 + fbm(N, 12, 12) * 0.5, 0, 1))
salt = mix(salt, (0.72, 0.71, 0.69), smooth(0.2, 0.05, rad) * 0.35)
ground = mix(salt, dirt, smooth(0.56, 0.62, rad + wobble * 0.3))
alpha = 1 - smooth(0.72, 0.98, rad + wobble)
TEX["pit"] = image("T_FirePit", ground, alpha=alpha)
TEX["pit_n"] = image("T_FirePit_N", to_normal(fbm(N, 24, 24) * 0.5 + grit * 0.5, 1.5), data=True)

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

# the belly is slit open (gutted before grilling): a dark cut along the lower flank from behind the gills to
# the vent, its lips pale where the flesh shows. ud: 0 at the head .. 0.5 at the tail, on both flanks
u, v = grid01(N)
ud = np.minimum(u, 1 - u)
along = smooth(0.1, 0.14, ud) * smooth(0.36, 0.31, ud)
line = np.abs(v - 0.17 - 0.012 * np.sin(ud * 60))
slit = smooth(0.012, 0.003, line) * along
lips = smooth(0.03, 0.012, line) * along * (1 - slit)
for key in ("fish", "saury", "mackerel"):
    img = TEX[key]
    px = np.array(img.pixels[:], np.float32).reshape(N, N, 4)[..., :3]
    px = mix(px, (0.95, 0.84, 0.74), lips * 0.85)
    TEX[key] = image(img.name + "_Slit", mix(px, (0.22, 0.07, 0.05), slit))
TEX["fish_n"] = image("T_Fish_N", to_normal(vnoise(N, 120, 60) * 0.3 + scorch * 0.5 - slit * 1.2, 1.5), data=True)

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
# yaki onigiri brushed with soy: plump separate grains, the glaze pooling darker between them, and grill bars
u, v = grid01(N)
grain = smooth(0.5, 0.78, vnoise(N, 120, 55))                  # elongated grains
rice = mix((0.6, 0.34, 0.12), (0.93, 0.74, 0.44), grain)
rice = mix(rice, (0.42, 0.2, 0.06), smooth(0.55, 0.8, fbm(N, 4, 4)) * 0.55)          # glaze darker in patches
bars = smooth(0.86, 0.96, 0.5 + 0.5 * np.sin((u + v * 0.15) * 2 * np.pi * 6)) * smooth(0.3, 0.6, fbm(N, 5, 5))
rice = mix(rice, (0.2, 0.09, 0.03), bars * 0.75)
rice = mix(rice, (1.0, 0.86, 0.6), smooth(0.86, 0.95, vnoise(N, 120, 55)) * 0.5)    # glossy highlights
TEX["onigiri"] = image("T_Onigiri", rice)
TEX["onigiri_n"] = image("T_Onigiri_N", to_normal(grain * 0.8 + bars * 0.3, 3.0), data=True)

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
    "stick": pbr("BambooSkewer", tex=TEX["bamboo"], rough=0.6),
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

# crinkled aluminium foil for the potatoes roasting in the ash
N = 256
crinkle = np.abs(fbm(N, 18, 18) - 0.5) * 2 + vnoise(N, 60, 60) * 0.3
TEX["foil_n"] = image("T_Foil_N", to_normal(crinkle, 6.0), data=True)
M["foil"] = pbr("Foil", (0.82, 0.83, 0.86), nrm=TEX["foil_n"], rough=0.3, metal=1.0)
M["foil"].use_backface_culling = False
# the salt pot: a little glazed stoneware pot of coarse salt
M["pot"] = pbr("SaltPotGlaze", (0.035, 0.06, 0.15), rough=0.25, coat=0.4)
M["pot_clay"] = pbr("SaltPotClay", (0.62, 0.5, 0.38), rough=0.8)


def centre_origin(o, at=(0.0, 0.0, 0.0)):
    """Put a joined object's origin at `at` (the web app scales the charcoal heap about the fire's centre)."""
    bpy.context.scene.cursor.location = at
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    # bake rotation and scale in too (a join keeps its first piece's, so the web app can scale it from 1)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)
    return o


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
def charcoal_tube(radius, inner, length):
    """A length of charcoal along local Z, solid or (inner > 0) bored hollow down the middle like 中空炭."""
    seg = 9
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    wob = [random.uniform(0.85, 1.12) for _ in range(seg)]          # split and cracked, never quite round
    def ring(r, z):
        return [bm.verts.new((r * wob[j] * math.cos(2 * math.pi * j / seg), r * wob[j] * math.sin(2 * math.pi * j / seg), z))
                for j in range(seg)]
    lo, hi = ring(radius, -length / 2), ring(radius, length / 2)
    walls = [(lo, hi, False)]
    if inner > 0:
        ilo, ihi = ring(inner, -length / 2), ring(inner, length / 2)
        walls.append((ilo, ihi, True))
    for a_, b_, flip in walls:
        for j in range(seg):
            jn = (j + 1) % seg
            q = (a_[j], a_[jn], b_[jn], b_[j])
            f = bm.faces.new(q[::-1] if flip else q)
            for l, (uu, vv) in zip(f.loops, ((j, 0), (j + 1, 0), (j + 1, 1), (j, 1))):
                l[uvl].uv = (uu / seg, vv)
    if inner > 0:
        # the ends are rings round the hollow core
        for outer, inn, flip in ((lo, ilo, True), (hi, ihi, False)):
            for j in range(seg):
                jn = (j + 1) % seg
                q = (outer[j], outer[jn], inn[jn], inn[j])
                bm.faces.new(q[::-1] if flip else q)
    else:
        bm.faces.new(lo[::-1])
        bm.faces.new(hi)
    me = bpy.data.meshes.new("Binchotan")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Binchotan", me)
    bpy.context.collection.objects.link(o)
    return o


sticks = []
for i in range(24):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * 0.34
    length = random.uniform(0.2, 0.4)
    radius = random.uniform(0.03, 0.05)
    lift = max(0.0, 0.12 * (1 - r / 0.4)) * random.uniform(0.4, 1.0)     # mounded in the middle
    # big chunky lengths, some of them hollow down the middle
    o = charcoal_tube(radius, radius * random.uniform(0.35, 0.5) if random.random() < 0.4 else 0.0, length)
    o.location = (r * math.cos(a), r * math.sin(a), radius + lift)
    o.rotation_euler = (math.radians(90) + random.uniform(-0.35, 0.35), 0, random.uniform(0, math.pi))
    # the ones down in the middle of the heap glow; the outer ones are grey white charcoal
    sticks.append(finish(o, "Binchotan", M["ember"] if r < 0.12 or random.random() < 0.15 else M["binchotan"],
                         smooth_shade=False))
centre_origin(join(sticks, "BinchotanHeap"))

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
for _ in range(30):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * 0.44
    s = random.uniform(0.05, 0.1)
    heap = max(0.0, 0.08 * (1 - r / 0.44)) * random.uniform(0.3, 1.0)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1,
                                          location=(r * math.cos(a), r * math.sin(a), s * 0.45 + heap),
                                          rotation=(random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3)))
    o = active()
    o.scale = (s * random.uniform(0.8, 1.3), s * random.uniform(0.8, 1.3), s * random.uniform(0.6, 0.9))
    coals.append(finish(o, "Coal", M["ember"], smooth_shade=False))
centre_origin(join(coals, "Charcoal"))

# a tight ring of mixed big and small stones: pick a half-width for each (along the ring, local Y),
# then space them by those widths so neighbours touch whatever their size
sizes = []
while sum(sizes) * 2 < 2 * math.pi * STONE_R:
    big = len(sizes) % 3 != 1 and random.random() < 0.7      # mostly big, with smaller ones tucked between
    sizes.append(random.uniform(0.21, 0.27) if big else random.uniform(0.12, 0.15))
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
    # a mix of broken rock and smooth river ovals
    oval = random.random() < 0.4
    loc = (r * math.cos(a), r * math.sin(a), sz * 0.55)
    rot = (random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08), a + random.uniform(-0.18, 0.18))
    if oval:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1, subdivisions=2, location=loc, rotation=rot)
    a += half / STONE_R
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    if oval:
        for vtx in bm.verts:
            vtx.co *= random.uniform(0.97, 1.03)   # just enough to break the perfect ellipse
    else:
        # broken rock: a lumpy core sliced by a handful of random planes into flat faces and hard edges,
        # so every one comes out a different chunky shape
        for vtx in bm.verts:
            vtx.co *= random.uniform(0.88, 1.1)
        for _ in range(random.randint(4, 7)):
            nrm = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-0.3, 1))).normalized()
            cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                                         plane_co=nrm * random.uniform(0.62, 0.86), plane_no=nrm, clear_outer=True)
            rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if rim:
                bmesh.ops.holes_fill(bm, edges=rim, sides=0)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for vtx in bm.verts:
        if vtx.co.z < 0:
            vtx.co.z *= 0.6                    # flatter underneath, so it sits on the ground
    if not oval:
        # box-projected UVs, so the stone texture lies flat on every facet
        uvl = bm.loops.layers.uv.verify()
        bm.normal_update()
        for f in bm.faces:
            ax = max(range(3), key=lambda q: abs(f.normal[q]))
            for l in f.loops:
                c = l.vert.co
                l[uvl].uv = ((c.y, c.z), (c.x, c.z), (c.x, c.y))[ax]
    # blackened by the fire on the side facing it (local -X points at the fire), thickest low down, in patches
    col = bm.loops.layers.float_color.new("Col")
    for vtx in bm.verts:
        inward = smooth(0.05, 0.85, np.float32(-vtx.co.x))
        low = smooth(0.9, -0.2, np.float32(vtx.co.z))
        patch = 0.65 + 0.35 * math.sin(vtx.co.y * 9 + i * 1.7) * math.sin(vtx.co.z * 7 + i)
        k = float(1 - 0.82 * inward * (0.45 + 0.55 * low) * patch)
        for l in vtx.link_loops:
            l[col] = (k, k * 0.97, k * 0.95, 1.0)
    bm.to_mesh(o.data)
    bm.free()
    attr = o.data.color_attributes["Col"]
    o.data.color_attributes.active_color = attr
    o.data.color_attributes.render_color_index = o.data.color_attributes.find("Col")
    # the slicing pares a rock down by about a sixth; scale back up so the ring still closes
    o.scale = (sx, sy, sz) if oval else (sx * 1.15, sy * 1.2, sz * 1.15)
    finish(o, "Stone", M["stone"], smooth_shade=oval)


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
    """The bamboo stick, hand-split rather than machined: thin, a little uneven in thickness and section, with
    a slight bow, whittled to a point at the top. `extra` lengthens it past the tip (sticks come long and short)."""
    _, foot, tip = stick_frame(angle_deg, 0, var)
    d = tip - foot
    length = d.length + 0.08 + extra
    point_len = 0.06
    total = length + point_len
    rings, seg = 40, 8
    r0 = random.uniform(0.0065, 0.0085)
    bow = random.uniform(-0.008, 0.008)
    flat = random.uniform(0.8, 1.0)                      # split bamboo is never quite round
    wob = [random.uniform(0.88, 1.12) for _ in range(7)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    grid = []
    for i in range(rings + 1):
        t = i / rings
        z = t * total
        # thickness drifts along the stick, then tapers to the point over the last few centimetres
        k = wob[int(t * 5)] * (1 - (t * 5 % 1)) + wob[int(t * 5) + 1] * (t * 5 % 1)
        if z > length:
            k *= max(0.0, 1 - (z - length) / point_len) ** 0.8
        off = bow * math.sin(t * math.pi)
        grid.append([bm.verts.new((r0 * k * math.cos(2 * math.pi * j / seg) + off,
                                   r0 * k * flat * math.sin(2 * math.pi * j / seg), z - 0.08)) for j in range(seg)])
    for i in range(rings):
        for j in range(seg):
            jn = (j + 1) % seg
            f = bm.faces.new((grid[i][j], grid[i][jn], grid[i + 1][jn], grid[i + 1][j]))
            for l, (uu, vv) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                l[uvl].uv = (uu / seg, vv / rings)
    bm.faces.new(grid[0][::-1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    shaft = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(shaft)
    # local Z runs up the stick from just below its foot
    shaft.matrix_world = Matrix.Translation(foot) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return finish(shaft, name, M["stick"])

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


def tilted(outline, angle):
    """Rotate a fin outline (x, z) about its root by `angle` (radians), to follow the curve of the body."""
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - z * s, x * s + z * c) for x, z in outline]


def fish(species="ayu"):
    """A grilled fish along local X (head at +X), threaded the 踊り串 way: the body waves in a big S up the
    skewer, as if it were still swimming, so the stick weaves in and out of it."""
    sp = SPECIES[species]
    L, W, D = sp["length"], sp["width"], sp["depth"]
    bend = lambda x: 0.012 * math.sin(x * math.pi / L)        # noqa: E731  a little sideways sway
    wave = lambda x: 0.95 * D * math.sin(x * math.pi / L)      # noqa: E731  the S, seen from the side
    slope = lambda x: math.atan(0.95 * D * math.pi / L * math.cos(x * math.pi / L))   # noqa: E731
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
        vtx.co.z += wave(vtx.co.x)
    me = bpy.data.meshes.new("FishBody")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("FishBody", me)
    bpy.context.collection.objects.link(body)
    finish(body, "FishBody", M[sp["body"]])
    parts = [body]

    # forked tail, rooted just inside the narrow end of the body and flicked along the line of the S
    tail_len, tail_h = sp["tail"]
    root_x = -L * 0.93
    parts.append(flat_fin("TailFin", tilted(forked_tail(tail_len, tail_h, D * 0.16), slope(root_x)), 0.006,
                          M[sp["fin"]], at=(root_x, bend(root_x), wave(root_x))))

    # dorsal fin: a low swept-back sail; a small anal fin underneath; both ride the curve of the back
    dx = L * 0.05
    parts.append(flat_fin("DorsalFin", tilted([(L * 0.12, 0), (L * 0.02, D * 0.75), (-L * 0.12, D * 0.55),
                                               (-L * 0.2, 0)], slope(dx)), 0.005, M[sp["fin"]],
                          at=(dx, bend(dx), D * 0.82 + wave(dx))))
    ax = -L * 0.45
    parts.append(flat_fin("AnalFin", tilted([(L * 0.1, 0), (-L * 0.08, -D * 0.45), (-L * 0.16, 0)], slope(ax)),
                          0.005, M[sp["fin"]], at=(ax, bend(ax), -D * 0.55 + wave(ax))))

    # eyes on both sides of the head
    ex = L * 0.73
    er = 0.014 + D * 0.03
    ez = wave(ex)
    for side in (-1, 1):
        ey = bend(ex) + side * W * 0.5
        bpy.ops.mesh.primitive_uv_sphere_add(radius=er, segments=12, ring_count=8, location=(ex, ey, D * 0.25 + ez))
        parts.append(finish(active(), "Eye", M["eye"]))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=er * 0.56, segments=10, ring_count=6,
                                             location=(ex + 0.004, ey + side * er * 0.55, D * 0.26 + ez))
        parts.append(finish(active(), "Pupil", M["pupil"]))
    return parts


CORN_L = 0.42
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
    # just the cob: no stalk stub or husk leaves trailing off the bottom
    return [cob]


def shiitake_halves():
    """Big shiitake cut in half top to bottom: each half is the whole mushroom's shape spun through 180°,
    a brown domed cap and pale stem behind, and the flat cut face (cap flesh, gills, stem) turned out of the
    fire (local +Y) or in toward it, alternately. Sizes differ; the skewer runs through the caps."""
    parts = []
    sizes = [random.uniform(0.07, 0.1) for _ in range(3)]
    x = -(sum(sizes) * 2 + 0.03) / 2
    eps = 0.002                                          # keep the axis open a hair (no zero-area faces)
    for n, rx in enumerate(sizes):
        # threaded on alternately, so a cut face shows from either side of the fire
        face = -1 if n % 2 == 0 else 1
        x += rx
        hc = rx * random.uniform(0.62, 0.75)          # cap height
        zc = -hc * 0.35                                # the stick crosses through the lower cap
        sw = rx * random.uniform(0.3, 0.38)            # stem half-width
        sl = rx * random.uniform(0.8, 1.0)             # stem length below the cap
        # half-profile from the crown down, as (radius, height, is cap skin)
        prof = [(max(eps, rx * math.sin(t)), zc + hc * math.cos(t), True) for t in (math.pi / 2 * k / 10 for k in range(11))]
        prof += [(rx * 0.92, zc - hc * 0.12, False), (sw, zc - hc * 0.2, False), (sw * 0.85, zc - sl, False),
                 (eps, zc - sl, False)]
        steps = 14
        bm = bmesh.new()
        rings = []
        for k in range(steps + 1):
            phi = math.pi * k / steps                  # 0 → π round the back, away from the cut face
            rings.append([bm.verts.new((x + r * math.cos(phi), face * r * math.sin(phi), z)) for r, z, _ in prof])
        for k in range(steps):
            for j in range(len(prof) - 1):
                f = bm.faces.new((rings[k][j], rings[k][j + 1], rings[k + 1][j + 1], rings[k + 1][j]))
                f.material_index = 0 if prof[j][2] and prof[j + 1][2] else 1
        # the cut face: the profile down one side and back up the other
        cut = bm.faces.new(rings[0] + rings[steps][::-1])
        cut.material_index = 1
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new("Shiitake")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Shiitake", me)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(M["shiitake_skin"])
        o.data.materials.append(M["gills"])
        for p in o.data.polygons:
            p.use_smooth = p.material_index == 0
        parts.append(o)
        x += rx + 0.015
    return parts


N = 256
u, v = grid01(N)
ridge = 0.5 + 0.5 * np.cos(u * 2 * np.pi * 5)                  # five ridges round the pod
TEX["okra"] = image("T_Okra", mix(mix((0.2, 0.42, 0.12), (0.42, 0.62, 0.22), ridge * 0.7 + fbm(N, 6, 6) * 0.3),
                                  (0.16, 0.13, 0.05), smooth(0.78, 0.92, vnoise(N, 30, 30)) * 0.85))
fib = vnoise(N, 4, 90)
sear = smooth(0.3, 0.05, v) + smooth(0.7, 0.95, v)
TEX["scallop"] = image("T_Scallop", mix(mix((0.95, 0.9, 0.8), (0.99, 0.96, 0.9), fib), (0.78, 0.5, 0.2),
                                        np.clip(sear, 0, 1) * 0.85))
M["okra"] = pbr("Okra", tex=TEX["okra"], rough=0.35, coat=0.3)
M["scallop"] = pbr("Scallop", tex=TEX["scallop"], rough=0.3, coat=0.4)


def okra():
    """Four okra pods across the stick: five-ridged, tapering to a point, with a cap at the stalk end."""
    parts = []
    for i, x in enumerate((-0.15, -0.05, 0.05, 0.15)):
        length = random.uniform(0.2, 0.25)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new()
        rings, seg = 14, 20
        grid = []
        for k in range(rings + 1):
            t = k / rings
            r = 0.03 * (1 - t ** 1.6) * (0.8 + 0.2 * math.sin(math.pi * min(1, t * 3))) + 0.0015
            grid.append([bm.verts.new((
                r * (1 + 0.16 * math.cos(5 * 2 * math.pi * j / seg)) * math.cos(2 * math.pi * j / seg),
                r * (1 + 0.16 * math.cos(5 * 2 * math.pi * j / seg)) * math.sin(2 * math.pi * j / seg),
                -length / 2 + t * length)) for j in range(seg)])
        for k in range(rings):
            for j in range(seg):
                jn = (j + 1) % seg
                f = bm.faces.new((grid[k][j], grid[k][jn], grid[k + 1][jn], grid[k + 1][j]))
                for l, (uu, vv) in zip(f.loops, ((j, k), (j + 1, k), (j + 1, k + 1), (j, k + 1))):
                    l[uvl].uv = (uu / seg, vv / rings)
        bm.faces.new(grid[0][::-1])
        me = bpy.data.meshes.new("Okra")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Okra", me)
        bpy.context.collection.objects.link(o)
        # across the stick, pointing alternately down and up (the way they're threaded to fit snugly),
        # each at its own slight angle
        down = i % 2 == 0
        o.location = (x, 0, 0)
        o.rotation_euler = ((math.pi if down else 0) + random.uniform(-0.2, 0.2), random.uniform(-0.15, 0.15), 0)
        parts.append(finish(o, "Okra", M["okra"]))
        cap_z = length / 2 if down else -length / 2
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.024, depth=0.028, location=(x, 0, cap_z))
        parts.append(finish(active(), "OkraCap", M["leek_green"]))
    return parts


def scallops():
    """Three plump scallops skewered through the side, their seared faces turned to the viewer."""
    parts = []
    for x in (-0.12, 0.0, 0.12):
        rr = random.uniform(0.046, 0.054)
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=rr, depth=rr * 1.25, location=(x, 0, 0),
                                            rotation=(math.radians(90), 0, 0))
        o = active()
        bm = bmesh.new()
        bm.from_mesh(o.data)
        for vtx in bm.verts:
            vtx.co.x *= random.uniform(0.97, 1.03)
            vtx.co.y *= random.uniform(0.97, 1.03)
        bm.to_mesh(o.data)
        bm.free()
        cyl_uv(o)
        bevel(o, rr * 0.28, 3, angle=False)
        parts.append(finish(o, "Scallop", M["scallop"]))
    return parts


def asparagus():
    """Five spears laid side by side across the skewer like a raft (out from the fire, so they show side-on)."""
    parts = []
    for i in range(5):
        x = (i - 2) * 0.036
        r = random.uniform(0.01, 0.013)
        length = random.uniform(0.22, 0.27)
        z0 = -0.11 + random.uniform(-0.015, 0.015)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=length, location=(x, z0 + length / 2, 0),
                                            rotation=(math.radians(90), 0, 0))
        o = active()
        cyl_uv(o)
        parts.append(finish(o, "Asparagus", M["asparagus"]))
        # the bud: a slim pointed tip a shade darker
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=(x, z0 + length, 0))
        tip = active()
        tip.scale = (r * 1.15, r * 3.2, r * 1.15)
        parts.append(finish(tip, "AsparagusTip", M["asparagus_tip"]))
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
    # front and back are mapped flat; the rim runs once around the texture at the same grain scale, so the
    # sides show rice instead of the front's edge pixels smeared across them
    uvl = bm.loops.layers.uv.new()
    for f in bm.faces:
        side = abs(f.normal.y) < 0.7
        us = [math.atan2(l.vert.co.z, l.vert.co.x) / (2 * math.pi) % 1 for l in f.loops]
        if side and max(us) - min(us) > 0.5:
            us = [x + 1 if x < 0.5 else x for x in us]
        for l, uu in zip(f.loops, us):
            c = l.vert.co
            l[uvl].uv = (uu * 2.6, c.y * 4 + 0.5) if side else (c.x * 4 + 0.5, c.z * 4 + 0.5)
    me = bpy.data.meshes.new("Rice")
    bm.to_mesh(me)
    bm.free()
    rice = bpy.data.objects.new("Rice", me)
    bpy.context.collection.objects.link(rice)
    bevel(rice, 0.02, 3, angle=False)
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
TEX["asparagus"] = image("T_Asparagus", mix(mix((0.3, 0.5, 0.16), (0.52, 0.66, 0.28), v), (0.16, 0.14, 0.06),
                                            smooth(0.8, 0.92, 0.5 + 0.5 * np.sin(v * 2 * np.pi * 5)) * 0.8))
M.update({
    "shiitake_skin": pbr("ShiitakeSkin", (0.33, 0.19, 0.09), rough=0.6),
    "asparagus": pbr("Asparagus", tex=TEX["asparagus"], rough=0.35, coat=0.3),
    "asparagus_tip": pbr("AsparagusTip", (0.3, 0.38, 0.16), rough=0.5),
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
    for i, x in enumerate((-0.15, -0.05, 0.05, 0.15)):
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.03, radius2=0.006, depth=0.17,
                                        location=(x, 0, -0.015), rotation=(random.uniform(-0.25, 0.25), 0, 0))
        o = active()
        bevel(o, 0.009, 2)
        parts.append(finish(o, "Shishito", M["shishito"]))
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.006, depth=0.03, location=(x, 0, -0.112))
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
place(asparagus(), 25, 0.6, "Asparagus")
place(okra(), 161, 0.6, "Okra")
place(scallops(), 40, 0.6, "Scallop")
# ---------------------------------------------------------------------------------------------------------

place(fish(), 95, 0.64, "ExtraFish")
place(fish("saury"), -97, 0.6, "Saury")
place(fish("mackerel"), -122, 0.62, "Mackerel")
place(corn_cob(), 55, 0.6, "GrilledCorn")
place(shiitake_halves(), 128, 0.6, "GrilledShiitake")
place(onigiri(), -20, 0.58, "Onigiri")
place(shrimp_pair(), 200, 0.6, "ShrimpSkewer")
place(sausage(), -150, 0.6, "Sausage")


# potatoes and sweet potatoes nestled in the ash at the front edge of the fire (no skewer), roasted in foil.
# Each one carries everything for both of its looks, and the web app shows one or the other by material name:
#   in the ash:     the whole skin (bottom + "...Top" cap) inside a full "Foil<n>" wrap
#   in the basket:  the foil opened out ("Wrapper<n>") and the top broken off, showing the steaming flesh
N = 256
fluff = fbm(N, 14, 14) * 0.6 + vnoise(N, 50, 50) * 0.4
TEX["potato_flesh"] = image("T_PotatoFlesh", mix((0.9, 0.76, 0.4), (1.0, 0.92, 0.62), fluff))
TEX["sweet_flesh"] = image("T_SweetPotatoFlesh", mix((0.95, 0.55, 0.16), (1.0, 0.76, 0.3), fluff))
TEX["flesh_n"] = image("T_Flesh_N", to_normal(fluff, 3.0), data=True)
M["potato_top"] = pbr("PotatoTop", tex=TEX["potato"], nrm=TEX["potato_n"], rough=0.8)
M["sweet_top"] = pbr("SweetPotatoTop", tex=TEX["sweetpotato"], nrm=TEX["sweetpotato_n"], rough=0.7)
M["potato_flesh"] = pbr("PotatoFlesh", tex=TEX["potato_flesh"], nrm=TEX["flesh_n"], rough=0.9)
M["sweet_flesh"] = pbr("SweetPotatoFlesh", tex=TEX["sweet_flesh"], nrm=TEX["flesh_n"], rough=0.9)
# a few foils, each crinkled and tinted a little differently
FOILS = []
for k, (tint, crumple) in enumerate((((0.84, 0.85, 0.88), 6.0), ((0.8, 0.8, 0.82), 9.0), ((0.86, 0.85, 0.83), 4.0))):
    n_map = image(f"T_Foil{k}_N", to_normal(np.abs(fbm(N, 12 + 6 * k, 14 + 4 * k) - 0.5) * 2 + vnoise(N, 50 + 20 * k, 60) * 0.3,
                                            crumple), data=True)
    for prefix in ("Foil", "Wrapper"):
        m = pbr(f"{prefix}{k}", tint, nrm=n_map, rough=0.3, metal=1.0)
        m.use_backface_culling = False
        M[f"{prefix.lower()}{k}"] = m
CUT = 0.28   # where the top breaks off, in the unit sphere's height


def crumple(bm, amp):
    """Crush a foil mesh: a few big random folds and a fine jitter, different every time."""
    f = [(random.uniform(3, 8), random.uniform(0, 6.3)) for _ in range(3)]
    for vtx in bm.verts:
        c = vtx.co
        fold = math.sin(f[0][0] * c.x + f[0][1]) * math.sin(f[1][0] * c.y + f[1][1]) * math.sin(f[2][0] * c.z + f[2][1])
        c *= 1.0 + amp * fold + random.uniform(-0.025, 0.035)


def piece(src, name, mat, keep, cut=CUT):
    """A copy of the potato mesh `src`, cut at `cut` keeping the part below ("below") or above ("above")."""
    o = src.copy()
    o.data = src.data.copy()
    o.data.materials.clear()
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cut),
                           plane_no=(0, 0, 1), clear_outer=keep == "below", clear_inner=keep == "above")
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, name, mat)


def roast_in_ash(name, mat, top_mat, flesh_mat, angle_deg, r, size, bend=0.0):
    a = math.radians(angle_deg)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16,
                                         location=(r * math.cos(a), r * math.sin(a), size[2] * 0.7),
                                         rotation=(0, 0, a + math.pi / 2 + random.uniform(-0.4, 0.4)))
    whole = active()
    bm = bmesh.new()
    bm.from_mesh(whole.data)
    for vtx in bm.verts:
        x = vtx.co.x
        # lumpy, and for sweet potatoes tapered at both ends with a gentle curve
        vtx.co *= random.uniform(0.95, 1.05)
        if bend:
            taper = 1 - 0.55 * x * x
            vtx.co.y *= taper
            vtx.co.z *= taper
            vtx.co.y += bend * (1 - x * x)
    bm.to_mesh(whole.data)
    bm.free()
    whole.scale = size

    skin = piece(whole, name, mat, "below")
    top = piece(whole, name + "Top", top_mat, "above")

    # the flesh: the cut face, broken open and fluffed up into a little mound
    flesh = piece(whole, name + "Flesh", flesh_mat, "below")
    bm = bmesh.new()
    bm.from_mesh(flesh.data)
    rim = [e for e in bm.edges if e.is_boundary]
    filled = bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in filled], context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    cx = sum((v.co for v in bm.verts), Vector()) / max(1, len(bm.verts))
    bmesh.ops.poke(bm, faces=bm.faces[:])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    for vtx in bm.verts:
        d = (vtx.co.xy - cx.xy).length
        vtx.co.z = CUT + 0.02 + 0.22 * max(0.0, 1 - d / 0.9) ** 1.5 + random.uniform(-0.03, 0.04)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            l[uvl].uv = (l.vert.co.x * 0.5 + 0.5, l.vert.co.y * 0.5 + 0.5)
    bm.to_mesh(flesh.data)
    bm.free()
    for p in flesh.data.polygons:
        p.use_smooth = False

    k = random.randrange(len(FOILS) if FOILS else 3)
    # the foil, wrapped right round and twisted shut on top
    foil = piece(whole, name + "Foil", M[f"foil{k}"], "below", cut=9)
    bm = bmesh.new()
    bm.from_mesh(foil.data)
    crumple(bm, random.uniform(0.04, 0.09))
    for vtx in bm.verts:
        vtx.co *= 1.1
        if vtx.co.z > 0.8:
            vtx.co.z += random.uniform(0.05, 0.22)
            vtx.co.x += random.uniform(-0.08, 0.08)
    bm.to_mesh(foil.data)
    bm.free()
    for p in foil.data.polygons:
        p.use_smooth = False

    # the same sheet opened out: cupped round the bottom, its torn edge folded back in loose petals
    wrap = piece(whole, name + "Wrapper", M[f"wrapper{k}"], "below", cut=0.15)
    bm = bmesh.new()
    bm.from_mesh(wrap.data)
    crumple(bm, random.uniform(0.04, 0.09))
    for vtx in bm.verts:
        vtx.co *= 1.1
        lift = max(0.0, vtx.co.z + 0.2)
        if lift > 0:
            # the higher up the sheet, the further it's peeled back and out
            petal = 1 + 0.6 * lift * (1 + 0.5 * math.sin(math.atan2(vtx.co.y, vtx.co.x) * 5 + random.uniform(0, 0.6)))
            vtx.co.x *= petal
            vtx.co.y *= petal
            vtx.co.z -= 0.25 * lift
    bm.to_mesh(wrap.data)
    bm.free()
    for p in wrap.data.polygons:
        p.use_smooth = False

    bpy.data.objects.remove(whole)
    return join([skin, top, flesh, foil, wrap], name)


FOILS = [0, 1, 2]
roast_in_ash("Potato", M["potato"], M["potato_top"], M["potato_flesh"], -66, 0.58, (0.1, 0.085, 0.075))
roast_in_ash("SweetPotato", M["sweetpotato"], M["sweet_top"], M["sweet_flesh"], -118, 0.58, (0.17, 0.06, 0.06),
             bend=0.25)

def salt_pot(angle_deg, r):
    """A little glazed pot of coarse salt standing just outside the stones; the web app makes it clickable."""
    a = math.radians(angle_deg)
    x, y = r * math.cos(a), r * math.sin(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.1, depth=0.13, location=(x, y, 0.065))
    pot = active()
    bm = bmesh.new()
    bm.from_mesh(pot.data)
    for vtx in bm.verts:
        t = (vtx.co.z + 0.065) / 0.13                   # 0 foot .. 1 lip
        k = 0.82 + 0.3 * math.sin(t * math.pi * 0.85)    # bellied, narrowing to the foot and the lip
        vtx.co.x *= k
        vtx.co.y *= k
    # open the top: the salt shows inside
    bm.normal_update()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
    bm.to_mesh(pot.data)
    bm.free()
    s = pot.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.012
    bevel(pot, 0.004, 2)
    finish(pot, "SaltPot", M["pot"])
    # unglazed foot ring
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.075, depth=0.014, location=(x, y, 0.007))
    foot = finish(active(), "SaltPotFoot", M["pot_clay"])
    # a heap of coarse salt filling it, rough with grains
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=(x, y, 0.118))
    heap = active()
    heap.scale = (0.088, 0.088, 0.035)
    bm = bmesh.new()
    bm.from_mesh(heap.data)
    for vtx in bm.verts:
        vtx.co *= random.uniform(0.94, 1.06)
    bm.to_mesh(heap.data)
    bm.free()
    finish(heap, "SaltHeap", M["salt"], smooth_shade=False)
    return centre_origin(join([pot, foot, heap], "SaltPot"), (x, y, 0.0))


# front right of the fire as the camera sees it, clear of the plate and the basket
salt_pot(-15, 1.25)


# ---------------------------------------------------------------------------------------------------------
# the sauces and toppings beside the salt; in the web app each is dragged onto a piece of food
M.update({
    "soy_pot": pbr("SoyPotGlaze", (0.16, 0.08, 0.04), rough=0.25, coat=0.4),
    "soy": pbr("SoySauce", (0.05, 0.02, 0.008), rough=0.08, coat=0.8),
    "milk_jar": pbr("MilkJarGlaze", (0.9, 0.88, 0.84), rough=0.3, coat=0.3),
    "milk": pbr("CondensedMilk", (0.97, 0.92, 0.78), rough=0.2, coat=0.5),
    "bowl_wood": pbr("PeanutBowlWood", tex=TEX["bark"], rough=0.6),
    "peanut": pbr("PeanutPowder", (0.8, 0.6, 0.36), rough=0.95),
    "spoon_wood": pbr("SpoonWood", (0.66, 0.48, 0.28), rough=0.55),
    "bristle": pbr("BrushBristle", (0.2, 0.11, 0.05), rough=0.7),
    "net": pbr("GrillNetWire", (0.13, 0.13, 0.14), rough=0.45, metal=0.8),
})


def open_pot(x, y, radius, depth, mat, belly=0.3, name="Pot"):
    """A bellied pot open at the top, with real wall thickness (applied, so it survives joining)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=(x, y, depth / 2))
    pot = active()
    bm = bmesh.new()
    bm.from_mesh(pot.data)
    for vtx in bm.verts:
        t = (vtx.co.z + depth / 2) / depth
        k = 0.82 + belly * math.sin(t * math.pi * 0.85)
        vtx.co.x *= k
        vtx.co.y *= k
    bm.normal_update()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
    bm.to_mesh(pot.data)
    bm.free()
    s = pot.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.01
    bpy.ops.object.select_all(action="DESELECT")
    pot.select_set(True)
    bpy.context.view_layer.objects.active = pot
    bpy.ops.object.modifier_apply(modifier="Solidify")
    return finish(pot, name, mat)


def filling(x, y, z, radius, height, mat, rough=0.06):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=(x, y, z))
    o = active()
    o.scale = (radius, radius, height)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        vtx.co *= random.uniform(1 - rough, 1 + rough)
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, "Filling", mat, smooth_shade=rough < 0.03)


def stick_between(p0, p1, radius, mat, name):
    """A thin round rod from p0 to p1 (brush and spoon handles, grill wires)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=d.length, location=(p0 + p1) / 2)
    o = active()
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return finish(o, name, mat)


def at_angle(angle_deg, r):
    a = math.radians(angle_deg)
    return r * math.cos(a), r * math.sin(a)


# soy sauce: a dark glazed pot of soy with a basting brush standing in it
x, y = at_angle(-2, 1.3)
parts = [open_pot(x, y, 0.085, 0.12, M["soy_pot"], name="SoyPot"), filling(x, y, 0.1, 0.075, 0.01, M["soy"], rough=0.0)]
out = Vector((math.cos(math.radians(-2)), math.sin(math.radians(-2)), 0))
foot = Vector((x, y, 0.06)) - out * 0.02
parts.append(stick_between(foot, foot + out * 0.1 + Vector((0, 0, 0.26)), 0.008, M["spoon_wood"], "BrushHandle"))
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=foot - Vector((0, 0, 0.02)))
tuft = active()
tuft.scale = (0.022, 0.016, 0.04)
parts.append(finish(tuft, "BrushBristles", M["bristle"]))
centre_origin(join(parts, "SoyPot"), (x, y, 0.0))

# condensed milk: a pale glazed jar of it, thick and glossy, with a little spoon
x, y = at_angle(11, 1.3)
parts = [open_pot(x, y, 0.075, 0.11, M["milk_jar"], belly=0.2, name="MilkJar"),
         filling(x, y, 0.095, 0.068, 0.018, M["milk"], rough=0.0)]
out = Vector((math.cos(math.radians(11)), math.sin(math.radians(11)), 0))
parts.append(stick_between(Vector((x, y, 0.09)), Vector((x, y, 0.09)) + out * 0.13 + Vector((0, 0, 0.16)), 0.006,
                           M["spoon_wood"], "SpoonHandle"))
centre_origin(join(parts, "MilkJar"), (x, y, 0.0))

# peanut powder: a shallow wooden bowl heaped with ground peanuts and sugar, a scoop resting in it
x, y = at_angle(23, 1.22)
parts = [open_pot(x, y, 0.1, 0.07, M["bowl_wood"], belly=0.45, name="PeanutBowl"),
         filling(x, y, 0.065, 0.095, 0.035, M["peanut"], rough=0.08)]
out = Vector((math.cos(math.radians(23)), math.sin(math.radians(23)), 0))
parts.append(stick_between(Vector((x, y, 0.08)), Vector((x, y, 0.08)) - out * 0.15 + Vector((0, 0, 0.1)), 0.006,
                           M["spoon_wood"], "ScoopHandle"))
centre_origin(join(parts, "PeanutBowl"), (x, y, 0.0))


# ---------------------------------------------------------------------------------------------------------
# a little wire grill net laid over the coals, just for toasting mochi (切り餅) on
NET_Z = 0.27
NET_H = 0.24
wires = []
for k in range(-6, 7):
    t = k * NET_H / 6.5
    wires.append(stick_between((-NET_H, t, NET_Z), (NET_H, t, NET_Z), 0.0028, M["net"], "Wire"))
    wires.append(stick_between((t, -NET_H, NET_Z - 0.004), (t, NET_H, NET_Z - 0.004), 0.0028, M["net"], "Wire"))
for a_, b_ in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
    wires.append(stick_between((a_[0] * NET_H, a_[1] * NET_H, NET_Z), (b_[0] * NET_H, b_[1] * NET_H, NET_Z), 0.006,
                               M["net"], "Frame"))
for cx, cy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
    wires.append(stick_between((cx * NET_H, cy * NET_H, NET_Z), (cx * NET_H * 1.1, cy * NET_H * 1.1, 0.0), 0.005,
                               M["net"], "Leg"))
join(wires, "GrillNet")

# the mochi: a flat block of pounded rice, with a "Puffed" shape key the web app turns up as it toasts —
# the top swells into a dome and bursts out to one side, the way kirimochi balloons on the grill
M["netmochi"] = pbr("NetMochi", tex=TEX["mochi"], rough=0.6)
HX, HY, HZ = 0.062, 0.045, 0.022
bpy.ops.mesh.primitive_cube_add(size=2, location=(-0.11, 0.05, NET_Z + HZ + 0.004),
                                rotation=(0, 0, random.uniform(-0.2, 0.2)))
mochi_o = active()
bm = bmesh.new()
bm.from_mesh(mochi_o.data)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=7, use_grid_fill=True)
for vtx in bm.verts:
    c = vtx.co
    rounded = c.normalized() * 1.0
    c[:] = c * 0.7 + rounded * 0.3                     # a soft, rounded block
    c.x *= HX
    c.y *= HY
    c.z *= HZ
bm.to_mesh(mochi_o.data)
bm.free()
finish(mochi_o, "NetMochi", M["netmochi"])
mochi_o.shape_key_add(name="Basis")
puffed = mochi_o.shape_key_add(name="Puffed")
side = random.choice((-1, 1))
for i, kv in enumerate(puffed.data):
    c = mochi_o.data.vertices[i].co
    nx, ny = c.x / HX, c.y / HY
    # the whole block swells a little; the top domes up, with a blister bursting out toward one end
    k = Vector((c.x * 1.08, c.y * 1.08, c.z))
    if c.z > -HZ * 0.3:
        dome = max(0.0, 1 - nx * nx) * max(0.0, 1 - ny * ny)
        blister = math.exp(-((nx - 0.45 * side) ** 2 + ny ** 2) / 0.12)
        k.z += (0.035 * dome + 0.03 * blister) * (c.z / HZ + 0.3) / 1.3
        k.x += 0.012 * blister * side
    kv.co = k


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
