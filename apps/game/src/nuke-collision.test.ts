import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { beforeAll, expect, test } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  BreakableWorld,
  bindBreakablePhysics,
  type NativeBreakableDefinition,
} from "@cs2go/simulation/breakables";
import {
  DoorWorld,
  bindDoorPhysics,
  type NativeDoorManifest,
  type DoorPhysics,
} from "@cs2go/simulation/doors";
import { ballistics } from "@cs2go/simulation/ballistics";
import { dustCollision } from "@cs2go/simulation/dust-map";
import type { MapCollision } from "@cs2go/simulation/map-collision";
import { ladderNormal } from "@cs2go/simulation/ladder";
import { createPlayer } from "@cs2go/simulation/match";
import { movePlayer } from "@cs2go/simulation/movement";
import { movement } from "@cs2go/simulation/physics";
import { neutralInput } from "@cs2go/protocol";
import type { MapNavigation } from "./navigation";

const data = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/nuke-nav.json", import.meta.url),
    "utf8",
  ),
) as MapNavigation;
const breakableData = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/nuke-breakables.json", import.meta.url),
    "utf8",
  ),
) as { breakables: NativeBreakableDefinition[] };
const doorData = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/nuke-doors.json", import.meta.url),
    "utf8",
  ),
) as NativeDoorManifest;
let collision: MapCollision;
let doors: DoorWorld;
let doorPhysics: DoorPhysics[];
let breakables: BreakableWorld;
beforeAll(async () => {
  const bytes = gunzipSync(
    readFileSync(
      new URL("../../../packages/assets/public/models/maps/nuke-physics.glb.gz", import.meta.url),
    ),
  );
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  bindBreakablePhysics(model.scene, breakableData.breakables);
  doorPhysics = bindDoorPhysics(model.scene, doorData.doors);
  collision = dustCollision(model.scene).collision;
  doors = new DoorWorld(collision, doorData.doors, doorPhysics);
  breakables = new BreakableWorld(collision, breakableData.breakables);
});

test("all six native Nuke ladders physically attach, traverse, detach and land in both directions", () => {
  expect(data.ladders).toHaveLength(6);
  for (const ladder of data.ladders!)
    for (const up of [true, false]) {
      breakables.reset();
      doors.reset();
      const normal = ladderNormal(ladder),
        start = new T.Vector3()
          .fromArray(up ? ladder.bottom : ladder.top)
          .addScaledVector(normal, movement.hullRadius + 0.01);
      const exit = new T.Vector3().fromArray((up ? ladder.exitTop : ladder.exitBottom)!);
      const player = createPlayer("ladder-audit", "audit", "t");
      Object.assign(player, {
        x: start.x,
        y: start.y,
        z: start.z,
        waiting: false,
        grounded: false,
      });
      let attached = 0,
        landed = false;
      let maxHorizontal = 0,
        maxVertical = 0;
      for (let tick = 0; tick < 128 * 8; tick++) {
        let yaw = Math.atan2(normal.x, normal.z),
          pitch = up ? 0 : (Math.PI * 75) / 180;
        if (attached && player.ladder?.id === null) {
          yaw = Math.atan2(-(exit.x - player.x), -(exit.z - player.z));
          pitch = 0;
        }
        // A native grate covers ladder 2's upper exit. Shoot the real ray
        // contact before climbing through, retaining its permanent frame.
        if (up && player.y > ladder.top[1] - 0.6)
          for (const definition of breakableData.breakables) {
            const bounds = new T.Box3(
              new T.Vector3(...definition.bounds[0]),
              new T.Vector3(...definition.bounds[1]),
            );
            if (bounds.distanceToPoint(exit) > 0.75 || breakables.health(definition.id)! <= 0)
              continue;
            const from = new T.Vector3(player.x, player.y + movement.standingEye, player.z);
            const direction = bounds.getCenter(new T.Vector3()).sub(from).normalize();
            const impact = collision.intersections(new T.Ray(from, direction), 2.5)[0];
            if (impact) breakables.damageImpact(impact, ballistics[player.weapon].damage, "bullet");
          }
        const before = new T.Vector3(player.x, player.y, player.z);
        movePlayer(player, { ...neutralInput(), yaw, pitch, forward: 1 }, 1 / 128, {
          collision,
          ladders: data.ladders,
          spawns: data.spawns,
        });
        const position = new T.Vector3(player.x, player.y, player.z);
        if (player.ladder?.id !== null) attached++;
        maxHorizontal = Math.max(
          maxHorizontal,
          Math.hypot(position.x - before.x, position.z - before.z),
        );
        maxVertical = Math.max(maxVertical, Math.abs(position.y - before.y));
        const support = collision.support(
          player.x,
          player.z,
          player.y + 0.03,
          player.y - 0.03,
          movement.hullRadius,
        );
        if (
          attached &&
          player.ladder?.id === null &&
          player.grounded &&
          Number.isFinite(support) &&
          Math.abs(player.y - support) < 0.03 &&
          position.distanceTo(exit) < 0.75
        ) {
          landed = true;
          break;
        }
      }
      const evidence = JSON.stringify({
        ladder: ladder.id,
        up,
        position: [player.x, player.y, player.z],
        exit: exit.toArray(),
        attached,
        maxHorizontal,
        maxVertical,
      });
      expect(attached, evidence).toBeGreaterThan(0);
      expect(landed, evidence).toBe(true);
      expect(maxHorizontal, evidence).toBeLessThan(0.08);
      expect(maxVertical, evidence).toBeLessThanOrEqual(18 * 0.0254 + 0.001);
      expect(
        collision.blocked(
          player.x,
          player.z,
          player.y,
          movement.hullRadius,
          movement.standingHeight,
        ),
        evidence,
      ).toBe(false);
    }
});

