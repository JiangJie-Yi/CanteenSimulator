"""The dish cabinet's base (食器棚の下台): platecabinet.glb, node "PlateCabinet", a low cupboard of warm cedar the dish rack (PlateRack.tsx)
stands on. Its carcass and a thick top board overhanging a little, a plinth set back at the foot; across the top two drawers (for the
chopsticks and the cloths), each with a small brass pull; below them a pair of sliding doors (引き違い戸) in two tracks, frame and panel, the
panels flat-sawn with their figure, each with a sunk oval pull. The grain runs along every member (its own UVs), the panels' figure laid
once over each.

The game's frame: y up, its front toward +z, the middle of its foot at the origin; 1.0 wide, 0.56 tall, 0.50 deep (one of the two low
racks' own size and a little over: the shop's plates are kept on two of them side by side, low enough to see the kitchen over).

Run:
    blender -b --factory-startup --python blender/platecabinet.py -- <project path> [preview.png]
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F403

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJECT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
CW, CH, CD = 1.0, 0.56, 0.50
TILE = 0.5


def P(x, y, z):
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def wood(base, dark, figure, N=512, sd=5):
    """the rack's cedar: `figure` 0 straight-grained, 1 a flat-sawn panel's arches climbing it (drawn once over the panel)"""
    seed(sd)
    u, v = grid01(N)
    wob = fbm(N, 3, 2, 4) - 0.5
    straight = u * 9.0 + 0.1 * np.sin(2 * math.pi * v) + wob * 0.5
    centre = 0.5 + 0.08 * np.sin(2 * math.pi * v * 0.7 + 1.1) + wob * 0.06
    arches = ((u - centre) * 2.0) ** 2 * 5.0 - v * 4.5 + wob * 0.35
    ring = straight * (1 - figure) + arches * figure
    late = smooth(0.6, 0.97, np.sin(2 * math.pi * ring * (2.2 if not figure else 1.0)))
    col = mix(np.broadcast_to(np.asarray(base, np.float32), u.shape + (3,)).copy(), dark, late * (0.6 if not figure else 0.45))
    fine = np.sin(2 * math.pi * (u * 40 + wob * 4 + fbm(N, 5, 2, 3)))
    col = mix(col, np.asarray(dark, np.float32), smooth(0.8, 1.0, fine) * 0.22)
    return col * (0.9 + 0.2 * fbm(N, 8, 2, 3))[..., None]


# (the rack's two tones: its light shelves and the darker posts and lips)
M = {"carcass": pbr("CabCedar", (1, 1, 1), tex=image("cabcedar", wood((0.66, 0.47, 0.29), (0.45, 0.29, 0.16), 0)), rough=0.6),
     "dark": pbr("CabCedarDark", (1, 1, 1), tex=image("cabcedardark", wood((0.49, 0.33, 0.19), (0.3, 0.18, 0.09), 0, sd=8)), rough=0.6),
     "panel": pbr("CabPanel", (1, 1, 1), tex=image("cabpanel", wood((0.7, 0.5, 0.31), (0.48, 0.31, 0.17), 1, sd=12)), rough=0.6),
     "brass": pbr("CabBrass", lin("#c49a48"), rough=0.35, metal=1.0),
     "lacquer": pbr("CabLacquer", lin("#141010"), rough=0.3),
     "shadow": pbr("CabShadow", lin("#2a1a10"), rough=0.9)}
# (what's kept in it (the owner's, 2026-11-11): the bowls in the cupboard, white porcelain rice bowls with a blue line round under the rim and
# lacquered soup bowls, black outside, vermilion in; the chopsticks and the renge spoons in the drawers; and the paper band round each
# bundle of chopsticks)
_cu, _cv = grid01(256)
_k = np.floor(_cu * 20)
_f = (_cu * 20) % 1
# (twenty sticks across a bundle: each its own shade of lacquered brown, a dark line between them, rounded across)
_chop = np.stack([0.42 + 0.06 * np.sin(_k * 2.3), 0.22 + 0.03 * np.sin(_k * 1.7), 0.12 + 0.02 * np.cos(_k * 3.1)], -1)
_chop = _chop * (0.55 + 0.45 * np.sin(np.clip(_f, 0, 1) * math.pi) ** 0.5)[..., None]
M.update({
    "porcelain": pbr("CabPorcelain", lin("#f2efe8"), rough=0.25),
    "blueline": pbr("CabBlueLine", lin("#2c4f8a"), rough=0.25),
    "vermilion": pbr("CabVermilion", lin("#9e2a1e"), rough=0.3),
    "chop": pbr("CabChopsticks", (1, 1, 1), tex=image("cabchop", np.clip(_chop, 0, 1).astype(np.float32)), rough=0.35),
    "paper": pbr("CabPaper", lin("#f4f0e4"), rough=0.9),
})
parts = []


def beam(name, x, y, z, mat, fit=False, bev=0.003):
    """a box over x[0]..x[1], y[0]..y[1], z[0]..z[1] (the game's frame), its UVs on each face from that face's own axes, the box's longest
    axis along v (the grain along the member); `fit`: the picture laid once over each face"""
    lo, hi = (x[0], y[0], z[0]), (x[1], y[1], z[1])
    size = [hi[i] - lo[i] for i in range(3)]
    long_ax = max(range(3), key=lambda i: size[i])
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    corners = {(ix, iy, iz): bm.verts.new(P(x[ix], y[iy], z[iz])) for ix in (0, 1) for iy in (0, 1) for iz in (0, 1)}
    for ax in range(3):
        for side in (0, 1):
            others = [a for a in range(3) if a != ax]
            quad = []
            for (p, q) in ((0, 0), (1, 0), (1, 1), (0, 1)):
                key = [0, 0, 0]
                key[ax] = side; key[others[0]] = p; key[others[1]] = q
                quad.append(tuple(key))
            if side == 0:
                quad.reverse()
            f = bm.faces.new([corners[k] for k in quad])
            a_u, a_v = (others[1], others[0]) if others[0] == long_ax else (others[0], others[1])
            for lp, k in zip(f.loops, quad):
                co = (x[k[0]], y[k[1]], z[k[2]])
                if fit:
                    lp[uvl].uv = ((co[a_u] - lo[a_u]) / (size[a_u] or 1), (co[a_v] - lo[a_v]) / (size[a_v] or 1))
                else:
                    lp[uvl].uv = (co[a_u] / TILE + (hash(name) % 89) / 89, co[a_v] / TILE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if bev:
        m = o.modifiers.new("b", "BEVEL"); m.width = min(bev, min(size) * 0.25); m.segments = 1
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier="b")
        o.select_set(False)
    for f in o.data.polygons:
        f.use_smooth = False
    parts.append(o)
    return o


x0, x1 = -CW / 2, CW / 2
zb, zf = -CD / 2, CD / 2
T = 0.025                         # (the boards' thickness)
PL = 0.07                         # (the plinth's height)
TOP = 0.035                       # (the top board's)
# (the carcass: its sides, the bottom over the plinth, the back, a divider down the middle; the plinth set back; the top board over all,
# standing a little proud at the front and the sides)
for sd in (-1, 1):
    beam(f"CabSide{sd}", (x0, x0 + T) if sd < 0 else (x1 - T, x1), (0, CH - TOP), (zb, zf - 0.005), M["carcass"])
beam("CabBottom", (x0 + T, x1 - T), (PL, PL + T), (zb, zf - 0.01), M["carcass"])
beam("CabBack", (x0 + T, x1 - T), (PL, CH - TOP), (zb, zb + 0.012), M["dark"], bev=0)
beam("CabPlinth", (x0 + T, x1 - T), (0, PL), (zf - 0.06, zf - 0.04), M["dark"])
beam("CabTop", (x0 - 0.015, x1 + 0.015), (CH - TOP, CH), (zb, zf + 0.02), M["carcass"], bev=0.006)
# (the drawers: two across under the top, each a front of the darker wood with a small brass pull; a rail under them)
DR = 0.13
y_dr0, y_dr1 = CH - TOP - DR, CH - TOP
beam("CabRail", (x0 + T, x1 - T), (y_dr0 - 0.022, y_dr0), (zf - 0.03, zf - 0.005), M["carcass"])
for k, (a, b) in enumerate(((x0 + T + 0.004, -0.004), (0.004, x1 - T - 0.004))):
    beam(f"CabDrawer{k}", (a, b), (y_dr0 + 0.006, y_dr1 - 0.006), (zf - 0.028, zf - 0.006), M["dark"])
    beam(f"CabDrawerPull{k}", ((a + b) / 2 - 0.05, (a + b) / 2 + 0.05), ((y_dr0 + y_dr1) / 2 - 0.009, (y_dr0 + y_dr1) / 2 + 0.009), (zf - 0.006, zf + 0.008),
         M["brass"], bev=0.002)
# (the sliding doors under them, in two tracks: the left in front, the right behind it, overlapping a little in the middle; each a frame of
# the darker wood round a figured panel, its pull sunk by its meeting edge)
y_d0, y_d1 = PL + T + 0.006, y_dr0 - 0.028
for k, (a, b, z) in enumerate(((x0 + T + 0.003, 0.03, zf - 0.008), (-0.03, x1 - T - 0.003, zf - 0.032))):
    st = 0.055
    beam(f"CabDoorStileA{k}", (a, a + st), (y_d0, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorStileB{k}", (b - st, b), (y_d0, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorRailT{k}", (a + st, b - st), (y_d1 - st, y_d1), (z - 0.02, z), M["dark"])
    beam(f"CabDoorRailB{k}", (a + st, b - st), (y_d0, y_d0 + st), (z - 0.02, z), M["dark"])
    beam(f"CabDoorPanel{k}", (a + st - 0.004, b - st + 0.004), (y_d0 + st - 0.004, y_d1 - st + 0.004), (z - 0.014, z - 0.006), M["panel"], fit=True, bev=0)
    # (the pull, by the edge the other door meets: a black oval in a brass rim, sunk in the stile)
    px = (b - st / 2) if k == 0 else (a + st / 2)
    py = (y_d0 + y_d1) / 2
    for nm, r, d, mat, dz in (("Rim", 0.017, 0.004, M["brass"], 0.0015), ("Well", 0.0135, 0.0045, M["lacquer"], 0.0019)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=d, location=P(px, py, z + dz - 0.002))
        o = bpy.context.view_layer.objects.active
        o.rotation_euler = (math.pi / 2, 0, 0)
        o.scale = (0.62, 1, 1)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        o.name = f"CabPull{nm}{k}"
        o.data.materials.append(mat)
        parts.append(o)
# (the tracks the doors run in: a groove strip at the foot and the head of the opening)
for y_ in (y_d0 - 0.008, y_d1 + 0.002):
    beam(f"CabTrack{int(y_ * 1000)}", (x0 + T, x1 - T), (y_, y_ + 0.008), (zf - 0.045, zf - 0.002), M["dark"], bev=0)
# (and the dark of the inside, seen in the gap between the doors where they overlap)
beam("CabInside", (x0 + T, x1 - T), (PL + T, y_dr0 - 0.022), (zb + 0.012, zb + 0.016), M["shadow"], bev=0)


def lathe(name, prof, mats, seg, at, floor=False, sz=1.0):
    """a turned surface through the profile's points ((r, y), in order, outside up over the rim and down inside), at `at` (x, y, z of its foot's
    middle), stretched along z by sz; mats[i] the material of the band from point i to i + 1 (and of the floor, closing its last ring, if
    floor: cut into a ladder on export). Faces out, away from its axis, on the outside"""
    bm = bmesh.new()
    angs = [k * 2 * math.pi / seg for k in range(seg)]
    rings = [[bm.verts.new(P(at[0] + r * math.cos(a), at[1] + y, at[2] + r * math.sin(a) * sz)) for a in angs] for r, y in prof]
    keys = []
    for i in range(len(rings) - 1):
        for j in range(seg):
            f = bm.faces.new((rings[i][j], rings[i][(j + 1) % seg], rings[i + 1][(j + 1) % seg], rings[i + 1][j]))
            f.material_index = mats[i]
            keys.append(f)
    fl = None
    if floor:
        fl = bm.faces.new(rings[-1])
        fl.material_index = mats[-1]
    for f in bm.faces:
        f.normal_update()
    # (the first band's outside faces away from the axis: if it doesn't, all of them turned)
    f0 = keys[0]
    c = f0.calc_center_median()
    if f0.normal.dot(Vector((c.x - at[0], c.y + at[2], 0))) < 0:
        for f in keys:
            f.normal_flip()
    if fl is not None:
        if fl.normal.z < 0:
            fl.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def kept(name, objs, mat_keys):
    """the objects joined into one, their bands' materials (by index into mat_keys) given"""
    for o in objs:
        for k in mat_keys:
            o.data.materials.append(M[k])
        for f in o.data.polygons:
            f.use_smooth = True
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    parts.append(o)
    return o


