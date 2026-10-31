"""Import the public csgoskins.gg v6 viewer GLBs and their original vanilla textures.
Discovery: Playwright MCP, item 3D View -> First-person View (see manifest pages).
Usage: python3 scripts/import-csgoskins.py
Requires Pillow and NumPy. Downloads cached under ignored artifacts/csgoskins.
"""
import hashlib, io, json, struct, subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT/'artifacts/csgoskins'
BASE = 'https://cdn.csgoskins.gg/packages/assets/public/images/objects/v6/static/'
WEAPONS = [
    ('ak-47','ak47','ak','https://csgoskins.gg/items/ak-47-redline'),
    ('m4a1_s','m4a1_silencer','rifle','https://csgoskins.gg/items/m4a1-s-basilisk'),
    ('usp-s','usp_silencer','pistol','https://csgoskins.gg/items/usp-s-stainless'),
    ('awp','awp','awp','https://csgoskins.gg/items/awp-dragon-lore'),
]

def download(path):
    dest = CACHE/path
    if not dest.exists():
        dest.parent.mkdir(parents=True,exist_ok=True)
        result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','3','--max-time','120',BASE+path],check=True,capture_output=True)
        dest.write_bytes(result.stdout)
    return dest

def read_glb(path):
    raw=Path(path).read_bytes(); n=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+n]),bytearray(raw[28+n:])

def write_glb(path,doc,blob):
    doc['buffers']=[{'byteLength':len(blob)}]
    blob+=b'\0'*(-len(blob)%4)
    header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
    Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob)

def pack_materials(doc,blob,agent=False,overrides=None,texture_size=(1024,2048)):
    original=doc['images'];oldtextures=doc['textures'];inputs=[]
    originals=[]
    for im in original:
        view=doc['bufferViews'][im['bufferView']]
        raw=bytes(blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
        originals.append(Image.open(io.BytesIO(raw)).convert('RGBA'))
    # Preserve genuine constant VMAT inputs and generic neutral defaults. Names
    # such as m249_default_color are real atlases, not 1x1 placeholders; these
    # also texture unpainted ammunition/accessories in legacy weapon meshes.
    paths={im['name']: 'assets/vanilla/'+im['name'] for im in original if '_vmat_' not in im['name'] and not im['name'].startswith('default_')}
    resolved={}
    def fetch(item):
        name,url=item
        p=Path(overrides[name]) if overrides and name in overrides else download(url)
        return name,p
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name,p in pool.map(fetch,paths.items()):
            resolved[name]=p
            inputs.append({'file':p.name,'url':BASE+paths[name] if not overrides or name not in overrides else None,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    def texture(info):
        i=oldtextures[info['index']]['source'];name=original[i]['name']
        im=Image.open(resolved[name]).convert('RGBA') if name in resolved else originals[i].copy()
        im.thumbnail(texture_size,Image.Resampling.LANCZOS)
        return im
    doc['images']=[];doc['textures']=[];doc['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
    doc['extensionsUsed']=['EXT_texture_webp'];doc['extensionsRequired']=['EXT_texture_webp']
    def embed(im,name,color=False):
        out=io.BytesIO();im.save(out,format='WEBP',lossless=not color,quality=94,method=6)
        blob.extend(b'\0'*(-len(blob)%4));v=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(out.getvalue())});blob.extend(out.getvalue())
        i=len(doc['images']);doc['images'].append({'name':name,'bufferView':v,'mimeType':'image/webp'})
        doc['textures'].append({'extensions':{'EXT_texture_webp':{'source':i}},'sampler':0})
        return {'index':i}
    for m in doc['materials']:
        pbr=m['pbrMetallicRoughness'];color=texture(pbr['baseColorTexture']);normal=texture(m['normalTexture']);packed=texture(pbr['metallicRoughnessTexture']) if 'metallicRoughnessTexture' in pbr else Image.new('RGBA',(1,1),(round(255*pbr.get('roughnessFactor',1)),round(255*pbr.get('metallicFactor',1)),0,255));ao=texture(m['occlusionTexture'])
        size=(max(color.width,normal.width,packed.width,ao.width),max(color.height,normal.height,packed.height,ao.height))
        normal=normal.resize(size,Image.Resampling.LANCZOS);packed=packed.resize(size,Image.Resampling.LANCZOS);ao=ao.resize(size,Image.Resampling.LANCZOS)
        values=np.asarray(normal,dtype=np.float32)
        nx=(values[:,:,0]+values[:,:,1])/255-1.003922;ny=(values[:,:,0]-values[:,:,1])/255;nz=1-np.abs(nx)-np.abs(ny)
        vector=np.stack((nx,ny,nz),axis=2);vector/=np.maximum(np.linalg.norm(vector,axis=2,keepdims=True),1e-8)
        xyz=Image.fromarray(np.clip((vector*.5+.5)*255,0,255).astype(np.uint8))
        orm=Image.merge('RGB',(ao.getchannel('R'),normal.getchannel('B') if agent else packed.getchannel('R'),packed.getchannel('G')))
        m['pbrMetallicRoughness']={'baseColorTexture':embed(color,m['name']+' color',True),'metallicRoughnessTexture':embed(orm,m['name']+' ORM'),'metallicFactor':1,'roughnessFactor':1}
        m['normalTexture']=embed(xyz,m['name']+' normal')
        m['occlusionTexture']={'index':m['pbrMetallicRoughness']['metallicRoughnessTexture']['index'],'strength':.8}
    return inputs

def main():
    dest=ROOT/'packages/assets/public/models/viewmodels';dest.mkdir(exist_ok=True)
    entries=[]
    for name,folder,suffix,page in WEAPONS:
        modelpath=f'assets/weapons/models/{folder}_legacy/mesh.glb'
        source=download(modelpath);doc,blob=read_glb(source)
        inputs=pack_materials(doc,blob)
        # Imported dropped-pose clip is not a first-person animation.
        doc.pop('animations',None)
        write_glb(dest/(name+'.glb'),doc,blob)
        entry={'weapon':name,'page':page,'model':BASE+modelpath,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'textures':inputs,'clips':[]}
        clips=dest/name;clips.mkdir(exist_ok=True)
        for action in ['idle','draw','reload','shoot1','lookat01']:
            path=f'assets/weapons/anims/{folder}/{action}_{suffix}.glb';p=download(path)
            (clips/(action+'.glb')).write_bytes(p.read_bytes())
            entry['clips'].append({'name':action,'url':BASE+path,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
        entries.append(entry);print('Imported',name,flush=True)
    (dest/'source.json').write_text(json.dumps({'generator':'scripts/import-csgoskins.py','source':'Valve assets served by the public CSGOSKINS.GG v6 viewer. Vanilla substrate textures; no paid skin applied.','weapons':entries},indent=2)+'\n')

if __name__=='__main__':main()
