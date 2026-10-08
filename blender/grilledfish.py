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
STICK_FOOT_R = 0.74        # planted inside the stones (clear of them, so no stick runs through a stone)…
STICK_TOP_R = 0.3         # …and every one leaning in over the coals
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

# stones: weathered field rock (granite / andesite) as it looks close up. A warm-grey ground mottled browner in
# places; the speckle of its mineral grains (dark biotite and hornblende, pale feldspar, a few larger dark
# clusters); thin pale quartz veins wandering across; fine dark hairline cracks; small weathering pits; rusty
# iron stains; and pale ash dust settled into the hollows. The height for the normal map follows the same
# features: broad lumps, raised veins and grains, sunken cracks and pits.
N = 1024
warp = fbm(N, 4, 4)
lumps = fbm(N, 6, 6)
stone = mix((0.33, 0.33, 0.32), (0.55, 0.54, 0.51), lumps)
stone = mix(stone, (0.5, 0.44, 0.37), smooth(0.6, 0.85, fbm(N, 3, 3)) * 0.25)          # browner patches
stone = mix(stone, (0.3, 0.31, 0.31), smooth(0.6, 0.85, fbm(N, 2, 5)) * 0.3)           # cooler bands
# (the toon shading flattens the normal map into a few bands, so the detail has to be in the colour)
fine = vnoise(N, 170, 170) * 0.7 + vnoise(N, 340, 340) * 0.3
grain_dark = smooth(0.66, 0.76, fine)
grain_light = smooth(0.3, 0.22, fine)
mottle = fbm(N, 20, 20)
stone = mix(stone, stone * 0.78, smooth(0.45, 0.7, mottle) * 0.8)                   # blotchy weathering
cluster = smooth(0.86, 0.92, vnoise(N, 150, 150)) * smooth(0.4, 0.6, fbm(N, 8, 8))
stone = mix(stone, (0.16, 0.15, 0.14), grain_dark * 0.75)
stone = mix(stone, (0.74, 0.72, 0.67), grain_light * 0.55)
stone = mix(stone, (0.09, 0.085, 0.08), cluster * 0.85)
vein = (smooth(0.006, 0.001, np.abs(fbm(N, 3, 2) + (warp - 0.5) * 0.25 - 0.5)) * smooth(0.35, 0.6, fbm(N, 2, 3)) +
        smooth(0.004, 0.0, np.abs(fbm(N, 2, 4) + (warp - 0.5) * 0.3 - 0.5)) * 0.5 * smooth(0.5, 0.7, fbm(N, 3, 2)))
vein = np.clip(vein, 0, 1)
stone = mix(stone, (0.7, 0.69, 0.65), vein * 0.45)
crack = np.clip(smooth(0.007, 0.001, np.abs(fbm(N, 6, 6) - 0.5)) * smooth(0.4, 0.55, fbm(N, 2, 2)) +
                smooth(0.005, 0.0, np.abs(fbm(N, 11, 11) - 0.5)) * smooth(0.55, 0.7, fbm(N, 3, 3)) * 0.8, 0, 1)
stone = mix(stone, (0.08, 0.07, 0.06), crack * 0.9)
pits = smooth(0.91, 0.95, vnoise(N, 110, 110))
stone = mix(stone, (0.17, 0.15, 0.13), pits * 0.8)
rust = smooth(0.66, 0.82, fbm(N, 4, 3)) * (0.6 + 0.4 * fbm(N, 16, 16))
stone = mix(stone, (0.5, 0.36, 0.24), rust * 0.22)
ash = smooth(0.62, 0.8, fbm(N, 12, 12)) * (1 - lumps) * 0.6 + pits * 0.3
stone = mix(stone, (0.72, 0.7, 0.67), np.clip(ash, 0, 1) * 0.4)
TEX["stone"] = image("T_Stone", stone)
height = (lumps * 0.7 + fbm(N, 24, 24) * 0.25 + fine * 0.1 + vein * 0.1 + cluster * 0.05
          - crack * 0.9 - pits * 0.5)
TEX["stone_n"] = image("T_Stone_N", to_normal(height, 9.0), data=True)

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

# fish skins. The body's UVs run along the fish (see fish()): u goes round the body (0.5 = the belly line,
# 0 and 1 = the top of the back), v runs from the tail (0) to the head (1). t: 0 on the belly .. 1 along the back.
N = 1024
u, v = grid01(N)
t = 1 - np.minimum(u, 1 - u) * 2
# fine overlapping scales: rows of little arcs, offset row to row, a shade darker at each scale's edge
su, sv = u * 140, v * 90
sv = sv + 0.5 * (np.floor(su) % 2)
cell = np.sqrt(((su % 1) - 0.5) ** 2 + ((sv % 1) - 0.15) ** 2)
scales = smooth(0.42, 0.52, cell)
# grill marks: a few scorched bars across the body, blistered and broken up
scorch = smooth(0.84, 0.95, 0.5 + 0.5 * np.sin((v * 11 + u * 1.5) * 2 * np.pi)) * smooth(0.55, 0.8, fbm(N, 8, 8) + 0.3)
blister = smooth(0.8, 0.9, vnoise(N, 70, 40)) * 0.5
lateral = smooth(0.012, 0.0, np.abs(t - 0.52 - 0.01 * np.sin(v * 40)))            # the lateral line


def skin(belly, back_col, back):
    s = mix(belly, back_col, back)
    s = mix(s, np.array(back_col) * 0.6, scales * (0.08 + 0.14 * back))
    s = mix(s, (0.3, 0.3, 0.3), lateral * 0.35)
    return s


# ayu (sweetfish): olive back fading to cream, a golden blush behind the gills, tiny dark spots
back = smooth(0.42, 0.78, t + (fbm(N, 10, 4) - 0.5) * 0.12)
body = skin((0.94, 0.91, 0.83), (0.4, 0.43, 0.36), back)
body = mix(body, (0.94, 0.74, 0.3), smooth(0.05, 0.0, np.abs(v - 0.75)) * smooth(0.25, 0.45, t) * smooth(0.85, 0.6, t) * 0.85)
body = mix(body, (0.22, 0.22, 0.2), (vnoise(N, 220, 110) > 0.86).astype(np.float32) * back * 0.6)
body = mix(body, (0.2, 0.12, 0.06), np.clip(scorch * 0.75 + blister * scorch, 0, 1))
TEX["fish"] = image("T_Ayu", body)

# Pacific saury (秋刀魚): steel-blue back, a crisp line onto a bright silver belly
back = smooth(0.53, 0.58, t + (fbm(N, 12, 4) - 0.5) * 0.03)
saury = skin((0.88, 0.89, 0.88), (0.18, 0.25, 0.37), back)
saury = mix(saury, (0.62, 0.66, 0.7), smooth(0.03, 0.0, np.abs(t - 0.5)) * 0.6)
saury = mix(saury, (0.22, 0.13, 0.07), np.clip(scorch * 0.7 + blister * scorch, 0, 1))
TEX["saury"] = image("T_Saury", saury)

# mackerel (鯖魚): blue-green back with dark wavy bars, silver-cream belly
back = smooth(0.5, 0.62, t)
waves = smooth(0.72, 0.86, 0.5 + 0.5 * np.sin((v * 26 + np.sin(t * 30) * 0.3) * 2 * np.pi)) * back
mackerel = skin((0.9, 0.88, 0.8), (0.22, 0.4, 0.42), back)
mackerel = mix(mackerel, (0.06, 0.09, 0.11), waves * 0.85)
mackerel = mix(mackerel, (0.3, 0.18, 0.08), np.clip(scorch * 0.6 + blister * scorch, 0, 1))
TEX["mackerel"] = image("T_Mackerel", mackerel)

# the belly is cut open from the vent to behind the gills and spread: dark red inside the cut, the pale flesh of
# its lips either side (the groove itself is shaped in fish())
du = np.abs(u - 0.5)
open_along = smooth(0.36, 0.42, v) * smooth(0.74, 0.68, v)
inside = smooth(0.07, 0.045, du) * open_along                 # the opened cavity, wide between the flaps
lips = smooth(0.1, 0.07, du) * open_along * (1 - inside)
for key in ("fish", "saury", "mackerel"):
    img = TEX[key]
    px = np.array(img.pixels[:], np.float32).reshape(N, N, 4)[..., :3]
    px = mix(px, (0.96, 0.82, 0.72), lips * 0.9)
    cavity = mix((0.55, 0.2, 0.14), (0.85, 0.62, 0.52), smooth(0.4, 0.9, du / 0.07))
    cavity = mix(cavity, (0.3, 0.07, 0.05), smooth(0.012, 0.004, du))                    # the blood line by the spine
    cavity = mix(cavity, (0.9, 0.82, 0.74), smooth(0.85, 0.97, 0.5 + 0.5 * np.cos(2 * np.pi * v * 40)) * 0.6)  # ribs
    TEX[key] = image(img.name + "_Open", mix(px, cavity, inside))
TEX["fish_n"] = image("T_Fish_N", to_normal(scales * 0.35 + scorch * 0.5 + blister * 0.3 - inside * 1.2, 1.5),
                      data=True)

