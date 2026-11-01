"""Import missing knife paints and full-color default inventory previews.

python3 scripts/import-inventory.py [--refresh]
Requires Bun, curl and Pillow. Existing paints/optimized textures stay intact.
Inputs cache under artifacts; --refresh deliberately updates catalog snapshots.
"""
import concurrent.futures
import gzip
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
CACHE = ROOT / 'artifacts/inventory-import'
OUT = ROOT / 'packages/assets/public/skins'
SOURCE = OUT / 'inventory-source.json'
REFRESH = '--refresh' in sys.argv
CACHE.mkdir(parents=True, exist_ok=True)
for folder in ['defaults', 'paints', 'textures', 'shaders', 'thumbs']:
    (OUT / folder).mkdir(exist_ok=True)
previous = json.loads(SOURCE.read_text()) if SOURCE.exists() else {}
pins = previous.get('sha256', {})
records = {}


def fetch(url, name, body=None, header=None, refresh=False):
    path = CACHE / name
    if refresh or not path.exists():
        args = ['curl', '-fLsS', '--retry', '3', '--max-time', '120', url]
        if header:
            args += ['-H', 'X-Site-Password: ' + header]
        if body is not None:
            args += ['-H', 'Content-Type: application/json', '--data', json.dumps(body)]
        raw = subprocess.check_output(args)
        path.write_bytes(raw)
    raw = path.read_bytes()
    key = url + ('#' + json.dumps(body, sort_keys=True) if body else '')
    digest = hashlib.sha256(raw).hexdigest()
    if key in pins and digest != pins[key] and not REFRESH:
        raise ValueError(f'Changed input: {key}; review before --refresh')
    records[key] = digest
    return raw


