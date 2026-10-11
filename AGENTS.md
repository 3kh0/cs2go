# Working on CS2GO

## Scope and stack

CS2GO is a desktop, single-player Counter-Strike-inspired browser FPS. Use TypeScript, Three.js, Bun, and Vite Plus. Keep gameplay responsive and assets local. The game currently supports a Dust-style map, practice/deathmatch, five bots, and AK-47, M4A1-S, USP-S, and AWP weapons.

Read the relevant implementation before editing. Preserve the user's changes and existing gameplay unless the task calls for a change. Do not add multiplayer, services, major dependencies, or a new engine as a routine implementation choice.

## Toolchain

- Package manager: Bun 1.4.3, pinned in `package.json`. Commit `bun.lock` when dependencies change; keep one package-manager lockfile.
- Vite Plus: 0.3.2. Use its existing `defineConfig` and `vite-plus/test` imports.
- `bunfig.toml` enables Bun for local JavaScript CLIs launched through `bun run`.
- The Node.js pin in `devEngines.runtime` supports the global Vite Plus CLI's environment management.
- Install with `bun install --frozen-lockfile` or `vp install --frozen-lockfile`. Use `vp add` / `vp remove` to update dependencies, or the equivalent Bun commands. Do not use npm, npx, or generate `package-lock.json`.

Run from this directory:

```sh
bun run dev                 # Vite Plus development server
bun run check               # Formatting, linting, and type-aware checks
bun run test                # Vite Plus / Vitest unit tests
bun run test:browser         # Playwright browser tests
bun run build               # TypeScript checking and production build
bun run preview             # Serve the production build
```

Install browser binaries when needed with `bun run --bun playwright install chromium`. For formatting fixes, use `bun run --bun vp check --fix`. Use `bun run test`, since bare `bun test` selects Bun's separate test runner.

## Project map

- `src/main.ts`: UI markup, controls, settings bindings, and game initialization.
- `src/game.ts`: fixed-step simulation, input, bot AI, hitscan, state transitions, scope, kill feed, and rendering.
- `src/physics.ts`: movement, collision, and weapon definitions.
- `src/ballistics.ts`: archived weapon attributes, range attenuation, and penetration damage loss.
- `src/world.ts`: map geometry, materials, colliders, and instanced static rendering.
- `src/weapons.ts`: GLB loading, first-person hands, and sampled weapon animation tracks.
- `src/soldier.ts`: articulated soldiers and walking/death animation.
- `src/audio.ts`: weapon clips and bounded Web Audio voices.
- `src/soundscape.ts`: music, movement/UI cues, and master/music/effects volume buses.
- `src/style.css`: menu, settings, HUD, scope, and kill-feed styling.
- `public/`: bundled models, audio, icons, and fonts.
- `scripts/`: asset conversion/import utilities.
- `tests/game.spec.ts`: browser integration checks. Unit tests live beside source files.

## Gameplay and performance

- Keep the fixed 128 Hz simulation independent of render frame rate. Bot movement runs every simulation step; navigation/targeting update at 16 Hz.
- Preserve counter-strafing, grounded/air movement, movement-dependent accuracy, and weapon cooldowns across switching. Mouse-wheel cycling wraps through the four weapons.
- Keep camera/scoping, ammo transfer, animation phases, and sound cues synchronized with simulation state. Switching, death, respawn, and pause must handle cancellation coherently.
- Maintain the AWP's two zoom levels, bolt lockout, and automatic rescope. The moving bolt shaft must remain inside the receiver, and reload hands must follow the magazine/action.
- Penetration must account for material, thickness, range attenuation, and the four-barrier budget. Damage each enemy once per shot despite overlapping decorative meshes. Thick cover must stop bullets.
- Use instancing/batching for static geometry. Avoid unnecessary per-frame work, bound transient audio/effect resources, and dispose owned GPU resources without disposing shared templates.
- Keep production free of development hooks such as `window.__game`. Preserve pointer-lock and user-gesture audio behavior.

## Assets and references

Read `README.md` and `public/audio/source/manifest.json` before modifying imported assets. Weapon OBJs and the first sound pack came from user-supplied Downloads folders. Those original source files are external inputs; leave them intact and keep converted runtime assets in `public/`.

The additional sound library comes from `sourcesounds/csgo`; its importer pins a repository commit. Kill-feed icons come from the user's Killfeed Generator reference. Keep attribution and regeneration instructions accurate, and bundle required assets so gameplay makes no external requests.

The supplied OBJs are static meshes. Current draw/reload/walk animations are authored reconstructions, not exact Valve animation clips. Ballistic attributes use a documented December 2021 snapshot, while body thickness and map surfaces are simplified. Distinguish verified source values from approximations when changing or describing behavior.

## Validation and delivery

Run `bun run check` and `bun run build` for code/toolchain changes. Run relevant unit tests for movement, collision, or ballistics changes. Use browser tests for input, pointer lock, weapons, scopes, audio, menus, or gameplay integration.

Visually inspect meaningful rendering and animation changes in Chromium; passing numeric checks alone does not establish a convincing animation. Screenshots go in the ignored `artifacts/` directory. Check browser errors and external requests when changing asset loading. Avoid adding tests that merely repeat implementation details.

Keep `README.md` controls, toolchain commands, asset provenance, and limitations current. Report the behavior changed, verification performed, and any material limitations. Do not commit generated `dist/`, `node_modules/`, test reports, or screenshots.
