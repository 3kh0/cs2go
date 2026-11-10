import { expect, test } from "vitest";
import { Material, MeshStandardMaterial, Texture } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { tagGltfMaterialIndices } from "./gltf";
test("native packed material identity follows parser slots and material clones without tagging textures", () => {
  const a = new MeshStandardMaterial(),
    b = new Material(),
    texture = new Texture();
  a.name = b.name = "same";
  a.userData.existing = "retained";
  const associations = new Map<Material | Texture, { materials?: number; textures?: number }>([
    [a, { materials: 263 }],
    [b, { materials: 273 }],
    [texture, { textures: 3 }],
  ]) as GLTF["parser"]["associations"];
  const asset = { parser: { associations } } as Pick<GLTF, "parser">;
  expect(tagGltfMaterialIndices(asset)).toBe(asset);
  expect(a.userData).toEqual({ existing: "retained", nativeGltfMaterialIndex: 263 });
  expect(b.userData.nativeGltfMaterialIndex).toBe(273);
  const clone = a.clone();
  expect(clone.userData.nativeGltfMaterialIndex).toBe(263);
  expect(texture.userData.nativeGltfMaterialIndex).toBeUndefined();
  a.dispose();
  b.dispose();
  clone.dispose();
  texture.dispose();
});

test("actual GLTFLoader material variants retain one native slot before tagging", async () => {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const vertices = new Float32Array([
    -1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0.5, 1, 1, 0, 0, 0, 1, 0, 0,
    0, 1,
  ]);
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: vertices.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 36 },
      { buffer: 0, byteOffset: 72, byteLength: 24 },
      { buffer: 0, byteOffset: 96, byteLength: 36 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC2" },
      { bufferView: 3, componentType: 5126, count: 3, type: "VEC3" },
    ],
    materials: [{ name: "same" }],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0 }] },
      {
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 }, material: 0 },
        ],
      },
      // Physics GLBs use the loader's default material, whose association is
      // undefined. It has no native packed material slot to invent.
      { primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] },
    ],
    nodes: [{ mesh: 0 }, { mesh: 1 }, { mesh: 2 }],
    scenes: [{ nodes: [0, 1, 2] }],
    scene: 0,
  };
  const text = new TextEncoder().encode(JSON.stringify(json)),
    length = (text.length + 3) & ~3,
    bytes = new Uint8Array(12 + 8 + length + 8 + vertices.byteLength),
    view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + length);
  bytes.set(text, 20);
  view.setUint32(20 + length, vertices.byteLength, true);
  view.setUint32(24 + length, 0x004e4942, true);
  bytes.set(new Uint8Array(vertices.buffer), 28 + length);
  const asset = tagGltfMaterialIndices(await new GLTFLoader().parseAsync(bytes.buffer, "")),
    materials = new Set<Material>();
  asset.scene.traverse((object) => {
    if ("material" in object) materials.add(object.material as Material);
  });
  expect(materials.size).toBe(3);
  expect([...materials].map((material) => material.userData.nativeGltfMaterialIndex)).toEqual([
    0,
    0,
    undefined,
  ]);
  for (const material of materials) material.dispose();
  asset.scene.traverse((object) => {
    if ("geometry" in object) (object.geometry as { dispose(): void }).dispose();
  });
});
