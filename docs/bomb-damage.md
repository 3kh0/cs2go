# Native baked C4 damage

Dust II now has a local, lossless copy of its actual `maps/de_dust2/baked_bomb_damage.vdata_c`: **85,697 positions and 171,394 site-major damage records**, from the same October 8, 2026 Steam depot manifest as the imported map. `packages/assets/public/models/maps/bomb-source.json` records the VPK/resource/output hashes. The two source site powers are **1929** and **3234**. These are not the old radial peak-damage values.

Run `python3 scripts/import-bomb-damage.py` with the existing downloaded map and Source2Viewer CLI. Optional `--vpk`, `--cli` and `--cache` arguments select tool/cache locations or another copy of the pinned local map. The importer verifies the map hash against the existing map provenance before extraction. The importer leaves original files untouched, checks field dimensions and coordinate uniqueness, and writes a 929,136-byte gzip binary. Runtime retains the original signed-short positions and unsigned phase/yaw/pitch records and builds one reusable spatial tree. Runtime makes no external requests. Missing data fails loading; an invalid site/query returns `null`, never a guessed radial damage number.

## Evidence and implementation

Valve's [July 8–9, 2026 updates](https://www.counter-strike.net/news/CS2?l=english) replaced spherical C4 damage on official maps with precomputed map data and traveling blast damage. The next update removed the map-wide minimum one damage.

The [Source 2 Viewer decoder](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/108ec505021af108c7f69dbd4d3a64f89d74304e/ValveResourceFormat/Resource/ResourceTypes/GenericData/CS2/BombDamage.cs) establishes the binary field layout and raw phase/power calculation. Its [scene loader](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/108ec505021af108c7f69dbd4d3a64f89d74304e/Renderer/Renderer/SceneNodes/CS2BombDamageSceneNode.cs) documents expanded site bounds (32 Source units) and source-order site selection. Merely using its debug visualization would miss the player's stance/facing correction and later decoder changes.

The portable query uses the first-hand [October 3 static native audit](https://github.com/Starfie1d1272/cs2-c4-damage/blob/4e288d3c986183b5357c1264bc4793cd3d394688/docs/research/static-audit-2026-10-03.zh-CN.md) and its [model documentation](https://github.com/Starfie1d1272/cs2-c4-damage/blob/4e288d3c986183b5357c1264bc4793cd3d394688/docs/model.md). The small Apache-2.0 math and KD-tree modules are adapted with their license and notice in `apps/game/src/bomb-field/`, also bundled under `packages/assets/public/licenses/cs2-c4-damage/` for production distributions.

Implemented query details:

- Native float32 midpoint KD-tree construction, two-pass partition, eight-point leaves, axis/tie/traversal rules; original record ordering is retained.
- Inclusive site bounds expanded by 32 units and source-order lookup.
- Float32 phase/power remapping and damage-byte truncation/saturation (0–255).
- Current `/255` yaw/pitch decoder and sublethal stance/facing Bias calculation. Raw damage at least 100 bypasses stance/facing reduction.
- Explicit collision-center sample point supplied by gameplay. The API converts between Source coordinates/inches and the game's Three.js coordinates/meters.
- Optional caller-driven second query: when the sample-to-node visibility trace hits and a downward hull trace finds ground, sample again at the original sample's horizontal coordinates with vertical coordinate `sample.y - actorOrigin.y + groundY`; a failed second query keeps the first hit.

`field.playerDamage(hit, forward, crouched)` returns predicted **health damage**, not pre-armor firearm damage. The audited player-query model does not take armor as an input. Applying the game's firearm armor function afterward would add an unsupported second reduction. Native armor depletion from C4 remains unqualified.

## What is still not exact

This is a static reconstruction using authentic current map bytes, **not a claim of fully qualified live CS2 parity**. The audited query binary is build 25687242 from October 2; the map is the local October 8 depot. We have not matched and instrumented that exact running engine build or compared captured native stage traces at boundary points.

The browser's collision hulls, triangle visibility and ground queries do not reproduce every native collision filter, dynamic entity and movement-service branch. The audit specifies visibility mask 1/group 3, then a downward hull sweep from actor origin over `float32(2 * g_flConfigMaxCoord * sqrt(3))` Source units (observed configuration 16384), with distinct filter fields `0xC3011`, `0x48100`, `0x40000`, group 11. A browser floor query is a reconstruction of that physics service, not proof of native equivalence.

**Actual damage-arrival timing has not been recovered.** The ValveResourceFormat shader's `phase / 768` is a repeating debug-arrow animation, not evidence for gameplay shockwave speed. Neither the audited package nor the shipped convars examined specifies a verified applied-damage schedule. Applying sampled damage at detonation remains an instantaneous approximation; do not use that debug-pulse constant as a claimed exact blast speed.
