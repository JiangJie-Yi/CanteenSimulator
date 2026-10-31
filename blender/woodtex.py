"""The grill station's wood, painted procedurally at full size (tileable both ways) and saved as JPEG for the game to map:

- public/textures/keyaki_top.jpg: the cook's table top, 1.6 x 1.6 of the game's units a tile. Four planks of keyaki (欅) edge-glued along
  the u direction, each its own warm honey-amber and its own figure: flat-sawn cathedral arches nested along it, the fine dark lines of
  the late wood, the open pores drawn out in short streaks, a faint shimmer of ray fleck; the joints just hairlines; worn a little paler
  down the middle and darker toward the edges, where hands and oil have been; a scorch or two from the coals.
- public/textures/cedar_panel.jpg: the station's body, a tile 0.6 wide x 0.9 high: smoked cedar boards (焼杉 gone soft brown) standing
  side by side, each its own straight grain and tone, a shadowed groove between them, a frame rail along the top and bottom.

Run:
    blender -b --factory-startup --python blender/woodtex.py -- <project path>
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


# ---- the table top (keyaki)
seed(23)
N = 2048
u, v = grid01(N)
planks = 4
pk = np.clip(np.floor(v * planks), 0, planks - 1)
pv = v * planks - pk                                  # (0..1 across each plank)
tones = np.array([(0.80, 0.55, 0.33), (0.85, 0.6, 0.37), (0.76, 0.5, 0.29), (0.83, 0.58, 0.35)], np.float32)
base = tones[pk.astype(int)]
wob = fbm(N, 3, 12, 5) - 0.5
# (the cathedral figure: rings of the log cut through at a slant, nested arches running along the plank, their crowns wandering; periodic
# in u so the tile repeats without a seam)
centre = 0.5 + 0.18 * np.sin(2 * math.pi * (u + pk * 0.37)) + wob * 0.12
ring = ((pv - centre) * 2.2) ** 2 * 3.0 + np.sin(2 * math.pi * (u * 2 + pk * 0.21)) * 0.35 + u * 2 + wob * 0.9
late = np.sin(2 * math.pi * ring * 3)                # (each ring's dark late wood)
late = smooth(0.55, 0.98, late)
col = mix(base, base * np.float32(0.72), late * 0.55)
# (fine straight lines between the arches, where the grain runs nearly along)
fine = np.sin(2 * math.pi * (pv * 60 + wob * 6 + fbm(N, 2, 40, 3) * 1.5))
col = mix(col, base * np.float32(0.82), smooth(0.75, 1.0, fine) * 0.3)
# (open pores in short streaks along the grain, and a soft shimmer of ray fleck)
pores = smooth(0.78, 0.92, vnoise(N, 24, 380)) * smooth(0.4, 0.8, vnoise(N, 60, 60))
col = mix(col, col * np.float32(0.62), pores * 0.5)
fleck = smooth(0.82, 0.95, vnoise(N, 220, 30)) * smooth(0.5, 0.9, fbm(N, 8, 8, 3))
col = mix(col, col * np.float32(1.12), fleck * 0.35)
# (soft light-and-dark streaks along the planks)
col = col * (0.92 + 0.16 * fbm(N, 2, 24, 3))[..., None]
# (the joints: hairlines, each plank a touch darker at its edges, where oil and hands have been)
edge = np.minimum(pv, 1 - pv)
col = col * (1 - 0.1 * smooth(0.1, 0.0, edge))[..., None]
col = mix(col, (0.32, 0.18, 0.09), smooth(0.004, 0.0, edge) * 0.8)
# (worn paler in long patches from use; a scorch from a stray coal)
col = mix(col, col * np.float32(1.08), smooth(0.55, 0.8, fbm(N, 2, 2, 3)) * 0.4)
for cx_, cy_, r in ((0.31, 0.62, 0.012), (0.77, 0.21, 0.008)):
    d = np.sqrt((u - cx_) ** 2 + (v - cy_) ** 2) + (fbm(N, 30, 30, 2) - 0.5) * 0.01
    col = mix(col, (0.2, 0.1, 0.05), smooth(r, r * 0.3, d) * 0.7)
save("keyaki_top", col)

# ---- the station's body (cedar boards standing side by side; u across, v up)
seed(5)
N = 1024
u, v = grid01(N)
boards = 4
bk = np.clip(np.floor(u * boards), 0, boards - 1)
bu = u * boards - bk
tones = np.array([(0.36, 0.23, 0.15), (0.31, 0.2, 0.13), (0.39, 0.25, 0.16), (0.33, 0.21, 0.14)], np.float32)
base = tones[bk.astype(int)]
wob = fbm(N, 10, 2, 4) - 0.5
grain = np.sin(2 * math.pi * (bu * 9 + wob * 2.5 + 0.25 * np.sin(2 * math.pi * (v + bk * 0.3)) + bk * 0.4))
col = mix(base, base * np.float32(0.7), smooth(0.4, 1.0, grain) * 0.6)
col = mix(col, base * np.float32(1.15), smooth(0.7, 0.95, fbm(N, 30, 3, 3)) * 0.3)
# (the groove between boards, shadowed on one side, its lip catching the light on the other)
col = mix(col, (0.08, 0.05, 0.03), smooth(0.02, 0.0, bu) * 0.85)
col = mix(col, base * np.float32(1.35), smooth(0.03, 0.02, bu) * smooth(0.0, 0.02, bu) * 0.0 + smooth(0.97, 0.985, bu) * smooth(1.0, 0.985, bu) * 0.5)
# (the frame: a rail across the top and the bottom of each panel, darker, its own grain along it)
rail = (v < 0.06) | (v > 0.94)
rcol = (0.22, 0.13, 0.08) * np.ones((N, N, 3), np.float32)
rcol = mix(rcol, (0.3, 0.19, 0.11), smooth(0.4, 0.9, np.sin(2 * math.pi * (v * 30 + fbm(N, 2, 10, 3) * 2))) * 0.5)
col = np.where(rail[..., None], rcol, col)
col = mix(col, (0.06, 0.04, 0.02), (smooth(0.065, 0.06, v) * smooth(0.055, 0.06, v) + smooth(0.935, 0.94, v) * smooth(0.945, 0.94, v)) * 0.8)
save("cedar_panel", col)
