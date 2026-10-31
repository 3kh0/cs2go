# Firearm audio sources

All 34 firearm sound kits use recordings extracted directly from Valve's CS2 Steam depot **2347770**, app **730**, manifest **4758919807587010422** (October 8, 2026, 22:01:43 UTC). This is the pinned imported snapshot, not a promise to follow future game updates automatically.

`scripts/cs2-weapon-audio.json` maps the game's sound-marker callbacks to the native `soundevents/game_sounds_weapons.vsndevts_c` events. The first recording listed by each event is selected. This matters because the depot contains both legacy and modern recordings: for example, the AK event selects `ak47_02.vsnd`, rather than the old `ak47-1.vsnd`. The mapping retains every native variation's filename for audit.

The original 193 imported clips cover shots, magazine/shell removal and insertion, bolt/slide actions, and drawing across all 34 firearms, plus their native scope cues. USP-S and AWP now use their actual draw recordings rather than aliases to slide/bolt sounds. The CZ75 uses its own native magazine-in recording; its other shared P250 actions are referenced by the native CS2 events themselves. Some recordings shipped and selected by CS2 are retained from CS:GO; importing them from the CS2 depot does not imply every individual waveform changed.

`packages/assets/public/audio/cs2-weapons-source.json` records the VPK directory hash, native event-resource hash, each selected compiled sound's hash, decoded audio hash, final Opus hash, and runtime byte count. Historical import manifests remain as provenance for earlier imports; this manifest is authoritative for current firearm files. Other effects and music use the native CS2 imports described below.

A further 46 native recordings supply unsuppressed M4A1-S/USP-S shots, suppressor screw cues, and draw/pin/throw/bounce/effect cues for all six grenade types. The combined importer now records 239 clips; the startup pack includes 282 effects in total. Shared native events are used where a grenade has no separate event. Sound-operator mixing and variation remain approximations. Regeneration reuses an existing encode only when its source, decoded, and output hashes still match the provenance manifest.

## Regeneration

Supply the pinned depot's `game/csgo/pak01_dir.vpk`. The importer validates its SHA256, reuses adjacent matching archive files, and downloads missing required archives into the ignored cache. Original files are never modified.

```sh
python3 scripts/import-cs2-weapon-audio.py \
  --vpk /path/to/game/csgo/pak01_dir.vpk \
  --cli /path/to/Source2Viewer-CLI \
  --downloader /path/to/DepotDownloader
python3 scripts/pack-audio.py
```

Tools: Source2Viewer CLI **20.0.6980+a06886f7d06049052d32a7381ec05523064a2ca0**, DepotDownloader **3.4.0**, FFmpeg with libopus. The source resource CRC is checked before export, and every selected sound must occur in its named native event. Export support is documented by [Source 2 Viewer](https://s2v.app/ValveResourceFormat/guides/exporting-sounds.html). Conversion produces mono 48 kHz, 96 kbps Opus without normalization; the original WAV/MP3 and compiled sounds remain in the ignored import cache. `pack-audio.py` then concatenates the Opus files losslessly into the shared startup bank.

## Fidelity boundaries

These are native CS2 recordings, but playback is the browser game's existing mixer. It uses one representative variation per event, the existing animation callback times, mono HRTF positioning, bounded voices and authored room processing. Native random variation, sound-operator gain/pitch/distance layers and the complete Source 2 mix graph are not reproduced. Complex reloads have more native events than the current six callback phases; belt covers, dual-magazine details and other intermediate gestures are not all separate cues. The XM1014's native `Grab` recording supplies its action callback. Scope callbacks use the corresponding native zoom-in recordings; separate native zoom-out variations are not distinguished by the current callback.

## Remaining effects and complete runtime coverage

All 43 remaining player, movement, equipment, UI, knife and bomb clips are mapped in `scripts/cs2-effects-audio.json` and imported from CS2 depot **2347770**, manifest **67499503218971311** (October 22, 2026, 21:23:12 UTC). The older October 8 manifest was unavailable anonymously when these replacements were imported; firearm/grenade and music bytes retain their existing verified October 8 provenance.

`packages/assets/public/audio/cs2-effects-source.json` records compiled resource, decoded audio and output hashes plus the native player, footsteps, UI and weapon event-table hashes. The importer verifies VPK directory SHA256, resource CRCs and event membership before converting to mono 48 kHz, 96 kbps Opus. Source 2 Viewer CLI 20.1 and DepotDownloader 3.4.0 were used.

```sh
python3 scripts/import-cs2-effects-audio.py \
  --vpk /path/to/october-22/game/csgo/pak01_dir.vpk \
  --cli /path/to/Source2Viewer-CLI \
  --downloader /path/to/DepotDownloader
python3 scripts/pack-audio.py
```

All 282 packed effects now have direct CS2 depot provenance; the 11 music tracks stream separately from the native CS2 soundtrack. The source manifests and startup bank are checked against the actual bundled bytes. Historical community/source import scripts and manifests are retained for history, not current regeneration; running them would overwrite native clips.

Modern knife swish/contact/draw, Panorama UI, player damage and footstep events replace the old cue mappings. Butterfly animation cues retain their named native events. The browser still has only two walking surfaces, shared equipment sounds and representative single-layer knife, impact and bomb cues. CS2's full sound graph, faction-specific gear layers, variant selection and gains are not reproduced. Some recordings used by native CS2 events are themselves retained from older games.

## Remote shot audibility

Single-player bots and multiplayer players use the same distance mix. Suppressed USP-S shots fade out by 26 meters; suppressed M4A1-S and MP5-SD shots fade out by 45 meters. Removing a detachable suppressor restores the ordinary 150-meter gunshot range. These are browser mix tuning values, not extracted Source 2 attenuation curves. An explicit smooth range envelope reaches zero because Web Audio inverse-distance attenuation alone clamps to a nonzero gain. Out-of-range weapon shots allocate no audio voices. Geometry muffling applies before playback starts, then bounded acoustic path updates refine occlusion/diffraction; room sends follow the attenuated signal.

Chromium offline-audio regressions measure near/edge/distant USP output, a distant unsuppressed comparison, and the first 31 ms behind a wall, in addition to direction, distance, acoustic probe and room-tail checks.