def main():
    definitions = json.loads(subprocess.check_output([
        'bun', '-e', 'import {knifeDefinitions} from "./packages/protocol/src/armory.ts"; '
                    'console.log(JSON.stringify(knifeDefinitions))'], cwd=ROOT))
    item_ids = [7, 60, 61, 9, 500, 515, 507, 4, 1, 16, 35, 34,
                32, 36, 3, 30, 63, 64, 2, 10, 13, 8, 39, 40, 38, 11, 17,
                33, 23, 24, 19, 26, 25, 27, 29, 14, 28]
    by_item = {item: index for index, item in enumerate(item_ids)}
    by_item.update({knife['item']: knife['id'] for knife in definitions})
    items = json.loads(fetch('https://api.cs2inspects.com/items/knife2', 'knives.json', refresh=REFRESH))['items']
    assert set(by_item) >= {item['item_id'] for item in items}, 'Unmapped upstream knife'
    listing = [item for item in items if item['skin_id'] != 0]
    assert len({item['id'] for item in listing}) == len(listing), 'Duplicate paint IDs'
    catalog = json.loads((OUT / 'catalog.json').read_text())
    existing = {item['id']: item for item in catalog}
    missing = [item for item in listing if item['id'] not in existing]
    html = fetch('https://3d.cs2inspects.com/', 'viewer.html', refresh=REFRESH).decode()
    bundle_url = 'https://3d.cs2inspects.com' + re.search(r'src="([^"]+\.js)"', html)[1]
    bundle = fetch(bundle_url, 'viewer.js', refresh=REFRESH).decode()
    # Public request header embedded by the existing viewer, not account credentials.
    header = re.search(r'\w+=`([^`]+)`,\w+=\{credentials:`include`\};function \w+\(\w+\)\{return \w+===`https://3dapi.cs2inspects.com`\?\{"X-Site-Password"', bundle)[1]
    def metadata(item):
        raw = fetch('https://3dapi.cs2inspects.com/resolve/raw', item['id'] + '.json',
                    {'item': item['item_id'], 'paint': item['skin_id'], 'seed': 1, 'wear': .1}, header)
        return json.loads(raw)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        resolved = []
        for n, result in enumerate(pool.map(metadata, missing), 1):
            resolved.append(result)
            if n % 40 == 0 or n == len(missing):
                print(f'Paint descriptions {n}/{len(missing)}', flush=True)
    urls = set()
    for paint in resolved:
        for target in paint['targets']:
            urls.update(target['direct_textures'].values())
            for entry in target['passes']:
                urls.update(v for v in entry['textures'].values() if isinstance(v, str) and v.startswith('https:'))
                urls.update([entry['shader']['vs_wgsl_url'], entry['shader']['ps_wgsl_url']])
    def localize(url):
        shader = url.endswith('.wgsl')
        stem = hashlib.sha256(url.encode()).hexdigest()[:16]
        folder = 'shaders' if shader else 'textures'
        for suffix in ['.wgsl'] if shader else ['.rgba.gz', '.ktx2.gz']:
            if (OUT / folder / (stem + suffix)).exists():
                return url, f'/skins/{folder}/{stem}{suffix}'
        source = url if shader else url.replace('/data/', '/data/high2/').replace('.ktx2', '.avif')
        raw = fetch(source, stem + ('.wgsl' if shader else '.avif'))
        suffix = '.wgsl' if shader else '.ktx2.gz' if raw[:4] == b'\xabKTX' else '.rgba.gz'
        if shader:
            output = raw
        elif suffix == '.ktx2.gz':
            output = gzip.compress(raw, mtime=0)
        else:
            image = Image.open(io.BytesIO(raw)).convert('RGBA')
            scale = min(1, 1024 / max(image.size))
            size = tuple(max(1, round(value * scale)) for value in image.size)
            # Paint masks encode data in transparent RGB: resize channels separately.
            image = Image.merge('RGBA', tuple(channel.resize(size, Image.Resampling.LANCZOS) for channel in image.split()))
            output = gzip.compress(struct.pack('<II', *size) + image.tobytes(), mtime=0)
        (OUT / folder / (stem + suffix)).write_bytes(output)
        return url, f'/skins/{folder}/{stem}{suffix}'
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        paths = {}
        for n, (url, path) in enumerate(pool.map(localize, sorted(urls)), 1):
            paths[url] = path
            if n % 40 == 0 or n == len(urls):
                print(f'Textures/shaders {n}/{len(urls)}', flush=True)
    def replace(value):
        if isinstance(value, str): return paths.get(value, value)
        if isinstance(value, list): return [replace(item) for item in value]
        if isinstance(value, dict): return {key: replace(item) for key, item in value.items()}
        return value
    def thumbnail(item):
        raw = fetch(item['image'], item['id'] + '-thumb.webp')
        image = Image.open(io.BytesIO(raw)).convert('RGBA')
        image.thumbnail((256, 192), Image.Resampling.LANCZOS)
        image.save(OUT / 'thumbs' / (item['id'] + '.webp'), 'WEBP', quality=85, method=6)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(thumbnail, missing))
    for item, paint in zip(missing, resolved):
        (OUT / 'paints' / (item['id'] + '.json')).write_text(json.dumps(replace(paint), separators=(',', ':')) + '\n')
        catalog.append({'id': item['id'], 'weapon': by_item[item['item_id']], 'paint': item['skin_id'],
                        'name': item['name'].split(' | ', 1)[-1], 'rarity': item['rarity'],
                        'body': 'hd' if 'body_hd' in paint['mesh_group'] else 'legacy',
                        'image': f'/skins/thumbs/{item["id"]}.webp'})
    for item in listing:
        assert any(entry['id'] == item['id'] and entry['weapon'] == by_item[item['item_id']] for entry in catalog)
    defaults = {by_item[item['item_id']]: item['image'] for item in items if item['skin_id'] == 0}
    stats = json.loads((ROOT / 'packages/simulation/src/data/weapon-stats.json').read_text())['weapons']
    for entry in stats:
        if entry['id'] not in defaults:
            defaults[entry['id']] = f'https://cdn.cs2inspects.com/econ/weapons/base_weapons/weapon_{entry["slug"]}_png.webp'
    defaults[37] = 'https://cdn.cs2inspects.com/econ/weapons/base_weapons/weapon_knife_png.webp'
    defaults[38] = 'https://cdn.cs2inspects.com/econ/weapons/base_weapons/weapon_knife_t_png.webp'
    assert set(defaults) == set(range(56)), 'Missing default weapon previews'
    def default_image(entry):
        index, url = entry
        raw = fetch(url, f'default-{index}.webp')
        image = Image.open(io.BytesIO(raw)).convert('RGBA')
        image.thumbnail((512, 384), Image.Resampling.LANCZOS)
        image.save(OUT / 'defaults' / f'{index}.webp', 'WEBP', quality=90, method=6)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(default_image, defaults.items()))
    (OUT / 'catalog.json').write_text(json.dumps(catalog, indent=2) + '\n')
    original = json.loads((OUT / 'source.json').read_text())
    original.update(catalogEntries=len(catalog), inventorySource='inventory-source.json')
    (OUT / 'source.json').write_text(json.dumps(original, indent=2) + '\n')
    SOURCE.write_text(json.dumps({'source': 'https://cs2inspects.com/3d-viewer',
        'generator': 'python3 scripts/import-inventory.py', 'knifeFinishes': len(listing),
        'catalogEntries': len(catalog), 'defaultPreviews': len(defaults),
        'notes': 'Adds all listed knife paints; team defaults have no paint kits. Existing gun paints are preserved. '
                 'Same local native paint shaders, seeded metadata and 1024px channel-preserving masks as the original import. '
                 'Full-color default economy renders are stored at up to 512x384, with transparency. '
                 'Existing optimized textures are reused by source-URL fingerprint.',
        'sha256': dict(sorted({**pins, **records}.items()))}, indent=2) + '\n')
    print(f'Added {len(missing)} finishes; {len(listing)} knife finishes; {len(catalog)} catalog entries; {len(defaults)} previews', flush=True)


if __name__ == '__main__':
    main()
