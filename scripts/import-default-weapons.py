"""Import the 34 finished HD firearm defaults from CS2 Inspects.

python3 scripts/import-default-weapons.py [--refresh]
Requires curl, Pillow and NumPy. Keeps native mesh/animation/UV data unchanged.
Inputs cache in artifacts/default-weapons; pinned inputs fail closed on drift.
"""
import concurrent.futures
import copy
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import threading

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'packages/assets/public/models/viewmodels'
CACHE = ROOT / 'artifacts/default-weapons'
SOURCE = OUT / 'defaults-source.json'
CACHE.mkdir(parents=True, exist_ok=True)
REFRESH = '--refresh' in sys.argv
PINS = json.loads(SOURCE.read_text()).get('inputs', {}) if SOURCE.exists() else {}
RECORDS = {}
LOCK = threading.Lock()
WEAPONS = [('ak-47',7),('m4a1_s',60),('usp-s',61),('awp',9),('glock',4),('deagle',1),('m4a4',16),('nova',35),('mp9',34),('hkp2000',32),('p250',36),('fiveseven',3),('tec9',30),('cz75a',63),('revolver',64),('elite',2),('famas',10),('galilar',13),('aug',8),('sg556',39),('ssg08',40),('scar20',38),('g3sg1',11),('mac10',17),('mp7',33),('mp5sd',23),('ump45',24),('p90',19),('bizon',26),('xm1014',25),('mag7',27),('sawedoff',29),('m249',14),('negev',28)]


def fetch(url, header=None):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.input')
    if REFRESH or not path.exists():
        command = ['curl', '-fLsS', '--retry', '5', '--retry-all-errors', '--max-time', '120', url]
        if header:
            command += ['-H', 'X-Site-Password: ' + header]
        path.write_bytes(subprocess.check_output(command))
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if url in PINS and PINS[url] != digest and not REFRESH:
        raise ValueError(f'Changed input {url}; review before --refresh')
    with LOCK:
        RECORDS[url] = digest
    return data


def image(url):
    raw = fetch(url.replace('/data/', '/data/high2/').replace('.ktx2', '.avif'))
    result = Image.open(io.BytesIO(raw)).convert('RGB')
    result.thumbnail((512,512), Image.Resampling.LANCZOS)
    return result


def pack_image(value):
    out = io.BytesIO()
    value.save(out, 'WEBP', lossless=True, method=4)
    return out.getvalue()


def convert(entry, header):
    name, item = entry
    api = json.loads(fetch(f'https://3dapi.cs2inspects.com/model/{item}', header))
    hd = next(mesh for mesh in api['meshes'] if mesh['body'] == 'hd')
    parts = {part['material'].split('/')[-1].removesuffix('.vmat'): part for mesh in api['meshes'] if mesh['body'] in ('hd','default') for part in mesh['parts']}
    path = OUT / f'{name}-hd.glb'
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+size])
    blob = data[28+size:]
    replacements = {}
    for material in doc['materials']:
        part = parts[material['name']]
        textures = part['textures']
        color = image(textures['g_tColor'])
        packed = image(textures['g_tMetalness']) if 'g_tMetalness' in textures else None
        orm = None
        if packed is not None:
            ao = image(textures['g_tAmbientOcclusion']).resize(packed.size, Image.Resampling.LANCZOS).getchannel('R')
            orm = Image.merge('RGB', (ao, packed.getchannel('R'), packed.getchannel('G')))
        # Constant-metalness shell materials keep the imported scalar/ORM fallback.
        normal = np.asarray(image(textures['g_tNormal']), dtype=np.float32)
        x = (normal[:,:,0]+normal[:,:,1])/255-1.003922
        y = (normal[:,:,0]-normal[:,:,1])/255
        vector = np.stack([x,y,1-np.abs(x)-np.abs(y)],axis=-1)
        vector /= np.maximum(np.linalg.norm(vector,axis=-1,keepdims=True),1e-8)
        normal = Image.fromarray(np.clip((vector*.5+.5)*255,0,255).astype(np.uint8))
        pbr = material['pbrMetallicRoughness']
        for field, value in [(pbr['baseColorTexture'],color),(pbr['metallicRoughnessTexture'],orm),(material['normalTexture'],normal)]:
            if value is None:
                continue
            texture = doc['textures'][field['index']]
            index = texture.get('source', texture.get('extensions',{}).get('EXT_texture_webp',{}).get('source'))
            replacements[doc['images'][index]['bufferView']] = pack_image(value)
        pbr.update(metallicFactor=1,roughnessFactor=1,baseColorFactor=part.get('params',{}).get('g_vColorTint',[1,1,1,1])[:3]+[1])
        material['occlusionTexture'] = copy.deepcopy(pbr['metallicRoughnessTexture'])
    # Compact physical buffer 0; meshopt's virtual fallback buffer stays intact.
    output = bytearray()
    def append(record, replacement=None):
        offset = record.get('byteOffset',0)
        value = replacement if replacement is not None else blob[offset:offset+record['byteLength']]
        output.extend(b'\0'*(-len(output)%4))
        record.update(byteOffset=len(output),byteLength=len(value))
        output.extend(value)
    for i, view in enumerate(doc['bufferViews']):
        if view['buffer'] == 0:
            append(view,replacements.get(i))
        compressed = view.get('extensions',{}).get('EXT_meshopt_compression')
        if compressed:
            assert compressed['buffer'] == 0
            append(compressed)
    output.extend(b'\0'*(-len(output)%4))
    doc['buffers'][0]['byteLength'] = len(output)
    encoded = json.dumps(doc,separators=(',',':')).encode()
    encoded += b' '*(-len(encoded)%4)
    result = struct.pack('<III',0x46546c67,2,28+len(encoded)+len(output))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(output),0x004e4942)+output
    path.write_bytes(result)
    print(f'{name}: finished HD default ({len(result):,} bytes)',flush=True)
    return {'weapon':name,'item':item,'file':path.name,'sha256':hashlib.sha256(result).hexdigest(),'materials':list(parts)}


def main():
    html = fetch('https://3d.cs2inspects.com/').decode()
    url = 'https://3d.cs2inspects.com'+re.search(r'src="([^"]+\.js)"',html)[1]
    bundle = fetch(url).decode()
    # Public viewer request header, not a user/account credential.
    header = re.search(r'\w+=`([^`]+)`,\w+=\{credentials:`include`\};function \w+\(\w+\)\{return \w+===`https://3dapi.cs2inspects.com`\?\{"X-Site-Password"',bundle)[1]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        weapons = list(pool.map(lambda entry: convert(entry,header),WEAPONS))
    SOURCE.write_text(json.dumps({'generator':'scripts/import-default-weapons.py','source':'https://cs2inspects.com/3d-viewer','notes':'Finished HD default color, AO, roughness, metalness and octahedral normals. Native mesh, bind pose, animation and quantized UV transforms retained. 512px lossless WebP, matching the existing runtime texture resolution; Three.js lighting remains an approximation. Legacy substrates remain for compatible paints.','weapons':weapons,'inputs':dict(sorted(RECORDS.items()))},indent=2)+'\n')


if __name__ == '__main__':
    main()
