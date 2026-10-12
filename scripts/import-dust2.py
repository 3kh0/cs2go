"""Convert the user-provided final CS:GO Dust II depot files to local runtime assets.
Usage: python3 scripts/import-dust2.py --blender /path/to/blender --sourceio /path/to/SourceIO --gltfpack /path/to/gltfpack
The input folder remains untouched. Requires Pillow/numpy, Blender 4.5, and native gltfpack 0.24.
"""
import pathlib,subprocess,hashlib,json,argparse,sys,gzip
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',default='new_map')
parser.add_argument('--blender',required=True)
parser.add_argument('--sourceio',required=True)
parser.add_argument('--gltfpack',required=True,help='native gltfpack 0.24 with BasisU (the npm build cannot encode KTX2)')
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(args.source).resolve()
cache=root/'artifacts/dust-import';cache.mkdir(exist_ok=True,parents=True)
manifest=json.loads((source/'source-manifest.json').read_text())
for name,digest in manifest['files'].items():
 if hashlib.sha256((source/'csgo'/name).read_bytes()).hexdigest()!=digest:
  raise ValueError(f'Dust II source checksum mismatch: {name}')
subprocess.run([args.blender,'-b','-t','2','--python',str(root/'scripts/convert-dust2.py'),'--',str(source/'csgo'),args.sourceio,str(cache/'dust2.glb')],check=True)
if not (cache/'dust2.glb').exists():raise RuntimeError('Blender did not export the map; inspect its error output')
subprocess.run([sys.executable,str(root/'scripts/extract-dust-nav.py'),str(source/'csgo/maps')],check=True)
subprocess.run([sys.executable,str(root/'scripts/pack-agents.py'),str(cache/'dust2.glb'),str(root/'public/models/maps/dust2.glb')],check=True)
subprocess.run([sys.executable,str(root/'scripts/batch-dust2.py'),str(root/'public/models/maps/dust2.glb')],check=True)
# Meshopt-compress geometry and encode textures as KTX2/Basis: a smaller
# download and several times less GPU memory than decoded PNG/WebP.
subprocess.run([args.gltfpack,'-i',str(root/'public/models/maps/dust2.glb'),'-o',str(root/'public/models/maps/dust2.glb'),'-cc','-km','-vp','16','-vt','16','-tc'],check=True)
# Vercel does not compress GLB responses; ship it pre-gzipped (loadGzipped decodes it).
glb=root/'public/models/maps/dust2.glb'
(root/'public/models/maps/dust2.glb.gz').write_bytes(gzip.compress(glb.read_bytes(),9,mtime=0));glb.unlink()
manifest['tools']={'Blender':'4.5.9','gltfpack':'0.24','SourceIOCommit':json.loads((root/'public/models/agents/source-manifest.json').read_text())['tools']['SourceIOCommit']}
manifest['input']='new_map/csgo'
manifest['limitations']=['Original geometry and albedo/normal textures (ETC1S KTX2); standard PBR approximation without Source lightmaps','Detailed static props simplified to 30 percent triangles; native NAV graph retained','Browser triangle collision approximates Source player hull and surface penetration']
(root/'public/models/maps/source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