# (the cupboard's bowls: twelve rice bowls in three stacks of four behind the left door, twelve soup bowls the same behind the right, each
# stack nested: the lowest whole outside, only the rim of each above it showing over the one below, the top one's inside)
FLOOR_Y = PL + T
RICE = {"foot": [(0.030, 0.0), (0.032, 0.008), (0.040, 0.010), (0.058, 0.030)], "band_from": (0.0611, 0.040),
        "rim": [(0.066, 0.054), (0.068, 0.062), (0.064, 0.062)], "inside": [(0.054, 0.035), (0.035, 0.017)], "pitch": 0.022}
SOUP = {"foot": [(0.032, 0.0), (0.033, 0.012), (0.042, 0.016), (0.057, 0.040)], "band_from": (0.0577, 0.044),
        "rim": [(0.062, 0.070), (0.059, 0.070)], "inside": [(0.052, 0.042), (0.036, 0.022)], "pitch": 0.026}
STACK, BOWL_SEG = 4, 12


def stack(kind, x, z, outer, line, inner, tag):
    objs = []
    rim_m = [line, outer] if kind is RICE else [inner]
    for k in range(STACK):
        y0 = FLOOR_Y + k * kind["pitch"]
        top = k == STACK - 1
        if k == 0:
            prof, mats = kind["foot"] + kind["rim"], [outer] * len(kind["foot"]) + rim_m
        else:
            prof, mats = [kind["band_from"]] + kind["rim"], [outer] + rim_m
        if top:
            prof, mats = prof + kind["inside"], mats + [inner] * len(kind["inside"]) + [inner]
        objs.append(lathe(f"{tag}{k}", prof, mats, BOWL_SEG, (x, y0, z), floor=top))
    return objs


