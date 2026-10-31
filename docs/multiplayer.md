# Dust II multiplayer

Single-player and multiplayer use the same main-menu Play flow, Dust II scene, HUD, buy menu, scoreboard, pause menu, and round banners. Choose Casual or Competitive, choose Single Player or Multiplayer, and choose a team. The standalone preview page and procedural training map have been removed. Practice/deathmatch developer modes also use Dust II.

Multiplayer is server-authoritative. Casual rooms have up to ten players per team; Competitive rooms have five. Players can move and use their weapons while waiting for both sides, then the match starts freeze time. Late arrivals wait until the next round. Eliminated players spectate until the next round; they do not automatically respawn mid-round. Disconnecting a bomb carrier drops C4 at their last position.

Round rules share the existing pinned single-player economy data: Casual has free armor/helmets and CT kits; Competitive charges for equipment and applies friendly fire. Buying is limited by the native faction buy triggers, time, balance, weapon faction and occupied slot. Firearm purchases and switching, ammo, reloads, health, armor, kills, money and round results belong to the server. The server restricts purchases to the configured faction loadout slots, captured at each spawn; cosmetic selections are client assertions rather than verified Steam entitlements.

T holds E while grounded and stationary inside a native bomb target to plant for 3.2 seconds. CT holds E nearby to defuse in five seconds with a kit or ten without. Moving or releasing E cancels progress. C4 detonates after 40 seconds. CT elimination, T elimination without a planted bomb, timeout, defuse and detonation settle the round once. A planted bomb keeps the round live after T elimination. C4 health damage uses the same imported baked field and query code as single-player.

Survivors can move and fire during the normal post-round interval. Competitive halftime freezes play, swaps sides and scores, and resets equipment/economy. Casual ends at eight wins; Competitive ends at thirteen wins or the twenty-four-round limit, including a 12–12 draw. Objective winners receive objective MVP reasons; other MVPs use that round's elimination totals.

## Networking and scope

- `apps/server`: persistent Bun HTTP/WebSocket server and isolated private rooms.
- `packages/protocol`: versioned, bounded messages; clients submit sequenced inputs, never positions, damage, balances or results.
- `packages/simulation`: shared native Dust II collision, movement, spawn data interfaces, trigger volumes, weapon/economy/armor rules, C4 field query and round state machine.
- `apps/game/src/multiplayer-match.ts`: integrates network snapshots into the regular game presentation. No second renderer/page or separate multiplayer HUD.

Authority runs at 128 Hz, snapshots at 32 Hz. Local movement predicts with the same native triangle/hull queries and reconciles acknowledged inputs. Remote actors interpolate approximately 100 ms behind snapshots. Browser blur/unlock sends neutral input; stale input expires after 250 ms. Input queues, connection buffers, payloads and message rates are bounded. Protocol version 4 requires deploying the new frontend and server together.

Combat now shares the single-player spread, recoil, pellet, penetration, armor, melee, grenade and dropped-weapon modules. Reload insertion and suppressor commits come from the same local animation GLBs as the viewmodels; regenerate their small server metadata with `python3 scripts/import-weapon-action-data.py`. The server owns purchases/refunds, grenade inventories, trajectories/effects, flash duration, damage, and ammunition. Clients render confirmed impact decals, hit/headshot feedback, native weapon animation/audio and the existing smoke/fire/flash effects. Cosmetic loadout selections are sent on joining; each weapon captures its creator, finish, wear and seed, and retains that identity when dropped, picked up or carried by another player.

This preserves browser gameplay features rather than claiming native Source 2 simulation parity. Player hit regions are still simplified server hulls; native skinned hitbox and rewind/lag-compensation parity remain accuracy limitations. The shared recoil/spread and grenade solvers retain the documented reconstruction boundaries from single-player. Steam login/inventory remain available on the website, but room names and cosmetic selections are guest assertions rather than authenticated Steam ownership. Native blast filtering/wave timing retain the single-player documented limitations.

Rooms are in memory and disappear when empty. Restarting loses rooms/scores. Limits are sixteen rooms and 128 connections per process, with faction capacity enforced per game mode. Use one server replica until room routing is implemented. The full snapshot JSON protocol needs capacity/bandwidth measurement before unrestricted public use; automated gameplay integration validates two real peers, with a third peer for teammate spectating.

