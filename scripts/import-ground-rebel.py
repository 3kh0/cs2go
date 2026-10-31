"""Pack the supplied T agent, preserving the existing game's local movement clips.
Usage: python3 scripts/import-ground-rebel.py mesh.glb texture-overrides.json
JSON maps original embedded image names to local texture paths. Requires Pillow,
NumPy and Bun. Original mesh and existing Ground Rebel GLB remain untouched.
"""
import hashlib, importlib.util, json, subprocess, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('assets',Path(__file__).with_name('import-csgoskins.py'))
assets=importlib.util.module_from_spec(spec);spec.loader.exec_module(assets)
source,config=map(Path,sys.argv[1:]);doc,blob=assets.read_glb(source)
inputs=assets.pack_materials(doc,blob,agent=True,overrides=json.loads(config.read_text()))
for node in doc['nodes']:
    name=node.get('name','')
    for side in ['l','r']:
        name=name.replace('_'+side+'_','_'+side.upper()+'_')
        if name.endswith('_'+side):name=name[:-1]+side.upper()
    node['name']=name
# The supplied celebrate clip does not describe locomotion.
doc.pop('animations',None)
staged=assets.ROOT/'artifacts/ground-rebel-textured.glb';staged.parent.mkdir(exist_ok=True)
assets.write_glb(staged,doc,blob)
old=assets.ROOT/'packages/assets/public/models/agents/ground-rebel.glb'
output=assets.ROOT/'packages/assets/public/models/agents/ground-rebel-native.glb'
subprocess.run(['bun',str(Path(__file__).with_name('retarget-agent-motion.mjs')),str(old),str(staged),str(output)],check=True)
output.with_suffix('.source.json').write_text(json.dumps({'generator':'scripts/import-ground-rebel.py','source':'User-supplied CSGOSKINS.GG Ground Rebel mesh (2).glb and textures; Valve assets.','mesh_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'textures':inputs,'motion_source':'ground-rebel.glb; see source-manifest.json','motion_sha256':hashlib.sha256(old.read_bytes()).hexdigest(),'motion':'Six existing idle/run/walk clips baked at 30 Hz to matching world-space bones. Original source rig and skin weights preserved.'},indent=2)+'\n')
