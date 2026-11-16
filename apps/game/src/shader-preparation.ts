import * as T from "three";
import { beginLoadingWork } from "./loading";
import { rendererDiagnostics } from "./renderer-diagnostics";

type Program = T.WebGLProgram & { isReady(): boolean };
const completedPrograms = new WeakMap<
  WebGLRenderingContext | WebGL2RenderingContext,
  { programs: WeakSet<T.WebGLProgram> }
>();
export type PreparationScope = (work: () => void) => void;
export interface PreparationOptions {
  signal?: AbortSignal;
  batchSize?: number;
  scope?: PreparationScope;
}

function deferPreparation(renderer: T.WebGLRenderer) {
  // Software drivers retain expanded images and compiled pipelines in process
  // memory. Preparing unseen variants can exhaust that pool before entry. Real
  // draws still use every authored texture/mip and shader; first use may stall.
  // Hardware and privacy-withheld adapters retain eager preparation.
  return rendererDiagnostics(renderer.getContext()).software;
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

/** Complete submitted work after releasing the previous map, before allocating
 * its replacement. Loading must keep rendering paused throughout this wait. */
export async function finishGpuTextureRelease(renderer: T.WebGLRenderer, signal?: AbortSignal) {
  guard(renderer, signal);
  if (!deferPreparation(renderer)) return;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw new Error("Could not synchronize graphics texture release");
  try {
    gl.flush();
    for (;;) {
      await pause(renderer, 10, signal);
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
      if (status === gl.WAIT_FAILED) throw new Error("Graphics texture release wait failed");
    }
  } finally {
    if (!gl.isContextLost()) gl.deleteSync(fence);
  }
  guard(renderer, signal);
  // Chrome implements WebGL finish as a flush. A CPU readback also gives ANGLE
  // a native completion/garbage-retirement point; a fence alone does not.
  // This does not join unrelated shader compiler tasks or reduce live storage.
  const target = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  try {
    renderer.initRenderTarget(target);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, new Uint8Array(4));
  } finally {
    target.dispose();
  }
  guard(renderer, signal);
}

/** Materialize main-map arrays before ordinary draws fragment the software
 * driver's allocation pool. initTexture alone need not allocate decoded BC
 * storage: sample each original image, largest first, and complete its draw.
 * Every source mip and the resulting image stay available for gameplay. */
export function prepareNativeTextureArrays(
  renderer: T.WebGLRenderer,
  textures: readonly (T.DataArrayTexture | T.CompressedArrayTexture)[],
  signal?: AbortSignal,
) {
  guard(renderer, signal);
  if (!textures.length) return;
  const arrays = [...new Set(textures)].map((texture) => {
    const compressed = [
      T.RGBA_BPTC_Format,
      T.RGB_BPTC_UNSIGNED_Format,
      T.RGB_BPTC_SIGNED_Format,
    ].includes(texture.format);
    const hdr =
      texture.format === T.RGB_BPTC_UNSIGNED_Format || texture.format === T.RGB_BPTC_SIGNED_Format;
    const pixelBytes =
      hdr || texture.type === T.HalfFloatType ? 8 : texture.type === T.FloatType ? 16 : 4;
    const mips = texture.mipmaps.length ? texture.mipmaps : [texture.image];
    const bytes =
      mips.reduce(
        (sum, mip) => sum + mip.width * mip.height * texture.image.depth * pixelBytes,
        0,
      ) +
      (compressed && texture instanceof T.CompressedArrayTexture
        ? texture.mipmaps.reduce((sum, mip) => sum + mip.data.byteLength, 0)
        : 0);
    return { texture, bytes };
  });
  arrays.sort((a, b) => b.bytes - a.bytes);
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const target = new T.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const scene = new T.Scene(),
    camera = new T.Camera(),
    geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const material = new T.RawShaderMaterial({
    glslVersion: T.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms: { sourceTexture: { value: null } },
    vertexShader:
      "precision highp float; in vec3 position; void main(){gl_Position=vec4(position,1.);}",
    fragmentShader:
      "precision highp float; uniform highp sampler2DArray sourceTexture; out vec4 color; void main(){color=textureLod(sourceTexture,vec3(.5,.5,0.),0.);}",
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const destination = renderer.getRenderTarget(),
    face = renderer.getActiveCubeFace(),
    level = renderer.getActiveMipmapLevel(),
    viewport = renderer.getViewport(new T.Vector4()),
    scissor = renderer.getScissor(new T.Vector4()),
    scissorTest = renderer.getScissorTest(),
    pack = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
  try {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, 1, 1);
    renderer.setScissorTest(false);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const pixels = new Uint8Array(4);
    for (const { texture } of arrays) {
      guard(renderer, signal);
      material.uniforms.sourceTexture!.value = texture;
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
      guard(renderer, signal);
      if (gl.getError()) throw new Error("Graphics texture array preparation failed");
    }
  } finally {
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pack);
    renderer.setRenderTarget(destination, face, level);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    material.uniforms.sourceTexture!.value = null;
    target.dispose();
    geometry.dispose();
    material.dispose();
  }
}

