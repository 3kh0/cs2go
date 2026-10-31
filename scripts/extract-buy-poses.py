r"""Reproducible sampled JSON export from Source2Viewer 20.1 DMX files.

python scripts/extract-buy-poses.py --root /path/to/extraction --all
Requires scratch-local srctools 2.7.0 under ROOT/vendor.
The original files and installed game are read-only inputs.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import sys
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--all', action='store_true')
args = parser.parse_args()
ROOT = args.root.resolve()
OUT = ROOT / 'fast-output'
sys.path.insert(0, str(ROOT / 'vendor'))
sys.dont_write_bytecode = True
import srctools.dmx as dmx

QFIX = [-0.5, -0.5, -0.5, 0.5]
QINV = [0.5, 0.5, 0.5, 0.5]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_dmx(path):
    data = path.read_bytes()
    if b'encoding binary 9 ' in data[:100]:
        offset = data.index(b'-->') + 5
        # Binary 9 adds prefix attributes, then uses a 32-type array stride.
        # These generated files have zero prefix attributes; reject any other case.
        assert struct.unpack_from('<I', data, offset)[0] == 0
        data = data[:offset] + data[offset + 4:]
        dmx.ARRAY_OFFSET = 32
    else:
        dmx.ARRAY_OFFSET = 14
    stream = io.BytesIO(data)
    root, fmt, version = dmx.Element.parse(stream)
    assert (fmt, version) == ('model', 22)
    assert stream.tell() == len(data), (path, stream.tell(), len(data))
    return root


def qm(a, b):
    x, y, z, w = a
    X, Y, Z, W = b
    return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X,
            w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z]


def unit(q):
    n = math.sqrt(sum(x*x for x in q))
    assert n > 0
    return [x/n for x in q]


def rotate(q, p):
    q = unit(q)
    return qm(qm(q, [*p, 0]), [-q[0], -q[1], -q[2], q[3]])[:3]


def native_locals(bones, local):
    local = [[p[:], q[:]] for p, q in local]
    for i, bone in enumerate(bones):
        if bone['name'] == 'root_motion':
            local[i][1] = qm(local[i][1], QFIX)
            for j, child in enumerate(bones):
                if child['parent'] == i:
                    local[j] = [rotate(QINV, local[j][0]), qm(QINV, local[j][1])]
    return local


def globals_for(bones, local, scales=None):
    result = {}
    model_scale = {}
    if scales is None:
        scales = [1.0] * len(bones)

    def resolve(i):
        if i in result:
            return result[i]
        p, q = local[i]
        parent = bones[i]['parent']
        model_scale[i] = scales[i]
        if parent != -1:
            pp, pq = resolve(parent)
            rp = rotate(pq, [x * model_scale[parent] for x in p])
            p, q = [pp[k]+rp[k] for k in range(3)], qm(pq, q)
            model_scale[i] *= model_scale[parent]
        result[i] = [p, q]
        return result[i]

    return [resolve(i) for i in range(len(bones))]


def skeleton(root):
    skel = root['skeleton'].val_elem
    joints = list(skel['jointList'].iter_elem())
    ids = {j.uuid: i for i, j in enumerate(joints)}
    bones = [{'name': j.name, 'parent': -1} for j in joints]
    transforms = {}
    local = []
    for i, j in enumerate(joints):
        for child in j['children'].iter_elem():
            bones[ids[child.uuid]]['parent'] = i
        t = j['transform'].val_elem
        transforms[t.uuid] = i
        local.append([list(t['position']._value), list(t['orientation']._value)])
    return bones, local, transforms


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')


def source_identity(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': digest(path), 'bytes': path.stat().st_size}


def export_clip(path):
    root = read_dmx(path)
    bones, bind_dmx, transform_ids = skeleton(root)
    clip = next(root['animationList'].val_elem['animations'].iter_elem())
    descriptor = path.with_suffix('.vnmclip')
    text = descriptor.read_text(encoding='utf-8-sig')
    resources = re.findall(r'"(animation/skeletons/[^"\r\n]+)"', text)
    native_dump = OUT / 'clip-data' / (path.stem + '.txt')
    dump_bytes = native_dump.read_bytes()
    dump = dump_bytes.decode('utf-16' if dump_bytes[:2] == b'\xff\xfe' else 'utf-8-sig')
    scale_starts = re.findall(r'm_scaleRange\s*=\s*\{\s*m_flRangeStart = ([^\s]+)', dump)
    scales = [struct.unpack('<f', struct.pack('<f', float(v)))[0] for v in scale_starts]
    scale_flags = re.findall(r'm_bIsScaleStatic = (\w+)', dump)
    assert len(scales) == len(bones) == len(scale_flags)
    assert all(v == 'true' for v in scale_flags)
    channels = []
    for c in clip['channels'].iter_elem():
        target = c['toElement'].val_elem
        assert target.uuid in transform_ids, ('non-bone channel', target.name)
        attr = c['toAttribute'].val_string
        assert attr in ('position', 'orientation')
        layers = list(c['log'].val_elem['layers'].iter_elem())
        assert len(layers) == 1
        layer = layers[0]
        keys = [(t.value, list(v)) for t, v in zip(layer['times']._value, layer['values']._value) if t.value >= 0]
        assert keys and keys[0][0] == 0
        channels.append((transform_ids[target.uuid], attr, keys))
    times = sorted({t for _, _, keys in channels for t, _ in keys})
    is_static = all(all(v == keys[0][1] for _, v in keys) for _, _, keys in channels)
    frames = []
    for time in ([times[0]] if is_static else times):
        local = [[p[:], q[:]] for p, q in bind_dmx]
        for i, attr, keys in channels:
            values = [v for t, v in keys if t <= time]
            assert values
            local[i][0 if attr == 'position' else 1] = values[-1][:]
        local = native_locals(bones, local)
        world = globals_for(bones, local, scales)
        attachments = {}
        for name, bone_name, offset, rotation in (
            ('weapon', 'wpn', [0, 0, 0], [0, 0, 0, 1]),
            ('weapon_hand_r', 'hand_R', [-2.6, -1.4, 0], [0, 0, 1, 0]),
            ('weapon_hand_l', 'hand_L', [2.6, 1.4, 0], [-1, 0, 0, 0]),
        ):
            matches = [i for i, b in enumerate(bones) if b['name'] == bone_name]
            if not matches:
                continue
            i = matches[0]
            p, q = world[i]
            rp = rotate(q, offset)
            attachments[name] = {'bone': i, 'offset': offset, 'rotation': rotation,
                                 'modelPosition': [p[k]+rp[k] for k in range(3)], 'modelRotation': qm(q, rotation)}
        frames.append({'time': time, 'localPQ': local, 'modelPQ': world, 'attachments': attachments})
    native = ROOT / 'native' / path.relative_to(ROOT / 'decoded').with_suffix('.vnmclip_c')
    bind = native_locals(bones, bind_dmx)
    obj = {'schema': 'cs2-native-buy-pose-1', 'resource': native.relative_to(ROOT / 'native').as_posix(),
           'skeletonResources': resources, 'basis': 'Source2 model space; RH +X forward +Y left +Z up',
           'units': 'Source units (inches); metres = value * 0.0254', 'quaternionOrder': 'xyzw',
           'transformConvention': 'column vector: model = parent * T(position) * R(quaternion); PQ = [position, quaternion]',
           'axisFixup': 'VRF NM root/child fixup inverted in locals; model-space pose preserved',
           'localScale': scales, 'scaleSource': source_identity(native_dump),
           'primaryBoneCount': 75,
           'staticAcrossAllNonnegativeDmxKeys': is_static, 'dmxSampleTimes': times,
           'fps': clip['frameRate'].val_float, 'bones': bones, 'bindLocalPQ': bind,
           'bindModelPQ': globals_for(bones, bind), 'frames': frames,
           'runtimeGraphEvaluated': False,
           'provenance': [source_identity(native), source_identity(path), source_identity(descriptor)]}
    destination = OUT / 'poses' / path.relative_to(ROOT / 'decoded' / 'animation' / 'anims' / 'ui_anims' / 'buy_menu').with_suffix('.json')
    write_json(destination, obj)
    return {'file': destination.relative_to(OUT).as_posix(), 'bones': len(bones), 'static': is_static,
            'frames': len(frames), 'sourceFrames': len(times), 'sha256': digest(destination)}


def main():
    base = ROOT / 'decoded' / 'animation' / 'anims' / 'ui_anims' / 'buy_menu'
    names = ['t/t_buymenu_ak_03.dmx', 'shared/sh_buymenu_smoke.dmx', 't/t_buymenu_glock18_03.dmx']
    paths = sorted(base.rglob('*.dmx')) if '--all' in sys.argv else [base / n for n in names]
    manifest = [export_clip(p) for p in paths]
    root = read_dmx(ROOT / 'decoded' / 'animation' / 'skeletons' / 'characters' / 'worldmodel.dmx')
    bones, local, _ = skeleton(root)
    local = native_locals(bones, local)
    write_json(OUT / 'worldmodel-bind.json', {'schema': 'cs2-native-bind-1',
               'resource': 'animation/skeletons/characters/worldmodel.vnmskel_c',
               'bones': bones, 'localPQ': local, 'modelPQ': globals_for(bones, local),
               'units': 'Source inches', 'quaternionOrder': 'xyzw', 'basis': 'RH +X forward +Y left +Z up',
               'provenance': [source_identity(ROOT / 'native' / 'animation' / 'skeletons' / 'characters' / 'worldmodel.vnmskel_c')]})
    write_json(OUT / ('all-manifest.json' if '--all' in sys.argv else 'first-manifest.json'), manifest)
    archive = OUT / ('all-native-buy-poses.zip' if '--all' in sys.argv else 'first-ak-smoke-glock.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for item in manifest:
            z.write(OUT / item['file'], item['file'])
        for name in ['worldmodel-bind.json', 'README.md', 'FINDINGS.md', 'export_poses.py',
                     'SNAP-MOLOTOV-GLOCK.md', 'snap-helper-crosscheck.json',
                     'provenance.json', 'ground-rebel-attachments.json', 'weapon-mesh-binds.json',
                     'mirror-crosscheck.json', 'native-scale-root-validation.json']:
            if (OUT / name).exists():
                z.write(OUT / name, name)
        z.writestr('manifest.json', json.dumps(manifest, indent=2))
    print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest(archive), 'clips': manifest}, indent=2))


if __name__ == '__main__':
    main()
