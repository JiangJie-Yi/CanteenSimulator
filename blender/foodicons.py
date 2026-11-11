"""The pantry's pictures of the foods (public/food/<id>.webp; the owner's, 2026-11-11: the hand-drawn SVG ones not good enough): each food
rendered from the game's own model of it (grilledfish.glb), raw as it comes out of the fridge, so its picture is what's put on the fire: a
whole fish without the skewer through it, what's skewered on its skewer. Seen from in front and a little above, its long way across the
picture, filling it; lit softly from the upper left as the shop's toon light is, an ink line round it (Freestyle), on
nothing (transparent), 384 by 192 px.

Run:
    blender -b --factory-startup --python blender/foodicons.py -- <project path> [id ...]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ONLY = set(argv[1:])
OUT = os.path.join(PROJECT, "public", "food")
os.makedirs(OUT, exist_ok=True)

# (the foods that read as themselves raw in their model (ui/FoodArt's RENDERED); the rest are cut and grilled in theirs, a carrot's slices,
# a potato in its foil, and keep their drawings; Nori and RiceBag aren't in it)
FOODS = ["Aji", "ExtraFish", "Iwashi", "Mackerel", "Nodoguro", "Saury", "Shishamo", "Hokke", "Salmon", "Gindara", "Buri", "Squid",
         "ShrimpSkewer", "Yakitori", "PorkBelly", "BloodCake", "GrilledCorn", "MisoSoup", "Okra", "Asparagus", "Shishito", "Sausage",
         "GrilledShiitake", "Scallop", "Onigiri"]
# (how far each is seen from above, degrees: the bowls and the rice ball more)
TILT = {"MisoSoup": 40, "Sake": 25, "Onigiri": 30, "NetMochi": 35, "GrilledShiitake": 35, "Scallop": 40}
# (each whole fish's fins, raw (ui/FoodArt's FISH: the colours it drew them))
FIN = {"Aji": "#d4c88e", "ExtraFish": "#dcc277", "Saury": "#8aa2c0", "Mackerel": "#8fb0b0", "Iwashi": "#9fb3cb", "Shishamo": "#d8c8a0",
       "Hokke": "#bca67e", "Nodoguro": "#cf4636", "Buri": "#dcc25c"}


def fin_material(fid):
    h = FIN[fid]
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    m = bpy.data.materials.new(f"{fid}Fin")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*c, 1)
    b.inputs["Roughness"].default_value = 0.45
    return m


# (sold skewered: their pieces kept on their skewer, the picture framed on the pieces)
ON_SKEWER = {"ShrimpSkewer", "Yakitori", "PorkBelly", "BloodCake"}
WHOLE_FISH = {"ExtraFish", "Saury", "Mackerel", "Aji", "Iwashi", "Shishamo", "Hokke", "Buri", "Nodoguro"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(PROJECT, "public", "models", "grilledfish.glb"))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
# (twice as wide as it's tall: most of them are long, and a card's band is wide)
scene.render.resolution_x, scene.render.resolution_y = 384, 192
scene.render.film_transparent = True
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 90
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.15

# (a soft grey sky for the shadows' side, a key light from the upper left and in front, a little light from behind for the rim)
world = bpy.data.worlds.new("IconWorld")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.62, 0.6, 0.58, 1)
bg.inputs[1].default_value = 0.55
scene.world = world


def sun(name, energy, rot):
    lt = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
    lt.data.energy = energy
    lt.data.angle = math.radians(12)
    lt.rotation_euler = rot
    scene.collection.objects.link(lt)
    return lt


key = sun("Key", 4.6, (0, 0, 0))
rim = sun("Rim", 1.4, (0, 0, 0))
cam = bpy.data.objects.new("IconCam", bpy.data.cameras.new("IconCam"))
cam.data.type = "ORTHO"
scene.collection.objects.link(cam)
scene.camera = cam

# (the ink: Freestyle's lines round its outline and along its sharp edges, as the game's ink line is (its back faces pushed out, there:
# here, done so, the thin fins' shells showed as stray dashes beside the body))
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 1.6
fs = bpy.context.view_layer.freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("Ink")
ls.select_silhouette, ls.select_border, ls.select_crease = True, True, False
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new("Ink")
ls.linestyle.color = (0.16, 0.11, 0.08)
ls.linestyle.thickness = 1.6

root = bpy.data.objects["GrilledFish"]


def meshes_of(o):
    out = []
    for c in o.children_recursive:
        if c.type == "MESH":
            out.append(c)
    if o.type == "MESH":
        out.append(o)
    return out


def is_rod(m):
    return any(s.material and s.material.name.startswith("BambooSkewer") for s in m.material_slots)


everything = [o for o in bpy.data.objects if o.type == "MESH"]
for fid in FOODS:
    if ONLY and fid not in ONLY:
        continue
    node = bpy.data.objects.get(fid)
    if node is None:
        print("MISSING", fid)
        continue
    mine = meshes_of(node)
    if fid not in ON_SKEWER:
        # (raw, as it comes out of the fridge: not yet skewered (the skewer is part of its mesh, a material of its own): its faces taken out,
        # here only)
        for m in mine:
            rods = {i for i, s_ in enumerate(m.material_slots) if s_.material and s_.material.name.startswith("BambooSkewer")}
            # (its fins and tail are the salt's (化粧塩, put on at the fire): coloured the fish's own fins here, raw)
            for i, s_ in enumerate(m.material_slots):
                if s_.material and s_.material.name.startswith("SaltCrust") and fid in FIN:
                    s_.material = fin_material(fid)
            if not rods:
                continue
            bm = bmesh.new()
            bm.from_mesh(m.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in rods], context="FACES")
            bm.to_mesh(m.data)
            bm.free()
    for o in everything:
        o.hide_render = o not in mine
    # (its size, for framing it)
    bpy.context.view_layer.update()
    pts = [m.matrix_world @ Vector(c) for m in mine for c in m.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = (hi - lo).length
    # (its three ways (principal axes): its longest across the picture, the camera looking down its thinnest (a fish's flank, a squid's
    # flat), tipped a little toward the top so it's seen a touch from above; those standing up on the fire laid down so)
    # (the pieces only: a skewer left in runs on out of the picture)
    vs = []
    for m in mine:
        rods = {i for i, s_ in enumerate(m.material_slots) if s_.material and s_.material.name.startswith("BambooSkewer")}
        keep = {v for p_ in m.data.polygons if p_.material_index not in rods for v in p_.vertices}
        vs += [m.matrix_world @ m.data.vertices[i].co for i in keep]
    c = (lo + hi) / 2
    P_ = np.array([[v.x, v.y, v.z] for v in vs])
    mean = P_.mean(axis=0)
    w_, e_ = np.linalg.eigh(np.cov((P_ - mean).T))
    e1, e2, e3 = (Vector(e_[:, 2]), Vector(e_[:, 1]), Vector(e_[:, 0]))
    view = e3 if e3.z >= 0 else -e3
    tilt = math.radians(TILT.get(fid, 18))
    up0 = e2 if e2.dot(Vector((0, 0, 1))) >= 0 else -e2
    view = (view * math.cos(tilt) + up0 * math.sin(tilt)).normalized()
    x_ = (e1 - view * e1.dot(view)).normalized()
    y_ = view.cross(x_).normalized()
    c = Vector(mean)
    cam.location = c + view * (size * 3 + 1)
    cam.rotation_euler = Matrix((x_, y_, view)).transposed().to_euler()
    # (fitted to what it covers, seen that way, a margin round it)
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    loc = [inv @ v for v in vs]
    w = max(p.x for p in loc) - min(p.x for p in loc)
    h = max(p.y for p in loc) - min(p.y for p in loc)
    mx = (max(p.x for p in loc) + min(p.x for p in loc)) / 2
    my = (max(p.y for p in loc) + min(p.y for p in loc)) / 2
    cam.location = cam.matrix_world @ Vector((mx, my, 0))
    cam.data.ortho_scale = max(w, h * 2) * 1.08
    # (lights turned with the camera: the key from its upper left, the rim from behind on the right)
    key.rotation_euler = (cam.matrix_world.to_3x3() @ Vector((-0.55, 0.65, 0.55))).normalized().to_track_quat("Z", "Y").to_euler()
    rim.rotation_euler = (cam.matrix_world.to_3x3() @ Vector((0.6, 0.3, -0.75))).normalized().to_track_quat("Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, f"{fid}.webp")
    bpy.ops.render.render(write_still=True)
    print("ICON", fid)
print("ICONS_DONE")
