"""Resample pinned Valve lightmaps/probe atlases into bounded local runtime assets.
Prerequisites: extracted/decoded files in artifacts/parity-lighting (VRF20),
OpenEXR, numpy, scipy, Pillow; scripts/extract-lighting-vertices.mjs output.
Keeps native atlas UVs/ambient-cube lobes; reduces resolution, not a new bake.
"""
import argparse,pathlib,json,re,gzip,hashlib,math
import numpy as np
import OpenEXR
from scipy.ndimage import map_coordinates
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',default='packages/assets/public/models/maps/lighting');parser.add_argument('--map',default='packages/assets/public/models/maps/dust2.glb.gz');parser.add_argument('--probes-only',action='store_true',help='Reuse unchanged atlas and reflection encodings already in output');args=parser.parse_args()
C=pathlib.Path('artifacts/parity-lighting'); O=pathlib.Path(args.output);O.mkdir(parents=True,exist_ok=True)
def exr(path):return OpenEXR.File(str(path)).channels()['RGBA'].pixels[:,:,:3].astype('f4')
def gz(path,data):path.write_bytes(gzip.compress(data,compresslevel=9,mtime=0))
def hdr(path,rgb):
    peak=np.maximum(rgb.max(axis=2),1e-32);exp=np.floor(np.log2(peak)).astype('i4')+1
    packed=np.zeros((*rgb.shape[:2],4),'u1');packed[:,:,:3]=np.clip(rgb*np.exp2(8-exp[:,:,None]),0,255).astype('u1');packed[:,:,3]=np.where(peak>1e-31,exp+128,0).astype('u1')
    h,w=rgb.shape[:2];gz(path,f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode()+packed.tobytes())
pins=json.loads((O/'source.json').read_text())
for name,expected in pins['sourceHashes'].items():
 path=C/'extracted'/name
 if not path.exists():path=pathlib.Path('artifacts/dust-lighting/extracted')/name
 assert hashlib.sha256(path.read_bytes()).hexdigest()==expected, f'Pinned native input changed: {path}'
assert hashlib.sha256(pathlib.Path(args.map).read_bytes()).hexdigest()==pins['runtimeGeometrySha256'], 'Runtime map changed: revalidate lighting projection'
if not args.probes_only:
 print('Packing native lightmap',flush=True)
 a=exr(C/'irradiance.exr');a=a.reshape(2048,4,2048,4,3).mean(axis=(1,3))
 packed=np.round(np.sqrt(np.clip(a/16,0,1))*255).astype('u1')
 Image.fromarray(packed,'RGB').save(O/'irradiance.webp',lossless=True,method=6)
 s=Image.open(C/'direct_light_shadows.png').convert('RGB').resize((2048,2048),Image.Resampling.BOX);s.save(O/'shadows.webp',lossless=True,method=6)
 del a,packed
assert (C/'runtime-geometry.sha256').read_text().strip()==pins['runtimeGeometrySha256'], 'Extracted geometry does not match runtime map'
print('Reading native probe atlases',flush=True)
atlas=np.stack([exr(C/f'env_light_probe_volume_atlas_z{i:03}.exr')for i in range(720)])
shadow=np.stack([np.asarray(Image.open(C/f'env_light_probe_volume_atlas_dlshd_z{i:03}.png').convert('RGB'))[:,:,0]/255 for i in range(120)]).astype('f4')
text=(C/'entities.txt').read_text();volumes=[]
for b in re.findall(r'values\s*=\s*\{(.*?)\n\s*\}',text,re.S):
 if 'classname = "env_combined_light_probe_volume"' not in b:continue
 d={}
 for k,v in re.findall(r'^\s*(\w+)\s*=\s*(.*?)\s*$',b,re.M):
  if v.startswith('['):d[k.lower()]=[float(x.strip())for x in v.strip('[] ').split(',')]
  else:
   try:d[k.lower()]=float(v.strip('"'))
   except ValueError:d[k.lower()]=v
 assert d['angles']==[0,0,0], 'Rotated volume requires matrix path'
 origin=np.array(d['origin']);low=origin+d['box_mins'];high=origin+d['box_maxs']
 dims=np.clip(np.ceil((high-low)*.0254/1.5).astype(int)+1,2,32)
 volumes.append(dict(min=low.tolist(),max=high.tolist(),origin=origin.tolist(),fade=d.get('edge_fade_dists',[16,16,16]),dimensions=dims.tolist(),index=int(d['array_index']),atlas=[d['light_probe_atlas_'+k]for k in 'xyz'],size=[d['light_probe_size_'+k]for k in 'xyz']))
volumes.sort(key=lambda v:np.prod(np.array(v['max'])-v['min']))
def coords(v,points):
 local=np.clip((points-np.array(v['min']))/(np.array(v['max'])-v['min']),np.array([.5/192,.5/176,.5/120]),1-np.array([.5/192,.5/176,.5/120]))
 return (local*np.array(v['size'])+np.array(v['atlas'])-.5)[:,[2,1,0]].T
