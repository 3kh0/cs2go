import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, test } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { dustCollision } from "@cs2go/simulation/dust-map";
import { Navigation, type MapNavigation } from "./navigation";
import { teamPreviewGround } from "./team-preview-ground";
import { movement } from "./physics";

/** Actual primitive/node geometry and winding, without CPU image fetches. */
async function renderGeometry(bytes: Buffer) {
  const jsonSize = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  data.materials = data.materials?.map((material: { name?: string; doubleSided?: boolean }) => ({
    name: material.name,
    doubleSided: material.doubleSided,
  }));
  delete data.images;
  delete data.textures;
  delete data.samplers;
  const json = Buffer.from(JSON.stringify(data));
  const padded = Buffer.concat([json, Buffer.alloc(-json.length & 3, 32)]);
  const bin = bytes.subarray(20 + jsonSize);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + bin.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, padded, bin]);
  const asset = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");
  asset.scene.updateMatrixWorld(true);
  return asset.scene;
}

test.each(["vertigo", "nuke", "inferno", "cache"])(
  "%s team previews find actual floor across desktop aspect ratios",
  async (map) => {
    const base = new URL("../../../packages/assets/public/models/maps/", import.meta.url);
    const bytes = gunzipSync(readFileSync(new URL(`${map}-physics.glb.gz`, base)));
    const model = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const collision = dustCollision(model.scene).collision;
    const scenery = await renderGeometry(gunzipSync(readFileSync(new URL(`${map}.glb.gz`, base))));
    const data = JSON.parse(
      readFileSync(new URL(`${map}-nav.json`, base), "utf8"),
    ) as MapNavigation;
    const world = { config: {}, navigation: new Navigation(data, collision), collision, scenery };
    const camera = new T.PerspectiveCamera(75, 1, 0.05, 254);
    for (const aspect of [4 / 3, 16 / 10, 16 / 9, 21 / 9]) {
      const grounds = teamPreviewGround(camera, world, aspect);
      expect(grounds).toHaveLength(2);
      for (const [index, ground] of grounds.entries()) {
        expect(ground.face!.normal.y).toBeGreaterThan(0.7);
        expect(ground.distance).toBeLessThanOrEqual(12);
        const screen = ground.point.clone().project(camera);
        expect(screen.x).toBeCloseTo(index === 0 ? -0.48 : 0.48, 6);
        expect(screen.y).toBeCloseTo(-0.86, 6);
        expect(
          collision.blocked(
            ground.point.x,
            ground.point.z,
            ground.point.y + 0.005,
            movement.hullRadius,
            movement.standingHeight,
          ),
        ).toBe(false);
        expect(
          collision.visible(
            camera.position,
            ground.point.clone().add(new T.Vector3(0, movement.standingEye, 0)),
          ),
        ).toBe(true);
        if (map === "vertigo") expect(ground.point.y).toBeGreaterThan(290);
      }
    }
    const position = camera.position.toArray();
    const target = camera.position.clone().add(camera.getWorldDirection(new T.Vector3())).toArray();
    teamPreviewGround(camera, { ...world, config: { teamCamera: { position, target } } }, 21 / 9);
    expect(camera.position.toArray()).toEqual(position);
    expect(() =>
      teamPreviewGround(
        camera,
        {
          ...world,
          scenery: new T.Group(),
          config: { teamCamera: { position, target } },
        },
        21 / 9,
      ),
    ).toThrow("Team preview floor unavailable");
    expect(() =>
      teamPreviewGround(
        camera,
        {
          ...world,
          collision: { intersections: () => [], blocked: () => false, visible: () => true },
        },
        16 / 10,
      ),
    ).toThrow("Team preview floor unavailable");
  },
);
