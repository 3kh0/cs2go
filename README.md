# CS2GO

A small, single-player Counter-Strike-inspired browser FPS built with TypeScript, Three.js, and Vite Plus. The current CS2 Dust II map, a local 10v10 casual lobby, practice/deathmatch, and four firearms plus the M9 Bayonet. Desktop mouse and keyboard required.

## Run

Use Bun 1.4.3 and Vite Plus 0.3.2. Bun installs dependencies from `bun.lock`; the package scripts use Vite Plus for development, builds, checks, and unit tests. `bunfig.toml` makes `bun run` execute local JavaScript tools with Bun. The global Vite Plus environment also has a managed Node.js pin for its CLI. `vp install` detects the pinned Bun package manager.

```sh
cd cs2go
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by Vite Plus, choose **CT · IDF** or **T · Ground Rebel | Elite Crew**, then click **LET’S PLAY** to capture your mouse. Escape releases the mouse and pauses the session.

```sh
bun run check
bun run test
bun run test:browser
bun run build
bun run preview
```

For the browser tests, install Chromium once with `bun run --bun playwright install chromium`.

`vercel.json` marks Vite's content-hashed `/assets/` files immutable. Three.js builds into its own chunk so it stays cached when only game code changes. Unhashed files under `public/` use Vercel's default revalidation.

Performance notes: collision and navigation use flat typed arrays and numeric grids. Bots stagger their 16 Hz thinking across simulation steps. Bot bodies animate once per rendered frame: off-screen bots update at 10 Hz and distant ones at 30 Hz. Bots are frustum-culled and share one skeleton per agent. Tracers and impact decals are pooled. Shaders are compiled before **LET’S PLAY** is enabled. Weapon and agent GLBs are meshopt-compressed with `scripts/compress-models.py` (native gltfpack 0.24; run it once after re-importing models).

## Play

Casual: 10 T versus 10 CT (you, nine teammates, and ten opponents) on Dust II. First to eight rounds, two-minute rounds, no respawns until the next round. T carries and plants the bomb by holding **E** at A/B for 3.2 seconds. CT holds **E** within two meters to defuse for ten seconds; moving or releasing E cancels. The bomb detonates after 40 seconds. Eliminating a team or running out of time resolves the round; a planted bomb keeps the round active after T elimination. After death, the camera follows a living teammate. Friendly fire is disabled, purchases are free in every mode, and economy/grenades are not modeled. Every new spawn starts with a USP-S and M9 Bayonet. Press B to buy an AK-47, M4A1-S, or AWP; buying replaces your one primary weapon and equips it.

Deathmatch: you against five navigating bots. First player to 20 eliminations wins, with a five-minute limit and automatic respawns. Practice: stationary targets, no timer, no return fire, and renewable reserve ammo.

| Control      | Action                                       |
| ------------ | -------------------------------------------- |
| WASD / mouse | Move / look                                  |
| Left click   | Shoot / knife slash; hold for automatic fire |
| Space        | Jump (hold with Auto bunnyhop enabled)       |
| Ctrl or C    | Crouch                                       |
| Shift        | Walk quietly                                 |
| F            | Inspect weapon (knife also during draw)      |
| R            | Reload                                       |
| E            | Hold to plant / defuse in casual             |
| 1 / 2 / 3    | Primary / USP-S / M9 Bayonet                 |
| Mouse wheel  | Cycle owned weapons, wrapping at either end  |
| Right click  | AWP scope levels / knife stab                |
| B            | Free buy menu                                |
| M (hold)     | Enlarge Dust II callout radar                |
| Tab          | Scoreboard                                   |
| Escape       | Pause                                        |

Movement uses a fixed 128 Hz simulation with Source-style directional acceleration and friction. Counter-strafing stops you faster than simply releasing a key. Settings → **Auto bunnyhop** (off by default, saved locally) repeats a jump on the first simulation tick after landing while Space is held. Manual mode requires a fresh press; a press consumed in mid-air is not buffered until landing. Jumping happens before ground friction, preserving momentum on a clean hop. Both modes keep the standard 110% weapon-speed takeoff cap and normal air acceleration; the switch does not enable unlimited-speed bunnyhopping. On Dust II, height changes resolve side contacts at ledges and ramps before horizontal movement, and releasing crouch waits for enough clearance to stand. Movement and jumping increase weapon spread; crouching reduces it. Rifles have repeatable vertical and horizontal recoil. Hitscan uses range attenuation, head/stomach/leg damage multipliers, and up to four penetrations. Bullets can hit aligned enemies once each, with damage lost through each body. Thin wood and metal can be penetrated; thick cover stops the bullet. Bots are unarmored. Weapon magazines persist when switching owned weapons; repeat purchases of your current primary preserve its ammunition. Respawning and starting a new round reset your inventory to the pistol and knife. The HUD shows owned weapon silhouettes, slot keys and the active weapon. Knife attacks use a short, non-penetrating trace: slashes deal 35 damage within 1.9 meters, and slower stabs deal 65 damage within 1.7 meters. Melee damage/range values are authored approximations; the supplied native knife clips are retimed to the existing attack windows.

Movement tuning follows Valve's [Source SDK movement formulas and jump/friction ordering](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp), using CS2's [shipped console defaults](https://github.com/SteamDatabase/GameTracking-CS2/blob/5278de99318192d682ec7f0e1cc3ea9449f10c6e/DumpSource2/convars.txt): ground acceleration 5.5, air acceleration 12, air wish-speed cap 30 units/s, friction 5.2, stop speed 80 units/s, gravity 800 units/s², and jump impulse 301.99338 units/s. One Source unit is 0.0254 meters. Split gravity integration yields a roughly 57-unit jump apex and 0.755-second flight on level ground. The air cap applies to velocity projected along the input direction; turning with a strafe key can gain speed, while simply holding forward cannot accelerate indefinitely. Weapon running speeds use the same [December 2021 Valve item-data snapshot](https://github.com/SteamTracking/GameTracking-CS2/blob/b9665d5f32a9ca1b80b6583cdc98ad82ce3c3a6a/csgo/scripts/items/items_game.txt) as the ballistic attributes: AK 215, M4A1-S 225, USP-S 240, AWP 200 (100 scoped), and knife 250 units/s. Walk/crouch target 52%/34% of running speed. This is a measured reconstruction, not an exact Source 2 simulation: server subtick input, stamina/duck-fatigue penalties, surf/ladder/water physics, per-surface friction and full Valve swept-hull collision are not reproduced.

Bots use textured, skinned Valve agent meshes: **Ground Rebel | Elite Crew** for T and the classic **IDF** for CT. The lobby side selector changes your faction. Both sides use the supplied Phoenix first-person hands. Casual includes both factions, with ten players per side; practice and deathmatch have five enemies. Native rifle idle, forward/backward walk, and left/right strafe clips blend by velocity. Ground Rebel uses original Source 2 clips; IDF movement is retargeted onto the community port's Source 1 skeleton. Bot acceleration, turning, distance-driven gait and recoil update at 128 Hz; navigation/targeting update at 16 Hz. Pause freezes animation as well as movement, and respawning resets the skeletal pose. Bots spawn holding a USP-S; combat bots choose their faction rifle after a short delay, while practice targets keep the pistol. Carried weapon models follow the hands. Headshots track the head bone, decorative overlap still damages each bot only once, and carried guns cannot block hits. Deaths use a lightweight spring collapse with loose limbs, landing rebound, ground contact and sleeping bodies; this approximates a ragdoll rather than reproducing Valve rigid-body physics. Breathing remains authored. Casual spectating uses a wall-aware chase camera, hiding the followed body for close-wall views. Player movement remains the existing Counter-Strike-inspired simulation.

The AWP has a ten-round magazine, high body damage, a 1.45-second bolt cycle, and a 3.4-second reload. Right click cycles between 40° and 10° camera fields of view and the normal view. Scoped mouse sensitivity scales with magnification. The circular scope masks peripheral vision, displays thin crosshairs, and hides the weapon. Moving and jumping reduce accuracy, and firing briefly unscopes while cycling the original model’s bolt before restoring the previous zoom. Switching weapons, reloading, pausing, and respawning clear the scope.

Dust II static architecture is batched by material, with out-of-view distant Source geometry removed, with simplified detailed props and a cached sun shadow map. Graphics settings offer a lower-resolution mode without shadows. Map and agent textures, models, weapon audio, and fonts are bundled; gameplay requires no external requests. Practice and deathmatch retain the original Dust Yard range. This is a local bot game with approximated Source physics and shaders.

## References and assets

- [Counter-Strike gameplay guide](https://valvearchive.com/archive/Counter-Strike/Counter-Strike/Guides/GameSpot/hl_cs_gg.pdf): movement affects accuracy and continuous fire increases spread.
- [Vite Plus](https://viteplus.dev/guide/): the `vp` development, build, formatting, linting, and testing toolchain.
- [Three.js](https://threejs.org/docs/): WebGL rendering, instancing, and raycasting.
- Barlow and Barlow Condensed by Jeremy Tribby, distributed under the [SIL Open Font License](public/fonts/OFL.txt).

First-person AK-47, M4A1-S, USP-S and AWP rendering uses the public [CSGOSKINS.GG](https://csgoskins.gg/) viewer's native skinned models and five clips per firearm: idle, draw, reload, shoot and inspect. The original hand, finger, magazine, slide and bolt tracks drive the supplied Phoenix arms and matching weapon bones. Both animation skeletons are sampled together, preserving mechanical contacts. A separate 60° vertical viewmodel lens keeps proportions stable when world FOV changes. **F** inspects any weapon; firing, reloading, switching or scoping cancels inspection. Short transitions use the fixed simulation clock, so pausing freezes the pose without accumulating interpolation drift.

Weapon animation playback is 90% of the previous rate: draws take about 0.61 seconds, and reloads, inspections, knife swings, and the AWP bolt cycle take about 11% longer. Ammo transfer, melee contact, action sounds, bolt lockout and automatic rescope follow the same slowed phases. Automatic rifle/pistol fire rates stay unchanged. Available magazine/action sounds use the native clips' normalized event markers. Source-specific cloth and magazine-tap events are not reproduced. The original substrate color, AO, roughness/metalness and decoded normal textures are bundled in each GLB. These are base substrate finishes, not a reproduction of every default painted finish (the AWP stock remains gray). Three.js materials approximate Source lighting. Source URLs and SHA-256 hashes are in `public/models/viewmodels/source.json`. The [inspect.skin AK-47 GLB](https://cdn.inspect.skin/v3/3d/weapon_rif_ak47.glb) was also inspected; it provides idle/inspection geometry but no embedded materials or draw/reload clips, so the complete matching CSGOSKINS.GG set is used here.

The original converted static OBJs remain the carried world guns, with their custom tactical finishes. Regenerate the two sets separately:

```sh
python3 scripts/convert-weapons.py /path/to/csgo_skin_templates
python3 scripts/import-csgoskins.py
```

The knife inventory slot retains the M9 Bayonet name, but now uses the user-supplied UV-mapped `mesh.glb` and Bayonet clips instead of the earlier STL and reconstructed motion. The new mesh contains 2,202 triangles; the self-contained runtime GLB is about 954 KB. Its original color, worn-steel detail, olive grip and ambient occlusion are preserved. The source roughness/metalness channels are repacked into glTF ORM, and a local generated reflection environment lights the steel. The original source files remain intact. `public/models/m9-bayonet.source.json` records hashes and conversion details; the HUD silhouette is projected from the same mesh.

Eight supplied clips drive the knife: `draw`, `idle1`, `idle2`, alternating `light_miss1` / `light_miss2`, `heavy_miss1`, `lookat01` and `lookat01_draw`. Native arm, wrist and finger tracks are transferred onto the matching hand bones; the independent weapon-offset track preserves the blade's finger roll and catch. The supplied KaWiSo “CS:GO Knife Animations: Bayonet” video remains the visual reference. The draw is retimed to the existing 0.55-second equip window, slashes to 0.5 seconds and stabs to 0.85 seconds; original gameplay hit/cooldown timings remain unchanged. **F** plays the inspection, including the draw variant when pressed immediately after switching. Attacking or switching cancels inspection; pause freezes it. These are supplied Bayonet clips, not an M9-specific draw. Source shaders remain approximations.

The supplied `mesh (1).glb` provides the Phoenix first-person gloves, bare arms and rolled sleeves for every weapon on both teams. Its original UVs, skin weights and skeleton are preserved. Glove/sleeve AO, color, metal masks and normals, plus arm color/normals, are embedded locally in `public/models/agents/view-hands.glb` (about 6.7 MB). Source 2 hemi-octahedral normals are decoded to tangent-space XYZ using the [ValveResourceFormat decoder](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/master/ValveResourceFormat/TextureDecoders/Common.cs); their blue channel supplies roughness. Input hashes and conversion details are in `view-hands.source.json` and `animations/bayonet/source.json`.

Regenerate with Python, Pillow and NumPy:

```sh
python3 scripts/import-bayonet.py /path/to/mesh.glb /path/to/csgoskins.webp /path/to/rough-metal.png /path/to/knife-ao.png
python3 scripts/import-knife-animations.py /path/to/clip-directory
python3 scripts/import-view-hands.py '/path/to/mesh (1).glb' /path/to/textures.json
```

The texture config is a JSON object with `glove`, `arm`, and `sleeve` entries. Each has `color` and `normal` file paths; `glove` and `sleeve` also have `ao` and `metal` paths. The clip directory contains the eight original `*_bayonet.glb` files. These import tools are offline only; all game assets load locally.

The user-supplied `weapons` sound pack provides 23 selected shot, magazine, bolt, draw, and scope clips. They are converted to mono Opus (about 211 KB total), preloaded and decoded before Play, and mixed through Web Audio. Bot rifle shots use a distant recording with stereo direction and distance attenuation. Reload clips follow the simulation so switching weapons or pausing interrupts the sequence. Regenerate with `python3 scripts/convert-audio.py /path/to/weapons` (requires FFmpeg).

The user-supplied **CS2 Sounds for Source** pack now supplies the four firearm shots, knife swings/contacts, hit/headshot/damage, purchase and bomb cues: 19 mono 48 kHz Opus clips, about 293 KB total. Original Downloads files remain intact. This is a community conversion supplied as CS2 audio; the pack has not been independently matched against Valve’s depot. `public/audio/cs2-source.json` records source hashes and processing. Regenerate with `python3 scripts/import-cs2-audio.py "/path/to/CS2 SOUNDS FOR SOURCE/sound"` (FFmpeg), after the older importers below if regenerating everything. The source manifest identifies which older clips were replaced.

A further 30 clips from [sourcesounds/csgo](https://github.com/sourcesounds/csgo) are bundled in `public/audio/source` (about 2.79 MB): Valve’s original menu, round-start, deathcam, victory, defeat, MVP and final-ten-second music; sand/concrete footstep variants; jump, landing, damage, death, equipment, and UI cues. Music streams locally rather than decoding full tracks during startup. Menu music begins after the first user gesture, stops when deploying, and returns when leaving a match. Win music leads into the MVP anthem. Music pauses when the tab is hidden. Settings exposes persistent master, music, and effects sliders; the gain buses update existing voices immediately. Regenerate with `python3 scripts/import-source-audio.py` (requires FFmpeg). The manifest pins the source commit and records each imported file.

The kill feed follows the supplied screenshot and [Killfeed Generator](https://bindgenerator.app/killfeed-generator/): local weapon silhouettes and headshot, no-scope, and penetration icons; blue/yellow team names; a red border for local involvement; slide/fade entry and exit; six-entry limit and 6.5-second lifetime. Icon provenance is the generator’s CSS image references, copied locally to `public/icons`. No smoke/blindness icons are shown because those mechanics are absent.

Weapon ballistic attributes are from [archived CS:GO items_game data](https://github.com/SteamTracking/GameTracking-CS2/blob/b9665d5f32a9ca1b80b6583cdc98ad82ce3c3a6a/csgo/scripts/items/items_game.txt). AWP damage/power/range/modifier are 115/2.5/8192/0.99; AK-47 36/2/8192/0.98; M4A1-S 38/2/8192/0.99; USP-S 35/1/4096/0.91. Distances convert meters to Source units (one inch). Damage loss follows the modern CS:GO penetration formula (16% impact loss, weapon power term, squared thickness term, and four-barrier budget), with a 90-unit exit limit and 3,000-unit penetration distance. Dust Yard uses simplified solid boxes; Dust II uses triangle surfaces. Body thickness and surface penetration approximate Valve’s hitboxes and physics materials. Historical weapon versions vary; this implementation uses the December 2021 weapon attributes while retaining the requested ten-round AWP.

Agent meshes and textures are Valve assets. Ground Rebel (`tm_leet_variantg`) comes from the public [CS.MONEY 3D viewer](https://3d.cs.money/) resource mirror (game version 25000182); this is the Source 2 version of the requested agent. IDF comes from [CSGO IDF Playermodels](https://steamcommunity.com/sharedfiles/filedetails/?id=600219026), ported by TALENT | d, via its [DLCfun archive mirror](https://dlcfun.com/en/garrys-mod/csgo-idf-playermodels-mod). The bundled variant wears the classic olive uniform and camouflage helmet cover. Source URLs, content hashes, tool versions and animation limitations are recorded in `public/models/agents/source-manifest.json`. The agent GLBs use local WebP textures. Skeletons are cloned per bot; mesh/material templates remain shared. The materials approximate Source shaders; IDF retargeting is an approximation. The supplied `mesh (2).glb` and Ground Rebel textures now supply the T agent's mesh, with original weights and UVs. `ground-rebel-native.glb` contains its five materials and six existing local idle/run/walk clips baked onto the matching bones at 30 Hz. The import preserves the Source rig's inch scale while transferring world-space motion; the earlier `ground-rebel.glb` remains the reproducible motion source. Texture hashes and retargeting details are in `ground-rebel-native.source.json`. Regenerate with `python3 scripts/import-ground-rebel.py '/path/to/mesh (2).glb' /path/to/texture-overrides.json`, where the JSON maps the source GLB's image names to local texture paths (requires Pillow, NumPy and Bun).

The agent importer also retains legacy arm extracts. First-person rendering now uses the separately supplied Phoenix hands described above; world agents retain their faction-specific meshes.

To regenerate agent assets, install Python 3.11+ with Pillow, Blender 4.5, and the [Source 2 Viewer 20.0 CLI](https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.0), then run:

```sh
python3 scripts/import-agents.py --cli /path/to/Source2Viewer-CLI --blender /path/to/blender
```

The importer also exports Ground Rebel view arms and extracts IDF arm surfaces. It checks pinned source hashes, downloads its pinned [SourceIO](https://github.com/REDxEYE/SourceIO) converter, extracts the IDF archive, exports Ground Rebel and six rifle clips, bakes retargeted IDF tracks with Blender, and packs both GLBs. Downloads and intermediate files stay in ignored `artifacts/agent-import/`; these tools are only needed to regenerate the assets. No runtime dependencies were added.

Dust II now comes from Valve's CS2 Steam depot: app 730, depot 2347770, manifest `4758919807587010422` (October 8, 2026), downloaded anonymously with [DepotDownloader 3.4.0](https://github.com/SteamRE/DepotDownloader). The old user-provided `new_map/csgo` inputs remain untouched. The importer resolves shared VPK dependencies and checks extracted resource CRCs. Source hashes, tool versions, runtime sizes and limitations are in `public/models/maps/source-manifest.json`.

The web workflow reduces 4.55 million render triangles to 1.92 million by simplifying detailed props, removing tools/distant geometry and batching by material. Architecture stays intact. Rendering uses meshopt compression, 16-bit positions/UVs and 512–1024px ETC1S KTX2 textures. The map is about 36.3 MB gzipped, compared with 41 MB for the previous CS:GO map; the browser uses `DecompressionStream`, a local meshopt decoder and the bundled Basis transcoder. Native material metalness constants and cutout opacity are restored after export. Standard PBR approximates Source 2 layered shaders; baked lightmaps, probe lighting and foliage wind are not reproduced.

Movement and bullet traces use a separate, unsimplified native world-physics mesh (about 433,000 triangles and 724 KB gzipped), including prop hulls. Player-clip and pass-bullet groups affect movement only. Bots use the native NAV v36 graph's 2,242 convex polygons, including triangular slopes, directed connections and edge portals. They route between both bombsites, refine blocked doorways with collision-aware detours, follow floor heights, avoid teammates, retrieve bombs, plant, defend and defuse. Native cover annotations, dynamic physics and Valve's full swept player hull are not reproduced; bot AI remains an authored reconstruction.

Regenerate with Python/Pillow/numpy, Bun, .NET 10, [Source 2 Viewer CLI 20.0](https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.0), DepotDownloader 3.4.0 and native [gltfpack 0.24](https://github.com/zeux/meshoptimizer/releases/tag/v0.24):

```sh
python3 scripts/import-cs2-dust2.py --depotdownloader /path/to/DepotDownloader --cli /path/to/Source2Viewer-CLI --dotnet /path/to/dotnet --gltfpack /path/to/gltfpack
```

Downloads and intermediates stay in ignored `artifacts/cs2-dust-import/`. Add `--rebuild` after changing conversion scripts; cached Steam downloads are reused. The NAV helper pins ValveResourceFormat 20.0.6980. Preparation freezes Source coordinates, simplifies props, batches materials, preserves native physics independently, compresses textures/geometry and writes provenance. Source assets are Valve's; Dust Yard geometry and procedural textures are original. Playwright browser checks use local Chromium.

The Dust II radar uses the user-supplied `2026_10_11_0zj_Kleki.png` callout diagram, bundled unchanged as `public/maps/dust2-callouts.png`. Its original artist/source was not supplied; provenance and calibration are recorded in `public/maps/source-manifest.json`. Hold **M** during a Dust II match to enlarge it; release M or pause to close it. Player, teammate, spotted-enemy and bomb markers share one calibrated north-up projection. The diagram is illustrative: small layout differences from the CS2 map remain, and marker alignment is approximate at those details. Dust Yard retains its procedural radar.
