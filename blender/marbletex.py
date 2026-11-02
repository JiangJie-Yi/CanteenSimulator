"""The grill station's stone, painted procedurally (tileable both ways) and saved as JPEG for the game to map:

- public/textures/marble_panel.jpg: the cook's table's body below its top, a tile 1.2 across and as high as the body: the till's top's
  marble (blender/tillcounter.py, which the owner finds natural): a white ground clouded soft grey, fine grey veins wandering all over it,
  swelling, thinning, closing into loops, a fainter softer net of them crossing; on whole turns of the tile so it repeats both ways, its
  features drawn wider than high as the tile is (1.2 across, about 0.75 high on the table), so they come out round on it. (It was parallel
  slanting threads, each with a grey drift beside it like a shadow: cracks, not stone. The owner had a near-black one a while, then wanted
  it white again; the dark one's no longer made.)

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


def white_marble(N=1024):
    """the till's top's marble (tillcounter.py's recipe), on whole turns of the tile, its features 5 : 3 across (the tile's own shape on the
    table) so they come out round"""
    seed(7)
    u, v = grid01(N)
    warp = fbm(N, 5, 3, 5)
    vein = np.abs(np.sin((u * 3 + v * 1 + warp * 2.6) * math.pi * 2.0))
    veins = smooth(0.06, 0.0, vein) * 0.75 + smooth(0.18, 0.0, np.abs(np.sin((u * 8 - v * 3 + warp * 4) * math.pi))) * 0.25
    cloud = fbm(N, 6, 4, 5)
    return mix(mix((0.95, 0.95, 0.94), (0.86, 0.86, 0.87), cloud * 0.6), (0.48, 0.5, 0.53), np.clip(veins, 0, 1) * 0.8)


save("marble_panel", white_marble())
print("MARBLE_DONE")
