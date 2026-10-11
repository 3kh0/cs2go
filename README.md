# CS2GO

A small, single-player Counter-Strike-inspired browser FPS built with TypeScript, Three.js, and Vite Plus. The final CS:GO Dust II map, a local 10v10 casual lobby, practice/deathmatch, and four firearms plus the M9 Bayonet. Desktop mouse and keyboard required.

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

## Play

Casual: 10 T versus 10 CT (you, nine teammates, and ten opponents) on Dust II. First to eight rounds, two-minute rounds, no respawns until the next round. T carries and plants the bomb by holding **E** at A/B for 3.2 seconds. CT holds **E** within two meters to defuse for ten seconds; moving or releasing E cancels. The bomb detonates after 40 seconds. Eliminating a team or running out of time resolves the round; a planted bomb keeps the round active after T elimination. After death, the camera follows a living teammate. Friendly fire is disabled, purchases are free in every mode, and economy/grenades are not modeled. Every new spawn starts with a USP-S and M9 Bayonet. Press B to buy an AK-47, M4A1-S, or AWP; buying replaces your one primary weapon and equips it.

Deathmatch: you against five navigating bots. First player to 20 eliminations wins, with a five-minute limit and automatic respawns. Practice: stationary targets, no timer, no return fire, and renewable reserve ammo.

| Control      | Action                                       |
| ------------ | -------------------------------------------- |
| WASD / mouse | Move / look                                  |
| Left click   | Shoot / knife slash; hold for automatic fire |
| Space        | Jump                                         |
| Ctrl or C    | Crouch                                       |
| Shift        | Walk quietly                                 |
| R            | Reload                                       |
| E            | Hold to plant / defuse in casual             |
| 1 / 2 / 3    | Primary / USP-S / M9 Bayonet                 |
| Mouse wheel  | Cycle owned weapons, wrapping at either end  |
| Right click  | AWP scope levels / knife stab                |
| B            | Free buy menu                                |
| Tab          | Scoreboard                                   |
| Escape       | Pause                                        |

Movement uses a fixed 128 Hz simulation, ground friction, directional acceleration, and limited air acceleration. Counter-strafing stops you faster than simply releasing a key. Movement and jumping increase weapon spread; crouching reduces it. Rifles have repeatable vertical and horizontal recoil. Hitscan uses range attenuation, head/stomach/leg damage multipliers, and up to four penetrations. Bullets can hit aligned enemies once each, with damage lost through each body. Thin wood and metal can be penetrated; thick cover stops the bullet. Bots are unarmored. Weapon magazines persist when switching owned weapons; repeat purchases of your current primary preserve its ammunition. Respawning and starting a new round reset your inventory to the pistol and knife. The HUD shows owned weapon silhouettes, slot keys and the active weapon. Knife attacks use a short, non-penetrating trace: slashes deal 35 damage within 1.9 meters, and slower stabs deal 65 damage within 1.7 meters. Melee values and animation are authored approximations.

Bots use textured, skinned Valve agent meshes: **Ground Rebel | Elite Crew** for T and the classic **IDF** for CT. The lobby side selector changes your faction and your textured skinned first-person arms. Casual includes both factions, with ten players per side; practice and deathmatch have five enemies. Native rifle idle, forward/backward walk, and left/right strafe clips blend by velocity. Ground Rebel uses original Source 2 clips; IDF movement is retargeted onto the community port's Source 1 skeleton. Bot acceleration, turning, distance-driven gait and recoil update at 128 Hz; navigation/targeting update at 16 Hz. Pause freezes animation as well as movement, and respawning resets the skeletal pose. Bots spawn holding a USP-S; combat bots choose their faction rifle after a short delay, while practice targets keep the pistol. Carried weapon models follow the hands. Headshots track the head bone, decorative overlap still damages each bot only once, and carried guns cannot block hits. Deaths use a lightweight spring collapse with loose limbs, landing rebound, ground contact and sleeping bodies; this approximates a ragdoll rather than reproducing Valve rigid-body physics. Breathing remains authored. Casual spectating uses a wall-aware chase camera, hiding the followed body for close-wall views. Player movement remains the existing Counter-Strike-inspired simulation.

The AWP has a ten-round magazine, high body damage, a 1.45-second bolt cycle, and a 3.4-second reload. Right click cycles between 40° and 10° camera fields of view and the normal view. Scoped mouse sensitivity scales with magnification. The circular scope masks peripheral vision, displays thin crosshairs, and hides the weapon. Moving and jumping reduce accuracy, and firing briefly unscopes while cycling the original model’s bolt before restoring the previous zoom. Switching weapons, reloading, pausing, and respawning clear the scope.

Dust II static architecture is batched by material, with out-of-view distant Source geometry removed, with simplified detailed props and a cached sun shadow map. Graphics settings offer a lower-resolution mode without shadows. Map and agent textures, models, weapon audio, and fonts are bundled; gameplay requires no external requests. Practice and deathmatch retain the original Dust Yard range. This is a local bot game with approximated Source physics and shaders.

