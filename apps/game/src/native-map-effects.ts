import * as T from "three";
import { registerSceneDepthMaterial } from "./smoke-renderer";
import { assetFetch, assetUrl } from "./asset-url";
import { loadGzipped } from "./gltf";
import { MapResources } from "./map-resources";
import { createNativeSkyEffect, type NativeSkyEffectParameters } from "./native-sky-clouds";

export type NativeMapEffectsManifest = {
  model: string;
  effects: Record<string, NativeSkyEffectParameters>;
  textures: Record<string, { path: string; srgb: boolean }>;
  source: { browserWorldSpace: true; mapId: string };
};
const features = new Set([
  "F_DEPTH_FEATHER",
  "F_RENDER_BACKFACES",
  "F_DONT_FLIP_BACKFACE_NORMALS",
  "F_TINT_MASK",
  "F_ADDITIVE_BLEND",
  "F_DO_NOT_CAST_SHADOWS",
  "F_VERTEX_COLOR",
]);
export function validateNativeMapEffect(source: NativeSkyEffectParameters) {
  for (const [name, value] of Object.entries(source.IntParams))
    if (name.startsWith("F_") && value && !features.has(name))
      throw new Error(`Unsupported native map effect feature: ${name}`);
  for (const name of [
    "g_tColor",
    "g_tMask1",
    "g_tMask2",
    "g_tMask3",
    ...(source.IntParams.F_TINT_MASK ? ["g_tTintMask"] : []),
  ])
    if (!source.TextureParams[name]) throw new Error(`Native map effect sampler missing: ${name}`);
  if (
    Object.values(source.FloatParams).some((v) => !Number.isFinite(v)) ||
    Object.values(source.VectorParams).some((v) => v.some((n) => !Number.isFinite(n)))
  )
    throw new Error("Nonfinite native map effect parameters");
}
/** The native FX equations render into the main map's output transport rather
 * than the isolated linear sky target. Per-map scene fog is the existing map
 * renderer's fog; no Dust II global cube or exposure is borrowed. */
export function prepareNativeMapEffectOutput(material: T.ShaderMaterial, fog: boolean) {
  material.toneMapped = true;
  material.fog = fog;
  if (fog) {
    Object.assign(material.uniforms, T.UniformsUtils.clone(T.UniformsLib.fog));
    material.vertexShader = "#include <fog_pars_vertex>\n" + material.vertexShader;
    material.vertexShader = material.vertexShader
      .replace(
        "vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "vec4 mvPosition=modelViewMatrix*vec4(position,1.0);\nvec4 mv=mvPosition;",
      )
      .replace(
        "gl_Position = projectionMatrix * mv;",
        "gl_Position = projectionMatrix * mv;\n#include <fog_vertex>",
      );
    material.fragmentShader = "#include <fog_pars_fragment>\n" + material.fragmentShader;
  }
  material.fragmentShader = material.fragmentShader.replace(
    /\}\s*$/,
    "#include <tonemapping_fragment>\n#include <colorspace_fragment>\n" +
      (fog ? "#include <fog_fragment>\n" : "") +
      "}",
  );
}

/** All resources are owned by the caller's map load transaction, including
 * late asynchronous completions after a failed/cancelled preparation. */
export async function loadNativeMapEffects(
  renderer: T.WebGLRenderer,
  path: string,
  resources: MapResources,
) {
  const response = await assetFetch(path);
  if (!response.ok) throw new Error("Native map effects manifest unavailable");
  const manifest = (await response.json()) as NativeMapEffectsManifest;
  if (manifest.source?.browserWorldSpace !== true)
    throw new Error("Native map effect placement provenance unavailable");
  for (const source of Object.values(manifest.effects)) validateNativeMapEffect(source);
  const textures = new Map<string, T.Texture>();
  const [asset] = await Promise.all([
    loadGzipped(manifest.model, 1).then((asset) => {
      resources.capture(asset.scene);
      return asset;
    }),
    Promise.all(
      Object.entries(manifest.textures).map(async ([key, entry]) => {
        const texture = await new T.TextureLoader().loadAsync(assetUrl(entry.path));
        texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
        texture.flipY = false;
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        resources.texture(texture);
        textures.set(key, texture);
      }),
    ),
  ]);
  return bindNativeMapEffects(renderer, asset.scene, manifest.effects, textures, resources);
}

/** Bind already converted world-space draws; shared by the asset loader and
 * isolated GPU fixtures so depth/output tests exercise the actual runtime path. */
export function bindNativeMapEffects(
  renderer: T.WebGLRenderer,
  root: T.Object3D,
  definitions: Readonly<Record<string, NativeSkyEffectParameters>>,
  textures: Map<string, T.Texture>,
  resources: MapResources,
) {
  for (const source of Object.values(definitions)) validateNativeMapEffect(source);
  resources.capture(root);
  for (const texture of textures.values()) resources.texture(texture);
  const time = { value: 0 },
    resolution = { value: new T.Vector2(1, 1) },
    viewportOrigin = { value: new T.Vector2() },
    inverseProjection = { value: new T.Matrix4() };
  const unboundDepth = new T.DepthTexture(1, 1);
  resources.texture(unboundDepth);
  const depth = { value: unboundDepth };
  const feathered: T.Mesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material[0] : object.material;
    const effect = definitions[source.name];
    if (!effect || !(source instanceof T.MeshStandardMaterial))
      throw new Error(`Native map effect definition missing: ${source.name}`);
    const material = createNativeSkyEffect(source, effect, textures, {
      time,
      depth,
      resolution,
      inverseProjection,
      viewportOrigin,
      sourceScale: 1,
    });
    prepareNativeMapEffectOutput(material, effect.IntParams.g_bFogEnabled !== 0);
    if (effect.IntParams.F_DEPTH_FEATHER) registerSceneDepthMaterial(material);
    object.material = material;
    object.castShadow = object.receiveShadow = false;
    if (effect.IntParams.F_DEPTH_FEATHER) feathered.push(object);
  });
  resources.capture(root);
  const projection = new T.Matrix4(),
    frustum = new T.Frustum();
  return {
    root,
    textures,
    /** True only when an authored depth-feathered draw is visible. The caller
     * must finish its opaque depth prepass before rendering this group. */
    needsDepth(camera: T.Camera) {
      for (let parent: T.Object3D | null = root; parent; parent = parent.parent)
        if (!parent.visible) return false;
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      return feathered.some((mesh) => mesh.visible && frustum.intersectsObject(mesh));
    },
    setDepth(texture: T.DepthTexture, viewport: T.Vector4, depthInverseProjection: T.Matrix4) {
      depth.value = texture;
      resolution.value.set(viewport.z, viewport.w);
      viewportOrigin.value.set(viewport.x, viewport.y);
      inverseProjection.value.copy(depthInverseProjection);
    },
    update(seconds: number) {
      if (Number.isFinite(seconds)) time.value = seconds;
    },
    async prepare(camera: T.Camera) {
      await renderer.compileAsync(root, camera);
      for (const texture of textures.values()) renderer.initTexture(texture);
    },
  };
}
export type NativeMapEffects = Awaited<ReturnType<typeof loadNativeMapEffects>>;
