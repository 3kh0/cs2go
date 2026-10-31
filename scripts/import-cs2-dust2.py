"""Import the pinned CS2 Dust II Steam depot into local web assets.
Requires DepotDownloader 3.4, Source2Viewer CLI 20.0, .NET 10, native gltfpack
0.24, Bun, Python Pillow/numpy. Downloads and intermediates stay in artifacts.
The default is resumable; --rebuild repeats conversions using cached downloads.
"""

import argparse
import gzip
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--depotdownloader", required=True)
parser.add_argument("--cli", required=True)
parser.add_argument("--dotnet", default="dotnet")
parser.add_argument("--gltfpack", required=True)
parser.add_argument(
    "--cache", type=pathlib.Path, default=pathlib.Path("artifacts/cs2-dust-import")
)
parser.add_argument("--rebuild", action="store_true")
a = parser.parse_args()
root = a.cache.resolve()
root.mkdir(parents=True, exist_ok=True)
depot, extracted = root / "depot", root / "extracted"
vpk = depot / "game/csgo/maps/de_dust2.vpk"
manifest = "4758919807587010422"


def run(*command, log=None):
    print("Running", " ".join(map(str, command)), flush=True)
    if log:
        with (root / log).open("w") as output:
            subprocess.run(
                list(map(str, command)),
                check=True,
                stdout=output,
                stderr=subprocess.STDOUT,
            )
    else:
        subprocess.run(list(map(str, command)), check=True)


def python(script, *args):
    run(sys.executable, "scripts/" + script, *args)


def missing(name):
    return a.rebuild or not (root / name).exists()


if not vpk.exists():
    files = [
        "game/csgo/maps/de_dust2.vpk",
        "game/csgo/pak01_dir.vpk",
        "game/core/pak01_dir.vpk",
        "game/csgo/gameinfo.gi",
        "game/core/gameinfo.gi",
    ]
    listing = root / "initial-files.txt"
    listing.write_text("\n".join(files))
    run(
        a.depotdownloader,
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
        log="download.log",
    )
if not (extracted / "maps/de_dust2/world.vwrld_c").exists():
    run(a.cli, "-i", vpk, "-o", extracted, log="extract.log")
python("fetch-cs2-dependencies.py", root, a.depotdownloader)
if missing("export.gltf"):
    run(
        a.cli,
        "-i",
        vpk,
        "--vpk_filepath",
        "maps/de_dust2/world.vwrld_c",
        "-d",
        "--gltf_export_format",
        "gltf",
        "--gltf_export_materials",
        "--gltf_textures_adapt",
        "--gltf_export_extras",
        "--game",
        depot / "game/csgo/gameinfo.gi",
        "-o",
        root / "export",
        log="export.log",
    )
python("repair-cs2-materials.py", root, a.cli)
for source, name in [
    ("world_physics", "physics"),
    ("entities/unnamed_2_23316", "site-a"),
    ("entities/unnamed_2_23326", "site-b"),
]:
    if missing(name + "_physics.gltf"):
        run(
            a.cli,
            "-i",
            extracted / f"maps/de_dust2/{source}.vmdl_c",
            "-d",
            "--gltf_export_format",
            "gltf",
            "-o",
            root / (name + ".gltf"),
            log=name + "-export.log",
        )
run(
    a.dotnet,
    "run",
    "--project",
    "scripts/cs2-mapdata",
    "--",
    extracted / "maps/de_dust2.nav",
    root / "nav-raw.json",
    extracted / "maps/de_dust2/entities/default_ents.vents_c",
    root / "entities.txt",
)
python("prepare-cs2-nav.py", root, root / "dust2-nav.json")
if missing("simplified.gltf"):
    run(
        "bun",
        "scripts/simplify-cs2-props.mjs",
        root / "export.gltf",
        root / "simplified.gltf",
    )
if missing("batched.gltf"):
    python(
        "prepare-cs2-map.py",
        root / "simplified.gltf",
        root / "dust2-nav.json",
        root / "batched.gltf",
    )
