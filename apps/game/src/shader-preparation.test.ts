import { expect, test } from "vitest";
import * as T from "three";
import { prepareShadersBounded, finishPreparedPrograms } from "./shader-preparation";
function fixture() {
  const scene = new T.Scene(),
    parent = new T.Group();
  scene.add(parent);
  const meshes = Array.from(
    { length: 3 },
    () => new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()),
  );
  parent.add(...meshes);
  meshes[1]!.visible = false;
  const detached = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  const target = new EventTarget(),
    seen: T.Object3D[] = [],
    targets: T.Scene[] = [];
  let lost = false,
    ready = true,
    linked = true,
    uniforms = 0,
    links = 0,
    scoped = false;
  const programs: T.WebGLProgram[] = [],
    props = new Map<T.Material, { currentProgram: T.WebGLProgram }>();
  const gl = {
    LINK_STATUS: 1,
    isContextLost: () => lost,
    getProgramParameter: () => {
      links++;
      return linked;
    },
    getProgramInfoLog: () =>
      "FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)",
  };
  const renderer = {
    domElement: target,
    getContext: () => gl,
    info: { programs },
    extensions: { has: () => true },
    properties: { get: (material: T.Material) => props.get(material) ?? {} },
    compile(root: T.Object3D, _camera: T.Camera, actual: T.Scene) {
      expect(scoped).toBe(true);
      targets.push(actual);
      const materials = new Set<T.Material>();
      root.traverseVisible((o) => expect(o).toBe(root)); // Real target owns lights, not facade.
      root.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        seen.push(o);
        const material = o.material as T.Material;
        const program = {
          isReady: () => ready,
          program: {},
          getUniforms: () => {
            uniforms++;
          },
        } as unknown as T.WebGLProgram;
        materials.add(material);
        programs.push(program);
        props.set(material, { currentProgram: program });
      });
      return materials;
    },
  } as unknown as T.WebGLRenderer;
  const scope = (work: () => void) => {
    scoped = true;
    try {
      work();
    } finally {
      scoped = false;
    }
  };
  return {
    scene,
    parent,
    meshes,
    detached,
    renderer,
    seen,
    targets,
    scope,
    programs,
    state: () => ({ uniforms, links, scoped }),
    ready: (value: boolean) => {
      ready = value;
    },
    linked: (value: boolean) => {
      linked = value;
    },
    lose: () => {
      lost = true;
      target.dispatchEvent(new Event("webglcontextlost"));
    },
  };
}
test("deduplicates original hidden/detached objects, real target, topology; restores scope during every yield", async () => {
  const f = fixture(),
    before = [...f.parent.children];
  let ticks = 0;
  const timer = setInterval(() => {
    expect(f.state().scoped).toBe(false);
    ticks++;
  }, 0);
  try {
    await prepareShadersBounded(
      f.renderer,
      [f.scene, f.parent, f.detached],
      new T.Camera(),
      f.scene,
      { batchSize: 1, scope: f.scope },
    );
  } finally {
    clearInterval(timer);
  }
  expect(f.seen).toEqual([...f.meshes, f.detached]);
  expect(f.targets).toEqual(Array(4).fill(f.scene));
  expect(f.parent.children).toEqual(before);
  expect(f.detached.parent).toBeNull();
  expect(f.meshes[1]!.visible).toBe(false);
  expect(f.state().uniforms).toBe(4);
  expect(ticks).toBeGreaterThan(0);
});
test("failed links retain the driver cause without looking up uniforms or compiling another batch", async () => {
  const f = fixture();
  f.linked(false);
  await expect(
    prepareShadersBounded(f.renderer, [f.scene], new T.Camera(), f.scene, {
      batchSize: 1,
      scope: f.scope,
    }),
  ).rejects.toMatchObject({
    message: "A graphics shader could not compile during preparation",
    cause: {
      programLog: "FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)",
    },
  });
  expect(f.seen).toHaveLength(1);
  expect(f.state()).toEqual({ scoped: false, uniforms: 0, links: 1 });
});
test("abort before compilation and during pending link stops subsequent batches without blocking uniform lookup", async () => {
  const f = fixture(),
    controller = new AbortController();
  controller.abort(new Error("cancel before"));
  await expect(
    prepareShadersBounded(f.renderer, [f.scene], new T.Camera(), f.scene, {
      signal: controller.signal,
      scope: f.scope,
    }),
  ).rejects.toThrow("cancel before");
  expect(f.seen).toEqual([]);
  const live = new AbortController();
  f.ready(false);
  const work = prepareShadersBounded(f.renderer, [f.scene], new T.Camera(), f.scene, {
    signal: live.signal,
    batchSize: 1,
    scope: f.scope,
  });
  setTimeout(() => live.abort(new Error("cancel pending")), 0);
  await expect(work).rejects.toThrow("cancel pending");
  expect(f.seen).toHaveLength(1);
  expect(f.state()).toEqual({ scoped: false, uniforms: 0, links: 0 });
});
test("loss during polling rejects and leaves scoped state restored", async () => {
  const f = fixture();
  f.ready(false);
  const work = prepareShadersBounded(f.renderer, [f.scene], new T.Camera(), f.scene, {
    batchSize: 1,
    scope: f.scope,
  });
  setTimeout(f.lose, 0);
  await expect(work).rejects.toThrow("context lost");
  expect(f.seen).toHaveLength(1);
  expect(f.state().scoped).toBe(false);
});
test("disposed pending programs are dropped without querying their handles", async () => {
  const f = fixture();
  f.ready(false);
  f.programs.push({
    isReady: () => false,
    program: {},
    getUniforms: () => {
      throw new Error("disposed handle queried");
    },
  } as unknown as T.WebGLProgram);
  const work = finishPreparedPrograms(f.renderer);
  f.programs.splice(0);
  await work;
  expect(f.state().uniforms).toBe(0);
  expect(f.state().links).toBe(0);
});
test("deferred, duplicate and async scopes fail closed", async () => {
  for (const scope of [
    () => {},
    (work: () => void) => {
      work();
      work();
    },
    async (work: () => void) => {
      work();
    },
  ]) {
    const f = fixture();
    await expect(
      prepareShadersBounded(f.renderer, [f.scene], new T.Camera(), f.scene, {
        scope: (work) => {
          let result: unknown;
          f.scope(() => {
            result = scope(work);
          });
          return result as void;
        },
      }),
    ).rejects.toThrow("scope");
    expect(f.state().scoped).toBe(false);
  }
});
