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
COPY apps/game ./apps/game
COPY packages/protocol ./packages/protocol
COPY packages/simulation ./packages/simulation
COPY packages/assets/manifest.json packages/assets/pipeline.mjs ./packages/assets/
COPY scripts/build-assets.mjs scripts/service-worker.js ./scripts/
ARG ASSET_CDN_URL
RUN test -n "$ASSET_CDN_URL" && ASSET_CDN_URL="$ASSET_CDN_URL" bun run --cwd apps/game build

FROM dhi.io/bun:1 AS runtime
WORKDIR /app
LABEL org.opencontainers.image.source=https://github.com/3kh0/cs2go \
      org.opencontainers.image.title=client \
      org.opencontainers.image.description="CS2GO browser client and Steam endpoint, served by Bun"
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=65532:65532 /app/apps/game/dist ./dist
COPY --chown=65532:65532 apps/game/client-server.mjs apps/game/steam-auth.mjs apps/game/steam-inventory-data.mjs ./
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/healthz', { signal: AbortSignal.timeout(2000) }); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "client-server.mjs"]
