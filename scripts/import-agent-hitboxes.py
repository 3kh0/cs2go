#!/usr/bin/env python3
"""Extract checksum-verified Ground Rebel capsule hitboxes with Source2Viewer 20.
Run: python3 scripts/import-agent-hitboxes.py --cli artifacts/source2viewer/Source2Viewer-CLI
Uses the existing ignored agent source cache; downloads only its pinned model if absent.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cli', required=True)
args = parser.parse_args()
manifest = json.loads((ROOT / 'packages/assets/public/models/agents/source-manifest.json').read_text())['groundRebel']
name = manifest['model']
record = manifest['resources'][name]
source = ROOT / 'artifacts/agent-import/native' / name
stem, ext = name.rsplit('.', 1)
url = manifest['mirror'] + stem + '.' + record['version'] + '.' + ext
if not source.exists():
    source.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['curl', '-LfsS', '--retry', '3', url, '-o', str(source)], check=True)
if hashlib.sha256(source.read_bytes()).hexdigest() != record['sha256']:
    raise ValueError('Native agent source checksum mismatch')
text = subprocess.check_output([args.cli, '-i', str(source), '-a'], text=True)
sets = []
for section in text.split('m_HitBoxes =')[1:]:
    boxes = []
    for body in re.findall(r'\{([^{}]+m_nHitBoxIndex = \d+[^{}]*)\}', section.split('m_SourceFilename')[0]):
        def field(name):
            return json.loads(re.search(r'\b' + name + r' = ([^\n]+)', body).group(1).strip())
        if field('m_nShapeType') != 2 or field('m_bTranslationOnly'):
            raise ValueError('Unsupported native shape')
        boxes.append({'bone': field('m_sBoneName'), 'min': field('m_vMinBounds'), 'max': field('m_vMaxBounds'), 'radius': field('m_flShapeRadius'), 'group': field('m_nGroupId')})
    if len(boxes) != 19:
        raise ValueError(f'Expected 19 hitboxes, got {len(boxes)}')
    sets.append(boxes)
if not sets or any(boxes != sets[0] for boxes in sets):
    raise ValueError('Missing or inconsistent native hitbox sets')
output = ROOT / 'apps/game/src/data/agent-hitboxes.json'
output.write_text(json.dumps({'source': url, 'sourceSha256': record['sha256'], 'gameVersion': manifest['gameVersion'], 'agent': 'Ground Rebel', 'units': 'Source inches in native bone-local space', 'hitboxes': sets[0]}, indent=2) + '\n')
print(f'Imported {len(sets[0])} native capsules ({len(sets)} matching embedded sets)')