# the inside of the belly flaps, turned out: pale cooked flesh with the fine rib bones showing through as thin
# darker bars across it, a silvery lining strip at the hinge, and the cut edge browned by the coals
fu, fv = grid01(N)
ribs = smooth(0.82, 0.97, 0.5 + 0.5 * np.cos(2 * np.pi * (fu * 16 + fv * 0.6))) * smooth(0.05, 0.25, fv) * smooth(0.95, 0.7, fv)
flesh = mix((0.97, 0.86, 0.76), (0.93, 0.74, 0.64), fbm(N, 5, 5) * 0.8)
flesh = mix(flesh, (0.78, 0.56, 0.48), ribs * 0.75)
flesh = mix(flesh, (0.82, 0.8, 0.78), smooth(0.12, 0.0, fv) * 0.7)          # the lining by the hinge
flesh = mix(flesh, (0.55, 0.32, 0.16), smooth(0.8, 1.0, fv) * (0.6 + 0.4 * fbm(N, 9, 3)))   # browned edge
flesh = mix(flesh, (0.6, 0.18, 0.12), (vnoise(N, 40, 40) > 0.94).astype(np.float32) * 0.5)  # blood spots
TEX["fish_flesh"] = image("T_FishFlesh", flesh)

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

# salt-grilled shrimp shell (u: head 0 .. tail 1 along the body, v: around, the back at v = 0/1, the belly at 0.5).
# Cooked shell: deep orange-red over the back fading to pale coral and cream underneath, the six tail segments each
# with a darker overlapping rim, the head shell a little darker and glassier with its cervical groove, white salt
# crust caught on the back, and a few scorched spots along the ridge.
N = 512
u, v = grid01(N)
back = 0.5 + 0.5 * np.cos(2 * np.pi * v)                       # 1 on the back, 0 on the belly
SEG0, SEGW = 0.36, 0.095
seg_t = np.clip((u - SEG0) / SEGW, 0, 6)
seg_f = seg_t - np.floor(seg_t)
rim = smooth(0.78, 0.97, seg_f) * (u > SEG0) * (u < SEG0 + 6 * SEGW)  # each segment darkens toward its rear rim
groove = smooth(0.012, 0.0, np.abs(u - 0.17)) * smooth(0.2, 0.6, back)
shell = mix((0.98, 0.86, 0.72), (0.96, 0.52, 0.3), smooth(0.05, 0.45, back))
shell = mix(shell, (0.86, 0.22, 0.08), smooth(0.4, 0.95, back) * (0.75 + 0.25 * fbm(N, 6, 3)))
shell = mix(shell, (0.62, 0.12, 0.05), rim * (0.35 + 0.5 * back))
shell = mix(shell, (0.74, 0.16, 0.07), (u < SEG0) * 0.3 * back)
shell = mix(shell, (0.5, 0.1, 0.04), groove * 0.7)
# the dark vein line seen through the back, and the white leg joints underneath
shell = mix(shell, (0.45, 0.12, 0.06), smooth(0.02, 0.0, np.minimum(v, 1 - v)) * (u > SEG0) * 0.45)
salt_spk = (vnoise(N, 160, 80) > 0.9).astype(np.float32) * smooth(0.3, 0.8, back)
shell = mix(shell, (0.98, 0.97, 0.94), salt_spk * 0.9)
scorch = smooth(0.62, 0.75, fbm(N, 7, 2)) * smooth(0.6, 0.95, back)
shell = mix(shell, (0.22, 0.07, 0.03), scorch * 0.75)
TEX["shrimp"] = image("T_Shrimp", shell)
TEX["shrimp_n"] = image("T_Shrimp_N", to_normal(-rim * 0.8 - groove * 0.6 + vnoise(N, 120, 60) * 0.15, 2.0), data=True)


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
    "fish_flesh": pbr("FishFlesh", tex=TEX["fish_flesh"], rough=0.55),
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
    "shrimp": pbr("Shrimp", tex=TEX["shrimp"], nrm=TEX["shrimp_n"], rough=0.28, coat=0.45),
    "shrimp_tail": pbr("ShrimpTail", (0.62, 0.08, 0.02), rough=0.6),
    "shrimp_leg": pbr("ShrimpLeg", (0.86, 0.3, 0.12), rough=0.45),
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
SALT_R = 0.86
SALT_H = 0.045


def salt_height(x, y):
    """The salt is piled thick inside the stones, rising gently toward the middle like a low hill."""
    r = math.hypot(x, y) / SALT_R
    if r >= 1:
        return 0.0
    return SALT_H * (1 - r * r) ** 1.5 + 0.004 * math.sin(x * 23 + y * 7) * math.sin(y * 19 - x * 5) * (1 - r)


# a polar grid (not a single fan) so the salt can mound up in the middle
bm = bmesh.new()
uv = bm.loops.layers.uv.verify()
rings, segs = 30, 96
centre = bm.verts.new((0, 0, 0.004 + salt_height(0, 0)))
grid = []
for i in range(1, rings + 1):
    rr = PIT_R * (i / rings) ** 1.3                      # rings closer together in the middle
    grid.append([bm.verts.new((rr * math.cos(2 * math.pi * j / segs), rr * math.sin(2 * math.pi * j / segs),
                               0.004 + salt_height(rr * math.cos(2 * math.pi * j / segs),
                                                   rr * math.sin(2 * math.pi * j / segs)))) for j in range(segs)])
faces = [bm.faces.new((centre, grid[0][j], grid[0][(j + 1) % segs])) for j in range(segs)]
for i in range(rings - 1):
    for j in range(segs):
        jn = (j + 1) % segs
        faces.append(bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][jn], grid[i][jn])))
for f in faces:
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / (2 * PIT_R) + 0.5, l.vert.co.y / (2 * PIT_R) + 0.5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("FirePit")
bm.to_mesh(me)
bm.free()
o = bpy.data.objects.new("FirePit", me)
bpy.context.collection.objects.link(o)
finish(o, "FirePit", M["pit"])

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
    o.location = (r * math.cos(a), r * math.sin(a), radius + lift + salt_height(r * math.cos(a), r * math.sin(a)))
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
    bpy.ops.mesh.primitive_cube_add(size=1, location=(r * math.cos(a), r * math.sin(a),
                                                      0.0065 + salt_height(r * math.cos(a), r * math.sin(a))),
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
                                          location=(r * math.cos(a), r * math.sin(a),
                                                    s * 0.45 + heap + salt_height(r * math.cos(a), r * math.sin(a))),
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
    sizes.append(random.uniform(0.2, 0.25) if big else random.uniform(0.11, 0.14))
fit = 2 * math.pi * STONE_R / (sum(sizes) * 2) * 1.22          # scale to close the ring, packed shoulder to shoulder
a = 0.0
for i, half in enumerate(sizes):
    half *= fit
    a += half / STONE_R
    k = half / 0.18                                             # overall size relative to a typical stone
    # stagger in and out of the ring a little so it doesn't look laid with a compass
    r = STONE_R + (0.02 if i % 2 else -0.015) + random.uniform(-0.012, 0.012) + (1 - k) * 0.015
    # river-stone ovals: long along the ring, narrower across it, and fairly flat
    # stone slabs stood on end and driven into the ground round the fire: thin across the ring, wide along it,
    # taller than they're thick, each leaning a little in or out, all broken rock with hard edges
    sx, sy, sz = half * random.uniform(0.3, 0.42), half, half * random.uniform(0.95, 1.35)
    oval = False
    loc = (r * math.cos(a), r * math.sin(a), sz * 0.3)          # driven well into the ground, so they stand firm
    rot = (random.uniform(-0.06, 0.06), random.uniform(-0.14, 0.14), a + random.uniform(-0.12, 0.12))
    if oval:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=loc, rotation=rot)
    else:
        # (enough vertices for the scorch painted on below to have a ragged edge)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1, subdivisions=4, location=loc, rotation=rot)
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
        # (each stone its own patch of the rock, turned its own way, so no two show the same veins)
        uvl = bm.loops.layers.uv.verify()
        bm.normal_update()
        off = (random.random(), random.random())
        turn = random.uniform(0, math.pi)
        ct, st = math.cos(turn), math.sin(turn)
        for f in bm.faces:
            ax = max(range(3), key=lambda q: abs(f.normal[q]))
            for l in f.loops:
                c = l.vert.co
                pu, pv = ((c.y, c.z), (c.x, c.z), (c.x, c.y))[ax]
                l[uvl].uv = ((pu * ct - pv * st) * 0.24 + off[0], (pu * st + pv * ct) * 0.24 + off[1])
    # scorched by the fire on the side facing it (local -X points at the fire): sooted black, heaviest low down
    # where the flames lick and along the top edge where the smoke rolls over, in ragged patches; round the soot a
    # band of rock baked a rusty brown; the side away from the fire left its own grey
    col = bm.loops.layers.float_color.new("Col")
    ph = i * 1.7
    for vtx in bm.verts:
        x, y, z = vtx.co
        inward = float(smooth(-0.15, 0.75, np.float32(-x)))
        low = float(smooth(0.8, -0.3, np.float32(z)))
        crest = float(smooth(0.45, 0.85, np.float32(z))) * float(smooth(-0.3, 0.4, np.float32(-x)))
        ragged = (0.5 + 0.25 * math.sin(y * 11 + ph) * math.sin(z * 9 + ph * 0.7)
                  + 0.25 * math.sin(y * 23 - z * 17 + ph * 2.3))
        soot = min(1.0, max(0.0, inward * (0.35 + 0.75 * low) * (0.55 + 0.6 * ragged) + crest * 0.55 * ragged))
        soot = soot ** 0.8
        baked = max(0.0, min(1.0, inward * 1.3 - soot)) * 0.8   # the rusty fringe the soot didn't cover
        k = 1 - 0.9 * soot
        r, g, b = k, k * 0.96, k * 0.93
        r, g, b = r * (1 - baked * 0.25) + 0.62 * baked * 0.25, g * (1 - baked * 0.35) + 0.38 * baked * 0.35, \
            b * (1 - baked * 0.45) + 0.24 * baked * 0.45
        for l in vtx.link_loops:
            l[col] = (r, g, b, 1.0)
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
    # planted in the salt bed: the foot sits on its surface (it mounds up toward the middle)
    fx, fy = STICK_FOOT_R * math.cos(a), STICK_FOOT_R * math.sin(a)
    foot = Vector((fx, fy, salt_height(fx, fy) - 0.003))
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
    # the stick stands on the salt: it starts right at the foot (nothing poking out under the floor)
    length = d.length + extra
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
                                   r0 * k * flat * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)])
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
    # local Z runs up the stick from its foot
    shaft.matrix_world = Matrix.Translation(foot) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return finish(shaft, name, M["stick"])

