"""Meshopt-compress weapon and agent GLBs in place after importing them.
Usage: python3 scripts/compress-models.py /path/to/gltfpack [model.glb ...]
Run on freshly converted models (convert-weapons.py, convert-knife.py,
import-agents.py). Node hierarchy, names, extras (muzzle offsets), materials,
float positions and original animation sampling stay as weapons.ts and
soldier.ts expect; normals, UVs and animation keys are quantized.
"""
import pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parents[1]
gltfpack, *names = sys.argv[1:]
models = [pathlib.Path(n) for n in names] or sorted((root / 'packages/assets/public/models').glob('*.glb')) + sorted((root / 'packages/assets/public/models/agents').glob('*.glb'))
for model in models:
    before = model.stat().st_size
    subprocess.run([gltfpack, '-i', str(model), '-o', str(model), '-cc', '-kn', '-km', '-ke', '-vpf', '-af', '0'], check=True)
    print(f'{model.name}: {before:,} -> {model.stat().st_size:,} bytes')
