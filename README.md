# cs2go

A browser port of Counter-Strike 2, powered by Three.js. This is in early beta but is playable. Not affliated with Valve or Counter-Strike.

## How to play

<https://en.wikipedia.org/wiki/Counter-Strike_2>

## Local Development

This is a fat ass monorepo. Frontend is on Vercel and assets are served from Cloudflare R2. To run locally, you just need to do `bun dev` and you should be ready for the races.

## Private multiplayer preview

The separate [multiplayer preview](docs/multiplayer.md) adds private Dust Yard rooms with an authoritative Bun server. The website stays on Vercel, assets stay on R2, and the root DHI-based `Dockerfile` deploys only the server to Coolify. Online play is currently a guest AK-47 free-for-all; the full single-player feature set has not been ported to networking.
