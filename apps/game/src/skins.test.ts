import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as T from "three";

vi.mock("./skin-baker", () => ({
  bakeSkin: async () => [
    {
      material: "materials/painted.vmat",
      maps: {
        g_tColor: new Uint8Array(1024 * 1024 * 4),
        g_tMetalness: new Uint8Array(1024 * 1024 * 4),
      },
      direct: {},
    },
  ],
}));
const choice = { id: "hd", wear: 0.13, seed: 661 };
let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === "/skins/catalog.json") return Response.json([{ id: "hd", weapon: 0, body: "hd" }]);
    if (url === "/skins/paints/hd.json") return Response.json({});
    throw new Error(`Unexpected asset ${url}`);
  });
});
afterEach(() => vi.unstubAllGlobals());
function body(name: string) {
  const root = new T.Group();
  root.name = name;
  const material = new T.MeshStandardMaterial();
  material.name = "painted";
  material.map = new T.Texture();
  material.map.flipY = false;
  material.map.offset.set(0.17, 0.23);
  material.map.repeat.set(3.2, 5.7);
  root.add(new T.Mesh(new T.BoxGeometry(), material));
  return { root, material };
}
function delayedBody() {
  let resolve!: (root: T.Group) => void;
  const promise = new Promise<T.Group>((done) => (resolve = done));
  return { promise, resolve };
}
test("restores a saved HD finish lazily, retains imported UVs, and restores native maps", async () => {
  storage.set("cs2go-skins-v1", JSON.stringify([choice]));
  const skins = await import("./skins");
  const root = new T.Group();
  const legacy = body("skin-legacy"),
    hd = body("skin-hd"),
    load = delayedBody();
  const native = hd.material.map!;
  root.add(legacy.root);
  skins.registerSkinModel(root, 0, () => load.promise);
  expect(legacy.root.visible).toBe(true);
  expect(root.getObjectByName("skin-hd")).toBeUndefined();
  load.resolve(hd.root);
  await vi.waitFor(() => expect(legacy.root.visible).toBe(false));
  expect(hd.root.visible).toBe(true);
  const uv = new T.Vector2(0.071, 0.113);
  expect(
    hd.material.map!.transformUv(uv.clone()).distanceTo(native.transformUv(uv.clone())),
  ).toBeLessThan(1e-9);
  expect(hd.material.map!.colorSpace).toBe(T.SRGBColorSpace);
  expect(hd.material.metalnessMap!.colorSpace).toBe(T.NoColorSpace);
  let disposed = 0;
  hd.material.map!.addEventListener("dispose", () => disposed++);
  await skins.setSkin(0, { ...choice, id: "" });
  expect(legacy.root.visible).toBe(true);
  expect(hd.root.visible).toBe(false);
  expect(hd.material.map).toBe(native);
  expect(disposed).toBe(1);
});
test("a default selection supersedes a delayed HD selection without a late visible swap", async () => {
  const skins = await import("./skins");
  const root = new T.Group(),
    legacy = body("skin-legacy"),
    hd = body("skin-hd");
  const load = delayedBody();
  root.add(legacy.root);
  let started = false;
  skins.registerSkinModel(root, 0, () => {
    started = true;
    return load.promise;
  });
  const pending = skins.setSkin(0, choice);
  await vi.waitFor(() => expect(started).toBe(true));
  await skins.setSkin(0, { ...choice, id: "" });
  load.resolve(hd.root);
  await pending;
  expect(legacy.root.visible).toBe(true);
  expect(hd.root.visible).toBe(false);
  expect(skins.skinChoices[0].id).toBe("");
  await skins.setSkin(0, choice);
  expect(hd.root.visible).toBe(true);
});
test("HD load failure preserves the previous body and selection, then retries", async () => {
  const skins = await import("./skins");
  const root = new T.Group(),
    legacy = body("skin-legacy"),
    hd = body("skin-hd");
  root.add(legacy.root);
  let fail = true;
  skins.registerSkinModel(root, 0, async () => {
    if (fail) {
      fail = false;
      throw new Error("offline");
    }
    return hd.root;
  });
  await expect(skins.setSkin(0, choice)).rejects.toThrow("offline");
  expect(legacy.root.visible).toBe(true);
  expect(skins.skinChoices[0].id).toBe("");
  await skins.setSkin(0, choice);
  expect(hd.root.visible).toBe(true);
  expect(skins.skinChoices[0]).toEqual(choice);
});
test("unregistering during an HD load disposes the orphan body but not shared textures", async () => {
  const skins = await import("./skins");
  const root = new T.Group(),
    hd = body("skin-hd"),
    load = delayedBody();
  const mesh = hd.root.children[0] as T.Mesh;
  let geometryDisposed = 0,
    materialDisposed = 0,
    textureDisposed = 0,
    started = false;
  mesh.geometry.addEventListener("dispose", () => geometryDisposed++);
  hd.material.addEventListener("dispose", () => materialDisposed++);
  hd.material.map!.addEventListener("dispose", () => textureDisposed++);
  skins.registerSkinModel(root, 0, () => {
    started = true;
    return load.promise;
  });
  const pending = skins.setSkin(0, choice);
  await vi.waitFor(() => expect(started).toBe(true));
  skins.unregisterSkinModel(root);
  load.resolve(hd.root);
  await pending;
  expect(root.getObjectByName("skin-hd")).toBeUndefined();
  expect([geometryDisposed, materialDisposed, textureDisposed]).toEqual([1, 1, 0]);
});

