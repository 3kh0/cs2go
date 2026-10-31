"""Bundle CS2 Inspects default knives and all embedded source animations.
Save public viewer /model/515 and /model/507 responses as
artifacts/{butterfly,karambit}-api.json, then run this script.
Requires Pillow; source downloads are cached and SHA256 recorded.
"""
import hashlib, io, json, struct, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts'
OUT = ROOT / 'packages/assets/public/models/animations/knives'
OUT.mkdir(parents=True, exist_ok=True)
manifest = {'viewer': 'https://cs2inspects.com/3d-viewer', 'generator': 'scripts/import-inspects-knives.py', 'processing': 'Original mesh, skeleton and animation tracks; vanilla color and R roughness/G metalness repacked to glTF. Neutral normal and AO omitted.', 'inputs': []}
def fetch(url, path):
    if not path.exists():
        subprocess.run(['curl', '-fLsS', url, '-o', str(path)], check=True)
    data = path.read_bytes()
    manifest['inputs'].append({'url': url, 'sha256': hashlib.sha256(data).hexdigest()})
    return data
for name in ['butterfly', 'karambit']:
    api = json.loads((CACHE / f'{name}-api.json').read_text())
    raw = fetch(api['mesh_url'], CACHE / f'{name}.glb')
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size]); blob = bytearray(raw[28+size:])
    tex = api['meshes'][0]['textures']
    def read(key):
        url = tex[key].replace('/data/materials/', '/data/high2/materials/').replace('.ktx2', '.avif')
        return Image.open(io.BytesIO(fetch(url, CACHE / f'{name}-{key}.avif'))).convert('RGB')
    color = read('g_tColor'); packed = read('g_tMetalness')
    color.thumbnail((2048,2048)); packed.thumbnail((2048,2048))
    orm = Image.merge('RGB', (Image.new('L',packed.size,255), packed.getchannel('R'), packed.getchannel('G')))
    # Inventory/kill-feed silhouette from the supplied mesh's widest plane.
    import numpy as np
    def accessor(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        width=3 if a['type']=='VEC3' else 1
        return np.frombuffer(blob,dtype=dtype,count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width).copy()
    primitive=doc['meshes'][0]['primitives'][0]
    pts=accessor(primitive['attributes']['POSITION']); axes=np.argsort(np.ptp(pts,axis=0))[-2:][::-1];xy=pts[:,axes].copy()
    xy-=xy.min(axis=0);xy*=240/max(np.ptp(xy,axis=0));xy+=8
    icon=Image.new('RGBA',(256,int(xy[:,1].max())+8));draw=ImageDraw.Draw(icon)
    for face in accessor(primitive['indices']).reshape(-1,3):draw.polygon([tuple(xy[i]) for i in face],fill='white')
    icon.save(ROOT/f'packages/assets/public/icons/{name}.png')
    doc['images']=[]; doc['textures']=[]
    for im in [color,orm]:
        data=io.BytesIO();im.save(data,format='WEBP',lossless=True,method=6)
        blob.extend(b'\0'*(-len(blob)%4)); v=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data.getvalue())});blob.extend(data.getvalue())
        i=len(doc['images']);doc['images'].append({'bufferView':v,'mimeType':'image/webp'})
        doc['textures'].append({'extensions':{'EXT_texture_webp':{'source':i}}})
    doc['extensionsUsed']=['EXT_texture_webp'];doc['extensionsRequired']=['EXT_texture_webp']
    doc['materials']=[{'name':f'{name} vanilla','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':1},'metallicFactor':1,'roughnessFactor':1}}]
    for mesh in doc['meshes']:
        for p in mesh['primitives']: p['material']=0
    doc['buffers']=[{'byteLength':len(blob)}];blob.extend(b'\0'*(-len(blob)%4))
    header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
    (OUT/f'{name}.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob)
(OUT/'source.json').write_text(json.dumps(manifest,indent=2)+'\n')
