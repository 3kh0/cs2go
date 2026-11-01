"""Import every CS2 Inspects glove model/finish with local seeded paint inputs.

python3 scripts/import-gloves.py [--refresh]
Requires Bun, curl, Pillow and NumPy. Originals stay in ignored artifacts/gloves.
"""
import concurrent.futures
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/gloves'
MODELS = ROOT / 'packages/assets/public/models/gloves'
OUT = ROOT / 'packages/assets/public/skins/gloves'
REFRESH = '--refresh' in sys.argv
REPACK = '--repack' in sys.argv
for folder in [CACHE, MODELS, OUT, OUT/'paints', OUT/'thumbs', OUT/'textures', OUT/'shaders']:
    folder.mkdir(parents=True, exist_ok=True)
SOURCE = MODELS/'agents/source.json' if '--agent-arms' in sys.argv else OUT/'source.json'
old = json.loads(SOURCE.read_text()) if SOURCE.exists() else {}
pins = old.get('inputs', {})
records = {}


def fetch(url, name, body=None, header=None):
    path = CACHE / name
    if REFRESH or not path.exists():
        args = ['curl', '-fLsS', '--retry', '3', '--retry-all-errors', '--max-time', '120', url]
        if header: args += ['-H', 'X-Site-Password: ' + header]
        if body is not None: args += ['-H', 'Content-Type: application/json', '--data', json.dumps(body)]
        path.write_bytes(subprocess.check_output(args))
    raw = path.read_bytes()
    key = url + ('#' + json.dumps(body, sort_keys=True) if body else '')
    sha = hashlib.sha256(raw).hexdigest()
    if key in pins and pins[key] != sha and not REFRESH:
        raise ValueError('Changed pinned source: ' + key)
    records[key] = sha
    return raw


def glb_pack(doc, blob):
    doc['buffers'] = [{'byteLength': len(blob)}]
    blob += b'\0' * (-len(blob) % 4)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    return struct.pack('<III', 0x46546c67, 2, 28+len(data)+len(blob)) + struct.pack('<II', len(data), 0x4e4f534a) + data + struct.pack('<II', len(blob), 0x004e4942) + blob


def compact(doc,blob):
    used=set()
    for mesh in doc['meshes']:
        for part in mesh['primitives']:
            used.update(part['attributes'].values())
            if 'indices' in part:used.add(part['indices'])
    used.update(skin['inverseBindMatrices'] for skin in doc['skins'])
    mapping={old:new for new,old in enumerate(sorted(used))}
    doc['accessors']=[doc['accessors'][old] for old in sorted(used)]
    for mesh in doc['meshes']:
        for part in mesh['primitives']:
            part['attributes']={key:mapping[index] for key,index in part['attributes'].items()}
            if 'indices' in part:part['indices']=mapping[part['indices']]
    for skin in doc['skins']:skin['inverseBindMatrices']=mapping[skin['inverseBindMatrices']]
    views={accessor['bufferView'] for accessor in doc['accessors']}
    views.update(image['bufferView'] for image in doc['images'])
    mapping={old:new for new,old in enumerate(sorted(views))};result=bytearray();output=[]
    for old in sorted(views):
        view=doc['bufferViews'][old];start=view.get('byteOffset',0)
        result.extend(b'\0'*(-len(result)%4));output.append({**view,'byteOffset':len(result)})
        result.extend(blob[start:start+view['byteLength']])
    for entry in [*doc['accessors'],*doc['images']]:entry['bufferView']=mapping[entry['bufferView']]
    doc['bufferViews']=output
    return result


