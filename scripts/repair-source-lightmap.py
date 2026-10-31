"""Recover complete simplified surfaces from material-scoped native UV charts.
Run after link-source-lighting.py; staging output is recommended before visual QA.
Requires extract-native-lightmap.mjs from the same pinned Source2Viewer export.
"""
import argparse,pathlib,json,gzip,hashlib,numpy as np
from scipy.spatial import cKDTree
from native_lightmap import NativeChart,surface_components,repair_boundary_endpoints,EncodedLighting
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',default='packages/assets/public/models/maps/lighting');parser.add_argument('--map',default='packages/assets/public/models/maps/dust2.glb.gz');args=parser.parse_args()
C=pathlib.Path('artifacts/parity-lighting');O=pathlib.Path(args.output);pins=json.loads((O/'source.json').read_text())
metadata=json.loads((C/'native-lightmap-layout.json').read_text())
for file,digest in metadata['hashes'].items():assert hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()==digest, f'Native extraction input changed: {file}'
assert metadata['hashes'][args.map]==pins['runtimeGeometrySha256']==(C/'runtime-geometry.sha256').read_text().strip()
for key in ['maps/de_dust2/lightmaps/lightmap_query_data.kv3','maps/de_dust2/world.vwrld_c']:
 source=C/'extracted'/key
 if not source.exists():source=pathlib.Path('artifacts/dust-lighting/extracted')/key
 assert hashlib.sha256(source.read_bytes()).hexdigest()==pins['sourceHashes'][key]
