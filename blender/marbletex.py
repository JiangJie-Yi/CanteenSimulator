"""The grill station's stone, painted procedurally (tileable both ways) and saved as JPEG for the game to map:

- public/textures/marble_panel_dark.jpg: the cook's table's body below its top (the owner's: a dark stone), a tile 1.2 across and as high
  as the body: a near-black marble, honed, its ground clouded charcoal and a warmer brown-black, drifts of smoky grey veining running across
  it on a slant, fine pale threads through them (as Nero Marquina has) and here and there a thread of warm gold, the odd crystal glint.
- public/textures/marble_panel.jpg: the white one it was: a warm white marble, honed, its ground faintly clouded grey and cream, drifts of
  soft grey veining running across it on a slant with a few fine dark threads through them, the odd pale crystal glint.

Run:
    blender -b --factory-startup --python blender/marbletex.py -- <project path>
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJECT, "public", "textures")
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def save(name, rgb):
    """write an (h, w, 3) display-space array as a JPEG (rows bottom-up, as Blender's images are)"""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.colorspace_settings.name = "sRGB"
    a = np.ones((h, w, 1), np.float32)
    img.pixels.foreach_set(np.concatenate([np.clip(rgb, 0, 1), a], -1).astype(np.float32).ravel())
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    sc.view_settings.view_transform = "Standard"
    img.save_render(os.path.join(OUT, name + ".jpg"), scene=sc)
    print("SAVED", name)


N = 1024
seed(61)
u, v = grid01(N)
# (the ground: a warm white, clouded a little)
cloud = fbm(N, 3, 3, 5)
base = mix(np.array((0.9, 0.885, 0.85), np.float32), np.array((0.8, 0.79, 0.77), np.float32), smooth(0.35, 0.9, cloud) * 0.6)
base = mix(base, np.array((0.93, 0.9, 0.84), np.float32), smooth(0.6, 1.0, fbm(N, 6, 6, 4)) * 0.3)
# (the veining: bands across on a slant (whole turns over the tile, so it repeats), warped by turbulence; soft wide drifts, and in them
# sharp fine threads)
# (warped gently: the veins flow across on their slant, meandering, not curling into rings)
warp = (fbm(N, 2, 3, 5) - 0.5) * 0.9 + (fbm(N, 8, 8, 3) - 0.5) * 0.18
band = np.abs(np.sin(2 * math.pi * (u * 2 + v * 1 + warp * 0.55)))
soft = smooth(0.32, 0.0, band) * smooth(0.25, 0.75, fbm(N, 3, 6, 4))
thread = smooth(0.035, 0.0, band) * smooth(0.4, 0.8, fbm(N, 5, 10, 4))
band2 = np.abs(np.sin(2 * math.pi * (u * 3 + v * 2 + warp * 0.8 + 0.37)))
thread2 = smooth(0.02, 0.0, band2) * smooth(0.55, 0.85, fbm(N, 7, 7, 4))
grey = np.array((0.55, 0.55, 0.56), np.float32)
dark = np.array((0.32, 0.32, 0.34), np.float32)
col = mix(base, grey, soft * 0.45)
col = mix(col, dark, np.clip(thread * 0.8 + thread2 * 0.6, 0, 1))
# (a fine grain all over, and the odd crystal glint)
col = col * (0.97 + 0.05 * fbm(N, 64, 64, 2))[..., None]
glint = smooth(0.93, 0.99, vnoise(N, 180, 180))
col = mix(col, np.array((1.0, 1.0, 1.0), np.float32), glint * 0.25)
save("marble_panel", col)
# ---- the dark one, from the same veining: charcoal clouded with a warmer brown-black, smoky drifts, pale threads, a little gold
dbase = mix(np.array((0.12, 0.115, 0.11), np.float32), np.array((0.19, 0.165, 0.14), np.float32), smooth(0.35, 0.9, cloud) * 0.7)
dbase = mix(dbase, np.array((0.08, 0.08, 0.085), np.float32), smooth(0.6, 1.0, fbm(N, 6, 6, 4)) * 0.4)
dcol = mix(dbase, np.array((0.3, 0.29, 0.28), np.float32), soft * 0.4)
dcol = mix(dcol, np.array((0.8, 0.79, 0.76), np.float32), np.clip(thread * 0.85, 0, 1))
dcol = mix(dcol, np.array((0.62, 0.5, 0.32), np.float32), np.clip(thread2 * 0.7, 0, 1))
dcol = dcol * (0.96 + 0.07 * fbm(N, 64, 64, 2))[..., None]
dcol = mix(dcol, np.array((0.9, 0.9, 0.88), np.float32), glint * 0.18)
save("marble_panel_dark", dcol)
print("MARBLE_DONE")
