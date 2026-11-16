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
const renderer = {
  extensions: { has: () => true },
  getContext: () => ({
    getExtension: () => null,
    getParameter: () => "WebKit WebGL",
    getContextAttributes: () => null,
  }),
} as unknown as T.WebGLRenderer;
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

test("native BC5 retains RGTC2 blocks and its partial authored mip chain", async () => {
  const bytes = Uint8Array.from({ length: 80 }, (_, i) => i),
    has = vi.fn((name: string) => name === "EXT_texture_compression_rgtc");
  transport.assetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        materials: {},
        textures: {
          normal: {
            format: "BC5",
            srgb: false,
            file: "normal.bin.gz",
            gpuBytes: 80,
            mips: [
              { width: 8, height: 8, bytes: 64 },
              { width: 4, height: 4, bytes: 16 },
            ],
          },
        },
      }),
    ),
  );
  transport.fetchGzipped.mockResolvedValue(bytes.buffer);
  const result = await loadSourceMaterialBundle(
    { ...renderer, extensions: { has } } as unknown as T.WebGLRenderer,
    "/native/",
  );
  const texture = result.textures.get("normal") as T.CompressedTexture;
  expect(has.mock.calls).toEqual([["EXT_texture_compression_rgtc"]]);
  expect(texture.format).toBe(T.RED_GREEN_RGTC2_Format);
  expect(texture.mipmaps.map((m) => [m.width, m.height])).toEqual([
    [8, 8],
    [4, 4],
  ]);
  expect([...texture.mipmaps[1].data]).toEqual(Array.from(bytes.slice(64)));
  expect(texture.colorSpace).toBe(T.NoColorSpace);
  texture.dispose();
});
test("BC5 without RGTC uses exact RGBA authored mips rather than a BC1 upload or regenerated tail", async () => {
  const bytes = Uint8Array.from({ length: 320 }, (_, i) => [51, 102, 0, 255][i % 4]);
  transport.assetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        materials: {},
        textures: {
          normal: {
            format: "BC5",
            srgb: false,
            file: "native.bin.gz",
            gpuBytes: 80,
            mips: [
              { width: 8, height: 8, bytes: 64 },
              { width: 4, height: 4, bytes: 16 },
            ],
            fallbackFile: "normal.rgba8.gz",
            fallbackMips: [
              { width: 8, height: 8, bytes: 256 },
              { width: 4, height: 4, bytes: 64 },
            ],
          },
        },
      }),
    ),
  );
  transport.fetchGzipped.mockResolvedValue(bytes.buffer);
  const result = await loadSourceMaterialBundle(
    { ...renderer, extensions: { has: () => false } } as unknown as T.WebGLRenderer,
    "/native/",
  );
  const texture = result.textures.get("normal") as T.DataTexture;
  expect(transport.fetchGzipped.mock.calls.map((c) => c[0])).toEqual(["/native/normal.rgba8.gz"]);
  expect(texture.isDataTexture).toBe(true);
  expect(texture.generateMipmaps).toBe(false);
  expect(texture.mipmaps.map((m) => [m.width, m.height])).toEqual([
    [8, 8],
    [4, 4],
  ]);
  expect(Array.from(texture.image.data!.slice(0, 4))).toEqual([51, 102, 0, 255]);
  texture.dispose();
});
test("invalid BC5 block dimensions fail before driver texture upload", async () => {
  transport.assetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        materials: {},
        textures: {
          normal: {
            format: "BC5",
            srgb: false,
            file: "normal.bin.gz",
            gpuBytes: 16,
            mips: [{ width: 8, height: 4, bytes: 16 }],
          },
        },
      }),
    ),
  );
  await expect(loadSourceMaterialBundle(renderer, "/native/")).rejects.toThrow(
    "Invalid native BC5 mip shape",
  );
});

test.each([
  ["ANGLE (Google, Vulkan SwiftShader)", false, true],
  ["ANGLE (Google, Vulkan SwiftShader)", true, false],
  ["ANGLE (Intel UHD Graphics)", false, false],
  ["WebKit WebGL", false, false],
  ["llvmpipe (LLVM 15)", false, false],
] as const)(
  "BC7 storage on %s preserves the complete authored chain (short fallback: %s)",
  async (name, short, decoded) => {
    const native = Uint8Array.from({ length: 48 }, (_, i) => i + 1);
    const rgba = Uint8Array.from({ length: 160 }, (_, i) => (i * 13) % 256);
    const mips = [
      { width: 4, height: 8, bytes: 32 },
      { width: 2, height: 4, bytes: 16 },
    ];
    const fallbackMips = [
      { width: 4, height: 8, bytes: 128 },
      { width: 2, height: 4, bytes: 32 },
    ];
    transport.assetFetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            materials: {},
            textures: {
              color: {
                format: "BC7",
                srgb: true,
                file: "native.bin.gz",
                gpuBytes: native.length,
                mips,
                fallbackFile: "color.rgba8.gz",
                fallbackMips: short ? fallbackMips.slice(0, 1) : fallbackMips,
              },
            },
          }),
        ),
    );
    transport.fetchGzipped.mockImplementation(async (path: string) =>
      path.endsWith("rgba8.gz") ? rgba.buffer : native.buffer,
    );
    const result = await loadSourceMaterialBundle(
      {
        ...renderer,
        getContext: () => ({ ...renderer.getContext(), getParameter: () => name }),
      } as unknown as T.WebGLRenderer,
      "/native/",
    );
    const image = result.textures.get("color")!;
    expect(image.format).toBe(decoded ? T.RGBAFormat : T.RGBA_BPTC_Format);
    expect(image.mipmaps.map((mip) => [mip.width, mip.height])).toEqual([
      [4, 8],
      [2, 4],
    ]);
    const bytes = image.mipmaps.flatMap((mip) => Array.from((mip as { data: Uint8Array }).data));
    expect(bytes).toEqual(Array.from(decoded ? rgba : native));
    expect(image.colorSpace).toBe(T.SRGBColorSpace);
    expect(image.minFilter).toBe(T.LinearMipmapLinearFilter);
    expect(image.generateMipmaps).toBe(false);
    image.dispose();
  },
);