export async function finishPreparedPrograms(
  renderer: T.WebGLRenderer,
  programs: Iterable<T.WebGLProgram> = renderer.info.programs ?? [],
  signal?: AbortSignal,
) {
  guard(renderer, signal);
  const gl = renderer.getContext();
  let completed = completedPrograms.get(gl);
  if (!completed) {
    const state = { programs: new WeakSet<T.WebGLProgram>() };
    const invalidate = () => {
      state.programs = new WeakSet();
    };
    renderer.domElement.addEventListener("webglcontextlost", invalidate);
    renderer.domElement.addEventListener("webglcontextrestored", invalidate);
    completedPrograms.set(gl, state);
    completed = state;
  }
  const pending = new Set(programs);
  const parallel = renderer.extensions.has("KHR_parallel_shader_compile");
  while (pending.size) {
    guard(renderer, signal);
    const live = new Set(renderer.info.programs ?? []);
    for (const program of pending) {
      guard(renderer, signal);
      // UI/map disposal may occur while a batch yields. Never query a deleted
      // program or resurrect its material; ownership stays with its caller.
      if (!live.has(program) || completed.programs.has(program)) {
        pending.delete(program);
        continue;
      }
      if (parallel && !(program as Program).isReady()) continue;
      if (!gl.getProgramParameter(program.program as WebGLProgram, gl.LINK_STATUS))
        throw new Error("A graphics shader could not compile during preparation", {
          cause: {
            programName: program.name,
            programLog: gl.getProgramInfoLog(program.program as WebGLProgram) ?? "",
          },
        });
      program.getUniforms();
      guard(renderer, signal);
      // First use is complete. Rechecking this same live linked program can
      // synchronize the driver again; new variants still require preparation.
      completed.programs.add(program);
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
  if (deferPreparation(renderer)) return;
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
  const completedBatches = Array.from({ length: Math.ceil(renderables.length / batchSize) }, () =>
    beginLoadingWork("graphics"),
  );
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
    completedBatches[offset / batchSize]();
    await pause(renderer, 0, signal);
  }
}

/** Include compiled onBeforeCompile bindings, not just ordinary material maps. */
export function preparedTextures(renderer: T.WebGLRenderer, roots: readonly T.Object3D[]) {
  const textures = new Set<T.Texture>();
  // Without compilation, cached uniforms may still name the previous map's
  // suspended textures. Keep discovery and upload on the same policy.
  if (deferPreparation(renderer)) return textures;
  const seen = new WeakSet<object>();
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value instanceof T.Texture) {
      // Framebuffer-owned attachments must be allocated with their render target.
      if (!value.isRenderTargetTexture && !(value instanceof T.DepthTexture)) textures.add(value);
    } else if (!ArrayBuffer.isView(value)) {
      for (const child of Object.values(value)) collect(child);
    }
  };
  for (const root of roots)
    root.traverseVisible((object) => {
      const mesh = object as T.Mesh;
      if (!mesh.material) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const value of Object.values(material)) if (value instanceof T.Texture) collect(value);
        collect((material as T.ShaderMaterial).uniforms);
        collect((renderer.properties.get(material) as { uniforms?: unknown }).uniforms);
      }
    });
  return textures;
}
export async function prepareTexturesBounded(
  renderer: T.WebGLRenderer,
  textures: Iterable<T.Texture>,
  signal?: AbortSignal,
) {
  guard(renderer, signal);
  if (deferPreparation(renderer)) return;
  const pending = [...new Set(textures)].filter(
    (texture) => !texture.isRenderTargetTexture && !(texture instanceof T.DepthTexture),
  );
  const completed = pending.map(() => beginLoadingWork("textures"));
  let slice = performance.now();
  for (let index = 0; index < pending.length; index++) {
    guard(renderer, signal);
    renderer.initTexture(pending[index]);
    completed[index]();
    if ((index + 1) % 8 === 0 || performance.now() - slice >= 8) {
      await pause(renderer, 0, signal);
      slice = performance.now();
    }
  }
  guard(renderer, signal);
}
