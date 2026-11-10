import * as T from "three";
import { applyNativeMapProbes } from "../src/native-map-probes";
import { applyNativeMapComplex } from "../src/native-map-complex";
import { nativeComplexRareSources } from "./native-complex-rare-source-fixture";
export function renderNativeComplexRare() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.autoClear = false;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const sample: Record<string, number[]> = {
    g_tColor: [0.2, 0.4, 0.6, 0.8],
    g_tNormal: [0.8, 0.2, 0.35, 0.1],
    g_tAmbientOcclusion: [0.31, 0, 0, 1],
    g_tTintMask: [0.37, 0, 0, 1],
    g_tMetalness: [0.91, 0.19, 0.72, 1],
    g_tSelfIllumMask: [0.2, 0.6, 0.9, 1],
    g_tTransmissiveColor: [0.7, 0.3, 0.8, 1],
    g_tDetail: [0.7, 0.3, 0.6, 1],
    g_tDetailMask: [0.44, 0, 0, 1],
  };
  const tint: [number, number, number] = [0.3, 0.6, 0.9],
    results = [];
  for (const [group, source] of Object.entries(nativeComplexRareSources))
    for (const output of ["colorMetal", "emission", "transmission", "normalFront", "normalBack"]) {
      if (output === "normalBack" && !source.IntParams.F_RENDER_BACKFACES) continue;
      const paints: (number[] | "mixed" | undefined)[] = source.IntParams.F_PAINT_VERTEX_COLORS
        ? [[0, 0, 0, 0], [0, 0, 0, 1], [0.2, 0.7, 0.3, 0.4], "mixed"]
        : [undefined];
      for (const paint of paints) {
        const scene = new T.Scene(),
          geometry = new T.PlaneGeometry(2, 2);
        geometry.computeTangents();
        if (output === "normalBack") {
          const indices = geometry.getIndex()!;
          for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i);
            indices.setX(i, indices.getX(i + 2));
            indices.setX(i + 2, a);
          }
        }
        if (paint)
          geometry.setAttribute(
            "nativeComplexPaint",
            new T.Float32BufferAttribute(
              (paint === "mixed"
                ? [
                    [0, 0, 0, 0],
                    [0.2, 0.7, 0.3, 0.4],
                    [0, 0, 0, 0],
                    [0.2, 0.7, 0.3, 0.4],
                  ]
                : Array.from({ length: 4 }, () => paint)
              ).flat(),
              4,
            ),
          );
        const material = new T.MeshStandardMaterial();
        material.name = group;
        material.color.setRGB(...tint);
        material.opacity = 0.67;
        const mesh = new T.Mesh(geometry, material);
        scene.add(mesh);
        const light = new T.DirectionalLight(new T.Color().setRGB(0.7, 0.4, 0.2), 1);
        light.position.set(0, 0, -2);
        scene.add(light);
        const textures = new Map<string, T.Texture>();
        for (const id of Object.values(source.textures)) {
          const value = sample[id] ?? [0, 0, 0, 1],
            t = new T.DataTexture(new Float32Array(value), 1, 1, T.RGBAFormat, T.FloatType);
          t.needsUpdate = true;
          textures.set(id, t);
        }
        const view = applyNativeMapComplex(scene, {
          materials: { [group]: source },
          textures,
          lookup: textures.get("g_tColor") as T.DataTexture,
        });
        material.blending = T.NoBlending; // Inspect arithmetic independently; composition has a separate fixture.
        const before = material.onBeforeCompile.bind(material);
        material.onBeforeCompile = (shader, r) => {
          before(shader, r);
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            output.startsWith("normal")
              ? "gl_FragColor=vec4(normal,roughnessFactor);"
              : output === "colorMetal"
                ? "gl_FragColor=vec4(diffuseColor.rgb,metalnessFactor);"
                : output === "emission"
                  ? `gl_FragColor=vec4(${source.IntParams.F_SELF_ILLUM ? "mix(nativeAdvancedE,nativeAdvancedE*diffuseColor.rgb,nativeAdvancedEmissionAlbedo)" : "vec3(0)"},1.);`
                  : "gl_FragColor=vec4(nativeAdvancedTransmitted,1.);",
          );
          shader.fragmentShader = shader.fragmentShader.replace(/gl_FragColor.a=[^;]+;/g, "");
        };
        view.syncDepth(renderer);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(view.depthScene, camera);
        renderer.render(scene, camera);
        const pixel = new Float32Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        const effectivePaint = paint === "mixed" ? [0.6, 0.85, 0.65, 0.7] : paint;
        const factor = tint.map(
          (v, i) =>
            v * (effectivePaint && !effectivePaint.every((x) => x === 0) ? effectivePaint[i] : 1),
        );
        const mask = source.IntParams.F_TINT_MASK ? 0.37 : 1,
          detail = source.IntParams.F_DETAIL_TEXTURE === 1;
        const color = [0.2, 0.4, 0.6].map(
          (v, i) =>
            v *
            (1 + (factor[i] - 1) * mask) *
            (detail ? 1 + ((sample.g_tDetail[i] * 508) / 255 - 1) * 0.44 : 1),
        );
        const values = source.resolvedMaterialInputs,
          emissionTint = values.g_vSelfIllumTintScaled as number[] | undefined,
          albedo = values.g_flSelfIllumAlbedoFactor as number[] | undefined;
        const nx = 0.8 + 0.2 - 256 / 255,
          ny = 0.8 - 0.2,
          nz = 1 - Math.abs(nx) - Math.abs(ny),
          nl = Math.hypot(nx, ny, nz);
        const expected = output.startsWith("normal")
          ? [nx / nl, -ny / nl, (output === "normalBack" ? -nz : nz) / nl, 0.35]
          : output === "colorMetal"
            ? [...color, source.IntParams.F_METALNESS_TEXTURE ? 0.19 : 0]
            : output === "emission"
              ? [
                  ...color.map((v, i) =>
                    source.IntParams.F_SELF_ILLUM
                      ? sample.g_tSelfIllumMask[i] * emissionTint![i] * (1 + (v - 1) * albedo![0])
                      : 0,
                  ),
                  1,
                ]
              : [
                  ...(source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL ? [0.7, 0.4, 0.2] : [0, 0, 0]),
                  1,
                ];
        results.push({
          group,
          output,
          paint,
          pixel: Array.from(pixel),
          expected,
          error: renderer.getContext().getError(),
        });
        view.dispose();
        textures.forEach((t) => t.dispose());
        geometry.dispose();
        material.dispose();
      }
    }
  target.dispose();
  renderer.dispose();
  return results;
}

