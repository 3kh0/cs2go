import { expect, test } from "vitest";
import * as T from "three";
import { groundSpawn } from "./spawn-position";
import { MapCollision } from "./map-collision";
import { createPlayer } from "./match";
import { movePlayer } from "./movement";
import { neutralInput } from "@cs2go/protocol";
import type { DustMap } from "./dust-map";

test("a floating start on a slope is stable from its first authoritative snapshot", () => {
  const slope = new T.Mesh(new T.BoxGeometry(8, 0.5, 8));
  slope.rotation.z = 0.15;
  slope.updateMatrixWorld(true);
  const collision = new MapCollision([slope]);
  const start = new T.Vector3(0, 1, 0);
  expect(groundSpawn(start, collision)).toBe(true);
  const actor = createPlayer("spawn", "Spawn", "ct");
  Object.assign(actor, { x: start.x, y: start.y, z: start.z, waiting: false });
  for (let tick = 0; tick < 128; tick++)
    movePlayer(actor, neutralInput(tick), 1 / 128, { collision } as DustMap);
  expect(actor.grounded).toBe(true);
  expect(actor.y).toBeCloseTo(start.y, 8);
});

test("unsupported or obstructed starts retain their finite authored location", () => {
  const empty = new MapCollision([]);
  const start = new T.Vector3(1, 2, 3);
  expect(groundSpawn(start, empty)).toBe(false);
  expect(start.toArray()).toEqual([1, 2, 3]);
  const floor = new T.Mesh(new T.BoxGeometry(8, 1, 8));
  floor.position.y = -0.5;
  const ceiling = new T.Mesh(new T.BoxGeometry(8, 1, 8));
  ceiling.position.y = 1.5;
  floor.updateMatrixWorld(true);
  ceiling.updateMatrixWorld(true);
  start.set(0, 0.25, 0);
  expect(groundSpawn(start, new MapCollision([floor, ceiling]))).toBe(false);
  expect(start.toArray()).toEqual([0, 0.25, 0]);
});
