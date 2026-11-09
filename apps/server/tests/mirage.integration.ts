// Native Mirage physics, brushes, spawn entities and version-2 C4 field.
// Unlike maps.integration.ts, this requires the actual extracted runtime assets.
import assert from "node:assert/strict";
import { Vector3, Ray } from "three";
import { loadServerMap } from "../src/map";
import { startServer } from "../src/server";
import { ladderNormal } from "@cs2go/simulation/ladder";
import { movePlayer } from "@cs2go/simulation/movement";
import { mapTriggers } from "@cs2go/simulation/buy-zones";
import { createMatch, createPlayer, joinMatch, stepMatch, STEP } from "@cs2go/simulation/match";
import {
  neutralInput,
  PROTOCOL_VERSION,
  SnapshotDecoder,
  type Input,
  type PlayerState,
  type ServerMessage,
} from "@cs2go/protocol";
const map = await loadServerMap(undefined, "mirage");
const nav = (await Bun.file(
  new URL("../../../packages/assets/public/models/maps/mirage-nav.json", import.meta.url),
).json()) as { sites: number[][] };
const triggers = mapTriggers(map);
assert.equal(map.bombDamage?.positionCount, 68279);
assert.equal(map.bombDamage?.siteCount, 2);
assert.equal(triggers.bombSites.sites.length, 2);
function place(player: PlayerState, point: number[]) {
  const floor = map.collision.floor(point[0], point[2], point[1] + 0.5);
  assert(Number.isFinite(floor), "native point must have collision support");
  Object.assign(player, {
    x: point[0],
    y: floor,
    z: point[2],
    vx: 0,
    vz: 0,
    vertical: 0,
    grounded: true,
    cooldown: 0,
  });
}
for (const team of ["ct", "t"] as const) {
  assert(map.spawns[team].length >= 10);
  assert.equal(map.spawnAngles?.[team].length, map.spawns[team].length);
  for (const spawn of map.spawns[team]) {
    const point = {
      x: spawn[0],
      y: map.collision.floor(spawn[0], spawn[2], spawn[1] + 0.5),
      z: spawn[2],
    };
    assert(Number.isFinite(point.y));
    assert(
      triggers.buyZones.contains(point, team, { halfWidth: 0.3, height: 1.85 }),
      `${team} native spawn lies in its actual buy brush`,
    );
    assert(
      !triggers.buyZones.contains(point, team === "t" ? "ct" : "t", {
        halfWidth: 0.3,
        height: 1.85,
      }),
    );
  }
}
function fixture(mode: "casual" | "competitive" = "casual") {
  const match = createMatch(mode, map);
  const ct = createPlayer("ct", "CT", "ct"),
    t = createPlayer("t", "T", "t");
  joinMatch(match, ct);
  joinMatch(match, t);
  stepMatch(match, new Map());
  return { match, ct, t };
}
function advance(
  match: ReturnType<typeof createMatch>,
  seconds: number,
  inputs = new Map<string, Input>(),
) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) stepMatch(match, inputs);
}
for (const mode of ["casual", "competitive"] as const) {
  const { match, ct, t } = fixture(mode);
  assert.equal(match.state.phase, "freeze");
  assert.equal(match.ball.mesh, undefined, "Dust II football must not spawn on Mirage");
  for (const player of [ct, t])
    assert(
      triggers.buyZones.contains(player, player.team, { halfWidth: 0.3, height: player.eye + 0.2 }),
    );
  t.money = 10000;
  stepMatch(match, new Map([[t.id, { ...neutralInput(), buy: 0 }]]));
  assert(t.magazines[0], "native Mirage buy brush permits rifle purchase");
  assert(t.money < 10000);
  match.state.phase = "live";
  match.state.remaining = 100;
  place(t, map.spawns.t[0]);
  // Find an actual supported, unobstructed lane from the native spawn.
  const start = new Vector3(t.x, t.y + t.eye, t.z);
  let direction: Vector3 | undefined;
  for (let n = 0; n < 32; n++) {
    const angle = (n * Math.PI) / 16;
    const candidate = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    const end = start.clone().addScaledVector(candidate, 3);
    if (
      !map.collision.intersections(new Ray(start, candidate), 3.5).length &&
      Math.abs(map.collision.floor(end.x, end.z, t.y + 0.5) - t.y) < 0.05
    ) {
      direction = candidate;
      break;
    }
  }
  assert(direction, "native spawn must have a clear combat lane");
  const yaw = Math.atan2(-direction.x, -direction.z);
  const before = { x: t.x, z: t.z };
  const predicted = structuredClone(t);
  const moving = { ...neutralInput(), forward: 1, yaw };
  for (let i = 0; i < 32; i++) {
    movePlayer(predicted, moving, STEP, map);
    stepMatch(match, new Map([[t.id, moving]]));
  }
  assert(
    Math.hypot(t.x - before.x, t.z - before.z) > 0.2,
    "player traverses actual Mirage collision",
  );
  assert.equal(t.x, predicted.x, "client prediction and server native collision agree");
  assert.equal(t.y, predicted.y);
  assert.equal(t.z, predicted.z);
  advance(match, 0.5);
  place(ct, [t.x + direction.x * 3, t.y, t.z + direction.z * 3]);
  const ammo = t.ammo;
  const pitch = Math.atan2(t.y + t.eye - (ct.y + 0.95), 3);
  stepMatch(match, new Map([[t.id, { ...neutralInput(), fire: true, yaw, pitch }]]));
  assert(t.ammo < ammo);
  assert(ct.health < 100, "authoritative hitscan hits the opposing player on native geometry");
}
for (const [index, site] of nav.sites.entries()) {
  const { match, ct, t } = fixture();
  match.state.phase = "live";
  match.state.remaining = 100;
  place(t, site);
  assert.equal(triggers.bombSites.site(t, { halfWidth: 0.3, height: t.eye + 0.2 }), index);
  match.state.bomb.carrier = t.id;
  advance(match, 3.3, new Map([[t.id, { ...neutralInput(), use: true }]]));
  assert(match.state.bomb.planted, `native site ${index} permits planting`);
  place(ct, [match.state.bomb.x + 0.5, match.state.bomb.y, match.state.bomb.z]);
  ct.kit = true;
  advance(match, 5.1, new Map([[ct.id, { ...neutralInput(), use: true }]]));
  assert.equal(match.state.result?.reason, "Bomb defused");
  assert.equal(match.state.scores.ct, 1);
  const blast = fixture();
  blast.match.state.phase = "live";
  blast.match.state.remaining = 100;
  place(blast.ct, site);
  Object.assign(blast.match.state.bomb, {
    x: site[0],
    y: blast.ct.y,
    z: site[2],
    planted: true,
    timer: STEP / 2,
    carrier: null,
    planter: blast.t.id,
  });
  stepMatch(blast.match, new Map());
  assert.equal(blast.match.state.result?.reason, "Bomb detonated");
  assert.equal(blast.match.state.scores.t, 1);
  assert.equal(blast.ct.health, 0, `native baked blast at site ${index} deals lethal damage`);
}
assert.equal(map.ladders?.length, 2);
for (const ladder of map.ladders!) {
  const { match, ct } = fixture();
  match.state.phase = "live";
  match.state.remaining = 100;
  const normal = ladderNormal(ladder);
  Object.assign(ct, {
    x: ladder.bottom[0] + normal.x * 0.3,
    y: ladder.bottom[1] + 0.3,
    z: ladder.bottom[2] + normal.z * 0.3,
    grounded: false,
  });
  const start = ct.y;
  const predicted = structuredClone(ct);
  const input = { ...neutralInput(), forward: 1, yaw: Math.atan2(normal.x, normal.z) };
  for (let i = 0; i < 64; i++) {
    movePlayer(predicted, input, STEP, map);
    stepMatch(match, new Map([[ct.id, input]]));
  }
  assert.equal(ct.ladder?.id, ladder.id);
  assert(ct.y > start + 1.5, "native ladder must physically lift the authoritative player");
  assert.deepEqual(
    [ct.x, ct.y, ct.z, ct.ladder],
    [predicted.x, predicted.y, predicted.z, predicted.ladder],
  );
  const jumping = { ...input, jump: true };
  movePlayer(predicted, jumping, STEP, map);
  stepMatch(match, new Map([[ct.id, jumping]]));
  assert.equal(ct.ladder?.id, null);
  assert(ct.ladder!.detachTime > 0.1, "jump detaches and prevents immediate ladder recapture");
  assert.deepEqual(
    [ct.x, ct.y, ct.z, ct.ladder],
    [predicted.x, predicted.y, predicted.z, predicted.ladder],
  );
}
for (const ladder of map.ladders!) {
  const { match, ct, t } = fixture();
  match.state.phase = "live";
  match.state.remaining = 100;
  const normal = ladderNormal(ladder);
  Object.assign(ct, {
    x: ladder.bottom[0] + normal.x * 0.3,
    y: ladder.bottom[1] + 0.3,
    z: ladder.bottom[2] + normal.z * 0.3,
    grounded: false,
  });
  Object.assign(t, {
    x: ct.x,
    y: ladder.bottom[1] + 2.2,
    z: ct.z,
    grounded: false,
    ladder: { id: ladder.id, detachTime: 0 },
  });
  const predicted = structuredClone(ct);
  const climbing = { ...neutralInput(), forward: 1, yaw: Math.atan2(normal.x, normal.z) };
  for (let i = 0; i < 48; i++) {
    movePlayer(predicted, climbing, STEP, map, [predicted, t]);
    stepMatch(match, new Map([[ct.id, climbing]]));
  }
  assert.equal(ct.ladder?.id, ladder.id);
  assert(
    ct.y + ct.eye + 0.2032 <= t.y + 0.002,
    "climber cannot pass through the player holding the ladder above",
  );
  assert.deepEqual(
    [ct.x, ct.y, ct.z, ct.ladder],
    [predicted.x, predicted.y, predicted.z, predicted.ladder],
  );
  const feet = ct.y;
  const duck = { ...climbing, forward: 0, duck: true };
  for (let i = 0; i < 128; i++) {
    movePlayer(predicted, duck, STEP, map, [predicted, t]);
    stepMatch(match, new Map([[ct.id, duck]]));
  }
  assert(Math.abs(ct.eye - 1.1684) < 0.001, "mounted player can crouch without leaving the ladder");
  assert(Math.abs(ct.y - feet) < 0.001, "ladder crouch does not apply the airborne foot lift");
  assert.equal(ct.eye, predicted.eye);
  assert.deepEqual(
    [ct.x, ct.y, ct.z, ct.ladder],
    [predicted.x, predicted.y, predicted.z, predicted.ladder],
  );
}
const app = startServer({
  map,
  port: 0,
  hostname: "127.0.0.1",
  origins: ["http://localhost:5173"],
});
const socket = new WebSocket(`ws://127.0.0.1:${app.server.port}/ws`, {
  headers: { Origin: "http://localhost:5173" },
});
try {
  const messages: ServerMessage[] = [];
  const decoder = new SnapshotDecoder();
  socket.onmessage = (event) => {
    const message = decoder.decode(JSON.parse(String(event.data)));
    if (message) messages.push(message);
  };
  const deadline = performance.now() + 5000;
  while (socket.readyState !== WebSocket.OPEN) {
    assert(performance.now() < deadline);
    await Bun.sleep(10);
  }
  socket.send(
    JSON.stringify({
      type: "join",
      version: PROTOCOL_VERSION,
      map: "mirage",
      name: "Mirage",
      mode: "casual",
      team: "ct",
      create: true,
      room: "",
    }),
  );
  while (!messages.some((message) => message.type === "welcome")) {
    assert(performance.now() < deadline);
    await Bun.sleep(10);
  }
  const welcome = messages.find((message) => message.type === "welcome")!;
  assert.equal(welcome.map, "mirage");
  const room = app.rooms.get(welcome.room)!;
  assert.equal(room.map, map);
  assert(
    triggers.buyZones.contains(room.players.get(welcome.id)!, "ct", {
      halfWidth: 0.3,
      height: 1.85,
    }),
  );
  const ladder = map.ladders![0];
  const normal = ladderNormal(ladder);
  Object.assign(room.players.get(welcome.id)!, {
    x: ladder.bottom[0] + normal.x * 0.3,
    y: ladder.bottom[1] + 0.3,
    z: ladder.bottom[2] + normal.z * 0.3,
    grounded: false,
  });
  socket.send(
    JSON.stringify({
      type: "inputs",
      inputs: Array.from({ length: 8 }, (_, index) => ({
        ...neutralInput(index + 1),
        forward: 1,
        yaw: Math.atan2(normal.x, normal.z),
      })),
    }),
  );
  while (
    !messages.some(
      (message) =>
        message.type === "snapshot" &&
        message.players.some(
          (player) => player.id === welcome.id && player.ladder?.id === ladder.id,
        ),
    )
  ) {
    assert(
      performance.now() < deadline,
      "authoritative ladder attachment must reach the client snapshot",
    );
    await Bun.sleep(10);
  }
} finally {
  socket.close();
  await app.stop();
}
console.log(
  "Native Mirage integration passed: all 33 spawns, native buy brushes, casual/competitive economy, movement prediction and combat, both plant/defuse sites, exact baked C4 blast, both ladder climbs/jump-offs with prediction parity, real WebSocket ladder snapshots.",
);
