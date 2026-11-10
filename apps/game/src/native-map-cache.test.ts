import { expect, test, vi } from "vitest";
import { NativeMapCache } from "./native-map-cache";

const world = () => ({ dispose: vi.fn() });
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

test("map cache retains home and two recent maps, evicting inactive GPU owners", () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2");
  const dust = world(),
    mirage = world(),
    nuke = world(),
    inferno = world();
  cache.set("dust2", dust);
  cache.set("mirage", mirage);
  cache.set("nuke", nuke);
  cache.get("mirage");
  cache.set("inferno", inferno);
  cache.prune([mirage, inferno]);
  expect(nuke.dispose).toHaveBeenCalledTimes(1);
  expect(dust.dispose).not.toHaveBeenCalled();
  expect([...cache.values()]).toEqual([dust, mirage, inferno]);
});

test("concurrent preparation leases protect live consumers and release aborted results", () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2");
  const active = world(),
    selected = world(),
    pending = world();
  cache.set("mirage", active);
  cache.set("nuke", selected);
  const releaseOne = cache.retain("inferno");
  const releaseTwo = cache.retain("inferno");
  cache.set("inferno", pending);
  cache.prune([active, selected]);
  expect([...cache.values()]).toHaveLength(3);
  releaseOne();
  releaseOne();
  cache.prune([active, selected]);
  expect(pending.dispose).not.toHaveBeenCalled();
  releaseTwo();
  cache.prune([active, selected]);
  expect(pending.dispose).toHaveBeenCalledTimes(1);
  expect(active.dispose).not.toHaveBeenCalled();
  expect(selected.dispose).not.toHaveBeenCalled();
  cache.prune([active, selected]);
  expect(pending.dispose).toHaveBeenCalledTimes(1);
});

test("incoming preparation releases an inactive world before allocating its replacement", () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2");
  const dust = world(),
    active = world(),
    inactive = world();
  cache.set("dust2", dust);
  cache.set("nuke", inactive);
  cache.set("vertigo", active);
  const release = cache.retain("inferno");
  cache.prune([active], 1);
  expect(inactive.dispose).toHaveBeenCalledTimes(1);
  expect(active.dispose).not.toHaveBeenCalled();
  expect(dust.dispose).not.toHaveBeenCalled();
  release();
  expect([...cache.values()]).toEqual([dust, active]);
});

test("rapid cancelled selections never allocate worlds concurrently or start abandoned queued maps", async () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2");
  const started = gate(),
    finish = gate(),
    first = world(),
    second = world();
  const releaseFirst = cache.retain("nuke"),
    releaseSecond = cache.retain("inferno"),
    releaseThird = cache.retain("cache");
  let active = 0,
    peak = 0;
  const one = cache.load("nuke", async () => {
    peak = Math.max(peak, ++active);
    started.open();
    await finish.promise;
    active--;
    return first;
  });
  const abandoned = expect(one).rejects.toMatchObject({ name: "AbortError" });
  await started.promise;
  const two = cache.load("inferno", () => {
    peak = Math.max(peak, ++active);
    active--;
    return Promise.resolve(second);
  });
  const createThird = vi.fn(() => Promise.resolve(world()));
  const third = cache.load("cache", createThird);
  const neverStarted = expect(third).rejects.toMatchObject({ name: "AbortError" });
  releaseFirst();
  releaseThird();
  finish.open();
  await abandoned;
  expect(await two).toBe(second);
  await neverStarted;
  expect(peak).toBe(1);
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(second.dispose).not.toHaveBeenCalled();
  expect(createThird).not.toHaveBeenCalled();
  expect(cache.get("nuke")).toBeUndefined();
  releaseSecond();
});

test("a second live consumer keeps a shared allocation alive after the first cancels", async () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2"),
    finish = gate(),
    loaded = world();
  const releaseOne = cache.retain("nuke"),
    releaseTwo = cache.retain("nuke");
  const create = vi.fn(async () => {
    await finish.promise;
    return loaded;
  });
  const first = cache.load("nuke", create),
    second = cache.load("nuke", create);
  expect(first).toBe(second);
  releaseOne();
  finish.open();
  expect(await first).toBe(loaded);
  expect(await second).toBe(loaded);
  expect(create).toHaveBeenCalledTimes(1);
  expect(loaded.dispose).not.toHaveBeenCalled();
  releaseTwo();
});

test("a failed map does not wedge the next selection or a retry", async () => {
  const cache = new NativeMapCache<string, ReturnType<typeof world>>("dust2");
  const releaseOne = cache.retain("nuke"),
    releaseTwo = cache.retain("inferno");
  const failed = cache.load("nuke", () => Promise.reject(new Error("missing map asset")));
  const loaded = world(),
    next = cache.load("inferno", () => Promise.resolve(loaded));
  await expect(failed).rejects.toThrow("missing map asset");
  expect(await next).toBe(loaded);
  const retried = world();
  expect(await cache.load("nuke", () => Promise.resolve(retried))).toBe(retried);
  releaseOne();
  releaseTwo();
});
