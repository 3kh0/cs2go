import { WEAPON_ANIMATION_RATE } from "./physics";
import {
  loadNativeWeapons,
  createNativeWeapon,
  animateNativeWeapon,
  setNativeReflections,
} from "./weapon-motion";
import * as T from "three";
import { gltf } from "./gltf";
import { loadKnifeMotion, createKnifeMotion, animateKnifeMotion } from "./knife-motion";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const DRAW_DURATION = 0.55 / WEAPON_ANIMATION_RATE;
export const VIEWMODEL_FOV = 60;
const templates: T.Group[] = [];
export async function loadWeaponModels(renderer: T.WebGLRenderer) {
  await Promise.all([loadKnifeMotion(), loadNativeWeapons()]);
  const models = await Promise.all(
    ["ak-47", "m4a1_s", "usp-s", "awp", "m9-bayonet"].map((name) =>
      gltf.loadAsync(`/models/${name}.glb`),
    ),
  );
  // Metallic steel needs reflected light, not just diffuse hemisphere lighting.
  // Build once locally and share with knife materials for the template lifetime.
  const room = new RoomEnvironment();
  const pmrem = new T.PMREMGenerator(renderer);
  const reflections = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  setNativeReflections(reflections);
  models[4].scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof T.MeshStandardMaterial) {
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
const worldGuns: T.Group[] = [];
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
  group.add(...(meshes as T.Mesh[]));
  return group;
}
export function createWorldGun(index: number) {
  worldGuns[index] ??= mergeWorldGun(templates[index]);
  return worldGuns[index].clone(true);
}
export function createGun(index: number, team: "t" | "ct" = "ct") {
  const group = new T.Group();
  group.userData.team = team;
  group.userData.muzzle = new T.Vector3(0, 0.015, -0.9);
  if (index < 4 && createNativeWeapon(group, index)) {
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
    animateGun(group, { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 });
    return group;
  }
  return group;
}

export type GunPose = {
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
  stab?: boolean;
  knifeActive?: boolean;
  alternate?: boolean;
  time?: number;
  inspect?: number;
  inspectActive?: boolean;
  inspectDraw?: boolean;
};
export function animateGun(group: T.Group, pose: GunPose) {
  if (animateKnifeMotion(group, pose) || animateNativeWeapon(group, pose)) return;
}
