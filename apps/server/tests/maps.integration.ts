// Test map negotiation on Bun's real transport with deliberately distinct fixture spawns.
// Native Mirage rendering/navigation are verified by the browser map integration tests.
import assert from "node:assert/strict";
import { startServer } from "../src/server";
import { testMap } from "@cs2go/simulation/test-map";
import { PROTOCOL_VERSION, type MapId, type ServerMessage } from "@cs2go/protocol";
const mirage = {
  ...testMap(),
  id: "mirage" as const,
  triggers: { zones: [], sites: [] },
  spawns: { ct: [[70, 0, 40]], t: [[-70, 0, -40]] },
};
const app = startServer({
  map: testMap(),
  maps: { mirage },
  port: 0,
  hostname: "127.0.0.1",
  origins: ["http://localhost:5173"],
});
const origin = `http://127.0.0.1:${app.server.port}`;
const sockets: WebSocket[] = [];
async function until(predicate: () => boolean) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    assert(performance.now() < deadline, "map handshake timed out");
    await Bun.sleep(10);
  }
}
async function join(map: MapId, room = "", resume?: string, endpoint = origin) {
  const messages: ServerMessage[] = [];
  const socket = new WebSocket(endpoint.replace("http:", "ws:") + "/ws", {
    headers: { Origin: "http://localhost:5173" },
  });
  sockets.push(socket);
  socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)) as ServerMessage);
  await until(() => socket.readyState === WebSocket.OPEN);
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      name: "PLAYER",
      mode: "casual",
      team: "ct",
      map,
      room,
      create: !room,
      resume,
    }),
  );
  await until(() =>
    messages.some((message) => message.type === "welcome" || message.type === "error"),
  );
  return { socket, messages, welcome: messages.find((message) => message.type === "welcome") };
}
try {
  const health = await fetch(origin + "/healthz", { headers: { Origin: "http://localhost:5173" } });
  assert.equal(health.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  assert.deepEqual(await health.json(), {
    ok: true,
    version: PROTOCOL_VERSION,
    map: "dust2",
    maps: ["dust2", "mirage"],
    publicLobbies: true,
  });
  const restricted = startServer({
    map: testMap(),
    port: 0,
    hostname: "127.0.0.1",
    origins: ["http://localhost:5173"],
  });
  try {
    const unavailable = await join(
      "mirage",
      "",
      undefined,
      `http://127.0.0.1:${restricted.server.port}`,
    );
    assert(
      unavailable.messages.some(
        (message) => message.type === "error" && message.message.includes("not available"),
      ),
    );
    assert.equal(restricted.rooms.size, 0);
  } finally {
    await restricted.stop();
  }
  const dust = await join("dust2");
  const peer = await join("mirage");
  assert.equal(dust.welcome?.map, "dust2");
  assert.equal(peer.welcome?.map, "mirage");
  assert.notEqual(dust.welcome?.room, peer.welcome?.room);
  const room = app.rooms.get(peer.welcome!.room)!;
  assert.equal(room.map, mirage);
  assert.equal(room.players.get(peer.welcome!.id)!.x, 70);
  const metadata = await fetch(origin + `/lobbies/${peer.welcome!.room}`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.deepEqual(await metadata.json(), { map: "mirage", mode: "casual" });
  const wrong = await join("dust2", peer.welcome!.room);
  assert.equal(wrong.welcome, undefined);
  assert(
    wrong.messages.some(
      (message) => message.type === "error" && message.message.includes("different map"),
    ),
  );
  assert.equal(room.players.size, 1);
  const joined = await join("mirage", peer.welcome!.room);
  assert.equal(joined.welcome?.map, "mirage");
  assert.equal(room.players.size, 2);
  peer.socket.close(4000, "Snapshot timeout");
  await until(() => peer.socket.readyState === WebSocket.CLOSED);
  const recovered = await join("mirage", peer.welcome!.room, peer.welcome!.resume);
  assert.equal(recovered.welcome?.id, peer.welcome!.id);
  assert.equal(recovered.welcome?.map, "mirage");
  assert.equal(room.players.size, 2);
  console.log(
    "Map transport integration passed: discovery, separate map lobbies, authoritative map identity, mismatched-map rejection, reconnect.",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
