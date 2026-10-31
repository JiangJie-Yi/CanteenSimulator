"""Fewer triangles in a model the game already has, where they can't be seen: a glb is read in, each of its meshes whose node's name (or
its parent's) matches one of the rules is brought down toward the share of its triangles the rule gives (first the flat faces that lie in
one plane merged, which changes nothing that shows, then the rest collapsed by the least-noticeable edges first, the UVs and the parts'
seams kept), and the glb written back. Meshes with shape keys are left as they are (the game moves them).

Run:
    blender -b --factory-startup --python blender/optimize_glb.py -- <model.glb> <out.glb> '<rules JSON: {"name regex": share, ...}>'
e.g. '{"^TillMoneyTree": 0.15, "^TillIngot": 0.12}'
"""
import json
import math
import re
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC, OUT, RULES = argv[0], argv[1], json.loads(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
# (a part this fine or less is left as it is; none is brought below this many)
MIN_PART, FLOOR = 1500, 600


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def rule_for(o):
    names = [o.name]
    if o.parent:
        names.append(o.parent.name)
    for pat, share in RULES.items():
        if any(re.search(pat, n) for n in names):
            return share
    return None


before = after = 0
for o in list(bpy.context.scene.objects):
    if o.type != "MESH":
        continue
    t0 = tris(o)
    before += t0
    share = rule_for(o)
    # (only what's plainly finer than it shows: a part already lean, a pot or a label's band, is left alone, its shape and its picture as they are)
    if share is None or o.data.shape_keys or t0 < MIN_PART:
        after += t0
        continue
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    # (flat faces in one plane merged first: nothing that shows changes)
    m = o.modifiers.new("planar", "DECIMATE")
    m.decimate_type = "DISSOLVE"
    m.angle_limit = math.radians(0.5)
    m.delimit = {"UV", "MATERIAL", "SEAM", "SHARP"}
    bpy.ops.object.modifier_apply(modifier=m.name)
    t1 = tris(o)
    # (then down to the share asked, the least noticeable edges first, its UVs held to)
    want = max(t0 * share, FLOOR)
    if t1 > want:
        m = o.modifiers.new("collapse", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = max(0.02, want / t1)
        m.use_collapse_triangulate = True
        m.delimit = {"UV", "MATERIAL", "SEAM"}
        bpy.ops.object.modifier_apply(modifier=m.name)
    t2 = tris(o)
    after += t2
    print(f"OPT {o.name}: {t0} -> {t2}")

bpy.ops.object.select_all(action="SELECT")
try:
    # (the pictures written again near losslessly: they were compressed once already when the model was made)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True, export_image_format="WEBP",
                              export_image_quality=95, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True)
print(f"OPT_DONE {before} -> {after}")
