"""Render a photo-like still of the 2LDK model with Blender Cycles.

Export the GLB from the page first: 效果图 -> 导出给 Blender. It carries the current view as
camera 'RenderCam' and a 'RenderInfo' node (sun direction, light mode, field of view).
Inside claude.ai the export arrives as a .zip holding the .glb; either file works here.

    blender -b --factory-startup -P render_home.py -- home-v1.glb out.png [--samples 256] [--width 1920]
        [--exposure 0.6] [--cam X Y Z --target X Y Z] [--fov 50] [--aspect 1.78]

--cam / --target / --fov / --aspect override the exported view; positions are in the page's
coordinates (metres, x east, y up, z south).
"""
import argparse
import math
import sys

import bpy
from mathutils import Vector

ap = argparse.ArgumentParser(prog='render_home.py')
ap.add_argument('glb')
ap.add_argument('out', nargs='?', default='render.png')
ap.add_argument('--samples', type=int, default=256)
ap.add_argument('--width', type=int, default=1920)
ap.add_argument('--exposure', type=float, default=0.6)
ap.add_argument('--cam', type=float, nargs=3)
ap.add_argument('--target', type=float, nargs=3)
ap.add_argument('--fov', type=float)
ap.add_argument('--aspect', type=float)
opt = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
glb, out, samples, width, exposure = opt.glb, opt.out, opt.samples, opt.width, opt.exposure

if glb.lower().endswith('.zip'):              # the claude.ai page hands the GLB out zipped
    import tempfile
    import zipfile
    with zipfile.ZipFile(glb) as z:
        inner = next(n for n in z.namelist() if n.lower().endswith('.glb'))
        glb = z.extract(inner, tempfile.mkdtemp())

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene

info = bpy.data.objects.get('RenderInfo')
def prop(key, default):
    return info[key] if info is not None and key in info else default

mode = prop('mode', 'day')               # 'day' | 'white' | 'warm'
night = mode != 'day'

# --- lights -----------------------------------------------------------------------------------
# glTF y-up -> Blender z-up: (x, y, z) -> (x, -z, y)
if not night and prop('sunOn', True):
    d = list(prop('sunDir', [0.4, 0.7, 0.6]))
    to_sun = Vector((d[0], -d[2], d[1])).normalized()
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    scene.collection.objects.link(sun)
    sun.data.energy = 4.0 * min(1.0, float(prop('sunIntensity', 2.6)) / 2.6)
    sun.data.angle = math.radians(1.5)          # slightly soft shadow edges
    sun.data.color = (1.0, 0.95, 0.88)
    sun.rotation_euler = to_sun.to_track_quat('Z', 'Y').to_euler()   # a sun lamp shines along its local -Z

for ob in scene.objects:                       # night: the page's room lights come in as point lights
    if ob.type == 'LIGHT' and ob.data.type == 'POINT':
        ob.data.energy = 60.0
        ob.data.shadow_soft_size = 0.15
        ob.data.color = (1.0, 0.8, 0.55) if mode == 'warm' else (0.95, 0.97, 1.0)

world = bpy.data.worlds.new('World')
scene.world = world
if hasattr(world, 'use_nodes') and not world.use_nodes:
    world.use_nodes = True
bg = world.node_tree.nodes['Background']
if night:
    bg.inputs['Color'].default_value = (0.01, 0.012, 0.02, 1)
    bg.inputs['Strength'].default_value = 1.0
else:
    bg.inputs['Color'].default_value = (0.72, 0.8, 0.95, 1)     # overcast-blue sky light through the windows
    bg.inputs['Strength'].default_value = 1.6

# --- camera -----------------------------------------------------------------------------------
cam = bpy.data.objects.get('RenderCam')
if cam is None:
    sys.exit('no RenderCam in the GLB; export it from the page (效果图 -> 导出给 Blender)')
scene.camera = cam
cam.data.sensor_fit = 'VERTICAL'
cam.data.angle_y = math.radians(opt.fov or float(prop('fov', 50)))
cam.data.clip_start = 0.05
if opt.cam and opt.target:
    to_b = lambda p: Vector((p[0], -p[2], p[1]))
    cam.parent = None
    cam.location = to_b(opt.cam)
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (to_b(opt.target) - to_b(opt.cam)).to_track_quat('-Z', 'Y')   # cameras look along local -Z
aspect = opt.aspect or float(prop('aspect', 16 / 9))
scene.render.resolution_x = width
scene.render.resolution_y = round(width / aspect)
scene.render.resolution_percentage = 100

# --- Cycles -------------------------------------------------------------------------------------
scene.render.engine = 'CYCLES'
cyc = scene.cycles
cyc.samples = samples
cyc.use_adaptive_sampling = True
cyc.use_denoising = True
cyc.max_bounces = 8
cyc.transparent_max_bounces = 16
cyc.caustics_reflective = False
cyc.caustics_refractive = False
cyc.device = 'CPU'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
    try:
        prefs.compute_device_type = kind
    except TypeError:
        continue
    prefs.get_devices()
    gpus = [dev for dev in prefs.devices if dev.type == kind]
    if gpus:
        for dev in prefs.devices:
            dev.use = dev.type == kind
        cyc.device = 'GPU'
        break
print(f'render device: {cyc.device} ({prefs.compute_device_type})')

view = scene.view_settings
try:
    view.view_transform = 'AgX'        # Blender 4.x
except TypeError:
    view.view_transform = 'Filmic'
view.exposure = exposure

scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('saved', out)
