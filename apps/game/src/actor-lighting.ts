import * as T from "three";
import { applySourceColorCorrection } from "./map-color";
import { applySourceFog } from "./source-fog";
import { applyNativeFogShader, type NativeMapFog } from "./native-map-fog";
import { applySourceBarns } from "./source-barn";
import { sourceGpuProbes, applySourceGpuProbes, type SourceGpuProbes } from "./source-gpu-probes";
import { sampleSourceProbe } from "./source-lighting";
import { sourceSunCaster, applySourceSunShadows } from "./source-sun";
import {
  applySourceReflections,
  createSourceReflectionBinding,
  updateSourceReflectionBinding,
  type SourceReflections,
  type SourceReflectionBinding,
} from "./source-reflections";

type Position = { x: number; y: number; z: number };
export type ProbeSampler = (position: Position, normal: Position, out: T.Color) => boolean;
const axes = [
  new T.Vector3(1, 0, 0),
  new T.Vector3(-1, 0, 0),
  new T.Vector3(0, 1, 0),
  new T.Vector3(0, -1, 0),
  new T.Vector3(0, 0, 1),
  new T.Vector3(0, 0, -1),
];
type State = {
  enabled: { value: number };
  worldEnabled: { value: number };
  dustEnabled: { value: number };
  gpuEnabled: { value: number };
  gpuAvailable: boolean;
  gpuProbes?: SourceGpuProbes | null;
  nativeReflections?: SourceReflections;
  nativeFog?: NativeMapFog;
  reflectionBinding?: SourceReflectionBinding;
  reflectionTimer: number;
  reflectionPosition: T.Vector3;
  reflectionBounds: T.Box3;
  meshes: Set<T.Mesh>;
  bones: Set<T.Bone>;
  cube: { value: T.Color[] };
  target: T.Color[];
  rotation: { value: T.Matrix3 };
  sun: { value: number };
  targetSun: number;
  localShadows: { value: T.Vector2 };
  targetLocalShadows: T.Vector2;
  origin: { value: T.Vector3 };
  localFrame: { value: number };
  timer: number;
  ready: boolean;
  position: T.Vector3;
  materials: Map<T.Material, T.MeshStandardMaterial>;
  patched: Set<T.Material>;
  owned: Set<T.Material>;
  reflectionDirty: boolean;
  reflectionTexture?: T.Texture | null;
  reflections: Map<
    T.MeshStandardMaterial,
    { map: T.Texture | null; intensity: number; rotation: T.Euler }
  >;
};
const actors = new WeakMap<T.Object3D, State>();
const probeKeys = new WeakMap<SourceGpuProbes, number>();
const reflectionKeys = new WeakMap<SourceReflections, number>();
const fogKeys = new WeakMap<NativeMapFog, number>();
let nextProbeKey = 1;
function probeKey(probes: SourceGpuProbes | null | undefined) {
  if (probes === undefined) return "dust";
  if (probes === null) return "none";
  let key = probeKeys.get(probes);
  if (key === undefined) {
    key = nextProbeKey++;
    probeKeys.set(probes, key);
  }
  return `${key}:${probes.count}:${probes.depth}`;
}
function reflectionKey(data: SourceReflections | undefined) {
  if (!data) return "pmrem";
  let key = reflectionKeys.get(data);
  if (key === undefined) {
    key = nextProbeKey++;
    reflectionKeys.set(data, key);
  }
  return `native:${key}`;
}
function fogKey(fog: NativeMapFog | undefined) {
  if (!fog) return "none";
  let key = fogKeys.get(fog);
  if (key === undefined) {
    key = nextProbeKey++;
    fogKeys.set(fog, key);
  }
  return key;
}
const patches = new WeakMap<
  T.Material,
  {
    lighting: State;
    compile: T.Material["onBeforeCompile"];
    key: string;
  }
