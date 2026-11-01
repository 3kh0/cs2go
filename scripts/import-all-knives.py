"""Bundle the remaining CS2 knives from the established CS2 Inspects source.

Requires Python, Pillow, NumPy, Bun and curl. Runtime stays local/offline.
python3 scripts/import-all-knives.py [--refresh]
Cached inputs are SHA-256 pinned; --refresh explicitly accepts upstream changes.
Existing Bayonet/Butterfly/Karambit assets and saved inventory IDs are untouched.
"""
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/all-knives'
OUT = ROOT / 'packages/assets/public/models/animations/knives'
MANIFEST = OUT / 'expanded-source.json'
REFRESH = '--refresh' in sys.argv
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
pins = {item['url']: item['sha256'] for item in previous.get('inputs', [])}
inputs = {}


def fetch(url, path, headers=()):
    if REFRESH or not path.exists():
        command = ['curl', '-fLsS', '--retry', '3', '--max-time', '120', url, '-o', str(path)]
        for header in headers:
            command += ['-H', header]
        subprocess.run(command, check=True)
    raw = path.read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    if url in pins and pins[url] != checksum and not REFRESH:
        raise ValueError(f'Upstream input changed: {url}; review before --refresh')
    inputs[url] = {'url': url, 'sha256': checksum, 'bytes': len(raw)}
    return raw


def pack(doc, blob):
    doc['buffers'] = [{'byteLength': len(blob)}]
    blob += b'\0' * (-len(blob) % 4)
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(blob))
            + struct.pack('<II', len(header), 0x4e4f534a) + header
            + struct.pack('<II', len(blob), 0x004e4942) + blob)


def silhouette(doc, blob, destination):
    def accessor(index, width):
        entry = doc['accessors'][index]
        view = doc['bufferViews'][entry['bufferView']]
        dtype = np.dtype({5123: '<u2', 5125: '<u4', 5126: '<f4'}[entry['componentType']])
        return np.ndarray((entry['count'], width), dtype=dtype, buffer=blob,
                          offset=view.get('byteOffset', 0) + entry.get('byteOffset', 0),
                          strides=(view.get('byteStride', dtype.itemsize * width), dtype.itemsize)).copy()
    primitives = [p for mesh in doc['meshes'] for p in mesh['primitives']]
    points = np.concatenate([accessor(p['attributes']['POSITION'], 3) for p in primitives])
    axes = np.argsort(np.ptp(points, axis=0))[-2:][::-1]
    lower = points[:, axes].min(axis=0)
    ratio = 240 / max(np.ptp(points[:, axes], axis=0))
    height = max(16, int(np.ptp(points[:, axes[1]]) * ratio) + 16)
    image = Image.new('RGBA', (1024, height * 4))
    draw = ImageDraw.Draw(image)
    for primitive in primitives:
        xy = (accessor(primitive['attributes']['POSITION'], 3)[:, axes] - lower) * ratio + 8
        for face in accessor(primitive['indices'], 1).reshape(-1, 3):
            draw.polygon([tuple(xy[index] * 4) for index in face], fill='white')
    image.resize((256, height), Image.Resampling.LANCZOS).save(destination, optimize=True)


