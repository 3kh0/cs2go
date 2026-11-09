# Native CS2 music kits

Music, compositions and artwork belong to Valve and the credited artists. This
library is imported from the user's installed Counter-Strike 2 content. The
catalog preserves the shipped music-definition IDs, display text, inventory
artwork and all kit audio, including alternate recordings not assigned to a
current event. StatTrak and ordinary items share the same music definition and
media rather than duplicating the library.

The runtime library contains 1,581 kit audio assets: 1,442 native MP3 files and
139 lossless FLAC files, totaling 1,271,284,003 bytes, plus 102 inventory images.
The separate reference export also retains global stingers, an empty sound and
unused physical-case texture maps; these are not mislabeled as kit tracks.

`catalog.json` is the compact runtime index. It includes all 102 shipped music
definitions and their 19 event declarations each. The `valve_02` legacy alternate
has no current English localization; its native identifier is retained rather
than inventing an official title. `valve_cs2_01` is definition 1; `valve_02` is
definition 2; `valve_01` is the CS:GO kit at definition 70. Missing definition IDs
77 and 97 are not synthesized.

`native-events.json` retains the complete decoded music definitions and event
properties, including the stop/group/priority flags. `source.json` records the
original VPK members, archive offsets, CRC32/SHA-256, sound headers, decoded media
hashes and runtime bindings. The original native files are external inputs and
are never edited. Decoding uses official Source 2 Viewer CLI 20.1.

## Tracks and authored playback

| Runtime cue | Native event | Native role |
| --- | --- | --- |
| `menu` | `Music.Background` | Main menu |
| `mvp-preview` | `Music.MVPPreview` | Inspecting the MVP anthem |
| `selection` | `Music.Selection` | Team selection |
| `match-found` | `Music.MatchFound` | Match found/accept stage |
| `loading` | `Music.LoadingScreen` | Loading a match |
| `start` | `Music.StartRound` | Buy/freeze period |
| `action` | `Music.StartAction` | Beginning of live round action |
| `start-gg` | `Music.StartRound_GG` | Arms Race round start |
| `bomb` | `Music.BombPlanted` | Active planted bomb |
| `bomb-countdown` | `Music.BombTenSecCount` | Final bomb warning |
| `hostage` | `Music.GotHostage` | Hostage picked up |
| `hostage-rescue` | `Music.HostageNearRescue` | Hostage near rescue |
| `countdown` | `Music.TenSecCount` | Final round warning |
| `win` / `lose` | `Music.WonRound` / `Music.LostRound` | Team round result |
| `deathcam` | `Music.DeathCam` | Death camera |
| `mvp` | `Music.MVPAnthem` | MVP announcement |
| `match` / `end` | `Music.MatchStart` / `Music.MatchEnd` | Match start/end |

Tracks remain separate full recordings. The catalog carries each event's native
variant weights, gain, loop flag, per-variant start/end bounds, beat sync points,
stop time, priority and volume-envelope inputs. For example, the CS2 default
StartAction declaration stops after 10 seconds despite its longer audio file.
Seven kits declare MVP variant weights of 0.8/0.2; these are shipped values, not
an estimated rare-track probability. The 17 unassigned alternate recordings are
listed as `extraTracks` and are not falsely assigned to an automatic event.

The browser integrates these declarations with its own supported game states;
it does not execute the complete Source sound-stack VM. Arms Race and hostage
cues are retained for inspection despite those modes not being implemented.
Native VSND embedded loop headers remain in provenance; they are not assumed to
override an event's explicit playback configuration. Multiplayer playback does
not reproduce another player's independently equipped kit without shared kit
metadata.

## Media, loading and transport

Native MP3 payloads are kept bit for bit. Native PCM16 recordings use lossless
FLAC with no resampling, remixing, trimming or normalization. Every FLAC is decoded
back to signed 16-bit PCM and its SHA-256 is checked against the compiled native
sample payload. Converted PNGs preserve the inventory artwork; unused physical
CD-case material maps and source tool files remain in the external export.

Music streams on demand; opening the game must not download or decode the whole
library. Music-kit MP3/FLAC HTTP objects use identity transport so media byte
ranges and authored seeks address codec bytes directly. Other asset transport
policies remain unchanged. The catalog's native parameters do not establish
complete Source mixer or engine timing parity.

## Regeneration

The verified converted export and source-script snapshots are retained outside
runtime assets under ignored `artifacts/music-kit-reference/`. The Windows
export uses the installed CS2 VPKs and official Source 2 Viewer CLI 20.1, retaining
VPK directory/tool hashes and resource CRC/SHA checks. Its `export_music.py`,
`metadata.py`, `media.py` and `flac.py` snapshots document extraction, decoding,
selection and lossless conversion. They require the installed game and the
recorded tool versions; native originals stay untouched.

Given that complete verified export directory, run from the repository root:

```sh
python3 packages/assets/import-music-kits.py /path/to/verified-music-export
bun run assets:prepare
```

The local importer verifies converted file hashes, independently verifies FLAC
PCM through FFmpeg, copies only music-kit tracks and associated inventory art,
checks that every catalog track resolves, and regenerates catalog/provenance.
`--metadata-only` exists for concurrent implementation before media transfer;
that output alone is not a complete releasable library. Do not commit native
VPKs, tool executables, source WAVs, transfer archives or screenshots.
