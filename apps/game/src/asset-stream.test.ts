import { expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { decodedAssetStream, readAssetBody } from "./asset-stream";

it("decodes gzip with its signature split across network chunks and accepts decoded responses", async () => {
  const original = new TextEncoder().encode("Dust II streaming assets".repeat(1000));
  const compressed = gzipSync(original);
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array(0));
      for (const byte of compressed) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  expect(new Uint8Array(await readAssetBody(new Response(stream)))).toEqual(original);
  expect(new Uint8Array(await readAssetBody(new Response(original)))).toEqual(original);
});

it("delivers decompressed data before the network response ends", async () => {
  const original = new Uint8Array(100000).map((_, i) => i % 251);
  const compressed = new Uint8Array(gzipSync(original));
  let network!: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      network = controller;
      controller.enqueue(compressed.slice(0, -8));
    },
  });
  const reader = (await decodedAssetStream(stream)).getReader();
  const first = await reader.read();
  expect(first.done).toBe(false);
  expect(first.value!.length).toBeGreaterThan(0);
  network.enqueue(compressed.slice(-8));
  network.close();
  while (!(await reader.read()).done) {
    /* drain and validate gzip footer */
  }
});

it("rejects truncated gzip and propagates cancellation upstream", async () => {
  const compressed = new Uint8Array(gzipSync("test"));
  await expect(readAssetBody(new Response(compressed.slice(0, -4)))).rejects.toThrow();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array([65, 66]));
    },
    cancel() {
      cancelled = true;
    },
  });
  await (await decodedAssetStream(stream)).cancel();
  expect(cancelled).toBe(true);
});
