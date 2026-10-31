"""Extract the native prop position without loading map textures or vertex buffers."""
import gzip
import hashlib
import json
from pathlib import Path
import struct
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'packages/assets/public/models/maps/dust2.glb.gz'
raw=gzip.decompress(path.read_bytes())
size=struct.unpack_from('<I',raw,12)[0]
data=json.loads(raw[20:20+size])
materials={i for i,item in enumerate(data['materials']) if 'soccerball' in item.get('name','')}
centers=[]
for node in data['nodes']:
    if 'mesh' not in node:
        continue
    for primitive in data['meshes'][node['mesh']]['primitives']:
        if primitive.get('material') not in materials:
            continue
        if 'matrix' in node or 'rotation' in node:
            raise ValueError('Regeneration needs rotated prop transform support')
        accessor=data['accessors'][primitive['attributes']['POSITION']]
        scale=node.get('scale',[1,1,1])
        offset=node.get('translation',[0,0,0])
        normalization={5120:127,5121:255,5122:32767,5123:65535}.get(accessor['componentType'],1) if accessor.get('normalized') else 1
        centers.append([offset[i]+scale[i]*(accessor['min'][i]+accessor['max'][i])/(2*normalization) for i in range(3)])
if len(centers)!=1:
    raise ValueError('Expected exactly one isolated soccer ball')
out=ROOT/'packages/simulation/src/data/world-ball-origin.json'
out.write_text(json.dumps({'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'origin':centers[0]},indent=2)+'\n')
print(centers[0])
