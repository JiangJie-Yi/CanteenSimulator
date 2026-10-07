"""Generate a bowl of braised beef noodle soup in a blue-and-white porcelain bowl.

Usage:
  blender -b --factory-startup --python blender/beefnoodle.py -- <project_dir> [preview.png]

Outputs:
  <project_dir>/blender/beefnoodle.blend
  <project_dir>/public/models/beefnoodle.glb

Toppings that the web menu toggles are named by their menu id (src/menu.ts):
BeefShank, Tendon, Tripe, BraisedEgg, BokChoy, PickledGreens, ExtraNoodles.
"""
import math
import os
import random
import sys
import warnings

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (active, apply_scale, bevel, cyl_uv, export_dish, fbm, finish, grid01, image, join, leaf,  # noqa: E402
                    mix, oil_broth, pbr, seed, smooth, to_normal, vnoise)

warnings.filterwarnings("ignore", category=DeprecationWarning)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
seed(33)

# Bowl profile (Blender units, Z up)
RIM_R = 0.82
RIM_Z = 0.52
WALL = 0.03
BZ = 0.40            # broth surface


def bowl_radius(z):
    """Outer radius of the bowl body at height z."""
    t = np.clip((z - 0.06) / (RIM_Z - 0.06), 0, 1)
    return 0.36 + (RIM_R - 0.36) * math.sin(t * math.pi / 2) ** 0.8


INNER_R = bowl_radius(BZ) - WALL - 0.01


# =====================================================================
# Textures
# =====================================================================

TEX = {}

# blue-and-white porcelain (u: around, v: foot -> rim)
N = 512
u, v = grid01(N)
blue = np.zeros((N, N), np.float32)
for v0, w in ((0.955, 0.012), (0.925, 0.006), (0.09, 0.01)):
    blue = np.maximum(blue, smooth(w, w * 0.4, np.abs(v - v0)))
wave_v = 0.68 + 0.07 * np.sin(u * 2 * np.pi * 8)
blue = np.maximum(blue, smooth(0.012, 0.005, np.abs(v - wave_v)))
blue = np.maximum(blue, smooth(0.012, 0.005, np.abs(v - wave_v + 0.06)) * 0.8)
# small cloud swirls between the waves and the rim
swirl = smooth(0.8, 0.86, vnoise(N, 24, 6)) * smooth(0.78, 0.8, v) * smooth(0.9, 0.88, v)
blue = np.maximum(blue, swirl * 0.9)
glaze = mix((0.96, 0.96, 0.94), (0.92, 0.93, 0.94), fbm(N, 6, 6) * 0.5)
TEX["porcelain"] = image("T_Porcelain", mix(glaze, (0.17, 0.3, 0.6), blue * (0.85 + 0.15 * fbm(N, 32, 32))))

# braised beef broth: deep reddish brown with chili oil
col, height = oil_broth(512, (0.36, 0.13, 0.06), (0.5, 0.2, 0.08), (0.85, 0.32, 0.08), droplets=140)
TEX["broth"] = image("T_BeefBroth", col)
TEX["broth_n"] = image("T_BeefBroth_N", to_normal(height + fbm(512, 6, 6) * 0.25, 2.0), data=True)

# braised beef shank: dark meat with pale tendon veins
N = 256
veins = 1 - smooth(0.0, 0.04, np.abs(fbm(N, 4, 4) - 0.5))
meat = mix((0.32, 0.15, 0.08), (0.48, 0.24, 0.12), fbm(N, 8, 8))
TEX["shank"] = image("T_Shank", mix(meat, (0.78, 0.6, 0.4), veins * 0.8))
TEX["shank_n"] = image("T_Shank_N", to_normal(veins * 0.5 + fbm(N, 16, 16) * 0.4, 2.0), data=True)

# honeycomb tripe
N = 256
u, v = grid01(N)
hx, hy = u * 10, v * 10 * 1.155
row = np.floor(hy)
hx = hx + (row % 2) * 0.5
cell = np.sqrt((hx % 1 - 0.5) ** 2 + (hy % 1 - 0.5) ** 2)
comb = smooth(0.32, 0.45, cell)
TEX["tripe"] = image("T_Tripe", mix((0.62, 0.52, 0.4), (0.8, 0.7, 0.55), comb))
TEX["tripe_n"] = image("T_Tripe_N", to_normal(comb, 3.0), data=True)

