import { registerSkinModel } from "./skins";
import { WEAPON_ANIMATION_RATE } from "./physics";
import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { loadModel } from "./gltf";
import { viewHandsTemplate } from "./knife-motion";
import type { WeaponSound } from "./audio";
import { registerActorLighting } from "./actor-lighting";
import { forearmTwists, updateForearmTwists } from "./forearm-twist";

const weapons = [
  "ak-47",
  "m4a1_s",
  "usp-s",
  "awp",
  null,
  null,
  null,
  "glock",
  "deagle",
  "m4a4",
  "nova",
  "mp9",
  "hkp2000",
  "p250",
  "fiveseven",
  "tec9",
  "cz75a",
  "revolver",
  "elite",
  "famas",
  "galilar",
  "aug",
  "sg556",
  "ssg08",
  "scar20",
  "g3sg1",
  "mac10",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "xm1014",
  "mag7",
  "sawedoff",
  "m249",
  "negev",
];
const motions = ["idle", "draw", "reload", "shoot1", "lookat01"] as const;
type Motion =
  | (typeof motions)[number]
  | "shoot2"
  | "shoot_empty"
  | "reload_empty"
  | "prepare"
  | "silencer_attach"
  | "silencer_detach";
type SoundCue = { time: number; kind: WeaponSound };
type ClipEvent = {
  m_flStartTime: { m_flValue: number };
  m_flDuration?: { m_flValue: number };
  m_name?: string;
  m_ID?: string;
};
const eliteReloadSounds: Record<string, WeaponSound> = {
  "weapon_elite.clipin.slide": "reloadSlide",
  // The imported ELITE reload aliases the same native magazine_slide_01 resource.
  "weapon_galilar.clipin": "reloadSlide",
  "weapon_elite.lclipin": "reloadLeft",
  "weapon_elite.rclipin": "reloadRight",
};
export type NativeReloadPhases = { introEnd: number; loopEnd: number; addAmmo: number };
type Template = {
  model: T.Group;
  source: T.Group;
  clips: Map<Motion, T.AnimationClip>;
  sounds: Map<Motion, SoundCue[]>;
  reloadPhases?: NativeReloadPhases;
  magazineInsert?: Partial<Record<"reload" | "reload_empty", number>>;
  suppressor?: Record<string, { commit: number; show: number; hide: number }>;
};
const templates: Template[] = [];
const hdBodies = new Map<number, Promise<T.Group>>();
let reflections: T.Texture | undefined;
function loadHdBody(index: number) {
  let pending = hdBodies.get(index);
  if (!pending) {
    pending = loadModel(`/models/viewmodels/${weapons[index]}-hd.glb`)
      .then(({ scene }) => {
        scene.name = "skin-hd";
        scene.visible = false;
        if (reflections) applyReflections(scene, reflections);
        templates[index].model.add(scene);
        return scene;
      })
      .catch((error: unknown) => {
        hdBodies.delete(index);
        throw error;
      });
    hdBodies.set(index, pending);
  }
  return pending;
}
export async function loadNativeWeapons() {
  await Promise.all(
    weapons.map(async (name, index) => {
      if (!name) return;
      const weaponMotions: Motion[] = [...motions];
      if (index === 8) weaponMotions.push("shoot_empty", "reload_empty");
      if (index === 18 || index === 17) weaponMotions.push("shoot2");
      if (index === 17) weaponMotions.push("prepare");
      if (index === 1 || index === 2) weaponMotions.push("silencer_attach", "silencer_detach");
      const [model, ...animations] = await Promise.all([
        loadModel(`/models/viewmodels/${name}.glb`),
        ...weaponMotions.map((m) => loadModel(`/models/viewmodels/${name}/${m}.glb`)),
      ]);
      const variants = new T.Group();
      model.scene.name = "skin-legacy";
      variants.add(model.scene);
      const reloadData = animations[2].parser.json as {
        animations: { extras?: { events?: ClipEvent[] } }[];
      };
      const reloadEvents = reloadData.animations[0].extras?.events ?? [];
      const loop = reloadEvents.find((event) => event.m_ID === "WPN_RELOAD_LOOP");
      const addAmmo = reloadEvents.find((event) => event.m_ID === "WPN_RELOAD_ADD_AMMO");
      templates[index] = {
        magazineInsert: Object.fromEntries(
          animations.flatMap((animation, i) => {
            const motion = weaponMotions[i];
            if (motion !== "reload" && motion !== "reload_empty") return [];
            const events =
              (animation.parser.json as { animations: { extras?: { events?: ClipEvent[] } }[] })
                .animations[0].extras?.events ?? [];
            const marker = events.filter((event) => event.m_ID === "WPN_RELOAD_ADD_AMMO").at(-1);
            return marker
              ? [[motion, T.MathUtils.clamp(marker.m_flStartTime.m_flValue, 0, 1)]]
              : [];
          }),
        ),
        reloadPhases:
          loop && addAmmo
            ? {
                introEnd: loop.m_flStartTime.m_flValue,
                loopEnd: loop.m_flStartTime.m_flValue + (loop.m_flDuration?.m_flValue ?? 0),
                addAmmo: addAmmo.m_flStartTime.m_flValue,
              }
            : undefined,
        suppressor: Object.fromEntries(
          animations.flatMap((a, i) => {
            const action = weaponMotions[i];
            if (action !== "silencer_attach" && action !== "silencer_detach") return [];
            const events =
              (a.parser.json as { animations: { extras?: { events?: ClipEvent[] } }[] })
                .animations[0].extras?.events ?? [];
            const show = events.find((e) => e.m_ID === "WPN_SHOW_SILENCER");
            return [
              [
                action,
                {
                  commit:
                    events.find(
                      (e) =>
                        e.m_ID ===
                        (action === "silencer_attach"
                          ? "WPN_SILENCER_ATTACH"
                          : "WPN_SILENCER_DETACH"),
                    )?.m_flStartTime.m_flValue ?? 1,
                  show: show?.m_flStartTime.m_flValue ?? 0,
                  hide: (show?.m_flStartTime.m_flValue ?? 0) + (show?.m_flDuration?.m_flValue ?? 1),
                },
              ],
            ];
          }),
        ),
        model: variants,
        source: animations[0].scene,
        sounds: new Map(
          animations.map((a, i) => {
            const data = a.parser.json as { animations: { extras?: { events?: ClipEvent[] } }[] };
            const cues: SoundCue[] = [];
            for (const event of data.animations[0].extras?.events ?? []) {
              const eliteSound =
                index === 18 && weaponMotions[i] === "reload"
                  ? eliteReloadSounds[event.m_name?.toLowerCase() ?? ""]
                  : undefined;
              if (eliteSound) {
                cues.push({ time: event.m_flStartTime.m_flValue, kind: eliteSound });
                continue;
              }
              const sound = event.m_name?.split(".").at(-1);
              const kind: WeaponSound | undefined = /^silencerscrew(?:onstart|offend|[1-5])$/.test(
                sound ?? "",
              )
                ? (sound as WeaponSound)
                : sound === "clipout" || sound === "boxout"
                  ? "reload"
                  : sound === "clipin" ||
                      sound === "boxin" ||
                      sound === "leftclipin" ||
                      sound === "rightclipin" ||
                      sound === "insertshell"
                    ? "reloadIn"
                    : sound === "boltpull" ||
                        sound === "boltback" ||
                        sound === "slideback" ||
                        sound === "pump" ||
                        sound === "pump_back" ||
                        sound === "sideback"
                      ? "bolt"
                      : sound === "boltforward" ||
                          sound === "sliderelease" ||
                          sound === "slideforward" ||
                          sound === "boltrelease" ||
                          sound === "siderelease" ||
                          sound === "pump_forward"
                        ? "boltForward"
                        : sound === "draw"
                          ? "draw"
                          : undefined;
              if (kind) cues.push({ time: event.m_flStartTime.m_flValue, kind });
            }
            return [weaponMotions[i], cues];
          }),
        ),
        clips: new Map(
          animations.map((a, i) => [
            weaponMotions[i],
            new T.AnimationClip(
              weaponMotions[i],
              a.animations[0].duration,
              a.animations.flatMap((c) => c.tracks),
            ).optimize(),
          ]),
        ),
      };
    }),
  );
}
export function nativeSuppressor(index: number, attach: boolean) {
  const motion = attach ? "silencer_attach" : "silencer_detach";
  return {
    duration: (templates[index]?.clips.get(motion)?.duration ?? 3) / WEAPON_ANIMATION_RATE,
    ...templates[index]?.suppressor?.[motion],
    commit: templates[index]?.suppressor?.[motion]?.commit ?? 1,
  };
}
export function nativeDrawDuration(index: number) {
  return (templates[index]?.clips.get("draw")?.duration ?? 0.75) / WEAPON_ANIMATION_RATE;
}
/** Unknown clips commit at completion rather than guessing a magazine seat. */
export function nativeMagazineInsert(index: number, empty = false) {
  const markers = templates[index]?.magazineInsert;
  return (empty ? markers?.reload_empty : undefined) ?? markers?.reload ?? 1;
}
export function nativeReloadPhases(index: number) {
  return templates[index]?.reloadPhases;
}
export function nativeShotDuration(index: number, alternate = false, lastShot = false) {
  const clips = templates[index]?.clips;
  return (
    ((lastShot ? clips?.get("shoot_empty") : undefined)?.duration ??
      (alternate ? clips?.get("shoot2") : undefined)?.duration ??
      clips?.get("shoot1")?.duration ??
      0) / WEAPON_ANIMATION_RATE
  );
}
export function nativeInspectDuration(index: number) {
  return (templates[index]?.clips.get("lookat01")?.duration ?? 0) / WEAPON_ANIMATION_RATE;
}
export function nativeSoundCues(index: number, motion: Motion) {
  return templates[index]?.sounds.get(motion) ?? [];
}
function applyReflections(root: T.Group, texture: T.Texture) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof T.MeshStandardMaterial) {
        material.envMap = texture;
        material.envMapIntensity = 0.8;
      }
    }
  });
}
export function setNativeReflections(texture: T.Texture) {
  reflections = texture;
  for (const template of templates) if (template) applyReflections(template.model, texture);
}
type Binding = { target: T.Object3D; source: T.Object3D };
type Rig = {
  index: number;
  arms: T.Group;
  model: T.Group;
  source: T.Group;
  mixer: T.AnimationMixer;
  actions: Map<Motion, T.AnimationAction>;
  current?: Motion;
  armsBindings: Binding[];
  twists: ReturnType<typeof forearmTwists>;
  weaponBindings: Binding[];
  attachment: T.Object3D;
  markers: { target: T.Object3D; source: T.Object3D }[];
  muzzle: T.Object3D;
  alternateMuzzle?: T.Object3D;
  transitionStart: number;
  blend: {
    bone: T.Object3D;
    position: T.Vector3;
    quaternion: T.Quaternion;
    scale: T.Vector3;
    rawPosition: T.Vector3;
    rawQuaternion: T.Quaternion;
    rawScale: T.Vector3;
  }[];
};
const rigs = new WeakMap<T.Group, Rig>();
function prepare(template: T.Group) {
  const root = clone(template) as T.Group;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.frustumCulled = false;
      o.geometry = o.geometry.clone();
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  return root;
}
export function createNativeWeapon(
  group: T.Group,
  index: number,
  register = true,
  skinBodies = false,
  body?: T.Group,
) {
  const template = templates[index];
  if (!template) return false;
  // Carried guns use only the default visible mesh. They have no hands or skin
  // selector, so avoid cloning and posing hidden HD geometry and the hand rig.
  const arms = register ? prepare(viewHandsTemplate()) : new T.Group(),
    model = prepare(
      body ??
        (register || skinBodies
          ? template.model
          : (template.model.getObjectByName("skin-legacy") as T.Group)),
    ),
    source = template.source.clone(true);
  arms.name = "agent-view-arms";
  model.name = "weapon-model";
  if (body) model.visible = true;
  group.add(arms, model);
  const mixer = new T.AnimationMixer(source),
    actions = new Map<Motion, T.AnimationAction>();
  for (const [name, clip] of template.clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(name, action);
  }
  function bind(root: T.Group, filter: (name: string) => boolean) {
    const bindings: Binding[] = [];
    root.traverse((target) => {
      const bone = source.getObjectByName(target.name);
      if (target instanceof T.Bone && bone && filter(target.name))
        bindings.push({ target, source: bone });
    });
    return bindings;
  }
  const markers = ["L", "R"].map((side) => {
    const target = new T.Object3D();
    target.name = side === "L" ? "left-hand" : "right-hand";
    group.add(target);
    return { target, source: source.getObjectByName(`hand_${side}`)! };
  });
  const blend: Rig["blend"] = [];
  source.traverse((bone) =>
    blend.push({
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
      rawPosition: bone.position.clone(),
      rawQuaternion: bone.quaternion.clone(),
      rawScale: bone.scale.clone(),
    }),
  );
  rigs.set(group, {
    index,
    arms,
    model,
    source,
    mixer,
    actions,
    armsBindings: bind(arms, (n) => /^(arm_upper_|arm_lower_|hand_|finger_)/.test(n)),
    twists: register ? forearmTwists(arms) : [],
    weaponBindings: bind(model, () => true),
    attachment: source.getObjectByName("wpn")!,
    markers,
    muzzle: (source.getObjectByName("muzzle") ?? source.getObjectByName("muzzle_l"))!,
    alternateMuzzle: source.getObjectByName("muzzle_r"),
    transitionStart: -Infinity,
    blend,
  });
  if (register)
    registerSkinModel(model, index, async () => {
      const hd = prepare(await loadHdBody(index));
      const bindings = bind(hd, () => true);
      const rig = rigs.get(group)!;
      rig.weaponBindings.push(...bindings);
      model.add(hd);
      group.updateWorldMatrix(true, true);
      // Match animateNativeWeapon's attachment-space binding immediately: a
      // finish can become visible before the next animation sample runs.
      const frame = new T.Matrix4()
        .multiplyMatrices(group.matrixWorld, basis)
        .multiply(rig.attachment.matrixWorld);
      const transform = new T.Matrix4();
      for (const { target, source } of bindings) {
        transform
          .copy(target.parent!.matrixWorld)
          .invert()
          .multiply(frame)
          .multiply(source.matrixWorld);
        transform.decompose(target.position, target.quaternion, target.scale);
        target.updateWorldMatrix(false, false);
      }
      registerActorLighting(group);
      return hd;
    });
  return true;
}
const basis = new T.Matrix4().set(0, -0.0254, 0, 0, 0, 0, 0.0254, 0, -0.0254, 0, 0, 0, 0, 0, 0, 1);
const world = new T.Matrix4(),
  attachment = new T.Matrix4(),
  matrix = new T.Matrix4();
