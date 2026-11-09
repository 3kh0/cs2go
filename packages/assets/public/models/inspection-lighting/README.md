# Native Dust II inspection lighting

These are verified inputs from the installed CS2 `de_dust2_vanity` map and native Panorama inspection scripts. They are not a generic studio lighting preset.

- `dust2-reflection.exr`: the map's single combined reflection volume, array index 0, decoded from `maps/de_dust2_vanity/cubemaps/env_cubemap_array.vtex_c` by official Source 2 Viewer CLI 20.1. S2V converts the six HDR cube faces into a linear latitude-longitude image. Delivery uses a 1024 by 512 RGBA half-float ZIP16 EXR, preserving every bit of the current renderer's half-float GPU input while reducing the file from 5,968,436 to 1,386,787 bytes (76.8%). The untouched float32 native export is retained in the ignored reference artifacts. Its capture origin is native Source `[1422, 846.000061, 40]`.
- `dust2-color-correction.bin`: the exact 32 by 32 by 32 RGBA8 color-correction volume from the enabled Dust II vanity VPOST DATA block, without color edits or resampling.
- `dust2-profiles.json`: native item entities, camera entities and corresponding item barn lights for weapons (index 0), music kits (index 4), and melee (index 8). All raw Source coordinates, angles, light fields and authored scales are retained. Native item `model_scale = 0` is an unset field, not a request to collapse the model; authored entity scales remain separate.
- `source.json`: source resources, VPK CRC/SHA hashes, decoded output hashes, exact tone-map parameters, export evidence and limitations.

Native Panorama selects `<ui_inspect_bkgnd_map>_vanity`, resolves `mainmenu` to the selected main-menu map, keeps only the active item lighting rig, disables acknowledgement-only `light_item_new*` fixtures during ordinary inspection, and applies a `sun` brightness input of 1.1 outside Nuke. This value is a Source engine input, not an established direct conversion to Three.js intensity. Native item positions differ by category; preserve the correct camera/model/light basis when converting to the web view.

The Dust II map post-processing volume fixes exposure at 1.0. Its post-processing tone-map white point is 1.4985569715499878; the full curve is preserved in `source.json`. Native material data, scene inputs, and color-grading bytes are verified. Three.js PMREM filtering, shader/BRDF translation, barn-light implementation, composition, viewport behavior, and displayed calibration remain separate implementation and visual-validation concerns. The reflection EXR alone does not contain the map's diffuse irradiance volume.

Reproduction evidence is retained in ignored `artifacts/weapon-inspection-lighting/scene-probes-current.zip` and `native/`. On the Windows Amp runner the read-only extraction script is `.amp/in/artifacts/cs2-native-inspection-lighting/extract_scene.py`, using existing `.amp/in/tools/s2v-20.1/Source2Viewer-CLI.exe`. It checks native VPK CRC values and records resource hashes; `TextureExtract.CreateLatLongFromCubemapFaces` in S2V tag 20.1 documents the cube-to-latlong conversion. Copy the unchanged decoded outputs and retain native entity values, then regenerate `bun run assets:prepare` after asset changes.

Encode the protected float32 export for delivery with:

```sh
bun packages/assets/encode-inspection-reflection.mjs artifacts/weapon-inspection-lighting/preserved/dust2-reflection-native-float32.exr packages/assets/public/models/inspection-lighting/dust2-reflection.exr
bun run assets:prepare
```

The encoder reads the native EXR through the pinned Three.js `EXRLoader(HalfFloatType)` and writes those exact half bit patterns directly into ZIP16 scanline blocks. It decodes the result through the same loader and compares every component before atomically publishing. FFmpeg's ordinary float-to-half rounding does not produce identical GPU inputs, so it is not used. Both native and runtime decodes have GPU SHA-256 `4ace77bfe2a9b45788eeba4af8f84fffce2a0149bbe82a98fa6cc30e4a3512a2`. This guarantee applies to the current half-float loader; restore the preserved native float32 input if a future renderer starts uploading full float32 textures. Preserve the encoder's JSON report in `source.json` when regenerating with a different toolchain.

Valve/Counter-Strike data remains the property of its respective owners. This unofficial browser project is not affiliated with Valve.