>();
function lightingRoot(root: T.Object3D) {
  let candidate: T.Object3D | null = root;
  while (candidate) {
    if (actors.has(candidate)) return candidate;
    candidate = candidate.parent;
  }
  return root;
}
export function releaseActorLightingMaterials(root: T.Object3D, removed: T.Object3D) {
  const state = actors.get(lightingRoot(root));
  if (!state) return;
  state.reflectionDirty = true;
  const materials = new Set<T.Material>();
  removed.traverse((object) => {
    if (object instanceof T.Mesh) state.meshes.delete(object);
    if (object instanceof T.Bone) state.bones.delete(object);
    if (object instanceof T.Mesh)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
  });
  for (const material of materials) {
    state.patched.delete(material);
    state.reflections.delete(material as T.MeshStandardMaterial);
    state.owned.delete(material);
  }
  for (const [source, material] of state.materials)
    if (materials.has(source) || materials.has(material)) state.materials.delete(source);
}
function makeState(): State {
  return {
    enabled: { value: 0 },
    worldEnabled: { value: 0 },
    dustEnabled: { value: 0 },
    gpuEnabled: { value: 0 },
    gpuAvailable: false,
    reflectionTimer: 0,
    reflectionPosition: new T.Vector3(Infinity, Infinity, Infinity),
    reflectionBounds: new T.Box3(),
    meshes: new Set(),
    bones: new Set(),
    cube: { value: axes.map(() => new T.Color()) },
    target: axes.map(() => new T.Color()),
    rotation: { value: new T.Matrix3() },
    sun: { value: 1 },
    targetSun: 1,
    localShadows: { value: new T.Vector2() },
    targetLocalShadows: new T.Vector2(),
    origin: { value: new T.Vector3() },
    localFrame: { value: 0 },
    timer: 0,
    ready: false,
    position: new T.Vector3(Infinity, Infinity, Infinity),
    materials: new Map(),
    patched: new Set(),
    owned: new Set(),
    reflectionDirty: true,
    reflections: new Map(),
  };
}

