"""Bundle the supplied Bayonet clips, without modifying original exports.
Usage: python3 scripts/import-knife-animations.py /path/to/clip-directory
"""
import hashlib,json,sys
from pathlib import Path
source=Path(sys.argv[1]);target=Path(__file__).resolve().parents[1]/'packages/assets/public/models/animations/bayonet'
target.mkdir(parents=True,exist_ok=True)
manifest=[]
for name in ['idle1','idle2','draw','light_miss1','light_miss2','heavy_miss1','lookat01','lookat01_draw']:
    p=source/(name+'_bayonet.glb');data=p.read_bytes();(target/(name+'.glb')).write_bytes(data)
    manifest.append({'clip':name,'source':p.name,'sha256':hashlib.sha256(data).hexdigest()})
(target/'source.json').write_text(json.dumps({'source':'User-supplied Bayonet viewmodel GLBs','clips':manifest,'generator':'scripts/import-knife-animations.py'},indent=2)+'\n')
