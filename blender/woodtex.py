"""The grill station's wood, painted procedurally at full size (tileable both ways) and saved as JPEG for the game to map:

- public/textures/keyaki_top.jpg: the cook's table top, 1.6 x 1.6 of the game's units a tile. Four planks of keyaki (欅) edge-glued along
  the u direction, each its own warm honey-amber and its own figure: flat-sawn cathedral arches nested along it, the fine dark lines of
  the late wood, the open pores drawn out in short streaks, a faint shimmer of ray fleck; the joints just hairlines; worn a little paler
  down the middle and darker toward the edges, where hands and oil have been; a scorch or two from the coals.
- public/textures/cedar_panel.jpg: the station's body, a tile 0.6 wide x 0.9 high: smoked cedar boards (焼杉 gone soft brown) standing
  side by side, each its own straight grain and tone, a shadowed groove between them, a frame rail along the top and bottom.
- public/textures/bar_base.jpg: the bar's base under its top, a tile 0.55 wide x the base's height: four boards standing side by side,
  straight-grained (柾目) and flat-sawn (板目, its cathedral arches rising up the board) in turn, a warm mid brown, the late wood of every
  ring a clear dark line and the pores in short dark streaks (the owner: its grain didn't show; cedar_panel's was a faint sine in a dark
  brown), a V-groove between the boards, a dark rail along the top under the counter and a kick along the foot.

Run:
    blender -b --factory-startup --python blender/woodtex.py -- <project path>
    WOODTEX_ONLY=bar_base blender ... (just that one)
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
ONLY = os.environ.get("WOODTEX_ONLY")


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


def keyaki_top():
    """the table top (keyaki)"""
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


def cedar_panel():
    """the station's body (cedar boards standing side by side; u across, v up)"""
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


def bar_base():
    """the bar's base: four boards standing side by side (u across, v up), straight grain and flat-sawn in turn, the grain clear"""
    seed(11)
    N = 1024
    u, v = grid01(N)
    boards = 4
    bk = np.clip(np.floor(u * boards), 0, boards - 1)
    bu = u * boards - bk
    tones = np.array([(0.5, 0.32, 0.2), (0.45, 0.28, 0.17), (0.53, 0.34, 0.21), (0.47, 0.3, 0.18)], np.float32)
    base = tones[bk.astype(int)]
    # (each board's colour drifting a little up its length, as a real board's does)
    base = base * (0.9 + 0.2 * fbm(N, 2, 3, 3))[..., None]
    wob = fbm(N, 6, 3, 4) - 0.5
    fine = fbm(N, 40, 4, 3) - 0.5
    flat = (bk % 2) == 1
    # (straight grain: the rings' edges as lines up the board, closer and further apart, wandering a little)
    straight = bu * 16 + wob * 1.6 + fine * 0.5 + bk * 0.37 + 0.6 * np.sin(2 * math.pi * (bu * 1.3 + bk * 0.2))
    # (flat-sawn: the rings cut through at a slant, nested arches rising up the board, their crowns off the middle; three to the board's
    # height so it runs on up the next tile)
    centre = 0.5 + 0.12 * np.sin(2 * math.pi * (v + bk * 0.3)) + wob * 0.08
    arch = ((bu - centre) * 2.4) ** 2 * 5.0 + v * 3 + wob * 0.7 + fine * 0.25
    ring = np.where(flat, arch, straight)
    ph = ring - np.floor(ring)
    # (the late wood: a dark line at each ring's edge, sharp on the one side, fading into the early wood on the other)
    late = smooth(0.62, 0.86, ph) * smooth(1.0, 0.9, ph)
    col = mix(base, base * np.float32(0.48), late * 0.85)
    # (the early wood a touch paler, in soft streaks)
    col = mix(col, base * np.float32(1.18), smooth(0.05, 0.35, ph) * smooth(0.55, 0.35, ph) * 0.35)
    # (open pores, short dark streaks along the grain)
    pores = smooth(0.8, 0.93, vnoise(N, 90, 12)) * smooth(0.45, 0.85, vnoise(N, 24, 6))
    col = mix(col, col * np.float32(0.6), pores * 0.45)
    # (the V-groove between boards: in shadow on one side, its other lip catching the light)
    col = mix(col, (0.07, 0.045, 0.03), smooth(0.022, 0.0, bu) * 0.9)
    col = mix(col, base * np.float32(1.3), smooth(0.965, 0.985, bu) * smooth(1.0, 0.985, bu) * 0.45)
    # (a dark rail along the top, under the counter's lip, and a kick along the foot, each its own grain along it)
    rail = (v > 0.955) | (v < 0.05)
    rcol = (0.2, 0.12, 0.075) * np.ones((N, N, 3), np.float32)
    rcol = mix(rcol, (0.29, 0.18, 0.11), smooth(0.4, 0.9, np.sin(2 * math.pi * (v * 34 + fbm(N, 2, 10, 3) * 2))) * 0.5)
    col = np.where(rail[..., None], rcol, col)
    col = mix(col, (0.05, 0.03, 0.02), (smooth(0.06, 0.05, v) * smooth(0.04, 0.05, v) + smooth(0.945, 0.955, v) * smooth(0.965, 0.955, v)) * 0.8)
    save("bar_base", col)


for name, make in (("keyaki_top", keyaki_top), ("cedar_panel", cedar_panel), ("bar_base", bar_base)):
    if not ONLY or ONLY == name:
        make()
