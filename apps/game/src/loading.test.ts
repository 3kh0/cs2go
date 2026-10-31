import { expect, test } from "vitest";
import { beginLoadingWork, watchLoadingWork, createLoadQueue } from "./loading";

test("map priority bypasses queued animation work without interrupting active jobs", async () => {
  const load = createLoadQueue(1);
  const order: string[] = [];
  let release!: () => void;
  const active = load(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    order.push("active");
  });
  await Promise.resolve();
  const animation = load(async () => {
    order.push("animation");
  });
  const map = load(async () => {
    order.push("map");
  }, 1);
  release();
  await Promise.all([active, animation, map]);
  expect(order).toEqual(["active", "map", "animation"]);
});

test("model jobs stay bounded and a failed decode releases its slot", async () => {
  const load = createLoadQueue(2);
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      load(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        if (index === 1) throw new Error("decode failed");
        completed.push(index);
        return index;
      }),
    ),
  );
  expect(peak).toBe(2);
  expect(active).toBe(0);
  expect(completed).toEqual([0, 2, 3, 4, 5, 6, 7]);
  expect(results[1].status).toBe("rejected");
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(7);
});

test("startup counts queued jobs and ignores completions after its watcher closes", async () => {
  const progress: [number, number][] = [];
  const stop = watchLoadingWork((done, total) => progress.push([done, total]));
  const first = beginLoadingWork();
  const second = beginLoadingWork();
  first();
  first();
  expect(progress).toEqual([
    [0, 1],
    [0, 2],
    [1, 2],
  ]);
  stop();
  const next: [number, number][] = [];
  const stopNext = watchLoadingWork((done, total) => next.push([done, total]));
  second();
  const finish = beginLoadingWork();
  finish();
  expect(next).toEqual([
    [0, 1],
    [1, 1],
  ]);
  stopNext();
});
