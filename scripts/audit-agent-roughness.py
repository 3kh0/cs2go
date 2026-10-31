"""Find missing roughness in the read-only native agent exports.

python3 scripts/audit-agent-roughness.py artifacts/agent-roster/windows/models \
  > apps/game/src/data/agent-roughness.json
Requires Pillow. Valid roughness, AO, and metalness maps remain unchanged.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("models", type=Path)
args = parser.parse_args()
missing, valid = {}, set()
for path in sorted(args.models.glob("*.gltf")):
    model = json.loads(path.read_text())
    for material in model.get("materials", []):
        packed = material.get("pbrMetallicRoughness", {}).get("metallicRoughnessTexture")
        if packed is None:
            continue
        texture = model["textures"][packed["index"]]
        image_path = path.parent / model["images"][texture["source"]]["uri"]
        with Image.open(image_path) as image:
            empty = image.getextrema()[1] == (0, 0)
        name = material["name"]
        if not empty:
            valid.add(name)
            continue
        native = material.get("extras", {}).get("vmat", {})
        cloth = native.get("IntParams", {}).get("F_CLOTH_SHADING", 0)
        # Authored fallback for Source2 anisotropic gloss absent from glTF.
        missing[name] = 0.85 if cloth else 0.65
assert not valid.intersection(missing), "Conflicting roughness maps for the same material name"
assert missing, "No missing roughness maps found; check the input directory"
print(json.dumps(dict(sorted(missing.items())), indent=2))