def place(objs, angle_deg, along, name, stick=True):
    """Join the parts, move them onto the skewer and (optionally) add the stick into the same object."""
    o = join(objs, name)
    # each skewer is pushed into the ash a little differently: leaning, higher or lower, longer or shorter
    var = (random.uniform(-0.05, 0.05), random.uniform(-0.12, 0.08), random.uniform(-0.12, 0.12))
    # and the food sits higher or lower on its stick than its neighbours'
    along += random.uniform(-0.07, 0.07)
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
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1, calc_uvs=True)
    for vtx in bm.verts:
        # turn the sphere so its poles are the tail (-X) and the head (+X): its UVs then run along the fish
        # (v tail → head) and round it (u), which is how the skin textures are painted
        ox, oy, oz = vtx.co
        vtx.co = Vector((oz, oy, -ox))
        # the belly cut open from the vent to behind the gills: a groove pressed up along the underside, with
        # its lips pushed apart
        x, y, z = vtx.co
        open_along = smooth(-0.32, -0.22, np.float32(x)) * smooth(0.5, 0.4, np.float32(x)) * (z < -0.4)
        if open_along > 0:
            vtx.co.z += 0.55 * math.exp(-(y / 0.3) ** 2) * open_along      # the emptied cavity, deep
            vtx.co.y *= 1 + 0.3 * math.exp(-((abs(y) - 0.32) / 0.14) ** 2) * open_along
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

    # the belly walls either side of the cut, turned out like the covers of a book: each hinged along its lip of
    # the cut, folded outward and curling back as it goes, so the cooked flesh and rib bones inside face out
    x0, x1 = -0.27, 0.45                                   # (the same stretch as the cut, in the sphere's -1..1)
    nu, nv = 28, 7
    for sd in (-1, 1):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new()
        grid = []
        for i in range(nu + 1):
            xn = x0 + (x1 - x0) * i / nu
            X = xn * L
            taper = 1 + min(0, X) * 0.82
            head = 1 - max(0, X - 0.55) * sp["snout"]
            rho = math.sqrt(max(0.0, 1 - xn * xn))
            # the lip of the cut, a little up into the belly's curve
            hinge = Vector((X, sd * 0.4 * rho * W * taper * head + bend(X), -0.9 * rho * D * taper * head + wave(X)))
            span = math.sin(math.pi * i / nu) ** 0.7        # widest in the middle, closing to nothing at each end
            width = 0.62 * D * taper * head * rho * span
            p = hinge.copy()
            col = [bm.verts.new(p)]
            for j in range(nv):
                a = (j + 0.5) / nv
                th = math.radians(92 + 42 * a + 6 * math.sin(i * 0.9))   # folded right out, curling back at the edge
                p = p + Vector((0, sd * math.sin(th), -math.cos(th))) * (width / nv)
                col.append(bm.verts.new(p))
            grid.append(col)
        for i in range(nu):
            for j in range(nv):
                fc = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
                for l, (uu, vv) in zip(fc.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    l[uvl].uv = (uu / nu, vv / nv)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        me = bpy.data.meshes.new("BellyFlap")
        bm.to_mesh(me)
        bm.free()
        flap = bpy.data.objects.new("BellyFlap", me)
        bpy.context.collection.objects.link(flap)
        sm = flap.modifiers.new("Solidify", "SOLIDIFY")
        sm.thickness = 0.0045
        sm.offset = 0
        parts.append(finish(flap, "BellyFlap", M["fish_flesh"]))
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
    sizes = [random.uniform(0.09, 0.12) for _ in range(3)]
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
            # (shifted by half its depth, so the skewer runs right through the middle of the half's flesh)
            rings.append([bm.verts.new((x + r * math.cos(phi), face * (r * math.sin(phi) - rx * 0.5), z))
                          for r, z, _ in prof])
        uvl = bm.loops.layers.uv.new()
        for k in range(steps):
            for j in range(len(prof) - 1):
                f = bm.faces.new((rings[k][j], rings[k][j + 1], rings[k + 1][j + 1], rings[k + 1][j]))
                skin = prof[j][2] and prof[j + 1][2]
                f.material_index = 0 if skin else 1
                for l, (kk, jj) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                    l[uvl].uv = (kk / steps, 1 - jj / len(prof))
        # the cut face: the profile down one side and back up the other, mapped flat so it shows the cap's
        # flesh, the band of gills under it and the fibrous stem
        cut = bm.faces.new(rings[0] + rings[steps][::-1])
        cut.material_index = 2
        z_lo, z_hi = zc - sl, zc + hc
        for l in cut.loops:
            l[uvl].uv = ((l.vert.co.x - x) / (2 * rx) + 0.5, (l.vert.co.z - z_lo) / (z_hi - z_lo))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new("Shiitake")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Shiitake", me)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(M["shiitake_skin"])
        o.data.materials.append(M["gills"])
        o.data.materials.append(M["shiitake_cut"])
        for p in o.data.polygons:
            p.use_smooth = p.material_index != 2
        parts.append(o)
        x += rx + 0.015
    return parts


N = 256
u, v = grid01(N)
ridge = 0.5 + 0.5 * np.cos(u * 2 * np.pi * 5)                  # five ridges round the pod
# okra: deep green in the hollows, paler along the ridge crests, a fine downy fuzz, lighter toward the tip,
# and a few spots seared on the grill
crest = ridge ** 4
okra = mix((0.17, 0.38, 0.1), (0.36, 0.58, 0.2), fbm(N, 8, 30) * 0.5 + v * 0.3)
okra = mix(okra, (0.62, 0.78, 0.38), crest * 0.7)
okra = mix(okra, (0.75, 0.86, 0.6), (vnoise(N, 180, 180) > 0.8).astype(np.float32) * 0.25)      # fuzz
okra = mix(okra, (0.14, 0.12, 0.05), smooth(0.8, 0.93, vnoise(N, 26, 26)) * 0.8)                 # sear marks
TEX["okra"] = image("T_Okra", okra)
TEX["okra_n"] = image("T_Okra_N", to_normal(crest * 0.6 + vnoise(N, 180, 180) * 0.15, 2.0), data=True)
M["okra_calyx"] = pbr("OkraCalyx", (0.55, 0.62, 0.3), rough=0.6)
fib = vnoise(N, 4, 90)
sear = smooth(0.3, 0.05, v) + smooth(0.7, 0.95, v)
TEX["scallop"] = image("T_Scallop", mix(mix((0.95, 0.9, 0.8), (0.99, 0.96, 0.9), fib), (0.78, 0.5, 0.2),
                                        np.clip(sear, 0, 1) * 0.85))
M["okra"] = pbr("Okra", tex=TEX["okra"], nrm=TEX["okra_n"], rough=0.45, coat=0.2)
M["scallop"] = pbr("Scallop", tex=TEX["scallop"], rough=0.3, coat=0.4)


def okra():
    """Four okra pods across the stick, like the real thing: five sharp ridges with the faces between them slightly
    hollowed, a little twist along the pod, fullest just below the shoulder then tapering to a pointed tip that
    curls to one side; a calyx collar and a short stalk at the top."""
    parts = []
    for i, x in enumerate((-0.18, -0.06, 0.06, 0.18)):
        length = random.uniform(0.25, 0.3)
        curl = random.choice((-1, 1)) * random.uniform(0.015, 0.035)
        twist = random.uniform(0.2, 0.5)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new()
        rings, seg = 22, 30
        grid = []
        for k in range(rings + 1):
            t = k / rings
            # rounded shoulder at the stalk end, fullest near a fifth of the way down, then a long taper
            r = 0.04 * math.sin(math.pi / 2 * min(1, t / 0.18)) ** 0.6 * max(0.0, 1 - max(0.0, t - 0.18) / 0.82) ** 1.15 + 0.0012
            ring = []
            for j in range(seg):
                a = 2 * math.pi * j / seg + twist * t
                ridge = abs(math.cos(5 * (a - twist * t) / 2)) ** 3          # sharp crests, hollow faces
                rr = r * (0.84 + 0.22 * ridge)
                ring.append(bm.verts.new((rr * math.cos(a) + curl * t ** 3, rr * math.sin(a), -length / 2 + t * length)))
            grid.append(ring)
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
        # the calyx: a pale ridged collar where the pod meets its stalk, and the stalk cut off short
        s = 1 if down else -1                      # the stalk end (built at -z) is on top once flipped down
        cap_z = s * length / 2
        bpy.ops.mesh.primitive_torus_add(major_radius=0.028, minor_radius=0.008, major_segments=15, minor_segments=6,
                                         location=(x, 0, cap_z))
        parts.append(finish(active(), "OkraCalyx", M["okra_calyx"]))
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.014, radius2=0.008, depth=0.03,
                                        location=(x, 0, cap_z + s * 0.018),
                                        rotation=(0 if s > 0 else math.pi, 0, 0))
        parts.append(finish(active(), "OkraStalk", M["leek_green"]))
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
    """Five spears laid side by side across the skewer like a raft (out from the fire, so they show side-on),
    each like the real thing: a slightly bowed stalk, thicker and paler toward its cut end, small pointed bracts
    up its length, and a tight bud of overlapping scales at the tip."""
    parts = []
    for i in range(5):
        x = (i - 2) * 0.038
        r = random.uniform(0.011, 0.014)
        length = random.uniform(0.23, 0.28)
        y0 = -0.11 + random.uniform(-0.015, 0.015)
        bow = random.uniform(-0.01, 0.01)
        pts = [(x + bow * math.sin(math.pi * s), y0 + s * length, 0.0) for s in (k / 12 for k in range(13))]
        parts.append(tube(pts, r * 1.15, r * 0.82, M["asparagus"], "Asparagus", seg=12))
        # the cut end, pale and woody
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r * 1.16, depth=0.004, location=(x, y0, 0),
                                            rotation=(math.radians(90), 0, 0))
        parts.append(finish(active(), "AsparagusCut", M["asparagus_cut"]))
        # little triangular bracts climbing the stalk, alternating sides, pointing up toward the tip
        for k, s in enumerate((0.3, 0.45, 0.58, 0.7, 0.8)):
            side = 1 if k % 2 else -1
            px = x + bow * math.sin(math.pi * s) + side * r * 0.75
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=r * 0.45, radius2=0.0, depth=r * 1.8,
                                            location=(px, y0 + s * length, 0),
                                            rotation=(math.radians(-90), side * 0.35, random.uniform(0, 3)))
            o = active()
            o.scale = (1, 0.35, 1)
            parts.append(finish(o, "AsparagusBract", M["asparagus_tip"], smooth_shade=False))
        # the bud: scales packed tight round a point, a shade darker and touched with purple
        tip_y = y0 + length
        for k in range(7):
            a = 2 * math.pi * k / 7
            lift = (k % 2) * 0.004
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r * 0.55, radius2=0.0, depth=r * 2.6,
                                            location=(x + math.cos(a) * r * 0.35, tip_y + lift, math.sin(a) * r * 0.35),
                                            rotation=(math.radians(-90) + math.sin(a) * 0.3, 0, math.cos(a) * 0.3))
            parts.append(finish(active(), "AsparagusScale", M["asparagus_tip"]))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=10, ring_count=8, location=(x, tip_y + r * 0.9, 0))
        bud = active()
        bud.scale = (r * 0.7, r * 2.0, r * 0.7)
        parts.append(finish(bud, "AsparagusTip", M["asparagus_tip"]))
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


