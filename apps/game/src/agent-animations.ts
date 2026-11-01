import * as T from "three";
import { assetFetch } from "./asset-url";
import { loadModel } from "./gltf";

export type AgentAnimationDefinition = {
  id: string;
  name: string;
  pack: string;
  team?: "t" | "ct";
  group: string;
  source: string;
  duration: number;
  loop: boolean;
  additive: boolean;
  equipped: "none" | "weapon" | "knife";
  token?: string;
};
type SourceClip = Omit<AgentAnimationDefinition, "id" | "pack" | "team"> & { team: string };
type Manifest = {
  packs: Record<string, { url: string; clips: SourceClip[] }>;
  weapon_packs: Record<string, string[]>;
  weapon_skeletons: Record<string, string>;
  weapon_rest: Record<string, { bones: Record<string, { t?: number[]; r?: number[] }> }>;
};
let manifestRequest: Promise<Manifest> | undefined;
async function manifest() {
  manifestRequest ??= assetFetch("/models/agents/inspects/animations.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Agent animation catalog could not load");
      const value = (await response.json()) as Manifest;
      if (
        !value.packs?.base ||
        Object.values(value.packs).some(
          (pack) => !pack.url.startsWith("/models/agents/inspects/animations/"),
        )
      )
        throw new Error("Invalid agent animation catalog");
      return value;
    })
    .catch((error) => {
      manifestRequest = undefined;
      throw error;
    });
  return manifestRequest;
}
export async function loadAgentAnimations(): Promise<AgentAnimationDefinition[]> {
  const data = await manifest();
  return Object.entries(data.packs).flatMap(([pack, value]) =>
    value.clips.map((clip) => ({
      ...clip,
      id: `${pack}::${clip.name}`,
      pack,
      team: clip.team === "t" || clip.team === "ct" ? clip.team : undefined,
    })),
  );
}
type Loaded = { scene: T.Group; clips: Map<string, T.AnimationClip>; definitions: SourceClip[] };
type Cached = { pending: Promise<Loaded>; value?: Loaded; references: number; used: number };
export type AgentAnimationPack = Loaded & { release: () => void };
const packs = new Map<string, Cached>();
let clock = 0;
function prune() {
  const idle = [...packs]
    .filter(([, entry]) => entry.value && !entry.references)
    .sort(([, a], [, b]) => b.used - a.used);
  for (const [key] of idle.slice(2)) packs.delete(key);
}
/** Native viewer clips are metres; existing Source2 body rigs retain inch locals
 * under a .0254 root. Keep root scale and never mutate shared native samplers. */
export function sourceAgentClip(clip: T.AnimationClip, duration = clip.duration) {
  const tracks = clip.tracks
    .filter(
      (track) =>
        track.name !== "root_motion.scale" &&
        !track.name.startsWith("weapon.") &&
        !track.name.startsWith("weapon_offset."),
    )
    .map((track) => {
      const copy = track.clone();
      if (copy.name.endsWith(".position") && copy.name !== "root_motion.position")
        for (let i = 0; i < copy.values.length; i++) copy.values[i] /= 0.0254;
      return copy;
    });
  return new T.AnimationClip(clip.name, duration, tracks, clip.blendMode);
}
/** Pure attachment/camera helpers are absent from some body-only exports.
 * Recreate their native hierarchy without touching weighted joints or meshes. */
