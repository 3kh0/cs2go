import * as T from "three";

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
  cube: { value: T.Color[] };
  target: T.Color[];
  rotation: { value: T.Matrix3 };
  sun: { value: number };
  targetSun: number;
  timer: number;
  ready: boolean;
  position: T.Vector3;
  materials: Map<T.Material, T.MeshStandardMaterial>;
  patched: Set<T.Material>;
  owned: Set<T.Material>;
  reflections: Map<T.MeshStandardMaterial, { map: T.Texture | null; intensity: number }>;
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
/** Release dynamically replaced cosmetic materials without retaining dead shader state. */
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
    cube: { value: axes.map(() => new T.Color()) },
    target: axes.map(() => new T.Color()),
    rotation: { value: new T.Matrix3() },
    sun: { value: 1 },
    targetSun: 1,
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
    });
    // oxlint-disable-next-line typescript/unbound-method -- Called with the owning material via .call below.
    const previous = prior?.compile ?? material.onBeforeCompile;
    const key = prior?.key ?? material.customProgramCacheKey();
    patches.set(material, { lighting, compile: previous, key });
    material.onBeforeCompile = function (shader, renderer) {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, {
        sourceActorProbeEnabled: lighting.enabled,
        sourceActorProbeCube: lighting.cube,
        sourceActorProbeRotation: lighting.rotation,
        sourceActorProbeSun: lighting.sun,
      });
      shader.fragmentShader =
        `
        uniform float sourceActorProbeEnabled;
        uniform vec3 sourceActorProbeCube[6];
        uniform mat3 sourceActorProbeRotation;
        uniform float sourceActorProbeSun;
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
          "envMapRotation * mix(reflectVec, sourceActorProbeRotation * reflectVec, sourceActorProbeEnabled)",
        ),
      );
      // Expand only the lighting chunk we need to modify. Direct point fixtures
      // remain independent; source baked sun visibility gates directional light.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        T.ShaderChunk.lights_fragment_begin.replace(
          "getDirectionalLightInfo( directionalLight, directLight );",
          "getDirectionalLightInfo( directionalLight, directLight );\n directLight.color *= mix(1.0, sourceActorProbeSun, sourceActorProbeEnabled);",
        ),
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_maps>",
        `#include <lights_fragment_maps>
        #if defined(RE_IndirectDiffuse)
          if (sourceActorProbeEnabled > 0.5) {
            irradiance = sourceActorIrradiance(geometryNormal);
            iblIrradiance = vec3(0.0);
          }
        #endif`,
      );
    };
    material.customProgramCacheKey = () => `${key}:source-actor-probe-v1`;
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
) {
  const state = actors.get(root);
  if (!state) return;
  if (!sample) {
    state.enabled.value = 0;
    state.ready = false;
    state.timer = 0;
    return;
  }
  state.rotation.value.copy(rotation ?? identity);
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
      state.ready = false;
      return;
    }
    state.targetSun = sampleSun ? T.MathUtils.clamp(sampleSun(position), 0, 1) : 1;
    if (!state.ready || teleported) {
      state.target.forEach((color, i) => state.cube.value[i].copy(color));
      state.sun.value = state.targetSun;
    }
    state.ready = true;
    state.enabled.value = 1;
  }
  const alpha = 1 - Math.exp(-Math.max(0, dt) * 12);
  state.target.forEach((color, i) => state.cube.value[i].lerp(color, alpha));
  state.sun.value = T.MathUtils.lerp(state.sun.value, state.targetSun, alpha);
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
  }
}