def shrimp_body(cx, R, size, name, flip=1):
    """One whole salt-grilled shrimp curled the way it cooks, skewered through the head and the tail so the body
    hangs in a U below the stick (in the stick's X/Z plane, so it's seen in profile from outside the fire).
    Returns its parts: the segmented shell, tail fan, rostrum, eyes, antennae, walking legs and swimmerets."""
    parts = []
    th0, th1 = math.pi, 2 * math.pi + 0.18                     # head end .. tail end, round the bottom of the U
    rings, seg = 64, 16
    centre = Vector((cx, 0, 0))

    def frame(s):
        """spine point, direction of travel (head -> tail), outward normal (the back) at s in 0..1"""
        th = th0 + (th1 - th0) * s
        p = centre + Vector((R * math.cos(th), 0, flip * R * math.sin(th)))
        t = Vector((-math.sin(th), 0, flip * math.cos(th)))
        n = (p - centre).normalized()
        return p, t, n

    def radius(s):
        if s < 0.36:                                            # head shell: the bulkiest part, rounded in front,
            front = math.sin(min(1.0, s / 0.07) * math.pi / 2) ** 0.6     # swelling over the gills, then
            r = 0.031 * (0.35 + 0.65 * front) * (1 + 0.06 * math.sin(s / 0.36 * math.pi))   # a slight waist
            r *= 1 - 0.1 * min(1.0, max(0.0, (s - 0.3) / 0.06))
        elif s < 0.93:                                          # six tail segments, each rim overlapping the next
            k = (s - 0.36) / 0.57
            f = ((s - 0.36) / 0.095) % 1
            r = (0.025 - 0.014 * k ** 1.3) * (0.94 + 0.1 * f ** 2)
        else:
            r = 0.0105 - 0.03 * (s - 0.93)
        return r * size

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = []
    for i in range(rings + 1):
        s = i / rings
        p, t, n = frame(s)
        side = Vector((0, 1, 0))
        r = radius(s)
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            # deeper back-to-belly than side to side, the belly flatter than the back
            dn = math.cos(a) * r * (1.15 if math.cos(a) > 0 else 0.85)
            ring.append(bm.verts.new(p + n * dn + side * math.sin(a) * r * 0.82))
        vs.append(ring)
    for i in range(rings):
        for j in range(seg):
            jn = (j + 1) % seg
            fc = bm.faces.new((vs[i][j], vs[i][jn], vs[i + 1][jn], vs[i + 1][j]))
            for l, (uu, vv) in zip(fc.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                l[uvl].uv = (uu / rings, vv / seg)
    bm.faces.new(vs[0][::-1])
    bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(body)
    parts.append(finish(body, "Shrimp", M["shrimp"]))

    def flat(name_, pts, thick, mat):
        """a thin plate through 3D points (tail fan blades, the rostrum)"""
        bm2 = bmesh.new()
        f2 = bm2.faces.new([bm2.verts.new(p) for p in pts])
        bmesh.ops.triangulate(bm2, faces=[f2], quad_method="BEAUTY", ngon_method="EAR_CLIP")
        me2 = bpy.data.meshes.new(name_)
        bm2.to_mesh(me2)
        bm2.free()
        o = bpy.data.objects.new(name_, me2)
        bpy.context.collection.objects.link(o)
        sm = o.modifiers.new("Solidify", "SOLIDIFY")
        sm.thickness = thick
        sm.offset = 0
        return finish(o, name_, mat, smooth_shade=False)

    # tail fan: the pointed telson in the middle and two uropods each side, spread like a fan past the tail end
    p, t, n = frame(1.0)
    y = Vector((0, 1, 0))
    for k, (ang, ln, wd, off) in enumerate(((0, 0.06, 0.01, 0), (-0.32, 0.058, 0.017, -1), (0.32, 0.058, 0.017, 1),
                                            (-0.65, 0.052, 0.015, -1), (0.65, 0.052, 0.015, 1))):
        d = (t * math.cos(ang) + n * math.sin(ang) * 0.6).normalized() * size
        w = n.cross(d).normalized() if ang == 0 else (n * math.cos(ang) * 0.3 - t * math.sin(ang)).normalized()
        base = p + y * off * 0.004 * size
        tip = base + d * ln
        parts.append(flat(f"ShrimpFan{k}", [base - w * wd * 0.3 * size, base + d * ln * 0.55 - w * wd * size,
                                            tip, base + d * ln * 0.55 + w * wd * size,
                                            base + w * wd * 0.3 * size], 0.003, M["shrimp_tail"]))

    # the head: a saw-edged rostrum pointing forward and a little up, the eyes on short stalks either side
    h, th, hn = frame(0.0)
    fwd = -th
    h = h - fwd * 0.01 * size + hn * 0.012 * size                # it grows from the top of the head shell
    rost = [h - fwd * 0.012 * size + hn * 0.012 * size]
    for k in range(7):
        a = (k + 1) / 7
        rost.append(h + (fwd * 0.07 * a + hn * (0.012 + 0.008 * a + (0.006 if k % 2 == 0 else 0))) * size)
    rost.append(h + (fwd * 0.085 + hn * 0.02) * size)
    rost += [h + (fwd * 0.045 + hn * 0.006) * size, h - fwd * 0.004 * size]
    parts.append(flat("ShrimpRostrum", rost, 0.0025, M["shrimp_tail"]))
    for sd in (-1, 1):
        e = h + (fwd * 0.004 - hn * 0.008 + y * sd * 0.017) * size
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0075 * size, segments=10, ring_count=6, location=e)
        parts.append(finish(active(), "ShrimpEye", M["pupil"]))
        # long antennae sweeping back over the curl, and the short antennules
        pts = []
        for k in range(14):
            a = k / 13
            ang = math.pi - a * 2.3
            rr = R * (1.25 + 0.5 * a)
            pts.append(Vector((cx + rr * math.cos(ang) - (1 - a) * 0.02, sd * (0.012 + 0.07 * a ** 1.5),
                               flip * (rr * math.sin(ang) * 0.9 + 0.012 * (1 - a)) - flip * sd * 0.02 * a)))
        pts[0] = h + (fwd * 0.012 - hn * 0.006 + y * sd * 0.008) * size
        parts.append(tube([tuple(q) for q in pts], 0.0016 * size, 0.0005, M["shrimp_leg"], "ShrimpAntenna", seg=5))
        a0 = h + (fwd * 0.01 + y * sd * 0.005) * size
        parts.append(tube([tuple(a0), tuple(a0 + (fwd * 0.03 + hn * 0.01) * size),
                           tuple(a0 + (fwd * 0.05 + hn * 0.005 + y * sd * 0.008) * size)],
                          0.0016 * size, 0.0007, M["shrimp_leg"], "ShrimpAntennule", seg=5))
        # five pairs of walking legs under the head, bent forward; five pairs of little swimmerets under the tail
        for k in range(5):
            s = 0.1 + k * 0.05
            q, tq, nq = frame(s)
            root = q - nq * radius(s) * 0.8 + y * sd * radius(s) * 0.5
            ln = (0.03 - k * 0.002) * size * random.uniform(0.85, 1.1)
            knee = root - nq * ln * 0.5 + tq * ln * 0.12 + y * sd * 0.007
            foot = knee - nq * ln * 0.2 - tq * ln * (0.5 + random.uniform(-0.1, 0.15)) + y * sd * 0.003
            parts.append(tube([tuple(root), tuple(knee), tuple(foot)], 0.0019 * size, 0.0007, M["shrimp_leg"],
                              "ShrimpLeg", seg=5))
        for k in range(5):
            s = 0.42 + k * 0.095
            q, tq, nq = frame(s)
            root = q - nq * radius(s) * 0.85 + y * sd * radius(s) * 0.35
            ln = 0.013 * size * (1 - k * 0.1)
            parts.append(tube([tuple(root), tuple(root - nq * ln * 0.45 + tq * ln * 0.9)], 0.0024 * size, 0.0012,
                              M["shrimp_leg"], "ShrimpSwimmeret", seg=5))
    return parts


