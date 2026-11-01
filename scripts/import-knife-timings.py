"""Pin native knife frame intervals to the bundled GLB inputs.

python3 scripts/import-knife-timings.py /path/to/Windows/timing-roster.json
The Windows audit's reproducible extraction and compiled resource hashes must
accompany this input. Original meshes, animation values and GLBs are untouched.
"""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    path = Path(sys.argv[1])
    source = json.loads(path.read_text(encoding='utf-8-sig'))
    identity = json.loads((path.parent / 'identity.json').read_text(encoding='utf-8-sig'))
    manifest = json.loads((path.parent / 'asset-manifest.json').read_text(encoding='utf-8-sig'))
    fingerprints = {entry['path']: entry['sha256'] for entry in manifest}
    definitions = json.loads(subprocess.check_output([
        'bun', '-e', 'import {knifeDefinitions} from "./packages/protocol/src/armory.ts"; '
                    'console.log(JSON.stringify(knifeDefinitions))',
    ], cwd=ROOT))
    records = {}
    for knife in definitions:
        directory = ROOT / 'packages/assets/public/models/animations'
        files = sorted((directory / 'bayonet').glob('*.glb')) if knife['id'] == 4 else [directory / 'knives' / (knife['icon'] + '.glb')]
        for file in files:
            raw = file.read_bytes()
            size = struct.unpack_from('<I', raw, 12)[0]
            doc, blob = json.loads(raw[20:20 + size]), raw[28 + size:]
            for animation in doc['animations']:
                name = animation['name']
                if not name.startswith('animation/'):
                    continue
                resource = name.removesuffix('.vnmclip_c').removesuffix('.vnmclip') + '.vnmclip_c'
                native = source['clips'][resource]
                native_bytes = (path.parent / 'native' / resource).read_bytes()
                if hashlib.sha256(native_bytes).hexdigest() != fingerprints[resource]:
                    raise ValueError(f'Native resource fingerprint mismatch: {resource}')
                if not native['secondary_timing_matches']:
                    raise ValueError(f'Unsynchronized native weapon skeleton: {resource}')
                frames, duration = native['frames'], native['duration']
                if frames < 2 or duration <= 0:
                    raise ValueError(f'Invalid native interval: {resource}')
                action = re.match(r'^(idle\d*|draw\d*|lookat\d+(?:_draw)?|(?:light|heavy)_(?:hit|miss)\d+)(?:_|$)', name.split('/')[-1])[1]
                if action == 'idle':
                    action = 'idle1'
                times = []
                for sampler in animation['samplers']:
                    accessor = doc['accessors'][sampler['input']]
                    if accessor['componentType'] != 5126:
                        raise ValueError(f'Unexpected time accessor: {resource}')
                    view = doc['bufferViews'][accessor['bufferView']]
                    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                    times.extend(struct.unpack_from('<' + 'f' * accessor['count'], blob, offset))
                # Older exporters used duration/N instead of duration/(N-1).
                # Compare all keys with both grids, including optimized tracks
                # that stop early. Never stretch a clip by its last key alone.
                def score(divisor):
                    step = duration / divisor
                    return max(abs(t / step - round(t / step)) for t in times)
                current, old = score(frames - 1), score(frames)
                scale = frames / (frames - 1) if old + 0.0001 < current else 1
                if min(current, old) > 0.005:
                    raise ValueError(f'Timebase does not match native frames: {resource}: {current}, {old}')
                if max(times) * scale > duration + 0.0001:
                    raise ValueError(f'Clip extends beyond native duration: {resource}')
                records[f'{knife["id"]}/{action}'] = {
                    'duration': duration, 'timeScale': scale, 'frames': frames,
                    'inspectBlockedUntil': max((event['m_flStartTime']['m_flValue'] + event['m_flDuration']['m_flValue']
                        for event in native['events'] if event.get('m_ID') == 'WPN_BLOCK_INSPECT'), default=0) * duration,
                    'resource': resource, 'nativeSha256': fingerprints[resource],
                    'input': str(file.relative_to(ROOT)),
                    'inputSha256': hashlib.sha256(raw).hexdigest(),
                }
    output = ROOT / 'packages/simulation/src/data/knife-animations.json'
    output.write_text(json.dumps({
        'source': 'Installed CS2 native knife clip timing audit on the Windows Amp runner',
        'nativeManifestSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'generator': 'python3 scripts/import-knife-timings.py /path/to/timing-roster.json',
        'provenance': identity,
        'processing': 'Restore native duration/(frames-1) sample intervals where older exporters used duration/frames. '
                      'Preserve optimized trailing holds and synchronize primary/secondary tracks. Base clip speed 1.0; '
                      'combat recovery is independent. Native conditional graph transitions are not fully reproduced.',
        'clips': records,
    }, indent=2) + '\n')
    print(f'{len(records)} native knife action timings; {sum(r["timeScale"] != 1 for r in records.values())} restored timebases')


if __name__ == '__main__':
    main()