// Agents share template materials. Clone only materials, retaining all geometry,
// textures and skeleton sharing. First-person models already own their materials.
export function registerActorLighting(root: T.Object3D, cloneMaterials = false) {
  const owner = lightingRoot(root);
  if (owner !== root) {
    registerActorLighting(owner, cloneMaterials);
    return;
  }
  let state = actors.get(root);
  if (!state) {
    state = makeState();
    actors.set(root, state);
  }
  const lighting = state;
  sourceSunCaster(root, true);
  const patch = (source: T.Material) => {
    if (!(source instanceof T.MeshStandardMaterial) || lighting.patched.has(source)) return source;
    const prior = patches.get(source);
    let material = source;
    if (cloneMaterials || (prior && prior.lighting !== lighting)) {
      const existing = lighting.materials.get(source);
      if (existing) return existing;
      material = source.clone();
      lighting.materials.set(source, material);
      lighting.owned.add(material);
    }
    lighting.patched.add(material);
    lighting.reflectionDirty = true;
    lighting.reflections.set(material, {
      map: material.envMap,
      intensity: material.envMapIntensity,
      rotation: material.envMapRotation.clone(),
    });
    if (lighting.nativeReflections) {
      material.envMap = null;
      material.envMapIntensity = 0;
    }
    // oxlint-disable-next-line typescript/unbound-method -- Called with the owning material via .call below.
    const previous = prior?.compile ?? material.onBeforeCompile;
    const key = prior?.key ?? material.customProgramCacheKey();
    patches.set(material, { lighting, compile: previous, key });
    material.onBeforeCompile = function (shader, renderer) {
      previous.call(material, shader, renderer);
      const gpuProbes =
        lighting.gpuProbes === undefined
          ? sourceGpuProbes(renderer)
          : (lighting.gpuProbes ?? undefined);
      lighting.gpuAvailable = !!gpuProbes;
      Object.assign(shader.uniforms, {
        sourceActorProbeEnabled: lighting.enabled,
        sourceActorGpuEnabled: lighting.gpuEnabled,
        sourceActorWorldEnabled: lighting.worldEnabled,
        sourceActorDustEnabled: lighting.dustEnabled,
        sourceActorProbeCube: lighting.cube,
        sourceActorProbeRotation: lighting.rotation,
        sourceActorProbeSun: lighting.sun,
        sourceActorLocalShadows: lighting.localShadows,
        sourceActorProbeOrigin: lighting.origin,
        sourceActorLocalFrame: lighting.localFrame,
      });
      shader.fragmentShader =
        `
        uniform float sourceActorProbeEnabled;
        uniform float sourceActorGpuEnabled;
        uniform float sourceActorWorldEnabled;
        uniform float sourceActorDustEnabled;
        uniform vec3 sourceActorProbeCube[6];
        uniform mat3 sourceActorProbeRotation;
        uniform float sourceActorProbeSun;
        uniform vec2 sourceActorLocalShadows;
        uniform vec3 sourceActorProbeOrigin;
        uniform float sourceActorLocalFrame;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        vec3 sourceActorIrradiance(vec3 normal) {
          vec3 n = normalize(sourceActorProbeRotation * inverseTransformDirection(normal, viewMatrix));
          vec3 weight = n * n;
          return weight.x * (n.x >= 0.0 ? sourceActorProbeCube[0] : sourceActorProbeCube[1])
               + weight.y * (n.y >= 0.0 ? sourceActorProbeCube[2] : sourceActorProbeCube[3])
               + weight.z * (n.z >= 0.0 ? sourceActorProbeCube[4] : sourceActorProbeCube[5]);
        }
      `,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <envmap_physical_pars_fragment>",
        T.ShaderChunk.envmap_physical_pars_fragment.replaceAll(
          "envMapRotation * reflectVec",
          "envMapRotation * mix(reflectVec, sourceActorProbeRotation * reflectVec, sourceActorWorldEnabled)",
        ),
      );
      // Baked sun visibility gates directional light; stationary local lights
      // use their own G/B masks and world/viewmodel coordinate frames below.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        (gpuProbes
          ? `SourceGpuProbe sourceActorFragmentProbe;
sourceActorFragmentProbe.irradiance=vec3(0.0);sourceActorFragmentProbe.occlusion=vec4(0.0);
if(sourceActorGpuEnabled>0.5){
vec3 sourceActorRelative=transpose(mat3(viewMatrix))*(-vViewPosition);
vec3 sourceActorWorld=mix(cameraPosition+sourceActorRelative,sourceActorProbeOrigin+sourceActorProbeRotation*sourceActorRelative,sourceActorLocalFrame);
sourceActorFragmentProbe=sourceGpuSample(sourceActorWorld,sourceActorProbeRotation*inverseTransformDirection(normal,viewMatrix));
}
`
          : "") +
          T.ShaderChunk.lights_fragment_begin.replace(
            "getDirectionalLightInfo( directionalLight, directLight );",
            `getDirectionalLightInfo( directionalLight, directLight );\n directLight.color *= mix(1.0, ${gpuProbes ? "mix(sourceActorProbeSun,1.0-sourceActorFragmentProbe.occlusion.r,sourceActorGpuEnabled)" : "sourceActorProbeSun"}, sourceActorProbeEnabled);`,
          ),
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_maps>",
        `#include <lights_fragment_maps>
        #if defined(RE_IndirectDiffuse)
          if (sourceActorProbeEnabled > 0.5) {
            irradiance = ${gpuProbes ? "mix(sourceActorIrradiance(geometryNormal),sourceActorFragmentProbe.irradiance*PI,sourceActorGpuEnabled)" : "sourceActorIrradiance(geometryNormal)"};
            iblIrradiance = vec3(0.0);
          }
        #endif`,
      );
      applySourceBarns(shader, {
        enabled: "sourceActorDustEnabled",
        shadows: gpuProbes
          ? "mix(sourceActorLocalShadows,sourceActorFragmentProbe.occlusion.gb,sourceActorGpuEnabled)"
          : "sourceActorLocalShadows",
        worldPosition:
          "mix(cameraPosition + sourceBarnWorldRelative, sourceActorProbeOrigin + sourceActorProbeRotation*sourceBarnWorldRelative, sourceActorLocalFrame)",
        worldToLighting: "transpose(sourceActorProbeRotation)",
      });
      applySourceFog(shader, "sourceActorDustEnabled");
      if (lighting.nativeFog) applyNativeFogShader(shader, lighting.nativeFog);
      applySourceColorCorrection(shader, "sourceActorWorldEnabled", true);
      if (gpuProbes) applySourceGpuProbes(shader, gpuProbes);
      if (lighting.reflectionBinding)
        applySourceReflections(
          shader,
          lighting.reflectionBinding,
          Array.from(lighting.reflectionBinding.candidates),
          {
            count: lighting.reflectionBinding.count,
            worldPosition:
              "mix(cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition),sourceActorProbeOrigin+sourceActorProbeRotation*transpose(mat3(viewMatrix))*(-vViewPosition),sourceActorLocalFrame)",
            worldNormal:
              "sourceActorProbeRotation*inverseTransformDirection(geometryNormal,viewMatrix)",
            worldView:
              "sourceActorProbeRotation*inverseTransformDirection(geometryViewDir,viewMatrix)",
          },
        );
      applySourceSunShadows(shader);
    };
    material.customProgramCacheKey = () =>
      `${key}:source-actor-probe-v7:${probeKey(lighting.gpuProbes)}:${reflectionKey(lighting.nativeReflections)}:fog${fogKey(lighting.nativeFog)}`;
    material.needsUpdate = true;
    return material;
  };
  root.traverse((object) => {
    if (object instanceof T.Bone) lighting.bones.add(object);
    if (!(object instanceof T.Mesh)) return;
    lighting.meshes.add(object);
    object.material = Array.isArray(object.material)
      ? object.material.map(patch)
      : patch(object.material);
  });
  lighting.reflectionTimer = 0;
}

