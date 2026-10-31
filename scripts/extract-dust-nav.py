"""Extract CS:GO Source NAV v16 areas, spawn poses and bombsites in glTF meters."""
import pathlib,struct,re,json,sys
root=pathlib.Path(__file__).resolve().parents[1];source=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'new_map/csgo/maps';stem='de_dust2' if (source/'de_dust2.nav').exists() else 'de_dust2_csgoportpk';b=(source/(stem+'.nav')).read_bytes();p=0
def read(fmt):
 global p
 v=struct.unpack_from('<'+fmt,b,p);p+=struct.calcsize('<'+fmt);return v[0] if len(v)==1 else v
def skip(n):
 global p;p+=n
assert read('I')==0xFEEDFACE;assert read('I')==16;subversion=read('I');assert subversion in (0,1)
read('I');read('B');places=[]
for _ in range(read('H')):
 size=read('H');places.append(b[p:p+size].rstrip(b'\0').decode());skip(size)
read('B');count=read('I');areas=[]
def convert(v):return [round(v[0]*.0254,4),round(v[2]*.0254,4),round(-v[1]*.0254,4)]
for _ in range(count):
 id=read('I');flags=read('I');nw=read('3f');se=read('3f');ne,sw=read('2f');links=[]
 for direction in range(4):
  for i in range(read('I')):links.append(read('I'))
 hiding=[]
 for i in range(read('B')):
  hid=read('I');point=read('3f');hf=read('B');hiding.append(convert(point))
 for i in range(read('I')):
  skip(10);skip(read('B')*5)
 place=read('H')
 for i in range(2):skip(read('I')*4)
 skip(8+16);skip(read('I')*5);skip(4)
 if subversion==1:skip(read('B')*14)
 corners=[convert(nw),convert((se[0],nw[1],ne)),convert(se),convert((nw[0],se[1],sw))]
 center=[round(sum(c[i] for c in corners)/4,4) for i in range(3)]
 areas.append({'id':id,'flags':flags,'center':center,'rect':[corners[0][0],corners[2][2],corners[2][0],corners[0][2]],'corners':corners,'links':links,'cover':hiding,'place':places[place-1] if place else ''})
assert len({a['id'] for a in areas})==count
assert len(b)-p==4 and struct.unpack_from('<I',b,p)[0]==0, 'Unexpected NAV trailer'
raw=(source/(stem+'.bsp')).read_bytes();offset,size=struct.unpack_from('<ii',raw,8);text=raw[offset:offset+size].decode(errors='replace');entities=[dict(re.findall(r'"([^"\n]+)"\s*"([^"\n]*)"',e)) for e in re.findall(r'\{([^{}]*)\}',text)]
spawns={side:[convert(list(map(float,e['origin'].split()))) for e in entities if e.get('classname')==name] for side,name in [('t','info_player_terrorist'),('ct','info_player_counterterrorist')]}
spawnAngles={side:[round((float(e.get('angles','0 90 0').split()[1])-90)*3.141592653589793/180,6) for e in entities if e.get('classname')==name] for side,name in [('t','info_player_terrorist'),('ct','info_player_counterterrorist')]}
# The native graph labels the tactical zones; choose centers of those clusters.
sites=[]
model_offset,model_size=struct.unpack_from('<ii',raw,8+14*16)
for e in entities:
 if e.get('classname') not in ['func_bomb_target','func_bombtarget']:continue
 index=int(e['model'][1:]);values=struct.unpack_from('<9f',raw,model_offset+index*48)
 center=[(values[i]+values[i+3])/2 for i in range(3)]
 sites.append(convert(center))
for label in ([] if sites else ['BombsiteA','BombsiteB']):
 group=[a['center'] for a in areas if a['place']==label]
 if group:sites.append([round(sum(v[i] for v in group)/len(group),4) for i in range(3)])
sites.sort(key=lambda site:-site[0])  # A (east), then B (west).
output={'areas':areas,'spawns':spawns,'spawnAngles':spawnAngles,'sites':sites,'bounds':[min(a['rect'][0] for a in areas),min(a['rect'][1] for a in areas),max(a['rect'][2] for a in areas),max(a['rect'][3] for a in areas)]}
(root/'packages/assets/public/models/maps/dust2-nav.json').write_text(json.dumps(output,separators=(',',':')))
print('NAV',count,'spawns',spawns,'sites',sites,'bounds',output['bounds'],'bytes remaining',len(b)-p)
