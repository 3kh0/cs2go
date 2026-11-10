import { createSourceFoliageSway } from "../src/source-foliage-wind";
import * as T from "three";
import { applyNativeMapLegacy, type NativeLegacyMaterial } from "../src/native-map-legacy";
function texture(values: number[], width = 1) {
  const result = new T.DataTexture(new Float32Array(values), width, 1, T.RGBAFormat, T.FloatType);
  result.minFilter = result.magFilter = T.NearestFilter;
  result.needsUpdate = true;
  return result;
}
/** Deliberately different R/G/B/A vectors expose wrong native packed-channel
 * selection. Primary-reference equations; installed selected-shader proof is
 * a separate required gate before map activation. */
export function renderNativeLegacy() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const results = [];
  for (const family of ["vertexlit", "simple"] as const)
    for (const mode of [
      "normal",
      "metalness",
      "ao",
      "specular-on",
      "specular-off",
      "constant",
      "tint-gate",
      "detail",
      "ao-base-uv",
      "ao-alternate-uv",
    ] as const) {
      const source: NativeLegacyMaterial = {
        shader: family === "vertexlit" ? "csgo_vertexlitgeneric.vfx" : "csgo_simple.vfx",
        nativeResource: "fixture-only-qualified-reference.vmat",
        IntParams:
          family === "vertexlit"
            ? { F_SPECULAR_DIRECT: mode === "specular-off" ? 0 : 1, F_SPECULAR_INDIRECT: 0 }
            : { F_METALNESS_TEXTURE: 1, F_AMBIENT_OCCLUSION_TEXTURE: 1 },
        FloatParams: {},
        VectorParams: {},
        textures: {
          g_tColor: "color",
          g_tNormal: "normal",
          g_tAmbientOcclusion: "ao",
          g_tMetalness: "metal",
        },
        resolvedMaterialInputs: {
          g_flReflectance: 0.04,
          g_bUseSecondaryUvForAmbientOcclusion: 0,
          g_flAmbientOcclusionScale: 0.75,
          g_flInverseBlendTint: 1,
        },
      };
      if (mode === "tint-gate") source.resolvedMaterialInputs.g_flInverseBlendTint = 0;
      if (mode === "detail" && family === "vertexlit") {
        source.IntParams.F_DETAIL_TEXTURE = 1;
        source.textures.g_tDetail = "detail";
        source.textures.g_tDetailMask = "detailMask";
        Object.assign(source.resolvedMaterialInputs, {
          g_vDetailTexCoordXform: [1.2, 0, 0, 1.2],
          g_vDetailTexCoordOffset: [-0.1, -0.1, 0.5, 0.5],
          g_flDetailBlendFactor: 0.837,
          g_flDetailBlendToFull: 0,
        });
      }
      if (mode === "constant")
        source.constants = {
          g_tColor: [0.3, 0.6, 0.2, 0.31],
          g_tNormal: [128 / 255, 128 / 255, 0.25, 0.9],
          g_tAmbientOcclusion: [0.25, 0.7, 0.4, 0.9],
          g_tMetalness: [0.1, 0.7, 0.3, 0.8],
        };
      if (mode === "ao-alternate-uv")
        source.resolvedMaterialInputs.g_bUseSecondaryUvForAmbientOcclusion = 1;
      const scene = new T.Scene(),
        camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 3;
      const geometry = new T.PlaneGeometry(2, 2);
      geometry.computeTangents();
      if (mode.endsWith("-uv")) {
        const uv = geometry.getAttribute("uv");
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.75, 0.5);
        geometry.setAttribute(
          "uv2",
          new T.Float32BufferAttribute(
            Array.from({ length: uv.count }, () => [0.25, 0.5]).flat(),
            2,
          ),
        );
      }
      const material = new T.MeshStandardMaterial();
      material.name = "legacy";
      if (mode === "tint-gate") material.color.setRGB(0.2, 0.4, 0.6);
      const mesh = new T.Mesh(geometry, material);
      scene.add(mesh);
      const textures = new Map([
          ["color", texture([0.3, 0.6, 0.2, 0.31])],
          [
            "normal",
            texture(mode === "normal" ? [0.8, 0.2, 0.25, 0.9] : [128 / 255, 128 / 255, 0.25, 0.9]),
          ],
          [
            "ao",
            mode.endsWith("-uv")
              ? texture([0.25, 0.7, 0.4, 0.9, 0.9, 0.7, 0.4, 0.9], 2)
              : texture([0.25, 0.7, 0.4, 0.9]),
          ],
          ["metal", texture([0.1, 0.7, 0.3, 0.8])],
          ["detail", texture([0.6, 0.7, 0.8, 1])],
          ["detailMask", texture([0.4, 0.2, 0.7, 1])],
        ]),
        lookup = texture([0.2, 0.7, 0, 1]);
      applyNativeMapLegacy(scene, { materials: { legacy: source }, textures, lookup });
      const before = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          mode === "tint-gate" || mode === "detail"
            ? "gl_FragColor=vec4(diffuseColor.rgb,1.);"
            : mode === "normal"
              ? "gl_FragColor=vec4(normal*.5+.5,roughnessFactor);"
              : mode === "metalness"
                ? "gl_FragColor=vec4(vec3(metalnessFactor),1.);"
                : mode === "constant"
                  ? "gl_FragColor=vec4(roughnessFactor,metalnessFactor,ambientOcclusion,1.);"
                  : mode === "ao" || mode.endsWith("-uv")
                    ? "gl_FragColor=vec4(vec3(ambientOcclusion),1.);"
                    : "gl_FragColor=vec4(reflectedLight.directSpecular,1.);",
        );
      };
      const light = new T.DirectionalLight(0xffffff, Math.PI);
      light.position.z = 3;
      scene.add(light);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixel = new Uint16Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      results.push({
        family,
        mode,
        pixel: [...pixel].map((v) => T.DataUtils.fromHalfFloat(v)),
        error: renderer.getContext().getError(),
      });
      material.dispose();
      geometry.dispose();
      lookup.dispose();
      textures.forEach((t) => t.dispose());
    }
  target.dispose();
  renderer.dispose();
  return results;
}

