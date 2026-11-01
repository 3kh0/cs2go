import * as T from "three";
import { assetFetch } from "./asset-url";
import { loadModel } from "./gltf";
import { bakeSkin } from "./skin-baker";
import type { Paint } from "./skin-paint";
import { loadAgentCatalog, selectedAgentId } from "./agent-roster";
import { registerActorLighting, releaseActorLightingMaterials } from "./actor-lighting";

type Team = "ct" | "t";
export type GloveChoice = { id: string; wear: number; seed: number };
export type GloveDefinition = {
  id: string;
  item: number;
  paint: number;
  name: string;
  model: string;
  image: string;
};
export function sanitizeGloveChoice(raw?: Partial<GloveChoice> | null): GloveChoice {
  return {
    id: typeof raw?.id === "string" && /^\d{4}_\d{1,5}$/.test(raw.id) ? raw.id : "",
    wear: Number.isFinite(raw?.wear) ? T.MathUtils.clamp(raw!.wear!, 0, 1) : 0.01,
    seed: Number.isFinite(raw?.seed) ? T.MathUtils.clamp(Math.round(raw!.seed!), 0, 1000) : 1,
  };
}
export const defaultGloveChoice = (): GloveChoice => ({ id: "", wear: 0.01, seed: 1 });
export const gloveChoices: Record<Team, GloveChoice> = {
  ct: defaultGloveChoice(),
  t: defaultGloveChoice(),
};
try {
  const saved = JSON.parse(localStorage.getItem("cs2go-gloves") ?? "{}");
  for (const team of ["ct", "t"] as const) gloveChoices[team] = sanitizeGloveChoice(saved[team]);
} catch {
  /* Guest/default play works without storage. */
}
let catalog: Promise<GloveDefinition[]> | undefined;
export function loadGloveCatalog() {
  catalog ??= assetFetch("/skins/gloves/catalog.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Glove catalog could not load");
      return (await response.json()) as GloveDefinition[];
    })
    .catch((error) => {
      catalog = undefined;
      throw error;
    });
  return catalog;
}

