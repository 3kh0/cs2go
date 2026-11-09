import * as T from "three";
import { assetFetch, assetUrl } from "./asset-url";
import { loadGzipped } from "./gltf";
import {
  applyNativeMapLighting,
  loadNativeMapLighting,
  type NativeMapLightingPaths,
} from "./native-map-lighting";
import { registerSourceSkyPreparation } from "./source-sky";
import { createNativeSkyEffect, type NativeSkyEffectParameters } from "./native-sky-clouds";

export type NativeSkyManifest = {
  model: string;
  lighting: NativeMapLightingPaths;
  effects: Record<string, NativeSkyEffectParameters>;
  textures: Record<string, { path: string; srgb: boolean }>;
  nativeTransform: {
    skyCamera: { scale: number; origin: string };
    noCenteringOrNormalization: boolean;
  };
};

/** The imported wrapper already places the separate 3D sky in main-world
 * coordinates: 16*(SourceSkyPosition-nativeCameraOrigin), followed by the
 * Source2Viewer-to-browser adapter. Main camera translation therefore supplies
 * native 1/16 parallax without subtracting the origin or applying scale twice.
 */
export async function loadNativeMapSky(
  renderer: T.WebGLRenderer,
  manifestPath: string,
  gradientLoad: T.Texture | Promise<T.Texture>,
  sun: { pitch: number; yaw: number; color: number; intensity: number },
) {
  const response = await assetFetch(manifestPath);
  if (!response.ok) throw new Error("Native 3D sky manifest unavailable");
  const manifest = (await response.json()) as NativeSkyManifest;
  if (
    !(manifest.nativeTransform.skyCamera.scale > 0) ||
    !manifest.nativeTransform.noCenteringOrNormalization
  )
    throw new Error("Native sky camera placement provenance is missing");
  const [asset, lighting, gradient] = await Promise.all([
    loadGzipped(manifest.model, 1),
    loadNativeMapLighting(manifest.lighting, renderer),
    gradientLoad,
  ]);
  const textures = new Map<string, T.Texture>();
  await Promise.all(
    Object.entries(manifest.textures).map(async ([resource, entry]) => {
      const texture = await new T.TextureLoader().loadAsync(assetUrl(entry.path));
      texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      textures.set(resource, texture);
    }),
  );
  const scene = new T.Scene(),
    overlay = new T.Scene();
  const skyCamera = new T.PerspectiveCamera();
  scene.add(asset.scene);
  applyNativeMapLighting(asset.scene, lighting);
  const bounds = new T.Box3().setFromObject(asset.scene);
  if (bounds.isEmpty() || !Number.isFinite(bounds.min.length() + bounds.max.length()))
    throw new Error("Native sky geometry has invalid bounds");
  const center = bounds.getCenter(new T.Vector3());
  const radius = bounds.getSize(new T.Vector3()).length() / 2;
  const target = new T.WebGLRenderTarget(1, 1, {
    type: renderer.extensions.has("EXT_color_buffer_float") ? T.HalfFloatType : T.UnsignedByteType,
    depthBuffer: true,
  });
  target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
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
  scene.updateMatrixWorld(true);
  for (const mesh of effectMeshes) overlay.attach(mesh);
  const ambient = new T.HemisphereLight(0x82cdff, 0x8f887c, 1.5);
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
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  panorama.rotation.y = Math.PI;
  panorama.renderOrder = -1000;
  panorama.frustumCulled = false;
  scene.add(panorama);
  const viewport = new T.Vector4(),
    logicalViewport = new T.Vector4();
  const position = new T.Vector3(),
    quaternion = new T.Quaternion(),
    scale = new T.Vector3();
  const lastWorld = new T.Matrix4(),
    lastProjection = new T.Matrix4();
  let lastBucket = -1,
    lastWidth = 0,
    lastHeight = 0;
  function update(camera: T.Camera) {
    renderer.getCurrentViewport(viewport);
    const ratio = Math.min(1, Math.sqrt(2_097_152 / (viewport.z * viewport.w)));
    const width = Math.max(1, Math.round(viewport.z * ratio)),
      height = Math.max(1, Math.round(viewport.w * ratio));
    const now = performance.now() / 1000,
      bucket = Math.floor(now * 30);
    const sameProjection = camera.projectionMatrix.elements.every(
      (value, index) => index === 10 || index === 14 || value === lastProjection.elements[index],
    );
    if (
      bucket === lastBucket &&
      width === lastWidth &&
      height === lastHeight &&
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
    lastWorld.copy(camera.matrixWorld);
    lastProjection.copy(camera.projectionMatrix);
    camera.matrixWorld.decompose(position, quaternion, scale);
    skyCamera.position.copy(position);
    skyCamera.quaternion.copy(quaternion);
    skyCamera.projectionMatrix.copy(camera.projectionMatrix);
    // Derive clipping from the full authored sky bounds, rather than truncating
    // native skyline geometry at the gameplay camera's far plane.
    const near = 0.01,
      far = Math.max(1, radius + position.distanceTo(center)) * 2;
    skyCamera.projectionMatrix.elements[10] = -(far + near) / (far - near);
    skyCamera.projectionMatrix.elements[14] = (-2 * far * near) / (far - near);
    skyCamera.projectionMatrixInverse.copy(skyCamera.projectionMatrix).invert();
    panorama.position.copy(position);
    time.value = now;
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
  background.name = "Mirage native 3D sky and clouds";
  background.frustumCulled = false;
  background.renderOrder = -1000;
  background.castShadow = background.receiveShadow = false;
  background.onBeforeRender = (_renderer, _scene, camera) => update(camera);
  registerSourceSkyPreparation(background, async () => {
    const destination = renderer.getRenderTarget(),
      toneMapping = renderer.toneMapping;
    let worldPrograms: Promise<unknown>, effectPrograms: Promise<unknown>;
    try {
      renderer.setRenderTarget(target);
      renderer.toneMapping = T.NoToneMapping;
      worldPrograms = renderer.compileAsync(scene, skyCamera);
      effectPrograms = renderer.compileAsync(overlay, skyCamera);
    } finally {
      renderer.setRenderTarget(destination);
      renderer.toneMapping = toneMapping;
    }
    await Promise.all([worldPrograms, effectPrograms]);
    for (const texture of [
      gradient,
      lighting.irradiance,
      lighting.shadows,
      lighting.directional,
      ...textures.values(),
    ])
      if (texture) renderer.initTexture(texture);
  });
  return { background, scene, overlay, target, manifest, skyCamera };
}
