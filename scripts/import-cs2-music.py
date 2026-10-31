#!/usr/bin/env python3
"""Import the Valve CS2 default soundtrack from the pinned CS2 Steam depot.
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
p.add_argument('--vpk', type=Path, default=ROOT / 'artifacts/c4-import/depot/game/csgo/pak01_dir.vpk')
p.add_argument('--cache', type=Path, default=ROOT / 'artifacts/cs2-music')
p.add_argument('--cli', default=str(ROOT / 'artifacts/source2viewer/Source2Viewer-CLI'))
p.add_argument('--downloader', default=str(ROOT / 'artifacts/cs2-dust-import/tools/DepotDownloader'))
a = p.parse_args()
a.cache.mkdir(parents=True, exist_ok=True)
manifest_id = '4758919807587010422'
tracks = {'menu': 'mainmenu', 'start': 'startround_01', 'deathcam': 'deathcam', 'win': 'wonround', 'lose': 'lostround', 'mvp': 'roundmvpanthem_01', 'countdown': 'roundtenseccount', 'bomb': 'bombplanted', 'bomb-countdown': 'bombtenseccount', 'match': 'startofmatch', 'end': 'endofmatch'}
bindings = {'clips': [{'name': 'music-' + name, 'resource': 'sounds/music/valve_cs2_01/' + track + '.vsnd_c'} for name, track in tracks.items()]}
b = a.vpk.read_bytes()
if hashlib.sha256(b).hexdigest() != '48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad':
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

resources = sorted({clip['resource'] for clip in bindings['clips']} | {'soundevents/music/valve_cs2_01/game_sounds_music.vsndevts_c'})
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


clips = []
for clip in bindings['clips']:
    base = a.cache / 'decoded' / clip['resource'].removesuffix('.vsnd_c')
    decoded = next((base.with_suffix(ext) for ext in ('.wav', '.mp3', '.aac') if base.with_suffix(ext).exists()), None)
    if decoded is None:
        raise ValueError(f'No exported audio: {clip["resource"]}')
    output = ROOT / 'packages/assets/public/audio/source' / (clip['name'] + '.ogg')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(decoded), '-map_metadata', '-1', '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-b:a', '128k', str(output)], check=True)
    clips.append({**clip, 'source': clip['resource'], 'sourcePack': 'Valve CS2 default soundtrack', 'resourceSha256': source_hashes[clip['resource']], 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size})
report = {'source': 'Valve CS2 Steam depot', 'app': 730, 'depot': 2347770, 'manifest': manifest_id, 'vpkDirectorySha256': hashlib.sha256(b).hexdigest(), 'encoding': 'stereo Opus 128kbps 48kHz', 'clips': clips}
(ROOT / 'packages/assets/public/audio/cs2-music-source.json').write_text(json.dumps(report, indent=2) + '\n')
manifest_path = ROOT / 'packages/assets/public/audio/source/manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['clips'] = [clip for clip in manifest['clips'] if not clip['name'].startswith('music-')] + clips
manifest['musicSource'] = '../cs2-music-source.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Imported {len(clips)} CS2 music cues')
