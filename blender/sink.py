"""The kitchen's sink (流し台), Japanese, as an old shop's kitchen has it: sink.glb, node "Sink".

- The counter and its basin of terrazzo (人研ぎ: grey-white cement ground smooth, chips of black, grey, white and rust stone in it), a deep
  basin to the left with its corners rounded and a brass drain, a draining part to the right, a low upstand along the back (low, so the
  basin's seen over it from the room's open side).
- The cabinet under it of dark-stained sugi, its frame and panels: under the basin an opening hung with a noren of indigo cotton, a band of
  white waves across its foot, on a bamboo rod; to the right a pair of sliding doors of vertical slats over a board, each with its sunk
  pull; a wooden bar across the front with a cloth hung on it; a dark kick at its foot.
- A commercial stainless tap behind the basin, its gooseneck spout arching over it to an aerator, a single lever on top (it was a brass
  cross tap with a little bag of white cloth tied over its mouth).
- On the counter: a draining basket of woven bamboo with three plates standing in it and a bowl upside down; a palm-fibre scrubber
  (棕櫚たわし) on its little dish; behind the basin, either side of the tap (the owner's, 2026-11-10): to its right the bar of soap on its dish
  (it stood by the basin's right, in the basket's way), to its left a pump bottle of dish soap (green, a white pump) and a two-tone sponge
  scourer; a hinoki hand pail with copper hoops at the far end.
- The counter one slab (the owner's, 2026-11-10: four boxes round the basin, overlapping where they met, each inked: black lines along the
  joins): the basin's opening cut through it with the basin's own round corners, its front edge rounded; the basin's walls on down from it.

The game's frame, its own size in metres (the room's units): y up, 1.55 across (x), 0.85 deep (z: the owner's, deeper than it was), the
counter's top 0.86 up; its front (the side the washer stands at) toward +z, the middle of its foot at the origin.

What stands on it is in sets of its own under the root, for the game to place each as a piece of its own (the owner's: they're split off):
SinkBasketSet (the draining basket, its plates and bowl), SinkScrubSet (the palm scrubber on its dish), SinkSoapSet, SinkPailSet, SinkTowelSet
(the bar across the doors and the cloth on it); the tap stays with the sink, its handle (SinkTapHandle: the stem, the cross and its knobs,
the cap) a set of its own, turned by the game as the water's turned on and off.

The right of the cabinet is a dish dryer (烘碗機, the owner's: the washed plates are dried in it before they go back to the racks): a stainless
bezel, a black control strip with three buttons and a lamp (SinkDryerLamp, its own material: the game lights it), a door hinged along its foot
that drops open (SinkDryerDoor, a set of its own: the game turns it), a stainless frame round dark glass with a bar to pull it by; inside, a
stainless liner (the owner's: its dark cavity lay in the cabinet's planes and the wood showed through it) and a wire basket the plates stand
in (SinkDryerRack, a set of its own: the game slides it out as the door drops; the marks SinkDryerRack0 and 1 go with it), and a mark
SinkDryerRing where its progress ring is lit on the panel, SinkDryerSteam where the steam comes out. The cloth hangs on a bar on the cabinet's other end now (the dryer's door was behind
it), and beside that end stands a bin for the used sticks cleared off the customers' plates (SinkBinSet, a piece of its own).

Nodes the game finds: SinkSpoutTip (where the water comes out), SinkBasinFloor (the middle of the basin's floor: the dirty plates are set
down there), SinkFront (on the floor in front of the basin: where whoever's taking plates to or from it stands), SinkRackSlot0..2 (where a
washed plate stands in the basket), SinkDryerRack0 and 1 (the middles of the first and the last plate standing in the dryer), SinkBinTop (the
middle of the bin's mouth, a little down in it: the sticks stand there).

Run:
    blender -b --factory-startup --python blender/sink.py -- <project path> [preview.png]
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
seed(23)

W, D, H = 1.55, 0.85, 0.86      # across, deep (0.62 once), the counter's top
TT = 0.05                       # the counter's thickness
FRONT = D / 2 - 0.04            # the cabinet's face (the top overhangs it)
BASIN = (-0.71, -0.09, -0.28, 0.28)   # its opening: x from, x to, z from (back), z to (front)
BASIN_FLOOR = H - 0.22
DRAIN_R = 0.026                 # its drain's hole
UP = 0.07                       # the upstand along the back


def P(x, y, z):
    """the game's (three's) frame into Blender's: y up there, z up here"""
    return Vector((x, -z, y))


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------------------------------- pictures
N = 512
u, v = grid01(N)
# (terrazzo: a grey-white ground, clouded, and in it chips of stone, black, mid grey, white and a few rust, at a few sizes)
ground = mix((0.8, 0.79, 0.76), (0.72, 0.71, 0.68), fbm(N, 6, 6, 4))
terr = ground.copy()
for cells, thr, col, k in ((90, 0.9, (0.18, 0.18, 0.19), 0.95), (140, 0.88, (0.5, 0.5, 0.5), 0.8), (110, 0.9, (0.96, 0.95, 0.93), 0.9),
                           (60, 0.95, (0.58, 0.38, 0.28), 0.85), (220, 0.86, (0.35, 0.35, 0.36), 0.7)):
    chip = smooth(thr, thr + 0.03, vnoise(N, cells, cells))
    terr = mix(terr, col, chip * k)
terr = terr * (0.96 + 0.06 * fbm(N, 64, 64, 2))[..., None]
terr_wet = terr * 0.86
# (the cabinet's sugi, stained dark: its grain running up it, a board's edge now and then)
grain = np.sin((u * 34 + (fbm(N, 2, 5, 4) - 0.5) * 0.9 + (fbm(N, 6, 2, 3) - 0.5) * 0.25) * 2 * math.pi) * 0.5 + 0.5
sugi = mix((0.34, 0.22, 0.14), (0.25, 0.155, 0.095), smooth(0.6, 1.0, grain) * 0.6)
sugi = sugi * (0.94 + 0.08 * fbm(N, 3, 12, 4))[..., None]
# (the indigo noren: aizome cotton, its weave, deeper and paler patches of the dye, a band of white waves (seigaiha) across its foot)
weave = 0.92 + 0.08 * (np.sin(u * 2 * math.pi * 120) * np.sin(v * 2 * math.pi * 120) * 0.5 + 0.5)
indigo = mix((0.12, 0.17, 0.33), (0.18, 0.25, 0.44), fbm(N, 5, 5, 4)) * weave[..., None]
wv = np.zeros((N, N), np.float32)
for row in range(3):
    cy = 0.06 + row * 0.055
    for k in range(-1, 9):
        cx = (k + (row % 2) * 0.5) / 8
        dist = np.hypot((u - cx) * 1.0, (v - cy) * 1.0)
        for rr in (0.05, 0.035, 0.02):
            wv = np.maximum(wv, smooth(0.004, 0.0, np.abs(dist - rr)) * (v > cy))
indigo = mix(indigo, (0.93, 0.93, 0.9), wv * 0.92)
indigo = mix(indigo, (0.93, 0.93, 0.9), smooth(0.006, 0.0, np.abs(v - 0.24)) * 0.9)
# (its folds hanging down it (item 95, its mesh one row now): soft light and shade in vertical bands, three folds to a panel's width (u 0.75),
# deeper toward its foot where the cloth swings out, the bands a little uneven)
NOREN_FOLDS = 0.86 + 0.14 * np.cos(u * 2 * math.pi / 0.25 + 0.6 * fbm(N, 3, 1, 2)) * (0.5 + 0.5 * (1 - v))
indigo = indigo * NOREN_FOLDS[..., None]
# (woven bamboo, a twill (網代) as a draining basket's is (the owner's, 2026-11-11: finer made): flat strips two over and two under, each row
# stepped one along, so the weave runs in diagonals; each strip rounded across (lit along its middle, shaded at its edges), its own shade, a
# dark gap between them, the skin's fine fibres along it)
strips = 24
su, sv = np.floor(u * strips), np.floor(v * strips)
fu, fv = (u * strips) % 1, (v * strips) % 1
m_ = (su + sv) % 4
over = m_ < 2
# (a strip across (over) runs two cells along u, one going down (under) two along v: dark only along its edges and where it dives under)
across = np.where(over, fv, fu)
along_ = np.where(over, fu, fv)
end0 = (m_ == 0) | (m_ == 2)
edge = smooth(0.0, 0.14, np.minimum(across, 1 - across))
dive = np.where(end0, smooth(0.0, 0.22, along_), smooth(0.0, 0.22, 1 - along_))
cell = np.where(over, np.floor((su - m_) / 2) * 13 + sv, np.floor((sv - (m_ - 2)) / 2) * 7 + su * 3)
shade = 0.86 + 0.14 * np.sin(cell * 2.7) * np.cos(cell * 1.3)
round_ = 0.7 + 0.3 * np.sin(np.clip(across, 0, 1) * math.pi) ** 0.5
fibre = 0.93 + 0.07 * np.sin((np.where(over, v, u) * strips * 7 + np.where(over, u, v) * 2) * 2 * math.pi)
k_ = shade * round_ * fibre * (0.35 + 0.65 * edge * (0.55 + 0.45 * dive))
bamboo = np.stack([0.82 * k_, 0.68 * k_, 0.42 * k_], -1)
# (the strips going down a little darker and browner: in the shade of those across them)
bamboo = bamboo * np.where(over, 1.0, 0.8)[..., None]
# (hinoki for the pail: pale, a fine straight grain)
hin = mix((0.86, 0.74, 0.55), (0.76, 0.62, 0.42), smooth(0.6, 1.0, np.sin((u * 40 + fbm(N, 2, 4, 3)) * 2 * math.pi) * 0.5 + 0.5) * 0.6)
# (palm fibre: brown, coarse, its fibres all one way)
palm = mix((0.36, 0.22, 0.12), (0.52, 0.34, 0.18), vnoise(N, 4, 180)) * (0.85 + 0.15 * vnoise(N, 3, 400))[..., None]
# (the cloth on the bar: white cotton, a blue line at each end)
cloth = np.ones((N, N, 3), np.float32) * np.array((0.93, 0.92, 0.88), np.float32) * weave[..., None]
cloth = mix(cloth, (0.2, 0.3, 0.55), ((np.abs(v - 0.1) < 0.02) | (np.abs(v - 0.9) < 0.02)).astype(np.float32))

