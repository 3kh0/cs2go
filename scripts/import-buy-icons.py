"""Import checksum-verified native equipment SVGs without changing kill-feed icons.

python3 scripts/import-buy-icons.py /path/to/native-icon-export
Input: equipment/*.svg and provenance.json from the Windows VPK export.
The checked-in provenance can pin subsequent Source2Viewer exports too.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
target = root / 'packages/assets/public/icons/buy'
manifest_file = source / 'provenance.json'
if not manifest_file.exists():
    manifest_file = target / 'source.json'
manifest = json.loads(manifest_file.read_text())
target.mkdir(parents=True, exist_ok=True)
outputs = []
for record in manifest['icons']:
    name = Path(record['output']).name
    path = source / 'equipment' / name
    if not path.exists():
        path = source / 'panorama/images/icons/equipment' / name
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != record['outputSha256']:
        raise ValueError(f'Native SVG checksum mismatch: {name}')
    text = raw.decode('utf-8-sig')
    # SVG image documents need neither an external DTD nor Illustrator comments.
    text = re.sub(r'<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->', '', text, flags=re.S).strip() + '\n'
    element = ET.fromstring(text)
    for node in element.iter():
        if node.tag.split('}')[-1] in {'script', 'foreignObject', 'image'}:
            raise ValueError(f'Unexpected SVG element: {name}')
        for attr, value in node.attrib.items():
            if attr.split('}')[-1] == 'href' and not value.startswith('#'):
                raise ValueError(f'External SVG reference: {name}')
    data = text.encode('utf-8')
    (target / name).write_bytes(data)
    outputs.append({**record, 'runtimeSha256': hashlib.sha256(data).hexdigest(), 'runtimeBytes': len(data)})
identity = manifest.get('identity', manifest)
report = {
    'author': 'Valve', 'source': 'CS2 Steam depot', 'steamBuildId': identity['steamBuildId'],
    'depot': 2347770,
    'depotManifest': identity.get('depotManifest') or identity['installedDepotManifests']['2347770'],
    'vpkDirectorySha256': identity['vpkDirectorySha256'],
    'decoder': identity.get('decoder') or identity['toolVersion'].splitlines()[0],
    'generator': 'python3 scripts/import-buy-icons.py /path/to/native-icon-export',
    'processing': 'Native path data and viewBox retained; XML declarations, external DTD and comments removed. Main-game kill-feed/inventory PNGs unchanged.',
    'icons': outputs,
}
(target / 'source.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'Imported {len(outputs)} native equipment SVGs')