const markerScale = new T.Vector3();
export type NativePose = {
  suppressed?: boolean;
  suppressorAction?: "silencer_attach" | "silencer_detach" | null;
  suppressorProgress?: number;
  clock?: number;
  inspect?: number;
  inspectActive?: boolean;
  draw: number;
  reload: number;
  reloadActive?: boolean;
  emptyReload?: boolean;
  bolt: number;
  boltActive?: boolean;
  shot?: number;
  shotActive?: boolean;
  revolverCharge?: number;
  alternateShot?: boolean;
  lastShot?: boolean;
  bob: number;
  sway: number;
};
export function animateNativeWeapon(group: T.Group, pose: NativePose) {
  const rig = rigs.get(group);
  if (!rig) return false;
  let name: Motion = "idle",
    progress = 0;
  if (pose.suppressorAction && rig.actions.has(pose.suppressorAction)) {
    name = pose.suppressorAction;
    progress = pose.suppressorProgress ?? 0;
  } else if (pose.reloadActive || pose.reload > 0) {
    name = pose.emptyReload && rig.actions.has("reload_empty") ? "reload_empty" : "reload";
    progress = pose.reload;
  } else if (pose.draw > 0) {
    name = "draw";
    progress = 1 - pose.draw;
  } else if ((rig.index === 3 || rig.index === 23) && (pose.boltActive || pose.bolt > 0)) {
    name = "shoot1";
    progress = pose.bolt;
  } else if (pose.revolverCharge !== undefined && rig.actions.has("prepare")) {
    name = "prepare";
    progress = pose.revolverCharge;
  } else if (pose.shotActive) {
    name =
      pose.lastShot && rig.actions.has("shoot_empty")
        ? "shoot_empty"
        : pose.alternateShot && rig.actions.has("shoot2")
          ? "shoot2"
          : "shoot1";
    progress = pose.shot ?? 0;
  } else if (pose.inspectActive) {
    name = "lookat01";
    progress = pose.inspect ?? 0;
  }
  const action = rig.actions.get(name)!;
  if (rig.current !== name) {
    // Blend interrupted actions in Source space so weapon attachments and hands
    // share the same transition. The fixed simulation clock freezes on pause.
    rig.transitionStart =
      rig.current &&
      name !== "draw" &&
      ((name !== "shoot1" && name !== "shoot2" && name !== "shoot_empty") ||
        rig.current === "lookat01") &&
      pose.clock !== undefined
        ? pose.clock
        : -Infinity;
    for (const state of rig.blend) {
      state.position.copy(state.bone.position);
      state.quaternion.copy(state.bone.quaternion);
      state.scale.copy(state.bone.scale);
    }
    rig.mixer.stopAllAction();
    action.reset().play();
    rig.current = name;
  }
  action.paused = true;
  action.time = T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
  // PropertyMixer skips unchanged values; restore its last unblended output
  // before sampling, otherwise repeated paused frames would accumulate blending.
  for (const state of rig.blend) {
    state.bone.position.copy(state.rawPosition);
    state.bone.quaternion.copy(state.rawQuaternion);
    state.bone.scale.copy(state.rawScale);
  }
  rig.mixer.update(0);
  for (const state of rig.blend) {
    state.rawPosition.copy(state.bone.position);
    state.rawQuaternion.copy(state.bone.quaternion);
    state.rawScale.copy(state.bone.scale);
  }
  const blend = T.MathUtils.clamp(((pose.clock ?? 0) - rig.transitionStart) / 0.08, 0, 1);
  if (blend < 1)
    for (const state of rig.blend) {
      state.bone.position.lerp(state.position, 1 - blend);
      state.bone.quaternion.slerp(state.quaternion, 1 - blend);
      state.bone.scale.lerp(state.scale, 1 - blend);
    }
  rig.source.updateMatrixWorld(true);
  group.position.set(0.05 + pose.sway, -0.025 + pose.bob, -0.025);
  group.rotation.set(0, 0, 0);
  group.updateWorldMatrix(true, true);
  world.multiplyMatrices(group.matrixWorld, basis);
  attachment.copy(world).multiply(rig.attachment.matrixWorld);
  function apply(bindings: Binding[], root: T.Matrix4) {
    for (const { target, source } of bindings) {
      matrix.copy(target.parent!.matrixWorld).invert().multiply(root).multiply(source.matrixWorld);
      matrix.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
  }
  apply(rig.armsBindings, world);
  updateForearmTwists(rig.twists);
  rig.arms.updateMatrixWorld(true);
  apply(rig.weaponBindings, attachment);
  const event = pose.suppressorAction
    ? templates[rig.index]?.suppressor?.[pose.suppressorAction]
    : undefined;
  const visible =
    pose.suppressorAction && event
      ? pose.suppressorAction === "silencer_attach"
        ? progress >= event.show
        : progress <= event.hide
      : pose.suppressed !== false;
  if (!visible)
    for (const { target } of rig.weaponBindings)
      if (target.name === "silencer") target.scale.setScalar(0.00001);
  rig.model.updateMatrixWorld(true);
  for (const { target, source } of rig.markers) {
    matrix.copy(basis).multiply(source.matrixWorld);
    matrix.decompose(target.position, target.quaternion, markerScale);
  }
  matrix
    .copy(basis)
    .multiply(rig.attachment.matrixWorld)
    .multiply(
      (pose.alternateShot && rig.alternateMuzzle ? rig.alternateMuzzle : rig.muzzle).matrixWorld,
    );
  group.userData.muzzle.setFromMatrixPosition(matrix);
  return true;
}

// Freeze a native idle pose for carried models: baked once, shared by all bots.
export function createNativeWorldGun(
  index: number,
  suppressed = true,
  buyPose?: Record<string, { p: number[]; q: number[]; s: number }>,
  customizable = false,
) {
  const result = bakeWorldGun(index, suppressed, buyPose, customizable);
  if (customizable)
    registerSkinModel(result, index, async () => {
      const hd = bakeWorldGun(index, suppressed, buyPose, false, await loadHdBody(index));
      // Both bodies must use the original legacy normalization/grip, not each
      // mesh's own bounds, or changing finish moves the showcase off its hand.
      const offset = new T.Vector3()
        .setFromMatrixPosition(new T.Matrix4().fromArray(result.userData.buyGrip))
        .sub(new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(hd.userData.buyGrip)));
      hd.traverse((object) => {
        if (object instanceof T.Mesh) object.geometry.translate(offset.x, offset.y, offset.z);
      });
      hd.name = "skin-hd";
      return hd;
    });
  return result;
}
function bakeWorldGun(
  index: number,
  suppressed: boolean,
  buyPose: Record<string, { p: number[]; q: number[]; s: number }> | undefined,
  customizable: boolean,
  body?: T.Group,
) {
  const view = new T.Group();
  view.userData.muzzle = new T.Vector3();
  createNativeWeapon(view, index, false, customizable, body);
  animateNativeWeapon(view, { draw: 0, reload: 0, bolt: 0, bob: 0, sway: 0, suppressed });
  view.updateMatrixWorld(true);
  const model = view.getObjectByName("weapon-model")!;
  const rig = rigs.get(view)!;
  const nativeAttachment = new T.Matrix4()
    .multiplyMatrices(view.matrixWorld, basis)
    .multiply(rig.attachment.matrixWorld);
  if (buyPose) {
    const transform = new T.Matrix4(),
      position = new T.Vector3(),
      rotation = new T.Quaternion();
    const scale = new T.Vector3(1, 1, 1);
    for (const { target } of rig.weaponBindings) {
      const sample = buyPose[target.name];
      if (!sample) continue;
      transform.compose(
        position.fromArray(sample.p),
        rotation.fromArray(sample.q).normalize(),
        scale.setScalar(sample.s),
      );
      transform
        .premultiply(nativeAttachment)
        .premultiply(target.parent!.matrixWorld.clone().invert());
      transform.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
  }
  const result = new T.Group();
  const bodies = new Map<string, T.Group>();
  if (customizable)
    for (const name of ["skin-legacy", "skin-hd"]) {
      if (!model.getObjectByName(name)) continue;
      const group = new T.Group();
      group.name = name;
      result.add(group);
      bodies.set(name, group);
    }
  const point = new T.Vector3();
  const bake = (object: T.Object3D) => {
    if (!(object instanceof T.Mesh)) return;
    const geometry = object.geometry.clone();
    // Quantized source coordinates cannot hold baked meter-space positions.
    const positions = new T.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count * 3),
      3,
    );
    geometry.setAttribute("position", positions);
    for (let i = 0; i < positions.count; i++) {
      object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.deleteAttribute("skinIndex");
    geometry.deleteAttribute("skinWeight");
    // Tangents still describe the source mesh's unposed coordinate system.
    // Derive the normal-map basis from the baked positions/UVs instead.
    geometry.deleteAttribute("tangent");
    // Packed integer normals round the small metre-space face contributions to
    // zero during accumulation. Recompute into a fresh floating-point buffer.
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone();
    let body: T.Object3D | null = object;
    while (body && !bodies.has(body.name)) body = body.parent;
    (bodies.get(body?.name ?? "") ?? result).add(new T.Mesh(geometry, material));
  };
  if (customizable) model.traverse(bake);
  else model.traverseVisible(bake);
  const bounds = new T.Box3().setFromObject(result),
    center = bounds.getCenter(new T.Vector3());
  result.traverse((object) => {
    if (object instanceof T.Mesh)
      object.geometry.translate(-center.x, -center.y, 0.15 - bounds.max.z);
  });
  // Preserve the native weapon origin for the buy-menu wpn attachment. The
  // existing world model normalization remains unchanged for bots and drops.
  const nativeRoot = model.getObjectByName("weapon")!;
  const position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  (buyPose ? nativeAttachment : nativeRoot.matrixWorld).decompose(position, rotation, scale);
  position.add(new T.Vector3(-center.x, -center.y, 0.15 - bounds.max.z));
  result.userData.buyGrip = new T.Matrix4()
    .compose(position, rotation, new T.Vector3(1, 1, 1))
    .toArray();
  const skeletons = new Set<T.Skeleton>();
  view.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose();
    if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
  return result;
}