M = {
    "terrazzo": pbr("SinkTerrazzo", (1, 1, 1), tex=image("sink_terrazzo", np.clip(terr, 0, 1).astype(np.float32)), rough=0.35, coat=0.2),
    "basin": pbr("SinkTerrazzoWet", (1, 1, 1), tex=image("sink_terrazzo_wet", np.clip(terr_wet, 0, 1).astype(np.float32)), rough=0.2, coat=0.5),
    "sugi": pbr("SinkSugi", (1, 1, 1), tex=image("sink_sugi", np.clip(sugi, 0, 1).astype(np.float32)), rough=0.5),
    "kick": pbr("SinkKick", lin("#1a120c"), rough=0.6),
    "noren": pbr("SinkNoren", (1, 1, 1), tex=image("sink_noren", np.clip(indigo, 0, 1).astype(np.float32)), rough=0.9),
    "bamboo": pbr("SinkBamboo", (1, 1, 1), tex=image("sink_bamboo", np.clip(bamboo, 0, 1).astype(np.float32)), rough=0.6),
    "rod": pbr("SinkRod", lin("#b8a066"), rough=0.4),
    "brass": pbr("SinkBrass", lin("#c9a14a"), rough=0.25, metal=1.0),
    "copper": pbr("SinkCopper", lin("#b8734a"), rough=0.3, metal=1.0),
    "drain": pbr("SinkDrain", lin("#2b2620"), rough=0.6),
    "rubber": pbr("SinkRubber", lin("#232120"), rough=0.75),
    "bag": pbr("SinkBag", lin("#f2f0ea"), rough=0.9),
    "plate": pbr("SinkPlate", lin("#f4f1ea"), rough=0.3),
    "rim": pbr("SinkPlateRim", lin("#2c4f8a"), rough=0.3),
    "palm": pbr("SinkPalm", (1, 1, 1), tex=image("sink_palm", np.clip(palm, 0, 1).astype(np.float32)), rough=0.95),
    "soap": pbr("SinkSoap", lin("#f3efe2"), rough=0.5),
    "dish": pbr("SinkDish", lin("#9fc2b0"), rough=0.2, coat=0.6),
    "hinoki": pbr("SinkHinoki", (1, 1, 1), tex=image("sink_hinoki", np.clip(hin, 0, 1).astype(np.float32)), rough=0.55),
    "cloth": pbr("SinkCloth", (1, 1, 1), tex=image("sink_cloth", np.clip(cloth, 0, 1).astype(np.float32)), rough=0.9),
    "steel": pbr("SinkSteel", lin("#c9ccd0"), rough=0.3, metal=1.0),
    # (the tap's brushed stainless (the owner's: a commercial kitchen's, #e0e0e0, rough 0.2, metal 0.9))
    "faucet": pbr("SinkSteelTap", lin("#e0e0e0"), rough=0.2, metal=0.9),
    "panel": pbr("SinkPanel", lin("#1c1d20"), rough=0.25),
    "button": pbr("SinkButton", lin("#d8d8d2"), rough=0.4),
    "lamp": pbr("SinkLamp", lin("#3a3a36"), rough=0.3),
    "glass": pbr("SinkGlass", lin("#3a4652"), rough=0.1),
    "cavity": pbr("SinkCavity", lin("#2e3134"), rough=0.6),
    # (the dryer's liner: bright stainless (the owner's: #d1d5db, metal 0.85, rough 0.25))
    "inner": pbr("SinkDryerLiner", lin("#d1d5db"), rough=0.25, metal=0.85),
    # (the dish soap: its bottle a pale see-through green, the soap in it green, the pump white; the sponge's scourer dark green, its sponge yellow)
    "soapbottle": pbr("SinkSoapBottle", lin("#cfe8cf"), rough=0.2),
    "soapgreen": pbr("SinkSoapGreen", lin("#3f9a4a"), rough=0.3),
    "pump": pbr("SinkPump", lin("#f2f2ee"), rough=0.4),
    "scour": pbr("SinkScour", lin("#2f5a2a"), rough=0.9),
    "sponge": pbr("SinkSponge", lin("#f2c84a"), rough=0.85),
    "liner": pbr("SinkBinLiner", lin("#1a1a1c"), rough=0.7),
}
parts = []


def box_uv(o, tile=0.5):
    """lay every face's picture flat on it at its true size (a picture every `tile` across), from whichever side it faces"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for loop in f.loops:
            c = o.matrix_world @ loop.vert.co
            if abs(n.z) >= max(abs(n.x), abs(n.y)):
                loop[uvl].uv = (c.x / tile, c.y / tile)
            elif abs(n.x) >= abs(n.y):
                loop[uvl].uv = (c.y / tile, c.z / tile)
            else:
                loop[uvl].uv = (c.x / tile, c.z / tile)
    bm.to_mesh(o.data)
    bm.free()


def box(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0, seg=2, tile=0.5):
    """a box from its extents (the game's frame), its picture laid at its true size; bevelled along its edges if bev (a bevel of 3 mm or
    less isn't kept: it reads as nothing at the game's distance and cost 96 triangles a box; wider ones in at most two steps)"""
    if bev <= 0.003:
        bev = 0.0
    seg = min(seg, 2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    apply_scale(o)
    if bev:
        b = bevel(o, bev, seg)
        b.limit_method = "NONE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    box_uv(o, tile)
    finish(o, name, M[mat], smooth_shade=False)
    parts.append(o)
    return o


def cyl(name, x, y0, y1, z, r, mat, seg=16, r1=None):
    """an upright cylinder from y0 to y1 at (x, z), r across (and r1 at its top, if given)"""
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r if r1 is None else r1, depth=y1 - y0, location=P(x, (y0 + y1) / 2, z))
    o = active()
    cyl_uv(o)
    finish(o, name, M[mat])
    for p in o.data.polygons:
        p.use_smooth = abs(p.normal.z) < 0.9
    parts.append(o)
    return o


def tube(name, pts, r, mat, res=6, sides=10):
    """a round rod along the points (the game's frame), as a curve made a mesh"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(1, sides // 4 - 1)
    cu.resolution_u = res
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = P(*p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = active()
    o.data.materials.append(M[mat])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


def empty(name, x, y, z):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = P(x, y, z)
    parts.append(e)
    return e


# ---------------------------------------------------------------------------------------------------- the counter and its basin
x0, x1, zb, zf = BASIN
# (the top: one slab of terrazzo, the basin's opening cut through it, its corners rounded as the basin's are (4 cm round, four steps); its
# front edge rounded; the opening's walls the slab's own down through its thickness, the basin's on from there (one under the other, none in
# another's plane))
bpy.ops.mesh.primitive_cube_add(size=1, location=P(0, H - TT / 2, 0))
top = active()
top.scale = (W, D, TT)
apply_scale(top)
bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, H - TT / 2, (zb + zf) / 2))
cut = active()
cut.scale = (x1 - x0, zf - zb, TT * 3)
apply_scale(cut)
bm = bmesh.new()
bm.from_mesh(cut.data)
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.9], offset=0.05, segments=4,
                affect="EDGES", profile=0.5)
bm.to_mesh(cut.data)
bm.free()
bo = top.modifiers.new("cut", "BOOLEAN")
bo.operation = "DIFFERENCE"
bo.object = cut
bo.solver = "EXACT"
bpy.context.view_layer.objects.active = top
bpy.ops.object.modifier_apply(modifier=bo.name)
bpy.data.objects.remove(cut, do_unlink=True)
# (every face its one material: the boolean left the slab an empty slot, and the terrazzo, given after it, went unused)
top.data.materials.clear()
for p_ in top.data.polygons:
    p_.material_index = 0
# (its front edge rounded: the long edge along the front of its top)
bm = bmesh.new()
bm.from_mesh(top.data)
front = [e for e in bm.edges if all(abs(v_.co.y + D / 2) < 1e-4 and abs(v_.co.z - H) < 1e-4 for v_ in e.verts)]
bmesh.ops.bevel(bm, geom=front, offset=0.012, segments=3, affect="EDGES", profile=0.5)
bm.to_mesh(top.data)
bm.free()
box_uv(top, 0.5)
finish(top, "SinkTop", M["terrazzo"], smooth_shade=False)
parts.append(top)
# (the basin: its walls and floor, seen from inside, its upright corners rounded; its walls up to the slab's underside, where the slab's
# own cut goes on)
bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (BASIN_FLOOR + H - TT) / 2, (zb + zf) / 2))
bas = active()
bas.scale = (x1 - x0, zf - zb, H - TT - BASIN_FLOOR)
apply_scale(bas)
bm = bmesh.new()
bm.from_mesh(bas.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.9], offset=0.05, segments=4,
                affect="EDGES", profile=0.5)
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if not e.is_boundary and abs((e.verts[0].co - e.verts[1].co).normalized().z) < 0.1
                          and min(v_.co.z for v_ in e.verts) < bas.dimensions.z * -0.49], offset=0.025, segments=3, affect="EDGES", profile=0.5)
# (the drain dug through its floor (the owner's, 2026-11-11: a hole, and the plug to stop it): its floor face taken out and its edge joined
# to the hole's ring in quads, each of its edge's corners to the point of the ring the same way round from the middle)
_zmin = min(v_.co.z for v_ in bm.verts)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(abs(v_.co.z - _zmin) < 1e-5 for v_ in f.verts)], context="FACES")
_edge = [v_ for v_ in bm.verts if abs(v_.co.z - _zmin) < 1e-5 and v_.is_boundary]
_edge.sort(key=lambda v_: math.atan2(v_.co.y, v_.co.x))
_hole = [bm.verts.new((DRAIN_R * math.cos(math.atan2(v_.co.y, v_.co.x)), DRAIN_R * math.sin(math.atan2(v_.co.y, v_.co.x)), _zmin)) for v_ in _edge]
for i in range(len(_edge)):
    j = (i + 1) % len(_edge)
    f = bm.faces.new((_edge[i], _edge[j], _hole[j], _hole[i]))
    f.normal_update()
    if f.normal.z > 0:
        f.normal_flip()
DRAIN_N = len(_edge)
bmesh.ops.reverse_faces(bm, faces=bm.faces)
bm.to_mesh(bas.data)
bm.free()
box_uv(bas, 0.5)
finish(bas, "SinkBasin", M["basin"])
parts.append(bas)
# (its drain: a brass cup down from the hole, seen from inside it, as deep as there's room above the cabinet's top under the basin (BY);
# its foot dark, two brass bars across it a little down; a brass flange
# round its mouth over the floor's edge (a ring: its top and its outer side, no cap into the middle))
DX, DZ = (x0 + x1) / 2, (zb + zf) / 2
DRAIN_D = 0.0105
bm = bmesh.new()
_top = [bm.verts.new(P(DX + DRAIN_R * math.cos(a), BASIN_FLOOR, DZ + DRAIN_R * math.sin(a))) for a in (k * 2 * math.pi / 20 for k in range(20))]
_bot = [bm.verts.new(P(DX + DRAIN_R * math.cos(a), BASIN_FLOOR - DRAIN_D, DZ + DRAIN_R * math.sin(a))) for a in (k * 2 * math.pi / 20 for k in range(20))]
for i in range(20):
    j = (i + 1) % 20
    f = bm.faces.new((_top[i], _top[j], _bot[j], _bot[i]))
    f.normal_update()
    # (facing in, toward its middle)
    c_ = f.calc_center_median()
    if f.normal.dot(Vector((P(DX, 0, DZ).x - c_.x, P(DX, 0, DZ).y - c_.y, 0))) < 0:
        f.normal_flip()
