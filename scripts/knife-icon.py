"""Generate the M9 inventory/kill-feed silhouette from its original STL.
Usage: python3 scripts/knife-icon.py source.stl (requires Pillow).
"""
import struct,sys
from pathlib import Path
from PIL import Image,ImageDraw
source = Path(sys.argv[1])
triangles = []
with source.open('rb') as f:
 f.seek(80); count = struct.unpack('<I',f.read(4))[0]
 for _ in range(count):
  values = struct.unpack('<12fH',f.read(50))
  triangles.append([values[3+i*3:6+i*3] for i in range(3)])
points = [v for t in triangles for v in t]
lo = [min(v[i] for v in points) for i in range(3)]
hi = [max(v[i] for v in points) for i in range(3)]
scale = 272/(hi[1]-lo[1]);center = (lo[0]+hi[0])/2
image = Image.new('RGBA',(288,80)); draw = ImageDraw.Draw(image)
for triangle in triangles:
 draw.polygon([(8+(hi[1]-y)*scale,40+(x-center)*scale) for x,y,z in triangle],fill='white')
image.save(Path(__file__).resolve().parents[1]/'packages/assets/public/icons/m9-bayonet.png',optimize=True)
