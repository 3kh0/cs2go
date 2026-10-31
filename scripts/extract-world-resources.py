"""Read-only targeted native gameplay resource extraction and KV3 evidence parsing."""
import json
from pathlib import Path
import re
import subprocess
import sys
import zlib

import argparse
import importlib.util

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, required=True, help='Scratch root containing vendor/, native/ and fast-output/')
parser.add_argument('--game', type=Path, required=True, help='Read-only game/csgo directory')
parser.add_argument('--cli', type=Path, required=True)
args = parser.parse_args()
ROOT = args.root.resolve()
HERE = ROOT / 'fast-output' / 'gameplay'
sys.dont_write_bytecode = True
saved_argv = sys.argv
sys.argv = ['extract-buy-poses.py', '--root', str(ROOT)]
spec = importlib.util.spec_from_file_location('cs2_native_pose_helpers', Path(__file__).with_name('extract-buy-poses.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
sys.argv = saved_argv
write_json = helpers.write_json
digest = helpers.digest
sys.path.insert(0, str(ROOT / 'vendor'))
from srctools.vpk import VPK


GAME = args.game.resolve()
CLI = args.cli.resolve()


def read_text(path):
    data = path.read_bytes()
    return data.decode('utf-16' if data[:2] == b'\xff\xfe' else 'utf-8-sig')


def kv3(text):
    """Parse the text DATA subset emitted by this CLI; reject unconsumed tokens."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|[{}\[\]=,:]|[^\s{}\[\]=,:]+', text)
    pos = 0

    def value():
        nonlocal pos
        token = tokens[pos]
        pos += 1
        if token == '#':
            assert tokens[pos] == '['
            pos += 1
            raw = []
            while tokens[pos] != ']':
                raw.append(tokens[pos])
                pos += 1
            pos += 1
            return {'hexBytes': ''.join(raw)}
        if token == '{':
            obj = {}
            while tokens[pos] != '}':
                key = tokens[pos]
                pos += 1
                assert tokens[pos] == '=', (pos, tokens[pos:pos+4])
                pos += 1
                obj[key] = value()
                if tokens[pos] == ',':
                    pos += 1
            pos += 1
            return obj
        if token == '[':
            arr = []
            while tokens[pos] != ']':
                arr.append(value())
                if tokens[pos] == ',':
                    pos += 1
            pos += 1
            return arr
        if pos < len(tokens) and tokens[pos] == ':':
            pos += 1
            return value()
        if token.startswith('"'):
            return json.loads(token)
        if token in ('true', 'false', 'null'):
            return {'true': True, 'false': False, 'null': None}[token]
        try:
            return float(token) if any(c in token for c in '.eE') else int(token, 0)
        except ValueError:
            return token

    result = value()
    assert pos == len(tokens), (pos, tokens[pos:pos+10])
    return result


def dump(path):
    dest = HERE / 'data' / path.relative_to(HERE / 'native').with_suffix('.txt')
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        run = subprocess.run([str(CLI), '-i', str(path), '-b', 'DATA'], capture_output=True, check=True)
        dest.write_bytes(run.stdout)
    text = read_text(dest)
    start = text.index('<!-- kv3')
    obj = kv3(text[start:])
    target = HERE / 'data-json' / path.relative_to(HERE / 'native').with_suffix('.json')
    write_json(target, obj)
    return obj


def main():
    inventory = {}
    for line in read_text(ROOT / 'vpk-list.txt').splitlines():
        m = re.match(r'(.+) CRC:([0-9a-f]+) size:(\d+)', line)
        if m:
            inventory[m[1]] = {'crc32': int(m[2], 16), 'bytes': int(m[3])}
    selected = {p for p in inventory if re.match(r'animation/anims/world/(rifle|pistol)/[^/]+/idle[^/]*\.vnmclip', p)}
    selected |= {p for p in inventory if re.match(r'animation/anims/world/(rifle|pistol)/(?!_default)[^/]+/draw_(?!crouch)[^/]+\.vnmclip_c$', p)}
    selected |= {p for p in inventory if p.startswith('animation/graphs/worldmodel/') and
                 ('worldmodel_gun' in p or 'worldmodel_locomotion' in p or p.endswith('/worldmodel.vnmgraph_c'))}
    selected.add('animation/skeletons/characters/worldmodel.vnmskel_c')
    selected.add('agents/models/tm_leet/tm_leet_variantg.vmdl_c')
    archive = VPK(GAME / 'pak01_dir.vpk', mode='r')
    evidence = []

    def extract(name):
        path = HERE / 'native' / name
        entry = archive[name]
        data = entry.read()
        crc = zlib.crc32(data)
        assert crc == entry.crc == inventory[name]['crc32']
        assert len(data) == inventory[name]['bytes']
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            assert path.read_bytes() == data
        else:
            path.write_bytes(data)
        evidence.append({'resource': name, 'crc32': f'{crc:08x}', 'sha256': digest(path),
                         'bytes': len(data), 'archiveIndex': entry.arch_index, 'archiveOffset': entry.offset})
        return path

    for name in sorted(selected):
        extract(name)
    skeletons = set()
    for path in sorted((HERE / 'native/animation/anims').rglob('*.vnmclip_c')):
        data = dump(path)
        for name in re.findall(r'animation/skeletons/[^"\s]+\.vnmskel', json.dumps(data)):
            skeletons.add(name + '_c')
    for name in sorted(skeletons - selected):
        extract(name)
    for path in sorted((HERE / 'native/animation/graphs').rglob('*.vnmgraph_c')):
        dump(path)
    for path in sorted((HERE / 'native/animation/skeletons').rglob('*.vnmskel_c')):
        dump(path)
    write_json(HERE / 'resource-provenance.json', evidence)
    print('Resources CRC-verified:', len(evidence), 'clips:', len(list((HERE/'native/animation/anims').rglob('*.vnmclip_c'))))


if __name__ == '__main__':
    main()
