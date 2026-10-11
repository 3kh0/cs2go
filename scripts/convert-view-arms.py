"""Extract IDF's original skinned arm surfaces; keep the existing skeleton/UVs.
Blender: --python scripts/convert-view-arms.py -- idf.glb output.glb
"""
import bpy,bmesh,sys,pathlib
source,output=sys.argv[sys.argv.index('--')+1:];bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(source).resolve()))
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 allowed={g.index for g in o.vertex_groups if any(s in g.name for s in ['_UpperArm','_Forearm','_Hand','_Finger','arm_upper_','arm_lower_','hand_','finger_'])}
 keep={v.index for v in o.data.vertices if sum(g.weight for g in v.groups if g.group in allowed)>.5}
 if any(g.weight>.1 and any(term in o.vertex_groups[g.group].name for term in ['spine_', 'clavicle_', 'scapula_']) for v in o.data.vertices for g in v.groups):
  rig=next(m.object for m in o.modifiers if m.type=='ARMATURE')
  upper=[rig.matrix_world@rig.data.bones['arm_upper_'+side].head_local for side in ['L','R']]
  lower=[rig.matrix_world@rig.data.bones['arm_lower_'+side].head_local for side in ['L','R']]
  wrist=[rig.matrix_world@rig.data.bones['hand_'+side].head_local for side in ['L','R']]
  def cuff(v):
   point=o.matrix_world@v.co
   for a,b,c in zip(upper,lower,wrist):
    for start,end,lo,hi in [(a,b,.45,1.1),(b,c,-.1,.25)]:
     axis=end-start;t=(point-start).dot(axis)/axis.length_squared
     if lo<=t<=hi and (point-(start+axis*t)).length<.16:return True
   return False
  keep={v.index for v in o.data.vertices if v.index in keep and cuff(v)}
 bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in keep],context='VERTS');bm.to_mesh(o.data);bm.free()
 if not len(o.data.polygons):bpy.data.objects.remove(o,do_unlink=True)
 else:
  # Source view sleeves include torso/clavicle surfaces. The detached IK arms
  # must not retain weights anchored to the original world-model chest.
  for v in o.data.vertices:
   total=sum(g.weight for g in v.groups if g.group in allowed)
   for g in list(v.groups):
    if g.group in allowed:o.vertex_groups[g.group].add([v.index],g.weight/total,'REPLACE')
    else:o.vertex_groups[g.group].remove([v.index])
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(output).resolve()),export_format='GLB',export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False)
