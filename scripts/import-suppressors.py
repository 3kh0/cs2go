"""Import native removable-suppressor clips from the existing pinned v6 viewer.
Original downloaded models remain untouched; runtime clips are bundled locally.
"""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://cdn.csgoskins.gg/packages/assets/public/images/objects/v6/static/'
records = []
for name, folder, suffix in [('m4a1_s', 'm4a1_silencer', 'rifle'), ('usp-s', 'usp_silencer', 'pistol')]:
    for action in ['silencer_attach', 'silencer_detach']:
        resource = f'assets/weapons/anims/{folder}/{action}_{suffix}.glb'
        cached = ROOT / 'artifacts/csgoskins' / resource
        cached.parent.mkdir(parents=True, exist_ok=True)
        if not cached.exists():
            subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '3', BASE + resource, '-o', str(cached)], check=True)
        target = ROOT / 'packages/assets/public/models/viewmodels' / name / (action + '.glb')
        target.write_bytes(cached.read_bytes())
        records.append({'weapon': name, 'action': action, 'url': BASE + resource, 'sha256': hashlib.sha256(cached.read_bytes()).hexdigest()})
(ROOT / 'packages/assets/public/models/viewmodels/suppressor-source.json').write_text(json.dumps({'generator': 'python3 scripts/import-suppressors.py', 'clips': records}, indent=2) + '\n')
