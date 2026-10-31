"""Import the small verified CS2 homepage icon/background exports (Pillow)."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("export", type=Path)
args = parser.parse_args()
output = Path("packages/assets/public/ui/home")
output.mkdir(parents=True, exist_ok=True)
records = []
names = {f"{n}.svg": f"{n}.svg" for n in ["home", "watch_tv", "settings", "power", "settings_sliders"]}
names.update({"linemap_png.png": "linemap.png", "de_dust2_png.png": "dust2.webp"})
for row in json.loads((args.export / "resources.json").read_text()):
    path = args.export / row.get("output", "")
    if path.name not in names or (path.name == "de_dust2_png.png" and "/720p/" not in str(path)):
        continue
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == row["outputSha256"], path.name
    target = output / names[path.name]
    if path.suffix == ".svg":
        text = data.decode("utf-8-sig")
        text = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->", "", text, flags=re.S).strip()
        assert not re.search(r"<(?:script|foreignObject|image)\b|(?:href|onload)=", text, re.I)
        target.write_text(text + "\n")
    elif target.suffix == ".webp":
        Image.open(path).save(target, quality=90, method=6)
    else:
        Image.open(path).save(target, optimize=True)
    records.append({k: row[k] for k in ["resource", "sourceSha256", "outputSha256"]} | {
        "file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "bytes": target.stat().st_size,
    })
assert len(records) == len(names), "Missing native homepage media"
(output / "source.json").write_text(json.dumps({"author": "Valve", "build": "26144732",
    "depotManifest": "67499503218971311", "generator": "scripts/import-home-media.py",
    "processing": "Native SVG geometry retained; XML declarations/DTDs/comments removed. Native screenshot encoded as WebP; navbar texture lossless PNG.",
    "files": records}, indent=2) + "\n")
print(f"Imported {len(records)} native homepage assets")
