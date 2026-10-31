import { test, expect } from "@playwright/test";

test("smoke clips optical depth at actual cover from outside and inside", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      !request.url().startsWith("data:") &&
      new URL(request.url()).origin !== "http://127.0.0.1:5173"
    )
      external.push(request.url());
  });
  await page.route("http://127.0.0.1:5173/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body style='margin:0'></body></html>",
    }),
  );
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const threePath = "/node_modules/.vite/deps/three.js";
    const smokePath = "/src/smoke-renderer.ts";
    const T = await import(threePath);
    const { SmokeRenderer, SmokeComposite } = await import(smokePath);
    const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(800, 600);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    document.body.append(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color(0x80b6dc);
    const camera = new T.PerspectiveCamera(65, 800 / 600, 0.01, 100);
    camera.position.set(0, 1.65, 8);
    camera.lookAt(0, 1.65, 0);
    const wall = new T.Mesh(
      new T.BoxGeometry(8, 8, 0.1),
      new T.MeshBasicMaterial({ color: 0xe02020 }),
    );
    wall.position.set(0, 1.65, 5);
    wall.material.onBeforeCompile = (shader: { fragmentShader: string }) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <tonemapping_fragment>",
        "#include <tonemapping_fragment>\ngl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.0)),vec3(1.08));",
      );
    };
    scene.add(wall);
    const cells = [];
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++)
        for (let y = 0; y <= 2; y++) {
          if (Math.hypot(x, z) <= 3.3) cells.push(new T.Vector3(x, y * 0.85 + 0.3, z));
        }
    const cloud = new SmokeRenderer(cells, new T.SphereGeometry(1, 18, 12));
    cloud.update(3, 1, 3, [], -1);
    scene.add(cloud.batch);
    const composite = new SmokeComposite();
    const read = () => {
      const pixel = new Uint8Array(4),
        gl = renderer.getContext();
      gl.readPixels(400, 300, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    cloud.batch.visible = false;
    renderer.render(scene, camera);
    const clearCover = read();
    cloud.batch.visible = true;
    composite.render(renderer, scene, camera, [cloud]);
    const smokedCover = read();
    camera.position.z = 0;
    wall.position.z = -0.5;
    composite.render(renderer, scene, camera, [cloud]);
    const nearWall = read();
    const nearImage = renderer.domElement.toDataURL();
    wall.position.z = -3;
    composite.render(renderer, scene, camera, [cloud]);
    const distantWall = read();
    const distantImage = renderer.domElement.toDataURL();
    wall.position.z = -0.5;
    const alpha = new T.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1);
    alpha.needsUpdate = true;
    wall.material.map = alpha;
    wall.material.alphaTest = 0.5;
    wall.material.needsUpdate = true;
    const material = wall.material;
    composite.render(renderer, scene, camera, [cloud]);
    const cutout = read();
    const materialRestored = wall.material === material;
    wall.visible = false;
    composite.render(renderer, scene, camera, [cloud]);
    const unobstructed = read();
    composite.render(renderer, scene, camera, [cloud], true);
    const lowPixel = read();
    const lowSize = [composite.target.width, composite.target.height];
    composite.render(renderer, scene, camera, [cloud]);
    const target = composite.target;
    const residentBytes = target.width * target.height * 5;
    const cameraMask = camera.layers.mask;
    const targetRestored = renderer.getRenderTarget() === null;
    let disposed = false;
    target.addEventListener("dispose", () => {
      disposed = true;
    });
    cloud.batch.visible = false;
    composite.render(renderer, scene, camera, []);
    const released = composite.target === undefined;
    renderer.setPixelRatio(0.84327);
    renderer.setSize(800, 600);
    wall.visible = true;
    wall.material.map = null;
    wall.material.alphaTest = 0;
    wall.material.needsUpdate = true;
    wall.scale.x = 0.05;
    wall.position.z = 5;
    camera.position.z = 8;
    cloud.batch.visible = true;
    cloud.material.uniforms.fade.value = 0;
    const readFrame = () => {
      const gl = renderer.getContext(),
        pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      return pixels;
    };
    renderer.clear();
    renderer.render(scene, camera);
    const reference = readFrame();
    const originalViewport = renderer.getCurrentViewport(new T.Vector4()).toArray();
    renderer.shadowMap.needsUpdate = true;
    composite.render(renderer, scene, camera, [cloud], true);
    const fractional = readFrame();
    let fractionalDifference = 0;
    for (let i = 0; i < reference.length; i++)
      fractionalDifference = Math.max(fractionalDifference, Math.abs(reference[i] - fractional[i]));
    const restoredViewport = renderer.getCurrentViewport(new T.Vector4()).toArray();
    const shadowUpdatePreserved = renderer.shadowMap.needsUpdate;
    const destination = new T.WebGLRenderTarget(32, 32);
    destination.viewport.set(4, 4, 24, 24);
    renderer.setRenderTarget(destination);
    composite.render(renderer, scene, camera, [cloud]);
    const customTargetRestored = renderer.getRenderTarget() === destination;
    const customViewport = renderer.getCurrentViewport(new T.Vector4()).toArray();
    renderer.setRenderTarget(null);
    destination.dispose();
    return {
      released,
      fractionalDifference,
      originalViewport,
      restoredViewport,
      shadowUpdatePreserved,
      customTargetRestored,
      customViewport,
      lowPixel,
      lowSize,
      nearImage,
      distantImage,
      cutout,
      unobstructed,
      materialRestored,
      clearCover,
      smokedCover,
      nearWall,
      distantWall,
      residentBytes,
      cameraMask,
      targetRestored,
      disposed,
    };
  });
  await page.setViewportSize({ width: 800, height: 600 });
  for (const [name, data] of [
    ["near-wall", result.nearImage],
    ["distant-wall", result.distantImage],
  ]) {
    await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      document.body.replaceChildren(image);
    }, data);
    await page.screenshot({ path: `artifacts/smoke-depth-${name}.png` });
  }
  expect(result.materialRestored).toBe(true);
  expect(result.fractionalDifference).toBeLessThanOrEqual(2);
  expect(result.restoredViewport).toEqual(result.originalViewport);
  expect(result.shadowUpdatePreserved).toBe(true);
  expect(result.customTargetRestored).toBe(true);
  expect(result.customViewport).toEqual([4, 4, 24, 24]);
  expect(result.lowSize).toEqual([400, 300]);
  for (let i = 0; i < 3; i++)
    expect(Math.abs(result.lowPixel[i] - result.unobstructed[i])).toBeLessThanOrEqual(2);
  expect(result.cutout).toEqual(result.unobstructed);
  for (let channel = 0; channel < 3; channel++)
    expect(Math.abs(result.clearCover[channel] - result.smokedCover[channel])).toBeLessThanOrEqual(
      2,
    );
  // The near wall receives only the intervening fog; a distant wall is much more obscured.
  const saturation = (pixel: number[]) => pixel[0] - pixel[1];
  expect(saturation(result.nearWall)).toBeLessThan(saturation(result.clearCover));
  expect(saturation(result.nearWall)).toBeGreaterThan(saturation(result.distantWall) + 20);
  expect(result).toMatchObject({
    cameraMask: 1,
    targetRestored: true,
    disposed: true,
    released: true,
    residentBytes: 800 * 600 * 5,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
