import * as T from "three";
import { applySourceColorCorrection } from "./map-color";
import { applySourceFog } from "./source-fog";
import { applySourceBarns } from "./source-barn";
import { sourceGpuProbes, applySourceGpuProbes } from "./source-gpu-probes";
import { sampleSourceProbe } from "./source-lighting";
import { sourceSunCaster, applySourceSunShadows } from "./source-sun";

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
  gpuEnabled: { value: number };
  gpuAvailable: boolean;
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
  reflections: Map<
    T.MeshStandardMaterial,
    { map: T.Texture | null; intensity: number; rotation: T.Euler }
  >;
};
const actors = new WeakMap<T.Object3D, State>();
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
  const materials = new Set<T.Material>();
  removed.traverse((object) => {
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
    gpuEnabled: { value: 0 },
    gpuAvailable: false,
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
    lighting.reflections.set(material, {
      map: material.envMap,
      intensity: material.envMapIntensity,
      rotation: material.envMapRotation.clone(),
    });
    // oxlint-disable-next-line typescript/unbound-method -- Called with the owning material via .call below.
    const previous = prior?.compile ?? material.onBeforeCompile;
    const key = prior?.key ?? material.customProgramCacheKey();
    patches.set(material, { lighting, compile: previous, key });
    material.onBeforeCompile = function (shader, renderer) {
      previous.call(material, shader, renderer);
      const gpuProbes = sourceGpuProbes(renderer);
      lighting.gpuAvailable = !!gpuProbes;
      Object.assign(shader.uniforms, {
        sourceActorProbeEnabled: lighting.enabled,
        sourceActorGpuEnabled: lighting.gpuEnabled,
        sourceActorWorldEnabled: lighting.worldEnabled,
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
        enabled: "sourceActorWorldEnabled",
        shadows: gpuProbes
          ? "mix(sourceActorLocalShadows,sourceActorFragmentProbe.occlusion.gb,sourceActorGpuEnabled)"
          : "sourceActorLocalShadows",
        worldPosition:
          "mix(cameraPosition + sourceBarnWorldRelative, sourceActorProbeOrigin + sourceActorProbeRotation*sourceBarnWorldRelative, sourceActorLocalFrame)",
        worldToLighting: "transpose(sourceActorProbeRotation)",
      });
      applySourceFog(shader, "sourceActorWorldEnabled");
      applySourceColorCorrection(shader, "sourceActorWorldEnabled", true);
      if (gpuProbes) applySourceGpuProbes(shader, gpuProbes);
      applySourceSunShadows(shader);
    };
    material.customProgramCacheKey = () => `${key}:source-actor-probe-v5`;
    material.needsUpdate = true;
    return material;
  };
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(patch)
      : patch(object.material);
  });
}

export function updateActorLighting(
  root: T.Object3D,
  position: Position,
  sample: ProbeSampler | undefined,
  dt: number,
  rotation?: T.Matrix3,
  sampleSun?: (position: Position) => number,
  sampleLocalShadows?: (position: Position, out: T.Vector2) => void,
) {
  const state = actors.get(root);
  if (!state) return;
  if (!sample) {
    state.gpuEnabled.value = 0;
    state.enabled.value = 0;
    state.worldEnabled.value = 0;
    state.ready = false;
    state.timer = 0;
    return;
  }
  state.worldEnabled.value = 1;
  state.rotation.value.copy(rotation ?? identity);
  state.localFrame.value = rotation ? 1 : 0;
  state.origin.value.set(position.x, position.y, position.z);
  state.gpuEnabled.value = state.gpuAvailable && sample === sampleSourceProbe ? 1 : 0;
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
  actors.delete(root);
}

export function setActorReflection(root: T.Object3D, texture?: T.Texture) {
  const state = actors.get(root);
  if (!state) return;
  for (const [material, original] of state.reflections) {
    const next = texture ?? original.map;
    if (material.envMap !== next) {
      // Same-format PMREM swaps only change uniforms, avoiding shader rebuilds.
      if (!!material.envMap !== !!next || material.envMap?.mapping !== next?.mapping)
        material.needsUpdate = true;
      material.envMap = next;
    }
    material.envMapIntensity = texture ? 1 : original.intensity;
    // VRF latlongs start at +X (u=0) we can use three's equirectangular lookup puts +X at u=.5
    // the local PMREMs use the material rotation, independent of scene.environmentRotation which is sweet
    if (texture) material.envMapRotation.set(0, Math.PI, 0);
    else material.envMapRotation.copy(original.rotation);
  }
}
