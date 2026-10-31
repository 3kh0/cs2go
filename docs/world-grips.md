# Gameplay weapon grips

Gameplay now layers a weapon's native standing/crouching arm, wrist and finger posture over the existing locomotion. All 34 firearms have separate grip data. The carried mesh uses its native secondary skeleton reference and a hand-relative `wpn` attachment rather than a shared rifle offset and an axis guessed between the two palms. Native M4A1-S graph nodes 269/270 both select the standing additive layer; the importer composes that layer over crouched locomotion too. Existing shot/draw overlays for the first four weapons are rebased against their own grip, and other firearms no longer borrow AK/USP draw/shot poses.

The Windows Amp runner in Fast mode extracted installed CS2 build 26144732, depot 2347770, manifest 67499503218971311 with Source2Viewer 20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304. The read-only extraction contains 70 raw additive idle layers, their 70 independently shipped absolute companions, default locomotion idles and 36 sampled draw clips with secondary skeleton references. All 70 additive reconstructions matched those companions within 0.0000043 Source inches / 0.000016 degrees. The P90 layer displaces its support hand 7.516 inches from generic rifle idle and changes 38 finger bones by more than one degree.

Runtime data is about 288 KiB compressed at `packages/assets/public/models/animations/grips/poses.json.gz`. It contains retargeted static poses for both existing rigs; clip deltas and weapon attachment inverses are prepared when templates/items are created, not rebuilt from JSON every frame. Asset loading remains bounded. `source.json` records every selected native sample and original resource fingerprint, target model hashes, reference hash, installed build/tool identity and processing limits.

The ignored evidence ZIP is `artifacts/gameplay-poses/native.zip`, SHA256 `e688abb725c0b9af01c29ab26ffb6f3a5843b93bec71195ddbe91616d0be1896`. Its 1496 file hashes and ZIP CRCs were verified before import. Expanded evidence, native graph/masks, raw resources and validation are under `artifacts/gameplay-poses/native/`.

## Reproduction

Use a scratch root, the matching read-only installed game/VPK, Source2Viewer 20.1 and scratch-local `srctools==2.7.0` under `SCRATCH/vendor`. Save Source2Viewer's VPK resource inventory as `SCRATCH/vpk-list.txt`. Never decode fonts or other resources in the installation directory.

```sh
python3 scripts/extract-world-resources.py --root SCRATCH --game GAME/game/csgo --cli Source2Viewer-CLI
```

Decode `SCRATCH/fast-output/gameplay/native/animation` with Source2Viewer's `-d --recursive` into `SCRATCH/fast-output/gameplay/decoded/animation`, retaining separate native/decoded directories. Then sample the clips:

```sh
python3 scripts/extract-world-grips.py --root SCRATCH
bun scripts/import-world-grips.mjs SCRATCH/fast-output/gameplay
bun run assets:prepare
```

The source package's `package-provenance.json` must accompany the sampled manifest. For a new extraction, record the installed build, depot manifest, CLI binary/version and VPK directory fingerprints there before import. The importer checks every selected sample hash and pins its calibration reference; `--refresh` permits a deliberately reviewed reference change.

## Limits and verification

These are genuine pre-procedural gameplay components, not a capture of Valve's final evaluated animation graph. The native graph applies its additive idle layer with an upper-body mask, then later runs Foot IK, AimCS and SnapWeapon. Those executable algorithms and exact sparse-mask interpolation are not reproduced. Runtime expands the upper-body region through spine, arms and fingers; IDF retains its older Source 1 proportions and approximate retargeting. The draw exports are used for secondary skeleton reference binds; this change does not claim new native draw/reload animations.

Chromium inspection compares the broken and corrected P90 and checks AK, MAC10, Sawed-Off and Glock on both original agents. Browser coverage checks all 34 firearms on both rigs, crouching and moving, for finite transforms, plausible scale and equipment remaining near the hands. Existing hit regions, fixed-step locomotion and first-person animations remain independent.
