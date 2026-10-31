"""Import three pinned installed DE clips and repair six verified clip timebases.

Requires Source2Viewer CLI 20.1.7467 and srctools 2.7.0 (or --vendor).
The installed game is read-only; all extraction/exports go to --cache.
Run after the historical viewer importers, which retain their original provenance.
"""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import sys
import zlib

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'packages/assets/public/models/viewmodels'
PREFIX = 'animation/anims/viewmodel/'
# target, native resource, compiled SHA-256, original viewer GLB SHA-256 (retime only)
CLIPS = [
    ('deagle/reload', 'pistol/pistol_deagle/reload_deagle', '3966fb59252703eaf905a5cbda2c0c778a2837f0ab27e14a819a155a14ff8f3e', None),
    ('deagle/reload_empty', 'pistol/pistol_deagle/reload_empty_deagle', 'a8247ccc4900080169aab16fe01b7535ace37d2c9aa64e875d09f4fcedcfca9d', None),
    ('deagle/shoot_empty', 'pistol/pistol_deagle/shoot_empty_deagle', '6616b3a62daf2e007bdefbd8749a09cbe3ed9688208041b57b9ff43df75dcc1b', None),
    ('deagle/shoot1', 'pistol/pistol_deagle/shoot1_deagle', 'c6348f085999abda88d01150bfb3ce14aa34ca5421964235e5fa7cc7a927f605', 'cbcdd910e1b1456e0bded2aefa29c08d1bd04bd7d83b55d6dc4e0bd0e8a584a4'),
    ('nova/reload', 'rifle/rifle_nova/reload_nova', 'c940bdad00e71020a1451a073f73690355a6dc462e8179624e1818774a6cddab', 'b527ba5b03b5b9c738fb2347935f0b55ae24acc77dd0b4f754ebb6c7a33cff18'),
    ('m4a1_s/silencer_attach', 'rifle/_default_rifle/silencer_attach_rifle', '8a79c21e813bc5affd209e1a20fe6e9019e4dad042b4a2f4f6c69ac9af0897f5', '0cb70ddae4bbdd162d0fd06db4adb813a7e570e937efa6db9fa1bdd6d771340a'),
    ('m4a1_s/silencer_detach', 'rifle/_default_rifle/silencer_detach_rifle', 'f1b1d252f4893da82dc4529e283529a038b3f3753e881b11912c673a68d271a9', '304dbed9a42823a41b31a1afee583e6c148f3bf9af2565a2b0200115d35f7b33'),
    ('usp-s/silencer_attach', 'pistol/_default_pistol/silencer_attach_pistol', 'aa9e9cac54e1d8198b6bf80668a889190ae9ee5bab2f7847e27cf492ab02ec10', '1ddd756a0beebb72732a86b1877f542a64baf775ec3d4cbc605e778ad9962995'),
    ('usp-s/silencer_detach', 'pistol/_default_pistol/silencer_detach_pistol', '408062c92c38d7570d53d27b8b363fcf8e16718ac0f69646588cef3f516b7911', '5a2cd8a178d1a72677529308c94facf6cd7a10db4bc70cab7ee03d5016dfe92c'),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def kv3(text):
    """Read this pinned decoder's DATA subset; opaque pose bytes are not metadata."""
    text = text[text.index('<!-- kv3'):]
    text = text[:text.rfind('}') + 1]
    text = re.sub(r'<!--.*?-->|#\[.*?\]', '', text, flags=re.S)
    # Leave the removed compressed-pose value as an empty array.
    text = re.sub(r'(m_compressedPoseData\s*=)\s*(?=\w+\s*=)', r'\1 []\n', text)
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|[{}\[\]=,]|[^\s{}\[\]=,]+', text)
    pos = 0

    def value():
        nonlocal pos
        token = tokens[pos]
        pos += 1
        if token == '{':
            out = {}
            while tokens[pos] != '}':
                key = tokens[pos].strip('"')
                pos += 1
                assert tokens[pos] == '='
                pos += 1
                out[key] = value()
                if tokens[pos] == ',': pos += 1
            pos += 1
            return out
        if token == '[':
            out = []
            while tokens[pos] != ']':
                out.append(value())
                if tokens[pos] == ',': pos += 1
            pos += 1
            return out
        if token.startswith('"'): return json.loads(token)
        if token in ('true', 'false', 'null'): return json.loads(token)
        try: return float(token) if any(c in token for c in '.eE') else int(token)
        except ValueError: return token

    result = value()
    assert pos == len(tokens)
    return result


def read_glb(data):
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), bytearray(data[28 + size:])