def main():
    # Read the authoritative persistent ID mapping, rather than maintaining a second list.
    definitions = json.loads(subprocess.check_output([
        'bun', '-e', 'import {knifeDefinitions} from "./packages/protocol/src/armory.ts"; '
                    'console.log(JSON.stringify(knifeDefinitions))',
    ], cwd=ROOT))
    # This is the public viewer's own request header, not an account credential.
    html = fetch('https://3d.cs2inspects.com/', CACHE / 'inner-viewer.html').decode()
    bundle_path = re.search(r'src="([^"]+\.js)"', html)[1]
    bundle = fetch('https://3d.cs2inspects.com' + bundle_path, CACHE / 'viewer.js').decode()
    public_header = re.search(r'\w+=`([^`]+)`,\w+=\{credentials:`include`\};function \w+\(\w+\)\{return \w+===`https://3dapi.cs2inspects.com`\?\{"X-Site-Password"', bundle)[1]
    records = []
    for knife in definitions:
        if knife['id'] < 37:
            continue
        name = knife['icon']
        api_url = f'https://3dapi.cs2inspects.com/model/{knife["item"]}'
        api = json.loads(fetch(api_url, CACHE / f'{name}-api.json', ['X-Site-Password: ' + public_header]))
        raw = fetch(api['mesh_url'], CACHE / f'{name}.glb')
        size = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + size])
        blob = bytearray(raw[28 + size:])
        if len(api['meshes']) != 1:
            raise ValueError(f'Review multiple material groups for {name}')
        texture = api['meshes'][0]['textures']

        def image(key):
            url = texture[key].replace('/data/materials/', '/data/high2/materials/').replace('.ktx2', '.avif')
            result = Image.open(io.BytesIO(fetch(url, CACHE / f'{name}-{key}.avif'))).convert('RGB')
            result.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            return result

        color, packed, ao = image('g_tColor'), image('g_tMetalness'), image('g_tAmbientOcclusion')
        ao = ao.resize(packed.size, Image.Resampling.LANCZOS).getchannel('R')
        orm = Image.merge('RGB', (ao, packed.getchannel('R'), packed.getchannel('G')))
        silhouette(doc, blob, ROOT / f'packages/assets/public/icons/{name}.png')
        doc['images'], doc['textures'] = [], []
        images = [color, orm]
        if 'default_normal' not in texture['g_tNormal']:
            normal = np.asarray(image('g_tNormal'), dtype=np.float32)
            nx = (normal[:, :, 0] + normal[:, :, 1]) / 255 - 1.003922
            ny = (normal[:, :, 0] - normal[:, :, 1]) / 255
            vector = np.stack((nx, ny, 1 - np.abs(nx) - np.abs(ny)), axis=2)
            vector /= np.maximum(np.linalg.norm(vector, axis=2, keepdims=True), 1e-8)
            images.append(Image.fromarray(np.clip((vector * .5 + .5) * 255, 0, 255).astype(np.uint8)))
        for value in images:
            encoded = io.BytesIO()
            value.save(encoded, format='WEBP', lossless=True, method=6)
            blob.extend(b'\0' * (-len(blob) % 4))
            view = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(encoded.getvalue())})
            blob.extend(encoded.getvalue())
            index = len(doc['images'])
            doc['images'].append({'bufferView': view, 'mimeType': 'image/webp'})
            doc['textures'].append({'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': index}}})
        doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
        doc['extensionsUsed'] = doc['extensionsRequired'] = ['EXT_texture_webp']
        material = api['meshes'][0]['material'].split('/')[-1].removesuffix('.vmat')
        doc['materials'] = [{'name': material, 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 1},
            'metallicFactor': 1, 'roughnessFactor': 1}, 'occlusionTexture': {'index': 1}}]
        if len(images) > 2:
            doc['materials'][0]['normalTexture'] = {'index': 2}
        for mesh in doc['meshes']:
            for primitive in mesh['primitives']:
                primitive['material'] = 0
        output = pack(doc, blob)
        (OUT / f'{name}.glb').write_bytes(output)
        records.append({**knife, 'mesh': api['mesh_url'], 'material': material,
                        'clips': [a['name'] for a in doc['animations']],
                        'outputSha256': hashlib.sha256(output).hexdigest(), 'bytes': len(output)})
        print(f'{knife["name"]}: {len(doc["animations"])} clips, {len(output)} bytes', flush=True)
    MANIFEST.write_text(json.dumps({
        'source': 'Valve models and animation clips served by CS2 Inspects',
        'reference': 'https://cs2inspects.com/3d-viewer',
        'generator': 'python3 scripts/import-all-knives.py',
        'processing': 'Original meshes, skeletons, inverse binds and animation channels retained. '
                      'Vanilla color and AO/roughness/metalness repacked as lossless WebP at most 1024px. '
                      'Non-neutral octahedral normals decoded to glTF tangent-space XYZ; neutral normal maps omitted. '
                      'Silhouettes projected from original mesh triangles.',
        'limitations': 'Viewer exports are hash-pinned, not asserted to match the current installed game build. '
                      'Native animation-graph variant probabilities and rare draw transitions are not reproduced. '
                      'Playback restores separately audited native clip intervals at base speed 1.0; melee impact/audio phases remain reconstructed. '
                      'Only vanilla finishes are added for the new knives.',
        'knives': records, 'inputs': sorted(inputs.values(), key=lambda item: item['url']),
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
