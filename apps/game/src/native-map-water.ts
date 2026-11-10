import * as T from "three";
import { loadSourceMaterialBundle } from "./source-layers";
import { registerSurfaceTextures } from "./presentation-settings";
import {
  applyNativeWaterShader,
  nativeWaterConstants,
  nativeWaterSamplers,
  type NativeWaterMaterial,
} from "./native-water-shader";
import { registerSceneDepthMaterial, type SceneDepthConsumer } from "./smoke-renderer";
import {
  createEnvironmentTextureBanks,
  bindEnvironmentTextures,
} from "./native-environment-textures";
export async function loadNativeMapWater(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -"source.json".length) : path;
  const bundle = await loadSourceMaterialBundle<
    NativeWaterMaterial & { nativeControlValue: number[] }
  >(renderer, directory, (materials) => {
    const selected = new Set<string>();
    for (const source of Object.values(materials)) {
      nativeWaterConstants(source);
      if (
        source.nativeControlValue?.length !== 4 ||
        source.nativeControlValue.some((value) => value !== 0)
      )
        throw new Error("Native water requires verified zero paint controls");
      for (const sampler of nativeWaterSamplers) {
        const id = source.textures[sampler];
        if (!id) throw new Error(`Native water sampler missing: ${sampler}`);
        selected.add(id);
      }
    }
    return selected;
  });
  try {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const banks = createEnvironmentTextureBanks(
      bundle.textures,
      gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
    );
    return { ...bundle, banks };
  } catch (error) {
    for (const texture of new Set(bundle.textures.values())) texture.dispose();
    throw error;
  }
}
const sourceToBrowser = new T.Matrix4().set(
  0.0254,
  0,
  0,
  0,
  0,
  0,
  0.0254,
  0,
  0,
  -0.0254,
  0,
  0,
  0,
  0,
  0,
  1,
);
const flipY = new T.Matrix4().makeScale(1, -1, 1);
// WebGL view Z is negative in front of the eye. Both terms in the native
// max(waterViewZ-receiverViewZ,0) must keep that same sign.
const sourceViewScale = new T.Matrix4().makeScale(1 / 0.0254, 1 / 0.0254, 1 / 0.0254);
/** Installed native wave/material equations with qualified browser scene/lighting
 * transport. The engine's interaction/MOIT producers and live bindings are not
 * recovered. A bounded browser interaction field is supplied independently. */