const reflectionSphere = new T.Sphere();
const reflectionBox = new T.Box3();
const reflectionFrame = new T.Matrix4();
const reflectionPoint = new T.Vector3();
function visibleChild(object: T.Object3D, root: T.Object3D) {
  for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible) return false;
    if (parent === root) return true;
  }
  return false;
}
function updateReflectionBounds(root: T.Object3D, state: State, position: Position, dt: number) {
  if (!state.reflectionBinding) return;
  state.reflectionTimer -= dt;
  const teleported = state.reflectionPosition.distanceToSquared(position) > 16;
  if (state.reflectionTimer > 0 && !teleported) return;
  state.reflectionTimer = 1 / 16;
  state.reflectionPosition.set(position.x, position.y, position.z);
  // Refresh cheap object transforms and cached mesh bounds, never walk skinned
  // vertex buffers. Padding covers animation/movement between these 16 Hz
  // candidate updates; the native per-fragment box fade/projection stays live.
  root.updateWorldMatrix(true, true);
  const bounds = state.reflectionBounds.makeEmpty();
  for (const mesh of state.meshes) {
    if (!visibleChild(mesh, root)) continue;
    if (mesh instanceof T.SkinnedMesh) {
      if (!mesh.boundingSphere) mesh.computeBoundingSphere();
      reflectionSphere.copy(mesh.boundingSphere!);
    } else {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      reflectionSphere.copy(mesh.geometry.boundingSphere!);
    }
    reflectionSphere.applyMatrix4(mesh.matrixWorld).getBoundingBox(reflectionBox);
    bounds.union(reflectionBox);
  }
  for (const bone of state.bones)
    if (visibleChild(bone, root))
      bounds.expandByPoint(reflectionPoint.setFromMatrixPosition(bone.matrixWorld));
  if (state.localFrame.value && !bounds.isEmpty()) {
    reflectionFrame.setFromMatrix3(state.rotation.value).setPosition(state.origin.value);
    bounds.applyMatrix4(reflectionFrame);
  }
  bounds.expandByPoint(state.origin.value).expandByScalar(1);
  updateSourceReflectionBinding(state.reflectionBinding, bounds);
}

