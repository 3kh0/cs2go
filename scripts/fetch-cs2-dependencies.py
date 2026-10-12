"""Fetch only the pinned map's transitive render resources from Steam VPK chunks."""

import pathlib, struct, subprocess, zlib, json, sys

root = pathlib.Path(sys.argv[1])
downloader = sys.argv[2]
depot = root / "depot"
extracted = root / "extracted"
entries = {}
for game in ["core", "csgo"]:
    path = depot / f"game/{game}/pak01_dir.vpk"
    b = path.read_bytes()
    signature, version, tree = struct.unpack_from("<III", b)
    assert signature == 0x55AA1234
    p = 28 if version == 2 else 12
    data = p + tree

    def string():
        global p
        end = b.index(0, p)
        val = b[p:end].decode()
        p = end + 1
        return val

    while ext := string():
        while folder := string():
            while name := string():
                crc, preload, index, offset, size, term = struct.unpack_from(
                    "<IHHIIH", b, p
                )
                p += 18
                assert term == 65535
                pre = b[p : p + preload]
                p += preload
                full = (folder + "/" if folder != " " else "") + name + "." + ext
                entries[full] = (game, index, offset, size, crc, pre, data)


def refs(b):
    if len(b) < 16 or struct.unpack_from("<H", b, 4)[0] != 12:
        return []
    off, count = struct.unpack_from("<II", b, 8)
    res = []
    for i in range(count):
        pos = 8 + off + i * 12
        tag, rel, size = struct.unpack_from("<4sII", b, pos)
        if tag != b"RERL":
            continue
        start = pos + 4 + rel
        r, n = struct.unpack_from("<II", b, start)
        for j in range(n):
            at = start + r + j * 16 + 8
            dest = at + struct.unpack_from("<I", b, at)[0]
            name = b[dest : b.index(0, dest)].decode()
            if name.endswith(
                (
                    ".vmdl",
                    ".vmesh",
                    ".vmat",
                    ".vtex",
                    ".vphys",
                    ".vwnod",
                    ".vwrld",
                    ".vents",
                )
            ):
                res.append(name + "_c")
    return res


seen = set()
pending = {str(p.relative_to(extracted)) for p in extracted.rglob("*") if p.is_file()}
missing = set()
downloads = set()
while pending:
    needed = set()
    later = set()
    for name in pending:
        if name in seen:
            continue
        path = extracted / name
        if not path.exists():
            if name not in entries:
                missing.add(name)
                seen.add(name)
                continue
            game, index, offset, size, crc, pre, data = entries[name]
            chunk = (
                depot / f"game/{game}/pak01_{index:03}.vpk"
                if index != 32767
                else depot / f"game/{game}/pak01_dir.vpk"
            )
            if not chunk.exists():
                needed.add(str(chunk.relative_to(depot)))
                later.add(name)
                continue
            with chunk.open("rb") as f:
                f.seek(offset + (data if index == 32767 else 0))
                raw = pre + f.read(size)
            if zlib.crc32(raw) != crc:
                needed.add(str(chunk.relative_to(depot)))
                later.add(name)
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        seen.add(name)
        later.update(set(refs(path.read_bytes())) - seen)
    if needed:
        downloads.update(needed)
        (root / "dependency-files.txt").write_text("\n".join(sorted(needed)))
        print(
            "DOWNLOAD",
            len(needed),
            "archives; resolved",
            len(seen),
            "pending",
            len(later),
            flush=True,
        )
        result = subprocess.run(
            [
                downloader,
                "-app",
                "730",
                "-depot",
                "2347770",
                "-manifest",
                "4758919807587010422",
                "-os",
                "windows",
                "-filelist",
                str(root / "dependency-files.txt"),
                "-dir",
                str(depot),
                "-validate",
                "-max-downloads",
                "16",
            ]
        )
        if result.returncode:
            subprocess.run(result.args, check=True)
    pending = later
(root / "dependency-report.json").write_text(
    json.dumps(
        {
            "files": sorted(seen),
            "missing": sorted(missing),
            "archives": sorted(downloads),
        },
        indent=2,
    )
)
print("RESOLVED", len(seen), "MISSING", sorted(missing))