// Existing hand bones and skinning use Source inches, whereas viewer glTFs use
// metres/Y-up. Convert geometry +inverse binds together; never replace pose bones.
const sourceBasis = new T.Matrix4().set(
  0,
  0,
  1 / 0.0254,
  0,
  1 / 0.0254,
  0,
  0,
  0,
  0,
  1 / 0.0254,
  0,
  0,
  0,
  0,
  0,
  1,
);
const inverseBasis = sourceBasis.clone().invert();
const inverseUnits = new T.Matrix4().makeScale(1 / 0.0254, 1 / 0.0254, 1 / 0.0254);
export function gloveInverseBind(inverse: T.Matrix4) {
  return inverseUnits.clone().multiply(inverse).multiply(inverseBasis);
}
type Part = {
  mesh: T.SkinnedMesh;
  geometry: T.BufferGeometry;
  inverses: T.Matrix4[];
  role?: "sleeves" | "hands";
};
type Template = { scene: T.Group; parts: Part[]; refs: number };
const templates = new Map<string, Promise<Template>>();
const readyTemplates = new Map<string, Template>();
function trimTemplates() {
  const idle = [...readyTemplates].filter(([, template]) => !template.refs);
  for (const [path, template] of idle.slice(0, Math.max(0, idle.length - 2))) {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>(),
      skeletons = new Set<T.Skeleton>();
    template.parts.forEach((part) => geometries.add(part.geometry));
    template.scene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
      for (const material of materialList(object)) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof T.Texture) textures.add(value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    skeletons.forEach((skeleton) => skeleton.dispose());
    readyTemplates.delete(path);
    templates.delete(path);
  }
}
function template(path: string) {
  const ready = readyTemplates.get(path);
  if (ready) {
    readyTemplates.delete(path);
    readyTemplates.set(path, ready);
  }
  let request = templates.get(path);
  if (!request) {
    request = loadModel(path)
      .then((asset) => {
        const parts: Part[] = [];
        asset.scene.traverse((object) => {
          if (!(object instanceof T.SkinnedMesh)) return;
          const geometry = object.geometry.clone().applyMatrix4(sourceBasis);
          // glTF tangents carry the old basis too; regenerated tangents use posed normals/UVs.
          geometry.deleteAttribute("tangent");
          let node: T.Object3D | null = object,
            role: Part["role"];
          while (node && !role) {
            if (node.name.startsWith("agent_sleeves_")) role = "sleeves";
            else if (node.name.startsWith("agent_hands_")) role = "hands";
            node = node.parent;
          }
          parts.push({
            mesh: object,
            geometry,
            inverses: object.skeleton.boneInverses.map(gloveInverseBind),
            role,
          });
        });
        if (!parts.length) throw new Error("Glove model has no skinned meshes");
        const result = { scene: asset.scene, parts, refs: 0 };
        readyTemplates.set(path, result);
        return result;
      })
      .catch((error) => {
        templates.delete(path);
        throw error;
      });
    templates.set(path, request);
  }
  return request;
}
type Finish = {
  materials: Map<string, Partial<T.MeshStandardMaterial>>;
  textures: T.Texture[];
  refs: number;
};
const finishes = new Map<string, Promise<Finish>>();
const readyFinishes = new Map<string, Finish>();
const choiceKey = (choice: GloveChoice) => `${choice.id}:${choice.wear}:${choice.seed}`;
function texture(bytes: Uint8Array, color = false) {
  const result = new T.DataTexture(bytes, 1024, 1024, T.RGBAFormat);
  result.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  result.flipY = false;
  result.generateMipmaps = true;
  result.minFilter = T.LinearMipmapLinearFilter;
  result.wrapS = result.wrapT = T.RepeatWrapping;
  result.needsUpdate = true;
  return result;
}
function normal(bytes: Uint8Array) {
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 4) {
    const x = (bytes[i] + bytes[i + 1]) / 255 - 1.003922,
      y = (bytes[i] - bytes[i + 1]) / 255,
      z = 1 - Math.abs(x) - Math.abs(y),
      length = Math.hypot(x, y, z) || 1;
    result[i] = Math.round(((x / length) * 0.5 + 0.5) * 255);
    result[i + 1] = Math.round(((y / length) * 0.5 + 0.5) * 255);
    result[i + 2] = Math.round(((z / length) * 0.5 + 0.5) * 255);
    result[i + 3] = 255;
  }
  return texture(result);
}
function trimFinishes() {
  const idle = [...readyFinishes].filter(([, finish]) => !finish.refs);
  for (const [key, finish] of idle.slice(0, Math.max(0, idle.length - 2))) {
    finish.textures.forEach((texture) => texture.dispose());
    readyFinishes.delete(key);
    finishes.delete(key);
  }
}
async function prepare(choice: GloveChoice) {
  if (!choice.id) return;
  const definition = (await loadGloveCatalog()).find((item) => item.id === choice.id);
  if (!definition) throw new Error("This glove finish is not in the local catalog");
  await template(definition.model);
  if (!definition.paint) return { definition };
  const key = choiceKey(choice);
  const ready = readyFinishes.get(key);
  if (ready) {
    readyFinishes.delete(key);
    readyFinishes.set(key, ready);
  }
  let request = finishes.get(key);
  if (!request) {
    request = (async () => {
      const response = await assetFetch(`/skins/gloves/paints/${choice.id}.json`);
      if (!response.ok) throw new Error("Glove paint could not load");
      const baked = await bakeSkin((await response.json()) as Paint, choice.seed, choice.wear);
      const finish: Finish = { materials: new Map(), textures: [], refs: 0 };
      for (const target of baked) {
        const color = texture(target.maps.g_tColor, true),
          packed = target.maps.g_tMetalness;
        const orm = new Uint8Array(packed.length);
        for (let i = 0; i < orm.length; i += 4) {
          orm[i] = target.maps.g_tAmbientOcclusion?.[i] ?? 255;
          // Native character-glove mode1 packs roughness in normal.B;
          // mode2's red channel is zero (green is metalness, blue is sheen).
          orm[i + 1] = target.maps.g_tNormal?.[i + 2] ?? packed[i];
          orm[i + 2] = packed[i + 1];
          orm[i + 3] = 255;
        }
        const roughness = texture(orm),
          norm = target.maps.g_tNormal ? normal(target.maps.g_tNormal) : null;
        finish.textures.push(color, roughness, ...(norm ? [norm] : []));
        finish.materials.set(
          target.material
            .split("/")
            .at(-1)!
            .replace(/\.vmat$/, ""),
          {
            map: color,
            roughnessMap: roughness,
            metalnessMap: roughness,
            aoMap: roughness,
            ...(norm ? { normalMap: norm } : {}),
          },
        );
      }
      readyFinishes.set(key, finish);
      return finish;
    })().catch((error) => {
      finishes.delete(key);
      throw error;
    });
    finishes.set(key, request);
  }
  return { definition, finish: await request };
}

