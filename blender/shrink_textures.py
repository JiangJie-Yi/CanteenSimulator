"""Make .glb files lighter to download without touching their geometry: each large PNG texture inside is scaled down to at most 1024 px and
re-encoded as JPEG (only those with no alpha channel; a texture with one is left as it is). Everything else (meshes, nodes, names, animations,
materials) is copied byte for byte; only the image buffers change, and the binary chunk is repacked.

Run:
    blender -b --factory-startup --python blender/shrink_textures.py -- <file.glb> [<file.glb> ...]
"""
import json
import os
import struct
import sys
import tempfile

import bpy

MAX = 1024
MIN_BYTES = 100 * 1024
QUALITY = 85

files = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
scene = bpy.context.scene
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = QUALITY
scene.render.image_settings.color_mode = "RGB"
# (no view transform: the pixels written as they are, not as a render would look)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
tmp = tempfile.mkdtemp()


def png_has_alpha(data):
    # (colour type 4 or 6: grey or RGB with alpha; 3 (palette) may carry a tRNS chunk: treat it as alpha too)
    return data[25] in (3, 4, 6) or b"tRNS" in data[:4096]


def shrink(data, k):
    src = os.path.join(tmp, f"in{k}.png")
    dst = os.path.join(tmp, f"out{k}.jpg")
    open(src, "wb").write(data)
    img = bpy.data.images.load(src)
    w, h = img.size
    if max(w, h) > MAX:
        f = MAX / max(w, h)
        img.scale(max(1, round(w * f)), max(1, round(h * f)))
    img.save_render(dst, scene=scene)
    bpy.data.images.remove(img)
    return open(dst, "rb").read()


for path in files:
    b = open(path, "rb").read()
    jlen = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    bstart = 20 + jlen + 8
    blen = struct.unpack("<I", b[20 + jlen:24 + jlen])[0]
    binc = b[bstart:bstart + blen]
    views = j["bufferViews"]
    datas = [binc[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in views]
    changed = 0
    for k, im in enumerate(j.get("images", [])):
        if "bufferView" not in im:
            continue
        d = datas[im["bufferView"]]
        if d[:8] != b"\x89PNG\r\n\x1a\n" or len(d) < MIN_BYTES or png_has_alpha(d):
            continue
        nd = shrink(d, k)
        if len(nd) < len(d):
            datas[im["bufferView"]] = nd
            im["mimeType"] = "image/jpeg"
            changed += 1
    if not changed:
        print("SHRINK_SKIP", path)
        continue
    # (the binary chunk repacked: every view in turn, each on a 4-byte boundary)
    out = bytearray()
    for v, d in zip(views, datas):
        while len(out) % 4:
            out.append(0)
        v["byteOffset"] = len(out)
        v["byteLength"] = len(d)
        out += d
    while len(out) % 4:
        out.append(0)
    j["buffers"][0]["byteLength"] = len(out)
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
    glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + bytes(out)
    open(path, "wb").write(glb)
    print("SHRINK_DONE", path, len(b) // 1024, "->", len(glb) // 1024, "KB,", changed, "images")
