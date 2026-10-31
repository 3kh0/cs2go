"""Extract exact Dust II buy-zone and bomb-target physics hulls from the pinned Valve VPK.
Usage: python3 scripts/import-buy-zones.py --vpk path/to/de_dust2.vpk --cli path/to/Source2Viewer-CLI
Requires Source2Viewer 20.0.6980 and the project Bun toolchain. Input assets stay untouched; intermediates in artifacts.
The shipped convex hulls are boxes: verify all native vertices and planes before
using their bounds. A changed/non-box map fails instead of silently approximating.
"""
import argparse, hashlib, itertools, json, re, struct, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--vpk',type=Path,required=True);p.add_argument('--cli',required=True)
a=p.parse_args();cache=ROOT/'artifacts/buyzone-extract';cache.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'packages/assets/public/models/maps/source-manifest.json').read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(a.vpk)==manifest['files']['de_dust2.vpk'],'VPK differs from bundled map'
def extract(path):
 subprocess.run([a.cli,'-i',str(a.vpk),'--vpk_filepath',path,'-o',str(cache)],check=True,capture_output=True)
 return cache/path
def dump(path):return subprocess.check_output([a.cli,'-i',str(path),'-a'],text=True)
entity_path=extract('maps/de_dust2/entities/default_ents.vents_c')
entities=dump(entity_path)
def hulls(text):
 for match in re.finditer(r'm_Hull\s*=\s*\{',text):
  start=match.end();depth=1;end=start
  while depth:
   if text[end]=='{':depth+=1
   elif text[end]=='}':depth-=1
   end+=1
  block=text[start:end-1]
  vertices_raw=bytes.fromhex(re.search(r'm_VertexPositions\s*=\s*#\[([^]]*)\]',block)[1])
  vertices=list(struct.iter_unpack('<3f',vertices_raw))
  low=tuple(min(v[i] for v in vertices) for i in range(3));high=tuple(max(v[i] for v in vertices) for i in range(3))
  assert set(vertices)==set(itertools.product(*zip(low,high))),'Non-box vertices'
  planes=list(struct.iter_unpack('<4f',bytes.fromhex(re.findall(r'm_Planes\s*=\s*#\[([^]]*)\]',block)[-1])))
  expected=[]
  for axis in range(3):
   for sign,limit in [(-1,-low[axis]),(1,high[axis])]:
    n=[0,0,0];n[axis]=sign;expected.append(tuple(n+[limit]))
  assert set(planes)==set(expected),'Non-box planes'
  def point(v):return [round(v[0]*.0254,7),round(v[2]*.0254,7),round(-v[1]*.0254,7)]
  points=[point(v) for v in vertices]
  yield {'sourceBounds':[list(low),list(high)],'sourcePlanes':[list(x) for x in planes],
   'min':[min(v[i] for v in points) for i in range(3)],'max':[max(v[i] for v in points) for i in range(3)]}
zones=[];sites=[];sources={str(entity_path.relative_to(cache)):sha(entity_path)}
for values in re.findall(r'values\s*=\s*\{([^{}]*)\}',entities):
 buy='classname = "func_buyzone"' in values
 bomb='classname = "func_bomb_target"' in values
 if not buy and not bomb:continue
 def vector(key):return json.loads(re.search(r'\b'+key+r'\s*=\s*(\[[^]]*\])',values)[1])
 assert vector('origin')==[0,0,0] and vector('angles')==[0,0,0] and vector('scales')==[1,1,1],'Nonidentity trigger transform'
 model=re.search(r'model\s*=\s*resource_name:"([^"]+)"',values)[1]+'_c'
 path=extract(model);sources[model]=sha(path);shapes=list(hulls(dump(path)));assert shapes
 identity={'entity':re.search(r'hammerUniqueId\s*=\s*"([^"]+)"',values)[1],'model':model}
 if buy:
  team=int(re.search(r'TeamNum\s*=\s*(\d+)',values)[1]);assert team in (2,3)
  assert len(shapes)==1,'Expected one convex buy hull'
  zones.append({'team':'t' if team==2 else 'ct',**identity,**shapes[0]})
 else:
  site=int(re.search(r'bomb_site_designation\s*=\s*"(\d+)"',values)[1]);assert site in (0,1)
  sites.append({'site':site,**identity,'hulls':shapes})
assert sorted(s['site'] for s in sites)==[0,1]
assert {z['team'] for z in zones}=={'t','ct'} and len(zones)==2
out={'source':{'author':'Valve','mapVersion':manifest['version'],'depotManifest':manifest['depotManifest'],'vpkSha256':manifest['files']['de_dust2.vpk'],'resources':sources,'generator':'scripts/import-buy-zones.py','decoder':'Source2Viewer 20.0.6980','geometry':'Exact eight-vertex, six-plane native convex boxes; identity entity transforms; meters, Y up, negative Source Y becomes Z.','references':['https://github.com/SteamTracking/GameTracking-CS2/blob/master/game/csgo/csgo.fgd','https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/triggers.cpp']},'zones':zones,'sites':sites}
(ROOT/'apps/game/src/dust2-buy-zones.json').write_text(json.dumps(out,indent=2)+'\n')
subprocess.run(['bun','run','--bun','oxfmt',str(ROOT/'apps/game/src/dust2-buy-zones.json')],check=True)
print(json.dumps({'zones':zones,'sites':sites},indent=2))
