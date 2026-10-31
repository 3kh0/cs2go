# Native asset audit

On October 30, 2026, the Windows Amp runner, in **Fast mode**, inspected installed CS2 build **26144732**, patch **1.41.9.2**, depot **2347770**, manifest **67499503218971311**. Source2Viewer **20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304** decoded the selected resources. [Audit fingerprints](native-assets-audit.json) retain source comparisons, exported UI/model fingerprints and local asset-integrity results. This checks selected resources, not the entire installation or Valve's executable renderer.

## Shipped changes

- [Buy poses](buy-poses.md): 81 native clips supply body, fingers and secondary weapon tracks, retargeted to the bundled agents. The first nonnegative sample is held while previewing. Molotov uses its actual secondary bottle/hand chain; all three knives retain their model grip frames.
- Buy icons: 50 native equipment SVGs under `packages/assets/public/icons/buy/`, including all 34 firearms, six grenades and equipment aliases. The card reserves separate name, image and price rows, retains each native viewBox, and contains the silhouette without stretching it. Existing kill-feed artwork remains separate.

Regenerate icons from the Windows decoded export with:

```sh
python3 scripts/import-buy-icons.py artifacts/buy-native-ui-icons
```

The importer verifies decoded SVG hashes, removes XML declarations, external DTDs and comments, rejects executable/external image content, and preserves native path geometry. `packages/assets/public/icons/buy/source.json` records input/output fingerprints. Native `m4a1.svg` means M4A4; M4A1-S uses `m4a1_silencer.svg`; incendiary uses `incgrenade.svg`.

## Additional models and UI references

The extraction retained **18 layouts and 10 styles** for buy, scoreboard, settings/widgets and modal panels, plus inspect/loadout/inventory references from the initial inventory. These are Panorama documents with custom panels, includes, constants and game-service dependencies; they require translation before use as browser UI. Their source/output hashes are retained in the audit. The subsequent [homepage port](homepage.md) also imports the native Stratum2 font families for the runtime.

The local equipment export includes `armor.glb`, `helmet.glb`, `defuser.glb` and their textures. Mesh/accessor structure and image dependency closure were checked; these extra models have not been visually validated or wired into gameplay. A recommended inventory identifies 48 native model candidates, including firearm world models, equipment, grenades and UI props. Six separate `maps/ui/*.vpk` scenes are indexed and hashed; the buy scene is `maps/ui/buy_menu.vpk`. These scene packages were not bulk exported.

Full decoded evidence is kept locally in ignored directories:

| Evidence                                                           | Local path                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Complete audit and native parameters                               | `artifacts/native-asset-audit/audit.json`                       |
| Particle graphs, textures, event tables, markers and audit scripts | `artifacts/native-asset-audit/sound-tracer/`                    |
| UI layouts/styles, model exports and inventory                     | `artifacts/native-asset-audit/ui-equipment/`                    |
| Sampled native poses and attachment evidence                       | `artifacts/buy-poses/windows/`, `artifacts/buy-poses/evidence/` |

Original game resources remain extraction inputs. Font decoding must run against a scratch copy: the tool's UIFont decoder can write beside its input despite `-o`. An initial decode created new outputs there; only those new outputs were moved to scratch, and the original directory contents were verified afterward. The later requested font import converts the verified native faces to local WOFF2, retaining their attribution and naming records; see [homepage fonts](homepage.md#fonts).

## Sound verification and remaining differences

**297/297 compiled-resource hash references match**, representing 288 distinct resources: 239 firearm clips, 43 effects, eight tracer graphs, two textures and five event-table references. Every Windows VPK read passed CRC validation. The weapon manifest names an older depot directory; its individual selected resources still match the installed build. Existing pinned provenance was retained.

All **282 selected weapon/effect waveforms** occur in their declared native events. The local runtime check also matched 239 firearm OGGs, 43 effect OGGs, 11 music OGGs, all 282 startup-bank slices, and both tracer PNGs against their manifests. No corrupt, missing or wrong-source waveform was found.

Native inspection followed 34 weapon graphs into 136 clips and 391 sound markers. Of 209 coverage slots, 39 have weapon-data bindings, 163 have exact animation markers and seven use another native event name with the same waveform:

