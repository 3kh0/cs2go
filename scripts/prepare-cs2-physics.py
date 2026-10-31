"""Crop distant physics to play-space bounds without simplifying player hulls."""

import pathlib, json, numpy as np, sys

source, nav, out = map(pathlib.Path, sys.argv[1:])
d = json.loads(source.read_text())
buffers = [(source.parent / b["uri"]).read_bytes() for b in d["buffers"]]
bounds = json.loads(nav.read_text())["bounds"]
blob = bytearray()
views = []
accessors = []
nodes = []
meshes = []


def read(i):
    a = d["accessors"][i]
    v = d["bufferViews"][a["bufferView"]]
    w = 3 if a["type"] == "VEC3" else 1
    dtype = "<f4" if a["componentType"] == 5126 else "<u4"
    return np.frombuffer(
        buffers[v.get("buffer", 0)],
        dtype=dtype,
        count=a["count"] * w,
        offset=v.get("byteOffset", 0) + a.get("byteOffset", 0),
    ).reshape(-1, w)


def acc(a, kind):
    a = np.ascontiguousarray(a, dtype="<f4" if kind == "VEC3" else "<u4")
    views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": a.nbytes})
    blob.extend(a.tobytes())
    entry = {
        "bufferView": len(views) - 1,
        "componentType": 5126 if kind == "VEC3" else 5125,
        "count": len(a),
        "type": kind,
    }
    if kind == "VEC3":
        entry.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
    accessors.append(entry)
    return len(accessors) - 1


r = np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]])
triangles = 0
for n in d["nodes"]:
    if "mesh" not in n or any(
        x in n.get("extras", {}).get("InteractAs", [])
        for x in ["sky", "csgo_grenadeclip"]
    ):
        continue
    m = r @ np.array(n["matrix"]).reshape(4, 4).T
    primitives = []
    for p in d["meshes"][n["mesh"]]["primitives"]:
        v = read(p["attributes"]["POSITION"])
        v = np.einsum("ij,kj->ki", m[:3, :3], v) + m[:3, 3]
        idx = read(p["indices"]).ravel().reshape(-1, 3)
        q = v[idx]
        low = q.min(axis=1)
        high = q.max(axis=1)
        idx = idx[
            (high[:, 0] >= bounds[0] - 40)
            & (low[:, 0] <= bounds[2] + 40)
            & (high[:, 2] >= bounds[1] - 40)
            & (low[:, 2] <= bounds[3] + 40)
            & (high[:, 1] >= -15)
        ]
        if not len(idx):
            continue
        used, inverse = np.unique(idx.ravel(), return_inverse=True)
        primitives.append(
            {
                "attributes": {"POSITION": acc(v[used], "VEC3")},
                "indices": acc(inverse.reshape(-1, 1), "SCALAR"),
            }
        )
        triangles += len(idx)
    if primitives:
        nodes.append(
            {"name": n["name"], "extras": n.get("extras", {}), "mesh": len(meshes)}
        )
        meshes.append({"primitives": primitives})
result = {
    "asset": {"version": "2.0"},
    "nodes": nodes,
    "meshes": meshes,
    "scenes": [{"nodes": list(range(len(nodes)))}],
    "scene": 0,
    "accessors": accessors,
    "bufferViews": views,
    "buffers": [{"uri": out.with_suffix(".bin").name, "byteLength": len(blob)}],
}
out.write_text(json.dumps(result))
out.with_suffix(".bin").write_bytes(blob)
print("Physics", triangles, "triangles", len(nodes), "groups")
