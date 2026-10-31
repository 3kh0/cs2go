"""Freeze Source 2 map transforms, remove tool geometry, and batch by material.
Usage: python3 scripts/prepare-cs2-map.py input.gltf nav.json output.gltf
Physics stays separate and unsimplified. Requires numpy.
"""

import json, pathlib, sys, collections, numpy as np

source, navpath, out = map(pathlib.Path, sys.argv[1:])
doc = json.loads(source.read_text())
buffers = [(source.parent / b["uri"]).read_bytes() for b in doc["buffers"]]
bounds = json.loads(navpath.read_text())["bounds"]
groups = collections.defaultdict(list)


def read(index):
    a = doc["accessors"][index]
    v = doc["bufferViews"][a["bufferView"]]
    dtype = {
        5126: "<f4",
        5125: "<u4",
        5123: "<u2",
        5121: "u1",
        5122: "<i2",
        5120: "i1",
    }[a["componentType"]]
    w = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    n = np.dtype(dtype).itemsize
    val = np.ndarray(
        (a["count"], w),
        dtype=dtype,
        buffer=buffers[v.get("buffer", 0)],
        offset=v.get("byteOffset", 0) + a.get("byteOffset", 0),
        strides=(v.get("byteStride", n * w), n),
    ).copy()
    if a.get("normalized"):
        val = val.astype("f4") / np.iinfo(dtype).max
    return val


rotate = np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]], dtype="f4")


def visit(index, parent):
    node = doc["nodes"][index]
    if "matrix" in node:
        local = np.array(node["matrix"]).reshape(4, 4).T
    else:
        local = np.eye(4)
        local[:3, 3] = node.get("translation", [0, 0, 0])
        local[:3, :3] = np.diag(node.get("scale", [1, 1, 1]))
        assert "rotation" not in node, "Unexpected TRS rotation; export matrices first"
    matrix = parent @ local
    if "mesh" in node:
        for p in doc["meshes"][node["mesh"]]["primitives"]:
            mi = p.get("material", 0)
            mat = doc["materials"][mi]
            name = (
                mat.get("extras", {})
                .get("vmat", {})
                .get("Name", mat.get("name", ""))
                .lower()
            )
            if (
                mat.get("extras", {}).get("vmat", {}).get("ShaderName")
                == "csgo_effects.vfx"
            ):
                continue
            if any(
                term in name
                for term in [
                    "materials/tools/",
                    "skybox/",
                    "wrongway",
                    "timer",
                    "nav_attribute",
                    "dev/",
                ]
            ):
                continue
            pos = read(p["attributes"]["POSITION"])
            # Source2Viewer 20.0 adds 0.01 / 0.0254 to already-meter overlay
            # positions. Restore its intended 1 cm lift before world transforms.
            # Match the exporter's native flag classifier, including opaque trim.
            vmat = mat.get("extras", {}).get("vmat", {})
            flags = vmat.get("IntParams", {})
            shader = vmat.get("ShaderName", "")
            overlay = (
                any(flags.get(flag) == 1 for flag in ("F_OVERLAY", "F_DEPTHBIAS", "F_DEPTH_BIAS"))
                or shader.endswith("static_overlay.vfx")
                or shader == "citadel_overlay.vfx"
            )
            if overlay:
                pos -= read(p["attributes"]["NORMAL"]) * (0.01 / 0.0254 - 0.01)
            pos = np.einsum("ij,kj->ki", matrix[:3, :3], pos) + matrix[:3, 3]
            idx = read(p["indices"]).astype("u4").ravel().reshape(-1, 3)
            tri = pos[idx]
            lo = tri.min(axis=1)
            hi = tri.max(axis=1)
            keep = (
                (hi[:, 0] >= bounds[0] - 40)
                & (lo[:, 0] <= bounds[2] + 40)
                & (hi[:, 2] >= bounds[1] - 40)
                & (lo[:, 2] <= bounds[3] + 40)
                & (hi[:, 1] >= -15)
            )
            idx = idx[keep]
            if not len(idx):
                continue
            normals = np.einsum(
                "ki,ij->kj",
                read(p["attributes"]["NORMAL"]),
                np.linalg.inv(matrix[:3, :3]),
            )
            normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-10)
            uv = read(p["attributes"]["TEXCOORD_0"])
            color = (
                read(p["attributes"]["COLOR_0"])
                if "COLOR_0" in p["attributes"]
                else np.ones((len(pos), 4), "f4")
            )
            if color.shape[1] == 3:
                color = np.pad(color, ((0, 0), (0, 1)), constant_values=1)
            if (
                mat.get("extras", {}).get("vmat", {}).get("ShaderName")
                == "csgo_foliage.vfx"
            ):
                color[:] = 1
            assert all(np.isfinite(v).all() for v in (pos, normals, uv, color)), name
            groups[mi].append((np.concatenate((pos, normals, uv, color), axis=1), idx))
    for child in node.get("children", []):
        visit(child, matrix)