def shrimp_pair():
    """Two shrimp on one stick, each curled and skewered through head and tail; one a little bigger, and turned
    the other way up, as they come off a real grill."""
    k = 1.5                    # big tiger prawns: each about a third of the stick, like the real thing
    return (shrimp_body(-0.072 * k, 0.06 * k, k * random.uniform(0.95, 1.08), "ShrimpA", flip=1) +
            shrimp_body(0.072 * k, 0.058 * k, k * random.uniform(0.9, 1.02), "ShrimpB", flip=-1))

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
# grilled squid: cream flesh going amber under a soy-sugar glaze, scored in a fine crosshatch whose cuts open and
# darken on the grill, reddish-purple skin speckles left here and there, and charred patches
score = smooth(0.08, 0.0, np.minimum(np.abs(((u * 9 + v * 6) % 1) - 0.5), np.abs(((u * 9 - v * 6) % 1) - 0.5)))
squid = mix((0.96, 0.88, 0.74), (0.88, 0.56, 0.28), np.clip(fbm(N, 5, 5) * 0.7 + v * 0.3, 0, 1))
squid = mix(squid, (0.5, 0.22, 0.08), score * 0.75)
squid = mix(squid, (0.55, 0.2, 0.25), (vnoise(N, 90, 90) > 0.82).astype(np.float32) * 0.45)
squid = mix(squid, (0.2, 0.09, 0.04), glaze_char * 0.55)
TEX["squid"] = image("T_Squid", squid)
TEX["squid_n"] = image("T_Squid_N", to_normal(-score * 0.8 + fbm(N, 20, 20) * 0.2, 2.5), data=True)
blister = (vnoise(N, 40, 40) > 0.78).astype(np.float32)
TEX["shishito"] = image("T_Shishito", mix(mix((0.22, 0.48, 0.14), (0.38, 0.62, 0.2), fbm(N, 6, 6)), (0.12, 0.1, 0.05),
                                          blister * 0.85))
toast = smooth(0.55, 0.75, fbm(N, 5, 5))
TEX["mochi"] = image("T_Mochi", mix((0.97, 0.95, 0.9), (0.68, 0.45, 0.2), toast * 0.85))
score = smooth(0.06, 0.0, np.minimum(np.abs(((u + v) * 8) % 1 - 0.5), np.abs(((u - v) * 8) % 1 - 0.5)))
TEX["eryngii"] = image("T_Eryngii", mix(mix((0.93, 0.87, 0.74), (0.82, 0.7, 0.5), fbm(N, 6, 6)), (0.45, 0.3, 0.15),
                                        score * 0.75))
# shiitake cap skin (u round, v from the rim up to the crown): dark chestnut brown, deeper at the crown, with a
# web of fine pale cracks and white flecks of the veil near the rim, toasted darker in places
crack = 1 - smooth(0.0, 0.03, np.abs(fbm(N, 9, 6) - 0.5))
cap = mix((0.42, 0.27, 0.14), (0.24, 0.13, 0.06), smooth(0.2, 0.9, v))
cap = mix(cap, (0.82, 0.7, 0.54), crack * 0.6)
cap = mix(cap, (0.9, 0.85, 0.76), (vnoise(N, 60, 60) > 0.86).astype(np.float32) * smooth(0.3, 0.0, v) * 0.7)
cap = mix(cap, (0.14, 0.08, 0.04), smooth(0.7, 0.9, fbm(N, 5, 5)) * 0.4)
TEX["shiitake_cap"] = image("T_ShiitakeCap", cap)
TEX["shiitake_cap_n"] = image("T_ShiitakeCap_N", to_normal(-crack * 0.6, 2.0), data=True)
# its cut face (flat, v from the stem's foot to the crown): fibrous stem, a band of packed gills under the cap,
# firm white cap flesh above, browning along the top where the skin is
cut = mix((0.9, 0.85, 0.74), (0.8, 0.72, 0.58), vnoise(N, 80, 3) * smooth(0.55, 0.3, v))
gill_band = smooth(0.48, 0.52, v) * smooth(0.62, 0.58, v)
cut = mix(cut, (0.66, 0.54, 0.38), gill_band * (0.6 + 0.4 * (0.5 + 0.5 * np.sin(u * 2 * np.pi * 40))))
cut = mix(cut, (0.5, 0.33, 0.18), smooth(0.9, 1.0, v) * 0.8)
TEX["shiitake_cut"] = image("T_ShiitakeCut", cut)

# asparagus (u round the stalk, v from the cut end to the tip): pale and fibrous low down, deepening to a rich
# green, fine lengthwise fibres, a blush of purple near the top, and grill bars seared across it
fibres = vnoise(N, 70, 3)
asp = mix((0.72, 0.76, 0.5), (0.3, 0.52, 0.16), smooth(0.0, 0.45, v))
asp = mix(asp, (0.22, 0.4, 0.12), fibres * 0.35)
asp = mix(asp, (0.36, 0.26, 0.3), smooth(0.8, 1.0, v) * 0.35)
asp = mix(asp, (0.14, 0.12, 0.05), smooth(0.84, 0.94, 0.5 + 0.5 * np.sin(v * 2 * np.pi * 5)) *
          smooth(0.3, 0.6, fbm(N, 5, 5)) * 0.85)
