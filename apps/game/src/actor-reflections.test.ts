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
