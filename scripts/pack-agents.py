"""Pack Source2Viewer glTF or Blender GLB into a self-contained runtime GLB.

Usage: python3 scripts/pack-agents.py input.gltf packages/assets/public/models/agents/ground-rebel.glb
Requires Pillow. Keeps skeleton weights, normals and sampled animation tracks.
"""
import io
import json
import pathlib
import struct
import sys
from PIL import Image

source, output = map(pathlib.Path, sys.argv[1:3])
if source.suffix == '.glb':
    raw = source.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    buffers = [raw[28 + size:]]
else:
    doc = json.loads(source.read_text())
    buffers = [(source.parent / b['uri']).read_bytes() for b in doc['buffers']]
blob = bytearray()
def append(data):
    blob.extend(b'\0' * (-len(blob) % 4))
    start = len(blob)
    blob.extend(data)
    return start

# Flatten buffer views without altering accessor data or skin bind matrices.
old_views = [v.copy() for v in doc['bufferViews']]
image_views = {image['bufferView'] for image in doc.get('images', []) if 'bufferView' in image}
for index, view in enumerate(doc['bufferViews']):
    if index in image_views:
        view.update(buffer=0, byteOffset=0, byteLength=4)
        continue
    data = buffers[view.get('buffer', 0)][view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    view['byteOffset'] = append(data)
    view['buffer'] = 0
for i, entry in enumerate(doc.get('images', [])):
    if 'uri' in entry:
        raw = (source.parent / entry.pop('uri')).read_bytes()
    else:
        v = old_views[entry['bufferView']]
        raw = buffers[v.get('buffer', 0)][v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    image = Image.open(io.BytesIO(raw))
    map_asset = output.parent.name == "maps"
    limit = 1024 if not map_asset or any(term in entry.get("name", "").lower() for term in ["wall", "floor", "ground", "sand", "stone", "blend", "brick", "roof"]) else 512
    image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    data = io.BytesIO()
    # Map textures stay lossless here; gltfpack encodes them once as KTX2.
    image.save(data, format='PNG') if map_asset else image.save(data, format='WEBP', quality=90, method=6)
    payload = data.getvalue()
    if map_asset and i % 50 == 0: print(f'Packed texture {i}/{len(doc["images"])}', flush=True)
    entry['bufferView'] = len(doc['bufferViews'])
    entry['mimeType'] = 'image/png' if map_asset else 'image/webp'
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': append(payload), 'byteLength': len(payload)})
if output.parent.name != 'maps':
    for texture in doc.get('textures', []):
        if 'source' in texture:
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
    doc['extensionsUsed'] = list(dict.fromkeys(doc.get('extensionsUsed', []) + ['EXT_texture_webp']))
    doc['extensionsRequired'] = list(dict.fromkeys(doc.get('extensionsRequired', []) + ['EXT_texture_webp']))
# Drop exporter metadata containing machine paths and unrelated weapon animation nodes.
for nodes in [doc.get('nodes', []), doc.get('materials', []), doc.get('meshes', [])]:
    for n in nodes:
        n.pop('extras', None)
        if 'name' in n:
            n['name'] = n['name'].split('/')[-1]
for material in doc['materials']:
    if output.parent.name == 'maps' and any(term in material.get('name','').lower() for term in ['weed','grass','foliage','bush','tree','chainlink','grate','wire']):
        material['alphaMode'] = 'MASK'
        material['alphaCutoff'] = 0.5
        material['doubleSided'] = True
    pbr = material.setdefault('pbrMetallicRoughness', {})
    if 'metallicRoughnessTexture' not in pbr:
        # Legacy fallback only: authored/native constants, including zero,
        # remain authoritative when no ORM texture is present.
        pbr.setdefault('metallicFactor', 0)
        pbr.setdefault('roughnessFactor', .88)
for animation in doc.get('animations', []):
    animation['name'] = animation['name'].split('/')[-1]
    # Movement is simulated in world space. Native root motion must not double it.
    animation['channels'] = [c for c in animation['channels'] if not (doc['nodes'][c['target']['node']].get('name') == 'root_motion' and c['target']['path'] == 'translation')]
doc['buffers'] = [{'byteLength': len(blob)}]
doc['asset']['generator'] = 'CS2GO agent packer'
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
blob.extend(b'\0' * (-len(blob) % 4))
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(blob)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(blob), b'BIN\0') + blob)
print(f'{output}: {output.stat().st_size:,} bytes')