## References and assets

- [Counter-Strike gameplay guide](https://valvearchive.com/archive/Counter-Strike/Counter-Strike/Guides/GameSpot/hl_cs_gg.pdf): movement affects accuracy and continuous fire increases spread.
- [Vite Plus](https://viteplus.dev/guide/): the `vp` development, build, formatting, linting, and testing toolchain.
- [Three.js](https://threejs.org/docs/): WebGL rendering, instancing, and raycasting.
- Barlow and Barlow Condensed by Jeremy Tribby, distributed under the [SIL Open Font License](public/fonts/OFL.txt).

The weapon meshes come from the user-supplied `csgo_skin_templates/OBJs` pack (2013 exports). `public/models` contains converted AK-47, M4A1-S, USP-S, and AWP meshes with custom tactical finishes. The original OBJ geometry, normals, and UV coordinates are preserved; the TGA UV sheets are layout guides, not weapon skins. The converter extracts complete magazine, slide, charging-handle, and AWP bolt components. The AWP action rotates about the bore axis with a coaxial shaft that stays inside the receiver, then withdraws 7 cm and returns before locking. First-person arms follow wrist targets; reload tracks remove, swap, and insert magazines before operating the action. Draw tracks raise the weapon from below. Switching or respawning resets all poses. These are authored reconstructions: the supplied static OBJs do not include Valve’s original skeletons or animation clips, so the animations are not exact 1:1 copies.

To regenerate these assets:

```sh
python3 scripts/convert-weapons.py /path/to/csgo_skin_templates
```

The M9 Bayonet comes from the user-supplied `M9 Bayonet - 6750747/files/M9_B.STL`. The original file remains intact. `public/models/m9-bayonet.glb` contains an optimized 10,994-triangle mesh (about 227 KB) with authored steel blade/guard and dark grip materials. STL supplies no UVs, textures or animation; its 31 cm runtime length, hand grip and slash/stab tracks are reconstructed. `public/models/m9-bayonet.source.json` records the input hash and conversion details. The matching HUD/kill-feed silhouette is projected from the same mesh. Regenerate with:

```sh
blender --background --python scripts/convert-knife.py -- /path/to/M9_B.STL
python3 scripts/knife-icon.py /path/to/M9_B.STL
```

The conversion uses Blender 4.5; silhouette generation uses Pillow. These are offline import tools, not runtime dependencies.

The user-supplied `weapons` sound pack provides 23 selected shot, magazine, bolt, draw, and scope clips. They are converted to mono Opus (about 211 KB total), preloaded and decoded before Play, and mixed through Web Audio. Bot rifle shots use a distant recording with stereo direction and distance attenuation. Reload clips follow the simulation so switching weapons or pausing interrupts the sequence. Regenerate with `python3 scripts/convert-audio.py /path/to/weapons` (requires FFmpeg).

A further 30 clips from [sourcesounds/csgo](https://github.com/sourcesounds/csgo) are bundled in `public/audio/source` (about 2.79 MB): Valve’s original menu, round-start, deathcam, victory, defeat, MVP and final-ten-second music; sand/concrete footstep variants; jump, landing, damage, death, equipment, and UI cues. Music streams locally rather than decoding full tracks during startup. Menu music begins after the first user gesture, stops when deploying, and returns when leaving a match. Win music leads into the MVP anthem. Music pauses when the tab is hidden. Settings exposes persistent master, music, and effects sliders; the gain buses update existing voices immediately. Regenerate with `python3 scripts/import-source-audio.py` (requires FFmpeg). The manifest pins the source commit and records each imported file.

The kill feed follows the supplied screenshot and [Killfeed Generator](https://bindgenerator.app/killfeed-generator/): local weapon silhouettes and headshot, no-scope, and penetration icons; blue/yellow team names; a red border for local involvement; slide/fade entry and exit; six-entry limit and 6.5-second lifetime. Icon provenance is the generator’s CSS image references, copied locally to `public/icons`. No smoke/blindness icons are shown because those mechanics are absent.

Weapon ballistic attributes are from [archived CS:GO items_game data](https://github.com/SteamTracking/GameTracking-CS2/blob/b9665d5f32a9ca1b80b6583cdc98ad82ce3c3a6a/csgo/scripts/items/items_game.txt). AWP damage/power/range/modifier are 115/2.5/8192/0.99; AK-47 36/2/8192/0.98; M4A1-S 38/2/8192/0.99; USP-S 35/1/4096/0.91. Distances convert meters to Source units (one inch). Damage loss follows the modern CS:GO penetration formula (16% impact loss, weapon power term, squared thickness term, and four-barrier budget), with a 90-unit exit limit and 3,000-unit penetration distance. Dust Yard uses simplified solid boxes; Dust II uses triangle surfaces. Body thickness and surface penetration approximate Valve’s hitboxes and physics materials. Historical weapon versions vary; this implementation uses the December 2021 weapon attributes while retaining the requested ten-round AWP.

Agent meshes and textures are Valve assets. Ground Rebel (`tm_leet_variantg`) comes from the public [CS.MONEY 3D viewer](https://3d.cs.money/) resource mirror (game version 25000182); this is the Source 2 version of the requested agent. IDF comes from [CSGO IDF Playermodels](https://steamcommunity.com/sharedfiles/filedetails/?id=600219026), ported by TALENT | d, via its [DLCfun archive mirror](https://dlcfun.com/en/garrys-mod/csgo-idf-playermodels-mod). The bundled variant wears the classic olive uniform and camouflage helmet cover. Source URLs, content hashes, tool versions and animation limitations are recorded in `public/models/agents/source-manifest.json`. The two self-contained GLBs total about 6.4 MB and use local WebP textures. Skeletons are cloned per bot; mesh/material templates remain shared. The materials approximate Source shaders; IDF retargeting and authored viewmodel IK are not exact Valve animation reproduction. Ground Rebel uses the native skinned first-person arms and fingerless gloves; IDF arms are extracted from its original weighted uniform/hand geometry. Original textured meshes replace the procedural capsule/sphere arms. Both follow the existing magazine/action tracks through two-bone IK.

To regenerate agent assets, install Python 3.11+ with Pillow, Blender 4.5, and the [Source 2 Viewer 20.0 CLI](https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.0), then run:

```sh
python3 scripts/import-agents.py --cli /path/to/Source2Viewer-CLI --blender /path/to/blender
```

The importer also exports Ground Rebel view arms and extracts IDF arm surfaces. It checks pinned source hashes, downloads its pinned [SourceIO](https://github.com/REDxEYE/SourceIO) converter, extracts the IDF archive, exports Ground Rebel and six rifle clips, bakes retargeted IDF tracks with Blender, and packs both GLBs. Downloads and intermediate files stay in ignored `artifacts/agent-import/`; these tools are only needed to regenerate the assets. No runtime dependencies were added.

Dust II comes from the user-provided `new_map/csgo` depot extraction: the final October 2023 CS:GO build, with the post-2017 rework, BSP revision 10535. Original files remain untouched. The source manifest records Steam app 740, depot 731, manifest 1224088799001669801, and BSP/NAV hashes. The importer preserves geometry, texture UVs, ramps, tunnels, doors, and local prop/material dependencies. Standard PBR approximates Source shaders without baked Source lightmaps; detailed props use 30 percent of their original triangles. The self-contained runtime map is about 58 MB: geometry uses meshopt compression with 16-bit positions and texture coordinates, decoded by the meshopt decoder bundled with Three.js. Runtime provenance and limitations are in `public/models/maps/source-manifest.json`.

Bots use A* over the map's original 1,118-area NAV graph, preserving elevation and directed connections. Safe connected corridors are smoothed into continuous routes, and a spatial index of native walkable surfaces provides smooth bot ground heights and hull-safe region transitions, with triangle collision as a fallback through navigation gaps. This avoids testing every bot against the dense decorative mesh on every simulation step. They choose staging routes and both bombsites, refine blocked doorways with bounded collision-aware detours, reroute failed connections, ignore orphaned spawn areas, follow ramp heights, jump raised ledges, avoid nearby teammates, react to visible enemies, remember last sightings, avoid firing through teammates, retrieve dropped bombs, plant, defend, and defuse. The browser collision controller uses map triangles and approximates Source's player hull. Visibility and hitscan use exact grid traversal; sight checks stop at the first obstruction. The AI is an authored reconstruction, not Valve's bot code.

Regenerate the map using the pinned SourceIO downloaded by the agent importer, Python with Pillow/numpy, Blender 4.5, and Bun:

```sh
python3 scripts/import-dust2.py --blender /path/to/blender --sourceio artifacts/agent-import/SourceIO
```

Conversion intermediates remain in ignored `artifacts/dust-import/`; regeneration reads `new_map/` by default (`--source` selects another extracted folder). `convert-dust2.py` imports/simplifies the scene, `pack-agents.py` embeds WebP textures, `batch-dust2.py` batches materials, pinned `gltfpack` compresses the geometry, and `extract-dust-nav.py` exports the original graph/spawns/sites. Dust Yard geometry, its procedural textures, and synthesized hit feedback are original. Playwright browser checks use local Chromium.

The Tab scoreboard groups Counter-Terrorists and Terrorists, highlights you, marks alive/dead players and the bomb carrier, and shows kills, deaths, team scores and alive counts. Casual match progress records each round winner and its outcome (first to eight); deathmatch shows your progress toward twenty kills. Unsupported economy, assists and damage statistics are omitted.
