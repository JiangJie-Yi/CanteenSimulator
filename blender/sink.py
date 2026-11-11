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
    """a box from its extents (the game's frame), its picture laid at its true size; bevelled along its edges if bev"""
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
bmesh.ops.reverse_faces(bm, faces=bm.faces)
bm.to_mesh(bas.data)
bm.free()
box_uv(bas, 0.5)
finish(bas, "SinkBasin", M["basin"])
parts.append(bas)
# (its drain: a brass ring and a dark grate)
cyl("SinkDrainRing", (x0 + x1) / 2, BASIN_FLOOR, BASIN_FLOOR + 0.004, (zb + zf) / 2, 0.035, "brass", seg=20)
cyl("SinkDrainHole", (x0 + x1) / 2, BASIN_FLOOR + 0.004, BASIN_FLOOR + 0.0045, (zb + zf) / 2, 0.026, "drain", seg=20)
empty("SinkBasinFloor", (x0 + x1) / 2, BASIN_FLOOR + 0.005, (zb + zf) / 2 + 0.03)
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
tube("SinkNorenRod", [(-W / 2 + 0.03, rod_y, FRONT + 0.02), (MID + 0.0, rod_y, FRONT + 0.02)], 0.008, "rod", res=2, sides=8)
for k, (a, b) in enumerate(((-W / 2 + 0.06, -0.39), (-0.375, MID - 0.03))):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    NX, NY = 12, 6
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
# slides out as the door drops (its holder at its front foot). Each wire a thin six-sided rod)
RX0, RX1, RZ0, RZ1 = cx0 + 0.015, cx1 - 0.015, cz0 + 0.03, cz1 - 0.03
RY0, RY1 = cy0 + 0.012, cy0 + 0.1
def wire(name, pts):
    return tube(name, pts, 0.0028, "steel", res=1, sides=6)
for k, y_ in enumerate((RY0, RY1)):
    wire(f"SinkRackWireRing{k}", [(RX0, y_, RZ0), (RX1, y_, RZ0), (RX1, y_, RZ1), (RX0, y_, RZ1), (RX0, y_, RZ0)])
for k, (xx, zz) in enumerate(((RX0, RZ0), (RX1, RZ0), (RX1, RZ1), (RX0, RZ1))):
    wire(f"SinkRackWirePost{k}", [(xx, RY0, zz), (xx, RY1, zz)])
# (the floor's cross wires, and the tines: two rows along it, a plate standing between each pair)
for k in range(6):
    xx = RX0 + (RX1 - RX0) * (k + 0.5) / 6
    wire(f"SinkRackWireCross{k}", [(xx, RY0, RZ0), (xx, RY0, RZ1)])
TINE_ROWS = (ZF - 0.29, ZF - 0.13)
NT = 13
for r_, zz in enumerate(TINE_ROWS):
    wire(f"SinkRackWireRow{r_}", [(RX0, RY0, zz), (RX1, RY0, zz)])
    for k in range(NT):
        xx = RX0 + 0.02 + (RX1 - RX0 - 0.04) * k / (NT - 1)
        wire(f"SinkRackWireTine{r_}_{k}", [(xx, RY0, zz), (xx, RY0 + 0.075, zz)])
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
tube("SinkTowelBar", [(TX, H - TT - 0.03, -0.36), (TX, H - TT - 0.03, -0.06)], 0.008, "rod", res=2, sides=8)
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
tube("SinkTapSpout", spout, 0.011, "faucet", res=4, sides=12)
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
# (in it: three bamboo rods along its floor down its middle, the plates standing on them out of the wet)
SLAT_TOP = y0_ + 0.012 + 0.0045
for z_ in (-0.195, -0.16, -0.125):
    tube(f"SinkBasketSlat{z_:+.3f}", [(bx0 + 0.03, y0_ + 0.012, z_), (bx1 - 0.03, y0_ + 0.012, z_)], 0.0045, "rod", res=1, sides=6)
