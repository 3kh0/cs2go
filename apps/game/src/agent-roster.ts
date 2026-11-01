import * as T from "three";
import { assetFetch } from "./asset-url";
import { loadModel } from "./gltf";
import missingRoughness from "./data/agent-roughness.json";
import type { AgentTeam } from "./soldier";

export type AgentDefinition = {
  id: string;
  name: string;
  team: AgentTeam;
  model: string;
  nativeModel?: string;
  bytes?: number;
  category?: "base" | "cosmetic";
  itemId?: number;
  image?: string;
  sourcePose?: string;
};
export type AgentAppearance = {
  scene: T.Group;
  animationTeam: "t";
  agentId?: string;
  release: () => void;
};
const defaults: Record<AgentTeam, AgentDefinition> = {
  ct: { id: "default-ct", name: "IDF | Counter-Terrorists", team: "ct", model: "" },
  t: { id: "default-t", name: "Ground Rebel | Elite Crew", team: "t", model: "" },
};
const choices: Record<AgentTeam, string> = { ct: "default-ct", t: "default-t" };
try {
  const saved = JSON.parse(localStorage.getItem("cs2go-agents") ?? "{}");
  for (const team of ["ct", "t"] as const)
    if (typeof saved[team] === "string" && /^[a-z0-9-]{1,100}$/.test(saved[team]))
      choices[team] = saved[team];
} catch {
  // Agent selection also works without persistent browser storage.
}
let catalog: AgentDefinition[] | undefined;
let catalogRequest: Promise<AgentDefinition[]> | undefined;
export function defaultAgent(team: AgentTeam) {
  return defaults[team];
}
export function selectedAgentId(team: AgentTeam) {
  return choices[team];
}
export function selectedAgent(team: AgentTeam) {
  return (
    catalog?.find((agent) => agent.team === team && agent.id === choices[team]) ?? defaults[team]
  );
}
export async function loadAgentCatalog(): Promise<AgentDefinition[]> {
  if (catalog) return catalog;
  return (catalogRequest ??= (async () => {
    const response = await assetFetch("/models/agents/roster/catalog.json");
    if (!response.ok) throw new Error("Agent catalog could not load");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid agent catalog");
    const ids = new Set<string>(["default-ct", "default-t"]);
    const agents = data.filter((entry): entry is AgentDefinition => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !/^[a-z0-9-]{1,100}$/.test(entry.id) ||
        typeof entry.name !== "string" ||
        entry.name.length > 160 ||
        (entry.team !== "ct" && entry.team !== "t") ||
        typeof entry.model !== "string" ||
        !/^\/models\/agents\/roster\/[a-z0-9-]+\.glb$/.test(entry.model) ||
        ids.has(entry.id)
      )
        return false;
      ids.add(entry.id);
      return true;
    });
    if (agents.length !== data.length) throw new Error("Invalid or duplicate agent entries");
    catalog = [defaults.ct, defaults.t, ...agents.sort((a, b) => a.name.localeCompare(b.name))];
    for (const team of ["ct", "t"] as const)
      if (!catalog.some((agent) => agent.team === team && agent.id === choices[team]))
        choices[team] = defaults[team].id;
      else {
        const saved = catalog.find((agent) => agent.id === choices[team])!;
        choices[team] = catalog.find(
          (agent) => agent.team === team && agent.model === saved.model,
        )!.id;
      }
    return catalog;
  })().catch((error) => {
    catalogRequest = undefined;
    throw error;
  }));
}
export function setSelectedAgent(team: AgentTeam, id: string) {
  const agent = [...(catalog ?? []), defaults[team]].find(
    (item) => item.id === id && item.team === team,
  );
  if (!agent) throw new Error("That agent is not available for this team");
  const canonical =
    catalog?.find((item) => item.team === team && item.model === agent.model) ?? agent;
  choices[team] = canonical.id;
  window.dispatchEvent(new Event("cs2go-agent-selection"));
  try {
    localStorage.setItem("cs2go-agents", JSON.stringify(choices));
  } catch {
    // Keep the selected appearance for this session.
  }
}
type Cached = { scene?: T.Group; pending: Promise<void>; references: number; used: number };
const models = new Map<string, Cached>();
const idleLimit = 2;
let clock = 0;
function disposeTemplate(scene: T.Group) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    }
    if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
function prune() {
  const idle = [...models]
    .filter(([, entry]) => !entry.references && entry.scene)
    .sort(([, a], [, b]) => b.used - a.used);
  for (const [key, entry] of idle.slice(idleLimit)) {
    models.delete(key);
    disposeTemplate(entry.scene!);
  }
}
function lease(entry: Cached, reserved = false, agentId?: string): AgentAppearance {
  if (!reserved) entry.references++;
  entry.used = ++clock;
  let released = false;
  return {
    scene: entry.scene!,
    animationTeam: "t",
    agentId,
    release() {
      if (released) return;
      released = true;
      entry.references--;
      prune();
    },
  };
}
/** Every returned scene is a shared template; release only after its clones are removed. */
export async function acquireAgentAppearance(id: string): Promise<AgentAppearance | undefined> {
  if (id === "default-ct" || id === "default-t") return undefined;
  const agent = (await loadAgentCatalog()).find((item) => item.id === id);
  if (!agent?.model) throw new Error("Agent not found in the installed roster");
  let entry = models.get(agent.model);
  if (!entry) {
    entry = { pending: Promise.resolve(), references: 0, used: ++clock };
    models.set(agent.model, entry);
    const current = entry;
    current.pending = loadModel(agent.model, 1)
      .then((model) => {
        if (!model.scene.getObjectByName("hand_R") || !model.scene.getObjectByName("pelvis")) {
          disposeTemplate(model.scene);
          throw new Error("Unsupported agent skeleton");
        }
        // These native exports have an entirely black ORM green channel:
        // missing Source2 anisotropic gloss becomes mirror-smooth in glTF.
        // Repair only the audited materials, preserving valid roughness maps,
        // the packed AO/metalness channels, and genuinely metallic equipment.
        model.scene.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            const roughness = (missingRoughness as Record<string, number>)[material.name];
            if (material instanceof T.MeshStandardMaterial && roughness !== undefined) {
              material.roughnessMap = null;
              material.roughness = roughness;
            }
          }
        });
        model.scene.userData.agentModel = agent.model;
        current.scene = model.scene;
      })
      .catch((error) => {
        models.delete(agent.model);
        throw error;
      });
  }
  // Reserve before awaiting: a fulfilled model may be visible to prune() for
  // several microtasks before this acquisition resumes and returns its lease.
  entry.references++;
  entry.used = ++clock;
  try {
    await entry.pending;
    return lease(entry, true, agent.id);
  } catch (error) {
    entry.references--;
    prune();
    throw error;
  }
}
/** Newly spawned soldiers can use a ready selected template without blocking simulation. */
export function peekSelectedAgent(team: AgentTeam): AgentAppearance | undefined {
  const agent = selectedAgent(team);
  const entry = agent.model ? models.get(agent.model) : undefined;
  return entry?.scene ? lease(entry, false, agent.id) : undefined;
}
