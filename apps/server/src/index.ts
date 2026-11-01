import { loadServerMap } from "./map";
import { startServer } from "./server";
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const map = await loadServerMap();
const app = startServer({ port, origins, password: process.env.ROOM_PASSWORD, map });
console.log(`CS2GO multiplayer listening on :${app.server.port}`);
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.error("Multiplayer shutdown timed out");
      process.exit(1);
    }, 5000);
    deadline.unref();
    void app.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error("Multiplayer shutdown failed", error);
        process.exit(1);
      },
    );
  });