export function renderNativeComplexRareCoverage(
  source = nativeComplexRareSources.mountains,
  options: {
    hardMask?: boolean;
    skipDepth?: boolean;
    debugMetal?: boolean;
    wrongCutoff?: boolean;
    clone?: boolean;
    mip?: "base" | "far";
  } = {},
) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.autoClear = false;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const results = [];
  for (const [samples, scale, uvScale] of [
    [0, 1, 1],
    [4, 1, 1],
    [4, 16, 1],
    [4, 16, 4],
  ])
    for (const alpha of [0.25, 0.49, 0.5, 0.75]) {
      const target = new T.WebGLRenderTarget(32, 32, { samples }),
        scene = new T.Scene(),
        geometry = new T.PlaneGeometry(2, 2);
      geometry.computeTangents();
      const uv = geometry.getAttribute("uv");
      const fenceFootprint =
        source.advancedSelection?.contract === "opaque-alpha-build26445667" ? 2 : 1;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          uv.getX(i) *
            uvScale *
            fenceFootprint *
            (options.mip === "far" ? 64 : options.mip === "base" ? 0.25 : 1),
          uv.getY(i) *
            uvScale *
            fenceFootprint *
            (options.mip === "far" ? 64 : options.mip === "base" ? 0.25 : 1),
        );
      camera.left = -scale;
      camera.right = scale;
      camera.top = scale;
      camera.bottom = -scale;
      camera.far = 100 * scale;
      camera.position.z = 3 * scale;
      camera.updateProjectionMatrix();
      const material = new T.MeshStandardMaterial();
      material.name = "mountains";
      const mesh = new T.Mesh(geometry, material);
      mesh.scale.setScalar(scale);
      scene.add(mesh);
      const textures = new Map<string, T.Texture>();
      for (const id of Object.values(source.textures)) {
        const texture = new T.DataTexture(
          new Float32Array(id === "g_tColor" ? [1, 1, 1, alpha] : [0.6, 0.6, 0.5, 1]),
          1,
          1,
          T.RGBAFormat,
          T.FloatType,
        );
        if (options.mip && id === "g_tColor") {
          const level = (size: number, a: number) => ({
            data: new Float32Array(
              Array.from({ length: size * size * 4 }, (_, i) => (i % 4 === 3 ? a : 1)),
            ),
            width: size,
            height: size,
          });
          const base = level(4, alpha);
          texture.image = { data: base.data, width: 4, height: 4 };
          texture.mipmaps = [base, level(2, 0.5), level(1, 0.25)];
          texture.generateMipmaps = false;
          texture.minFilter = T.NearestMipmapNearestFilter;
          texture.magFilter = T.NearestFilter;
        }
        texture.needsUpdate = true;
        textures.set(id, texture);
      }
      const view = applyNativeMapComplex(scene, {
        materials: { mountains: source },
        textures,
        lookup: textures.get("g_tColor") as T.DataTexture,
      });
      const previous = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, r) => {
        previous(shader, r);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          options.debugMetal
            ? "gl_FragColor=vec4(vec3(metalnessFactor),1.);"
            : "gl_FragColor=vec4(1);",
        );
      };
      if (options.hardMask || options.wrongCutoff)
        for (const object of view.depthScene.children) {
          const depth = (object as T.Mesh).material as T.MeshDepthMaterial;
          const compile = depth.onBeforeCompile.bind(depth);
          depth.onBeforeCompile = (shader, r) => {
            compile(shader, r);
            if (options.hardMask)
              shader.fragmentShader = shader.fragmentShader.replace(
                "if(nativeComplexDepthAA)",
                "if(false)",
              );
            if (options.wrongCutoff)
              (shader.uniforms.nativeComplexDepthControl.value as T.Vector3).x = 0.5;
          };
          depth.customProgramCacheKey = () =>
            `coverage-negative:${!!options.hardMask}:${!!options.wrongCutoff}`;
        }
      const cloneTextures: T.Texture[] = [];
      if (options.clone) {
        const array = (n: number) => {
          const t = new T.DataArrayTexture(new Uint8Array(n * 4).fill(128), 1, 1, n);
          t.needsUpdate = true;
          cloneTextures.push(t);
          return t;
        };
        applyNativeMapProbes(scene, {
          textures: [array(6), array(1)],
          frames: [
            [1, 1, 1],
            [0, 0, 0],
            [1, 1, 1],
            [0, 0, 0],
            [1, 1, 1],
            [0, 0, 0],
            [0, 0, 0],
            [1, 1, 1],
          ].map((v) => new Float32Array(v)),
          sky: Array.from({ length: 3 }, () => new T.Vector4()),
          count: 1,
          depth: 1,
        });
      }
      renderer.setRenderTarget(target);
      view.syncDepth(renderer);
      renderer.setClearColor(0, 0);
      renderer.clear();
      if (!options.skipDepth) renderer.render(view.depthScene, camera);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
      results.push({
        samples,
        alpha,
        pixel: Array.from(pixel),
        scale,
        uvScale,
        error: renderer.getContext().getError(),
      });
      view.dispose();
      cloneTextures.forEach((t) => t.dispose());
      if (mesh.material !== material) (mesh.material as T.Material).dispose();
      textures.forEach((t) => t.dispose());
      geometry.dispose();
      material.dispose();
      target.dispose();
    }
  renderer.dispose();
  return results;
}

