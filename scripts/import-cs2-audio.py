"""Import the supplied CS2-for-Source sound pack without changing source files.
Run after the original audio importers: python3 scripts/import-cs2-audio.py /path/to/sound
Requires FFmpeg. Existing reload/bolt, movement and music clips remain in use.
"""

from pathlib import Path
import hashlib, json, subprocess, sys

source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
out = root / "packages/assets/public/audio"
manifest_path = out / "source/manifest.json"
manifest = json.loads(manifest_path.read_text())
existing = {c["name"]: c for c in manifest["clips"]}
weapons = {
    "ak47-1": "ak47/ak47-1",
    "m4a1-1-single": "m4a1/m4a1-1",
    "usp1": "usp/usp1",
    "awp1": "awp/awp1",
}
cues = {
    "knife-swing1": "weapons/knife/knife_slash1",
    "knife-swing2": "weapons/knife/knife_slash2",
    "knife-hit": "weapons/knife/knife_stab",
    "knife-wall": "weapons/knife/knife_hitwall1",
    "hit": "player/kevlar1",
    "head": "player/headshot1",
    "damage-1": "player/damage2",
    "damage-2": "player/kevlar2",
    "damage-3": "player/kevlar3",
    "buy": "buttons/weapon_confirm",
    "bomb-plant": "weapons/c4/c4_plant",
    "bomb-beep": "weapons/c4/c4_beep1",
    "bomb-defuse": "weapons/c4/c4_disarm",
    "bomb-explode": "weapons/c4/c4_explode1",
}
report = {
    "source": "User-supplied CS2 SOUNDS FOR SOURCE pack",
    "attribution": "Valve audio, supplied community conversion; individual clips not independently verified against a CS2 depot",
    "input": source.name,
    "encoding": "mono Opus 96 kbps, 48 kHz; source files unchanged",
    "clips": [],
}


def convert(name, relative, destination, filters=None):
    path = source / (relative + ".wav")
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(path),
        "-map_metadata",
        "-1",
        "-ac",
        "1",
        "-ar",
        "48000",
    ]
    if filters:
        args += ["-af", filters]
    subprocess.run(
        args + ["-c:a", "libopus", "-b:a", "96k", str(destination)], check=True
    )
    entry = {
        "name": name,
        "source": relative + ".wav",
        "sourcePack": report["source"],
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": destination.stat().st_size,
    }
    if filters:
        entry["processing"] = filters
    report["clips"].append(entry)
    return entry


for name, path in weapons.items():
    convert(name, "weapons/" + path, out / (name + ".ogg"))
# This pack has no separate distant AK recording. Filter its new shot instead
# of keeping the old CS:GO report when bots fire the same weapon.
convert(
    "ak47-1-distant",
    "weapons/ak47/ak47-1",
    out / "ak47-1-distant.ogg",
    "lowpass=f=2800",
)
for name, path in cues.items():
    existing[name] = convert(name, path, out / "source" / (name + ".ogg"))
manifest["clips"] = list(existing.values())
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
(out / "cs2-source.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    "Imported",
    len(report["clips"]),
    "clips:",
    sum(c["bytes"] for c in report["clips"]),
    "bytes",
)
