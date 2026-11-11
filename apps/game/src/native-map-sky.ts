import { StaticSkyClipping, infiniteSkyPanorama } from "./native-sky-clipping";
import { prepareShadersBounded, prepareTexturesBounded } from "./shader-preparation";
import { nativeMapSamplerReservation } from "./native-map-sampler-budget";
import * as T from "three";
import { loadNativeMapComplex, applyNativeMapComplex } from "./native-map-complex";
import {
  loadNativeMapLightmapped,
  applyNativeMapLightmapped,
  selectNativeLightmappedMaterial,
} from "./native-map-lightmapped";
import { loadNativeMapLegacy, applyNativeMapLegacy } from "./native-map-legacy";
import { loadNativeMapGlass, applyNativeMapGlass } from "./native-map-glass";
import { installSourceShadowDepth } from "./source-depth";
import { applyNativeMapFog, type NativeMapFog } from "./native-map-fog";
import { excludeNativeToolsMaterials } from "./native-tools-materials";
import { nativeSkyFrame, type NativeSkyPlacement } from "./native-sky-frame";
import { createEnvironmentWorldFrame } from "./native-environment-frame";
import { loadSourceReflections } from "./source-reflections";
import { prepareNativeMapReflections } from "./native-map-reflections";
import { nativeSkyPanorama, type NativeSkyPanorama } from "./native-sky-environment";
import { loadNativeMapProbes, applyNativeMapProbes } from "./native-map-probes";
import { loadNativeMapEnvironment, applyNativeMapEnvironment } from "./native-map-environment";
import { applyNativeMapLayers, loadNativeMapLayerBundle } from "./native-map-layers";
import {
  applyNativeMapParallax,
  loadNativeMapParallax,
  assertNativeParallaxSamplerBudget,
} from "./native-map-parallax";
import { applyNativeStaticOverlays, type NativeStaticOverlay } from "./native-static-overlay";
import { applySourceSelfIllumination, type SourceSelfIllumination } from "./source-self-illum";
import { assetFetch, assetUrl } from "./asset-url";
import { loadGzipped } from "./gltf";
import {
  applyNativeMapLighting,
  loadNativeMapLighting,
  type NativeMapLightingPaths,
} from "./native-map-lighting";
import { registerSourceSkyPreparation } from "./source-sky";
import { MapResources } from "./map-resources";
import { sourceSkyFrameTime } from "./source-sky-clock";
import { createNativeSkyEffect, type NativeSkyEffectParameters } from "./native-sky-clouds";
import { loadNativeCableView } from "./native-map-cables";
import { loadNativeClutterView } from "./native-clutter-view";
import { loadNativeFoliageView } from "./native-foliage-view";
import { bindNativeFoliageVisibility } from "./native-foliage-visibility";
import { assertNativeEnvironmentBudget } from "./native-environment-budget";
import { combineNativeCoverage, ownNativeCoverage } from "./native-coverage";
import { loadNativeComplexPaint } from "./native-complex-paint";

export type NativeSkyManifest = {
  model: string;
  toolsMaterials?: string[];
  panorama?: NativeSkyPanorama;
  ambient?: { skyColor: number; groundColor: number; intensity: number };
  sun?: { pitch: number; yaw: number; color: number; intensity: number };
  probes?: string;
  reflections?: { directory: string; manifest: string; volumes: number; maxGpuBytes: number };
  environmentMaterials?: string;
  layers?: string;
  parallaxMaterials?: string;
  complexMaterials?: string;
  complexSpecialMaterials?: string;
  legacyMaterials?: string;
  lightmappedMaterials?: string;
  glassMaterials?: string;
  foliageMaterials?: string;
  clutterWorld?: string;
  cablesWorld?: string;
  staticOverlays?: { name: string; staticOverlay?: NativeStaticOverlay }[];
  selfIllumination?: Record<string, SourceSelfIllumination>;
  lighting: NativeMapLightingPaths;
  effects: Record<string, NativeSkyEffectParameters>;
  textures: Record<string, { path: string; srgb: boolean }>;
  nativeTransform: NativeSkyPlacement & { noCenteringOrNormalization: boolean };
};