# (the bowls and the renge drawn on cards, not modelled (the owner's, 2026-11-13, item 74: "far too many faces; make them one card, its picture
# or its angles making them"; they were 2,220 and 800 triangles): one stack of each made as it was, its picture taken straight on with
# nothing behind it (from the front, and from above for the top bowl's inside and for the renge, looked down on in their drawer), the
# pictures put together in one (CabCards), the made ones thrown away; each stack a card from the front and a card over its top, cut out by
# their alpha (the game: alphaTest, both sides))
CARD_PX = 256


def snapshot(objs, eye, centre, w, h, px_w, px_h):
    """a picture of `objs` alone, looked at along -eye (the game's frame) onto `centre`, w by h (metres) filling px_w by px_h, its back clear:
    an RGBA array, row 0 its foot"""
    sc_ = bpy.context.scene
    keep = {o: o.hide_render for o in bpy.data.objects}
    for o in bpy.data.objects:
        o.hide_render = o not in objs
    cam = bpy.data.objects.new("CardCam", bpy.data.cameras.new("CardCam"))
    bpy.context.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(w, h)
    c, e = P(*centre), P(*eye)
    cam.location = c + e.normalized() * 2.0
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (-e).to_track_quat("-Z", "Y" if abs(e.normalized().z) < 0.9 else "Y")
    cam.data.clip_end = 10
    sc_.camera = cam
    sun = bpy.data.objects.new("CardSun", bpy.data.lights.new("CardSun", "SUN"))
    sun.data.energy = 2.6
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = (-(e.normalized() + Vector((0.3, 0, 0.6)))).to_track_quat("-Z", "Y")
    bpy.context.collection.objects.link(sun)
    if sc_.world is None:
        sc_.world = bpy.data.worlds.new("CardWorld")
    sc_.world.use_nodes = True
    sc_.world.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.8, 0.8, 1)
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc_.render.engine = engine
            break
        except TypeError:
            continue
    sc_.view_settings.view_transform = "Standard"
    sc_.render.film_transparent = True
    sc_.render.resolution_x, sc_.render.resolution_y = (px_w, px_h) if w >= h else (px_w, px_h)
    sc_.render.resolution_percentage = 100
    cam.data.sensor_fit = "HORIZONTAL" if w >= h else "VERTICAL"
    path = os.path.join(bpy.app.tempdir or os.path.dirname(os.path.abspath(__file__)), f"card_{len(bpy.data.images)}.png")
    sc_.render.filepath = path
    sc_.render.image_settings.file_format = "PNG"
    sc_.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], 4)
    bpy.data.images.remove(img)
    os.remove(path)
    bpy.data.objects.remove(sun)
    bpy.data.objects.remove(cam)
    for o, hr in keep.items():
        o.hide_render = hr
    return a


