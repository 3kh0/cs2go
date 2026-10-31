#!/usr/bin/env python3
"""Extract weapon event gain/distance curves from the pinned decoded CS2 KV3."""
import argparse
import hashlib
import json
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--decoded', type=Path, default=ROOT/'artifacts/cs2-effects/decoded/soundevents/game_sounds_weapons.vsndevts')
p.add_argument('--compiled', type=Path, default=ROOT/'artifacts/cs2-effects/extracted/soundevents/game_sounds_weapons.vsndevts_c')
a = p.parse_args()
provenance = json.loads((ROOT/'packages/assets/public/audio/cs2-effects-source.json').read_text())
digest = hashlib.sha256(a.compiled.read_bytes()).hexdigest()
assert digest == provenance['soundEventsSha256']['soundevents/game_sounds_weapons.vsndevts_c']
text = a.decoded.read_text()
events = dict(re.findall(r'^\t([^\n=]+?) =\s*\n\t\{(.*?)^\t\}', text, re.M|re.S))
clips = {}
for clip in json.loads((ROOT/'scripts/cs2-weapon-audio.json').read_text())['clips']:
    body = events[clip['event']]
    array = re.search(r'distance_volume_mapping_curve =\s*\[(.*?)\n\t\t\]', body, re.S)
    assert array, clip['event']
    rows = [[float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', row)] for row in re.findall(r'\[([^\[\]]+)\]', array[1])]
    assert rows and all(len(row) == 6 for row in rows)
    def scalar(name, fallback):
        m = re.search(r'^\s*'+name+r' = ([\d.-]+)$', body, re.M)
        return float(m[1]) if m else fallback
    clips[clip['name']] = {'event': clip['event'], 'volume': scalar('volume', 1), 'occlusion': scalar('occlusion_intensity', 1), 'curve': rows}
output = ROOT/'apps/game/src/data/sound-ranges.json'
output.write_text(json.dumps({'source': 'Valve CS2 weapon event KV3', 'manifest': provenance['manifest'], 'compiledSha256': digest, 'decodedSha256': hashlib.sha256(a.decoded.read_bytes()).hexdigest(), 'interpolation': 'Browser uses piecewise linear distance/gain knots; native tangents/modes retained as evidence.', 'clips': clips}, indent=2)+'\n')
print(f'{len(clips)} curves -> {output.relative_to(ROOT)}')
