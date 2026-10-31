let assetListener: ((filename: string) => void) | undefined;

/** Subscribe only while the startup overlay exists; later skin loads stay silent. */
export function watchAssetLoads(listener: (filename: string) => void) {
  assetListener = listener;
  return () => {
    if (assetListener === listener) assetListener = undefined;
  };
}
export function reportLoadingAsset(path: string) {
  if (!assetListener) return;
  const filename = path.split(/[?#]/)[0].split("/").at(-1);
  if (filename) assetListener(filename);
}

let workListener: ((completed: number, total: number) => void) | undefined;
let workCompleted = 0;
let workTotal = 0;

/** Count queued fetch/decode jobs, including work waiting for a concurrency slot. */
export function watchLoadingWork(listener: (completed: number, total: number) => void) {
  workCompleted = workTotal = 0;
  workListener = listener;
  return () => {
    if (workListener === listener) workListener = undefined;
  };
}
export function beginLoadingWork() {
  const listener = workListener;
  if (!listener) return () => {};
  listener(workCompleted, ++workTotal);
  let finished = false;
  return () => {
    if (finished || workListener !== listener) return;
    finished = true;
    listener(++workCompleted, workTotal);
  };
}

// Bound whole fetch/decompress/parse jobs, not just requests: decoded models
// and texture transcoders otherwise compete for memory during startup.
export function createLoadQueue(limit: number) {
  let active = 0;
  const waiting: { start: () => void; priority: number }[] = [];
  return async function load<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    const finish = beginLoadingWork();
    await new Promise<void>((resolve) => {
      const start = () => {
        active++;
        resolve();
      };
      if (active < limit) start();
      else {
        waiting.push({ start, priority });
        waiting.sort((a, b) => b.priority - a.priority);
      }
    });
    try {
      return await task();
    } finally {
      active--;
      finish();
      waiting.shift()?.start();
    }
  };
}