TEX["asparagus"] = image("T_Asparagus", asp)
TEX["asparagus_n"] = image("T_Asparagus_N", to_normal(fibres * 0.6, 2.0), data=True)
M.update({
    "shiitake_skin": pbr("ShiitakeSkin", tex=TEX["shiitake_cap"], nrm=TEX["shiitake_cap_n"], rough=0.6),
    "shiitake_cut": pbr("ShiitakeCut", tex=TEX["shiitake_cut"], rough=0.75),
    "asparagus": pbr("Asparagus", tex=TEX["asparagus"], nrm=TEX["asparagus_n"], rough=0.35, coat=0.3),
    "asparagus_tip": pbr("AsparagusTip", (0.26, 0.34, 0.15), rough=0.5),
    "asparagus_cut": pbr("AsparagusCut", (0.85, 0.86, 0.66), rough=0.7),
    "chicken": pbr("Chicken", tex=TEX["chicken"], rough=0.35, coat=0.5),
    "leek": pbr("Leek", (0.9, 0.93, 0.82), rough=0.45),
    "leek_green": pbr("LeekGreen", (0.42, 0.62, 0.25), rough=0.45),
    "pork": pbr("PorkBelly", tex=TEX["pork"], rough=0.35, coat=0.4),
    "squid": pbr("Squid", tex=TEX["squid"], nrm=TEX["squid_n"], rough=0.25, coat=0.6),
    "shishito": pbr("Shishito", tex=TEX["shishito"], rough=0.3, coat=0.4),
    "mochi": pbr("Mochi", tex=TEX["mochi"], rough=0.6),
    "eryngii": pbr("Eryngii", tex=TEX["eryngii"], rough=0.55),
    "eryngii_cap": pbr("EryngiiCap", (0.42, 0.3, 0.18), rough=0.6),
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


def tube(points, r0, r1, mat, name, seg=8):
    """A tapered round tube through a list of points (squid arms): radius r0 at the start to r1 at the end."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    rings = []
    n = len(points)
    for i, p in enumerate(points):
        p = Vector(p)
        d = (Vector(points[min(i + 1, n - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        side = d.cross(Vector((0, 1, 0)))
        if side.length < 1e-4:
            side = d.cross(Vector((1, 0, 0)))
        side.normalize()
        up = side.cross(d)
        r = r0 + (r1 - r0) * i / (n - 1)
        rings.append([bm.verts.new(p + (side * math.cos(2 * math.pi * j / seg) + up * math.sin(2 * math.pi * j / seg)) * r)
                      for j in range(seg)])
    for i in range(n - 1):
        for j in range(seg):
            jn = (j + 1) % seg
            f = bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
            for l, (uu, vv) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                l[uvl].uv = (uu / seg, vv / (n - 1))
    bm.faces.new(rings[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat)


def squid():
    """A whole grilled squid (イカ焼き) on the stick: a long tapering mantle scored in a crosshatch and lacquered
    with sauce, a broad diamond of fins at its tip, the head with its eyes below, and eight short arms plus two
    long tentacles curling down and out."""
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=1, calc_uvs=True)
    for vtx in bm.verts:
        ox, oy, oz = vtx.co
        vtx.co = Vector((oz, oy, -ox))                    # poles along the stick, like the fish
        t = (vtx.co.x + 1) / 2                            # 0 head end .. 1 tip
        k = math.sin(math.pi * min(1.0, t * 1.6 + 0.12) / 2) ** 0.4 * (1 - 0.82 * t ** 2.2)
        vtx.co.y *= 0.032 * k                             # a flattened tube
        vtx.co.z *= 0.046 * k
        vtx.co.x = vtx.co.x * 0.16 + 0.06
    me = bpy.data.meshes.new("SquidBody")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("SquidBody", me)
    bpy.context.collection.objects.link(body)
    parts = [finish(body, "SquidBody", M["squid"])]
    # the fins: a wide diamond across the tip of the mantle
    parts.append(flat_fin("SquidFin", [(0.04, 0.0), (-0.035, 0.085), (-0.1, 0.0), (-0.035, -0.085)], 0.007,
                          M["squid"], at=(0.2, 0, 0)))
    # the head, a little narrower than the mantle's open end, with an eye on each side
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=10, location=(-0.115, 0, 0))
    head = active()
    head.scale = (0.03, 0.026, 0.032)
    parts.append(finish(head, "SquidHead", M["squid"]))
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.008, segments=10, ring_count=6, location=(-0.11, side * 0.024, 0.008))
        parts.append(finish(active(), "SquidEye", M["pupil"]))
    # arms fanning down from the head, curling at the ends; the two long feeding tentacles reach further
    for i in range(10):
        long_ = i in (3, 6)
        spread = (i - 4.5) / 4.5                          # -1 .. 1 across the fan
        length = random.uniform(0.18, 0.22) if long_ else random.uniform(0.09, 0.12)
        curl = random.uniform(0.5, 1.4) * (1 if spread >= 0 else -1)
        pts = []
        for k in range(10):
            s = k / 9
            pts.append((-0.13 - s * length,
                        spread * 0.02 + random.uniform(-0.002, 0.002),
                        spread * (0.02 + s * length * 0.45) + math.sin(s * math.pi * curl) * 0.02 * s))
        parts.append(tube(pts, 0.0075 if not long_ else 0.006, 0.0015, M["squid"], "SquidArm"))
    # a good-sized squid, half as big again as it's drawn above
    for o in parts:
        o.location *= 1.5
        o.scale *= 1.5
    return parts


M["pepper_in"] = pbr("PepperInside", (0.74, 0.86, 0.52), rough=0.5)


def pepper_chunk(x, w, h, R, turn, tilt):
    """A cut square of green pepper wall: curved like the pepper it came from, glossy green outside and pale
    inside, with the cut edges showing its thickness. The skewer goes straight through the wall (local X)."""
    th = 0.007
    span = w / R / 2
    nu, nv = 8, 5
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()

    def surf(rad):
        return [[bm.verts.new((rad * math.cos(-span + 2 * span * i / nu) - R,
                               rad * math.sin(-span + 2 * span * i / nu),
                               -h / 2 + h * j / nv + random.uniform(-0.002, 0.002) * (0 < j < nv)))
                 for j in range(nv + 1)] for i in range(nu + 1)]
    out, inn = surf(R), surf(R - th)
    for g, flip, mat in ((out, False, 0), (inn, True, 1)):
        for i in range(nu):
            for j in range(nv):
                q = (g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1])
                f = bm.faces.new(q[::-1] if flip else q)
                f.material_index = mat
                for l, (uu, vv) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    l[uvl].uv = (uu / nu, vv / nv)
    # the four cut edges
    rim = [(out[i][0], out[i + 1][0], inn[i + 1][0], inn[i][0]) for i in range(nu)]
    rim += [(out[i + 1][nv], out[i][nv], inn[i][nv], inn[i + 1][nv]) for i in range(nu)]
    rim += [(out[0][j + 1], out[0][j], inn[0][j], inn[0][j + 1]) for j in range(nv)]
    rim += [(out[nu][j], out[nu][j + 1], inn[nu][j + 1], inn[nu][j]) for j in range(nv)]
    for q in rim:
        bm.faces.new(q).material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Pepper")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Pepper", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["shishito"])
    o.data.materials.append(M["pepper_in"])
    for p in o.data.polygons:
        p.use_smooth = p.material_index == 0
    # pierced through the wall, then turned well round on the stick and tipped, so its face shows to the side
    # at its own angle (a chunk square-on to the stick would be seen edge-on)
    o.location = (x, 0, 0)
    o.rotation_euler = (tilt, 0, turn)
    return o


def shishito():
    """Green pepper cut into chunks, threaded on one after another, each a different size and set at its own
    angle on the stick."""
    parts = []
    x = -0.16
    while x < 0.16:
        w = random.uniform(0.07, 0.1)
        parts.append(pepper_chunk(x, w, random.uniform(0.065, 0.09), random.uniform(0.05, 0.075),
                                  random.choice((-1, 1)) * random.uniform(1.0, 1.3), random.uniform(-0.5, 0.5)))
        x += random.uniform(0.06, 0.08)
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
    """King oyster mushroom cut lengthwise into thick slabs, the way it's grilled: each slab the mushroom's
    silhouette — a long fat stem swelling a little toward the base, a small flattish cap — its cut face scored in a
    crosshatch and browned, the brown cap skin along the top edge. Skewered across the stems."""
    parts = []
    for n, x in enumerate((-0.13, 0.0, 0.13)):
        w = random.uniform(0.045, 0.055)            # stem half-width
        h = random.uniform(0.2, 0.24)                # stem length
        cw = w * random.uniform(1.3, 1.55)           # cap half-width
        ch = random.uniform(0.022, 0.03)             # cap height
        z0 = -h * 0.55
        outline = [(-w * 0.9, z0), (w * 0.9, z0)]
        outline += [(w * (1.05 - 0.1 * t), z0 + t * h) for t in (0.3, 0.7, 1.0)]
        outline += [(cw * math.cos(a), z0 + h + ch * math.sin(a)) for a in (math.pi * k / 10 for k in range(11))]
        outline += [(-w * (1.05 - 0.1 * t), z0 + t * h) for t in (1.0, 0.7, 0.3)]
        bm = bmesh.new()
        th = 0.032
        front = [bm.verts.new((px, -th / 2, pz)) for px, pz in outline]
        back = [bm.verts.new((px, th / 2, pz)) for px, pz in outline]
        ff = bm.faces.new(front[::-1])
        fb = bm.faces.new(back)
        m = len(outline)
        sides = [bm.faces.new((front[i], front[(i + 1) % m], back[(i + 1) % m], back[i])) for i in range(m)]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        uvl = bm.loops.layers.uv.new()
        for f in bm.faces:
            for l in f.loops:
                l[uvl].uv = (l.vert.co.x * 4 + 0.5, l.vert.co.z * 4 + 0.5)
        # the cap's skin shows on the rim along the top
        for f in sides:
            f.material_index = 1 if f.calc_center_median().z > z0 + h * 0.98 else 0
        me = bpy.data.meshes.new("Eryngii")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Eryngii", me)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(M["eryngii"])
        o.data.materials.append(M["eryngii_cap"])
        o.location = (x, 0, 0)
        o.rotation_euler = (0, random.uniform(-0.12, 0.12), 0)
        bevel(o, 0.005, 2)
        parts.append(o)
    return parts


place(yakitori(), 75, 0.6, "Yakitori")
place(pork_belly(), 112, 0.6, "PorkBelly")
place(squid(), 178, 0.58, "Squid")
place(shishito(), 144, 0.6, "Shishito")
place(eryngii(), 357, 0.6, "KingOyster")
place(asparagus(), 25, 0.6, "Asparagus")
place(okra(), 161, 0.6, "Okra")
place(scallops(), 40, 0.6, "Scallop")


def blood_cake():
    """米血糕 on a stick: a thick slab of glutinous rice set with pig's blood, dark purple-grey with every grain
    showing, brushed with sweet soy and rolled in peanut powder with a few leaves of coriander."""
    N2 = 256
    uu, vv = grid01(N2)
    grain = smooth(0.45, 0.75, vnoise(N2, 70, 70))
    cake = mix((0.16, 0.1, 0.12), (0.3, 0.22, 0.25), grain)
    cake = mix(cake, (0.36, 0.18, 0.08), smooth(0.6, 0.8, fbm(N2, 4, 4)) * 0.5)              # glaze
    cake = mix(cake, (0.84, 0.66, 0.4), (vnoise(N2, 120, 120) > 0.72).astype(np.float32) * 0.85)   # peanut powder
    cake = mix(cake, (0.3, 0.55, 0.2), (vnoise(N2, 30, 30) > 0.93).astype(np.float32))           # coriander
    TEX["blood_cake"] = image("T_BloodCake", cake)
    TEX["blood_cake_n"] = image("T_BloodCake_N", to_normal(grain, 3.0), data=True)
    M["blood_cake"] = pbr("BloodCake", tex=TEX["blood_cake"], nrm=TEX["blood_cake_n"], rough=0.55, coat=0.2)
    return [rounded_box("BloodCake", (0.16, 0.035, 0.07), M["blood_cake"], (0.0, 0, 0), 0.012)]


place(blood_cake(), 224, 0.6, "BloodCake")
# ---------------------------------------------------------------------------------------------------------

place(fish(), 95, 0.64, "ExtraFish")
place(fish("saury"), -97, 0.6, "Saury")
place(fish("mackerel"), -122, 0.62, "Mackerel")
place(corn_cob(), 55, 0.6, "GrilledCorn")
place(shiitake_halves(), 128, 0.6, "GrilledShiitake")
# (the yaki onigiri isn't skewered: it's toasted on the grill net with the mochi, see below)
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
                                         location=(r * math.cos(a), r * math.sin(a),
                                                   size[2] * 0.7 + salt_height(r * math.cos(a), r * math.sin(a))),
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


# (the salt pot now stands in the seasoning box with the others, below)


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


# all four live in a wooden seasoning box beside the fire; only their spoons and the brush are picked up
BOX_ANGLE, BOX_R, BOX_Z = -134.0, 1.75, 0.016      # on the left of the fire as the camera sees it
a = math.radians(BOX_ANGLE)
box_c = Vector((BOX_R * math.cos(a), BOX_R * math.sin(a), 0))
tang = Vector((-math.sin(a), math.cos(a), 0))
out = Vector((math.cos(a), math.sin(a), 0))
M["box_wood"] = pbr("SeasoningBoxWood", tex=TEX["bamboo"], rough=0.6)

# the box: an open wooden tray, long side along the stones
bpy.ops.mesh.primitive_cube_add(size=1, location=(box_c.x, box_c.y, 0.04), rotation=(0, 0, a + math.pi / 2))
box = active()
box.scale = (0.86, 0.27, 0.08)
apply_scale(box)
bm = bmesh.new()
bm.from_mesh(box.data)
bm.normal_update()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
bm.to_mesh(box.data)
bm.free()
sol = box.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = 0.014
bpy.ops.object.select_all(action="DESELECT")
box.select_set(True)
bpy.context.view_layer.objects.active = box
bpy.ops.object.modifier_apply(modifier="Solidify")
cyl_uv(box)
finish(box, "SeasoningBox", M["box_wood"], smooth_shade=False)


def in_box(offset):
    return box_c + tang * offset


def utensil(name, head, handle_end, head_obj, radius=0.006):
    """A spoon or brush standing in its pot: the head down in it, the handle leaning out over the rim.
    Its origin is the head, which is what's carried over the food."""
    parts_ = [head_obj, stick_between(head, handle_end, radius, M["spoon_wood"], name + "Handle")]
    return centre_origin(join(parts_, name), tuple(head))


def spoon_bowl(at, r):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=14, ring_count=8, location=at)
    o = active()
    o.scale = (r, r * 0.8, r * 0.35)
    return finish(o, "SpoonBowl", M["spoon_wood"])


lean = out * 0.09 + Vector((0, 0, 0.21))
pots = (("SaltPot", -0.3, 0.085, 0.1, M["pot"], 0.3, M["salt"], 0.03, 0.06),
        ("SoyPot", -0.1, 0.08, 0.11, M["soy_pot"], 0.3, M["soy"], 0.008, 0.0),
        ("MilkJar", 0.1, 0.075, 0.1, M["milk_jar"], 0.2, M["milk"], 0.016, 0.0),
        ("PeanutBowl", 0.3, 0.095, 0.07, M["bowl_wood"], 0.45, M["peanut"], 0.03, 0.08))
for name, off, rad, depth, glaze, belly, fill, fill_h, rough in pots:
    c = in_box(off)
    pot = open_pot(c.x, c.y, rad, depth, glaze, belly=belly, name=name)
    fl = filling(c.x, c.y, depth * 0.85, rad * 0.9, fill_h, fill, rough=rough)
    for o in (pot, fl):
        o.location.z += BOX_Z
    centre_origin(join([pot, fl], name), (c.x, c.y, 0.0))
    head = Vector((c.x, c.y, BOX_Z + depth * 0.7))
    if name in ("SoyPot", "MilkJar"):
        # a basting brush for each sauce: a tuft of bristles on a wooden handle (pale ones for the milk)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=head)
        tuft = active()
        tuft.scale = (0.022, 0.016, 0.04)
        bristle = M["bristle"] if name == "SoyPot" else M.setdefault(
            "bristle_pale", pbr("BrushBristlePale", (0.86, 0.8, 0.66), rough=0.7))
        utensil("SoyBrush" if name == "SoyPot" else "MilkBrush", head, head + lean + out * 0.02,
                finish(tuft, "BrushBristles", bristle), 0.008)
    elif name == "PeanutBowl":
        utensil("PeanutSpoon", head, head + lean, spoon_bowl(head, 0.03))
    else:
        # salt is taken by the pinch, by hand: just a marker where the fingers dip in (the web app draws the hand)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=8, ring_count=4, location=head)
        utensil("SaltPinch", head, head + Vector((0, 0, 0.02)), finish(active(), "SaltPinchMark", M["salt"]), 0.002)


# ---------------------------------------------------------------------------------------------------------
# a wooden bucket of water on the left, with a dipper (柄杓) in it: splash food or the coals, and drop the bare
# sticks and burnt scraps in it, as you do at a real fire
M["bucket_wood"] = pbr("BucketWood", tex=TEX["bamboo"], rough=0.65)
M["hoop"] = pbr("BucketHoop", (0.16, 0.16, 0.17), rough=0.4, metal=0.8)
M["water"] = pbr("Water", (0.3, 0.5, 0.62), rough=0.05, coat=1.0)
bx, by = -1.75, -0.16
BUCKET_R, BUCKET_H = 0.24, 0.34
bucket = open_pot(bx, by, BUCKET_R, BUCKET_H, M["bucket_wood"], belly=0.08, name="WaterBucket")
hoops = []
for hz in (0.07, 0.26):
    bpy.ops.mesh.primitive_torus_add(major_radius=BUCKET_R * 0.86 + 0.012, minor_radius=0.008, major_segments=40,
                                     minor_segments=6, location=(bx, by, hz))
    hoops.append(finish(active(), "Hoop", M["hoop"]))
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=BUCKET_R * 0.84, depth=0.006, location=(bx, by, BUCKET_H * 0.78))
surface = finish(active(), "WaterSurface", M["water"])
centre_origin(join([bucket, *hoops, surface], "WaterBucket"), (bx, by, 0.0))
# the dipper: a little round cup on a long handle, leaning out of the bucket
cup_at = Vector((bx + 0.05, by, BUCKET_H * 0.82))
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.045, depth=0.05, location=cup_at)
cup = finish(active(), "DipperCup", M["bucket_wood"])
handle = stick_between(cup_at + Vector((-0.04, 0, 0.0)), cup_at + Vector((-0.2, 0.02, 0.28)), 0.007, M["spoon_wood"],
                       "DipperHandle")
