"""Transfer only geometrically supported, continuous native UV charts."""
import numpy as np
from scipy.spatial import cKDTree

class NativeChart:
 def __init__(self, positions, uv, triangles):
  positions=np.asarray(positions,dtype=np.float64);uv=np.asarray(uv,dtype=np.float64)
  points=positions[triangles];a=points[:,0];b=points[:,1]-a;c=points[:,2]-a
  cross=np.cross(b,c);length=np.linalg.norm(cross,axis=1)
  chart=uv[triangles];du=chart[:,1]-chart[:,0];dv=chart[:,2]-chart[:,0]
  uv_area=np.abs(du[:,0]*dv[:,1]-du[:,1]*dv[:,0])
  keep=(length>1e-9)&np.isfinite(points).all(axis=(1,2))&np.isfinite(chart).all(axis=(1,2))&(uv_area>1e-16)
  self.empty=not np.any(keep)
  if self.empty:return
  self.points=points[keep];self.uv=uv[triangles[keep]];self.a=a[keep];self.b=b[keep];self.c=c[keep]
  self.normal=cross[keep]/length[keep,None]
  self.d00=(self.b*self.b).sum(1);self.d01=(self.b*self.c).sum(1);self.d11=(self.c*self.c).sum(1)
  self.den=(cross[keep]*cross[keep]).sum(1);self.scale=np.sqrt(np.maximum(self.d00,self.d11))
  self.tree=cKDTree(self.points.mean(1))
  # Vertex incidence supplements centroids for narrow/large native triangles.
  unique,inverse=np.unique(np.round(self.points.reshape(-1,3)*1e5).astype('i8'),axis=0,return_inverse=True)
  self.vertex_tree=cKDTree(unique/1e5);inc=[[] for _ in unique]
  for vertex,triangle in zip(inverse,np.repeat(np.arange(len(self.a)),3)):inc[vertex].append(triangle)
  width=max(map(len,inc));self.incident=np.full((len(unique),width),-1,'i4')
  for i,items in enumerate(inc):self.incident[i,:len(items)]=items
 def candidates(self,points):
  _,centroid=self.tree.query(points,k=min(24,len(self.a)));centroid=np.asarray(centroid).reshape(len(points),-1)
  _,vertex=self.vertex_tree.query(points,k=min(4,len(self.incident)));vertex=np.asarray(vertex).reshape(len(points),-1)
  return np.concatenate([centroid,self.incident[vertex].reshape(len(points),-1)],axis=1)
 def evaluate(self,points,ids):
  delta=points[:,None]-self.a[ids];x=(delta*self.b[ids]).sum(2);y=(delta*self.c[ids]).sum(2)
  u=(self.d11[ids]*x-self.d01[ids]*y)/self.den[ids];v=(self.d00[ids]*y-self.d01[ids]*x)/self.den[ids];w=1-u-v
  uv=self.uv[ids];mapped=uv[:,:,0]*w[:,:,None]+uv[:,:,1]*u[:,:,None]+uv[:,:,2]*v[:,:,None]
  outside=np.maximum.reduce([-u,-v,-w,np.zeros_like(u)])*self.scale[ids]
  plane=np.abs((delta*self.normal[ids]).sum(2));return mapped,outside,plane
 def project(self,points,normals,lighting_equivalent=None):
  if self.empty:return np.zeros((len(points),3,2)),np.zeros(len(points),dtype=bool)
  center=points.mean(1);ids=self.candidates(center);mapped,outside,plane=self.evaluate(center,ids)
  agreement=(normals[:,None]*self.normal[ids]).sum(2)
  score=plane+outside+.04*(1-agreement);score[ids<0]=np.inf
  best=ids[np.arange(len(points)),score.argmin(1)]
  repeated=np.repeat(best,3)[:,None];uv,_,_=self.evaluate(points.reshape(-1,3),repeated);uv=uv[:,0].reshape(-1,3,2)
  samples=np.concatenate([points,(points+np.roll(points,-1,axis=1))*.5,center[:,None]],axis=1)
  expected=np.concatenate([uv,(uv+np.roll(uv,-1,axis=1))*.5,uv.mean(1)[:,None]],axis=1)
  flat=samples.reshape(-1,3);candidate=self.candidates(flat);actual,outside,plane=self.evaluate(flat,candidate)
  agreement=(np.repeat(normals,7,axis=0)[:,None]*self.normal[candidate]).sum(2)
  geometric=(candidate>=0)&(outside<.012)&(plane<.01)&(agreement>.98)
  nearest_plane=np.min(np.where(geometric,plane,np.inf),axis=1)
  delta=flat[:,None]-self.a[candidate];dx=(delta*self.b[candidate]).sum(2);dy=(delta*self.c[candidate]).sum(2)
  bu=(self.d11[candidate]*dx-self.d01[candidate]*dy)/self.den[candidate];bv=(self.d00[candidate]*dy-self.d01[candidate]*dx)/self.den[candidate]
  # Adjacent charts may meet at an edge. Ambiguity means overlapping interiors
  # on effectively the same plane, not merely nearby or edge-touching triangles.
  area2=np.sqrt(self.den[candidate])
  height_u=area2/np.sqrt(self.d11[candidate]);height_v=area2/np.sqrt(self.d00[candidate])
  height_w=area2/np.linalg.norm(self.b[candidate]-self.c[candidate],axis=2)
  interior=np.minimum.reduce([bu*height_u,bv*height_v,(1-bu-bv)*height_w])>.001
  same_plane=(self.normal[candidate]*np.repeat(self.normal[best],7,axis=0)[:,None]).sum(2)>.999999
  equally_supported=geometric&interior&same_plane&(plane<=nearest_plane[:,None]+.0001)
  value_compatible=np.max(np.abs(actual-expected.reshape(-1,2)[:,None]),axis=2)<2/8192
  compatible=value_compatible.copy()
  # A matching value at one corner is insufficient: each accepted native triangle
  # must have the same UV derivative across the complete runtime triangle.
  for corner in range(3):
   check=np.repeat(points[:,corner],7,axis=0);projected,_,_=self.evaluate(check,candidate)
   compatible&=np.max(np.abs(projected-np.repeat(uv[:,corner],7,axis=0)[:,None]),axis=2)<2/8192
  conflicts=equally_supported&~value_compatible
  # Coincident native charts may duplicate a bake at different atlas locations.
  # Never infer equivalence from UVs: an optional verified atlas comparison must
  # agree in irradiance AND sun visibility over a 2cm plane neighborhood.
  if lighting_equivalent is not None and np.any(conflicts):
   rows,cols=np.nonzero(conflicts);reference=np.repeat(best,7)[rows];other=candidate[rows,cols]
   tangent=self.b[reference]/np.linalg.norm(self.b[reference],axis=1)[:,None]
   bitangent=np.cross(self.normal[reference],tangent)
   offsets=np.array([(x,y)for x in [-.01,0,.01]for y in [-.01,0,.01]])
   neighborhood=flat[rows,None]+tangent[:,None]*offsets[None,:,0,None]+bitangent[:,None]*offsets[None,:,1,None]
   local=neighborhood.reshape(-1,3)
   first=self.evaluate(local,np.repeat(reference,9)[:,None])[0][:,0].reshape(-1,9,2)
   second=self.evaluate(local,np.repeat(other,9)[:,None])[0][:,0].reshape(-1,9,2)
   equal=lighting_equivalent(first,second)
   conflicts[rows[equal],cols[equal]]=False
  ambiguous=conflicts.any(1)
  self.last_ambiguous=ambiguous.reshape(-1,7).any(1)
  good=(geometric&compatible).any(1).reshape(-1,7).all(1)&~self.last_ambiguous
  good&=np.all((uv>=0)&(uv<=1),axis=(1,2))
  return uv,good


