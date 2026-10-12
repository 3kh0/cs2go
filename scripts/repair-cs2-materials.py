"""Restore Source material constants and alpha that VRF 20's adapted export omits.
Run after exporting and before simplification; original compiled inputs stay intact.
"""

import concurrent.futures
import json
import pathlib
import subprocess
import sys

cache, cli = pathlib.Path(sys.argv[1]), sys.argv[2]
doc = json.loads((cache / "export.gltf").read_text())
textures = set()
for material in doc["materials"]:
    if material.get("alphaMode") not in ("MASK", "BLEND"):
        continue
    vmat = material["extras"]["vmat"]
    name = vmat.get("TextureParams", {}).get("g_tColor")
    if name:
        textures.add(name)


def restore(name):
    source = cache / "extracted" / (name + "_c")
    if not source.exists():
        raise FileNotFoundError(source)
    # Native decode retains opacity; adapted base color PNGs incorrectly lose it.
    subprocess.run(
        [cli, "-i", str(source), "-d", "-o", str(cache / "alpha.png")],
        check=True,
        stdout=subprocess.DEVNULL,
    )


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(restore, sorted(textures)))
print("Restored native alpha for", len(textures), "textures")
