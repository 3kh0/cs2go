# Private multiplayer

Open the Play tab to choose Casual/Competitive, Multiplayer, server address, room code and optional password, then select a team. Copy Invite excludes the password and opens the configured Play page without connecting automatically. Localhost invitations only work on the same machine.

## Architecture and limits

`apps/server` is authoritative over movement, combat, inventories, economy, utility, C4 and round results. Clients send sequenced inputs, never trusted positions/damage/balances. `packages/protocol` bounds/version-checks messages; `packages/simulation` shares local gameplay rules. `apps/game/src/multiplayer-match.ts` feeds snapshots into the normal renderer/HUD.

The server runs at 128 Hz and snapshots at 32 Hz. Clients predict/reconcile local movement and interpolate remote actors about 100 ms behind. Stale input expires after 250 ms; queues, payloads and connection rates are bounded. Protocol version 7 requires matching frontend/server deployments. Team-specific glove finish, wear and seed travel with cosmetic configuration and snapshots; peer models and first-person spectators use the observed player's choice. Buy-and-drop requests are charged and spawned atomically by the server while preserving the held loadout.

Casual supports 10v10 and Competitive 5v5. Both sides must arrive before a round starts; late joins wait for the next round. Eliminated players spectate until the next round. Disconnecting drops carried C4. Shared rules cover freeze/post-round play, halftime, planted-bomb elimination exceptions, MVPs, refunds, scopes, suppressors, dropped appearance identity and grenade effects.

Rooms are in memory, disappear when empty and are lost on restart. Limits are sixteen rooms and 128 connections per process. Use one replica until routing exists. Guest names and cosmetics are client assertions; Steam login does not authenticate room ownership or cosmetic entitlements. Native rewind/lag compensation and complete skinned server hitboxes are absent. The shared browser simulations retain the [gameplay fidelity boundaries](weapon-data.md).

## Local operation

```sh
bun install --frozen-lockfile
bun run dev
```

Frontend: `http://127.0.0.1:5173/`. WebSocket server: `ws://127.0.0.1:3001/ws`. Invite links target the same homepage, with room/mode settings.

## Docker / Coolify

Use the repository root as build context, root `Dockerfile` and `runtime` stage. Digest-pinned DHI Bun 1.4.4 stages produce a shell-free, non-root server. Authenticate the build host with `docker login dhi.io` when required; never add registry credentials to the repository.

| Setting                               | Value                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Exposed port / `PORT`                 | `3001`                                                                   |
| `ALLOWED_ORIGINS`                     | Comma-separated exact HTTP(S) frontend origins, without trailing slashes |
| `ROOM_PASSWORD`                       | Optional server-wide password, maximum 128 characters                    |
| `MAP_DIRECTORY`                       | `/app/maps`, already set in the image                                    |
| Health check                          | `/healthz`, ready only after gameplay inputs load                        |
| Frontend build `VITE_MULTIPLAYER_URL` | `wss://your-server/ws` (`MULTIPLAYER_URL` in the GitHub workflow)        |

The proxy must terminate TLS and forward WebSocket upgrades to `/ws`. HTTPS frontends require WSS. Add preview origins explicitly. No database/volume is needed. The image contains only the bundled server plus Dust II physics, navigation and baked C4 data; visual/audio assets remain on R2.

```sh
docker build -t cs2go-server .
docker run --rm --name cs2go-server -p 127.0.0.1:3001:3001 \
  -e ALLOWED_ORIGINS=http://127.0.0.1:5173 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges cs2go-server
```

SIGTERM/SIGINT stop ticking and close sockets with a restart notice. Persistent identity, seamless reconnect, match draining, multi-region routing and unrestricted-public capacity qualification remain unimplemented.

## Verification

Run `bun run check`, `bun run test`, `bun run build` and relevant multiplayer Playwright tests. Real socket tests load the native gameplay inputs; browser tests use multiple peers through the ordinary menu. Loopback-only round/position controls in `apps/server/tests/browser-server.ts` are test fixtures and must stay out of production.