def import_agent_arms():
    directory=MODELS/'agents';directory.mkdir(exist_ok=True)
    catalog=json.loads((ROOT/'packages/assets/public/models/agents/inspects/catalog.json').read_text())
    rows={}
    for item in sorted(catalog,key=int):
        path=ROOT/f'packages/assets/public/models/agents/inspects/models/{item}.json'
        if not path.exists():path=ROOT/f'artifacts/agent-inspects/models/{item}.json'
        api=json.loads(path.read_text());target=directory/f'{item}.glb'
        fetch(api['mesh_url'],f'agent-{item}.glb')
        if target.exists() and not REFRESH and not REPACK:
            data=target.read_bytes();rows[item]={'file':'/'+str(target.relative_to(ROOT/'packages/assets/public')),'nativeMesh':api['mesh_url'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
            continue
        rows[item]=pack_model(api,item,target,'agent',True)
        print(f'Agent arms {item}: {rows[item]["bytes"]} bytes',flush=True)
    (directory/'source.json').write_text(json.dumps({'source':'https://cs2inspects.com/3d-viewer','generator':'python3 scripts/import-gloves.py --agent-arms','agents':rows,'processing':'Native firstperson_default and firstperson_hide_default_gloves meshgroups with skinbindings and original textures. Body/animation bufferpayloads omitted; animation library is imported separately. TexturePBR pack at1024px. Runtime rebinds source-inch geometry to existing viewmodel arm/finger poses.','inputs':dict(sorted({**pins,**records}.items()))},indent=2)+'\n')
    print(f'Imported {len(rows)} agent firstperson arm variants',flush=True)

def pack_model(api,item,target,cache_prefix='model',firstperson=False):
    raw = fetch(api['mesh_url'],f'{cache_prefix}-{item}.glb'); size = struct.unpack_from('<I',raw,12)[0]
    doc = json.loads(raw[20:20+size]); blob = bytearray(raw[28+size:])
    if firstperson:
        groups=doc['scenes'][0]['extras']['mesh_groups']
        default=[name for name,states in groups.items() if 'firstperson_default' in states]
        hidden=[name for name,states in groups.items() if 'firstperson_hide_default_gloves' in states]
        selected=[i for i,mesh in enumerate(doc['meshes']) if any(mesh['name'].endswith('.'+group) for group in default)]
        parts={part['material']:part for entry in api['meshes'] if 'firstperson_' in entry['mesh_group'] for part in entry['parts']}
        entries=[{'parts':[parts[primitive['extras']['material']] for primitive in doc['meshes'][index]['primitives']]} for index in selected]
        mapping={old:new for new,old in enumerate(selected)}
        doc['meshes']=[doc['meshes'][index] for index in selected]
        api={**api,'meshes':entries}
        for node in doc['nodes']:
            if 'mesh' not in node:continue
            old=node['mesh']
            if old not in mapping:del node['mesh'];continue
            node['mesh']=mapping[old]
            is_sleeve=any(node['name'].endswith('.'+group) for group in hidden)
            node['name']=('agent_sleeves_' if is_sleeve else 'agent_hands_')+node['name'].split('.')[-1]
        doc['animations']=[]
    doc['images'],doc['textures'],doc['materials'] = [],[],[]
    image_cache = {}
    def texture(image):
        cache=CACHE/'packed-textures';cache.mkdir(exist_ok=True)
        key=hashlib.sha256(image.mode.encode()+str(image.size).encode()+image.tobytes()).hexdigest();packed=cache/(key+'.webp')
        if not packed.exists():
            encoded=io.BytesIO();image.save(encoded,'WEBP',lossless=True,method=6)
            temporary=packed.with_suffix(f'.{os.getpid()}.tmp');temporary.write_bytes(encoded.getvalue());temporary.replace(packed)
        data=packed.read_bytes()
        sha=hashlib.sha256(data).hexdigest()
        if sha in image_cache:return image_cache[sha]
        blob.extend(b'\0'*(-len(blob)%4)); view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
        i=len(doc['images']);doc['images'].append({'bufferView':view,'mimeType':'image/webp'})
        doc['textures'].append({'sampler':0,'extensions':{'EXT_texture_webp':{'source':i}}});image_cache[sha]=i
        return i
    def source_image(url):
        url=url.replace('/data/','/data/high2/').replace('.ktx2','.avif')
        image=Image.open(io.BytesIO(fetch(url,hashlib.sha256(url.encode()).hexdigest()[:16]+'.avif'))).convert('RGB')
        image.thumbnail((1024,1024),Image.Resampling.LANCZOS);return image
    for mesh,entry in zip(doc['meshes'],api['meshes']):
        parts=entry.get('parts') or [entry]
        assert len(mesh['primitives'])==len(parts),f'{item} mesh/material mismatch'
        for primitive,part in zip(mesh['primitives'],parts):
            inputs=part['textures']; color=source_image(inputs['g_tColor']); packed=source_image(inputs['g_tMetalness'])
            native_normal=source_image(inputs['g_tNormal'])
            character=part.get('shader')=='csgo_character.vfx'
            roughness=native_normal.resize(packed.size,Image.Resampling.LANCZOS).getchannel('B') if character else packed.getchannel('R')
            ao=source_image(inputs['g_tAmbientOcclusion']).resize(packed.size,Image.Resampling.LANCZOS).getchannel('R')
            material={'name':part['material'].split('/')[-1].removesuffix('.vmat'),'pbrMetallicRoughness':{'baseColorTexture':{'index':texture(color)},'metallicRoughnessTexture':{'index':texture(Image.merge('RGB',(ao,roughness,packed.getchannel('G'))))},'baseColorFactor':part.get('params',{}).get('g_vColorTint',[1,1,1,1]),'metallicFactor':1,'roughnessFactor':1},'extras':{'sourceShader':part.get('shader'),'roughnessChannel':'normal.b' if character else 'metalness.r'}}
            material['occlusionTexture']={'index':material['pbrMetallicRoughness']['metallicRoughnessTexture']['index']}
            if 'default_normal' not in inputs['g_tNormal']:
                normal=np.asarray(native_normal,dtype=np.float32)
                nx=(normal[:,:,0]+normal[:,:,1])/255-1.003922;ny=(normal[:,:,0]-normal[:,:,1])/255
                vector=np.stack((nx,ny,1-np.abs(nx)-np.abs(ny)),axis=2);vector/=np.maximum(np.linalg.norm(vector,axis=2,keepdims=True),1e-8)
                material['normalTexture']={'index':texture(Image.fromarray(np.clip((vector*.5+.5)*255,0,255).astype(np.uint8)))}
            primitive['material']=len(doc['materials']);doc['materials'].append(material)
    doc['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
    doc['extensionsUsed']=doc['extensionsRequired']=['EXT_texture_webp']
    if firstperson: blob=compact(doc,blob)
    output=glb_pack(doc,blob);target.write_bytes(output)
    return {'file':'/'+str(target.relative_to(ROOT/'packages/assets/public')),'nativeMesh':api['mesh_url'],'bytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'clips':[clip['name'] for clip in doc.get('animations',[])]}

def main():
    items = json.loads(fetch('https://api.cs2inspects.com/items/gloves2', 'catalog.json'))['items']
    assert len({item['id'] for item in items}) == len(items)
    html = fetch('https://3d.cs2inspects.com/', 'viewer.html').decode()
    bundle_url = 'https://3d.cs2inspects.com' + re.search(r'src="([^"]+\.js)"', html)[1]
    bundle = fetch(bundle_url, 'viewer.js').decode()
    # This is the request header published inside the public viewer bundle.
    header = re.search(r'\w+=`([^`]+)`,\w+=\{credentials:`include`\};function \w+\(\w+\)\{return \w+===`https://3dapi.cs2inspects.com`\?\{"X-Site-Password"', bundle)[1]
    def metadata(item):
        if not item['skin_id']: return None
        return json.loads(fetch('https://3dapi.cs2inspects.com/resolve/raw', item['id']+'.json', {'item':item['item_id'],'paint':item['skin_id'],'seed':1,'wear':.1}, header))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        paints = list(pool.map(metadata, items))
    print(f'{len(items)} glove entries; paint metadata ready', flush=True)
    urls = set()
    for paint in paints:
        if not paint: continue
        for target in paint['targets']:
            urls.update(target['direct_textures'].values())
            for entry in target['passes']:
                urls.update(value for value in entry['textures'].values() if isinstance(value,str) and value.startswith('https:'))
                urls.update([entry['shader']['vs_wgsl_url'],entry['shader']['ps_wgsl_url']])
    def localize(url):
        shader = url.endswith('.wgsl')
        stem = hashlib.sha256(url.encode()).hexdigest()[:16]
        folder = 'shaders' if shader else 'textures'
        for location in [ROOT/'packages/assets/public/skins', OUT]:
            for suffix in ['.wgsl'] if shader else ['.rgba.gz','.ktx2.gz']:
                dest = location/folder/(stem+suffix)
                if dest.exists():
                    if location == OUT:
                        source = url if shader or (CACHE/(stem+'.ktx2')).exists() else url.replace('/data/','/data/high2/').replace('.ktx2','.avif')
                        fetch(source,stem+('.wgsl' if shader else '.ktx2' if (CACHE/(stem+'.ktx2')).exists() else '.avif'))
                    return url, '/'+str(dest.relative_to(ROOT/'packages/assets/public'))
        source = url if shader else url.replace('/data/','/data/high2/').replace('.ktx2','.avif')
        try:
            raw = fetch(source, stem+('.wgsl' if shader else '.avif'))
        except subprocess.CalledProcessError:
            if shader: raise
            raw = fetch(url, stem+'.ktx2')
        suffix = '.wgsl' if shader else '.ktx2.gz' if raw[:4] == b'\xabKTX' else '.rgba.gz'
        if shader: output = raw
        elif suffix == '.ktx2.gz':
            fmt, _, width, height = struct.unpack_from('<4I',raw,12)
            assert struct.unpack_from('<I',raw,44)[0] == 0, 'Unsupported compressed mask'
            if fmt == 97: output = gzip.compress(raw, mtime=0)
            else:
                assert fmt in [9,16,37], f'Unsupported native mask format {fmt}'
                stride={9:1,16:2,37:4}[fmt];offset=struct.unpack_from('<Q',raw,80)[0]
                pixels=np.frombuffer(raw,dtype=np.uint8,count=width*height*stride,offset=offset).reshape(height,width,stride)
                rgba=np.zeros((height,width,4),dtype=np.uint8);rgba[:,:,3]=255;rgba[:,:,:stride]=pixels
                output=gzip.compress(struct.pack('<II',width,height)+rgba.tobytes(),mtime=0);suffix='.rgba.gz'
        else:
            image = Image.open(io.BytesIO(raw)).convert('RGBA')
            scale = min(1,1024/max(image.size)); size = tuple(max(1,round(value*scale)) for value in image.size)
            image = Image.merge('RGBA',tuple(channel.resize(size,Image.Resampling.LANCZOS) for channel in image.split()))
            output = gzip.compress(struct.pack('<II',*size)+image.tobytes(),mtime=0)
        dest = OUT/folder/(stem+suffix); dest.write_bytes(output)
        return url, '/'+str(dest.relative_to(ROOT/'packages/assets/public'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        paths = {}
        for n,(url,path) in enumerate(pool.map(localize,sorted(urls)),1):
            paths[url] = path
            if n%40 == 0 or n==len(urls): print(f'Textures/shaders {n}/{len(urls)}',flush=True)
    def replace(value):
        if isinstance(value,str): return paths.get(value,value)
        if isinstance(value,list): return [replace(item) for item in value]
        if isinstance(value,dict): return {key:replace(item) for key,item in value.items()}
        return value
    models = {}
    for item in sorted({item['item_id'] for item in items}):
        api = json.loads(fetch(f'https://3dapi.cs2inspects.com/model/{item}',f'model-{item}.json',header=header))
        existing = MODELS/f'{item}.glb'
        if existing.exists() and not REFRESH and not REPACK:
            data=existing.read_bytes();length=struct.unpack_from('<I',data,12)[0];document=json.loads(data[20:20+length])
            models[str(item)]={'file':f'/models/gloves/{item}.glb','nativeMesh':api['mesh_url'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'clips':[clip['name'] for clip in document.get('animations',[])]}
            fetch(api['mesh_url'],f'model-{item}.glb')
            continue
        models[str(item)]=pack_model(api,item,MODELS/f'{item}.glb')
        print(f'Model {item} ready',flush=True)
    def thumbnail(item):
        if (OUT/'thumbs'/(item['id']+'.webp')).exists() and not REFRESH:
            fetch(item['image'],item['id']+'-thumb')
            return
        image=Image.open(io.BytesIO(fetch(item['image'],item['id']+'-thumb'))).convert('RGBA')
        image.thumbnail((256,192),Image.Resampling.LANCZOS);image.save(OUT/'thumbs'/(item['id']+'.webp'),'WEBP',quality=85,method=6)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(thumbnail,items))
    catalog=[]
    for item,paint in zip(items,paints):
        if paint:(OUT/'paints'/(item['id']+'.json')).write_text(json.dumps(replace(paint),separators=(',',':'))+'\n')
        catalog.append({'id':item['id'],'item':item['item_id'],'paint':item['skin_id'],'name':item['name'].replace('★ ',''),'model':models[str(item['item_id'])]['file'],'image':f'/skins/gloves/thumbs/{item["id"]}.webp'})
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
    (OUT/'source.json').write_text(json.dumps({'source':'https://cs2inspects.com/3d-viewer','generator':'python3 scripts/import-gloves.py','entries':len(catalog),'models':models,'processing':'Native first/third-person meshes, joint palettes, weights and animations retained. Textures embedded as lossless WebP up to1024px. Native paint metadata/shaders and channel-preserving1024px masks stay local. Runtime remaps metre/Y-up positions/inversebinds to existing Source-inch bone rig without replacing animations.','limitations':'Three.js material approximation; native skinSSS and cloth shaders are not reproduced. Runtime uses current agent arm/finger poses, not an evaluated native animation graph.','inputs':dict(sorted({**pins,**records}.items()))},indent=2)+'\n')
    print(f'Imported {len(catalog)} glove entries and {len(models)} models',flush=True)


if __name__=='__main__':
    if '--agent-arms' in sys.argv:import_agent_arms()
    else:main()
