#!/usr/bin/env python3
"""Extract lossless current Dust II baked C4 fields from the local Valve VPK.
Requires the existing Source2Viewer CLI. Original depot inputs remain untouched.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vpk', type=Path, default=Path('artifacts/dust-lighting/depot/game/csgo/maps/de_dust2.vpk'))
    parser.add_argument('--cli', default='artifacts/source2viewer/Source2Viewer-CLI')
    parser.add_argument('--cache', type=Path, default=Path('artifacts/bomb-damage'))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    map_source = json.loads(Path('packages/assets/public/models/maps/source-manifest.json').read_text())
    vpk_hash = sha(args.vpk)
    if vpk_hash != map_source['files']['de_dust2.vpk']:
        raise ValueError('VPK differs from pinned imported map; update map provenance before extracting its field')
    resource = 'maps/de_dust2/baked_bomb_damage.vdata_c'
    native = args.cache / 'baked_bomb_damage.vdata_c'
    text = args.cache / 'baked_bomb_damage.vdata'
    for output, decompile in [(native, False), (text, True)]:
        subprocess.run([args.cli, '-i', str(args.vpk), '--vpk_filepath', resource, '-o', str(output), *(['-d'] if decompile else [])], check=True)
    source = text.read_text()
    if 'CS2_BOMB_DAMAGE_DATA' not in source:
        raise ValueError('Unexpected data type')
    version = int(re.search(r'version\s*=\s*(\d+)', source)[1])
    if version not in [1, 2]:
        raise ValueError('Unsupported native field version')
    blobs = {key:bytes.fromhex(re.search(key+r'\s*=\s*#\[(.*?)\]', source, re.S)[1]) for key in ['bombsites','positions','damage_values']}
    site_count = len(blobs['bombsites']) // 28
    point_count = len(blobs['positions']) // 6
    if len(blobs['damage_values']) != site_count * point_count * 4:
        raise ValueError('Native field records mismatch')
    positions = list(struct.iter_unpack('<3h', blobs['positions']))
    if len(set(positions)) != point_count:
        raise ValueError('Ambiguous duplicate native positions')
    payload = struct.pack('<4sIII', b'BOMB', version, site_count, point_count) + b''.join(blobs.values())
    out = Path('packages/assets/public/models/maps/dust2-bomb.bin.gz')
    out.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    metadata = {'author':'Valve', 'map':'de_dust2', 'depot':map_source['depot'], 'depotManifest':map_source['depotManifest'], 'sourceResource':resource, 'resourceVersion':version, 'vpkSha256':vpk_hash, 'resourceSha256':sha(native), 'decompiledSha256':sha(text), 'positions':point_count, 'bombsites':list(struct.iter_unpack('<7f', blobs['bombsites'])), 'runtime':{'file':out.name,'bytes':out.stat().st_size,'sha256':sha(out),'decodedBytes':len(payload)}, 'decoderReference':'https://github.com/ValveResourceFormat/ValveResourceFormat/blob/108ec505021af108c7f69dbd4d3a64f89d74304e/ValveResourceFormat/Resource/ResourceTypes/GenericData/CS2/BombDamage.cs', 'queryReference':'https://github.com/Starfie1d1272/cs2-c4-damage/tree/4e288d3c986183b5357c1264bc4793cd3d394688', 'qualification':'Exact extracted field bytes; query is independently audited static native reconstruction, not matched-build live qualification.'}
    Path('packages/assets/public/models/maps/bomb-source.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps({'positions':point_count,'sites':site_count,'compressedBytes':out.stat().st_size}))

if __name__ == '__main__':
    main()