# (one stack of each, made as it was, at the origin, for their pictures)
_rice = kept("CardRice", stack(RICE, 0.0, 0.0, 0, 1, 0, "CardRice_"), ["porcelain", "blueline", "lacquer", "vermilion"])
_soup = kept("CardSoup", stack(SOUP, 0.0, 0.0, 2, 3, 3, "CardSoup_"), ["porcelain", "blueline", "lacquer", "vermilion"])
STACK_H = {id(RICE): FLOOR_Y + (STACK - 1) * RICE["pitch"] + RICE["rim"][0][1], id(SOUP): FLOOR_Y + (STACK - 1) * SOUP["pitch"] + SOUP["rim"][0][1]}
RIM_R = {id(RICE): RICE["rim"][1][0] if len(RICE["rim"]) > 1 else RICE["rim"][0][0], id(SOUP): SOUP["rim"][0][0]}
_pics = {}
for kind, ob in ((RICE, _rice), (SOUP, _soup)):
    r_, h_ = RIM_R[id(kind)] + 0.003, STACK_H[id(kind)] - FLOOR_Y + 0.003
    side = max(2 * r_, h_)
    _pics[(id(kind), "front")] = snapshot([ob], (0, 0, 1), (0, FLOOR_Y + side / 2 - 0.0015, 0), side, side, CARD_PX, CARD_PX), side
    _pics[(id(kind), "top")] = snapshot([ob], (0, 1, 0.0001), (0, STACK_H[id(kind)], 0), 2 * r_, 2 * r_, CARD_PX, CARD_PX), 2 * r_