export function ensureAgentAnimationBones(model: T.Group, source: T.Group) {
  if (!model.getObjectByName("pelvis")) return;
  const ensure = (node: T.Object3D): T.Object3D | undefined => {
    const existing = model.getObjectByName(node.name);
    if (existing) return existing;
    if (!node.name || node === source || /^(weapon|weapon_offset)$/.test(node.name)) return;
    const parent = node.parent && (node.parent === source ? model : ensure(node.parent));
    if (!parent) return;
    const bone = new T.Bone();
    bone.name = node.name;
    bone.position.copy(node.position);
    if (node.name !== "root_motion") bone.position.divideScalar(0.0254);
    bone.quaternion.copy(node.quaternion);
    bone.scale.copy(node.scale);
    if (node.name === "root_motion") bone.scale.multiplyScalar(0.0254);
    parent.add(bone);
    return bone;
  };
  source.traverse((node) => {
    if (node.name && !node.name.startsWith("weapon")) ensure(node);
  });
  // Sparse clips are evaluated over this pack's bind pose, not whichever
  // weapon/home animation happened to run before the selection.
  source.traverse((node) => {
    if (!node.name || node.name.startsWith("weapon")) return;
    const target = model.getObjectByName(node.name);
    if (!target) return;
    target.position.copy(node.position);
    if (node.name !== "root_motion") target.position.divideScalar(0.0254);
    target.quaternion.copy(node.quaternion);
    target.scale.copy(node.scale);
    if (node.name === "root_motion") target.scale.multiplyScalar(0.0254);
  });
}
export function agentClipForModel(clip: T.AnimationClip, model: T.Group) {
  const names = new Set<string>();
  model.traverse((node) => {
    if (node.name) names.add(node.name);
  });
  const tracks = clip.tracks.filter((track) =>
    names.has(track.name.slice(0, track.name.lastIndexOf("."))),
  );
  return new T.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}
/** Native GLBs optimize constant channels away. Additive grip rebasing needs a
 * complete absolute reference, including unchanged finger translations. */
