import { afterEach, expect, test, vi } from "vitest";
import * as T from "three";
import { existsSync, readFileSync } from "node:fs";
import { gloveInverseBind, sanitizeGloveChoice } from "./gloves";

afterEach(() => vi.unstubAllGlobals());

test("glove choices retain valid imported IDs, isolate invalid input and clamp wear/seed", () => {
  expect(sanitizeGloveChoice({ id: "4725_10085", wear: 0.123456, seed: 749 })).toEqual({
    id: "4725_10085",
    wear: 0.123456,
    seed: 749,
  });
  expect(sanitizeGloveChoice({ id: "../outside", wear: -3, seed: 9000 })).toEqual({
    id: "",
    wear: 0,
    seed: 1000,
  });
  expect(sanitizeGloveChoice({ wear: NaN, seed: Infinity })).toEqual({
    id: "",
    wear: 0.01,
    seed: 1,
  });
});

test("glove inverse-bind conversion preserves native rest shape and follows posed source-inch bones", () => {
  const native = new T.Matrix4().compose(
    new T.Vector3(0.53, 1.12, -0.031),
    new T.Quaternion().setFromEuler(new T.Euler(0.3, -0.8, 1.1)),
    new T.Vector3(1, 1, 1),
  );
  const units = new T.Matrix4().makeScale(0.0254, 0.0254, 0.0254);
  const convert = new T.Matrix4().set(
    0,
    0,
    1 / 0.0254,
    0,
    1 / 0.0254,
    0,
    0,
    0,
    0,
    1 / 0.0254,
    0,
    0,
    0,
    0,
    0,
    1,
  );
  const vertex = new T.Vector3(0.58, 1.04, 0.03);
  const bone = native.clone().multiply(units);
  const inverse = gloveInverseBind(native.clone().invert());
  const converted = vertex.clone().applyMatrix4(convert);
  expect(
    converted.clone().applyMatrix4(inverse).applyMatrix4(bone).distanceTo(vertex),
  ).toBeLessThan(1e-10);
  const pose = new T.Matrix4().makeRotationY(0.7).setPosition(0.1, -0.2, 0.3);
  expect(
    converted
      .clone()
      .applyMatrix4(inverse)
      .applyMatrix4(pose.clone().multiply(bone))
      .distanceTo(vertex.clone().applyMatrix4(pose)),
  ).toBeLessThan(1e-10);
});

test("all glove catalog variants have both native mesh groups and local paint/shader inputs", () => {
  const root = "../../packages/assets/public";
  const catalog = JSON.parse(readFileSync(`${root}/skins/gloves/catalog.json`, "utf8")) as {
    id: string;
    item: number;
    paint: number;
    model: string;
  }[];
  expect(catalog).toHaveLength(96);
  expect(new Set(catalog.map((item) => item.id)).size).toBe(96);
  expect(new Set(catalog.map((item) => item.item)).size).toBe(10);
  expect(catalog.filter((item) => !item.paint)).toHaveLength(2);
  for (const path of new Set(catalog.map((item) => item.model))) {
    const raw = readFileSync(root + path);
    const glb = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString()) as {
      nodes: { name: string }[];
      meshes: { primitives: { material?: number }[] }[];
      materials: unknown[];
    };
    expect(
      glb.nodes.some((node) => node.name.endsWith(".viewmodel")),
      path,
    ).toBe(true);
    expect(
      glb.nodes.some((node) => node.name.endsWith(".worldmodel")),
      path,
    ).toBe(true);
    for (const mesh of glb.meshes)
      for (const primitive of mesh.primitives)
        expect(primitive.material).toBeLessThan(glb.materials.length);
  }
  for (const item of catalog.filter((item) => item.paint)) {
    const paint = readFileSync(`${root}/skins/gloves/paints/${item.id}.json`, "utf8");
    expect(paint).not.toContain("https:");
    for (const path of paint.matchAll(/"(\/skins\/[^"\s]+)"/g))
      expect(existsSync(root + path[1])).toBe(true);
  }
});
