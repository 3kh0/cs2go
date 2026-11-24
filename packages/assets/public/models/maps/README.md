# Map visibility bakes

`<map>-visibility.json` holds a potentially visible set for each NAV area. The game uses it to skip static opaque map draws that cannot be seen from the camera's area (`apps/game/src/map-visibility.ts`). These files are generated, not imported from the game: they are original data rendered from the converted map assets in this folder.

## Regenerating

Rebake after changing a map's geometry, materials or NAV data, then refresh the manifest:

```sh
bun scripts/bake-visibility.mjs nuke   # one or more maps; no arguments bakes every map
bun run assets:prepare
```

The script starts the Vite dev server (or uses `BAKE_URL`), loads each map in Chromium and renders unit IDs into 1024² cube faces. It samples each area's corners, edge points every 2.5 m, an interior grid and the centre, at eye heights of 1.17, 1.63, 2.35 and 3.05 m. Each area's set is then merged with those of its linked neighbours. The script finishes by rendering random in-area views at 1280×720 and reports any pixels the culling would have removed. `apps/game/src/map-visibility.test.ts` fails when a bake no longer matches the map models recorded in `packages/assets/manifest.json`.

## Limitations

- The sets are sampled, not exact. Validation can still find a few one-pixel slivers seen through narrow gaps from positions between samples.
- Doors, breakables and transparent, alpha-tested or depth-less materials neither occlude nor get culled. Players, weapons and effects are never culled.
- No culling happens when the camera has no NAV area within reach below it, for example while falling from a height or on off-NAV props. A pending static sun shadow refresh also turns culling off for that frame.
- Players can turn culling off under Settings → Video → Occlusion culling. It is on by default.
- At load, the game disables culling for a map if any baked draw is missing or no longer opaque and static.
