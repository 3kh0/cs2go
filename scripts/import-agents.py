"""Download pinned agent sources, export and pack the two local runtime models.

Run from the project root with Python 3.11+ and Pillow:
  python3 scripts/import-agents.py --cli /path/to/Source2Viewer-CLI --blender /path/to/blender
Downloads and intermediate files stay in ignored artifacts/agent-import/.
"""
import argparse
import concurrent.futures
import hashlib
import json
import lzma
import pathlib
import re
import struct
import subprocess
import sys
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cli', required=True)
parser.add_argument('--blender', required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
cache = root / 'artifacts/agent-import'
cache.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'packages/assets/public/models/agents/source-manifest.json').read_text())

def download(url, path, sha256=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        subprocess.run(['curl', '-Lsf', '--retry', '3', url, '-o', str(path)], check=True)
    if sha256 and hashlib.sha256(path.read_bytes()).hexdigest() != sha256:
        raise ValueError(f'Source checksum mismatch: {path}')
    return path

def native_file(item):
    name, record = item
    stem, ext = name.rsplit('.', 1)
    url = manifest['groundRebel']['mirror'] + stem + '.' + record['version'] + '.' + ext
    return download(url, cache / 'native' / name, record['sha256'])

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(native_file, manifest['groundRebel']['resources'].items()))
info = cache / 'native/gameinfo.gi'
info.write_text('"GameInfo" { FileSystem { SearchPaths { Game "' + str(info.parent) + '" } } }')
gltf = cache / 'ground-rebel.gltf'
with (cache / 'export.log').open('w') as log:
    subprocess.run([args.cli, '-i', str(cache / 'native' / manifest['groundRebel']['model']), '-o', str(gltf), '-d', '--game', str(info), '--gltf_export_format', 'gltf', '--gltf_export_materials', '--gltf_textures_adapt', '--gltf_mesh_list', 'thirdperson_body,thirdperson_default_gloves', '--gltf_export_animations', '--gltf_animation_list', ','.join(manifest['clips'])], stdout=log, stderr=log, check=True)
arms_gltf = cache / 'ground-rebel-arms.gltf'
with (cache / 'arms-export.log').open('w') as log:
    subprocess.run([args.cli, '-i', str(cache / 'native' / manifest['groundRebel']['model']), '-o', str(arms_gltf), '-d', '--game', str(info), '--gltf_export_format', 'gltf', '--gltf_export_materials', '--gltf_textures_adapt', '--gltf_mesh_list', 'firstperson_default_gloves_arms,firstperson_sleeves', '--gltf_export_animations', '--gltf_animation_list', 'idle_rifle'], stdout=log, stderr=log, check=True)
doc = json.loads(gltf.read_text())
doc['animations'] = [a for a in doc['animations'] if '/world/' in a['name']]
# Strip channels targeting unrelated weapon skeletons; keep the coordinate basis
# rotation on root_motion while the runtime simulates translation separately.
body_nodes = set(doc['skins'][0]['joints'])
for animation in doc['animations']:
    animation['name'] = animation['name'].split('/')[-1]
    animation['channels'] = [c for c in animation['channels'] if c['target']['node'] in body_nodes]
gltf.write_text(json.dumps(doc))

archive = cache / 'idf.zip'
if not archive.exists():
    page = download(manifest['idf']['mirror'], cache / 'idf-page.html').read_text()
    page = page.replace('\\"', '"').replace('\\u0026', '&')
    url = re.search(r'"id":287064,"file":"([^"]+)', page)
    if not url:
        raise ValueError('IDF mirror changed; download the archive from the recorded source into ' + str(archive))
    download(url.group(1), archive, manifest['idf']['archiveSha256'])
else:
    download('', archive, manifest['idf']['archiveSha256'])
with zipfile.ZipFile(archive) as bundle:
    raw = bundle.read(next(n for n in bundle.namelist() if n.endswith('.gma')))
if not raw.startswith(b'GMAD'):
    raw = lzma.decompress(raw)
import io
stream = io.BytesIO(raw)
assert stream.read(4) == b'GMAD'
stream.read(17)
def cstring():
    text = bytearray()
    while True:
        byte = stream.read(1)
        if byte == b'\0':
            return text.decode()
        if not byte:
            raise ValueError('Truncated GMA string')
        text.extend(byte)
for _ in range(4):
    cstring()
stream.read(4)
entries = []
while struct.unpack('<I', stream.read(4))[0]:
    name = cstring()
    size = struct.unpack('<Q', stream.read(8))[0]
    stream.read(4)
    entries.append((name, size))
for name, size in entries:
    dest = (cache / 'idf-source' / name).resolve()
    if not dest.is_relative_to(cache / 'idf-source'):
        raise ValueError('Unsafe archive path')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(stream.read(size))

sourceio_zip = download('https://github.com/REDxEYE/SourceIO/archive/' + manifest['tools']['SourceIOCommit'] + '.zip', cache / 'sourceio.zip')
sourceio = cache / 'SourceIO'
if not sourceio.exists():
    with zipfile.ZipFile(sourceio_zip) as bundle:
        folder = bundle.namelist()[0].split('/')[0]
        bundle.extractall(cache)
    (cache / folder).rename(sourceio)
idf_glb = cache / 'idf.glb'
subprocess.run([args.blender, '-b', '-t', '2', '--python', str(root / 'scripts/convert-agent-rig.py'), '--', str(gltf), str(cache / 'idf-source'), str(sourceio), str(idf_glb)], check=True)
if not idf_glb.exists():
    raise RuntimeError('Blender did not produce the IDF model; inspect its Python error output')
for source, name in [(gltf, 'ground-rebel'), (idf_glb, 'idf')]:
    subprocess.run([sys.executable, str(root / 'scripts/pack-agents.py'), str(source), str(root / f'packages/assets/public/models/agents/{name}.glb')], check=True)

idf_arms = cache / 'idf-arms.glb'
subprocess.run([args.blender, '-b', '-t', '2', '--python', str(root / 'scripts/convert-view-arms.py'), '--', str(idf_glb), str(idf_arms)], check=True)
rebel_arms = cache / 'ground-rebel-arms.glb'
subprocess.run([args.blender, '-b', '-t', '2', '--python', str(root / 'scripts/convert-view-arms.py'), '--', str(arms_gltf), str(rebel_arms)], check=True)
for source, name in [(rebel_arms, 'ground-rebel-arms'), (idf_arms, 'idf-arms')]:
    subprocess.run([sys.executable, str(root / 'scripts/pack-agents.py'), str(source), str(root / 'packages/assets/public/models/agents' / (name + '.glb'))], check=True)
