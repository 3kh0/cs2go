"""Import the user-supplied M9 STL. Run Blender -b --python this.py -- source.stl.
Requires Blender 4.5 and Pillow in a separate Python for the icon (see below).
Original input is read-only; exported dimensions/materials are authored.
"""
import bpy, sys, math, json, hashlib
from pathlib import Path
from mathutils import Vector
source = Path(sys.argv[sys.argv.index('--') + 1])
root = Path(__file__).resolve().parents[1]
target = root / 'public/models'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=str(source))
o = bpy.context.object
o.name = 'm9-bayonet'
lo = Vector([min(v.co[k] for v in o.data.vertices) for k in range(3)])
hi = Vector([max(v.co[k] for v in o.data.vertices) for k in range(3)])
scale = .31 / (hi.y - lo.y)
for name, color, metal, rough in [('Blade steel', (.34,.38,.41,1), .9, .3), ('Dark grip', (.035,.042,.03,1), .05, .72), ('Guard steel', (.1,.12,.13,1), .8, .38)]:
 m = bpy.data.materials.new(name); m.use_nodes = True
 shader = m.node_tree.nodes.get('Principled BSDF')
 shader.inputs['Base Color'].default_value = color
 shader.inputs['Metallic'].default_value = metal
 shader.inputs['Roughness'].default_value = rough
 o.data.materials.append(m)
for p in o.data.polygons:
 y = sum(o.data.vertices[i].co.y for i in p.vertices) / len(p.vertices)
 p.material_index = 0 if y > 450 else 1 if y < 422 else 2
 p.use_smooth = True
for v in o.data.vertices:
 x,y,z = v.co
 # glTF maps Blender Z to Three Y and Blender Y to -Three Z.
 v.co = ((z-(lo.z+hi.z)/2)*scale, (y-290)*scale, (x-(lo.x+hi.x)/2)*scale)
modifier = o.modifiers.new('Runtime simplification', 'DECIMATE'); modifier.ratio = .32
bpy.context.view_layer.objects.active = o
bpy.ops.object.modifier_apply(modifier=modifier.name)
# Preserve flat bevel edges while smoothing the cylindrical grip.
o.data.set_sharp_from_angle(angle=math.radians(38))
bpy.ops.export_scene.gltf(filepath=str(target/'m9-bayonet.glb'), export_format='GLB', use_selection=True, export_yup=True)
triangles = sum(len(p.vertices)-2 for p in o.data.polygons)
(target/'m9-bayonet.source.json').write_text(json.dumps({'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'triangles':triangles,'lengthMeters':.31,'materials':'Authored steel blade, steel guard and dark grip; STL has no textures or animation.','generator':'scripts/convert-knife.py'},indent=2)+'\n')
print('M9:',triangles,'triangles')
