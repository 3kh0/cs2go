import * as T from "three";
import { NativeLightBuffer } from "../src/native-light-buffer";

/** Actual StandardMaterial first draw, without compile()/ShaderMaterial UBO
 * integration. Two worlds intentionally share the identical WebGLProgram. */
export async function renderNativeLightBuffers() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const material = new T.MeshStandardMaterial();
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader =
      "layout(std140) uniform NativeLightFixture {vec4 nativeLightValues[2];};\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "gl_FragColor=vec4(nativeLightValues[0].rgb*nativeLightValues[1].rgb,1.);",
    );
  };
  material.customProgramCacheKey = () => "native-light-ubo-transport-fixture";
  const geometry = new T.PlaneGeometry(2, 2);
  scene.add(new T.Mesh(geometry, material));
  const values = [
      [0.2, 0.3, 0.4, 1, 0.5, 0.7, 0.9, 1],
      [0.8, 0.6, 0.2, 1, 0.9, 0.4, 0.3, 1],
    ],
    buffers = values.map((value) => new NativeLightBuffer(new Float32Array(value)));
  const gl = renderer.getContext() as WebGL2RenderingContext,
    externalIndexed = gl.createBuffer()!,
    externalGeneric = gl.createBuffer()!;
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, externalIndexed);
  gl.bufferData(
    gl.UNIFORM_BUFFER,
    new Float32Array([0.1, 0.2, 0.3, 1, 0.2, 0.3, 0.4, 1]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.UNIFORM_BUFFER, externalGeneric);
  gl.bufferData(gl.UNIFORM_BUFFER, 16, gl.STATIC_DRAW);
  const rows = [];
  let owned: WebGLBuffer | null = null;
  const draw = (name: string) => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    return {
      name,
      pixel: [...pixel],
      programs: renderer.info.programs?.length,
      error: gl.getError(),
    };
  };
  rows.push(
    buffers[0].withBinding(renderer, () => {
      owned = gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0);
      return draw("first-native-world");
    }),
  );
  rows.push(buffers[1].withBinding(renderer, () => draw("second-native-world")));
  rows.push(buffers[0].withBinding(renderer, () => draw("restored-native-world")));
  const nested = buffers[0].withBinding(renderer, () => {
    const inner = buffers[1].withBinding(renderer, () => draw("nested-second"));
    return [inner, draw("nested-restored-first")];
  });
  rows.push(...nested);
  let exceptionRestored = false;
  try {
    buffers[1].withBinding(renderer, () => {
      throw Error("expected-test");
    });
  } catch {
    exceptionRestored =
      gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0) === externalIndexed &&
      gl.getParameter(gl.UNIFORM_BUFFER_BINDING) === externalGeneric;
  }
  rows.push(draw("external-after-native"));
  const restored =
    gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0) === externalIndexed &&
    gl.getParameter(gl.UNIFORM_BUFFER_BINDING) === externalGeneric;
  const limit = gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE);
  let oversizedRejected = false;
  const oversized = new NativeLightBuffer(new Float32Array(limit / 4 + 4));
  try {
    oversized.withBinding(renderer, () => {});
  } catch {
    oversizedRejected = true;
  }
  oversized.dispose();
  buffers.forEach((buffer) => {
    buffer.dispose();
    buffer.dispose();
  });
  const ownedReleased = !gl.isBuffer(owned),
    externalSurvived = gl.isBuffer(externalIndexed) && gl.isBuffer(externalGeneric);
  let disposedRejected = false;
  try {
    buffers[0].withBinding(renderer, () => {});
  } catch {
    disposedRejected = true;
  }
  const program = renderer.info.programs![0].program as WebGLProgram,
    block = gl.getUniformBlockIndex(program, "NativeLightFixture"),
    defaultBinding = gl.getActiveUniformBlockParameter(program, block, gl.UNIFORM_BLOCK_BINDING);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, null);
  gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  gl.deleteBuffer(externalIndexed);
  gl.deleteBuffer(externalGeneric);
  const recoverable = new NativeLightBuffer(new Float32Array(values[0]));
  let beforeRestore: WebGLBuffer | null = null,
    afterRestore: WebGLBuffer | null = null;
  let earlyRecovered: ReturnType<typeof draw> | undefined;
  // Application listeners may be installed before the first map buffer upload.
  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      earlyRecovered = recoverable.withBinding(renderer, () => draw("early-restore-listener"));
    },
    { once: true },
  );
  recoverable.withBinding(renderer, () => {
    beforeRestore = gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0);
    draw("before-context-restore");
  });
  const extension = gl.getExtension("WEBGL_lose_context");
  if (!extension) throw new Error("Context-loss fixture requires WEBGL_lose_context");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebGL restore timed out")), 5000);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 100);
  });
  const recovered = recoverable.withBinding(renderer, () => {
    afterRestore = gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0);
    return draw("after-context-restore");
  });
  recoverable.dispose();
  const contextRestored =
    beforeRestore !== afterRestore &&
    !gl.isBuffer(afterRestore) &&
    recovered.pixel
      .slice(0, 3)
      .every((value, i) => Math.abs(value - [0.1, 0.21, 0.36][i]) < 1e-6) &&
    recovered.error === 0 &&
    earlyRecovered?.error === 0 &&
    earlyRecovered.pixel
      .slice(0, 3)
      .every((value, i) => Math.abs(value - [0.1, 0.21, 0.36][i]) < 1e-6);
  geometry.dispose();
  material.dispose();
  target.dispose();
  renderer.dispose();
  return {
    rows,
    contextRestored,
    restored,
    exceptionRestored,
    ownedReleased,
    externalSurvived,
    oversizedRejected,
    disposedRejected,
    defaultBinding,
    blockLimit: limit,
  };
}