for ob in (_rice, _soup):
    parts.remove(ob)
    bpy.data.objects.remove(ob)


def card(bm, uvl, corners, uv):
    """a quad through the four corners (the game's frame, round it), its picture the atlas's rectangle uv (u0, v0, u1, v1)"""
    f = bm.faces.new([bm.verts.new(P(*c)) for c in corners])
    u0, v0, u1, v1 = uv
    for l, q in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        l[uvl].uv = q
    return f


# (the atlas: 1024 by 512; the rice stack's front and top, the soup's, in 256 squares down its left half; the renge's look down at the right)
ATLAS = np.zeros((512, 1024, 4), np.float32)
CELLS = {(id(RICE), "front"): (0, 0), (id(RICE), "top"): (256, 0), (id(SOUP), "front"): (0, 256), (id(SOUP), "top"): (256, 256)}
for key, (cx, cy) in CELLS.items():
    ATLAS[cy:cy + 256, cx:cx + 256] = _pics[key][0]


def cell_uv(cx, cy, w=256, h=256):
    return ((cx + 1) / 1024, (cy + 1) / 512, (cx + w - 1) / 1024, (cy + h - 1) / 512)


bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
for kind, xs in ((RICE, (-0.37, -0.225, -0.08)), (SOUP, (0.08, 0.225, 0.37))):
    side = _pics[(id(kind), "front")][1]
    tw = _pics[(id(kind), "top")][1]
    top = STACK_H[id(kind)]
    for x_ in xs:
        z_ = -0.02
        # (from the front: a card through the stack's axis, as wide as the stack, from the shelf up)
        y0_ = FLOOR_Y - 0.0015
        card(bm, uvl, ((x_ - side / 2, y0_, z_), (x_ + side / 2, y0_, z_), (x_ + side / 2, y0_ + side, z_), (x_ - side / 2, y0_ + side, z_)),
             cell_uv(*CELLS[(id(kind), "front")]))
        # (over its top, a hair under the rim: the top bowl's inside, seen looking down into the cupboard)
        yt = top - 0.002
        card(bm, uvl, ((x_ - tw / 2, yt, z_ + tw / 2), (x_ + tw / 2, yt, z_ + tw / 2), (x_ + tw / 2, yt, z_ - tw / 2), (x_ - tw / 2, yt, z_ - tw / 2)),
             cell_uv(*CELLS[(id(kind), "top")]))
