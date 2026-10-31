// Exercise Bun's real HTTP/WebSocket runtime rather than mocking its upgrade API.
import assert from "node:assert/strict";
import { loadServerMap } from "../src/map";
import { startServer } from "../src/server";
import {
  PROTOCOL_VERSION,
  neutralInput,
  type PlayerState,
  type ServerMessage,
} from "@cs2go/protocol";
const app = startServer({
  map: await loadServerMap(),
  port: 0,
  hostname: "127.0.0.1",
  origins: ["http://localhost:5173"],
  password: "test-password",
  maxRooms: 2,
});
const origin = `http://127.0.0.1:${app.server.port}`;
const sockets: WebSocket[] = [];
async function until(predicate: () => boolean, label: string) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${label}`);
    await Bun.sleep(10);
  }
}
async function client(
  name: string,
  room = "private-room-123",
  password = "test-password",
  team: "ct" | "t" = "ct",
) {
  const socket = new WebSocket(origin.replace("http:", "ws:") + "/ws", {
    headers: { Origin: "http://localhost:5173" },
  });
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
  await until(() => socket.readyState === WebSocket.OPEN, "open");
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      room,
      name,
      password,
      mode: "casual",
      team,
    }),
  );
  return {
    socket,
    messages,
    players: () => messages.filter((message) => message.type === "snapshot").at(-1)?.players ?? [],
  };
}
try {
  assert.equal((await fetch(origin + "/healthz")).status, 200);
  assert.equal(
    (await fetch(origin + "/ws", { headers: { Origin: "https://evil.invalid" } })).status,
    403,
  );
  const wrong = await client("Bad password", "private-room-123", "incorrect");
  await until(() => wrong.socket.readyState === WebSocket.CLOSED, "password rejection");
  assert.equal(
    wrong.messages.some((message) => message.type === "error"),
    true,
  );
  assert.equal(app.rooms.size, 0);
  const a = await client("Alpha"),
    b = await client("Bravo", "private-room-123", "test-password", "t");
  await until(() => a.players().length === 2 && b.players().length === 2, "two peers");
  const aId = a.messages.find((message) => message.type === "welcome")!.id;
  const bId = b.messages.find((message) => message.type === "welcome")!.id;
  const shared = app.rooms.get("private-room-123")!;
  shared.state.phase = "live";
  shared.state.remaining = 100;
  const before = a.players().find((player) => player.id === aId)!;
  for (let batch = 0; batch < 12; batch++) {
    a.socket.send(
      JSON.stringify({
        type: "inputs",
        inputs: Array.from({ length: 4 }, (_, index) => ({
          ...neutralInput(batch * 4 + index + 1),
          forward: 1,
          x: 9999,
          health: 9999,
        })),
      }),
    );
    await Bun.sleep(32);
  }
  await until(
    () => b.players().some((player) => player.id === aId && player.ack === 48),
    "movement replicated",
  );
  const moved = b.players().find((player) => player.id === aId)!;
  assert(moved.z < before.z - 0.2);
  assert(moved.z > before.z - 3);
  assert.equal(moved.health, 100);
  const room = app.rooms.get("private-room-123")!;
  // Arrange a clear shot; the wire still carries only inputs, never damage.
  const shooter = room.players.get(aId)!,
    victim = room.players.get(bId)!;
  Object.assign(shooter, { x: 4.6, y: -3.08, z: -61, vx: 0, vz: 0, cooldown: 0 });
  Object.assign(victim, { x: 6.5, y: -3.08, z: -61, vx: 0, vz: 0 });
  a.socket.send(
    JSON.stringify({
      type: "inputs",
      inputs: [{ ...neutralInput(49), fire: true, yaw: -Math.PI / 2, pitch: 0.15 }],
    }),
  );
  await until(
    () => b.players().some((player: PlayerState) => player.id === bId && player.health < 100),
    "server damage",
  );
  assert(shooter.ammo < 12);
  assert(
    a.messages.some(
      (message) =>
        message.type === "snapshot" && message.events.some((event) => event.kind === "shot"),
    ),
  );
  const isolated = await client("Isolated", "different-room-123");
  await until(() => isolated.players().length === 1, "isolated room");
  assert.equal(a.players().length, 2);
  // A transport/scheduler stall may release more than 250 ms of valid inputs
  // together. Buffer them, but consume at most one per elapsed simulation tick.
  for (let batch = 0; batch < 8; batch++)
    isolated.socket.send(
      JSON.stringify({
        type: "inputs",
        inputs: Array.from({ length: 8 }, (_, i) => neutralInput(batch * 8 + i + 1)),
      }),
    );
  await until(() => isolated.players()[0]?.ack === 64, "buffered input burst drained");

  // A repeated sequence cannot replay commands or accelerate simulation.
  a.socket.send(JSON.stringify({ type: "inputs", inputs: [neutralInput(49)] }));
  await until(() => a.socket.readyState === WebSocket.CLOSED, "duplicate sequence rejected");
  b.socket.close();
  isolated.socket.close();
  await until(() => app.rooms.size === 0, "empty room cleanup");
  console.log(
    "Multiplayer integration passed: health, origins, passwords, two clients, movement, damage, room isolation, replay rejection, cleanup.",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
