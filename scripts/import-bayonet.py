"""Import the supplied UV-mapped Bayonet and Source color/roughness-metal/AO maps.
Usage: python3 scripts/import-bayonet.py mesh.glb color.webp rough-metal.png ao.png
Requires Pillow. Inputs are read-only; output GLB embeds all runtime textures.
"""
import hashlib
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image, ImageDraw

source, color, packed, ao = map(Path, sys.argv[1:])
root = Path(__file__).resolve().parents[1]
raw = source.read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+size])
source_bin = raw[28+size:]
primitive = doc['meshes'][0]['primitives'][0]

def read_accessor(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    fmt = '<' + {5126: 'f', 5125: 'I', 5123: 'H'}[a['componentType']] * components
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', struct.calcsize(fmt))
    return [struct.unpack_from(fmt, source_bin, start+i*stride) for i in range(a['count'])]

positions = read_accessor(primitive['attributes']['POSITION'])
normals = read_accessor(primitive['attributes']['NORMAL'])
uvs = read_accessor(primitive['attributes']['TEXCOORD_0'])
indices = read_accessor(primitive['indices'])
# Source mesh: Z along blade, Y through thickness. Runtime: -Z blade, X thickness.
# Centre the grip at the authored animation contact, retaining the original UVs.
length = .31
scale = length / (max(p[2] for p in positions)-min(p[2] for p in positions))
grip_center = -1.15
positions = [(y*scale, x*scale, -(z-grip_center)*scale) for x,y,z in positions]
normals = [(y,x,-z) for x,y,z in normals]
output = bytearray()
views = []
accessors = []

def add_view(data):
    output.extend(b'\0' * (-len(output) % 4))
    views.append({'buffer':0, 'byteOffset':len(output), 'byteLength':len(data)})
    output.extend(data)
    return len(views)-1

def add_accessor(values, fmt, kind, component, bounds=False):
    view = add_view(b''.join(struct.pack(fmt, *v) for v in values))
    a = {'bufferView':view, 'componentType':component, 'count':len(values), 'type':kind}
    if bounds:
        a['min'] = [min(v[i] for v in values) for i in range(3)]
        a['max'] = [max(v[i] for v in values) for i in range(3)]
    accessors.append(a)
    return len(accessors)-1

attrs = {'POSITION':add_accessor(positions,'<3f','VEC3',5126,True),
         'NORMAL':add_accessor(normals,'<3f','VEC3',5126),
         'TEXCOORD_0':add_accessor(uvs,'<2f','VEC2',5126)}
index = add_accessor(indices,'<H','SCALAR',5123)
base = Image.open(color).convert('RGB')
source_maps = Image.open(packed).convert('RGB')
shadow = Image.open(ao).convert('RGB')
assert base.size == source_maps.size == shadow.size
# Source rough map R=roughness, G=metalness. glTF G=roughness, B=metalness.
# AO shares the texture's red channel; no color-space conversion for data maps.
rough, metal, _ = source_maps.split()
orm = Image.merge('RGB', (shadow.getchannel('R'), rough, metal))
images=[]
for name, im in [('Bayonet color',base),('Bayonet occlusion roughness metalness',orm)]:
    data=io.BytesIO();im.save(data,format='WEBP',lossless=True,method=6)
    encoded = color.read_bytes() if im is base and color.suffix.lower() == '.webp' else data.getvalue()
    images.append({'name':name,'bufferView':add_view(encoded),'mimeType':'image/webp'})
material={'name':'Bayonet worn steel and olive grip',
          'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':1},'metallicFactor':1,'roughnessFactor':1},
          'occlusionTexture':{'index':1,'strength':0.8}}
result={'asset':{'version':'2.0','generator':'CS2GO import-bayonet.py'},
        'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'bayonet','mesh':0,'extras':{'meshToSource':[0,1/scale,0,0,1/scale,0,0,0,0,0,-1/scale,0,0,0,grip_center,1]}}],
        'meshes':[{'primitives':[{'attributes':attrs,'indices':index,'material':0}]}],
        'materials':[material],'images':images,
        'extensionsUsed':['EXT_texture_webp'],'extensionsRequired':['EXT_texture_webp'],
        'textures':[{'extensions':{'EXT_texture_webp':{'source':i}},'sampler':0} for i in range(2)],
        'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
        'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(output)}]}
output.extend(b'\0'*(-len(output)%4))
header=json.dumps(result,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
glb=struct.pack('<III',0x46546c67,2,28+len(header)+len(output))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(output),0x004e4942)+output
(root/'packages/assets/public/models/bayonet.glb').write_bytes(glb)
manifest={'inputs':[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [source,color,packed,ao]],
          'triangles':len(indices)//3,'lengthMeters':length,'gripCenterSourceZ':grip_center,
          'materials':'Supplied color and AO; source packed R roughness / G metalness repacked to glTF ORM. Neutral placeholder normal omitted.',
          'animation':'Native clips imported separately by scripts/import-knife-animations.py. meshToSource restores source coordinates for the animated attachment.',
          'generator':'scripts/import-bayonet.py'}
(root/'packages/assets/public/models/bayonet.source.json').write_text(json.dumps(manifest,indent=2)+'\n')
# The HUD uses the same mesh silhouette, with the tip pointing left.
im=Image.new('RGBA',(576,160));draw=ImageDraw.Draw(im)
zmin=min(p[2] for p in positions)
for i in range(0,len(indices),3):
    draw.polygon([(16+(positions[indices[k][0]][2]-zmin)/length*544,80-positions[indices[k][0]][1]/length*544) for k in range(i,i+3)],fill='white')
im.resize((288,80),Image.Resampling.LANCZOS).save(root/'packages/assets/public/icons/bayonet.png',optimize=True)
print(f'Imported {len(indices)//3} triangles, {len(glb)} bytes; textures {base.size}')
