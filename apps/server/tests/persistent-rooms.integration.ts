// Always-on lobbies: listed while empty, reset when abandoned, and rotated to a
// different map after a finished match. Also covers online deathmatch rules.
import assert from "node:assert/strict";
import { startServer } from "../src/server";
import { testMap } from "@cs2go/simulation/test-map";
import { deathmatchKillPoints } from "@cs2go/simulation/deathmatch";
import {
  PROTOCOL_VERSION,
  SnapshotDecoder,
  type MapId,
  type MatchMode,
  type PublicLobby,
  type ServerMessage,
} from "@cs2go/protocol";

const allowed = "http://localhost:5173";
const mirage = {
  ...testMap(),
  id: "mirage" as const,
  triggers: { zones: [], sites: [] },
  spawns: { ct: [[70, 0, 40]], t: [[-70, 0, -40]] },
};
const app = startServer({
  map: { ...testMap(), id: "dust2" },
  maps: { mirage },
  port: 0,
  hostname: "127.0.0.1",
  origins: [allowed],
  persistentModes: ["casual", "deathmatch"],
  rotationDelay: 0.2,
  random: () => 0,
  botFill: { casual: 4 },
});
const url = `http://127.0.0.1:${app.server.port}`;
const sockets: WebSocket[] = [];
async function until(predicate: () => boolean, label = "persistent room") {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`${label} timed out`);
    await Bun.sleep(10);
  }
}
async function list() {
  const response = await fetch(url + "/lobbies", { headers: { Origin: allowed } });
  return ((await response.json()) as { lobbies: PublicLobby[] }).lobbies;
}
async function join(room: string, mode: MatchMode, map: MapId, team: "ct" | "t" = "ct") {
  const socket = new WebSocket(url.replace("http:", "ws:") + "/ws", {
    headers: { Origin: allowed },
  });
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  const decoder = new SnapshotDecoder();
  let closed: number | undefined;
  socket.onmessage = (event) => {
    const message = decoder.decode(JSON.parse(String(event.data)));
    if (message) messages.push(message);
  };
  socket.onclose = (event) => (closed = event.code);
  await until(() => socket.readyState === WebSocket.OPEN);
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      room,
      name: `${mode}-${team}`,
      mode,
      map,
      team,
    }),
  );
  await until(() =>
    messages.some((message) => ["welcome", "error", "map-change"].includes(message.type)),
  );
  const snapshot = () =>
    messages.findLast(
      (message): message is Extract<ServerMessage, { type: "snapshot" }> =>
        message.type === "snapshot",
    );
  return { socket, messages, snapshot, closed: () => closed };
}
try {
  const health = (await fetch(url + "/healthz").then((response) => response.json())) as {
    modes: string[];
  };
  assert(health.modes.includes("deathmatch"));
  let lobbies = await list();
  assert.equal(lobbies.length, 2, "persistent rooms are listed while empty");
  assert(lobbies.every((lobby) => lobby.persistent && lobby.players === 0));
  const casual = lobbies.find((lobby) => lobby.mode === "casual")!;
  const deathmatch = lobbies.find((lobby) => lobby.mode === "deathmatch")!;
  assert.equal(deathmatch.map, "dust2", "seeded random picks the first map");

  // Deathmatch: alive on join, armed with a rifle, protected, free-for-all.
  const first = await join(deathmatch.room, "deathmatch", "dust2", "ct");
  const second = await join(deathmatch.room, "deathmatch", "dust2", "ct");
  await until(() => (second.snapshot()?.players.length ?? 0) === 2, "deathmatch snapshot");
  const room = app.rooms.get(deathmatch.room)!;
  assert.equal(room.state.phase, "live");
  const [a, b] = [...room.players.values()];
  assert(a.health > 0 && b.health > 0, "deathmatch joins spawn immediately");
  assert.equal(a.primary, 1, "CT spawns with an M4A1-S");
  assert(a.armor === 100 && a.helmet, "deathmatch grants armor");
  assert(a.protection! > 0, "fresh spawns are protected");
  assert.equal(a.money, 0);
  const { damagePlayer } = await import("@cs2go/simulation/combat");
  assert.deepEqual(damagePlayer(room, b, a, 500, true, 0), [], "spawn protection blocks damage");
  a.protection = 0;
  const events = damagePlayer(room, b, a, 500, true, b.weapon);
  assert(
    events.some((event) => event.kind === "kill"),
    "same-side players can be eliminated",
  );
  assert.equal(b.kills, 1);
  assert.equal(b.score, deathmatchKillPoints(b.weapon));
  assert.equal(room.state.drops.length, 0, "deathmatch deaths drop no weapons");
  await until(() => a.health > 0, "deathmatch respawn");
  assert(a.protection! > 0, "respawns are protected again");
  const { stepMatch } = await import("@cs2go/simulation/match");
  const { neutralInput } = await import("@cs2go/protocol");
  stepMatch(room, new Map([[a.id, { ...neutralInput(), yaw: a.yaw, buy: 3 }]]));
  assert.equal(a.primary, 3, "protected players buy for free anywhere");
  assert.equal(a.money, 0);
  assert(!a.magazines[1], "the replaced rifle is discarded, not dropped");
  assert.equal(room.state.drops.length, 0);
  a.protection = 0;
  stepMatch(room, new Map([[a.id, { ...neutralInput(), yaw: a.yaw, buy: 8 }]]));
  assert.equal(a.secondary, 2, "the buy window closes with spawn protection");

  // A finished persistent match rotates to a different map and keeps its PIN.
  room.state.remaining = 0.01;
  await until(() => first.messages.some((message) => message.type === "map-change"), "rotation");
  const change = first.messages.find((message) => message.type === "map-change")!;
  assert.deepEqual(change, { type: "map-change", map: "mirage", room: deathmatch.room });
  await until(() => first.closed() === 4001 && second.closed() === 4001, "rotation close");
  assert.equal(app.rooms.get(deathmatch.room), room, "persistent room keeps its PIN");
  assert.equal(room.map.id, "mirage");
  assert.equal(room.players.size, 0);
  assert.equal(room.state.phase, "waiting");
  const rejoined = await join(deathmatch.room, "deathmatch", "mirage");
  assert(rejoined.messages.some((message) => message.type === "welcome"));

  // A client loading the old map is redirected instead of rejected.
  const stale = await join(deathmatch.room, "deathmatch", "dust2");
  assert(stale.messages.some((message) => message.type === "map-change"));

  // Abandoned persistent rooms reset in place instead of disappearing.
  const host = await join(casual.room, "casual", casual.map);
  assert(host.messages.some((message) => message.type === "welcome"));
  const casualRoom = app.rooms.get(casual.room)!;
  assert.equal(casualRoom.bots.size, 3, "bots fill the server lobby around a person");
  await until(
    () => host.snapshot()?.players.filter((player) => player.bot).length === 3,
    "bot snapshot",
  );
  const listed = (await list()).find((lobby) => lobby.room === casual.room)!;
  assert.equal(listed.players, 1, "bots are not counted as people");
  assert.equal(listed.bots, 3);
  const guest = await join(casual.room, "casual", casual.map, "t");
  assert(guest.messages.some((message) => message.type === "welcome"));
  assert.equal(casualRoom.bots.size, 2, "a joining person takes a bot's seat");
  guest.socket.close(1000);
  await until(() => casualRoom.bots.size === 3, "bot refill");
  host.socket.close(1000);
  await until(() => app.rooms.get(casual.room)?.players.size === 0, "casual reset");
  assert.equal(casualRoom.bots.size, 0, "bots leave with the last person");
  lobbies = await list();
  assert(lobbies.some((lobby) => lobby.room === casual.room && lobby.persistent));
  console.log("Persistent rooms, map rotation and online deathmatch passed");
} finally {
  for (const socket of sockets) socket.close(1000);
  await app.stop();
}
