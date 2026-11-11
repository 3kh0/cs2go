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
