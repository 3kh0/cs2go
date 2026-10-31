"""Import explicit shipped grenade inputs, not an inferred native solver."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from subprocess import check_output
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('weapon_stats', ROOT / 'scripts/import-weapon-stats.py')
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)
paths = {'convars': 'DumpSource2/convars.txt', 'weapons': 'game/csgo/pak01_dir/scripts/weapons.vdata',
         'competitive': 'game/csgo/cfg/gamemode_competitive.cfg', 'casual': 'game/csgo/cfg/gamemode_casual.cfg'}
texts = {}
sources = {}
for name, path in paths.items():
    raw = check_output(['curl', '-fLsS', '--retry', '3', stats.BASE + path])
    texts[name] = raw.decode()
    sources[name] = {'url': stats.BASE + path, 'sha256': hashlib.sha256(raw).hexdigest()}
keys = ['inferno_damage', 'inferno_damage_ct', 'inferno_damage_timer', 'inferno_flame_lifetime',
        'inferno_flame_lifetime_incendiary', 'inferno_flame_spacing', 'inferno_max_flames',
        'inferno_max_range', 'inferno_max_range_ct', 'molotov_throw_detonate_time',
        'weapon_molotov_maxdetonateslope', 'inferno_friendly_fire_duration']
convars = {}
for key in keys:
    match = re.search(r'^' + re.escape(key) + r' ([0-9.]+) \(', texts['convars'], re.M)
    if not match: raise ValueError(f'Missing convar {key}')
    convars[key] = float(match[1])
match = re.search(r'^ff_damage_decoy_explosion (true|false) \(', texts['convars'], re.M)
if not match: raise ValueError('Missing ff_damage_decoy_explosion')
convars['ff_damage_decoy_explosion'] = match[1] == 'true'
modes = {}
for mode in ['competitive', 'casual']:
    modes[mode] = {}
    for key in ['ff_damage_reduction_grenade', 'ff_damage_reduction_grenade_self', 'ff_damage_reduction_other']:
        match = re.search(r'^' + key + r'\s+([0-9.]+)', texts[mode], re.M)
        if not match: raise ValueError(f'Missing {mode}:{key}')
        modes[mode][key] = float(match[1])
weapons = {}
for kind, slug in {'he': 'hegrenade', 'flash': 'flashbang', 'smoke': 'smokegrenade', 'molotov': 'molotov', 'incendiary': 'incgrenade', 'decoy': 'decoy'}.items():
    block = stats.extract_block(texts['weapons'], 'weapon_' + slug)
    weapons[kind] = {}
    for key in ['m_nPrice', 'm_nDamage', 'm_flRange', 'm_flArmorRatio', 'm_flThrowVelocity']:
        match = re.search(r'^\t\t' + key + r' = ([0-9.]+)', block, re.M)
        if not match: raise ValueError(f'Missing {slug}:{key}')
        weapons[kind][key] = float(match[1])
out = ROOT / 'packages/simulation/src/data/utility.json'
out.write_text(json.dumps({'commit': stats.COMMIT, 'sources': sources, 'convars': convars, 'modes': modes, 'weapons': weapons,
    'scope': 'Explicit shipped parameters. Weapon damage/armor/range fields are recorded as evidence but do not establish native blast falloff or armor dispatch. Projectile integration, bounce solver, fire layout and damage sampling remain browser reconstructions.'}, indent=2) + '\n')
print(f'Imported {len(convars)} convars, {len(weapons)} grenades and two mode overrides')
