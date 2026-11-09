import { afterEach, expect, test, vi } from "vitest";
import { neutralInput, PROTOCOL_VERSION, type ServerMessage } from "@cs2go/protocol";
import { createPlayer, createMatch, STEP } from "@cs2go/simulation/match";
import { testMap } from "@cs2go/simulation/test-map";
import { movePlayer } from "@cs2go/simulation/movement";
import { BreakableWorld, bindBreakablePhysics } from "@cs2go/simulation/breakables";
import { MapCollision } from "@cs2go/simulation/map-collision";
import * as T from "three";
import { MatchConnection } from "./multiplayer-connection";

class TestSocket {
  static OPEN = 1;
  static CLOSING = 2;
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { reason: string; code: number }) => void;
  send(data: string) {
    this.sent.push(data);
  }
  close(_code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.({ reason, code: _code });
  }
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(map = testMap()) {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", TestSocket);
  const connection = new MatchConnection(
    "ws://localhost/ws",
    "012345",
    "Player",
    "casual",
    "ct",
    map,
    false,
    () => {},
    () => {},
  );
  const socket = connection.socket as unknown as TestSocket;
  socket.receive({
    type: "welcome",
    version: PROTOCOL_VERSION,
    id: "player",
    room: "012345",
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
test("reconciliation opens breakable collision before replay and restores it on a new round", () => {
  const floor = new T.Mesh(new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2));
  const panel = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  panel.name = "test-panel-physics";
  panel.position.set(-17, 1, 16.3);
  const physics = new T.Group();
  physics.add(floor, panel);
  const definitions = [
    {
      id: "test-panel",
      health: 20,
      material: "wood" as const,
      bounds: [
        [-18, 0, 16.25],
        [-16, 2, 16.35],
      ] as [[number, number, number], [number, number, number]],
      physicsNames: [panel.name],
      renderNames: [],
    },
  ];
  bindBreakablePhysics(physics, definitions);
  physics.updateMatrixWorld(true);
  const map = testMap();
  map.collision = new MapCollision([floor, panel]);
  map.breakables = new BreakableWorld(map.collision, definitions);
  const { connection, socket, player } = setup(map);
  for (let i = 0; i < 48; i++) connection.step({ ...neutralInput(), forward: 1 });
  expect(connection.local!.z).toBeGreaterThan(16.3);
  const round = { ...createMatch("casual", testMap()).state, phase: "live" as const };
  socket.receive({
    type: "snapshot",
    tick: 48,
    players: [player],
    events: [],
    round: { ...round, breakables: [{ id: "test-panel", health: 0 }] },
  });
  expect(connection.pending).toHaveLength(48);
  expect(connection.local!.z).toBeLessThan(16.3);
  // An old frame must never close a passage after a newer break snapshot.
  socket.receive({ type: "snapshot", tick: 47, players: [player], events: [], round });
  expect(map.breakables.health("test-panel")).toBe(0);
  socket.receive({ type: "snapshot", tick: 49, players: [player], events: [], round });
  expect(map.breakables.health("test-panel")).toBe(20);
  expect(connection.local!.z).toBeGreaterThan(16.3);
  connection.close();
});
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

test("transport interruption retries with the session token and cancels cleanly on leave", () => {
  const { connection, socket } = setup();
  socket.receive({
    type: "welcome",
    version: PROTOCOL_VERSION,
    id: "player",
    room: "012345",
    map: "dust2",
    mode: "casual",
    resume: "secret-session",
  });
  socket.close(1006, "");
  expect(connection.reconnecting).toBe(true);
  expect(connection.step(neutralInput())).toBe(false);
  vi.advanceTimersByTime(450);
  const retry = connection.socket as unknown as TestSocket;
  expect(retry).not.toBe(socket);
  retry.onopen?.();
  expect(JSON.parse(retry.sent[0]).resume).toBe("secret-session");
  connection.close();
  vi.advanceTimersByTime(10000);
  expect(connection.socket).toBe(retry);
});

test("packet arrival jitter does not become uneven interpolation spacing", () => {
  const { connection, socket, player } = setup();
  const round = createMatch("casual", testMap()).state;
  vi.advanceTimersByTime(70);
  socket.receive({ type: "snapshot", tick: 4, players: [player], events: [], round });
  vi.advanceTimersByTime(2);
  socket.receive({ type: "snapshot", tick: 8, players: [player], events: [], round });
  const history = connection.history;
  expect(history[2].at - history[1].at).toBeCloseTo(31.25, 0);
  connection.close();
});

test("an unresponsive transport starts recovery without waiting for its close handshake", () => {
  const { connection, socket } = setup();
  socket.receive({
    type: "welcome",
    version: PROTOCOL_VERSION,
    id: "player",
    room: "012345",
    map: "dust2",
    mode: "casual",
    resume: "secret-session",
  });
  socket.close = () => {
    socket.readyState = TestSocket.CLOSING;
  };
  vi.advanceTimersByTime(6500);
  expect(connection.reconnecting).toBe(true);
  expect(connection.socket).not.toBe(socket);
  connection.close();
});

test("rejects an unexpected server map before accepting snapshots or predicting", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", TestSocket);
  const closed = vi.fn();
  const received = vi.fn();
  const connection = new MatchConnection(
    "ws://localhost/ws",
    "012345",
    "Player",
    "casual",
    "ct",
    testMap(),
    false,
    received,
    closed,
  );
  const socket = connection.socket as unknown as TestSocket;
  socket.onopen?.();
  expect(JSON.parse(socket.sent[0]).map).toBe("dust2");
  socket.receive({
    type: "welcome",
    version: PROTOCOL_VERSION,
    id: "player",
    room: "012345",
    map: "mirage",
    mode: "casual",
  });
  expect(connection.id).toBe("");
  expect(socket.readyState).toBe(3);
  expect(received).not.toHaveBeenCalled();
  expect(closed).toHaveBeenCalledWith("Server map changed; return to Play and rejoin");
});

test("ladder prediction preserves authoritative attachment and detach cooldown across reconciliation", () => {
  const { connection, socket, player } = setup();
  player.ladder = { id: null, detachTime: 0.2 };
  const round = { ...createMatch("casual", testMap()).state, phase: "live" as const };
  socket.receive({ type: "snapshot", tick: 1, players: [player], events: [], round });
  const authoritative = connection.players[0];
  connection.step(neutralInput());
  expect(connection.local!.ladder!.detachTime).toBeLessThan(0.2);
  expect(authoritative.ladder!.detachTime).toBe(0.2);
  player.ack = 1;
  player.ladder.detachTime = 0.1;
  socket.receive({ type: "snapshot", tick: 2, players: [player], events: [], round });
  expect(connection.local!.ladder!.detachTime).toBe(0.1);
  connection.step(neutralInput());
  expect(connection.local!.ladder!.detachTime).toBeLessThan(0.1);
  expect(connection.players[0].ladder!.detachTime).toBe(0.1);
  connection.close();
});
