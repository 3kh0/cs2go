import assert from "node:assert/strict";
import { loadServerMap } from "../src/map";
import { startServer } from "../src/server";
import { PROTOCOL_VERSION, type PublicLobby, type ServerMessage } from "@cs2go/protocol";

const allowed = "http://localhost:5173";
const app = startServer({
  map: await loadServerMap(),
  port: 0,
  hostname: "127.0.0.1",
  origins: [allowed],
});
const url = `http://127.0.0.1:${app.server.port}`;
const sockets: WebSocket[] = [];
async function until(predicate: () => boolean) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Lobby integration timed out");
    await Bun.sleep(10);
  }
}
async function client(
  name: string,
  room = "",
  visibility?: "public" | "private",
  team: "ct" | "t" = "ct",
) {
  const socket = new WebSocket(url.replace("http:", "ws:") + "/ws", {
    headers: { Origin: allowed },
  });
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  socket.onmessage = (event) => {
    messages.push(JSON.parse(String(event.data)));
  };
  await until(() => socket.readyState === WebSocket.OPEN);
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      create: !room,
      room,
      name,
      mode: "casual",
      team,
      visibility,
    }),
  );
  await until(() =>
    messages.some((message) => message.type === "welcome" || message.type === "error"),
  );
  return { socket, messages, pin: messages.find((message) => message.type === "welcome")?.room };
}
async function list() {
  const response = await fetch(url + "/lobbies", { headers: { Origin: allowed } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), allowed);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return ((await response.json()) as { lobbies: PublicLobby[] }).lobbies;
}
try {
  assert.equal(
    (await fetch(url + "/lobbies", { headers: { Origin: "https://wrong.invalid" } })).status,
    403,
  );
  assert.equal(
    (
      (await fetch(url + "/healthz").then((response) => response.json())) as {
        publicLobbies: boolean;
      }
    ).publicLobbies,
    true,
  );
  assert.deepEqual(await list(), []);
  const privateRoom = await client("Private host");
  assert(privateRoom.pin);
  assert.deepEqual(await list(), [], "default private PIN must not appear");
  const publicRoom = await client("Public host", "", "public");
  assert(publicRoom.pin);
  let listing = await list();
  assert.equal(listing.length, 1);
  assert.equal(listing[0].room, publicRoom.pin);
  assert.equal(listing[0].name, "Public host's lobby");
  assert.deepEqual(listing[0].teams, { ct: 1, t: 0 });
  assert.equal(listing[0].players, 1);
  assert.equal(listing[0].capacity, 20);
  assert(!JSON.stringify(listing).includes(privateRoom.pin));
  const guest = await client("Guest", publicRoom.pin, undefined, "t");
  assert.equal(guest.pin, publicRoom.pin);
  listing = await list();
  assert.equal(listing[0].players, 2);
  assert.deepEqual(listing[0].teams, { ct: 1, t: 1 });
  const invalid = await client("Cannot publish", privateRoom.pin, "public", "t");
  assert(invalid.messages.some((message) => message.type === "error"));
  assert.equal((await list()).length, 1, "joining cannot publish a private room");
  const match = app.rooms.get(publicRoom.pin!)!;
  match.state.phase = "finished";
  assert.deepEqual(await list(), [], "finished matches are not advertised as joinable");
  match.state.phase = "waiting";
  guest.socket.close(1000);
  await until(() => app.rooms.get(publicRoom.pin!)?.players.size === 1);
  assert.equal((await list())[0].players, 1);
  publicRoom.socket.close(1000);
  await until(() => !app.rooms.has(publicRoom.pin!));
  assert.deepEqual(await list(), [], "closed public room disappears");
  console.log("Public lobby creation, privacy, listing, join and cleanup passed");
} finally {
  for (const socket of sockets) socket.close(1000);
  await app.stop();
}
