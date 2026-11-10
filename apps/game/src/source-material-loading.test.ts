import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as T from "three";
const transport = vi.hoisted(() => ({ assetFetch: vi.fn(), fetchGzipped: vi.fn() }));
vi.mock("./asset-url", () => ({
  assetFetch: transport.assetFetch,
  assetUrl: (path: string) => path,
}));
vi.mock("./gltf", () => ({ fetchGzipped: transport.fetchGzipped }));
import { loadSourceMaterialBundle } from "./source-layers";
const texture = (file: string) => ({
  format: "BC7",
  srgb: false,
  file,
  gpuBytes: 16,
  mips: [{ width: 4, height: 4, bytes: 16 }],
});
const renderer = { extensions: { has: () => true } } as unknown as T.WebGLRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  transport.fetchGzipped.mockResolvedValue(new Uint8Array(16).buffer);
});
afterEach(() => vi.restoreAllMocks());
test("material selection restricts requests before loading while preserving complete source definitions", async () => {
  const materials = {
    active: { resource: "native/active" },
    dormant: { resource: "native/dormant" },
  };
  transport.assetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        materials,
        textures: { used: texture("used.bin.gz"), unused: texture("unused.bin.gz") },
      }),
    ),
  );
  const select = vi.fn(() => new Set(["used"]));
  const result = await loadSourceMaterialBundle(renderer, "/native/", select);
  expect(select).toHaveBeenCalledWith(materials);
  expect(result.materials).toEqual(materials);
  expect(transport.fetchGzipped.mock.calls.map((call) => call[0])).toEqual(["/native/used.bin.gz"]);
  expect([...result.textures.keys()]).toEqual(["used"]);
  result.textures.forEach((texture) => texture.dispose());
});
test("unknown selected IDs fail before payload requests rather than silently losing an active native map", async () => {
  transport.assetFetch.mockResolvedValue(
    new Response(JSON.stringify({ materials: {}, textures: {} })),
  );
  await expect(
    loadSourceMaterialBundle(renderer, "/native/", () => new Set(["missing"])),
  ).rejects.toThrow("texture definition missing: missing");
  expect(transport.fetchGzipped).not.toHaveBeenCalled();
});
test("failed material loading waits for in-flight textures and disposes every completed owned texture", async () => {
  transport.assetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        materials: {},
        textures: {
          used: texture("used.bin.gz"),
          bad: texture("bad.bin.gz"),
          late: texture("late.bin.gz"),
        },
      }),
    ),
  );
  let completeLate: ((data: ArrayBuffer) => void) | undefined;
  transport.fetchGzipped.mockImplementation((path: string) =>
    path.includes("bad")
      ? Promise.reject(new Error("broken native payload"))
      : path.includes("late")
        ? new Promise<ArrayBuffer>((resolve) => {
            completeLate = resolve;
          })
        : Promise.resolve(new Uint8Array(16).buffer),
  );
  const dispose = vi.spyOn(T.Texture.prototype, "dispose");
  const pending = loadSourceMaterialBundle(renderer, "/native/");
  await vi.waitFor(() => expect(completeLate).toBeTypeOf("function"));
  expect(dispose).not.toHaveBeenCalled();
  completeLate!(new Uint8Array(16).buffer);
  await expect(pending).rejects.toThrow("broken native payload");
  expect(dispose).toHaveBeenCalledTimes(2);
});
