# Native CS2 music kits

Music, compositions and artwork belong to Valve and the credited artists. This
library is imported from the user's installed Counter-Strike 2 content. The
catalog preserves the shipped music-definition IDs, display text, inventory
artwork and all kit audio, including alternate recordings not assigned to a
current event. StatTrak and ordinary items share the same music definition and
media rather than duplicating the library.

The runtime library contains 1,581 kit audio assets: 1,442 native MP3 files and
139 Ogg Opus delivery files, totaling 849,431,078 bytes, plus 102 inventory images.
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

Native MP3 payloads are kept bit for bit. Native PCM16 recordings are served as
160 kbps variable-bitrate Ogg Opus, encoded with FFmpeg/libopus at complexity 10
in audio mode with 20 ms frames. The required 48 kHz sample rate is explicit;
there is no trimming, normalization or channel downmix. These delivery copies
are lossy. Verified lossless FLAC sources remain outside public assets in the
original export, with their original hashes and PCM verification preserved under
`lossless_source` in each converted provenance record.

The 139 former runtime FLACs shrink from 532,858,694 to 111,005,769 bytes, saving
421,852,925 bytes (79.2% of that subset). Every Opus file is fully decoded after
encoding and its sample count must match the resampled native length within one
48 kHz sample, checking that encoder pre-skip and end padding preserve timing.
Existing per-event start/end times, weights and envelopes are unchanged. None
of the converted tracks supplies a currently declared looping cue; native round
loops continue using their original MP3s.

Converted PNGs preserve the inventory artwork; unused physical CD-case material
maps and source tool files remain in the external export.

Music streams on demand; opening the game must not download or decode the whole
library. Music-kit MP3/Opus HTTP objects use identity transport so media byte
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

Given the checked-in library/catalog and that complete verified lossless export,
rebuild the Opus delivery copies from the repository root:

```sh
python3 packages/assets/encode-music-opus.py /path/to/verified-music-export
bun run assets:prepare
```

The encoder checks each lossless input against its recorded SHA-256, stages and
fully decodes all outputs before publishing, updates catalog/provenance bindings,
and removes the superseded public FLAC copies only after successful validation.
It never modifies the external lossless export. The Ogg muxer uses bitexact flags
and a fixed serial offset for repeatability with the recorded encoder toolchain.
The retained source-script snapshots document the original native extraction;
the former initial importer is no longer a maintained repository tool.
Do not commit native VPKs, tool executables, lossless source exports, transfer
archives or screenshots.
