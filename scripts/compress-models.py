"""Meshopt-compress weapon and agent GLBs in place after importing them.
Usage: python3 scripts/compress-models.py /path/to/gltfpack [model.glb ...]
Run once on freshly converted models (convert-weapons.py, convert-knife.py,
import-agents.py); repeated runs requantize geometry. Named nodes, materials
and original animation sampling are kept for weapons.ts and soldier.ts.
"""
import pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parents[1]
gltfpack, *names = sys.argv[1:]
models = [pathlib.Path(n) for n in names] or sorted((root / 'public/models').glob('*.glb')) + sorted((root / 'public/models/agents').glob('*.glb'))
for model in models:
    before = model.stat().st_size
    subprocess.run([gltfpack, '-i', str(model), '-o', str(model), '-cc', '-kn', '-km', '-af', '0'], check=True)
    print(f'{model.name}: {before:,} -> {model.stat().st_size:,} bytes')
