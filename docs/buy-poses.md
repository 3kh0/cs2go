# Native buy-menu poses

The buy preview samples Valve's `animation/anims/ui_anims/buy_menu/{t,ct,shared}` clips from installed CS2 build **26144732**, depot **2347770**, manifest **67499503218971311**. Source2Viewer **20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304** decoded 81 clips on the user's Windows runner, with Fast enabled. Original game files were read without modification.

`packages/assets/public/models/animations/buy/poses.json.gz` contains 46 choices per team: faction-specific firearms and shared equipment/grenade/knife poses. The menu holds the first nonnegative sample of each clip. Primary tracks pose the body and fingers; secondary tracks pose the weapon parts. Molotov placement is encoded inside its secondary `weapon → weapon_hand_r → molotov` chain while the primary `wpn` stays at the origin. Applying only its primary attachment leaves the bottle at the feet. No extra hand snap is applied.

Firearm geometry is baked once per menu pose using its native secondary skeleton and the existing mesh inverse binds. The authored attachment frame is retained through the existing static world-model normalization. Grenade models retain their native scale, bone hierarchy, and origin. They are not resized or centered from their bounding boxes. The preview uses the existing renderer/context and caches a bounded roster of item models; static poses are applied when the hovered item/team changes, not sampled every frame. Gameplay bot poses and simulation remain separate.

Source inches are converted to meters, with the same Y-up basis as the existing agent animation imports. World-space rotation differences are calibrated against the bundled agents' rifle reference; their bone lengths are retained. The existing pinned CS2 Inspects world-rifle pack supplies that reference only; the shipped buy poses themselves come from the Windows extraction. Native fingerprints, target model hashes and the corrected extraction archive hash are recorded in `source.json` beside the compressed runtime data.

## Reproduction

Use a scratch extraction root, an installed matching game/VPK, Source2Viewer 20.1, and scratch-local `srctools==2.7.0` under `ROOT/vendor`. Original VPKs remain inputs. Export both raw resources and decompiled DMX/descriptors for:

- `animation/anims/ui_anims/buy_menu/`
- `animation/skeletons/characters/worldmodel.vnmskel_c`
- `animation/skeletons/weapons/`

For example, run Source2Viewer twice, using `-i /path/to/pak01_dir.vpk -f <comma-separated paths> -o ROOT/native`, and again with `-d -o ROOT/decoded`. Dump each original compiled buy clip with `-a` into `ROOT/fast-output/clip-data/<clip-name>.txt`. Those dumps restore the static scale channels omitted by DMX. Keep `ROOT/native`, `ROOT/decoded` and `ROOT/fast-output` separate.

```sh
python3 scripts/extract-buy-poses.py --root ROOT --all
```

The extractor verifies DMX binary payload consumption, excludes fake negative-time keys, preserves primary and secondary hierarchies, and checks every nonnegative key for static/moving classification. It emits `fast-output/poses/`, `worldmodel-bind.json`, `all-manifest.json` and a ZIP containing `manifest.json`. Extract that ZIP to an ignored directory and run:

```sh
bun scripts/import-buy-poses.mjs artifacts/buy-poses/windows
```

The importer checks every sampled JSON against its manifest hash and checks the recorded rifle-reference download hash. `--refresh` permits a deliberately reviewed reference update. It writes only the runtime poses and provenance under `packages/assets/public/models/animations/buy/`.

## Verified limits

These are native clip samples, not a capture of the final evaluated UI animation graph. The shipped graph's buy branch contains `CNmSnapWeaponNode` and an additive idle layer; their complete executable behavior is not reproduced. The recurring `attachHand_R * quaternion(-.5,-.5,-.5,.5)` relationship is not universal and is not used as a substitute for the secondary weapon tracks.

Static scale exceptions for revolver parts, XM1014 parts and the Molotov flame are restored from the compiled resources. Compiled root vertical motion is zero in all 81 clips. The few moving buy clips are held at their first sample. IDF keeps its older Source 1 mesh/proportions, so CT retargeting remains approximate. Knife previews use the shared native knife posture with their existing model grip frames. Three.js materials and lighting remain approximations of Source 2.

Browser coverage previews all 34 firearms and the available utility on both teams, checks that hovering does not equip or buy, guards Molotov-to-hand placement, and captures representative poses. Buy-card layout checks keep icons between names and prices at 1440×900 and 1280×720.
