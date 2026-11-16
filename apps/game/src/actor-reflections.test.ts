import { beforeEach, expect, test, vi } from "vitest";
import * as T from "three";
import { ActorReflections } from "./actor-reflections";

const mocks = vi.hoisted(() => ({
  bind: vi.fn(),
  load: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("./actor-lighting", () => ({ setActorReflection: mocks.bind }));
vi.mock("./source-lighting", () => ({
  nearestSourceProbe: (position: { x: number }) => (position.x < 0 ? null : position.x),
  loadSourceReflection: mocks.load,
}));
vi.mock("three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("three")>()),
  PMREMGenerator: class {
    fromEquirectangular = mocks.generate;
  },
}));

const renderer = {} as T.WebGLRenderer;
function actor(index: number) {
  return { root: new T.Object3D(), position: new T.Vector3(index, 0, 0) };
}
function pending() {
  let resolve!: (texture: T.Texture) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T.Texture>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  mocks.load.mockReturnValueOnce(promise);
  return { resolve, reject };
}
async function settle() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
function source() {
  const texture = new T.Texture();
  vi.spyOn(texture, "dispose");
  return texture;
}
function target() {
  return { texture: new T.Texture(), dispose: vi.fn() };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockReturnValue(new Promise<T.Texture>(() => {}));
});

test("loads eight distinct probes in request priority and binds every current actor each update", async () => {
  const reflections = new ActorReflections();
  const requests = [-1, 4, 4, 2, 9, 1, 8, 3, 7, 6, 5].map(actor);
  const expected = [4, 2, 9, 1, 8, 3, 7, 6];
  const targets = new Map<number, ReturnType<typeof target>>();
  for (const index of expected) {
    const job = pending();
    reflections.update(renderer, requests);
    expect(mocks.load).toHaveBeenLastCalledWith(index);
    const output = target();
    targets.set(index, output);
    mocks.generate.mockReturnValueOnce(output);
    const texture = source();
    job.resolve(texture);
    await settle();
    expect(texture.dispose).toHaveBeenCalledOnce();
  }
  mocks.bind.mockClear();
  reflections.update(renderer, requests);
  expect(mocks.load).toHaveBeenCalledTimes(8);
  expect(mocks.bind.mock.calls).toEqual(
    requests.map(({ root, position }) => [root, targets.get(position.x)?.texture]),
  );
  mocks.bind.mockClear();
  reflections.update(renderer, requests);
  expect(mocks.bind).toHaveBeenCalledTimes(requests.length);
});

test("async completion uses latest desired membership and does not overlap loads", async () => {
  const reflections = new ActorReflections();
  const first = actor(1);
  const second = actor(2);
  const job = pending();
  reflections.update(renderer, [first]);
  reflections.update(renderer, [second]);
  expect(mocks.load).toHaveBeenCalledTimes(1);
  const texture = source();
  job.resolve(texture);
  await settle();
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(texture.dispose).toHaveBeenCalledOnce();
  pending();
  reflections.update(renderer, [second]);
  expect(mocks.load).toHaveBeenLastCalledWith(2);
});

test("empty and shrinking requests clear departed actors once and dispose unwanted cached probes", async () => {
  const reflections = new ActorReflections();
  const first = actor(1);
  const second = actor(1);
  const job = pending();
  const output = target();
  mocks.generate.mockReturnValueOnce(output);
  reflections.update(renderer, [first, second]);
  job.resolve(source());
  await settle();
  reflections.update(renderer, [first, second]);
  mocks.bind.mockClear();
  reflections.update(renderer, [second]);
  expect(mocks.bind.mock.calls).toEqual([[second.root, output.texture], [first.root]]);
  expect(output.dispose).not.toHaveBeenCalled();
  mocks.bind.mockClear();
  reflections.update(renderer, []);
  expect(mocks.bind.mock.calls).toEqual([[second.root]]);
  expect(output.dispose).toHaveBeenCalledOnce();
  mocks.bind.mockClear();
  reflections.update(renderer, []);
  expect(mocks.bind).not.toHaveBeenCalled();
  expect(output.dispose).toHaveBeenCalledOnce();
  expect(mocks.load).toHaveBeenCalledTimes(1);
});

test("returning actors reuse retained probes until empty demand releases them", async () => {
  const reflections = new ActorReflections();
  const first = actor(1),
    second = actor(2);
  const outputs = [target(), target()];
  for (const [i, request] of [first, second].entries()) {
    const job = pending();
    mocks.generate.mockReturnValueOnce(outputs[i]);
    reflections.update(renderer, [request]);
    job.resolve(source());
    await settle();
  }
  mocks.bind.mockClear();
  reflections.update(renderer, [first]);
  expect(mocks.bind.mock.calls).toEqual([[first.root, outputs[0].texture], [second.root]]);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  for (const output of outputs) expect(output.dispose).not.toHaveBeenCalled();
  reflections.update(renderer, []);
  reflections.update(renderer, []);
  for (const output of outputs) expect(output.dispose).toHaveBeenCalledOnce();
});

test("full retention evicts the least recent unused probe using demand at completion", async () => {
  const reflections = new ActorReflections();
  const requests = Array.from({ length: 9 }, (_, i) => actor(i));
  const outputs = requests.map(() => target());
  for (let i = 0; i < 8; i++) {
    const job = pending();
    mocks.generate.mockReturnValueOnce(outputs[i]);
    reflections.update(renderer, [requests[i]]);
    job.resolve(source());
    await settle();
  }
  // Probe 0 becomes recent, leaving 1 oldest. Demand changes while 8 loads:
  // probe 1 is now needed and must not be evicted; probe 2 is the oldest unused.
  reflections.update(renderer, [requests[0]]);
  const job = pending();
  reflections.update(renderer, [requests[8]]);
  reflections.update(renderer, [requests[1], requests[8]]);
  mocks.generate.mockReturnValueOnce(outputs[8]);
  job.resolve(source());
  await settle();
  for (const [i, output] of outputs.entries())
    expect(output.dispose).toHaveBeenCalledTimes(i === 2 ? 1 : 0);
  mocks.bind.mockClear();
  reflections.update(renderer, [requests[0], requests[1], requests[8]]);
  expect(mocks.bind.mock.calls).toEqual(
    [0, 1, 8].map((i) => [requests[i].root, outputs[i].texture]),
  );
  expect(mocks.load).toHaveBeenCalledTimes(9);
  reflections.update(renderer, []);
  for (const output of outputs) expect(output.dispose).toHaveBeenCalledOnce();
});

test("failed probes retain fallback and later eligible probes load in order", async () => {
  const reflections = new ActorReflections();
  const requests = [actor(5), actor(2), actor(7)];
  const job = pending();
  reflections.update(renderer, requests);
  job.reject(new Error("decode failed"));
  await settle();
  pending();
  mocks.bind.mockClear();
  reflections.update(renderer, requests);
  expect(mocks.load.mock.calls).toEqual([[5], [2]]);
  expect(mocks.bind.mock.calls).toEqual(requests.map(({ root }) => [root, undefined]));
});
