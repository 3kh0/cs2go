"""Pack native Windows agent exports into lazy, self-contained runtime models.

python3 scripts/import-agent-roster.py artifacts/agent-roster/windows \
  --gltfpack artifacts/agent-roster/tools/gltfpack
Original game/export files remain read-only inputs. Requires gltfpack 0.24 with BasisU.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import gzip
from functools import lru_cache
import json
import copy
import os
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("--gltfpack", type=Path, required=True)
parser.add_argument("--only", help="Comma-separated model slugs for a reviewed sample import")
parser.add_argument("--metadata-only", action="store_true", help="Regenerate catalog/provenance after verifying the existing packed models")
args = parser.parse_args()
source = args.source.resolve()
output = ROOT / "packages/assets/public/models/agents/roster"
output.mkdir(parents=True, exist_ok=True)
REFERENCE_CLIPS = json.loads(gzip.decompress((ROOT / "packages/assets/public/models/animations/agents/t.json.gz").read_bytes()))
REQUIRED_BONES = {track["name"].rsplit(".",1)[0] for clip in REFERENCE_CLIPS for track in clip["tracks"]}

@lru_cache(maxsize=None)
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

def slug(model):
    return Path(model).name.removesuffix(".vmdl_c").removesuffix(".vmdl").replace("_", "-")

def inspect_glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    data = json.loads(raw[20:20 + size])
    assert raw[:4] == b"glTF" and len(raw) == struct.unpack_from("<I", raw, 8)[0]
    assert not data.get("animations"), f"Unexpected duplicated animation payload: {path}"
    assert data.get("skins"), f"Missing skeleton: {path}"
    names = {node.get("name") for node in data["nodes"]}
    assert names >= REQUIRED_BONES, (path, REQUIRED_BONES - names)
    assert all("uri" not in entry for entry in data.get("buffers", []) + data.get("images", [])), path
    assert "EXT_meshopt_compression" in data.get("extensionsUsed", []), path
    assert "KHR_texture_basisu" in data.get("extensionsUsed", []), path
    return len(data["meshes"]), len(data.get("images", []))

def matrix_product(a,b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]

def world_matrices(doc):
    parents = {child:index for index,node in enumerate(doc["nodes"]) for child in node.get("children",[])}
    result = {}
    def world(index):
        if index in result:return result[index]
        node=doc["nodes"][index]
        matrix=node.get("matrix")
        if matrix is None:
            x,y,z,w=node.get("rotation",[0,0,0,1]);sx,sy,sz=node.get("scale",[1,1,1]);px,py,pz=node.get("translation",[0,0,0])
            matrix=[(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,
                    (2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,
                    (2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,px,py,pz,1]
        result[index]=matrix_product(world(parents[index]),matrix) if index in parents else matrix
        return result[index]
    for index in range(len(doc["nodes"])):world(index)
    return result

def normalize_rig(exported, name):
    # Source2Viewer 20.1 bakes metres/Y-up into its joints, while the existing
    # calibrated Ground Rebel animations retain Source inches under a basis root.
    # Change the skeleton's local frame and inverse binds together; mesh vertices
    # stay in metres and the native unanimated appearance remains identical.
    doc = read(exported)
    original_buffers = [(exported.parent / entry["uri"]).read_bytes() for entry in doc["buffers"]]
    original_worlds = world_matrices(doc)
    root_index = next(index for index, node in enumerate(doc["nodes"]) if node.get("name") == "root_motion")
    root_node = doc["nodes"][root_index]
    root_children = set(root_node.get("children", []))
    descendants = set()
    def visit(index):
        descendants.add(index)
        for child in doc["nodes"][index].get("children", []): visit(child)
    visit(root_index)
    def multiply(a, b):
        x,y,z,w = a; X,Y,Z,W = b
        return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X,
                w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z]
    basis = [-0.5, -0.5, -0.5, 0.5]
    inverse_basis = [0.5, 0.5, 0.5, 0.5]
    root_node["rotation"] = multiply(root_node.get("rotation", [0,0,0,1]), basis)
    root_node["scale"] = [value * 0.0254 for value in root_node.get("scale", [1,1,1])]
    for index in descendants - {root_index}:
        node = doc["nodes"][index]
        assert "mesh" not in node and "matrix" not in node, (name, node)
        position = node.get("translation", [0,0,0])
        if index in root_children:
            position = [position[2], position[0], position[1]]
            node["rotation"] = multiply(inverse_basis, node.get("rotation", [0,0,0,1]))
        node["translation"] = [value / 0.0254 for value in position]
    packed = bytearray()
    normalized = ROOT / "artifacts/agent-roster/normalized" / name
    normalized.mkdir(parents=True, exist_ok=True)
    for entry in doc.get("buffers", []) + doc.get("images", []):
        if "uri" in entry:
            entry["uri"] = os.path.relpath((exported.parent / entry["uri"]).resolve(), normalized)
    bind_checks = []
    for skin in doc["skins"]:
        original = doc["accessors"][skin["inverseBindMatrices"]]
        view = doc["bufferViews"][original["bufferView"]]
        assert original["type"] == "MAT4" and original["componentType"] == 5126
        assert original["count"] == len(skin["joints"])
        offset = view.get("byteOffset",0) + original.get("byteOffset",0)
        start = len(packed)
        for index, joint in enumerate(skin["joints"]):
            assert joint in descendants, (name, doc["nodes"][joint].get("name"))
            values = list(struct.unpack_from("<16f", original_buffers[view.get("buffer",0)], offset + index*view.get("byteStride",64)))
            bind_checks.append((joint, values.copy(), len(packed)))
            for column in range(4):
                a,b,c = values[column*4:column*4+3]
                if joint == root_index: a,b,c = c,a,b
                values[column*4:column*4+3] = [a/0.0254,b/0.0254,c/0.0254]
            packed.extend(struct.pack("<16f", *values))
        view_index = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": len(doc["buffers"]), "byteOffset":start,"byteLength":len(packed)-start})
        accessor = copy.deepcopy(original)
        accessor["bufferView"] = view_index
        accessor.pop("byteOffset",None)
        doc["accessors"].append(accessor)
        skin["inverseBindMatrices"] = len(doc["accessors"])-1
    canonical_worlds = world_matrices(doc)
    error = 0
    for joint, old_inverse, offset in bind_checks:
        old = matrix_product(original_worlds[joint], old_inverse)
        new = matrix_product(canonical_worlds[joint], struct.unpack_from("<16f",packed,offset))
        error = max(error, max(abs(a-b) for a,b in zip(old,new)))
    assert error < 1e-4, (name, "Changed native bind skinning", error)
    (normalized / "binds.bin").write_bytes(packed)
    doc["buffers"].append({"uri":"binds.bin","byteLength":len(packed)})
    for node in doc["nodes"]:
        if "name" in node: node["name"] = node["name"].replace("\\", "/").split("/")[-1]
    write(normalized / "model.gltf", doc)
    return normalized / "model.gltf"

delivered = source / "provenance/delivered-files.json"
if delivered.exists():
    for entry in read(delivered)["files"]:
        path = (source / entry["path"]).resolve()
        assert path.is_relative_to(source) and path.is_file(), entry["path"]
        assert path.stat().st_size == entry["bytes"] and digest(path) == entry["sha256"], ("Changed delivered source",entry["path"])

models = read(source / "inventory/model-groups.json")
if args.only:
    wanted = set(args.only.split(","))
    models = [model for model in models if slug(model["native_model"]) in wanted]
definitions = read(source / "inventory/roster.json")
inputs = []

def pack(record):
    name = slug(record["native_model"])
    native_slug = Path(record["native_model"]).name.removesuffix(".vmdl_c")
    exported = source / "models" / f"{native_slug}.gltf"
    if not exported.exists():
        exported = source / "raw_models" / native_slug / "model.gltf"
    if not exported.exists():
        exported = source / "exports" / native_slug / "model.gltf"
    doc = read(exported)
    assert doc.get("skins") and not doc.get("animations"), exported
    dependencies = [exported]
    for entry in doc.get("buffers", []) + doc.get("images", []):
        if "uri" not in entry:
            continue
        path = (exported.parent / entry["uri"]).resolve()
        assert path.is_relative_to(source), f"External export dependency: {path}"
        assert path.is_file(), path
        dependencies.append(path)
    destination = output / f"{name}.glb"
    normalized = normalize_rig(exported, name)
    subprocess.run([str(args.gltfpack.resolve()), "-i", str(normalized), "-o", str(destination),
                    "-cc", "-kn", "-km", "-vpf", "-tc", "-tl", "1024", "-tq", "8", "-tj", "2"], check=True, capture_output=True)
    meshes, textures = inspect_glb(destination)
    result = {
        "nativeModel": record["native_model"], "nativeSha256": record["sha256"],
        "model": f"/models/agents/roster/{name}.glb", "bytes": destination.stat().st_size,
        "sha256": digest(destination), "meshes": meshes, "textures": textures,
        "selectedMeshes": record["selected_meshes"],
        "inputs": [{"file": str(path.relative_to(source)), "sha256": digest(path), "bytes": path.stat().st_size} for path in dependencies],
    }
    print(name, result["bytes"], flush=True)
    return result

if args.metadata_only:
    packed = read(output / "source.json")["models"]
    assert len(packed) == len(models)
    for item in packed:
        path = output / Path(item["model"]).name
        assert path.stat().st_size == item["bytes"] and digest(path) == item["sha256"], path
else:
    with ThreadPoolExecutor(max_workers=3) as pool:
        packed = list(pool.map(pack, models))
by_model = {item["nativeModel"].removesuffix("_c"): item for item in packed}
catalog = []
seen = set()
for definition in definitions:
    model = by_model.get(definition["native_model"])
    if model is None:
        continue
    teams = definition.get("teams") or {}
    for native_team, team in [("terrorists", "t"), ("counter-terrorists", "ct")]:
        if not teams.get(native_team) or str(teams[native_team]) == "0":
            continue
        # Legacy schema aliases retain separate names but share exactly one model payload.
        identity = f"agent-{definition['id']}-{team}"
        assert identity not in seen
        seen.add(identity)
        title = definition.get("display_name") or re.sub(r"[_-]+", " ", definition["name"].removeprefix("customplayer_")).title()
        category = "base" if definition["resolved"].get("legacy_character") == "1" else "cosmetic"
        if category == "base":
            faction = Path(definition["native_model"]).parent.name
            faction = {"tm_phoenix":"Phoenix", "tm_leet":"Elite Crew", "ctm_sas":"SAS", "ctm_fbi":"FBI"}.get(faction,faction.replace("_"," ").title())
            variant = re.search(r"_variant([a-z0-9]+)\.vmdl$",definition["native_model"])
            title = f"{faction} | Default" + (f" · Variant {variant.group(1).upper()}" if variant else "")
        catalog.append({"id": identity, "name": title, "nativeName":definition.get("display_name"), "category":category, "team": team, "model": model["model"],
                        "nativeModel": model["nativeModel"], "bytes": model["bytes"]})
write(output / "catalog.json", catalog)
write(output / "source.json", {
    "author": "Valve", "build": "26144732", "patch": "1.41.9.2", "depotManifest": "67499503218971311",
    "source": "Installed CS2 agents/models resources, scripts/items/items_game.txt and resource/csgo_english.txt",
    "generator": "scripts/import-agent-roster.py", "gltfpack": "0.24", "gltfpackSha256":digest(args.gltfpack.resolve()), "nativeTool": "Source2Viewer 20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304",
    "processing": "Native default third-person mesh groups with skin bindings, no animation payload. Skeletons and inverse bind matrices are converted together into the existing calibrated Source-inch basis, retaining metre-space geometry and native bind appearance. Meshopt compression, floating-point positions, BasisU ETC1S KTX2 textures at up to1024px/quality8. Model aliases share files. Production additionally wraps GLB bytes in deterministic gzip and serves immutable SHA256 releases from R2.",
    "limitations": "Agent material/lighting approximation in Three.js. Native Source2 bones reuse calibrated Ground Rebel animations; proportions are approximate. First-person sleeves/gloves and voice packs remain the existing ones. Non-schema installed model(s) are retained as imported assets but not offered as an unnamed cosmetic.",
    "aliasAudit": {
        "definitionsChecked": len(definitions),
        "modelSelection": "model_player only; cosmetic icon display model equals model_player; no nested skin/style/body/material selectors",
        "nativeMaterialGroups": "All80 model material-group arrays are empty",
        "meshSelection": "Default native masks1/5/17 allselect thirdperson_body + thirdperson_default_gloves",
        "sharedModels": [{"nativeModel":item["native_model"],"definitionIds":item["definition_ids"]} for item in models if len(item["definition_ids"])>1],
    },
    "deliveryManifestSha256": digest(delivered) if delivered.exists() else None,
    "eyeBakes": read(source / "provenance/eye-bakes.json") if (source / "provenance/eye-bakes.json").exists() else [],
    "catalogSha256": digest(output / "catalog.json"), "definitions": len(catalog), "models": packed,
})
print(f"Imported {len(catalog)} choices across {len(packed)} unique models; {sum(item['bytes'] for item in packed):,} bytes total")
