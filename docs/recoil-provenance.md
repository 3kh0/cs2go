# Recoil provenance and validation boundary

The importer (`python3 scripts/import-recoil-data.py`) pins the same CS2
`weapons.vdata` revision as the weapon-stat importer and records its SHA-256.
It extracts each firearm's seed, primary/alternate angle, angle variance,
magnitude, magnitude variance, cycle time and full-auto flag. Accuracy recovery
fields are retained as source evidence but are **not** used as punch decay.

Source: https://github.com/SteamTracking/GameTracking-CS2/blob/5278de99318192d682ec7f0e1cc3ea9449f10c6e/game/csgo/pak01_dir/scripts/weapons.vdata

`apps/game/src/recoil.ts` replaces authored sine drift with a deterministic per-weapon,
per-mode seeded table and independent aim punch/velocity and weapon indices.
It uses a Park–Miller shuffled stream, angle/magnitude blending for automatic
weapons, early-shot suppression, exponential/linear punch recovery and a bounded
64-entry repeating table. The parameters are imported; the generation and
integration algorithm and its constants are a **Source-style reconstruction**,
not a verified implementation of the current closed CS2 client/server.
Weapon index follows the legacy exponential law: multiply by
`exp(-ln(10) * 2 * dt)` after 1.1 firing cycles. This is sourced legacy
behavior, not a new authored linear reset curve. The 128 Hz simulation is also not native subtick timing.

The current schema exposes predictable base angle, velocity and timestamp:
https://github.com/SteamTracking/GameTracking-CS2/blob/5278de99318192d682ec7f0e1cc3ea9449f10c6e/DumpSource2/schemas/client/CCSPlayer_AimPunchServices.h

The current convar dump has `view_punch_decay=18` but no `weapon_recoil_*`
entries. This does not establish that those constants are absent from the
binary; it means the dump cannot verify them. The separate first-hand binary
extraction in CS2OpenDev SchemaTracker build 25815307 was checked as well, with
the same absence. Its engine constants do not provide the recoil algorithm.
https://github.com/SteamTracking/GameTracking-CS2/blob/5278de99318192d682ec7f0e1cc3ea9449f10c6e/DumpSource2/convars.txt
https://github.com/CS2OpenDev/CS2OpenDev-SchemaTracker

Valve's public Source SDK documents the uniform random stream interface and its
32-entry shuffle state, but does not publish CS2's recoil implementation:
https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/packages/assets/public/vstdlib/random.h

Independent, dated impact measurements for AK-47, M4A4 and M4A1-S were inspected:
https://imbaboost.com/tools/cs2-recoil-patterns (2026-10-09, CS2 1.41.9.0).
They report approximately 0.06 degrees/pixel uncertainty and only cover complete
standing sprays of three weapons. They cannot certify alternate modes, recovery,
other weapons or camera motion. No macro tables are imported. Exact parity would
require reproducible native no-spread shot-angle and punch captures for all
weapons/modes, pause lengths, switches and crouch states, plus comparison against
this simulation. Unit/browser tests establish determinism and correct integration,
not native equivalence.

Legacy algorithm reference inspected separately (a historical CS:GO source mirror,
not an official public CS2 implementation):
https://github.com/perilouswithadollarsign/cstrike15_src/tree/f82112a2388b841d72cb62ca48ab1846dfcc11c8/game/shared/cstrike15
`cs_weapon_parse.cpp` supplies automatic-weapon blending 0.55, suppression 0.75
over four entries (including suppressed magnitude carried into the next blend),
and per-mode seeded tables. `cs_gamemovement.cpp` supplies hybrid angle decay
(exponential 8, linear 18), velocity decay 4.5 and half-step integration.
`weapon_csbase.cpp` supplies index decay coefficient 2, grace 1.1 cycles,
and recoil scale 2. These mechanics are reimplemented; no source files are
bundled. A 2018 mirror corroborates the index decay. They do not establish
that current CS2 still uses the same runtime calculations.

## Accuracy reconstruction evidence

`packages/simulation/src/data/accuracy.json` imports current weapon inputs and five relevant convar defaults from the same pinned revision, recording both source hashes. `weapon_air_spread_scale=1`, `sv_jump_impulse=301.99338`, `weapon_accuracy_stack_boost_limit=2`, `weapon_accuracy_reset_on_deploy=false` and `weapon_accuracy_shotgun_spread_patterns=true` are shipped defaults, not inferred runtime algorithms.

The historical mirror's `weapon_csbase.cpp` supplies movement remapping, persistent posture floors, integer recovery-index interpolation, four-times-crouch airborne recovery, landing velocity impulses and square-root jump-speed remapping. `fx_cs_shared.cpp` supplies shared shot inaccuracy and R8-secondary/early-Negev radius transforms. These source formulas are implemented with current shipped inputs. The newer jump-apex field has no counterpart in that historical implementation; interpolating its endpoint using the historical curve remains a documented inference. Historical scope mode transitions use ordinary accuracy recovery plus an alternate-switch field absent from the current pinned weapon file. No authored scope timer or camera zoom-duration constant is presented as native accuracy evidence.

The user has no runnable native CS2 capture environment. No native trajectory/impact comparison was performed; passing tests establish our integration and mathematical behavior only. Current proprietary recoil constants, seed generation and fixed shotgun patterns cannot be established from these pinned files and remain open instead of being filled with claimed exact constants.