export function renderNativeComplexTruckBlend() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  const material = new T.MeshStandardMaterial();
  material.name = "truck";
  material.opacity = 0.67;
  scene.add(new T.Mesh(geometry, material));
  const source = nativeComplexRareSources.truck,
    textures = new Map<string, T.Texture>();
  for (const id of Object.values(source.textures)) {
    const texture = new T.DataTexture(
      new Float32Array([0.2, 0.4, 0.6, 0.8]),
      1,
      1,
      T.RGBAFormat,
      T.FloatType,
    );
    texture.needsUpdate = true;
    textures.set(id, texture);
  }
  const view = applyNativeMapComplex(scene, {
    materials: { truck: source },
    textures,
    lookup: textures.get("g_tColor") as T.DataTexture,
  });
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, r) => {
    previous(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "gl_FragColor=vec4(.4,.3,.2,1);",
    );
  };
  renderer.setRenderTarget(target);
  renderer.setClearColor(new T.Color().setRGB(0.1, 0.2, 0.3), 1);
  renderer.render(scene, camera);
  const pixel = new Float32Array(4);
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
  const result = {
    pixel: Array.from(pixel),
    expected: [0.4, 0.3, 0.2].map((x, i) => x * 0.536 + [0.1, 0.2, 0.3][i] * (1 - 0.536)),
    depthWrite: material.depthWrite,
    error: renderer.getContext().getError(),
  };
  view.dispose();
  textures.forEach((t) => t.dispose());
  geometry.dispose();
  material.dispose();
  target.dispose();
  renderer.dispose();
  return result;
}
