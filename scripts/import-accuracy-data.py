#!/usr/bin/env python3
"""Import shipped accuracy inputs; runtime formula parity is not implied."""
import hashlib
import importlib.util
import json
import re
from pathlib import Path
from subprocess import check_output

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('weapon_stats_import', ROOT / 'scripts/import-weapon-stats.py')
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)
FIELDS = {
    'stand': 'm_flInaccuracyStand', 'crouch': 'm_flInaccuracyCrouch',
    'move': 'm_flInaccuracyMove', 'fire': 'm_flInaccuracyFire',
    'jump': 'm_flInaccuracyJump', 'land': 'm_flInaccuracyLand',
    'ladder': 'm_flInaccuracyLadder', 'spread': 'm_flSpread',
    'maxSpeed': 'm_flMaxSpeed',
}

def main():
    url = stats.BASE + 'game/csgo/pak01_dir/scripts/weapons.vdata'
    source_bytes = check_output(['curl', '-LfsS', '--retry', '3', url])
    source = source_bytes.decode()
    entries = []
    for index, slug in enumerate(stats.SLUGS):
        block = stats.extract_block(source, 'weapon_' + slug)
        values = dict(re.findall(r'^\t\t(m_\w+) = ([^\n]+)', block, re.M))
        row = {'id': index, 'slug': slug}
        for key, field in FIELDS.items():
            if field not in values and slug != 'knife':
                raise ValueError(f'{slug}: missing {field}')
            value = json.loads(values.get(field, '0'))
            row[key] = value if isinstance(value, list) else [value, value]
        entries.append(row)
        for key, field in {'jumpInitial': 'm_flInaccuracyJumpInitial', 'jumpApex': 'm_flInaccuracyJumpApex', 'reload': 'm_flInaccuracyReload'}.items():
            if field not in values and slug != 'knife':
                raise ValueError(f'{slug}: missing {field}')
            row[key] = json.loads(values.get(field, '0'))
    convar_url = stats.BASE + 'DumpSource2/convars.txt'
    convar_bytes = check_output(['curl', '-LfsS', '--retry', '3', convar_url])
    convars = convar_bytes.decode()
    defaults = {}
    for key in ['weapon_air_spread_scale', 'weapon_accuracy_stack_boost_limit', 'weapon_accuracy_reset_on_deploy', 'weapon_accuracy_shotgun_spread_patterns', 'sv_jump_impulse']:
        defaults[key] = json.loads(re.search(r'^' + key + r' ([^ ]+) ', convars, re.M).group(1))
    out = ROOT / 'packages/simulation/src/data/accuracy.json'
    out.write_text(json.dumps({
        'source': url, 'commit': stats.COMMIT,
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'convarSource': convar_url, 'convarSourceSha256': hashlib.sha256(convar_bytes).hexdigest(),
        'defaults': defaults,
        'scope': 'Shipped weapon inputs. Movement interpolation, airborne contribution and recovery integration are reconstructed; exact CS2 runtime parity is unverified.',
        'weapons': entries,
    }, indent=2) + '\n')
    print(f'Imported {len(entries)} accuracy parameter sets to {out}')

if __name__ == '__main__':
    main()
