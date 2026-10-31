# CS2 homepage

The homepage follows the installed CS2 Panorama layout from build **26144732**, depot **2347770**, manifest **67499503218971311**. Its center navigation is **Inventory · Loadout · Play · Store · News**, with native Home, Watch, Settings and Quit icons on the left. The navbar uses the native linemap texture, condensed type, separators and translucent backdrop. Conditional account-only Overwatch/VACNet controls are omitted.

The background is the actual static visual export of `maps/de_dust2_vanity.vpk`, rather than a gameplay-map flyover or a background photograph. The authored `cam_default` supplies the 30° vertical FOV, position and view direction; `vanity_character` supplies player position and yaw. VRF exports `(Source y,z,x)` in metres. The runtime rotates the scene Y +90° to align it with the agents' `(Source x,z,-y)` coordinates, without scaling the scene twice. The nameplate projects the animated pelvis into the viewport, following the native placement method.

The T player uses `t_main_menu_rifle02_idle`, and CT uses `ct_main_menu_rifle_idle_handrepo_m4`, sampled from native clips at 15 Hz and interpolated by Three.js. Secondary weapon tracks supply the initial rigid model pose, while the animated primary attachment follows the hands. T defaults to the AK-47; CT to the M4A4. The showcase uses the same saved skin, wear and seed as the equipped firearm. Both legacy and HD mesh bodies are baked and registered with the shared skin system; applying or clearing a finish updates the held gun immediately. The existing IDF mesh retains Source 1 proportions, so retargeting remains approximate. Clips loop at the final decoded key; native random idle transitions, pet/party previews and the complete executable UI graph are not reproduced.

One renderer/context and the existing 30 Hz menu clock render the scene. At most two agent previews are cached; inactive gameplay scene rendering is skipped on the homepage. Reduced motion holds the first idle sample and disables cursor parallax. Small cursor motion reconstructs the native .5° parallax setting. The bottom-right menu offers the native Dust II view, an authored close-up, showcase team and any faction-appropriate firearm. Weapon choices are saved separately for T and CT. The default AK/M4 showcases keep their native animated home idles; other firearms use their native static buy poses, including matching fingers and weapon attachments. Changing weapons disposes the previous preview geometry/materials and unregisters its skin binding, retaining at most one preview per side.

## Local navigation

- **Inventory** opens the local weapon-finish collection, including wear, pattern and knife selection.
- **Loadout** opens the existing persistent faction buy-slot editor.
- **Play** opens the match-selection panel; the green Play button selects a team and starts Casual or Competitive. The Home icon returns to the scene.
- **Store** and **News** are disabled for now. Each opens a native-style charcoal error popup with an OK action; Escape dismisses it and restores focus. Inventory remains the entry to weapon finishes.
- Watch explains that online broadcasts/replays are unavailable. Quit explains how to leave the browser game.

Left-column cards link to actual local features rather than presenting fabricated account missions, currencies, promotions or friends. Settings and the live match/pause flows remain available. Competitive team selection now labels its 5×5 roster correctly.

## Fonts

All menu and HUD text now uses native **Stratum2**, **Stratum2 Condensed**, **Stratum2 Mono** and **Stratum2 Monodigit** faces, replacing Barlow. Canvas radar labels and defuse-device text use the corresponding native numeric/mono faces. Original copyright and naming records are retained inside WOFF2. The faces come from `panorama/fonts/stratum2.uifont`; `packages/assets/public/fonts/cs2/source.json` records package, decoded-face and runtime hashes, weights/styles and attribution to Process Type Foundry and Valve. Fonts are bundled locally and fetched on demand by CSS.

## Import and provenance

The Windows Amp runner used **Fast mode** and Source2Viewer **20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304**, reading installed resources without changing them. The homepage reference archive retains native layouts/styles/scripts, English labels, all 15 vanity-scene camera inventories, selected DMX clips, extraction scripts and file hashes under ignored `artifacts/homepage/`. It does not query live account/backend state.

The chosen world export resolves 603 native resource dependencies with no missing references. The importer verifies exported file hashes, removes opaque replacements for native smoke/fog cards and tool geometry, and removes foliage vertex colors that encode wind rather than albedo. Textures are capped at 512px, with quality-90 WebP color textures and lossless normal/ORM maps. Meshopt compresses and batches static geometry. Native bloom, masked effects, lightmaps, shadowing, depth of field and Source 2 material composition remain approximated by authored Three.js lighting.

Regenerate from the retained verified Windows exports with Pillow, fontTools with WOFF2/Brotli support, and gltfpack 0.24:

```sh
python3 scripts/import-home-media.py artifacts/homepage/cs2-homepage-light-media
python3 scripts/import-home-world.py artifacts/homepage/world --gltfpack /path/to/gltfpack
bun scripts/import-buy-poses.mjs artifacts/homepage/idles --home
python3 scripts/import-cs2-fonts.py artifacts/native-asset-audit/ui-equipment
```

Runtime fingerprints are recorded under `packages/assets/public/ui/home/`, `packages/assets/public/models/home/`, `packages/assets/public/models/animations/home/` and `packages/assets/public/fonts/cs2/`. The shared pose importer still produces byte-identical buy-pose payloads without `--home`.

## Buy weapon shading

Rigid weapon conversion now discards the original packed normal buffer before rebuilding normals for its baked metre-space geometry. Accumulating small face contributions into normalized integer attributes rounded them to zero, producing black expanded-weapon surfaces. New floating-point normals retain those contributions. Source tangents are also discarded so the normal-map tangent basis derives from the newly posed geometry and UVs. Albedo textures and material colors are preserved.

Browser coverage checks homepage navigation, both animated factions, reduced motion, local asset loading, responsive layouts and the match-to-home transition. The material check renders each actual cached firearm preview in isolation under the buy lights and measures its visible surface, alongside representative screenshots.

## Display color and menu surfaces

Scenery uses a restrained display-space saturation (1.12) and contrast (1.04) grade after tone mapping, applied only to imported home/gameplay map materials. This preserves hue and leaves HUD text, agents and weapons out of the map grade. Home sky/bounce intensity was reduced from 1.8 to 1.15 and sun intensity from 3 to 2.6, retaining warm sunlight while improving separation between lit surfaces and shade. This is authored color tuning rather than a port of Valve's LUT or lighting pipeline.

Settings occupy the full content area beneath the persistent navbar. The native `mainmenu-content__container` contract supplies a black 75% backdrop and faint dot texture; settings references supply centered content, 48-pixel rows, right-aligned controls and 80-pixel numeric fields. The native shared popup contract supplies the 512-pixel charcoal error panel, 28-pixel gray title, 18-pixel message and right-aligned OK. Source hashes are retained in `docs/menu-surfaces-source.json`. No new source assets or online requests are required.

All showcase weapons retain torso/head motion from the native home idle clips. Non-default weapons layer these local rotations onto their own buy grip, retaining fingers and two-hand placement. Held gun transforms discard inherited skeleton scale after converting the grip to world metres; the legacy IDF scale no longer enlarges props by about 30%. The buy preview registers its carried gun with the same finish system as the first-person and home models.

Dust II now keeps its exported albedo unchanged until the single shared scenery grade. The previous extra albedo saturation and contrast pass is removed, avoiding compounded color grading between the gameplay map and vanity scene. Native lightmaps, probes and material-specific AO remain intact.