if missing("maps/dust2-packed.glb"):
    python("pack-agents.py", root / "batched.gltf", root / "maps/dust2.glb")
    run(
        a.gltfpack,
        "-i",
        root / "maps/dust2.glb",
        "-o",
        root / "maps/dust2-packed.glb",
        "-cc",
        "-km",
        "-vp",
        "16",
        "-vt",
        "16",
        "-tc",
    )
python(
    "prepare-cs2-physics.py",
    root / "physics_physics.gltf",
    root / "dust2-nav.json",
    root / "physics-cropped.gltf",
)
run(
    a.gltfpack,
    "-i",
    root / "physics-cropped.gltf",
    "-o",
    root / "dust2-physics.glb",
    "-cc",
    "-kn",
    "-ke",
    "-vp",
    "20",
)

output = pathlib.Path("packages/assets/public/models/maps")
output.mkdir(parents=True, exist_ok=True)
for source, name in [
    ("maps/dust2-packed.glb", "dust2.glb.gz"),
    ("dust2-physics.glb", "dust2-physics.glb.gz"),
]:
    (output / name).write_bytes(
        gzip.compress((root / source).read_bytes(), compresslevel=9, mtime=0)
    )
shutil.copyfile(root / "dust2-nav.json", output / "dust2-nav.json")
run("bun", "run", "--bun", "oxfmt", output / "dust2-nav.json")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(path):
    doc = json.loads(path.read_text())
    return sum(
        doc["accessors"][p["indices"]]["count"] // 3
        for m in doc["meshes"]
        for p in m["primitives"]
    )


provenance = {
    "author": "Valve",
    "version": "CS2 Dust II, Steam depot manifest dated 2026-10-08",
    "source": "Anonymous Steam CDN download through DepotDownloader 3.4.0",
    "app": 730,
    "depot": 2347770,
    "depotManifest": manifest,
    "references": [
        "https://steamdb.info/depot/2347770/",
        "https://github.com/SteamRE/DepotDownloader",
        "https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.0",
    ],
    "files": {
        "de_dust2.vpk": sha(vpk),
        "de_dust2.nav": sha(extracted / "maps/de_dust2.nav"),
    },
    "tools": {
        "Source2Viewer": "20.0.6980",
        "ValveResourceFormat": "20.0.6980",
        "gltfpack": "0.24",
    },
    "optimization": {
        "originalTriangles": triangles(root / "export.gltf"),
        "runtimeTriangles": triangles(root / "batched.gltf"),
        "physicsTriangles": triangles(root / "physics-cropped.gltf"),
        "propTarget": 0.3,
        "propRelativeErrorLimit": 0.005,
        "textureMaxDimension": "1024 architecture / 512 props, ETC1S KTX2",
        "geometry": "meshopt, 16-bit rendering positions/UV, 20-bit physics positions",
    },
    "navigation": {
        "version": 36,
        "areas": len(json.loads((root / "dust2-nav.json").read_text())["areas"]),
        "geometry": "Native convex polygons, directed links and edge portals",
    },
    "runtime": {
        name: {"bytes": (output / name).stat().st_size, "sha256": sha(output / name)}
        for name in ["dust2.glb.gz", "dust2-physics.glb.gz", "dust2-nav.json"]
    },
    "limitations": [
        "Standard PBR approximates Source 2 layered shaders; baked lightmaps, probe volumes and animated foliage are not reproduced; smoke/lightshaft effect cards are excluded.",
        "Distant geometry cropped beyond navigation bounds plus 40 m. Detailed props simplified; native world physics is not simplified.",
        "Playerclip and passbullets surfaces affect movement only. Browser collision approximates the Source player hull; dynamic physics is not reproduced.",
        "AI is authored, not Valve bot code. Native NAV cover annotations are not imported.",
        "Missing dependencies are obsolete baker cubemap cache references; runtime uses local lighting.",
    ],
}
(output / "source-manifest.json").write_text(json.dumps(provenance, indent=2) + "\n")
print(json.dumps(provenance["runtime"], indent=2))
