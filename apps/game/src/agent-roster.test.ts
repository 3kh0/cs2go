import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as T from "three";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), model: vi.fn() }));
vi.mock("./asset-url", () => ({ assetFetch: mocks.fetch }));
vi.mock("./gltf", () => ({ loadModel: mocks.model }));
const definitions = Array.from({ length: 5 }, (_, index) => ({
  id: `agent-${index}`,
  name: `Agent ${index}`,
  team: index === 4 ? "ct" : "t",
  model: `/models/agents/roster/agent-${index}.glb`,
}));
beforeEach(() => {
  vi.resetModules();
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => definitions });
  mocks.model.mockReset().mockImplementation(async () => {
    const scene = new T.Group();
    for (const name of ["hand_R", "pelvis"]) {
      const bone = new T.Bone();
      bone.name = name;
      scene.add(bone);
    }
    scene.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
    return { scene };
  });
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

test("existing default CT selections resolve to native SAS with the shared Source 2 rig", async () => {
  localStorage.setItem("cs2go-agents", JSON.stringify({ ct: "default-ct", t: "default-t" }));
  const roster = await import("./agent-roster");
  const appearance = await roster.acquireAgentAppearance("default-ct");
  expect(roster.selectedAgentId("ct")).toBe("default-ct");
  expect(roster.defaultAgent("ct").itemId).toBe(5600);
  expect(mocks.model).toHaveBeenCalledWith("/models/agents/roster/ctm-sas.glb", 1);
  expect(appearance?.animationTeam).toBe("t");
  expect(appearance?.agentId).toBe("default-ct");
  appearance!.release();
});

test("catalog and agent geometry stay lazy, and team selection is validated", async () => {
  const roster = await import("./agent-roster");
  expect(roster.selectedAgentId("ct")).toBe("default-ct");
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.model).not.toHaveBeenCalled();
  await roster.loadAgentCatalog();
  expect(mocks.model).not.toHaveBeenCalled();
  expect(() => roster.setSelectedAgent("ct", "agent-0")).toThrow();
  roster.setSelectedAgent("t", "agent-0");
  expect(JSON.parse(localStorage.getItem("cs2go-agents")!)).toEqual({
    ct: "default-ct",
    t: "agent-0",
  });
  expect(roster.peekSelectedAgent("t")).toBeUndefined();
  const appearance = await roster.acquireAgentAppearance("agent-0");
  const bot = roster.peekSelectedAgent("t");
  expect(bot?.scene).toBe(appearance?.scene);
  expect(mocks.model).toHaveBeenCalledTimes(1);
  appearance!.release();
  bot!.release();
});

test("unreferenced templates are bounded while active soldiers retain their shared geometry", async () => {
  const roster = await import("./agent-roster");
  const active = await roster.acquireAgentAppearance("agent-0");
  const mesh = active!.scene.children.find((object) => object instanceof T.Mesh) as T.Mesh;
  const disposed = vi.spyOn(mesh.geometry, "dispose");
  for (const id of ["agent-1", "agent-2", "agent-3", "agent-4"]) {
    const appearance = await roster.acquireAgentAppearance(id);
    appearance!.release();
  }
  expect(disposed).not.toHaveBeenCalled();
  const again = await roster.acquireAgentAppearance("agent-0");
  expect(again?.scene).toBe(active?.scene);
  again!.release();
  active!.release();
  const firstIdle = await roster.acquireAgentAppearance("agent-1");
  expect(mocks.model).toHaveBeenCalledTimes(6);
  firstIdle!.release();
});

test("simultaneously completed acquisitions retain geometry before their leases resume", async () => {
  const roster = await import("./agent-roster");
  const previous = await roster.acquireAgentAppearance("agent-0");
  const pending: (() => void)[] = [];
  const disposed: ReturnType<typeof vi.spyOn>[] = [];
  mocks.model.mockImplementation(
    () =>
      new Promise((resolve) => {
        const scene = new T.Group();
        for (const name of ["hand_R", "pelvis"]) {
          const bone = new T.Bone();
          bone.name = name;
          scene.add(bone);
        }
        const geometry = new T.BoxGeometry();
        disposed.push(vi.spyOn(geometry, "dispose"));
        scene.add(new T.Mesh(geometry, new T.MeshStandardMaterial()));
        pending.push(() => resolve({ scene }));
      }),
  );
  const acquisitions = ["agent-1", "agent-2", "agent-3", "agent-4"].map(
    roster.acquireAgentAppearance,
  );
  await Promise.resolve();
  expect(pending).toHaveLength(4);
  pending.forEach((resolve) => resolve());
  // Model assignment .then handlers run first. The old lease release can then
  // prune templates before the pending catch/await chains have resumed.
  queueMicrotask(() => previous!.release());
  const appearances = await Promise.all(acquisitions);
  disposed.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  appearances.forEach((appearance) => appearance!.release());
  expect(disposed.filter((spy) => spy.mock.calls.length)).toHaveLength(2);
});

test("missing imported roughness is repaired without flattening valid maps or metalness", async () => {
  const roughnessMap = new T.Texture(),
    metalnessMap = new T.Texture();
  const cloth = new T.MeshStandardMaterial({ roughnessMap, metalnessMap });
  cloth.name = "ctm_fbi_v2_body_variantf";
  const valid = new T.MeshStandardMaterial({ roughnessMap, metalnessMap, roughness: 0.7 });
  valid.name = "glove_hardknuckle_black";
  mocks.model.mockImplementation(async () => {
    const scene = new T.Group();
    for (const name of ["hand_R", "pelvis"]) {
      const bone = new T.Bone();
      bone.name = name;
      scene.add(bone);
    }
    scene.add(new T.Mesh(new T.BoxGeometry(), [cloth, valid]));
    return { scene };
  });
  const roster = await import("./agent-roster");
  const appearance = await roster.acquireAgentAppearance("agent-0");
  expect(cloth.roughnessMap).toBeNull();
  expect(cloth.roughness).toBe(0.85);
  expect(cloth.metalnessMap).toBe(metalnessMap);
  expect(valid.roughnessMap).toBe(roughnessMap);
  expect(valid.roughness).toBe(0.7);
  appearance!.release();
});