pipe = bpy.data.objects.new("SinkDrainPipe", bpy.data.meshes.new("SinkDrainPipe"))
bm.to_mesh(pipe.data)
bm.free()
bpy.context.collection.objects.link(pipe)
finish(pipe, "SinkDrainPipe", M["brass"])
parts.append(pipe)
cyl("SinkDrainHole", DX, BASIN_FLOOR - DRAIN_D + 0.0003, BASIN_FLOOR - DRAIN_D + 0.0008, DZ, DRAIN_R - 0.001, "drain", seg=20)
for k, (ax, az) in enumerate(((1, 0), (0, 1))):
    hw = DRAIN_R - 0.0015
    box(f"SinkDrainBar{k}", DX - (hw if ax else 0.002), DX + (hw if ax else 0.002), BASIN_FLOOR - 0.0045 - k * 0.0025, BASIN_FLOOR - 0.0025 - k * 0.0025,
        DZ - (hw if az else 0.002), DZ + (hw if az else 0.002), "brass")
bm = bmesh.new()
FL_IN, FL_OUT, FL_H = DRAIN_R - 0.002, DRAIN_R + 0.011, 0.0025
_ri, _ro, _rb = [], [], []
for k in range(20):
    a = k * 2 * math.pi / 20
    _ri.append(bm.verts.new(P(DX + FL_IN * math.cos(a), BASIN_FLOOR + FL_H, DZ + FL_IN * math.sin(a))))
    _ro.append(bm.verts.new(P(DX + FL_OUT * math.cos(a), BASIN_FLOOR + FL_H, DZ + FL_OUT * math.sin(a))))
    _rb.append(bm.verts.new(P(DX + FL_OUT * math.cos(a), BASIN_FLOOR, DZ + FL_OUT * math.sin(a))))
for i in range(20):
    j = (i + 1) % 20
    f = bm.faces.new((_ri[i], _ri[j], _ro[j], _ro[i]))
    f.normal_update()
    if f.normal.z < 0:
        f.normal_flip()
    f = bm.faces.new((_ro[i], _ro[j], _rb[j], _rb[i]))
    f.normal_update()
    if f.normal.dot(f.calc_center_median() - P(DX, BASIN_FLOOR, DZ)) < 0:
        f.normal_flip()
flange = bpy.data.objects.new("SinkDrainRing", bpy.data.meshes.new("SinkDrainRing"))
bm.to_mesh(flange.data)
bm.free()
bpy.context.collection.objects.link(flange)
finish(flange, "SinkDrainRing", M["brass"], smooth_shade=False)
parts.append(flange)
empty("SinkBasinFloor", DX, BASIN_FLOOR + 0.005, DZ + 0.03)
# (the plug (栓): black rubber, tapered, its top a little proud of the flange when it's in, a brass ring on top to lift it by; the game lifts
# it out and lays it by the drain, and puts it back)
bm = bmesh.new()
_pr = []
for y_, r_ in ((BASIN_FLOOR - DRAIN_D + 0.0015, DRAIN_R - 0.003), (BASIN_FLOOR + FL_H + 0.004, DRAIN_R + 0.004), (BASIN_FLOOR + FL_H + 0.008, DRAIN_R + 0.002)):
    _pr.append([bm.verts.new(P(DX + r_ * math.cos(a), y_, DZ + r_ * math.sin(a))) for a in (k * 2 * math.pi / 16 for k in range(16))])
for r0_, r1_ in zip(_pr, _pr[1:]):
    for i in range(16):
        j = (i + 1) % 16
        f = bm.faces.new((r0_[i], r0_[j], r1_[j], r1_[i]))
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - P(DX, f.calc_center_median().z, DZ)) < 0:
            f.normal_flip()
for ring_, up_ in ((_pr[0], False), (_pr[-1], True)):
    for f in ladder_fill(bm, ring_):
        f.normal_update()
        if (f.normal.z > 0) != up_:
            f.normal_flip()
plug = bpy.data.objects.new("SinkPlug", bpy.data.meshes.new("SinkPlug"))
bm.to_mesh(plug.data)
bm.free()
bpy.context.collection.objects.link(plug)
finish(plug, "SinkPlug", M["rubber"], smooth_shade=False)
parts.append(plug)
bpy.ops.mesh.primitive_torus_add(major_radius=0.008, minor_radius=0.0022, major_segments=12, minor_segments=6,
                                 location=P(DX, BASIN_FLOOR + FL_H + 0.008 + 0.008, DZ), rotation=(math.pi / 2, 0, 0))
finish(active(), "SinkPlugRing", M["brass"])
parts.append(active())
# (the water held in the basin with the plug in: a sheet the basin's own shape, its rounded corners, at its floor; the game lifts it as it
# fills, up to the overflow (SinkWaterTop), and hides it empty)
bm = bmesh.new()
_hx, _hz, _cr = (x1 - x0) / 2 - 0.002, (zf - zb) / 2 - 0.002, 0.048
_wr = []
for qx, qz, a0 in ((-_hx + _cr, -_hz + _cr, math.pi), (_hx - _cr, -_hz + _cr, 1.5 * math.pi), (_hx - _cr, _hz - _cr, 0.0), (-_hx + _cr, _hz - _cr, 0.5 * math.pi)):
    for k in range(5):
        a = a0 + k / 4 * math.pi / 2
        _wr.append(bm.verts.new(P(DX + qx + math.cos(a) * _cr, BASIN_FLOOR + 0.001, DZ + qz + math.sin(a) * _cr)))
for f in ladder_fill(bm, _wr):
    f.normal_update()
    if f.normal.z < 0:
        f.normal_flip()
water = bpy.data.objects.new("SinkWater", bpy.data.meshes.new("SinkWater"))
bm.to_mesh(water.data)
bm.free()
bpy.context.collection.objects.link(water)
finish(water, "SinkWater", M["drain"], smooth_shade=False)
parts.append(water)
# (the overflow (溢水口) in the basin's back wall near its top: a brass plate with a dark slot in it; the water never rises past its foot)
OVER_Y = H - TT - 0.045
box("SinkOverflow", DX - 0.026, DX + 0.026, OVER_Y - 0.008, OVER_Y + 0.016, zb + 0.0005, zb + 0.0025, "brass")
box("SinkOverflowSlot", DX - 0.017, DX + 0.017, OVER_Y - 0.001, OVER_Y + 0.009, zb + 0.0025, zb + 0.0032, "drain")
empty("SinkWaterTop", DX, OVER_Y - 0.008, DZ)
# (the low upstand along the back)
box("SinkUpstand", -W / 2, W / 2, H, H + UP, -D / 2, -D / 2 + 0.04, "terrazzo", bev=0.008, seg=3)

# ---------------------------------------------------------------------------------------------------- the cabinet
# (the body round the basin: under it, and in front, behind and either side of it up to the top, so the basin's hollow stays open)
BZ0, BZ1, BY = -D / 2 + 0.02, FRONT - 0.012, BASIN_FLOOR - 0.012
MID = -0.02                                  # the middle stile, between the basin's side and the dryer
# (to the right of the middle stile it's hollow, for the dish dryer: there the body stands only behind the dryer's cavity and under it)
DX0, DX1 = MID + 0.02, W / 2 - 0.05           # the dryer's front, from the middle stile to the end stile
DY0, DY1 = 0.12, H - TT - 0.045              # from over the foot rail to under the top rail
ZF = FRONT + 0.006                           # its face
CAV = (DX0 + 0.025, DX1 - 0.025, DY0 + 0.02, BY - 0.006, ZF - 0.42, ZF - 0.012)   # its cavity: x, y and z from–to
box("SinkBody", -W / 2 + 0.01, MID, 0.08, BY, BZ0, BZ1, "sugi", tile=0.6)
# (behind the dryer's liner and under it, each 4 mm clear of it: they lay in the liner's planes and the wood showed through it)
box("SinkBodyR", MID, W / 2 - 0.01, 0.08, BY, BZ0, CAV[4] - 0.004, "sugi", tile=0.6)
box("SinkBodyRFoot", MID, W / 2 - 0.01, 0.08, CAV[2] - 0.004, CAV[4] - 0.004, BZ1, "sugi", tile=0.6)
box("SinkBodyFront", -W / 2 + 0.01, W / 2 - 0.01, BY, H - TT, zf + 0.006, BZ1, "sugi", tile=0.6)
box("SinkBodyBack", -W / 2 + 0.01, W / 2 - 0.01, BY, H - TT, BZ0, zb - 0.006, "sugi", tile=0.6)
box("SinkBodyLeft", -W / 2 + 0.01, x0 - 0.006, BY, H - TT, zb - 0.006, zf + 0.006, "sugi", tile=0.6)
box("SinkBodyRight", x1 + 0.006, W / 2 - 0.01, BY, H - TT, zb - 0.006, zf + 0.006, "sugi", tile=0.6)
box("SinkKick", -W / 2 + 0.03, W / 2 - 0.03, 0.0, 0.08, -D / 2 + 0.04, FRONT - 0.06, "kick")
# (the front's frame: stiles at both ends and in the middle, a rail under the top and one at the foot)
for x_ in (-W / 2 + 0.01, MID - 0.02, W / 2 - 0.05):
    box(f"SinkStile{x_:+.2f}", x_, x_ + 0.04, 0.08, H - TT, FRONT - 0.012, FRONT + 0.008, "sugi", bev=0.002, tile=0.6)