centre_origin(join([cup, handle], "WaterDipper"), tuple(cup_at))

# ---------------------------------------------------------------------------------------------------------
# a little wire grill net laid over the coals, just for toasting mochi (切り餅) on
NET_Z = 0.62
NET_R = 0.25
wires = []
# a round net: a wire hoop, with straight wires across it both ways, standing on three legs splayed out
for k in range(-6, 7):
    t = k * NET_R / 6.5
    half = math.sqrt(max(0.0, NET_R * NET_R - t * t))
    wires.append(stick_between((-half, t, NET_Z), (half, t, NET_Z), 0.0028, M["net"], "Wire"))
    wires.append(stick_between((t, -half, NET_Z - 0.004), (t, half, NET_Z - 0.004), 0.0028, M["net"], "Wire"))
hoop = 48
for k in range(hoop):
    a0, a1 = 2 * math.pi * k / hoop, 2 * math.pi * (k + 1) / hoop
    wires.append(stick_between((NET_R * math.cos(a0), NET_R * math.sin(a0), NET_Z),
                               (NET_R * math.cos(a1), NET_R * math.sin(a1), NET_Z), 0.006, M["net"], "Hoop"))
for k in range(3):
    a = math.radians(90 + 120 * k)
    top = (NET_R * math.cos(a), NET_R * math.sin(a), NET_Z)
    wires.append(stick_between(top, (NET_R * 1.3 * math.cos(a), NET_R * 1.3 * math.sin(a), 0.0), 0.006, M["net"], "Leg"))
