# Assets and maintenance tools

Runtime assets are checked in under `packages/assets/public/`. Development and ordinary local builds use those files; production can use an immutable R2 release. No conversion tool or installed CS2 copy is needed to run or build the checked-in game. Keep original supplied files and installed game files read-only.

## Provenance

Hashes, source URLs, depot/tool versions and processing notes live beside their outputs in `source.json`, `*-source.json` and `source-manifest.json`. The release-wide SHA-256 index is `packages/assets/manifest.json`. Preserve these and all bundled licenses when changing assets.

| Asset family                                   | Provenance location under `packages/assets/public/`                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Dust II, collision, lighting and baked C4      | `models/maps/` and `models/maps/lighting/`                                              |
| Agents, first-person hands and optional roster | `models/agents/` and `models/agents/roster/`                                            |
| Weapon models, actions, skins and suppressors  | `models/viewmodels/`, `models/animations/` and `skins/`                                 |
| Knives                                         | `models/animations/knives/`, `models/animations/bayonet/`, `models/bayonet.source.json` |
| Audio, event mappings and startup bank         | `audio/` and `audio/source/manifest.json`                                               |
| Menu media, icons, fonts and tracers           | `ui/`, `icons/`, `fonts/cs2/` and `effects/`                                            |

Original weapon OBJs and initial WAVs came from supplied Downloads folders. Additional historical sounds came from pinned `sourcesounds/csgo`; native CS2 sound manifests supersede selected recordings. Weapon viewers supply pinned mesh/animation exports. Native Steam/Windows extractions supply map, agent, pose, interface and audio resources. Kill-feed silhouettes use the supplied Killfeed Generator reference. Exact inputs remain recorded in the corresponding manifests.

Imported geometry and clip samples do not reproduce the complete Source 2 renderer or evaluated animation graphs. Three.js materials, lighting, retargeting, procedural constraints, sound mixing and effects retain documented approximations. The catalog includes all 556 listed finishes across twenty cosmetic knife models; team-default knives have no paint kits. Pattern/wear use the existing local paint renderer.

## Maintained scripts

Run scripts from the repository root. Python tools use Python 3; check each tool's docstring/arguments for external inputs.

| Scripts                                                                                                | Purpose and requirements                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `build-assets.mjs`, `service-worker.js`                                                                | Vite asset integration and production cache worker; required by builds/tests                                |
| `check-asset-cache.mjs`, `check-cache-update.mjs`, `benchmark-loading.mjs`                             | Chromium production cache/update checks and local loading measurements; use `CACHE_URL` for the preview URL |
| `pack-audio.py`                                                                                        | Repack existing encoded clips into the startup bank, without re-encoding                                    |
| `import-weapon-stats.py`, `import-accuracy-data.py`, `import-recoil-data.py`, `import-utility-data.py` | Pinned shipped gameplay inputs; Python and curl                                                             |
| `import-weapon-action-data.py`, `import-world-ball-origin.py`                                          | Derive small simulation metadata from local GLBs                                                            |
| `import-bomb-damage.py`, `import-buy-zones.py`, `import-world-ball.py`                                 | Extract pinned map/physics inputs with Source2Viewer and matching cached VPKs                               |
| `import-sound-ranges.py`                                                                               | Extract distance curves from matching compiled/decoded weapon sound events                                  |
| `import-all-knives.py`                                                                                 | Import nineteen additional knife models/icons from the pinned viewer; Bun, curl, Pillow and NumPy           |
| `import-inventory.py`                                                                                  | Add missing knife finishes and full-color default inventory renders; Bun, curl and Pillow                   |
| `extract-knife-timings.py`, `import-knife-timings.py`                                                  | Audit installed native clips and bind their timings to bundled GLBs                                         |

`scripts/cs2-weapon-audio.json` remains the input for audio packing, range extraction and source-integrity tests. Do not discard it as an old report.

One-off model/map/audio converters, patches and investigation reports were retired in this cleanup. Their generator names in asset manifests are historical provenance, not promises of a currently installed command. To rerun one, restore the required script and its helper chain from the last pre-cleanup revision:

```sh
git restore --source=9aca152cb6f8e3fefd15b1beaacefb19bc0f74a4 -- scripts/<file>
```

The same revision contains the detailed extraction notes under `docs/`. No duplicate archive is kept in the working tree.

## Updating assets