box("SinkRailTop", -W / 2 + 0.01, W / 2 - 0.01, H - TT - 0.045, H - TT, FRONT - 0.012, FRONT + 0.008, "sugi", bev=0.002, tile=0.6)
box("SinkRailFoot", -W / 2 + 0.01, W / 2 - 0.01, 0.08, 0.12, FRONT - 0.012, FRONT + 0.008, "sugi", bev=0.002, tile=0.6)
# (under the basin: the opening's inside dark, a noren hung across it on a bamboo rod: two panels, a little wavy, split down the middle.
# The dark is a thin board on the body's face, behind the noren and inside the frame: it stood 0.19 back once, up through the basin's floor,
# a black band across the basin)
box("SinkHollow", -W / 2 + 0.05, MID - 0.02, 0.12, H - TT - 0.045, BZ1 + 0.001, BZ1 + 0.004, "kick")
rod_y = H - TT - 0.06
tube("SinkNorenRod", [(-W / 2 + 0.03, rod_y, FRONT + 0.02), (MID + 0.0, rod_y, FRONT + 0.02)], 0.008, "rod", res=3, sides=8)
for k, (a, b) in enumerate(((-W / 2 + 0.06, -0.39), (-0.375, MID - 0.03))):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    # (6 across, one down: its sway across kept, its hang straight (item 95, the owner's, 2026-11-14: "too many faces, do it with the
    # picture"; 12 by 6, 144 faces a panel, before): the folds' light and shade in its picture (NOREN_FOLDS))
    NX, NY = 6, 1
    top_, bot_ = rod_y - 0.004, 0.14
    grid = [[bm.verts.new(P(a + (b - a) * i / NX, top_ + (bot_ - top_) * j / NY, FRONT + 0.022 + 0.008 * math.sin(i / NX * math.pi * 3 + k) * (j / NY)))
             for i in range(NX + 1)] for j in range(NY + 1)]
    for j in range(NY):
        for i in range(NX):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = ((a + (b - a) * ii / NX + W / 2) / 0.8, 1 - jj / NY)
    me = bpy.data.meshes.new(f"SinkNoren{k}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"SinkNoren{k}", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["noren"])
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
# (to the right: the dish dryer let into the cabinet. Its cavity first: a box open at its front, its inside faces dark, the body round it)
bm = bmesh.new()
cx0, cx1, cy0, cy1, cz0, cz1 = CAV
vs = [bm.verts.new(P(x_, y_, z_)) for x_ in (cx0, cx1) for y_ in (cy0, cy1) for z_ in (cz0, cz1)]
idx = lambda i, j, k: vs[i * 4 + j * 2 + k]
# (each face wound to face in: back, floor, ceiling, the two sides; no front)
for quad in (((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)), ((0, 0, 0), (0, 0, 1), (1, 0, 1), (1, 0, 0)),
             ((0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)), ((0, 0, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1)),
             ((1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0))):
    bm.faces.new([idx(*q) for q in quad])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.reverse_faces(bm, faces=bm.faces)
me = bpy.data.meshes.new("SinkDryerCavity")
bm.to_mesh(me)
bm.free()
o = bpy.data.objects.new("SinkDryerCavity", me)
bpy.context.collection.objects.link(o)
o.data.materials.append(M["inner"])
for p_ in o.data.polygons:
    p_.use_smooth = False
parts.append(o)
# (its basket, wire: a frame along its floor and one round its rim, uprights at its corners, two rows of tines the plates stand between; it
# slides out as the door drops (its holder at its front foot). Each wire a thin square-sectioned rod, a mesh for each kind)
RX0, RX1, RZ0, RZ1 = cx0 + 0.015, cx1 - 0.015, cz0 + 0.03, cz1 - 0.03
RY0, RY1 = cy0 + 0.012, cy0 + 0.1
WIRE_R = 0.0022


def wire_set(name, runs, caps=False):
    """thin square-section wires, each run a straight (a, b) in the game's frame, all of them one mesh: 4 long faces a run (8 triangles),
    and a cap at the far end if asked (a tine's tip). 6-sided round rods before, one mesh each: the rack was 880 triangles"""
    bm_ = bmesh.new()
    for a_, b_ in runs:
        a_, b_ = Vector(P(*a_)), Vector(P(*b_))
        d = (b_ - a_).normalized()
        u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized() * WIRE_R
        v = d.cross(u).normalized() * WIRE_R
        ring_a = [bm_.verts.new(a_ + c) for c in (u + v, -u + v, -u - v, u - v)]
        ring_b = [bm_.verts.new(b_ + c) for c in (u + v, -u + v, -u - v, u - v)]
        for i in range(4):
            j = (i + 1) % 4
            bm_.faces.new((ring_a[i], ring_a[j], ring_b[j], ring_b[i]))
        if caps:
            bm_.faces.new(ring_b)
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M["steel"])
    for p_ in o.data.polygons:
        p_.use_smooth = False
    parts.append(o)
    return o


ring_runs = []
for y_ in (RY0, RY1):
    c_ = ((RX0, y_, RZ0), (RX1, y_, RZ0), (RX1, y_, RZ1), (RX0, y_, RZ1), (RX0, y_, RZ0))
    ring_runs += list(zip(c_[:-1], c_[1:]))
wire_set("SinkRackWireRings", ring_runs)
wire_set("SinkRackWirePosts", [((xx, RY0, zz), (xx, RY1, zz)) for xx, zz in ((RX0, RZ0), (RX1, RZ0), (RX1, RZ1), (RX0, RZ1))])
# (the floor's cross wires, and the tines: two rows along it, a plate standing between each pair)
TINE_ROWS = (ZF - 0.29, ZF - 0.13)
NT = 13
floor_runs = [(((RX0 + (RX1 - RX0) * (k + 0.5) / 6), RY0, RZ0), ((RX0 + (RX1 - RX0) * (k + 0.5) / 6), RY0, RZ1)) for k in range(6)]
floor_runs += [((RX0, RY0, zz), (RX1, RY0, zz)) for zz in TINE_ROWS]
wire_set("SinkRackWireFloor", floor_runs)
wire_set("SinkRackWireTines", [((RX0 + 0.02 + (RX1 - RX0 - 0.04) * k / (NT - 1), RY0, zz), (RX0 + 0.02 + (RX1 - RX0 - 0.04) * k / (NT - 1), RY0 + 0.075, zz))
                               for zz in TINE_ROWS for k in range(NT)], caps=True)
RACK_AT = ((cx0 + cx1) / 2, cy0, cz1)
# (where the first and the last plate stand: in the basket, upright, in a row along it (they go with it as it slides))
empty("SinkDryerRack0", cx0 + 0.09, cy0 + 0.035 + 0.16, ZF - 0.21)
empty("SinkDryerRack1", cx1 - 0.09, cy0 + 0.035 + 0.16, ZF - 0.21)
# (the bezel round it: stainless, the control strip across its top black, three buttons and the lamp)
PY0 = BY - 0.004
box("SinkDryerBezelTop", DX0, DX1, PY0, DY1, ZF - 0.012, ZF, "steel", bev=0.002)
box("SinkDryerBezelFoot", DX0, DX1, DY0, CAV[2], ZF - 0.012, ZF, "steel", bev=0.002)
box("SinkDryerBezelL", DX0, CAV[0], CAV[2], PY0, ZF - 0.012, ZF, "steel", bev=0.002)
box("SinkDryerBezelR", CAV[1], DX1, CAV[2], PY0, ZF - 0.012, ZF, "steel", bev=0.002)
box("SinkDryerPanel", DX0 + 0.03, DX1 - 0.03, PY0 + 0.018, DY1 - 0.018, ZF, ZF + 0.005, "panel", bev=0.002)
for k, bx in enumerate((DX0 + 0.1, DX0 + 0.16, DX0 + 0.22)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.011, depth=0.006, location=P(bx, (PY0 + DY1) / 2, ZF + 0.007), rotation=(math.pi / 2, 0, 0))
    o = active()
    finish(o, f"SinkDryerButton{k}", M["button"])
    parts.append(o)
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.008, depth=0.006, location=P(DX1 - 0.09, (PY0 + DY1) / 2, ZF + 0.007), rotation=(math.pi / 2, 0, 0))
o = active()
finish(o, "SinkDryerLamp", M["lamp"])
parts.append(o)
# (where its progress ring is lit, on the panel between the buttons and the lamp; where the steam comes out, at the top of its opening)
empty("SinkDryerRing", DX1 - 0.16, (PY0 + DY1) / 2, ZF + 0.0056)
empty("SinkDryerSteam", (cx0 + cx1) / 2, cy1 - 0.02, ZF + 0.03)
# (its door, hinged along its foot (the set's own place, SinkDryerDoor): a stainless frame round a pane of dark glass, a bar along its top
# to pull it down by)
GY0, GY1 = CAV[2] + 0.004, PY0 - 0.004
gx0, gx1 = CAV[0] + 0.004, CAV[1] - 0.004
box("SinkDryerDoorBarFoot", gx0, gx1, GY0, GY0 + 0.05, ZF, ZF + 0.02, "steel", bev=0.003)
box("SinkDryerDoorBarTop", gx0, gx1, GY1 - 0.07, GY1, ZF, ZF + 0.02, "steel", bev=0.003)
box("SinkDryerDoorBarL", gx0, gx0 + 0.04, GY0 + 0.05, GY1 - 0.07, ZF, ZF + 0.02, "steel", bev=0.003)
box("SinkDryerDoorBarR", gx1 - 0.04, gx1, GY0 + 0.05, GY1 - 0.07, ZF, ZF + 0.02, "steel", bev=0.003)
box("SinkDryerGlass", gx0 + 0.04, gx1 - 0.04, GY0 + 0.05, GY1 - 0.07, ZF + 0.008, ZF + 0.012, "glass")
tube("SinkDryerHandle", [(gx0 + 0.07, GY1 - 0.035, ZF + 0.045), (gx1 - 0.07, GY1 - 0.035, ZF + 0.045)], 0.007, "steel", res=1, sides=8)
for hx in (gx0 + 0.07, gx1 - 0.07):
    box(f"SinkDryerHandlePost{hx:.2f}", hx - 0.006, hx + 0.006, GY1 - 0.041, GY1 - 0.029, ZF + 0.02, ZF + 0.045, "steel")
DOOR_HINGE = ((gx0 + gx1) / 2, GY0, ZF + 0.01)
# (a wooden bar across the cabinet's other end, toward its back, a cloth hung over it (it hung across the right's doors, where the dryer is))
TX = -W / 2 - 0.035
tube("SinkTowelBar", [(TX, H - TT - 0.03, -0.36), (TX, H - TT - 0.03, -0.06)], 0.008, "rod", res=3, sides=8)
for z_ in (-0.36, -0.06):
    box(f"SinkTowelPeg{z_:.2f}", -W / 2 - 0.035, -W / 2 + 0.002, H - TT - 0.04, H - TT - 0.02, z_ - 0.008, z_ + 0.008, "sugi")
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
cl = []
for j in range(9):
    t = j / 8
    if t < 0.5:
        a_ = math.pi * t / 0.5
        y_, x_ = H - TT - 0.03 + 0.012 * math.sin(a_), TX - 0.012 * math.cos(a_)
    else:
        y_, x_ = H - TT - 0.03 - (t - 0.5) * 0.36, TX - (0.012 if j % 2 else 0.016) * (1 if t > 0.5 else -1)
    cl.append([bm.verts.new(P(x_ + 0.004 * math.sin(i * 1.7 + j), y_, -0.33 + 0.24 * i / 4)) for i in range(5)])
for j in range(8):
    for i in range(4):
        f = bm.faces.new((cl[j][i], cl[j][i + 1], cl[j + 1][i + 1], cl[j + 1][i]))
        for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
            loop[uvl].uv = (ii / 4, jj / 8)
me = bpy.data.meshes.new("SinkTowel")
bm.to_mesh(me)
bm.free()
o = bpy.data.objects.new("SinkTowel", me)
bpy.context.collection.objects.link(o)
o.data.materials.append(M["cloth"])
for p in o.data.polygons:
    p.use_smooth = True
parts.append(o)

