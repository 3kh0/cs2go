import { assetFetch } from "./asset-url";
import { beginLoadingWork } from "./loading";
/** A lossless local Opus pack; music remains streamed separately. */
export function parseAudioPack(data: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  if (bytes.length < 12 || view.getUint32(0, true) !== 0x50445541 || view.getUint32(4, true) !== 1)
    throw new Error("Invalid audio pack header");
  const indexEnd = 12 + view.getUint32(8, true);
  if (indexEnd > bytes.length) throw new Error("Truncated audio pack index");
  const index: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(12, indexEnd)));
  if (!Array.isArray(index) || !index.length) throw new Error("Invalid audio pack index");
  const clips = new Map<string, Uint8Array>();
  let offset = 0;
  for (const entry of index) {
    if (
      !entry ||
      typeof entry.url !== "string" ||
      !/^\/audio\/(?:source\/)?[a-z0-9_-]+\.ogg$/.test(entry.url) ||
      clips.has(entry.url) ||
      entry.offset !== offset ||
      !Number.isSafeInteger(entry.length) ||
      entry.length < 4 ||
      indexEnd + offset + entry.length > bytes.length
    )
      throw new Error("Invalid audio pack clip");
    const clip = bytes.subarray(indexEnd + offset, indexEnd + offset + entry.length);
    if (clip[0] !== 79 || clip[1] !== 103 || clip[2] !== 103 || clip[3] !== 83)
      throw new Error("Invalid packed Ogg clip");
    clips.set(entry.url, clip);
    offset += entry.length;
  }
  if (indexEnd + offset !== bytes.length) throw new Error("Unindexed audio pack bytes");
  return clips;
}

let pack: Promise<Map<string, Uint8Array>> | undefined;
let decoder: OfflineAudioContext | undefined;
const decoded = new Map<string, Promise<AudioBuffer>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
function pump() {
  while (active < 4 && queue.length) {
    active++;
    void queue.shift()!().finally(() => {
      active--;
      pump();
    });
  }
}
function loadPack() {
  return (pack ??= assetFetch("/audio/startup.bin")
    .then(async (response) => {
      if (!response.ok) throw new Error("Audio pack unavailable");
      return parseAudioPack(await response.arrayBuffer());
    })
    .catch((error) => {
      pack = undefined;
      throw error;
    }));
}
/** Deduplicate both in-flight and decoded clips across consumers; retry failed loads. */
export function loadAudioClip(url: string): Promise<AudioBuffer> {
  const cached = decoded.get(url);
  if (cached) return cached;
  const finish = beginLoadingWork();
  const result = new Promise<AudioBuffer>((resolve, reject) => {
    queue.push(async () => {
      try {
        const clip = (await loadPack()).get(url);
        if (!clip) throw new Error(`Audio clip missing from pack: ${url}`);
        decoder ??= new OfflineAudioContext(1, 1, 44100);
        resolve(await decoder.decodeAudioData(clip.slice().buffer));
      } catch (error) {
        reject(error);
      }
    });
  })
    .catch((error) => {
      decoded.delete(url);
      throw error;
    })
    .finally(finish);
  decoded.set(url, result);
  pump();
  return result;
}