| Action                       | Native marker difference                                    |
| ---------------------------- | ----------------------------------------------------------- |
| M4A1-S bolt back/forward     | `_Q` draw variants use gain .5 rather than 1                |
| M4A4 bolt back/forward       | `_Q` draw variants use gain .3 rather than .799805/.5       |
| MP5-SD slide forward         | `_Q` draw variant uses gain .5 rather than 1                |
| Sawed-Off generic bolt slots | `Pump_Q` uses gain .5/pitch 1 rather than gain 1/pitch 1.01 |

Those findings do not justify replacing the waveform files. Runtime audio still groups imported clip markers into generic action slots and applies authored gain/spatial processing; it does not reproduce every native event's gain, reverb, distance layers or graph selection. M4 native reloads use magazine/action markers rather than a generic bolt pair. The native Sawed-Off has one pump marker per inspected action; two generic coverage entries alone do not establish duplicate runtime playback. A faithful timing upgrade should retain full native marker names, per-clip phases and event metadata together.

The ELITE reload now preserves the namespace for its slide/L/R overrides. The packaged `weapon_galilar.clipin` markers at .4247787595/.7256637216 alias native `Weapon_ELITE.Clipin.Slide`: both use `sounds/weapons/magazine_slide_01.vsnd_c`, already imported as `galil_clipin`. Native `Weapon_ELITE.Lclipin` at .4424778819 and `Weapon_ELITE.Rclipin` at .7433628440 require distinct `elite_lclipin`/`elite_rclipin` imports from `sounds/weapons/elite/elite_leftclipin.vsnd_c` and `elite_rightclipin.vsnd_c`. Supplemental current-build fingerprints belong in `audio/cs2-elite-source.json`; the older weapon import remains unchanged. The misleading legacy filename `elite_leftclipin.ogg` actually contains ordinary `Weapon_ELITE.Clipin` (`elites_clipin_07`) and remains assigned only to that generic slot. These routes retain the authored browser action gain/spatial mix, not native per-event gain/pitch parity.

`bomb-beep → C4.PlantSound → c4_beep2` is a valid source assignment. The current defuse sound is the native completion sound, and the game plays it on completion. Native alternate/ten-second/light-flash events and explosion distance/debris layers exist; the browser bomb scheduler and spatial mix remain reconstructions. M4A1-S/USP suppressor states use distinct native events, while MP5-SD uses its integrated-suppressor event. Their no-tracer gate is consistent with native weapon data.

## Tracer verification and remaining differences

All eight bright-tracer graphs, two sniper-wisp children and the complete 27-resource external dependency closure were extracted. Three dependencies come from mounted `core/pak01`, so absence from `csgo/pak01` alone does not mean a resource is missing. Both decoded runtime spark texture hashes match. Native texture controls/blend modes live inside the particle graphs; these graphs do not reference a separate standalone material.

The current pooled, depth-tested trails retain inspected rifle/pistol/sniper/shotgun speeds and growth parameters. Normalized fade-in endpoints map the native pistol .2–.35 and shotgun .15–.25 values; rifle/sniper retain .2–.3. This checks endpoint mapping, not Source 2 interpolation parity. Damage stays hitscan. Browser coverage checks travel, resource bounds, local loading and suppression for player/bot shots. Every non-suppressed shot currently emits a trail. Native weapon data declares per-mode tracer frequency (for example AK-47 3, AWP 1); native cadence phase/reset and view overrides have not been observed, so no inferred every-third-shot scheduler is introduced. This is still an approximation of the native particle system:

- SMG uses a six-point rope, radius 2.5 with .75 renderer scale, sequence texture and sparse-noise distortion. Machine guns use a three-point rope, a radius spline and 1.25 renderer scale. Both currently share our assault-rifle trail.
- AUG and SG 553 both bind `weapon_tracers_assrifle_aug.vpcf`, with a separate two-point rope and noise profile; the current renderer uses the ordinary assault-rifle profile for both.
- Native secondary passes are bloom-only; copying them as another full visible pass would over-brighten the result.
- Rifle/SSG wisps use separate low-opacity rope/sprite children, gravity, drag and depth feathering. These wisps are not implemented.
- Source 2 noise composition, collection-age Hermite curves, view-control-point scaling and color grading are not reproduced by the current quad shader.

The extracted audit retains the full parameters and curve slopes for a later renderer change. Source equality and passing browser checks establish asset integrity and functioning integration; they do not establish a pixel-identical Source 2 effect.