# bok choy leaf (u: stem -> tip)
N = 256
u, v = grid01(N)
green = smooth(0.3, 0.7, u)
across = np.abs(v - 0.5)
rib = smooth(0.12 * (1 - u) + 0.02, 0.05 * (1 - u), across)
TEX["bokchoy"] = image("T_BokChoy", mix(mix((0.75, 0.88, 0.6), (0.2, 0.48, 0.16), green), (0.85, 0.93, 0.75), rib))


# =====================================================================
# Materials
# =====================================================================

M = {
    "porcelain": pbr("Porcelain", tex=TEX["porcelain"], rough=0.15, coat=0.6),
    "broth": pbr("BeefBroth", tex=TEX["broth"], nrm=TEX["broth_n"], nrm_strength=0.8, rough=0.16, coat=0.2),
    "noodle": pbr("Noodle", (0.93, 0.76, 0.46), rough=0.4),
    "shank": pbr("BeefShank", tex=TEX["shank"], nrm=TEX["shank_n"], rough=0.5),
    "tendon": pbr("Tendon", (0.86, 0.72, 0.48), rough=0.2, coat=0.6),
    "tripe": pbr("Tripe", tex=TEX["tripe"], nrm=TEX["tripe_n"], rough=0.55),
    "egg": pbr("BraisedEggWhite", (0.55, 0.33, 0.16), rough=0.35),
    "egg_cut": pbr("EggCut", (0.96, 0.92, 0.82), rough=0.5),
    "yolk": pbr("Yolk", (0.98, 0.66, 0.18), rough=0.45),
    "bokchoy": pbr("BokChoy", tex=TEX["bokchoy"], rough=0.4),
    "pickled": pbr("PickledGreens", (0.66, 0.66, 0.26), rough=0.45),
    "scallion": pbr("Scallion", (0.35, 0.70, 0.20), rough=0.35),
    "chopstick": pbr("Chopstick", (0.62, 0.42, 0.24), rough=0.5),
    "ground": pbr("Ground", (0.5, 0.5, 0.52), rough=0.9),
}


# =====================================================================
# Bowl (lathe a profile around Z)
# =====================================================================

profile = [(0.0, 0.03), (0.3, 0.03), (0.32, 0.0), (0.35, 0.0), (0.37, 0.06)]
for i in range(1, 15):
    z = 0.06 + (RIM_Z - 0.06) * i / 14
    profile.append((bowl_radius(z), z))

bm = bmesh.new()
verts = [bm.verts.new((r, 0, z)) for r, z in profile]
edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=2 * math.pi, steps=72,
               use_duplicate=False)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.normal_update()
# make normals point outward (away from the axis)
sample = max(bm.faces, key=lambda f: f.calc_center_median().z)
c = sample.calc_center_median()
if sample.normal.dot(Vector((c.x, c.y, 0))) < 0:
    for f in bm.faces:
        f.normal_flip()
me = bpy.data.meshes.new("Bowl")
bm.to_mesh(me)
bm.free()
bowl = bpy.data.objects.new("Bowl", me)
bpy.context.collection.objects.link(bowl)
cyl_uv(bowl)
s = bowl.modifiers.new("Solidify", "SOLIDIFY")
s.thickness = WALL
s.offset = -1
bevel(bowl, 0.006, 2)
finish(bowl, "Bowl", M["porcelain"])


# =====================================================================
# Broth
# =====================================================================

bm = bmesh.new()
n = 96
c = bm.verts.new((0, 0, BZ))
ring = [bm.verts.new((INNER_R * math.cos(2 * math.pi * i / n), INNER_R * math.sin(2 * math.pi * i / n), BZ))
        for i in range(n)]
for i in range(n):
    bm.faces.new((c, ring[i], ring[(i + 1) % n]))
uv = bm.loops.layers.uv.new()
for f in bm.faces:
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / (2 * INNER_R) + 0.5, l.vert.co.y / (2 * INNER_R) + 0.5)
me = bpy.data.meshes.new("Broth")
bm.to_mesh(me)
bm.free()
broth = bpy.data.objects.new("Broth", me)
bpy.context.collection.objects.link(broth)
finish(broth, "Broth", M["broth"])


# =====================================================================
# Noodles: meandering tubes piled in a low mound
# =====================================================================

