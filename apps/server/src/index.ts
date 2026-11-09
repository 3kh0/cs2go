import { PROTOCOL_VERSION, TICK_RATE, isMapId, type MapId } from "@cs2go/protocol";
import { loadServerMap } from "./map";
import { startServer } from "./server";
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const log = (message: string) =>
  console.log(`[${new Date().toTimeString().slice(0, 8)}] ${message}`);
const started = performance.now();
log(`Starting multiplayer with Bun ${Bun.version} as PID ${process.pid}`);
const mapId = process.env.MAP_ID ?? "dust2";
if (!isMapId(mapId)) throw new Error("MAP_ID must be dust2 or mirage");
const enabled = (process.env.MAPS ?? "dust2,mirage").split(",").map((id) => id.trim());
if (enabled.some((id) => !isMapId(id))) throw new Error("MAPS must contain dust2 or mirage");
const maps: Partial<Record<MapId, Awaited<ReturnType<typeof loadServerMap>>>> = {};
for (const id of new Set([mapId, ...(enabled as MapId[])])) {
  log(`Loading ${id === "mirage" ? "Mirage" : "Dust II"}...`);
  maps[id] = await loadServerMap(undefined, id);
}
const map = maps[mapId]!;
log(`Maps ready in ${Math.round(performance.now() - started)} ms!`);
const app = startServer({ port, origins, map, maps, log });
log(`WebSocket up at ws://127.0.0.1:${app.server.port}/ws`);
log(`Health check up at http://127.0.0.1:${app.server.port}/healthz`);
log(`Tick rate set to ${TICK_RATE} Hz with protocol v${PROTOCOL_VERSION}`);
log(`Allowed browser origins - ${origins.join(", ")}`);
log("Online lobbies ready; browse public rooms or join with a six-digit PIN");
log("Ready to rumble!");
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const stoppedAt = performance.now();
    log(`${signal} received, shutting down`);
    const deadline = setTimeout(() => {
      console.error("Multiplayer shutdown timed out");
      process.exit(1);
    }, 5000);
    deadline.unref();
    void app.stop().then(
      () => {
        log(`Shutdown finished in ${Math.round(performance.now() - stoppedAt)} ms!`);
        process.exit(0);
      },
      (error: unknown) => {
        console.error("Multiplayer shutdown failed!", error);
        process.exit(1);
      },
    );
  });
