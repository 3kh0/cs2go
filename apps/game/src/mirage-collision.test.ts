import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { dustCollision } from "@cs2go/simulation/dust-map";
import type { MapCollision } from "@cs2go/simulation/map-collision";
import { createLadderState, ladderNormal, stepLadder } from "@cs2go/simulation/ladder";
import { Navigation, type MapNavigation } from "./navigation";
import { createPlayer } from "@cs2go/simulation/match";
import { movePlayer } from "@cs2go/simulation/movement";
import { movement } from "@cs2go/simulation/physics";
import { neutralInput } from "@cs2go/protocol";

const data = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/mirage-nav.json", import.meta.url),
    "utf8",
  ),
) as MapNavigation;
let collision: MapCollision;
beforeAll(async () => {
  const bytes = gunzipSync(
    readFileSync(
      new URL("../../../packages/assets/public/models/maps/mirage-physics.glb.gz", import.meta.url),
    ),
  );
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  collision = dustCollision(model.scene).collision;
});

describe("native Mirage physics and ladder traversal", () => {
  it("climbs A stairs while holding into the connector-side wall without jumping", () => {
    for (const x of [-14, -13.4, -12.6])
      for (const walk of [false, true]) {
        const player = createPlayer("stairs", "Stairs", "ct");
        Object.assign(player, {
          x,
          y: collision.support(x, 34, -3, -5, movement.hullRadius),
          z: 34,
          grounded: true,
          waiting: false,
        });
        const input = { ...neutralInput(), yaw: Math.PI, forward: 1, right: -1, walk };
        let maximumRise = 0;
        let wallSamples = 0;
        for (let tick = 0; tick < 128 * 5 && player.z < 39; tick++) {
          const before = player.y;
          movePlayer(player, input, 1 / 128, { collision, spawns: data.spawns });
          maximumRise = Math.max(maximumRise, player.y - before);
          if (player.z > 35 && player.z < 38) {
            expect(player.x).toBeLessThan(-12.5983);
            if (player.x > -12.61) wallSamples++;
          }
        }
        expect(player.z, `start ${x}, walk ${walk}`).toBeGreaterThanOrEqual(39);
        expect(player.y).toBeGreaterThan(-1.1);
        expect(player.grounded).toBe(true);
        expect(maximumRise).toBeLessThanOrEqual(18 * 0.0254 + 1e-5);
        expect(wallSamples).toBeGreaterThan(10);
      }
  });
  it("aligns every authored spawn with a solid floor in the native physics export", () => {
    for (const spawn of [...data.spawns.t, ...data.spawns.ct]) {
      const floor = collision.floor(spawn[0], spawn[2], spawn[1] + 0.5, spawn[1] - 2);
      expect(Number.isFinite(floor), JSON.stringify(spawn)).toBe(true);
      expect(spawn[1] - floor).toBeGreaterThan(-0.1);
      expect(spawn[1] - floor).toBeLessThan(1.25);
      const position = new T.Vector3(spawn[0], floor + 0.01, spawn[2]);
      expect(collision.resolveHorizontal(position, 0.3, 1.8)).toBe(true);
      expect(Math.hypot(position.x - spawn[0], position.z - spawn[2])).toBeLessThan(0.15);
    }
  });
  it("physically ascends and descends both native ladders without teleporting through collision", () => {
    expect(data.ladders).toHaveLength(2);
    for (const ladder of data.ladders!)
      for (const climb of [1, -1]) {
        const position = new T.Vector3()
          .fromArray(climb > 0 ? ladder.bottom : ladder.top)
          .addScaledVector(ladderNormal(ladder), 0.42);
        const floor = collision.floor(position.x, position.z, position.y + 0.5, position.y - 0.5);
        if (Number.isFinite(floor)) position.y = floor;
        const state = createLadderState();
        let mounted = 0,
          maximumStep = 0;
        for (let tick = 0; tick < 128 * 3; tick++) {
          const before = position.clone();
          const result = stepLadder(
            position,
            { yaw: 0, pitch: 0, forward: 0, right: 0, jump: false, climb },
            1 / 128,
            data.ladders,
            collision,
            1.82,
            state,
          );
          if (result) mounted++;
          maximumStep = Math.max(maximumStep, before.distanceTo(position));
        }
        const expectedHeight = (climb > 0 ? ladder.exitTop : ladder.exitBottom)![1];
        expect(mounted, `${ladder.id} direction ${climb}`).toBeGreaterThan(50);
        expect(position.y, `${ladder.id} direction ${climb}`).toBeCloseTo(expectedHeight, 1);
        expect(maximumStep).toBeLessThan(0.1);
        expect(state.id).toBeNull();
      }
  });
  it("reverses climb with view pitch, holds on release and jumps away with a remount delay", () => {
    const ladder = data.ladders![0];
    const position = new T.Vector3()
      .fromArray(ladder.bottom)
      .addScaledVector(ladderNormal(ladder), 0.42);
    position.y += 1;
    const state = createLadderState();
    const lookUp = { yaw: Math.PI, pitch: -Math.PI / 2, forward: 1, right: 0, jump: false };
    const up = stepLadder(
      position,
      { ...lookUp, pitch: -Math.PI / 4 },
      1 / 128,
      data.ladders,
      collision,
      1.82,
      state,
    )!;
    expect(up.velocity.y).toBeGreaterThan(0);
    const down = stepLadder(
      position,
      { ...lookUp, pitch: Math.PI / 2 },
      1 / 128,
      data.ladders,
      collision,
      1.82,
      state,
    )!;
    expect(down.velocity.y).toBeLessThan(0);
    const heldY = position.y;
    const hold = stepLadder(
      position,
      { ...lookUp, forward: 0 },
      1 / 128,
      data.ladders,
      collision,
      1.82,
      state,
    )!;
    expect(hold.velocity.length()).toBe(0);
    expect(position.y).toBe(heldY);
    const jump = stepLadder(
      position,
      { ...lookUp, jump: true },
      1 / 128,
      data.ladders,
      collision,
      1.82,
      state,
    )!;
    expect(jump.velocity.dot(ladderNormal(ladder))).toBeGreaterThan(6);
    expect(state.id).toBeNull();
    expect(
      stepLadder(position, { ...lookUp, pitch: 0 }, 1 / 128, data.ladders, collision, 1.82, state),
    ).toBeUndefined();
  });
  it("uses native ladder connections for paths that ordinary walking cannot climb", () => {
    const nav = new Navigation(data);
    for (const ladder of data.ladders!) {
      const path = nav.path(
        new T.Vector3().fromArray(ladder.exitBottom!),
        new T.Vector3().fromArray(ladder.exitTop!),
      );
      expect(path.length).toBeGreaterThan(0);
      expect(
        path.some(
          (position) =>
            Math.abs(position.y - ladder.top[1]) < 0.05 &&
            Math.hypot(position.x - ladder.top[0], position.z - ladder.top[2]) < 0.5,
        ),
      ).toBe(true);
    }
  });
});
