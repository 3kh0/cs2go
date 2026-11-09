# Native menu control icons

Valve CS2 Panorama `filter`, `filter_line`, `sort` and `search` vectors,
exported read-only from the installed game with official Source 2 Viewer CLI20.1.
These remain Valve assets; this project is not affiliated with Valve.
`source.json` records each compiled resource path, archive member CRC32/SHA-256,
and decoded SVG SHA-256 from the matching-build audit.

To regenerate, extract the four `panorama/images/icons/ui/<name>.vsvg_c`
resources from CS2 `game/csgo/pak01_dir.vpk`, then use Source 2 Viewer CLI20.1
`--decompile` to emit SVG. Keep the source input untouched, compare decoded hashes
with `source.json`, and run `bun run assets:prepare` after replacing these copies.
