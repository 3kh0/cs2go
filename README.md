# cs2go

![GitHub repo size](https://img.shields.io/github/repo-size/3kh0/cs2go?style=flat-square&logo=github&label=Repo%20size)
![GitHub Repo stars](https://img.shields.io/github/stars/3kh0/cs2go?style=flat-square&logo=github&label=Stars&color=yellow)

A browser port of Counter-Strike 2, powered by Three.js. This is in early beta but is playable. Not affliated with Valve or Counter-Strike.

Vertigo, Nuke, Inferno and Cache are available as early map previews alongside Dust II and Mirage. Visual parity and performance tuning are still in progress.

Firefox is not supported because Firefox decides to be special and not support many of the cool APIs we use.

## How to play

<https://en.wikipedia.org/wiki/Counter-Strike_2>

## How to actually play

1. Open <https://cs2go.3kh0.net> in a Chromium-based browser
2. Profit?

For the sake of making the game fun, I host 2 servers in the US that are already selectable in the game. You can also host your own server if you want to play with friends.

## Local Development

This is a fat ass monorepo. Frontend is on Vercel and assets are served from Cloudflare R2. To run locally, you just need to do `bun dev` and you should be ready for the races.