def noodle_pile(name, count, mound, z_base, rmax):
    parts = []
    for _ in range(count):
        a = random.uniform(0, 2 * math.pi)
        r = math.sqrt(random.uniform(0, 1)) * rmax
        x, y = r * math.cos(a), r * math.sin(a)
        heading = random.uniform(0, 2 * math.pi)
        pts = []
        for _ in range(14):
            rr = math.hypot(x, y)
            z = z_base + mound * max(0.0, 1 - rr / rmax) + random.uniform(-0.01, 0.012)
            pts.append((x, y, z))
            heading += random.uniform(-0.7, 0.7)
            x += math.cos(heading) * 0.07
            y += math.sin(heading) * 0.07
            if math.hypot(x, y) > rmax:          # bounce off the bowl wall
                heading += math.pi
                x, y = x * 0.95, y * 0.95
        cu = bpy.data.curves.new("NoodleCurve", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.012
        cu.bevel_resolution = 2
        cu.resolution_u = 6
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = "AUTO"
        ob = bpy.data.objects.new("Noodle", cu)
        bpy.context.collection.objects.link(ob)
        parts.append(ob)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target="MESH")
    o = join([p for p in bpy.context.selected_objects], name)
    return finish(o, name, M["noodle"])


noodle_pile("Noodles", 38, 0.06, BZ + 0.004, INNER_R - 0.08)
noodle_pile("ExtraNoodles", 26, 0.09, BZ + 0.02, INNER_R - 0.16)


# =====================================================================
# Toppings
# =====================================================================

placed = []


def spot(size, sep=0.1, rmax=None):
    rmax = (rmax or INNER_R - 0.05) - size
    x = y = 0.0
    for _ in range(400):
        a = random.uniform(0, 2 * math.pi)
        r = math.sqrt(random.uniform(0, 1)) * rmax
        x, y = r * math.cos(a), r * math.sin(a)
        if all((x - px) ** 2 + (y - py) ** 2 > (sep + ps) ** 2 for px, py, ps in placed):
            break
    placed.append((x, y, size))
    return x, y


TOP = BZ + 0.07   # resting on the noodle mound


def shank():
    x, y = spot(0.09, rmax=0.55)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, TOP),
                                    rotation=(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3),
                                              random.uniform(0, math.pi)))
    o = active()
    o.scale = (random.uniform(0.15, 0.18), random.uniform(0.11, 0.13), random.uniform(0.07, 0.09))
    apply_scale(o)
    bevel(o, 0.03, 3, angle=False)
    finish(o, "BeefShank", M["shank"], smooth_shade=True)


def tendon():
    x, y = spot(0.07, rmax=0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10, location=(x, y, TOP - 0.01),
                                         rotation=(0, 0, random.uniform(0, math.pi)))
    o = active()
    o.scale = (random.uniform(0.08, 0.1), 0.05, 0.035)
    finish(o, "Tendon", M["tendon"])


def tripe():
    x, y = spot(0.09, sep=0.05, rmax=0.62)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=14, y_subdivisions=6, size=1, location=(x, y, TOP - 0.01),
                                    rotation=(0, 0, random.uniform(0, math.pi)))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    ph = random.uniform(0, math.pi)
    for vtx in bm.verts:
        vtx.co.z = 0.018 * math.sin(vtx.co.x * math.pi * 2 + ph)
        vtx.co.x *= 0.2
        vtx.co.y *= 0.08
    bm.to_mesh(o.data)
    bm.free()
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.012
    finish(o, "Tripe", M["tripe"])


def braised_egg_half():
    """Half an egg lying cut side up: brown white, pale cut face, yolk in the middle."""
    x, y = spot(0.09, rmax=0.55)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=1)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0),
                           plane_no=(0, 0, 1), clear_outer=True)
    edges = [e for e in bm.edges if e.is_boundary]
    cap = bmesh.ops.edgeloop_fill(bm, edges=edges)["faces"]
    for vtx in bm.verts:
        vtx.co.x *= 0.065
        vtx.co.y *= 0.088
        vtx.co.z *= 0.06
    bm.normal_update()
    for f in cap:
        if f.normal.z < 0:
            f.normal_flip()
        f.material_index = 1
    me = bpy.data.meshes.new("BraisedEgg")
    bm.to_mesh(me)
    bm.free()
    egg = bpy.data.objects.new("BraisedEgg", me)
    bpy.context.collection.objects.link(egg)
    egg.data.materials.append(M["egg"])
    egg.data.materials.append(M["egg_cut"])
    for p in egg.data.polygons:
        p.use_smooth = p.material_index == 0
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10, location=(0, 0, 0.002))
    yolk = active()
    yolk.scale = (0.034, 0.042, 0.012)
    finish(yolk, "Yolk", M["yolk"])
    o = join([egg, yolk], "BraisedEgg")
    o.location = (x, y, TOP + 0.005)
    o.rotation_euler = (random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), random.uniform(0, math.pi))


