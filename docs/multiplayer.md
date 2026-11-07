# Multiplayer lobbies

Open Play → Online and choose `na1-cs.3kh0.dev` or `na2-cs.3kh0.dev`. Select Casual/Competitive and **Create Lobby**, then choose your team. The server assigns a six-digit PIN, including any leading zeroes. Share the PIN and server, or use **Copy Invite** beside the PIN in the pause menu. Friends select the same server, enter the PIN and select **GO**. The lobby's game mode is selected automatically before team selection. No password or account is required.

Invite links select the server and PIN without automatically connecting. Production accepts only the two built-in servers; development also offers local servers on ports 3001 and 3002. Unknown or expired PINs show an error and never create a lobby. PINs are unique among active lobbies on each server, not across both servers. Anyone with the server and PIN can join; PINs are not authentication.

## Architecture and limits

`apps/server` is authoritative over movement, combat, inventories, economy, utility, C4 and round results. Clients send sequenced inputs, never trusted positions/damage/balances. `packages/protocol` bounds/version-checks messages; `packages/simulation` shares local gameplay rules. `apps/game/src/multiplayer-match.ts` feeds snapshots into the normal renderer/HUD.

The server runs at 128 Hz and snapshots at 32 Hz. Clients predict/reconcile local movement and interpolate remote actors about 100 ms behind. Stale input expires after 250 ms; queues, payloads and connection rates are bounded. Protocol version 10 requires matching frontend/server deployments. Team-specific glove finish, wear and seed travel with cosmetic configuration and snapshots; peer models and first-person spectators use the observed player's choice. Buy-and-drop requests are charged and spawned atomically by the server while preserving the held loadout.

Chat uses T for team and Y for all by default, with separate bindings in Settings → Controls. Enter sends and Escape cancels. The server assigns sender identity and routes team messages using current authoritative teams, including after halftime; all chat stays inside the sender's room. Living and dead teammates can chat. Messages are limited to 240 characters and one per 750 ms per connection, with no server history or replay on reconnect. The client retains at most 50 messages for the current match and renders text literally. Typing suppresses gameplay input while keeping pointer lock.

Casual supports 10v10 and Competitive 5v5. Both sides must arrive before a round starts; late joins wait for the next round. Eliminated players spectate until the next round. Competitive spectators can only use living teammates’ first-person views; when none remain, the camera stays focused on C4 with a limited downward viewing angle. Casual spectators can follow either team and retain chase/free cameras. Disconnecting drops carried C4. Shared rules cover freeze/post-round play, halftime, planted-bomb elimination exceptions, MVPs, refunds, scopes, suppressors, dropped appearance identity and grenade effects.

Rooms are in memory, disappear when empty and are lost on restart. Limits are sixteen rooms and 128 connections per process. Use one replica until routing exists. Guest names and cosmetics are client assertions; Steam login does not authenticate lobby ownership or cosmetic entitlements. Native rewind/lag compensation and complete skinned server hitboxes are absent. The shared browser simulations retain the [gameplay fidelity boundaries](weapon-data.md).

## Local operation

```sh
bun install --frozen-lockfile
bun run dev
```

Frontend: `http://127.0.0.1:5173/`. WebSocket server: `ws://127.0.0.1:3001/ws`. Select Local server :3001 in development. Invite links target the same homepage, with lobby/mode settings.

## Docker / Coolify

Use the repository root as build context, root `Dockerfile` and `runtime` stage. Digest-pinned DHI Bun 1.4.4 stages produce a shell-free, non-root server. Authenticate the build host with `docker login dhi.io` when required; never add registry credentials to the repository.

| Setting               | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| Exposed port / `PORT` | `3001`                                                                   |
| `ALLOWED_ORIGINS`     | Comma-separated exact HTTP(S) frontend origins, without trailing slashes |
| `MAP_DIRECTORY`       | `/app/maps`, already set in the image                                    |
| Health check          | `/healthz`, ready only after gameplay inputs load                        |

The proxy must terminate TLS and forward WebSocket upgrades to `/ws`. HTTPS frontends require WSS. Add preview origins explicitly. No database/volume is needed. The image contains only the bundled server plus Dust II physics, navigation and baked C4 data; visual/audio assets remain on R2.

```sh
docker build -t cs2go-server .
docker run --rm --name cs2go-server -p 127.0.0.1:3001:3001 \
  -e ALLOWED_ORIGINS=http://127.0.0.1:5173 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges cs2go-server
```

SIGTERM/SIGINT stop ticking and close sockets with a restart notice. Persistent identity across server restarts, match draining, multi-region routing and unrestricted-public capacity qualification remain unimplemented.

## Verification

Run `bun run check`, `bun run test`, `bun run build` and relevant multiplayer Playwright tests. Real socket tests load the native gameplay inputs; browser tests use multiple peers through the ordinary menu. Loopback-only round/position controls in `apps/server/tests/browser-server.ts` are test fixtures and must stay out of production.

Temporary transport failures retry automatically for up to 15 seconds. The server reserves the player for 20 seconds with a rotating in-memory session token; position, inventory and economy survive, but the match keeps running and disconnected players remain vulnerable. Explicit leave and policy rejection remove the player immediately. Server restarts and expired sessions require rejoining from Play. Connection transitions log with the [network] prefix without session tokens. Peer interpolation uses server tick spacing and interpolated heading.