`python3 scripts/import-default-weapons.py` imports the finished HD default materials for all 34 firearms from CS2 Inspects. Defaults use the HD body and its native color, AO, roughness, metalness and decoded normals; the legacy substrate bodies remain available for compatible painted finishes. Source URLs, input hashes and output hashes are pinned in `models/viewmodels/defaults-source.json`. The importer preserves meshopt geometry, animation/bind data and quantized UV transforms, and needs curl, Pillow and NumPy. Three.js lighting remains an approximation.

`python3 scripts/import-agent-animations.py` imports the pinned CS2 Inspects agent catalog and 153 deduplicated animation packs (1,221 agent clips; pet clips are excluded). All 65 source agents map to the existing native roster, preserving saved aliases and avoiding duplicate body models. Default CT uses native SAS (item 5600); the former Source 1 body, arms, compatibility code and sampled retargets have been removed. Provenance is under `models/agents/inspects/`. Common movement loads at startup; weapon actions and searchable preview packs load on demand. Clips do not execute the complete native graph, IK or procedural masks; secondary weapon tracks remain preserved as data while world props retain their existing mechanical rendering.

`python3 scripts/import-gloves.py` imports 96 glove entries (94 paints and two defaults), ten native models, local shader/mask assets and thumbnails. `python3 scripts/import-gloves.py --agent-arms` imports the 65 agents' first-person sleeve/default-glove variants. Model/finish caches retain active leases plus two idle entries. Provenance is under `models/gloves/` and `skins/gloves/`. The importer needs Bun, curl, Pillow and NumPy; original inputs remain cached/read-only under `artifacts/`.

Viewmodel controls follow the viewer's native 4:3 horizontal-FOV conversion, Source-inch offsets and aspect stretch, verified against viewer bundle `index-CXUheY2V.js` (SHA-256 `724899da942ccf6d0ec3864caeee02e5bcbe3f8d28c8375d1e128bb77d6e6ba4`). This matches projection/settings, not the complete Source 2 renderer or animation graph.

Run the relevant maintained tool, review changed outputs/provenance, then:

```sh
bun run assets:prepare
bun run assets:verify
bun run test:tools
```

Include changed assets, provenance and release manifest together. Do not regenerate unrelated assets just for a code change. R2 publication and rollback behavior are covered in [deployment.md](deployment.md).

## Knife timing

Stable IDs and the complete 22-model roster live in `packages/protocol/src/armory.ts`; append new IDs rather than renumbering old skins. All knives are equipped through Inventory.

The Windows audit used build 26144732 / patch 1.41.9.2 and Source2Viewer 20.1.7467. `packages/simulation/src/data/knife-animations.json` binds 225 bundled actions to native hashes and GLB fingerprints. Eight old Bayonet clips used duration/frames instead of duration/(frames−1); runtime restores the correct interval once, preserving optimized trailing holds. Bayonet draw/slash/stab clips last 1.1667 seconds and inspect lasts 6.2 seconds. Knife base playback is 1.0; visual duration is independent of melee recovery and the 1.0-second deploy readiness.

```sh
python3 scripts/import-all-knives.py
python3 scripts/extract-knife-timings.py --game /path/to/game/csgo --tool /path/to/Source2Viewer-CLI --vendor /path/to/srctools --out artifacts/native-knife-timing
python3 scripts/import-knife-timings.py artifacts/native-knife-timing/timing-roster.json
```

Timing extraction needs scratch-local srctools 2.7.0 and the matching CLI. The importer verifies native resource hashes and GLB time grids. A viewer refresh requires explicit `--refresh` and review; rerun timing binding after model regeneration. Native rare branches, inspect looping, conditional blends and live `weapon_action_speedscale` values are not fully reproduced.

Menu geometry follows the decoded shipped Panorama styles at [GameTracking-CS2 `00037586`](https://github.com/SteamTracking/GameTracking-CS2/tree/00037586b57e4f3efabf50076a15ce2a6c2f3004/game/csgo/pak01_dir/panorama): `loadout_grid.css`, `itemtile.css`, `mainmenu.css`, and the 192×190 cell declaration in `loadout_grid.xml`. A shared viewport-height / 1080 scale matches the supplied 1600×1200 recording; the engine-side scaling declaration was not available. The top bar uses the shipped typography and transition durations, with a lightweight CSS approximation of the native selection particles.
