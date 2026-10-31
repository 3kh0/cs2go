"""Repair only the audited Dust II lantern; never repack geometry/other textures.

python scripts/patch-cs2-lantern.py original.glb.gz native-orm.png fixed.glb.gz --evidence repair.json

Requires Pillow. Input PNG is the unmodified Source2Viewer 20.1 adapted export
recorded in models/maps/source-manifest.json (lanternCorrection). Both inputs
are hash-pinned; rejects other maps/images and already repaired maps.
"""
import argparse
import copy
import gzip
import hashlib
import io
import json
import pathlib
import struct

from PIL import Image, ImageStat

MAP_SHA256 = "de5b27a731ddddfd4b9771bd6449f0678f0cf0406b2730a80a5cc108c02a8090"
GLB_SHA256 = "d4d1852424bf7ce4290ad08566f0386dd872a1a0fd650f4debbec197379572ef"
PNG_SHA256 = "0da39a0354e4280e44db39daab19db40b59945ba73aee63a139d8d88b1830408"
OLD_ORM_SHA256 = "b5b9bf3939846d936a0b5f406a50ee1ed0e96d29957877bf4ab98b0767bc369a"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unpack(raw):
    require(struct.unpack_from("<4sII", raw) == (b"glTF", 2, len(raw)), "Invalid GLB header")
    size, kind = struct.unpack_from("<I4s", raw, 12)
    require(kind == b"JSON", "Missing JSON chunk")
    bin_size, kind = struct.unpack_from("<I4s", raw, 20 + size)
    require(kind == b"BIN\0" and bin_size == len(raw) - size - 28, "Invalid BIN chunk")
    return raw[20:20 + size], raw[28 + size:]


def image_bytes(doc, blob, index):
    view = doc["bufferViews"][doc["images"][index]["bufferView"]]
    require(view.get("buffer", 0) == 0, "Image in unexpected buffer")
    return blob[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]


def patch(compressed, png):
    require(sha(compressed) == MAP_SHA256, "Not the audited original map (or already patched)")
    require(sha(png) == PNG_SHA256, "Not the verified native adapted ORM PNG")
    raw = gzip.decompress(compressed)
    require(sha(raw) == GLB_SHA256, "Decoded GLB hash mismatch")
    encoded, blob = unpack(raw)
    original = json.loads(encoded)
    doc = copy.deepcopy(original)
    material = doc["materials"][703]
    require(material["name"] == "street_lantern_02_color", "Wrong material")
    pbr = material["pbrMetallicRoughness"]
    require(pbr["metallicFactor"] == 0 and pbr["metallicRoughnessTexture"]["index"] == 544, "Wrong ORM reference")
    require(material["occlusionTexture"]["index"] == 544, "Wrong AO reference")
    require(doc["textures"][544] == {"sampler": 0, "extensions": {"KHR_texture_basisu": {"source": 544}}}, "Wrong texture")
    require(doc["images"][544]["bufferView"] == 544, "Wrong image view")
    require(sha(image_bytes(doc, blob, 544)) == OLD_ORM_SHA256, "Wrong old ORM payload")
    require(len(blob) == doc["buffers"][0]["byteLength"], "Unexpected BIN padding")

    # No resampling, padding or UV baking: this PNG spans native UV space.
    # Keep KHR_texture_transform on BOTH ORM/AO slots. It decodes gltfpack's
    # quantized mesh UVs into native UVs, just as on the unchanged color/normal.
    # Applying it to the PNG as well, or removing it from the slots, is wrong.
    pbr["metallicFactor"] = 1
    doc["textures"][544] = {"sampler": 0, "source": 544}
    doc["images"][544]["mimeType"] = "image/png"
    # Append rather than relocate any existing byte range (including meshopt).
    # The superseded 17,171-byte KTX2 remains unreferenced, for minimal loss.
    new_blob = blob + png
    new_blob += b"\0" * (-len(new_blob) % 4)
    doc["bufferViews"][544].update(byteOffset=len(blob), byteLength=len(png))
    doc["buffers"][0]["byteLength"] = len(new_blob)

    # Surgical JSON substitutions retain every untouched token, not just its
    # parsed value. Refuse serialization drift instead of rewriting the file.
    edits = [("materials", 703), ("textures", 544), ("images", 544), ("bufferViews", 544), ("buffers", 0)]
    for key, index in edits:
        old = json.dumps(original[key][index], separators=(",", ":")).encode()
        new = json.dumps(doc[key][index], separators=(",", ":")).encode()
        require(encoded.count(old) == 1, f"Ambiguous/missing JSON token: {key}[{index}]")
        encoded = encoded.replace(old, new, 1)
    encoded = encoded.rstrip(b" ")
    encoded += b" " * (-len(encoded) % 4)
    require(json.loads(encoded) == doc, "Unexpected JSON edit")
    result = (struct.pack("<4sII", b"glTF", 2, 28 + len(encoded) + len(new_blob))
              + struct.pack("<I4s", len(encoded), b"JSON") + encoded
              + struct.pack("<I4s", len(new_blob), b"BIN\0") + new_blob)
    output = gzip.compress(result, compresslevel=9, mtime=0)

    # Verify actual serialized output before any output is written.
    checked_json, checked_blob = unpack(gzip.decompress(output))
    checked = json.loads(checked_json)
    restored = copy.deepcopy(checked)
    for key, index in edits:
        restored[key][index] = original[key][index]
    require(restored == original, "An unrelated glTF object changed")
    require(checked_blob[:len(blob)] == blob, "An original BIN byte changed")
    require(image_bytes(checked, checked_blob, 544) == png, "PNG bytes changed")
    unchanged_images = [i for i in range(len(doc["images"])) if i != 544]
    require(all(image_bytes(original, blob, i) == image_bytes(checked, checked_blob, i)
                for i in unchanged_images), "An unrelated image changed")
    image = Image.open(io.BytesIO(png)).convert("RGB")
    require(image.size == (1024, 512), "Wrong native dimensions")
    report = {
        "input": {"gzipBytes": len(compressed), "gzipSha256": sha(compressed), "glbBytes": len(raw), "glbSha256": sha(raw)},
        "output": {"gzipBytes": len(output), "gzipSha256": sha(output), "glbBytes": len(result), "glbSha256": sha(result)},
        "delta": {"gzipBytes": len(output) - len(compressed), "glbBytes": len(result) - len(raw)},
        "orm": {"oldBytes": len(image_bytes(original, blob, 544)), "oldSha256": OLD_ORM_SHA256,
                "newBytes": len(png), "newSha256": sha(png), "width": image.width, "height": image.height,
                "minRGB": [v[0] for v in image.getextrema()], "maxRGB": [v[1] for v in image.getextrema()],
                "meanRGB": ImageStat.Stat(image).mean},
        "verified": {"jsonObjectsChanged": [f"{key}[{index}]" for key, index in edits],
                     "allOtherJsonUnchanged": True, "originalBinPrefixBytesUnchanged": len(blob),
                     "originalBinSha256": sha(blob), "otherImagesByteIdentical": len(unchanged_images),
                     "meshesAccessorsMeshoptUnchanged": True, "allTextureTransformsUnchanged": True,
                     "materialFactorsChanged": [703], "metallicFactorBefore": 0, "metallicFactorAfter": 1},
    }
    return output, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=pathlib.Path)
    parser.add_argument("orm", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--evidence", type=pathlib.Path, required=True)
    args = parser.parse_args()
    require(args.input.resolve() != args.output.resolve(), "Use a separate output; keep the original input")
    output, report = patch(args.input.read_bytes(), args.orm.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(output)
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
