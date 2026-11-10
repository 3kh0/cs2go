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
      !/^\/audio\/(?:[a-z0-9_-]+\.ogg|source\/[a-z0-9_-]+\.(?:ogg|wav))$/.test(entry.url) ||
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
function validClip(bytes: Uint8Array, url: string) {
  if (url.endsWith(".wav")) {
    if (bytes.length < 44) return invalid("Invalid packed PCM WAV clip");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.length)
      return invalid("Invalid packed PCM WAV clip");
    let offset = 12,
      format = false,
      data = 0,
      block = 0;
    while (offset + 8 <= bytes.length) {
      const size = view.getUint32(offset + 4, true),
        start = offset + 8;
      if (size > bytes.length - start) return invalid("Invalid packed PCM WAV chunk");
      if (tag(offset) === "fmt ") {
        if (format || size < 16) return invalid("Invalid packed PCM WAV format");
        const channels = view.getUint16(start + 2, true),
          rate = view.getUint32(start + 4, true);
        block = view.getUint16(start + 12, true);
        if (
          view.getUint16(start, true) !== 1 ||
          ![1, 2].includes(channels) ||
          rate < 8000 ||
          rate > 192000 ||
          view.getUint16(start + 14, true) !== 16 ||
          block !== channels * 2 ||
          view.getUint32(start + 8, true) !== rate * block
        )
          return invalid("Invalid packed PCM WAV format");
        format = true;
      } else if (tag(offset) === "data") {
        if (data) return invalid("Invalid packed PCM WAV data");
        data = size;
      }
      offset = start + size + (size & 1);
    }
    if (offset !== bytes.length || !format || !data || data % block)
      return invalid("Invalid packed PCM WAV data");
    return bytes;
  }
  if (bytes[0] !== 79 || bytes[1] !== 103 || bytes[2] !== 103 || bytes[3] !== 83)
    invalid("Invalid packed Ogg clip");
  return bytes;
}
/** Lossless local Opus/native PCM bank; music remains streamed separately. */
export function parseAudioPack(data: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(data),
    end = 12 + indexLength(bytes);
  if (end > bytes.length) return invalid("Truncated audio pack index");
  const clips = new Map<string, Uint8Array>();
  let offset = end;
  for (const entry of parseIndex(bytes.subarray(12, end))) {
    if (offset + entry.length > bytes.length) return invalid("Truncated audio pack clip");
    clips.set(entry.url, validClip(bytes.subarray(offset, offset + entry.length), entry.url));
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
          bytes = validClip(await input.take(entry.length), entry.url);
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
