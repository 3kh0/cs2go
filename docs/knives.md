# CS2 knife roster

**INVENTORY → Weapon Skins → Equip Knife** selects any of the 22 knife models. **3** and mouse-wheel cycling equip the selected knife; **F** inspects, left-click slashes, and right-click stabs. Selection also works during a private multiplayer match. Knives share the existing melee rules and recovery deadlines; changing the model cannot bypass an attack cooldown.

The original Bayonet (inventory ID 4), Butterfly Knife (5), Karambit (6), all firearm IDs (0–3, 7–36), and their saved skins remain unchanged. New entries append at IDs 37–55. Valve economy definition numbers are separate from these persistent game indices; `packages/protocol/src/armory.ts` supplies the shared mapping and protocol bounds. Protocol version 5 prevents older clients/servers with the smaller roster from joining an incompatible match.

| Inventory ID | Knife           | Valve item definition |
| ------------ | --------------- | --------------------- |
| 4            | Bayonet         | 500                   |
| 5            | Butterfly Knife | 515                   |
| 6            | Karambit        | 507                   |
| 37           | CT Knife        | 42                    |
| 38           | T Knife         | 59                    |
| 39           | Classic Knife   | 503                   |
| 40           | Flip Knife      | 505                   |
| 41           | Gut Knife       | 506                   |
| 42           | M9 Bayonet      | 508                   |
| 43           | Huntsman Knife  | 509                   |
| 44           | Falchion Knife  | 512                   |
| 45           | Bowie Knife     | 514                   |
| 46           | Shadow Daggers  | 516                   |
| 47           | Paracord Knife  | 517                   |
| 48           | Survival Knife  | 518                   |
| 49           | Ursus Knife     | 519                   |
| 50           | Navaja Knife    | 520                   |
| 51           | Nomad Knife     | 521                   |
| 52           | Stiletto Knife  | 522                   |
| 53           | Talon Knife     | 523                   |
| 54           | Skeleton Knife  | 525                   |
| 55           | Kukri Knife     | 526                   |

The roster covers the two team defaults and twenty cosmetic knife types. GunGame's `weapon_knifegg` reuses the default T model rather than adding a distinct selectable knife. Non-knife special-mode tools are excluded.

## Assets and regeneration

The nineteen new meshes, skeletons, inverse binds and embedded action clips come from Valve resources served by the public [CS2 Inspects viewer](https://cs2inspects.com/3d-viewer), matching the established Butterfly/Karambit import source. Every API description, mesh and downloaded texture is SHA-256 pinned in `packages/assets/public/models/animations/knives/expanded-source.json`. Runtime GLBs and silhouette icons stay under `packages/assets/public/`; gameplay makes no viewer/API requests. Original supplied files and the existing three models remain intact.

```sh
python3 scripts/import-all-knives.py
bun run assets:prepare
bun run assets:verify
```

The importer requires Bun, Python, Pillow, NumPy and curl. It caches inputs in ignored `artifacts/all-knives/`, rejects changed pinned inputs and accepts a deliberately reviewed refresh with `--refresh`. Geometry and all native animation channels are retained. Vanilla base color, ambient occlusion, roughness and metalness are repacked into embedded lossless WebP textures at up to 1024px; non-neutral octahedral normals are decoded to tangent-space XYZ. Silhouettes are projected from original triangles. Compiled Source 2 material shading and the reduced texture resolution differ from Valve's renderer.

Source draw, slash/stab contact and miss, idle, and inspect variants drive the existing Phoenix arms and weapon bones, including both Shadow Daggers. Defaults name their first idle `idle`; Falchion, Bowie and Shadow Daggers provide only one idle clip; Navaja lacks a separate heavy-hit clip and uses its heavy-miss track. Playback handles those differences explicitly. Original Bayonet animation remains on its existing importer and player.

## Native timing verification

The Windows Amp runner audited installed build **26144732**, patch **1.41.9.2**, using Source2Viewer **20.1.7467**. The audit covers 317 clips across all 22 animation families, plus 45 viewmodel graphs. Every secondary weapon skeleton matches its primary clip's frame count and duration. `packages/simulation/src/data/knife-animations.json` pins the 225 bundled actions to native resource hashes and their actual GLB fingerprints; unit checks reject stale asset/timing combinations.

Eight old Bayonet exports used `duration / frames` instead of `duration / (frames − 1)` for sampler inputs. Loading corrects every primary/secondary time array once and restores the full native duration. It preserves optimized trailing holds: heavy stab's final changing key is followed by an unchanged last frame, so stretching its last key to the clip endpoint would distort the motion again. Other bundled knives already use the correct frame interval.

Bayonet draw, slash and stab each last **1.1667 clip seconds**; idle clips last **2 and 1 seconds**, and inspect lasts **6.2 seconds**. Knife clip nodes declare base speed **1.0**. The prior fixed 0.9 playback factor is removed for knives. A slash is no longer squeezed into a 0.5-second visual timer: visuals advance in seconds, independently of the existing attack recovery, and ready attacks can interrupt a recovering pose. Native inspect-block events govern when an unfinished attack can yield to inspection. Local play, private matches and first-person spectators share the clock.

Bayonet deploy readiness remains **1.0 second**, independently of its draw animation. The native outer graph accepts a live `weapon_action_speedscale` parameter, whose runtime values were not observed. Native inspect-phase looping, conditional transition blends and rare-variant selection are not fully reproduced; these verified clip intervals do not establish complete executable-graph parity. Historical melee damage/impact/recovery rules remain documented approximations.

To regenerate from a read-only installation, use Python with srctools 2.7.0 and the pinned CLI. The extractor requires a separate output directory and records tool/build identity, compiled resource hashes and decoded text hashes:

```sh
python3 scripts/extract-knife-timings.py --game /path/to/game/csgo --tool /path/to/Source2Viewer-CLI --vendor /path/to/srctools --out artifacts/native-knife-timing
python3 scripts/import-knife-timings.py artifacts/native-knife-timing/timing-roster.json
```

Run the timing importer after regenerating models, then run the normal asset preparation/verification commands. The timing importer verifies native compiled fingerprints and tests every GLB timestamp against both candidate frame grids; it rejects an unexplained timebase.

New entries add **vanilla finishes only**. Existing skins and wear/seed behavior remain available for the original weapons. Viewer exports are pinned to their downloaded bytes; they are not a claim of exact parity with the latest installed CS2 build. Playback uses the separately audited native clip intervals at base speed 1.0. Generic new-knife deployment audio, reconstructed impact/audio phases and the existing melee rules remain. Native rare-draw branching, graph probabilities, model-specific procedural constraints and the final Source 2 renderer are not reproduced. Menu previews use the existing native knife pose, including the separate two-hand Shadow Daggers pose.
