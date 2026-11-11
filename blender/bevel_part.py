"""Chamfer the edges of part of a finished model, and nothing else (the owner's, 2026-11-11: the shrine lanterns' feet to have their edges cut):
for a model that's been reduced after it was made (blender/optimize_glb.py), its parts merged by material, so it isn't made again and reduced
again for one part's sake. The model's read in; in the meshes whose names match, the edges lying wholly at or under a height (the mesh's own
up, Blender's z) get a one-segment bevel of the width given; it's written out with optimize_glb's settings.

Run:
    blender -b --factory-startup --python blender/bevel_part.py -- <in.glb> <out.glb> <name regex> <width> [under height]
"""
import re
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, PAT, WIDTH = argv[0], argv[1], re.compile(argv[2]), float(argv[3])
UNDER = float(argv[4]) if len(argv) > 4 else 1e9
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
done = []
for o in list(bpy.data.objects):
    if o.type != "MESH" or not PAT.search(o.name):
        continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    # (its faces joined again where they meet (each comes in with its own corners, for its own normal), there only)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z <= UNDER], dist=1e-5)
    # (only its real edges, where two faces meet at an angle: the diagonals across its flat faces (it's in triangles) left be)
    edges = [e for e in bm.edges if all(v.co.z <= UNDER for v in e.verts) and len(e.link_faces) == 2
             and e.link_faces[0].normal.angle(e.link_faces[1].normal) > 0.5]
    before = len(bm.faces)
    if edges:
        bmesh.ops.bevel(bm, geom=edges + list({v for e in edges for v in e.verts}), offset=WIDTH, segments=1, affect="EDGES", profile=0.5)
        # (flat, as it was: its corners welded, its normals would be smoothed across them)
        for f in bm.faces:
            if all(v.co.z <= UNDER + WIDTH for v in f.verts):
                f.smooth = False
    bm.to_mesh(o.data)
    bm.free()
    done.append((o.name, len(edges), before, len(o.data.polygons)))
print("BEVELLED", done)
try:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True, export_image_format="WEBP",
                              export_image_quality=95, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False, export_apply=True)
print("BEVEL_DONE")
