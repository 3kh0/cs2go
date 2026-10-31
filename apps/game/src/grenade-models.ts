import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { armoryReflections } from "./reflections";
import { loadModel } from "./gltf";
import { grenadeTypes, type GrenadeKind } from "./utility";
const motions = new Map<GrenadeKind, { source: T.Group; clips: [string, T.AnimationClip][] }>();
const actions = [
  "idle",
  "draw",
  "pullpin",
  "throw_overhand",
  "throw_underhand",
  "throwcharge_high",
  "throwcharge_mid",
  "throwcharge_low",
];
const templates = new Map<GrenadeKind, T.Group>();
const thrownPoses = new Map<GrenadeKind, T.AnimationClip>();
export async function loadGrenadeModels(renderer: T.WebGLRenderer) {
  const reflections = armoryReflections(renderer);
  await Promise.all(
    grenadeTypes.map(async (kind) => {
      const model = await loadModel(`/models/grenades/${kind}.glb`);
      model.scene.traverse((node) => {
        if (node instanceof T.Mesh) {
          node.frustumCulled = false;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material instanceof T.MeshStandardMaterial) {
              material.envMap = reflections;
              material.envMapIntensity = 1.2;
              // Native weapon AO assumes Source lighting; soften it for the
              // browser viewmodel lights so coated metal remains readable.
              material.aoMapIntensity = 0.35;
            }
          }
        }
      });
      templates.set(kind, model.scene);
      const thrown = model.animations.find((clip) => clip.name === "thrown");
      if (thrown) thrownPoses.set(kind, thrown);
      const clips = await Promise.all(
        actions.map(
          async (name) =>
            [name, await loadModel(`/models/grenades/clips/${kind}/${name}.glb`)] as const,
        ),
      );
      motions.set(kind, {
        source: clips[0][1].scene,
        clips: clips.map(([name, gltf]) => [name, gltf.animations[0]]),
      });
    }),
  );
}
export function createGrenadeModel(kind: GrenadeKind, thrown = false) {
  const template = templates.get(kind);
  if (!template) return null;
  const model = clone(template);
  if (thrown && thrownPoses.has(kind)) {
    const mixer = new T.AnimationMixer(model);
    mixer.clipAction(thrownPoses.get(kind)!).play();
    mixer.setTime(0);
  } else if (thrown) {
    for (const name of ["pin", "ring", "handle"]) model.getObjectByName(name)?.scale.setScalar(0);
  }
  return model;
}

export function createGrenadeMotion(kind: GrenadeKind) {
  const motion = motions.get(kind);
  return motion ? { source: clone(motion.source) as T.Group, clips: motion.clips } : null;
}
export function grenadeMotionDuration(kind: GrenadeKind, action: string) {
  return motions.get(kind)?.clips.find(([name]) => name === action)?.[1].duration;
}
