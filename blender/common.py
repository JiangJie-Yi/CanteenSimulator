"""Shared helpers for the CanteenSimulator dish scripts: procedural textures, materials and mesh utilities.

Import from a dish script run with `blender -b --python blender/<dish>.py`:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from common import *
"""
import math
import random

import bmesh
import bpy
import numpy as np

rng = np.random.default_rng(11)


def seed(n):
    global rng
    random.seed(n)
    rng = np.random.default_rng(n)


# =====================================================================
# Procedural textures (numpy -> packed images, exported into the .glb)
# =====================================================================

def vnoise(size, cx, cy):
    """Tileable value noise with cx x cy cells."""
    g = rng.random((cy, cx)).astype(np.float32)
    ux = np.arange(size) * cx / size
    uy = np.arange(size) * cy / size
    ix0, iy0 = ux.astype(int), uy.astype(int)
    fx, fy = ux - ix0, uy - iy0
    ix1, iy1 = (ix0 + 1) % cx, (iy0 + 1) % cy
    fx = (fx * fx * (3 - 2 * fx))[None, :]
    fy = (fy * fy * (3 - 2 * fy))[:, None]
    a, b = g[np.ix_(iy0, ix0)], g[np.ix_(iy0, ix1)]
    c, d = g[np.ix_(iy1, ix0)], g[np.ix_(iy1, ix1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(size, cx=4, cy=4, octaves=5):
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        mx, my = cx * 2 ** o, cy * 2 ** o
        if mx > size or my > size:
            break
        out += amp * vnoise(size, mx, my)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def mix(c1, c2, m):
    c1 = np.broadcast_to(np.asarray(c1, np.float32), m.shape + (3,)) if np.ndim(c1) == 1 else c1
    c2 = np.broadcast_to(np.asarray(c2, np.float32), m.shape + (3,)) if np.ndim(c2) == 1 else c2
    return c1 * (1 - m[..., None]) + c2 * m[..., None]


def to_normal(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-gx, -gy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def image(name, rgb, data=False, alpha=None):
    """Packed image from an (h, w, 3) array; pass an (h, w) `alpha` for a transparent texture."""
    h, w = rgb.shape[:2]
    a = np.ones((h, w, 1), np.float32) if alpha is None else np.clip(alpha, 0, 1)[..., None]
    rgba = np.concatenate([np.clip(rgb, 0, 1), a], -1).astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    if data:
        img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = "PNG"
    img.pack()
    return img


def grid01(size):
    u = np.tile((np.arange(size) + 0.5) / size, (size, 1))
    return u, u.T.copy()   # u along columns, v along rows (row 0 = bottom)


def oil_broth(size, base_dark, base_light, oil_color, droplets=170):
    """Broth surface with floating oil droplets; returns (color, height)."""
    base = mix(base_dark, base_light, fbm(size, 3, 3))
    oil = np.zeros((size, size), np.float32)
    height = np.zeros((size, size), np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    for _ in range(droplets):
        r = rng.uniform(2.5, 12)
        cx, cy = rng.uniform(0, size, 2)
        x0, x1 = int(max(0, cx - r - 2)), int(min(size, cx + r + 2))
        y0, y1 = int(max(0, cy - r - 2)), int(min(size, cy + r + 2))
        d = np.sqrt((xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2)
        m = np.clip((r - d) / 1.3, 0, 1)
        oil[y0:y1, x0:x1] = np.maximum(oil[y0:y1, x0:x1], m)
        height[y0:y1, x0:x1] = np.maximum(height[y0:y1, x0:x1], np.clip(1 - (d / r) ** 2, 0, 1) * min(1, r / 6))
    return mix(base, oil_color, oil * 0.85), height


# =====================================================================
# Materials
# =====================================================================

def pbr(name, color=(1, 1, 1), tex=None, nrm=None, nrm_strength=1.0, rough=0.5, metal=0.0,
        coat=0.0, coat_rough=0.05, emit=None, emit_strength=0.0, emit_tex=None, blend=False):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    def setin(key, val):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = val

    setin("Base Color", (*color, 1))
    setin("Roughness", rough)
    setin("Metallic", metal)
    setin("Coat Weight", coat)
    setin("Coat Roughness", coat_rough)
    if emit:
        setin("Emission Color", (*emit, 1))
    if emit or emit_tex:
        setin("Emission Strength", emit_strength)
    if emit_tex:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = emit_tex
        nt.links.new(n.outputs["Color"], bsdf.inputs["Emission Color"])
    if tex:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = tex
        nt.links.new(n.outputs["Color"], bsdf.inputs["Base Color"])
        if blend:
            # texture alpha drives transparency (exported as glTF alphaMode BLEND)
            nt.links.new(n.outputs["Alpha"], bsdf.inputs["Alpha"])
            for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
                try:
                    setattr(m, attr, value)
                except (AttributeError, TypeError):
                    pass
    if nrm:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = nrm
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = nrm_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    m.diffuse_color = (*color, 1)
    return m


# =====================================================================
# Mesh helpers
# =====================================================================

def active():
    return bpy.context.view_layer.objects.active


def finish(obj, name, mat, smooth_shade=True):
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = smooth_shade
    return obj


def bevel(obj, width, segments=3, angle=True):
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = width
    b.segments = segments
    if angle:
        b.limit_method = "ANGLE"
    return b


def apply_scale(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def cyl_uv(obj):
    """Cylindrical UVs around local Z (u = angle, v = height)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.verify()
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    for f in bm.faces:
        us = [(math.atan2(l.vert.co.y, l.vert.co.x) / (2 * math.pi)) % 1 for l in f.loops]
        if max(us) - min(us) > 0.5:
            us = [x + 1 if x < 0.5 else x for x in us]
        for l, x in zip(f.loops, us):
            l[uv].uv = (x, (l.vert.co.z - z0) / (z1 - z0 + 1e-6))
    bm.to_mesh(obj.data)
    bm.free()


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    return o


def leaf(x, y, z, rot, length, width, mat, name, cup=0.05, thickness=0.006):
    """Tapered, ruffled leaf on a grid; u runs stem -> tip."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=18, y_subdivisions=10, size=1, location=(x, y, z),
                                    rotation=(0, 0, rot))
    o = active()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for vtx in bm.verts:
        t = vtx.co.x + 0.5
        w = 0.35 + 0.65 * math.sin(math.pi * min(1.0, t * 0.95 + 0.05))
        vtx.co.y *= w
        vtx.co.z = 0.012 * math.sin(t * 14) * math.sin(vtx.co.y * 20) * t - cup * (2 * vtx.co.y) ** 2 + 0.01
        vtx.co.x *= length
        vtx.co.y *= width
    bm.to_mesh(o.data)
    bm.free()
    s = o.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = thickness
    return finish(o, name, mat)


def export_dish(root, parts, glb_path, blend_path, preview=None):
    """Optionally render a preview, export the dish (root + parts) to GLB and save the .blend."""
    scene = bpy.context.scene
    if preview:
        for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
            try:
                scene.render.engine = engine
                break
            except TypeError:
                continue
        try:
            scene.view_settings.view_transform = "AgX"
            for look in ("AgX - Punchy", "Punchy"):
                try:
                    scene.view_settings.look = look
                    break
                except TypeError:
                    continue
        except TypeError:
            pass
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 900
        scene.render.filepath = preview
        bpy.ops.render.render(write_still=True)

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for o in parts:
        o.select_set(True)
    try:
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True,
                                  export_image_format="WEBP", export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
