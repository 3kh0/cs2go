#!/usr/bin/env python3
"""Import tracer particle references and textures from the pinned CS2 Steam depot.
Original VPKs remain unchanged. Missing archive files download into --cache only.
Requires Source2Viewer CLI and DepotDownloader.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--vpk', type=Path, default=ROOT / 'artifacts/cs2-effects/depot/game/csgo/pak01_dir.vpk')
p.add_argument('--cache', type=Path, default=ROOT / 'artifacts/cs2-tracers')
p.add_argument('--cli', default=str(ROOT / 'artifacts/audio-tools/viewer/Source2Viewer-CLI'))
p.add_argument('--downloader', default=str(ROOT / 'artifacts/audio-tools/depot/DepotDownloader'))
a = p.parse_args()
a.cache.mkdir(parents=True, exist_ok=True)
manifest_id = '67499503218971311'
bindings = {'vpkDirectorySha256': '562972293ed7a5d40e341c4df7d6b0ee06430452694177142f0c1239dd3f2c8b'}
b = a.vpk.read_bytes()
if hashlib.sha256(b).hexdigest() != bindings['vpkDirectorySha256']:
    raise ValueError('VPK directory does not match the pinned CS2 manifest')
signature, version, tree_size = struct.unpack_from('<III', b)
if signature != 0x55AA1234 or version not in (1, 2):
    raise ValueError('Invalid VPK directory')
cursor = 28 if version == 2 else 12
inline_start = cursor + tree_size

def string():
    global cursor
    end = b.index(0, cursor)
    result = b[cursor:end].decode()
    cursor = end + 1
    return result

entries = {}
while extension := string():
    while folder := string():
        while name := string():
            crc, preload, archive, offset, size, terminator = struct.unpack_from('<IHHIIH', b, cursor)
            cursor += 18
            if terminator != 65535:
                raise ValueError('Invalid VPK entry')
            before = b[cursor:cursor + preload]
            cursor += preload
            key = (folder + '/' if folder != ' ' else '') + name + '.' + extension
            entries[key] = (crc, archive, offset, size, before)

def archive_path(index):
    if index == 32767:
        return a.vpk
    name = f'pak01_{index:03}.vpk'
    downloaded = a.cache / 'depot/game/csgo' / name
    return downloaded if downloaded.exists() else a.vpk.parent / name

resources = [
    'particles/weapons/cs_weapon_fx/weapon_tracers_' + name + '.vpcf_c'
    for name in ('assrifle', 'assrifle_aug', 'pistol', 'rifle', 'rifle_ssg', 'shot', 'smg', 'mach')
] + ['materials/effects/spark.vtex_c', 'materials/particle/sparks/sparks.vtex_c']
def read_resource(resource):
    crc, index, offset, size, preload = entries[resource]
    with archive_path(index).open('rb') as f:
        f.seek(offset + (inline_start if index == 32767 else 0))
        return preload + f.read(size)

missing = set()
for resource in resources:
    crc, index, *_ = entries[resource]
    try:
        valid = zlib.crc32(read_resource(resource)) == crc
    except FileNotFoundError:
        valid = False
    if not valid:
        missing.add(f'game/csgo/pak01_{index:03}.vpk')
missing = sorted(missing)
if missing:
    filelist = a.cache / 'files.txt'
    filelist.write_text('\n'.join(missing) + '\n')
    subprocess.run([a.downloader, '-app', '730', '-depot', '2347770', '-manifest', manifest_id,
                    '-os', 'windows', '-filelist', str(filelist), '-dir', str(a.cache / 'depot'),
                    '-validate', '-max-downloads', '8'], check=True)

source_hashes = {}
for resource in resources:
    crc, index, offset, size, preload = entries[resource]
    with archive_path(index).open('rb') as f:
        f.seek(offset + (inline_start if index == 32767 else 0))
        raw = preload + f.read(size)
    if zlib.crc32(raw) != crc:
        raise ValueError(f'CRC mismatch: {resource}; validate/redownload its archive')
    target = a.cache / 'extracted' / resource
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    source_hashes[resource] = hashlib.sha256(raw).hexdigest()
subprocess.run([a.cli, '-i', str(a.cache / 'extracted'), '-o', str(a.cache / 'decoded'),
                '--recursive', '--decompile', '--threads', '4'], check=True,
               stdout=(a.cache / 'decode.log').open('w'))

outputs = {
    'tracer-core.png': 'materials/effects/spark.png',
    'tracer-glow.png': 'materials/particle/sparks/sparks_seq4.png',
}
destination = ROOT / 'packages/assets/public/effects'
destination.mkdir(parents=True, exist_ok=True)
for name, decoded in outputs.items():
    (destination / name).write_bytes((a.cache / 'decoded' / decoded).read_bytes())
report = {
    'source': 'Valve CS2 Steam depot', 'app': 730, 'depot': 2347770,
    'manifest': manifest_id, 'manifestDate': '2026-10-22T21:23:12Z',
    'vpkDirectorySha256': hashlib.sha256(b).hexdigest(),
    'resources': source_hashes,
    'outputs': {name: {'decoded': decoded, 'sha256': hashlib.sha256((destination / name).read_bytes()).hexdigest()} for name, decoded in outputs.items()},
    'reference': 'Native C_INIT_MoveBetweenPoints, C_OP_FadeAndKillForTracers and C_OP_RenderTrails; spark core plus sparks sequence 4 glow. Source2Viewer CLI 20.1.',
    'limits': 'Browser reconstruction: two texture layers combined in one additive shader; no Source 2 bloom/gradient LUT graph or sniper smoke wisp. SMGs, machine guns, AUG and SG 553 use the assault-rifle trail approximation instead of their native rope/noise graphs. Every non-suppressed shot emits a trail; native per-mode frequency is not applied because cadence phase/reset and view overrides are unverified. Short flights receive one sub-frame sample; hitscan damage is unchanged.'
}
(destination / 'tracer-source.json').write_text(json.dumps(report, indent=2) + '\n')
print('Imported native CS2 tracer textures and particle provenance')