export function completeAgentClip(clip: T.AnimationClip, model: T.Group) {
  const tracks = clip.tracks.slice(),
    names = new Set(tracks.map((track) => track.name));
  model.traverse((node) => {
    if (!(node instanceof T.Bone)) return;
    if (!names.has(`${node.name}.position`))
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.position`, [0], node.position.toArray()));
    if (!names.has(`${node.name}.quaternion`))
      tracks.push(
        new T.QuaternionKeyframeTrack(`${node.name}.quaternion`, [0], node.quaternion.toArray()),
      );
  });
  return new T.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}
export async function acquireAgentAnimationPack(key: string): Promise<AgentAnimationPack> {
  const data = await manifest();
  const metadata = data.packs[key];
  if (!metadata) throw new Error("Unknown agent animation pack");
  let entry = packs.get(key);
  if (!entry) {
    const created: Cached = {
      references: 0,
      used: ++clock,
      pending: Promise.resolve(undefined as unknown as Loaded),
    };
    created.pending = loadModel(metadata.url, 1)
      .then((model) => {
        const clips = new Map<string, T.AnimationClip>();
        for (const definition of metadata.clips) {
          const raw = model.animations.find((clip) => clip.name === definition.name);
          if (!raw) throw new Error(`Missing source agent animation: ${key}/${definition.name}`);
          clips.set(definition.name, sourceAgentClip(raw, definition.duration));
        }
        created.value = { scene: model.scene, clips, definitions: metadata.clips };
        return created.value;
      })
      .catch((error) => {
        packs.delete(key);
        throw error;
      });
    packs.set(key, created);
    entry = created;
  }
  entry.references++;
  entry.used = ++clock;
  try {
    const value = await entry.pending;
    let released = false;
    return {
      ...value,
      release() {
        if (released) return;
        released = true;
        entry!.references--;
        prune();
      },
    };
  } catch (error) {
    entry.references--;
    prune();
    throw error;
  }
}
export async function acquireAgentAnimation(id: string) {
  const at = id.indexOf("::"),
    key = id.slice(0, at),
    name = id.slice(at + 2);
  if (at < 1) throw new Error("Invalid agent animation selection");
  const pack = await acquireAgentAnimationPack(key);
  const definition = pack.definitions.find((item) => item.name === name);
  if (!definition) {
    pack.release();
    throw new Error("Agent animation not found");
  }
  // Absolute companions contain the native additive evaluated over its bind pose.
  const clip = pack.clips.get(
    definition.additive && pack.clips.has(name + ".vnmclip+non_additive")
      ? name + ".vnmclip+non_additive"
      : name,
  )!;
  return { pack, clip, definition, release: pack.release };
}
/** Startup loads only common gameplay packs; the 1,221-clip browser stays lazy. */
export async function loadAgentGameplayClips() {
  const loaded = await Promise.all(
    ["world/rifle/_default_rifle", "world/pistol/_default_pistol", "world/equipment/c4"].map(
      acquireAgentAnimationPack,
    ),
  );
  try {
    return loaded.flatMap((pack) =>
      [...pack.clips.values()]
        .filter(
          (clip) =>
            /^(?:idle|walk|run|crouch|jump|inair)_/.test(clip.name) || clip.name === "planting",
        )
        .map((clip) => clip.clone()),
    );
  } finally {
    loaded.forEach((pack) => pack.release());
  }
}
const itemIds = [
  7, 60, 61, 9, 500, 515, 507, 4, 1, 16, 35, 34, 32, 36, 3, 30, 63, 64, 2, 10, 13, 8, 39, 40, 38,
  11, 17, 33, 23, 24, 19, 26, 25, 27, 29, 14, 28, 42, 59, 503, 505, 506, 508, 509, 512, 514, 516,
  517, 518, 519, 520, 521, 522, 523, 525, 526,
];
export async function agentWeaponAnimationPacks(index: number) {
  return (await manifest()).weapon_packs[String(itemIds[index])] ?? [];
}
/** Absolute native actions; callers can mask/rebase them over their grip layer. */
export async function loadAgentWeaponActions(index: number) {
  const keys = (await agentWeaponAnimationPacks(index)).filter(
    (key) => key.startsWith("world/") && !key.split("/").at(-1)!.startsWith("_default"),
  );
  const packs = await Promise.all(keys.map(acquireAgentAnimationPack));
  try {
    const result: Record<string, T.AnimationClip> = {};
    for (const pack of packs)
      for (const definition of pack.definitions) {
        if (definition.additive) continue;
        const prefix =
          /^(draw_crouch|draw|reload_crouch|reload|shoot_crouch|shoot|planting_crouch|planting|lookat)/.exec(
            definition.name,
          )?.[1];
        if (!prefix || result[prefix]) continue;
        result[prefix] = pack.clips.get(definition.name)!.clone();
        result[prefix].name = `agent_${index}_${prefix}`;
      }
    return result;
  } finally {
    packs.forEach((pack) => pack.release());
  }
}
export async function agentAnimationWeaponRest(index: number) {
  const data = await manifest();
  return data.weapon_rest[data.weapon_skeletons[String(itemIds[index])]]?.bones;
}
export async function agentAnimationWeaponIndex(id: string, current: number) {
  const data = await manifest();
  const [pack, name] = id.split("::");
  const definition = data.packs[pack]?.clips.find((clip) => clip.name === name) as SourceClip & {
    weapon_skeleton?: string;
  };
  if (!definition?.weapon_skeleton) {
    if (pack.startsWith("world/") && !pack.split("/").at(-1)!.startsWith("_default")) {
      const index = itemIds.findIndex((item) => data.weapon_packs[String(item)]?.includes(pack));
      if (index >= 0) return index;
    }
    return current;
  }
  const skeleton = definition.weapon_skeleton
    .split("/")
    .at(-1)!
    .replace(/\.vnmskel$/, "");
  const existing = data.weapon_skeletons[String(itemIds[current])];
  if (existing === skeleton) return current;
  const index = itemIds.findIndex((item) => data.weapon_skeletons[String(item)] === skeleton);
  return index < 0 ? current : index;
}
export async function agentAnimationEquipment(
  id: string,
): Promise<"c4" | "he" | "flash" | "smoke" | "molotov" | "incendiary" | "decoy" | undefined> {
  const data = await manifest(),
    [pack, name] = id.split("::");
  const definition = data.packs[pack]?.clips.find((clip) => clip.name === name) as SourceClip & {
    weapon_skeleton?: string;
  };
  const skeleton = definition?.weapon_skeleton
    ?.split("/")
    .at(-1)!
    .replace(/\.vnmskel$/, "");
  return (
    {
      c4: "c4",
      hegrenade: "he",
      flashbang: "flash",
      smokegrenade: "smoke",
      molotov: "molotov",
      incendiary: "incendiary",
      decoy: "decoy",
    } as const
  )[skeleton as "c4"];
}
