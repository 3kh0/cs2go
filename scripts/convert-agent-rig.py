"""Import the CS:GO IDF port and bake native rifle clips onto its Source 1 rig.

Retargets rotations in armature space and preserves target bone lengths.
Requires Blender 4.5 and SourceIO; runs inside Blender, not system Python.
"""
import bpy,pathlib
from mathutils import Matrix,Vector
# Blender invocation: blender -b --python scripts/convert-agent-rig.py --
#   ground-rebel.gltf /path/to/extracted-idf /path/to/SourceIO output.glb
import sys
native, idf, sourceio, output = map(pathlib.Path, sys.argv[sys.argv.index('--') + 1:])
sys.path.insert(0, str(sourceio.resolve().parent))
from SourceIO.blender_bindings.bindings import register
register()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.sourceio.mdl(directory=str(idf.resolve() / 'models') + '/', files=[{'name': 'csgoidf1pm.mdl'}], import_animations=False, import_textures=True, create_flex_drivers=False, bodygroup_vis_switches=False)
target=next(o for o in bpy.data.objects if o.type=='ARMATURE')
# Remove attachment markers; only the skinned agent is shipped.
for o in list(bpy.data.objects):
 if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
idf_objects=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(native.resolve()))
source=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o not in idf_objects and 'pelvis' in o.data.bones)
if source.animation_data:
 for tr in source.animation_data.nla_tracks:tr.mute=True
mapping={'Pelvis':'pelvis','Spine':'spine_0','Spine1':'spine_1','Spine2':'spine_2','Spine4':'spine_3','Neck1':'neck_0','Head1':'head_0'}
for side in ['L','R']:
 for a,b in [('Thigh','leg_upper'),('Calf','leg_lower'),('Foot','ankle'),('Toe0','ball'),('Clavicle','clavicle'),('UpperArm','arm_upper'),('Forearm','arm_lower'),('Hand','hand')]:mapping[f'{side}_{a}']=f'{b}_{side}'
 for num,finger in [(0,'thumb'),(1,'index'),(2,'middle')]:
  for i in range(3 if num else 2):mapping[f'{side}_Finger{num}'+(str(i) if i else '')]=f'finger_{finger}_{i}_{side}'
mapping={'ValveBiped.Bip01_'+k:v for k,v in mapping.items() if 'ValveBiped.Bip01_'+k in target.data.bones}
rest={b.name:b.matrix_local.copy() for b in target.data.bones}
source_rest={b.name:b.matrix_local.copy() for b in source.data.bones}
ratio=rest['ValveBiped.Bip01_Pelvis'].translation.z/source_rest['pelvis'].translation.z
bpy.context.scene.render.fps=30
clips=[a for a in bpy.data.actions if a.name in ['idle_rifle','walk_n_rifle','walk_s_rifle','walk_e_rifle','walk_w_rifle','run_n_rifle']]
print('CLIPS',[(a.name,a.frame_range[:]) for a in clips])
target.animation_data_create()
for action in clips:
 source.animation_data.action=action
 # Imported glTF actions contain a per-armature slot.
 slot=action.slots[0]
 source.animation_data.action_slot=slot
 baked=bpy.data.actions.new('idf_'+action.name);target.animation_data.action=baked
 for frame in range(int(action.frame_range[1])+2):
  bpy.context.scene.frame_set(frame)
  bpy.context.view_layer.update()
  for tb in target.pose.bones:
   if tb.name not in mapping:continue
   sb=source.pose.bones[mapping[tb.name]]
   rotation=sb.matrix.to_quaternion() @ source_rest[sb.name].to_quaternion().inverted() @ rest[tb.name].to_quaternion()
   mat=rotation.to_matrix().to_4x4()
   mat.translation=tb.matrix.translation
   if sb.name=='pelvis':mat.translation=rest[tb.name].translation+(sb.matrix.translation-source_rest[sb.name].translation)*ratio
   tb.matrix=mat
   bpy.context.view_layer.update()
   tb.rotation_mode='QUATERNION'
   tb.keyframe_insert('rotation_quaternion',frame=frame)
   tb.keyframe_insert('location',frame=frame)
 track=target.animation_data.nla_tracks.new();track.name=action.name
 strip=track.strips.new(action.name,0,baked);track.mute=True
 target.animation_data.action=None
for o in list(bpy.data.objects):
 if o not in idf_objects:bpy.data.objects.remove(o,do_unlink=True)
for tr in target.animation_data.nla_tracks:tr.mute=False
# Standard glTF PBR export; texture resolution bounded for the five-bot budget.
# Build standard PBR nodes directly from the archive's VTF files. SourceIO's
# fallback material cache can retain a missing-texture placeholder from discovery.
from SourceIO.library.source1.vtf import load_texture
from SourceIO.library.utils import FileBuffer
from SourceIO.library.utils.tiny_path import TinyPath
from SourceIO.blender_bindings.utils.texture_utils import create_and_cache_texture
textures = {p.stem.lower(): p for p in (idf / 'materials').rglob('*.vtf')}
for mat in bpy.data.materials:
    if not mat.name.startswith('ctm_idf_'): continue
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = .88
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(shader.outputs['BSDF'], out.inputs['Surface'])
    for normal in [False, True]:
        name = mat.name + ('_normal' if normal else '')
        path = textures[name.lower()]
        with FileBuffer(TinyPath(str(path.resolve()))) as buffer:
            data, height, width = load_texture(buffer)
        image = create_and_cache_texture(TinyPath(name + '_runtime'), data, invert_y=normal)
        if normal: image.colorspace_settings.name = 'Non-Color'
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        if normal:
            mapping = nodes.new('ShaderNodeNormalMap')
            mat.node_tree.links.new(texture.outputs['Color'], mapping.inputs['Color'])
            mat.node_tree.links.new(mapping.outputs['Normal'], shader.inputs['Normal'])
        else:
            mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',export_morph=False,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False)
