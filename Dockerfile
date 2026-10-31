# syntax=docker/dockerfile:1
# DHI multi-platform image digests; both stages use the repository's pinned Bun.
FROM dhi.io/bun:1.4.4-dev@sha256:5ac1bb579e27c32bc31c087066b9a6aff3520a1bd6cb782dbd02d2a7e5319006 AS build
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

FROM dhi.io/bun:1.4.4@sha256:b1485d173e9915b167a3f6dd761a874d6067abba95c8855462db36031a5dc5e3 AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 ALLOWED_ORIGINS=https://cs2go.3kh0.net
COPY --from=build --chown=65532:65532 /app/apps/server/dist/index.js ./server.js
USER 65532:65532
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/healthz', { signal: AbortSignal.timeout(2000) }); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "server.js"]
