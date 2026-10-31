import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { parseAudioPack } from "./audio-bank";

function fixture(index: unknown, body = new Uint8Array([79, 103, 103, 83])) {
  const json = new TextEncoder().encode(JSON.stringify(index));
  const bytes = new Uint8Array(12 + json.length + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x50445541, true);
  view.setUint32(4, 1, true);
  view.setUint32(8, json.length, true);
  bytes.set(json, 12);
  bytes.set(body, 12 + json.length);
  return bytes.buffer;
}
const entry = { url: "/audio/test.ogg", offset: 0, length: 4 };
afterEach(() => vi.unstubAllGlobals());
describe("packed startup audio", () => {
  it("preserves every bundled clip byte for byte", () => {
    const file = readFileSync("../../packages/assets/public/audio/startup.bin");
    const clips = parseAudioPack(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    );
    const manifest = JSON.parse(
      readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
    );
    for (const clip of manifest.clips) {
      if (!clip.name.startsWith("music-"))
        expect(clips.has(`/audio/source/${clip.name}.ogg`)).toBe(true);
    }
    expect(clips.size).toBeGreaterThan(200);
    for (const [url, bytes] of clips) {
      expect(readFileSync(`../../packages/assets/public${url}`).equals(bytes), url).toBe(true);
    }
  });
  it("rejects truncation, duplicate URLs, overlapping offsets and external paths", () => {
    expect(() => parseAudioPack(new ArrayBuffer(0))).toThrow();
    expect(() => parseAudioPack(fixture([{ ...entry, length: 5 }]))).toThrow();
    expect(() => parseAudioPack(fixture([entry, entry]))).toThrow();
    expect(() => parseAudioPack(fixture([{ ...entry, offset: 1 }]))).toThrow();
    expect(() =>
      parseAudioPack(fixture([{ ...entry, url: "https://example.com/a.ogg" }])),
    ).toThrow();
    expect(() => parseAudioPack(fixture([entry], new Uint8Array(4)))).toThrow();
  });
  it("rejects missing packs coherently and permits a later retry", async () => {
    vi.resetModules();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fixture([entry]),
      });
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        async decodeAudioData() {
          return {} as AudioBuffer;
        }
      },
    );
    const { loadAudioClip } = await import("./audio-bank");
    await expect(loadAudioClip(entry.url)).rejects.toThrow("Audio pack unavailable");
    await expect(loadAudioClip(entry.url)).resolves.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shares one fetch, bounds simultaneous decodes, and retries failures", async () => {
    vi.resetModules();
    const names = Array.from({ length: 8 }, (_, i) => `/audio/test${i}.ogg`);
    const data = fixture(
      names.map((url, i) => ({ url, offset: i * 4, length: 4 })),
      new Uint8Array(Array.from({ length: 8 }, () => [79, 103, 103, 83]).flat()),
    );
    const fetcher = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => data });
    vi.stubGlobal("fetch", fetcher);
    let active = 0,
      peak = 0,
      fail = true;
    const decode = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (fail) {
        fail = false;
        throw new Error("decode failed");
      }
      return {} as AudioBuffer;
    });
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = decode;
      },
    );
    const { loadAudioClip } = await import("./audio-bank");
    const first = loadAudioClip(names[0]!);
    expect(loadAudioClip(names[0]!)).toBe(first);
    const results = await Promise.allSettled([first, ...names.slice(1).map(loadAudioClip)]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(peak).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loadAudioClip(names[0]!);
    expect(decode).toHaveBeenCalledTimes(9);
  });
});
