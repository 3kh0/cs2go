import * as T from "three";
import { SmokeComposite, SmokeRenderer, registerSceneDepthMaterial } from "../src/smoke-renderer";

export function nativeOpaqueReuseFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(96, 64);
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene();
  scene.background = new T.Color(0.125, 0.25, 0.5);
  const camera = new T.PerspectiveCamera(65, 1.5, 0.1, 100);
  camera.position.z = 6;
  const geometry = new T.BoxGeometry(0.7, 0.7, 0.7);
  const opaque = new T.MeshBasicMaterial({ color: new T.Color(2, 0.5, 0.25) });
  const group = new T.Group();
  scene.add(group);
  for (let i = 0; i < 32; i++) {
    const mesh = new T.Mesh(geometry, opaque);
    mesh.position.set(((i % 8) - 3.5) * 0.8, (Math.floor(i / 8) - 1.5) * 0.8, -2);
    group.add(mesh);
  }
  const parent = group.children[12];
  const transparent = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  transparent.position.z = 0.6;
  parent.add(transparent);
  // Excluding a transparent parent must also retain its opaque descendants
  // for the remaining pass, including across intervening non-mesh groups.
  const nestedGroup = new T.Group();
  nestedGroup.renderOrder = 3;
  const nestedOpaque = new T.Mesh(geometry, opaque);
  nestedOpaque.scale.setScalar(0.35);
  nestedOpaque.position.set(0.25, 0.25, 0.25);
  nestedGroup.add(nestedOpaque);
  transparent.add(nestedGroup);
  const mixed = new T.Mesh(geometry, [opaque, transparent.material]);
  mixed.position.set(1.5, 1, 0.5);
  const mixedChild = new T.Mesh(geometry, opaque);
  mixedChild.scale.setScalar(0.25);
  mixedChild.position.z = 0.6;
  mixed.add(mixedChild);
  group.add(mixed);
  const initiallyHidden = new T.Mesh(geometry, opaque);
  initiallyHidden.visible = false;
  transparent.add(initiallyHidden);
  const cutoutTexture = new T.DataTexture(
    new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]),
    2,
    1,
  );
  cutoutTexture.needsUpdate = true;
  const cutout = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    new T.MeshBasicMaterial({ map: cutoutTexture, alphaTest: 0.5, color: 0xffffff }),
  );
  cutout.position.set(-1, 0, 0);
  scene.add(cutout);
  const dependent = new T.ShaderMaterial({
    uniforms: {
      colorFrame: { value: null },
      depthFrame: { value: null },
      useColor: { value: true },
      size: { value: new T.Vector2(96, 64) },
    },
    vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "uniform sampler2D colorFrame,depthFrame;uniform bool useColor;uniform vec2 size;void main(){vec2 uv=gl_FragCoord.xy/size;vec3 base=useColor?texture2D(colorFrame,uv).rgb:vec3(.25,.5,.75);gl_FragColor=vec4(base*.75+texture2D(depthFrame,uv).r*.125,1.);}",
  });
  registerSceneDepthMaterial(dependent);
  const receiver = new T.Mesh(new T.PlaneGeometry(3, 1), dependent);
  receiver.position.set(0.5, -0.75, 0.5);
  scene.add(receiver);
  const smoke = new SmokeRenderer([new T.Vector3(0.75, 0.5, 1)], new T.SphereGeometry(1, 8, 6));
  scene.add(smoke.batch);
  const target = new T.WebGLRenderTarget(96, 64, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const baseline = new SmokeComposite(),
    reuse = new SmokeComposite();
  const rows = [];
  const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  // Returning to water also exercises target/filter changes after plain reuse.
  for (const mode of ["water", "fx", "water", "smoke"])
    for (const clouds of [false, true])
      for (const partial of [false, true]) {
        smoke.batch.visible = clouds;
        receiver.visible = mode !== "smoke";
        dependent.depthWrite = mode === "water";
        dependent.uniforms.useColor.value = mode === "water";
        const runs = [];
        for (const [optimized, composite] of [
          [false, baseline],
          [true, reuse],
        ] as const) {
          renderer.setRenderTarget(target);
          renderer.setViewport(partial ? new T.Vector4(8, 8, 80, 48) : new T.Vector4(0, 0, 96, 64));
          renderer.info.autoReset = false;
          renderer.info.reset();
          renderer.clear();
          if (mode !== "water") dependent.uniforms.colorFrame.value = white;
          composite.render(
            renderer,
            scene,
            camera,
            clouds ? [smoke] : [],
            false,
            mode === "smoke"
              ? undefined
              : {
                  color:
                    mode === "water"
                      ? {
                          exclude: new Set([receiver]),
                          setColor(texture) {
                            dependent.uniforms.colorFrame.value = texture;
                          },
                        }
                      : undefined,
                  setDepth(texture) {
                    dependent.uniforms.depthFrame.value = texture;
                  },
                },
            undefined,
            optimized,
          );
          const pixels = new Uint16Array(96 * 64 * 4);
          renderer.readRenderTargetPixels(target, 0, 0, 96, 64, pixels);
          runs.push({
            pixels,
            calls: renderer.info.render.calls,
            mipmaps: composite.target?.texture.generateMipmaps ?? false,
          });
        }
        let changed = 0,
          maxError = 0;
        for (let i = 0; i < runs[0].pixels.length; i++) {
          if (runs[0].pixels[i] !== runs[1].pixels[i]) changed++;
          maxError = Math.max(
            maxError,
            Math.abs(
              T.DataUtils.fromHalfFloat(runs[0].pixels[i]) -
                T.DataUtils.fromHalfFloat(runs[1].pixels[i]),
            ),
          );
        }
        rows.push({
          mode,
          clouds,
          partial,
          changed,
          maxError,
          baselineCalls: runs[0].calls,
          reuseCalls: runs[1].calls,
          captureMipmaps: runs.map((run) => run.mipmaps),
          layersRestored:
            group.children.every((mesh) => mesh.layers.mask === 1) &&
            transparent.layers.mask === 1 &&
            nestedOpaque.layers.mask === 1 &&
            mixedChild.layers.mask === 1 &&
            smoke.batch.layers.mask === 1,
          visibilityRestored: transparent.visible && mixed.visible && !initiallyHidden.visible,
          backgroundRestored: scene.background instanceof T.Color,
          glError: renderer.getContext().getError(),
        });
      }
  renderer.dispose();
  return rows;
}