def surface_components(vertices, indices):
 from scipy.sparse import coo_matrix
 from scipy.sparse.csgraph import connected_components
 unique,weld=np.unique(np.round(vertices[:,:3]*1000).astype('i4'),axis=0,return_inverse=True)
 pairs=cKDTree(unique*.001).query_pairs(.012,output_type='ndarray')
 _,near=connected_components(coo_matrix((np.ones(len(pairs)),(pairs[:,0],pairs[:,1])),shape=(len(unique),len(unique))).tocsr(),directed=False)
 weld=near[weld];wi=weld[indices]
 n=vertices[indices,3:].mean(axis=1);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)
 edges=np.sort(np.concatenate([wi[:,[0,1]],wi[:,[1,2]],wi[:,[2,0]]]),axis=1);owner=np.tile(np.arange(len(indices)),3);order=np.lexsort((edges[:,1],edges[:,0]));edges=edges[order];owner=owner[order]
 same=np.all(edges[1:]==edges[:-1],axis=1);a=owner[:-1][same];b=owner[1:][same];keep=(n[a]*n[b]).sum(axis=1)>.985;a=a[keep];b=b[keep]
 _,labels=connected_components(coo_matrix((np.ones(len(a)),(a,b)),shape=(len(indices),len(indices))).tocsr(),directed=False)
 return labels,weld


