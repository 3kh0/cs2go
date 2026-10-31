# CS2 match interface and UI audio

The scoreboard, round result/MVP strip, bomb-action countdown and notifications follow the installed CS2 Panorama layout/style resources from build **26144732**, patch **1.41.9.2**, depot **2347770**, manifest **67499503218971311**. Read-only extraction used Source2Viewer **20.1.7467** on the Windows Amp runner in **Fast mode**. Runtime assets stay local; no Steam service or Panorama runtime is required.

## Match presentation

- The scoreboard uses the native black 88% background, faint dot texture, blue `#B5D4EE` CT and gold `#EAD18A` T colors, compact 24-unit rows, team emblem/score treatment, and local-player tint. Its dimensions scale from the native 1080-height coordinate space. Tab and Escape retain the live, unpaused match view.
- Rows show actual kills, deaths, K/D and locally awarded MVPs. Cash and equipped weapons remain limited to teammates. Bot/death/objective icons are bundled native artwork. Assists, ADR, ranks, network ping and Steam identities are not fabricated. Competitive history now holds all 24 regulation rounds, including the 12-round halftime marker; Casual uses 15.
- Round results use the native 400×80 result bar at 190 units from the top, native chevrons, condensed Stratum2 typography and blue/gold winning colors. A local loss uses native red. The 640×90 MVP strip expands after the result. A team emblem substitutes for the native portrait/3D MVP scene.
- MVP selection uses the actual winning defuser/planter for objective wins, otherwise the winning player's largest positive kill delta that round. Awards persist through halftime and reset for a new match. This selection is a local approximation, not Valve's closed-source award algorithm. Native MVP scene particles, RIS and account-backed avatars are not implemented.
- Planting and defusing use a circular countdown with three decimal places, actual simulation progress, the correct kit/no-kit duration and icon color, cancel shake and completion pulse. Cancellation, death, round changes and menu return clear action state. The planted alert displays the actual remaining detonation time. Existing interaction hints use the native low-notice treatment. The match-complete dialog adapts the same native palette and presents the real final score.

The implementation adapts native layout/style contracts into DOM/CSS; it is not an embedded Source 2 renderer. Generic notices use the same shared treatment rather than claiming every specialized CS2 popup has been ported.

## Native interface sounds

The UI import adds **18** native recordings and **22** logical bindings, reusing the already verified native click, hover and purchase recordings. `apps/game/src/data/ui-cues.json` retains event gain, pitch and blocking interval separately from encoded audio. Generic hover runs at native **1.4 pitch** and **0.1 gain**; generic press uses **0.3 gain**. Main-menu tabs, Home, Quit, GO, buy hover/select/purchase, radio controls, dropdown changes, confirmation and inspect-close have their corresponding native cues.

One delegated listener handles nested button icons/labels, dynamically created inventory panels, keyboard activation and settings controls. Trusted activations produce one cue; forwarded/programmatic clicks do not duplicate it. Hover stays quiet until audio is unlocked, child-to-child pointer movement does not retrigger, and disabled controls are silent. Range changes are throttled. Master/effects mute applies immediately, UI voices remain dry, and repeated instances of the same clip are bounded. Native event block times are retained, including GO's two-second interval.

The native settings cue includes its verified submenu layer. For native child variation lists, one representative child is scheduled immediately. The browser buses, exact child timing, native mix groups and backend-driven event mapping remain adaptations. The shared popup-transition event has native volume **zero**; opening every modal does not add an invented whoosh.

`packages/assets/public/audio/cs2-ui-source.json` records events, resource/PCM/output hashes, gain/pitch and these limitations. WAV decoding preserved original PCM and channel count. New runtime clips use 48 kHz Opus without baked pitch, gain or normalization. The startup bank now includes **300 clips**, **3,224,569 bytes**, decoded before Play; music still streams separately.

## Regeneration

Keep original game files intact. Extract the referenced compiled Panorama layout/style/script, SVG/PNG and sound-event/VSND resources read-only with Source2Viewer. The compact source index and media hashes are in `docs/match-hud-source.json` and `packages/assets/public/ui/match/source.json`. The audio export contains `event-map.json`, `waveforms.json`, decoded PCM WAVs and the supplemental settings/news/GO evidence.

```sh
python3 scripts/import-match-hud.py artifacts/match-hud/media
python3 scripts/import-cs2-ui-audio.py artifacts/match-hud/audio --supplement artifacts/match-hud/audio-supplement
python3 scripts/pack-audio.py
```

The media importer requires Pillow; the audio importer requires FFmpeg. Both verify export hashes. Export scratch files and screenshots remain ignored under `artifacts/`. The effects importer preserves native UI and music clips when regenerating the older effects set.
