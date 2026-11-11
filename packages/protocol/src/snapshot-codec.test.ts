import { expect, test } from "vitest";
import { SnapshotEncoder, SnapshotDecoder } from "./snapshot-codec";
import { encodeInputs, neutralInput, parseClientMessage, type ServerMessage } from "./index";

type Snapshot = Extract<ServerMessage, { type: "snapshot" }>;
// A partial fixture intentionally exercises the generic tree codec, not game rules.
function snapshot(tick = 4): Snapshot {
  return {
    type: "snapshot",
    tick,
    players: [
      {
        id: "a",
        x: 2,
        avatar: undefined,
        health: 100,
        appearances: { 1: { skin: { id: "test", wear: 0.2 } } },
      },
    ],
    events: [],
    round: { effects: [{ id: 1, age: 0, cells: [{ x: 1, y: 2, z: 3 }], holes: [] }] },
  } as unknown as Snapshot;
}
test("lossless deltas retain independent history through mutations, array changes and deletions", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const current = snapshot();
  const first = decoder.decode(JSON.parse(encoder.encode(current))) as Snapshot;
  expect(first).toEqual(JSON.parse(JSON.stringify(current)));
  current.tick = 8;
  current.players[0].x = 9.123456789;
  current.round.effects[0].age = 1;
  current.round.effects[0].holes.push(1);
  const wire = encoder.encode(current);
  expect(wire).not.toContain('"cells"');
  expect(wire).not.toContain('"appearances"');
  const second = decoder.decode(JSON.parse(wire));
  expect(second).toEqual(JSON.parse(JSON.stringify(current)));
  expect(first.players[0].x).toBe(2);
  expect(first.round.effects[0].holes).toEqual([]);
  current.tick = 12;
  current.players = [];
  current.round.effects = [];
  expect(decoder.decode(JSON.parse(encoder.encode(current)))).toEqual(current);
});
test("missing, skipped, duplicate baselines fail closed; fresh reconnect keyframe recovers", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const initial = encoder.encode(snapshot());
  const delta = encoder.encode(snapshot(8));
  expect(decoder.decode(JSON.parse(delta))).toBeNull();
  decoder.decode(JSON.parse(initial));
  const afterSkipped = encoder.encode(snapshot(12));
  expect(decoder.decode(JSON.parse(afterSkipped))).toBeNull();
  expect(decoder.decode(JSON.parse(delta))?.type).toBe("snapshot");
  expect(decoder.decode(JSON.parse(delta))).toBeNull();
  decoder.reset();
  const fresh = new SnapshotEncoder().encode(snapshot(16));
  expect(decoder.decode(JSON.parse(fresh))).toEqual(JSON.parse(fresh));
});
test("primitive updates and undefined deletions retain independent mutable replacements", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder(),
    current = snapshot();
  const player = current.players[0] as unknown as Record<string, unknown>;
  decoder.decode(JSON.parse(encoder.encode(current)));
  player.avatar = null;
  player.extra = { values: [1] };
  current.tick += 4;
  const prior = decoder.decode(JSON.parse(encoder.encode(current))) as Snapshot;
  (player.extra as { values: number[] }).values.push(2);
  for (const value of [0, -0, NaN, NaN, 2, false, "界", null]) {
    player.extraPrimitive = value;
    player.avatar = undefined;
    current.tick += 4;
    const next = decoder.decode(JSON.parse(encoder.encode(current))) as Snapshot;
    expect(next).toEqual(JSON.parse(JSON.stringify(current)));
    expect(Object.hasOwn(next.players[0], "avatar")).toBe(false);
    delete player.avatar;
  }
  expect((prior.players[0] as unknown as Record<string, unknown>).extra).toEqual({ values: [1] });
});
test("sparse inputs are independent and preserve all actions without accepting invalid values", () => {
  const inputs = [
    neutralInput(1),
    {
      ...neutralInput(2),
      forward: 1,
      fire: true,
      throwKind: "smoke" as const,
      throwStrength: 0.5,
      buyDrop: true,
      buy: 9,
    },
  ];
  expect(parseClientMessage(encodeInputs(inputs))).toEqual({ type: "inputs", inputs });
  expect(encodeInputs(inputs).length).toBeLessThan(
    JSON.stringify({ type: "inputs", inputs }).length / 3,
  );
  for (const input of [{ seq: -1 }, { seq: 1, forward: 2 }, { seq: 1, fire: 1 }, null])
    expect(
      parseClientMessage(JSON.stringify({ type: "compact-inputs", inputs: [input] })),
    ).toBeNull();
  expect(parseClientMessage(JSON.stringify({ type: "compact-inputs", inputs: [] }))).toBeNull();
});

test("high churn selects a full keyframe when smaller, and optional fields delete cleanly", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const initial = snapshot();
  initial.players[0].avatar = "https://example.test/avatar";
  decoder.decode(JSON.parse(encoder.encode(initial)));
  const next = snapshot(8);
  next.players[0].name = "new name";
  const encoded = encoder.encode(next);
  expect(encoded.length).toBeLessThanOrEqual(JSON.stringify(next).length);
  const decoded = decoder.decode(JSON.parse(encoded)) as Snapshot;
  expect(decoded).toEqual(JSON.parse(JSON.stringify(next)));
  expect(Object.hasOwn(decoded.players[0], "avatar")).toBe(false);
});

test("keyframe fallback compares UTF8 bytes for unchanged Unicode profile names", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const initial = snapshot();
  initial.players[0].name = "界".repeat(100);
  const player = initial.players[0] as unknown as Record<string, unknown>;
  for (let i = 0; i < 80; i++) player[`field${i}`] = 0;
  decoder.decode(JSON.parse(encoder.encode(initial)));
  initial.tick = 8;
  for (let i = 0; i < 80; i++) player[`field${i}`] = 1;
  const encoded = encoder.encode(initial);
  const full = JSON.stringify(initial);
  expect(JSON.parse(encoded).type).toBe("snapshot-delta");
  expect(encoded.length).toBeGreaterThan(full.length);
  expect(new TextEncoder().encode(encoded).byteLength).toBeLessThanOrEqual(
    new TextEncoder().encode(full).byteLength,
  );
  expect(decoder.decode(JSON.parse(encoded))).toEqual(JSON.parse(full));
});

test("authoritative animation clocks survive delta compression and remain independent", () => {
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder(),
    current = snapshot();
  current.players[0].animation = { phase: 0.99, air: 0, shot: null, draw: null, reload: null };
  const first = decoder.decode(JSON.parse(encoder.encode(current))) as Snapshot;
  current.tick += 4;
  current.players[0].animation = {
    phase: 0.01,
    air: 0.02,
    shot: 0.0078125,
    draw: null,
    reload: null,
  };
  const next = decoder.decode(JSON.parse(encoder.encode(current))) as Snapshot;
  expect(next.players[0].animation).toEqual(current.players[0].animation);
  expect(first.players[0].animation?.phase).toBe(0.99);
});
