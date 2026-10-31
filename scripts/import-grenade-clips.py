"""Export pinned native grenade first-person motion, including both skeletons.
Requires cached pinned Steam archive473 and existing Source2Viewer CLI.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import subprocess
ROOT = Path(__file__).resolve().parents[1]
VPK = ROOT / 'artifacts/c4-import/depot/game/csgo/pak01_dir.vpk'
CLI = ROOT / 'artifacts/source2viewer/Source2Viewer-CLI'
OUT = ROOT / 'packages/assets/public/models/grenades/clips'
CACHE = ROOT / 'artifacts/grenade-clips'
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
if hashlib.sha256(VPK.read_bytes()).hexdigest() != '48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad':
    raise ValueError('VPK directory does not match pinned CS2 depot')
if not (VPK.parent / 'pak01_473.vpk').exists():
    listing = CACHE / 'files.txt'
    listing.write_text('game/csgo/pak01_473.vpk\n')
    subprocess.run([str(ROOT / 'artifacts/cs2-dust-import/tools/DepotDownloader'), '-app', '730', '-depot', '2347770', '-manifest', '4758919807587010422', '-os', 'windows', '-filelist', str(listing), '-dir', str(ROOT / 'artifacts/c4-import/depot'), '-validate'], check=True)
folders = {'he': ('grenade_hegrenade', 'hegrenade'), 'flash': ('grenade_flashbang', 'flashbang'), 'smoke': ('grenade_smokegrenade', 'smoke'), 'molotov': ('grenade_molotov', 'molotov'), 'incendiary': ('grenade_incendiary', 'incendiary'), 'decoy': ('_default_grenade', 'grenade')}
actions = ['idle', 'draw', 'pullpin', 'throw_overhand', 'throw_underhand', 'throwcharge_high', 'throwcharge_mid', 'throwcharge_low']
def export(job):
    kind, action = job
    folder, suffix = folders[kind]
    resource = f'animation/anims/viewmodel/grenade/{folder}/{action}_{suffix}.vnmclip_c'
    output = OUT / kind / f'{action}.glb'
    output.parent.mkdir(exist_ok=True)
    raw = CACHE / f'{kind}-{action}.vnmclip_c'
    subprocess.run([str(CLI), '-i', str(VPK), '-f', resource, '-o', str(raw)], check=True, stdout=subprocess.DEVNULL)
    data = subprocess.check_output([str(CLI), '-i', str(raw), '-b', 'DATA'], text=True)
    duration = float(re.search(r'm_flDuration = ([0-9.]+)', data)[1])
    events = [{'name': name, 'time': float(at) * duration} for at, name in re.findall(r'_class = "CNmSoundEvent".*?m_flStartTime =\s*\{\s*m_flValue = ([0-9.]+).*?m_name = "([^"]+)"', data, re.S)]
    subprocess.run([str(CLI), '-i', str(VPK), '-f', resource, '-d', '--gltf_export_format', 'glb', '-o', str(output)], check=True, stdout=subprocess.DEVNULL)
    return {'kind': kind, 'action': action, 'resource': resource, 'sha256': hashlib.sha256(raw.read_bytes()).hexdigest(), 'runtimeSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'duration': duration, 'events': events}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    entries = list(pool.map(export, [(kind, action) for kind in folders for action in actions]))
(OUT / 'source.json').write_text(json.dumps({'author': 'Valve', 'depot': 2347770, 'manifest': '4758919807587010422', 'generator': 'scripts/import-grenade-clips.py', 'inputs': entries, 'limitations': 'Native viewmodel and weapon skeleton motion. Decoy uses the shared default grenade animation; exact native game animation graph blending and gameplay event scheduling are reconstructed.'}, indent=2) + '\n')
