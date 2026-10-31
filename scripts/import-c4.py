"""Import Valve's CS2 C4 from the same pinned Steam depot as Dust II.

Requires DepotDownloader 3.4, Source2Viewer CLI 20.0, gltfpack 0.24, Pillow.
Usage: python3 scripts/import-c4.py --depotdownloader /path/to/DepotDownloader
       --cli /path/to/Source2Viewer-CLI --gltfpack /path/to/gltfpack
"""

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--depotdownloader", required=True)
parser.add_argument("--cli", required=True)
parser.add_argument("--gltfpack", required=True)
args = parser.parse_args()
root = pathlib.Path("artifacts/c4-import").resolve()
root.mkdir(parents=True, exist_ok=True)
depot = root / "depot"
model = "weapons/models/c4/weapon_c4.vmdl_c"
manifest = "4758919807587010422"


def run(*command):
    subprocess.run(list(map(str, command)), check=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


if not (depot / "game/csgo/pak01_dir.vpk").exists():
    listing = root / "initial-files.txt"
    listing.write_text(
        "\n".join(
            f"game/{game}/{name}"
            for game in ["csgo", "core"]
            for name in ["pak01_dir.vpk", "gameinfo.gi"]
        )
    )
    run(
        args.depotdownloader,
        "-app",
        "730",
        "-depot",
        "2347770",
        "-manifest",
        manifest,
        "-os",
        "windows",
        "-filelist",
        listing,
        "-dir",
        depot,
        "-validate",
    )
run(
    sys.executable,
    "scripts/fetch-cs2-dependencies.py",
    root,
    args.depotdownloader,
    model,
)
if not (root / "export.gltf").exists():
    run(
        args.cli,
        "-i",
        depot / "game/csgo/pak01_dir.vpk",
        "--vpk_filepath",
        model,
        "-d",
        "--gltf_export_format",
        "gltf",
        "--gltf_export_materials",
        "--gltf_textures_adapt",
        "--gltf_export_extras",
        "--game",
        depot / "game/csgo/gameinfo.gi",
        "-o",
        root / "export.gltf",
    )

doc = json.loads((root / "export.gltf").read_text())
doc.pop("animations", None)
# Panorama supplies this overlay in Source 2; its export is a developer test grid.
# Keep the separate native LCD surface beneath it instead.
for mesh in doc["meshes"]:
    mesh["primitives"] = [
        p
        for p in mesh["primitives"]
        if doc["materials"][p["material"]]["name"] != "c4_panorama_control_panel"
    ]
for material in doc["materials"]:
    if material["name"] == "weapon_c4_digits":
        material.pop("occlusionTexture", None)  # Source's default AO exports as zero.
        material.pop("normalTexture", None)
        material["pbrMetallicRoughness"].pop("metallicRoughnessTexture", None)
        material["pbrMetallicRoughness"].update(metallicFactor=0, roughnessFactor=0.8)
(root / "prepared.gltf").write_text(json.dumps(doc))
output = pathlib.Path("packages/assets/public/models/c4.glb")
run(sys.executable, "scripts/pack-agents.py", root / "prepared.gltf", output)
run(sys.executable, "scripts/compress-models.py", args.gltfpack, output)
inputs = root / "extracted"
pathlib.Path("packages/assets/public/models/c4.source.json").write_text(
    json.dumps(
        {
            "author": "Valve",
            "source": "CS2 Steam depot; inspect.skin does not list C4 and the CSGOSKINS page was blocked during Playwright discovery.",
            "app": 730,
            "depot": 2347770,
            "depotManifest": manifest,
            "resource": model,
            "generator": "scripts/import-c4.py",
            "tools": {"Source2Viewer": "20.0.6980", "gltfpack": "0.24"},
            "inputs": {
                str(p.relative_to(inputs)): sha(p)
                for p in sorted(inputs.rglob("*"))
                if p.is_file()
            },
            "runtime": {"bytes": output.stat().st_size, "sha256": sha(output)},
            "processing": "Source2Viewer exports in meters with glTF texture adaptation; embedded WebP at up to 1024px; meshopt geometry compression. Developer Panorama overlay removed; native LCD retained with default AO corrected.",
            "limitations": "Three.js PBR approximates Source 2 materials; native LCD atlas selects the planted code, and the LED pulses on the existing game beep clock. No first-person planting animation.",
        },
        indent=2,
    )
    + "\n"
)
