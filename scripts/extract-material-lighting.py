"""Record native AO strengths omitted by the pinned glTF material exporter.
Inputs are Source2Viewer 20.0 DATA dumps alongside the original .vmat_c files.
Only materials with an active runtime AO map and an explicit native scale are
recorded; absent metadata never changes an imported material.
"""
import argparse,gzip,hashlib,json,pathlib,re,struct
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--materials',default='artifacts/map-geometry/materials')
parser.add_argument('--map',default='packages/assets/public/models/maps/dust2.glb.gz')
parser.add_argument('--output',default='packages/assets/public/models/maps/material-lighting.json')
args=parser.parse_args();folder=pathlib.Path(args.materials)
data=gzip.decompress(pathlib.Path(args.map).read_bytes());size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);materials=[]
for material in doc['materials']:
 if 'occlusionTexture' not in material:continue
 name=material['name'];dump=folder/(name+'.txt');native=folder/(name+'.vmat_c')
 if not dump.exists() or not native.exists():continue
 text=dump.read_text();match=re.search(r'm_name = "g_flAmbientOcclusionScale"\s*m_flValue = ([\d.-]+)',text)
 if not match:continue
 strength=float(match[1]);assert 0<=strength<=1
 if strength==material['occlusionTexture'].get('strength',1):continue
 resource=re.search(r'm_materialName = "([^"]+)"',text)[1]
 materials.append(dict(name=name,resource=resource,sha256=hashlib.sha256(native.read_bytes()).hexdigest(),ambientOcclusionScale=strength))
manifest=dict(exporter='Source2Viewer 20.0',depotManifest='4758919807587010422',parameter='g_flAmbientOcclusionScale',materials=materials)
pathlib.Path(args.output).write_text(json.dumps(manifest,indent=2)+'\n')
print('Recorded',len(materials),'native AO corrections')
