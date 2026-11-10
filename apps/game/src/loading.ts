let assetListener: ((filename: string) => void) | undefined;
let gentleStartup = false;
export function configureStartupLoading(mode: string) {
  gentleStartup = mode === "gentle";
}
export function startupBudget(kind: "fetch" | "parse" | "texture" | "audio") {
  return gentleStartup
    ? { fetch: 3, parse: 1, texture: 1, audio: 1 }[kind]
    : { fetch: 6, parse: 2, texture: 2, audio: 4 }[kind];
}
export function yieldLoadingWork() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

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
export type PreparationKind = "resources" | "graphics" | "textures" | "processing";
type PreparationWatcher = {
  counts: Record<PreparationKind, { completed: number; total: number }>;
  notify(kind: PreparationKind, completed: number, total: number): void;
};
let preparationWatcher: PreparationWatcher | undefined;

/** Each subscription owns its counters; abandoned jobs cannot update a retry. */
export function watchPreparationWork(notify: PreparationWatcher["notify"]) {
  const watcher = (preparationWatcher = {
    counts: {
      resources: { completed: 0, total: 0 },
      graphics: { completed: 0, total: 0 },
      textures: { completed: 0, total: 0 },
      processing: { completed: 0, total: 0 },
    },
    notify,
  });
  return () => {
    if (preparationWatcher === watcher) preparationWatcher = undefined;
  };
}

/** Count queued fetch/decode jobs, including work waiting for a concurrency slot. */
export function watchLoadingWork(listener: (completed: number, total: number) => void) {
  workCompleted = workTotal = 0;
  workListener = listener;
  return () => {
    if (workListener === listener) workListener = undefined;
  };
}
export function beginLoadingWork(kind: PreparationKind = "resources") {
  const listener = workListener;
  const watcher = preparationWatcher;
  if (!listener && !watcher) return () => {};
  listener?.(workCompleted, ++workTotal);
  if (watcher) {
    const count = watcher.counts[kind];
    watcher.notify(kind, count.completed, ++count.total);
  }
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    if (listener && workListener === listener) listener(++workCompleted, workTotal);
    if (watcher && preparationWatcher === watcher) {
      const count = watcher.counts[kind];
      watcher.notify(kind, ++count.completed, count.total);
    }
  };
}

// Bound whole fetch/decompress/parse jobs, not just requests: decoded models
// and texture transcoders otherwise compete for memory during startup.
export function createLoadQueue(limit: number | (() => number)) {
  let active = 0;
  const waiting: { start: () => void; priority: number }[] = [];
  function pump() {
    while (waiting.length && active < (typeof limit === "number" ? limit : limit()))
      waiting.shift()!.start();
  }
  return async function load<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    const finish = beginLoadingWork();
    await new Promise<void>((resolve) => {
      const start = () => {
        active++;
        resolve();
      };
      waiting.push({ start, priority });
      waiting.sort((a, b) => b.priority - a.priority);
      pump();
    });
    try {
      return await task();
    } finally {
      active--;
      finish();
      pump();
    }
  };
}

export function finishPreparationSteps<Result>(steps: Generator<void, Result>) {
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}
/** Bound CPU preparation without copying map/geometry buffers to another owner. */
export async function runPreparationSteps<Result>(steps: Generator<void, Result>) {
  const finish = beginLoadingWork("processing");
  let slice = performance.now();
  try {
    let step = steps.next();
    while (!step.done) {
      if (performance.now() - slice >= 8) {
        await yieldLoadingWork();
        slice = performance.now();
      }
      step = steps.next();
    }
    return step.value;
  } finally {
    finish();
  }
}