me = bpy.data.meshes.new("CabBowlCards")
bm.to_mesh(me)
bm.free()
_bc = bpy.data.objects.new("CabBowlCards", me)
bpy.context.collection.objects.link(_bc)
parts.append(_bc)

# (the drawers' boxes behind their fronts, to be pulled out: their sides, back and bottom of the lighter cedar; in the left one three bundles
# of ten pairs of chopsticks, a paper band round each; in the right one twelve renge spoons in two stacks of six)
DRAWERS = (((x0 + T + 0.004, -0.004)), ((0.004, x1 - T - 0.004)))
DZ0, DZ1 = -0.21, zf - 0.0285
DY0, DY1 = y_dr0 + 0.01, y_dr0 + 0.095
drawer_parts = {0: [], 1: []}
for k, (a, b) in enumerate(DRAWERS):
    for nm, xx, yy, zz in ((f"CabDrawerSideA{k}", (a + 0.006, a + 0.016), (DY0, DY1), (DZ0, DZ1)),
                           (f"CabDrawerSideB{k}", (b - 0.016, b - 0.006), (DY0, DY1), (DZ0, DZ1)),
                           (f"CabDrawerBack{k}", (a + 0.016, b - 0.016), (DY0, DY1), (DZ0, DZ0 + 0.01)),
                           (f"CabDrawerFloor{k}", (a + 0.016, b - 0.016), (DY0, DY0 + 0.008), (DZ0 + 0.01, DZ1))):
        drawer_parts[k].append(beam(nm, xx, yy, zz, M["carcass"], bev=0.0015))
IN_Y = DY0 + 0.008
# (the chopsticks: each bundle a slab, its sticks drawn across it; its paper band round its middle, standing a little proud of it)
a, b = DRAWERS[0]
for i in range(3):
    cx = a + 0.075 + i * 0.13
    drawer_parts[0].append(beam(f"CabChops{i}", (cx - 0.03, cx + 0.03), (IN_Y, IN_Y + 0.009), (-0.12, 0.13), M["chop"], fit=True, bev=0))
    drawer_parts[0].append(beam(f"CabChopBand{i}", (cx - 0.032, cx + 0.032), (IN_Y - 0.0005, IN_Y + 0.0105), (-0.012, 0.022), M["paper"], bev=0))
# (the renge: a little oval bowl turned, stretched long, a flat handle rising from its back end; nested six to a stack, the lowest whole
# outside, only the rim of each above it, the top one's inside)
REN_FOOT = [(0.006, 0.0), (0.018, 0.003), (0.026, 0.010)]
REN_RIM = [(0.027, 0.014), (0.024, 0.014)]
REN_IN = [(0.017, 0.007), (0.007, 0.004)]
a, b = DRAWERS[1]
spoons = []
for i in range(2):
    cx = a + 0.13 + i * 0.2
    for k in range(6):
        y0 = IN_Y + k * 0.006
        top = k == 5
        prof = (REN_FOOT if k == 0 else [REN_FOOT[-1]]) + REN_RIM + (REN_IN if top else [])
        spoons.append(lathe(f"CabRenge{i}_{k}", prof, [0] * len(prof), 10, (cx, y0, 0.02), floor=top, sz=1.45))
        # (its handle: a flat tapering slab out from its back end, rising)
        bm = bmesh.new()
        pts = [(-0.008, 0.010, -0.034), (0.008, 0.010, -0.034), (-0.008, 0.015, -0.034), (0.008, 0.015, -0.034),
               (-0.005, 0.027, -0.092), (0.005, 0.027, -0.092), (-0.005, 0.031, -0.092), (0.005, 0.031, -0.092)]
        bmesh.ops.convex_hull(bm, input=[bm.verts.new(P(cx + px, y0 + py, 0.02 + pz)) for px, py, pz in pts])
        me = bpy.data.meshes.new(f"CabRengeHandle{i}_{k}")
        bm.to_mesh(me)
        bm.free()
        h = bpy.data.objects.new(me.name, me)
        bpy.context.collection.objects.link(h)
        spoons.append(h)