# (the game's plates (GuestBar3D's, 0.197 round in the sink's units) stand on the slats, across its middle, along its slots)
RACK_PLATE_R = 0.197
# (three plates standing in it, edge on, and a bowl upside down beside them)
for k in range(3):
    px = 0.085 + k * 0.06
    py, pz = H + 0.012 + 0.11, (bz0 + bz1) / 2 - 0.02
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.11, depth=0.012, location=P(px, py, pz), rotation=(0, math.pi / 2, 0))
    o = active()
    o.rotation_euler = (0, math.pi / 2 + 0.12, 0)
    finish(o, f"SinkRackPlate{k}", M["plate"])
    parts.append(o)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.106, minor_radius=0.004, major_segments=28, minor_segments=6, location=P(px, py, pz), rotation=(0, math.pi / 2 + 0.12, 0))
    finish(active(), f"SinkRackPlateRim{k}", M["rim"])
    parts.append(active())
    empty(f"SinkRackSlot{k}", px, SLAT_TOP + RACK_PLATE_R, (bz0 + bz1) / 2)
# (the bowl, smaller, upside down at the basket's far end past the thirty plates' row (the owner's: thirty plates at least))
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8, location=P(0.655, SLAT_TOP, (bz0 + bz1) / 2))
bowl = active()
bowl.scale = (0.05, 0.05, 0.04)
apply_scale(bowl)
bm = bmesh.new()
bm.from_mesh(bowl.data)
bmesh.ops.delete(bm, geom=[v_ for v_ in bm.verts if v_.co.z < -0.001], context="VERTS")
# (its foot (the top, turned over) closed in a ladder across its last ring, not a fan of triangles into the sphere's pole: the owner's rule)
_top = max(bm.verts, key=lambda v_: v_.co.z)
bmesh.ops.delete(bm, geom=[_top], context="VERTS")
_ring = [e for e in bm.edges if e.is_boundary and min(v_.co.z for v_ in e.verts) > 0.03]
_vs = list({v_ for e in _ring for v_ in e.verts})
_c = sum((v_.co for v_ in _vs), Vector()) / len(_vs)
_vs.sort(key=lambda v_: math.atan2(v_.co.y - _c.y, v_.co.x - _c.x))
ladder_fill(bm, _vs)
bm.to_mesh(bowl.data)
bm.free()
sol = bowl.modifiers.new("s", "SOLIDIFY")
sol.thickness = 0.004
bpy.context.view_layer.objects.active = bowl
bpy.ops.object.modifier_apply(modifier="s")
finish(bowl, "SinkRackBowl", M["plate"])
parts.append(bowl)
# (by the basin's front right corner: the palm scrubber on its dish, the soap on its)
cyl("SinkDish0", -0.02, H, H + 0.01, 0.2, 0.05, "dish", seg=20, r1=0.055)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=14, ring_count=8, location=P(-0.02, H + 0.035, 0.2))
palm = active()
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
# (beside the cabinet's other end, toward its front: a stainless bin for the used sticks cleared off the customers' plates (the owner's: thrown
# away by the sink), open at its top, a black liner folded over its rim)
BX, BZ, BR, BH = -W / 2 - 0.17, 0.2, 0.12, 0.42
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=BR * 0.92, radius2=BR, depth=BH, location=P(BX, BH / 2, BZ), end_fill_type="NOTHING")
o = active()
cyl_uv(o)
finish(o, "SinkBinBody", M["steel"])
parts.append(o)
bpy.ops.mesh.primitive_circle_add(vertices=24, radius=BR * 0.92, fill_type="NGON", location=P(BX, 0.004, BZ))
o = active()
finish(o, "SinkBinFloor", M["liner"])
parts.append(o)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=BR * 0.9, radius2=BR * 0.97, depth=BH - 0.01, location=P(BX, BH / 2, BZ), end_fill_type="NOTHING")
o = active()
finish(o, "SinkBinLiner", M["liner"])
parts.append(o)
bpy.ops.mesh.primitive_torus_add(major_radius=BR + 0.004, minor_radius=0.008, major_segments=24, minor_segments=6, location=P(BX, BH, BZ))
o = active()
finish(o, "SinkBinRim", M["liner"])
parts.append(o)
empty("SinkBinTop", BX, BH - 0.05, BZ)
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
if PREVIEW:
    at = P(-0.1, H * 0.7, 0)
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
