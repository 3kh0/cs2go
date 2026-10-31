"""Bundle the supplied native C4 viewmodel export without changing the input.
Usage: python3 scripts/import-c4-animation.py /path/to/weapon_c4.glb
"""
import hashlib
import json
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(__file__).resolve().parents[1] / 'packages/assets/public/models/animations/c4'
target.mkdir(parents=True, exist_ok=True)
data = source.read_bytes()
(target / 'plant.glb').write_bytes(data)
(target / 'source.json').write_text(json.dumps({
    'author': 'Valve',
    'source': 'User-supplied weapon_c4.glb; CS2 Inspects viewer export',
    'reference': 'https://cs2inspects.com/3d-viewer',
    'input': source.name,
    'sha256': hashlib.sha256(data).hexdigest(),
    'generator': 'scripts/import-c4-animation.py',
    'clip': 'animation/anims/viewmodel/equipment/c4/plant_c4',
    'timing': 'Native 3.8667-second clip sampled across the existing 3.2-second plant.',
    'materials': 'Existing local c4.glb textures with UV quantization transforms removed; existing Phoenix hands retargeted in world space.',
    'limitations': 'Source shaders and Panorama overlay are not reproduced. First-person only; no defuse clip.'
}, indent=2) + '\n')
