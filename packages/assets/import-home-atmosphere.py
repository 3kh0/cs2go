"""Prepare verified Source 2 Viewer home-atmosphere exports for the browser.

Usage: python3 packages/assets/import-home-atmosphere.py EXPORT_DIRECTORY
See public/models/home/atmosphere/README.md for the native export procedure.
Requires Pillow for lossless PNG packing. Inputs are never modified.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
from PIL import Image

source = Path(sys.argv[1])
target = Path(__file__).parent / "public/models/home/atmosphere"
target.mkdir(parents=True, exist_ok=True)


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def geometry_glb(path):
    raw = path.read_bytes()
    length = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    offset = 20 + length
    binary_length, kind = struct.unpack_from("<II", raw, offset)
    assert kind == 0x004E4942
    binary = bytearray(raw[offset + 8:offset + 8 + binary_length])
    seen = set()
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            primitive.pop("material", None)
            for semantic in ("POSITION", "NORMAL", "TANGENT"):
                index = primitive["attributes"].get(semantic)
                if index is None or index in seen:
                    continue
                seen.add(index)
                accessor = doc["accessors"][index]
                assert accessor["componentType"] == 5126
                view = doc["bufferViews"][accessor["bufferView"]]
                n = 4 if semantic == "TANGENT" else 3
                stride = view.get("byteStride", n * 4)
                start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                values = []
                for i in range(accessor["count"]):
                    p = start + stride * i
                    x, y, z, *w = struct.unpack_from("<" + "f" * n, binary, p)
                    scale = 0.0254 if semantic == "POSITION" else 1
                    value = (x * scale, z * scale, -y * scale, *w)
                    struct.pack_into("<" + "f" * n, binary, p, *value)
                    values.append(value)
                if "min" in accessor:
                    accessor["min"] = [min(v[c] for v in values) for c in range(n)]
                    accessor["max"] = [max(v[c] for v in values) for c in range(n)]
    for key in ("materials", "textures", "images", "samplers"):
        doc.pop(key, None)
    doc["asset"]["extras"] = {
        "sourceResource": doc["asset"]["extras"]["sourceResource"],
        "conversion": "Source XYZ inches to (X,Z,-Y) metres; UVs, topology and vertex RGBA unchanged",
    }
    packed = json.dumps(doc, separators=(",", ":")).encode()
    packed += b" " * (-len(packed) % 4)
    return (struct.pack("<III", 0x46546C67, 2, 28 + len(packed) + len(binary))
            + struct.pack("<II", len(packed), 0x4E4F534A) + packed
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


manifest = read(source / "asset-manifest.json")
placements = {Path(x["resource"]).stem: x for x in read(source / "provenance/backdrop-placement-tint.json")}
assets = {"backdrops": [], "paper": [], "textures": {}, "materials": {}}
inputs = {}


def copy_texture(path):
    key = path.stem
    relative = "textures/" + path.name
    (target / "textures").mkdir(exist_ok=True)
    image = Image.open(path)
    if "_mask_" in key:
        # The shader samples only R. All native mask RGB lanes are identical;
        # keeping one lane preserves every sampled value and cuts startup I/O.
        image = image.getchannel("R")
    image.save(target / relative, compress_level=9)
    assets["textures"][key] = relative
    inputs[str(path.relative_to(source))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return key


for entry in manifest["models"]:
    path = source / entry["path"]
    destination = target / entry["path"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(geometry_glb(path))
    inputs[entry["path"]] = hashlib.sha256(path.read_bytes()).hexdigest()
    if entry["path"].startswith("backdrops/"):
        draw = placements[path.stem]["scene_objects"][0]["m_drawCalls"][0]
        assets["backdrops"].append({"file": entry["path"], "material": Path(draw["m_material"]).stem, "tint": draw["m_vTintColor"]})
    else:
        assets["paper"].append(entry["path"])

for name, material in read(source / "provenance/haze-materials.json").items():
    floats = {x["m_name"]: x["m_flValue"] for x in material["m_floatParams"]}
    vectors = {x["m_name"]: x["m_value"] for x in material["m_vectorParams"]}
    textures = {x["m_name"]: Path(x["m_pValue"]).stem for x in material["m_textureParams"]}
    masks = []
    for i in range(1, 4):
        mask = textures[f"g_tMask{i}"]
        masks.append("white" if "_vmat_" in mask else copy_texture(source / "textures" / (mask + ".png")))
    assets["materials"][name] = {
        "masks": masks,
        "pan": [vectors[f"g_vMask{i}PanSpeed"][:2] for i in range(1, 4)],
        "scale": [vectors[f"g_vMask{i}Scale"][:2] for i in range(1, 4)],
        "tint": vectors["g_vColorTint"][:3],
        "opacity": floats["g_flOpacityScale"], "feather": floats["g_flFeatherDistance"],
        "fresnel": floats["g_flFresnelExponent"], "falloff": floats["g_flFresnelFalloff"],
    }

assets["paperMaterial"] = dict(zip(("color", "normal", "orm"), [copy_texture(source / "paper" / name) for name in (
    "peeled_paper_color_psd_ae600fce.png", "peeled_paper_dirty_normal_psd_c87c7d39.png", "default_ao_tga_559f1ac6_orm_1423565888.png")]))

# The authored second color texture's selected blend curve is constant one.
# Keep all four of its native second-sequence choices and packed crop rectangles.
sheet = read(source / "sprite-sequences.json")["wispy_steam_burst_b"]
frames = []
for sequence in sheet["sequences"]:
    assert len(sequence["frames"]) == 26
    for frame in sequence["frames"]:
        image = frame["images"][0]
        low, high = image["uncroppedMin"], image["uncroppedMax"]
        crop_low, crop_high = image["croppedMin"], image["croppedMax"]
        frames.append({"uvMin": crop_low, "uvMax": crop_high,
            "uncroppedMin": [(crop_low[i] - low[i]) / (high[i] - low[i]) for i in range(2)],
            "uncroppedMax": [(crop_high[i] - low[i]) / (high[i] - low[i]) for i in range(2)]})
assets["dust"] = {"texture": copy_texture(source / "textures/wispy_steam_burst_b.png"), "frames": frames}
write(target / "source.json", assets)
write(target / "native-source.json", {
    "resources": read(source / "provenance/verified-native-resources.json"),
    "materials": read(source / "provenance/haze-materials.json"),
    "placements": read(source / "provenance/backdrop-placement-tint.json"),
})
write(target / "provenance.json", {"tool": read(source / "provenance/tool.json"), "exportedInputSha256": inputs,
    "modelValidation": manifest["models"], "nativeShader": "https://github.com/ValveResourceFormat/ValveResourceFormat/blob/9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304/Renderer/Shaders/csgo_effects.frag.slang"})
print(f"Prepared {len(assets['backdrops'])} native backdrops, {len(assets['paper'])} paper models and {len(assets['textures'])} shared textures")
