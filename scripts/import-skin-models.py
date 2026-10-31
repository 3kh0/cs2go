"""Import matching HD gun meshes for paint kits using the newer UV layout.
Covers all 34 firearms. Run after import-csgoskins.py and import-expanded-weapons.py.
Same source bones preserve existing animation. Real default substrate maps are
bundled at up to 512px; applied paint-kit baking remains 1024px. After import, run
scripts/compress-models.py on the freshly generated *-hd.glb files.
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('assets',Path(__file__).with_name('import-csgoskins.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--weapons', nargs='+', help='Import only named weapons, preserving other manifest entries')
args=parser.parse_args()
expanded=[('glock','glock18'),('deagle','deagle'),('m4a4','m4a4'),('nova','nova'),('mp9','mp9')]
remaining = [(name, name) for name in [
    'hkp2000', 'p250', 'fiveseven', 'tec9', 'cz75a', 'revolver', 'elite',
    'famas', 'galilar', 'aug', 'sg556', 'ssg08', 'scar20', 'g3sg1', 'mac10',
    'mp7', 'mp5sd', 'ump45', 'p90', 'bizon', 'xm1014', 'mag7', 'sawedoff', 'm249', 'negev']]
weapons=[(name,folder) for name,folder,_,_ in a.WEAPONS]+expanded+remaining
manifest=ROOT/'packages/assets/public/models/viewmodels/skins-source.json'
records=json.loads(manifest.read_text())['weapons'] if args.weapons and manifest.exists() else []
for name,folder in weapons:
    if args.weapons and name not in args.weapons:continue
    path='assets/weapons/models/'+folder+'/mesh.glb'
    src=a.download(path);doc,blob=a.read_glb(src);textures=a.pack_materials(doc,blob,texture_size=(512,512));doc.pop('animations',None)
    a.write_glb(ROOT/'packages/assets/public/models/viewmodels'/(name+'-hd.glb'),doc,blob)
    records=[r for r in records if r['weapon']!=name]
    records.append({'weapon':name,'model':a.BASE+path,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'textures':textures})
    print(name,flush=True)
(ROOT/'packages/assets/public/models/viewmodels/skins-source.json').write_text(json.dumps({'source':'Valve HD weapon meshes from the public CSGOSKINS.GG v6 viewer. Matching CS2 Inspects HD paint UV layouts.','generator':'python3 scripts/import-skin-models.py','textureResolution':512,'weapons':records},indent=2)+'\n')
