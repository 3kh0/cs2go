"""Pack supplied Phoenix first-person hands with local textures.
Usage: python3 scripts/import-view-hands.py mesh.glb textures.json
JSON: glove/arm/sleeve objects with color, normal and optional ao/metal paths.
Requires Pillow and NumPy. Preserves mesh, UVs, skeleton and skin weights.
"""
import hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
source, config = map(Path,sys.argv[1:])
textures = json.loads(config.read_text())
raw=source.read_bytes(); n=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+n]); blob=bytearray(raw[28+n:])
inputs=[source]
doc['images']=[];doc['textures']=[]
doc['extensionsUsed']=['EXT_texture_webp'];doc['extensionsRequired']=['EXT_texture_webp']

def image(path, size=None):
    p=Path(path);inputs.append(p)
    im=Image.open(p).convert('RGB')
    if size: return im.resize(size,Image.Resampling.LANCZOS)
    im.thumbnail((1024,2048),Image.Resampling.LANCZOS)
    return im

def embed(im, name, lossless=True):
    data=io.BytesIO();im.save(data,format='WEBP',lossless=lossless,quality=92,method=6)
    blob.extend(b'\0'*(-len(blob)%4));view=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data.getvalue())});blob.extend(data.getvalue())
    index=len(doc['images']);doc['images'].append({'name':name,'bufferView':view,'mimeType':'image/webp'})
    doc['textures'].append({'extensions':{'EXT_texture_webp':{'source':index}},'sampler':0})
    return {'index':index}

for material,slot in zip(doc['materials'],['glove','arm','sleeve']):
    paths=textures[slot];base=image(paths['color']);normal=image(paths['normal'],base.size)
    values=np.asarray(normal,dtype=np.float32)
    # Source 2 HemiOctIsoRoughness_RG_B. Decode matches VRF Common.Decode_HemiOct:
    # https://github.com/ValveResourceFormat/ValveResourceFormat/blob/master/ValveResourceFormat/TextureDecoders/Common.cs
    nx=(values[:,:,0]+values[:,:,1])/255-1.003922
    ny=(values[:,:,0]-values[:,:,1])/255
    nz=1-np.abs(nx)-np.abs(ny)
    vector=np.stack((nx,ny,nz),axis=2)
    vector/=np.maximum(np.linalg.norm(vector,axis=2,keepdims=True),1e-8)
    decoded=Image.fromarray(np.clip((vector*.5+.5)*255,0,255).astype(np.uint8))
    rough=normal.getchannel('B')
    metal=image(paths['metal'],base.size).getchannel('G') if 'metal' in paths else Image.new('L',base.size,0)
    ao=image(paths['ao'],base.size).getchannel('R') if 'ao' in paths else Image.new('L',base.size,255)
    orm=Image.merge('RGB',(ao,rough,metal))
    material['pbrMetallicRoughness']={'baseColorTexture':embed(base,slot+' color',False),'metallicRoughnessTexture':embed(orm,slot+' ORM'),'metallicFactor':1,'roughnessFactor':1}
    material['normalTexture']=embed(decoded,slot+' tangent normal')
    material['occlusionTexture']={'index':material['pbrMetallicRoughness']['metallicRoughnessTexture']['index'],'strength':.8}

# Existing viewmodel code and supplied clips use upper-case side suffixes.
for node in doc['nodes']:
    name=node.get('name','')
    for side in ['l','r']:
        name=name.replace('_'+side+'_','_'+side.upper()+'_')
        if name.endswith('_'+side):name=name[:-1]+side.upper()
    node['name']=name

doc['buffers']=[{'byteLength':len(blob)}];blob.extend(b'\0'*(-len(blob)%4))
header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
glb=struct.pack('<III',0x46546c67,2,28+len(header)+len(blob))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob
root=Path(__file__).resolve().parents[1]
(root/'packages/assets/public/models/agents/view-hands.glb').write_bytes(glb)
manifest={'source':'User-supplied Phoenix first-person gloves, bare arms and sleeves','inputs':[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dict.fromkeys(inputs)],'normals':'Source 2 hemi-octahedral RG decoded to XYZ; blue used as roughness; metal mask green channel.', 'generator':'scripts/import-view-hands.py'}
(root/'packages/assets/public/models/agents/view-hands.source.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Hands:',len(glb),'bytes')