/** Synthetic linear volume with unequal RGB exposes sampler3D channels and
 * Source-inch displacement/gravity; it is not a production wind/noise default. */
export function renderFoliageSway() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const noise = new T.Data3DTexture(
    new Float32Array(Array.from({ length: 8 }, () => [0.2, 0.4, 0.8, 1]).flat()),
    2,
    2,
    2,
  );
  noise.type = T.FloatType;
  noise.format = T.RGBAFormat;
  noise.colorSpace = T.NoColorSpace;
  noise.minFilter = noise.magFilter = T.LinearFilter;
  noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
  noise.needsUpdate = true;
  const results = [];
  for (const mode of ["sway", "flutter", "rigid", "zero-controls"] as const) {
    const parameters = {
      swayAmount: mode === "flutter" || mode === "rigid" ? 0 : 0.3,
      swaySpeed: 0.5,
      swayNoiseScale: 0.916,
      swayFalloff: 2.867,
      flutterAmount: mode === "rigid" ? 0 : 0.15,
      flutterSpeed: 1.44,
      flutterNoiseScale: 1.644,
      flutterFalloff: 3.4,
    };
    const wind = createSourceFoliageSway(
      parameters,
      { direction: [0, -1, 0], strength: 0.5, timeSeconds: 3 },
      noise,
    );
    const controls = mode === "zero-controls" ? "vec4(0.0)" : "vec4(.25,.7,.5,1.)";
    const material = new T.ShaderMaterial({
      uniforms: wind.uniforms,
      vertexShader:
        wind.glsl +
        `varying vec3 vNativeDisplacement;void main(){vNativeDisplacement=sourceFoliageSwayPoint(vec3(0.),${controls});gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:
        "varying vec3 vNativeDisplacement;void main(){gl_FragColor=vec4(vNativeDisplacement,1.);}",
    });
    const geometry = new T.PlaneGeometry(2, 2),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    scene.add(new T.Mesh(geometry, material));
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Uint16Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    results.push({
      mode,
      pixel: [...pixel].map((v) => T.DataUtils.fromHalfFloat(v)),
      error: renderer.getContext().getError(),
    });
    material.dispose();
    geometry.dispose();
  }
  noise.dispose();
  target.dispose();
  renderer.dispose();
  return results;
}

export function renderNativeLegacySharedPrograms() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(2, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(2, 1, { type: T.HalfFloatType });
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(0, 2, 1, 0, 0.1, 10);
  camera.position.z = 3;
  const colors = [
      [0.9, 0.1, 0.2, 1],
      [0.1, 0.8, 0.3, 1],
    ],
    textures = new Map<string, T.Texture>(),
    materials: Record<string, NativeLegacyMaterial> = {};
  for (let i = 0; i < 2; i++) {
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.computeTangents();
    const material = new T.MeshStandardMaterial();
    material.name = `independent-${i}`;
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(i + 0.5, 0.5, 0);
    scene.add(mesh);
    textures.set(`native-color-${i}`, texture(colors[i]));
    materials[material.name] = {
      shader: "csgo_simple.vfx",
      nativeResource: `different-source-${i}.vmat`,
      IntParams: {},
      FloatParams: {},
      VectorParams: {},
      textures: { g_tColor: `native-color-${i}` },
      constants: { g_tNormal: [128 / 255, 128 / 255, 0.5, 1], g_tAmbientOcclusion: [1, 1, 1, 1] },
      resolvedMaterialInputs: { g_flReflectance: 0.04, g_flMetalness: 0 },
    };
  }
  const lookup = texture([0.2, 0.7, 0, 1]);
  applyNativeMapLegacy(scene, { materials, textures, lookup });
  for (const object of scene.children)
    if (object instanceof T.Mesh) {
      const material = object.material as T.MeshStandardMaterial,
        before = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "gl_FragColor=vec4(diffuseColor.rgb,1.);",
        );
      };
    }
  const passes = [];
  for (const reversed of [false, true]) {
    scene.children.forEach((o, i) => {
      o.renderOrder = reversed ? 1 - i : i;
    });
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const raw = new Uint16Array(8);
    renderer.readRenderTargetPixels(target, 0, 0, 2, 1, raw);
    passes.push({
      pixel: [...raw].map((v) => T.DataUtils.fromHalfFloat(v)),
      programs: renderer.info.programs?.length,
      error: renderer.getContext().getError(),
    });
  }
  scene.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
  });
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  target.dispose();
  renderer.dispose();
  return passes;
}