verts=np.fromfile(C/'runtime-vertices.bin','<f4').reshape(-1,6);idx=np.fromfile(C/'runtime-indices.bin','<u4').reshape(-1,3)
nv=np.fromfile(C/'native-lightmap-vertices.bin','<f4').reshape(-1,5);ni=np.fromfile(C/'native-lightmap-indices.bin','<u4').reshape(-1,3);layouts=json.loads((C/'runtime-meshes.json').read_text())
assert len(layouts)==len(metadata['runtimeMaterials'])
uv=np.frombuffer(gzip.decompress((O/'corner-uv.bin.gz').read_bytes()),'<u2').copy().reshape(-1,3,2);valid=np.frombuffer(gzip.decompress((O/'triangle-valid.bin.gz').read_bytes()),'u1').copy();previous=valid.copy()
assert len(valid)==len(idx)
labels,weld=surface_components(verts,idx);points=verts[idx,:3];area=np.linalg.norm(np.cross(points[:,1]-points[:,0],points[:,2]-points[:,0]),axis=1)*.5;surface_area=np.bincount(labels,weights=area);del points
# Small decorative fragments retain the existing fallback. This bounds offline
# work and additional split vertices while repairing substantial wall surfaces.
eligible=(surface_area[labels]>1)&(valid==0)
materials={}
for mesh in metadata['meshes']:materials.setdefault(mesh['material'],[]).append(ni[mesh['indexOffset']//3:(mesh['indexOffset']+mesh['indexCount'])//3])
q=np.fromfile(C/'query-vertices.bin',dtype=np.dtype([('p','<f4',(3,)),('uv','<u2',(2,))]));qp=q['p'][:,[0,2,1]].astype('f8')*.0254;qp[:,2]*=-1;query_tree=cKDTree(qp)
lighting=EncodedLighting(np.asarray(Image.open(O/'irradiance.webp').convert('RGB')),np.asarray(Image.open(O/'shadows.webp').convert('RGB'))[:,:,:1])
material_stats=[]
for material,parts in materials.items():
 runtime=[i for i,name in enumerate(metadata['runtimeMaterials']) if name==material];selected=[]
 for mi in runtime:
  mesh=layouts[mi];ids=np.arange(mesh['indexOffset']//3,(mesh['indexOffset']+mesh['indexCount'])//3);selected.extend(ids[eligible[ids]])
 if not selected:continue
 triangles=np.concatenate(parts);used,inverse=np.unique(triangles,return_inverse=True)
 # Geometry-only export may omit material signatures and thus UV scaling.
 # Verify its raw UVs against the pinned query mesh, instead of assuming every
 # future exporter emits the same channel/scaling convention.
 sample=used[np.linspace(0,len(used)-1,min(128,len(used)),dtype=int)];distance,nearest=query_tree.query(nv[sample,:3],k=16)
 matching=(distance<.002)&(np.max(np.abs(q['uv'][nearest]/65535-nv[sample,None,3:]),axis=2)<2/65535)
 verified=float(matching.any(1).mean())
 if verified<.9:
  # Query geometry omits some primitives. An absent positional reference is not
  # evidence of a different UV channel; verify those native primitives locally.
  verified_parts=[]
  for part in parts:
   part_used=np.unique(part);sample=part_used[np.linspace(0,len(part_used)-1,min(128,len(part_used)),dtype=int)]
   distance,nearest=query_tree.query(nv[sample,:3],k=16);present=(distance<.002).any(1)
   matching=(distance<.002)&(np.max(np.abs(q['uv'][nearest]/65535-nv[sample,None,3:]),axis=2)<2/65535)
   if present.sum()>=min(8,len(sample)) and matching.any(1)[present].mean()>=.9:verified_parts.append(part)
  if not verified_parts:
   print(material,'UV convention rejected',verified,flush=True);continue
  triangles=np.concatenate(verified_parts);used,inverse=np.unique(triangles,return_inverse=True)
  print(material,'locally verified native primitives',len(verified_parts),'of',len(parts),flush=True)
 chart=NativeChart(nv[used,:3],nv[used,3:]*1.14284,inverse.reshape(-1,3));accepted=0
 for start in range(0,len(selected),500):
  ids=np.asarray(selected[start:start+500]);points=verts[idx[ids],:3];normals=verts[idx[ids],3:].mean(1);normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
  mapped,good=chart.project(points,normals,lighting.equivalent);uv[ids[good]]=np.round(mapped[good]*65535).astype('<u2');valid[ids]=good;accepted+=int(good.sum())
 material_stats.append(dict(material=material,candidates=len(selected),accepted=accepted,verifiedUvFraction=verified));print(material,len(selected),accepted,flush=True)
counts=np.bincount(labels);accepted=np.bincount(labels,weights=valid);valid[accepted[labels]<counts[labels]]=0
# This pass can add complete charts but must never remove existing accepted ones.
assert np.all(valid[previous!=0]!=0)
uv[valid==0]=0
confidence=np.full(int(weld.max())+1,255,'u1');confidence[np.unique(weld[idx[valid==0]].ravel())]=0;vertex_confidence=confidence[weld]
# A verified chart can also establish its shared fallback endpoint. Otherwise
# fading to an indoor probe can leave a triangular dark gradient on the facade.
recovered=(valid!=0)&(previous==0)
corner_ids=idx[recovered].ravel();corner_uv=uv[recovered].reshape(-1,2)/65535
boundary=vertex_confidence[corner_ids]==0;corner_ids=corner_ids[boundary];corner_uv=corner_uv[boundary]
def texture_sample(name):
 image=np.asarray(Image.open(O/name).convert('RGB')).astype('f8')/255
 xy=corner_uv*np.array([image.shape[1],image.shape[0]])-.5;base=np.floor(xy).astype(int);fraction=xy-base
 x0=np.clip(base[:,0],0,image.shape[1]-1);x1=np.clip(base[:,0]+1,0,image.shape[1]-1);y0=np.clip(base[:,1],0,image.shape[0]-1);y1=np.clip(base[:,1]+1,0,image.shape[0]-1)
 x=fraction[:,0,None];y=fraction[:,1,None]
 return (image[y0,x0]*(1-x)+image[y0,x1]*x)*(1-y)+(image[y1,x0]*(1-x)+image[y1,x1]*x)*y
samples=np.column_stack([texture_sample('irradiance.webp')**2*16,1-texture_sample('shadows.webp')[:,0]])
fallback=np.frombuffer(gzip.decompress((O/'fallback.bin.gz').read_bytes()),'u1').copy().reshape(-1,4)
fallback,endpoint_count=repair_boundary_endpoints(verts,weld,corner_ids,samples,fallback,corner_uv)
(O/'fallback.bin.gz').write_bytes(gzip.compress(fallback.tobytes(),mtime=0))
for name,data in [('corner-uv.bin.gz',uv.tobytes()),('triangle-valid.bin.gz',valid.tobytes()),('confidence.bin.gz',vertex_confidence.tobytes())]:(O/name).write_bytes(gzip.compress(data,mtime=0))
effective=(valid!=0)&np.any(vertex_confidence[idx]>0,axis=1)
pins['runtime'].update(lightmapTriangleCoverage=float(valid.mean()),lightmapEffectiveTriangleCoverage=float(effective.mean()),nativeChartRecoveredTriangles=int(valid.sum()-previous.sum()),nativeChartMinimumSurfaceArea=1,nativeChartBoundaryEndpoints=endpoint_count,lightmapBoundaryBlend='Native atlas fades to shared fallback endpoints; verified coplanar native chart boundary samples replace probes when their UV, irradiance and shadows agree')
pins['nativeGeometryTransfer']=dict(inputHashes=metadata['hashes'],worldUvScale=[1.14284,1.14284],equivalentBakeAtlasHashes={name:hashlib.sha256((O/name).read_bytes()).hexdigest()for name in ['irradiance.webp','shadows.webp']},equivalentBakeTolerance='At most one RGB8 square-root irradiance or sun encoding step, bilinear samples over a 3x3 grid spanning 2cm',verifiedExportUvConvention='Unscaled UV1, cross-checked against native query vertices per material',samples='Corners, edge midpoints, centroid; matching affine UV derivatives; reject conflicting coplanar overlapping chart interiors unless irradiance and sun agree within one encoding step across a 2cm plane neighborhood; complete welded surface acceptance',materials=material_stats)
(O/'source.json').write_text(json.dumps(pins,indent=2)+'\n');print('recovered',int(valid.sum()-previous.sum()),'coverage',valid.mean(),'effective',effective.mean(),flush=True)
