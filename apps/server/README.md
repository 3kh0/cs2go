# CS2GO match server

Authoritative Bun WebSocket server for online casual, competitive and deathmatch rooms. Each room runs the shared `@cs2go/simulation` rules at 128 Hz and sends snapshots at 32 Hz.

```sh
bun run dev     # watch mode on PORT (default 3001)
bun run test    # integration suites, including persistent rooms and bots
```

## Configuration

| Variable               | Default                                       | Purpose                                                                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`                 | `3001`                                        | HTTP/WebSocket port.                                                                       |
| `ALLOWED_ORIGINS`      | `http://localhost:5173,http://127.0.0.1:5173` | Exact browser origins allowed to connect. Custom servers must list the game's origin here. |
| `MAP_ID`, `MAPS`       | `dust2`, all ready maps                       | Default map and the maps this server loads.                                                |
| `PERSISTENT_MODES`     | `casual,deathmatch`                           | Modes that always have one public bot lobby. Set it to an empty value to disable them.     |
| `BOT_FILL_CASUAL`      | `10`                                          | Total players (people plus bots) a casual bot lobby is topped up to.                       |
| `BOT_FILL_COMPETITIVE` | `10`                                          | Same for a persistent competitive room, if enabled.                                        |
| `BOT_FILL_DEATHMATCH`  | `8`                                           | Same for the deathmatch bot lobby.                                                         |

## Bot lobbies (persistent rooms)

- Created at startup on a random loaded map, listed publicly even when empty, and never deleted.
- Bots join only while at least one person is in the room. A person joining a full team takes a bot's seat; bots leave when the last person does, and the room resets on the same map.
- When a match finishes, the result shows for 15 seconds. The room then switches to a different random map, keeps its PIN, and sends `map-change`. Clients reload that map and rejoin on the same side. A client that joins with a stale map is redirected the same way.

## Online deathmatch

- Free-for-all: CT/T only selects the character model. Ten-minute match; the most points wins (kill points use the native price table in `@cs2go/simulation/deathmatch`).
- Respawn after 2 s at a NAV-derived spawn chosen away from, and out of sight of, living players. The pool is built from `<map>-nav.json` at startup.
- 10 s spawn protection, ended by moving or attacking, which is also the buy window. Weapons are free and replace the slot's weapon, armor is granted, reserve ammo is unlimited, and nothing drops on death. Chosen guns persist across respawns.
- Not online yet: the offline bonus-weapon windows, healthshots and assist points.

## Bots

`src/bots.ts` produces ordinary inputs, so bots follow the same movement, weapon, economy and objective rules as people. They route with A\* over native NAV areas and portals, acquire visible enemies at 16 Hz after a reaction delay, turn toward them with skill-scaled error and fire in bursts. They buy affordable primaries, carry and plant the bomb on a chosen site, and defuse. This is simple original behaviour, not a reconstruction of Valve's bot AI: bots do not use utility, coordinate, or handle every ladder or jump route, and stuck bots pick a new route.
