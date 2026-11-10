import assert from "node:assert/strict";
import * as T from "three";
import { startServer } from "../src/server";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { bindDoorPhysics, type NativeDoorDefinition } from "@cs2go/simulation/doors";
import { startRound } from "@cs2go/simulation/match";
import {
  PROTOCOL_VERSION,
  neutralInput,
  SnapshotDecoder,
  type ServerMessage,
} from "@cs2go/protocol";

const root = new T.Group(),
  floor = new T.Mesh(new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2)),
  leaf = new T.Mesh(new T.BoxGeometry(2, 2.4, 0.12).translate(1, 1.2, 0));
leaf.name = "native_leaf";
root.add(floor, leaf);
const definitions: NativeDoorDefinition[] = [
  {
    id: "door",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: [leaf.name],
    renderNames: ["render_leaf"],
  },
];
const physics = bindDoorPhysics(root, definitions),
  map = {
    id: "mirage" as const,
    collision: new MapCollision([floor, leaf]),
    doorDefinitions: definitions,
    doorPhysics: physics,
    triggers: { zones: [], sites: [] },
    spawns: { ct: [[5, 0, 2]], t: [[1, 0, 1]] },
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
  const decoder = new SnapshotDecoder(),
    messages: ServerMessage[] = [];
  socket.onmessage = (event) => {
    const message = decoder.decode(JSON.parse(String(event.data)));
    if (message) messages.push(message);
  };
  await until(() => socket.readyState === WebSocket.OPEN, "socket opens");
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      map: "mirage",
      mode: "casual",
      team: "t",
      name: "TEST",
      room,
      create: !room,
    }),
  );
  await until(() => messages.some((message) => message.type === "welcome"), "welcome");
  const welcome = messages.find((message) => message.type === "welcome")!;
  const latest = () =>
    messages
      .filter(
        (message): message is Extract<ServerMessage, { type: "snapshot" }> =>
          message.type === "snapshot",
      )
      .at(-1);
  return { socket, welcome, latest };
}
try {
  const player = await join(),
    room = app.rooms.get(player.welcome.room)!;
  await until(() => !!player.latest(), "initial snapshot");
  for (let batch = 0; batch < 8; batch++) {
    player.socket.send(
      JSON.stringify({
        type: "inputs",
        inputs: Array.from({ length: 8 }, (_, index) => ({
          ...neutralInput(batch * 8 + index + 1),
          interact: true,
          pickup: true,
        })),
      }),
    );
    await Bun.sleep(64);
  }
  await until(
    () => (player.latest()?.round.doors?.[0].angle ?? 0) > 89,
    "T use opens real rotated server collision",
  );
  assert.equal(room.doors.states[0].target, 90);
  assert(room.map.collision.visible(new T.Vector3(1, 1, 1), new T.Vector3(1, 1, -2)));
  const late = await join(player.welcome.room);
  await until(() => !!late.latest(), "late join snapshot");
  assert.equal(late.latest()!.round.doors![0].angle, 90);
  const other = await join();
  await until(() => !!other.latest(), "isolated room snapshot");
  assert.equal(other.latest()!.round.doors![0].angle, 0);
  assert.equal(map.collision.visible(new T.Vector3(1, 1, 1), new T.Vector3(1, 1, -2)), false);
  startRound(room);
  await until(() => player.latest()?.round.doors?.[0].angle === 0, "reset replicated");
  assert.equal(room.map.collision.visible(new T.Vector3(1, 1, 1), new T.Vector3(1, 1, -2)), false);
  console.log(
    "Door server integration passed: T use, held-input edge, rotated collision, late join, room isolation and reset",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
