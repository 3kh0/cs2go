"""Import every CS2 Inspects agent animation pack and index the existing native roster.

python3 scripts/import-agent-animations.py [--refresh]
Requires curl and Pillow. Originals stay in artifacts/agent-inspects; runtime is local.
The checked-in installed native body exports already cover all viewer agent models.
"""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/agent-inspects'
OUT = ROOT / 'packages/assets/public/models/agents/inspects'
REFRESH = '--refresh' in sys.argv
SOURCE = OUT / 'source.json'
previous = json.loads(SOURCE.read_text()) if SOURCE.exists() else {}
pins = previous.get('inputs', {})
inputs = {}
for directory in [CACHE, CACHE / 'models', CACHE / 'packs', OUT / 'animations', OUT / 'thumbs', OUT / 'models']:
    directory.mkdir(parents=True, exist_ok=True)


def fetch(url, path, header=None):
    if REFRESH or not path.exists():
        args = ['curl', '-fLsS', '--retry', '3', '--max-time', '180', url]
        if header: args += ['-H', 'X-Site-Password: ' + header]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(subprocess.check_output(args))
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if url in pins and pins[url]['sha256'] != digest and not REFRESH:
        raise ValueError(f'Changed upstream input: {url}; review --refresh')
    inputs[url] = {'sha256': digest, 'bytes': len(raw)}
    return raw


def main():
    catalog = json.loads(fetch('https://api.cs2inspects.com/items/agents2', CACHE / 'catalog.json'))['items']
    manifest = json.loads(fetch('https://cs2.cs2inspects.com/data/agentanims/manifest.json', CACHE / 'animations.json'))
    (OUT / 'agents-source.json').write_bytes((CACHE / 'catalog.json').read_bytes())
    (OUT / 'animations-source.json').write_bytes((CACHE / 'animations.json').read_bytes())
    html = fetch('https://3d.cs2inspects.com/', CACHE / 'viewer.html').decode()
    bundle_url = 'https://3d.cs2inspects.com' + re.search(r'src="([^"]+\.js)"', html)[1]
    bundle = fetch(bundle_url, CACHE / 'viewer.js').decode()
    header = re.search(r'\w+=`([^`]+)`,\w+=\{credentials:`include`\};function \w+\(\w+\)\{return \w+===`https://3dapi.cs2inspects.com`\?\{"X-Site-Password"', bundle)[1]
    roster_path = ROOT / 'packages/assets/public/models/agents/roster/catalog.json'
    roster = json.loads(roster_path.read_text())
    models = {}
    def import_agent(item):
        ident = item['id']
        api = json.loads(fetch(f'https://3dapi.cs2inspects.com/model/{ident}', CACHE / 'models' / f'{ident}.json', header))
        native = api['mesh_url'].split('/data/', 1)[1].removesuffix('.glb') + '.vmdl_c'
        matches = [entry for entry in roster if entry['nativeModel'] == native]
        assert matches, f'Viewer model absent from native roster: {ident} {native}'
        image = Image.open(io.BytesIO(fetch(item['image'], CACHE / f'{ident}.webp'))).convert('RGBA')
        image.thumbnail((256, 256), Image.Resampling.LANCZOS)
        image.save(OUT / 'thumbs' / f'{ident}.webp', 'WEBP', quality=90, method=6)
        (OUT / 'models' / f'{ident}.json').write_text(json.dumps(api, separators=(',', ':')) + '\n')
        return str(ident), {'name': item['name'], 'team': matches[0]['team'], 'model': matches[0]['model'],
                            'nativeModel': native, 'viewerModel': api['mesh_url'],
                            'image': f'/models/agents/inspects/thumbs/{ident}.webp',
                            'pose': manifest['agent_poses'].get(str(ident)),
                            'firstPerson': [mesh['mesh_group'] for mesh in api['meshes'] if 'firstperson' in mesh['mesh_group']]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for ident, record in pool.map(import_agent, catalog): models[ident] = record
    for entry in roster:
        ident = entry['id'].split('-')[1]
        source = models.get(ident) or next((item for item in models.values() if item['model'] == entry['model']), None)
        if source:
            source_id = ident if ident in models else next(key for key, value in models.items() if value is source)
            entry.update(itemId=int(source_id), image=source['image'], sourcePose=source['pose'])
    roster_path.write_text(json.dumps(roster, indent=2) + '\n')
    packs = {key: value for key, value in manifest['packs'].items() if key != 'pet'}
    reports = {}
    def import_pack(pair):
        key, metadata = pair
        url = 'https://cs2.cs2inspects.com/' + metadata['url']
        raw = fetch(url, CACHE / 'packs' / (key + '.glb'))
        assert raw[:4] == b'glTF'
        size = struct.unpack_from('<I', raw, 12)[0]
        gltf = json.loads(raw[20:20 + size])
        assert not gltf.get('meshes'), f'Animation-only pack unexpectedly contains geometry: {key}'
        actual = {clip['name'] for clip in gltf.get('animations', [])}
        expected = {clip['name'] for clip in metadata['clips']}
        assert expected <= actual, f'Missing clips {key}: {expected - actual}'
        extra = actual - expected
        assert all(name.endswith(manifest['weapon_anim_suffix']) for name in extra), (key, extra)
        output = OUT / 'animations' / (key + '.glb')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(raw)
        return key, {**metadata, 'url': f'/models/agents/inspects/animations/{key}.glb',
                     'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                     'secondaryClips': sorted(extra)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for n, (key, report) in enumerate(pool.map(import_pack, packs.items()), 1):
            reports[key] = report
            if n % 20 == 0 or n == len(packs): print(f'Animation packs {n}/{len(packs)}', flush=True)
    runtime = {**manifest, 'packs': reports}
    (OUT / 'animations.json').write_text(json.dumps(runtime, separators=(',', ':')) + '\n')
    (OUT / 'catalog.json').write_text(json.dumps(models, indent=2) + '\n')
    counts = {}
    for pack in reports.values():
        for clip in pack['clips']: counts[clip['group']] = counts.get(clip['group'], 0) + 1
    SOURCE.write_text(json.dumps({'author': 'Valve; resources served by CS2 Inspects',
        'reference': 'https://cs2inspects.com/3d-viewer', 'generator': 'python3 scripts/import-agent-animations.py',
        'agents': len(models), 'packs': len(reports), 'clips': sum(counts.values()), 'categories': counts,
        'excluded': {'petClips': len(manifest['packs'].get('pet', {}).get('clips', [])), 'reason': 'Pets are not agent animations'},
        'processing': 'All published agent animation GLBs retained byte-identically, including secondary weapon tracks. '
                      'All65 viewer agent native model paths resolve to the existing pinned installed native body roster. '
                      'No duplicate bodies or per-agent animation copies. Full model API descriptions retain first-person part/texture references; runtime thumbnails are local WebP.',
        'limits': 'Source clip samples and static bind metadata, not the full evaluated native graph. Existing body/material/eye approximations retained. '
                  'Runtime converts animation positions to the shared native Source-inch skeleton basis. Default CT uses the native SAS body and first-person arms.',
        'inputs': dict(sorted(inputs.items()))}, indent=2) + '\n')
    print(f'{len(models)} agents, {len(reports)} packs, {sum(counts.values())} clips: {counts}', flush=True)


if __name__ == '__main__': main()
