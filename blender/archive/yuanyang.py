"""Generate a split (yuanyang) hot pot model.

Usage:
  blender -b --python blender/hotpot.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/hotpot.blend
  <project_dir>/public/models/hotpot.glb
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)

POT_R = 1.2      # outer radius at the bottom
POT_H = 0.7      # pot height
FLARE = 1.08     # top radius multiplier
WALL = 0.05
BZ = 0.55        # broth surface height


# ---------- helpers ----------

def make_mat(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*color, 1.0)
    return m


def finish(obj, name, mat, smooth=True):
    obj.name = name
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def active():
    return bpy.context.view_layer.objects.active


placed = []


def spot(side, rmax=0.98, min_y=0.14, sep=0.2):
    """Random (x, y) in one half of the pot, keeping distance from other items."""
    x = y = 0.0
    for _ in range(300):
        a = random.uniform(0, math.pi)
        r = math.sqrt(random.uniform(0.04, 1.0)) * rmax
        x, y = r * math.cos(a), side * r * math.sin(a)
        if abs(y) < min_y:
            continue
        if all((x - px) ** 2 + (y - py) ** 2 > sep ** 2 for px, py in placed):
            break
    placed.append((x, y))
    return x, y


def scatter(side, rmax=0.98, min_y=0.06):
    a = random.uniform(0, math.pi)
    r = math.sqrt(random.uniform(0.0, 1.0)) * rmax
    x, y = r * math.cos(a), side * r * math.sin(a)
    if abs(y) < min_y:
        y = side * min_y
    return x, y


# ---------- materials ----------

M = {
    "steel": make_mat("Steel", (0.8, 0.8, 0.82), rough=0.22, metal=1.0),
    "stove": make_mat("Stove", (0.04, 0.04, 0.045), rough=0.4, metal=0.6),
    "table": make_mat("Table", (0.32, 0.18, 0.09), rough=0.6),
    "spicy": make_mat("SpicyBroth", (0.55, 0.04, 0.015), rough=0.08),
    "clear": make_mat("ClearBroth", (0.85, 0.66, 0.36), rough=0.06),
    "oil": make_mat("ChiliOil", (0.95, 0.38, 0.03), rough=0.05),
    "meatball": make_mat("Meatball", (0.42, 0.27, 0.17), rough=0.7),
    "fishball": make_mat("Fishball", (0.93, 0.91, 0.86), rough=0.5),
    "tofu": make_mat("Tofu", (0.96, 0.9, 0.74), rough=0.55),
    "beef": make_mat("Beef", (0.78, 0.4, 0.38), rough=0.5),
    "shiitake": make_mat("Shiitake", (0.24, 0.14, 0.07), rough=0.6),
    "stem": make_mat("MushroomStem", (0.85, 0.78, 0.65), rough=0.6),
    "bokchoy": make_mat("BokChoy", (0.18, 0.5, 0.12), rough=0.45),
    "chili": make_mat("DriedChili", (0.7, 0.03, 0.02), rough=0.35),
    "pepper": make_mat("SichuanPepper", (0.3, 0.07, 0.04), rough=0.8),
    "scallion": make_mat("Scallion", (0.35, 0.7, 0.2), rough=0.4),
    "goji": make_mat("Goji", (0.85, 0.2, 0.05), rough=0.35),
    "corn": make_mat("Corn", (0.95, 0.74, 0.15), rough=0.45),
}


# ---------- pot ----------

bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=POT_R, depth=POT_H, location=(0, 0, POT_H / 2))
pot = active()
bm = bmesh.new()
bm.from_mesh(pot.data)
bm.normal_update()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES_ONLY")
for v in bm.verts:
    if v.co.z > 0:
        v.co.x *= FLARE
        v.co.y *= FLARE
bm.to_mesh(pot.data)
bm.free()
sol = pot.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = WALL
sol.offset = -1
bev = pot.modifiers.new("Bevel", "BEVEL")
bev.width = 0.012
bev.segments = 3
bev.limit_method = "ANGLE"
finish(pot, "Pot", M["steel"])

rim_r = POT_R * FLARE - WALL / 2
bpy.ops.mesh.primitive_torus_add(major_radius=rim_r, minor_radius=0.035, major_segments=96,
                                 minor_segments=16, location=(0, 0, POT_H))
finish(active(), "Rim", M["steel"])

for sx in (-1, 1):
    hx = sx * (POT_R * (1 + (FLARE - 1) * 0.78) + 0.12)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.032, major_segments=48,
                                     minor_segments=12, location=(hx, 0, 0.55),
                                     rotation=(math.radians(90), 0, 0))
    finish(active(), f"Handle{'R' if sx > 0 else 'L'}", M["steel"])

# divider plate (yuanyang split)
inner_bottom = POT_R - WALL
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (0.04 + POT_H - 0.02) / 2))
div = active()
div.scale = (inner_bottom * 2 - 0.02, 0.025, POT_H - 0.06)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
b = div.modifiers.new("Bevel", "BEVEL")
b.width = 0.008
b.segments = 2
finish(div, "Divider", M["steel"], smooth=False)

# stove under the pot
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.0, depth=0.16, location=(0, 0, -0.08))
st = active()
b = st.modifiers.new("Bevel", "BEVEL")
b.width = 0.03
b.segments = 3
b.limit_method = "ANGLE"
finish(st, "Stove", M["stove"])


# ---------- broth ----------

def half_disk(name, radius, z, side, mat):
    bm = bmesh.new()
    n = 64
    c = bm.verts.new((0, 0, z))
    pts = [bm.verts.new((radius * math.cos(math.pi * i / n), side * radius * math.sin(math.pi * i / n), z))
           for i in range(n + 1)]
    for i in range(n):
        bm.faces.new((c, pts[i], pts[i + 1]) if side > 0 else (c, pts[i + 1], pts[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


broth_r = POT_R * (1 + (FLARE - 1) * BZ / POT_H) - WALL - 0.01
half_disk("SpicyBroth", broth_r, BZ, 1, M["spicy"])
half_disk("ClearBroth", broth_r, BZ, -1, M["clear"])

SPICY, CLEAR = 1, -1


# ---------- ingredients ----------

def meatball(side, mat, name):
    x, y = spot(side)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, segments=24, ring_count=12, location=(x, y, BZ + 0.02))
    finish(active(), name, mat)


def tofu(side):
    x, y = spot(side, sep=0.24)
    bpy.ops.mesh.primitive_cube_add(size=0.18, location=(x, y, BZ + 0.035),
                                    rotation=(0, 0, random.uniform(0, math.pi)))
    o = active()
    b = o.modifiers.new("Bevel", "BEVEL")
    b.width = 0.015
    b.segments = 3
    finish(o, "Tofu", M["tofu"], smooth=False)


def beef(side):
    x, y = spot(side, sep=0.26)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=20, y_subdivisions=6, size=1,
                                    location=(x, y, BZ + 0.035),
                                    rotation=(random.uniform(-0.15, 0.15), 0, random.uniform(0, math.pi)))
    o = active()
    o.scale = (0.34, 0.14, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    d = o.modifiers.new("Curl", "SIMPLE_DEFORM")
    d.deform_method = "BEND"
    d.deform_axis = "Y"
    d.angle = math.radians(random.uniform(90, 150))
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.012
    finish(o, "BeefSlice", M["beef"])


def shiitake(side):
    x, y = spot(side, sep=0.22)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16, location=(x, y, BZ + 0.015))
    cap = active()
    cap.scale = (0.11, 0.11, 0.05)
    finish(cap, "ShiitakeCap", M["shiitake"])
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.025, depth=0.06, location=(x, y, BZ + 0.05))
    finish(active(), "ShiitakeStem", M["stem"])


def bokchoy(side):
    x, y = spot(side, sep=0.26)
    rot = random.uniform(0, math.pi)
    for i in range(3):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12,
                                             location=(x, y, BZ + 0.01 + i * 0.012),
                                             rotation=(random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1),
                                                       rot + (i - 1) * 0.45))
        leaf = active()
        leaf.scale = (0.2, 0.08, 0.012)
        finish(leaf, "BokChoyLeaf", M["bokchoy"])


def corn(side):
    x, y = spot(side, sep=0.24)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.075, depth=0.13, location=(x, y, BZ + 0.025),
                                        rotation=(math.radians(90), 0, random.uniform(0, math.pi)))
    o = active()
    b = o.modifiers.new("Bevel", "BEVEL")
    b.width = 0.02
    b.segments = 3
    finish(o, "Corn", M["corn"])


for _ in range(3):
    meatball(SPICY, M["meatball"], "Meatball")
for _ in range(2):
    meatball(CLEAR, M["meatball"], "Meatball")
for _ in range(3):
    meatball(CLEAR, M["fishball"], "Fishball")
for _ in range(3):
    tofu(SPICY)
for _ in range(2):
    tofu(CLEAR)
for _ in range(3):
    beef(SPICY)
for _ in range(2):
    beef(CLEAR)
for _ in range(2):
    shiitake(SPICY)
for _ in range(2):
    shiitake(CLEAR)
bokchoy(SPICY)
bokchoy(CLEAR)
corn(CLEAR)
corn(CLEAR)

# small floating garnish (no spacing needed)
for _ in range(14):
    x, y = scatter(SPICY, rmax=1.0)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.028, radius2=0.008, depth=0.17,
                                    location=(x, y, BZ + 0.012),
                                    rotation=(math.radians(90), 0, random.uniform(0, math.pi)))
    finish(active(), "DriedChili", M["chili"])

for _ in range(30):
    x, y = scatter(SPICY, rmax=1.05)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, segments=10, ring_count=6, location=(x, y, BZ + 0.005))
    finish(active(), "SichuanPepper", M["pepper"])

for _ in range(28):
    x, y = scatter(SPICY, rmax=1.08)
    r = random.uniform(0.025, 0.06)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=0.003, location=(x, y, BZ + 0.002))
    finish(active(), "ChiliOil", M["oil"])

for side in (SPICY, CLEAR):
    for _ in range(16):
        x, y = scatter(side, rmax=1.0)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.022, minor_radius=0.007, major_segments=16,
                                         minor_segments=6, location=(x, y, BZ + 0.006))
        finish(active(), "Scallion", M["scallion"])

for _ in range(12):
    x, y = scatter(CLEAR, rmax=1.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=(x, y, BZ + 0.008),
                                         rotation=(0, 0, random.uniform(0, math.pi)))
    g = active()
    g.scale = (0.03, 0.016, 0.016)
    finish(g, "Goji", M["goji"])


# ---------- group everything under one root ----------

root = bpy.data.objects.new("HotPot", None)
bpy.context.collection.objects.link(root)
hotpot_parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in hotpot_parts:
    o.parent = root


# ---------- scene for preview (not exported) ----------

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.16))
finish(active(), "Table", M["table"], smooth=False)

world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
try:
    world.use_nodes = True
except AttributeError:
    pass
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.55, 0.58, 0.65, 1)
bg.inputs["Strength"].default_value = 0.5

key = bpy.data.lights.new("Key", "AREA")
key.energy = 900
key.size = 3
key_obj = bpy.data.objects.new("Key", key)
key_obj.location = (2.5, -2.5, 4.0)
key_obj.rotation_euler = (Vector((0, 0, 0.4)) - key_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(key_obj)

fill = bpy.data.lights.new("Fill", "AREA")
fill.energy = 300
fill.size = 4
fill_obj = bpy.data.objects.new("Fill", fill)
fill_obj.location = (-3.0, 1.5, 3.0)
fill_obj.rotation_euler = (Vector((0, 0, 0.4)) - fill_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(fill_obj)

cam = bpy.data.cameras.new("Camera")
cam.lens = 45
cam_obj = bpy.data.objects.new("Camera", cam)
cam_obj.location = (0.3, -3.6, 3.1)
cam_obj.rotation_euler = (Vector((0, 0, 0.3)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj


# ---------- outputs ----------

scene = bpy.context.scene
models_dir = os.path.join(PROJECT, "public", "models")
blend_dir = os.path.join(PROJECT, "blender")
os.makedirs(models_dir, exist_ok=True)
os.makedirs(blend_dir, exist_ok=True)

if PREVIEW:
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 900
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in hotpot_parts:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(models_dir, "hotpot.glb"), export_format="GLB",
                          use_selection=True, export_apply=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, "hotpot.blend"))
print("HOTPOT_DONE", len(hotpot_parts), "parts")
