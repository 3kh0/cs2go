import { expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { decodedAssetStream, readAssetBody, readAssetParts } from "./asset-stream";

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

it("assembles exact native atlas bytes from mixed decoded and gzip parts without requiring aligned chunks", async () => {
  const original = new Uint8Array(513).map((_, i) => i % 251);
  async function* responses() {
    yield new Response(gzipSync(original.slice(0, 73)));
    yield new Response(original.slice(73, 201)); // HTTP Content-Encoding already decoded.
    yield new Response(gzipSync(original.slice(201)));
  }
  expect(new Uint8Array(await readAssetParts(responses(), original.length))).toEqual(original);
});

it("rejects incomplete atlas transport and stops before requesting later parts after failure", async () => {
  let later = false;
  async function* missing() {
    yield new Response(new Uint8Array([1, 2]));
    yield new Response(null, { status: 404 });
    later = true;
    yield new Response(new Uint8Array([3, 4]));
  }
  await expect(readAssetParts(missing(), 4)).rejects.toThrow("404");
  expect(later).toBe(false);
  async function* short() {
    yield new Response(new Uint8Array([1, 2]));
  }
  await expect(readAssetParts(short(), 3)).rejects.toThrow("declared size");
});

it("cancels oversized atlas parts under stream backpressure", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
    },
    cancel() {
      cancelled = true;
    },
  });
  async function* responses() {
    yield new Response(body);
  }
  await expect(readAssetParts(responses(), 3)).rejects.toThrow("exceed");
  expect(cancelled).toBe(true);
});
