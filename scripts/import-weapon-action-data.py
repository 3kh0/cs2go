"""Extract server action markers from the same local GLBs used by the viewmodels."""
import hashlib
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'apps/game/src/weapon-motion.ts').read_text()
text = re.search(r'const weapons = (\[[\s\S]*?\]);', source).group(1)
names = json.loads(re.sub(r',\s*]', ']', text))
weapons = []
for name in names:
    clips = {}
    if name:
        for motion in ['draw', 'reload', 'reload_empty', 'shoot1', 'shoot2', 'prepare', 'silencer_attach', 'silencer_detach']:
            path = ROOT / f'packages/assets/public/models/viewmodels/{name}/{motion}.glb'
            if not path.exists():
                continue
            raw = path.read_bytes()
            size = struct.unpack_from('<I', raw, 12)[0]
            data = json.loads(raw[20:20+size])
            animation = data['animations'][0]
            duration = max(data['accessors'][s['input']].get('max', [0])[0] for s in animation['samplers'])
            events = animation.get('extras', {}).get('events', [])
            clips[motion] = {
                'duration': duration,
                'markers': {e['m_ID']: e['m_flStartTime']['m_flValue'] for e in events if 'm_ID' in e},
                'loopDuration': next((e.get('m_flDuration', {}).get('m_flValue', 0) for e in events if e.get('m_ID') == 'WPN_RELOAD_LOOP'), 0),
                'sha256': hashlib.sha256(raw).hexdigest(),
            }
    weapons.append(clips)
output = ROOT / 'packages/simulation/src/data/weapon-actions.json'
output.write_text(json.dumps({'source': 'Imported local viewmodel GLBs; regenerate with scripts/import-weapon-action-data.py', 'weapons': weapons}, indent=2) + '\n')
print(f'Wrote {output.relative_to(ROOT)}')
