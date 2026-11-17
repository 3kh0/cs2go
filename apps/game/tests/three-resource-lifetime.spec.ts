import { expect, test } from "@playwright/test";

test("instanced raycasts preserve hits without retaining retired scene inputs", async ({
  page,
  context,
}) => {
  await page.goto("/audio/source/manifest.json");
  const cdp = await context.newCDPSession(page);
  try {
    for (const hit of [true, false]) {
      const fixture = await page.evaluateHandle(async (hit) => {
        const path = "/tests/three-fixture.ts";
        const T = (await import(path)) as typeof import("three");
        const root = new T.Group();
        const geometry = new T.BoxGeometry(2, 4, 6);
        const material = new T.MeshStandardMaterial();
        // Native shader callbacks can refer back to a map object or its resources.
        material.onBeforeCompile = () => {
          root.updateMatrixWorld();
        };
        const mesh = new T.InstancedMesh(geometry, material, 2);
        mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(1.5, 0.25, 0));
        mesh.setMatrixAt(1, new T.Matrix4().makeTranslation(1.5, 0.25, -10));
        root.add(mesh);
        root.updateMatrixWorld(true);
        const ray = new T.Raycaster(
          new T.Vector3(hit ? 1.75 : 100, 0.5, 10),
          new T.Vector3(0, 0, -1),
        );
        const intersections = ray.intersectObject(root, true);
        const hits = intersections.map((entry) => ({
          instance: entry.instanceId,
          distance: entry.distance,
          point: entry.point.toArray(),
          correctObject: entry.object === mesh,
        }));
        mesh.dispose();
        geometry.dispose();
        material.dispose();
        return {
          hits,
          references: [root, mesh, geometry, material].map((value) => new WeakRef(value)),
        };
      }, hit);
      try {
        expect(await fixture.evaluate((value) => value.hits)).toEqual(
          hit
            ? [
                { instance: 0, distance: 7, point: [1.75, 0.5, 3], correctObject: true },
                { instance: 1, distance: 17, point: [1.75, 0.5, -7], correctObject: true },
              ]
            : [],
        );
        // Run outside the creation/dereference task. No production forced GC.
        await cdp.send("HeapProfiler.collectGarbage");
        await cdp.send("HeapProfiler.collectGarbage");
        expect(
          await fixture.evaluate((value) =>
            value.references.map((reference) => !!reference.deref()),
          ),
        ).toEqual([false, false, false, false]);
      } finally {
        await fixture.dispose();
      }
    }
  } finally {
    await cdp.detach();
  }
});

