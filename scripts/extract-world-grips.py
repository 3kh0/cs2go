"""Export actual gameplay clips, keeping additive tracks distinct from absolute poses."""
import copy
import json
import math
from pathlib import Path
import struct
import sys

import argparse
import importlib.util

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, required=True, help='Scratch root containing vendor/, native/ and fast-output/')
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
read_dmx = helpers.read_dmx
skeleton = helpers.skeleton
native_locals = helpers.native_locals
globals_for = helpers.globals_for
qm = helpers.qm
unit = helpers.unit
rotate = helpers.rotate
write_json = helpers.write_json
digest = helpers.digest
source_identity = helpers.source_identity



def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def data_for(resource):
    return load(HERE / 'data-json' / Path(resource).with_suffix('.json'))


def f32(v):
    return struct.unpack('<f', struct.pack('<f', v))[0]


def sample_scales(sections, index):
    scales = []
    for section in sections:
        raw = bytes.fromhex(section['m_compressedPoseData']['hexBytes'])
        offset = 2 * section['m_compressedPoseOffsets'][index]
        for t in section['m_trackCompressionSettings']:
            offset += 0 if t['m_bIsRotationStatic'] else 6
            offset += 0 if t['m_bIsTranslationStatic'] else 6
            r = t['m_scaleRange']
            scale = f32(r['m_flRangeStart'])
            if not t['m_bIsScaleStatic']:
                unorm = struct.unpack_from('<H', raw, offset)[0]
                scale = f32(f32(f32(unorm / 65535) * f32(r['m_flRangeLength'])) + scale)
                offset += 2
            scales.append(scale)
        end = 2 * section['m_compressedPoseOffsets'][index+1] if index+1 < section['m_nNumFrames'] else len(raw)
        assert offset == end
    return scales


def fk(bones, local, scales):
    return [[p, unit(q)] for p, q in globals_for(bones, local, scales)]


def attachments(bones, model):
    result = {}
    for name, bone, offset, rotation in [
        ('weapon', 'wpn', [0, 0, 0], [0, 0, 0, 1]),
        ('weapon_hand_r', 'hand_R', [-2.6, -1.4, 0], [0, 0, 1, 0]),
        ('weapon_hand_l', 'hand_L', [2.6, 1.4, 0], [-1, 0, 0, 0]),
    ]:
        i = next(i for i, b in enumerate(bones[:75]) if b['name'] == bone)
        p, q = model[i]
        rp = rotate(q, offset)
        result[name] = {'bone': i, 'offset': offset, 'rotation': rotation,
                        'modelPosition': [p[k]+rp[k] for k in range(3)], 'modelRotation': unit(qm(q, rotation))}
    return result


