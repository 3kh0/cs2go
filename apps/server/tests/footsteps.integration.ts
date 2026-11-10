import assert from "node:assert/strict";
import * as T from "three";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { startServer } from "../src/server";
import { testMap } from "@cs2go/simulation/test-map";
import {
  neutralInput,
  PROTOCOL_VERSION,
  SnapshotDecoder,
  type ServerMessage,
  type MatchEvent,
} from "@cs2go/protocol";
const map = testMap();
map.id = "mirage";
map.triggers = { zones: [], sites: [] };
const floor = new T.Mesh(new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2));
floor.userData.SurfaceProperty = "metalgrate";
map.collision = new MapCollision([floor]);
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
async function join(room = "", team: "ct" | "t" = "t") {
  const socket = new WebSocket(`ws://127.0.0.1:${app.server.port}/ws`, {
    headers: { Origin: "http://localhost:5173" },
  });
  sockets.push(socket);
  const decoder = new SnapshotDecoder();
  const messages: ServerMessage[] = [],
    events: MatchEvent[] = [];
  socket.onmessage = (event) => {
    const message = decoder.decode(JSON.parse(String(event.data)));
    if (!message) return;
    messages.push(message);
    if (message.type === "snapshot") events.push(...message.events);
  };
  await until(() => socket.readyState === WebSocket.OPEN, "socket opens");
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      map: "mirage",
      mode: "casual",
      team,
      name: "TEST",
      room,
      create: !room,
    }),
  );
  await until(() => messages.some((message) => message.type === "welcome"), "welcome");
  const welcome = messages.find((message) => message.type === "welcome")!;
  return { socket, welcome, events };
}
try {
  const actor = await join(),
    observer = await join(actor.welcome.room, "ct"),
    isolated = await join();
  const room = app.rooms.get(actor.welcome.room)!;
  room.state.phase = "live";
  room.state.remaining = 100;
  const send = async (walk: boolean, base: number) => {
    for (let batch = 0; batch < 16; batch++) {
      actor.socket.send(
        JSON.stringify({
          type: "inputs",
          inputs: Array.from({ length: 8 }, (_, index) => ({
            ...neutralInput(base + batch * 8 + index + 1),
            forward: 1,
            walk,
          })),
        }),
      );
      await Bun.sleep(64);
    }
    await Bun.sleep(150);
  };
  await send(false, 0);
  const steps = observer.events.filter((event) => event.kind === "footstep");
  assert(steps.length >= 2, "remote receives authoritative running footsteps");
  assert.deepEqual(
    steps.slice(0, 2).map((event) => event.side),
    ["left", "right"],
  );
  assert(
    steps.every(
      (event) =>
        event.actor === actor.welcome.id && event.team === "t" && event.surface === "metalgrate",
    ),
    "source surface/team carried by typed snapshot transport",
  );
  assert(
    !isolated.events.some((event) => event.kind === "footstep"),
    "footsteps never cross rooms",
  );
  const count = steps.length;
  await send(true, 128);
  assert.equal(
    observer.events.filter((event) => event.kind === "footstep").length,
    count,
    "held quiet walk has no remote footsteps",
  );
  console.log(
    "Authoritative footstep transport: source surface, alternating feet, quiet walk and room isolation passed",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
