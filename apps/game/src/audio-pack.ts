type Entry = { url: string; length: number };
const invalid = (message: string): never => {
  throw new Error(message);
};
function indexLength(bytes: Uint8Array) {
  if (bytes.length < 12) return invalid("Invalid audio pack header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x50445541 || view.getUint32(4, true) !== 1)
    return invalid("Invalid audio pack header");
  const length = view.getUint32(8, true);
  if (length > 1024 * 1024) return invalid("Invalid audio pack index");
  return length;
}
function parseIndex(bytes: Uint8Array): Entry[] {
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(value) || !value.length || value.length > 4096)
    return invalid("Invalid audio pack index");
  const result: Entry[] = [],
    urls = new Set<string>();
  let offset = 0;
  for (const row of value as unknown[]) {
    if (!row || typeof row !== "object") return invalid("Invalid audio pack clip");
    const entry = row as Record<string, unknown>;
    if (
      typeof entry.url !== "string" ||
      !/^\/audio\/(?:source\/)?[a-z0-9_-]+\.ogg$/.test(entry.url) ||
      urls.has(entry.url) ||
      entry.offset !== offset ||
      typeof entry.length !== "number" ||
      !Number.isSafeInteger(entry.length) ||
      entry.length < 4 ||
      entry.length > 8 * 1024 * 1024
    )
      return invalid("Invalid audio pack clip");
    offset += entry.length;
    if (offset > 64 * 1024 * 1024) return invalid("Invalid audio pack clip");
    urls.add(entry.url);
    result.push({ url: entry.url, length: entry.length });
  }
  return result;
}
function validClip(bytes: Uint8Array) {
  if (bytes[0] !== 79 || bytes[1] !== 103 || bytes[2] !== 103 || bytes[3] !== 83)
    invalid("Invalid packed Ogg clip");
  return bytes;
}
/** Lossless local Opus container; music remains streamed separately. */
export function parseAudioPack(data: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(data),
    end = 12 + indexLength(bytes);
  if (end > bytes.length) return invalid("Truncated audio pack index");
  const clips = new Map<string, Uint8Array>();
  let offset = end;
  for (const entry of parseIndex(bytes.subarray(12, end))) {
    if (offset + entry.length > bytes.length) return invalid("Truncated audio pack clip");
    clips.set(entry.url, validClip(bytes.subarray(offset, offset + entry.length)));
    offset += entry.length;
  }
  if (offset !== bytes.length) invalid("Unindexed audio pack bytes");
  return clips;
}
class PackReader {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  chunk: Uint8Array = new Uint8Array(0);
  offset = 0;
  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }
  async available() {
    while (this.offset === this.chunk.length) {
      const next = await this.reader.read();
      if (next.done) return false;
      this.chunk = next.value;
      this.offset = 0;
    }
    return true;
  }
  async take(length: number) {
    const result = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      if (!(await this.available())) return invalid("Truncated audio pack");
      const size = Math.min(length - offset, this.chunk.length - this.offset);
      result.set(this.chunk.subarray(this.offset, this.offset + size), offset);
      this.offset += size;
      offset += size;
    }
    return result;
  }
}
export type StreamingAudioPack = {
  get(url: string): Promise<Uint8Array> | undefined;
  completed: Promise<void>;
};
/** Resolve clips as they arrive, so decoding overlaps the rest of the download. */
export async function streamAudioPack(
  stream: ReadableStream<Uint8Array>,
): Promise<StreamingAudioPack> {
  const input = new PackReader(stream);
  let entries: Entry[];
  try {
    entries = parseIndex(await input.take(indexLength(await input.take(12))));
  } catch (error) {
    await input.reader.cancel(error).catch(() => {});
    input.reader.releaseLock();
    throw error;
  }
  const pending = new Map(
    entries.map((entry) => {
      let resolve!: (bytes: Uint8Array) => void, reject!: (error: unknown) => void;
      const promise = new Promise<Uint8Array>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      void promise.catch(() => {});
      return [entry.url, { promise, resolve, reject }] as const;
    }),
  );
  const completed = (async () => {
    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i],
          bytes = validClip(await input.take(entry.length));
        // The final requested clip also verifies EOF/trailing data before startup completes.
        if (i === entries.length - 1 && (await input.available()))
          invalid("Unindexed audio pack bytes");
        pending.get(entry.url)!.resolve(bytes);
      }
    } catch (error) {
      for (const item of pending.values()) item.reject(error);
      await input.reader.cancel(error).catch(() => {});
      throw error;
    } finally {
      input.reader.releaseLock();
    }
  })();
  void completed.catch(() => {});
  return { get: (url) => pending.get(url)?.promise, completed };
}