def export(resource):
    native = HERE / 'native' / resource
    path = HERE / 'decoded' / Path(resource).with_suffix('.dmx')
    descriptor = path.with_suffix('.vnmclip')
    data = data_for(resource)
    root = read_dmx(path)
    bones, bind_dmx, ids = skeleton(root)
    sections = [data] + data['m_secondaryAnimations']
    tracks = [t for s in sections for t in s['m_trackCompressionSettings']]
    assert len(tracks) == len(bones)
    scales_static = all(t['m_bIsScaleStatic'] for t in tracks)
    ranges = []
    start = 0
    for s in sections:
        count = len(s['m_trackCompressionSettings'])
        ranges.append({'start': start, 'count': count, 'resource': s['m_skeleton'], 'isAdditive': s['m_bIsAdditive']})
        start += count
    assert ranges[0]['count'] == 75
    clip = next(root['animationList'].val_elem['animations'].iter_elem())
    channels = []
    for c in clip['channels'].iter_elem():
        logs = list(c['log'].val_elem['layers'].iter_elem())
        assert len(logs) == 1
        layer = logs[0]
        keys = [(t.value, list(v)) for t, v in zip(layer['times']._value, layer['values']._value) if t.value >= 0]
        assert keys and keys[0][0] == 0
        attr = c['toAttribute'].val_string
        assert attr in ('position', 'orientation')
        channels.append((ids[c['toElement'].val_elem.uuid], 0 if attr == 'position' else 1, keys))
    times = sorted({t for _, _, keys in channels for t, _ in keys})
    assert len(times) == data['m_nNumFrames']
    is_static = scales_static and all(all(v == keys[0][1] for _, v in keys) for _, _, keys in channels)
    indices = [0] if is_static else sorted({0, len(times)//2, len(times)-1})
    additive = data['m_bIsAdditive']
    frames = []
    for index in indices:
        time = times[index]
        scales = sample_scales(sections, index)
        local = copy.deepcopy(bind_dmx)
        for i, attr, keys in channels:
            exact = [v for t, v in keys if t == time]
            assert exact or all(v == keys[0][1] for _, v in keys), (resource, i, time)
            local[i][attr] = (exact[0] if exact else keys[0][1])[:]
        local = native_locals(bones, local)
        # The DMX root-motion writer zeros this axis; restore it from static native DATA.
        for i, b in enumerate(bones):
            if b['name'] == 'root_motion':
                assert tracks[i]['m_bIsTranslationStatic']
                local[i][0][2] = tracks[i]['m_translationRangeZ']['m_flRangeStart']
        model = None if additive else fk(bones, local, scales)
        frame = {'time': time, 'decodedSampleIndex': index, 'localPQ': local, 'modelPQ': model, 'localScale': scales,
                 'attachments': {} if additive else attachments(bones, model)}
        frame['keyBonePQ'] = {b['name']: {'index': i, 'localPQ': local[i], 'modelPQ': None if additive else model[i]}
                              for i, b in enumerate(bones[:75]) if b['name'] in
                              ('wpn', 'wpnPivot', 'wpnHand_L', 'wpnHand_R', 'attachHand_L', 'attachHand_R', 'hand_L', 'hand_R')}
        frames.append(frame)
    bind = native_locals(bones, bind_dmx)
    bind_scales = []
    for section in sections:
        s = data_for(section['m_skeleton'] + '_c')
        bind_scales.extend(t[3] for t in s['m_parentSpaceReferencePose'])
    category = 'raw-additive-layer' if additive else 'native-absolute-clip'
    if '+non_additive' in resource:
        category = 'native-absolute-reference-companion'
    obj = {'schema': 'cs2-native-gameplay-pose-1', 'resource': resource, 'poseKind': category,
           'isAdditive': additive, 'runtimeGraphEvaluated': False,
           'basis': 'Source2 model space; RH +X forward +Y left +Z up',
           'units': 'Source inches; metres = value * 0.0254', 'quaternionOrder': 'xyzw',
           'transformConvention': 'column vector: model = parent * T * R * S; PQ = [position, quaternion]',
           'localPQSemantics': 'raw local additive deltas; p and scale add, q post-multiplies base' if additive else 'absolute skeleton-local transforms',
           'modelPQSemantics': 'null: additive deltas cannot be treated as an absolute FK pose' if additive else 'own-root FK of this clip, NOT final game graph',
           'localScaleSemantics': 'raw additive scale deltas, neutral zero' if additive else 'absolute uniform scale, neutral one; frame.localScale overrides top-level',
           'primaryBoneCount': 75, 'bones': bones, 'skeletonRanges': ranges,
           'skeletonResources': [s['m_skeleton'] for s in sections], 'localScale': frames[0]['localScale'], 'scalesStatic': scales_static,
           'bindLocalPQ': bind, 'bindLocalScale': bind_scales, 'bindModelPQ': fk(bones, bind, bind_scales),
           'nativeFrameCount': data['m_nNumFrames'], 'duration': data['m_flDuration'],
           'fps': clip['frameRate'].val_float, 'dmxSampleTimes': times,
           'staticAcrossAllNonnegativeDmxKeys': is_static, 'frames': frames,
           'modelSpaceSamplingChain': data['m_modelSpaceSamplingChain'],
           'modelSpaceBoneSamplingIndices': data['m_modelSpaceBoneSamplingIndices'],
           'axisFixup': 'paired VRF NM root/child fixup inverted; additive root delta restored too',
           'provenance': [source_identity(p) for p in [native, path, descriptor]]}
    target = HERE / 'poses' / Path(resource).relative_to('animation/anims/world').with_suffix('.json')
    write_json(target, obj)
    return {'resource': resource, 'file': target.relative_to(HERE).as_posix(), 'poseKind': category,
            'isAdditive': additive, 'boneCount': len(bones), 'secondaryBoneCount': len(bones)-75,
            'frames': len(frames), 'static': is_static, 'sha256': digest(target)}, obj


def main():
    manifest = []
    for path in sorted((HERE/'native/animation/anims').rglob('*.vnmclip_c')):
        item, _ = export(path.relative_to(HERE/'native').as_posix())
        manifest.append(item)
    write_json(HERE/'manifest.json', manifest)
    for path in sorted((HERE/'decoded/animation/skeletons').rglob('*.dmx')):
        root = read_dmx(path)
        bones, bind, _ = skeleton(root)
        bind = native_locals(bones, bind)
        resource = path.relative_to(HERE/'decoded').with_suffix('.vnmskel_c').as_posix()
        data = data_for(resource)
        assert [b['name'] for b in bones] == data['m_boneIDs']
        assert [b['parent'] for b in bones] == data['m_parentIndices']
        scales = [v[3] for v in data['m_parentSpaceReferencePose']]
        write_json(HERE/'binds'/path.relative_to(HERE/'decoded/animation/skeletons').with_suffix('.json'),
                   {'schema': 'cs2-native-bind-1', 'resource': resource, 'bones': bones,
                    'localPQ': bind, 'modelPQ': fk(bones, bind, scales), 'bindLocalPQ': bind,
                    'localScale': scales, 'units': 'Source inches', 'quaternionOrder': 'xyzw',
                    'maskDefinitions': data['m_maskDefinitions'],
                    'provenance': [source_identity(HERE/'native'/resource), source_identity(path)]})
    print('Exported', len(manifest), 'clips;', sum(i['isAdditive'] for i in manifest), 'raw additive;',
          sum(i['secondaryBoneCount'] > 0 for i in manifest), 'with secondary bones')


if __name__ == '__main__':
    main()
