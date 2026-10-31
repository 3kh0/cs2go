# Agent appearances

The main menu’s bottom-right scenery control includes a **Showcase agent** selector. Each team has its own saved choice. The selected agents appear in the homepage, buy preview and newly spawned bots; the team picker loads the two saved selections before enabling Join. Gameplay team identity and weapon availability remain separate from the appearance’s Source2 skeleton.

The existing Ground Rebel and IDF are the startup defaults. Additional models load only when selected or restored; opening the selector downloads a small catalog, not the roster. The catalog retains all 141 native item IDs (63 cosmetics and 78 legacy/base entries), resolving to 79 selectable native models. Identical legacy aliases share one file and one selector option; generic base entries show their faction/variant. One additional installed, unreferenced Leet model is retained in the assets and excluded from the selector. Runtime templates retain leases while a preview or soldier uses them, and keep only two unused models cached. The service worker places optional agent assets in the 64 MiB cosmetic budget, separate from core startup/map assets. Switching agents retains the previous visible preview until the replacement finishes loading; failed requests leave a usable default.

Native third-person body/default-glove mesh groups are extracted from the installed CS2 build **26144732**, patch **1.41.9.2**, with Source2Viewer **20.1**. The installed game remains read-only. Names, teams and native paths come from `items_game.txt` and English localization. Source fingerprints, selected mesh groups, tool information and compressed output sizes live in `packages/assets/public/models/agents/roster/source.json`.

All 80 imported models total 203,858,364 bytes before transport gzip, roughly 2.55 MB each; default startup requests no additional roster model. The catalog is about 44 KB before gzip. Each model is self-contained: no first-person meshes, physics duplicates or embedded animation pack. Meshopt compression and BasisU ETC1S KTX2 textures capped at 1024 pixels reduce transfer and GPU texture memory. The asset pipeline adds deterministic gzip and content hashes; production uses pinned immutable R2 releases. Source exports remain in ignored `artifacts/agent-roster/`.

Regenerate from the Windows delivery using gltfpack **0.24** with BasisU support:

```sh
python3 scripts/import-agent-roster.py artifacts/agent-roster/windows \
  --gltfpack artifacts/agent-roster/tools/gltfpack
bun run assets:prepare
```

Skeleton locals and inverse binds are converted together from the exporter’s metre/Y-up convention into the existing calibrated Source-inch basis. The importer checks that bind skinning remains invariant for every joint, and verifies the complete delivered-file checksums before packing. Fifty head materials bake neutral irises from their native eye textures, masks and authored parameters; this is a fixed forward gaze, without native eye tracking or parallax.

All native Source2 models reuse the calibrated Ground Rebel animation family. This retains native skin bindings and bone names, but differences in proportions and secondary motion remain approximations. The older IDF continues to use its existing retarget. Selecting an agent changes the world body; first-person sleeves/gloves, voice packs and Source2-specific face/cloth shaders remain the existing implementations.

The exported ORM maps for 47 named materials contain no roughness data (their green channel is entirely zero). `src/data/agent-roughness.json` identifies only those audited materials. The roster loader removes their roughness-map binding and supplies an authored matte fallback: 0.85 for materials marked with native cloth shading, 0.65 otherwise. Valid roughness maps, AO and metalness are preserved. Regenerate that audit with `python3 scripts/audit-agent-roughness.py artifacts/agent-roster/windows/models > apps/game/src/data/agent-roughness.json` (Pillow required).

Homepage poses for imported agents move both hand contacts 12 cm forward with a two-bone arm correction, keeping wrist orientation, finger poses, actual weapon scale and idle motion. This adds clearance for bulky vests without moving the weapon independently of the hands; it remains an authored retarget of the reference clips.