export function updateActorLighting(
  root: T.Object3D,
  position: Position,
  sample: ProbeSampler | undefined,
  dt: number,
  rotation?: T.Matrix3,
  sampleSun?: (position: Position) => number,
  sampleLocalShadows?: (position: Position, out: T.Vector2) => void,
  gpuProbes?: SourceGpuProbes | null,
  nativeReflections?: SourceReflections,
  nativeFog?: NativeMapFog,
) {
  const state = actors.get(root);
  if (!state) return;
  if (state.nativeFog !== nativeFog) {
    state.nativeFog = nativeFog;
    for (const material of state.patched) material.needsUpdate = true;
  }
  // Undefined retains Dust II's renderer-owned cache; a map-owned object binds
  // its own arrays. Explicit null must not silently pick up Dust II's atlas on
  // devices that cannot support the other map's LPV shader.
  if (state.gpuProbes !== gpuProbes) {
    state.gpuProbes = gpuProbes;
    state.gpuAvailable = false;
    state.ready = false;
    state.timer = 0;
    for (const material of state.patched) material.needsUpdate = true;
  }
  if (state.nativeReflections !== nativeReflections) {
    state.nativeReflections = nativeReflections;
    state.reflectionDirty = true;
    state.reflectionBinding = nativeReflections
      ? createSourceReflectionBinding(nativeReflections)
      : undefined;
    state.reflectionTimer = 0;
    for (const material of state.patched) material.needsUpdate = true;
    setActorReflection(root, nativeReflections ? null : undefined);
  }
  state.dustEnabled.value = gpuProbes === undefined && sample ? 1 : 0;
  state.rotation.value.copy(rotation ?? identity);
  state.localFrame.value = rotation ? 1 : 0;
  state.origin.value.set(position.x, position.y, position.z);
  updateReflectionBounds(root, state, position, dt);
  if (gpuProbes) {
    state.gpuEnabled.value = 1;
    state.enabled.value = 1;
    state.worldEnabled.value = 1;
    state.ready = true;
    return;
  }
  if (!sample) {
    state.gpuEnabled.value = 0;
    state.enabled.value = 0;
    state.worldEnabled.value = 0;
    state.ready = false;
    state.timer = 0;
    return;
  }
  state.worldEnabled.value = 1;
  state.gpuEnabled.value =
    gpuProbes !== null && state.gpuAvailable && sample === sampleSourceProbe ? 1 : 0;
  if (state.gpuEnabled.value) {
    state.enabled.value = 1;
    state.ready = true;
    return;
  }
  state.timer -= dt;
  const teleported = state.position.distanceToSquared(position) > 16;
  if (state.timer <= 0 || teleported) {
    state.timer = 0.1;
    state.position.copy(position);
    let valid = true;
    axes.forEach((axis, i) => {
      valid = sample(position, axis, state.target[i]) && valid;
    });
    if (!valid) {
      state.enabled.value = 0;
      if (sampleLocalShadows) sampleLocalShadows(position, state.localShadows.value);
      else state.localShadows.value.set(0, 0);
      state.ready = false;
      return;
    }
    state.targetSun = sampleSun ? T.MathUtils.clamp(sampleSun(position), 0, 1) : 1;
    if (sampleLocalShadows) sampleLocalShadows(position, state.targetLocalShadows);
    else state.targetLocalShadows.set(0, 0);
    if (!state.ready || teleported) {
      state.target.forEach((color, i) => state.cube.value[i].copy(color));
      state.sun.value = state.targetSun;
      state.localShadows.value.copy(state.targetLocalShadows);
    }
    state.ready = true;
    state.enabled.value = 1;
  }
  const alpha = 1 - Math.exp(-Math.max(0, dt) * 12);
  state.target.forEach((color, i) => state.cube.value[i].lerp(color, alpha));
  state.sun.value = T.MathUtils.lerp(state.sun.value, state.targetSun, alpha);
  state.localShadows.value.lerp(state.targetLocalShadows, alpha);
}
const identity = new T.Matrix3();
export function disposeActorLighting(root: T.Object3D) {
  const state = actors.get(root);
  if (!state) return;
  state.owned.forEach((material) => material.dispose());
  state.materials.clear();
  state.patched.clear();
  state.owned.clear();
  state.meshes.clear();
  state.bones.clear();
  actors.delete(root);
}

export function setActorReflection(root: T.Object3D, texture?: T.Texture | null) {
  const state = actors.get(root);
  if (!state) return;
  if (state.nativeReflections) texture = null;
  // Reflection requests run every frame, while PMREMs and registered materials
  // usually persist. Registration/removal and native-mode changes invalidate
  // this cache so asynchronously attached cosmetics still receive the binding.
  if (!state.reflectionDirty && state.reflectionTexture === texture) return;
  state.reflectionDirty = false;
  state.reflectionTexture = texture;
  for (const [material, original] of state.reflections) {
    const next = texture === undefined ? original.map : texture;
    if (material.envMap !== next) {
      // Same-format PMREM swaps only change uniforms, avoiding shader rebuilds.
      if (!!material.envMap !== !!next || material.envMap?.mapping !== next?.mapping)
        material.needsUpdate = true;
      material.envMap = next;
    }
    material.envMapIntensity = texture === null ? 0 : texture ? 1 : original.intensity;
    // VRF latlongs start at +X (u=0) we can use three's equirectangular lookup puts +X at u=.5
    // the local PMREMs use the material rotation, independent of scene.environmentRotation which is sweet
    if (texture) material.envMapRotation.set(0, Math.PI, 0);
    else material.envMapRotation.copy(original.rotation);
  }
}
