"""Bundle the CS2 Inspects weapon paint catalog and native composite shaders.

Requires Python/Pillow and curl. Save the public viewer bundle to
artifacts/inspects-viewer.js first (the importer reads its public API header).
Caches API responses and originals under artifacts/skin-import; --refresh-catalog
updates listings while retaining downloaded paints and optimized thumbnails.
--refresh also refreshes paint metadata and thumbnails. Runtime assets are local.
SKIN_IMPORT_WORKERS selects 1-8 concurrent jobs (default 4); 1024px paint masks
retain their raw channels and existing optimized thumbnails are preserved.
"""
import concurrent.futures, gzip, hashlib, json, os, re, struct, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/skin-import'
OUT = ROOT / 'packages/assets/public/skins'
for p in (CACHE, OUT, OUT/'textures', OUT/'shaders', OUT/'paints', OUT/'thumbs'):
    p.mkdir(parents=True, exist_ok=True)
workers = max(1, min(8, int(os.environ.get('SKIN_IMPORT_WORKERS', '4'))))
refresh = '--refresh' in sys.argv
refresh_catalog = refresh or '--refresh-catalog' in sys.argv
bundle = (ROOT/'artifacts/inspects-viewer.js').read_text()
public_header = re.search(r'Zwe=`([^`]+)`', bundle)[1]
records = {}

def fetch(url, path, body=None, api=False):
    if not path.exists():
        args=['curl','-fsSL','--retry','3','--max-time','60',url]
        if api: args += ['-H','X-Site-Password: '+public_header]
        if body is not None: args += ['-H','Content-Type: application/json','--data',json.dumps(body)]
        path.write_bytes(subprocess.check_output(args))
    records[url + ('#'+json.dumps(body,sort_keys=True) if body else '')] = hashlib.sha256(path.read_bytes()).hexdigest()
    return path

catalog_path = CACHE/'catalog.json'
if refresh_catalog and catalog_path.exists(): catalog_path.unlink()
items = json.loads(fetch('https://api.cs2inspects.com/items/weapons2',catalog_path).read_text())['items']
knife_catalog_path = CACHE/'knives-catalog.json'
if refresh_catalog and knife_catalog_path.exists(): knife_catalog_path.unlink()
items += json.loads(fetch('https://api.cs2inspects.com/items/knife2',knife_catalog_path).read_text())['items']
# Positional mapping is the persistent runtime weapon ID; append, never reorder.
weapon_ids = [7,60,61,9,500,515,507,4,1,16,35,34,
              32,36,3,30,63,64,2,10,13,8,39,40,38,11,17,33,23,24,19,26,25,27,29,14,28]
items = [x for x in items if x['item_id'] in weapon_ids and x['skin_id'] != 0]
missing = set(weapon_ids) - {x['item_id'] for x in items}
if missing:
    raise RuntimeError(f'Catalog is missing weapon IDs: {sorted(missing)}')

def metadata(item):
    path=CACHE/(item['id']+'.json')
    if refresh and path.exists(): path.unlink()
    fetch('https://3dapi.cs2inspects.com/resolve/raw',path,{'item':item['item_id'],'paint':item['skin_id'],'seed':1,'wear':.1},True)
    return json.loads(path.read_text())
with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
    resolved=[]
    for n, result in enumerate(pool.map(metadata,items), 1):
        resolved.append(result)
        if n % 40 == 0 or n == len(items):
            print('Paint descriptions',n,'/',len(items),flush=True)
urls=set()
for r in resolved:
    for t in r['targets']:
        urls.update(t['direct_textures'].values())
        for p in t['passes']:
            urls.update(v for v in p['textures'].values() if isinstance(v,str) and v.startswith('https:'))
            urls.update([p['shader']['vs_wgsl_url'],p['shader']['ps_wgsl_url']])

def localize(url):
    shader=url.endswith('.wgsl')
    source=url if shader else url.replace('/data/','/data/high2/').replace('.ktx2','.avif')
    stem=hashlib.sha256(url.encode()).hexdigest()[:16]
    cached=fetch(source,CACHE/(stem+('.wgsl' if shader else '.avif')))
    suffix='.wgsl' if shader else '.ktx2.gz' if cached.read_bytes()[:4] == b'\xabKTX' else '.rgba.gz'
    dest=OUT/('shaders' if shader else 'textures')/(stem+suffix)
    if not dest.exists():
        if shader: dest.write_bytes(cached.read_bytes())
        elif suffix=='.ktx2.gz': dest.write_bytes(gzip.compress(cached.read_bytes(),mtime=0))
        else:
            im=Image.open(cached).convert('RGBA')
            scale=min(1,1024/max(im.size));size=tuple(max(1,round(x*scale)) for x in im.size)
            # These are shader channels, not transparency: resizing RGBA would
            # premultiply by alpha and destroy RGB masks wherever alpha is zero.
            im=Image.merge('RGBA',tuple(c.resize(size,Image.Resampling.LANCZOS) for c in im.split()))
            dest.write_bytes(gzip.compress(struct.pack('<II',*size)+im.tobytes(),mtime=0))
    return url,'/skins/'+str(dest.relative_to(OUT))
with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
    paths={}
    for n,(url,path) in enumerate(pool.map(localize,sorted(urls))):
        paths[url]=path
        if n%40==0: print('Textures/shaders',n,'/',len(urls),flush=True)

def replace(v):
    if isinstance(v,str): return paths.get(v,v)
    if isinstance(v,list): return [replace(x) for x in v]
    if isinstance(v,dict): return {k:replace(x) for k,x in v.items()}
    return v
def thumbnail(item):
    ident=item['id']
    thumb=fetch(item['image'],CACHE/(ident+'-thumb'+Path(item['image']).suffix))
    # Preserve the user's TinyPNG-optimized thumbnails on ordinary reruns.
    thumb_out=OUT/'thumbs'/f'{ident}.webp'
    valid = False
    if thumb_out.exists() and not refresh:
        try:
            with Image.open(thumb_out) as existing: existing.verify()
            valid = True
        except (OSError, ValueError):
            pass
    if not valid:
        im=Image.open(thumb).convert('RGBA');im.thumbnail((256,192),Image.Resampling.LANCZOS)
        im.save(thumb_out,'WEBP',quality=85,method=6)
with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
    list(pool.map(thumbnail,items))
catalog=[]
for item,r in zip(items,resolved):
    ident=item['id']
    (OUT/'paints'/f'{ident}.json').write_text(json.dumps(replace(r),separators=(',',':'))+'\n')
    catalog.append({'id':ident,'weapon':weapon_ids.index(item['item_id']),'paint':item['skin_id'],'name':item['name'].split(' | ',1)[-1],'rarity':item['rarity'],'body':'hd' if 'body_hd' in r['mesh_group'] else 'legacy','image':f'/skins/thumbs/{ident}.webp'})
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
(OUT/'source.json').write_text(json.dumps({'source':'https://cs2inspects.com/3d-viewer','generator':'python3 scripts/import-skins.py','catalogEntries':len(items),'textureSize':1024,'notes':'Valve paint data and composite WGSL shaders served by CS2 Inspects. Local gzip RGBA textures preserving transparent RGB channels; original downloads retained in artifacts. API paint descriptions include original seeded roll order and dynamic expressions.','sha256':records},indent=2)+'\n')
print('Imported',len(items),'skins',len(urls),'shared textures/shaders',flush=True)