join(wires, "GrillNet")

# the mochi: a flat block of pounded rice, with a "Puffed" shape key the web app turns up as it toasts —
# the top swells into a dome and bursts out to one side, the way kirimochi balloons on the grill
M["netmochi"] = pbr("NetMochi", tex=TEX["mochi"], rough=0.6)
HX, HY, HZ = 0.062, 0.045, 0.022
bpy.ops.mesh.primitive_cube_add(size=2, location=(-0.11, 0.0, NET_Z + HZ + 0.004),
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

# the yaki onigiri lies flat on the net beside it, a nori band round its base
oni = join(onigiri(), "Onigiri")
oni.rotation_euler = (math.radians(90), 0, random.uniform(0, math.pi))
oni.location = (0.1, -0.07, NET_Z + 0.04)

mochi_o.shape_key_add(name="Basis")
puffed = mochi_o.shape_key_add(name="Puffed")
for i, kv in enumerate(puffed.data):
    c = mochi_o.data.vertices[i].co
    nx, ny, nz = c.x / HX, c.y / HY, c.z / HZ
    # toasted, the block balloons into a round, soft dome: the sides bow out and round off, and the top
    # rises into a smooth ball-like puff over the whole block
    k = Vector((c.x * 1.12, c.y * 1.12, c.z))
    if nz > -0.3:
        r2 = min(1.0, (nx * nx + ny * ny) / 1.6)
        lift = (nz + 0.3) / 1.3
        k.z += 0.07 * math.sqrt(1 - r2) * lift
        # pull the upper corners in, so it reads as round rather than a swollen box
        round_in = 1 - 0.18 * lift * r2
        k.x *= round_in
        k.y *= round_in
    kv.co = k


# ---------------------------------------------------------------------------------------------------------
# miso soup (味噌汁) in a lacquered soup bowl, on the table in front of the fire: the bowl black lacquer
# outside with a red rim line, vermilion inside, on a low foot; the soup cloudy with miso settling in soft
# swirls, a few cubes of tofu, torn wakame and rings of scallion floating in it. The soup is its own object
# (MisoLiquid, a child of the bowl) so the web app can let it go down as it's drunk.
N = 512
u, v = grid01(N)
cx_, cy_ = u - 0.5, v - 0.5
rr_ = np.sqrt(cx_ ** 2 + cy_ ** 2) * 2
ang_ = np.arctan2(cy_, cx_)
swirl = fbm(N, 5, 5) * 0.6 + 0.4 * (0.5 + 0.5 * np.sin(ang_ * 3 + rr_ * 9 + fbm(N, 3, 3) * 4))
miso = mix((0.62, 0.42, 0.2), (0.82, 0.64, 0.38), smooth(0.3, 0.75, swirl))
miso = mix(miso, (0.5, 0.32, 0.15), smooth(0.85, 1.0, rr_) * 0.6)            # darker where it meets the bowl
miso = mix(miso, (0.9, 0.78, 0.55), (vnoise(N, 90, 90) > 0.92).astype(np.float32) * 0.4)   # flecks of miso
TEX["miso"] = image("T_Miso", miso)
M["lacquer"] = pbr("BlackLacquer", (0.05, 0.035, 0.03), rough=0.18, coat=0.9)
M["lacquer_red"] = pbr("RedLacquer", (0.6, 0.08, 0.04), rough=0.2, coat=0.9)
M["miso"] = pbr("MisoSoup", tex=TEX["miso"], rough=0.15, coat=0.6)
M["tofu"] = pbr("Tofu", (0.96, 0.94, 0.86), rough=0.5)
M["wakame"] = pbr("Wakame", (0.12, 0.24, 0.1), rough=0.3, coat=0.4)
M["negi"] = pbr("Scallion", (0.45, 0.68, 0.25), rough=0.4)


def miso_soup(x0, y0):
    outer = [(0.068, 0.0), (0.076, 0.004), (0.078, 0.016), (0.072, 0.02), (0.085, 0.024), (0.125, 0.05),
             (0.152, 0.088), (0.166, 0.128), (0.17, 0.142)]
    inner = [(0.161, 0.142), (0.156, 0.124), (0.142, 0.088), (0.11, 0.055), (0.06, 0.036), (0.001, 0.032)]
    prof = outer + inner
    seg = 56
    bm = bmesh.new()
    rings = [[bm.verts.new((x0 + r * math.cos(2 * math.pi * k / seg), y0 + r * math.sin(2 * math.pi * k / seg), z))
              for r, z in prof] for k in range(seg)]
    for k in range(seg):
        kn = (k + 1) % seg
        for j in range(len(prof) - 1):
            fc = bm.faces.new((rings[k][j], rings[kn][j], rings[kn][j + 1], rings[k][j + 1]))
            # outside black, a red line round the rim, inside vermilion
            fc.material_index = 0 if j < len(outer) - 2 else (2 if j == len(outer) - 2 else 1)
    bm.faces.new([rings[k][0] for k in range(seg)][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("MisoSoup")
    bm.to_mesh(me)
    bm.free()
    bowl = bpy.data.objects.new("MisoSoup", me)
    bpy.context.collection.objects.link(bowl)
    for m_ in (M["lacquer"], M["lacquer_red"], M["lacquer_red"]):
        bowl.data.materials.append(m_)
    for p in bowl.data.polygons:
        p.use_smooth = True
    # its origin at its own foot, so the web app turns it where it stands (not round the fire)
    centre_origin(bowl, at=(x0, y0, 0.0))
    # the soup: a disc just under the rim, mapped flat for its swirl of miso
    level = 0.112
    rs = 0.148
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=rs, fill_type="NGON", location=(x0, y0, level))
    soup = active()
    bm = bmesh.new()
    bm.from_mesh(soup.data)
    uvl = bm.loops.layers.uv.verify()
    for fc in bm.faces:
        for l in fc.loops:
            c = l.vert.co
            l[uvl].uv = (c.x / (2 * rs) + 0.5, c.y / (2 * rs) + 0.5)
    bm.to_mesh(soup.data)
    bm.free()
    finish(soup, "MisoLiquid", M["miso"], smooth_shade=False)
    floats = [soup]
    for k in range(5):
        a = random.uniform(0, math.pi * 2)
        d = random.uniform(0.02, 0.09)
        s_ = random.uniform(0.018, 0.024)
        bpy.ops.mesh.primitive_cube_add(size=s_, location=(x0 + d * math.cos(a), y0 + d * math.sin(a), level + s_ * 0.15),
                                        rotation=(random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, 3)))
        o = active()
        bevel(o, s_ * 0.12, 2)
        floats.append(finish(o, "MisoTofu", M["tofu"]))
    for k in range(4):
        a = random.uniform(0, math.pi * 2)
        d = random.uniform(0.03, 0.1)
        bm = bmesh.new()
        n_ = 9
        cxw, cyw = x0 + d * math.cos(a), y0 + d * math.sin(a)
        pts = [bm.verts.new((cxw + math.cos(2 * math.pi * q / n_) * random.uniform(0.012, 0.03),
                             cyw + math.sin(2 * math.pi * q / n_) * random.uniform(0.01, 0.022), level + 0.002))
               for q in range(n_)]
        bm.faces.new(pts)
        me2 = bpy.data.meshes.new("MisoWakame")
        bm.to_mesh(me2)
        bm.free()
        o = bpy.data.objects.new("MisoWakame", me2)
        bpy.context.collection.objects.link(o)
        floats.append(finish(o, "MisoWakame", M["wakame"], smooth_shade=False))
    for k in range(7):
        a = random.uniform(0, math.pi * 2)
        d = random.uniform(0.01, 0.11)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.008, minor_radius=0.0028, major_segments=12, minor_segments=6,
                                         location=(x0 + d * math.cos(a), y0 + d * math.sin(a), level + 0.002))
        floats.append(finish(active(), "MisoNegi", M["negi"]))
    liquid = join(floats, "MisoLiquid")
    liquid.parent = bowl
    liquid.matrix_parent_inverse = bowl.matrix_world.inverted()
    return bowl


miso_bowl = miso_soup(0.19, -1.84)

# =====================================================================
# Group, preview scene, outputs
# =====================================================================

root = bpy.data.objects.new("GrilledFish", None)
bpy.context.collection.objects.link(root)
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in parts:
    if o.name != "MisoLiquid":                 # (the soup stays inside its bowl)
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