for _ in range(4):
    shank()
for _ in range(3):
    tendon()
for _ in range(3):
    tripe()
for _ in range(2):
    braised_egg_half()

# bok choy fanned along one side
base_a = random.uniform(0, 2 * math.pi)
for i in range(3):
    a = base_a + (i - 1) * 0.35
    leaf(0.42 * math.cos(a), 0.42 * math.sin(a), BZ + 0.04 + i * 0.01, a + math.pi, 0.36, 0.17,
         M["bokchoy"], "BokChoy", cup=0.04)

# chopped pickled mustard greens in a little heap
cx, cy = spot(0.1, rmax=0.5)
parts = []
for _ in range(30):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * 0.09
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + r * math.cos(a), cy + r * math.sin(a),
                                                      TOP + random.uniform(-0.01, 0.03)),
                                    rotation=(random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3)))
    o = active()
    o.scale = (random.uniform(0.02, 0.035), random.uniform(0.015, 0.025), 0.006)
    parts.append(finish(o, "Pickle", M["pickled"], smooth_shade=False))
join(parts, "PickledGreens")

# scallions (always on)
parts = []
for _ in range(30):
    a = random.uniform(0, 2 * math.pi)
    r = math.sqrt(random.uniform(0, 1)) * (INNER_R - 0.05)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.018, minor_radius=0.006, major_segments=14, minor_segments=6,
                                     location=(r * math.cos(a), r * math.sin(a), BZ + 0.012 + random.uniform(0, 0.05)),
                                     rotation=(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), 0))
    parts.append(finish(active(), "Ring", M["scallion"]))
join(parts, "Scallion")

# a pair of chopsticks resting on the rim: thin tips down in the noodles, thick handles sticking out
# past the rim toward the front-right, where the camera sees them
for off in (-0.04, 0.04):
    handle = Vector((1.12, -0.62, RIM_Z + 0.09))
    tip = Vector((-0.32, 0.22, BZ + 0.07))
    side = (tip - handle).cross(Vector((0, 0, 1))).normalized() * off
    handle += side
    tip += side * 0.6      # the tips pinch together a little
    d = tip - handle
    # cone runs from radius1 at local -Z to radius2 at +Z, so point +Z at the tip
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.017, radius2=0.007, depth=d.length,
                                    location=(handle + tip) / 2)
    o = active()
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bevel(o, 0.003, 1)
    finish(o, "Chopstick", M["chopstick"])


# =====================================================================
# Group, preview scene, outputs
# =====================================================================

root = bpy.data.objects.new("BeefNoodle", None)
bpy.context.collection.objects.link(root)
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in parts:
    o.parent = root

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
finish(active(), "Ground", M["ground"], smooth_shade=False)

world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
try:
    world.use_nodes = True
except AttributeError:
    pass
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.75, 0.8, 0.88, 1)
bg.inputs["Strength"].default_value = 0.6


def light(name, kind, energy, loc, color=(1, 1, 1), size=1.0, target=(0, 0, 0.3)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(ob)


light("Key", "AREA", 400, (2.5, -1.0, 2.8), color=(1.0, 0.9, 0.78), size=2.0)
light("Fill", "AREA", 150, (-2.6, -1.4, 2.0), color=(0.75, 0.85, 1.0), size=3.0)
light("Rim", "AREA", 250, (-1.0, 2.8, 1.8), size=1.5)

cam = bpy.data.cameras.new("Camera")
cam.lens = 45
cam_obj = bpy.data.objects.new("Camera", cam)
cam_obj.location = (0.3, -2.6, 2.2)
cam_obj.rotation_euler = (Vector((0, 0, 0.3)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts, os.path.join(PROJECT, "public", "models", "beefnoodle.glb"),
            os.path.join(PROJECT, "blender", "beefnoodle.blend"), PREVIEW)
print("BEEFNOODLE_DONE", len(parts), "parts")
