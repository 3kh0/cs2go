# Dust II home atmosphere

Native CS2 assets, copyright Valve. Imported from patch 1.41.9.6, Source revision
11206718 (November 4, 2026). No generated replacement artwork is used.

- 14 vanity backdrop meshes preserve native map placement, UVs and vertex RGBA.
- Five `paper_05{a,b,c,d,f}` meshes share the native peeled-paper color, converted
  normal and ORM textures. Paper is double sided and alpha tested at 0.5.
- Six native smoke/cloud masks retain their exact red-channel values in grayscale
  PNGs. The shader uses the native mask scales, panning, tint and opacity settings.
- The ground-dust atlas is `wispy_steam_burst_b`: four second-sequence choices,
  26 frames each. Packed frame rectangles and crop offsets are retained. Its
  authored texture-blend curve selects this second color layer at weight one.

`native-source.json` records the original VPK/chunk offsets, CRC32, SHA-256,
material definitions and backdrop placement. `provenance.json` identifies the
official Source 2 Viewer CLI 20.1 executable/archive and verified export inputs.
The shader equations are adapted from ValveResourceFormat commit
`9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304`,
`Renderer/Shaders/csgo_effects.frag.slang` (MIT; see
`../../maps/licenses/ValveResourceFormat-MIT.txt`).

## Regeneration

The original converted input bundle and its `export-assets.py` /
`finalize-assets.py` source snapshots are retained outside runtime assets in
`artifacts/native-home-reference/atmosphere-full-export.zip`. Those scripts read
only the pinned installed VPK members, invoke official S2V CLI 20.1, preserve
sprite metadata, export full steam atlases, and restore Source XYZ inches.
They require the installed native game, the pinned CLI and Pillow. Original
native assets remain external inputs and are never edited.

Given that verified export directory, run from the repository root:

```sh
python3 packages/assets/import-home-atmosphere.py /path/to/verified-export
bun run assets:prepare
```

The importer converts `(X,Y,Z)` inches to `(X,Z,-Y)` metres once, removes GLB
material references so paper textures are downloaded/shared once, packs PNGs
losslessly, and emits the runtime binding/provenance files. Backdrops must not
be recentered, normalized, or placed a second time. No generated screenshots,
native VPKs, CLI binaries or temporary export outputs belong in a commit.

## Reconstruction boundary

The browser uses the native geometry, masks, material inputs, particle spawn
locations, lifetimes, capacity limits and force settings. Particle noise/wind
integration, ground bounce, cropped-frame crossfades and animation seed updates
are reconstructed, not the complete Source particle VM/animation graph. Dust
frames crossfade instead of native motion-vector interpolation. A bounded depth
prepass supplies soft intersections. The existing distance haze, chosen framing
and map color grading are retained for the gameplay-map backdrop; this is not
a replacement of the whole scene with the native vanity map/postprocess.
