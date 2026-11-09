// Real Bun transport: break inputs remain authoritative, and snapshots carry
// persistent obstruction state across late joins, room isolation and resets.
import assert from "node:assert/strict";
import * as T from "three";
import { startServer } from "../src/server";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { bindBreakablePhysics, type NativeBreakableDefinition } from "@cs2go/simulation/breakables";
import { startRound } from "@cs2go/simulation/match";
import {
  PROTOCOL_VERSION,
  neutralInput,
  SnapshotDecoder,
  type ServerMessage,
} from "@cs2go/protocol";
const scene = new T.Group();
const floor = new T.Mesh(
  new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new T.MeshBasicMaterial(),
);
const pane = new T.Mesh(new T.BoxGeometry(2, 2.6, 0.05), new T.MeshBasicMaterial());
pane.name = "source_window";
pane.position.y = 1.3;
pane.userData.bulletMaterial = "glass";
scene.add(floor, pane);
const definitions: NativeBreakableDefinition[] = [
  {
    id: "native:window",
    health: 1,
    material: "glass",
    bounds: [
      [-1, 0, -0.025],
      [1, 2.6, 0.025],
    ],
    physicsNames: [pane.name],
    renderNames: ["native_window_render"],
  },
];
bindBreakablePhysics(scene, definitions);
scene.updateMatrixWorld(true);
const map = {
  id: "mirage" as const,
  collision: new MapCollision([floor, pane]),
  breakableDefinitions: definitions,
  triggers: { zones: [], sites: [] },
  spawns: { ct: [[0, 0, 2]], t: [[5, 0, 2]] },
};
const app = startServer({
  map,
  port: 0,
  hostname: "127.0.0.1",
  origins: ["http://localhost:5173"],
});
const sockets: WebSocket[] = [];
async function until(check: () => boolean, label: string) {
  const end = performance.now() + 5000;
  while (!check()) {
    assert(performance.now() < end, label);
    await Bun.sleep(10);
  }
}
async function join(room = "") {
  const socket = new WebSocket(`ws://127.0.0.1:${app.server.port}/ws`, {
    headers: { Origin: "http://localhost:5173" },
  });
  sockets.push(socket);
  const decoder = new SnapshotDecoder();
  const messages: ServerMessage[] = [];
  socket.onmessage = (e) => {
    const message = decoder.decode(JSON.parse(String(e.data)));
    if (message) messages.push(message);
  };
  await until(() => socket.readyState === WebSocket.OPEN, "socket opens");
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      map: "mirage",
      mode: "casual",
      team: "ct",
      name: "TEST",
      room,
      create: !room,
    }),
  );
  await until(() => messages.some((m) => m.type === "welcome"), "welcome");
  const welcome = messages.find((m) => m.type === "welcome")!;
  const latest = () =>
    messages
      .filter((m): m is Extract<ServerMessage, { type: "snapshot" }> => m.type === "snapshot")
      .at(-1);
  return { socket, messages, welcome, latest };
}
try {
  const actor = await join();
  const room = app.rooms.get(actor.welcome.room)!;
  await until(() => !!actor.latest(), "initial snapshot");
  const player = room.players.get(actor.welcome.id)!;
  Object.assign(player, { x: 0, y: 0, z: 2, yaw: 0, pitch: 0, cooldown: 0 });
  actor.socket.send(
    JSON.stringify({ type: "inputs", inputs: [{ ...neutralInput(1), fire: true }] }),
  );
  await until(
    () => actor.latest()?.round.breakables?.[0]?.health === 0,
    "server bullet breaks native object",
  );
  assert.equal(room.breakables.health("native:window"), 0);
  assert(room.map.collision.visible(new T.Vector3(0, 1.6, 2), new T.Vector3(0, 1.6, -2)));
  const observer = await join(actor.welcome.room);
  await until(() => !!observer.latest(), "late join snapshot");
  assert.equal(observer.latest()!.round.breakables?.[0]?.health, 0);
  const isolated = await join();
  await until(() => !!isolated.latest(), "isolated snapshot");
  assert.equal(isolated.latest()!.round.breakables?.[0]?.health, 1);
  assert.equal(map.collision.visible(new T.Vector3(0, 1.6, 2), new T.Vector3(0, 1.6, -2)), false);
  startRound(room);
  await until(() => actor.latest()?.round.breakables?.[0]?.health === 1, "round reset replicated");
  assert.equal(
    room.map.collision.visible(new T.Vector3(0, 1.6, 2), new T.Vector3(0, 1.6, -2)),
    false,
  );
  console.log(
    "Breakable server integration passed: input authority, physical opening, persistent late join state, isolated rooms, reset",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
