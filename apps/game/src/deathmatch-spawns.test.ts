import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createPlayer } from "@cs2go/simulation/match";
import { movePlayer } from "@cs2go/simulation/movement";
import { neutralInput } from "@cs2go/protocol";
import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { dustCollision } from "@cs2go/simulation/dust-map";
import { Navigation, type MapNavigation } from "./navigation";
import { movement } from "./physics";
import { chooseDeathmatchSpawn, deathmatchSpawnPool } from "./deathmatch-spawns";

describe("Deathmatch spawn safety", () => {
  it("prefers cover and separation, rejects occupied positions and avoids repeating the last life", () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      new Vector3(0, 0, 10),
      new Vector3(30, 0, 0),
    ];
    const actors = [new Vector3(0, 0, 0)];
    const selected = chooseDeathmatchSpawn(
      points,
      actors,
      points[3],
      (from) => from.x > 0,
      () => 0,
    );
    expect(selected).toEqual(points[2]);
    expect(selected).not.toBe(points[2]);
    expect(chooseDeathmatchSpawn([], actors, points[0], () => true)).toBeUndefined();
  });
  for (const map of ["dust2", "mirage"])
    it(`provides distributed grounded standing spawns across ${map}`, async () => {
      const nav = new Navigation(
        JSON.parse(
          readFileSync(
            new URL(`../../../packages/assets/public/models/maps/${map}-nav.json`, import.meta.url),
            "utf8",
          ),
        ) as MapNavigation,
      );
      const bytes = gunzipSync(
        readFileSync(
          new URL(
            `../../../packages/assets/public/models/maps/${map}-physics.glb.gz`,
            import.meta.url,
          ),
        ),
      );
      const model = await new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
      const collision = dustCollision(model.scene).collision;
      const points = deathmatchSpawnPool(nav, collision);
      expect(points.length).toBeGreaterThan(40);
      expect(deathmatchSpawnPool(nav, collision)).toBe(points);
      expect(
        Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
      ).toBeGreaterThan(40);
      expect(
        Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)),
      ).toBeGreaterThan(40);
      for (const p of points) {
        expect(
          collision.blocked(p.x, p.z, p.y + 0.025, movement.hullRadius, movement.standingHeight),
          p.toArray().join(","),
        ).toBe(false);
        expect(
          Number.isFinite(collision.support(p.x, p.z, p.y + 0.05, p.y - 0.05, movement.hullRadius)),
        ).toBe(true);
        expect(nav.support(p.x, p.z, p.y + 0.5, p.y - 0.5)).toBeDefined();
        const player = createPlayer("spawn", "Spawn", "ct");
        Object.assign(player, { x: p.x, y: p.y, z: p.z, grounded: true, waiting: false });
        for (let tick = 0; tick < 16; tick++)
          movePlayer(player, neutralInput(), 1 / 128, { collision, spawns: nav.data.spawns });
        expect(
          Number.isFinite(
            collision.support(
              player.x,
              player.z,
              player.y + 0.1,
              player.y - 0.3,
              movement.hullRadius,
            ),
          ),
          `no hull support after settling ${p.toArray().join(",")} -> ${player.x},${player.y},${player.z}`,
        ).toBe(true);
        expect(
          Math.abs(player.y - p.y),
          `spawn feet move at ${p.toArray().join(",")}`,
        ).toBeLessThan(0.025);
        expect(
          player.grounded,
          `unsettled spawn ${p.toArray().join(",")} -> ${player.x},${player.y},${player.z}`,
        ).toBe(true);
        expect(
          collision.blocked(
            player.x,
            player.z,
            player.y + 0.025,
            movement.hullRadius,
            movement.standingHeight,
          ),
          `blocked after settling ${p.toArray().join(",")}`,
        ).toBe(false);
      }
    });
});
