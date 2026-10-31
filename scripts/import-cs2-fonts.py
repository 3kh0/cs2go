"""Convert the verified native Stratum2 faces to local WOFF2, retaining names/glyphs."""

import argparse
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Extracted native UI evidence directory")
    args = parser.parse_args()
    audit = json.loads((args.export / "audit.json").read_text())
    source = audit["ui"]["font"]
    fonts = args.export / "ui-pack/panorama/fonts"
    package = fonts / "stratum2.uifont"
    assert digest(package) == source["sourceSha256"], "Native font package hash mismatch"
    output = Path("packages/assets/public/fonts/cs2")
    output.mkdir(parents=True, exist_ok=True)
    records = []
    rules = []
    for item in source["decodedFonts"]:
        path = args.export / item["output"]
        # TF faces are duplicate UI variants; use standard, condensed and numeric families.
        if "_tf_" in path.name:
            continue
        assert digest(path) == item["sha256"], f"Decoded font hash mismatch: {path.name}"
        font = TTFont(path, recalcTimestamp=False)
        family = (
            "Stratum2 Condensed" if "condensed" in path.name
            else "Stratum2 Monodigit" if "monodigit" in path.name
            else "Stratum2 Mono" if "mono-" in path.name
            else "Stratum2"
        )
        style = "italic" if "italic" in path.name else "normal"
        weight = font["OS/2"].usWeightClass
        target = output / (path.stem + ".woff2")
        font.flavor = "woff2"
        font.save(target)
        records.append({**item, "output": target.name, "decoded": path.name,
                        "outputSha256": digest(target), "outputBytes": target.stat().st_size,
                        "family": family, "weight": weight, "style": style})
        rules.append(f'@font-face {{\n  font-family: "{family}";\n  font-style: {style};\n'
                     f'  font-weight: {weight};\n  font-display: swap;\n'
                     f'  src: url(/fonts/cs2/{target.name}) format("woff2");\n}}')
    (output / "source.json").write_text(json.dumps({
        "source": "panorama/fonts/stratum2.uifont", "sourceSha256": source["sourceSha256"],
        "build": audit["provenance"]["identity"]["steamBuildId"],
        "attribution": "Stratum2 by Process Type Foundry; native package licensed to Valve Corporation.",
        "conversion": "fontTools WOFF2 compression; glyphs and native naming/license records retained",
        "fonts": records,
    }, indent=2) + "\n")
    Path("apps/game/src/fonts.css").write_text("\n".join(rules) + "\n")
    print(f"Imported {len(records)} native font faces")


if __name__ == "__main__":
    main()
