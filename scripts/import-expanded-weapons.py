"""Import all additional default-finish weapons and native clips from CSGOSKINS.GG v6.
Run: python3 scripts/import-expanded-weapons.py
Uses the same material conversion as import-csgoskins.py; leaves original inputs intact.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('assets', Path(__file__).with_name('import-csgoskins.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
WEAPONS = [('glock', 'glock18', 'glock'), ('deagle', 'deagle', 'deagle'),
           ('m4a4', 'm4a4', 'm4a4'), ('nova', 'nova', 'nova'), ('mp9', 'mp9', 'mp9')] + [(name, name, name) for name in
    'hkp2000 p250 fiveseven tec9 cz75a revolver elite famas galilar aug sg556 ssg08 scar20 g3sg1 mac10 mp7 mp5sd ump45 p90 bizon xm1014 mag7 sawedoff m249 negev'.split()]

def download(path):
    for attempt in range(3):
        try:
            return a.download(path)
        except subprocess.CalledProcessError:
            if attempt == 2: raise

def main():
    dest = ROOT / 'packages/assets/public/models/viewmodels'
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--weapons', nargs='+')
    args = parser.parse_args()
    manifest = dest / 'expanded-source.json'
    records = json.loads(manifest.read_text())['weapons'] if args.weapons and manifest.exists() else []
    for name, folder, suffix in WEAPONS:
        if args.weapons and name not in args.weapons: continue
        path = f'assets/weapons/models/{folder}_legacy/mesh.glb'
        source = download(path)
        doc, blob = a.read_glb(source)
        textures = a.pack_materials(doc, blob)
        doc.pop('animations', None)
        a.write_glb(dest / (name + '.glb'), doc, blob)
        record = {'weapon': name, 'model': a.BASE + path,
                  'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'textures': textures, 'clips': []}
        clips = dest / name
        clips.mkdir(exist_ok=True)
        native_clips = [Path(clip).stem for clip in doc.get('asset', {}).get('extras', {}).get('clips', [])]
        actions = ['idle', 'draw', 'reload', 'shoot1', 'lookat01']
        if name == 'elite': actions.append('shoot2')
        if name == 'revolver': actions += ['prepare', 'shoot2']
        for action in actions:
            prefix = {'shoot1': 'shoot_left1', 'shoot2': 'shoot_right1'}.get(action, action) if name == 'elite' else {'prepare': 'prepare_shoot', 'shoot2': 'shoot_alt1'}.get(action, action)
            matches = [clip for clip in native_clips if clip.startswith(prefix + '_')]
            if not matches and action == 'idle': matches = [clip for clip in native_clips if clip.startswith('idle1_')]
            if not matches: raise ValueError((name, action, native_clips))
            matches.sort(key=lambda clip: (clip != prefix + '_' + suffix, len(clip), clip))
            path = f'assets/weapons/anims/{folder}/{matches[0]}.glb'
            source = download(path)
            (clips / (action + '.glb')).write_bytes(source.read_bytes())
            record['clips'].append({'name': action, 'url': a.BASE + path,
                                    'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
        if args.weapons and manifest.exists(): records = json.loads(manifest.read_text())['weapons']
        records = [r for r in records if r['weapon'] != name]
        records.append(record)
        manifest.write_text(json.dumps({'generator': 'python3 scripts/import-expanded-weapons.py', 'weapons': records}, indent=2) + '\n')
        print('Imported', name, flush=True)
    (dest / 'expanded-source.json').write_text(json.dumps({
        'generator': 'python3 scripts/import-expanded-weapons.py',
        'source': 'Valve default-finish weapon models and native animations served by the public CSGOSKINS.GG v6 viewer.',
        'weapons': records}, indent=2) + '\n')

if __name__ == '__main__':
    main()