test("a created weapon keeps its finish when the owner's loadout changes and releases it after unbinding", async () => {
  const skins = await import("./skins");
  const { createWeaponInstance } = await import("./weapon-instance");
  const root = new T.Group(),
    legacy = body("skin-legacy"),
    hd = body("skin-hd");
  root.add(legacy.root);
  skins.registerSkinModel(root, 0, async () => hd.root);
  await skins.setSkin(0, choice);
  const instance = createWeaponInstance(0, "player", true);
  skins.bindWeaponInstance(root, instance);
  const paint = hd.material.map!;
  let disposed = 0;
  paint.addEventListener("dispose", () => disposed++);
  await skins.setSkin(0, { id: "", wear: 0.01, seed: 1 });
  expect(hd.root.visible).toBe(true);
  expect(hd.material.map).toBe(paint);
  expect(disposed).toBe(0);
  expect(instance.skin).toEqual(choice);
  expect(Object.isFrozen(instance.skin)).toBe(true);
  skins.bindWeaponInstance(root, null);
  expect(legacy.root.visible).toBe(true);
  expect(hd.root.visible).toBe(false);
  expect(disposed).toBe(1);
});
test("a bot's default weapon stays native when a matching player finish is selected", async () => {
  const skins = await import("./skins");
  const { createWeaponInstance } = await import("./weapon-instance");
  const root = new T.Group(),
    legacy = body("skin-legacy");
  root.add(legacy.root);
  const native = legacy.material.map;
  let loads = 0;
  skins.registerSkinModel(root, 0, async () => {
    loads++;
    return body("skin-hd").root;
  });
  skins.bindWeaponInstance(root, createWeaponInstance(0, "bot:0"));
  await skins.setSkin(0, choice);
  expect(loads).toBe(0);
  expect(legacy.root.visible).toBe(true);
  expect(legacy.material.map).toBe(native);
});
test("a captured HD weapon survives a loadout change while its body is still loading", async () => {
  storage.set("cs2go-skins-v1", JSON.stringify([choice]));
  const skins = await import("./skins"),
    { createWeaponInstance } = await import("./weapon-instance");
  const root = new T.Group(),
    legacy = body("skin-legacy"),
    hd = body("skin-hd"),
    load = delayedBody();
  root.add(legacy.root);
  skins.registerSkinModel(root, 0, () => load.promise);
  const instance = createWeaponInstance(0, "player", true);
  skins.bindWeaponInstance(root, instance);
  await skins.setSkin(0, { id: "", wear: 0.01, seed: 1 });
  load.resolve(hd.root);
  await vi.waitFor(() => expect((hd.material.map as T.DataTexture)?.isDataTexture).toBe(true));
  expect(hd.root.visible).toBe(true);
  expect(skins.skinChoices[0].id).toBe("");
  expect(instance.skin).toEqual(choice);
});

test("native firearms restore the finished HD default after clearing a paint", async () => {
  const skins = await import("./skins");
  const root = new T.Group(),
    legacy = body("skin-legacy"),
    hd = body("skin-hd");
  const native = hd.material.map;
  root.add(legacy.root, hd.root);
  skins.registerSkinModel(root, 0, undefined, true);
  expect(hd.root.visible).toBe(true);
  expect(legacy.root.visible).toBe(false);
  await skins.setSkin(0, choice);
  expect(hd.material.map).not.toBe(native);
  await skins.setSkin(0, { ...choice, id: "" });
  expect(hd.material.map).toBe(native);
  expect(hd.root.visible).toBe(true);
  expect(legacy.root.visible).toBe(false);
});