test("array preparation preserves source pixels, caller state and texture ownership", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const three = "/tests/three-fixture.ts",
      preparation = "/src/shader-preparation.ts";
    const T = (await import(three)) as typeof import("three");
    const { prepareNativeTextureArrays } = (await import(
      preparation
    )) as typeof import("../src/shader-preparation");
    const renderer = new T.WebGLRenderer(),
      gl = renderer.getContext() as WebGL2RenderingContext;
    const rgba = new T.DataArrayTexture(
      new Uint8Array([3, 5, 7, 255, 11, 13, 17, 255, 19, 23, 29, 255, 31, 71, 151, 255]),
      2,
      2,
      1,
    );
    const hdr = new T.DataArrayTexture(
      new Uint16Array([0x3800, 0x3400, 0x3a00, 0x3c00, 0x3000, 0x3b00, 0, 0x3c00]),
      1,
      1,
      2,
    );
    hdr.type = T.HalfFloatType;
    const mipped = new T.CompressedArrayTexture(
      [4, 2, 1].map((size, lod) => ({
        width: size,
        height: size,
        data: Uint8Array.from(
          { length: size * size * 2 * 4 },
          (_, index) =>
            [17 + lod + 30 * Math.floor(index / (size * size * 4)), 47, 91, 255][index % 4]!,
        ),
      })),
      4,
      4,
      2,
      T.RGBAFormat as import("three").CompressedPixelFormat,
    );
    const textures = [rgba, hdr, mipped];
    for (const texture of textures) {
      texture.minFilter = texture.magFilter = T.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
    }
    mipped.minFilter = T.NearestMipmapNearestFilter;
    const sources = [rgba.image.data!, hdr.image.data!, ...mipped.mipmaps.map((mip) => mip.data)];
    const bytes = sources.map((source) =>
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice(),
    );
    const target = new T.WebGLRenderTarget(17, 11),
      pack = gl.createBuffer();
    const scene = new T.Scene(),
      camera = new T.Camera(),
      geometry = new T.PlaneGeometry(2, 2);
    const material = new T.RawShaderMaterial({
      glslVersion: T.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: { image: { value: rgba }, layer: { value: 0 }, lod: { value: 0 } },
      vertexShader:
        "precision highp float; in vec3 position; void main(){gl_Position=vec4(position,1.);}",
      fragmentShader:
        "precision highp float; uniform highp sampler2DArray image; uniform float layer; uniform float lod; out vec4 color; void main(){color=textureLod(image,vec3(.5,.5,layer),lod);}",
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    try {
      renderer.setRenderTarget(target);
      renderer.setViewport(2, 3, 7, 5);
      renderer.setScissor(1, 2, 3, 4);
      renderer.setScissorTest(true);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pack);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, 16, gl.STREAM_READ);
      const controller = new AbortController();
      controller.abort("cancelled");
      let aborted;
      try {
        prepareNativeTextureArrays(renderer, textures, controller.signal);
      } catch (error) {
        aborted = String(error);
      }
      const before = renderer.info.memory.textures;
      prepareNativeTextureArrays(renderer, [hdr, rgba, mipped, rgba]);
      const prepared = renderer.info.memory.textures - before;
      prepareNativeTextureArrays(renderer, textures);
      const state = {
        target: renderer.getRenderTarget() === target,
        viewport: renderer.getViewport(new T.Vector4()).toArray(),
        scissor: renderer.getScissor(new T.Vector4()).toArray(),
        scissorTest: renderer.getScissorTest(),
        pack: gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) === pack,
        textures: renderer.info.memory.textures - before,
        geometries: renderer.info.memory.geometries,
        programs: renderer.info.programs!.length,
      };
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      renderer.setViewport(0, 0, 1, 1);
      renderer.setScissorTest(false);
      const pixels: number[][] = [];
      for (const [texture, layer, lod] of [
        [rgba, 0, 0],
        [hdr, 0, 0],
        [hdr, 1, 0],
        [mipped, 0, 0],
        [mipped, 1, 0],
        [mipped, 1, 2],
      ] as const) {
        material.uniforms.image!.value = texture;
        material.uniforms.layer!.value = layer;
        material.uniforms.lod!.value = lod;
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        pixels.push([...pixel]);
      }
      const unchanged = sources.every((source, index) => {
        const data = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        return data.every((value, offset) => value === bytes[index]![offset]);
      });
      material.uniforms.image!.value = null;
      renderer.setRenderTarget(null);
      target.dispose();
      geometry.dispose();
      material.dispose();
      for (const texture of textures) texture.dispose();
      return {
        aborted,
        prepared,
        state,
        unchanged,
        pixels,
        error: gl.getError(),
        remaining: { ...renderer.info.memory },
        programs: renderer.info.programs!.length,
      };
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(pack);
      renderer.setRenderTarget(null);
      target.dispose();
      geometry.dispose();
      material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    }
  });
  expect(result.aborted).toBe("cancelled");
  expect(result.prepared).toBe(3);
  expect(result.state).toEqual({
    target: true,
    viewport: [2, 3, 7, 5],
    scissor: [1, 2, 3, 4],
    scissorTest: true,
    pack: true,
    textures: 3,
    geometries: 0,
    programs: 0,
  });
  expect(result.unchanged).toBe(true);
  expect(result.pixels).toEqual([
    [31, 71, 151, 255],
    [128, 64, 191, 255],
    [32, 223, 0, 255],
    [17, 47, 91, 255],
    [47, 47, 91, 255],
    [49, 47, 91, 255],
  ]);
  expect(result.remaining).toEqual({ geometries: 0, textures: 0 });
  expect(result.programs).toBe(0);
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
});
