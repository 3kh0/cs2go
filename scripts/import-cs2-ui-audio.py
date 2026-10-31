"""Import native UI events, preserving gain/pitch as playback metadata (requires FFmpeg)."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("export", type=Path)
parser.add_argument("--supplement", type=Path)
args = parser.parse_args()
root = Path("packages/assets/public/audio")
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
events = {row["event"]: row for row in json.loads((args.export / "event-map.json").read_text())}
mapping = {
    "hover": "generic_button_rollover", "main-hover": "mainmenu_rollover",
    "select": "generic_button_press", "radio": "generic_button_press_B",
    "confirm": "submenu_select", "back": "generic_button_press",
    "inspect-close": "inventory_inspect_close", "change": "submenu_dropdown_option_select",
    "home": "mainmenu_press_home", "quit": "mainmenu_press_quit",
    "inventory": "tab_mainmenu_inventory", "loadout": "tab_mainmenu_loadout",
    "play": "tab_mainmenu_play", "store": "tab_mainmenu_shop", "news": "tab_mainmenu_news",
    "settings-layer": "submenu_leveloptions_slidein", "settings": "tab_settings_settings", "watch": "tab_mainmenu_watch", "go": "mainmenu_press_GO",
    "buy": "buymenu_purchase", "buy-select": "buymenu_select", "buy-hover": "buymenu_mouseover",
}
if args.supplement:
    supplement = json.loads((args.supplement / "provenance.json").read_text())
    # The supplemental export supplies the two previously unbundled navigation clips.
    for row in supplement["newWaveforms"]:
        events[row["event"]] = {**row, "waveformResources": [{
            "resource": row["resource"], "packaged": True, "waveform": row,
        }]}
manifest_path = root / "source/manifest.json"
manifest = json.loads(manifest_path.read_text())
stock = [row for row in manifest["clips"] if not row["name"].startswith("ui-")]
by_source = {row.get("resourceSha256"): row for row in stock}
bindings, added, fingerprints = {}, [], []
for key, event in mapping.items():
    name = "UIPanorama." + event
    definition = events[name]
    resource = next((row for row in definition["waveformResources"] if row.get("packaged")), None)
    assert resource is not None, f"Missing decoded waveform for {name}"
    waveform = resource["waveform"]
    source_root = args.export
    path = source_root / waveform["wav"]
    if not path.exists() and args.supplement:
        source_root = args.supplement
        path = source_root / waveform["wav"]
    assert digest(path) == waveform["wavSha256"], path
    existing = by_source.get(waveform["sourceSha256"])
    if existing:
        target = root / "source" / (existing["name"] + ".ogg")
        assert digest(target) == existing["outputSha256"], target
        clip = existing["name"]
    else:
        clip = "ui-" + key
        target = root / "source" / (clip + ".ogg")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                        "-ar", "48000", "-ac", str(waveform["channels"]), "-c:a", "libopus", "-b:a", "96k", str(target)], check=True)
        record = {"name": clip, "event": name, "eventFile": "soundevents/game_sounds_ui.vsndevts_c",
                  "resource": resource["resource"], "source": resource["resource"],
                  "resourceSha256": waveform["sourceSha256"], "decodedSha256": waveform["wavSha256"],
                  "outputSha256": digest(target), "bytes": target.stat().st_size,
                  "sourcePack": "Valve CS2 UI", "manifest": "67499503218971311"}
        added.append(record)
        by_source[waveform["sourceSha256"]] = record
    assert isinstance(definition["volume"], (int, float)) and isinstance(definition["pitch"], (int, float))
    bindings[key] = {"clip": clip, "gain": definition["volume"], "pitch": definition["pitch"],
                     "blockSeconds": definition.get("blockDuration") or 0, "children": []}
    fingerprints.append({"kind": key, "event": name, "resource": resource["resource"],
                         "sourceSha256": waveform["sourceSha256"], "wavSha256": waveform["wavSha256"],
                         "pcmSha256": waveform["pcmSha256"], **bindings[key]})
# Retain one representative child from each authored child-event variation list.
# The native engine's full scheduling/mixer is outside this browser port.
for key, event in mapping.items():
    definition = events["UIPanorama." + event].get("fullNativeDefinition", {})
    if definition.get("enable_child_events"):
        child = (definition.get("soundevent_01") or [None])[0]
        match = next((kind for kind, name in mapping.items() if "UIPanorama." + name == child), None)
        if match: bindings[key]["children"].append(match)
for record in fingerprints:
    record["children"] = bindings[record["kind"]]["children"]
Path("apps/game/src/data/ui-cues.json").write_text(json.dumps(bindings, indent=2) + "\n")
(root / "cs2-ui-source.json").write_text(json.dumps({"author": "Valve", "build": "26144732",
    "depot": "2347770", "depotManifest": "67499503218971311", "generator": "scripts/import-cs2-ui-audio.py",
    "processing": "Existing verified generic click/hover/buy OGGs reused. New native PCM WAVs encoded to 48kHz Opus with original channel count; no normalization or baked gain/pitch. Event gain/pitch applied once at playback.",
    "silentPopupTransition": {"event": "UIPanorama.ui_custom_lobby_dialog_slide", "volume": 0},
    "limitations": "Browser UI role mapping and volume buses adapt the native definitions; final native mixer/backend callbacks are not reproduced. No invented generic-back event is used. One representative child per native variation list is scheduled immediately; exact engine child timing, reverb and layering remain approximations.",
    "bindings": fingerprints, "clips": added}, indent=2) + "\n")
manifest["clips"] = stock + added
manifest["uiSource"] = "../cs2-ui-source.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Imported {len(added)} additional native UI clips for {len(bindings)} interactions")
