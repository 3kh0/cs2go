"""Pack the verified native Dust II vanity export with local WebP textures."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("export", type=Path)
parser.add_argument("--gltfpack", type=Path, required=True)
args = parser.parse_args()
root = args.export
scratch = Path("artifacts/homepage/packed")
scratch.mkdir(parents=True, exist_ok=True)
output = Path("packages/assets/public/models/home")
output.mkdir(parents=True, exist_ok=True)
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for row in json.loads((root / "files-sha256.json").read_text()):
    assert digest(root / row["file"]) == row["sha256"], row["file"]
raw = (root / "de_dust2_vanity.glb").read_bytes()
assert struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw))
length = struct.unpack_from("<I", raw, 12)[0]
doc = json.loads(raw[20:20 + length])
# Source effect cards require shader masks; exporting them as opaque PBR planes
# hides the scene and the agent's feet. Keep visual architecture/props only.
removed = []
for mesh in doc["meshes"]:
    visible = []
    for primitive in mesh["primitives"]:
        material = doc["materials"][primitive["material"]]
        source = material.get("extras", {}).get("vmat", {})
        name = source.get("Name", material.get("name", ""))
        if source.get("ShaderName") == "csgo_foliage.vfx":
            # Source foliage colors encode wind weights, not surface tint.
            primitive["attributes"].pop("COLOR_0", None)
        if source.get("ShaderName") == "csgo_effects.vfx" or any(term in name for term in ["/tools/", "/dev/"]):
            removed.append(name)
        else:
            visible.append(primitive)
    mesh["primitives"] = visible
for node in doc["nodes"]:
    if "mesh" in node and not doc["meshes"][node["mesh"]]["primitives"]:
        del node["mesh"]
binary = raw[28 + length:]
(scratch / "scene.bin").write_bytes(binary)
doc["buffers"] = [{"byteLength": len(binary), "uri": "scene.bin"}]

cached = {}
if (output / "source.json").exists():
    cached = {row["source"]: row for row in json.loads((output / "source.json").read_text())["images"]}

def convert(image):
    source = root / image["uri"]
    target = scratch / (source.stem + ".webp")
    linear = any(term in source.stem for term in ["normal", "_orm_", "metalness", "roughness", "_ao_"])
    previous = cached.get(source.name)
    if not (previous and target.exists() and digest(source) == previous["sourceSha256"] and digest(target) == previous["sha256"]):
        with Image.open(source) as bitmap:
            bitmap.save(target, lossless=linear, quality=90, method=6)
    image["uri"] = target.name
    image["mimeType"] = "image/webp"
    return {"source": source.name, "sourceSha256": digest(source), "file": target.name,
            "sha256": digest(target), "bytes": target.stat().st_size, "lossless": linear}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    images = list(pool.map(convert, doc["images"]))
for texture in doc["textures"]:
    texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": texture.pop("source")}
for key in ["extensionsUsed", "extensionsRequired"]:
    doc.setdefault(key, [])
    if "EXT_texture_webp" not in doc[key]:
        doc[key].append("EXT_texture_webp")
(scratch / "scene.gltf").write_text(json.dumps(doc))
subprocess.run([str(args.gltfpack), "-i", str(scratch / "scene.gltf"), "-o", str(output / "dust2.glb"),
                "-cc", "-vpf"], check=True)
provenance = json.loads((root / "source-provenance.json").read_text())
(output / "source.json").write_text(json.dumps({
    "author": "Valve", "scene": "maps/de_dust2_vanity.vpk", "build": "26144732",
    "depotManifest": "67499503218971311", "exportSha256": hashlib.sha256(raw).hexdigest(),
    "provenanceFileSha256": digest(root / "source-provenance.json"),
    "generator": "scripts/import-home-world.py", "gltfpack": "0.24",
    "processing": "Native visual geometry and PBR materials; invisible tools removed on Windows; textures capped at 512px. Color textures WebP quality 90, linear normal/ORM textures lossless. Meshopt compression and static batching. Coordinates remain (Source y,z,x) metres; runtime rotates Y +90 degrees to match agent coordinates.",
    "limitations": "Source2Viewer materials with authored Three.js lighting; native lightmaps, shadows, depth of field and engine shaders are not reproduced exactly.",
    "removedNonVisualMaterials": sorted(set(removed)),
    "images": images, "outputSha256": digest(output / "dust2.glb"),
    "outputBytes": (output / "dust2.glb").stat().st_size,
}, indent=2) + "\n")
print(f"Packed native home scene: {(output / 'dust2.glb').stat().st_size:,} bytes")
