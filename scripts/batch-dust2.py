"""Batch static Dust II geometry by material without recompressing textures.
Usage: python3 scripts/batch-dust2.py packages/assets/public/models/maps/dust2.glb
Requires numpy. Removes redundant per-tile draw calls and old buffer data.
"""
import pathlib,struct,json,sys,collections,numpy as np
path=pathlib.Path(sys.argv[1]);raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);old=raw[28+size:];blob=bytearray();views=[];accessors=[]
def append(data):
 blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(data);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)});return len(views)-1
def read(index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];kind={5120:'i1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 values=np.ndarray((a['count'],width),dtype=kind,buffer=old,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(kind).itemsize*width),np.dtype(kind).itemsize))
 return np.maximum(values.astype(np.float32)/127,-1) if a.get('normalized') and a['componentType']==5120 else values
def accessor(array,type,normal=False):
 component=5120 if normal else (5123 if array.max()<65536 else 5125) if type=='SCALAR' else 5126
 payload=np.round(np.clip(array,-1,1)*127).astype('i1') if normal else array.astype({5123:'<u2',5125:'<u4',5126:'<f4'}[component])
 if normal:payload=np.pad(payload,((0,0),(0,1)))
 entry={'bufferView':append(payload.tobytes()),'componentType':component,'count':len(array),'type':type}
 if normal:entry['normalized']=True;views[entry['bufferView']]['byteStride']=4
 if type=='VEC3' and not normal:entry.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
 accessors.append(entry);return len(accessors)-1

groups=collections.defaultdict(list)
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:groups[primitive['material']].append(primitive)
meshes=[]
nav=json.loads((path.parent/'dust2-nav.json').read_text())
bounds=nav['bounds'];input_triangles=output_triangles=0
for material,primitives in groups.items():
 arrays={k:[] for k in primitives[0]['attributes']};indices=[];offset=0
 for p in primitives:
  count=len(read(p['attributes']['POSITION']));indices.append(read(p['indices']).astype(np.uint32)+offset);offset+=count
  for key,index in p['attributes'].items():arrays[key].append(read(index))
 values={key:np.concatenate(parts) for key,parts in arrays.items()}
 # Share identical vertices across triangle/material tile boundaries while
 # retaining UV seams and authored hard normals. The conversion freezes each
 # face separately, so this substantially reduces browser memory.
 triangles=np.concatenate(indices).reshape(-1,3)
 input_triangles+=len(triangles)
 positions=values['POSITION'][triangles]
 minimum=positions.min(axis=1);maximum=positions.max(axis=1)
 keep=(maximum[:,0]>=bounds[0]-40)&(minimum[:,0]<=bounds[2]+40)&(maximum[:,2]>=bounds[1]-40)&(minimum[:,2]<=bounds[3]+40)&(maximum[:,1]>=-15)
 if any(term in doc['materials'][material]['name'].lower() for term in ['wrongway','timer']):keep[:]=False
 triangles=triangles[keep];output_triangles+=len(triangles)
 if not len(triangles):continue
 used, original_inverse=np.unique(triangles.ravel(),return_inverse=True)
 keys=list(values);widths=[values[k].shape[1] for k in keys]
 combined=np.concatenate([values[k][used] for k in keys],axis=1)
 unique, inverse=np.unique(combined,axis=0,return_inverse=True)
 remapped=inverse[original_inverse].astype(np.uint32).reshape(-1,1)
 attrs={};column=0
 for key,width in zip(keys,widths):
  attrs[key]=accessor(unique[:,column:column+width], 'VEC2' if width==2 else 'VEC4' if width==4 else 'VEC3',normal=key=='NORMAL');column+=width
 meshes.append({'name':'Dust II · '+doc['materials'][material]['name'],'primitives':[{'attributes':attrs,'indices':accessor(remapped,'SCALAR'),'material':material}]})

for image in doc['images']:
 view=doc['bufferViews'][image['bufferView']];image['bufferView']=append(old[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
doc['extensionsUsed']=list(dict.fromkeys(doc.get('extensionsUsed',[])+['KHR_mesh_quantization']));doc['extensionsRequired']=list(dict.fromkeys(doc.get('extensionsRequired',[])+['KHR_mesh_quantization']))
doc.update(meshes=meshes,nodes=[{'mesh':i,'name':m['name']} for i,m in enumerate(meshes)],scenes=[{'nodes':list(range(len(meshes)))}],scene=0,accessors=accessors,bufferViews=views,buffers=[{'byteLength':len(blob)}]);encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob.extend(b'\0'*(-len(blob)%4));path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(blob))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
print('Triangles',input_triangles,'->',output_triangles)
print('Batched',len(meshes),'materials:',path.stat().st_size,'bytes')
