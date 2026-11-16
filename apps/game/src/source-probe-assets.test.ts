import { afterEach, expect, test, vi } from "vitest";
import * as T from "three";
import { fetchGzipped } from "./gltf";
import { createSourceGpuProbes } from "./source-gpu-probes";
import { probeFrameKeys, type SourceProbeFrame } from "./source-probe-frames";
vi.mock("./gltf", () => ({ fetchGzipped: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const metadata = {
  volumes: [Object.fromEntries(probeFrameKeys.map((key) => [key, [1, 1, 1]])) as SourceProbeFrame],
  skySH: [[0, 0, 0, 0]],
};
const records = [
  { file: "irradiance", format: "RGB16F", width: 4, height: 4, layers: 6, gpuBytes: 576 },
  { file: "shadows", format: "RGBA8", width: 4, height: 4, layers: 1, gpuBytes: 64 },
];
test("failed probe load waits for and disposes the other asynchronously completed atlas", async () => {
  let complete!: (value: ArrayBuffer) => void;
  vi.mocked(fetchGzipped).mockImplementation((path) =>
    path.endsWith("irradiance")
      ? new Promise((resolve) => {
          complete = resolve;
        })
      : Promise.reject(new Error("missing shadows")),
  );
  const disposed = vi.spyOn(T.DataArrayTexture.prototype, "dispose");
  const loading = createSourceGpuProbes("/native/", records, metadata, 2);
  complete(new ArrayBuffer(576));
  await expect(loading).rejects.toThrow("missing shadows");
  expect(disposed).toHaveBeenCalledTimes(3);
});
test("invalid probe sizes and ambiguous transport fail before fetching payloads", async () => {
  const request = vi.mocked(fetchGzipped).mockClear();
  await expect(
    createSourceGpuProbes(
      "/native/",
      records.map((r) => ({ ...r, gpuBytes: -1 })),
      metadata,
    ),
  ).rejects.toThrow("blocks");
  expect(request).not.toHaveBeenCalled();
  await expect(
    createSourceGpuProbes(
      "/native/",
      records.map((r) => ({ ...r, files: ["another"] })),
      metadata,
    ),
  ).rejects.toThrow("transport");
  expect(request).not.toHaveBeenCalled();
});

test.each([false, true])(
  "split probe banks preserve every layer and shared payload (decoded=%s)",
  async (decoded) => {
    const arrays = [
      {
        file: "irradiance",
        format: decoded ? "RGB16F" : "BC6H",
        width: 4,
        height: 4,
        layers: 42,
        gpuBytes: 42 * (decoded ? 96 : 16),
      },
      {
        file: "shadows",
        format: decoded ? "RGBA8" : "BC7",
        width: 4,
        height: 4,
        layers: 7,
        gpuBytes: 7 * (decoded ? 64 : 16),
      },
    ];
    const payloads = arrays.map((entry, index) =>
      Uint8Array.from({ length: entry.gpuBytes }, (_, byte) => (byte * 17 + index * 59) % 251),
    );
    vi.mocked(fetchGzipped).mockImplementation(
      async (path) => payloads[path.endsWith("irradiance") ? 0 : 1].buffer,
    );
    const probes = await createSourceGpuProbes("/native/", arrays, metadata, 5);
    expect(probes.depth).toBe(7);
    expect(probes.irradianceBanks).toBe(9);
    expect(probes.textures.map((texture) => texture.image.depth)).toEqual([
      5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 2,
    ]);
    for (const [index, banks] of [
      probes.textures.slice(0, 9),
      probes.textures.slice(9),
    ].entries()) {
      let offset = 0;
      for (const bank of banks) {
        const data = bank instanceof T.DataArrayTexture ? bank.image.data : bank.mipmaps[0].data;
        if (!data) throw new Error("Missing probe payload");
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        expect(bytes).toEqual(payloads[index].subarray(offset, offset + bytes.byteLength));
        expect(data.buffer).toBe(payloads[index].buffer);
        expect(bank.generateMipmaps).toBe(false);
        expect(bank.minFilter).toBe(T.LinearFilter);
        offset += bytes.byteLength;
        bank.dispose();
      }
      expect(offset).toBe(arrays[index].gpuBytes);
    }
  },
);
