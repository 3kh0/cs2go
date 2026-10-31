# Working on CS2GO

## Scope and stack

CS2GO is a desktop, single-player Counter-Strike-inspired browser FPS. Use TypeScript, Three.js, Bun, and Vite. Keep gameplay responsive. Development/offline assets stay local; production may load pinned asset releases from R2 (see docs/deployment.md). The game supports CS2 Dust II casual 10v10 and competitive 5v5 bomb rounds, Dust Yard practice/deathmatch, all 34 firearms, and three knives. Competitive uses paid armor, friendly fire, round economy and halftime; casual grants armor/helmets and CT kits. See docs/weapon-data.md for pinned current values.

Read the relevant implementation before editing. Preserve the user's changes and existing gameplay unless the task calls for a change. Do not add multiplayer, services, major dependencies, or a new engine as a routine implementation choice.

## Toolchain

- Package manager: Bun 1.4.4, pinned in `package.json`. Commit `bun.lock` when dependencies change; keep one package-manager lockfile.
- Vite: 8.3.5. Import `defineConfig` from `vite` and unit-test helpers from `vitest`. Use standalone Oxlint 1.90.0 and Oxfmt 0.75.0. Keep TypeScript on v6 (currently 6.0.3); Playwright is 1.64.1.
- `bunfig.toml` enables Bun for local JavaScript CLIs launched through `bun run`.
- Install with `bun install --frozen-lockfile`. Use `bun add` / `bun remove` to update dependencies. Do not use npm, npx, or generate `package-lock.json`.

Run from this directory:

```sh
bun run dev                 # Vite development server
bun run check               # Formatting, linting, and type-aware checks
bun run test                # Vite / Vitest unit tests
bun run test:browser         # Playwright browser tests
bun run build               # TypeScript checking and production build
bun run preview             # Serve the production build
```

Install browser binaries when needed with `bun run --bun playwright install chromium`. For formatting fixes, use `bun run format`. Use `bun run test`, since bare `bun test` selects Bun's separate test runner.

## Project map

- `apps/game/src/main.ts`: UI markup, controls, settings bindings, and game initialization.
- `apps/game/src/game.ts`: fixed-step simulation, input, bot AI, hitscan, state transitions, scope, kill feed, and rendering.
- `apps/game/src/physics.ts`: movement, collision, and weapon definitions.
- `apps/game/src/ballistics.ts`: archived weapon attributes, range attenuation, and penetration damage loss.
- `apps/game/src/world.ts`: map geometry, materials, colliders, and instanced static rendering.
- `apps/game/src/weapons.ts`: GLB loading, first-person hands, and sampled weapon animation tracks.
- `apps/game/src/soldier.ts`: articulated soldiers and walking/death animation.
- `apps/game/src/audio.ts`: weapon clips and bounded Web Audio voices.
- `apps/game/src/spatial-audio.ts`: camera-relative HRTF positioning and bounded wall-occlusion filtering.
- `apps/game/src/bot-tactics.ts`: perception, aim, hit-region, burst, and defuser helpers.
- `apps/game/src/soundscape.ts`: music, movement/UI cues, and master/music/effects volume buses.
- `apps/game/src/style.css`: menu, settings, HUD, scope, and kill-feed styling.
- `packages/assets/public/`: bundled models, audio, icons, and fonts.
- `packages/assets/manifest.json`: checked-in SHA-256 release manifest; regenerate with `bun run assets:prepare` after asset changes.
- `apps/game/`: Vite app workspace and Vercel project root.
- `turbo.json`: task inputs, cache outputs, and environment configuration.
- `scripts/`: asset conversion/import utilities.
- `apps/game/tests/game.spec.ts`: browser integration checks. Unit tests live beside source files.

## Gameplay and performance

- Keep the fixed 128 Hz simulation independent of render frame rate. Bot movement runs every simulation step; navigation/targeting update at 16 Hz.
- Preserve counter-strafing, grounded/air movement, movement-dependent accuracy, and weapon cooldowns across switching. Mouse-wheel cycling wraps through owned primary, sidearm, knife, and carried grenade slots. Weapon IDs 0–6 remain stable for saved skins; use `isKnife` and `weaponSlot`, not numeric range assumptions.
- Keep camera/scoping, ammo transfer, animation phases, and sound cues synchronized with simulation state. Switching, death, respawn, and pause must handle cancellation coherently.
- Maintain the AWP's two zoom levels, bolt lockout, and automatic rescope. The moving bolt shaft must remain inside the receiver, and reload hands must follow the magazine/action.
- Penetration must account for material, thickness, range attenuation, and the four-barrier budget. Damage each enemy once per shot despite overlapping decorative meshes. Thick cover must stop bullets.
- Use instancing/batching for static geometry. Avoid unnecessary per-frame work, bound transient audio/effect resources, and dispose owned GPU resources without disposing shared templates.
- Keep production free of development hooks such as `window.__game`. Preserve pointer-lock and user-gesture audio behavior.

## Assets and references

Read `README.md` and `packages/assets/public/audio/source/manifest.json` before modifying imported assets. Weapon OBJs and the first sound pack came from user-supplied Downloads folders. Those original source files are external inputs; leave them intact and keep converted runtime assets in `packages/assets/public/`.

The additional sound library comes from `sourcesounds/csgo`; its importer pins a repository commit. Kill-feed icons come from the user's Killfeed Generator reference. Keep attribution and regeneration instructions accurate, and retain local assets for development/offline play; production may use the pinned R2 CDN and optional Steam API.

The supplied OBJs are static meshes. Current draw/reload/walk animations are authored reconstructions, not exact Valve animation clips. Ballistic and economy attributes use the documented current pinned shipped-data snapshot, while body thickness and map surfaces are simplified. Distinguish verified source values from approximations when changing or describing behavior.

## Validation and delivery

Run `bun run check` and `bun run build` for code/toolchain changes. Run relevant unit tests for movement, collision, or ballistics changes. Use browser tests for input, pointer lock, weapons, scopes, audio, menus, or gameplay integration.

Visually inspect meaningful rendering and animation changes in Chromium; passing numeric checks alone does not establish a convincing animation. Screenshots go in the ignored `artifacts/` directory. Check browser errors and external requests when changing asset loading. Avoid adding tests that merely repeat implementation details.

Keep `README.md` controls, toolchain commands, asset provenance, and limitations current. Report the behavior changed, verification performed, and any material limitations. Do not commit generated `dist/`, `node_modules/`, test reports, or screenshots.
