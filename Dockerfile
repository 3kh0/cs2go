# syntax=docker/dockerfile:1
FROM dhi.io/bun:1-dev AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/game/package.json ./apps/game/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/assets/package.json ./packages/assets/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/simulation/package.json ./packages/simulation/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/server ./apps/server
COPY packages/protocol ./packages/protocol
COPY packages/simulation ./packages/simulation
RUN bun run --cwd apps/server build

FROM dhi.io/bun:1 AS runtime
WORKDIR /app
LABEL org.opencontainers.image.source=https://github.com/3kh0/cs2go \
      org.opencontainers.image.title=server \
      org.opencontainers.image.description="CS2GO authoritative multiplayer server, powered by Bun"
ENV NODE_ENV=production PORT=3001 ALLOWED_ORIGINS=https://cs2go.3kh0.net MAP_DIRECTORY=/app/maps
COPY --from=build --chown=65532:65532 /app/apps/server/dist/index.js ./server.js
COPY --chown=65532:65532 packages/assets/public/models/maps/dust2-physics.glb.gz packages/assets/public/models/maps/dust2-nav.json packages/assets/public/models/maps/dust2-bomb.bin.gz ./maps/
USER 65532:65532
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/healthz', { signal: AbortSignal.timeout(2000) }); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "server.js"]
