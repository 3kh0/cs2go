# Private multiplayer preview

The browser stays on Vercel and models/audio stay on the existing revisioned R2 CDN. A separate persistent Bun server owns each private Dust Yard room. Nothing in this setup requires moving the website or copying the art tree to Coolify.

This is the first playable networking milestone, not multiplayer parity with the single-player game. Up to ten guests can join a room, move/jump/walk/crouch, fire and reload a default AK-47, see other animated agents, score eliminations and respawn after three seconds. Tab displays the room scoreboard; Escape releases the mouse without pausing the server. Disconnect and rejoin preserve the invite, but create a new player and reset that player's score.

The preview is free-for-all: CT/T appearances alternate, but both can damage everyone. Names are unverified guest labels. Steam authentication, inventory/skin ownership, weapon selection, grenades, Dust II, armor, penetration, recoil/spread, lag compensation, player-body collision, competitive rounds and persistent matches are not implemented for online play. The existing single-player modes remain available on the main page.

## Workspaces and authority

- `apps/server`: Bun HTTP/WebSocket server, room lifecycle, connection limits and shutdown.
- `packages/protocol`: versioned, bounded JSON messages and validation. Clients send sequenced input, never positions, health, damage or kills.
- `packages/simulation`: headless weapon/movement data, shared Dust Yard collision boxes, movement prediction and authoritative arena combat. The original browser `physics.ts` re-exports these rules. Weapon-data regeneration now targets this package.
- `apps/game/online.html`: separate browser entry; the regular game does not open a network connection. Main-menu **PRIVATE MULTIPLAYER** opens the preview.

Authority runs at 128 Hz and broadcasts full snapshots at 32 Hz. A player can consume at most one queued input per authoritative step. The browser predicts movement with the same controller, discards acknowledged inputs and replays the remainder against server snapshots. Remote agents interpolate approximately 100 ms behind incoming state. Firing feedback is server-confirmed in this preview. Input stops after 250 ms without new commands; pending input and slow-socket buffers are bounded. A death/respawn boundary resets prediction instead of replaying old movement across it.

The shared controller uses the range's AABB collision and Source-style acceleration, friction and jump constants. It does not claim exact Dust II/controller parity. Hits use simplified unarmored player hulls and solid cover blocks shots. The wire format is JSON for this milestone; bandwidth and tick performance need measurement before public/full-capacity use. Changing simulation or protocol compatibility requires incrementing `PROTOCOL_VERSION` and deploying both ends together.

Rooms are isolated, held in memory, and deleted when their last player leaves. Limits are 10 players per room, 16 rooms, and 128 total sockets per process. Room codes generated in the browser have 72 bits of randomness. Joining an unused code creates that room. Optional server-wide passwords are sent in the WebSocket join message, never in invite URLs or application logs. Origin checks restrict browser access; they are not identity verification or protection against custom clients. A join deadline, message/payload/queue limits, and ordered input checks bound common abuse. This is intended for private testing, not an unrestricted public server.

## Run locally

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd apps/server start
bun run --cwd apps/game dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/online.html`. The default local server is `ws://127.0.0.1:3001/ws`. Generate a room, join, and use **COPY INVITE** to give another browser the same server and room code. Both browsers must be able to reach that server; a localhost invite only works on the same computer.

`bun run dev` also runs both development workspaces through Turbo. Server environment variables pass through Turbo. For a different local frontend port, add its exact origin to `ALLOWED_ORIGINS`.

## Docker / Coolify

The root `Dockerfile` uses both DHI Bun **1.4.4-dev** and **1.4.4** images, pinned by multi-platform digest. Build stage installs from the root Bun lockfile and typechecks/bundles the server. The final shell-free runtime runs as UID/GID 65532 and contains only the bundled server, not source, node_modules, Steam/R2 secrets, or game assets. `.dockerignore` allowlists the small build context.

Docker's DHI instructions require registry authentication. On the machine/user performing the Coolify build, run `docker login dhi.io` with Docker credentials if pulls require authentication. Do not put registry credentials in build arguments, this repository, or the Dockerfile. See [Docker's Bun guide](https://docs.docker.com/guides/bun/) and [Coolify build-server registry configuration](https://coolify.io/docs/core/infrastructure/servers/build-servers).

In Coolify, create a **Dockerfile** application for this repository after reviewing/publishing the changes:

| Setting                   | Value                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| Base/build directory      | `/` (repository root)                                                  |
| Dockerfile                | `/Dockerfile`                                                          |
| Build stage               | `runtime` (or leave empty; it is the final stage)                      |
| Ports Exposes             | `3001`                                                                 |
| Domain                    | Your HTTPS game-server domain, for example `https://mp.cs2go.3kh0.net` |
| Runtime `PORT`            | `3001`                                                                 |
| Runtime `ALLOWED_ORIGINS` | `https://cs2go.3kh0.net`                                               |
| Runtime `ROOM_PASSWORD`   | Optional private-server password; at most 128 characters               |

`ALLOWED_ORIGINS` accepts comma-separated exact HTTP(S) origins, including scheme and any port, without a trailing slash. Add a preview deployment's exact origin when testing that frontend. The game-server domain is not the frontend origin. Keep the proxy's WebSocket upgrade handling enabled. TLS terminates at the Coolify proxy; the container listens on HTTP internally. No persistent volume or database is required. Scale this application to **one replica**: room ownership/routing across replicas is not implemented.

The image supplies a shell-free health check against `/healthz`; it uses Bun's fetch instead of assuming curl/sh exist. Coolify detects image health checks for Dockerfile applications. See [Coolify Dockerfile applications](https://coolify.io/docs/applications/builds/dockerfile) and [health checks](https://coolify.io/docs/applications/configuration/health-checks).

On Vercel, set the public **build-time** variable `VITE_MULTIPLAYER_URL=wss://mp.cs2go.3kh0.net/ws`, then rebuild the frontend. This address is public, not a credential. An HTTPS frontend requires WSS. Until configured, the preview lets you enter the server address manually. If using the existing GitHub deployment workflow, set the repository variable `MULTIPLAYER_URL`; the workflow forwards it to Vercel's build process as `VITE_MULTIPLAYER_URL`.

Manual local container check:

```sh
docker build -t cs2go-server .
docker run --rm --name cs2go-server -p 127.0.0.1:3001:3001 \
  -e ALLOWED_ORIGINS=http://127.0.0.1:5173 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  cs2go-server
```

The process handles SIGTERM/SIGINT, closes sockets with a restart notice, and stops its tick timer. Restarting currently loses rooms and scores; users rejoin using the same invite. Seamless reconnects, drain-to-completion deployment, region selection and durable matchmaking remain future work. Do not configure a deployment to restart the server for unrelated art or frontend changes.

## Validation

`bun run check`, `bun run test`, and `ASSET_CDN_URL=https://a.cs2go.3kh0.net bun run build` cover all workspaces. Simulation tests check prediction/authority agreement, collision, crouching, fire cadence, cover, reloads, deaths and respawns. `apps/server/tests/server.integration.ts` exercises real Bun sockets, origin/password rejection, two peers, authoritative movement/damage, isolated rooms, duplicate-input rejection and cleanup. The server package's `test` command invokes this integration program through Bun because it requires Bun's native server runtime.

`bun run test:browser --filter=@cs2go/game` runs the existing browser suite plus `multiplayer.spec.ts`; the Playwright config starts a dedicated multiplayer server on port 3002 for the integration test. The multiplayer test uses two separate Chromium contexts, actual input and network snapshots, a shared scoreboard, death/respawn, disconnect and rejoin. It adds no production debug hooks.