## Local development

```sh
bun install --frozen-lockfile
bun run dev
```

The normal frontend is `http://127.0.0.1:5173/`; the development game server is `ws://127.0.0.1:3001/ws`. Choose Multiplayer in the match card. The card contains the server address, room code and optional password. Copy Invite produces a link to the normal homepage with the selected room/mode; passwords are excluded. The invitation does not connect until the user chooses Play and a team. A localhost invite only works on the same computer.

## Coolify / Docker

Use the root `Dockerfile` with repository root as build context. Both build/runtime stages use digest-pinned DHI Bun 1.4.4 images. The runtime is shell-free, non-root UID/GID 65532, and contains the bundled server plus exactly three native gameplay inputs: `dust2-physics.glb.gz`, `dust2-nav.json`, and `dust2-bomb.bin.gz`. Visual models, sky, textures, fonts and audio remain on R2 and are not sent in the Docker context. The server loads those gameplay files once at startup, not over the network per match.

Authenticate the machine/user performing the Coolify build with `docker login dhi.io` if needed; do not put registry credentials in the Dockerfile or repository. See [Docker's Bun guide](https://docs.docker.com/guides/bun/) and [Coolify build-server registry configuration](https://coolify.io/docs/core/infrastructure/servers/build-servers).

| Coolify setting           | Value                                                 |
| ------------------------- | ----------------------------------------------------- |
| Build method              | Dockerfile                                            |
| Base/build directory      | `/`                                                   |
| Dockerfile                | `/Dockerfile`                                         |
| Build stage               | `runtime` or leave empty                              |
| Ports Exposes             | `3001`                                                |
| Domain                    | Your HTTPS game-server domain                         |
| Runtime `PORT`            | `3001`                                                |
| Runtime `ALLOWED_ORIGINS` | `https://cs2go.3kh0.net`                              |
| Runtime `ROOM_PASSWORD`   | Optional server-wide password, at most 128 characters |
| Runtime `MAP_DIRECTORY`   | `/app/maps` (already set in the image)                |

`ALLOWED_ORIGINS` accepts comma-separated exact HTTP(S) frontend origins without trailing slashes. Add preview origins explicitly. The Coolify proxy terminates TLS and forwards WebSocket upgrades to the container's HTTP `/ws` route. No persistent volume/database is needed. `/healthz` becomes available only after native gameplay data loads; the Docker health check invokes Bun fetch, not curl or a shell. See [Coolify Dockerfile applications](https://coolify.io/docs/applications/builds/dockerfile) and [health checks](https://coolify.io/docs/applications/configuration/health-checks).

Set public build-time `VITE_MULTIPLAYER_URL=wss://your-game-server/ws` on the Vercel frontend, then rebuild. With the existing GitHub deployment workflow, repository variable `MULTIPLAYER_URL` can supply it. It is a public address, not a credential. The HTTPS frontend requires WSS.

```sh
docker build -t cs2go-server .
docker run --rm --name cs2go-server -p 127.0.0.1:3001:3001 \
  -e ALLOWED_ORIGINS=http://127.0.0.1:5173 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  cs2go-server
```

SIGTERM/SIGINT stop the tick timer and close sockets with a restart notice. Users can rejoin the same invite, but seamless reconnects, persistent identity, match draining and multi-region routing are not implemented.

## Validation

Run `bun run check`, `bun run test`, and `ASSET_CDN_URL=https://a.cs2go.3kh0.net bun run build`. Round tests exercise freeze time, prediction agreement, post-round movement/fire, respawns between rounds, timeout economy, halftime, plant/defuse cancellation, planted-bomb elimination exceptions, MVP reasons and match completion. The real Bun socket integration loads native Dust II physics and checks origin/password handling, movement/damage, isolation, input replay rejection and cleanup.

Playwright's `multiplayer.spec.ts` joins two clients through the normal menu, checks Dust II, buys a firearm, verifies freeze/live/post-round movement and firing, holds plant/defuse input, checks both clients' result banners, then switches back to a local bot match. Local-only round/position controls live in `apps/server/tests/browser-server.ts`, listen only on loopback, and are not imported into the production server bundle.
