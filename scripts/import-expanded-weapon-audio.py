"""Bundle all added firearms' mono clips from the existing pinned CS:GO source.
Run: python3 scripts/import-expanded-weapon-audio.py (curl and FFmpeg required).
CS:GO recordings are an approximation of CS2 audio; original inputs are untouched.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '08f1bd6835d4f510d2ccaedeab6bb9f637b388ab'
FILES = {
    'glock18': ['glock18-1', 'glock_clipout', 'glock_clipin', 'glock_slideback', 'glock_sliderelease', 'glock_draw'],
    'deagle': ['deagle-1', 'de_clipout', 'de_clipin', 'de_slideback', 'de_slideforward', 'de_draw'],
    'm4a1': ['m4a1-1', 'm4a1_boltback', 'm4a1_boltforward'],
    'nova': ['nova-1', 'nova_insertshell', 'nova_pump', 'nova_draw'],
    'mp9': ['mp9-1', 'mp9_clipout', 'mp9_clipin', 'mp9_boltback', 'mp9_boltforward', 'mp9_draw'],
}
# CZ75-Auto shares P250 action clips: the pinned archive supplies only its shots.
FILES.update({'hkp2000': ['hkp2000-1',
             'hkp2000_clipout',
             'hkp2000_clipin',
             'hkp2000_slideback',
             'hkp2000_sliderelease',
             'hkp2000_draw'],
 'p250': ['p250-1',
          'p250_clipout',
          'p250_clipin',
          'p250_slideback',
          'p250_sliderelease',
          'p250_draw'],
 'fiveseven': ['fiveseven-1',
               'fiveseven_clipout',
               'fiveseven_clipin',
               'fiveseven_slideback',
               'fiveseven_sliderelease',
               'fiveseven_draw'],
 'tec9': ['tec9-1',
          'tec9_clipout',
          'tec9_clipin',
          'tec9_boltpull',
          'tec9_boltrelease',
          'tec9_draw'],
 'cz75a': ['cz75a-1'],
 'revolver': ['revolver-1_01',
              'revolver_clipout',
              'revolver_clipin',
              'revolver_sideback',
              'revolver_siderelease',
              'revolver_draw'],
 'elite': ['elite-1', 'elite_clipout', 'elite_leftclipin', 'elite_sliderelease', 'elite_draw'],
 'famas': ['famas-1',
           'famas_clipout',
           'famas_clipin',
           'famas_boltback',
           'famas_boltforward',
           'famas_draw'],
 'galilar': ['galil-1',
             'galil_clipout',
             'galil_clipin',
             'galil_boltback',
             'galil_boltforward',
             'galil_draw'],
 'aug': ['aug-1', 'aug_clipout', 'aug_clipin', 'aug_boltpull', 'aug_boltrelease', 'aug_draw'],
 'sg556': ['sg556-1',
           'sg556_clipout',
           'sg556_clipin',
           'sg556_boltback',
           'sg556_boltforward',
           'sg556_draw'],
 'ssg08': ['ssg08-1',
           'ssg08_clipout',
           'ssg08_clipin',
           'ssg08_boltback',
           'ssg08_boltforward',
           'ssg08_draw'],
 'scar20': ['scar20_01',
            'scar20_clipout',
            'scar20_clipin',
            'scar20_boltback',
            'scar20_boltforward',
            'scar20_draw'],
 'g3sg1': ['g3sg1-1',
           'g3sg1_clipout',
           'g3sg1_clipin',
           'g3sg1_slideback',
           'g3sg1_slideforward',
           'g3sg1_draw'],
 'mac10': ['mac10-1',
           'mac10_clipout',
           'mac10_clipin',
           'mac10_boltback',
           'mac10_boltforward',
           'mac10_draw'],
 'mp7': ['mp7-1', 'mp7_clipout', 'mp7_clipin', 'mp7_slideback', 'mp7_slideforward', 'mp7_draw'],
 'mp5': ['mp5_01', 'mp5_clipout', 'mp5_clipin', 'mp5_slideback', 'mp5_slideforward', 'mp5_draw'],
 'ump45': ['ump45-1',
           'ump45_clipout',
           'ump45_clipin',
           'ump45_boltback',
           'ump45_boltforward',
           'ump45_draw'],
 'p90': ['p90-1', 'p90_clipout', 'p90_clipin', 'p90_boltback', 'p90_boltforward', 'p90_draw'],
 'bizon': ['bizon-1',
           'bizon_clipout',
           'bizon_clipin',
           'bizon_boltback',
           'bizon_boltforward',
           'bizon_draw'],
 'xm1014': ['xm1014-1', 'xm1014_insertshell', 'xm1014_pump', 'xm1014_draw'],
 'mag7': ['mag7-1',
          'mag7_clipout',
          'mag7_clipin',
          'mag7_pump_back',
          'mag7_pump_forward',
          'mag7_draw'],
 'sawedoff': ['sawedoff-1', 'sawedoff_insertshell', 'sawedoff_pump', 'sawedoff_draw'],
 'm249': ['m249-1', 'm249_boxout', 'm249_boxin', 'm249_pump', 'm249_draw'],
 'negev': ['negev-1', 'negev_boxout', 'negev_boxin', 'negev_pump', 'negev_draw']})
OUT = ROOT / 'packages/assets/public/audio'
MANIFEST = OUT / 'expanded-source.json'
PREVIOUS = {c['name']: c for c in json.loads(MANIFEST.read_text())['clips']} if MANIFEST.exists() else {}

def convert(item):
    folder, name = item
    relative = f'sound/weapons/{folder}/{name}.wav'
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / f'{name}.wav'
        subprocess.run(['curl', '-fLs', '--retry', '3', f'https://raw.githubusercontent.com/sourcesounds/csgo/{COMMIT}/{relative}', '-o', str(source)], check=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        destination = OUT / f'{name}.ogg'
        if destination.exists() and PREVIOUS.get(name, {}).get('sha256') == digest:
            return {'name': name, 'source': relative, 'sha256': digest, 'bytes': destination.stat().st_size}
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(source), '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '96k', str(destination)], check=True)
    return {'name': name, 'source': relative, 'sha256': digest, 'bytes': destination.stat().st_size}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    clips = list(pool.map(convert, [(folder, name) for folder, names in FILES.items() for name in names]))
(OUT / 'expanded-source.json').write_text(json.dumps({'repository': 'https://github.com/sourcesounds/csgo', 'commit': COMMIT, 'encoding': 'mono Opus 96 kbps, 48 kHz', 'clips': clips}, indent=2) + '\n')
print(f'Imported {len(clips)} clips; {sum(c["bytes"] for c in clips)} bytes')
