// Exercise Bun's real HTTP/WebSocket runtime rather than mocking its upgrade API.
import assert from "node:assert/strict";
import { loadServerMap } from "../src/map";
import { startServer } from "../src/server";
import {
  PROTOCOL_VERSION,
  neutralInput,
  SnapshotDecoder,
  type PlayerState,
  type ServerMessage,
} from "@cs2go/protocol";
const app = startServer({
  map: await loadServerMap(),
  port: 0,
  hostname: "127.0.0.1",
  origins: ["http://localhost:5173"],
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
  room = "",
  create = true,
  team: "ct" | "t" = "ct",
  resume?: string,
) {
  const socket = new WebSocket(origin.replace("http:", "ws:") + "/ws", {
    headers: { Origin: "http://localhost:5173" },
  });
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  const decoder = new SnapshotDecoder();
  socket.onmessage = (event) => {
    const message = decoder.decode(JSON.parse(String(event.data)));
    assert(message, "valid server frame");
    messages.push(message);
  };
  await until(() => socket.readyState === WebSocket.OPEN, "open");
  socket.send(
    JSON.stringify({
      type: "join",
      resume,
      version: PROTOCOL_VERSION,
      room,
      name,
      create,
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
  const wrong = await client("Unknown PIN", "000000", false);
  await until(() => wrong.socket.readyState === WebSocket.CLOSED, "unknown PIN rejection");
  assert(
    wrong.messages.some(
      (message) => message.type === "error" && message.message.includes("Lobby not found"),
    ),
  );
  assert.equal(app.rooms.size, 0);
  const a = await client("Alpha");
  await until(() => a.messages.some((m) => m.type === "welcome"), "lobby created");
  const code = a.messages.find((m) => m.type === "welcome")!.room;
  assert.match(code, /^\d{6}$/);
  const metadata = await fetch(origin + `/lobbies/${code}`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(metadata.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(((await metadata.json()) as { mode: string }).mode, "casual");
  const b = await client("Bravo", code, false, "t");
  await until(() => a.players().length === 2 && b.players().length === 2, "two peers");
  const aId = a.messages.find((message) => message.type === "welcome")!.id;
  const bId = b.messages.find((message) => message.type === "welcome")!.id;
  const shared = app.rooms.get(code)!;
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
  const room = app.rooms.get(code)!;
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
  const isolated = await client("Isolated");
  await until(() => isolated.players().length === 1, "isolated room");
  assert.equal(a.players().length, 2);
  const full = await client("Overflow");
  await until(() => full.socket.readyState === WebSocket.CLOSED, "lobby capacity");
  assert(full.messages.some((m) => m.type === "error" && m.message === "Server full"));
  assert.equal(app.rooms.size, 2);
  const ally = await client("Ally", code, false);
  await until(() => ally.players().length === 3, "chat teammate joined");
  const chatMessages = (peer: typeof a) =>
    peer.messages.filter((message) => message.type === "chat");
  a.socket.send(
    JSON.stringify({
      type: "chat",
      channel: "team",
      text: "  Hold A  ",
      sender: bId,
      name: "Impostor",
      team: "t",
    }),
  );
  await until(() => chatMessages(ally).length === 1, "team chat delivered");
  assert.deepEqual(chatMessages(a), [
    { type: "chat", channel: "team", sender: aId, name: "Alpha", team: "ct", text: "Hold A" },
  ]);
  assert.deepEqual(chatMessages(ally), chatMessages(a));
  assert.equal(chatMessages(b).length, 0);
  assert.equal(chatMessages(isolated).length, 0);
  a.socket.send(JSON.stringify({ type: "chat", channel: "all", text: "Spam" }));
  await until(
    () => a.messages.some((message) => message.type === "chat-status"),
    "chat rate limited",
  );
  assert.equal(a.socket.readyState, WebSocket.OPEN);
  b.socket.send(JSON.stringify({ type: "chat", channel: "all", text: "Good luck" }));
  await until(
    () => chatMessages(a).length === 2 && chatMessages(ally).length === 2,
    "all chat delivered",
  );
  assert.equal(chatMessages(b).at(-1)?.text, "Good luck");
  assert.equal(chatMessages(isolated).length, 0);
  assert.equal(
    chatMessages(a).some((message) => message.text === "Spam"),
    false,
  );
  // Team routing follows authoritative team changes, including halftime.
  const allyId = ally.messages.find((message) => message.type === "welcome")!.id;
  room.players.get(allyId)!.team = "t";
  room.players.get(bId)!.team = "ct";
  await Bun.sleep(800);
  a.socket.send(JSON.stringify({ type: "chat", channel: "team", text: "New teams" }));
  await until(() => chatMessages(b).length === 2, "team chat follows current team");
  assert.equal(chatMessages(ally).length, 2);
  assert.equal(chatMessages(isolated).length, 0);
  ally.socket.close();
  await until(() => a.players().length === 2, "chat teammate left");
  const isolatedWelcome = isolated.messages.find((message) => message.type === "welcome")!;
  const isolatedRoom = app.rooms.get(isolatedWelcome.room)!;
  isolatedRoom.players.get(isolatedWelcome.id)!.money = 3210;
  isolated.socket.send(JSON.stringify({ type: "team", team: "t" }));
  await until(() => isolated.players()[0]?.team === "t", "authoritative team change");
  assert.equal(isolated.players()[0].id, isolatedWelcome.id);
  assert.equal(isolated.players()[0].money, 3210);
  assert.equal(isolated.players()[0].health, 100);

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

  const welcome = isolated.messages.find((message) => message.type === "welcome")!;
  const isolatedCode = welcome.room;
  assert.notEqual(isolatedCode, code);
  const preserved = app.rooms.get(isolatedCode)!.players.get(welcome.id)!;
  preserved.money = 1234;
  isolated.socket.close(4000, "Snapshot timeout");
  await until(() => isolated.socket.readyState === WebSocket.CLOSED, "interruption");
  const recovered = await client("Isolated", isolatedCode, false, "ct", welcome.resume);
  await until(() => recovered.players().length === 1, "session recovered");
  const recoveredWelcome = recovered.messages.find((message) => message.type === "welcome")!;
  assert.equal(recoveredWelcome.id, welcome.id);
  assert.notEqual(recoveredWelcome.resume, welcome.resume);
  assert.equal(recovered.players()[0].money, 1234);
  recovered.socket.send(JSON.stringify({ type: "inputs", inputs: [neutralInput(1)] }));
  await until(() => recovered.players()[0]?.ack === 1, "fresh sequence after recovery");
  const takeover = await client("Isolated", isolatedCode, false, "ct", recoveredWelcome.resume);
  await until(() => takeover.players().length === 1, "half-open session takeover");
  assert.equal(takeover.players()[0].id, welcome.id);
  await until(() => recovered.socket.readyState === WebSocket.CLOSED, "old transport retired");
  takeover.socket.close();

  // A repeated sequence cannot replay commands or accelerate simulation.
  a.socket.send(JSON.stringify({ type: "inputs", inputs: [neutralInput(49)] }));
  await until(() => a.socket.readyState === WebSocket.CLOSED, "duplicate sequence rejected");
  b.socket.close();
  isolated.socket.close();
  await until(() => app.rooms.size === 0, "empty room cleanup");
  console.log(
    "Multiplayer integration passed: health, origins, lobby creation and PINs, two clients, movement, damage, room isolation, replay rejection, cleanup.",
  );
} finally {
  for (const socket of sockets) socket.close();
  await app.stop();
}
