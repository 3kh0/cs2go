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
  const loading = createSourceGpuProbes("/native/", records, metadata);
  complete(new ArrayBuffer(576));
  await expect(loading).rejects.toThrow("missing shadows");
  expect(disposed).toHaveBeenCalledTimes(1);
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
