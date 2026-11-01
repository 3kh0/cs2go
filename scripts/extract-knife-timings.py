"""Read-only CS2 knife timing audit. Writes only inside --out, never to inputs.

Requires the already supplied srctools vendor and Source2Viewer CLI; no installs.
Use python -B audit.py --help. Decodes compiled assets, not executables.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys


def sha(path):
    with open(path, "rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def kv3(text):
    """Parse VRF text KV3; opaque pose blobs are deliberately omitted."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"#\[.*?\]", '"<opaque binary omitted>"', text, flags=re.S)
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|[{}\[\]=,:]|[^\s{}\[\]=,:]+', text)
    pos = 0

    def value():
        nonlocal pos
        token = tokens[pos]
        pos += 1
        if token == "{":
            obj = {}
            while tokens[pos] != "}":
                key = tokens[pos]
                pos += 1
                assert tokens[pos] == "=", (key, tokens[pos:pos + 5])
                pos += 1
                assert key not in obj, key
                obj[key.strip('"')] = value()
                if tokens[pos] == ",":
                    pos += 1
            pos += 1
            return obj
        if token == "[":
            arr = []
            while tokens[pos] != "]":
                arr.append(value())
                if tokens[pos] == ",":
                    pos += 1
            pos += 1
            return arr
        if pos < len(tokens) and tokens[pos] == ":":
            pos += 1
            return value()
        if token.startswith('"'):
            return json.loads(token)
        if token in ("true", "false", "null"):
            return json.loads(token)
        try:
            return int(token, 0)
        except ValueError:
            try:
                return float(token)
            except ValueError:
                return token

    result = value()
    assert pos == len(tokens), tokens[pos:pos + 10]
    return result


def data_block(text):
    part = text.split('--- Data for block "DATA" ---', 1)[1]
    return kv3(part.split('\n--- Data for block ', 1)[0].strip())


