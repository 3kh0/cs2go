import { afterEach, expect, test, vi } from "vitest";
import { neutralInput, PROTOCOL_VERSION, type ServerMessage } from "@cs2go/protocol";
import { createPlayer, createMatch, STEP } from "@cs2go/simulation/match";
import { testMap } from "@cs2go/simulation/test-map";
import { movePlayer } from "@cs2go/simulation/movement";
import { MatchConnection } from "./multiplayer-connection";

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
  const connection = new MatchConnection(
    "ws://localhost/ws",
    "test-room-123",
    "Player",
    "casual",
    "ct",
    testMap(),
    "",
    () => {},
    () => {},
  );
  const socket = connection.socket as unknown as TestSocket;
  socket.receive({
    type: "welcome",
    version: PROTOCOL_VERSION,
    id: "player",
    room: "test-room-123",
    map: "dust2",
    mode: "casual",
  });
  const player = createPlayer("player", "Player", "ct");
  Object.assign(player, { x: -17, z: 17, spawn: 1 });
  socket.receive({
    type: "snapshot",
    tick: 0,
    players: [player],
    events: [],
    round: { ...createMatch("casual", testMap()).state, phase: "live" },
  });
  return { connection, socket, player };
}
test("latency reconciliation replays only unacknowledged movement and clears old prediction at respawn", () => {
  const { connection, socket, player } = setup();
  const input = { ...neutralInput(), forward: 1 };
  for (let index = 0; index < 4; index++) connection.step(input);
  const predictedZ = connection.local!.z;
  for (let index = 0; index < 2; index++) movePlayer(player, input, STEP, testMap());
  player.ack = 2;
  socket.receive({
    type: "snapshot",
    tick: 2,
    players: [player],
    events: [],
    round: { ...createMatch("casual", testMap()).state, phase: "live" },
  });
  expect(connection.local!.z).toBe(predictedZ);
  expect(connection.pending).toHaveLength(2);
  const respawned = { ...player, x: 17, z: -17, vx: 0, vz: 0, spawn: 2 };
  socket.receive({
    type: "snapshot",
    tick: 6,
    players: [respawned],
    events: [],
    round: { ...createMatch("casual", testMap()).state, phase: "live" },
  });
  socket.receive({
    type: "snapshot",
    tick: 10,
    players: [respawned],
    events: [],
    round: { ...createMatch("casual", testMap()).state, phase: "live" },
  });
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
  expect(packet.inputs).toHaveLength(1);
  expect(JSON.parse(socket.sent[1])).toEqual({ type: "stop" });
  connection.close();
});

test("waiting movement is predicted and replayed until the round starts", () => {
  const { connection, socket, player } = setup();
  const round = createMatch("casual", testMap()).state;
  socket.receive({ type: "snapshot", tick: 1, players: [player], events: [], round });
  const input = { ...neutralInput(), forward: 1 };
  const start = player.z;
  for (let i = 0; i < 4; i++) connection.step(input);
  const predicted = connection.local!.z;
  expect(predicted).toBeLessThan(start);
  movePlayer(player, input, STEP, testMap());
  player.ack = 1;
  socket.receive({ type: "snapshot", tick: 2, players: [player], events: [], round });
  expect(connection.local!.z).toBe(predicted);
  connection.close();
});

test("a temporary acknowledgement stall bounds input and resumes without disconnecting", () => {
  const { connection, socket, player } = setup();
  for (let i = 0; i < 256; i++) connection.step({ ...neutralInput(), forward: 1 });
  expect(socket.readyState).toBe(TestSocket.OPEN);
  expect(connection.pending).toHaveLength(128);
  player.ack = 128;
  socket.receive({
    type: "snapshot",
    tick: 128,
    players: [player],
    events: [],
    round: { ...createMatch("casual", testMap()).state, phase: "live" },
  });
  expect(connection.step({ ...neutralInput(), forward: 1 })).toBe(true);
  expect(connection.pending).toHaveLength(1);
  connection.close();
});
