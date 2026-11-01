import { worldGrip } from "./world-grips";
import {
  loadInspectsKnives,
  createInspectsKnife,
  createInspectsWorldKnife,
  animateInspectsKnife,
  sourceKnifeDrawDuration,
  sourceKnifeAttackDuration,
} from "./inspects-knife";
import { isKnife } from "./physics";
import {
  nativeDrawDuration,
  loadNativeWeapons,
  createNativeWeapon,
  createNativeWorldGun,
  animateNativeWeapon,
  setNativeReflections,
} from "./weapon-motion";
import * as T from "three";
import { loadModel } from "./gltf";
import {
  loadKnifeMotion,
  createKnifeMotion,
  animateKnifeMotion,
  knifeDrawDuration,
  knifeAttackDuration,
} from "./knife-motion";
import { armoryReflections } from "./reflections";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WeaponInstance } from "./weapon-instance";
import { bindWeaponInstance, unregisterSkinModel, registerSkinModel } from "./skins";
export function weaponDrawDuration(index: number) {
  return index === 4
    ? knifeDrawDuration()
    : isKnife(index)
      ? sourceKnifeDrawDuration(index)
      : nativeDrawDuration(index);
}
export function weaponKnifeAttackDuration(index: number, stab: boolean, alternate: boolean) {
  return index === 4
    ? knifeAttackDuration(stab, alternate)
    : sourceKnifeAttackDuration(index, stab, alternate);
}
export const VIEWMODEL_FOV = 60;
const templates: T.Group[] = [];
export async function loadWeaponModels(renderer: T.WebGLRenderer) {
  // Metallic steel needs reflected light, not just diffuse hemisphere lighting.
  // Build once locally and share with knife materials for the template lifetime.
  const reflections = armoryReflections(renderer);
  const [, , models] = await Promise.all([
    loadKnifeMotion(),
    loadNativeWeapons(),
    Promise.all(
      ["ak-47", "m4a1_s", "usp-s", "awp", "bayonet"].map((name) =>
        loadModel(`/models/${name}.glb`),
      ),
    ),
    loadInspectsKnives(reflections),
  ]);
  setNativeReflections(reflections);
  models[4].scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof T.MeshStandardMaterial) {
        material.name = "weapon_knife_bayonet";
        material.envMap = reflections;
        material.envMapIntensity = 1.2;
      }
    }
  });
  models.forEach((model, index) => {
    templates[index] = model.scene;
  });
}
// SkeletonUtils gives every skinned part its own skeleton copy. Parts bound to
// identical bones share one, so each rig uploads a single bone texture per frame.
export function shareSkeletons(root: T.Object3D) {
  const skeletons: T.Skeleton[] = [];
  root.traverse((object) => {
    if (!(object instanceof T.SkinnedMesh)) return;
    const own = object.skeleton;
    const match = skeletons.find(
      (s) =>
        s.bones.length === own.bones.length &&
        s.bones.every(
          (bone, i) => bone === own.bones[i] && s.boneInverses[i].equals(own.boneInverses[i]),
        ),
    );
    if (!match) skeletons.push(own);
    else {
      own.dispose();
      object.bind(match, object.bindMatrix);
    }
  });
}
// Carried guns are rigid, so their parts are merged into one draw per material.
const worldGuns = new Map<string, T.Group>();
const relative = new T.Matrix4();
function mergeWorldGun(source: T.Group) {
  source.updateMatrixWorld(true);
  const inverse = source.matrixWorld.clone().invert();
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  let plain = true;
  source.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    if (
      Array.isArray(object.material) ||
      !(position instanceof T.BufferAttribute) ||
      position.normalized
    )
      plain = false;
    else {
      relative.multiplyMatrices(inverse, object.matrixWorld);
      const list = parts.get(object.material) ?? [];
      list.push(object.geometry.clone().applyMatrix4(relative));
      parts.set(object.material, list);
    }
  });
  const meshes = [...parts].map(([material, list]) => {
    const geometry = list.length > 1 ? mergeGeometries(list) : list[0];
    return geometry && new T.Mesh(geometry, material);
  });
  if (!plain || meshes.some((mesh) => !mesh)) return source;
  const group = new T.Group();
  source.matrix.decompose(group.position, group.quaternion, group.scale);
  group.userData = structuredClone(source.userData);
  group.add(...(meshes as T.Mesh[]));
  return group;
}
// The menu needs the authored grip metadata retained on the original knife node.
export function createWorldBayonet() {
  const model = templates[4].clone(true);
  model.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    }
  });
  model.userData.ownedWorldGun = true;
  registerSkinModel(model, 4);
  return model;
}
export function disposeWorldGun(root: T.Object3D) {
  root.removeFromParent();
  const skeletons = new Set<T.Skeleton>();
  root.traverse((object) => {
    if (object instanceof T.Group && object.userData.ownedWorldGun) unregisterSkinModel(object);
    if (object instanceof T.Mesh && root.userData.ownedWorldGun) {
      if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    }
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
}
export function createWorldGun(index: number, suppressed = true, instance?: WeaponInstance) {
  if (isKnife(index)) {
    const model = index === 4 ? createWorldBayonet() : createInspectsWorldKnife(index);
    bindWeaponInstance(model, instance ?? null);
    return model;
  }
  if (instance?.skin.id && !isKnife(index)) {
    const gun = createNativeWorldGun(
      index,
      suppressed,
      worldGrip("t", index)?.stand.weaponBones,
      true,
    );
    gun.userData.ownedWorldGun = true;
    bindWeaponInstance(gun, instance);
    return gun;
  }
  const key = `${index}:${suppressed}`;
  let template = worldGuns.get(key);
  if (!template) {
    template = mergeWorldGun(
      createNativeWorldGun(index, suppressed, worldGrip("t", index)?.stand.weaponBones),
    );
    worldGuns.set(key, template);
  }
  return template.clone(true);
}
export function createGun(index: number, team: "t" | "ct" = "ct") {
  const group = new T.Group();
  group.userData.team = team;
  group.userData.muzzle = new T.Vector3(0, 0.015, -0.9);
  if (isKnife(index) && index !== 4) {
    createInspectsKnife(group, index);
    animateGun(group, { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 });
    return group;
  }
  if (!isKnife(index) && createNativeWeapon(group, index)) {
    animateGun(group, { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 });
    return group;
  }
  if (templates[index]) {
    const model = templates[index].clone(true);
    model.traverse((child) => {
      if (child instanceof T.Mesh) {
        child.geometry = child.geometry.clone();
        child.material = Array.isArray(child.material)
          ? child.material.map((m) => m.clone())
          : child.material.clone();
      }
    });
    model.name = "weapon-model";
    group.add(model);
  }
  if (index === 4 && createKnifeMotion(group)) {
    registerSkinModel(group.getObjectByName("weapon-model")! as T.Group, index);
    animateGun(group, { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 });
    return group;
  }
  return group;
}

export type GunPose = {
  suppressed?: boolean;
  suppressorAction?: "silencer_attach" | "silencer_detach" | null;
  suppressorProgress?: number;
  revolverCharge?: number;
  alternateShot?: boolean;
  lastShot?: boolean;
  emptyReload?: boolean;
  clock?: number;
  reloadActive?: boolean;
  boltActive?: boolean;
  shot?: number;
  shotActive?: boolean;
  reload: number;
  draw: number;
  bolt: number;
  recoil: number;
  bob: number;
  sway: number;
  knife?: number;
  knifeElapsed?: number;
  stab?: boolean;
  knifeActive?: boolean;
  knifeContact?: boolean;
  alternate?: boolean;
  time?: number;
  inspect?: number;
  inspectActive?: boolean;
  inspectDraw?: boolean;
  inspectVariant?: number;
};
export function animateGun(group: T.Group, pose: GunPose) {
  if (
    animateInspectsKnife(group, pose) ||
    animateKnifeMotion(group, pose) ||
    animateNativeWeapon(group, pose)
  )
    return;
}
