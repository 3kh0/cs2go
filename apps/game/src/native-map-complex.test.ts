import { expect, test, vi } from "vitest";
import * as T from "three";
import { loadNativeMapComplex } from "./native-map-complex";
import { loadSourceMaterialBundle } from "./source-layers";
import { loadSourceSurfaceLookup } from "./source-surface";
vi.mock("./source-layers", () => ({ loadSourceMaterialBundle: vi.fn() }));
vi.mock("./source-surface", () => ({
  loadSourceSurfaceLookup: vi.fn(),
  applySourceSurface: vi.fn(),
}));
test("a failed shared lookup releases native complex payloads that map ownership never received", async () => {
  const texture = new T.Texture(),
    dispose = vi.spyOn(texture, "dispose");
  vi.mocked(loadSourceMaterialBundle).mockResolvedValue({
    materials: {},
    textures: new Map([
      ["native", texture],
      ["alias", texture],
    ]),
  });
  vi.mocked(loadSourceSurfaceLookup).mockRejectedValue(new Error("lookup unavailable"));
  await expect(loadNativeMapComplex({} as T.WebGLRenderer, "/native/source.json")).rejects.toThrow(
    "lookup unavailable",
  );
  expect(dispose).toHaveBeenCalledTimes(1);
});
test("successful complex loading leaves the shared BRDF lookup outside texture ownership", async () => {
  const texture = new T.Texture(),
    shared = new T.DataTexture();
  vi.mocked(loadSourceMaterialBundle).mockResolvedValue({
    materials: {},
    textures: new Map([["native", texture]]),
  });
  vi.mocked(loadSourceSurfaceLookup).mockResolvedValue(shared);
  const result = await loadNativeMapComplex({} as T.WebGLRenderer, "/native/source.json");
  expect(result.lookup).toBe(shared);
  expect([...result.textures.values()]).toEqual([texture]);
});
