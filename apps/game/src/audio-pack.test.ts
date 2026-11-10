import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { parseAudioPack, streamAudioPack } from "./audio-pack";

it("streams the shipped pack byte for byte across arbitrary chunk boundaries", async () => {
  const file = new Uint8Array(readFileSync("../../packages/assets/public/audio/startup.bin"));
  const expected = parseAudioPack(file.buffer);
  let offset = 0;
  const pack = await streamAudioPack(
    new ReadableStream({
      pull(controller) {
        if (offset === file.length) return controller.close();
        const end = Math.min(file.length, offset + 7919);
        controller.enqueue(file.slice(offset, end));
        offset = end;
      },
    }),
  );
  for (const [url, bytes] of expected) {
    const actual = await pack.get(url);
    expect(actual, url).toBeDefined();
    // Native byte comparison avoids spending the timeout in millions of matcher comparisons.
    expect(Buffer.from(actual!).equals(Buffer.from(bytes)), url).toBe(true);
  }
  await pack.completed;
});

it("resolves an early clip while the remaining download is held open", async () => {
  const file = new Uint8Array(readFileSync("../../packages/assets/public/audio/startup.bin"));
  const expected = parseAudioPack(file.buffer);
  const [firstUrl, firstBytes] = expected.entries().next().value!;
  const end = 12 + new DataView(file.buffer).getUint32(8, true) + firstBytes.length;
  let network!: ReadableStreamDefaultController<Uint8Array>;
  const pack = await streamAudioPack(
    new ReadableStream({
      start(controller) {
        network = controller;
        controller.enqueue(file.slice(0, end));
      },
    }),
  );
  expect(await pack.get(firstUrl)).toEqual(firstBytes);
  network.enqueue(file.slice(end));
  network.close();
  await pack.completed;
});

it("rejects truncated and trailing data instead of completing startup with an invalid bank", async () => {
  const file = new Uint8Array(readFileSync("../../packages/assets/public/audio/startup.bin"));
  for (const bytes of [file.slice(0, -1), new Uint8Array([...file, 0])]) {
    const pack = await streamAudioPack(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    );
    const last = [...parseAudioPack(file.buffer).keys()].at(-1)!;
    await expect(pack.get(last)).rejects.toThrow();
    await expect(pack.completed).rejects.toThrow();
  }
});

it("the real mixed startup bank preserves native door WAV hashes, channels and sample frames", async () => {
  const { createHash } = await import("node:crypto");
  const file = new Uint8Array(readFileSync("../../packages/assets/public/audio/startup.bin"));
  const clips = parseAudioPack(file.buffer);
  const native = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/map-door-sounds.json", "utf8"),
  ) as {
    clips: {
      path: string;
      outputSha256: string;
      channels: number;
      sampleRate: number;
      durationSeconds: number;
    }[];
  };
  expect(native.clips.length).toBeGreaterThan(0);
  expect([...clips.keys()]).toEqual(expect.arrayContaining(native.clips.map((clip) => clip.path)));
  for (const reference of native.clips) {
    const bytes = clips.get(reference.path)!;
    expect(bytes, reference.path).toBeDefined();
    expect(createHash("sha256").update(bytes).digest("hex"), reference.path).toBe(
      reference.outputSha256,
    );
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(header.getUint16(22, true)).toBe(reference.channels);
    expect(header.getUint32(24, true)).toBe(reference.sampleRate);
    // Source2Viewer's sealed canonical PCM WAVs have a 44-byte RIFF header.
    expect((bytes.length - 44) / (reference.channels * 2)).toBe(
      Math.round(reference.durationSeconds * reference.sampleRate),
    );
  }
});

function singleClipPack(url: string, payload: Uint8Array) {
  const index = new TextEncoder().encode(
    JSON.stringify([{ url, offset: 0, length: payload.length }]),
  );
  const bytes = new Uint8Array(12 + index.length + payload.length),
    view = new DataView(bytes.buffer);
  view.setUint32(0, 0x50445541, true);
  view.setUint32(4, 1, true);
  view.setUint32(8, index.length, true);
  bytes.set(index, 12);
  bytes.set(payload, 12 + index.length);
  return bytes;
}
it("packed extensions must match Ogg or complete supported native PCM WAV data", () => {
  const native = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/map-door-sounds.json", "utf8"),
  ).clips[0];
  const wav = new Uint8Array(readFileSync("../../packages/assets/public" + native.path));
  expect(parseAudioPack(singleClipPack(native.path, wav).buffer).size).toBe(1);
  expect(() => parseAudioPack(singleClipPack("/audio/source/test.ogg", wav).buffer)).toThrow("Ogg");
  expect(() =>
    parseAudioPack(
      singleClipPack("/audio/source/test.wav", new Uint8Array([79, 103, 103, 83])).buffer,
    ),
  ).toThrow("PCM WAV");
  const broken = wav.slice();
  new DataView(broken.buffer).setUint32(4, wav.length, true);
  expect(() => parseAudioPack(singleClipPack(native.path, broken).buffer)).toThrow("PCM WAV");
  const wrongFormat = wav.slice();
  new DataView(wrongFormat.buffer).setUint16(34, 8, true);
  expect(() => parseAudioPack(singleClipPack(native.path, wrongFormat).buffer)).toThrow(
    "PCM WAV format",
  );
  expect(() => parseAudioPack(singleClipPack("/audio/source/../test.wav", wav).buffer)).toThrow(
    "pack clip",
  );
});
