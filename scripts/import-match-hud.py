"""Import selected verified native scoreboard/banner media from the Windows export."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("export", type=Path)
args = parser.parse_args()
output = Path("packages/assets/public/ui/match")
output.mkdir(parents=True, exist_ok=True)
aliases = {
    "bluedots_large_png.png": ["bluedots.png"],
    "mvp_banner_fade-both-right-left_png.png": ["mvp-mask.png"],
    "double_arrows.svg": ["double-arrows.svg"],
    "elimination.svg": ["elimination.svg", "dead.svg"],
    "bot.svg": ["bot.svg"], "star.svg": ["star.svg"], "timer.svg": ["timer.svg"],
    "alert.svg": ["alert.svg"], "ct_logo_1c.svg": ["ct.svg"], "t_logo_1c.svg": ["t.svg"],
}
manifest = json.loads((args.export / "runtime-media-provenance.json").read_text())
records = []
for row in manifest["resources"]:
    path = args.export / row.get("output", "")
    if path.name not in aliases:
        continue
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == row["outputSha256"], path
    for name in aliases[path.name]:
        target = output / name
        if path.suffix == ".svg":
            text = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->", "", data.decode("utf-8-sig"), flags=re.S).strip()
            assert not re.search(r"<(?:script|image|foreignObject)\b|(?:href|onload)=", text, re.I)
            target.write_text(text + "\n")
        else:
            Image.open(path).save(target, optimize=True)
        records.append({key: row[key] for key in ["resource", "sourceSha256", "outputSha256"]} | {
            "file": name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bytes": target.stat().st_size,
        })
assert len(records) == sum(map(len, aliases.values())), "Missing native HUD media"
(output / "source.json").write_text(json.dumps({"author": "Valve", "build": "26144732",
    "depotManifest": "67499503218971311", "generator": "scripts/import-match-hud.py",
    "processing": "Native SVG paths preserved; XML/DTD/comments stripped. PNGs losslessly optimized. Dead status aliases the native elimination icon.",
    "files": records}, indent=2) + "\n")
print(f"Imported {len(records)} native match HUD assets")
