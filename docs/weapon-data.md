# Gameplay data and fidelity

Gameplay inputs are pinned snapshots, not a claim of parity with future CS2 patches. Simulation data lives in `packages/simulation/src/data/`; source URLs, commits and SHA-256 hashes are recorded in the JSON.

## Shipped inputs

The main weapon, accuracy, recoil and utility snapshot is [GameTracking-CS2 revision 5278de99318192d682ec7f0e1cc3ea9449f10c6e](https://github.com/SteamTracking/GameTracking-CS2/tree/5278de99318192d682ec7f0e1cc3ea9449f10c6e), dated October 11, 2026. It supplies `weapons.vdata`, competitive/casual configs, item definitions and convar defaults. These are shipped data, not open-source CS2 engine code.

```sh
python3 scripts/import-weapon-stats.py
python3 scripts/import-accuracy-data.py
python3 scripts/import-recoil-data.py
python3 scripts/import-utility-data.py
python3 scripts/import-weapon-action-data.py
bun run format
```

The first four commands require curl; the last reads local viewmodel GLBs. Review changed inputs deliberately rather than silently following upstream HEAD. Inventory IDs 0–36 remain stable; the additional knives append at 37–55. Use `isKnife` and `weaponSlot`, not numeric range assumptions.

Magazine-fed guns discard remaining rounds on reload and consume one spare magazine; displayed reserve remains bullet-equivalent. Nova/XM1014/Sawed-Off load individual shells; MAG-7 uses magazines. Reload readiness and deployment use shipped seconds independently of cosmetic playback. Ammo transfers at imported reload markers; switching after insertion retains the magazine while preserving readiness lockout. Burst spacing and zoom durations come from the pinned weapon data.

Casual grants armor, helmets and CT kits, starts at $1000 and caps at $10000. Competitive charges for equipment, starts at $800 and caps at $16000. Its first loss award is $1900, rising to $3400. Prices, faction restrictions, rewards and round rules are shared by local play and the authoritative server.

## Reconstruction boundaries

| System          | Verified inputs                                                                         | Remaining approximations                                                                                      |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Firearms        | Damage, armor ratio, ranges, penetration, pellet count, cycles, ammo and action markers | Damage dispatch, material/body thickness, some hit regions and current native timing behavior                 |
| Recoil/accuracy | Per-weapon/mode seeds, angles, magnitudes, stance and recovery coefficients             | Historical Source-style random stream, spread/punch integration, current CS2 seeds and fixed shotgun patterns |
| Movement        | Pinned convars, native map triangles/hulls and trigger geometry                         | Fixed 128 Hz rather than subtick; actor hull/duck/contact behavior, no ladder/water traversal                 |
| Utility         | Prices, carry limits, launch/fire parameters, native models/clips/sounds                | Launch/bounce solver, HE/flash falloff, fire propagation and coarse smoke cells instead of Source 2 fluids    |
| Animation/audio | Pinned models, clip tracks, sound recordings and markers                                | Retargeting, graph blends, procedural constraints, spatial gain/mix and unobserved live parameters            |
| World props     | Native ball origin, sphere radius and surface data                                      | Contact impulses, rolling, sleep and rigid-body filtering                                                     |

Recoil follows researched legacy Source formulas; current proprietary constants and native trajectory parity remain unverified. The historical implementation reference is [cstrike15_src revision f82112a](https://github.com/perilouswithadollarsign/cstrike15_src/tree/f82112a2388b841d72cb62ca48ab1846dfcc11c8/game/shared/cstrike15), not an official current CS2 implementation. Unit/browser tests establish deterministic integration, not executable equivalence.

Ground Rebel uses its imported native bone-local bullet capsules; the older CT rig and server/player hulls retain simplified hit regions. Penetration has a four-barrier budget, and an actor takes damage once per shot despite overlapping meshes.

Knife rules follow the historical implementation: front initial/repeated slash 40/25, front stab 65, rear slash/stab 90/180 (153 heavy backstab damage through full armor), 85% armor penetration and 48/32-Source-unit reach. Miss/hit recovery is 0.4/0.5 seconds for slash and 1/1.1 for stab. Impact phases and the forgiving trace fan remain reconstructed. Native visual clip seconds are independent; see [assets.md](assets.md#knife-timing). Rear hits use the victim’s visible body direction rather than an AI turn target. Heavy hits use the native `Weapon_Knife.Hit.Heavy` cue for local and remote players. Knives are Inventory equipment, never buy-menu purchases.

## Damage regression audit

All 34 firearm damage values, head multipliers, armor ratios, penetration powers, ranges, range modifiers and pellet counts were checked against the pinned `weapons.vdata` SHA-256. `packages/simulation/src/damage-audit.test.ts` exercises authoritative damage for standing/crouched head, chest, stomach and leg hits, armor/helmet states, shotgun pellets, friendly-fire scaling and AK range/cover cases. Offline A-site back-to-ramp traces are covered by `apps/game/tests/damage-audit.spec.ts`.

A clean enemy AK helmet headshot deals 111 damage at point-blank range and about 109 at 12.7 m. It is lethal at normal A-site distances; cover penetration, very long range (roughly 69 m onward against full armor) or competitive team damage can make a headshot survivable. The headshot cue confirms a head hit, not a kill. No unconditional one-shot override is applied.

The audit corrected multiplayer vest protection on leg hits, knife friendly-fire scaling (other damage rather than bullet damage), and offline utility health rounding to match the authoritative server. Fire bypasses armor; HE/decoy use their shared armor calculation. C4's baked query already returns health damage and is not armor-reduced twice. Utility falloff/propagation and native-body hitbox approximations remain as documented above.

## Native Dust II data

`dust2-buy-zones.json` retains the pinned map's buy and bomb-target hulls. The importer verifies box vertices/planes before reducing them to bounds. Membership uses actor-hull contact; time, team, balance and loadout checks remain separate.

The C4 field contains 85,697 native positions and 171,394 site-major records. `models/maps/bomb-source.json` records map/resource hashes. The query adapts the [statically audited C4 model](https://github.com/Starfie1d1272/cs2-c4-damage/tree/4e288d3c986183b5357c1264bc4793cd3d394688); Apache-2.0 licenses/notices remain in the source and bundled assets. It preserves float32 KD-tree ordering, site bounds and stance/facing correction. Its player query returns health damage; do not apply firearm armor reduction again.

Exact native collision filters, C4 armor depletion and traveling damage-arrival timing remain unqualified. Damage is applied at detonation; the debug visualization's phase/768 constant is not a verified gameplay blast speed. Missing field data fails loading rather than returning an invented radial fallback.

Regenerate map metadata with `import-buy-zones.py`, `import-bomb-damage.py`, `import-world-ball.py` and `import-world-ball-origin.py`; see tool arguments and [assets.md](assets.md). Native source hashes do not establish live-engine parity.