def repair_boundary_endpoints(vertices, weld, corner_ids, samples, fallback, source_uv):
 """Use agreeing native samples at mapped/copanar shared vertices only."""
 result=fallback.copy();changed=set();order=np.argsort(weld);sorted_weld=weld[order]
 source_weld=weld[corner_ids]
 for group in np.unique(source_weld):
  source=np.flatnonzero(source_weld==group)
  targets=order[np.searchsorted(sorted_weld,group):np.searchsorted(sorted_weld,group,side='right')]
  for target in targets:
   matching=(vertices[corner_ids[source],3:]*vertices[target,3:]).sum(1)>.985
   matching_ids=source[matching]
   values=samples[matching_ids]
   if not len(values):continue
   charts=source_uv[matching_ids]
   if np.max(np.ptp(charts,axis=0))>2/8192:continue
   low=values.min(0);high=values.max(0)
   # Conflicting native chart radiance/shadows do not establish a safe endpoint.
   if np.any(high[:3]-low[:3]>.02+.1*high[:3]) or high[3]-low[3]>.05:continue
   mean=values.mean(0);packed=np.r_[np.sqrt(np.clip(mean[:3]/16,0,1)),np.clip(mean[3],0,1)]
   result[target]=np.round(packed*255).astype('u1');changed.add(int(target))
 return result,len(changed)

class EncodedLighting:
 """Compare what the bundled irradiance/sun atlas can actually represent."""
 def __init__(self,irradiance,shadows):
  self.irradiance=np.asarray(irradiance,dtype=float)/255
  self.shadows=np.asarray(shadows,dtype=float)/255
 def sample(self,image,uv):
  xy=uv*np.array([image.shape[1],image.shape[0]])-.5;base=np.floor(xy).astype(int);fraction=xy-base
  x0=np.clip(base[...,0],0,image.shape[1]-1);x1=np.clip(base[...,0]+1,0,image.shape[1]-1)
  y0=np.clip(base[...,1],0,image.shape[0]-1);y1=np.clip(base[...,1]+1,0,image.shape[0]-1)
  x=fraction[...,0,None];y=fraction[...,1,None]
  return (image[y0,x0]*(1-x)+image[y0,x1]*x)*(1-y)+(image[y1,x0]*(1-x)+image[y1,x1]*x)*y
 def equivalent(self,first,second):
  domain=np.all((first>=0)&(first<=1)&(second>=0)&(second<=1),axis=(1,2))
  for texture in [self.irradiance,self.shadows]:
   domain&=np.max(np.abs(self.sample(texture,first)-self.sample(texture,second)),axis=(1,2))<=1/255+1e-9
  return domain
