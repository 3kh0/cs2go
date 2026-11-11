import { afterEach, expect, test, vi } from "vitest";
import * as T from "three";
import { existsSync, readFileSync } from "node:fs";
import {
  gloveInverseBind,
  sanitizeGloveChoice,
  unregisterGloveModel,
  updateGloveModel,
} from "./gloves";
import { loadModel } from "./gltf";

vi.mock("./gltf", () => ({ loadModel: vi.fn() }));

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

test("switching gloves reuses skin influences while preserving helper bones and owned cleanup", async () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute([0, 1, 2, 3], 4));
  geometry.setAttribute(
    "skinWeight",
    new T.BufferAttribute(new Float64Array([1, 1e-6, 1.001e-6, 0]), 4),
  );
  const bones = ["hand_l", "threshold", "weighted", "unused"].map((name) => {
    const bone = new T.Bone();
    bone.name = name;
    return bone;
  });
  bones[0].add(...bones.slice(1));
  const material = new T.MeshStandardMaterial();
  const sourceMesh = new T.SkinnedMesh(geometry, material);
  sourceMesh.name = "test.viewmodel";
  sourceMesh.add(bones[0]);
  sourceMesh.bind(new T.Skeleton(bones));
  const scene = new T.Group();
  scene.add(sourceMesh);
  vi.mocked(loadModel).mockResolvedValue({ scene, animations: [] } as unknown as Awaited<
    ReturnType<typeof loadModel>
  >);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "4725_10085",
            paint: 0,
            model: "/models/gloves/test.glb",
          },
        ]),
      ),
    ),
  );
  const root = new T.Group(),
    hand = new T.Bone(),
    finger = new T.Bone();
  hand.name = "hand_l";
  finger.name = "finger_index_meta_l";
  root.add(hand, finger);
  const choice = { id: "4725_10085", wear: 0, seed: 1 };
  const attach = async () => {
    updateGloveModel(root, "t", choice, false, "default-t");
    await vi.waitFor(() => expect(root.getObjectByName("glove-test.viewmodel")).toBeDefined());
    return root.getObjectByName("glove-test.viewmodel") as T.SkinnedMesh;
  };
  let reads: ReturnType<typeof vi.spyOn> | undefined;
  try {
    const first = await attach();
    expect(first.skeleton.bones).toEqual([
      hand,
      hand,
      root.getObjectByName("glove-helper-weighted"),
      hand,
    ]);
    expect(first.skeleton.bones[2].parent).toBe(hand);
    expect(first.skeleton.boneInverses.map((inverse) => inverse.toArray())).toEqual(
      sourceMesh.skeleton.boneInverses.map((inverse) => gloveInverseBind(inverse).toArray()),
    );
    const disposed = vi.spyOn(first.skeleton, "dispose");
    unregisterGloveModel(root);
    expect(disposed).toHaveBeenCalledOnce();
    expect(root.getObjectByName("glove-helper-weighted")).toBeUndefined();
    reads = vi.spyOn(T.BufferAttribute.prototype, "getComponent");
    const second = await attach();
    expect(reads).not.toHaveBeenCalled();
    expect(second.skeleton).not.toBe(first.skeleton);
    expect(second.geometry).toBe(first.geometry);
    expect(second.material).not.toBe(first.material);
    expect(second.skeleton.bones[2].parent).toBe(hand);
    expect(second.skeleton.boneInverses.map((inverse) => inverse.toArray())).toEqual(
      first.skeleton.boneInverses.map((inverse) => inverse.toArray()),
    );
  } finally {
    reads?.mockRestore();
    unregisterGloveModel(root);
  }
});