/** The imported wrapper already places the separate 3D sky in main-world
 * coordinates using its authored sky_camera scale and skybox_reference pose.
 * Main camera translation therefore supplies the authored parallax without
 * subtracting the origin or applying scale twice.
 */
export async function loadNativeMapSky(
  renderer: T.WebGLRenderer,
  manifestPath: string,
  gradientLoad: T.Texture | Promise<T.Texture>,
  sun: { pitch: number; yaw: number; color: number; intensity: number },
  fog?: NativeMapFog,
) {
  const resources = new MapResources();
  try {
    return await buildNativeMapSky(renderer, manifestPath, gradientLoad, sun, resources, fog);
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
async function buildNativeMapSky(
  renderer: T.WebGLRenderer,
  manifestPath: string,
  gradientLoad: T.Texture | Promise<T.Texture>,
  sun: { pitch: number; yaw: number; color: number; intensity: number },
  resources: MapResources,
  fog?: NativeMapFog,
) {
  const response = await assetFetch(manifestPath);
  if (!response.ok) throw new Error("Native 3D sky manifest unavailable");
  const manifest = (await response.json()) as NativeSkyManifest;
  if (
    !(manifest.nativeTransform.skyCamera.scale > 0) ||
    !manifest.nativeTransform.noCenteringOrNormalization
  )
    throw new Error("Native sky camera placement provenance is missing");
  const panoramaConfig = nativeSkyPanorama(manifest.panorama);
  const frame = nativeSkyFrame(manifest.nativeTransform);
  const [
    asset,
    lighting,
    gradient,
    probes,
    environment,
    layers,
    parallax,
    reflections,
    complex,
    legacy,
    glass,
    foliage,
    specialComplex,
    cableAsset,
    lightmapped,
  ] = await Promise.all([
    loadGzipped(manifest.model, 1).then((asset) => {
      resources.capture(asset.scene);
      resources.onDispose(() => resources.capture(asset.scene));
      return asset;
    }),
    loadNativeMapLighting(manifest.lighting, renderer).then((lighting) => {
      for (const texture of Object.values(lighting)) resources.texture(texture);
      return lighting;
    }),
    gradientLoad,
    manifest.probes
      ? loadNativeMapProbes(renderer, manifest.probes).then((probes) => {
          for (const texture of probes?.textures ?? []) resources.texture(texture);
          return probes;
        })
      : undefined,
    manifest.environmentMaterials
      ? loadNativeMapEnvironment(renderer, manifest.environmentMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.layers
      ? loadNativeMapLayerBundle(renderer, manifest.layers).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.parallaxMaterials
      ? loadNativeMapParallax(renderer, manifest.parallaxMaterials).then((bundle) => {
          for (const texture of [...bundle.textures.values(), ...bundle.cubes.values()])
            resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.reflections
      ? loadSourceReflections(renderer, true, manifest.reflections).then((bundle) => {
          for (const texture of bundle?.textures ?? []) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.complexMaterials
      ? loadNativeMapComplex(renderer, manifest.complexMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.legacyMaterials
      ? loadNativeMapLegacy(renderer, manifest.legacyMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.glassMaterials
      ? loadNativeMapGlass(renderer, manifest.glassMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.foliageMaterials
      ? loadNativeFoliageView(renderer, manifest.foliageMaterials, resources, "sky")
      : undefined,
    manifest.complexSpecialMaterials
      ? loadNativeMapComplex(renderer, manifest.complexSpecialMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    manifest.cablesWorld
      ? loadGzipped(manifest.cablesWorld, 1).then((asset) => {
          resources.capture(asset.scene);
          resources.onDispose(() => resources.capture(asset.scene));
          return asset;
        })
      : undefined,
    manifest.lightmappedMaterials
      ? loadNativeMapLightmapped(renderer, manifest.lightmappedMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          resources.external(bundle.lookup);
          return bundle;
        })
      : undefined,
  ]);
  const originals: T.Object3D[] = [];
  asset.scene.traverse((object) => originals.push(object));
  const complexPaint = await loadNativeComplexPaint(specialComplex, resources);
  if (complexPaint) {
    bindNativeFoliageVisibility(originals, complexPaint.root, {
      originalMainMaterialIndices: complexPaint.originalMainMaterialIndices,
    });
    asset.scene.add(complexPaint.root);
  }
  if (foliage) {
    asset.scene.add(foliage.root);
    bindNativeFoliageVisibility(originals, foliage.root, {
      originalMainMaterialIndices: foliage.source.originalMainMaterialIndices ?? [],
      visibilityLinks: foliage.source.visibilityLinks,
    });
  }
  const nativeClutter = manifest.clutterWorld
    ? await loadNativeClutterView(
        renderer,
        manifest.clutterWorld,
        resources,
        reflections,
        frame.worldFromSkyBrowser,
      )
    : undefined;
  if (nativeClutter) asset.scene.add(nativeClutter.root);
  const nativeCables = cableAsset ? await loadNativeCableView(cableAsset.scene) : undefined;
  if (nativeCables) {
    resources.external(nativeCables.lookup);
    resources.onDispose(() => nativeCables.dispose());
    resources.capture(cableAsset!.scene);
    asset.scene.add(cableAsset!.scene);
  }
  // The caller also uses the gradient for the world environment and owns it.
  resources.external(gradient);
  const textures = new Map<string, T.Texture>();
  await Promise.all(
    Object.entries(manifest.textures).map(async ([resource, entry]) => {
      const texture = await new T.TextureLoader().loadAsync(assetUrl(entry.path));
      texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      resources.texture(texture);
      textures.set(resource, texture);
    }),
  );
  const scene = new T.Scene(),
    overlay = new T.Scene();
  const skyCamera = new T.PerspectiveCamera();
  scene.add(asset.scene);
  excludeNativeToolsMaterials(asset.scene, manifest.toolsMaterials ?? []);
  const emissive = new Set<T.Material>();
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const source = manifest.selfIllumination?.[material.name];
      if (
        source &&
        !parallax?.materials[material.name] &&
        material instanceof T.MeshStandardMaterial &&
        !(lightmapped && selectNativeLightmappedMaterial(material, lightmapped.materials)) &&
        !emissive.has(material)
      ) {
        applySourceSelfIllumination(material, source);
        emissive.add(material);
      }
    }
  });
  if (layers) applyNativeMapLayers(asset.scene, layers);
  if (manifest.staticOverlays) applyNativeStaticOverlays(asset.scene, manifest.staticOverlays);
  const complexPasses = [];
  if (complex) complexPasses.push(applyNativeMapComplex(asset.scene, complex));
  if (specialComplex) complexPasses.push(applyNativeMapComplex(asset.scene, specialComplex));
  const nativeCoverage = combineNativeCoverage([
    foliage,
    nativeClutter,
    complexPasses.length ? ownNativeCoverage(renderer, resources, complexPasses) : undefined,
  ]);
  if (legacy) applyNativeMapLegacy(asset.scene, legacy);
  if (lightmapped) {
    try {
      applyNativeMapLightmapped(asset.scene, lightmapped);
    } finally {
      for (const texture of lightmapped.textures.values()) resources.texture(texture);
    }
  }
  if (glass) applyNativeMapGlass(asset.scene, glass, { fog });
  if (environment) {
    environment.sourceWorldFrame = createEnvironmentWorldFrame(frame.skyBrowserFromWorld);
    assertNativeEnvironmentBudget(renderer, environment, {
      reflections,
      probes,
      fog,
      lightingSamplers: lighting.directional ? 3 : 2,
    });
    applyNativeMapEnvironment(asset.scene, environment);
  }
  // Sky geometry has no LUT/shadow receivers; reserve one LUT slot for the
  // separate final grade pass as a conservative documented upper bound.
  const nativeParallaxSamplerBudget = parallax
    ? (() => {
        const reservation = nativeMapSamplerReservation({
          lighting: lighting,
          probes: probes,
          reflections: reflections,
          fog: fog,
          stockEnvironmentFallback: false,
          grade: "reserved",
          sourceSunShadows: 0,
        });
        return {
          reservation,
          materials: assertNativeParallaxSamplerBudget(renderer, parallax, reservation.samplers),
        };
      })()
    : undefined;
  if (parallax) applyNativeMapParallax(asset.scene, parallax);
  applyNativeMapLighting(asset.scene, lighting, frame.scale);
  if (probes) applyNativeMapProbes(asset.scene, probes);
  if (reflections)
    await prepareNativeMapReflections(asset.scene, reflections, [], [], {
      worldToNative: frame.skyBrowserFromWorld,
      instances: nativeClutter?.instances,
    });
  resources.capture(asset.scene);
  const bounds = new T.Box3();
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh) || object.userData.nativeToolsMaterial) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox)
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (bounds.isEmpty() || !Number.isFinite(bounds.min.length() + bounds.max.length()))
    throw new Error("Native sky geometry has invalid bounds");
  const center = bounds.getCenter(new T.Vector3());
  const radius = bounds.getSize(new T.Vector3()).length() / 2;
  const target = new T.WebGLRenderTarget(1, 1, {
    type: renderer.extensions.has("EXT_color_buffer_float") ? T.HalfFloatType : T.UnsignedByteType,
    depthBuffer: true,
  });
  target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
  resources.target(target);
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  target.texture.generateMipmaps = false;
  target.texture.minFilter = target.texture.magFilter = T.LinearFilter;
  // Effects feather against the opaque SKY depth, never the playable map's
  // depth. Copy it so the effect pass does not sample its own depth attachment.
  const depthCopy = new T.WebGLRenderTarget(1, 1, {
    format: T.RedFormat,
    type: T.UnsignedByteType,
    depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
  });
  resources.target(depthCopy);
  const time = { value: 0 },
    resolution = { value: new T.Vector2(1, 1) };
  const effectUniforms = {
    time,
    depth: { value: depthCopy.depthTexture! },
    resolution,
    inverseProjection: { value: skyCamera.projectionMatrixInverse },
    sourceScale: manifest.nativeTransform.skyCamera.scale,
  };
  const effectMeshes: T.Mesh[] = [];
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = object.receiveShadow = false;
    object.frustumCulled = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.toneMapped = false;
    const source = Array.isArray(object.material) ? object.material[0] : object.material;
    const effect = manifest.effects[source.name];
    if (effect && source instanceof T.MeshStandardMaterial) {
      object.material = createNativeSkyEffect(source, effect, textures, effectUniforms);
      effectMeshes.push(object);
    }
  });
  // The imported wrapper already places sky geometry in main-world space.
  // Include converted HDR cloud/glow materials, before moving them to overlay.
  if (fog) applyNativeMapFog(asset.scene, fog);
  // Preserve displaced shadow materials before replacing them with variants
  // bound to the final atlas/probe/reflection material clones.
  resources.capture(asset.scene);
  asset.scene.traverse((object) => {
    if (object instanceof T.Mesh) installSourceShadowDepth(object);
  });
  scene.updateMatrixWorld(true);
  for (const mesh of effectMeshes) overlay.attach(mesh);
  const authoredAmbient = manifest.ambient;
  const ambient = new T.HemisphereLight(
    authoredAmbient?.skyColor ?? 0x82cdff,
    authoredAmbient?.groundColor ?? 0x8f887c,
    authoredAmbient?.intensity ?? 1.5,
  );
  sun = manifest.sun ?? sun;
  const light = new T.DirectionalLight(sun.color, sun.intensity);
  const pitch = T.MathUtils.degToRad(sun.pitch),
    yaw = T.MathUtils.degToRad(sun.yaw);
  light.position.set(
    -Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  );
  scene.add(ambient, light, light.target);
  const panorama = new T.Mesh(
    new T.SphereGeometry(1, 32, 16),
    new T.MeshBasicMaterial({
      map: gradient,
      color: panoramaConfig.color,
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  infiniteSkyPanorama(panorama.material);
  panorama.quaternion.setFromRotationMatrix(panoramaConfig.rotation);
  panorama.renderOrder = -1000;
  panorama.frustumCulled = false;
  scene.add(panorama);
  // Only the imported hierarchy is immutable. Its cloud/glow meshes have now
  // been reparented into overlay; finish those world transforms before freezing.
  // Appended foliage, clutter and cables retain their own update policy, while
  // the panorama still follows the camera and effect uniforms continue to tick.
  scene.updateMatrixWorld(true);
  overlay.updateMatrixWorld(true);
  for (const object of originals) {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  }
  const cableResolution = new T.Vector2();
  const viewport = new T.Vector4(),
    logicalViewport = new T.Vector4();
  const position = new T.Vector3(),
    quaternion = new T.Quaternion(),
    scale = new T.Vector3();
  const lastWorld = new T.Matrix4(),
    lastProjection = new T.Matrix4();
  let lastBucket = -1,
    lastWidth = 0,
    lastHeight = 0,
    lastCableHeight = 0;
  const clipping =
    !foliage && !nativeClutter && !nativeCables
      ? new StaticSkyClipping([asset.scene, overlay])
      : undefined;
  let disposed = false;
  function update(camera: T.Camera) {
    if (disposed) return;
    renderer.getDrawingBufferSize(cableResolution);
    renderer.getCurrentViewport(viewport);
    const ratio = Math.min(1, Math.sqrt(2_097_152 / (viewport.z * viewport.w)));
    const width = Math.max(1, Math.round(viewport.z * ratio)),
      height = Math.max(1, Math.round(viewport.w * ratio));
    const now = sourceSkyFrameTime(),
      bucket = Math.floor(now * 30);
    const sameProjection = camera.projectionMatrix.elements.every(
      (value, index) => index === 10 || index === 14 || value === lastProjection.elements[index],
    );
    if (
      bucket === lastBucket &&
      width === lastWidth &&
      height === lastHeight &&
      cableResolution.y === lastCableHeight &&
      lastWorld.equals(camera.matrixWorld) &&
      sameProjection
    )
      return;
    if (width !== lastWidth || height !== lastHeight) {
      target.setSize(width, height);
      depthCopy.setSize(width, height);
      renderer.initRenderTarget(depthCopy);
      resolution.value.set(width, height);
    }
    lastBucket = bucket;
    lastWidth = width;
    lastHeight = height;
    lastCableHeight = cableResolution.y;
    lastWorld.copy(camera.matrixWorld);
    lastProjection.copy(camera.projectionMatrix);
    camera.matrixWorld.decompose(position, quaternion, scale);
    skyCamera.position.copy(position);
    skyCamera.quaternion.copy(quaternion);
    skyCamera.projectionMatrix.copy(camera.projectionMatrix);
    // Derive clipping from the full authored sky bounds, rather than truncating
    // native skyline geometry at the gameplay camera's far plane.
    const far = Math.max(1, radius + position.distanceTo(center)) * 2;
    const near = Math.min(far * 0.25, clipping?.near(camera) ?? 0.01);
    skyCamera.near = near;
    skyCamera.far = far;
    skyCamera.projectionMatrix.elements[10] = -(far + near) / (far - near);
    skyCamera.projectionMatrix.elements[14] = (-2 * far * near) / (far - near);
    skyCamera.projectionMatrixInverse.copy(skyCamera.projectionMatrix).invert();
    skyCamera.updateMatrixWorld(true);
    nativeCables?.update(skyCamera, cableResolution.y);
    panorama.position.copy(position);
    time.value = now;
    environment?.update(now);
    nativeCoverage?.update(now);
    const destination = renderer.getRenderTarget(),
      autoClear = renderer.autoClear,
      toneMapping = renderer.toneMapping,
      autoReset = renderer.info.autoReset;
    renderer.getViewport(logicalViewport);
    try {
      renderer.toneMapping = T.NoToneMapping;
      renderer.info.autoReset = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      if (nativeCoverage) {
        renderer.clear();
        nativeCoverage.renderDepth(skyCamera);
        renderer.autoClear = false;
      }
      renderer.render(scene, skyCamera);
      renderer.copyTextureToTexture(target.depthTexture!, depthCopy.depthTexture!);
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      renderer.render(overlay, skyCamera);
    } finally {
      renderer.setRenderTarget(destination);
      renderer.setViewport(logicalViewport);
      renderer.autoClear = autoClear;
      renderer.toneMapping = toneMapping;
      renderer.info.autoReset = autoReset;
    }
  }
  const material = new T.ShaderMaterial({
    uniforms: { skyFrame: { value: target.texture } },
    vertexShader:
      "varying vec2 skyUv; void main(){skyUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}",
    fragmentShader:
      "uniform sampler2D skyFrame; varying vec2 skyUv; void main(){gl_FragColor=texture2D(skyFrame,skyUv);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: true,
  });
  const background = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  background.name = "Native 3D sky and clouds";
  background.frustumCulled = false;
  background.renderOrder = -1000;
  background.castShadow = background.receiveShadow = false;
  background.onBeforeRender = (_renderer, _scene, camera) => update(camera);
  resources.capture(scene);
  resources.capture(overlay);
  resources.capture(background);
  registerSourceSkyPreparation(background, async (signal) => {
    if (disposed) return;
    const scope = (work: () => void) => {
      const destination = renderer.getRenderTarget(),
        tone = renderer.toneMapping;
      try {
        renderer.setRenderTarget(target);
        renderer.toneMapping = T.NoToneMapping;
        work();
      } finally {
        renderer.setRenderTarget(destination);
        renderer.toneMapping = tone;
      }
    };
    await prepareShadersBounded(renderer, [scene], skyCamera, scene, { signal, scope });
    await prepareShadersBounded(renderer, [overlay], skyCamera, overlay, { signal, scope });
    let foliage: Promise<unknown> | undefined;
    scope(() => {
      foliage = nativeCoverage?.prepare(skyCamera);
    });
    await foliage;
    if (disposed) return;
    await prepareTexturesBounded(
      renderer,
      [
        gradient,
        lighting.irradiance,
        lighting.shadows,
        lighting.directional,
        ...textures.values(),
        ...(probes?.textures ?? []),
        ...(reflections?.textures ?? []),
        ...(environment?.warmTextures ?? []),
        ...(complex?.textures.values() ?? []),
        ...(specialComplex?.textures.values() ?? []),
        ...(legacy?.textures.values() ?? []),
        ...(glass?.textures.values() ?? []),
        ...(layers?.textures.values() ?? []),
        ...(parallax?.textures.values() ?? []),
        ...(parallax?.cubes.values() ?? []),
      ].filter((texture): texture is T.Texture => !!texture),
      signal,
    );
  });
  return {
    background,
    scene,
    overlay,
    target,
    manifest,
    nativeParallaxSamplerBudget,
    skyCamera,
    releaseGpuTextures: () => resources.releaseGpuTextures(renderer),
    dispose() {
      if (disposed) return;
      disposed = true;
      background.removeFromParent();
      resources.dispose();
      scene.clear();
      overlay.clear();
    },
  };
}