test("all seventeen native breakables remove their actual ray and grenade obstruction after supported damage", () => {
  expect(breakableData.breakables).toHaveLength(17);
  for (const definition of breakableData.breakables)
    for (const kind of ["bullet", "melee", "explosion"] as const) {
      breakables.reset();
      doors.reset();
      const bounds = new T.Box3(
        new T.Vector3(...definition.bounds[0]),
        new T.Vector3(...definition.bounds[1]),
      );
      const center = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3());
      const axis = size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2;
      let ray: T.Ray | undefined, impact: T.Intersection | undefined;
      for (const sign of [1, -1]) {
        const from = center.clone();
        from.setComponent(axis, from.getComponent(axis) + sign * (size.getComponent(axis) / 2 + 1));
        const direction = new T.Vector3().setComponent(axis, -sign);
        const candidate = new T.Ray(from, direction),
          hit = collision.intersections(candidate, 3)[0];
        if (hit && breakables.idForImpact(hit) === definition.id) {
          ray = candidate;
          impact = hit;
          break;
        }
      }
      const evidence = `${definition.id} ${kind}`;
      expect(impact, evidence).toBeDefined();
      const delta = ray!.direction.clone().multiplyScalar(3),
        normal = new T.Vector3();
      const sphereBefore = collision.sweepSphere(ray!.origin, delta, 0.025, normal);
      expect(Number.isFinite(sphereBefore), evidence).toBe(true);
      const change = breakables.damageImpact(impact!, ballistics[7].damage, kind);
      expect(change?.broken, evidence).toBe(true);
      expect(
        collision
          .intersections(ray!, 3)
          .some((hit) => breakables.idForImpact(hit) === definition.id),
        evidence,
      ).toBe(false);
      const sphereAfter = collision.sweepSphere(ray!.origin, delta, 0.025, normal);
      expect(sphereAfter, evidence).toBeGreaterThan(sphereBefore + 0.01);
    }
});

test("all four native Nuke doors open actual bullet, grenade and standing-player paths and reset closed", () => {
  expect(doorData.doors).toHaveLength(4);
  for (const definition of doorData.doors) {
    doors.release("door-audit");
    doors.reset();
    breakables.reset();
    const bounds = new T.Box3();
    for (const mesh of doorPhysics.find((p) => p.id === definition.id)!.meshes)
      bounds.union(new T.Box3().setFromObject(mesh));
    const center = bounds.getCenter(new T.Vector3()),
      size = bounds.getSize(new T.Vector3());
    const axis = size.x < size.z ? 0 : 2;
    let ray: T.Ray | undefined;
    for (const sign of [1, -1]) {
      const from = center.clone();
      from.setComponent(axis, from.getComponent(axis) + sign * 1.25);
      const direction = new T.Vector3().setComponent(axis, -sign);
      if (doors.target(from, direction) === definition.id) {
        ray = new T.Ray(from, direction);
        break;
      }
    }
    expect(ray, definition.id).toBeDefined();
    const distance = collision.intersections(ray!, 3)[0].distance;
    const delta = ray!.direction.clone().multiplyScalar(3),
      normal = new T.Vector3();
    const grenadeBefore = collision.sweepSphere(ray!.origin, delta, 0.025, normal);
    const floor = collision.support(
      ray!.origin.x,
      ray!.origin.z,
      center.y,
      center.y - 3,
      movement.hullRadius,
    );
    expect(Number.isFinite(floor), definition.id).toBe(true);
    const closed = ray!.origin.clone();
    closed.y = floor;
    collision.moveHorizontal(
      closed,
      { x: ray!.direction.x * 2.5, z: ray!.direction.z * 2.5 },
      1,
      movement.hullRadius,
      movement.standingHeight,
      true,
    );
    expect(doors.use("door-audit", true, ray!.origin, ray!.direction), definition.id).toBe(true);
    expect(doors.use("door-audit", true, ray!.origin, ray!.direction), definition.id).toBe(false);
    for (let tick = 0; tick < 128 * 3; tick++) doors.step(1 / 128);
    expect(Math.abs(doors.states.find((s) => s.id === definition.id)!.angle), definition.id).toBe(
      definition.distance,
    );
    expect(
      collision
        .intersections(ray!, 3)
        .some((hit) => hit.object.userData.nativeDoorId === definition.id),
      definition.id,
    ).toBe(false);
    expect(collision.sweepSphere(ray!.origin, delta, 0.025, normal), definition.id).toBeGreaterThan(
      grenadeBefore + 0.01,
    );
    const opened = ray!.origin.clone();
    opened.y = floor;
    collision.moveHorizontal(
      opened,
      { x: ray!.direction.x * 2.5, z: ray!.direction.z * 2.5 },
      1,
      movement.hullRadius,
      movement.standingHeight,
      true,
    );
    expect(opened.distanceTo(closed), definition.id).toBeGreaterThan(1);
    expect(
      collision.blocked(opened.x, opened.z, opened.y, movement.hullRadius, movement.standingHeight),
      definition.id,
    ).toBe(false);
    doors.reset();
    expect(collision.intersections(ray!, 3)[0].distance, definition.id).toBeCloseTo(distance, 6);
  }
});
