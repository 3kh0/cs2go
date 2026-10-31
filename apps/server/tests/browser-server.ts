// Local-only browser fixture controls. This file is never bundled into the server.
import { startServer } from "../src/server";
import { loadServerMap } from "../src/map";
const map = await loadServerMap();
const app = startServer({
  port: 3002,
  hostname: "127.0.0.1",
  origins: ["http://127.0.0.1:5173", "http://127.0.0.1:5183"],
  map,
});
const control = Bun.serve({
  port: 3004,
  hostname: "127.0.0.1",
  async fetch(request) {
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    const command = (await request.json()) as { room: string; op: string };
    const room = app.rooms.get(command.room);
    if (!room) return new Response("Missing room", { status: 404 });
    if (command.op === "live") {
      room.state.phase = "live";
      room.state.remaining = 100;
    }
    if (command.op === "kill-ct") {
      const victim = [...room.players.values()].find((p) => p.team === "ct")!;
      const killer = [...room.players.values()].find((p) => p.team === "t")!;
      victim.health = 0;
      victim.deaths++;
      killer.kills++;
      room.events.push({
        kind: "kill",
        killer: killer.id,
        victim: victim.id,
        headshot: false,
        weapon: killer.weapon,
      });
    }
    if (command.op === "timeout") {
      room.state.phase = "live";
      room.state.remaining = 0.001;
    }
    if (command.op === "reset") {
      room.state.pause = 0.001;
    }
    if (command.op === "plant") {
      const nav = await Bun.file(
        new URL("../../../packages/assets/public/models/maps/dust2-nav.json", import.meta.url),
      )
        .json()
        .catch(() => null);
      // The native NAV site's known interior point is shared with the single-player bomb fixture.
      const sites = nav?.sites;
      if (!sites) return new Response("No site", { status: 500 });
      const p = [...room.players.values()].find((p) => p.team === "t")!;
      const site = sites[1];
      p.x = site[0];
      p.z = site[2];
      p.y = map.collision.floor(p.x, p.z, site[1] + 0.5);
      p.vx = p.vz = p.vertical = 0;
      p.grounded = true;
      room.state.bomb.carrier = p.id;
      room.state.phase = "live";
      room.state.remaining = 100;
    }
    if (command.op === "defuse") {
      const p = [...room.players.values()].find((p) => p.team === "ct")!,
        bomb = room.state.bomb;
      p.x = bomb.x + 0.8;
      p.y = bomb.y;
      p.z = bomb.z;
      p.vx = p.vz = p.vertical = 0;
      p.kit = true;
      bomb.timer = 20;
    }
    return Response.json({ state: room.state, players: [...room.players.values()] });
  },
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.stop();
    void control.stop(true);
  });