for i in doc["scenes"][doc.get("scene", 0)]["nodes"]:
    visit(i, rotate)
blob = bytearray()
views = []
accessors = []
meshes = []


def acc(values, kind):
    values = np.ascontiguousarray(values, dtype="<u4" if kind == "SCALAR" else "<f4")
    blob.extend(b"\0" * (-len(blob) % 4))
    offset = len(blob)
    blob.extend(values.tobytes())
    views.append({"buffer": 0, "byteOffset": offset, "byteLength": values.nbytes})
    a = {
        "bufferView": len(views) - 1,
        "componentType": 5125 if kind == "SCALAR" else 5126,
        "count": len(values),
        "type": kind,
    }
    if kind == "VEC3":
        a.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    accessors.append(a)
    return len(accessors) - 1


triangles = 0
for mi, parts in groups.items():
    values = []
    indices = []
    offset = 0
    for v, idx in parts:
        values.append(v)
        indices.append(idx + offset)
        offset += len(v)
    v = np.concatenate(values)
    idx = np.concatenate(indices)
    used, remap = np.unique(idx.ravel(), return_inverse=True)
    unique, inverse = np.unique(v[used].astype("f4"), axis=0, return_inverse=True)
    idx = inverse[remap].astype("u4").reshape(-1, 1)
    triangles += len(idx) // 3
    attrs = {
        "POSITION": acc(unique[:, :3], "VEC3"),
        "NORMAL": acc(unique[:, 3:6], "VEC3"),
        "TEXCOORD_0": acc(unique[:, 6:8], "VEC2"),
        "COLOR_0": acc(unique[:, 8:12], "VEC4"),
    }
    meshes.append(
        {
            "name": "CS2 Dust II " + doc["materials"][mi]["name"],
            "primitives": [
                {"attributes": attrs, "indices": acc(idx, "SCALAR"), "material": mi}
            ],
        }
    )
for image in doc.get("images", []):
    image["uri"] = str((source.parent / image["uri"]).resolve())
for material in doc["materials"]:
    vmat = material.pop("extras", {}).get("vmat", {})
    params = vmat.get("FloatParams", {})
    if "default_ao" in vmat.get("TextureParams", {}).get("g_tAmbientOcclusion", ""):
        material.pop("occlusionTexture", None)
    if "occlusionTexture" in material and "g_flAmbientOcclusionScale" in params:
        material["occlusionTexture"]["strength"] = params["g_flAmbientOcclusionScale"]
    pbr = material["pbrMetallicRoughness"]
    # Adapted ORM already contains native metalness. Preserve its multiplier
    # (including glTF's omitted default of 1), rather than multiplying it by 0.
    if "metallicRoughnessTexture" not in pbr:
        pbr["metallicFactor"] = params.get(
            "g_flMetalness", pbr.get("metallicFactor", 0)
        )
    if "alphaCutoff" in material:
        material["alphaCutoff"] = params.get(
            "g_flAlphaTestReference", material["alphaCutoff"]
        )
    # VRF's exported textures already adapt Source normals/roughness to glTF.
    # Layered Source shaders are approximated by its exported base PBR material.
    for slot in ("normalTexture", "occlusionTexture"):
        if material.get(slot, {}).get("texCoord", 0) > 0:
            material.pop(slot)
doc.update(
    nodes=[{"mesh": i, "name": m["name"]} for i, m in enumerate(meshes)],
    meshes=meshes,
    scenes=[{"nodes": list(range(len(meshes)))}],
    scene=0,
    accessors=accessors,
    bufferViews=views,
    buffers=[{"uri": out.with_suffix(".bin").name, "byteLength": len(blob)}],
)
doc.pop("extensions", None)
doc.pop("extensionsUsed", None)
doc.pop("extensionsRequired", None)
out.with_suffix(".bin").write_bytes(blob)
out.write_text(json.dumps(doc, separators=(",", ":")))
print(
    "Batched",
    len(meshes),
    "materials;",
    triangles,
    "triangles;",
    len(blob),
    "geometry bytes",
)
