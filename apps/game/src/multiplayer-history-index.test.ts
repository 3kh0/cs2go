import { afterEach, expect, test, vi } from "vitest";
import { PROTOCOL_VERSION, type ServerMessage } from "@cs2go/protocol";
import { createMatch, createPlayer } from "@cs2go/simulation/match";
import { testMap } from "@cs2go/simulation/test-map";
import { MatchConnection } from "./multiplayer-connection";

class TestSocket {
  onmessage?: (event: { data: string }) => void;
  send() {}
  close() {}
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("snapshot indexes retain their own players across disconnect, respawn, pruning and rejoin", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", TestSocket);
  const received: ServerMessage[] = [];
  const connection = new MatchConnection(
    "ws://localhost/ws",
    "012345",
    "Player",
    "casual",
    "ct",
    testMap(),
    false,
    (message) => received.push(message),
    () => {},
  );
  const socket = connection.socket as unknown as TestSocket;
  const welcome = {
    type: "welcome" as const,
    version: PROTOCOL_VERSION,
    id: "local",
    room: "012345",
    map: "dust2" as const,
    mode: "casual" as const,
  };
  socket.receive(welcome);
  const round = createMatch("casual", testMap()).state;
  const peer = { ...createPlayer("peer", "Peer", "t"), x: 2, y: 4, z: 6, spawn: 1 };
  const other = createPlayer("other", "Other", "ct");
  const snapshot = (tick: number, players = [other]) =>
    socket.receive({ type: "snapshot", tick, players, events: [], round });
  snapshot(0, [peer, other]);
  const first = connection.history[0];
  const respawn = { ...peer, x: 20, y: 40, z: 60, spawn: 2 };
  snapshot(1, [other, respawn]);
  const second = connection.history[1];
  expect(first.playersById.get("peer")).toMatchObject({ x: 2, y: 4, z: 6, spawn: 1 });
  expect(second.playersById.get("peer")).toMatchObject({ x: 20, y: 40, z: 60, spawn: 2 });
  expect(first.playersById.get("peer")).toBe(first.players[0]);
  expect(second.playersById.get("peer")).toBe(second.players[1]);
  snapshot(2);
  expect(connection.history[2].playersById.has("peer")).toBe(false);
  for (let tick = 3; tick < 20; tick++) snapshot(tick);
  expect(connection.history).toHaveLength(16);
  expect(connection.history).not.toContain(first);
  expect(connection.history).not.toContain(second);
  expect(connection.history.every((entry) => !entry.playersById.has("peer"))).toBe(true);
  for (const message of received)
    if (message.type === "snapshot") {
      expect(Object.keys(message)).not.toContain("playersById");
      expect(message.players.every((player) => !("playersById" in player))).toBe(true);
    }
  socket.receive(welcome);
  expect(connection.history).toEqual([]);
  snapshot(0, [respawn]);
  expect(connection.history[0].playersById.get("peer")?.spawn).toBe(2);
  expect(connection.history[0].playersById.has("other")).toBe(false);
  connection.close();
});
