"""The pantry's pictures of each food (public/icons/food/<id>.png): each food's own model out of grilledfish.blend, rendered on its own on a
clear ground, lit as a studio would (a warm key from the upper left, a cool fill, a rim light behind), seen from a little above and in front,
framed to fill the picture.

Run (after grilledfish.py has saved the .blend):
    blender -b blender/grilledfish.blend --python blender/food_icons.py -- <project path> [size]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = int(argv[1]) if len(argv) > 1 else 384
OUT = os.path.join(PROJECT, "public", "icons", "food")
os.makedirs(OUT, exist_ok=True)

IDS = ["ExtraFish", "Saury", "Mackerel", "Aji", "Iwashi", "Shishamo", "Salmon", "Hokke", "Buri", "Gindara", "Nodoguro", "GrilledCorn",
       "GrilledShiitake", "Onigiri", "ShrimpSkewer", "Sausage", "Potato", "SweetPotato", "Yakitori", "PorkBelly", "Squid", "Shishito",
       "KingOyster", "Asparagus", "Okra", "Scallop", "BloodCake", "NetMochi", "MisoSoup", "Sake"]

scene = bpy.context.scene
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.render.film_transparent = True
# (wide, as the pantry cards' band is: 16 by 9)
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE * 9 // 16
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
try:
    # (the plain view, for the food's colours bright and clear as in the game's own look)
    scene.view_settings.view_transform = "Standard"
except TypeError:
    pass
# (a soft grey world for the ambient light, the lights of the dish's own scene put out)
w = bpy.data.worlds.new("IconWorld"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.56, 0.6, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = w
for o in bpy.data.objects:
    if o.type == "LIGHT":
        o.hide_render = True


def light(name, kind, energy, color, at, target=Vector((0, 0, 0)), size=1.0):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = at
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = (target - Vector(at)).to_track_quat("-Z", "Y")
    return o


cam = bpy.data.objects.new("IconCam", bpy.data.cameras.new("IconCam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 85
lights = []
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
# (the foods sold on a stick keep it, laid on a slant; the rest come off theirs (they stand on it round the fire) and lie on their side)
KEEP_STICK = {"Yakitori", "PorkBelly", "BloodCake", "ShrimpSkewer"}
foods = {i: bpy.data.objects.get(i) for i in IDS}
for x in bpy.data.objects:
    if x.type in ("MESH", "CURVE", "EMPTY"):
        x.hide_render = True
for i, o in foods.items():
    if o is None:
        print("MISSING", i)
        continue
    # (a copy of it alone, in the world's frame, at the origin: the stick's faces taken off unless it keeps it)
    me = o.data.copy()
    me.transform(o.matrix_world)
    bm = bmesh.new(); bm.from_mesh(me)
    stick = [k for k, m in enumerate(me.materials) if m and m.name == "BambooSkewer"]
    skewered = bool(stick)
    if skewered and i not in KEEP_STICK:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in stick], context="FACES")
    vs = np.array([v.co[:] for v in bm.verts])
    c = vs.mean(0)
    if skewered:
        # (laid down along its length: its longest reach across, its thinnest toward the camera, so its broad side shows)
        ev, evec = np.linalg.eigh(np.cov((vs - c).T))
        thin, mid_, long_ = evec[:, 0], evec[:, 1], evec[:, 2]
        R = np.array([long_, thin, mid_])
        if np.linalg.det(R) < 0:
            R[1] = -R[1]
        tilt = math.radians(28 if i in KEEP_STICK else 0)
        T = np.array([[math.cos(tilt), 0, -math.sin(tilt)], [0, 1, 0], [math.sin(tilt), 0, math.cos(tilt)]])
        M3 = T @ R
    else:
        M3 = np.eye(3)
    for v in bm.verts:
        v.co = Vector((M3 @ (np.array(v.co[:]) - c)).tolist())
    # (framed on the food itself: a stick it keeps runs on out of the picture)
    food_pts = [Vector(v.co) for f in bm.faces if f.material_index not in stick for v in f.verts]
    bm.to_mesh(me); bm.free()
    dup = bpy.data.objects.new(f"Icon{i}", me)
    scene.collection.objects.link(dup)
    bpy.context.view_layer.update()
    pts = food_pts or [Vector(v.co) for v in me.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid = (lo + hi) / 2
    rad = (hi - lo).length / 2
    # (from in front and a little above: the broad side of what lies down, three quarters onto what stands)
    view = (Vector((0.0, -1.0, 0.45)) if skewered else Vector((-0.35, -1.0, 0.75))).normalized()
    # (as near as lets the food fill the picture: its spread across against the width, its height (and its depth, seen from above) against
    # the height)
    ext = hi - lo
    tan_w = 18 / cam.data.lens
    tan_h = tan_w * 9 / 16
    half_w = max(ext.x, ext.y * 0.4) / 2
    half_h = (ext.z * 0.9 + ext.y * view.z * 0.9) / 2
    dist = max(half_w / tan_w, half_h / tan_h, rad * 0.6) * 1.08 + rad * 0.3
    cam.location = mid + view * dist
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (-view).to_track_quat("-Z", "Y")
    cam.data.clip_start = dist * 0.05
    cam.data.clip_end = dist * 4
    for l_ in lights:
        bpy.data.objects.remove(l_)
    lights = [light("Key", "AREA", 220 * rad * rad, (1.0, 0.94, 0.85), mid + Vector((-1.2, -1.4, 2.0)) * rad * 2.2, mid, rad * 2),
              light("Fill", "AREA", 90 * rad * rad, (0.8, 0.88, 1.0), mid + Vector((1.6, -1.0, 0.6)) * rad * 2.2, mid, rad * 2.5),
              light("Rim", "AREA", 260 * rad * rad, (1.0, 0.97, 0.9), mid + Vector((0.4, 1.8, 1.2)) * rad * 2.2, mid, rad * 1.5)]
    scene.render.filepath = os.path.join(OUT, f"{i}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(dup)
    print("ICON", i)
print("FOOD_ICONS_DONE")