def write_glb(doc, blob):
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    blob += b'\0' * (-len(blob) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(blob))
            + struct.pack('<II', len(header), 0x4e4f534a) + header
            + struct.pack('<II', len(blob), 0x004e4942) + blob)


def transform_accessor(doc, blob, index, width, transform):
    a = doc['accessors'][index]
    assert a['componentType'] == 5126 and not a.get('sparse')
    v = doc['bufferViews'][a['bufferView']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', width * 4)
    rows = []
    for i in range(a['count']):
        row = transform(struct.unpack_from('<' + 'f' * width, blob, offset + i * stride))
        struct.pack_into('<' + 'f' * width, blob, offset + i * stride, *row)
        rows.append(struct.unpack_from('<' + 'f' * width, blob, offset + i * stride))
    if 'min' in a: a['min'] = [min(r[i] for r in rows) for i in range(width)]
    if 'max' in a: a['max'] = [max(r[i] for r in rows) for i in range(width)]


def native_to_source(doc, blob):
    """Undo VRF20.1 BakeConversion; runtime gun bindings expect Source inches.

    VRF bakes 0.0254 into ALL translations and (-.5,-.5,-.5,.5) into root
    bone rotations/positions only. No inverse binds or runtime skin are replaced.
    Visualization meshes/skins are removed; only the two skeletons are consumed.
    """
    joints = {j for skin in doc['skins'] for j in skin['joints']}
    parents = {c: i for i, n in enumerate(doc['nodes']) for c in n.get('children', [])}
    roots = {j for j in joints if parents.get(j) not in joints}

    def rotation(q):
        x, y, z, w = q
        # inverse(-.5,-.5,-.5,.5) * q
        out = [(x + w + z - y) / 2, (y + w + x - z) / 2,
               (z + w + y - x) / 2, (w - x - y - z) / 2]
        length = math.sqrt(sum(v * v for v in out))
        return [v / length for v in out]

    def position(p, root):
        # Inverse root rotation maps glTF (x,y,z) to Source (z,x,y).
        return [p[i] / 0.0254 for i in ([2, 0, 1] if root else [0, 1, 2])]

    for i, node in enumerate(doc['nodes']):
        node.pop('mesh', None)
        node.pop('skin', None)
        if i not in joints: continue
        if 'translation' in node: node['translation'] = position(node['translation'], i in roots)
        if i in roots: node['rotation'] = rotation(node.get('rotation', [0, 0, 0, 1]))
    changed = set()
    for animation in doc['animations']:
        for channel in animation['channels']:
            node, kind = channel['target']['node'], channel['target']['path']
            sampler = animation['samplers'][channel['sampler']]
            assert sampler.get('interpolation', 'LINEAR') == 'LINEAR'
            index = sampler['output']
            if index in changed: continue
            if kind == 'translation':
                transform_accessor(doc, blob, index, 3, lambda p: position(p, node in roots))
                changed.add(index)
            elif kind == 'rotation' and node in roots:
                transform_accessor(doc, blob, index, 4, rotation)
                changed.add(index)
    for key in ['skins', 'meshes', 'materials']: doc.pop(key, None)
    return sorted(doc['nodes'][j]['name'] for j in roots)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game', type=Path, required=True, help='Installed read-only game/csgo')
    p.add_argument('--cli', type=Path, required=True)
    p.add_argument('--cache', type=Path, required=True)
    p.add_argument('--vendor', type=Path, help='Existing srctools installation; never written')
    args = p.parse_args()
    if args.vendor: sys.path.insert(0, str(args.vendor.resolve()))
    from srctools.vpk import VPK
    assert digest(args.cli.read_bytes()) == 'ef9f6fb3943c30b73f0991bce6654128727b0807968f7997a6bb014efbec8830'
    steam = (args.game / 'steam.inf').read_text()
    acf = (args.game.parents[3] / 'appmanifest_730.acf').read_text()
    assert re.search(r'"buildid"\s*"26144732"', acf), 'Wrong installed build'
    cache = args.cache.resolve()
    assert not cache.is_relative_to(args.game.resolve()), 'Output must not be in installed game'
    archive = VPK(args.game / 'pak01_dir.vpk', mode='r')
    dependencies = []
    for resource, expected in [
        ('animation/skeletons/characters/viewmodel.vnmskel_c', '927aac076b950de13735e7baa4c1223c65ebf54fea774938baf03ffc42ee2c86'),
        ('animation/skeletons/weapons/deagle.vnmskel_c', '7da957e87c0d43ad263485b8f51e1d5c26aed294f374457e07e677490aae4c12'),
    ]:
        entry = archive[resource]
        data = entry.read()
        assert zlib.crc32(data) == entry.crc and digest(data) == expected, resource
        dependencies.append({'resource': resource, 'sha256': expected})
    records = []
    for target, name, expected, original in CLIPS:
        resource = PREFIX + name + '.vnmclip_c'
        entry = archive[resource]
        raw = entry.read()
        assert zlib.crc32(raw) == entry.crc and digest(raw) == expected, resource
        compiled = cache / 'native' / resource
        compiled.parent.mkdir(parents=True, exist_ok=True)
        compiled.write_bytes(raw)
        run = subprocess.run([str(args.cli), '-i', str(compiled), '-b', 'DATA'], capture_output=True, check=True)
        meta = kv3(run.stdout.decode('utf-8-sig'))
        duration, frames = meta['m_flDuration'], meta['m_nNumFrames']
        output = DEST / (target + '.glb')
        record = {'file': output.relative_to(ROOT / 'packages/assets/public').as_posix(),
                  'resource': resource, 'resourceSha256': expected, 'crc32': f'{entry.crc:08x}',
                  'duration': duration, 'frames': frames}
        if original:
            source = cache / 'inputs' / (target + '.glb')
            source.parent.mkdir(parents=True, exist_ok=True)
            if not source.exists():
                assert digest(output.read_bytes()) == original, f'Not the verified original: {target}'
                source.write_bytes(output.read_bytes())
            data = source.read_bytes()
            assert digest(data) == original
            doc, blob = read_glb(data)
            inputs = {s['input'] for a in doc['animations'] for s in a['samplers']}
            before = max(doc['accessors'][i]['max'][0] for i in inputs)
            assert abs(before / duration - (frames - 1) / frames) < 0.000001
            scale = duration / before
            for index in inputs:
                transform_accessor(doc, blob, index, 1, lambda row: [row[0] * scale])
            record.update(operation='time-inputs-only', inputSha256=original,
                          previousDuration=before, timeScale=scale, inputAccessors=len(inputs))
        else:
            export = cache / 'exports' / (target + '.glb')
            export.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run([str(args.cli), '-i', str(args.game / 'pak01_dir.vpk'),
                            '-f', resource, '-d', '--gltf_export_format', 'glb',
                            '-o', str(export)], check=True)
            data = export.read_bytes()
            doc, blob = read_glb(data)
            root_bones = native_to_source(doc, blob)
            assert abs(max(doc['accessors'][s['input']]['max'][0]
                           for a in doc['animations'] for s in a['samplers']) - duration) < 0.00001
            events = copy.deepcopy(meta['m_events'])
            for event in events:
                if 'm_name' in event: event['m_name'] = event['m_name'].lower()
            doc['animations'][0]['name'] = resource
            doc['animations'][0]['extras'] = {'events': events}
            record.update(operation='native-export-source-inch-space', exportSha256=digest(data),
                          rootBones=root_bones, events=meta['m_events'])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(write_glb(doc, blob))
        record['outputSha256'] = digest(output.read_bytes())
        records.append(record)
        print(target, record['operation'], record['outputSha256'], flush=True)
    provenance = {'generator': 'python3 scripts/import-verified-viewmodel-clips.py', 'buildId': 26144732,
                  'steamInf': steam, 'cliSha256': digest(args.cli.read_bytes()),
                  'skeletons': dependencies,
                  'source': 'Valve CS2 installed compiled clips; six viewer exports retain poses/events and only repair input times.',
                  'conversion': 'Undo VRF20.1 BakeConversion for native gun skeletons; all translations back to Source inches, inverse root basis only. Native primary and secondary channels retained. Runtime 0.9 speed unchanged.',
                  'limits': 'Existing Phoenix forearm helper remains authored (1/3, 2/3); native constraints and full native graph scheduling are not implemented.',
                  'clips': records}
    (DEST / 'verified-clips-source.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