chunks=[];schunks=[];offset=soffset=0
for v in volumes:
 nx,ny,nz=v['dimensions'];zz,yy,xx=np.meshgrid(np.linspace(v['min'][2],v['max'][2],nz),np.linspace(v['min'][1],v['max'][1],ny),np.linspace(v['min'][0],v['max'][0],nx),indexing='ij');p=np.stack([xx.ravel(),yy.ravel(),zz.ravel()],axis=1);co=coords(v,p)
 values=np.empty((len(p),6,3),'f4')
 for direction in range(6):
  cc=co.copy();cc[0]+=direction*120
  for channel in range(3):values[:,direction,channel]=map_coordinates(atlas[:,:,:,channel],cc,order=1,mode='nearest',prefilter=False)
 mask=map_coordinates(shadow,co,order=1,mode='nearest',prefilter=False)
 v['offset']=offset;v['shadowOffset']=soffset;offset+=values.size;soffset+=len(mask);chunks.append(values.astype('<f2').tobytes());schunks.append(np.round(mask*255).astype('u1').tobytes())
gz(O/'probes.bin.gz',b''.join(chunks));gz(O/'probe-shadows.bin.gz',b''.join(schunks));(O/'probes.json').write_text(json.dumps(dict(volumes=volumes),indent=2)+'\n')
print('Probe voxels',soffset,'bytes',offset*2,flush=True)
# Native probe fallback for props excluded from Valve lightmap query geometry.
vertices=np.fromfile(C/'runtime-vertices.bin','<f4').reshape(-1,6);p=vertices[:,[0,2,1]].copy()/.0254;p[:,1]*=-1;n=vertices[:,[3,5,4]].copy();n[:,1]*=-1
def sample_probes(p,n):
 fallback=np.zeros((len(p),4),'f4');coverage=np.zeros(len(p),'f4');blended=np.zeros(len(p),'u1')
 for v in volumes:
  ids=np.flatnonzero((coverage<.99)&(blended<4)&np.all(p>=v['min'],axis=1)&np.all(p<=v['max'],axis=1))
  if len(ids):
   edge=np.clip(np.min(np.minimum(p[ids]-v['min'],np.array(v['max'])-p[ids])/np.maximum(v['fade'],.02),axis=1),0,1);volume_weight=edge*edge*(3-2*edge)*(1-coverage[ids]);active=volume_weight>0;ids=ids[active];volume_weight=volume_weight[active];coverage[ids]+=volume_weight;blended[ids]+=1
  if not len(ids):continue
  co=coords(v,p[ids]);color=np.zeros((len(ids),3),'f4')
  for axis in range(3):
   cc=co.copy();cc[0]+=np.where(n[ids,axis]>=0,axis,axis+3)*120
   axis_weight=n[ids,axis]**2
   for channel in range(3):color[:,channel]+=map_coordinates(atlas[:,:,:,channel],cc,order=1,mode='nearest',prefilter=False)*axis_weight
  fallback[ids,:3]+=color*volume_weight[:,None];fallback[ids,3]+=(1-map_coordinates(shadow,co,order=1,mode='nearest',prefilter=False))*volume_weight
 fallback+=(1-coverage[:,None])*np.array([.35,.4,.5,1],'f4')
 return fallback,coverage
fallback,coverage=sample_probes(p,n)
assigned=coverage>0
fallback[:,:3]=np.sqrt(np.clip(fallback[:,:3]/16,0,1))
gz(O/'fallback.bin.gz',np.round(np.clip(fallback,0,1)*255).astype('u1').tobytes());print('Static probe coverage',assigned.mean(),flush=True)
if not args.probes_only:
 print('Encoding local reflection panoramas',flush=True)
 for i in range(43):
  a=exr(C/f'env_cubemap_array_f{i:02}.exr');a=a.reshape(128,4,256,4,3).mean(axis=(1,3));hdr(O/f'reflection-{i}.hdr.gz',a)
sources=[C/'extracted/maps/de_dust2/lightmaps'/n for n in ['irradiance.vtex_c','direct_light_shadows.vtex_c','lightmap_query_data.kv3','env_light_probe_volume_atlas.vtex_c','env_light_probe_volume_atlas_dlshd.vtex_c']]
sources += [C/'extracted/maps/de_dust2/cubemaps/env_cubemap_array.vtex_c']
manifest=dict(author='Valve',depotManifest='4758919807587010422',sourceHashes={str(p.relative_to(C/'extracted')):hashlib.sha256(p.read_bytes()).hexdigest()for p in sources},runtime=dict(lightmapSize=2048,lightmapEncoding='RGB8 sqrt(linear irradiance /16), lossless WebP',probeVoxels=soffset,probeFormat='RGB float16 six native-axis lobes',reflectionSize=[256,128],shadowChannel=0,irradianceScale='Multiply by pi for Three Lambert BRDF'),limitations=['Native lightmap query UVs transferred by triangle projection and accepted only across consistently mapped connected surfaces; chart boundaries blend to shared native probe samples.', 'Atlas spatial filtering, 1.5m probe resampling, and reduced reflection resolution differ from Source2.', 'Probe overlap priority uses smallest volumes with native edge_fade_dists smoothstep feathering and up to four blended volumes; native octree validity is not yet ported.'])
manifest['sourceHashes'].update(pins['sourceHashes']);manifest['runtimeGeometrySha256']=pins['runtimeGeometrySha256'];manifest['runtime'].update(fallbackFormat='RGBA8 sqrt(linear irradiance /16) RGB, sun visibility A',staticProbeCoverage=float(assigned.mean()))
manifest['runtime']={**pins.get('runtime',{}),**manifest['runtime']}
valid=np.frombuffer(gzip.decompress((O/'triangle-valid.bin.gz').read_bytes()),'u1')
manifest['runtime'].update(lightmapTriangleCoverage=float(valid.mean()),runtimeTriangles=len(valid))
(O/'source.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Done',sum(p.stat().st_size for p in O.iterdir()),flush=True)
