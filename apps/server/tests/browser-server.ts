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
    if (command.op === "rich") for (const player of room.players.values()) player.money = 10000;
    if (command.op === "at-buy") {
      room.state.phase = "freeze";
      room.state.remaining = 1000;
      room.state.buyRemaining = 1000;
      for (const player of room.players.values()) {
        const point = map.spawns[player.team][0];
        Object.assign(player, {
          x: point[0],
          y: map.collision.floor(point[0], point[2], point[1] + 0.5),
          z: point[2],
          vx: 0,
          vz: 0,
          vertical: 0,
          cooldown: 0,
          health: 100,
          blind: 0,
        });
      }
    }
    if (command.op === "duel") {
      const nav = await Bun.file(
        new URL("../../../packages/assets/public/models/maps/dust2-nav.json", import.meta.url),
      ).json();
      const point = nav.sites[1],
        floor = map.collision.floor(point[0], point[2], point[1] + 0.5);
      const ct = [...room.players.values()].find((p) => p.team === "ct")!;
      const t = [...room.players.values()].find((p) => p.team === "t")!;
      let yaw = 0;
      const { Vector3, Ray } = await import("three");
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8,
          direction = new Vector3(-Math.sin(angle), 0, -Math.cos(angle));
        const from = new Vector3(point[0], floor + 1.65, point[2]);
        const x = point[0] + direction.x * 3,
          z = point[2] + direction.z * 3;
        if (
          !map.collision.intersections(new Ray(from, direction), 4).length &&
          Math.abs(map.collision.floor(x, z, floor + 0.5) - floor) < 0.05
        ) {
          yaw = angle;
          break;
        }
      }
      Object.assign(ct, {
        x: point[0],
        y: floor,
        z: point[2],
        yaw,
        pitch: 0,
        health: 100,
        vx: 0,
        vz: 0,
        vertical: 0,
        cooldown: 0,
      });
      Object.assign(t, {
        x: ct.x - Math.sin(yaw) * 3,
        y: floor,
        z: ct.z - Math.cos(yaw) * 3,
        yaw: Math.atan2(Math.sin(yaw + Math.PI), Math.cos(yaw + Math.PI)),
        pitch: 0,
        health: 100,
        vx: 0,
        vz: 0,
        vertical: 0,
        cooldown: 0,
      });
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
