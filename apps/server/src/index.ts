import { PROTOCOL_VERSION, TICK_RATE } from "@cs2go/protocol";
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
log("Loading Dust II...");
const map = await loadServerMap();
log(`Dust II ready in ${Math.round(performance.now() - started)} ms!`);
const app = startServer({ port, origins, password: process.env.ROOM_PASSWORD, map, log });
log(`WebSocket up at ws://127.0.0.1:${app.server.port}/ws`);
log(`Health check up at http://127.0.0.1:${app.server.port}/healthz`);
log(`Tick rate set to ${TICK_RATE} Hz with protocol v${PROTOCOL_VERSION}`);
log(`Allowed browser origins - ${origins.join(", ")}`);
log(`Room password ${process.env.ROOM_PASSWORD ? "required" : "not required"}`);
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