def dump_json(path, obj, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=None if compact else 2) + "\n", encoding="utf-8")


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    assert magic == b"glTF" and version == 2 and length == len(raw)
    chunks = {}
    off = 12
    while off < len(raw):
        size, kind = struct.unpack_from("<I4s", raw, off)
        chunks[kind] = raw[off + 8:off + 8 + size]
        off += 8 + size
    doc = json.loads(chunks[b"JSON"])
    result = []
    for animation in doc.get("animations", []):
        inputs = sorted({s["input"] for s in animation["samplers"]})
        entries = []
        for idx in inputs:
            acc = doc["accessors"][idx]
            assert acc["type"] == "SCALAR" and acc["componentType"] == 5126
            view = doc["bufferViews"][acc["bufferView"]]
            assert view["buffer"] == 0
            start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
            stride = view.get("byteStride", 4)
            times = [struct.unpack_from("<f", chunks[b"BIN\x00"], start + i * stride)[0] for i in range(acc["count"])]
            assert all(a <= b for a, b in zip(times, times[1:]))
            entries.append({"accessor": idx, "count": len(times), "min": min(times), "max": max(times), "declared_max": acc.get("max")})
        result.append({"name": animation.get("name"), "inputs": entries, "channels": len(animation["channels"])})
    return {"path": str(path), "sha256": sha(path), "animations": result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game", type=Path, required=True, help="Read-only installed game/csgo directory")
    parser.add_argument("--tool", type=Path, required=True, help="Source2Viewer CLI 20.1.7467")
    parser.add_argument("--vendor", type=Path, required=True, help="Scratch-local srctools 2.7.0 installation")
    parser.add_argument("--out", type=Path, required=True, help="Separate scratch output directory")
    parser.add_argument("--glb", type=Path, action="append", default=[])
    parser.add_argument("--bayonet-only", action="store_true")
    args = parser.parse_args()
    root = args.out.resolve()
    assert root != args.game.resolve() and args.game.resolve() not in root.parents
    root.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(args.vendor))
    from srctools.vpk import VPK
    vpk_path = args.game / "pak01_dir.vpk"
    archive = VPK(str(vpk_path))
    names = sorted(f.filename for f in archive)
    selected = [n for n in names if
                (n.startswith("animation/anims/viewmodel/knife/") and n.endswith(".vnmclip_c") and (not args.bayonet_only or "/knife_bayonet/" in n))
                or (n.startswith("animation/graphs/viewmodel/") and n.endswith(".vnmgraph_c") and
                    ("viewmodel_knife" in n or "viewmodel_inspects.vnmgraph+knife" in n or n.endswith("/viewmodel.vnmgraph_c")))
                or n == "scripts/weapons.vdata_c"]
    manifest = []
    for name in selected:
        target = root / "native" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = archive[name].read()
        if not target.exists() or target.read_bytes() != payload:
            target.write_bytes(payload)
        manifest.append({"path": name, "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})

    def decode(name):
        target = root / "decoded" / (name + ".txt")
        target.parent.mkdir(parents=True, exist_ok=True)
        proc = subprocess.run([str(args.tool), "-i", str(root / "native" / name), "-a"], capture_output=True, check=True)
        text = proc.stdout.decode("utf-8-sig")
        assert '--- Data for block "DATA" ---' in text, (name, text[:1000], proc.stderr)
        target.write_text(text, encoding="utf-8")
        return name, data_block(text)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        decoded = dict(pool.map(decode, selected))
    for entry in manifest:
        entry["decoded_text_sha256"] = sha(root / "decoded" / (entry["path"] + ".txt"))
    clips = {}
    graphs = {}
    for name, data in decoded.items():
        if name.endswith(".vnmclip_c"):
            n, duration = data["m_nNumFrames"], data["m_flDuration"]
            secondary = [{"skeleton": s["m_skeleton"], "frames": s["m_nNumFrames"], "duration": s["m_flDuration"]} for s in data.get("m_secondaryAnimations", [])]
            clips[name] = {"frames": n, "duration": duration, "fps_intervals": (n - 1) / duration if duration else None,
                           "legacy_N_over_D_endpoint_prediction": duration * (n - 1) / n,
                           "skeleton": data["m_skeleton"], "secondary": secondary,
                           "secondary_timing_matches": all(s["frames"] == n and s["duration"] == duration for s in secondary),
                           "sync_track": data.get("m_syncTrack"), "events": data.get("m_events", []),
                           "other_metadata": {k: v for k, v in data.items() if k not in ("m_compressedPoseData", "m_trackCompressionSettings", "m_secondaryAnimations", "m_events", "m_syncTrack")}}
        elif name.endswith(".vnmgraph_c"):
            graphs[name] = data
    weapon_data = decoded["scripts/weapons.vdata_c"]
    weapons = {k: {p: v for p, v in d.items() if p in ("_class", "m_szName", "m_szWorldModel", "m_szAnimSkeleton", "m_flDeployDuration", "m_flCycleTime", "m_WeaponType")} for k, d in weapon_data.items() if isinstance(d, dict) and d.get("m_WeaponType") == "WEAPONTYPE_KNIFE"}
    graph_summary = {}
    for name, graph in graphs.items():
        resources = graph.get("m_resources", [])
        paths = graph.get("m_nodePaths", [])
        nodes = []
        for node in graph.get("m_nodes", []):
            idx = node["m_nNodeIdx"]
            entry = {"path": paths[idx] if idx < len(paths) else None, **node}
            if "m_nDataSlotIdx" in node:
                slot = node["m_nDataSlotIdx"]
                entry["resource"] = resources[slot] if 0 <= slot < len(resources) else None
            nodes.append(entry)
        graph_summary[name] = {"resources": resources, "nodes": nodes}
    build = (args.game / "steam.inf").read_text()
    appmanifest = args.game.parents[3] / "appmanifest_730.acf"
    buildid = re.search(r'"buildid"\s+"(\d+)"', appmanifest.read_text()).group(1)
    identity = {"steam_buildid": buildid, "steam_inf": build, "pak01_dir_sha256": sha(vpk_path),
                "tool_version": subprocess.check_output([str(args.tool), "--version"]).decode().strip(),
                "tool_sha256": sha(args.tool), "python": sys.version,
                "srctools_metadata_sha256": sha(args.vendor / "srctools-2.7.0.dist-info" / "METADATA"),
                "script_sha256": sha(Path(__file__)), "asset_count": len(selected)}
    dump_json(root / "identity.json", identity)
    dump_json(root / "asset-manifest.json", manifest)
    dump_json(root / "timing-roster.json", {"schema": 1, "units": "seconds; events use native normalized clip time", "weapons": weapons, "clips": clips}, compact=True)
    dump_json(root / "graph-evidence.json", graph_summary, compact=True)
    dump_json(root / "glb-timestamps.json", [read_glb(p) for p in args.glb])
    families = {}
    events = {}
    for path, clip in clips.items():
        family, filename = path.split("/")[-2:]
        name = filename.removesuffix(".vnmclip_c")
        action = ("draw" if name.startswith("draw") else "idle" if name.startswith("idle") else
                  "slash" if name.startswith(("light", "all_light")) else "stab" if name.startswith(("heavy", "all_heavy")) else
                  "inspect" if name.startswith("lookat") else "other")
        fam = families.setdefault(family, {"weapons": [], "graphs": [], "actions": {}})
        fam["actions"].setdefault(action, []).append({"name": name, "path": path, "frames": clip["frames"], "duration": clip["duration"], "fps": clip["fps_intervals"]})
        for weapon, data in weapons.items():
            if data.get("m_szAnimSkeleton") in [s["skeleton"] for s in clip["secondary"]] and weapon not in fam["weapons"]:
                fam["weapons"].append(weapon)
        for graph, data in graph_summary.items():
            if path.removesuffix("_c") in data["resources"] and graph not in fam["graphs"]:
                fam["graphs"].append(graph)
        entries = []
        for event in clip["events"]:
            start = event["m_flStartTime"]["m_flValue"]
            length = event["m_flDuration"]["m_flValue"]
            entries.append({"class": event["_class"], "id": event.get("m_ID", event.get("m_name")),
                            "start_normalized": start, "duration_normalized": length,
                            "start_seconds": start * clip["duration"], "end_seconds": (start + length) * clip["duration"],
                            "start_frame": start * (clip["frames"] - 1), "end_frame": (start + length) * (clip["frames"] - 1)})
        events[path] = entries
    for fam in families.values():
        fam["deploy_readiness_seconds"] = {w: weapons[w]["m_flDeployDuration"] for w in fam["weapons"]}
    dump_json(root / "families.json", {"units": "seconds at graph scale 1; fps is derived, not a stored fps field", "families": families}, compact=True)
    dump_json(root / "events.json", {"units": "seconds at graph scale 1; native normalized fractions retained; text-float precision applies", "clips": events}, compact=True)
    bayonet = {Path(k).stem: {key: val for key, val in c.items() if key in ("frames", "duration", "fps_intervals", "legacy_N_over_D_endpoint_prediction", "secondary_timing_matches")} for k, c in clips.items() if "/knife_bayonet/" in k}
    dump_json(root / "bayonet-early.json", bayonet)
    supplied = {"draw_bayonet": 1.134291648864746, "idle1_bayonet": 1.9672131538391113,
                "idle2_bayonet": .9677419066429138, "light_miss1_bayonet": 1.134291648864746,
                "light_miss2_bayonet": 1.134291648864746, "heavy_miss1_bayonet": 1.1018834114074707,
                "lookat01_bayonet": 6.166844844818115}
    comparison = {}
    for name, endpoint in supplied.items():
        path = "animation/anims/viewmodel/knife/knife_bayonet/" + name + ".vnmclip_c"
        if path not in clips:
            continue
        clip = clips[path]
        rawtext = (root / "decoded" / (path + ".txt")).read_text(encoding="utf-8")
        blobs = re.findall(r"m_compressedPoseData\s*=\s*#\[(.*?)\]", rawtext, re.S)
        tracks = [decoded[path], *decoded[path].get("m_secondaryAnimations", [])]
        tail = []
        for track, blob in zip(tracks, blobs):
            payload = bytes.fromhex(blob)
            offsets = track["m_compressedPoseOffsets"]
            frames = [payload[2 * off:2 * offsets[i + 1] if i + 1 < len(offsets) else len(payload)] for i, off in enumerate(offsets)]
            changes = [i for i in range(1, len(frames)) if frames[i] != frames[i - 1]]
            tail.append({"skeleton": track["m_skeleton"], "last_distinct_compressed_frame": max(changes, default=0),
                         "last_two_frames_byte_identical": frames[-1] == frames[-2]})
        last = max(t["last_distinct_compressed_frame"] for t in tail)
        legacy_pred = last * clip["duration"] / clip["frames"]
        comparison[name] = {"supplied_glb_endpoint_NOT_locally_read": endpoint,
                            "native_duration": clip["duration"], "frames": clip["frames"],
                            "compressed_track_tail_evidence": tail,
                            "legacy_timebase_with_tail_elision_prediction": legacy_pred,
                            "absolute_residual_seconds": abs(endpoint - legacy_pred),
                            "current_tool_timebase_endpoint_before_tail_elision": clip["duration"],
                            "timestamp_multiplier_if_legacy_timebase_verified": clip["frames"] / (clip["frames"] - 1),
                            "player_speed_if_legacy_timebase_verified": (clip["frames"] - 1) / clip["frames"]}
    dump_json(root / "bayonet-comparison.json", comparison)
    missing_refs = sorted({ref + "_c" for g in graphs.values() for ref in g.get("m_resources", []) if ref.endswith(".vnmclip") and "/knife/" in ref and ref + "_c" not in clips})
    checks = {"clip_count": len(clips), "family_count": len(families), "graph_count": len(graphs),
              "secondary_timing_mismatches": [p for p, c in clips.items() if not c["secondary_timing_matches"]],
              "missing_knife_clip_graph_references": missing_refs,
              "family_action_coverage": {f: sorted(d["actions"]) for f, d in families.items()},
              "supplied_bayonet_endpoint_max_residual_seconds": max(c["absolute_residual_seconds"] for c in comparison.values())}
    assert not checks["secondary_timing_mismatches"]
    assert args.bayonet_only or not missing_refs
    assert all(set(("draw", "idle", "slash", "stab", "inspect")) <= set(d["actions"]) for d in families.values())
    assert checks["supplied_bayonet_endpoint_max_residual_seconds"] < 1e-6
    dump_json(root / "validation.json", checks)
    source_manifest = [{"path": p.relative_to(root).as_posix(), "sha256": sha(p),
                        "url": "https://raw.githubusercontent.com/ValveResourceFormat/ValveResourceFormat/9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304/" +
                               ("ValveResourceFormat/IO/" if p.name in ("GltfModelExporter.Anim.cs", "NmClipExtract.cs") else "ValveResourceFormat/Resource/ResourceTypes/ModelAnimation/" if p.name == "ClipAnimation.cs" else "ValveResourceFormat/Resource/ResourceTypes/ModelAnimation2/") + p.name}
                       for p in sorted((root / "tool-source").glob("*.cs"))]
    dump_json(root / "tool-source-manifest.json", source_manifest)
    print(json.dumps({"assets": len(selected), "clips": len(clips), "graphs": len(graphs), "weapons": len(weapons), "bayonet": bayonet}, indent=2))


if __name__ == "__main__":
    main()
