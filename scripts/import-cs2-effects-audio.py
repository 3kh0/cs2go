#!/usr/bin/env python3
"""Import player, movement, UI, knife and bomb clips from the pinned CS2 Steam depot.
Original VPKs remain unchanged. Missing archive files download into --cache only.
Requires Source2Viewer CLI, DepotDownloader and FFmpeg. Then run pack-audio.py.
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
p.add_argument('--cache', type=Path, default=ROOT / 'artifacts/cs2-effects')
p.add_argument('--cli', default=str(ROOT / 'artifacts/audio-tools/viewer/Source2Viewer-CLI'))
p.add_argument('--downloader', default=str(ROOT / 'artifacts/audio-tools/depot/DepotDownloader'))
a = p.parse_args()
a.cache.mkdir(parents=True, exist_ok=True)
bindings = json.loads((ROOT / 'scripts/cs2-effects-audio.json').read_text())
manifest_id = bindings['manifest']
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

resources = sorted({clip['resource'] for clip in bindings['clips']} | {clip['eventFile'] for clip in bindings['clips']})
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

events = {}
for resource in {clip['eventFile'] for clip in bindings['clips']}:
    events_text = (a.cache / 'decoded' / resource.removesuffix('_c')).read_text()
    events[resource] = {name: re.findall(r'"(sounds/[^\"]+\.vsnd)"', body) for name, body in
                       re.findall(r'^\t(\S+) =\s*\n\t\{(.*?)^\t\}', events_text, re.M | re.S)}
for clip in bindings['clips']:
    if clip['resource'].removesuffix('_c') not in events[clip['eventFile']].get(clip['event'], []):
        raise ValueError(f'Clip is not referenced by its native event: {clip["name"]}')

previous_report = ROOT / 'packages/assets/public/audio/cs2-effects-source.json'
previous_clips = {clip['name']: clip for clip in json.loads(previous_report.read_text())['clips']} if previous_report.exists() else {}

def convert(clip):
    base = a.cache / 'decoded' / clip['resource'].removesuffix('.vsnd_c')
    candidates = [base.with_suffix(ext) for ext in ('.wav', '.mp3', '.aac')]
    decoded = next((path for path in candidates if path.exists()), None)
    if decoded is None:
        raise ValueError(f'No exported audio: {clip["resource"]}')
    output = ROOT / 'packages/assets/public/audio/source' / (clip['name'] + '.ogg')
    previous = previous_clips.get(clip['name'])
    if previous and output.exists() and previous.get('resourceSha256') == source_hashes[clip['resource']] and previous.get('decodedSha256') == hashlib.sha256(decoded.read_bytes()).hexdigest() and previous.get('outputSha256') == hashlib.sha256(output.read_bytes()).hexdigest():
        return {**previous, **clip}
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(decoded),
                    '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '96k', str(output)], check=True)
    return {**clip, 'resourceSha256': source_hashes[clip['resource']],
            'decodedSha256': hashlib.sha256(decoded.read_bytes()).hexdigest(),
            'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    clips = list(pool.map(convert, bindings['clips']))
report = {
    'source': 'Valve CS2 Steam depot', 'app': 730, 'depot': 2347770, 'manifest': manifest_id,
    'manifestDate': bindings['manifestDate'], 'vpkDirectorySha256': hashlib.sha256(b).hexdigest(),
    'soundEventsSha256': {resource: source_hashes[resource] for resource in sorted(events)},
    'tools': {'Source2Viewer': '20.1', 'FFmpeg': 'libopus mono 48kHz 96kbps'},
    'selection': bindings['selection'], 'limitations': bindings['limitations'], 'clips': clips,
}
(ROOT / 'packages/assets/public/audio/cs2-effects-source.json').write_text(json.dumps(report, indent=2) + '\n')
manifest_path = ROOT / 'packages/assets/public/audio/source/manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest.pop('repository', None)
manifest.pop('commit', None)
manifest['effectsSource'] = '../cs2-effects-source.json'
manifest['clips'] = [clip for clip in manifest['clips'] if clip['name'].startswith(('music-', 'ui-'))] + [
    {**clip, 'source': clip['resource'], 'sourcePack': 'Valve CS2 Steam depot', 'manifest': manifest_id}
    for clip in clips
]
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Imported {len(clips)} native CS2 effects; {sum(clip["bytes"] for clip in clips):,} bytes')
