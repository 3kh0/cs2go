import { assetFetch } from "./asset-url";
import { beginLoadingWork } from "./loading";
import { parseAudioPack, streamAudioPack, type StreamingAudioPack } from "./audio-pack";
export { parseAudioPack } from "./audio-pack";
let pack: Promise<StreamingAudioPack> | undefined;
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
  if (!pack) {
    const pending = assetFetch("/audio/startup.bin")
      .then(async (response) => {
        if (!response.ok) throw new Error("Audio pack unavailable");
        if (response.body) return streamAudioPack(response.body);
        const clips = parseAudioPack(await response.arrayBuffer());
        return {
          get: (url: string) => {
            const clip = clips.get(url);
            return clip ? Promise.resolve(clip) : undefined;
          },
          completed: Promise.resolve(),
        };
      })
      .then((parsed) => {
        void parsed.completed.catch(() => {
          if (pack === pending) pack = undefined;
        });
        return parsed;
      })
      .catch((error) => {
        if (pack === pending) pack = undefined;
        throw error;
      });
    pack = pending;
  }
  return pack;
}
/** Deduplicate both in-flight and decoded clips across consumers; retry failed loads. */
export function loadAudioClip(url: string): Promise<AudioBuffer> {
  const cached = decoded.get(url);
  if (cached) return cached;
  const finish = beginLoadingWork();
  const result = loadPack()
    .then((parsed) => {
      const clip = parsed.get(url);
      if (!clip) throw new Error(`Audio clip missing from pack: ${url}`);
      return clip;
    })
    .then(
      (clip) =>
        new Promise<AudioBuffer>((resolve, reject) => {
          queue.push(async () => {
            try {
              decoder ??= new OfflineAudioContext(1, 1, 44100);
              resolve(await decoder.decodeAudioData(clip.slice().buffer));
            } catch (error) {
              reject(error);
            }
          });
          pump();
        }),
    )
    .catch((error) => {
      decoded.delete(url);
      throw error;
    })
    .finally(finish);
  decoded.set(url, result);
  return result;
}
