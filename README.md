# cs2go

A browser port of Counter-Strike 2, powered by Three.js. This is in early beta but is playable. Not affliated with Valve or Counter-Strike.

## How to play

<https://en.wikipedia.org/wiki/Counter-Strike_2>

## Local Development

This is a fat ass monorepo. Frontend is on Vercel and assets are served from Cloudflare R2. To run locally, you just need to do `bun dev` and you should be ready for the races.

## Multiplayer

Choose Single Player or Multiplayer from the normal match card. Both use Dust II with Casual or Competitive bomb rounds. The server is built from the root DHI-based `Dockerfile` for Coolify; Vercel serves the frontend and R2 serves visual assets. See [multiplayer setup and current limits](docs/multiplayer.md).

## Startup performance

See [startup measurements and production cache checks](docs/startup-loading.md). After a production build, run `bun run --cwd apps/game test:startup` to test cold, repeat and offline loading.
