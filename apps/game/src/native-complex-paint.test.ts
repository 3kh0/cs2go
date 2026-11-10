import { expect, test, vi } from "vitest";
import * as T from "three";
import { loadGzipped } from "./gltf";
import { loadNativeComplexPaint } from "./native-complex-paint";
import { MapResources } from "./map-resources";
vi.mock("./gltf", () => ({ loadGzipped: vi.fn() }));
function source(control: T.BufferAttribute) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute("color", control);
  const material = new T.MeshStandardMaterial();
  material.name = "source-paint";
  Object.assign(material.userData, {
    nativeGltfMaterialIndex: 0,
    nativeSourceMaterialIndex: 29,
    nativeComplexRawControl: true,
  });
  const mesh = new T.Mesh(geometry, material),
    scene = new T.Group();
  scene.add(mesh);
  vi.mocked(loadGzipped).mockResolvedValue({ scene } as Awaited<ReturnType<typeof loadGzipped>>);
  const bundle = {
    paint: {
      model: "/paint.glb.gz",
      originalMainMaterialIndices: [29],
      materialBindings: [
        {
          packedMaterialIndex: 0,
          originalMaterialIndex: 29,
          name: material.name,
          baseColorFactor: [1, 1, 1, 1],
        },
      ],
    },
  } as Awaited<ReturnType<typeof import("./native-map-complex").loadNativeMapComplex>>;
  return { mesh, bundle, resources: new MapResources() };
}
test("native paint accepts the original FLOAT4 control without display-color conversion", async () => {
  const control = new T.Float32BufferAttribute([0, 0, 0, 1], 4),
    fixture = source(control);
  try {
    const result = await loadNativeComplexPaint(fixture.bundle, fixture.resources);
    expect(result?.root).toBe(fixture.mesh.parent);
    expect(fixture.mesh.geometry.getAttribute("nativeComplexPaint")).toBe(control);
    expect([...control.array]).toEqual([0, 0, 0, 1]);
  } finally {
    fixture.resources.dispose();
  }
});
test("normalized BYTE4 packing cannot silently replace the source FLOAT4 contract", async () => {
  const fixture = source(new T.Uint8BufferAttribute([0, 0, 0, 255], 4, true));
  try {
    await expect(loadNativeComplexPaint(fixture.bundle, fixture.resources)).rejects.toThrow(
      "original FLOAT4",
    );
  } finally {
    fixture.resources.dispose();
  }
});
