/** Sniff gzip across arbitrary network chunks, then decode under stream backpressure. */
export async function decodedAssetStream(input: ReadableStream<Uint8Array<ArrayBuffer>>) {
  const reader = input.getReader();
  const prefix: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < 2) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.length) {
        prefix.push(next.value);
        size += next.value.length;
      }
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    reader.releaseLock();
    throw error;
  }
  const first = new Uint8Array(size);
  let offset = 0;
  for (const chunk of prefix) {
    first.set(chunk, offset);
    offset += chunk.length;
  }
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      reader.releaseLock();
    }
  };
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      if (first.length) controller.enqueue(first);
    },
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          release();
        } else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
        release();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
  return first[0] === 0x1f && first[1] === 0x8b
    ? body.pipeThrough(new DecompressionStream("gzip"))
    : body;
}

/** Fetch/Cache responses may already have decoded their HTTP Content-Encoding. */
export async function readAssetBody(response: Response): Promise<ArrayBuffer> {
  const body = response.body ?? new Blob([await response.arrayBuffer()]).stream();
  return new Response(await decodedAssetStream(body)).arrayBuffer();
}

/** Assemble independently compressed native chunks into one bounded allocation.
 * Parts are requested sequentially so large fallback atlases do not retain a
 * second complete decoded copy while joining their transport. */
export async function readAssetParts(
  responses: AsyncIterable<Response>,
  expectedBytes: number,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 2 ** 31)
    throw new Error("Invalid asset part size");
  const output = new Uint8Array(expectedBytes);
  let offset = 0;
  for await (const response of responses) {
    if (!response.ok) throw new Error(`Asset part unavailable (${response.status})`);
    const body = response.body ?? new Blob([await response.arrayBuffer()]).stream();
    const reader = (await decodedAssetStream(body)).getReader();
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        if (next.value.length > output.length - offset)
          throw new Error("Asset parts exceed declared size");
        output.set(next.value, offset);
        offset += next.value.length;
      }
    } catch (error) {
      await reader.cancel(error).catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  if (offset !== output.length) throw new Error("Asset parts do not match declared size");
  return output.buffer;
}
