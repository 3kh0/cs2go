#!/usr/bin/env python3
"""Losslessly pack the runtime Opus banks; run after any audio import."""
import hashlib
import json
import pathlib
import re
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
source = (ROOT / 'apps/game/src/audio.ts').read_text().split('export class WeaponAudio')[0]
names = set(re.findall(r': "([a-z0-9_-]+)"', source)) | {'zoom'}
names |= {clip['name'] for clip in json.loads((ROOT / 'scripts/cs2-weapon-audio.json').read_text())['clips']}
manifest = json.loads((ROOT / 'packages/assets/public/audio/source/manifest.json').read_text())
paths = sorted([f'/audio/{name}.ogg' for name in names] + [
    f'/audio/source/{clip["name"]}.ogg' for clip in manifest['clips']
    if not clip['name'].startswith('music-')
])
index, payload, offset = [], [], 0
for url in paths:
    data = (ROOT / 'packages/assets/public' / url.lstrip('/')).read_bytes()
    if not data.startswith(b'OggS'):
        raise ValueError(f'Not an Ogg clip: {url}')
    index.append({'url': url, 'offset': offset, 'length': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    payload.append(data)
    offset += len(data)
encoded = json.dumps(index, separators=(',', ':')).encode()
pack = b'AUDP' + struct.pack('<II', 1, len(encoded)) + encoded + b''.join(payload)
(ROOT / 'packages/assets/public/audio/startup.bin').write_bytes(pack)
(ROOT / 'packages/assets/public/audio/startup-source.json').write_text(json.dumps({
    'format': 1, 'generator': 'python3 scripts/pack-audio.py',
    'description': 'Lossless concatenation of existing local Opus clips. Original attribution remains in cs2-weapons-source.json for current firearms, cs2-elite-source.json for supplemental ELITE reload cues, cs2-effects-source.json for other cues, and cs2-ui-source.json for additional UI events. Music streams separately.',
    'bytes': len(pack), 'sha256': hashlib.sha256(pack).hexdigest(), 'clips': index,
}, indent=2) + '\n')
print(f'Packed {len(index)} clips into {len(pack):,} bytes')
