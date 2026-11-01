# Development

Install Bun 1.4.4, then run from the repository root:

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run test:tools
bun run test:browser
bun run build
```

The frontend runs on port 5173 and the local multiplayer server on 3001. Use `bun run test`, not bare `bun test`. Install Chromium with `bun run --bun playwright install chromium` when needed. Format with `bun run format`; keep one Bun lockfile.

## Code map

| Location                                                          | Responsibility                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/game/src/main.ts`, `game.ts`                                | Menus, input, fixed-step game loop and presentation        |
| `apps/game/src/weapons.ts`, `weapon-motion.ts`, `knife-motion.ts` | Models, hands and action playback                          |
| `apps/game/src/soldier.ts`, `dust2.ts`                            | Actors and native map rendering                            |
| `packages/simulation/src/`                                        | Shared movement, collision, weapons, economy and rounds    |
| `packages/protocol/src/`                                          | Wire messages and stable weapon/knife IDs                  |
| `apps/server/src/`                                                | Authoritative private matches                              |
| `packages/assets/`                                                | Local assets, provenance, release manifest and R2 pipeline |
| `apps/game/tests/`                                                | Playwright gameplay integration tests                      |

Simulation runs at 128 Hz independently of rendering. Bot movement runs each simulation step; targeting/navigation run at 16 Hz. Preserve weapon cooldowns through switching and coherent cancellation on death, menus and disconnect. In-match menus leave the match running; hidden tabs suspend browser work.

## Controls and inventory

WASD moves, Space jumps, Shift walks, Ctrl crouches, R reloads, F inspects, B buys, E uses/plants/defuses, G drops a firearm, Tab shows the scoreboard and Escape releases pointer lock. Bindings, graphics, audio and crosshair settings are saved locally.

Slots 1/2/3 select primary/sidearm/knife; 4 cycles utility, and the wheel wraps through owned slots. Left/right knife attacks slash/stab. Grenades support overhand, underhand and combined-button medium throws. AWP has two scope levels; M4A1-S/USP-S right-click toggles the suppressor.

Open **Play** for mode selection, single-player/multiplayer and server/room settings; Home keeps the agent showcase and inventory shortcuts. Invite links open the configured Play page without connecting automatically.

Inventory selects faction buy slots and cosmetic finishes, with full-color default weapon previews. All 22 knives use **Inventory → Weapon Skins → Equip Knife**, never buy cards. Equipping a knife captures its selected finish. Changing a firearm finish affects previews and newly created weapons; carried/dropped guns keep their original appearance, ammo and attachment state. Steam import is described in [steam-login.md](steam-login.md).

Inventory's **Agents** and **Gloves** categories select appearances separately for T and CT. Glove wear/seed are saved locally; **Restore default** resets the selected team's choice. Agent animations can be searched and previewed in the main menu; round gameplay continues to choose movement/actions automatically. The default CT is native SAS (Inspects item 5600); existing `default-ct` saves keep that ID and now use native body animations, first-person sleeves and gloves. Both defaults can preview the Source 2 animation library.

**Settings → Viewmodel** adjusts FOV (54–68), X/right, Y/forward and Z/up offsets, and 16:9/16:10/4:3/5:4 stretch. The live preview uses actual weapon/hand models without changing inventory or world-camera FOV. Reset restores source defaults: FOV 60, offsets 1/1/−1, aspect 16:9. Values persist through reloads and resize with the viewport.

## Validation

Run checks/build for code changes, relevant unit tests for shared rules, and browser tests for input/UI/gameplay. Inspect meaningful rendering or animation changes in Chromium and check browser errors and asset requests. Keep screenshots and extraction scratch files under ignored `artifacts/`. Production must not expose `window.__game`.

See [weapon-data.md](weapon-data.md) for source/approximation boundaries, [assets.md](assets.md) for maintained tools, [deployment.md](deployment.md) for publishing and [multiplayer.md](multiplayer.md) for server operation.
