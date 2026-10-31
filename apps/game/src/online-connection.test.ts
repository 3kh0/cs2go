import { afterEach, expect, test, vi } from "vitest";
import { neutralInput, type ServerMessage } from "@cs2go/protocol";
import { createPlayer, STEP } from "@cs2go/simulation/match";
import { movePlayer } from "@cs2go/simulation/movement";
import { OnlineConnection } from "./online-connection";

class TestSocket {
  static OPEN = 1;
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { reason: string }) => void;
  send(data: string) {
    this.sent.push(data);
  }
  close(_code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.({ reason });
  }
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", TestSocket);
  const connection = new OnlineConnection(
    "ws://localhost/ws",
    "test-room-123",
    "Player",
    "",
    () => {},
    () => {},
  );
  const socket = connection.socket as unknown as TestSocket;
  socket.receive({ type: "welcome", version: 1, id: "player", room: "test-room-123", map: "yard" });
  const player = createPlayer("player", "Player", "ct");
  Object.assign(player, { x: -17, z: 17, spawn: 1 });
  socket.receive({ type: "snapshot", tick: 0, players: [player], events: [] });
  return { connection, socket, player };
}
test("latency reconciliation replays only unacknowledged movement and clears old prediction at respawn", () => {
  const { connection, socket, player } = setup();
  const input = { ...neutralInput(), forward: 1 };
  for (let index = 0; index < 4; index++) connection.step(input);
  const predictedZ = connection.local!.z;
  for (let index = 0; index < 2; index++) movePlayer(player, input, STEP);
  player.ack = 2;
  socket.receive({ type: "snapshot", tick: 2, players: [player], events: [] });
  expect(connection.local!.z).toBe(predictedZ);
  expect(connection.pending).toHaveLength(2);
  const respawned = { ...player, x: 17, z: -17, vx: 0, vz: 0, spawn: 2 };
  socket.receive({ type: "snapshot", tick: 6, players: [respawned], events: [] });
  socket.receive({ type: "snapshot", tick: 10, players: [respawned], events: [] });
  expect(connection.local!.z).toBe(-17);
  expect(connection.pending).toHaveLength(0);
  connection.close();
});
test("losing input focus immediately flushes a neutral command even between packet batches", () => {
  const { connection, socket } = setup();
  connection.step({ ...neutralInput(), forward: 1, fire: true });
  expect(socket.sent).toHaveLength(0);
  connection.stopInput();
  const packet = JSON.parse(socket.sent[0]);
  expect(packet.inputs).toHaveLength(2);
  expect(packet.inputs.at(-1)).toMatchObject({ forward: 0, fire: false });
  connection.close();
});
