"""Bundle HUD/killfeed silhouettes from the established Killfeed Generator reference."""
import concurrent.futures
import hashlib
import json
import re
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://bindgenerator.app/wp-content/themes/bind-generator-app/assets/css/killfeed.css'
css = subprocess.check_output(['curl', '-fLs', '--retry', '3', URL]).decode()
names = 'hkp2000 p250 fiveseven tec9 cz75a revolver elite famas galilar aug sg556 ssg08 scar20 g3sg1 mac10 mp7 mp5sd ump45 p90 bizon xm1014 mag7 sawedoff m249 negev'.split()
aliases = dict(hkp2000='p2000', cz75a='cz', galilar='galil', sg556='sg', ssg08='ssg', mp5sd='mp5', ump45='ump', sawedoff='sawed')
def fetch(name):
    selector = aliases.get(name, name)
    match = re.search(r'\.' + selector + r'\s*\{[^}]*?url\([\"\']?(https?://[^)\"\']+)', css)
    if not match: raise ValueError(name)
    url = match[1].replace('http:', 'https:')
    raw = subprocess.check_output(['curl', '-fLs', '--retry', '3', url])
    (ROOT / 'packages/assets/public/icons' / (name + '.png')).write_bytes(raw)
    return dict(weapon=name, url=url, sha256=hashlib.sha256(raw).hexdigest())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(fetch, names))
manifest = ROOT / 'packages/assets/public/icons/expanded-source.json'
previous = json.loads(manifest.read_text())['icons']
manifest.write_text(json.dumps(dict(source=URL, icons=[r for r in previous if r['weapon'] not in names] + records), indent=2) + '\n')
print('Imported',len(records),'icons')