_others = [o.name for o in spoons[12:]]
_ren = kept("CardRenge", spoons[:12], ["porcelain"])
# (the first stack's picture from straight above, its handles toward the picture's foot; the second stack the same picture)
a_, b_ = DRAWERS[1]
cx0 = a_ + 0.13
RW, RL = 0.064, 0.136
RZ = (0.02 + 0.039 + 0.02 - 0.092 - 0.004) / 2
_rp = snapshot([_ren], (0, 1, 0.0001), (cx0, IN_Y + 0.02, RZ), RW, RL, CARD_PX, CARD_PX * 2)
parts.remove(_ren)
bpy.data.objects.remove(_ren)
for nm in _others:
    bpy.data.objects.remove(bpy.data.objects[nm])
ATLAS[0:512, 512:768] = _rp
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
for i in range(2):
    cx = a_ + 0.13 + i * 0.2
    yr = IN_Y + 5 * 0.006 + 0.0145
    # (the picture's foot (the handles' ends) to the back: the bowls toward the drawer's front, the handles back under the top, as they lay)
    card(bm, uvl, ((cx + RW / 2, yr, RZ - RL / 2), (cx - RW / 2, yr, RZ - RL / 2), (cx - RW / 2, yr, RZ + RL / 2), (cx + RW / 2, yr, RZ + RL / 2)),
         cell_uv(512, 0, 256, 512))
me = bpy.data.meshes.new("CabRengeCards")
bm.to_mesh(me)
bm.free()
_rc = bpy.data.objects.new("CabRengeCards", me)
bpy.context.collection.objects.link(_rc)
parts.append(_rc)
drawer_parts[1].append(_rc)
# (the atlas made a picture, the cards given it: one material for all six stacks and both renge)
M["cards"] = pbr("CabCards", (1, 1, 1), tex=image("cabcards", ATLAS[..., :3] / np.maximum(ATLAS[..., 3:4], 1e-4) * (ATLAS[..., 3:4] > 0), alpha=ATLAS[..., 3]), rough=0.4, blend=True)
for o in (_bc, _rc):
    o.data.materials.append(M["cards"])
root = bpy.data.objects.new("PlateCabinet", None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root
# (what moves, each a set of its own the game slides: each drawer with its box and what's in it; each door with its frame, panel and pull)
for k in (0, 1):
    e = bpy.data.objects.new(f"CabDrawerSet{k}", None)
    bpy.context.collection.objects.link(e)
    e.parent = root
    for o in parts:
        if o.name in (f"CabDrawer{k}", f"CabDrawerPull{k}") or o in drawer_parts[k]:
            o.parent = e
    e2 = bpy.data.objects.new(f"CabDoorSet{k}", None)
    bpy.context.collection.objects.link(e2)
    e2.parent = root
    for o in parts:
        if o.name.startswith(("CabDoorStile", "CabDoorRail", "CabDoorPanel", "CabPullRim", "CabPullWell")) and o.name.endswith(str(k)):
            o.parent = e2
    parts += [e, e2]

if PREVIEW:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(1.4, 1.1, 2.2)
    cam.rotation_euler = (P(0, 0.35, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 45
    bpy.context.scene.camera = cam
    for nm, loc, e in (("Key", P(2, 3, 2.5), 4.5), ("Fill", P(-2, 1, 1.5), 1.5)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        lt.data.energy = e
        bpy.context.collection.objects.link(lt)
        lt.location = loc
        lt.rotation_euler = (P(0, 0.3, 0) - loc).to_track_quat("-Z", "Y").to_euler()
    w = bpy.data.worlds.new("W"); w.color = (0.35, 0.35, 0.37); bpy.context.scene.world = w
export_dish(root, parts + [root], os.path.join(PROJECT, "public", "models", "platecabinet.glb"), os.path.join(PROJECT, "blender", "platecabinet.blend"), PREVIEW)
print("CABINET_DONE", sum(len(p.vertices) - 2 for o in parts if o.type == "MESH" for p in o.data.polygons))