/** Real utility hierarchy, compared with the unchanged nested-scene fallback. */
export function nativeGameplaySmokeRootsFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(96, 64);
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(96, 64, { type: T.HalfFloatType });
  const scene = new T.Scene();
  scene.background = new T.Color(0.12, 0.25, 0.5);
  const camera = new T.PerspectiveCamera(65, 1.5, 0.1, 30);
  const wall = new T.Mesh(
    new T.BoxGeometry(8, 6, 0.2),
    new T.MeshBasicMaterial({ color: 0xcc5522 }),
  );
  wall.position.set(0, 1, -2);
  scene.add(wall);
  const cover = new T.Mesh(
    new T.BoxGeometry(0.8, 3, 0.4),
    new T.MeshBasicMaterial({ color: 0x226633 }),
  );
  cover.position.set(-0.6, 1, 1);
  scene.add(cover);
  const sphere = new T.SphereGeometry(1, 18, 12);
  const clouds = Array.from({ length: 6 }, (_, index) => {
    const x = ((index % 3) - 1) * 0.3,
      z = Math.floor(index / 3) * 0.35;
    return new SmokeRenderer(
      [new T.Vector3(x, 0.5, z), new T.Vector3(x, 1.3, z), new T.Vector3(x + 0.5, 0.9, z)],
      sphere,
    );
  });
  const roots = clouds.map((cloud, index) => {
    const root = new T.Group();
    root.layers.enable(31);
    root.renderOrder = index % 2;
    root.add(cloud.batch);
    scene.add(root, new T.Group());
    return root;
  });
  const originalChildren = [...scene.children];
  const blockers = roots.map(() => new T.Group());
  const composite = new SmokeComposite();
  const render = renderer.render.bind(renderer);
  let cloudOnly = false;
  renderer.render = (drawScene, drawCamera) => {
    if (drawCamera.layers.mask === 0x80000000) cloudOnly = drawScene !== scene;
    render(drawScene, drawCamera);
  };
  const rows = [];
  for (const inside of [false, true])
    for (const state of ["filled", "holes", "recovery", "hidden"] as const) {
      camera.position.set(0.25, 1.15, inside ? 0.2 : 6);
      camera.lookAt(0, 1, -2);
      roots[2].visible = state !== "hidden";
      clouds.forEach((cloud, index) =>
        cloud.update(
          4,
          1,
          10,
          state === "holes" && index % 2 === 0 ? [11, 0, 11] : [],
          state === "recovery" ? -0.175 : -1,
          2,
        ),
      );
      // A smoke-free image prevents two equally empty/broken passes from
      // passing the pixel comparison.
      roots.forEach((root) => {
        root.visible = false;
      });
      renderer.setRenderTarget(target);
      composite.render(renderer, scene, camera, []);
      const clearPixels = new Uint16Array(96 * 64 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 96, 64, clearPixels);
      roots.forEach((root, index) => {
        root.visible = state !== "hidden" || index !== 2;
      });
      const runs = [];
      for (const optimized of [false, true]) {
        roots.forEach((root, index) => {
          if (optimized) blockers[index].removeFromParent();
          else root.add(blockers[index]);
        });
        renderer.setRenderTarget(target);
        renderer.clear();
        cloudOnly = false;
        composite.render(renderer, scene, camera, clouds);
        const pixels = new Uint16Array(96 * 64 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 96, 64, pixels);
        runs.push({ pixels, cloudOnly });
      }
      let changed = 0,
        smokePixels = 0;
      for (let i = 0; i < runs[0].pixels.length; i++) {
        if (runs[0].pixels[i] !== runs[1].pixels[i]) changed++;
        if (runs[1].pixels[i] !== clearPixels[i]) smokePixels++;
      }
      rows.push({
        inside,
        state,
        changed,
        smokePixels,
        cloudOnly: runs.map((run) => run.cloudOnly),
        restored:
          scene.children.every((child, index) => child === originalChildren[index]) &&
          roots.every(
            (root, index) => root.parent === scene && clouds[index].batch.parent === root,
          ),
        glError: renderer.getContext().getError(),
      });
    }
  clouds.forEach((cloud) => cloud.dispose());
  sphere.dispose();
  wall.geometry.dispose();
  wall.material.dispose();
  cover.geometry.dispose();
  cover.material.dispose();
  composite.target?.dispose();
  target.dispose();
  renderer.dispose();
  return rows;
}