type Binding = {
  root: T.Group;
  team: Team;
  world: boolean;
  override?: GloveChoice;
  agent?: string;
  key: string;
  version: number;
  group?: T.Group;
  hidden: Map<T.Mesh, boolean>;
  helpers: T.Bone[];
  finish?: Finish;
  templates: Template[];
  retryAt: number;
};
const bindings = new Map<T.Group, Binding>();
function clear(binding: Binding) {
  if (binding.group) {
    releaseActorLightingMaterials(binding.root, binding.group);
    binding.group.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
    binding.group.removeFromParent();
    binding.group = undefined;
  }
  binding.helpers.forEach((bone) => bone.removeFromParent());
  binding.helpers = [];
  for (const [mesh, visible] of binding.hidden) mesh.visible = visible;
  binding.hidden.clear();
  if (binding.finish) binding.finish.refs--;
  binding.finish = undefined;
  binding.templates.forEach((template) => template.refs--);
  binding.templates = [];
  trimFinishes();
  trimTemplates();
}
export function unregisterGloveModel(root: T.Group) {
  const binding = bindings.get(root);
  if (!binding) return;
  binding.version++;
  clear(binding);
  bindings.delete(root);
}
function materialList(mesh: T.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}
function attach(
  binding: Binding,
  source: Template,
  view: boolean,
  skinMaterial?: T.Material,
  selection?: string,
) {
  const armRoot = binding.world
    ? binding.root
    : (binding.root.getObjectByName("agent-view-arms") ?? binding.root);
  const bones = new Map<string, T.Bone>();
  armRoot.traverse((object) => {
    if (object instanceof T.Bone && !bones.has(object.name.toLowerCase()))
      bones.set(object.name.toLowerCase(), object);
  });
  if (!bones.has("hand_l") || !bones.has("finger_index_meta_l")) return false;
  const group = new T.Group();
  group.name = "equipped-gloves";
  function targetBone(bone: T.Bone): T.Bone | undefined {
    let target = bones.get(bone.name.toLowerCase());
    if (target) return target;
    const parent = bone.parent instanceof T.Bone ? targetBone(bone.parent) : undefined;
    if (!parent) return;
    target = new T.Bone();
    target.name = `glove-helper-${bone.name}`;
    target.position.copy(bone.position).multiplyScalar(1 / 0.0254);
    target.quaternion.copy(bone.quaternion);
    target.scale.copy(bone.scale);
    parent.add(target);
    bones.set(bone.name.toLowerCase(), target);
    binding.helpers.push(target);
    return target;
  }
  for (const part of source.parts) {
    const name = part.mesh.name;
    if (
      selection
        ? selection === "agent_sleeves"
          ? part.role !== "sleeves"
          : !part.role
        : view
          ? !name.includes("viewmodel")
          : !name.includes("worldmodel")
    )
      continue;
    const joints: T.Bone[] = [];
    const skinIndex = part.geometry.getAttribute("skinIndex"),
      skinWeight = part.geometry.getAttribute("skinWeight"),
      used = new Set<number>();
    for (let i = 0; i < skinIndex.count; i++)
      for (let channel = 0; channel < 4; channel++)
        if (skinWeight.getComponent(i, channel) > 1e-6)
          used.add(skinIndex.getComponent(i, channel));
    for (const [index, bone] of part.mesh.skeleton.bones.entries()) {
      const target = used.has(index)
        ? targetBone(bone)
        : (bones.get(bone.name.toLowerCase()) ?? bones.get("hand_l"));
      if (!target) return false;
      joints.push(target);
    }
    const copy = (original: T.Material) => {
      const material = (
        skinMaterial && /bare_arm/.test(original.name) ? skinMaterial : original
      ).clone();
      if (material instanceof T.MeshStandardMaterial) {
        const maps = binding.finish?.materials.get(original.name);
        if (maps) {
          Object.assign(material, maps);
          material.color.setRGB(1, 1, 1);
        }
        material.needsUpdate = true;
      }
      return material;
    };
    const materials = materialList(part.mesh).map(copy);
    const mesh = new T.SkinnedMesh(
      part.geometry,
      materials.length === 1 ? materials[0] : materials,
    );
    mesh.name = `glove-${part.mesh.name}`;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    mesh.castShadow = false;
    mesh.bind(
      new T.Skeleton(
        joints,
        part.inverses.map((matrix) => matrix.clone()),
      ),
      new T.Matrix4(),
    );
    group.add(mesh);
  }
  if (!group.children.length) return false;
  binding.group ??= new T.Group();
  binding.group.name = "equipped-gloves";
  binding.group.add(group);
  armRoot.add(binding.group);
  return true;
}
let agentIndex: Promise<Record<string, { nativeModel: string }>> | undefined;
async function agentArms(id: string) {
  if (id === "default-t") return;
  const agent = (await loadAgentCatalog()).find((agent) => agent.id === id);
  if (!agent) return;
  let item = agent.itemId;
  if (!item) {
    agentIndex ??= assetFetch("/models/agents/inspects/catalog.json").then((response) =>
      response.json(),
    );
    item = Number(
      Object.entries(await agentIndex!).find(
        ([, entry]) => entry.nativeModel === agent.nativeModel,
      )?.[0],
    );
  }
  if (!item) return;
  return `/models/gloves/agents/${item}.glb`;
}
async function applyBinding(
  binding: Binding,
  choice: GloveChoice,
  agentId: string,
  version: number,
) {
  // Default world gloves are already part of the agent body. Only first-person
  // arms or an explicit world override need the optional arm texture/model pack.
  if (binding.world && !choice.id) {
    if (bindings.get(binding.root) === binding && binding.version === version) clear(binding);
    return;
  }
  const [prepared, agentPath] = await Promise.all([prepare(choice), agentArms(agentId)]);
  const paths = [prepared?.definition.model, agentPath].filter((path): path is string => !!path);
  const settled = await Promise.allSettled(
    paths.map(async (path) => {
      const result = await template(path);
      result.refs++;
      return result;
    }),
  );
  const acquired = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = settled.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    acquired.forEach((template) => template.refs--);
    trimTemplates();
    throw failed.reason;
  }
  if (bindings.get(binding.root) !== binding || binding.version !== version) {
    acquired.forEach((template) => template.refs--);
    trimTemplates();
    return;
  }
  clear(binding);
  binding.templates = acquired;
  const agent = agentPath ? acquired[paths.indexOf(agentPath)] : undefined;
  if (prepared?.finish) {
    binding.finish = prepared.finish;
    binding.finish.refs++;
  }
  const armRoot = binding.world
    ? binding.root
    : (binding.root.getObjectByName("agent-view-arms") ?? binding.root);
  let skinMaterial: T.Material | undefined;
  agent?.parts.forEach((part) =>
    materialList(part.mesh).forEach((material) => {
      if (/bare_arm/.test(material.name)) skinMaterial = material;
    }),
  );
  if (agent && !binding.world)
    attach(binding, agent, true, undefined, prepared ? "agent_sleeves" : "agent_default");
  const attached = prepared
    ? attach(
        binding,
        acquired[paths.indexOf(prepared.definition.model)],
        !binding.world,
        skinMaterial,
      )
    : !!binding.group;
  if (!attached) {
    clear(binding);
    return;
  }
  binding.group!.userData.gloveChoice = { ...choice };
  binding.group!.userData.agentId = agentId;
  armRoot.traverse((object) => {
    if (!(object instanceof T.Mesh) || object.parent?.name === "equipped-gloves") return;
    let parent: T.Object3D | null = object;
    while (parent && parent !== binding.group) parent = parent.parent;
    if (parent) return;
    const hidden = binding.world
      ? materialList(object).every((material) => /glove/i.test(material.name))
      : agent
        ? true
        : materialList(object).some((material) => /glove|bare_arm/.test(material.name));
    if (hidden) {
      binding.hidden.set(object, object.visible);
      object.visible = false;
    }
  });
  registerActorLighting(binding.root);
}
export function updateGloveModel(
  root: T.Group,
  team: Team,
  override?: GloveChoice,
  world = false,
  agentId = selectedAgentId(team),
) {
  let binding = bindings.get(root);
  if (!binding) {
    binding = {
      root,
      team,
      world,
      key: "",
      version: 0,
      hidden: new Map(),
      helpers: [],
      templates: [],
      retryAt: 0,
    };
    bindings.set(root, binding);
  }
  binding.team = team;
  binding.world = world;
  binding.override = override;
  binding.agent = agentId;
  const choice = override ?? gloveChoices[team],
    key = `${choiceKey(choice)}:${agentId}:${world}`;
  if (binding.key === key || Date.now() < binding.retryAt) return;
  binding.key = key;
  binding.retryAt = 0;
  const version = ++binding.version;
  void applyBinding(binding, choice, agentId, version).catch((error) => {
    if (binding!.version === version) {
      binding!.key = "";
      binding!.retryAt = Date.now() + 10000;
      console.error("Glove appearance could not load", error);
    }
  });
}
export const registerGloveModel = updateGloveModel;
export async function setGloves(team: Team, raw: GloveChoice) {
  const choice = sanitizeGloveChoice(raw);
  await prepare(choice);
  trimTemplates();
  gloveChoices[team] = choice;
  try {
    localStorage.setItem("cs2go-gloves", JSON.stringify(gloveChoices));
  } catch {
    /* Session selection remains available. */
  }
  for (const binding of bindings.values())
    if (binding.team === team && binding.override === undefined)
      updateGloveModel(binding.root, team, undefined, binding.world, binding.agent);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cs2go-gloves-change"));
}