export function applyNativeMapWater(
  root: T.Object3D,
  bundle: Pick<Awaited<ReturnType<typeof loadNativeMapWater>>, "materials" | "textures"> &
    Partial<Pick<Awaited<ReturnType<typeof loadNativeMapWater>>, "banks">>,
  ownTexture?: (texture: T.Texture) => void,
) {
  const white = new T.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1);
  white.needsUpdate = true;
  // Deterministic stratified noise is a declared browser replacement, not the
  // unrecovered native BlueNoise image. It preserves the shader's nonzero jitter.
  const noiseBytes = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    noiseBytes[i * 4] = (i * 73 + 19) % 256;
    noiseBytes[i * 4 + 1] = (i * 151 + 43) % 256;
    noiseBytes[i * 4 + 2] = (i * 199 + 107) % 256;
    noiseBytes[i * 4 + 3] = 255;
  }
  const noise = new T.DataTexture(noiseBytes, 8, 8);
  noise.needsUpdate = true;
  const fieldSize = 128,
    fieldHeights = new Float32Array(fieldSize * fieldSize).fill(0.5),
    fieldBytes = new Uint16Array(fieldSize * fieldSize * 4).fill(T.DataUtils.toHalfFloat(0.5));
  const field = new T.DataTexture(fieldBytes, fieldSize, fieldSize, T.RGBAFormat, T.HalfFloatType);
  field.minFilter = field.magFilter = T.LinearFilter;
  field.needsUpdate = true;
  const unboundDepth = new T.DepthTexture(1, 1);
  for (const texture of [white, noise, field, unboundDepth]) ownTexture?.(texture);
  const uniforms = {
    g_tSceneDepth: { value: unboundDepth },
    g_tRefractionMap: { value: white as T.Texture },
    g_tWaterEffectsMap: { value: field },
    g_tBlueNoise: { value: noise },
    waterTime: { value: 0 },
    waterViewport: { value: new T.Vector4(0, 0, 1, 1) },
    waterDepthCoefficients: { value: new T.Vector2() },
    waterCameraSource: { value: new T.Vector3() },
    waterUpSource: { value: new T.Vector3() },
    waterForwardSource: { value: new T.Vector3() },
    waterSunDirection: { value: new T.Vector3(0, 0, 1) },
    waterSunColor: { value: new T.Color(0xffffff) },
    waterSourceProjectionTranspose: { value: new T.Matrix4() },
    waterSourceViewTranspose: { value: new T.Matrix4() },
    waterInverseProjection: { value: new T.Matrix4() },
    waterCameraWorld: { value: new T.Matrix4() },
  };
  const exclude = new Set<T.Object3D>(),
    replacements = new Map<T.Material, T.MeshStandardMaterial>();
  const textures = [
    ...bundle.textures.values(),
    ...(bundle.banks?.arrays ?? []),
    white,
    noise,
    field,
    unboundDepth,
  ];
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const replace = (source: T.Material) => {
      const native = bundle.materials[source.name];
      if (!native) return source;
      if (!(source instanceof T.MeshStandardMaterial))
        throw new Error("Native water requires a standard lighting receiver");
      exclude.add(object);
      object.castShadow = false;
      let material = replacements.get(source);
      if (material) return material;
      material = source.clone();
      material.map =
        material.normalMap =
        material.roughnessMap =
        material.metalnessMap =
        material.aoMap =
          null;
      // Enable the existing directional-atlas tangent-normal contract without
      // sampling a second normal image. The native water normal is world XY/Z.
      material.normalMap = white;
      material.metalness = 0;
      material.roughness = 0.01;
      material.color.setRGB(1, 1, 1);
      material.vertexColors = false;
      material.userData.nativeSourceFamily = "water";
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.alphaTest = 0;
      const key = source.customProgramCacheKey(),
        previous = source.onBeforeCompile.bind(source);
      const layout = bindEnvironmentTextures(
        native,
        nativeWaterSamplers,
        bundle.textures,
        bundle.banks?.bindings,
        { uniforms: {} } as T.WebGLProgramParametersWithUniforms,
      );
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        const binding = bindEnvironmentTextures(
          native,
          nativeWaterSamplers,
          bundle.textures,
          bundle.banks?.bindings,
          shader,
        );
        applyNativeWaterShader(shader, native, binding.code);
      };
      material.customProgramCacheKey = () =>
        `${key}:native-water-quality1:${JSON.stringify(native)}:${layout.signature}`;
      registerSceneDepthMaterial(material);
      registerSurfaceTextures(material, [
        ...new Set(
          [...bundle.textures].map(
            ([id, texture]) => bundle.banks?.bindings.get(id)?.texture ?? texture,
          ),
        ),
      ]);
      replacements.set(source, material);
      material.needsUpdate = true;
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(replace)
      : replace(object.material);
  });
  const projection = new T.Matrix4(),
    frustum = new T.Frustum(),
    temporary = new T.Vector3(),
    direction = new T.Vector3();
  const impulses: { position: T.Vector3; time: number; strength: number }[] = [];
  const surfaces = [...exclude] as T.Mesh[];
  if (!surfaces.length) throw new Error("Configured native water has no matching source draws");
  root.updateMatrixWorld(true);
  const bounds = surfaces.map((mesh) => new T.Box3().setFromObject(mesh));
  const raycaster = new T.Raycaster(),
    hits: T.Intersection[] = [];
  const contactFrom = new T.Vector3(),
    contactTo = new T.Vector3();
  const actors = new Map<string, { position: T.Vector3; emitted: number; seen: number }>();
  const emit = (position: T.Vector3, seconds: number, strength = 0.02) => {
    if (impulses.length >= 16) impulses.shift();
    impulses.push({ position: position.clone(), time: seconds, strength });
  };
  const crossing = (from: T.Vector3, to: T.Vector3, seconds: number, strength = 0.02) => {
    const delta = contactTo.copy(to).sub(from),
      distance = delta.length();
    if (distance <= 1e-8) return false;
    raycaster.set(from, delta.divideScalar(distance));
    raycaster.near = 0;
    raycaster.far = distance;
    hits.length = 0;
    raycaster.intersectObjects(surfaces, false, hits);
    if (!hits.length) return false;
    emit(hits[0].point, seconds, strength);
    return true;
  };
  let camera: T.PerspectiveCamera | undefined,
    lastFieldTime = -Infinity;
  const sourceDirection = (value: T.Vector3) => value.set(value.x, -value.z, value.y);
  const consumer: SceneDepthConsumer = {
    color: {
      exclude,
      setColor(texture) {
        uniforms.g_tRefractionMap.value = texture;
      },
    },
    setDepth(texture, viewport, inverseProjection) {
      uniforms.g_tSceneDepth.value = texture;
      uniforms.waterViewport.value.copy(viewport);
      uniforms.waterInverseProjection.value.copy(inverseProjection);
    },
  };
  return {
    ...consumer,
    textures,
    exclude,
    prepareFrame(activeCamera: T.PerspectiveCamera, seconds: number, sun?: T.DirectionalLight) {
      camera = activeCamera;
      camera.updateWorldMatrix(true, false);
      uniforms.waterTime.value = seconds;
      uniforms.waterCameraSource.value
        .copy(camera.position)
        .applyMatrix4(camera.parent?.matrixWorld ?? new T.Matrix4());
      const p = uniforms.waterCameraSource.value;
      p.set(p.x, -p.z, p.y).divideScalar(0.0254);
      camera.getWorldDirection(direction);
      sourceDirection(uniforms.waterForwardSource.value.copy(direction));
      temporary.setFromMatrixColumn(camera.matrixWorld, 1);
      sourceDirection(uniforms.waterUpSource.value.copy(temporary));
      uniforms.waterCameraWorld.value.copy(camera.matrixWorld);
      uniforms.waterInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.waterDepthCoefficients.value.set(
        0.0254 / camera.near - 0.0254 / camera.far,
        -0.0254 / camera.near,
      );
      uniforms.waterSourceProjectionTranspose.value
        .copy(flipY)
        .multiply(camera.projectionMatrix)
        .multiply(camera.matrixWorldInverse)
        .multiply(sourceToBrowser)
        .transpose();
      uniforms.waterSourceViewTranspose.value
        .copy(sourceViewScale)
        .multiply(camera.matrixWorldInverse)
        .multiply(sourceToBrowser)
        .transpose();
      if (sun) {
        sun.getWorldPosition(temporary);
        sun.target.getWorldPosition(direction);
        temporary.sub(direction).normalize();
        sourceDirection(uniforms.waterSunDirection.value.copy(temporary));
        uniforms.waterSunColor.value.copy(sun.color).multiplyScalar(sun.intensity / Math.PI);
      }
      // Reconstructed, bounded interaction producer. Field x is signed height;
      // yz retain native .5 baseline until a physical impulse creates foam/silt.
      if (seconds - lastFieldTime >= 1 / 30 && impulses.length) {
        fieldHeights.fill(0.5);
        lastFieldTime = seconds;
        for (let i = impulses.length - 1; i >= 0; i--) {
          const impulse = impulses[i],
            age = seconds - impulse.time;
          if (age > 2) {
            impulses.splice(i, 1);
            continue;
          }
          temporary.copy(impulse.position).project(camera);
          const cx = (temporary.x * 0.5 + 0.5) * fieldSize,
            cy = (temporary.y * 0.5 + 0.5) * fieldSize;
          direction
            .setFromMatrixColumn(camera.matrixWorld, 0)
            .multiplyScalar(age * 1.2 + 0.04)
            .add(impulse.position)
            .project(camera);
          const radius = Math.max(
              1,
              Math.hypot(
                (direction.x * 0.5 + 0.5) * fieldSize - cx,
                (direction.y * 0.5 + 0.5) * fieldSize - cy,
              ),
            ),
            extent = radius + 4;
          const inner = Math.max(0, radius - 4) ** 2,
            outer = extent ** 2;
          for (
            let y = Math.max(0, Math.floor(cy - extent));
            y < Math.min(fieldSize, Math.ceil(cy + extent));
            y++
          )
            for (
              let x = Math.max(0, Math.floor(cx - extent));
              x < Math.min(fieldSize, Math.ceil(cx + extent));
              x++
            ) {
              const distanceSquared = (x - cx) ** 2 + (y - cy) ** 2;
              if (distanceSquared < inner || distanceSquared > outer) continue;
              const r = Math.sqrt(distanceSquared),
                wave =
                  Math.exp(-Math.abs(r - radius) * 1.5) * Math.exp(-age * 3) * impulse.strength;
              fieldHeights[y * fieldSize + x] += Math.sin((r - radius) * 2) * wave;
            }
        }
        for (let i = 0; i < fieldHeights.length; i++)
          fieldBytes[i * 4] = T.DataUtils.toHalfFloat(fieldHeights[i]);
        field.needsUpdate = true;
      }
      for (const [id, actor] of actors) if (seconds - actor.seen > 2) actors.delete(id);
    },
    impulse: emit,
    crossing,
    contact(id: string, foot: T.Vector3, seconds: number, height = 1.8288) {
      const candidate = bounds.some(
        (box) =>
          foot.x >= box.min.x &&
          foot.x <= box.max.x &&
          foot.z >= box.min.z &&
          foot.z <= box.max.z &&
          foot.y <= box.max.y &&
          foot.y + height >= box.min.y,
      );
      if (!candidate) {
        actors.delete(id);
        return false;
      }
      const actor = actors.get(id);
      if (actor) {
        actor.seen = seconds;
        if (seconds - actor.emitted < 0.16 || actor.position.distanceToSquared(foot) < 0.09)
          return false;
      }
      contactFrom.copy(foot);
      contactFrom.y += height;
      if (!crossing(contactFrom, foot, seconds, 0.025)) {
        actors.delete(id);
        return false;
      }
      if (actor) {
        actor.position.copy(foot);
        actor.emitted = seconds;
      } else {
        if (actors.size >= 32) actors.delete(actors.keys().next().value!);
        actors.set(id, { position: foot.clone(), emitted: seconds, seen: seconds });
      }
      return true;
    },
    needsDepth(activeCamera: T.Camera) {
      for (let parent: T.Object3D | null = root; parent; parent = parent.parent)
        if (!parent.visible) return false;
      projection.multiplyMatrices(activeCamera.projectionMatrix, activeCamera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      return surfaces.some((object) => object.visible && frustum.intersectsObject(object));
    },
  };
}
export type NativeMapWater = ReturnType<typeof applyNativeMapWater>;
