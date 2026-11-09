import { expect, test } from "vitest";
import * as T from "three";
import { bindBreakablePhysics, BreakableWorld, type NativeBreakableDefinition } from "./breakables";
import { MapCollision } from "./map-collision";
import { createMatch, createPlayer, joinMatch, startRound, STEP } from "./match";
import { shoot } from "./combat";
import { movePlayer } from "./movement";
import { heDamage } from "./utility";
import {
  neutralInput,
  SnapshotDecoder,
  SnapshotEncoder,
  type ServerMessage,
} from "@cs2go/protocol";

function fixture(cover = false) {
  const scene = new T.Group();
  const pane = new T.Mesh(new T.BoxGeometry(2, 2.6, 0.05), new T.MeshBasicMaterial());
  pane.name = "native_window_physics";
  pane.position.set(0, 1.3, 0);
  pane.userData.bulletMaterial = "glass";
  const floor = new T.Mesh(
    new T.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial(),
  );
  floor.name = "permanent_floor";
  const frame = new T.Mesh(new T.BoxGeometry(0.1, 3, 0.2), new T.MeshBasicMaterial());
  frame.name = "permanent_frame";
  frame.position.set(1.1, 1.5, 0);
  scene.add(pane, floor, frame);
  if (cover) {
    const wall = new T.Mesh(new T.BoxGeometry(4, 3, 0.4), new T.MeshBasicMaterial());
    wall.position.set(0, 1.5, 1);
    scene.add(wall);
  }
  const definitions: NativeBreakableDefinition[] = [
    {
      id: "native:window",
      health: 1,
      material: "glass",
      bounds: [
        [-1, 0, -0.025],
        [1, 2.6, 0.025],
      ],
      physicsNames: [pane.name],
      renderNames: ["native_window_render"],
    },
  ];
  bindBreakablePhysics(scene, definitions);
  scene.updateMatrixWorld(true);
  const collision = new MapCollision(scene.children as T.Mesh[]);
  const map = {
    collision,
    breakableDefinitions: definitions,
    spawns: { ct: [[0, 0, 2]], t: [[5, 0, 2]] },
  };
  return { map, collision, definitions, pane, frame };
}
const ray = new T.Ray(new T.Vector3(0, 1.6, 2), new T.Vector3(0, 0, -1));

test("broken native cover opens movement, sphere sweeps and LOS without deleting its frame; restoration closes it", () => {
  const { collision, definitions, frame } = fixture();
  const world = new BreakableWorld(collision, definitions);
  expect(collision.intersections(ray, 4)[0].object.userData.nativeBreakableId).toBe(
    definitions[0].id,
  );
  expect(collision.visible(ray.origin, new T.Vector3(0, 1.6, -2))).toBe(false);
  expect(collision.blocked(0, 0, 0, 0.3, 1.8)).toBe(true);
  expect(collision.floor(0, 0, 4)).toBeCloseTo(2.6, 5);
  expect(collision.support(0, 0, 4, -1)).toBeCloseTo(2.6, 5);
  expect(
    collision.sweepSphere(new T.Vector3(0, 1, 1), new T.Vector3(0, 0, -2), 0.1, new T.Vector3()),
  ).toBeLessThan(1);
  world.damage(definitions[0].id, 1, "bullet");
  expect(collision.visible(ray.origin, new T.Vector3(0, 1.6, -2))).toBe(true);
  expect(collision.blocked(0, 0, 0, 0.3, 1.8)).toBe(false);
  expect(
    collision.sweepSphere(new T.Vector3(0, 1, 1), new T.Vector3(0, 0, -2), 0.1, new T.Vector3()),
  ).toBe(Infinity);
  expect(collision.floor(0, 0, 1)).toBeCloseTo(0, 5);
  expect(collision.floor(0, 0, 4)).toBeCloseTo(0, 5);
  expect(collision.support(0, 0, 4, -1)).toBeCloseTo(0, 5);
  expect(
    collision.intersections(new T.Ray(new T.Vector3(1.1, 1.6, 2), ray.direction), 4)[0].object,
  ).toBe(frame);
  world.restore([{ id: definitions[0].id, health: 1 }]);
  expect(collision.visible(ray.origin, new T.Vector3(0, 1.6, -2))).toBe(false);
});

test("lobbies share immutable map geometry but neither health nor disabled collision owners", () => {
  const { map } = fixture();
  const a = createMatch("casual", map),
    b = createMatch("casual", map);
  for (let i = 0; i < 4; i++) expect(a.map.collision.intersections(ray, 4)).not.toHaveLength(0);
  a.breakables.damage("native:window", 1, "bullet");
  expect(a.map.collision.intersections(ray, 4)).toHaveLength(0);
  for (let i = 0; i < 4; i++) {
    expect(b.map.collision.intersections(ray, 4)).not.toHaveLength(0);
    expect(map.collision.intersections(ray, 4)).not.toHaveLength(0);
  }
  expect(b.breakables.health("native:window")).toBe(1);
});