# ---------------------------------------------------------------------------------------------------- the tap
# (a commercial kitchen's: brushed stainless, a short round body on a foot, a high arched gooseneck swivel spout over the basin with an
# aerator at its mouth, a single flat lever on top (the owner's: the brass cross tap was the washroom's, out of place in a kitchen))
tx = (x0 + x1) / 2
tz = -D / 2 + 0.07
cyl("SinkTapFoot", tx, H, H + 0.012, tz, 0.032, "faucet", seg=16, r1=0.028)
cyl("SinkTapBody", tx, H + 0.012, H + 0.13, tz, 0.022, "faucet", seg=16)
# (the spout: from the body's side, straight up, over in an arch and down toward the basin's middle)
mz = (BASIN[2] + BASIN[3]) / 2 - 0.02
spout = [(tx, H + 0.1, tz + 0.016), (tx, H + 0.3, tz + 0.02), (tx, H + 0.37, tz + (mz - tz) * 0.35), (tx, H + 0.33, tz + (mz - tz) * 0.8),
         (tx, H + 0.25, mz)]
tube("SinkTapSpout", spout, 0.011, "faucet", res=3, sides=8)
mouth = spout[-1]
# (the aerator: a short wider cylinder at its mouth, its screen darker)
cyl("SinkTapMouth", tx, mouth[1] - 0.026, mouth[1] + 0.004, mouth[2], 0.0135, "faucet", seg=12)
cyl("SinkTapScreen", tx, mouth[1] - 0.027, mouth[1] - 0.025, mouth[2], 0.011, "drain", seg=12)
empty("SinkSpoutTip", tx, mouth[1] - 0.05, mouth[2])
# (the lever on top: a short stem, a flat bar out to the side ending in a rounded paddle, a cap; turned about the body's upright)
cyl("SinkTapStem", tx, H + 0.13, H + 0.155, tz, 0.014, "faucet", seg=12)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(tx + 0.045, H + 0.158, tz))
lever = active()
lever.scale = (0.085, 0.008, 0.016)
apply_scale(lever)
bv = lever.modifiers.new("b", "BEVEL"); bv.width = 0.003; bv.segments = 1
bpy.context.view_layer.objects.active = lever
bpy.ops.object.modifier_apply(modifier="b")
finish(lever, "SinkTapArm0", M["faucet"])
parts.append(lever)
cyl("SinkTapCap", tx, H + 0.155, H + 0.166, tz, 0.014, "faucet", seg=12, r1=0.009)

# ---------------------------------------------------------------------------------------------------- on the counter
# (the draining basket: woven bamboo, a rim of split cane, standing on the draining part)
# (twelve plates' worth long (the owner's, 2026-11-10: wider, twelve at least), out to the counter's end now the pail's gone)
bx0, bx1, bz0, bz1 = 0.0, 0.74, -0.34, 0.02
bm = bmesh.new()
uvl = bm.loops.layers.uv.new()
y0_, y1_ = H + 0.012, H + 0.13
# (its corners rounded, as a woven basket's are (the owner's: finer made), four steps round each)
CR, cx_, cz_ = 0.035, (bx0 + bx1) / 2, (bz0 + bz1) / 2
corners = []
for qx, qz, a0 in ((bx0 + CR, bz0 + CR, math.pi), (bx1 - CR, bz0 + CR, 1.5 * math.pi), (bx1 - CR, bz1 - CR, 0.0), (bx0 + CR, bz1 - CR, 0.5 * math.pi)):
    for k in range(4):
        a = a0 + k / 3 * math.pi / 2
        corners.append((qx + math.cos(a) * CR, qz + math.sin(a) * CR))
lo = [bm.verts.new(P(x_, y0_, z_)) for x_, z_ in corners]
hi = [bm.verts.new(P(x_ + 0.012 * np.sign(x_ - cx_), y1_, z_ + 0.012 * np.sign(z_ - cz_))) for x_, z_ in corners]
fb = bm.faces.new(lo[::-1])
for loop in fb.loops:
    loop[uvl].uv = ((loop.vert.co.x + 1) * 2, (loop.vert.co.y + 1) * 2)
_run = 0.0
for i in range(len(corners)):
    j = (i + 1) % len(corners)
    f = bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    L_ = (Vector(corners[j]) - Vector(corners[i])).length
    # (the weave run on round its sides, unbroken at the corners)
    for loop, uv in zip(f.loops, ((_run * 3, 0), ((_run + L_) * 3, 0), ((_run + L_) * 3, 0.36), (_run * 3, 0.36))):
        loop[uvl].uv = uv
    _run += L_
me = bpy.data.meshes.new("SinkBasket")
bm.to_mesh(me)
bm.free()
basket = bpy.data.objects.new("SinkBasket", me)
bpy.context.collection.objects.link(basket)
basket.data.materials.append(M["bamboo"])
sol = basket.modifiers.new("s", "SOLIDIFY")
sol.thickness = 0.006
bpy.context.view_layer.objects.active = basket
bpy.ops.object.modifier_apply(modifier="s")
parts.append(basket)
# (its rim a thick bound hoop of split bamboo, round its rounded top; a second, thinner, just under it on its outside)
rim = [(x_ + 0.012 * np.sign(x_ - cx_), y1_, z_ + 0.012 * np.sign(z_ - cz_)) for x_, z_ in corners]
tube("SinkBasketRim", rim + [rim[0]], 0.008, "rod", res=1, sides=8)
rim2 = [(x_ + 0.0115 * np.sign(x_ - cx_), y1_ - 0.022, z_ + 0.0115 * np.sign(z_ - cz_)) for x_, z_ in corners]
tube("SinkBasketRimLow", rim2 + [rim2[0]], 0.0045, "rod", res=1, sides=6)
# (feet: two little bamboo runners under it)
for z_ in (bz0 + 0.04, bz1 - 0.04):
    tube(f"SinkBasketFoot{z_:+.2f}", [(bx0 + 0.02, H + 0.006, z_), (bx1 - 0.02, H + 0.006, z_)], 0.006, "rod", res=1, sides=8)
# (in it: two notched bamboo rails along it either side of the plates' row, a notch for each plate, so they stand each in its own, a gap
# between them (the owner's, 2026-11-12: the three rods along its floor and the bowl read as nothing, the plates packed together); one solid
# comb each, the notches cut in its top (no rod or peg apiece))
RACK_N, RACK_X0, RACK_X1 = 30, 0.04, 0.70
RACK_PITCH = (RACK_X1 - RACK_X0) / (RACK_N - 1)
RAIL_LO, RAIL_HI, NOTCH = y0_ + 0.004, y0_ + 0.062, y0_ + 0.022   # (its teeth 4 cm over the notches: a comb, not a ridge (item 152))
SLAT_TOP = y0_ + 0.004
LANE_Z = (bz0 + bz1) / 2
# (8 cm either side of the row's middle: where a plate's round edge comes down to the notches' floor)
# (made as a bamboo comb is (the owner's, 2026-11-15: "these two are too plain": flat boards with square notches, one flat colour): each
# tooth's top a rounded tip, each notch's floor rounded, 7 mm thick; split bamboo on it, its fibres along it, a darker node at three places,
# lighter toward its teeth; and along its outer foot a round bamboo pole, its nodes ringed, the comb's stiffener)
def comb_picture(n=512):
    """split bamboo, its colours as written (the picture's own sRGB: lin()'s values there came out a deep orange, a round beam's shading):
    pale straw toward the teeth, a shade warmer at the foot, fine fibres along it, three darker nodes with a pale lip"""
    u, v = grid01(n)
    srgb = lambda h: np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
    col = mix(srgb("#c9a764"), srgb("#ecd9a6"), np.clip(v * 1.2, 0, 1))
    fib = vnoise(n, 3, 140)
    col = col * (0.9 + 0.14 * fib)[..., None]
    for at in (0.17, 0.5, 0.83):
        d = np.abs(u - at)
        col = mix(col, srgb("#8a6a3a"), smooth(0.01, 0.003, d) * 0.8)
        col = mix(col, srgb("#f6e8c0"), (smooth(0.018, 0.012, d) - smooth(0.012, 0.010, d)).clip(0, 1) * 0.6)
    return col


