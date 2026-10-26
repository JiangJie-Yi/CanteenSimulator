"""The household shrine (神棚) on the shelf by the door: a three-bay shrine (三社造), the middle bay taller than the two at its sides, in pale
hinoki with its grain, and its metal fittings in gold, plainly apart from the wood: the crossed finials (千木) and ridge logs (鰹木) capped in
gold, a gold ridge, gold crests and corner plates on the doors, onion-domed gold caps (擬宝珠) on the railing's posts, gold plates up the
front steps, gold edging along the eaves.

Run:
    blender -b --factory-startup --python blender/kamidana.py -- <project path> [preview.png]
Writes public/models/kamidana.glb and blender/kamidana.blend.

Frame: the shrine's own, as the game stands it (DiningRoom's Kamidana, inside its shrine group): +y up, its front toward -x, its width along
z, the base's foot at y = 0. Node the game looks for: Kamidana.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None

seed(31)
bpy.ops.wm.read_factory_settings(use_empty=True)


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- textures: hinoki (pale gold, fine straight grain, a few darker lines), its bark roof (fine ribs of cypress bark)
N = 256
u, v = grid01(N)
grain = np.sin((u + (fbm(N, 3, 2, 4) - 0.5) * 0.06) * math.pi * 2 * 40) * 0.5 + 0.5
hinoki = mix(mix((0.9, 0.76, 0.55), (0.83, 0.68, 0.47), fbm(N, 2, 3, 4)), (0.7, 0.54, 0.35), smooth(0.6, 0.95, grain) * 0.45)
hinoki_tex = image("hinoki", hinoki)
ribs = np.sin(v * math.pi * 2 * 60 + fbm(N, 8, 2, 3) * 2) * 0.5 + 0.5
bark = mix((0.42, 0.28, 0.18), (0.3, 0.19, 0.12), smooth(0.4, 0.9, ribs))
bark_tex = image("bark", mix(bark, (0.22, 0.14, 0.09), fbm(N, 20, 4, 3) * 0.3))

M = {
    "wood": pbr("KamiWood", (1, 1, 1), tex=hinoki_tex, rough=0.6),
    "woodDark": pbr("KamiWoodDark", lin("#b08a58"), rough=0.6),
    "roof": pbr("KamiRoof", (1, 1, 1), tex=bark_tex, rough=0.8),
    "eave": pbr("KamiEave", lin("#5a3a22"), rough=0.6),
    "gold": pbr("KamiGold", lin("#d9a93c"), rough=0.22, metal=1.0),
    "door": pbr("KamiDoor", (1, 1, 1), tex=hinoki_tex, rough=0.55),
    "seam": pbr("KamiSeam", lin("#2a1a10"), rough=0.8),
}


def apply_mods(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def uv_box(o, size=0.3):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def box(name, size, at, mat_, bev=0.0, rot=(0, 0, 0), uv=0.3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = active()
    o.scale = size
    apply_scale(o)
    finish(o, name, mat_, smooth_shade=False)
    if bev:
        bevel(o, bev, 2, angle=False)
        apply_mods(o)
    if uv:
        uv_box(o, uv)
    return o


def cyl(name, r, depth, at, mat_, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    return finish(active(), name, mat_)


def giboshi(name, at, r):
    """an onion-domed post cap (擬宝珠): a collar, the bulb, its pointed tip"""
    parts = [cyl(f"{name}Collar", r * 1.05, r * 0.6, Vector(at) + Vector((0, 0, r * 0.3)), M["gold"], verts=16)]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=10, location=Vector(at) + Vector((0, 0, r * 1.4)))
    b = active()
    for vv in b.data.vertices:
        if vv.co.z > 0:
            vv.co.z *= 1 + vv.co.z / r * 0.5
    parts.append(finish(b, f"{name}Bulb", M["gold"]))
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r * 0.3, radius2=0, depth=r * 0.9, location=Vector(at) + Vector((0, 0, r * 2.7)))
    parts.append(finish(active(), f"{name}Tip", M["gold"]))
    return parts


parts = []
# =====================================================================
# The base: two stepped plinths, gold plates along their fronts; three steps up the front to the middle bay, gold plates on their risers
# =====================================================================
parts.append(box("KamiPlinth", S(0.18, 0.02, 0.36), P(0, 0.01, 0), M["wood"], bev=0.002))
parts.append(box("KamiDeck", S(0.16, 0.02, 0.33), P(0, 0.03, 0), M["wood"], bev=0.002))
for y in (0.01, 0.03):
    parts.append(box(f"KamiBaseGold{int(y * 1000)}", S(0.002, 0.004, 0.2), P(-0.09 if y < 0.02 else -0.08, y, 0), M["gold"]))
for k in range(3):
    parts.append(box(f"KamiStep{k}", S(0.022, 0.012, 0.09 - k * 0.008), P(-0.095 - k * 0.02, 0.034 - k * 0.011, 0), M["wood"], bev=0.001))
    parts.append(box(f"KamiStepGold{k}", S(0.0015, 0.004, 0.05 - k * 0.006), P(-0.106 - k * 0.02, 0.034 - k * 0.011, 0), M["gold"]))

# =====================================================================
# The railing round the deck: posts with gold caps, two rails and a row of balusters between, open at the front for the steps
# =====================================================================
DY = 0.04
posts = [(sx * 0.073, sz * 0.153) for sx in (-1, 1) for sz in (-1, 1)] + [(-0.073, sz * 0.05) for sz in (-1, 1)]
for i, (x, z) in enumerate(posts):
    parts.append(box(f"KamiPost{i}", S(0.012, 0.055, 0.012), P(x, DY + 0.0275, z), M["woodDark"], bev=0.0012))
    parts += giboshi(f"KamiCap{i}", P(x, DY + 0.055, z), 0.0058)
for y in (DY + 0.018, DY + 0.045):
    parts.append(box(f"KamiRailBack{int(y * 1000)}", S(0.007, 0.006, 0.306), P(0.073, y, 0), M["woodDark"]))
    for sz in (-1, 1):
        parts.append(box(f"KamiRailSide{sz}{int(y * 1000)}", S(0.146, 0.006, 0.007), P(0, y, sz * 0.153), M["woodDark"]))
        parts.append(box(f"KamiRailFront{sz}{int(y * 1000)}", S(0.007, 0.006, 0.103), P(-0.073, y, sz * 0.1015), M["woodDark"]))
for z in np.linspace(-0.14, 0.14, 9):
    parts.append(box(f"KamiBalB{z:.3f}", S(0.004, 0.026, 0.004), P(0.073, DY + 0.0315, z), M["wood"], uv=0))
for x in np.linspace(-0.055, 0.055, 5):
    for sz in (-1, 1):
        parts.append(box(f"KamiBalS{x:.3f}{sz}", S(0.004, 0.026, 0.004), P(x, DY + 0.0315, sz * 0.153), M["wood"], uv=0))
for z in (-0.135, -0.11, -0.085, 0.085, 0.11, 0.135):
    parts.append(box(f"KamiBalF{z:.3f}", S(0.004, 0.026, 0.004), P(-0.073, DY + 0.0315, z), M["wood"], uv=0))


def bay(tag, zc, width, body_h, ridge_h, depth=0.11):
    """one bay of the shrine: its body, its pair of doors with the gold crest and corner plates, and its roof (two bark slopes edged in
    dark wood and gold, a gold ridge, the crossed finials at its ends, the ridge logs across it, all gold-capped)"""
    out = []
    y0 = DY
    out.append(box(f"Kami{tag}Body", S(depth, body_h, width), P(0.005, y0 + body_h / 2, zc), M["wood"], bev=0.0015))
    # (the doors: two leaves in a frame on the front, a dark seam, the gold crest where they meet, a gold plate at each corner)
    fx = 0.005 - depth / 2 - 0.0012
    out.append(box(f"Kami{tag}DoorFrame", S(0.003, body_h * 0.82, width * 0.72), P(fx, y0 + body_h * 0.48, zc), M["woodDark"], uv=0))
    for sd in (-1, 1):
        out.append(box(f"Kami{tag}Door{sd}", S(0.002, body_h * 0.76, width * 0.33), P(fx - 0.0016, y0 + body_h * 0.48, zc + sd * width * 0.17), M["door"]))
        for sv in (-1, 1):
            out.append(box(f"Kami{tag}DoorPlate{sd}{sv}", S(0.0012, 0.009, 0.009),
                           P(fx - 0.003, y0 + body_h * 0.48 + sv * body_h * 0.34, zc + sd * width * 0.3), M["gold"], uv=0))
    out.append(box(f"Kami{tag}Seam", S(0.0014, body_h * 0.76, 0.0016), P(fx - 0.003, y0 + body_h * 0.48, zc), M["seam"], uv=0))
    out.append(cyl(f"Kami{tag}Crest", width * 0.07, 0.002, P(fx - 0.0035, y0 + body_h * 0.48, zc), M["gold"], rot=(0, math.pi / 2, 0), verts=24))
    out.append(cyl(f"Kami{tag}CrestRing", width * 0.045, 0.0025, P(fx - 0.004, y0 + body_h * 0.48, zc), M["seam"], rot=(0, math.pi / 2, 0), verts=20))
    # (the lintel over the doors, its gold edge)
    out.append(box(f"Kami{tag}Lintel", S(0.012, 0.01, width * 0.9), P(fx - 0.004, y0 + body_h - 0.01, zc), M["woodDark"], bev=0.001))
    out.append(box(f"Kami{tag}LintelGold", S(0.002, 0.003, width * 0.9), P(fx - 0.0105, y0 + body_h - 0.014, zc), M["gold"], uv=0))
    # (the roof: two slopes from the ridge out past the body, bark on top, dark eave boards under, a gold strip along each eave)
    top = y0 + body_h
    run = depth / 2 + 0.03
    rise = ridge_h - top
    ang = math.atan2(rise, run)
    L = math.hypot(run, rise)
    for sx in (-1, 1):
        cx = sx * run / 2
        cy = top + rise / 2
        r = (0, sx * ang, 0)
        rr = (0, 0, 0)
        o = box(f"Kami{tag}Roof{sx}", S(L + 0.01, 0.01, width + 0.04), P(cx + 0.005, cy + 0.006, zc), M["roof"], bev=0.002, uv=0.2)
        o.rotation_euler = (0, sx * ang, 0)
        out.append(o)
        e = box(f"Kami{tag}Eave{sx}", S(L + 0.012, 0.004, width + 0.044), P(cx + 0.005, cy + 0.0, zc), M["eave"], uv=0)
        e.rotation_euler = (0, sx * ang, 0)
        out.append(e)
        g = box(f"Kami{tag}EaveGold{sx}", S(0.003, 0.004, width + 0.044), P(0.005 + sx * (run + 0.004), top - 0.002, zc), M["gold"], uv=0)
        out.append(g)
    # (the gable ends: the triangles under the roof, in wood)
    for sz in (-1, 1):
        zz = zc + sz * (width / 2 - 0.004)
        me_ = bpy.data.meshes.new(f"Kami{tag}Gable{sz}")
        vs = [P(0.005 - run * 0.95, top, zz), P(0.005 + run * 0.95, top, zz), P(0.005, ridge_h - 0.002, zz)]
        me_.from_pydata(vs, [], [(0, 1, 2)])
        g_ = bpy.data.objects.new(f"Kami{tag}Gable{sz}", me_)
        bpy.context.collection.objects.link(g_)
        finish(g_, f"Kami{tag}Gable{sz}", M["wood"], smooth_shade=False)
        sol = g_.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.005; sol.offset = 0
        apply_mods(g_)
        uv_box(g_, 0.2)
        out.append(g_)
    # (the gold ridge, the finials crossed at both ends, the logs across it)
    out.append(box(f"Kami{tag}Ridge", S(0.02, 0.012, width + 0.05), P(0.005, ridge_h + 0.004, zc), M["gold"], bev=0.002, uv=0))
    for sz in (-1, 1):
        for lean in (-1, 1):
            f = box(f"Kami{tag}Chigi{sz}{lean}", S(0.006, 0.075, 0.012), P(0.005 + lean * 0.016, ridge_h + 0.03, zc + sz * (width / 2 + 0.02)), M["wood"], bev=0.001)
            f.rotation_euler = (0, lean * 0.62, 0)
            out.append(f)
            t = box(f"Kami{tag}ChigiCap{sz}{lean}", S(0.0065, 0.012, 0.0125), P(0.005 + lean * 0.039, ridge_h + 0.061, zc + sz * (width / 2 + 0.02)), M["gold"], uv=0)
            t.rotation_euler = (0, lean * 0.62, 0)
            out.append(t)
    n = 3 if width > 0.12 else 2
    for k in range(n):
        z = zc + (k - (n - 1) / 2) * width * 0.32
        out.append(cyl(f"Kami{tag}Katsuogi{k}", 0.0065, 0.055, P(0.005, ridge_h + 0.016, z), M["wood"], rot=(0, math.pi / 2, 0), verts=12))
        for sx in (-1, 1):
            out.append(cyl(f"Kami{tag}KatsuogiCap{k}{sx}", 0.0069, 0.006, P(0.005 + sx * 0.0275, ridge_h + 0.016, z), M["gold"], rot=(0, math.pi / 2, 0), verts=12))
    return out


parts += bay("M", 0.0, 0.15, 0.165, 0.28)
for sz in (-1, 1):
    parts += bay(f"S{sz}", sz * 0.112, 0.07, 0.125, 0.215, depth=0.095)

root = bpy.data.objects.new("Kamidana", None)
bpy.context.collection.objects.link(root)
for o in parts:
    if o.parent is None:
        o.parent = root

# =====================================================================
# The oranges on their dish (お供えのみかん): four mikan heaped on a white dish, each a little flattened, its peel dimpled with oil glands,
# a pale navel under it, a green calyx on top with its stub of a stem; two glossy leaves on the top one
# =====================================================================
ox = []
peel = mix((0.95, 0.5, 0.06), (0.88, 0.4, 0.04), fbm(N, 6, 6, 4))
dots = (fbm(N, 60, 60, 2) > 0.62).astype(np.float32)
peel_tex = image("peel", mix(peel, (1.0, 0.62, 0.18), dots * 0.5))
M["peel"] = pbr("KamiPeel", (1, 1, 1), tex=peel_tex, rough=0.45)
M["calyx"] = pbr("KamiCalyx", lin("#4c6a22"), rough=0.6)
M["leaf"] = pbr("KamiLeaf", lin("#2f6a24"), rough=0.3)
M["dish"] = pbr("KamiDish", lin("#f2efe6"), rough=0.3)
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.08, depth=0.015, location=P(0, 0.0075, 0))
dish = active()
dish.data.vertices.foreach_get
for vv in dish.data.vertices:
    if vv.co.z < 0:
        vv.co.x *= 0.75
        vv.co.y *= 0.75
ox.append(finish(dish, "KamiDish", M["dish"]))
for k, (x, y, z, r) in enumerate([(0, 0.035, -0.022, 0.03), (-0.022, 0.035, 0.022, 0.029), (0.024, 0.035, 0.02, 0.03), (0, 0.083, 0.006, 0.027)]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=20, location=P(x, y, z))
    o = active()
    rng_ = np.random.default_rng(k + 3)
    for vv in o.data.vertices:
        n_ = vv.co.normalized()
        vv.co.z *= 0.82
        vv.co += n_ * float(rng_.normal(0, r * 0.012))
    o.rotation_euler = (float(rng_.normal(0, 0.2)), float(rng_.normal(0, 0.2)), float(rng_.uniform(0, 6.28)))
    finish(o, f"KamiOrange{k}", M["peel"])
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.sphere_project(); bpy.ops.object.mode_set(mode="OBJECT")
    ox.append(o)
    top = Vector(P(x, y + r * 0.82, z))
    # (the calyx: five little sepals round the stem stub)
    for j in range(5):
        a_ = j * 2 * math.pi / 5
        sp = box(f"KamiCalyx{k}{j}", S(0.007, 0.0015, 0.004), tuple(top + Vector(P(math.cos(a_) * 0.0035, 0.0, math.sin(a_) * 0.0035))), M["calyx"], uv=0)
        sp.rotation_euler = (0, 0, -a_)
        ox.append(sp)
    ox.append(cyl(f"KamiStem{k}", 0.0012, 0.006, tuple(top + Vector((0, 0, 0.003))), M["calyx"], verts=8))
for j, (rz, lean) in enumerate(((0.4, 0.5), (2.6, 0.4))):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8)
    lf = active()
    lf.scale = (0.022, 0.009, 0.0012)
    apply_scale(lf)
    for vv in lf.data.vertices:
        vv.co.z += (vv.co.x / 0.022) ** 2 * 0.003
    lf.location = Vector(P(0, 0.083 + 0.027 * 0.82 + 0.002, 0.006)) + Vector((math.cos(rz) * 0.014, math.sin(rz) * 0.014, 0.001))
    lf.rotation_euler = (lean * 0.3, -lean * 0.4, rz)
    ox.append(finish(lf, f"KamiOrangeLeaf{j}", M["leaf"]))
oranges = bpy.data.objects.new("KamiOranges", None)
bpy.context.collection.objects.link(oranges)
for o in ox:
    if o.parent is None:
        o.parent = oranges

# =====================================================================
# The sutra (経本): a folded book (折本), its stack of accordion-folded pages showing their folds along the edges, between two boards covered
# in brocade (a deep indigo with a gold pattern), a white title slip down the front, tied with a purple silk cord
# =====================================================================
sx_ = []
W2, D2, H2 = 0.105, 0.24, 0.022
pages = box("KamiSutraPages", S(W2 - 0.004, H2 - 0.006, D2 - 0.004), P(0, H2 / 2, 0), M["dish"], uv=0)
sx_.append(pages)
# (the folds: fine lines up the long edges, every leaf)
for k in range(10):
    yy = 0.004 + (H2 - 0.008) * (k + 0.5) / 10
    for sz in (-1, 1):
        sx_.append(box(f"KamiSutraFold{k}{sz}", S(W2 - 0.006, 0.0004, 0.0012), P(0, yy, sz * (D2 / 2 - 0.0015)), M["seam"], uv=0))
b2 = fbm(N, 16, 16, 3)
patt = (np.sin(u * math.pi * 2 * 14) * np.sin(v * math.pi * 2 * 14) > 0.55).astype(np.float32)
brocade_tex = image("brocade", mix(mix((0.1, 0.13, 0.3), (0.13, 0.17, 0.38), b2), (0.82, 0.66, 0.28), patt * 0.85))
M["brocade"] = pbr("KamiBrocade", (1, 1, 1), tex=brocade_tex, rough=0.45)
M["slip"] = pbr("KamiSlip", lin("#f6f1e2"), rough=0.7)
M["cord"] = pbr("KamiCord", lin("#6a2a7a"), rough=0.5)
for y, nm in ((0.0015, "Back"), (H2 - 0.0015, "Front")):
    sx_.append(box(f"KamiSutra{nm}", S(W2, 0.003, D2), P(0, y, 0), M["brocade"], bev=0.0008, uv=0.12))
sx_.append(box("KamiSutraSlip", S(0.022, 0.0005, 0.14), P(0.022, H2 + 0.0003, -0.02), M["slip"], uv=0))
for k in range(6):
    sx_.append(box(f"KamiSutraChar{k}", S(0.008, 0.0003, 0.012), P(0.022, H2 + 0.0007, -0.07 + k * 0.02), M["seam"], uv=0))
# (the cord round its middle, a bow on top)
bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.04, major_segments=40, minor_segments=6, location=P(0, H2 / 2, 0.04))
cord = active()
# (round the book across its width: the ring in the book's width-and-height plane, flattened to hug it)
cord.scale = (W2 / 2 + 0.0015, H2 / 2 + 0.0015, 0.08)
apply_scale(cord)
cord.rotation_euler = (math.pi / 2, 0, 0)
sx_.append(finish(cord, "KamiSutraCord", M["cord"]))
for sd in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.008, minor_radius=0.0012, major_segments=16, minor_segments=5, location=P(sd * 0.008, H2 + 0.002, 0.04))
    sx_.append(finish(active(), f"KamiSutraBow{sd}", M["cord"]))
sutra = bpy.data.objects.new("KamiSutra", None)
bpy.context.collection.objects.link(sutra)
for o in sx_:
    if o.parent is None:
        o.parent = sutra
oranges.parent = root
sutra.parent = root
oranges.location = (0.4, 0, 0)
sutra.location = (0.7, 0, 0)
parts += ox + sx_ + [oranges, sutra]

if PREVIEW:
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (-0.75, -0.35, 0.3)
    cam.rotation_euler = (Vector((0, 0, 0.15)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    for loc, e in (((-1, -1, 1.5), 300), ((1, 1, 1), 100)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy = e
        L.data.size = 1.2
        L.location = loc
        L.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(L)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world

os.makedirs(os.path.join(PROJECT, "public", "models"), exist_ok=True)
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "kamidana.glb"), os.path.join(PROJECT, "blender", "kamidana.blend"), PREVIEW)
print("KAMIDANA_DONE", len(parts), "parts")