test("authoritative firearms and knives break sourced HP cover and round reset restores physical passage blocking", () => {
  const { map } = fixture();
  const match = createMatch("casual", map);
  const player = createPlayer("ct", "CT", "ct");
  joinMatch(match, player);
  Object.assign(player, { x: 0, y: 0, z: 2, yaw: 0, pitch: 0 });
  const shot = shoot(match, player);
  expect(
    shot.some((e) => e.kind === "breakable" && e.id === "native:window" && e.health === 0),
  ).toBe(true);
  for (const event of shot)
    if (event.kind === "shot")
      expect(event.impacts?.every((impact) => Math.abs(impact.point.z) > 0.1)).toBe(true);
  expect(match.map.collision.intersections(ray, 4)).toHaveLength(0);
  const input = { ...neutralInput(), forward: 1 };
  for (let i = 0; i < 128; i++) movePlayer(player, input, STEP, match.map);
  expect(player.z).toBeLessThan(-0.5);
  startRound(match);
  expect(match.breakables.health("native:window")).toBe(1);
  Object.assign(player, { x: 0, y: 0, z: 0.7, yaw: 0, pitch: 0, weapon: player.knife });
  const knife = shoot(match, player, false);
  expect(knife.some((e) => e.kind === "breakable")).toBe(true);
});

test("HE damages exposed native objects, respects unrelated world cover and ignores its target's own hull", () => {
  const direct = fixture();
  const clear = new BreakableWorld(direct.collision, direct.definitions);
  expect(clear.damageRadius(new T.Vector3(0, 1.6, 2), 8.9, heDamage, "explosion")).toHaveLength(1);
  const blocked = fixture(true);
  const protectedWorld = new BreakableWorld(blocked.collision, blocked.definitions);
  expect(
    protectedWorld.damageRadius(new T.Vector3(0, 1.6, 2), 8.9, heDamage, "explosion"),
  ).toHaveLength(0);
  expect(protectedWorld.health("native:window")).toBe(1);
});

test("snapshots preserve damaged objects for late joins, deltas and reset, with no transient event dependency", () => {
  const { map } = fixture();
  const match = createMatch("casual", map),
    receiver = new BreakableWorld(map.collision.fork(), map.breakableDefinitions);
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const snapshot = (tick: number): Extract<ServerMessage, { type: "snapshot" }> => ({
    type: "snapshot",
    tick,
    players: [],
    events: [],
    round: match.state,
  });
  match.breakables.damage("native:window", 1, "bullet");
  const first = JSON.parse(encoder.encode(snapshot(1)));
  const received = decoder.decode(first);
  expect(received?.type).toBe("snapshot");
  if (received?.type !== "snapshot") throw new Error("Missing snapshot");
  receiver.restore(received.round.breakables ?? []);
  expect(receiver.collision.intersections(ray, 4)).toHaveLength(0);
  match.breakables.reset();
  const next = decoder.decode(JSON.parse(encoder.encode(snapshot(2))));
  if (next?.type !== "snapshot") throw new Error("Missing reset snapshot");
  receiver.restore(next.round.breakables ?? []);
  expect(receiver.collision.intersections(ray, 4)).not.toHaveLength(0);
});

test("unsupported damage kinds and invalid HP cannot arm an imported prop", () => {
  const { collision, definitions } = fixture();
  const world = new BreakableWorld(collision, definitions);
  expect(world.damage("not-a-native-breakable", 100, "bullet")).toBeNull();
  expect(world.damage("native:window", Infinity, "bullet")).toBeNull();
  expect(world.damage("native:window", 100, "fire")).toBeNull();
  expect(() => new BreakableWorld(collision, [{ ...definitions[0], health: 0 }])).toThrow();
});

test("authored OnBreak enables its distinct remainder and round restoration disables it again", () => {
  const { pane, definitions } = fixture();
  const scene = pane.parent!;
  const remainder = new T.Mesh(new T.BoxGeometry(2, 2.6, 0.05), new T.MeshBasicMaterial());
  remainder.name = "native_shutter_remainder";
  remainder.position.set(0, 1.3, -2);
  scene.add(remainder);
  definitions[0].onBreakEnable = ["native:remainder"];
  bindBreakablePhysics(scene, definitions, [
    { id: "native:remainder", physicsNames: [remainder.name], renderNames: [] },
  ]);
  scene.updateMatrixWorld(true);
  const collision = new MapCollision(scene.children as T.Mesh[]);
  const world = new BreakableWorld(collision, definitions);
  expect(collision.intersections(ray, 6).some((hit) => hit.object === remainder)).toBe(false);
  world.damage("native:window", 1, "melee");
  expect(collision.intersections(ray, 6)[0].object).toBe(remainder);
  world.reset();
  expect(collision.intersections(ray, 6)[0].object).toBe(pane);
  expect(collision.intersections(ray, 6).some((hit) => hit.object === remainder)).toBe(false);
});

test("native Wooden.Medium multipliers scale low damage before testing source health", () => {
  const { collision, definitions } = fixture();
  definitions[0].damageMultipliers = { bullet: 0.75, melee: 2, explosion: 1.5 };
  const world = new BreakableWorld(collision, definitions);
  expect(world.damage("native:window", 0.5, "bullet")).toEqual({
    id: "native:window",
    health: 0.625,
    broken: false,
  });
  expect(collision.intersections(ray, 4)).not.toHaveLength(0);
  expect(world.damage("native:window", 0.4, "melee")?.broken).toBe(true);
  expect(collision.intersections(ray, 4)).toHaveLength(0);
});
