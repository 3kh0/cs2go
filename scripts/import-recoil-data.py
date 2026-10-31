#!/usr/bin/env python3
"""Import CS2 recoil inputs. Runtime algorithm parity is not implied by these values."""
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
    'seed': 'm_nRecoilSeed',
    'angle': 'm_flRecoilAngle',
    'angleVariance': 'm_flRecoilAngleVariance',
    'magnitude': 'm_flRecoilMagnitude',
    'magnitudeVariance': 'm_flRecoilMagnitudeVariance',
    'cycleTime': 'm_flCycleTime',
    'fullAuto': 'm_bIsFullAuto',
    'recoveryStand': 'm_flRecoveryTimeStand',
    'recoveryCrouch': 'm_flRecoveryTimeCrouch',
    'recoveryStandFinal': 'm_flRecoveryTimeStandFinal',
    'recoveryCrouchFinal': 'm_flRecoveryTimeCrouchFinal',
    'recoveryTransitionStart': 'm_nRecoveryTransitionStartBullet',
    'recoveryTransitionEnd': 'm_nRecoveryTransitionEndBullet',
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
            row[key] = json.loads(values.get(field, 'false' if key == 'fullAuto' else '0'))
        for key in ['angle', 'angleVariance', 'magnitude', 'magnitudeVariance', 'cycleTime']:
            if not isinstance(row[key], list):
                row[key] = [row[key], row[key]]
        entries.append(row)
    out = ROOT / 'packages/simulation/src/data/recoil.json'
    out.write_text(json.dumps({
        'source': url, 'commit': stats.COMMIT,
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'scope': 'Shipped parameters only; generator, punch integration and recoil-index recovery remain a documented reconstruction, not verified CS2 runtime parity.',
        'weapons': entries,
    }, indent=2) + '\n')
    print(f'Imported {len(entries)} recoil parameter sets to {out}')

if __name__ == '__main__':
    main()
