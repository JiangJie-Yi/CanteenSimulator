"""Live Blender view that follows the web app.

Usage (once; it keeps following after that):
  blender blender/hotpot.blend --python blender/open_live.py

While it runs, every second it:
  * reads blender/live_state.json (written by the Vite dev server whenever the page changes dish or order)
    and opens that dish's .blend, hides the items that aren't ordered, and matches the web camera;
  * reloads the open .blend when a generator script (hotpot.py, beefnoodle.py, ...) rewrites it.
Every 3D viewport is kept in Rendered (EEVEE) shading, looking through the camera.

Edits made by hand in this Blender are not kept across a reload: the generator scripts are the source of truth.
"""
import json
import math
import os

import bpy
from bpy.app.handlers import persistent
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_PATH = os.path.join(HERE, "live_state.json")
POLL_SECONDS = 1.0
# preview-only helpers in the generated files that the web page doesn't show
HIDE_ALWAYS = {"Ground"}

watch = {"blend_mtime": None, "state_mtime": None, "state": None}


def same_path(a, b):
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def run_op(op, **kwargs):
    """Operators called from a timer need a window in context."""
    win = bpy.context.window_manager.windows[0]
    with bpy.context.temp_override(window=win):
        op(**kwargs)


def three_to_blender(v):
    x, y, z = v
    return Vector((x, -z, y))   # three.js is Y-up, Blender is Z-up


def set_rendered_view():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type != "VIEW_3D":
                continue
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "RENDERED"
                    space.region_3d.view_perspective = "CAMERA"
                    space.overlay.show_overlays = False


def match_camera(position, fov_deg, focus_y):
    scene = bpy.context.scene
    cam = scene.camera
    if cam is None:
        cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
        scene.collection.objects.link(cam)
        scene.camera = cam
    cam.location = three_to_blender(position)
    cam.rotation_euler = (Vector((0, 0, focus_y)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    # three.js fov is vertical
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24
    cam.data.lens = 12 / math.tan(math.radians(fov_deg) / 2)


def set_broth_texture(web_path):
    """Swap the broth surface's base-colour image for the soup base chosen on the page."""
    path = os.path.join(os.path.dirname(HERE), "public", web_path.lstrip("/"))
    broth = bpy.data.objects.get("Broth")
    if not broth or not os.path.exists(path) or not broth.data.materials:
        return
    mat = broth.data.materials[0]
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    links = bsdf.inputs["Base Color"].links if bsdf else []
    if not links or links[0].from_node.type != "TEX_IMAGE":
        return
    node = links[0].from_node
    img = bpy.data.images.load(path, check_existing=True)
    if node.image != img:
        node.image = img


def apply_state(state):
    if not state:
        return
    items = set(state.get("items", []))
    selected = set(state.get("selected", []))
    hide = set(state.get("hide", [])) | HIDE_ALWAYS
    for ob in bpy.data.objects:
        base = ob.name.split(".")[0]
        if base in items:
            hidden = base not in selected
        else:
            hidden = base in hide
        if ob.type == "MESH":
            ob.hide_viewport = ob.hide_render = hidden
    if state.get("broth"):
        set_broth_texture(state["broth"])
    cam = state.get("camera")
    if cam:
        match_camera(cam["position"], cam["fov"], state.get("focusY", 0.4))


def read_state():
    try:
        mtime = os.path.getmtime(STATE_PATH)
    except OSError:
        return False
    if mtime == watch["state_mtime"]:
        return False
    watch["state_mtime"] = mtime
    try:
        with open(STATE_PATH, encoding="utf-8") as f:
            watch["state"] = json.load(f)
    except (OSError, ValueError):
        return False   # caught it mid-write; the next poll will read it
    return True


@persistent
def on_load(_):
    path = bpy.data.filepath
    watch["blend_mtime"] = os.path.getmtime(path) if path and os.path.exists(path) else None
    bpy.app.timers.register(lambda: (set_rendered_view(), apply_state(watch["state"]))[-1], first_interval=0.3)


@persistent
def on_save(_):
    # our own Ctrl+S shouldn't count as "changed on disk"
    path = bpy.data.filepath
    watch["blend_mtime"] = os.path.getmtime(path) if path else None


def poll():
    changed = read_state()
    state = watch["state"]

    # follow the dish the page is showing
    if state and state.get("blend"):
        wanted = os.path.join(HERE, state["blend"])
        if os.path.exists(wanted) and not same_path(bpy.data.filepath or "", wanted):
            print(f"[CanteenSimulator] page switched to {state['dish']}, opening {wanted}")
            run_op(bpy.ops.wm.open_mainfile, filepath=wanted)
            return POLL_SECONDS

    # a generator script rewrote the file we're showing
    path = bpy.data.filepath
    if path and os.path.exists(path):
        mtime = os.path.getmtime(path)
        if watch["blend_mtime"] is not None and mtime != watch["blend_mtime"]:
            print(f"[CanteenSimulator] {os.path.basename(path)} changed on disk, reloading")
            watch["blend_mtime"] = mtime
            run_op(bpy.ops.wm.revert_mainfile)
            return POLL_SECONDS
        watch["blend_mtime"] = mtime

    if changed:
        apply_state(state)
    return POLL_SECONDS


if on_load not in bpy.app.handlers.load_post:
    bpy.app.handlers.load_post.append(on_load)
if on_save not in bpy.app.handlers.save_post:
    bpy.app.handlers.save_post.append(on_save)
read_state()
on_load(None)
bpy.app.timers.register(poll, first_interval=POLL_SECONDS, persistent=True)
