"""Build game navigation from Source 2 Viewer NAV/entity/trigger exports."""

import json, math, pathlib, re, sys

cache = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
data = json.loads((cache / "nav-raw.json").read_text())
areas = data["areas"]
entities = []
for block in re.split(r"====\d+====", (cache / "entities.txt").read_text()):
    entity = {}
    for line in block.splitlines():
        match = re.match(r"^(\w+)\s+(.+)$", line)
        if match:
            value = match[2]
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                pass
            entity[match[1]] = value
    entities.append(entity)


def point(v):
    return [round(v[0] * 0.0254, 5), round(v[2] * 0.0254, 5), round(-v[1] * 0.0254, 5)]


spawns = {}
angles = {}
for team, classname in [
    ("t", "info_player_terrorist"),
    ("ct", "info_player_counterterrorist"),
]:
    group = [
        e
        for e in entities
        if e.get("classname") == classname and e.get("enabled", True)
    ]
    group.sort(key=lambda e: e.get("priority", 0))
    spawns[team] = [point(e["origin"]) for e in group]
    angles[team] = [(e["angles"][1] - 90) * math.pi / 180 for e in group]
sites = []
sitebounds = []
for label in ["a", "b"]:
    d = json.loads((cache / f"site-{label}_physics.gltf").read_text())
    acc = [
        d["accessors"][p["attributes"]["POSITION"]]
        for m in d["meshes"]
        for p in m["primitives"]
    ]
    low = [min(a["min"][i] for a in acc) for i in range(3)]
    high = [max(a["max"][i] for a in acc) for i in range(3)]
    sites.append(point([(a + b) / 2 for a, b in zip(low, high)]))
    a, b = point(low), point(high)
    sitebounds.append(
        [min(a[i], b[i]) for i in range(3)] + [max(a[i], b[i]) for i in range(3)]
    )
ids = {a["id"] for a in areas}
for a in areas:
    corners = a["corners"]
    a["center"] = [
        round(sum(c[i] for c in corners) / len(corners), 5) for i in range(3)
    ]
    a["rect"] = [
        min(c[0] for c in corners),
        min(c[2] for c in corners),
        max(c[0] for c in corners),
        max(c[2] for c in corners),
    ]
    a["links"] = [id for id in a["links"] if id in ids]
    a["place"] = ""
    for i, b in enumerate(sitebounds):
        c = a["center"]
        if b[0] <= c[0] <= b[3] and b[2] <= c[2] <= b[5]:
            a["place"] = "Bombsite" + ("A" if i == 0 else "B")
result = {
    "polygons": True,
    "sourceNavVersion": data["version"],
    "areas": areas,
    "spawns": spawns,
    "spawnAngles": angles,
    "sites": sites,
    "bounds": [
        min(a["rect"][0] for a in areas),
        min(a["rect"][1] for a in areas),
        max(a["rect"][2] for a in areas),
        max(a["rect"][3] for a in areas),
    ],
}
assert all(spawns.values()) and all(
    any(a["place"] == label for a in areas) for label in ["BombsiteA", "BombsiteB"]
)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, separators=(",", ":")))
print(
    "NAV",
    len(areas),
    "spawns",
    {k: len(v) for k, v in spawns.items()},
    "sites",
    sites,
    "bytes",
    output.stat().st_size,
)
