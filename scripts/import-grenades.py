"""Import six native grenade models from pinned Steam depot 4758919807587010422.
Uses the same cached depot, dependency fetcher and self-contained WebP packer as C4.
Original VPKs stay intact; first-person clips are imported separately by import-grenade-clips.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/c4-import'
OUT = ROOT / 'packages/assets/public/models/grenades'
EXPORT = ROOT / 'artifacts/grenade-models'
MODELS = {'he': ('hegrenade', 'hegrenade'), 'flash': ('flashbang', 'flashbang'),
          'smoke': ('smokegrenade', 'smokegrenade'), 'molotov': ('molotov', 'molotov'),
          'incendiary': ('incendiary', 'incendiarygrenade'), 'decoy': ('decoy', 'decoy')}
if hashlib.sha256((CACHE / 'depot/game/csgo/pak01_dir.vpk').read_bytes()).hexdigest() != '48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad':
    raise ValueError('VPK directory does not match pinned CS2 depot')
resources = {kind: f'weapons/models/grenade/{folder}/weapon_{name}.vmdl_c' for kind, (folder, name) in MODELS.items()}
subprocess.run([sys.executable, str(ROOT / 'scripts/fetch-cs2-dependencies.py'), str(CACHE),
                str(ROOT / 'artifacts/cs2-dust-import/tools/DepotDownloader'), *resources.values()], check=True)
OUT.mkdir(parents=True, exist_ok=True)
EXPORT.mkdir(parents=True, exist_ok=True)
entries = []
for kind, resource in resources.items():
    target = EXPORT / f'{kind}.gltf'
    subprocess.run([str(ROOT / 'artifacts/source2viewer/Source2Viewer-CLI'), '-i', str(CACHE / 'depot/game/csgo/pak01_dir.vpk'),
                    '-f', resource, '-d', '--gltf_export_format', 'gltf', '--gltf_export_materials', '--gltf_textures_adapt',
                    '--gltf_export_animations', '-o', str(target)], check=True)
    subprocess.run([sys.executable, str(ROOT / 'scripts/pack-agents.py'), str(target), str(OUT / f'{kind}.glb')], check=True)
    entries.append({'kind': kind, 'resource': resource,
                    'sourceSha256': hashlib.sha256((CACHE / 'extracted' / resource).read_bytes()).hexdigest(),
                    'runtimeSha256': hashlib.sha256((OUT / f'{kind}.glb').read_bytes()).hexdigest()})
(OUT / 'source.json').write_text(json.dumps({'author': 'Valve', 'depot': 2347770, 'manifest': '4758919807587010422',
    'generator': 'scripts/import-grenades.py', 'processing': 'Source2Viewer exports in meters; self-contained WebP textures capped at 1024px.',
    'limitations': 'Native grenade body meshes and materials; first-person hands are retargeted to separately imported native clips. Animation graph transitions and gameplay release scheduling remain reconstructed. Three.js PBR approximates native materials.',
    'models': entries}, indent=2) + '\n')