M["comb"] = pbr("SinkComb", (1, 1, 1), tex=image("sink_comb", comb_picture()), rough=0.55)
M["pole"] = pbr("SinkPole", lin("#d9c088"), rough=0.5)
M["pole_node"] = pbr("SinkPoleNode", lin("#a07a44"), rough=0.55)
for zi, z_ in enumerate((LANE_Z - 0.082, LANE_Z + 0.082)):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    top = []
    tw = RACK_PITCH * 0.2                 # (a tooth's half width; its tip three points: a shoulder either side of a crown (a chamfered tip))
    for k in range(RACK_N + 1):
        xt = RACK_X0 - RACK_PITCH / 2 + k * RACK_PITCH
        top.append((xt - tw, RAIL_HI - tw * 0.7))
        top.append((xt, RAIL_HI))
        top.append((xt + tw, RAIL_HI - tw * 0.7))
        if k < RACK_N:
            # (the notch: its floor two points, flat between them, its walls a slant down from the teeth either side)
            xn = RACK_X0 + k * RACK_PITCH
            nw = (RACK_PITCH - 2 * tw) / 2 * 0.62
            top.append((xn - nw, NOTCH))
            top.append((xn + nw, NOTCH))
    xa, xb = top[0][0], top[-1][0]
    uv_ = lambda x_, y_: ((x_ - xa) / (xb - xa), (y_ - RAIL_LO) / (RAIL_HI - RAIL_LO))
    # (filled as a ladder: a strip from each point along the top straight down to the foot, every face a quad (one many-sided face, the
    # notches came out filled in by its triangulation: a plain board). 5 points a pitch, no foot (it lies on the basket's floor, out of
    # sight): 1,956 triangles a comb before, 8 points a pitch and a foot)
    cols = []
    for x_, y_ in top:
        cols.append([(bm.verts.new(P(x_, yy, z_ + sd * 0.0035)), (x_, yy)) for sd in (-1, 1) for yy in (RAIL_LO, y_)])
    # (each column: front foot, front top, back foot, back top)
    def quad(a, b, c, d):
        f = bm.faces.new((a[0], b[0], c[0], d[0]))
        for l, q in zip(f.loops, (a, b, c, d)):
            l[uvl].uv = uv_(*q[1])
    for k in range(len(cols) - 1):
        (af, at_, ab, abt), (bf, bt, bb, bbt) = cols[k], cols[k + 1]
        quad(af, bf, bt, at_)          # (front)
        quad(bb, ab, abt, bbt)         # (back)
        quad(at_, bt, bbt, abt)        # (top)
    for c_, fl in ((cols[0], True), (cols[-1], False)):
        f_, t_, b_, bt_ = c_
        quad(*((f_, b_, bt_, t_) if fl else (b_, f_, t_, bt_)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"SinkBasketRail{zi}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"SinkBasketRail{zi}", me)
    bpy.context.collection.objects.link(o)
    finish(o, f"SinkBasketRail{zi}", M["comb"], smooth_shade=False)
    parts.append(o)
    # (the pole along its outer foot, a hair off the comb and the basket's floor, its three nodes ringed)
    zo = z_ + (-1 if zi == 0 else 1) * (0.0035 + 0.0055)
    tube(f"SinkBasketPole{zi}", [(xa, RAIL_LO + 0.0052, zo), (xb, RAIL_LO + 0.0052, zo)], 0.0048, "pole", res=1, sides=8)
    for q, at in enumerate((0.17, 0.5, 0.83)):
        xq = xa + (xb - xa) * at
        tube(f"SinkBasketPoleNode{zi}{q}", [(xq - 0.003, RAIL_LO + 0.0052, zo), (xq + 0.003, RAIL_LO + 0.0052, zo)], 0.0056, "pole_node", res=1, sides=8)
# (the game's plates (GuestBar3D's, 0.197 round in the sink's units) stand in the notches across its middle, along its slots: the slots'
# marks two pitches apart from the first notch, so the game finds the pitch and the start)
RACK_PLATE_R = 0.197
for k in range(3):
    empty(f"SinkRackSlot{k}", RACK_X0 + k * RACK_PITCH * 2, SLAT_TOP + RACK_PLATE_R, LANE_Z)
# (by the basin's front right corner: the palm scrubber on its dish, the soap on its)
cyl("SinkDish0", -0.02, H, H + 0.01, 0.2, 0.05, "dish", seg=20, r1=0.055)
# (a cube's faces cut four by four and pushed out round: 96 quads, 192 triangles, no point a fan of them gathers at (a uv sphere's
# 14 at each pole shaded in a dark spot, the owner's low-poly rule; 196 before); a point at each face's middle, so it's as long, wide
# and tall as before (cut three by three it came out a tenth smaller); bumped as before)
bpy.ops.mesh.primitive_cube_add(size=2, location=P(-0.02, H + 0.035, 0.2))
palm = active()
bm = bmesh.new()
bm.from_mesh(palm.data)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
for vtx in bm.verts:
    vtx.co = vtx.co.normalized()
bm.to_mesh(palm.data)
bm.free()
palm.scale = (0.055, 0.035, 0.03)
apply_scale(palm)
bm = bmesh.new()
bm.from_mesh(palm.data)
for vtx in bm.verts:
    vtx.co *= 1 + 0.08 * math.sin(vtx.co.x * 260) * math.cos(vtx.co.y * 310)
bm.to_mesh(palm.data)
bm.free()
cyl_uv(palm)
finish(palm, "SinkPalm", M["palm"])
parts.append(palm)
# (the soap on its dish, behind the tap to its right, on the strip between the basin and the upstand (the owner's: by the basin's right it was
# in the basket's way))
SPZ = (zb + (-D / 2 + 0.04)) / 2
cyl("SinkDish1", -0.25, H, H + 0.01, SPZ, 0.045, "dish", seg=20, r1=0.05)
box("SinkSoap", -0.285, -0.215, H + 0.01, H + 0.035, SPZ - 0.0225, SPZ + 0.0225, "soap", bev=0.008, seg=3)
# (behind the tap to its left: a pump bottle of dish soap, its body a pale see-through green and the soap in it green, a white pump on it,
# its spout out over the counter; and beside it a sponge scourer, its green scouring side up on its yellow sponge)
DSX = -0.55
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.031, depth=0.13, location=P(DSX, H + 0.068, SPZ))
o = active()
cyl_uv(o)
finish(o, "SinkDetergentBottle", M["soapbottle"])
parts.append(o)
cyl("SinkDetergentShoulder", DSX, H + 0.133, H + 0.158, SPZ, 0.031, "soapbottle", seg=16, r1=0.014)
cyl("SinkDetergentSoap", DSX, H + 0.004, H + 0.1, SPZ, 0.0285, "soapgreen", seg=16)
cyl("SinkDetergentCollar", DSX, H + 0.158, H + 0.172, SPZ, 0.016, "pump", seg=12)
cyl("SinkDetergentPump", DSX, H + 0.172, H + 0.2, SPZ, 0.006, "pump", seg=8)
box("SinkDetergentHead", DSX - 0.016, DSX + 0.016, H + 0.2, H + 0.212, SPZ - 0.012, SPZ + 0.012, "pump", bev=0.003)
tube("SinkDetergentSpout", [(DSX, H + 0.206, SPZ + 0.01), (DSX, H + 0.206, SPZ + 0.045)], 0.004, "pump", res=1, sides=6)
SGX = -0.67
box("SinkSpongeBase", SGX - 0.05, SGX + 0.05, H, H + 0.022, SPZ - 0.035, SPZ + 0.035, "sponge", bev=0.004, seg=2)
box("SinkSpongeScour", SGX - 0.05, SGX + 0.05, H + 0.022, H + 0.032, SPZ - 0.035, SPZ + 0.035, "scour", bev=0.003, seg=1)
# (no hinoki hand pail at the far end now: the owner's, 2026-11-10, crossed out; the draining basket runs on to there)

# (where the washed plates are stacked, and where whoever brings or takes them stands)
# (beside the cabinet's other end, toward its front: the bins (the owner's, 2026-11-11: "the old bin taken away, a rubbish bin and a recycling
# bin in its place"; bigger and close against the cabinet's side (item 94); their backs against the wall, opening (item 136)). Made over in
# the shop's own joinery (item 208, the owner's, 2026-11-16: 「垃圾桶及資源回收桶不好看，然後它們也得運作」: they were two plain plastic boxes,
# a charcoal one and a blue one): a matching pair of wooden bins as the washroom's washstand is made, dark sugi corner posts and rails round
# pale hinoki, the front a lattice of hinoki slats (竪格子) over a dark ground, a dark plinth set back under it; a hinoki lid on each, hinged
# along its back (each origin on its hinge, for the game to lift), a sugi pull under its front edge; a little hinoki plaque on each front with
# its name burnt into it (一般垃圾 / 燃えるゴミ; 資源回收 / びん・かん and the recycling mark), the words drawn into one picture (BIN_PRINT);
# the recycling bin's lid with a round, brass-ringed hole for a bottle or a can. Inside each, a bag over its mouth (black for the rubbish,
# pale blue for the bottles and cans), each its own (the game takes it out with what's in it, and puts a new one in); and where the bin's
# mouth and its floor are (SinkBinTop and SinkBinFloor, SinkBinRecTop and SinkBinRecFloor) for what's thrown in to be drawn filling it.
BW, BH = 0.26, 0.52
BX = -W / 2 - BW / 2 - 0.01
BZ = -D / 2 + 0.016 + BW / 2
RX = BX - BW - 0.03         # the recycling bin's, out beside the rubbish bin
M["bin_ink"] = pbr("SinkBinInk", lin("#5a3820"), rough=0.6)        # burnt into the plaques
M["bin_white"] = pbr("SinkBinMark", lin("#2f6aa8"), rough=0.6)     # the recycling mark, blue
M["bin_hole"] = pbr("SinkBinHole", lin("#141518"), rough=0.8)
M["bin_ring"] = pbr("SinkBinRing", lin("#b8913f"), rough=0.4)
M["bin_ground"] = pbr("SinkBinGround", lin("#2a1c12"), rough=0.75)  # the dark ground behind the lattice
M["liner_rec"] = pbr("SinkBinLinerRec", lin("#9fc4dd"), rough=0.55)
POST = 0.024                # the corner posts' side
PLINTH = 0.04               # the plinth's height
TOPF = 0.035                # the top frame's depth down from the top
LID_T = 0.018               # the lid's thickness


def shell(name, x, z, y0, y1, half, mat, inward=False, bottom=True):
    """an open square shell round (x, z), `half` out each way, from y0 to y1: its four sides (and its foot), facing out or in"""
    bm_ = bmesh.new()
    lo = [bm_.verts.new(P(x + sx * half, y0, z + sz * half)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    hi = [bm_.verts.new(P(x + sx * half, y1, z + sz * half)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        j = (i + 1) % 4
        bm_.faces.new((lo[i], lo[j], hi[j], hi[i]))
    if bottom:
        bm_.faces.new(lo[::-1])
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    if inward:
        bmesh.ops.reverse_faces(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    box_uv(o, 0.5)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def open_box(name, x0, x1, y0, y1, z0, z1, mat):
    """a box open at its top: its four sides and its foot, facing out"""
    bm_ = bmesh.new()
    lo = [bm_.verts.new(P(x, y0, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    hi = [bm_.verts.new(P(x, y1, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    for i in range(4):
        j = (i + 1) % 4
        bm_.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm_.faces.new(lo[::-1])
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    box_uv(o, 0.6)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def frame_ring(name, x, z, y0, y1, outer, inner, mat):
    """a square frame round (x, z), `outer` across outside and `inner` inside, from y0 to y1: its top, its foot, its outer and inner sides"""
    bm_ = bmesh.new()
    def sq(y, h):
        return [bm_.verts.new(P(x + sx * h, y, z + sz * h)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ot, it, ob, ib = sq(y1, outer / 2), sq(y1, inner / 2), sq(y0, outer / 2), sq(y0, inner / 2)
    for i in range(4):
        j = (i + 1) % 4
        bm_.faces.new((ot[i], ot[j], it[j], it[i]))      # top
        bm_.faces.new((ob[j], ob[i], ib[i], ib[j]))      # foot
        bm_.faces.new((ob[i], ob[j], ot[j], ot[i]))      # outer side
        bm_.faces.new((it[i], it[j], ib[j], ib[i]))      # inner side
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    box_uv(o, 0.5)
    o.data.materials.append(M[mat])
    parts.append(o)
    return o


def join_into(first, rest):
    bpy.ops.object.select_all(action="DESELECT")
    for o in [first, *rest]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = first
    bpy.ops.object.join()
    for o in rest:
        parts.remove(o)
    return first


def wood_bin(pre, cx, liner_mat):
    """one of the pair, its middle at (cx, BZ): its carcass and front (joined, one piece of the set), its bag, its lid (hinged, its own)"""
    x0, x1, z0, z1 = cx - BW / 2, cx + BW / 2, BZ - BW / 2, BZ + BW / 2
    top = BH - TOPF
    bits = []
    # (the plinth, set back at the front and the sides (none at the back: against the wall))
    bits.append(box(pre + "Plinth", x0 + 0.012, x1 - 0.012, 0.0, PLINTH, z0 + 0.004, z1 - 0.014, "kick"))
    # (the carcass: pale hinoki sides and back, its front well back (the lattice stands before it); open at the top, the bag inside it to be
    # seen down the bin's mouth, not a lid of wood over it all)
    bits.append(open_box(pre + "Carcass", x0 + 0.004, x1 - 0.004, PLINTH - 0.004, top + 0.004, z0 + 0.004, z1 - 0.014, "hinoki"))
    # (the four corner posts of dark sugi, standing a few millimetres proud of the sides and the front)
    for sx in (0, 1):
        for sz in (0, 1):
            px0 = x0 if sx == 0 else x1 - POST
            pz0 = z0 if sz == 0 else z1 - POST
            bits.append(box(pre + "Post%d%d" % (sx, sz), px0, px0 + POST, PLINTH - 0.002, top + 0.002, pz0, pz0 + POST, "sugi", bev=0.002, seg=1))
    # (the front between the posts: a dark ground, sugi rails over and under, and the hinoki lattice before the ground)
    fx0, fx1 = x0 + POST, x1 - POST
    bits.append(box(pre + "Ground", fx0, fx1, PLINTH + 0.02, top - 0.03, z1 - 0.012, z1 - 0.008, "bin_ground"))
    bits.append(box(pre + "RailLo", fx0, fx1, PLINTH - 0.002, PLINTH + 0.03, z1 - 0.013, z1 - 0.002, "sugi"))
    bits.append(box(pre + "RailHi", fx0, fx1, top - 0.04, top + 0.002, z1 - 0.013, z1 - 0.002, "sugi"))
    n_sl, sl_w = 5, 0.014
    for k in range(n_sl):
        mx = fx0 + (fx1 - fx0) * (k + 0.5) / n_sl
        bits.append(box(pre + "Slat%d" % k, mx - sl_w / 2, mx + sl_w / 2, PLINTH + 0.026, top - 0.036, z1 - 0.010, z1 - 0.004, "hinoki", tile=0.6))
    # (the top frame of sugi the lid sits on, its inner edge the bin's mouth)
    bits.append(frame_ring(pre + "TopFrame", cx, BZ, top, BH - 0.0005, BW, BW - 0.06, "sugi"))
    body = join_into(bits[0], bits[1:])
    body.name = pre + "Body"
    # (the bag: down inside the carcass, over the frame's inner edge, a hair inside it)
    lb = shell(pre + "Liner", cx, BZ, PLINTH + 0.01, BH - 0.004, BW / 2 - 0.032, liner_mat, inward=True)
    fold = frame_ring(pre + "LinerFold", cx, BZ, BH - 0.03, BH + 0.0002, BW - 0.058, BW - 0.066, liner_mat)
    liner = join_into(lb, [fold])
    liner.name = pre + "Liner"
    # (the lid: hinoki, its edges eased, a sugi pull under its front edge; its origin on its hinge along the back)
    lid = box(pre + "Lid", x0 - 0.002, x1 + 0.002, BH, BH + LID_T, z0 + 0.002, z1 + 0.004, "hinoki", bev=0.004, seg=1, tile=0.6)
    pull = box(pre + "LidPull", cx - 0.045, cx + 0.045, BH - 0.012, BH + 0.006, z1 + 0.002, z1 + 0.016, "sugi", bev=0.003, seg=1)
    lid = join_into(lid, [pull])
    lid.name = pre + "Lid"
    bpy.context.scene.cursor.location = P(cx, BH, z0 + 0.002)
    bpy.ops.object.select_all(action="DESELECT"); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    empty(pre + "Top", cx, BH - 0.05, BZ)
    empty(pre + "Floor", cx, PLINTH + 0.012, BZ)
    return body, lid


wood_bin("SinkBin", BX, "liner")
wood_bin("SinkBinRec", RX, "liner_rec")
# (where whoever empties them stands: before the pair, facing them)
empty("SinkBinFront", (BX + RX) / 2, 0.0, BZ + BW / 2 + 0.42)

# ---- what's in them, to be seen filling them (item 208): each bin's heap, its origin at its foot's middle (the game raises it with how full
# the bin is, from its floor toward its mouth, and hides it while it's empty); the bags taken out (tied, carried off by the stock keeper) and
# the new one brought back folded, each its own, hidden in the bins till the game wants them
HEAP_HALF = BW / 2 - 0.034
NP = 256
hu, hv = grid01(NP)
# (the rubbish: a black bag's inside, its folds catching the light; crumpled tissues, a fish's bones, a few bamboo sticks across it)
heap_px = mix((0.07, 0.07, 0.075), (0.16, 0.16, 0.17), smooth(0.55, 0.9, fbm(NP, 5, 5, 4)))
for k in range(7):
    cx_, cy_ = 0.12 + 0.76 * ((k * 0.381) % 1), 0.12 + 0.76 * ((k * 0.617 + 0.2) % 1)
    blob = smooth(0.075, 0.045, np.hypot(hu - cx_, hv - cy_) + (fbm(NP, 9, 9, 3) - 0.5) * 0.05)
    heap_px = mix(heap_px, (0.93, 0.92, 0.88), blob * (0.8 + 0.2 * fbm(NP, 20, 20, 2)))
for k, (bx_, by_, ang) in enumerate(((0.32, 0.62, 0.5), (0.7, 0.34, -0.9))):
    ca, sa = math.cos(ang), math.sin(ang)
    du, dv = hu - bx_, hv - by_
    al, ac = du * ca + dv * sa, -du * sa + dv * ca
    spine = smooth(0.008, 0.003, np.abs(ac)) * (np.abs(al) < 0.13)
    ribs = smooth(0.006, 0.002, np.abs((al * 60) % 1 - 0.5) / 60) * (np.abs(ac) < 0.04 - np.abs(al) * 0.15) * (np.abs(al) < 0.11)
    heap_px = mix(heap_px, (0.86, 0.81, 0.68), np.clip(spine + ribs, 0, 1))
for k in range(5):
    ang = k * 1.9 + 0.3
    ca, sa = math.cos(ang), math.sin(ang)
    du, dv = hu - (0.2 + 0.15 * k), hv - (0.25 + 0.11 * ((k * 3) % 5))
    al, ac = du * ca + dv * sa, -du * sa + dv * ca
    heap_px = mix(heap_px, (0.66, 0.5, 0.31), smooth(0.006, 0.002, np.abs(ac)) * (np.abs(al) < 0.18))
M["heap"] = pbr("SinkBinHeapPic", (1, 1, 1), tex=image("sink_bin_heap", np.clip(heap_px, 0, 1).astype(np.float32)), rough=0.55)
# (the bottles and cans: a pale blue bag's inside, a can's top showing here and there)
rec_px = mix((0.55, 0.7, 0.8), (0.68, 0.8, 0.88), smooth(0.5, 0.9, fbm(NP, 5, 5, 4)))
for k in range(9):
    cx_, cy_ = 0.1 + 0.8 * ((k * 0.437) % 1), 0.1 + 0.8 * ((k * 0.729 + 0.1) % 1)
    d_ = np.hypot(hu - cx_, hv - cy_)
    rec_px = mix(rec_px, (0.78, 0.79, 0.8), smooth(0.05, 0.044, d_))
    rec_px = mix(rec_px, (0.45, 0.46, 0.48), smooth(0.012, 0.006, np.abs(d_ - 0.03)))
M["recheap"] = pbr("SinkBinRecHeapPic", (1, 1, 1), tex=image("sink_bin_recheap", np.clip(rec_px, 0, 1).astype(np.float32)), rough=0.45)
M["can_red"] = pbr("SinkBinCanRed", lin("#c4271f"), rough=0.3, metal=0.6)
M["can_silver"] = pbr("SinkBinCanSilver", lin("#c9cdd2"), rough=0.25, metal=0.8)
M["bottle_brown"] = pbr("SinkBinBottleBrown", lin("#5a3212"), rough=0.15)
M["bottle_green"] = pbr("SinkBinBottleGreen", lin("#2f6b3c"), rough=0.15)


def heap(name, x, mat, rise, seed_):
    """a heap filling a bag's square: a grid of 4 by 4 quads, its middle higher, every inner point a little up or down; its origin at its foot"""
    rnd = __import__("random").Random(seed_)
    bm_ = bmesh.new()
    n = 4
    vs = {}
    for i in range(n + 1):
        for j in range(n + 1):
            a, b = i / n * 2 - 1, j / n * 2 - 1
            edge = i in (0, n) or j in (0, n)
            y = 0.0 if edge else rise * (1 - 0.5 * (a * a + b * b)) + rnd.uniform(-0.008, 0.008)
            vs[i, j] = bm_.verts.new(P(x + a * HEAP_HALF, y, BZ + b * HEAP_HALF))
    for i in range(n):
        for j in range(n):
            bm_.faces.new((vs[i, j], vs[i + 1, j], vs[i + 1, j + 1], vs[i, j + 1]))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    for f in bm_.faces:
        if f.normal.z < 0:
            f.normal_flip()
    uvl = bm_.loops.layers.uv.verify()
    for f in bm_.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = ((co.x - (x - HEAP_HALF)) / (2 * HEAP_HALF), (co.y - (-BZ - HEAP_HALF)) / (2 * HEAP_HALF))
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    for poly in o.data.polygons:
        poly.use_smooth = True
    parts.append(o)
    return o


def lathe(name, x, y, z, prof, seg, mat, lying=None, wob=0.0, seed_=0):
    """a turned shape round an upright axis at (x, y, z): `prof` its (radius, height) points from its foot up; its foot and its top closed
    with ladders of quads (no fan into a point); laid on its side toward `lying` (an angle round the upright, radians) if given; each ring's
    points pushed in or out by up to `wob` of its radius (a bag's lumps)"""
    rnd = __import__("random").Random(seed_)
    bm_ = bmesh.new()
    rings = []
    for (r, h) in prof:
        ring = []
        for k in range(seg):
            a = k / seg * 2 * math.pi
            rr = r * (1 + rnd.uniform(-wob, wob))
            ring.append(bm_.verts.new(Vector((rr * math.cos(a), rr * math.sin(a), h))))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm_.faces.new((r0[k], r0[k2], r1[k2], r1[k]))
    ladder_fill(bm_, rings[0][::-1])
    ladder_fill(bm_, rings[-1])
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if lying is not None:
        o.rotation_euler = (0.0, math.pi / 2, lying)
    o.location = P(x, y, z)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(M[mat])
    for poly in o.data.polygons:
        poly.use_smooth = True
    parts.append(o)
    return o


CAN = [(0.026, 0.0), (0.033, 0.008), (0.033, 0.112), (0.027, 0.122)]
BOTTLE = [(0.028, 0.0), (0.031, 0.01), (0.031, 0.1), (0.022, 0.125), (0.011, 0.145), (0.011, 0.165)]
rub_heap = heap("SinkBinHeap", BX, "heap", 0.03, 7)
rec_heap = heap("SinkBinRecHeap", RX, "recheap", 0.024, 11)
# (a few lying on the bottles and cans' heap, sunk a little into it, one across the others; each well inside the bag (measured: along its
# length and across it, at its angle, inside the bag's half less a centimetre))
items = []
for k, (prof, mat, dx, dz, ang, up) in enumerate(((BOTTLE, "bottle_brown", -0.035, 0.0, 1.87, 0.0), (CAN, "can_silver", 0.03, -0.02, 1.9, 0.0),
                                                 (CAN, "can_red", -0.02, 0.045, 0.15, 0.034))):
    r0 = max(r for r, _ in prof)
    length = prof[-1][1]
    ca, sa = math.cos(ang), math.sin(ang)
    ext_x, ext_z = abs(ca) * length / 2 + abs(sa) * r0, abs(sa) * length / 2 + abs(ca) * r0
    assert abs(dx) + ext_x <= HEAP_HALF - 0.004 and abs(dz) + ext_z <= HEAP_HALF - 0.004, ("bin item out of its bag", k)
    # (its middle on the spot: its foot back half its length along its lying way)
    items.append(lathe("SinkBinRecItem%d" % k, RX + dx - ca * length / 2, 0.012 + r0 * 0.85 + up, BZ + dz + sa * length / 2, prof, 8, mat, lying=ang))
# (each its own mesh under the heap (hung on it once the sets are made, below), not joined into it: a heap of over a hundred triangles is
# more than a small piece is to have; they go up with it as the bin fills)
for o_, x_ in ((rub_heap, BX), (rec_heap, RX)):
    bpy.context.scene.cursor.location = P(x_, 0.0, BZ)
    bpy.ops.object.select_all(action="DESELECT"); o_.select_set(True); bpy.context.view_layer.objects.active = o_
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o_.location = P(x_, PLINTH + 0.012, BZ)
# (the bags tied up and taken out: a lumpy sack gathered to a knot at its top, black for the rubbish and pale blue for the bottles and
# cans; their origin at their knot, where a hand holds them)
BAG = [(0.07, 0.0), (0.105, 0.04), (0.115, 0.13), (0.09, 0.2), (0.035, 0.245), (0.016, 0.26), (0.026, 0.285), (0.01, 0.3)]
for nm, x_, mat, sd in (("SinkBinBag", BX, "liner", 3), ("SinkBinRecBag", RX, "liner_rec", 5)):
    b_ = lathe(nm, x_, PLINTH + 0.02, BZ, BAG, 8, mat, wob=0.07, seed_=sd)
    bpy.context.scene.cursor.location = P(x_, PLINTH + 0.02 + 0.285, BZ)
    bpy.ops.object.select_all(action="DESELECT"); b_.select_set(True); bpy.context.view_layer.objects.active = b_
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
# (a new bag, folded, brought back to go in: a flat black square)
nb = box("SinkBinNewBag", BX - 0.06, BX + 0.06, PLINTH + 0.02, PLINTH + 0.035, BZ - 0.045, BZ + 0.045, "liner", bev=0.004, seg=1)
bpy.context.scene.cursor.location = P(BX, PLINTH + 0.0275, BZ)
bpy.ops.object.select_all(action="DESELECT"); nb.select_set(True); bpy.context.view_layer.objects.active = nb
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
# (each one's plaque on its front, high up over the lattice: pale hinoki, a sugi edge to it)
PLQ_W, PLQ_H, PLQ_Y = 0.17, 0.085, BH - TOPF - 0.11
PLQ_Z = BZ + BW / 2 + 0.006   # its face
for pre, cx in (("SinkBin", BX), ("SinkBinRec", RX)):
    box(pre + "Plaque", cx - PLQ_W / 2, cx + PLQ_W / 2, PLQ_Y - PLQ_H / 2, PLQ_Y + PLQ_H / 2, PLQ_Z - 0.009, PLQ_Z, "hinoki", bev=0.003, seg=1, tile=0.4)

# ---- their names, burnt into the plaques, a hair proud of them; the recycling lid's hole
# (at a finer pitch than the plaques' size asks, and in the regular weight, not the bold: drawn smaller than they're made, the bold strokes ran
# together into blots in the game (item 208))
BIN_PRINT = DecalAtlas("SinkBinPrint", ppm=4000, size=1024)
FONT_ZH = "C:/Windows/Fonts/msjh.ttc"
FONT_JA = "C:/Windows/Fonts/YuGothM.ttc"
FONT_SYM = "C:/Windows/Fonts/seguisym.ttf"
ZH = bpy.data.fonts.load(FONT_ZH) if os.path.exists(FONT_ZH) else None
JA = bpy.data.fonts.load(FONT_JA) if os.path.exists(FONT_JA) else ZH
SYM = bpy.data.fonts.load(FONT_SYM) if os.path.exists(FONT_SYM) else None


def print_on(name, body, size, x, y, font, mat="bin_ink", width=PLQ_W * 0.86):
    bpy.ops.object.text_add(location=P(x, y, PLQ_Z + 0.0012), rotation=(math.pi / 2, 0, 0))
    t = active()
    t.data.body = body
    t.data.size = size
    t.data.align_x = "CENTER"
    t.data.align_y = "CENTER"
    t.data.extrude = 0.0
    t.data.resolution_u = 8
    if font:
        t.data.font = font
    bpy.ops.object.convert(target="MESH")
    t = active()
    if t.dimensions.x > width:
        t.scale.x = width / t.dimensions.x
        apply_scale(t)
    t.name = name
    t.data.materials.clear()
    t.data.materials.append(M[mat])
    q = BIN_PRINT.add(t)
    parts.append(q)
    return q


print_on("SinkBinLabelZh", "一般垃圾", 0.036, BX, PLQ_Y + 0.013, ZH)
print_on("SinkBinLabelJa", "燃えるゴミ", 0.023, BX, PLQ_Y - 0.023, JA)
print_on("SinkBinRecLabelZh", "資源回收", 0.036, RX + 0.014, PLQ_Y + 0.013, ZH, width=PLQ_W * 0.66)
print_on("SinkBinRecLabelJa", "びん・かん", 0.023, RX + 0.014, PLQ_Y - 0.023, JA, width=PLQ_W * 0.66)
print_on("SinkBinRecMark", "\u267b", 0.05, RX - PLQ_W / 2 + 0.03, PLQ_Y - 0.002, SYM, mat="bin_white", width=0.05)
# (the lid's hole: a brass ring and a dark disc in it, a hair over the lid's top toward its front; drawn into the picture with the words)
for nm, r_, mat in (("SinkBinRecRing", 0.05, "bin_ring"), ("SinkBinRecHole", 0.041, "bin_hole")):
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=r_, fill_type="NGON", location=P(RX, BH + LID_T + (0.0012 if mat == "bin_ring" else 0.0018), BZ + 0.035))
    c_ = active()
    c_.name = nm
    c_.data.materials.append(M[mat])
    q = BIN_PRINT.add(c_, lift=0.0)
    parts.append(q)
BIN_PRINT.finish()
# (the hole's ring and disc go with the lid as it's lifted: joined into it, its origin still on its hinge)
join_into(bpy.data.objects["SinkBinRecLid"], [bpy.data.objects["SinkBinRecRing"], bpy.data.objects["SinkBinRecHole"]])
empty("SinkFront", (x0 + x1) / 2, 0.0, D / 2 + 0.45)

# ---------------------------------------------------------------------------------------------------- out
root = bpy.data.objects.new("Sink", None)
bpy.context.collection.objects.link(root)
# (what stands on it in sets of its own, each a piece the game places by itself; the tap's handle a set, to be turned)
SETS = (("SinkBasketSet", ("SinkBasket", "SinkRackPlate", "SinkRackBowl", "SinkRackSlot")),
        ("SinkScrubSet", ("SinkDish0", "SinkPalm")),
        ("SinkSoapSet", ("SinkDish1", "SinkSoap")),
        ("SinkDetergentSet", ("SinkDetergent",)),
        ("SinkSpongeSet", ("SinkSponge",)),
        ("SinkDryerRack", ("SinkRackWire", "SinkDryerRack0", "SinkDryerRack1")),
        ("SinkTowelSet", ("SinkTowel",)),
        ("SinkBinSet", ("SinkBin",)),
        ("SinkDryerDoor", ("SinkDryerDoorBar", "SinkDryerGlass", "SinkDryerHandle")),
        ("SinkTapHandle", ("SinkTapStem", "SinkTapArm", "SinkTapKnob", "SinkTapCap")))
holder = {}
for set_name, prefixes in SETS:
    e = bpy.data.objects.new(set_name, None)
    bpy.context.collection.objects.link(e)
    e.parent = root
    holder[set_name] = (e, prefixes)
# (the handle turns about the tap's own upright; the dryer's door about its hinge along its foot)
holder["SinkTapHandle"][0].location = P(tx, H + 0.158, tz)
holder["SinkDryerDoor"][0].location = P(*DOOR_HINGE)
holder["SinkDryerRack"][0].location = P(*RACK_AT)
# (the holders' own places taken in before what's in them is hung on them, so nothing moves)
bpy.context.view_layer.update()
for o in parts:
    home = next((e for (e, prefixes) in holder.values() if o.name.startswith(prefixes)), None)
    if home is None:
        o.parent = root
    else:
        mw = o.matrix_world.copy()
        o.parent = home
        o.matrix_parent_inverse = home.matrix_world.inverted()
        o.matrix_world = mw
tris = 0
for o in parts:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print("SINK_TRIS", tris)
# (the bottles and cans lying on the recycling bin's heap hung on it, to go up with it as the bin fills (item 208): where they are kept)
bpy.context.view_layer.update()
heap_ = bpy.data.objects["SinkBinRecHeap"]
for o in parts:
    if o.name.startswith("SinkBinRecItem"):
        mw = o.matrix_world.copy()
        o.parent = heap_
        o.matrix_parent_inverse = heap_.matrix_world.inverted()
        o.matrix_world = mw
if os.environ.get("PREVIEW_OPEN"):
    for nm in ("SinkBinLid", "SinkBinRecLid"):
        o_ = bpy.data.objects[nm]
        o_.rotation_euler.x += 1.75
    for nm, k in (("SinkBinHeap", 0.6), ("SinkBinRecHeap", 0.45)):
        o_ = bpy.data.objects[nm]
        o_.location.z += k * (BH - 0.05 - PLINTH - 0.012)
if PREVIEW:
    at = P(*map(float, os.environ.get("PREVIEW_AT", "-0.1,%f,0" % (H * 0.7)).split(",")))
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = P(*map(float, os.environ.get("PREVIEW_CAM", "0.9,1.55,2.0").split(",")))
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (at - cam.location).to_track_quat("-Z", "Y")
    cam.data.lens = 40
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (0.8, 0.2, 0.6)
    bpy.context.collection.objects.link(sun)
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.55, 0.55, 1)
    bpy.context.scene.world = w
export_dish(root, parts + [root] + [e for (e, _) in holder.values()], os.path.join(PROJECT, "public", "models", "sink.glb"), os.path.join(PROJECT, "blender", "sink.blend"), PREVIEW)
print("SINK_DONE")
