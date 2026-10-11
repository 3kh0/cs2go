"""Blender/SourceIO import of the complete Dust II BSP into standard glTF PBR.
Usage: blender -b --python scripts/convert-dust2.py -- source-folder SourceIO output.glb
"""
import bpy,sys,pathlib
source,sourceio,output=map(pathlib.Path,sys.argv[sys.argv.index('--')+1:]);sys.path.insert(0,str(sourceio.resolve().parent))
from SourceIO.blender_bindings.bindings import register
register();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bsp = source/'maps/de_dust2.bsp'
native = bsp.exists()
if not native:bsp = source/'maps/de_dust2_csgoportpk.bsp'
bpy.ops.sourceio.bsp(filepath=str(bsp.resolve()),steam_app_id='730' if native else '4000',scale=0.0254,load_lights=False,load_decals=False,load_info=False,load_logic=False,load_ropes=False,load_triggers=False,import_cubemaps=False)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type=='EMPTY' and o.get('entity_data'):o.select_set(True)
bpy.ops.sourceio.load_placeholder()
# Preserve brush architecture and UV seams; simplify detailed static props for
# browser-scale rendering. Physics and navigation still follow the map surfaces.
for o in list(bpy.data.objects):
 if o.type=='MESH' and len(o.data.polygons)>300 and o.name!='world_geometry' and '_disp_' not in o.name:
  modifier=o.modifiers.new('Browser prop LOD','DECIMATE');modifier.ratio=.3
# Retain the imported albedo/normal images, replacing Source shader node groups
# with standard PBR. Missing/tool surfaces are excluded from rendering below.
for mat in bpy.data.materials:
 mat.use_nodes=True
 images=[n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
 color=next((i for i in images if 'normal' not in i.name.lower() and 'bump' not in i.name.lower()),None)
 normal=next((i for i in images if 'normal' in i.name.lower() or 'bump' in i.name.lower()),None)
 mat.node_tree.nodes.clear();nodes=mat.node_tree.nodes;shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.88
 out=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface'])
 if color:
  tex=nodes.new('ShaderNodeTexImage');tex.image=color;mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
 if normal:
  tex=nodes.new('ShaderNodeTexImage');tex.image=normal;normal.colorspace_settings.name='Non-Color';n=nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(tex.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],shader.inputs['Normal'])
# Freeze static instances/modifiers into world-space meshes. Group by material
# and 16 m tile so distant geometry can be culled without thousands of draw calls.
from collections import defaultdict
from mathutils import Vector
canonical={}
for m in bpy.data.materials:
 images=tuple(n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
 canonical[m.name]=canonical.setdefault(images,m.name) if images else m.name
chunks=defaultdict(lambda:[[],[],[]]);deps=bpy.context.evaluated_depsgraph_get()
for inst in deps.object_instances:
 o=inst.object
 if o.type!='MESH' or not inst.show_self:continue
 mesh=o.to_mesh();mesh.calc_loop_triangles();matrix=inst.matrix_world
 uv=mesh.uv_layers.active
 for tri in mesh.loop_triangles:
  mat=mesh.materials[tri.material_index] if mesh.materials else None
  if not mat or any(t in mat.name.lower() for t in ['tools','skybox/','nodraw','trigger','clip','error','wrongway','timer']):continue
  points=[matrix@mesh.vertices[v].co for v in tri.vertices]
  center=sum(points,Vector())/3
  key=(canonical[mat.name],int(center.x//32),int(center.y//32));verts,faces,uvs=chunks[key];offset=len(verts);verts.extend(points);faces.append((offset,offset+1,offset+2));uvs.extend([uv.data[l].uv[:] if uv else (0,0) for l in tri.loops])
 o.to_mesh_clear()
bpy.data.batch_remove(ids=list(bpy.context.scene.objects))
for (material,x,z),(verts,faces,uvs) in chunks.items():
 mesh=bpy.data.meshes.new(f'dust2_{x}_{z}');mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials[material]);layer=mesh.uv_layers.new()
 for i,value in enumerate(uvs):layer.data[i].uv=value
 o=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(o)
 import bmesh
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(mesh);bm.free()
bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',export_animations=False,export_extras=False)
print('DUST2 CHUNKS',len(chunks))
