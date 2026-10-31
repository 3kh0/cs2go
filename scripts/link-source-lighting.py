"""Project runtime triangles onto Valve's native lightmap query triangles.
Needs prepare extraction cache; emits per-corner UVs so chart seams can split
welded runtime vertices without expanding every triangle. Unreliable triangles
are explicitly rejected for native light-probe fallback.
"""
import argparse,pathlib,json,re,gzip,hashlib,numpy as np
from scipy.spatial import cKDTree
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',default='packages/assets/public/models/maps/lighting');parser.add_argument('--map',default='packages/assets/public/models/maps/dust2.glb.gz');args=parser.parse_args()
C=pathlib.Path('artifacts/parity-lighting');O=pathlib.Path(args.output)
pins=json.loads((O/'source.json').read_text())
assert hashlib.sha256(pathlib.Path(args.map).read_bytes()).hexdigest()==pins['runtimeGeometrySha256'], 'Runtime geometry changed'
assert hashlib.sha256((C/'extracted/maps/de_dust2/lightmaps/lightmap_query_data.kv3').read_bytes()).hexdigest()==pins['sourceHashes']['maps/de_dust2/lightmaps/lightmap_query_data.kv3'], 'Native query mesh changed'
assert (C/'runtime-geometry.sha256').read_text().strip()==pins['runtimeGeometrySha256'], 'Re-extract runtime vertices'
if True: # Always parse the verified query resource dump; do not trust stale binary caches.
 s=(C/'query.txt').read_text()
 for key in ['vertices','indices']:(C/f'query-{key}.bin').write_bytes(bytes.fromhex(re.search(rf'{key}\s*=\s*#\[(.*?)\]',s,re.S)[1]))
q=np.fromfile(C/'query-vertices.bin',dtype=np.dtype([('p','<f4',(3,)),('uv','<u2',(2,))]));qp=q['p'][:,[0,2,1]].astype('f8')*.0254;qp[:,2]*=-1
qi=np.fromfile(C/'query-indices.bin','<u4').reshape(-1,3);a=qp[qi[:,0]];b=qp[qi[:,1]]-a;c=qp[qi[:,2]]-a
normal=np.cross(b,c);length=np.linalg.norm(normal,axis=1);keep=length>1e-8;a=a[keep];b=b[keep];c=c[keep];qi=qi[keep];normal=normal[keep]/length[keep,None]
d00=(b*b).sum(axis=1);d01=(b*c).sum(axis=1);d11=(c*c).sum(axis=1);den=np.maximum(d00*d11-d01*d01,1e-16);scale=np.sqrt(np.maximum(d00,d11));tree=cKDTree(a+(b+c)/3)
verts=np.fromfile(C/'runtime-vertices.bin','<f4').reshape(-1,6);idx=np.fromfile(C/'runtime-indices.bin','<u4').reshape(-1,3);uv=np.zeros((len(idx),3,2),'<u2');valid=np.zeros(len(idx),'u1');stats=[]
for start in range(0,len(idx),10000):
 ids=idx[start:start+10000];points=verts[ids,:3];center=points.mean(axis=1);nn=verts[ids,3:].mean(axis=1);nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-8)
 _,cand=tree.query(center,k=24,workers=4);vv=center[:,None]-a[cand];dot0=(vv*b[cand]).sum(axis=2);dot1=(vv*c[cand]).sum(axis=2)
 u=(d11[cand]*dot0-d01[cand]*dot1)/den[cand];v=(d00[cand]*dot1-d01[cand]*dot0)/den[cand]
 outside=np.maximum.reduce([-u,-v,u+v-1,np.zeros_like(u)])*scale[cand]
 plane=np.abs((vv*normal[cand]).sum(axis=2));agreement=(nn[:,None]*normal[cand]).sum(axis=2)
 score=plane+outside+.04*(1-agreement);rows=np.arange(len(ids));choose=score.argmin(axis=1);best=cand[rows,choose]
 dv=points-a[best,None];d0=(dv*b[best,None]).sum(axis=2);d1=(dv*c[best,None]).sum(axis=2)
 uu=(d11[best,None]*d0-d01[best,None]*d1)/den[best,None];vvv=(d00[best,None]*d1-d01[best,None]*d0)/den[best,None];ww=1-uu-vvv
 edge=np.maximum.reduce([-uu,-vvv,-ww,np.zeros_like(uu)]).max(axis=1)*scale[best]
 good=(plane[rows,choose]<.02)&(agreement[rows,choose]>.85)&(edge<.03)
 coords=q['uv'][qi[best]].astype('f4');mapped=(coords[:,0,None,:]*ww[:,:,None]+coords[:,1,None,:]*uu[:,:,None]+coords[:,2,None,:]*vvv[:,:,None])*1.14284
 good &= np.all((mapped>=0)&(mapped<=65535),axis=(1,2))
 uv[start:start+len(ids)]=np.clip(np.round(mapped),0,65535).astype('<u2');valid[start:start+len(ids)]=good
 if start%200000==0:print(start,'valid',int(valid.sum()),flush=True)
from native_lightmap import surface_components
labels,weld=surface_components(verts,idx)
counts=np.bincount(labels);accepted=np.bincount(labels,weights=valid);valid[accepted[labels]<counts[labels]]=0
uv[valid==0]=0
O.mkdir(exist_ok=True);(O/'corner-uv.bin.gz').write_bytes(gzip.compress(uv.tobytes(),mtime=0));(O/'triangle-valid.bin.gz').write_bytes(gzip.compress(valid.tobytes(),mtime=0));print('coverage',valid.mean(),flush=True)

# Fade valid charts to the identical probe endpoint at rejected neighbors.
# Shared positions include independently quantized material seams.
confidence=np.full(int(weld.max())+1,255,'u1');confidence[np.unique(weld[idx[valid==0]].ravel())]=0
vertex_confidence=confidence[weld]
(O/'confidence.bin.gz').write_bytes(gzip.compress(vertex_confidence.tobytes(),mtime=0))
effective=(valid!=0)&np.any(vertex_confidence[idx]>0,axis=1)
pins['runtime'].update(lightmapTriangleCoverage=float(valid.mean()),runtimeTriangles=len(idx),lightmapWeldMeters=.012,lightmapNormalDot=.985,lightmapEffectiveTriangleCoverage=float(effective.mean()),lightmapBoundaryBlend='Native atlas fades to the shared probe endpoint at vertices touching rejected charts')
(O/'source.json').write_text(json.dumps(pins,indent=2)+'\n')
(O/'meshes.json').write_bytes((C/'runtime-meshes.json').read_bytes())
