import * as T from "three";

type Program = T.WebGLProgram & { isReady(): boolean };
export type PreparationScope = (work: () => void) => void;
export interface PreparationOptions {
  signal?: AbortSignal;
  batchSize?: number;
  scope?: PreparationScope;
}

function guard(renderer: T.WebGLRenderer, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (renderer.getContext().isContextLost())
    throw new Error("Graphics context lost during preparation");
}

// Every yield owns and removes its listeners/timer. No renderer.compileAsync
// polling survives cancellation, and no renderer state spans this await.
async function pause(renderer: T.WebGLRenderer, milliseconds: number, signal?: AbortSignal) {
  guard(renderer, signal);
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
    };
    const aborted = () => {
      cleanup();
      reject(signal!.reason);
    };
    const lost = () => {
      cleanup();
      reject(new Error("Graphics context lost during preparation"));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", aborted, { once: true });
    renderer.domElement.addEventListener("webglcontextlost", lost, { once: true });
    // Covers a loss/abort between the first check and listener installation.
    try {
      guard(renderer, signal);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
  guard(renderer, signal);
}

export async function finishPreparedPrograms(
  renderer: T.WebGLRenderer,
  programs: Iterable<T.WebGLProgram> = renderer.info.programs ?? [],
  signal?: AbortSignal,
) {
  guard(renderer, signal);
  const pending = new Set(programs);
  const parallel = renderer.extensions.has("KHR_parallel_shader_compile");
  while (pending.size) {
    guard(renderer, signal);
    const live = new Set(renderer.info.programs ?? []);
    for (const program of pending) {
      guard(renderer, signal);
      // UI/map disposal may occur while a batch yields. Never query a deleted
      // program or resurrect its material; ownership stays with its caller.
      if (!live.has(program)) {
        pending.delete(program);
        continue;
      }
      if (parallel && !(program as Program).isReady()) continue;
      const gl = renderer.getContext();
      if (!gl.getProgramParameter(program.program as WebGLProgram, gl.LINK_STATUS))
        throw new Error("A graphics shader could not compile during preparation", {
          cause: {
            programName: program.name,
            programLog: gl.getProgramInfoLog(program.program as WebGLProgram) ?? "",
          },
        });
      program.getUniforms();
      pending.delete(program);
    }
    if (pending.size) await pause(renderer, 10, signal);
  }
}

// Original object identity retains skinning, instancing, geometry, defines and
// material callbacks. The REAL target scene supplies lighting/fog/environment.
// Hidden future actors/weapons/pieces are intentionally included by traverse.
export async function prepareShadersBounded(
  renderer: T.WebGLRenderer,
  roots: readonly T.Object3D[],
  camera: T.Camera,
  target: T.Scene,
  { signal, batchSize = 4, scope = (work) => work() }: PreparationOptions = {},
) {
  if (!Number.isInteger(batchSize) || batchSize < 1)
    throw new Error("Shader preparation batch size must be a positive integer");
  guard(renderer, signal);
  const objects = new Set<T.Object3D>();
  for (const root of roots)
    root.traverse((object) => {
      if (
        (object as T.Mesh).isMesh ||
        (object as T.Points).isPoints ||
        (object as T.Line).isLine ||
        (object as T.Sprite).isSprite
      )
        objects.add(object);
    });
  const renderables = [...objects];
  // Traversal facade only: children remain empty; no parent/matrix mutations.
  const batch = new T.Group();
  batch.traverseVisible = (visitor) => visitor(batch);
  for (let offset = 0; offset < renderables.length; offset += batchSize) {
    guard(renderer, signal);
    const slice = renderables.slice(offset, offset + batchSize);
    batch.traverse = (visitor) => {
      visitor(batch);
      for (const object of slice) visitor(object);
    };
    const before = new Set(renderer.info.programs ?? []);
    let materials: Set<T.Material> | undefined;
    let calls = 0,
      active = true;
    try {
      const result: unknown = scope(() => {
        if (!active || ++calls !== 1)
          throw new Error("Preparation scope must invoke its callback once synchronously");
        guard(renderer, signal);
        materials = renderer.compile(batch, camera, target);
      });
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        void Promise.resolve(result).catch(() => {});
        throw new Error("Preparation scope must be synchronous");
      }
    } finally {
      active = false;
    }
    if (calls !== 1 || !materials)
      throw new Error("Preparation scope must invoke its callback once synchronously");
    guard(renderer, signal);
    const pending = new Set(
      (renderer.info.programs ?? []).filter((program) => !before.has(program)),
    );
    // Include a cached-but-still-linking program; also retain newly created
    // double-sided intermediate variants not represented by currentProgram.
    for (const material of materials) {
      const program = (renderer.properties.get(material) as { currentProgram?: T.WebGLProgram })
        .currentProgram;
      if (program) pending.add(program);
    }
    await finishPreparedPrograms(renderer, pending, signal);
    await pause(renderer, 0, signal);
  }
}
