import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
  for (const [url, bytes] of expected) expect(await pack.get(url), url).toEqual(bytes);
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
